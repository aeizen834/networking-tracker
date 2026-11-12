// Log a new networking interaction (or edit an existing one at /log/:id/edit).
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { PageHeader } from '../components/ui.jsx';
import { INTERACTION_TYPES } from '../lib/insights.js';
import { addDays, extractPlannedDate, formatDate, parseISO, toISO, todayISO } from '../lib/dates.js';

export default function AddInteraction() {
  const { id } = useParams(); // present when editing
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { people, interactions, addPerson, addInteraction, updateInteraction } = useData();

  const existing = id ? interactions.find((i) => i.id === id) : null;
  const preselected = people.find((p) => p.id === (existing?.personId || params.get('person')));

  const [name, setName] = useState(preselected?.name || '');
  const [newPerson, setNewPerson] = useState({ company: '', role: '', industry: '', howWeMet: '' });
  const [form, setForm] = useState({
    date: existing?.date || todayISO(),
    type: existing?.type || 'Email',
    topic: existing?.topic || '',
    response: existing?.response ?? '',
    nextSteps: existing?.nextSteps || '',
    followUp: existing?.followUp || '',
  });
  const [saved, setSaved] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNP = (k) => (e) => setNewPerson((p) => ({ ...p, [k]: e.target.value }));

  const match = people.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  const isNew = name.trim() && !match;
  const recent = useMemo(
    () => (match ? interactions.filter((i) => i.personId === match.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : []),
    [match, interactions]
  );
  const detected = !form.followUp && form.nextSteps ? extractPlannedDate(form.nextSteps, form.date) : null;
  const topics = useMemo(() => [...new Set(interactions.map((i) => i.topic).filter(Boolean))].slice(-60), [interactions]);

  function quickFollowUp(days) {
    setForm((f) => ({ ...f, followUp: toISO(addDays(parseISO(f.date), days)) }));
  }

  function handleSubmit(e, another = false) {
    e.preventDefault();
    let person = match;
    if (!person) person = addPerson({ name: name.trim(), ...newPerson, dateConnected: form.date });
    const payload = { ...form, personId: person.id };
    if (existing) updateInteraction(existing.id, payload);
    else addInteraction(payload);

    if (another) {
      setSaved(person.name);
      setName('');
      setForm((f) => ({ ...f, topic: '', response: '', nextSteps: '', followUp: '' }));
    } else {
      navigate(`/people/${person.id}`);
    }
  }

  return (
    <>
      <PageHeader
        title={existing ? 'Edit interaction' : 'Log an interaction'}
        subtitle={existing ? null : 'Emails, texts, calls, coffees, intros: anything that moves a relationship forward.'}
      />
      {saved && <div className="toast">✓ Saved interaction with {saved}</div>}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="span-2">Person
            <input
              list="people-list"
              required
              autoFocus={!preselected}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Start typing a name…"
            />
            <datalist id="people-list">{people.map((p) => <option key={p.id} value={p.name}>{p.company}</option>)}</datalist>
            {match && <span className="hint">{[match.role, match.company].filter(Boolean).join(' · ')}</span>}
            {isNew && <span className="hint hint-new">New person: they’ll be added to your People list</span>}
          </label>

          {isNew && (
            <fieldset className="span-2 sub-fields">
              <legend>About {name.trim()}</legend>
              <label>Company<input value={newPerson.company} onChange={setNP('company')} /></label>
              <label>Role<input value={newPerson.role} onChange={setNP('role')} /></label>
              <label>Industry
                <input list="industry-dl" value={newPerson.industry} onChange={setNP('industry')} />
                <datalist id="industry-dl">{[...new Set(people.map((p) => p.industry?.trim()).filter(Boolean))].map((i) => <option key={i} value={i} />)}</datalist>
              </label>
              <label>Introduced by
                <input list="intro-dl" value={newPerson.howWeMet} onChange={setNP('howWeMet')} placeholder="Me, Mom, or a contact’s name" />
                <datalist id="intro-dl">{['Me', ...people.map((p) => p.name)].map((n) => <option key={n} value={n} />)}</datalist>
              </label>
            </fieldset>
          )}

          <label>Date<input type="date" required value={form.date} onChange={set('date')} /></label>
          <label>Channel
            <select value={form.type} onChange={set('type')}>
              {INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>

          <label className="span-2">What it was about
            <input list="topic-list" value={form.topic} onChange={set('topic')} placeholder="e.g. Catch Up, App Update, Intro Call" />
            <datalist id="topic-list">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </label>

          <div className="span-2">
            <span className="label-text">Did they respond?</span>
            <div className="segmented">
              {[['Yes', '✓ Yes'], ['No', '✕ No'], ['', '… Not yet']].map(([v, l]) => (
                <button type="button" key={l} aria-pressed={form.response === v} onClick={() => setForm((f) => ({ ...f, response: v }))}>{l}</button>
              ))}
            </div>
          </div>

          <label className="span-2">Notes / next steps
            <textarea rows={4} value={form.nextSteps} onChange={set('nextSteps')} placeholder="What you talked about, advice they gave, what happens next (e.g. “Talking 12/4”, “Follow up in Jan”)" />
            {detected && <span className="hint">📅 Found a date in your note: you’ll be reminded around {formatDate(detected)}</span>}
          </label>

          <div className="span-2">
            <span className="label-text">Remind me to follow up <span className="muted small">(optional)</span></span>
            <div className="followup-row">
              <input type="date" value={form.followUp} onChange={set('followUp')} />
              {[['1 wk', 7], ['2 wks', 14], ['1 mo', 30], ['3 mo', 90]].map(([l, d]) => (
                <button type="button" key={l} className="btn btn-ghost btn-sm" onClick={() => quickFollowUp(d)}>{l}</button>
              ))}
              {form.followUp && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, followUp: '' }))}>Clear</button>}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit">{existing ? 'Save changes' : 'Save'}</button>
          {!existing && <button className="btn btn-ghost" type="button" onClick={(e) => handleSubmit(e, true)} disabled={!name.trim()}>Save & log another</button>}
          <button className="btn btn-ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>

      {recent.length > 0 && (
        <div className="card">
          <h2>Recent with {match.name}</h2>
          <ul className="plain-list">
            {recent.map((i) => (
              <li key={i.id}><strong>{formatDate(i.date)}</strong> · {i.type} · {i.topic} {i.nextSteps && <span className="muted">· {i.nextSteps}</span>}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
