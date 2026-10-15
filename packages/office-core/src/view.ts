export type ViewZoomScale = 1 | 2 | 3 | 4;
export type ViewZoom = ViewZoomScale | 'fit';

export const VIEW_ZOOM_OPTIONS: ViewZoom[] = [1, 2, 3, 4, 'fit'];
export const DEFAULT_VIEW_ZOOM: ViewZoom = 'fit';

export const VIEW_ZOOM_REGISTRY_KEY = 'view:zoom';

export interface PixelSize {
  width: number;
  height: number;
}

export function resolvePixelScale(zoom: ViewZoom, viewport: PixelSize, world: PixelSize): number {
  if (zoom !== 'fit') return zoom;
  const ratio = Math.min(viewport.width / world.width, viewport.height / world.height);
  return Math.max(1, Math.floor(ratio || 1));
}
