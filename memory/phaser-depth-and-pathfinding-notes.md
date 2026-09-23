# Phaser Depth and Pathfinding Notes

> 2026-04-22 작성. 이번 세션에서 확인한 Phaser depth, 동적 장애물, 경로 재계산, 좌석 상태 규칙을 정리합니다.

## Depth 정렬

- 캐릭터 sprite는 발 위치가 기준점이 되도록 bottom origin을 사용합니다.
- 캐릭터 depth는 tile layer base에 `sprite.y / 10000`을 더해 아래쪽 캐릭터가 위에 그려지도록 합니다.
- 데모용 가구와 장애물도 캐릭터와 같은 layer base를 사용해야 합니다. 가구 base를 낮게 잡으면 y-depth가 있어도 캐릭터가 항상 가구 위에 그려집니다.
- 공통 데모 책상은 `SMALL_TABLE/SMALL_TABLE_SIDE.png`(16×48)를 사용합니다. 위쪽 1행은 배경 영역이므로 바닥 footprint는 아래쪽 2개 타일입니다. 의자는 `CUSHIONED_CHAIR_SIDE.png`(16×16)입니다.
- 세로 책상은 anchor tile 하나만 막으면 부족합니다. anchor `{x, y}`와 위쪽 `{x, y - 1}`을 모두 footprint로 보고 blocking/depth/minimap 검증에 반영해야 합니다.
- 캐릭터가 책상 위로 걷는 것처럼 보이면 먼저 z-index가 아니라 가구 footprint와 blocked tile 계산을 확인합니다.

## 동적 pathfinding

- 캐릭터 점유 판정은 순수 함수 `src/domain/agentOccupancy.ts`의 `isOccupiedByOtherAgent`를 공유합니다. `OfficeScene`, 랜덤 오피스 전용 씬, 픽셀 오피스 전용 씬 모두 현재 타일과 다음 타일을 같은 규칙으로 검사합니다.
- `createPathfindingSystemFromTilemap`은 정적 tilemap blocker와 동적 blocker callback을 함께 받습니다.
- 정적 blocker는 Tiled layer의 `walls`, `furniture` 등입니다.
- 데모 blocker는 `demo:obstacles-set`으로 전달한 장애물과 책상 footprint입니다.
- 캐릭터 blocker는 현재 타일 `agentTiles`와 다음 타일 `reservedTiles`를 함께 기준으로 판단합니다. 이동 시작 전에 다음 타일을 예약하고, 도착할 때까지 출발 타일도 유지합니다.
- 목적지에도 충돌 검사 예외를 두지 않습니다. 다른 캐릭터가 현재 점유하거나 예약한 목적지에는 진입하지 않고 비워질 때까지 기다립니다.
- `moveAgentWithReplanning`은 한 타일씩 이동하며 매 step 전에 현재 blocker를 다시 확인합니다.
- 다음 step이 막혔으면 잠시 대기한 뒤 현재 위치에서 경로를 다시 계산합니다.
- step 이동이 끝날 때마다 `agentTiles`를 현재 tile로 갱신해야 다른 캐릭터가 낡은 위치를 장애물로 보지 않습니다.
- 좌석 이동도 같은 한 타일 단위 재탐색·예약 경로를 사용합니다. 경로가 없을 때 좌석 도착으로 처리하지 않습니다.
- 이동 도중 새 목적지를 받으면 진행 중인 한 걸음을 마친 뒤 새 경로를 탐색합니다. 중간 위치에서 tween을 끊고 새 경로를 시작하면 대각선 이동과 충돌이 생길 수 있습니다.
- 기존 에이전트의 위치 없는 upsert는 점유 좌표를 변경하지 않습니다. 위치를 포함한 upsert도 sprite와 점유 좌표가 어긋나지 않도록 충돌 회피 이동으로 처리합니다.
- 제거 시 점유·예약 타일을 해제하고, 늦게 도착한 이전 캐릭터의 이동 완료 콜백은 무시합니다.
- 서로의 위치를 목적지로 지정해 둘 다 막힌 경우 통과시키지 않고 대기합니다. 자동 양보·교착 해소 정책은 아직 없습니다.

### 회귀 검증 (2026-09-23)

- `node --test tests/agent-collision.test.mjs`: 실제 controller와 경로 탐색 코드를 로드하고 Phaser tween·타이머 경계를 대체하여 충돌·예약·재지정·제거·도착 이벤트를 검사합니다. 별도 씬의 생성·점유 판정까지 포함해 총 13개 시나리오입니다.
- `/demo/agent-collision`에 `목적지 점유 대기`, `동시 진입 차단` 고정 시나리오를 추가했습니다. 전자는 4.5초 뒤 점유자가 이동하고, 후자는 두 캐릭터가 같은 의자로 이동을 요청합니다.
- Chrome에서 점유 중 대기, 자리 비운 뒤 도착, 동일 목적지에서 한 명만 진입하는 모습을 확인했습니다.

### 데모별 적용

- 장애물 회피, 캐릭터 회피, 움직이는 군중, Depth 정렬, 말풍선은 공통 `OfficeScene`을 사용합니다.
- 랜덤 오피스는 생성 위치도 현재·예약 타일을 제외하며, 씬 종료 시 캐릭터와 점유 정보를 정리합니다.
- 픽셀 오피스는 이동 캐릭터와 고정 좌석 캐릭터를 모두 점유 정보에 등록합니다.
- 군중 데모의 React 위치 상태는 예상 이동 시간이나 이동 요청 시점이 아니라 `agent:move-complete`를 기준으로 갱신합니다. 도착 전에는 새 이동 명령을 보내지 않고, 다른 캐릭터의 예정 목적지도 새 목표 후보에서 제외합니다.
- 폰트 비교는 이동 캐릭터가 없는 정적 렌더링 데모이므로 적용할 이동 경로가 없습니다.

## 이동 완료 이벤트와 상태

- 실제 목적지에 도착했을 때 `agent:move-complete` 이벤트를 발행합니다.
- 앉기, 타이핑, 도착 후 휴식 같은 UI 상태는 예상 이동 시간 타이머가 아니라 `agent:move-complete`를 기준으로 바꿉니다.
- 일반 이동 완료 상태는 `idle`입니다.
- 캐릭터는 의자가 아닌 곳에서 `sitting` 또는 `typing` 상태가 되면 안 됩니다.
- 데모 에이전트 id는 `demo-` prefix를 사용하고, `shouldAutoAssignSeat`에서 자동 좌석 배정 대상에서 제외합니다.
- 무작위로 배치되거나 걷는 crowd 캐릭터는 기본적으로 서 있는 `idle` 상태를 유지합니다.

## 캐릭터 variation

- 캐릭터 texture는 agent id hash를 `CHARACTER_COUNT`로 나눈 값으로 고릅니다.
- `CHARACTER_COUNT`를 변경할 때는 preload 대상 texture key와 실제 asset 개수가 함께 맞아야 합니다.
- texture가 로드되지 않은 상태에서 animation을 만들면 Phaser animation frame 오류가 발생할 수 있으므로 preload key와 animation 생성 key를 같이 검증합니다.
