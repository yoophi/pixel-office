import * as Phaser from 'phaser';

export interface SpeechBubbleConfig {
  target: Phaser.GameObjects.Sprite;
  message: string;
  durationMs: number;
}

export class SpeechBubble {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly tail: Phaser.GameObjects.Triangle;
  private readonly text: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Sprite;
  private expiresAt: number;
  private lastTextureResolution = 0;

  constructor(scene: Phaser.Scene, config: SpeechBubbleConfig) {
    this.scene = scene;
    this.target = config.target;
    this.expiresAt = scene.time.now + config.durationMs;

    this.text = scene.add.text(0, 0, config.message, {
      color: '#111827',
      fontFamily: '"Galmuri11", monospace',
      fontSize: '11px',
    });
    this.text.setOrigin(0.5, 0.5);
    this.syncTextureResolution();

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
    this.syncTextureResolution();
    this.updatePosition();
    return now < this.expiresAt;
  }

  reset(message: string, durationMs: number, now: number) {
    this.text.setText(message);
    this.syncTextureResolution(true);
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

  private syncTextureResolution(forceRedraw = false) {
    const deviceScale = window.devicePixelRatio || 1;
    const cameraZoom = this.scene.cameras.main?.zoom ?? 1;
    const target = Math.max(1, Math.ceil(cameraZoom * deviceScale));
    if (!forceRedraw && target === this.lastTextureResolution) return;
    this.lastTextureResolution = target;
    this.text.setResolution(target);
  }
}
