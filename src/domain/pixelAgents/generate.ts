// pixtuoid 레이아웃 규칙(pixtuoid-scene/src/layout/compute.rs)을 pixel-agents 타일·가구로 옮긴 오피스 생성기.
// - (cols, rows, seed)의 순수 함수이고, 같은 키는 memo로 재사용합니다.
// - 좌측 방(회의실/탕비실) + 칸막이 벽 + 우측 책상 pod 구역 + 하단 복도.
// - 책상 순서는 pod 행 → pod 열 → pod 안 좌→우로 고정합니다.
// - 모든 가구는 manifest 제약(checkPlacement)을 통과해야 놓이고, 공간이 부족하면 생략합니다.

import type { FurnitureCatalog } from './manifest.js';
import {
  checkPlacement,
  getBlockedTiles,
  getTile,
  isWalkable,
  layoutToSeats,
  TileType,
  type ColorValue,
  type LayoutSeat,
  type OfficeLayout,
  type PlacementFailure,
} from './layout.js';

export type FloorVariant = 'standard' | 'open' | 'dense';

export interface Workstation {
  index: number;
  deskUid: string;
  pcUid?: string;
  seat: LayoutSeat;
}

export type WaypointKind = 'lounge' | 'meeting' | 'pantry' | 'corridor';

export interface Waypoint {
  kind: WaypointKind;
  col: number;
  row: number;
  /** 좌석이면 앉을 방향, 서 있는 지점이면 undefined */
  seat?: LayoutSeat;
}

export interface SkippedFurniture {
  type: string;
  col: number;
  row: number;
  reason: PlacementFailure | 'room-too-small';
}

export interface GeneratedOffice {
  seed: number;
  variant: FloorVariant;
  layout: OfficeLayout;
  workstations: Workstation[];
  waypoints: Waypoint[];
  entry: { col: number; row: number };
  skipped: SkippedFurniture[];
}

const WALL_COLOR: ColorValue = { h: 214, s: 30, b: -100, c: -55 };
const BAND_FLOOR_COLOR: ColorValue = { h: 209, s: 39, b: -25, c: -80 };
const MEETING_FLOOR_COLOR: ColorValue = { h: 25, s: 48, b: -43, c: -88 };
const PANTRY_FLOOR_COLOR: ColorValue = { h: 35, s: 30, b: -10, c: -40 };
const CORRIDOR_FLOOR_COLOR: ColorValue = { h: 209, s: 0, b: -16, c: -8 };

/** pod = 책상 2개(각 3×2) + 벤치 행 → 6×3 타일. 사이 통로는 가로 2칸, 세로 1칸. */
const WORKSTATION_W = 3;
const POD_WORKSTATIONS = 2;
const POD_W = WORKSTATION_W * POD_WORKSTATIONS;
const POD_H = 3;
const INTER_POD_AISLE_X = 2;
const INTER_POD_AISLE_Y = 1;
const CORRIDOR_ROWS = 2;
/** 좌측 방 폭이 이보다 작으면 방을 만들지 않고 책상 구역에 넘깁니다. */
const LEFT_ROOM_MIN_W = 6;
const LEFT_ROOM_MIN_H = 3;

interface VariantGeometry {
  leftPct: number;
  hasMeeting: boolean;
  hasPantry: boolean;
}

const VARIANTS: Record<FloorVariant, VariantGeometry> = {
  standard: { leftPct: 38, hasMeeting: true, hasPantry: true },
  open: { leftPct: 30, hasMeeting: false, hasPantry: true },
  dense: { leftPct: 26, hasMeeting: true, hasPantry: false },
};

const VARIANT_ORDER: FloorVariant[] = ['standard', 'open', 'dense'];

export function variantFromSeed(seed: number): FloorVariant {
  return VARIANT_ORDER[Math.abs(Math.trunc(seed)) % VARIANT_ORDER.length];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

class LayoutBuilder {
  readonly layout: OfficeLayout;
  readonly skipped: SkippedFurniture[] = [];
  private uidCounter = 0;
  private readonly catalog: FurnitureCatalog;

  constructor(cols: number, rows: number, catalog: FurnitureCatalog) {
    this.catalog = catalog;
    this.layout = {
      version: 1,
      cols,
      rows,
      tiles: new Array<TileType>(cols * rows).fill(TileType.VOID),
      tileColors: new Array<ColorValue | null>(cols * rows).fill(null),
      furniture: [],
      layoutRevision: 1,
    };
  }

  setTile(col: number, row: number, tile: TileType, color: ColorValue | null) {
    if (col < 0 || row < 0 || col >= this.layout.cols || row >= this.layout.rows) return;
    const index = row * this.layout.cols + col;
    this.layout.tiles[index] = tile;
    this.layout.tileColors![index] = color;
  }

  fill(rect: Rect, tile: TileType, color: ColorValue | null) {
    for (let r = rect.y; r < rect.y + rect.h; r++) {
      for (let c = rect.x; c < rect.x + rect.w; c++) this.setTile(c, r, tile, color);
    }
  }

  place(type: string, col: number, row: number): string | undefined {
    const failure = checkPlacement(this.layout, this.catalog, type, col, row);
    if (failure) {
      this.skipped.push({ type, col, row, reason: failure });
      return undefined;
    }
    const uid = `gen-${type.replace(':', '-').toLowerCase()}-${this.uidCounter++}`;
    this.layout.furniture.push({ uid, type, col, row });
    return uid;
  }

  skip(type: string, col: number, row: number) {
    this.skipped.push({ type, col, row, reason: 'room-too-small' });
  }
}

export function generateOfficeLayout(
  cols: number,
  rows: number,
  seed: number,
  catalog: FurnitureCatalog,
): GeneratedOffice | null {
  // 벽 스프라이트(16×32)와 벽걸이 윗행을 위한 VOID 1행 + 뒷벽 1행 + 통로 1행 + pod 1개 + 복도.
  if (cols < 2 + WORKSTATION_W + 2 || rows < 3 + POD_H + CORRIDOR_ROWS) return null;

  const variant = variantFromSeed(seed);
  const geometry = VARIANTS[variant];
  const random = mulberry32(seed * 0x9e3779b1 + 1);
  const b = new LayoutBuilder(cols, rows, catalog);

  const interiorW = cols - 2;
  const roomsTop = 2;
  const roomsBottom = rows - 1 - CORRIDOR_ROWS;
  const roomsH = roomsBottom - roomsTop + 1;

  // 외곽: 0행 VOID, 1행 뒷벽, 좌우 벽. 앞(아래)은 열린 입구.
  b.fill({ x: 0, y: 1, w: cols, h: rows - 1 }, TileType.WALL, WALL_COLOR);
  b.fill({ x: 1, y: roomsTop, w: interiorW, h: rows - roomsTop }, TileType.FLOOR_1, BAND_FLOOR_COLOR);
  b.fill({ x: 1, y: roomsBottom + 1, w: interiorW, h: CORRIDOR_ROWS }, TileType.FLOOR_9, CORRIDOR_FLOOR_COLOR);

  let leftW = geometry.hasMeeting || geometry.hasPantry ? Math.round((interiorW * geometry.leftPct) / 100) : 0;
  if (leftW < LEFT_ROOM_MIN_W || roomsH < LEFT_ROOM_MIN_H) leftW = 0;

  let meeting: Rect | undefined;
  let pantry: Rect | undefined;
  const dividerX = leftW > 0 ? 1 + leftW : 0;

  if (leftW > 0) {
    let meetingH = geometry.hasMeeting ? (geometry.hasPantry ? Math.floor((roomsH - 1) / 2) : roomsH) : 0;
    let pantryH = geometry.hasPantry ? roomsH - (geometry.hasMeeting ? meetingH + 1 : 0) : 0;
    if (geometry.hasMeeting && geometry.hasPantry && (meetingH < LEFT_ROOM_MIN_H || pantryH < LEFT_ROOM_MIN_H)) {
      meetingH = 0;
      pantryH = roomsH;
    }
    if (meetingH > 0) meeting = { x: 1, y: roomsTop, w: leftW, h: meetingH };
    if (pantryH > 0) pantry = { x: 1, y: roomsBottom - pantryH + 1, w: leftW, h: pantryH };

    b.fill({ x: dividerX, y: roomsTop, w: 1, h: roomsH }, TileType.WALL, WALL_COLOR);
    if (meeting) b.fill(meeting, TileType.FLOOR_7, MEETING_FLOOR_COLOR);
    if (pantry) b.fill(pantry, TileType.FLOOR_4, PANTRY_FLOOR_COLOR);
    if (meeting && pantry) {
      b.fill({ x: 1, y: meeting.y + meeting.h, w: leftW, h: 1 }, TileType.WALL, WALL_COLOR);
    }
    // 회의실은 칸막이 벽 맨 아래 칸을 문으로 뚫습니다. 탕비실은 복도 쪽으로 열려 있습니다.
    if (meeting) b.setTile(dividerX, meeting.y + meeting.h - 1, TileType.FLOOR_7, MEETING_FLOOR_COLOR);
  }

  // ── 책상 pod 구역 ────────────────────────────────────────────
  const bandX0 = (dividerX > 0 ? dividerX : 0) + 2;
  const bandX1 = cols - 3;
  const bandY0 = roomsTop + 1;
  const bandW = bandX1 - bandX0 + 1;
  const bandH = roomsBottom - bandY0 + 1;
  const strideX = POD_W + INTER_POD_AISLE_X;
  const strideY = POD_H + INTER_POD_AISLE_Y;

  const podCols = bandW >= POD_W ? Math.floor((bandW + INTER_POD_AISLE_X) / strideX) : 0;
  const usedW = podCols > 0 ? podCols * strideX - INTER_POD_AISLE_X : 0;
  const remainder = bandW - usedW - (podCols > 0 ? INTER_POD_AISLE_X : 0);
  // 오른쪽 끝에 pod 하나가 안 들어가도 책상 1개 폭이 남으면 반쪽 pod 열을 둡니다.
  const partialColumn = remainder >= WORKSTATION_W;
  const podRows = bandH >= POD_H ? Math.floor((bandH + INTER_POD_AISLE_Y) / strideY) : 0;

  const columns: Array<{ x: number; count: number }> = [];
  for (let pc = 0; pc < podCols; pc++) columns.push({ x: bandX0 + pc * strideX, count: POD_WORKSTATIONS });
  if (partialColumn) columns.push({ x: bandX0 + podCols * strideX, count: 1 });

  const pending: Array<{ deskUid: string; pcUid?: string; benchUid: string }> = [];
  for (let pr = 0; pr < podRows; pr++) {
    const y = bandY0 + pr * strideY;
    for (const column of columns) {
      for (let k = 0; k < column.count; k++) {
        const x = column.x + k * WORKSTATION_W;
        const deskUid = b.place('DESK_FRONT', x, y);
        if (!deskUid) continue;
        const pcUid = b.place('PC_FRONT_OFF', x + 1, y);
        const benchUid = b.place('CUSHIONED_BENCH', x + 1, y + 2);
        if (!benchUid) continue;
        pending.push({ deskUid, pcUid, benchUid });
      }
    }
  }
  if (pending.length === 0) return null;

  // ── 회의실: 테이블 + 양옆 의자 2개씩. 폭·높이가 모자라면 빈 바닥 ──
  const meetingSeats: string[] = [];
  if (meeting) {
    const tableX = meeting.x + Math.floor((meeting.w - 3) / 2);
    const tableY = meeting.y + Math.max(0, Math.floor((meeting.h - 4) / 2));
    if (meeting.w >= 7 && meeting.h >= 5) {
      if (b.place('TABLE_FRONT', tableX, tableY)) {
        b.place('COFFEE', tableX + 1, tableY + 2);
        for (const dy of [0, 2]) {
          const left = b.place('WOODEN_CHAIR_SIDE', tableX - 1, tableY + dy);
          const right = b.place('WOODEN_CHAIR_SIDE:left', tableX + 3, tableY + dy);
          if (left) meetingSeats.push(left);
          if (right) meetingSeats.push(right);
        }
      }
    } else {
      b.skip('TABLE_FRONT', tableX, tableY);
    }
    b.place('WHITEBOARD', meeting.x + Math.max(0, Math.floor((meeting.w - 2) / 2)), 0);
    b.place('CLOCK', meeting.x + meeting.w - 1, 0);
  }

  // ── 탕비실: 소파 라운지(4×4) + 작은 테이블·커피·휴지통 ──
  const loungeSeats: string[] = [];
  const pantryStands: Array<{ col: number; row: number }> = [];
  if (pantry) {
    const loungeX = pantry.x + Math.floor((pantry.w - 4) / 2);
    // 아래쪽 2행(작은 테이블·통로)을 남기고 세로 가운데에 둡니다.
    const loungeY = pantry.y + Math.max(1, Math.floor((pantry.h - 2 - 4) / 2));
    if (pantry.w >= 6 && pantry.h >= 6) {
      const sofaFront = b.place('SOFA_FRONT', loungeX + 1, loungeY);
      const sofaSide = b.place('SOFA_SIDE', loungeX, loungeY + 1);
      b.place('COFFEE_TABLE', loungeX + 1, loungeY + 1);
      const sofaLeft = b.place('SOFA_SIDE:left', loungeX + 3, loungeY + 1);
      const sofaBack = b.place('SOFA_BACK', loungeX + 1, loungeY + 3);
      for (const uid of [sofaFront, sofaSide, sofaLeft, sofaBack]) if (uid) loungeSeats.push(uid);
    } else {
      b.skip('SOFA_FRONT', loungeX + 1, loungeY);
    }
    const pantryBottom = pantry.y + pantry.h - 1;
    if (b.place('SMALL_TABLE_FRONT', pantry.x, pantryBottom - 1)) {
      b.place('COFFEE', pantry.x, pantryBottom);
      pantryStands.push({ col: pantry.x + 2, row: pantryBottom });
    }
    b.place('BIN', pantry.x + pantry.w - 1, pantryBottom);
    b.place('PLANT_2', pantry.x + pantry.w - 1, pantry.y - 1);
    const wallRow = pantry.y - 1;
    b.place('DOUBLE_BOOKSHELF', pantry.x + 1, wallRow - 1);
    b.place('SMALL_PAINTING', pantry.x + 4, wallRow - 1);
  }

  // ── 책상 구역 장식: 뒷벽 벽걸이 + 모서리 화분 ──
  const wallDecor = ['LARGE_PAINTING', 'CLOCK', 'SMALL_PAINTING', 'HANGING_PLANT', 'SMALL_PAINTING_2', 'BOOKSHELF'];
  const offset = Math.floor(random() * wallDecor.length);
  for (let x = bandX0, i = 0; x + 1 <= bandX1; x += 5, i++) {
    const type = wallDecor[(offset + i) % wallDecor.length];
    const footprintH = catalog.get(type)?.footprintH ?? 1;
    b.place(type, x, 1 - (footprintH - 1));
  }
  b.place('PLANT', cols - 2, 1);
  if (dividerX > 0) b.place('PLANT_2', dividerX + 1, 1);
  else b.place('PLANT_2', 1, 1);

  // ── 좌석·동선 ──
  const seats = layoutToSeats(b.layout, catalog);
  const seatOf = (uid: string) => seats.find((seat) => seat.furnitureUid === uid);

  const workstations: Workstation[] = [];
  for (const slot of pending) {
    const seat = seatOf(slot.benchUid);
    if (seat) workstations.push({ index: workstations.length, deskUid: slot.deskUid, pcUid: slot.pcUid, seat });
  }

  const waypoints: Waypoint[] = [];
  for (const uid of loungeSeats) {
    const seat = seatOf(uid);
    if (seat) waypoints.push({ kind: 'lounge', col: seat.col, row: seat.row, seat });
  }
  for (const uid of meetingSeats) {
    const seat = seatOf(uid);
    if (seat) waypoints.push({ kind: 'meeting', col: seat.col, row: seat.row, seat });
  }
  for (const stand of pantryStands) waypoints.push({ kind: 'pantry', ...stand });
  for (let c = 2; c < cols - 2; c += 4) {
    if (getTile(b.layout, c, rows - 2) !== TileType.WALL) waypoints.push({ kind: 'corridor', col: c, row: rows - 2 });
  }

  // 좌석은 원래 차단 타일이라 그대로 두고, 서 있는 지점만 실제로 걸을 수 있는지 확인합니다.
  const blocked = getBlockedTiles(b.layout, catalog);
  const reachableWaypoints = waypoints.filter((wp) => wp.seat || isWalkable(b.layout, blocked, wp.col, wp.row));

  return {
    seed,
    variant,
    layout: b.layout,
    workstations,
    waypoints: reachableWaypoints,
    entry: { col: cols - 2, row: rows - 1 },
    skipped: b.skipped,
  };
}

/** pixtuoid `FloorCtx::frame_layout`처럼 최근 1개 키만 기억합니다. 실패(null)는 memo를 덮어쓰지 않습니다. */
export function createOfficeLayoutMemo(catalog: FurnitureCatalog) {
  let memo: { key: string; office: GeneratedOffice } | undefined;
  return (cols: number, rows: number, seed: number): GeneratedOffice | null => {
    const key = `${cols}x${rows}:${seed}`;
    if (memo?.key === key) return memo.office;
    const office = generateOfficeLayout(cols, rows, seed, catalog);
    if (office) memo = { key, office };
    return office;
  };
}

/** 책상 1개가 들어가는 최소 타일 크기 — 안내 문구용. */
export function minOfficeSize(catalog: FurnitureCatalog, seed: number): { cols: number; rows: number } {
  let cols = 1;
  while (cols < 200 && !generateOfficeLayout(cols, 60, seed, catalog)) cols++;
  let rows = 1;
  while (rows < 200 && !generateOfficeLayout(cols + 20, rows, seed, catalog)) rows++;
  return { cols, rows };
}
