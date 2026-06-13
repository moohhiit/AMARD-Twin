import { trackManager } from "../engine/trackManager";

export async function getAllTracks() {
  return trackManager.getAllSegments().map((seg) => ({
    segment_id: seg.segment_id,
    from: seg.from,
    to: seg.to,
    distance_km: seg.distance_km,
    max_speed_kmh: seg.max_speed_kmh,
    capacity: seg.capacity,
    status: seg.status,
    direction: seg.direction,
    current_trains: seg.current_trains,
    congestion_level: Math.round(seg.congestion_level * 100) / 100,
  }));
}

export async function getTrack(segmentId: string) {
  return trackManager.getSegment(segmentId);
}

export async function updateTrackStatus(segmentId: string, status: "OPEN" | "CONGESTED" | "BLOCKED") {
  await trackManager.updateSegmentStatus(segmentId, status);
  return { segment_id: segmentId, status };
}

export async function getCongestedTracks() {
  return trackManager.getAllSegments().filter((s) => s.status === "CONGESTED" || s.status === "BLOCKED");
}
