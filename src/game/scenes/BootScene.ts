import * as Phaser from 'phaser';

import { preloadCharacterAssets } from '../entities/Character.js';
import { preloadTiledMapAssets } from '../tiled/loader.js';

export const SAMPLE_MAP_KEY = 'sample-office';
export const SAMPLE_MAP_URL = '/maps/sample.tmj';
export const DEMO_CHAIR_KEY = 'demo-chair-right';
export const DEMO_DESK_KEY = 'demo-desk-vertical';

export class BootScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;

  constructor() {
    super('BootScene');
  }

  preload() {
    preloadTiledMapAssets(this, {
      mapKey: SAMPLE_MAP_KEY,
      mapUrl: SAMPLE_MAP_URL,
    });
    preloadCharacterAssets(this);
    this.load.image(DEMO_CHAIR_KEY, '/assets/furniture/chairs/CHAIR_CUSHIONED_RIGHT.png');
    this.load.image(DEMO_DESK_KEY, '/assets/furniture/desks/TABLE_WOOD_VERTICAL.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: 'monospace',
      fontSize: '14px',
    });
    this.fpsText.setScrollFactor(0);
    this.scene.start('OfficeScene');
  }

  update() {
    if (!this.fpsText) return;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }
}
