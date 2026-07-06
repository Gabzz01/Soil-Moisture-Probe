import { toLocalMs } from "../lib/time.ts";
import { weatherCodeToEmoji } from "../lib/weatherIcons.ts";
import type { HourlyWeatherPoint } from "../lib/openmeteo.ts";
import { usePlotArea, useXAxisScale } from "recharts";

const GRID_COLOR = "#38444d";
const STRIP_HEIGHT = 52;

export type WeatherTimelineConfig = {
  hourlyWeather: HourlyWeatherPoint[];
  rangeHours: number;
};

function filterForDensity(
  points: HourlyWeatherPoint[],
  rangeHours: number,
): HourlyWeatherPoint[] {
  if (rangeHours <= 24) return points;

  return points.filter((p) => {
    const ms = toLocalMs(p.time);
    const hour = new Date(ms).getUTCHours();
    return hour % 6 === 0;
  });
}

export function WeatherTimeline({ hourlyWeather, rangeHours }: WeatherTimelineConfig) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();

  if (!plotArea || !xScale || hourlyWeather.length === 0) return null;

  const slots = filterForDensity(hourlyWeather, rangeHours);
  const stripTop = plotArea.y - STRIP_HEIGHT + 4;
  const dividerY = plotArea.y - 1;
  const left = plotArea.x;
  const right = left + plotArea.width;

  return (
    <g className="weather-timeline" aria-hidden="true">
      <line
        x1={left}
        y1={dividerY}
        x2={right}
        y2={dividerY}
        stroke={GRID_COLOR}
        strokeWidth={1}
      />
      {slots.map((point) => {
        const ms = toLocalMs(point.time);
        const x = xScale(ms);
        if (x == null || x < left || x > right) return null;

        const emoji = weatherCodeToEmoji(point.weatherCode);
        const temp = `${Math.round(point.temperature)}°`;

        return (
          <foreignObject
            key={point.time}
            x={x - 20}
            y={stripTop}
            width={40}
            height={STRIP_HEIGHT}
            className="weather-timeline-slot"
          >
            <div className="weather-timeline-slot-inner">
              <span className="weather-timeline-icon">{emoji}</span>
              <span className="weather-timeline-temp">{temp}</span>
            </div>
          </foreignObject>
        );
      })}
    </g>
  );
}
