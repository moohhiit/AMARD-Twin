import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import type { TrainState } from "../App";

interface StationDef {
  name: string;
  lat: number;
  lng: number;
  platforms: number;
}

interface TrackDef {
  segment_id: string;
  from: string;
  to: string;
  status: string;
  direction: string;
}

interface NetworkMapProps {
  stations: Record<string, StationDef>;
  tracks: TrackDef[];
  trains: Record<string, TrainState>;
  selectedTrain: string | null;
  onSelectTrain: (id: string | null) => void;
  layerMode?: "full" | "congestion" | "agent";
  showTrackLabels: boolean;
  showTrainNames: boolean;
}

export default function NetworkMap({
  stations,
  tracks,
  trains,
  selectedTrain,
  onSelectTrain,
  showTrackLabels,
  showTrainNames,
}: NetworkMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [transform, setTransform] = useState("translate(0,0) scale(1)");
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);

  const stationIds = Object.keys(stations);

  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    const v = viewRef.current;
    const newZoom = Math.max(0.5, Math.min(3, v.zoom + delta));
    if (centerX !== undefined && centerY !== undefined) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = centerX - rect.left;
        const my = centerY - rect.top;
        v.x = mx - (mx - v.x) * (newZoom / v.zoom);
        v.y = my - (my - v.y) * (newZoom / v.zoom);
      }
    }
    v.zoom = newZoom;
    setTransform(`translate(${v.x}px, ${v.y}px) scale(${v.zoom})`);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta, e.clientX, e.clientY);
  }, [handleZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "rect") {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - viewRef.current.x, y: e.clientY - viewRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    viewRef.current.x = e.clientX - dragStart.current.x;
    viewRef.current.y = e.clientY - dragStart.current.y;
    setTransform(`translate(${viewRef.current.x}px, ${viewRef.current.y}px) scale(${viewRef.current.zoom})`);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const fitToNetwork = useCallback(() => {
    viewRef.current = { x: 80, y: 50, zoom: 0.9 };
    setTransform(`translate(80px, 50px) scale(0.9)`);
  }, []);

  useEffect(() => {
    fitToNetwork();
  }, [fitToNetwork]);

  const getStationPos = (id: string) => {
    const s = stations[id];
    return s ? { x: s.lng, y: s.lat } : { x: 0, y: 0 };
  };

  const getTrackColor = (track: TrackDef) => {
    if (track.status === "BLOCKED") return "#EF4444";
    if (track.status === "CONGESTED") return "#F59E0B";
    return "#1E2A45";
  };

  const getTrackClass = (track: TrackDef) => {
    if (track.status === "BLOCKED") return "track-blocked";
    if (track.status === "CONGESTED") return "track-congested";
    return "";
  };

  const getTrackWidth = (track: TrackDef) => {
    if (track.status === "BLOCKED" || track.status === "CONGESTED") return 3;
    return 2;
  };

  const getTrackFilter = (track: TrackDef) => {
    if (track.status === "BLOCKED") return "url(#glowRed)";
    if (track.status === "CONGESTED") return "url(#glowAmber)";
    return undefined;
  };

  const isStation = (id: string) => stations[id]?.platforms > 0;

  const selectedTrainData = selectedTrain ? trains[selectedTrain] : null;

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{
        backgroundColor: "#0B0F19",
        backgroundImage: `
          linear-gradient(rgba(107, 114, 128, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(107, 114, 128, 0.06) 1px, transparent 1px)
        `,
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
        ref={svgRef}
        className="w-full h-full"
        style={{ transform, transformOrigin: "0 0", transition: isDragging ? "none" : "transform 0.2s ease-out" }}
        viewBox="0 0 800 750"
      >
        <defs>
          <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowMagenta" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowAmber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#6B7280" fillOpacity="0.3" />
          </marker>
        </defs>

        {/* Background rect for click handling */}
        <rect x="0" y="0" width="800" height="750" fill="transparent" />

        {/* Tracks */}
        {tracks.map((track) => {
          const from = getStationPos(track.from);
          const to = getStationPos(track.to);
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const isSelectedRoute = selectedTrainData?.route?.includes(track.from) && selectedTrainData?.route?.includes(track.to);

          return (
            <g key={track.segment_id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isSelectedRoute ? trains[selectedTrain!]?.color || getTrackColor(track) : getTrackColor(track)}
                strokeWidth={isSelectedRoute ? 4 : getTrackWidth(track)}
                strokeOpacity={isSelectedRoute ? 0.3 : 1}
                className={getTrackClass(track)}
                filter={getTrackFilter(track)}
                strokeLinecap="round"
              />
              {track.direction === "BIDIRECTIONAL" && (
                <>
                  <polygon
                    points={`${midX - 3},${midY - 3} ${midX + 3},${midY} ${midX - 3},${midY + 3}`}
                    fill="#6B7280"
                    fillOpacity="0.2"
                    transform={`rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI}, ${midX}, ${midY})`}
                  />
                </>
              )}
              {showTrackLabels && (
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill="#6B7280"
                  fillOpacity="0.5"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                  transform={`rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI}, ${midX}, ${midY - 8})`}
                >
                  {track.segment_id}
                </text>
              )}
            </g>
          );
        })}

        {/* Stations & Junctions */}
        {stationIds.map((id) => {
          const pos = getStationPos(id);
          const isSt = isStation(id);
          const isHovered = hoveredStation === id;
          const hasApproaching = Object.values(trains).some(
            (t) => t.next_station === id && (t as any).distance_to_next_km < 50
          );

          return (
            <g
              key={id}
              onMouseEnter={() => setHoveredStation(id)}
              onMouseLeave={() => setHoveredStation(null)}
              style={{ cursor: "pointer" }}
            >
              {isSt && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered || hasApproaching ? 16 : 12}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  filter="url(#glowPurple)"
                  style={{
                    animation: hasApproaching ? "stationPulse 1.5s ease-in-out infinite" : "none",
                    transition: "r 0.3s ease",
                  }}
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isSt ? 6 : 4}
                fill="#8B5CF6"
              />
              <text
                x={pos.x}
                y={pos.y + (isSt ? 28 : 18)}
                textAnchor="middle"
                fill="#E5E7EB"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={500}
              >
                {stations[id]?.name || id}
              </text>
              {isSt && (
                <text
                  x={pos.x}
                  y={pos.y + 40}
                  textAnchor="middle"
                  fill="#6B7280"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  P:{stations[id]?.platforms}
                </text>
              )}
              {/* Tooltip */}
              {isHovered && isSt && (
                <g>
                  <rect
                    x={pos.x + 15}
                    y={pos.y - 30}
                    width={140}
                    height={50}
                    rx={6}
                    fill="#1A2236"
                    stroke="#1E2A45"
                    strokeWidth={1}
                  />
                  <text x={pos.x + 22} y={pos.y - 15} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight={600}>
                    {stations[id]?.name}
                  </text>
                  <text x={pos.x + 22} y={pos.y - 3} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Platforms: {stations[id]?.platforms}
                  </text>
                  <text x={pos.x + 22} y={pos.y + 9} fill="#6B7280" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    Type: Station
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Train Markers */}
        {Object.values(trains).map((train) => {
          const isHovered = hoveredTrain === train.train_id;
          const isSelected = selectedTrain === train.train_id;
          const showDetail = isHovered || isSelected;
          const isRerouting = train.status === "REROUTING";

          return (
            <g
              key={train.train_id}
              className="train-marker"
              transform={`translate(${train.position.lng}, ${train.position.lat})`}
              onMouseEnter={() => setHoveredTrain(train.train_id)}
              onMouseLeave={() => setHoveredTrain(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrain(isSelected ? null : train.train_id);
                // detail card shown on hover/select
              }}
              style={{
                cursor: "pointer",
                transform: `translate(${train.position.lng}px, ${train.position.lat}px)`,
                transition: "transform 300ms linear",
              }}            >
              {/* Rerouting pulse ring */}
              {isRerouting && (
                <circle
                  r={14}
                  fill="none"
                  stroke="#F472B6"
                  strokeWidth={2}
                  style={{ animation: "reroutePulse 1.5s ease-out infinite" }}
                />
              )}

              {/* Selected highlight ring */}
              {(isSelected || showDetail) && (
                <circle
                  r={showDetail ? 18 : 14}
                  fill="none"
                  stroke={train.color}
                  strokeWidth={2}
                  strokeOpacity={0.4}
                />
              )}

              {/* Main train dot */}
              <circle
                r={showDetail ? 12 : 6}
                fill={train.color}
                stroke="white"
                strokeWidth={2}
                filter={showDetail ? `url(#glowCyan)` : undefined}
                style={{ transition: "r 0.3s ease" }}
              />

              {/* Train ID label */}
              {showTrainNames && (
                <text
                  x={showDetail ? 0 : 10}
                  y={showDetail ? -16 : -10}
                  textAnchor={showDetail ? "middle" : "start"}
                  fill={train.color}
                  fontSize={showDetail ? 11 : 9}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                >
                  {train.train_id}
                  {showDetail && ` - ${train.current_speed_kmh} km/h`}
                </text>
              )}

              {/* Detail card on hover/select */}
              {showDetail && (
                <g transform="translate(20, -50)">
                  <rect
                    x={0}
                    y={0}
                    width={160}
                    height={90}
                    rx={8}
                    fill="#1A2236"
                    stroke="#1E2A45"
                    strokeWidth={1}
                    style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
                  />
                  <text x={10} y={18} fill={train.color} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight={600}>
                    Train {train.train_id} - {train.name}
                  </text>
                  <text x={10} y={34} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Speed: {train.current_speed_kmh} km/h
                  </text>
                  <text x={10} y={48} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Segment: {train.current_segment}
                  </text>
                  <text x={10} y={62} fill="#E5E7EB" fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Next: {train.next_station}
                  </text>
                  <text x={10} y={78} fill={train.delay_minutes > 2 ? "#F59E0B" : "#10B981"} fontSize="9" fontFamily="JetBrains Mono, monospace">
                    Delay: {train.delay_minutes.toFixed(1)} min
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Map Controls */}
      <div
        className="absolute bottom-4 right-4 flex flex-col gap-1.5 p-1.5 rounded-lg"
        style={{ backgroundColor: "#111827", border: "1px solid #1E2A45" }}
      >
        <button
          onClick={() => handleZoom(0.2)}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
        <button
          onClick={fitToNetwork}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
          title="Fit to Network"
        >
          <Crosshair className="w-4 h-4" style={{ color: "#6B7280" }} />
        </button>
      </div>
    </div>
  );
}
