import json
import time
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from app.config import NVIDIA_API_KEY, LLM_MODEL
from app.tools import query_sensor_data, get_trend_analysis, get_energy_rates
from app.rag import search_knowledge

llm = ChatOpenAI(
    model=LLM_MODEL,
    api_key=NVIDIA_API_KEY,
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.1,
)

tools = [query_sensor_data, get_trend_analysis, get_energy_rates, search_knowledge]

SYSTEM_PROMPT = """You are the Building 59 Facilities Management AI Assistant.
You ONLY answer questions about Building 59 sensor data, equipment health, energy, and compliance.
If asked about anything else, politely decline.

RULES:
- Call ONE tool at a time. Wait for the result before calling another.
- NEVER guess or invent numbers. Always use a tool to get real data.
- Be concise. Show calculations. Cite standards (ISO 10816, HSG274, CIBSE).

RTU ZONE MAPPING:
- RTU-001: zones 36-42, 64-70 (North Wing)
- RTU-002: zones 19, 27-35, 43-44, 49-50, 57-63 (North Wing)
- RTU-003: zones 18, 25-26, 45, 48, 55-56, 61 (South Wing)
- RTU-004: zones 16-17, 21-24, 46-47, 51-54 (South Wing)

KEY FORMULAS:
- Efficiency = airflow_cfm / fan_speed_pct (healthy: 170-190, problem: <150)
- Delta-T = return_air - supply_air (healthy: 14-17F)
- OEE = (Availability x Performance x Quality) / 10000
- Pump RUL = (8.0 - vibration) / daily_degradation_rate days
- MTBF = 6000 - vibration x 500 hours
- Energy cost = total_kw x hours x rate

THRESHOLDS:
- Vibration: <4.5 OK, 4.5-7.0 WARNING, >7.0 CRITICAL (ISO 10816)
- Hot water: must be >60C (HSG274 legionella)
- Comfort: within 2F of setpoint (CIBSE)
- Ghost lighting: >0.5 kW between 22:00-05:00

ENERGY RATES: California $0.22/kWh, UK £0.28/kWh

WHAT-IF RULES:
When asked "what happens if X changes", do NOT search the knowledge base. Do NOT invent tool names.
Instead: FIRST call query_sensor_data to get the CURRENT value, THEN do the math yourself.

Example for "What if fan speed drops to 40%":
Step 1: Call query_sensor_data with metric "rtu_001_sf_vfd_spd_fbk_tn" to get current speed
Step 2: Call query_sensor_data with metric "rtu_001_fltrd_sa_flow_tn" to get current airflow
Step 3: Calculate in your response (not via tools):
  - new_airflow = current_airflow * (40 / current_speed)
  - new_efficiency = new_airflow / 40
  - new_performance = (new_airflow / 20000) * 100
  - Show before vs after numbers

Example for "What if hot water drops to 55C":
Answer directly: 55C is below 60C HSG274 threshold. This creates legionella risk within 48-72 hours.

Example for "What if RTU-003 is turned off":
Step 1: Call query_sensor_data for RTU-003 metrics
Step 2: Answer: zones 18, 25, 26, 45, 48, 55, 56, 61 lose conditioning. OEE drops to 0%.

TOOL USAGE RULES:
- You have exactly 4 tools: query_sensor_data, get_trend_analysis, get_energy_rates, search_knowledge
- NEVER invent tool names like "calculate_new_efficiency" — those don't exist
- For calculations, do the math in your response text after getting data from tools
- For "is anything wrong" questions: call query_sensor_data for pump_vibration_mms AND hw_temp_celsius AND total_energy_kw, then check thresholds
- For RTU efficiency: use exact column name rtu_001_efficiency (not "efficiency" or "fan_speed_pct")
- For hot water: use exact column name hw_temp_celsius (not "hot_water_temp")

PREDICTIONS: Use get_trend_analysis, get daily rate, extrapolate. State assumption."""

agent_executor = create_react_agent(llm, tools)

async def process_chat(user_message: str, history: list) -> str:
    messages = [("system", SYSTEM_PROMPT)]
    for msg in history:
        messages.append((msg["role"], msg["content"]))
    messages.append(("user", user_message))

    for attempt in range(3):
        try:
            result = await agent_executor.ainvoke({"messages": messages})
            return result["messages"][-1].content
        except Exception as e:
            if "429" in str(e):
                time.sleep(2)
                continue
            raise e
    return "The AI service is temporarily busy. Please try again."

def run_autonomous_check() -> list:
    prompt = """Check building status. Follow these steps ONE AT A TIME:
Step 1: Call query_sensor_data with metric "pump_vibration_mms"
Step 2: Call query_sensor_data with metric "hw_temp_celsius"
Step 3: Call get_trend_analysis with metric "pump_vibration_mms"

After getting all results, compare against thresholds:
- Vibration > 7.0 = critical (ISO 10816)
- Hot water < 60.0 = legionella risk (HSG274)

Output ONLY a JSON array. Each item: {"severity":"critical/warning/info", "system":"Pumps/Compliance", "summary":"one sentence", "detail":"2-3 sentences with numbers and action"}"""

    messages = [("system", SYSTEM_PROMPT), ("user", prompt)]

    for attempt in range(3):
        try:
            result = agent_executor.invoke({"messages": messages})
            text = result["messages"][-1].content.strip()
            if text.startswith("```json"):
                text = text[7:-3].strip()
            elif text.startswith("```"):
                text = text[3:-3].strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return [{"severity": "info", "system": "System", "summary": "Check completed but response wasn't valid JSON.", "detail": text[:300]}]
        except Exception as e:
            if "429" in str(e):
                time.sleep(2)
                continue
            print(f"Autonomous check error: {e}")
            return []
    return []