import * as Phaser from 'phaser';

import { SpeechBubble } from '../entities/SpeechBubble.js';

export class SocialSystem {
  private readonly scene: Phaser.Scene;
  private readonly bubbles = new Map<Phaser.GameObjects.Sprite, SpeechBubble>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showSpeech(target: Phaser.GameObjects.Sprite, message: string, durationMs: number) {
    const existing = this.bubbles.get(target);
    if (existing) {
      existing.reset(message, durationMs, this.scene.time.now);
      return;
    }

    this.bubbles.set(target, new SpeechBubble(this.scene, { target, message, durationMs }));
  }

  update() {
    this.bubbles.forEach((bubble, target) => {
      if (bubble.update(this.scene.time.now)) return;
      bubble.destroy();
      this.bubbles.delete(target);
    });
  }

  clear() {
    this.bubbles.forEach((bubble) => bubble.destroy());
    this.bubbles.clear();
  }
}
