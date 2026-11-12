// Small presentational building blocks reused across pages.
import { useState } from 'react';
import { Link } from 'react-router-dom';

/** A button that asks "Sure?" in place before running a destructive action
 * (browser confirm() pop-ups are blocked inside claude.ai artifacts). */
export function ConfirmButton({ children, onConfirm, confirmLabel = 'Delete', prompt = 'Sure?', className = 'link-sm' }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className={className} onClick={() => setAsking(true)}>{children}</button>;
  }
  return (
    <span className="confirm-inline" role="group">
      <span>{prompt}</span>
      <button type="button" className="link-sm link-danger" onClick={() => { setAsking(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="link-sm" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, to }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  return to ? <Link to={to} className="stat card">{body}</Link> : <div className="stat card">{body}</div>;
}

const TIER_ICON = { Strong: '●●●', Warm: '●●○', Light: '●○○' };
export function TierBadge({ tier }) {
  return (
    <span className={`badge tier-${tier.toLowerCase()}`} title={`${tier} relationship`}>
      <span aria-hidden>{TIER_ICON[tier]}</span> {tier}
    </span>
  );
}

const HEALTH_ICON = { Active: '✓', Due: '◷', Cold: '❄', Never: '–' };
export function HealthBadge({ health }) {
  return (
    <span className={`badge health-${health.toLowerCase()}`}>
      <span aria-hidden>{HEALTH_ICON[health]}</span> {health}
    </span>
  );
}

export function ResponsePill({ response }) {
  if (response === 'Yes') return <span className="pill pill-yes">✓ Replied</span>;
  if (response === 'No') return <span className="pill pill-no">✕ No reply</span>;
  return <span className="pill pill-none">… Pending</span>;
}

export function Empty({ children }) {
  return <div className="empty muted">{children}</div>;
}

export function initials(name) {
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

export function Avatar({ name }) {
  return <span className="avatar" aria-hidden>{initials(name)}</span>;
}
