# 말풍선과 랜덤 오피스 데모 규칙

> 2026-04-22 작성. 말풍선 렌더링, 캐릭터 이동, 랜덤 오피스 잡담 데모에서 합의한 현재 규칙을 기록합니다.

## 말풍선 렌더링

- 게임 내 말풍선은 `src/game/entities/SpeechBubble.ts`에서 관리합니다.
- 앱의 기본 영문·숫자 폰트는 `FS Pixel Sans`입니다. `pixel-agents@1.4.1` 배포본과 동일한 `FSPixelSansUnicode-Regular.ttf`를 로컬 에셋으로 사용합니다.
- `FS Pixel Sans`는 한글 글리프가 없으므로 `Galmuri11`, `Pretendard`, `Noto Sans KR` 순서로 폴백합니다. 말풍선은 한글과 영문의 실제 글리프 높이를 맞추기 위해 `size-adjust: 204%`인 `FS Pixel Sans Matched`를 사용합니다.
- DOM UI, Phaser `Text`, Canvas 2D 텍스트는 같은 폰트 스택을 사용합니다.
- `src/index.css`에 웹폰트를 등록하고, `src/main.tsx`에서 앱 시작 전에 게임에서 사용하는 폰트 로드를 기다립니다.
- 폰트 라이선스는 SIL Open Font License 1.1이며 `public/assets/fonts/FSPixelSansUnicode-Regular.LICENSE.txt`에 고지합니다.
- Phaser `Text`는 내부 캔버스 텍스처로 래스터라이즈되므로, 작은 폰트가 흐려 보일 수 있습니다.
- 말풍선 텍스트 텍스처 해상도는 최소 3배로 유지합니다.
- 말풍선 줄 높이는 선언한 폰트 크기의 `120%`로 계산하며, 첫 줄이 텍스처 상단에서 잘리지 않도록 `1px` 상단 padding을 둡니다. 실제 글리프의 세로 여백은 기본 말풍선에서 `-1px` Y 오프셋으로 맞춥니다.
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
- 이 라우트의 말풍선과 데모 내비게이션 폰트는 20% 확대 목표값에 가장 가까운 정수 CSS 픽셀로 표시합니다.
  - 말풍선과 내비게이션 제목: `11px` → `13px`
  - 내비게이션 링크: `12px` → `14px`
- 말풍선 줄 높이는 선언한 `13px` 폰트 크기의 `120%`인 `15.6px`입니다. Phaser의 `lineSpacing`은 선언 크기가 아니라 런타임에서 측정된 글꼴 높이에 더해지므로, `15.6px - 측정된 글꼴 높이 - stroke 두께`로 동적으로 계산합니다.
- 원본 FS Pixel Sans 영문은 같은 `13px`에서 실제 ink 높이가 `5.6875px`로, Galmuri11 한글의 `11.9167px`보다 작습니다. 말풍선은 `size-adjust: 204%`인 `FS Pixel Sans Matched` font face를 사용하며, 보정 후 영문 높이는 약 `11.60px`로 한글보다 약 2.6% 작게 표시합니다.
- 첫 줄의 상단 글리프가 텍스처 경계에서 잘리지 않도록 랜덤 오피스 말풍선 텍스트에만 `1px` 상단 padding을 둡니다.
- 카메라 줌 `1`에서 3배 텍스처를 축소할 때 생기는 반투명 가장자리를 제거하기 위해 랜덤 오피스 말풍선에만 알파 임계값 `128`을 적용합니다. 동일 문장 캡처에서 중간 명암 픽셀이 `203개`에서 `1개`로 줄었으며, 다른 Scene의 말풍선에는 적용하지 않습니다.
- 글꼴의 line box 안에서 실제 글리프 윤곽이 아래쪽으로 치우치므로 텍스트 객체에 `-2px` Y 오프셋을 적용합니다. 영문 축소로 line box가 줄어도 기존 세로 크기를 유지하도록 말풍선 높이에 `1px`을 보정하며, 단일 행 말풍선의 흰 배경과 실제 잉크 사이 여백은 Chromium 1280×800 검증에서 위·아래 각각 `11px`입니다.
- 크기 선정 근거는 [`memory/fs-pixel-sans-sizing.md`](fs-pixel-sans-sizing.md)를 참고합니다.
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
- `public/assets/fonts/FSPixelSansUnicode-Regular.ttf`
- `public/assets/fonts/FSPixelSansUnicode-Regular.LICENSE.txt`
