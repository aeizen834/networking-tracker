// One segmented bar showing how many relationships are Active / Due / Cold.
const ORDER = [
  { key: 'Active', note: 'within your usual rhythm' },
  { key: 'Due', note: 'overdue, but less than 2× your rhythm' },
  { key: 'Cold', note: 'more than 2× overdue' },
  { key: 'Never', note: 'no interactions logged' },
];

export default function HealthBar({ profiles }) {
  const counts = Object.fromEntries(ORDER.map((o) => [o.key, 0]));
  profiles.forEach((p) => counts[p.health]++);
  const total = profiles.length || 1;
  return (
    <div>
      <div className="healthbar" role="img" aria-label={ORDER.map((o) => `${o.key} ${counts[o.key]}`).join(', ')}>
        {ORDER.filter((o) => counts[o.key]).map((o) => (
          <span
            key={o.key}
            className={`hb-seg hb-${o.key.toLowerCase()}`}
            style={{ flexGrow: counts[o.key] }}
            title={`${o.key}: ${counts[o.key]} (${o.note})`}
          >
            {counts[o.key] / total > 0.08 && counts[o.key]}
          </span>
        ))}
      </div>
      <ul className="hb-legend">
        {ORDER.map((o) => (
          <li key={o.key}>
            <span className={`swatch hb-${o.key.toLowerCase()}`} />
            <strong>{o.key}</strong> {counts[o.key]} <span className="muted small">· {o.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
