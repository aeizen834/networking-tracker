import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { SUGGESTION_GROUPS } from '../lib/insights.js';
import { PageHeader, Empty } from '../components/ui.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';

export default function ReachOut() {
  const { suggestions } = useData();
  const [view, setView] = useState('priority'); // 'priority' | 'grouped'
  const [showSnoozed, setShowSnoozed] = useState(false);

  const active = suggestions.filter((s) => !s.snoozedUntil);
  const snoozed = suggestions.filter((s) => s.snoozedUntil);
  const thisWeek = active.filter((s) => s.priority >= 60);
  const later = active.filter((s) => s.priority < 60);

  return (
    <>
      <PageHeader
        title="Reach Out"
        subtitle="Suggestions come from your notes, how often you usually talk to each person, who replies, and who introduces you to others."
      >
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={view === 'priority'} onClick={() => setView('priority')}>By priority</button>
          <button role="tab" aria-selected={view === 'grouped'} onClick={() => setView('grouped')}>By reason</button>
        </div>
      </PageHeader>

      <details className="how-it-works card">
        <summary>How suggestions are ranked</summary>
        <ul>
          <li><strong>Planned follow-ups:</strong> dates in your Next Steps (“Follow up 12/2”, “Reach back out in Oct”, “post Labor Day”) that have passed with nothing logged since.</li>
          <li><strong>Upcoming:</strong> calls or lunches noted for the next two weeks, so you can prep.</li>
          <li><strong>New connections:</strong> met in the last 45 days. Follow up while it’s fresh.</li>
          <li><strong>Nudges:</strong> your last message got no reply 10–60 days ago.</li>
          <li><strong>Check-ins:</strong> it’s been longer than your usual rhythm with this person (45 days for strong relationships, 60 for warm, 90 for light, adjusted by your real history together).</li>
          <li>Strong relationships, people who usually reply, and people who’ve introduced you to others rank higher. After 3 unanswered messages in a row, a contact moves to “Give it space”.</li>
          <li>Logging an interaction or snoozing removes the person from the list.</li>
        </ul>
      </details>

      {view === 'priority' ? (
        <>
          <h2 className="section-title">Do this week <span className="count">{thisWeek.length}</span></h2>
          {thisWeek.length ? (
            <div className="sugg-grid">{thisWeek.map((s) => <SuggestionCard key={s.profile.person.id} s={s} />)}</div>
          ) : (
            <Empty>You’re all caught up. 🎉</Empty>
          )}
          <h2 className="section-title">When you have time <span className="count">{later.length}</span></h2>
          <div className="sugg-grid">{later.map((s) => <SuggestionCard key={s.profile.person.id} s={s} />)}</div>
        </>
      ) : (
        SUGGESTION_GROUPS.map((g) => {
          const items = active.filter((s) => s.kind === g.kind);
          if (!items.length) return null;
          return (
            <section key={g.kind}>
              <h2 className="section-title">{g.label} <span className="count">{items.length}</span></h2>
              <p className="muted small section-blurb">{g.blurb}</p>
              <div className="sugg-grid">{items.map((s) => <SuggestionCard key={s.profile.person.id} s={s} />)}</div>
            </section>
          );
        })
      )}

      {snoozed.length > 0 && (
        <>
          <button className="btn btn-ghost section-toggle" onClick={() => setShowSnoozed((v) => !v)}>
            {showSnoozed ? '▾' : '▸'} Snoozed ({snoozed.length})
          </button>
          {showSnoozed && <div className="sugg-grid">{snoozed.map((s) => <SuggestionCard key={s.profile.person.id} s={s} />)}</div>}
        </>
      )}
    </>
  );
}
