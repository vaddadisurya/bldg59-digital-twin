## Building 59 Overview

Building 59 is a 10,400 sqm commercial office at Lawrence Berkeley National Laboratory, Berkeley, California. Built 2015. Two storey steel frame. BMS: Automated Logic WebCTRL with 300+ sensors. Data covers January 2020 at 15 minute intervals. 2,976 rows, 178 columns after enrichment.

## HVAC System and RTU Zone Mapping

4 Rooftop Units (RTUs), each 20,000 CFM design capacity. Underfloor air distribution (UFAD).

RTU-001 serves North Wing zones: 36, 37, 38, 39, 40, 41, 42, 64, 65, 66, 67, 68, 69, 70.
RTU-002 serves North Wing zones: 19, 27, 28, 29, 30, 31, 32, 33, 34, 35, 43, 44, 49, 50, 57, 58, 59, 60, 62, 63.
RTU-003 serves South Wing zones: 18, 25, 26, 45, 48, 55, 56, 61.
RTU-004 serves South Wing zones: 16, 17, 21, 22, 23, 24, 46, 47, 51, 52, 53, 54.

Each RTU has: supply fan speed (rtu_XXX_sf_vfd_spd_fbk_tn, percent), return fan speed (rtu_XXX_rf_vfd_spd_fbk_tn, percent), supply airflow (rtu_XXX_fltrd_sa_flow_tn, CFM).

## RTU Performance Formulas

Efficiency = airflow_cfm divided by fan_speed_pct. Healthy range: 170 to 190. Below 150 indicates filter blockage, belt slip, or duct leak.

Delta-T = return_air_temp minus supply_air_temp. Healthy: 14 to 17 degrees F. Below 10F means RTU is running fans but not effectively heating or cooling.

Speed Volatility = rolling standard deviation of fan speed over 2 hour window. Normal: below 2.0. Warning: 2.0 to 5.0. Critical: above 5.0 (severe short cycling).

## OEE Calculation for HVAC

OEE = (Availability times Performance times Quality) divided by 10000, expressed as percent.

Availability: 100 percent if supply fan speed is above 10 percent. Zero if fan speed below 10 percent (unit offline).
Performance: (airflow divided by 20000) times 100. This is actual flow as percentage of design capacity.
Quality: 100 percent if comfort gap is within plus or minus 2 degrees F. 50 percent if outside that band.

Example: Fan at 80 percent speed, airflow 15000 CFM, comfort gap 1.5F. Availability=100, Performance=75, Quality=100. OEE = (100 x 75 x 100) / 10000 = 75 percent.

## What-If Scenarios for HVAC

When fan speed changes, airflow changes proportionally: new_airflow = current_airflow times (new_speed divided by current_speed).

Example: If current fan speed is 80 percent with 15000 CFM airflow, and fan speed drops to 40 percent:
New airflow = 15000 times (40 / 80) = 7500 CFM.
New efficiency = 7500 / 40 = 187.5.
New performance = (7500 / 20000) times 100 = 37.5 percent.
New OEE = (100 x 37.5 x 100) / 10000 = 37.5 percent.
Comfort gap will widen because less conditioned air reaches the zones.

When an RTU is turned off (fan speed goes to 0), all zones served by that RTU lose conditioned air. For RTU-003, zones 18, 25, 26, 45, 48, 55, 56, 61 would lose conditioning. Airflow drops to zero. OEE becomes 0 percent.

## Pump System

Asset: HWP-01, Primary Hot Water Pump. Location: Basement Mechanical Room.

Key columns: pump_vibration_mms (bearing vibration in mm/s), pump_power_kw (motor power in kW), hw_temp_celsius (hot water temperature in Celsius), pump_rul_days (remaining useful life in days).

The pump has SYNTHESISED LINEAR DEGRADATION: vibration increases from 2.5 to 8.0 mm/s over the month. Power increases from 8.0 to 12.5 kW. These are correlated: as bearings wear, vibration increases AND the motor draws more power.

## Pump Vibration Thresholds (ISO 10816)

Below 4.5 mm/s: acceptable. 4.5 to 7.0 mm/s: WARNING. Above 7.0 mm/s: CRITICAL. Above 8.0 mm/s: SHUTDOWN required.

## Pump Formulas

RUL = (8.0 minus current_vibration) divided by daily_degradation_rate. Use get_trend_analysis to get the actual daily rate, do not assume a fixed value.

Pump OEE = 100 minus (max(0, vibration minus 2.5) times 12).
MTBF = 6000 minus (vibration times 500) hours.
MTTR = 2.5 plus (vibration times 0.3) hours.

## Hot Water and Legionella Compliance

Column name: hw_temp_celsius. This is the hot water temperature. NOT dew_point_temperature which is an outdoor weather metric.

HSG274 Part 2: hot water must be above 60 degrees Celsius to prevent Legionella. Normal range: 64 to 66 degrees C. Below 60C = LEGIONELLA RISK.

KNOWN ANOMALY: January 15 to 17, hot water drops below 60C (boiler underperformance event).

Cross-system link: pump degradation reduces flow, which can cause hot water temperature to drop toward legionella risk.

If hot water setpoint is lowered to 55C, it will be below the 60C HSG274 threshold. Legionella bacteria colonise within 48 to 72 hours at 20 to 45C.

## Electrical System and Ghost Lighting

Panels: mels_s (plugs south kW), mels_n (plugs north kW), lig_s (lighting south kW), hvac_s (HVAC south kW), hvac_n (HVAC north kW).

total_energy_kw = sum of all 5 panels. hvac_pct = HVAC share of total as percentage.

Ghost lighting column: ghost_lighting (binary 0 or 1). Triggered when lig_s above 0.5 kW between 22:00 and 05:00.

Ghost lighting cost: count intervals where ghost_lighting=1, multiply by 0.25 hours, multiply by average lig_s, multiply by energy rate. Example: 6 hours at 0.8 kW at $0.22/kWh = $1.06/day or about $32/month.

## Zone Comfort

41 zones with comfort gaps (zone_XXX_comfort_gap = actual temp minus setpoint). CIBSE Guide A: must be within plus or minus 2F. Outside = uncomfortable.

## Energy Rates and Cost Calculations

California commercial: $0.22/kWh. UK commercial: £0.28/kWh. UK industrial: £0.21/kWh.

Daily cost = total_energy_kw times 24 times rate. Pump waste cost = (current_power minus 8.0 baseline) times 24 times rate.

## Column Name Reference

pump_vibration_mms, pump_power_kw, hw_temp_celsius, total_energy_kw, ghost_lighting, rtu_001_sf_vfd_spd_fbk_tn, rtu_001_efficiency, rtu_001_delta_t, rtu_001_fltrd_sa_flow_tn, zone_016_comfort_gap, air_temp_set_1, relative_humidity_set_1. Replace 001 with 002/003/004 for other RTUs.

## Cross-System Correlations

Vibration up AND power up = bearing degradation. Pump degradation AND hot water dropping = reduced flow. Hot water below 60C AND vibration above 7.0 = failure cascade. Ghost lighting AND higher overnight HVAC = lights add heat load. RTU volatility high AND comfort gaps widening = control instability.

## Tool Usage and Column Names

The AI has 4 tools: query_sensor_data, get_trend_analysis, get_energy_rates, search_knowledge.

For query_sensor_data, use these EXACT column names:
- Pump vibration: pump_vibration_mms
- Pump power: pump_power_kw  
- Hot water temperature: hw_temp_celsius (NOT hot_water_temp, NOT dew_point)
- RTU-001 efficiency: rtu_001_efficiency
- RTU-001 fan speed: rtu_001_sf_vfd_spd_fbk_tn
- RTU-001 airflow: rtu_001_fltrd_sa_flow_tn
- RTU-001 delta-T: rtu_001_delta_t
- Total energy: total_energy_kw
- Ghost lighting: ghost_lighting
- Zone comfort gap: zone_016_comfort_gap (replace 016 with zone number)
- Outdoor temperature: air_temp_set_1

For what-if calculations, get the current values using query_sensor_data first, then calculate the result mathematically in the response. Do not look for calculation tools — they do not exist.