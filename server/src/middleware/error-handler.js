import mongoose from "mongoose";
import { HttpError } from "../utils/http-error.js";

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, "Route not found"));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  let status = error.status ?? 500;
  let message = error.message ?? "Internal server error";
  let details = error.details;

  if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Database validation failed";
    details = Object.fromEntries(
      Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
    );
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${error.path}`;
  } else if (error?.code === 11000) {
    status = 409;
    message = "A record with these details already exists";
  }

  if (status >= 500) {
    console.error("Request failed", {
      method: req.method,
      path: req.originalUrl,
      error,
    });
    if (!(error instanceof HttpError)) message = "Internal server error";
  }

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}
