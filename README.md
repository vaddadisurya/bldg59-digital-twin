# Building 59 — Agentic AI Powered IoT Digital Twin for Building Operations

An end-to-end IoT Digital Twin for Lawrence Berkeley National Laboratory's Building 59, featuring a cloud-native data pipeline, interactive React dashboard, and an AI-powered conversational interface with autonomous monitoring capabilities.

**[Live Dashboard](https://vaddadisurya.github.io/bldg59-digital-twin/)** · **[Dataset Paper (Luo et al., 2022)](https://doi.org/10.1038/s41597-022-01257-x)**

---

## Overview

This project demonstrates a complete Digital Twin system that ingests 300+ sensor data points from 4 HVAC rooftop units, a hot water pump system, and electrical distribution panels. The data flows through a cloud-native Azure pipeline, is enriched with physics-based synthetic degradation models, and is presented via an interactive dashboard with an AI agent that can answer natural language queries, predict equipment failures, simulate what-if scenarios, and autonomously monitor building health.

Built as a portfolio demonstrator for the SMART Buildings R&D Engineer KTP Associate role (GCU01907) at Glasgow Caledonian University in partnership with Solis Trading Ltd.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    React Dashboard (GitHub Pages)                 │
│  4 Views · AI Chat Panel · Findings Feed · Overwatch Toggle      │
│  Replay Mode (local JSON) · Live Mode (Azure Blob)               │
└──────────────┬────────────────────┬──────────────────────────────┘
               │ WebSocket /chat    │ REST /findings, /visitor
               ▼                    ▼
┌──────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Azure Container Apps)               │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  LangGraph   │  │  APScheduler │  │   Azure Blob Storage   │  │
│  │  ReAct Agent │  │  (5 min)     │  │   - agent-findings     │  │
│  │             │  │              │  │   - visitor-log         │  │
│  └──────┬──────┘  └──────┬───────┘  │   - rag-documents      │  │
│         │                │          └────────────────────────┘  │
│         ▼                ▼                                      │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │     LangChain Tools         │  │     ChromaDB (RAG)       │  │
│  │  - query_sensor_data        │  │  - sentence-transformers │  │
│  │  - get_trend_analysis       │  │  - all-MiniLM-L6-v2     │  │
│  │  - get_energy_rates         │  │  - 15 knowledge chunks   │  │
│  │  - search_knowledge         │  └──────────────────────────┘  │
│  └──────────┬──────────────────┘                                │
│             ▼                                                    │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │   Pandas DataFrame          │  │   NVIDIA NIM (LLM)       │  │
│  │   2,976 rows × 178 cols     │  │   Llama 3.1 70B/8B       │  │
│  │   In-memory sensor queries  │  │   OpenAI-compatible API   │  │
│  └─────────────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
               ▲
               │ MQTT (when live pipeline active)
┌──────────────┴───────────────────────────────────────────────────┐
│                IoT Pipeline (start for live demos)               │
│  ACI Simulator → IoT Hub (F1) → Stream Analytics → Blob Storage │
└──────────────────────────────────────────────────────────────────┘
```

## Features

### Dashboard
- **HVAC View** — Per-RTU dropdown showing efficiency, delta-T, airflow, fan speed, OEE, and speed volatility with threshold indicators
- **Pumps & Plant View** — Bearing vibration run-to-failure curve, power consumption trending, RUL prediction, pump OEE, MTBF/MTTR, legionella compliance monitoring
- **Electrical View** — North/south wing energy breakdown, HVAC percentage analysis, ghost lighting detection with cost estimation
- **Compliance View** — HSG274 hot water compliance, ISO 10816 vibration classification, CIBSE zone comfort monitoring
- **Replay Mode** — Cycles through full January 2020 dataset with play/pause/speed controls
- **Live Mode** — Fetches real-time data from Azure Blob Storage (when IoT pipeline is active)

### AI Assistant (Chat)
- Natural language queries about building sensor data, equipment health, energy consumption, and compliance
- Tool-calling agent using LangGraph ReAct pattern with 4 LangChain tools
- What-if simulation: "What happens if RTU-001 fan speed drops to 40%?"
- Predictive analytics: "When will the pump reach critical vibration?"
- Cost analysis: "What is the daily energy bill?"
- RAG-powered knowledge retrieval from building documentation
- Conversation history maintained per session

### Autonomous Monitoring (AI Overwatch)
- Background agent runs every 5 minutes when activated
- Checks pump vibration against ISO 10816 thresholds
- Monitors hot water temperature for HSG274 legionella compliance
- Analyses degradation trends and predicts time-to-failure
- Generates structured findings with severity classification (critical/warning/info)
- Findings persisted to Azure Blob Storage and displayed in dashboard notification feed

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Recharts, WebSocket, GitHub Pages |
| Backend | FastAPI, LangGraph, LangChain, APScheduler, Pydantic |
| AI/ML | NVIDIA NIM (Llama 3.1), ChromaDB, sentence-transformers (all-MiniLM-L6-v2) |
| Data | Pandas, NumPy, scikit-learn (KNN imputation) |
| Cloud | Azure IoT Hub, Stream Analytics, Blob Storage, Container Apps, Container Registry, Container Instance |
| DevOps | Docker, Git, GitHub Codespaces |
| Standards | ISO 10816, HSG274 Part 2, CIBSE Guide A, Brick Ontology |

## Dataset

Berkeley Building 59 Operational Dataset (Luo et al., 2022, Nature Scientific Data).

- **Source**: Lawrence Berkeley National Laboratory, Berkeley, California
- **Building**: 10,400 sqm commercial office, 4 RTUs, 50+ zones
- **Period**: January 2020, 15-minute intervals
- **Raw**: 2,976 rows × 75 columns
- **Enriched**: 2,976 rows × 178 columns after physics-informed synthetic augmentation

### Data Enrichment

The raw dataset was enriched with physics-based synthetic data to demonstrate Digital Twin capabilities:

- **Pump degradation**: Linear vibration increase from 2.5 to 8.0 mm/s with correlated power increase from 8.0 to 12.5 kW
- **Legionella events**: Hot water temperature drops below 60°C on January 15-17
- **RTU efficiency**: Calculated from airflow/fan speed ratio per RTU
- **OEE**: Overall Equipment Effectiveness for HVAC and pump systems
- **Comfort gaps**: Zone-level temperature deviation from setpoints
- **Ghost lighting**: Binary detection of overnight lighting waste
- **RUL/MTBF/MTTR**: Predictive maintenance metrics derived from vibration trends

## Project Structure

```
bldg59-digital-twin/
├── backend/                          # FastAPI AI Backend
│   ├── app/
│   │   ├── agent.py                  # LangGraph ReAct agent, system prompt
│   │   ├── main.py                   # FastAPI server, WebSocket, REST, scheduler
│   │   ├── tools.py                  # LangChain @tool functions (Pandas queries)
│   │   ├── rag.py                    # ChromaDB initialization, search_knowledge
│   │   ├── blob_storage.py           # Azure Blob read/write for persistence
│   │   └── config.py                 # Environment variables, thresholds, rates
│   ├── data/
│   │   ├── bldg59_digital_twin_jan2020_enriched.csv
│   │   └── DATA_REFERENCE_GUIDE.md   # RAG knowledge document
│   ├── Dockerfile
│   └── requirements.txt
├── digital-twin-ui/                  # React Dashboard
│   ├── src/App.jsx                   # Main dashboard with all views + AI panels
│   └── public/telemetry_full.json    # Replay mode data
├── digital_twin_simulator.py         # IoT edge simulator (MQTT to IoT Hub)
├── enrich_bldg59_data.py             # Physics-based data enrichment script
├── build_bldg59_data.py              # Base dataset builder
└── Bldg59_w_occ Brick model.ttl      # Brick ontology schema
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | WebSocket | Bidirectional chat with LangGraph agent |
| `/findings` | GET | Retrieve autonomous agent findings |
| `/visitor` | POST | Log visitor name and email |
| `/agent/toggle` | POST | Start/stop autonomous monitoring |
| `/agent/status` | GET | Check if autonomous agent is running |
| `/docs` | GET | Swagger UI API documentation |

## Azure Resources

| Service | Name | Purpose |
|---------|------|---------|
| IoT Hub | iot-bldg59-twin-poc (F1 free) | MQTT device ingestion |
| Stream Analytics | asa-digitaltwin-poc | Real-time 15-min tumbling window processing |
| Blob Storage | stbldg59poc | Telemetry, findings, visitor logs, RAG documents |
| Container Registry | acrbldg59 | Docker image storage |
| Container Instance | bldg59-sim-aci | IoT simulator deployment |
| Container Apps | bldg59-backend | AI backend (scale-to-zero) |

## Quick Start

### View the Dashboard
Visit [https://vaddadisurya.github.io/bldg59-digital-twin/](https://vaddadisurya.github.io/bldg59-digital-twin/) — replay mode works immediately with no setup.

### Run Backend Locally
```bash
cd backend
pip install -r requirements.txt
echo "NVIDIA_API_KEY=your-key" > .env
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Run with Docker
```bash
cd backend
docker build -t bldg59-backend .
docker run -p 8000:8000 -e NVIDIA_API_KEY=your-key bldg59-backend
```

## Known Limitations

- NVIDIA NIM 8B model occasionally fails on multi-tool-call queries (500 "Failed to apply prompt template"). The 70B model or Groq is recommended for production.
- AI chatbot returns the latest CSV row value, which may differ from the dashboard that cycles through the full month.
- Pump degradation data is synthetically generated (linear). Real-world degradation is non-linear and requires ML models trained on actual failure events.
- The autonomous agent may hit NVIDIA NIM rate limits (40 req/min free tier) when used concurrently with the chatbot.

## Future Work

- Interactive what-if simulator with sliders for parameter adjustment
- ML model integration (Random Forest for RUL, XGBoost for energy forecasting)
- Groq or self-hosted LLM for faster inference
- Email alerting for critical findings
- Multi-building support with parameterised data ingestion
- Live BMS integration replacing CSV replay

## References

1. Luo, N. et al. (2022). "Three years of hourly data from 3,000+ sensors deployed in 4 office buildings." *Nature Scientific Data*, 9:156. [https://doi.org/10.1038/s41597-022-01257-x](https://doi.org/10.1038/s41597-022-01257-x)
2. Balaji, B. et al. (2018). "Brick: Metadata schema for portable smart building applications." *Applied Energy*, 226, 1273-1292.
3. ISO 10816-1:1995. "Mechanical vibration — Evaluation of machine vibration by measurements on non-rotating parts."
4. HSG274 Part 2. "The control of legionella bacteria in hot and cold water systems." UK Health and Safety Executive.
5. CIBSE Guide A. "Environmental design." Chartered Institution of Building Services Engineers.

## Author

**Surya Vaddadi**
MSc Internet of Things (Distinction) — Bournemouth University
[jrsprvaddadi@hotmail.com](mailto:jrsprvaddadi@hotmail.com)

## License

This project is for academic and portfolio purposes. The Building 59 dataset is publicly available under Creative Commons Attribution 4.0 (CC BY 4.0).
