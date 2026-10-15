import * as Phaser from 'phaser';

import { isOccupiedByOtherAgent } from '@pixel-office/core/agentOccupancy';

import { gameBus, startAgentSync, type AgentSyncController, type Unsubscribe } from '../../bridge/index.js';
import {
  DEFAULT_VIEW_ZOOM,
  resolvePixelScale,
  VIEW_ZOOM_REGISTRY_KEY,
  type AgentId,
  type AgentStatus,
  type GridPoint,
  type ViewZoom,
} from '@pixel-office/core';
import { Character, CHARACTER_COUNT } from '../entities/Character.js';
import { playMatrixDespawnEffect, playMatrixSpawnEffect } from '../effects/MatrixEffect.js';
import { createPathfindingSystemFromTilemap, type PathNode } from '../systems/PathfindingSystem.js';
import { createSeatAssignmentSystemFromTilemap, type SeatAssignmentSystem } from '../systems/SeatAssignmentSystem.js';
import { SocialSystem } from '../systems/SocialSystem.js';
import { getTilesetImageKey } from '../tiled/tilesetVariants.js';
import { createPhaserTilemap } from '../tiled/loader.js';
import { CHAIR_KEY, DESK_KEY, SAMPLE_MAP_KEY } from './BootScene.js';

const TARGET_TILE_SIZE = 16;
const MOVE_STEP_DURATION_MS = 220;
const REPLAN_DELAY_MS = 360;
const SEAT_DEPTH_OFFSET_PX = 0.5;

export class OfficeScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;
  private agentSyncStop?: Unsubscribe;
  private tilesetSwitchStop?: Unsubscribe;
  private zoomChangeStop?: Unsubscribe;
  private obstacleStop?: Unsubscribe;
  private socialSystem?: SocialSystem;
  private readonly characters = new Map<AgentId, Character>();
  private readonly agentTiles = new Map<AgentId, GridPoint>();
  private activeVariantId = 'office-warm';

  constructor() {
    super('OfficeScene');
  }

  init(data: { variantId?: string }) {
    this.activeVariantId = data.variantId ?? 'office-warm';
  }

  create() {
    const { map, layers } = createPhaserTilemap(this, {
      mapKey: SAMPLE_MAP_KEY,
      variantId: this.activeVariantId,
    });
    const blockedTiles = new Set<string>();
    const isBlocked = (point: GridPoint) => blockedTiles.has(toGridKey(point));
    const reservedTiles = new Map<AgentId, GridPoint>();
    const seatAssignment = createSeatAssignmentSystemFromTilemap(map);
    const movementTokens = new Map<AgentId, number>();
    this.socialSystem = new SocialSystem(this);

    layers.forEach((layer, index) => {
      layer.setDepth(index);
    });

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    const camera = this.cameras.main;
    camera.setBackgroundColor('#000000');
    camera.roundPixels = true;
    camera.setBounds(0, 0, worldWidth, worldHeight, true);
    camera.centerOn(worldWidth / 2, worldHeight / 2);
    const getCurrentZoom = (): ViewZoom =>
      (this.game.registry.get(VIEW_ZOOM_REGISTRY_KEY) as ViewZoom | undefined) ?? DEFAULT_VIEW_ZOOM;
    const applyZoom = (zoom: ViewZoom) => {
      const viewport = { width: this.scale.width, height: this.scale.height };
      const world = { width: worldWidth, height: worldHeight };
      camera.setZoom(resolvePixelScale(zoom, viewport, world));
      camera.centerOn(worldWidth / 2, worldHeight / 2);
    };
    applyZoom(getCurrentZoom());

    if (this.game.registry.get('office:debug')) {
    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: '"FS Pixel Sans", "Galmuri11", monospace',
      fontSize: '11px',
    });
    this.fpsText.setResolution(Math.max(1, Math.ceil((this.cameras.main?.zoom ?? 1) * (window.devicePixelRatio || 1))));
    this.fpsText.setDepth(layers.length + 1);
    this.fpsText.setScrollFactor(0);
    }
    let isActive = true;
    this.agentSyncStop = startAgentSync(
      createOfficeSceneAgentController({
        scene: this,
        characters: this.characters,
        agentTiles: this.agentTiles,
        reservedTiles,
        characterDepth: layers.length,
        movementTokens,
        seatAssignment,
        socialSystem: this.socialSystem,
        autoAssignSeats: this.game.registry.get('office:autoAssignSeats') !== false,
        findSpawnPoint: (agentId, preferred) => {
          const available = (point: GridPoint) => point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height
            && !isBlocked(point) && !isOccupiedByOtherAgent(this.agentTiles, reservedTiles, agentId, point)
            && ['walls', 'furniture'].every((name) => (map.getTileAt(point.x, point.y, false, name)?.index ?? -1) <= 0);
          if (available(preferred)) return preferred;
          for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
            if (available({ x, y })) return { x, y };
          }
          return undefined;
        },
        findPathAvoidingAgents: (agentId, start, goal) =>
          createPathfindingSystemFromTilemap(map, undefined, (point) =>
            isBlocked(point) || isOccupiedByOtherAgent(this.agentTiles, reservedTiles, agentId, point),
          ).findPath(start, goal),
        isActive: () => isActive,
      }),
    );
    const handleResize = () => {
      const zoom = getCurrentZoom();
      if (zoom !== 'fit') return;
      applyZoom(zoom);
    };
    const cleanup = () => {
      isActive = false;
      this.socialSystem?.clear();
      this.agentSyncStop?.();
      this.tilesetSwitchStop?.();
      this.zoomChangeStop?.();
      this.obstacleStop?.();
      this.agentSyncStop = undefined;
      this.tilesetSwitchStop = undefined;
      this.zoomChangeStop = undefined;
      this.obstacleStop = undefined;
      obstacleGroup.clear(true, true);
      blockedTiles.clear();
      this.characters.forEach((character) => stopCharacterTweens(this, character));
      this.characters.forEach((character) => character.destroy());
      this.characters.clear();
      this.agentTiles.clear();
      movementTokens.clear();
      reservedTiles.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.tilesetSwitchStop = gameBus.on('ui:tileset-selected', ({ variantId }) => {
      if (variantId === this.activeVariantId) return;
      const textureKey = getTilesetImageKey(variantId);
      if (!this.textures.exists(textureKey)) return;
      this.activeVariantId = variantId;
      map.tilesets.forEach((tileset) => tileset.setImage(this.textures.get(textureKey)));
    });
    this.zoomChangeStop = gameBus.on('ui:zoom-changed', ({ scale }) => {
      applyZoom(scale);
    });
    const obstacleGroup = this.add.group();
    this.obstacleStop = gameBus.on('office:obstacles-set', ({ obstacles, goal, seats }) => {
      setOfficeObstacles(this, obstacleGroup, blockedTiles, obstacles, goal, layers.length, seats);
    });
    gameBus.emit('game:ready', { readyAt: Date.now() });

    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
  }

  update() {
    this.fpsText?.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    this.socialSystem?.update();
  }
}

export interface OfficeSceneAgentControllerConfig {
  scene: Phaser.Scene;
  characters: Map<AgentId, Character>;
  agentTiles: Map<AgentId, GridPoint>;
  reservedTiles: Map<AgentId, GridPoint>;
  characterDepth: number;
  movementTokens: Map<AgentId, number>;
  seatAssignment: SeatAssignmentSystem;
  socialSystem: SocialSystem;
  findPathAvoidingAgents(agentId: AgentId, start: GridPoint, goal: GridPoint): PathNode[];
  isActive(): boolean;
  autoAssignSeats?: boolean;
  findSpawnPoint?(agentId: AgentId, preferred: GridPoint): GridPoint | undefined;
}

export function createOfficeSceneAgentController(config: OfficeSceneAgentControllerConfig): AgentSyncController {
  return {
    upsertAgent(agent) {
      if (!config.isActive()) return;
      let position = agent.position ?? { x: 3, y: 3 };
      const existing = config.characters.get(agent.id);
      if (existing) {
        ensureCharacterVisible(existing);
        existing.setDirection(agent.direction ?? existing.direction);
        existing.setStatus(toCharacterStatus(agent.status));
        const current = config.agentTiles.get(agent.id);
        if (agent.position && current && (position.x !== current.x || position.y !== current.y)) {
          moveAgentToPoint(config, agent.id, position, toCharacterStatus(agent.status));
        }
        return;
      }

      if (config.findSpawnPoint) {
        const spawn = config.findSpawnPoint(agent.id, position);
        if (!spawn) return;
        position = spawn;
      } else if (isOccupiedByOtherAgent(config.agentTiles, config.reservedTiles, agent.id, position)) return;

      const character = new Character(config.scene, {
        id: agent.id,
        textureKey: getCharacterTextureKey(agent.id),
        x: tileCenter(position.x),
        y: tileBottom(position.y),
        direction: agent.direction ?? 'south',
        status: toCharacterStatus(agent.status),
      });
      updateCharacterDepth(character, config.characterDepth);
      playMatrixSpawnEffect(config.scene, character.sprite);
      ensureCharacterVisible(character);
      config.characters.set(agent.id, character);
      config.agentTiles.set(agent.id, position);

      const seat = config.autoAssignSeats ? config.seatAssignment.assignSeat(agent.id, agent.seatId) : undefined;
      if (seat) {
        moveAgentToPoint(config, agent.id, seat.position, toCharacterStatus(agent.status));
      }
    },
    removeAgent(agentId) {
      if (!config.isActive()) return;
      config.movementTokens.set(agentId, (config.movementTokens.get(agentId) ?? 0) + 1);
      const character = config.characters.get(agentId);
      if (character) {
        stopCharacterTweens(config.scene, character);
        playMatrixDespawnEffect(config.scene, character.sprite, () => character.destroy());
      }
      config.characters.delete(agentId);
      config.agentTiles.delete(agentId);
      config.reservedTiles.delete(agentId);
      config.seatAssignment.releaseAgent(agentId);
    },
    setAgentStatus(agentId, status) {
      if (!config.isActive()) return;
      config.characters.get(agentId)?.setStatus(toCharacterStatus(status));
    },
    moveAgent(agentId, destination, finalDirection) {
      if (!config.isActive()) return;
      const character = config.characters.get(agentId);
      const start = config.agentTiles.get(agentId);
      if (!character || !start) return;

      const token = (config.movementTokens.get(agentId) ?? 0) + 1;
      config.movementTokens.set(agentId, token);
      moveAgentWithReplanning(config, agentId, destination, token, () => {
        if (finalDirection) {
          character.setDirection(finalDirection);
        }
      });
    },
    assignSeat(agentId, seatId) {
      if (!config.isActive()) return;
      const seat = config.seatAssignment.assignSeat(agentId, seatId ?? undefined);
      if (!seat) return;
      moveAgentToPoint(config, agentId, seat.position, 'typing');
    },
    showSpeech(agentId, message, durationMs) {
      if (!config.isActive()) return;
      const character = config.characters.get(agentId);
      if (!character) return;
      config.socialSystem.showSpeech(character.sprite, message, durationMs);
    },
  };
}

function moveAgentToPoint(
  config: OfficeSceneAgentControllerConfig,
  agentId: AgentId,
  destination: GridPoint,
  finalStatus: Character['status'],
) {
  const character = config.characters.get(agentId);
  const start = config.agentTiles.get(agentId);
  if (!character || !start) return;

  const token = (config.movementTokens.get(agentId) ?? 0) + 1;
  config.movementTokens.set(agentId, token);
  moveAgentWithReplanning(config, agentId, destination, token, () => {
    character.setStatus(finalStatus);
  });
}

function moveAgentWithReplanning(
  config: OfficeSceneAgentControllerConfig,
  agentId: AgentId,
  destination: GridPoint,
  token: number,
  onComplete?: () => void,
) {
  if (!config.isActive() || config.movementTokens.get(agentId) !== token) return;
  const character = config.characters.get(agentId);
  const current = config.agentTiles.get(agentId);
  if (!character || !current) return;

  // 이동 중에는 출발·도착 타일을 모두 유지하고 현재 걸음이 끝난 뒤 새 요청을 처리한다.
  if (config.reservedTiles.has(agentId)) {
    config.scene.time.delayedCall(REPLAN_DELAY_MS, () =>
      moveAgentWithReplanning(config, agentId, destination, token, onComplete),
    );
    return;
  }

  if (current.x === destination.x && current.y === destination.y) {
    character.setStatus('idle');
    updateCharacterDepth(character, config.characterDepth);
    gameBus.emit('agent:move-complete', { agentId, destination, completedAt: Date.now() });
    onComplete?.();
    return;
  }

  const path = config.findPathAvoidingAgents(agentId, current, destination);
  const next = path[0];
  if (!next || isOccupiedByOtherAgent(config.agentTiles, config.reservedTiles, agentId, next)) {
    character.setStatus('idle');
    config.scene.time.delayedCall(REPLAN_DELAY_MS, () =>
      moveAgentWithReplanning(config, agentId, destination, token, onComplete),
    );
    return;
  }

  stopCharacterTweens(config.scene, character);
  config.reservedTiles.set(agentId, next);
  config.scene.tweens.add({
    targets: character.sprite,
    x: tileCenter(next.x),
    y: tileBottom(next.y),
    duration: MOVE_STEP_DURATION_MS,
    onStart: () => {
      character.setDirection(next.direction);
      character.setStatus('walking');
      updateCharacterDepth(character, config.characterDepth);
    },
    onUpdate: () => updateCharacterDepth(character, config.characterDepth),
    onComplete: () => {
      if (!config.isActive() || config.characters.get(agentId) !== character) return;
      config.agentTiles.set(agentId, next);
      config.reservedTiles.delete(agentId);
      updateCharacterDepth(character, config.characterDepth);
      character.setStatus('idle');
      moveAgentWithReplanning(config, agentId, destination, token, onComplete);
    },
  });
}

function toCharacterStatus(status: AgentStatus): Character['status'] {
  if (status === 'walking') return 'walking';
  if (status === 'typing') return 'typing';
  if (status === 'sitting') return 'sitting';
  return 'idle';
}

function ensureCharacterVisible(character: Character) {
  character.sprite.setVisible(true);
  character.sprite.setAlpha(1);
  character.sprite.setTint(0xffffff);
}

function getCharacterTextureKey(agentId: AgentId) {
  let hash = 0;

  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0;
  }

  return `character:${hash % CHARACTER_COUNT}`;
}

function setOfficeObstacles(
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Group,
  blocked: Set<string>,
  obstacles: GridPoint[],
  goal: GridPoint | undefined,
  depth: number,
  seats?: GridPoint[],
) {
  group.clear(true, true);
  blocked.clear();

  obstacles.forEach((point) => {
    blocked.add(toGridKey(point));
    const obstacle = scene.add.image(tileCenter(point.x), tileBottom(point.y), 'office-obstacle-plant');
    obstacle.setOrigin(0.5, 1);
    obstacle.setDepth(getObjectDepth(point, depth));
    group.add(obstacle);
  });

  const seatPoints = seats ?? (goal ? [goal] : []);
  if (seatPoints.length === 0) return;

  seatPoints.forEach((seat) => {
    const desk = { x: seat.x + 1, y: seat.y };
    getDeskFootprint(desk).forEach((point) => blocked.add(toGridKey(point)));

    const chairSprite = scene.add.image(tileCenter(seat.x), tileBottom(seat.y), CHAIR_KEY);
    chairSprite.setOrigin(0.5, 1);
    chairSprite.setDepth(getSeatFurnitureDepth(seat, depth));
    group.add(chairSprite);

    const deskSprite = scene.add.image(tileCenter(desk.x), tileBottom(desk.y), DESK_KEY);
    deskSprite.setOrigin(0.5, 1);
    deskSprite.setDepth(getObjectDepth(desk, depth));
    group.add(deskSprite);
  });
}

function stopCharacterTweens(scene: Phaser.Scene, character: Character) {
  if (!character.sprite.scene) return;
  scene.tweens.killTweensOf(character.sprite);
}

function tileCenter(tile: number) {
  return tile * TARGET_TILE_SIZE + TARGET_TILE_SIZE / 2;
}

function tileBottom(tile: number) {
  return (tile + 1) * TARGET_TILE_SIZE;
}

function updateCharacterDepth(character: Character, baseDepth: number) {
  character.setDepth(baseDepth + character.sprite.y / 10000);
}

function getObjectDepth(point: GridPoint, baseDepth: number) {
  return baseDepth + tileBottom(point.y) / 10000;
}

function getSeatFurnitureDepth(point: GridPoint, baseDepth: number) {
  return baseDepth + (tileBottom(point.y) - SEAT_DEPTH_OFFSET_PX) / 10000;
}

function getDeskFootprint(anchor: GridPoint): GridPoint[] {
  return [
    { x: anchor.x, y: anchor.y - 1 },
    anchor,
  ];
}

function toGridKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
