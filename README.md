# Soil-Moisture-Probe

DIY soil moisture probe with Raspberry Pi Zero 2. Reads 4 probes via ADS1115 and sends measurements to InfluxDB 3 Core.

## Install (Pi)

Enable I2C (`sudo raspi-config`), then install system and Python deps:

```bash
sudo apt-get install -y i2c-tools libgpiod-dev python3-libgpiod python3-venv
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` lists Adafruit Blinka and the ADS1115 driver. InfluxDB writes use the Python standard library only (no extra pip packages).

## InfluxDB admin token (Kubernetes)

InfluxDB 3 Core requires an admin token at startup. Generate it offline with Docker, then create the Kubernetes secret (do not commit the token file).

```bash
# 1. Generate admin-token.json locally (token must start with apiv3_)
docker run --rm -v "$PWD:/out" influxdb:3-core \
  influxdb3 create token --admin --offline \
  --name admin \
  --output-file /out/admin-token.json

# Verify format before creating the secret
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

# Verify the database exists (expect "soil" in the output)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://influxdb/api/v3/configure/database?format=pretty" | grep soil
```

Keep `admin-token.json` out of git. Use the same token on the Pi as `INFLUXDB_TOKEN` (see **Run** below).

## InfluxDB 3 Explorer (Kubernetes)

Explorer is a separate OSS UI (`influxdata/influxdb3-ui`). Create its secrets, then deploy:

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

Open **https://explorer** on your Tailscale network (TLS host `explorer`). Explorer connects to InfluxDB at `http://influxdb:8181` inside the cluster.

## Run

```bash
export INFLUXDB_TOKEN="$(python3 -c 'import json; print(json.load(open("admin-token.json"))["token"])')"
# Optional overrides (hostname alone is fine — https:// is added automatically):
# export INFLUXDB_URL="influxdb.tail3d44fe.ts.net"
# export INFLUXDB_DATABASE="soil"

python3 probes.py
```

Without `INFLUXDB_TOKEN`, the script runs in print-only mode for hardware testing.

## GitOps

InfluxDB and Explorer are deployed from [`gitops/`](gitops/):

| Component | Tailscale host | Manifests |
|-----------|----------------|-----------|
| InfluxDB 3 Core | `influxdb` | `statefulset.yaml`, `service.yaml`, `ingress.yaml` |
| InfluxDB 3 Explorer | `explorer` | `explorer-*.yaml` |
