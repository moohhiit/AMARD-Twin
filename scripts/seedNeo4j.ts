import "dotenv/config";
import { getNeo4jDriver } from "../src/server/config/neo4j";
import { Neo4jQueries } from "../src/server/models/neo4j/queries";
import logger from "../src/server/utils/logger";

// ─── NETWORK LAYOUT (SVG viewBox 0 0 900 800) ───────────────────────────────
// Stations (10) — major terminals with platforms
// Junctions (10) — routing nodes, no platforms
//
// Real Indian-inspired network: Western, Central, Southern, Eastern corridors
// + cross-links and a Mumbai loop.
//
//  DEL(130,120)──J_NW(200,170)──J_NC(310,140)──J_NE(430,110)──KOL(530,120)
//     │                │               │                │
//  J_CW(120,280)   AGR(250,250)   J_CN(330,280)   PAT(480,240)
//     │                │               │                │
//  MUM(80,430)──J_MW(170,390)──J_MC(290,400)──HYD(420,400)──J_CE(520,360)
//     │                │               │                │         │
//  J_SW(110,540)  J_SM(200,530)   J_SC(300,510)   CHN(430,530) ─┘
//     │                │               │
//  GOA(90,640)──J_SS(190,630)──BLR(310,640)
//
// All major corridors have DUAL tracks (Track-A and Track-B)
// Loop: MUM→J_MW→J_MC→J_SC→J_SM→J_SW→MUM (Mumbai Metropolitan Loop)
// ─────────────────────────────────────────────────────────────────────────────

const stations = [
  { id: "DEL", name: "New Delhi",       lat: 120, lng: 130, platforms: 6 },
  { id: "MUM", name: "Mumbai CST",      lat: 430, lng: 80,  platforms: 5 },
  { id: "CHN", name: "Chennai Central", lat: 530, lng: 430, platforms: 5 },
  { id: "KOL", name: "Kolkata Howrah",  lat: 120, lng: 530, platforms: 4 },
  { id: "HYD", name: "Hyderabad Deccan",lat: 400, lng: 420, platforms: 4 },
  { id: "BLR", name: "Bengaluru City",  lat: 640, lng: 310, platforms: 4 },
  { id: "AGR", name: "Agra Cantonment", lat: 250, lng: 250, platforms: 3 },
  { id: "PAT", name: "Patna Junction",  lat: 240, lng: 480, platforms: 3 },
  { id: "GOA", name: "Vasco da Gama",   lat: 640, lng: 90,  platforms: 2 },
  { id: "SUR", name: "Surat Junction",  lat: 360, lng: 100, platforms: 3 },
];

const junctions = [
  { id: "J_NW", name: "Ambala Jn",    lat: 170, lng: 200 },
  { id: "J_NC", name: "Kanpur Jn",    lat: 140, lng: 310 },
  { id: "J_NE", name: "Gaya Jn",      lat: 110, lng: 430 },
  { id: "J_CW", name: "Vadodara Jn",  lat: 280, lng: 120 },
  { id: "J_CN", name: "Nagpur Jn",    lat: 280, lng: 330 },
  { id: "J_CE", name: "Vijaywada Jn", lat: 360, lng: 520 },
  { id: "J_MW", name: "Pune Jn",      lat: 390, lng: 170 },
  { id: "J_MC", name: "Solapur Jn",   lat: 400, lng: 290 },
  { id: "J_SW", name: "Ratnagiri Jn", lat: 540, lng: 110 },
  { id: "J_SC", name: "Bidar Jn",     lat: 510, lng: 300 },
];

// ─── TRACKS ──────────────────────────────────────────────────────────────────
// Every important corridor gets Track-A (main) and Track-B (parallel/return)
// so all stations are connected with 2 tracks as required.
// ─────────────────────────────────────────────────────────────────────────────
const tracks = [
  // ── NORTH CORRIDOR: DEL ↔ KOL (via Agra, Kanpur, Gaya, Patna) ──
  { segment_id: "DEL-JNW-A", from: "DEL",  to: "J_NW", distance_km: 260, max_speed_kmh: 160, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "DEL-JNW-B", from: "J_NW", to: "DEL",  distance_km: 260, max_speed_kmh: 160, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "JNW-AGR-A", from: "J_NW", to: "AGR",  distance_km: 120, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JNW-AGR-B", from: "AGR",  to: "J_NW", distance_km: 120, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "AGR-JNC-A", from: "AGR",  to: "J_NC", distance_km: 200, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "AGR-JNC-B", from: "J_NC", to: "AGR",  distance_km: 200, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JNC-JNE-A", from: "J_NC", to: "J_NE", distance_km: 300, max_speed_kmh: 150, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "JNC-JNE-B", from: "J_NE", to: "J_NC", distance_km: 300, max_speed_kmh: 150, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "JNE-PAT-A", from: "J_NE", to: "PAT",  distance_km: 140, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JNE-PAT-B", from: "PAT",  to: "J_NE", distance_km: 140, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "PAT-KOL-A", from: "PAT",  to: "KOL",  distance_km: 390, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "PAT-KOL-B", from: "KOL",  to: "PAT",  distance_km: 390, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },

  // ── WEST CORRIDOR: DEL ↔ MUM (via Vadodara, Surat) ──
  { segment_id: "DEL-JCW-A", from: "DEL",  to: "J_CW", distance_km: 450, max_speed_kmh: 150, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "DEL-JCW-B", from: "J_CW", to: "DEL",  distance_km: 450, max_speed_kmh: 150, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "JCW-SUR-A", from: "J_CW", to: "SUR",  distance_km: 180, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCW-SUR-B", from: "SUR",  to: "J_CW", distance_km: 180, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "SUR-MUM-A", from: "SUR",  to: "MUM",  distance_km: 270, max_speed_kmh: 160, capacity: 4, direction: "BIDIRECTIONAL" },
  { segment_id: "SUR-MUM-B", from: "MUM",  to: "SUR",  distance_km: 270, max_speed_kmh: 160, capacity: 4, direction: "BIDIRECTIONAL" },

  // ── CENTRAL CORRIDOR: DEL ↔ HYD (via Nagpur) ──
  { segment_id: "DEL-JCN-A", from: "DEL",  to: "J_CN", distance_km: 620, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "DEL-JCN-B", from: "J_CN", to: "DEL",  distance_km: 620, max_speed_kmh: 140, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCN-HYD-A", from: "J_CN", to: "HYD",  distance_km: 360, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCN-HYD-B", from: "HYD",  to: "J_CN", distance_km: 360, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },

  // ── SOUTH CORRIDOR: HYD ↔ BLR ↔ CHN ──
  { segment_id: "HYD-JSC-A", from: "HYD",  to: "J_SC", distance_km: 220, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "HYD-JSC-B", from: "J_SC", to: "HYD",  distance_km: 220, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JSC-BLR-A", from: "J_SC", to: "BLR",  distance_km: 230, max_speed_kmh: 110, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "JSC-BLR-B", from: "BLR",  to: "J_SC", distance_km: 230, max_speed_kmh: 110, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "HYD-CHN-A", from: "HYD",  to: "J_CE", distance_km: 270, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "HYD-CHN-B", from: "J_CE", to: "HYD",  distance_km: 270, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCE-CHN-A", from: "J_CE", to: "CHN",  distance_km: 190, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCE-CHN-B", from: "CHN",  to: "J_CE", distance_km: 190, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-CHN-A", from: "BLR",  to: "CHN",  distance_km: 350, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "BLR-CHN-B", from: "CHN",  to: "BLR",  distance_km: 350, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },

  // ── COASTAL / GOA BRANCH ──
  { segment_id: "MUM-JSW-A", from: "MUM",  to: "J_SW", distance_km: 340, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "MUM-JSW-B", from: "J_SW", to: "MUM",  distance_km: 340, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "JSW-GOA-A", from: "J_SW", to: "GOA",  distance_km: 240, max_speed_kmh: 90,  capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "JSW-GOA-B", from: "GOA",  to: "J_SW", distance_km: 240, max_speed_kmh: 90,  capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "GOA-BLR-A", from: "GOA",  to: "BLR",  distance_km: 470, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "GOA-BLR-B", from: "BLR",  to: "GOA",  distance_km: 470, max_speed_kmh: 100, capacity: 2, direction: "BIDIRECTIONAL" },

  // ── MUM METRO LOOP: MUM ↔ J_MW ↔ J_MC ↔ J_SC ↔ J_SM(J_SW) ↔ MUM ──
  { segment_id: "MUM-JMW-A", from: "MUM",  to: "J_MW", distance_km: 160, max_speed_kmh: 110, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "MUM-JMW-B", from: "J_MW", to: "MUM",  distance_km: 160, max_speed_kmh: 110, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JMW-JMC-A", from: "J_MW", to: "J_MC", distance_km: 200, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JMW-JMC-B", from: "J_MC", to: "J_MW", distance_km: 200, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JMC-HYD-A", from: "J_MC", to: "HYD",  distance_km: 250, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JMC-HYD-B", from: "HYD",  to: "J_MC", distance_km: 250, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JMC-JSC-A", from: "J_MC", to: "J_SC", distance_km: 210, max_speed_kmh: 110, capacity: 2, direction: "BIDIRECTIONAL" },
  { segment_id: "JMC-JSC-B", from: "J_SC", to: "J_MC", distance_km: 210, max_speed_kmh: 110, capacity: 2, direction: "BIDIRECTIONAL" },

  // ── EAST CROSS-LINK: KOL ↔ CHN (via Vijaywada) ──
  { segment_id: "KOL-JCE-A", from: "KOL",  to: "J_CE", distance_km: 520, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "KOL-JCE-B", from: "J_CE", to: "KOL",  distance_km: 520, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },

  // ── NORTH-SOUTH EXPRESS: JNC ↔ JMC (Nagpur ↔ Solapur shortcut) ──
  { segment_id: "JCN-JMC-A", from: "J_CN", to: "J_MC", distance_km: 300, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "JCN-JMC-B", from: "J_MC", to: "J_CN", distance_km: 300, max_speed_kmh: 130, capacity: 3, direction: "BIDIRECTIONAL" },

  // ── AGR ↔ JCN SHORTCUT (Agra ↔ Nagpur diagonal) ──
  { segment_id: "AGR-JCN-A", from: "AGR",  to: "J_CN", distance_km: 380, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
  { segment_id: "AGR-JCN-B", from: "J_CN", to: "AGR",  distance_km: 380, max_speed_kmh: 120, capacity: 3, direction: "BIDIRECTIONAL" },
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

    logger.info(`Neo4j seed complete! ${stations.length} stations, ${junctions.length} junctions, ${tracks.length} track segments`);
  } catch (err) {
    logger.error({ err }, "Neo4j seed failed");
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }
}

seedNeo4j().then(() => process.exit(0)).catch(() => process.exit(1));