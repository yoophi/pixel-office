# Pixel Office

에이전트 상태를 픽셀 오피스로 보여주는 pnpm 모노레포입니다.

- 서비스: `apps/web` — `pnpm dev` (5199)
- 독립 데모 9개: `demo/*` — `pnpm dev:demos` (5200–5208)
- 공유 로직·렌더링·에셋: `packages/office-core`, `packages/office-engine`, `packages/office-assets`

Node.js 20.19 이상과 pnpm 9.15.5를 사용합니다.

설치: `pnpm install --frozen-lockfile`

검증: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

[구성·패키지 사용법·데모별 URL·이벤트 계약](memory/pnpm-monorepo.md)

서비스는 외부 이벤트가 도착하기 전 빈 오피스와 연결 대기 상태를 표시합니다. 실제 에이전트 프로세스의 상태 수집은 호스트 어댑터에서 연결합니다.

맵·폰트·가구 원본은 `packages/office-assets/public`에 있습니다. `pnpm assets:build`로 타일셋을 재생성하며 Tiled 규약은 [memory/tiled-schema.md](memory/tiled-schema.md)를 참고합니다.
