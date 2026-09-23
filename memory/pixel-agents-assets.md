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

