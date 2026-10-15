import type { TilesetVariant } from '@pixel-office/core';

export const DEFAULT_TILESET_VARIANTS = [
  {
    id: 'office-warm',
    name: 'Warm Office',
    imageUrl: `${import.meta.env.BASE_URL}assets/generated/pixel-office-warm.png`,
  },
  {
    id: 'office-dark',
    name: 'Dark Office',
    imageUrl: `${import.meta.env.BASE_URL}assets/generated/pixel-office-dark.png`,
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
