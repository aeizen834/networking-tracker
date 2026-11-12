import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { PageHeader, TierBadge, HealthBadge, Avatar } from '../components/ui.jsx';
import { formatDate, relativeDays } from '../lib/dates.js';
import PersonForm from '../components/PersonForm.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name', get: (p) => p.person.name },
  { key: 'company', label: 'Company', get: (p) => p.person.company },
  { key: 'industry', label: 'Industry', get: (p) => p.person.industry },
  { key: 'howWeMet', label: 'Met via', get: (p) => p.person.howWeMet },
  { key: 'count', label: 'Touches', get: (p) => p.count, numeric: true },
  { key: 'replyRate', label: 'Reply rate', get: (p) => p.replyRate ?? -1, numeric: true },
  { key: 'strength', label: 'Strength', get: (p) => p.strength, numeric: true },
  { key: 'daysSince', label: 'Last contact', get: (p) => p.daysSince ?? 99999, numeric: true },
];

export default function People() {
  const { profiles, addPerson } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('');
  const [health, setHealth] = useState('');
  const [sort, setSort] = useState({ key: 'daysSince', dir: 1 });
  const [adding, setAdding] = useState(false);

  const industries = useMemo(
    () => [...new Set(profiles.map((p) => p.person.industry?.trim()).filter(Boolean))].sort(),
    [profiles]
  );

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    const col = COLUMNS.find((c) => c.key === sort.key);
    return profiles
      .filter((p) => {
        const { name, company, role, howWeMet } = p.person;
        const hay = `${name} ${company} ${role} ${howWeMet}`.toLowerCase();
        return (!needle || hay.includes(needle))
          && (!industry || p.person.industry?.trim() === industry)
          && (!health || p.health === health);
      })
      .sort((a, b) => {
        const av = col.get(a), bv = col.get(b);
        const cmp = col.numeric ? av - bv : String(av || '').localeCompare(String(bv || ''));
        return cmp * sort.dir;
      });
  }, [profiles, q, industry, health, sort]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  return (
    <>
      <PageHeader title="People" subtitle={`${rows.length} of ${profiles.length} contacts`}>
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add person'}</button>
      </PageHeader>

      {adding && (
        <div className="card">
          <h2>New person</h2>
          <PersonForm
            onSubmit={(values) => {
              const p = addPerson(values);
              setAdding(false);
              navigate(`/people/${p.id}`);
            }}
            submitLabel="Add person"
          />
        </div>
      )}

      <div className="filters">
        <input type="search" placeholder="Search name, company, role…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">All industries</option>
          {industries.map((i) => <option key={i}>{i}</option>)}
        </select>
        <select value={health} onChange={(e) => setHealth(e.target.value)}>
          <option value="">Any status</option>
          <option>Active</option><option>Due</option><option>Cold</option><option>Never</option>
        </select>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.numeric ? 'num' : ''}>
                  <button className="th-sort" onClick={() => toggleSort(c.key)}>
                    {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.person.id} onClick={() => navigate(`/people/${p.person.id}`)} className="row-link">
                <td>
                  <div className="cell-person">
                    <Avatar name={p.person.name} />
                    <div>
                      <Link to={`/people/${p.person.id}`} onClick={(e) => e.stopPropagation()}>{p.person.name}</Link>
                      <div className="muted small">{p.person.role}</div>
                    </div>
                  </div>
                </td>
                <td>{p.person.company}</td>
                <td>{p.person.industry}</td>
                <td>{p.person.howWeMet}</td>
                <td className="num">{p.count}</td>
                <td className="num">{p.replyRate === null ? '—' : `${Math.round(p.replyRate * 100)}%`}</td>
                <td className="num"><TierBadge tier={p.tier} /></td>
                <td className="num" title={p.last ? formatDate(p.last.date) : ''}>{relativeDays(p.daysSince)}</td>
                <td><HealthBadge health={p.health} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
