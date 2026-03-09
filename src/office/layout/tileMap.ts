import { Direction, TileType } from '../types.js';

/** Check if a tile is walkable (floor, carpet, or doorway, and not blocked by furniture) */
export function isWalkable(
  col: number,
  row: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const t = tileMap[row][col];
  if (t === TileType.WALL || t === TileType.VOID) return false;
  if (blockedTiles.has(`${col},${row}`)) return false;
  return true;
}

/** Get walkable tile positions (grid coords) for wandering */
export function getWalkableTiles(
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  const tiles: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isWalkable(c, r, tileMap, blockedTiles)) {
        tiles.push({ col: c, row: r });
      }
    }
  }
  return tiles;
}

interface FindPathOptions {
  turnPreference?: number;
  startDir?: Direction;
}

const MOVE_DIRS: Array<{ dc: number; dr: number; dir: Direction }> = [
  { dc: 0, dr: -1, dir: Direction.UP },
  { dc: 0, dr: 1, dir: Direction.DOWN },
  { dc: -1, dr: 0, dir: Direction.LEFT },
  { dc: 1, dr: 0, dir: Direction.RIGHT },
];

const BASE_STEP_COST = 100;
const MAX_TURN_BIAS = 60;

/** Weighted path search. Returns path excluding start, including end. */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  options?: FindPathOptions,
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return [];

  const key = (c: number, r: number, dir: Direction | 'start') => `${c},${r},${dir}`;
  const startDir = options?.startDir ?? Direction.DOWN;
  const turnPreference = Math.max(0, Math.min(100, options?.turnPreference ?? 50));
  const startKey = key(startCol, startRow, 'start');

  const endWalkable = isWalkable(endCol, endRow, tileMap, blockedTiles);
  if (!endWalkable) return [];

  type State = {
    col: number;
    row: number;
    dir: Direction | 'start';
    prevDir: Direction;
    steps: number;
    turns: number;
    cost: number;
  };

  const frontier: State[] = [
    { col: startCol, row: startRow, dir: 'start', prevDir: startDir, steps: 0, turns: 0, cost: 0 },
  ];
  const parent = new Map<string, string>();
  const best = new Map<string, { cost: number; steps: number; turns: number }>();
  best.set(startKey, { cost: 0, steps: 0, turns: 0 });

  function isBetter(
    nextCost: number,
    nextSteps: number,
    nextTurns: number,
    existing: { cost: number; steps: number; turns: number } | undefined,
  ): boolean {
    if (!existing) return true;
    if (nextCost !== existing.cost) return nextCost < existing.cost;
    if (nextSteps !== existing.steps) return nextSteps < existing.steps;
    return nextTurns < existing.turns;
  }

  while (frontier.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < frontier.length; i++) {
      const a = frontier[i];
      const b = frontier[bestIndex];
      if (a.cost < b.cost) {
        bestIndex = i;
        continue;
      }
      if (a.cost === b.cost) {
        if (a.steps < b.steps || (a.steps === b.steps && a.turns < b.turns)) {
          bestIndex = i;
        }
      }
    }
    const current = frontier.splice(bestIndex, 1)[0];
    if (current.col === endCol && current.row === endRow) {
      const path: Array<{ col: number; row: number }> = [];
      let currentKey = key(current.col, current.row, current.dir);
      while (currentKey !== startKey) {
        const [c, r] = currentKey.split(',').map(Number);
        path.unshift({ col: c, row: r });
        const prevKey = parent.get(currentKey);
        if (!prevKey) break;
        currentKey = prevKey;
      }
      return path;
    }

    for (const move of MOVE_DIRS) {
      const nextCol = current.col + move.dc;
      const nextRow = current.row + move.dr;
      if (!isWalkable(nextCol, nextRow, tileMap, blockedTiles)) continue;

      const nextSteps = current.steps + 1;
      const turning =
        current.dir === 'start' ? move.dir !== current.prevDir : move.dir !== current.dir;
      const nextTurns = current.turns + (turning ? 1 : 0);
      const bias = Math.round(((turnPreference - 50) / 50) * MAX_TURN_BIAS);
      const stepCost = turning ? BASE_STEP_COST - bias : BASE_STEP_COST + bias;
      const nextCost = current.cost + Math.max(1, stepCost);
      const nextKey = key(nextCol, nextRow, move.dir);
      const existing = best.get(nextKey);
      if (!isBetter(nextCost, nextSteps, nextTurns, existing)) continue;

      best.set(nextKey, { cost: nextCost, steps: nextSteps, turns: nextTurns });
      parent.set(nextKey, key(current.col, current.row, current.dir));
      frontier.push({
        col: nextCol,
        row: nextRow,
        dir: move.dir,
        prevDir: move.dir,
        steps: nextSteps,
        turns: nextTurns,
        cost: nextCost,
      });
    }
  }

  return [];
}
