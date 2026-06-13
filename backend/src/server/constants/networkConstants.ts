// ─── SHARED NETWORK CONSTANTS ────────────────────────────────────────────────
// Single source of truth for station/junction coordinates and segment IDs.
// Import this in: simulator.ts, movementEngine.ts, platformAgent.ts,
//                 reroutingAgent.ts, and App.tsx (frontend).
// ─────────────────────────────────────────────────────────────────────────────

export const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  // Major stations
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
  // Junctions
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

// All segment IDs in the network — used for fast segment-ID lookup
export const ALL_SEGMENT_IDS: string[] = [
  // North corridor
  "DEL-JNW-A","DEL-JNW-B","JNW-AGR-A","JNW-AGR-B","AGR-JNC-A","AGR-JNC-B",
  "JNC-JNE-A","JNC-JNE-B","JNE-PAT-A","JNE-PAT-B","PAT-KOL-A","PAT-KOL-B",
  // West corridor
  "DEL-JCW-A","DEL-JCW-B","JCW-SUR-A","JCW-SUR-B","SUR-MUM-A","SUR-MUM-B",
  // Central
  "DEL-JCN-A","DEL-JCN-B","JCN-HYD-A","JCN-HYD-B",
  // South
  "HYD-JSC-A","HYD-JSC-B","JSC-BLR-A","JSC-BLR-B",
  "HYD-CHN-A","HYD-CHN-B","JCE-CHN-A","JCE-CHN-B","BLR-CHN-A","BLR-CHN-B",
  // Coastal / Goa
  "MUM-JSW-A","MUM-JSW-B","JSW-GOA-A","JSW-GOA-B","GOA-BLR-A","GOA-BLR-B",
  // Mumbai loop
  "MUM-JMW-A","MUM-JMW-B","JMW-JMC-A","JMW-JMC-B",
  "JMC-HYD-A","JMC-HYD-B","JMC-JSC-A","JMC-JSC-B",
  // East cross
  "KOL-JCE-A","KOL-JCE-B",
  // Shortcuts
  "JCN-JMC-A","JCN-JMC-B","AGR-JCN-A","AGR-JCN-B",
];

// Node-pair → segment_id lookup table
// Keys are "FROM|TO" strings; values are segment_ids.
// Covers both directions of every bidirectional track.
export const SEGMENT_LOOKUP: Record<string, string> = {
  "DEL|J_NW":  "DEL-JNW-A",
  "J_NW|DEL":  "DEL-JNW-B",
  "J_NW|AGR":  "JNW-AGR-A",
  "AGR|J_NW":  "JNW-AGR-B",
  "AGR|J_NC":  "AGR-JNC-A",
  "J_NC|AGR":  "AGR-JNC-B",
  "J_NC|J_NE": "JNC-JNE-A",
  "J_NE|J_NC": "JNC-JNE-B",
  "J_NE|PAT":  "JNE-PAT-A",
  "PAT|J_NE":  "JNE-PAT-B",
  "PAT|KOL":   "PAT-KOL-A",
  "KOL|PAT":   "PAT-KOL-B",

  "DEL|J_CW":  "DEL-JCW-A",
  "J_CW|DEL":  "DEL-JCW-B",
  "J_CW|SUR":  "JCW-SUR-A",
  "SUR|J_CW":  "JCW-SUR-B",
  "SUR|MUM":   "SUR-MUM-A",
  "MUM|SUR":   "SUR-MUM-B",

  "DEL|J_CN":  "DEL-JCN-A",
  "J_CN|DEL":  "DEL-JCN-B",
  "J_CN|HYD":  "JCN-HYD-A",
  "HYD|J_CN":  "JCN-HYD-B",

  "HYD|J_SC":  "HYD-JSC-A",
  "J_SC|HYD":  "HYD-JSC-B",
  "J_SC|BLR":  "JSC-BLR-A",
  "BLR|J_SC":  "JSC-BLR-B",
  "HYD|J_CE":  "HYD-CHN-A",
  "J_CE|HYD":  "HYD-CHN-B",
  "J_CE|CHN":  "JCE-CHN-A",
  "CHN|J_CE":  "JCE-CHN-B",
  "BLR|CHN":   "BLR-CHN-A",
  "CHN|BLR":   "BLR-CHN-B",

  "MUM|J_SW":  "MUM-JSW-A",
  "J_SW|MUM":  "MUM-JSW-B",
  "J_SW|GOA":  "JSW-GOA-A",
  "GOA|J_SW":  "JSW-GOA-B",
  "GOA|BLR":   "GOA-BLR-A",
  "BLR|GOA":   "GOA-BLR-B",

  "MUM|J_MW":  "MUM-JMW-A",
  "J_MW|MUM":  "MUM-JMW-B",
  "J_MW|J_MC": "JMW-JMC-A",
  "J_MC|J_MW": "JMW-JMC-B",
  "J_MC|HYD":  "JMC-HYD-A",
  "HYD|J_MC":  "JMC-HYD-B",
  "J_MC|J_SC": "JMC-JSC-A",
  "J_SC|J_MC": "JMC-JSC-B",

  "KOL|J_CE":  "KOL-JCE-A",
  "J_CE|KOL":  "KOL-JCE-B",

  "J_CN|J_MC": "JCN-JMC-A",
  "J_MC|J_CN": "JCN-JMC-B",
  "AGR|J_CN":  "AGR-JCN-A",
  "J_CN|AGR":  "AGR-JCN-B",
};

export function getSegmentId(from: string, to: string): string {
  const key = `${from}|${to}`;
  return SEGMENT_LOOKUP[key] ?? `${from}-${to}-A`;
}

export function getStationCoords(nodeId: string): { lat: number; lng: number } {
  return STATION_COORDS[nodeId] ?? { lat: 400, lng: 400 };
}