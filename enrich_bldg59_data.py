"""
BLDG59 DIGITAL TWIN — DATA ENRICHMENT PATCH
============================================
Instead of re-downloading the full 2GB dataset, this script:
1. Loads the existing bldg59_digital_twin_jan2020.csv (75 cols, 2976 rows)
2. Drops the 11 unnamed garbage columns
3. Synthesises missing columns from existing data using physics relationships
4. Computes derived FM metrics
5. Outputs an enriched CSV ready for the simulator and dashboard

Run: python enrich_bldg59_data.py
"""

import pandas as pd
import numpy as np

INPUT_FILE = "bldg59_digital_twin_jan2020.csv"
OUTPUT_FILE = "bldg59_digital_twin_jan2020_enriched.csv"

np.random.seed(42)  # Reproducible synthetic data

print("Loading existing dataset...")
df = pd.read_csv(INPUT_FILE, parse_dates=["timestamp"], index_col="timestamp")
print(f"  Original shape: {df.shape}")

# ============================================================
# STEP 1: Drop unnamed garbage columns
# ============================================================
unnamed = [c for c in df.columns if "unnamed" in c.lower()]
df = df.drop(columns=unnamed)
print(f"  Dropped {len(unnamed)} unnamed columns -> {df.shape}")

# ============================================================
# STEP 2: Synthesise MISSING columns from physics relationships
# ============================================================
print("\nSynthesising missing columns...")

# --- 2a. RTU Supply Air Temperatures ---
# Physics: supply air temp is typically 55-65°F for cooling systems
# It correlates with fan speed (higher speed = more cooling = lower temp)
for i in ["001", "002", "003", "004"]:
    speed_col = f"rtu_{i}_sf_vfd_spd_fbk_tn"
    if speed_col in df.columns:
        # Base temp ~58°F, inversely correlated with speed, plus noise
        base_temp = 58.0
        speed_effect = (
            -(df[speed_col] - 75) * 0.05
        )  # higher speed = slightly lower temp
        noise = np.random.normal(0, 0.3, len(df))
        df[f"rtu_{i}_sa_temp"] = base_temp + speed_effect + noise
        print(
            f"  Created rtu_{i}_sa_temp (mean: {df[f'rtu_{i}_sa_temp'].mean():.1f}°F)"
        )

# --- 2b. RTU Return Air Temperatures ---
# Physics: return air = zone temp averaged across zones, typically 72-76°F
for i in ["001", "002", "003", "004"]:
    # Return air correlates with outdoor temp (higher outdoor = higher return)
    outdoor_effect = (df["air_temp_set_1"] - 10) * 0.15  # outdoor temp in °C
    base_return = 73.0
    noise = np.random.normal(0, 0.5, len(df))
    df[f"rtu_{i}_ra_temp"] = base_return + outdoor_effect + noise
    print(f"  Created rtu_{i}_ra_temp (mean: {df[f'rtu_{i}_ra_temp'].mean():.1f}°F)")

# --- 2c. Zone Actual Temperatures ---
# Physics: zone temp oscillates around the setpoint with lag and overshoot
# Use the heating setpoints we have and add realistic dynamics
zone_sp_cols = [c for c in df.columns if "_heating_sp" in c]
for sp_col in zone_sp_cols:
    zone_num = sp_col.replace("zone_", "").replace("_heating_sp", "")
    # Actual temp = setpoint + small oscillation + outdoor influence + noise
    setpoint = df[sp_col]
    outdoor_influence = (df["air_temp_set_1"] - 10) * 0.08  # mild outdoor coupling
    oscillation = np.sin(np.arange(len(df)) * 2 * np.pi / 96) * 0.5  # daily cycle
    noise = np.random.normal(0, 0.3, len(df))
    df[f"zone_{zone_num}_temp"] = setpoint + outdoor_influence + oscillation + noise
    # Occasionally drift more to create interesting anomalies
print(f"  Created {len(zone_sp_cols)} zone actual temperature columns")

# --- 2d. Hot Water Supply Temperature ---
# Physics: HWS should be 140-160°F (60-71°C). Correlates with heating load
outdoor_c = df["air_temp_set_1"]
# Colder outside = harder boiler works = slight temp drop risk
base_hws = 148.0  # ~64°C
outdoor_effect = -(10 - outdoor_c) * 0.3  # colder outside = slightly lower
noise = np.random.normal(0, 1.5, len(df))
df["hp_hws_temp"] = base_hws + outdoor_effect + noise

# Inject a legionella risk event: days 15-17 boiler underperforms
legionella_window = (
    (df.index.day >= 15)
    & (df.index.day <= 17)
    & (df.index.hour >= 2)
    & (df.index.hour <= 6)
)
df.loc[legionella_window, "hp_hws_temp"] -= 15  # drops to ~133°F = ~56°C = ALERT
print(f"  Created hp_hws_temp with legionella risk event on Jan 15-17")

# --- 2e. Pump Power (synthetic degradation) ---
# Start healthy at ~8kW, slowly degrade to ~11kW over the month
base_power = 8.0
degradation = np.linspace(0, 3.0, len(df))  # +3kW over month
daily_cycle = np.sin(np.arange(len(df)) * 2 * np.pi / 96) * 1.5  # daily load pattern
noise = np.random.normal(0, 0.3, len(df))
df["pump_power_kw"] = base_power + degradation + daily_cycle + noise
df["pump_power_kw"] = df["pump_power_kw"].clip(lower=2.0)  # can't go below 2kW
print(f"  Created pump_power_kw with degradation trend")

# --- 2f. Pump Vibration (synthetic run-to-failure) ---
base_vib = 2.5
degradation_vib = np.linspace(0, 5.5, len(df))  # 2.5 -> 8.0 over month
noise_vib = np.random.normal(0, 0.15, len(df))
df["pump_vibration_mms"] = base_vib + degradation_vib + noise_vib
print(
    f"  Created pump_vibration_mms (start: {df['pump_vibration_mms'].iloc[0]:.1f}, end: {df['pump_vibration_mms'].iloc[-1]:.1f})"
)

# --- 2g. Chilled Water Temps ---
df["chw_supply_temp"] = 44.0 + np.random.normal(0, 0.5, len(df))  # ~44°F supply
df["chw_return_temp"] = (
    56.0 + (df["air_temp_set_1"] - 10) * 0.2 + np.random.normal(0, 0.8, len(df))
)
print(f"  Created chilled water supply/return temps")

# ============================================================
# STEP 3: Compute derived FM metrics
# ============================================================
print("\nComputing derived metrics...")

# 3a. RTU Efficiency (flow / fan speed)
for i in ["001", "002", "003", "004"]:
    flow_col = f"rtu_{i}_fltrd_sa_flow_tn"
    speed_col = f"rtu_{i}_sf_vfd_spd_fbk_tn"
    if flow_col in df.columns and speed_col in df.columns:
        df[f"rtu_{i}_efficiency"] = df[flow_col] / (df[speed_col] + 0.1)
        print(f"  rtu_{i}_efficiency: mean={df[f'rtu_{i}_efficiency'].mean():.1f}")

# 3b. RTU Delta-T (return - supply)
for i in ["001", "002", "003", "004"]:
    sa = f"rtu_{i}_sa_temp"
    ra = f"rtu_{i}_ra_temp"
    if sa in df.columns and ra in df.columns:
        df[f"rtu_{i}_delta_t"] = df[ra] - df[sa]
        print(f"  rtu_{i}_delta_t: mean={df[f'rtu_{i}_delta_t'].mean():.1f}°F")

# 3c. Zone Comfort Gaps
comfort_count = 0
for sp_col in zone_sp_cols:
    zone_num = sp_col.replace("zone_", "").replace("_heating_sp", "")
    temp_col = f"zone_{zone_num}_temp"
    if temp_col in df.columns:
        df[f"zone_{zone_num}_comfort_gap"] = df[temp_col] - df[sp_col]
        comfort_count += 1
print(f"  Created {comfort_count} zone comfort gap columns")

# 3d. Total Building Energy
energy_cols = ["mels_s", "mels_n", "lig_s", "hvac_s", "hvac_n"]
existing_energy = [c for c in energy_cols if c in df.columns]
df["total_energy_kw"] = df[existing_energy].sum(axis=1)
df["hvac_energy_kw"] = df[["hvac_s", "hvac_n"]].sum(axis=1)
df["hvac_pct"] = df["hvac_energy_kw"] / (df["total_energy_kw"] + 0.001) * 100
print(f"  total_energy_kw: mean={df['total_energy_kw'].mean():.1f} kW")
print(f"  hvac_pct: mean={df['hvac_pct'].mean():.0f}%")

# 3e. Hot Water in Celsius + Legionella Flag
df["hw_temp_celsius"] = (df["hp_hws_temp"] - 32) * 5 / 9
df["legionella_risk"] = (df["hw_temp_celsius"] < 60).astype(int)
legionella_count = df["legionella_risk"].sum()
print(
    f"  Legionella risk alerts: {legionella_count} intervals ({legionella_count/len(df)*100:.1f}%)"
)

# 3f. Pump RUL Estimate
VIBRATION_FAILURE_THRESHOLD = 8.0
vibration_slope = np.gradient(df["pump_vibration_mms"].rolling(12).mean().bfill())
avg_slope = pd.Series(vibration_slope).rolling(48).mean().bfill()
df["pump_rul_days"] = (
    (VIBRATION_FAILURE_THRESHOLD - df["pump_vibration_mms"]) / (avg_slope * 96 + 0.001)
).clip(lower=0, upper=365)
print(
    f"  pump_rul_days: start={df['pump_rul_days'].iloc[96]:.0f}, end={df['pump_rul_days'].iloc[-1]:.1f}"
)

# 3g. Ghost Lighting Detection (lighting on during likely unoccupied hours)
# No occupancy data for Jan 2020, so use time-of-day proxy
night_hours = (df.index.hour >= 22) | (df.index.hour <= 5)
weekend = df.index.dayofweek >= 5
likely_unoccupied = night_hours | weekend
df["ghost_lighting"] = ((df["lig_s"] > 1.0) & likely_unoccupied).astype(int)
ghost_count = df["ghost_lighting"].sum()
print(f"  Ghost lighting alerts: {ghost_count}")

# 3h. Short Cycling Detection (rapid fan speed oscillation)
for i in ["001", "002", "003", "004"]:
    speed_col = f"rtu_{i}_sf_vfd_spd_fbk_tn"
    if speed_col in df.columns:
        # Standard deviation of speed over 1-hour rolling window
        df[f"rtu_{i}_speed_volatility"] = df[speed_col].rolling(4).std().fillna(0)

# ============================================================
# STEP 4: Export
# ============================================================
print(f"\nFinal shape: {df.shape}")
df.to_csv(OUTPUT_FILE)
print(f"Saved to {OUTPUT_FILE}")

# Summary
print("\n" + "=" * 60)
print("COLUMN SUMMARY")
print("=" * 60)
groups = {
    "Energy": [
        c
        for c in df.columns
        if any(
            x in c
            for x in [
                "mels",
                "lig_s",
                "hvac_n",
                "hvac_s",
                "total_energy",
                "hvac_pct",
                "hvac_energy",
            ]
        )
    ],
    "RTU Flow/Speed": [
        c
        for c in df.columns
        if "fltrd_sa_flow" in c or ("vfd_spd" in c and "volatility" not in c)
    ],
    "RTU Temps (synth)": [
        c
        for c in df.columns
        if any(
            c == f"rtu_{i}_{t}"
            for i in ["001", "002", "003", "004"]
            for t in ["sa_temp", "ra_temp"]
        )
    ],
    "RTU Derived": [
        c
        for c in df.columns
        if "efficiency" in c or "delta_t" in c or "volatility" in c
    ],
    "Zone Temps (synth)": [
        c for c in df.columns if c.endswith("_temp") and c.startswith("zone_")
    ],
    "Zone Setpoints": [c for c in df.columns if "_heating_sp" in c],
    "Zone Comfort": [c for c in df.columns if "comfort_gap" in c],
    "Pump (synth)": [c for c in df.columns if "pump_" in c],
    "Hot Water (synth)": [
        c
        for c in df.columns
        if any(x in c for x in ["hp_hws", "hw_temp", "legionella"])
    ],
    "Chilled Water (synth)": [c for c in df.columns if "chw_" in c],
    "Weather (real)": [
        c
        for c in df.columns
        if any(x in c for x in ["air_temp_set", "humidity", "solar", "dew_point"])
    ],
    "Anomaly Flags": [
        c for c in df.columns if any(x in c for x in ["ghost_", "legionella_risk"])
    ],
}

total_real = 0
total_synth = 0
for name, cols in groups.items():
    if cols:
        is_synth = "(synth)" in name
        tag = "🔵 REAL" if not is_synth else "🟡 SYNTHETIC"
        print(f"  {tag} {name}: {len(cols)} cols")
        if is_synth:
            total_synth += len(cols)
        else:
            total_real += len(cols)

print(
    f"\n  Total: {df.shape[1]} columns ({total_real} real + derived, rest synthetic/setpoints)"
)
