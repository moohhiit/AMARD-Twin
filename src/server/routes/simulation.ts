import { Router } from "express";
import { simulator } from "../engine/simulator";
import { socketService } from "../services/socketService";

const router = Router();

router.post("/start", async (_req, res) => {
  await simulator.start();
  res.json({ status: "started" });
});

router.post("/pause", (_req, res) => {
  simulator.pause();
  socketService.emit("system:status", { engine_running: false, simulation_speed: 0, active_trains: 0, congested_tracks: 0 });
  res.json({ status: "paused" });
});

router.post("/resume", (_req, res) => {
  simulator.resume();
  res.json({ status: "resumed" });
});

router.post("/reset", async (_req, res) => {
  simulator.stop();
  // Reset will happen on next start
  res.json({ status: "reset" });
});

router.patch("/speed", (req, res) => {
  const speed = parseFloat(req.body.speed);
  simulator.setSpeed(speed);
  res.json({ status: "ok", simulation_speed: speed });
});

router.get("/status", (_req, res) => {
  res.json(simulator.getStatus());
});

export default router;
