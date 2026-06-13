/**
 * scripts/seedNeo4j.ts
 *
 * Seeds the Neo4j graph database with:
 *  ✅ 10 major stations (with platform counts)
 *  ✅ 10 routing junctions (no platforms)
 *  ✅ 56 track segments (28 bidirectional A/B pairs across all corridors)
 *  ✅ Initial weather state on every segment (CLEAR by default, 3 pre-set to non-CLEAR for testing)
 *  ✅ Risk levels and speed multipliers stored on tracks
 *
 * Network topology (SVG viewBox 0 0 800 750):
 *
 *  DEL(130,120)─J_NW(200,170)─J_NC(310,140)─J_NE(430,110)─KOL(530,120)
 *     │                │              │               │
 *  J_CW(120,280)  AGR(250,250)  J_CN(330,280)   PAT(480,240)
 *     │                │              │               │
 *  MUM(80,430)─J_MW(170,390)─J_MC(290,400)─HYD(420,400)─J_CE(520,360)
 *     │                │              │                         │
 *  J_SW(110,540)       │          J_SC(300,510)─BLR(310,640)  CHN(430,530)
 *     │                │                                         │
 *  GOA(90,640)         └──────────────────────────────────────BLR(310,640)
 *
 * Run: npm run seed:neo4j
 */

import "dotenv/config";
import { getNeo4jDriver } from "../src/server/config/neo4j";
import { Neo4jQueries }   from "../src/server/models/neo4j/queries";
import logger from "../src/server/utils/logger";

// ─── STATIONS ────────────────────────────────────────────────────────────────
const stations = [
  { id: "DEL", name: "New Delhi",         lat: 120, lng: 130, platforms: 6 },
  { id: "MUM", name: "Mumbai CST",        lat: 430, lng: 80,  platforms: 5 },
  { id: "CHN", name: "Chennai Central",   lat: 530, lng: 430, platforms: 5 },
  { id: "KOL", name: "Kolkata Howrah",    lat: 120, lng: 530, platforms: 4 },
  { id: "HYD", name: "Hyderabad Deccan",  lat: 400, lng: 420, platforms: 4 },
  { id: "BLR", name: "Bengaluru City",    lat: 640, lng: 310, platforms: 4 },
  { id: "AGR", name: "Agra Cantonment",   lat: 250, lng: 250, platforms: 3 },
  { id: "PAT", name: "Patna Junction",    lat: 240, lng: 480, platforms: 3 },
  { id: "GOA", name: "Vasco da Gama",     lat: 640, lng: 90,  platforms: 2 },
  { id: "SUR", name: "Surat Junction",    lat: 360, lng: 100, platforms: 3 },
];

// ─── JUNCTIONS ────────────────────────────────────────────────────────────────
const junctions = [
  { id: "J_NW", name: "Ambala Jn",     lat: 170, lng: 200 },
  { id: "J_NC", name: "Kanpur Jn",     lat: 140, lng: 310 },
  { id: "J_NE", name: "Gaya Jn",       lat: 110, lng: 430 },
  { id: "J_CW", name: "Vadodara Jn",   lat: 280, lng: 120 },
  { id: "J_CN", name: "Nagpur Jn",     lat: 280, lng: 330 },
  { id: "J_CE", name: "Vijayawada Jn", lat: 360, lng: 520 },
  { id: "J_MW", name: "Pune Jn",       lat: 390, lng: 170 },
  { id: "J_MC", name: "Solapur Jn",    lat: 400, lng: 290 },
  { id: "J_SW", name: "Ratnagiri Jn",  lat: 540, lng: 110 },
  { id: "J_SC", name: "Bidar Jn",      lat: 510, lng: 300 },
];

// ─── WEATHER PRESETS ─────────────────────────────────────────────────────────
// Used to pre-seed a few segments with non-CLEAR weather so the map
// immediately shows the weather-coloured track feature on first load.
// Format: segment_id → { type, risk_level, speed_multiplier }
const WEATHER_PRESETS: Record<string, {
  type: "RAIN" | "FOG" | "STORM";
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  speed_multiplier: number;
  description: string;
}> = {
  // Monsoon rain on Konkan coastal stretch (MUM→GOA)
  "MUM-JSW-A": { type: "RAIN",  risk_level: "MEDIUM", speed_multiplier: 0.85, description: "Monsoon rain — reduced visibility" },
  "MUM-JSW-B": { type: "RAIN",  risk_level: "MEDIUM", speed_multiplier: 0.85, description: "Monsoon rain — reduced visibility" },
  // Dense fog on North corridor near Kanpur
  "JNC-JNE-A": { type: "FOG",   risk_level: "HIGH",   speed_multiplier: 0.65, description: "Dense winter fog — caution speed" },
  "JNC-JNE-B": { type: "FOG",   risk_level: "HIGH",   speed_multiplier: 0.65, description: "Dense winter fog — caution speed" },
  // Storm on Vijayawada–Chennai stretch
  "JCE-CHN-A": { type: "STORM", risk_level: "CRITICAL", speed_multiplier: 0.50, description: "Cyclone warning — emergency protocols" },
  "JCE-CHN-B": { type: "STORM", risk_level: "CRITICAL", speed_multiplier: 0.50, description: "Cyclone warning — emergency protocols" },
};

// ─── TRACKS ──────────────────────────────────────────────────────────────────
// Naming convention: {FROM}-{TO}-A  = Up track (primary direction)
//                   {FROM}-{TO}-B  = Down track (reverse direction)
// Every corridor has both A and B so double-track is represented in the graph.
// ─────────────────────────────────────────────────────────────────────────────

interface TrackDef {
  segment_id:     string;
  from:           string;
  to:             string;
  distance_km:    number;
  max_speed_kmh:  number;
  capacity:       number;
  direction:      string;
  // weather fields (populated from WEATHER_PRESETS or default CLEAR)
  weather:        string;
  risk_level:     string;
  speed_multiplier: number;
  weather_description: string;
}

function makeTrack(
  segment_id: string,
  from: string,
  to: string,
  distance_km: number,
  max_speed_kmh: number,
  capacity: number,
): TrackDef {
  const preset = WEATHER_PRESETS[segment_id];
  return {
    segment_id, from, to, distance_km, max_speed_kmh, capacity,
    direction: "BIDIRECTIONAL",
    weather:             preset?.type ?? "CLEAR",
    risk_level:          preset?.risk_level ?? "NONE",
    speed_multiplier:    preset?.speed_multiplier ?? 1.0,
    weather_description: preset?.description ?? "",
  };
}

const tracks: TrackDef[] = [
  // ── NORTH CORRIDOR: DEL ↔ KOL (via Ambala, Agra, Kanpur, Gaya, Patna) ──
  makeTrack("DEL-JNW-A", "DEL",  "J_NW", 260, 160, 4),
  makeTrack("DEL-JNW-B", "J_NW", "DEL",  260, 160, 4),
  makeTrack("JNW-AGR-A", "J_NW", "AGR",  120, 130, 3),
  makeTrack("JNW-AGR-B", "AGR",  "J_NW", 120, 130, 3),
  makeTrack("AGR-JNC-A", "AGR",  "J_NC", 200, 140, 3),
  makeTrack("AGR-JNC-B", "J_NC", "AGR",  200, 140, 3),
  makeTrack("JNC-JNE-A", "J_NC", "J_NE", 300, 150, 4),  // ← FOG preset
  makeTrack("JNC-JNE-B", "J_NE", "J_NC", 300, 150, 4),  // ← FOG preset
  makeTrack("JNE-PAT-A", "J_NE", "PAT",  140, 130, 3),
  makeTrack("JNE-PAT-B", "PAT",  "J_NE", 140, 130, 3),
  makeTrack("PAT-KOL-A", "PAT",  "KOL",  390, 130, 3),
  makeTrack("PAT-KOL-B", "KOL",  "PAT",  390, 130, 3),

  // ── WEST CORRIDOR: DEL ↔ MUM (via Vadodara, Surat) ──
  makeTrack("DEL-JCW-A", "DEL",  "J_CW", 450, 150, 4),
  makeTrack("DEL-JCW-B", "J_CW", "DEL",  450, 150, 4),
  makeTrack("JCW-SUR-A", "J_CW", "SUR",  180, 140, 3),
  makeTrack("JCW-SUR-B", "SUR",  "J_CW", 180, 140, 3),
  makeTrack("SUR-MUM-A", "SUR",  "MUM",  270, 160, 4),
  makeTrack("SUR-MUM-B", "MUM",  "SUR",  270, 160, 4),

  // ── CENTRAL CORRIDOR: DEL ↔ HYD (via Nagpur) ──
  makeTrack("DEL-JCN-A", "DEL",  "J_CN", 620, 140, 3),
  makeTrack("DEL-JCN-B", "J_CN", "DEL",  620, 140, 3),
  makeTrack("JCN-HYD-A", "J_CN", "HYD",  360, 130, 3),
  makeTrack("JCN-HYD-B", "HYD",  "J_CN", 360, 130, 3),

  // ── SOUTH CORRIDOR: HYD ↔ BLR / HYD ↔ CHN ──
  makeTrack("HYD-JSC-A", "HYD",  "J_SC", 220, 120, 3),
  makeTrack("HYD-JSC-B", "J_SC", "HYD",  220, 120, 3),
  makeTrack("JSC-BLR-A", "J_SC", "BLR",  230, 110, 2),
  makeTrack("JSC-BLR-B", "BLR",  "J_SC", 230, 110, 2),
  makeTrack("HYD-CHN-A", "HYD",  "J_CE", 270, 120, 3),
  makeTrack("HYD-CHN-B", "J_CE", "HYD",  270, 120, 3),
  makeTrack("JCE-CHN-A", "J_CE", "CHN",  190, 130, 3),  // ← STORM preset
  makeTrack("JCE-CHN-B", "CHN",  "J_CE", 190, 130, 3),  // ← STORM preset
  makeTrack("BLR-CHN-A", "BLR",  "CHN",  350, 130, 3),
  makeTrack("BLR-CHN-B", "CHN",  "BLR",  350, 130, 3),

  // ── COASTAL / GOA BRANCH ──
  makeTrack("MUM-JSW-A", "MUM",  "J_SW", 340, 100, 2),  // ← RAIN preset
  makeTrack("MUM-JSW-B", "J_SW", "MUM",  340, 100, 2),  // ← RAIN preset
  makeTrack("JSW-GOA-A", "J_SW", "GOA",  240, 90,  2),
  makeTrack("JSW-GOA-B", "GOA",  "J_SW", 240, 90,  2),
  makeTrack("GOA-BLR-A", "GOA",  "BLR",  470, 100, 2),
  makeTrack("GOA-BLR-B", "BLR",  "GOA",  470, 100, 2),

  // ── MUMBAI METRO LOOP: MUM ↔ J_MW ↔ J_MC ↔ J_SC ──
  makeTrack("MUM-JMW-A", "MUM",  "J_MW", 160, 110, 3),
  makeTrack("MUM-JMW-B", "J_MW", "MUM",  160, 110, 3),
  makeTrack("JMW-JMC-A", "J_MW", "J_MC", 200, 120, 3),
  makeTrack("JMW-JMC-B", "J_MC", "J_MW", 200, 120, 3),
  makeTrack("JMC-HYD-A", "J_MC", "HYD",  250, 130, 3),
  makeTrack("JMC-HYD-B", "HYD",  "J_MC", 250, 130, 3),
  makeTrack("JMC-JSC-A", "J_MC", "J_SC", 210, 110, 2),
  makeTrack("JMC-JSC-B", "J_SC", "J_MC", 210, 110, 2),

  // ── EAST CROSS-LINK: KOL ↔ CHN (via Vijayawada) ──
  makeTrack("KOL-JCE-A", "KOL",  "J_CE", 520, 120, 3),
  makeTrack("KOL-JCE-B", "J_CE", "KOL",  520, 120, 3),

  // ── NORTH-SOUTH SHORTCUT: Nagpur ↔ Solapur ──
  makeTrack("JCN-JMC-A", "J_CN", "J_MC", 300, 130, 3),
  makeTrack("JCN-JMC-B", "J_MC", "J_CN", 300, 130, 3),

  // ── DIAGONAL SHORTCUT: Agra ↔ Nagpur ──
  makeTrack("AGR-JCN-A", "AGR",  "J_CN", 380, 120, 3),
  makeTrack("AGR-JCN-B", "J_CN", "AGR",  380, 120, 3),
];

// ─── SEED ────────────────────────────────────────────────────────────────────
async function seedNeo4j() {
  const driver  = getNeo4jDriver();
  const session = driver.session();

  try {
    logger.info("Clearing existing Neo4j data...");
    await session.run(Neo4jQueries.clearAll);

    logger.info(`Creating ${stations.length} stations...`);
    for (const s of stations) {
      await session.run(Neo4jQueries.createStation, s);
    }

    logger.info(`Creating ${junctions.length} junctions...`);
    for (const j of junctions) {
      await session.run(Neo4jQueries.createJunction, j);
    }

    logger.info(`Creating ${tracks.length} track segments...`);
    for (const t of tracks) {
      // Pass weather fields alongside standard track fields
      await session.run(Neo4jQueries.createTrack, t);
    }

    // Summary log
    const weatherSegments = tracks.filter(t => t.weather !== "CLEAR");
    logger.info(
      `Neo4j seed complete!\n` +
      `  Stations:  ${stations.length}\n` +
      `  Junctions: ${junctions.length}\n` +
      `  Segments:  ${tracks.length} (${tracks.length / 2} bidirectional pairs)\n` +
      `  Weather-affected segments: ${weatherSegments.length}:\n` +
      weatherSegments.map(t => `    ${t.segment_id}: ${t.weather} (${t.risk_level}) — ${t.weather_description}`).join("\n")
    );
  } catch (err) {
    logger.error({ err }, "Neo4j seed failed");
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }
}

seedNeo4j().then(() => process.exit(0)).catch(() => process.exit(1));
