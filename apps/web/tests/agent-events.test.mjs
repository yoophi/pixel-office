import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => imports[name] ?? {} });
  return exports;
}
const { AgentEventInbox, isAgentEvent } = load('../src/host/agentEvents.ts');
const agent = { id: 'agent-1', name: 'Worker', status: 'idle', updatedAt: 1 };

test('events received before scene ready are delivered once and in order', () => {
  const events = [];
  const inbox = new AgentEventInbox((event) => events.push(event));
  inbox.accept({ type: 'agent:upsert', agent });
  inbox.accept({ type: 'agent:status', agentId: agent.id, status: 'typing', updatedAt: 2 });
  assert.equal(events.length, 0);
  assert.equal(inbox.getSnapshot()[0].status, 'typing');
  inbox.markReady();
  inbox.markReady();
  assert.deepEqual(events.map((e) => e.type), ['agent:upsert', 'agent:status']);
  assert.equal(events[0].agent.status, 'idle');
  inbox.accept({ type: 'agent:remove', agentId: agent.id });
  assert.equal(events.length, 3);
  assert.equal(inbox.getSnapshot().length, 0);
});

test('invalid external events are rejected without modifying the scene or list', () => {
  const inbox = new AgentEventInbox(() => { throw new Error('invalid delivery'); });
  inbox.markReady();
  for (const event of [null, {}, { type: 'agent:upsert', agent: { ...agent, status: 'broken' } },
    { type: 'agent:move', agentId: agent.id, destination: { x: Infinity, y: 0 }, updatedAt: 2 },
    { type: 'agent:say', agentId: agent.id, message: 'hello', durationMs: -1, updatedAt: 2 }]) {
    assert.equal(inbox.accept(event), false);
  }
  assert.equal(inbox.getSnapshot().length, 0);
  assert.equal(isAgentEvent({ type: 'agent:upsert', agent }), true);
});

test('browser host rejects foreign messages and releases subscriptions', () => {
  const handlers = new Map();
  const delivered = [];
  let ready;
  let unsubscribed = false;
  const bus = { emit: (...args) => delivered.push(args), on: (_, fn) => { ready = fn; return () => { unsubscribed = true; }; } };
  const { connectAgentHost } = load('../src/host/browser.ts', {
    '@pixel-office/engine/events': { gameBus: bus }, './agentEvents.js': { AgentEventInbox },
  });
  const target = { location: { origin: 'http://localhost:5199' },
    addEventListener: (key, fn) => handlers.set(key, fn), removeEventListener: (key) => handlers.delete(key), postMessage() {} };
  target.parent = target;
  const host = connectAgentHost(target);
  const message = { origin: target.location.origin, source: target, data: { channel: 'pixel-office', event: { type: 'agent:upsert', agent } } };
  handlers.get('message')({ ...message, origin: 'https://foreign.example' });
  handlers.get('message')({ ...message, source: {} });
  assert.equal(host.inbox.getSnapshot().length, 0);
  handlers.get('message')(message);
  ready();
  assert.equal(delivered.length, 1);
  host.dispose();
  assert.equal(handlers.size, 0);
  assert.equal(unsubscribed, true);
  assert.equal(host.inbox.getSnapshot().length, 0);
});
