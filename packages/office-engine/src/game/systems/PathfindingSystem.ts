import type * as Phaser from 'phaser';
import { PathfindingSystem } from '@pixel-office/core/pathfinding';
import type { GridPoint } from '@pixel-office/core';
export { PathfindingSystem } from '@pixel-office/core/pathfinding';
export type { PathNode } from '@pixel-office/core/pathfinding';

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

function toKey(point: GridPoint) { return `${point.x}:${point.y}`; }
