import type { Agent, AgentStatus, AgentVisualState } from './agent.js';

export function mapStatusToVisualState(status: AgentStatus): Pick<AgentVisualState, 'animation' | 'visible'> {
  switch (status) {
    case 'walking':
      return { animation: 'walk', visible: true };
    case 'typing':
      return { animation: 'type', visible: true };
    case 'sitting':
      return { animation: 'sit', visible: true };
    case 'offline':
      return { animation: 'idle', visible: false };
    case 'thinking':
    case 'idle':
      return { animation: 'idle', visible: true };
  }
}

export function mapAgentToVisualState(agent: Agent): AgentVisualState {
  return {
    ...mapStatusToVisualState(agent.status),
    direction: agent.direction ?? 'south',
    speechText: agent.message,
  };
}
