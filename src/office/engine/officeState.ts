import {
  AUTO_ON_FACING_DEPTH,
  AUTO_ON_SIDE_DEPTH,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  CHARACTER_SITTING_OFFSET_PX,
  DISMISS_BUBBLE_FAST_FADE_SEC,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
  INACTIVE_SEAT_TIMER_MIN_SEC,
  INACTIVE_SEAT_TIMER_RANGE_SEC,
  PALETTE_COUNT,
  WAITING_BUBBLE_DURATION_SEC,
} from '../../constants.js';
import { getCatalogEntry, getOnStateType } from '../layout/furnitureCatalog.js';
import {
  createDefaultLayout,
  getBlockedTiles,
  layoutToFurnitureInstances,
  layoutToSeats,
  layoutToTileMap,
} from '../layout/layoutSerializer.js';
import { findPath, getWalkableTiles, isWalkable } from '../layout/tileMap.js';
import type {
  Character,
  FurnitureInstance,
  OfficeLayout,
  PlacedFurniture,
  Seat,
  TileType as TileTypeVal,
} from '../types.js';
import { CharacterState, Direction, MATRIX_EFFECT_DURATION, TILE_SIZE } from '../types.js';
import { createCharacter, directionBetween, updateCharacter } from './characters.js';
import { matrixEffectSeeds } from './matrixEffect.js';

const SOCIAL_LOOK_RADIUS = 4;
const SOCIAL_WALK_RADIUS = 6;
const SOCIAL_BUBBLE_MIN_SEC = 1.8;
const SOCIAL_BUBBLE_MAX_SEC = 3.2;
const SOCIAL_ACTION_MIN_SEC = 1.6;
const SOCIAL_ACTION_MAX_SEC = 4.2;
const SOCIAL_PHRASES = [
  '안녕하세요',
  '좋은 아침이에요',
  '좋은 오후예요',
  '좋은 저녁이에요',
  '반가워요',
  '오늘 컨디션 어떠세요',
  '커피 한 잔 하셨나요',
  '오늘도 힘내봐요',
  '날씨가 좋아요',
  '날씨가 참 포근하네요',
  '바람이 시원하네요',
  '햇살이 좋네요',
  '비 오는 날도 나쁘지 않죠',
  '점심은 드셨어요',
  '저녁 메뉴는 정하셨어요',
  '오늘 일정이 빡빡하네요',
  '일은 잘 되시나요?',
  '집중이 잘 되는 날이네요',
  '좋은 하루네요',
  '주말 계획 있으세요',
  '어제 푹 쉬셨어요',
  '오늘 유난히 바빠 보이네요',
  '도움 필요한 거 있으세요',
  '지금 하시는 일 멋져 보여요',
  '키보드 소리가 리듬감 있네요',
  '화면에 좋은 일이 가득해 보이네요',
  '오늘은 왠지 잘 풀릴 것 같아요',
  '웃을 일 하나쯤 생기면 좋겠네요',
  '잠깐 스트레칭 하실래요',
  '물 한 잔 챙겨 드세요',
  '회의는 무사히 끝나길 바라요',
  '버그가 오늘은 얌전했으면 좋겠네요',
  '커밋이 착하게 쌓이길',
  '빌드가 한 번에 되면 행복하죠',
  '테스트 초록불 보면 기분 좋아요',
  '배포 버튼은 늘 떨려요',
  '오늘은 경고창도 예의 바르네요',
  '에러 로그가 짧으면 감동이에요',
  '이슈가 이슈를 부르지 않으면 좋겠어요',
  '문제가 생겨도 침착하면 반은 해결이죠',
  '마우스도 오늘은 열심히 일하네요',
  '모니터가 반짝반짝하네요',
  '책상이 꽤 정돈돼 보이네요',
  '의자가 오늘따라 편해 보이네요',
  '식물도 응원하는 것 같아요',
  '화이트보드가 뭔가 기대에 차 있어요',
  '쿨러 물이 유난히 시원해 보이네요',
  '램프가 분위기를 살려주네요',
  '오늘은 문서도 말을 잘 듣겠죠',
  '코드가 스스로 정리되면 좋겠네요',
  '주석이 친절하면 마음이 놓여요',
  '변수명이 멋지면 하루가 편해요',
  '함수도 쉬는 시간이 필요하겠죠',
  '리팩터링은 늘 용기가 필요해요',
  '이름 짓기가 제일 어려운 일 같아요',
  '컴퓨터도 가끔 칭찬이 필요하대요',
  '오늘은 인터넷도 협조적이네요',
  '마감은 늘 달리기 같아요',
  '천천히 해도 결국 도착하더라고요',
  '급할수록 저장부터 하는 편이에요',
  '자동 저장은 현대의 축복이죠',
  '브랜치 이름 정하는 데도 감각이 필요해요',
  'PR 제목이 깔끔하면 뿌듯하죠',
  '리뷰 코멘트가 짧으면 살짝 불안해요',
  '머지 버튼은 늘 묵직하네요',
  '충돌 없는 리베이스는 선물 같아요',
  '디버깅은 숨은그림찾기 같아요',
  '가끔은 재시작이 답이더라고요',
  '문제는 늘 예상 밖에서 등장하죠',
  '그래도 해결되면 다 추억이죠',
  '오늘은 행운이 로그에 찍히면 좋겠어요',
  '작은 성공도 꽤 큰 힘이 되죠',
  '한 줄 해결이 제일 통쾌해요',
  '근데 그 한 줄 찾기가 어렵죠',
  '커피가 코드를 직접 짜주면 좋겠네요',
  '의자가 회전하면 아이디어도 돌까요',
  '키보드가 박수쳐 주면 좋겠어요',
  '모니터가 고개 끄덕이는 기분이에요',
  '마우스가 오늘은 길을 잘 아네요',
  '버그도 관심을 받으면 떠날까요',
  '에러 메시지가 시를 쓰는 날도 있죠',
  '회의실 공기도 긴장한 것 같아요',
  '점심 메뉴 고르기가 알고리즘보다 어려워요',
  '복붙이 너무 완벽하면 조금 무서워요',
  '비밀번호는 늘 저를 시험하네요',
  '탭과 스페이스는 아직도 토론 중이래요',
  '주석이 미래의 나를 구하곤 하죠',
  '미래의 나는 늘 현재의 나를 찾더라고요',
  '컴파일러가 오늘은 너그럽길 바라요',
  '캐시를 지우면 마음도 비워지는 느낌이에요',
  '문제가 사라지면 내가 잘한 건지 헷갈리죠',
  '사소한 버그가 제일 기억에 남아요',
  '스크롤이 끝이 없으면 살짝 철학적이 돼요',
  '와이파이가 잠깐 쉬고 싶어 하나 봐요',
  '오늘은 알림도 조용해서 좋네요',
  '가끔 침묵이 최고의 디버거 같아요',
  '좋은 질문은 절반의 해결책이죠',
  '설명하다 보면 답이 나오기도 하죠',
  '생각보다 잘하고 계신 것 같아요',
  '조금만 더 하면 끝이 보일 것 같아요',
  '이따가 산책 한 번 어떠세요',
  '오늘도 무사 완료를 기원합니다',
  '웃으면서 끝내면 그게 제일 좋죠',
  '잠깐 쉬어가도 괜찮아요',
  '지금 페이스 좋네요',
] as const;

export class OfficeState {
  layout: OfficeLayout;
  tileMap: TileTypeVal[][];
  seats: Map<string, Seat>;
  blockedTiles: Set<string>;
  furniture: FurnitureInstance[];
  walkableTiles: Array<{ col: number; row: number }>;
  characters: Map<number, Character> = new Map();
  selectedAgentId: number | null = null;
  cameraFollowId: number | null = null;
  hoveredAgentId: number | null = null;
  hoveredTile: { col: number; row: number } | null = null;
  /** Maps "parentId:toolId" → sub-agent character ID (negative) */
  subagentIdMap: Map<string, number> = new Map();
  /** Reverse lookup: sub-agent character ID → parent info */
  subagentMeta: Map<number, { parentAgentId: number; parentToolId: string }> = new Map();
  private nextSubagentId = -1;

  constructor(layout?: OfficeLayout) {
    this.layout = layout || createDefaultLayout();
    this.tileMap = layoutToTileMap(this.layout);
    this.seats = layoutToSeats(this.layout.furniture);
    this.blockedTiles = getBlockedTiles(this.layout.furniture);
    this.furniture = layoutToFurnitureInstances(this.layout.furniture);
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);
  }

  /** Rebuild all derived state from a new layout. Reassigns existing characters.
   *  @param shift Optional pixel shift to apply when grid expands left/up */
  rebuildFromLayout(layout: OfficeLayout, shift?: { col: number; row: number }): void {
    this.layout = layout;
    this.tileMap = layoutToTileMap(layout);
    this.seats = layoutToSeats(layout.furniture);
    this.blockedTiles = getBlockedTiles(layout.furniture);
    this.rebuildFurnitureInstances();
    this.walkableTiles = getWalkableTiles(this.tileMap, this.blockedTiles);

    // Shift character positions when grid expands left/up
    if (shift && (shift.col !== 0 || shift.row !== 0)) {
      for (const ch of this.characters.values()) {
        ch.tileCol += shift.col;
        ch.tileRow += shift.row;
        ch.x += shift.col * TILE_SIZE;
        ch.y += shift.row * TILE_SIZE;
        // Clear path since tile coords changed
        ch.path = [];
        ch.moveProgress = 0;
      }
    }

    // Reassign characters to new seats, preserving existing assignments when possible
    for (const seat of this.seats.values()) {
      seat.assigned = false;
    }

    // First pass: try to keep characters at their existing seats
    for (const ch of this.characters.values()) {
      if (ch.seatId && this.seats.has(ch.seatId)) {
        const seat = this.seats.get(ch.seatId)!;
        if (!seat.assigned) {
          seat.assigned = true;
          // Snap character to seat position
          ch.tileCol = seat.seatCol;
          ch.tileRow = seat.seatRow;
          const cx = seat.seatCol * TILE_SIZE + TILE_SIZE / 2;
          const cy = seat.seatRow * TILE_SIZE + TILE_SIZE / 2;
          ch.x = cx;
          ch.y = cy;
          ch.dir = seat.facingDir;
          continue;
        }
      }
      ch.seatId = null; // will be reassigned below
    }

    // Second pass: assign remaining characters to free seats
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue;
      const seatId = this.findFreeSeat();
      if (seatId) {
        this.seats.get(seatId)!.assigned = true;
        ch.seatId = seatId;
        const seat = this.seats.get(seatId)!;
        ch.tileCol = seat.seatCol;
        ch.tileRow = seat.seatRow;
        ch.x = seat.seatCol * TILE_SIZE + TILE_SIZE / 2;
        ch.y = seat.seatRow * TILE_SIZE + TILE_SIZE / 2;
        ch.dir = seat.facingDir;
      }
    }

    // Relocate any characters that ended up outside bounds or on non-walkable tiles
    for (const ch of this.characters.values()) {
      if (ch.seatId) continue; // seated characters are fine
      if (
        ch.tileCol < 0 ||
        ch.tileCol >= layout.cols ||
        ch.tileRow < 0 ||
        ch.tileRow >= layout.rows
      ) {
        this.relocateCharacterToWalkable(ch);
      }
    }
  }

  /** Move a character to a random walkable tile */
  private relocateCharacterToWalkable(ch: Character): void {
    if (this.walkableTiles.length === 0) return;
    const spawn = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    ch.tileCol = spawn.col;
    ch.tileRow = spawn.row;
    ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
    ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
    ch.path = [];
    ch.moveProgress = 0;
  }

  getLayout(): OfficeLayout {
    return this.layout;
  }

  /** Get the blocked-tile key for a character's own seat, or null */
  private ownSeatKey(ch: Character): string | null {
    if (!ch.seatId) return null;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return null;
    return `${seat.seatCol},${seat.seatRow}`;
  }

  /** Temporarily unblock a character's own seat, run fn, then re-block */
  private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
    const key = this.ownSeatKey(ch);
    if (key) this.blockedTiles.delete(key);
    const result = fn();
    if (key) this.blockedTiles.add(key);
    return result;
  }

  private findFreeSeat(): string | null {
    for (const [uid, seat] of this.seats) {
      if (!seat.assigned) return uid;
    }
    return null;
  }

  /**
   * Pick a diverse palette for a new agent based on currently active agents.
   * First 6 agents each get a unique skin (random order). Beyond 6, skins
   * repeat in balanced rounds with a random hue shift (≥45°).
   */
  private pickDiversePalette(): { palette: number; hueShift: number } {
    // Count how many non-sub-agents use each base palette (0-5)
    const counts = new Array(PALETTE_COUNT).fill(0) as number[];
    for (const ch of this.characters.values()) {
      if (ch.isSubagent) continue;
      counts[ch.palette]++;
    }
    const minCount = Math.min(...counts);
    // Available = palettes at the minimum count (least used)
    const available: number[] = [];
    for (let i = 0; i < PALETTE_COUNT; i++) {
      if (counts[i] === minCount) available.push(i);
    }
    const palette = available[Math.floor(Math.random() * available.length)];
    // First round (minCount === 0): no hue shift. Subsequent rounds: random ≥45°.
    let hueShift = 0;
    if (minCount > 0) {
      hueShift = HUE_SHIFT_MIN_DEG + Math.floor(Math.random() * HUE_SHIFT_RANGE_DEG);
    }
    return { palette, hueShift };
  }

  addAgent(
    id: number,
    preferredPalette?: number,
    preferredHueShift?: number,
    preferredSeatId?: string,
    skipSpawnEffect?: boolean,
    folderName?: string,
  ): void {
    if (this.characters.has(id)) return;

    let palette: number;
    let hueShift: number;
    if (preferredPalette !== undefined) {
      palette = preferredPalette;
      hueShift = preferredHueShift ?? 0;
    } else {
      const pick = this.pickDiversePalette();
      palette = pick.palette;
      hueShift = pick.hueShift;
    }

    // Try preferred seat first, then any free seat
    let seatId: string | null = null;
    if (preferredSeatId && this.seats.has(preferredSeatId)) {
      const seat = this.seats.get(preferredSeatId)!;
      if (!seat.assigned) {
        seatId = preferredSeatId;
      }
    }
    if (!seatId) {
      seatId = this.findFreeSeat();
    }

    let ch: Character;
    if (seatId) {
      const seat = this.seats.get(seatId)!;
      seat.assigned = true;
      ch = createCharacter(id, palette, seatId, seat, hueShift);
    } else {
      // No seats — spawn at random walkable tile
      const spawn =
        this.walkableTiles.length > 0
          ? this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)]
          : { col: 1, row: 1 };
      ch = createCharacter(id, palette, null, null, hueShift);
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
    }

    if (folderName) {
      ch.folderName = folderName;
    }
    if (!skipSpawnEffect) {
      ch.matrixEffect = 'spawn';
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = matrixEffectSeeds();
    }
    this.characters.set(id, ch);
  }

  removeAgent(id: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (ch.matrixEffect === 'despawn') return; // already despawning
    // Free seat and clear selection immediately
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
    }
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
    // Start despawn animation instead of immediate delete
    ch.matrixEffect = 'despawn';
    ch.matrixEffectTimer = 0;
    ch.matrixEffectSeeds = matrixEffectSeeds();
    ch.bubbleType = null;
  }

  /** Find seat uid at a given tile position, or null */
  getSeatAtTile(col: number, row: number): string | null {
    for (const [uid, seat] of this.seats) {
      if (seat.seatCol === col && seat.seatRow === row) return uid;
    }
    return null;
  }

  /** Reassign an agent from their current seat to a new seat */
  reassignSeat(agentId: number, seatId: string): void {
    const ch = this.characters.get(agentId);
    if (!ch) return;
    // Unassign old seat
    if (ch.seatId) {
      const old = this.seats.get(ch.seatId);
      if (old) old.assigned = false;
    }
    // Assign new seat
    const seat = this.seats.get(seatId);
    if (!seat || seat.assigned) return;
    seat.assigned = true;
    ch.seatId = seatId;
    // Pathfind to new seat (unblock own seat tile for this query)
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles, {
        startDir: ch.dir,
        turnPreference: ch.turnPreference,
      }),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, path[0].col, path[0].row);
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat or no path — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /** Send an agent back to their currently assigned seat */
  sendToSeat(agentId: number): void {
    const ch = this.characters.get(agentId);
    if (!ch || !ch.seatId) return;
    const seat = this.seats.get(ch.seatId);
    if (!seat) return;
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, this.tileMap, this.blockedTiles, {
        startDir: ch.dir,
        turnPreference: ch.turnPreference,
      }),
    );
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, path[0].col, path[0].row);
      ch.frame = 0;
      ch.frameTimer = 0;
    } else {
      // Already at seat — sit down
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
      if (!ch.isActive) {
        ch.seatTimer = INACTIVE_SEAT_TIMER_MIN_SEC + Math.random() * INACTIVE_SEAT_TIMER_RANGE_SEC;
      }
    }
  }

  /** Walk an agent to an arbitrary walkable tile (right-click command) */
  walkToTile(agentId: number, col: number, row: number): boolean {
    const ch = this.characters.get(agentId);
    if (!ch || ch.isSubagent) return false;
    if (!isWalkable(col, row, this.tileMap, this.blockedTiles)) {
      // Also allow walking to own seat tile (blocked for others but not self)
      const key = this.ownSeatKey(ch);
      if (!key || key !== `${col},${row}`) return false;
    }
    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(ch.tileCol, ch.tileRow, col, row, this.tileMap, this.blockedTiles, {
        startDir: ch.dir,
        turnPreference: ch.turnPreference,
      }),
    );
    if (path.length === 0) return false;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.dir = directionBetween(ch.tileCol, ch.tileRow, path[0].col, path[0].row);
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }

  /** Move an agent one tile in the given direction (WASD).
   *  Clears seat assignment and destination path. */
  moveOneStep(agentId: number, dir: Direction): boolean {
    const ch = this.characters.get(agentId);
    if (!ch || ch.isSubagent) return false;
    // If currently mid-move, ignore
    if (ch.state === CharacterState.WALK && ch.moveProgress > 0) return false;

    const dc = dir === Direction.LEFT ? -1 : dir === Direction.RIGHT ? 1 : 0;
    const dr = dir === Direction.UP ? -1 : dir === Direction.DOWN ? 1 : 0;
    const targetCol = ch.tileCol + dc;
    const targetRow = ch.tileRow + dr;

    if (!isWalkable(targetCol, targetRow, this.tileMap, this.blockedTiles)) return false;

    // Free seat assignment
    if (ch.seatId) {
      const seat = this.seats.get(ch.seatId);
      if (seat) seat.assigned = false;
      ch.seatId = null;
    }

    // Clear any existing path/destination
    ch.path = [{ col: targetCol, row: targetRow }];
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.dir = dir;
    ch.isActive = false;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }

  /** Create a sub-agent character with the parent's palette. Returns the sub-agent ID. */
  addSubagent(parentAgentId: number, parentToolId: string): number {
    const key = `${parentAgentId}:${parentToolId}`;
    if (this.subagentIdMap.has(key)) return this.subagentIdMap.get(key)!;

    const id = this.nextSubagentId--;
    const parentCh = this.characters.get(parentAgentId);
    const palette = parentCh ? parentCh.palette : 0;
    const hueShift = parentCh ? parentCh.hueShift : 0;

    // Find the free seat closest to the parent agent
    const parentCol = parentCh ? parentCh.tileCol : 0;
    const parentRow = parentCh ? parentCh.tileRow : 0;
    const dist = (c: number, r: number) => Math.abs(c - parentCol) + Math.abs(r - parentRow);

    let bestSeatId: string | null = null;
    let bestDist = Infinity;
    for (const [uid, seat] of this.seats) {
      if (!seat.assigned) {
        const d = dist(seat.seatCol, seat.seatRow);
        if (d < bestDist) {
          bestDist = d;
          bestSeatId = uid;
        }
      }
    }

    let ch: Character;
    if (bestSeatId) {
      const seat = this.seats.get(bestSeatId)!;
      seat.assigned = true;
      ch = createCharacter(id, palette, bestSeatId, seat, hueShift);
    } else {
      // No seats — spawn at closest walkable tile to parent
      let spawn = { col: 1, row: 1 };
      if (this.walkableTiles.length > 0) {
        let closest = this.walkableTiles[0];
        let closestDist = dist(closest.col, closest.row);
        for (let i = 1; i < this.walkableTiles.length; i++) {
          const d = dist(this.walkableTiles[i].col, this.walkableTiles[i].row);
          if (d < closestDist) {
            closest = this.walkableTiles[i];
            closestDist = d;
          }
        }
        spawn = closest;
      }
      ch = createCharacter(id, palette, null, null, hueShift);
      ch.x = spawn.col * TILE_SIZE + TILE_SIZE / 2;
      ch.y = spawn.row * TILE_SIZE + TILE_SIZE / 2;
      ch.tileCol = spawn.col;
      ch.tileRow = spawn.row;
    }
    ch.isSubagent = true;
    ch.parentAgentId = parentAgentId;
    ch.matrixEffect = 'spawn';
    ch.matrixEffectTimer = 0;
    ch.matrixEffectSeeds = matrixEffectSeeds();
    this.characters.set(id, ch);

    this.subagentIdMap.set(key, id);
    this.subagentMeta.set(id, { parentAgentId, parentToolId });
    return id;
  }

  /** Remove a specific sub-agent character and free its seat */
  removeSubagent(parentAgentId: number, parentToolId: string): void {
    const key = `${parentAgentId}:${parentToolId}`;
    const id = this.subagentIdMap.get(key);
    if (id === undefined) return;

    const ch = this.characters.get(id);
    if (ch) {
      if (ch.matrixEffect === 'despawn') {
        // Already despawning — just clean up maps
        this.subagentIdMap.delete(key);
        this.subagentMeta.delete(id);
        return;
      }
      if (ch.seatId) {
        const seat = this.seats.get(ch.seatId);
        if (seat) seat.assigned = false;
      }
      // Start despawn animation — keep character in map for rendering
      ch.matrixEffect = 'despawn';
      ch.matrixEffectTimer = 0;
      ch.matrixEffectSeeds = matrixEffectSeeds();
      ch.bubbleType = null;
    }
    // Clean up tracking maps immediately so keys don't collide
    this.subagentIdMap.delete(key);
    this.subagentMeta.delete(id);
    if (this.selectedAgentId === id) this.selectedAgentId = null;
    if (this.cameraFollowId === id) this.cameraFollowId = null;
  }

  /** Remove all sub-agents belonging to a parent agent */
  removeAllSubagents(parentAgentId: number): void {
    const toRemove: string[] = [];
    for (const [key, id] of this.subagentIdMap) {
      const meta = this.subagentMeta.get(id);
      if (meta && meta.parentAgentId === parentAgentId) {
        const ch = this.characters.get(id);
        if (ch) {
          if (ch.matrixEffect === 'despawn') {
            // Already despawning — just clean up maps
            this.subagentMeta.delete(id);
            toRemove.push(key);
            continue;
          }
          if (ch.seatId) {
            const seat = this.seats.get(ch.seatId);
            if (seat) seat.assigned = false;
          }
          // Start despawn animation
          ch.matrixEffect = 'despawn';
          ch.matrixEffectTimer = 0;
          ch.matrixEffectSeeds = matrixEffectSeeds();
          ch.bubbleType = null;
        }
        this.subagentMeta.delete(id);
        if (this.selectedAgentId === id) this.selectedAgentId = null;
        if (this.cameraFollowId === id) this.cameraFollowId = null;
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.subagentIdMap.delete(key);
    }
  }

  /** Look up the sub-agent character ID for a given parent+toolId, or null */
  getSubagentId(parentAgentId: number, parentToolId: string): number | null {
    return this.subagentIdMap.get(`${parentAgentId}:${parentToolId}`) ?? null;
  }

  setAgentActive(id: number, active: boolean): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.isActive = active;
      if (!active) {
        // Sentinel -1: signals turn just ended, skip next seat rest timer.
        // Prevents the WALK handler from setting a 2-4 min rest on arrival.
        ch.seatTimer = -1;
        ch.path = [];
        ch.moveProgress = 0;
      }
      this.rebuildFurnitureInstances();
    }
  }

  /** Rebuild furniture instances with auto-state applied (active agents turn electronics ON) */
  private rebuildFurnitureInstances(): void {
    // Collect tiles where active agents face desks
    const autoOnTiles = new Set<string>();
    for (const ch of this.characters.values()) {
      if (!ch.isActive || !ch.seatId) continue;
      const seat = this.seats.get(ch.seatId);
      if (!seat) continue;
      // Find the desk tile(s) the agent faces from their seat
      const dCol =
        seat.facingDir === Direction.RIGHT ? 1 : seat.facingDir === Direction.LEFT ? -1 : 0;
      const dRow = seat.facingDir === Direction.DOWN ? 1 : seat.facingDir === Direction.UP ? -1 : 0;
      // Check tiles in the facing direction (desk could be 1-3 tiles deep)
      for (let d = 1; d <= AUTO_ON_FACING_DEPTH; d++) {
        const tileCol = seat.seatCol + dCol * d;
        const tileRow = seat.seatRow + dRow * d;
        autoOnTiles.add(`${tileCol},${tileRow}`);
      }
      // Also check tiles to the sides of the facing direction (desks can be wide)
      for (let d = 1; d <= AUTO_ON_SIDE_DEPTH; d++) {
        const baseCol = seat.seatCol + dCol * d;
        const baseRow = seat.seatRow + dRow * d;
        if (dCol !== 0) {
          // Facing left/right: check tiles above and below
          autoOnTiles.add(`${baseCol},${baseRow - 1}`);
          autoOnTiles.add(`${baseCol},${baseRow + 1}`);
        } else {
          // Facing up/down: check tiles left and right
          autoOnTiles.add(`${baseCol - 1},${baseRow}`);
          autoOnTiles.add(`${baseCol + 1},${baseRow}`);
        }
      }
    }

    if (autoOnTiles.size === 0) {
      this.furniture = layoutToFurnitureInstances(this.layout.furniture);
      return;
    }

    // Build modified furniture list with auto-state applied
    const modifiedFurniture: PlacedFurniture[] = this.layout.furniture.map((item) => {
      const entry = getCatalogEntry(item.type);
      if (!entry) return item;
      // Check if any tile of this furniture overlaps an auto-on tile
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          if (autoOnTiles.has(`${item.col + dc},${item.row + dr}`)) {
            const onType = getOnStateType(item.type);
            if (onType !== item.type) {
              return { ...item, type: onType };
            }
            return item;
          }
        }
      }
      return item;
    });

    this.furniture = layoutToFurnitureInstances(modifiedFurniture);
  }

  setAgentTool(id: number, tool: string | null): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.currentTool = tool;
    }
  }

  showPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'permission';
      ch.bubbleTimer = 0;
    }
  }

  clearPermissionBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch && ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    }
  }

  showWaitingBubble(id: number): void {
    const ch = this.characters.get(id);
    if (ch) {
      ch.bubbleType = 'waiting';
      ch.bubbleTimer = WAITING_BUBBLE_DURATION_SEC;
    }
  }

  /** Dismiss bubble on click — permission: instant, waiting: quick fade */
  dismissBubble(id: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    if (ch.bubbleType === 'permission') {
      ch.bubbleType = null;
      ch.bubbleTimer = 0;
    } else if (ch.bubbleType === 'waiting') {
      // Trigger immediate fade (0.3s remaining)
      ch.bubbleTimer = Math.min(ch.bubbleTimer, DISMISS_BUBBLE_FAST_FADE_SEC);
    }
    ch.socialBubbleText = null;
    ch.socialBubbleTimer = 0;
  }

  update(dt: number): void {
    // Build occupied tiles set from all characters' current tile positions
    const occupiedByChar = new Map<string, number>();
    for (const ch of this.characters.values()) {
      if (ch.matrixEffect === 'despawn') continue;
      occupiedByChar.set(`${ch.tileCol},${ch.tileRow}`, ch.id);
    }

    const toDelete: number[] = [];
    for (const ch of this.characters.values()) {
      // Handle matrix effect animation
      if (ch.matrixEffect) {
        ch.matrixEffectTimer += dt;
        if (ch.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
          if (ch.matrixEffect === 'spawn') {
            // Spawn complete — clear effect, resume normal FSM
            ch.matrixEffect = null;
            ch.matrixEffectTimer = 0;
            ch.matrixEffectSeeds = [];
          } else {
            // Despawn complete — mark for deletion
            toDelete.push(ch.id);
          }
        }
        continue; // skip normal FSM while effect is active
      }

      // Build occupied tiles excluding this character's own tile
      const occupiedTiles = new Set<string>();
      for (const [key, id] of occupiedByChar) {
        if (id !== ch.id) occupiedTiles.add(key);
      }

      // Temporarily unblock own seat so character can pathfind to it
      this.withOwnSeatUnblocked(ch, () =>
        updateCharacter(ch, dt, this.walkableTiles, this.seats, this.tileMap, this.blockedTiles, occupiedTiles),
      );

      // Tick bubble timer for waiting bubbles
      if (ch.bubbleType === 'waiting') {
        ch.bubbleTimer -= dt;
        if (ch.bubbleTimer <= 0) {
          ch.bubbleType = null;
          ch.bubbleTimer = 0;
        }
      }

      if (ch.socialBubbleTimer > 0) {
        ch.socialBubbleTimer -= dt;
        if (ch.socialBubbleTimer <= 0) {
          ch.socialBubbleText = null;
          ch.socialBubbleTimer = 0;
        }
      }

      this.updateSocialBehavior(ch, dt, occupiedTiles);
    }
    // Remove characters that finished despawn
    for (const id of toDelete) {
      this.characters.delete(id);
    }
  }

  private updateSocialBehavior(ch: Character, dt: number, occupiedTiles: Set<string>): void {
    if (ch.isSubagent) return;

    const nearby = this.findNearestCharacter(ch, SOCIAL_LOOK_RADIUS);
    if (!nearby) {
      return;
    }

    if (ch.state !== CharacterState.WALK) {
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nearby.tileCol, nearby.tileRow);
    }

    ch.socialActionTimer -= dt;
    if (ch.socialActionTimer > 0) {
      return;
    }
    ch.socialActionTimer = randomRange(SOCIAL_ACTION_MIN_SEC, SOCIAL_ACTION_MAX_SEC);

    const socialBias = ch.socialPreference / 100;
    if (!ch.bubbleType && Math.random() < 0.12 + socialBias * 0.45) {
      ch.socialBubbleText = randomItem(SOCIAL_PHRASES);
      ch.socialBubbleTimer = randomRange(SOCIAL_BUBBLE_MIN_SEC, SOCIAL_BUBBLE_MAX_SEC);
    }

    if (ch.state !== CharacterState.IDLE || ch.moveProgress > 0 || socialBias < 0.55) {
      return;
    }

    const walkTarget = this.findSocialWalkTarget(ch, nearby, occupiedTiles);
    if (!walkTarget) {
      return;
    }

    const walkChance = 0.05 + socialBias * 0.3;
    if (Math.random() >= walkChance) {
      return;
    }

    const path = this.withOwnSeatUnblocked(ch, () =>
      findPath(
        ch.tileCol,
        ch.tileRow,
        walkTarget.col,
        walkTarget.row,
        this.tileMap,
        this.blockedTiles,
        { startDir: ch.dir, turnPreference: ch.turnPreference },
      ),
    );
    if (path.length === 0) {
      return;
    }

    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.dir = directionBetween(ch.tileCol, ch.tileRow, path[0].col, path[0].row);
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  private findNearestCharacter(source: Character, maxDistance: number): Character | null {
    let best: Character | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.characters.values()) {
      if (candidate.id === source.id) continue;
      if (candidate.matrixEffect) continue;

      const distance =
        Math.abs(candidate.tileCol - source.tileCol) + Math.abs(candidate.tileRow - source.tileRow);
      if (distance === 0 || distance > maxDistance || distance >= bestDistance) {
        continue;
      }
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  private findSocialWalkTarget(
    source: Character,
    target: Character,
    occupiedTiles: Set<string>,
  ): { col: number; row: number } | null {
    const distance =
      Math.abs(target.tileCol - source.tileCol) + Math.abs(target.tileRow - source.tileRow);
    if (distance <= 1 || distance > SOCIAL_WALK_RADIUS) {
      return null;
    }

    const candidates = [
      { col: target.tileCol, row: target.tileRow - 1 },
      { col: target.tileCol + 1, row: target.tileRow },
      { col: target.tileCol, row: target.tileRow + 1 },
      { col: target.tileCol - 1, row: target.tileRow },
    ];

    let best: { col: number; row: number } | null = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const key = `${candidate.col},${candidate.row}`;
      if (occupiedTiles.has(key)) continue;
      if (!isWalkable(candidate.col, candidate.row, this.tileMap, this.blockedTiles)) {
        const ownSeatKey = this.ownSeatKey(source);
        if (ownSeatKey !== key) continue;
      }

      const distanceToSource =
        Math.abs(candidate.col - source.tileCol) + Math.abs(candidate.row - source.tileRow);
      if (distanceToSource < bestDistance) {
        best = candidate;
        bestDistance = distanceToSource;
      }
    }

    return best;
  }

  getCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /** Get character at pixel position (for hit testing). Returns id or null. */
  getCharacterAt(worldX: number, worldY: number): number | null {
    const chars = this.getCharacters().sort((a, b) => b.y - a.y);
    for (const ch of chars) {
      // Skip characters that are despawning
      if (ch.matrixEffect === 'despawn') continue;
      // Character sprite is 16x24, anchored bottom-center
      // Apply sitting offset to match visual position
      const sittingOffset = ch.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
      const anchorY = ch.y + sittingOffset;
      const left = ch.x - CHARACTER_HIT_HALF_WIDTH;
      const right = ch.x + CHARACTER_HIT_HALF_WIDTH;
      const top = anchorY - CHARACTER_HIT_HEIGHT;
      const bottom = anchorY;
      if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
        return ch.id;
      }
    }
    return null;
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
