import React, { useState, useEffect } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Activity, Zap, Droplets, ThermometerSun, AlertTriangle, CheckCircle, XCircle, TrendingUp, Clock, Shield, Gauge, Wind, X } from "lucide-react";
import { ContainerClient } from "@azure/storage-blob";

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
    Offline: { bg: "rgba(100,116,139,0.15)", border: "rgba(100,116,139,0.4)", color: "#64748b", text: "OFFLINE" },
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

// ============================================================
// PATCH 2: ASSET MODAL & DRILL-DOWN CARD
// ==========================================
const AssetCard = ({ asset, onClick }) => (
  <div 
    onClick={onClick}
    style={{ 
      background: "rgba(255,255,255,0.03)", 
      border: "1px solid rgba(255,255,255,0.06)", 
      borderRadius: 12, 
      padding: 20,
      cursor: "pointer",
      transition: "transform 0.2s, background 0.2s"
    }}
    onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
    onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
  >
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, color: "#f8fafc" }}>{asset.asset_name}</h3>
        <span style={{ fontSize: 12, color: "#64748b" }}>{asset.asset_id} | {asset.location}</span>
      </div>
      <StatusBadge status={asset.metrics?.status || "Running"} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {asset.metrics && Object.entries(asset.metrics)
        .filter(([k]) => k !== "status")
        .slice(0, 4)
        .map(([key, val]) => (
        <div key={key}>
          <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{key.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 18, color: "#e2e8f0", fontWeight: 600 }}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
        </div>
      ))}
    </div>
  </div>
);

const AssetModal = ({ asset, onClose }) => {
  if (!asset) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
      background: "rgba(10, 14, 23, 0.85)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        background: "#0f172a", border: "1px solid #334155", borderRadius: 16,
        width: "800px", maxWidth: "90vw", padding: 24, position: "relative"
      }}>
        <button 
          onClick={onClose}
          style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
        >
          <X size={24} />
        </button>
        <h2 style={{ margin: "0 0 8px 0", color: "#f8fafc" }}>{asset.asset_name} ({asset.asset_id})</h2>
        <p style={{ color: "#64748b", margin: "0 0 24px 0" }}>Historical Trend Analysis</p>
        <div style={{ height: 300, width: "100%" }}>
          <ResponsiveContainer>
            <LineChart data={asset.history || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              {asset.history && asset.history.length > 0 && Object.keys(asset.history[0]).filter(k => k !== 'time').map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={i === 0 ? "#06b6d4" : "#f59e0b"} strokeWidth={3} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SECTOR VIEWS (Using Dynamic Data)
// ============================================================
const HVACView = ({ data, onAssetClick }) => {
  const hvacData = data.filter(d => d.sector === "HVAC");
  if (hvacData.length === 0) return <div style={{color:"#64748b"}}>Waiting for HVAC data...</div>;
  
  // Calculate Averages safely
  const avgOee = (hvacData.reduce((s, d) => s + (d.metrics?.oee_pct || 0), 0) / hvacData.length).toFixed(1);
  const avgEff = (hvacData.reduce((s, d) => s + (d.metrics?.efficiency_index || 0), 0) / hvacData.length).toFixed(1);
  
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Gauge} label="Avg OEE" value={avgOee} unit="%" color="#10b981"/>
        <KPICard icon={Activity} label="Avg Efficiency" value={avgEff} color="#06b6d4"/>
        <KPICard icon={Wind} label="Active Units" value={hvacData.length} color="#8b5cf6"/>
        <KPICard icon={Clock} label="MTTR" value="2.4" unit="hrs" color="#f59e0b"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {hvacData.map((asset, i) => <AssetCard key={i} asset={asset} onClick={() => onAssetClick(asset)} />)}
      </div>
    </div>
  );
};

const PumpsView = ({ data, onAssetClick }) => {
  const pumpData = data.filter(d => d.sector === "Pumps");
  if (pumpData.length === 0) return <div style={{color:"#64748b"}}>Waiting for Pump data...</div>;
  
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Activity} label="Active Pumps" value={pumpData.length} color="#06b6d4"/>
        <KPICard icon={AlertTriangle} label="Critical Alerts" value={pumpData.filter(p => p.metrics?.status === 'Critical').length} color="#ef4444"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {pumpData.map((asset, i) => <AssetCard key={i} asset={asset} onClick={() => onAssetClick(asset)} />)}
      </div>
    </div>
  );
};

const ElectricalView = ({ data, onAssetClick }) => {
  const elecData = data.filter(d => d.sector === "Electrical");
  if (elecData.length === 0) return <div style={{color:"#64748b"}}>Waiting for Electrical data...</div>;
  
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
       <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
        <KPICard icon={Zap} label="Active Panels" value={elecData.length} color="#f59e0b"/>
        <KPICard icon={TrendingUp} label="Total Load" value={elecData.reduce((s,d) => s + (d.metrics?.total_building_kw || 0), 0).toFixed(1)} unit="kW" color="#06b6d4"/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {elecData.map((asset, i) => <AssetCard key={i} asset={asset} onClick={() => onAssetClick(asset)} />)}
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
  
  // Patch 1: Live Azure Mode vs JSON Offline Mode
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [offlineData, setOfflineData] = useState([]);
  
  // Patch 2: Modal State
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Time ticker
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // INIT: Fetch Offline JSON Data (telemetry_full.json)
  useEffect(() => {
    // import.meta.env.BASE_URL ensures it finds the file on GitHub Pages correctly
    fetch(`${import.meta.env.BASE_URL}telemetry_full.json`)
      .then(res => res.json())
      .then(data => {
        // Handle array or object structure based on your JSON format
        const formattedData = Array.isArray(data) ? data : (data.payloads || []);
        setOfflineData(formattedData);
      })
      .catch(err => console.error("Could not load telemetry_full.json. Make sure it is in the public folder.", err));
  }, []);

  // PATCH 1: Azure Blob Fetcher (Using Container-Level SAS Tokens)
  useEffect(() => {
    let interval;
    if (isLive) {
      const fetchAzureData = async () => {
        try {
          // Pull the 4 separate Container SAS tokens from the .env file
          const sasUrls = {
            "HVAC": import.meta.env.VITE_AZURE_HVAC_SAS,
            "Pumps": import.meta.env.VITE_AZURE_PUMPS_SAS,
            "Electrical": import.meta.env.VITE_AZURE_ELEC_SAS,
            "Compliance": import.meta.env.VITE_AZURE_COMPLIANCE_SAS
          };

          let allLatestData = [];

          // Loop through each container mapping
          for (const [sectorName, sasUrl] of Object.entries(sasUrls)) {
            if (!sasUrl) continue; // Skip if token isn't provided

            // Use ContainerClient specifically since the SAS is restricted to the container
            const containerClient = new ContainerClient(sasUrl);
            let latestBlob = null;
            let latestDate = new Date(0);

            // Find the most recent file in this specific container
            for await (const blob of containerClient.listBlobsFlat()) {
              if (blob.properties.createdOn > latestDate) {
                latestDate = blob.properties.createdOn;
                latestBlob = blob.name;
              }
            }

            // Download and parse it
            if (latestBlob) {
              const blobClient = containerClient.getBlobClient(latestBlob);
              const response = await blobClient.downloadToBuffer();
              const lines = response.toString().split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                allLatestData.push(JSON.parse(lines[lines.length - 1]));
              }
            }
          }
          setLiveData(allLatestData);
        } catch (e) {
          console.error("Failed to fetch from Azure. Check your SAS tokens and CORS rules.", e);
        }
      };

      fetchAzureData();
      interval = setInterval(fetchAzureData, 60000); // Fetch every 60 seconds
    }
    return () => clearInterval(interval);
  }, [isLive]);

  // Determine Active Dataset
  const displayData = isLive && liveData.length > 0 ? liveData : offlineData;

  const sectorView = { 
    HVAC: <HVACView data={displayData} onAssetClick={setSelectedAsset} />, 
    Pumps: <PumpsView data={displayData} onAssetClick={setSelectedAsset} />, 
    Electrical: <ElectricalView data={displayData} onAssetClick={setSelectedAsset} />
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0e17", color:"#e2e8f0", fontFamily:"'DM Sans', sans-serif", padding:0 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      
      {/* HEADER */}
      <div style={{ background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg, #06b6d4, #8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏢</div>
          <div>
            <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:"#f8fafc", letterSpacing:-0.3 }}>Building 59 — Asset Command Center</h1>
            <p style={{ margin:0, fontSize:11, color:"#64748b", fontFamily:"'IBM Plex Mono', monospace" }}>SITE-BERKELEY-BLDG59 • {time.toLocaleTimeString()}</p>
          </div>
        </div>

        {/* PATCH 1: LIVE AZURE TOGGLE */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily:"'IBM Plex Mono', monospace", color: isLive ? "#10b981" : "#64748b" }}>
            {isLive ? "🟢 AZURE IOT LIVE" : "⚪ OFFLINE (JSON MODE)"}
          </span>
          <button 
            onClick={() => setIsLive(!isLive)}
            style={{
              width: 48, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: isLive ? "#10b981" : "#334155", position: "relative", transition: "0.3s"
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 2, left: isLive ? 26 : 2, transition: "0.3s"
            }}/>
          </button>
        </div>
      </div>

      {/* SECTOR TABS */}
      <div style={{ padding:"12px 24px", display:"flex", gap:8, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <SectorTab icon={Wind} label="HVAC & Air" active={sector === "HVAC"} onClick={() => setSector("HVAC")}/>
        <SectorTab icon={Droplets} label="Pumps & Plant" active={sector === "Pumps"} onClick={() => setSector("Pumps")}/>
        <SectorTab icon={Zap} label="Electrical" active={sector === "Electrical"} onClick={() => setSector("Electrical")}/>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding:24, display:"flex", gap:20 }}>
        {/* Sector View */}
        <div style={{ flex:1 }}>
          {sectorView[sector]}
        </div>
      </div>

      {/* PATCH 2: ASSET DRILL-DOWN MODAL */}
      <AssetModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}