# Network Tracker

A personal site for tracking networking: see every interaction, log new ones, and get suggestions for who to reach out to next.
Built with **React + Vite**, **React Router** and **Recharts**.

## Run it

```bash
npm install      # first time only
npm run dev      # then open the printed http://localhost:5173 link
```

`npm run build` produces a static site in `dist/` that you can host anywhere (Netlify, Vercel, GitHub Pages).

## Where the data lives

- The first load is seeded from `src/data/seed.json`, which was generated from the "Networking Tracker" Google Sheet.
- Everything you add or edit is saved in **your browser's localStorage**. It stays on this computer and in this browser.
- Use **Import / Export** to download a JSON backup, export CSVs that match your Google Sheet's columns, or re-import an `.xlsx` downloaded from Sheets.

To regenerate the seed file from a fresh spreadsheet download:

```bash
node scripts/import-xlsx.mjs "path/to/Networking Tracker.xlsx"
```

## Project tour

| Path | What it is |
|---|---|
| `src/main.jsx` | App entry: router + data provider |
| `src/App.jsx` | Layout (sidebar) and routes |
| `src/lib/DataContext.jsx` | Global state with Context + `useState`, persisted to localStorage |
| `src/lib/insights.js` | Relationship scoring and "who to reach out to" logic |
| `src/lib/dates.js` | Date helpers, including pulling dates out of notes like "Follow up 12/2" |
| `src/pages/*` | One component per page |
| `src/components/*` | Reusable pieces: charts, cards, forms |

## How "Reach Out" works

For each person the app computes:

- **Strength** (0–100), from replies, live conversations (Zoom, phone, lunch, in person) and intros they've made you
- **Rhythm**: how often you should touch base. The default is 45, 60 or 90 days depending on strength, blended with your actual history together
- **Planned dates**: dates written in Next Steps, e.g. "Talking 11/19", "Reach back out in Oct", "post Labor Day"

Then it suggests one next step per person: an overdue planned follow-up, an upcoming call, nurturing a new connection, nudging an unanswered message, a regular check-in, or rekindling an old relationship. After 3 unanswered messages in a row, a person is moved to "Give it space".
