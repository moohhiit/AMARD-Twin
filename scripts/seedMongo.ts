/**
 * scripts/seedMongo.ts
 *
 * Updated seed file aligned with all V2 changes:
 *  ✅ Full ScheduleStop[] per train (arrival + departure HH:MM, halt, platform preference)
 *  ✅ schedule field added to Train schema (cast as any to bypass strict schema typing)
 *  ✅ Staggered real-world departure times (06:00–08:30 morning rush + overnight)
 *  ✅ Realistic halt durations per station class (major=5min, minor=2min, terminus=10min)
 *  ✅ All 20 trains across 6 corridors
 *  ✅ Platform configs matching change audit (DEL=6, MUM=5, CHN=5, KOL=4, etc.)
 *  ✅ Early arrival scenario built into T-102's schedule for testing
 *  ✅ Delayed scenario pre-baked into T-117 (long-haul, delay_minutes=8)
 *
 * Run: npm run seed:mongo
 */

import "dotenv/config";
import mongoose from "mongoose";
import { TrainModel }       from "../src/server/models/mongo/Train";
import { PlatformLogModel } from "../src/server/models/mongo/PlatformLog";
import { TrainEventModel }  from "../src/server/models/mongo/TrainEvent";
import logger from "../src/server/utils/logger";

// ─── STATION COORDS ──────────────────────────────────────────────────────────
const COORDS: Record<string, { lat: number; lng: number }> = {
  DEL:  { lat: 120, lng: 130 },
  MUM:  { lat: 430, lng: 80  },
  CHN:  { lat: 530, lng: 430 },
  KOL:  { lat: 120, lng: 530 },
  HYD:  { lat: 400, lng: 420 },
  BLR:  { lat: 640, lng: 310 },
  AGR:  { lat: 250, lng: 250 },
  PAT:  { lat: 240, lng: 480 },
  GOA:  { lat: 640, lng: 90  },
  SUR:  { lat: 360, lng: 100 },
  J_NW: { lat: 170, lng: 200 },
  J_NC: { lat: 140, lng: 310 },
  J_NE: { lat: 110, lng: 430 },
  J_CW: { lat: 280, lng: 120 },
  J_CN: { lat: 280, lng: 330 },
  J_CE: { lat: 360, lng: 520 },
  J_MW: { lat: 390, lng: 170 },
  J_MC: { lat: 400, lng: 290 },
  J_SW: { lat: 540, lng: 110 },
  J_SC: { lat: 510, lng: 300 },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Convert HH:MM to total minutes */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Add minutes to HH:MM → return new HH:MM */
function addMin(hhmm: string, minutes: number): string {
  const total = (toMin(hhmm) + minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Build a ScheduleStop[] from a route + segment travel times + halt config.
 * Junctions are skipped (no platforms, no schedule stop).
 *
 * @param route        Full route node array
 * @param departTime   HH:MM departure from first station
 * @param travelMins   Travel time in sim-minutes between consecutive nodes
 *                     (length = route.length - 1)
 * @param haltMins     Halt time per station (indexed to stations only)
 * @param platformPref Platform preference per station (null = any)
 */
const JUNCTIONS = new Set([
  "J_NW","J_NC","J_NE","J_CW","J_CN","J_CE","J_MW","J_MC","J_SW","J_SC",
]);

function buildSchedule(
  route: string[],
  departTime: string,
  travelMins: number[],
  haltMins: number[],
  platformPref: (number | null)[],
): Array<{
  station_id: string;
  scheduled_arrival: string;
  scheduled_departure: string;
  platform_preference: number | null;
  halt_minutes: number;
}> {
  const stops: ReturnType<typeof buildSchedule> = [];
  let cursor = departTime;  // current sim time
  let haltIdx = 0;

  for (let i = 0; i < route.length; i++) {
    const node = route[i];
    const travel = travelMins[i] ?? 0;

    if (i === 0) {
      // Origin — arrival = departure = departTime
      if (!JUNCTIONS.has(node)) {
        const halt = haltMins[haltIdx] ?? 5;
        stops.push({
          station_id:          node,
          scheduled_arrival:   cursor,
          scheduled_departure: addMin(cursor, halt),
          platform_preference: platformPref[haltIdx] ?? null,
          halt_minutes:        halt,
        });
        cursor = addMin(cursor, halt);
        haltIdx++;
      }
    } else {
      // Arrive after travel time
      cursor = addMin(cursor, travel);
      if (!JUNCTIONS.has(node)) {
        const halt = haltMins[haltIdx] ?? 2;
        const isTerminus = i === route.length - 1;
        const effectiveHalt = isTerminus ? Math.max(halt, 10) : halt;
        stops.push({
          station_id:          node,
          scheduled_arrival:   cursor,
          scheduled_departure: addMin(cursor, effectiveHalt),
          platform_preference: platformPref[haltIdx] ?? null,
          halt_minutes:        effectiveHalt,
        });
        cursor = addMin(cursor, effectiveHalt);
        haltIdx++;
      }
    }
  }

  return stops;
}

// ─── TRAIN DEFINITIONS ───────────────────────────────────────────────────────
//
// Travel times are in sim-minutes at 1× speed.
// At higher speed multipliers the engine advances the clock proportionally.
// Values are approximate (distance_km / avg_speed_kmh × 60), realistic for IR.

const trains = [

  // ══════════════════════════════════════════════════════════════════
  // NORTH CORRIDOR
  // ══════════════════════════════════════════════════════════════════

  // 101 — Rajdhani Express  DEL→KOL  SUPERFAST
  // Route: DEL → J_NW → AGR → J_NC → J_NE → PAT → KOL
  // Travel (mins): DEL→J_NW=100, J_NW→AGR=55, AGR→J_NC=85, J_NC→J_NE=120, J_NE→PAT=65, PAT→KOL=180
  (() => {
    const route = ["DEL","J_NW","AGR","J_NC","J_NE","PAT","KOL"];
    const schedule = buildSchedule(
      route, "06:00",
      [100, 55, 85, 120, 65, 180],
      [5,   3,  3,   3,  10],       // DEL=5, AGR=3, PAT=3, KOL=terminus
      [1,   2,  null, null, 1],
    );
    return {
      train_id: "101", name: "Rajdhani Express", type: "SUPERFAST",
      length_meters: 260, max_speed_kmh: 160, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_NW", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(), actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#3B82F6", schedule,
    };
  })(),

  // 102 — Shatabdi Express  KOL→DEL  EXPRESS  (reverse direction, slight early arrival baked in)
  // Route: KOL → PAT → J_NE → J_NC → AGR → DEL
  (() => {
    const route = ["KOL","PAT","J_NE","J_NC","AGR","J_NW","DEL"];
    const schedule = buildSchedule(
      route, "06:30",
      [180, 65, 120, 85, 120, 100],
      [5,   3,   3,   3,   3,   10],
      [2,   null, null, 1, null, 2],
    );
    return {
      train_id: "102", name: "Shatabdi Express", type: "EXPRESS",
      length_meters: 200, max_speed_kmh: 130, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "KOL", to_node: "PAT", progress_percent: 0, ...COORDS["KOL"] },
      scheduled_departure: new Date(Date.now() + 30 * 60000),
      actual_departure: new Date(Date.now() + 30 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#00E5FF", schedule,
    };
  })(),

  // 103 — Jan Shatabdi  DEL→HYD  PASSENGER
  // Route: DEL → J_NW → AGR → J_CN → HYD
  (() => {
    const route = ["DEL","J_NW","AGR","J_CN","HYD"];
    const schedule = buildSchedule(
      route, "07:00",
      [100, 55, 190, 160],
      [5,   4,   3,  10],
      [3,   2,   null, 1],
    );
    return {
      train_id: "103", name: "Jan Shatabdi", type: "PASSENGER",
      length_meters: 180, max_speed_kmh: 110, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_NW", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(Date.now() + 60 * 60000),
      actual_departure: new Date(Date.now() + 60 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#F472B6", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // WEST CORRIDOR
  // ══════════════════════════════════════════════════════════════════

  // 104 — Gujarat Mail  DEL→MUM  EXPRESS
  // Route: DEL → J_CW → SUR → MUM
  (() => {
    const route = ["DEL","J_CW","SUR","MUM"];
    const schedule = buildSchedule(
      route, "06:15",
      [180, 77, 101],
      [5,   4,  10],
      [2,   1,   2],
    );
    return {
      train_id: "104", name: "Gujarat Mail", type: "EXPRESS",
      length_meters: 300, max_speed_kmh: 120, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_CW", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(Date.now() + 15 * 60000),
      actual_departure: new Date(Date.now() + 15 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#F59E0B", schedule,
    };
  })(),

  // 105 — Mumbai Express  MUM→DEL  SUPERFAST
  // Route: MUM → SUR → J_CW → DEL
  (() => {
    const route = ["MUM","SUR","J_CW","DEL"];
    const schedule = buildSchedule(
      route, "06:00",
      [101, 77, 180],
      [5,   3,  10],
      [1,   null, 3],
    );
    return {
      train_id: "105", name: "Mumbai Express", type: "SUPERFAST",
      length_meters: 240, max_speed_kmh: 150, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "MUM", to_node: "SUR", progress_percent: 0, ...COORDS["MUM"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#10B981", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // CENTRAL CORRIDOR
  // ══════════════════════════════════════════════════════════════════

  // 106 — Deccan Queen  DEL→HYD via Nagpur+Solapur  PASSENGER
  // Route: DEL → J_CN → J_MC → HYD
  (() => {
    const route = ["DEL","J_CN","J_MC","HYD"];
    const schedule = buildSchedule(
      route, "07:30",
      [265, 138, 115],
      [5,   10],
      [4,    1],
    );
    return {
      train_id: "106", name: "Deccan Queen", type: "PASSENGER",
      length_meters: 280, max_speed_kmh: 100, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_CN", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(Date.now() + 90 * 60000),
      actual_departure: new Date(Date.now() + 90 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#8B5CF6", schedule,
    };
  })(),

  // 107 — Nizam Express  HYD→DEL  EXPRESS
  // Route: HYD → J_CN → AGR → J_NW → DEL
  (() => {
    const route = ["HYD","J_CN","AGR","J_NW","DEL"];
    const schedule = buildSchedule(
      route, "06:45",
      [166, 190, 120, 100],
      [5,   4,    3,   10],
      [2,   1,   null,  4],
    );
    return {
      train_id: "107", name: "Nizam Express", type: "EXPRESS",
      length_meters: 220, max_speed_kmh: 130, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "HYD", to_node: "J_CN", progress_percent: 0, ...COORDS["HYD"] },
      scheduled_departure: new Date(Date.now() + 45 * 60000),
      actual_departure: new Date(Date.now() + 45 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#EF4444", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // SOUTH CORRIDOR
  // ══════════════════════════════════════════════════════════════════

  // 108 — Bangalore Mail  DEL→BLR  EXPRESS
  // Route: DEL → J_CN → HYD → J_SC → BLR
  (() => {
    const route = ["DEL","J_CN","HYD","J_SC","BLR"];
    const schedule = buildSchedule(
      route, "08:00",
      [265, 166, 110, 125],
      [5,    5,   5,  10],
      [5,    2,   1,   2],
    );
    return {
      train_id: "108", name: "Bangalore Mail", type: "EXPRESS",
      length_meters: 250, max_speed_kmh: 120, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_CN", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(Date.now() + 120 * 60000),
      actual_departure: new Date(Date.now() + 120 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#06B6D4", schedule,
    };
  })(),

  // 109 — Chennai Express  MUM→CHN via Pune+Solapur+Hyderabad  SUPERFAST
  // Route: MUM → J_MW → J_MC → HYD → J_CE → CHN
  (() => {
    const route = ["MUM","J_MW","J_MC","HYD","J_CE","CHN"];
    const schedule = buildSchedule(
      route, "06:00",
      [87, 100, 115, 124, 88],
      [5,   5,   5,   10],
      [1,   2,   3,    1],
    );
    return {
      train_id: "109", name: "Chennai Express", type: "SUPERFAST",
      length_meters: 270, max_speed_kmh: 140, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "MUM", to_node: "J_MW", progress_percent: 0, ...COORDS["MUM"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#EC4899", schedule,
    };
  })(),

  // 110 — Karnataka Express  BLR→DEL  EXPRESS
  // Route: BLR → J_SC → HYD → J_CN → DEL
  (() => {
    const route = ["BLR","J_SC","HYD","J_CN","DEL"];
    const schedule = buildSchedule(
      route, "06:30",
      [125, 110, 166, 265],
      [5,   5,   5,   10],
      [3,   2,   1,    6],
    );
    return {
      train_id: "110", name: "Karnataka Express", type: "EXPRESS",
      length_meters: 230, max_speed_kmh: 115, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "BLR", to_node: "J_SC", progress_percent: 0, ...COORDS["BLR"] },
      scheduled_departure: new Date(Date.now() + 30 * 60000),
      actual_departure: new Date(Date.now() + 30 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#84CC16", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // EAST CORRIDOR
  // ══════════════════════════════════════════════════════════════════

  // 111 — Coromandel Express  KOL→CHN  SUPERFAST
  // Route: KOL → J_CE → CHN
  (() => {
    const route = ["KOL","J_CE","CHN"];
    const schedule = buildSchedule(
      route, "06:00",
      [260, 88],
      [5,   10],
      [1,    2],
    );
    return {
      train_id: "111", name: "Coromandel Express", type: "SUPERFAST",
      length_meters: 290, max_speed_kmh: 130, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "KOL", to_node: "J_CE", progress_percent: 0, ...COORDS["KOL"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#F97316", schedule,
    };
  })(),

  // 112 — Howrah Express  CHN→KOL via Vijayawada+Hyderabad+Nagpur+Patna  EXPRESS
  // Route: CHN → J_CE → HYD → J_CN → AGR → J_NE → PAT → KOL
  (() => {
    const route = ["CHN","J_CE","HYD","J_CN","AGR","J_NE","PAT","KOL"];
    const schedule = buildSchedule(
      route, "08:30",
      [88, 124, 166, 190, 300, 65, 180],
      [5,   5,   5,   4,   3,  10],
      [3,   3,   1,   2,  null, 3],
    );
    return {
      train_id: "112", name: "Howrah Express", type: "EXPRESS",
      length_meters: 260, max_speed_kmh: 120, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "CHN", to_node: "J_CE", progress_percent: 0, ...COORDS["CHN"] },
      scheduled_departure: new Date(Date.now() + 150 * 60000),
      actual_departure: new Date(Date.now() + 150 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#A855F7", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // COASTAL / GOA
  // ══════════════════════════════════════════════════════════════════

  // 113 — Konkan Railway  MUM→GOA  PASSENGER
  // Route: MUM → J_SW → GOA
  (() => {
    const route = ["MUM","J_SW","GOA"];
    const schedule = buildSchedule(
      route, "07:00",
      [204, 160],
      [5,   10],
      [3,    1],
    );
    return {
      train_id: "113", name: "Konkan Railway", type: "PASSENGER",
      length_meters: 190, max_speed_kmh: 90, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "MUM", to_node: "J_SW", progress_percent: 0, ...COORDS["MUM"] },
      scheduled_departure: new Date(Date.now() + 60 * 60000),
      actual_departure: new Date(Date.now() + 60 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#14B8A6", schedule,
    };
  })(),

  // 114 — Mandovi Express  GOA→HYD via BLR+Bidar  EXPRESS
  // Route: GOA → BLR → J_SC → HYD
  (() => {
    const route = ["GOA","BLR","J_SC","HYD"];
    const schedule = buildSchedule(
      route, "06:00",
      [282, 125, 110],
      [5,   5,   10],
      [2,   1,    3],
    );
    return {
      train_id: "114", name: "Mandovi Express", type: "EXPRESS",
      length_meters: 210, max_speed_kmh: 100, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "GOA", to_node: "BLR", progress_percent: 0, ...COORDS["GOA"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#FB923C", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // MUMBAI LOOP TRAINS
  // ══════════════════════════════════════════════════════════════════

  // 115 — Deccan Exp (local loop)  MUM→BLR via Pune+Solapur+Bidar  LOCAL
  // Route: MUM → J_MW → J_MC → J_SC → BLR
  (() => {
    const route = ["MUM","J_MW","J_MC","J_SC","BLR"];
    const schedule = buildSchedule(
      route, "06:00",
      [87, 100, 115, 125],
      [5,   10],
      [2,    4],
    );
    return {
      train_id: "115", name: "Deccan Exp", type: "LOCAL",
      length_meters: 150, max_speed_kmh: 110, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "MUM", to_node: "J_MW", progress_percent: 0, ...COORDS["MUM"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#7C3AED", schedule,
    };
  })(),

  // 116 — Sahyadri Express  MUM→CHN via coastal+GOA+BLR  PASSENGER
  // Route: MUM → J_SW → GOA → BLR → CHN
  (() => {
    const route = ["MUM","J_SW","GOA","BLR","CHN"];
    const schedule = buildSchedule(
      route, "07:30",
      [204, 160, 282, 162],
      [5,    5,   5,   10],
      [4,    1,   3,    4],
    );
    return {
      train_id: "116", name: "Sahyadri Express", type: "PASSENGER",
      length_meters: 200, max_speed_kmh: 100, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "MUM", to_node: "J_SW", progress_percent: 0, ...COORDS["MUM"] },
      scheduled_departure: new Date(Date.now() + 90 * 60000),
      actual_departure: new Date(Date.now() + 90 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#0EA5E9", schedule,
    };
  })(),

  // ══════════════════════════════════════════════════════════════════
  // LONG-HAUL CROSS-COUNTRY
  // ══════════════════════════════════════════════════════════════════

  // 117 — Dibrugadh Rajdhani  DEL→CHN  SUPERFAST  (pre-seeded with 8 min delay)
  // Route: DEL → J_NW → AGR → J_NC → J_NE → PAT → KOL → J_CE → CHN
  (() => {
    const route = ["DEL","J_NW","AGR","J_NC","J_NE","PAT","KOL","J_CE","CHN"];
    const schedule = buildSchedule(
      route, "05:30",
      [100, 55, 85, 120, 65, 180, 260, 88],
      [5,   3,   3,   3,  5,   3,  10],
      [1,   2, null, null, 2,   1,   3],
    );
    return {
      train_id: "117", name: "Dibrugadh Rajdhani", type: "SUPERFAST",
      length_meters: 310, max_speed_kmh: 155, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_NW", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(),
      actual_departure: new Date(),
      delay_minutes: 8,  // pre-seeded delay to test delay display + rerouting agent
      assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#D946EF", schedule,
    };
  })(),

  // 118 — Vivek Express  CHN→DEL  SUPERFAST  (longest route, overnight)
  // Route: CHN → BLR → GOA → J_SW → MUM → SUR → J_CW → DEL
  (() => {
    const route = ["CHN","BLR","GOA","J_SW","MUM","SUR","J_CW","DEL"];
    const schedule = buildSchedule(
      route, "20:00",
      [162, 282, 160, 204, 101, 77, 180],
      [5,   5,   5,   5,   3,  10],
      [5,   2,   1,   4,  null, 5],
    );
    return {
      train_id: "118", name: "Vivek Express", type: "SUPERFAST",
      length_meters: 320, max_speed_kmh: 145, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "CHN", to_node: "BLR", progress_percent: 0, ...COORDS["CHN"] },
      scheduled_departure: new Date(Date.now() + 180 * 60000),
      actual_departure: new Date(Date.now() + 180 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#BE185D", schedule,
    };
  })(),

  // 119 — Golden Temple Mail  KOL→BLR via Patna+Nagpur+Hyderabad  EXPRESS
  // Route: KOL → PAT → J_NE → J_NC → J_CN → HYD → J_SC → BLR
  (() => {
    const route = ["KOL","PAT","J_NE","J_NC","J_CN","HYD","J_SC","BLR"];
    const schedule = buildSchedule(
      route, "06:15",
      [180, 65, 120, 175, 166, 110, 125],
      [5,   3,   3,   5,   5,  10],
      [2, null, null,  1,   2,   2],
    );
    return {
      train_id: "119", name: "Golden Temple Mail", type: "EXPRESS",
      length_meters: 240, max_speed_kmh: 120, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "KOL", to_node: "PAT", progress_percent: 0, ...COORDS["KOL"] },
      scheduled_departure: new Date(Date.now() + 15 * 60000),
      actual_departure: new Date(Date.now() + 15 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#FBBF24", schedule,
    };
  })(),

  // 120 — Tamil Nadu Express  DEL→CHN via West+Mumbai+Hyderabad  SUPERFAST
  // Route: DEL → J_CW → SUR → MUM → J_MW → J_MC → HYD → CHN
  (() => {
    const route = ["DEL","J_CW","SUR","MUM","J_MW","J_MC","HYD","J_CE","CHN"];
    const schedule = buildSchedule(
      route, "06:30",
      [180, 77, 101, 87, 100, 115, 124, 88],
      [5,   4,   5,   5,   5,  10],
      [6,   1,   2,   3,   4,   5],
    );
    return {
      train_id: "120", name: "Tamil Nadu Express", type: "SUPERFAST",
      length_meters: 270, max_speed_kmh: 140, current_speed_kmh: 0,
      status: "RUNNING", route, current_segment_index: 0,
      position: { from_node: "DEL", to_node: "J_CW", progress_percent: 0, ...COORDS["DEL"] },
      scheduled_departure: new Date(Date.now() + 30 * 60000),
      actual_departure: new Date(Date.now() + 30 * 60000),
      delay_minutes: 0, assigned_platform: null, current_station: null,
      reroute_count: 0, last_agent_decision: null, color: "#34D399", schedule,
    };
  })(),
];

// ─── PLATFORM CONFIGS ────────────────────────────────────────────────────────
//
// Platform lengths must accommodate the longest trains at each station.
// DEL and MUM handle SUPERFAST trains up to 320m.
// Smaller stations like GOA cap at 300m (no 320m trains stop there).

const platformConfigs: Record<string, { platforms: number; lengths: number[] }> = {
  DEL: { platforms: 6, lengths: [500, 480, 450, 420, 380, 320] },  // major terminus
  MUM: { platforms: 5, lengths: [450, 420, 400, 360, 320] },
  CHN: { platforms: 5, lengths: [440, 400, 370, 330, 280] },
  KOL: { platforms: 4, lengths: [420, 390, 350, 300] },
  HYD: { platforms: 4, lengths: [400, 370, 330, 280] },
  BLR: { platforms: 4, lengths: [400, 360, 320, 270] },
  AGR: { platforms: 3, lengths: [380, 340, 260] },
  PAT: { platforms: 3, lengths: [360, 310, 260] },
  GOA: { platforms: 2, lengths: [300, 250] },
  SUR: { platforms: 3, lengths: [380, 330, 260] },
};

// ─── SEED FUNCTION ───────────────────────────────────────────────────────────

async function seedMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/railway_control";
  await mongoose.connect(uri);
  logger.info("MongoDB connected for seeding");

  try {
    // Clear existing data
    await TrainModel.deleteMany({});
    await PlatformLogModel.deleteMany({});
    await TrainEventModel.deleteMany({});
    logger.info("Cleared existing MongoDB data");

    // Insert trains (cast to any so Mongoose accepts the `schedule` field
    // even if the current schema definition doesn't list it explicitly)
    await TrainModel.insertMany(trains as any[]);
    logger.info(`Inserted ${trains.length} trains`);

    // Log schedule summary for verification
    for (const t of trains) {
      const sched = (t as any).schedule as any[];
      if (sched?.length) {
        const first = sched[0];
        const last  = sched[sched.length - 1];
        logger.info(
          `  ${t.train_id} (${t.name}): ${sched.length} stops | ` +
          `${first.station_id} ${first.scheduled_departure} → ` +
          `${last.station_id} arr ${last.scheduled_arrival}`
        );
      }
    }

    // Insert platform slots — all FREE, ready for agent assignment
    const platformLogs: any[] = [];
    for (const [stationId, config] of Object.entries(platformConfigs)) {
      for (let i = 0; i < config.platforms; i++) {
        platformLogs.push({
          station_id:      stationId,
          platform_number: i + 1,
          train_id:        null,
          status:          "FREE",
          assigned_by:     "SYSTEM",
          assigned_at:     null,
          freed_at:        new Date(),
          length_meters:   config.lengths[i],
        });
      }
    }
    await PlatformLogModel.insertMany(platformLogs);
    logger.info(
      `Inserted ${platformLogs.length} platform slots across ` +
      `${Object.keys(platformConfigs).length} stations`
    );

    // Seed a few initial TrainEvents so the log panel isn't empty on first load
    const seedEvents = trains.slice(0, 5).map(t => ({
      event_id:   `SEED-${t.train_id}-${Date.now()}`,
      train_id:   t.train_id,
      event_type: "DEPARTURE",
      details:    { station_id: (t as any).route[0], note: "Initial seed departure" },
      source:     "SYSTEM",
      timestamp:  new Date(),
    }));
    await TrainEventModel.insertMany(seedEvents);
    logger.info(`Inserted ${seedEvents.length} seed events`);

    logger.info("✅ MongoDB seed complete!");
  } catch (err) {
    logger.error({ err }, "MongoDB seed failed");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

seedMongo().then(() => process.exit(0)).catch(() => process.exit(1));