import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { DemoNavigation } from './DemoNavigation.js';

const sampleMessage = 'Pretendard 말풍선\n한글 English 1234';

export function DemoSpeechBubbleFontRoute() {
  const largerFontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highResolutionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    drawCanvasBubble(largerFontCanvasRef.current, {
      label: '1',
      fontSize: 16,
      resolution: 1,
    });
    drawCanvasBubble(highResolutionCanvasRef.current, {
      label: '2',
      fontSize: 11,
      resolution: 3,
    });
  }, []);

  return (
    <div className="app-shell demo-shell demo-compare-shell" aria-label="말풍선 폰트 렌더링 비교">
      <section className="demo-compare" aria-label="말풍선 폰트 개선안 비교">
        <div className="demo-panel__header">
          <button className="demo-panel__back" onClick={() => navigate('/', { replace: false })} type="button">
            &lt;- Office
          </button>
          <p className="demo-panel__eyebrow">Speech Bubble Font</p>
          <h1>말풍선 폰트 비교</h1>
        </div>

        <div className="speech-font-grid">
          <article className="speech-font-card">
            <p className="speech-font-card__label">1. 큰 폰트</p>
            <div className="speech-font-card__stage">
              <canvas aria-label="큰 폰트 캔버스 말풍선" height="168" ref={largerFontCanvasRef} width="300" />
            </div>
          </article>

          <article className="speech-font-card">
            <p className="speech-font-card__label">2. 고해상도 텍스처</p>
            <div className="speech-font-card__stage">
              <canvas aria-label="고해상도 캔버스 말풍선" ref={highResolutionCanvasRef} />
            </div>
          </article>

          <article className="speech-font-card">
            <p className="speech-font-card__label">3. DOM 오버레이</p>
            <div className="speech-font-card__stage speech-font-card__stage--dom">
              <div className="speech-font-dom-bubble">
                {sampleMessage.split('\n').map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>
      <DemoNavigation />
    </div>
  );
}

interface DrawCanvasBubbleOptions {
  label: string;
  fontSize: number;
  resolution: number;
}

function drawCanvasBubble(canvas: HTMLCanvasElement | null, options: DrawCanvasBubbleOptions) {
  if (!canvas) return;

  const cssWidth = 300;
  const cssHeight = 168;
  const scale = options.resolution;
  canvas.width = cssWidth * scale;
  canvas.height = cssHeight * scale;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext('2d');
  if (!context) return;

  context.scale(scale, scale);
  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#121a20';
  context.fillRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = '#29363d';
  context.fillRect(132, 116, 36, 36);
  context.fillStyle = '#74a7ff';
  context.fillRect(140, 102, 20, 28);
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#111827';
  context.lineWidth = 1;
  roundRect(context, 46, 34, 208, 58, 6);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(143, 92);
  context.lineTo(157, 92);
  context.lineTo(150, 103);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = '#111827';
  context.font = `${options.fontSize}px Pretendard, "Noto Sans KR", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(sampleMessage.split('\n')[0], 150, 56);
  context.fillText(sampleMessage.split('\n')[1], 150, 74);
  context.fillStyle = '#f6d77b';
  context.font = '700 12px Pretendard, "Noto Sans KR", sans-serif';
  context.textAlign = 'left';
  context.fillText(`case ${options.label}`, 12, 18);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
