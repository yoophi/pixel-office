# 말풍선과 랜덤 오피스 데모 규칙

> 2026-04-22 작성. 말풍선 렌더링, 캐릭터 이동, 랜덤 오피스 잡담 데모에서 합의한 현재 규칙을 기록합니다.

## 말풍선 렌더링

- 게임 내 말풍선은 `src/game/entities/SpeechBubble.ts`에서 관리합니다.
- 말풍선 텍스트는 `Galmuri11`, `Galmuri9`가 아니라 `Pretendard` 웹폰트를 사용합니다.
- `src/index.css`에 Pretendard variable 웹폰트를 등록하고, `src/main.tsx`에서 앱 시작 전에 폰트 로드를 기다립니다.
- Phaser `Text`는 내부 캔버스 텍스처로 래스터라이즈되므로, 작은 폰트가 흐려 보일 수 있습니다.
- 말풍선 텍스트 텍스처 해상도는 최소 3배로 유지합니다.
- 긴 문장은 자동 줄바꿈합니다. 현재 word wrap 기준 폭은 `180px`입니다.
- 말풍선 배경은 `Graphics`로 직접 그립니다.
  - 흰 배경
  - 검은색 50% 반투명 외곽
  - 어두운 회색 50% 반투명 그림자
  - 둥근 사각형 본문
  - 본문 하단 중앙 꼬리
- 꼬리 크기는 초기 시안보다 작게 유지합니다.
  - 높이 `8`
  - 너비 `13`
- 말풍선 세로 크기가 커져도 꼬리 끝은 캐릭터 머리 위 고정 위치에 있어야 합니다.
- 캐릭터 sprite가 확대된 데모에서도 얼굴을 가리지 않도록, 꼬리 기준 오프셋은 `target.scaleY`를 반영합니다.

## 말풍선 텍스트 스트리밍

- 랜덤 오피스 데모의 말풍선은 텍스트가 스트리밍되는 것처럼 순차적으로 줄을 추가합니다.
- 화면에 보이는 줄 수는 최대 5줄입니다.
- 새 줄이 추가되어 5줄을 넘으면 오래된 줄부터 사라집니다.
- 한 번 말할 때 출력되는 전체 줄 수는 랜덤입니다.
  - 70%: 1-2줄
  - 20%: 3-5줄
  - 10%: 6-18줄
- 출력이 끝나면 말풍선이 사라집니다.
- 말풍선이 사라진 뒤 랜덤한 시간 후 다시 말합니다.
  - 현재 대기 시간 범위는 1.4초-5.2초입니다.
- 각 캐릭터는 한 가지 주제의 말만 계속합니다.
  - 가사풍 원문 문장
  - 니체풍 잠언
  - 디자인패턴 설명
  - 스타트업 명언
  - 날씨 이야기
- 말풍선 문장에는 `가사풍:`, `니체:`, `패턴:` 같은 prefix를 표시하지 않습니다.
- 실제 노래 가사는 사용하지 않습니다. 저작권 문제가 없도록 짧은 원문 “가사풍” 문장을 사용합니다.

## 이동 규칙

- 캐릭터 이동은 상하좌우 4방향 타일 이동만 허용합니다.
- 대각선 직선 tween 이동은 금지합니다.
- 경로 탐색은 기존 `PathfindingSystem`을 사용합니다.
- 랜덤 오피스 데모에서도 가구 footprint를 장애물 타일로 등록합니다.
- 캐릭터는 장애물 타일을 통과하지 않습니다.
- 캐릭터끼리 충돌하지 않도록 현재 점유 타일과 다음 이동 예약 타일을 모두 회피합니다.
- 다음 step이 다른 캐릭터나 예약 타일에 막히면 즉시 통과하지 않고 잠시 대기한 뒤 목적지와 경로를 다시 잡습니다.
- 랜덤 오피스 데모의 캐릭터/가구는 2배 픽셀 뷰 스케일을 사용합니다.
- 2배 스케일에서는 한 타일 이동 거리도 2배가 되므로, 체감 속도를 맞추기 위해 step duration도 기존 220ms의 2배인 440ms로 둡니다.

## 랜덤 오피스 데모

- 랜덤 오피스 잡담 데모는 `/demo/random-office-chatter` 라우트입니다.
- 일반 `PhaserGame` 샘플 맵을 공유하지 않고, 전용 Phaser scene을 사용합니다.
- 캔버스는 브라우저 viewport 크기로 생성합니다.
- 최초 렌더링 시점의 viewport 크기를 world 크기로 고정합니다.
- 브라우저 크기를 변경해도 가구와 캐릭터 배치는 다시 하지 않습니다.
- resize 시에는 Phaser canvas viewport만 변경하고, 기존 world가 crop되어 보이게 합니다.
- 바닥 타일은 가구 배치 이후 그립니다.
- 바닥 색은 가구 배치 정보를 참고해 구분합니다.
  - boundary tile
  - blocked tile
  - furniture 근처 walkable tile
  - 일반 walkable path tile
- 랜덤 가구는 `public/assets/furniture/**`의 기존 PNG를 사용합니다.
- 캐릭터는 `public/assets/characters/char_*.png` spritesheet를 사용합니다.

## 관련 파일

- `src/game/entities/SpeechBubble.ts`
- `src/ui/DemoSpeechBubbleRoute.tsx`
- `src/ui/DemoSpeechBubbleFontRoute.tsx`
- `src/ui/DemoRandomOfficeChatterRoute.tsx`
- `src/ui/demoRoutes.ts`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/main.tsx`
