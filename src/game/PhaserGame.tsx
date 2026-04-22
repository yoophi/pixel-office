import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import { gameBus } from '../bridge/index.js';
import {
  resolvePixelScale,
  VIEW_ZOOM_OPTIONS,
  VIEW_ZOOM_REGISTRY_KEY,
  type PixelSize,
  type ViewZoom,
} from '../domain/index.js';
import { useViewSettingsStore } from '../shared/index.js';
import { BootScene, SAMPLE_MAP_HEIGHT_PX, SAMPLE_MAP_WIDTH_PX } from './scenes/BootScene.js';
import { OfficeScene } from './scenes/OfficeScene.js';

const WORLD_SIZE: PixelSize = { width: SAMPLE_MAP_WIDTH_PX, height: SAMPLE_MAP_HEIGHT_PX };

export function PhaserGame() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const zoom = useViewSettingsStore((state) => state.zoom);
  const setZoom = useViewSettingsStore((state) => state.setZoom);
  const [viewportSize, setViewportSize] = useState(() => getInitialViewportSize());
  const canvasSize = useMemo(() => resolveCanvasSize(zoom, viewportSize), [zoom, viewportSize]);
  const initialCanvasSizeRef = useRef<PixelSize>(canvasSize);

  useEffect(() => {
    if (!parentRef.current || gameRef.current) return;
    const initialCanvasSize = initialCanvasSizeRef.current;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentRef.current,
      backgroundColor: '#000000',
      scale: {
        mode: Phaser.Scale.NONE,
        width: initialCanvasSize.width,
        height: initialCanvasSize.height,
      },
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
      scene: [BootScene, OfficeScene],
    });
    gameRef.current = game;

    const handleWindowResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewportSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (game.scale.width === canvasSize.width && game.scale.height === canvasSize.height) return;
    game.scale.resize(canvasSize.width, canvasSize.height);
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.registry.set(VIEW_ZOOM_REGISTRY_KEY, zoom);
    gameBus.emit('ui:zoom-changed', { scale: zoom });
  }, [zoom]);

  return (
    <>
      <div
        className="phaser-host"
        ref={parentRef}
        style={{
          '--canvas-height': `${canvasSize.height}px`,
          '--canvas-width': `${canvasSize.width}px`,
        } as CSSProperties}
      />
      <GameCanvasToolbar zoom={zoom} canvasSize={canvasSize} setZoom={setZoom} />
    </>
  );
}

interface GameCanvasToolbarProps {
  zoom: ViewZoom;
  canvasSize: { width: number; height: number };
  setZoom(zoom: ViewZoom): void;
}

function GameCanvasToolbar({ zoom, canvasSize, setZoom }: GameCanvasToolbarProps) {
  return (
    <div className="game-canvas-toolbar" aria-label="게임 캔버스 줌">
      <p>Pixel Zoom</p>
      <div className="game-canvas-toolbar__group" aria-label="줌 배율">
        {VIEW_ZOOM_OPTIONS.map((option) => (
          <button
            aria-pressed={zoom === option}
            key={String(option)}
            onClick={() => setZoom(option)}
            type="button"
          >
            {formatZoomLabel(option)}
          </button>
        ))}
      </div>
      <p className="game-canvas-toolbar__readout">
        {canvasSize.width} × {canvasSize.height} px
      </p>
    </div>
  );
}

function formatZoomLabel(zoom: ViewZoom) {
  return zoom === 'fit' ? 'Fit' : `1:${zoom}`;
}

function getInitialViewportSize(): PixelSize {
  if (typeof window === 'undefined') return WORLD_SIZE;
  return { width: window.innerWidth, height: window.innerHeight };
}

function resolveCanvasSize(zoom: ViewZoom, viewport: PixelSize): PixelSize {
  const scale = resolvePixelScale(zoom, viewport, WORLD_SIZE);
  return { width: WORLD_SIZE.width * scale, height: WORLD_SIZE.height * scale };
}
