// GitHub-style calendar of how many touches you logged each day (last 26 weeks).
import { useMemo, useState } from 'react';
import { addDays, toISO, today, formatDate } from '../lib/dates.js';

const WEEKS = 26;
const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
const plural = (n) => `${n} interaction${n === 1 ? '' : 's'}`;

export default function Heatmap({ interactions }) {
  const [hover, setHover] = useState(null);

  const { weeks, total } = useMemo(() => {
    const counts = new Map();
    for (const i of interactions) counts.set(i.date, (counts.get(i.date) || 0) + 1);
    const end = today();
    const start = addDays(end, -(WEEKS * 7) - end.getDay()); // begin on a Sunday
    const weeks = [];
    let total = 0;
    for (let w = 0; w <= WEEKS; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        if (date > end) {
          days.push(null);
          continue;
        }
        const iso = toISO(date);
        const n = counts.get(iso) || 0;
        total += n;
        days.push({ iso, n });
      }
      weeks.push(days);
    }
    return { weeks, total };
  }, [interactions]);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label={`${total} interactions in the last ${WEEKS} weeks`}>
        {weeks.map((days, w) => (
          <div className="heatmap-col" key={w}>
            {days.map((d, k) =>
              d ? (
                <span
                  key={k}
                  className={`hm-cell hm-${level(d.n)} ${hover?.iso === d.iso ? 'is-hover' : ''}`}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  title={`${formatDate(d.iso)}: ${plural(d.n)}`}
                />
              ) : (
                <span key={k} className="hm-cell hm-empty" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="heatmap-foot small muted">
        <span>
          {hover
            ? `${formatDate(hover.iso, { weekday: 'short', month: 'short', day: 'numeric' })}: ${plural(hover.n)}`
            : `${plural(total)} in the last 6 months`}
        </span>
        <span className="hm-legend">
          Less {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`hm-cell hm-${l}`} />)} More
        </span>
      </div>
    </div>
  );
}
