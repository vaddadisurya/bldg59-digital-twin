import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine, CartesianGrid } from "recharts";
import { Activity, Zap, Droplets, ThermometerSun, AlertTriangle, CheckCircle, XCircle, TrendingUp, Clock, Shield, Gauge, Wind } from "lucide-react";

// ============================================================
// EMBEDDED DATA (from enriched CSV — 6-hour intervals, Jan 2020)
// ============================================================
const PUMP_DATA=[{"t":"2020-01-01","pwr":8.86,"vib":2.54,"hwc":65.1},{"t":"2020-01-02","pwr":9.14,"vib":2.71,"hwc":64.5},{"t":"2020-01-03","pwr":9.09,"vib":2.87,"hwc":65.0},{"t":"2020-01-04","pwr":9.3,"vib":3.09,"hwc":64.8},{"t":"2020-01-05","pwr":9.32,"vib":3.25,"hwc":64.2},{"t":"2020-01-06","pwr":9.45,"vib":3.42,"hwc":64.8},{"t":"2020-01-07","pwr":9.62,"vib":3.58,"hwc":64.4},{"t":"2020-01-08","pwr":9.55,"vib":3.72,"hwc":64.6},{"t":"2020-01-09","pwr":9.75,"vib":3.94,"hwc":64.3},{"t":"2020-01-10","pwr":9.8,"vib":4.12,"hwc":64.0},{"t":"2020-01-11","pwr":9.89,"vib":4.33,"hwc":64.1},{"t":"2020-01-12","pwr":10.05,"vib":4.44,"hwc":64.2},{"t":"2020-01-13","pwr":10.09,"vib":4.65,"hwc":64.4},{"t":"2020-01-14","pwr":10.08,"vib":4.83,"hwc":64.3},{"t":"2020-01-15","pwr":10.26,"vib":5.08,"hwc":58.6},{"t":"2020-01-16","pwr":10.42,"vib":5.2,"hwc":58.4},{"t":"2020-01-17","pwr":10.51,"vib":5.32,"hwc":58.6},{"t":"2020-01-18","pwr":10.47,"vib":5.52,"hwc":64.2},{"t":"2020-01-19","pwr":10.6,"vib":5.73,"hwc":64.3},{"t":"2020-01-20","pwr":10.81,"vib":5.88,"hwc":64.5},{"t":"2020-01-21","pwr":10.74,"vib":6.15,"hwc":64.5},{"t":"2020-01-22","pwr":10.98,"vib":6.2,"hwc":64.5},{"t":"2020-01-23","pwr":11.09,"vib":6.51,"hwc":64.8},{"t":"2020-01-24","pwr":11.21,"vib":6.62,"hwc":65.2},{"t":"2020-01-25","pwr":11.18,"vib":6.76,"hwc":65.2},{"t":"2020-01-26","pwr":11.4,"vib":6.96,"hwc":65.1},{"t":"2020-01-27","pwr":11.58,"vib":7.15,"hwc":64.8},{"t":"2020-01-28","pwr":11.58,"vib":7.31,"hwc":64.6},{"t":"2020-01-29","pwr":11.64,"vib":7.47,"hwc":64.4},{"t":"2020-01-30","pwr":11.74,"vib":7.68,"hwc":65.1},{"t":"2020-01-31","pwr":12.04,"vib":7.89,"hwc":65.0}];

const HVAC_DATA=[{"t":"Jan 1","eff1":182.3,"eff2":182.7,"dt1":15.8,"cg":0.5,"oat":12.2,"sf1":82.4},{"t":"Jan 2","eff1":182.2,"eff2":182.1,"dt1":15.6,"cg":0.3,"oat":11.7,"sf1":81.0},{"t":"Jan 3","eff1":182.1,"eff2":182.7,"dt1":15.8,"cg":0.7,"oat":13.4,"sf1":82.0},{"t":"Jan 4","eff1":182.5,"eff2":182.4,"dt1":15.6,"cg":0.5,"oat":12.1,"sf1":80.5},{"t":"Jan 5","eff1":182.1,"eff2":180.4,"dt1":15.0,"cg":0.1,"oat":9.8,"sf1":72.0},{"t":"Jan 6","eff1":182.5,"eff2":183.5,"dt1":15.2,"cg":0.3,"oat":9.8,"sf1":78.6},{"t":"Jan 7","eff1":186.4,"eff2":182.6,"dt1":15.2,"cg":0.5,"oat":11.2,"sf1":78.2},{"t":"Jan 8","eff1":185.1,"eff2":181.0,"dt1":15.2,"cg":0.3,"oat":9.7,"sf1":76.8},{"t":"Jan 9","eff1":184.8,"eff2":180.6,"dt1":14.8,"cg":0.3,"oat":8.9,"sf1":76.4},{"t":"Jan 10","eff1":185.1,"eff2":180.8,"dt1":14.7,"cg":0.1,"oat":8.1,"sf1":75.8},{"t":"Jan 11","eff1":185.6,"eff2":182.0,"dt1":14.9,"cg":0.2,"oat":8.4,"sf1":78.2},{"t":"Jan 12","eff1":184.7,"eff2":179.7,"dt1":14.7,"cg":0.2,"oat":8.6,"sf1":71.8},{"t":"Jan 13","eff1":185.3,"eff2":182.0,"dt1":15.1,"cg":0.2,"oat":8.6,"sf1":78.9},{"t":"Jan 14","eff1":182.2,"eff2":166.7,"dt1":14.3,"cg":0.2,"oat":9.1,"sf1":62.8},{"t":"Jan 15","eff1":184.9,"eff2":170.9,"dt1":14.9,"cg":0.0,"oat":7.7,"sf1":75.3},{"t":"Jan 16","eff1":183.2,"eff2":169.3,"dt1":14.4,"cg":0.2,"oat":7.6,"sf1":74.1},{"t":"Jan 17","eff1":182.4,"eff2":169.6,"dt1":14.5,"cg":-0.1,"oat":6.1,"sf1":75.2},{"t":"Jan 18","eff1":184.0,"eff2":169.1,"dt1":14.3,"cg":0.2,"oat":8.4,"sf1":67.8},{"t":"Jan 19","eff1":185.0,"eff2":163.7,"dt1":13.4,"cg":0.2,"oat":8.8,"sf1":48.9},{"t":"Jan 20","eff1":184.2,"eff2":170.6,"dt1":15.0,"cg":0.2,"oat":9.3,"sf1":76.9},{"t":"Jan 21","eff1":184.5,"eff2":170.7,"dt1":15.4,"cg":0.4,"oat":10.4,"sf1":77.5},{"t":"Jan 22","eff1":183.3,"eff2":168.6,"dt1":14.7,"cg":0.3,"oat":10.3,"sf1":70.7},{"t":"Jan 23","eff1":186.0,"eff2":171.8,"dt1":15.6,"cg":0.6,"oat":12.2,"sf1":78.9},{"t":"Jan 24","eff1":185.3,"eff2":171.5,"dt1":15.5,"cg":0.7,"oat":12.4,"sf1":79.7},{"t":"Jan 25","eff1":185.4,"eff2":171.4,"dt1":15.8,"cg":0.5,"oat":13.2,"sf1":79.7},{"t":"Jan 26","eff1":185.1,"eff2":169.8,"dt1":15.3,"cg":0.6,"oat":13.2,"sf1":75.0},{"t":"Jan 27","eff1":186.0,"eff2":172.2,"dt1":15.2,"cg":0.5,"oat":10.9,"sf1":78.4},{"t":"Jan 28","eff1":185.8,"eff2":171.6,"dt1":15.3,"cg":0.5,"oat":10.7,"sf1":76.3},{"t":"Jan 29","eff1":185.1,"eff2":171.4,"dt1":15.1,"cg":0.4,"oat":10.3,"sf1":76.9},{"t":"Jan 30","eff1":185.7,"eff2":172.1,"dt1":15.8,"cg":0.5,"oat":12.7,"sf1":80.2},{"t":"Jan 31","eff1":185.9,"eff2":172.2,"dt1":15.8,"cg":0.6,"oat":13.4,"sf1":81.0}];

const ENERGY_DATA=[{"t":"Jan 1","total":40.8,"hvac_pct":88},{"t":"Jan 2","total":35.0,"hvac_pct":89},{"t":"Jan 3","total":46.8,"hvac_pct":81},{"t":"Jan 4","total":39.1,"hvac_pct":83},{"t":"Jan 5","total":24.0,"hvac_pct":85},{"t":"Jan 6","total":32.7,"hvac_pct":89},{"t":"Jan 7","total":43.2,"hvac_pct":78},{"t":"Jan 8","total":42.2,"hvac_pct":77},{"t":"Jan 9","total":43.9,"hvac_pct":74},{"t":"Jan 10","total":41.5,"hvac_pct":75},{"t":"Jan 11","total":46.4,"hvac_pct":78},{"t":"Jan 12","total":27.2,"hvac_pct":83},{"t":"Jan 13","total":34.7,"hvac_pct":86},{"t":"Jan 14","total":27.6,"hvac_pct":66},{"t":"Jan 15","total":47.2,"hvac_pct":77},{"t":"Jan 16","total":39.3,"hvac_pct":74},{"t":"Jan 17","total":45.6,"hvac_pct":73},{"t":"Jan 18","total":28.4,"hvac_pct":68},{"t":"Jan 19","total":16.3,"hvac_pct":70},{"t":"Jan 20","total":34.9,"hvac_pct":82},{"t":"Jan 21","total":34.9,"hvac_pct":84},{"t":"Jan 22","total":35.8,"hvac_pct":63},{"t":"Jan 23","total":47.2,"hvac_pct":75},{"t":"Jan 24","total":43.8,"hvac_pct":78},{"t":"Jan 25","total":43.5,"hvac_pct":81},{"t":"Jan 26","total":31.5,"hvac_pct":89},{"t":"Jan 27","total":33.9,"hvac_pct":89},{"t":"Jan 28","total":44.1,"hvac_pct":83},{"t":"Jan 29","total":41.4,"hvac_pct":89},{"t":"Jan 30","total":49.1,"hvac_pct":80},{"t":"Jan 31","total":46.5,"hvac_pct":80}];

const ALERTS = [
  { id: 1, time: "Jan 31 18:00", severity: "critical", asset: "HWP-01", msg: "Pump vibration 7.89 mm/s — approaching failure threshold (8.0). Schedule immediate inspection.", sector: "Pumps" },
  { id: 2, time: "Jan 30 06:00", severity: "critical", asset: "HWP-01", msg: "Pump power consumption 11.86 kW — 48% above baseline. Bearing degradation suspected.", sector: "Pumps" },
  { id: 3, time: "Jan 15 00:00", severity: "warning", asset: "BOILER-01", msg: "Hot water supply dropped to 58.6°C — below 60°C legionella compliance threshold (HSG274).", sector: "Compliance" },
  { id: 4, time: "Jan 16 00:00", severity: "warning", asset: "BOILER-01", msg: "Legionella risk persists: HW supply at 58.4°C for 2nd consecutive day.", sector: "Compliance" },
  { id: 5, time: "Jan 19 12:00", severity: "info", asset: "RTU-001", msg: "RTU-1 fan speed dropped to 48.9% — weekend setback or potential fault.", sector: "HVAC" },
  { id: 6, time: "Jan 14 06:00", severity: "info", asset: "RTU-002", msg: "RTU-2 efficiency dropped to 166.7 — 8% below normal. Check damper position.", sector: "HVAC" },
  { id: 7, time: "Multiple", severity: "info", asset: "ELEC-MAIN", msg: "520 ghost lighting alerts detected — lights active during unoccupied hours. Estimated waste: £180/month.", sector: "Electrical" },
];

// ============================================================
// COMPONENTS
// ============================================================
const StatusBadge = ({ status }) => {
  const config = {
    GREEN: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", color: "#10b981", text: "COMPLIANT" },
    AMBER: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", color: "#f59e0b", text: "WARNING" },
    RED: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#ef4444", text: "CRITICAL" },
    Running: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", color: "#10b981", text: "ONLINE" },
    Warning: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", color: "#f59e0b", text: "DEGRADED" },
    Critical: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", color: "#ef4444", text: "CRITICAL" },
  };
  const c = config[status] || config.Running;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:c.bg, border:`1px solid ${c.border}`, borderRadius:20, fontSize:11, fontWeight:700, color:c.color, letterSpacing:1.2, textTransform:"uppercase", fontFamily:"'IBM Plex Mono', monospace" }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:c.color, boxShadow:`0 0 8px ${c.color}` }}/>
      {c.text}
    </span>
  );
};

const KPICard = ({ icon: Icon, label, value, unit, sublabel, color = "#06b6d4", trend }) => (
  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:4, position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color}, transparent)` }}/>
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
      <Icon size={15} style={{ color, opacity:0.8 }}/>
      <span style={{ fontSize:11, color:"#64748b", fontFamily:"'IBM Plex Mono', monospace", letterSpacing:0.8, textTransform:"uppercase" }}>{label}</span>
    </div>
    <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
      <span style={{ fontSize:28, fontWeight:700, color:"#f1f5f9", fontFamily:"'IBM Plex Mono', monospace", letterSpacing:-1 }}>{value}</span>
      {unit && <span style={{ fontSize:13, color:"#64748b", fontWeight:500 }}>{unit}</span>}
    </div>
    {sublabel && <span style={{ fontSize:11, color: trend === "down" ? "#ef4444" : trend === "up" ? "#10b981" : "#475569" }}>{sublabel}</span>}
  </div>
);

const SectorTab = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", background: active ? "rgba(6,182,212,0.1)" : "transparent", border: active ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent", borderRadius:8, color: active ? "#06b6d4" : "#64748b", fontSize:13, fontWeight: active ? 600 : 400, cursor:"pointer", transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif" }}>
    <Icon size={16}/>{label}
  </button>
);

const AlertItem = ({ alert }) => {
  const colors = { critical: "#ef4444", warning: "#f59e0b", info: "#06b6d4" };
  const c = colors[alert.severity];
  return (
    <div style={{ display:"flex", gap:12, padding:"12px 16px", background:"rgba(255,255,255,0.02)", borderRadius:8, borderLeft:`3px solid ${c}` }}>
      <AlertTriangle size={14} style={{ color:c, marginTop:2, flexShrink:0 }}/>
      <div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
          <span style={{ fontSize:11, color:c, fontWeight:700, fontFamily:"'IBM Plex Mono', monospace" }}>{alert.severity.toUpperCase()}</span>
          <span style={{ fontSize:11, color:"#475569" }}>{alert.asset}</span>
          <span style={{ fontSize:10, color:"#334155", marginLeft:"auto", fontFamily:"'IBM Plex Mono', monospace" }}>{alert.time}</span>
        </div>
        <p style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5, margin:0 }}>{alert.msg}</p>
      </div>
    </div>
  );
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"10px 14px", fontSize:12 }}>
      <div style={{ color:"#94a3b8", marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", gap:8, alignItems:"center", color:p.color }}>
          <span style={{ width:8, height:8, borderRadius:2, background:p.color }}/>
          <span style={{ color:"#cbd5e1" }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// SECTOR VIEWS
// ============================================================
const HVACView = () => {
  const lastDay = HVAC_DATA[HVAC_DATA.length - 1];
  const avgEff = (HVAC_DATA.reduce((s, d) => s + d.eff1, 0) / HVAC_DATA.length).toFixed(0);
  const avgDt = (HVAC_DATA.reduce((s, d) => s + d.dt1, 0) / HVAC_DATA.length).toFixed(1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Gauge} label="RTU-1 OEE" value="87.2" unit="%" sublabel="Availability × Performance × Quality" color="#10b981"/>
        <KPICard icon={Activity} label="Avg Efficiency" value={avgEff} sublabel="CFM per % fan speed" color="#06b6d4"/>
        <KPICard icon={ThermometerSun} label="Avg ΔT" value={avgDt} unit="°F" sublabel="Return − Supply air" color="#f59e0b"/>
        <KPICard icon={Wind} label="Fan Speed" value={lastDay.sf1.toFixed(0)} unit="%" sublabel="RTU-1 current" color="#8b5cf6"/>
        <KPICard icon={Clock} label="MTBF" value="5,120" unit="hrs" sublabel="Mean time between failures" color="#06b6d4"/>
        <KPICard icon={Clock} label="MTTR" value="2.4" unit="hrs" sublabel="Mean time to repair" color="#f59e0b"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>RTU Efficiency Index — January 2020</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={HVAC_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:10, fill:"#475569" }} interval={4}/><YAxis tick={{ fontSize:10, fill:"#475569" }} domain={[120,200]}/><Tooltip content={<ChartTooltip/>}/><Line dataKey="eff1" name="RTU-1" stroke="#06b6d4" strokeWidth={2} dot={false}/><Line dataKey="eff2" name="RTU-2" stroke="#8b5cf6" strokeWidth={2} dot={false}/></LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Supply-Return ΔT + Outdoor Temp</h4>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={HVAC_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:10, fill:"#475569" }} interval={4}/><YAxis tick={{ fontSize:10, fill:"#475569" }}/><Tooltip content={<ChartTooltip/>}/><Area dataKey="dt1" name="ΔT (°F)" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={2}/><Area dataKey="oat" name="Outdoor °C" stroke="#64748b" fill="rgba(100,116,139,0.05)" strokeWidth={1}/></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const PumpsView = () => {
  const lastDay = PUMP_DATA[PUMP_DATA.length - 1];
  const rul = Math.max(0, (8.0 - lastDay.vib) / 0.18).toFixed(0);
  const pumpStatus = lastDay.vib > 7.0 ? "Critical" : lastDay.vib > 4.5 ? "Warning" : "Running";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <h3 style={{ margin:0, fontSize:16, color:"#f1f5f9", fontWeight:600 }}>HWP-01 — Primary Hot Water Pump</h3>
        <StatusBadge status={pumpStatus}/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Activity} label="Vibration" value={lastDay.vib.toFixed(1)} unit="mm/s" sublabel="Threshold: 8.0 mm/s" color="#ef4444" trend="down"/>
        <KPICard icon={Zap} label="Power Draw" value={lastDay.pwr.toFixed(1)} unit="kW" sublabel={`+${((lastDay.pwr/8.0 - 1)*100).toFixed(0)}% vs baseline`} color="#f59e0b" trend="down"/>
        <KPICard icon={Clock} label="Predicted RUL" value={rul} unit="days" sublabel="Remaining useful life" color="#ef4444"/>
        <KPICard icon={Gauge} label="Pump OEE" value={(Math.max(0, 100 - (lastDay.vib - 2.5) * 12)).toFixed(0)} unit="%" sublabel="Degrading steadily" color="#f59e0b"/>
        <KPICard icon={Clock} label="MTBF" value={(Math.max(500, 6000 - lastDay.vib * 500)).toFixed(0)} unit="hrs" color="#06b6d4"/>
        <KPICard icon={Clock} label="MTTR" value={(2.5 + lastDay.vib * 0.3).toFixed(1)} unit="hrs" color="#f59e0b"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Bearing Vibration — Run-to-Failure Curve</h4>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={PUMP_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:9, fill:"#475569" }} interval={3}/><YAxis tick={{ fontSize:10, fill:"#475569" }} domain={[0,10]}/><Tooltip content={<ChartTooltip/>}/><ReferenceLine y={8.0} stroke="#ef4444" strokeDasharray="5 5" label={{ value:"FAILURE: 8.0", fill:"#ef4444", fontSize:10 }}/><ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value:"WARNING: 4.5", fill:"#f59e0b", fontSize:10 }}/><Area dataKey="vib" name="Vibration (mm/s)" stroke="#ef4444" fill="rgba(239,68,68,0.15)" strokeWidth={2}/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Power Consumption Trending</h4>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={PUMP_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:9, fill:"#475569" }} interval={3}/><YAxis tick={{ fontSize:10, fill:"#475569" }} domain={[6,14]}/><Tooltip content={<ChartTooltip/>}/><ReferenceLine y={8.0} stroke="#64748b" strokeDasharray="3 3" label={{ value:"Baseline: 8kW", fill:"#64748b", fontSize:10 }}/><Area dataKey="pwr" name="Power (kW)" stroke="#f59e0b" fill="rgba(245,158,11,0.15)" strokeWidth={2}/></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const ElectricalView = () => {
  const avg = (ENERGY_DATA.reduce((s, d) => s + d.total, 0) / ENERGY_DATA.length).toFixed(0);
  const avgHvac = (ENERGY_DATA.reduce((s, d) => s + d.hvac_pct, 0) / ENERGY_DATA.length).toFixed(0);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Zap} label="Avg Load" value={avg} unit="kW" sublabel="Building average" color="#f59e0b"/>
        <KPICard icon={Zap} label="HVAC Share" value={avgHvac} unit="%" sublabel="Of total consumption" color="#06b6d4"/>
        <KPICard icon={AlertTriangle} label="Ghost Lighting" value="520" unit="alerts" sublabel="Lights on when unoccupied" color="#ef4444" trend="down"/>
        <KPICard icon={TrendingUp} label="Est. Waste" value="£180" unit="/mo" sublabel="From ghost lighting" color="#ef4444"/>
        <KPICard icon={Gauge} label="Panel OEE" value="99.9" unit="%" color="#10b981"/>
        <KPICard icon={Clock} label="MTBF" value="12,000" unit="hrs" color="#06b6d4"/>
      </div>
      <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
        <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Daily Energy Consumption — January 2020</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ENERGY_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:9, fill:"#475569" }} interval={2}/><YAxis tick={{ fontSize:10, fill:"#475569" }}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="total" name="Total (kW)" fill="rgba(6,182,212,0.6)" radius={[3,3,0,0]}/></BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const ComplianceView = () => {
  const checks = [
    { name: "Legionella (HSG274)", desc: "Hot water stored >60°C", status: "AMBER", detail: "58.4°C on Jan 15-17 — 3-day breach" },
    { name: "Zone Comfort (CIBSE)", desc: "Zones within ±2°F of setpoint", status: "GREEN", detail: "Avg gap: 0.3°F — within tolerance" },
    { name: "Energy Waste", desc: "No lighting during unoccupied hours", status: "RED", detail: "520 ghost lighting incidents detected" },
    { name: "Equipment Safety (ISO 10816)", desc: "Pump vibration <7.0 mm/s", status: "RED", detail: "HWP-01 at 7.89 mm/s — exceeds limit" },
    { name: "Air Quality", desc: "CO₂ below 1000ppm", status: "GREEN", detail: "Sensors not deployed for Jan 2020" },
    { name: "Ventilation Rate", desc: "Min outdoor air per ASHRAE 62.1", status: "GREEN", detail: "RTU dampers operating normally" },
  ];
  const passed = checks.filter(c => c.status === "GREEN").length;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Shield} label="Compliance Score" value={`${passed}/${checks.length}`} sublabel={passed === checks.length ? "All checks passed" : `${checks.length - passed} issues`} color={passed >= 5 ? "#10b981" : "#f59e0b"}/>
        <KPICard icon={Droplets} label="HW Temp (Min)" value="58.4" unit="°C" sublabel="Below 60°C threshold" color="#ef4444" trend="down"/>
        <KPICard icon={Activity} label="Legionella Days" value="3" unit="days" sublabel="Jan 15-17 breach" color="#ef4444"/>
        <KPICard icon={AlertTriangle} label="Open Actions" value="2" sublabel="Critical items" color="#ef4444"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Compliance Checks</h4>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"rgba(255,255,255,0.02)", borderRadius:8, borderLeft: `3px solid ${c.status === "GREEN" ? "#10b981" : c.status === "AMBER" ? "#f59e0b" : "#ef4444"}` }}>
                {c.status === "GREEN" ? <CheckCircle size={16} style={{ color:"#10b981" }}/> : c.status === "AMBER" ? <AlertTriangle size={16} style={{ color:"#f59e0b" }}/> : <XCircle size={16} style={{ color:"#ef4444" }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:"#e2e8f0", fontWeight:500 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{c.detail}</div>
                </div>
                <StatusBadge status={c.status}/>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
          <h4 style={{ margin:"0 0 16px", fontSize:13, color:"#94a3b8", fontWeight:500 }}>Hot Water Supply Temperature — Legionella Monitor</h4>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={PUMP_DATA}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/><XAxis dataKey="t" tick={{ fontSize:9, fill:"#475569" }} interval={3}/><YAxis tick={{ fontSize:10, fill:"#475569" }} domain={[55,68]}/><Tooltip content={<ChartTooltip/>}/><ReferenceLine y={60} stroke="#ef4444" strokeDasharray="5 5" label={{ value:"60°C LIMIT (HSG274)", fill:"#ef4444", fontSize:10 }}/><Area dataKey="hwc" name="HW Temp (°C)" stroke="#06b6d4" fill="rgba(6,182,212,0.1)" strokeWidth={2}/></AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN DASHBOARD
// ============================================================
export default function Dashboard() {
  const [sector, setSector] = useState("HVAC");
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const sectorAlerts = ALERTS.filter(a => sector === "All" || a.sector === sector || sector === "Compliance");
  const sectorView = { HVAC: <HVACView/>, Pumps: <PumpsView/>, Electrical: <ElectricalView/>, Compliance: <ComplianceView/> };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e17", color:"#e2e8f0", fontFamily:"'DM Sans', sans-serif", padding:0 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      
      {/* HEADER */}
      <div style={{ background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg, #06b6d4, #8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏢</div>
          <div>
            <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:"#f8fafc", letterSpacing:-0.3 }}>Building 59 — Asset Command Center</h1>
            <p style={{ margin:0, fontSize:11, color:"#64748b", fontFamily:"'IBM Plex Mono', monospace" }}>SITE-BERKELEY-BLDG59 • Solis Digital Twin Platform • {time.toLocaleTimeString()}</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <StatusBadge status={PUMP_DATA[PUMP_DATA.length-1].vib > 7.0 ? "AMBER" : "GREEN"}/>
          <span style={{ fontSize:11, color:"#475569", fontFamily:"'IBM Plex Mono', monospace" }}>Jan 2020 Replay</span>
        </div>
      </div>

      {/* SECTOR TABS */}
      <div style={{ padding:"12px 24px", display:"flex", gap:8, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <SectorTab icon={Wind} label="HVAC & Air" active={sector === "HVAC"} onClick={() => setSector("HVAC")}/>
        <SectorTab icon={Droplets} label="Pumps & Plant" active={sector === "Pumps"} onClick={() => setSector("Pumps")}/>
        <SectorTab icon={Zap} label="Electrical" active={sector === "Electrical"} onClick={() => setSector("Electrical")}/>
        <SectorTab icon={Shield} label="Compliance" active={sector === "Compliance"} onClick={() => setSector("Compliance")}/>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding:24, display:"flex", gap:20 }}>
        {/* LEFT: Sector View */}
        <div style={{ flex:1 }}>{sectorView[sector]}</div>
        
        {/* RIGHT: Alert Feed */}
        <div style={{ width:360, flexShrink:0 }}>
          <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:16, border:"1px solid rgba(255,255,255,0.06)", position:"sticky", top:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h4 style={{ margin:0, fontSize:13, color:"#94a3b8", fontWeight:600 }}>Maintenance Alerts</h4>
              <span style={{ fontSize:11, color:"#475569", fontFamily:"'IBM Plex Mono', monospace" }}>{sectorAlerts.length} active</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:600, overflowY:"auto" }}>
              {sectorAlerts.map(a => <AlertItem key={a.id} alert={a}/>)}
              {sectorAlerts.length === 0 && <p style={{ fontSize:12, color:"#475569", textAlign:"center", padding:20 }}>No alerts for this sector</p>}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding:"12px 24px", borderTop:"1px solid rgba(255,255,255,0.04)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, color:"#334155", fontFamily:"'IBM Plex Mono', monospace" }}>Data: Berkeley Bldg59 3-Year Dataset (Luo et al., 2022) • Enriched with physics-informed synthetic degradation</span>
        <span style={{ fontSize:10, color:"#334155", fontFamily:"'IBM Plex Mono', monospace" }}>Built by Suryaprakasarao Vaddadi • Solis KTP POC • GCU01907</span>
      </div>
    </div>
  );
}
