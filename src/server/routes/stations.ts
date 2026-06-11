import { Router } from "express";
import * as stationService from "../services/stationService";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const stations = await stationService.getAllStations();
    res.json({ stations });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const station = await stationService.getStation(req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found", code: "STATION_NOT_FOUND" });
    res.json(station);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/platforms", async (req, res, next) => {
  try {
    const platforms = await stationService.getStationPlatforms(req.params.id);
    res.json(platforms);
  } catch (err) {
    next(err);
  }
});

export default router;
