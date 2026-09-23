import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';

import { loadFurnitureCatalog } from '../game/pixelAgents/assets.js';
import {
  PIXEL_AGENTS_AGENT_COUNT_KEY,
  PIXEL_AGENTS_DEBUG_KEY,
  PIXEL_AGENTS_SEED_KEY,
  PIXEL_AGENTS_STATS_EVENT,
  PixelAgentsOfficeScene,
  type PixelAgentsOfficeStats,
} from '../game/pixelAgents/PixelAgentsOfficeScene.js';
import { DemoNavigation } from './DemoNavigation.js';

const VARIANT_LABELS: Record<string, string> = {
  standard: '회의실 + 탕비실',
  open: '탕비실',
  dense: '회의실',
};

const MAX_AGENTS = 40;

export function DemoPixelAgentsOfficeRoute() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [stats, setStats] = useState<PixelAgentsOfficeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [agentCount, setAgentCount] = useState(10);
  const [debug, setDebug] = useState(false);
  const settingsRef = useRef({ seed, agentCount, debug });
  settingsRef.current = { seed, agentCount, debug };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let game: Phaser.Game | null = null;
    const resize = () => game?.scale.resize(window.innerWidth, window.innerHeight);

    loadFurnitureCatalog()
      .then((catalog) => {
        if (cancelled) return;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host,
          backgroundColor: '#0f1418',
          scale: { mode: Phaser.Scale.NONE, width: window.innerWidth, height: window.innerHeight },
          render: { antialias: false, pixelArt: true, roundPixels: true },
          scene: [new PixelAgentsOfficeScene(catalog)],
        });
        // 게임은 카탈로그 로드 뒤 비동기로 생기므로, 생성 시점의 설정을 먼저 넣어 둡니다.
        const settings = settingsRef.current;
        game.registry.set(PIXEL_AGENTS_SEED_KEY, settings.seed);
        game.registry.set(PIXEL_AGENTS_AGENT_COUNT_KEY, settings.agentCount);
        game.registry.set(PIXEL_AGENTS_DEBUG_KEY, settings.debug);
        gameRef.current = game;
        game.events.on(PIXEL_AGENTS_STATS_EVENT, setStats);
        window.addEventListener('resize', resize);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      game?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.registry.set(PIXEL_AGENTS_SEED_KEY, seed);
  }, [seed]);

  useEffect(() => {
    gameRef.current?.registry.set(PIXEL_AGENTS_AGENT_COUNT_KEY, agentCount);
  }, [agentCount]);

  useEffect(() => {
    gameRef.current?.registry.set(PIXEL_AGENTS_DEBUG_KEY, debug);
  }, [debug]);

  const skippedSummary = summarizeSkipped(stats);

  return (
    <div className="random-office-demo pixel-agents-office" aria-label="pixel-agents 가구 오피스">
      <div className="random-office-host" ref={hostRef} />

      <section className="pixel-agents-panel" aria-label="오피스 레이아웃 정보">
        <p className="pixel-agents-panel__eyebrow">pixel-agents assets · pixtuoid layout</p>
        {error && <p className="pixel-agents-panel__error">{error}</p>}
        {stats && (
          <>
            <p>
              {stats.cols}×{stats.rows} 타일 · 층 #{stats.seed} {stats.variant ? `(${VARIANT_LABELS[stats.variant]})` : ''}
            </p>
            {stats.tooSmall ? (
              <p className="pixel-agents-panel__error">
                화면이 작습니다: 최소 {stats.minCols}×{stats.minRows} 타일 필요
              </p>
            ) : (
              <p>
                책상 {stats.desks} · 수용 {stats.capacity} · 좌석 {stats.seats} · 가구 {stats.furniture}
                <br />
                에이전트 {stats.visibleAgents}
                {stats.hiddenAgents > 0 ? ` (+${stats.hiddenAgents} 책상 없음)` : ''}
              </p>
            )}
            {skippedSummary && <p className="pixel-agents-panel__muted">생략: {skippedSummary}</p>}
          </>
        )}
        <div className="pixel-agents-panel__row">
          <button onClick={() => setSeed((value) => Math.max(0, value - 1))} type="button">
            ◀ 층
          </button>
          <button onClick={() => setSeed((value) => value + 1)} type="button">
            층 ▶
          </button>
          <button onClick={() => setAgentCount((value) => Math.max(0, value - 1))} type="button">
            − 인원
          </button>
          <span>{agentCount}</span>
          <button onClick={() => setAgentCount((value) => Math.min(MAX_AGENTS, value + 1))} type="button">
            + 인원
          </button>
        </div>
        <label className="pixel-agents-panel__row">
          <input checked={debug} onChange={(event) => setDebug(event.target.checked)} type="checkbox" />
          제약 표시 (빨강 차단 · 초록 좌석 · 파랑 휴식)
        </label>
      </section>

      <DemoNavigation />
    </div>
  );
}

function summarizeSkipped(stats: PixelAgentsOfficeStats | null) {
  if (!stats || stats.skipped.length === 0) return '';
  const counts = new Map<string, number>();
  for (const item of stats.skipped) {
    const key = `${item.type}(${item.reason})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => (count > 1 ? `${key}×${count}` : key)).join(', ');
}
