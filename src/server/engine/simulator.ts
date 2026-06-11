import logger from "../utils/logger";
import { movementEngine, type EngineTrain } from "./movementEngine";
import { trackManager } from "./trackManager";
import { reroutingAgent } from "../agents/reroutingAgent";
import { platformAgent } from "../agents/platformAgent";
import { socketService } from "../services/socketService";
import { TrainEventModel } from "../models/mongo/TrainEvent";
import { TrainModel } from "../models/mongo/Train";
import { PlatformLogModel } from "../models/mongo/PlatformLog";
import type { TrainUpdateEvent, TrainReroutedEvent, PlatformAssignedEvent, CongestionAlertEvent } from "../types";
import { randomUUID } from "crypto";

export class Simulator {
  private tickInterval: NodeJS.Timeout | null = null;
  private simulationSpeed = parseFloat(process.env.SIMULATION_SPEED || "1");
  private tickMs = parseInt(process.env.ENGINE_TICK_MS || "100");
  private isRunning = false;
  private tickCount = 0;
  private trains: Map<string, EngineTrain> = new Map();
  private batchWriteCounter = 0;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await trackManager.loadSegments();
    const mongoTrains = await TrainModel.find().lean();
    for (const t of mongoTrains) {
      this.trains.set(t.train_id, {
        train_id: t.train_id,
        max_speed_kmh: t.max_speed_kmh,
        current_speed_kmh: t.current_speed_kmh || 0,
        status: (t.status as any) || "RUNNING",
        route: t.route,
        current_segment_index: t.current_segment_index || 0,
        position: t.position as any,
        delay_minutes: t.delay_minutes || 0,
        length_meters: t.length_meters,
        assigned_platform: t.assigned_platform || null,
        current_station: t.current_station || null,
      });
      const segId = this.getSegmentId(t.position.from_node, t.position.to_node);
      trackManager.registerTrainOnSegment(t.train_id, segId);
    }
    this.initialized = true;
    logger.info(`Simulator initialized with ${this.trains.size} trains`);
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.init();
    this.isRunning = true;
    this.tickInterval = setInterval(() => this.tick(), this.tickMs);
    logger.info("Simulator started");
    socketService.emit("system:status", {
      engine_running: true,
      simulation_speed: this.simulationSpeed,
      active_trains: this.trains.size,
      congested_tracks: 0,
    });
  }

  pause(): void {
    this.isRunning = false;
    logger.info("Simulator paused");
  }

  resume(): void {
    this.isRunning = true;
    logger.info("Simulator resumed");
  }

  stop(): void {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    logger.info("Simulator stopped");
  }

  setSpeed(multiplier: number): void {
    this.simulationSpeed = Math.max(0.5, Math.min(5.0, multiplier));
    logger.info({ speed: this.simulationSpeed }, "Simulation speed changed");
  }

  getStatus() {
    return {
      running: this.isRunning,
      speed: this.simulationSpeed,
      tick_count: this.tickCount,
      train_count: this.trains.size,
    };
  }

  getTrains(): Map<string, EngineTrain> {
    return this.trains;
  }

  getTrain(trainId: string): EngineTrain | undefined {
    return this.trains.get(trainId);
  }

  private async tick(): Promise<void> {
    if (!this.isRunning) return;
    this.tickCount++;
    const deltaSeconds = 1 * this.simulationSpeed;
    const trainArray = Array.from(this.trains.values()).filter((t) => t.status !== "ARRIVED");

    if (trainArray.length === 0) {
      // All trains arrived, reset for continuous simulation
      await this.resetTrains();
      return;
    }

    // 1. Update positions
    const updates = movementEngine.updatePositions(trainArray, deltaSeconds);

    // 2. Update track congestion
    await this.updateCongestion();

    // 3. Run agents
    for (const update of updates) {
      const train = this.trains.get(update.train_id);
      if (!train) continue;

      // Update in-memory state
      train.current_speed_kmh = update.speed_kmh;
      train.status = update.status;
      train.delay_minutes = update.delay_minutes;
      train.position = { ...update.position };

      // Rerouting agent
      if (train.status === "RUNNING" || train.status === "STOPPED") {
        if (update.delay_minutes > 5 || update.segment_status === "CONGESTED" || update.segment_status === "BLOCKED") {
          reroutingAgent.evaluate(train as any).then((decision) => {
            if (decision && decision.action === "REROUTE") {
              this.applyReroute(train, decision, update);
            }
          }).catch((err) => logger.error({ err }, "Rerouting agent error"));
        }
      }

      // Platform agent
      const nextStation = train.route[train.current_segment_index + 1];
      if (nextStation && (update.distance_to_next_km < 10 || update.speed_kmh === 0)) {
        platformAgent.evaluate(train as any).then((decision) => {
          if (decision) {
            if (decision.action === "ASSIGN") {
              this.applyPlatformAssignment(train, decision, update);
            } else if (decision.action === "WAIT") {
              train.status = "WAITING";
              train.current_speed_kmh = 0;
            }
          }
        }).catch((err) => logger.error({ err }, "Platform agent error"));
      }
    }

    // 4. Emit updates
    for (const update of updates) {
      const evt: TrainUpdateEvent = {
        train_id: update.train_id,
        timestamp: new Date().toISOString(),
        position: update.position,
        speed_kmh: update.speed_kmh,
        status: update.status,
        delay_minutes: update.delay_minutes,
        current_segment: update.current_segment,
        next_station: update.next_station,
        distance_to_next_km: update.distance_to_next_km,
      };
      socketService.emitToRoom(`train:${update.train_id}`, "train:update", evt);
      socketService.emitToRoom("all", "train:update", evt);
    }

    // 5. Batch write to MongoDB every 10 ticks
    this.batchWriteCounter++;
    if (this.batchWriteCounter >= 10) {
      this.batchWriteCounter = 0;
      await this.batchWriteToMongo();
    }

    // 6. System status every 50 ticks
    if (this.tickCount % 50 === 0) {
      const congested = trackManager.getAllSegments().filter((s) => s.status === "CONGESTED").length;
      socketService.emit("system:status", {
        engine_running: this.isRunning,
        simulation_speed: this.simulationSpeed,
        active_trains: Array.from(this.trains.values()).filter((t) => t.status !== "ARRIVED").length,
        congested_tracks: congested,
      });
    }
  }

  private async updateCongestion(): Promise<void> {
    for (const seg of trackManager.getAllSegments()) {
      const count = trackManager.getTrainCount(seg.segment_id);
      const ratio = count / seg.capacity;

      let newStatus: "OPEN" | "CONGESTED" | "BLOCKED" = seg.status;
      if (seg.status !== "BLOCKED") {
        if (ratio >= 1.0) newStatus = "CONGESTED";
        else if (ratio < 0.7) newStatus = "OPEN";
      }

      if (newStatus !== seg.status) {
        await trackManager.updateSegmentStatus(seg.segment_id, newStatus);
        const trains = trackManager.getTrainsOnSegment(seg.segment_id);
        const alert: CongestionAlertEvent = {
          segment_id: seg.segment_id,
          from_node: seg.from,
          to_node: seg.to,
          train_count: count,
          capacity: seg.capacity,
          severity: ratio >= 1 ? "CRITICAL" : ratio >= 0.9 ? "HIGH" : ratio >= 0.7 ? "MEDIUM" : "LOW",
          affected_trains: trains,
          recommended_action: ratio >= 1 ? "REROUTE" : "SLOW_DOWN",
        };
        socketService.emit("congestion:alert", alert);
      }
      trackManager.updateCongestionHistory(seg.segment_id, ratio);
      seg.current_trains = count;
      seg.congestion_level = ratio;
    }
  }

  private applyReroute(train: EngineTrain, decision: any, _update: any): void {
    const oldRoute = [...train.route];
    const oldSegments: string[] = [];
    for (let i = 0; i < oldRoute.length - 1; i++) {
      oldSegments.push(this.getSegmentId(oldRoute[i], oldRoute[i + 1]));
    }

    // Update route from current position
    const currentIdx = train.current_segment_index;
    const newRoute = [train.route[currentIdx], ...decision.new_route.slice(1)];
    train.route = newRoute;
    train.status = "REROUTING";
    train.reroute_count = (train.reroute_count || 0) + 1;

    const newSegments: string[] = [];
    for (let i = 0; i < newRoute.length - 1; i++) {
      newSegments.push(this.getSegmentId(newRoute[i], newRoute[i + 1]));
    }

    const evt: TrainReroutedEvent = {
      train_id: train.train_id,
      timestamp: new Date().toISOString(),
      old_route: oldRoute,
      new_route: newRoute,
      old_segments: oldSegments,
      new_segments: newSegments,
      reason: decision.reason,
      trigger: decision.trigger,
      estimated_delay_reduction_min: decision.estimated_savings_min,
      agent_processing_ms: 0,
    };
    socketService.emit("train:rerouted", evt);
    socketService.emit("agent:decision", {
      agent_type: "REROUTING",
      train_id: train.train_id,
      decision: decision.reason,
      reason: decision.reason,
      timestamp: new Date().toISOString(),
    });

    // Log event
    TrainEventModel.create({
      event_id: randomUUID(),
      train_id: train.train_id,
      event_type: "REROUTE",
      details: {
        old_route: oldRoute,
        new_route: newRoute,
        reason: decision.reason,
      },
      source: "REROUTING_AGENT",
      timestamp: new Date(),
    }).catch(() => {});

    // Set back to RUNNING after brief rerouting state
    setTimeout(() => {
      if (train.status === "REROUTING") {
        train.status = "RUNNING";
      }
    }, 2000);
  }

  private async applyPlatformAssignment(train: EngineTrain, decision: any, _update: any): Promise<void> {
    train.assigned_platform = decision.platform_number;
    train.current_station = decision.station_id;

    // Update platform log
    await PlatformLogModel.updateOne(
      { station_id: decision.station_id, platform_number: decision.platform_number },
      { status: "RESERVED", train_id: train.train_id, assigned_by: "PLATFORM_AGENT", assigned_at: new Date() }
    );

    const stationNames: Record<string, string> = {
      MUM: "Mumbai Central", DEL: "Delhi Junction", CHN: "Chennai Central",
      BLR: "Bangalore City", HYD: "Hyderabad",
    };

    const evt: PlatformAssignedEvent = {
      train_id: train.train_id,
      station_id: decision.station_id,
      station_name: stationNames[decision.station_id] || decision.station_id,
      platform_number: decision.platform_number,
      assigned_by: "PLATFORM_AGENT",
      eta: new Date(Date.now() + 5 * 60000).toISOString(),
      score_breakdown: decision.score_breakdown,
    };
    socketService.emit("platform:assigned", evt);
    socketService.emit("agent:decision", {
      agent_type: "PLATFORM",
      train_id: train.train_id,
      decision: `Platform ${decision.platform_number} at ${decision.station_id}`,
      reason: decision.reason,
      timestamp: new Date().toISOString(),
    });

    TrainEventModel.create({
      event_id: randomUUID(),
      train_id: train.train_id,
      event_type: "PLATFORM_ASSIGNED",
      details: {
        station_id: decision.station_id,
        platform_number: decision.platform_number,
        reason: decision.reason,
      },
      source: "PLATFORM_AGENT",
      timestamp: new Date(),
    }).catch(() => {});
  }

  private async batchWriteToMongo(): Promise<void> {
    const ops = Array.from(this.trains.values()).map((train) => ({
      updateOne: {
        filter: { train_id: train.train_id },
        update: {
          $set: {
            current_speed_kmh: train.current_speed_kmh,
            status: train.status,
            "position.progress_percent": train.position.progress_percent,
            "position.lat": train.position.lat,
            "position.lng": train.position.lng,
            delay_minutes: train.delay_minutes,
            current_segment_index: train.current_segment_index,
            assigned_platform: train.assigned_platform,
            current_station: train.current_station,
            route: train.route,
          },
        },
      },
    }));
    if (ops.length > 0) {
      await TrainModel.bulkWrite(ops).catch((err) => logger.error({ err }, "Batch write failed"));
    }
  }

  private async resetTrains(): Promise<void> {
    logger.info("All trains arrived - resetting for continuous simulation");
    for (const train of this.trains.values()) {
      train.current_segment_index = 0;
      train.status = "RUNNING";
      train.current_speed_kmh = 0;
      train.delay_minutes = 0;
      train.assigned_platform = null;
      train.current_station = null;
      train.position.progress_percent = 0;
      const startCoords = this.getStationCoords(train.route[0]);
      train.position.lat = startCoords.lat;
      train.position.lng = startCoords.lng;
      train.position.from_node = train.route[0];
      train.position.to_node = train.route[1];
    }
    // Clear all segment occupancy
    for (const seg of trackManager.getAllSegments()) {
      seg.current_trains = 0;
      seg.congestion_level = 0;
      if (seg.status === "CONGESTED") {
        await trackManager.updateSegmentStatus(seg.segment_id, "OPEN");
      }
    }
    await TrainModel.updateMany({}, {
      $set: {
        current_segment_index: 0, status: "RUNNING", current_speed_kmh: 0,
        delay_minutes: 0, assigned_platform: null, current_station: null,
        "position.progress_percent": 0,
      },
    });
  }

  private getSegmentId(from: string, to: string): string {
    const segments = [
      "MUM-J1-A", "J1-BLR-A", "BLR-CHN-A", "CHN-HYD-A",
      "HYD-J2-A", "J2-DEL-A", "DEL-HYD-B", "BLR-HYD-B",
    ];
    for (const seg of segments) {
      const parts = seg.split("-");
      const segFrom = parts[0];
      const segTo = parts[parts.length - 2];
      if (segFrom === from && segTo === to) return seg;
    }
    return `${from}-${to}-A`;
  }

  private getStationCoords(nodeId: string): { lat: number; lng: number } {
    const coords: Record<string, { lat: number; lng: number }> = {
      MUM: { lat: 100, lng: 600 }, DEL: { lat: 500, lng: 200 },
      CHN: { lat: 500, lng: 700 }, BLR: { lat: 300, lng: 650 },
      HYD: { lat: 450, lng: 550 }, J1: { lat: 200, lng: 580 },
      J2: { lat: 480, lng: 380 },
    };
    return coords[nodeId] || { lat: 0, lng: 0 };
  }
}

export const simulator = new Simulator();
