# Soil-Moisture-Probe

DIY soil moisture probe with Raspberry Pi Zero 2. Reads 4 probes via ADS1115 and sends measurements to InfluxDB 3 Core.

## Install (Pi)

```bash
pip install -r requirements.txt
# Plus CircuitPython / Adafruit libs for ADS1115 (board, busio, adafruit_ads1x15)
```

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
# Optional overrides:
# export INFLUXDB_URL="https://influxdb"
# export INFLUXDB_DATABASE="soil"

python3 probes.py
```

Without `INFLUXDB_TOKEN`, the script runs in print-only mode for hardware testing.

## GitOps

InfluxDB is deployed from [`gitops/`](gitops/). See manifests for Tailscale ingress and persistent storage.
