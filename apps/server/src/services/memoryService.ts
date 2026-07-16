import type { AgentMemoryPage, AgentMemoryType } from "../lib/agentClient.ts";
import {
  clearAgentMemory,
  deleteAgentMemory,
  listAgentMemories,
} from "../lib/agentClient.ts";
import { agentUserId } from "../lib/agentUserId.ts";

export type MemoryTypeDto = AgentMemoryType;
export type MemoryPageDto = AgentMemoryPage;

export const memoryService = {
  list(
    userSub: string,
    options: {
      q?: string;
      kind?: MemoryTypeDto;
      limit?: number;
      offset?: number;
    },
  ): Promise<MemoryPageDto> {
    return listAgentMemories(agentUserId(userSub), options);
  },

  async delete(
    userSub: string,
    kind: MemoryTypeDto,
    itemId: string,
  ): Promise<{ status: "deleted" }> {
    await deleteAgentMemory(agentUserId(userSub), kind, itemId);
    return { status: "deleted" };
  },

  async clear(
    userSub: string,
  ): Promise<{ status: "cleared"; removed: number }> {
    const removed = await clearAgentMemory(agentUserId(userSub));
    return { status: "cleared", removed };
  },
};
