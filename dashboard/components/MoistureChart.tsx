import { formatLocalTime, toLocalMs } from "../lib/time.ts";
import { probeLabel } from "../lib/labels.ts";
import type { HourlyWeatherPoint } from "../lib/openmeteo.ts";
import { WeatherTimeline } from "./WeatherTimeline.tsx";
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
  names: Record<string, string>;
  emojis: Record<string, string>;
  hourlyWeather: HourlyWeatherPoint[];
  rangeHours: number;
};

const COLORS = ["#1d9bf0", "#00ba7c", "#f7931a", "#f4212e"];
const TEMP_COLOR = "#ffd166";
const WEATHER_STRIP_MARGIN = 56;

type TimePoint = { time: number };

function toProbeLineData(points: SeriesPoint[]): Array<TimePoint & { humidity: number }> {
  return points
    .map((p) => ({ time: toLocalMs(p.time), humidity: p.humidity_pct }))
    .sort((a, b) => a.time - b.time);
}

function toHourlyLineData(
  hourly: HourlyWeatherPoint[],
): Array<TimePoint & { temperature: number }> {
  return hourly
    .map((h) => ({ time: toLocalMs(h.time), temperature: h.temperature }))
    .sort((a, b) => a.time - b.time);
}

export function computeSensorTimeDomain(
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

function filterHourlyToDomain(
  hourly: HourlyWeatherPoint[],
  domain: [number, number],
): HourlyWeatherPoint[] {
  const [min, max] = domain;
  return hourly.filter((h) => {
    const t = toLocalMs(h.time);
    return t >= min && t <= max;
  });
}

function formatTooltipValue(value: number, name: string): [string, string] {
  if (name === "Temperature") {
    return [`${value.toFixed(1)}°C`, name];
  }
  return [`${value.toFixed(1)}%`, name];
}

export default function MoistureChart({
  series,
  names,
  emojis,
  hourlyWeather,
  rangeHours,
}: Props) {
  const probes = Object.keys(series).sort();
  const xDomain = computeSensorTimeDomain(series);
  const hasProbeData = xDomain !== undefined;
  const filteredHourly = hasProbeData
    ? filterHourlyToDomain(hourlyWeather, xDomain)
    : [];
  const weatherData = toHourlyLineData(filteredHourly);
  const hasWeather = weatherData.length > 0;

  if (!hasProbeData) {
    return <p className="status">No chart data for this time range.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={hasWeather ? 376 : 320}>
      <LineChart
        margin={{
          top: hasWeather ? WEATHER_STRIP_MARGIN : 5,
          right: hasWeather ? 40 : 20,
          left: 0,
          bottom: 5,
        }}
      >
        {hasWeather && (
          <WeatherTimeline hourlyWeather={filteredHourly} rangeHours={rangeHours} />
        )}
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
