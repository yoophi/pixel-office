# Demo Routes and Canvas Controls

> 2026-04-22 작성. 이번 세션에서 추가된 데모 라우트 구조와 공통 캔버스 제어 규칙을 정리합니다.

## Demo route 구조

- 데모 화면은 `HashRouter` 기반의 `/demo/*` 라우트로 제공합니다.
- 라우트 목록과 네비게이션 메타데이터는 `src/ui/demoRoutes.ts`에서 관리합니다.
- 현재 데모 라우트는 다음 흐름을 검증합니다.
  - `/demo/obstacle-walking`: 장애물 회피와 의자/책상 목표 배치.
  - `/demo/agent-collision`: 캐릭터 간 충돌 회피.
  - `/demo/agent-crowd-collision`: 주변 캐릭터가 무작위로 움직일 때 경로 재계산.
  - `/demo/depth-sorting`: 캐릭터-가구, 캐릭터-캐릭터 depth 정렬.
- 각 데모 화면은 공통적으로 `PhaserGame`, `TilesetSwitcher`, `DemoNavigation`을 사용합니다.
- 데모 화면이 언마운트될 때는 데모 에이전트 제거와 `demo:obstacles-set` 초기화를 함께 수행해야 합니다. 그렇지 않으면 다른 데모나 기본 오피스 화면에 임시 장애물이 남을 수 있습니다.

## Demo navigation

- `src/ui/DemoNavigation.tsx`는 오른쪽 아래 floating menu입니다.
- 새 데모를 추가할 때는 `demoRoutes.ts`에 먼저 등록하고, 개별 화면에는 `DemoNavigation`을 렌더링합니다.
- 네비게이션은 route 전환만 담당합니다. 데모별 상태 초기화는 각 route 컴포넌트의 effect cleanup에서 처리합니다.

## Canvas toolbar

- 캔버스 크기/비율 툴바는 모든 Phaser 화면에 공통 적용되도록 `src/game/PhaserGame.tsx` 안에 있습니다.
- 크기 preset은 viewport 비율이 아니라 고정 pixel 기준입니다.
  - `Small`: 640px
  - `Medium`: 960px
  - `Large`: 1280px
- 비율 preset은 `16:9`, `4:3`, `1:1`, `Map(20:11)`입니다.
- `.phaser-host`는 CSS 변수 `--canvas-width`, `--canvas-height`를 사용합니다.
- 브라우저 viewport보다 선택한 캔버스가 클 때만 CSS `min(...)`으로 축소됩니다. 사용자가 선택한 preset 자체는 viewport 상대값으로 바꾸지 않습니다.
- `ResizeObserver`가 `.phaser-host`의 실제 크기를 감시하고 `game.scale.resize(width, height)`를 호출합니다.

## 주의사항

- 캔버스 크기 변경은 Phaser game config 재생성이 아니라 scale resize로 처리합니다.
- 툴바가 라우트별 UI와 겹치지 않도록 floating panel 위치를 확인해야 합니다.
- 새 데모를 추가할 때는 route 링크, cleanup, 공통 navigation, 공통 canvas toolbar 동작을 함께 확인합니다.
