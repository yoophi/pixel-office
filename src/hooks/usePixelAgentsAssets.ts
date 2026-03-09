import { useEffect, useState } from 'react';

import { setWallSprites } from '../office/wallTiles.js';
import { setCharacterTemplates } from '../office/sprites/spriteData.js';
import type { OfficeState } from '../office/engine/officeState.js';
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
  return normalizeReferenceLayout((await response.json()) as OfficeLayout);
}

export function usePixelAgentsAssets(
  getOfficeState: () => OfficeState,
  setSavedLayout: (layout: OfficeLayout) => void,
  onLoaded: () => void,
): { assetsReady: boolean } {
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [walls, characters, defaultLayout] = await Promise.all([
          loadWallSprites(),
          loadCharacterSprites(),
          loadDefaultLayout(),
        ]);

        if (cancelled) return;

        setWallSprites(walls);
        setCharacterTemplates(characters);

        const officeState = getOfficeState();
        const hasStoredLayout = Boolean(window.localStorage.getItem('pixel-agents-migration.layout'));
        if (!hasStoredLayout) {
          officeState.rebuildFromLayout(defaultLayout);
          setSavedLayout(defaultLayout);
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

  return { assetsReady };
}
