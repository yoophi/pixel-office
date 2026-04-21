export type SeatId = string;

export interface GridPoint {
  x: number;
  y: number;
}

export interface Seat {
  id: SeatId;
  position: GridPoint;
  facing: 'north' | 'east' | 'south' | 'west';
  occupiedBy?: string;
}

export interface TilesetVariant {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Office {
  id: string;
  width: number;
  height: number;
  tileSize: number;
  spawnPoints: GridPoint[];
  seats: Seat[];
  tilesetVariants: TilesetVariant[];
  activeTilesetVariantId: string;
}
