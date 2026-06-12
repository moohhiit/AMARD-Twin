import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Header from "./sections/Header";
import LeftControlPanel from "./sections/LeftControlPanel";
import NetworkMap from "./sections/NetworkMap";
import BottomMetricsStrip from "./sections/BottomMetricsStrip";

// ─── NETWORK CONSTANTS (unchanged from previous update) ──────────────────────
const STATIONS: Record<string, { name: string; lat: number; lng: number; platforms: number }> = {
  DEL:  { name: "New Delhi",        lat: 120, lng: 130, platforms: 6 },
  MUM:  { name: "Mumbai CST",       lat: 430, lng: 80,  platforms: 5 },
  CHN:  { name: "Chennai Central",  lat: 530, lng: 430, platforms: 5 },
  KOL:  { name: "Kolkata Howrah",   lat: 120, lng: 530, platforms: 4 },
  HYD:  { name: "Hyderabad Deccan", lat: 400, lng: 420, platforms: 4 },
  BLR:  { name: "Bengaluru City",   lat: 640, lng: 310, platforms: 4 },
  AGR:  { name: "Agra Cantonment",  lat: 250, lng: 250, platforms: 3 },
  PAT:  { name: "Patna Junction",   lat: 240, lng: 480, platforms: 3 },
  GOA:  { name: "Vasco da Gama",    lat: 640, lng: 90,  platforms: 2 },
  SUR:  { name: "Surat Junction",   lat: 360, lng: 100, platforms: 3 },
  J_NW: { name: "Ambala Jn",    lat: 170, lng: 200, platforms: 0 },
  J_NC: { name: "Kanpur Jn",    lat: 140, lng: 310, platforms: 0 },
  J_NE: { name: "Gaya Jn",      lat: 110, lng: 430, platforms: 0 },
  J_CW: { name: "Vadodara Jn",  lat: 280, lng: 120, platforms: 0 },
  J_CN: { name: "Nagpur Jn",    lat: 280, lng: 330, platforms: 0 },
  J_CE: { name: "Vijaywada Jn", lat: 360, lng: 520, platforms: 0 },
  J_MW: { name: "Pune Jn",      lat: 390, lng: 170, platforms: 0 },
  J_MC: { name: "Solapur Jn",   lat: 400, lng: 290, platforms: 0 },
  J_SW: { name: "Ratnagiri Jn", lat: 540, lng: 110, platforms: 0 },
  J_SC: { name: "Bidar Jn",     lat: 510, lng: 300, platforms: 0 },
};

export interface TrackDef {
  segment_id:    string;
  from:          string;
  to:            string;
  distance_km:   number;
  max_speed_kmh: number;
  capacity:      number;
  status:        string;
  direction:     string;
  // NEW
  weather?:      string;
  risk_level?:   string;
  signal?:       string;
  current_trains?: number;
  congestion_level?: number;
}

const TRACK_DEFAULTS: TrackDef[] = [
  // North corridor
  { segment_id:"DEL-JNW-A", from:"DEL",  to:"J_NW", distance_km:260, max_speed_kmh:160, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"DEL-JNW-B", from:"J_NW", to:"DEL",  distance_km:260, max_speed_kmh:160, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNW-AGR-A", from:"J_NW", to:"AGR",  distance_km:120, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNW-AGR-B", from:"AGR",  to:"J_NW", distance_km:120, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"AGR-JNC-A", from:"AGR",  to:"J_NC", distance_km:200, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"AGR-JNC-B", from:"J_NC", to:"AGR",  distance_km:200, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNC-JNE-A", from:"J_NC", to:"J_NE", distance_km:300, max_speed_kmh:150, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNC-JNE-B", from:"J_NE", to:"J_NC", distance_km:300, max_speed_kmh:150, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNE-PAT-A", from:"J_NE", to:"PAT",  distance_km:140, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JNE-PAT-B", from:"PAT",  to:"J_NE", distance_km:140, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"PAT-KOL-A", from:"PAT",  to:"KOL",  distance_km:390, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"PAT-KOL-B", from:"KOL",  to:"PAT",  distance_km:390, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  // West
  { segment_id:"DEL-JCW-A", from:"DEL",  to:"J_CW", distance_km:450, max_speed_kmh:150, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"DEL-JCW-B", from:"J_CW", to:"DEL",  distance_km:450, max_speed_kmh:150, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCW-SUR-A", from:"J_CW", to:"SUR",  distance_km:180, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCW-SUR-B", from:"SUR",  to:"J_CW", distance_km:180, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"SUR-MUM-A", from:"SUR",  to:"MUM",  distance_km:270, max_speed_kmh:160, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"SUR-MUM-B", from:"MUM",  to:"SUR",  distance_km:270, max_speed_kmh:160, capacity:4, status:"OPEN", direction:"BIDIRECTIONAL" },
  // Central
  { segment_id:"DEL-JCN-A", from:"DEL",  to:"J_CN", distance_km:620, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"DEL-JCN-B", from:"J_CN", to:"DEL",  distance_km:620, max_speed_kmh:140, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCN-HYD-A", from:"J_CN", to:"HYD",  distance_km:360, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCN-HYD-B", from:"HYD",  to:"J_CN", distance_km:360, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  // South
  { segment_id:"HYD-JSC-A", from:"HYD",  to:"J_SC", distance_km:220, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"HYD-JSC-B", from:"J_SC", to:"HYD",  distance_km:220, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JSC-BLR-A", from:"J_SC", to:"BLR",  distance_km:230, max_speed_kmh:110, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JSC-BLR-B", from:"BLR",  to:"J_SC", distance_km:230, max_speed_kmh:110, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"HYD-CHN-A", from:"HYD",  to:"J_CE", distance_km:270, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"HYD-CHN-B", from:"J_CE", to:"HYD",  distance_km:270, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCE-CHN-A", from:"J_CE", to:"CHN",  distance_km:190, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCE-CHN-B", from:"CHN",  to:"J_CE", distance_km:190, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"BLR-CHN-A", from:"BLR",  to:"CHN",  distance_km:350, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"BLR-CHN-B", from:"CHN",  to:"BLR",  distance_km:350, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  // Coastal
  { segment_id:"MUM-JSW-A", from:"MUM",  to:"J_SW", distance_km:340, max_speed_kmh:100, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"MUM-JSW-B", from:"J_SW", to:"MUM",  distance_km:340, max_speed_kmh:100, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JSW-GOA-A", from:"J_SW", to:"GOA",  distance_km:240, max_speed_kmh:90,  capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JSW-GOA-B", from:"GOA",  to:"J_SW", distance_km:240, max_speed_kmh:90,  capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"GOA-BLR-A", from:"GOA",  to:"BLR",  distance_km:470, max_speed_kmh:100, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"GOA-BLR-B", from:"BLR",  to:"GOA",  distance_km:470, max_speed_kmh:100, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  // Mumbai loop
  { segment_id:"MUM-JMW-A", from:"MUM",  to:"J_MW", distance_km:160, max_speed_kmh:110, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"MUM-JMW-B", from:"J_MW", to:"MUM",  distance_km:160, max_speed_kmh:110, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMW-JMC-A", from:"J_MW", to:"J_MC", distance_km:200, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMW-JMC-B", from:"J_MC", to:"J_MW", distance_km:200, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMC-HYD-A", from:"J_MC", to:"HYD",  distance_km:250, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMC-HYD-B", from:"HYD",  to:"J_MC", distance_km:250, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMC-JSC-A", from:"J_MC", to:"J_SC", distance_km:210, max_speed_kmh:110, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JMC-JSC-B", from:"J_SC", to:"J_MC", distance_km:210, max_speed_kmh:110, capacity:2, status:"OPEN", direction:"BIDIRECTIONAL" },
  // East cross
  { segment_id:"KOL-JCE-A", from:"KOL",  to:"J_CE", distance_km:520, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"KOL-JCE-B", from:"J_CE", to:"KOL",  distance_km:520, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  // Shortcuts
  { segment_id:"JCN-JMC-A", from:"J_CN", to:"J_MC", distance_km:300, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"JCN-JMC-B", from:"J_MC", to:"J_CN", distance_km:300, max_speed_kmh:130, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"AGR-JCN-A", from:"AGR",  to:"J_CN", distance_km:380, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
  { segment_id:"AGR-JCN-B", from:"J_CN", to:"AGR",  distance_km:380, max_speed_kmh:120, capacity:3, status:"OPEN", direction:"BIDIRECTIONAL" },
];

const TRAIN_COLORS: Record<string, string> = {
  "101":"#3B82F6","102":"#00E5FF","103":"#F472B6","104":"#F59E0B","105":"#10B981",
  "106":"#8B5CF6","107":"#EF4444","108":"#06B6D4","109":"#EC4899","110":"#84CC16",
  "111":"#F97316","112":"#A855F7","113":"#14B8A6","114":"#FB923C","115":"#7C3AED",
  "116":"#0EA5E9","117":"#D946EF","118":"#BE185D","119":"#FBBF24","120":"#34D399",
};

// ─── INTERFACES ───────────────────────────────────────────────────────────────
export interface TrainState {
  train_id:          string;
  name:              string;
  type:              string;
  status:            string;
  current_speed_kmh: number;
  target_speed_kmh:  number;
  max_speed_kmh:     number;
  delay_minutes:     number;
  position:          { from_node: string; to_node: string; progress_percent: number; lat: number; lng: number };
  assigned_platform: number | null;
  current_station:   string | null;
  current_segment:   string;
  next_station:      string;
  distance_to_next_km: number;
  color:             string;
  route:             string[];
  on_loop_line:      boolean;
  braking_distance_km: number;
  signal:            string;
  weather:           string;
  schedule?:         any[];
  next_scheduled_stop?: any;
}

export interface PlatformInfo {
  platform_number: number;
  status:          string;
  train_id:        string | null;
  length_meters:   number;
  free_at_time:    string | null;
}

export interface AgentDecision {
  agent_type: string;
  train_id:   string;
  decision:   string;
  reason:     string;
  timestamp:  string;
}

export interface AlertEvent {
  id:        string;
  severity:  "CRITICAL" | "WARNING" | "INFO";
  message:   string;
  detail:    string;
  timestamp: number;
}

export default function App() {
  const [socket, setSocket]         = useState<Socket | null>(null);
  const [connected, setConnected]   = useState(false);
  const [trains, setTrains]         = useState<Record<string, TrainState>>({});
  const [tracks, setTracks]         = useState<TrackDef[]>(TRACK_DEFAULTS);
  const [platforms, setPlatforms]   = useState<Record<string, PlatformInfo[]>>({});
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedTrain, setSelectedTrain]   = useState<string | null>(null);
  const [layerMode, setLayerMode]   = useState<"full" | "congestion" | "agent" | "weather" | "signal">("full");
  const [showTrackLabels, setShowTrackLabels]   = useState(false);
  const [showTrainNames, setShowTrainNames]     = useState(true);
  const [showAgentDecisions, setShowAgentDecisions] = useState(true);
  const [simSpeed, setSimSpeed]     = useState(1);
  const [isPaused, setIsPaused]     = useState(false);
  const [simTime, setSimTime]       = useState("06:00");
  // PATCH 1: simStartTime state
  const [simStartTime, setSimStartTime] = useState("06:00");
  const [telemetry, setTelemetry]   = useState<string[]>([]);
  const [agentDecisions, setAgentDecisions] = useState<AgentDecision[]>([]);
  const [alerts, setAlerts]         = useState<AlertEvent[]>([]);
  const [activeTrains, setActiveTrains]     = useState(0);
  const [congestedTracks, setCongestedTracks] = useState(0);
  const [avgDelay, setAvgDelay]     = useState(0);
  const dashboardTimer = useRef<NodeJS.Timeout | null>(null);

  // ── SOCKET CONNECTION ────────────────────────────────────────────────────
  useEffect(() => {
    const s = io("http://localhost:3000");
    setSocket(s);
    s.on("connect",    () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.emit("client:subscribe:all");
    return () => { s.disconnect(); };
  }, []);

  // ── SOCKET EVENTS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("train:update", (data) => {
      setTrains(prev => {
        const existing = prev[data.train_id];
        return {
          ...prev,
          [data.train_id]: {
            train_id:          data.train_id,
            name:              existing?.name       || `Train ${data.train_id}`,
            type:              existing?.type       || "EXPRESS",
            status:            data.status,
            current_speed_kmh: data.speed_kmh,
            target_speed_kmh:  data.target_speed_kmh ?? existing?.target_speed_kmh ?? 0,
            max_speed_kmh:     existing?.max_speed_kmh ?? 160,
            delay_minutes:     data.delay_minutes,
            position:          data.position,
            assigned_platform: existing?.assigned_platform ?? null,
            current_station:   existing?.current_station   ?? null,
            current_segment:   data.current_segment,
            next_station:      data.next_station,
            distance_to_next_km: data.distance_to_next_km ?? 0,
            color:             TRAIN_COLORS[data.train_id] || "#3B82F6",
            route:             existing?.route ?? [],
            on_loop_line:      data.on_loop_line ?? false,
            braking_distance_km: data.braking_distance_km ?? 0,
            signal:            data.signal  ?? "GREEN",
            weather:           data.weather ?? "CLEAR",
            schedule:          existing?.schedule,
            next_scheduled_stop: existing?.next_scheduled_stop,
          },
        };
      });
      setTelemetry(prev => {
        const sig = data.signal ? ` [SIG:${data.signal}]` : "";
        const wth = data.weather !== "CLEAR" ? ` [${data.weather}]` : "";
        const line = `[${new Date().toLocaleTimeString()}] ${data.train_id} — ${data.current_segment} — ${data.speed_kmh}km/h${sig}${wth}${data.speed_kmh < 50 ? " ⚠SLOW" : ""}`;
        return [...prev, line].slice(-60);
      });
    });

    socket.on("train:rerouted", (data) => {
      setAgentDecisions(prev => [...prev.slice(-49), {
        agent_type: "REROUTING", train_id: data.train_id,
        decision: `Rerouted: ${data.trigger}`,
        reason: data.reason, timestamp: data.timestamp,
      }]);
      addAlert("INFO", `Train ${data.train_id} Rerouted`, data.reason);
    });

    socket.on("platform:assigned", (data) => {
      setAgentDecisions(prev => [...prev.slice(-49), {
        agent_type: "PLATFORM", train_id: data.train_id,
        decision: `Plat ${data.platform_number} @ ${data.station_id}`,
        reason: `Score: ${data.score_breakdown?.total_score?.toFixed?.(2)}`,
        timestamp: data.eta,
      }]);
      setTrains(prev => {
        const t = prev[data.train_id];
        if (!t) return prev;
        return { ...prev, [data.train_id]: { ...t, assigned_platform: data.platform_number, current_station: data.station_id } };
      });
    });

    socket.on("platform:status", (data) => {
      setPlatforms(prev => ({ ...prev, [data.station_id]: data.platforms }));
    });

    socket.on("congestion:alert", (data) => {
      setTracks(prev => prev.map(t => t.segment_id === data.segment_id ? { ...t, status: "CONGESTED", current_trains: data.train_count } : t));
      addAlert(data.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
        `Congestion: ${data.segment_id}`,
        `${data.train_count}/${data.capacity} trains — ${data.severity}`);
    });

    socket.on("track:blocked", (data) => {
      setTracks(prev => prev.map(t => t.segment_id === data.segment_id ? { ...t, status: "BLOCKED" } : t));
      addAlert("CRITICAL", `Track BLOCKED: ${data.segment_id}`, data.reason || "Manual block");
    });

    socket.on("weather:update", (data) => {
      setTracks(prev => prev.map(t =>
        t.segment_id === data.segment_id
          ? { ...t, weather: data.weather.type, risk_level: data.weather.risk_level }
          : t
      ));
      if (data.weather.type !== "CLEAR") {
        addAlert(
          data.weather.risk_level === "CRITICAL" ? "CRITICAL" :
          data.weather.risk_level === "HIGH" ? "WARNING" : "INFO",
          `Weather: ${data.weather.type} on ${data.segment_id}`,
          data.weather.description
        );
      }
    });

    socket.on("signal:change", (data) => {
      setTracks(prev => prev.map(t =>
        t.segment_id === data.segment_id ? { ...t, signal: data.new_state } : t
      ));
      if (data.new_state === "RED") {
        setTelemetry(prev => [...prev, `[SIGNAL] ${data.segment_id} → RED — ${data.reason}`].slice(-60));
      }
    });

    socket.on("collision:warning", (data) => {
      addAlert("CRITICAL", `⚡ Collision Risk: ${data.segment_id}`,
        `${data.train_ids.join(" & ")} — ${data.distance_km}km gap — ${data.action_taken}`);
    });

    socket.on("agent:decision", (data) => {
      if (!data.agent_type) return;
      setAgentDecisions(prev => [...prev.slice(-49), data]);
    });

    socket.on("system:status", (data) => {
      setActiveTrains(data.active_trains || 0);
      setCongestedTracks(data.congested_tracks || 0);
      if (data.sim_time) setSimTime(data.sim_time);
    });

    socket.on("schedule:arrival", (data) => {
      setTelemetry(prev => [...prev,
        `[SCHED] Train ${data.train_id} arrived ${data.station_id} — sched: ${data.scheduled} actual: ${data.actual} delay: ${data.delay_min?.toFixed(1)}m`
      ].slice(-60));
    });

    return () => {
      ["train:update","train:rerouted","platform:assigned","platform:status",
       "congestion:alert","track:blocked","weather:update","signal:change",
       "collision:warning","agent:decision","system:status","schedule:arrival"
      ].forEach(ev => socket.off(ev));
    };
  }, [socket]);

  // ── DASHBOARD POLLING (every 5 s) ────────────────────────────────────────
  useEffect(() => {
    const fetchDashboard = () => {
      fetch("http://localhost:3000/api/v1/dashboard")
        .then(r => r.json())
        .then(data => {
          if (data.trains) {
            setTrains(prev => {
              const next = { ...prev };
              for (const t of data.trains) {
                next[t.train_id] = {
                  ...prev[t.train_id],
                  train_id:          t.train_id,
                  name:              t.name,
                  type:              t.type,
                  status:            t.status,
                  current_speed_kmh: t.current_speed_kmh,
                  target_speed_kmh:  t.target_speed_kmh,
                  max_speed_kmh:     t.max_speed_kmh,
                  delay_minutes:     t.delay_minutes,
                  position:          t.position,
                  current_station:   t.current_station,
                  assigned_platform: t.assigned_platform,
                  on_loop_line:      t.on_loop_line,
                  route:             t.route,
                  braking_distance_km: t.braking_distance_km,
                  color:             TRAIN_COLORS[t.train_id] || "#3B82F6",
                  schedule:          t.schedule,
                  next_scheduled_stop: t.next_scheduled_stop,
                  current_segment:   prev[t.train_id]?.current_segment || "",
                  next_station:      prev[t.train_id]?.next_station || "",
                  distance_to_next_km: prev[t.train_id]?.distance_to_next_km || 0,
                  signal:            prev[t.train_id]?.signal || "GREEN",
                  weather:           prev[t.train_id]?.weather || "CLEAR",
                };
              }
              return next;
            });
          }
          if (data.platforms)  setPlatforms(data.platforms);
          if (data.tracks) {
            setTracks(prev => prev.map(t => {
              const server = data.tracks.find((s: any) => s.segment_id === t.segment_id);
              return server ? { ...t, status: server.status, weather: server.weather,
                risk_level: server.risk_level, signal: server.signal,
                current_trains: server.current_trains, congestion_level: server.congestion_level } : t;
            }));
          }
          if (data.sim_time)  setSimTime(data.sim_time);
          if (data.summary) {
            setActiveTrains(data.summary.active_trains);
            setCongestedTracks(data.summary.congested_segments);
            setAvgDelay(data.summary.avg_delay_minutes);
          }
        })
        .catch(() => {});
    };
    fetchDashboard();
    dashboardTimer.current = setInterval(fetchDashboard, 5000);
    return () => { if (dashboardTimer.current) clearInterval(dashboardTimer.current); };
  }, []);

  const addAlert = useCallback((severity: "CRITICAL" | "WARNING" | "INFO", message: string, detail: string) => {
    setAlerts(prev => [...prev.slice(-49), { id: `${Date.now()}-${Math.random()}`, severity, message, detail, timestamp: Date.now() }]);
  }, []);

  // Stats
  useEffect(() => {
    const list = Object.values(trains);
    const delays = list.filter(t => t.delay_minutes > 0);
    setAvgDelay(delays.length ? Math.round(delays.reduce((s, t) => s + t.delay_minutes, 0) / delays.length * 10) / 10 : 0);
    setActiveTrains(list.filter(t => !["ARRIVED"].includes(t.status)).length);
  }, [trains]);

  const handleSimControl = useCallback((action: "pause" | "resume") => {
    if (!socket) return;
    if (action === "pause")  { socket.emit("client:control:pause");  setIsPaused(true); }
    if (action === "resume") { socket.emit("client:control:resume"); setIsPaused(false); }
  }, [socket]);

  // PATCH 4: handleSpeedChange — accepts full 0.1–50 range, backend validates
  const handleSpeedChange = useCallback((speed: number) => {
    // Accept full range 0.1–50; backend validates
    const clamped = Math.max(0.1, Math.min(50, speed));
    setSimSpeed(clamped);
    fetch("http://localhost:3000/api/v1/simulation/speed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed: clamped }),
    }).catch(() => {});
  }, []);

  // PATCH 2: handleStartTimeChange handler
  const handleStartTimeChange = useCallback((time: string) => {
    setSimStartTime(time);
    fetch("http://localhost:3000/api/v1/simulation/timeframe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_time: time }),
    }).catch(() => {});
    // Optimistically update displayed sim time
    setSimTime(time);
  }, []);

  const totalPlatforms = Object.values(platforms).flat().length;
  const freePlatforms  = Object.values(platforms).flat().filter(p => p.status === "FREE").length;

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: "#0B0F19" }}>
      <Header connected={connected} simTime={simTime} />
      <div className="flex flex-1 overflow-hidden">
        {/* PATCH 3: simStartTime + onStartTimeChange passed to LeftControlPanel */}
        <LeftControlPanel
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
          trains={Object.values(trains)}
          tracks={tracks}
          platforms={platforms}
          activeTrains={activeTrains}
          congestedTracks={congestedTracks}
          avgDelay={avgDelay}
          freePlatforms={`${freePlatforms}/${totalPlatforms}`}
          selectedTrain={selectedTrain}
          onSelectTrain={setSelectedTrain}
          simSpeed={simSpeed}
          onSpeedChange={handleSpeedChange}
          simStartTime={simStartTime}
          onStartTimeChange={handleStartTimeChange}
          isPaused={isPaused}
          onPauseResume={() => handleSimControl(isPaused ? "resume" : "pause")}
          showTrackLabels={showTrackLabels}
          onToggleTrackLabels={() => setShowTrackLabels(!showTrackLabels)}
          showTrainNames={showTrainNames}
          onToggleTrainNames={() => setShowTrainNames(!showTrainNames)}
          showAgentDecisions={showAgentDecisions}
          onToggleAgentDecisions={() => setShowAgentDecisions(!showAgentDecisions)}
          layerMode={layerMode}
          onLayerModeChange={setLayerMode}
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