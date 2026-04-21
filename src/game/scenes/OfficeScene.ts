import * as Phaser from 'phaser';

import { Character } from '../entities/Character.js';
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
      x: 56,
      y: 64,
      direction: 'south',
      status: 'idle',
    });
    this.testCharacter.setDepth(layers.length);

    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        if (!this.testCharacter) return;
        this.testCharacter.setStatus(getNextStatus(this.testCharacter.status));
      },
    });

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

function getNextStatus(status: Character['status']): Character['status'] {
  if (status === 'idle') return 'walking';
  if (status === 'walking') return 'typing';
  return 'idle';
}

function getIntegerZoom(viewportWidth: number, viewportHeight: number, worldWidth: number, worldHeight: number) {
  const fitZoom = Math.min(viewportWidth / worldWidth, viewportHeight / worldHeight);
  return Math.max(1, Math.floor(fitZoom || TARGET_TILE_SIZE / TARGET_TILE_SIZE));
}
