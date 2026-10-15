type VsCodeApi = {
  postMessage: (msg: unknown) => void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

const fallbackApi: VsCodeApi = {
  postMessage: () => {},
};

export const vscode = window.acquireVsCodeApi ? window.acquireVsCodeApi() : fallbackApi;
