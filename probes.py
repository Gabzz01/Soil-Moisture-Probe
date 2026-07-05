#!/usr/bin/env python3
import os
import time
import math
from datetime import datetime
import urllib.error
import urllib.parse
import urllib.request
import board
import busio
import digitalio
from adafruit_ads1x15.ads1115 import ADS1115
from adafruit_ads1x15.analog_in import AnalogIn

# ---------- Parameters ----------
V_EXC    = 3.3        # actual excitation voltage (measure on your board)
R_SERIES = 10000
V_AIR    = 2.6        # dry calibration
V_WATER  = 1.3        # saturated calibration

ADS_DATA_RATE = 128    # low SPS -> calmer samples (default 128)
N_MEDIAN      = 5      # median over N reads per channel (rejects spikes)
EMA_ALPHA     = 0.25   # temporal smoothing (lower = smoother)
SETTLE_TIME   = 1
ITERATION_DELAY = 3

# ---------- InfluxDB ----------
def influx_base_url():
    url = os.getenv("INFLUXDB_URL", "https://influxdb").strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url

INFLUXDB_DATABASE = os.getenv("INFLUXDB_DATABASE", "soil")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")

if not INFLUXDB_TOKEN:
    print("INFLUXDB_TOKEN not set — print-only mode (no InfluxDB writes)")

# ---------- Excitation ----------
power = digitalio.DigitalInOut(board.D22)
power.direction = digitalio.Direction.OUTPUT
power.value = False

# ---------- Bus / ADS ----------
def init_bus():
    i2c = busio.I2C(board.SCL, board.SDA)
    ads = ADS1115(i2c, address=0x48)
    ads.data_rate = ADS_DATA_RATE
    channels = [AnalogIn(ads, i) for i in range(4)]
    return i2c, ads, channels

i2c, ads, channels = init_bus()

def reset_bus():
    """Clean recovery: reinitialize everything (never retry in place)."""
    global i2c, ads, channels
    power.value = False
    try:
        i2c.deinit()
    except Exception:
        pass
    time.sleep(0.3)
    i2c, ads, channels = init_bus()

# ---------- Humidity conversion ----------
def v_to_r(v):
    v = min(max(v, 0.001), V_EXC - 0.001)
    return R_SERIES * v / (V_EXC - v)

LN_DRY       = math.log(v_to_r(V_AIR))
LN_SATURATED = math.log(v_to_r(V_WATER))

def humidity_pct(v):
    frac = (LN_DRY - math.log(v_to_r(v))) / (LN_DRY - LN_SATURATED)
    return max(0.0, min(100.0, 100.0 * frac))

# ---------- InfluxDB write ----------
def format_line(probe, channel, voltage, humidity, stale):
    ts = int(time.time())
    return (
        f"soil_moisture,probe={probe},channel={channel} "
        f"voltage={voltage},humidity_pct={humidity},stale={stale}i {ts}"
    )

def send_to_influx(lines):
    if not lines or not INFLUXDB_TOKEN:
        return
    params = urllib.parse.urlencode({"db": INFLUXDB_DATABASE, "precision": "second"})
    url = f"{influx_base_url()}/api/v3/write_lp?{params}"
    req = urllib.request.Request(
        url,
        data="\n".join(lines).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {INFLUXDB_TOKEN}",
            "Content-Type": "text/plain",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(f"InfluxDB write error: {exc.code} {body}")
    except Exception as exc:
        print(f"InfluxDB write error: {exc}")

# ---------- Reading ----------
def read_median(idx, n=N_MEDIAN):
    """Median of n reads. Stops on first failure (avoids blocking the bus)."""
    vals = []
    for _ in range(n):
        try:
            vals.append(channels[idx].voltage)
        except Exception:
            break  # one failure -> don't keep hammering this channel
    if not vals:
        return None
    vals.sort()
    return vals[len(vals) // 2]

def read_all():
    """Tolerant pass, then one retry after a clean reset for failures."""
    values = [read_median(i) for i in range(4)]
    if any(v is None for v in values):
        reset_bus()
        power.value = True
        time.sleep(SETTLE_TIME)
        for i in range(4):
            if values[i] is None:
                values[i] = read_median(i)
    return values

# ---------- Smoothing + last known value ----------
ema = [None] * 4

def smooth(idx, v):
    if v is None:
        return ema[idx], True  # failure -> keep last value (stale)
    if ema[idx] is None:
        ema[idx] = v
    else:
        ema[idx] = EMA_ALPHA * v + (1 - EMA_ALPHA) * ema[idx]
    return ema[idx], False

# ---------- Main loop ----------
try:
    while True:
        power.value = True
        time.sleep(SETTLE_TIME)
        try:
            _ = channels[0].voltage  # dummy read: absorbs first-access glitch
        except Exception:
            pass

        raw = read_all()
        power.value = False

        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines = []
        for i in range(4):
            v, stale = smooth(i, raw[i])
            if v is None:
                print(f"[{now}] Probe {i+1} (A{i}): -- (no reading yet)")
            else:
                tag = "  [held value]" if stale else ""
                h = humidity_pct(v)
                print(f"[{now}] Probe {i+1} (A{i}): {v:.3f} V - {h:.1f} %{tag}")
                lines.append(format_line(i + 1, f"A{i}", v, h, 1 if stale else 0))

        send_to_influx(lines)
        print("-" * 30)
        time.sleep(ITERATION_DELAY)

except KeyboardInterrupt:
    print("\nStopping...")

finally:
    power.value = False
    power.deinit()
