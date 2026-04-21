# v2 구현 계획 대비 갭 분석

> 2026-04-22 작성. v2 스택 15개 PR이 main에 모두 반영된 시점의 점검 결과입니다. `memory/architecture.md`와 `memory/project-goal.md`를 기준으로 미흡한 부분을 정리하고, 각 항목은 GitHub 이슈로 관리합니다.

## 요약

- 15개 작업 항목 모두 산출물 파일은 존재합니다(`memory/work-guide.md` 진행 상황 표 참고).
- 그러나 **아키텍처 레이어 완성도**와 **실제 에이전트 상태 소스 연결** 측면에서 아직 완성 상태가 아닙니다.
- 아래 항목은 프로젝트 목표("코딩 에이전트 상태 시각화")를 **실제 환경에서** 달성하기 위해 필요합니다.

## 미완 항목

### A. [P1] host/ 레이어 비어 있음

- **현상**: `src/host/index.ts`가 `export {}`만 있음. VS Code / 브라우저 / Tauri 어댑터 모두 없음.
- **영향**: 실제 Claude Code 등에서 발생한 에이전트 이벤트가 들어올 통로가 없음. 현재는 `game/scenes/OfficeScene.ts`의 `emitSampleAgentEvents()` 하드코딩 호출로만 캐릭터가 등장.
- **해법**: `host/vscode/webviewBridge.ts`, `host/browser/`(또는 `host/mock/`) 어댑터 추가. 기존 `src/vscodeApi.ts`를 `host/vscode/`로 이관. 각 어댑터가 `AgentEvent`를 `bridge/gameBus.ts`로 `emit`하도록 구현.
- **우선순위**: **P1** — 목표 달성의 핵심. 이 항목 없이는 앱이 관찰 도구가 아니라 데모로만 동작.

### B. [P2] UI → game import 아키텍처 규칙 위반

- **현상**: `src/ui/TilesetSwitcher/TilesetSwitcher.tsx:4`에서 `../../game/index.js`를 직접 import하여 `DEFAULT_TILESET_VARIANTS`를 가져옴.
- **영향**: `memory/architecture.md`의 의존 규칙 위반 (`ui`는 `domain`, `bridge`만 구독해야 함).
- **해법**: `DEFAULT_TILESET_VARIANTS`를 `domain/office.ts`(또는 `shared/`)로 옮기고, `game/tiled/tilesetVariants.ts`는 이를 import만 하도록 수정.
- **우선순위**: **P2** — 지금은 동작하지만 레이어 경계가 무너지면 엔진 교체 시 재작업 비용이 커짐.

### C. [P2] app/ 레이어 실내용화

- **현상**: `src/app/index.ts`가 비어 있고, 실제 React 엔트리 `src/main.tsx`와 `src/App.tsx`는 `src/` 최상위에 위치.
- **영향**: `architecture.md`에서 정의한 레이어 경계와 실제 파일 배치가 어긋남. 새로 합류하는 에이전트/개발자가 혼란.
- **해법**: `src/main.tsx`와 `src/App.tsx`를 `src/app/`로 이동, Vite/TS 경로 조정, `src/app/index.ts`에 export 정리.
- **우선순위**: **P2**.

### D. [P2] shared/ 레이어 실내용화 또는 재정의

- **현상**: `src/shared/index.ts`가 비어 있음. 공용 타입/유틸 사용처가 아직 없음.
- **해법**: 두 가지 선택지 중 하나.
  1. 실제 공용 타입/유틸을 분리해 채움(예: id 생성기, 좌표 유틸, 환경 플래그).
  2. 현재 규모에서 불필요하다고 판단되면 `architecture.md`에서 `shared/` 레이어를 제거하거나 선택적 레이어로 명시.
- **우선순위**: **P2**.

### E. [P3] 샘플 에이전트 이벤트 하드코딩을 mock host로 분리

- **현상**: `src/game/scenes/OfficeScene.ts`의 `emitSampleAgentEvents()` 가 씬 내부에 정의되어 `create()`에서 직접 호출됨.
- **영향**: `game/`이 비즈니스 이벤트를 생성하는 역할을 겸해 레이어 경계가 흐려짐.
- **해법**: 해당 함수를 `host/mock/sampleAgents.ts`로 이동. 개발 환경에서만 마운트하도록 엔트리(app/)에서 연결.
- **우선순위**: **P3** — 구조 개선. A 작업과 함께 진행하면 자연스러움.

### F. [P3] 번들 크기 최적화

- **현상**: `npm run build` 결과 `dist/assets/index-*.js` 약 **1.57MB(gzip 429KB)**. 500KB 경고 초과.
- **원인**: Phaser가 대부분.
- **해법**: Vite `build.rollupOptions.output.manualChunks`로 Phaser를 별도 청크로 분리, 또는 필요한 경우 Phaser 부분을 `React.lazy`/dynamic import로 코드 스플릿.
- **우선순위**: **P3** — 현 단계에서 치명적이지 않지만 Tauri/Electron 이관 전 한 번 정리 권장.

### G. [P3] 잔존 레거시 파일 정리

- **현상**:
  - `src/vscodeApi.ts` — 아무 곳에서도 import되지 않음 (host/로 이관 대상)
  - `src/assets/react.svg` — Vite 기본 템플릿 잔존
  - `src/index.css` — 기본 Vite 스타일 일부 잔존 가능
- **해법**: 단일 cleanup PR로 미사용 파일 제거, 또는 host/ 어댑터 구현 시 자연 정리.
- **우선순위**: **P3**.

## 권장 진행 순서

1. **A (host 레이어)** 먼저. 이것이 프로젝트 목표의 핵심 누락분.
2. **E, G**는 A 작업 중 자연스럽게 정리 가능.
3. **C (app 이동)** — A와 함께 리팩토링.
4. **B (UI → game 위반)** 단독 작은 PR로 처리.
5. **D (shared 재정의)** — 프로젝트 관성이 조금 쌓인 후 결정.
6. **F (번들 최적화)** — Tauri/Electron 이관 계획이 구체화될 때.
