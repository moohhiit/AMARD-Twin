export const Neo4jQueries = {
  // Seed data
  createStation: `
    MERGE (s:Station {id: $id})
    SET s.name = $name, s.type = 'STATION', s.lat = $lat, s.lng = $lng, s.platforms = $platforms
  `,
  createJunction: `
    MERGE (j:Junction {id: $id})
    SET j.name = $name, j.type = 'JUNCTION', j.lat = $lat, j.lng = $lng
  `,
  createTrack: `
    MATCH (a {id: $from}), (b {id: $to})
    MERGE (a)-[r:CONNECTED_TO {segment_id: $segment_id}]->(b)
    SET r.distance_km = $distance_km, r.max_speed_kmh = $max_speed_kmh,
        r.capacity = $capacity, r.status = 'OPEN', r.direction = $direction
  `,
  // Read queries
  getAllStations: `MATCH (s:Station) RETURN s.id as id, s.name as name, s.lat as lat, s.lng as lng, s.platforms as platforms`,
  getAllJunctions: `MATCH (j:Junction) RETURN j.id as id, j.name as name, j.lat as lat, j.lng as lng`,
  getAllTracks: `
    MATCH (a)-[r:CONNECTED_TO]->(b)
    RETURN r.segment_id as segment_id, a.id as from, b.id as to,
           r.distance_km as distance_km, r.max_speed_kmh as max_speed_kmh,
           r.capacity as capacity, r.status as status, r.direction as direction
  `,
  getTrack: `
    MATCH (a)-[r:CONNECTED_TO {segment_id: $segment_id}]->(b)
    RETURN r.segment_id as segment_id, a.id as from, b.id as to,
           r.distance_km as distance_km, r.max_speed_kmh as max_speed_kmh,
           r.capacity as capacity, r.status as status, r.direction as direction
  `,
  updateTrackStatus: `
    MATCH ()-[r:CONNECTED_TO {segment_id: $segment_id}]->()
    SET r.status = $status
  `,
  // Pathfinding
  findAlternativePaths: `
    MATCH path = (start {id: $from})-[:CONNECTED_TO*1..10]->(end {id: $to})
    WHERE ALL(r IN relationships(path) WHERE NOT r.segment_id IN $avoidSegments)
    WITH path,
         reduce(total = 0, r IN relationships(path) |
           total + (r.distance_km / r.max_speed_kmh) *
           CASE r.status
             WHEN 'CONGESTED' THEN 2.0
             WHEN 'BLOCKED' THEN 100.0
             ELSE 1.0
           END
         ) AS weighted_time,
         reduce(total = 0, r IN relationships(path) | total + r.distance_km) AS total_distance
    RETURN [n IN nodes(path) | n.id] AS node_path,
           [r IN relationships(path) | r.segment_id] AS segments,
           total_distance,
           weighted_time
    ORDER BY weighted_time ASC
    LIMIT 5
  `,
  // Get segment between two nodes
  getSegmentBetween: `
    MATCH (a {id: $from})-[r:CONNECTED_TO]->(b {id: $to})
    RETURN r.segment_id as segment_id, r.distance_km as distance_km,
           r.max_speed_kmh as max_speed_kmh, r.capacity as capacity, r.status as status
  `,
  // Get station platforms count
  getStationPlatforms: `
    MATCH (s:Station {id: $id})
    RETURN s.platforms as platforms
  `,
  // Shortest path (Dijkstra)
  shortestPath: `
    MATCH (start {id: $from}), (end {id: $to})
    MATCH path = shortestPath((start)-[:CONNECTED_TO*]->(end))
    RETURN [n IN nodes(path) | n.id] AS node_path,
           [r IN relationships(path) | r.segment_id] AS segments,
           reduce(total = 0, r IN relationships(path) | total + r.distance_km) AS total_distance,
           reduce(total = 0, r IN relationships(path) | total + (r.distance_km / r.max_speed_kmh)) AS estimated_time
  `,
  // Clear all data
  clearAll: `MATCH (n) DETACH DELETE n`,
};
