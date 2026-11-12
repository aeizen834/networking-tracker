// Recharts-based charts. Colors come from CSS tokens so light and dark mode both work.
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useThemeColors } from '../lib/useThemeColors.js';

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="chart-tip-row chart-tip-total">
          <span />
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      )}
    </div>
  );
}

export function MonthlyActivityChart({ data }) {
  const c = useThemeColors();
  const series = [
    { key: 'Replied', color: c['series-1'] },
    { key: 'No reply', color: c['series-2'] },
    { key: 'Not recorded', color: c['series-neutral'] },
  ];
  const axis = { fill: c['text-muted'], fontSize: 12 };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip labelFormatter={monthLabel} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c['text-secondary'] }} />
        {series.map((s, idx) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color}
            stroke={c['surface-1']}
            strokeWidth={1}
            radius={idx === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({ data }) {
  const c = useThemeColors();
  const axis = { fill: c['text-muted'], fontSize: 12 };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="quarter" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: c['text-muted'], strokeDasharray: '3 3' }} />
        <Line
          type="monotone"
          dataKey="total"
          name="People in network"
          stroke={c['series-1']}
          strokeWidth={2}
          dot={{ r: 4, fill: c['series-1'], stroke: c['surface-1'], strokeWidth: 2 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
