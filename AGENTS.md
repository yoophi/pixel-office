# AGENTS.md — pixel-office 에이전트 지침

이 문서는 이 프로젝트에서 작업하는 모든 AI 코딩 에이전트(Claude Code, Codex 등)가 따르는 단일 지침입니다. `CLAUDE.md`는 이 문서를 가리키는 포인터일 뿐이므로, 변경은 항상 이 파일에서 수행합니다.

## 프로젝트 개요

**pixel-office** — React + TypeScript + Vite 기반 브라우저 앱으로, **코딩 에이전트(Claude Code 등)의 상태를 픽셀 캐릭터로 시각화**합니다. 오피스·가구·경로 탐색·좌석·사회적 버블은 모두 에이전트 상태를 표현하는 도구이며, 게임이 아니라 **관찰(observability) 도구**입니다.

### 기술 스택
- React 19, TypeScript, Vite
- Canvas 2D 렌더링 (`src/office/engine/renderer.ts`) — v2에서 Phaser 4로 교체 예정
- 자체 엔진: A* 경로 탐색, z-depth 정렬, HSL colorize 파이프라인, 가구 카탈로그, 좌석 배정, 사회적 대화 버블
- VS Code 사이드 패널 등 호스트 환경에 임베드

### 디렉토리 개요 (현재, v2 재작성 중)
- `src/office/engine/` — 게임 루프, 상태, 렌더러, 캐릭터, matrix 효과
- `src/office/layout/` — 타일 맵, 가구 카탈로그, 레이아웃 직렬화
- `src/office/sprites/` — 스프라이트 데이터와 캐시
- `src/office/editor/` — 자체 에디터 (Tiled 전환 후 제거 예정)
- `src/hooks/` — React 훅(에셋, 키보드, 로컬 액션)
- `public/assets/` — 기본 레이아웃, 벽, 캐릭터, 가구 PNG

v2의 새 디렉토리 구조는 [`memory/architecture.md`](memory/architecture.md) 참고.

## 작업 시작 전 반드시 읽어야 할 문서

중대한 작업을 시작하기 전에 항상 `memory/` 아래 문서를 먼저 확인하고, 사실이 바뀌면 함께 갱신합니다.

- [`memory/project-goal.md`](memory/project-goal.md) — 프로젝트의 불변 목표와 모든 설계 결정에 미치는 함의.
- [`memory/project-constraints.md`](memory/project-constraints.md) — 규모(~100 에이전트), 배포 타깃, 맵 저작 모델, 마이그레이션 방침.
- [`memory/engine-research.md`](memory/engine-research.md) — Phaser / PixiJS / Excalibur 등 2D 엔진 평가와 현재 추천 순위.
- [`memory/architecture.md`](memory/architecture.md) — v2 재작성을 위한 디렉토리/레이어 구조(Host ↔ Bridge ↔ Game + Pure Domain 허브) 제안.
- [`memory/work-guide.md`](memory/work-guide.md) — v2 작업 순서와 우선순위. GitHub 이슈 번호와 일치하는 작업 목록 포함.
- [`memory/v2-gaps.md`](memory/v2-gaps.md) — v2 스택 머지 이후 계획 대비 갭 분석. 후속 GitHub 이슈의 원본.
- [`memory/tiled-schema.md`](memory/tiled-schema.md) — Tiled 맵 레이어·타일셋 규약 (v2 Phaser + Tiled 파이프라인).
- [`memory/stacked-pr-workflow.md`](memory/stacked-pr-workflow.md) — Stacked PR 머지 시 충돌 방지 가이드 (squash merge + chained branches 문제와 대응).
- [`memory/phaser-react-lifecycle-notes.md`](memory/phaser-react-lifecycle-notes.md) — React route/HMR/StrictMode와 Phaser Scene/Tween/Texture 생명주기 충돌 주의사항.

미래의 에이전트가 알아야 할 프로젝트 수준의 사실(아키텍처 결정, 마이그레이션 상태, 외부 제약 등)을 새로 알게 되면 `memory/<topic>.md`를 추가하고 여기에 링크합니다.

## 작업 규칙

- **문서는 한글, 파일명·디렉토리명은 영문**: 모든 문서(`.md`, 주석이 아닌 설명 텍스트, `memory/*.md`, PR·커밋 본문 설명 등)는 **한글로 작성**합니다. 반면 **파일명·디렉토리명·식별자·코드·커밋 메시지 제목**은 **영문**으로 유지합니다. (예: `memory/engine-research.md` ✅ / `memory/엔진-조사.md` ❌)
- **그래프·다이어그램은 Mermaid 사용**: 아키텍처, 데이터 흐름, 의존 관계, 시퀀스, 상태 머신 등 그래프가 필요한 경우 Markdown 코드블록( ```` ```mermaid ```` )에 **Mermaid 문법**으로 작성합니다. ASCII 아트나 이미지 파일은 꼭 필요한 경우(스크린샷 등)에만 사용.
- **대화 언어**: 사용자는 한글로 씁니다. 대화 응답도 한글로, 단 코드·식별자는 영문 유지.
- **간결한 응답**: 짧게 답하고, 마무리 요약이나 변경 사항 되풀이는 생략.
- **최소 범위**: 요청 범위만 수정, 요청하지 않은 리팩토링·추상화·일반화 금지.
- **이모지 지양**: 사용자가 명시적으로 요구하지 않는 한 코드나 대화에 이모지를 사용하지 않습니다.
- **꼭 필요한 주석만**: 식별자가 *무엇*을 하는지 설명하므로, 주석은 *왜*(숨겨진 제약, 우회 로직, 불변식 등)에만 씁니다.
- **파괴적 동작 전 확인**: `git reset --hard`, 강제 푸시, 요청 범위 밖의 파일 삭제 등은 반드시 사용자에게 먼저 확인합니다.

## Git / 브랜치

- 현재 활성 브랜치: `v2` (2026-04-21 생성, 엔진/맵 리팩토링용).
- `main`은 v2 이전의 안정 상태.
- 명시적 요청이 없으면 푸시·PR 생성 금지.

## 테스트 현실

자동화 테스트 스위트는 없습니다. 검증은 시각적 확인입니다 — `npm run dev`로 브라우저에서 실행해 변경 사항을 사용해봅니다. 시각적으로 확인 불가능한 변경이라면 "성공"이라고 주장하지 말고 그 사실을 명시합니다.
