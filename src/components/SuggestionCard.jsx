import { Link } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { addDays, toISO, today, relativeDays, formatDate } from '../lib/dates.js';
import { Avatar, TierBadge } from './ui.jsx';

const KIND_LABEL = {
  planned: 'Planned', upcoming: 'Upcoming', nurture: 'New', nudge: 'Nudge',
  due: 'Check-in', rekindle: 'Rekindle', first: 'First touch', cooling: 'Pause',
};

export default function SuggestionCard({ s, compact = false }) {
  const { snooze, unsnooze } = useData();
  const { person, last, daysSince } = s.profile;
  const snoozeFor = (days) => snooze(person.id, toISO(addDays(today(), days)));

  return (
    <article className={`suggestion kind-${s.kind} ${s.snoozedUntil ? 'is-snoozed' : ''}`}>
      <div className="sugg-top">
        <Avatar name={person.name} />
        <div className="sugg-who">
          <Link to={`/people/${person.id}`} className="sugg-name">{person.name}</Link>
          <div className="muted small">{[person.role, person.company].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        <span className={`kind-tag kind-tag-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
      </div>

      <div className="sugg-title">{s.title}</div>
      {!compact && <p className="sugg-detail">{s.detail}</p>}

      {!compact && (
        <div className="chips">
          <TierBadge tier={s.profile.tier} />
          {s.reasons.slice(1).map((r) => <span key={r} className="chip">{r}</span>)}
        </div>
      )}

      {!compact && last && (
        <div className="sugg-last small muted">
          Last: {last.topic && <><strong>{last.topic}</strong> · </>}{last.type} · {relativeDays(daysSince)}
        </div>
      )}

      <div className="sugg-actions">
        <Link className="btn btn-primary btn-sm" to={`/add?person=${person.id}`}>Log outreach</Link>
        {s.snoozedUntil ? (
          <button className="btn btn-ghost btn-sm" onClick={() => unsnooze(person.id)}>
            Snoozed until {formatDate(s.snoozedUntil, { month: 'short', day: 'numeric' })} · Undo
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => snoozeFor(14)}>Snooze 2 wks</button>
            {!compact && <button className="btn btn-ghost btn-sm" onClick={() => snoozeFor(90)}>Not now (90d)</button>}
          </>
        )}
      </div>
    </article>
  );
}
