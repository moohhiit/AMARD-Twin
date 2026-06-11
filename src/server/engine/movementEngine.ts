import { trackManager } from "./trackManager";
import type { Position, TrainStatus } from "../types";

export interface EngineTrain {
  train_id: string;
  max_speed_kmh: number;
  current_speed_kmh: number;
  status: TrainStatus;
  route: string[];
  current_segment_index: number;
  position: Position;
  delay_minutes: number;
  length_meters: number;
  assigned_platform: number | null;
  current_station: string | null;
  reroute_count?: number;
}

export interface EngineUpdate {
  train_id: string;
  position: Position;
  speed_kmh: number;
  status: TrainStatus;
  delay_minutes: number;
  current_segment: string;
  next_station: string;
  distance_to_next_km: number;
  segment_status: string;
  congestion_level: number;
}

function getSegmentId(from: string, to: string): string {
  const segments = [
    "MUM-J1-A", "J1-BLR-A", "BLR-CHN-A", "CHN-HYD-A",
    "HYD-J2-A", "J2-DEL-A", "DEL-HYD-B", "BLR-HYD-B",
  ];
  for (const seg of segments) {
    const parts = seg.split("-");
    const segFrom = parts[0];
    const segTo = parts[parts.length - 2];
    if ((segFrom === from && segTo === to)) return seg;
  }
  return `${from}-${to}-A`;
}

function getStationCoords(nodeId: string): { lat: number; lng: number } {
  const coords: Record<string, { lat: number; lng: number }> = {
    MUM: { lat: 100, lng: 600 }, DEL: { lat: 500, lng: 200 },
    CHN: { lat: 500, lng: 700 }, BLR: { lat: 300, lng: 650 },
    HYD: { lat: 450, lng: 550 }, J1: { lat: 200, lng: 580 },
    J2: { lat: 480, lng: 380 },
  };
  return coords[nodeId] || { lat: 0, lng: 0 };
}

export class MovementEngine {
  updatePositions(trains: EngineTrain[], deltaSeconds: number): EngineUpdate[] {
    const updates: EngineUpdate[] = [];

    for (const train of trains) {
      if (train.status === "ARRIVED" || train.status === "WAITING") {
        updates.push(this.createUpdate(train));
        continue;
      }

      const currentSegIdx = train.current_segment_index;
      if (currentSegIdx >= train.route.length - 1) {
        train.status = "ARRIVED";
        train.current_speed_kmh = 0;
        train.current_station = train.route[train.route.length - 1];
        updates.push(this.createUpdate(train));
        continue;
      }

      const fromNode = train.route[currentSegIdx];
      const toNode = train.route[currentSegIdx + 1];
      const segmentId = getSegmentId(fromNode, toNode);
      const segment = trackManager.getSegment(segmentId);

      if (!segment) {
        updates.push(this.createUpdate(train));
        continue;
      }

      // Compute speed
      let speed = Math.min(train.max_speed_kmh, segment.max_speed_kmh);
      if (segment.status === "CONGESTED") speed *= 0.5;
      if (segment.status === "BLOCKED") speed = 0;

      // Safe following distance
      const trainsOnSeg = trackManager.getTrainsOnSegment(segmentId);
      const trainAhead = this.findTrainAhead(train, trainsOnSeg);
      if (trainAhead && trainAhead.distance_km < 2) {
        speed = 0;
      } else if (trainAhead && trainAhead.distance_km < 5) {
        speed = Math.min(speed, trainAhead.speed_kmh);
      }

      train.current_speed_kmh = Math.round(speed);

      const st = train.status as string;
      if (speed === 0 && segment.status === "BLOCKED") {
        train.status = "STOPPED";
      } else if (speed === 0 && st !== "WAITING" && st !== "ARRIVED") {
        train.status = "STOPPED";
      } else if (speed > 0 && (st === "STOPPED" || st === "WAITING")) {
        train.status = "RUNNING";
      }

      // Update position
      const distanceMoved = (speed / 3600) * deltaSeconds; // km
      const segmentDistance = segment.distance_km;
      const progressDelta = segmentDistance > 0 ? (distanceMoved / segmentDistance) * 100 : 0;
      let newProgress = train.position.progress_percent + progressDelta;

      // Update delay
      if (speed < segment.max_speed_kmh * 0.8) {
        train.delay_minutes += (deltaSeconds / 60) * (1 - speed / segment.max_speed_kmh);
      }

      // Advance to next segment if complete
      if (newProgress >= 100) {
        newProgress = 0;
        trackManager.removeTrainFromSegment(train.train_id, segmentId);
        train.current_segment_index++;

        if (train.current_segment_index >= train.route.length - 1) {
          train.status = "ARRIVED";
          train.current_speed_kmh = 0;
          train.current_station = train.route[train.route.length - 1];
          train.position.progress_percent = 100;
          const destCoords = getStationCoords(train.route[train.route.length - 1]);
          train.position.lat = destCoords.lat;
          train.position.lng = destCoords.lng;
          updates.push(this.createUpdate(train));
          continue;
        }

        const newFrom = train.route[train.current_segment_index];
        const newTo = train.route[train.current_segment_index + 1];
        const newSegId = getSegmentId(newFrom, newTo);
        trackManager.registerTrainOnSegment(train.train_id, newSegId);

        train.position.from_node = newFrom;
        train.position.to_node = newTo;
        train.position.progress_percent = 0;

        const fromCoords = getStationCoords(newFrom);
        train.position.lat = fromCoords.lat;
        train.position.lng = fromCoords.lng;
      } else {
        train.position.progress_percent = newProgress;
        const fromCoords = getStationCoords(train.position.from_node);
        const toCoords = getStationCoords(train.position.to_node);
        const p = newProgress / 100;
        train.position.lat = fromCoords.lat + (toCoords.lat - fromCoords.lat) * p;
        train.position.lng = fromCoords.lng + (toCoords.lng - fromCoords.lng) * p;
      }

      updates.push(this.createUpdate(train));
    }

    return updates;
  }

  private findTrainAhead(_train: EngineTrain, _trainIdsOnSegment: string[]): { distance_km: number; speed_kmh: number } | null {
    // In a real system, we'd look at all trains' positions
    // For simulation, we'll use a simple heuristic based on progress
    return null; // Simplified - no following distance for basic sim
  }

  private createUpdate(train: EngineTrain): EngineUpdate {
    const fromNode = train.route[train.current_segment_index];
    const toNode = train.route[Math.min(train.current_segment_index + 1, train.route.length - 1)];
    const segmentId = getSegmentId(fromNode, toNode);
    const segment = trackManager.getSegment(segmentId);
    const nextStation = toNode;
    const fromCoords = getStationCoords(fromNode);
    const toCoords = getStationCoords(toNode);
    const dx = toCoords.lat - fromCoords.lat;
    const dy = toCoords.lng - fromCoords.lng;
    const dist = Math.sqrt(dx * dx + dy * dy) * 2; // Rough km estimate
    const progressRemaining = 1 - (train.position.progress_percent / 100);
    const distanceToNext = segment ? segment.distance_km * progressRemaining : dist * progressRemaining;

    return {
      train_id: train.train_id,
      position: { ...train.position },
      speed_kmh: train.current_speed_kmh,
      status: train.status,
      delay_minutes: Math.round(train.delay_minutes * 10) / 10,
      current_segment: segmentId,
      next_station: nextStation,
      distance_to_next_km: Math.round(distanceToNext * 10) / 10,
      segment_status: segment?.status || "OPEN",
      congestion_level: segment ? trackManager.getTrainCount(segmentId) / segment.capacity : 0,
    };
  }
}

export const movementEngine = new MovementEngine();
