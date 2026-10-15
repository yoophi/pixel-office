import { useEffect, useState, useSyncExternalStore } from 'react';
import { AgentOffice } from '@pixel-office/engine/agent-office';
import type { AgentEventInbox } from '../host/agentEvents.js';
import './app.css';

const statusLabels = { idle: '대기', walking: '이동', typing: '작업 중', sitting: '착석', thinking: '생각 중', offline: '오프라인' };

export function App({ inbox }: { inbox: AgentEventInbox }) {
  const agents = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot);
  const [hasConnected, setHasConnected] = useState(false);
  useEffect(() => { if (agents.length) setHasConnected(true); }, [agents.length]);
  return (
    <main className="app-shell" aria-label="에이전트 오피스">
      <AgentOffice />
      <aside className="agent-status-panel" aria-label="에이전트 상태">
        <h1>에이전트 오피스</h1>
        <p aria-live="polite">{agents.length ? `연결된 에이전트 ${agents.length}명` : hasConnected ? '연결된 에이전트가 없습니다.' : '실제 에이전트 연결 대기 · 샘플 캐릭터 미리보기'}</p>
        <ul>{agents.map((agent) => <li key={agent.id}><strong>{agent.name || agent.id}</strong><span>{statusLabels[agent.status]}</span>{agent.message && <small>{agent.message}</small>}</li>)}</ul>
      </aside>
    </main>
  );
}
