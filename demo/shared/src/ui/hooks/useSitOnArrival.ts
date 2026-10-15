import { useEffect } from 'react';

import { gameBus } from '@pixel-office/engine/events';
import type { AgentId } from '@pixel-office/core';

export function useSitOnArrival(agentId: AgentId) {
  useEffect(() => {
    return gameBus.on('agent:move-complete', (event) => {
      if (event.agentId !== agentId) return;
      gameBus.emit('agent:event', {
        type: 'agent:status',
        agentId,
        status: 'sitting',
        updatedAt: Date.now(),
      });
    });
  }, [agentId]);
}
