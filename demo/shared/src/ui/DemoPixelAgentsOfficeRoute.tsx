import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { resolvePixelScale } from '@pixel-office/core';
import { useViewSettingsStore } from '@pixel-office/engine/view-settings';
import { GameCanvasToolbar } from '@pixel-office/engine/react';
import { PixelAgentsOfficeScene, PIXEL_OFFICE_SIZE } from '../game/scenes/PixelAgentsOfficeScene.js';
import { DemoNavigation } from './DemoNavigation.js';

export function DemoPixelAgentsOfficeRoute() {
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
      scene: [PixelAgentsOfficeScene],
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
    <main className="app-shell pixel-office-demo" aria-label="Pixel Agents 사무실 데모">
      <div className="pixel-office-host" ref={host} style={canvasSize} />
      <div className="pixel-office-caption">
        <strong>픽셀 오피스</strong>
        <span>업무 좌석 9 · 회의실 · 커피 라운지</span>
        <small>샘플 에이전트 10 · 실제 상태 연동 전</small>
      </div>
      <GameCanvasToolbar zoom={zoom} canvasSize={canvasSize} setZoom={setZoom} />
      <DemoNavigation />
    </main>
  );
}
