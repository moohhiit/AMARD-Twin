// StationTimeline.tsx
// Shows a train's complete station-by-station journey:
//   - Visual route progress bar (stations done vs remaining)
//   - Per-stop: scheduled arrival/departure, actual times, delay badge
//   - Current position clearly marked with animated dot
//   - PAST stops (already visited) vs UPCOMING stops clearly differentiated

import { CheckCircle2, Clock, MapPin, Circle, TrendingUp, TrendingDown, Train } from "lucide-react";
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
  train:        TrainState | null;
  stationNames: Record<string, string>;
  simTime:      string;
}

function parseMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function delayColor(min: number): string {
  if (min > 5)  return "#EF4444";
  if (min > 1)  return "#F59E0B";
  if (min < -1) return "#10B981";
  return "#10B981";
}

// Determine if a stop is "current" — train is between this stop and the next one
// Logic: current stop = the next unvisited stop in the schedule that matches next_station,
// OR if no actual_arrival yet and scheduled time is near/past simTime
function findCurrentStopIndex(schedule: ScheduleStop[], train: TrainState, simMinutes: number): number {
  // First: try matching next_station directly to a stop
  const byNextStation = schedule.findIndex(s => s.station_id === train.next_station);
  if (byNextStation >= 0) return byNextStation;

  // Second: find first stop without actual_arrival whose scheduled time has passed
  const firstUnvisited = schedule.findIndex(s => !s.actual_arrival);
  if (firstUnvisited >= 0) return firstUnvisited;

  return -1;
}

export default function StationTimeline({ train, stationNames, simTime }: StationTimelineProps) {
  if (!train) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <Train style={{ width: 28, height: 28, color: "#374151" }} />
        <p style={{ color: "#4B5563", fontSize: 11, fontFamily: "Inter, sans-serif", textAlign: "center" }}>
          Select a train on the map or list<br />to view its station timeline
        </p>
      </div>
    );
  }

  const schedule: ScheduleStop[] = (train.schedule ?? []) as ScheduleStop[];
  const simMinutes = parseMinutes(simTime);

  if (schedule.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
        <Clock style={{ width: 24, height: 24, color: "#374151" }} />
        <p style={{ color: "#4B5563", fontSize: 11 }}>No schedule data for {train.train_id}</p>
      </div>
    );
  }

  const currentIdx   = findCurrentStopIndex(schedule, train, simMinutes);
  const completedCount = schedule.filter(s => !!s.actual_arrival).length;
  // Stops considered done = stops before currentIdx (already passed)
  const pastCount    = currentIdx >= 0 ? currentIdx : completedCount;
  const totalStops   = schedule.length;
  const progressPct  = totalStops > 1 ? Math.round((pastCount / (totalStops - 1)) * 100) : 0;
  const remainCount  = totalStops - pastCount - 1; // stops still ahead (not including current)
  const delayedCount = schedule.filter(s => (s.delay_minutes ?? 0) > 1).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #1E2A45", flexShrink: 0 }}>
        {/* Train identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: train.color, boxShadow: `0 0 6px ${train.color}`, flexShrink: 0 }} />
          <span style={{ fontFamily: "JetBrains Mono, monospace", color: train.color, fontSize: 12, fontWeight: 700 }}>
            {train.train_id}
          </span>
          <span style={{ color: "#6B7280", fontSize: 10, fontFamily: "Inter, sans-serif" }}>
            {train.name} · {train.type}
          </span>
          <span style={{
            marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
            color: train.delay_minutes > 2 ? "#F59E0B" : train.delay_minutes < -1 ? "#10B981" : "#10B981",
            background: train.delay_minutes > 2 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)",
            border: `1px solid ${train.delay_minutes > 2 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`,
          }}>
            {train.delay_minutes > 2 ? `+${train.delay_minutes.toFixed(1)}m LATE`
              : train.delay_minutes < -1 ? `${train.delay_minutes.toFixed(1)}m EARLY`
              : "ON TIME"}
          </span>
        </div>

        {/* ── ROUTE PROGRESS BAR ── */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#6B7280", fontFamily: "Inter, sans-serif" }}>
              Route Progress
            </span>
            <span style={{ fontSize: 9, color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>
              {pastCount} done · <span style={{ color: "#00E5FF" }}>at stop {currentIdx + 1}</span> · {remainCount} ahead
            </span>
          </div>

          {/* Station dots progress track */}
          <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
            {/* Base track line */}
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "#1E2A45", borderRadius: 1 }} />
            {/* Filled progress */}
            <div style={{
              position: "absolute", left: 0, height: 2,
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${train.color}, ${train.color}bb)`,
              borderRadius: 1, transition: "width 0.8s ease",
            }} />

            {/* Station dots along the bar */}
            {schedule.map((stop, i) => {
              const leftPct = totalStops > 1 ? (i / (totalStops - 1)) * 100 : 50;
              const isPast    = i < currentIdx;
              const isCurrent = i === currentIdx;
              const isFuture  = i > currentIdx;

              return (
                <div key={stop.station_id + i} style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  transform: "translateX(-50%)",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  zIndex: isCurrent ? 3 : 1,
                }}>
                  <div style={{
                    width: isCurrent ? 10 : 6,
                    height: isCurrent ? 10 : 6,
                    borderRadius: "50%",
                    background: isPast ? train.color
                      : isCurrent ? "#00E5FF"
                      : "#374151",
                    border: isCurrent ? "2px solid #00E5FF" : isPast ? "none" : "1px solid #4B5563",
                    boxShadow: isCurrent ? "0 0 8px rgba(0,229,255,0.7)" : "none",
                    transition: "all 0.3s ease",
                    animation: isCurrent ? "glowPulse 2s ease-in-out infinite" : "none",
                  }} />
                </div>
              );
            })}
          </div>

          {/* Start / End labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 8, color: "#4B5563", fontFamily: "JetBrains Mono, monospace" }}>
              {stationNames[schedule[0]?.station_id] ?? schedule[0]?.station_id}
            </span>
            <span style={{ fontSize: 8, color: "#4B5563", fontFamily: "JetBrains Mono, monospace" }}>
              {stationNames[schedule[totalStops - 1]?.station_id] ?? schedule[totalStops - 1]?.station_id}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 14, marginTop: 2 }}>
          {[
            { label: "TOTAL",   value: totalStops,     color: "#E5E7EB" },
            { label: "DONE",    value: pastCount,      color: "#10B981" },
            { label: "AHEAD",   value: remainCount,    color: "#6B7280" },
            { label: "DELAYED", value: delayedCount,   color: delayedCount > 0 ? "#F59E0B" : "#10B981" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 7.5, color: "#4B5563", letterSpacing: "0.5px", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ fontSize: 14, color: s.color, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, lineHeight: 1.1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STOP LIST ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {schedule.map((stop, i) => {
          const isPast    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture  = i > currentIdx;
          const hasActual = !!stop.actual_arrival;
          const delay     = stop.delay_minutes ?? 0;
          const name      = stationNames[stop.station_id] || stop.station_id;

          const rowBg = isCurrent ? "rgba(0,229,255,0.05)"
            : isPast   ? "rgba(16,185,129,0.03)"
            : "transparent";

          return (
            <div key={stop.station_id + i}
              style={{ display: "flex", gap: 10, padding: "6px 14px", background: rowBg, borderRadius: 5, marginBottom: 1 }}>

              {/* Timeline connector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0, paddingTop: 2 }}>
                {/* Dot */}
                {hasActual ? (
                  <CheckCircle2 style={{ width: 13, height: 13, color: "#10B981", flexShrink: 0 }} />
                ) : isCurrent ? (
                  <div style={{
                    width: 13, height: 13, borderRadius: "50%",
                    border: "2px solid #00E5FF",
                    background: "rgba(0,229,255,0.2)",
                    animation: "glowPulse 2s ease-in-out infinite",
                    flexShrink: 0,
                  }} />
                ) : (
                  <Circle style={{ width: 13, height: 13, color: isFuture ? "#374151" : "#6B7280", flexShrink: 0 }} />
                )}
                {/* Line to next */}
                {i < totalStops - 1 && (
                  <div style={{
                    width: 1.5, flex: 1, minHeight: 12, marginTop: 3,
                    background: isPast ? train.color + "60" : "#1E2A45",
                    borderRadius: 1,
                  }} />
                )}
              </div>

              {/* Stop content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Station name row */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <MapPin style={{ width: 9, height: 9, color: isCurrent ? "#00E5FF" : isPast ? "#6B7280" : "#8B5CF6", flexShrink: 0 }} />
                  <span style={{
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: isCurrent ? 700 : isPast ? 400 : 500,
                    color: isCurrent ? "#00E5FF" : isPast ? "#6B7280" : "#E5E7EB",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flex: 1,
                  }}>
                    {name}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 8, color: "#00E5FF", background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
                      ▶ NEXT
                    </span>
                  )}
                  {stop.platform_preference && (
                    <span style={{ fontSize: 8, color: "#8B5CF6", flexShrink: 0 }}>
                      P{stop.platform_preference}
                    </span>
                  )}
                </div>

                {/* Times */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  {/* Scheduled */}
                  <div>
                    <div style={{ fontSize: 8, color: "#374151", marginBottom: 1, letterSpacing: "0.3px", textTransform: "uppercase" }}>Scheduled</div>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: isPast && hasActual ? "#4B5563" : "#9CA3AF" }}>
                      {stop.scheduled_arrival}
                    </span>
                    <span style={{ color: "#374151", fontSize: 9, margin: "0 3px" }}>–</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: isPast && hasActual ? "#4B5563" : "#9CA3AF" }}>
                      {stop.scheduled_departure}
                    </span>
                  </div>

                  {/* Actual */}
                  {hasActual && (
                    <div>
                      <div style={{ fontSize: 8, color: "#374151", marginBottom: 1, letterSpacing: "0.3px", textTransform: "uppercase" }}>Actual</div>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: delayColor(delay), fontWeight: 600 }}>
                        {stop.actual_arrival}
                      </span>
                      {stop.actual_departure && (
                        <>
                          <span style={{ color: "#374151", fontSize: 9, margin: "0 3px" }}>–</span>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: delayColor(delay), fontWeight: 600 }}>
                            {stop.actual_departure}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Delay badge */}
                  {hasActual && (
                    <div style={{ marginLeft: "auto" }}>
                      {delay > 1 ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, fontWeight: 700, color: delayColor(delay), background: `${delayColor(delay)}18`, border: `1px solid ${delayColor(delay)}44`, borderRadius: 4, padding: "1px 5px" }}>
                          <TrendingUp style={{ width: 8, height: 8 }} />
                          +{delay.toFixed(0)}m
                        </span>
                      ) : delay < -1 ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9, fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 4, padding: "1px 5px" }}>
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

                  {/* Future stop — show halt only */}
                  {!hasActual && stop.halt_minutes > 0 && (
                    <span style={{ fontSize: 9, color: "#4B5563", marginLeft: "auto" }}>
                      {stop.halt_minutes}m halt
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
