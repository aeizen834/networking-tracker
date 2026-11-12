// Regenerates src/data/seed.json from your spreadsheet.
// Usage: node scripts/import-xlsx.mjs "path/to/Networking Tracker.xlsx"
import fs from 'node:fs';
import XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/parseWorkbook.js';

const [, , input, output = 'src/data/seed.json'] = process.argv;
const buf = input.endsWith('.xlsx')
  ? fs.readFileSync(input)
  : Buffer.from(JSON.parse(fs.readFileSync(input, 'utf8')).content, 'base64'); // Drive download JSON

const data = parseWorkbook(XLSX, XLSX.read(buf, { cellDates: true }));

// Optional, git-ignored list of people whose Company and Role columns are swapped in the sheet:
// src/data/swapped.json -> ["Full Name", ...]
const SWAPPED = fs.existsSync('src/data/swapped.json') ? JSON.parse(fs.readFileSync('src/data/swapped.json', 'utf8')) : [];
for (const p of data.people) {
  if (SWAPPED.includes(p.name)) [p.company, p.role] = [p.role, p.company];
}

fs.writeFileSync(output, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.people.length} people, ${data.interactions.length} interactions -> ${output}`);
