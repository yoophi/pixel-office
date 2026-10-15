# pnpm 모노레포 구성

2026-10-15에 단일 앱 저장소를 pnpm workspace 구조로 옮겼다.

- 루트는 실행 명령과 공통 잠금 파일을 관리하는 private 패키지다. 앱 의존성은 `apps/web/package.json`에 선언한다.
- 앱 이름은 `@pixel-office/web`이다. `src`, `public`, `tests`, `scripts`와 Vite·TypeScript·ESLint 설정을 `apps/web`에 함께 옮겨 상대 경로를 유지했다.
- `apps/*`, `packages/*`가 workspace 대상이다. 현재 실행 앱은 하나이며 공용 패키지는 아직 없다. 독립적인 소비자가 생길 때 필요한 모듈을 추출한다.
- pnpm 9.15.5를 `packageManager`로 고정했다. 기존 lockfile의 패키지 버전과 무결성 정보를 유지하고 importer만 루트에서 `apps/web`으로 옮겼다.
- 루트 `pnpm dev`, `pnpm preview`는 웹 앱을 실행한다. `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm typecheck`는 workspace 패키지의 해당 명령을 실행한다.
- 설치는 루트에서 `pnpm install --frozen-lockfile`, 앱 의존성 추가는 `pnpm --filter @pixel-office/web add <package>`로 수행한다. 다른 workspace 패키지를 참조할 때는 `workspace:*`를 사용한다.
- 배포 산출물은 `apps/web/dist`다. 브라우저의 `/assets`, `/maps`, 해시 라우트 URL은 바뀌지 않는다.
- `pnpm assets:build`는 앱 내 Python 스크립트를 실행한다. `uv`가 필요하다.
- 이 전환 이전 문서의 `src/`, `public/`, `tests/`, `scripts/` 경로는 당시 앱 루트 기준이다. 현재 저장소에서는 앞에 `apps/web/`을 붙인다. 과거 조사·작업 기록의 모든 경로를 일괄 변경하지 않는다.

공식 근거: [pnpm workspace 문서](https://pnpm.io/workspaces). 루트 `pnpm-workspace.yaml`에 패키지 범위를 선언한다.
