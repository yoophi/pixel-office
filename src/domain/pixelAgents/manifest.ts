// pixel-agents `furniture/<FOLDER>/manifest.json` 형식을 그대로 읽어 평탄한 카탈로그로 바꿉니다.
// 규칙 원본: pixel-agents core/src/assets/manifestUtils.ts, webview-ui/src/office/layout/furnitureCatalog.ts

export interface ManifestAsset {
  type: 'asset';
  id: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  orientation?: string;
  state?: string;
  frame?: number;
  mirrorSide?: boolean;
}

export interface ManifestGroup {
  type: 'group';
  groupType: 'rotation' | 'state' | 'animation';
  rotationScheme?: string;
  orientation?: string;
  state?: string;
  members: ManifestNode[];
}

export type ManifestNode = ManifestAsset | ManifestGroup;

export interface FurnitureManifest {
  id: string;
  name: string;
  category: string;
  canPlaceOnWalls: boolean;
  canPlaceOnSurfaces: boolean;
  backgroundTiles: number;
  type: 'asset' | 'group';
  file?: string;
  width?: number;
  height?: number;
  footprintW?: number;
  footprintH?: number;
  groupType?: string;
  rotationScheme?: string;
  members?: ManifestNode[];
}

export interface FurnitureCatalogEntry {
  /** 레이아웃의 `PlacedFurniture.type` 값. mirrorSide 자산은 `<id>:left` 가상 항목이 추가됩니다. */
  type: string;
  groupId: string;
  name: string;
  category: string;
  /** `furniture/<folder>/<file>` — assets 루트 기준 상대 경로 */
  path: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls: boolean;
  canPlaceOnSurfaces: boolean;
  backgroundTiles: number;
  orientation?: string;
  state?: string;
  animationGroup?: string;
  frame?: number;
  mirrored: boolean;
}

export type FurnitureCatalog = ReadonlyMap<string, FurnitureCatalogEntry>;

interface Inherited {
  groupId: string;
  folder: string;
  name: string;
  category: string;
  canPlaceOnWalls: boolean;
  canPlaceOnSurfaces: boolean;
  backgroundTiles: number;
  orientation?: string;
  state?: string;
  animationGroup?: string;
}

function flatten(node: ManifestNode, inherited: Inherited, out: FurnitureCatalogEntry[], mirrorSides: Set<string>) {
  if (node.type === 'asset') {
    const orientation = node.orientation ?? inherited.orientation;
    const state = node.state ?? inherited.state;
    if (node.mirrorSide) mirrorSides.add(node.id);
    out.push({
      type: node.id,
      groupId: inherited.groupId,
      name: inherited.name,
      category: inherited.category,
      path: `furniture/${inherited.folder}/${node.file}`,
      width: node.width,
      height: node.height,
      footprintW: node.footprintW,
      footprintH: node.footprintH,
      isDesk: inherited.category === 'desks',
      canPlaceOnWalls: inherited.canPlaceOnWalls,
      canPlaceOnSurfaces: inherited.canPlaceOnSurfaces,
      backgroundTiles: inherited.backgroundTiles,
      ...(orientation ? { orientation } : {}),
      ...(state ? { state } : {}),
      ...(inherited.animationGroup ? { animationGroup: inherited.animationGroup } : {}),
      ...(node.frame !== undefined ? { frame: node.frame } : {}),
      mirrored: false,
    });
    return;
  }

  for (const member of node.members) {
    const child: Inherited = { ...inherited };
    if (node.groupType === 'state') {
      if (node.orientation) child.orientation = node.orientation;
      if (node.state) child.state = node.state;
    }
    if (node.groupType === 'animation') {
      const orientation = node.orientation ?? inherited.orientation ?? '';
      const state = node.state ?? inherited.state ?? '';
      child.animationGroup = `${inherited.groupId}_${orientation}_${state}`.toUpperCase();
      if (node.state) child.state = node.state;
    }
    if (node.orientation && !child.orientation) child.orientation = node.orientation;
    flatten(member, child, out, mirrorSides);
  }
}

/** 폴더별 manifest 목록 → `type`으로 조회하는 카탈로그. */
export function buildFurnitureCatalog(manifests: ReadonlyArray<{ folder: string; manifest: FurnitureManifest }>): FurnitureCatalog {
  const entries: FurnitureCatalogEntry[] = [];
  const mirrorSides = new Set<string>();

  for (const { folder, manifest } of manifests) {
    const inherited: Inherited = {
      groupId: manifest.id,
      folder,
      name: manifest.name,
      category: manifest.category,
      canPlaceOnWalls: manifest.canPlaceOnWalls,
      canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
      backgroundTiles: manifest.backgroundTiles ?? 0,
    };
    if (manifest.type === 'asset') {
      if (manifest.width == null || manifest.height == null || manifest.footprintW == null || manifest.footprintH == null) continue;
      flatten(
        {
          type: 'asset',
          id: manifest.id,
          file: manifest.file ?? `${manifest.id}.png`,
          width: manifest.width,
          height: manifest.height,
          footprintW: manifest.footprintW,
          footprintH: manifest.footprintH,
        },
        inherited,
        entries,
        mirrorSides,
      );
    } else if (manifest.members) {
      flatten({ type: 'group', groupType: 'rotation', members: manifest.members }, inherited, entries, mirrorSides);
    }
  }

  const catalog = new Map<string, FurnitureCatalogEntry>();
  for (const entry of entries) catalog.set(entry.type, entry);
  // side 방향 mirrorSide 자산은 좌우 반전한 `:left` 방향을 같은 스프라이트로 제공합니다.
  for (const id of mirrorSides) {
    const side = catalog.get(id);
    if (side?.orientation === 'side') {
      catalog.set(`${id}:left`, { ...side, type: `${id}:left`, orientation: 'left', mirrored: true });
    }
  }
  return catalog;
}

/** 같은 groupId·orientation의 `on` 애니메이션 프레임(frame 순). PC 전원 표시 등에 사용합니다. */
export function getOnAnimationFrames(catalog: FurnitureCatalog, type: string): FurnitureCatalogEntry[] {
  const base = catalog.get(type);
  if (!base) return [];
  const orientation = base.orientation === 'left' ? 'side' : base.orientation;
  return [...catalog.values()]
    .filter((entry) => entry.groupId === base.groupId && entry.orientation === orientation && entry.state === 'on' && !entry.mirrored)
    .sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0));
}
