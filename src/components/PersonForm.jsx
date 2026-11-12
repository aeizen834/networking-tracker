// Controlled form for creating/editing a person.
import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';

const EMPTY = { name: '', company: '', role: '', industry: '', howWeMet: '', dateConnected: '', formerRole: '', notes: '' };

export default function PersonForm({ initial, onSubmit, onCancel, submitLabel = 'Save' }) {
  const { people } = useData();
  const [values, setValues] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const industries = [...new Set(people.map((p) => p.industry?.trim()).filter(Boolean))];
  const introducers = [...new Set(['Me', ...people.map((p) => p.howWeMet), ...people.map((p) => p.name)].filter(Boolean))];

  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...values, name: values.name.trim() });
      }}
    >
      <label>Name<input required value={values.name} onChange={set('name')} /></label>
      <label>Company<input value={values.company} onChange={set('company')} /></label>
      <label>Role<input value={values.role} onChange={set('role')} /></label>
      <label>Industry
        <input list="industry-list" value={values.industry} onChange={set('industry')} />
        <datalist id="industry-list">{industries.map((i) => <option key={i} value={i} />)}</datalist>
      </label>
      <label>How we met / introduced by
        <input list="intro-list" value={values.howWeMet} onChange={set('howWeMet')} />
        <datalist id="intro-list">{introducers.map((i) => <option key={i} value={i} />)}</datalist>
      </label>
      <label>Date connected<input type="date" value={values.dateConnected} onChange={set('dateConnected')} /></label>
      <label className="span-2">Former role<input value={values.formerRole} onChange={set('formerRole')} placeholder="e.g. Washington Commanders (SVP, 2024–2026)" /></label>
      <label className="span-2">Notes<textarea rows={3} value={values.notes} onChange={set('notes')} placeholder="Interests, family, things to remember…" /></label>
      <div className="form-actions span-2">
        <button className="btn btn-primary" type="submit">{submitLabel}</button>
        {onCancel && <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
