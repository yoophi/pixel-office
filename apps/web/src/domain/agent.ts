import type { GridPoint, SeatId } from './office.js';

export type AgentId = string;

export type AgentStatus =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'sitting'
  | 'thinking'
  | 'offline';

export type Direction = 'north' | 'east' | 'south' | 'west';

export interface Agent {
  id: AgentId;
  name: string;
  status: AgentStatus;
  color?: string;
  direction?: Direction;
  position?: GridPoint;
  destination?: GridPoint;
  seatId?: SeatId;
  message?: string;
  updatedAt: number;
}

export interface AgentVisualState {
  animation: 'idle' | 'walk' | 'type' | 'sit';
  visible: boolean;
  direction: Direction;
  speechText?: string;
}
