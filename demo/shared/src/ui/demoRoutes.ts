export const demoRoutes = [
  { path: '/demo/pixel-agents-office', label: '픽셀 오피스' },
  { path: '/demo/interior-assets', label: 'Interior 샘플' },
  { path: '/demo/obstacle-walking', label: '장애물 회피' },
  { path: '/demo/agent-collision', label: '캐릭터 회피' },
  { path: '/demo/agent-crowd-collision', label: '움직이는 군중' },
  { path: '/demo/depth-sorting', label: 'Depth 정렬' },
  { path: '/demo/speech-bubble', label: '말풍선' },
  { path: '/demo/speech-bubble-font', label: '폰트 비교' },
  { path: '/demo/random-office-chatter', label: '랜덤 오피스' },
] as const;

export function demoUrl(path: string) {
  const index = demoRoutes.findIndex((route) => route.path === path);
  if (import.meta.env.DEV) {
    const url = new URL(path + '/', window.location.href);
    url.port = String(5200 + index);
    url.hash = '';
    return url.href;
  }
  return path + '/';
}
