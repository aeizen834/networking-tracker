import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useProfile } from '../lib/DataContext.jsx';
import { Avatar, Card, HealthBadge, ResponsePill, TierBadge, Empty, ConfirmButton } from '../components/ui.jsx';
import PersonForm from '../components/PersonForm.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';
import { formatDate, relativeDays } from '../lib/dates.js';
import { LIVE_TYPES } from '../lib/insights.js';

export default function PersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const profile = useProfile(id);
  const { people, suggestions, updatePerson, deletePerson, deleteInteraction } = useData();
  const [editing, setEditing] = useState(false);

  if (!profile) return <Empty>Person not found. <Link to="/people">Back to People</Link></Empty>;
  const { person, interactions } = profile;
  const suggestion = suggestions.find((s) => s.profile.person.id === id);
  const introducer = people.find((p) => p.name === person.howWeMet);

  return (
    <>
      <Link to="/people" className="back-link">← People</Link>
      <header className="person-header">
        <Avatar name={person.name} />
        <div>
          <h1>{person.name}</h1>
          <p className="muted">{[person.role, person.company].filter(Boolean).join(' · ')}</p>
          <div className="chips">
            <TierBadge tier={profile.tier} />
            <HealthBadge health={profile.health} />
            {person.industry && <span className="chip">{person.industry}</span>}
          </div>
        </div>
        <div className="page-actions">
          <Link to={`/add?person=${id}`} className="btn btn-primary">+ Log interaction</Link>
          <button className="btn btn-ghost" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
        </div>
      </header>

      {editing && (
        <Card title="Edit person">
          <PersonForm
            initial={person}
            onSubmit={(values) => {
              updatePerson(id, values);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
          <hr />
          <ConfirmButton
            className="btn btn-danger btn-sm"
            prompt={`Delete ${person.name} and their ${interactions.length} interactions?`}
            confirmLabel="Yes, delete"
            onConfirm={() => {
              deletePerson(id);
              navigate('/people');
            }}
          >
            Delete person
          </ConfirmButton>
        </Card>
      )}

      <div className="stats-grid">
        <div className="stat card"><div className="stat-label">Last contact</div><div className="stat-value">{relativeDays(profile.daysSince)}</div><div className="stat-sub">{profile.last ? formatDate(profile.last.date) : '—'}</div></div>
        <div className="stat card"><div className="stat-label">Interactions</div><div className="stat-value">{profile.count}</div><div className="stat-sub">{profile.liveCount} live conversations</div></div>
        <div className="stat card"><div className="stat-label">Reply rate</div><div className="stat-value">{profile.replyRate === null ? '—' : `${Math.round(profile.replyRate * 100)}%`}</div><div className="stat-sub">{profile.replies} of {profile.answered} recorded</div></div>
        <div className="stat card"><div className="stat-label">Suggested rhythm</div><div className="stat-value">~{profile.cadence}d</div><div className="stat-sub">{profile.dueDate ? `Next check-in ${formatDate(profile.dueDate, { month: 'short', day: 'numeric' })}` : 'Reach out anytime'}</div></div>
      </div>

      <div className="grid-2-1">
        <Card title="Timeline" subtitle="Newest first">
          {interactions.length ? (
            <ol className="timeline">
              {[...interactions].reverse().map((i) => (
                <li key={i.id} className={LIVE_TYPES.has(i.type) ? 'is-live' : ''}>
                  <div className="tl-dot" aria-hidden />
                  <div className="tl-body">
                    <div className="tl-head">
                      <strong>{i.topic || i.type}</strong>
                      <ResponsePill response={i.response} />
                    </div>
                    <div className="muted small">{formatDate(i.date)} · {i.type}{i.followUp ? ` · follow up ${formatDate(i.followUp, { month: 'short', day: 'numeric' })}` : ''}</div>
                    {i.nextSteps && <p className="tl-notes">{i.nextSteps}</p>}
                    <div className="tl-actions">
                      <Link to={`/log/${i.id}/edit`} className="link-sm">Edit</Link>
                      <ConfirmButton onConfirm={() => deleteInteraction(i.id)}>Delete</ConfirmButton>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No interactions yet.</Empty>
          )}
        </Card>

        <div className="stack">
          {suggestion && (
            <div>
              <h2 className="side-title">Suggested next step</h2>
              <SuggestionCard s={suggestion} />
            </div>
          )}
          <Card title="Details">
            <dl className="details">
              <dt>How we met</dt>
              <dd>{introducer ? <Link to={`/people/${introducer.id}`}>{person.howWeMet}</Link> : person.howWeMet || '—'}</dd>
              <dt>Connected</dt><dd>{person.dateConnected ? formatDate(person.dateConnected) : '—'}</dd>
              {person.formerRole && (<><dt>Former role</dt><dd>{person.formerRole}</dd></>)}
              {profile.bestChannel && (<><dt>Best channel</dt><dd>{profile.bestChannel}</dd></>)}
              {person.notes && (<><dt>Notes</dt><dd className="pre">{person.notes}</dd></>)}
            </dl>
          </Card>
          {profile.introsMade.length > 0 && (
            <Card title={`Introduced you to ${profile.introsMade.length}`}>
              <ul className="plain-list">
                {profile.introsMade.map((p) => (
                  <li key={p.id}><Link to={`/people/${p.id}`}>{p.name}</Link> <span className="muted small">{p.company}</span></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
