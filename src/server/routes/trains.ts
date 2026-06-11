import { Router } from "express";
import * as trainService from "../services/trainService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const trains = await trainService.getAllTrains();
    const running = trains.filter((t: any) => t.status === "RUNNING" || t.status === "REROUTING").length;
    const delayed = trains.filter((t: any) => (t.delay_minutes || 0) > 2).length;
    res.json({
      trains,
      meta: { total: trains.length, running, delayed, rerouting: trains.filter((t: any) => t.status === "REROUTING").length },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const train = await trainService.getTrainById(req.params.id);
    if (!train) return res.status(404).json({ error: "Train not found", code: "TRAIN_NOT_FOUND" });
    res.json(train);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/live", async (req, res, next) => {
  try {
    const live = await trainService.getTrainLive(req.params.id);
    if (!live) return res.status(404).json({ error: "Train not found", code: "TRAIN_NOT_FOUND" });
    res.json(live);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/events", async (req, res, next) => {
  try {
    const events = await trainService.getTrainEvents(req.params.id);
    res.json({ train_id: req.params.id, events });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/route", async (req, res, next) => {
  try {
    const route = await trainService.getTrainRoute(req.params.id);
    if (!route) return res.status(404).json({ error: "Train not found", code: "TRAIN_NOT_FOUND" });
    res.json(route);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/speed", async (req, res, next) => {
  try {
    const result = await trainService.updateTrainSpeed(req.params.id, req.body.speed_kmh);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const result = await trainService.updateTrainStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
