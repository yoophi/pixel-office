import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import { BootScene } from './scenes/BootScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';

const sizeOptions = [
  { id: 'small', label: 'Small', width: 640 },
  { id: 'medium', label: 'Medium', width: 960 },
  { id: 'large', label: 'Large', width: 1280 },
] as const;
const aspectOptions = [
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '20:11', label: 'Map', ratio: 20 / 11 },
] as const;

type SizeOptionId = (typeof sizeOptions)[number]['id'];
type AspectOptionId = (typeof aspectOptions)[number]['id'];

export function PhaserGame() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [sizeId, setSizeId] = useState<SizeOptionId>('medium');
  const [aspectId, setAspectId] = useState<AspectOptionId>('20:11');
  const size = useCanvasSize(sizeId, aspectId);

  useEffect(() => {
    if (!parentRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: parentRef.current.clientWidth || window.innerWidth,
        height: parentRef.current.clientHeight || window.innerHeight,
      },
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
      scene: [BootScene, OfficeScene],
    });

    gameRef.current = game;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      game.scale.resize(width, height);
    });
    resizeObserver.observe(parentRef.current);

    return () => {
      resizeObserver.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        className="phaser-host"
        ref={parentRef}
        style={{
          '--canvas-height': `${size.height}px`,
          '--canvas-width': `${size.width}px`,
        } as CSSProperties}
      />
      <GameCanvasToolbar
        aspectId={aspectId}
        sizeId={sizeId}
        setAspectId={setAspectId}
        setSizeId={setSizeId}
      />
    </>
  );
}

interface GameCanvasToolbarProps {
  aspectId: AspectOptionId;
  sizeId: SizeOptionId;
  setAspectId(aspectId: AspectOptionId): void;
  setSizeId(sizeId: SizeOptionId): void;
}

function GameCanvasToolbar({ aspectId, sizeId, setAspectId, setSizeId }: GameCanvasToolbarProps) {
  return (
    <div className="game-canvas-toolbar" aria-label="게임 캔버스 조정">
      <p>Canvas</p>
      <div className="game-canvas-toolbar__group" aria-label="캔버스 크기">
        {sizeOptions.map((option) => (
          <button
            aria-pressed={sizeId === option.id}
            key={option.id}
            onClick={() => setSizeId(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="game-canvas-toolbar__group" aria-label="캔버스 비율">
        {aspectOptions.map((option) => (
          <button
            aria-pressed={aspectId === option.id}
            key={option.id}
            onClick={() => setAspectId(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function useCanvasSize(sizeId: SizeOptionId, aspectId: AspectOptionId) {
  return useMemo(() => {
    const size = sizeOptions.find((option) => option.id === sizeId) ?? sizeOptions[1];
    const aspect = aspectOptions.find((option) => option.id === aspectId) ?? aspectOptions[3];
    return { width: size.width, height: Math.round(size.width / aspect.ratio) };
  }, [aspectId, sizeId]);
}
