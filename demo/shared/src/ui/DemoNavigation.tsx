
import { demoRoutes, demoUrl } from './demoRoutes.js';

export function DemoNavigation() {
  return (
    <nav className="demo-nav" aria-label="데모 페이지 이동">
      <p>Demo</p>
      <div>
        {demoRoutes.map((route) => (
          <a className={window.location.pathname.startsWith(route.path + '/') ? 'is-active' : undefined} key={route.path} href={demoUrl(route.path)}>
            {route.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
