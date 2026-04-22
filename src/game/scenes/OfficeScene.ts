import * as Phaser from 'phaser';

import { gameBus, startAgentSync, type AgentSyncController, type Unsubscribe } from '../../bridge/index.js';
import {
  DEFAULT_VIEW_ZOOM,
  resolvePixelScale,
  VIEW_ZOOM_REGISTRY_KEY,
  type AgentId,
  type AgentStatus,
  type GridPoint,
  type ViewZoom,
} from '../../domain/index.js';
import { Character, CHARACTER_COUNT } from '../entities/Character.js';
import { playMatrixDespawnEffect, playMatrixSpawnEffect } from '../effects/MatrixEffect.js';
import { createPathfindingSystemFromTilemap, type PathNode } from '../systems/PathfindingSystem.js';
import { createSeatAssignmentSystemFromTilemap, type SeatAssignmentSystem } from '../systems/SeatAssignmentSystem.js';
import { SocialSystem } from '../systems/SocialSystem.js';
import { createPhaserTilemap } from '../tiled/loader.js';
import { DEMO_CHAIR_KEY, DEMO_DESK_KEY, SAMPLE_MAP_KEY } from './BootScene.js';

const TARGET_TILE_SIZE = 16;
const MOVE_STEP_DURATION_MS = 220;
const REPLAN_DELAY_MS = 360;
const SEAT_DEPTH_OFFSET_PX = 0.5;

export class OfficeScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;
  private agentSyncStop?: Unsubscribe;
  private tilesetSwitchStop?: Unsubscribe;
  private zoomChangeStop?: Unsubscribe;
  private demoObstacleStop?: Unsubscribe;
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
    const demoBlocked = new Set<string>();
    const isDemoBlocked = (point: GridPoint) => demoBlocked.has(toGridKey(point));
    const pathfinding = createPathfindingSystemFromTilemap(map, undefined, isDemoBlocked);
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

    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: '"Galmuri11", monospace',
      fontSize: '11px',
    });
    this.fpsText.setResolution(Math.max(1, Math.ceil((this.cameras.main?.zoom ?? 1) * (window.devicePixelRatio || 1))));
    this.fpsText.setDepth(layers.length + 1);
    this.fpsText.setScrollFactor(0);
    let isActive = true;
    this.agentSyncStop = startAgentSync(
      createOfficeSceneAgentController({
        scene: this,
        characters: this.characters,
        agentTiles: this.agentTiles,
        characterDepth: layers.length,
        movementTokens,
        seatAssignment,
        socialSystem: this.socialSystem,
        findPath: (start, goal) => pathfinding.findPath(start, goal),
        findPathAvoidingAgents: (agentId, start, goal) =>
          createPathfindingSystemFromTilemap(map, undefined, (point) =>
            isDemoBlocked(point) || isOccupiedByOtherAgent(this.agentTiles, agentId, start, goal, point),
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
      this.agentSyncStop?.();
      this.tilesetSwitchStop?.();
      this.zoomChangeStop?.();
      this.demoObstacleStop?.();
      this.agentSyncStop = undefined;
      this.tilesetSwitchStop = undefined;
      this.zoomChangeStop = undefined;
      this.demoObstacleStop = undefined;
      demoObstacleGroup.clear(true, true);
      demoBlocked.clear();
      this.characters.forEach((character) => stopCharacterTweens(this, character));
      this.characters.forEach((character) => character.destroy());
      this.characters.clear();
      this.agentTiles.clear();
      movementTokens.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.tilesetSwitchStop = gameBus.on('ui:tileset-selected', ({ variantId }) => {
      if (variantId === this.activeVariantId) return;
      this.scene.restart({ variantId });
    });
    this.zoomChangeStop = gameBus.on('ui:zoom-changed', ({ scale }) => {
      applyZoom(scale);
    });
    const demoObstacleGroup = this.add.group();
    this.demoObstacleStop = gameBus.on('demo:obstacles-set', ({ obstacles, goal, seats }) => {
      setDemoObstacles(this, demoObstacleGroup, demoBlocked, obstacles, goal, layers.length, seats);
    });
    gameBus.emit('game:ready', { readyAt: Date.now() });

    this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
  }

  update() {
    if (!this.fpsText) return;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
    this.socialSystem?.update();
  }
}

interface OfficeSceneAgentControllerConfig {
  scene: Phaser.Scene;
  characters: Map<AgentId, Character>;
  agentTiles: Map<AgentId, GridPoint>;
  characterDepth: number;
  movementTokens: Map<AgentId, number>;
  seatAssignment: SeatAssignmentSystem;
  socialSystem: SocialSystem;
  findPath(start: GridPoint, goal: GridPoint): PathNode[];
  findPathAvoidingAgents(agentId: AgentId, start: GridPoint, goal: GridPoint): PathNode[];
  isActive(): boolean;
}

function createOfficeSceneAgentController(config: OfficeSceneAgentControllerConfig): AgentSyncController {
  return {
    upsertAgent(agent) {
      if (!config.isActive()) return;
      const position = agent.position ?? { x: 3, y: 3 };
      const existing = config.characters.get(agent.id);
      if (existing) {
        ensureCharacterVisible(existing);
        existing.setDirection(agent.direction ?? existing.direction);
        existing.setStatus(toCharacterStatus(agent.status));
        config.agentTiles.set(agent.id, position);
        return;
      }

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

      const seat = shouldAutoAssignSeat(agent.id) ? config.seatAssignment.assignSeat(agent.id, agent.seatId) : undefined;
      if (seat) {
        moveAgentToPoint(config, agent.id, seat.position, 'typing');
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

  stopCharacterTweens(config.scene, character);
  config.movementTokens.set(agentId, (config.movementTokens.get(agentId) ?? 0) + 1);
  moveCharacterAlongPath(config.scene, character, config.findPath(start, destination), config.characterDepth, () => {
    config.agentTiles.set(agentId, destination);
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

  if (current.x === destination.x && current.y === destination.y) {
    character.setStatus('idle');
    updateCharacterDepth(character, config.characterDepth);
    gameBus.emit('agent:move-complete', { agentId, destination, completedAt: Date.now() });
    onComplete?.();
    return;
  }

  const path = config.findPathAvoidingAgents(agentId, current, destination);
  const next = path[0];
  if (!next || isOccupiedByOtherAgent(config.agentTiles, agentId, current, destination, next)) {
    character.setStatus('idle');
    config.scene.time.delayedCall(REPLAN_DELAY_MS, () =>
      moveAgentWithReplanning(config, agentId, destination, token, onComplete),
    );
    return;
  }

  stopCharacterTweens(config.scene, character);
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
      config.agentTiles.set(agentId, next);
      updateCharacterDepth(character, config.characterDepth);
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

function shouldAutoAssignSeat(agentId: AgentId) {
  return !agentId.startsWith('demo-');
}

function getCharacterTextureKey(agentId: AgentId) {
  let hash = 0;

  for (let index = 0; index < agentId.length; index += 1) {
    hash = (hash * 31 + agentId.charCodeAt(index)) >>> 0;
  }

  return `character:${hash % CHARACTER_COUNT}`;
}

function setDemoObstacles(
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
    const obstacle = scene.add.rectangle(
      tileCenter(point.x),
      tileCenter(point.y),
      TARGET_TILE_SIZE,
      TARGET_TILE_SIZE,
      0x73513a,
      0.92,
    );
    obstacle.setStrokeStyle(1, 0xf0c48b, 0.38);
    obstacle.setDepth(getObjectDepth(point, depth));
    group.add(obstacle);
  });

  const seatPoints = seats ?? (goal ? [goal] : []);
  if (seatPoints.length === 0) return;

  seatPoints.forEach((seat) => {
    const desk = { x: seat.x + 1, y: seat.y };
    getDeskFootprint(desk).forEach((point) => blocked.add(toGridKey(point)));

    const chairSprite = scene.add.image(tileCenter(seat.x), tileBottom(seat.y), DEMO_CHAIR_KEY);
    chairSprite.setOrigin(0.5, 1);
    chairSprite.setDepth(getSeatFurnitureDepth(seat, depth));
    group.add(chairSprite);

    const deskSprite = scene.add.image(tileCenter(desk.x), tileBottom(desk.y), DEMO_DESK_KEY);
    deskSprite.setOrigin(0.5, 1);
    deskSprite.setDepth(getObjectDepth(desk, depth));
    group.add(deskSprite);
  });
}

function moveCharacterAlongPath(
  scene: Phaser.Scene,
  character: Character,
  path: PathNode[],
  characterDepth: number,
  onComplete?: () => void,
) {
  stopCharacterTweens(scene, character);

  if (path.length === 0) {
    updateCharacterDepth(character, characterDepth);
    character.setStatus('typing');
    onComplete?.();
    return;
  }

  const tweens = path.map((node, index) => ({
    targets: character.sprite,
    x: tileCenter(node.x),
    y: tileBottom(node.y),
    duration: index === 0 ? 0 : 220,
    onStart: () => {
      character.setDirection(node.direction);
      character.setStatus('walking');
      updateCharacterDepth(character, characterDepth);
    },
    onUpdate: () => updateCharacterDepth(character, characterDepth),
  }));

  scene.tweens.chain({
    tweens,
    onComplete: () => {
      updateCharacterDepth(character, characterDepth);
      character.setStatus('typing');
      onComplete?.();
    },
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

function isOccupiedByOtherAgent(
  agentTiles: ReadonlyMap<AgentId, GridPoint>,
  movingAgentId: AgentId,
  start: GridPoint,
  goal: GridPoint,
  point: GridPoint,
) {
  if (point.x === start.x && point.y === start.y) return false;
  if (point.x === goal.x && point.y === goal.y) return false;

  for (const [agentId, occupied] of agentTiles) {
    if (agentId !== movingAgentId && occupied.x === point.x && occupied.y === point.y) {
      return true;
    }
  }

  return false;
}
