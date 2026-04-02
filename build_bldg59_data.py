import pandas as pd
import numpy as np
import os
from sklearn.impute import KNNImputer

# --- CONFIGURATION ---
DATA_DIR = "/workspaces/codespaces-blank/Bldg59_clean data/"
OUTPUT_FILE = "bldg59_digital_twin_jan2020.csv"

# Mapping files to their roles
TARGET_FILES = {
    "ele": "ele.csv",
    "hvac_flow": "rtu_sa_fr.csv",
    "hvac_spd": "rtu_fan_spd.csv",
    "zone_temp": "zone_temp_exterior.csv",
    "zone_sp": "zone_temp_sp_h.csv",
    "weather": "site_weather.csv",
    "occ": "occ.csv",
    "pump_hw": "hp_hws_temp.csv",
}


def load_and_filter(filename):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        print(f"Skipping: {filename} (not found)")
        return pd.DataFrame()

    # Read and clean headers immediately
    df = pd.read_csv(filepath)
    df.columns = df.columns.str.strip().str.lower()

    # Identify the time column ('date', 'timestamp', or 'time')
    possible_time_cols = ["date", "timestamp", "time"]
    time_col = next((c for c in possible_time_cols if c in df.columns), None)

    if not time_col:
        print(f"Error: No time column in {filename}")
        return pd.DataFrame()

    # Convert to datetime and set as index
    df[time_col] = pd.to_datetime(df[time_col])
    df = df.set_index(time_col)
    df.index.name = "timestamp"  # Keep index name consistent for merging

    # Filter for Jan 2020
    try:
        return df.loc["2020-01-01":"2020-01-31"]
    except KeyError:
        return pd.DataFrame()


# --- 1. EXTRACTION & MERGE ---
print("Merging January 2020 data streams...")
df_list = [load_and_filter(f) for f in TARGET_FILES.values()]
master_df = pd.concat(df_list, axis=1, sort=True)

# THE FIX: Drop duplicate columns created by merging multiple files
master_df = master_df.loc[:, ~master_df.columns.duplicated()]

# --- 2. MEMORY OPTIMIZATION ---
print("Downsampling to 15-minute intervals to save memory...")
master_df = master_df.resample("15min").mean()

# --- 3. CLEANING (Agile Sprint Plan) ---
print("Cleaning data (Interpolation & Outlier Removal)...")

# Outlier Removal: Temperatures must be between 0 and 50 Celsius
temp_cols = [
    c for c in master_df.columns if "temp" in c or "rtu_oa_t" in c or "t_c" in c
]
for col in temp_cols:
    master_df.loc[(master_df[col] < 0) | (master_df[col] > 50), col] = np.nan

# Interpolation (Connect-the-dots for small gaps)
master_df = master_df.interpolate(method="linear", limit=2)

# THE FIX: Drop any sensors that are 100% dead/empty in January 2020
# This prevents the KNN Imputer from silently deleting columns and breaking the shape
master_df = master_df.dropna(axis=1, how="all")

# KNN Imputation
print("Running KNN Imputer (Optimized)...")
imputer = KNNImputer(n_neighbors=5)
numeric_df = master_df.select_dtypes(include=[np.number])

if numeric_df.isnull().sum().sum() > 0:
    imputed_values = imputer.fit_transform(numeric_df)
    # Safely overwrite the old data
    clean_numeric_df = pd.DataFrame(
        imputed_values, index=numeric_df.index, columns=numeric_df.columns
    )
    master_df.update(clean_numeric_df)
else:
    print("No missing values found after interpolation!")
# --- 4. METRIC GENERATION ---
print("Generating BLDG59-specific metrics (OEE & Anomaly)...")

# HVAC Efficiency Metric
if "rtu_sa_fr" in master_df.columns and "rtu_fan_spd" in master_df.columns:
    master_df["hvac_efficiency_index"] = master_df["rtu_sa_fr"] / (
        master_df["rtu_fan_spd"] + 0.1
    )

# Comfort Compliance (OEE 'Quality' metric)
if "zone_temp_exterior" in master_df.columns and "zone_temp_sp_h" in master_df.columns:
    master_df["comfort_gap"] = abs(
        master_df["zone_temp_exterior"] - master_df["zone_temp_sp_h"]
    )
    # Score is 100 if within 2 degrees of setpoint, otherwise 50
    master_df["comfort_oee_score"] = np.where(master_df["comfort_gap"] < 2.0, 100, 50)

# --- 5. EXPORT ---
master_df.to_csv(OUTPUT_FILE)
print(f"Success! Final file saved as {OUTPUT_FILE} with {len(master_df)} records.")
