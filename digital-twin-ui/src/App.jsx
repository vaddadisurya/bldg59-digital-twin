import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine, CartesianGrid } from "recharts";
import { Activity, Zap, Droplets, ThermometerSun, AlertTriangle, CheckCircle, XCircle, TrendingUp, Clock, Shield, Gauge, Wind, Play, Pause, SkipForward, Radio } from "lucide-react";
import { ContainerClient } from "@azure/storage-blob";
const VIB_WARN = 4.5, VIB_FAIL = 8.0, LEG_LIMIT = 60, COMFORT_BAND = 2.0;
const CHART_WINDOW = 48;
const SPEED_OPTIONS = [500, 1000, 2000, 4000];

// Telemetry data — 744 hourly records from enriched CSV
// In production: fetch("/telemetry.json") or Azure Blob SAS URL
// For artifact: embedded subset (every 3rd hour = 248 points covers full month)
// Configuration — set your blob SAS URL here when ready
const BLOB_CONFIG = {
enabled: true, // Set to true to allow Azure Live Mode
  hvacUrl: import.meta.env.VITE_AZURE_HVAC_SAS,
  pumpsUrl: import.meta.env.VITE_AZURE_PUMPS_SAS,
  elecUrl: import.meta.env.VITE_AZURE_ELEC_SAS,
  complianceUrl: import.meta.env.VITE_AZURE_COMPLIANCE_SAS,
  pollIntervalMs: 30000,
};


// ============================================================
// STYLING
// ============================================================
const C = {
  bg: "#09090b", surface: "#18181b", surfaceAlt: "#1c1c1f", border: "#27272a",
  text: "#fafafa", textMuted: "#a1a1aa", textDim: "#52525b",
  cyan: "#22d3ee", amber: "#fbbf24", red: "#f87171", green: "#4ade80",
  purple: "#a78bfa", blue: "#60a5fa",
};

const mono = "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

// ============================================================
// COMPONENTS
// ============================================================
const Badge = ({ status }) => {
  const m = { online: [C.green,"ONLINE"], warning: [C.amber,"WARNING"], critical: [C.red,"CRITICAL"], compliant: [C.green,"PASS"], breach: [C.red,"BREACH"] };
  const [color, label] = m[status] || [C.textDim, status];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", background:`${color}12`, border:`1px solid ${color}30`, borderRadius:4, fontSize:10, fontWeight:600, color, letterSpacing:0.8, fontFamily:mono }}><span style={{ width:5, height:5, borderRadius:"50%", background:color }}/>{label}</span>;
};

const Metric = ({ label, value, unit, sub, accent = C.cyan, icon: Icon }) => (
  <div style={{ padding:"16px 18px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8 }}>
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
      {Icon && <Icon size={14} color={C.textMuted}/>}
      {/* FIXED: Brighter color (C.textMuted), larger font (12), bolder weight */}
      <span style={{ fontSize:12, fontWeight:600, color:C.textMuted, fontFamily:mono, letterSpacing:0.6, textTransform:"uppercase" }}>{label}</span>
    </div>
    <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
      <span style={{ fontSize:26, fontWeight:700, color:C.text, fontFamily:mono, letterSpacing:-1 }}>{value}</span>
      {unit && <span style={{ fontSize:13, color:C.textMuted }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize:11, color: typeof sub === "string" && sub.includes("-") ? C.red : C.textMuted, marginTop:4 }}>{sub}</div>}
  </div>
);

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 12px", fontSize:11, fontFamily:mono }}>
    <div style={{ color:C.textMuted, marginBottom:4 }}>{label}</div>
    {payload.map((p,i) => <div key={i} style={{ color:C.text }}>{p.name}: <span style={{ color:p.color, fontWeight:600 }}>{typeof p.value==="number"?p.value.toFixed(1):p.value}</span></div>)}
  </div>;
};

const ChartBox = ({ title, children, h = 180 }) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
    {/* FIXED: Brighter color, larger font */}
    <div style={{ fontSize:13, fontWeight:600, color:C.textMuted, marginBottom:10, fontFamily:mono, letterSpacing:0.3 }}>{title}</div>
    <ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer>
  </div>
);


// ============================================================
// SECTOR VIEWS
// ============================================================
const RTU_MAP = {
  "001": { name: "RTU-1 (North Wing)", zone: "RTU01_Zone", floor: "Floor_G & Floor_S", zoneKey: "cg036", zones: "36-42, 64-70" },
  "002": { name: "RTU-2 (North Wing)", zone: "RTU02_Zone", floor: "Floor_G & Floor_S", zoneKey: "cg019", zones: "19, 27-35, 43-44, 49-50, 57-63" },
  "003": { name: "RTU-3 (South Wing)", zone: "RTU03_Zone", floor: "Floor_G & Floor_S", zoneKey: "cg018", zones: "18, 25-26, 45, 48, 55-56, 61" },
  "004": { name: "RTU-4 (South Wing)", zone: "RTU04_Zone", floor: "Floor_G & Floor_S", zoneKey: "cg016", zones: "16-17, 21-24, 46-47, 51-54" },
};

const HVACView = ({ data, current }) => {
  const [rtu, setRtu] = useState("001");
  const info = RTU_MAP[rtu];
  const c = current;
  
  // Dynamic metric access based on selected RTU
  const sf = c[`sf${rtu}`] || 0;
  const rf = c[`rf${rtu}`] || 0;
  const flow = c[`fl${rtu}`] || 0;
  const eff = c[`ef${rtu}`] || 0;
  const dt = c[`dt${rtu}`] || 0;
  const vol = c[`vo${rtu}`] || 0;
  const cg = c[info.zoneKey] || 0;
  
  // OEE for selected RTU
  const avail = sf > 10 ? 100 : 0;
  const perf = Math.min(100, (flow / 20000) * 100);
  const qual = Math.abs(cg) < 2 ? 100 : 50;
  const oee = ((avail * perf * qual) / 10000).toFixed(1);
  
  // MTBF/MTTR per RTU (varies slightly by unit)
  const mtbf = (5000 + parseInt(rtu) * 100).toFixed(0);
  const mttr = (2.0 + parseInt(rtu) * 0.2).toFixed(1);
  
  // Status
  const status = sf < 10 ? "offline" : vol > 5 ? "critical" : vol > 2 ? "warning" : "online";
  
  // Chart data with selected RTU
  const chartData = data.map(d => ({
    t: d.t?.slice(5, 16) || "",
    eff: d[`ef${rtu}`],
    dt: d[`dt${rtu}`],
    sf: d[`sf${rtu}`],
    oat: d.oat,
    cg: d[info.zoneKey],
  }));

  return <>
    {/* RTU Selector */}
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
      <select 
        value={rtu} 
        onChange={e => setRtu(e.target.value)}
        style={{ 
          background: C.surface, border:`1px solid ${C.border}`, borderRadius:6, 
          color: C.text, fontSize:13, fontFamily:sans, padding:"6px 12px", cursor:"pointer" 
        }}
      >
        {Object.entries(RTU_MAP).map(([id, info]) => (
          <option key={id} value={id}>{info.name}</option>
        ))}
      </select>
      <Badge status={status}/>
      <span style={{ fontSize:10, color:C.textDim, fontFamily:mono }}>
        Zones: {info.zones} | {info.floor}
      </span>
    </div>
    
    {/* KPIs for selected RTU */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
      <Metric icon={Gauge} label="OEE" value={oee} unit="%" />
      <Metric icon={Activity} label="Efficiency" value={eff.toFixed(0)} sub="CFM / %speed"/>
      <Metric icon={ThermometerSun} label="Delta-T" value={dt.toFixed(1)} unit="°F"/>
      <Metric icon={Wind} label="Supply Fan" value={sf.toFixed(0)} unit="%"/>
      <Metric icon={Clock} label="MTBF" value={mtbf} unit="h"/>
      <Metric icon={Clock} label="MTTR" value={mttr} unit="h"/>
    </div>
    
    {/* Second row: zone comfort + volatility */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:10 }}>
      <Metric icon={ThermometerSun} label="Comfort Gap" value={Math.abs(cg).toFixed(1)} unit="°F" sub={cg > 0 ? "Above setpoint" : "Below setpoint"}/>
      <Metric icon={Wind} label="Return Fan" value={rf.toFixed(0)} unit="%"/>
      <Metric icon={Activity} label="Volatility" value={vol.toFixed(2)} sub={vol > 2 ? "High — check dampers" : "Normal"}/>
      <Metric icon={ThermometerSun} label="Outdoor" value={c.oat?.toFixed(1)} unit="°C"/>
    </div>
    
    {/* Charts */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
      <ChartBox title={`${info.name} — Efficiency Index`}>
        <LineChart data={chartData}>
          <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
          <XAxis dataKey="t" tick={{fontSize:8,fill:C.textDim}} interval={Math.floor(chartData.length/6)}/>
          <YAxis tick={{fontSize:9,fill:C.textDim}} domain={[80,200]}/>
          <Tooltip content={<TT/>}/>
          <Line dataKey="eff" name="Efficiency" stroke={C.cyan} strokeWidth={1.5} dot={false}/>
        </LineChart>
      </ChartBox>
      <ChartBox title="Delta-T and Zone Comfort Gap">
        <AreaChart data={chartData}>
          <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
          <XAxis dataKey="t" tick={{fontSize:8,fill:C.textDim}} interval={Math.floor(chartData.length/6)}/>
          <YAxis tick={{fontSize:9,fill:C.textDim}}/>
          <Tooltip content={<TT/>}/>
          <Area dataKey="dt" name="Delta-T °F" stroke={C.amber} fill={`${C.amber}15`} strokeWidth={1.5}/>
          <Line dataKey="cg" name="Comfort Gap °F" stroke={C.red} strokeWidth={1} dot={false}/>
        </AreaChart>
      </ChartBox>
    </div>
  </>;
};

const PumpsView = ({ data, current }) => {
  const c = current;
  const rul = Math.max(0, (8.0 - c.vib) / 0.18).toFixed(0);
  const status = c.vib > 7 ? "critical" : c.vib > 4.5 ? "warning" : "online";
  const mtbf = Math.max(500, 6000 - c.vib * 500).toFixed(0);
  const pumpOee = Math.max(0, 100 - (c.vib - 2.5) * 12).toFixed(0);
  return <>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
      <span style={{ fontSize:14, fontWeight:600, color:C.text }}>HWP-01 Primary Hot Water Pump</span>
      <Badge status={status}/>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
      <Metric icon={Activity} label="Vibration" value={c.vib.toFixed(2)} unit="mm/s" sub={`Limit: ${VIB_FAIL}`} accent={C.red}/>
      <Metric icon={Zap} label="Power" value={c.pwr.toFixed(1)} unit="kW" sub={`+${((c.pwr/8-1)*100).toFixed(0)}% vs baseline`}/>
      <Metric icon={Clock} label="RUL" value={rul} unit="days" accent={C.red}/>
      <Metric icon={Gauge} label="OEE" value={pumpOee} unit="%"/>
      <Metric icon={Clock} label="MTBF" value={mtbf} unit="h"/>
      <Metric icon={Clock} label="MTTR" value={(2.5+c.vib*0.3).toFixed(1)} unit="h"/>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
      <ChartBox title="Bearing Vibration — Degradation Curve" h={200}>
        <AreaChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="t" tick={{fontSize:8,fill:C.textDim}} interval={Math.floor(data.length/6)}/><YAxis tick={{fontSize:9,fill:C.textDim}} domain={[0,10]}/><Tooltip content={<TT/>}/><ReferenceLine y={VIB_FAIL} stroke={C.red} strokeDasharray="4 4"/><ReferenceLine y={VIB_WARN} stroke={C.amber} strokeDasharray="3 3"/><Area dataKey="vib" name="Vibration mm/s" stroke={C.red} fill={`${C.red}18`} strokeWidth={2}/></AreaChart>
      </ChartBox>
      <ChartBox title="Power Consumption Trending" h={200}>
        <AreaChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="t" tick={{fontSize:8,fill:C.textDim}} interval={Math.floor(data.length/6)}/><YAxis tick={{fontSize:9,fill:C.textDim}} domain={[6,14]}/><Tooltip content={<TT/>}/><ReferenceLine y={8.0} stroke={C.textDim} strokeDasharray="3 3"/><Area dataKey="pwr" name="Power kW" stroke={C.amber} fill={`${C.amber}15`} strokeWidth={2}/></AreaChart>
      </ChartBox>
    </div>
  </>;
};

const EnergyView = ({ data, current }) => {
  const c = current;
  return <>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
      <Metric icon={Zap} label="Total Load" value={c.te.toFixed(0)} unit="kW"/>
      <Metric icon={Zap} label="HVAC Share" value={c.hp.toFixed(0)} unit="%"/>
      <Metric icon={AlertTriangle} label="Ghost Lighting" value={c.gh} sub={c.gh?"Active alert":"Clear"}/>
      <Metric icon={Gauge} label="Panel OEE" value="99.9" unit="%"/>
      <Metric icon={Clock} label="MTBF" value="12000" unit="h"/>
    </div>
    <div style={{ marginTop:12 }}>
      <ChartBox title="Building Energy Consumption" h={200}>
        <BarChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="t" tick={{fontSize:8,fill:C.textDim}} interval={Math.floor(data.length/5)}/><YAxis tick={{fontSize:9,fill:C.textDim}}/><Tooltip content={<TT/>}/><Bar dataKey="te" name="Total kW" fill={`${C.cyan}90`} radius={[2,2,0,0]}/></BarChart>
      </ChartBox>
    </div>
  </>;
};

const ComplianceView = ({ data, current }) => {
  const c = current || {};
  // ADD FALLBACKS TO PREVENT CRASHING
  const hwc = c.hwc || 0;
  const cg = c.cg || 0;
  const vib = c.vib || 0;
  const gh = c.gh || 0;

  const checks = [
    { name: "Hot Water > 60°C (HSG274)", pass: hwc >= LEG_LIMIT, val: `${hwc.toFixed(1)}°C` },
    { name: "Zone Comfort ±2°F (CIBSE)", pass: Math.abs(cg) < COMFORT_BAND, val: `${Math.abs(cg).toFixed(1)}°F gap` },
    { name: "Equipment Vibration (ISO 10816)", pass: vib < VIB_FAIL, val: `${vib.toFixed(1)} mm/s` },
    { name: "Ghost Lighting", pass: !gh, val: gh ? "Detected" : "Clear" },
  ];
  const passed = checks.filter(x => x.pass).length;
  return <>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
      <Metric icon={Shield} label="Score" value={`${passed}/${checks.length}`} accent={passed===checks.length?C.green:C.amber}/>
      <Metric icon={Droplets} label="HW Temp" value={hwc.toFixed(1)} unit="°C" sub={hwc<60?"Below limit":"Compliant"}/>
      <Metric icon={Activity} label="Vibration" value={vib.toFixed(1)} unit="mm/s"/>
      <Metric icon={ThermometerSun} label="Comfort Gap" value={Math.abs(cg).toFixed(1)} unit="°F"/>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:16 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.textMuted, marginBottom:12, fontFamily:mono }}>Compliance Checks</div>
        {checks.map((ch,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:C.surfaceAlt, borderRadius:6, marginBottom:6, borderLeft:`3px solid ${ch.pass?C.green:C.red}` }}>
            {ch.pass ? <CheckCircle size={14} color={C.green}/> : <XCircle size={14} color={C.red}/>}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{ch.name}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{ch.val}</div>
            </div>
            <Badge status={ch.pass?"compliant":"breach"}/>
          </div>
        ))}
      </div>
      <ChartBox title="Hot Water Temperature — Legionella Monitor" h={220}>
        <AreaChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="t" tick={{fontSize:10,fill:C.textMuted}} interval={Math.floor(data.length/6)}/><YAxis tick={{fontSize:10,fill:C.textMuted}} domain={[54,68]}/><Tooltip content={<TT/>}/><ReferenceLine y={60} stroke={C.red} strokeDasharray="4 4"/><Area dataKey="hwc" name="HW Temp °C" stroke={C.cyan} fill={`${C.cyan}12`} strokeWidth={2}/></AreaChart>
      </ChartBox>
    </div>
  </>;
};

// ============================================================
// MAIN
// ============================================================
// ============================================================
// MAIN
// ============================================================
export default function App() {
  const [sector, setSector] = useState("hvac");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1500);
  const timerRef = useRef(null);

  const [dataSource, setDataSource] = useState(BLOB_CONFIG.enabled ? "azure" : "replay");
  const [liveData, setLiveData] = useState([]);
  const [rawData, setRawData] = useState([]); 

  // 1. Fetch Local JSON
  useEffect(() => {
    fetch("telemetry_full.json")
      .then(r => r.json())
      .then(data => setRawData(data))
      .catch(() => console.log("Using embedded data fallback"));
  }, []);

  // 2. Fetch Azure Blob (FIXED: Using Azure SDK instead of Claude's raw fetch)
  useEffect(() => {
    if (dataSource !== "azure") return;
    
    const fetchBlob = async () => {
      try {
        const getLatestFromContainer = async (sasUrl) => {
          if (!sasUrl) return {};
          const client = new ContainerClient(sasUrl);
          let latestBlob = null;
          let latestDate = new Date(0);
          
          // Find the newest file generated by Stream Analytics
          for await (const blob of client.listBlobsFlat()) {
            if (blob.properties.createdOn > latestDate) {
              latestDate = blob.properties.createdOn;
              latestBlob = blob.name;
            }
          }
          if (!latestBlob) return {};
          
          // Download and parse the newest file
          const blobClient = client.getBlobClient(latestBlob);
          const response = await blobClient.downloadToBuffer();
          const lines = response.toString().split('\n').filter(l => l.trim());
          return lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : {};
        };

        const [hvacRes, pumpsRes, elecRes, compRes] = await Promise.all([
          getLatestFromContainer(BLOB_CONFIG.hvacUrl),
          getLatestFromContainer(BLOB_CONFIG.pumpsUrl),
          getLatestFromContainer(BLOB_CONFIG.elecUrl),
          getLatestFromContainer(BLOB_CONFIG.complianceUrl)
        ]);

        const combined = { 
          t: new Date().toISOString().slice(0, 16).replace("T", " "),
          ...hvacRes, ...pumpsRes, ...elecRes, ...compRes
        };

        setLiveData(prev => [...prev, combined].slice(-CHART_WINDOW));
      } catch (e) {
        console.warn("Azure fetch failed. Check SAS tokens and CORS:", e);
      }
    };
    
    fetchBlob();
    const interval = setInterval(fetchBlob, BLOB_CONFIG.pollIntervalMs);
    return () => clearInterval(interval);
  }, [dataSource]);

  // 3. The Combined Rule
  const data = dataSource === "azure" && liveData.length > 0 ? liveData : rawData;

  // 4. FIX: Moved the auto-play hook ABOVE the early return to stop Error 310!
  useEffect(() => {
    if (playing && dataSource === "replay" && data && data.length > 0) {
      timerRef.current = setInterval(() => {
        setIdx(prev => (prev + 1) % data.length);
      }, speed);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, speed, data, dataSource]);

  // Wait for data to load before rendering the UI
  if (!data || data.length === 0) {
    return <div style={{ background: C.bg, color: C.text, minHeight: "100vh", padding: 20 }}>Loading Telemetry...</div>;
  }

  const current = data[idx] || data[data.length - 1];
  const history = data.slice(0, idx + 1).slice(-CHART_WINDOW);
  
  const liveIndicator = playing || dataSource === "azure";
  const ts = current.t || "";
  const day = ts.slice(5, 10);
  const time = ts.slice(11, 16);

  const tabs = [
    { id: "hvac", label: "HVAC", icon: Wind },
    { id: "pumps", label: "Pumps & Plant", icon: Droplets },
    { id: "energy", label: "Electrical", icon: Zap },
    { id: "compliance", label: "Compliance", icon: Shield },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:sans }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 20px", borderBottom:`1px solid ${C.border}`, background:C.surface }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:30, height:30, borderRadius:6, background:`linear-gradient(135deg, ${C.cyan}40, ${C.purple}40)`, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}><Activity size={14} color={C.cyan}/></div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, letterSpacing:-0.3 }}>Building 59 — Asset Performance Centre</div>
            <div style={{ fontSize:10, color:C.textDim, fontFamily:mono }}>BLDG59-LBNL-BERKELEY</div>
          </div>
        </div>
<div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button 
            onClick={() => setDataSource(prev => prev === "replay" ? "azure" : "replay")}
            style={{ padding: "6px 12px", borderRadius: 4, fontSize: 11, fontWeight:600, fontFamily: mono, background: dataSource === "azure" ? `${C.green}20` : C.surfaceAlt, border: `1px solid ${dataSource === "azure" ? C.green : C.border}`, color: dataSource === "azure" ? C.green : C.textMuted, cursor: "pointer" }}
          >
            {dataSource === "azure" ? "🟢 LIVE — Azure Blob" : "⚪ REPLAY — Local Data"}
          </button>
          
          {/* Hide playback buttons if in Azure mode */}
          {dataSource === "replay" && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:C.surfaceAlt, borderRadius:6, border:`1px solid ${C.border}` }}>
              <button onClick={() => setPlaying(!playing)} style={{ background:"none", border:"none", cursor:"pointer", color:C.text, display:"flex", padding:2 }}>
                {playing ? <Pause size={12}/> : <Play size={12}/>}
              </button>
              <button onClick={() => setIdx(prev => Math.min(prev + 10, data.length - 1))} style={{ background:"none", border:"none", cursor:"pointer", color:C.textMuted, display:"flex", padding:2 }}>
                <SkipForward size={12}/>
              </button>
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:4, color:C.textMuted, fontSize:10, fontFamily:mono, padding:"2px 4px" }}>
                {SPEED_OPTIONS.map(s => <option key={s} value={s}>{s < 1000 ? "0.5s" : `${s/1000}s`}</option>)}
              </select>
            </div>
          )}

          {/* Status Indicator */}
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:C.surfaceAlt, borderRadius:6, border:`1px solid ${C.border}` }}>
            {liveIndicator && <span style={{ width:8, height:8, borderRadius:"50%", background: dataSource === "azure" && liveData.length === 0 ? C.amber : C.green, animation:"pulse 1.5s infinite" }}/>}
            <span style={{ fontSize:11, fontWeight:600, fontFamily:mono, color:C.textMuted }}>
              {dataSource === "azure" 
                ? (liveData.length > 0 ? `LIVE AS OF: ${time}` : "AWAITING AZURE DATA...") 
                : `Jan ${day} ${time}`}
            </span>
          </div>
          
          {dataSource === "replay" && (
            <div style={{ fontSize:11, fontFamily:mono, color:C.textMuted, padding:"4px 8px", background:C.surfaceAlt, borderRadius:4 }}>
              {idx + 1} / {data.length}
            </div>
          )}
        </div>
      </div>
      <div style={{ display:"flex", gap:4, padding:"8px 20px", borderBottom:`1px solid ${C.border}` }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = sector === tab.id;
          return <button key={tab.id} onClick={() => setSector(tab.id)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background:active?`${C.cyan}10`:"transparent", border:active?`1px solid ${C.cyan}25`:`1px solid transparent`, borderRadius:6, color:active?C.cyan:C.textDim, fontSize:12, fontWeight:active?600:400, cursor:"pointer", fontFamily:sans, transition:"all 0.15s" }}>
            <Icon size={13}/>{tab.label}
          </button>;
        })}
      </div>
      <div style={{ padding:20 }}>
        {sector === "hvac" && <HVACView data={history} current={current}/>}
        {sector === "pumps" && <PumpsView data={history} current={current}/>}
        {sector === "energy" && <EnergyView data={history} current={current}/>}
        {sector === "compliance" && <ComplianceView data={history} current={current}/>}
      </div>
      <div style={{ padding:"8px 20px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:9, color:C.textDim, fontFamily:mono }}>Data: LBNL Building 59 Operational Dataset (Luo et al., 2022, Nature Scientific Data) — Enriched with physics-informed synthetic degradation</span>
        <span style={{ fontSize:9, color:C.textDim, fontFamily:mono }}>v2.0 — Dynamic Replay Mode</span>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}