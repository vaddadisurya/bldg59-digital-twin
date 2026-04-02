"""
Created by Suryaprakasarao Vaddadi
BLDG59 DIGITAL TWIN — EDGE SIMULATOR v2
========================================
Streams enriched building telemetry to Azure IoT Hub.
Reads bldg59_digital_twin_jan2020_enriched.csv and sends
4 sector payloads per timestamp: HVAC, Pumps, Electrical, Compliance.

Uses REAL column names from the enriched dataset.
Synthetic degradation is already baked into the enriched CSV
(pump vibration, energy creep, legionella events).

Usage:
  python digital_twin_simulator.py

Requires:
  pip install pandas azure-iot-device python-dotenv
"""

import pandas as pd
import json
import time
import os
import sys
from dotenv import load_dotenv
from azure.iot.device import IoTHubDeviceClient, Message

# ============================================================
# CONFIGURATION
# ============================================================
load_dotenv()
CONNECTION_STRING = os.environ.get("AZURE_CONNECTION_STRING")
CSV_FILE = 'bldg59_digital_twin_jan2020_enriched.csv'
SEND_INTERVAL = 30  # seconds between messages (1s = ~50min to replay full month)
BUILDING_ID = "bldg-59-berkeley"
SITE_ID = "SITE-BERKELEY-BLDG59"


def build_hvac_payload(row, timestamp):
    """SECTOR 1: HVAC & Air Handling — uses REAL RTU data."""
    
    # RTU-001 metrics (real columns from dataset)
    flow_001 = row.get('rtu_001_fltrd_sa_flow_tn', 0)
    sf_speed_001 = row.get('rtu_001_sf_vfd_spd_fbk_tn', 0)
    rf_speed_001 = row.get('rtu_001_rf_vfd_spd_fbk_tn', 0)
    sa_temp_001 = row.get('rtu_001_sa_temp', 0)
    ra_temp_001 = row.get('rtu_001_ra_temp', 0)
    efficiency_001 = row.get('rtu_001_efficiency', 0)
    delta_t_001 = row.get('rtu_001_delta_t', 0)
    volatility_001 = row.get('rtu_001_speed_volatility', 0)
    
    # Zone comfort (pick a representative zone)
    zone_temp = row.get('zone_016_temp', 70)
    zone_sp = row.get('zone_016_heating_sp', 70)
    comfort_gap = row.get('zone_016_comfort_gap', 0)
    
    # Outdoor conditions (real)
    outdoor_temp_c = row.get('air_temp_set_1', 10)
    humidity = row.get('relative_humidity_set_1', 50)
    solar = row.get('solar_radiation_set_1', 0)
    
    # OEE Calculation for HVAC
    # Availability: assume running if fan speed > 10%
    availability = 1.0 if sf_speed_001 > 10 else 0.0
    # Performance: actual flow vs design flow (20,000 CFM)
    performance = min(flow_001 / 20000.0, 1.0) if flow_001 > 0 else 0.0
    # Quality: comfort within 2°F deadband
    quality = 1.0 if abs(comfort_gap) < 2.0 else 0.5
    oee = round(availability * performance * quality * 100, 1)
    
    # Status logic
    if sf_speed_001 < 10:
        status = "Offline"
    elif abs(comfort_gap) > 3.0 or volatility_001 > 5.0:
        status = "Warning"
    else:
        status = "Running"
    
    return {
        "timestamp": timestamp,
        "building_id": BUILDING_ID,
        "site_id": SITE_ID,
        "sector": "HVAC",
        "asset_id": "RTU-001",
        "asset_name": "Rooftop Unit 1 (South Wing)",
        "location": "Roof Deck - South",
        "metrics": {
            "supply_air_flow_cfm": round(flow_001, 1),
            "supply_fan_speed_pct": round(sf_speed_001, 1),
            "return_fan_speed_pct": round(rf_speed_001, 1),
            "supply_air_temp_f": round(sa_temp_001, 1),
            "return_air_temp_f": round(ra_temp_001, 1),
            "delta_t_f": round(delta_t_001, 1),
            "efficiency_index": round(efficiency_001, 1),
            "speed_volatility": round(volatility_001, 2),
            "zone_temp_f": round(zone_temp, 1),
            "zone_setpoint_f": round(zone_sp, 1),
            "comfort_gap_f": round(comfort_gap, 1),
            "outdoor_temp_c": round(outdoor_temp_c, 1),
            "outdoor_humidity_pct": round(humidity, 1),
            "solar_radiation_wm2": round(solar, 1),
            "oee_pct": oee,
            "availability": round(availability * 100, 1),
            "performance": round(performance * 100, 1),
            "quality": round(quality * 100, 1),
            "status": status
        }
    }


def build_hvac_rtu_summary(row, timestamp):
    """SECTOR 1b: All 4 RTUs summary for dashboard overview."""
    rtus = []
    for i in ['001', '002', '003', '004']:
        flow = row.get(f'rtu_{i}_fltrd_sa_flow_tn', 0)
        sf_speed = row.get(f'rtu_{i}_sf_vfd_spd_fbk_tn', 0)
        rf_speed = row.get(f'rtu_{i}_rf_vfd_spd_fbk_tn', 0)
        eff = row.get(f'rtu_{i}_efficiency', 0)
        delta_t = row.get(f'rtu_{i}_delta_t', 0)
        
        rtus.append({
            "asset_id": f"RTU-{i}",
            "flow_cfm": round(flow, 0),
            "sf_speed_pct": round(sf_speed, 1),
            "rf_speed_pct": round(rf_speed, 1),
            "efficiency": round(eff, 1),
            "delta_t_f": round(delta_t, 1),
            "status": "Running" if sf_speed > 10 else "Offline"
        })
    
    return {
        "timestamp": timestamp,
        "building_id": BUILDING_ID,
        "sector": "HVAC_Summary",
        "rtus": rtus
    }


def build_pump_payload(row, timestamp):
    """SECTOR 2: Pumps & Plant — synthetic degradation from enriched CSV."""
    
    pump_power = row.get('pump_power_kw', 8.0)
    vibration = row.get('pump_vibration_mms', 2.5)
    rul_days = row.get('pump_rul_days', 999)
    
    # Hot water system
    hw_temp_f = row.get('hp_hws_temp', 148)
    hw_temp_c = row.get('hw_temp_celsius', 64)
    legionella = int(row.get('legionella_risk', 0))
    
    # Chilled water
    chw_supply = row.get('chw_supply_temp', 44)
    chw_return = row.get('chw_return_temp', 56)
    chw_delta_t = chw_return - chw_supply
    
    # Pump status based on vibration thresholds (ISO 10816)
    if vibration > 7.0:
        pump_status = "Critical"
    elif vibration > 4.5:
        pump_status = "Warning"
    else:
        pump_status = "Running"
    
    # Pump OEE
    availability = 1.0  # pump always running in this dataset
    performance = max(0, min(1.0, 1.0 - (pump_power - 8.0) / 8.0))  # degrades as power increases
    quality = 1.0 if vibration < 4.5 else (0.5 if vibration < 7.0 else 0.0)
    oee = round(availability * performance * quality * 100, 1)
    
    # MTBF / MTTR estimates
    mtbf_hours = max(500, 6000 - (vibration * 500))  # decreases as vibration increases
    mttr_hours = 2.5 + (vibration * 0.3)  # repair takes longer as condition worsens
    
    return {
        "timestamp": timestamp,
        "building_id": BUILDING_ID,
        "site_id": SITE_ID,
        "sector": "Pumps",
        "asset_id": "HWP-01",
        "asset_name": "Primary Hot Water Pump",
        "location": "Basement Mechanical Room",
        "metrics": {
            "pump_power_kw": round(pump_power, 2),
            "vibration_mms": round(vibration, 2),
            "estimated_rul_days": round(max(0, rul_days), 1) if not pd.isna(rul_days) else round(max(0, (8.0 - vibration) / 0.18), 1),
            "hw_supply_temp_f": round(hw_temp_f, 1),
            "hw_supply_temp_c": round(hw_temp_c, 1),
            "legionella_risk": legionella,
            "chw_supply_temp_f": round(chw_supply, 1),
            "chw_return_temp_f": round(chw_return, 1),
            "chw_delta_t_f": round(chw_delta_t, 1),
            "oee_pct": oee,
            "availability_pct": round(availability * 100, 1),
            "performance_pct": round(performance * 100, 1),
            "quality_pct": round(quality * 100, 1),
            "mtbf_hours": round(mtbf_hours, 0),
            "mttr_hours": round(mttr_hours, 1),
            "status": pump_status
        }
    }


def build_electrical_payload(row, timestamp):
    """SECTOR 3: Electrical & Lighting — real energy data."""
    
    mels_s = row.get('mels_s', 0)
    mels_n = row.get('mels_n', 0)
    lig_s = row.get('lig_s', 0)
    hvac_s = row.get('hvac_s', 0)
    hvac_n = row.get('hvac_n', 0)
    total_energy = row.get('total_energy_kw', 0)
    hvac_pct = row.get('hvac_pct', 0)
    ghost = int(row.get('ghost_lighting', 0))
    
    return {
        "timestamp": timestamp,
        "building_id": BUILDING_ID,
        "site_id": SITE_ID,
        "sector": "Electrical",
        "asset_id": "ELEC-MAIN",
        "asset_name": "Main Electrical Distribution",
        "location": "Ground Floor Electrical Room",
        "metrics": {
            "total_building_kw": round(total_energy, 2),
            "hvac_south_kw": round(hvac_s, 2),
            "hvac_north_kw": round(hvac_n, 2),
            "lighting_south_kw": round(lig_s, 2),
            "mels_south_kw": round(mels_s, 2),
            "mels_north_kw": round(mels_n, 2),
            "hvac_pct_of_total": round(hvac_pct, 1),
            "ghost_lighting_alert": ghost,
            "status": "Warning" if ghost else "Normal"
        }
    }


def build_compliance_payload(row, timestamp):
    """SECTOR 4: Compliance & Safety — legionella, comfort, energy."""
    
    hw_temp_c = row.get('hw_temp_celsius', 64)
    legionella = int(row.get('legionella_risk', 0))
    comfort_gap = row.get('zone_016_comfort_gap', 0)
    ghost = int(row.get('ghost_lighting', 0))
    vibration = row.get('pump_vibration_mms', 2.5)
    
    # Overall compliance score
    checks = {
        "legionella_hw_above_60c": not legionella,
        "comfort_within_2f": abs(comfort_gap) < 2.0,
        "no_ghost_lighting": not ghost,
        "pump_vibration_safe": vibration < 7.0,
    }
    passed = sum(checks.values())
    total = len(checks)
    
    if passed == total:
        overall = "GREEN"
    elif passed >= total - 1:
        overall = "AMBER"
    else:
        overall = "RED"
    
    return {
        "timestamp": timestamp,
        "building_id": BUILDING_ID,
        "site_id": SITE_ID,
        "sector": "Compliance",
        "metrics": {
            "hw_temp_celsius": round(hw_temp_c, 1),
            "legionella_compliant": not legionella,
            "comfort_compliant": abs(comfort_gap) < 2.0,
            "energy_compliant": not ghost,
            "equipment_safe": vibration < 7.0,
            "checks_passed": passed,
            "checks_total": total,
            "overall_status": overall
        }
    }


def run_simulator():
    """Main loop: connect to Azure, stream telemetry."""
    
    print("=" * 60)
    print("BLDG59 DIGITAL TWIN — EDGE SIMULATOR v2")
    print("=" * 60)
    
    if not CONNECTION_STRING:
        print("ERROR: AZURE_CONNECTION_STRING not found in .env")
        print("Create a .env file with: AZURE_CONNECTION_STRING=HostName=...")
        sys.exit(1)
    
    # Load data
    print(f"\nLoading {CSV_FILE}...")
    try:
        df = pd.read_csv(CSV_FILE)
    except FileNotFoundError:
        print(f"ERROR: {CSV_FILE} not found. Run enrich_bldg59_data.py first.")
        sys.exit(1)
    
    print(f"  {len(df)} rows, {df.shape[1]} columns")
    print(f"  Date range: {df['timestamp'].iloc[0]} to {df['timestamp'].iloc[-1]}")
    
    # Connect to Azure
    print(f"\nConnecting to Azure IoT Hub...")
    try:
        client = IoTHubDeviceClient.create_from_connection_string(CONNECTION_STRING, websockets=True)
        client.connect()
        print("  Connected!")
    except Exception as e:
        print(f"  FAILED: {e}")
        sys.exit(1)
    
    print(f"\nStreaming {len(df)} intervals (1 msg/sec = ~{len(df)//60} min total)")
    print("Press Ctrl+C to stop\n")
    
    msg_count = 0
    
    try:
        while True:
            for idx, row in df.iterrows():
                timestamp = str(row.get('timestamp', ''))
                
                # Build all 4 sector payloads
                payloads = [
                    build_hvac_payload(row, timestamp),
                    build_pump_payload(row, timestamp),
                    build_electrical_payload(row, timestamp),
                    build_compliance_payload(row, timestamp),
                ]
                
                # Send each payload
                for payload in payloads:
                    msg = Message(json.dumps(payload))
                    msg.content_encoding = "utf-8"
                    msg.content_type = "application/json"
                    msg.custom_properties["sector"] = payload.get("sector", "unknown")
                    client.send_message(msg)
                
                msg_count += len(payloads)
                
                # Status line
                hvac_m = payloads[0]['metrics']
                pump_m = payloads[1]['metrics']
                comp_m = payloads[3]['metrics']
                
                print(
                    f"[{timestamp}] "
                    f"HVAC OEE:{hvac_m['oee_pct']}% "
                    f"| Pump Vib:{pump_m['vibration_mms']}mm/s "
                    f"| HW:{pump_m['hw_supply_temp_c']}°C "
                    f"| Compliance:{comp_m['overall_status']} "
                    f"| Msgs:{msg_count}"
                )
                
                time.sleep(SEND_INTERVAL)
            
            print(f"\n{'='*60}")
            print(f"Month complete ({msg_count} messages sent). Looping...")
            print(f"{'='*60}\n")
            
    except KeyboardInterrupt:
        print(f"\n\nStopped. Total messages sent: {msg_count}")
    finally:
        client.disconnect()
        print("Disconnected from Azure IoT Hub.")


if __name__ == "__main__":
    run_simulator()