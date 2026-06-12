// ═══════════════════════════════════════════════════════════════════
// CHANGE 2 — src/server/engine/weatherEngine.ts
// ENHANCEMENT: Weather tick rate now scales with simulation speed.
// At 1× → updates every 30 s real time (same as before).
// At 10× → updates every 3 s real time (10× more often, matching sim pace).
// At 50× → every 600 ms.
// Also adds setSimulationSpeed() so simulator.setSpeed() can notify it.
// ═══════════════════════════════════════════════════════════════════

// src/server/engine/weatherEngine.ts
import { socketService } from "../services/socketService";
import type { WeatherCondition, WeatherType, WeatherUpdateEvent } from "../types";

export const WEATHER_PROFILES: Record<WeatherType, WeatherCondition> = {
  CLEAR: {
    type:               "CLEAR",
    speed_multiplier:   1.0,
    risk_level:         "LOW",
    delay_probability:  0.02,
    braking_multiplier: 1.0,
    visibility_km:      100,
    description:        "Clear skies — full speed",
  },
  RAIN: {
    type:               "RAIN",
    speed_multiplier:   0.80,
    risk_level:         "MEDIUM",
    delay_probability:  0.25,
    braking_multiplier: 1.30,
    visibility_km:      15,
    description:        "Rain — reduced speed, longer braking",
  },
  FOG: {
    type:               "FOG",
    speed_multiplier:   0.60,
    risk_level:         "HIGH",
    delay_probability:  0.50,
    braking_multiplier: 1.50,
    visibility_km:      2,
    description:        "Dense fog — speed severely reduced",
  },
  STORM: {
    type:               "STORM",
    speed_multiplier:   0.45,
    risk_level:         "CRITICAL",
    delay_probability:  0.80,
    braking_multiplier: 1.80,
    visibility_km:      0.5,
    description:        "Storm — near-halt, high delay risk",
  },
};

const segmentWeather: Map<string, WeatherCondition> = new Map();
const transitionTimers: Map<string, NodeJS.Timeout> = new Map();

const TRANSITION_MATRIX: Record<WeatherType, Record<WeatherType, number>> = {
  CLEAR: { CLEAR: 0.94, RAIN: 0.04, FOG:  0.015, STORM: 0.005 },
  RAIN:  { CLEAR: 0.10, RAIN: 0.78, FOG:  0.05,  STORM: 0.07  },
  FOG:   { CLEAR: 0.15, RAIN: 0.05, FOG:  0.75,  STORM: 0.05  },
  STORM: { CLEAR: 0.02, RAIN: 0.20, FOG:  0.03,  STORM: 0.75  },
};

export class WeatherEngine {
  private timer: NodeJS.Timeout | null = null;

  // ── NEW: track simulation speed to scale tick frequency ──────────────────
  private simulationSpeed = 1;

  /** Called by Simulator.setSpeed() — reschedules the weather tick */
  setSimulationSpeed(speed: number): void {
    this.simulationSpeed = speed;
    if (this.timer) {
      // Restart timer with new interval
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), this.getIntervalMs());
    }
  }

  /** Real-wall-clock ms between weather updates (scales with sim speed) */
  private getIntervalMs(): number {
    // Base: 30 s at 1×. At N× speed, weather changes N× faster in sim time,
    // so wall-clock interval shrinks proportionally.
    return Math.max(500, Math.round(30_000 / this.simulationSpeed));
  }

  init(segmentIds: string[]): void {
    for (const id of segmentIds) {
      const roll = Math.random();
      let initial: WeatherType;
      if (roll < 0.70)      initial = "CLEAR";
      else if (roll < 0.88) initial = "RAIN";
      else if (roll < 0.96) initial = "FOG";
      else                  initial = "STORM";
      segmentWeather.set(id, { ...WEATHER_PROFILES[initial] });
    }
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), this.getIntervalMs());
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    for (const t of transitionTimers.values()) clearTimeout(t);
    transitionTimers.clear();
  }

  getWeather(segmentId: string): WeatherCondition {
    return segmentWeather.get(segmentId) ?? { ...WEATHER_PROFILES.CLEAR };
  }

  getAllWeather(): Map<string, WeatherCondition> {
    return segmentWeather;
  }

  setWeather(segmentId: string, type: WeatherType): void {
    const old  = segmentWeather.get(segmentId);
    const newW = { ...WEATHER_PROFILES[type] };
    segmentWeather.set(segmentId, newW);
    this.emitWeatherUpdate(segmentId, newW);
    if (old?.type !== type) {
      socketService.emit("system:alert", {
        severity:  type === "STORM" ? "CRITICAL" : type === "FOG" ? "WARNING" : "INFO",
        message:   `Weather change on ${segmentId}: ${type}`,
        detail:    newW.description,
        timestamp: Date.now(),
      });
    }
  }

  private tick(): void {
    for (const [segmentId, current] of segmentWeather.entries()) {
      const transitions = TRANSITION_MATRIX[current.type];
      const roll = Math.random();
      let cumulative = 0;
      for (const [nextType, prob] of Object.entries(transitions) as [WeatherType, number][]) {
        cumulative += prob;
        if (roll < cumulative) {
          if (nextType !== current.type) {
            const newW = { ...WEATHER_PROFILES[nextType] };
            segmentWeather.set(segmentId, newW);
            this.emitWeatherUpdate(segmentId, newW);
          }
          break;
        }
      }
    }
  }

  private emitWeatherUpdate(segmentId: string, weather: WeatherCondition): void {
    const evt: WeatherUpdateEvent = {
      segment_id: segmentId,
      weather,
      timestamp: new Date().toISOString(),
    };
    socketService.emit("weather:update", evt);
  }
}

export const weatherEngine = new WeatherEngine();