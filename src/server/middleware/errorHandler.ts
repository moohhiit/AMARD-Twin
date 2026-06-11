import type { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  logger.error({ err, statusCode, code }, "Request error");
  res.status(statusCode).json({
    error: err.message || "Internal server error",
    code,
    statusCode,
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
}
