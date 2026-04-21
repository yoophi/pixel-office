import * as Phaser from 'phaser';

import { gameBus, startAgentSync, type AgentSyncController, type Unsubscribe } from '../../bridge/index.js';
import type { Agent, AgentId, AgentStatus, GridPoint } from '../../domain/index.js';
import { Character } from '../entities/Character.js';
import { createPathfindingSystemFromTilemap, type PathNode } from '../systems/PathfindingSystem.js';
import { createPhaserTilemap } from '../tiled/loader.js';
import { SAMPLE_MAP_KEY } from './BootScene.js';

const TARGET_TILE_SIZE = 16;

export class OfficeScene extends Phaser.Scene {
  private fpsText?: Phaser.GameObjects.Text;
  private agentSyncStop?: Unsubscribe;
  private readonly characters = new Map<AgentId, Character>();
  private readonly agentTiles = new Map<AgentId, GridPoint>();

  constructor() {
    super('OfficeScene');
  }

  create() {
    const { map, layers } = createPhaserTilemap(this, {
      mapKey: SAMPLE_MAP_KEY,
    });
    const pathfinding = createPathfindingSystemFromTilemap(map);

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
    this.agentSyncStop = startAgentSync(
      createOfficeSceneAgentController({
        scene: this,
        characters: this.characters,
        agentTiles: this.agentTiles,
        characterDepth: layers.length,
        findPath: (start, goal) => pathfinding.findPath(start, goal),
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.agentSyncStop?.();
      this.agentSyncStop = undefined;
    });
    emitSampleAgentEvents();

    this.scale.on(Phaser.Scale.Events.RESIZE, (gameSize: Phaser.Structs.Size) => {
      camera.setZoom(getIntegerZoom(gameSize.width, gameSize.height, worldWidth, worldHeight));
      camera.centerOn(worldWidth / 2, worldHeight / 2);
    });
  }

  update() {
    if (!this.fpsText) return;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }
}

interface OfficeSceneAgentControllerConfig {
  scene: Phaser.Scene;
  characters: Map<AgentId, Character>;
  agentTiles: Map<AgentId, GridPoint>;
  characterDepth: number;
  findPath(start: GridPoint, goal: GridPoint): PathNode[];
}

function createOfficeSceneAgentController(config: OfficeSceneAgentControllerConfig): AgentSyncController {
  return {
    upsertAgent(agent) {
      const position = agent.position ?? { x: 3, y: 3 };
      const existing = config.characters.get(agent.id);
      if (existing) {
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
      config.characters.set(agent.id, character);
      config.agentTiles.set(agent.id, position);
    },
    removeAgent(agentId) {
      config.characters.get(agentId)?.destroy();
      config.characters.delete(agentId);
      config.agentTiles.delete(agentId);
    },
    setAgentStatus(agentId, status) {
      config.characters.get(agentId)?.setStatus(toCharacterStatus(status));
    },
    moveAgent(agentId, destination) {
      const character = config.characters.get(agentId);
      const start = config.agentTiles.get(agentId);
      if (!character || !start) return;

      moveCharacterAlongPath(config.scene, character, config.findPath(start, destination), () => {
        config.agentTiles.set(agentId, destination);
      });
    },
    assignSeat() {},
    showSpeech(agentId, message, durationMs) {
      const character = config.characters.get(agentId);
      if (!character) return;

      const text = config.scene.add.text(character.sprite.x, character.sprite.y - 40, message, {
        backgroundColor: '#111827',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: { x: 4, y: 2 },
      });
      text.setOrigin(0.5, 1);
      text.setDepth(character.sprite.depth + 1);
      config.scene.time.delayedCall(durationMs, () => text.destroy());
    },
  };
}

function emitSampleAgentEvents() {
  const now = Date.now();
  const agent: Agent = {
    id: 'sample-agent',
    name: 'Sample Agent',
    status: 'idle',
    direction: 'south',
    position: { x: 3, y: 3 },
    updatedAt: now,
  };

  gameBus.emit('agent:event', { type: 'agent:upsert', agent });
  gameBus.emit('agent:event', {
    type: 'agent:move',
    agentId: agent.id,
    destination: { x: 16, y: 8 },
    updatedAt: now + 1,
  });
  gameBus.emit('agent:event', {
    type: 'agent:say',
    agentId: agent.id,
    message: 'building',
    durationMs: 1800,
    updatedAt: now + 2,
  });
}

function toCharacterStatus(status: AgentStatus): Character['status'] {
  if (status === 'walking') return 'walking';
  if (status === 'typing') return 'typing';
  if (status === 'sitting') return 'sitting';
  return 'idle';
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

function tileCenter(tile: number) {
  return tile * TARGET_TILE_SIZE + TARGET_TILE_SIZE / 2;
}

function tileBottom(tile: number) {
  return (tile + 1) * TARGET_TILE_SIZE;
}
