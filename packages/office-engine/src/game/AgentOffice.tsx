import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { resolvePixelScale } from '@pixel-office/core';
import { useViewSettingsStore } from '../shared/index.js';
import { GameCanvasToolbar } from './PhaserGame.js';
import { PixelAgentsOfficeScene, PIXEL_OFFICE_SIZE } from './scenes/PixelAgentsOfficeScene.js';

export function AgentOffice() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const zoom = useViewSettingsStore((state) => state.zoom);
  const setZoom = useViewSettingsStore((state) => state.setZoom);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const scale = resolvePixelScale(zoom, viewport, PIXEL_OFFICE_SIZE);
  const canvasSize = { width: PIXEL_OFFICE_SIZE.width * scale, height: PIXEL_OFFICE_SIZE.height * scale };
  const initialSize = useRef(canvasSize);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current, backgroundColor: '#18221f',
      scale: { mode: Phaser.Scale.NONE, ...initialSize.current },
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scene: [new PixelAgentsOfficeScene(true)],
    });
    gameRef.current = game;
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.scale.resize(canvasSize.width, canvasSize.height);
  }, [canvasSize.width, canvasSize.height]);

  return (
    <div className="app-shell" aria-label="오피스 캔버스">
      <div className="pixel-office-host" ref={host} style={canvasSize} />
      <GameCanvasToolbar zoom={zoom} canvasSize={canvasSize} setZoom={setZoom} />
    </div>
  );
}
