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
          try {
            const anySymbol: any = symbol;
            const overlay: any = (anySymbol as any).__nonWinDimOverlaySprite;
            if (overlay && !overlay.destroyed) {
              try { overlay.destroy?.(); } catch { try { overlay.destroy?.(true); } catch {} }
            }
            try { delete (anySymbol as any).__nonWinDimOverlaySprite; } catch {}
            try {
              const ov = (anySymbol as any).__nonWinOriginalVisible;
              if (typeof ov === 'boolean') {
                try { anySymbol.setVisible?.(ov); } catch { try { anySymbol.visible = ov; } catch {} }
              }
            } catch {}
            try { delete (anySymbol as any).__nonWinOriginalVisible; } catch {}
            try { delete (anySymbol as any).__nonWinDimOverlayDestroyHooked; } catch {}
          } catch {}
          continue;
        }

        // Optionally convert non-winning Spine symbols to their PNG/WEBP
        // counterparts for this dimming sequence to ensure consistent
        // opacity handling, including money/multiplier symbols.
        if ((symbol as any)?.animationState) {
          try {
            const anySpine: any = symbol;
            let valueFromData: number | undefined;
            try {
              const colValues = symbolValues?.[col];
              const v = colValues && colValues[row];
              if (typeof v === 'number') valueFromData = v;
            } catch {}

            if (valueFromData === undefined) {
              try {
                const anySpine: any = symbol;
                const k = String((anySpine as any)?.key ?? '');
                const m = k.match(/symbol_(\d+)_spine/i);
                if (m && m[1]) {
                  const parsed = parseInt(m[1], 10);
                  if (!Number.isNaN(parsed)) valueFromData = parsed;
                }
              } catch {}
            }

            if (valueFromData === undefined) {
              try {
                const anySpine: any = symbol;
                const name = String(anySpine?.skeleton?.data?.name ?? '');
                const m = name.match(/Symbol(\d+)_/i);
                if (m && m[1]) {
                  const parsed = parseInt(m[1], 10);
                  if (!Number.isNaN(parsed)) valueFromData = parsed;
                }
              } catch {}
            }

            if (typeof valueFromData === 'number') {
              const spriteKey = 'symbol_' + valueFromData;
              if (scene.textures.exists(spriteKey)) {
                const home = anySpine.__pngHome as { x: number; y: number } | undefined;
                const px = (home && typeof home.x === 'number') ? home.x : anySpine.x;
                const py = (home && typeof home.y === 'number') ? home.y : anySpine.y;

                const parent: any = (anySpine as any).parentContainer;
                let sprite: any = (anySpine as any).__nonWinDimOverlaySprite;
                try {
                  if (!sprite || sprite.destroyed) {
                    sprite = scene.add.sprite(px, py, spriteKey);
                    try { (anySpine as any).__nonWinDimOverlaySprite = sprite; } catch {}
                  } else {
                    try { sprite.setTexture(spriteKey); } catch {}
                    try { sprite.setPosition(px, py); } catch {}
                  }
                } catch {
                  sprite = null;
                }
                if (!sprite) {
                  // fall through and rely on Spine alpha forcing
                } else {
                try {
                  const dw = (anySpine.displayWidth ?? sprite.displayWidth) as number;
                  const dh = (anySpine.displayHeight ?? sprite.displayHeight) as number;
                  sprite.displayWidth = dw;
                  sprite.displayHeight = dh;
                } catch {}
                try {
                  if (typeof sprite.setDepth === 'function') {
                    const bgDepthRaw = Number((scene as any)?.slotBackground?.depth);
                    const minDepth = isFinite(bgDepthRaw) ? bgDepthRaw + 1 : 880;
                    const base = Number((anySpine.depth as number) ?? sprite.depth);
                    sprite.setDepth(Math.max(minDepth, isFinite(base) ? base : 0));
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

                try {
                  if (!(anySpine as any).__nonWinDimOverlayDestroyHooked) {
                    (anySpine as any).__nonWinDimOverlayDestroyHooked = true;
                    try {
                      anySpine.once?.('destroy', () => {
                        try {
                          const o: any = (anySpine as any).__nonWinDimOverlaySprite;
                          if (o && !o.destroyed) {
                            try { o.destroy?.(); } catch { try { o.destroy?.(true); } catch {} }
                          }
                        } catch {}
                        try { delete (anySpine as any).__nonWinDimOverlaySprite; } catch {}
                      });
                    } catch {}
                  }
                } catch {}

                try {
                  if (typeof (anySpine as any).__nonWinOriginalVisible !== 'boolean') {
                    (anySpine as any).__nonWinOriginalVisible = (anySpine.visible ?? true) as boolean;
                  }
                } catch {}
                try { anySpine.setVisible?.(false); } catch { try { anySpine.visible = false; } catch {} }
                }
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
				try {
					const sc = (anySymbol as any)?.skeleton?.color;
					if (sc && typeof (anySymbol as any).__nonWinOriginalSkeletonAlpha !== 'number') {
						(anySymbol as any).__nonWinOriginalSkeletonAlpha = sc.a;
					}
				} catch {}
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
            alpha: 0.75,
            duration: 400,
            ease: Phaser.Math.Easing.Sine.Out,
          };
          if (options?.scaleDown !== false) {
            tweenConfig.scaleX = baseScaleX * 0.95;
            tweenConfig.scaleY = baseScaleY * 0.95;
          }
          const tween = scene.tweens.add(tweenConfig);

          // For Spine objects or anything that implements setAlpha, keep the
          // rendered opacity in sync with the tweened alpha value.
          if (typeof anySymbol.setAlpha === 'function') {
            try {
              (tween as any).on('update', () => {
                try { anySymbol.setAlpha(anySymbol.alpha); } catch {}
						try {
							const sc = (anySymbol as any)?.skeleton?.color;
							if (sc) sc.a = anySymbol.alpha;
						} catch {}
						try {
							const overlay: any = (anySymbol as any).__nonWinDimOverlaySprite;
							if (overlay && !overlay.destroyed) {
								try { overlay.alpha = anySymbol.alpha; } catch {}
								try {
									if (typeof overlay.scaleX === 'number' && typeof anySymbol.scaleX === 'number') overlay.scaleX = anySymbol.scaleX;
									if (typeof overlay.scaleY === 'number' && typeof anySymbol.scaleY === 'number') overlay.scaleY = anySymbol.scaleY;
								} catch {}
								try {
									overlay.displayWidth = (anySymbol.displayWidth ?? overlay.displayWidth) as number;
									overlay.displayHeight = (anySymbol.displayHeight ?? overlay.displayHeight) as number;
								} catch {}
								try {
									const home = (anySymbol as any).__pngHome as { x: number; y: number } | undefined;
									const x = (home && typeof home.x === 'number') ? home.x : anySymbol.x;
									const y = (home && typeof home.y === 'number') ? home.y : anySymbol.y;
									overlay.setPosition?.(x, y);
								} catch {}
							}
						} catch {}
              });
            } catch {}
          } else {
					try {
						const sc = (anySymbol as any)?.skeleton?.color;
						if (sc) sc.a = anySymbol.alpha;
					} catch {}
					try {
						const overlay: any = (anySymbol as any).__nonWinDimOverlaySprite;
						if (overlay && !overlay.destroyed) {
							try { overlay.alpha = anySymbol.alpha; } catch {}
							try {
								if (typeof overlay.scaleX === 'number' && typeof anySymbol.scaleX === 'number') overlay.scaleX = anySymbol.scaleX;
								if (typeof overlay.scaleY === 'number' && typeof anySymbol.scaleY === 'number') overlay.scaleY = anySymbol.scaleY;
							} catch {}
							try {
								overlay.displayWidth = (anySymbol.displayWidth ?? overlay.displayWidth) as number;
								overlay.displayHeight = (anySymbol.displayHeight ?? overlay.displayHeight) as number;
							} catch {}
							try {
								const home = (anySymbol as any).__pngHome as { x: number; y: number } | undefined;
								const x = (home && typeof home.x === 'number') ? home.x : anySymbol.x;
								const y = (home && typeof home.y === 'number') ? home.y : anySymbol.y;
								overlay.setPosition?.(x, y);
							} catch {}
						}
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

		try {
			const overlay: any = (anySymbol as any).__nonWinDimOverlaySprite;
			if (overlay && !overlay.destroyed) {
				try { scene.tweens?.killTweensOf?.(overlay); } catch {}
				try { overlay.destroy?.(); } catch { try { overlay.destroy?.(true); } catch {} }
			}
		} catch {}
		try { delete (anySymbol as any).__nonWinDimOverlaySprite; } catch {}
		try {
			const ov = (anySymbol as any).__nonWinOriginalVisible;
			if (typeof ov === 'boolean') {
				try { anySymbol.setVisible?.(ov); } catch { try { anySymbol.visible = ov; } catch {} }
			}
		} catch {}
		try { delete (anySymbol as any).__nonWinDimOverlayDestroyHooked; } catch {}

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
				try {
					const sc = (anySymbol as any)?.skeleton?.color;
					const oa = (anySymbol as any).__nonWinOriginalSkeletonAlpha;
					if (sc && typeof oa === 'number') {
						sc.a = oa;
					}
				} catch {}
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
		try { delete (anySymbol as any).__nonWinOriginalSkeletonAlpha; } catch {}
		try { delete (anySymbol as any).__nonWinOriginalVisible; } catch {}
    try { delete anySymbol.__nonWinOriginalPipeline; } catch {}
  } catch {}
}
