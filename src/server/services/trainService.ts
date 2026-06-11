import { TrainModel } from "../models/mongo/Train";
import { TrainEventModel } from "../models/mongo/TrainEvent";
import { simulator } from "../engine/simulator";
import logger from "../utils/logger";

export async function getAllTrains() {
  const trains = await TrainModel.find().lean();
  const simTrains = simulator.getTrains();
  return trains.map((t) => {
    const sim = simTrains.get(t.train_id);
    return {
      train_id: t.train_id,
      name: t.name,
      status: sim?.status || t.status,
      current_speed_kmh: sim?.current_speed_kmh || t.current_speed_kmh,
      delay_minutes: sim?.delay_minutes ?? t.delay_minutes,
      position: sim?.position || t.position,
      assigned_platform: sim?.assigned_platform ?? t.assigned_platform,
      current_station: sim?.current_station ?? t.current_station,
      reroute_count: t.reroute_count,
      route: sim?.route || t.route,
      color: t.color,
      type: t.type,
      max_speed_kmh: t.max_speed_kmh,
    };
  });
}

export async function getTrainById(trainId: string) {
  const train = await TrainModel.findOne({ train_id: trainId }).lean();
  if (!train) return null;
  const sim = simulator.getTrains().get(trainId);
  return {
    ...train,
    status: sim?.status || train.status,
    current_speed_kmh: sim?.current_speed_kmh || train.current_speed_kmh,
    delay_minutes: sim?.delay_minutes ?? train.delay_minutes,
    position: sim?.position || train.position,
    assigned_platform: sim?.assigned_platform ?? train.assigned_platform,
    current_station: sim?.current_station ?? train.current_station,
    route: sim?.route || train.route,
  };
}

export async function getTrainLive(trainId: string) {
  const sim = simulator.getTrains().get(trainId);
  if (!sim) return null;
  const fromNode = sim.route[sim.current_segment_index];
  const toNode = sim.route[Math.min(sim.current_segment_index + 1, sim.route.length - 1)];
  return {
    train_id: sim.train_id,
    timestamp: new Date().toISOString(),
    position: sim.position,
    speed_kmh: sim.current_speed_kmh,
    status: sim.status,
    delay_minutes: Math.round(sim.delay_minutes * 10) / 10,
    current_segment: `${fromNode}-${toNode}-A`,
    next_station: toNode,
    distance_to_next_km: 0,
  };
}

export async function getTrainEvents(trainId: string, limit = 50) {
  return TrainEventModel.find({ train_id: trainId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

export async function getTrainRoute(trainId: string) {
  const train = await TrainModel.findOne({ train_id: trainId }).lean();
  if (!train) return null;
  const sim = simulator.getTrains().get(trainId);
  const route = sim?.route || train.route;
  const segments: string[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    segments.push(`${route[i]}-${route[i + 1]}-A`);
  }
  return { train_id: trainId, route, segments };
}

export async function updateTrainSpeed(trainId: string, speed: number) {
  const sim = simulator.getTrains().get(trainId);
  if (sim) {
    sim.max_speed_kmh = speed;
  }
  await TrainModel.updateOne({ train_id: trainId }, { $set: { max_speed_kmh: speed } });
  logger.info({ trainId, speed }, "Train speed updated");
  return { train_id: trainId, new_speed: speed };
}

export async function updateTrainStatus(trainId: string, status: string) {
  const sim = simulator.getTrains().get(trainId);
  if (sim) {
    sim.status = status as any;
  }
  await TrainModel.updateOne({ train_id: trainId }, { $set: { status } });
  return { train_id: trainId, new_status: status };
}
