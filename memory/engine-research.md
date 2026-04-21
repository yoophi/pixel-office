# 2D Game Engine Research (2025-2026)

> 조사 시점: 2026-04-21. `project-goal.md`의 "코딩 에이전트 상태 시각화" 목표를 전제로 한 평가입니다.

## 프로젝트 현황 (조사 전제)

- React 19 + TypeScript + Vite, 브라우저 배포
- 16px 타일, 현재 20×11 기본, 최대 64×64
- Canvas 2D 직접 렌더링, 자체 구현: A* pathfinding, z-depth sort, HSL colorize 파이프라인, 가구 catalog, 좌석 배정, 사회적 대화 버블
- React 컴포넌트 안에 캔버스 임베드 (VS Code 사이드 패널 등에 장착)
- 다음 목표: **Tiled (.tmj) 맵 import**, 렌더러/씬 관리를 엔진에 위임

## 후보 비교

| 엔진 | Tiled .tmj | React+Vite | TS | 픽셀 아트 | 기존 로직 공존 | 활성도 (2026) | 번들 | 라이선스 |
|---|---|---|---|---|---|---|---|---|
| **Phaser 4.0** "Caladan" (2026-04 GA) | 1급 (Tilemap, TilemapGPULayer) | 공식 `phaser-editor-template-react-ts` | d.ts 1급 (코어는 JS) | Scale NEAREST, 픽셀 카메라 OK | 렌더+씬 전체 교체; 기존 A*/colorize는 Scene 내 유틸로 이식 가능 | 39.4k stars, 매우 활발 | min 345KB, gzip ~85–100KB (커스텀 빌드 감축) | MIT |
| **PixiJS v8** + `pixi-tiledmap` v2 | 플러그인 1급 (JSON+TMX, 모든 레이어, 무한맵) | `@pixi/react` v8 (React 19), useRef 패턴 | 1급 | roundPixels, NEAREST, 픽셀 퍼펙트 zoom | **렌더러만 교체 가능** — 기존 A*/colorize/catalog 유지 | Pixi 45k+ stars, 매우 활발 | core ~100KB gzip, tilemap 별도 | MIT |
| **Excalibur.js** v0.32 | 공식 `@excaliburjs/plugin-tiled` (TMX/TMJ) | React/Vite 문서 템플릿 존재 | **TS 네이티브** (1순위 언어) | v0.29+ 전용 pixel-art mode, ratio/zoom | 엔진 교체형이지만 Actor/Scene 가볍고 `ex.Graphics.Canvas`로 자체 그리기 우회 가능 | 1.9k stars, 매우 활발 (0.30→0.32 2–3× 성능↑) | ~150–200KB gzip | BSD-2 |
| **melonJS** 14.x | 1급 (.tmj, .tsj, infinite chunks, iso/hex) | 공식 React 통합 없음, 수동 canvas 주입 | d.ts 제공, JS 기반 | 타일 네이티브 엔진 | 엔진 교체형, 개조 범위 큼 | 6k stars, 느리지만 유지 | 코어 ~100KB gzip | MIT |
| **KAPLAY** (구 Kaboom) | 플러그인·커뮤니티 예제 (직접 파싱 많음) | 문제 없음 | TS 1급 | 가능하나 프레임워크 색이 강함 | 엔진 철학(ECS+ASCII 레벨)과 충돌 | 2k+ stars, 활발 | ~70KB gzip | MIT |
| **LittleJS** | **직접 파싱 필요** | 가능 (canvas 단일) | JS + JSDoc 타입 | WebGL 스프라이트/타일 최적화 1만+ 객체 | 엔진이 얇아 조합은 쉬우나 Tiled 파이프라인 직접 구축 | 활발, 단일 메인테이너 | 7KB(JS13k)–~50KB | MIT |
| **RPG Maker MZ** | 자체 맵 에디터 (Tiled 아님) | React 내 임베드 비현실적 | JS 기반, 자유도 낮음 | 쯔꾸루 느낌 그 자체 | **전체 전환 필요**, React/Vite 토대 사실상 버려짐 | 상용, 활발 | 런타임 수 MB | 상용 |
| **Godot 4 web** | 자체 TileMap | React 내 임베드 가능하나 JS bridge | GDScript/C# | 강력 | 기존 TS 로직을 bridge로 호출 → 오버헤드 큼 | 매우 활발 | **40MB+ WASM** (웹 치명적) | MIT |

## 목표(에이전트 상태 시각화)에 비추어 본 평가

- **"에이전트 상태 → 시각 상태" 매핑 파이프라인 보존**이 최우선 제약. 기존 A*·좌석·사회적 버블·colorize 로직은 게임 규칙이 아니라 observability 구현이라서 엔진 의존적으로 재작성하면 의미 손실 위험.
- **React/IDE 임베드 1급**: 엔진을 "앱의 일부"로 다룰 수 있어야 하고, 반대로 앱이 엔진의 부속품이 되면 안 됨.
- **Tiled 1급 지원** + **픽셀 퍼펙트 16px**은 위 네 후보(Phaser, Pixi, Excalibur, melonJS) 공통으로 충족.

## 추천 상위 3 (전면 재작성 전제 재평가)

> 2026-04-21 업데이트. `project-constraints.md`의 조건("에이전트 ~100개, Tiled 디자이너 워크플로우 + tileset 변형 제공, 인게임 에디터 불필요, 전면 재작성 OK, 웹→Tauri/Electron 가능")에 따라 초기 랭킹을 수정했습니다. 기존 로직 보존의 가중치가 사라져 **Phaser 4가 1위**로, PixiJS는 3위로 이동합니다.

**1위. Phaser 4.0 "Caladan"**
전면 재작성이 허용되면 Phaser의 Scene/Camera/Input/Tilemap 일체형 구조가 단점이 아니라 이점이 됩니다. `phaser-editor-template-react-ts`로 React 19 + Vite + TS 보일러플레이트가 즉시 서고, Tiled의 multi-tileset·object layer(스폰 포인트/좌석 영역)가 1급이며, 디자이너가 Tiled에서 만든 맵이 코드 수정 없이 로드됩니다. **tileset 변형 스위칭**은 Tiled의 tileset 교체 기능 + Phaser의 Tilemap API로 자연스럽게 구현 가능. ~100 에이전트는 성능 여유가 남고, Tauri/Electron 마이그레이션 시에도 동일 바이너리가 동작합니다. 쯔꾸루식 결과물(카메라 추적, 레이어, 좌석 영역 판정)을 가장 빠르게 뽑는 선택.

**2위. Excalibur.js v0.32 + `@excaliburjs/plugin-tiled`**
TS 네이티브라 타입 친화성이 최상, pixel-art 모드 내장으로 16px 그리드가 바로 맞음. Actor/Scene이 가볍고 재작성 비용이 Phaser보다 살짝 낮을 수 있음. 단점은 커뮤니티·플러그인 생태계가 Phaser보다 얇고, Tiled object layer·multi-tileset 커스텀 시 직접 해결해야 할 케이스가 더 자주 발생. **"TS 1등, 덜 opinionated"** 를 중시하면 Phaser보다 낫지만, 디자이너 워크플로우 지원 성숙도는 Phaser가 우위.

**3위. PixiJS v8 + `pixi-tiledmap` v2 (+ `@pixi/react`)**
초기 랭킹에서는 "기존 로직 보존"이라는 가치 덕분에 1위였지만, 전면 재작성이 허용된 지금은 **씬/카메라/입력을 직접 작성해야 하는 오버헤드**만 남습니다. 100 에이전트 규모에서 WebGL 배칭 이점도 결정적이지 않습니다. 단, 만약 향후 **고도로 커스텀한 렌더링 파이프라인**(이펙트, 색상 조작, 비정형 레이아웃)이 중요해진다면 Pixi가 유리. 지금 범위에선 over-engineering.

## 부적합 판정

- **KAPLAY**: 프로토타입엔 좋지만 가구 catalog 수준 로직과 철학 충돌.
- **melonJS**: Tiled 친화적이나 React 통합 부재·커뮤니티 축소로 후순위.
- **RPG Maker MZ, Godot 4**: 현재 React/TS/Vite 토대를 사실상 포기해야 하며, 에이전트 상태 시각화 목적에 부합하지 않음.

## 주요 출처

- Phaser v4.0.0 release / phaser-editor-template-react-ts
- Phaser v4 RC7 news (2026-03)
- pixi-tiledmap v2 (PixiJS v8)
- @pixi/tilemap userland repo
- Introducing PixiJS React v8
- Excalibur Tiled plugin docs
- Excalibur v0.30.0 release blog
- Excalibur Pixel Art mode
- melonJS 14.4.0 release
- KAPLAY Roadmap 2026
- LittleJS repo + FAQ
- Godot 4 web export size issue #68647
