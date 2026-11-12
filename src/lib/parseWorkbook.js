// Turns your "Networking Tracker" spreadsheet (Tracker + People List tabs)
// into the app's data shape: { people: [...], interactions: [...] }.
// Shared by the in-browser "Import .xlsx" button and scripts/import-xlsx.mjs.

const clean = (v) => {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v.getFullYear() < 1901 ? '' : toISODate(v);
  const s = String(v).trim();
  return s === '0' || s === '#N/A' ? '' : s;
};

function toISODate(d) {
  // Spreadsheet dates come in as UTC midnight; read the UTC parts so the day never shifts.
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const toISO = (v) => {
  const c = clean(v);
  if (!c || /^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
  const m = c.match(/^(\d{1,2})\/(\d{1,2})\/+(\d{2,4})$/);
  if (!m) return '';
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};

export function parseWorkbook(XLSX, wb) {
  const rows = (pattern) => {
    const name = wb.SheetNames.find((n) => pattern.test(n));
    return name ? XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }) : [];
  };
  const trackerRows = rows(/track/i).filter((r) => clean(r['Name']));
  const peopleRows = rows(/people/i).filter((r) => clean(r['Name']));

  const people = [];
  const byName = new Map();
  const addPerson = (r) => {
    const name = clean(r['Name']);
    if (byName.has(name)) return byName.get(name);
    const p = {
      id: `p${people.length + 1}`,
      name,
      company: clean(r['Company']),
      role: clean(r['Role']),
      industry: clean(r['Industry']),
      howWeMet: clean(r['How We Met']),
      dateConnected: toISO(r['Date Connected']),
      formerRole: clean(r['Former Role']),
      notes: '',
    };
    people.push(p);
    byName.set(name, p);
    return p;
  };

  peopleRows.forEach(addPerson);
  // Anyone in the tracker but missing from People List gets added from their tracker row.
  trackerRows.forEach(addPerson);

  const interactions = trackerRows.map((r, i) => ({
    id: `i${i + 1}`,
    personId: byName.get(clean(r['Name'])).id,
    date: toISO(r['Date']),
    type: clean(r['Message Type']),
    topic: clean(r['Message Sent']),
    response: clean(r['Response']),
    nextSteps: clean(r['Next Steps']),
    followUp: '',
  }));

  return { people, interactions };
}
