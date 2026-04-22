import pandas as pd
import numpy as np
from langchain_core.tools import tool
from app.config import CSV_PATH, THRESHOLDS, ENERGY_RATES

# Load DataFrame into memory once
df = pd.read_csv(CSV_PATH, parse_dates=["timestamp"])
# Column aliases — maps common names to actual CSV column names
COLUMN_ALIASES = {
    "efficiency": "rtu_001_efficiency",
    "rtu-001 efficiency": "rtu_001_efficiency",
    "rtu-002 efficiency": "rtu_002_efficiency",
    "rtu-003 efficiency": "rtu_003_efficiency",
    "rtu-004 efficiency": "rtu_004_efficiency",
    "fan speed": "rtu_001_sf_vfd_spd_fbk_tn",
    "airflow": "rtu_001_fltrd_sa_flow_tn",
    "vibration": "pump_vibration_mms",
    "pump vibration": "pump_vibration_mms",
    "pump power": "pump_power_kw",
    "power": "pump_power_kw",
    "hot water": "hw_temp_celsius",
    "hot water temp": "hw_temp_celsius",
    "hw temp": "hw_temp_celsius",
    "hot_water_temp": "hw_temp_celsius",
    "energy": "total_energy_kw",
    "total energy": "total_energy_kw",
    "ghost": "ghost_lighting",
    "ghost lighting": "ghost_lighting",
    "outdoor temp": "air_temp_set_1",
    "humidity": "relative_humidity_set_1",
    "delta-t": "rtu_001_delta_t",
    "delta t": "rtu_001_delta_t",
    "comfort": "zone_016_comfort_gap",
    # RTU-1 variations
    "rtu-1 efficiency": "rtu_001_efficiency",
    "rtu1 efficiency": "rtu_001_efficiency",
    "rtu 1 efficiency": "rtu_001_efficiency",
    "rtu-1 fan speed": "rtu_001_sf_vfd_spd_fbk_tn",
    "rtu1 fan speed": "rtu_001_sf_vfd_spd_fbk_tn",
    "rtu-1 airflow": "rtu_001_fltrd_sa_flow_tn",
    "rtu-1 delta-t": "rtu_001_delta_t",
    "rtu1 delta t": "rtu_001_delta_t",
    # RTU-2
    "rtu-2 efficiency": "rtu_002_efficiency",
    "rtu2 efficiency": "rtu_002_efficiency",
    "rtu 2 efficiency": "rtu_002_efficiency",
    "rtu-2 fan speed": "rtu_002_sf_vfd_spd_fbk_tn",
    "rtu-2 airflow": "rtu_002_fltrd_sa_flow_tn",
    "rtu-2 delta-t": "rtu_002_delta_t",
    # RTU-3
    "rtu-3 efficiency": "rtu_003_efficiency",
    "rtu3 efficiency": "rtu_003_efficiency",
    "rtu 3 efficiency": "rtu_003_efficiency",
    "rtu-3 fan speed": "rtu_003_sf_vfd_spd_fbk_tn",
    "rtu-3 airflow": "rtu_003_fltrd_sa_flow_tn",
    "rtu-3 delta-t": "rtu_003_delta_t",
    # RTU-4
    "rtu-4 efficiency": "rtu_004_efficiency",
    "rtu4 efficiency": "rtu_004_efficiency",
    "rtu 4 efficiency": "rtu_004_efficiency",
    "rtu-4 fan speed": "rtu_004_sf_vfd_spd_fbk_tn",
    "rtu-4 airflow": "rtu_004_fltrd_sa_flow_tn",
    "rtu-4 delta-t": "rtu_004_delta_t",
}

def _resolve_column(metric: str) -> str:
    """Resolve a user-friendly metric name to actual CSV column."""
    if metric in df.columns:
        return metric
    
    key = metric.lower().replace("_", " ").replace("-", " ").strip()
    
    # Normalize RTU names: rtu1 -> rtu 001, rtu-2 -> rtu 002, etc.
    import re
    key = re.sub(r'rtu\s*(\d)(?!\d)', r'rtu \1', key)  # rtu1 -> rtu 1
    
    if key in COLUMN_ALIASES:
        return COLUMN_ALIASES[key]
    
    # Try with underscores for direct column match
    underscore_key = metric.lower().replace("-", "_").replace(" ", "_")
    # Convert rtu_1_ to rtu_001_
    underscore_key = re.sub(r'rtu_(\d)_', r'rtu_00\1_', underscore_key)
    if underscore_key in df.columns:
        return underscore_key
    
    # Fuzzy match
    matches = [c for c in df.columns if metric.lower().replace("-", "_") in c.lower()]
    if matches:
        return matches[0]
    
    return metric

@tool
def query_sensor_data(metric: str, limit: int = 20) -> str:
    """Query a sensor metric. Returns stats and recent values.
    Use this to get raw numbers for pump vibration, hot water temp, RTU efficiency, or energy."""
    col = _resolve_column(metric)
    if col not in df.columns:
        return f"Column '{metric}' not found. Try: pump_vibration_mms, hw_temp_celsius, rtu_001_efficiency, total_energy_kw, ghost_lighting, rtu_001_delta_t"

    subset = df[["timestamp", col]].dropna().tail(limit)
    vals = subset[col].values
    if len(vals) == 0:
        return f"No data for {col}"
    return (
        f"Metric: {col}\n"
        f"Timestamp: {subset['timestamp'].iloc[-1]}\n"
        f"Current: {vals[-1]:.2f}\n"
        f"Mean: {np.mean(vals):.2f} | Min: {np.min(vals):.2f} | Max: {np.max(vals):.2f}\n"
        f"Last 5: {', '.join(f'{v:.2f}' for v in vals[-5:])}"
    )

@tool
def get_trend_analysis(metric: str, window_days: int = 7) -> str:
    """Analyse trend and predict future values for a metric."""
    col = _resolve_column(metric)
    if col not in df.columns:
        return f"Column '{metric}' not found. Try: pump_vibration_mms, hw_temp_celsius, rtu_001_efficiency"
    metric = col
    matches = [c for c in df.columns if metric.lower() in c.lower()]
    if not matches: return f"Column '{metric}' not found."
    metric = matches[0]

    subset = df[["timestamp", metric]].dropna().tail(window_days * 96)
    vals = subset[metric].values
    if len(vals) < 10: return "Not enough data."

    x = np.arange(len(vals))
    slope, _ = np.polyfit(x, vals, 1)
    daily_change = slope * 96

    return (
        f"Trend for {metric} (last {window_days} days):\n"
        f"Current: {vals[-1]:.2f} | Daily change: {daily_change:+.3f}/day\n"
        f"Predicted 7 days: {vals[-1] + daily_change * 7:.2f}\n"
        f"Predicted 30 days: {vals[-1] + daily_change * 30:.2f}"
    )

@tool
def get_energy_rates() -> str:
    """Get energy pricing for cost calculations and optimisation."""
    return "\n".join(f"{k}: {v}" for k, v in ENERGY_RATES.items())