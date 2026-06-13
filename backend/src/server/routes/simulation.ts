// ═══════════════════════════════════════════════════════════════════
// CHANGE 6 — src/server/routes/simulation.ts
// NEW: PATCH /timeframe — set simulation start time (HH:MM)
// FIX: PATCH /speed — now accepts 0.1 to 50 (was hardcoded 0.5–5)
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import { simulator }     from "../engine/simulator";
import { socketService } from "../services/socketService";

const router = Router();

router.post("/start", async (_req, res) => {
  await simulator.start();
  res.json({ status: "started" });
});

router.post("/pause", (_req, res) => {
  simulator.pause();
  socketService.emit("system:status", {
    engine_running: false, simulation_speed: 0, active_trains: 0, congested_tracks: 0,
  });
  res.json({ status: "paused" });
});

router.post("/resume", (_req, res) => {
  simulator.resume();
  res.json({ status: "resumed" });
});

router.post("/reset", async (_req, res) => {
  simulator.stop();
  res.json({ status: "reset" });
});

// ── FIX: accept 0.1–50 ───────────────────────────────────────────────────────
router.patch("/speed", (req, res) => {
  const speed = parseFloat(req.body.speed);
  if (isNaN(speed) || speed < 0.1 || speed > 50) {
    return res.status(400).json({ error: "speed must be between 0.1 and 50" });
  }
  simulator.setSpeed(speed);
  res.json({ status: "ok", simulation_speed: speed });
});

// ── NEW: custom time frame ─────────────────────────────────────────────────
/**
 * PATCH /api/v1/simulation/timeframe
 * Body: { "start_time": "HH:MM" }
 * Jumps the simulated clock to start_time without stopping trains.
 * Useful for testing morning rush hour, night operations, etc.
 */
router.patch("/timeframe", (req, res) => {
  const { start_time } = req.body;
  if (!start_time || !/^\d{2}:\d{2}$/.test(start_time)) {
    return res.status(400).json({ error: "start_time must be HH:MM (e.g. '06:00' or '22:30')" });
  }
  simulator.setTimeframe(start_time);
  res.json({ status: "ok", start_time, message: `Simulation clock set to ${start_time}` });
});

router.get("/status", (_req, res) => {
  res.json({
    ...simulator.getStatus(),
    sim_time: simulator.getCurrentSimTime(),
  });
});

export default router;