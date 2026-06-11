import { neo4jSession } from "../config/neo4j";
import { PlatformLogModel } from "../models/mongo/PlatformLog";
import { Neo4jQueries } from "../models/neo4j/queries";

const stationNames: Record<string, string> = {
  MUM: "Mumbai Central", DEL: "Delhi Junction", CHN: "Chennai Central",
  BLR: "Bangalore City", HYD: "Hyderabad",
};

export async function getAllStations() {
  const session = neo4jSession();
  try {
    const stationsResult = await session.run(Neo4jQueries.getAllStations);
    const junctionsResult = await session.run(Neo4jQueries.getAllJunctions);
    const stations = stationsResult.records.map((r) => ({
      id: r.get("id"),
      name: r.get("name"),
      type: "STATION" as const,
      lat: r.get("lat"),
      lng: r.get("lng"),
      platforms: r.get("platforms") as number,
    }));
    const junctions = junctionsResult.records.map((r) => ({
      id: r.get("id"),
      name: r.get("name"),
      type: "JUNCTION" as const,
      lat: r.get("lat"),
      lng: r.get("lng"),
      platforms: 0 as number,
    }));
    return [...stations, ...junctions];
  } finally {
    await session.close();
  }
}

export async function getStation(id: string) {
  const stations = await getAllStations();
  return stations.find((s) => s.id === id) || null;
}

export async function getStationPlatforms(stationId: string) {
  const station = await getStation(stationId);
  const logs = await PlatformLogModel.find({ station_id: stationId })
    .sort({ platform_number: 1 })
    .lean();
  return {
    station_id: stationId,
    station_name: stationNames[stationId] || stationId,
    total_platforms: station?.platforms || logs.length,
    platforms: logs.map((p) => ({
      number: p.platform_number,
      status: p.status,
      train_id: p.train_id,
      train_length_compatible: true,
    })),
  };
}
