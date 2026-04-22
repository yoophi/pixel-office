# Phaser / React 생명주기 주의사항

> 2026-04-22 작성. `/demo/obstacle-walking` 구현 중 발생한 캐릭터 미표시, 중복 Phaser 인스턴스, 이동 중 재시작 오류를 기록합니다.

## 배경

`PhaserGame`은 React 컴포넌트 안에서 `new Phaser.Game(...)`을 생성하는 imperative 엔진 래퍼입니다. React 상태/라우트/HMR/StrictMode와 Phaser Scene/Tween/Texture 생명주기가 섞이면, 이벤트는 정상 전달되지만 화면 객체만 사라지거나 파괴된 sprite를 tween이 계속 조작하는 문제가 생길 수 있습니다.

## 실제로 발생한 문제

### React StrictMode와 Phaser 중복 생성

- 개발 모드에서 `React.StrictMode`는 mount/unmount를 의도적으로 반복합니다.
- 이 앱에서는 그 과정에서 `PhaserGame.tsx`가 Phaser 인스턴스를 여러 번 만들고 파괴할 수 있었습니다.
- 콘솔에 `Phaser v4.0.0 ...` 로그가 반복되면 중복 생성 가능성을 먼저 의심합니다.
- Phaser처럼 전역 texture/anims/tween manager를 가진 imperative 엔진은 StrictMode 이중 마운트와 궁합이 좋지 않습니다.

권장:

- Phaser host 컴포넌트 주변에서는 StrictMode를 끄거나, Phaser 인스턴스 생성을 앱 전역 singleton/ref-count 방식으로 방어합니다.
- HMR 뒤 이상 현상이 남으면 dev server를 재시작해서 이전 Phaser 인스턴스를 완전히 제거합니다.

### Scene 종료 후 이벤트 구독자 잔존

- `OfficeScene`이 종료된 뒤에도 `gameBus` 구독자가 살아 있으면, 이전 Scene controller가 새 `agent:event`를 받을 수 있습니다.
- 이 경우 파괴된 texture/anims/sprite에 `Character`를 만들거나 `sprite.play()`를 호출하며 런타임 오류가 납니다.

권장:

- `Phaser.Scenes.Events.SHUTDOWN`과 `DESTROY`에서 모든 구독을 해제합니다.
- `agentSyncStop`, UI 이벤트 구독, demo 이벤트 구독, resize listener를 함께 정리합니다.
- Scene controller에는 `isActive()` guard를 두고 비활성 Scene에서는 이벤트를 무시합니다.

### 이동 중 재실행 시 tween chain 잔존

- 캐릭터 이동 중 같은 agent를 `remove -> upsert -> move`로 다시 시작하면, 이전 `TweenChain`의 `onStart`가 나중에 실행될 수 있습니다.
- 이전 tween이 파괴된 sprite에 `setDirection()` 또는 `setStatus()`를 호출하면 `Sprite.play()` 내부에서 오류가 발생합니다.

권장:

- 새 이동을 시작하기 전에 `scene.tweens.killTweensOf(character.sprite)`를 호출합니다.
- agent 제거, Scene cleanup 때도 대상 sprite의 tween을 먼저 중단합니다.
- `Character.destroy()` 이후에는 `setDirection`, `setStatus`, animation play가 no-op이 되도록 `destroyed` guard를 둡니다.

### Matrix spawn 효과와 alpha 상태

- `playMatrixSpawnEffect()`는 등장 연출을 위해 `target.setAlpha(0)` 후 tween으로 `alpha=1`을 만듭니다.
- HMR, Scene 재시작, 중복 이벤트와 겹치면 sprite 객체는 존재하지만 `alpha=0` 상태가 남아 말풍선만 보이고 캐릭터가 안 보일 수 있습니다.

권장:

- demo나 mock host처럼 안정성이 중요한 경로에서는 agent upsert 후 `visible=true`, `alpha=1`, tint 초기화를 보장합니다.
- 시각 효과는 본질 상태 표현보다 낮은 우선순위입니다. 효과 때문에 캐릭터가 사라지면 효과를 끄거나 보정합니다.

## 데모 이벤트 주입 원칙

- `game:ready` 이후에 demo obstacle과 agent event를 주입합니다.
- `game:ready`를 놓칠 수 있으므로 fallback timer를 둘 수 있지만, 중복 호출은 idempotent해야 합니다.
- 데모 route unmount 시 demo agent 제거와 demo obstacle reset을 함께 수행합니다.
- 새로고침마다 랜덤 맵을 만들 때도 시작점과 모든 demo 목적지까지의 경로가 존재하는지 먼저 검증합니다.

## 빠른 진단 체크리스트

- 말풍선은 보이는데 캐릭터가 안 보임:
  - agent event와 `SocialSystem`은 동작 중입니다.
  - sprite `alpha`, `visible`, depth, texture frame, spawn effect를 확인합니다.
- 이동 중 버튼 클릭 시 `Sprite.play` 오류:
  - 이전 tween chain이 남아 있습니다.
  - 새 이동/agent 제거 전에 `killTweensOf(sprite)`가 필요합니다.
- 콘솔에 Phaser 부트 로그가 여러 번 반복됨:
  - StrictMode, HMR, route remount로 Phaser 인스턴스가 중복 생성되고 있을 수 있습니다.
  - dev server 재시작과 `PhaserGame` 생명주기 방어를 먼저 확인합니다.
