import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { gameBus } from '../bridge/index.js';
import type { AgentId, Direction, GridPoint } from '../domain/index.js';
import { PhaserGame } from '../game/PhaserGame.js';
import { DemoNavigation } from './DemoNavigation.js';
import { TilesetSwitcher } from './TilesetSwitcher/TilesetSwitcher.js';

const RUNNER_AGENT_ID = 'demo-crowd-runner';
const WALKER_COUNT = 9;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 11;
const START: GridPoint = { x: 2, y: 8 };
const GOAL: GridPoint = { x: 16, y: 5 };
const STEP_DURATION_MS = 220;
const RUNNER_REST_MS = 2000;

type Walker = {
  id: AgentId;
  name: string;
  position: GridPoint;
  direction: Direction;
};

const furnitureTiles = new Set(['5:3', '6:3', '10:3', '11:3', '5:4', '6:4', '10:4', '11:4', '13:6', '14:6', '13:7', '14:7']);

export function DemoAgentCrowdCollisionRoute() {
  const navigate = useNavigate();
  const initialWalkers = useMemo(() => createRandomWalkers(), []);
  const [walkers, setWalkers] = useState(initialWalkers);
  const [runnerPosition, setRunnerPosition] = useState(START);
  const walkersRef = useRef(initialWalkers);
  const runnerPositionRef = useRef(START);
  const runnerTargetRef = useRef(GOAL);
  const busyUntilRef = useRef(new Map<AgentId, number>());
  const timersRef = useRef<number[]>([]);
  const gameReadyRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  const removeDemoAgents = useCallback(() => {
    getAllDemoAgentIds().forEach((agentId) => {
      gameBus.emit('agent:event', { type: 'agent:remove', agentId });
    });
  }, []);

  const spawnDemo = useCallback(
    (nextWalkers = createRandomWalkers()) => {
      clearTimers();
      busyUntilRef.current.clear();
      walkersRef.current = nextWalkers;
      setWalkers(nextWalkers);
      runnerPositionRef.current = START;
      runnerTargetRef.current = GOAL;
      setRunnerPosition(START);

      const now = Date.now();
      gameBus.emit('demo:obstacles-set', { obstacles: [], seats: [START, GOAL] });
      removeDemoAgents();
      nextWalkers.forEach((walker, index) => {
        gameBus.emit('agent:event', {
          type: 'agent:upsert',
          agent: {
            id: walker.id,
            name: walker.name,
            status: 'idle',
            direction: walker.direction,
            position: walker.position,
            updatedAt: now + index,
          },
        });
      });
      gameBus.emit('agent:event', {
        type: 'agent:upsert',
          agent: {
            id: RUNNER_AGENT_ID,
            name: 'Crowd Runner',
            status: 'sitting',
            direction: 'east',
            position: START,
            updatedAt: now + 20,
        },
      });

      scheduleWalkerLoop();
      timersRef.current.push(window.setTimeout(() => moveRunnerToTarget(), RUNNER_REST_MS));
    },
    // 이동 루프는 위치 상태를 ref에서 읽으므로 렌더마다 재생성하면 데모가 불필요하게 재시작된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTimers, removeDemoAgents],
  );

  useEffect(() => {
    const startDemo = () => {
      gameReadyRef.current = true;
      spawnDemo(initialWalkers);
    };

    let fallbackId = 0;
    const startOnce = () => {
      window.clearTimeout(fallbackId);
      startDemo();
    };
    const unsubscribe = gameBus.on('game:ready', startOnce);
    const unsubscribeMoveComplete = gameBus.on('agent:move-complete', ({ agentId, destination }) => {
      if (agentId !== RUNNER_AGENT_ID) return;
      if (!isSeatTile(destination)) return;

      runnerPositionRef.current = destination;
      setRunnerPosition(destination);
      gameBus.emit('agent:event', {
        type: 'agent:status',
        agentId: RUNNER_AGENT_ID,
        status: 'sitting',
        updatedAt: Date.now(),
      });
      runnerTargetRef.current = destination.x === GOAL.x && destination.y === GOAL.y ? START : GOAL;
      timersRef.current.push(window.setTimeout(() => moveRunnerToTarget(), RUNNER_REST_MS));
    });
    fallbackId = window.setTimeout(startOnce, 900);

    return () => {
      unsubscribe();
      unsubscribeMoveComplete();
      window.clearTimeout(fallbackId);
      clearTimers();
      removeDemoAgents();
      gameBus.emit('demo:obstacles-set', { obstacles: [] });
    };
  }, [clearTimers, initialWalkers, removeDemoAgents, spawnDemo]);

  const walkerKeys = new Set(walkers.map((walker) => toGridKey(walker.position)));
  const runnerKey = toGridKey(runnerPosition);

  return (
    <div className="app-shell demo-shell" aria-label="움직이는 캐릭터 충돌 회피 데모">
      <PhaserGame />
      <TilesetSwitcher />
      <DemoNavigation />
      <section className="demo-panel" aria-label="데모 컨트롤">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={() => navigate('/', { replace: false })} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Moving Crowd</p>
          <h1>움직이는 캐릭터 회피</h1>
          <p>주변 캐릭터가 계속 무작위로 이동하는 동안 목표 캐릭터가 양쪽 책상 사이를 왕복합니다.</p>
        </div>

        <div className="demo-map" aria-hidden="true">
          {Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, index) => {
            const x = index % MAP_WIDTH;
            const y = Math.floor(index / MAP_WIDTH);
            const point = { x, y };
            const key = toGridKey(point);
            const isWall = isBoundary(point);
            const isDesk = isDeskTile(point);
            const isChair = isSeatTile(point);
            const className = [
              'demo-map__cell',
              isWall ? 'demo-map__cell--wall' : '',
              furnitureTiles.has(key) ? 'demo-map__cell--furniture' : '',
              isDesk ? 'demo-map__cell--desk' : '',
              walkerKeys.has(key) ? 'demo-map__cell--agent' : '',
              key === runnerKey ? 'demo-map__cell--start' : '',
              isChair ? 'demo-map__cell--chair' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return <span className={className} key={key} />;
          })}
        </div>

        <div className="demo-actions demo-actions--single" aria-label="데모 실행">
          <button onClick={() => spawnDemo()} type="button">
            무작위 재배치
          </button>
        </div>
      </section>
    </div>
  );

  function scheduleWalkerLoop() {
    if (!gameReadyRef.current) return;
    timersRef.current.push(
      window.setTimeout(() => {
        moveRandomWalker();
        scheduleWalkerLoop();
      }, 520),
    );
  }

  function moveRandomWalker() {
    const now = Date.now();
    const available = walkersRef.current.filter((walker) => (busyUntilRef.current.get(walker.id) ?? 0) <= now);
    const walker = pickRandom(available);
    if (!walker) return;

    const target = pickRandom(getWalkerTargets(walker));
    if (!target) return;

    const pathLength = getShortestPathDistance(
      walker.position,
      target,
      getBlockedTiles({ excludeAgentId: walker.id, includeRunner: true }),
    );
    if (pathLength === null) return;

    const durationMs = Math.max(1, pathLength) * STEP_DURATION_MS;
    const direction = getDirection(walker.position, target);
    busyUntilRef.current.set(walker.id, now + durationMs + 220);
    walkersRef.current = walkersRef.current.map((item) =>
      item.id === walker.id ? { ...item, position: target, direction } : item,
    );
    setWalkers(walkersRef.current);

    gameBus.emit('agent:event', {
      type: 'agent:move',
      agentId: walker.id,
      destination: target,
      direction,
      updatedAt: now,
    });
    timersRef.current.push(
      window.setTimeout(() => {
        busyUntilRef.current.delete(walker.id);
      }, durationMs + 80),
    );
  }

  function moveRunnerToTarget() {
    const now = Date.now();
    const target = runnerTargetRef.current;

    gameBus.emit('agent:event', {
      type: 'agent:say',
      agentId: RUNNER_AGENT_ID,
      message: target.x === GOAL.x && target.y === GOAL.y ? 'to east desk' : 'back to start',
      durationMs: 1500,
      updatedAt: now,
    });
    gameBus.emit('agent:event', {
      type: 'agent:move',
      agentId: RUNNER_AGENT_ID,
      destination: target,
      direction: 'east',
      updatedAt: now + 1,
    });
  }

  function getWalkerTargets(walker: Walker) {
    return getWalkableTiles().filter((point) => {
      const key = toGridKey(point);
      return key !== toGridKey(walker.position) && !isSeatTile(point) && !isDeskTile(point);
    });
  }

  function getBlockedTiles(options: { excludeAgentId: AgentId; includeRunner: boolean }) {
    const blocked = new Set([...furnitureTiles, ...getDeskTiles().map(toGridKey)]);
    walkersRef.current.forEach((walker) => {
      if (walker.id !== options.excludeAgentId) {
        blocked.add(toGridKey(walker.position));
      }
    });

    if (options.includeRunner && options.excludeAgentId !== RUNNER_AGENT_ID) {
      blocked.add(toGridKey(runnerPositionRef.current));
    }

    return blocked;
  }
}

function createRandomWalkers(): Walker[] {
  const reserved = new Set([...getSeatTiles().map(toGridKey), ...getDeskTiles().map(toGridKey)]);
  const candidates = getWalkableTiles().filter((point) => !reserved.has(toGridKey(point)));

  return shuffle(candidates)
    .slice(0, WALKER_COUNT)
    .map((position, index) => ({
      id: getWalkerId(index),
      name: getWalkerName(index),
      position,
      direction: getRandomDirection(),
    }));
}

function getAllDemoAgentIds(): AgentId[] {
  return [RUNNER_AGENT_ID, ...Array.from({ length: WALKER_COUNT }, (_, index) => getWalkerId(index))];
}

function getWalkableTiles() {
  const tiles: GridPoint[] = [];

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      const point = { x, y };
      if (!furnitureTiles.has(toGridKey(point)) && !isDeskTile(point)) {
        tiles.push(point);
      }
    }
  }

  return tiles;
}

function getShortestPathDistance(start: GridPoint, goal: GridPoint, blocked: ReadonlySet<string>) {
  const queue = [start];
  const visited = new Set([toGridKey(start)]);
  const distances = new Map([[toGridKey(start), 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const distance = distances.get(toGridKey(current)) ?? 0;
    if (current.x === goal.x && current.y === goal.y) return distance;

    getNeighborTiles(current).forEach((next) => {
      const key = toGridKey(next);
      if (isBoundary(next) || visited.has(key)) return;
      if (blocked.has(key) && !(next.x === goal.x && next.y === goal.y)) return;

      visited.add(key);
      distances.set(key, distance + 1);
      queue.push(next);
    });
  }

  return null;
}

function getNeighborTiles(point: GridPoint): GridPoint[] {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ];
}

function isBoundary(point: GridPoint) {
  return point.x <= 0 || point.y <= 0 || point.x >= MAP_WIDTH - 1 || point.y >= MAP_HEIGHT - 1;
}

function getSeatTiles() {
  return [START, GOAL];
}

function getDeskTiles() {
  return getSeatTiles().flatMap((seat) => getDeskFootprint({ x: seat.x + 1, y: seat.y }));
}

function isSeatTile(point: GridPoint) {
  return getSeatTiles().some((seat) => seat.x === point.x && seat.y === point.y);
}

function isDeskTile(point: GridPoint) {
  return getDeskTiles().some((desk) => desk.x === point.x && desk.y === point.y);
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

function pickRandom<T>(items: T[]) {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function getDirection(from: GridPoint, to: GridPoint): Direction {
  if (to.x > from.x) return 'east';
  if (to.x < from.x) return 'west';
  if (to.y < from.y) return 'north';
  return 'south';
}

function getRandomDirection(): Direction {
  const directions = ['north', 'east', 'south', 'west'] as const;
  return directions[Math.floor(Math.random() * directions.length)];
}

function getWalkerId(index: number): AgentId {
  return `demo-crowd-walker-${index + 1}`;
}

function getWalkerName(index: number) {
  const names = ['Planner', 'Reviewer', 'Builder', 'Tester', 'Linter', 'Writer', 'Tracer', 'Shipper', 'Observer'];
  return `${names[index] ?? 'Agent'} ${index + 1}`;
}

function toGridKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
