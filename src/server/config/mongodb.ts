import mongoose from "mongoose";
import logger from "../utils/logger";

export async function initMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/railway_control";
  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error({ err }, "MongoDB connection failed");
    throw err;
  }
}

export async function closeMongoDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}
