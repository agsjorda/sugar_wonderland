import { NumberDisplay } from './NumberDisplay';
import { getMoneyValueForCell } from './Symbol5VariantHelper';
import { applyImageSymbolWinRipple, clearImageSymbolWinRipple } from '../effects/SymbolImageWinRipple';
import { clearNonWinningSymbolDim } from '../effects/NonWinningSymbolDimmer';
import { gameStateManager } from '../../managers/GameStateManager';

type Cell = { col: number; row: number };

type WorldPoint = { x: number; y: number };

function getWorldPos(obj: any): WorldPoint {
	try {
		if (obj && typeof obj.getBounds === 'function') {
			const b = obj.getBounds();
			if (b && isFinite(b.centerX) && isFinite(b.centerY)) {
				return { x: b.centerX, y: b.centerY };
			}
		}
	} catch {}
	let x = obj?.x ?? 0;
	let y = obj?.y ?? 0;
	try {
		const parent: any = obj?.parentContainer;
		if (parent) {
			const psx = parent && typeof parent.scaleX === 'number' && isFinite(parent.scaleX) && parent.scaleX !== 0 ? parent.scaleX : 1;
			const psy = parent && typeof parent.scaleY === 'number' && isFinite(parent.scaleY) && parent.scaleY !== 0 ? parent.scaleY : 1;
			x = (parent.x ?? 0) + x * psx;
			y = (parent.y ?? 0) + y * psy;
		}
	} catch {}
	return { x, y };
}

function getDisplayHeightFallback(obj: any, fallback: number): number {
	try {
		const h = (obj?.displayHeight ?? obj?.height ?? 0) as number;
		if (isFinite(h) && h > 0) return h;
	} catch {}
	try {
		if (obj && typeof obj.getBounds === 'function') {
			const b = obj.getBounds();
			const h = (b?.height ?? 0) as number;
			if (isFinite(h) && h > 0) return h;
		}
	} catch {}
	return fallback;
}

function hideMoneyOverlayForSymbol(host: any, symbolObj: any): void {
	try {
		void host;
		void symbolObj;
		return;
	} catch {}
}

function getCellCenterFallback(host: any, col: number, row: number): WorldPoint {
	const displayWidth = host?.displayWidth ?? 68;
	const displayHeight = host?.displayHeight ?? 68;
	const horizontalSpacing = host?.horizontalSpacing ?? 10;
	const verticalSpacing = host?.verticalSpacing ?? 5;
	const symbolTotalWidth = displayWidth + horizontalSpacing;
	const symbolTotalHeight = displayHeight + verticalSpacing;
	const totalGridWidth = host?.totalGridWidth ?? symbolTotalWidth * 5;
	const totalGridHeight = host?.totalGridHeight ?? symbolTotalHeight * 3;
	const slotX = host?.slotX ?? host?.scene?.scale?.width * 0.5;
	const slotY = host?.slotY ?? host?.scene?.scale?.height * 0.5;
	const startX = slotX - totalGridWidth * 0.5;
	const startY = slotY - totalGridHeight * 0.5;
	const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
	const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
	return { x, y };
}

function findCollectors(area: any[][]): Cell[] {
	const out: Cell[] = [];
	try {
		for (let col = 0; col < area.length; col++) {
			const colArr = area[col];
			if (!Array.isArray(colArr)) continue;
			for (let row = 0; row < colArr.length; row++) {
				if (colArr[row] === 11) {
					out.push({ col, row });
				}
			}
		}
	} catch {}
	return out;
}

function getMoneyCells(area: any[][], spinData: any): Array<{ col: number; row: number; value: number }> {
	const out: Array<{ col: number; row: number; value: number }> = [];
	try {
		for (let col = 0; col < area.length; col++) {
			const colArr = area[col];
			if (!Array.isArray(colArr)) continue;
			for (let row = 0; row < colArr.length; row++) {
				const id = colArr[row];
				if (id !== 5 && id !== 12 && id !== 13 && id !== 14) continue;
				const value = getMoneyValueForCell(spinData, col, row);
				if (typeof value === 'number' && value > 0) {
					out.push({ col, row, value });
				}
			}
		}
	} catch {}
	return out;
}

function addDeltaToSpinTotals(spinData: any, delta: number): number {
	let next = 0;
	try {
		if (!spinData || !(delta > 0)) return 0;
		const slot: any = spinData?.slot;
		if (!slot) return 0;
		const fs: any = slot?.freespin || slot?.freeSpin;

		let base = 0;
		try {
			const v = Number(fs?.totalWin);
			if (isFinite(v) && v >= 0) base = Math.max(base, v);
		} catch {}
		try {
			const v = Number(slot?.totalWin);
			if (isFinite(v) && v >= 0) base = Math.max(base, v);
		} catch {}

		next = base + delta;
		try {
			const items: any[] | undefined = fs?.items;
			const cap = Array.isArray(items) && items.length > 0 ? Number(items[0]?.runningWin) : NaN;
			if (isFinite(cap) && cap > 0 && next > cap) {
				next = cap;
			}
		} catch {}
		try { slot.totalWin = next; } catch {}
		try { if (slot.freespin) slot.freespin.totalWin = next; } catch {}
		try { if (slot.freeSpin) slot.freeSpin.totalWin = next; } catch {}
	} catch {}
	return next;
}

function waitForSceneEvent(scene: any, eventName: string, timeoutMs: number): Promise<void> {
	return new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			try { scene?.events?.off?.(eventName, finish); } catch {}
			try { timer?.remove?.(false); } catch {}
			resolve();
		};
		let timer: any = null;
		try {
			timer = scene?.time?.delayedCall?.(timeoutMs, finish);
		} catch {}
		try {
			scene?.events?.once?.(eventName, finish);
		} catch {
			finish();
		}
	});
}

async function waitForHookIdle(scene: any, timeoutMs: number): Promise<void> {
	try {
		const start = Date.now();
		while (true) {
			try {
				if (!gameStateManager.isHookScatterActive) {
					return;
				}
			} catch {
				return;
			}
			if (Date.now() - start >= timeoutMs) {
				return;
			}
			await new Promise<void>((resolve) => {
				try {
					scene?.time?.delayedCall?.(40, () => resolve());
				} catch {
					try {
						setTimeout(() => resolve(), 40);
					} catch {
						resolve();
					}
				}
			});
		}
	} catch {}
}

function tweenTo(scene: any, targets: any, props: any): Promise<void> {
	return new Promise((resolve) => {
		try {
			scene.tweens.add({
				targets,
				...props,
				onComplete: () => resolve()
			});
		} catch {
			resolve();
		}
	});
}

 function getBonusLevelMultiplierKey(levelsCompleted: number): string | null {
 	try {
 		const lvl = Number(levelsCompleted) || 0;
 		if (lvl >= 3) return '10x_Multiplier_TB';
 		if (lvl >= 2) return '3x_Multiplier_TB';
 		if (lvl >= 1) return '2x_multiplier';
 		return null;
 	} catch {
 		return null;
 	}
 }

 function getBonusLevelMultiplierValue(levelsCompleted: number): number {
 	try {
 		const lvl = Number(levelsCompleted) || 0;
 		if (lvl >= 3) return 10;
 		if (lvl >= 2) return 3;
 		if (lvl >= 1) return 2;
 		return 1;
 	} catch {
 		return 1;
 	}
 }

 async function playCollectorValueHighlight(scene: any, totalCont: any): Promise<void> {
 	try {
 		if (!scene || !totalCont) return;

 		let speed = 1.0;
 		try { speed = gameStateManager.isTurbo ? 0.65 : 1.0; } catch {}

 		const sx0 = (totalCont.scaleX || 1) as number;
 		const sy0 = (totalCont.scaleY || 1) as number;

 		let flash: any = null;
 		try {
 			const b = totalCont.getBounds?.();
 			if (b && isFinite(b.centerX) && isFinite(b.centerY) && isFinite(b.width) && isFinite(b.height) && b.width > 1 && b.height > 1) {
 				flash = scene.add.rectangle(b.centerX, b.centerY, b.width * 1.22, b.height * 1.35, 0xffffff, 0.9);
 				try { flash.setOrigin(0.5, 0.5); } catch {}
 				try { flash.setScrollFactor(0); } catch {}
 				try {
 					const d = typeof totalCont.depth === 'number' ? (totalCont.depth as number) : 20005;
 					flash.setDepth(Math.max(20004, d - 1));
 				} catch {}
 				try { flash.setBlendMode((window as any)?.Phaser?.BlendModes?.ADD ?? 1); } catch {}
 			}
 		} catch {}

 		try {
 			scene.tweens.killTweensOf(totalCont);
 			if (flash) scene.tweens.killTweensOf(flash);
 		} catch {}

 		const p1 = tweenTo(scene, totalCont, {
 			scaleX: sx0 * 1.18,
 			scaleY: sy0 * 1.18,
 			duration: Math.max(80, Math.floor(150 * speed)),
 			ease: 'Back.easeOut',
 			yoyo: true,
 			repeat: 1
 		});

 		const p2 = flash
 			? tweenTo(scene, flash, {
 				alpha: 0,
 				scaleX: 1.35,
 				scaleY: 1.35,
 				duration: Math.max(90, Math.floor(170 * speed)),
 				ease: 'Sine.easeOut'
 			})
 			: Promise.resolve();

 		try { await Promise.all([p1, p2]); } catch { try { await p1; } catch {} }

 		try { flash?.destroy?.(); } catch {}
 	} catch {}
 }

 async function playBonusMultiplierImpact(scene: any, x: number, y: number, key: string, targetW?: number, targetH?: number, depth?: number): Promise<void> {
 	try {
 		if (!scene || !key) return;
 		if (!scene.textures?.exists?.(key)) return;
 		const img: any = scene.add.image(x, y, key).setOrigin(0.5, 0.5);
 		try { img.setDepth(typeof depth === 'number' ? depth : 20012); } catch {}
 		try { img.setScrollFactor(0); } catch {}

 		let baseScale = 1.0;
 		try {
 			const iw = (img.width ?? img.displayWidth ?? 0) as number;
 			const ih = (img.height ?? img.displayHeight ?? 0) as number;
 			const tw = typeof targetW === 'number' && isFinite(targetW) && targetW > 0 ? targetW : 0;
 			const th = typeof targetH === 'number' && isFinite(targetH) && targetH > 0 ? targetH : 0;
 			if (iw > 0 && ih > 0 && tw > 0 && th > 0) {
 				baseScale = Math.min((tw * 0.92) / iw, (th * 0.92) / ih);
 			}
 		} catch {}

 		try { img.setAlpha(0); } catch {}
 		try { img.setScale(baseScale * 0.78); } catch {}

 		let speed = 1.0;
 		try { speed = gameStateManager.isTurbo ? 0.65 : 1.0; } catch {}

 		await tweenTo(scene, img, {
 			alpha: 1,
 			scaleX: baseScale * 1.02,
 			scaleY: baseScale * 1.02,
 			duration: Math.max(40, Math.floor(110 * speed)),
 			ease: 'Back.easeOut'
 		});

 		await tweenTo(scene, img, {
 			alpha: 0,
 			scaleX: baseScale * 1.65,
 			scaleY: baseScale * 1.65,
 			duration: Math.max(60, Math.floor(240 * speed)),
 			ease: 'Sine.easeIn'
 		});

 		try { img.destroy(); } catch {}
 	} catch {}
 }

export async function runCollectorMoneySequence(host: any, spinData: any): Promise<void> {
	try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
	try {
		const scene: any = host?.scene;
		const area: any[][] = spinData?.slot?.area;
		if (!scene || !Array.isArray(area)) {
			return;
		}

		let canAffectTotals = true;
		try {
			canAffectTotals = !((spinData as any)?.__collectorMoneyApplied);
		} catch { canAffectTotals = true; }

		try {
			const sp: any = scene?.scene;
			const hasRetriggerOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
			if (hasRetriggerOverlay) {
				await new Promise<void>((resolve) => {
					let done = false;
					const finish = () => {
						if (done) return;
						done = true;
						try { scene?.events?.off?.('freeSpinRetriggerOverlayClosed', finish); } catch {}
						try { timer?.remove?.(false); } catch {}
						resolve();
					};
					let timer: any = null;
					try {
						timer = scene?.time?.delayedCall?.(12000, finish);
					} catch {
						timer = null;
					}
					try {
						scene?.events?.once?.('freeSpinRetriggerOverlayClosed', finish);
					} catch {
						finish();
					}
				});
			}
		} catch {}

		const collectors = findCollectors(area);
		if (!collectors.length) {
			return;
		}
		const moneyCells = getMoneyCells(area, spinData);
		if (!moneyCells.length) {
			return;
		}

		const networkManager = scene?.networkManager;
		const screenModeManager = scene?.screenModeManager;
		if (!networkManager || !screenModeManager) {
			return;
		}
		const spacing = typeof host?.moneyValueSpacing === 'number' ? host.moneyValueSpacing : 1;
		let useDecimalsTotal = false;
		try {
			useDecimalsTotal = moneyCells.some(c => typeof c.value === 'number' && c.value > 0 && c.value < 1);
		} catch {}
		let turboParallelPerCollector = false;
		try {
			turboParallelPerCollector = !!(gameStateManager.isBonus && gameStateManager.isTurbo);
		} catch {}

		for (let collectorIndex = 0; collectorIndex < collectors.length; collectorIndex++) {
			const collectorCell = collectors[collectorIndex];
			const affectTotalsThisCollector = canAffectTotals && collectorIndex === 0;
			let totalValue = 0;
			let collectorPos: WorldPoint | null = null;
			let collectorObj: any = null;
			try {
				collectorObj = host?.symbols?.[collectorCell.col]?.[collectorCell.row];
				if (collectorObj) {
					collectorPos = getWorldPos(collectorObj);
				}
			} catch {}
			if (!collectorPos) {
				collectorPos = getCellCenterFallback(host, collectorCell.col, collectorCell.row);
			}

			try {
				if (collectorObj) {
					try { clearNonWinningSymbolDim(scene, collectorObj); } catch {}
					try { clearImageSymbolWinRipple(scene, collectorObj); } catch {}
					try { applyImageSymbolWinRipple(scene, collectorObj); } catch {}
				}
			} catch {}

			const collectorHeight = getDisplayHeightFallback(collectorObj, (host?.displayHeight || 68) as number);
			let collectorTextX = collectorPos.x;
			let collectorTextY = collectorPos.y + collectorHeight * 0.28 + (host?.moneyValueOffsetY || 0);

			const totalDisplay = new NumberDisplay(networkManager, screenModeManager, {
				x: collectorTextX,
				y: collectorTextY,
				scale: 1.0,
				spacing,
				alignment: 'center',
				decimalPlaces: useDecimalsTotal ? 2 : 0,
				showCommas: false,
				prefix: '',
				suffix: '',
				commaYOffset: 0,
				dotYOffset: 0
			});
			totalDisplay.create(scene);
			totalDisplay.displayValue(totalValue);
			const totalCont: any = totalDisplay.getContainer();
			try { totalCont.setDepth(20005); } catch {}
			try { totalCont.setScrollFactor(0); } catch {}
			try { totalCont.setAlpha(0); } catch {}
			try {
				const followFn = () => {
					try {
						const isCollectorVisible = (() => {
							try {
								if (!collectorObj || collectorObj.destroyed) return false;
								if (collectorObj.visible === false) return false;
								const a = (collectorObj.alpha ?? 1) as number;
								if (typeof a === 'number' && isFinite(a) && a <= 0.01) return false;
								return true;
							} catch {
								return false;
							}
						})();

						if (!collectorObj || collectorObj.destroyed || !totalCont || totalCont.destroyed || !isCollectorVisible) {
							try { scene?.events?.off?.('update', followFn); } catch {}
							try { delete (totalCont as any).__followFn; } catch {}
							try {
								scene?.tweens?.killTweensOf?.(totalCont);
								scene?.tweens?.add?.({
									targets: totalCont,
									alpha: 0,
									scaleX: (totalCont.scaleX || 1) * 0.01,
									scaleY: (totalCont.scaleY || 1) * 0.01,
									duration: 140,
									ease: 'Sine.easeIn',
									onComplete: () => {
										try { totalDisplay.destroy(); } catch {}
									}
								});
							} catch {
								try { totalDisplay.destroy(); } catch {}
							}
							return;
						}
						const p = getWorldPos(collectorObj);
						const h = getDisplayHeightFallback(collectorObj, collectorHeight);
						collectorTextX = p.x;
						collectorTextY = p.y + h * 0.28 + (host?.moneyValueOffsetY || 0);
						totalCont.x = collectorTextX;
						totalCont.y = collectorTextY;
						try {
							const d = (collectorObj.depth as number) ?? 0;
							totalCont.setDepth(Math.min(20007, Math.max(20005, d + 5)));
						} catch {}
					} catch {}
				};
				(totalCont as any).__followFn = followFn;
				scene.events.on('update', followFn);
				try { followFn(); } catch {}
			} catch {}
			try {
				const b = totalCont.getBounds();
				const symbolWidth = (collectorObj?.displayWidth || host?.displayWidth || 68) as number;
				const targetW = symbolWidth * (host?.moneyValueWidthPaddingFactor || 0.8);
				const targetH = collectorHeight * (host?.moneyValueHeightPaddingFactor || 0.35);
				let autoScale = 1.0;
				if (b && b.width > 0 && b.height > 0) {
					const sx = targetW > 0 ? targetW / b.width : 1.0;
					const sy = targetH > 0 ? targetH / b.height : 1.0;
					autoScale = Math.min(sx, sy);
				}
				const finalScale = autoScale * (host?.moneyValueScaleModifier || 1.0);
				totalCont.setScale(finalScale);
			} catch {}

			const animateCell = async (cell: any): Promise<void> => {
				let symbolObj: any = null;
				try {
					symbolObj = host?.symbols?.[cell.col]?.[cell.row];
				} catch {}
				try {
					if (symbolObj) {
						hideMoneyOverlayForSymbol(host, symbolObj);
					}
				} catch {}

				let center: WorldPoint = symbolObj ? getWorldPos(symbolObj) : getCellCenterFallback(host, cell.col, cell.row);
				const symbolHeight = getDisplayHeightFallback(symbolObj, (host?.displayHeight || 68) as number);
				const fromY = center.y + symbolHeight * 0.28 + (host?.moneyValueOffsetY || 0);

				const useDecimals = cell.value > 0 && cell.value < 1;
				const flyDisplay = new NumberDisplay(networkManager, screenModeManager, {
					x: center.x,
					y: fromY,
					scale: 1.0,
					spacing,
					alignment: 'center',
					decimalPlaces: useDecimals ? 2 : 0,
					showCommas: false,
					prefix: '',
					suffix: '',
					commaYOffset: 0,
					dotYOffset: 0
				});
				flyDisplay.create(scene);
				flyDisplay.displayValue(cell.value);
				const flyCont: any = flyDisplay.getContainer();
				try {
					const d = (collectorObj?.depth as number) ?? 0;
					flyCont.setDepth(Math.min(20007, Math.max(20005, d + 4)));
					try { scene?.children?.bringToTop?.(flyCont); } catch {}
				} catch {
					try { flyCont.setDepth(20005); } catch {}
					try { scene?.children?.bringToTop?.(flyCont); } catch {}
				}
				try { flyCont.setScrollFactor(0); } catch {}
				try {
					const b = flyCont.getBounds();
					const symbolWidth = (symbolObj?.displayWidth || host?.displayWidth || 68) as number;
					const targetW = symbolWidth * (host?.moneyValueWidthPaddingFactor || 0.8);
					const targetH = symbolHeight * (host?.moneyValueHeightPaddingFactor || 0.35);
					let autoScale = 1.0;
					if (b && b.width > 0 && b.height > 0) {
						const sx = targetW > 0 ? targetW / b.width : 1.0;
						const sy = targetH > 0 ? targetH / b.height : 1.0;
						autoScale = Math.min(sx, sy);
					}
					const finalScale = autoScale * (host?.moneyValueScaleModifier || 1.0);
					flyCont.setScale(finalScale);
				} catch {}

				try {
					const sx0 = (flyCont.scaleX || 1) as number;
					const sy0 = (flyCont.scaleY || 1) as number;
					scene.tweens.killTweensOf(flyCont);
					scene.tweens.add({
						targets: flyCont,
						scaleX: sx0 * 2.5,
						scaleY: sy0 * 2.5,
						duration: 325,
						ease: 'Sine.easeInOut',
						yoyo: true,
						repeat: 1
					});
				} catch {}

				await tweenTo(scene, flyCont, {
					x: collectorTextX,
					y: collectorTextY,
					duration: 650,
					ease: 'Sine.easeInOut'
				});

				try {
					if ((totalCont.alpha ?? 0) === 0) {
						totalCont.setAlpha(1);
					}
				} catch {}
				try {
					totalValue += cell.value;
				} catch {}
				try { totalDisplay.displayValue(totalValue); } catch {}
				try {
					scene.tweens.killTweensOf(totalCont);
					const s0x = totalCont.scaleX || 1;
					const s0y = totalCont.scaleY || 1;
					scene.tweens.add({ targets: totalCont, scaleX: s0x * 1.08, scaleY: s0y * 1.08, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
				} catch {}

				await tweenTo(scene, flyCont, {
					scaleX: (flyCont.scaleX || 1) * 0.01,
					scaleY: (flyCont.scaleY || 1) * 0.01,
					duration: 120,
					ease: 'Sine.easeIn'
				});
				try { flyDisplay.destroy(); } catch {}
			};

			if (turboParallelPerCollector) {
				const promises: Array<Promise<void>> = [];
				for (const cell of moneyCells) {
					try {
						promises.push(animateCell(cell));
					} catch {}
				}
				try {
					await Promise.all(promises);
				} catch {}
			} else {
				for (const cell of moneyCells) {
					await animateCell(cell);
				}
			}

			try {
				let cPos: WorldPoint | null = null;
				try {
					if (collectorObj) {
						cPos = getWorldPos(collectorObj);
					}
				} catch {}
				if (!cPos) {
					cPos = getCellCenterFallback(host, collectorCell.col, collectorCell.row);
				}
				try {
					if (collectorObj) {
						try { clearImageSymbolWinRipple(scene, collectorObj); } catch {}
					}
				} catch {}
				try {
					await waitForHookIdle(scene, 6000);
				} catch {}
				try {
					const levelsCompleted = Number((host as any)?.bonusLevelsCompleted) || 0;
					const retriggersConsumed = Number((host as any)?.bonusRetriggersConsumed) || 0;
					const activeStage = Math.max(0, Math.min(levelsCompleted, retriggersConsumed));
					const mult = (gameStateManager.isBonus ? getBonusLevelMultiplierValue(activeStage) : 1);
					const key = (gameStateManager.isBonus ? getBonusLevelMultiplierKey(activeStage) : null);
					if (key && cPos) {
						const symbolW = ((collectorObj?.displayWidth || host?.displayWidth || 68) as number) || 68;
						const symbolH = getDisplayHeightFallback(collectorObj, (host?.displayHeight || 68) as number);
						const d = typeof (collectorObj?.depth) === 'number' ? Math.max(20012, (collectorObj.depth as number) + 15) : 20012;
						await playBonusMultiplierImpact(scene, cPos.x, cPos.y, key, symbolW, symbolH, d);
					}
					if (mult > 1) {
						try {
							const before = totalValue;
							totalValue = totalValue * mult;
							try { totalDisplay.displayValue(totalValue); } catch {}
							await playCollectorValueHighlight(scene, totalCont);
						} catch {}
					}
				} catch {}
			const pendingAwardDelta = totalValue;
			let didApplyAward = false;
			const applyAwardOnce = () => {
				if (didApplyAward) return;
				didApplyAward = true;
				try {
					if (gameStateManager.isBonus && affectTotalsThisCollector) {
						const nextTotal = addDeltaToSpinTotals(spinData, pendingAwardDelta);
						try { scene?.events?.emit?.('bonus-win-delta', pendingAwardDelta); } catch {}
						try { scene?.events?.emit?.('bonus-total-win-updated', nextTotal); } catch {}
						try { (spinData as any).__collectorMoneyApplied = true; } catch {}
					}
				} catch {}
			};

			try {
				scene?.events?.once?.('hook-collector-disintegrate-start', applyAwardOnce);
				scene?.events?.once?.('hook-collector-complete', applyAwardOnce);
			} catch {
				applyAwardOnce();
			}

			let waitPromise: Promise<void> | null = null;
			try {
				waitPromise = waitForSceneEvent(scene, 'hook-collector-complete', 6000);
			} catch {}
			try {
				scene?.events?.emit?.('hook-collector', cPos.x, cPos.y, collectorCell.col, collectorCell.row);
			} catch {}
			if (waitPromise) {
				await waitPromise;
			}
		} catch {}

			try {
				if (collectorObj) {
					try { clearImageSymbolWinRipple(scene, collectorObj); } catch {}
				}
			} catch {}
			try {
				const followFn = (totalCont as any)?.__followFn;
				if (followFn) {
					try { scene?.events?.off?.('update', followFn); } catch {}
					try { delete (totalCont as any).__followFn; } catch {}
				}
			} catch {}
			try { totalDisplay.destroy(); } catch {}
			// __collectorMoneyApplied is set when the award is actually applied.
		}
	} catch {} finally {
		try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
	}
}
