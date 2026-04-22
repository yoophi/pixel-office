import './App.css';
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom';

import { DemoAgentCrowdCollisionRoute } from './ui/DemoAgentCrowdCollisionRoute.js';
import { DemoAgentCollisionRoute } from './ui/DemoAgentCollisionRoute.js';
import { DemoDepthSortingRoute } from './ui/DemoDepthSortingRoute.js';
import { DemoObstacleRoute } from './ui/DemoObstacleRoute.js';
import { DemoRandomOfficeChatterRoute } from './ui/DemoRandomOfficeChatterRoute.js';
import { DemoSpeechBubbleFontRoute } from './ui/DemoSpeechBubbleFontRoute.js';
import { DemoSpeechBubbleRoute } from './ui/DemoSpeechBubbleRoute.js';
import { demoRoutes } from './ui/demoRoutes.js';

function App() {
  return <RouterProvider router={router} />;
}

const router = createHashRouter([
  {
    path: '/',
    element: <DemoRandomOfficeChatterRoute />,
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
    path: '/demo/agent-crowd-collision',
    element: <DemoAgentCrowdCollisionRoute />,
  },
  {
    path: '/demo/depth-sorting',
    element: <DemoDepthSortingRoute />,
  },
  {
    path: '/demo/speech-bubble',
    element: <DemoSpeechBubbleRoute />,
  },
  {
    path: '/demo/speech-bubble-font',
    element: <DemoSpeechBubbleFontRoute />,
  },
  {
    path: '/demo/random-office-chatter',
    element: <DemoRandomOfficeChatterRoute />,
  },
  {
    path: '/demo/*',
    element: <Navigate replace to={demoRoutes[0].path} />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
]);

export default App;
