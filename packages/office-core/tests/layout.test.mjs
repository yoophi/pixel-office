import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const exports = {};
  cache.set(url.href, exports);
  const source = readFileSync(url, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: (name) => { assert.ok(name.startsWith('.'), 'core must run without browser or engine dependencies'); return load(new URL(name.replace(/\.js$/, '.ts'), url)); } });
  return exports;
}
const { buildFurnitureCatalog } = load(new URL('../src/pixelAgents/manifest.ts', import.meta.url));
const { generateOfficeLayout, createOfficeLayoutMemo } = load(new URL('../src/pixelAgents/generate.ts', import.meta.url));
const { isWalkable, getBlockedTiles } = load(new URL('../src/pixelAgents/layout.ts', import.meta.url));
const assets = new URL('../../office-assets/public/assets/pixel-agents/furniture/', import.meta.url);
const catalog = buildFurnitureCatalog(readdirSync(assets, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({ folder: entry.name, manifest: JSON.parse(readFileSync(new URL(`${entry.name}/manifest.json`, assets), 'utf8')) })));

test('layout generation remains deterministic and creates accessible seats', () => {
  for (const seed of [0, 1, 2, 85]) {
    const office = generateOfficeLayout(37, 23, seed, catalog);
    assert.ok(office);
    assert.ok(office.workstations.length > 0);
    assert.equal(JSON.stringify(office), JSON.stringify(generateOfficeLayout(37, 23, seed, catalog)));
    for (const workstation of office.workstations) {
      assert.ok(isWalkable(office.layout, getBlockedTiles(office.layout, catalog, workstation.seat.furnitureUid), workstation.seat.col, workstation.seat.row));
    }
  }
});

test('layout memo reuses matching geometry and recalculates after resize', () => {
  const layout = createOfficeLayoutMemo(catalog);
  const before = layout(37, 23, 85);
  assert.equal(layout(37, 23, 85), before);
  const after = layout(45, 28, 85);
  assert.notEqual(after, before);
  assert.equal(JSON.stringify(layout(37, 23, 85)), JSON.stringify(before));
  assert.equal(layout(1, 1, 85), null);
});

test('workspace packages have no app back references and the service does not import demos', () => {
  function files(url) {
    return readdirSync(url, { withFileTypes: true }).flatMap((entry) => {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
      return entry.isDirectory() ? files(child) : /\.tsx?$/.test(entry.name) ? [child] : [];
    });
  }
  const root = new URL('../../../', import.meta.url);
  for (const directory of ['packages/office-core/src/', 'packages/office-engine/src/', 'apps/web/src/']) {
    for (const file of files(new URL(directory, root))) {
      const imports = ts.preProcessFile(readFileSync(file, 'utf8')).importedFiles;
      for (const { fileName } of imports) {
        assert.ok(!fileName.includes('@pixel-office/demo'), `${file.pathname} imports demo code`);
        if (directory.startsWith('packages/')) {
          assert.ok(!fileName.includes('/apps/') && !fileName.includes('/demo/'), `${file.pathname} crosses app boundary`);
        }
        if (directory.includes('office-core')) assert.ok(fileName.startsWith('.'), `${file.pathname} imports ${fileName}`);
      }
    }
  }
});
