import logger from "../utils/logger";
import { neo4jSession } from "../config/neo4j";
import { trackManager } from "../engine/trackManager";
import { Neo4jQueries } from "../models/neo4j/queries";
import type { RerouteDecision, PathResult } from "../types";

interface AgentTrain {
  train_id: string;
  delay_minutes: number;
  current_segment_index: number;
  route: string[];
  position: { from_node: string; to_node: string; progress_percent: number };
  current_speed_kmh: number;
  max_speed_kmh: number;
  status: string;
}

export class ReroutingAgent {
  private readonly DELAY_THRESHOLD_MIN = parseInt(process.env.AGENT_REROUTE_DELAY_THRESHOLD || "5");
  private readonly CONGESTION_THRESHOLD = 0.9;
  private lastEvaluationTime: Map<string, number> = new Map();
  private readonly EVALUATION_COOLDOWN_MS = 30000; // 30 seconds

  async evaluate(train: AgentTrain): Promise<RerouteDecision | null> {
    const now = Date.now();
    const lastEval = this.lastEvaluationTime.get(train.train_id) || 0;
    if (now - lastEval < this.EVALUATION_COOLDOWN_MS) return null;

    const segmentId = this.getCurrentSegmentId(train);
    const segment = trackManager.getSegment(segmentId);
    const congestion = segment ? trackManager.getTrainCount(segmentId) / segment.capacity : 0;

    const shouldReroute =
      train.delay_minutes > this.DELAY_THRESHOLD_MIN ||
      (segment && segment.status === "BLOCKED") ||
      (segment && segment.status === "CONGESTED" && congestion >= this.CONGESTION_THRESHOLD);

    if (!shouldReroute) return null;

    const currentNode = train.position.from_node;
    const destination = train.route[train.route.length - 1];
    const remainingRoute = train.route.slice(train.current_segment_index);
    const currentSegments: string[] = [];
    for (let i = 0; i < remainingRoute.length - 1; i++) {
      currentSegments.push(this.getSegmentIdFromNodes(remainingRoute[i], remainingRoute[i + 1]));
    }

    const startTime = Date.now();
    const alternativePaths = await this.findAlternativePaths(currentNode, destination, currentSegments);
    const processingMs = Date.now() - startTime;

    if (alternativePaths.length === 0) {
      logger.info({ trainId: train.train_id }, "No alternative paths found");
      return null;
    }

    // Score paths
    const scoredPaths = alternativePaths.map((path) => ({
      ...path,
      score: this.scorePath(path, train),
    }));
    scoredPaths.sort((a, b) => a.score - b.score);
    const bestPath = scoredPaths[0];

    // Only reroute if improvement is significant (> 2 min savings)
    const currentETA = await this.calculateETA(currentSegments);
    const savings = currentETA - bestPath.estimated_time_min;
    if (savings <= 2) return null;

    this.lastEvaluationTime.set(train.train_id, now);

    const trigger = segment?.status === "BLOCKED"
      ? "BLOCKED"
      : segment?.status === "CONGESTED"
        ? "CONGESTION"
        : "DELAY_THRESHOLD";

    logger.info({
      trainId: train.train_id,
      oldRoute: remainingRoute,
      newRoute: bestPath.path,
      savings: Math.round(savings),
      trigger,
      processingMs,
    }, "Rerouting agent decision");

    return {
      action: "REROUTE",
      new_route: bestPath.path,
      new_segments: bestPath.segments,
      reason: `Current path ${segment?.status === "BLOCKED" ? "blocked" : "congested"}. Alternative saves ${Math.round(savings)} min via ${bestPath.segments.join(" → ")}.`,
      trigger,
      estimated_savings_min: Math.round(savings),
    };
  }

  private async findAlternativePaths(from: string, to: string, avoidSegments: string[]): Promise<PathResult[]> {
    const session = neo4jSession();
    try {
      const result = await session.run(Neo4jQueries.findAlternativePaths, {
        from,
        to,
        avoidSegments,
      });
      return result.records.map((record) => ({
        path: record.get("node_path"),
        segments: record.get("segments"),
        total_distance_km: record.get("total_distance"),
        estimated_time_min: Math.round(record.get("weighted_time") * 60),
        weighted_time: record.get("weighted_time"),
      }));
    } catch (err) {
      logger.error({ err, from, to }, "Error finding alternative paths");
      return [];
    } finally {
      await session.close();
    }
  }

  private scorePath(path: PathResult, _train: AgentTrain): number {
    let score = path.weighted_time;
    score += path.segments.length * 0.05;
    const congestionProneSegments = path.segments.filter(
      (s) => trackManager.getCongestionHistory(s) > 0.7
    );
    score += congestionProneSegments.length * 0.3;
    return score;
  }

  private async calculateETA(segments: string[]): Promise<number> {
    let totalMinutes = 0;
    for (const segId of segments) {
      const seg = trackManager.getSegment(segId);
      if (seg) {
        const timeHours = seg.distance_km / seg.max_speed_kmh;
        totalMinutes += timeHours * 60;
      }
    }
    return totalMinutes;
  }

  private getCurrentSegmentId(train: AgentTrain): string {
    const from = train.position.from_node;
    const to = train.position.to_node;
    return this.getSegmentIdFromNodes(from, to);
  }

  private getSegmentIdFromNodes(from: string, to: string): string {
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

export const reroutingAgent = new ReroutingAgent();
