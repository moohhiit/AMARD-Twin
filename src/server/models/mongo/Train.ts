import mongoose, { Schema, Document } from "mongoose";
import type { TrainStatus, Position, AgentType } from "../../types";

export interface IScheduleStop {
  station_id: string;
  scheduled_arrival: string;
  scheduled_departure: string;
  halt_minutes: number;
  platform_preference: number | null;
  actual_arrival?: string | null;
  actual_departure?: string | null;
  delay_minutes?: number;
}

export interface ITrainDocument extends Document {
  train_id: string;
  name: string;
  type: string;
  length_meters: number;
  max_speed_kmh: number;
  current_speed_kmh: number;
  status: TrainStatus;
  route: string[];
  current_segment_index: number;
  position: Position;
  scheduled_departure: Date;
  actual_departure: Date;
  delay_minutes: number;
  assigned_platform: number | null;
  current_station: string | null;
  reroute_count: number;
  last_agent_decision: {
    agent: AgentType;
    timestamp: Date;
    reason: string;
  } | null;
  color: string;
  schedule: IScheduleStop[];
  created_at: Date;
  updated_at: Date;
}

const PositionSchema = new Schema(
  {
    from_node: { type: String, required: true },
    to_node: { type: String, required: true },
    progress_percent: { type: Number, required: true, default: 0 },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const ScheduleStopSchema = new Schema<IScheduleStop>(
  {
    station_id:          { type: String, required: true },
    scheduled_arrival:   { type: String, required: true },
    scheduled_departure: { type: String, required: true },
    halt_minutes:        { type: Number, default: 0 },
    platform_preference: { type: Number, default: null },
    actual_arrival:      { type: String, default: null },
    actual_departure:    { type: String, default: null },
    delay_minutes:       { type: Number, default: 0 },
  },
  { _id: false }
);

const TrainSchema = new Schema<ITrainDocument>(
  {
    train_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    length_meters: { type: Number, required: true },
    max_speed_kmh: { type: Number, required: true },
    current_speed_kmh: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["RUNNING", "STOPPED", "WAITING", "ARRIVED", "REROUTING"],
      default: "RUNNING",
    },
    route: { type: [String], required: true },
    current_segment_index: { type: Number, default: 0 },
    position: { type: PositionSchema, required: true },
    scheduled_departure: { type: Date, required: true },
    actual_departure: { type: Date, required: true },
    delay_minutes: { type: Number, default: 0 },
    assigned_platform: { type: Number, default: null },
    current_station: { type: String, default: null },
    reroute_count: { type: Number, default: 0 },
    last_agent_decision: {
      agent: { type: String, enum: ["REROUTING", "PLATFORM"] },
      timestamp: Date,
      reason: String,
      _id: false,
    },
    color: { type: String, required: true },
    schedule: { type: [ScheduleStopSchema], default: [] },
  },
  { timestamps: true }
);

TrainSchema.index({ train_id: 1 }, { unique: true });
TrainSchema.index({ status: 1 });
TrainSchema.index({ "position.from_node": 1, "position.to_node": 1 });
TrainSchema.index({ updated_at: -1 });

export const TrainModel = mongoose.model<ITrainDocument>("Train", TrainSchema);