import * as Phaser from 'phaser';

export interface SpeechBubbleConfig {
  target: Phaser.GameObjects.Sprite;
  message: string;
  durationMs: number;
}

export class SpeechBubble {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly tail: Phaser.GameObjects.Triangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Sprite;
  private expiresAt: number;

  constructor(scene: Phaser.Scene, config: SpeechBubbleConfig) {
    this.target = config.target;
    this.expiresAt = scene.time.now + config.durationMs;

    this.text = scene.add.text(0, 0, config.message, {
      color: '#111827',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    this.text.setOrigin(0.5, 0.5);

    const bounds = this.text.getBounds();
    this.background = scene.add.rectangle(0, 0, bounds.width + 12, bounds.height + 8, 0xffffff, 1);
    this.background.setStrokeStyle(1, 0x111827, 1);
    this.tail = scene.add.triangle(0, this.background.height / 2 + 4, 0, 0, 8, 0, 4, 5, 0xffffff, 1);
    this.tail.setStrokeStyle(1, 0x111827, 1);

    this.container = scene.add.container(0, 0, [this.background, this.tail, this.text]);
    this.container.setDepth(this.target.depth + 1);
    this.updatePosition();
  }

  update(now: number) {
    this.updatePosition();
    return now < this.expiresAt;
  }

  reset(message: string, durationMs: number, now: number) {
    this.text.setText(message);
    const bounds = this.text.getBounds();
    this.background.setSize(bounds.width + 12, bounds.height + 8);
    this.tail.setY(this.background.height / 2 + 4);
    this.expiresAt = now + durationMs;
    this.updatePosition();
  }

  destroy() {
    this.container.destroy(true);
  }

  private updatePosition() {
    this.container.setPosition(Math.round(this.target.x), Math.round(this.target.y - 38));
    this.container.setDepth(this.target.depth + 1);
  }
}
