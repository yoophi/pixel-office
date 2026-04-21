import { useState } from 'react';

import { gameBus } from '../../bridge/index.js';
import { DEFAULT_TILESET_VARIANTS } from '../../game/index.js';

export function TilesetSwitcher() {
  const [activeVariantId, setActiveVariantId] = useState<string>(DEFAULT_TILESET_VARIANTS[0].id);

  return (
    <div className="tileset-switcher" aria-label="Tileset variant">
      {DEFAULT_TILESET_VARIANTS.map((variant) => (
        <button
          key={variant.id}
          type="button"
          aria-pressed={variant.id === activeVariantId}
          onClick={() => {
            setActiveVariantId(variant.id);
            gameBus.emit('ui:tileset-selected', { variantId: variant.id });
          }}
        >
          {variant.name}
        </button>
      ))}
    </div>
  );
}
