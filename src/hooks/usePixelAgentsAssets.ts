import { useEffect, useState } from 'react';

import { setWallSprites } from '../office/wallTiles.js';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import type { OfficeState } from '../office/engine/officeState.js';
import type { LoadedAssetData } from '../office/layout/furnitureCatalog.js';
import type { OfficeLayout, SpriteData } from '../office/types.js';
import { normalizeReferenceLayout } from '../referenceLayout.js';

const HEX = '0123456789ABCDEF';

function channelToHex(value: number): string {
  return `${HEX[(value >> 4) & 0xf]}${HEX[value & 0xf]}`;
}

function rgbaToHex(r: number, g: number, b: number): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

async function loadImageData(url: string): Promise<ImageData> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`Failed to create 2D context for ${url}`);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

function sliceSprite(
  image: ImageData,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): SpriteData {
  const sprite: string[][] = [];

  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      const idx = ((offsetY + y) * image.width + (offsetX + x)) * 4;
      const r = image.data[idx];
      const g = image.data[idx + 1];
      const b = image.data[idx + 2];
      const a = image.data[idx + 3];
      row.push(a < 16 ? '' : rgbaToHex(r, g, b));
    }
    sprite.push(row);
  }

  return sprite;
}

async function loadWallSprites(): Promise<SpriteData[]> {
  const image = await loadImageData('/assets/walls.png');
  const sprites: SpriteData[] = [];

  for (let mask = 0; mask < 16; mask++) {
    const offsetX = (mask % 4) * 16;
    const offsetY = Math.floor(mask / 4) * 32;
    sprites.push(sliceSprite(image, offsetX, offsetY, 16, 32));
  }

  return sprites;
}

type LoadedCharacterData = {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
};

async function loadCharacterSprites(): Promise<LoadedCharacterData[]> {
  const characters: LoadedCharacterData[] = [];

  for (let index = 0; index < 6; index++) {
    const image = await loadImageData(`/assets/characters/char_${index}.png`);
    const data: LoadedCharacterData = { down: [], up: [], right: [] };
    const directions = ['down', 'up', 'right'] as const;

    directions.forEach((direction, row) => {
      for (let frame = 0; frame < 7; frame++) {
        data[direction].push(sliceSprite(image, frame * 16, row * 32, 16, 32));
      }
    });

    characters.push(data);
  }

  return characters;
}

async function loadDefaultLayout(): Promise<OfficeLayout> {
  const response = await fetch('/assets/default-layout.json');
  if (!response.ok) {
    throw new Error(`Failed to load default layout: ${response.status}`);
  }
  return (await response.json()) as OfficeLayout;
}

type FurnitureCatalogResponse = {
  assets: Array<{
    id: string;
    label: string;
    category: string;
    file?: string;
    width: number;
    height: number;
    footprintW: number;
    footprintH: number;
    isDesk: boolean;
    groupId?: string;
    orientation?: string;
    state?: string;
    canPlaceOnSurfaces?: boolean;
    backgroundTiles?: number;
    floorTiles?: number;
    canPlaceOnWalls?: boolean;
  }>;
};

const CATEGORY_COLORS: Record<string, string> = {
  desks: '#8B6B3F',
  chairs: '#5C7CFA',
  storage: '#7A5C58',
  decor: '#49A078',
  electronics: '#4C6EF5',
  wall: '#9C6ADE',
  misc: '#E0A458',
};

async function loadFurnitureAssets(): Promise<LoadedAssetData> {
  const response = await fetch('/assets/furniture/furniture-catalog.json');
  if (!response.ok) {
    throw new Error(`Failed to load furniture catalog: ${response.status}`);
  }

  const payload = (await response.json()) as FurnitureCatalogResponse;
  const catalog = payload.assets.map((asset) => ({
    id: asset.id,
    label: asset.label,
    category: asset.category,
    width: asset.width,
    height: asset.height,
    footprintW: asset.footprintW,
    footprintH: asset.footprintH,
    isDesk: asset.isDesk,
    ...(asset.groupId ? { groupId: asset.groupId } : {}),
    ...(asset.orientation ? { orientation: asset.orientation } : {}),
    ...(asset.state ? { state: asset.state } : {}),
    ...(asset.canPlaceOnSurfaces ? { canPlaceOnSurfaces: true } : {}),
    ...(asset.backgroundTiles !== undefined ? { backgroundTiles: asset.backgroundTiles } : {}),
    ...(asset.floorTiles !== undefined ? { floorTiles: asset.floorTiles } : {}),
    ...(asset.canPlaceOnWalls ? { canPlaceOnWalls: true } : {}),
  }));

  // Load actual PNG sprites for each asset that has a file path
  const spriteEntries = await Promise.all(
    payload.assets.map(async (asset) => {
      if (asset.file) {
        try {
          const image = await loadImageData(`/assets/${asset.file}`);
          const sprite = sliceSprite(image, 0, 0, asset.width, asset.height);
          return [asset.id, sprite] as const;
        } catch {
          // Fall back to placeholder if PNG load fails
          return [asset.id, buildPlaceholderSprite(asset.width, asset.height, asset.category)] as const;
        }
      }
      return [asset.id, buildPlaceholderSprite(asset.width, asset.height, asset.category)] as const;
    }),
  );

  const sprites = Object.fromEntries(spriteEntries);

  return { catalog, sprites };
}

function buildPlaceholderSprite(width: number, height: number, category: string): SpriteData {
  const fill = CATEGORY_COLORS[category] ?? '#7A7A7A';
  const stroke = '#1A1A1A';
  const highlight = '#F5E9D0';
  const sprite: string[][] = [];

  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const isHighlight = y === 1 && x > 1 && x < width - 2;
      row.push(isBorder ? stroke : isHighlight ? highlight : fill);
    }
    sprite.push(row);
  }

  return sprite;
}

export function usePixelAgentsAssets(
  getOfficeState: () => OfficeState,
  setSavedLayout: (layout: OfficeLayout) => void,
  onLoaded: () => void,
): { assetsReady: boolean; loadedAssets?: LoadedAssetData } {
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadedAssets, setLoadedAssets] = useState<LoadedAssetData | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [walls, characters, defaultLayout, furnitureAssets] = await Promise.all([
          loadWallSprites(),
          loadCharacterSprites(),
          loadDefaultLayout(),
          loadFurnitureAssets(),
        ]);

        if (cancelled) return;

        setWallSprites(walls);
        setCharacterTemplates(characters);
        setLoadedAssets(furnitureAssets);

        const officeState = getOfficeState();
        const hasStoredLayout = Boolean(window.localStorage.getItem('pixel-agents-migration.layout'));
        if (!hasStoredLayout) {
          const normalizedLayout = normalizeReferenceLayout(
            defaultLayout,
            new Set(furnitureAssets.catalog.map((asset) => asset.id)),
          );
          officeState.rebuildFromLayout(normalizedLayout);
          setSavedLayout(normalizedLayout);
        }

        setAssetsReady(true);
        onLoaded();
      } catch (error) {
        console.error('Failed to load pixel-agents assets', error);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [getOfficeState, onLoaded, setSavedLayout]);

  return { assetsReady, loadedAssets };
}
