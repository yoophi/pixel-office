import * as Phaser from 'phaser';

import type { Direction } from '../../domain/agent.js';
import type { GridPoint, Office, Seat, TilesetVariant } from '../../domain/index.js';
import { DEFAULT_TILESET_VARIANTS, getTilesetImageKey } from './tilesetVariants.js';

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledTileset {
  firstgid: number;
  name: string;
  image?: string;
  imageheight?: number;
  imagewidth?: number;
  tilecount: number;
  tileheight: number;
  tilewidth: number;
  columns?: number;
}

export interface TiledLayerBase {
  id: number;
  name: string;
  opacity: number;
  type: string;
  visible: boolean;
  x: number;
  y: number;
}

export interface TiledTileLayer extends TiledLayerBase {
  data: number[];
  height: number;
  type: 'tilelayer';
  width: number;
}

export interface TiledObject {
  height: number;
  id: number;
  name: string;
  point?: boolean;
  properties?: TiledProperty[];
  rotation: number;
  type: string;
  visible: boolean;
  width: number;
  x: number;
  y: number;
}

export interface TiledObjectLayer extends TiledLayerBase {
  draworder: string;
  objects: TiledObject[];
  type: 'objectgroup';
}

export type TiledLayer = TiledTileLayer | TiledObjectLayer;

export interface TiledMap {
  height: number;
  layers: TiledLayer[];
  tileheight: number;
  tilesets: TiledTileset[];
  tilewidth: number;
  width: number;
}

export interface LoadedPhaserTilemap {
  map: Phaser.Tilemaps.Tilemap;
  layers: Phaser.Tilemaps.TilemapLayer[];
  tilesets: Phaser.Tilemaps.Tileset[];
}

export interface TiledMapAssetConfig {
  mapKey: string;
  mapUrl: string;
  variants?: readonly TilesetVariant[];
}

export interface PhaserTilemapConfig {
  mapKey: string;
  variantId?: string;
}

export function preloadTiledMapAssets(scene: Phaser.Scene, config: TiledMapAssetConfig) {
  const variants = config.variants ?? DEFAULT_TILESET_VARIANTS;
  scene.load.tilemapTiledJSON(config.mapKey, config.mapUrl);

  variants.forEach((variant) => {
    scene.load.image(getTilesetImageKey(variant.id), variant.imageUrl);
  });
}

export function createPhaserTilemap(
  scene: Phaser.Scene,
  config: PhaserTilemapConfig,
): LoadedPhaserTilemap {
  const map = scene.make.tilemap({ key: config.mapKey });
  const variantId = config.variantId ?? DEFAULT_TILESET_VARIANTS[0].id;
  const imageKey = getTilesetImageKey(variantId);
  const tilesets = map.tilesets
    .map((tileset) =>
      map.addTilesetImage(
        tileset.name,
        imageKey,
        tileset.tileWidth,
        tileset.tileHeight,
        tileset.tileMargin,
        tileset.tileSpacing,
        tileset.firstgid,
      ),
    )
    .filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

  const layers = map.layers
    .map((layerData) => map.createLayer(layerData.name, tilesets))
    .filter((layer): layer is Phaser.Tilemaps.TilemapLayer => layer instanceof Phaser.Tilemaps.TilemapLayer);

  return { map, layers, tilesets };
}

export function createOfficeFromTiledMap(
  id: string,
  map: TiledMap,
  variants: readonly TilesetVariant[] = DEFAULT_TILESET_VARIANTS,
): Office {
  const objectLayers = map.layers.filter(isObjectLayer);
  const objects = objectLayers.flatMap((layer) => layer.objects);

  return {
    id,
    width: map.width,
    height: map.height,
    tileSize: map.tilewidth,
    spawnPoints: objects.filter(isSpawnObject).map((object) => toGridPoint(object, map.tilewidth)),
    seats: objects.filter(isSeatObject).map((object) => toSeat(object, map.tilewidth)),
    tilesetVariants: [...variants],
    activeTilesetVariantId: variants[0]?.id ?? 'office-warm',
  };
}

function isObjectLayer(layer: TiledLayer): layer is TiledObjectLayer {
  return layer.type === 'objectgroup';
}

function isSpawnObject(object: TiledObject) {
  return object.type === 'spawn' || getStringProperty(object, 'role') === 'spawn';
}

function isSeatObject(object: TiledObject) {
  return object.type === 'seat' || getStringProperty(object, 'role') === 'seat';
}

function toGridPoint(object: TiledObject, tileSize: number): GridPoint {
  return {
    x: Math.floor(object.x / tileSize),
    y: Math.floor(object.y / tileSize),
  };
}

function toSeat(object: TiledObject, tileSize: number): Seat {
  return {
    id: object.name,
    position: toGridPoint(object, tileSize),
    facing: getDirectionProperty(object, 'facing') ?? 'south',
  };
}

function getStringProperty(object: TiledObject, name: string) {
  const value = object.properties?.find((property) => property.name === name)?.value;
  return typeof value === 'string' ? value : undefined;
}

function getDirectionProperty(object: TiledObject, name: string): Direction | undefined {
  const value = getStringProperty(object, name);
  if (value === 'north' || value === 'east' || value === 'south' || value === 'west') {
    return value;
  }
  return undefined;
}
