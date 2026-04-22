import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { gameBus } from '../bridge/index.js';
import type { Agent, AgentId, GridPoint } from '../domain/index.js';
import { PhaserGame } from '../game/PhaserGame.js';
import { DemoNavigation } from './DemoNavigation.js';
import { TilesetSwitcher } from './TilesetSwitcher/TilesetSwitcher.js';

const DEMO_AGENT_IDS = [
  'demo-depth-desk-back',
  'demo-depth-desk-front',
  'demo-depth-agent-back',
  'demo-depth-agent-front',
  'demo-depth-agent-middle',
  'demo-depth-seated-left',
  'demo-depth-seated-right',
] as const satisfies readonly AgentId[];

const FURNITURE_SEATS: GridPoint[] = [
  { x: 8, y: 6 },
  { x: 13, y: 6 },
];

const agents: Array<Pick<Agent, 'id' | 'name' | 'status' | 'direction' | 'position'>> = [
  {
    id: 'demo-depth-desk-back',
    name: 'Behind Desk',
    status: 'idle',
    direction: 'south',
    position: { x: 9, y: 5 },
  },
  {
    id: 'demo-depth-desk-front',
    name: 'In Front Of Desk',
    status: 'idle',
    direction: 'north',
    position: { x: 9, y: 7 },
  },
  {
    id: 'demo-depth-agent-back',
    name: 'Upper Agent',
    status: 'idle',
    direction: 'south',
    position: { x: 5, y: 5 },
  },
  {
    id: 'demo-depth-agent-middle',
    name: 'Middle Agent',
    status: 'idle',
    direction: 'south',
    position: { x: 5, y: 6 },
  },
  {
    id: 'demo-depth-agent-front',
    name: 'Lower Agent',
    status: 'idle',
    direction: 'north',
    position: { x: 5, y: 7 },
  },
  {
    id: 'demo-depth-seated-left',
    name: 'Seated Left',
    status: 'sitting',
    direction: 'east',
    position: { x: 8, y: 6 },
  },
  {
    id: 'demo-depth-seated-right',
    name: 'Seated Right',
    status: 'sitting',
    direction: 'east',
    position: { x: 13, y: 6 },
  },
];

export function DemoDepthSortingRoute() {
  const navigate = useNavigate();
  const timeoutsRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutsRef.current = [];
  }, []);

  const removeDemoAgents = useCallback(() => {
    DEMO_AGENT_IDS.forEach((agentId) => {
      gameBus.emit('agent:event', { type: 'agent:remove', agentId });
    });
  }, []);

  const spawnDemo = useCallback(() => {
    clearTimers();
    const now = Date.now();
    gameBus.emit('demo:obstacles-set', { obstacles: [], seats: FURNITURE_SEATS });
    removeDemoAgents();

    agents.forEach((agent, index) => {
      timeoutsRef.current.push(
        window.setTimeout(() => {
          gameBus.emit('agent:event', {
            type: 'agent:upsert',
            agent: {
              ...agent,
              updatedAt: now + index,
            },
          });
        }, index * 70),
      );
    });
  }, [clearTimers, removeDemoAgents]);

  useEffect(() => {
    let fallbackId = 0;
    const start = () => {
      window.clearTimeout(fallbackId);
      spawnDemo();
    };
    const unsubscribe = gameBus.on('game:ready', start);
    fallbackId = window.setTimeout(start, 900);

    return () => {
      unsubscribe();
      window.clearTimeout(fallbackId);
      clearTimers();
      removeDemoAgents();
      gameBus.emit('demo:obstacles-set', { obstacles: [] });
    };
  }, [clearTimers, removeDemoAgents, spawnDemo]);

  return (
    <div className="app-shell demo-shell" aria-label="Depth sorting demo">
      <PhaserGame />
      <TilesetSwitcher />
      <DemoNavigation />
      <section className="demo-panel" aria-label="데모 컨트롤">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={() => navigate('/', { replace: false })} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Y Depth</p>
          <h1>Depth 정렬 확인</h1>
          <p>발 기준 y 좌표가 낮은 캐릭터는 가구와 다른 캐릭터 뒤에, y 좌표가 높은 캐릭터는 앞에 표시됩니다.</p>
        </div>

        <div className="demo-depth-list" aria-label="정렬 확인 항목">
          <span>책상 뒤 캐릭터</span>
          <span>책상 앞 캐릭터</span>
          <span>상/중/하 캐릭터 겹침</span>
          <span>의자에 앉은 캐릭터</span>
        </div>

        <div className="demo-actions demo-actions--single" aria-label="데모 실행">
          <button onClick={spawnDemo} type="button">
            다시 배치
          </button>
        </div>
      </section>
    </div>
  );
}
