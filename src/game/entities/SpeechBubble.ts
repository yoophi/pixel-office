import * as Phaser from 'phaser';

export interface SpeechBubbleConfig {
  target: Phaser.GameObjects.Sprite;
  message: string;
  durationMs: number;
  fontFamily?: string;
  fontSizePx?: number;
  lineHeightRatio?: number;
  textPaddingTopPx?: number;
  textOffsetYPx?: number;
  bubbleHeightAdjustmentPx?: number;
}

export class SpeechBubble {
  private static readonly defaultFontFamily =
    '"FS Pixel Sans Matched", "Galmuri11", "Pretendard", "Noto Sans KR", sans-serif';
  private static readonly defaultFontSizePx = 11;
  private static readonly defaultLineHeightRatio = 1.2;
  private static readonly defaultTextPaddingTopPx = 1;
  private static readonly defaultTextOffsetYPx = -1;
  private static readonly minTextureResolution = 3;
  private static readonly paddingX = 12;
  private static readonly paddingY = 8;
  private static readonly borderSize = 2;
  private static readonly cornerRadius = 7;
  private static readonly shadowOffset = 3;
  private static readonly tailHeight = 8;
  private static readonly tailWidth = 13;
  private static readonly wordWrapWidth = 180;
  private static readonly tailTargetOffsetY = 22;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly bubble: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Sprite;
  private readonly bubbleHeightAdjustmentPx: number;
  private expiresAt: number;
  private lastTextureResolution = 0;
  private bubbleHeight = 0;

  constructor(scene: Phaser.Scene, config: SpeechBubbleConfig) {
    this.scene = scene;
    this.target = config.target;
    this.bubbleHeightAdjustmentPx = config.bubbleHeightAdjustmentPx ?? 0;
    this.expiresAt = scene.time.now + config.durationMs;
    const fontSizePx = config.fontSizePx ?? SpeechBubble.defaultFontSizePx;

    this.text = scene.add.text(0, 0, config.message, {
      color: '#111827',
      fontFamily: config.fontFamily ?? SpeechBubble.defaultFontFamily,
      fontSize: `${fontSizePx}px`,
      padding: { top: config.textPaddingTopPx ?? SpeechBubble.defaultTextPaddingTopPx },
      wordWrap: { width: SpeechBubble.wordWrapWidth },
    });
    const lineHeightRatio = config.lineHeightRatio ?? SpeechBubble.defaultLineHeightRatio;
    const lineSpacingPx =
      fontSizePx * lineHeightRatio - this.text.getTextMetrics().fontSize - this.text.style.strokeThickness;
    // Phaser의 lineSpacing은 선언한 CSS 크기가 아니라 측정된 글꼴 높이에 더해집니다.
    this.text.setLineSpacing(lineSpacingPx);
    this.text.setOrigin(0.5, 0.5);
    this.text.setY(config.textOffsetYPx ?? SpeechBubble.defaultTextOffsetYPx);
    this.syncTextureResolution();

    this.shadow = scene.add.graphics();
    this.bubble = scene.add.graphics();
    this.redrawBubble();

    this.container = scene.add.container(0, 0, [this.shadow, this.bubble, this.text]);
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
    this.redrawBubble();
    this.expiresAt = now + durationMs;
    this.updatePosition();
  }

  destroy() {
    this.container.destroy(true);
  }

  private updatePosition() {
    const tailBottomFromCenter = Math.round(this.bubbleHeight / 2) + SpeechBubble.tailHeight;
    const targetScaleY = Math.abs(this.target.scaleY) || 1;
    const targetOffsetY = SpeechBubble.tailTargetOffsetY * targetScaleY;
    this.container.setPosition(
      Math.round(this.target.x),
      Math.round(this.target.y - targetOffsetY - tailBottomFromCenter),
    );
    this.container.setDepth(this.target.depth + 1);
  }

  private redrawBubble() {
    const bounds = this.text.getBounds();
    const width = Math.ceil(bounds.width) + SpeechBubble.paddingX * 2;
    const height = Math.ceil(bounds.height) + SpeechBubble.paddingY * 2 + this.bubbleHeightAdjustmentPx;
    this.bubbleHeight = height;
    const x = -Math.round(width / 2);
    const y = -Math.round(height / 2);
    const tailTop = y + height - SpeechBubble.borderSize;
    const tailBottom = y + height + SpeechBubble.tailHeight;
    const tailHalf = Math.round(SpeechBubble.tailWidth / 2);

    this.shadow.clear();
    this.shadow.fillStyle(0x303030, 0.5);
    this.shadow.fillRoundedRect(
      x + SpeechBubble.shadowOffset,
      y + SpeechBubble.shadowOffset,
      width,
      height,
      SpeechBubble.cornerRadius,
    );
    this.shadow.fillTriangle(
      -tailHalf + SpeechBubble.shadowOffset,
      tailTop + SpeechBubble.shadowOffset,
      tailHalf + SpeechBubble.shadowOffset,
      tailTop + SpeechBubble.shadowOffset,
      SpeechBubble.shadowOffset,
      tailBottom + SpeechBubble.shadowOffset,
    );

    this.bubble.clear();
    this.bubble.fillStyle(0x000000, 0.5);
    this.bubble.fillRoundedRect(x, y, width, height, SpeechBubble.cornerRadius);
    this.bubble.fillTriangle(-tailHalf, tailTop, tailHalf, tailTop, 0, tailBottom);

    this.bubble.fillStyle(0xffffff, 1);
    this.bubble.fillRoundedRect(
      x + SpeechBubble.borderSize,
      y + SpeechBubble.borderSize,
      width - SpeechBubble.borderSize * 2,
      height - SpeechBubble.borderSize * 2,
      Math.max(0, SpeechBubble.cornerRadius - SpeechBubble.borderSize),
    );
    this.bubble.fillTriangle(
      -tailHalf + SpeechBubble.borderSize,
      tailTop - SpeechBubble.borderSize,
      tailHalf - SpeechBubble.borderSize,
      tailTop - SpeechBubble.borderSize,
      0,
      tailBottom - SpeechBubble.borderSize * 2,
    );
  }

  private syncTextureResolution(forceRedraw = false) {
    const deviceScale = window.devicePixelRatio || 1;
    const cameraZoom = this.scene.cameras.main?.zoom ?? 1;
    const target = Math.max(SpeechBubble.minTextureResolution, Math.ceil(cameraZoom * deviceScale));
    if (!forceRedraw && target === this.lastTextureResolution) return;
    this.lastTextureResolution = target;
    this.text.setResolution(target);
  }
}
