import { createRoot } from 'react-dom/client';
import '@pixel-office/engine/fonts.css';
import '@pixel-office/engine/styles.css';
import { connectAgentHost } from '../host/browser.js';
import { App } from './App.js';

const host = connectAgentHost();
const root = createRoot(document.getElementById('root')!);
let disposed = false;
Promise.allSettled([document.fonts.load('11px "FS Pixel Sans"'), document.fonts.load('12px "Galmuri11"')]).then(() => {
  if (!disposed) root.render(<App inbox={host.inbox} />);
});
if (import.meta.hot) import.meta.hot.dispose(() => {
  disposed = true;
  root.unmount();
  host.dispose();
});
