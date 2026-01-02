import Phaser from 'phaser';

export function applyNonWinningSymbolDim(
  scene: Phaser.Scene,
  symbols: any[][],
  winningPositions: Set<string>,
  symbolValues?: number[][],
  options?: { darkenBgDepth?: boolean; scaleDown?: boolean }
): void {
  try {
    if (!scene || !symbols || !Array.isArray(symbols)) {
      return;
    }
    if (!winningPositions || winningPositions.size === 0) {
      return;
    }

		// Darken the BG-Depth layer during this non-winning dim sequence if a
		// Background component is attached to the scene.
		if (options?.darkenBgDepth !== false) {
			try {
				const bg: any = (scene as any).background;
				if (bg && typeof bg.darkenDepthForWinSequence === 'function') {
					bg.darkenDepthForWinSequence();
				}
			} catch {}
		}

    for (let col = 0; col < symbols.length; col++) {
      const column = symbols[col];
      if (!column) {
        continue;
      }
      for (let row = 0; row < column.length; row++) {
        let symbol: any = column[row];
        if (!symbol) {
          continue;
        }

        const key = `${col}_${row}`;
        if (winningPositions.has(key)) {
          continue;
        }

        // Optionally convert non-winning Spine symbols to their PNG/WEBP
        // counterparts for this dimming sequence to ensure consistent
        // opacity handling, including money/multiplier symbols.
        if (symbolValues && (symbol as any)?.animationState) {
          try {
            const colValues = symbolValues[col];
            const valueFromData = colValues && colValues[row];
            if (typeof valueFromData === 'number') {
              let spriteKey = 'symbol_' + valueFromData;
              if (scene.textures.exists(spriteKey)) {
                const anySpine: any = symbol;
                const home = anySpine.__pngHome as { x: number; y: number } | undefined;
                const px = (home && typeof home.x === 'number') ? home.x : anySpine.x;
                const py = (home && typeof home.y === 'number') ? home.y : anySpine.y;

                const parent: any = (anySpine as any).parentContainer;
                const sprite = scene.add.sprite(px, py, spriteKey);
                try {
                  const dw = (anySpine.displayWidth ?? sprite.displayWidth) as number;
                  const dh = (anySpine.displayHeight ?? sprite.displayHeight) as number;
                  sprite.displayWidth = dw;
                  sprite.displayHeight = dh;
                } catch {}
                try {
                  if (typeof sprite.setDepth === 'function') {
                    sprite.setDepth((anySpine.depth as number) ?? sprite.depth);
                  }
                } catch {}
                try {
                  if (typeof (sprite as any).setScrollFactor === 'function') {
                    const sfx = (anySpine.scrollFactorX as number) ?? 0;
                    const sfy = (anySpine.scrollFactorY as number) ?? sfx;
                    (sprite as any).setScrollFactor(sfx, sfy);
                  }
                } catch {}
                try {
                  (sprite as any).alpha = (anySpine.alpha as number) ?? 1;
                } catch {}

                if (parent && typeof parent.add === 'function') {
                  try { parent.add(sprite); } catch {}
                }

                try { anySpine.destroy(); } catch {}
                column[row] = sprite;
                symbol = sprite;
              }
            }
          } catch {}
        }

        const anySymbol: any = symbol;
        if (anySymbol.__nonWinDimApplied) {
          continue;
        }

        try {
          if (typeof anySymbol.__nonWinOriginalScaleX !== 'number') {
            anySymbol.__nonWinOriginalScaleX = anySymbol.scaleX ?? 1;
            anySymbol.__nonWinOriginalScaleY = anySymbol.scaleY ?? 1;
          }
          if (typeof anySymbol.__nonWinOriginalAlpha !== 'number') {
            anySymbol.__nonWinOriginalAlpha = anySymbol.alpha ?? 1;
          }
        } catch {}

        // Temporarily disable any custom pipeline (e.g. SymbolWaveVertical) so
        // standard sprite alpha handling is used during the dim tween.
        try {
          if (typeof anySymbol.__nonWinOriginalPipeline === 'undefined') {
            (anySymbol as any).__nonWinOriginalPipeline = (anySymbol as any).pipeline ?? null;
          }
							try { (anySymbol as any).__suppressWaveShader = true; } catch {}
          const currentPipeline = (anySymbol as any).pipeline;
							try {
								if (typeof (anySymbol as any).setPipeline === 'function') {
									(anySymbol as any).setPipeline('TextureTintPipeline');
								}
							} catch {}
							if (currentPipeline) {
								try {
									if (typeof (anySymbol as any).resetPipeline === 'function') {
										(anySymbol as any).resetPipeline();
									}
								} catch {}
							}
        } catch {}

        anySymbol.__nonWinDimApplied = true;

        try {
          const baseScaleX = (anySymbol.__nonWinOriginalScaleX ?? anySymbol.scaleX ?? 1) as number;
          const baseScaleY = (anySymbol.__nonWinOriginalScaleY ?? anySymbol.scaleY ?? 1) as number;
          const tweenConfig: any = {
            targets: anySymbol,
            alpha: 0.5,
            duration: 400,
            ease: Phaser.Math.Easing.Sine.Out,
          };
          if (options?.scaleDown !== false) {
            tweenConfig.scaleX = baseScaleX * 0.8;
            tweenConfig.scaleY = baseScaleY * 0.8;
          }
          const tween = scene.tweens.add(tweenConfig);

          // For Spine objects or anything that implements setAlpha, keep the
          // rendered opacity in sync with the tweened alpha value.
          if (typeof anySymbol.setAlpha === 'function') {
            try {
              (tween as any).on('update', () => {
                try { anySymbol.setAlpha(anySymbol.alpha); } catch {}
              });
            } catch {}
          }
        } catch {}
      }
    }
  } catch {}
}

export function clearNonWinningSymbolDim(scene: Phaser.Scene, symbol: any): void {
  try {
    if (!scene || !symbol) {
      return;
    }
    const anySymbol: any = symbol;

    const hasOriginalScaleX = typeof anySymbol.__nonWinOriginalScaleX === 'number';
    const hasOriginalScaleY = typeof anySymbol.__nonWinOriginalScaleY === 'number';
    const hasOriginalAlpha = typeof anySymbol.__nonWinOriginalAlpha === 'number';

    if (hasOriginalScaleX || hasOriginalScaleY || hasOriginalAlpha) {
      try {
        const resetScaleX = hasOriginalScaleX ? anySymbol.__nonWinOriginalScaleX : anySymbol.scaleX;
        const resetScaleY = hasOriginalScaleY ? anySymbol.__nonWinOriginalScaleY : anySymbol.scaleY;
        const resetAlpha = hasOriginalAlpha ? anySymbol.__nonWinOriginalAlpha : anySymbol.alpha;

        if (typeof anySymbol.setScale === 'function') {
          anySymbol.setScale(resetScaleX, resetScaleY);
        } else {
          anySymbol.scaleX = resetScaleX;
          anySymbol.scaleY = resetScaleY;
        }

        anySymbol.alpha = resetAlpha;
      } catch {}
    }

    // Restore any original pipeline that was active before the non-winning dim
    try {
      const originalPipeline = (anySymbol as any).__nonWinOriginalPipeline;
      if (originalPipeline && typeof anySymbol.setPipeline === 'function') {
        anySymbol.setPipeline(originalPipeline);
      }
    } catch {}

		try { delete (anySymbol as any).__suppressWaveShader; } catch {}

    try { delete anySymbol.__nonWinDimApplied; } catch {}
    try { delete anySymbol.__nonWinOriginalScaleX; } catch {}
    try { delete anySymbol.__nonWinOriginalScaleY; } catch {}
    try { delete anySymbol.__nonWinOriginalAlpha; } catch {}
    try { delete (anySymbol as any).__nonWinOriginalPipeline; } catch {}
  } catch {}
}
