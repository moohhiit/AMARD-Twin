/**
 * scripts/seedMongo.ts
 *
 *  ✅ 20 trains across 6 corridors with full ScheduleStop[] (arrival+departure HH:MM)
 *  ✅ Realistic halt durations — major=5m, minor=2m, terminus=10m
 *  ✅ Staggered departure times 05:30–08:30 (morning rush) + overnight (20:00)
 *  ✅ T-117 pre-seeded with delay_minutes=8 (tests delay display + rerouting agent)
 *  ✅ T-102 built with early arrival scenario
 *  ✅ Platform configs for all 10 major stations
 *  ✅ 5 seed TrainEvents so history panel is non-empty on first load
 *  ✅ Initial weather events for pre-seeded weather segments matching seedNeo4j
 *
 * Run: npm run seed:mongo
 */

import "dotenv/config";
import mongoose from "mongoose";
import { TrainModel }       from "../src/server/models/mongo/Train";
import { PlatformLogModel } from "../src/server/models/mongo/PlatformLog";
import { TrainEventModel }  from "../src/server/models/mongo/TrainEvent";
import logger from "../src/server/utils/logger";

// ─── STATION COORDS (must match seedNeo4j + networkConstants) ─────────────
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
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function addMin(hhmm: string, minutes: number): string {
  const total = (toMin(hhmm) + minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const JUNCTIONS = new Set([
  "J_NW","J_NC","J_NE","J_CW","J_CN","J_CE","J_MW","J_MC","J_SW","J_SC",
]);

/**
 * Build ScheduleStop[] from a route.
 * Junctions are skipped (no scheduled stop).
 * Terminus gets at least 10m halt.
 */
function buildSchedule(
  route:       string[],
  departTime:  string,
  travelMins:  number[],
  haltMins:    number[],
  platformPref: (number | null)[],
) {
  const stops: Array<{
    station_id:          string;
    scheduled_arrival:   string;
    scheduled_departure: string;
    platform_preference: number | null;
    halt_minutes:        number;
  }> = [];

  let cursor  = departTime;
  let haltIdx = 0;

  for (let i = 0; i < route.length; i++) {
    const node   = route[i];
    const travel = travelMins[i] ?? 0;

    if (i === 0) {
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
      cursor = addMin(cursor, travel);
      if (!JUNCTIONS.has(node)) {
        const isTerminus    = i === route.length - 1;
        const halt          = haltMins[haltIdx] ?? 2;
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

const trains = [

  // ════════════════════════════════════════
  // NORTH CORRIDOR
  // ════════════════════════════════════════

  // T-101  Rajdhani Express  DEL→KOL  SUPERFAST
  (() => {
    const route    = ["DEL","J_NW","AGR","J_NC","J_NE","PAT","KOL"];
    const schedule = buildSchedule(route, "06:00",
      [100, 55, 85, 120, 65, 180],
      [5, 3, 3, 3, 10],
      [1, 2, null, null, 1]);
    return {
      train_id:"101", name:"Rajdhani Express", type:"SUPERFAST",
      length_meters:260, max_speed_kmh:160, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_NW", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#3B82F6", schedule,
    };
  })(),

  // T-102  Shatabdi Express  KOL→DEL  EXPRESS  (early arrival scenario)
  (() => {
    const route    = ["KOL","PAT","J_NE","J_NC","AGR","J_NW","DEL"];
    const schedule = buildSchedule(route, "06:30",
      [180, 65, 120, 85, 120, 100],
      [5, 3, 3, 3, 3, 10],
      [2, null, null, 1, null, 2]);
    return {
      train_id:"102", name:"Shatabdi Express", type:"EXPRESS",
      length_meters:200, max_speed_kmh:130, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"KOL", to_node:"PAT", progress_percent:0, ...COORDS["KOL"] },
      scheduled_departure:new Date(Date.now()+30*60000), actual_departure:new Date(Date.now()+30*60000),
      delay_minutes:-3, // early arrival scenario
      assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#00E5FF", schedule,
    };
  })(),

  // T-103  Jan Shatabdi  DEL→HYD  PASSENGER
  (() => {
    const route    = ["DEL","J_NW","AGR","J_CN","HYD"];
    const schedule = buildSchedule(route, "07:00",
      [100, 55, 190, 160],
      [5, 4, 3, 10],
      [3, 2, null, 1]);
    return {
      train_id:"103", name:"Jan Shatabdi", type:"PASSENGER",
      length_meters:180, max_speed_kmh:110, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_NW", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(Date.now()+60*60000), actual_departure:new Date(Date.now()+60*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#F472B6", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // WEST CORRIDOR
  // ════════════════════════════════════════

  // T-104  Gujarat Mail  DEL→MUM  EXPRESS
  (() => {
    const route    = ["DEL","J_CW","SUR","MUM"];
    const schedule = buildSchedule(route, "06:15",
      [180, 77, 101],
      [5, 4, 10],
      [2, 1, 2]);
    return {
      train_id:"104", name:"Gujarat Mail", type:"EXPRESS",
      length_meters:300, max_speed_kmh:120, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_CW", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(Date.now()+15*60000), actual_departure:new Date(Date.now()+15*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#F59E0B", schedule,
    };
  })(),

  // T-105  Mumbai Express  MUM→DEL  SUPERFAST
  (() => {
    const route    = ["MUM","SUR","J_CW","DEL"];
    const schedule = buildSchedule(route, "06:00",
      [101, 77, 180],
      [5, 3, 10],
      [1, null, 3]);
    return {
      train_id:"105", name:"Mumbai Express", type:"SUPERFAST",
      length_meters:240, max_speed_kmh:150, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"MUM", to_node:"SUR", progress_percent:0, ...COORDS["MUM"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#10B981", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // CENTRAL CORRIDOR
  // ════════════════════════════════════════

  // T-106  Deccan Queen  DEL→HYD  PASSENGER
  (() => {
    const route    = ["DEL","J_CN","J_MC","HYD"];
    const schedule = buildSchedule(route, "07:30",
      [265, 138, 115],
      [5, 10],
      [4, 1]);
    return {
      train_id:"106", name:"Deccan Queen", type:"PASSENGER",
      length_meters:280, max_speed_kmh:100, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_CN", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(Date.now()+90*60000), actual_departure:new Date(Date.now()+90*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#8B5CF6", schedule,
    };
  })(),

  // T-107  Nizam Express  HYD→DEL  EXPRESS
  (() => {
    const route    = ["HYD","J_CN","AGR","J_NW","DEL"];
    const schedule = buildSchedule(route, "06:45",
      [166, 190, 120, 100],
      [5, 4, 3, 10],
      [2, 1, null, 4]);
    return {
      train_id:"107", name:"Nizam Express", type:"EXPRESS",
      length_meters:220, max_speed_kmh:130, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"HYD", to_node:"J_CN", progress_percent:0, ...COORDS["HYD"] },
      scheduled_departure:new Date(Date.now()+45*60000), actual_departure:new Date(Date.now()+45*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#EF4444", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // SOUTH CORRIDOR
  // ════════════════════════════════════════

  // T-108  Bangalore Mail  DEL→BLR  EXPRESS
  (() => {
    const route    = ["DEL","J_CN","HYD","J_SC","BLR"];
    const schedule = buildSchedule(route, "08:00",
      [265, 166, 110, 125],
      [5, 5, 5, 10],
      [5, 2, 1, 2]);
    return {
      train_id:"108", name:"Bangalore Mail", type:"EXPRESS",
      length_meters:250, max_speed_kmh:120, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_CN", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(Date.now()+120*60000), actual_departure:new Date(Date.now()+120*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#06B6D4", schedule,
    };
  })(),

  // T-109  Chennai Express  MUM→CHN  SUPERFAST
  (() => {
    const route    = ["MUM","J_MW","J_MC","HYD","J_CE","CHN"];
    const schedule = buildSchedule(route, "06:00",
      [87, 100, 115, 124, 88],
      [5, 5, 5, 10],
      [1, 2, 3, 1]);
    return {
      train_id:"109", name:"Chennai Express", type:"SUPERFAST",
      length_meters:270, max_speed_kmh:140, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"MUM", to_node:"J_MW", progress_percent:0, ...COORDS["MUM"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#EC4899", schedule,
    };
  })(),

  // T-110  Karnataka Express  BLR→DEL  EXPRESS
  (() => {
    const route    = ["BLR","J_SC","HYD","J_CN","DEL"];
    const schedule = buildSchedule(route, "06:30",
      [125, 110, 166, 265],
      [5, 5, 5, 10],
      [3, 2, 1, 6]);
    return {
      train_id:"110", name:"Karnataka Express", type:"EXPRESS",
      length_meters:230, max_speed_kmh:115, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"BLR", to_node:"J_SC", progress_percent:0, ...COORDS["BLR"] },
      scheduled_departure:new Date(Date.now()+30*60000), actual_departure:new Date(Date.now()+30*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#84CC16", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // EAST CORRIDOR
  // ════════════════════════════════════════

  // T-111  Coromandel Express  KOL→CHN  SUPERFAST
  (() => {
    const route    = ["KOL","J_CE","CHN"];
    const schedule = buildSchedule(route, "06:00",
      [260, 88],
      [5, 10],
      [1, 2]);
    return {
      train_id:"111", name:"Coromandel Express", type:"SUPERFAST",
      length_meters:290, max_speed_kmh:130, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"KOL", to_node:"J_CE", progress_percent:0, ...COORDS["KOL"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#F97316", schedule,
    };
  })(),

  // T-112  Howrah Express  CHN→KOL  EXPRESS
  (() => {
    const route    = ["CHN","J_CE","HYD","J_CN","AGR","J_NE","PAT","KOL"];
    const schedule = buildSchedule(route, "08:30",
      [88, 124, 166, 190, 300, 65, 180],
      [5, 5, 5, 4, 3, 10],
      [3, 3, 1, 2, null, 3]);
    return {
      train_id:"112", name:"Howrah Express", type:"EXPRESS",
      length_meters:260, max_speed_kmh:120, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"CHN", to_node:"J_CE", progress_percent:0, ...COORDS["CHN"] },
      scheduled_departure:new Date(Date.now()+150*60000), actual_departure:new Date(Date.now()+150*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#A855F7", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // COASTAL / GOA
  // ════════════════════════════════════════

  // T-113  Konkan Railway  MUM→GOA  PASSENGER
  // NOTE: MUM-JSW segment has RAIN weather — train will show weather slowdown
  (() => {
    const route    = ["MUM","J_SW","GOA"];
    const schedule = buildSchedule(route, "07:00",
      [204, 160],
      [5, 10],
      [3, 1]);
    return {
      train_id:"113", name:"Konkan Railway", type:"PASSENGER",
      length_meters:190, max_speed_kmh:90, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"MUM", to_node:"J_SW", progress_percent:0, ...COORDS["MUM"] },
      scheduled_departure:new Date(Date.now()+60*60000), actual_departure:new Date(Date.now()+60*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#14B8A6", schedule,
    };
  })(),

  // T-114  Mandovi Express  GOA→HYD  EXPRESS
  (() => {
    const route    = ["GOA","BLR","J_SC","HYD"];
    const schedule = buildSchedule(route, "06:00",
      [282, 125, 110],
      [5, 5, 10],
      [2, 1, 3]);
    return {
      train_id:"114", name:"Mandovi Express", type:"EXPRESS",
      length_meters:210, max_speed_kmh:100, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"GOA", to_node:"BLR", progress_percent:0, ...COORDS["GOA"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#FB923C", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // MUMBAI LOOP
  // ════════════════════════════════════════

  // T-115  Deccan Exp  MUM→BLR (loop)  LOCAL
  (() => {
    const route    = ["MUM","J_MW","J_MC","J_SC","BLR"];
    const schedule = buildSchedule(route, "06:00",
      [87, 100, 115, 125],
      [5, 10],
      [2, 4]);
    return {
      train_id:"115", name:"Deccan Exp", type:"LOCAL",
      length_meters:150, max_speed_kmh:110, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"MUM", to_node:"J_MW", progress_percent:0, ...COORDS["MUM"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#7C3AED", schedule,
    };
  })(),

  // T-116  Sahyadri Express  MUM→CHN  PASSENGER
  (() => {
    const route    = ["MUM","J_SW","GOA","BLR","CHN"];
    const schedule = buildSchedule(route, "07:30",
      [204, 160, 282, 162],
      [5, 5, 5, 10],
      [4, 1, 3, 4]);
    return {
      train_id:"116", name:"Sahyadri Express", type:"PASSENGER",
      length_meters:200, max_speed_kmh:100, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"MUM", to_node:"J_SW", progress_percent:0, ...COORDS["MUM"] },
      scheduled_departure:new Date(Date.now()+90*60000), actual_departure:new Date(Date.now()+90*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#0EA5E9", schedule,
    };
  })(),

  // ════════════════════════════════════════
  // LONG-HAUL CROSS-COUNTRY
  // ════════════════════════════════════════

  // T-117  Dibrugadh Rajdhani  DEL→CHN  SUPERFAST  ← PRE-SEEDED DELAY = 8m
  // Tests delay display + rerouting agent. Also passes through FOG zone (JNC-JNE).
  (() => {
    const route    = ["DEL","J_NW","AGR","J_NC","J_NE","PAT","KOL","J_CE","CHN"];
    const schedule = buildSchedule(route, "05:30",
      [100, 55, 85, 120, 65, 180, 260, 88],
      [5, 3, 3, 3, 5, 3, 10],
      [1, 2, null, null, 2, 1, 3]);
    return {
      train_id:"117", name:"Dibrugadh Rajdhani", type:"SUPERFAST",
      length_meters:310, max_speed_kmh:155, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_NW", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(), actual_departure:new Date(),
      delay_minutes:8, // ← pre-seeded delay for testing
      assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#D946EF", schedule,
    };
  })(),

  // T-118  Vivek Express  CHN→DEL  SUPERFAST  (longest route, overnight)
  // Passes through STORM zone (JCE-CHN) at start
  (() => {
    const route    = ["CHN","BLR","GOA","J_SW","MUM","SUR","J_CW","DEL"];
    const schedule = buildSchedule(route, "20:00",
      [162, 282, 160, 204, 101, 77, 180],
      [5, 5, 5, 5, 3, 10],
      [5, 2, 1, 4, null, 5]);
    return {
      train_id:"118", name:"Vivek Express", type:"SUPERFAST",
      length_meters:320, max_speed_kmh:145, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"CHN", to_node:"BLR", progress_percent:0, ...COORDS["CHN"] },
      scheduled_departure:new Date(Date.now()+180*60000), actual_departure:new Date(Date.now()+180*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#BE185D", schedule,
    };
  })(),

  // T-119  Golden Temple Mail  KOL→BLR  EXPRESS
  (() => {
    const route    = ["KOL","PAT","J_NE","J_NC","J_CN","HYD","J_SC","BLR"];
    const schedule = buildSchedule(route, "06:15",
      [180, 65, 120, 175, 166, 110, 125],
      [5, 3, 3, 5, 5, 10],
      [2, null, null, 1, 2, 2]);
    return {
      train_id:"119", name:"Golden Temple Mail", type:"EXPRESS",
      length_meters:240, max_speed_kmh:120, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"KOL", to_node:"PAT", progress_percent:0, ...COORDS["KOL"] },
      scheduled_departure:new Date(Date.now()+15*60000), actual_departure:new Date(Date.now()+15*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#FBBF24", schedule,
    };
  })(),

  // T-120  Tamil Nadu Express  DEL→CHN  SUPERFAST
  (() => {
    const route    = ["DEL","J_CW","SUR","MUM","J_MW","J_MC","HYD","J_CE","CHN"];
    const schedule = buildSchedule(route, "06:30",
      [180, 77, 101, 87, 100, 115, 124, 88],
      [5, 4, 5, 5, 5, 10],
      [6, 1, 2, 3, 4, 5]);
    return {
      train_id:"120", name:"Tamil Nadu Express", type:"SUPERFAST",
      length_meters:270, max_speed_kmh:140, current_speed_kmh:0,
      status:"RUNNING", route, current_segment_index:0,
      position:{ from_node:"DEL", to_node:"J_CW", progress_percent:0, ...COORDS["DEL"] },
      scheduled_departure:new Date(Date.now()+30*60000), actual_departure:new Date(Date.now()+30*60000),
      delay_minutes:0, assigned_platform:null, current_station:null,
      reroute_count:0, last_agent_decision:null, color:"#34D399", schedule,
    };
  })(),
];

// ─── PLATFORM CONFIGS ────────────────────────────────────────────────────────
const platformConfigs: Record<string, { platforms: number; lengths: number[] }> = {
  DEL: { platforms: 6, lengths: [500, 480, 450, 420, 380, 320] },
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

// ─── SEED ────────────────────────────────────────────────────────────────────
async function seedMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/railway_control";
  await mongoose.connect(uri);
  logger.info("MongoDB connected for seeding");

  try {
    await TrainModel.deleteMany({});
    await PlatformLogModel.deleteMany({});
    await TrainEventModel.deleteMany({});
    logger.info("Cleared existing MongoDB data");

    await TrainModel.insertMany(trains as any[]);
    logger.info(`Inserted ${trains.length} trains`);

    // Log schedule summary
    for (const t of trains) {
      const sched = (t as any).schedule as any[];
      if (sched?.length) {
        const first = sched[0];
        const last  = sched[sched.length - 1];
        logger.info(
          `  ${t.train_id} (${t.name}): ${sched.length} stops | ` +
          `${first.station_id} dep ${first.scheduled_departure} → ` +
          `${last.station_id} arr ${last.scheduled_arrival}` +
          ((t as any).delay_minutes ? ` | ⚠ pre-delay: ${(t as any).delay_minutes}m` : "")
        );
      }
    }

    // Platform slots
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
    logger.info(`Inserted ${platformLogs.length} platform slots across ${Object.keys(platformConfigs).length} stations`);

    // Seed initial TrainEvents — so history panel is non-empty on first load
    const now = Date.now();
    const seedEvents = [
      // Normal departures
      ...trains.slice(0, 5).map((t, i) => ({
        event_id:   `SEED-DEP-${t.train_id}-${now}`,
        train_id:   t.train_id,
        event_type: "DEPARTURE",
        details:    { station_id: (t as any).route[0], note: "Initial departure (seeded)" },
        source:     "SYSTEM",
        timestamp:  new Date(now - (5 - i) * 60000),
      })),
      // Weather events mapped to valid enum values
      // RAIN on MUM-JSW — T-113 Konkan Railway
      {
        event_id:   `SEED-WX-RAIN-${now}`,
        train_id:   "113",
        event_type: "SPEED_CHANGE",           // ✅ was: "WEATHER_ALERT"
        details:    { segment_id: "MUM-JSW-A", weather: "RAIN", risk_level: "MEDIUM", description: "Monsoon rain — reduced visibility, speed 85%" },
        source:     "ENGINE",                 // ✅ was: "WEATHER_ENGINE"
        timestamp:  new Date(now - 2 * 60000),
      },
      // FOG on JNC-JNE — T-117 Dibrugadh Rajdhani
      {
        event_id:   `SEED-WX-FOG-${now}`,
        train_id:   "117",
        event_type: "SPEED_CHANGE",           // ✅ was: "WEATHER_ALERT"
        details:    { segment_id: "JNC-JNE-A", weather: "FOG", risk_level: "HIGH", description: "Dense winter fog — caution speed 65%" },
        source:     "ENGINE",                 // ✅ was: "WEATHER_ENGINE"
        timestamp:  new Date(now - 1 * 60000),
      },
      // STORM on JCE-CHN — T-111 Coromandel Express
      {
        event_id:   `SEED-WX-STORM-${now}`,
        train_id:   "111",
        event_type: "SPEED_CHANGE",           // ✅ was: "WEATHER_ALERT"
        details:    { segment_id: "JCE-CHN-A", weather: "STORM", risk_level: "CRITICAL", description: "Cyclone warning — emergency speed 50%" },
        source:     "ENGINE",                 // ✅ was: "WEATHER_ENGINE"
        timestamp:  new Date(now),
      },
      // Pre-existing delay event for T-117
      {
        event_id:   `SEED-DELAY-117-${now}`,
        train_id:   "117",
        event_type: "DELAY_UPDATED",          // ✅ was: "DELAY"
        details:    { delay_minutes: 8, reason: "Congestion at origin terminal", station_id: "DEL" },
        source:     "SYSTEM",                 // ✅ was: "SCHEDULE_MANAGER"
        timestamp:  new Date(now - 3 * 60000),
      },
    ];

    await TrainEventModel.insertMany(seedEvents);
    logger.info(`Inserted ${seedEvents.length} seed events (departures + weather alerts + delay)`);

    logger.info("✅ MongoDB seed complete!");
    logger.info(`\nWeather pre-seeded on network (matching seedNeo4j):\n` +
      `  🌧 RAIN:  MUM-JSW-A/B (Konkan coastal — T-113, T-116 affected)\n` +
      `  🌫 FOG:   JNC-JNE-A/B (North corridor — T-101, T-117 affected)\n` +
      `  ⛈ STORM: JCE-CHN-A/B (East-South link — T-111, T-112, T-109 affected)`
    );

  } catch (err) {
    logger.error({ err }, "MongoDB seed failed");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

seedMongo().then(() => process.exit(0)).catch(() => process.exit(1));