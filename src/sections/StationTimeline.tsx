// StationTimeline.tsx — Station-wise schedule timeline panel
// Shows each stop in a train's route with scheduled vs actual times,
// delay badges, and historical stop records.

import { CheckCircle2, Clock, MapPin, Circle, TrendingUp, TrendingDown } from "lucide-react";
import type { TrainState } from "../App";

interface ScheduleStop {
  station_id:          string;
  scheduled_arrival:   string;
  scheduled_departure: string;
  halt_minutes:        number;
  platform_preference: number | null;
  actual_arrival?:     string;
  actual_departure?:   string;
  delay_minutes?:      number;
}

interface StationTimelineProps {
  train: TrainState | null;
  stationNames: Record<string, string>;
  simTime: string;
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function delayColor(min: number): string {
  if (min > 5) return "#EF4444";
  if (min > 1) return "#F59E0B";
  if (min < -1) return "#10B981";
  return "#10B981";
}

function StopRow({
  stop, stationNames, simTime, index, isCurrentRoute, isCurrent,
}: {
  stop: ScheduleStop;
  stationNames: Record<string, string>;
  simTime: string;
  index: number;
  isCurrentRoute: boolean;
  isCurrent: boolean;
}) {
  const simMinutes = parseMinutes(simTime);
  const schedArrMin = parseMinutes(stop.scheduled_arrival);
  const isPast = simMinutes > schedArrMin;
  const hasActual = !!stop.actual_arrival;
  const delay = stop.delay_minutes ?? 0;
  const stationName = stationNames[stop.station_id] || stop.station_id;

  const rowBg = isCurrent
    ? "rgba(0,229,255,0.06)"
    : isPast && hasActual
    ? "rgba(16,185,129,0.04)"
    : "transparent";

  const dotColor = isCurrent ? "#00E5FF"
    : hasActual ? "#10B981"
    : isPast ? "#6B7280"
    : "#374151";

  return (
    <div style={{ display: "flex", gap: 10, padding: "7px 12px", background: rowBg, borderRadius: 6, marginBottom: 2 }}>
      {/* Timeline dot + line */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
        {hasActual ? (
          <CheckCircle2 style={{ width: 12, height: 12, color: "#10B981", flexShrink: 0 }} />
        ) : isCurrent ? (
          <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #00E5FF", background: "rgba(0,229,255,0.2)", flexShrink: 0, animation: "glowPulse 2s ease-in-out infinite" }} />
        ) : (
          <Circle style={{ width: 12, height: 12, color: dotColor, flexShrink: 0 }} />
        )}
        {index < 99 && (
          <div style={{ width: 1, flex: 1, minHeight: 14, background: isPast ? "#1E3A2F" : "#1E2A45", marginTop: 3 }} />
        )}
      </div>

      {/* Stop info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Station name */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <MapPin style={{ width: 9, height: 9, color: isCurrent ? "#00E5FF" : "#8B5CF6", flexShrink: 0 }} />
          <span style={{
            color: isCurrent ? "#00E5FF" : isPast ? "#9CA3AF" : "#E5E7EB",
            fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: isCurrent ? 700 : 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {stationName}
          </span>
          {isCurrent && (
            <span style={{ fontSize: 8, color: "#00E5FF", background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
              NEXT
            </span>
          )}
          {stop.platform_preference && (
            <span style={{ fontSize: 8, color: "#8B5CF6", marginLeft: "auto", flexShrink: 0 }}>
              Plat {stop.platform_preference}
            </span>
          )}
        </div>

        {/* Times row */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Scheduled */}
          <div>
            <div style={{ fontSize: 8, color: "#4B5563", marginBottom: 1, letterSpacing: "0.4px" }}>SCHED</div>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#9CA3AF" }}>
              {stop.scheduled_arrival}
            </span>
            <span style={{ color: "#374151", fontSize: 9, margin: "0 3px" }}>→</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#9CA3AF" }}>
              {stop.scheduled_departure}
            </span>
          </div>

          {/* Actual (if available) */}
          {hasActual && (
            <div>
              <div style={{ fontSize: 8, color: "#4B5563", marginBottom: 1, letterSpacing: "0.4px" }}>ACTUAL</div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: delayColor(delay) }}>
                {stop.actual_arrival}
              </span>
              {stop.actual_departure && (
                <>
                  <span style={{ color: "#374151", fontSize: 9, margin: "0 3px" }}>→</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: delayColor(delay) }}>
                    {stop.actual_departure}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Delay badge */}
          {hasActual && (
            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
              {delay > 1 ? (
                <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, color: delayColor(delay), background: `${delayColor(delay)}18`, border: `1px solid ${delayColor(delay)}44`, borderRadius: 4, padding: "1px 5px" }}>
                  <TrendingUp style={{ width: 8, height: 8 }} />
                  +{delay.toFixed(0)}m
                </span>
              ) : delay < -1 ? (
                <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, color: "#10B981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, padding: "1px 5px" }}>
                  <TrendingDown style={{ width: 8, height: 8 }} />
                  {delay.toFixed(0)}m
                </span>
              ) : (
                <span style={{ fontSize: 9, color: "#10B981", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 4, padding: "1px 5px" }}>
                  ✓
                </span>
              )}
            </div>
          )}

          {/* Halt duration */}
          {stop.halt_minutes > 0 && (
            <span style={{ fontSize: 9, color: "#6B7280", marginLeft: hasActual ? 0 : "auto", flexShrink: 0 }}>
              {stop.halt_minutes}m halt
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StationTimeline({ train, stationNames, simTime }: StationTimelineProps) {
  if (!train) {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <Clock style={{ width: 24, height: 24, color: "#374151", margin: "0 auto 8px" }} />
        <p style={{ color: "#4B5563", fontSize: 11, fontFamily: "Inter, sans-serif" }}>
          Select a train to view its station timeline
        </p>
      </div>
    );
  }

  const schedule: ScheduleStop[] = train.schedule ?? [];

  if (schedule.length === 0) {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <p style={{ color: "#4B5563", fontSize: 11 }}>No schedule data available for {train.train_id}</p>
      </div>
    );
  }

  const nextStopId = train.next_station;
  const completedCount = schedule.filter(s => s.actual_arrival).length;
  const delayedCount = schedule.filter(s => (s.delay_minutes ?? 0) > 1).length;
  const onTimeCount = completedCount - delayedCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #1E2A45" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: train.color, boxShadow: `0 0 6px ${train.color}` }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", color: train.color, fontSize: 12, fontWeight: 700 }}>
            {train.train_id}
          </span>
          <span style={{ color: "#6B7280", fontSize: 10, fontFamily: "Inter, sans-serif" }}>
            {train.name}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#9CA3AF", fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>Stops</div>
            <div style={{ color: "#E5E7EB", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
              {schedule.length}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#9CA3AF", fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>Done</div>
            <div style={{ color: "#10B981", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
              {completedCount}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#9CA3AF", fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>On Time</div>
            <div style={{ color: "#10B981", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
              {onTimeCount}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#9CA3AF", fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>Late</div>
            <div style={{ color: delayedCount > 0 ? "#F59E0B" : "#10B981", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
              {delayedCount}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ color: "#9CA3AF", fontSize: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>Current Delay</div>
            <div style={{ color: delayColor(train.delay_minutes), fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
              {train.delay_minutes > 0 ? `+${train.delay_minutes.toFixed(1)}m` :
               train.delay_minutes < 0 ? `${train.delay_minutes.toFixed(1)}m` :
               "On Time"}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {schedule.map((stop, i) => (
          <StopRow
            key={stop.station_id + i}
            stop={stop}
            stationNames={stationNames}
            simTime={simTime}
            index={i}
            isCurrentRoute={train.route?.includes(stop.station_id) ?? false}
            isCurrent={stop.station_id === nextStopId}
          />
        ))}
      </div>
    </div>
  );
}
