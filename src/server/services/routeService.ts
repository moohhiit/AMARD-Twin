import { neo4jSession } from "../config/neo4j";
import { Neo4jQueries } from "../models/neo4j/queries";

export async function findShortestPath(from: string, to: string) {
  const session = neo4jSession();
  try {
    const result = await session.run(Neo4jQueries.shortestPath, { from, to });
    if (result.records.length === 0) return null;
    const record = result.records[0];
    return {
      from,
      to,
      algorithm: "dijkstra",
      path: record.get("node_path"),
      segments: record.get("segments"),
      total_distance_km: record.get("total_distance"),
      estimated_time_min: Math.round(record.get("estimated_time") * 60),
      congestion_risk: "MEDIUM",
    };
  } finally {
    await session.close();
  }
}

export async function findFastestPath(from: string, to: string) {
  // Use the weighted pathfinding query
  const session = neo4jSession();
  try {
    const query = `
      MATCH path = (start {id: $from})-[:CONNECTED_TO*]->(end {id: $to})
      WITH path,
           reduce(total = 0, r IN relationships(path) |
             total + (r.distance_km / r.max_speed_kmh) *
             CASE r.status
               WHEN 'CONGESTED' THEN 2.0
               WHEN 'BLOCKED' THEN 100.0
               ELSE 1.0
             END
           ) AS weighted_time
      RETURN [n IN nodes(path) | n.id] AS node_path,
             [r IN relationships(path) | r.segment_id] AS segments,
             reduce(total = 0, r IN relationships(path) | total + r.distance_km) AS total_distance,
             weighted_time
      ORDER BY weighted_time ASC
      LIMIT 1
    `;
    const result = await session.run(query, { from, to });
    if (result.records.length === 0) return null;
    const record = result.records[0];
    return {
      from,
      to,
      algorithm: "astar",
      path: record.get("node_path"),
      segments: record.get("segments"),
      total_distance_km: record.get("total_distance"),
      estimated_time_min: Math.round(record.get("weighted_time") * 60),
      congestion_risk: "LOW",
    };
  } finally {
    await session.close();
  }
}
