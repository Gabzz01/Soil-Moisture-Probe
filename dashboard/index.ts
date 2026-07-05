import index from "./index.html";
import { fetchTemperatureForSensorTimes, searchLocations } from "./lib/openmeteo.ts";
import { loadLocation, loadProbeConfig, saveLocation, updateProbe } from "./lib/store.ts";

function influxBaseUrl(): string {
  let url = (process.env.INFLUXDB_URL ?? "https://influxdb").trim().replace(/\/$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

const INFLUXDB_DATABASE = process.env.INFLUXDB_DATABASE ?? "soil";
const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
const PORT = Number(process.env.PORT ?? 3000);

type InfluxRow = {
  time: string;
  probe: string;
  channel: string;
  humidity_pct: number;
  voltage: number;
  stale: number;
};

type ProbeReading = {
  probe: string;
  channel: string;
  humidity_pct: number;
  voltage: number;
  time: string;
  stale: boolean;
};

type SeriesPoint = {
  time: string;
  humidity_pct: number;
};

async function queryInflux(hours: number): Promise<InfluxRow[]> {
  if (!INFLUXDB_TOKEN) {
    throw new Error("INFLUXDB_TOKEN not set");
  }

  const q = `
    SELECT time, probe, channel, humidity_pct, voltage, stale
    FROM soil_moisture
    WHERE time >= now() - interval '${hours} hours'
    ORDER BY time
  `.trim();

  const res = await fetch(`${influxBaseUrl()}/api/v3/query_sql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INFLUXDB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ db: INFLUXDB_DATABASE, q, format: "json" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`InfluxDB query failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data as InfluxRow[];
}

function normalizeReadings(rows: InfluxRow[]) {
  const series: Record<string, SeriesPoint[]> = {};
  const latestByProbe = new Map<string, ProbeReading>();

  for (const row of rows) {
    const probe = String(row.probe);
    const point: SeriesPoint = {
      time: row.time,
      humidity_pct: Number(row.humidity_pct),
    };

    if (!series[probe]) {
      series[probe] = [];
    }
    series[probe].push(point);

    latestByProbe.set(probe, {
      probe,
      channel: String(row.channel),
      humidity_pct: Number(row.humidity_pct),
      voltage: Number(row.voltage),
      time: row.time,
      stale: Number(row.stale) !== 0,
    });
  }

  const probes = ["1", "2", "3", "4"]
    .map((probe) => latestByProbe.get(probe))
    .filter((p): p is ProbeReading => p !== undefined);

  return { probes, series };
}

Bun.serve({
  port: PORT,
  routes: {
    "/": index,
    "/api/readings": {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const hours = Math.max(1, Number(url.searchParams.get("hours") ?? 24));
          const [rows, config, location] = await Promise.all([
            queryInflux(hours),
            loadProbeConfig(),
            loadLocation(),
          ]);
          return Response.json({
            ...normalizeReadings(rows),
            names: config.names,
            emojis: config.emojis,
            location,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/names/:probe": {
      PUT: async (req) => {
        try {
          const probe = req.params.probe;
          const body = (await req.json()) as { name?: string; emoji?: string };
          if (body.name === undefined && body.emoji === undefined) {
            return Response.json(
              { error: "At least one of name or emoji is required" },
              { status: 400 },
            );
          }
          if (body.name !== undefined && typeof body.name !== "string") {
            return Response.json({ error: "Invalid name" }, { status: 400 });
          }
          if (body.emoji !== undefined && typeof body.emoji !== "string") {
            return Response.json({ error: "Invalid emoji" }, { status: 400 });
          }
          const config = await updateProbe(probe, {
            name: body.name,
            emoji: body.emoji,
          });
          return Response.json({ names: config.names, emojis: config.emojis });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = message.startsWith("Invalid") || message.includes("empty") ? 400 : 500;
          return Response.json({ error: message }, { status });
        }
      },
    },
    "/api/location": {
      GET: async () => {
        try {
          const location = await loadLocation();
          return Response.json({ location });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
      PUT: async (req) => {
        try {
          const body = (await req.json()) as {
            name?: string;
            latitude?: number;
            longitude?: number;
          };
          if (
            typeof body.name !== "string" ||
            typeof body.latitude !== "number" ||
            typeof body.longitude !== "number"
          ) {
            return Response.json({ error: "Invalid location" }, { status: 400 });
          }
          const location = await saveLocation({
            name: body.name,
            latitude: body.latitude,
            longitude: body.longitude,
          });
          return Response.json({ location });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const status =
            message.startsWith("Invalid") || message.includes("empty") ? 400 : 500;
          return Response.json({ error: message }, { status });
        }
      },
    },
    "/api/locations/search": {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const q = url.searchParams.get("q") ?? "";
          const results = await searchLocations(q);
          return Response.json({ results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
    "/api/weather": {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const lat = Number(url.searchParams.get("lat"));
          const lon = Number(url.searchParams.get("lon"));
          const timesParam = url.searchParams.get("times") ?? "";

          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return Response.json({ error: "lat and lon are required" }, { status: 400 });
          }

          const times = timesParam
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

          if (times.length === 0) {
            return Response.json({ error: "times are required" }, { status: 400 });
          }

          const weather = await fetchTemperatureForSensorTimes(lat, lon, times);
          return Response.json({ weather });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Dashboard running at http://localhost:${PORT}`);
