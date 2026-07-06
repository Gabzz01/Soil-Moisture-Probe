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

## Production (Kubernetes)

Image: `ghcr.io/gabzz01/soil-moisture-probe/dashboard:latest` (built by CI on push to `main`).

Public URL: **https://soil-moisture.rtz-developments.com**

Deploy steps and secrets are in the root [`README.md`](../README.md#soil-moisture-dashboard-public). Set `DATA_PATH` via the deployment manifest (default `/data/data.json` on a PVC).

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_PATH` | `./data.json` | Path to probe names/emojis/location JSON (use PVC in prod) |
| `NODE_ENV` | — | Set to `production` in the container image |

## Weather overlay

Search for a city in the header to load weather from [Open-Meteo](https://open-meteo.com/) (free, no API key). The selected location is saved in [`data.json`](data.json) under `location`.

An integrated hourly weather strip appears above the humidity chart when a location is set: WMO weather-code icons and temperature labels aligned to the chart time axis. On the 24h view every hour is shown; on 7d every 6 hours. Temperature is also drawn as a dashed gold line on the right-hand °C axis, using hourly model data for the chart time range.

## Probe names

Display names are stored in [`data.json`](data.json) under `probes`. Click the pencil icon on a probe card to rename it; changes persist across restarts. The chart legend uses the same names. InfluxDB probe IDs (`1`–`4`) are unchanged.

## Probe emojis

Optional emojis are stored in `data.json` under `emojis`. Click the emoji button (or ➕ when empty) on a probe card to pick from a curated garden/plant set, or clear with ×. Labels show as e.g. `🥬 Big Lettuce Pot` on cards and the chart legend.

## Plant type and moisture gauge

Each probe has a **plant type** selector (stored in `data.json` under `plantTypes`). The semicircle gauge shows the current moisture % as a colored arc and marker, with a green band for the preset optimum range.

| Plant | Optimum range |
|-------|---------------|
| Lettuce | 60–80% |
| Tomato | 50–70% |
| Strawberry | 60–80% |
| Herbs | 45–65% |
| Peppers | 50–70% |
| Cucumber | 55–75% |
| Succulent | 20–40% |

Status labels: **Optimal** (green), **Too dry** (orange), **Too wet** (blue). These ranges are starting points for capacitive-style probe readings — tune per pot as needed.
