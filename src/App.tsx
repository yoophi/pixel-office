import './App.css';
import { useCallback, useEffect } from 'react';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';

import { gameBus } from './bridge/index.js';
import type { Agent } from './domain/index.js';
import { PhaserGame } from './game/PhaserGame.js';
import { DemoAgentCollisionRoute } from './ui/DemoAgentCollisionRoute.js';
import { DemoObstacleRoute } from './ui/DemoObstacleRoute.js';
import { TilesetSwitcher } from './ui/TilesetSwitcher/TilesetSwitcher.js';

function App() {
  return <RouterProvider router={router} />;
}

const router = createHashRouter([
  {
    path: '/',
    element: <OfficeRoute />,
  },
  {
    path: '/demo/obstacle-walking',
    element: <DemoObstacleRoute />,
  },
  {
    path: '/demo/agent-collision',
    element: <DemoAgentCollisionRoute />,
  },
  {
    path: '/demo/*',
    element: <Navigate replace to="/demo/agent-collision" />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
]);

function OfficeRoute() {
  useSampleAgent();

  return (
    <div className="app-shell" aria-label="Pixel Office Phaser bootstrap">
      <PhaserGame />
      <TilesetSwitcher />
    </div>
  );
}

function useSampleAgent() {
  const emitSampleAgent = useCallback(() => {
    const now = Date.now();
    const agent: Agent = {
      id: 'sample-agent',
      name: 'Sample Agent',
      status: 'idle',
      direction: 'south',
      position: { x: 3, y: 3 },
      updatedAt: now,
    };

    gameBus.emit('agent:event', { type: 'agent:upsert', agent });
    gameBus.emit('agent:event', {
      type: 'agent:say',
      agentId: agent.id,
      message: 'building',
      durationMs: 1800,
      updatedAt: now + 1,
    });
  }, []);

  useEffect(() => {
    let fallbackId = 0;
    const start = () => {
      window.clearTimeout(fallbackId);
      emitSampleAgent();
    };
    const unsubscribe = gameBus.on('game:ready', start);
    fallbackId = window.setTimeout(start, 900);

    return () => {
      unsubscribe();
      window.clearTimeout(fallbackId);
      gameBus.emit('agent:event', { type: 'agent:remove', agentId: 'sample-agent' });
    };
  }, [emitSampleAgent]);
}

export default App;
