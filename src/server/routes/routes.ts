import { Router } from "express";
import * as routeService from "../services/routeService";

const router = Router();

router.get("/shortest", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required", code: "INVALID_PARAMS" });
    const result = await routeService.findShortestPath(from as string, to as string);
    if (!result) return res.status(404).json({ error: "No route found", code: "NO_ROUTE" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/fastest", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to required", code: "INVALID_PARAMS" });
    const result = await routeService.findFastestPath(from as string, to as string);
    if (!result) return res.status(404).json({ error: "No route found", code: "NO_ROUTE" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
