import { formatLocalDateTime, toLocalMs } from "../lib/time.ts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SeriesPoint = {
  time: string;
  humidity_pct: number;
};

type Props = {
  series: Record<string, SeriesPoint[]>;
};

const COLORS = ["#1d9bf0", "#00ba7c", "#f7931a", "#f4212e"];

function buildChartData(series: Record<string, SeriesPoint[]>) {
  const byTime = new Map<string, Record<string, number>>();

  for (const [probe, points] of Object.entries(series)) {
    for (const { time, humidity_pct } of points) {
      const key = time;
      if (!byTime.has(key)) {
        byTime.set(key, { time: toLocalMs(time) });
      }
      const row = byTime.get(key)!;
      row[`probe${probe}`] = humidity_pct;
    }
  }

  return Array.from(byTime.values()).sort(
    (a, b) => (a.time as number) - (b.time as number),
  );
}

export default function MoistureChart({ series }: Props) {
  const data = buildChartData(series);
  const probes = Object.keys(series).sort();

  if (data.length === 0) {
    return <p className="status">No chart data for this time range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid stroke="#38444d" strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(ts) => formatLocalDateTime(ts as number)}
          stroke="#8b98a5"
          fontSize={12}
        />
        <YAxis
          domain={[0, 100]}
          unit="%"
          stroke="#8b98a5"
          fontSize={12}
        />
        <Tooltip
          labelFormatter={(ts) => formatLocalDateTime(ts as number)}
          formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
          contentStyle={{
            background: "#1e2732",
            border: "1px solid #38444d",
            borderRadius: 6,
          }}
        />
        <Legend />
        {probes.map((probe, i) => (
          <Line
            key={probe}
            type="monotone"
            dataKey={`probe${probe}`}
            name={`Probe ${probe}`}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
