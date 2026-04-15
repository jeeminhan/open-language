"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface SessionMetric {
  date: string;
  errorRate: number;
  turns: number;
  errors: number;
  corrections: number;
  duration: number;
}

const tooltipStyle = {
  backgroundColor: "#12121a",
  border: "1px solid #2a2a36",
  borderRadius: "8px",
  color: "#e0ddd5",
  fontSize: "12px",
};

export function ErrorRateChart({ data }: { data: SessionMetric[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#c45e4a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#c45e4a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
        <XAxis
          dataKey="date"
          stroke="#8a8780"
          fontSize={11}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          stroke="#8a8780"
          fontSize={11}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Error Rate"]} />
        <Area
          type="monotone"
          dataKey="errorRate"
          stroke="#c45e4a"
          fill="url(#errorGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TurnsPerSessionChart({ data }: { data: SessionMetric[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="turnsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5b7e9a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#5b7e9a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
        <XAxis
          dataKey="date"
          stroke="#8a8780"
          fontSize={11}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis stroke="#8a8780" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Turns"]} />
        <Area
          type="monotone"
          dataKey="turns"
          stroke="#5b7e9a"
          fill="url(#turnsGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface GrammarTrend {
  pattern: string;
  mastery: number;
  uses: number;
}

export function GrammarMasteryChart({ data }: { data: GrammarTrend[] }) {
  if (data.length === 0) return null;

  const barData = data.slice(0, 12).map((g) => ({
    name: g.pattern.length > 20 ? g.pattern.slice(0, 18) + "..." : g.pattern,
    mastery: Math.round(g.mastery),
    uses: g.uses,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={barData} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          stroke="#8a8780"
          fontSize={11}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#8a8780"
          fontSize={10}
          width={120}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Mastery"]} />
        <Line
          type="monotone"
          dataKey="mastery"
          stroke="#6b9a5b"
          strokeWidth={2}
          dot={{ fill: "#6b9a5b", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface VocabGrowth {
  date: string;
  cumulative: number;
}

export function VocabGrowthChart({ data }: { data: VocabGrowth[] }) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="vocabGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#c4b99a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#c4b99a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
        <XAxis
          dataKey="date"
          stroke="#8a8780"
          fontSize={11}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis stroke="#8a8780" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Words"]} />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="#c4b99a"
          fill="url(#vocabGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
