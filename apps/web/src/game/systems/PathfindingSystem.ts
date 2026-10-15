import * as Phaser from 'phaser';

import type { Direction, GridPoint } from '../../domain/index.js';

export interface PathNode extends GridPoint {
  direction: Direction;
}

interface SearchNode extends GridPoint {
  f: number;
  g: number;
  h: number;
  parent?: SearchNode;
}

export class PathfindingSystem {
  private readonly width: number;
  private readonly height: number;
  private readonly isWalkable: (point: GridPoint) => boolean;

  constructor(width: number, height: number, isWalkable: (point: GridPoint) => boolean) {
    this.width = width;
    this.height = height;
    this.isWalkable = isWalkable;
  }

  findPath(start: GridPoint, goal: GridPoint): PathNode[] {
    if (!this.isInside(start) || !this.isInside(goal) || !this.isWalkable(goal)) return [];

    const open = new Map<string, SearchNode>();
    const closed = new Set<string>();
    const startNode: SearchNode = {
      ...start,
      f: manhattan(start, goal),
      g: 0,
      h: manhattan(start, goal),
    };
    open.set(toKey(start), startNode);

    while (open.size > 0) {
      const current = getLowestScoreNode(open);
      if (current.x === goal.x && current.y === goal.y) {
        return toPath(current);
      }

      open.delete(toKey(current));
      closed.add(toKey(current));

      for (const next of this.getNeighbors(current)) {
        const nextKey = toKey(next);
        if (closed.has(nextKey)) continue;

        const g = current.g + 1;
        const existing = open.get(nextKey);
        if (existing && g >= existing.g) continue;

        const h = manhattan(next, goal);
        open.set(nextKey, {
          ...next,
          f: g + h,
          g,
          h,
          parent: current,
        });
      }
    }

    return [];
  }

  private getNeighbors(point: GridPoint): GridPoint[] {
    return [
      { x: point.x, y: point.y - 1 },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x - 1, y: point.y },
    ].filter((candidate) => this.isInside(candidate) && this.isWalkable(candidate));
  }

  private isInside(point: GridPoint) {
    return point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height;
  }
}

export function createPathfindingSystemFromTilemap(
  map: Phaser.Tilemaps.Tilemap,
  blockingLayerNames = ['walls', 'furniture'],
  isExtraBlocked?: (point: GridPoint) => boolean,
) {
  const blocked = new Set<string>();

  blockingLayerNames.forEach((layerName) => {
    const layer = map.getLayer(layerName);
    if (!layer) return;

    layer.data.forEach((row) => {
      row.forEach((tile) => {
        if (tile.index > 0) {
          blocked.add(toKey(tile));
        }
      });
    });
  });

  return new PathfindingSystem(
    map.width,
    map.height,
    (point) => !blocked.has(toKey(point)) && !isExtraBlocked?.(point),
  );
}

function toPath(goal: SearchNode): PathNode[] {
  const nodes: SearchNode[] = [];
  let current: SearchNode | undefined = goal;

  while (current) {
    nodes.unshift(current);
    current = current.parent;
  }

  return nodes.slice(1).map((node, index) => ({
    x: node.x,
    y: node.y,
    direction: getDirection(nodes[index], node),
  }));
}

function getDirection(from: GridPoint, to: GridPoint): Direction {
  if (to.x > from.x) return 'east';
  if (to.x < from.x) return 'west';
  if (to.y < from.y) return 'north';
  return 'south';
}

function getLowestScoreNode(nodes: Map<string, SearchNode>) {
  let lowest: SearchNode | undefined;

  nodes.forEach((node) => {
    if (!lowest || node.f < lowest.f || (node.f === lowest.f && node.h < lowest.h)) {
      lowest = node;
    }
  });

  if (!lowest) {
    throw new Error('Pathfinding open set is empty');
  }

  return lowest;
}

function manhattan(a: GridPoint, b: GridPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function toKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
