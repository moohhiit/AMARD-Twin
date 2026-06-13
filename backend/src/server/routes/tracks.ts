import { Router } from "express";
import * as trackService from "../services/trackService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const tracks = await trackService.getAllTracks();
    res.json({ tracks });
  } catch (err) {
    next(err);
  }
});

router.get("/congested", async (_req, res, next) => {
  try {
    const tracks = await trackService.getCongestedTracks();
    res.json({ tracks });
  } catch (err) {
    next(err);
  }
});

router.get("/:segmentId", async (req, res, next) => {
  try {
    const track = await trackService.getTrack(req.params.segmentId);
    if (!track) return res.status(404).json({ error: "Track not found", code: "TRACK_NOT_FOUND" });
    res.json(track);
  } catch (err) {
    next(err);
  }
});

router.patch("/:segmentId/status", async (req, res, next) => {
  try {
    const result = await trackService.updateTrackStatus(req.params.segmentId, req.body.status);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
