import { Scene } from 'phaser';
import { SpinData } from '../backend/SpinData';
import { fakeBonusAPI } from '../backend/FakeBonusAPI';

import { gameEventManager, GameEventType } from '../event/EventManager';
import { gameStateManager } from './GameStateManager';
import { TurboConfig } from '../config/TurboConfig';
import { SCATTER_MULTIPLIERS } from '../config/GameConfig';

export interface ScatterAnimationConfig {
  scatterRevealDelay: number;
  slideInDuration: number;
  spinDelay: number;
  slideDistance: number;
  dialogDelay: number;
}

export class ScatterAnimationManager {

  private static instance: ScatterAnimationManager;
  private scene: Scene | null = null;
  private symbolsContainer: Phaser.GameObjects.Container | null = null;
  private spinnerContainer: Phaser.GameObjects.Container | null = null;
  private spinnerComponent: any = null; // Reference to the Spinner component
  private dialogsComponent: any = null; // Reference to the Dialogs component
  private overlayComponent: any = null;
  private scatterWinOverlay: any = null; // Reference to the ScatterWinOverlay component
  private isAnimating: boolean = false;
  public delayedScatterData: any = null;
  private scatterSymbols: any[] = []; // Store references to scatter symbols
  private useSpinner: boolean = false; // TEMP: disable spinner, use overlay
  private __bonusModeResetListener?: any;
  private __activateBonusModeResetListener?: any;

  private bonusEntryFreeSpinsOverride: number | null = null;

  private config: ScatterAnimationConfig = {
    scatterRevealDelay: 500,
    slideInDuration: 1200,
    spinDelay: 200,
    slideDistance: 200,
    dialogDelay: 300
  };

  // Apply turbo mode to delays for consistent timing
  // Note: Scatter animations always use normal speed for better visual experience
  private getTurboAdjustedDelay(baseDelay: number): number {
    // Always use normal speed for scatter animations, regardless of turbo mode
    return baseDelay;
  }

  private constructor() {}

  public static getInstance(): ScatterAnimationManager {
    if (!ScatterAnimationManager.instance) {
      ScatterAnimationManager.instance = new ScatterAnimationManager();
    }
    return ScatterAnimationManager.instance;
  }

  private setupWheelEventListeners(): void {
    // Intentionally no-op.
  }

  public initialize(scene: Scene, symbolsContainer: Phaser.GameObjects.Container, spinnerContainer: Phaser.GameObjects.Container, spinnerComponent?: any, dialogsComponent?: any, _overlayComponent?: any, scatterWinOverlay?: any): void {
    this.scene = scene;
    this.symbolsContainer = symbolsContainer;
    this.spinnerContainer = spinnerContainer;
    this.spinnerComponent = spinnerComponent;
    this.dialogsComponent = dialogsComponent;
    this.overlayComponent = null;
    this.scatterWinOverlay = scatterWinOverlay || null;

    try {
      if (this.__bonusModeResetListener) {
        try { this.scene?.events?.off?.('setBonusMode', this.__bonusModeResetListener); } catch {}
      }
      this.__bonusModeResetListener = (isBonus: boolean) => {
        try {
          if (!isBonus) return;
          this.stopRegisteredScatterSymbolsAnimations();
        } catch {}
      };
      try { this.scene?.events?.on?.('setBonusMode', this.__bonusModeResetListener); } catch {}
    } catch {}

    try {
      if (this.__activateBonusModeResetListener) {
        try { this.scene?.events?.off?.('activateBonusMode', this.__activateBonusModeResetListener); } catch {}
      }
      this.__activateBonusModeResetListener = () => {
        try { this.stopRegisteredScatterSymbolsAnimations(); } catch {}
      };
      try { this.scene?.events?.on?.('activateBonusMode', this.__activateBonusModeResetListener); } catch {}
    } catch {}

    // Set up event listeners for wheel events
    this.setupWheelEventListeners();

    console.log('[ScatterAnimationManager] Initialized with containers, spinner and dialogs components');
  }

  public setConfig(config: Partial<ScatterAnimationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public async playScatterAnimation(): Promise<void> {

    if (this.isAnimating || !this.scene || !this.symbolsContainer) {
      console.warn('[ScatterAnimationManager] Cannot play animation - scene or symbols container not ready');
      return;
    }

    this.isAnimating = true;
    console.log('[ScatterAnimationManager] Starting scatter animation sequence');

    // Defer background music control to overlays/scenes to avoid overlap

    try {
      // Derive scatter index from current SpinData so downstream systems know the tier
      let scatterIndex = this.getFreeSpinIndexFromSpinData();
      if (scatterIndex < 0) {
        // Fallback: if we cannot derive from SpinData freeSpins, leave index at 0 and log
        scatterIndex = 0;
        console.warn('[ScatterAnimationManager] Could not derive scatter index from SpinData; defaulting to 0');
      }

      gameStateManager.isScatter = true;
      gameStateManager.scatterIndex = scatterIndex;

      try {
        if (!this.bonusEntryFreeSpinsOverride && fakeBonusAPI.isEnabled()) {
          try { await fakeBonusAPI.initializeBonusData(); } catch {}
          try { fakeBonusAPI.resetFreeSpinIndex(); } catch {}
          const fakeSpinData: any = fakeBonusAPI.getCurrentSpinData();
          const fsFake: any = fakeSpinData?.slot?.freespin || fakeSpinData?.slot?.freeSpin;
          const items = fsFake?.items;
          if (Array.isArray(items) && items.length > 0) {
            const v = Number(items[0]?.spinsLeft);
            if (isFinite(v) && v > 0) {
              this.bonusEntryFreeSpinsOverride = v;
            }
          }
        }
      } catch {}

      let requestedBonusVisualActivation = false;
      let requestedBonusTransitionFinish = false;
      let bonusTransitionListenersRegistered = false;
      let bonusModeActivated = false;
      let bonusTransitionFinished = false;
      let bonusLogicStarted = false;
      const registerBonusTransitionListeners = () => {
        if (bonusTransitionListenersRegistered) return;
        bonusTransitionListenersRegistered = true;
        this.scene?.events?.once('activateBonusMode', () => {
          bonusModeActivated = true;
          try { this.stopRegisteredScatterSymbolsAnimations(); } catch {}
        });

        this.scene?.events?.once('bonusTransitionComplete', () => {
          bonusTransitionFinished = true;
          try { this.resetAllSymbolsAndAnimations(); } catch {}
          try {
            if (!bonusLogicStarted) {
              bonusLogicStarted = true;
              this.showFreeSpinsDialog();
            }
          } catch {}
          try { this.scene?.events?.emit('dialogAnimationsComplete'); } catch {}
        });
      };

      // Step 1: Wait for player to see scatter symbols
      console.log('[ScatterAnimationManager] Waiting for player to see scatter symbols...');
      await this.delay(this.getTurboAdjustedDelay(this.config.scatterRevealDelay));

      // Step 2: Show the new free spin overlay (FreeSpin_TB) before entering bonus
      if (this.scatterWinOverlay) {
        console.log('[ScatterAnimationManager] Showing FreeSpinOverlay for scatter bonus');
        try {
          const gameScene = this.scene as any;
          const currentSpinData: SpinData | any = gameScene?.symbols?.currentSpinData;

          // Smoothly fade out reel background while overlay is visible
          try { gameScene?.symbols?.fadeOutReelBackground?.(400); } catch {}
          // Compute display free spins from backend freespin count (fallback to items.spinsLeft)
          let spinsToDisplay = 0;
          try {
            // If fake bonus debug is enabled, prefer the fake-response.json first batch spinsLeft.
            if (fakeBonusAPI.isEnabled()) {
              try { await fakeBonusAPI.initializeBonusData(); } catch {}
              try { fakeBonusAPI.resetFreeSpinIndex(); } catch {}
              const fakeSpinData: any = fakeBonusAPI.getCurrentSpinData();
              const fsFake: any = fakeSpinData?.slot?.freespin || fakeSpinData?.slot?.freeSpin;
              const items = fsFake?.items;
              if (Array.isArray(items) && items.length > 0) {
                const v = Number(items[0]?.spinsLeft);
                if (isFinite(v) && v > 0) {
                  spinsToDisplay = v;
                }
              }
            }
          } catch {}

          try {
            if (spinsToDisplay > 0) {
              this.bonusEntryFreeSpinsOverride = spinsToDisplay;
            }
          } catch {}

          try {
            if (spinsToDisplay > 0) {
              // already set
            } else {
              const fs: any = currentSpinData?.slot?.freespin || currentSpinData?.slot?.freeSpin;
              let maxSpinsLeft = 0;
              if (fs?.items && Array.isArray(fs.items) && fs.items.length > 0) {
                for (const it of fs.items) {
                  const v = Number((it as any)?.spinsLeft);
                  if (isFinite(v) && v > maxSpinsLeft) maxSpinsLeft = v;
                }
              }
              if (maxSpinsLeft > 0) {
                spinsToDisplay = maxSpinsLeft;
              } else if (typeof fs?.count === 'number' && isFinite(fs.count) && fs.count > 0) {
                spinsToDisplay = Number(fs.count) || 0;
              }
            }
          } catch {}
          await new Promise<void>((resolve) => {
            this.scatterWinOverlay.show(spinsToDisplay, async () => {
              console.log('[ScatterAnimationManager] FreeSpinOverlay shown');
              // Dim base symbols while overlay is up

              await this.disableSymbols();
              if (typeof this.scatterWinOverlay.waitUntilDismissed === 'function') {
                await this.scatterWinOverlay.waitUntilDismissed();
                console.log('[ScatterAnimationManager] FreeSpinOverlay dismissed by user');
              }

              try {
                const sceneAny: any = this.scene as any;
                registerBonusTransitionListeners();

                requestedBonusVisualActivation = true;
                requestedBonusTransitionFinish = true;

                (async () => {
                  console.log('[ScatterAnimationManager] Launching BubbleOverlayTransition for bonus entry');
                  try {
                    if (sceneAny.scene.isActive?.('BubbleOverlayTransition') || sceneAny.scene.isSleeping?.('BubbleOverlayTransition')) {
                      try { sceneAny.scene.stop('BubbleOverlayTransition'); } catch {}
                    }
                  } catch {}
                  try {
                    sceneAny.scene.launch('BubbleOverlayTransition', {
                      fromSceneKey: 'Game',
                      toSceneKey: 'Game',
                      stopFromScene: false,
                      toSceneEvent: 'activateBonusMode',
                      toSceneEventOnFinish: 'bonusTransitionComplete',
                      transitionPreset: 'bonusEnter',
                      timings: {
                        overlayAlpha: 1,
                        overlayInMs: 560,
                        overlayDelayMs: 1800,
                        spineInMs: 620,
                        switchProgress: 0.8,
                        overlayOutMs: 200,
                        finishOutMs: 800
                      },
                      spineOffsetX: 0,
                      spineOffsetY: -560
                    });
                    try { sceneAny.scene.bringToTop?.('BubbleOverlayTransition'); } catch {}
                    try {
                      sceneAny.time?.delayedCall?.(3000, () => {
                        if (!bonusTransitionFinished) {
                          try { sceneAny?.events?.emit?.('bonusTransitionComplete'); } catch {}
                        }
                      });
                    } catch {}
                  } catch {
                    try { sceneAny?.events?.emit?.('activateBonusMode'); } catch {}
                    try { sceneAny?.events?.emit?.('bonusTransitionComplete'); } catch {}
                  }
                })();
              } catch {}

              try {
                const sceneAny: any = this.scene as any;
                let hidden = false;
                const hideNow = () => {
                  if (hidden) return;
                  hidden = true;
                  try {
                    this.scatterWinOverlay.hide(300, () => {
                      console.log('[ScatterAnimationManager] FreeSpinOverlay hidden');
                    });
                  } catch {}
                };
                try { hideNow(); } catch {}
                try { sceneAny?.events?.once?.('activateBonusMode', hideNow as any); } catch {}
                try {
                  sceneAny.time?.delayedCall?.(500, () => {
                    try { hideNow(); } catch {}
                  });
                } catch {
                  try { setTimeout(() => { try { hideNow(); } catch {} }, 2500); } catch { try { hideNow(); } catch {} }
                }
              } catch {}

              try {
                const symbols = (this.scene as any)?.symbols;
                symbols?.fadeInReelBackground?.(400);
              } catch {}

              resolve();
            });
          });
        } catch (e) {
          console.warn('[ScatterAnimationManager] Error while showing FreeSpinOverlay:', e);
        }
      } else {
        console.warn('[ScatterAnimationManager] FreeSpinOverlay not available, proceeding directly to bonus');
      }

    try {
      registerBonusTransitionListeners();
      if (!requestedBonusVisualActivation) {
        try { (this.scene as any)?.events?.emit?.('activateBonusMode'); } catch {}
      }
      if (!requestedBonusTransitionFinish) {
        try { (this.scene as any)?.events?.emit?.('bonusTransitionComplete'); } catch {}
      }
    } catch (e) {
      console.error('[ScatterAnimationManager] Error while entering bonus after FreeSpinOverlay:', e);
    }

    console.log('[ScatterAnimationManager] Scatter bonus sequence completed, waiting for dialog animations to finish');

  } catch (error) {
    console.error('[ScatterAnimationManager] Error during scatter animation:', error);
  } finally {
    this.isAnimating = false;
  }
}

  private async disableSymbols(): Promise<void> {
    if (!this.symbolsContainer) return;

    console.log('[ScatterAnimationManager] Disabling symbols...');

    // Keep symbols visible behind the FreeSpinOverlay; just dim them so the scene doesn't "blink".
    try { this.scene?.tweens?.killTweensOf?.(this.symbolsContainer as any); } catch {}
    try {
      this.scene?.tweens?.add?.({
        targets: this.symbolsContainer,
        alpha: 1,
        duration: 140,
        ease: 'Cubic.easeOut'
      });
    } catch {
      try { this.symbolsContainer.setAlpha(1); } catch {}
    }

    // Ensure scatter symbols stop looping their win animation while overlay is displayed.
    try { this.stopRegisteredScatterSymbolsAnimations(); } catch {}
    try {
      for (const s of this.scatterSymbols) {
        if (!s || (s as any).destroyed) continue;
        try { this.scene?.tweens?.killTweensOf?.(s as any); } catch {}
        try { (s as any).setAlpha?.(1); } catch {}
      }
    } catch {}

    // Add a small delay to ensure the disable is visible
    await this.delay(50);

    console.log('[ScatterAnimationManager] Symbols disabled');
  }

  private resetRegisteredScatterSymbolsToIdle(): void {
    if (!this.scene) return;
    const spineKey = 'symbol_0_spine';

    let idleAnim = 'Symbol0_TB_idle';
    try {
      const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
      const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
      if (Array.isArray(anims) && anims.length > 0) {
        if (!anims.includes(idleAnim)) {
          const hit = 'Symbol0_TB_hit';
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

    for (const symbol of this.scatterSymbols) {
      if (!symbol || (symbol as any).destroyed) continue;
      try { this.scene.tweens.killTweensOf(symbol); } catch {}

      try {
        const bx = Number((symbol as any).__scatterBaseScaleX);
        const by = Number((symbol as any).__scatterBaseScaleY);
        if (isFinite(bx) && bx > 0 && isFinite(by) && by > 0) {
          try { symbol.setScale?.(bx, by); } catch {}
        }
      } catch {}

      try {
        if ((symbol as any).animationState && typeof (symbol as any).animationState.setAnimation === 'function') {
          (symbol as any).animationState.setAnimation(0, idleAnim, true);
        }
      } catch {}
    }
  }

  private stopRegisteredScatterSymbolsAnimations(): void {
    if (!this.scene) return;
    try { this.resetRegisteredScatterSymbolsToIdle(); } catch {}
    for (const symbol of this.scatterSymbols) {
      if (!symbol || (symbol as any).destroyed) continue;
      try { (symbol as any).setAlpha?.(1); } catch {}
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene!.time.delayedCall(ms, () => {
        resolve();
      });
    });
  }

  private triggerSpinnerRotation(): void {
    console.log('[ScatterAnimationManager] Triggering spinner rotation after 0.5s delay when spinner is in place');

    // First try to get the index from SpinData
    let scatterIndex = this.getFreeSpinIndexFromSpinData();

    if (scatterIndex >= 0) {
      // Use the index from SpinData
      console.log(`[ScatterAnimationManager] Using SpinData-based index: ${scatterIndex}`);
      const freeSpins = SCATTER_MULTIPLIERS[scatterIndex];
      console.log(`[ScatterAnimationManager] SpinData free spins: ${freeSpins}`);

      console.log(`[ScatterAnimationManager] Using SpinData values: freeSpins=${freeSpins}, scatterIndex=${scatterIndex}`);
    } else {
      // Fallback when SpinData is not available: use index 0 and log
      console.log('[ScatterAnimationManager] SpinData not available for spinner; defaulting scatterIndex to 0');
      scatterIndex = 0;
    }

    // Update the game state to reflect scatter mode
    gameStateManager.isScatter = true;
    gameStateManager.scatterIndex = scatterIndex;

    // Try to use SpinData-based spinner first, then fallback to index-based
    if (scatterIndex >= 0 && this.scene) {
      const gameScene = this.scene as any;
      if (gameScene.symbols && gameScene.symbols.currentSpinData &&
        this.spinnerComponent && typeof this.spinnerComponent.startScatterSpinnerFromSpinData === 'function') {
        // Use SpinData-based spinner
        this.spinnerComponent.startScatterSpinnerFromSpinData(gameScene.symbols.currentSpinData);
        console.log(`[ScatterAnimationManager] Spinner rotation triggered from SpinData with index ${scatterIndex}`);
      } else if (this.spinnerComponent && typeof this.spinnerComponent.startScatterSpinner === 'function') {
        // Fallback to index-based spinner using minimal payload
        this.spinnerComponent.startScatterSpinner({ scatterIndex }, scatterIndex);

        console.log(`[ScatterAnimationManager] Spinner rotation triggered with scatter index ${scatterIndex}`);
      } else {
        console.warn('[ScatterAnimationManager] Spinner component not available or missing required methods');
        gameEventManager.emit(GameEventType.WHEEL_SPIN_DONE);
      }
    } else if (this.spinnerComponent && typeof this.spinnerComponent.startScatterSpinner === 'function') {
      // Fallback to index-based spinner using minimal payload
      this.spinnerComponent.startScatterSpinner({ scatterIndex }, scatterIndex);

      console.log(`[ScatterAnimationManager] Spinner rotation triggered with scatter index ${scatterIndex}`);
    } else {
      console.warn('[ScatterAnimationManager] Spinner component not available or missing startScatterSpinner method');
      // Fallback to normal REELS_STOP event
      gameEventManager.emit(GameEventType.WHEEL_SPIN_DONE);
    }
  }

  /**
   * Get freeSpin value from SpinData and find its index in SCATTER_MULTIPLIERS
   */
  private getFreeSpinIndexFromSpinData(): number {
    // Try to get free spins from current SpinData
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols && gameScene.symbols.currentSpinData) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        const fs: any = currentSpinData?.slot?.freespin || currentSpinData?.slot?.freeSpin;
        if (fs) {
          const candidates: number[] = [];

          let maxSpinsLeft = 0;
          if (fs?.items && Array.isArray(fs.items) && fs.items.length > 0) {
            for (const it of fs.items) {
              const v = Number((it as any)?.spinsLeft);
              if (isFinite(v) && v > maxSpinsLeft) maxSpinsLeft = v;
            }
          }
          if (maxSpinsLeft > 0) {
            candidates.push(maxSpinsLeft);
          }

          const countNum = Number(fs?.count);
          if (isFinite(countNum) && countNum > 0) {
            candidates.push(countNum);
          }

          for (const c of candidates) {
            const idx = SCATTER_MULTIPLIERS.indexOf(c);
            if (idx >= 0) {
              console.log(`[ScatterAnimationManager] Derived scatter index ${idx} from free spins value ${c}`);
              return idx;
            }
          }

          const numeric = candidates[0] ?? 0;
          if (numeric > 0 && SCATTER_MULTIPLIERS.length > 0) {
            let bestIdx = 0;
            let bestDiff = Infinity;
            for (let i = 0; i < SCATTER_MULTIPLIERS.length; i++) {
              const diff = Math.abs(SCATTER_MULTIPLIERS[i] - numeric);
              if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
              }
            }
            console.log(`[ScatterAnimationManager] Free spins value ${numeric} not found in SCATTER_MULTIPLIERS; using closest index ${bestIdx} (${SCATTER_MULTIPLIERS[bestIdx]})`);
            return bestIdx;
          }
        }
      }
    }

    // SpinData not available - return -1 to indicate no scatter found
    console.log('[ScatterAnimationManager] SpinData not available, no scatter index found');
    return -1;
  }

  private showFreeSpinsDialog(): void {
    console.log('[ScatterAnimationManager] ===== SHOW FREE SPINS DIALOG CALLED =====');
    console.log('[ScatterAnimationManager] Dialogs component available:', !!this.dialogsComponent);

    try { gameStateManager.isBuyFeatureSpin = false; } catch {}

    if (!this.dialogsComponent) {
      console.warn('[ScatterAnimationManager] Dialogs component not available');
    }

    // Get free spins count from the current spinData
    let freeSpins = 0; // Default to 0, will be set from spinData

    try {
      if (this.bonusEntryFreeSpinsOverride && this.bonusEntryFreeSpinsOverride > 0) {
        freeSpins = this.bonusEntryFreeSpinsOverride;
        this.bonusEntryFreeSpinsOverride = null;
      }
    } catch {}

    // If we're running fake bonus debugging, prefer the fake-response.json first batch count.
    // This avoids showing the scatter-trigger SpinData count (often 10) as the bonus entry remaining.
    if (freeSpins <= 0) {
      try {
        if (fakeBonusAPI.isEnabled()) {
          try {
            // Best-effort init; FakeBonusAPI self-disables on load error.
            fakeBonusAPI.initializeBonusData();
          } catch {}
          try { fakeBonusAPI.resetFreeSpinIndex(); } catch {}
          const fakeSpinData: any = fakeBonusAPI.getCurrentSpinData();
          const fsFake: any = fakeSpinData?.slot?.freespin || fakeSpinData?.slot?.freeSpin;
          const items = fsFake?.items;
          if (Array.isArray(items) && items.length > 0) {
            const v = Number(items[0]?.spinsLeft);
            if (isFinite(v) && v > 0) {
              freeSpins = v;
            }
          }
        }
      } catch {}
    }

    // Get free spins from the current spinData directly from symbols
    if (freeSpins <= 0 && this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols && gameScene.symbols.currentSpinData) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        if (currentSpinData.slot) {

          // Handle both freespin and freeSpin property names
          const freespinData = currentSpinData.slot.freespin || currentSpinData.slot.freeSpin;
          if (freespinData) {
            let maxSpinsLeft = 0;
            if (freespinData?.items && Array.isArray(freespinData.items) && freespinData.items.length > 0) {
              for (const it of freespinData.items) {
                const v = Number((it as any)?.spinsLeft);
                if (isFinite(v) && v > maxSpinsLeft) maxSpinsLeft = v;
              }
            }

            if (maxSpinsLeft > 0) {
              freeSpins = maxSpinsLeft;
            } else if (typeof freespinData.count === 'number' && isFinite(freespinData.count) && freespinData.count > 0) {
              freeSpins = Number(freespinData.count) || 0;
            }
          } else {
            console.warn(`[ScatterAnimationManager] No free spin data in current spinData`);
          }
        } else {
          console.warn(`[ScatterAnimationManager] No slot data in current spinData`);
        }
      } else {
        console.warn(`[ScatterAnimationManager] Symbols or currentSpinData not available`);
      }
    }

    // If we couldn't get freeSpins from spinData, log error and use 0
    if (freeSpins === 0) {
      console.error(`[ScatterAnimationManager] Could not get freeSpins from current spinData - dialog will show 0`);
    }

    console.log(`[ScatterAnimationManager] Backend data state: freeSpins=${freeSpins}, scatterIndex=${this.getFreeSpinIndexFromSpinData()}`);

    // Update game state to reflect bonus mode
    console.log('[ScatterAnimationManager] Setting isBonus to true');
    gameStateManager.isBonus = true;
    console.log('[ScatterAnimationManager] isBonus is now:', gameStateManager.isBonus);

    // Do not force-dismiss overlays; bonus will continue after overlays end

    // Directly emit events and proceed to bonus without showing an intermediate dialog
    let scatterIndex = this.getFreeSpinIndexFromSpinData();
    try {
      if (freeSpins > 0) {
        const idx = SCATTER_MULTIPLIERS.indexOf(freeSpins);
        if (idx >= 0) {
          scatterIndex = idx;
        }
      }
    } catch {}
    gameEventManager.emit(GameEventType.IS_BONUS, {
      scatterCount: scatterIndex,
      bonusType: 'freeSpins'
    });

    if (this.scene) {
      const eventData = { scatterIndex, actualFreeSpins: freeSpins };

      console.log(`[ScatterAnimationManager] Emitting scatterBonusActivated event with data:`, eventData);
      this.scene.events.emit('scatterBonusActivated', eventData);
      console.log(`[ScatterAnimationManager] Emitted scatterBonusActivated event with index ${scatterIndex} and ${freeSpins} free spins`);
      // Ensure reel background is visible and reset tint for bonus start
      try {
        const symbols = (this.scene as any)?.symbols;
        symbols?.showReelBackground?.();
        symbols?.tweenReelBackgroundToDefaultTint?.(300);
      } catch {}
    }
  }

  public isAnimationInProgress(): boolean {
    return this.isAnimating;
  }

  /**
   * Set delayed scatter animation data (called when win dialogs need to show first)
   */
  public setDelayedScatterAnimation(data: any): void {
    console.log('[ScatterAnimationManager] Setting delayed scatter animation data');
    this.delayedScatterData = data;
  }

  public resetSymbolsVisibility(): void {
    if (this.symbolsContainer) {
      console.log('[ScatterAnimationManager] WARNING: resetSymbolsVisibility called - this should not happen during scatter bonus!');
      console.log('[ScatterAnimationManager] Stack trace:', new Error().stack);
      this.symbolsContainer.setAlpha(1);
    }
  }

  /**
   * Set up listener for when dialog animations complete
   */
  private setupDialogCompletionListener(): void {
    if (!this.scene) return;

    console.log('[ScatterAnimationManager] Setting up dialog completion listener...');

    // Listen for dialog completion event
    this.scene.events.once('dialogAnimationsComplete', () => {
      console.log('[ScatterAnimationManager] Dialog animations completed, resetting all symbols and animations');
      this.resetAllSymbolsAndAnimations();
    });

    // Also set up a fallback timer in case the event doesn't fire
    setTimeout(() => {
      console.log('[ScatterAnimationManager] Fallback timer triggered for symbol reset');
      this.resetAllSymbolsAndAnimations();
    }, 5000); // 5 second fallback
  }

  /**
   * Get the current free spins count from SpinData
   */
  private getCurrentFreeSpinsCount(): number {
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        if (currentSpinData && currentSpinData.slot) {
          const fs: any = currentSpinData.slot.freespin || currentSpinData.slot.freeSpin;
          if (fs) {
            let maxSpinsLeft = 0;
            if (fs?.items && Array.isArray(fs.items) && fs.items.length > 0) {
              for (const it of fs.items) {
                const v = Number((it as any)?.spinsLeft);
                if (isFinite(v) && v > maxSpinsLeft) maxSpinsLeft = v;
              }
            }
            if (maxSpinsLeft > 0) return maxSpinsLeft;
            const countNum = Number(fs?.count);
            if (isFinite(countNum) && countNum > 0) return countNum;
          }
        }
      }
    }
    // No SpinData available - return 0
    return 0;
  }

  private resetAllSymbolsAndAnimations(): void {
    // Stop any active background music only when we're not in active bonus mode.
    // During bonus/free spins, the Game scene manages bonus music and stopping it here causes abrupt cut-offs.
    try {
      if (!this.isInActiveBonusMode()) {
        const audioMgr = (window as any).audioManager;
        if (audioMgr && typeof audioMgr.stopCurrentMusic === 'function') {
          audioMgr.stopCurrentMusic();
          console.log('[ScatterAnimationManager] Stopped current background music to defer control to overlay');
        }
      }
    } catch {}

    // Reset game state - but don't reset isBonus if we're in an active bonus mode
    try { gameStateManager.isScatter = false; } catch {}
    try {
      if (!this.isInActiveBonusMode()) {
        console.log('[ScatterAnimationManager] Not in active bonus mode, resetting isBonus to false');
        gameStateManager.isBonus = false;
      } else {
        console.log('[ScatterAnimationManager] In active bonus mode, keeping isBonus as true');
      }
    } catch {}
    try { gameStateManager.scatterIndex = 0; } catch {}

    // Reset symbols container visibility
    try {
      if (this.symbolsContainer) {
        this.symbolsContainer.setAlpha(1);
        this.symbolsContainer.setVisible(true);
        console.log('[ScatterAnimationManager] Symbols container reset to visible with alpha 1');
      }
    } catch {}

    // Re-enable scatter symbols
    try {
      if (this.isInActiveBonusMode()) {
        this.stopRegisteredScatterSymbolsAnimations();
      } else {
        this.resetRegisteredScatterSymbolsToIdle();
      }
    } catch {}
    try {
      for (const s of this.scatterSymbols) {
        if (!s || (s as any).destroyed) continue;
        try { (s as any).setAlpha?.(1); } catch {}
      }
    } catch {}
    try { this.showScatterSymbols(); } catch {}

    // Hide spinner container and kill its tweens
    try {
      if (this.spinnerContainer) {
        this.spinnerContainer.setVisible(false);
        console.log('[ScatterAnimationManager] Spinner container hidden');
        this.scene?.tweens.killTweensOf(this.spinnerContainer);
        console.log('[ScatterAnimationManager] Spinner tweens killed');
      }
    } catch {}

    // Hide overlay if shown
    try { this.overlayComponent?.hide?.(300); } catch {}

    // Kill any active tweens on the symbols container
    try {
      if (this.symbolsContainer) {
        this.scene?.tweens.killTweensOf(this.symbolsContainer);
        console.log('[ScatterAnimationManager] Symbols container tweens killed');
      }
    } catch {}

    // Notify Symbols to restore visibility and layering
    try {
      if (this.scene) {
        this.scene.events.emit('scatterBonusCompleted');
        console.log('[ScatterAnimationManager] Emitted scatterBonusCompleted event');
      }
    } catch {}

    console.log('[ScatterAnimationManager] All symbols and animations reset successfully');
  }

  /**
   * Check if we're currently in an active bonus mode (free spins)
   */
  private isInActiveBonusMode(): boolean {
    // Use SpinData freespin count
    const hasFreeSpins = this.getCurrentFreeSpinsCount() > 0;
    const isBonusMode = gameStateManager.isBonus;

    console.log(`[ScatterAnimationManager] Checking bonus mode: hasFreeSpins=${hasFreeSpins}, isBonus=${isBonusMode}`);

    return hasFreeSpins || isBonusMode;
  }

  private hideScatterSymbols(): void {
    if (!this.scene) return;

    console.log('[ScatterAnimationManager] Hiding scatter symbols...');
    
    // Hide all registered scatter symbols
    this.scatterSymbols.forEach(symbol => {
      if (symbol && !symbol.destroyed) {
        symbol.setVisible(false);
        console.log('[ScatterAnimationManager] Hidden scatter symbol');
      }
    });
    
    console.log(`[ScatterAnimationManager] Hidden ${this.scatterSymbols.length} scatter symbols`);
  }

  private showScatterSymbols(): void {
    if (!this.scene) return;

    console.log('[ScatterAnimationManager] Showing scatter symbols...');
    
    // Show all registered scatter symbols
    this.scatterSymbols.forEach(symbol => {
      if (symbol && !symbol.destroyed) {
        symbol.setVisible(true);
        console.log('[ScatterAnimationManager] Shown scatter symbol');
      }
    });
    
    console.log(`[ScatterAnimationManager] Shown ${this.scatterSymbols.length} scatter symbols`);
  }

  /**
   * Register a scatter symbol for management
   */
  public registerScatterSymbol(symbol: any): void {
    if (symbol && !this.scatterSymbols.includes(symbol)) {
      this.scatterSymbols.push(symbol);
      console.log('[ScatterAnimationManager] Registered scatter symbol');
    }
  }

  /**
   * Unregister a scatter symbol from management
   */
  public unregisterScatterSymbol(symbol: any): void {
    const index = this.scatterSymbols.indexOf(symbol);
    if (index !== -1) {
      this.scatterSymbols.splice(index, 1);
      console.log('[ScatterAnimationManager] Unregistered scatter symbol');
    }
  }

  /**
   * Clear all registered scatter symbols
   */
  public clearScatterSymbols(): void {
    this.scatterSymbols = [];
    console.log('[ScatterAnimationManager] Cleared all scatter symbol references');
  }

  public getRegisteredScatterSymbols(): any[] {
    return [...this.scatterSymbols];
  }

  public destroy(): void {
    
    this.scene = null;
    this.symbolsContainer = null;
    this.spinnerContainer = null;
    this.spinnerComponent = null;
    this.isAnimating = false;
    console.log('[ScatterAnimationManager] Destroyed');
  }
} 