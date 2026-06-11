import { Activity, Sparkles, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { useRef, useEffect } from "react";
import type { AgentDecision, AlertEvent } from "../App";

interface BottomMetricsStripProps {
  telemetry: string[];
  agentDecisions: AgentDecision[];
  alerts: AlertEvent[];
  onClearAlerts: () => void;
}

export default function BottomMetricsStrip({
  telemetry,
  agentDecisions,
  alerts,
  onClearAlerts,
}: BottomMetricsStripProps) {
  const telemetryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (telemetryRef.current) {
      telemetryRef.current.scrollTop = telemetryRef.current.scrollHeight;
    }
  }, [telemetry]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "#EF4444";
      case "WARNING": return "#F59E0B";
      case "INFO": return "#00E5FF";
      default: return "#6B7280";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <XCircle className="w-3 h-3" />;
      case "WARNING": return <AlertTriangle className="w-3 h-3" />;
      case "INFO": return <Info className="w-3 h-3" />;
      default: return <Info className="w-3 h-3" />;
    }
  };

  return (
    <div
      className="flex shrink-0 h-48"
      style={{ borderTop: "1px solid #1E2A45" }}
    >
      {/* Live Telemetry */}
      <div className="flex-1 flex flex-col" style={{ borderRight: "1px solid #1E2A45" }}>
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid #1E2A45" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
          <Activity className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
          <span className="font-display text-xs font-semibold" style={{ color: "#E5E7EB" }}>
            Live Telemetry
          </span>
        </div>
        <div
          ref={telemetryRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5"
        >
          {telemetry.length === 0 && (
            <span className="text-xs" style={{ color: "#374151" }}>Waiting for train updates...</span>
          )}
          {telemetry.map((line, i) => {
            const isSlow = line.includes("[SLOW]");
            const isArrived = line.includes("ARRIVED");
            return (
              <div
                key={i}
                className="font-mono-custom text-[10px] leading-4"
                style={{
                  color: isSlow ? "#F59E0B" : isArrived ? "#10B981" : "#6B7280",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Decisions */}
      <div className="flex-1 flex flex-col" style={{ borderRight: "1px solid #1E2A45" }}>
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: "1px solid #1E2A45" }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: "#F472B6" }} />
          <span className="font-display text-xs font-semibold" style={{ color: "#E5E7EB" }}>
            AI Agent Activity
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {agentDecisions.length === 0 && (
            <span className="text-xs" style={{ color: "#374151" }}>No agent decisions yet...</span>
          )}
          {agentDecisions.slice(-5).reverse().map((decision, i) => (
            <div
              key={i}
              className="pl-3 py-1.5"
              style={{
                borderLeft: `2px solid ${decision.agent_type === "REROUTING" ? "#F472B6" : "#00E5FF"}`,
                animation: "slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="text-[9px] font-semibold uppercase"
                  style={{
                    color: decision.agent_type === "REROUTING" ? "#F472B6" : "#00E5FF",
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.5px",
                  }}
                >
                  {decision.agent_type === "REROUTING" ? "Rerouting Agent" : "Platform Agent"}
                </span>
                <span className="text-[9px]" style={{ color: "#374151" }}>
                  {new Date(decision.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-[10px]" style={{ color: "#E5E7EB", fontFamily: "JetBrains Mono, monospace" }}>
                Train {decision.train_id}: {decision.decision}
              </div>
              <div className="text-[9px]" style={{ color: "#6B7280" }}>
                {decision.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid #1E2A45" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
            <span className="font-display text-xs font-semibold" style={{ color: "#E5E7EB" }}>
              Active Alerts
            </span>
          </div>
          {alerts.length > 0 && (
            <button
              onClick={onClearAlerts}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors hover:bg-white/5"
              style={{ color: "#374151" }}
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {alerts.length === 0 && (
            <span className="text-xs" style={{ color: "#374151" }}>No active alerts...</span>
          )}
          {alerts.slice(-5).reverse().map((alert) => (
            <div
              key={alert.id}
              className="pl-3 py-1.5"
              style={{
                borderLeft: `2px solid ${getSeverityColor(alert.severity)}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span style={{ color: getSeverityColor(alert.severity) }}>
                  {getSeverityIcon(alert.severity)}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase"
                  style={{
                    color: getSeverityColor(alert.severity),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.5px",
                  }}
                >
                  {alert.severity}
                </span>
                <span className="text-[9px]" style={{ color: "#374151" }}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-[10px] font-medium" style={{ color: "#E5E7EB" }}>
                {alert.message}
              </div>
              <div className="text-[9px]" style={{ color: "#6B7280" }}>
                {alert.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
