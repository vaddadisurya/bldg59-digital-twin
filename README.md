# Building 59 Digital Twin — Predictive Maintenance Platform

A full stack IoT Digital Twin proof of concept for commercial building asset monitoring, predictive maintenance, and facilities management analytics. Built using real sensor data from the Lawrence Berkeley National Laboratory Building 59 dataset, with an Azure cloud backend and a React dashboard.

Live Dashboard: `https://vaddadisurya.github.io/bldg59-digital-twin/`

## What This Project Does

This platform transforms raw building sensor telemetry into actionable maintenance intelligence. It monitors four critical operational domains of a commercial office building: HVAC air handling systems, pumps and hot water plant, electrical distribution and lighting, and regulatory compliance. The system detects equipment degradation before failure, tracks energy waste, monitors legionella risk in hot water systems, and calculates real time OEE, MTBF, MTTR, and Remaining Useful Life for each asset.

The dashboard has two modes. In replay mode, it steps through a month of historical building data with playback controls, showing how metrics evolve over time. In live mode, it connects directly to Azure Blob Storage and displays processed telemetry from the cloud pipeline in near real time.

## Architecture

```
Enriched CSV ──▶ Python Edge Simulator (Docker/ACI)
                        │
                        ▼
                 Azure IoT Hub (F1)
                        │
                        ▼
              Azure Stream Analytics
              (15-min tumbling windows)
                        │
                ┌───────┼───────┐───────┐
                ▼       ▼       ▼       ▼
            Blob:    Blob:    Blob:    Blob:
            HVAC     Pumps    Elec     Compliance
                        │
                        ▼
              React Dashboard (GitHub Pages)
              ├── Replay Mode (local JSON)
              └── Live Mode (Azure Blob fetch)
```

### Azure Services Used

| Service | Purpose |
|---------|---------|
| IoT Hub (F1 Free) | Secure MQTT ingestion from edge simulator |
| Stream Analytics | Real time SQL aggregation with 15 minute tumbling windows |
| Blob Storage | Sector specific JSON containers for processed telemetry |
| Container Registry | Docker image hosting for the simulator |
| Container Instances | Serverless execution of the simulator in Azure cloud |

## The Dataset

This project uses the Berkeley Building 59 three year operational dataset published by Luo et al. (2022) in Nature Scientific Data. The building is a 10,400 m² steel framed office building at Lawrence Berkeley National Laboratory in Berkeley, California, constructed in 2015. The dataset contains over 300 sensors and meters across two office floors, including whole building and end use energy consumption, HVAC system operating conditions, indoor and outdoor environmental parameters, and occupant counts.

Paper: Luo, N., Wang, Z., Blum, D. et al. "A three-year dataset supporting research on building energy management and occupancy analytics." Scientific Data 9, 156 (2022). https://doi.org/10.1038/s41597-022-01257-x

Dataset: https://datadryad.org/dataset/doi:10.7941/D1N33Q

The building's HVAC system consists of four rooftop air handling units (RTU 001 through RTU 004) serving north and south wing zones across two office floors. Each RTU supplies conditioned air through an underfloor air distribution system with 50 fan powered terminal units providing zone level reheat. The asset topology is formally described using the Brick schema, an open standard for semantic representation of building systems, which is included in this repository as a TTL file.

## Data Pipeline

### Stage 1: Raw Data Extraction (build_bldg59_data.py)

Merges 27 raw CSV files from the dataset covering energy meters, RTU airflow and fan speeds, zone temperatures, heating and cooling setpoints, zone fan speeds, hot water temperatures, chilled water temperatures, and outdoor weather conditions. Filters to January 2020 (a high heating load winter month), resamples all data streams to uniform 15 minute intervals, removes physically impossible outlier values, applies linear interpolation for short sensor dropouts (up to 30 minutes), and uses K Nearest Neighbours imputation (K=5) from scikit learn for larger data gaps.

### Stage 2: Physics Informed Enrichment (enrich_bldg59_data.py)

Adds derived columns that the raw dataset does not contain but that are essential for facilities management analytics:

RTU supply and return air temperatures are synthesised using physics based correlations with fan speed and outdoor temperature. Zone actual temperatures are generated from setpoints with outdoor coupling, thermal lag, and daily oscillation patterns. Hot water supply temperature is modelled with a deliberate legionella risk event injected on January 15 to 17, where the boiler underperforms and water temperature drops below the 60 degree Celsius threshold defined in HSG274. Pump power consumption and bearing vibration follow linear degradation curves from healthy baselines (8 kW and 2.5 mm/s) toward failure thresholds (11 kW and 8.0 mm/s per ISO 10816).

Derived metrics computed include RTU efficiency index (airflow per unit fan speed), supply return air temperature differential (the primary HVAC health indicator), zone comfort gap (actual temperature minus setpoint), total building energy with HVAC percentage breakdown, ghost lighting detection using time of day proxy, and fan speed volatility for short cycling detection.

The output is an enriched CSV with 177 columns and 2,976 rows covering the full month at 15 minute resolution.

### Stage 3: Edge Simulation (digital_twin_simulator.py)

A Python script that reads the enriched CSV and streams it as four sector specific JSON payloads (HVAC, Pumps, Electrical, Compliance) through Azure IoT Hub at configurable intervals. Each payload includes computed OEE, MTBF, MTTR, and status flags. The simulator is containerised with Docker and deployed to Azure Container Registry, running as an Azure Container Instance for continuous cloud based operation without dependency on a local machine.

### Stage 4: Cloud Processing (Azure Stream Analytics)

Four SQL queries with 15 minute tumbling windows aggregate and route telemetry into sector specific blob storage containers. The HVAC query extracts efficiency, fan speeds, airflow, delta T, comfort gap, volatility, outdoor conditions, and OEE. The Pumps query extracts vibration, power, hot water temperature, RUL, legionella status, and maintenance metrics. The Electrical query extracts total load, HVAC breakdown by wing, lighting, and ghost lighting alerts. The Compliance query extracts hot water temperature and overall compliance check results.

## Dashboard

The React dashboard is hosted on GitHub Pages and built with Vite, Recharts, and Lucide icons. It provides four operational views:

**HVAC and Air Handling** includes a dropdown selector for RTU 001 through RTU 004, each mapped to their respective zone groups from the Brick ontology. Metrics displayed include OEE, efficiency index, supply return delta T, fan speed, comfort gap, volatility, outdoor temperature, MTBF, and MTTR. Time series charts show efficiency trending and delta T with zone comfort gap overlay.

**Pumps and Plant** tracks the primary hot water pump with bearing vibration run to failure curve against ISO 10816 warning (4.5 mm/s) and failure (8.0 mm/s) thresholds, power consumption trending against baseline, predicted Remaining Useful Life, legionella compliance status against HSG274, and degradation percentage.

**Electrical** shows total building load, HVAC percentage share, north vs south wing breakdown, lighting consumption, ghost lighting alerts with estimated waste, and panel level OEE.

**Compliance** aggregates four regulatory checks: hot water above 60 degrees Celsius per HSG274, zone comfort within plus or minus 2 degrees Fahrenheit per CIBSE guidelines, equipment vibration within ISO 10816 limits, and ghost lighting status. Each check shows pass or breach with current values, and the hot water temperature chart highlights the legionella risk zone.

The dashboard toggles between replay mode (stepping through local JSON with play, pause, and speed controls) and live Azure mode (polling blob storage containers every 30 seconds for real time data).

## How to Run

### Prerequisites

Python 3.10 or higher, Node.js 18 or higher, Docker, and an Azure account (free tier sufficient for IoT Hub).

### Data Pipeline

```
pip install pandas numpy scikit-learn
python build_bldg59_data.py
python enrich_bldg59_data.py
```

### Simulator (Local)

```
pip install pandas azure-iot-device python-dotenv
echo "AZURE_CONNECTION_STRING=your-connection-string" > .env
python digital_twin_simulator.py
```

### Simulator (Docker)

```
docker build -t bldg59-simulator:v1 .
docker run --env-file .env bldg59-simulator:v1
```

### Dashboard (Development)

```
cd digital-twin-ui
npm install
echo "VITE_AZURE_HVAC_SAS=your-blob-url" > .env
npm run dev
```

### Dashboard (Production Build)

```
cd digital-twin-ui
npm run build
```

## Repository Structure

```
├── digital-twin-ui/              React dashboard (Vite)
│   ├── src/App.jsx               Main dashboard component
│   ├── public/telemetry_full.json  Precomputed replay data
│   └── package.json
├── digital_twin_simulator.py     Edge simulator
├── build_bldg59_data.py          Raw data pipeline
├── enrich_bldg59_data.py         Physics informed enrichment
├── bldg59_digital_twin_jan2020_enriched.csv  Enriched dataset
├── Dockerfile                    Simulator container
├── .dockerignore
├── .gitignore
└── README.md
```

## Technologies

Python, Pandas, scikit-learn (KNN Imputer), React, Vite, Recharts, Lucide, Azure IoT Hub, Azure Stream Analytics, Azure Blob Storage, Azure Container Registry, Azure Container Instances, Docker, MQTT, Brick Schema (TTL/RDF)

## Dataset Citation

Hong, T., Luo, N., Blum, D., Wang, Z. (2022). A three-year building operational performance dataset for informing energy efficiency. Dryad. https://doi.org/10.7941/D1N33Q

## Author

Suryaprakasarao Vaddadi
MSc Internet of Things (Distinction), Bournemouth University
