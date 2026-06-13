import logger from "../utils/logger";
import { neo4jSession } from "../config/neo4j";
import { Neo4jQueries } from "../models/neo4j/queries";
import type { TrackSegment, CongestionSeverity } from "../types";

export class TrackManager {
  private segmentOccupancy: Map<string, Set<string>> = new Map();
  private segmentCache: Map<string, TrackSegment> = new Map();
  private congestionHistory: Map<string, { average_level: number }> = new Map();

  registerTrainOnSegment(trainId: string, segmentId: string): void {
    if (!this.segmentOccupancy.has(segmentId)) {
      this.segmentOccupancy.set(segmentId, new Set());
    }
    this.segmentOccupancy.get(segmentId)!.add(trainId);
  }

  removeTrainFromSegment(trainId: string, segmentId: string): void {
    const set = this.segmentOccupancy.get(segmentId);
    if (set) {
      set.delete(trainId);
      if (set.size === 0) {
        this.segmentOccupancy.delete(segmentId);
      }
    }
  }

  getTrainsOnSegment(segmentId: string): string[] {
    return Array.from(this.segmentOccupancy.get(segmentId) || []);
  }

  getTrainCount(segmentId: string): number {
    return this.segmentOccupancy.get(segmentId)?.size || 0;
  }

  checkCongestion(segmentId: string, capacity: number): { level: number; severity: CongestionSeverity } {
    const count = this.getTrainCount(segmentId);
    const level = capacity > 0 ? count / capacity : 0;
    let severity: CongestionSeverity = "LOW";
    if (level >= 1) severity = "CRITICAL";
    else if (level >= 0.9) severity = "HIGH";
    else if (level >= 0.7) severity = "MEDIUM";
    else if (level >= 0.5) severity = "LOW";
    return { level, severity };
  }

  async loadSegments(): Promise<void> {
    const session = neo4jSession();
    try {
      const result = await session.run(Neo4jQueries.getAllTracks);
      this.segmentCache.clear();
      for (const record of result.records) {
        const seg: TrackSegment = {
          segment_id: record.get("segment_id"),
          from: record.get("from"),
          to: record.get("to"),
          distance_km: record.get("distance_km"),
          max_speed_kmh: record.get("max_speed_kmh"),
          capacity: record.get("capacity"),
          status: record.get("status"),
          direction: record.get("direction"),
          current_trains: 0,
          congestion_level: 0,
        };
        this.segmentCache.set(seg.segment_id, seg);
      }
      logger.info(`Loaded ${this.segmentCache.size} track segments`);
    } finally {
      await session.close();
    }
  }

  getSegment(segmentId: string): TrackSegment | undefined {
    return this.segmentCache.get(segmentId);
  }

  getAllSegments(): TrackSegment[] {
    return Array.from(this.segmentCache.values());
  }

  async updateSegmentStatus(segmentId: string, status: "OPEN" | "CONGESTED" | "BLOCKED"): Promise<void> {
    const seg = this.segmentCache.get(segmentId);
    if (seg && seg.status !== status) {
      seg.status = status;
      const session = neo4jSession();
      try {
        await session.run(Neo4jQueries.updateTrackStatus, { segment_id: segmentId, status });
      } finally {
        await session.close();
      }
    }
  }

  async blockSegment(segmentId: string, reason?: string): Promise<void> {
    await this.updateSegmentStatus(segmentId, "BLOCKED");
    logger.warn({ segmentId, reason }, "Track segment blocked");
  }

  async openSegment(segmentId: string): Promise<void> {
    await this.updateSegmentStatus(segmentId, "OPEN");
    logger.info({ segmentId }, "Track segment opened");
  }

  updateCongestionHistory(segmentId: string, level: number): void {
    const existing = this.congestionHistory.get(segmentId);
    if (existing) {
      existing.average_level = (existing.average_level * 0.9) + (level * 0.1);
    } else {
      this.congestionHistory.set(segmentId, { average_level: level });
    }
  }

  getCongestionHistory(segmentId: string): number {
    return this.congestionHistory.get(segmentId)?.average_level || 0;
  }
}

export const trackManager = new TrackManager();
