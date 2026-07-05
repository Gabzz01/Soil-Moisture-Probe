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

InfluxDB is deployed from [`gitops/`](gitops/). See manifests for Tailscale ingress and persistent storage.
