import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { PageHeader, ResponsePill, ConfirmButton } from '../components/ui.jsx';
import { formatDate } from '../lib/dates.js';

const PAGE = 50;

export default function Log() {
  const { interactions, people, deleteInteraction } = useData();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [response, setResponse] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const types = useMemo(() => [...new Set(interactions.map((i) => i.type).filter(Boolean))].sort(), [interactions]);

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    return interactions
      .filter((i) => {
        const p = personById.get(i.personId);
        const hay = `${p?.name} ${p?.company} ${i.topic} ${i.nextSteps}`.toLowerCase();
        return (!needle || hay.includes(needle))
          && (!type || i.type === type)
          && (response === 'all' || i.response === response);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [interactions, personById, q, type, response]);

  return (
    <>
      <PageHeader title="Activity Log" subtitle={`${rows.length} interactions`}>
        <Link to="/add" className="btn btn-primary">+ Log interaction</Link>
      </PageHeader>

      <div className="filters">
        <input type="search" placeholder="Search people, topics, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All channels</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={response} onChange={(e) => setResponse(e.target.value)}>
          <option value="all">Any response</option>
          <option value="Yes">Replied</option>
          <option value="No">No reply</option>
          <option value="">Pending</option>
        </select>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Person</th><th>Channel</th><th>Topic</th><th>Response</th><th>Notes / next steps</th><th /></tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((i) => {
              const p = personById.get(i.personId);
              return (
                <tr key={i.id}>
                  <td className="nowrap">{formatDate(i.date)}</td>
                  <td>
                    <Link to={`/people/${i.personId}`}>{p?.name}</Link>
                    <div className="muted small">{p?.company}</div>
                  </td>
                  <td>{i.type}</td>
                  <td>{i.topic}</td>
                  <td><ResponsePill response={i.response} /></td>
                  <td className="notes-cell">{i.nextSteps}</td>
                  <td className="nowrap row-actions">
                    <Link to={`/log/${i.id}/edit`} className="link-sm">Edit</Link>
                    <ConfirmButton onConfirm={() => deleteInteraction(i.id)}>Delete</ConfirmButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="table-foot">
            <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>Show more ({rows.length - limit} left)</button>
          </div>
        )}
      </div>
    </>
  );
}
