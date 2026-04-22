import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';

import type { GridPoint } from '../domain/index.js';
import { Character, CHARACTER_COUNT, preloadCharacterAssets } from '../game/entities/Character.js';
import { SpeechBubble } from '../game/entities/SpeechBubble.js';
import { PathfindingSystem, type PathNode } from '../game/systems/PathfindingSystem.js';
import { DemoNavigation } from './DemoNavigation.js';

const AGENT_COUNT = 16;
const PIXEL_VIEW_SCALE = 2;
const TILE_SIZE = 16 * PIXEL_VIEW_SCALE;
const MOVE_STEP_DURATION_MS = 440;
const REPLAN_DELAY_MS = 360;
const STREAM_VISIBLE_LINE_COUNT = 5;
const STREAM_MAX_TOTAL_LINE_COUNT = 18;
const STREAM_STEP_MS = 520;
const STREAM_HOLD_MS = 2800;
const STREAM_RESTART_MIN_MS = 1400;
const STREAM_RESTART_MAX_MS = 5200;
const GREETING_CHANCE_PERCENT = 32;
const GREETING_DURATION_MS = 1800;
const GREETING_COOLDOWN_MS = 5200;

const furnitureAssets = [
  { key: 'random-furniture-table', url: '/assets/furniture/desks/TABLE_WOOD.png' },
  { key: 'random-furniture-table-lg', url: '/assets/furniture/desks/TABLE_WOOD_LG.png' },
  { key: 'random-furniture-desk', url: '/assets/furniture/desks/TABLE_WOOD_VERTICAL.png' },
  { key: 'random-furniture-chair-back', url: '/assets/furniture/chairs/CHAIR_CUSHIONED_BACK.png' },
  { key: 'random-furniture-chair-front', url: '/assets/furniture/chairs/CHAIR_CUSHIONED_FRONT.png' },
  { key: 'random-furniture-chair-left', url: '/assets/furniture/chairs/CHAIR_CUSHIONED_LEFT.png' },
  { key: 'random-furniture-chair-right', url: '/assets/furniture/chairs/CHAIR_CUSHIONED_RIGHT.png' },
  { key: 'random-furniture-plant-1', url: '/assets/furniture/decor/PLANT_1.png' },
  { key: 'random-furniture-plant-2', url: '/assets/furniture/decor/PLANT_2.png' },
  { key: 'random-furniture-bookshelf', url: '/assets/furniture/storage/FULL_BOOKSHELF_TALL.png' },
  { key: 'random-furniture-cabinet', url: '/assets/furniture/storage/FULL_CABINET_TALL.png' },
  { key: 'random-furniture-server', url: '/assets/furniture/electronics/SERVER.png' },
  { key: 'random-furniture-water', url: '/assets/furniture/misc/WATER_COOLER.png' },
] as const;

type FurnitureKey = (typeof furnitureAssets)[number]['key'];

const workstationDeskAssets = ['random-furniture-table', 'random-furniture-table-lg', 'random-furniture-desk'] as const;
const supportFurnitureAssets = [
  'random-furniture-plant-1',
  'random-furniture-plant-2',
  'random-furniture-bookshelf',
  'random-furniture-cabinet',
  'random-furniture-server',
  'random-furniture-water',
] as const;

const chatterTopics = [
  [
    '밤길 위로 불빛이 흐른다',
    '작은 마음이 리듬을 찾는다',
    '우리는 먼 창가에 기대었다',
    '내일의 문이 조용히 열린다',
    '발끝에 남은 박자가 반짝인다',
    '도시는 낮은 숨으로 노래한다',
  ],
  [
    '자신을 넘어서는 일이 성장이다',
    '깊은 사유는 고독을 두려워하지 않는다',
    '가치는 주어진 것보다 만들어지는 것이다',
    '익숙한 도덕도 다시 물어야 한다',
    '높이 오를수록 바람은 차갑다',
    '자기 자신에게 정직해야 한다',
  ],
  [
    'Strategy는 알고리즘을 갈아끼운다',
    'Observer는 변경을 구독자에게 알린다',
    'Adapter는 맞지 않는 인터페이스를 잇는다',
    'Factory는 생성 책임을 한곳에 모은다',
    'Decorator는 기능을 겹겹이 더한다',
    'Command는 요청을 객체로 보관한다',
  ],
  [
    '고객 없는 최적화는 낭비다',
    '빠른 학습이 완벽한 계획보다 낫다',
    '작은 실험이 큰 방향을 만든다',
    '지표는 행동을 바꿀 때 의미가 있다',
    '문제의 빈도가 시장의 크기다',
    '반복 가능한 판매가 진짜 신호다',
  ],
  [
    '오후에는 구름이 조금 걷힐 듯하다',
    '바람이 약해서 산책하기 좋다',
    '비 냄새가 회의실까지 들어온다',
    '햇빛이 책상 위로 길게 놓였다',
    '습도가 높아 커피 향이 오래 간다',
    '저녁에는 기온이 살짝 내려간다',
  ],
] as const;

const greetings = ['안녕하세요', '반가워요', 'Hello', 'Hola', 'Bonjour', 'こんにちは', '你好', 'Ciao', 'Guten Tag'] as const;

interface DemoAgent {
  character: Character;
  tile: GridPoint;
  chatterLines: readonly string[];
  bubble?: SpeechBubble;
  moving: boolean;
  nextSpeakAt: number;
  lastGreetingAt: number;
  streamTimers: Phaser.Time.TimerEvent[];
}

export function DemoRandomOfficeChatterRoute() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      backgroundColor: '#121a20',
      scale: {
        mode: Phaser.Scale.NONE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
      scene: [RandomOfficeChatterScene],
    });

    const resize = () => {
      game.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      game.destroy(true);
    };
  }, []);

  return (
    <div className="random-office-demo" aria-label="랜덤 오피스 잡담 데모">
      <div className="random-office-host" ref={hostRef} />
      <DemoNavigation />
    </div>
  );
}

class RandomOfficeChatterScene extends Phaser.Scene {
  private readonly agents: DemoAgent[] = [];
  private readonly blockedTiles = new Set<string>();
  private readonly reservedTiles = new Map<DemoAgent, string>();
  private worldWidth = 0;
  private worldHeight = 0;
  private floor?: Phaser.GameObjects.Graphics;
  private furnitureGroup?: Phaser.GameObjects.Group;

  constructor() {
    super('RandomOfficeChatterScene');
  }

  preload() {
    preloadCharacterAssets(this);
    furnitureAssets.forEach((asset) => this.load.image(asset.key, asset.url));
  }

  create() {
    this.worldWidth = this.scale.width;
    this.worldHeight = this.scale.height;
    this.cameras.main.setBackgroundColor('#121a20');
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight, true);
    this.placeFurniture();
    this.drawFloor();
    this.spawnAgents();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this));
  }

  update(time: number) {
    this.agents.forEach((agent) => {
      agent.character.setDepth(getDepth(agent.character.sprite.y));
      if (agent.bubble && !agent.bubble.update(time)) {
        agent.bubble.destroy();
        agent.bubble = undefined;
      }
      if (!agent.bubble && time >= agent.nextSpeakAt) {
        this.startStreamingSpeech(agent, time);
      }
    });
  }

  private handleResize() {
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight, true);
  }

  private drawFloor() {
    this.floor?.destroy();
    const floor = this.add.graphics();
    floor.fillStyle(0x152027, 1);
    floor.fillRect(0, 0, this.worldWidth, this.worldHeight);

    for (let y = 0; y < this.gridHeight; y += 1) {
      for (let x = 0; x < this.gridWidth; x += 1) {
        const point = { x, y };
        const tileX = x * TILE_SIZE;
        const tileY = y * TILE_SIZE;
        const isBoundary = x === 0 || y === 0 || x === this.gridWidth - 1 || y === this.gridHeight - 1;
        const isBlocked = this.blockedTiles.has(toTileKey(point));
        const isNearFurniture = !isBlocked && this.isNearBlockedTile(point);

        floor.fillStyle(getFloorTileColor(isBoundary, isBlocked, isNearFurniture), 1);
        floor.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
      }
    }

    floor.lineStyle(1, 0x2b3b45, 0.52);
    for (let x = 0; x <= this.worldWidth; x += TILE_SIZE) {
      floor.lineBetween(x, 0, x, this.worldHeight);
    }
    for (let y = 0; y <= this.worldHeight; y += TILE_SIZE) {
      floor.lineBetween(0, y, this.worldWidth, y);
    }
    floor.setDepth(-1000);
    this.floor = floor;
  }

  private placeFurniture() {
    this.furnitureGroup?.clear(true, true);
    this.furnitureGroup = this.add.group();
    this.blockedTiles.clear();
    this.reservedTiles.clear();
    this.placeWorkstations();
    this.placeSupportFurniture();
  }

  private placeWorkstations() {
    const startX = 3;
    const startY = 3;
    const columnStep = 5;
    const rowStep = 4;
    const maxColumns = Math.max(1, Math.floor((this.gridWidth - startX - 2) / columnStep));
    const maxRows = Math.max(1, Math.floor((this.gridHeight - startY - 2) / rowStep));
    const workstationLimit = Math.min(Math.max(6, Math.floor((this.worldWidth * this.worldHeight) / 70000)), 18);
    let placed = 0;

    for (let row = 0; row < maxRows && placed < workstationLimit; row += 1) {
      for (let column = 0; column < maxColumns && placed < workstationLimit; column += 1) {
        const anchor = {
          x: startX + column * columnStep,
          y: startY + row * rowStep,
        };
        if (this.canPlaceWorkstation(anchor)) {
          this.placeWorkstation(anchor, placed % 2 === 0 ? 'south' : 'east');
          placed += 1;
        }
      }
    }
  }

  private placeWorkstation(anchor: GridPoint, facing: 'south' | 'east') {
    if (facing === 'south') {
      this.addFurniture(anchor, pickRandom(workstationDeskAssets));
      this.addFurniture({ x: anchor.x, y: anchor.y + 1 }, 'random-furniture-chair-back');
      this.addFurniture({ x: anchor.x + 1, y: anchor.y }, 'random-furniture-chair-left');
      return;
    }

    this.addFurniture(anchor, 'random-furniture-desk');
    this.addFurniture({ x: anchor.x - 1, y: anchor.y }, 'random-furniture-chair-right');
    this.addFurniture({ x: anchor.x, y: anchor.y + 1 }, 'random-furniture-chair-back');
  }

  private canPlaceWorkstation(anchor: GridPoint) {
    return [
      anchor,
      { x: anchor.x, y: anchor.y + 1 },
      { x: anchor.x + 1, y: anchor.y },
      { x: anchor.x - 1, y: anchor.y },
      { x: anchor.x + 1, y: anchor.y + 1 },
    ].every((point) => this.isOpenTile(point));
  }

  private placeSupportFurniture() {
    const count = Math.max(8, Math.floor((this.worldWidth * this.worldHeight) / 52000));

    for (let index = 0; index < count; index += 1) {
      const tile = this.getSupportFurnitureTile(index);
      if (!tile) continue;
      this.addFurniture(tile, pickRandom(supportFurnitureAssets));
    }
  }

  private getSupportFurnitureTile(index: number) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const nearWall = index % 3 !== 0;
      const point = nearWall
        ? {
            x: Phaser.Math.Between(1, Math.max(1, this.gridWidth - 2)),
            y: pickRandom([1, Math.max(1, this.gridHeight - 2)]),
          }
        : this.getRandomOpenTile();
      if (point && this.isOpenTile(point)) return point;
    }
    return undefined;
  }

  private addFurniture(tile: GridPoint, key: FurnitureKey) {
    const sprite = this.add.image(tileCenter(tile.x), tileBottom(tile.y), key);
    sprite.setOrigin(0.5, 1);
    sprite.setScale(PIXEL_VIEW_SCALE);
    sprite.setDepth(getDepth(sprite.y) - 0.02);
    sprite.setAlpha(0.96);
    this.furnitureGroup?.add(sprite);
    this.blockFurnitureFootprint(tile, sprite);
  }

  private spawnAgents() {
    this.agents.forEach((agent) => {
      this.tweens.killTweensOf(agent.character.sprite);
      this.reservedTiles.delete(agent);
      this.clearStreamTimers(agent);
      agent.bubble?.destroy();
      agent.character.destroy();
    });
    this.agents.length = 0;

    for (let index = 0; index < AGENT_COUNT; index += 1) {
      const tile = this.getRandomOpenTile();
      if (!tile) continue;
      const character = new Character(this, {
        id: `random-demo-agent-${index}`,
        textureKey: `character:${index % CHARACTER_COUNT}`,
        x: tileCenter(tile.x),
        y: tileBottom(tile.y),
        direction: 'south',
        status: 'idle',
      });
      character.sprite.setScale(PIXEL_VIEW_SCALE);
      const agent: DemoAgent = {
        character,
        tile,
        chatterLines: pickRandom(chatterTopics),
        moving: false,
        nextSpeakAt: this.time.now + Phaser.Math.Between(200, 2400),
        lastGreetingAt: -GREETING_COOLDOWN_MS,
        streamTimers: [],
      };
      this.agents.push(agent);
      this.moveAgentToRandomDestination(agent);
    }
  }

  private moveAgentToRandomDestination(agent: DemoAgent) {
    if (agent.moving) return;
    const destination = this.getRandomAvailableTile(agent);
    if (!destination) return;
    const path = this.createPathfinder(agent).findPath(agent.tile, destination);
    if (path.length === 0) {
      this.time.delayedCall(Phaser.Math.Between(250, 900), () => this.moveAgentToRandomDestination(agent));
      return;
    }
    this.moveAgentAlongPath(agent, path);
  }

  private startStreamingSpeech(agent: DemoAgent, now: number) {
    this.clearStreamTimers(agent);
    agent.bubble?.destroy();

    const totalLineCount = getRandomStreamLineCount();
    const streamDuration = totalLineCount * STREAM_STEP_MS + STREAM_HOLD_MS;
    const lines = createStreamingLines(agent.chatterLines, totalLineCount);
    agent.bubble = new SpeechBubble(this, {
      target: agent.character.sprite,
      message: lines[0],
      durationMs: streamDuration,
    });

    for (let index = 1; index < lines.length; index += 1) {
      const timer = this.time.delayedCall(index * STREAM_STEP_MS, () => {
        const visibleStart = Math.max(0, index + 1 - STREAM_VISIBLE_LINE_COUNT);
        const visibleLines = lines.slice(visibleStart, index + 1);
        agent.bubble?.reset(visibleLines.join('\n'), STREAM_HOLD_MS + STREAM_STEP_MS, this.time.now);
      });
      agent.streamTimers.push(timer);
    }

    const clearTimer = this.time.delayedCall(streamDuration, () => {
      agent.bubble?.destroy();
      agent.bubble = undefined;
      agent.nextSpeakAt = this.time.now + Phaser.Math.Between(STREAM_RESTART_MIN_MS, STREAM_RESTART_MAX_MS);
      this.clearStreamTimers(agent);
    });
    agent.streamTimers.push(clearTimer);
    agent.nextSpeakAt = now + streamDuration + Phaser.Math.Between(STREAM_RESTART_MIN_MS, STREAM_RESTART_MAX_MS);
  }

  private clearStreamTimers(agent: DemoAgent) {
    agent.streamTimers.forEach((timer) => timer.remove(false));
    agent.streamTimers.length = 0;
  }

  private moveAgentAlongPath(agent: DemoAgent, path: PathNode[]) {
    const [next, ...remaining] = path;
    if (!next) {
      agent.moving = false;
      this.reservedTiles.delete(agent);
      agent.character.setStatus('idle');
      this.time.delayedCall(Phaser.Math.Between(250, 1100), () => this.moveAgentToRandomDestination(agent));
      return;
    }

    if (!this.isAvailableForAgent(agent, next)) {
      agent.moving = false;
      this.reservedTiles.delete(agent);
      agent.character.setStatus('idle');
      this.time.delayedCall(REPLAN_DELAY_MS, () => this.moveAgentToRandomDestination(agent));
      return;
    }

    agent.moving = true;
    this.reservedTiles.set(agent, toTileKey(next));
    agent.character.setDirection(next.direction);
    agent.character.setStatus('walking');
    this.tweens.add({
      targets: agent.character.sprite,
      x: tileCenter(next.x),
      y: tileBottom(next.y),
      duration: MOVE_STEP_DURATION_MS,
      ease: 'Linear',
      onUpdate: () => agent.character.setDepth(getDepth(agent.character.sprite.y)),
      onComplete: () => {
        agent.tile = { x: next.x, y: next.y };
        this.reservedTiles.delete(agent);
        agent.character.setDepth(getDepth(agent.character.sprite.y));
        this.tryGreetNearbyAgent(agent);
        this.moveAgentAlongPath(agent, remaining);
      },
    });
  }

  private tryGreetNearbyAgent(agent: DemoAgent) {
    const now = this.time.now;
    if (now - agent.lastGreetingAt < GREETING_COOLDOWN_MS) return;
    if (Phaser.Math.Between(1, 100) > GREETING_CHANCE_PERCENT) return;
    const other = this.agents.find((candidate) => candidate !== agent && manhattan(candidate.tile, agent.tile) === 1);
    if (!other) return;

    agent.lastGreetingAt = now;
    other.lastGreetingAt = now;
    this.showGreeting(agent);
  }

  private showGreeting(agent: DemoAgent) {
    this.clearStreamTimers(agent);
    agent.bubble?.destroy();
    agent.bubble = new SpeechBubble(this, {
      target: agent.character.sprite,
      message: pickRandom(greetings),
      durationMs: GREETING_DURATION_MS,
    });
    const timer = this.time.delayedCall(GREETING_DURATION_MS, () => {
      agent.bubble?.destroy();
      agent.bubble = undefined;
      agent.nextSpeakAt = this.time.now + Phaser.Math.Between(STREAM_RESTART_MIN_MS, STREAM_RESTART_MAX_MS);
      this.clearStreamTimers(agent);
    });
    agent.streamTimers.push(timer);
    agent.nextSpeakAt = this.time.now + GREETING_DURATION_MS + Phaser.Math.Between(STREAM_RESTART_MIN_MS, STREAM_RESTART_MAX_MS);
  }

  private createPathfinder(agent: DemoAgent) {
    return new PathfindingSystem(this.gridWidth, this.gridHeight, (point) => this.isAvailableForAgent(agent, point));
  }

  private getRandomOpenTile() {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const point = {
        x: Phaser.Math.Between(1, Math.max(1, this.gridWidth - 2)),
        y: Phaser.Math.Between(2, Math.max(2, this.gridHeight - 2)),
      };
      if (this.isOpenTile(point)) return point;
    }
    return undefined;
  }

  private getRandomAvailableTile(agent: DemoAgent) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const point = this.getRandomOpenTile();
      if (point && this.isAvailableForAgent(agent, point)) return point;
    }
    return undefined;
  }

  private blockFurnitureFootprint(origin: GridPoint, sprite: Phaser.GameObjects.Image) {
    const width = Math.max(1, Math.ceil(sprite.displayWidth / TILE_SIZE));
    const height = Math.max(1, Math.ceil(sprite.displayHeight / TILE_SIZE));
    const left = origin.x - Math.floor(width / 2);
    const top = origin.y - height + 1;

    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        if (this.isInsideGrid({ x, y })) {
          this.blockedTiles.add(toTileKey({ x, y }));
        }
      }
    }
  }

  private isOpenTile(point: GridPoint) {
    return this.isInsideGrid(point) && !this.blockedTiles.has(toTileKey(point));
  }

  private isNearBlockedTile(point: GridPoint) {
    return [
      { x: point.x, y: point.y - 1 },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x - 1, y: point.y },
    ].some((candidate) => this.blockedTiles.has(toTileKey(candidate)));
  }

  private isAvailableForAgent(agent: DemoAgent, point: GridPoint) {
    if (!this.isOpenTile(point)) return false;
    const key = toTileKey(point);

    return this.agents.every((other) => {
      if (other === agent) return true;
      return toTileKey(other.tile) !== key && this.reservedTiles.get(other) !== key;
    });
  }

  private isInsideGrid(point: GridPoint) {
    return point.x >= 1 && point.y >= 1 && point.x < this.gridWidth - 1 && point.y < this.gridHeight - 1;
  }

  private get gridWidth() {
    return Math.max(3, Math.floor(this.worldWidth / TILE_SIZE));
  }

  private get gridHeight() {
    return Math.max(3, Math.floor(this.worldHeight / TILE_SIZE));
  }
}

function getDepth(y: number) {
  return y / 10000;
}

function getFloorTileColor(isBoundary: boolean, isBlocked: boolean, isNearFurniture: boolean) {
  if (isBoundary) return 0x11191f;
  if (isBlocked) return 0x172128;
  if (isNearFurniture) return 0x22343d;
  return 0x1c2a32;
}

function manhattan(a: GridPoint, b: GridPoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pickRandom<T>(items: readonly T[]) {
  return items[Phaser.Math.Between(0, items.length - 1)];
}

function getRandomStreamLineCount() {
  const roll = Phaser.Math.Between(1, 100);
  if (roll <= 70) return Phaser.Math.Between(1, 2);
  if (roll <= 90) return Phaser.Math.Between(3, 5);
  return Phaser.Math.Between(6, STREAM_MAX_TOTAL_LINE_COUNT);
}

function createStreamingLines(source: readonly string[], count: number) {
  const pool = [...source];
  const lines: string[] = [];

  while (lines.length < count) {
    if (pool.length === 0) {
      pool.push(...source);
    }
    const index = Phaser.Math.Between(0, pool.length - 1);
    const [line] = pool.splice(index, 1);
    lines.push(line);
  }

  return lines;
}

function tileCenter(tile: number) {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

function tileBottom(tile: number) {
  return (tile + 1) * TILE_SIZE;
}

function toTileKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
