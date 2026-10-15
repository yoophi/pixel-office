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
const occupancy = loadTypeScript('../../../packages/office-core/src/agentOccupancy.ts', () => ({}));
const sceneImports = (name) => name.includes('agentOccupancy') ? occupancy
  : name === 'phaser' ? { Scene: class {}, Math: { Between: (min) => min } } : {};
const { RandomOfficeChatterScene } = loadTypeScript('../src/ui/DemoRandomOfficeChatterRoute.tsx', sceneImports,
  '\nexport { RandomOfficeChatterScene };');
const { PixelAgentsOfficeScene } = loadTypeScript('../../../packages/office-engine/src/game/scenes/PixelAgentsOfficeScene.ts', sceneImports);

test('random office spawn rejects occupied and reserved tiles', () => {
  const scene = new RandomOfficeChatterScene();
  scene.worldWidth = 320;
  scene.worldHeight = 320;
  scene.agentTiles.set('existing', { x: 1, y: 2 });
  assert.equal(scene.getRandomOpenTile(), undefined);
  scene.agentTiles.clear();
  scene.reservedTiles.set('moving', { x: 1, y: 2 });
  assert.equal(scene.getRandomOpenTile(), undefined);
  scene.reservedTiles.clear();
  assert.equal(scene.getRandomOpenTile().x, 1);
});

for (const [name, create, available] of [
  ['random office', () => {
    const scene = new RandomOfficeChatterScene();
    scene.worldWidth = 320; scene.worldHeight = 320;
    return scene;
  }, (scene, point) => scene.isAvailableForAgent({ character: { id: 'self' } }, point)],
  ['pixel office', () => new PixelAgentsOfficeScene(),
    (scene, point) => scene.available(point, { character: { id: 'self' } })],
]) {
  test(`${name} blocks standing, seated and next-step occupants`, () => {
    const scene = create();
    scene.agentTiles.set('self', { x: 2, y: 2 });
    scene.agentTiles.set('other', { x: 3, y: 2 });
    scene.reservedTiles.set('other', { x: 4, y: 2 });
    assert.equal(available(scene, { x: 3, y: 2 }), false);
    assert.equal(available(scene, { x: 4, y: 2 }), false);
    assert.equal(available(scene, { x: 2, y: 2 }), true);
    assert.equal(available(scene, { x: 5, y: 2 }), true);
  });
}
