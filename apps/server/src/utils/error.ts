import {
  createHttpError as sharedCreateHttpError,
  getErrorMessage as sharedGetErrorMessage,
} from "@side-ide/shared/utils-node";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { NODE_ENV } from "../config.js";
import type { HttpError } from "../types.js";

export type { HttpError };

export function createHttpError(message: string, status: number): HttpError {
  return sharedCreateHttpError(message, status) as HttpError;
}

export function getErrorMessage(error: unknown): string {
  return sharedGetErrorMessage(error);
}

export function handleError(c: Context, error: unknown) {
  const status = ((error as HttpError)?.status ?? 500) as ContentfulStatusCode;
  const message = getErrorMessage(error) || "Unexpected error";
  if (NODE_ENV === "production" && status === 500) {
    return c.json({ error: "Internal server error" }, status);
  }
  return c.json({ error: message }, status);
}

export async function readJson<T>(c: Context): Promise<T> {
  // Validate Content-Type header for security
  const contentType = c.req.header("content-type");
  if (!contentType?.includes("application/json")) {
    throw createHttpError("Content-Type must be application/json", 415);
  }

  try {
    return await c.req.json<T>();
  } catch (error) {
    // Log parse errors in development for debugging
    if (NODE_ENV === "development") {
      console.warn("JSON parse error:", getErrorMessage(error));
    }
    throw createHttpError("Invalid JSON in request body", 400);
  }
}
