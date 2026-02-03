/**
 * Response Utilities
 *
 * Standardized response formatting for API routes
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getErrorMessage } from "./error.js";

/**
 * Standard API response format
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Create a success response
 */
export function successResponse<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200
): Response {
  return c.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    } as APIResponse<T>,
    status
  );
}

/**
 * Create an error response
 */
export function errorResponse(
  c: Context,
  message: string,
  status: ContentfulStatusCode = 500,
  code?: string
): Response {
  return c.json(
    {
      error: message,
      ...(code && { code }),
    } as ErrorResponse,
    status
  );
}

/**
 * Handle errors with standardized response
 */
export function handleResponseError(c: Context, error: unknown, productionMode = false): Response {
  const status = (error as { status?: number })?.status ?? 500;
  const message = getErrorMessage(error) || "Unexpected error";

  if (productionMode && status === 500) {
    return errorResponse(c, "Internal server error", 500, "INTERNAL_ERROR");
  }

  return errorResponse(c, message, status as ContentfulStatusCode);
}

/**
 * Create a validation error response
 */
export function validationError(c: Context, field: string, message: string): Response {
  return errorResponse(c, `Validation failed for ${field}: ${message}`, 400, "VALIDATION_ERROR");
}

/**
 * Create a not found error response
 */
export function notFoundError(c: Context, resource: string): Response {
  return errorResponse(c, `${resource} not found`, 404, "NOT_FOUND");
}

/**
 * Create a conflict error response
 */
export function conflictError(c: Context, message: string): Response {
  return errorResponse(c, message, 409, "CONFLICT");
}

/**
 * Create an unauthorized error response
 */
export function unauthorizedError(c: Context, message = "Unauthorized"): Response {
  return errorResponse(c, message, 401, "UNAUTHORIZED");
}

/**
 * Create a forbidden error response
 */
export function forbiddenError(c: Context, message = "Forbidden"): Response {
  return errorResponse(c, message, 403, "FORBIDDEN");
}
