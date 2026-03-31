import pandas as pd
import json
import time
import os
import random
from dotenv import load_dotenv
from azure.iot.device import IoTHubDeviceClient, Message

# 1. Load Secure Keys
load_dotenv()
CONNECTION_STRING = os.environ.get("AZURE_CONNECTION_STRING")
CSV_FILE = 'bldg59_digital_twin_jan2020.csv'

def run_telemetry_simulator():
    print("Initializing Enterprise Multi-Sector Gateway...")
    
    # 2. Connect to Azure
    try:
        client = IoTHubDeviceClient.create_from_connection_string(CONNECTION_STRING)
        client.connect()
        print("✅ Connected securely to Azure IoT Hub!")
    except Exception as e:
        print(f"❌ Connection failed. Check your .env file! Error: {e}")
        return

    # 3. Load Data
    print(f"Loading telemetry from {CSV_FILE}...")
    try:
        df = pd.read_csv(CSV_FILE).fillna(0)
    except FileNotFoundError:
        print(f"❌ Could not find {CSV_FILE}. Make sure the name matches exactly.")
        return
    
    # Baseline for Predictive Maintenance (Starts healthy, degrades over time)
    pump_vibration = 2.5 
    
    print("🚀 Starting Live Stream... (Press Ctrl+C to stop)")
    
    try:
        while True: # Loop forever so the dashboard never goes dark
            for index, row in df.iterrows():
                timestamp = str(row['timestamp'])
                
                # ==========================================
                # SECTOR 1: HVAC (Air Handling & Comfort)
                # ==========================================
                # Safely get flow and speed, with realistic fallbacks if 0
                flow = row.get('rtu_sa_fr', row.get('rtu_001_fltrd_sa_flow_tn', random.uniform(400, 600)))
                speed = row.get('rtu_fan_spd', row.get('rtu_001_sf_vfd_spd_fbk_tn', random.uniform(40, 60)))
                
                # Prevent division by zero
                speed = speed if speed > 0 else 1.0 
                
                # Comfort Metrics
                temp = row.get('zone_temp_exterior', random.uniform(68, 72))
                sp = row.get('zone_016_heating_sp', 70.0)
                
                hvac_payload = {
                    "timestamp": timestamp,
                    "building_id": "bldg-59-berkeley",
                    "sector": "HVAC",
                    "asset_id": "RTU-001",
                    "metrics": {
                        "efficiency_index": round((flow / speed) / 100, 2),
                        "supply_air_flow": round(flow, 2),
                        "fan_speed_pct": round(speed, 2),
                        "comfort_deviation": round(abs(temp - sp), 2),
                        "status": "Running"
                    }
                }

                # ==========================================
                # SECTOR 2: PUMPS / PLANT (Predictive Maint.)
                # ==========================================
                # Synthetically degrade the pump vibration over time
                pump_vibration += (0.005) + random.uniform(-0.1, 0.1) 
                
                pump_status = "Warning" if pump_vibration > 6.0 else "Running"
                if pump_vibration > 8.0: pump_status = "Fault"
                
                pump_power = row.get('hwp_power_kw', random.uniform(5.0, 12.0))
                
                pump_payload = {
                    "timestamp": timestamp,
                    "building_id": "bldg-59-berkeley",
                    "sector": "Pumps",
                    "asset_id": "HWP-01",
                    "metrics": {
                        "pump_power_kw": round(pump_power, 2),
                        "vibration_mms": round(pump_vibration, 2),
                        "estimated_rul_days": round(max(0, (8.0 - pump_vibration) / (0.005 * 96)), 1),
                        "status": pump_status
                    }
                }

                # ==========================================
                # SECTOR 3: ELECTRICAL & LIGHTING
                # ==========================================
                lighting_power = row.get('lig_s', random.uniform(1, 3)) + row.get('lig_n', random.uniform(1, 3))
                plug_power = row.get('mels_s', random.uniform(2, 4)) + row.get('mels_n', random.uniform(2, 4))
                
                # Ghost Lighting Anomaly Logic
                occ = row.get('occ', random.choice([0, 1]))
                ghost_lighting = 1 if (occ == 0 and lighting_power > 2.0) else 0

                elec_payload = {
                    "timestamp": timestamp,
                    "building_id": "bldg-59-berkeley",
                    "sector": "Lighting_Power",
                    "asset_id": "Floor-1-Electrical",
                    "metrics": {
                        "total_lighting_kw": round(lighting_power, 2),
                        "total_plug_kw": round(plug_power, 2),
                        "ghost_lighting_alert": ghost_lighting,
                        "status": "Warning" if ghost_lighting else "Normal"
                    }
                }

                # --- SEND ALL THREE PAYLOADS TO AZURE ---
                for p in [hvac_payload, pump_payload, elec_payload]:
                    msg = Message(json.dumps(p))
                    msg.content_encoding = "utf-8"
                    msg.content_type = "application/json"
                    client.send_message(msg)
                
                print(f"[{timestamp}] Sent 3 Sectors | HVAC Eff: {hvac_payload['metrics']['efficiency_index']} | Vib: {pump_payload['metrics']['vibration_mms']} | Ghost Light: {elec_payload['metrics']['ghost_lighting_alert']}")
                
                time.sleep(1) # Wait 1 second before next 15-min interval
                
            print("🔄 Reached end of month. Looping back to beginning to keep data flowing...")
            # Reset degradation so it loops cleanly
            pump_vibration = 2.5 
            
    except KeyboardInterrupt:
        print("\n🛑 Gateway Stopped.")
    finally:
        client.disconnect()

if __name__ == "__main__":
    run_telemetry_simulator()