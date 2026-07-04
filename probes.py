#!/usr/bin/env python3
import time
import math
import board
import busio
import digitalio
from adafruit_ads1x15.ads1115 import ADS1115
from adafruit_ads1x15.analog_in import AnalogIn

# ---------- Parametres ----------
V_EXC    = 3.3        # tension d'excitation reelle (a mesurer)
R_SERIES = 10000
V_AIR    = 2.6        # sec
V_EAU    = 1.3        # sature

ADS_DATA_RATE = 128    # SPS bas -> echantillons plus calmes (def 128)
N_MEDIANE     = 5     # mediane sur N lectures par canal (rejette les pics)
EMA_ALPHA     = 0.25  # lissage temporel (petit = tres lisse)
TEMPS_STAB    = 1
ITERATION_DELAY = 3
# ---------- Excitation ----------
alim = digitalio.DigitalInOut(board.D22)
alim.direction = digitalio.Direction.OUTPUT
alim.value = False

# ---------- Bus / ADS ----------
def init_bus():
    i2c = busio.I2C(board.SCL, board.SDA)
    ads = ADS1115(i2c, address=0x48)
    ads.data_rate = ADS_DATA_RATE
    channels = [AnalogIn(ads, i) for i in range(4)]
    return i2c, ads, channels

i2c, ads, channels = init_bus()

def reset_bus():
    """Recuperation propre : on reinitialise TOUT (jamais de retry en place)."""
    global i2c, ads, channels
    alim.value = False
    try:
        i2c.deinit()
    except Exception:
        pass
    time.sleep(0.3)
    i2c, ads, channels = init_bus()

# ---------- Conversion humidite ----------
def v_to_r(v):
    v = min(max(v, 0.001), V_EXC - 0.001)
    return R_SERIES * v / (V_EXC - v)

LN_SEC    = math.log(v_to_r(V_AIR))
LN_SATURE = math.log(v_to_r(V_EAU))

def humidite_pct(v):
    frac = (LN_SEC - math.log(v_to_r(v))) / (LN_SEC - LN_SATURE)
    return max(0.0, min(100.0, 100.0 * frac))

# ---------- Lecture ----------
def lire_mediane(idx, n=N_MEDIANE):
    """Mediane de n lectures. S'arrete des le 1er echec (evite de bloquer le bus)."""
    vals = []
    for _ in range(n):
        try:
            vals.append(channels[idx].voltage)
        except Exception:
            break  # un echec -> on n'insiste pas sur ce canal
    if not vals:
        return None
    vals.sort()
    return vals[len(vals) // 2]

def lire_tous():
    """Passage tolerant, puis UNE reprise apres reset propre pour les echecs."""
    valeurs = [lire_mediane(i) for i in range(4)]
    if any(v is None for v in valeurs):
        reset_bus()                 # recuperation avant de retenter
        alim.value = True
        time.sleep(TEMPS_STAB)
        for i in range(4):
            if valeurs[i] is None:
                valeurs[i] = lire_mediane(i)
    return valeurs

# ---------- Lissage + derniere valeur connue ----------
ema = [None] * 4

def lisser(idx, v):
    if v is None:
        return ema[idx], True       # echec -> on garde la derniere valeur (perimee)
    if ema[idx] is None:
        ema[idx] = v
    else:
        ema[idx] = EMA_ALPHA * v + (1 - EMA_ALPHA) * ema[idx]
    return ema[idx], False

# ---------- Boucle ----------
try:
    while True:
        alim.value = True
        time.sleep(TEMPS_STAB)
        try:
            _ = channels[0].voltage   # lecture a blanc : absorbe le 1er acces
        except Exception:
            pass

        brutes = lire_tous()
        alim.value = False

        for i in range(4):
            v, perime = lisser(i, brutes[i])
            if v is None:
                print(f"Sonde {i+1} (A{i}): -- (pas encore de mesure)")
            else:
                tag = "  [valeur retenue]" if perime else ""
                print(f"Sonde {i+1} (A{i}): {v:.3f} V - {humidite_pct(v):.1f} %{tag}")
        print("-" * 30)
        time.sleep(ITERATION_DELAY)

except KeyboardInterrupt:
    print("\nArret du script...")

finally:
    alim.value = False
    alim.deinit()
