import * as Phaser from 'phaser';

const GLYPHS = ['0', '1', '/', '<', '>'];
const COLUMN_COUNT = 6;
const ROW_COUNT = 8;

export function playMatrixSpawnEffect(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
  target.setAlpha(0);
  const rain = createDigitalRain(scene, target);

  scene.tweens.add({
    targets: target,
    alpha: 1,
    duration: 420,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: rain,
    alpha: 0,
    y: rain.y + 12,
    duration: 520,
    ease: 'Quad.easeIn',
    onComplete: () => rain.destroy(true),
  });
}

export function playMatrixDespawnEffect(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Sprite,
  onComplete: () => void,
) {
  const rain = createDigitalRain(scene, target);

  scene.tweens.add({
    targets: target,
    alpha: 0,
    duration: 360,
    ease: 'Quad.easeIn',
  });
  scene.tweens.add({
    targets: rain,
    alpha: 0,
    y: rain.y + 14,
    duration: 460,
    ease: 'Quad.easeIn',
    onComplete: () => {
      rain.destroy(true);
      onComplete();
    },
  });
}

function createDigitalRain(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) {
  const container = scene.add.container(Math.round(target.x), Math.round(target.y - 28));
  container.setDepth(target.depth + 2);

  for (let column = 0; column < COLUMN_COUNT; column++) {
    for (let row = 0; row < ROW_COUNT; row++) {
      const text = scene.add.text(
        (column - COLUMN_COUNT / 2) * 4,
        row * 4,
        GLYPHS[(column + row) % GLYPHS.length],
        {
          color: row === 0 ? '#d1fae5' : '#22c55e',
          fontFamily: 'monospace',
          fontSize: '6px',
        },
      );
      text.setAlpha(Math.max(0.2, 1 - row / ROW_COUNT));
      container.add(text);
    }
  }

  return container;
}
