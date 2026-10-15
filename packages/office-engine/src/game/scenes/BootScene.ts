import * as Phaser from 'phaser';

import { preloadCharacterAssets } from '../entities/Character.js';
import { preloadTiledMapAssets } from '../tiled/loader.js';

export const SAMPLE_MAP_KEY = 'sample-office';
export const SAMPLE_MAP_URL = `${import.meta.env.BASE_URL}maps/sample.tmj`;
export const SAMPLE_MAP_TILE_SIZE = 16;
export const SAMPLE_MAP_WIDTH_TILES = 20;
export const SAMPLE_MAP_HEIGHT_TILES = 11;
export const SAMPLE_MAP_WIDTH_PX = SAMPLE_MAP_WIDTH_TILES * SAMPLE_MAP_TILE_SIZE;
export const SAMPLE_MAP_HEIGHT_PX = SAMPLE_MAP_HEIGHT_TILES * SAMPLE_MAP_TILE_SIZE;
export const CHAIR_KEY = 'office-chair-right';
export const DESK_KEY = 'office-desk-vertical';

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
    this.load.image(CHAIR_KEY, `${import.meta.env.BASE_URL}assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_SIDE.png`);
    this.load.image('office-obstacle-plant', `${import.meta.env.BASE_URL}assets/furniture/PLANT/PLANT.png`);
    this.load.image(DESK_KEY, `${import.meta.env.BASE_URL}assets/furniture/SMALL_TABLE/SMALL_TABLE_SIDE.png`);
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: '"FS Pixel Sans", "Galmuri11", monospace',
      fontSize: '11px',
    });
    this.fpsText.setScrollFactor(0);
    this.scene.start('OfficeScene');
  }

  update() {
    if (!this.fpsText) return;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }
}
