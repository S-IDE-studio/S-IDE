/**
 * API Utilities
 *
 * Common utilities for API interactions
 */

const DEFAULT_TIMEOUT = 15000;

/**
 * Wraps a promise with timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Standard API error handler
 */
export interface APIError {
  message: string;
  status?: number;
}

export function handleAPIError(error: unknown): APIError {
  if (error instanceof Error) {
    return {
      message: error.message,
      status: (error as APIError).status,
    };
  }
  return {
    message: "An unknown error occurred",
  };
}

/**
 * Standard fetch wrapper with error handling
 */
export async function fetchAPI<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: APIError }> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      const message = await response.text();
      return {
        error: {
          message: message || `Request failed (${response.status})`,
          status: response.status,
        },
      };
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { data: undefined as T };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: handleAPIError(error) };
  }
}

/**
 * POST request helper
 */
export async function postAPI<T>(
  url: string,
  body: unknown
): Promise<{ data?: T; error?: APIError }> {
  return fetchAPI<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function putAPI<T>(
  url: string,
  body: unknown
): Promise<{ data?: T; error?: APIError }> {
  return fetchAPI<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 */
export async function deleteAPI<T>(url: string): Promise<{ data?: T; error?: APIError }> {
  return fetchAPI<T>(url, {
    method: "DELETE",
  });
}
