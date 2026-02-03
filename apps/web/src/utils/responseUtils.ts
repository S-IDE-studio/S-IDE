/**
 * Response Utilities
 *
 * Standardized response handling for client-side API calls
 */

/**
 * Standard API response structure
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Error details structure
 */
export interface ErrorDetails {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Parse error from API response
 */
export function parseAPIError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as { code?: string }).code,
    };
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      message: String(err.message || err.error || "Unknown error"),
      status: typeof err.status === "number" ? err.status : undefined,
      code: typeof err.code === "string" ? err.code : undefined,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const details = parseAPIError(error);
  return (
    details.message.toLowerCase().includes("network") ||
    details.message.toLowerCase().includes("fetch") ||
    details.message.toLowerCase().includes("timeout")
  );
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: unknown): boolean {
  const details = parseAPIError(error);
  return details.status === 401 || details.status === 403;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  const details = parseAPIError(error);
  return details.status === 400 || details.code === "VALIDATION_ERROR";
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: unknown): boolean {
  const details = parseAPIError(error);
  return details.status === 404 || details.code === "NOT_FOUND";
}

/**
 * Check if error is a conflict error
 */
export function isConflictError(error: unknown): boolean {
  const details = parseAPIError(error);
  return details.status === 409 || details.code === "CONFLICT";
}

/**
 * Get user-friendly error message
 */
export function getFriendlyErrorMessage(error: unknown): string {
  const details = parseAPIError(error);

  if (isNetworkError(error)) {
    return "Network error. Please check your connection.";
  }

  if (isAuthError(error)) {
    return "You don't have permission to perform this action.";
  }

  if (isValidationError(error)) {
    return `Invalid input: ${details.message}`;
  }

  if (isNotFoundError(error)) {
    return "The requested resource was not found.";
  }

  if (isConflictError(error)) {
    return "This action conflicts with the current state.";
  }

  return details.message;
}
