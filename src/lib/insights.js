// The "brain" of the app: turns raw people + interactions into per-person
// relationship profiles and a ranked list of who to reach out to next.
import { parseISO, today, daysBetween, addDays, toISO, extractPlannedDate } from './dates.js';

// Channels that count as a real conversation (vs. a one-way message).
export const LIVE_TYPES = new Set(['Zoom', 'Phone', 'Lunch', 'In Person', 'Coffee', 'Event']);
export const INTERACTION_TYPES = ['Email', 'LinkedIn', 'Text', 'Phone', 'Zoom', 'Lunch', 'Coffee', 'In Person', 'Event'];

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const TIERS = {
  Strong: { min: 70, cadence: 45 },
  Warm: { min: 40, cadence: 60 },
  Light: { min: 0, cadence: 90 },
};

/** Build one profile per person with everything the UI needs. */
export function buildProfiles(people, interactions, now = today()) {
  const byPerson = new Map(people.map((p) => [p.id, []]));
  for (const i of interactions) byPerson.get(i.personId)?.push(i);

  // Who introduced you to whom ("How We Met" matches another person's name)
  const introsBy = new Map();
  for (const p of people) {
    if (!p.howWeMet) continue;
    const list = introsBy.get(p.howWeMet) || [];
    list.push(p);
    introsBy.set(p.howWeMet, list);
  }

  return people.map((person) => {
    const list = (byPerson.get(person.id) || []).sort((a, b) => a.date.localeCompare(b.date));
    const last = list.at(-1) || null;
    const lastDate = last ? parseISO(last.date) : null;
    const daysSince = lastDate ? daysBetween(lastDate, now) : null;

    const replies = list.filter((i) => i.response === 'Yes').length;
    const answered = list.filter((i) => i.response === 'Yes' || i.response === 'No').length;
    const replyRate = answered ? replies / answered : null;
    // Smoothed reply rate so one lucky reply doesn't look like 100%
    const replyScore = (replies + 1) / (answered + 2);
    const liveCount = list.filter((i) => LIVE_TYPES.has(i.type)).length;
    const introsMade = introsBy.get(person.name) || [];

    // Unanswered streak at the end of the timeline
    let consecutiveNo = 0;
    for (let k = list.length - 1; k >= 0 && list[k].response === 'No'; k--) consecutiveNo++;

    // Gaps between touches (ignore same-week bursts)
    const gaps = [];
    for (let k = 1; k < list.length; k++) {
      const g = daysBetween(parseISO(list[k - 1].date), parseISO(list[k].date));
      if (g >= 5) gaps.push(g);
    }
    const medianGap = gaps.length >= 2 ? median(gaps) : null;

    // Relationship strength: depth of the relationship, 0–100 (diminishing returns)
    const depth = replies * 1 + liveCount * 2 + introsMade.length * 1.5;
    const strength = Math.round(100 * (1 - Math.exp(-depth / 8)));
    const tier = strength >= TIERS.Strong.min ? 'Strong' : strength >= TIERS.Warm.min ? 'Warm' : 'Light';

    // How often you should touch base: blend tier default with your actual rhythm
    const base = TIERS[tier].cadence;
    const cadence = medianGap ? Math.round((base + clamp(medianGap * 1.2, 21, 120)) / 2) : base;

    let health = 'Never';
    if (daysSince !== null) health = daysSince <= cadence ? 'Active' : daysSince <= cadence * 2 ? 'Due' : 'Cold';

    // Planned follow-up: explicit date wins, otherwise parse it out of the latest note
    let planned = null;
    if (last?.followUp) planned = parseISO(last.followUp);
    else if (last) planned = extractPlannedDate(last.nextSteps, last.date);

    // Channel that most often gets a reply from this person
    const channelReplies = {};
    for (const i of list) if (i.response === 'Yes') channelReplies[i.type] = (channelReplies[i.type] || 0) + 1;
    const bestChannel = Object.entries(channelReplies).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      person, interactions: list, last, lastDate, daysSince, count: list.length,
      replies, answered, replyRate, liveCount, introsMade, consecutiveNo, medianGap,
      replyScore, strength, tier, cadence, health, planned, bestChannel,
      dueDate: lastDate ? addDays(lastDate, cadence) : null,
    };
  });
}

/**
 * Turn profiles into suggestions. Each person gets their single most
 * important action, with a priority score and the reasons behind it.
 */
export function buildSuggestions(profiles, now = today()) {
  const out = [];
  for (const pr of profiles) {
    const { person, last, daysSince, replyRate, strength, cadence, planned, consecutiveNo } = pr;
    const candidates = [];

    if (!last) {
      candidates.push({
        kind: 'first', priority: 35,
        title: 'No interactions logged yet',
        detail: person.howWeMet && person.howWeMet !== 'Me'
          ? `Connected via ${person.howWeMet}. Send a first note to get things going.`
          : 'Send a first note to get things going.',
      });
    } else {
      // 1) Something you planned (a date in your notes or an explicit follow-up)
      if (planned) {
        const delta = daysBetween(now, planned); // + = future
        if (delta < 0 && delta >= -60 && planned > pr.lastDate) {
          const late = -delta;
          candidates.push({
            kind: 'planned', priority: 92 - Math.min(late, 30) / 3,
            title: late <= 3 ? 'Planned follow-up is due' : `Planned follow-up ${late} days ago`,
            detail: `Your note: “${last.nextSteps || 'Follow up'}”. Did it happen? Log it, or reach back out.`,
          });
        } else if (delta >= 0 && delta <= 14) {
          candidates.push({
            kind: 'upcoming', priority: 75 - delta,
            title: delta === 0 ? 'On the calendar today' : `Coming up in ${delta} day${delta === 1 ? '' : 's'}`,
            detail: `Your note: “${last.nextSteps}”. Confirm the time and prep a couple of questions.`,
          });
        }
      }

      // 2) Waiting on a reply
      if (last.response !== 'Yes' && daysSince >= 10 && daysSince <= 60 && consecutiveNo < 3) {
        candidates.push({
          kind: 'nudge', priority: 58 + strength * 0.2,
          title: 'No reply yet: send a gentle nudge',
          detail: `“${last.topic || last.type}” went out ${daysSince} days ago via ${last.type}. A short bump usually gets a response.`,
        });
      }

      // 3) Brand-new connection, so keep the momentum
      const connected = parseISO(person.dateConnected);
      if (connected && daysBetween(connected, now) <= 45 && pr.count <= 2 && last.response === 'Yes' && daysSince >= 2) {
        candidates.push({
          kind: 'nurture', priority: 66,
          title: 'New connection: keep the momentum',
          detail: `You met ${daysSince} days ago. A thank-you plus one specific follow-up makes a new contact stick.`,
        });
      }

      // 4) Regular check-in is due
      if (daysSince >= cadence && consecutiveNo < 3) {
        const overdue = daysSince / cadence;
        const isRekindle = daysSince > 180;
        const neverReplied = pr.replies === 0;
        candidates.push({
          kind: isRekindle ? 'rekindle' : 'due',
          priority: (isRekindle ? 28 : 40) + strength * 0.3 + pr.replyScore * 12 + Math.min(overdue, 3) * 4 - (neverReplied ? 12 : 0),
          title: isRekindle
            ? neverReplied ? 'Try again with a fresh angle' : 'Rekindle this relationship'
            : 'Time for a check-in',
          detail: `Last contact ${daysSince} days ago. You usually connect every ~${cadence} days.`,
        });
      }

      // 5) Gone quiet after several unanswered messages: give it space
      if (consecutiveNo >= 3) {
        candidates.push({
          kind: 'cooling', priority: 8,
          title: `${consecutiveNo} messages in a row without a reply`,
          detail: 'Give it some space. Try a different channel, or ask a mutual contact, before writing again.',
        });
      }
    }

    if (!candidates.length) continue;
    const best = candidates.sort((a, b) => b.priority - a.priority)[0];

    // Why this person is worth your time
    const reasons = [];
    reasons.push(`${pr.tier} relationship`);
    if (replyRate !== null && pr.answered >= 2) reasons.push(`Replies ${Math.round(replyRate * 100)}% of the time`);
    if (pr.introsMade.length) reasons.push(`Introduced you to ${pr.introsMade.length}`);
    if (pr.liveCount) reasons.push(`${pr.liveCount} live conversation${pr.liveCount > 1 ? 's' : ''}`);
    if (pr.bestChannel) reasons.push(`Best channel: ${pr.bestChannel}`);
    let priority = best.priority;
    if (pr.introsMade.length >= 2 && best.kind !== 'cooling') priority += 6; // connectors open doors

    out.push({ ...best, priority: Math.round(priority), reasons, profile: pr });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

export const SUGGESTION_GROUPS = [
  { kind: 'planned', label: 'Follow-ups you planned', blurb: 'Dates you wrote in your notes that have passed.' },
  { kind: 'upcoming', label: 'Coming up in the next 2 weeks', blurb: 'Calls and meetups you have on the books.' },
  { kind: 'nurture', label: 'New connections', blurb: 'Met recently. Turn them into real relationships.' },
  { kind: 'nudge', label: 'Waiting on a reply', blurb: 'Messages that haven’t been answered yet.' },
  { kind: 'due', label: 'Due for a check-in', blurb: 'Past your usual rhythm with them.' },
  { kind: 'rekindle', label: 'Rekindle', blurb: 'People you had good conversations with but haven’t talked to in 6+ months.' },
  { kind: 'first', label: 'Never contacted', blurb: 'In your People list but no interactions logged.' },
  { kind: 'cooling', label: 'Give it space', blurb: 'Several unanswered messages in a row.' },
];

/** Monthly totals for the activity chart. */
export function monthlyActivity(interactions) {
  const map = new Map();
  for (const i of interactions) {
    const key = i.date.slice(0, 7);
    const row = map.get(key) || { month: key, Replied: 0, 'No reply': 0, 'Not recorded': 0 };
    if (i.response === 'Yes') row.Replied++;
    else if (i.response === 'No') row['No reply']++;
    else row['Not recorded']++;
    map.set(key, row);
  }
  // fill empty months so gaps show
  const keys = [...map.keys()].sort();
  if (!keys.length) return [];
  const result = [];
  const [sy, sm] = keys[0].split('-').map(Number);
  const [ey, em] = keys.at(-1).split('-').map(Number);
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, (m = 1)) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    result.push(map.get(key) || { month: key, Replied: 0, 'No reply': 0, 'Not recorded': 0 });
  }
  return result;
}

/** Cumulative network size over time, by Date Connected. */
export function networkGrowth(people) {
  const dated = people.filter((p) => p.dateConnected).sort((a, b) => a.dateConnected.localeCompare(b.dateConnected));
  const byQuarter = new Map();
  let total = 0;
  for (const p of dated) {
    total++;
    const d = parseISO(p.dateConnected);
    const key = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
    byQuarter.set(key, total);
  }
  return [...byQuarter.entries()].map(([quarter, total]) => ({ quarter, total }));
}

export function countBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it) || 'Unknown';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export { toISO };
