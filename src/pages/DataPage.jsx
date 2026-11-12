// Import / export so your data is never trapped in one place.
import { useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { PageHeader, Card, ConfirmButton } from '../components/ui.jsx';
import { todayISO } from '../lib/dates.js';

/** Save a file: through the claude.ai downloads capability when published, a plain link locally. */
async function saveFile(filename, text) {
  const downloads = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
  if (downloads) {
    await downloads.save({ filename, data: text });
    return;
  }
  const url = URL.createObjectURL(new Blob([text]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
const usDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
};

export default function DataPage() {
  const { people, interactions, replaceAll, resetToSeed, backend, userEmail, signOut } = useData();
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(null); // { data, source } awaiting confirmation
  const [progress, setProgress] = useState(null);
  const jsonRef = useRef(null);
  const xlsxRef = useRef(null);

  async function exportFile(filename, text) {
    try {
      await saveFile(filename, text);
    } catch (e) {
      if (e?.code !== 'declined') setMsg({ ok: false, text: `Couldn’t save ${filename} (${e?.code || 'error'}).` });
    }
  }

  const exportJSON = () =>
    exportFile(`networking-backup-${todayISO()}.json`, JSON.stringify({ people, interactions }, null, 2));

  // Same columns as your Google Sheet's Tracker tab, so you can paste it back in.
  function exportTrackerCSV() {
    const byId = new Map(people.map((p) => [p.id, p]));
    const header = ['Name', 'Company', 'Role', 'Industry', 'How We Met', 'Date Connected', 'Date', 'Message Type', 'Message Sent', 'Response', 'Next Steps', 'Follow Up'];
    const rows = [...interactions].sort((a, b) => a.date.localeCompare(b.date)).map((i) => {
      const p = byId.get(i.personId) || {};
      return [p.name, p.company, p.role, p.industry, p.howWeMet, usDate(p.dateConnected), usDate(i.date), i.type, i.topic, i.response, i.nextSteps, usDate(i.followUp)];
    });
    exportFile(`networking-tracker-${todayISO()}.csv`, toCSV([header, ...rows]));
  }

  function exportPeopleCSV() {
    const header = ['Name', 'Company', 'Role', 'Industry', 'How We Met', 'Date Connected', 'Former Role', 'Notes'];
    const rows = people.map((p) => [p.name, p.company, p.role, p.industry, p.howWeMet, usDate(p.dateConnected), p.formerRole, p.notes]);
    exportFile(`networking-people-${todayISO()}.csv`, toCSV([header, ...rows]));
  }

  async function readJSON(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.people) || !Array.isArray(data.interactions)) throw new Error('this isn’t a Network Tracker backup file');
      setPending({ data, source: file.name });
    } catch (e) {
      setMsg({ ok: false, text: `Couldn’t read ${file.name}: ${e.message}.` });
    }
  }

  async function readXLSX(file) {
    try {
      // Loaded on demand so the spreadsheet library doesn't slow down normal page loads
      const XLSX = await import('xlsx');
      const { parseWorkbook } = await import('../lib/parseWorkbook.js');
      const data = parseWorkbook(XLSX, XLSX.read(await file.arrayBuffer(), { cellDates: true }));
      if (!data.interactions.length) throw new Error('no rows found in a “Tracker” tab');
      setPending({ data, source: file.name });
    } catch (e) {
      setMsg({ ok: false, text: `Couldn’t read ${file.name}: ${e.message}.` });
    }
  }

  async function applyImport() {
    const { data, source } = pending;
    setPending(null);
    setProgress(0);
    try {
      await replaceAll(data, setProgress);
      setMsg({ ok: true, text: `Imported ${data.people.length} people and ${data.interactions.length} interactions from ${source}.` });
    } catch {
      setMsg({ ok: false, text: 'The import stopped partway. Try importing the same file again to finish it.' });
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Import / Export"
        subtitle={backend === 'db' || backend === 'supabase'
          ? 'Your data is saved online and syncs across your devices.'
          : 'Your data is saved in this browser. Export a backup regularly.'}
      />
      {msg && <div className={`toast ${msg.ok ? '' : 'toast-error'}`}>{msg.ok ? '✓ ' : ''}{msg.text}</div>}

      {pending && (
        <div className="card confirm-card">
          <strong>Replace everything with {pending.source}?</strong>
          <p className="muted small">
            The tracker currently has {people.length} people and {interactions.length} interactions. They’ll be replaced with{' '}
            {pending.data.people.length} people and {pending.data.interactions.length} interactions. Snoozes are cleared.
          </p>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={applyImport}>Replace data</button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}

      {progress !== null && (
        <div className="card">
          <strong>Importing… {Math.round(progress * 100)}%</strong>
          <div className="progress"><span style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}

      <div className="grid-2">
        <Card title="Export" subtitle="Download your data">
          <div className="button-col">
            <button className="btn btn-primary" onClick={exportJSON}>Download full backup (.json)</button>
            <button className="btn btn-ghost" onClick={exportTrackerCSV}>Tracker as CSV (Google Sheets columns)</button>
            <button className="btn btn-ghost" onClick={exportPeopleCSV}>People list as CSV</button>
          </div>
        </Card>

        <Card title="Import" subtitle="Replaces what’s currently in the tracker">
          <div className="button-col">
            <button className="btn btn-ghost" onClick={() => xlsxRef.current.click()} disabled={progress !== null}>Import from spreadsheet (.xlsx)</button>
            <p className="muted small">In Google Sheets: File → Download → Microsoft Excel (.xlsx). It needs a “Tracker” tab and a “People List” tab.</p>
            <button className="btn btn-ghost" onClick={() => jsonRef.current.click()} disabled={progress !== null}>Restore backup (.json)</button>
            <input id="import-xlsx" ref={xlsxRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readXLSX(f); }} />
            <input id="import-json" ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) readJSON(f); }} />
          </div>
        </Card>
      </div>

      {userEmail && (
        <Card title="Account">
          <p className="muted small">Signed in as <strong>{userEmail}</strong>. Only this account can see your data.</p>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </Card>
      )}

      {import.meta.env.DEV && backend === 'local' && (
        <Card title="Reset">
          <p className="muted small">Go back to the data originally imported from your Google Sheet. Anything added in the app is lost.</p>
          <ConfirmButton
            className="btn btn-danger btn-sm"
            prompt="Reset all data?"
            confirmLabel="Yes, reset"
            onConfirm={() => resetToSeed().then(() => setMsg({ ok: true, text: 'Reset to original data.' }))}
          >
            Reset to original data
          </ConfirmButton>
        </Card>
      )}
    </>
  );
}
