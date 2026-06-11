import mongoose, { Schema, Document } from "mongoose";
import type { EventType, EventSource } from "../../types";

export interface ITrainEventDocument extends Document {
  event_id: string;
  train_id: string;
  event_type: EventType;
  details: {
    station_id?: string;
    platform_number?: number;
    old_route?: string[];
    new_route?: string[];
    segment_id?: string;
    delay_minutes?: number;
    speed_kmh?: number;
    reason?: string;
  };
  source: EventSource;
  timestamp: Date;
  created_at: Date;
}

const TrainEventSchema = new Schema<ITrainEventDocument>(
  {
    event_id: { type: String, required: true, unique: true },
    train_id: { type: String, required: true },
    event_type: {
      type: String,
      enum: [
        "DEPARTURE",
        "ARRIVAL",
        "REROUTE",
        "PLATFORM_ASSIGNED",
        "CONGESTION_DETECTED",
        "DELAY_UPDATED",
        "TRACK_BLOCKED",
        "SPEED_CHANGE",
        "WAITING",
        "RESUMED",
      ],
      required: true,
    },
    details: {
      station_id: String,
      platform_number: Number,
      old_route: [String],
      new_route: [String],
      segment_id: String,
      delay_minutes: Number,
      speed_kmh: Number,
      reason: String,
    },
    source: {
      type: String,
      enum: ["ENGINE", "REROUTING_AGENT", "PLATFORM_AGENT", "SYSTEM"],
      required: true,
    },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true }
);

TrainEventSchema.index({ train_id: 1, timestamp: -1 });
TrainEventSchema.index({ event_type: 1 });
TrainEventSchema.index({ source: 1 });
TrainEventSchema.index({ timestamp: -1 });

export const TrainEventModel = mongoose.model<ITrainEventDocument>("TrainEvent", TrainEventSchema);
