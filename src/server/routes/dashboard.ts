// src/server/routes/dashboard.ts
// GET /api/v1/dashboard  — single payload for the left admin panel
import { Router } from "express";
import { TrainModel }       from "../models/mongo/Train";
import { PlatformLogModel } from "../models/mongo/PlatformLog";
import { simulator }        from "../engine/simulator";
import { trackManager }     from "../engine/trackManager";
import { weatherEngine }    from "../engine/weatherEngine";
import { signalSystem }     from "../engine/signalSystem";
import { loopManager }      from "../engine/loopManager";
import { getSchedule, getNextStop, currentSimMinute, toHHMM } from "../engine/scheduleManager";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const simStatus  = simulator.getStatus();
    const simTrains  = simulator.getTrains();
    const mongoTrains = await TrainModel.find().lean();

    // ── TRAIN DATA ─────────────────────────────────────────────────────────
    const trainData = mongoTrains.map(t => {
      const sim  = simTrains.get(t.train_id);
      const next = getNextStop(t.train_id);
      const sched = getSchedule(t.train_id);
      return {
        train_id:          t.train_id,
        name:              t.name,
        type:              t.type,
        priority:          t.type,
        color:             t.color,
        status:            sim?.status            ?? t.status,
        current_speed_kmh: sim?.current_speed_kmh ?? 0,
        target_speed_kmh:  sim?.target_speed_kmh  ?? 0,
        max_speed_kmh:     t.max_speed_kmh,
        delay_minutes:     Math.round((sim?.delay_minutes ?? 0) * 10) / 10,
        position:          sim?.position          ?? t.position,
        current_station:   sim?.current_station   ?? t.current_station,
        assigned_platform: sim?.assigned_platform ?? null,
        on_loop_line:      sim?.on_loop_line       ?? false,
        route:             sim?.route              ?? t.route,
        braking_distance_km: sim?.braking_distance_km ?? 0,
        next_scheduled_stop: next ? {
          station_id:          next.station_id,
          scheduled_arrival:   next.scheduled_arrival,
          scheduled_departure: next.scheduled_departure,
          delay_minutes:       next.delay_minutes ?? 0,
        } : null,
        schedule: sched,
      };
    });

    // ── PLATFORM DATA ──────────────────────────────────────────────────────
    const stations = ["DEL","MUM","CHN","KOL","HYD","BLR","AGR","PAT","GOA","SUR"];
    const platformData: Record<string, any[]> = {};
    for (const sid of stations) {
      const logs = await PlatformLogModel.find({ station_id: sid }).lean();
      platformData[sid] = logs.map(l => ({
        platform_number: l.platform_number,
        status:          l.status,
        train_id:        l.train_id,
        length_meters:   l.length_meters,
        free_at_time:    l.freed_at ? new Date(l.freed_at as any).toISOString() : null,
      }));
    }

    // ── TRACK DATA ─────────────────────────────────────────────────────────
    const segments = trackManager.getAllSegments();
    const trackData = segments.map(seg => {
      const weather = weatherEngine.getWeather(seg.segment_id);
      const signal  = signalSystem.getSignal(seg.segment_id);
      return {
        segment_id:      seg.segment_id,
        from:            seg.from,
        to:              seg.to,
        distance_km:     seg.distance_km,
        max_speed_kmh:   seg.max_speed_kmh,
        capacity:        seg.capacity,
        status:          seg.status,
        current_trains:  seg.current_trains,
        congestion_level: Math.round(seg.congestion_level * 100),
        weather:          weather.type,
        weather_speed_mult: weather.speed_multiplier,
        risk_level:       weather.risk_level,
        signal,
        is_loop_line:     seg.is_loop_line ?? false,
      };
    });

    // ── NETWORK SUMMARY ───────────────────────────────────────────────────
    const active     = trainData.filter(t => t.status !== "ARRIVED").length;
    const delayed    = trainData.filter(t => t.delay_minutes > 2).length;
    const congested  = segments.filter(s => s.status === "CONGESTED").length;
    const blocked    = segments.filter(s => s.status === "BLOCKED").length;
    const avgDelay   = trainData.length
      ? Math.round(trainData.reduce((s, t) => s + t.delay_minutes, 0) / trainData.length * 10) / 10
      : 0;

    res.json({
      sim_time:         simulator.getCurrentSimTime(),
      sim_speed:        simStatus.speed,
      sim_running:      simStatus.running,
      tick_count:       simStatus.tick_count,
      trains:           trainData,
      platforms:        platformData,
      tracks:           trackData,
      loop_occupancy:   loopManager.getLoopOccupancy(),
      summary: {
        total_trains:      mongoTrains.length,
        active_trains:     active,
        delayed_trains:    delayed,
        congested_segments: congested,
        blocked_segments:  blocked,
        avg_delay_minutes: avgDelay,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dashboard/weather — set weather on a segment
router.post("/weather", async (req, res, next) => {
  try {
    const { segment_id, weather } = req.body;
    if (!segment_id || !weather) {
      return res.status(400).json({ error: "segment_id and weather required" });
    }
    weatherEngine.setWeather(segment_id, weather);
    res.json({ ok: true, segment_id, weather });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dashboard/signal — force a signal state
router.post("/signal", async (req, res, next) => {
  try {
    const { segment_id, state, reason } = req.body;
    if (!segment_id || !state) {
      return res.status(400).json({ error: "segment_id and state required" });
    }
    signalSystem.forceSignal(segment_id, state, reason || "Admin override");
    res.json({ ok: true, segment_id, state });
  } catch (err) {
    next(err);
  }
});

export default router;