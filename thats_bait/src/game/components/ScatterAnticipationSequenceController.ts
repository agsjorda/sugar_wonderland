import { SCATTER_SYMBOL, SLOT_COLUMNS, SLOT_ROWS } from "../../config/GameConfig";
import { BoilingBubblesEffect } from "./BoilingBubblesEffect";
import { flashRowSymbolsOverlay } from "./SymbolFlash";
import { applyNonWinningSymbolDim, clearNonWinningSymbolDim } from "../effects/NonWinningSymbolDimmer";

type ScatterPos = { x: number; y: number };

export class ScatterAnticipationSequenceController {
	private host: any;
	private scatterPositions: ScatterPos[] = [];
	private scattersByReel: number[] = [];
	private totalScatters: number = 0;
	private revealedScatters: number = 0;
	private symbolValuesGrid?: number[][];
	private symbolsDimmedByAnticipation: boolean = false;
	private lastDimmedReelIndex: number = -1;
	private activeTarget: number | null = null;
	private activeStageReel: number | null = null;
	private lastReelStopped: number = -1;
	private pendingStageTimer?: any;
	private bgDimmedByAnticipation: boolean = false;
	private bubbleEffect?: BoilingBubblesEffect;
	private bubbleEffectKey: string = '__boilingBubblesAnticipationEffect';

	private getActiveTargetPos(): ScatterPos | null {
		try {
			const t = Number(this.activeTarget);
			if (!isFinite(t) || t < 1) return null;
			const pos = this.scatterPositions[t - 1];
			if (!pos) return null;
			if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
			return pos;
		} catch {
			return null;
		}
	}

	constructor(host: any) {
		this.host = host;
	}

	public getActiveTarget(): number | null {
		return this.activeTarget;
	}

	public getTargetReel(target: number): number | null {
		try {
			const t = Number(target);
			if (!isFinite(t) || t < 1) return null;
			const pos = this.scatterPositions[t - 1];
			if (!pos) return null;
			return typeof pos.x === 'number' ? pos.x : null;
		} catch {
			return null;
		}
	}

	public resetForSpin(symbols: number[][], opts?: { disableReelExtensions?: boolean }): boolean[] {
		this.symbolValuesGrid = symbols;
		this.scatterPositions = this.extractScatterPositions(symbols);
		this.scatterPositions.sort((a, b) => (a.x - b.x) || (a.y - b.y));
		this.totalScatters = this.scatterPositions.length;
		this.scattersByReel = new Array<number>(SLOT_COLUMNS).fill(0);
		for (const p of this.scatterPositions) {
			this.scattersByReel[p.x] = (this.scattersByReel[p.x] || 0) + 1;
		}
		this.revealedScatters = 0;
		this.activeTarget = null;
		this.symbolsDimmedByAnticipation = false;
		this.lastDimmedReelIndex = -1;

		const extendReels = new Array<boolean>(SLOT_COLUMNS).fill(false);
		if (!opts?.disableReelExtensions) {
			for (const target of [3, 4, 5]) {
				if (this.totalScatters < target) continue;
				const pos = this.scatterPositions[target - 1];
				if (!pos) continue;
				const reel = pos.x;
				let before = 0;
				for (let c = 0; c < reel; c++) {
					before += (this.scattersByReel[c] || 0);
				}
				if (before >= (target - 1)) {
					extendReels[reel] = true;
				}
			}
		}

		try {
			(this.host.scene as any).__isScatterAnticipationActive = extendReels.some(Boolean);
		} catch {}
		try {
			(this.host.scene as any).__scatterAnticipationStageRunning = false;
		} catch {}

		console.log('[ScatterAnticipationSequence] resetForSpin', {
			totalScatters: this.totalScatters,
			scatterPositions: this.scatterPositions,
			extendReels
		});

		this.stopEffects();
		return extendReels;
	}

	private getActiveSymbolGrid(): any[][] {
		try {
			const base = Array.isArray(this.host?.symbols) ? this.host.symbols : [];
			const next = Array.isArray(this.host?.newSymbols) ? this.host.newSymbols : [];
			const maxCols = Math.max(SLOT_COLUMNS, base.length, next.length);
			const merged: any[][] = new Array(maxCols);
			for (let c = 0; c < maxCols; c++) {
				const baseCol = Array.isArray(base?.[c]) ? base[c] : [];
				const nextCol = Array.isArray(next?.[c]) ? next[c] : [];
				const maxRows = Math.max(SLOT_ROWS, baseCol.length, nextCol.length);
				const colOut: any[] = new Array(maxRows);
				for (let r = 0; r < maxRows; r++) {
					const vNext = nextCol?.[r];
					if (vNext !== null && typeof vNext !== 'undefined') {
						colOut[r] = vNext;
						continue;
					}
					colOut[r] = baseCol?.[r];
				}
				merged[c] = colOut;
			}
			return merged;
		} catch {
			return [];
		}
	}

	private applyAnticipationSymbolDim(): void {
		try {
			const scene: any = this.host?.scene;
			if (!scene) return;
			const maxReel = Math.max(-1, Math.floor(Number(this.lastReelStopped) || -1));
			if (maxReel < 0) return;
			const gridAll = this.getActiveSymbolGrid();
			if (!Array.isArray(gridAll) || gridAll.length === 0) return;

			// Dim the full visible grid during anticipation so the behavior is consistent
			// regardless of which row the target scatter lands on.
			const dimToReel = Math.max(0, Math.min(maxReel, gridAll.length - 1));

			const keepBright = new Set<string>();
			try {
				for (const p of this.scatterPositions) {
					if (!p) continue;
					if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
					if (p.x <= maxReel) {
						keepBright.add(`${p.x}_${p.y}`);
					}
				}
			} catch {}
			// Keep the currently-anticipated (next) scatter position bright too.
			try {
				const activePos = this.getActiveTargetPos();
				if (activePos) {
					keepBright.add(`${activePos.x}_${activePos.y}`);
				}
			} catch {}
			if (keepBright.size === 0) return;

			const grid = gridAll.slice(0, dimToReel + 1);
			const valuesGrid = Array.isArray(this.symbolValuesGrid)
				? this.symbolValuesGrid.slice(0, dimToReel + 1)
				: this.symbolValuesGrid;
			applyNonWinningSymbolDim(scene as any, grid, keepBright, valuesGrid, { darkenBgDepth: false, scaleDown: false });
			this.symbolsDimmedByAnticipation = true;
			this.lastDimmedReelIndex = dimToReel;
		} catch {}
	}

	private clearAnticipationSymbolDim(): void {
		try {
			if (!this.symbolsDimmedByAnticipation) return;
			const scene: any = this.host?.scene;
			if (!scene) return;
			const gridAll = this.getActiveSymbolGrid();
			const maxReel = Math.max(-1, Math.floor(Number(this.lastDimmedReelIndex) || -1));
			if (maxReel < 0) return;
			for (let c = 0; c < gridAll.length; c++) {
				if (c > maxReel) break;
				const col = gridAll[c];
				if (!Array.isArray(col)) continue;
				for (const sym of col) {
					if (!sym) continue;
					try { scene.tweens?.killTweensOf?.(sym); } catch {}
					try { clearNonWinningSymbolDim(scene as any, sym); } catch {}
				}
			}
		} catch {}
		try { this.symbolsDimmedByAnticipation = false; } catch {}
		try { this.lastDimmedReelIndex = -1; } catch {}
	}

	public onReelStopped(reelIndex: number): void {
		this.lastReelStopped = reelIndex;

		let endedStageNow = false;
		let endedTarget: number | null = null;
		try {
			endedTarget = typeof this.activeTarget === 'number' ? this.activeTarget : null;
		} catch {
			endedTarget = null;
		}
		try {
			if (typeof this.activeStageReel === 'number' && isFinite(this.activeStageReel) && reelIndex >= this.activeStageReel) {
				endedStageNow = true;
				this.stopEffects();
			}
		} catch {}

		try {
			this.revealedScatters += (this.scattersByReel[reelIndex] || 0);
		} catch {}

		// During buy-feature anticipation, reels can start/drop sequentially.
		// Re-apply dimming on each reel stop while a stage is active so newly
		// created symbols (including Spine symbols) are consistently dimmed.
		try {
			if (!endedStageNow && typeof this.activeTarget === 'number' && isFinite(this.activeTarget)) {
				if (typeof this.activeStageReel === 'number' && isFinite(this.activeStageReel) && reelIndex < this.activeStageReel) {
					this.applyAnticipationSymbolDim();
				}
			}
		} catch {}

		const nextTarget = this.getNextTarget();
		if (!nextTarget) {
			this.stopEffects();
			return;
		}

		if (this.revealedScatters < nextTarget - 1) {
			this.stopEffects();
			return;
		}

		const pos = this.scatterPositions[nextTarget - 1];
		if (!pos || pos.x <= reelIndex) {
			this.stopEffects();
			return;
		}

		let delayMs = endedStageNow ? this.getUndimGapMs() : 0;
		try {
			const pauseMs = this.getInterStagePauseMs(endedTarget);
			if (pauseMs > 0) {
				delayMs = Math.max(delayMs, pauseMs);
			}
		} catch {}
		this.scheduleStartTarget(nextTarget, pos, delayMs);
	}

	private getInterStagePauseMs(endedTarget: number | null): number {
		try {
			if (endedTarget !== 3) return 0;
			try {
				const isTurbo = !!((this.host.scene as any)?.gameData?.isTurbo);
				if (isTurbo) return 0;
			} catch {}
			try {
				if (typeof (this.host as any)?.isSkipReelDropsActive === 'function') {
					if (!!(this.host as any).isSkipReelDropsActive()) return 0;
				}
			} catch {}
			try {
				if (!!((this.host as any)?.skipReelDropsPending || (this.host as any)?.skipReelDropsActive)) return 0;
			} catch {}
			let v: any;
			try { v = (this.host.scene as any)?.__scatterAnticipationInterStagePauseMs; } catch { v = undefined; }
			const n = Number(v);
			if (isFinite(n)) return Math.max(0, Math.floor(n));
			return this.getUndimGapMs();
		} catch {
			return 0;
		}
	}

	public finish(): void {
		this.stopEffects();
		try {
			(this.host.scene as any).__isScatterAnticipationActive = false;
		} catch {}
	}

	private scheduleStartTarget(target: number, pos: ScatterPos, delayMs: number): void {
		try { this.cancelPendingStage(); } catch {}
		const ms = (typeof delayMs === 'number' && isFinite(delayMs)) ? Math.max(0, Math.floor(delayMs)) : 0;
		if (ms <= 0) {
			this.startTarget(target, pos);
			return;
		}
		try {
			this.pendingStageTimer = this.host.scene?.time?.delayedCall?.(ms, () => {
				try {
					this.pendingStageTimer = undefined;
				} catch {}
				try {
					const next = this.getNextTarget();
					if (next !== target) return;
					if (this.revealedScatters < target - 1) return;
					const curPos = this.scatterPositions[target - 1];
					if (!curPos || curPos.x !== pos.x || curPos.y !== pos.y) return;
					if (curPos.x <= this.lastReelStopped) return;
					this.startTarget(target, pos);
				} catch {}
			});
		} catch {}
	}

	private cancelPendingStage(): void {
		try { this.pendingStageTimer?.destroy?.(); } catch {}
		try { this.pendingStageTimer = undefined; } catch {}
	}

	private getUndimGapMs(): number {
		let v: any = 250;
		try { v = (this.host.scene as any)?.__scatterAnticipationUndimGapMs; } catch {}
		const n = Number(v);
		if (!isFinite(n)) return 250;
		return Math.max(0, Math.floor(n));
	}

	private getActiveBackgroundComponent(): any {
		let bg: any;
		try { bg = (this.host.scene as any)?.background; } catch { bg = undefined; }
		try {
			const bb: any = (this.host.scene as any)?.bonusBackground;
			const bbVisible = !!bb?.getContainer?.()?.visible;
			if (bbVisible) {
				bg = bb;
			}
		} catch {}
		return bg;
	}

	private applyAnticipationBackgroundDim(): void {
		if (this.bgDimmedByAnticipation) return;
		const bg: any = this.getActiveBackgroundComponent();
		try { bg?.darkenDepthForWinSequence?.(); } catch {}
		this.bgDimmedByAnticipation = true;
	}

	private restoreAnticipationBackgroundDim(): void {
		if (!this.bgDimmedByAnticipation) return;
		const bg: any = this.getActiveBackgroundComponent();
		try { bg?.restoreDepthAfterWinSequence?.(); } catch {}
		this.bgDimmedByAnticipation = false;
	}

	private getNextTarget(): number | null {
		if (this.totalScatters < 3) return null;
		if (this.revealedScatters < 3) return 3;
		if (this.totalScatters < 4) return null;
		if (this.revealedScatters < 4) return 4;
		if (this.totalScatters < 5) return null;
		if (this.revealedScatters < 5) return 5;
		return null;
	}

	private startTarget(target: number, pos: ScatterPos): void {
		try { this.cancelPendingStage(); } catch {}
		try { this.applyAnticipationBackgroundDim(); } catch {}

		const stageKey = `${target}_${pos.x}_${pos.y}`;
		if (this.activeTarget === target) {
			try {
				const cur = (this.host.scene as any).__scatterAnticipationStageKey;
				if (cur === stageKey) {
					return;
				}
			} catch {}
		}

		this.activeTarget = target;
		this.activeStageReel = pos.x;
		try { (this.host.scene as any).__scatterAnticipationStageKey = stageKey; } catch {}
		try { (this.host.scene as any).__scatterAnticipationStageRunning = true; } catch {}

		try {
			const flashHost: any = {
				...this.host,
				symbols: Array.isArray(this.host?.newSymbols) && this.host.newSymbols.length > 0 ? this.host.newSymbols : this.host.symbols,
			};
			flashRowSymbolsOverlay(flashHost, pos.y);
		} catch {}
		try { this.applyAnticipationSymbolDim(); } catch {}

		const { x, symbolTotalWidth, symbolTotalHeight } = this.getCellCenter(pos.x, pos.y);
		const emitYOffsetPx = this.getBubbleEmitYOffsetPx();
		const bottomRowCenterY = this.getCellCenter(pos.x, SLOT_ROWS - 1).y;
		const emitY = bottomRowCenterY + symbolTotalHeight * 2;

		let bb: any;
		let reused = false;
		try { bb = (this.host.scene as any)[this.bubbleEffectKey]; } catch { bb = undefined; }
		if (!bb) {
			bb = new BoilingBubblesEffect(this.host.scene, {
				x,
				y: emitY,
				emitOffsetY: emitYOffsetPx,
				depth: 877,
				textureKey: 'anticipation-bubble',
				overlaySpineKey: 'Bubble_Sparkle_VFX',
				overlaySpineAnimation: 'loop_Emitter 1',
				overlaySpineDepthOffset: 6,
				overlaySpineScale: 0.8,
				overlaySpineScaleX: 0.8,
				overlaySpineScaleY: 1,
				overlaySpineOffsetX: 0,
				overlaySpineOffsetY: -140,
				overlaySpineAlpha: 1,
				overlaySpineTimeScale: 1,
				spawnPerSecond: 60,
				spreadX: Math.max(16, Math.floor(symbolTotalWidth * 0.35)),
				riseDistanceMin: Math.max(250, Math.floor(symbolTotalHeight * 1)),
				riseDistanceMax: Math.max(350, Math.floor(symbolTotalHeight * 2)),
				lifeMinMs: 750,
				lifeMaxMs: 800,
				scaleMin: 0.05,
				scaleMax: 0.1,
				alphaMin: 0.95,
				alphaMax: 1,
			});
			try { (this.host.scene as any)[this.bubbleEffectKey] = bb; } catch {}
			try { bb.setMask?.((this.host as any)?.gridMask); } catch {}
		} else {
			reused = true;
			try { bb.stopSpawning?.(); } catch {}
			try {
				if (typeof bb.clearBubbles === 'function') {
					bb.clearBubbles();
				} else {
					bb.stop?.();
				}
			} catch {}
			try { bb.setPosition?.(x, emitY); } catch {}
			try { bb.setEmitOffsetY?.(emitYOffsetPx); } catch {}
			try { bb.setMask?.((this.host as any)?.gridMask); } catch {}
		}

		this.bubbleEffect = bb;
		try {
			if (reused) {
				this.bubbleEffect?.start?.(false);
			} else {
				this.bubbleEffect?.start?.(true);
			}
		} catch {}

		console.log('[ScatterAnticipationSequence] stage', {
			reelStopped: pos.x,
			target,
			pos,
			revealedScatters: this.revealedScatters,
			totalScatters: this.totalScatters
		});
	}

	private stopEffects(): void {
		try { this.cancelPendingStage(); } catch {}
		this.activeTarget = null;
		this.activeStageReel = null;
		try { delete (this.host.scene as any).__scatterAnticipationStageKey; } catch {}
		try { (this.host.scene as any).__scatterAnticipationStageRunning = false; } catch {}
		try { this.clearAnticipationSymbolDim(); } catch {}
		try { this.restoreAnticipationBackgroundDim(); } catch {}
		try {
			const isSkipActive = (() => {
				try {
					if (typeof (this.host as any)?.isSkipReelDropsActive === 'function') {
						return !!(this.host as any).isSkipReelDropsActive();
					}
				} catch {}
				try {
					return !!((this.host as any)?.skipReelDropsPending || (this.host as any)?.skipReelDropsActive);
				} catch {}
				return false;
			})();

			const bb: any = (this.host.scene as any)[this.bubbleEffectKey];
			if (isSkipActive && bb && typeof bb.stop === 'function') {
				bb.stop();
			} else if (bb && typeof bb.stopGracefully === 'function') {
				bb.stopGracefully();
			} else if (bb && typeof bb.stopSpawning === 'function') {
				bb.stopSpawning();
			}
		} catch {}
	}

	private extractScatterPositions(symbols: number[][]): ScatterPos[] {
		const out: ScatterPos[] = [];
		const scatterVal = SCATTER_SYMBOL[0];
		for (let col = 0; col < SLOT_COLUMNS; col++) {
			const column = symbols?.[col];
			if (!Array.isArray(column)) continue;
			for (let row = 0; row < SLOT_ROWS; row++) {
				if (column[row] === scatterVal) {
					out.push({ x: col, y: row });
				}
			}
		}
		return out;
	}

	private getCellCenter(col: number, row: number): { x: number; y: number; symbolTotalWidth: number; symbolTotalHeight: number } {
		const symbolTotalWidth = this.host.displayWidth + (this.host.horizontalSpacing || 0);
		const symbolTotalHeight = this.host.displayHeight + (this.host.verticalSpacing || 0);
		const startX = this.host.slotX - this.host.totalGridWidth * 0.5;
		const startY = this.host.slotY - this.host.totalGridHeight * 0.5;
		const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
		const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
		return { x, y, symbolTotalWidth, symbolTotalHeight };
	}

	private getBubbleEmitYOffsetPx(): number {
		let v: any = 0;
		try { v = (this.host.scene as any)?.__scatterBubbleEmitYOffsetPx; } catch {}
		if (!(typeof v === 'number' && isFinite(v))) {
			try { v = (this.host as any)?.__scatterBubbleEmitYOffsetPx; } catch {}
		}
		const n = Number(v);
		if (!isFinite(n)) return 0;
		return n;
	}
}
