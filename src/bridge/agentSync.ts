import type { Agent, AgentEvent, AgentId, AgentStatus, GridPoint, SeatId } from '../domain/index.js';
import { gameBus, type GameBus, type PixelOfficeGameEvents, type Unsubscribe } from './gameBus.js';

export interface AgentSyncController {
  upsertAgent(agent: Agent): void;
  removeAgent(agentId: AgentId): void;
  setAgentStatus(agentId: AgentId, status: AgentStatus): void;
  moveAgent(agentId: AgentId, destination: GridPoint): void;
  assignSeat(agentId: AgentId, seatId: SeatId | null): void;
  showSpeech(agentId: AgentId, message: string, durationMs: number): void;
}

export class AgentSync {
  private readonly controller: AgentSyncController;
  private readonly bus: GameBus<PixelOfficeGameEvents>;
  private unsubscribe?: Unsubscribe;

  constructor(
    controller: AgentSyncController,
    bus: GameBus<PixelOfficeGameEvents> = gameBus,
  ) {
    this.controller = controller;
    this.bus = bus;
  }

  start(): Unsubscribe {
    this.stop();
    this.unsubscribe = this.bus.on('agent:event', (event) => this.handleAgentEvent(event));
    return () => this.stop();
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private handleAgentEvent(event: AgentEvent) {
    switch (event.type) {
      case 'agent:upsert':
        this.controller.upsertAgent(event.agent);
        break;
      case 'agent:remove':
        this.controller.removeAgent(event.agentId);
        break;
      case 'agent:status':
        this.controller.setAgentStatus(event.agentId, event.status);
        break;
      case 'agent:move':
        this.controller.moveAgent(event.agentId, event.destination);
        break;
      case 'agent:seat':
        this.controller.assignSeat(event.agentId, event.seatId);
        break;
      case 'agent:say':
        this.controller.showSpeech(event.agentId, event.message, event.durationMs);
        break;
    }
  }
}

export function startAgentSync(
  controller: AgentSyncController,
  bus: GameBus<PixelOfficeGameEvents> = gameBus,
): Unsubscribe {
  return new AgentSync(controller, bus).start();
}
