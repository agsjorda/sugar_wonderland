import Phaser from 'phaser';
import type { SpinData } from '../../backend/SpinData';
import { getSymbol5ImageKeyForCell, getSymbol5ImageKeyForVariant, getDefaultSymbol5Variant } from './Symbol5VariantHelper';

export interface SymbolFlashHost {
  scene: Phaser.Scene;
  symbols: any[][];
  displayWidth: number;
  displayHeight: number;
  flashOverlayAlphaStart: number;
  flashOverlayFadeTo: number;
  flashOverlayDurationMs: number;
  flashOverlaySpeedMultiplier: number;
  currentSpinData?: SpinData | null;
}

export function flashAllSymbolsOverlay(host: SymbolFlashHost): void {
  try {
    const scene: any = host.scene as any;
    if (!scene || !host.symbols || !host.symbols.length || !host.symbols[0] || !host.symbols[0].length) {
      return;
    }

    const hostContainer: any = (host as any).container;

    let overlaysCreated = 0;
    const flashedPositions = new Set<string>();

    const symbolData: any[][] | null | undefined = (host as any).currentSymbolData || (scene as any)?.currentSymbolData;
    const spinData: SpinData | null | undefined = host.currentSpinData ?? ((scene as any)?.currentSpinData as SpinData | null | undefined);

    for (let col = 0; col < host.symbols.length; col++) {
      const column = host.symbols[col];
      if (!Array.isArray(column)) continue;

      for (let row = 0; row < column.length; row++) {
        const obj: any = column[row];
        if (!obj) continue;

        try {
          if ((obj as any).destroyed) continue;
          if ((obj as any).__isCollectorPlaceholder) continue;
          if ((obj as any).__collectedByHook) continue;
          if ((obj as any).__skipFlashAllSymbolsOverlay) continue;
          if (typeof (obj as any).active === 'boolean' && !(obj as any).active) continue;
          if (hostContainer && (obj as any).parentContainer && (obj as any).parentContainer !== hostContainer) continue;
        } catch {}

        let symbolValue: number | undefined;
        let textureKey: string | undefined;

        // Prefer the logical symbol value from current symbol data when available
        try {
          const v = symbolData?.[col]?.[row];
          if (typeof v === 'number') {
            symbolValue = v;
          }
        } catch {}

        // Fallback: try to parse from texture key
        if (symbolValue === undefined) {
          try {
            textureKey = (obj as any)?.texture?.key;
            if (textureKey && textureKey.startsWith('symbol_')) {
              const parts = textureKey.split('_');
              const parsed = parseInt(parts[1], 10);
              if (!Number.isNaN(parsed)) symbolValue = parsed;
            }
          } catch {}
        } else {
          try {
            textureKey = (obj as any)?.texture?.key;
          } catch {}
        }

        let pngKey: string | undefined;

        if (symbolValue === 5) {
          // Symbol 5: resolve variant-specific image key when possible
          let variantKey: string | null = null;

          try {
            if (spinData) {
              variantKey = getSymbol5ImageKeyForCell(spinData, col, row);
            }
          } catch {}

          if (variantKey && scene.textures?.exists?.(variantKey)) {
            pngKey = variantKey;
          } else {
            // Fallback to a default variant or existing texture key
            try {
              const fallbackVariantKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
              if (scene.textures?.exists?.(fallbackVariantKey)) {
                pngKey = fallbackVariantKey;
              }
            } catch {}

            if (!pngKey && textureKey && scene.textures?.exists?.(textureKey)) {
              pngKey = textureKey;
            }
          }
        } else {
          const baseKey = symbolValue !== undefined ? `symbol_${symbolValue}` : (textureKey || '');
          if (baseKey && scene.textures?.exists?.(baseKey)) {
            pngKey = baseKey;
          } else if (textureKey && scene.textures?.exists?.(textureKey)) {
            pngKey = textureKey;
          }

          if (!pngKey && (symbolValue === 12 || symbolValue === 13 || symbolValue === 14)) {
            try {
              const fallbackVariantKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
              if (scene.textures?.exists?.(fallbackVariantKey)) {
                pngKey = fallbackVariantKey;
              }
            } catch {}
          }
        }

        const home = (obj as any).__pngHome as { x: number; y: number } | undefined;
        const size = (obj as any).__pngSize as { w: number; h: number } | undefined;
        const nudge = (obj as any).__pngNudge as { x: number; y: number } | undefined;

        const centerX = (home?.x ?? obj.x) + (nudge?.x ?? 0);
        const centerY = (home?.y ?? obj.y) + (nudge?.y ?? 0);
        const w = Math.max(2, size?.w ?? obj.displayWidth ?? host.displayWidth);
        const h = Math.max(2, size?.h ?? obj.displayHeight ?? host.displayHeight);

        let overlay: any;
        if (pngKey && scene.textures?.exists?.(pngKey)) {
          overlay = scene.add.image(centerX, centerY, pngKey);
          overlay.setOrigin(0.5, 0.5);
          overlay.setDisplaySize(w, h);
        } else {
          // Fallback: use a simple white rectangle so the symbol still flashes
          overlay = scene.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
          try { overlay.setOrigin(0.5, 0.5); } catch {}
        }

        try { overlay.setDepth(1005); } catch {}
        try { (overlay as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch {}
        try {
          if ((overlay as any).setTintFill) {
            (overlay as any).setTintFill(0xffffff);
          } else if ((overlay as any).setTint) {
            (overlay as any).setTint(0xffffff);
          }
        } catch {}

        overlay.setAlpha(Math.max(0, Math.min(1, host.flashOverlayAlphaStart)));
        overlaysCreated++;
        flashedPositions.add(`${col}_${row}`);

        const effectiveSpeed = Math.max(0.05, host.flashOverlaySpeedMultiplier);
        const dur = Math.max(20, Math.floor(host.flashOverlayDurationMs / effectiveSpeed));

        scene.tweens.add({
          targets: overlay,
          alpha: Math.max(0, Math.min(1, host.flashOverlayFadeTo)),
          duration: dur,
          ease: 'Sine.easeOut',
          onComplete: () => {
            try { overlay.destroy(); } catch {}
          }
        });
      }
    }

    // Fallback pass: ensure money/multiplier symbols (5, 12, 13, 14) always get
    // a visible flash, even if their display object was skipped above.
    try {
      if (symbolData && Array.isArray(symbolData)) {
        const self: any = host as any;
        const symbolTotalWidth = self.displayWidth + (self.horizontalSpacing || 0);
        const symbolTotalHeight = self.displayHeight + (self.verticalSpacing || 0);
        const startX = self.slotX - (self.totalGridWidth || (symbolTotalWidth * (symbolData[0]?.length || 0))) * 0.5;
        const startY = self.slotY - (self.totalGridHeight || (symbolTotalHeight * (symbolData.length || 0))) * 0.5;

        for (let col = 0; col < symbolData.length; col++) {
          const column = symbolData[col];
          if (!Array.isArray(column)) continue;
          for (let row = 0; row < column.length; row++) {
            const v = column[row];
            if (v !== 5 && v !== 12 && v !== 13 && v !== 14) continue;

            const key = `${col}_${row}`;
            if (flashedPositions.has(key)) continue;

            const centerX = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
            const centerY = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
            const w = Math.max(2, host.displayWidth);
            const h = Math.max(2, host.displayHeight);

            let overlay: any;
            try {
              overlay = scene.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
              try { overlay.setOrigin(0.5, 0.5); } catch {}
              try { overlay.setDepth(1005); } catch {}
              try { (overlay as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch {}
              overlay.setAlpha(Math.max(0, Math.min(1, host.flashOverlayAlphaStart)));
              overlaysCreated++;

              const effectiveSpeed = Math.max(0.05, host.flashOverlaySpeedMultiplier);
              const dur = Math.max(20, Math.floor(host.flashOverlayDurationMs / effectiveSpeed));

              scene.tweens.add({
                targets: overlay,
                alpha: Math.max(0, Math.min(1, host.flashOverlayFadeTo)),
                duration: dur,
                ease: 'Sine.easeOut',
                onComplete: () => {
                  try { overlay.destroy(); } catch {}
                }
              });
            } catch {}
          }
        }
      }
    } catch {}

    if (overlaysCreated > 0) {
      console.log(`[SymbolFlash] Overlays created: ${overlaysCreated}`);
    }
  } catch {}
}
