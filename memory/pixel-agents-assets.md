# Pixel Agents 에셋 이관

## 원본과 이관 범위

- 원본: https://github.com/pixel-agents-hq/pixel-agents/tree/3537e140c2094761beae748592aeb92ece8edfdd/webview-ui/public/assets
- 기준 커밋: `3537e140c2094761beae748592aeb92ece8edfdd`
- 이관일: 2026-09-23
- 원본 87개 파일 중 기존 캐릭터 6개는 내용이 동일하여 유지하고, 누락된 81개를 같은 상대 경로로 `public/assets/`에 추가했다.
- 추가 내역: 가구 이미지·manifest 63개, 바닥 9개, 카펫 3개, 벽 1개, 펫 이미지·manifest 4개, 기본 레이아웃 1개.
- 원본 MIT 저작권·라이선스 고지는 `public/assets/pixel-agents.LICENSE.txt`에 보존했다.

## 기존 에셋과의 관계

- 기존 소문자 분류 디렉터리와 `furniture/furniture-catalog.json`은 유지한다.
- 새 가구는 `furniture/DESK/manifest.json`처럼 가구별 대문자 디렉터리와 개별 manifest를 사용한다. 기존 카탈로그에 자동 등록되는 형식이 아니므로 사용하는 씬에서 별도로 로드해야 한다.
- 새 벽은 `walls/wall_0.png`이며 기존 `walls.png`를 대체하지 않는다.
- `default-layout-1.json`은 원본 참고 자료다. Tiled `.tmj`가 아니므로 기존 맵 로더에 직접 전달할 수 없다.
- 이관 완료 시 원본 87개 파일 전체를 바이트 단위로 대조했다. 파일 이관과 씬 적용·시각 검증은 별개다.

## 사무실 데모 적용

- `/demo/pixel-agents-office`는 `DemoPixelAgentsOfficeRoute.tsx`와 전용 `PixelAgentsOfficeScene.ts`에서 제공한다.
- 고정 36×23 타일(576×368px) 공간에 업무 좌석 9개, 회의실, 커피 라운지를 배치한다. 화면 크기 변경 시 가구를 재배치하지 않는다.
- 새 가구 21종의 이미지와 바닥 `floor_0`, `floor_3`, `floor_6`, 벽 `wall_0`을 사용한다. 벽은 16×32 프레임의 상하좌우 연결 비트마스크로 선택한다.
- 배치는 데모 전용 씬에 고정되어 있으며 원본 JSON이나 기존 Tiled 맵을 변경하지 않는다. 제품용 Tiled 맵 전환과 실제 에이전트 이벤트 연결은 별도 작업이다.
- 샘플 에이전트 10명 중 6명은 의자에서 타이핑하고, 4명은 가구 footprint·벽·다른 캐릭터의 현재/예약 타일을 회피하며 이동한다.
- 기존 공통 `GameCanvasToolbar`와 줌 저장소를 공유한다. 정수 줌과 화면 맞춤을 지원하며, 화면보다 큰 캔버스는 스크롤한다.
- Chrome에서 배치·라우트 재진입·3배 줌·화면 맞춤을 확인했다. 씬의 실제 배치 코드와 PNG 크기를 사용하는 임시 검사에서 이동 가능 타일 581개가 모두 연결되고 이동 캐릭터 시작점 4개가 유효함을 확인했다.

## 전체 데모 에셋 통일

- 공통 `OfficeScene` 데모(장애물·충돌·군중·Depth·말풍선)는 Pixel Agents 원본을 조립한 Tiled 아틀라스 2종을 사용한다. 기존 충돌 타일은 유지하며, 원본 맵의 부족했던 바닥·가구 배열 끝을 채워 각 레이어를 220칸으로 맞췄다.
- 바닥은 `floor_6`, 벽은 `wall_0`의 가로 벽 하단 조각, 정적 가구는 `COFFEE_TABLE`과 `DOUBLE_BOOKSHELF`를 사용한다. Warm/Dark는 바닥·벽 색만 달리하며, 씬 재시작 없이 tileset 이미지를 교체한다.
- 동적 좌석은 `CUSHIONED_CHAIR_SIDE`, 책상은 `SMALL_TABLE_SIDE`, 장애물은 `PLANT`를 사용한다.
- 랜덤 오피스도 새 가구·PC·바닥·벽으로 교체했다. 폰트 비교의 Canvas와 DOM 캐릭터는 `char_0.png`의 동일 프레임을 사용한다.
- 기존 캐릭터 6종은 원본과 동일하므로 계속 사용한다. 옛 에셋 파일은 보존하지만 런타임 소스에서 옛 소문자 가구 디렉터리와 `/tilesets/`를 참조하지 않는다.
