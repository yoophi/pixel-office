import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_VIEW_ZOOM, VIEW_ZOOM_OPTIONS, type ViewZoom } from '../domain/index.js';

interface ViewSettingsState {
  zoom: ViewZoom;
  setZoom(zoom: ViewZoom): void;
}

const STORAGE_KEY = 'pixel-office:view-settings';
const STORAGE_VERSION = 1;

export const useViewSettingsStore = create<ViewSettingsState>()(
  persist(
    (set) => ({
      zoom: DEFAULT_VIEW_ZOOM,
      setZoom: (zoom) =>
        set((state) => (state.zoom === zoom ? state : { zoom })),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      partialize: (state) => ({ zoom: state.zoom }),
      merge: (persistedState, currentState) => {
        const incoming = (persistedState ?? {}) as Partial<ViewSettingsState>;
        const zoom = isValidZoom(incoming.zoom) ? incoming.zoom : currentState.zoom;
        return { ...currentState, zoom };
      },
    },
  ),
);

function isValidZoom(value: unknown): value is ViewZoom {
  return VIEW_ZOOM_OPTIONS.includes(value as ViewZoom);
}
