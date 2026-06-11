import "dotenv/config";
import { getNeo4jDriver } from "../src/server/config/neo4j";
import { Neo4jQueries } from "../src/server/models/neo4j/queries";
import logger from "../src/server/utils/logger";

const stations = [
  { id: "MUM", name: "Mumbai Central", lat: 100, lng: 600, platforms: 4 },
  { id: "DEL", name: "Delhi Junction", lat: 500, lng: 200, platforms: 6 },
  { id: "CHN", name: "Chennai Central", lat: 500, lng: 700, platforms: 5 },
  { id: "BLR", name: "Bangalore City", lat: 300, lng: 650, platforms: 4 },
  { id: "HYD", name: "Hyderabad", lat: 450, lng: 550, platforms: 3 },
];

const junctions = [
  { id: "J1", name: "Pune Junction", lat: 200, lng: 580 },
  { id: "J2", name: "Nagpur Hub", lat: 480, lng: 380 },
];

const tracks = [
  { segment_id: "MUM-J1-A", from: "MUM", to: "J1", distance_km: 150, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "J1-BLR-A", from: "J1", to: "BLR", distance_km: 80, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-CHN-A", from: "BLR", to: "CHN", distance_km: 350, max_speed_kmh: 130, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "CHN-HYD-A", from: "CHN", to: "HYD", distance_km: 330, max_speed_kmh: 110, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "HYD-J2-A", from: "HYD", to: "J2", distance_km: 260, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "J2-DEL-A", from: "J2", to: "DEL", distance_km: 240, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "DEL-HYD-B", from: "DEL", to: "HYD", distance_km: 280, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-HYD-B", from: "BLR", to: "HYD", distance_km: 200, max_speed_kmh: 90, capacity: 2, direction: "BIDIRECTIONAL" },
];

async function seedNeo4j() {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    logger.info("Clearing existing Neo4j data...");
    await session.run(Neo4jQueries.clearAll);

    logger.info("Creating stations...");
    for (const s of stations) {
      await session.run(Neo4jQueries.createStation, s);
    }

    logger.info("Creating junctions...");
    for (const j of junctions) {
      await session.run(Neo4jQueries.createJunction, j);
    }

    logger.info("Creating track segments...");
    for (const t of tracks) {
      await session.run(Neo4jQueries.createTrack, t);
    }

    logger.info("Neo4j seed complete!");
  } catch (err) {
    logger.error({ err }, "Neo4j seed failed");
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }
}

seedNeo4j().then(() => process.exit(0)).catch(() => process.exit(1));
