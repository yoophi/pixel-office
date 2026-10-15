import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { resolvePixelScale } from '@pixel-office/core';
import { useViewSettingsStore } from '@pixel-office/engine/view-settings';
import { GameCanvasToolbar } from '@pixel-office/engine/react';
import { InteriorSampleScene, INTERIOR_SAMPLE_SIZE } from '../game/scenes/InteriorSampleScene.js';
import { interiorSheets } from '@pixel-office/engine/game/assets/interiorAssets';
import { DemoNavigation } from './DemoNavigation.js';

export function DemoInteriorAssetsRoute() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const zoom = useViewSettingsStore((state) => state.zoom);
  const setZoom = useViewSettingsStore((state) => state.setZoom);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const scale = resolvePixelScale(zoom, viewport, INTERIOR_SAMPLE_SIZE);
  const canvasSize = { width: INTERIOR_SAMPLE_SIZE.width * scale, height: INTERIOR_SAMPLE_SIZE.height * scale };
  const initialSize = useRef(canvasSize);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current, backgroundColor: '#18221f',
      scale: { mode: Phaser.Scale.NONE, ...initialSize.current },
      render: { antialias: false, pixelArt: true, roundPixels: true },
      scene: [InteriorSampleScene],
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
    <main className="app-shell pixel-office-demo" aria-label="Interior 에셋 샘플">
      <div className="pixel-office-host" ref={host} style={canvasSize} />
      <div className="pixel-office-caption">
        <strong>Interior 샘플</strong>
        <span>라운지 · 탕비실 · 휴게실</span>
        <small>원본 16px 기준 · 기존 캐릭터 크기 비교</small>
      </div>
      <GameCanvasToolbar zoom={zoom} canvasSize={canvasSize} setZoom={setZoom} />
      <details className="interior-catalog">
        <summary>원본 에셋 32개 둘러보기</summary>
        <div className="interior-catalog__list">
          {interiorSheets.map((sheet) => (
            <a key={sheet.id} href={sheet.url} target="_blank" rel="noreferrer">
              <img src={sheet.url} alt={sheet.id} loading="lazy" />
              <span>{sheet.id}</span><small>{sheet.width} × {sheet.height}px</small>
            </a>
          ))}
        </div>
      </details>
      <DemoNavigation />
    </main>
  );
}
