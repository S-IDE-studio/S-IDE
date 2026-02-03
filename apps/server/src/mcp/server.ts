/**
 * S-IDE MCP Server
 *
 * Custom MCP (Model Context Protocol) server for S-IDE.
 * Handles agent-to-agent communication and shared resource management.
 */

import type { AgentId } from "../types.js";

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage {
  id: string;
  from: AgentId;
  to?: AgentId; // undefined for broadcast
  timestamp: string;
  type: "request" | "response" | "notification";
  content: unknown;
}

/**
 * Agent response
 */
export interface AgentResponse {
  messageId: string;
  from: AgentId;
  success: boolean;
  content?: unknown;
  error?: string;
}

/**
 * Task handoff between agents
 */
export interface TaskHandoff {
  taskId: string;
  from: AgentId;
  to: AgentId;
  context: unknown;
  task: {
    id: string;
    type: "prompt" | "command" | "code" | "custom";
    content: string;
    options?: Record<string, unknown>;
  };
}

/**
 * Shared MCP configuration
 */
export interface SharedMCPConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  sharedWith: AgentId[];
}

/**
 * Shared Skill configuration
 */
export interface SharedSkillConfig {
  id: string;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
  sharedWith: AgentId[];
}

/**
 * S-IDE MCP Server
 *
 * Central server for agent communication and resource sharing
 */
export class SIDEMCPServer {
  // Registered agents and their message handlers
  private agents: Map<AgentId, (message: AgentMessage) => Promise<AgentResponse>> = new Map();

  // Shared resources
  private sharedMCPs: Map<string, SharedMCPConfig> = new Map();
  private sharedSkills: Map<string, SharedSkillConfig> = new Map();

  /**
   * Register an agent with the server
   */
  registerAgent(
    agentId: AgentId,
    handler: (message: AgentMessage) => Promise<AgentResponse>
  ): void {
    this.agents.set(agentId, handler);
  }

  /**
   * Unregister an agent from the server
   */
  unregisterAgent(agentId: AgentId): void {
    this.agents.delete(agentId);
  }

  /**
   * Check if an agent is registered
   */
  hasAgent(agentId: AgentId): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get list of registered agents
   */
  getRegisteredAgents(): AgentId[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(from: AgentId, to: AgentId, content: unknown): Promise<AgentResponse> {
    const handler = this.agents.get(to);
    if (!handler) {
      return {
        messageId: `${from}-${Date.now()}`,
        from,
        success: false,
        error: `Agent ${to} not found`,
      };
    }

    const message: AgentMessage = {
      id: `${from}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from,
      to,
      timestamp: new Date().toISOString(),
      type: "request",
      content,
    };

    return handler(message);
  }

  /**
   * Broadcast a message to all agents (except sender)
   */
  async broadcastMessage(
    from: AgentId,
    content: unknown,
    exclude?: AgentId[]
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    for (const [agentId, handler] of this.agents) {
      // Skip sender and excluded agents
      if (agentId === from || (exclude && exclude.includes(agentId))) {
        continue;
      }

      const message: AgentMessage = {
        id: `${from}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        from,
        timestamp: new Date().toISOString(),
        type: "notification",
        content,
      };

      try {
        const response = await handler(message);
        responses.push(response);
      } catch (error) {
        responses.push({
          messageId: message.id,
          from: agentId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return responses;
  }

  /**
   * Hand off a task from one agent to another
   */
  async handoffTask(handoff: TaskHandoff): Promise<void> {
    // Send handoff notification to target agent
    const handler = this.agents.get(handoff.to);
    if (!handler) {
      throw new Error(`Target agent ${handoff.to} not found`);
    }

    const message: AgentMessage = {
      id: `handoff-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: handoff.from,
      to: handoff.to,
      timestamp: new Date().toISOString(),
      type: "notification",
      content: {
        type: "task-handoff",
        taskId: handoff.taskId,
        from: handoff.from,
        context: handoff.context,
        task: handoff.task,
      },
    };

    await handler(message);
  }

  /**
   * Shared MCP management
   */

  /**
   * Add a shared MCP configuration
   */
  addSharedMCP(config: SharedMCPConfig): void {
    this.sharedMCPs.set(config.id, config);
  }

  /**
   * Remove a shared MCP configuration
   */
  removeSharedMCP(mcpId: string): void {
    this.sharedMCPs.delete(mcpId);
  }

  /**
   * Get a shared MCP configuration
   */
  getSharedMCP(mcpId: string): SharedMCPConfig | undefined {
    return this.sharedMCPs.get(mcpId);
  }

  /**
   * List all shared MCPs
   */
  listSharedMCPs(): SharedMCPConfig[] {
    return Array.from(this.sharedMCPs.values());
  }

  /**
   * Get shared MCPs for a specific agent
   */
  getSharedMCPsForAgent(agentId: AgentId): SharedMCPConfig[] {
    return Array.from(this.sharedMCPs.values()).filter((mcp) => mcp.sharedWith.includes(agentId));
  }

  /**
   * Shared Skill management
   */

  /**
   * Add a shared Skill configuration
   */
  addSharedSkill(config: SharedSkillConfig): void {
    this.sharedSkills.set(config.id, config);
  }

  /**
   * Remove a shared Skill configuration
   */
  removeSharedSkill(skillId: string): void {
    this.sharedSkills.delete(skillId);
  }

  /**
   * Get a shared Skill configuration
   */
  getSharedSkill(skillId: string): SharedSkillConfig | undefined {
    return this.sharedSkills.get(skillId);
  }

  /**
   * List all shared Skills
   */
  listSharedSkills(): SharedSkillConfig[] {
    return Array.from(this.sharedSkills.values());
  }

  /**
   * Get shared Skills for a specific agent
   */
  getSharedSkillsForAgent(agentId: AgentId): SharedSkillConfig[] {
    return Array.from(this.sharedSkills.values()).filter((skill) =>
      skill.sharedWith.includes(agentId)
    );
  }

  /**
   * Update agents when shared resources change
   */
  notifyAgentsOfSharedResourceChange(
    type: "mcp" | "skill",
    resourceId: string,
    excludeAgentId?: AgentId
  ): void {
    const message: AgentMessage = {
      id: `resource-update-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      from: "system" as AgentId,
      timestamp: new Date().toISOString(),
      type: "notification",
      content: {
        type: "resource-update",
        resourceType: type,
        resourceId: resourceId,
      },
    };

    // Send notification to all registered agents
    for (const [agentId, handler] of this.agents) {
      // Skip excluded agent
      if (excludeAgentId && agentId === excludeAgentId) {
        continue;
      }

      // Fire and forget - don't wait for response
      handler(message).catch((error) => {
        console.error(`Failed to notify agent ${agentId} of resource change:`, error);
      });
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.agents.clear();
    this.sharedMCPs.clear();
    this.sharedSkills.clear();
  }
}

// Singleton instance
let mcpServerInstance: SIDEMCPServer | null = null;

/**
 * Get or create the MCP server singleton
 */
export function getMCPServer(): SIDEMCPServer {
  if (!mcpServerInstance) {
    mcpServerInstance = new SIDEMCPServer();
  }
  return mcpServerInstance;
}

/**
 * Reset the MCP server singleton (mainly for testing)
 */
export function resetMCPServer(): void {
  if (mcpServerInstance) {
    mcpServerInstance.dispose();
  }
  mcpServerInstance = null;
}
