import { Activity, Sparkles, AlertTriangle, Info, XCircle, X, History, ChevronRight } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import type { AgentDecision, AlertEvent, TrainState } from "../App";
import StationTimeline from "./StationTimeline";

interface BottomMetricsStripProps {
  telemetry:        string[];
  agentDecisions:   AgentDecision[];
  alerts:           AlertEvent[];
  onClearAlerts:    () => void;
  // NEW
  selectedTrain?:   TrainState | null;
  stationNames?:    Record<string, string>;
  simTime?:         string;
}

type Tab = "telemetry" | "agents" | "alerts" | "timeline";

export default function BottomMetricsStrip({
  telemetry, agentDecisions, alerts, onClearAlerts,
  selectedTrain, stationNames = {}, simTime = "00:00",
}: BottomMetricsStripProps) {
  const [activeTab, setActiveTab] = useState<Tab>("telemetry");
  const telemetryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "telemetry" && telemetryRef.current) {
      telemetryRef.current.scrollTop = telemetryRef.current.scrollHeight;
    }
  }, [telemetry, activeTab]);

  // Auto-switch to timeline when a train is selected
  useEffect(() => {
    if (selectedTrain) setActiveTab("timeline");
  }, [selectedTrain?.train_id]);

  const criticalCount = alerts.filter(a => a.severity === "CRITICAL").length;
  const warnCount     = alerts.filter(a => a.severity === "WARNING").length;

  const severityColor = (s: string) =>
    s === "CRITICAL" ? "#EF4444" : s === "WARNING" ? "#F59E0B" : "#00E5FF";

  const severityIcon = (s: string) =>
    s === "CRITICAL" ? <XCircle className="w-3 h-3" />
    : s === "WARNING" ? <AlertTriangle className="w-3 h-3" />
    : <Info className="w-3 h-3" />;

  const TABS: { id: Tab; label: string; badge?: number; color?: string }[] = [
    { id: "telemetry", label: "Live Telemetry" },
    { id: "agents",    label: "AI Agents",  badge: agentDecisions.length > 0 ? agentDecisions.length : undefined },
    { id: "alerts",    label: "Alerts",     badge: criticalCount || warnCount || undefined, color: criticalCount > 0 ? "#EF4444" : "#F59E0B" },
    { id: "timeline",  label: "Timeline",   badge: selectedTrain ? 1 : undefined, color: selectedTrain?.color },
  ];

  return (
    <div className="flex flex-col shrink-0" style={{ height: 220, borderTop: "1px solid #1E2A45" }}>

      {/* Tab Bar */}
      <div className="flex items-center shrink-0" style={{ borderBottom: "1px solid #1E2A45", backgroundColor: "#0D1421" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? "#E5E7EB" : "#6B7280",
              borderBottom: `2px solid ${activeTab === tab.id ? "#00E5FF" : "transparent"}`,
              fontFamily: "Inter, sans-serif",
              position: "relative",
            }}>
            {tab.id === "telemetry" && <Activity className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? "#10B981" : "#6B7280" }} />}
            {tab.id === "agents"    && <Sparkles  className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? "#F472B6" : "#6B7280" }} />}
            {tab.id === "alerts"    && <AlertTriangle className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? "#F59E0B" : "#6B7280" }} />}
            {tab.id === "timeline"  && <History   className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? (selectedTrain?.color ?? "#8B5CF6") : "#6B7280" }} />}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, lineHeight: 1.4,
                background: tab.color ? `${tab.color}20` : "rgba(107,114,128,0.2)",
                color: tab.color ?? "#9CA3AF",
                border: `1px solid ${tab.color ? `${tab.color}40` : "#374151"}`,
              }}>
                {tab.id === "timeline" && selectedTrain ? selectedTrain.train_id : tab.badge}
              </span>
            )}
          </button>
        ))}

        {/* Clear alerts button — only on alerts tab */}
        {activeTab === "alerts" && alerts.length > 0 && (
          <button onClick={onClearAlerts}
            className="ml-auto flex items-center gap-1 text-[10px] px-3 py-1.5 rounded transition-colors hover:bg-white/5"
            style={{ color: "#374151", marginRight: 8 }}>
            <X className="w-3 h-3" />Clear
          </button>
        )}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">

        {/* ── TELEMETRY ── */}
        {activeTab === "telemetry" && (
          <div ref={telemetryRef} className="h-full overflow-y-auto px-4 py-2 space-y-0.5">
            {telemetry.length === 0 && (
              <span className="text-xs" style={{ color: "#374151" }}>Waiting for train updates...</span>
            )}
            {telemetry.map((line, i) => (
              <div key={i} className="font-mono-custom text-[10px] leading-4" style={{
                color: line.includes("SLOW") || line.includes("⚠") ? "#F59E0B"
                  : line.includes("ARRIVED") ? "#10B981"
                  : line.includes("[SCHED]") ? "#00E5FF"
                  : line.includes("[SIGNAL]") ? "#F472B6"
                  : "#6B7280",
              }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* ── AI AGENTS ── */}
        {activeTab === "agents" && (
          <div className="h-full overflow-y-auto px-4 py-2 space-y-2">
            {agentDecisions.length === 0 && (
              <span className="text-xs" style={{ color: "#374151" }}>No agent decisions yet...</span>
            )}
            {agentDecisions.slice(-10).reverse().map((d, i) => (
              <div key={i} className="pl-3 py-1.5" style={{
                borderLeft: `2px solid ${d.agent_type === "REROUTING" ? "#F472B6" : "#00E5FF"}`,
                animation: "slideInRight 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span style={{
                    color: d.agent_type === "REROUTING" ? "#F472B6" : "#00E5FF",
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.5px",
                  }}>
                    {d.agent_type === "REROUTING" ? "Rerouting Agent" : "Platform Agent"}
                  </span>
                  <ChevronRight className="w-2.5 h-2.5" style={{ color: "#374151" }} />
                  <span style={{ color: "#374151", fontSize: 9 }}>{new Date(d.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ color: "#E5E7EB", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
                  Train {d.train_id}: {d.decision}
                </div>
                <div style={{ color: "#6B7280", fontSize: 9 }}>{d.reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── ALERTS ── */}
        {activeTab === "alerts" && (
          <div className="h-full overflow-y-auto px-4 py-2 space-y-2">
            {alerts.length === 0 && (
              <span className="text-xs" style={{ color: "#374151" }}>No active alerts...</span>
            )}
            {alerts.slice(-15).reverse().map(alert => (
              <div key={alert.id} className="pl-3 py-1.5" style={{ borderLeft: `2px solid ${severityColor(alert.severity)}` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span style={{ color: severityColor(alert.severity) }}>{severityIcon(alert.severity)}</span>
                  <span style={{ color: severityColor(alert.severity), fontSize: 9, fontWeight: 700, textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.5px" }}>
                    {alert.severity}
                  </span>
                  <span style={{ color: "#374151", fontSize: 9 }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ color: "#E5E7EB", fontSize: 10, fontWeight: 500 }}>{alert.message}</div>
                <div style={{ color: "#6B7280", fontSize: 9 }}>{alert.detail}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── STATION TIMELINE ── */}
        {activeTab === "timeline" && (
          <div className="h-full overflow-hidden">
            <StationTimeline
              train={selectedTrain ?? null}
              stationNames={stationNames}
              simTime={simTime}
            />
          </div>
        )}
      </div>
    </div>
  );
}
