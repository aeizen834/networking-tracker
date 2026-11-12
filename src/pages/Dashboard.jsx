import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { Card, PageHeader, StatTile } from '../components/ui.jsx';
import { MonthlyActivityChart, GrowthChart } from '../components/Charts.jsx';
import Heatmap from '../components/Heatmap.jsx';
import BarList from '../components/BarList.jsx';
import HealthBar from '../components/HealthBar.jsx';
import SuggestionCard from '../components/SuggestionCard.jsx';
import { monthlyActivity, networkGrowth, countBy, LIVE_TYPES } from '../lib/insights.js';
import { addDays, toISO, today } from '../lib/dates.js';

const pct = (n) => `${Math.round(n * 100)}%`;

export default function Dashboard() {
  const { people, interactions, profiles, suggestions } = useData();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const t = today();
    const d30 = toISO(addDays(t, -30));
    const d60 = toISO(addDays(t, -60));
    const d90 = toISO(addDays(t, -90));
    const yearStart = `${t.getFullYear()}-01-01`;
    const last30 = interactions.filter((i) => i.date > d30);
    const prev30 = interactions.filter((i) => i.date > d60 && i.date <= d30);
    const last90 = interactions.filter((i) => i.date > d90 && (i.response === 'Yes' || i.response === 'No'));
    const replyRate90 = last90.length ? last90.filter((i) => i.response === 'Yes').length / last90.length : 0;
    const liveYTD = interactions.filter((i) => i.date >= yearStart && LIVE_TYPES.has(i.type)).length;
    const newYTD = people.filter((p) => p.dateConnected >= yearStart).length;
    return { last30: last30.length, prev30: prev30.length, replyRate90, liveYTD, newYTD };
  }, [people, interactions]);

  const monthly = useMemo(() => monthlyActivity(interactions), [interactions]);
  const growth = useMemo(() => networkGrowth(people), [people]);

  const channels = useMemo(() => {
    const rows = countBy(interactions, (i) => i.type);
    return rows.map((r) => {
      const answered = interactions.filter((i) => i.type === r.label && (i.response === 'Yes' || i.response === 'No'));
      const yes = answered.filter((i) => i.response === 'Yes').length;
      return { ...r, rate: answered.length ? yes / answered.length : null, answered: answered.length };
    });
  }, [interactions]);

  const industries = useMemo(() => countBy(people, (p) => p.industry?.trim()), [people]);
  const connectors = useMemo(
    () =>
      profiles
        .filter((p) => p.introsMade.length)
        .map((p) => ({ label: p.person.name, value: p.introsMade.length, id: p.person.id }))
        .concat(
          // People who aren't in your list but introduced you (e.g. family, school)
          countBy(people.filter((p) => p.howWeMet && p.howWeMet !== 'Me' && !profiles.some((x) => x.person.name === p.howWeMet)), (p) => p.howWeMet)
        )
        .sort((a, b) => b.value - a.value),
    [profiles, people]
  );
  const mostEngaged = useMemo(
    () => [...profiles].sort((a, b) => b.strength - a.strength).slice(0, 8)
      .map((p) => ({ label: p.person.name, value: p.strength, id: p.person.id, note: p.tier })),
    [profiles]
  );

  const topSuggestions = suggestions.filter((s) => !s.snoozedUntil).slice(0, 4);
  const delta = stats.last30 - stats.prev30;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${people.length} people · ${interactions.length} interactions logged`}>
        <Link to="/add" className="btn btn-primary">+ Log interaction</Link>
      </PageHeader>

      <div className="stats-grid">
        <StatTile label="Touches, last 30 days" value={stats.last30}
          sub={delta === 0 ? 'Same as the prior 30 days' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs prior 30 days`} to="/log" />
        <StatTile label="Reply rate, last 90 days" value={pct(stats.replyRate90)} sub="of messages with a recorded response" />
        <StatTile label="Live conversations this year" value={stats.liveYTD} sub="Zoom, phone, lunch, in person" />
        <StatTile label="New connections this year" value={stats.newYTD} sub={`${people.length} in your network`} to="/people" />
      </div>

      <div className="grid-2-1">
        <Card title="Who to reach out to" subtitle="Your top suggestions right now"
          action={<Link to="/reach-out" className="btn btn-ghost btn-sm">See all →</Link>}>
          <div className="sugg-grid-compact">
            {topSuggestions.map((s) => <SuggestionCard key={s.profile.person.id} s={s} compact />)}
          </div>
        </Card>
        <Card title="Relationship health" subtitle="Based on each person’s usual rhythm with you">
          <HealthBar profiles={profiles} />
        </Card>
      </div>

      <Card title="Outreach by month" subtitle="Each bar is a month of interactions, split by whether you got a reply">
        <MonthlyActivityChart data={monthly} />
      </Card>

      <div className="grid-2">
        <Card title="Activity calendar" subtitle="Interactions per day">
          <Heatmap interactions={interactions} />
        </Card>
        <Card title="Network growth" subtitle="Total people by date connected">
          <GrowthChart data={growth} />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Channels you use" subtitle="Interactions per channel">
          <BarList items={channels} />
        </Card>
        <Card title="Reply rate by channel" subtitle="Channels with 3+ recorded responses">
          <BarList
            items={channels.filter((c) => c.answered >= 3).map((c) => ({ label: c.label, value: c.rate, note: `(${c.answered})` }))
              .sort((a, b) => b.value - a.value)}
            max={1}
            format={pct}
          />
        </Card>
        <Card title="Industries" subtitle="People in your network">
          <BarList items={industries} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Top connectors" subtitle="Who introduced you to the most people">
          <BarList items={connectors} onSelect={(it) => it.id && navigate(`/people/${it.id}`)} />
        </Card>
        <Card title="Strongest relationships" subtitle="Strength score (0–100) from replies, live conversations and intros">
          <BarList items={mostEngaged} max={100} onSelect={(it) => navigate(`/people/${it.id}`)} />
        </Card>
      </div>
    </>
  );
}
