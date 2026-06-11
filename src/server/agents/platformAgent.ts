import logger from "../utils/logger";
import { PlatformLogModel } from "../models/mongo/PlatformLog";
import { trackManager } from "../engine/trackManager";
import type { PlatformDecision, WaitDecision, PlatformScore, Platform } from "../types";

interface AgentTrain {
  train_id: string;
  length_meters: number;
  current_speed_kmh: number;
  current_segment_index: number;
  route: string[];
  position: { from_node: string; to_node: string; progress_percent: number };
  assigned_platform: number | null;
  current_station: string | null;
  status: string;
}

export class PlatformAgent {
  private readonly APPROACH_DISTANCE_KM = parseInt(process.env.AGENT_PLATFORM_APPROACH_KM || "10");
  private readonly APPROACH_TIME_MIN = 5;

  async evaluate(train: AgentTrain): Promise<(PlatformDecision | WaitDecision) | null> {
    const nextStation = train.route[train.current_segment_index + 1];
    if (!nextStation) return null;

    // Check if approaching
    const segmentId = this.getSegmentId(train.position.from_node, train.position.to_node);
    const segment = trackManager.getSegment(segmentId);
    if (!segment) return null;

    const distanceToStation = segment.distance_km * (1 - train.position.progress_percent / 100);
    const etaMinutes = train.current_speed_kmh > 0
      ? (distanceToStation / train.current_speed_kmh) * 60
      : 999;

    if (distanceToStation > this.APPROACH_DISTANCE_KM && etaMinutes > this.APPROACH_TIME_MIN) {
      return null;
    }

    // Don't re-assign if already assigned
    if (train.assigned_platform && train.current_station === nextStation) {
      return null;
    }

    // Get platforms
    const platforms = await this.getStationPlatforms(nextStation);
    const availablePlatforms = platforms.filter(
      (p) => p.status === "FREE" && p.length_meters >= train.length_meters
    );

    if (availablePlatforms.length === 0) {
      return {
        action: "WAIT",
        station_id: nextStation,
        reason: `No compatible platform available at ${nextStation} for train ${train.train_id} (${train.length_meters}m)`,
        retry_in_seconds: 10,
      };
    }

    // Score each platform
    const scoredPlatforms = availablePlatforms.map((platform) => {
      const score = this.scorePlatform(platform, train, nextStation);
      return { ...platform, score_breakdown: score, total_score: score.total_score };
    });

    scoredPlatforms.sort((a, b) => b.total_score - a.total_score);
    const best = scoredPlatforms[0];

    logger.info({
      trainId: train.train_id,
      station: nextStation,
      platform: best.number,
      score: best.total_score.toFixed(2),
    }, "Platform agent decision");

    return {
      action: "ASSIGN",
      station_id: nextStation,
      platform_number: best.number,
      score_breakdown: best.score_breakdown,
      reason: `Platform ${best.number} scored best (${best.total_score.toFixed(2)}) - waiting: ${best.score_breakdown.waiting_time_score.toFixed(1)}, congestion: ${best.score_breakdown.congestion_score.toFixed(1)}, length: ${best.score_breakdown.length_compatibility.toFixed(1)}`,
    };
  }

  private scorePlatform(platform: Platform, train: AgentTrain, stationId: string): PlatformScore {
    const waitingTimeScore = Math.min(platform.minutes_free * 0.5, 10);
    const adjacentCongestion = this.getAdjacentCongestion(stationId, platform.number);
    const congestionScore = (1 - adjacentCongestion) * 10;
    const lengthMargin = (platform.length_meters - train.length_meters) / 50;
    const lengthScore = Math.min(lengthMargin, 5);
    const proximityScore = Math.max(0, (5 - platform.number) * 0.5);
    const totalScore = waitingTimeScore + congestionScore + lengthScore + proximityScore;

    return {
      waiting_time_score: Math.round(waitingTimeScore * 10) / 10,
      congestion_score: Math.round(congestionScore * 10) / 10,
      length_compatibility: Math.round(lengthScore * 10) / 10,
      proximity_score: Math.round(proximityScore * 10) / 10,
      total_score: Math.round(totalScore * 10) / 10,
    };
  }

  private async getStationPlatforms(stationId: string): Promise<Platform[]> {
    const logs = await PlatformLogModel.find({ station_id: stationId }).sort({ platform_number: 1 }).lean();
    return logs.map((log) => ({
      number: log.platform_number,
      status: log.status,
      train_id: log.train_id,
      length_meters: log.length_meters,
      minutes_free: log.freed_at
        ? Math.max(0, (Date.now() - new Date(log.freed_at).getTime()) / 60000)
        : 999,
    }));
  }

  private getAdjacentCongestion(stationId: string, _platformNumber: number): number {
    // Get congestion on tracks connected to this station
    const segments = trackManager.getAllSegments().filter(
      (s) => s.from === stationId || s.to === stationId
    );
    if (segments.length === 0) return 0;
    const totalCongestion = segments.reduce((sum, s) => sum + s.congestion_level, 0);
    return totalCongestion / segments.length;
  }

  private getSegmentId(from: string, to: string): string {
    const segments = [
      "MUM-J1-A", "J1-BLR-A", "BLR-CHN-A", "CHN-HYD-A",
      "HYD-J2-A", "J2-DEL-A", "DEL-HYD-B", "BLR-HYD-B",
    ];
    for (const seg of segments) {
      const parts = seg.split("-");
      const segFrom = parts[0];
      const segTo = parts[parts.length - 2];
      if (segFrom === from && segTo === to) return seg;
    }
    return `${from}-${to}-A`;
  }
}

export const platformAgent = new PlatformAgent();
