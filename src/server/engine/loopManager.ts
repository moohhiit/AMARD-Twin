// src/server/engine/loopManager.ts
//
// Loop lines are short bypass tracks at busy junctions/stations.
// When a high-priority train approaches and a lower-priority train is
// blocking the main line, the lower-priority train is diverted to the loop.

import { socketService } from "../services/socketService";
import type { TrainPriority } from "../types";
import type { EngineTrain } from "./movementEngine";

// ─── PRIORITY HIERARCHY ──────────────────────────────────────────────────────
const PRIORITY_RANK: Record<TrainPriority, number> = {
  SUPERFAST: 5,
  EXPRESS:   4,
  PASSENGER: 3,
  LOCAL:     2,
  FREIGHT:   1,
};

export function getPriorityRank(priority: TrainPriority): number {
  return PRIORITY_RANK[priority] ?? 3;
}

// ─── LOOP DEFINITIONS ────────────────────────────────────────────────────────
// Each entry maps a node → its loop segment ID.
// The loop segment is a short siding where a train waits.
export const LOOP_LINES: Record<string, { segment_id: string; capacity: number }> = {
  J_NW: { segment_id: "LOOP-J_NW", capacity: 2 },
  J_NC: { segment_id: "LOOP-J_NC", capacity: 2 },
  J_NE: { segment_id: "LOOP-J_NE", capacity: 1 },
  J_CN: { segment_id: "LOOP-J_CN", capacity: 2 },
  J_MC: { segment_id: "LOOP-J_MC", capacity: 2 },
  J_SC: { segment_id: "LOOP-J_SC", capacity: 1 },
  HYD:  { segment_id: "LOOP-HYD",  capacity: 1 },
  BLR:  { segment_id: "LOOP-BLR",  capacity: 1 },
  AGR:  { segment_id: "LOOP-AGR",  capacity: 1 },
};

// Track which trains are currently on which loop
const loopOccupancy = new Map<string, Set<string>>(); // segment_id → Set<train_id>

export class LoopManager {
  init(): void {
    for (const { segment_id } of Object.values(LOOP_LINES)) {
      loopOccupancy.set(segment_id, new Set());
    }
  }

  /** Returns true if the train should be diverted to a loop */
  shouldDivert(
    train: EngineTrain & { priority: TrainPriority },
    incomingTrain: EngineTrain & { priority: TrainPriority },
    nodeId: string
  ): boolean {
    const loop = LOOP_LINES[nodeId];
    if (!loop) return false;
    const occupied = loopOccupancy.get(loop.segment_id);
    if (!occupied || occupied.size >= loop.capacity) return false;

    const trainRank    = getPriorityRank(train.priority);
    const incomingRank = getPriorityRank(incomingTrain.priority);
    return incomingRank > trainRank; // incoming has higher priority → divert current
  }

  divert(train: EngineTrain & { priority: TrainPriority; on_loop_line: boolean }, nodeId: string): string | null {
    const loop = LOOP_LINES[nodeId];
    if (!loop) return null;
    const occupied = loopOccupancy.get(loop.segment_id) ?? new Set();
    if (occupied.size >= loop.capacity) return null;

    occupied.add(train.train_id);
    loopOccupancy.set(loop.segment_id, occupied);
    train.on_loop_line = true;

    socketService.emit("loop:entry", {
      train_id:   train.train_id,
      node_id:    nodeId,
      loop_segment: loop.segment_id,
      reason:     `Lower-priority train diverted at ${nodeId}`,
      timestamp:  new Date().toISOString(),
    });

    return loop.segment_id;
  }

  release(trainId: string, nodeId: string, train: EngineTrain & { on_loop_line: boolean }): void {
    const loop = LOOP_LINES[nodeId];
    if (!loop) return;
    const occupied = loopOccupancy.get(loop.segment_id);
    occupied?.delete(trainId);
    train.on_loop_line = false;

    socketService.emit("loop:exit", {
      train_id:   trainId,
      node_id:    nodeId,
      loop_segment: loop.segment_id,
      timestamp:  new Date().toISOString(),
    });
  }

  isOnLoop(trainId: string): boolean {
    for (const set of loopOccupancy.values()) {
      if (set.has(trainId)) return true;
    }
    return false;
  }

  getLoopOccupancy(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [seg, trains] of loopOccupancy.entries()) {
      result[seg] = [...trains];
    }
    return result;
  }
}

export const loopManager = new LoopManager();