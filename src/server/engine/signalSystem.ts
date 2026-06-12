// src/server/engine/signalSystem.ts
import { socketService } from "../services/socketService";
import { trackManager } from "./trackManager";
import type { SignalState, SignalChangeEvent } from "../types";

// ─── SIGNAL REGISTRY ─────────────────────────────────────────────────────────
// Each segment has one signal at its entry point.
// GREEN  → proceed at full speed
// YELLOW → slow to 60% speed, prepare to stop
// RED    → stop; segment occupied or blocked ahead

const signals: Map<string, { state: SignalState; reason: string; set_at: number }> = new Map();

export class SignalSystem {
  init(segmentIds: string[]): void {
    for (const id of segmentIds) {
      signals.set(id, { state: "GREEN", reason: "Initial state", set_at: Date.now() });
    }
  }

  getSignal(segmentId: string): SignalState {
    return signals.get(segmentId)?.state ?? "GREEN";
  }

  getAllSignals(): Map<string, { state: SignalState; reason: string; set_at: number }> {
    return signals;
  }

  /**
   * Called every tick by the simulator.
   * Updates signals based on segment occupancy, capacity, and blocked status.
   */
  update(): void {
    for (const [segmentId, sigData] of signals.entries()) {
      const segment = trackManager.getSegment(segmentId);
      if (!segment) continue;

      const trainCount  = trackManager.getTrainCount(segmentId);
      const ratio       = trainCount / segment.capacity;
      let newState: SignalState;
      let reason: string;

      if (segment.status === "BLOCKED") {
        newState = "RED";
        reason = "Track blocked";
      } else if (ratio >= 1.0) {
        newState = "RED";
        reason = `At capacity (${trainCount}/${segment.capacity} trains)`;
      } else if (ratio >= 0.7 || segment.status === "CONGESTED") {
        newState = "YELLOW";
        reason = `Congestion warning (${Math.round(ratio * 100)}% capacity)`;
      } else {
        newState = "GREEN";
        reason = "Track clear";
      }

      if (newState !== sigData.state) {
        const old = sigData.state;
        signals.set(segmentId, { state: newState, reason, set_at: Date.now() });
        this.emitSignalChange(segmentId, old, newState, reason);
      }
    }
  }

  /** Manually force a signal (admin override) */
  forceSignal(segmentId: string, state: SignalState, reason: string): void {
    const old = signals.get(segmentId)?.state ?? "GREEN";
    signals.set(segmentId, { state, reason, set_at: Date.now() });
    this.emitSignalChange(segmentId, old, state, `[MANUAL] ${reason}`);
  }

  private emitSignalChange(
    segmentId: string, old: SignalState, next: SignalState, reason: string
  ): void {
    const evt: SignalChangeEvent = {
      segment_id: segmentId,
      old_state:  old,
      new_state:  next,
      reason,
      timestamp:  new Date().toISOString(),
    };
    socketService.emit("signal:change", evt);
  }
}

export const signalSystem = new SignalSystem();