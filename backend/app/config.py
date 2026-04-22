import os
from dotenv import load_dotenv

load_dotenv()

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# LLM Configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
# LLM_MODEL = "meta/llama-3.1-70b-instruct"
LLM_MODEL = "meta/llama-3.1-8b-instruct"

# Azure Blob Storage Configuration
AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_FINDINGS = "agent-findings"
CONTAINER_VISITORS = "visitor-log"
CONTAINER_RAG = "rag-documents"

# File paths (Local fallbacks)
CSV_PATH = os.path.join(_BASE, "data", "bldg59_digital_twin_jan2020_enriched.csv")
RAG_DOCS_PATH = os.path.join(_BASE, "data")
CHROMA_PATH = os.path.join(_BASE, "data", "chromadb")

# Energy Rates & Thresholds
ENERGY_RATES = {
    "california_commercial_usd_kwh": 0.22,
    "uk_commercial_gbp_kwh": 0.28,
    "uk_industrial_gbp_kwh": 0.21,
}

THRESHOLDS = {
    "vibration_warn": 4.5, "vibration_critical": 7.0, "vibration_shutdown": 8.0,
    "legionella_limit_c": 60.0, "comfort_band_f": 2.0, "ghost_light_kw": 0.5,
    "volatility_warn": 2.0, "volatility_critical": 5.0, "efficiency_low": 150,
}