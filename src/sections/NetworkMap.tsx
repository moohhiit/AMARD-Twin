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

// Group A/B track pairs so we can draw offset parallel lines
function groupTrackPairs(tracks: TrackDef[]) {
  // Returns map: baseKey -> { a: TrackDef | null, b: TrackDef | null }
  const pairs: Record<string, { a: TrackDef | null; b: TrackDef | null }> = {};
  for (const t of tracks) {
    const base = t.segment_id.replace(/-[AB]$/, "");
    if (!pairs[base]) pairs[base] = { a: null, b: null };
    if (t.segment_id.endsWith("-A")) pairs[base].a = t;
    else if (t.segment_id.endsWith("-B")) pairs[base].b = t;
    else pairs[base].a = t; // non-paired fallback
  }
  return pairs;
}

function getOffsetPoints(x1: number, y1: number, x2: number, y2: number, offset: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  return { nx, ny };
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
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);

  const trackPairs = groupTrackPairs(tracks);
  const selectedTrainData = selectedTrain ? trains[selectedTrain] : null;

  const handleZoom = useCallback((delta: number, cx?: number, cy?: number) => {
    const v = viewRef.current;
    const newZoom = Math.max(0.4, Math.min(3.5, v.zoom + delta));
    if (cx !== undefined && cy !== undefined) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = cx - rect.left;
        const my = cy - rect.top;
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

  const trackColor = (t: TrackDef) =>
    t.status === "BLOCKED" ? "#EF4444"
    : t.status === "CONGESTED" ? "#F59E0B"
    : "#1E2A45";

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
          <filter id="glowCyan"    x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowAmber"   x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowRed"     x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowPurple"  x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glowMagenta" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <rect x="0" y="0" width="800" height="750" fill="transparent" />

        {/* ── DOUBLE TRACK LINES (parallel offset) ── */}
        {Object.entries(trackPairs).map(([baseKey, pair]) => {
          const refTrack = pair.a ?? pair.b;
          if (!refTrack) return null;
          const f = pos(refTrack.from);
          const t = pair.a ? pos(pair.a.to) : pos(refTrack.to);
          const { nx, ny } = getOffsetPoints(f.x, f.y, t.x, t.y, 2.5);

          const isOnSelectedRoute = selectedTrainData?.route?.includes(refTrack.from) && selectedTrainData?.route?.includes(refTrack.to);
          const midX = (f.x + t.x) / 2;
          const midY = (f.y + t.y) / 2;

          return (
            <g key={baseKey}>
              {/* Track A — Up direction (offset +) */}
              {pair.a && (
                <line
                  x1={f.x + nx} y1={f.y + ny}
                  x2={t.x + nx} y2={t.y + ny}
                  stroke={isOnSelectedRoute ? (trains[selectedTrain!]?.color ?? trackColor(pair.a)) : trackColor(pair.a)}
                  strokeWidth={isOnSelectedRoute ? 3.5 : pair.a.status === "BLOCKED" || pair.a.status === "CONGESTED" ? 2.5 : 1.8}
                  strokeOpacity={isOnSelectedRoute ? 0.5 : 1}
                  filter={pair.a.status === "BLOCKED" ? "url(#glowRed)" : pair.a.status === "CONGESTED" ? "url(#glowAmber)" : undefined}
                  strokeLinecap="round"
                />
              )}
              {/* Track B — Down direction (offset -) */}
              {pair.b && (
                <line
                  x1={f.x - nx} y1={f.y - ny}
                  x2={t.x - nx} y2={t.y - ny}
                  stroke={isOnSelectedRoute ? (trains[selectedTrain!]?.color ?? trackColor(pair.b)) : trackColor(pair.b)}
                  strokeWidth={isOnSelectedRoute ? 3.5 : pair.b.status === "BLOCKED" || pair.b.status === "CONGESTED" ? 2.5 : 1.8}
                  strokeOpacity={isOnSelectedRoute ? 0.5 : 0.65}
                  strokeDasharray={pair.b.status === "OPEN" ? "none" : undefined}
                  filter={pair.b.status === "BLOCKED" ? "url(#glowRed)" : pair.b.status === "CONGESTED" ? "url(#glowAmber)" : undefined}
                  strokeLinecap="round"
                />
              )}

              {/* Track label */}
              {showTrackLabels && (
                <text
                  x={midX} y={midY - 6}
                  textAnchor="middle"
                  fill="#6B7280" fillOpacity="0.45"
                  fontSize="7"
                  fontFamily="JetBrains Mono, monospace"
                  transform={`rotate(${Math.atan2(t.y - f.y, t.x - f.x) * 180 / Math.PI},${midX},${midY - 6})`}
                >
                  {baseKey}
                </text>
              )}

              {/* Track occupancy mini-indicator */}
              {(pair.a?.current_trains ?? 0) + (pair.b?.current_trains ?? 0) > 0 && (
                <circle
                  cx={midX} cy={midY}
                  r={3}
                  fill={(pair.a?.congestion_level ?? 0) > 70 ? "#F59E0B" : "#10B981"}
                  fillOpacity={0.7}
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
          const isHov = hoveredTrain === train.train_id;
          const isSel = selectedTrain === train.train_id;
          const showDetail = isHov || isSel;
          const isRerouting = train.status === "REROUTING";
          const isDelayed = train.delay_minutes > 2;
          const isEarly = train.delay_minutes < -1;
          const progress = train.position?.progress_percent ?? 0;

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
              {showDetail && (
                <circle r={18} fill="none" stroke={train.color} strokeWidth={2} strokeOpacity={0.35} />
              )}

              {/* Main dot */}
              <circle r={showDetail ? 10 : 6} fill={train.color} stroke="white" strokeWidth={showDetail ? 2 : 1.5}
                filter={showDetail ? "url(#glowCyan)" : undefined}
                style={{ transition: "r 0.3s ease" }} />

              {/* Delay ring */}
              {isDelayed && !showDetail && (
                <circle r={9} fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeOpacity={0.6}
                  strokeDasharray="4 2" />
              )}
              {isEarly && !showDetail && (
                <circle r={9} fill="none" stroke="#10B981" strokeWidth={1.5} strokeOpacity={0.6}
                  strokeDasharray="4 2" />
              )}

              {/* Train ID label */}
              {showTrainNames && (
                <text
                  x={showDetail ? 0 : 10} y={showDetail ? -14 : -9}
                  textAnchor={showDetail ? "middle" : "start"}
                  fill={train.color}
                  fontSize={showDetail ? 11 : 8}
                  fontFamily="JetBrains Mono, monospace" fontWeight={600}>
                  {train.train_id}
                  {showDetail && ` · ${train.current_speed_kmh}km/h`}
                </text>
              )}

              {/* Hover/Select detail card */}
              {showDetail && (
                <g transform="translate(18, -65)">
                  <rect x={0} y={0} width={175} height={110} rx={8}
                    fill="#1A2236" stroke={train.color} strokeWidth={1} strokeOpacity={0.4}
                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }} />

                  {/* Header */}
                  <rect x={0} y={0} width={175} height={20} rx={8} fill={train.color} fillOpacity={0.15} />
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

                  {/* Delay / On-time badge */}
                  <text x={10} y={71}
                    fill={isDelayed ? "#F59E0B" : isEarly ? "#10B981" : "#10B981"}
                    fontSize="9" fontFamily="JetBrains Mono, monospace">
                    {isDelayed ? `⚠ Delayed +${train.delay_minutes.toFixed(1)}m`
                      : isEarly ? `✓ Early ${train.delay_minutes.toFixed(1)}m`
                      : "✓ On Time"}
                  </text>

                  {/* Route progress bar */}
                  <text x={10} y={83} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Route {progress.toFixed(0)}%
                  </text>
                  <rect x={10} y={87} width={155} height={3} rx={1.5} fill="#1E2A45" />
                  <rect x={10} y={87} width={155 * progress / 100} height={3} rx={1.5} fill={train.color} />

                  {/* Signal */}
                  <circle cx={155} cy={31} r={4}
                    fill={train.signal === "GREEN" ? "#10B981" : train.signal === "YELLOW" ? "#F59E0B" : "#EF4444"} />
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
      <div className="absolute top-3 right-3 p-2 rounded-lg text-[9px]"
        style={{ backgroundColor: "rgba(17,24,39,0.85)", border: "1px solid #1E2A45", fontFamily: "JetBrains Mono, monospace" }}>
        <div style={{ color: "#6B7280", marginBottom: 4, fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase" }}>Track Legend</div>
        <div className="flex items-center gap-1.5 mb-1">
          <div style={{ display: "flex", gap: 1 }}>
            <div style={{ width: 16, height: 2, background: "#1E2A45", borderRadius: 1 }} />
            <div style={{ width: 16, height: 2, background: "#1E2A45", borderRadius: 1, opacity: 0.6 }} />
          </div>
          <span style={{ color: "#9CA3AF" }}>Up / Down track</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <div style={{ width: 16, height: 2, background: "#F59E0B", borderRadius: 1 }} />
          <span style={{ color: "#9CA3AF" }}>Congested</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 16, height: 2, background: "#EF4444", borderRadius: 1 }} />
          <span style={{ color: "#9CA3AF" }}>Blocked</span>
        </div>
      </div>
    </div>
  );
}
