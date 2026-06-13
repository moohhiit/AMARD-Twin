import logger from "../utils/logger";
import { movementEngine, type EngineTrain } from "./movementEngine";
import { trackManager }   from "./trackManager";
import { weatherEngine }  from "./weatherEngine";
import { signalSystem }   from "./signalSystem";
import { loopManager, LOOP_LINES } from "./loopManager";
import { reroutingAgent } from "../agents/reroutingAgent";
import { platformAgent }  from "../agents/platformAgent";
import { socketService }  from "../services/socketService";
import {
  initSchedules, recordArrival, recordDeparture,
  computeScheduledDelay, getSchedule, getNextStop, toHHMM,
  currentSimMinute, setSimStartTime,
} from "./scheduleManager";
import { TrainEventModel }  from "../models/mongo/TrainEvent";
import { TrainModel }       from "../models/mongo/Train";
import { PlatformLogModel } from "../models/mongo/PlatformLog";
import { getSegmentId, getStationCoords } from "../constants/networkConstants";
import type {
  TrainUpdateEvent, TrainReroutedEvent,
  PlatformAssignedEvent, CongestionAlertEvent, ScheduleStop,
} from "../types";
import { randomUUID } from "crypto";

const STATION_NAMES: Record<string, string> = {
  DEL:"New Delhi", MUM:"Mumbai CST", CHN:"Chennai Central",
  KOL:"Kolkata Howrah", HYD:"Hyderabad Deccan", BLR:"Bengaluru City",
  AGR:"Agra Cantonment", PAT:"Patna Junction", GOA:"Vasco da Gama", SUR:"Surat Junction",
};

const JUNCTIONS = new Set(["J_NW","J_NC","J_NE","J_CW","J_CN","J_CE","J_MW","J_MC","J_SW","J_SC"]);

export class Simulator {
  private tickInterval:    NodeJS.Timeout | null = null;
  private simulationSpeed = parseFloat(process.env.SIMULATION_SPEED || "1");
  private tickMs          = parseInt(process.env.ENGINE_TICK_MS || "100");
  private isRunning       = false;
  private tickCount       = 0;
  private trains          = new Map<string, EngineTrain>();
  private batchWriteCounter = 0;
  private initialized     = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await trackManager.loadSegments();
    const mongoTrains  = await TrainModel.find().lean();
    const scheduleMap  = new Map<string, ScheduleStop[]>();

    for (const t of mongoTrains) {
      const engine: EngineTrain = {
        train_id:              t.train_id,
        priority:              (t.type as any) || "PASSENGER",
        max_speed_kmh:         t.max_speed_kmh,
        current_speed_kmh:     t.current_speed_kmh || 0,
        target_speed_kmh:      0,
        braking_distance_km:   0,
        status:                (t.status as any) || "RUNNING",
        route:                 t.route,
        current_segment_index: t.current_segment_index || 0,
        position:              t.position as any,
        delay_minutes:         t.delay_minutes || 0,
        length_meters:         t.length_meters,
        assigned_platform:     t.assigned_platform || null,
        current_station:       t.current_station || null,
        on_loop_line:          false,
      };
      this.trains.set(t.train_id, engine);
      const segId = getSegmentId(t.position.from_node, t.position.to_node);
      trackManager.registerTrainOnSegment(t.train_id, segId);

      if ((t as any).schedule?.length) {
        scheduleMap.set(t.train_id, (t as any).schedule as ScheduleStop[]);
      }
    }

    const segmentIds = trackManager.getAllSegments().map(s => s.segment_id);
    weatherEngine.init(segmentIds);
    signalSystem.init(segmentIds);
    loopManager.init();
    initSchedules(scheduleMap, "06:00");

    this.initialized = true;
    logger.info(`Simulator initialized: ${this.trains.size} trains, ${segmentIds.length} segments`);
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.init();
    // Idempotent: if the tick loop is already running, just ensure isRunning flag is set
    if (this.tickInterval !== null) {
      this.isRunning = true;
      return;
    }
    this.isRunning = true;
    weatherEngine.setSimulationSpeed(this.simulationSpeed); // sync speed on start
    weatherEngine.start();
    this.tickInterval = setInterval(() => this.tick(), this.tickMs);
    logger.info("Simulator started");
    socketService.emit("system:status", {
      engine_running:   true,
      simulation_speed: this.simulationSpeed,
      active_trains:    this.trains.size,
      congested_tracks: 0,
    });
  }

  pause():  void { this.isRunning = false; logger.info("Simulator paused"); }
  resume(): void { this.isRunning = true;  logger.info("Simulator resumed"); }

  stop(): void {
    this.isRunning = false;
    weatherEngine.stop();
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    logger.info("Simulator stopped");
  }

  // ── EXPANDED: 0.1× to 50× (was 0.5–5×) ──────────────────────────────────
  setSpeed(multiplier: number): void {
    this.simulationSpeed = Math.max(0.1, Math.min(50.0, multiplier));
    weatherEngine.setSimulationSpeed(this.simulationSpeed);
    socketService.emit("system:status", {
      engine_running:   this.isRunning,
      simulation_speed: this.simulationSpeed,
      active_trains:    this.trains.size,
      congested_tracks: 0,
    });
  }

  // ── NEW: jump simulation clock to any HH:MM ───────────────────────────────
  setTimeframe(startHHMM: string): void {
    setSimStartTime(startHHMM, true);
    logger.info(`Sim time reset to ${startHHMM}`);
    socketService.emit("system:time_reset", {
      new_start_time: startHHMM,
      timestamp:      new Date().toISOString(),
    });
  }

  getStatus() {
    return {
      running:     this.isRunning,
      speed:       this.simulationSpeed,
      tick_count:  this.tickCount,
      train_count: this.trains.size,
    };
  }

  getTrains()          { return this.trains; }
  getTrain(id: string) { return this.trains.get(id); }
  getCurrentSimTime(): string {
    return toHHMM(currentSimMinute(this.simulationSpeed));
  }

  // ─── MAIN TICK ─────────────────────────────────────────────────────────────
  private async tick(): Promise<void> {
    if (!this.isRunning) return;
    this.tickCount++;
    const deltaSeconds = 1 * this.simulationSpeed;
    const nowMs        = Date.now();
    const trainArray   = Array.from(this.trains.values()).filter(t => t.status !== "ARRIVED");

    if (trainArray.length === 0) { await this.resetTrains(); return; }

    // 1. Signal update
    signalSystem.update();

    // 2. Movement
    const updates = movementEngine.updatePositions(trainArray, deltaSeconds);

    // 3. Congestion
    await this.updateCongestion();

    // 4. Per-train agent logic
    for (const update of updates) {
      const train = this.trains.get(update.train_id);
      if (!train) continue;

      // ── DWELL EXPIRY ──────────────────────────────────────────────────────
      if (train.status === "WAITING" && train.assigned_platform !== null) {
        const elapsed = nowMs - (train.dwell_started_at ?? nowMs);
        // FIX: scale dwell by simulation speed
        const scaledDwellMs = ((train.dwell_seconds ?? 20) * 1000) / this.simulationSpeed;
        if (elapsed >= scaledDwellMs) {
          await this.departFromPlatform(train);
        }
        continue;
      }

      // ── WAIT RETRY ────────────────────────────────────────────────────────
      if (train.status === "WAITING" && train.assigned_platform === null) {
        if (nowMs >= (train.platform_retry_at ?? 0)) {
          this.runPlatformAgent(train, update);
        }
        continue;
      }

      // ── NORMAL RUNNING ────────────────────────────────────────────────────
      train.current_speed_kmh   = update.speed_kmh;
      train.target_speed_kmh    = update.target_speed_kmh;
      train.status              = update.status;
      train.braking_distance_km = update.braking_distance_km;

      const schedDelay = computeScheduledDelay(train.train_id, this.simulationSpeed);
      if (schedDelay > 0) train.delay_minutes = Math.max(train.delay_minutes, schedDelay);

      train.position = { ...update.position };

      if (train.status === "REROUTING") {
        const rs = (train as any)._rerouting_started_at as number | undefined;
        if (rs && nowMs - rs >= 2000) {
          train.status = "RUNNING";
          (train as any)._rerouting_started_at = undefined;
        }
      }

      if (["RUNNING","STOPPED","BRAKING"].includes(train.status)) {
        const shouldReroute =
          update.delay_minutes > 5     ||
          update.segment_status === "CONGESTED" ||
          update.segment_status === "BLOCKED"   ||
          update.signal === "RED"       ||
          update.weather === "STORM";
        if (shouldReroute) {
          reroutingAgent.evaluate(train as any).then(decision => {
            if (decision?.action === "REROUTE") this.applyReroute(train, decision, update);
          }).catch(err => logger.error({ err }, "Rerouting agent error"));
        }
      }

      const nextStation = train.route[train.current_segment_index + 1];
      const isTerminal  = nextStation && !JUNCTIONS.has(nextStation);
      if (isTerminal && (update.distance_to_next_km < 10 || update.speed_kmh === 0)) {
        if (!(train.assigned_platform && train.current_station === nextStation)) {
          this.runPlatformAgent(train, update);
        }
      }
    }

    // 5. Loop diversion check ──────────────────────────────────────────────
    for (const update of updates) {
      const train = this.trains.get(update.train_id);
      if (!train || ["ARRIVED","WAITING"].includes(train.status)) continue;

      const nextNode = train.route[train.current_segment_index + 1];
      if (!nextNode || !LOOP_LINES[nextNode]) continue;

      for (const [otherId, other] of this.trains.entries()) {
        if (otherId === train.train_id) continue;
        if (other.status === "ARRIVED") continue;
        const otherNext = other.route[other.current_segment_index + 1];
        if (otherNext !== nextNode) continue;

        if (loopManager.shouldDivert(train as any, other as any, nextNode)) {
          const loopSeg = loopManager.divert(train as any, nextNode);
          if (loopSeg) {
            train.status            = "WAITING";
            train.current_speed_kmh = 0;
            train.on_loop_line      = true;
            socketService.emit("agent:decision", {
              agent_type: "REROUTING",
              train_id:   train.train_id,
              decision:   `Diverted to loop ${loopSeg} at ${nextNode}`,
              reason:     `Higher-priority train ${otherId} approaching`,
              timestamp:  new Date().toISOString(),
            });
          }
          break;
        }
      }
    }

    // 6. Broadcast train updates
    for (const update of updates) {
      const train = this.trains.get(update.train_id);
      if (!train) continue;
      const evt: TrainUpdateEvent = {
        train_id:            update.train_id,
        timestamp:           new Date().toISOString(),
        position:            train.position,
        speed_kmh:           train.current_speed_kmh,
        target_speed_kmh:    train.target_speed_kmh,
        status:              train.status,
        delay_minutes:       train.delay_minutes,
        current_segment:     update.current_segment,
        next_station:        update.next_station,
        distance_to_next_km: update.distance_to_next_km,
        signal:              update.signal as any,
        weather:             update.weather as any,
        on_loop_line:        train.on_loop_line,
      };
      socketService.emitToRoom(`train:${update.train_id}`, "train:update", evt);
      socketService.emitToRoom("all", "train:update", evt);
    }

    // 7. Batch MongoDB write every 10 ticks
    if (++this.batchWriteCounter >= 10) {
      this.batchWriteCounter = 0;
      await this.batchWriteToMongo();
    }

    // 8. System status + platform broadcast every 50 ticks
    if (this.tickCount % 50 === 0) {
      const congested = trackManager.getAllSegments().filter(s => s.status === "CONGESTED").length;
      socketService.emit("system:status", {
        engine_running:   this.isRunning,
        simulation_speed: this.simulationSpeed,
        active_trains:    trainArray.length,
        congested_tracks: congested,
        sim_time:         this.getCurrentSimTime(),
        loop_occupancy:   loopManager.getLoopOccupancy(),
      });
      await this.broadcastPlatformStatus();
    }
  }

  // ─── CONGESTION ────────────────────────────────────────────────────────────
  private async updateCongestion(): Promise<void> {
    for (const seg of trackManager.getAllSegments()) {
      const count = trackManager.getTrainCount(seg.segment_id);
      const ratio = count / seg.capacity;
      let newStatus: "OPEN" | "CONGESTED" | "BLOCKED" = seg.status;
      if (seg.status !== "BLOCKED") {
        if (ratio >= 1.0)  newStatus = "CONGESTED";
        else if (ratio < 0.7) newStatus = "OPEN";
      }
      if (newStatus !== seg.status) {
        await trackManager.updateSegmentStatus(seg.segment_id, newStatus);
        const trains = trackManager.getTrainsOnSegment(seg.segment_id);
        const alert: CongestionAlertEvent = {
          segment_id:  seg.segment_id,
          from_node:   seg.from,
          to_node:     seg.to,
          train_count: count,
          capacity:    seg.capacity,
          severity:    ratio >= 1 ? "CRITICAL" : ratio >= 0.9 ? "HIGH" : "MEDIUM",
          affected_trains: trains,
          recommended_action: ratio >= 1 ? "REROUTE" : "SLOW_DOWN",
        };
        socketService.emit("congestion:alert", alert);
      }
      trackManager.updateCongestionHistory(seg.segment_id, ratio);
      seg.current_trains   = count;
      seg.congestion_level = ratio;
    }
  }

  // ─── PLATFORM AGENT RUNNER ─────────────────────────────────────────────────
  private runPlatformAgent(train: EngineTrain, update: any): void {
    platformAgent.evaluate(train as any).then(decision => {
      if (!decision) return;
      if (decision.action === "ASSIGN") {
        this.applyPlatformAssignment(train, decision, update);
      } else if (decision.action === "WAIT") {
        train.status            = "WAITING";
        train.current_speed_kmh = 0;
        train.assigned_platform = null;
        train.platform_retry_at = Date.now() + decision.retry_in_seconds * 1000;
      }
    }).catch(err => logger.error({ err }, "Platform agent error"));
  }

  // ─── REROUTE ───────────────────────────────────────────────────────────────
  private applyReroute(train: EngineTrain, decision: any, _update: any): void {
    const oldRoute   = [...train.route];
    const oldSegs    = oldRoute.slice(0, -1).map((n, i) => getSegmentId(n, oldRoute[i + 1]));
    const currentIdx = train.current_segment_index;
    const newRoute   = [train.route[currentIdx], ...decision.new_route.slice(1)];
    train.route  = newRoute;
    train.status = "REROUTING";
    train.reroute_count = (train.reroute_count || 0) + 1;
    (train as any)._rerouting_started_at = Date.now();

    const newSegs = newRoute.slice(0, -1).map((n, i) => getSegmentId(n, newRoute[i + 1]));

    const evt: TrainReroutedEvent = {
      train_id:   train.train_id,
      timestamp:  new Date().toISOString(),
      old_route:  oldRoute,
      new_route:  newRoute,
      old_segments: oldSegs,
      new_segments: newSegs,
      reason:     decision.reason,
      trigger:    decision.trigger,
      estimated_delay_reduction_min: decision.estimated_savings_min,
      agent_processing_ms: 0,
    };
    socketService.emit("train:rerouted", evt);
    socketService.emit("agent:decision", {
      agent_type: "REROUTING",
      train_id:   train.train_id,
      decision:   decision.reason,
      reason:     decision.reason,
      timestamp:  new Date().toISOString(),
    });
    TrainEventModel.create({
      event_id:   randomUUID(),
      train_id:   train.train_id,
      event_type: "REROUTE",
      details:    { old_route: oldRoute, new_route: newRoute, reason: decision.reason },
      source:     "REROUTING_AGENT",
      timestamp:  new Date(),
    }).catch(() => {});
  }

  // ─── PLATFORM ASSIGNMENT ───────────────────────────────────────────────────
  private async applyPlatformAssignment(train: EngineTrain, decision: any, _update: any): Promise<void> {
    train.assigned_platform = decision.platform_number;
    train.current_station   = decision.station_id;
    train.dwell_seconds     = decision.dwell_seconds ?? 20;
    train.dwell_started_at  = Date.now();
    train.status            = "WAITING";
    train.current_speed_kmh = 0;

    recordArrival(train.train_id, decision.station_id, this.simulationSpeed);

    await PlatformLogModel.updateOne(
      { station_id: decision.station_id, platform_number: decision.platform_number },
      { status: "OCCUPIED", train_id: train.train_id, assigned_by: "PLATFORM_AGENT", assigned_at: new Date(), freed_at: null }
    );

    const freeAt = new Date(Date.now() + (train.dwell_seconds * 1000) / this.simulationSpeed).toISOString();
    const evt: PlatformAssignedEvent = {
      train_id:        train.train_id,
      station_id:      decision.station_id,
      station_name:    STATION_NAMES[decision.station_id] || decision.station_id,
      platform_number: decision.platform_number,
      assigned_by:     "PLATFORM_AGENT",
      eta:             new Date(Date.now() + 2 * 60000).toISOString(),
      free_at:         freeAt,
      score_breakdown: decision.score_breakdown,
    };
    socketService.emit("platform:assigned", evt);
    socketService.emit("agent:decision", {
      agent_type: "PLATFORM",
      train_id:   train.train_id,
      decision:   `Platform ${decision.platform_number} @ ${decision.station_id} (dwell ${train.dwell_seconds}s)`,
      reason:     decision.reason,
      timestamp:  new Date().toISOString(),
    });

    TrainEventModel.create({
      event_id:   randomUUID(),
      train_id:   train.train_id,
      event_type: "PLATFORM_ASSIGNED",
      details:    { station_id: decision.station_id, platform_number: decision.platform_number, dwell_seconds: train.dwell_seconds },
      source:     "PLATFORM_AGENT",
      timestamp:  new Date(),
    }).catch(() => {});
  }

  // ─── DEPART FROM PLATFORM ──────────────────────────────────────────────────
  private async departFromPlatform(train: EngineTrain): Promise<void> {
    const stationId   = train.current_station!;
    const platformNum = train.assigned_platform!;

    recordDeparture(train.train_id, stationId, this.simulationSpeed);

    await PlatformLogModel.updateOne(
      { station_id: stationId, platform_number: platformNum },
      { status: "FREE", train_id: null, freed_at: new Date() }
    ).catch(err => logger.error({ err }, "Failed to free platform"));

    const oldSegId = getSegmentId(
      train.route[train.current_segment_index],
      train.route[train.current_segment_index + 1] ?? train.route[train.current_segment_index]
    );
    trackManager.removeTrainFromSegment(train.train_id, oldSegId);
    train.current_segment_index++;

    if (train.current_segment_index >= train.route.length - 1) {
      train.status            = "ARRIVED";
      train.current_speed_kmh = 0;
      train.current_station   = train.route[train.route.length - 1];
      train.assigned_platform = null;
      train.dwell_started_at  = undefined;
      train.dwell_seconds     = undefined;
      train.position.progress_percent = 100;
      return;
    }

    const nFrom  = train.route[train.current_segment_index];
    const nTo    = train.route[train.current_segment_index + 1];
    const nSegId = getSegmentId(nFrom, nTo);
    trackManager.registerTrainOnSegment(train.train_id, nSegId);

    train.position.from_node = nFrom;
    train.position.to_node   = nTo;
    train.position.progress_percent = 0;
    const fc = getStationCoords(nFrom);
    train.position.lat = fc.lat;
    train.position.lng = fc.lng;

    train.assigned_platform = null;
    train.current_station   = null;
    train.dwell_started_at  = undefined;
    train.dwell_seconds     = undefined;
    train.status            = "RUNNING";
    train.current_speed_kmh = 20;
    train.target_speed_kmh  = Math.round(train.max_speed_kmh * 0.5);

    // Release loop if train was on one
    if (train.on_loop_line) {
      loopManager.release(train.train_id, stationId, train as any);
    }

    socketService.emit("agent:decision", {
      agent_type: "PLATFORM",
      train_id:   train.train_id,
      decision:   `Departed platform ${platformNum} at ${stationId} — RUNNING`,
      reason:     "Dwell time expired",
      timestamp:  new Date().toISOString(),
    });
    TrainEventModel.create({
      event_id:   randomUUID(),
      train_id:   train.train_id,
      event_type: "DEPARTURE",
      details:    { station_id: stationId, platform_number: platformNum, new_segment: nSegId },
      source:     "ENGINE",
      timestamp:  new Date(),
    }).catch(() => {});
  }

  // ─── PLATFORM STATUS BROADCAST ─────────────────────────────────────────────
  private async broadcastPlatformStatus(): Promise<void> {
    const stations = ["DEL","MUM","CHN","KOL","HYD","BLR","AGR","PAT","GOA","SUR"];
    for (const stationId of stations) {
      const logs = await PlatformLogModel.find({ station_id: stationId }).lean();
      socketService.emit("platform:status", {
        station_id: stationId,
        platforms: logs.map(l => ({
          number:       l.platform_number,
          status:       l.status,
          train_id:     l.train_id,
          free_at_time: l.freed_at ? new Date(l.freed_at as any).toISOString() : null,
        })),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─── MONGO BATCH WRITE ─────────────────────────────────────────────────────
  private async batchWriteToMongo(): Promise<void> {
    const ops = Array.from(this.trains.values()).map(train => ({
      updateOne: {
        filter: { train_id: train.train_id },
        update: {
          $set: {
            current_speed_kmh:           train.current_speed_kmh,
            status:                      train.status,
            "position.progress_percent": train.position.progress_percent,
            "position.lat":              train.position.lat,
            "position.lng":              train.position.lng,
            delay_minutes:               train.delay_minutes,
            current_segment_index:       train.current_segment_index,
            assigned_platform:           train.assigned_platform,
            current_station:             train.current_station,
            route:                       train.route,
          },
        },
      },
    }));
    if (ops.length > 0) {
      await TrainModel.bulkWrite(ops).catch(err => logger.error({ err }, "Batch write failed"));
    }
  }

  // ─── RESET ─────────────────────────────────────────────────────────────────
  private async resetTrains(): Promise<void> {
    logger.info("All trains arrived — resetting for continuous simulation");
    for (const train of this.trains.values()) {
      train.current_segment_index = 0;
      train.status                = "RUNNING";
      train.current_speed_kmh     = 0;
      train.target_speed_kmh      = 0;
      train.delay_minutes         = 0;
      train.assigned_platform     = null;
      train.current_station       = null;
      train.on_loop_line          = false;
      train.position.progress_percent = 0;
      const sc = getStationCoords(train.route[0]);
      train.position.lat       = sc.lat;
      train.position.lng       = sc.lng;
      train.position.from_node = train.route[0];
      train.position.to_node   = train.route[1];
    }

    for (const seg of trackManager.getAllSegments()) {
      seg.current_trains   = 0;
      seg.congestion_level = 0;
      if (seg.status === "CONGESTED") {
        await trackManager.updateSegmentStatus(seg.segment_id, "OPEN");
      }
    }

    // FIX: free all platform locks so agents start clean
    await PlatformLogModel.updateMany(
      { status: "OCCUPIED" },
      { $set: { status: "FREE", train_id: null, freed_at: new Date() } }
    ).catch(err => logger.error({ err }, "Failed to free platforms on reset"));

    await TrainModel.updateMany({}, {
      $set: {
        current_segment_index: 0, status: "RUNNING", current_speed_kmh: 0,
        delay_minutes: 0, assigned_platform: null, current_station: null,
        "position.progress_percent": 0,
      },
    });
  }
}

export const simulator = new Simulator();