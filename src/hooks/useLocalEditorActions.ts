import { useCallback, useRef, useState } from 'react';

import { LAYOUT_SAVE_DEBOUNCE_MS, ZOOM_MAX, ZOOM_MIN } from '../constants.js';
import type { ExpandDirection } from '../office/editor/editorActions.js';
import {
  canPlaceFurniture,
  expandLayout,
  getWallPlacementRow,
  moveFurniture,
  paintTile,
  placeFurniture,
  removeFurniture,
  rotateFurniture,
  toggleFurnitureState,
} from '../office/editor/editorActions.js';
import type { EditorState } from '../office/editor/editorState.js';
import type { OfficeState } from '../office/engine/officeState.js';
import {
  getCatalogEntry,
  getRotatedType,
  getToggledType,
} from '../office/layout/furnitureCatalog.js';
import { defaultZoom } from '../office/toolUtils.js';
import type {
  EditTool as EditToolType,
  FloorColor,
  OfficeLayout,
  PlacedFurniture,
  TileType as TileTypeVal,
} from '../office/types.js';
import { EditTool, TileType } from '../office/types.js';

export interface LocalEditorActions {
  isEditMode: boolean;
  editorTick: number;
  isDirty: boolean;
  zoom: number;
  panRef: React.MutableRefObject<{ x: number; y: number }>;
  setSavedLayout: (layout: OfficeLayout) => void;
  handleToggleEditMode: () => void;
  handleToolChange: (tool: EditToolType) => void;
  handleTileTypeChange: (type: TileTypeVal) => void;
  handleFloorColorChange: (color: FloorColor) => void;
  handleWallColorChange: (color: FloorColor) => void;
  handleSelectedFurnitureColorChange: (color: FloorColor | null) => void;
  handleFurnitureTypeChange: (type: string) => void;
  handleDeleteSelected: () => void;
  handleRotateSelected: () => void;
  handleToggleState: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleReset: () => void;
  handleSave: () => void;
  handleZoomChange: (zoom: number) => void;
  handleEditorTileAction: (col: number, row: number) => void;
  handleEditorEraseAction: (col: number, row: number) => void;
  handleEditorSelectionChange: () => void;
  handleDragMove: (uid: string, newCol: number, newRow: number) => void;
}

export function useLocalEditorActions(
  getOfficeState: () => OfficeState,
  editorState: EditorState,
  storageKey: string,
): LocalEditorActions {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editorTick, setEditorTick] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [zoom, setZoom] = useState(defaultZoom);
  const panRef = useRef({ x: 0, y: 0 });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedLayoutRef = useRef<OfficeLayout>(structuredClone(getOfficeState().getLayout()));
  const colorEditUidRef = useRef<string | null>(null);
  const wallColorEditActiveRef = useRef(false);

  const setSavedLayout = useCallback((layout: OfficeLayout) => {
    lastSavedLayoutRef.current = structuredClone(layout);
    editorState.isDirty = false;
    setIsDirty(false);
  }, [editorState]);

  const persistLayout = useCallback(
    (layout: OfficeLayout) => {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    },
    [storageKey],
  );

  const queueSave = useCallback(
    (layout: OfficeLayout) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        persistLayout(layout);
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [persistLayout],
  );

  const applyEdit = useCallback(
    (newLayout: OfficeLayout) => {
      const os = getOfficeState();
      editorState.pushUndo(os.getLayout());
      editorState.clearRedo();
      editorState.isDirty = true;
      setIsDirty(true);
      os.rebuildFromLayout(newLayout);
      queueSave(newLayout);
      setEditorTick((tick) => tick + 1);
    },
    [editorState, getOfficeState, queueSave],
  );

  const handleToggleEditMode = useCallback(() => {
    setIsEditMode((prev) => {
      const next = !prev;
      editorState.isEditMode = next;
      if (next) {
        const layout = getOfficeState().getLayout();
        if (layout.tileColors) {
          for (let i = 0; i < layout.tiles.length; i++) {
            if (layout.tiles[i] === TileType.WALL && layout.tileColors[i]) {
              editorState.wallColor = { ...layout.tileColors[i]! };
              break;
            }
          }
        }
      } else {
        editorState.clearSelection();
        editorState.clearGhost();
        editorState.clearDrag();
        wallColorEditActiveRef.current = false;
      }
      return next;
    });
  }, [editorState, getOfficeState]);

  const handleToolChange = useCallback(
    (tool: EditToolType) => {
      editorState.activeTool = editorState.activeTool === tool ? EditTool.SELECT : tool;
      editorState.clearSelection();
      editorState.clearGhost();
      editorState.clearDrag();
      colorEditUidRef.current = null;
      wallColorEditActiveRef.current = false;
      setEditorTick((tick) => tick + 1);
    },
    [editorState],
  );

  const handleTileTypeChange = useCallback(
    (type: TileTypeVal) => {
      editorState.selectedTileType = type;
      setEditorTick((tick) => tick + 1);
    },
    [editorState],
  );

  const handleFloorColorChange = useCallback(
    (color: FloorColor) => {
      editorState.floorColor = color;
      setEditorTick((tick) => tick + 1);
    },
    [editorState],
  );

  const handleWallColorChange = useCallback(
    (color: FloorColor) => {
      editorState.wallColor = color;
      const os = getOfficeState();
      const layout = os.getLayout();
      const existingColors = layout.tileColors || new Array(layout.tiles.length).fill(null);
      const nextColors = [...existingColors];
      let changed = false;

      for (let i = 0; i < layout.tiles.length; i++) {
        if (layout.tiles[i] === TileType.WALL) {
          nextColors[i] = { ...color };
          changed = true;
        }
      }

      if (changed) {
        if (!wallColorEditActiveRef.current) {
          editorState.pushUndo(layout);
          editorState.clearRedo();
          wallColorEditActiveRef.current = true;
        }
        const newLayout = { ...layout, tileColors: nextColors };
        editorState.isDirty = true;
        setIsDirty(true);
        os.rebuildFromLayout(newLayout);
        queueSave(newLayout);
      }

      setEditorTick((tick) => tick + 1);
    },
    [editorState, getOfficeState, queueSave],
  );

  const handleSelectedFurnitureColorChange = useCallback(
    (color: FloorColor | null) => {
      const uid = editorState.selectedFurnitureUid;
      if (!uid) return;
      const os = getOfficeState();
      const layout = os.getLayout();

      if (colorEditUidRef.current !== uid) {
        editorState.pushUndo(layout);
        editorState.clearRedo();
        colorEditUidRef.current = uid;
      }

      const furniture = layout.furniture.map((item) =>
        item.uid === uid ? { ...item, color: color ?? undefined } : item,
      );
      const newLayout = { ...layout, furniture };
      editorState.isDirty = true;
      setIsDirty(true);
      os.rebuildFromLayout(newLayout);
      queueSave(newLayout);
      setEditorTick((tick) => tick + 1);
    },
    [editorState, getOfficeState, queueSave],
  );

  const handleFurnitureTypeChange = useCallback(
    (type: string) => {
      if (editorState.selectedFurnitureType === type) {
        editorState.selectedFurnitureType = '';
        editorState.clearGhost();
      } else {
        editorState.selectedFurnitureType = type;
      }
      setEditorTick((tick) => tick + 1);
    },
    [editorState],
  );

  const handleDeleteSelected = useCallback(() => {
    const uid = editorState.selectedFurnitureUid;
    if (!uid) return;
    const os = getOfficeState();
    const newLayout = removeFurniture(os.getLayout(), uid);
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout);
      editorState.clearSelection();
      colorEditUidRef.current = null;
    }
  }, [applyEdit, editorState, getOfficeState]);

  const handleRotateSelected = useCallback(() => {
    if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
      const rotated = getRotatedType(editorState.selectedFurnitureType, 'cw');
      if (rotated) {
        editorState.selectedFurnitureType = rotated;
        setEditorTick((tick) => tick + 1);
      }
      return;
    }

    const uid = editorState.selectedFurnitureUid;
    if (!uid) return;
    const os = getOfficeState();
    const newLayout = rotateFurniture(os.getLayout(), uid, 'cw');
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout);
    }
  }, [applyEdit, editorState, getOfficeState]);

  const handleToggleState = useCallback(() => {
    if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
      const toggled = getToggledType(editorState.selectedFurnitureType);
      if (toggled) {
        editorState.selectedFurnitureType = toggled;
        setEditorTick((tick) => tick + 1);
      }
      return;
    }

    const uid = editorState.selectedFurnitureUid;
    if (!uid) return;
    const os = getOfficeState();
    const newLayout = toggleFurnitureState(os.getLayout(), uid);
    if (newLayout !== os.getLayout()) {
      applyEdit(newLayout);
    }
  }, [applyEdit, editorState, getOfficeState]);

  const handleUndo = useCallback(() => {
    const prev = editorState.popUndo();
    if (!prev) return;
    const os = getOfficeState();
    editorState.pushRedo(os.getLayout());
    os.rebuildFromLayout(prev);
    queueSave(prev);
    editorState.isDirty = true;
    setIsDirty(true);
    setEditorTick((tick) => tick + 1);
  }, [editorState, getOfficeState, queueSave]);

  const handleRedo = useCallback(() => {
    const next = editorState.popRedo();
    if (!next) return;
    const os = getOfficeState();
    editorState.pushUndo(os.getLayout());
    os.rebuildFromLayout(next);
    queueSave(next);
    editorState.isDirty = true;
    setIsDirty(true);
    setEditorTick((tick) => tick + 1);
  }, [editorState, getOfficeState, queueSave]);

  const handleReset = useCallback(() => {
    const saved = structuredClone(lastSavedLayoutRef.current);
    const os = getOfficeState();
    os.rebuildFromLayout(saved);
    editorState.reset();
    setIsDirty(false);
    setEditorTick((tick) => tick + 1);
  }, [editorState, getOfficeState]);

  const handleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const layout = getOfficeState().getLayout();
    lastSavedLayoutRef.current = structuredClone(layout);
    persistLayout(layout);
    editorState.isDirty = false;
    setIsDirty(false);
  }, [editorState, getOfficeState, persistLayout]);

  const handleEditorSelectionChange = useCallback(() => {
    colorEditUidRef.current = null;
    setEditorTick((tick) => tick + 1);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom)));
  }, []);

  const handleDragMove = useCallback(
    (uid: string, newCol: number, newRow: number) => {
      const os = getOfficeState();
      const layout = os.getLayout();
      const newLayout = moveFurniture(layout, uid, newCol, newRow);
      if (newLayout !== layout) {
        applyEdit(newLayout);
      }
    },
    [applyEdit, getOfficeState],
  );

  const maybeExpand = useCallback(
    (
      layout: OfficeLayout,
      col: number,
      row: number,
    ): { layout: OfficeLayout; col: number; row: number; shift: { col: number; row: number } } | null => {
      if (col >= 0 && col < layout.cols && row >= 0 && row < layout.rows) {
        return null;
      }

      const directions: ExpandDirection[] = [];
      if (col < 0) directions.push('left');
      if (col >= layout.cols) directions.push('right');
      if (row < 0) directions.push('up');
      if (row >= layout.rows) directions.push('down');

      let current = layout;
      let shiftCol = 0;
      let shiftRow = 0;

      for (const direction of directions) {
        const expanded = expandLayout(current, direction);
        if (!expanded) return null;
        current = expanded.layout;
        shiftCol += expanded.shift.col;
        shiftRow += expanded.shift.row;
      }

      return {
        layout: current,
        col: col + shiftCol,
        row: row + shiftRow,
        shift: { col: shiftCol, row: shiftRow },
      };
    },
    [],
  );

  const handleEditorTileAction = useCallback(
    (col: number, row: number) => {
      const os = getOfficeState();
      let layout = os.getLayout();
      let effectiveCol = col;
      let effectiveRow = row;

      if (
        editorState.activeTool === EditTool.TILE_PAINT ||
        editorState.activeTool === EditTool.WALL_PAINT
      ) {
        const expanded = maybeExpand(layout, col, row);
        if (expanded) {
          layout = expanded.layout;
          effectiveCol = expanded.col;
          effectiveRow = expanded.row;
          os.rebuildFromLayout(layout, expanded.shift);
        }
      }

      if (editorState.activeTool === EditTool.TILE_PAINT) {
        const newLayout = paintTile(
          layout,
          effectiveCol,
          effectiveRow,
          editorState.selectedTileType,
          editorState.floorColor,
        );
        if (newLayout !== layout) {
          applyEdit(newLayout);
        }
        return;
      }

      if (editorState.activeTool === EditTool.WALL_PAINT) {
        const idx = effectiveRow * layout.cols + effectiveCol;
        const isWall = layout.tiles[idx] === TileType.WALL;

        if (editorState.wallDragAdding === null) {
          editorState.wallDragAdding = !isWall;
        }

        const newLayout = editorState.wallDragAdding
          ? paintTile(layout, effectiveCol, effectiveRow, TileType.WALL, editorState.wallColor)
          : isWall
            ? paintTile(
                layout,
                effectiveCol,
                effectiveRow,
                editorState.selectedTileType,
                editorState.floorColor,
              )
            : layout;

        if (newLayout !== layout) {
          applyEdit(newLayout);
        }
        return;
      }

      if (editorState.activeTool === EditTool.ERASE) {
        if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return;
        const idx = row * layout.cols + col;
        if (layout.tiles[idx] === TileType.VOID) return;
        const newLayout = paintTile(layout, col, row, TileType.VOID);
        if (newLayout !== layout) {
          applyEdit(newLayout);
        }
        return;
      }

      if (editorState.activeTool === EditTool.FURNITURE_PLACE) {
        const type = editorState.selectedFurnitureType;
        if (type === '') {
          const hit = layout.furniture.find((item) => {
            const entry = getCatalogEntry(item.type);
            if (!entry) return false;
            return (
              col >= item.col &&
              col < item.col + entry.footprintW &&
              row >= item.row &&
              row < item.row + entry.footprintH
            );
          });
          editorState.selectedFurnitureUid = hit ? hit.uid : null;
          setEditorTick((tick) => tick + 1);
          return;
        }

        const placementRow = getWallPlacementRow(type, row);
        if (!canPlaceFurniture(layout, type, col, placementRow)) return;
        const uid = `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const placed: PlacedFurniture = { uid, type, col, row: placementRow };
        if (editorState.pickedFurnitureColor) {
          placed.color = { ...editorState.pickedFurnitureColor };
        }
        const newLayout = placeFurniture(layout, placed);
        if (newLayout !== layout) {
          applyEdit(newLayout);
        }
        return;
      }

      if (editorState.activeTool === EditTool.FURNITURE_PICK) {
        const hit = layout.furniture.find((item) => {
          const entry = getCatalogEntry(item.type);
          if (!entry) return false;
          return (
            col >= item.col &&
            col < item.col + entry.footprintW &&
            row >= item.row &&
            row < item.row + entry.footprintH
          );
        });
        if (hit) {
          editorState.selectedFurnitureType = hit.type;
          editorState.pickedFurnitureColor = hit.color ? { ...hit.color } : null;
          editorState.activeTool = EditTool.FURNITURE_PLACE;
        }
        setEditorTick((tick) => tick + 1);
        return;
      }

      if (editorState.activeTool === EditTool.EYEDROPPER) {
        const idx = row * layout.cols + col;
        const tile = layout.tiles[idx];
        if (tile !== undefined && tile !== TileType.WALL && tile !== TileType.VOID) {
          editorState.selectedTileType = tile;
          const color = layout.tileColors?.[idx];
          if (color) {
            editorState.floorColor = { ...color };
          }
          editorState.activeTool = EditTool.TILE_PAINT;
        } else if (tile === TileType.WALL) {
          const color = layout.tileColors?.[idx];
          if (color) {
            editorState.wallColor = { ...color };
          }
          editorState.activeTool = EditTool.WALL_PAINT;
        }
        setEditorTick((tick) => tick + 1);
      }
    },
    [applyEdit, editorState, getOfficeState, maybeExpand],
  );

  const handleEditorEraseAction = useCallback(
    (col: number, row: number) => {
      const layout = getOfficeState().getLayout();
      if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return;
      const idx = row * layout.cols + col;
      if (layout.tiles[idx] === TileType.VOID) return;
      const newLayout = paintTile(layout, col, row, TileType.VOID);
      if (newLayout !== layout) {
        applyEdit(newLayout);
      }
    },
    [applyEdit, getOfficeState],
  );

  return {
    isEditMode,
    editorTick,
    isDirty,
    zoom,
    panRef,
    setSavedLayout,
    handleToggleEditMode,
    handleToolChange,
    handleTileTypeChange,
    handleFloorColorChange,
    handleWallColorChange,
    handleSelectedFurnitureColorChange,
    handleFurnitureTypeChange,
    handleDeleteSelected,
    handleRotateSelected,
    handleToggleState,
    handleUndo,
    handleRedo,
    handleReset,
    handleSave,
    handleZoomChange,
    handleEditorTileAction,
    handleEditorEraseAction,
    handleEditorSelectionChange,
    handleDragMove,
  };
}
