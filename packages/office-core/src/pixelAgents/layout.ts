// pixel-agents `OfficeLayout` 형식과 가구 배치·이동 제약.
// 규칙 원본: pixel-agents webview-ui/src/office/{types.ts, layout/layoutSerializer.ts, layout/tileMap.ts, editor/editorActions.ts}

import type { FurnitureCatalog, FurnitureCatalogEntry } from './manifest.js';

export const PIXEL_AGENTS_TILE_SIZE = 16;

export const TileType = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  FLOOR_8: 8,
  FLOOR_9: 9,
  VOID: 255,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Photoshop Colorize 스타일 HSL 값. h 0-360, s 0-100, b/c -100~100. */
export interface ColorValue {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
}

export interface PlacedFurniture {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: ColorValue;
}

export interface OfficeLayout {
  version: 1;
  cols: number;
  rows: number;
  tiles: TileType[];
  furniture: PlacedFurniture[];
  tileColors?: Array<ColorValue | null>;
  layoutRevision?: number;
}

export type Facing = 'north' | 'south' | 'east' | 'west';

export interface LayoutSeat {
  uid: string;
  furnitureUid: string;
  col: number;
  row: number;
  facing: Facing;
}

export interface FurnitureDrawInstance {
  uid: string;
  type: string;
  entry: FurnitureCatalogEntry;
  /** 스프라이트 좌상단 (월드 px) */
  x: number;
  y: number;
  zY: number;
  mirrored: boolean;
}

export const tileKey = (col: number, row: number) => `${col},${row}`;

export function getTile(layout: OfficeLayout, col: number, row: number): TileType {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return TileType.VOID;
  return layout.tiles[row * layout.cols + col];
}

function footprintTiles(entry: FurnitureCatalogEntry, col: number, row: number, skipBackgroundRows: boolean) {
  const tiles: Array<[number, number]> = [];
  const bgRows = skipBackgroundRows ? entry.backgroundTiles : 0;
  for (let dr = bgRows; dr < entry.footprintH; dr++) {
    for (let dc = 0; dc < entry.footprintW; dc++) tiles.push([col + dc, row + dr]);
  }
  return tiles;
}

/** 가구 footprint 중 background 행을 제외한 타일 — 보행 차단과 배치 충돌 모두 이 집합을 씁니다. */
export function getBlockedTiles(layout: OfficeLayout, catalog: FurnitureCatalog, excludeUid?: string): Set<string> {
  const tiles = new Set<string>();
  for (const item of layout.furniture) {
    if (item.uid === excludeUid) continue;
    const entry = catalog.get(item.type);
    if (!entry) continue;
    for (const [c, r] of footprintTiles(entry, item.col, item.row, true)) tiles.add(tileKey(c, r));
  }
  return tiles;
}

function getDeskTiles(layout: OfficeLayout, catalog: FurnitureCatalog, excludeUid?: string): Set<string> {
  const tiles = new Set<string>();
  for (const item of layout.furniture) {
    if (item.uid === excludeUid) continue;
    const entry = catalog.get(item.type);
    if (!entry?.isDesk) continue;
    for (const [c, r] of footprintTiles(entry, item.col, item.row, false)) tiles.add(tileKey(c, r));
  }
  return tiles;
}

export type PlacementFailure = 'unknown-type' | 'out-of-bounds' | 'needs-wall' | 'on-wall-or-void' | 'overlap';

/**
 * manifest 제약에 따른 배치 가능 여부.
 * - canPlaceOnWalls: footprint 맨 아래 행만 WALL 타일이어야 하고, 윗행은 맵 밖·VOID로 걸쳐도 됩니다.
 * - 그 외: background 행을 뺀 footprint가 WALL/VOID에 닿으면 안 됩니다.
 * - background 행은 다른 가구와 겹쳐도 됩니다(책상 위 모니터·벽 앞 식물).
 * - canPlaceOnSurfaces: desks 카테고리 footprint 위에서는 충돌로 보지 않습니다.
 */
export function checkPlacement(
  layout: OfficeLayout,
  catalog: FurnitureCatalog,
  type: string,
  col: number,
  row: number,
  excludeUid?: string,
): PlacementFailure | null {
  const entry = catalog.get(type);
  if (!entry) return 'unknown-type';

  const bottomRow = row + entry.footprintH - 1;
  if (col < 0 || col + entry.footprintW > layout.cols) return 'out-of-bounds';
  if (entry.canPlaceOnWalls ? bottomRow < 0 || bottomRow >= layout.rows : row < 0 || bottomRow >= layout.rows) {
    return 'out-of-bounds';
  }

  for (let dr = entry.backgroundTiles; dr < entry.footprintH; dr++) {
    if (row + dr < 0) continue;
    if (entry.canPlaceOnWalls && dr < entry.footprintH - 1) continue;
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const tile = getTile(layout, col + dc, row + dr);
      if (entry.canPlaceOnWalls) {
        if (tile !== TileType.WALL) return 'needs-wall';
      } else if (tile === TileType.WALL || tile === TileType.VOID) {
        return 'on-wall-or-void';
      }
    }
  }

  const occupied = getBlockedTiles(layout, catalog, excludeUid);
  const deskTiles = entry.canPlaceOnSurfaces ? getDeskTiles(layout, catalog, excludeUid) : undefined;
  for (let dr = entry.backgroundTiles; dr < entry.footprintH; dr++) {
    if (row + dr < 0) continue;
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const key = tileKey(col + dc, row + dr);
      if (occupied.has(key) && !deskTiles?.has(key)) return 'overlap';
    }
  }
  return null;
}

export function isWalkable(layout: OfficeLayout, blocked: ReadonlySet<string>, col: number, row: number): boolean {
  const tile = getTile(layout, col, row);
  if (tile === TileType.WALL || tile === TileType.VOID) return false;
  return !blocked.has(tileKey(col, row));
}

/** 4방향 BFS. 시작 타일 제외, 도착 타일 포함. 도달 불가면 빈 배열. */
export function findPath(
  layout: OfficeLayout,
  blocked: ReadonlySet<string>,
  from: { col: number; row: number },
  to: { col: number; row: number },
): Array<{ col: number; row: number }> {
  if (from.col === to.col && from.row === to.row) return [];
  if (!isWalkable(layout, blocked, to.col, to.row)) return [];
  const startKey = tileKey(from.col, from.row);
  const endKey = tileKey(to.col, to.row);
  const parent = new Map<string, string | null>([[startKey, null]]);
  const queue: Array<[number, number]> = [[from.col, from.row]];
  const steps: Array<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (let head = 0; head < queue.length; head++) {
    const [c, r] = queue[head];
    if (tileKey(c, r) === endKey) break;
    for (const [dc, dr] of steps) {
      const nc = c + dc;
      const nr = r + dr;
      const key = tileKey(nc, nr);
      if (parent.has(key) || !isWalkable(layout, blocked, nc, nr)) continue;
      parent.set(key, tileKey(c, r));
      queue.push([nc, nr]);
    }
  }
  if (!parent.has(endKey)) return [];
  const path: Array<{ col: number; row: number }> = [];
  for (let key: string | null = endKey; key && key !== startKey; key = parent.get(key) ?? null) {
    const [c, r] = key.split(',').map(Number);
    path.push({ col: c, row: r });
  }
  return path.reverse();
}

function orientationToFacing(orientation: string): Facing {
  switch (orientation) {
    case 'back':
      return 'north';
    case 'left':
      return 'west';
    case 'right':
    case 'side':
      return 'east';
    default:
      return 'south';
  }
}

/**
 * chairs 카테고리의 background 행 아래 footprint 타일이 모두 좌석이 됩니다.
 * 방향 우선순위: 의자 orientation → 인접한 desks 타일 → south.
 */
export function layoutToSeats(layout: OfficeLayout, catalog: FurnitureCatalog): LayoutSeat[] {
  const deskTiles = getDeskTiles(layout, catalog);
  const neighbors: Array<{ dc: number; dr: number; facing: Facing }> = [
    { dc: 0, dr: -1, facing: 'north' },
    { dc: 0, dr: 1, facing: 'south' },
    { dc: -1, dr: 0, facing: 'west' },
    { dc: 1, dr: 0, facing: 'east' },
  ];
  const seats: LayoutSeat[] = [];
  for (const item of layout.furniture) {
    const entry = catalog.get(item.type);
    if (entry?.category !== 'chairs') continue;
    let index = 0;
    for (const [c, r] of footprintTiles(entry, item.col, item.row, true)) {
      let facing: Facing = 'south';
      if (entry.orientation) {
        facing = orientationToFacing(entry.orientation);
      } else {
        facing = neighbors.find((n) => deskTiles.has(tileKey(c + n.dc, r + n.dr)))?.facing ?? 'south';
      }
      seats.push({ uid: index === 0 ? item.uid : `${item.uid}:${index}`, furnitureUid: item.uid, col: c, row: r, facing });
      index++;
    }
  }
  return seats;
}

/** 가구 z 정렬값 — 의자는 앉은 캐릭터보다 뒤(등받이는 앞), surface 가구는 받친 책상보다 앞. */
export function layoutToDrawInstances(layout: OfficeLayout, catalog: FurnitureCatalog): FurnitureDrawInstance[] {
  const T = PIXEL_AGENTS_TILE_SIZE;
  const deskZByTile = new Map<string, number>();
  for (const item of layout.furniture) {
    const entry = catalog.get(item.type);
    if (!entry?.isDesk) continue;
    const deskZ = item.row * T + entry.height;
    for (const [c, r] of footprintTiles(entry, item.col, item.row, false)) {
      const key = tileKey(c, r);
      deskZByTile.set(key, Math.max(deskZByTile.get(key) ?? -Infinity, deskZ));
    }
  }

  const instances: FurnitureDrawInstance[] = [];
  for (const item of layout.furniture) {
    const entry = catalog.get(item.type);
    if (!entry) continue;
    const x = item.col * T;
    const y = item.row * T;
    let zY = y + entry.height;
    if (entry.category === 'chairs') {
      zY = entry.orientation === 'back' ? (item.row + entry.footprintH) * T + 1 : (item.row + 1) * T;
    }
    if (entry.canPlaceOnSurfaces) {
      for (const [c, r] of footprintTiles(entry, item.col, item.row, false)) {
        const deskZ = deskZByTile.get(tileKey(c, r));
        if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5;
      }
    }
    instances.push({ uid: item.uid, type: item.type, entry, x, y, zY, mirrored: entry.mirrored });
  }
  return instances;
}
