# pixel-office

코딩 에이전트의 상태를 픽셀 오피스 화면으로 시각화하는 pnpm workspace입니다. 현재 웹 앱은 React + TypeScript + Vite + Phaser로 구성됩니다.

## 저장소 구성

| 경로 | 역할 |
|---|---|
| `apps/web` | 웹 앱 `@pixel-office/web`, 에셋, 테스트, Vite·TypeScript 설정 |
| `packages/*` | 향후 공용 패키지 등록 위치. 현재 공용 패키지는 없습니다. |
| `memory`, `docs` | 프로젝트 설계와 조사 문서 |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | workspace 정의와 공통 의존성 잠금 파일 |

## 개발

Node.js 20.19 이상과 pnpm 9.15.5를 사용합니다. 저장소 루트에서 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

포트를 지정하려면 `pnpm dev --port 5199`를 사용합니다.

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm preview
```

특정 앱만 실행하려면 `pnpm --filter @pixel-office/web build`처럼 필터를 사용합니다. 빌드 결과는 `apps/web/dist`에 생성됩니다. 의존성 추가도 `pnpm --filter @pixel-office/web add <package>`로 수행합니다.

## 맵과 에셋

맵은 Tiled에서 작성해 앱에 포함합니다. 런타임 맵 편집·교체는 지원하지 않습니다.

- 맵: `apps/web/public/maps/sample.tmj`
- 생성된 타일셋: `apps/web/public/assets/generated/pixel-office-{warm,dark}.png`
- 에셋 재생성: `pnpm assets:build` (`uv` 필요)
- 웹 URL은 기존 `/assets/...`, `/maps/...`를 유지합니다.

Tiled 규약은 [memory/tiled-schema.md](memory/tiled-schema.md), workspace 운영 규칙은 [memory/pnpm-monorepo.md](memory/pnpm-monorepo.md)를 참고합니다.
