/**
 * Shell API Routes
 *
 * Provides endpoints for discovering and managing shells
 */

import { Hono } from "hono";
import { handleError } from "../utils/error.js";
import {
  clearShellCache,
  getShellById,
  getShells,
  getDefaultShellId as getSystemDefaultShellId,
  scanShells,
} from "../utils/shells.js";
import { getDefaultShellId, setDefaultShellId } from "../utils/user-settings.js";

export function createShellsRouter() {
  const router = new Hono();

  /**
   * GET /api/shells/available
   * Get list of available shells on the system
   */
  router.get("/available", async (c) => {
    try {
      const shells = await getShells();

      // Get user's default shell preference
      const userDefaultShellId = await getDefaultShellId();

      return c.json({
        shells,
        defaultShell: userDefaultShellId || getSystemDefaultShellId(),
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * POST /api/shells/refresh
   * Rescan system for available shells
   */
  router.post("/refresh", async (c) => {
    try {
      // Clear cache and rescan
      clearShellCache();
      const shells = await scanShells();

      const userDefaultShellId = await getDefaultShellId();

      return c.json({
        shells,
        defaultShell: userDefaultShellId || getSystemDefaultShellId(),
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/shells/default
   * Get the current default shell
   */
  router.get("/default", async (c) => {
    try {
      const userDefaultShellId = await getDefaultShellId();
      const defaultShellId = userDefaultShellId || getSystemDefaultShellId();
      const shell = await getShellById(defaultShellId);

      if (!shell) {
        // If the configured shell doesn't exist, return the system default
        const systemDefaultId = getSystemDefaultShellId();
        const systemDefaultShell = await getShellById(systemDefaultId);
        return c.json({
          id: systemDefaultId,
          ...systemDefaultShell,
          isUserConfigured: false,
        });
      }

      return c.json({
        ...shell,
        isUserConfigured: !!userDefaultShellId,
      });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * PUT /api/shells/default
   * Set the default shell
   */
  router.put("/default", async (c) => {
    try {
      const body = await c.req.json<{ shellId: string }>();
      const { shellId } = body;

      if (!shellId || typeof shellId !== "string") {
        return c.json({ error: "shellId is required" }, 400);
      }

      // Verify the shell exists
      const shell = await getShellById(shellId);
      if (!shell) {
        return c.json({ error: "Shell not found" }, 404);
      }

      // Save to user settings
      await setDefaultShellId(shellId);

      return c.json({ success: true, shell });
    } catch (error) {
      return handleError(c, error);
    }
  });

  /**
   * GET /api/shells/:id
   * Get details for a specific shell
   */
  router.get("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const shell = await getShellById(id);

      if (!shell) {
        return c.json({ error: "Shell not found" }, 404);
      }

      return c.json(shell);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
