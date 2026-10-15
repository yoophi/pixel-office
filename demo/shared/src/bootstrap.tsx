import { type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@pixel-office/engine/fonts.css';
import '@pixel-office/engine/styles.css';
import './demo.css';

export async function mountDemo(Demo: ComponentType) {
  await Promise.allSettled([document.fonts.load('11px "FS Pixel Sans"'), document.fonts.load('13px "FS Pixel Sans Matched"'), document.fonts.load('12px "Galmuri11"'), document.fonts.load('700 12px "Galmuri11"'), document.fonts.load('9px "Galmuri9"')]);
  createRoot(document.getElementById('root')!).render(<HashRouter><Demo /></HashRouter>);
}
