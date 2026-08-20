# FS Pixel Sans 크기 조사

## 결론

`/demo/random-office-chatter`의 통일된 폰트 크기 규칙은 **20% 확대 목표값에 가장 가까운 정수 CSS 픽셀**로 정한다.

- 말풍선과 내비게이션 제목: `11px × 1.2 = 13.2px` → **`13px`**
- 내비게이션 링크: `12px × 1.2 = 14.4px` → **`14px`**

따라서 `13.2px`, `14.4px`처럼 소수인 값을 그대로 쓰지 않는다. 실제 확대율은 각각 약 18.18%, 16.67%다. `14px`, `15px`로 올리는 경우보다 20% 목표값과의 절대 오차가 작다.

후속 시각 검증에서 원본 FS Pixel Sans 영문의 실제 ink 높이는 `13px` 선언 시 `5.6875px`, Galmuri11 한글은 `11.9167px`로 측정됐다. 말풍선은 CSS 선언 크기를 유지하면서 영문 font face에 `size-adjust: 204%`를 적용한다. 보정 후 영문 높이는 약 `11.60px`로 한글보다 약 2.6% 작다.

여기서 “정확한 픽셀”은 글꼴 내부 윤곽의 모든 점을 모든 디스플레이의 물리 픽셀에 일치시킨다는 뜻이 아니라, DOM과 Phaser에 전달하는 논리 크기를 **정수 CSS px**로 고정한다는 뜻이다. 이 라우트는 서로 다른 내부 격자를 가진 영문·한글 글꼴을 섞어 쓰며, CSS px와 물리 디바이스 픽셀도 항상 1:1이 아니므로 모든 환경에서 윤곽을 물리 픽셀에 일치시키는 단일 실용 크기는 없다.

## 근거

### FS Pixel Sans 자체 격자

[FontStruct의 원본 페이지](https://fontstruct.com/fontstructions/show/2606508/fs-pixel-sans-unicode-regular)는 이 글꼴을 `FS Pixel Sans Unicode Regular`라는 픽셀 폰트로 배포한다. 프로젝트에 포함된 [글꼴 파일](../public/assets/fonts/FSPixelSansUnicode-Regular.ttf)은 Pixel Agents v1.4.1 번들과 SHA-256 `3b4e53ff037fc509b24688029948b55111a5e6089f56d669f356864b4dccd819`로 일치한다. 이 파일을 FontTools `ttx`로 확인한 결과는 다음과 같다.

- `head.unitsPerEm = 2048`
- `.notdef`를 제외한 실제 글리프의 모든 `glyf` x/y 좌표는 `128`의 배수
- 일반 글리프의 advance width와 side bearing도 `128` 격자를 사용
- `maxp.maxSizeOfInstructions = 0`이고 힌팅 명령 테이블이 없음
- `head.lowestRecPPEM = 8`

OpenType 명세에서 `unitsPerEm`은 윤곽 좌표 격자의 정밀도를 정하고, `glyf` 좌표는 그 디자인 단위를 사용한다. 따라서 이 글꼴의 기본 윤곽 셀은 `128 / 2048 = 1 / 16em`이다. CSS px와 디바이스 픽셀이 1:1이고 글리프 원점도 정수 픽셀일 때, 윤곽 셀만 보면 `16px`의 배수가 가장 단순한 정렬 크기다. 다만 폰트의 `space` advance는 `320`이고 커닝 값도 `128` 격자 밖의 값을 포함하므로, `16px`조차 임의의 전체 문장에서 모든 글리프 원점을 물리 픽셀에 보장하지는 않는다. [`head` 테이블 명세](https://learn.microsoft.com/en-us/typography/opentype/spec/head), [`glyf` 테이블 명세](https://learn.microsoft.com/en-us/typography/opentype/spec/glyf)

FontStruct 공식 도움말도 모든 FontStruction이 확장 가능한 벡터 윤곽이어서 어떤 크기에서도 사용할 수 있다고 설명한다. 즉 `16px` 격자는 TTF 좌표에서 계산한 엄격한 1:1 출력 조건이지, 제작 도구가 요구하는 CSS 크기 제한은 아니다. [FontStruct 픽셀 폰트 도움말](https://fontstruct.com/help/22/advanced_topics/making_pixel_fonts)

`16px`를 이번 말풍선에 적용하면 기존 `11px`보다 약 45.45% 커져 20% 요청과 크게 어긋난다. 따라서 내부 윤곽 격자의 배수를 라우트 전체의 강제 크기 규칙으로 사용하지 않는다.

### 공식 Pixel Agents의 사용 방식

Pixel Agents v1.4.1은 FS Pixel Sans를 전역 글꼴로 선언하고, 자체 픽셀 아트 크기표를 `16`, `18`, `20`, `22`, `26`, `30`, `36`, `44`, `52`, `64px`로 정의한다. 즉, 공식 프로젝트도 `16px`의 배수만 허용하지 않고 **정수 CSS px 크기표**를 사용한다. [Pixel Agents `index.css`](https://raw.githubusercontent.com/pixel-agents-hq/pixel-agents/v1.4.1/webview-ui/src/index.css)

Canvas 영역 라벨은 기본 `14px`, 최소 `12px`이며, 실제 렌더링 크기는 `14 × zoom`으로 계산한다. 공식 UI의 줌은 `1`부터 `10`까지 `1`씩 바뀌는 정수이므로 라벨 크기도 정수로 유지되지만, `14`, `28`, `42px`처럼 `16px`의 배수는 아니다. 이것도 공식 구현의 실용 규칙이 특정 글꼴 윤곽 배수가 아니라 정수 렌더링 크기임을 보여 준다. [Pixel Agents `constants.ts`](https://raw.githubusercontent.com/pixel-agents-hq/pixel-agents/v1.4.1/webview-ui/src/constants.ts), [Pixel Agents `renderer.ts`](https://raw.githubusercontent.com/pixel-agents-hq/pixel-agents/v1.4.1/webview-ui/src/office/engine/renderer.ts), [Pixel Agents `ZoomControls.tsx`](https://raw.githubusercontent.com/pixel-agents-hq/pixel-agents/v1.4.1/webview-ui/src/components/ZoomControls.tsx)

### 한글 대체 글꼴과 렌더링 환경

현재 [말풍선](../src/game/entities/SpeechBubble.ts)은 `FS Pixel Sans` 뒤에 `Galmuri11`을 대체 글꼴로 둔다. 랜덤 잡담 문장의 대부분은 한글이므로 실제 한글 윤곽은 Galmuri11로 렌더링된다. Galmuri 공식 문서도 Galmuri11의 원본 비트맵 크기를 `12px`로 표기한다. [Galmuri 공식 저장소](https://github.com/quiple/galmuri)

로컬 `Galmuri11.woff2`를 같은 방법으로 확인하면 `unitsPerEm = 1200`이고 윤곽·advance·side bearing이 모두 `100` 단위여서 기본 셀은 `1 / 12em`이다. FS Pixel Sans의 `1 / 16em`과 서로 다르므로, 두 글꼴의 윤곽 셀을 CSS px와 동시에 맞추려면 1:1 출력 기준으로 최소 `48px`가 필요해 이 UI에는 실용적이지 않다.

또한 CSS 명세의 `px`는 물리 디바이스 픽셀 그 자체가 아니라 기준 픽셀에 연결되는 논리 단위이며, 고해상도 출력에서는 하나의 CSS px가 여러 디바이스 픽셀로 표시될 수 있다. [CSS Values and Units Level 4](https://www.w3.org/TR/css-values-4/#absolute-lengths)

말풍선은 Phaser Text로 렌더링되고 현재 최소 texture resolution을 `3`으로 둔다. Phaser 문서도 이 resolution을 Text 객체의 텍스처에 상대적으로 적용하는 값으로 정의한다. 기본 카메라 줌과 texture resolution `3` 조건에서 기본 윤곽 셀만 엄격하게 보면 `16px`가 FS Pixel Sans와 Galmuri11을 모두 텍스처 픽셀에 맞추는 가장 가까운 공통 크기다. 그러나 이 값은 요청한 확대율보다 훨씬 크고 FS의 공백·커닝 배치까지 보장하지 않으며, 디바이스 픽셀 비율과 카메라 줌에 따라 resolution도 달라진다. 따라서 `16px`를 라우트의 통일 크기로 선택하지 않는다. [Phaser Text `setResolution`](https://docs.phaser.io/api-documentation/class/gameobjects-text#setResolution)

## 재현 방법

로컬 글꼴의 메트릭과 윤곽 좌표는 다음 방식으로 확인했다.

```sh
ttx -t head -t maxp -t hmtx -t glyf -o /tmp/fs-pixel-sans.ttx \
  public/assets/fonts/FSPixelSansUnicode-Regular.ttf

ttx -t head -t maxp -t hmtx -t glyf -o /tmp/galmuri11.ttx \
  public/assets/fonts/Galmuri11.woff2
```

`glyf`의 모든 `<pt x="…" y="…">` 좌표와 `hmtx`의 width/lsb 값을 추출해 최대공약수와 나머지를 계산했다. `.notdef`와 `space` 예외를 분리해 일반 글리프 윤곽 격자와 문자열 배치 격자를 구분했다.
