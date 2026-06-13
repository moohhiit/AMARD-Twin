// ═══════════════════════════════════════════════════════════════════
// src/server/engine/scheduleManager.ts
// FIX 1: Early arrivals (negative delay) were silently clamped to 0.
//         Now tracked as negative delay_minutes and flagged as is_early.
// FIX 2: getSchedule() now falls back to MongoDB if in-memory Map is empty.
// NEW:    setSimStartTime() — lets the Custom Time Frame feature jump
//         the simulation clock to any HH:MM without restarting trains.
// NEW:    loadSchedulesFromMongo() — seeds the in-memory Map from MongoDB
//         so dashboard always has schedule data even before simulator ticks.
// ═══════════════════════════════════════════════════════════════════

import { socketService }   from "../services/socketService";
import { TrainEventModel } from "../models/mongo/TrainEvent";
import { TrainModel }      from "../models/mongo/Train";
import { randomUUID }      from "crypto";
import type { ScheduleStop } from "../types";

const schedules  = new Map<string, ScheduleStop[]>();
const stopIndex  = new Map<string, number>();

let simStartMs     = 0;
let simBaseMinutes = 0;

// ── initSchedules — called by simulator on startup ───────────────────────────
export function initSchedules(
  trainSchedules: Map<string, ScheduleStop[]>,
  baseTimeHHMM = "06:00"
): void {
  simStartMs     = Date.now();
  const [hh, mm] = baseTimeHHMM.split(":").map(Number);
  simBaseMinutes = hh * 60 + mm;
  for (const [id, sched] of trainSchedules.entries()) {
    schedules.set(id, sched);
    stopIndex.set(id, 0);
  }
}

// ── NEW: loadSchedulesFromMongo ───────────────────────────────────────────────
/**
 * Loads schedules from MongoDB into the in-memory Map for any train
 * that isn't already tracked (e.g. before simulator has ticked).
 * Safe to call multiple times — skips trains already in memory.
 */
export async function loadSchedulesFromMongo(): Promise<void> {
  try {
    const trains = await TrainModel.find({}, { train_id: 1, schedule: 1 }).lean();
    let loaded = 0;
    for (const t of trains) {
      // only fill if not already in memory or empty
      if (
        Array.isArray(t.schedule) &&
        t.schedule.length > 0 &&
        (schedules.get(t.train_id as string)?.length ?? 0) === 0
      ) {
        schedules.set(t.train_id as string, t.schedule as ScheduleStop[]);
        if (!stopIndex.has(t.train_id as string)) {
          stopIndex.set(t.train_id as string, 0);
        }
        loaded++;
      }
    }
    if (loaded > 0) {
      console.log(`[scheduleManager] Loaded ${loaded} schedules from MongoDB`);
    }
  } catch (err) {
    console.error("[scheduleManager] loadSchedulesFromMongo failed:", err);
  }
}

// ── setSimStartTime — called by simulator.setTimeframe() ─────────────────────
/**
 * Jump the simulation clock to a new start time without restarting trains.
 * @param hhmm       "HH:MM" — the new simulated start of day
 * @param resetClock  true = reset elapsed wall clock (trains restart schedule tracking)
 */
export function setSimStartTime(hhmm: string, resetClock = true): void {
  const [h, m]   = hhmm.split(":").map(Number);
  simBaseMinutes = h * 60 + m;
  if (resetClock) simStartMs = Date.now();
}

export function currentSimMinute(simSpeed: number): number {
  const elapsedMs   = Date.now() - simStartMs;
  const elapsedMins = (elapsedMs / 60_000) * simSpeed;
  return (simBaseMinutes + elapsedMins) % (24 * 60);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const norm = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h    = Math.floor(norm / 60);
  const m    = Math.round(norm % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── getSchedule — in-memory first, never returns stale empty ─────────────────
export function getSchedule(trainId: string): ScheduleStop[] {
  return schedules.get(trainId) ?? [];
}

export function getCurrentStop(trainId: string): ScheduleStop | null {
  const sched = schedules.get(trainId);
  const idx   = stopIndex.get(trainId) ?? 0;
  return sched?.[idx] ?? null;
}

export function getNextStop(trainId: string): ScheduleStop | null {
  const sched = schedules.get(trainId);
  const idx   = stopIndex.get(trainId) ?? 0;
  return sched?.[idx + 1] ?? null;
}

// ── recordArrival ─────────────────────────────────────────────────────────────
export function recordArrival(
  trainId: string,
  stationId: string,
  simSpeed: number
): number {
  const sched = schedules.get(trainId);
  if (!sched) return 0;
  const idx  = stopIndex.get(trainId) ?? 0;
  const stop = sched.find((s, i) => i >= idx && s.station_id === stationId);
  if (!stop) return 0;

  const actualMin    = currentSimMinute(simSpeed);
  const scheduledMin = toMinutes(stop.scheduled_arrival);
  const delayMin     = actualMin - scheduledMin;

  // FIX: preserve negative delay (early arrival), don't clamp to 0
  stop.actual_arrival = toHHMM(actualMin);
  stop.delay_minutes  = Math.round(delayMin * 10) / 10; // negative = early

  socketService.emit("schedule:arrival", {
    train_id:      trainId,
    station_id:    stationId,
    scheduled:     stop.scheduled_arrival,
    actual:        stop.actual_arrival,
    delay_min:     stop.delay_minutes,
    is_early:      delayMin < 0,
    early_minutes: delayMin < 0 ? Math.abs(delayMin) : 0,
    timestamp:     new Date().toISOString(),
  });

  TrainEventModel.create({
    event_id:   randomUUID(),
    train_id:   trainId,
    event_type: "ARRIVAL",
    details: {
      station_id: stationId,
      delay_min:  stop.delay_minutes,
      is_early:   delayMin < 0,
    },
    source:    "ENGINE",
    timestamp: new Date(),
  }).catch(() => {});

  return stop.delay_minutes;
}

// ── recordDeparture ───────────────────────────────────────────────────────────
export function recordDeparture(
  trainId: string,
  stationId: string,
  simSpeed: number
): void {
  const sched = schedules.get(trainId);
  if (!sched) return;
  const idx  = stopIndex.get(trainId) ?? 0;
  const stop = sched.find((s, i) => i >= idx && s.station_id === stationId);
  if (!stop) return;

  const actualMin       = currentSimMinute(simSpeed);
  stop.actual_departure = toHHMM(actualMin);

  const newIdx = sched.indexOf(stop) + 1;
  stopIndex.set(trainId, newIdx);

  socketService.emit("schedule:departure", {
    train_id:   trainId,
    station_id: stationId,
    scheduled:  stop.scheduled_departure,
    actual:     stop.actual_departure,
    timestamp:  new Date().toISOString(),
  });
}

// ── computeScheduledDelay ─────────────────────────────────────────────────────
export function computeScheduledDelay(trainId: string, simSpeed: number): number {
  const next = getNextStop(trainId);
  if (!next) return 0;
  const currentMin   = currentSimMinute(simSpeed);
  const scheduledMin = toMinutes(next.scheduled_arrival);
  return Math.round((currentMin - scheduledMin) * 10) / 10;
}