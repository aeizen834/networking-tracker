// App-wide data store using React Context.
//
// Three storage backends, same API for the rest of the app:
//  - "supabase": the GitHub Pages site (and local dev when .env has Supabase settings).
//    You sign in with an email link; data lives in your Supabase database and syncs
//    across devices. Row Level Security means only you can read or change it.
//  - "db": when published as a claude.ai Artifact, data lives in the artifact's database.
//  - "local": fallback when neither is available; data lives in this browser's localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildProfiles, buildSuggestions } from './insights.js';
import { todayISO } from './dates.js';
import { supabase } from './supabase.js';

const LOCAL_KEY = 'networking-tracker:collections:v2';
const COLLECTIONS = ['people', 'interactions', 'snoozes'];
const EMPTY = { people: {}, interactions: {}, snoozes: {} };
const TABLE = 'records';

const DataContext = createContext(null);

const newId = (prefix) => `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripId = ({ id: _id, ...rest }) => rest;

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveLocal(cols) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cols));
  } catch {
    /* storage blocked or full */
  }
}

/** Turn { people: [...], interactions: [...] } into id-keyed maps. */
function toCollections({ people = [], interactions = [] }, snoozes = {}) {
  return {
    people: Object.fromEntries(people.map((p) => [p.id, stripId(p)])),
    interactions: Object.fromEntries(interactions.map((i) => [i.id, stripId(i)])),
    snoozes,
  };
}

async function loadSeed() {
  // Only bundled in development, so your contact list never ships inside the published page.
  // seed.json is git-ignored (it holds real contacts), so it may not exist in a fresh clone.
  const loader = import.meta.glob('../data/seed.json')['../data/seed.json'];
  if (!import.meta.env.DEV || !loader) return EMPTY;
  const seed = (await loader()).default;
  return toCollections(seed);
}

/** Retry a claude.ai db call on transient / rate-limit errors. */
async function withRetry(fn, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e?.code === 'unavailable' || e?.code === 'resource_exhausted';
      if (!retryable || attempt >= tries) throw e;
      await sleep(400 * attempt + Math.random() * 300);
    }
  }
}

/** Read every row the signed-in user owns (Supabase returns at most 1000 per request). */
async function fetchAllRecords() {
  const cols = { people: {}, interactions: {}, snoozes: {} };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('collection,id,data')
      .order('collection')
      .order('id')
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data) if (cols[r.collection]) cols[r.collection][r.id] = r.data;
    if (data.length < 1000) break;
  }
  return cols;
}

export function DataProvider({ children }) {
  const [cols, setCols] = useState(EMPTY);
  const [backend, setBackend] = useState(null); // 'supabase' | 'db' | 'local'
  const [status, setStatus] = useState('loading'); // loading | slow | signedOut | ready | error
  const [writeError, setWriteError] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const dbRef = useRef(null); // claude.ai artifact db
  const userIdRef = useRef(null); // Supabase user id
  const colsRef = useRef(cols); // latest data, for actions that read before writing
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  // ---------- connect to storage (runs once) ----------
  useEffect(() => {
    let cancelled = false;
    const cleanups = [];
    let timer;

    // --- Supabase (GitHub Pages / local dev) ---
    if (supabase) {
      setBackend('supabase');
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // Don't call Supabase from inside this callback; defer to the next tick.
        setTimeout(async () => {
          if (cancelled) return;
          if (!session) {
            userIdRef.current = null;
            setUserEmail(null);
            setCols(EMPTY);
            setStatus('signedOut');
            return;
          }
          // Remove the one-time ?code=... from the address bar after an email-link sign-in
          if (window.location.search.includes('code=')) {
            window.history.replaceState(null, '', window.location.pathname + window.location.hash);
          }
          if (userIdRef.current === session.user.id) return; // token refresh, same user
          userIdRef.current = session.user.id;
          setUserEmail(session.user.email);
          setStatus('loading');
          try {
            const loaded = await fetchAllRecords();
            if (!cancelled) {
              setCols(loaded);
              setStatus('ready');
            }
          } catch (e) {
            setStatus('error');
            setWriteError(`Couldn’t load your data: ${e.message}`);
          }
        }, 0);
      });
      cleanups.push(() => data.subscription.unsubscribe());
      return () => {
        cancelled = true;
        cleanups.forEach((c) => c());
      };
    }

    // --- claude.ai artifact database, or this browser ---
    (async () => {
      const db = window.claude?.use ? await window.claude.use('db').catch(() => null) : null;
      if (cancelled) return;

      if (!db) {
        const stored = loadLocal() ?? (await loadSeed());
        if (cancelled) return;
        setCols(stored);
        setBackend('local');
        setStatus('ready');
        return;
      }

      dbRef.current = db;
      setBackend('db');
      timer = setTimeout(() => setStatus((s) => (s === 'loading' ? 'slow' : s)), 10000);
      const seen = new Set();
      for (const name of COLLECTIONS) {
        cleanups.push(
          db.collection(name).onSnapshot(
            (snap) => {
              const map = {};
              for (const d of snap.docs) map[d.id] = d.data();
              setCols((c) => ({ ...c, [name]: map }));
              seen.add(name);
              if (seen.size === COLLECTIONS.length) {
                clearTimeout(timer);
                setStatus('ready');
              }
            },
            (err) => {
              clearTimeout(timer);
              setStatus('error');
              setWriteError(`Couldn’t load your data (${err.code}). Reload the page to try again.`);
            }
          )
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanups.forEach((c) => c());
    };
  }, []);

  // Persist local mode whenever data changes
  useEffect(() => {
    if (backend === 'local') saveLocal(cols);
  }, [cols, backend]);

  // ---------- low-level writes ----------
  const report = useCallback((e) => {
    const msg = e?.code === 'quota_exceeded'
      ? 'Storage is full. Delete some old interactions to make room.'
      : `Couldn’t save that change (${e?.message || e?.code || 'error'}). Reload and try again.`;
    setWriteError(msg);
  }, []);

  const setDoc = useCallback(async (coll, id, body) => {
    if (dbRef.current) {
      try {
        await withRetry(() => dbRef.current.collection(coll).doc(id).set(body));
      } catch (e) {
        report(e);
        throw e;
      }
      return;
    }
    // Local and Supabase: update the screen right away, then save.
    setCols((c) => ({ ...c, [coll]: { ...c[coll], [id]: body } }));
    if (supabase && userIdRef.current) {
      const { error } = await supabase.from(TABLE).upsert(
        { user_id: userIdRef.current, collection: coll, id, data: body, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,collection,id' }
      );
      if (error) {
        report(error);
        throw error;
      }
    }
  }, [report]);

  const deleteDoc = useCallback(async (coll, id) => {
    if (dbRef.current) {
      try {
        await withRetry(() => dbRef.current.collection(coll).doc(id).delete());
      } catch (e) {
        report(e);
        throw e;
      }
      return;
    }
    setCols((c) => {
      const { [id]: _drop, ...rest } = c[coll];
      return { ...c, [coll]: rest };
    });
    if (supabase && userIdRef.current) {
      const { error } = await supabase.from(TABLE).delete().eq('collection', coll).eq('id', id);
      if (error) {
        report(error);
        throw error;
      }
    }
  }, [report]);

  // ---------- actions used by the pages ----------
  const actions = useMemo(() => ({
    addPerson(person) {
      const id = newId('p');
      const body = { name: '', company: '', role: '', industry: '', howWeMet: '', dateConnected: '', formerRole: '', notes: '', ...stripId(person) };
      setDoc('people', id, body).catch(() => {});
      return { id, ...body };
    },
    updatePerson(id, changes) {
      const current = colsRef.current.people[id] || {};
      setDoc('people', id, { ...current, ...stripId(changes) }).catch(() => {});
    },
    async deletePerson(id) {
      const related = Object.entries(colsRef.current.interactions).filter(([, i]) => i.personId === id);
      for (const [iid] of related) await deleteDoc('interactions', iid).catch(() => {});
      if (colsRef.current.snoozes[id]) await deleteDoc('snoozes', id).catch(() => {});
      await deleteDoc('people', id).catch(() => {});
    },
    addInteraction(interaction) {
      const id = newId('i');
      setDoc('interactions', id, stripId(interaction)).catch(() => {});
      // Logging a touch clears any snooze for that person
      if (colsRef.current.snoozes[interaction.personId]) deleteDoc('snoozes', interaction.personId).catch(() => {});
      return { id, ...interaction };
    },
    updateInteraction(id, changes) {
      const current = colsRef.current.interactions[id] || {};
      setDoc('interactions', id, { ...current, ...stripId(changes) }).catch(() => {});
    },
    deleteInteraction(id) {
      deleteDoc('interactions', id).catch(() => {});
    },
    snooze(personId, untilISO) {
      setDoc('snoozes', personId, { until: untilISO }).catch(() => {});
    },
    unsnooze(personId) {
      deleteDoc('snoozes', personId).catch(() => {});
    },
    /** Replace everything (spreadsheet import / backup restore). Reports progress 0..1. */
    async replaceAll(next, onProgress = () => {}) {
      const target = toCollections(next);

      if (supabase && userIdRef.current) {
        const uid = userIdRef.current;
        const { error: delError } = await supabase.from(TABLE).delete().eq('user_id', uid);
        if (delError) throw delError;
        const rows = ['people', 'interactions'].flatMap((coll) =>
          Object.entries(target[coll]).map(([id, data]) => ({ user_id: uid, collection: coll, id, data }))
        );
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabase.from(TABLE).insert(rows.slice(i, i + 200));
          if (error) throw error;
          onProgress(Math.min(1, (i + 200) / rows.length));
        }
        setCols(target);
        onProgress(1);
        return;
      }

      if (!dbRef.current) {
        setCols(target);
        onProgress(1);
        return;
      }

      const current = colsRef.current;
      const ops = [];
      for (const coll of ['people', 'interactions']) {
        for (const id of Object.keys(current[coll])) if (!target[coll][id]) ops.push(() => deleteDoc(coll, id));
        for (const [id, body] of Object.entries(target[coll])) {
          if (JSON.stringify(current[coll][id]) !== JSON.stringify(body)) ops.push(() => setDoc(coll, id, body));
        }
      }
      for (const id of Object.keys(current.snoozes)) ops.push(() => deleteDoc('snoozes', id));
      let done = 0;
      for (const op of ops) {
        await op();
        onProgress(++done / ops.length);
      }
      onProgress(1);
    },
    async resetToSeed() {
      setCols(await loadSeed());
    },
    /** Email a one-time sign-in link (Supabase only). */
    async signIn(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    },
    async signOut() {
      await supabase?.auth.signOut();
    },
    clearWriteError() {
      setWriteError(null);
    },
  }), [setDoc, deleteDoc]);

  // ---------- derived data ----------
  const people = useMemo(() => Object.entries(cols.people).map(([id, p]) => ({ id, ...p })), [cols.people]);
  const interactions = useMemo(
    () => Object.entries(cols.interactions).map(([id, i]) => ({ id, ...i })).filter((i) => i.personId && i.date),
    [cols.interactions]
  );
  const profiles = useMemo(() => buildProfiles(people, interactions), [people, interactions]);
  const suggestions = useMemo(() => {
    const t = todayISO();
    return buildSuggestions(profiles).map((s) => {
      const until = cols.snoozes[s.profile.person.id]?.until;
      return { ...s, snoozedUntil: until && until > t ? until : null };
    });
  }, [profiles, cols.snoozes]);

  const value = { people, interactions, profiles, suggestions, backend, status, writeError, userEmail, ...actions };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

export function useProfile(personId) {
  const { profiles } = useData();
  return profiles.find((p) => p.person.id === personId) || null;
}
