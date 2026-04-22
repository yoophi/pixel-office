import * as Phaser from 'phaser';

import type { AgentStatus, Direction } from '../../domain/index.js';

const CHARACTER_COUNT = 6;
const CHARACTER_FRAME_WIDTH = 16;
const CHARACTER_FRAME_HEIGHT = 32;
const FRAMES_PER_DIRECTION = 7;

type CharacterAnimationStatus = Extract<AgentStatus, 'idle' | 'walking' | 'typing' | 'sitting'>;

export interface CharacterConfig {
  id: string;
  textureKey: string;
  x: number;
  y: number;
  direction?: Direction;
  status?: CharacterAnimationStatus;
}

export function preloadCharacterAssets(scene: Phaser.Scene) {
  for (let index = 0; index < CHARACTER_COUNT; index++) {
    scene.load.spritesheet(`character:${index}`, `/assets/characters/char_${index}.png`, {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
    });
  }
}

export class Character {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  direction: Direction;
  status: CharacterAnimationStatus;
  private destroyed = false;

  constructor(scene: Phaser.Scene, config: CharacterConfig) {
    this.id = config.id;
    this.direction = config.direction ?? 'south';
    this.status = config.status ?? 'idle';
    ensureCharacterAnimations(scene, config.textureKey);

    this.sprite = scene.add.sprite(config.x, config.y, config.textureKey);
    this.sprite.setOrigin(0.5, 1);
    this.setDirection(this.direction);
    this.setStatus(this.status);
  }

  setDepth(depth: number) {
    if (this.destroyed) return;
    this.sprite.setDepth(depth);
  }

  setPosition(x: number, y: number) {
    if (this.destroyed) return;
    this.sprite.setPosition(x, y);
  }

  setDirection(direction: Direction) {
    this.direction = direction;
    if (this.destroyed) return;
    this.sprite.setFlipX(direction === 'west');
    this.playCurrentAnimation();
  }

  setStatus(status: CharacterAnimationStatus) {
    this.status = status;
    if (this.destroyed) return;
    this.playCurrentAnimation();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.sprite.destroy();
  }

  private playCurrentAnimation() {
    if (this.destroyed || !this.sprite.scene || !this.sprite.active) return;
    const animationDirection = this.direction === 'west' ? 'east' : this.direction;
    const key = getAnimationKey(this.sprite.texture.key, this.status, animationDirection);

    if (this.status === 'idle') {
      this.sprite.anims.stop();
      this.sprite.setFrame(getFrameIndex(animationDirection, 1));
      return;
    }

    if (this.sprite.scene.anims.exists(key)) {
      this.sprite.play(key, true);
    }
  }
}

function ensureCharacterAnimations(scene: Phaser.Scene, textureKey: string) {
  (['south', 'north', 'east'] as const).forEach((direction) => {
    createAnimation(scene, textureKey, 'walking', direction, [0, 1, 2, 1], 7, -1);
    createAnimation(scene, textureKey, 'typing', direction, [3, 4], 4, -1);
    createAnimation(scene, textureKey, 'sitting', direction, [3], 1, 0);
  });
}

function createAnimation(
  scene: Phaser.Scene,
  textureKey: string,
  status: CharacterAnimationStatus,
  direction: Exclude<Direction, 'west'>,
  directionFrames: number[],
  frameRate: number,
  repeat: number,
) {
  const key = getAnimationKey(textureKey, status, direction);
  if (scene.anims.exists(key)) return;

  scene.anims.create({
    key,
    frames: directionFrames.map((frame) => ({
      key: textureKey,
      frame: getFrameIndex(direction, frame),
    })),
    frameRate,
    repeat,
  });
}

function getAnimationKey(textureKey: string, status: CharacterAnimationStatus, direction: Exclude<Direction, 'west'>) {
  return `${textureKey}:${status}:${direction}`;
}

function getFrameIndex(direction: Exclude<Direction, 'west'>, directionFrame: number) {
  return getDirectionRow(direction) * FRAMES_PER_DIRECTION + directionFrame;
}

function getDirectionRow(direction: Exclude<Direction, 'west'>) {
  if (direction === 'south') return 0;
  if (direction === 'north') return 1;
  return 2;
}
