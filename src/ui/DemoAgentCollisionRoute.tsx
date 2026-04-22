import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { gameBus } from '../bridge/index.js';
import type { Agent, AgentId, Direction, GridPoint } from '../domain/index.js';
import { PhaserGame } from '../game/PhaserGame.js';
import { DemoNavigation } from './DemoNavigation.js';
import { useSitOnArrival } from './hooks/useSitOnArrival.js';
import { TilesetSwitcher } from './TilesetSwitcher/TilesetSwitcher.js';

const RUNNER_AGENT_ID = 'demo-collision-runner';
const MAP_WIDTH = 20;
const MAP_HEIGHT = 11;

const scenarios = [
  {
    id: 'desk-row',
    label: '통로 점유 회피',
    start: { x: 3, y: 8 },
    goal: { x: 16, y: 8 },
    blockerCount: 8,
    message: 'occupied',
  },
  {
    id: 'narrow-pass',
    label: '좁은 통로 회피',
    start: { x: 2, y: 5 },
    goal: { x: 17, y: 5 },
    blockerCount: 6,
    message: 'rerouting',
  },
] as const;

type Scenario = (typeof scenarios)[number];
type DemoBlocker = {
  id: AgentId;
  name: string;
  position: GridPoint;
  direction: Direction;
};

const furnitureTiles = new Set(['5:3', '6:3', '10:3', '11:3', '5:4', '6:4', '10:4', '11:4', '13:6', '14:6', '13:7', '14:7']);

export function DemoAgentCollisionRoute() {
  const navigate = useNavigate();
  useSitOnArrival(RUNNER_AGENT_ID);
  const initialBlockers = useMemo(() => createRandomBlockersByScenario(), []);
  const [activeScenarioId, setActiveScenarioId] = useState<Scenario['id']>('desk-row');
  const [blockersByScenario, setBlockersByScenario] = useState(initialBlockers);
  const blockersByScenarioRef = useRef(initialBlockers);
  const timeoutsRef = useRef<number[]>([]);
  const activeScenarioIdRef = useRef<Scenario['id']>('desk-row');
  const gameReadyRef = useRef(false);

  const clearDemoTimers = useCallback(() => {
    timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutsRef.current = [];
  }, []);

  const removeDemoAgents = useCallback(() => {
    getAllDemoAgentIds().forEach((agentId) => {
      gameBus.emit('agent:event', { type: 'agent:remove', agentId });
    });
  }, []);

  const rerollScenario = useCallback((scenario: Scenario) => {
    const blockers = createRandomBlockers(scenario);
    blockersByScenarioRef.current = { ...blockersByScenarioRef.current, [scenario.id]: blockers };
    setBlockersByScenario(blockersByScenarioRef.current);
    return blockers;
  }, []);

  const runScenario = useCallback(
    (scenario: Scenario, blockers = blockersByScenarioRef.current[scenario.id]) => {
      clearDemoTimers();
      setActiveScenarioId(scenario.id);
      activeScenarioIdRef.current = scenario.id;
      if (!gameReadyRef.current) return;

      const now = Date.now();
      const runner: Agent = {
        id: RUNNER_AGENT_ID,
        name: 'Collision Demo',
        status: 'idle',
        direction: 'east',
        position: scenario.start,
        updatedAt: now,
      };

      gameBus.emit('demo:obstacles-set', { obstacles: [], goal: scenario.goal });
      removeDemoAgents();
      blockers.forEach((blocker, index) => {
        gameBus.emit('agent:event', {
          type: 'agent:upsert',
          agent: {
            id: blocker.id,
            name: blocker.name,
            status: 'idle',
            direction: blocker.direction,
            position: blocker.position,
            updatedAt: now + index,
          },
        });
      });

      timeoutsRef.current.push(
        window.setTimeout(() => {
          gameBus.emit('agent:event', { type: 'agent:upsert', agent: runner });
        }, 80),
        window.setTimeout(() => {
          gameBus.emit('agent:event', {
            type: 'agent:say',
            agentId: RUNNER_AGENT_ID,
            message: scenario.message,
            durationMs: 1400,
            updatedAt: now + 10,
          });
        }, 340),
        window.setTimeout(() => {
          gameBus.emit('agent:event', {
            type: 'agent:move',
            agentId: RUNNER_AGENT_ID,
            destination: scenario.goal,
            direction: 'east',
            updatedAt: now + 11,
          });
        }, 680),
      );
    },
    [clearDemoTimers, removeDemoAgents],
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
      removeDemoAgents();
      gameBus.emit('demo:obstacles-set', { obstacles: [] });
    };
  }, [clearDemoTimers, removeDemoAgents, runScenario]);

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const activeBlockers = blockersByScenario[activeScenario.id];
  const blockerKeys = new Set(activeBlockers.map((blocker) => toGridKey(blocker.position)));

  return (
    <div className="app-shell demo-shell" aria-label="캐릭터 충돌 회피 데모">
      <PhaserGame />
      <TilesetSwitcher />
      <DemoNavigation />
      <section className="demo-panel" aria-label="데모 컨트롤">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={() => navigate('/', { replace: false })} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Agent Avoidance</p>
          <h1>캐릭터 충돌 회피</h1>
          <p>이동 캐릭터가 다른 캐릭터가 점유한 타일을 동적 장애물로 보고 우회합니다.</p>
        </div>

        <div className="demo-map" aria-hidden="true">
          {Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, index) => {
            const x = index % MAP_WIDTH;
            const y = Math.floor(index / MAP_WIDTH);
            const key = `${x}:${y}`;
            const isWall = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
            const isStart = x === activeScenario.start.x && y === activeScenario.start.y;
            const isGoal = x === activeScenario.goal.x && y === activeScenario.goal.y;
            const isDesk = getDeskFootprint(getGoalDesk(activeScenario)).some((desk) => desk.x === x && desk.y === y);
            const className = [
              'demo-map__cell',
              isWall ? 'demo-map__cell--wall' : '',
              furnitureTiles.has(key) ? 'demo-map__cell--furniture' : '',
              isDesk ? 'demo-map__cell--desk' : '',
              blockerKeys.has(key) ? 'demo-map__cell--agent' : '',
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
              onClick={() => runScenario(scenario, rerollScenario(scenario))}
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

function getAllDemoAgentIds(): AgentId[] {
  return [
    RUNNER_AGENT_ID,
    ...Array.from({ length: Math.max(...scenarios.map((scenario) => scenario.blockerCount)) }, (_, index) =>
      getBlockerId(index),
    ),
  ];
}

function createRandomBlockersByScenario() {
  return Object.fromEntries(scenarios.map((scenario) => [scenario.id, createRandomBlockers(scenario)])) as Record<
    Scenario['id'],
    DemoBlocker[]
  >;
}

function createRandomBlockers(scenario: Scenario): DemoBlocker[] {
  const candidates = getWalkableCandidates(scenario);
  const fixedBlocked = new Set([...furnitureTiles, ...getDeskFootprint(getGoalDesk(scenario)).map(toGridKey)]);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const blockers = shuffle(candidates).slice(0, scenario.blockerCount);
    const blocked = new Set([...fixedBlocked, ...blockers.map(toGridKey)]);
    if (hasRoute(scenario.start, scenario.goal, blocked)) {
      return toDemoBlockers(blockers);
    }
  }

  for (let count = scenario.blockerCount - 1; count > 0; count -= 1) {
    const blockers = shuffle(candidates).slice(0, count);
    const blocked = new Set([...fixedBlocked, ...blockers.map(toGridKey)]);
    if (hasRoute(scenario.start, scenario.goal, blocked)) {
      return toDemoBlockers(blockers);
    }
  }

  return [];
}

function getWalkableCandidates(scenario: Scenario) {
  const reserved = new Set([
    toGridKey(scenario.start),
    toGridKey(scenario.goal),
    ...getDeskFootprint(getGoalDesk(scenario)).map(toGridKey),
  ]);
  const candidates: GridPoint[] = [];

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      const point = { x, y };
      const key = toGridKey(point);
      if (!reserved.has(key) && !furnitureTiles.has(key)) {
        candidates.push(point);
      }
    }
  }

  return candidates;
}

function hasRoute(start: GridPoint, goal: GridPoint, blocked: ReadonlySet<string>) {
  const queue = [start];
  const visited = new Set([toGridKey(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.x === goal.x && current.y === goal.y) return true;

    [
      { x: current.x, y: current.y - 1 },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
    ].forEach((next) => {
      const key = toGridKey(next);
      if (
        next.x <= 0 ||
        next.y <= 0 ||
        next.x >= MAP_WIDTH - 1 ||
        next.y >= MAP_HEIGHT - 1 ||
        blocked.has(key) ||
        visited.has(key)
      ) {
        return;
      }

      visited.add(key);
      queue.push(next);
    });
  }

  return false;
}

function getGoalDesk(scenario: Scenario): GridPoint {
  return { x: scenario.goal.x + 1, y: scenario.goal.y };
}

function getDeskFootprint(anchor: GridPoint): GridPoint[] {
  return [
    { x: anchor.x, y: anchor.y - 1 },
    anchor,
  ];
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled;
}

function toDemoBlockers(points: GridPoint[]): DemoBlocker[] {
  return points.map((position, index) => ({
    id: getBlockerId(index),
    name: getBlockerName(index),
    position,
    direction: getRandomDirection(),
  }));
}

function getBlockerId(index: number): AgentId {
  return `demo-blocker-${index + 1}`;
}

function getBlockerName(index: number) {
  const names = ['Review Agent', 'Build Agent', 'Test Agent', 'Docs Agent', 'Lint Agent', 'Plan Agent', 'Trace Agent', 'Ship Agent'];
  return names[index] ?? `Agent ${index + 1}`;
}

function getRandomDirection(): Direction {
  const directions = ['north', 'east', 'south', 'west'] as const;
  return directions[Math.floor(Math.random() * directions.length)];
}

function toGridKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
