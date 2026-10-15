import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { gameBus } from '../bridge/index.js';
import type { Agent, AgentId, Direction, GridPoint } from '../domain/index.js';
import { PhaserGame } from '../game/PhaserGame.js';
import { DemoNavigation } from './DemoNavigation.js';
import { TilesetSwitcher } from './TilesetSwitcher/TilesetSwitcher.js';

const SPEECH_DURATION_MS = 60_000;

interface SpeechCase {
  id: AgentId;
  name: string;
  position: GridPoint;
  destination: GridPoint;
  direction: Direction;
  message: string;
  label: string;
}

const cases: readonly SpeechCase[] = [
  {
    id: 'demo-bubble-ko-short',
    name: 'Ko Short',
    position: { x: 3, y: 3 },
    destination: { x: 5, y: 8 },
    direction: 'south',
    message: '안녕하세요',
    label: '짧은 한글',
  },
  {
    id: 'demo-bubble-en-short',
    name: 'En Short',
    position: { x: 8, y: 3 },
    destination: { x: 11, y: 8 },
    direction: 'south',
    message: 'Hello world',
    label: '짧은 영문',
  },
  {
    id: 'demo-bubble-ko-long',
    name: 'Ko Long',
    position: { x: 13, y: 3 },
    destination: { x: 16, y: 8 },
    direction: 'south',
    message: '이 말풍선은 꽤 길어서 한 줄로 이어져 표시됩니다',
    label: '긴 한글',
  },
  {
    id: 'demo-bubble-en-long',
    name: 'En Long',
    position: { x: 4, y: 6 },
    destination: { x: 2, y: 10 },
    direction: 'south',
    message: 'This bubble is quite long and stays on one line without wrapping',
    label: '긴 영문',
  },
  {
    id: 'demo-bubble-ko-multiline',
    name: 'Ko Multi',
    position: { x: 10, y: 6 },
    destination: { x: 12, y: 10 },
    direction: 'south',
    message: '첫 번째 줄\n두 번째 줄\n세 번째 줄',
    label: '여러 줄 한글',
  },
  {
    id: 'demo-bubble-en-multiline',
    name: 'En Multi',
    position: { x: 16, y: 6 },
    destination: { x: 18, y: 10 },
    direction: 'south',
    message: 'Line one\nLine two\nLine three',
    label: '여러 줄 영문',
  },
  {
    id: 'demo-bubble-mixed',
    name: 'Mixed',
    position: { x: 6, y: 9 },
    destination: { x: 7, y: 4 },
    direction: 'north',
    message: '한글 + English 1234\n특수문자: ★ ♪ ☆ ✓\n이모지는? 😀',
    label: '혼합 여러 줄',
  },
  {
    id: 'demo-bubble-very-long',
    name: 'Very Long',
    position: { x: 14, y: 9 },
    destination: { x: 15, y: 4 },
    direction: 'north',
    message: '화면 폭을 넘어갈 만큼 아주아주 긴 문장도 한 줄로 표시되는지 확인합니다 Lorem ipsum dolor sit amet',
    label: '과한 길이',
  },
];

export function DemoSpeechBubbleRoute() {
  const navigate = useNavigate();
  const gameReadyRef = useRef(false);
  const moveTimerRef = useRef(0);

  const removeAgents = useCallback(() => {
    cases.forEach((speechCase) => {
      gameBus.emit('agent:event', { type: 'agent:remove', agentId: speechCase.id });
    });
  }, []);

  const spawnDemo = useCallback(() => {
    if (!gameReadyRef.current) return;
    window.clearTimeout(moveTimerRef.current);
    gameBus.emit('demo:obstacles-set', { obstacles: [] });
    removeAgents();

    const now = Date.now();
    cases.forEach((speechCase, index) => {
      const agent: Agent = {
        id: speechCase.id,
        name: speechCase.name,
        status: 'idle',
        direction: speechCase.direction,
        position: speechCase.position,
        updatedAt: now + index,
      };
      gameBus.emit('agent:event', { type: 'agent:upsert', agent });
      gameBus.emit('agent:event', {
        type: 'agent:say',
        agentId: speechCase.id,
        message: speechCase.message,
        durationMs: SPEECH_DURATION_MS,
        updatedAt: now + index + 1,
      });
    });

    moveTimerRef.current = window.setTimeout(() => {
      cases.forEach((speechCase, index) => {
        gameBus.emit('agent:event', {
          type: 'agent:move',
          agentId: speechCase.id,
          destination: speechCase.destination,
          direction: speechCase.direction,
          updatedAt: Date.now() + index,
        });
      });
    }, 800);
  }, [removeAgents]);

  useEffect(() => {
    let fallbackId = 0;
    const startOnce = () => {
      window.clearTimeout(fallbackId);
      gameReadyRef.current = true;
      spawnDemo();
    };
    const unsubscribe = gameBus.on('game:ready', startOnce);
    fallbackId = window.setTimeout(startOnce, 900);

    return () => {
      unsubscribe();
      window.clearTimeout(fallbackId);
      window.clearTimeout(moveTimerRef.current);
      removeAgents();
      gameBus.emit('demo:obstacles-set', { obstacles: [] });
    };
  }, [removeAgents, spawnDemo]);

  return (
    <div className="app-shell demo-shell" aria-label="말풍선 표시 데모">
      <PhaserGame />
      <TilesetSwitcher />
      <DemoNavigation />
      <section className="demo-panel" aria-label="데모 컨트롤">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={() => navigate('/', { replace: false })} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Speech Bubble</p>
          <h1>말풍선 표시</h1>
          <p>
            길이·언어·여러 줄 조합을 다양한 위치에 동시에 띄워 렌더를 검증합니다. 캐릭터가 이동하는 동안 말풍선도 함께
            따라가는지 확인합니다.
          </p>
        </div>

        <div className="demo-depth-list" aria-label="케이스 목록">
          {cases.map((speechCase) => (
            <span key={speechCase.id}>{speechCase.label}</span>
          ))}
        </div>

        <div className="demo-actions demo-actions--single" aria-label="데모 실행">
          <button onClick={spawnDemo} type="button">
            다시 표시
          </button>
        </div>
      </section>
    </div>
  );
}
