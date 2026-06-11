import "dotenv/config";
import mongoose from "mongoose";
import { TrainModel } from "../src/server/models/mongo/Train";
import { PlatformLogModel } from "../src/server/models/mongo/PlatformLog";
import { TrainEventModel } from "../src/server/models/mongo/TrainEvent";
import logger from "../src/server/utils/logger";

const trains = [
  {
    train_id: "101", name: "Mumbai Express", type: "EXPRESS",
    length_meters: 200, max_speed_kmh: 130, current_speed_kmh: 0,
    status: "RUNNING", route: ["MUM", "J1", "BLR", "CHN", "HYD", "J2", "DEL"],
    current_segment_index: 0,
    position: { from_node: "MUM", to_node: "J1", progress_percent: 0, lat: 100, lng: 600 },
    scheduled_departure: new Date(), actual_departure: new Date(),
    delay_minutes: 0, assigned_platform: null, current_station: null,
    reroute_count: 0, last_agent_decision: null, color: "#3B82F6",
  },
  {
    train_id: "102", name: "Deccan Queen", type: "PASSENGER",
    length_meters: 300, max_speed_kmh: 100, current_speed_kmh: 0,
    status: "RUNNING", route: ["MUM", "J1", "BLR", "CHN", "HYD", "J2", "DEL"],
    current_segment_index: 0,
    position: { from_node: "MUM", to_node: "J1", progress_percent: 0, lat: 100, lng: 600 },
    scheduled_departure: new Date(Date.now() + 60000), actual_departure: new Date(Date.now() + 60000),
    delay_minutes: 0, assigned_platform: null, current_station: null,
    reroute_count: 0, last_agent_decision: null, color: "#00E5FF",
  },
  {
    train_id: "103", name: "Rajdhani", type: "EXPRESS",
    length_meters: 250, max_speed_kmh: 140, current_speed_kmh: 0,
    status: "RUNNING", route: ["DEL", "HYD", "CHN"],
    current_segment_index: 0,
    position: { from_node: "DEL", to_node: "HYD", progress_percent: 0, lat: 500, lng: 200 },
    scheduled_departure: new Date(), actual_departure: new Date(),
    delay_minutes: 0, assigned_platform: null, current_station: null,
    reroute_count: 0, last_agent_decision: null, color: "#F472B6",
  },
  {
    train_id: "104", name: "Shatabdi", type: "PASSENGER",
    length_meters: 280, max_speed_kmh: 110, current_speed_kmh: 0,
    status: "RUNNING", route: ["DEL", "HYD", "CHN", "BLR"],
    current_segment_index: 0,
    position: { from_node: "DEL", to_node: "HYD", progress_percent: 0, lat: 500, lng: 200 },
    scheduled_departure: new Date(Date.now() + 120000), actual_departure: new Date(Date.now() + 120000),
    delay_minutes: 0, assigned_platform: null, current_station: null,
    reroute_count: 0, last_agent_decision: null, color: "#F59E0B",
  },
  {
    train_id: "105", name: "Karnataka Exp", type: "EXPRESS",
    length_meters: 220, max_speed_kmh: 120, current_speed_kmh: 0,
    status: "RUNNING", route: ["BLR", "HYD", "J2", "DEL"],
    current_segment_index: 0,
    position: { from_node: "BLR", to_node: "HYD", progress_percent: 0, lat: 300, lng: 650 },
    scheduled_departure: new Date(), actual_departure: new Date(),
    delay_minutes: 0, assigned_platform: null, current_station: null,
    reroute_count: 0, last_agent_decision: null, color: "#10B981",
  },
];

const platformConfigs: Record<string, { platforms: number; lengths: number[] }> = {
  MUM: { platforms: 4, lengths: [400, 350, 300, 250] },
  DEL: { platforms: 6, lengths: [500, 450, 400, 350, 300, 250] },
  CHN: { platforms: 5, lengths: [450, 400, 350, 300, 250] },
  BLR: { platforms: 4, lengths: [400, 350, 300, 250] },
  HYD: { platforms: 3, lengths: [350, 300, 250] },
};

async function seedMongo() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/railway_control";
  await mongoose.connect(uri);
  logger.info("MongoDB connected for seeding");

  try {
    // Clear existing data
    await TrainModel.deleteMany({});
    await PlatformLogModel.deleteMany({});
    await TrainEventModel.deleteMany({});
    logger.info("Cleared existing MongoDB data");

    // Insert trains
    await TrainModel.insertMany(trains);
    logger.info(`Inserted ${trains.length} trains`);

    // Insert platform logs
    const platformLogs: any[] = [];
    for (const [stationId, config] of Object.entries(platformConfigs)) {
      for (let i = 0; i < config.platforms; i++) {
        platformLogs.push({
          station_id: stationId,
          platform_number: i + 1,
          train_id: null,
          status: "FREE",
          assigned_by: "SYSTEM",
          assigned_at: null,
          freed_at: new Date(),
          length_meters: config.lengths[i],
        });
      }
    }
    await PlatformLogModel.insertMany(platformLogs);
    logger.info(`Inserted ${platformLogs.length} platform logs`);

    logger.info("MongoDB seed complete!");
  } catch (err) {
    logger.error({ err }, "MongoDB seed failed");
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

seedMongo().then(() => process.exit(0)).catch(() => process.exit(1));
