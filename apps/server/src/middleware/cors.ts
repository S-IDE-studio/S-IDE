import type { MiddlewareHandler } from "hono";
import { CORS_ORIGIN, NODE_ENV } from "../config.js";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  
  if (CORS_ORIGIN) {
    c.header("Access-Control-Allow-Origin", CORS_ORIGIN);
    c.header("Access-Control-Allow-Credentials", "true");
  } else if (NODE_ENV === "development" && origin) {
    // In development, allow requests from localhost origins
    // Cannot use * with credentials, must use specific origin
    if (origin.includes("localhost") || origin.includes("127.0.0.1") || origin.startsWith("tauri://")) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    }
  } else if (NODE_ENV === "development") {
    // Fallback for non-credentialed requests
    c.header("Access-Control-Allow-Origin", "*");
  }
  
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  
  await next();
};
