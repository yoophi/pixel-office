import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { gameBus } from '../bridge/index.js';
import type { Agent, GridPoint } from '../domain/index.js';
import { PhaserGame } from '../game/PhaserGame.js';
import { DemoNavigation } from './DemoNavigation.js';
import { useSitOnArrival } from './hooks/useSitOnArrival.js';
import { TilesetSwitcher } from './TilesetSwitcher/TilesetSwitcher.js';

const DEMO_AGENT_ID = 'demo-pathfinder';
const MAP_WIDTH = 20;
const MAP_HEIGHT = 11;
const START: GridPoint = { x: 3, y: 3 };

const scenarios = [
  {
    id: 'east-run',
    label: '동쪽 책상 우회',
    goal: { x: 16, y: 7 },
    message: 'rerouting',
  },
  {
    id: 'north-gap',
    label: '중앙 통로 통과',
    goal: { x: 12, y: 2 },
    message: 'avoiding desks',
  },
] as const;

const furnitureTiles = new Set(['5:3', '6:3', '10:3', '11:3', '5:4', '6:4', '10:4', '11:4', '13:6', '14:6', '13:7', '14:7']);

export function DemoObstacleRoute() {
  const navigate = useNavigate();
  useSitOnArrival(DEMO_AGENT_ID);
  const randomObstacles = useMemo(() => generateRandomObstacles(), []);
  const randomObstacleKeys = useMemo(() => new Set(randomObstacles.map(toGridKey)), [randomObstacles]);
  const [activeScenarioId, setActiveScenarioId] = useState<(typeof scenarios)[number]['id']>('east-run');
  const timeoutsRef = useRef<number[]>([]);
  const activeScenarioIdRef = useRef<(typeof scenarios)[number]['id']>('east-run');
  const gameReadyRef = useRef(false);

  const clearDemoTimers = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  }, []);

  const runScenario = useCallback(
    (scenario: (typeof scenarios)[number]) => {
      clearDemoTimers();
      setActiveScenarioId(scenario.id);
      activeScenarioIdRef.current = scenario.id;
      if (!gameReadyRef.current) return;
      gameBus.emit('demo:obstacles-set', { obstacles: randomObstacles, goal: scenario.goal });

      const now = Date.now();
      const agent: Agent = {
        id: DEMO_AGENT_ID,
        name: 'Pathfinder Demo',
        status: 'idle',
        direction: 'south',
        position: START,
        updatedAt: now,
      };
      const moveDelay = 520;

      gameBus.emit('agent:event', { type: 'agent:remove', agentId: DEMO_AGENT_ID });
      timeoutsRef.current.push(
        window.setTimeout(() => {
          gameBus.emit('agent:event', { type: 'agent:upsert', agent });
        }, 0),
        window.setTimeout(() => {
          gameBus.emit('agent:event', {
            type: 'agent:say',
            agentId: DEMO_AGENT_ID,
            message: scenario.message,
            durationMs: 1500,
            updatedAt: now + 1,
          });
        }, 260),
        window.setTimeout(() => {
          gameBus.emit('agent:event', {
            type: 'agent:move',
            agentId: DEMO_AGENT_ID,
            destination: scenario.goal,
            direction: 'east',
            updatedAt: now + 2,
          });
        }, moveDelay),
      );
    },
    [clearDemoTimers, randomObstacles],
  );

  useEffect(() => {
    const startDemo = () => {
      gameReadyRef.current = true;
      const scenario = scenarios.find((item) => item.id === activeScenarioIdRef.current) ?? scenarios[0];
      runScenario(scenario);
    };

    let fallbackId = 0;
    const startOnce = () => {
      window.clearTimeout(fallbackId);
      startDemo();
    };
    const unsubscribe = gameBus.on('game:ready', startOnce);
    fallbackId = window.setTimeout(startOnce, 900);

    return () => {
      unsubscribe();
      window.clearTimeout(fallbackId);
      clearDemoTimers();
      gameBus.emit('agent:event', { type: 'agent:remove', agentId: DEMO_AGENT_ID });
      gameBus.emit('demo:obstacles-set', { obstacles: [] });
    };
  }, [clearDemoTimers, randomObstacles, runScenario]);

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const goToOffice = () => {
    navigate('/', { replace: false });
  };

  return (
    <div className="app-shell demo-shell" aria-label="장애물 회피 걷기 데모">
      <PhaserGame />
      <TilesetSwitcher />
      <DemoNavigation />
      <section className="demo-panel" aria-label="데모 컨트롤">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={goToOffice} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Pathfinding</p>
          <h1>장애물 회피 걷기</h1>
          <p>
            새로고침마다 추가 장애물을 배치하고, A*가 `walls`, `furniture`, 랜덤 장애물을 피해 목적지까지 이동합니다.
          </p>
        </div>

        <div className="demo-map" aria-hidden="true">
          {Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, index) => {
            const x = index % MAP_WIDTH;
            const y = Math.floor(index / MAP_WIDTH);
            const key = `${x}:${y}`;
            const isWall = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
            const isStart = x === START.x && y === START.y;
            const isGoal = x === activeScenario.goal.x && y === activeScenario.goal.y;
            const isDesk = getDeskFootprint(getGoalDesk(activeScenario.goal)).some((desk) => desk.x === x && desk.y === y);
            const className = [
              'demo-map__cell',
              isWall ? 'demo-map__cell--wall' : '',
              furnitureTiles.has(key) ? 'demo-map__cell--furniture' : '',
              randomObstacleKeys.has(key) ? 'demo-map__cell--random' : '',
              isDesk ? 'demo-map__cell--desk' : '',
              isStart ? 'demo-map__cell--start' : '',
              isGoal ? 'demo-map__cell--chair' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return <span className={className} key={key} />;
          })}
        </div>

        <div className="demo-actions" aria-label="시나리오 선택">
          {scenarios.map((scenario) => (
            <button
              aria-pressed={scenario.id === activeScenarioId}
              key={scenario.id}
              onClick={() => runScenario(scenario)}
              type="button"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function generateRandomObstacles() {
  const baseBlocked = createBaseBlockedTiles();
  const reserved = new Set([
    toGridKey(START),
    ...scenarios.flatMap((scenario) => [
      toGridKey(scenario.goal),
      ...getDeskFootprint(getGoalDesk(scenario.goal)).map(toGridKey),
    ]),
  ]);
  const candidates: GridPoint[] = [];

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      const key = `${x}:${y}`;
      if (!baseBlocked.has(key) && !reserved.has(key)) {
        candidates.push({ x, y });
      }
    }
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const count = 14 + Math.floor(Math.random() * 12);
    const obstacles = shuffled.slice(0, count);
    const blocked = new Set([...baseBlocked, ...obstacles.map(toGridKey)]);

    if (
      scenarios.every((scenario) =>
        hasRoute(START, scenario.goal, new Set([...blocked, ...getDeskFootprint(getGoalDesk(scenario.goal)).map(toGridKey)])),
      )
    ) {
      return obstacles;
    }
  }

  return [];
}

function createBaseBlockedTiles() {
  const blocked = new Set<string>();

  for (let x = 0; x < MAP_WIDTH; x += 1) {
    blocked.add(`${x}:0`);
    blocked.add(`${x}:${MAP_HEIGHT - 1}`);
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    blocked.add(`0:${y}`);
    blocked.add(`${MAP_WIDTH - 1}:${y}`);
  }

  furnitureTiles.forEach((tile) => blocked.add(tile));
  return blocked;
}

function hasRoute(start: GridPoint, goal: GridPoint, blocked: ReadonlySet<string>) {
  return getShortestPathDistance(start, goal, blocked) !== null;
}

function getShortestPathDistance(start: GridPoint, goal: GridPoint, blocked: ReadonlySet<string>) {
  const queue = [start];
  const visited = new Set([toGridKey(start)]);
  const distances = new Map([[toGridKey(start), 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDistance = distances.get(toGridKey(current)) ?? 0;
    if (current.x === goal.x && current.y === goal.y) return currentDistance;

    [
      { x: current.x, y: current.y - 1 },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
    ].forEach((next) => {
      const key = toGridKey(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= MAP_WIDTH ||
        next.y >= MAP_HEIGHT ||
        blocked.has(key) ||
        visited.has(key)
      ) {
        return;
      }

      visited.add(key);
      distances.set(key, currentDistance + 1);
      queue.push(next);
    });
  }

  return null;
}

function toGridKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}

function getGoalDesk(goal: GridPoint): GridPoint {
  return { x: goal.x + 1, y: goal.y };
}

function getDeskFootprint(anchor: GridPoint): GridPoint[] {
  return [
    { x: anchor.x, y: anchor.y - 1 },
    anchor,
  ];
}
