import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadTypeScript(path, imports, expose = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('/'));
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source + expose, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name) => imports(name), Date });
  return exports;
}
const { PathfindingSystem } = loadTypeScript('../../office-core/src/pathfinding.ts', () => ({}));
const occupancy = loadTypeScript('../../office-core/src/agentOccupancy.ts', () => ({}));
const completed = [];
const { isOccupiedByOtherAgent } = occupancy;
const { createOfficeSceneAgentController } = loadTypeScript(
  '../src/game/scenes/OfficeScene.ts',
  (name) => name.includes('agentOccupancy') ? occupancy : name === 'phaser' ? { Scene: class {} } : name === '@pixel-office/engine/events' || name.includes('bridge')
    ? { gameBus: { emit: (type, data) => completed.push({ type, ...data }) } }
    : name.includes('MatrixEffect') ? { playMatrixDespawnEffect: (_, __, done) => done() } : {},
);

function fixture(positions) {
  const tweens = [];
  const timers = [];
  const characters = new Map(Object.entries(positions).map(([id, p]) => [id, {
    sprite: { x: p.x * 16 + 8, y: (p.y + 1) * 16, scene: {}, setVisible() {}, setAlpha() {}, setTint() {} },
    direction: 'east', status: 'idle',
    setStatus(value) { this.status = value; }, setDirection(value) { this.direction = value; }, setDepth() {}, destroy() {},
  }]));
  const agentTiles = new Map(Object.entries(positions));
  const reservedTiles = new Map();
  const config = {
    characters, agentTiles, reservedTiles, characterDepth: 3, movementTokens: new Map(),
    scene: { time: { delayedCall: (_, fn) => timers.push(fn) }, tweens: {
      add(tween) { tweens.push(tween); tween.onStart?.(); },
      killTweensOf(sprite) { for (const t of tweens) if (t.targets === sprite) t.killed = true; },
      chain() { throw new Error('Seat movement bypassed per-step collision checks'); },
    } },
    seatAssignment: { assignSeat: () => ({ position: { x: 3, y: 2 } }), releaseAgent() {} }, socialSystem: {},
    findPathAvoidingAgents: (id, start, goal) => new PathfindingSystem(8, 6,
      (point) => !isOccupiedByOtherAgent(agentTiles, reservedTiles, id, point)).findPath(start, goal),
    isActive: () => true,
  };
  return {
    ...config, tweens, timers, controller: createOfficeSceneAgentController(config),
    finish(tween) {
      assert.ok(!tween.killed, 'An in-flight step must not be cancelled between tiles');
      tween.targets.x = tween.x; tween.targets.y = tween.y; tween.onComplete?.();
    },
  };
}

test('an occupied destination remains blocked', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  assert.equal(f.tweens.length, 0);
  assert.equal(f.characters.get('a').status, 'idle');
});

test('two agents cannot reserve the same next tile', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 4, y: 2 } });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  f.controller.moveAgent('b', { x: 3, y: 2 });
  const targets = f.tweens.map(t => `${t.x}:${t.y}`);
  assert.equal(new Set(targets).size, targets.length);
});

test('seat assignment obeys occupied destination checks', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.assignSeat('a');
  assert.equal(f.tweens.length, 0);
  assert.equal(f.characters.get('a').status, 'idle');
});

test('upsert without a position preserves the occupied tile', () => {
  const f = fixture({ a: { x: 2, y: 2 } });
  f.controller.upsertAgent({ id: 'a', status: 'idle' });
  assert.equal(f.agentTiles.get('a').x, 2);
  assert.equal(f.agentTiles.get('a').y, 2);
});

test('retargeting finishes the current step before turning', () => {
  const f = fixture({ a: { x: 2, y: 2 } });
  f.controller.moveAgent('a', { x: 5, y: 2 });
  const first = f.tweens[0];
  first.targets.x += 8;
  f.controller.moveAgent('a', { x: 2, y: 4 });
  assert.equal(f.tweens.length, 1);
  f.finish(first);
  assert.equal(f.agentTiles.get('a').x, 3);
  assert.equal(f.reservedTiles.has('a'), false);
  f.timers.shift()();
  const next = f.tweens.at(-1);
  assert.equal(Math.abs(next.x - first.x) + Math.abs(next.y - first.y), 16);
});

test('a moving agent retains its departure tile until arrival', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.moveAgent('b', { x: 4, y: 2 });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  assert.equal(f.tweens.length, 1);
  assert.equal(f.tweens[0].targets, f.characters.get('b').sprite);
  f.finish(f.tweens[0]);
  f.timers.shift()();
  assert.equal(f.tweens.length, 2);
  assert.equal(f.tweens[1].targets, f.characters.get('a').sprite);
});

test('head-on agents cannot exchange occupied tiles', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  f.controller.moveAgent('b', { x: 2, y: 2 });
  assert.equal(f.tweens.length, 0);
});

test('a position update moves the sprite without teleporting occupancy', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.upsertAgent({ id: 'a', position: { x: 3, y: 2 }, status: 'idle' });
  assert.equal(f.agentTiles.get('a').x, 2);
  assert.equal(f.characters.get('a').sprite.x, 40);
  assert.equal(f.tweens.length, 0);
});

test('removing a moving agent releases both tiles and ignores late completion', () => {
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 4, y: 2 } });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  const oldStep = f.tweens[0];
  f.controller.removeAgent('a');
  assert.equal(f.reservedTiles.has('a'), false);
  assert.equal(f.agentTiles.has('a'), false);
  oldStep.onComplete();
  assert.equal(f.agentTiles.has('a'), false);
  f.controller.moveAgent('b', { x: 3, y: 2 });
  assert.equal(f.tweens.length, 2);
});

test('waiting does not emit arrival before the destination is reached', () => {
  completed.length = 0;
  const f = fixture({ a: { x: 2, y: 2 }, b: { x: 3, y: 2 } });
  f.controller.moveAgent('a', { x: 3, y: 2 });
  assert.equal(completed.length, 0);
  f.controller.removeAgent('b');
  f.timers.shift()();
  assert.equal(completed.length, 0);
  f.finish(f.tweens[0]);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].agentId, 'a');
  assert.equal(completed[0].type, 'agent:move-complete');
});
