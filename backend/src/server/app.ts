import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import compression from "compression";
import "dotenv/config";

import { initNeo4j, closeNeo4j } from "./config/neo4j";
import { initMongoDB, closeMongoDB } from "./config/mongodb";
import { socketService } from "./services/socketService";
import { simulator } from "./engine/simulator";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import logger from "./utils/logger";

import trainRoutes from "./routes/trains";
import trackRoutes from "./routes/tracks";
import stationRoutes from "./routes/stations";
import routeRoutes from "./routes/routes";
import simulationRoutes from "./routes/simulation";
import dashboardRoutes from "./routes/dashboard";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(cors());
app.use(compression());
app.use(express.json());

// API routes
app.use("/api/v1/trains", trainRoutes);
app.use("/api/v1/tracks", trackRoutes);
app.use("/api/v1/stations", stationRoutes);
app.use("/api/v1/routes", routeRoutes);
app.use("/api/v1/simulation", simulationRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

// Health check — frontend polls this to know server is awake
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    engine_running: simulator.getStatus().running,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
socketService.init(io);

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down");
  simulator.stop();
  await closeNeo4j();
  await closeMongoDB();
  httpServer.close(() => { logger.info("Server closed"); process.exit(0); });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down");
  simulator.stop();
  await closeNeo4j();
  await closeMongoDB();
  httpServer.close(() => { logger.info("Server closed"); process.exit(0); });
});

// ─────────────────────────────────────────────────────────────────────────────
// startServer: connects DBs and listens — does NOT start the simulation engine.
// Engine starts only when frontend calls POST /api/v1/simulation/start.
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await initMongoDB();
    await initNeo4j();

    // ⚠️  simulator.start() is intentionally NOT called here.
    //     Frontend triggers it via POST /api/v1/simulation/start
    //     after the wakeup popup confirms server is ready.

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
      logger.info(`AMARD Backend running on port ${PORT} — engine idle, awaiting frontend`);
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

startServer();

export { app, httpServer, io };
