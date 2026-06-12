// ═══════════════════════════════════════════════════════════════════
// CHANGE 7 — src/sections/LeftControlPanel.tsx
// NEW FEATURE: "Time Frame" panel section with:
//   • Start time picker (HH:MM input)
//   • Extended speed slider (0.1× to 50×)
//   • Quick preset buttons: 0.5×, 1×, 5×, 10×, 20×, 30×, 50×
// ALSO: old speed slider replaced with extended-range version
// ═══════════════════════════════════════════════════════════════════

import {
  PanelLeft, Play, Pause, Train, AlertTriangle, Clock, LayoutGrid,
} from "lucide-react";
import type { TrainState } from "../App";

interface LeftControlPanelProps {
  collapsed:              boolean;
  onToggleCollapse:       () => void;
  trains:                 TrainState[];
  tracks:                 any[];
  platforms?:             Record<string, any[]>;
  activeTrains:           number;
  congestedTracks:        number;
  avgDelay:               number;
  freePlatforms:          string;
  selectedTrain:          string | null;
  onSelectTrain:          (id: string | null) => void;
  // ── sim controls ──
  simSpeed:               number;
  onSpeedChange:          (speed: number) => void;
  simStartTime:           string;          // NEW
  onStartTimeChange:      (t: string) => void;  // NEW
  isPaused:               boolean;
  onPauseResume:          () => void;
  // ── view toggles ──
  showTrackLabels:        boolean;
  onToggleTrackLabels:    () => void;
  showTrainNames:         boolean;
  onToggleTrainNames:     () => void;
  showAgentDecisions:     boolean;
  onToggleAgentDecisions: () => void;
  layerMode?:             string;
  onLayerModeChange?:     (m: string) => void;
}

// Speed presets for quick selection
const SPEED_PRESETS = [0.5, 1, 5, 10, 20, 50] as const;

export default function LeftControlPanel({
  collapsed,
  onToggleCollapse,
  trains,
  activeTrains,
  congestedTracks,
  avgDelay,
  selectedTrain,
  onSelectTrain,
  simSpeed,
  onSpeedChange,
  simStartTime,
  onStartTimeChange,
  isPaused,
  onPauseResume,
  showTrackLabels,
  onToggleTrackLabels,
  showTrainNames,
  onToggleTrainNames,
  showAgentDecisions,
  onToggleAgentDecisions,
}: LeftControlPanelProps) {
  const sortedTrains = [...trains].sort((a, b) => a.train_id.localeCompare(b.train_id));

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-4 shrink-0"
        style={{ width: 48, borderRight: "1px solid #1E2A45", backgroundColor: "#111827" }}
      >
        <button onClick={onToggleCollapse} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
          <PanelLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>
    );
  }

  const speedPercent = Math.min(100, (simSpeed / 50) * 100);

  return (
    <div
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{ width: 280, borderRight: "1px solid #1E2A45", backgroundColor: "#111827" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1E2A45" }}>
        <span className="font-display text-sm font-semibold" style={{ color: "#E5E7EB" }}>Controls</span>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
          <PanelLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Simulation Controls ──────────────────────────────────────────────── */}
        <div className="panel-card space-y-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Simulation
          </h3>

          <button
            onClick={onPauseResume}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all"
            style={{ backgroundColor: "#1A2236", border: "1px solid #00E5FF", color: "#00E5FF" }}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? "Resume Engine" : "Pause Engine"}
          </button>
        </div>

        {/* ── NEW: Time Frame ──────────────────────────────────────────────────── */}
        <div className="panel-card space-y-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Time Frame
          </h3>

          {/* Start time picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#9CA3AF" }}>Start Time</span>
              <Clock className="w-3 h-3" style={{ color: "#6B7280" }} />
            </div>
            <input
              type="time"
              value={simStartTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-md font-mono-custom"
              style={{
                backgroundColor: "#1A2236",
                border: "1px solid #1E2A45",
                color: "#E5E7EB",
                outline: "none",
                // Extra contrast when focused
              }}
              title="Set the simulation clock start time (HH:MM)"
            />
            <p className="text-[10px]" style={{ color: "#4B5563" }}>
              Jump sim clock to this time for scenario testing
            </p>
          </div>

          {/* Extended speed slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#9CA3AF" }}>Speed</span>
              <span
                className="font-mono-custom text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "#1A2236",
                  color: simSpeed >= 20 ? "#F59E0B" : simSpeed >= 10 ? "#F472B6" : "#00E5FF",
                }}
              >
                {simSpeed < 1 ? `${simSpeed.toFixed(1)}×` : `${Math.round(simSpeed)}×`}
                {simSpeed >= 20 && " 🚀"}
              </span>
            </div>

            {/* Slider: 0.1 to 50 */}
            <input
              type="range"
              min={0.1}
              max={50}
              step={0.1}
              value={simSpeed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #00E5FF 0%, #00E5FF ${speedPercent}%, #1E2A45 ${speedPercent}%, #1E2A45 100%)`,
              }}
            />

            {/* Speed zone labels */}
            <div className="flex justify-between text-[9px]" style={{ color: "#374151" }}>
              <span>0.1×</span>
              <span>Slow</span>
              <span>Normal</span>
              <span>Fast</span>
              <span>50×</span>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-6 gap-1">
              {SPEED_PRESETS.map(preset => {
                const isActive = Math.abs(simSpeed - preset) < 0.1;
                return (
                  <button
                    key={preset}
                    onClick={() => onSpeedChange(preset)}
                    className="py-0.5 text-[10px] rounded font-mono-custom font-semibold transition-all"
                    style={{
                      backgroundColor: isActive ? "rgba(0,229,255,0.15)" : "#1A2236",
                      border: `1px solid ${isActive ? "#00E5FF" : "#1E2A45"}`,
                      color: isActive ? "#00E5FF" : "#6B7280",
                    }}
                    title={`Set speed to ${preset}×`}
                  >
                    {preset}×
                  </button>
                );
              })}
            </div>

            {/* Context tip for ultra-fast */}
            {simSpeed >= 20 && (
              <p className="text-[10px] px-1.5 py-1 rounded" style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B" }}>
                ⚡ Ultra-fast — all features still active
              </p>
            )}
            {simSpeed < 1 && (
              <p className="text-[10px] px-1.5 py-1 rounded" style={{ backgroundColor: "rgba(0,229,255,0.05)", color: "#6B7280" }}>
                🔬 Slow mode — trace individual train behaviour
              </p>
            )}
          </div>
        </div>

        {/* ── View Toggles ─────────────────────────────────────────────────────── */}
        <div className="panel-card space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            View Options
          </h3>
          {[
            { label: "Track Labels",     value: showTrackLabels,     onChange: onToggleTrackLabels },
            { label: "Train Names",      value: showTrainNames,      onChange: onToggleTrainNames },
            { label: "Agent Decisions",  value: showAgentDecisions,  onChange: onToggleAgentDecisions },
          ].map((toggle) => (
            <label key={toggle.label} className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs" style={{ color: "#E5E7EB" }}>{toggle.label}</span>
              <div
                className="w-8 h-4 rounded-full relative transition-colors"
                style={{ backgroundColor: toggle.value ? "#00E5FF" : "#1E2A45" }}
                onClick={toggle.onChange}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: toggle.value ? "translateX(16px)" : "translateX(2px)" }}
                />
              </div>
            </label>
          ))}
        </div>

        {/* ── Active Trains ─────────────────────────────────────────────────────── */}
        <div className="panel-card space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
            Active Trains
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {sortedTrains.map((train) => (
              <button
                key={train.train_id}
                onClick={() => onSelectTrain(selectedTrain === train.train_id ? null : train.train_id)}
                className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors"
                style={{ backgroundColor: selectedTrain === train.train_id ? "#1A2236" : "transparent" }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: train.color, boxShadow: `0 0 4px ${train.color}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-custom text-xs font-medium truncate" style={{ color: "#E5E7EB" }}>
                      {train.train_id}
                    </span>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded font-semibold uppercase"
                      style={{
                        backgroundColor:
                          train.status === "RUNNING"  ? "rgba(16,185,129,0.15)"  :
                          train.status === "REROUTING"? "rgba(244,114,182,0.15)" :
                          ["STOPPED","WAITING"].includes(train.status) ? "rgba(239,68,68,0.15)" :
                          train.delay_minutes > 2     ? "rgba(245,158,11,0.15)"  :
                          "rgba(16,185,129,0.15)",
                        color:
                          train.status === "RUNNING"  ? "#10B981"  :
                          train.status === "REROUTING"? "#F472B6"  :
                          ["STOPPED","WAITING"].includes(train.status) ? "#EF4444" :
                          train.delay_minutes > 2     ? "#F59E0B"  :
                          "#10B981",
                      }}
                    >
                      {train.status === "RUNNING" && train.delay_minutes > 2 ? "DELAYED" : train.status}
                    </span>
                  </div>
                  <span className="text-[10px] block truncate" style={{ color: "#6B7280" }}>
                    {train.current_speed_kmh} km/h
                    {train.delay_minutes > 0 && ` +${train.delay_minutes.toFixed(1)}min`}
                    {train.delay_minutes < 0 && ` ${train.delay_minutes.toFixed(1)}min (early)`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}