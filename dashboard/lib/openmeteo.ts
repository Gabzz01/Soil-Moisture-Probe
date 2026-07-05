import { parseInfluxTime } from "./time.ts";

export type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
};

export type WeatherPoint = {
  time: string;
  temperature: number;
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }>;
};

type Minutely15Response = {
  minutely_15?: {
    time: string[];
    temperature_2m: number[];
  };
};

const BUCKET_MS = 15 * 60 * 1000;

function toUtcMs(time: string): number {
  return parseInfluxTime(time).getTime();
}

function nearest15MinBucketMs(ms: number): number {
  return Math.round(ms / BUCKET_MS) * BUCKET_MS;
}

function toOpenMeteoMinute(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "5");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as GeocodingResponse;
  if (!data.results) {
    return [];
  }

  return data.results.map((r) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    admin1: r.admin1,
    country: r.country,
  }));
}

async function fetchMinutely15Grid(
  latitude: number,
  longitude: number,
  minMs: number,
  maxMs: number,
): Promise<Map<number, number>> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("minutely_15", "temperature_2m");
  url.searchParams.set("start_minutely_15", toOpenMeteoMinute(minMs - BUCKET_MS));
  url.searchParams.set("end_minutely_15", toOpenMeteoMinute(maxMs + BUCKET_MS));
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as Minutely15Response;
  const minutely = data.minutely_15;
  const lookup = new Map<number, number>();
  if (!minutely?.time?.length) {
    return lookup;
  }

  for (let i = 0; i < minutely.time.length; i++) {
    const time = minutely.time[i]!;
    const temperature = minutely.temperature_2m[i];
    if (temperature == null) continue;
    lookup.set(toUtcMs(time), temperature);
  }

  return lookup;
}

export async function fetchTemperatureForSensorTimes(
  latitude: number,
  longitude: number,
  sensorTimes: string[],
): Promise<WeatherPoint[]> {
  const uniqueTimes = [...new Set(sensorTimes)].sort();
  if (uniqueTimes.length === 0) {
    return [];
  }

  const msTimes = uniqueTimes.map(toUtcMs).filter((t) => !Number.isNaN(t));
  if (msTimes.length === 0) {
    return [];
  }

  const minMs = Math.min(...msTimes);
  const maxMs = Math.max(...msTimes);
  const grid = await fetchMinutely15Grid(latitude, longitude, minMs, maxMs);

  const points: WeatherPoint[] = [];
  for (const time of uniqueTimes) {
    const ms = toUtcMs(time);
    if (Number.isNaN(ms)) continue;

    const bucket = nearest15MinBucketMs(ms);
    const temperature = grid.get(bucket);
    if (temperature == null) continue;

    points.push({ time, temperature });
  }

  return points;
}
