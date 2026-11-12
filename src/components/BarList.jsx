// Horizontal bar list in plain HTML/CSS. Accessible, and it handles long labels well.
import { useState } from 'react';

export default function BarList({ items, format = (v) => v, max, limit = 8, onSelect, unit = '' }) {
  const [hover, setHover] = useState(null);
  const shown = items.slice(0, limit);
  const top = max ?? Math.max(1, ...shown.map((i) => i.value));
  return (
    <ul className="barlist">
      {shown.map((it) => (
        <li
          key={it.label}
          className={`${hover === it.label ? 'is-hover' : ''} ${onSelect ? 'is-clickable' : ''}`}
          onMouseEnter={() => setHover(it.label)}
          onMouseLeave={() => setHover(null)}
          onClick={onSelect ? () => onSelect(it) : undefined}
          title={`${it.label}: ${format(it.value)}${unit}${it.note ? ` · ${it.note}` : ''}`}
        >
          <span className="barlist-label">{it.label}</span>
          <span className="barlist-track">
            <span className="barlist-fill" style={{ width: `${(it.value / top) * 100}%` }} />
          </span>
          <span className="barlist-value">
            {format(it.value)}{unit}
            {it.note && <span className="muted small"> {it.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
