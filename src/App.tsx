import './App.css';
import { PhaserGame } from './game/PhaserGame.js';
import { TilesetSwitcher } from './ui/TilesetSwitcher/TilesetSwitcher.js';

function App() {
  return (
    <div className="app-shell" aria-label="Pixel Office Phaser bootstrap">
      <PhaserGame />
      <TilesetSwitcher />
    </div>
  );
}

export default App;
