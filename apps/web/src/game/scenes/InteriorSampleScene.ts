import * as Phaser from 'phaser';
import { Character, preloadCharacterAssets } from '../entities/Character.js';
import { interiorSheets } from '../assets/interiorAssets.js';

export const INTERIOR_SAMPLE_SIZE = { width: 480, height: 304 };
const frames = {
  floor: ['Home/TilesHouse', 32, 144, 16, 16],
  clinicFloor: ['Hospital/TilesHospital', 48, 160, 16, 16],
  wall: ['Home/TilesHouse', 16, 0, 32, 64],
  table: ['Home/LivingRoom-Sheet', 24, 14, 48, 32],
  sofa: ['Home/LivingRoom1-Sheet', 24, 16, 48, 32],
  sofaSide: ['Home/LivingRoom1-Sheet', 232, 0, 16, 48],
  books: ['Home/Cupboard-Sheet', 200, 8, 48, 64],
  cabinet: ['Home/Cupboard-Sheet', 72, 16, 48, 32],
  plant: ['Home/Flowers-Sheet', 16, 0, 32, 48],
  flower: ['Home/Flowers-Sheet', 80, 16, 32, 32],
  sink: ['Home/Kitchen-Sheet', 120, 16, 48, 48],
  cooker: ['Home/Kitchen-Sheet', 600, 16, 48, 48],
  fridge: ['Home/Kitchen-Sheet', 992, 0, 32, 48],
  bed: ['Home/Beds-Sheet', 16, 0, 32, 64],
} as const;
type FrameName = keyof typeof frames;

export class InteriorSampleScene extends Phaser.Scene {
  constructor() { super('InteriorSample'); }

  preload() {
    preloadCharacterAssets(this);
    const sheets = new Set<string>(Object.values(frames).map(([sheet]) => sheet));
    interiorSheets.forEach((sheet) => {
      if (sheets.has(sheet.id)) this.load.image(sheet.id, sheet.url);
    });
  }

  create() {
    Object.entries(frames).forEach(([name, [sheet, x, y, width, height]]) => {
      if (!this.textures.get(sheet).has(name)) this.textures.get(sheet).add(name, 0, x, y, width, height);
    });
    const place = (name: FrameName, x: number, y: number) => {
      const [sheet, , , , height] = frames[name];
      return this.add.image(x, y, sheet, name).setOrigin(0).setDepth(y + height);
    };
    for (let room = 0; room < 3; room++) {
      const left = room * 160;
      for (let y = 32; y < 288; y += 16) {
        for (let x = left; x < left + 160; x += 16) {
          place(room === 2 ? 'clinicFloor' : 'floor', x, y).setDepth(-10);
        }
      }
      for (let x = left; x < left + 160; x += 32) place('wall', x, 32).setDepth(-5);
      this.add.text(left + 16, 10, ['라운지', '탕비실', '휴게실'][room], {
        fontFamily: 'Galmuri11', fontSize: '12px', color: '#eed7a5',
      }).setResolution(1);
      this.add.rectangle(left, 32, 3, 256, 0x51371f).setOrigin(0).setDepth(400);
    }
    place('books', 16, 60);
    place('plant', 120, 72);
    place('sofa', 56, 120);
    place('table', 56, 170);
    place('sofaSide', 24, 158);
    place('cabinet', 16, 244);
    place('flower', 120, 242);
    place('sink', 168, 80);
    place('cooker', 212, 80);
    place('fridge', 276, 82);
    place('table', 208, 178);
    place('cabinet', 176, 246);
    place('plant', 276, 238);
    place('bed', 336, 108);
    place('bed', 416, 108);
    place('cabinet', 368, 228);
    place('flower', 432, 242);
    const characters = [[106, 220], [264, 164], [392, 194]].map(([x, y], index) => {
      const character = new Character(this, {
        id: `interior-sample-${index}`, textureKey: `character:${index}`, x, y, status: 'idle',
      });
      character.setDepth(y);
      return character;
    });
    this.resizeCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
      characters.forEach((character) => character.destroy());
    });
  }

  private resizeCamera() {
    this.cameras.main.setZoom(this.scale.width / INTERIOR_SAMPLE_SIZE.width);
    this.cameras.main.centerOn(INTERIOR_SAMPLE_SIZE.width / 2, INTERIOR_SAMPLE_SIZE.height / 2);
    this.cameras.main.roundPixels = true;
  }
}
