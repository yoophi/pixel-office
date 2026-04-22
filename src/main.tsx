import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function ensureGameFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('11px "Galmuri11"'),
    document.fonts.load('700 11px "Galmuri11"'),
    document.fonts.load('9px "Galmuri9"'),
  ]);
}

ensureGameFontsLoaded().finally(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
