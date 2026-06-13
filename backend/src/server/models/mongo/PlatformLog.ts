import mongoose, { Schema, Document } from "mongoose";
import type { PlatformStatus } from "../../types";

export interface IPlatformLogDocument extends Document {
  station_id: string;
  platform_number: number;
  train_id: string | null;
  status: PlatformStatus;
  assigned_by: "PLATFORM_AGENT" | "MANUAL" | "SYSTEM";
  assigned_at: Date | null;
  freed_at: Date | null;
  length_meters: number;
  timestamp: Date;
}

const PlatformLogSchema = new Schema<IPlatformLogDocument>(
  {
    station_id: { type: String, required: true },
    platform_number: { type: Number, required: true },
    train_id: { type: String, default: null },
    status: {
      type: String,
      enum: ["OCCUPIED", "FREE", "RESERVED"],
      default: "FREE",
    },
    assigned_by: {
      type: String,
      enum: ["PLATFORM_AGENT", "MANUAL", "SYSTEM"],
      default: "SYSTEM",
    },
    assigned_at: { type: Date, default: null },
    freed_at: { type: Date, default: null },
    length_meters: { type: Number, default: 400 },
  },
  { timestamps: true }
);

PlatformLogSchema.index({ station_id: 1, platform_number: 1 });
PlatformLogSchema.index({ status: 1 });

export const PlatformLogModel = mongoose.model<IPlatformLogDocument>("PlatformLog", PlatformLogSchema);
