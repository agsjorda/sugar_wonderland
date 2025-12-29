import { SCATTER_SYMBOL, SLOT_COLUMNS, SLOT_ROWS } from "../../config/GameConfig";
import { BoilingBubblesEffect } from "./BoilingBubblesEffect";
import { flashRowSymbolsOverlay } from "./SymbolFlash";

type ScatterPos = { x: number; y: number };

export class ScatterAnticipationSequenceController {
	private host: any;
	private scatterPositions: ScatterPos[] = [];
	private scattersByReel: number[] = [];
	private totalScatters: number = 0;
	private revealedScatters: number = 0;
	private activeTarget: number | null = null;
	private bubbleEffect?: BoilingBubblesEffect;
	private bubbleEffectKey: string = '__boilingBubblesAnticipationEffect';

	constructor(host: any) {
		this.host = host;
	}

	public resetForSpin(symbols: number[][], opts?: { disableReelExtensions?: boolean }): boolean[] {
		this.scatterPositions = this.extractScatterPositions(symbols);
		this.scatterPositions.sort((a, b) => (a.x - b.x) || (a.y - b.y));
		this.totalScatters = this.scatterPositions.length;
		this.scattersByReel = new Array<number>(SLOT_COLUMNS).fill(0);
		for (const p of this.scatterPositions) {
			this.scattersByReel[p.x] = (this.scattersByReel[p.x] || 0) + 1;
		}
		this.revealedScatters = 0;
		this.activeTarget = null;

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

	public onReelStopped(reelIndex: number): void {
		try {
			this.revealedScatters += (this.scattersByReel[reelIndex] || 0);
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

		this.startTarget(nextTarget, pos);
	}

	public finish(): void {
		this.stopEffects();
		try {
			(this.host.scene as any).__isScatterAnticipationActive = false;
		} catch {}
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
		try { (this.host.scene as any).__scatterAnticipationStageKey = stageKey; } catch {}
		try { (this.host.scene as any).__scatterAnticipationStageRunning = true; } catch {}

		try {
			const flashHost: any = {
				...this.host,
				symbols: Array.isArray(this.host?.newSymbols) && this.host.newSymbols.length > 0 ? this.host.newSymbols : this.host.symbols,
			};
			flashRowSymbolsOverlay(flashHost, pos.y);
		} catch {}

		const { x, y, symbolTotalWidth, symbolTotalHeight } = this.getCellCenter(pos.x, pos.y);
		const emitYOffsetPx = this.getBubbleEmitYOffsetPx();
		const emitY = y + symbolTotalHeight * 2;

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
				spawnPerSecond: 60,
				spreadX: Math.max(16, Math.floor(symbolTotalWidth * 0.35)),
				spreadY: 8,
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
		this.activeTarget = null;
		try { delete (this.host.scene as any).__scatterAnticipationStageKey; } catch {}
		try { (this.host.scene as any).__scatterAnticipationStageRunning = false; } catch {}
		try {
			const bb: any = (this.host.scene as any)[this.bubbleEffectKey];
			if (bb && typeof bb.stopGracefully === 'function') {
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
