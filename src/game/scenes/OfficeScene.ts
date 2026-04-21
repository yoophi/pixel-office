import * as Phaser from 'phaser';

import { Character } from '../entities/Character.js';
import { createPathfindingSystemFromTilemap, type PathNode } from '../systems/PathfindingSystem.js';
import { createPhaserTilemap } from '../tiled/loader.js';
import { SAMPLE_MAP_KEY } from './BootScene.js';

const TARGET_TILE_SIZE = 16;

export class OfficeScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;
  private testCharacter?: Character;

  constructor() {
    super('OfficeScene');
  }

  create() {
    const { map, layers } = createPhaserTilemap(this, {
      mapKey: SAMPLE_MAP_KEY,
    });
    const pathfinding = createPathfindingSystemFromTilemap(map);

    layers.forEach((layer, index) => {
      layer.setDepth(index);
    });

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    const camera = this.cameras.main;
    camera.setBackgroundColor('#000000');
    camera.roundPixels = true;
    camera.setBounds(0, 0, worldWidth, worldHeight, true);
    camera.centerOn(worldWidth / 2, worldHeight / 2);
    camera.setZoom(getIntegerZoom(this.scale.width, this.scale.height, worldWidth, worldHeight));

    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: 'monospace',
      fontSize: '14px',
    });
    this.fpsText.setDepth(layers.length + 1);
    this.fpsText.setScrollFactor(0);
    this.testCharacter = new Character(this, {
      id: 'sample-agent',
      textureKey: 'character:0',
      x: tileCenter(3),
      y: tileBottom(3),
      direction: 'south',
      status: 'idle',
    });
    this.testCharacter.setDepth(layers.length);
    moveCharacterAlongPath(this, this.testCharacter, pathfinding.findPath({ x: 3, y: 3 }, { x: 16, y: 8 }));

    this.scale.on(Phaser.Scale.Events.RESIZE, (gameSize: Phaser.Structs.Size) => {
      camera.setZoom(getIntegerZoom(gameSize.width, gameSize.height, worldWidth, worldHeight));
      camera.centerOn(worldWidth / 2, worldHeight / 2);
    });
  }

  update() {
    if (!this.fpsText) return;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }
}

function getIntegerZoom(viewportWidth: number, viewportHeight: number, worldWidth: number, worldHeight: number) {
  const fitZoom = Math.min(viewportWidth / worldWidth, viewportHeight / worldHeight);
  return Math.max(1, Math.floor(fitZoom || TARGET_TILE_SIZE / TARGET_TILE_SIZE));
}

function moveCharacterAlongPath(scene: Phaser.Scene, character: Character, path: PathNode[]) {
  if (path.length === 0) {
    character.setStatus('typing');
    return;
  }

  const tweens = path.map((node, index) => ({
    targets: character.sprite,
    x: tileCenter(node.x),
    y: tileBottom(node.y),
    duration: index === 0 ? 0 : 220,
    onStart: () => {
      character.setDirection(node.direction);
      character.setStatus('walking');
    },
  }));

  scene.tweens.chain({
    tweens,
    onComplete: () => {
      character.setStatus('typing');
    },
  });
}

function tileCenter(tile: number) {
  return tile * TARGET_TILE_SIZE + TARGET_TILE_SIZE / 2;
}

function tileBottom(tile: number) {
  return (tile + 1) * TARGET_TILE_SIZE;
}
