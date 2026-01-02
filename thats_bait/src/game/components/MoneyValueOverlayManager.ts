import { NumberDisplay } from './NumberDisplay';
import { getMoneyValueForCell } from './Symbol5VariantHelper';

export interface MoneyOverlayHost {
	scene: any;
	container: any;
	symbols: any[][];
	displayWidth: number;
	displayHeight: number;
	moneyValueScaleModifier: number;
	moneyValueOffsetY: number;
	moneyValueWidthPaddingFactor: number;
	moneyValueHeightPaddingFactor: number;
	moneyValueSpacing: number;
}

export class MoneyValueOverlayManager {
	private host: MoneyOverlayHost;
	private overlays: (NumberDisplay | null)[][] = [];

	private getOwnerAlpha(owner: any): number {
		try {
			const a = owner?.alpha;
			if (typeof a === 'number' && isFinite(a)) {
				return Math.max(0, Math.min(1, a));
			}
		} catch {}
		return 1;
	}

	private getOwnerVisible(owner: any): boolean {
		try {
			const v = owner?.visible;
			if (typeof v === 'boolean') {
				return v;
			}
		} catch {}
		return true;
	}

	private syncOverlayVisibilityWithOwner(cont: any, owner: any): void {
		try {
			if (!cont || !owner) return;
			const visible = this.getOwnerVisible(owner);
			const alpha = this.getOwnerAlpha(owner);
			try { cont.setVisible?.(visible); } catch { try { cont.visible = visible; } catch {} }
			try { cont.setAlpha?.(alpha); } catch { try { cont.alpha = alpha; } catch {} }
		} catch {}
	}

	constructor(host: MoneyOverlayHost) {
		this.host = host;
		try {
			const sceneAny: any = this.host.scene as any;
			sceneAny?.events?.on('update', this.handleSceneUpdate, this);
		} catch {}
	}

	public clearOverlays(): void {
		try {
			if (!this.overlays) {
				return;
			}
			for (let c = 0; c < this.overlays.length; c++) {
				const col = this.overlays[c];
				if (!Array.isArray(col)) continue;
				for (let r = 0; r < col.length; r++) {
					const nd = col[r];
					if (nd) {
						try { nd.destroy(); } catch {}
						col[r] = null;
					}
				}
			}
		} catch {}
		this.overlays = [];
	}

	public updateOverlays(spinData: any, symbolsOverride?: any[][]): void {
		try {
			if (!spinData || !spinData.slot || !Array.isArray(spinData.slot.area)) {
				return;
			}

			// When no override is provided, we're rebuilding overlays for the main
			// settled symbol grid, so clear everything first. When an override is
			// provided (e.g. for newSymbols during drop), keep existing overlays so
			// previous-spin money values can remain visible until their symbols are
			// destroyed by the drop animation.
			if (!symbolsOverride) {
				this.clearOverlays();
			}

			const area: any[][] = spinData.slot.area;
			const symbols = symbolsOverride || this.host.symbols;
			if (!symbols || !Array.isArray(symbols)) {
				return;
			}

			const sceneAny: any = this.host.scene as any;
			const networkManager = sceneAny?.networkManager;
			const screenModeManager = sceneAny?.screenModeManager;
			if (!networkManager || !screenModeManager) {
				return;
			}

			for (let col = 0; col < symbols.length; col++) {
				const colSymbols = symbols[col];
				if (!Array.isArray(colSymbols)) continue;
				if (!this.overlays[col]) {
					this.overlays[col] = [];
				}

				for (let row = 0; row < colSymbols.length; row++) {
					const symbolObj: any = colSymbols[row];
					if (!symbolObj) continue;

					const symbolId = area?.[col]?.[row];
					if (symbolId !== 5 && symbolId !== 12 && symbolId !== 13 && symbolId !== 14) {
						continue;
					}

					const value = getMoneyValueForCell(spinData, col, row);
					if (value == null || !(value > 0)) {
						continue;
					}

					const useDecimals = value > 0 && value < 1;
					const centerX = symbolObj.x;
					const symbolHeight = (symbolObj.displayHeight || this.host.displayHeight) as number;
					const centerY = symbolObj.y + symbolHeight * 0.28 + this.host.moneyValueOffsetY;

					const spacing = typeof this.host.moneyValueSpacing === 'number' ? this.host.moneyValueSpacing : 1;

					const cfg = {
						x: centerX,
						y: centerY,
						scale: 1.0,
						spacing,
						alignment: 'center' as const,
						decimalPlaces: useDecimals ? 2 : 0,
						showCommas: false,
						prefix: '',
						suffix: '',
						commaYOffset: 0,
						dotYOffset: 0
					};

					let nd: NumberDisplay | null = null;
					try {
						nd = new NumberDisplay(networkManager, screenModeManager, cfg);
						nd.create(sceneAny);
						nd.displayValue(value);
						const cont = nd.getContainer();
						this.host.container.add(cont);
						try {
							(cont as any).__isMoneyValueOverlay = true;
							(cont as any).__ownerSymbol = symbolObj;
						} catch {}
						try {
							const b = cont.getBounds();
							const symbolWidth = (symbolObj.displayWidth || this.host.displayWidth) as number;
							const targetW = symbolWidth * this.host.moneyValueWidthPaddingFactor;
							const targetH = symbolHeight * this.host.moneyValueHeightPaddingFactor;
							let autoScale = 1.0;
							if (b && b.width > 0 && b.height > 0) {
								const sx = targetW > 0 ? targetW / b.width : 1.0;
								const sy = targetH > 0 ? targetH / b.height : 1.0;
								autoScale = Math.min(sx, sy);
							}
							const finalScale = autoScale * (this.host.moneyValueScaleModifier || 1.0);
							cont.setScale(finalScale);
							try {
								const ownerScaleX = typeof symbolObj.scaleX === 'number' ? symbolObj.scaleX : 1;
								const ownerScaleY = typeof symbolObj.scaleY === 'number' ? symbolObj.scaleY : 1;
								(cont as any).__baseOwnerScaleX = ownerScaleX;
								(cont as any).__baseOwnerScaleY = ownerScaleY;
								(cont as any).__baseOverlayScaleX = cont.scaleX;
								(cont as any).__baseOverlayScaleY = cont.scaleY;
							} catch {}
						} catch {}
						try { (this.host.container as any).bringToTop?.(cont as any); } catch {}
						try { this.syncOverlayVisibilityWithOwner(cont, symbolObj); } catch {}
						this.overlays[col].push(nd);
					} catch {
						try { nd?.destroy(); } catch {}
						this.overlays[col].push(null);
					}
				}
			}
		} catch {}
	}

	private handleSceneUpdate(): void {
		try {
			const sceneAny: any = this.host.scene as any;
			const tweensAny: any = sceneAny?.tweens;
			for (let c = 0; c < this.overlays.length; c++) {
				const col = this.overlays[c];
				if (!Array.isArray(col)) continue;
				for (let r = 0; r < col.length; r++) {
					const nd = col[r];
					if (!nd) continue;
					let cont: any = null;
					try {
						cont = nd.getContainer();
					} catch {}
					if (!cont) continue;
					const owner: any = (cont as any).__ownerSymbol;
					if (!owner || owner.destroyed || owner.active === false) {
						try { nd.destroy(); } catch {}
						col[r] = null;
						continue;
					}
					try { this.syncOverlayVisibilityWithOwner(cont, owner); } catch {}
					try {
						const baseOwnerScaleX = (cont as any).__baseOwnerScaleX || 1;
						const baseOwnerScaleY = (cont as any).__baseOwnerScaleY || 1;
						const baseOverlayScaleX = (cont as any).__baseOverlayScaleX || 1;
						const baseOverlayScaleY = (cont as any).__baseOverlayScaleY || 1;
						const ownerScaleX = typeof owner.scaleX === 'number' ? owner.scaleX : 1;
						const ownerScaleY = typeof owner.scaleY === 'number' ? owner.scaleY : 1;
						const ratioX = baseOwnerScaleX !== 0 ? ownerScaleX / baseOwnerScaleX : 1;
						const ratioY = baseOwnerScaleY !== 0 ? ownerScaleY / baseOwnerScaleY : 1;
						let boost = 1;
						try {
							const tweeningA = !!tweensAny?.isTweening?.(owner);
							const tweenList = tweensAny?.getTweensOf?.(owner, true) || tweensAny?.getTweensOf?.(owner) || [];
							const tweeningB = Array.isArray(tweenList) && tweenList.length > 0;
							if (tweeningA || tweeningB) {
								boost = 1.25;
							}
						} catch {}
						cont.scaleX = baseOverlayScaleX * ratioX * boost;
						cont.scaleY = baseOverlayScaleY * ratioY * boost;
						const symbolHeight = (owner.displayHeight || this.host.displayHeight) as number;
						cont.x = owner.x;
						cont.y = owner.y + symbolHeight * 0.28 + this.host.moneyValueOffsetY;
					} catch {}
					try {
						const parent: any = this.host.container;
						if (parent && typeof parent.getIndex === 'function' && typeof parent.bringToTop === 'function') {
							const contIndex = parent.getIndex(cont);
							const ownerIndex = parent.getIndex(owner);
							if (typeof contIndex === 'number' && typeof ownerIndex === 'number' && contIndex <= ownerIndex) {
								parent.bringToTop(cont);
							}
						}
					} catch {}
				}
			}
		} catch {}
	}

	public getOverlayContainers(): any[] {
		const result: any[] = [];
		try {
			for (let c = 0; c < this.overlays.length; c++) {
				const col = this.overlays[c];
				if (!Array.isArray(col)) continue;
				for (let r = 0; r < col.length; r++) {
					const nd = col[r];
					if (nd) {
						try {
							const cont = nd.getContainer();
							if (cont) {
								result.push(cont);
							}
						} catch {}
					}
				}
			}
		} catch {}
		return result;
	}
}
