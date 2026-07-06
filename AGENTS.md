# AGENTS.md

## Cursor Cloud specific instructions

This repo is a monorepo for a DIY soil-moisture monitoring system. Components:

- `dashboard/` — Bun + React web app (the main product; UI + server-side API proxy). Run/setup commands are in `dashboard/README.md`. **Use Bun, not npm/node/vite** (see `dashboard/CLAUDE.md`).
- `probe/` — Python sensor script (`probes.py`). **Cannot run in this environment**: it imports `board`/`busio` (Adafruit Blinka) and needs physical Raspberry Pi + I2C + ADS1115 hardware. Editing/reading only.
- `gitops/` — Kubernetes/Tailscale/Traefik manifests for production deploy only; not needed for local dev.

### Running the dashboard end-to-end

The update script already runs `bun install` in `dashboard/`. To run the app:

```bash
cd dashboard && bun --hot index.ts   # serves http://localhost:3000
```

Non-obvious caveats:

- The dashboard needs a `dashboard/.env` (gitignored; copy from `.env.example`) with `INFLUXDB_TOKEN` and `INFLUXDB_URL`. Without a reachable InfluxDB, only `/api/readings` fails (500); the HTML UI, probe-name/emoji/plant-type editing, and weather endpoints still work.
- Weather endpoints (`/api/locations/search`, `/api/weather*`) call the public Open-Meteo API and require outbound internet.
- Probe names/emojis/plant types/location persist to a local JSON file (`dashboard/data.json`, path via `DATA_PATH`) — not InfluxDB.

### InfluxDB 3 Core (data backend for `/api/readings`)

Not installed by the update script (external service). For a full end-to-end test, run InfluxDB 3 Core locally and point `INFLUXDB_URL` at it:

```bash
# Download the influxdb3 binary (v3.10.0, linux amd64) once:
curl -sSL https://dl.influxdata.com/influxdb/releases/influxdb3-core-3.10.0_linux_amd64.tar.gz \
  | tar -xz -C "$HOME/.influxdb" --strip-components=1   # mkdir -p "$HOME/.influxdb" first

# Create an admin token (starts with apiv3_):
"$HOME/.influxdb/influxdb3" create token --admin --offline --name admin \
  --output-file "$HOME/.influxdb/admin-token.json"

# Serve on :8181 (mirrors gitops/statefulset.yaml):
"$HOME/.influxdb/influxdb3" serve --node-id=influxdb-0 --object-store=file \
  --data-dir="$HOME/.influxdb/data" \
  --admin-token-file="$HOME/.influxdb/admin-token.json" \
  --disable-authz=health,ping --http-bind=0.0.0.0:8181

# Create the "soil" database (measurement: soil_moisture; tags probe,channel; fields voltage,humidity_pct,stale):
curl -s -X POST http://localhost:8181/api/v3/configure/database \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"db":"soil"}'
```

Since real hardware/probe cannot run here, seed `soil_moisture` rows via `POST /api/v3/write_lp?db=soil&precision=second` (InfluxDB line protocol) to give the dashboard data to display.

### Lint / test

- No lint script and no test suite exist. `bun test` reports "No tests found". There is no ESLint config.
- `bunx tsc --noEmit` reports pre-existing errors (DOM globals like `document`) because `dashboard/tsconfig.json` `lib` omits `DOM`; the app is built/transpiled by Bun's bundler, not `tsc`, so these are not build regressions.
