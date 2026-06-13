import { Server as SocketIOServer } from "socket.io";
import logger from "../utils/logger";
import { simulator } from "../engine/simulator";

class SocketService {
  private io: SocketIOServer | null = null;

  init(io: SocketIOServer): void {
    this.io = io;
    this.setupListeners();
    logger.info("Socket.IO service initialized");
  }

  private setupListeners(): void {
    if (!this.io) return;
    this.io.on("connection", (socket) => {
      logger.info({ socketId: socket.id }, "Client connected");

      socket.on("client:subscribe:train", ({ train_id }: { train_id: string }) => {
        socket.join(`train:${train_id}`);
        logger.debug({ socketId: socket.id, train_id }, "Subscribed to train");
      });

      socket.on("client:unsubscribe:train", ({ train_id }: { train_id: string }) => {
        socket.leave(`train:${train_id}`);
      });

      socket.on("client:subscribe:all", () => {
        socket.join("all");
      });
      socket.on("client:control:pause", () => {
        simulator.pause();
      });
      socket.on("client:control:resume", () => {
        simulator.resume();
      });
      socket.on("disconnect", () => {
        logger.info({ socketId: socket.id }, "Client disconnected");
      });
    });
  }

  emit(event: string, data: unknown): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }
}

export const socketService = new SocketService();
