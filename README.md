# pixel-office

코딩 에이전트의 상태를 픽셀 오피스 화면으로 시각화하는 React + TypeScript + Vite 앱입니다.

v2는 Phaser 4 + Tiled 기반으로 재작성 중입니다. 앱의 목표는 게임 플레이가 아니라 에이전트 상태 관찰입니다.

## 개발

```bash
npm install
npm run dev
```

프로덕션 빌드 확인:

```bash
npm run build
```

## 맵 작성 워크플로우

맵은 Tiled에서 작성한 `.tmj` 파일을 제품에 함께 번들링합니다. 런타임에서 사용자가 맵을 편집하거나 교체하는 흐름은 현재 범위에 없습니다.

현재 기본 샘플 맵:

- `public/maps/sample.tmj`
- `public/tilesets/office-warm.png`
- `public/tilesets/office-dark.png`

Tiled 규약은 `memory/tiled-schema.md`를 기준으로 합니다.

## 타일셋 변형

타일셋 변형은 같은 타일 순서와 같은 크기를 유지해야 합니다. 현재 UI는 `office-warm`, `office-dark` 두 변형을 선택할 수 있고, 선택 이벤트는 `bridge/gameBus.ts`의 `ui:tileset-selected`를 통해 Phaser Scene에 전달됩니다.

## 레거시 레이아웃

기존 `public/assets/default-layout.json`은 v2 Tiled 워크플로우로 대체되어 제거했습니다. 새 기본 맵은 `public/maps/sample.tmj`입니다.
