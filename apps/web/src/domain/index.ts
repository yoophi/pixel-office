export type { Agent, AgentId, AgentStatus, AgentVisualState, Direction } from './agent.js';
export type { AgentEvent } from './events.js';
export { mapAgentToVisualState, mapStatusToVisualState } from './mapping.js';
export type { GridPoint, Office, Seat, SeatId, TilesetVariant } from './office.js';
export {
  DEFAULT_VIEW_ZOOM,
  VIEW_ZOOM_OPTIONS,
  VIEW_ZOOM_REGISTRY_KEY,
  resolvePixelScale,
  type PixelSize,
  type ViewZoom,
  type ViewZoomScale,
} from './view.js';
