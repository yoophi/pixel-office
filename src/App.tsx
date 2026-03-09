import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './App.css';
import { useEditorKeyboard } from './hooks/useEditorKeyboard.js';
import { usePixelAgentsAssets } from './hooks/usePixelAgentsAssets.js';
import { useLocalEditorActions } from './hooks/useLocalEditorActions.js';
import { OfficeCanvas } from './office/components/OfficeCanvas.js';
import { EditorState } from './office/editor/editorState.js';
import { EditorToolbar } from './office/editor/EditorToolbar.js';
import { OfficeState } from './office/engine/officeState.js';
import { deserializeLayout } from './office/layout/layoutSerializer.js';
import type { OfficeLayout } from './office/types.js';

const LAYOUT_STORAGE_KEY = 'pixel-agents-migration.layout';

const officeStateRef = { current: null as OfficeState | null };
const editorState = new EditorState();

function loadStoredLayout(): OfficeLayout | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (!raw) return undefined;
  return deserializeLayout(raw) ?? undefined;
}

function getOfficeState(): OfficeState {
  if (!officeStateRef.current) {
    officeStateRef.current = new OfficeState(loadStoredLayout());
  }
  return officeStateRef.current;
}

function App() {
  const officeState = getOfficeState();
  const [uiTick, setUiTick] = useState(0);
  const [showCharacterInfo, setShowCharacterInfo] = useState(true);
  const [showPathDots, setShowPathDots] = useState(true);
  const [showWalkable, setShowWalkable] = useState(false);
  const editor = useLocalEditorActions(getOfficeState, editorState, LAYOUT_STORAGE_KEY);
  const nextAgentIdRef = useRef(5);
  const handleAssetsLoaded = useCallback(() => {
    setUiTick((tick) => tick + 1);
  }, []);
  const { assetsReady, loadedAssets } = usePixelAgentsAssets(
    getOfficeState,
    editor.setSavedLayout,
    handleAssetsLoaded,
  );

  useEffect(() => {
    if (officeState.characters.size > 0) return;
    for (let id = 1; id <= 4; id++) {
      officeState.addAgent(id);
      officeState.setAgentActive(id, false);
    }
    setUiTick((tick) => tick + 1);
  }, [officeState]);

  useEditorKeyboard(
    editor.isEditMode,
    editorState,
    editor.handleDeleteSelected,
    editor.handleRotateSelected,
    editor.handleToggleState,
    editor.handleUndo,
    editor.handleRedo,
    useCallback(() => setUiTick((tick) => tick + 1), []),
    editor.handleToggleEditMode,
  );

  const selectedFurnitureColor = useMemo(() => {
    const uid = editorState.selectedFurnitureUid;
    if (!uid) return null;
    return officeState.getLayout().furniture.find((item) => item.uid === uid)?.color ?? null;
  }, [officeState, uiTick, editor.editorTick]);

  const handleCanvasAgentClick = useCallback(() => {
    setUiTick((tick) => tick + 1);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    editor.handleToggleEditMode();
    setUiTick((tick) => tick + 1);
  }, [editor]);

  const handleAddAgent = useCallback(() => {
    const id = nextAgentIdRef.current++;
    officeState.addAgent(id);
    officeState.setAgentActive(id, false);
    setUiTick((tick) => tick + 1);
  }, [officeState]);

  const handleRemoveAgent = useCallback(() => {
    if (officeState.selectedAgentId === null) return;
    officeState.removeAgent(officeState.selectedAgentId);
    setUiTick((tick) => tick + 1);
  }, [officeState]);

  void uiTick;

  return (
    <div className="app-shell">
      <aside className="control-panel">
        <div className="panel-section">
          <p className="eyebrow">Pixel Agents Migration</p>
          <h1>Map + Character Sandbox</h1>
          <p className="panel-copy">
            `pixel-agents`의 실제 기본 레이아웃, 벽 스프라이트, 캐릭터 스프라이트를 사용해 현재
            프로젝트 안에서 독립 실행되도록 구성한 화면입니다.
          </p>
        </div>

        <div className="panel-section preview-card">
          <img className="preview-image" src="/Screenshot.jpg" alt="Pixel Agents reference" />
          <p className="preview-caption">
            원본 프로젝트의 공개 에셋을 현재 앱 렌더링에 연결했습니다.
          </p>
        </div>

        <div className="panel-section button-grid">
          <button className="primary-btn" onClick={handleToggleEditMode}>
            {editor.isEditMode ? 'Exit Edit' : 'Enter Edit'}
          </button>
          <button onClick={handleAddAgent}>Add Agent</button>
          <button onClick={handleRemoveAgent} disabled={officeState.selectedAgentId === null}>
            Remove Selected
          </button>
          <button onClick={editor.handleUndo} disabled={editorState.undoStack.length === 0}>
            Undo
          </button>
          <button onClick={editor.handleRedo} disabled={editorState.redoStack.length === 0}>
            Redo
          </button>
          <button onClick={editor.handleSave} disabled={!editor.isDirty}>
            Save Layout
          </button>
          <button onClick={editor.handleReset}>Reset Layout</button>
        </div>

        <div className="panel-section info-list">
          <p>
            <strong>Agents</strong> {officeState.characters.size}
          </p>
          <p>
            <strong>Selected</strong>{' '}
            {officeState.selectedAgentId === null ? 'none' : `agent-${officeState.selectedAgentId}`}
          </p>
          <p>
            <strong>Status</strong> {editor.isDirty ? 'unsaved changes' : 'saved'}
          </p>
          <p>
            <strong>Assets</strong> {assetsReady ? 'loaded from pixel-agents' : 'loading'}
          </p>
        </div>

        <div className="panel-section">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCharacterInfo}
              onChange={(e) => setShowCharacterInfo(e.target.checked)}
            />
            Show character info
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPathDots}
              onChange={(e) => setShowPathDots(e.target.checked)}
            />
            Show path dots
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showWalkable}
              onChange={(e) => setShowWalkable(e.target.checked)}
            />
            Show walkable tiles
          </label>
        </div>

        <div className="panel-section help-list">
          <p>Click agent: select + camera follow</p>
          <p>Right click map: selected agent walks there</p>
          <p>Middle drag / wheel: pan map</p>
          <p>Ctrl/Cmd + wheel: zoom</p>
          <p>Edit mode: place and move design elements on map</p>
          <p>Keyboard: `R` rotate, `T` toggle, `Del` delete, `Esc` cancel</p>
        </div>

        {editor.isEditMode && (
          <div className="toolbar-wrap">
            <EditorToolbar
              activeTool={editorState.activeTool}
              selectedTileType={editorState.selectedTileType}
              selectedFurnitureType={editorState.selectedFurnitureType}
              selectedFurnitureUid={editorState.selectedFurnitureUid}
              selectedFurnitureColor={selectedFurnitureColor}
              floorColor={editorState.floorColor}
              wallColor={editorState.wallColor}
              onToolChange={editor.handleToolChange}
              onTileTypeChange={editor.handleTileTypeChange}
              onFloorColorChange={editor.handleFloorColorChange}
              onWallColorChange={editor.handleWallColorChange}
              onSelectedFurnitureColorChange={editor.handleSelectedFurnitureColorChange}
              onFurnitureTypeChange={editor.handleFurnitureTypeChange}
              loadedAssets={loadedAssets}
            />
          </div>
        )}
      </aside>

      <main className="canvas-stage">
        <OfficeCanvas
          officeState={officeState}
          onClick={handleCanvasAgentClick}
          isEditMode={editor.isEditMode}
          editorState={editorState}
          onEditorTileAction={editor.handleEditorTileAction}
          onEditorEraseAction={editor.handleEditorEraseAction}
          onEditorSelectionChange={editor.handleEditorSelectionChange}
          onDeleteSelected={editor.handleDeleteSelected}
          onRotateSelected={editor.handleRotateSelected}
          onDragMove={editor.handleDragMove}
          editorTick={editor.editorTick}
          zoom={editor.zoom}
          onZoomChange={editor.handleZoomChange}
          panRef={editor.panRef}
          showCharacterInfo={showCharacterInfo}
          showPathDots={showPathDots}
          showWalkable={showWalkable}
        />
      </main>
    </div>
  );
}

export default App;
