import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Header from "./sections/Header";
import LeftControlPanel from "./sections/LeftControlPanel";
import NetworkMap from "./sections/NetworkMap";
import BottomMetricsStrip from "./sections/BottomMetricsStrip";

const STATIONS: Record<string, { name: string; lat: number; lng: number; platforms: number }> = {
  MUM: { name: "Mumbai Central", lat: 100, lng: 600, platforms: 4 },
  DEL: { name: "Delhi Junction", lat: 500, lng: 200, platforms: 6 },
  CHN: { name: "Chennai Central", lat: 500, lng: 700, platforms: 5 },
  BLR: { name: "Bangalore City", lat: 300, lng: 650, platforms: 4 },
  HYD: { name: "Hyderabad", lat: 450, lng: 550, platforms: 3 },
  J1: { name: "Pune Junction", lat: 200, lng: 580, platforms: 0 },
  J2: { name: "Nagpur Hub", lat: 480, lng: 380, platforms: 0 },
};

const TRACKS: TrackDef[] = [
  { segment_id: "MUM-J1-A", from: "MUM", to: "J1", distance_km: 150, max_speed_kmh: 120, capacity: 3, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "J1-BLR-A", from: "J1", to: "BLR", distance_km: 80, max_speed_kmh: 100, capacity: 2, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-CHN-A", from: "BLR", to: "CHN", distance_km: 350, max_speed_kmh: 130, capacity: 4, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "CHN-HYD-A", from: "CHN", to: "HYD", distance_km: 330, max_speed_kmh: 110, capacity: 3, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "HYD-J2-A", from: "HYD", to: "J2", distance_km: 260, max_speed_kmh: 100, capacity: 2, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "J2-DEL-A", from: "J2", to: "DEL", distance_km: 240, max_speed_kmh: 130, capacity: 3, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "DEL-HYD-B", from: "DEL", to: "HYD", distance_km: 280, max_speed_kmh: 120, capacity: 3, status: "OPEN", direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-HYD-B", from: "BLR", to: "HYD", distance_km: 200, max_speed_kmh: 90, capacity: 2, status: "OPEN", direction: "BIDIRECTIONAL" },
];

const TRAIN_COLORS: Record<string, string> = {
  "101": "#3B82F6", "102": "#00E5FF", "103": "#F472B6", "104": "#F59E0B", "105": "#10B981",
};

export interface TrackDef {
  segment_id: string;
  from: string;
  to: string;
  distance_km: number;
  max_speed_kmh: number;
  capacity: number;
  status: string;
  direction: string;
}

export interface TrainState {
  train_id: string;
  name: string;
  status: string;
  current_speed_kmh: number;
  delay_minutes: number;
  position: { from_node: string; to_node: string; progress_percent: number; lat: number; lng: number };
  assigned_platform: number | null;
  current_station: string | null;
  current_segment: string;
  next_station: string;
  distance_to_next_km: number;
  color: string;
  route: string[];
}

export interface AgentDecision {
  agent_type: string;
  train_id: string;
  decision: string;
  reason: string;
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  detail: string;
  timestamp: number;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [trains, setTrains] = useState<Record<string, TrainState>>({});
  const [tracks, setTracks] = useState(TRACKS);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [layerMode] = useState<"full" | "congestion" | "agent">("full");
  const [showTrackLabels, setShowTrackLabels] = useState(false);
  const [showTrainNames, setShowTrainNames] = useState(true);
  const [showAgentDecisions, setShowAgentDecisions] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [activeTrains, setActiveTrains] = useState(0);
  const [congestedTracks, setCongestedTracks] = useState(0);
  const [avgDelay, setAvgDelay] = useState(0);
  const [freePlatforms] = useState("0/0");

  // Initialize socket connection
  useEffect(() => {
    const s = io("http://localhost:3000");
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.emit("client:subscribe:all");

    return () => { s.disconnect(); };
  }, []);

  // Listen for train updates
  useEffect(() => {
    if (!socket) return;

    socket.on("train:update", (data) => {
      setTrains((prev) => {
        const trainId = data.train_id;
        const existing = prev[trainId];
        const updated: TrainState = {
          train_id: data.train_id,
          name: existing?.name || `Train ${data.train_id}`,
          status: data.status,
          current_speed_kmh: data.speed_kmh,
          delay_minutes: data.delay_minutes,
          position: data.position,
          assigned_platform: existing?.assigned_platform || null,
          current_station: existing?.current_station || null,
          current_segment: data.current_segment,
          next_station: data.next_station,
          distance_to_next_km: 0,
          color: TRAIN_COLORS[data.train_id] || "#3B82F6",
          route: existing?.route || [],
        };
        return { ...prev, [trainId]: updated };
      });

      // Add to telemetry (circular buffer of 50)
      setTelemetry((prev) => {
        const line = `[${new Date().toLocaleTimeString()}] Train ${data.train_id} -- ${data.current_segment} -- ${data.speed_kmh} km/h${data.speed_kmh < 50 ? " [SLOW]" : ""}`;
        const next = [...prev, line];
        return next.slice(-50);
      });
    });

    socket.on("train:rerouted", (data) => {
      setAgentDecisions((prev) => {
        const decision: AgentDecision = {
          agent_type: "REROUTING",
          train_id: data.train_id,
          decision: `Rerouted to avoid ${data.trigger.toLowerCase()}`,
          reason: data.reason,
          timestamp: data.timestamp,
        };
        return [...prev.slice(-49), decision];
      });
      setAlerts((prev) => [...prev.slice(-49), {
        id: `reroute-${Date.now()}`,
        severity: "INFO",
        message: `Train ${data.train_id} Rerouted`,
        detail: data.reason,
        timestamp: Date.now(),
      }]);
    });

    socket.on("platform:assigned", (data) => {
      setAgentDecisions((prev) => {
        const decision: AgentDecision = {
          agent_type: "PLATFORM",
          train_id: data.train_id,
          decision: `Platform ${data.platform_number} at ${data.station_id}`,
          reason: `Score: ${data.score_breakdown?.total_score?.toFixed?.(2) || "N/A"}`,
          timestamp: data.eta,
        };
        return [...prev.slice(-49), decision];
      });
      setTrains((prev) => {
        const t = prev[data.train_id];
        if (!t) return prev;
        return { ...prev, [data.train_id]: { ...t, assigned_platform: data.platform_number, current_station: data.station_id } };
      });
    });

    socket.on("congestion:alert", (data) => {
      setTracks((prev) => prev.map((t) => t.segment_id === data.segment_id ? { ...t, status: "CONGESTED" } : t));
      setAlerts((prev) => [...prev.slice(-49), {
        id: `congestion-${data.segment_id}-${Date.now()}`,
        severity: data.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
        message: `Congestion on ${data.segment_id}`,
        detail: `${data.train_count}/${data.capacity} trains -- ${data.affected_trains?.join(", ") || "N/A"}`,
        timestamp: Date.now(),
      }]);
    });

    socket.on("track:blocked", (data) => {
      setTracks((prev) => prev.map((t) => t.segment_id === data.segment_id ? { ...t, status: "BLOCKED" } : t));
      setAlerts((prev) => [...prev.slice(-49), {
        id: `blocked-${data.segment_id}-${Date.now()}`,
        severity: "CRITICAL",
        message: `Track ${data.segment_id} BLOCKED`,
        detail: data.reason || "Manual block",
        timestamp: Date.now(),
      }]);
    });

    socket.on("agent:decision", (data) => {
      if (!data.agent_type) return;
      setAgentDecisions((prev) => [...prev.slice(-49), data]);
    });

    socket.on("system:status", (data) => {
      setActiveTrains(data.active_trains || 0);
      setCongestedTracks(data.congested_tracks || 0);
    });

    return () => {
      socket.off("train:update");
      socket.off("train:rerouted");
      socket.off("platform:assigned");
      socket.off("congestion:alert");
      socket.off("track:blocked");
      socket.off("agent:decision");
      socket.off("system:status");
    };
  }, [socket]);

  // Calculate stats
  useEffect(() => {
    const trainList = Object.values(trains);
    const running = trainList.filter((t) => t.status === "RUNNING" || t.status === "REROUTING").length;
    const delays = trainList.filter((t) => t.delay_minutes > 0);
    const avg = delays.length > 0 ? delays.reduce((s, t) => s + t.delay_minutes, 0) / delays.length : 0;
    setAvgDelay(Math.round(avg * 10) / 10);
    setActiveTrains(running);
  }, [trains]);

  // Fetch initial data
  useEffect(() => {
    fetch("http://localhost:3000/api/v1/trains").then((r) => r.json()).then((data) => {
      if (data.trains) {
        const map: Record<string, TrainState> = {};
        data.trains.forEach((t: any) => {
          map[t.train_id] = {
            train_id: t.train_id,
            name: t.name,
            status: t.status,
            current_speed_kmh: t.current_speed_kmh || 0,
            delay_minutes: t.delay_minutes || 0,
            position: t.position,
            assigned_platform: t.assigned_platform,
            current_station: t.current_station,
            current_segment: t.current_segment || `${t.position?.from_node}-${t.position?.to_node}-A`,
            next_station: t.next_station || t.position?.to_node,
            distance_to_next_km: 0,
            color: t.color || TRAIN_COLORS[t.train_id] || "#3B82F6",
            route: t.route || [],
          };
        });
        console.log(map)
        setTrains(map);
      }
    }).catch(() => {});

    fetch("http://localhost:3000/api/v1/tracks").then((r) => r.json()).then((data) => {
      if (data.tracks) setTracks(data.tracks);
    }).catch(() => {});
  }, []);

  const handleSimControl = useCallback((action: "start" | "pause" | "resume" | "reset") => {
    if (!socket) return;
    if (action === "pause") { socket.emit("client:control:pause"); setIsPaused(true); }
    else if (action === "resume") { socket.emit("client:control:resume"); setIsPaused(false); }
  }, [socket]);

  const handleSpeedChange = useCallback((speed: number) => {
    setSimSpeed(speed);
    fetch("http://localhost:3000/api/v1/simulation/speed", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speed }) }).catch(() => {});
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: "#0B0F19" }}>
      <Header connected={connected} />
      <div className="flex flex-1 overflow-hidden">
        <LeftControlPanel
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          trains={Object.values(trains)}
          tracks={tracks}
          activeTrains={activeTrains}
          congestedTracks={congestedTracks}
          avgDelay={avgDelay}
          freePlatforms={freePlatforms}
          selectedTrain={selectedTrain}
          onSelectTrain={setSelectedTrain}
          simSpeed={simSpeed}
          onSpeedChange={handleSpeedChange}
          isPaused={isPaused}
          onPauseResume={() => handleSimControl(isPaused ? "resume" : "pause")}
          showTrackLabels={showTrackLabels}
          onToggleTrackLabels={() => setShowTrackLabels(!showTrackLabels)}
          showTrainNames={showTrainNames}
          onToggleTrainNames={() => setShowTrainNames(!showTrainNames)}
          showAgentDecisions={showAgentDecisions}
          onToggleAgentDecisions={() => setShowAgentDecisions(!showAgentDecisions)}
        />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative overflow-hidden">
            <NetworkMap
              stations={STATIONS}
              tracks={tracks}
              trains={trains}
              selectedTrain={selectedTrain}
              onSelectTrain={setSelectedTrain}
              layerMode={layerMode}
              showTrackLabels={showTrackLabels}
              showTrainNames={showTrainNames}
            />
          </div>
          <BottomMetricsStrip
            telemetry={telemetry}
            agentDecisions={agentDecisions}
            alerts={alerts}
            onClearAlerts={() => setAlerts([])}
          />
        </div>
      </div>
    </div>
  );
}
