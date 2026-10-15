import * as Phaser from 'phaser';

import { isOccupiedByOtherAgent } from '@pixel-office/core/agentOccupancy';
import { Character, preloadCharacterAssets } from '@pixel-office/engine/character';
import { PathfindingSystem, type PathNode } from '@pixel-office/engine/pathfinding';
import type { GridPoint } from '@pixel-office/core';

const TILE = 16;
const COLS = 36;
const ROWS = 23;
export const PIXEL_OFFICE_SIZE = { width: COLS * TILE, height: ROWS * TILE };

const assets = {
  desk: 'DESK/DESK_FRONT', pc: 'PC/PC_FRONT_ON_1', chair: 'CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK',
  table: 'TABLE_FRONT/TABLE_FRONT', woodChair: 'WOODEN_CHAIR/WOODEN_CHAIR_SIDE',
  sofa: 'SOFA/SOFA_FRONT', sofaSide: 'SOFA/SOFA_SIDE', coffeeTable: 'COFFEE_TABLE/COFFEE_TABLE',
  plant: 'PLANT/PLANT', largePlant: 'LARGE_PLANT/LARGE_PLANT', cactus: 'CACTUS/CACTUS',
  board: 'WHITEBOARD/WHITEBOARD', books: 'DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF',
  shelf: 'BOOKSHELF/BOOKSHELF', clock: 'CLOCK/CLOCK', painting: 'LARGE_PAINTING/LARGE_PAINTING',
  hanging: 'HANGING_PLANT/HANGING_PLANT', coffee: 'COFFEE/COFFEE', bin: 'BIN/BIN',
  sideboard: 'SMALL_TABLE/SMALL_TABLE_FRONT',
} as const;
type Asset = keyof typeof assets;
interface Walker { character: Character; tile: GridPoint }
const key = (p: GridPoint) => `${p.x}:${p.y}`;

export class PixelAgentsOfficeScene extends Phaser.Scene {
  private blocked = new Set<string>();
  private agentTiles = new Map<string, GridPoint>();
  private reservedTiles = new Map<string, GridPoint>();
  private walkers: Walker[] = [];
  private characters: Character[] = [];

  constructor() { super('PixelAgentsOffice'); }

  preload() {
    preloadCharacterAssets(this);
    Object.entries(assets).forEach(([id, path]) => this.load.image(id, `${import.meta.env.BASE_URL}assets/furniture/${path}.png`));
    [0, 3, 6].forEach((id) => this.load.image(`floor-${id}`, `${import.meta.env.BASE_URL}assets/floors/floor_${id}.png`));
    this.load.spritesheet('office-wall', `${import.meta.env.BASE_URL}assets/walls/wall_0.png`, { frameWidth: 16, frameHeight: 32 });
  }

  create() {
    this.blocked.clear();
    this.agentTiles.clear();
    this.reservedTiles.clear();
    this.walkers = [];
    this.characters = [];
    this.drawRooms();
    this.furnish();
    this.spawnWalkers();
    this.resizeCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
      this.characters.forEach((character) => {
        this.tweens.killTweensOf(character.sprite);
        character.destroy();
      });
      this.agentTiles.clear();
      this.reservedTiles.clear();
      this.walkers = [];
      this.characters = [];
    });
  }

  private resizeCamera() {
    this.cameras.main.setZoom(this.scale.width / PIXEL_OFFICE_SIZE.width);
    this.cameras.main.centerOn(PIXEL_OFFICE_SIZE.width / 2, PIXEL_OFFICE_SIZE.height / 2);
    this.cameras.main.roundPixels = true;
  }

  private drawRooms() {
    for (let y = 2; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const meeting = x < 12 && y < 11;
        const lounge = x < 12 && y >= 12 && y < 20;
        const corridor = y >= 20 || x === 12 || x === 13;
        const floor = meeting || lounge ? 6 : corridor ? 3 : 0;
        const color = meeting ? 0xc5a678 : lounge ? 0xcab78f : corridor ? 0xb4b7ad : 0xb1c8bb;
        this.add.image(x * TILE, y * TILE, `floor-${floor}`).setOrigin(0).setTint(color).setDepth(-20);
      }
    }
    const walls = new Set<string>();
    for (let x = 0; x < COLS; x++) walls.add(key({ x, y: 1 }));
    for (let y = 2; y < ROWS - 1; y++) {
      walls.add(key({ x: 0, y }));
      walls.add(key({ x: COLS - 1, y }));
      if (y < 20 && ![8, 9, 17, 18].includes(y)) walls.add(key({ x: 12, y }));
    }
    for (let x = 1; x < 12; x++) walls.add(key({ x, y: 11 }));
    for (const cell of walls) {
      const [x, y] = cell.split(':').map(Number);
      const mask = (walls.has(key({ x, y: y - 1 })) ? 1 : 0)
        | (walls.has(key({ x: x + 1, y })) ? 2 : 0)
        | (walls.has(key({ x, y: y + 1 })) ? 4 : 0)
        | (walls.has(key({ x: x - 1, y })) ? 8 : 0);
      this.add.image(x * TILE, (y - 1) * TILE, 'office-wall', mask)
        .setOrigin(0).setTint(0xc0cbbb).setDepth((y + 1) * TILE);
      this.blocked.add(cell);
    }
    // 앞쪽 벽은 통로와 캐릭터를 가리지 않도록 낮게 표시한다.
    this.add.rectangle(0, (ROWS - 1) * TILE, COLS * TILE, 4, 0x485951).setOrigin(0).setDepth(1000);
    this.add.rectangle(14 * TILE, 20 * TILE, 20 * TILE, 1, 0xd0d7bf).setOrigin(0).setDepth(-10);
  }

  private place(id: Asset, x: number, y: number, backgroundRows = 0, decorative = false, flip = false) {
    const sprite = this.add.image(x * TILE, y * TILE, id).setOrigin(0).setFlipX(flip);
    const w = sprite.width / TILE;
    const h = sprite.height / TILE;
    sprite.setDepth(decorative ? (y + h) * TILE + 1 : (y + h) * TILE);
    if (!decorative) {
      for (let row = y + backgroundRows; row < y + h; row++) {
        for (let col = x; col < x + w; col++) this.blocked.add(key({ x: col, y: row }));
      }
    }
    return sprite;
  }

  private furnish() {
    this.place('board', 5, 0, 0, true);
    this.place('clock', 10, 0, 0, true);
    this.place('hanging', 1, 0, 0, true);
    this.place('shelf', 17, 1, 0, true);
    this.place('painting', 24, 0, 0, true);
    this.place('hanging', 33, 0, 0, true);
    this.place('largePlant', 1, 2, 2);
    this.place('table', 5, 4, 1);
    this.place('coffee', 6, 5, 0, true);
    for (const y of [5, 7]) {
      this.place('woodChair', 4, y, 1);
      this.place('woodChair', 8, y, 1, false, true);
    }
    this.place('books', 1, 8, 1);
    this.place('plant', 10, 8, 1);

    this.place('painting', 5, 10, 0, true);
    this.place('sofa', 4, 13, 1);
    this.place('sofaSide', 2, 15, 0);
    this.place('coffeeTable', 5, 15, 1);
    this.place('coffee', 5, 15, 0, true);
    this.place('largePlant', 9, 12, 2);
    this.place('sideboard', 2, 18, 1);
    this.place('coffee', 3, 19, 0, true);
    this.place('bin', 5, 19);
    this.place('plant', 10, 18, 1);

    let index = 0;
    for (const y of [4, 9, 14]) {
      for (const x of [15, 22, 29]) {
        this.place('desk', x, y, 1);
        this.place('pc', x + 1, y, 0, true).setDepth((y + 2) * TILE + 1);
        this.place('chair', x + 1, y + 2);
        if (index % 3 !== 2) {
          this.character(index, { x: x + 1, y: y + 2 }, true);
        }
        if (index % 3 === 0) this.place('coffee', x, y + 1, 0, true).setDepth((y + 2) * TILE + 2);
        index++;
      }
    }
    this.place('plant', 20, 6, 1);
    this.place('plant', 27, 11, 1);
    this.place('cactus', 33, 17, 1);
    this.place('books', 15, 18, 1);
    this.place('books', 18, 18, 1);
    this.place('sideboard', 24, 18, 1);
    this.place('coffee', 25, 19, 0, true);
    this.place('bin', 27, 19);
  }

  private character(index: number, tile: GridPoint, seated = false) {
    const character = new Character(this, {
      id: `office-demo-${index}`, textureKey: `character:${index % 6}`,
      x: (tile.x + 0.5) * TILE, y: (tile.y + 1) * TILE,
      direction: seated ? 'north' : 'south', status: seated ? 'typing' : 'idle',
    });
    character.setDepth(character.sprite.y + 0.5);
    this.characters.push(character);
    this.agentTiles.set(character.id, tile);
    return character;
  }

  private spawnWalkers() {
    [{ x: 13, y: 8 }, { x: 23, y: 21 }, { x: 9, y: 17 }, { x: 32, y: 12 }].forEach((tile, i) => {
      const walker = { character: this.character(i + 10, tile), tile };
      this.walkers.push(walker);
      this.time.delayedCall(800 + i * 500, () => this.wander(walker));
    });
  }

  private available(point: GridPoint, walker: Walker) {
    return point.x > 0 && point.x < COLS - 1 && point.y >= 2 && point.y < ROWS - 1
      && !this.blocked.has(key(point))
      && !isOccupiedByOtherAgent(this.agentTiles, this.reservedTiles, walker.character.id, point);
  }

  private wander(walker: Walker) {
    const target = { x: Phaser.Math.Between(1, COLS - 2), y: Phaser.Math.Between(2, ROWS - 2) };
    const path = new PathfindingSystem(COLS, ROWS, (p) => this.available(p, walker)).findPath(walker.tile, target);
    this.walk(walker, path);
  }

  private walk(walker: Walker, path: PathNode[]) {
    const [next, ...rest] = path;
    if (!next || !this.available(next, walker)) {
      this.reservedTiles.delete(walker.character.id);
      walker.character.setStatus('idle');
      this.time.delayedCall(Phaser.Math.Between(900, 2600), () => this.wander(walker));
      return;
    }
    this.reservedTiles.set(walker.character.id, next);
    walker.character.setDirection(next.direction);
    walker.character.setStatus('walking');
    this.tweens.add({
      targets: walker.character.sprite, x: (next.x + 0.5) * TILE, y: (next.y + 1) * TILE,
      duration: 300, ease: 'Linear',
      onUpdate: () => walker.character.setDepth(walker.character.sprite.y + 0.5),
      onComplete: () => {
        walker.tile = next;
        this.agentTiles.set(walker.character.id, next);
        this.reservedTiles.delete(walker.character.id);
        this.walk(walker, rest);
      },
    });
  }
}
