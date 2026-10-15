import * as Phaser from 'phaser';

import type { Direction } from '../../domain/index.js';
import {
  createOfficeLayoutMemo,
  findPath,
  getBlockedTiles,
  getOnAnimationFrames,
  getTile,
  layoutToDrawInstances,
  layoutToSeats,
  minOfficeSize,
  PIXEL_AGENTS_TILE_SIZE as T,
  tileKey,
  TileType,
  type FloorVariant,
  type FurnitureCatalog,
  type FurnitureCatalogEntry,
  type GeneratedOffice,
  type LayoutSeat,
  type SkippedFurniture,
  type Waypoint,
} from '../../domain/pixelAgents/index.js';
import { Character, CHARACTER_COUNT, preloadCharacterAssets } from '../entities/Character.js';
import {
  ensureFloorTexture,
  ensureWallTexture,
  furnitureTextureKey,
  preloadPixelAgentsAssets,
  WALL_PIECE_HEIGHT,
  wallBaseColor,
} from './assets.js';

export const PIXEL_AGENTS_SEED_KEY = 'pixelAgents:seed';
export const PIXEL_AGENTS_DEBUG_KEY = 'pixelAgents:debug';
export const PIXEL_AGENTS_AGENT_COUNT_KEY = 'pixelAgents:agentCount';
export const PIXEL_AGENTS_STATS_EVENT = 'pixelAgents:stats';

export interface PixelAgentsOfficeStats {
  cols: number;
  rows: number;
  seed: number;
  variant?: FloorVariant;
  tooSmall: boolean;
  minCols: number;
  minRows: number;
  desks: number;
  capacity: number;
  furniture: number;
  seats: number;
  visibleAgents: number;
  hiddenAgents: number;
  skipped: SkippedFurniture[];
}

const VIEW_SCALE = 2;
/** pixel-agents CHARACTER_SITTING_OFFSET_PX */
const SITTING_OFFSET_PX = 6;
const WALK_TILES_PER_SECOND = 3.5;
const PC_FRAME_MS = 200;
const FLOOR_GRID_TEXTURE = 'pixel-agents:floor-grid';

type AgentPhase = 'entering' | 'working' | 'thinking' | 'to-break' | 'on-break' | 'returning';

interface OfficeAgent {
  id: string;
  deskIndex: number;
  character: Character;
  phase: AgentPhase;
  phaseUntil: number;
  tile: { col: number; row: number };
  path: Array<{ col: number; row: number }>;
  stepFrom?: { x: number; y: number };
  stepProgress: number;
  seat?: LayoutSeat;
  breakTarget?: Waypoint;
}

interface FurnitureSprite {
  image: Phaser.GameObjects.Image;
  entry: FurnitureCatalogEntry;
  uid: string;
}

export class PixelAgentsOfficeScene extends Phaser.Scene {
  private readonly layoutFor: ReturnType<typeof createOfficeLayoutMemo>;
  private readonly minSizeBySeed = new Map<number, { cols: number; rows: number }>();
  private office: GeneratedOffice | null = null;
  private lastSig?: string;
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private furniture = new Map<string, FurnitureSprite>();
  private debugLayer?: Phaser.GameObjects.Graphics;
  private blocked = new Set<string>();
  private readonly agents: OfficeAgent[] = [];
  /** pixtuoid FloorCapacitySweep의 fetch_max: 한 번 본 수용 인원은 줄이지 않습니다. */
  private capacity = 0;
  private agentSerial = 0;

  private readonly catalog: FurnitureCatalog;

  constructor(catalog: FurnitureCatalog) {
    super('PixelAgentsOfficeScene');
    this.catalog = catalog;
    this.layoutFor = createOfficeLayoutMemo(catalog);
  }

  preload() {
    preloadPixelAgentsAssets(this, this.catalog);
    preloadCharacterAssets(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f1418');
    this.cameras.main.setZoom(VIEW_SCALE);
  }

  update(time: number, delta: number) {
    const cols = Math.floor(this.scale.width / (T * VIEW_SCALE));
    const rows = Math.floor(this.scale.height / (T * VIEW_SCALE));
    const seed = Number(this.registry.get(PIXEL_AGENTS_SEED_KEY) ?? 0);
    const agentTarget = Number(this.registry.get(PIXEL_AGENTS_AGENT_COUNT_KEY) ?? 10);

    // pixtuoid run_tui: 이벤트 대신 매 프레임 크기 시그니처를 비교합니다.
    const sig = `${cols}x${rows}:${seed}`;
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.rebuild(cols, rows, seed, time);
    }

    if (this.office) {
      if (this.syncAgentCount(agentTarget, time)) this.emitStats(cols, rows, seed);
      this.agents.forEach((agent) => this.tickAgent(agent, time, delta));
      this.animatePcs(time);
      this.debugLayer?.setVisible(Boolean(this.registry.get(PIXEL_AGENTS_DEBUG_KEY)));
    }
  }

  private rebuild(cols: number, rows: number, seed: number, time: number) {
    this.worldObjects.forEach((object) => object.destroy());
    this.worldObjects = [];
    this.furniture.clear();
    this.debugLayer = undefined;

    this.office = this.layoutFor(cols, rows, seed);
    if (!this.office) {
      this.agents.forEach((agent) => agent.character.sprite.setVisible(false));
      this.emitStats(cols, rows, seed);
      return;
    }

    const { layout } = this.office;
    this.blocked = getBlockedTiles(layout, this.catalog);
    this.capacity = Math.max(this.capacity, this.office.workstations.length);

    this.drawTiles();
    this.drawFurniture();
    this.drawDebugLayer();

    const camera = this.cameras.main;
    camera.setBounds(0, 0, layout.cols * T, layout.rows * T);
    camera.centerOn((layout.cols * T) / 2, (layout.rows * T) / 2);

    // pixtuoid invalidate_routes: 경로는 새 지형 기준으로 다시 찾고, 책상이 사라진 에이전트는 숨기기만 합니다.
    this.agents.forEach((agent) => this.resetAgentToDesk(agent, time));
    this.emitStats(cols, rows, seed);
  }

  private drawTiles() {
    const { layout } = this.office!;
    if (this.textures.exists(FLOOR_GRID_TEXTURE)) this.textures.remove(FLOOR_GRID_TEXTURE);
    const grid = this.textures.createCanvas(FLOOR_GRID_TEXTURE, layout.cols * T, layout.rows * T)!;
    const ctx = grid.context;
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        const tile = getTile(layout, col, row);
        if (tile === TileType.VOID) continue;
        const color = layout.tileColors?.[row * layout.cols + col];
        if (tile === TileType.WALL) {
          ctx.fillStyle = wallBaseColor(color);
          ctx.fillRect(col * T, row * T, T, T);
          const mask = wallMask(layout, col, row);
          const piece = this.add
            .image(col * T, row * T + T - WALL_PIECE_HEIGHT, ensureWallTexture(this, mask, color))
            .setOrigin(0, 0)
            .setDepth((row + 1) * T);
          this.worldObjects.push(piece);
          continue;
        }
        const source = this.textures.get(ensureFloorTexture(this, tile, color)).getSourceImage() as CanvasImageSource;
        ctx.drawImage(source, col * T, row * T);
      }
    }
    grid.refresh();
    this.worldObjects.push(this.add.image(0, 0, FLOOR_GRID_TEXTURE).setOrigin(0, 0).setDepth(-1));
  }

  private drawFurniture() {
    const { layout } = this.office!;
    for (const instance of layoutToDrawInstances(layout, this.catalog)) {
      const image = this.add
        .image(instance.x, instance.y, furnitureTextureKey(instance.type))
        .setOrigin(0, 0)
        .setFlipX(instance.mirrored)
        .setDepth(instance.zY);
      this.worldObjects.push(image);
      this.furniture.set(instance.uid, { image, entry: instance.entry, uid: instance.uid });
    }
  }

  /** 제약 확인용: 빨강 = 보행 차단(footprint − background 행), 초록 = 좌석, 파랑 = 휴식 지점. */
  private drawDebugLayer() {
    const { layout, waypoints } = this.office!;
    const g = this.add.graphics().setDepth(1_000_000);
    this.blocked.forEach((key) => {
      const [c, r] = key.split(',').map(Number);
      g.fillStyle(0xff4d4d, 0.35).fillRect(c * T, r * T, T, T);
    });
    for (const seat of layoutToSeats(layout, this.catalog)) {
      g.lineStyle(1, 0x5dff8a, 0.95).strokeRect(seat.col * T + 1.5, seat.row * T + 1.5, T - 3, T - 3);
    }
    for (const wp of waypoints) {
      g.fillStyle(0x5db8ff, 0.9).fillRect(wp.col * T + 6, wp.row * T + 6, 4, 4);
    }
    g.setVisible(false);
    this.debugLayer = g;
    this.worldObjects.push(g);
  }

  private syncAgentCount(target: number, time: number): boolean {
    const allowed = Math.min(target, this.capacity);
    const before = this.agents.length;
    while (this.agents.length > allowed) this.agents.pop()!.character.destroy();
    while (this.agents.length < allowed) {
      const used = new Set(this.agents.map((agent) => agent.deskIndex));
      let deskIndex = 0;
      while (used.has(deskIndex)) deskIndex++;
      const id = `pixel-agent-${this.agentSerial++}`;
      const entry = this.office!.entry;
      const character = new Character(this, {
        id,
        textureKey: `character:${hashString(id) % CHARACTER_COUNT}`,
        x: entry.col * T + T / 2,
        y: entry.row * T + T / 2,
        direction: 'north',
        status: 'idle',
      });
      const agent: OfficeAgent = {
        id,
        deskIndex,
        character,
        phase: 'entering',
        phaseUntil: 0,
        tile: { ...entry },
        path: [],
        stepProgress: 0,
      };
      this.agents.push(agent);
      this.sendToDesk(agent, 'entering', time);
    }
    return this.agents.length !== before;
  }

  private workstationOf(agent: OfficeAgent) {
    return this.office?.workstations[agent.deskIndex];
  }

  private resetAgentToDesk(agent: OfficeAgent, time: number) {
    const workstation = this.workstationOf(agent);
    agent.path = [];
    agent.stepFrom = undefined;
    agent.breakTarget = undefined;
    if (!workstation) {
      agent.character.sprite.setVisible(false);
      return;
    }
    agent.character.sprite.setVisible(true);
    this.sitAt(agent, workstation.seat);
    this.setPhase(agent, 'working', time);
  }

  private sendToDesk(agent: OfficeAgent, phase: 'entering' | 'returning', time: number) {
    const workstation = this.workstationOf(agent);
    if (!workstation) return;
    if (!this.walkTo(agent, workstation.seat)) {
      this.sitAt(agent, workstation.seat);
      this.setPhase(agent, 'working', time);
      return;
    }
    agent.phase = phase;
  }

  private walkTo(agent: OfficeAgent, target: { col: number; row: number }): boolean {
    const office = this.office!;
    // 목표 좌석 타일만 차단에서 제외합니다(pixel-agents getBlockedTiles의 excludeTiles).
    const blocked = new Set(this.blocked);
    blocked.delete(tileKey(target.col, target.row));
    const path = findPath(office.layout, blocked, agent.tile, target);
    if (path.length === 0) return false;
    agent.seat = undefined;
    agent.path = path;
    agent.stepProgress = 0;
    agent.stepFrom = undefined;
    agent.character.setStatus('walking');
    return true;
  }

  private sitAt(agent: OfficeAgent, seat: LayoutSeat) {
    agent.tile = { col: seat.col, row: seat.row };
    agent.seat = seat;
    agent.character.setDirection(seat.facing as Direction);
    this.placeCharacter(agent, seat.col * T + T / 2, seat.row * T + T / 2, true);
  }

  private placeCharacter(agent: OfficeAgent, x: number, footY: number, seated: boolean) {
    agent.character.setPosition(x, footY + (seated ? SITTING_OFFSET_PX : 0));
    // pixel-agents renderer: 캐릭터 z = 타일 하단 + 0.5 → 같은 행 의자보다 앞, 아래 행 책상보다 뒤.
    agent.character.setDepth(footY + T / 2 + 0.5);
  }

  private setPhase(agent: OfficeAgent, phase: AgentPhase, time: number) {
    agent.phase = phase;
    const durations: Partial<Record<AgentPhase, [number, number]>> = {
      working: [7000, 15000],
      thinking: [2500, 5000],
      'on-break': [5000, 10000],
    };
    const range = durations[phase];
    agent.phaseUntil = range ? time + Phaser.Math.Between(range[0], range[1]) : 0;
    if (phase === 'working') agent.character.setStatus('typing');
    if (phase === 'thinking' || (phase === 'on-break' && agent.seat)) agent.character.setStatus('sitting');
    if (phase === 'on-break' && !agent.seat) agent.character.setStatus('idle');
  }

  private tickAgent(agent: OfficeAgent, time: number, delta: number) {
    if (!agent.character.sprite.visible) return;

    if (agent.path.length > 0) {
      this.stepAlongPath(agent, delta);
      if (agent.path.length === 0) this.arrive(agent, time);
      return;
    }

    if (agent.phaseUntil === 0 || time < agent.phaseUntil) return;
    if (agent.phase === 'working') {
      this.setPhase(agent, 'thinking', time);
    } else if (agent.phase === 'thinking') {
      if (Math.random() < 0.45 && this.startBreak(agent)) return;
      this.setPhase(agent, 'working', time);
    } else if (agent.phase === 'on-break') {
      this.sendToDesk(agent, 'returning', time);
    }
  }

  private startBreak(agent: OfficeAgent): boolean {
    const taken = new Set(this.agents.filter((other) => other !== agent && other.breakTarget).map((other) => tileKey(other.breakTarget!.col, other.breakTarget!.row)));
    const options = this.office!.waypoints.filter((wp) => !taken.has(tileKey(wp.col, wp.row)));
    if (options.length === 0) return false;
    const target = options[Phaser.Math.Between(0, options.length - 1)];
    if (!this.walkTo(agent, target)) return false;
    agent.breakTarget = target;
    agent.phase = 'to-break';
    return true;
  }

  private arrive(agent: OfficeAgent, time: number) {
    if (agent.phase === 'to-break' && agent.breakTarget) {
      if (agent.breakTarget.seat) this.sitAt(agent, agent.breakTarget.seat);
      this.setPhase(agent, 'on-break', time);
      return;
    }
    agent.breakTarget = undefined;
    const workstation = this.workstationOf(agent);
    if (workstation) this.sitAt(agent, workstation.seat);
    this.setPhase(agent, 'working', time);
  }

  private stepAlongPath(agent: OfficeAgent, delta: number) {
    const next = agent.path[0];
    if (!agent.stepFrom) {
      agent.stepFrom = { x: agent.tile.col * T + T / 2, y: agent.tile.row * T + T / 2 };
      const dc = next.col - agent.tile.col;
      const dr = next.row - agent.tile.row;
      agent.character.setDirection(dc > 0 ? 'east' : dc < 0 ? 'west' : dr < 0 ? 'north' : 'south');
    }
    agent.stepProgress = Math.min(1, agent.stepProgress + (delta / 1000) * WALK_TILES_PER_SECOND);
    const toX = next.col * T + T / 2;
    const toY = next.row * T + T / 2;
    const x = Phaser.Math.Linear(agent.stepFrom.x, toX, agent.stepProgress);
    const y = Phaser.Math.Linear(agent.stepFrom.y, toY, agent.stepProgress);
    this.placeCharacter(agent, x, y, false);
    if (agent.stepProgress >= 1) {
      agent.tile = next;
      agent.path.shift();
      agent.stepFrom = undefined;
      agent.stepProgress = 0;
    }
  }

  /** manifest의 state/animation 그룹: 작업 중인 책상의 PC는 `on` 프레임을 순환합니다. */
  private animatePcs(time: number) {
    const working = new Set(
      this.agents
        .filter((agent) => agent.phase === 'working' || agent.phase === 'thinking')
        .filter((agent) => agent.path.length === 0 && agent.character.sprite.visible)
        .map((agent) => this.workstationOf(agent)?.pcUid)
        .filter((uid): uid is string => Boolean(uid)),
    );
    for (const workstation of this.office!.workstations) {
      if (!workstation.pcUid) continue;
      const sprite = this.furniture.get(workstation.pcUid);
      if (!sprite) continue;
      const frames = getOnAnimationFrames(this.catalog, sprite.entry.type);
      const type = working.has(workstation.pcUid) && frames.length > 0 ? frames[Math.floor(time / PC_FRAME_MS) % frames.length].type : sprite.entry.type;
      const key = furnitureTextureKey(type);
      if (sprite.image.texture.key !== key) sprite.image.setTexture(key);
    }
  }

  private emitStats(cols: number, rows: number, seed: number) {
    if (!this.minSizeBySeed.has(seed)) this.minSizeBySeed.set(seed, minOfficeSize(this.catalog, seed));
    const min = this.minSizeBySeed.get(seed)!;
    const office = this.office;
    const visibleAgents = office ? this.agents.filter((agent) => agent.deskIndex < office.workstations.length).length : 0;
    const stats: PixelAgentsOfficeStats = {
      cols,
      rows,
      seed,
      variant: office?.variant,
      tooSmall: !office,
      minCols: min.cols,
      minRows: min.rows,
      desks: office?.workstations.length ?? 0,
      capacity: this.capacity,
      furniture: office?.layout.furniture.length ?? 0,
      seats: office ? layoutToSeats(office.layout, this.catalog).length : 0,
      visibleAgents,
      hiddenAgents: this.agents.length - visibleAgents,
      skipped: office?.skipped ?? [],
    };
    this.game.events.emit(PIXEL_AGENTS_STATS_EVENT, stats);
  }
}

function wallMask(layout: GeneratedOffice['layout'], col: number, row: number) {
  const isWall = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < layout.cols && r < layout.rows && getTile(layout, c, r) === TileType.WALL;
  return (isWall(col, row - 1) ? 1 : 0) | (isWall(col + 1, row) ? 2 : 0) | (isWall(col, row + 1) ? 4 : 0) | (isWall(col - 1, row) ? 8 : 0);
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}
