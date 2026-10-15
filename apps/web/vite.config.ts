import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const PIXEL_AGENTS_FURNITURE_MODULE_ID = 'virtual:pixel-agents-furniture'
const RESOLVED_PIXEL_AGENTS_FURNITURE_MODULE_ID = `\0${PIXEL_AGENTS_FURNITURE_MODULE_ID}`
const PIXEL_AGENTS_FURNITURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public/assets/pixel-agents/furniture')

// 브라우저는 public 디렉터리를 나열할 수 없으므로, manifest.json을 가진 가구 폴더 이름만 빌드 시점에 노출합니다.
// manifest 자체는 pixel-agents 원본 형식 그대로 런타임에 fetch합니다.
function pixelAgentsFurniturePlugin(): Plugin {
  return {
    name: 'pixel-agents-furniture',
    resolveId(id) {
      return id === PIXEL_AGENTS_FURNITURE_MODULE_ID ? RESOLVED_PIXEL_AGENTS_FURNITURE_MODULE_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_PIXEL_AGENTS_FURNITURE_MODULE_ID) return undefined
      const folders = fs
        .readdirSync(PIXEL_AGENTS_FURNITURE_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => fs.existsSync(path.join(PIXEL_AGENTS_FURNITURE_DIR, name, 'manifest.json')))
        .sort()
      return `export const furnitureFolders = ${JSON.stringify(folders)};`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pixelAgentsFurniturePlugin()],
})
