import type { Agent, AgentEvent } from '@pixel-office/core';

const statuses = new Set(['idle', 'walking', 'typing', 'sitting', 'thinking', 'offline']);
const directions = new Set(['north', 'east', 'south', 'west']);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown) => object(value) && Number.isInteger(value.x) && Number.isInteger(value.y) && Number(value.x) >= 0 && Number(value.y) >= 0;

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!object(value)) return false;
  if (value.type === 'agent:upsert') {
    const a = value.agent;
    return object(a) && text(a.id) && typeof a.name === 'string' && typeof a.status === 'string' && statuses.has(a.status) && time(a.updatedAt)
      && (a.position === undefined || point(a.position)) && (a.destination === undefined || point(a.destination))
      && (a.direction === undefined || (typeof a.direction === 'string' && directions.has(a.direction)))
      && (a.seatId === undefined || typeof a.seatId === 'string')
      && (a.message === undefined || typeof a.message === 'string')
      && (a.color === undefined || typeof a.color === 'string');
  }
  if (!text(value.agentId)) return false;
  if (value.type === 'agent:remove') return true;
  if (!time(value.updatedAt)) return false;
  switch (value.type) {
    case 'agent:status': return typeof value.status === 'string' && statuses.has(value.status);
    case 'agent:move': return point(value.destination) && (value.direction === undefined || (typeof value.direction === 'string' && directions.has(value.direction)));
    case 'agent:seat': return value.seatId === null || typeof value.seatId === 'string';
    case 'agent:say': return typeof value.message === 'string' && time(value.durationMs) && value.durationMs >= 0;
    default: return false;
  }
}

// Phaser가 준비되기 전에 도착한 이벤트도 순서를 유지해 전달합니다.
export class AgentEventInbox {
  private pending: AgentEvent[] = [];
  private ready = false;
  private agents = new Map<string, Agent>();
  private snapshot: readonly Agent[] = [];
  private listeners = new Set<() => void>();
  private readonly deliver: (event: AgentEvent) => void;
  constructor(deliver: (event: AgentEvent) => void) { this.deliver = deliver; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  accept(value: unknown): boolean {
    if (!isAgentEvent(value) || (!this.ready && this.pending.length >= 1024)) return false;
    if (value.type === 'agent:upsert') this.agents.set(value.agent.id, { ...value.agent });
    else if (value.type === 'agent:remove') this.agents.delete(value.agentId);
    else {
      const agent = this.agents.get(value.agentId);
      if (agent) {
        if (value.type === 'agent:status') agent.status = value.status;
        if (value.type === 'agent:move') agent.destination = value.destination;
        if (value.type === 'agent:say') agent.message = value.message;
        if (value.type === 'agent:seat') agent.seatId = value.seatId ?? undefined;
        agent.updatedAt = value.updatedAt;
      }
    }
    this.snapshot = [...this.agents.values()].map((agent) => ({ ...agent }));
    if (this.ready) this.deliver(value);
    else this.pending.push(value);
    this.listeners.forEach((listener) => listener());
    return true;
  }
  markReady() {
    if (this.ready) return;
    this.ready = true;
    this.pending.splice(0).forEach(this.deliver);
  }
  dispose() {
    this.ready = false;
    this.pending = [];
    this.agents.clear();
    this.snapshot = [];
    this.listeners.clear();
  }
}
