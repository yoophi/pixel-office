import * as Phaser from 'phaser';
import { furnitureFolders } from 'virtual:pixel-agents-furniture';

import {
  buildFurnitureCatalog,
  PIXEL_AGENTS_TILE_SIZE,
  type ColorValue,
  type FurnitureCatalog,
  type FurnitureManifest,
} from '../../domain/pixelAgents/index.js';

export const PIXEL_AGENTS_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/pixel-agents/`;

// pixel-agents core/src/assets/constants.ts 와 같은 시트 규격.
const FLOOR_PATTERN_COUNT = 9;
const WALL_PIECE_W = 16;
const WALL_PIECE_H = 32;
const WALL_GRID_COLS = 4;
const WALL_BITMASK_COUNT = 16;

export const floorTextureKey = (index: number) => `pixel-agents:floor:${index}`;
export const WALL_SHEET_KEY = 'pixel-agents:wall:0';
export const furnitureTextureKey = (type: string) => `pixel-agents:furniture:${type.replace(/:left$/, '')}`;

export async function loadFurnitureCatalog(): Promise<FurnitureCatalog> {
  const manifests = await Promise.all(
    furnitureFolders.map(async (folder) => {
      const response = await fetch(`${PIXEL_AGENTS_ASSET_ROOT}furniture/${folder}/manifest.json`);
      if (!response.ok) throw new Error(`pixel-agents manifest 로드 실패: ${folder} (${response.status})`);
      return { folder, manifest: (await response.json()) as FurnitureManifest };
    }),
  );
  return buildFurnitureCatalog(manifests);
}

export function preloadPixelAgentsAssets(scene: Phaser.Scene, catalog: FurnitureCatalog) {
  for (let i = 0; i < FLOOR_PATTERN_COUNT; i++) {
    scene.load.image(floorTextureKey(i), `${PIXEL_AGENTS_ASSET_ROOT}floors/floor_${i}.png`);
  }
  scene.load.image(WALL_SHEET_KEY, `${PIXEL_AGENTS_ASSET_ROOT}walls/wall_0.png`);
  for (const entry of catalog.values()) {
    if (entry.mirrored) continue;
    const key = furnitureTextureKey(entry.type);
    if (!scene.textures.exists(key)) scene.load.image(key, `${PIXEL_AGENTS_ASSET_ROOT}${entry.path}`);
  }
}

function readPixels(scene: Phaser.Scene, key: string, sx = 0, sy = 0, w?: number, h?: number): ImageData {
  const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const width = w ?? source.width;
  const height = h ?? source.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/** pixel-agents colorize.ts의 Colorize 모드: 지각 휘도 → contrast → brightness → 고정 H/S. */
function colorizeLightness(luminance: number, color: ColorValue) {
  let lightness = luminance;
  if (color.c !== 0) lightness = 0.5 + (lightness - 0.5) * ((100 + color.c) / 100);
  if (color.b !== 0) lightness += color.b / 200;
  return Math.max(0, Math.min(1, lightness));
}

function colorizeImage(data: ImageData, color: ColorValue): ImageData {
  const out = new ImageData(data.width, data.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const luminance = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const [r, g, b] = hslToRgb(color.h, color.s / 100, colorizeLightness(luminance, color));
    out.data.set([r, g, b, px[i + 3]], i);
  }
  return out;
}

export function wallBaseColor(color: ColorValue | null | undefined): string {
  if (!color) return '#3A3A5C';
  const [r, g, b] = hslToRgb(color.h, color.s / 100, colorizeLightness(0.5, color));
  return `rgb(${r}, ${g}, ${b})`;
}

const colorKey = (color: ColorValue | null | undefined) => (color ? `${color.h}_${color.s}_${color.b}_${color.c}` : 'raw');

function addImageDataTexture(scene: Phaser.Scene, key: string, data: ImageData) {
  const texture = scene.textures.createCanvas(key, data.width, data.height)!;
  texture.context.putImageData(data, 0, 0);
  texture.refresh();
}

/** 타일 값 N(1~9) → floor_{N-1}.png 를 색상화한 16×16 텍스처. 색이 없으면 무채색(0,0,0,0)으로 colorize합니다. */
export function ensureFloorTexture(scene: Phaser.Scene, tile: number, color: ColorValue | null | undefined): string {
  const effective = color ?? { h: 0, s: 0, b: 0, c: 0 };
  const key = `pixel-agents:floor-tinted:${tile}:${colorKey(effective)}`;
  if (!scene.textures.exists(key)) {
    const baseKey = floorTextureKey(Math.min(tile - 1, FLOOR_PATTERN_COUNT - 1));
    addImageDataTexture(scene, key, colorizeImage(readPixels(scene, baseKey, 0, 0, PIXEL_AGENTS_TILE_SIZE, PIXEL_AGENTS_TILE_SIZE), effective));
  }
  return key;
}

/** 벽 4-bit bitmask(N=1, E=2, S=4, W=8) 조각 텍스처. */
export function ensureWallTexture(scene: Phaser.Scene, mask: number, color: ColorValue | null | undefined): string {
  const key = `pixel-agents:wall-piece:${mask % WALL_BITMASK_COUNT}:${colorKey(color)}`;
  if (!scene.textures.exists(key)) {
    const sx = (mask % WALL_GRID_COLS) * WALL_PIECE_W;
    const sy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_H;
    const raw = readPixels(scene, WALL_SHEET_KEY, sx, sy, WALL_PIECE_W, WALL_PIECE_H);
    addImageDataTexture(scene, key, color ? colorizeImage(raw, color) : raw);
  }
  return key;
}

export const WALL_PIECE_HEIGHT = WALL_PIECE_H;
