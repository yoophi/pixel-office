import type { AgentEvent, AgentId, GridPoint } from '../domain/index.js';

export type Unsubscribe = () => void;

export type GameBusEventMap = Record<string, unknown>;

export interface PixelOfficeGameEvents extends GameBusEventMap {
  'agent:event': AgentEvent;
  'game:ready': { readyAt: number };
  'ui:agent-selected': { agentId: AgentId | null };
  'ui:tileset-selected': { variantId: string };
  'demo:obstacles-set': { obstacles: GridPoint[]; goal?: GridPoint };
}

export class GameBus<Events extends GameBusEventMap> {
  private readonly handlers: {
    [EventName in keyof Events]?: Set<(payload: Events[EventName]) => void>;
  } = {};

  on<EventName extends keyof Events>(
    eventName: EventName,
    handler: (payload: Events[EventName]) => void,
  ): Unsubscribe {
    const handlers = this.handlers[eventName] ?? new Set<(payload: Events[EventName]) => void>();
    handlers.add(handler);
    this.handlers[eventName] = handlers;

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        delete this.handlers[eventName];
      }
    };
  }

  emit<EventName extends keyof Events>(eventName: EventName, payload: Events[EventName]) {
    this.handlers[eventName]?.forEach((handler) => handler(payload));
  }

  clear() {
    Object.keys(this.handlers).forEach((eventName) => {
      delete this.handlers[eventName as keyof Events];
    });
  }
}

export const gameBus = new GameBus<PixelOfficeGameEvents>();
