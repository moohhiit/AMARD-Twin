import { useState } from "react";
import {
  PanelLeft, Play, Pause, Clock, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, MapPin, Timer,
} from "lucide-react";
import type { TrainState } from "../App";
type LayerMode = "weather" | "full" | "congestion" | "agent" | "signal";


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
  simSpeed:               number;
  onSpeedChange:          (speed: number) => void;
  simStartTime:           string;
  onStartTimeChange:      (t: string) => void;
  isPaused:               boolean;
  onPauseResume:          () => void;
  showTrackLabels:        boolean;
  onToggleTrackLabels:    () => void;
  showTrainNames:         boolean;
  onToggleTrainNames:     () => void;
  showAgentDecisions:     boolean;
  onToggleAgentDecisions: () => void;
  layerMode?:             string;
  onLayerModeChange?: (m: LayerMode) => void;
}

const SPEED_PRESETS = [0.5, 1, 5, 10, 20, 50] as const;

function DelayBadge({ minutes }: { minutes: number }) {
  if (minutes > 5) return (
    <span style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.3px" }}>
      +{minutes.toFixed(0)}m LATE
    </span>
  );
  if (minutes > 1) return (
    <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px" }}>
      +{minutes.toFixed(0)}m
    </span>
  );
  if (minutes < -1) return (
    <span style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px" }}>
      {minutes.toFixed(0)}m EARLY
    </span>
  );
  return (
    <span style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)", fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "1px 5px" }}>
      ON TIME
    </span>
  );
}

function StatusBadge({ status, delay }: { status: string; delay: number }) {
  const isDelayed = status === "RUNNING" && delay > 2;
  const cfg = isDelayed ? { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", label: "DELAYED" }
    : status === "RUNNING"   ? { bg: "rgba(16,185,129,0.15)",  color: "#10B981", label: "RUNNING" }
    : status === "REROUTING" ? { bg: "rgba(244,114,182,0.15)", color: "#F472B6", label: "REROUTING" }
    : status === "BRAKING"   ? { bg: "rgba(239,68,68,0.15)",   color: "#EF4444", label: "BRAKING" }
    : status === "WAITING"   ? { bg: "rgba(107,114,128,0.15)", color: "#9CA3AF", label: "WAITING" }
    : status === "STOPPED"   ? { bg: "rgba(239,68,68,0.15)",   color: "#EF4444", label: "STOPPED" }
    :                          { bg: "rgba(107,114,128,0.15)", color: "#6B7280",  label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.3px" }}>
      {cfg.label}
    </span>
  );
}

function TrainDetailCard({ train }: { train: TrainState }) {
  const progress = train.position?.progress_percent ?? 0;
  const eta = train.distance_to_next_km > 0 && train.current_speed_kmh > 0
    ? Math.round((train.distance_to_next_km / train.current_speed_kmh) * 60)
    : null;

  return (
    <div style={{ background: "#0F1829", border: "1px solid #1E2A45", borderRadius: 8, padding: "10px 12px", marginTop: 8, marginBottom: 4 }}>
      {/* Train name & type */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div>
          <span className="font-mono-custom" style={{ color: train.color, fontSize: 11, fontWeight: 700 }}>
            {train.name}
          </span>
          <span style={{ color: "#6B7280", fontSize: 9, marginLeft: 6, fontFamily: "Inter, sans-serif" }}>
            {train.type}
          </span>
        </div>
        <DelayBadge minutes={train.delay_minutes} />
      </div>

      {/* Speed */}
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span style={{ color: "#6B7280", fontSize: 10 }}>Speed</span>
        <span className="font-mono-custom" style={{ color: "#E5E7EB", fontSize: 11, fontWeight: 600 }}>
          {train.current_speed_kmh} <span style={{ color: "#6B7280", fontSize: 9 }}>km/h</span>
        </span>
      </div>

      {/* Route Progress Bar */}
      <div style={{ marginBottom: 8 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
          <span style={{ color: "#6B7280", fontSize: 10 }}>Route Progress</span>
          <span className="font-mono-custom" style={{ color: "#E5E7EB", fontSize: 10 }}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: 4, background: "#1E2A45", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: `linear-gradient(90deg, ${train.color}, ${train.color}aa)`,
            borderRadius: 2, transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Next Station & ETA */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 5 }}>
        <MapPin className="w-3 h-3" style={{ color: "#8B5CF6", flexShrink: 0 }} />
        <span style={{ color: "#9CA3AF", fontSize: 10 }}>Next:</span>
        <span className="font-mono-custom" style={{ color: "#E5E7EB", fontSize: 10, fontWeight: 600 }}>
          {train.next_station || "—"}
        </span>
        {train.distance_to_next_km > 0 && (
          <span style={{ color: "#6B7280", fontSize: 9, marginLeft: "auto" }}>
            {train.distance_to_next_km.toFixed(1)} km
          </span>
        )}
      </div>

      {/* ETA */}
      {eta !== null && (
        <div className="flex items-center gap-1.5" style={{ marginBottom: 5 }}>
          <Timer className="w-3 h-3" style={{ color: "#00E5FF", flexShrink: 0 }} />
          <span style={{ color: "#9CA3AF", fontSize: 10 }}>ETA:</span>
          <span className="font-mono-custom" style={{ color: "#00E5FF", fontSize: 10, fontWeight: 600 }}>
            {eta < 1 ? "< 1 min" : `${eta} min`}
          </span>
        </div>
      )}

      {/* Segment */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 5 }}>
        <span style={{ color: "#6B7280", fontSize: 10 }}>Segment:</span>
        <span className="font-mono-custom" style={{ color: "#9CA3AF", fontSize: 10 }}>
          {train.current_segment || "—"}
        </span>
      </div>

      {/* Signal & Weather row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span style={{
            width: 7, height: 7, borderRadius: "50%", display: "inline-block",
            background: train.signal === "GREEN" ? "#10B981" : train.signal === "YELLOW" ? "#F59E0B" : "#EF4444",
            boxShadow: `0 0 4px ${train.signal === "GREEN" ? "#10B981" : train.signal === "YELLOW" ? "#F59E0B" : "#EF4444"}`,
          }} />
          <span style={{ color: "#6B7280", fontSize: 9 }}>{train.signal}</span>
        </div>
        {train.weather !== "CLEAR" && (
          <span style={{ color: "#F59E0B", fontSize: 9, background: "rgba(245,158,11,0.1)", padding: "1px 5px", borderRadius: 3 }}>
            {train.weather}
          </span>
        )}
        {train.on_loop_line && (
          <span style={{ color: "#8B5CF6", fontSize: 9, background: "rgba(139,92,246,0.1)", padding: "1px 5px", borderRadius: 3 }}>
            LOOP
          </span>
        )}
      </div>

      {/* Platform */}
      {train.assigned_platform && (
        <div style={{ marginTop: 5, color: "#6B7280", fontSize: 10 }}>
          Platform: <span className="font-mono-custom" style={{ color: "#E5E7EB" }}>#{train.assigned_platform}</span>
          {train.current_station && (
            <span style={{ color: "#6B7280" }}> @ {train.current_station}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeftControlPanel({
  collapsed, onToggleCollapse, trains,
  selectedTrain, onSelectTrain,
  simSpeed, onSpeedChange,
  simStartTime, onStartTimeChange,
  isPaused, onPauseResume,
  showTrackLabels, onToggleTrackLabels,
  showTrainNames, onToggleTrainNames,
  showAgentDecisions, onToggleAgentDecisions,
}: LeftControlPanelProps) {
  const [trainListExpanded, setTrainListExpanded] = useState(true);
  const sortedTrains = [...trains].sort((a, b) => a.train_id.localeCompare(b.train_id));
  const selectedTrainData = selectedTrain ? trains.find(t => t.train_id === selectedTrain) : null;
  const speedPercent = Math.min(100, (simSpeed / 50) * 100);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-4 shrink-0"
        style={{ width: 48, borderRight: "1px solid #1E2A45", backgroundColor: "#111827" }}>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
          <PanelLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col shrink-0 overflow-y-auto"
      style={{ width: 280, borderRight: "1px solid #1E2A45", backgroundColor: "#111827" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1E2A45" }}>
        <span className="font-display text-sm font-semibold" style={{ color: "#E5E7EB" }}>Controls</span>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-md hover:bg-white/5 transition-colors">
          <PanelLeft className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Sim Controls ── */}
        <div className="panel-card space-y-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>Simulation</h3>
          <button onClick={onPauseResume}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all"
            style={{ backgroundColor: "#1A2236", border: "1px solid #00E5FF", color: "#00E5FF" }}>
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? "Resume Engine" : "Pause Engine"}
          </button>
        </div>

        {/* ── Time Frame ── */}
        <div className="panel-card space-y-3">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>Time Frame</h3>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#9CA3AF" }}>Start Time</span>
              <Clock className="w-3 h-3" style={{ color: "#6B7280" }} />
            </div>
            <input type="time" value={simStartTime} onChange={e => onStartTimeChange(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-md font-mono-custom"
              style={{ backgroundColor: "#1A2236", border: "1px solid #1E2A45", color: "#E5E7EB", outline: "none" }} />
            <p className="text-[10px]" style={{ color: "#4B5563" }}>Jump sim clock to this time</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#9CA3AF" }}>Speed</span>
              <span className="font-mono-custom text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "#1A2236", color: simSpeed >= 20 ? "#F59E0B" : simSpeed >= 10 ? "#F472B6" : "#00E5FF" }}>
                {simSpeed < 1 ? `${simSpeed.toFixed(1)}×` : `${Math.round(simSpeed)}×`}
                {simSpeed >= 20 && " 🚀"}
              </span>
            </div>
            <input type="range" min={0.1} max={50} step={0.1} value={simSpeed}
              onChange={e => onSpeedChange(parseFloat(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #00E5FF 0%, #00E5FF ${speedPercent}%, #1E2A45 ${speedPercent}%, #1E2A45 100%)` }} />
            <div className="flex justify-between text-[9px]" style={{ color: "#374151" }}>
              <span>0.1×</span><span>Slow</span><span>Normal</span><span>Fast</span><span>50×</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {SPEED_PRESETS.map(preset => {
                const isActive = Math.abs(simSpeed - preset) < 0.1;
                return (
                  <button key={preset} onClick={() => onSpeedChange(preset)}
                    className="py-0.5 text-[10px] rounded font-mono-custom font-semibold transition-all"
                    style={{
                      backgroundColor: isActive ? "rgba(0,229,255,0.15)" : "#1A2236",
                      border: `1px solid ${isActive ? "#00E5FF" : "#1E2A45"}`,
                      color: isActive ? "#00E5FF" : "#6B7280",
                    }}>
                    {preset}×
                  </button>
                );
              })}
            </div>
            {simSpeed >= 20 && (
              <p className="text-[10px] px-1.5 py-1 rounded" style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#F59E0B" }}>
                ⚡ Ultra-fast mode active
              </p>
            )}
          </div>
        </div>

        {/* ── View Toggles ── */}
        <div className="panel-card space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>View Options</h3>
          {[
            { label: "Track Labels",    value: showTrackLabels,    onChange: onToggleTrackLabels },
            { label: "Train Names",     value: showTrainNames,     onChange: onToggleTrainNames },
            { label: "Agent Decisions", value: showAgentDecisions, onChange: onToggleAgentDecisions },
          ].map(toggle => (
            <label key={toggle.label} className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-xs" style={{ color: "#E5E7EB" }}>{toggle.label}</span>
              <div className="w-8 h-4 rounded-full relative transition-colors"
                style={{ backgroundColor: toggle.value ? "#00E5FF" : "#1E2A45" }}
                onClick={toggle.onChange}>
                <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: toggle.value ? "translateX(16px)" : "translateX(2px)" }} />
              </div>
            </label>
          ))}
        </div>

        {/* ── Selected Train Detail ── */}
        {selectedTrainData && (
          <div className="panel-card space-y-1">
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Selected Train
            </h3>
            <TrainDetailCard train={selectedTrainData} />
          </div>
        )}

        {/* ── Active Trains List ── */}
        <div className="panel-card space-y-2">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setTrainListExpanded(p => !p)}>
            <h3 className="font-display text-xs font-semibold uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Active Trains ({sortedTrains.length})
            </h3>
            {trainListExpanded
              ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />
              : <ChevronRight className="w-3.5 h-3.5" style={{ color: "#6B7280" }} />}
          </button>

          {trainListExpanded && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {sortedTrains.map(train => (
                <button key={train.train_id}
                  onClick={() => onSelectTrain(selectedTrain === train.train_id ? null : train.train_id)}
                  className="w-full text-left px-2 py-2 rounded-md transition-colors"
                  style={{
                    backgroundColor: selectedTrain === train.train_id ? "#1A2236" : "transparent",
                    border: selectedTrain === train.train_id ? "1px solid #1E2A45" : "1px solid transparent",
                  }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: train.color, boxShadow: `0 0 4px ${train.color}` }} />
                    <span className="font-mono-custom text-xs font-medium" style={{ color: "#E5E7EB", flex: 1 }}>
                      {train.train_id}
                    </span>
                    <StatusBadge status={train.status} delay={train.delay_minutes} />
                  </div>

                  {/* Speed + delay row */}
                  <div className="flex items-center gap-2 ml-4">
                    <span style={{ color: "#6B7280", fontSize: 10 }}>
                      {train.current_speed_kmh} km/h
                    </span>
                    {/* delay indicator icon */}
                    {train.delay_minutes > 2 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#F59E0B", fontSize: 10 }}>
                        <TrendingUp className="w-2.5 h-2.5" />
                        +{train.delay_minutes.toFixed(0)}m
                      </span>
                    )}
                    {train.delay_minutes < -1 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#10B981", fontSize: 10 }}>
                        <TrendingDown className="w-2.5 h-2.5" />
                        {train.delay_minutes.toFixed(0)}m
                      </span>
                    )}
                    {Math.abs(train.delay_minutes) <= 1 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#10B981", fontSize: 10 }}>
                        <Minus className="w-2.5 h-2.5" />
                        On time
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {train.position && (
                    <div className="ml-4 mt-1">
                      <div style={{ height: 2, background: "#1E2A45", borderRadius: 1, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${train.position.progress_percent ?? 0}%`,
                          background: train.color,
                          borderRadius: 1,
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
