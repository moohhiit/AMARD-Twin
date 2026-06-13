// src/server/engine/movementEngine.ts
import { trackManager } from "./trackManager";
import { weatherEngine } from "./weatherEngine";
import { signalSystem } from "./signalSystem";
import { collisionSystem } from "./collisionSystem";
import { getSegmentId, getStationCoords } from "../constants/networkConstants";
import type { Position, TrainStatus } from "../types";

export interface EngineTrain {
  train_id: string;
  priority: string;
  max_speed_kmh: number;
  current_speed_kmh: number;
  target_speed_kmh: number;   // NEW — the speed the engine is driving toward
  braking_distance_km: number; // NEW — how far it takes to stop from current speed
  status: TrainStatus;
  route: string[];
  current_segment_index: number;
  position: Position;
  delay_minutes: number;
  length_meters: number;
  assigned_platform: number | null;
  current_station: string | null;
  on_loop_line: boolean;
  reroute_count?: number;
  dwell_started_at?: number;
  dwell_seconds?: number;
  platform_retry_at?: number;
}

export interface EngineUpdate {
  train_id: string;
  position: Position;
  speed_kmh: number;
  target_speed_kmh: number;
  status: TrainStatus;
  delay_minutes: number;
  current_segment: string;
  next_station: string;
  distance_to_next_km: number;
  segment_status: string;
  congestion_level: number;
  signal: string;
  weather: string;
  braking_distance_km: number;
}

// ─── PHYSICS CONSTANTS ───────────────────────────────────────────────────────
const ACCEL_KMHS = 15;   // km/h gain per simulated second when accelerating
const DECEL_KMHS = 22;   // km/h loss per simulated second when braking
const EMERGENCY_DECEL = 40;  // km/h/s for emergency braking (collision / RED signal)

// Braking distance (km) = v² / (2 * max_decel_in_km_per_s²)
// max_decel ≈ 22 km/h/s = 22/3600 km/s²
function computeBrakingDistance(speedKmh: number, decelKmhs = DECEL_KMHS): number {
  const speedKms = speedKmh / 3600; // km/s
  const decelKms = decelKmhs / 3600;
  return (speedKms * speedKms) / (2 * decelKms);
}

// Speed at which a train must be travelling to stop within `distanceKm`
function maxSpeedForDistance(distanceKm: number, decelKmhs = DECEL_KMHS): number {
  const decelKms = decelKmhs / 3600;
  return Math.sqrt(2 * decelKms * distanceKm) * 3600;
}

export class MovementEngine {
  updatePositions(trains: EngineTrain[], deltaSeconds: number): EngineUpdate[] {
    const updates: EngineUpdate[] = [];

    // Run collision check across all trains first
    const collisionResults = collisionSystem.check(trains);

    for (const train of trains) {
      if (train.status === "ARRIVED" || train.status === "WAITING") {
        updates.push(this.createUpdate(train));
        continue;
      }

      const currentSegIdx = train.current_segment_index;
      if (currentSegIdx >= train.route.length - 1) {
        train.status = "ARRIVED";
        train.current_speed_kmh = 0;
        train.target_speed_kmh = 0;
        train.current_station = train.route[train.route.length - 1];
        updates.push(this.createUpdate(train));
        continue;
      }

      const fromNode = train.route[currentSegIdx];
      const toNode = train.route[currentSegIdx + 1];
      const segmentId = getSegmentId(fromNode, toNode);
      const segment = trackManager.getSegment(segmentId);

      if (!segment) { updates.push(this.createUpdate(train)); continue; }

      // ── 1. Determine target speed ─────────────────────────────────────────
      const weather = weatherEngine.getWeather(segmentId);
      const signal = signalSystem.getSignal(segmentId);
      const collision = collisionResults.get(train.train_id);

      let maxAllowed = Math.min(train.max_speed_kmh, segment.max_speed_kmh);

      // Weather effect
      maxAllowed *= weather.speed_multiplier;

      // Congestion effect
      if (segment.status === "CONGESTED") maxAllowed *= 0.50;
      if (segment.status === "BLOCKED") maxAllowed = 0;

      // Signal compliance
      if (signal === "RED") maxAllowed = 0;
      if (signal === "YELLOW") maxAllowed = Math.min(maxAllowed, maxAllowed * 0.60);

      // Collision avoidance override
      if (collision) {
        maxAllowed = Math.min(maxAllowed, collision.target_speed);
      }

      // Decelerate in the last 5% of segment (station approach)
      const distanceRemaining = segment.distance_km * (1 - train.position.progress_percent / 100);
      // ── weather-adjusted braking distance ───────────────────────────────
      const effectiveDecel = DECEL_KMHS / weather.braking_multiplier;
      const stoppingDist = computeBrakingDistance(train.current_speed_kmh, effectiveDecel);

      if (distanceRemaining < stoppingDist * 1.2) {
        const safeSpeed = maxSpeedForDistance(distanceRemaining * 0.85, effectiveDecel);
        maxAllowed = Math.min(maxAllowed, Math.max(0, safeSpeed));
      }

      train.target_speed_kmh = Math.round(maxAllowed);
      train.braking_distance_km = stoppingDist;  // exposed so dashboard can show it


      train.target_speed_kmh = Math.round(maxAllowed);
      train.braking_distance_km = computeBrakingDistance(train.current_speed_kmh);

      // ── 2. Gradual speed change toward target ─────────────────────────────
      const decel = (collision?.must_brake) ? EMERGENCY_DECEL : DECEL_KMHS;
      if (train.current_speed_kmh < train.target_speed_kmh) {
        train.current_speed_kmh = Math.min(
          train.target_speed_kmh,
          train.current_speed_kmh + ACCEL_KMHS * deltaSeconds
        );
      } else if (train.current_speed_kmh > train.target_speed_kmh) {
        train.current_speed_kmh = Math.max(
          train.target_speed_kmh,
          train.current_speed_kmh - decel * deltaSeconds
        );
      }
      train.current_speed_kmh = Math.round(Math.max(0, train.current_speed_kmh));

      // ── 3. Status ─────────────────────────────────────────────────────────
      const st = train.status as string;
      if (train.current_speed_kmh === 0 && segment.status === "BLOCKED") {
        train.status = "STOPPED";
      } else if (train.current_speed_kmh === 0 && st !== "WAITING" && st !== "ARRIVED") {
        train.status = "BRAKING";
      } else if (train.current_speed_kmh > 0 && (st === "STOPPED" || st === "BRAKING" || st === "WAITING")) {
        train.status = "RUNNING";
      } else if (st !== "REROUTING" && st !== "WAITING" && st !== "ARRIVED") {
        train.status = "RUNNING";
      }

      // ── 4. Position update ────────────────────────────────────────────────
      const distanceMoved = (train.current_speed_kmh / 3600) * deltaSeconds;
      const progressDelta = segment.distance_km > 0
        ? (distanceMoved / segment.distance_km) * 100 : 0;
      let newProgress = train.position.progress_percent + progressDelta;

      // Delay accumulation (weather + speed below limit)
      const effectiveCap = segment.max_speed_kmh * weather.speed_multiplier;
      if (train.current_speed_kmh < effectiveCap * 0.8) {
        const fraction = 1 - (train.current_speed_kmh / effectiveCap);
        train.delay_minutes += (deltaSeconds / 60) * fraction;
        // Extra delay from weather probability
        if (Math.random() < weather.delay_probability * (deltaSeconds / 60)) {
          train.delay_minutes += 0.5;
        }
      }

      // ── 5. Segment completion ─────────────────────────────────────────────
      if (newProgress >= 100) {
        newProgress = 0;
        trackManager.removeTrainFromSegment(train.train_id, segmentId);
        train.current_segment_index++;

        if (train.current_segment_index >= train.route.length - 1) {
          train.status = "ARRIVED";
          train.current_speed_kmh = 0;
          train.target_speed_kmh = 0;
          train.current_station = train.route[train.route.length - 1];
          train.position.progress_percent = 100;
          const dest = getStationCoords(train.route[train.route.length - 1]);
          train.position.lat = dest.lat;
          train.position.lng = dest.lng;
          updates.push(this.createUpdate(train));
          continue;
        }

        const nFrom = train.route[train.current_segment_index];
        const nTo = train.route[train.current_segment_index + 1];
        const nSegId = getSegmentId(nFrom, nTo);
        trackManager.registerTrainOnSegment(train.train_id, nSegId);

        train.position.from_node = nFrom;
        train.position.to_node = nTo;
        train.position.progress_percent = 0;
        const fc = getStationCoords(nFrom);
        train.position.lat = fc.lat;
        train.position.lng = fc.lng;
      } else {
        train.position.progress_percent = newProgress;
        const fc = getStationCoords(train.position.from_node);
        const tc = getStationCoords(train.position.to_node);
        const p = newProgress / 100;
        train.position.lat = fc.lat + (tc.lat - fc.lat) * p;
        train.position.lng = fc.lng + (tc.lng - fc.lng) * p;
      }

      updates.push(this.createUpdate(train));
    }

    return updates;
  }

  private createUpdate(train: EngineTrain): EngineUpdate {
    const fromNode = train.route[train.current_segment_index];
    const toNode = train.route[Math.min(train.current_segment_index + 1, train.route.length - 1)];
    const segmentId = getSegmentId(fromNode, toNode);
    const segment = trackManager.getSegment(segmentId);
    const weather = weatherEngine.getWeather(segmentId);
    const signal = signalSystem.getSignal(segmentId);
    const progRem = 1 - train.position.progress_percent / 100;
    const distToNext = segment ? segment.distance_km * progRem : 0;

    return {
      train_id: train.train_id,
      position: { ...train.position },
      speed_kmh: train.current_speed_kmh,
      target_speed_kmh: train.target_speed_kmh,
      status: train.status,
      delay_minutes: Math.round(train.delay_minutes * 10) / 10,
      current_segment: segmentId,
      next_station: toNode,
      distance_to_next_km: Math.round(distToNext * 10) / 10,
      segment_status: segment?.status ?? "OPEN",
      congestion_level: segment ? trackManager.getTrainCount(segmentId) / segment.capacity : 0,
      signal,
      weather: weather.type,
      braking_distance_km: train.braking_distance_km,
    };
  }
}

export const movementEngine = new MovementEngine();