# Soil Moisture Dashboard

Local React dashboard for soil moisture probe readings stored in InfluxDB 3 Core.

## Setup

```bash
cd dashboard
cp .env.example .env   # fill in token + Tailscale InfluxDB URL
bun install
```

| Variable | Default | Description |
|----------|---------|-------------|
| `INFLUXDB_TOKEN` | — | Admin token from `admin-token.json` (required) |
| `INFLUXDB_URL` | `https://influxdb` | InfluxDB hostname (`https://` added if omitted) |
| `INFLUXDB_DATABASE` | `soil` | Database name |
| `PORT` | `3000` | Local server port |

## Run

```bash
bun --hot index.ts
```

Open **http://localhost:3000**.

The server proxies InfluxDB queries so the token stays server-side. The UI shows four probe cards (latest reading) and a humidity chart with 24h / 7d range toggle. Data refreshes every 60 seconds.

## Probe names

Display names are stored in [`data.json`](data.json) under `probes`. Click the pencil icon on a probe card to rename it; changes persist across restarts. The chart legend uses the same names. InfluxDB probe IDs (`1`–`4`) are unchanged.

## Probe emojis

Optional emojis are stored in `data.json` under `emojis`. Click the emoji button (or ➕ when empty) on a probe card to pick from a curated garden/plant set, or clear with ×. Labels show as e.g. `🥬 Big Lettuce Pot` on cards and the chart legend.
