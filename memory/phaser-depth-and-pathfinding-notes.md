# Phaser Depth and Pathfinding Notes

> 2026-04-22 작성. 이번 세션에서 확인한 Phaser depth, 동적 장애물, 경로 재계산, 좌석 상태 규칙을 정리합니다.

## Depth 정렬

- 캐릭터 sprite는 발 위치가 기준점이 되도록 bottom origin을 사용합니다.
- 캐릭터 depth는 tile layer base에 `sprite.y / 10000`을 더해 아래쪽 캐릭터가 위에 그려지도록 합니다.
- 데모용 가구와 장애물도 캐릭터와 같은 layer base를 사용해야 합니다. 가구 base를 낮게 잡으면 y-depth가 있어도 캐릭터가 항상 가구 위에 그려집니다.
- `TABLE_WOOD_VERTICAL.png`는 `16x32`라서 시각적으로 세로 2개 타일을 차지합니다.
- 세로 책상은 anchor tile 하나만 막으면 부족합니다. anchor `{x, y}`와 위쪽 `{x, y - 1}`을 모두 footprint로 보고 blocking/depth/minimap 검증에 반영해야 합니다.
- 캐릭터가 책상 위로 걷는 것처럼 보이면 먼저 z-index가 아니라 가구 footprint와 blocked tile 계산을 확인합니다.

## 동적 pathfinding

- `createPathfindingSystemFromTilemap`은 정적 tilemap blocker와 동적 blocker callback을 함께 받습니다.
- 정적 blocker는 Tiled layer의 `walls`, `furniture` 등입니다.
- 데모 blocker는 `demo:obstacles-set`으로 전달한 장애물과 책상 footprint입니다.
- 캐릭터 blocker는 현재 화면의 `agentTiles`를 기준으로 판단합니다.
- 목적지가 겹치는 상황은 허용할 수 있지만, 이동 중 다음 step에 예상하지 못한 blocker가 생기면 즉시 통과시키지 않습니다.
- `moveAgentWithReplanning`은 한 타일씩 이동하며 매 step 전에 현재 blocker를 다시 확인합니다.
- 다음 step이 막혔으면 잠시 대기한 뒤 현재 위치에서 경로를 다시 계산합니다.
- step 이동이 끝날 때마다 `agentTiles`를 현재 tile로 갱신해야 다른 캐릭터가 낡은 위치를 장애물로 보지 않습니다.

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
