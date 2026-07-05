# Soil-Moisture-Probe

DIY soil moisture probe with Raspberry Pi Zero 2. Reads 4 probes via ADS1115 and sends measurements to InfluxDB 3 Core.

| Component | Location | Role |
|-----------|----------|------|
| Probe script | [`probe/`](probe/) | Reads sensors, writes to InfluxDB |
| InfluxDB 3 Core | [`gitops/`](gitops/) | Time-series database (Kubernetes) |
| InfluxDB 3 Explorer | [`gitops/explorer-*.yaml`](gitops/) | Web UI for queries (Kubernetes) |
| Dashboard | [`dashboard/`](dashboard/) | React UI for probe readings — local dev or Kubernetes (public) |

Deploy InfluxDB first, then configure the Pi to send data to it.

---

## Kubernetes (GitOps)

Manifests live in [`gitops/`](gitops/). Access is via Tailscale ingress (`influxdb`, `explorer`).

| Component | Tailscale host | Manifests |
|-----------|----------------|-----------|
| InfluxDB 3 Core | `influxdb` | `namespace.yaml`, `statefulset.yaml`, `service.yaml`, `ingress.yaml` |
| InfluxDB 3 Explorer | `explorer` | `explorer-*.yaml` |
| Dashboard | `soil-moisture.rtz-developments.com` (public) | `dashboard-*.yaml` |

### InfluxDB 3 Core

InfluxDB 3 Core requires an admin token at startup. Generate it offline with Docker, then create the Kubernetes secret. Do not commit `admin-token.json`.

```bash
# 1. Generate admin-token.json (token must start with apiv3_)
docker run --rm -v "$PWD:/out" influxdb:3-core \
  influxdb3 create token --admin --offline \
  --name admin \
  --output-file /out/admin-token.json

python3 -c 'import json; t=json.load(open("admin-token.json"))["token"]; assert t.startswith("apiv3_"), f"invalid token: {t[:20]}..."'

# 2. Create namespace and secret
kubectl apply -f gitops/namespace.yaml
kubectl -n influxdb create secret generic influxdb-admin-token \
  --from-file=admin-token.json=admin-token.json

# 3. Deploy InfluxDB
kubectl apply -f gitops/statefulset.yaml \
               -f gitops/service.yaml \
               -f gitops/ingress.yaml

# 4. Create the database and verify
TOKEN=$(python3 -c 'import json; print(json.load(open("admin-token.json"))["token"])')
curl -s -H "Authorization: Bearer $TOKEN" https://influxdb/health

curl -s -X POST "https://influxdb/api/v3/configure/database" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"db":"soil"}'

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://influxdb/api/v3/configure/database?format=pretty" | grep soil
```

### InfluxDB 3 Explorer

Explorer is a separate OSS UI (`influxdata/influxdb3-ui`). Requires InfluxDB Core to be running.

```bash
kubectl -n influxdb create secret generic influxdb-explorer-session \
  --from-literal=SESSION_SECRET_KEY=$(openssl rand -hex 32)

kubectl -n influxdb create secret generic influxdb-explorer-config \
  --from-literal=config.json="$(python3 -c "
import json
print(json.dumps({
    'DEFAULT_INFLUX_SERVER': 'http://influxdb:8181',
    'DEFAULT_INFLUX_DATABASE': 'soil',
    'DEFAULT_API_TOKEN': json.load(open('admin-token.json'))['token'],
    'DEFAULT_SERVER_NAME': 'Soil Moisture Probe',
}))
")"

kubectl apply -f gitops/explorer-pvc.yaml \
               -f gitops/explorer-deployment.yaml \
               -f gitops/explorer-service.yaml \
               -f gitops/explorer-ingress.yaml
```

Open **https://explorer** on your Tailscale network.

### Soil Moisture Dashboard (public)

The dashboard is built as a Docker image on every push to `main` (see [`.github/workflows/dashboard.yml`](.github/workflows/dashboard.yml)) and published to:

`ghcr.io/gabzz01/soil-moisture-probe/dashboard:latest`

After the first CI run, make the GHCR package **public** (GitHub → Packages → package settings → Change visibility) so the cluster can pull without credentials.

Requires InfluxDB Core to be running. The dashboard talks to InfluxDB over the cluster network; the token stays server-side.

```bash
# 1. Namespace and secret (re-use admin token from InfluxDB setup)
kubectl apply -f gitops/dashboard-namespace.yaml

kubectl -n soil-moisture create secret generic dashboard-env \
  --from-literal=INFLUXDB_TOKEN="$(python3 -c 'import json; print(json.load(open("admin-token.json"))["token"])')"

# 2. Deploy dashboard
kubectl apply -f gitops/dashboard-pvc.yaml \
               -f gitops/dashboard-deployment.yaml \
               -f gitops/dashboard-service.yaml \
               -f gitops/dashboard-ingressroute.yaml
```

Open **https://soil-moisture.rtz-developments.com** (DNS must point at your Traefik load balancer).

Probe names, emojis, and weather location persist on a PVC (`dashboard-data`). Local development: see [`dashboard/README.md`](dashboard/README.md).

---

## Raspberry Pi probe

### Prerequisites

- Enable I2C: `sudo raspi-config`
- Add your user to `gpio` and `i2c`: `sudo usermod -aG gpio,i2c raspberry` (log out and back in)

### Install

```bash
sudo apt-get install -y i2c-tools libgpiod-dev python3-libgpiod python3-venv
cd probe
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` lists Adafruit Blinka and the ADS1115 driver. InfluxDB writes use the Python standard library only.

### Configuration

Copy `admin-token.json` from the Kubernetes setup to the Pi. Set these environment variables (or use the systemd env file below):

| Variable | Default | Description |
|----------|---------|-------------|
| `INFLUXDB_TOKEN` | — | Admin token from `admin-token.json` (required for writes) |
| `INFLUXDB_URL` | `https://influxdb` | InfluxDB hostname (`https://` added automatically if omitted) |
| `INFLUXDB_DATABASE` | `soil` | Database name |

Without `INFLUXDB_TOKEN`, the script runs in print-only mode for hardware testing.

### Manual run

```bash
cd probe
source venv/bin/activate
export INFLUXDB_TOKEN="$(python3 -c 'import json; print(json.load(open("admin-token.json"))["token"])')"
# export INFLUXDB_URL="influxdb.tail3d44fe.ts.net"

python3 probes.py          # one reading, then exit
python3 probes.py --loop   # continuous readings every 3 s
```

### Systemd timer

Runs one reading every 10 minutes on the clock (`:00`, `:10`, `:20`, …). Default paths assume the repo is cloned to `/home/raspberry/Soil-Moisture-Probe`.

**Environment file** — create `/etc/soil-probe/env` (do not commit):

```bash
sudo mkdir -p /etc/soil-probe
sudo install -m 600 probe/soil-probe.env.example /etc/soil-probe/env
sudo nano /etc/soil-probe/env
```

**Service and timer** — verify the venv exists, then install:

```bash
ls probe/venv/bin/python3   # must exist

sudo cp probe/systemd/soil-probe.{service,timer} /etc/systemd/system/
# Edit paths in soil-probe.service if your clone is elsewhere
sudo systemctl daemon-reload
sudo systemctl enable --now soil-probe.timer
```

**Verify:**

```bash
sudo systemctl start soil-probe.service   # manual test
journalctl -u soil-probe.service -n 20
systemctl status soil-probe.timer
```
