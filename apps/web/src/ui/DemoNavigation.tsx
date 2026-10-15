import { NavLink } from 'react-router-dom';

import { demoRoutes } from './demoRoutes.js';

export function DemoNavigation() {
  return (
    <nav className="demo-nav" aria-label="데모 페이지 이동">
      <p>Demo</p>
      <div>
        {demoRoutes.map((route) => (
          <NavLink className={({ isActive }) => (isActive ? 'is-active' : undefined)} key={route.path} to={route.path}>
            {route.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
