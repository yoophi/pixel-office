# Tiled 맵 스키마

> 2026-04-21 작성. v2 Phaser + Tiled 파이프라인에서 사용하는 임시 샘플 맵 규약입니다.

## 파일 위치

- 기본 샘플 맵: `public/maps/sample.tmj`
- 타일셋 변형 이미지: `public/tilesets/office-warm.png`, `public/tilesets/office-dark.png`
- `.tmj`는 기본으로 `office-warm.png`를 참조합니다. 런타임 테마 변경은 같은 타일 순서의 이미지로 교체합니다.

## 맵 기준

- `orientation`: `orthogonal`
- `tilewidth` / `tileheight`: `16`
- 샘플 크기: `20 x 11`
- 좌표는 Tiled 픽셀 좌표를 사용하고, domain 변환 시 `tileSize`로 나눠 grid 좌표로 바꿉니다.

## 레이어 규약

| 레이어명 | 타입 | 역할 |
|---|---|---|
| `floor` | tilelayer | 기본 바닥. 기본적으로 walkable입니다. |
| `walls` | tilelayer | 벽과 경계. `walkable=false` 타일만 배치합니다. |
| `furniture` | tilelayer | 책상/의자 같은 정적 가구. 기본적으로 경로 탐색 장애물입니다. |
| `objects` | objectgroup | 스폰 지점, 좌석, 향후 상호작용 영역을 배치합니다. |

## 타일셋 규약

타일셋 이름은 `office`로 고정합니다. 변형 이미지는 같은 타일 순서와 같은 크기를 유지해야 합니다.

| tile id | 의미 | property |
|---|---|---|
| `0` | floor | `walkable=true` |
| `1` | wall | `walkable=false` |
| `2` | desk | `walkable=false` |
| `3` | chair | `walkable=false` |

Tiled의 layer data에서는 gid가 1부터 시작하므로, `tile id 0`은 gid `1`입니다.

## Object layer 규약

`objects` 레이어의 object는 `type`과 `role` property를 함께 둡니다. loader는 우선 `type`을 읽고, 오래된 맵 호환이 필요하면 `role` property를 fallback으로 사용할 수 있습니다.

| type | 필수 필드 | 필수 property | 의미 |
|---|---|---|---|
| `spawn` | `name`, `x`, `y`, `point=true` | `role=spawn` | 에이전트 기본 등장 위치 |
| `seat` | `name`, `x`, `y`, `width`, `height` | `role=seat`, `facing` | 에이전트 좌석 영역 |

`seat.facing` 값은 `north`, `east`, `south`, `west` 중 하나입니다.

## 변형 타일셋 추가 규칙

새 변형을 추가할 때는 `public/tilesets/office-<variant>.png` 형식을 사용합니다. 모든 변형은 `64 x 16`, 4 columns, 16px tile을 유지해야 하며 tile id 의미를 바꾸면 안 됩니다.
