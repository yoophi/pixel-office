import type { Agent, AgentId, AgentStatus, Direction } from './agent.js';
import type { GridPoint, SeatId } from './office.js';

export type AgentEvent =
  | {
      type: 'agent:upsert';
      agent: Agent;
    }
  | {
      type: 'agent:remove';
      agentId: AgentId;
    }
  | {
      type: 'agent:status';
      agentId: AgentId;
      status: AgentStatus;
      updatedAt: number;
    }
  | {
      type: 'agent:move';
      agentId: AgentId;
      destination: GridPoint;
      direction?: Direction;
      updatedAt: number;
    }
  | {
      type: 'agent:seat';
      agentId: AgentId;
      seatId: SeatId | null;
      updatedAt: number;
    }
  | {
      type: 'agent:say';
      agentId: AgentId;
      message: string;
      durationMs: number;
      updatedAt: number;
    };
