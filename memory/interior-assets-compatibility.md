# Interior 에셋 크기 호환성 조사

2026-09-23, 로컬 원본 `/Users/yoophi/Downloads/Interior`를 조사했다. 파일 이관이나 런타임 변경은 하지 않았다.

## 판단

**원본 픽셀 크기는 현재 16px 타일·16×32px 캐릭터와 함께 사용할 수 있는 수준이다.** 다만 통합 시트를 그대로 가구 이미지로 로드하면 투명 여백과 다른 가구까지 크기에 포함되므로, 개별 이미지 추출 또는 atlas 프레임 정의가 필요하다. 파일 전체의 폭·높이가 16의 배수라는 사실만으로 공식 타일 규격을 확정할 수는 없다. 제작자 메타데이터가 없어 16px 격자는 시각 관찰과 실제 가구 크기로 판단했다.

- `Home/LivingRoom-Sheet.png`: 전체 시트는 192×96px지만 왼쪽 테이블의 불투명 영역은 `(25,15)`부터 **46×30px**다. 48×32px 캔버스에 배치하면 현재 `DESK_FRONT`의 48×32px와 비슷한 규모다. 이는 원본 테이블과 책상의 이미지 크기 비교이며 같은 용도나 동일한 상판 높이라는 뜻은 아니다.
- `Home/LivingRoom1-Sheet.png`: 전체 시트는 384×960px다. 첫 정면 소파의 불투명 영역은 `(24,21)`부터 **48×26px**, 측면 소파는 `(233,1)`부터 **15×46px**다. 각각 48×32px, 16×48px 안에 들어가는 규모다. 시트의 반복 배치 간격은 96px지만 물체가 96px 크기인 것은 아니다.
- `Home/TilesHouse.png`: 바닥·벽 조각은 시각상 16px 단위 격자에 맞춰 조합할 수 있다. 기존 `wall_0.png`의 연결 비트마스크 프레임 순서와는 별도이므로 단순 파일 교체는 불가능하다.
- `Demo/` 8개 파일은 이미 조합된 장면 이미지다. 개별 가구 크기나 타일 규격의 기준으로 사용하지 않는다.
- 색감과 윤곽선 대비는 Pixel Agents와 다르다. 크기 호환과 미술 스타일의 일치는 별개이며, 실제 씬에서 함께 배치한 검증은 아직 하지 않았다.

## 현재 프로젝트 기준

| 항목 | 원본 이미지/프레임 크기 | 근거 |
|---|---:|---|
| Tiled 맵 기본 타일 | 16×16px | `public/maps/sample.tmj`, `src/game/scenes/BootScene.ts` |
| 캐릭터 | 시트 112×96px, 프레임 16×32px | `public/assets/characters/char_0.png`, 캐릭터 로딩 규격 |
| 가로 업무 책상 | 48×32px | `public/assets/furniture/DESK/DESK_FRONT.png` |
| 작은 정면 테이블 | 32×32px | `public/assets/furniture/SMALL_TABLE/SMALL_TABLE_FRONT.png` |
| 정면 컴퓨터 | 16×32px | `public/assets/furniture/PC/PC_FRONT_OFF.png` |
| 바닥 | 16×16px | `public/assets/floors/floor_0.png` |
| 벽 | 시트 64×128px, 프레임 16×32px | `public/assets/walls/wall_0.png`, `PixelAgentsOfficeScene.ts` |

픽셀 오피스 씬은 원본 16px 타일을 사용한다. 랜덤 오피스는 원본을 2배로 표시해 타일이 화면에서 32px가 된다. Interior도 같은 씬의 기존 배율을 적용해야 하며, 원본 이미지 자체를 미리 2배 확대할 필요는 없다.

## 전체 파일 목록

PNG 32개(Home 20개, Hospital 4개, Demo 8개)를 확인했다. 모두 8비트 RGBA PNG이며 아래 수치는 **파일 전체 캔버스 크기**다. 실제 물체 크기, 애니메이션 프레임 크기, 충돌 footprint와 구분한다.

| 로컬 상대 경로 | 캔버스 크기(px) |
|---|---:|
| `Demo/Image Sequence_002_0000.png` | 680×503 |
| `Demo/Image Sequence_004_0000.png` | 680×510 |
| `Demo/Image Sequence_005_0000.png` | 680×322 |
| `Demo/Image Sequence_006_0000.png` | 424×468 |
| `Demo/Image Sequence_007_0000.png` | 532×449 |
| `Demo/Image Sequence_008_0000.png` | 356×510 |
| `Demo/Image Sequence_009_0000.png` | 428×510 |
| `Demo/Image Sequence_010_0000.png` | 425×510 |
| `Home/Bathroom-Sheet.png` | 576×96 |
| `Home/Beds-Sheet.png` | 256×256 |
| `Home/Beds1-Sheet.png` | 256×320 |
| `Home/Carpet-Sheet.png` | 320×64 |
| `Home/Chimney-Sheet.png` | 384×48 |
| `Home/Chimney1-Sheet.png` | 256×32 |
| `Home/Cupboard-Sheet.png` | 576×96 |
| `Home/Doors-Sheet.png` | 1344×128 |
| `Home/Flowers-Sheet.png` | 384×96 |
| `Home/Kitchen-Sheet.png` | 1152×96 |
| `Home/Kitchen1-Sheet.png` | 576×96 |
| `Home/Lights-Sheet.png` | 384×64 |
| `Home/LivingRoom-Sheet.png` | 192×96 |
| `Home/LivingRoom1-Sheet.png` | 384×960 |
| `Home/Miscellaneous-Sheet.png` | 640×64 |
| `Home/Paintings-Sheet.png` | 320×32 |
| `Home/Paintings1-Sheet.png` | 160×32 |
| `Home/TV-Sheet.png` | 256×96 |
| `Home/TilesHouse.png` | 512×512 |
| `Home/Windows-Sheet.png` | 896×64 |
| `Hospital/BedHospital-Sheet.png` | 128×64 |
| `Hospital/DoorsHospital-Sheet.png` | 800×80 |
| `Hospital/Miscellaneous-Sheet.png` | 3072×64 |
| `Hospital/TilesHospital.png` | 320×256 |

## 적용 시 필요한 작업

1. 사용할 가구를 선택해 투명 여백을 통제한 16px 격자 캔버스로 추출하거나 atlas 프레임을 정의한다. 물체의 불투명 경계만 자동 crop하면 46×30px 같은 비격자 이미지가 되므로 배치 기준점도 함께 정의해야 한다.
2. 책상·컴퓨터처럼 겹치는 물체는 상판 위치와 기준점을 각각 맞춘다. 이미지 크기가 비슷해도 기존 PC 배치 좌표를 그대로 재사용할 수 있다고 보장하지 않는다.
3. 충돌 footprint는 바닥 점유 영역으로 별도 지정한다. 현재 픽셀 오피스의 가구 배치는 이미지 크기를 타일 크기로 나누므로 통합 시트를 그대로 전달하면 과도하게 큰 장애물이 된다.
4. 바닥·벽은 사용할 16px 조각을 추출해 Tiled tileset과 tile id를 정의한다. 기존 연결 벽 프레임 계약은 별도로 맞춘다.
5. 정수 배율과 nearest-neighbor 렌더링을 유지하고, 실제 캐릭터와 함께 크기·앉는 위치·depth를 화면에서 확인한다.

## 출처와 한계

- 1차 자료: `/Users/yoophi/Downloads/Interior`의 PNG 헤더와 픽셀/알파 채널. 캔버스 크기는 PNG IHDR, 대표 가구의 실측은 알파 채널 연결 영역의 경계 상자로 확인했다.
- 비교 자료: 위 표의 프로젝트 PNG, `src/game/scenes/BootScene.ts`, `src/game/scenes/PixelAgentsOfficeScene.ts`, `src/ui/DemoRandomOfficeChatterRoute.tsx`, `memory/tiled-schema.md`, `memory/pixel-agents-assets.md`.
- 원본 폴더에는 PNG와 `.DS_Store`만 있다. 라이선스, README, atlas JSON, Tiled 메타데이터는 발견하지 못했다. 따라서 제작자의 공식 타일 규격·애니메이션 속도·상업적 이용 및 재배포 조건은 이 폴더만으로 확인할 수 없다.
- 조사 결과는 로컬 파일과 대표 이미지의 관찰에 한정한다. 모든 개별 가구의 프레임 분할 및 인게임 배치 검증을 완료했다는 의미는 아니다.
