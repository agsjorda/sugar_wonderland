import { NumberDisplay } from './NumberDisplay';
import { getMoneyValueForCell } from './Symbol5VariantHelper';
import { applyImageSymbolWinRipple, clearImageSymbolWinRipple } from '../effects/SymbolImageWinRipple';
import { clearNonWinningSymbolDim } from '../effects/NonWinningSymbolDimmer';

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
		const mgr: any = host?.moneyValueOverlayManager;
		if (!mgr || typeof mgr.getOverlayContainers !== 'function') {
			return;
		}
		const list: any[] = mgr.getOverlayContainers();
		for (const cont of list) {
			try {
				if (!cont) continue;
				if ((cont as any).__ownerSymbol !== symbolObj) continue;
				try { (host?.scene as any)?.tweens?.killTweensOf?.(cont); } catch {}
				try { cont.setVisible(false); } catch {}
				try { cont.setAlpha(0); } catch {}
			} catch {}
		}
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

export async function runCollectorMoneySequence(host: any, spinData: any): Promise<void> {
	try {
		const scene: any = host?.scene;
		const area: any[][] = spinData?.slot?.area;
		if (!scene || !Array.isArray(area)) {
			return;
		}

		const collectors = findCollectors(area);
		if (!collectors.length) {
			return;
		}
		const collectorCount = collectors.length;
		const collectorCell = collectors[0];

		const moneyCells = getMoneyCells(area, spinData);
		if (!moneyCells.length) {
			return;
		}

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

		const networkManager = scene?.networkManager;
		const screenModeManager = scene?.screenModeManager;
		if (!networkManager || !screenModeManager) {
			return;
		}

		const collectorHeight = getDisplayHeightFallback(collectorObj, (host?.displayHeight || 68) as number);
		let collectorTextX = collectorPos.x;
		let collectorTextY = collectorPos.y + collectorHeight * 0.28 + (host?.moneyValueOffsetY || 0);

		let useDecimalsTotal = false;
		try {
			useDecimalsTotal = moneyCells.some(c => typeof c.value === 'number' && c.value > 0 && c.value < 1);
		} catch {}

		let totalValue = 0;
		const spacing = typeof host?.moneyValueSpacing === 'number' ? host.moneyValueSpacing : 1;
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
		totalDisplay.displayValue(0);
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

		for (const cell of moneyCells) {
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
					scaleX: sx0 * 1.22,
					scaleY: sy0 * 1.22,
					duration: 180,
					ease: 'Sine.easeOut',
					yoyo: false
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
			totalValue += cell.value * collectorCount;
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
		}

		for (const c of collectors) {
			try {
				let cObj: any = null;
				let cPos: WorldPoint | null = null;
				try {
					cObj = host?.symbols?.[c.col]?.[c.row];
					if (cObj) {
						cPos = getWorldPos(cObj);
					}
				} catch {}
				if (!cPos) {
					cPos = getCellCenterFallback(host, c.col, c.row);
				}
				scene?.events?.emit?.('hook-collector', cPos.x, cPos.y, c.col, c.row);
			} catch {}
			await waitForSceneEvent(scene, 'hook-collector-complete', 6000);
		}
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
	} catch {}
}
