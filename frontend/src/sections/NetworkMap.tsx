import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import type { TrainState, TrackDef } from "../App";

interface StationDef {
  name: string;
  lat: number;
  lng: number;
  platforms: number;
}

interface NetworkMapProps {
  stations: Record<string, StationDef>;
  tracks: TrackDef[];
  trains: Record<string, TrainState>;
  selectedTrain: string | null;
  onSelectTrain: (id: string | null) => void;
  layerMode?: string;
  showTrackLabels: boolean;
  showTrainNames: boolean;
}

// Group A/B pairs so we can draw offset parallel lines
function groupTrackPairs(tracks: TrackDef[]) {
  const pairs: Record<string, { a: TrackDef | null; b: TrackDef | null }> = {};
  for (const t of tracks) {
    const base = t.segment_id.replace(/-[AB]$/, "");
    if (!pairs[base]) pairs[base] = { a: null, b: null };
    if (t.segment_id.endsWith("-A")) pairs[base].a = t;
    else if (t.segment_id.endsWith("-B")) pairs[base].b = t;
    else pairs[base].a = t;
  }
  return pairs;
}

// Perpendicular offset vector for parallel tracks
function getOffset(x1: number, y1: number, x2: number, y2: number, d: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { nx: (-dy / len) * d, ny: (dx / len) * d };
}

// ── TRACK COLOR LOGIC ─────────────────────────────────────────────────────────
// Priority: BLOCKED > CONGESTED > STORM > FOG > RAIN > OPEN
function getTrackColor(t: TrackDef): string {
  if (t.status === "BLOCKED")   return "#EF4444";
  if (t.status === "CONGESTED") return "#F59E0B";
  if (t.weather === "STORM")    return "#C084FC";   // purple
  if (t.weather === "FOG")      return "#94A3B8";   // slate/grey
  if (t.weather === "RAIN")     return "#60A5FA";   // blue
  return "#1E2A45";
}

function getTrackGlow(t: TrackDef): string | undefined {
  if (t.status === "BLOCKED")   return "url(#glowRed)";
  if (t.status === "CONGESTED") return "url(#glowAmber)";
  if (t.weather === "STORM")    return "url(#glowPurple)";
  if (t.weather === "FOG")      return undefined;
  if (t.weather === "RAIN")     return "url(#glowBlue)";
  return undefined;
}

function getTrackWidth(t: TrackDef): number {
  if (t.status === "BLOCKED" || t.status === "CONGESTED") return 2.8;
  if (t.weather === "STORM") return 2.5;
  if (t.weather === "RAIN" || t.weather === "FOG") return 2.2;
  return 1.8;
}

// Weather badge label + color
function weatherBadge(weather: string): { label: string; color: string; bg: string } | null {
  if (weather === "STORM") return { label: "⛈ STORM", color: "#C084FC", bg: "rgba(192,132,252,0.15)" };
  if (weather === "FOG")   return { label: "🌫 FOG",   color: "#94A3B8", bg: "rgba(148,163,184,0.12)" };
  if (weather === "RAIN")  return { label: "🌧 RAIN",  color: "#60A5FA", bg: "rgba(96,165,250,0.12)" };
  return null;
}

export default function NetworkMap({
  stations, tracks, trains, selectedTrain, onSelectTrain,
  showTrackLabels, showTrainNames,
}: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 80, y: 50, zoom: 0.9 });
  const [transform, setTransform] = useState("translate(80px, 50px) scale(0.9)");
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [hoveredTrain, setHoveredTrain]     = useState<string | null>(null);

  const trackPairs = groupTrackPairs(tracks);
  const selectedTrainData = selectedTrain ? trains[selectedTrain] : null;

  const handleZoom = useCallback((delta: number, cx?: number, cy?: number) => {
    const v = viewRef.current;
    const newZoom = Math.max(0.4, Math.min(3.5, v.zoom + delta));
    if (cx !== undefined && cy !== undefined) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = cx - rect.left, my = cy - rect.top;
        v.x = mx - (mx - v.x) * (newZoom / v.zoom);
        v.y = my - (my - v.y) * (newZoom / v.zoom);
      }
    }
    v.zoom = newZoom;
    setTransform(`translate(${v.x}px,${v.y}px) scale(${v.zoom})`);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    handleZoom(e.deltaY > 0 ? -0.1 : 0.1, e.clientX, e.clientY);
  }, [handleZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "svg" || tag === "rect") {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - viewRef.current.x, y: e.clientY - viewRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    viewRef.current.x = e.clientX - dragStart.current.x;
    viewRef.current.y = e.clientY - dragStart.current.y;
    setTransform(`translate(${viewRef.current.x}px,${viewRef.current.y}px) scale(${viewRef.current.zoom})`);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const fitToNetwork = useCallback(() => {
    viewRef.current = { x: 80, y: 50, zoom: 0.9 };
    setTransform("translate(80px,50px) scale(0.9)");
  }, []);

  useEffect(() => { fitToNetwork(); }, [fitToNetwork]);

  const pos = (id: string) => {
    const s = stations[id];
    return s ? { x: s.lng, y: s.lat } : { x: 0, y: 0 };
  };

  const isStation = (id: string) => stations[id]?.platforms > 0;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundColor: "#0B0F19",
        backgroundImage: `linear-gradient(rgba(107,114,128,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(107,114,128,0.06) 1px,transparent 1px)`,
        backgroundSize: "40px 40px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        className="w-full h-full"
        style={{ transform, transformOrigin: "0 0", transition: isDragging ? "none" : "transform 0.2s ease-out" }}
        viewBox="0 0 800 750"
      >
        <defs>
          <filter id="glowCyan"   x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowAmber"  x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowRed"    x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowBlue"   x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <rect x="0" y="0" width="800" height="750" fill="transparent" />

        {/* ── DOUBLE TRACKS ── */}
        {Object.entries(trackPairs).map(([baseKey, pair]) => {
          const refTrack = pair.a ?? pair.b;
          if (!refTrack) return null;

          const f = pos(refTrack.from);
          const t = pair.a ? pos(pair.a.to) : pos(refTrack.to);
          const { nx, ny } = getOffset(f.x, f.y, t.x, t.y, 2.5);

          const isOnSelectedRoute =
            selectedTrainData?.route?.includes(refTrack.from) &&
            selectedTrainData?.route?.includes(refTrack.to);

          const midX = (f.x + t.x) / 2;
          const midY = (f.y + t.y) / 2;

          // Pick the "worse" track for badge display (A or B)
          const worseTrack = pair.a && (pair.a.weather !== "CLEAR" || pair.a.status !== "OPEN")
            ? pair.a
            : pair.b ?? pair.a!;

          const badge = weatherBadge(worseTrack?.weather ?? "");

          return (
            <g key={baseKey}>
              {/* Track A (Up) */}
              {pair.a && (() => {
                const color = isOnSelectedRoute
                  ? (trains[selectedTrain!]?.color ?? getTrackColor(pair.a))
                  : getTrackColor(pair.a);
                return (
                  <line
                    x1={f.x + nx} y1={f.y + ny}
                    x2={t.x + nx} y2={t.y + ny}
                    stroke={color}
                    strokeWidth={isOnSelectedRoute ? 3.5 : getTrackWidth(pair.a)}
                    strokeOpacity={isOnSelectedRoute ? 0.55 : 1}
                    filter={!isOnSelectedRoute ? getTrackGlow(pair.a) : undefined}
                    strokeLinecap="round"
                  />
                );
              })()}

              {/* Track B (Down) */}
              {pair.b && (() => {
                const color = isOnSelectedRoute
                  ? (trains[selectedTrain!]?.color ?? getTrackColor(pair.b))
                  : getTrackColor(pair.b);
                return (
                  <line
                    x1={f.x - nx} y1={f.y - ny}
                    x2={t.x - nx} y2={t.y - ny}
                    stroke={color}
                    strokeWidth={isOnSelectedRoute ? 3.5 : getTrackWidth(pair.b)}
                    strokeOpacity={isOnSelectedRoute ? 0.55 : 0.7}
                    filter={!isOnSelectedRoute ? getTrackGlow(pair.b) : undefined}
                    strokeLinecap="round"
                  />
                );
              })()}

              {/* Weather badge on segment midpoint */}
              {badge && !isOnSelectedRoute && (
                <g>
                  <rect
                    x={midX - 18} y={midY - 8}
                    width={36} height={11}
                    rx={3}
                    fill={badge.bg}
                    stroke={badge.color}
                    strokeWidth={0.5}
                    strokeOpacity={0.6}
                  />
                  <text
                    x={midX} y={midY + 1}
                    textAnchor="middle"
                    fill={badge.color}
                    fontSize="6.5"
                    fontFamily="Inter, sans-serif"
                    fontWeight={600}
                  >
                    {badge.label}
                  </text>
                </g>
              )}

              {/* Track label */}
              {showTrackLabels && (
                <text
                  x={midX} y={midY - 10}
                  textAnchor="middle"
                  fill="#6B7280" fillOpacity="0.4"
                  fontSize="7"
                  fontFamily="JetBrains Mono, monospace"
                  transform={`rotate(${Math.atan2(t.y - f.y, t.x - f.x) * 180 / Math.PI},${midX},${midY - 10})`}
                >
                  {baseKey}
                </text>
              )}

              {/* Occupancy dot */}
              {(pair.a?.current_trains ?? 0) + (pair.b?.current_trains ?? 0) > 0 && (
                <circle
                  cx={midX} cy={midY + (badge ? 8 : 0)}
                  r={3}
                  fill={(pair.a?.congestion_level ?? 0) > 70 ? "#F59E0B" : "#10B981"}
                  fillOpacity={0.75}
                />
              )}
            </g>
          );
        })}

        {/* ── STATIONS & JUNCTIONS ── */}
        {Object.keys(stations).map(id => {
          const p = pos(id);
          const isSt = isStation(id);
          const isHov = hoveredStation === id;
          const hasApproaching = Object.values(trains).some(
            t => t.next_station === id && t.distance_to_next_km < 50
          );

          return (
            <g key={id}
              onMouseEnter={() => setHoveredStation(id)}
              onMouseLeave={() => setHoveredStation(null)}
              style={{ cursor: "pointer" }}>

              {isSt && (
                <circle cx={p.x} cy={p.y} r={isHov || hasApproaching ? 16 : 12}
                  fill="none" stroke="#8B5CF6" strokeWidth={2}
                  filter="url(#glowPurple)"
                  style={{ animation: hasApproaching ? "stationPulse 1.5s ease-in-out infinite" : "none", transition: "r 0.3s ease" }} />
              )}
              <circle cx={p.x} cy={p.y} r={isSt ? 6 : 3.5} fill="#8B5CF6" />

              <text x={p.x} y={p.y + (isSt ? 28 : 16)}
                textAnchor="middle" fill="#E5E7EB"
                fontSize={isSt ? "10" : "8"}
                fontFamily="JetBrains Mono, monospace" fontWeight={500}>
                {stations[id]?.name || id}
              </text>
              {isSt && (
                <text x={p.x} y={p.y + 40} textAnchor="middle" fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                  P:{stations[id]?.platforms}
                </text>
              )}

              {/* Tooltip */}
              {isHov && isSt && (
                <g>
                  <rect x={p.x + 15} y={p.y - 35} width={150} height={56} rx={6}
                    fill="#1A2236" stroke="#1E2A45" strokeWidth={1} />
                  <text x={p.x + 23} y={p.y - 20} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight={600}>
                    {stations[id]?.name}
                  </text>
                  <text x={p.x + 23} y={p.y - 8} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Platforms: {stations[id]?.platforms}
                  </text>
                  <text x={p.x + 23} y={p.y + 4} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Trains nearby: {Object.values(trains).filter(t => t.next_station === id).length}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── TRAIN MARKERS ── */}
        {Object.values(trains).map(train => {
          const isHov  = hoveredTrain === train.train_id;
          const isSel  = selectedTrain === train.train_id;
          const detail = isHov || isSel;
          const isRerouting = train.status === "REROUTING";
          const isDelayed   = train.delay_minutes > 2;
          const isEarly     = train.delay_minutes < -1;
          const progress    = train.position?.progress_percent ?? 0;

          return (
            <g key={train.train_id}
              style={{ transform: `translate(${train.position.lng}px,${train.position.lat}px)`, transition: "transform 300ms linear", cursor: "pointer" }}
              onMouseEnter={() => setHoveredTrain(train.train_id)}
              onMouseLeave={() => setHoveredTrain(null)}
              onClick={e => { e.stopPropagation(); onSelectTrain(isSel ? null : train.train_id); }}>

              {isRerouting && (
                <circle r={14} fill="none" stroke="#F472B6" strokeWidth={2}
                  style={{ animation: "reroutePulse 1.5s ease-out infinite" }} />
              )}
              {detail && (
                <circle r={18} fill="none" stroke={train.color} strokeWidth={2} strokeOpacity={0.35} />
              )}

              <circle r={detail ? 10 : 6} fill={train.color} stroke="white"
                strokeWidth={detail ? 2 : 1.5}
                filter={detail ? "url(#glowCyan)" : undefined}
                style={{ transition: "r 0.3s ease" }} />

              {/* Delay ring */}
              {isDelayed && !detail && (
                <circle r={9} fill="none" stroke="#F59E0B" strokeWidth={1.5}
                  strokeOpacity={0.6} strokeDasharray="4 2" />
              )}
              {isEarly && !detail && (
                <circle r={9} fill="none" stroke="#10B981" strokeWidth={1.5}
                  strokeOpacity={0.6} strokeDasharray="4 2" />
              )}

              {/* Train ID label */}
              {showTrainNames && (
                <text x={detail ? 0 : 10} y={detail ? -14 : -9}
                  textAnchor={detail ? "middle" : "start"}
                  fill={train.color}
                  fontSize={detail ? 11 : 8}
                  fontFamily="JetBrains Mono, monospace" fontWeight={600}>
                  {train.train_id}{detail && ` · ${train.current_speed_kmh}km/h`}
                </text>
              )}

              {/* Detail card */}
              {detail && (
                <g transform="translate(18, -65)">
                  <rect x={0} y={0} width={178} height={112} rx={8}
                    fill="#1A2236" stroke={train.color} strokeWidth={1} strokeOpacity={0.4}
                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }} />
                  <rect x={0} y={0} width={178} height={20} rx={8} fill={train.color} fillOpacity={0.15} />
                  <text x={10} y={14} fill={train.color} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight={700}>
                    {train.train_id} — {train.name}
                  </text>
                  <text x={10} y={31} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Speed: {train.current_speed_kmh} km/h
                  </text>
                  <text x={10} y={44} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Seg: {train.current_segment}
                  </text>
                  <text x={10} y={57} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Next: {train.next_station} ({train.distance_to_next_km.toFixed(1)} km)
                  </text>
                  <text x={10} y={70}
                    fill={isDelayed ? "#F59E0B" : isEarly ? "#10B981" : "#10B981"}
                    fontSize="9" fontFamily="JetBrains Mono, monospace">
                    {isDelayed ? `⚠ Delayed +${train.delay_minutes.toFixed(1)}m`
                      : isEarly  ? `✓ Early ${train.delay_minutes.toFixed(1)}m`
                      : "✓ On Time"}
                  </text>
                  <text x={10} y={83} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Route {progress.toFixed(0)}%
                  </text>
                  <rect x={10} y={87} width={158} height={3} rx={1.5} fill="#1E2A45" />
                  <rect x={10} y={87} width={158 * progress / 100} height={3} rx={1.5} fill={train.color} />
                  {/* Signal dot */}
                  <circle cx={162} cy={31} r={4}
                    fill={train.signal === "GREEN" ? "#10B981" : train.signal === "YELLOW" ? "#F59E0B" : "#EF4444"} />
                  {/* Weather badge on card if train affected */}
                  {train.weather !== "CLEAR" && (
                    <text x={10} y={100} fill="#94A3B8" fontSize="8" fontFamily="Inter, sans-serif">
                      {train.weather === "STORM" ? "⛈ STORM" : train.weather === "FOG" ? "🌫 FOG" : "🌧 RAIN"}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 p-1.5 rounded-lg"
        style={{ backgroundColor: "#111827", border: "1px solid #1E2A45" }}>
        <button onClick={() => handleZoom(0.2)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Zoom In">
          <ZoomIn className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
        <button onClick={() => handleZoom(-0.2)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Zoom Out">
          <ZoomOut className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
        <button onClick={fitToNetwork} className="p-1.5 rounded-md hover:bg-white/5 transition-colors" title="Fit to Network">
          <Crosshair className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 p-2.5 rounded-lg"
        style={{ backgroundColor: "rgba(17,24,39,0.9)", border: "1px solid #1E2A45", fontFamily: "Inter, sans-serif", minWidth: 130 }}>
        <div style={{ color: "#6B7280", marginBottom: 6, fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 600 }}>
          Track Legend
        </div>

        {/* Track types */}
        {[
          { color: "#1E2A45",  label: "Clear (Up track)" },
          { color: "#1E2A45",  label: "Clear (Down track)", opacity: 0.6 },
          { color: "#F59E0B",  label: "Congested" },
          { color: "#EF4444",  label: "Blocked" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 mb-1">
            <div style={{ width: 18, height: 2.5, background: item.color, borderRadius: 1, opacity: item.opacity ?? 1, flexShrink: 0 }} />
            <span style={{ color: "#9CA3AF", fontSize: 9 }}>{item.label}</span>
          </div>
        ))}

        {/* Separator */}
        <div style={{ height: 1, background: "#1E2A45", margin: "5px 0" }} />
        <div style={{ color: "#6B7280", marginBottom: 4, fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 600 }}>
          Weather
        </div>

        {[
          { color: "#60A5FA", label: "🌧 Rain" },
          { color: "#94A3B8", label: "🌫 Fog" },
          { color: "#C084FC", label: "⛈ Storm" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 mb-1">
            <div style={{ width: 18, height: 2.5, background: item.color, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: "#9CA3AF", fontSize: 9 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
