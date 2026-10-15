import type { AgentId } from './agent.js';
import type { GridPoint } from './office.js';

export function isOccupiedByOtherAgent(
  agentTiles: ReadonlyMap<AgentId, GridPoint>,
  reservedTiles: ReadonlyMap<AgentId, GridPoint>,
  movingAgentId: AgentId | undefined,
  point: GridPoint,
): boolean {
  for (const tiles of [agentTiles, reservedTiles]) {
    for (const [agentId, occupied] of tiles) {
      if (agentId !== movingAgentId && occupied.x === point.x && occupied.y === point.y) return true;
    }
  }
  return false;
}
