// Small date helpers. All dates in the app are stored as "YYYY-MM-DD" strings
// and turned into local-midnight Date objects only when we need to do math.

export const DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const todayISO = () => toISO(today());

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(a, b) {
  return Math.round((b - a) / DAY);
}

export function formatDate(s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const d = typeof s === 'string' ? parseISO(s) : s;
  return d ? d.toLocaleDateString(undefined, opts) : '—';
}

export function relativeDays(n) {
  if (n === null || n === undefined) return 'never';
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  if (n < 0) return `in ${-n} days`;
  if (n < 60) return `${n} days ago`;
  const months = Math.round(n / 30);
  return `${months} months ago`;
}

const MONTHS = {
  January: 0, Jan: 0, February: 1, Feb: 1, March: 2, Mar: 2, April: 3, Apr: 3, May: 4,
  June: 5, Jun: 5, July: 6, Jul: 6, August: 7, Aug: 7, September: 8, Sept: 8, Sep: 8,
  October: 9, Oct: 9, November: 10, Nov: 10, December: 11, Dec: 11,
};
const MONTH_RE = new RegExp(`\\b(early|mid|late|end of)?\\s*\\b(${Object.keys(MONTHS).join('|')})\\b`, 'i');
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Finds a planned date inside free-text notes like
 * "Follow up 12/2 about lunch", "Talking 1/8/26", "Reach back out in Oct",
 * "Follow up post Labor Day", "Reach back out in a week", "Speaking Thursday".
 * `from` is the date the note was written; dates without a year are assumed
 * to be the next occurrence after it.
 */
export function extractPlannedDate(text, fromISO) {
  if (!text) return null;
  const from = parseISO(fromISO);
  if (!from) return null;
  const nextOccurrence = (month, day) => {
    let d = new Date(from.getFullYear(), month, day);
    if (d < addDays(from, -7)) d = new Date(from.getFullYear() + 1, month, day);
    return d;
  };

  // 1) Numeric dates: 12/2, 8/20, 1/8/26
  const num = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) {
    const m = Number(num[1]) - 1;
    const d = Number(num[2]);
    if (m >= 0 && m < 12 && d >= 1 && d <= 31) {
      if (num[3]) {
        const y = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]);
        return new Date(y, m, d);
      }
      return nextOccurrence(m, d);
    }
  }

  // 2) Holidays people commonly write
  if (/labor day/i.test(text)) {
    const sept1 = nextOccurrence(8, 1);
    return addDays(sept1, (1 - sept1.getDay() + 7) % 7); // first Monday of Sept
  }
  if (/4th (of )?july|july 4/i.test(text)) return nextOccurrence(6, 5);
  if (/super ?bowl|post sb\b/i.test(text)) return nextOccurrence(1, 15);

  // 3) Relative phrases
  if (/\b(in a|next|a) week\b/i.test(text)) return addDays(from, 7);
  if (/\b(in (two|2) weeks)\b/i.test(text)) return addDays(from, 14);

  // 4) Month names: "in Oct", "late July", "April/May" (capitalised to avoid the verb "may")
  const mm = text.match(MONTH_RE);
  if (mm && /^[A-Z]/.test(mm[2])) {
    const q = (mm[1] || '').toLowerCase();
    const day = q === 'mid' ? 15 : q === 'late' || q === 'end of' ? 22 : 1;
    return nextOccurrence(MONTHS[mm[2][0].toUpperCase() + mm[2].slice(1).toLowerCase()] ?? MONTHS[mm[2]], day);
  }

  // 5) Bare weekdays: "Speaking Thursday", "Talking Thurs"
  const wd = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i);
  if (wd && /day|thurs|tues|wed/i.test(wd[0])) {
    const target = WEEKDAYS.indexOf(wd[1].toLowerCase());
    const diff = (target - from.getDay() + 7) % 7 || 7;
    return addDays(from, diff);
  }
  return null;
}
