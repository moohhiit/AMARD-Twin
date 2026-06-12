
// src/server/engine/collisionSystem.ts
import { socketService } from "../services/socketService";
import { trackManager } from "./trackManager";
import { getSegmentId } from "../constants/networkConstants"; // ← ADD THIS IMPORT
import type { CollisionWarningEvent } from "../types";
import type { EngineTrain } from "./movementEngine";

const SAFE_DISTANCE_KM    = 2.5;
const WARNING_DISTANCE_KM = 5.0;

export interface CollisionCheckResult {
  train_id:     string;
  must_brake:   boolean;
  target_speed: number;
  warning:      boolean;
}

export class CollisionSystem {
  check(trains: EngineTrain[]): Map<string, CollisionCheckResult> {
    const results = new Map<string, CollisionCheckResult>();

    const bySegment = new Map<string, EngineTrain[]>();
    for (const train of trains) {
      const key = `${train.position.from_node}|${train.position.to_node}`;
      if (!bySegment.has(key)) bySegment.set(key, []);
      bySegment.get(key)!.push(train);
    }

    for (const [, group] of bySegment.entries()) {
      if (group.length < 2) continue;

      const sorted = [...group].sort(
        (a, b) => b.position.progress_percent - a.position.progress_percent
      );

      for (let i = 1; i < sorted.length; i++) {
        const leader   = sorted[i - 1];
        const follower = sorted[i];

        // ── FIX: use getSegmentId() instead of manual "-A" suffix ──
        const segment = trackManager.getSegment(
          getSegmentId(follower.position.from_node, follower.position.to_node)
        );
        if (!segment) continue;

        const progressDiff = (leader.position.progress_percent - follower.position.progress_percent) / 100;
        const gapKm = progressDiff * segment.distance_km;

        if (gapKm < SAFE_DISTANCE_KM) {
          results.set(follower.train_id, {
            train_id:     follower.train_id,
            must_brake:   true,
            target_speed: 0,
            warning:      true,
          });

          const evt: CollisionWarningEvent = {
            segment_id:   getSegmentId(follower.position.from_node, follower.position.to_node),
            train_ids:    [leader.train_id, follower.train_id],
            distance_km:  Math.round(gapKm * 100) / 100,
            severity:     gapKm < 1 ? "CRITICAL" : "WARNING",
            action_taken: `Emergency brake applied to train ${follower.train_id}`,
            timestamp:    new Date().toISOString(),
          };
          socketService.emit("collision:warning", evt);

        } else if (gapKm < WARNING_DISTANCE_KM) {
          const speedFraction = (gapKm - SAFE_DISTANCE_KM) / (WARNING_DISTANCE_KM - SAFE_DISTANCE_KM);
          const cappedSpeed   = Math.max(20, leader.current_speed_kmh * speedFraction);
          results.set(follower.train_id, {
            train_id:     follower.train_id,
            must_brake:   false,
            target_speed: Math.round(cappedSpeed),
            warning:      true,
          });
        }
      }
    }

    return results;
  }
}

export const collisionSystem = new CollisionSystem();