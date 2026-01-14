import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines, isWinlinesShowing } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { WinLineDrawer } from './WinLineDrawer';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS, SCATTER_SYMBOL, WINLINES, NORMAL_SYMBOLS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { runDropReels, destroyActiveFillerSymbols } from './ReelDropScript';
import { handleHookScatterHighlight } from './HookScatterHighlighter';
import { runCollectorMoneySequence } from './CollectorMoneySequence';
import { flashAllSymbolsOverlay, flashRowSymbolsOverlay } from './SymbolFlash';
import { applyImageSymbolWinRipple, clearImageSymbolWinRipple } from '../effects/SymbolImageWinRipple';
import { applyNonWinningSymbolDim, clearNonWinningSymbolDim } from '../effects/NonWinningSymbolDimmer';
import { getSymbol5VariantForCell, getSymbol5SpineKeyForVariant, getDefaultSymbol5Variant, getSymbol5ImageKeyForVariant, getSymbol5ImageKeyForCell, getMoneyValueForCell } from './Symbol5VariantHelper';
import { MoneyValueOverlayManager } from './MoneyValueOverlayManager';
import { fakeBonusAPI } from '../../backend/FakeBonusAPI';
import { despawnDynamiteImage, playBoom, playDynamiteOverlay, playMissileStrike, spawnDynamiteImage, waitForCharacterBonusComplete } from './DynamiteSequence';

function resolveBonusCollectorVisualSymbolValue(symbolValue: number, bonusLevelsCompleted: number): number {
  try {
    if (symbolValue !== 11) return symbolValue;
    const lvl = Number(bonusLevelsCompleted) || 0;
    if (lvl >= 3) return 17;
    if (lvl >= 2) return 16;
    if (lvl >= 1) return 15;
    return 11;
  } catch {
    return symbolValue;
  }
}

export class Symbols {
  
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene!: Game;
  public container!: Phaser.GameObjects.Container;
  public displayWidth!: number;
  public displayHeight!: number;
  public horizontalSpacing!: number;
  public verticalSpacing!: number;
  public symbols!: any[][]; // Changed to any to support both Sprite and Spine objects
  public newSymbols!: any[][]; // Changed to any to support both Sprite and Spine objects
  public slotX!: number;
  public slotY!: number;
  public totalGridWidth!: number;
  public totalGridHeight!: number;
  public scatterAnimationManager: ScatterAnimationManager;
  public winLineDrawer!: WinLineDrawer;
  public overlayRect?: Phaser.GameObjects.Graphics;
  public baseOverlayRect?: Phaser.GameObjects.Graphics;
  private scatterForegroundContainer?: Phaser.GameObjects.Container;
  // Flag to control use of legacy black winning overlay graphics
  private baseOverlayBorderUpper?: any;
  private baseOverlayBorderLower?: any;
  private hasEmittedScatterWinStart: boolean = false;
  public currentSpinData: any = null; // Store current spin data for access by other components
  private hasPendingHookScatter: boolean = false;
  private hasPendingCollectorSequence: boolean = false;
	private hasPendingCollectorOnlySequence: boolean = false;
	private hasPendingDynamite: boolean = false;
  private moneyValueOverlayManager?: MoneyValueOverlayManager;
  public moneyValueScaleModifier: number = 0.7;
  public moneyValueOffsetY: number = 0;
  public moneyValueWidthPaddingFactor: number = 0.8;
  public moneyValueHeightPaddingFactor: number = 0.35;
  public moneyValueSpacing: number = 1;
  private scatterHitSfxVolumeMultiplier: number = 2;
  

  // Grid mask configuration and references
  public gridMaskShape?: Phaser.GameObjects.Graphics;
  public gridMask?: Phaser.Display.Masks.GeometryMask;
  public gridMaskPaddingLeft: number = 60;
  public gridMaskPaddingRight: number = 60;
  public gridMaskPaddingTop: number = 10;
  public gridMaskPaddingBottom: number = 30;

  // Base overlay (light grey behind symbols) padding in pixels
  public baseOverlayPaddingLeft: number = 20;
  public baseOverlayPaddingRight: number = 20;
  public baseOverlayPaddingTop: number = 10;
  public baseOverlayPaddingBottom: number = 27; // slightly larger bottom by default
  
  // Skip-drop state
  private skipReelDropsActive: boolean = false;
  private skipReelDropsPending: boolean = false;

  private waveShadersSuppressedDuringSpin: boolean = false;

  // Flash overlay configuration
  public flashOverlayAlphaStart: number = 1;
  public flashOverlayFadeTo: number = 0.0;
  public flashOverlayDurationMs: number = 120;
  public flashOverlaySpeedMultiplier: number = 1.0;
  public winSymbolFlashAlphaStart: number = 0.9;
  public winSymbolFlashFadeTo: number = 0.0;
  public winSymbolFlashDurationMs: number = 120;
  public winSymbolFlashSpeedMultiplier: number = 1.0;

  // Configuration for Spine symbol scales in idle animations - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0:  0.045,   
    1:  0.040, 
    2:  0.050, 
    3:  0.040, 
    4:  0.040,  
    5:  0.040,
    6:  0.045,
    7:  0.045,
    8:  0.040,
    9:  0.040, 
    10: 0.040, 
    11: 0.130,
    12: 0.130,
    13: 0.130,
    14: 0.130,
    15: 0.130,
    16: 0.130,
    17: 0.130
  };

  private spineSymbolRescaleModifierAll: number = 1;
  private spineSymbolRescaleModifierUnknown: number = 1;
  private spineSymbolRescaleModifiers: { [key: number]: number } = {};

	private refreshBonusCollectorVisuals(): void {
		try {
			if (!gameStateManager.isBonus) return;
			const grid: any[][] = this.symbols;
			if (!Array.isArray(grid)) return;
			const area: any[][] = ((this.scene as any)?.currentSymbolData as any[][]) ?? (this.currentSpinData?.slot?.area as any[][]);
			if (!Array.isArray(area)) return;
			const retriggersConsumed = Number((this as any).bonusRetriggersConsumed) || 0;
			const activeLevel = Math.max(0, Math.min(3, retriggersConsumed | 0));
			const visual = resolveBonusCollectorVisualSymbolValue(11, activeLevel);
			if (visual === 11) return;
			const spriteKey = `symbol_${visual}`;
			if (!this.scene?.textures?.exists?.(spriteKey)) return;

			for (let col = 0; col < grid.length; col++) {
				const column = grid[col];
				const areaCol = area[col];
				if (!Array.isArray(column) || !Array.isArray(areaCol)) continue;
				for (let row = 0; row < column.length; row++) {
					try {
						if (areaCol[row] !== 11) continue;
						const sym: any = column[row];
						if (!sym || sym.destroyed) continue;
						const isSpine = !!(sym as any).animationState;
						const parent: any = (sym as any).parentContainer ?? this.container;
						const x = (sym.x ?? 0) as number;
						const y = (sym.y ?? 0) as number;
						const depth = (sym.depth ?? 0) as number;
						const alpha = (sym.alpha ?? 1) as number;
						const visibleFlag = (sym.visible ?? true) as boolean;

						if (!isSpine) {
							try {
								if ((sym.texture?.key ?? '') === spriteKey) continue;
							} catch {}
							try { sym.setTexture(spriteKey); } catch {}
							try {
								const imageScale = this.getImageSymbolScaleMultiplier(visual);
								sym.displayWidth = this.displayWidth * imageScale;
								sym.displayHeight = this.displayHeight * imageScale;
							} catch {}
							try { this.applyIdleWaveShaderIfSymbolImage(sym, visual); } catch {}
							continue;
						}

						try {
							const sprite = this.scene.add.sprite(x, y, spriteKey);
							sprite.setDepth(depth);
							sprite.setAlpha(alpha);
							sprite.setVisible(visibleFlag);
							const imageScale = this.getImageSymbolScaleMultiplier(visual);
							sprite.displayWidth = this.displayWidth * imageScale;
							sprite.displayHeight = this.displayHeight * imageScale;
							try { this.applyIdleWaveShaderIfSymbolImage(sprite, visual); } catch {}
							try {
								if (parent && typeof parent.add === 'function') {
									parent.add(sprite);
								} else {
									this.container?.add?.(sprite);
								}
							} catch {
								try { this.container?.add?.(sprite); } catch {}
							}
							try { sym.destroy?.(); } catch {}
							column[row] = sprite;
						} catch {}
					} catch {}
				}
			}
		} catch {}
	}

  private setupShaderSymbolSpinBehavior(): void {
    try {
      const onReelsStart = () => {
        try { this.disableWaveShadersForSpin(); } catch {}
      };
      const onReelsStop = () => {
        try { this.restoreWaveShadersAfterSpin(); } catch {}
      };

      gameEventManager.on(GameEventType.REELS_START, onReelsStart);
      gameEventManager.on(GameEventType.REELS_STOP, onReelsStop);

      this.scene.events.once('shutdown', () => {
        try { gameEventManager.off(GameEventType.REELS_START, onReelsStart); } catch {}
        try { gameEventManager.off(GameEventType.REELS_STOP, onReelsStop); } catch {}
      });
    } catch {}
  }

  private disableWaveShadersForSpin(): void {
    try {
      if (this.waveShadersSuppressedDuringSpin) {
        return;
      }
      this.waveShadersSuppressedDuringSpin = true;

      const waveKeys = new Set(['symbol_8', 'symbol_9', 'symbol_10']);
      const grids: Array<any[][] | undefined> = [this.symbols, this.newSymbols];

      for (const grid of grids) {
        if (!Array.isArray(grid)) continue;
        for (let col = 0; col < grid.length; col++) {
          const column = grid[col];
          if (!Array.isArray(column)) continue;
          for (let row = 0; row < column.length; row++) {
            const symbol: any = column[row];
            if (!symbol) continue;
            const anySymbol: any = symbol;

            try {
              if (typeof anySymbol.__allowWaveShaderDuringSpin !== 'undefined') {
                delete anySymbol.__allowWaveShaderDuringSpin;
              }
            } catch {}

            const key = anySymbol?.texture?.key;
            if (!waveKeys.has(key)) continue;

            try {
              if (typeof anySymbol.__spinWaveOriginalPipeline === 'undefined') {
                anySymbol.__spinWaveOriginalPipeline = anySymbol.pipeline ?? null;
              }
            } catch {}

            try {
              if (typeof anySymbol.resetPipeline === 'function') {
                anySymbol.resetPipeline();
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  private restoreWaveShadersAfterSpin(): void {
    try {
      if (gameStateManager.isReelSpinning) {
        return;
      }

      this.waveShadersSuppressedDuringSpin = false;

      const waveKeys = new Set(['symbol_8', 'symbol_9', 'symbol_10']);
      const grid = this.symbols;
      if (!Array.isArray(grid)) return;

      for (let col = 0; col < grid.length; col++) {
        const column = grid[col];
        if (!Array.isArray(column)) continue;
        for (let row = 0; row < column.length; row++) {
          const symbol: any = column[row];
          if (!symbol) continue;
          const anySymbol: any = symbol;

          const originalPipeline = anySymbol.__spinWaveOriginalPipeline;
          if (originalPipeline && typeof anySymbol.setPipeline === 'function') {
            try { anySymbol.setPipeline(originalPipeline); } catch {}
            try { delete anySymbol.__spinWaveOriginalPipeline; } catch {}
            continue;
          }
          try { delete anySymbol.__spinWaveOriginalPipeline; } catch {}

          const key = anySymbol?.texture?.key;
          if (!waveKeys.has(key)) continue;

          let symbolValue: number | undefined;
          try {
            const v = (this.currentSymbolData as any)?.[col]?.[row];
            if (typeof v === 'number') {
              symbolValue = v;
            }
          } catch {}

          if (typeof symbolValue !== 'number') {
            try {
              const m = String(key || '').match(/^symbol_(\d+)$/);
              if (m && m[1]) {
                const n = parseInt(m[1], 10);
                if (!Number.isNaN(n)) symbolValue = n;
              }
            } catch {}
          }

          if (typeof symbolValue === 'number') {
            try { this.applyIdleWaveShaderIfSymbolImage(anySymbol, symbolValue); } catch {}
          }
        }
      }
    } catch {}
  }

	private getBackendCollectorCount(spinData: any): number | null {
		try {
			const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
			const items = fs?.items;
			if (Array.isArray(items) && items.length > 0) {
				const v = Number(items[0]?.collectorCount);
				if (isFinite(v) && v >= 0) return v;
				for (const it of items) {
					const vv = Number(it?.collectorCount);
					if (isFinite(vv) && vv >= 0) return vv;
				}
			}
		} catch {}
		return null;
	}

	private computeBonusLevelsCompletedFromCollectorCount(collectorCount: number): number {
		try {
			const c = Number(collectorCount) || 0;
			let levels = 0;
			if (c >= 25) levels += 1;
			if (c >= 42) levels += 1;
			if (c >= 64) levels += 1;
			return Math.max(0, Math.min(3, levels));
		} catch {
			return 0;
		}
	}

	private hasPendingBonusProgressionAtZero(): boolean {
		try {
			if (!gameStateManager.isBonus) return false;
			if (!this.freeSpinAutoplayActive) return false;
			const current = Number(this.freeSpinAutoplaySpinsRemaining) || 0;
			if (current > 0) return false;
			if (this.hasPendingDynamite || this.hasPendingCollectorSequence || this.hasPendingCollectorOnlySequence || this.hasPendingHookScatter) return true;
			if (gameStateManager.isCriticalSequenceLocked) return true;
			if (gameStateManager.isHookScatterActive) return true;
		} catch {}
		return false;
	}

	private scheduleFreeSpinAutoplayResumeAfterRetriggerOverlay(): void {
		try {
			if (this.freeSpinAutoplayTimer) {
				try { this.freeSpinAutoplayTimer.destroy(); } catch {}
				this.freeSpinAutoplayTimer = null;
			}
		} catch {}
		const delayMs = 1000;
		try {
			this.freeSpinAutoplayTimer = this.scene.time.delayedCall(delayMs, () => {
				try { void this.performFreeSpinAutoplay(); } catch {}
			});
		} catch {
			try {
				setTimeout(() => {
					try { void this.performFreeSpinAutoplay(); } catch {}
				}, delayMs);
			} catch {}
		}
	}

	private tryApplyQueuedRetriggerAtZero(): boolean {
		try {
			if (!gameStateManager.isBonus) return false;
			if (!this.freeSpinAutoplayActive) return false;
			const current = Number(this.freeSpinAutoplaySpinsRemaining) || 0;
			if (current > 0) return false;
			try {
				if (fakeBonusAPI.isEnabled() && !fakeBonusAPI.hasMoreFreeSpins()) {
					return false;
				}
			} catch {}
			const levelsCompleted = Number(this.bonusLevelsCompleted) || 0;
			const consumed = Number(this.bonusRetriggersConsumed) || 0;
			const availableCredits = Math.max(0, levelsCompleted - consumed);
			if (availableCredits <= 0) return false;
			let nextStage = Math.max(1, Math.min(3, consumed + 1));
			if (levelsCompleted < nextStage) return false;
			let totalSpins = 10;
			try {
				if (this.pendingBackendRetriggerTotal !== null) {
					const p = Number(this.pendingBackendRetriggerTotal);
					if (isFinite(p) && p > 0) totalSpins = p;
				}
			} catch {}
			const addedSpins = 10;
			this.pendingBackendRetriggerTotal = null;
			try { this.lastAppliedRetriggerTotal = Number(totalSpins); } catch { this.lastAppliedRetriggerTotal = null; }
			try { this.bonusRetriggersConsumed = nextStage; } catch {}
			this.freeSpinAutoplaySpinsRemaining = Math.max(0, totalSpins | 0);
			try { this.refreshBonusCollectorVisuals(); } catch {}
			try { gameStateManager.isBonusFinished = false; } catch {}
			try {
				if (!this.freeSpinAutoplayWaitingForRetriggerOverlay) {
					this.freeSpinAutoplayWaitingForRetriggerOverlay = true;
					this.scene?.events?.once?.('freeSpinRetriggerOverlayClosed', () => {
						try { this.freeSpinAutoplayResumeImmediateOnce = false; } catch {}
						try { this.freeSpinAutoplayWaitingForRetriggerOverlay = false; } catch {}
						try { gameStateManager.isShowingWinDialog = false; } catch {}
						try { this.scheduleFreeSpinAutoplayResumeAfterRetriggerOverlay(); } catch { try { void this.performFreeSpinAutoplay(); } catch {} }
					});
				}
			} catch {}
			try { (this.scene as any)?.events?.emit?.('bonusRetrigger', { addedSpins, totalSpins, stage: nextStage }); } catch {}
			return true;
		} catch {
			return false;
		}
	}

	private shouldWaitForBonusStageCompletionAtZero(): boolean {
		try {
			if (!gameStateManager.isBonus) return false;
			if (!this.freeSpinAutoplayActive) return false;
			const current = Number(this.freeSpinAutoplaySpinsRemaining) || 0;
			if (current > 0) return false;
			const gm: any = (this.scene as any)?.gaugeMeter;
			if (!gm) return false;
			const s1p = Number(gm.stage1Progress) || 0;
			const s2p = Number(gm.stage2Progress) || 0;
			const s3p = Number(gm.stage3Progress) || 0;
			const s1Done = !!gm.stage1CompleteDone;
			const s2Done = !!gm.stage2CompleteDone;
			const s3Done = !!gm.stage3CompleteDone;
			if (s1p >= 4 && !s1Done) return true;
			if (s2p >= 4 && !s2Done) return true;
			if (s3p >= 4 && !s3Done) return true;
			const s1Anim = !!gm.stage1CompleteAnimating;
			const s2Anim = !!gm.stage2CompleteAnimating;
			const s3Anim = !!gm.stage3CompleteAnimating;
			if (s1Anim || s2Anim || s3Anim) return true;
		} catch {}
		return false;
	}

	private waitForBonusStageCompletionSignals(waitMs: number): Promise<void> {
		return new Promise<void>((resolve) => {
			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				try { this.scene?.events?.off?.('bonusStage1Complete', finish); } catch {}
				try { this.scene?.events?.off?.('bonusStage2Complete', finish); } catch {}
				try { this.scene?.events?.off?.('bonusStage3Complete', finish); } catch {}
				resolve();
			};
			try { this.scene?.events?.once?.('bonusStage1Complete', finish); } catch {}
			try { this.scene?.events?.once?.('bonusStage2Complete', finish); } catch {}
			try { this.scene?.events?.once?.('bonusStage3Complete', finish); } catch {}
			try { this.scene?.time?.delayedCall?.(waitMs, finish); } catch {
				try { setTimeout(finish, waitMs); } catch { finish(); }
			}
		});
	}

  private imageSymbolScaleMultipliers: { [key: number]: number } = {
    0:  1.0,
    1:  1.0,
    2:  1.0,
    3:  1.0,
    4:  1.0,
    5:  1.0,
    6:  1.0,
    7:  1.0,
    8:  1.0,
    9:  1.0,
    10: 1.0,
    11: 1.0,
    12: 1.0,
    13: 1.0,
    14: 1.0
  };

  // Store current symbol data for reset purposes
  public currentSymbolData: number[][] | null = null;
  
  // Store free spins data for autoplay
  private pendingFreeSpinsData: { scatterIndex: number; actualFreeSpins: number } | null = null;
  
  // Free spin autoplay state
  public freeSpinAutoplayActive: boolean = false;
  private freeSpinAutoplaySpinsRemaining: number = 0;
  private freeSpinAutoplayTimer: Phaser.Time.TimerEvent | null = null;
  private freeSpinAutoplayWaitingForReelsStop: boolean = false;
  private freeSpinAutoplayWaitingForWinlines: boolean = false;
  private freeSpinAutoplayWaitingForRetriggerOverlay: boolean = false;
  private freeSpinAutoplayResumeImmediateOnce: boolean = false;
  private freeSpinAutoplayTriggered: boolean = false;
  private dialogListenerSetup: boolean = false;
  private bonusCongratsTriggered: boolean = false;
  private bonusStage1Complete: boolean = false;
  private bonusLevelsCompleted: number = 0;
  private bonusRetriggersConsumed: number = 0;
  private pendingBackendRetriggerTotal: number | null = null;
  private lastAppliedRetriggerTotal: number | null = null;
	private lastBonusTotalWin: number | null = null;
  private freeSpinAutoplayProbeSpin: boolean = false;
  // Scatter anticipation overlay
  private scatterOverlay: Phaser.GameObjects.Graphics | null = null;
  
  // Clickable hitbox over the symbol grid to allow skipping during reel drops
  private skipHitbox?: Phaser.GameObjects.Zone;

  public forceStopFreeSpinAutoplay(opts?: { treatAsComplete?: boolean }): void {
    try {
      const treatAsComplete = !!opts?.treatAsComplete;
      if (treatAsComplete) {
        try { this.freeSpinAutoplaySpinsRemaining = 0; } catch {}
      }
      try { this.stopFreeSpinAutoplay(); } catch {}
    } catch {}
  }

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
  }

  private getBackendFreeSpinRemaining(spinData: any): number {
    try {
      const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
      // Prefer items[].spinsLeft (true remaining). Using fs.count can be TOTAL awarded in some payloads
      // (e.g. fake-response.json has count=45 while current remaining is items[0].spinsLeft=15).
      const items = fs?.items;
      if (Array.isArray(items) && items.length > 0) {
        const itemWithSpins = items.find((it: any) => (Number(it?.spinsLeft) || 0) > 0) ?? items[0];
        const v = Number(itemWithSpins?.spinsLeft);
        if (isFinite(v) && v >= 0) return v;
      }
      const c = Number(fs?.count);
      if (isFinite(c) && c >= 0) return c;
    } catch {}
    return 0;
  }

  private syncFreeSpinRemainingFromSpinData(spinData: any): void {
    try {
      if (!this.freeSpinAutoplayActive) return;
      if (!gameStateManager.isBonus) return;

      try {
        const cc = (this as any).getBackendCollectorCount?.(spinData) as number | null;
        if (cc !== null && cc !== undefined) {
          const derived = (this as any).computeBonusLevelsCompletedFromCollectorCount?.(cc) as number;
          const currentLevels = Number(this.bonusLevelsCompleted) || 0;
          if (isFinite(derived) && derived > currentLevels) {
            this.bonusLevelsCompleted = derived;
            try { this.refreshBonusCollectorVisuals(); } catch {}
          }
        }
      } catch {}

      let backend = this.getBackendFreeSpinRemaining(spinData);
      if (!isFinite(backend) || backend < 0) return;

      const current = Number(this.freeSpinAutoplaySpinsRemaining) || 0;
      const expectedAfterSpin = Math.max(0, current - 1);

      const availableCredits = Math.max(0, (Number(this.bonusLevelsCompleted) || 0) - (Number(this.bonusRetriggersConsumed) || 0));

      // If we previously saw a retrigger total but couldn't apply it yet, keep it around.
      if (this.pendingBackendRetriggerTotal !== null) {
        const p = Number(this.pendingBackendRetriggerTotal);
        if (isFinite(p) && p > backend) backend = p;
      }

      let proposed = current;

      // Detect a retrigger candidate (backend remaining jumps by >=10).
      // IMPORTANT: spinsLeft in fake-response.json behaves like "remaining before next spin".
      // If we decrement locally when we trigger a spin, then a retrigger looks like 0 -> 10.
      // But if we are one step behind, it can look like 1 -> 10 (net +9). We therefore compare
      // to the expected post-spin value (current-1) to detect a true +10 award.
      if (backend >= expectedAfterSpin + 10) {
        // IMPORTANT: We must not apply the next batch until the CURRENT batch is fully depleted.
        // Our local remaining counter is decremented immediately when a spin is requested, so
        // "current === 0" is the strict "batch depleted" boundary.
        const canApplyNow = availableCredits > 0 && current <= 0;
        if (!canApplyNow) {
          // Do NOT increase remaining during Level 1 (or before depletion). Store for later.
          this.pendingBackendRetriggerTotal = Math.max(this.pendingBackendRetriggerTotal ?? 0, backend);
          return;
        }
        proposed = backend;
      } else {
        // Normal sync: never allow remaining to increase (prevents sudden jumps mid-level).
        const candA = backend;
        const candB = Math.max(0, backend - 1);
        const candidates = [candA, candB].filter((v) => isFinite(v) && v <= current);
        if (candidates.length === 0) {
          proposed = current;
        } else {
          proposed = candidates.reduce((best, v) => (Math.abs(v - current) < Math.abs(best - current) ? v : best), candidates[0]);
        }
      }

      const added = proposed - current;
      if (added >= 10) {
        try {
          if (this.lastAppliedRetriggerTotal !== null && Number(this.lastAppliedRetriggerTotal) === Number(proposed)) {
            this.freeSpinAutoplaySpinsRemaining = Math.max(0, proposed | 0);
            return;
          }
        } catch {}
        this.pendingBackendRetriggerTotal = null;
        let nextStage = 0;
        try {
          nextStage = (Number(this.bonusRetriggersConsumed) || 0) + 1;
          if (nextStage > 3) nextStage = 3;
          if (nextStage < 0) nextStage = 0;
        } catch {
          nextStage = 0;
        }

        try { this.bonusRetriggersConsumed = nextStage; } catch {}
        try { this.lastAppliedRetriggerTotal = Number(proposed); } catch { this.lastAppliedRetriggerTotal = null; }
        try { this.refreshBonusCollectorVisuals(); } catch {}
        try { gameStateManager.isBonusFinished = false; } catch {}
        if (nextStage >= 1 && nextStage <= 3) {
          try {
            if (!this.freeSpinAutoplayWaitingForRetriggerOverlay) {
              this.freeSpinAutoplayWaitingForRetriggerOverlay = true;
              this.scene?.events?.once?.('freeSpinRetriggerOverlayClosed', () => {
                try { this.freeSpinAutoplayResumeImmediateOnce = false; } catch {}
                try { this.freeSpinAutoplayWaitingForRetriggerOverlay = false; } catch {}
                try { gameStateManager.isShowingWinDialog = false; } catch {}
                try { this.scheduleFreeSpinAutoplayResumeAfterRetriggerOverlay(); } catch { try { void this.performFreeSpinAutoplay(); } catch {} }
              });
            }
          } catch {}
          try { (this.scene as any)?.events?.emit?.('bonusRetrigger', { addedSpins: added, totalSpins: proposed, stage: nextStage }); } catch {}
        }
      }

      this.freeSpinAutoplaySpinsRemaining = Math.max(0, proposed | 0);
    } catch {}
  }

  public restoreSymbolsAboveReelBg(): void {
    try {
      const sceneAny: any = this.scene as any;
      const slotBg: any = sceneAny?.slotBackground;

      const bgDepth = (() => {
        try {
          const d = Number(slotBg?.depth);
          return isFinite(d) ? d : 879;
        } catch {
          return 879;
        }
      })();
      const desiredSymbolsDepth = Math.max(880, bgDepth + 1);

      try {
        if (slotBg && typeof slotBg.setDepth === 'function') {
          if (Number(slotBg.depth) !== bgDepth) {
            slotBg.setDepth(bgDepth);
          }
        }
      } catch {}

      if (this.container) {
        try { this.container.setVisible(true); } catch {}
        try { this.container.setAlpha(1); } catch {}
        try {
          const d = Number((this.container as any).depth);
          if (!isFinite(d) || d < desiredSymbolsDepth) {
            this.container.setDepth(desiredSymbolsDepth);
          }
        } catch {}
        try { this.scene?.children?.bringToTop?.(this.container as any); } catch {}
      }
      if (this.scatterForegroundContainer) {
        try { this.scatterForegroundContainer.setVisible(true); } catch {}
        try { this.scatterForegroundContainer.setAlpha(1); } catch {}
        try {
          const d = Number((this.scatterForegroundContainer as any).depth);
          if (!isFinite(d) || d < desiredSymbolsDepth + 1) {
            this.scatterForegroundContainer.setDepth(desiredSymbolsDepth + 1);
          }
        } catch {}
        try { this.scene?.children?.bringToTop?.(this.scatterForegroundContainer as any); } catch {}
      }

      const ensureAbove = (obj: any) => {
        try {
          if (!obj || obj.destroyed) return;
          const parent: any = (obj as any).parentContainer;
          const parentDepth = (() => {
            try {
              const d = Number(parent?.depth);
              return isFinite(d) ? d : null;
            } catch {
              return null;
            }
          })();
          if (typeof parentDepth === 'number' && parentDepth >= desiredSymbolsDepth) {
            try { parent?.bringToTop?.(obj); } catch {}
            return;
          }
          const cur = (() => {
            try {
              const d = Number((obj as any).depth);
              return isFinite(d) ? d : 0;
            } catch {
              return 0;
            }
          })();
          const next = Math.max(desiredSymbolsDepth, cur);
          try { obj.setDepth?.(next); } catch {}
          try { parent?.bringToTop?.(obj); } catch {}
          try { this.scene?.children?.bringToTop?.(obj); } catch {}
        } catch {}
      };

      try {
        const grids: any[] = [this.symbols, this.newSymbols];
        for (const grid of grids) {
          if (!Array.isArray(grid)) continue;
          for (let c = 0; c < grid.length; c++) {
            const col = grid[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              ensureAbove(col[r]);
            }
          }
        }
      } catch {}
    } catch {}
  }

  public fadeOutAllReelVisuals(durationMs: number = 250): void {
    try {
      if (this.container) {
        this.scene.tweens.killTweensOf(this.container);
        this.scene.tweens.add({ targets: this.container, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { this.container?.setVisible(false); } catch {} } });
      }
      if (this.scatterForegroundContainer) {
        this.scene.tweens.killTweensOf(this.scatterForegroundContainer);
        this.scene.tweens.add({ targets: this.scatterForegroundContainer, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { this.scatterForegroundContainer?.setVisible(false); } catch {} } });
      }
      try {
        if (this.symbols) {
          const preserveScatterSymbols = !!gameStateManager.isBuyFeatureSpin;
          const registeredScatterSymbols: any[] = preserveScatterSymbols && this.scatterAnimationManager
            ? this.scatterAnimationManager.getRegisteredScatterSymbols()
            : [];
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj: any = col[r];
              if (!obj) continue;
              const p = (obj as any).parentContainer as Phaser.GameObjects.Container | undefined;
              if (p !== this.container && p !== this.scatterForegroundContainer) {
                if (preserveScatterSymbols && Array.isArray(registeredScatterSymbols) && registeredScatterSymbols.includes(obj)) {
                  continue;
                }
                try { this.scene.tweens.killTweensOf(obj); } catch {}
                try { this.scene.tweens.add({ targets: obj, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { obj.setVisible?.(false); } catch {} } }); } catch {}
              }
            }
          }
        }
      } catch {}
      try {
        if (this.overlayRect) {
          this.scene.tweens.killTweensOf(this.overlayRect);
          this.scene.tweens.add({ targets: this.overlayRect, alpha: 0, duration: durationMs, ease: 'Cubic.easeIn', onComplete: () => { try { this.overlayRect?.setVisible(false); } catch {} } });
        }
      } catch {}
      try {
        if (this.baseOverlayRect) {
          this.scene.tweens.killTweensOf(this.baseOverlayRect);
          this.baseOverlayRect.setVisible(true);
          this.scene.tweens.add({ targets: this.baseOverlayRect, alpha: 0, duration: durationMs, ease: 'Cubic.easeIn', onComplete: () => { try { this.baseOverlayRect?.setVisible(false); } catch {} } });
        }
      } catch {}
      try { this.scene.time.delayedCall(Math.max(0, durationMs + 50), () => { try { this.clearWinLines(); } catch {} }); } catch {}
    } catch {}
  }

  public requestSkipReelDrops(): void {
    try {
      try { if ((gameStateManager as any).isCriticalSequenceLocked) return; } catch {}
			try {
				if (this.skipReelDropsActive || this.skipReelDropsPending) {
					return;
				}
			} catch {}
			try {
				if (!!(this.scene as any)?.__scatterAnticipationStageRunning) {
					return;
				}
			} catch {}
			try {
				if (!!(this.scene as any)?.__isScatterAnticipationActive) {
					return;
				}
			} catch {}
      // If the player taps skip very early (before the drop tweens exist), we need to
      // remember the intent and re-apply skip tweaks once the spin data arrives and
      // the drop timing is configured.
      this.skipReelDropsPending = true;
      this.skipReelDropsActive = true;
			try { destroyActiveFillerSymbols(this); } catch {}
     
    } catch (e) {
 
    }
  }
  
  /**
   * Clear skip state and restore tween manager timescale.
   * Call once the spin flow has moved beyond reel drops.
   */
  public clearSkipReelDrops(): void {
    try {
      if (!this.skipReelDropsActive) return;
      this.skipReelDropsActive = false;
      this.skipReelDropsPending = false;
      console.log('[Symbols] Skip cleared');
    } catch (e) {
      console.warn('[Symbols] Failed to clear skip state:', e);
    }
  }
  
  public isSkipReelDropsActive(): boolean {
    return !!this.skipReelDropsActive;
  }

  /**
   * Center a Spine instance within a target cell and fit its scale to the cell size.
   * This compensates for skeleton origin offsets and atlas scaling differences.
   */
  public centerAndFitSpine(spine: any, targetCenterX: number, targetCenterY: number, targetWidth: number, targetHeight: number, fallbackScale: number, nudge?: { x: number; y: number }): void {
    try {
      // 1) Fit scale to target cell (with provided fallback)
      const fitted = this.getFittedSpineScale(spine, targetWidth, targetHeight, fallbackScale);
      spine.setScale(fitted);

      // 2) Compute current bounds center in world space and shift to target center
      const b = spine?.getBounds?.();
      const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
      const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
      const offX = (b?.offset?.x ?? 0);
      const offY = (b?.offset?.y ?? 0);
      if (sizeX > 0 && sizeY > 0) {
        const centerWorldX = offX + sizeX * 0.5;
        const centerWorldY = offY + sizeY * 0.5;
        const dx = targetCenterX - centerWorldX;
        const dy = targetCenterY - centerWorldY;
        spine.x += dx;
        spine.y += dy;
      }

      // 3) Optional fine nudge per symbol to correct tiny visual offsets
      if (nudge) {
        spine.x += nudge.x;
        spine.y += nudge.y;
      }
    } catch {}
  }

  public reCenterSpineNextTick(spine: any, targetCenterX: number, targetCenterY: number, nudge?: { x: number; y: number }): void {
    try {
      this.scene.time.delayedCall(0, () => {
        try { spine.update?.(0); } catch {}
        try {
          const b = spine?.getBounds?.();
          const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
          const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
          const offX = (b?.offset?.x ?? 0);
          const offY = (b?.offset?.y ?? 0);
          if (sizeX > 0 && sizeY > 0) {
            const centerWorldX = offX + sizeX * 0.5;
            const centerWorldY = offY + sizeY * 0.5;
            const dx = targetCenterX - centerWorldX;
            const dy = targetCenterY - centerWorldY;
            spine.x += dx;
            spine.y += dy;
          }
          if (nudge) {
            spine.x += nudge.x;
            spine.y += nudge.y;
          }
        } catch {}
      });
    } catch {}
  }

  /** Optional per-symbol micro adjustments (in pixels) after centering) - legacy alias (idle by default) */
  public getSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    return this.getIdleSymbolNudge(symbolValue);
  }

  /** Idle animation nudges (used for post-drop idle conversions) */
  public getIdleSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Tweak these to align idle placement precisely per symbol
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
  }

  /** Win animation nudges (used for win/hit animations, etc.) */
  public getWinSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Provide separate offsets for win/hit animations if their bounds differ
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
  }

  public createScatterOverlay(): void {
    try {
      if (this.scatterOverlay) {
        this.scatterOverlay.destroy();
      }
      
      const bounds = this.getSymbolGridBounds();
      const padding = 110; // Extra padding around the grid
      
      this.scatterOverlay = this.scene.add.graphics();
      this.scatterOverlay.fillStyle(0x000000, 0.7); // 80% opacity black
      
      this.scatterOverlay.fillRect(
        bounds.x - padding,
        bounds.y - padding,
        bounds.width + padding * 2,
        bounds.height + padding * 2
      );
      
      this.scatterOverlay.setDepth(29000); // Just below scatter anticipation (30000)
      this.scatterOverlay.setAlpha(0); // Start transparent
      this.scene.add.existing(this.scatterOverlay);
    } catch (error) {
      console.error('[Symbols] Error creating scatter overlay:', error);
    }
  }

  private createBaseOverlayRect(): void {
    try {
      if (this.baseOverlayRect) {
        this.baseOverlayRect.destroy();
      }
      this.baseOverlayRect = this.scene.add.graphics();

      // Draw legacy base overlay fully transparent so only reel background is visible
      this.baseOverlayRect.fillStyle(0xE5E5E5, 0.0);
      const gridBounds = this.getSymbolGridBounds();

      const padL = this.baseOverlayPaddingLeft;
      const padR = this.baseOverlayPaddingRight;
      const padT = this.baseOverlayPaddingTop;
      const padB = this.baseOverlayPaddingBottom;
      this.baseOverlayRect.fillRect(
        gridBounds.x - padL,
        gridBounds.y - padT,
        gridBounds.width + padL + padR,
        gridBounds.height + padT + padB
      );
      // Scene-level depth to sit between background (at -10) and symbols (0)
      this.baseOverlayRect.setDepth(-5);
      // Keep base overlay hidden by default; it can be faded in by overlay effects when needed
      this.baseOverlayRect.setVisible(false);
      console.log('[Symbols] Base light grey grid background created (hidden)');
      // Destroy any existing borders and do not recreate them (no top/bottom border images in this project)
      try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
      try { this.baseOverlayBorderLower?.destroy?.(); } catch {}
      this.baseOverlayBorderUpper = undefined;
      this.baseOverlayBorderLower = undefined;
    } catch (e) {
      console.warn('[Symbols] Failed to create base grid background:', e);
    }
  }

  public create(scene: Game) {
    this.scene = scene;
    this.winLineDrawer = new WinLineDrawer(scene, this);
    initVariables(this);
    createContainer(this);
    this.moneyValueOverlayManager = new MoneyValueOverlayManager(this as any);
    onStart(this);
    onSpinDataReceived(this);
    this.onSpinDone(this.scene);
    this.setupDialogEventListeners();
    this.setupSpinEventListener(); // Re-enabled to clean up symbols at spin start
    this.setupShaderSymbolSpinBehavior();

    // Stage completion gating for re-triggers
    try {
      this.bonusStage1Complete = false;
      this.bonusLevelsCompleted = 0;
      this.bonusRetriggersConsumed = 0;
      this.pendingBackendRetriggerTotal = null;
      this.scene.events.on('bonusStage1Complete', () => {
        try {
          this.bonusStage1Complete = true;
          this.bonusLevelsCompleted = Math.max(Number(this.bonusLevelsCompleted) || 0, 1);
				try { this.refreshBonusCollectorVisuals(); } catch {}
        } catch {}
      });
      this.scene.events.on('bonusStage2Complete', () => {
				try { this.bonusLevelsCompleted = Math.max(Number(this.bonusLevelsCompleted) || 0, 2); } catch {}
				try { this.refreshBonusCollectorVisuals(); } catch {}
      });
      this.scene.events.on('bonusStage3Complete', () => {
				try { this.bonusLevelsCompleted = Math.max(Number(this.bonusLevelsCompleted) || 0, 3); } catch {}
				try { this.refreshBonusCollectorVisuals(); } catch {}
      });
    } catch {}

    this.scene.events.on('flashAllSymbolsNow', () => {
      try {
        this.ensureCleanSymbolState();
        if (this.container) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
        }
        flashAllSymbolsOverlay(this as any);
      } catch {}
    });

    this.scene.events.on('flashAllSymbolsOverlayOnly', () => {
      try {
        if (this.container) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
        }
        flashAllSymbolsOverlay(this as any);
      } catch {}
    });

    this.scene.events.on('flashAllSymbolsOverlayOnlyByRow', (rowDelayMs?: number) => {
      try {
        const sceneAny: any = this.scene as any;
        const delay = Math.max(0, Math.floor((typeof rowDelayMs === 'number' ? rowDelayMs : 60)));

        if (this.container) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
        }

        const rowCount = Math.max(0, (Array.isArray(this.symbols?.[0]) ? this.symbols[0].length : 0));
        for (let row = 0; row < rowCount; row++) {
          const doRow = () => {
            try { flashRowSymbolsOverlay(this as any, row); } catch {}
          };

          if (sceneAny?.time?.delayedCall) {
            sceneAny.time.delayedCall(row * delay, doRow);
          } else {
            setTimeout(doRow, row * delay);
          }
        }
      } catch {}
    });

    // Create a persistent light grey, semi-transparent background behind the symbol grid
    this.createBaseOverlayRect();

    // Listen for a full free spin reset request (after congrats/bonus end)
    try {
      if (this.winLineDrawer) {
        const hasActive = this.winLineDrawer.hasActiveLines();
        const isManual = !gameStateManager.isAutoPlaying;
        if (isManual || !hasActive) {
          this.winLineDrawer.stopLooping();
          this.winLineDrawer.clearLines();
        }
      }
    } catch {}
    this.createSkipHitbox();
  }

  private beginSpinPhase(): void {
    try { this.clearWinLines(); } catch {}
    try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
    try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
  }

  private beginWinPhase(): void {
    try { this.clearSkipReelDrops(); } catch {}
  }

  private endWinPhase(): void {
    try { this.ensureSymbolsVisibleAfterAutoplayStop(); } catch {}
  }

  private endSpinPhase(): void {
    try {
      let hasWins = false;
      try { hasWins = this.hasCurrentWins(); } catch {}
      if (hasWins) {
        return;
      }
      try { this.clearSkipReelDrops(); } catch {}
      try { this.ensureSymbolsVisibleAfterAutoplayStop(); } catch {}
    } catch {}
  }

  private createSkipHitbox(): void {
    try {
      // Destroy any previous hitbox to avoid duplicates
      try { this.skipHitbox?.destroy(); } catch {}
      
      const zone = this.scene.add.zone(
        this.slotX,
        this.slotY,
        this.totalGridWidth,
        this.totalGridHeight
      ).setOrigin(0.5, 0.5);
      
      // Keep the zone invisible but above symbols
      zone.setDepth(20);
      // Disabled by default; only active while reels are spinning
      zone.disableInteractive();
      
      // Click to skip while spinning (disabled when turbo is ON)
      zone.on('pointerdown', () => {
        try {
          try { if ((gameStateManager as any).isCriticalSequenceLocked) return; } catch {}
				try {
					if (!!(this.scene as any)?.__scatterAnticipationStageRunning) {
						return;
					}
				} catch {}
				try {
					if (!!(this.scene as any)?.__isScatterAnticipationActive) {
						return;
					}
				} catch {}
          if (gameStateManager.isShowingWinDialog) return;
          if (gameStateManager.isReelSpinning && !gameStateManager.isTurbo) {
            this.requestSkipReelDrops();
          }
        } catch {}
      });
      
      this.skipHitbox = zone as Phaser.GameObjects.Zone;
      
      // Enable/disable around spin lifecycle
      const enable = () => {
        try { this.updateSkipHitboxGeometry(); } catch {}
        const blockForAnticipation = (() => {
          try {
            return !!((this.scene as any)?.__isScatterAnticipationActive || (this.scene as any)?.__scatterAnticipationStageRunning);
          } catch {
            return false;
          }
        })();
        if (blockForAnticipation || gameStateManager.isTurbo || gameStateManager.isShowingWinDialog) {
          try { this.skipHitbox?.disableInteractive(); } catch {}
        } else {
          try { this.skipHitbox?.setInteractive({ useHandCursor: false }); } catch {}
        }
      };
      const disable = () => {
        try { this.skipHitbox?.disableInteractive(); } catch {}
      };
      gameEventManager.on(GameEventType.REELS_START, enable);
      gameEventManager.on(GameEventType.REELS_STOP, disable);
      // React to turbo toggles: disable on TURBO_ON, enable on TURBO_OFF only if spinning
      const onTurboOn = () => { try { this.skipHitbox?.disableInteractive(); } catch {} };
      const onTurboOff = () => { try { if (gameStateManager.isReelSpinning) enable(); } catch {} };
      gameEventManager.on(GameEventType.TURBO_ON, onTurboOn);
      gameEventManager.on(GameEventType.TURBO_OFF, onTurboOff);
      
      // Cleanup listeners and object on shutdown
      this.scene.events.once('shutdown', () => {
        try { gameEventManager.off(GameEventType.REELS_START, enable); } catch {}
        try { gameEventManager.off(GameEventType.REELS_STOP, disable); } catch {}
        try { gameEventManager.off(GameEventType.TURBO_ON, onTurboOn); } catch {}
        try { gameEventManager.off(GameEventType.TURBO_OFF, onTurboOff); } catch {}
        try { this.skipHitbox?.destroy(); this.skipHitbox = undefined; } catch {}
      });
    } catch {}
  }
  
  /** Ensure the skip hitbox tracks the symbol grid geometry */
  private updateSkipHitboxGeometry(): void {
    try {
      if (!this.skipHitbox) return;
      this.skipHitbox.setPosition(this.slotX, this.slotY);
      try { (this.skipHitbox as any).setSize(this.totalGridWidth, this.totalGridHeight); } catch {}
    } catch {}
  }
  
  /**
   * Speed up active tweens for all objects in the symbol grid containers
   */
  private accelerateActiveSymbolTweens(timeScale: number): void {
    try {
      const accel = (obj: any) => {
        try {
          const tweens = this.scene.tweens.getTweensOf(obj) as any[];
          if (Array.isArray(tweens)) {
            for (const t of tweens) {
              try { (t as any).timeScale = Math.max(1, timeScale); } catch {}
            }
          }
        } catch {}
      };
      // Existing symbols
      try {
        if (this.symbols) {
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) accel(obj);
            }
          }
        }
      } catch {}
      // New symbols currently dropping
      try {
        if (this.newSymbols) {
          for (let c = 0; c < this.newSymbols.length; c++) {
            const col = this.newSymbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) accel(obj);
            }
          }
        }
      } catch {}
      // Any filler/new objects inside the primary symbols container
      try {
        const list: any[] = (this.container as any)?.list || [];
        for (const child of list) accel(child);
      } catch {}
      // Foreground scatter container (anticipation overlays)
      try {
        const list: any[] = (this.scatterForegroundContainer as any)?.list || [];
        for (const child of list) accel(child);
      } catch {}
      // Overlays
      try { if (this.overlayRect) accel(this.overlayRect); } catch {}
      try { if (this.baseOverlayRect) accel(this.baseOverlayRect); } catch {}
    } catch {}
  }

  private pruneOrphanSymbolsInContainer(): void {
    try {
      if (!this.container) return;
      const keep = new Set<any>();
      try {
        if (this.symbols) {
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) keep.add(obj);
            }
          }
        }
      } catch {}
      try {
        if (this.newSymbols) {
          for (let c = 0; c < this.newSymbols.length; c++) {
            const col = this.newSymbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) keep.add(obj);
            }
          }
        }
      } catch {}

      try {
        if (this.moneyValueOverlayManager) {
          const overlayContainers = this.moneyValueOverlayManager.getOverlayContainers();
          for (const cont of overlayContainers) {
            if (cont) {
              keep.add(cont);
            }
          }
        }
      } catch {}
      const list: any[] = (this.container as any)?.list || [];
      for (const child of list) {
        if (!keep.has(child)) {
          try {
            (this.container as any).remove(child, true);
          } catch {
            try { (child as any).destroy?.(); } catch {}
          }
        }
      }
    } catch {}
  }

  private setupSpinEventListener() {
    // Listen for spin events to reset any lingering Spine symbols
    gameEventManager.on(GameEventType.SPIN, () => {
      console.log('[Symbols] Spin event detected, ensuring clean state');
      
      // CRITICAL: Block autoplay spin actions if win dialog is showing, but allow manual spins
      // This fixes the timing issue where manual spin symbol cleanup was blocked
      if (gameStateManager.isShowingWinDialog && gameStateManager.isAutoPlaying) {
        console.log('[Symbols] Autoplay SPIN event BLOCKED - win dialog is showing');
        console.log('[Symbols] Manual spins are still allowed to proceed');
        return;
      }

      try { this.disableWaveShadersForSpin(); } catch {}
      // using the *previous* spin's symbol data before the new spin result arrives.
      try { this.ensureCleanSymbolState(); } catch {}
      // Clean up any orphaned display objects from previous spins
      try { this.pruneOrphanSymbolsInContainer(); } catch {}
      this.beginSpinPhase();
    });
    
    // Listen for winline completion to resume autoplay and end win phase
    gameEventManager.on(GameEventType.WIN_STOP, async () => {
      console.log('[Symbols] WIN_STOP event received - resuming autoplay');
      console.log('[Symbols] freeSpinAutoplayWaitingForReelsStop:', this.freeSpinAutoplayWaitingForReelsStop);
      console.log('[Symbols] freeSpinAutoplayActive:', this.freeSpinAutoplayActive);

			const gameSceneAny: any = this.scene as any;

			// If this spin has a dynamite special pending, let the dynamite flow own the collector
			// sequence (it will run collector after mutating the grid). Prevent an earlier collector
			// sequence from firing on the pre-dynamite grid.
			try {
				let hasDynamite = false;
				try {
					const spinData = this.currentSpinData;
					const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
					if (special && special.action === 'dynamite') {
						const grid: any[][] | undefined = (Array.isArray(special.items) && Array.isArray(special.items[0]))
							? special.items
							: spinData?.slot?.money;
						if (Array.isArray(grid) && Array.isArray(grid[0])) {
							for (let c = 0; c < grid.length && !hasDynamite; c++) {
								const colArr = grid[c];
								if (!Array.isArray(colArr)) continue;
								for (let r = 0; r < colArr.length; r++) {
									const v = Number(colArr[r] ?? 0);
									if (isFinite(v) && v > 0) {
										hasDynamite = true;
										break;
									}
								}
							}
						}
					}
				} catch {}
				if (this.hasPendingDynamite && hasDynamite) {
					try { this.hasPendingCollectorSequence = false; } catch {}
					try { this.hasPendingCollectorOnlySequence = false; } catch {}
				}
			} catch {}

	      try {
	        const spinData = this.currentSpinData;
	        if (this.hasPendingCollectorSequence || this.hasPendingCollectorOnlySequence) {
					const wasCollectorOnly = !!this.hasPendingCollectorOnlySequence;
					this.hasPendingCollectorSequence = false;
					this.hasPendingCollectorOnlySequence = false;

          const runSeq = async () => {
            try {
              this.clearWinLines();
            } catch {}
            try {
              const grid: any[][] = this.symbols;
              if (Array.isArray(grid)) {
                for (const col of grid) {
                  if (!Array.isArray(col)) continue;
                  for (const sym of col) {
                    if (!sym) continue;
                    try { this.scene.tweens.killTweensOf(sym); } catch {}
                    try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
                  }
                }
              }
            } catch {}
            try {
              const bg: any = (this.scene as any).background;
              bg?.restoreDepthAfterWinSequence?.();
            } catch {}
            try {
              if (spinData) {
                this.updateMoneyValueOverlays(spinData);
              }
              try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
            } catch {}
            try {
							if (wasCollectorOnly) {
								try { console.log('[Symbols] Running collector-only bonus sequence (no money values)'); } catch {}
							}
              await runCollectorMoneySequence(this as any, spinData);
            } catch {}
          };

          let hasRetriggerOverlay = false;
          try {
            const sp: any = (this.scene as any)?.scene;
            hasRetriggerOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
          } catch {}
				const enqueueOrRun = async () => {
					if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.enqueueBonusOverlay === 'function') {
						gameSceneAny.enqueueBonusOverlay(async () => {
							try { await runSeq(); } catch {}
						});
					} else {
						await runSeq();
					}
				};
				if (hasRetriggerOverlay) {
					try { this.scene.events.once('freeSpinRetriggerOverlayClosed', () => { void enqueueOrRun(); }); } catch { void enqueueOrRun(); }
				} else {
					await enqueueOrRun();
				}
        }
      } catch {}

			try {
				const spinData = this.currentSpinData;
				let hasDynamite = false;
				try {
					const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
					if (special && special.action === 'dynamite') {
						const grid: any[][] | undefined = (Array.isArray(special.items) && Array.isArray(special.items[0]))
							? special.items
							: spinData?.slot?.money;
						if (Array.isArray(grid) && Array.isArray(grid[0])) {
							for (let c = 0; c < grid.length && !hasDynamite; c++) {
								const colArr = grid[c];
								if (!Array.isArray(colArr)) continue;
								for (let r = 0; r < colArr.length; r++) {
									const v = Number(colArr[r] ?? 0);
									if (isFinite(v) && v > 0) {
										hasDynamite = true;
										break;
									}
								}
							}
						}
					}
				} catch {}

				if (this.hasPendingDynamite && hasDynamite) {
					this.hasPendingDynamite = false;
					const alreadyHandled = !!(spinData as any)?.__dynamiteHandled;

					const runDynamite = async () => {
						const slotController = (this.scene as any)?.slotController;
						let locked = false;
						try { slotController?.setExternalControlLock?.(true); locked = true; } catch {}
						try {
							try {
								if (this.winLineDrawer) {
									this.winLineDrawer.stopLooping();
									this.winLineDrawer.clearLines();
								}
							} catch {}
							try { this.clearWinLines(); } catch {}
							try {
								const grid: any[][] = this.symbols;
								if (Array.isArray(grid)) {
									for (const col of grid) {
										if (!Array.isArray(col)) continue;
										for (const sym of col) {
											if (!sym) continue;
											try { this.scene.tweens.killTweensOf(sym); } catch {}
											try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
										}
									}
								}
							} catch {}
							try {
								await this.handleDynamiteSpecial(spinData);
							} catch {}
							const handled = !!(spinData as any)?.__dynamiteHandled;
							try {
								if (spinData) {
									try {
										const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
										const items: any[] | undefined = fs?.items;
										const it0: any = Array.isArray(items) && items.length > 0 ? items[0] : null;
										const running = Number(it0?.runningWin);
										const sub = Number(it0?.subTotalWin);
										if (isFinite(running) && running >= 0 && isFinite(sub) && sub >= 0) {
											let preAward = Math.max(0, running - sub);
											let paylineWin = 0;
											try {
												const pls: any[] = spinData?.slot?.paylines;
												if (Array.isArray(pls)) {
													for (const pl of pls) {
														const w = Number((pl as any)?.win);
														if (isFinite(w) && w > 0) paylineWin += w;
													}
												}
											} catch {}
											const seeded = preAward + paylineWin;
											try { spinData.slot.totalWin = seeded; } catch {}
											try { if (spinData.slot.freespin) spinData.slot.freespin.totalWin = seeded; } catch {}
											try { if (spinData.slot.freeSpin) spinData.slot.freeSpin.totalWin = seeded; } catch {}
											try { (spinData as any).__collectorMoneyApplied = false; } catch {}
										}
									} catch {}
									this.updateMoneyValueOverlays(spinData);
								}
								try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
							} catch {}
							try {
								if (!alreadyHandled && handled) {
									await runCollectorMoneySequence(this as any, spinData);
								}
							} catch {}
						} finally {
							try {
								const grid: any[][] = this.symbols;
								if (Array.isArray(grid)) {
									for (const col of grid) {
										if (!Array.isArray(col)) continue;
										for (const sym of col) {
											if (!sym) continue;
											try { this.scene.tweens.killTweensOf(sym); } catch {}
											try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
										}
									}
								}
							} catch {}
							try {
								const scAny: any = (this.scene as any);
								let bg: any = scAny?.background;
								try {
									const bb: any = scAny?.bonusBackground;
									const bbVisible = !!bb?.getContainer?.()?.visible;
									if (bbVisible) {
										bg = bb;
									}
								} catch {}
								bg?.restoreDepthAfterWinSequence?.();
							} catch {}
							try { if (locked) slotController?.setExternalControlLock?.(false); } catch {}
						}
						
					};

					let hasRetriggerOverlay = false;
					try {
						const sp: any = (this.scene as any)?.scene;
						hasRetriggerOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
					} catch {}
					const enqueueOrRunDynamite = async () => {
						if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.enqueueBonusOverlay === 'function') {
							gameSceneAny.enqueueBonusOverlay(async () => {
								try { await runDynamite(); } catch {}
							});
						} else {
							await runDynamite();
						}
					};
					if (hasRetriggerOverlay) {
						await new Promise<void>((resolve) => {
							try {
								this.scene.events.once('freeSpinRetriggerOverlayClosed', () => {
									void enqueueOrRunDynamite();
									resolve();
								});
							} catch {
								void enqueueOrRunDynamite();
								resolve();
							}
						});
					} else {
						await enqueueOrRunDynamite();
					}
				}
			} catch {}
      
      // If this spin has a hook-scatter special pending, run it now after winlines
      // and disable/clear any remaining winline visuals to avoid overlap.
			try {
				const spinData = this.currentSpinData;
				let hasHookScatter = false;
				try {
					const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
					if (special && special.action === 'hook-scatter' && special.position) {
						hasHookScatter = true;
					}
				} catch {}

				let skipHookScatter = false;
				try {
					if (gameStateManager.isScatter || gameStateManager.isBonus) {
						skipHookScatter = true;
					}
					if (!skipHookScatter && this.scatterAnimationManager && typeof this.scatterAnimationManager.isAnimationInProgress === 'function') {
						skipHookScatter = !!this.scatterAnimationManager.isAnimationInProgress();
					}
				} catch {}
				if (skipHookScatter) {
					try { this.hasPendingHookScatter = false; } catch {}
					hasHookScatter = false;
				}

				if (this.hasPendingHookScatter && hasHookScatter) {
					this.hasPendingHookScatter = false;
					const runHookScatter = async () => {
						try {
							if (this.winLineDrawer) {
								this.winLineDrawer.stopLooping();
								this.winLineDrawer.clearLines();
							}
						} catch {}
						await new Promise<void>((resolve) => {
							let done = false;
							const finish = () => {
								if (done) return;
								done = true;
								try { this.scene.events.off('hook-scatter-complete', onComplete as any); } catch {}
								resolve();
							};
							const onComplete = () => finish();
							try { this.scene.events.once('hook-scatter-complete', onComplete as any); } catch {}
							try {
								// Trigger hook-scatter highlight AFTER winlines complete
								handleHookScatterHighlight(this as any, spinData);
							} catch {
								finish();
								return;
							}
							try { this.scene.time.delayedCall(6000, () => finish()); } catch { try { setTimeout(() => finish(), 6000); } catch { finish(); } }
						});
					};

					let hasRetriggerOverlay = false;
					try {
						const sp: any = (this.scene as any)?.scene;
						hasRetriggerOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
					} catch {}
					const enqueueOrRunHookScatter = async () => {
						if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.enqueueBonusOverlay === 'function') {
							gameSceneAny.enqueueBonusOverlay(async () => {
								try { await runHookScatter(); } catch {}
							});
						} else {
							await runHookScatter();
						}
					};
					if (hasRetriggerOverlay) {
						await new Promise<void>((resolve) => {
							try {
								this.scene.events.once('freeSpinRetriggerOverlayClosed', () => {
									void enqueueOrRunHookScatter();
									resolve();
								});
							} catch {
								void enqueueOrRunHookScatter();
								resolve();
							}
						});
					} else {
						await enqueueOrRunHookScatter();
					}
				}
			} catch {}
			try {
				if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.waitForBonusOverlayQueueIdle === 'function') {
					await gameSceneAny.waitForBonusOverlayQueueIdle(15000);
				}
			} catch {}
			await this.handleFreeSpinAutoplayWinStop();
      const slotController = (this.scene as any)?.slotController;
      const isLastNormalAutoplaySpin = !!(slotController && slotController.autoplaySpinsRemaining === 0 && !this.freeSpinAutoplayActive);
      if (gameStateManager.isAutoPlaying && !isLastNormalAutoplaySpin) {
        this.endWinPhase();
      }

      resumeAutoplayAfterWinlines(this.scene.gameData);

      // If bonus finished and no win dialog will show, display congrats now
      if (gameStateManager.isBonus && gameStateManager.isBonusFinished && !gameStateManager.isShowingWinDialog) {
        console.log('[Symbols] Bonus finished without win dialog on last spin - showing congrats');
        this.showCongratsDialogAfterDelay();
        gameStateManager.isBonusFinished = false;
      }
    });
    
    // Listen for winline start to pause autoplay and start win visuals
    gameEventManager.on(GameEventType.WIN_START, () => {
      console.log('[Symbols] WIN_START event received - pausing autoplay');
      pauseAutoplayForWinlines(this.scene.gameData);
      this.beginWinPhase();
    });

    // Listen for win dialog close
    gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
      console.log('[Symbols] WIN_DIALOG_CLOSED event received');
      // Reset dialog showing flag
      gameStateManager.isShowingWinDialog = false;

      // If bonus just finished, immediately show congrats and reset flag
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] isBonusFinished is true on WIN_DIALOG_CLOSED - showing congrats now');
        // Show congrats now and reset the flag; bonus mode exit happens on congrats close
        this.showCongratsDialogAfterDelay();
        gameStateManager.isBonusFinished = false;
      }
    });

  }

  public ensureCleanSymbolState(options?: { skipSpineToImageConversion?: boolean }): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    const skipSpineToImageConversion = !!options?.skipSpineToImageConversion || !!gameStateManager.isBuyFeatureSpin;
    
    console.log('[Symbols] Ensuring clean symbol state for spin (converting Spine symbols to WEBP/PNG when possible)');
    try {
      const bg: any = (this.scene as any).background;
      if (bg && typeof bg.restoreDepthAfterWinSequence === 'function') {
        bg.restoreDepthAfterWinSequence();
      }
    } catch {}
    let processedCount = 0;
    let convertedCount = 0;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol: any = this.symbols[col][row];
        if (!symbol) {
          continue;
        }

        try { this.scene?.tweens?.killTweensOf?.(symbol); } catch {}
        try { clearImageSymbolWinRipple(this.scene, symbol); } catch {}
        try { clearNonWinningSymbolDim(this.scene, symbol); } catch {}

        				try {
					if ((symbol as any).animationState) {
						const valueFromData = (this.currentSymbolData as any)?.[col]?.[row];
						if (typeof valueFromData === 'number') {
							if (skipSpineToImageConversion) {
								try { (symbol as any).animationState.clearTracks(); } catch {}
								try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
								continue;
							}
							// Keep these symbols as Spine across spins (do not convert back to image sprites)
							if (valueFromData === 5 || valueFromData === 8 || valueFromData === 9 || valueFromData === 10 || valueFromData === 12 || valueFromData === 13 || valueFromData === 14) {
								try { (symbol as any).animationState.clearTracks(); } catch {}
								try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
								continue;
							}

							let spriteKey: string | null = null;
							if (valueFromData === 5) {
								// Symbol 5: resolve the correct variant image key when possible
								try {
									const spinData: any = this.currentSpinData;
									spriteKey = getSymbol5ImageKeyForCell(spinData, col, row);
								} catch {}

								if (!spriteKey) {
									try {
										spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
									} catch {}
								}

								if (!spriteKey) {
									// Absolute fallback: use the base Symbol 5 image key
									spriteKey = 'symbol_5';
								}
							} else {
								spriteKey = 'symbol_' + valueFromData;
							}

              if (spriteKey && this.scene.textures.exists(spriteKey)) {
                const home = (symbol as any).__pngHome as { x: number; y: number } | undefined;
                const px = home && typeof home.x === 'number' ? home.x : symbol.x;
                const py = home && typeof home.y === 'number' ? home.y : symbol.y;

                let pngSprite: any = null;
                try {
                  pngSprite = this.scene.add.sprite(px, py, spriteKey);
                  const imageScale = this.getImageSymbolScaleMultiplier(valueFromData);
                  pngSprite.displayWidth = this.displayWidth * imageScale;
                  pngSprite.displayHeight = this.displayHeight * imageScale;
                  try { (pngSprite as any).displayWidth = this.displayWidth * imageScale; } catch {}
                  try { (pngSprite as any).displayHeight = this.displayHeight * imageScale; } catch {}
                  try { this.applyIdleWaveShaderIfSymbolImage(pngSprite, valueFromData); } catch {}
                  try { this.container.add(pngSprite); } catch {}
                } catch {
                  pngSprite = null;
                }

                if (pngSprite) {
                  try { this.container.remove(symbol); } catch {}
                  try { symbol.destroy(); } catch {}
                  this.symbols[col][row] = pngSprite;
                  convertedCount++;
                } else {
                  try { (symbol as any).animationState.clearTracks(); } catch {}
                  try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
                }
              } else {
                // Fallback: if we cannot find a PNG texture, at least reset the Spine towards idle scale
                try { (symbol as any).animationState.clearTracks(); } catch {}
                try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
              }
            }
          }
        } catch {}

        processedCount++;
      }
    }

    if (processedCount > 0) {
      console.log(`[Symbols] Cleaned state for ${processedCount} symbols before spin (converted ${convertedCount} Spine symbols to WEBP/PNG)`);
    }
  }

  private clearMoneyValueOverlays(): void {
    try {
      this.moneyValueOverlayManager?.clearOverlays();
    } catch {}
  }

  public updateMoneyValueOverlays(spinData: any, symbolsOverride?: any[][]): void {
    try {
      this.moneyValueOverlayManager?.updateOverlays(spinData, symbolsOverride);
    } catch {}
  }

	private async handleDynamiteSpecial(spinData: any): Promise<void> {
		try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
		try {
			try {
				if (spinData && spinData.slot) {
					const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
					const itemsFs: any[] | undefined = fs?.items;
					const it0: any = Array.isArray(itemsFs) && itemsFs.length > 0 ? itemsFs[0] : null;
					if (it0) {
						try {
							const slotAny: any = spinData.slot;
							if (it0?.special && it0?.special?.action) {
								const nextAction = String(it0.special.action);
								const slotAction = slotAny?.special?.action ? String(slotAny.special.action) : '';
								if (!slotAny.special || !slotAny.special.action || slotAction !== nextAction) {
									slotAny.special = it0.special;
								} else if (!slotAny.special.items && (it0.special as any).items) {
									try { slotAny.special.items = (it0.special as any).items; } catch {}
								}
							}
						} catch {}
						try {
							const slotAny: any = spinData.slot;
							if (!Array.isArray(slotAny.money) && Array.isArray(it0?.money) && Array.isArray(it0?.money?.[0])) {
								slotAny.money = it0.money;
							}
						} catch {}
					}
				}
			} catch {}
			try {
				if ((spinData as any)?.__dynamiteHandled) {
					return;
				}
			} catch {}
			const special: any = spinData?.slot?.special;
			if (!special || special.action !== 'dynamite') {
				return;
			}
			let items: any[][] | undefined = undefined;
			try {
				const raw: any = special.items;
				if (Array.isArray(raw) && Array.isArray(raw[0])) {
					items = raw;
				}
			} catch {}
			if (!items) {
				try {
					const rawMoney: any = spinData?.slot?.money;
					if (Array.isArray(rawMoney) && Array.isArray(rawMoney[0])) {
						items = rawMoney;
					}
				} catch {}
			}
			if (!items) {
				return;
			}

			const area: any[][] = spinData?.slot?.area;
			if (!Array.isArray(area) || !Array.isArray(area[0])) {
				return;
			}

			let hasCollector = false;
			try {
				for (let c = 0; c < area.length; c++) {
					const colArr = area[c];
					if (!Array.isArray(colArr)) continue;
					for (let r = 0; r < colArr.length; r++) {
						const id = colArr[r];
						if (id === 11) {
							hasCollector = true;
						}
						if (hasCollector) break;
					}
					if (hasCollector) break;
				}
			} catch {}
			if (!hasCollector) {
				return;
			}

			let targets: Array<{ col: number; row: number; value: number }> = [];
			try {
				for (let c = 0; c < items.length; c++) {
					const colArr = items[c];
					if (!Array.isArray(colArr)) continue;
					for (let r = 0; r < colArr.length; r++) {
						const v = Number(colArr[r] ?? 0);
						if (!(isFinite(v) && v > 0)) continue;
						try {
							const existingId = area?.[c]?.[r];
							if (existingId === 11) {
								continue;
							}
						} catch {}
						targets.push({ col: c, row: r, value: v });
					}
				}
			} catch {}
			if (!targets.length) {
				return;
			}
			try { (spinData as any).__dynamiteHandled = true; } catch {}

			let money: any[][] | undefined = spinData?.slot?.money;
			if (!Array.isArray(money) || !Array.isArray(money[0])) {
				money = [];
				for (let c = 0; c < SLOT_COLUMNS; c++) {
					money[c] = [];
					for (let r = 0; r < SLOT_ROWS; r++) {
						money[c][r] = 0;
					}
				}
				spinData.slot.money = money;
			}

			try {
				for (const t of targets) {
					try {
						if (area?.[t.col]?.[t.row] === 11) {
							continue;
						}
						if (Array.isArray(area[t.col])) {
							area[t.col][t.row] = 5;
						}
						if (money && Array.isArray(money[t.col])) {
							money[t.col][t.row] = t.value;
						}
					} catch {}
				}
			} catch {}

			try {
				(this.scene as any).currentSymbolData = area;
				this.currentSymbolData = area;
			} catch {}
			try {
				const keepBright = new Set<string>();
				try {
					for (const t of targets) {
						keepBright.add(`${t.col}_${t.row}`);
					}
				} catch {}
				try {
					for (let c = 0; c < area.length; c++) {
						const colArr = area[c];
						if (!Array.isArray(colArr)) continue;
						for (let r = 0; r < colArr.length; r++) {
							if (colArr[r] === 11) {
								keepBright.add(`${c}_${r}`);
							}
						}
					}
				} catch {}
				try {
					applyNonWinningSymbolDim(this.scene as any, this.symbols, keepBright, area as any, { darkenBgDepth: false });
				} catch {}
			} catch {}
			try {
				const x = typeof this.slotX === 'number' ? this.slotX : (this.scene?.scale?.width ?? 0) * 0.5;
				const y = typeof this.slotY === 'number' ? this.slotY : (this.scene?.scale?.height ?? 0) * 0.5;
				await playDynamiteOverlay(this.scene, x, y, 20012);
			} catch {}

			const container: any = this.container;
			const toLocal = (wx: number, wy: number): { x: number; y: number } => {
				try {
					if (container && typeof container.getWorldTransformMatrix === 'function') {
						const m: any = container.getWorldTransformMatrix();
						if (m && typeof m.applyInverse === 'function') {
							const p: any = m.applyInverse(wx, wy);
							return { x: p.x, y: p.y };
						}
					}
				} catch {}
				return { x: wx, y: wy };
			};

			const delay = (ms: number): Promise<void> => {
				return new Promise<void>((resolve) => {
					try { this.scene?.time?.delayedCall?.(ms, () => resolve()); } catch { resolve(); }
				});
			};

			const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
			const placeDurationMs = Math.max(80, Math.floor(140 * speed));
			const despawnDurationMs = Math.max(70, Math.floor(120 * speed));
			const explodeIntervalMs = Math.max(10, Math.floor(35 * speed));

			type DynEntry = {
				t: { col: number; row: number; value: number };
				wx: number;
				wy: number;
				lx: number;
				ly: number;
				bWidth: number;
				bHeight: number;
				dyn: any;
			};

			const entries: DynEntry[] = [];
			try {
				for (const t of targets) {
					let wx = 0;
					let wy = 0;
					let lx = 0;
					let ly = 0;
					let bWidth = 0;
					let bHeight = 0;
					try {
						const sym: any = this.symbols?.[t.col]?.[t.row];
						if (sym && typeof sym.getBounds === 'function') {
							const b = sym.getBounds();
							wx = b.centerX;
							wy = b.centerY;
							bWidth = b.width ?? 0;
							bHeight = b.height ?? 0;
						} else if (sym) {
							wx = sym.x;
							wy = sym.y;
							try { bWidth = sym.displayWidth ?? sym.width ?? 0; } catch {}
							try { bHeight = sym.displayHeight ?? sym.height ?? 0; } catch {}
						}
						const loc = toLocal(wx, wy);
						lx = loc.x;
						ly = loc.y;
					} catch {}

					let dyn: any = null;
					try {
						const key = (this.scene?.textures?.exists?.('crosshair') ? 'crosshair' : (this.scene?.textures?.exists?.('dynamite') ? 'dynamite' : null));
						if (key) {
							dyn = this.scene.add.image(lx, ly, key).setOrigin(0.5, 0.5);
							try { dyn.setDepth?.(20013); } catch {}
							try { this.container.add(dyn); } catch {}
							try {
								const baseW = dyn.width ?? 1;
								const baseH = dyn.height ?? 1;
								const targetW = (bWidth && bWidth > 0) ? bWidth : this.displayWidth;
								const targetH = (bHeight && bHeight > 0) ? bHeight : this.displayHeight;
								const s = Math.max(0.01, Math.min(targetW / baseW, targetH / baseH));
								try { dyn.setScale(s); } catch {}
							} catch {}
						}
					} catch {
						dyn = null;
					}

					entries.push({ t, wx, wy, lx, ly, bWidth, bHeight, dyn });
				}
			} catch {}

			// First: spawn ALL dynamites together.
			try {
				await Promise.all(entries.map(e => spawnDynamiteImage(this.scene, e.dyn, placeDurationMs)));
			} catch {}

			// Then: explode in random order, with a shorter fixed interval.
			try {
				for (let i = entries.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					const tmp = entries[i];
					entries[i] = entries[j];
					entries[j] = tmp;
				}
			} catch {}

			const boomPromises: Promise<void>[] = [];
			let didDarkenBgDepth = false;

			const explodeOne = async (e: DynEntry): Promise<void> => {
				try {
					const tw = (e.bWidth && e.bWidth > 0) ? e.bWidth : this.displayWidth;
					const th = (e.bHeight && e.bHeight > 0) ? e.bHeight : this.displayHeight;
					await playMissileStrike(this.scene, e.wx, e.wy, 20015, tw, th);
				} catch {}

				let boomPromise: Promise<void> | null = null;
				try {
					if (!didDarkenBgDepth) {
						didDarkenBgDepth = true;
						try {
							const scAny: any = (this.scene as any);
							let bg: any = scAny?.background;
							try {
								const bb: any = scAny?.bonusBackground;
								const bbVisible = !!bb?.getContainer?.()?.visible;
								if (bbVisible) {
									bg = bb;
								}
							} catch {}
							bg?.darkenDepthForWinSequence?.();
						} catch {}
					}
					const tw = (e.bWidth && e.bWidth > 0) ? e.bWidth : this.displayWidth;
					const th = (e.bHeight && e.bHeight > 0) ? e.bHeight : this.displayHeight;
					boomPromise = playBoom(this.scene, e.wx, e.wy, 20014, tw, th);
				} catch {
					boomPromise = null;
				}
				try {
					if (boomPromise) {
						boomPromises.push(Promise.resolve(boomPromise).catch(() => {}));
					}
				} catch {}

				try {
					if (e.dyn) {
						const dynToRemove: any = e.dyn;
						e.dyn = null;
						try {
							void despawnDynamiteImage(this.scene, dynToRemove, despawnDurationMs).then(() => {
								try { dynToRemove.destroy?.(); } catch {}
							});
						} catch {
							try { dynToRemove.destroy?.(); } catch {}
						}
					}
				} catch {}

				try {
					const old: any = this.symbols?.[e.t.col]?.[e.t.row];
					let created: any = null;
					try {
						let variant = getSymbol5VariantForCell(spinData, e.t.col, e.t.row) || getDefaultSymbol5Variant();
						let variantInfo = getSymbol5SpineKeyForVariant(variant);
						let spineKey = variantInfo.spineKey;
						let spineAtlasKey = variantInfo.atlasKey;
						const cacheJson: any = (this.scene.cache.json as any);
						let hasSpine = cacheJson?.has?.(spineKey);

						// Extra robustness for Symbol 5: if the exact variant key is missing, fall back to any loaded variant.
						if (!hasSpine) {
							const fallbackVariants = ['Symbol5_Sk8', 'Symbol12_Sk8', 'Symbol13_Sk8', 'Symbol14_Sk8'];
							for (const v of fallbackVariants) {
								try {
									const info = getSymbol5SpineKeyForVariant(v as any);
									if (cacheJson?.has?.(info.spineKey)) {
										spineKey = info.spineKey;
										spineAtlasKey = info.atlasKey;
										hasSpine = true;
										break;
									}
								} catch {}
							}
						}

						const canCreateSpine = hasSpine && (this.scene.add as any)?.spine;
						if (canCreateSpine) {
							try {
								const spineSymbol = (this.scene.add as any).spine(e.lx, e.ly, spineKey, spineAtlasKey);
								spineSymbol.setOrigin(0.5, 0.5);
								try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
								const baseScale = this.getIdleSpineSymbolScale(5);
								try { (spineSymbol as any).__pngHome = { x: e.lx, y: e.ly }; } catch {}
								try { (spineSymbol as any).__pngSize = { w: e.bWidth, h: e.bHeight }; } catch {}
								try { (spineSymbol as any).__pngNudge = this.getIdleSymbolNudge(5) || { x: 0, y: 0 }; } catch {}
								this.centerAndFitSpine(spineSymbol, e.lx, e.ly, e.bWidth, e.bHeight, baseScale, this.getIdleSymbolNudge(5));
								try {
									const m = this.getSpineScaleMultiplier(5) * this.getIdleScaleMultiplier(5);
									if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
								} catch {}
								try { this.container.add(spineSymbol); } catch {}
								created = spineSymbol;
							} catch {}
						}
						if (!created) {
							let imageKey: string | null = null;
							try {
								imageKey = getSymbol5ImageKeyForVariant(variant);
								if (!this.scene.textures.exists(imageKey)) {
									variant = getDefaultSymbol5Variant();
									imageKey = getSymbol5ImageKeyForVariant(variant);
								}
							} catch {}
							if (!imageKey || !this.scene.textures.exists(imageKey)) {
								const candidates = ['symbol_5', 'symbol_12', 'symbol_13', 'symbol_14'];
								const found = candidates.find(k => this.scene.textures.exists(k));
								if (found) {
									imageKey = found;
								}
							}
							if (imageKey && this.scene.textures.exists(imageKey)) {
								const sprite = this.scene.add.sprite(e.lx, e.ly, imageKey);
								const imageScale = (this as any).getImageSymbolScaleMultiplier(5) ?? 1;
								sprite.displayWidth = e.bWidth * imageScale;
								sprite.displayHeight = e.bHeight * imageScale;
								try { (this as any).applyIdleWaveShaderIfSymbolImage?.(sprite, 5); } catch {}
								try { this.container.add(sprite); } catch {}
								created = sprite;
							}
						}
					} catch {}

					if (created) {
						try {
							if (old) {
								try { this.scene.tweens.killTweensOf(old); } catch {}
								try { (old.parentContainer as any)?.remove?.(old); } catch {}
								try { old.destroy?.(); } catch {}
							}
						} catch {}
						try { this.symbols[e.t.col][e.t.row] = created; } catch {}
						try {
							const override: any[][] = [];
							override[e.t.col] = [];
							override[e.t.col][e.t.row] = created;
							this.updateMoneyValueOverlays(spinData, override);
						} catch {}
					}
				} catch {}
			};

			try {
				for (let i = 0; i < entries.length; i++) {
					try { await explodeOne(entries[i]); } catch {}
					if (i < entries.length - 1) {
						await delay(explodeIntervalMs);
					}
				}
			} catch {}

			try { await Promise.all(boomPromises); } catch {}

			try {
				this.updateMoneyValueOverlays(spinData);
				try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
			} catch {}
			try {
				await waitForCharacterBonusComplete(this.scene, 6000);
			} catch {}
			try { (this.scene as any)?.events?.emit?.('dynamite-complete'); } catch {}
		} catch {} finally {
			try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
		}
	}

  private onSpinDone(scene: Game) {
    gameEventManager.on(GameEventType.REELS_STOP, (data: any) => {
      console.log('[Symbols] REELS_STOP event received');
      
      // Check if scatter animation is in progress - if so, don't trigger a new spin
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] REELS_STOP received during scatter bonus - not triggering new spin');
        return;
      }
      
      // Note: Autoplay continuation is now handled in onSpinDataReceived after winline animations complete
      // This prevents conflicts and ensures proper timing
      console.log('[Symbols] REELS_STOP received - autoplay continuation handled separately in onSpinDataReceived');
      // End-of-spin synchronized cleanup when there are no wins
      try { this.endSpinPhase(); } catch {}
    });
  }

  private setupDialogEventListeners() {
    // Listen for dialog events to re-enable symbols
    this.scene.events.on('enableSymbols', () => {
      console.log('[Symbols] Re-enabling symbols after dialog transition');
      
      // Make sure symbols container is visible and interactive
      if (this.container) {
        this.container.setAlpha(1);
        this.container.setVisible(true);
        console.log('[Symbols] Symbols container re-enabled and visible');
      }

    });

		this.scene.events.on('resetSymbolsForBase', () => {
			try { this.resetAllSymbolsToNormalState(); } catch {}
		});

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    gameEventManager.on(GameEventType.IS_BONUS, () => {
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
      try {
        const data: any = this.currentSymbolData;
			let idleAnim = 'Symbol0_Sk8_idle';
			try {
				const spineKey = 'symbol_0_spine';
				const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
				const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
				if (Array.isArray(anims) && anims.length > 0) {
					if (!anims.includes(idleAnim)) {
						const hit = 'Symbol0_Sk8_hit';
						if (anims.includes(hit)) idleAnim = hit;
						else {
							const anyIdle = anims.find((n: string) => String(n).toLowerCase().includes('symbol0') && String(n).endsWith('_idle'));
							if (anyIdle) idleAnim = anyIdle;
							else {
								const anyHit = anims.find((n: string) => String(n).toLowerCase().includes('symbol0') && String(n).endsWith('_hit'));
								if (anyHit) idleAnim = anyHit;
								else idleAnim = anims[0];
							}
						}
					}
				}
			} catch {}
        const grid: any[][] = this.symbols;
        if (Array.isArray(grid)) {
          let ci = -1;
          for (const col of grid) {
            ci++;
            if (!Array.isArray(col)) continue;
            let ri = -1;
            for (const sym of col) {
              ri++;
              if (!sym) continue;
              try { this.scene.tweens.killTweensOf(sym); } catch {}
              try {
                const v = data?.[ci]?.[ri];
                const isScatter = v === 0 || typeof (sym as any)?.__scatterBaseScaleX === 'number' || typeof (sym as any)?.__scatterBaseScaleY === 'number';
                if (isScatter && (sym as any)?.animationState && typeof (sym as any).animationState.setAnimation === 'function') {
                  (sym as any).animationState.setAnimation(0, idleAnim, true);
                }
              } catch {}
              try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
            }
          }
        }
      } catch {}
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    // Listen for scatter bonus completion to restore symbol visibility
    this.scene.events.on('scatterBonusCompleted', () => {
      console.log('[Symbols] Scatter bonus completed event received - restoring symbol visibility');
      
      // Specifically ensure scatter symbols are visible
      this.ensureScatterSymbolsVisible();
      
      // Set up dialog animations complete listener only once
      if (!this.dialogListenerSetup) {
        console.log('[Symbols] Setting up dialog animations complete listener for the first time');
        this.dialogListenerSetup = true;
        
        // Wait for dialog animations (including iris transition) to complete before starting autoplay
        // This ensures the iris transition has fully completed before starting autoplay
        // Then wait an additional 3000ms before starting autoplay
        console.log('[Symbols] Waiting for dialog animations to complete before triggering free spins autoplay');
        this.scene.events.once('dialogAnimationsComplete', () => {
          console.log('[Symbols] Dialog animations complete - waiting additional 3000ms before starting autoplay');
          const startAutoplay = () => {
            console.log('[Symbols] Additional 1200ms delay completed - now triggering autoplay for free spins');
            this.triggerAutoplayForFreeSpins();
          };
          try {
            this.scene.time.delayedCall(0, () => startAutoplay());
          } catch {
            startAutoplay();
          }
        });

        try {
          this.scene.time.delayedCall(500, () => {
            try {
              if (!gameStateManager.isBonus) return;
              this.triggerAutoplayForFreeSpins();
            } catch {}
          });
        } catch {}
      } else {
        console.log('[Symbols] Dialog animations complete listener already set up, skipping duplicate setup');
      }
      
      console.log('[Symbols] Symbol visibility restored after scatter bonus completion');
      try {
        const grid: any[][] = this.symbols;
        if (Array.isArray(grid)) {
          for (const col of grid) {
            if (!Array.isArray(col)) continue;
            for (const sym of col) {
              if (!sym) continue;
              try { this.scene.tweens.killTweensOf(sym); } catch {}
              try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
            }
          }
        }
      } catch {}
    });

    // Listen for reels stop to continue free spin autoplay
    gameEventManager.on(GameEventType.REELS_STOP, () => {
      if (this.freeSpinAutoplayActive && this.freeSpinAutoplayWaitingForReelsStop) {
        console.log('[Symbols] REELS_STOP received - continuing free spin autoplay');
        // Reset the waiting flag immediately to prevent multiple responses
        this.freeSpinAutoplayWaitingForReelsStop = false;
        this.continueFreeSpinAutoplay();
      }
    });
  }

  /**
   * Get the configured scale for a specific symbol's Spine animation
   */
  public getSpineSymbolScale(symbolValue: number): number {
    const v = this.spineSymbolScales[symbolValue];
    if (typeof v === 'number' && v > 0) return v;

    // Fallback: if the game has more symbols than configured, clamp to the
    // highest known configured scale so we don't return 0 and end up with a
    // default fallback that may be visually incorrect.
    let maxKey = -1;
    for (const k in this.spineSymbolScales) {
      const n = Number(k);
      if (!Number.isNaN(n) && n > maxKey) maxKey = n;
    }
    if (maxKey >= 0) {
      const fallback = this.spineSymbolScales[maxKey];
      if (typeof fallback === 'number' && fallback > 0) return fallback;
    }
    return 0;
  }

  public getIdleSpineSymbolScale(symbolValue: number): number {
    return this.getSpineSymbolScale(symbolValue);
  }

  private hasExplicitSpineSymbolScale(symbolValue: number): boolean {
    const v = this.spineSymbolScales[symbolValue];
    return typeof v === 'number' && v > 0;
  }
  
  public getImageSymbolScaleMultiplier(symbolValue: number): number {
    const v = this.imageSymbolScaleMultipliers[symbolValue];
    if (typeof v === 'number' && v > 0) return v;
    return 1;
  }
  
  public getIdleScaleMultiplier(symbolValue: number): number {
    // Multiplier disabled: rely solely on spineSymbolScales for idle size
    return 1;
  }

  public getSpineScaleMultiplier(symbolValue: number): number {
    const base = this.spineSymbolRescaleModifierAll;
    const perSymbol = this.spineSymbolRescaleModifiers[symbolValue];
    if (typeof perSymbol === 'number' && perSymbol > 0) return base * perSymbol;

    const hasKnownScale = this.hasExplicitSpineSymbolScale(symbolValue);
    if (!hasKnownScale) {
      return base * this.spineSymbolRescaleModifierUnknown;
    }

    return base;
  }

  public applyIdleWaveShaderIfSymbolImage(symbol: any, symbolValue: number): void {
		return;
	}

  // Auto-fit a Spine instance to the target cell size, with a safe fallback scale
  public getFittedSpineScale(spine: any, targetWidth: number, targetHeight: number, fallbackScale: number): number {
    try {
      // Prefer explicit configured scale when provided so all states (idle, spin, win, fillers)
      // share the same visual size per symbol.
      if (typeof fallbackScale === 'number' && fallbackScale > 0) {
        return fallbackScale;
      }
      const bounds = spine?.getBounds?.();
      const bw = (bounds?.size?.width ?? bounds?.size?.x ?? 0);
      const bh = (bounds?.size?.height ?? bounds?.size?.y ?? 0);
      if (bw > 0 && bh > 0) {
        const sx = targetWidth / bw;
        const sy = targetHeight / bh;
        return Math.min(sx, sy) * 0.95;
      }
    } catch {}
    if (typeof fallbackScale === 'number' && fallbackScale > 0) {
      return fallbackScale;
    }
    return 0.6;
  }

  // Resolve the best animation name for a given symbol value based on cached Spine JSON
  public resolveSymbolAnimName(spineKey: string, symbolValue: number): string {
    // Default TB base name
    let base = `Symbol${symbolValue}_Sk8`;

    // For the money symbol (5), the visual variant may be backed by Symbol5_TB,
    // Symbol12_TB, Symbol13_TB or Symbol14_TB assets. Infer the correct base
    // name from the spine key when possible: symbol_{id}_spine → Symbol{id}_TB.
    if (symbolValue === 5 && spineKey) {
      try {
        const match = spineKey.match(/^symbol_(\d+)_spine$/);
        if (match && match[1]) {
          const id = parseInt(match[1], 10);
          if (!Number.isNaN(id)) {
            base = `Symbol${id}_Sk8`;
          }
        }
      } catch {}
    }

    const prefer = `${base}_win`;
    const fallback = `${base}_hit`;
    try {
      const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
      const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
      if (anims.includes(prefer)) return prefer;
      if (anims.includes(fallback)) return fallback;

      // Fallback: choose any available *_win / *_hit / *_idle animation
      const anyWin = anims.find((name: string) => name.endsWith('_win'));
      if (anyWin) return anyWin;
      const anyHit = anims.find((name: string) => name.endsWith('_hit'));
      if (anyHit) return anyHit;
      const anyIdle = anims.find((name: string) => name.endsWith('_idle'));
      if (anyIdle) return anyIdle;

      if (anims.length > 0) return anims[0];
    } catch {}
    return prefer; // default attempt
  }

  /**
   * Trigger _idle animations for NEW symbols in a specific reel after it drops
   * This works with the symbols that are currently being dropped (newSymbols)
   */
  public triggerIdleAnimationsForNewReel(reelIndex: number): void {
    this.applyIdleAnimationsForReelGrid(this.newSymbols, reelIndex, undefined, true);
  }

  /**
   * Trigger _idle animations for symbols in a specific reel after it drops
   * Excludes winning symbols from getting idle animations
   */
  public triggerIdleAnimationsForReel(reelIndex: number, winningPositions?: Set<string>): void {
    this.applyIdleAnimationsForReelGrid(this.symbols, reelIndex, winningPositions, false);
  }

  private applyIdleAnimationsForReelGrid(grid: any[][] | undefined, reelIndex: number, winningPositions: Set<string> | undefined, isNew: boolean): void {
    const label = isNew ? 'NEW ' : '';
    console.log(`[Symbols] Triggering _idle animations for ${label}reel ${reelIndex}`);

    if (!grid || reelIndex >= grid.length) {
      console.warn(`[Symbols] Invalid ${isNew ? 'new ' : ''}reel index ${reelIndex} or symbols not ready`);
      return;
    }

    const column = grid[reelIndex];
    if (!column) {
      console.warn(`[Symbols] Invalid ${isNew ? 'new ' : ''}reel index ${reelIndex} or symbols not ready`);
      return;
    }

    // Get winning positions from scene data if not provided
    let currentWinningPositions = winningPositions;
    if (!currentWinningPositions) {
      try {
        const sceneData = (this.scene as any)?.currentWinningPositions;
        if (sceneData) {
          currentWinningPositions = sceneData;
        }
      } catch {}
    }

    // Process each cell in this specific reel
    for (let row = 0; row < column.length; row++) {
      const symbol = column[row];
      if (!symbol) continue;

      // Skip if this position is part of a winning combination
      if (currentWinningPositions && currentWinningPositions.has(`${reelIndex}_${row}`)) {
        console.log(`[Symbols] Skipping winning symbol at (${reelIndex}, ${row}) from idle animation`);
        continue;
      }

      try {
        // Get symbol value from current data
        const symbolValue = (this.scene as any)?.currentSymbolData?.[reelIndex]?.[row];
        if (typeof symbolValue !== 'number') continue;

        try {
          if (gameStateManager.isBonus && symbolValue === 11) {
            const retriggersConsumed = Number((this as any).bonusRetriggersConsumed) || 0;
            const activeLevel = Math.max(0, Math.min(3, retriggersConsumed | 0));
            const visual = resolveBonusCollectorVisualSymbolValue(symbolValue, activeLevel);
            if (visual !== 11) continue;
          }
        } catch {}

        // Resolve Spine key; symbol 5 uses variant-specific Spine keys
        let spineKey = `symbol_${symbolValue}_spine`;
        let spineAtlasKey = spineKey + '-atlas';
        if (symbolValue === 5) {
          try {
            const spinData: any = (this as any).currentSpinData;
            let variant = getSymbol5VariantForCell(spinData, reelIndex, row) || getDefaultSymbol5Variant();

            // Start from the variant suggested by SpinData (money grid), but be robust:
            // if that exact variant spine isn't available, fall back to any available Symbol 5 spine.
            let variantInfo = getSymbol5SpineKeyForVariant(variant);
            let candidateKey = variantInfo.spineKey;
            const cacheJson: any = (this.scene.cache.json as any);
            let hasSpine = cacheJson?.has?.(candidateKey);

            if (!hasSpine) {
              const fallbackVariants = ['Symbol5_Sk8', 'Symbol12_Sk8', 'Symbol13_Sk8', 'Symbol14_Sk8'];
              for (const v of fallbackVariants) {
                try {
                  const info = getSymbol5SpineKeyForVariant(v as any);
                  if (cacheJson?.has?.(info.spineKey)) {
                    variant = v as any;
                    variantInfo = info;
                    candidateKey = info.spineKey;
                    hasSpine = true;
                    break;
                  }
                } catch {}
              }
            }

            if (hasSpine) {
              spineKey = candidateKey;
              spineAtlasKey = variantInfo.atlasKey;
            }
          } catch {}
        }
        let idleAnim = `${symbolValue}_idle`;

        // Resolve available animation
        try {
          const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
          const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
          if (!anims.includes(idleAnim)) {
            const preferWin = `${symbolValue}_win`;
            const fallbackHit = `${symbolValue}_hit`;
            const anyIdle = anims.find((name: string) => name.endsWith('_idle'));
            if (anyIdle) {
              idleAnim = anyIdle;
            } else if (anims.includes(preferWin)) idleAnim = preferWin;
            else if (anims.includes(fallbackHit)) idleAnim = fallbackHit;
            else if (anims.length > 0) idleAnim = anims[0];
          }
        } catch {}

        const isSpine = !!(symbol as any).animationState;

        // Store current position and display size from the existing object
        const x = symbol.x;
        const y = symbol.y;
        const displayWidth = symbol.displayWidth;
        const displayHeight = symbol.displayHeight;

        let target: any = symbol;

        // If this is still a PNG/WEBP sprite but Spine data exists, convert it back to Spine in-place
        if (!isSpine) {
          let hasSpineJson = (this.scene.cache.json as any)?.has?.(spineKey);

          // Extra robustness for Symbol 5: if the exact variant key is missing, fall back to any loaded variant.
          if (!hasSpineJson && symbolValue === 5) {
            const cacheJson: any = (this.scene.cache.json as any);
            const fallbackVariants = ['Symbol5_Sk8', 'Symbol12_Sk8', 'Symbol13_Sk8', 'Symbol14_Sk8'];
            for (const v of fallbackVariants) {
              try {
                const info = getSymbol5SpineKeyForVariant(v as any);
                if (cacheJson?.has?.(info.spineKey)) {
                  spineKey = info.spineKey;
                  spineAtlasKey = info.atlasKey;
                  hasSpineJson = true;
                  break;
                }
              } catch {}
            }
          }

          const canCreateSpine = hasSpineJson && (this.scene.add as any)?.spine;
          if (!canCreateSpine) {
            console.log(`[Symbols] Skipping idle Spine animation for PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${row}) - no Spine data`);
            continue;
          }

          try {
            symbol.destroy();
          } catch {}

          try {
            const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
            spineSymbol.setOrigin(0.5, 0.5);
            const baseScale = this.getIdleSpineSymbolScale(symbolValue);
            try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
            try { (spineSymbol as any).__pngSize = { w: displayWidth, h: displayHeight }; } catch {}
            try { (spineSymbol as any).__pngNudge = this.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 }; } catch {}
            try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
            this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, baseScale, this.getIdleSymbolNudge(symbolValue));
            try {
              const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
              if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
            } catch {}
            try { this.container.add(spineSymbol); } catch {}
            column[row] = spineSymbol;
            target = spineSymbol;
            console.log(`[Symbols] Converted PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${row}) back to Spine for idle animation`);
          } catch (e) {
            console.warn(`[Symbols] Failed to convert PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${row}) back to Spine:`, e);
            continue;
          }
        }

        // At this point target is a Spine symbol – set idle animation (loop)
        try { target.animationState.setAnimation(0, idleAnim, true); } catch {}
        // Re-center on next tick to compensate for bounds changes after animation starts
        this.reCenterSpineNextTick(target, x, y, this.getIdleSymbolNudge(symbolValue));
        console.log(`[Symbols] Set ${label.toLowerCase()}symbol at (${reelIndex}, ${row}) to idle animation: ${idleAnim}`);
      } catch (e) {
        console.warn(`[Symbols] Failed to set idle Spine on ${label.toLowerCase()}symbol at (${reelIndex}, ${row}):`, e);
      }
    }
  }

  private restoreIdleScaleForSymbol(target: any, symbolValue: number): void {
    try {
      if (!target || !(target as any).animationState) return;

      // Prefer stored home/size/nudge when available so we exactly match the
      // original idle placement for this symbol.
      const home = (target as any).__pngHome;
      const size = (target as any).__pngSize;
      const storedNudge = (target as any).__pngNudge;

      const cx = (home && typeof home.x === 'number') ? home.x : target.x;
      const cy = (home && typeof home.y === 'number') ? home.y : target.y;
      const w = (size && typeof size.w === 'number') ? size.w : this.displayWidth;
      const h = (size && typeof size.h === 'number') ? size.h : this.displayHeight;
      const nudge = storedNudge || this.getIdleSymbolNudge(symbolValue);

      const baseScale = this.getIdleSpineSymbolScale(symbolValue);
      this.centerAndFitSpine(target, cx, cy, w, h, baseScale, nudge);

      // Re-apply any configured multipliers so idle scale stays consistent
      // with how symbols were originally placed.
      try {
        const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
        if (m !== 1 && typeof (target as any).setScale === 'function') {
          (target as any).setScale(target.scaleX * m, target.scaleY * m);
        }
      } catch {}
    } catch {}
  }

  private resetAllSymbolsToIdle(): void {
    try {
      if (!this.symbols || !this.symbols[0]) {
        return;
      }
      const reels = this.symbols.length;
      for (let reelIndex = 0; reelIndex < reels; reelIndex++) {
        // Pass no explicit winningPositions so applyIdleAnimationsForReelGrid
        // will use the scene's currentWinningPositions set and skip true
        // winning cells. This avoids restarting win animations that are
        // already playing on those symbols.
        this.triggerIdleAnimationsForReel(reelIndex);
      }
    } catch {}
  }

	public resetAllSymbolsToNormalState(): void {
		try {
			if (!this.scene) return;
			try { this.clearWinLines(); } catch {}
			try { (this.winLineDrawer as any)?.stopLooping?.(); } catch {}
			try { (this.winLineDrawer as any)?.clearLines?.(); } catch {}
			try { (this.scene as any).currentWinningPositions = new Set<string>(); } catch {}
			try {
				const bg: any = (this.scene as any).background;
				bg?.restoreDepthAfterWinSequence?.();
			} catch {}
			try { this.restoreSymbolsAboveReelBg(); } catch {}
			try {
				if (this.overlayRect) {
					this.scene.tweens.killTweensOf(this.overlayRect);
					this.overlayRect.setAlpha(0);
					this.overlayRect.setVisible(false);
				}
			} catch {}
			try {
				if (this.baseOverlayRect) {
					this.scene.tweens.killTweensOf(this.baseOverlayRect);
					this.baseOverlayRect.setAlpha(0);
					this.baseOverlayRect.setVisible(false);
				}
			} catch {}

			try {
				const grid: any[][] = this.symbols;
				if (Array.isArray(grid)) {
					for (const col of grid) {
						if (!Array.isArray(col)) continue;
						for (const sym of col) {
							if (!sym) continue;
							try { this.scene.tweens.killTweensOf(sym); } catch {}
							try { clearImageSymbolWinRipple(this.scene as any, sym); } catch {}
							try { clearNonWinningSymbolDim(this.scene as any, sym); } catch {}
							try { (sym as any).clearTint?.(); } catch {}
							try { if (typeof (sym as any).setAlpha === 'function') (sym as any).setAlpha(1); } catch {}
							try { (sym as any).alpha = 1; } catch {}
						}
					}
				}
			} catch {}

			try {
				if (this.symbols && this.symbols[0]) {
					const reels = this.symbols.length;
					const emptyWinners = new Set<string>();
					for (let reelIndex = 0; reelIndex < reels; reelIndex++) {
						this.triggerIdleAnimationsForReel(reelIndex, emptyWinners);
					}
				}
			} catch {}
		} catch {}
	}

  /**
   * Clear win lines and stop looping
   */
  public clearWinLines(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.stopLooping();
      this.winLineDrawer.clearLines();
    }
  }

  /**
   * Pulse / ripple the given winning symbols for the currently drawn winline.
   * This is called by WinLineDrawer via symbolsReference.pulseWinningSymbols(winningGrids).
   *
   * Behaviour:
   * - Clears any existing ripple rings from all symbols so only the active winline is highlighted.
   * - Applies the shared image ripple helper to the winning symbols, with a small left-to-right delay
   *   based on their column (x) order in the winline.
   */
  public pulseWinningSymbols(winningGrids: { x: number; y: number; symbol?: number }[]): void {
    try {
      if (!this.scene || !this.symbols || !Array.isArray(this.symbols)) {
        return;
      }

      // First, clear existing ripples from all symbols so only the current line is highlighted
      try {
        for (let outer = 0; outer < this.symbols.length; outer++) {
          const colOrRow = this.symbols[outer];
          if (!Array.isArray(colOrRow)) {
            continue;
          }
          for (let inner = 0; inner < colOrRow.length; inner++) {
            const symbol: any = colOrRow[inner];
            if (!symbol) {
              continue;
            }
            try { clearImageSymbolWinRipple(this.scene, symbol); } catch {}
          }
        }
      } catch {}

      if (!winningGrids || winningGrids.length === 0) {
        return;
      }

      // Sort winning symbols by column so the pulse travels left-to-right along the winline
      const sorted = [...winningGrids].sort((a, b) => a.x - b.x);
      const perColumnDelay = 80; // ms between columns

      sorted.forEach((grid, index) => {
        const sy = grid.y;
        const sx = grid.x;

        const rowOrCol = this.symbols[sx];
        if (!rowOrCol || !Array.isArray(rowOrCol)) {
          return;
        }
        const symbol: any = rowOrCol[sy];
        if (!symbol) {
          return;
        }

        const delayMs = index * perColumnDelay;
        				try {
					this.scene.time.delayedCall(delayMs, () => {
						try {
							if (!symbol || (symbol as any).destroyed === true || symbol.active === false) {
								return;
							}
							// Apply ripple ring + size pulse
							applyImageSymbolWinRipple(this.scene, symbol);

							// Also apply a one-shot flash overlay using the same
							// shape/scale approach as SymbolFlash, but only for this symbol.
							try {
								const anySymbol: any = symbol as any;
								const home = (anySymbol as any).__pngHome as { x: number; y: number } | undefined;
								const size = (anySymbol as any).__pngSize as { w: number; h: number } | undefined;
								const nudge = (anySymbol as any).__pngNudge as { x: number; y: number } | undefined;

								const centerX = (home?.x ?? anySymbol.x) + (nudge?.x ?? 0);
								const centerY = (home?.y ?? anySymbol.y) + (nudge?.y ?? 0);
								const w = Math.max(2, size?.w ?? this.displayWidth);
								const h = Math.max(2, size?.h ?? this.displayHeight);

								let overlay: any;
								try {
									const sceneAny: any = this.scene as any;

                  // Try to resolve a PNG texture key that matches this symbol's artwork.
                  let pngKey: string | undefined;

                  // 1) Prefer the logical symbol value from currentSymbolData when available
                  try {
                    const symbolData: number[][] | null = this.currentSymbolData;
                    let symbolValue: number | undefined;
                    const v = symbolData?.[sx]?.[sy];
                    if (typeof v === 'number') {
                      symbolValue = v;
                    }

                    if (symbolValue !== undefined) {
                      if (symbolValue === 5) {
                        // Money symbol 5: resolve variant-specific PNG key when possible
                        let variantKey: string | null = null;
                        try {
                          const spinData: any = this.currentSpinData;
                          if (spinData) {
                            variantKey = getSymbol5ImageKeyForCell(spinData, sx, sy);
                          }
                        } catch {}

                        if (variantKey && sceneAny.textures?.exists?.(variantKey)) {
                          pngKey = variantKey;
                        } else {
                          try {
                            const fallbackKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
                            if (sceneAny.textures?.exists?.(fallbackKey)) {
                              pngKey = fallbackKey;
                            }
                          } catch {}
                        }
                      } else {
                        const baseKey = `symbol_${symbolValue}`;
                        if (sceneAny.textures?.exists?.(baseKey)) {
                          pngKey = baseKey;
                        }
                      }
                    }
                  } catch {}
                  // 2) Fallback: use the symbol's own texture key if valid
                  if (!pngKey) {
                    const texKey = (anySymbol.texture && (anySymbol.texture as any).key) as string | undefined;
                    if (texKey && sceneAny.textures?.exists?.(texKey)) {
                      pngKey = texKey;
                    }
                  }

                  if (pngKey && sceneAny.textures?.exists?.(pngKey)) {
                    overlay = sceneAny.add.image(centerX, centerY, pngKey);
                    overlay.setOrigin(0.5, 0.5);
                    overlay.setDisplaySize(w, h);
                  } else {
                    // Final fallback: simple rect if no PNG key can be resolved
                    overlay = this.scene.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
                    try { (overlay as any).setOrigin(0.5, 0.5); } catch {}
                  }
                } catch {
                  overlay = this.scene.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
                  try { (overlay as any).setOrigin(0.5, 0.5); } catch {}
                }

                try { overlay.setDepth(1005); } catch {}
                try { (overlay as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch {}

                const alphaStart = Math.max(0, Math.min(1, this.winSymbolFlashAlphaStart));
                const alphaEnd = Math.max(0, Math.min(1, this.winSymbolFlashFadeTo));
                overlay.setAlpha(alphaStart);

                const effectiveSpeed = Math.max(0.05, this.winSymbolFlashSpeedMultiplier);
                const dur = Math.max(20, Math.floor(this.winSymbolFlashDurationMs / effectiveSpeed));

                this.scene.tweens.add({
                  targets: overlay,
                  alpha: alphaEnd,
                  duration: dur,
                  ease: 'Sine.easeOut',
                  onComplete: () => {
                    try { overlay.destroy(); } catch {}
                  }
                });
              } catch {}
            } catch {}
          });
        } catch {}
      });
    } catch {}
  }

  /**
   * Check if there are currently visible wins (win lines or overlay)
   */
  public hasCurrentWins(): boolean {
    // Check if win line drawer has active lines
    const hasWinLines = this.winLineDrawer && this.winLineDrawer.hasActiveLines();
    
    // Check if black overlay is visible
    const hasOverlay = this.overlayRect && this.overlayRect.visible;
    
    return hasWinLines || (hasOverlay ?? false);
  }

  /**
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(): void {
    console.log('[Symbols] Starting scatter animation sequence');
    
    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    this.restoreSymbolsAboveReelBg();
    this.clearWinLines();
    
    // Hide winnings display when scatter animation starts
    const header = (this.scene as any).header;
    if (header && typeof header.hideWinningsDisplay === 'function') {
      console.log('[Symbols] Hiding winnings display for scatter animation');
      header.hideWinningsDisplay();
    } else {
      console.warn('[Symbols] Header not available or hideWinningsDisplay method not found');
    }
    
    // Then trigger the scatter animation sequence (spinner, dialog, etc.)
    if (this.scatterAnimationManager) {
      console.log('[Symbols] Starting scatter animation sequence');
      this.scatterAnimationManager.playScatterAnimation();
    } else {
      console.warn('[Symbols] ScatterAnimationManager not available');
    }
  }

  /**
   * Animate scatter symbols with Spine animations (no winlines)
   */
  public async animateScatterSymbols(scatterGrids: any[]): Promise<void> {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to animate');
      return;
    }

    // Reset one-shot event flag per scatter animation sequence
    this.hasEmittedScatterWinStart = false;

    console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);

    const playScatterHitSfxOnce = () => {
      try {
        if (gameStateManager.isBonus || this.hasEmittedScatterWinStart) return;
        this.hasEmittedScatterWinStart = true;
        try {
          const audio = (window as any)?.audioManager;
          if (audio && typeof audio.playSoundEffect === 'function') {
            const base = typeof audio.getSfxVolume === 'function' ? Number(audio.getSfxVolume()) : 0.4;
            const vol = Math.max(0, (isFinite(base) ? base : 0.4) * (this.scatterHitSfxVolumeMultiplier || 0));
            audio.playSoundEffect(SoundEffectType.SCATTER_HIT, { volume: vol });
          }
        } catch {}
        this.scene.events.emit('symbol0-win-start');
        this.fadeBaseOverlayForScatterStart(250, 0);
      } catch {}
    };

    const animationPromises = scatterGrids.map(grid => {
      return new Promise<void>((resolve) => {
        const col = grid.x;
        const row = grid.y;

        try {
          const currentSymbol = this.symbols?.[col]?.[row];
          if (!currentSymbol) {
            resolve();
            return;
          }

          const symbolValue = 0;
          const spineKey = `symbol_${symbolValue}_spine`;
          const spineAtlasKey = spineKey + '-atlas';
          const symbolName = `Symbol${symbolValue}_Sk8`;

          let hitAnimationName = `${symbolName}_win`;
          try {
            const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
            const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
            if (!anims.includes(hitAnimationName)) {
              const fallback = `${symbolName}_hit`;
              hitAnimationName = anims.includes(fallback) ? fallback : hitAnimationName;
            }
          } catch {}

          const x = (currentSymbol as any).x;
          const y = (currentSymbol as any).y;
          const displayWidth = (currentSymbol as any).displayWidth;
          const displayHeight = (currentSymbol as any).displayHeight;

          // If already a Spine object, just play the animation
          if ((currentSymbol as any)?.animationState) {
            const spineSymbol: any = currentSymbol;
            try { spineSymbol.setDepth(990); } catch {}
            try {
              const parent: any = spineSymbol?.parentContainer;
              if (parent && typeof parent.bringToTop === 'function') parent.bringToTop(spineSymbol);
            } catch {}
            try { this.scene?.children?.bringToTop?.(spineSymbol); } catch {}
            try {
              if (typeof (spineSymbol as any).__scatterBaseScaleX !== 'number') (spineSymbol as any).__scatterBaseScaleX = spineSymbol.scaleX;
              if (typeof (spineSymbol as any).__scatterBaseScaleY !== 'number') (spineSymbol as any).__scatterBaseScaleY = spineSymbol.scaleY;
            } catch {}
            try { this.scatterAnimationManager?.registerScatterSymbol?.(spineSymbol); } catch {}

            try { spineSymbol.animationState.setAnimation(0, hitAnimationName, true); } catch {}
            playScatterHitSfxOnce();
            this.reCenterSpineNextTick(spineSymbol, x, y, this.getWinSymbolNudge(symbolValue));

            let enlargedScaleX = Number(spineSymbol.scaleX) * 1.5;
            let enlargedScaleY = Number(spineSymbol.scaleY) * 1.5;
            try {
              const baseX = Number((spineSymbol as any).__scatterBaseScaleX);
              const baseY = Number((spineSymbol as any).__scatterBaseScaleY);
              const bx = isFinite(baseX) && baseX > 0 ? baseX : Number(spineSymbol.scaleX);
              const by = isFinite(baseY) && baseY > 0 ? baseY : Number(spineSymbol.scaleY);
              enlargedScaleX = bx * 1.5;
              enlargedScaleY = by * 1.5;
            } catch {}
            try {
              this.scene.tweens.add({
                targets: spineSymbol,
                scaleX: enlargedScaleX,
                scaleY: enlargedScaleY,
                duration: 500,
                ease: 'Power2.easeOut'
              });
            } catch {}

            setTimeout(() => resolve(), 100);
            return;
          }

          // Otherwise replace with a Spine instance (retry if json isn't ready)
          try { (currentSymbol as any).destroy?.(); } catch {}

          const attemptCreate = (attempts: number) => {
            try {
              if (!(this.scene.cache.json as any).has(spineKey)) {
                if (attempts < 5) {
                  this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                  return;
                }
              }

              const spineSymbol: any = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
              spineSymbol.setOrigin(0.5, 0.5);
              const configuredScale = this.getSpineSymbolScale(symbolValue);
              try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
              try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
              this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, configuredScale, this.getWinSymbolNudge(symbolValue));
              try {
                const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
                if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
              } catch {}
              spineSymbol.setDepth(990);
              try { this.scene?.children?.bringToTop?.(spineSymbol); } catch {}
              this.symbols[col][row] = spineSymbol;
              try { (spineSymbol as any).__scatterBaseScaleX = spineSymbol.scaleX; } catch {}
              try { (spineSymbol as any).__scatterBaseScaleY = spineSymbol.scaleY; } catch {}
              try { this.scatterAnimationManager?.registerScatterSymbol?.(spineSymbol); } catch {}

              try { spineSymbol.animationState.setAnimation(0, hitAnimationName, true); } catch {}
              playScatterHitSfxOnce();
              this.reCenterSpineNextTick(spineSymbol, x, y, this.getWinSymbolNudge(symbolValue));

              let enlargedScaleX = configuredScale * 1.5;
              let enlargedScaleY = configuredScale * 1.5;
              try {
                const baseX = Number((spineSymbol as any).__scatterBaseScaleX);
                const baseY = Number((spineSymbol as any).__scatterBaseScaleY);
                const bx = isFinite(baseX) && baseX > 0 ? baseX : Number(spineSymbol.scaleX);
                const by = isFinite(baseY) && baseY > 0 ? baseY : Number(spineSymbol.scaleY);
                enlargedScaleX = bx * 1.5;
                enlargedScaleY = by * 1.5;
              } catch {}
              try {
                this.scene.tweens.add({
                  targets: spineSymbol,
                  scaleX: enlargedScaleX,
                  scaleY: enlargedScaleY,
                  duration: 500,
                  ease: 'Power2.easeOut'
                });
              } catch {}

              setTimeout(() => resolve(), 100);
            } catch (e) {
              if (attempts < 5) {
                this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                return;
              }
              console.warn('[Symbols] Failed to create scatter spine animation:', e);
              resolve();
            }
          };

          attemptCreate(0);
        } catch (error) {
          console.warn('[Symbols] Scatter animation error:', error);
          resolve();
        }
      });
    });

    await Promise.all(animationPromises);

    const baseDelay = 3000;
    const turboMultiplier = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
    const adjustedDelay = baseDelay * turboMultiplier;
    console.log(`[Symbols] Scatter animation delay: base=${baseDelay}ms, turbo=${gameStateManager.isTurbo}, adjusted=${adjustedDelay}ms`);
    await this.delay(adjustedDelay);

    console.log('[Symbols] Scatter symbol Spine animation completed');
  }

  /**
   * Helper method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => {
        resolve();
      });
    });
  }

  /**
   * Hide all symbols (including scatter symbols) by setting container alpha to 0
   */
  public hideAllSymbols(): void {
    if (this.container) {
      console.log('[Symbols] Hiding all symbols by setting container alpha to 0');
      this.container.setAlpha(0);
    }
    // Also fade out the base overlay (light grey background behind symbols)
    try {
      if (this.baseOverlayRect) {
        this.scene.tweens.killTweensOf(this.baseOverlayRect);
        if (!this.baseOverlayRect.visible || this.baseOverlayRect.alpha <= 0) {
          this.baseOverlayRect.setVisible(false);
        } else {
          this.scene.tweens.add({
            targets: this.baseOverlayRect,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => { try { this.baseOverlayRect?.setVisible(false); } catch {} }
          });
        }
      }
    } catch {}
  }

  public ensureScatterSymbolsVisible(): void {
    try {
      const data = this.currentSymbolData;
      const grid = this.symbols;
      if (!grid || !data) return;
      for (let col = 0; col < grid.length; col++) {
        const column = grid[col];
        for (let row = 0; row < (column ? column.length : 0); row++) {
          try {
            const val = data?.[col]?.[row];
            if (val === 0) {
              const obj = column[row];
              if (obj && typeof obj.setVisible === 'function') {
                obj.setVisible(true);
              }
            }
          } catch {}
        }
      }
    } catch {}
  }


  /** Fade the base light-grey grid background when scatter win starts (base scene). */
  private fadeBaseOverlayForScatterStart(durationMs: number = 250, toAlpha: number = 0): void {
    try {
      if (!this.baseOverlayRect) return;
      this.scene.tweens.killTweensOf(this.baseOverlayRect);
      // Ensure it's visible before fading
      this.baseOverlayRect.setVisible(true);
      const targetAlpha = Math.max(0, Math.min(1, toAlpha));
      this.scene.tweens.add({
        targets: this.baseOverlayRect,
        alpha: targetAlpha,
        duration: Math.max(0, durationMs),
        ease: 'Cubic.easeOut'
      });
    } catch {}
  }

  /**
   * Get the bounds of the symbol grid
   */
  private getSymbolGridBounds(): { x: number, y: number, width: number, height: number } {
    // Add padding to make the overlay slightly larger than the symbol grid
    const paddingX = 9;
    const paddingY = 8;

    const offsetX = 1;
    const offsetY = 0.7;
    
    const x = this.slotX - this.totalGridWidth * 0.5 - paddingX + offsetX;
    const y = this.slotY - this.totalGridHeight * 0.5 - paddingY + offsetY;
    
    return {
      x: x + offsetX,
      y: y + offsetY,
      width: this.totalGridWidth + (paddingX * 2),
      height: this.totalGridHeight + (paddingY * 2)
    };
  }

  /**
   * Apply turbo mode to winline animations
   */
  public setTurboMode(isEnabled: boolean): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.setTurboMode(isEnabled);
      console.log(`[Symbols] Turbo mode ${isEnabled ? 'enabled' : 'disabled'} for winline animations`);
    } else {
      console.warn('[Symbols] WinLineDrawer not available for turbo mode');
    }
  }

  /**
   * Reset winline animations to default timing
   */
  public resetWinlineTiming(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.resetToDefaultTiming();
      console.log('[Symbols] Winline timing reset to default values');
    } else {
      console.warn('[Symbols] WinLineDrawer not available for timing reset');
    }
  }

  /**
   * Ensure symbols remain visible and in their current state after autoplay is stopped
   */
  public ensureSymbolsVisibleAfterAutoplayStop(): void {
    console.log('[Symbols] Ensuring symbols remain visible after autoplay stop');

		try {
			if (gameStateManager.isReelSpinning) {
				try {
					gameEventManager.once(GameEventType.REELS_STOP, () => {
						try { this.ensureSymbolsVisibleAfterAutoplayStop(); } catch {}
					});
				} catch {}
				return;
			}
		} catch {}
    
    // Ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container visibility ensured after autoplay stop');
    }
    
    // Ensure all symbols are visible
    if (this.symbols && this.symbols.length > 0) {
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            try { this.scene?.tweens?.killTweensOf?.(symbol); } catch {}
            try { clearImageSymbolWinRipple(this.scene as any, symbol); } catch {}
            try { clearNonWinningSymbolDim(this.scene as any, symbol); } catch {}
            symbol.setVisible(true);
            visibleCount++;
          }
        }
      }
      console.log(`[Symbols] Ensured ${visibleCount} symbols are visible after autoplay stop`);
    }
    
    // Clear any winlines that might be showing
    if (this.winLineDrawer) {
      this.winLineDrawer.clearLines();
      console.log('[Symbols] Cleared winlines after autoplay stop');
    }
    
    // Hide any winning overlay that might be showing
    console.log('[Symbols] Hidden winning overlay after autoplay stop');
  }

  /**
   * Trigger autoplay for free spins if available
   */
  private triggerAutoplayForFreeSpins(): void {
    // Prevent duplicate triggering - multiple checks for safety
    if (this.freeSpinAutoplayTriggered) {
      console.log('[Symbols] Free spin autoplay already triggered, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if autoplay is already active, don't start another one
    if (this.freeSpinAutoplayActive) {
      console.log('[Symbols] Free spin autoplay already active, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if we're not in bonus mode, don't start free spin autoplay
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] Not in bonus mode, skipping free spin autoplay trigger');
      return;
    }

    let freeSpinsCount = 0;

    // Check if we have pending free spins data (from scatter bonus activation)
    if (this.pendingFreeSpinsData) {
      freeSpinsCount = this.pendingFreeSpinsData.actualFreeSpins;
      console.log(`[Symbols] Using pending free spins data: ${freeSpinsCount} free spins`);

      // Clear the pending data after use
      this.pendingFreeSpinsData = null;
    }
    // Check if we have current spin data with free spins (fallback)
    else if (this.currentSpinData?.slot) {
      const fs: any = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
      let maxSpinsLeft = 0;
      try {
        if (fs?.items && Array.isArray(fs.items) && fs.items.length > 0) {
          const it = fs.items.find((x: any) => (Number((x as any)?.spinsLeft) || 0) > 0) ?? fs.items[0];
          const v = Number((it as any)?.spinsLeft);
          if (isFinite(v) && v > 0) maxSpinsLeft = v;
        }
      } catch {}
      if (maxSpinsLeft > 0) {
        freeSpinsCount = maxSpinsLeft;
        console.log(`[Symbols] Using current spin data max spinsLeft: ${freeSpinsCount} free spins`);
      } else if (fs?.count) {
        freeSpinsCount = Number(fs.count) || 0;
        console.log(`[Symbols] Using current spin data free spins count: ${freeSpinsCount} free spins`);
      }
    }

    if (freeSpinsCount > 0) {
      console.log(`[Symbols] Free spins available: ${freeSpinsCount}. Starting free spin autoplay.`);

      // Mark as triggered to prevent duplicates
      this.freeSpinAutoplayTriggered = true;

      // Start our custom free spin autoplay system
      void this.startFreeSpinAutoplay(freeSpinsCount);
    } else {
      console.log('[Symbols] No free spins data available, not triggering autoplay.');
    }
    console.log('[Symbols] ===== END TRIGGERING AUTOPLAY FOR FREE SPINS =====');
  }

  /**
   * Start free spin autoplay using our custom system
   */
  private async startFreeSpinAutoplay(spinCount: number): Promise<void> {
    console.log(`[Symbols] ===== STARTING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Starting free spin autoplay with ${spinCount} spins`);

    this.bonusCongratsTriggered = false;
		try {
			const alreadyProgressed = (Number((this as any).bonusLevelsCompleted) || 0) > 0 || (Number((this as any).bonusRetriggersConsumed) || 0) > 0 || this.pendingBackendRetriggerTotal !== null;
			if (!alreadyProgressed) {
				this.bonusStage1Complete = false;
				this.bonusLevelsCompleted = 0;
				this.bonusRetriggersConsumed = 0;
				this.pendingBackendRetriggerTotal = null;
				this.lastAppliedRetriggerTotal = null;
			}
			this.freeSpinAutoplayProbeSpin = false;
			this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
		} catch {}
    
    // Set free spin autoplay state
    this.freeSpinAutoplayActive = true;
    this.freeSpinAutoplaySpinsRemaining = spinCount;
    
    // Set global autoplay state
    gameStateManager.isAutoPlaying = true;
    gameStateManager.isAutoPlaySpinRequested = true;
    this.scene.gameData.isAutoPlaying = true;
    
    // Apply turbo mode to winline animations if turbo is enabled (same as normal autoplay)
    if (gameStateManager.isTurbo) {
      console.log('[Symbols] Applying turbo mode to winline animations for free spin autoplay');
      this.setTurboMode(true);
    }
    
    // Start the first free spin after a short delay so bonus visuals can settle
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }

		// Gate: ensure we don't start the next free spin while bonus overlays/critical sequences
		// are still in-flight. Turbo can otherwise schedule the next spin on the same frame.
		try {
			const gameSceneAny: any = this.scene as any;
			if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.waitForBonusOverlayQueueIdle === 'function') {
				await gameSceneAny.waitForBonusOverlayQueueIdle(15000);
			}
		} catch {}
		try { await gameStateManager.waitForSpinPipelineIdle({ timeoutMs: 12000 }); } catch {}
    const firstSpinDelayMs = gameStateManager.isTurbo ? 700 : 1200;
    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(firstSpinDelayMs, () => {
      try {
        const gm: any = (this.scene as any)?.gaugeMeter;
        gm?.playIndicatorIntro?.();
      } catch {}
      this.performFreeSpinAutoplay();
    });
    
    console.log(`[Symbols] Free spin autoplay started with ${spinCount} spins`);
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY STARTED =====`);
  }

  /**
   * Perform a single free spin autoplay
   */
  private async performFreeSpinAutoplay(): Promise<void> {
    if (!this.freeSpinAutoplayActive) {
      console.log('[Symbols] Free spin autoplay stopped or no spins remaining');
      this.stopFreeSpinAutoplay();
      return;
    }
    if (this.freeSpinAutoplaySpinsRemaining <= 0) {
			let pendingProgressAtZero = false;
			try { pendingProgressAtZero = this.hasPendingBonusProgressionAtZero(); } catch { pendingProgressAtZero = false; }
			if (gameStateManager.isBonus && pendingProgressAtZero) {
				try {
					await gameStateManager.waitForOverlaySafeState({ timeoutMs: 12000 });
				} catch {}
				try {
					await this.waitForBonusStageCompletionSignals(2000);
				} catch {}
				try {
					if (this.tryApplyQueuedRetriggerAtZero()) {
						return;
					}
				} catch {}
				try {
					this.scene?.time?.delayedCall?.(100, () => { try { void this.performFreeSpinAutoplay(); } catch {} });
					return;
				} catch {
					try { setTimeout(() => { try { void this.performFreeSpinAutoplay(); } catch {} }, 100); } catch {}
					return;
				}
			}
      let allowContinue = false;
      try {
        const availableCredits = Math.max(0, (Number(this.bonusLevelsCompleted) || 0) - (Number(this.bonusRetriggersConsumed) || 0));
        allowContinue = !!(gameStateManager.isBonus && availableCredits > 0);
      } catch {}

			try {
				if (!allowContinue && gameStateManager.isBonus) {
					await this.waitForBonusStageCompletionSignals(250);
					try {
						const availableCredits2 = Math.max(0, (Number(this.bonusLevelsCompleted) || 0) - (Number(this.bonusRetriggersConsumed) || 0));
						allowContinue = !!(gameStateManager.isBonus && availableCredits2 > 0);
					} catch {}
				}
			} catch {}

			try {
				if (!allowContinue && this.shouldWaitForBonusStageCompletionAtZero()) {
					const baseDelay = 900;
					const waitMs = Math.max(250, Math.floor(baseDelay * (gameStateManager.isTurbo ? TurboConfig.TURBO_DELAY_MULTIPLIER : 1)));
					await this.waitForBonusStageCompletionSignals(waitMs);
					try {
						const availableCredits2 = Math.max(0, (Number(this.bonusLevelsCompleted) || 0) - (Number(this.bonusRetriggersConsumed) || 0));
						allowContinue = !!(gameStateManager.isBonus && availableCredits2 > 0);
					} catch {}
				}
			} catch {}

			// If we're at 0 spins but we still have more fake spins queued, we might be in the
			// "retrigger boundary" case where the final collector animation completes Stage 1
			// slightly after the spins counter hits 0. Wait briefly for stage completion signals
			// before deciding to exit the bonus.
			if (!allowContinue) {
				try {
					const hasMore = !!(gameStateManager.isBonus && fakeBonusAPI.isEnabled() && fakeBonusAPI.hasMoreFreeSpins());
					if (hasMore) {
						const baseDelay = 900;
						const waitMs = Math.max(250, Math.floor(baseDelay * (gameStateManager.isTurbo ? TurboConfig.TURBO_DELAY_MULTIPLIER : 1)));
						await this.waitForBonusStageCompletionSignals(waitMs);
						try {
							const availableCredits2 = Math.max(0, (Number(this.bonusLevelsCompleted) || 0) - (Number(this.bonusRetriggersConsumed) || 0));
							allowContinue = !!(gameStateManager.isBonus && availableCredits2 > 0 && fakeBonusAPI.isEnabled() && fakeBonusAPI.hasMoreFreeSpins());
						} catch {}
					}
				} catch {}
			}

      try {
        if (this.tryApplyQueuedRetriggerAtZero()) {
          return;
        }
      } catch {}

      console.log('[Symbols] Free spin autoplay stopped or no spins remaining');
      this.stopFreeSpinAutoplay();
      return;
    }

    // During free spin autoplay, wait until win visuals (winline/dim/bg darken)
    // are finished before starting the next automatic spin.
    try {
      const gameData: GameData | null = (this.scene as any)?.gameData ?? null;
      if (gameData && isWinlinesShowing(gameData)) {
        console.log('[Symbols] performFreeSpinAutoplay blocked - win visuals still active, rescheduling');
        if (this.freeSpinAutoplayTimer) {
          try { this.freeSpinAutoplayTimer.destroy(); } catch {}
          this.freeSpinAutoplayTimer = null;
        }
        this.freeSpinAutoplayTimer = this.scene.time.delayedCall(100, () => {
          this.performFreeSpinAutoplay();
        });
        return;
      }
    } catch {}

    console.log(`[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    const hasRetriggerOverlay = (): boolean => {
      try {
        const sp: any = (this.scene as any)?.scene;
        return !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
      } catch {
        return false;
      }
    };

    const hasActiveDialogUi = (): boolean => {
      try {
        const dialogs: any = (this.scene as any)?.dialogs;
        if (!dialogs) return false;
        try {
          if (typeof dialogs.isDialogActive === 'boolean') {
            if (!dialogs.isDialogActive) return false;
            try { if (dialogs.currentDialog) return true; } catch {}
            try { if (dialogs.currentDialogType) return true; } catch {}
            return false;
          }
        } catch {}
        try { if (dialogs.currentDialog) return true; } catch {}
        try { if (dialogs.currentDialogType) return true; } catch {}
      } catch {}
      return false;
    };

    if (this.freeSpinAutoplayWaitingForRetriggerOverlay) {
      console.log('[Symbols] Waiting for retrigger overlay closure - pausing free spin autoplay');
      if (this.freeSpinAutoplayTimer) {
        this.freeSpinAutoplayTimer.destroy();
        this.freeSpinAutoplayTimer = null;
      }
      this.scene.events.once('freeSpinRetriggerOverlayClosed', () => {
        console.log('[Symbols] freeSpinRetriggerOverlayClosed received');
        this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
				this.freeSpinAutoplayResumeImmediateOnce = false;
        try { gameStateManager.isShowingWinDialog = false; } catch {}
				try { this.scheduleFreeSpinAutoplayResumeAfterRetriggerOverlay(); } catch { try { this.performFreeSpinAutoplay(); } catch {} }
      });
      return;
    }

    if (gameStateManager.isShowingWinDialog || hasRetriggerOverlay()) {
      console.log('[Symbols] Blocking overlay is showing - pausing free spin autoplay');
      try {
        const dialogs: any = (this.scene as any)?.dialogs;
        console.log('[Symbols] Blocking overlay state', {
          isShowingWinDialog: gameStateManager.isShowingWinDialog,
          hasRetriggerOverlay: hasRetriggerOverlay(),
          dialogIsActive: !!dialogs?.isDialogActive,
          hasCurrentDialog: !!dialogs?.currentDialog,
          currentDialogType: dialogs?.currentDialogType ?? null
        });
      } catch {}
      const baseDelay = 500;
      const turboDelay = gameStateManager.isTurbo ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
      let resumed = false;
      let retryFired = false;
      const resume = (immediate?: boolean) => {
        if (resumed) return;
        resumed = true;
        const delayMs = immediate ? 0 : turboDelay;
        console.log(`[Symbols] Scheduling free spin retry in ${delayMs}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo}, immediate: ${!!immediate})`);
        const fireOnce = () => {
          if (retryFired) return;
          retryFired = true;
          this.performFreeSpinAutoplay();
        };
        try {
          this.scene.time.delayedCall(delayMs, () => { fireOnce(); });
        } catch {}
        try { setTimeout(() => { fireOnce(); }, delayMs); } catch {}
      };
      if (!gameStateManager.isShowingWinDialog && !hasRetriggerOverlay()) { resume(true); return; }
      try {
        if (gameStateManager.isShowingWinDialog && !hasRetriggerOverlay() && !hasActiveDialogUi()) {
          console.log('[Symbols] Clearing stale isShowingWinDialog (no dialog UI present) and resuming');
          gameStateManager.isShowingWinDialog = false;
          this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
          resume(true);
          return;
        }
      } catch {}
      try {
        const wom: any = (this.scene as any).winOverlayManager;
        const hasOverlay = !!(wom && typeof wom.hasActiveOrQueued === 'function' && wom.hasActiveOrQueued());
        if (!hasOverlay && !hasRetriggerOverlay()) {
          console.log('[Symbols] No active/queued win overlay but isShowingWinDialog=true - clearing flag and resuming');
          gameStateManager.isShowingWinDialog = false;
          this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
          resume(true);
          return;
        }
      } catch {}
      try {
        if (gameStateManager.isShowingWinDialog && !hasRetriggerOverlay() && !hasActiveDialogUi()) {
          console.log('[Symbols] Clearing stale isShowingWinDialog (no dialog UI present) and resuming');
          gameStateManager.isShowingWinDialog = false;
          this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
          resume(true);
          return;
        }
      } catch {}
      console.log('[Symbols] Waiting for dialog completion events before continuing free spin autoplay');
      this.scene.events.once('dialogAnimationsComplete', () => { console.log('[Symbols] dialogAnimationsComplete received'); resume(); });
      gameEventManager.once(GameEventType.WIN_DIALOG_CLOSED, () => { console.log('[Symbols] WIN_DIALOG_CLOSED received'); resume(true); });
      if (!this.freeSpinAutoplayWaitingForRetriggerOverlay) {
        this.freeSpinAutoplayWaitingForRetriggerOverlay = true;
        this.scene.events.once('freeSpinRetriggerOverlayClosed', () => {
          console.log('[Symbols] freeSpinRetriggerOverlayClosed received');
          this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
				this.freeSpinAutoplayResumeImmediateOnce = false;
          try { gameStateManager.isShowingWinDialog = false; } catch {}
				try { this.scheduleFreeSpinAutoplayResumeAfterRetriggerOverlay(); } catch { try { this.performFreeSpinAutoplay(); } catch {} }
        });
      }
      try {
        let polls = 0;
        const poll = () => {
          if (resumed) return;
          polls++;
          try {
            if (!gameStateManager.isShowingWinDialog && !hasRetriggerOverlay()) {
              resume(true);
              return;
            }
            if (gameStateManager.isShowingWinDialog && !hasRetriggerOverlay() && !hasActiveDialogUi()) {
              console.log('[Symbols] Clearing stale isShowingWinDialog (no dialog UI present) and resuming');
              gameStateManager.isShowingWinDialog = false;
              this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
              resume(true);
              return;
            }
          } catch {}
          if (polls < 40) {
            try { setTimeout(poll, 250); } catch {}
          }
        };
        try { setTimeout(poll, 0); } catch {}
      } catch {}
      this.scene.time.delayedCall(0, () => {
        if (!gameStateManager.isShowingWinDialog && !hasRetriggerOverlay()) {
          resume(true);
        }
        try {
          if (gameStateManager.isShowingWinDialog && !hasRetriggerOverlay() && !hasActiveDialogUi()) {
            console.log('[Symbols] Clearing stale isShowingWinDialog (no dialog UI present) and resuming');
            gameStateManager.isShowingWinDialog = false;
            this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
            resume(true);
          }
        } catch {}
      });
      this.scene.time.delayedCall(1800, () => {
        if (resumed) return;
        try {
          const wom: any = (this.scene as any).winOverlayManager;
          const hasOverlay = !!(wom && typeof wom.hasActiveOrQueued === 'function' && wom.hasActiveOrQueued());
          if (!hasOverlay && !hasRetriggerOverlay()) {
            console.log('[Symbols] Safety resume: clearing stale isShowingWinDialog and continuing');
            gameStateManager.isShowingWinDialog = false;
            this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
            resume(true);
          }
        } catch {}
        try {
          if (!resumed && gameStateManager.isShowingWinDialog && !hasRetriggerOverlay() && !hasActiveDialogUi()) {
            console.log('[Symbols] Safety resume: clearing stale isShowingWinDialog (no dialog UI present) and continuing');
            gameStateManager.isShowingWinDialog = false;
            this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
            resume(true);
          }
        } catch {}
      });
      return;
    }

    try {
      // Use our free spin simulation instead of the old backend
      console.log('[Symbols] Triggering free spin via SlotController...');
      try {
        if ((gameStateManager as any).isCriticalSequenceLocked) {
          console.log('[Symbols] Free spin autoplay blocked - critical sequence still active, retrying');
          try {
            this.scene.time.delayedCall(100, () => { try { void this.performFreeSpinAutoplay(); } catch {} });
            return;
          } catch {
            try { setTimeout(() => { try { void this.performFreeSpinAutoplay(); } catch {} }, 100); } catch {}
            return;
          }
        }
      } catch {}
      
      // Emit a custom event that SlotController will handle
      gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);
      
      // Decrement spins remaining
      if (!this.freeSpinAutoplayProbeSpin) {
        this.freeSpinAutoplaySpinsRemaining--;
      }
      this.freeSpinAutoplayProbeSpin = false;
      console.log(`[Symbols] Free spin triggered. ${this.freeSpinAutoplaySpinsRemaining} spins remaining.`);
      
      // Set flag to wait for reels to stop before continuing
      this.freeSpinAutoplayWaitingForReelsStop = true;
      console.log('[Symbols] Waiting for reels to stop before continuing free spin autoplay');
      
    } catch (error) {
      console.error('[Symbols] Free spin autoplay error:', error);
      this.stopFreeSpinAutoplay();
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY COMPLETED =====`);
  }

  /**
   * Continue free spin autoplay after reels stop
   */
  private continueFreeSpinAutoplay(): void {
    console.log(`[Symbols] ===== CONTINUING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
		const atZero = this.freeSpinAutoplaySpinsRemaining <= 0;
		let pendingProgressAtZero = false;
		try { pendingProgressAtZero = this.hasPendingBonusProgressionAtZero(); } catch { pendingProgressAtZero = false; }
		const hasRetriggerOverlay = (): boolean => {
			try {
				const sp: any = (this.scene as any)?.scene;
				return !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
			} catch {
				return false;
			}
		};
		if (gameStateManager.isBonus && atZero) {
			let winlines = false;
			try {
				const gd: any = (this.scene as any)?.gameData;
				winlines = !!(gd && isWinlinesShowing(gd));
			} catch { winlines = false; }
			if (!pendingProgressAtZero && !winlines && !gameStateManager.isShowingWinDialog && !hasRetriggerOverlay()) {
				console.log('[Symbols] Reels stopped at 0 spins - running final bonus completion check');
				try {
					this.scene?.time?.delayedCall?.(0, () => { try { void this.performFreeSpinAutoplay(); } catch {} });
					return;
				} catch {}
				try {
					setTimeout(() => { try { void this.performFreeSpinAutoplay(); } catch {} }, 0);
					return;
				} catch {}
			}
		}

    // If we reached 0, we may still need to do a probe spin to pull the next batch (re-trigger).
    let hasMoreQueued = false;
    try {
      hasMoreQueued = !!(gameStateManager.isBonus && fakeBonusAPI.isEnabled() && fakeBonusAPI.hasMoreFreeSpins());
    } catch {}

    // Check if we still have spins remaining
    // IMPORTANT: even if allowContinueAtZero is currently false, if we still have queued fake spins
    // we must wait for WIN_STOP so stage completion can update availableCredits.
		if (this.freeSpinAutoplaySpinsRemaining > 0 || hasMoreQueued || pendingProgressAtZero) {
      // Wait for WIN_STOP event to ensure winlines complete before next spin
      // This is the same approach as normal autoplay - no safety timer needed
      console.log('[Symbols] Waiting for WIN_STOP event before continuing free spin autoplay');
      console.log('[Symbols] Setting freeSpinAutoplayWaitingForWinlines to true');
      this.freeSpinAutoplayWaitingForWinlines = true;
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines is now:', this.freeSpinAutoplayWaitingForWinlines);
    } else {
      console.log('[Symbols] All free spins completed');
      this.stopFreeSpinAutoplay();
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY CONTINUED =====`);
  }

  /**
   * Handle WIN_STOP for free spin autoplay (similar to normal autoplay)
   */
  private async handleFreeSpinAutoplayWinStop(): Promise<void> {
    console.log('[Symbols] handleFreeSpinAutoplayWinStop called - freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
    if (!this.freeSpinAutoplayWaitingForWinlines) {
      console.log('[Symbols] Not waiting for winlines - skipping free spin autoplay continuation');
      return;
    }

    console.log('[Symbols] WIN_STOP received - continuing free spin autoplay after winlines complete');
    this.freeSpinAutoplayWaitingForWinlines = false;
    
    // Clear any existing timer since WIN_STOP fired properly
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }

    // Use the same timing as normal autoplay, but don't add extra pacing delay when:
    // - Turbo is enabled (delay is very noticeable)
    // - The user just manually dismissed a retrigger/multiplier overlay
    const baseDelay = 500;
    let delayMs = baseDelay;
    try {
      let forceImmediate = false;
      try {
        const sp: any = (this.scene as any)?.scene;
        const hasOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
        forceImmediate = !!this.freeSpinAutoplayWaitingForRetriggerOverlay || hasOverlay;
      } catch {}
      if (forceImmediate) {
        delayMs = 0;
      } else if (this.freeSpinAutoplayResumeImmediateOnce) {
        delayMs = 0;
        this.freeSpinAutoplayResumeImmediateOnce = false;
      } else if (gameStateManager.isTurbo) {
        delayMs = 0;
      } else {
        delayMs = baseDelay;
      }
    } catch {
      delayMs = baseDelay;
    }
    console.log(`[Symbols] Scheduling next free spin in ${delayMs}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo}, immediate: ${delayMs === 0})`);

		try {
			const gameSceneAny: any = this.scene as any;
			if (gameStateManager.isBonus && gameSceneAny && typeof gameSceneAny.waitForBonusOverlayQueueIdle === 'function') {
				await gameSceneAny.waitForBonusOverlayQueueIdle(15000);
			}
		} catch {}
		try { await gameStateManager.waitForSpinPipelineIdle({ timeoutMs: 12000 }); } catch {}

    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(delayMs, () => {
      this.performFreeSpinAutoplay();
    });
  }

  /**
   * Schedule congrats dialog after free spin autoplay ends
   * Waits for any win dialogs to auto-close (2.5s) plus additional buffer time
   */
  private scheduleCongratsDialogAfterAutoplay(): void {
    console.log('[Symbols] Scheduling congrats dialog after free spin autoplay ends');
    
    // Check if there's currently a win dialog showing
    const gameScene = this.scene as any;
    const hasWinDialog = gameScene.dialogs && gameScene.dialogs.isDialogShowing() && gameScene.dialogs.isWinDialog();
    
    if (hasWinDialog) {
      console.log('[Symbols] Win dialog is currently showing - waiting for auto-close (2.5s) plus buffer time');
      // Wait for win dialog auto-close (2.5s) plus additional buffer time (1s) = 3.5s total
      this.scene.time.delayedCall(3500, () => {
        this.showCongratsDialogAfterDelay();
      });
    } else {
      console.log('[Symbols] No win dialog showing - waiting 1 second before showing congrats');
      // No win dialog, just wait a short buffer time
      this.scene.time.delayedCall(1000, () => {
        this.showCongratsDialogAfterDelay();
      });
    }
  }

  /**
   * Show congrats dialog after the delay period
   */
  private showCongratsDialogAfterDelay(): void {
    try {
      if (gameStateManager.isBonus) {
        if (this.freeSpinAutoplayActive) return;
        if ((Number((this as any).freeSpinAutoplaySpinsRemaining) || 0) > 0) return;
      }
    } catch {}
    try {
      if (this.bonusCongratsTriggered) return;
      this.bonusCongratsTriggered = true;
    } catch {}
    try {
      if (gameStateManager.isBonusFinished) {
        gameStateManager.isBonusFinished = false;
      }
    } catch {}
    console.log('[Symbols] Showing congrats dialog after delay');
    
    const gameScene = this.scene as any;
    
    // Close any open win dialogs first (safety check)
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }

    // Hide any win overlays that might be showing
    try {
      if (gameScene.bigWinOverlay && typeof gameScene.bigWinOverlay.hide === 'function' && typeof gameScene.bigWinOverlay.getIsShowing === 'function' && gameScene.bigWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding BigWinOverlay before showing congrats');
        gameScene.bigWinOverlay.hide(150);
      }
      if (gameScene.superWinOverlay && typeof gameScene.superWinOverlay.hide === 'function' && typeof gameScene.superWinOverlay.getIsShowing === 'function' && gameScene.superWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding SuperWinOverlay before showing congrats');
        gameScene.superWinOverlay.hide(150);
      }
      if (gameScene.epicWinOverlay && typeof gameScene.epicWinOverlay.hide === 'function' && typeof gameScene.epicWinOverlay.getIsShowing === 'function' && gameScene.epicWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding EpicWinOverlay before showing congrats');
        gameScene.epicWinOverlay.hide(150);
      }
    } catch (e) {
      console.warn('[Symbols] Error hiding win overlays:', e);
    }
    
    // Clear win queue to prevent queued win dialogs from showing after congrats
    if (gameScene.clearWinQueue && typeof gameScene.clearWinQueue === 'function') {
      console.log('[Symbols] Clearing win queue before showing congrats');
      gameScene.clearWinQueue();
    }

    // Reset win dialog state
    gameStateManager.isShowingWinDialog = false;
    
    // Calculate total win for congrats using normalized backend totals
		let totalWin = 0;
		try {
			const cached = Number(this.lastBonusTotalWin);
			if (isFinite(cached) && cached >= 0) {
				totalWin = cached;
			}
		} catch {}
		if (!(totalWin > 0)) {
			try {
				const sd: any = this.currentSpinData;
				const it0: any = getCurrentFreeSpinItem(sd);
				const vRun = Number(it0?.runningWin);
				if (isFinite(vRun) && vRun >= 0) {
					totalWin = vRun;
				}
			} catch {}
		}
		if (!(totalWin > 0)) {
			try {
				const sd: any = this.currentSpinData;
				const v0 = Number(sd?.slot?.__backendTotalWin);
				if (isFinite(v0) && v0 >= 0) {
					totalWin = v0;
				}
			} catch {}
		}
		if (!(totalWin > 0)) {
			try {
				const sd: any = this.currentSpinData;
				const v1 = Number(sd?.slot?.totalWin);
				if (isFinite(v1) && v1 >= 0) {
					totalWin = v1;
				}
			} catch {}
		}
		if (!(totalWin > 0)) {
			try {
				const sd: any = this.currentSpinData;
				const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
				const v2 = Number(fs?.__backendTotalWin);
				if (isFinite(v2) && v2 >= 0) {
					totalWin = v2;
				}
			} catch {}
		}
		if (!(totalWin > 0)) {
			try {
				const sd: any = this.currentSpinData;
				const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
				const v3 = Number(fs?.totalWin);
				if (isFinite(v3) && v3 >= 0) {
					totalWin = v3;
				}
			} catch {}
		}
		try {
			const bh: any = (gameScene as any)?.bonusHeader;
			const vHeader = Number(bh?.getCurrentWinnings?.());
			if (isFinite(vHeader) && vHeader >= 0) {
				const vCur = Number(totalWin);
				totalWin = (isFinite(vCur) && vCur >= 0) ? Math.max(vCur, vHeader) : vHeader;
			}
		} catch {}
		try { console.log(`[Symbols] Congrats total win resolved as: ${totalWin}`); } catch {}
    
    // Show congrats dialog with total win amount
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongrats === 'function') {
			let queued = false;
			try {
				if (gameStateManager.isBonus && typeof gameScene.enqueueBonusOverlay === 'function' && typeof gameScene.dialogs.showCongratsQueued === 'function') {
					queued = true;
					gameScene.enqueueBonusOverlay(async () => {
						try {
							await gameScene.dialogs.showCongratsQueued(this.scene, { winAmount: totalWin });
						} catch {}
					});
				}
			} catch {}
			if (!queued) {
				gameScene.dialogs.showCongrats(this.scene, { winAmount: totalWin });
			}
			console.log(`[Symbols] Congrats dialog ${queued ? 'queued' : 'shown'} with total win: ${totalWin}`);
    } else {
      console.warn('[Symbols] Dialogs component not available for congrats dialog');
      let shouldShowTotal = false;
      try {
        const remaining = Number((this as any)?.freeSpinAutoplaySpinsRemaining);
        const pending = (this as any)?.pendingBackendRetriggerTotal;
        shouldShowTotal = (isFinite(remaining) ? remaining : 0) <= 0 && (pending === null || pending === undefined);
      } catch {
        shouldShowTotal = false;
      }
      if (shouldShowTotal) {
        try {
          const s: any = this.scene as any;
          const mgr: any = s?.scene;
          const canLaunch = !!(mgr && typeof mgr.launch === 'function');
          if (canLaunch) {
            try {
              if (mgr.isActive?.('BubbleOverlayTransition') || mgr.isSleeping?.('BubbleOverlayTransition')) {
                try { mgr.stop('BubbleOverlayTransition'); } catch {}
              }
            } catch {}
            mgr.launch('BubbleOverlayTransition', {
              fromSceneKey: 'Game',
              toSceneKey: 'Game',
              stopFromScene: false,
              toSceneEvent: 'prepareBonusExit',
              toSceneEventOnFinish: 'finalizeBonusExit'
            });
            try { mgr.bringToTop?.('BubbleOverlayTransition'); } catch {}
          } else {
            s?.events?.emit?.('finalizeBonusExit');
          }
          console.log('[Symbols] Fallback: triggered bonus exit transition (Dialogs unavailable)');
        } catch {}
      }
    }
  }

  /**
   * Stop free spin autoplay
   */
  private stopFreeSpinAutoplay(): void {
    console.log('[Symbols] ===== STOPPING FREE SPIN AUTOPLAY =====');
    
    // Check if we're stopping because free spins are complete (before resetting state)
    const spinsWereComplete = this.freeSpinAutoplaySpinsRemaining <= 0;
    
    // Clear timer
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }
    
    // Reset state
    this.freeSpinAutoplayActive = false;
    this.freeSpinAutoplaySpinsRemaining = 0;
    this.freeSpinAutoplayWaitingForReelsStop = false;
    this.freeSpinAutoplayWaitingForWinlines = false;
		this.freeSpinAutoplayWaitingForRetriggerOverlay = false;
    this.freeSpinAutoplayTriggered = false;
    this.dialogListenerSetup = false; // Reset dialog listener setup flag
    
    // Reset global autoplay state
    gameStateManager.isAutoPlaying = false;
    gameStateManager.isAutoPlaySpinRequested = false;
    
    // Show congrats dialog after free spin autoplay ends
    //this.scheduleCongratsDialogAfterAutoplay();
    this.scene.gameData.isAutoPlaying = false;
    
    // Restore winline animation timing to normal mode (same as normal autoplay)
    console.log('[Symbols] Restoring winline animation timing to normal mode');
    this.setTurboMode(false);
    
    // If we're in bonus mode and all free spins are complete, ensure bonus mode is properly ended
    // This is a safety check - SlotController should have already handled this, but ensure it happens
    // even if a win overlay was blocking the transition
    if (gameStateManager.isBonus && spinsWereComplete) {
      console.log('[Symbols] All free spins complete - marking bonus as finished');
      gameStateManager.isBonusFinished = true;
			try {
				this.scene?.time?.delayedCall?.(100, () => {
					try {
						if (!gameStateManager.isBonus || !gameStateManager.isBonusFinished) return;
						if (gameStateManager.isShowingWinDialog) return;
						let winlines = false;
						try {
							const gd: any = (this.scene as any)?.gameData;
							winlines = !!(gd && isWinlinesShowing(gd));
						} catch { winlines = false; }
						if (winlines) return;
						let hasRetriggerOverlay = false;
						try {
							const sp: any = (this.scene as any)?.scene;
							hasRetriggerOverlay = !!(sp?.isActive?.('FreeSpinRetriggerOverlay') || sp?.isSleeping?.('FreeSpinRetriggerOverlay'));
						} catch { hasRetriggerOverlay = false; }
						if (hasRetriggerOverlay) return;
						console.log('[Symbols] Bonus finished at 0 spins with no win visuals - showing congrats');
						this.showCongratsDialogAfterDelay();
						gameStateManager.isBonusFinished = false;
					} catch {}
				});
			} catch {}
      // Note: We don't emit setBonusMode(false) here because it should be handled by SlotController
      // or by the win overlay dismissal handler. This ensures we don't have duplicate transitions.
    }
    
    // Emit AUTO_STOP event to notify other systems
    gameEventManager.emit(GameEventType.AUTO_STOP);
    
    console.log('[Symbols] Free spin autoplay stopped');
    console.log('[Symbols] ===== FREE SPIN AUTOPLAY STOPPED =====');
  }

  /**
   * Check if free spin autoplay is currently active
   */
  public isFreeSpinAutoplayActive(): boolean {
    return this.freeSpinAutoplayActive;
  }

  /**
   * Process spin data directly (for free spin autoplay)
   */
  public async processSpinData(spinData: any): Promise<void> {
    console.log('[Symbols] Processing spin data directly:', spinData);
    
    if (!spinData || !spinData.slot || !spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    this.currentSpinData = spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
    
    try {
      (this as any).syncFreeSpinRemainingFromSpinData?.(spinData);
    } catch {}
    
    const symbols = spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    await processSpinDataSymbols(this, symbols, spinData);
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.497;
  let centerY = self.scene.scale.height * 0.45;

  self.symbols = [];
  self.newSymbols = [];
  self.displayWidth = 68;
  self.displayHeight = 68;
  self.horizontalSpacing = 10;
  self.verticalSpacing = 5;

  let spacingX = self.horizontalSpacing * (SLOT_COLUMNS - 1);
  let spacingY = self.verticalSpacing * (SLOT_ROWS - 1);
  self.totalGridWidth = (self.displayWidth * SLOT_COLUMNS) + spacingX;
  self.totalGridHeight = (self.displayHeight * SLOT_ROWS) + spacingY;

  self.slotX = centerX;
  self.slotY = centerY;
}

function createContainer(self: Symbols) {
  self.container = self.scene.add.container(0, 0);
  // Ensure the entire symbol grid renders above bubble stream systems (depth 878)
  try { self.container.setDepth(880); } catch {}

  // Create and store a geometry mask with configurable padding
  self.gridMaskShape = self.scene.add.graphics();
  self.gridMaskShape.clear();
  self.gridMaskShape.fillRect(
    self.slotX - self.totalGridWidth * 0.5 - self.gridMaskPaddingLeft,
    self.slotY - self.totalGridHeight * 0.5 - self.gridMaskPaddingTop,
    self.totalGridWidth + self.gridMaskPaddingLeft + self.gridMaskPaddingRight,
    self.totalGridHeight + self.gridMaskPaddingTop + self.gridMaskPaddingBottom
  );
  self.gridMask = self.gridMaskShape.createGeometryMask();
  self.container.setMask(self.gridMask);
  self.gridMaskShape.setVisible(false);
  console.log(`[Symbols] Mask created with padding - Left: ${self.gridMaskPaddingLeft}, Right: ${self.gridMaskPaddingRight}, Top: ${self.gridMaskPaddingTop}, Bottom: ${self.gridMaskPaddingBottom}`);
}

function onStart(self: Symbols) {
  console.log('[Symbols] onStart called');
  
  // Listen for START event to create initial symbols
  gameEventManager.on(GameEventType.START, () => {
    console.log('[Symbols] START event received, creating initial symbols...');
    
    // Create initial symbols with default data
    createInitialSymbols(self);
  });
}

function createInitialSymbols(self: Symbols) {
  let scene = self.scene;

  // Ensure Spine factory is available for this scene so we can create Spine symbols
  const hasSpineFactory = ensureSpineFactory(scene as any, '[Symbols] createInitialSymbols');

  const excludedSymbolIds = new Set<number>([5, 11, 12, 13, 14]);
  const pickFrom: number[] = (NORMAL_SYMBOLS || [])
    .filter((n) => !excludedSymbolIds.has(n))
    .filter((n) => {
      try {
        // Symbol 5 may use variant keys; allow it even if a plain symbol_5 texture is not present.
        if (n === 5) return true;
        const spriteKey = `symbol_${n}`;
        if (scene.textures.exists(spriteKey)) return true;
        const spineKey = `symbol_${n}_spine`;
        const hasSpineJson = (scene.cache.json as any)?.has?.(spineKey);
        return !!(hasSpineJson && (scene.add as any)?.spine);
      } catch {
        return false;
      }
    });
  if (pickFrom.length === 0) {
    console.error('[Symbols] No usable base symbols found for initial grid');
    return;
  }

  const symbols: number[][] = [];
  for (let col = 0; col < SLOT_COLUMNS; col++) {
    const colArr: number[] = [];
    for (let row = 0; row < SLOT_ROWS; row++) {
      const idx = Math.floor(Math.random() * pickFrom.length);
      colArr.push(pickFrom[idx]);
    }
    symbols.push(colArr);
  }
  console.log('[Symbols] Using randomized initial symbols:', symbols);
  
  // Store current symbol data for reset purposes
  self.currentSymbolData = symbols;
  try { (self.scene as any).currentSymbolData = symbols; } catch {}
  
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5;
  
  for (let col = 0; col < symbols.length; col++) {
    let rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
      const symbolValue = symbols[col][row];
      let symbol: any;
      try {
        let spineKey = `symbol_${symbolValue}_spine`;
        let atlasKey = spineKey + '-atlas';
        if (symbolValue === 5) {
          const variantInfo = getSymbol5SpineKeyForVariant('Symbol5_Sk8' as any);
          spineKey = variantInfo.spineKey;
          atlasKey = variantInfo.atlasKey;
        }
        const hasSpineJson = (scene.cache.json as any)?.has?.(spineKey);

        if (hasSpineJson && (scene.add as any)?.spine) {
          // Create Spine symbol for initial grid
          const spineSymbol = (scene.add as any).spine(x, y, spineKey, atlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}

          const baseScale = self.getIdleSpineSymbolScale(symbolValue);
          self.centerAndFitSpine(
            spineSymbol,
            x,
            y,
            self.displayWidth,
            self.displayHeight,
            baseScale,
            self.getIdleSymbolNudge(symbolValue)
          );

								try {
									const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
									if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
								} catch {}

          self.container.add(spineSymbol);
          symbol = spineSymbol;
        } else {
          // Fallback to PNG if Spine is not available
          let spriteKey: string | null = null;
          if (symbolValue === 5) {
            try {
              spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
            } catch {}
          }
          if (!spriteKey) {
            spriteKey = 'symbol_' + symbolValue;
          }

          if (spriteKey && scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] No Spine or PNG texture for new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        }
      } catch (error) {
        // Final safety fallback to PNG if available
        let spriteKey: string;
        if (symbolValue === 5) {
          // Default Symbol 5 variant as last-resort fallback
          try {
            spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
          } catch {
            spriteKey = 'symbol_5';
          }
        } else {
          spriteKey = 'symbol_' + symbolValue;
        }

        try {
          if (scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try {
              if (symbolValue === 8 || symbolValue === 9 || symbolValue === 10) {
                (sprite as any).__allowWaveShaderDuringSpin = true;
              }
            } catch {}
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] Failed to create new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        } catch {
          console.warn(`[Symbols] Exception while creating fallback for symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
          symbol = null as any;
        }
      }

      rows.push(symbol);
    }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');
}

/**
 * Process symbols from SpinData (GameAPI response)
 */
async function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols:', symbols);
  
  try {
    if (spinData && spinData.slot) {
      const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
      const itemsFs: any[] | undefined = fs?.items;
      const it0: any = Array.isArray(itemsFs) && itemsFs.length > 0 ? itemsFs[0] : null;
      if (it0) {
        try {
          const slotAny: any = spinData.slot;
          if (it0?.special && it0?.special?.action) {
            const nextAction = String(it0.special.action);
            const slotAction = slotAny?.special?.action ? String(slotAny.special.action) : '';
            if (!slotAny.special || !slotAny.special.action || slotAction !== nextAction) {
              slotAny.special = it0.special;
            } else if (!slotAny.special.items && (it0.special as any).items) {
              try { slotAny.special.items = (it0.special as any).items; } catch {}
            }
          }
        } catch {}
        try {
          const slotAny: any = spinData.slot;
          if (!Array.isArray(slotAny.money) && Array.isArray(it0?.money) && Array.isArray(it0?.money?.[0])) {
            slotAny.money = it0.money;
          }
        } catch {}
      }
    }
  } catch {}
  
  // Track whether this spin contains a hook-scatter special so we can
  // trigger the hook-scatter sequence only after winlines finish.
  try {
    const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
    (self as any).hasPendingHookScatter = !!(special && special.action === 'hook-scatter' && special.position);
  } catch {
    (self as any).hasPendingHookScatter = false;
  }

	try {
		const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
		let hasDynamite = false;
		if (special && special.action === 'dynamite') {
			const grid: any[][] | undefined = (Array.isArray(special.items) && Array.isArray(special.items[0]))
				? special.items
				: spinData?.slot?.money;
			if (Array.isArray(grid) && Array.isArray(grid[0])) {
				for (let c = 0; c < grid.length && !hasDynamite; c++) {
					const colArr = grid[c];
					if (!Array.isArray(colArr)) continue;
					for (let r = 0; r < colArr.length; r++) {
						const v = Number(colArr[r] ?? 0);
						if (isFinite(v) && v > 0) {
							hasDynamite = true;
							break;
						}
					}
					if (hasDynamite) break;
				}
			}
		}
		(self as any).hasPendingDynamite = hasDynamite;
	} catch {
		(self as any).hasPendingDynamite = false;
	}
  
  // Clear all scatter symbols from previous spin
  if (self.scatterAnimationManager) {
    self.scatterAnimationManager.clearScatterSymbols();
  }
  
  // Reset symbols and clear previous state before starting new spin
  console.log('[Symbols] Resetting symbols and clearing previous state for new spin');
  self.ensureCleanSymbolState();
  
  // Always clear win lines and overlay when a new spin starts
  console.log('[Symbols] Clearing win lines and overlay for new spin');
  self.clearWinLines();
  
  // Store current symbol data for idle animation access
  (self.scene as any).currentSymbolData = symbols;
  self.currentSymbolData = symbols;
  
  // Store winning positions for idle animation exclusion
  const winningPositions = new Set<string>();
  if (spinData.slot?.paylines && Array.isArray(spinData.slot.paylines) && spinData.slot.paylines.length > 0) {
    for (const payline of spinData.slot.paylines) {
      if (payline.positions && Array.isArray(payline.positions)) {
        for (const pos of payline.positions) {
          if (pos.x !== undefined && pos.y !== undefined) {
            winningPositions.add(`${pos.x}_${pos.y}`);
          }
        }
      }
    }
  }
  (self.scene as any).currentWinningPositions = winningPositions;
  
  // Convert SpinData paylines to the format expected by the game
  const convertedWins = convertPaylinesToWinFormat(spinData);
  console.log('[Symbols] Converted SpinData paylines to win format:', convertedWins);
  
  // Set proper timing for animations
  const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
  const adjustedDelay = gameStateManager.isTurbo ? 
    baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER : baseDelay;
  
  console.log('[Symbols] Setting animation timing:', {
    baseDelay,
    isTurbo: gameStateManager.isTurbo,
    adjustedDelay
  });
  
  // Apply timing to GameData for animations
  setSpeed(self.scene.gameData, adjustedDelay);
  self.scene.gameData.dropReelsDelay = 0;

  // Ensure anticipation state is available early (before any pending skip is re-applied).
  // This also allows us to suppress skip for anticipation spins even if the player tapped skip very early.
  try {
    const sc: any = self.scene as any;
    const isAnticipationSpin = (() => {
      try {
        const scatterVal = SCATTER_SYMBOL[0];
        let count = 0;
        for (let c = 0; c < symbols.length; c++) {
          const colArr = symbols[c];
          if (!Array.isArray(colArr)) continue;
          for (let r = 0; r < colArr.length; r++) {
            if (colArr[r] === scatterVal) count += 1;
            if (count >= 3) return true;
          }
        }
      } catch {}
      return false;
    })();

    try { sc.__isScatterAnticipationActive = isAnticipationSpin; } catch {}
    try { sc.__scatterAnticipationStageRunning = false; } catch {}
    if (isAnticipationSpin) {
			try { (self as any).clearSkipReelDrops?.(); } catch {}
      try { (self as any).skipHitbox?.disableInteractive?.(); } catch {}
    }
  } catch {}

  // If skip was requested very early (before spin data / tweens existed), the timing we just set
  // would overwrite the earlier skip tweaks. Re-apply the skip tweaks now, right before
  // we create/run the reel-drop tweens.
  	try {
		if (!gameStateManager.isTurbo && ((self as any).skipReelDropsPending || (self as any).skipReelDropsActive)) {
			const blockForAnticipation = (() => {
				try {
					return !!((self.scene as any)?.__isScatterAnticipationActive || (self.scene as any)?.__scatterAnticipationStageRunning);
				} catch {
					return false;
				}
			})();
			if (blockForAnticipation) {
			try { (self as any).clearSkipReelDrops?.(); } catch {}
			} else {
			try { destroyActiveFillerSymbols(self); } catch {}
			try { (self as any).skipReelDropsPending = false; } catch {}
			}
		}
	} catch {}
  
  // Set spinning state
  gameStateManager.isReelSpinning = true;
  
  // Build new symbols from the raw grid
  createNewSymbols(self, symbols);
  
  try {
    self.updateMoneyValueOverlays(spinData, self.newSymbols);
  } catch {}
  
  // Run the reel-drop animation using the raw symbols grid
  await runDropReels(self, symbols, Symbols.FILLER_COUNT);
  
  disposeSymbols(self.symbols);
  self.symbols = self.newSymbols;
  self.newSymbols = [];

  try {
    self.updateMoneyValueOverlays(spinData);
  } catch {}

  try {
    let hasCollector = false;
    let hasMoney = false;
    const area: any[][] = spinData?.slot?.area;
    if (Array.isArray(area)) {
      for (let col = 0; col < area.length; col++) {
        const colArr = area[col];
        if (!Array.isArray(colArr)) continue;
        for (let row = 0; row < colArr.length; row++) {
          const id = colArr[row];
          if (id === 11) {
            hasCollector = true;
          } else if (id === 5 || id === 12 || id === 13 || id === 14) {
            const v = getMoneyValueForCell(spinData, col, row);
            if (typeof v === 'number' && v > 0) {
              hasMoney = true;
            }
          }
          if (hasCollector && hasMoney) break;
        }
        if (hasCollector && hasMoney) break;
      }
    }
    const inBonus = !!gameStateManager.isBonus;
    (self as any).hasPendingCollectorSequence = !!(inBonus && hasCollector && hasMoney);
    try {
      const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
      const hasDynamiteSpecial = !!(special && special.action === 'dynamite');
      (self as any).hasPendingCollectorOnlySequence = !!(inBonus && hasCollector && !hasMoney && !hasDynamiteSpecial);
    } catch {
      (self as any).hasPendingCollectorOnlySequence = false;
    }
  } catch {
    (self as any).hasPendingCollectorSequence = false;
    (self as any).hasPendingCollectorOnlySequence = false;
  }

  try {
    const hasPaylines = Array.isArray(spinData.slot?.paylines) && spinData.slot.paylines.length > 0;
    if (hasPaylines) {
      replaceWithSpineAnimations(self, symbols, convertedWins);
    }
  } catch {}
  
  // Check for scatter symbols and trigger scatter bonus if found
  console.log('[Symbols] Checking for scatter symbols...');
  console.log('[Symbols] Symbols grid:', symbols);
  console.log('[Symbols] SCATTER_SYMBOL from GameConfig:', SCATTER_SYMBOL);
  
  const scatterGrids = getScatterGridsFromSymbols(symbols);
  let hookScatterGrid: { x: number; y: number; symbol: number } | null = null;
  let effectiveScatterGrids = scatterGrids;
  try {
    const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
    if (special && special.action === 'hook-scatter' && special.position) {
      const hx = Number((special as any).position?.x);
      const hy = Number((special as any).position?.y);
      if (isFinite(hx) && isFinite(hy)) {
        const col = hx;
        const row = hy;
        if (col >= 0 && row >= 0 && col < symbols.length && Array.isArray(symbols[col]) && row < symbols[col].length) {
          hookScatterGrid = { x: col, y: row, symbol: SCATTER_SYMBOL[0] };
          const alreadyCounted = scatterGrids.some((g) => g.x === col && g.y === row);
          if (!alreadyCounted) {
            effectiveScatterGrids = scatterGrids.concat([hookScatterGrid]);
          }
        }
      }
    }
  } catch {}

  console.log('[Symbols] ScatterGrids found:', effectiveScatterGrids);
  console.log('[Symbols] ScatterGrids length:', effectiveScatterGrids.length);

  const willTriggerScatter = effectiveScatterGrids.length >= 3;

	if (willTriggerScatter) {
		try { gameStateManager.isScatter = true; } catch {}
		try { (self.scene as any)?.events?.emit('scatterTransitionStart'); } catch {}
		try {
			const keepBright = new Set<string>();
			try {
				for (const g of effectiveScatterGrids) {
					if (!g) continue;
					keepBright.add(`${(g as any).x}_${(g as any).y}`);
				}
			} catch {}
			applyNonWinningSymbolDim(self.scene as any, self.symbols, keepBright, symbols as any, { darkenBgDepth: false });
		} catch {}
	}
  
  // Check if this win meets the dialog threshold and pause autoplay if so
  if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
    const totalWin = calculateTotalWinFromPaylines(spinData.slot.paylines);
    const betAmount = parseFloat(spinData.bet);
    const multiplier = totalWin / betAmount;
    
    if (multiplier >= 20) {
      console.log(`[Symbols] Win meets dialog threshold (${multiplier.toFixed(2)}x) - pausing autoplay immediately`);
    } else {
      console.log(`[Symbols] Win below dialog threshold (${multiplier.toFixed(2)}x) - autoplay continues`);
    }
  }

  // Draw win lines using the new SpinData method
  let waitForWinStopBeforeScatter: Promise<void> | null = null;
  if (self.winLineDrawer) {
    if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
      // Determine win line animation type based on autoplay state and counter
      const slotController = (self.scene as any).slotController;
      const autoplaySpinsRemaining = slotController ? slotController.autoplaySpinsRemaining : 0;
      const isFreeSpinAutoplay = self.freeSpinAutoplayActive;
      // Normal autoplay is tracked via GameStateManager; exclude free-spin autoplay from this flag
      const isNormalAutoplay = gameStateManager.isAutoPlaying && !isFreeSpinAutoplay;
      const isLastAutoplaySpin = isNormalAutoplay && autoplaySpinsRemaining === 0;
      const isAutoplayActive = isNormalAutoplay && autoplaySpinsRemaining > 0;
      const isSkipActive = typeof (self as any).isSkipReelDropsActive === 'function' ? (self as any).isSkipReelDropsActive() : false;
      
      // Check free spin autoplay FIRST to prevent it from being treated as "last autoplay spin"
      if (willTriggerScatter) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for scatter transition)');
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
          console.log('[Symbols] Applying turbo mode to winlines via SlotController (same as normal autoplay)');
          slotController.applyTurboToWinlineAnimations();
        }

				waitForWinStopBeforeScatter = new Promise<void>((resolve) => {
					let done = false;
					const finish = () => {
						if (done) return;
						done = true;
						resolve();
					};
					try {
						gameEventManager.once(GameEventType.WIN_STOP, () => finish());
					} catch {
						finish();
						return;
					}
					try { (self.scene as any)?.time?.delayedCall?.(15000, () => finish()); } catch { try { setTimeout(() => finish(), 15000); } catch { finish(); } }
				});

				self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else if (isFreeSpinAutoplay) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for free spin autoplay)');
        // Apply turbo mode exactly like normal autoplay does
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
          console.log('[Symbols] Applying turbo mode to winlines via SlotController (same as normal autoplay)');
          slotController.applyTurboToWinlineAnimations();
        }
        self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else if (isLastAutoplaySpin) {
        console.log('[Symbols] Drawing win lines from SpinData (looping for last autoplay spin)');
        self.winLineDrawer.drawWinLinesFromSpinData(spinData);
      } else if (isAutoplayActive) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for normal autoplay)');
        // Apply turbo mode exactly like normal autoplay does
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
          console.log('[Symbols] Applying turbo mode to winlines via SlotController (same as normal autoplay)');
          slotController.applyTurboToWinlineAnimations();
        }
        self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else {
        // Manual spins (with or without turbo) should always loop winlines
        console.log('[Symbols] Drawing win lines from SpinData (looping for manual spin)');
        self.winLineDrawer.drawWinLinesFromSpinData(spinData);
      }
      
    } else {
      console.log('[Symbols] No paylines in SpinData, calling WinLineDrawer for no-wins scenario');
      self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
    }
  }

  // NOW handle scatter symbols AFTER winlines are drawn
  if (effectiveScatterGrids.length >= 3) {
    console.log(`[Symbols] Scatter detected! Found ${effectiveScatterGrids.length} scatter symbols`);
		try { if (waitForWinStopBeforeScatter) await waitForWinStopBeforeScatter; } catch {}

    // If there are no normal wins (no paylines), play scatter SFX now
    try {
      const hasWins = Array.isArray(spinData.slot?.paylines) && spinData.slot.paylines.length > 0;
      if (!hasWins) {
        const audio = (window as any)?.audioManager;
        if (audio && typeof audio.playSoundEffect === 'function') {
          audio.playSoundEffect(SoundEffectType.SCATTER);
          console.log('[Symbols] Played scatter SFX for scatter-only hit');
        }
      }
    } catch {}
    
    // Pause normal autoplay immediately when scatter is detected (will resume after bonus)
    if (gameStateManager.isAutoPlaying) {
      console.log('[Symbols] Scatter detected during autoplay - pausing normal autoplay for bonus');
      // Access SlotController to pause autoplay
      const slotController = (self.scene as any).slotController;
      if (slotController && typeof slotController.pauseAutoplayForBonus === 'function') {
        slotController.pauseAutoplayForBonus();
        console.log('[Symbols] Normal autoplay paused due to scatter detection');
      } else if (slotController && typeof slotController.stopAutoplay === 'function') {
        // Fallback: stop if pause method not available
        slotController.stopAutoplay();
        console.log('[Symbols] Fallback: Normal autoplay stopped due to scatter detection');
      } else {
        console.warn('[Symbols] SlotController not available to pause/stop autoplay');
      }
    }
    // Animate the individual scatter symbols with their hit animations
    console.log('[Symbols] Starting scatter symbol hit animations...');
    try {
      if (hookScatterGrid) {
        try { (self as any).hasPendingHookScatter = false; } catch {}
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            try { (self.scene as any)?.events?.off?.('hook-scatter-complete', onComplete as any); } catch {}
            resolve();
          };
          const onComplete = () => finish();
          try { (self.scene as any)?.events?.once?.('hook-scatter-complete', onComplete as any); } catch {}
          try {
            handleHookScatterHighlight(self as any, spinData);
          } catch {
            finish();
            return;
          }
          try { (self.scene as any)?.time?.delayedCall?.(8000, () => finish()); } catch { try { setTimeout(() => finish(), 8000); } catch { finish(); } }
        });
      }

      await self.animateScatterSymbols(effectiveScatterGrids);
      console.log('[Symbols] Scatter symbol hit animations completed');
    } catch (error) {
      console.error('[Symbols] Error animating scatter symbols:', error);
    }
    
    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    // Check if win dialog is showing - if so, wait for it to close before starting scatter animation
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - waiting for WIN_DIALOG_CLOSED event before starting scatter animation');
      
      // Listen for WIN_DIALOG_CLOSED event to start scatter animation
      const onWinDialogClosed = () => {
        console.log('[Symbols] WIN_DIALOG_CLOSED received - starting scatter animation sequence');
        gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed); // Remove listener
        
        // Start scatter animation after win dialog closes
        self.startScatterAnimationSequence();
      };
      
      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
    } else {
      console.log('[Symbols] No win dialog showing - starting scatter animation immediately');
      // No win dialog, start scatter animation immediately
      self.startScatterAnimationSequence();
    }
  } else {
    console.log(`[Symbols] No scatter detected (found ${effectiveScatterGrids.length} scatter symbols, need 3+)`);
    try { gameStateManager.isBuyFeatureSpin = false; } catch {}
  }
  
  try {
    (self as any).syncFreeSpinRemainingFromSpinData?.(spinData);
  } catch {}

  // Set spinning state to false
  gameStateManager.isReelSpinning = false;
  // Restore tween speed if skip was active
  try { (self as any).clearSkipReelDrops?.(); } catch {}
  
  console.log('[Symbols] SpinData symbols processed successfully');
}

/**
 * Extract scatter grid positions from the symbols grid using SCATTER_SYMBOL from GameConfig.
 */
function getScatterGridsFromSymbols(symbols: number[][]): { x: number; y: number; symbol: number }[] {
  const result: { x: number; y: number; symbol: number }[] = [];
  if (!Array.isArray(symbols) || symbols.length === 0) return result;

  const scatterVal = SCATTER_SYMBOL[0];
  for (let col = 0; col < symbols.length; col++) {
    const column = symbols[col];
    if (!Array.isArray(column)) continue;
    for (let row = 0; row < column.length; row++) {
      if (column[row] === scatterVal) {
        result.push({ x: col, y: row, symbol: scatterVal });
      }
    }
  }
  return result;
}

/**
 * Convert SpinData paylines to the format expected by the game's win system
 */
function convertPaylinesToWinFormat(spinData: any): Map<number, any[]> {
  const allMatching = new Map<number, any[]>();
  
  if (!spinData.slot || !Array.isArray(spinData.slot.paylines)) {
    return allMatching;
  }

  for (const payline of spinData.slot.paylines) {
    const resolvedLineKey = resolveBestWinlineIndex(spinData, payline);
    let winningGrids = getWinningGridsForPayline(spinData, payline, resolvedLineKey);

		try {
			if ((!winningGrids || winningGrids.length === 0) && Array.isArray((payline as any)?.positions)) {
				const positions: any[] = (payline as any).positions;
				if (positions.length > 0) {
					const derived: any[] = [];
					for (const p of positions) {
						const x = Number((p as any)?.x);
						const y = Number((p as any)?.y);
						if (!isFinite(x) || !isFinite(y)) continue;
						const sx = Math.floor(x);
						const sy = Math.floor(y);
						const sym = Number(spinData?.slot?.area?.[sx]?.[sy] ?? 0);
						derived.push({ x: sx, y: sy, symbol: isFinite(sym) ? sym : 0 });
					}
					derived.sort((a, b) => a.x - b.x);
					if (derived.length > 0) {
						winningGrids = derived;
					}
				}
			}
		} catch {}
    
    if (winningGrids.length > 0) {
      allMatching.set(resolvedLineKey, winningGrids);
    }
  }
  
  return allMatching;
}

/**
 * Get winning grids for a specific payline from SpinData
 */
function resolveBestWinlineIndex(spinData: any, payline: any): number {
  const desired = typeof payline.lineKey === 'number' ? payline.lineKey : 0;
  const count = Number(payline.count) || 0;
  const targetSymbol = Number(payline.symbol);

  let bestIndex = (desired >= 0 && desired < WINLINES.length) ? desired : 0;
  let bestLen = -1;
  let bestExact = false;

  for (let i = 0; i < WINLINES.length; i++) {
    const streak = computeStreakForWinline(spinData, i, targetSymbol, count);
    const len = streak.length;
    const exact = count > 0 && len === count;

    if (exact && !bestExact) {
      bestExact = true;
      bestLen = len;
      bestIndex = i;
      continue;
    }
    if (bestExact && exact) {
      if (Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
        bestLen = len;
        bestIndex = i;
      }
      continue;
    }
    if (!bestExact) {
      if (len > bestLen) {
        bestLen = len;
        bestIndex = i;
      } else if (len === bestLen && Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
        bestIndex = i;
      }
    }
  }

  return bestIndex;
}

function computeStreakForWinline(spinData: any, lineKey: number, targetSymbol: number, count: number): { x: number; y: number; symbol: number }[] {
  if (lineKey < 0 || lineKey >= WINLINES.length) {
    return [];
  }

  const winline = WINLINES[lineKey];
  const winlinePositions: { x: number; y: number }[] = [];
  for (let x = 0; x < winline.length; x++) {
    for (let y = 0; y < winline[x].length; y++) {
      if (winline[x][y] === 1) {
        winlinePositions.push({ x, y });
      }
    }
  }

  winlinePositions.sort((a, b) => a.x - b.x);

  const requiredMin = (Number(targetSymbol) === 1) ? 2 : 3;
  const requiredCount = Math.max(0, Number(count) || 0);
  if (requiredCount > 0 && requiredCount < requiredMin) {
    return [];
  }

  const scatterVal = Number((SCATTER_SYMBOL as any)?.[0] ?? 0);
  const collectorVal = 11;
  const matchesTarget = (sym: any): boolean => {
    const v = Number(sym);
    return v === targetSymbol || (v === collectorVal && targetSymbol !== scatterVal);
  };

  if (Number(targetSymbol) === 1) {
    let current: { x: number; y: number; symbol: number }[] = [];
    let prevX: number | null = null;

    for (let i = 0; i < winlinePositions.length; i++) {
      const pos = winlinePositions[i];
      const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];

      const contiguous = prevX === null ? true : (pos.x === prevX + 1);
      if (!contiguous) {
        current = [];
      }

      if (matchesTarget(symbolAtPosition)) {
        current.push({ x: pos.x, y: pos.y, symbol: symbolAtPosition });
        if (requiredCount >= requiredMin && current.length >= requiredCount) {
          return current.slice(0, requiredCount);
        }
      } else {
        current = [];
      }

      prevX = pos.x;
    }

    return [];
  }

  const firstPos = winlinePositions[0];
  if (!firstPos || firstPos.x !== 0) {
    return [];
  }

  const firstSymbol = spinData.slot.area?.[firstPos.x]?.[firstPos.y];
  if (!matchesTarget(firstSymbol)) {
    return [];
  }

  const streak: { x: number; y: number; symbol: number }[] = [{ x: firstPos.x, y: firstPos.y, symbol: firstSymbol }];
  for (let i = 1; i < winlinePositions.length; i++) {
    const pos = winlinePositions[i];
    const prev = winlinePositions[i - 1];

    if (pos.x !== prev.x + 1) {
      break;
    }

    const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];
    if (matchesTarget(symbolAtPosition)) {
      streak.push({ x: pos.x, y: pos.y, symbol: symbolAtPosition });
      if (requiredCount > 0 && streak.length === requiredCount) {
        break;
      }
    } else {
      break;
    }
  }

  if (streak.length < requiredMin) {
    return [];
  }

  return streak;
}

function getWinningGridsForPayline(spinData: any, payline: any, resolvedLineKey: number): any[] {
  const winningGrids: any[] = [];
  const count = payline.count;
  const targetSymbol = payline.symbol;

  const streak = computeStreakForWinline(spinData, resolvedLineKey, targetSymbol, count);

  for (const cell of streak) {
    winningGrids.push(cell);
  }

  return winningGrids;
}

/**
 * Calculate total win from paylines
 */
function calculateTotalWinFromPaylines(paylines: any[]): number {
  let totalWin = 0;
  for (const payline of paylines) {
    totalWin += payline.win;
  }
  return totalWin;
}

function areAreasEqual(a: any, b: any): boolean {
	try {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			const ac = a[i];
			const bc = b[i];
			if (!Array.isArray(ac) || !Array.isArray(bc)) return false;
			if (ac.length !== bc.length) return false;
			for (let j = 0; j < ac.length; j++) {
				if (Number(ac[j]) !== Number(bc[j])) return false;
			}
		}
		return true;
	} catch {
		return false;
	}
}

function getCurrentFreeSpinItem(spinData: any): any | null {
	try {
		const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
		const items: any[] | undefined = fs?.items;
		if (!Array.isArray(items) || items.length <= 0) return null;

		const slotArea = spinData?.slot?.area;
		if (Array.isArray(slotArea) && Array.isArray(slotArea[0])) {
			const match = items.find((it: any) => areAreasEqual(it?.area, slotArea));
			if (match) return match;
		}

		const withSpins = items.find((it: any) => (Number(it?.spinsLeft) || 0) > 0);
		return withSpins ?? items[0];
	} catch {
		return null;
	}
}

function onSpinDataReceived(self: Symbols) {
  // Listen for the new SPIN_DATA_RESPONSE event from GameAPI
  gameEventManager.on(GameEventType.SPIN_DATA_RESPONSE, async (data: any) => {
    console.log('[Symbols] SPIN_DATA_RESPONSE received:', data);
    console.log('[Symbols] SpinData:', data.spinData);
    
    if (!data.spinData || !data.spinData.slot || !data.spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    // Store the current spin data for access by other components
    self.currentSpinData = data.spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
		try {
			if (gameStateManager.isBonus) {
				const sd: any = data.spinData;
				const it0: any = getCurrentFreeSpinItem(sd);
				const vRun = Number(it0?.runningWin);
				if (isFinite(vRun) && vRun >= 0) {
					(self as any).lastBonusTotalWin = vRun;
				}
			}
		} catch {}

		try {
			// IMPORTANT: Sync free-spin remaining *before* we start winline animations.
			// WinLineDrawer emits REELS_STOP/WIN_STOP after its cycle, and free-spin autoplay
			// continues/stops off those events. If a re-trigger happens (spinsLeft jumps up),
			// we must seed the new remaining count early to avoid stopping autoplay prematurely.
			(self as any).syncFreeSpinRemainingFromSpinData?.(data.spinData);
		} catch {}

    // Forward SpinData to Game scene WinTracker (if available) to update win summary bar
    try {
      const gameScene: any = self.scene;
      if (gameScene && gameScene.winTracker && typeof gameScene.winTracker.updateFromSpinData === 'function') {
        gameScene.winTracker.updateFromSpinData(data.spinData);
      }
    } catch (error) {
      console.warn('[Symbols] Failed to update WinTracker from SpinData:', error);
    }
    
    // Use the slot.area from SpinData instead of data.symbols
    const symbols = data.spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the normal spin pipeline
    await processSpinDataSymbols(self, symbols, data.spinData);
  });
}

function createNewSymbols(self: Symbols, symbols: number[][]) {
  referenceFunction(self, symbols);
}

function referenceFunction(self: Symbols, symbols: number[][]) {
  const scene = self.scene;
  disposeSymbols(self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;
  console.log('[Symbols] New symbols from spin response:', symbols);

	const hideNewSymbolsForSkip = (() => {
		try {
			const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
			return hasIsSkipFn
				? !!(self as any).isSkipReelDropsActive()
				: !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
		} catch {
			return false;
		}
	})();

  // Update current symbol data for reset purposes
  self.currentSymbolData = symbols;

  for (let col = 0; col < symbols.length; col++) {
    const rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;
      const symbolValue = symbols[col][row];

      			let symbol: any = null;

			try {
				if (symbolValue === 5) {
					// Prefer Spine-based Symbol 5 variants when possible for visual consistency.
          const spinData: any = (self as any).currentSpinData;
          let variant = getSymbol5VariantForCell(spinData, col, row) || getDefaultSymbol5Variant();

          // Resolve preferred Spine key for this variant
          let variantInfo = getSymbol5SpineKeyForVariant(variant);
          let spineKey = variantInfo.spineKey;
          let spineAtlasKey = variantInfo.atlasKey;

          const cacheJson: any = (scene.cache.json as any);
          let hasSpine = cacheJson?.has?.(spineKey);

          // If the exact variant spine is not available, fall back to any available Symbol 5 spine
          if (!hasSpine) {
            const fallbackVariants = ['Symbol5_Sk8', 'Symbol12_Sk8', 'Symbol13_Sk8', 'Symbol14_Sk8'];
            for (const v of fallbackVariants) {
              try {
                const info = getSymbol5SpineKeyForVariant(v as any);
                if (cacheJson?.has?.(info.spineKey)) {
                  spineKey = info.spineKey;
                  spineAtlasKey = info.atlasKey;
                  hasSpine = true;
                  break;
                }
              } catch {}
            }
          }

          const canCreateSpine = hasSpine && (scene.add as any)?.spine;
          if (canCreateSpine) {
            try {
              const spineSymbol = (scene.add as any).spine(x, y, spineKey, spineAtlasKey);
              spineSymbol.setOrigin(0.5, 0.5);
              try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}

              const baseScale = self.getIdleSpineSymbolScale(symbolValue);
              self.centerAndFitSpine(
                spineSymbol,
                x,
                y,
                self.displayWidth,
                self.displayHeight,
                baseScale,
                self.getIdleSymbolNudge(symbolValue)
              );

								try {
									const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
									if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
								} catch {}

              self.container.add(spineSymbol);
              symbol = spineSymbol;
            } catch (e) {
              console.warn(`[Symbols] Failed to create Spine Symbol 5 at [${col}, ${row}] – falling back to PNG.`, e);
            }
          }

          // Fallback: use PNG variants if Spine could not be created
          if (!symbol) {
            let imageKey: string | null = null;
            try {
              imageKey = getSymbol5ImageKeyForVariant(variant);
              if (!scene.textures.exists(imageKey)) {
                // Fallback to default variant if this specific variant texture is missing
                variant = getDefaultSymbol5Variant();
                imageKey = getSymbol5ImageKeyForVariant(variant);
              }
            } catch {}

            // As a final guard, try any available Symbol 5 variant key
            if (!imageKey || !scene.textures.exists(imageKey)) {
              const candidates = ['symbol_5', 'symbol_12', 'symbol_13', 'symbol_14'];
              const found = candidates.find(k => scene.textures.exists(k));
              if (found) {
                imageKey = found;
              }
            }

            if (imageKey && scene.textures.exists(imageKey)) {
              const sprite = scene.add.sprite(x, y, imageKey);
              const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
              sprite.displayWidth = self.displayWidth * imageScale;
              sprite.displayHeight = self.displayHeight * imageScale;
              try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
              self.container.add(sprite);
              symbol = sprite;
            } else {
              console.warn(`[Symbols] No WEBP/Spine texture available for Symbol 5 at [${col}, ${row}] – leaving empty.`);
              symbol = null as any;
            }
          }
        } else {
          // Prefer WEBP/PNG sprites during spin when available for non-Symbol5
          let renderSymbolValue = symbolValue;
          try {
              							if (gameStateManager.isBonus && symbolValue === 11) {
									const retriggersConsumed = Number((self as any).bonusRetriggersConsumed) || 0;
									const activeLevel = Math.max(0, Math.min(3, retriggersConsumed | 0));
									renderSymbolValue = resolveBonusCollectorVisualSymbolValue(symbolValue, activeLevel);
							}
						} catch {}

          // Symbols 8/9/10 now have their own Spine animations; prefer Spine when available.
          try {
            if (renderSymbolValue === 8 || renderSymbolValue === 9 || renderSymbolValue === 10) {
              const spineKey = `symbol_${renderSymbolValue}_spine`;
              const atlasKey = spineKey + '-atlas';
              const hasSpine = (scene.cache.json as any)?.has?.(spineKey);
              if (hasSpine && (scene.add as any)?.spine) {
                try {
                  symbol = (scene.add as any).spine(x, y, spineKey, atlasKey);
                  symbol.setOrigin(0.5, 0.5);
                  try { symbol.skeleton.setToSetupPose(); symbol.update(0); } catch {}
                  const baseScale = self.getIdleSpineSymbolScale(renderSymbolValue);
                  self.centerAndFitSpine(
                    symbol,
                    x,
                    y,
                    self.displayWidth,
                    self.displayHeight,
                    baseScale,
                    self.getIdleSymbolNudge(renderSymbolValue)
                  );

								try {
									const m = self.getSpineScaleMultiplier(renderSymbolValue) * self.getIdleScaleMultiplier(renderSymbolValue);
									if (m !== 1) symbol.setScale(symbol.scaleX * m, symbol.scaleY * m);
								} catch {}
                  try { self.container.add(symbol); } catch {}
                } catch {
                  symbol = null;
                }
              }
            }
          } catch {}

          let spriteKey = 'symbol_' + renderSymbolValue;
          try {
            if (!scene.textures.exists(spriteKey)) {
              renderSymbolValue = symbolValue;
              spriteKey = 'symbol_' + renderSymbolValue;
            }
          } catch {}
          if (!symbol && scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(renderSymbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try {
              if (renderSymbolValue === 8 || renderSymbolValue === 9 || renderSymbolValue === 10) {
                (sprite as any).__allowWaveShaderDuringSpin = true;
              }
            } catch {}
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, renderSymbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            // Fallback to Spine if no sprite texture exists
            const spineKey = `symbol_${renderSymbolValue}_spine`;
            const atlasKey = spineKey + '-atlas';
            const hasSpine = (scene.cache.json as any)?.has?.(spineKey);
            if (hasSpine && (scene.add as any)?.spine) {
              symbol = (scene.add as any).spine(x, y, spineKey, atlasKey);
              symbol.setOrigin(0.5, 0.5);
              try { symbol.skeleton.setToSetupPose(); symbol.update(0); } catch {}
              const baseScale = self.getIdleSpineSymbolScale(renderSymbolValue);
              self.centerAndFitSpine(
                symbol,
                x,
                y,
                self.displayWidth,
                self.displayHeight,
                baseScale,
                self.getWinSymbolNudge(renderSymbolValue)
              );

							try {
								const m = self.getSpineScaleMultiplier(renderSymbolValue) * self.getIdleScaleMultiplier(renderSymbolValue);
								if (m !== 1) symbol.setScale(symbol.scaleX * m, symbol.scaleY * m);
							} catch {}
              self.container.add(symbol);
            } else {
              console.warn(`[Symbols] No Spine or PNG texture for new symbol ${renderSymbolValue} at [${col}, ${row}] – leaving empty.`);
              symbol = null as any;
            }
          }
        }
      } catch (error) {
        // Final safety fallback to PNG if available
        let spriteKey: string;
        if (symbolValue === 5) {
          // Default Symbol 5 variant as last-resort fallback
          try {
            spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
          } catch {
            spriteKey = 'symbol_5';
          }
        } else {
          spriteKey = 'symbol_' + symbolValue;
        }

        try {
          if (scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] Failed to create new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        } catch {
          console.warn(`[Symbols] Exception while creating fallback for symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
          symbol = null as any;
        }
      }

		try {
			if (hideNewSymbolsForSkip && symbol) {
				try { (symbol as any).setVisible?.(false); } catch {}
				try { (symbol as any).alpha = 0; } catch {}
			}
		} catch {}

      rows.push(symbol);
    }

    self.newSymbols.push(rows);
  }
}

function disposeSymbols(symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;
  
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol: any = symbols[col][row];
      if (symbol && symbol.destroy && !symbol.destroyed) {
        try {
          const symbolType = (symbol as any).animationState ? 'Spine' : 'PNG';
          const symbolKey = (symbol as any).texture?.key || 'unknown';
          (symbol as any).destroy();
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
        }
      }
    }
  }
  
  console.log(`[Symbols] Disposed ${disposedCount} symbols`);
}

function replaceWithSpineAnimations(self: Symbols, symbols: number[][], winsMap: Map<number, any[]>) {
  if (!(winsMap instanceof Map)) {
    return;
  }

  const winningPositions = new Set<string>();

  // Play win SFX once per win evaluation, independent of whether Spine animations are available for the winning symbols.
  try {
    let hasAnyWinningGrid = false;
    for (const grids of winsMap.values()) {
      if (Array.isArray(grids) && grids.length > 0) {
        hasAnyWinningGrid = true;
        break;
      }
    }
    if (hasAnyWinningGrid) {
      const audio = (window as any)?.audioManager;
      if (audio && typeof audio.playSoundEffect === 'function') {
        audio.playSoundEffect(SoundEffectType.HIT_WIN);
        try {
          if (gameStateManager.isScatter) {
            self.scene.time.delayedCall(100, () => {
              try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch {}
            });
          }
        } catch {}
      }
    }
  } catch {}

  for (const [, grids] of winsMap.entries()) {
    for (const grid of grids) {
      const currentSymbol = self.symbols[grid.x] && self.symbols[grid.x][grid.y];
      if (!currentSymbol) {
        continue;
      }
      
      // Mark this cell as a winner
      winningPositions.add(`${grid.x}_${grid.y}`);
      
      // Get the symbol value and construct the Spine key
      const symbolValue = symbols[grid.x][grid.y];

      			try {
				if (gameStateManager.isBonus && symbolValue === 11) {
					const retriggersConsumed = Number((self as any).bonusRetriggersConsumed) || 0;
					const activeLevel = Math.max(0, Math.min(3, retriggersConsumed | 0));
					const visual = resolveBonusCollectorVisualSymbolValue(symbolValue, activeLevel);
					if (visual !== 11) {
						continue;
					}
				}
			} catch {}

      let spineKey = `symbol_${symbolValue}_spine`;
      let spineAtlasKey = spineKey + '-atlas';
      if (symbolValue === 5) {
        try {
          const spinData: any = (self as any).currentSpinData;
          const variant = getSymbol5VariantForCell(spinData, grid.x, grid.y) || getDefaultSymbol5Variant();
          const variantInfo = getSymbol5SpineKeyForVariant(variant);
          spineKey = variantInfo.spineKey;
          spineAtlasKey = variantInfo.atlasKey;
        } catch {}
      }
      // Resolve the best available animation for this symbol (prefer _win, then _hit, else first)
      const winAnimName = self.resolveSymbolAnimName(spineKey, symbolValue);
      
      // Store original position and scale
      const x = currentSymbol.x;
      const y = currentSymbol.y;
      const displayWidth = currentSymbol.displayWidth;
      const displayHeight = currentSymbol.displayHeight;
      
      try {
        // Apply Spine-based win animation for this cell
        const hasExistingSpine = !!(currentSymbol as any)?.animationState;

        if (hasExistingSpine) {
          // Reuse existing Spine target
          const target: any = currentSymbol;

          // Capture starting scale to allow a smooth tween to the win scale
          const startScaleX = (target as any).scaleX ?? 1;
          const startScaleY = (target as any).scaleY ?? 1;

          const configuredScale = self.getSpineSymbolScale(symbolValue);
          self.centerAndFitSpine(target, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));

          // Compute final scale including any multipliers
          let finalScaleX = (target as any).scaleX;
          let finalScaleY = (target as any).scaleY;
          try {
            const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
            if (m !== 1) {
              finalScaleX *= m;
              finalScaleY *= m;
            }
          } catch {}

          // Reset to starting scale and tween smoothly up to the win scale
          try { (target as any).setScale(startScaleX, startScaleY); } catch {}
          try {
            self.scene.tweens.add({
              targets: target,
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              duration: 250,
              ease: 'Power2.easeOut',
            });
          } catch {}

          try { (target as any).animationState.setAnimation(0, winAnimName, true); } catch {}
          try {
            const speed = (window as any)?.gameStateManager?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
            (target as any).animationState.timeScale = Math.max(0.0001, speed);
          } catch {}
          self.reCenterSpineNextTick(target, x, y, self.getWinSymbolNudge(symbolValue));
        } else {
          // No existing Spine instance – create one if possible
          const hasSpineJson = (self.scene.cache.json as any)?.has?.(spineKey);
          const canCreateSpine = hasSpineJson && (self.scene.add as any)?.spine;
          if (!canCreateSpine) {
            console.log(`[Symbols] No Spine data for winning symbol ${symbolValue} at (${grid.x}, ${grid.y}); keeping PNG/WEBP symbol.`);
            // Keep the existing PNG/WEBP symbol without adding a special-case ripple here.
            // Ripple/pulse highlighting is now driven centrally by pulseWinningSymbols per winline.
            continue;
          }
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          // Remove the current sprite
          currentSymbol.destroy();
          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
          self.centerAndFitSpine(spineSymbol, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));

          // Compute final target scale including multipliers, then tween up to it smoothly
          let finalScaleX = spineSymbol.scaleX;
          let finalScaleY = spineSymbol.scaleY;
          try {
            const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
            if (m !== 1) {
              finalScaleX *= m;
              finalScaleY *= m;
            }
          } catch {}

          try {
            const startScaleX = finalScaleX * 0.85;
            const startScaleY = finalScaleY * 0.85;
            spineSymbol.setScale(startScaleX, startScaleY);
            self.scene.tweens.add({
              targets: spineSymbol,
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              duration: 250,
              ease: 'Power2.easeOut',
            });
          } catch {}

          spineSymbol.animationState.setAnimation(0, winAnimName, true);
          try {
            const speed = (window as any)?.gameStateManager?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
            (spineSymbol as any).animationState.timeScale = Math.max(0.0001, speed);
          } catch {}
          self.reCenterSpineNextTick(spineSymbol, x, y, self.getWinSymbolNudge(symbolValue));
          self.container.add(spineSymbol);
          self.symbols[grid.x][grid.y] = spineSymbol;
        }

      } catch (error) {
        console.warn(`[Symbols] Failed to apply Spine animation at (${grid.x}, ${grid.y}):`, error);
        // Fallback to the old tint method if animation target not available
        const fallbackSymbol = self.symbols[grid.x][grid.y];
        if (fallbackSymbol) {
          if (typeof fallbackSymbol.setTint === 'function') {
            fallbackSymbol.setTint(0xFFFFFF);
          }
          if (typeof fallbackSymbol.setBlendMode === 'function') {
            fallbackSymbol.setBlendMode(Phaser.BlendModes.ADD);
          }
          self.scene.tweens.add({
            targets: fallbackSymbol,
            alpha: 0.5,
            duration: 250,
            ease: Phaser.Math.Easing.Sine.InOut,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    }
  }

  // After all winning symbols are handled, dim and shrink non-winning symbols
  if (winningPositions.size > 0) {
    try { applyNonWinningSymbolDim(self.scene, self.symbols, winningPositions, (self as any).currentSymbolData); } catch {}
  }

  // Note: Non-winning symbols idle animations are now handled per-reel in dropNewSymbols
  // This ensures idle animations start after each reel drops rather than all at once
}

async function delay(duration: number) {
  // The duration should already be turbo-adjusted from the backend
  // No need to apply turbo mode again here
  console.log(`[Symbols] Delay: ${duration}ms (should already be turbo-adjusted), turbo state: ${gameStateManager.isTurbo}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}

