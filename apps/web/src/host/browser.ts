import { gameBus } from '@pixel-office/engine/events';
import { AgentEventInbox } from './agentEvents.js';

export function connectAgentHost(target: Window = window) {
  const inbox = new AgentEventInbox((event) => gameBus.emit('agent:event', event));
  const receive = (event: MessageEvent) => {
    if (event.origin !== target.location.origin || (event.source !== target && event.source !== target.parent)) return;
    if (event.data?.channel === 'pixel-office') inbox.accept(event.data.event);
  };
  target.addEventListener('message', receive);
  const stopReady = gameBus.on('game:ready', () => {
    inbox.markReady();
    target.parent.postMessage({ channel: 'pixel-office', type: 'ready' }, target.location.origin);
  });
  return {
    inbox,
    dispose() {
      target.removeEventListener('message', receive);
      stopReady();
      inbox.dispose();
    },
  };
}
