// App-wide data store using React Context.
//
// Two storage backends, same API for the rest of the app:
//  - "db": when published as a claude.ai Artifact, data lives in the artifact's
//    database (collections: people, interactions, snoozes) and syncs across devices.
//  - "local": when running on your computer (npm run dev), data lives in this
//    browser's localStorage and the first load is seeded from src/data/seed.json.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildProfiles, buildSuggestions } from './insights.js';
import { todayISO } from './dates.js';

const LOCAL_KEY = 'networking-tracker:collections:v2';
const COLLECTIONS = ['people', 'interactions', 'snoozes'];
const EMPTY = { people: {}, interactions: {}, snoozes: {} };

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

/** Retry a db call on transient / rate-limit errors. */
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

export function DataProvider({ children }) {
  const [cols, setCols] = useState(EMPTY);
  const [backend, setBackend] = useState(null); // 'db' | 'local'
  const [status, setStatus] = useState('loading'); // loading | slow | ready | error
  const [writeError, setWriteError] = useState(null);
  const dbRef = useRef(null);
  const colsRef = useRef(cols); // latest data, for actions that read before writing
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  // ---------- connect to storage (runs once) ----------
  useEffect(() => {
    let cancelled = false;
    const unsubs = [];
    let timer;

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
        unsubs.push(
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
      unsubs.forEach((u) => u());
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
      : `Couldn’t save that change (${e?.code || 'error'}). Try again.`;
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
    } else {
      setCols((c) => ({ ...c, [coll]: { ...c[coll], [id]: body } }));
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
    } else {
      setCols((c) => {
        const { [id]: _drop, ...rest } = c[coll];
        return { ...c, [coll]: rest };
      });
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
      const current = colsRef.current;
      const ops = [];
      for (const coll of ['people', 'interactions']) {
        for (const id of Object.keys(current[coll])) if (!target[coll][id]) ops.push(() => deleteDoc(coll, id));
        for (const [id, body] of Object.entries(target[coll])) {
          if (JSON.stringify(current[coll][id]) !== JSON.stringify(body)) ops.push(() => setDoc(coll, id, body));
        }
      }
      for (const id of Object.keys(current.snoozes)) ops.push(() => deleteDoc('snoozes', id));
      if (!dbRef.current) {
        setCols(target);
        onProgress(1);
        return;
      }
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

  const value = { people, interactions, profiles, suggestions, backend, status, writeError, ...actions };
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
