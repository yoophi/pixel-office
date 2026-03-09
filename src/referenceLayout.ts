import type { OfficeLayout, PlacedFurniture } from './office/types.js';

function createReferenceFurniture(): PlacedFurniture[] {
  return [
    { uid: 'wall-board-top', type: 'whiteboard', col: 5, row: 1 },
    { uid: 'shelf-top-left', type: 'bookshelf', col: 4, row: 3 },
    { uid: 'shelf-top-right', type: 'bookshelf', col: 8, row: 3 },
    { uid: 'plant-top', type: 'plant', col: 4, row: 6 },

    { uid: 'desk-main-a', type: 'desk', col: 1, row: 11 },
    { uid: 'desk-main-b', type: 'desk', col: 6, row: 11 },
    { uid: 'desk-main-c', type: 'desk', col: 1, row: 16 },
    { uid: 'desk-main-d', type: 'desk', col: 6, row: 16 },
    { uid: 'chair-main-a', type: 'chair', col: 2, row: 13 },
    { uid: 'chair-main-b', type: 'chair', col: 7, row: 13 },
    { uid: 'chair-main-c', type: 'chair', col: 2, row: 18 },
    { uid: 'chair-main-d', type: 'chair', col: 7, row: 18 },
    { uid: 'pc-main-a', type: 'pc', col: 1, row: 11 },
    { uid: 'pc-main-b', type: 'pc', col: 6, row: 11 },
    { uid: 'pc-main-c', type: 'pc', col: 1, row: 16 },
    { uid: 'pc-main-d', type: 'pc', col: 6, row: 16 },
    { uid: 'lamp-main-a', type: 'lamp', col: 2, row: 11 },
    { uid: 'lamp-main-b', type: 'lamp', col: 7, row: 11 },
    { uid: 'plant-main-left', type: 'plant', col: 1, row: 19 },
    { uid: 'plant-main-right', type: 'plant', col: 10, row: 19 },

    { uid: 'break-shelf-left', type: 'bookshelf', col: 12, row: 11 },
    { uid: 'break-shelf-right', type: 'bookshelf', col: 18, row: 11 },
    { uid: 'break-cooler', type: 'cooler', col: 15, row: 11 },
    { uid: 'break-plant', type: 'plant', col: 17, row: 14 },

    { uid: 'lounge-shelf-left', type: 'bookshelf', col: 13, row: 16 },
    { uid: 'lounge-shelf-right', type: 'bookshelf', col: 18, row: 16 },
    { uid: 'lounge-plant-left', type: 'plant', col: 15, row: 16 },
    { uid: 'lounge-plant-right', type: 'plant', col: 19, row: 19 },
    { uid: 'lounge-table', type: 'desk', col: 15, row: 18 },
    { uid: 'lounge-chair-left', type: 'chair', col: 14, row: 18 },
    { uid: 'lounge-chair-right', type: 'chair', col: 17, row: 18 },
    { uid: 'lounge-lamp', type: 'lamp', col: 15, row: 18 },
  ];
}

export function normalizeReferenceLayout(layout: OfficeLayout): OfficeLayout {
  const hasExternalAssetFurniture = layout.furniture.some((item) => item.type.startsWith('ASSET_'));
  if (!hasExternalAssetFurniture) return layout;
  return {
    ...layout,
    furniture: createReferenceFurniture(),
  };
}
