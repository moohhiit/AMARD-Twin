/**
 * TrainSchedulePanel.tsx
 * 
 * Dedicated panel showing a selected train's COMPLETE route path:
 *  - All stations with scheduled arrival + departure times
 *  - Actual times when available (after train passes)
 *  - Delay badges per stop
 *  - Visual route progress (station dots connected by track line)
 *  - Current position marker
 *  - Train summary header (type, speed, delay, next stop)
 */

import { Train, MapPin,  TrendingUp, TrendingDown, CheckCircle2, Circle, ChevronRight } from "lucide-react";
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

interface TrainSchedulePanelProps {
  trains:       TrainState[];
  selectedTrain: string | null;
  onSelectTrain: (id: string | null) => void;
  stationNames:  Record<string, string>;
  simTime:       string;
}



function delayColor(min: number) {
  if (min > 5)  return "#EF4444";
  if (min > 1)  return "#F59E0B";
  if (min < -1) return "#10B981";
  return "#10B981";
}

function DelayBadge({ minutes }: { minutes: number }) {
  if (minutes > 1) return (
    <span style={{ display:"flex", alignItems:"center", gap:2, fontSize:9, fontWeight:700,
      color: delayColor(minutes),
      background: `${delayColor(minutes)}18`,
      border: `1px solid ${delayColor(minutes)}44`,
      borderRadius:4, padding:"1px 5px" }}>
      <TrendingUp style={{ width:8, height:8 }} />
      +{minutes.toFixed(0)}m
    </span>
  );
  if (minutes < -1) return (
    <span style={{ display:"flex", alignItems:"center", gap:2, fontSize:9, fontWeight:700,
      color:"#10B981", background:"rgba(16,185,129,0.1)",
      border:"1px solid rgba(16,185,129,0.3)", borderRadius:4, padding:"1px 5px" }}>
      <TrendingDown style={{ width:8, height:8 }} />
      {minutes.toFixed(0)}m
    </span>
  );
  return (
    <span style={{ fontSize:9, color:"#10B981", background:"rgba(16,185,129,0.08)",
      border:"1px solid rgba(16,185,129,0.2)", borderRadius:4, padding:"1px 5px" }}>✓</span>
  );
}

function findCurrentIdx(schedule: ScheduleStop[], train: TrainState): number {
  // Match by next_station first
  const byNext = schedule.findIndex(s => s.station_id === train.next_station);
  if (byNext >= 0) return byNext;
  // Else first stop without actual_arrival
  const firstUnvisited = schedule.findIndex(s => !s.actual_arrival);
  return firstUnvisited >= 0 ? firstUnvisited : schedule.length - 1;
}

// ── Train Selector ────────────────────────────────────────────────────────────
function TrainSelector({ trains, selectedTrain, onSelectTrain }: {
  trains: TrainState[];
  selectedTrain: string | null;
  onSelectTrain: (id: string | null) => void;
}) {
  const sorted = [...trains].sort((a, b) => a.train_id.localeCompare(b.train_id));
  return (
    <div style={{ padding:"8px 10px", borderBottom:"1px solid #1E2A45" }}>
      <div style={{ color:"#6B7280", fontSize:9, letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:6 }}>
        Select Train
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {sorted.map(t => (
          <button key={t.train_id}
            onClick={() => onSelectTrain(selectedTrain === t.train_id ? null : t.train_id)}
            style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"4px 8px", borderRadius:5, cursor:"pointer",
              background: selectedTrain === t.train_id ? `${t.color}20` : "#1A2236",
              border: `1px solid ${selectedTrain === t.train_id ? t.color : "#1E2A45"}`,
              transition:"all 0.15s ease",
            }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:t.color,
              boxShadow: selectedTrain === t.train_id ? `0 0 6px ${t.color}` : "none" }} />
            <span style={{ fontSize:10, fontFamily:"JetBrains Mono, monospace",
              color: selectedTrain === t.train_id ? t.color : "#9CA3AF", fontWeight:600 }}>
              {t.train_id}
            </span>
            {t.delay_minutes > 2 && (
              <span style={{ fontSize:8, color:"#F59E0B" }}>+{t.delay_minutes.toFixed(0)}m</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Full Schedule View ────────────────────────────────────────────────────────
function ScheduleView({ train, stationNames }: {
  train: TrainState;
  stationNames: Record<string, string>;
  simTime: string;
}) {
  const schedule = (train.schedule ?? []) as ScheduleStop[];

  if (schedule.length === 0) {
    return (
      <div style={{ padding:20, textAlign:"center", color:"#4B5563", fontSize:11 }}>
        No schedule data available.<br />
        <span style={{ fontSize:10 }}>Run <code style={{ color:"#00E5FF" }}>npm run seed:mongo</code> to seed train schedules.</span>
      </div>
    );
  }

  const currentIdx   = findCurrentIdx(schedule, train);
  const pastCount    = currentIdx;
  const totalStops   = schedule.length;
  const progressPct  = totalStops > 1 ? (pastCount / (totalStops - 1)) * 100 : 0;
  const delayedStops = schedule.filter(s => (s.delay_minutes ?? 0) > 1).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* ── Train Header ── */}
      <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid #1E2A45", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
          <Train style={{ width:14, height:14, color:train.color, flexShrink:0 }} />
          <span style={{ fontFamily:"JetBrains Mono, monospace", color:train.color, fontSize:13, fontWeight:700 }}>
            {train.train_id}
          </span>
          <span style={{ color:"#6B7280", fontSize:10 }}>{train.name}</span>
          <span style={{ color:"#4B5563", fontSize:9, background:"#1A2236",
            border:"1px solid #1E2A45", borderRadius:3, padding:"1px 5px" }}>
            {train.type}
          </span>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
            {/* Current delay status */}
            <span style={{
              fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:5,
              color: train.delay_minutes > 2 ? "#F59E0B" : train.delay_minutes < -1 ? "#10B981" : "#10B981",
              background: train.delay_minutes > 2 ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)",
              border: `1px solid ${train.delay_minutes > 2 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`,
            }}>
              {train.delay_minutes > 2 ? `⚠ +${train.delay_minutes.toFixed(1)}m LATE`
                : train.delay_minutes < -1 ? `${train.delay_minutes.toFixed(1)}m EARLY`
                : "✓ ON TIME"}
            </span>
          </div>
        </div>

        {/* Speed + next stop */}
        <div style={{ display:"flex", gap:12, marginBottom:8 }}>
          <div>
            <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Speed</div>
            <div style={{ fontFamily:"JetBrains Mono, monospace", color:"#E5E7EB", fontSize:12, fontWeight:700 }}>
              {train.current_speed_kmh} <span style={{ color:"#6B7280", fontSize:9 }}>km/h</span>
            </div>
          </div>
          <div>
            <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Next Stop</div>
            <div style={{ fontFamily:"JetBrains Mono, monospace", color:"#00E5FF", fontSize:12, fontWeight:700 }}>
              {stationNames[train.next_station] || train.next_station || "—"}
            </div>
          </div>
          <div>
            <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Distance</div>
            <div style={{ fontFamily:"JetBrains Mono, monospace", color:"#E5E7EB", fontSize:12 }}>
              {train.distance_to_next_km?.toFixed(1)} <span style={{ color:"#6B7280", fontSize:9 }}>km</span>
            </div>
          </div>
          <div>
            <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Stops</div>
            <div style={{ fontFamily:"JetBrains Mono, monospace", color:"#E5E7EB", fontSize:12 }}>
              {pastCount}<span style={{ color:"#4B5563" }}>/{totalStops}</span>
            </div>
          </div>
          {delayedStops > 0 && (
            <div>
              <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Delayed Stops</div>
              <div style={{ fontFamily:"JetBrains Mono, monospace", color:"#F59E0B", fontSize:12 }}>
                {delayedStops}
              </div>
            </div>
          )}
        </div>

        {/* Route Progress Bar with station dots */}
        <div style={{ marginBottom:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:9, color:"#6B7280" }}>Route Progress</span>
            <span style={{ fontSize:9, color:"#9CA3AF", fontFamily:"JetBrains Mono, monospace" }}>
              {progressPct.toFixed(0)}% · {totalStops - pastCount - 1} stops remaining
            </span>
          </div>
          {/* Bar with dots */}
          <div style={{ position:"relative", height:18, display:"flex", alignItems:"center" }}>
            <div style={{ position:"absolute", left:0, right:0, height:2, background:"#1E2A45", borderRadius:1 }} />
            <div style={{ position:"absolute", left:0, width:`${progressPct}%`,
              height:2, background:train.color, borderRadius:1, transition:"width 0.8s ease" }} />
            {schedule.map((stop, i) => {
              const leftPct = totalStops > 1 ? (i / (totalStops - 1)) * 100 : 50;
              const isPast  = i < currentIdx;
              const isCurr  = i === currentIdx;
              return (
                <div key={i} title={stationNames[stop.station_id] || stop.station_id}
                  style={{ position:"absolute", left:`${leftPct}%`, transform:"translateX(-50%)", zIndex: isCurr ? 3 : 1 }}>
                  <div style={{
                    width: isCurr ? 10 : 6, height: isCurr ? 10 : 6, borderRadius:"50%",
                    background: isPast ? train.color : isCurr ? "#00E5FF" : "#374151",
                    border: isCurr ? "2px solid #00E5FF" : "none",
                    boxShadow: isCurr ? "0 0 8px rgba(0,229,255,0.7)" : "none",
                    transition:"all 0.3s ease",
                    animation: isCurr ? "glowPulse 2s ease-in-out infinite" : "none",
                  }} />
                </div>
              );
            })}
          </div>
          {/* Origin → Destination labels */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
            <span style={{ fontSize:8, color:"#4B5563", fontFamily:"JetBrains Mono, monospace" }}>
              {stationNames[schedule[0]?.station_id] ?? schedule[0]?.station_id}
            </span>
            <span style={{ fontSize:8, color:"#4B5563", fontFamily:"JetBrains Mono, monospace" }}>
              {stationNames[schedule[totalStops-1]?.station_id] ?? schedule[totalStops-1]?.station_id}
            </span>
          </div>
        </div>
      </div>

      {/* ── Schedule Table ── */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"16px 1fr 80px 80px 90px 50px",
          gap:8, padding:"5px 14px", borderBottom:"1px solid #1A2236",
          position:"sticky", top:0, background:"#0D1421", zIndex:2 }}>
          <div />
          <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Station</div>
          <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Scheduled</div>
          <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Actual</div>
          <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Arr → Dep</div>
          <div style={{ color:"#4B5563", fontSize:8, textTransform:"uppercase", letterSpacing:"0.4px" }}>Delay</div>
        </div>

        {schedule.map((stop, i) => {
          const isPast    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture  = i > currentIdx;
          const hasActual = !!stop.actual_arrival;
          const delay     = stop.delay_minutes ?? 0;
          const name      = stationNames[stop.station_id] || stop.station_id;
          const rowBg     = isCurrent ? "rgba(0,229,255,0.05)" : isPast ? "rgba(16,185,129,0.025)" : "transparent";

          return (
            <div key={stop.station_id + i}
              style={{ display:"grid", gridTemplateColumns:"16px 1fr 80px 80px 90px 50px",
                gap:8, padding:"6px 14px", background:rowBg,
                borderBottom:"1px solid rgba(30,42,69,0.5)", alignItems:"center" }}>

              {/* Status dot + connector */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", height:"100%" }}>
                {hasActual
                  ? <CheckCircle2 style={{ width:12, height:12, color:"#10B981", flexShrink:0 }} />
                  : isCurrent
                  ? <div style={{ width:12, height:12, borderRadius:"50%",
                      border:"2px solid #00E5FF", background:"rgba(0,229,255,0.2)",
                      animation:"glowPulse 2s ease-in-out infinite", flexShrink:0 }} />
                  : <Circle style={{ width:12, height:12, color:isFuture?"#2D3748":"#4B5563", flexShrink:0 }} />
                }
              </div>

              {/* Station name */}
              <div style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>
                <MapPin style={{ width:8, height:8, color:isCurrent?"#00E5FF":isPast?"#4B5563":"#8B5CF6", flexShrink:0 }} />
                <span style={{
                  fontSize:11, fontFamily:"JetBrains Mono, monospace",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent?"#00E5FF" : isPast?"#6B7280" : "#E5E7EB",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>
                  {name}
                </span>
                {isCurrent && (
                  <span style={{ fontSize:7, color:"#00E5FF", background:"rgba(0,229,255,0.12)",
                    border:"1px solid rgba(0,229,255,0.3)", borderRadius:3, padding:"1px 3px", flexShrink:0 }}>
                    NOW
                  </span>
                )}
                {stop.platform_preference && (
                  <span style={{ fontSize:8, color:"#8B5CF6", flexShrink:0 }}>P{stop.platform_preference}</span>
                )}
              </div>

              {/* Scheduled arr */}
              <div style={{ fontFamily:"JetBrains Mono, monospace", fontSize:10,
                color: isPast && hasActual ? "#374151" : "#9CA3AF" }}>
                {stop.scheduled_arrival}
              </div>

              {/* Actual arr */}
              <div style={{ fontFamily:"JetBrains Mono, monospace", fontSize:10,
                color: hasActual ? delayColor(delay) : "#2D3748", fontWeight: hasActual ? 600 : 400 }}>
                {hasActual ? stop.actual_arrival : "—"}
              </div>

              {/* Sched arr → dep */}
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ fontFamily:"JetBrains Mono, monospace", fontSize:9, color:"#6B7280" }}>
                  {stop.scheduled_arrival}
                </span>
                <ChevronRight style={{ width:8, height:8, color:"#374151", flexShrink:0 }} />
                <span style={{ fontFamily:"JetBrains Mono, monospace", fontSize:9, color:"#6B7280" }}>
                  {stop.scheduled_departure}
                </span>
                {stop.halt_minutes > 0 && (
                  <span style={{ fontSize:8, color:"#374151" }}>({stop.halt_minutes}m)</span>
                )}
              </div>

              {/* Delay badge */}
              <div>
                {hasActual ? <DelayBadge minutes={delay} /> : (
                  <span style={{ fontSize:9, color:"#2D3748" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function TrainSchedulePanel({
  trains, selectedTrain, onSelectTrain, stationNames, simTime,
}: TrainSchedulePanelProps) {
  const train = selectedTrain ? trains.find(t => t.train_id === selectedTrain) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      <TrainSelector trains={trains} selectedTrain={selectedTrain} onSelectTrain={onSelectTrain} />

      <div style={{ flex:1, overflow:"hidden" }}>
        {!train ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", height:"100%", gap:8 }}>
            <Train style={{ width:28, height:28, color:"#374151" }} />
            <p style={{ color:"#4B5563", fontSize:11, fontFamily:"Inter, sans-serif", textAlign:"center" }}>
              Select a train above to view<br />its complete schedule &amp; route path
            </p>
          </div>
        ) : (
          <ScheduleView train={train} stationNames={stationNames} simTime={simTime} />
        )}
      </div>
    </div>
  );
}
