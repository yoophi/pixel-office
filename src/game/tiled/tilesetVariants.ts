import type { TilesetVariant } from '../../domain/index.js';

export const DEFAULT_TILESET_VARIANTS = [
  {
    id: 'office-warm',
    name: 'Warm Office',
    imageUrl: '/tilesets/office-warm.png',
  },
  {
    id: 'office-dark',
    name: 'Dark Office',
    imageUrl: '/tilesets/office-dark.png',
  },
] as const satisfies readonly TilesetVariant[];

export function getTilesetImageKey(variantId: string) {
  return `tileset:${variantId}`;
}

export function findTilesetVariant(
  variants: readonly TilesetVariant[],
  variantId: string,
): TilesetVariant | undefined {
  return variants.find((variant) => variant.id === variantId);
}
