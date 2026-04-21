import * as Phaser from 'phaser';

import type { AgentId, Direction, Seat, SeatId } from '../../domain/index.js';

export class SeatAssignmentSystem {
  private readonly seats: readonly Seat[];
  private readonly assignments = new Map<SeatId, AgentId>();

  constructor(seats: readonly Seat[]) {
    this.seats = seats;
  }

  assignSeat(agentId: AgentId, preferredSeatId?: SeatId): Seat | undefined {
    this.releaseAgent(agentId);

    const seat = this.findAvailableSeat(preferredSeatId);
    if (!seat) return undefined;

    this.assignments.set(seat.id, agentId);
    return seat;
  }

  releaseAgent(agentId: AgentId) {
    this.assignments.forEach((assignedAgentId, seatId) => {
      if (assignedAgentId === agentId) {
        this.assignments.delete(seatId);
      }
    });
  }

  getAssignedAgent(seatId: SeatId) {
    return this.assignments.get(seatId);
  }

  getSeats() {
    return [...this.seats];
  }

  private findAvailableSeat(preferredSeatId?: SeatId) {
    if (preferredSeatId) {
      const preferred = this.seats.find((seat) => seat.id === preferredSeatId);
      if (preferred && !this.assignments.has(preferred.id)) {
        return preferred;
      }
    }

    return this.seats.find((seat) => !this.assignments.has(seat.id));
  }
}

export function createSeatAssignmentSystemFromTilemap(map: Phaser.Tilemaps.Tilemap) {
  const objectLayer = map.getObjectLayer('objects');
  const seats = objectLayer?.objects.filter(isSeatObject).map((object) => toSeat(object, map.tileWidth)) ?? [];
  return new SeatAssignmentSystem(seats);
}

function isSeatObject(object: Phaser.Types.Tilemaps.TiledObject) {
  return object.type === 'seat' || getStringProperty(object, 'role') === 'seat';
}

function toSeat(object: Phaser.Types.Tilemaps.TiledObject, tileSize: number): Seat {
  return {
    id: object.name,
    position: {
      x: Math.floor((object.x ?? 0) / tileSize),
      y: Math.floor((object.y ?? 0) / tileSize),
    },
    facing: getDirectionProperty(object, 'facing') ?? 'south',
  };
}

function getStringProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string) {
  const properties = object.properties as Array<{ name: string; value: unknown }> | undefined;
  const value = properties?.find((property) => property.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

function getDirectionProperty(object: Phaser.Types.Tilemaps.TiledObject, name: string): Direction | undefined {
  const value = getStringProperty(object, name);
  if (value === 'north' || value === 'east' || value === 'south' || value === 'west') {
    return value;
  }
  return undefined;
}
