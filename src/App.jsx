import { NavLink, Route, Routes, Link } from 'react-router-dom';
import { useData } from './lib/DataContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ReachOut from './pages/ReachOut.jsx';
import People from './pages/People.jsx';
import PersonDetail from './pages/PersonDetail.jsx';
import Log from './pages/Log.jsx';
import AddInteraction from './pages/AddInteraction.jsx';
import Network from './pages/Network.jsx';
import DataPage from './pages/DataPage.jsx';
import SignIn from './pages/SignIn.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧', end: true },
  { to: '/reach-out', label: 'Reach Out', icon: '➚', badge: true },
  { to: '/people', label: 'People', icon: '◉' },
  { to: '/log', label: 'Activity Log', icon: '☰' },
  { to: '/network', label: 'Intro Map', icon: '⋔' },
  { to: '/data', label: 'Import / Export', icon: '⇅' },
];

export default function App() {
  const { suggestions, status, people, writeError, clearWriteError, userEmail, signOut } = useData();
  const actionable = suggestions.filter((s) => !s.snoozedUntil && s.priority >= 60).length;

  if (status === 'signedOut') return <SignIn />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">N</span>
          <span>Network<br /><small>Tracker</small></span>
        </Link>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <span className="nav-icon" aria-hidden>{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {n.badge && actionable > 0 && <span className="nav-badge">{actionable}</span>}
            </NavLink>
          ))}
        </nav>
        <Link to="/add" className="btn btn-primary add-btn">+ Log interaction</Link>
        {userEmail && (
          <div className="account small muted">
            <span className="account-email" title={userEmail}>{userEmail}</span>
            <button className="link-sm" onClick={signOut}>Sign out</button>
          </div>
        )}
      </aside>

      <main className="content">
        {writeError && (
          <div className="toast toast-error" role="alert">
            {writeError} <button className="link-sm" onClick={clearWriteError}>Dismiss</button>
          </div>
        )}
        {status === 'loading' || status === 'slow' ? (
          <div className="empty muted">
            {status === 'slow' ? 'Still connecting to your saved data… Check your connection.' : 'Loading your network…'}
          </div>
        ) : status === 'error' ? null : (
        <>
        {people.length === 0 && (
          <div className="card onboarding">
            <h2>Your tracker is empty</h2>
            <p className="muted">Import your Google Sheet (File → Download → .xlsx), or log your first interaction to start.</p>
            <div className="form-actions">
              <Link to="/data" className="btn btn-primary">Import spreadsheet</Link>
              <Link to="/add" className="btn btn-ghost">Log an interaction</Link>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reach-out" element={<ReachOut />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/:id" element={<PersonDetail />} />
          <Route path="/log" element={<Log />} />
          <Route path="/add" element={<AddInteraction />} />
          <Route path="/log/:id/edit" element={<AddInteraction />} />
          <Route path="/network" element={<Network />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
        </>
        )}
      </main>
    </div>
  );
}
