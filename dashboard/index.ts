import index from "./index.html";

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
          const rows = await queryInflux(hours);
          return Response.json(normalizeReadings(rows));
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
