import { formatLocalTime, toLocalMs } from "../lib/time.ts";
import { probeLabel } from "../lib/labels.ts";
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

type WeatherPoint = {
  time: string;
  temperature: number;
};

type Props = {
  series: Record<string, SeriesPoint[]>;
  names: Record<string, string>;
  emojis: Record<string, string>;
  weather: WeatherPoint[];
};

const COLORS = ["#1d9bf0", "#00ba7c", "#f7931a", "#f4212e"];
const TEMP_COLOR = "#ffd166";

type TimePoint = { time: number };

function toProbeLineData(points: SeriesPoint[]): Array<TimePoint & { humidity: number }> {
  return points
    .map((p) => ({ time: toLocalMs(p.time), humidity: p.humidity_pct }))
    .sort((a, b) => a.time - b.time);
}

function toWeatherLineData(
  weather: WeatherPoint[],
): Array<TimePoint & { temperature: number }> {
  return weather
    .map((w) => ({ time: toLocalMs(w.time), temperature: w.temperature }))
    .sort((a, b) => a.time - b.time);
}

function computeSensorTimeDomain(
  series: Record<string, SeriesPoint[]>,
): [number, number] | undefined {
  const times: number[] = [];
  for (const points of Object.values(series)) {
    for (const p of points) {
      times.push(toLocalMs(p.time));
    }
  }
  if (times.length === 0) return undefined;
  return [Math.min(...times), Math.max(...times)];
}

function filterWeatherToDomain(
  weather: WeatherPoint[],
  domain: [number, number],
): WeatherPoint[] {
  const [min, max] = domain;
  return weather.filter((w) => {
    const t = toLocalMs(w.time);
    return t >= min && t <= max;
  });
}

function formatTooltipValue(value: number, name: string): [string, string] {
  if (name === "Temperature") {
    return [`${value.toFixed(1)}°C`, name];
  }
  return [`${value.toFixed(1)}%`, name];
}

export default function MoistureChart({ series, names, emojis, weather }: Props) {
  const probes = Object.keys(series).sort();
  const xDomain = computeSensorTimeDomain(series);
  const hasProbeData = xDomain !== undefined;
  const weatherData = hasProbeData
    ? toWeatherLineData(filterWeatherToDomain(weather, xDomain))
    : [];
  const hasWeather = weatherData.length > 0;

  if (!hasProbeData) {
    return <p className="status">No chart data for this time range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart margin={{ top: 5, right: hasWeather ? 40 : 20, left: 0, bottom: 5 }}>
        <CartesianGrid stroke="#38444d" strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          domain={xDomain}
          allowDataOverflow
          tickFormatter={(ts) => formatLocalTime(ts as number)}
          stroke="#8b98a5"
          fontSize={12}
        />
        <YAxis
          yAxisId="moisture"
          domain={[0, 100]}
          unit="%"
          stroke="#8b98a5"
          fontSize={12}
        />
        {hasWeather && (
          <YAxis
            yAxisId="temperature"
            orientation="right"
            unit="°C"
            stroke={TEMP_COLOR}
            fontSize={12}
          />
        )}
        <Tooltip
          labelFormatter={(ts) => formatLocalTime(ts as number)}
          formatter={formatTooltipValue}
          contentStyle={{
            background: "#1e2732",
            border: "1px solid #38444d",
            borderRadius: 6,
          }}
        />
        <Legend />
        {probes.map((probe, i) => {
          const lineData = toProbeLineData(series[probe] ?? []);
          if (lineData.length === 0) return null;
          return (
            <Line
              key={probe}
              data={lineData}
              yAxisId="moisture"
              type="monotone"
              dataKey="humidity"
              name={probeLabel(names[probe] ?? `Probe ${probe}`, emojis[probe])}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          );
        })}
        {hasWeather && (
          <Line
            data={weatherData}
            yAxisId="temperature"
            type="monotone"
            dataKey="temperature"
            name="Temperature"
            stroke={TEMP_COLOR}
            strokeDasharray="6 4"
            dot={weatherData.length <= 2 ? { r: 3, fill: TEMP_COLOR } : false}
            strokeWidth={2}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
