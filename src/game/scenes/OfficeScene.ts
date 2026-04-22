import * as Phaser from 'phaser';

import { gameBus, startAgentSync, type AgentSyncController, type Unsubscribe } from '../../bridge/index.js';
import type { AgentId, AgentStatus, GridPoint } from '../../domain/index.js';
import { Character } from '../entities/Character.js';
import { playMatrixDespawnEffect, playMatrixSpawnEffect } from '../effects/MatrixEffect.js';
import { createPathfindingSystemFromTilemap, type PathNode } from '../systems/PathfindingSystem.js';
import { createSeatAssignmentSystemFromTilemap, type SeatAssignmentSystem } from '../systems/SeatAssignmentSystem.js';
import { SocialSystem } from '../systems/SocialSystem.js';
import { createPhaserTilemap } from '../tiled/loader.js';
import { DEMO_CHAIR_KEY, DEMO_DESK_KEY, SAMPLE_MAP_KEY } from './BootScene.js';

const TARGET_TILE_SIZE = 16;

export class OfficeScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;
  private agentSyncStop?: Unsubscribe;
  private tilesetSwitchStop?: Unsubscribe;
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
    const pathfinding = createPathfindingSystemFromTilemap(map, undefined, demoBlocked);
    const seatAssignment = createSeatAssignmentSystemFromTilemap(map);
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
    camera.setZoom(getIntegerZoom(this.scale.width, this.scale.height, worldWidth, worldHeight));

    this.fpsText = this.add.text(12, 12, 'FPS 0', {
      color: '#00ff88',
      fontFamily: 'monospace',
      fontSize: '14px',
    });
    this.fpsText.setDepth(layers.length + 1);
    this.fpsText.setScrollFactor(0);
    let isActive = true;
    this.agentSyncStop = startAgentSync(
      createOfficeSceneAgentController({
        scene: this,
        characters: this.characters,
        agentTiles: this.agentTiles,
        characterDepth: layers.length,
        seatAssignment,
        socialSystem: this.socialSystem,
        findPath: (start, goal) => pathfinding.findPath(start, goal),
        isActive: () => isActive,
      }),
    );
    const handleResize = (gameSize: Phaser.Structs.Size) => {
      camera.setZoom(getIntegerZoom(gameSize.width, gameSize.height, worldWidth, worldHeight));
      camera.centerOn(worldWidth / 2, worldHeight / 2);
    };
    const cleanup = () => {
      isActive = false;
      this.agentSyncStop?.();
      this.tilesetSwitchStop?.();
      this.demoObstacleStop?.();
      this.agentSyncStop = undefined;
      this.tilesetSwitchStop = undefined;
      this.demoObstacleStop = undefined;
      demoObstacleGroup.clear(true, true);
      demoBlocked.clear();
      this.characters.forEach((character) => stopCharacterTweens(this, character));
      this.characters.forEach((character) => character.destroy());
      this.characters.clear();
      this.agentTiles.clear();
      this.scale.off(Phaser.Scale.Events.RESIZE, handleResize);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.tilesetSwitchStop = gameBus.on('ui:tileset-selected', ({ variantId }) => {
      if (variantId === this.activeVariantId) return;
      this.scene.restart({ variantId });
    });
    const demoObstacleGroup = this.add.group();
    this.demoObstacleStop = gameBus.on('demo:obstacles-set', ({ obstacles, goal }) => {
      setDemoObstacles(this, demoObstacleGroup, demoBlocked, obstacles, goal, layers.length - 0.2);
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
  seatAssignment: SeatAssignmentSystem;
  socialSystem: SocialSystem;
  findPath(start: GridPoint, goal: GridPoint): PathNode[];
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
        textureKey: 'character:0',
        x: tileCenter(position.x),
        y: tileBottom(position.y),
        direction: agent.direction ?? 'south',
        status: toCharacterStatus(agent.status),
      });
      character.setDepth(config.characterDepth);
      playMatrixSpawnEffect(config.scene, character.sprite);
      ensureCharacterVisible(character);
      config.characters.set(agent.id, character);
      config.agentTiles.set(agent.id, position);

      const seat = config.seatAssignment.assignSeat(agent.id, agent.seatId);
      if (seat) {
        moveAgentToPoint(config, agent.id, seat.position, 'typing');
      }
    },
    removeAgent(agentId) {
      if (!config.isActive()) return;
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

      moveCharacterAlongPath(config.scene, character, config.findPath(start, destination), () => {
        config.agentTiles.set(agentId, destination);
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
  moveCharacterAlongPath(config.scene, character, config.findPath(start, destination), () => {
    config.agentTiles.set(agentId, destination);
    character.setStatus(finalStatus);
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

function setDemoObstacles(
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Group,
  blocked: Set<string>,
  obstacles: GridPoint[],
  goal: GridPoint | undefined,
  depth: number,
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
    obstacle.setDepth(depth);
    group.add(obstacle);
  });

  if (!goal) return;

  const desk = { x: goal.x + 1, y: goal.y };
  blocked.add(toGridKey(desk));

  const chairSprite = scene.add.image(tileCenter(goal.x), tileBottom(goal.y), DEMO_CHAIR_KEY);
  chairSprite.setOrigin(0.5, 1);
  chairSprite.setDepth(depth + 0.05);
  group.add(chairSprite);

  const deskSprite = scene.add.image(tileCenter(desk.x), tileBottom(desk.y), DEMO_DESK_KEY);
  deskSprite.setOrigin(0.5, 1);
  deskSprite.setDepth(depth + 0.1);
  group.add(deskSprite);
}

function getIntegerZoom(viewportWidth: number, viewportHeight: number, worldWidth: number, worldHeight: number) {
  const fitZoom = Math.min(viewportWidth / worldWidth, viewportHeight / worldHeight);
  return Math.max(1, Math.floor(fitZoom || TARGET_TILE_SIZE / TARGET_TILE_SIZE));
}

function moveCharacterAlongPath(
  scene: Phaser.Scene,
  character: Character,
  path: PathNode[],
  onComplete?: () => void,
) {
  stopCharacterTweens(scene, character);

  if (path.length === 0) {
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
    },
  }));

  scene.tweens.chain({
    tweens,
    onComplete: () => {
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

function toGridKey(point: GridPoint) {
  return `${point.x}:${point.y}`;
}
