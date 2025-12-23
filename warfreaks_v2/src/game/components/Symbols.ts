import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import {
  SLOT_ROWS,
  SLOT_COLUMNS,
  DELAY_BETWEEN_SPINS,
  WILDCARD_SYMBOLS,
  AUTO_SPIN_START_DELAY,
  SCATTER_MULTIPLIERS,
  AUTO_SPIN_WIN_DIALOG_TIMEOUT,
} from '../../config/GameConfig';
import { AudioManager, SoundEffectType } from '../../managers/AudioManager';
import { Dialogs } from "./Dialogs";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { hideSpineAttachmentsByKeywords } from "./SpineBehaviorHelper";
import { NumberDisplay, NumberDisplayConfig } from "./NumberDisplay";
import { SpinData, SpinDataUtils } from "../../backend/SpinData";

// Debug flags for verbose tumble logging / diagnostics
const DEBUG_SYMBOLS_TUMBLES = false;

export class Symbols {
  private static readonly WINLINE_CHECKING_DISABLED: boolean = true;

  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  public displayWidth: number;
  public displayHeight: number;
  public horizontalSpacing: number;
  public verticalSpacing: number;
  public symbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public newSymbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public slotX: number;
  public slotY: number;
  public totalGridWidth: number;
  public totalGridHeight: number;
  public scatterAnimationManager: ScatterAnimationManager;
  public symbolDetector: SymbolDetector;
  private overlayRect?: Phaser.GameObjects.Graphics;
  public currentSpinData: any = null; // Store current spin data for access by other components
  private dialogs: Dialogs;
  public dropSparkPlayedColumns: Set<number> = new Set();
  public sparkVFXPool: SpineGameObject[] = [];
  public symbolSpritePool: GameObjects.Sprite[] = [];
  public spinePools: { [key: string]: SpineGameObject[] } = {};
  public scatterTransposedBuffer: number[][] = [];
  public scatterDataBuffer: Data | null = null;
  public winEvalRowMajorBuffer: number[][] = [];
  public winEvalDataBuffer: Data | null = null;
  public tumbleRemoveMask: boolean[][] = [];
  public readonly baseSymbolWidth: number = 69;
  public readonly baseSymbolHeight: number = 69;

  public gridOffsetX: number = 0;
  public gridOffsetY: number = -55;
  public baseCenterX: number = 0;
  public baseCenterY: number = 0;

  public cachedTotalWin: number = 0;
  public cachedPreBonusWins: number = 0;

  private symbolWinTimeScales: { [key: number]: number } = {
    0: 1.5,
    1: 1.41,
    2: 1.41,
    3: 1.41,
    4: 1.41,
    5: 1.41,
    6: 1.75,
    7: 1.75,
    8: 1.75,
    9: 1.75,
    10: 1,
  }

  private spineSymbolOrigins: { [key: number]: { x: number, y: number } } =
    {
      0: { x: 0.482, y: 0.55 },
      1: { x: 0.5, y: 0.5 },
      2: { x: 0.5, y: 0.5 },
      3: { x: 0.5, y: 0.5 },
      4: { x: 0.5, y: 0.5 },
      5: { x: 0.5, y: 0.5 },
      6: { x: 0.5, y: 0.505 },
      7: { x: 0.5, y: 0.505 },
      8: { x: 0.5, y: 0.505 },
      9: { x: 0.5, y: 0.505 },
      10: { x: 0.505, y: 0.3475 },
    }

  // Configuration for Spine symbol scales - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0: 0.275,   // Symbol0_KA scale (scatter)
    1: 0.2725,  // Symbol1_KA scale (HP)
    2: 0.2725,  // Symbol2_KA scale (HP)
    3: 0.2725,  // Symbol3_KA scale (HP)
    4: 0.2725,  // Symbol4_KA scale (HP)
    5: 0.2725,  // Symbol5_KA scale (HP)
    6: 0.2925,  // Symbol6_KA scale (LP)
    7: 0.2925,  // Symbol7_KA scale (LP)
    8: 0.2925,  // Symbol8_KA scale (LP)
    9: 0.2925,  // Symbol9_KA scale (LP)
    10: 0.2725,  // Symbol10_KA scale (multiplier)
  };

  public multiplierIndexMapping: { [key: number]: number } = {
    11: 2,
    12: 3,
    13: 4,
    14: 5,
    15: 6,
    16: 8,
    17: 10,
    18: 12,
    19: 15,
    20: 20,
    21: 25,
    22: 50,
    23: 100,
    24: 250,
    25: 500,
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
  private freeSpinAutoplayTriggered: boolean = false;
  public currentFreeSpinIndex: number = -1;
  private dialogListenerSetup: boolean = false;

  constructor() {
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  public create(scene: Game) {
    this.scene = scene;
    initVariables(this);
    createContainer(this);
    prewarmSymbolSpinePools(this);
    prewarmSparkSpinePool(this);
    prewarmMultiplierSpinePools(this);
    onStart(this);
    onSpinDataReceived(this);
    this.onSpinDone(this.scene);
    this.setupDialogEventListeners();
    this.setupSpinEventListener(); // Re-enabled to clean up symbols at spin start


    // Listen for a full free spin reset request (after congrats/bonus end)
    this.scene.events.on('resetFreeSpinState', () => {
      console.log('[Symbols] resetFreeSpinState received - clearing free spin autoplay state');
      if (this.freeSpinAutoplayTimer) {
        this.freeSpinAutoplayTimer.destroy();
        this.freeSpinAutoplayTimer = null;
      }
      this.freeSpinAutoplayActive = false;
      this.freeSpinAutoplaySpinsRemaining = 0;
      this.currentFreeSpinIndex = -1;
      this.freeSpinAutoplayWaitingForReelsStop = false;
      this.freeSpinAutoplayWaitingForWinlines = false;
      this.freeSpinAutoplayTriggered = false;
      this.dialogListenerSetup = false;
    });
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

      // Check if scatter animation is in progress before proceeding
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] WARNING: SPIN event received during scatter bonus - this should not happen!');
        console.log('[Symbols] Stack trace:', new Error().stack);
        return;
      }

      this.ensureCleanSymbolState();

      // Win line checking/clearing disabled
      // Hide winning overlay when spin starts
      this.hideWinningOverlay();
      // Reset depths and visibility in a single grid pass for new spin
      this.resetDepthsAndVisibilityForNewSpin();
    });

    // WIN_START/WIN_STOP disabled

    // Listen for win dialog close
    gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
      console.log('[Symbols] WIN_DIALOG_CLOSED event received');
      // Reset dialog showing flag
      gameStateManager.isShowingWinDialog = false;

      // If bonus just finished, simply clear the flag here. The actual
      // Congratulations dialog is now scheduled centrally via the free spin
      // autoplay stop flow (stopFreeSpinAutoplay → scheduleCongratsDialogAfterAutoplay)
      // to avoid double-triggering from multiple listeners.
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] isBonusFinished is true on WIN_DIALOG_CLOSED - congrats handled by autoplay stop; clearing isBonusFinished flag only');
        gameStateManager.isBonusFinished = false;
      }
    });

  }

  /**
   * Ensure symbols are in a clean state before spin animation (no conversion back to PNG)
   */
  public ensureCleanSymbolState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    console.log('[Symbols] Ensuring clean symbol state for spin (no PNG reversion)');
    let spineTracksCleared = 0;

    // Stop any Spine tracks but keep objects intact (no conversion to PNG)
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];

        if (symbol && symbol.animationState) {
          try {
            if (symbol.animationState.clearTracks) {
              symbol.animationState.clearTracks();
              spineTracksCleared++;
            }
          } catch { }
        }
      }
    }

    if (spineTracksCleared > 0) {
      console.log(`[Symbols] Cleared tracks on ${spineTracksCleared} Spine symbols for spin`);
    }
  }

  /**
   * Start dropping/clearing existing symbols as soon as a new spin is triggered.
   * This is intentionally decoupled from `dropReels` so the clear phase can
   * begin immediately at spin start (manual or autoplay), before new reels drop.
   */
  public startPreSpinDrop(): void {
    if (!this.symbols || this.symbols.length === 0) {
      console.log('[Symbols] startPreSpinDrop: no symbols to drop');
      return;
    }

    const firstCol = this.symbols[0];
    const numRows = Array.isArray(firstCol) ? firstCol.length : 0;
    if (numRows === 0) {
      console.log('[Symbols] startPreSpinDrop: symbol grid has zero rows');
      return;
    }

    // Ensure GameData timings are initialized before the very first drop.
    // This mirrors the logic in processSpinDataSymbols so the first pre-spin
    // drop does not use the tiny constructor defaults (which look "too fast").
    const gameData = this.scene?.gameData as GameData;
    let isTurbo = false;
    let rowDelay = 0;
    if (gameData) {
      const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
      const adjustedDelay = gameStateManager.isTurbo
        ? baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER
        : baseDelay;
      setSpeed(gameData, adjustedDelay);
      isTurbo = !!gameData.isTurbo;
      rowDelay = typeof (gameData as any).dropReelsDelay === 'number'
        ? (gameData as any).dropReelsDelay
        : 0;
    }

    const extendLastReelDrop = false;

    console.log('[Symbols] Starting pre-spin drop of existing symbols', {
      numRows,
      isTurbo,
      rowDelay,
    });

    // Reverse the sequence: start from bottom row to top row
    for (let step = 0; step < numRows; step++) {
      const actualRow = (numRows - 1) - step;
      const isLastReel = actualRow === 0;
      const startDelay = isTurbo ? 0 : rowDelay * step;

      this.scene.time.delayedCall(startDelay, () => {
        console.log(`[Symbols] Pre-spin dropping row ${actualRow}/${numRows - 1}`);
        try {
          dropPrevSymbols(this, actualRow, isLastReel && extendLastReelDrop);
        } catch (e) {
          console.warn('[Symbols] Error during pre-spin drop for row', actualRow, e);
        }
      });
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
    });
  }

  private setupDialogEventListeners() {
    console.log('[Symbols] Setting up dialog event listeners');
    // Listen for dialog events to re-enable symbols
    this.scene.events.on('enableSymbols', () => {
      console.log('[Symbols] Re-enabling symbols after dialog transition');

      // Make sure symbols container is visible and interactive
      if (this.container) {
        this.container.setAlpha(1);
        this.container.setVisible(true);
        console.log('[Symbols] Symbols container re-enabled and visible');
      }

      // Reset any symbol tints/effects that might be active
      this.resetSymbolsState();
    });

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
    });

    // Listen for scatter bonus completion to restore symbol visibility
    this.scene.events.on('scatterBonusCompleted', () => {
      console.log('[Symbols] Scatter bonus completed event received - restoring symbol visibility');

      // First stop all Spine animations immediately
      this.stopAllSpineAnimations();

      // Then stop all other animations and convert Spine symbols back to PNG
      this.stopAllSymbolAnimations();

      // Restore all symbols to visible state
      this.restoreSymbolVisibility();

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
          // Add 1000ms delay AFTER the transition completes
          this.scene.time.delayedCall(AUTO_SPIN_START_DELAY, () => {
            console.log('[Symbols] Additional 1000ms delay completed - now triggering autoplay for free spins');
            this.triggerAutoplayForFreeSpins();
          });
        });
      } else {
        console.log('[Symbols] Dialog animations complete listener already set up, skipping duplicate setup');
      }

      console.log('[Symbols] Symbol visibility restored after scatter bonus completion');
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

    // Listen for win stop to schedule the next free spin after winlines finish
    gameEventManager.on(GameEventType.WIN_STOP, () => {
      if (!this.freeSpinAutoplayActive) {
        return;
      }
      this.handleFreeSpinAutoplayWinStop();
    });
  }

  /**
   * Get the configured scale for a specific symbol's Spine animation
   */
  public getSpineSymbolScale(symbolValue: number): number {
    // clamp the value of symbolValue to the max value of spineSymbolScales
    symbolValue = Math.min(symbolValue, Object.keys(this.spineSymbolScales).length - 1);

    return this.spineSymbolScales[symbolValue] || 1; // Default scale if not configured
  }

  /**
   * Get the configured origin for a specific symbol's Spine animation
   */
  public getSpineSymbolOrigin(symbolValue: number): { x: number, y: number } {
    symbolValue = Math.min(symbolValue, Object.keys(this.spineSymbolOrigins).length - 1);

    return this.spineSymbolOrigins[symbolValue] || { x: 0.5, y: 0.5 }; // Default origin if not configured
  }

  public showFreeSpinDialog(freeSpinsCount: number): void {
    // Show Free Spin dialog immediately after scatter hit
    // try {
    //   const gameScene: any = this.scene as any;
    //   const dialogs = gameScene?.dialogs;
    //   if (dialogs && typeof dialogs.showFreeSpinDialog === 'function') {
    //     console.log(`[Symbols] Showing Free Spin dialog with ${freeSpinsCount} free spins`);
    //     dialogs.showFreeSpinDialog(this.scene, { freeSpins: freeSpinsCount });

    //     gameStateManager.isShowingWinDialog = true;
    //   } else {
    //     console.warn('[Symbols] Dialogs component not available to show Free Spin dialog');
    //   }
    // } catch (e) {
    //   console.warn('[Symbols] Failed to show Free Spin dialog:', e);
    // }
  }

  /**
   * Restore symbol visibility for new spin
   */
  public restoreSymbolVisibility(): void {
    console.log('[Symbols] Restoring symbol visibility for new spin');

    // Reset container alpha
    if (this.container) {
      this.container.setAlpha(1);
      console.log('[Symbols] Container alpha reset to 1');
    }

    // Reset visibility of any symbols that might have been hidden
    if (this.symbols && this.symbols.length > 0) {
      let resetCount = 0;
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (!symbol) continue;

          // Default: show symbol
          if (typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            visibleCount++;
          }
          resetCount++;


        }
      }
      console.log(`[Symbols] Restored visibility for ${resetCount} symbols, set ${visibleCount} to visible`);

      // Also log the current state of the container
      if (this.container) {
        console.log(`[Symbols] Container alpha after restore: ${this.container.alpha}, visible: ${this.container.visible}`);
      }

      // Log the state of any scatter symbols specifically
      this.logScatterSymbolsState();
    }
  }

  /**
   * Log the current state of scatter symbols for debugging
   */
  private logScatterSymbolsState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let scatterCount = 0;
    let visibleScatterCount = 0;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
          scatterCount++;
          if (symbol.visible) {
            visibleScatterCount++;
          }
          console.log(`[Symbols] Scatter symbol at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}, inContainer=${symbol.parentContainer === this.container}`);
        }
      }
    }

    console.log(`[Symbols] Scatter symbols state: ${visibleScatterCount}/${scatterCount} visible`);
  }

  /**
   * Stop all Spine animations on symbols (without converting them)
   */
  public stopAllSpineAnimations(): void {
    console.log('[Symbols] Stopping all Spine animations on symbols...');

    if (this.symbols && this.symbols.length > 0) {
      let spineAnimationsStopped = 0;

      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.animationState) {
            try {
              if (symbol.animationState.clearTracks) {
                symbol.animationState.clearTracks();
                spineAnimationsStopped++;
                console.log(`[Symbols] Stopped Spine animation at (${row}, ${col})`);
              }
            } catch (error) {
              console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
            }
          }
        }
      }

      console.log(`[Symbols] Stopped ${spineAnimationsStopped} Spine animations`);
    }
  }

  /**
   * Stop all active animations on symbols (no conversion back to PNG)
   */
  public stopAllSymbolAnimations(): void {
    console.log('[Symbols] Stopping all active symbol animations (no PNG reversion)...');

    if (this.symbols && this.symbols.length > 0) {
      let animationsStopped = 0;
      let spineTracksCleared = 0;

      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol) {
            // Kill any active tweens on this symbol
            this.scene.tweens.killTweensOf(symbol);
            animationsStopped++;

            // If this is a Spine animation, just stop tracks; do not convert
            if (symbol.animationState) {
              // Stop the Spine animation immediately
              try {
                if (symbol.animationState.clearTracks) {
                  symbol.animationState.clearTracks();
                  spineTracksCleared++;
                }
              } catch (error) {
                console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
              }
            }
          }
        }
      }

      console.log(`[Symbols] Stopped animations on ${animationsStopped} symbols, cleared tracks on ${spineTracksCleared} Spine symbols`);
    }

    // Also kill any tweens on the container
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      console.log('[Symbols] Container tweens killed');
    }
  }

  /**
   * Specifically ensure scatter symbols are visible
   */
  public ensureScatterSymbolsVisible(): void {
    console.log('[Symbols] Specifically ensuring scatter symbols are visible');

    if (this.symbols && this.symbols.length > 0) {
      let scatterFound = 0;
      let scatterMadeVisible = 0;

      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
            scatterFound++;

            if (typeof symbol.setVisible === 'function') {
              symbol.setVisible(true);
              scatterMadeVisible++;
              console.log(`[Symbols] Made scatter symbol visible at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}`);
            }
          }
        }
      }

      console.log(`[Symbols] Found ${scatterFound} scatter symbols, made ${scatterMadeVisible} visible`);

      // Log the state after making them visible
      if (scatterFound > 0) {
        console.log('[Symbols] Scatter symbols state after ensuring visibility:');
        this.logScatterSymbolsState();
      }
    }
  }

  /**
   * Force all symbols to be visible (for debugging and recovery)
   */
  public forceAllSymbolsVisible(): void {
    console.log('[Symbols] Force setting all symbols to visible');

    if (this.symbols && this.symbols.length > 0) {
      let forceVisibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            forceVisibleCount++;
          }
        }
      }
      console.log(`[Symbols] Force set ${forceVisibleCount} symbols to visible`);
    }

    // Also ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container forced to visible with alpha 1');
    }
  }

  /**
   * Reset any Spine symbols back to PNG sprites (called when spin button is clicked)
   */
  public resetSpineSymbolsToPNG(): void {
    if (!this.symbols || this.symbols.length === 0) {
      console.warn('[Symbols] Cannot reset: symbols array is empty or null');
      return;
    }

    if (!this.currentSymbolData) {
      console.warn('[Symbols] Cannot reset: currentSymbolData is null');
      return;
    }

    console.log('[Symbols] Resetting Spine symbols back to PNG sprites');
    console.log('[Symbols] Current symbol data:', this.currentSymbolData);

    let spineCount = 0;
    let pngCount = 0;
    let resetCount = 0;

    // First, let's see what we have before cleanup
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
          if (symbol.animationState) {
            spineCount++;
            console.log(`[Symbols] Found Spine symbol at (${col}, ${row}): ${symbol.constructor.name}`);
          } else {
            pngCount++;
            console.log(`[Symbols] Found PNG symbol at (${col}, ${row}): ${symbol.texture?.key || 'unknown'}`);
          }
        } else {
          console.log(`[Symbols] Empty slot at (${col}, ${row})`);
        }
      }
    }

    console.log(`[Symbols] Before cleanup: ${spineCount} Spine symbols, ${pngCount} PNG symbols`);

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];

        // Check if this is a Spine object (has animationState property)
        if (symbol && symbol.animationState) {
          console.log(`[Symbols] Processing Spine symbol at (${col}, ${row})`);

          try {
            // Get the original symbol value from stored data
            const symbolValue = this.currentSymbolData[col][row];
            console.log(`[Symbols] Symbol value for (${col}, ${row}): ${symbolValue}`);

            if (symbolValue !== undefined) {

              // Store original position and dimensions
              const x = symbol.x;
              const y = symbol.y;
              console.log(`[Symbols] Position: (${x}, ${y}), Size: ${this.displayWidth}x${this.displayHeight}`);

              // Destroy or pool the Spine object
              try {
                if ((symbol as any).__spinePoolKey) {
                  // Pooled Spine instance – return it to the pool for reuse
                  releaseSpineToPool(this, symbol as any);
                } else {
                  // Non‑pooled Spine instance – destroy normally
                  symbol.destroy();
                }
              } catch (poolError) {
                console.warn('[Symbols] Failed to pool Spine symbol, destroying instead:', poolError);
                try { symbol.destroy(); } catch { }
              }

              // Create PNG sprite in its place
              const spriteKey = 'symbol_' + symbolValue;
              console.log(`[Symbols] Creating PNG sprite with key: ${spriteKey}`);

              // Check if the sprite texture exists
              if (!this.scene.textures.exists(spriteKey)) {
                console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist!`);
                console.log('[Symbols] Available textures:', this.scene.textures.getTextureKeys().filter(key => key.includes('symbol')));
                continue;
              }

              const pngSprite = this.scene.add.sprite(x, y, spriteKey);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;

              // Add to container and update reference
              this.container.add(pngSprite);
              this.symbols[col][row] = pngSprite;

              resetCount++;
              console.log(`[Symbols] Successfully reset Spine symbol back to PNG: ${spriteKey} at (${col}, ${row})`);
            } else {
              console.warn(`[Symbols] Symbol value is undefined for (${col}, ${row})`);
            }
          } catch (error) {
            console.error(`[Symbols] Failed to reset Spine symbol at (${col}, ${row}):`, error);
          }
        }
      }
    }

    console.log(`[Symbols] Reset complete: Found ${spineCount} Spine symbols, successfully reset ${resetCount}`);
  }

  public resetSymbolsState() {
    // Reset any active symbol animations or tints
    if (this.symbols && this.symbols.length > 0) {
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];

          if (symbol && symbol.active) {
            // Check if symbol has the required methods before calling them
            if (typeof symbol.clearTint === 'function') {
              symbol.clearTint();
            }
            if (typeof symbol.setBlendMode === 'function') {
              symbol.setBlendMode(Phaser.BlendModes.NORMAL);
            }
            if (typeof symbol.setAlpha === 'function') {
              symbol.setAlpha(1);
            }

            // Stop any active tweens on this symbol
            //this.scene.tweens.killTweensOf(symbol);
          }
        }
      }
      console.log('[Symbols] Reset symbols state - cleared tints and stopped animations');
    }
  }

  /**
   * Manually trigger win line drawing (for testing)
   */
  public showWinLines(data: Data): void {
    // No-op: WinLineDrawer removed
  }

  /**
   * Clear win lines and stop looping
   */
  public clearWinLines(): void {
    // No-op: WinLineDrawer removed
  }



  /**
   * Check if there are currently visible wins (win lines or overlay)
   */
  public hasCurrentWins(): boolean {
    // Check if win line drawer has active lines
    // const hasWinLines = this.winLineDrawer && this.winLineDrawer.hasActiveLines();

    // Check if black overlay is visible
    const hasOverlay = this.overlayRect && this.overlayRect.visible;

    // return hasWinLines || (hasOverlay ?? false);
    return (hasOverlay ?? false);
  }

  /**
   * Create semi-transparent rectangle overlay above symbols
   */
  private createOverlayRect(): void {
    if (this.overlayRect) {
      this.overlayRect.destroy();
    }

    // Create overlay graphics
    this.overlayRect = this.scene.add.graphics();

    // Set semi-transparent black fill
    this.overlayRect.fillStyle(0x000000, 0.7);

    // Fill rectangle covering the symbol grid area
    const gridBounds = this.getSymbolGridBounds();
    this.overlayRect.fillRect(
      gridBounds.x,
      gridBounds.y,
      gridBounds.width,
      gridBounds.height
    );

    // Set depth to be above symbols but below winning symbols
    this.overlayRect.setDepth(500);

    // Hide by default
    this.overlayRect.setVisible(false);

    console.log('[Symbols] Semi-transparent overlay rectangle created (hidden by default)');
  }

  /**
   * Show overlay for winning patterns with fade in animation
   */
  public showWinningOverlay(): void {
    if (!this.overlayRect) {
      this.createOverlayRect();
    }
    if (this.overlayRect) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);

      // If already visible, ensure full opacity and avoid re-tweening to prevent flicker
      if (this.overlayRect.visible && this.overlayRect.alpha >= 1) {
        this.overlayRect.setAlpha(1);
        console.log('[Symbols] Winning overlay already visible - ensuring alpha 1');
        return;
      }

      // Set initial state for fade in
      this.overlayRect.setVisible(true);
      this.overlayRect.setAlpha(0);

      // Animate fade in
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 1,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => {
          console.log('[Symbols] Winning overlay fade in completed');
        }
      });
    }
    console.log('[Symbols] Winning overlay fade in started');
  }

  /**
   * Hide the overlay with fade out animation
   */
  public hideWinningOverlay(): void {
    if (this.overlayRect && this.overlayRect.visible) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);

      // Animate fade out
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 0,
        duration: 200,
        ease: 'Power2.easeIn',
        onComplete: () => {
          if (this.overlayRect) {
            this.overlayRect.setVisible(false);
          }
          console.log('[Symbols] Winning overlay fade out completed');
        }
      });
      console.log('[Symbols] Winning overlay fade out started');
    }
  }


  /**
   * Move winning symbols to appear in front of the overlay
   */
  public moveSymbolToFront(symbol: any): void {
    if (!symbol) return;

    this.container.remove(symbol);
    this.scene.add.existing(symbol);

    if (typeof symbol.setDepth === 'function') {
      symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
    }
  }

  /**
   * Reset all symbol depths to default and move them back to container
   */
  public resetSymbolDepths(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let resetCount = 0;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
          // Move symbol back to container if it's not already there
          if (symbol.parentContainer !== this.container) {
            this.scene.children.remove(symbol);
            this.container.add(symbol);
          }
          if (typeof symbol.setDepth === 'function') {
            symbol.setDepth(0); // Reset to default depth
          }
          resetCount++;
        }
      }
    }
    console.log(`[Symbols] Reset depths and container for ${resetCount} symbols`);
  }

  /**
   * Reset depths and visibility for all symbols in a single grid pass.
   * Used at spin start / new spin data to avoid multiple full-grid walks.
   */
  public resetDepthsAndVisibilityForNewSpin(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    // Ensure container is fully visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
    }

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (!symbol) continue;

        // Move symbol back to container if it's not already there
        if (symbol.parentContainer !== this.container) {
          try { this.scene.children.remove(symbol); } catch { }
          try { this.container?.add(symbol); } catch { }
        }

        // Reset depth
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(0);
        }

        // Ensure visible for new spin
        if (typeof symbol.setVisible === 'function') {
          symbol.setVisible(true);
        }
      }
    }
  }

  /**
   * Move scatter symbols to front (above overlay) - similar to winning symbols
   */
  public moveScatterSymbolsToFront(data: Data, scatterGrids: any[]): void {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to move to front');
      return;
    }

    console.log(`[Symbols] Moving ${scatterGrids.length} scatter symbols to front`);

    // Set depth of scatter symbols to be above the overlay
    let movedCount = 0;
    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving scatter symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);

        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);

        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        console.log(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${scatterGrids.length} scatter symbols to front`);
  }

  /**
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(mockData: any): void {
    console.log('[Symbols] Starting scatter animation sequence');

    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    this.stopAllSymbolAnimations();
    // this.hideAllSymbols();
    this.hideWinningOverlay();

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
      this.scatterAnimationManager.playScatterAnimation(mockData);
    } else {
      console.warn('[Symbols] ScatterAnimationManager not available');
    }
  }

  /**
   * Handle scatter retriggers that occur while bonus mode/free spins are already active.
   * Shows a short Bonus Free Spin dialog, auto-closes it, then resumes the free spin flow.
   */
  public async handleBonusScatterRetrigger(mockData: any, scatterGrids: any[], spinData: any): Promise<void> {
    console.log('[Symbols] Handling bonus-mode scatter retrigger');

    // For retriggers, award a fixed number of extra free spins configured in GameData
    const awardedFreeSpins = this.scene.gameData?.bonusRetriggerFreeSpins ?? 5;
    console.log(`[Symbols] Bonus scatter retrigger - awarding ${awardedFreeSpins} extra free spins from GameData`);

    // If our free spin autoplay system is active, extend the remaining count
    if (this.freeSpinAutoplayActive && awardedFreeSpins > 0) {
      const before = this.freeSpinAutoplaySpinsRemaining;
      this.freeSpinAutoplaySpinsRemaining += awardedFreeSpins;
      console.log(`[Symbols] Extended free spin autoplay remaining: ${before} -> ${this.freeSpinAutoplaySpinsRemaining}`);
    } else {
      console.log('[Symbols] Free spin autoplay not active when retrigger hit - no remaining counter to extend');
    }

    const scatterIndex = this.getScatterIndexForRetrigger(scatterGrids.length, awardedFreeSpins);
    const dialogs = (this.scene as any)?.dialogs as Dialogs | undefined;

    if (awardedFreeSpins > 0) {
      try {
        this.scene.events.emit('scatterBonusActivated', {
          scatterIndex,
          actualFreeSpins: awardedFreeSpins,
          isRetrigger: true,
        });
      } catch (error) {
        console.warn('[Symbols] Failed to emit scatterBonusActivated during bonus retrigger:', error);
      }
    }

    if (!dialogs || typeof dialogs.showBonusFreeSpinDialog !== 'function') {
      console.warn('[Symbols] Dialogs component unavailable - skipping bonus retrigger dialog');
      gameStateManager.isScatter = false;
      return;
    }

    try {
      gameStateManager.isShowingWinDialog = true;
      dialogs.showBonusFreeSpinDialog(this.scene, {
        freeSpins: awardedFreeSpins,
      });
    } catch (error) {
      console.error('[Symbols] Failed to show bonus free spin dialog during retrigger:', error);
      gameStateManager.isShowingWinDialog = false;
      gameStateManager.isScatter = false;
      return;
    }

    await delay(AUTO_SPIN_WIN_DIALOG_TIMEOUT);

    try {
      if (typeof (dialogs as any).hideDialogWithoutFade === 'function' && dialogs.isDialogShowing()) {
        (dialogs as any).hideDialogWithoutFade();
      } else if (typeof dialogs.hideDialog === 'function' && dialogs.isDialogShowing()) {
        dialogs.hideDialog();
      }
    } catch (error) {
      console.warn('[Symbols] Failed to auto-hide bonus free spin dialog:', error);
    } finally {
      gameStateManager.isShowingWinDialog = false;
      gameStateManager.isScatter = false;
      try {
        gameEventManager.emit(GameEventType.WIN_DIALOG_CLOSED);
      } catch (error) {
        console.warn('[Symbols] Failed to emit WIN_DIALOG_CLOSED after bonus retrigger dialog:', error);
      }
      try {
        this.scene.events.emit('dialogAnimationsComplete');
      } catch (error) {
        console.warn('[Symbols] Failed to emit dialogAnimationsComplete after bonus retrigger dialog:', error);
      }
    }

    // Notify listeners that the bonus retrigger flow has fully completed
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
    } catch (e) {
      console.warn('[Symbols] Failed to emit SYMBOLS_BONUS_RETRIGGER_COMPLETE:', e);
    }
  }

  private getFreeSpinAwardFromSpinData(spinData: any, mockData: any): number {
    if (!spinData?.slot) {
      return mockData?.freeSpins || 0;
    }

    const freespin = spinData.slot.freespin || spinData.slot.freeSpin;

    if (typeof freespin?.count === 'number' && freespin.count > 0) {
      return freespin.count;
    }

    const items = Array.isArray(freespin?.items) ? freespin.items : [];
    const firstItem = items.length > 0 ? items[0] : null;
    if (firstItem && typeof firstItem.spinsLeft === 'number' && firstItem.spinsLeft > 0) {
      return firstItem.spinsLeft;
    }

    if (items.length > 0) {
      return items.length;
    }

    return mockData?.freeSpins || 0;
  }

  private getScatterIndexForRetrigger(scatterCount: number, freeSpinAward: number): number {
    if (freeSpinAward > 0) {
      const derivedIndex = SCATTER_MULTIPLIERS.indexOf(freeSpinAward);
      if (derivedIndex >= 0) {
        return derivedIndex;
      }
    }

    const baseIndex = Math.max(0, scatterCount - 3);
    return Math.min(baseIndex, SCATTER_MULTIPLIERS.length - 1);
  }

  /**
   * Animate scatter symbols with Spine animations (no winlines)
   */
  public async animateScatterSymbols(data: Data, scatterGrids: any[]): Promise<void> {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to animate');
      return;
    }

    // Temporarily keep scatter (symbol 0) as PNG; skip Spine replacement
    console.log('[Symbols] Skipping scatter Spine animation: using PNG for symbol 0');

    console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);

    // Replace scatter symbols with Spine animations
    const animationPromises = scatterGrids.map((grid, gridIndex) => {
      return new Promise<void>((resolve) => {
        // Note: scatterGrids coordinates are [row][col] from transposed data
        // but this.symbols array is [col][row] format, so we need to swap coordinates
        const col = grid.x; // grid.x is actually the column in transposed data
        const row = grid.y; // grid.y is actually the row in transposed data

        console.log(`[Symbols] ScatterGrid coordinates: grid.x=${grid.x}, grid.y=${grid.y} -> col=${col}, row=${row}`);
        console.log(`[Symbols] Accessing this.symbols[${col}][${row}]`);

        if (this.symbols && this.symbols[col] && this.symbols[col][row]) {
          const currentSymbol = this.symbols[col][row];

          try {
            // Get the scatter symbol value (0) and construct the Spine key
            const symbolValue = 0;
            const spineKey = `Symbol${symbolValue}_WF`;
            const spineAtlasKey = spineKey + '-atlas';
            const hitAnimationName = `symbol${0}_WF`;

            // Store original position and scale
            const x = currentSymbol.x;
            const y = currentSymbol.y;

            console.log(`[Symbols] Replacing scatter sprite with Spine animation: ${spineKey} at column ${col}, row ${row}`);

            // Remove the current sprite
            currentSymbol.destroy();

            const attemptCreate = (attempts: number) => {
              try {
                if (!(this.scene.cache.json as any).has(spineKey)) {
                  if (attempts < 5) {
                    console.warn(`[Symbols] Spine json '${spineKey}' not ready. Retrying (${attempts + 1}/5)...`);
                    this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                    return;
                  }
                }
                // Create Spine animation in its place
                const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
                spineSymbol.setOrigin(0.5, 0.5);

                // Start with the configured base scale
                const configuredScale = this.getSpineSymbolScale(symbolValue);
                spineSymbol.setScale(configuredScale);

                // Add to scene directly (not container) to maintain elevated depth above overlay
                this.scene.add.existing(spineSymbol);
                this.symbols[col][row] = spineSymbol;

                // Register the scatter symbol with the ScatterAnimationManager
                if (this.scatterAnimationManager) {
                  this.scatterAnimationManager.registerScatterSymbol(spineSymbol);
                }

                // Ensure the Spine animation maintains the elevated depth
                spineSymbol.setDepth(600); // Above overlay (500) but below win lines (1000)

                // Store original position for later reset
                try {
                  spineSymbol.setData('startX', x);
                  spineSymbol.setData('startY', y);
                } catch { }

                // Reset position back to start when dialog animations complete
                const resetScatterPosition = () => {
                  try { this.scene.tweens.killTweensOf(spineSymbol); } catch { }
                  try {
                    const sx = spineSymbol.getData && spineSymbol.getData('startX');
                    const sy = spineSymbol.getData && spineSymbol.getData('startY');
                    if (typeof sx === 'number' && typeof sy === 'number') {
                      spineSymbol.setPosition(sx, sy);
                    } else {
                      spineSymbol.setPosition(x, y);
                    }
                    try { spineSymbol.setAngle(0); } catch { }
                  } catch { }
                  try {
                    spineSymbol.setScale(this.getSpineSymbolScale(0));
                  } catch { }
                  try { this.scene.events.off('dialogAnimationsComplete', resetScatterPosition); } catch { }
                };

                // Support both camelCase and lowercase event names
                try { this.scene.events.once('dialogAnimationsComplete', resetScatterPosition); } catch { }

                console.log(`[Symbols] Successfully replaced scatter sprite with Spine animation at column ${col}, row ${row} with depth:`, spineSymbol.depth);

                // Play the hit animation (looped)
                spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
                console.log(`[Symbols] Playing looped scatter animation: ${hitAnimationName}`);

                // Create smooth scale tween to increase size by 20%
                const enlargedScale = configuredScale * 1.5; // Increase by 20%
                const scalingDuration = 500;
                this.scene.tweens.add({
                  targets: spineSymbol,
                  scaleX: enlargedScale,
                  scaleY: enlargedScale,
                  duration: scalingDuration, // Smooth 500ms transition
                  ease: 'Power2.easeOut', // Smooth easing
                  onComplete: () => {
                    console.log(`[Symbols] Scatter symbol scale tween completed: ${configuredScale} → ${enlargedScale}`);
                  }
                });

                // Add rapid shaking animation (fast angle oscillation)
                const shakingTween = this.scene.tweens.add({
                  targets: spineSymbol,
                  angle: { from: -3, to: 3 },
                  duration: 60,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut'
                });
                console.log('[Symbols] Applied rapid shaking tween to scatter symbol');

                // Schedule diagonal flight to the right with slow start then fast ramp
                const flightTurboMultiplier = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
                const flightDelayMs = scalingDuration * 0.8;
                const stagger = Math.max(0, Math.floor(gridIndex * 250 * flightTurboMultiplier));
                const slowPhaseDuration = Math.max(1, Math.floor(1200 * flightTurboMultiplier)) + stagger; // after 500ms ramp up
                const fastPhaseDuration = Math.max(1, Math.floor(400 * flightTurboMultiplier));

                this.scene.time.delayedCall(flightDelayMs, () => {
                  const startX = spineSymbol.x;
                  const startY = spineSymbol.y;
                  const targetX = startX + 1200;
                  const targetY = startY - 600; // up-right in Phaser (y decreases upward)

                  this.scene.tweens.add({
                    targets: spineSymbol,
                    x: startX - 25,
                    y: startY + 15,
                    duration: slowPhaseDuration,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                      shakingTween.stop();
                      this.scene.tweens.add({
                        targets: spineSymbol,
                        x: targetX,
                        y: targetY,
                        duration: fastPhaseDuration,
                        ease: 'Expo.easeIn'
                      });

                      try {
                        const audio = (window as any)?.audioManager as AudioManager;
                        audio.playOneShot(SoundEffectType.MISSILE);
                        console.log('[Symbols] Missile SFX played at scatter symbol animation start');
                      } catch { }
                    }
                  });
                });

                console.log(`[Symbols] Applied smooth scale tween: ${configuredScale} → ${enlargedScale} to scatter symbol ${symbolValue}`);

                // Resolve after a short delay to allow animation to start
                setTimeout(() => resolve(), 100);
              } catch (e) {
                if (attempts < 5) {
                  this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                  return;
                }
                throw e;
              }
            };
            attemptCreate(0);

          } catch (error) {
            console.warn(`[Symbols] Failed to replace scatter sprite with Spine animation at column ${col}, row ${row}:`, error);

            // Fallback to the old pulse method if Spine replacement fails
            if (this.symbols[col] && this.symbols[col][row]) {
              const symbol = this.symbols[col][row];

              // Pulse effect: scale up and down with glow
              this.scene.tweens.add({
                targets: symbol,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 300,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: 2, // Pulse 3 times total
                onComplete: () => {
                  resolve();
                }
              });

              // Add glow effect - check if methods exist before calling
              if (typeof symbol.setTint === 'function') {
                symbol.setTint(0x00FFFF); // Cyan tint for scatter
              }
              if (typeof symbol.setBlendMode === 'function') {
                symbol.setBlendMode(Phaser.BlendModes.ADD);
              }
            } else {
              resolve();
            }
          }
        } else {
          resolve();
        }
      });
    });

    // Wait for all Spine animations to start
    await Promise.all(animationPromises);

    // Wait longer for the animations to play and scale tween to complete
    // Apply turbo mode to the delay for consistent timing
    const baseDelay = 3000;
    const turboMultiplier = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
    const adjustedDelay = baseDelay * turboMultiplier;
    console.log(`[Symbols] Scatter animation delay: base=${baseDelay}ms, turbo=${gameStateManager.isTurbo}, adjusted=${adjustedDelay}ms`);
    await this.delay(adjustedDelay);

    console.log('[Symbols] Scatter symbol Spine animation completed');

    // Notify listeners that scatter symbol animations (including delay) have completed
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_SCATTER_ANIMATIONS_COMPLETE);
    } catch (e) {
      console.warn('[Symbols] Failed to emit SYMBOLS_SCATTER_ANIMATIONS_COMPLETE:', e);
    }
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
  }

  /**
   * Hide scatter symbols specifically (ensure they are manageable via container), no PNG reversion
   */
  public hideScatterSymbols(scatterGrids: any[]): void {
    if (!scatterGrids || scatterGrids.length === 0) {
      return;
    }

    console.log(`[Symbols] Hiding ${scatterGrids.length} scatter symbols (no PNG reversion)`);

    let hiddenCount = 0;

    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];

        // Ensure symbol is managed under container for consistent hiding
        if (symbol.parentContainer !== this.container) {
          this.scene.children.remove(symbol);
          this.container.add(symbol);
        }

        // Now hide the symbol in place
        const currentSymbol = this.symbols[grid.y][grid.x];
        if (currentSymbol && typeof currentSymbol.setVisible === 'function') {
          currentSymbol.setVisible(false);
          hiddenCount++;
          console.log(`[Symbols] Hidden symbol at (${grid.x}, ${grid.y}), visible: ${currentSymbol.visible}`);
        }
      }
    }

    console.log(`[Symbols] Hidden ${hiddenCount} scatter symbols (no PNG reversion)`);
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
    // No-op: WinLineDrawer removed
  }

  /**
   * Reset winline animations to default timing
   */
  public resetWinlineTiming(): void {
    // No-op: WinLineDrawer removed
  }

  /**
   * Ensure symbols remain visible and in their current state after autoplay is stopped
   */
  public ensureSymbolsVisibleAfterAutoplayStop(): void {
    console.log('[Symbols] Ensuring symbols remain visible after autoplay stop');

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
            symbol.setVisible(true);
            visibleCount++;
          }
        }
      }
      console.log(`[Symbols] Ensured ${visibleCount} symbols are visible after autoplay stop`);
    }

    // Clear any winlines that might be showing
    // No-op: WinLineDrawer removed

    // Hide any winning overlay that might be showing
    this.hideWinningOverlay();
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

    console.log('[Symbols] ===== TRIGGERING AUTOPLAY FOR FREE SPINS =====');
    console.log('[Symbols] Current state:');
    console.log('  - isBonus:', gameStateManager.isBonus);
    console.log('  - pendingFreeSpinsData:', this.pendingFreeSpinsData);
    console.log('  - currentSpinData:', this.currentSpinData);
    console.log('  - currentSpinData.slot:', this.currentSpinData?.slot);
    console.log('  - currentSpinData.slot.freespin:', this.currentSpinData?.slot?.freespin);
    console.log('  - freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
    console.log('  - freeSpinAutoplayTriggered:', this.freeSpinAutoplayTriggered);

    // Check if we have pending free spins data (from scatter bonus activation)
    if (this.pendingFreeSpinsData) {
      // Only trust pending data if it's a positive number; otherwise, fall back to spinData
      if (this.pendingFreeSpinsData.actualFreeSpins > 0) {
        freeSpinsCount = this.pendingFreeSpinsData.actualFreeSpins;
        console.log(`[Symbols] Using pending free spins data: ${freeSpinsCount} free spins`);
        // Clear the pending data after use
        this.pendingFreeSpinsData = null;
      } else {
        console.log('[Symbols] Pending free spins data is 0; ignoring and falling back to spinData');
        // Clear to prevent blocking future detections
        this.pendingFreeSpinsData = null;
      }
    }
    // Check if we're in bonus mode and have current spin data with free spins
    else if (gameStateManager.isBonus) {
      const fsLegacy = this.currentSpinData?.slot?.freespin?.count || 0;
      // Prefer the new format's first item's spinsLeft when available
      const fsItems = this.currentSpinData?.slot?.freespin?.items || this.currentSpinData?.slot?.freespin?.items || [];
      const firstItemSpinsLeft = Array.isArray(fsItems) && fsItems.length > 0 && typeof fsItems[0]?.spinsLeft === 'number'
        ? fsItems[0].spinsLeft
        : 0;
      // Fallback to items length if spinsLeft is not present
      const fsItemsLen = Array.isArray(fsItems) ? fsItems.length : 0;
      freeSpinsCount = Math.max(firstItemSpinsLeft, fsLegacy, fsItemsLen);
      if (freeSpinsCount > 0) {
        console.log(`[Symbols] Using free spins from spin data: ${freeSpinsCount} (legacy count=${fsLegacy}, firstItem.spinsLeft=${firstItemSpinsLeft}, items len=${fsItemsLen})`);
      }
    }

    if (freeSpinsCount > 0) {
      console.log(`[Symbols] Free spins available: ${freeSpinsCount}. Starting free spin autoplay.`);

      // Mark as triggered to prevent duplicates
      this.freeSpinAutoplayTriggered = true;

      // Start our custom free spin autoplay system
      this.startFreeSpinAutoplay(freeSpinsCount);
    } else {
      console.log('[Symbols] No free spins data available, not triggering autoplay.');
    }
    console.log('[Symbols] ===== END TRIGGERING AUTOPLAY FOR FREE SPINS =====');
  }

  /**
   * Developer helper to manually kick off free spin autoplay without the scatter flow.
   * Optionally accepts a spin payload to override the current spin data before starting.
   */
  public debugTriggerFreeSpinAutoplay(spinDataOverride?: any): void {
    console.log('[Symbols] DEBUG: Forcing free spin autoplay sequence');

    if (spinDataOverride) {
      console.log('[Symbols] DEBUG: Overriding current spin data for autoplay');
      this.currentSpinData = spinDataOverride;
    }

    // Reset guards so triggerAutoplayForFreeSpins can run again
    this.pendingFreeSpinsData = null;
    this.freeSpinAutoplayActive = false;
    this.freeSpinAutoplaySpinsRemaining = 0;
    this.freeSpinAutoplayTriggered = false;

    if (!gameStateManager.isBonus) {
      console.warn('[Symbols] DEBUG: Bonus mode is not active; forcing it may be required for full UI state.');
    }

    this.triggerAutoplayForFreeSpins();
  }

  /**
   * Start free spin autoplay using our custom system
   */
  private startFreeSpinAutoplay(spinCount: number): void {
    console.log(`[Symbols] ===== STARTING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Starting free spin autoplay with ${spinCount} spins`);

    // Set free spin autoplay state
    this.freeSpinAutoplayActive = true;
    this.freeSpinAutoplaySpinsRemaining = spinCount;
    this.currentFreeSpinIndex = -1;

    // Set global autoplay state
    gameStateManager.isAutoPlaying = true;
    gameStateManager.isAutoPlaySpinRequested = true;
    this.scene.gameData.isAutoPlaying = true;

    // Apply turbo mode to winline animations if turbo is enabled (same as normal autoplay)
    if (gameStateManager.isTurbo) {
      console.log('[Symbols] Applying turbo mode to winline animations for free spin autoplay');
      this.setTurboMode(true);
    }

    // Start the first free spin immediately
    this.performFreeSpinAutoplay();

    console.log(`[Symbols] Free spin autoplay started with ${spinCount} spins`);
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY STARTED =====`);
  }

  /**
   * Perform a single free spin autoplay
   */
  private async performFreeSpinAutoplay(): Promise<void> {
    if (!this.freeSpinAutoplayActive || this.freeSpinAutoplaySpinsRemaining <= 0) {
      console.log('[Symbols] Free spin autoplay stopped or no spins remaining');
      this.stopFreeSpinAutoplay();
      return;
    }

    console.log('[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====');
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);

    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    // In bonus mode, if a win dialog is currently visible, wait for it to fully close
    try {
      const gameScene: any = this.scene as any;
      const dialogs = gameScene?.dialogs;
      const hasActiveWinDialog =
        dialogs &&
        typeof dialogs.isDialogShowing === 'function' &&
        typeof dialogs.isWinDialog === 'function' &&
        dialogs.isDialogShowing() &&
        dialogs.isWinDialog();

      if (gameStateManager.isBonus && hasActiveWinDialog) {
        console.log('[Symbols] Bonus win dialog is showing - waiting for WIN_DIALOG_CLOSED before continuing free spin autoplay');

        const baseDelay = 500;
        const turboDelay = gameStateManager.isTurbo
          ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER
          : baseDelay;

        const onWinDialogClosed = () => {
          console.log('[Symbols] WIN_DIALOG_CLOSED received - resuming free spin autoplay after win dialog');
          try {
            gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
          } catch { }

          this.scene.time.delayedCall(turboDelay, () => {
            this.performFreeSpinAutoplay();
          });
        };

        // Use event bus so we react exactly when the win dialog finishes its fade-out
        gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
        return;
      }
    } catch (e) {
      console.warn('[Symbols] Failed to inspect dialog state before free spin autoplay:', e);
    }

    // Fallback: if some dialog state still marks a win dialog as showing, wait for dialogAnimationsComplete
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog flag is set - pausing free spin autoplay until dialogAnimationsComplete');
      this.scene.events.once('dialogAnimationsComplete', () => {
        console.log('[Symbols] dialogAnimationsComplete received - continuing free spin autoplay');
        const baseDelay = 500;
        const turboDelay = gameStateManager.isTurbo
          ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER
          : baseDelay;
        console.log(`[Symbols] Scheduling free spin retry in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
        this.scene.time.delayedCall(turboDelay, () => {
          this.performFreeSpinAutoplay();
        });
      });
      return;
    }

    try {
      // Use our free spin simulation instead of the old backend
      console.log('[Symbols] Triggering free spin via SlotController...');

      // Emit a custom event that SlotController will handle
      gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);

      // Decrement spins remaining
      this.freeSpinAutoplaySpinsRemaining--;
      this.currentFreeSpinIndex++;
      console.log(`[Symbols] Current free spin index: ${this.currentFreeSpinIndex} | GameAPI current free spin index: ${this.scene.gameAPI.getCurrentFreeSpinIndex()}`);
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

    // Check if we still have spins remaining
    if (this.freeSpinAutoplaySpinsRemaining > 0) {
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
  private handleFreeSpinAutoplayWinStop(): void {
    console.log('[Symbols] handleFreeSpinAutoplayWinStop called - freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
    if (!this.freeSpinAutoplayWaitingForWinlines) {
      console.log('[Symbols] Not waiting for winlines - skipping free spin autoplay continuation');
      return;
    }

    // Determine if the current bonus spin had any win so we can optionally
    // add extra delay before starting the next free spin.
    let hadWinThisBonusSpin = false;
    try {
      const spinData: any = this.currentSpinData;
      const slotData = spinData?.slot;

      if (gameStateManager.isBonus && slotData) {
        const freespinBlock = slotData.freespin || slotData.freeSpin;

        if (freespinBlock && Array.isArray(freespinBlock.items)) {
          // Prefer the GameAPI free spin index so we stay in sync with Game.ts
          const apiIndex =
            typeof (this.scene as any).gameAPI?.getCurrentFreeSpinIndex === 'function'
              ? (this.scene as any).gameAPI.getCurrentFreeSpinIndex()
              : null;

          const fsIndex =
            apiIndex !== null && apiIndex !== undefined
              ? apiIndex - 1
              : this.currentFreeSpinIndex;

          if (fsIndex >= 0 && fsIndex < freespinBlock.items.length) {
            const currentItem = freespinBlock.items[fsIndex];
            const currentTotalWin =
              typeof currentItem?.totalWin === 'number' ? currentItem.totalWin : 0;

            hadWinThisBonusSpin = currentTotalWin > 0;
            console.log(
              `[Symbols] Free spin autoplay WIN_STOP: totalWin for current free spin index ${fsIndex} is ${currentTotalWin} (hadWin=${hadWinThisBonusSpin})`
            );
          } else {
            console.log(
              `[Symbols] Free spin autoplay WIN_STOP: fsIndex ${fsIndex} out of range for freespin items length ${freespinBlock.items.length}`
            );
          }
        }
      }
    } catch (e) {
      console.warn(
        '[Symbols] Failed to evaluate win amount for free spin autoplay delay:',
        e
      );
    }

    console.log('[Symbols] WIN_STOP received - continuing free spin autoplay after winlines complete');
    this.freeSpinAutoplayWaitingForWinlines = false;

    // Clear any existing timer since WIN_STOP fired properly
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }

    // Base delay before the next free spin starts
    let baseDelay = 500;

    // In bonus mode, if there was any win on this free spin, add extra delay
    // so the player has more time to see the result before the next spin.
    if (hadWinThisBonusSpin && gameStateManager.isBonus && !gameStateManager.isShowingWinDialog) {
      baseDelay += 500; // +1s on top of the standard delay
      console.log(
        `[Symbols] Applying extra bonus delay after winning free spin. New baseDelay=${baseDelay}ms`
      );
    }

    const turboDelay = gameStateManager.isTurbo
      ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER
      : baseDelay;
    console.log(
      `[Symbols] Scheduling next free spin in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo}, hadWin=${hadWinThisBonusSpin})`
    );

    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(turboDelay, () => {
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

    const isBonusFinishedDelay = gameStateManager.isBonusFinished ? 1000 : 0;
    if (hasWinDialog) {
      console.log('[Symbols] Win dialog is currently showing - waiting for auto-close (2.5s) plus buffer time');
      // Wait for win dialog auto-close (2.5s) plus additional buffer time (1s) = 3.5s total

      const autoCloseDelay = 2500;
      const bufferDelay = 1000 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DELAY_MULTIPLIER : 1);
      const totalDelay = autoCloseDelay + bufferDelay + isBonusFinishedDelay;
      this.scene.time.delayedCall(totalDelay, () => {
        this.showCongratsDialogAfterDelay();
      });
    } else {
      console.log('[Symbols] No win dialog showing - waiting 1 second before showing congrats');
      // No win dialog, just wait a short buffer time
      const bufferDelay = 1000 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DELAY_MULTIPLIER : 1);
      const totalDelay = bufferDelay + isBonusFinishedDelay;
      this.scene.time.delayedCall(totalDelay, () => {
        this.showCongratsDialogAfterDelay();
      });
    }
  }

  /**
   * Show congrats dialog after the delay period
   */
  private showCongratsDialogAfterDelay(delay: number = 1000): void {
    console.log('[Symbols] Showing congrats dialog after delay');

    // If another dialog is still showing, enqueue the congrats dialog to run afterwards
    const gameScene = this.scene as any;
    if (
      gameScene.dialogs &&
      typeof gameScene.dialogs.isDialogShowing === 'function' &&
      gameScene.dialogs.isDialogShowing()
    ) {
      console.log('[Symbols] Dialog already showing - enqueueing congrats dialog to show afterwards');
      // Poll until dialogs are clear, then re-run this method to actually show congrats
      this.scene.time.delayedCall(500, () => {
        this.showCongratsDialogAfterDelay(delay);
      });
      return;
    }

    // Calculate total win from freespinItems

    // Show congrats dialog with total win amount
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongratulations === 'function') {
      this.scene.time.delayedCall(delay, () => {
        gameScene.dialogs.showCongratulations(this.scene, { winAmount: this.cachedTotalWin });
      });
      console.log(`[Symbols] Congratulations dialog shown with total win: ${this.cachedTotalWin}`);
    } else {
      console.warn('[Symbols] Dialogs component not available for congratulations dialog');
    }
  }

  /**
   * Stop free spin autoplay
   */
  private stopFreeSpinAutoplay(): void {
    console.log('[Symbols] ===== STOPPING FREE SPIN AUTOPLAY =====');

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
    this.freeSpinAutoplayTriggered = false;
    this.dialogListenerSetup = false; // Reset dialog listener setup flag

    // Reset global autoplay state
    gameStateManager.isAutoPlaying = false;
    gameStateManager.isAutoPlaySpinRequested = false;

    // Show congrats dialog after free spin autoplay ends
    this.scheduleCongratsDialogAfterAutoplay();
    this.scene.gameData.isAutoPlaying = false;

    // Restore winline animation timing to normal mode (same as normal autoplay)
    console.log('[Symbols] Restoring winline animation timing to normal mode');
    this.setTurboMode(false);

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


  public calculateAndCacheTotalWin(spinData: any) {
    const totalWin = spinData.slot.totalWin;
    if (totalWin) {
      this.cachedTotalWin = totalWin;
    }
    else {
      const freespinData = spinData.slot.freespin || spinData.slot.freeSpin;
      if (freespinData && freespinData.items && Array.isArray(freespinData.items)) {
        this.cachedTotalWin = freespinData.items.reduce((sum: number, item: any) => {
          return sum + (item.totalWin || 0);
        }, 0);
      }
      else {
        this.cachedTotalWin = 0;
      }
    }
  }

  public calculateAndCachePreBonusWins(spinData: any) {
    if (gameStateManager.isBonus) {
      return;
    }

    const multiplierValue = spinData?.slot?.freeSpin?.multiplierValue ?? spinData?.slot?.freespin?.multiplierValue;
    this.cachedPreBonusWins = typeof multiplierValue === 'number' && !Number.isNaN(multiplierValue) ? multiplierValue : 0;
    console.log(`[Symbols] Cached pre-bonus wins from free spin multiplierValue: ${this.cachedPreBonusWins}`);
  }

  /**
   * Get the time scale for a specific symbol's win animation
   */
  public getSymbolWinTimeScale(symbolValue: number): number {
    symbolValue = Math.min(symbolValue, Object.keys(this.symbolWinTimeScales).length - 1);
    return this.symbolWinTimeScales[symbolValue] || 1.5;
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

    // Store the current spin data for access by other components
    this.currentSpinData = spinData;
    console.log('[Symbols] Stored current spin data for access by other components: ', this.currentSpinData);

    // Use the slot.area from SpinData
    const symbols = spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);

    // Process the symbols using the same logic as before
    await processSpinDataSymbols(this, symbols, spinData);
  }
}


function getObjectsToShake(self: Symbols): any[] {
  const targets: any[] = [];

  try {
    if (self.container) { targets.push(self.container); }
    try {
      const bg = self.scene?.getBackground?.();

      const reelFrame = bg?.getReelFrame?.();
      if (reelFrame) { targets.push(reelFrame); }

      const bgContainer = bg?.getContainer?.();
      if (bgContainer) { targets.push(bgContainer); }
    } catch { }
    try {
      const header = self.scene?.getHeader?.();
      const headerContainer = header?.getContainer?.();
      if (headerContainer) { targets.push(headerContainer); }
    } catch { }
  } catch { }

  return targets;
}

// Shake only the grid container and the reel frame (border), not the whole camera
function simulateCameraShake(self: Symbols, targets: any[], durationMs: number, magnitude: number, axis: 'x' | 'y' | 'both' = 'both'): void {
  if (targets.length === 0) return;

  if (gameStateManager.isBonus) return;

  const affectX = axis === 'x' || axis === 'both';
  const affectY = axis === 'y' || axis === 'both';

  // Shared shake state (single timer, identical offsets for all targets)
  type GroupState = {
    basePos: WeakMap<any, { x: number; y: number }>;
    targets: Set<any>;
    untilTs: number;
    magnitude: number;
    affectX: boolean;
    affectY: boolean;
    timer?: Phaser.Time.TimerEvent;
  };
  const state: GroupState = (simulateCameraShake as any)._groupState || {
    basePos: new WeakMap<any, { x: number; y: number }>(),
    targets: new Set<any>(),
    untilTs: 0,
    magnitude: 0,
    affectX: false,
    affectY: false,
    timer: undefined,
  };
  (simulateCameraShake as any)._groupState = state;

  const now = self.scene.time.now;
  state.untilTs = Math.max(state.untilTs || 0, now + durationMs);
  state.magnitude = Math.max(state.magnitude || 0, magnitude);
  state.affectX = state.affectX || affectX;
  state.affectY = state.affectY || affectY;

  for (const t of targets) {
    if (!state.basePos.get(t)) {
      state.basePos.set(t, { x: t.x, y: t.y });
    }
    state.targets.add(t);
  }

  if (!state.timer) {
    state.timer = self.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const tnow = self.scene.time.now;
        if (tnow >= state.untilTs) {
          // Reset all to their exact base positions and clear
          for (const tgt of state.targets) {
            const base = state.basePos.get(tgt);
            if (base) {
              try { tgt.x = base.x; tgt.y = base.y; } catch { }
            }
          }
          try { state.timer?.remove(false); } catch { }
          state.timer = undefined;
          state.targets.clear();
          state.basePos = new WeakMap<any, { x: number; y: number }>();
          state.untilTs = 0;
          state.magnitude = 0;
          state.affectX = false;
          state.affectY = false;
          return;
        }

        const ox = state.affectX ? Phaser.Math.Between(-state.magnitude, state.magnitude) : 0;
        const oy = state.affectY ? Phaser.Math.Between(-state.magnitude, state.magnitude) : 0;

        for (const tgt of state.targets) {
          const base = state.basePos.get(tgt);
          if (!base) continue;
          try {
            tgt.x = base.x + ox;
            tgt.y = base.y + oy;
          } catch { }
        }
      }
    });
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.497;
  let centerY = self.scene.scale.height * 0.483;

  self.symbols = [];
  self.newSymbols = [];
  self.displayWidth = self.baseSymbolWidth;
  self.displayHeight = self.baseSymbolHeight;
  self.horizontalSpacing = 0;
  self.verticalSpacing = 0;

  let spacingX = self.horizontalSpacing * (SLOT_ROWS - 1);
  let spacingY = self.verticalSpacing * (SLOT_COLUMNS - 1);
  self.totalGridWidth = (self.displayWidth * SLOT_ROWS) + spacingX;
  self.totalGridHeight = (self.displayHeight * SLOT_COLUMNS) + spacingY;

  self.baseCenterX = centerX;
  self.baseCenterY = centerY;
  self.slotX = centerX + self.gridOffsetX;
  self.slotY = centerY + self.gridOffsetY;
}

function createContainer(self: Symbols) {
  self.container = self.scene.add.container(0, 0);

  const maskShape = self.scene.add.graphics();

  // Add padding to prevent sprite cutoff, especially on the right side
  const maskPaddingLeft = 14;
  const maskPaddingRight = 14;
  const maskPaddingTop = 2;
  const maskPaddingBottom = 2;

  maskShape.fillRect(
    self.slotX - self.totalGridWidth * 0.5 - maskPaddingLeft,
    self.slotY - self.totalGridHeight * 0.5 - maskPaddingTop,
    self.totalGridWidth + maskPaddingLeft + maskPaddingRight,
    self.totalGridHeight + maskPaddingTop + maskPaddingBottom
  );

  const mask = maskShape.createGeometryMask();
  self.container.setMask(mask);
  maskShape.setVisible(false);

  console.log(`[Symbols] Mask created with padding - Left: ${maskPaddingLeft}, Right: ${maskPaddingRight}, Top: ${maskPaddingTop}, Bottom: ${maskPaddingBottom}`);
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

function prewarmSymbolSpinePools(self: Symbols, countPerSymbol: number = 8) {
  // Pre-warm Spine instances for symbols 1-9 to avoid first-use hitches.
  const symbolValues = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const value of symbolValues) {
    const isHighPaying = value >= 1 && value <= 5;
    const spineKey = `Symbol_${isHighPaying ? 'HP' : 'LP'}_WF`;
    const atlasKey = `${spineKey}-atlas`;

    for (let i = 0; i < countPerSymbol; i++) {
      try {
        const spine = acquireSpineFromPool(self, spineKey, atlasKey);
        if (spine) {
          releaseSpineToPool(self, spine);
        }
      } catch (e) {
        console.warn('[Symbols] Failed to prewarm Spine pool for', spineKey, e);
        break;
      }
    }
  }
}

function prewarmSparkSpinePool(self: Symbols, count: number = 6) {
  const spineKey = 'spark_vfx';
  const atlasKey = `${spineKey}-atlas`;
  for (let i = 0; i < count; i++) {
    try {
      const spine = acquireSpineFromPool(self, spineKey, atlasKey);
      if (spine) {
        releaseSpineToPool(self, spine);
      }
    } catch (e) {
      console.warn('[Symbols] Failed to prewarm spark Spine pool', e);
      break;
    }
  }
}

function prewarmMultiplierSpinePools(self: Symbols, countEach: number = 3) {
  // Pre-warm pooled Spine instances used by playMultiplierSymbolAnimations to avoid first-use hitches.
  const keys = ['shatter_frame', 'multiplier_frame', 'multiplier_dove'];
  for (const spineKey of keys) {
    const atlasKey = `${spineKey}-atlas`;
    for (let i = 0; i < countEach; i++) {
      try {
        const spine = acquireSpineFromPool(self, spineKey, atlasKey);
        if (spine) {
          releaseSpineToPool(self, spine);
        }
      } catch (e) {
        console.warn('[Symbols] Failed to prewarm multiplier Spine pool for', spineKey, e);
        break;
      }
    }
  }
}

function createInitialSymbols(self: Symbols) {
  let scene = self.scene;

  // Check if symbol textures are available
  const testKey = 'symbol_0';
  if (!scene.textures.exists(testKey)) {
    console.error('[Symbols] Symbol textures not loaded! Available textures:', Object.keys(scene.textures.list));
    return;
  }
  console.log('[Symbols] Symbol textures are available');

  // Use fixed symbols for testing (row-major: [row][col])
  const initialRowMajor = [
    [0, 1, 3, 1, 0, 2],
    [1, 5, 2, 5, 2, 9],
    [2, 6, 5, 8, 5, 3],
    [7, 4, 1, 2, 4, 1],
    [4, 2, 0, 3, 1, 7],
  ];
  console.log('[Symbols] Using fixed initial symbols (row-major):', initialRowMajor);

  // Store current symbol data for reset purposes (keep row-major for tumble logic)
  self.currentSymbolData = initialRowMajor;

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  const rowCount = initialRowMajor.length;      // 5 rows
  const colCount = initialRowMajor[0].length;   // 6 columns

  // Build symbols as column-major [col][row] for rendering
  for (let col = 0; col < colCount; col++) {
    let rows: any[] = [];
    for (let row = 0; row < rowCount; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

      const value = initialRowMajor[row][col];
      // For the initial grid on scene start, always use lightweight PNG sprites
      // to avoid the cost of creating multiple Spine instances up front.
      // const created = createPngSymbol(self, value, x, y, 1);
      const created = createSpineOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }
    self.symbols.push(rows);
  }

  console.log('[Symbols] Initial symbols created successfully');
}

/**
 * Create a plain PNG symbol sprite and add it to the symbols container.
 */
function createPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  const spriteKey = 'symbol_' + value;

  // Try to reuse a pooled sprite if available
  let sprite: GameObjects.Sprite | undefined;
  if (self.symbolSpritePool.length > 0) {
    sprite = self.symbolSpritePool.pop();
  }

  if (sprite) {
    // Reconfigure an existing pooled sprite
    try {
      sprite.setTexture(spriteKey);
    } catch {
      // If texture assignment fails for some reason, fall back to a fresh sprite
      sprite = undefined;
    }
  }

  if (!sprite) {
    // Create a new sprite if the pool is empty or reuse failed
    sprite = self.scene.add.sprite(x, y, spriteKey);
    // Newly created sprites must be added to the container once
    self.container.add(sprite);
  }

  try { (sprite as any).symbolValue = value; } catch { }
  sprite.displayWidth = self.displayWidth;
  sprite.displayHeight = self.displayHeight;
  if (typeof (sprite as any).setAlpha === 'function') {
    (sprite as any).setAlpha(alpha);
  }
  // Ensure the sprite is active and visible in the grid
  try {
    sprite.setPosition(x, y);
    sprite.setVisible(true);
    sprite.setActive(true);
  } catch { }

  return sprite;
}

/**
 * Determine whether a symbol object is a poolable PNG sprite (not Spine).
 */
function isPoolablePngSymbol(self: Symbols, symbol: any): boolean {
  if (!symbol) return false;
  // Spine objects expose animationState; plain sprites do not.
  if ((symbol as any).animationState) return false;
  // Require a texture and setTexture method so we can safely reuse it.
  if (!(symbol as any).texture || typeof (symbol as any).setTexture !== 'function') return false;
  return true;
}

/**
 * Return a PNG symbol sprite to the pool instead of destroying it.
 */
function releasePngSymbolToPool(self: Symbols, symbol: any): void {
  if (!isPoolablePngSymbol(self, symbol)) {
    return;
  }

  try {
    // Stop any active tweens on this symbol
    self.scene.tweens.killTweensOf(symbol);
  } catch { }

  try {
    symbol.setVisible(false);
    symbol.setActive(false);
  } catch { }

  self.symbolSpritePool.push(symbol as GameObjects.Sprite);
}

/**
 * Spine pooling helpers (for frequently created short-lived Spine effects).
 */
function getSpinePoolKey(spineKey: string, atlasKey: string): string {
  return `${spineKey}|${atlasKey}`;
}

function acquireSpineFromPool(self: Symbols, spineKey: string, atlasKey: string): SpineGameObject | null {
  const poolKey = getSpinePoolKey(spineKey, atlasKey);
  // Fast path: reuse a LIFO stack of available items to avoid O(n) scans
  const availablePools = (self as any).spineAvailablePools || ((self as any).spineAvailablePools = {});
  const availableStack: SpineGameObject[] = availablePools[poolKey] || (availablePools[poolKey] = []);

  if (!self.spinePools[poolKey]) {
    self.spinePools[poolKey] = [];
  }
  const pool = self.spinePools[poolKey];

  // Try LIFO stack first; fallback to linear scan to remain backward compatible
  let available: any = availableStack.pop();
  if (!available) {
    available = pool.find((fx: any) => !fx.__pooledActive);
  }
  if (available) {
    (available as any).__pooledActive = true;
    try {
      available.setVisible(false);
      available.setActive(false);
      // Reset animation state and pose so new animations always start from time 0
      // and from a clean setup pose (prevents leftover state between different
      // symbol indices, e.g. HP/LP symbol win effects).
      available.animationState?.clearTracks();
      try {
        available.skeleton?.setToSetupPose();
      } catch { }
    } catch { }
    return available;
  }

  try {
    const created: SpineGameObject = self.scene.add.spine(0, 0, spineKey, atlasKey);
    (created as any).__pooledActive = true;
    (created as any).__spinePoolKey = poolKey;
    try {
      created.setVisible(false);
      created.setActive(false);
      // Ensure a deterministic initial pose for newly created pooled Spine objects.
      try {
        created.skeleton?.setToSetupPose();
      } catch { }
    } catch { }
    pool.push(created);
    return created;
  } catch (e) {
    console.warn('[Symbols] Failed to create pooled Spine:', spineKey, atlasKey, e);
    return null;
  }
}

function releaseSpineToPool(self: Symbols, spine: SpineGameObject | any): void {
  if (!spine) return;
  try {
    self.scene.tweens.killTweensOf(spine);
  } catch { }
  try {
    spine.animationState?.clearTracks();
  } catch { }
  try {
    spine.setVisible(false);
    spine.setActive(false);
  } catch { }
  try {
    (spine as any).__pooledActive = false;
    // Push into available stack for O(1) reuse
    const poolKey = (spine as any).__spinePoolKey;
    if (poolKey) {
      const availablePools = (self as any).spineAvailablePools || ((self as any).spineAvailablePools = {});
      const availableStack: SpineGameObject[] = availablePools[poolKey] || (availablePools[poolKey] = []);
      availableStack.push(spine);
    }
  } catch { }
}

/**
 * Process symbols from SpinData (GameAPI response)
 * 
 * This function is now fully event-driven: it does not await Promises.
 * Instead, it kicks off the async phases (drop reels, tumbles, multipliers,
 * scatter/bonus handling) and uses GameEventType-based events to chain them.

 */
function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols (event-driven):', symbols);

  // Clear all scatter symbols from previous spin
  if (self.scatterAnimationManager) {
    self.scatterAnimationManager.clearScatterSymbols();
  }

  // Reset symbols and clear previous state before starting new spin
  console.log('[Symbols] Resetting symbols and clearing previous state for new spin');
  self.ensureCleanSymbolState();
  self.resetSymbolsState();

  // Always clear win lines and overlay when a new spin starts
  console.log('[Symbols] Clearing win lines and overlay for new spin');
  self.clearWinLines();
  self.hideWinningOverlay();

  // Reset depths and visibility in a single grid pass before applying new symbols
  self.resetDepthsAndVisibilityForNewSpin();

  // Create a mock Data object to use with existing functions
  const mockData = new Data();
  mockData.symbols = symbols;

  // Convert SpinData paylines to the format expected by the game
  const convertedWins = convertPaylinesToWinFormat(spinData);
  console.log('[Symbols] Converted SpinData paylines to win format:', convertedWins);

  // Create a Wins object with the converted data
  mockData.wins = new Wins(convertedWins);

  mockData.balance = 0; // Not used in symbol processing
  mockData.bet = parseFloat(spinData.bet);
  mockData.freeSpins = (
    (spinData?.slot?.freespin?.items && Array.isArray(spinData.slot.freespin.items))
      ? spinData.slot.freespin.items.length
      : (spinData?.slot?.freespin?.count || 0)
  );

  // Set proper timing for animations
  const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
  const adjustedDelay = gameStateManager.isTurbo
    ? baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER
    : baseDelay;

  console.log('[Symbols] Setting animation timing:', {
    baseDelay,
    isTurbo: gameStateManager.isTurbo,
    adjustedDelay
  });

  // Set the timing in the mock data
  mockData.delayBetweenSpins = adjustedDelay;

  // Apply timing to GameData for animations
  setSpeed(self.scene.gameData, adjustedDelay);

  // Set spinning state
  gameStateManager.isReelSpinning = true;

  // Pre-compute tumble information for the event chain
  let tumbles: any = undefined;
  let hasTumbles = false;
  try {
    tumbles = gameStateManager.isBonus
      ? spinData?.slot?.freespin?.items[self.scene.gameAPI.getCurrentFreeSpinIndex() - 1]?.tumble
      : spinData?.slot?.tumbles;
    hasTumbles = Array.isArray(tumbles?.items) && tumbles.items.length > 0;
    if (hasTumbles) {
      console.log(`[Symbols] Tumble steps detected from SpinData: count=${tumbles.items.length}`);
    } else {
      console.log('[Symbols] No tumble steps detected from SpinData');
    }
  } catch (e) {
    console.warn('[Symbols] Failed inspecting tumbles from SpinData:', e);
    tumbles = undefined;
    hasTumbles = false;
  }

  // Set up the chained event subscriptions for the async phases
  setupSpinProcessingEventChain(self, mockData, spinData, tumbles, hasTumbles);

  // Kick off the first async phase: create symbols and drop reels.
  // Subsequent phases are chained via GameEventType events.
  createNewSymbols(self, mockData);
  try {
    // Fire and forget; completion is signaled via SYMBOLS_DROP_REELS_COMPLETE
    dropReels(self, mockData).catch((e) => {
      console.warn('[Symbols] dropReels rejected:', e);
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_DROP_REELS_COMPLETE);
      } catch { }
    });
  } catch (e) {
    console.warn('[Symbols] dropReels threw synchronously:', e);
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_DROP_REELS_COMPLETE);
    } catch { }
  }
}

/**
 * Wire the event-driven chain for the SpinData symbol processing flow.
 *
 * Phases:
 *   1) dropReels -> SYMBOLS_DROP_REELS_COMPLETE
 *   2) applyTumbles (optional) -> SYMBOLS_TUMBLES_COMPLETE
 *   3) playMultiplierSymbolAnimations (optional) -> SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE
 *   4) scatter / bonus handling (uses SYMBOLS_SCATTER_ANIMATIONS_COMPLETE and
 *      SYMBOLS_BONUS_RETRIGGER_COMPLETE internally)
 *   5) finalizeSpinProcessing -> SYMBOLS_PROCESSING_COMPLETE + WIN_STOP/REELS_STOP
 */
function setupSpinProcessingEventChain(
  self: Symbols,
  mockData: Data,
  spinData: any,
  tumbles: any,
  hasTumbles: boolean
): void {
  // 1) After dropReels has finished, swap in the new grid, dispose old symbols,
  //    and re-evaluate wins. Then either start tumbles or skip ahead.
  gameEventManager.once(GameEventType.SYMBOLS_DROP_REELS_COMPLETE, () => {
    console.log('[Symbols] SYMBOLS_DROP_REELS_COMPLETE received - updating symbol grid');


    // Update symbols after animation: swap to new grid immediately so logic uses it,
    // but dispose old symbols asynchronously to keep the drop frame light.
    const oldSymbols = self.symbols;
    self.symbols = self.newSymbols;
    self.newSymbols = [];

    // Schedule disposal of the old symbol grid on the next tick
    try {
      if (oldSymbols && oldSymbols.length > 0) {
        self.scene.time.delayedCall(0, () => {
          try { disposeSymbols(self, oldSymbols); } catch { }
        });
      }
    } catch { }

    // Re-evaluate wins after initial drop completes (async so visuals continue)
    try {
      self.scene.time.delayedCall(0, () => {
        try { reevaluateWinsFromGrid(self); } catch { }
      });
    } catch { }

    // If there are tumble steps from the backend, start them now.
    if (hasTumbles && tumbles && Array.isArray(tumbles.items) && tumbles.items.length > 0) {
      console.log('[Symbols] Starting tumble sequence from SYMBOLS_DROP_REELS_COMPLETE');
      try {
        applyTumbles(self, tumbles.items, mockData).catch((e) => {
          console.warn('[Symbols] applyTumbles rejected:', e);
          try {
            gameEventManager.emit(GameEventType.SYMBOLS_TUMBLES_COMPLETE);
          } catch { }
        });
      } catch (e) {
        console.warn('[Symbols] applyTumbles threw synchronously:', e);
        try {
          gameEventManager.emit(GameEventType.SYMBOLS_TUMBLES_COMPLETE);
        } catch { }
      }
    } else {
      // No tumbles to apply; advance chain immediately.
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_TUMBLES_COMPLETE);
      } catch { }
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE);
      } catch { }
    }
  });

  // 2) After tumbles have completed, resume multiplier symbol animations (if any).
  if (hasTumbles) {
    gameEventManager.once(GameEventType.SYMBOLS_TUMBLES_COMPLETE, () => {
      console.log('[Symbols] SYMBOLS_TUMBLES_COMPLETE received - starting multiplier symbol animations');
      try {
        playMultiplierSymbolAnimations(self).catch((e) => {
          console.warn('[Symbols] playMultiplierSymbolAnimations rejected:', e);
          try {
            gameEventManager.emit(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE);
          } catch { }
        });
      } catch (e) {
        console.warn('[Symbols] playMultiplierSymbolAnimations threw synchronously:', e);
        try {
          gameEventManager.emit(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE);
        } catch { }
      }
    });
  }

  // 3) After multiplier animations finish (or are skipped), handle scatter/bonus
  //    and finally schedule spin completion.
  gameEventManager.once(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE, () => {
    console.log('[Symbols] SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE received - handling post-win flow');
    handlePostMultiplierFlow(self, mockData, spinData);
  });
}

/**
 * Handle everything that originally came after tumbles + multiplier animations:
 * - Replace symbols with Spine animations if enabled
 * - Detect scatter and branch into scatter/bonus handling
 * - For non-scatter spins, immediately proceed to finalization
 */
function handlePostMultiplierFlow(self: Symbols, mockData: Data, spinData: any): void {

  // Replace with spine animations if needed (disabled while using symbol-count logic)
  try {
    if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
      replaceWithSpineAnimations(self, mockData);
    }
  } catch (e) {
    console.warn('[Symbols] replaceWithSpineAnimations failed:', e);
  }

  // Check for scatter symbols and trigger scatter bonus if found
  console.log('[Symbols] Checking for scatter symbols...');
  console.log('[Symbols] MockData symbols:', mockData.symbols);
  console.log('[Symbols] SCATTER_SYMBOL from Data:', Data.SCATTER);

  // Reuse a transposed buffer for scatter detection to avoid per-spin allocations.
  const srcSymbols = mockData.symbols;
  const rowCount = srcSymbols[0]?.length ?? 0;
  const colCount = srcSymbols.length;

  if (rowCount > 0 && colCount > 0) {
    // Ensure outer buffer size
    if (!Array.isArray(self.scatterTransposedBuffer)) {
      self.scatterTransposedBuffer = [];
    }

    for (let row = 0; row < rowCount; row++) {
      const rowArr = self.scatterTransposedBuffer[row] || (self.scatterTransposedBuffer[row] = []);
      for (let col = 0; col < colCount; col++) {
        // Invert vertical order when transposing: SpinData area uses bottom->top
        const colLen = srcSymbols[col].length;
        rowArr[col] = srcSymbols[col][colLen - 1 - row];
      }
      // Trim any stale columns from previous larger grids
      rowArr.length = colCount;
    }
    // Trim any extra rows from previous larger grids
    self.scatterTransposedBuffer.length = rowCount;
  } else {
    self.scatterTransposedBuffer.length = 0;
  }

  // Reuse a single Data instance for scatter detection
  if (!self.scatterDataBuffer) {
    self.scatterDataBuffer = new Data();
  }
  const scatterData = self.scatterDataBuffer;
  scatterData.symbols = self.scatterTransposedBuffer;
  console.log('[Symbols] Transposed symbols for scatter detection:', self.scatterTransposedBuffer);

  const scatterGrids = self.symbolDetector.getScatterGrids(scatterData);
  console.log('[Symbols] ScatterGrids found:', scatterGrids);
  console.log('[Symbols] ScatterGrids length:', scatterGrids.length);

  // NOW handle scatter symbols AFTER winlines are drawn
  const targetScatterSymbolCount = gameStateManager.isBonus ? 3 : 4;
  if (scatterGrids.length >= targetScatterSymbolCount) {
    handleScatterAndBonusFlow(self, mockData, spinData, scatterGrids);
  } else {
    console.log(`[Symbols] No scatter detected (found ${scatterGrids.length} scatter symbols, need ${targetScatterSymbolCount}+)`);
    finalizeSpinProcessing(self, spinData);
  }
}

/**
 * Handle scatter detection branch: play scatter SFX/autoplay stop, run scatter symbol
 * animations, then either run bonus retrigger flow or start the standard scatter
 * animation sequence before finalizing the spin.
 */
function handleScatterAndBonusFlow(
  self: Symbols,
  mockData: Data,
  spinData: any,
  scatterGrids: any[]
): void {
  console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
  try {
    self.calculateAndCacheTotalWin(spinData);
    self.calculateAndCachePreBonusWins(spinData);
  } catch { }
  gameStateManager.isScatter = true;

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
  } catch { }

  // Stop normal autoplay immediately when scatter is detected
  if (gameStateManager.isAutoPlaying) {
    console.log('[Symbols] Scatter detected during autoplay - stopping normal autoplay immediately');
    // Access SlotController to stop autoplay
    const slotController = (self.scene as any).slotController;
    if (slotController && typeof slotController.stopAutoplay === 'function') {
      slotController.stopAutoplay();
      console.log('[Symbols] Normal autoplay stopped due to scatter detection');
    } else {
      console.warn('[Symbols] SlotController not available to stop autoplay');
    }
  }

  // Always show the winning overlay behind symbols for scatter
  self.showWinningOverlay();
  console.log('[Symbols] Showing winning overlay for scatter symbols');

  // After scatter symbol animations (including their internal delay) complete,
  // decide whether to run a bonus retrigger flow or start the standard scatter
  // animation sequence, then finalize the spin.
  gameEventManager.once(GameEventType.SYMBOLS_SCATTER_ANIMATIONS_COMPLETE, () => {
    console.log('[Symbols] SYMBOLS_SCATTER_ANIMATIONS_COMPLETE received');


    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    // Check if win dialog is showing - if so, wait for it to close before starting scatter animation
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - waiting for WIN_DIALOG_CLOSED event before starting scatter animation');

      // Listen for WIN_DIALOG_CLOSED event to start scatter animation
      const onWinDialogClosed = () => {
        console.log('[Symbols] WIN_DIALOG_CLOSED received - starting scatter animation sequence');
        try {
          gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
        } catch { }
        // Start scatter animation after win dialog closes
        self.startScatterAnimationSequence(mockData);
        finalizeSpinProcessing(self, spinData);
      };

      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
      return;
    }

    // No win dialog currently showing – branch based on bonus mode
    if (gameStateManager.isBonus) {
      console.log('[Symbols] Bonus mode active - starting bonus scatter retrigger flow');

      // When the bonus retrigger dialog flow is complete, finalize the spin.
      gameEventManager.once(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE, () => {
        console.log('[Symbols] SYMBOLS_BONUS_RETRIGGER_COMPLETE received - finalizing spin');
        finalizeSpinProcessing(self, spinData);
      });

      try {
        self.handleBonusScatterRetrigger(mockData, scatterGrids, spinData).catch((e) => {
          console.warn('[Symbols] handleBonusScatterRetrigger rejected:', e);
          try {
            gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
          } catch { }
        });
      } catch (e) {
        console.warn('[Symbols] handleBonusScatterRetrigger threw synchronously:', e);
        try {
          gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
        } catch { }
      }
    } else {
      console.log('[Symbols] No win dialog showing - starting scatter animation immediately');
      // No win dialog, start scatter animation immediately
      self.startScatterAnimationSequence(mockData);
      finalizeSpinProcessing(self, spinData);
    }
  });

  // Animate the individual scatter symbols with their hit animations.
  console.log('[Symbols] Starting scatter symbol hit animations...');
  try {
    self.animateScatterSymbols(mockData, scatterGrids).catch((error: any) => {
      console.error('[Symbols] animateScatterSymbols rejected:', error);
      // Show Free Spin dialog immediately if cant animate scatter symbols
      // self.showFreeSpinDialog(mockData.freeSpins || 0);
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_SCATTER_ANIMATIONS_COMPLETE);
      } catch { }
    });
  } catch (error) {
    console.error('[Symbols] Error animating scatter symbols:', error);
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_SCATTER_ANIMATIONS_COMPLETE);
    } catch { }
  }
}

/**
 * Final step in the SpinData symbol processing pipeline.
 *
 * During autoplay, we must know *before* WIN_STOP is emitted whether
 * a win dialog will be shown, so that SlotController's WIN_STOP handler
 * can pause scheduling the next autoplay spin.
 *
 * This function preserves that behavior but uses Phaser timers instead of
 * async/await to poll for dialog completion.
 */
function finalizeSpinProcessing(self: Symbols, spinData: any): void {
  console.log('[Symbols] finalizeSpinProcessing called');

  // Early win-dialog threshold check (same thresholds as Game.checkAndShowWinDialog)

  if (spinData) {
    try {
      const currentSpinWin = gameStateManager.isScatter
        ? SpinDataUtils.getScatterSpinWins(spinData)
        : gameStateManager.isBonus
          ? SpinDataUtils.getBonusSpinWins(spinData, self.scene.gameAPI.getCurrentFreeSpinIndex() - 1)
          : spinData.slot.totalWin;
      const betAmount = parseFloat(spinData.bet);
      const winRatio = currentSpinWin / betAmount;

      if (winRatio >= self.scene.gameData.bigWinThreshold) {
        console.log(`[Symbols] Win meets dialog threshold (${winRatio.toFixed(2)}x) - pausing autoplay immediately`);
        gameStateManager.isShowingWinDialog = true;
      } else {
        console.log(`[Symbols] Win below dialog threshold (${winRatio.toFixed(2)}x) - autoplay continues (multiplier < 2x)`);
      }
    } catch (e) {
      console.warn('[Symbols] Failed to compute win ratio for dialog threshold check:', e);
    }
  }

  const maxWaitMs = 500;
  const pollIntervalMs = 50;
  let waitedMs = 0;

  const completeSpin = () => {
    // Set spinning state to false
    gameStateManager.isReelSpinning = false;
    console.log('[Symbols] SpinData symbols processed successfully');

    // Notify listeners that the entire SpinData symbol processing pipeline has completed
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_PROCESSING_COMPLETE, { spinData } as any);
    } catch { }

    // Mark spin as done after all animations and tumbles finish (no winline drawer flow)
    console.log('[Symbols] Emitting REELS_STOP and WIN_STOP after symbol animations and tumbles (no winlines flow)');
    try {
      gameEventManager.emit(GameEventType.WIN_STOP, { spinData });
      if(gameStateManager.isReelSpinning) {
        gameEventManager.emit(GameEventType.REELS_STOP, { spinData });
      }
    } catch (e) {
      console.warn('[Symbols] Failed to emit REELS_STOP/WIN_STOP:', e);
    }
  };

  const pollDialogState = () => {
    if (!gameStateManager.isShowingWinDialog || waitedMs >= maxWaitMs) {
      completeSpin();
      return;
    }

    waitedMs += pollIntervalMs;
    self.scene.time.delayedCall(pollIntervalMs, pollDialogState);
  };

  // Start dialog polling loop on the next tick
  self.scene.time.delayedCall(0, pollDialogState);
}

/**
 * Convert SpinData paylines to the format expected by the game's win system
 */
function convertPaylinesToWinFormat(spinData: any): Map<number, any[]> {
  const allMatching = new Map<number, any[]>();
  const paylines = spinData?.slot?.paylines;
  if (!Array.isArray(paylines)) {
    return allMatching;
  }
  for (const payline of paylines) {
    const lineKey = payline.lineKey;
    const winningGrids = getWinningGridsForPayline(spinData, payline);
    if (winningGrids.length > 0) {
      allMatching.set(lineKey, winningGrids);
    }
  }
  return allMatching;
}

/**
 * Get winning grids for a specific payline from SpinData
 */
function getWinningGridsForPayline(spinData: any, payline: any): any[] {
  const winningGrids: any[] = [];
  const lineKey = payline.lineKey;
  const count = payline.count;

  return [];

  // // Get the winline pattern for this lineKey
  // if (lineKey < 0 || lineKey >= Data.WINLINES.length) {
  //   console.warn(`[Symbols] Invalid lineKey: ${lineKey}`);
  //   return [];
  // }

  // const winline = Data.WINLINES[lineKey];

  // // Get all positions in the winline pattern (where winline[y][x] === 1)
  // const winlinePositions: { x: number, y: number }[] = [];
  // for (let x = 0; x < winline[0].length; x++) {
  //   for (let y = 0; y < winline.length; y++) {
  //     if (winline[y][x] === 1) {
  //       winlinePositions.push({ x, y });
  //     }
  //   }
  // }

  // // Sort positions by x coordinate to get left-to-right order
  // winlinePositions.sort((a, b) => a.x - b.x);

  // // Take only the first 'count' positions as winning symbols
  // const winningPositions = winlinePositions.slice(0, count);

  // // Add the winning positions to the result (SpinData.area is [column][row], bottom->top)
  // for (const pos of winningPositions) {
  //   const colLen = spinData.slot.area[pos.x]?.length || 0;
  //   const rowIndex = Math.max(0, colLen - 1 - pos.y);
  //   const symbolAtPosition = spinData.slot.area[pos.x][rowIndex];
  //   winningGrids.push(new Grid(pos.x, pos.y, symbolAtPosition));
  // }

  return winningGrids;
}

function onSpinDataReceived(self: Symbols) {
  // Listen for the new SPIN_DATA_RESPONSE event from GameAPI
  gameEventManager.on(GameEventType.SPIN_DATA_RESPONSE, (data: any) => {
    console.log('[Symbols] SPIN_DATA_RESPONSE received:', data);
    console.log('[Symbols] SpinData:', data.spinData);

    if (!data.spinData || !data.spinData.slot || !data.spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }

    // Store the current spin data for access by other components
    self.currentSpinData = data.spinData;
    console.log('[Symbols] Stored current spin data for access by other components');

    // Use the correct area (freespin when in bonus), with safe fallback
    let symbols: any;
    if (gameStateManager.isBonus) {
      const freeItems = data?.spinData?.slot?.freespin?.items;
      const boundedIndex = Math.max(0, Math.min(self.scene.gameAPI.getCurrentFreeSpinIndex() - 1, (freeItems?.length ?? 1) - 1));
      symbols = freeItems?.[boundedIndex]?.area ?? data.spinData.slot.area;
      console.log(`[Symbols] Using freespin area at index ${boundedIndex}:`, symbols);
    } else {
      symbols = data.spinData.slot.area;
      console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    }

    // Process the symbols using the same logic as before, using mock scatter data.
    // This is now a fully event-driven pipeline (no awaits inside).
    processSpinDataSymbols(self, symbols, data.spinData);
  });
}

/**
 * Attempt to scale a Spine object so it visually fits within the PNG dimensions
 * used by symbols (self.displayWidth x self.displayHeight).
 */
function fitSpineToSymbolBox(self: Symbols, spineObj: any, fallbackScale: number = 1): void {
  if (!spineObj) return;
  try {
    // Reset to a known baseline before measuring
    if (typeof spineObj.setScale === 'function') spineObj.setScale(1);
    try {
      // Ensure we are in setup pose before measuring
      if (spineObj.skeleton && typeof spineObj.skeleton.setToSetupPose === 'function') {
        spineObj.skeleton.setToSetupPose();
      }
      if (spineObj.updateWorldTransform) {
        spineObj.updateWorldTransform();
      }
    } catch { }

    let boundsWidth = 0;
    let boundsHeight = 0;

    try {
      if (typeof spineObj.getBounds === 'function') {
        const b = spineObj.getBounds();
        if (b && b.size) {
          boundsWidth = Math.max(1, b.size.x || b.size.width || 0);
          boundsHeight = Math.max(1, b.size.y || b.size.height || 0);
        }
      }
    } catch { }

    if (!boundsWidth || !boundsHeight) {
      // Fallback to width/height properties if available
      boundsWidth = Math.max(1, (spineObj.width as number) || 0);
      boundsHeight = Math.max(1, (spineObj.height as number) || 0);
    }

    // Compute uniform scale to fit within target box
    const targetW = Math.max(1, self.displayWidth);
    const targetH = Math.max(1, self.displayHeight);
    const scale = Math.min(targetW / boundsWidth, targetH / boundsHeight); // small padding
    if (isFinite(scale) && scale > 0) {
      spineObj.setScale(scale);
    } else {
      // Fallback: use existing per-symbol scale logic
      spineObj.setScale(self.getSpineSymbolScale(0));
    }
  } catch { }
}

function scheduleWinAmountPopup(self: Symbols, x: number, y: number, displayAmount: number, delayMs: number = 1000, durationMs: number = 1000): void {
  console.log(`[Symbols] scheduleWinAmountPopup: Displaying amount: ${displayAmount} with delay: ${delayMs}ms and duration: ${durationMs}ms`);

  const scene = self.scene;
  if (!scene) return;

  const baseX = x;
  const baseY = y;

  // Create NumberDisplay configuration
  const numberConfig: NumberDisplayConfig = {
    x: baseX,
    y: baseY,
    scale: 0.05,
    spacing: 4,
    alignment: 'center',
    decimalPlaces: 2,
    showCommas: true,
    prefix: '',
    suffix: '',
    commaYOffset: 7,
    dotYOffset: 7,
    animateThreshold: -1
  };

  // Schedule the display creation after delay
  scene.time.delayedCall(delayMs, () => {
    // Create the number display
    const numberDisplay = new NumberDisplay(numberConfig);
    numberDisplay.create(scene);
    numberDisplay.toggleBorder(false);
    numberDisplay.setDropShadow(true, 2, 2, 1, 0x000000);

    // Ensure the container is visible and has high depth before displaying value
    const container = numberDisplay.getContainer();
    if (container) {
      container.setDepth(700); // High depth to ensure it's on top
      container.setVisible(true);
      container.setAlpha(1);
      container.setPosition(baseX, baseY); // Ensure position is set
    }

    // Display the value after ensuring container is set up
    numberDisplay.displayValue(displayAmount);

    // Optionally destroy after duration
    if (durationMs > 0) {
      scene.add.tween({
        targets: container,
        scale: 1.2,
        duration: 200,
        yoyo: true,
        repeat: 0,
        ease: Phaser.Math.Easing.Cubic.Out,
      });
      scene.add.tween({
        targets: container,
        y: baseY - 30,
        duration: durationMs,
        ease: Phaser.Math.Easing.Cubic.Out,
        onComplete: () => {
          scene.add.tween({
            targets: container,
            alpha: 0,
            duration: 100,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => {
              numberDisplay.destroy();
            }
          });
        }
      });
    }
  });
}

/**
 * Schedule a scale-up effect (+30%) after a delay (default 500ms)
 */
function scheduleScaleUp(self: Symbols, obj: any, delayMs: number = 500, durationMs: number = 200, scale: number = 1.6): void {
  try {
    const baseX = obj?.scaleX ?? 1;
    const baseY = obj?.scaleY ?? 1;
    const targetX = baseX * scale;
    const targetY = baseY * scale;
    self.scene.time.delayedCall(delayMs, () => {
      try {
        self.scene.tweens.add({
          targets: obj,
          scaleX: targetX,
          scaleY: targetY,
          duration: durationMs,
          ease: Phaser.Math.Easing.Cubic.Out,
        });
      } catch { }
    });
  } catch { }
}

function scheduleTranslate(self: Symbols, obj: any, delayMs: number = 500, durationMs: number = 200, x: number = 0, y: number = 0, isAbsolute: boolean = false, onComplete?: () => void): void {
  try {
    self.scene.time.delayedCall(delayMs, () => {
      const baseX = obj?.x ?? 0;
      const baseY = obj?.y ?? 0;
      const targetX = isAbsolute ? x : baseX + x;
      const targetY = isAbsolute ? y : baseY + y;
      try {
        self.scene.tweens.add({
          targets: obj,
          x: targetX,
          y: targetY,
          duration: durationMs,
          ease: Phaser.Math.Easing.Cubic.Out,
          onComplete: onComplete,
        });
      } catch { }
    });
  } catch { }
}

/**
 * Create a symbol for the main grid.
 *
 * - Scatter + low‑paying + high‑paying symbols (0–9) use lightweight PNG sprites.
 * - Spine is reserved for dedicated win / special animations (handled elsewhere).
 */
function createSpineOrPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  console.log(`[Symbols] Creating PNG or special symbol for value: ${value}`);

  // Regular symbols 0–9 (scatter + low + high paying) -> always PNG on the grid.
  if (value >= 0 && value <= 9) {
    try {
      const isHighPaying = value >= 1 && value <= 5;
      const spineKey = value === 0 ? 'Symbol0_WF' : `Symbol_${isHighPaying ? 'HP' : 'LP'}_WF`;
      const atlasKey = `${spineKey}-atlas`;

      const spine = acquireSpineFromPool(self, spineKey, atlasKey);
      if (spine) {
        try { (spine as any).symbolValue = value; } catch { }

        // Configure transform
        try {
          const origin = self.getSpineSymbolOrigin(value);
          spine.setOrigin(origin.x, origin.y);
        } catch { }
        try { spine.setScale(self.getSpineSymbolScale(value)); } catch { }
        try {
          spine.setPosition(x, y);
          spine.setAlpha(alpha);
          spine.setVisible(true);
          spine.setActive(true);
        } catch { }

        // Select the correct per-symbol animation inside the shared HP/LP rig
        try {
          const state = spine.animationState;
          if (state) {
            const animationName = `symbol${value}_WF`;
            let entry: any = null;
            try { entry = state.setAnimation(0, animationName, true); } catch { }
            if (!entry) {
              const fallback = spine.skeleton?.data?.animations?.[0]?.name;
              if (fallback) {
                try { state.setAnimation(0, fallback, true); } catch { }
              }
            }
          }
        } catch { }

        try {
          if (self.container && spine.parentContainer !== self.container) {
            self.container.add(spine);
          }
        } catch { }

        return spine;
      }
    } catch (spineError) {
      console.warn('[Symbols] Failed to create pooled Spine symbol, falling back to PNG:', spineError);
    }

    // Fallback to PNG if Spine acquisition/configuration failed
    
    return createPngSymbol(self, value, x, y, alpha);
  }
  // Multiplier symbols (value >= 10) use a dedicated creation path.
  else if (value >= 10) {
    try {
      return createMultiplierSymbol(self, value, x, y, alpha);
      console.log('[Symbols] Multiplier symbol: ', value);
    } catch {
      console.error('[Symbols] Failed to create multiplier symbol: ', value);
    }
  }

  // Fallback to PNG sprite for any other values (e.g., scatter)
  return createPngSymbol(self, value, x, y, alpha);
}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;
  disposeSymbols(self, self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;

  let symbols = data.symbols; // expected column-major [col][row]
  console.log('[Symbols] New symbols from spin response (column-major):', symbols);

  // Update current symbol data for reset purposes (store as row-major for tumble logic)
  try {
    const colCount = symbols.length;
    const rowCount = colCount > 0 ? symbols[0].length : 0;
    const rowMajor: number[][] = [];
    for (let row = 0; row < rowCount; row++) {
      rowMajor[row] = [];
      for (let col = 0; col < colCount; col++) {
        // Invert vertical order: SpinData area is bottom->top; row 0 is top visually
        rowMajor[row][col] = symbols[col][rowCount - 1 - row];
      }
    }
    self.currentSymbolData = rowMajor;
  } catch {
    self.currentSymbolData = symbols;
  }

  self.newSymbols = [];

  for (let col = 0; col < symbols.length; col++) {
    let rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

      // Invert vertical order for display
      const value = symbols[col][symbols[col].length - 1 - row];
      const created = createSpineOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }
    self.newSymbols.push(rows);
  }
}

async function dropReels(self: Symbols, data: Data): Promise<void> {
  // Remove init check since we're not using it anymore
  console.log('[Symbols] dropReels called with data:', data);
  console.log('[Symbols] SLOT_ROWS:', SLOT_ROWS);

  self.dropSparkPlayedColumns.clear();

  // Stagger reel starts at a fixed interval and let them overlap

  // Anticipation disabled: do not check columns for scatter, no reel extension
  const extendLastReelDrop = false;
  try { (self.scene as any).__isScatterAnticipationActive = false; } catch { }

  const reelPromises: Promise<void>[] = [];
  // Adjustable gap between clearing previous symbols and spawning new ones per row
  const PREV_TO_NEW_DELAY_MS = (self.scene.gameData as any)?.prevToNewDelayMs ?? 250;
  // Reverse the sequence: start from bottom row to top row
  for (let step = 0; step < SLOT_COLUMNS; step++) {
    const actualRow = (SLOT_COLUMNS - 1) - step;
    const isLastReel = actualRow === 0;
    const startDelay = self.scene.gameData.dropReelsDelay * step;
    const p = (async () => {
      await delay(startDelay);
      console.log(`[Symbols] Processing row ${actualRow}`);
      dropPrevSymbols(self, actualRow, isLastReel && extendLastReelDrop)

      // Wait before spawning new symbols so previous ones are cleared first
      await delay(PREV_TO_NEW_DELAY_MS);
      await dropNewSymbols(self, actualRow, isLastReel && extendLastReelDrop);
    })();
    reelPromises.push(p);
  }
  console.log('[Symbols] Waiting for all reels to complete animation...');
  await Promise.all(reelPromises);
  console.log('[Symbols] All reels have completed animation');

  // Notify listeners that the initial drop-reels phase has fully completed
  try {
    gameEventManager.emit(GameEventType.SYMBOLS_DROP_REELS_COMPLETE);
  } catch (e) {
    console.warn('[Symbols] Failed to emit SYMBOLS_DROP_REELS_COMPLETE:', e);
  }
}

function rowDropPrevSymbols(self: Symbols, index: number, extendDuration: boolean = false) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

  // Check if symbols array has valid structure
  if (!self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] fadePrevSymbols: symbols array structure is invalid, skipping');
    return;
  }

  const extraMs = extendDuration ? 1500 : 0;

  // Compute a drop distance that guarantees symbols exit the screen regardless of their start
  const DROP_DISTANCE = self.totalGridHeight + 50;//distanceToScreenBottom + self.totalGridHeight + (height * 2) + self.scene.gameData.winUpHeight;
  const DROP_DELAY = 100; // delay between each symbol in the row

  for (let col = 0; col < self.symbols.length; col++) {
    if (!self.symbols[col] || !self.symbols[col][index]) {
      console.warn(`[Symbols] fadePrevSymbols: skipping invalid col ${col} or index ${index}`);
      continue;
    }

    const symbol = self.symbols[col][index];
    const rowLen = self.symbols[0].length;

    self.scene.tweens.chain({
      targets: symbol,
      tweens: [
        {
          delay: DROP_DELAY * (rowLen - index),
          y: `+= ${DROP_DISTANCE}`,
          duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
          ease: Phaser.Math.Easing.Cubic.InOut,
        }
      ],
    });
  }
}

function dropPrevSymbols(self: Symbols, index: number, extendDuration: boolean = false) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

  // Check if symbols array has valid structure
  if (!self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropPrevSymbols: symbols array structure is invalid, skipping');
    return;
  }

  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const extraMs = extendDuration ? 3000 : 0;
  // Drop previous symbols far enough to be fully off-screen regardless of starting row
  const gridBottomY = self.slotY + self.totalGridHeight * 0.5;
  const distanceToScreenBottom = Math.max(0, self.scene.scale.height - gridBottomY);
  const DROP_DISTANCE = distanceToScreenBottom + self.totalGridHeight + (height * 2) + self.scene.gameData.winUpHeight;
  const totalAnimations = self.symbols.length;
  const STAGGER_MS = gameStateManager.isTurbo ? 0 : 175; // match dropNewSymbols stagger (left-to-right, one by one feel)
  const clearHop = self.scene.gameData.winUpHeight * 0.25;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[Symbols] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }

    self.scene.tweens.chain({
      targets: self.symbols[i][index],
      tweens: [
        {
          delay: STAGGER_MS * i,
          y: `-= ${clearHop}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${5}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${5}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
      ],
    });
  }
}

function dropFillers(self: Symbols, index: number, extendDuration: boolean = false) {
  // Check if symbols array has valid structure
  if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropFillers: symbols array structure is invalid, skipping');
    return;
  }

  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const baseTotal = Symbols.FILLER_COUNT + SLOT_COLUMNS;
  const baseDropDistance = baseTotal * height + GameData.WIN_UP_HEIGHT;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropDuration * 0.9;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const TOTAL_ITEMS = Symbols.FILLER_COUNT + SLOT_COLUMNS + extraRows;
  const DROP_DISTANCE = TOTAL_ITEMS * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: GameObjects.Sprite[] = [];
  for (let i = 0; i < TOTAL_ITEMS - SLOT_COLUMNS; i++) {

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_COLUMNS);
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y)


    const value = Math.floor(Math.random() * Data.ALL_SYMBOLS.length);
    const created = createSpineOrPngSymbol(self, value, x, y, 1);
    fillerSymbols.push(created);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    self.scene.tweens.chain({
      targets: fillerSymbols[i],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
          onComplete: () => {
            // Return filler PNG symbols to the pool when finished; destroy others.
            const sym = fillerSymbols[i];
            if (isPoolablePngSymbol(self, sym)) {
              releasePngSymbolToPool(self, sym);
            } else if (sym && sym.destroy) {
              sym.destroy();
            }
          }
        }
      ]
    })

  }
}

function dropNewSymbols(self: Symbols, index: number, extendDuration: boolean = false): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check if symbols array has valid structure
    if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
      console.warn('[Symbols] dropNewSymbols: symbols array structure is invalid, resolving immediately');
      resolve();
      return;
    }

    const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
    const extraMs = extendDuration ? 3000 : 0;

    let completedAnimations = 0;
    const totalAnimations = self.newSymbols.length;
    const STAGGER_MS = gameStateManager.isTurbo ? 0 : 150; // delay between each column drop
    const symbolHop = self.scene.gameData.winUpHeight * 0.5;

    for (let col = 0; col < self.newSymbols.length; col++) {
      let symbol = self.newSymbols[col][index];
      const targetY = getYPos(self, index);

      // Trigger drop animation on the new symbol if available (sugar Spine)
      try { playDropAnimationIfAvailable(symbol); } catch { }

      self.scene.tweens.chain({
        targets: symbol,
        tweens: [
          {
            delay: STAGGER_MS * col,
            y: `-= ${symbolHop}`,
            duration: self.scene.gameData.winUpDuration,
            ease: Phaser.Math.Easing.Circular.Out,
          },
          {
            y: targetY,
            duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
            ease: Phaser.Math.Easing.Linear,
            onComplete: () => {
              // Optional shake per column land (grid + border only)
              try {
                const mag = (self.scene.gameData as any)?.dropShakeMagnitude ?? 0;
                const dur = Math.max(50, (self.scene.gameData as any)?.dropShakeDurationMs ?? 120);
                if (mag > 0) {
                  const axis = (self.scene.gameData as any)?.dropShakeAxis ?? 'both';
                  simulateCameraShake(self, getObjectsToShake(self), dur, mag, axis);
                }
              } catch { }

              const audioManager = (window as any).audioManager;
              // Play reel drop sound effect only when turbo mode is off
              if (audioManager) {
                if (gameStateManager.isTurbo) {
                  audioManager.playSingleInstanceSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_TURBO_REEL_DROP : SoundEffectType.TURBO_REEL_DROP);
                }
                else {
                  audioManager.playSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_REEL_DROP : SoundEffectType.REEL_DROP);
                }
                console.log(`[Symbols] Playing reel drop sound effect for reel ${index} after drop completion`);
              }

              // Play Spark_VFX animation on symbol drop
              tryPlaySparkVFXForColumn(self, col, symbol);

              completedAnimations++;
              if (completedAnimations === totalAnimations) {
                // Anticipation behavior disabled
                if (gameStateManager.isTurbo) {
                  self.scene.time.delayedCall(500, () => {
                    resolve();
                  });
                }
                else
                  resolve();
              }
            }
          }
        ]
      })
    }
  });
}

function tryPlaySparkVFXForColumn(self: Symbols, col: number, symbol: any): void {
  try {
    if (!symbol || self.dropSparkPlayedColumns.has(col)) return;
    self.dropSparkPlayedColumns.add(col);
    const sparkTimeScale = (self.scene.gameData as any)?.sparkVFXTimeScale ?? 1;
    const sparkScale = (self.scene.gameData as any)?.sparkVFXScale ?? 0.5;
    playSparkVFXOnSymbol(self, symbol, sparkTimeScale, sparkScale);
  } catch (e) {
    console.warn('[Symbols] Failed to play Spark_VFX on symbol drop:', e);
  }
}


function disposeSymbols(self: Symbols, symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;

  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol = symbols[col][row];
      if (!symbol) continue;

      // Pool PNG sprites, pooled Spine instances, destroy other non‑poolable objects (e.g. containers, FX)
      if (isPoolablePngSymbol(self, symbol)) {
        try {
          releasePngSymbolToPool(self, symbol);
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing pooled PNG symbol at (${col}, ${row}):`, error);
        }
      } else if ((symbol as any).__spinePoolKey) {
        // This is a pooled Spine instance – return it to the Spine pool
        try {
          releaseSpineToPool(self, symbol as any);
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing pooled Spine symbol at (${col}, ${row}):`, error);
        }
      } else if (symbol.destroy) {
        try {
          symbol.destroy();
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
        }
      }
    }
  }

  console.log(`[Symbols] Disposed ${disposedCount} symbols`);
}


function playDropAnimationIfAvailable(obj: any): void {
  try {
    const val = (obj as any)?.symbolValue;
    const canSpine = !!(obj?.animationState && obj.animationState.setAnimation);
    if (typeof val === 'number' && val >= 1 && val <= 9 && canSpine) {
      const drop = `Symbol${val}_SW_Drop`;
      try {
        const hasDrop = !!(obj as any)?.skeleton?.data?.findAnimation?.(drop);
        if (hasDrop) {
          obj.animationState.setAnimation(0, drop, false);
        }
      } catch { }
    }
  } catch { }
}

/**
 * Create and play the Spark_VFX spine animation on top of a symbol
 * @param self - Symbols instance
 * @param symbol - The symbol object to play the VFX on top of
 * @param timeScale - Time scale for the animation (default: 1)
 */
function acquireSparkVFXFromPool(self: Symbols): SpineGameObject | null {
  // Backwards-compatible wrapper around the generic Spine pool
  const fx = acquireSpineFromPool(self, 'spark_vfx', 'spark_vfx-atlas');
  if (fx && self.container) {
    try { self.container.add(fx); } catch { }
  }
  return fx;
}

function releaseSparkVFXToPool(self: Symbols, sparkVFX: SpineGameObject): void {
  // Use generic Spine pooling cleanup
  releaseSpineToPool(self, sparkVFX);
}

function playSparkVFXOnSymbol(self: Symbols, symbol: any, timeScale: number = 1, scale: number = 0.5): void {
  const sparkVFX = acquireSparkVFXFromPool(self);
  if (!sparkVFX) return;

  try {
    const excessDeptth = 200;

    sparkVFX.setScale(scale);
    sparkVFX.setPosition(symbol.x, symbol.y + symbol.displayHeight * (1 - scale) * 0.5 * symbol.scaleY);
    sparkVFX.setDepth(symbol.depth + excessDeptth);
    sparkVFX.setVisible(true);
    sparkVFX.setActive(true);
    try { self.container.bringToTop(sparkVFX); } catch { }

    if (sparkVFX.animationState) {
      sparkVFX.animationState.timeScale = timeScale;
    }

    let completed = false;
    const onDone = () => {
      if (completed) return;
      completed = true;
      releaseSparkVFXToPool(self, sparkVFX);
    };

    const animationName = 'animation';
    if (!(sparkVFX.animationState && sparkVFX.animationState.setAnimation)) {
      onDone();
      return;
    }

    const entry: any = sparkVFX.animationState.setAnimation(0, animationName, false);

    // Attach completion listener
    try {
      if (entry && (entry.setListener || 'listener' in entry)) {
        if (typeof entry.setListener === 'function') {
          entry.setListener({ complete: onDone, end: onDone });
        } else {
          entry.listener = { complete: onDone, end: onDone };
        }
      }
    } catch { }

    // Fallback: state-level listener
    try {
      if (sparkVFX.animationState && sparkVFX.animationState.addListener) {
        sparkVFX.animationState.addListener({ complete: onDone, end: onDone } as any);
      }
    } catch { }

    // Fallback: use timeout based on animation duration
    try {
      const dur = sparkVFX.skeleton?.data?.findAnimation?.(animationName)?.duration;
      if (typeof dur === 'number' && dur > 0) {
        const safeScale = timeScale || 1;
        const durationMs = dur * 1000 / safeScale;
        if (durationMs > 0 && Number.isFinite(durationMs)) {
          self.scene.time.delayedCall(durationMs, onDone);
        }
      }
    } catch { }
  } catch (e) {
    console.warn('[Symbols] Failed to play Spark_VFX on symbol:', e);
    releaseSparkVFXToPool(self, sparkVFX);
  }
}

function reevaluateWinsFromGrid(self: Symbols): void {
  try {
    // Reuse a single Data instance for win evaluation to avoid per-call allocations
    if (!self.winEvalDataBuffer) {
      self.winEvalDataBuffer = new Data();
    }
    const dt = self.winEvalDataBuffer;

    // Ensure currentSymbolData is populated; if not, derive from self.symbols
    if (!self.currentSymbolData) {
      const numCols = self.symbols?.length || 0;
      const numRows = numCols > 0 ? (self.symbols[0]?.length || 0) : 0;

      if (!Array.isArray(self.winEvalRowMajorBuffer)) {
        self.winEvalRowMajorBuffer = [];
      }

      for (let row = 0; row < numRows; row++) {
        const rowArr = self.winEvalRowMajorBuffer[row] || (self.winEvalRowMajorBuffer[row] = []);
        for (let col = 0; col < numCols; col++) {
          // Attempt to read a value property stored during drops; fallback to 0
          try {
            const obj: any = self.symbols[col][row];
            const val = self.currentSymbolData?.[row]?.[col];
            rowArr[col] = typeof val === 'number' ? val : (obj?.symbolValue ?? 0);
          } catch {
            rowArr[col] = 0;
          }
        }
        rowArr.length = numCols;
      }
      self.winEvalRowMajorBuffer.length = numRows;
      dt.symbols = self.winEvalRowMajorBuffer;
    } else {
      dt.symbols = self.currentSymbolData;
    }

    // Compute wins using SymbolDetector
    const wins = self.symbolDetector.getWins(dt);
    dt.wins = wins;

    // Avoid heavy logging every tumble; keep a minimal statement only when there are wins
    if (wins.symbolCounts.size > 0) {
      console.log('[Symbols] Re-evaluated wins after drop, matchCount:', wins.symbolCounts.size);
      gameEventManager.emit(GameEventType.WIN_START);
    }

    // Apply highlighting only if not disabled
    if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
      console.log('[Symbols] Re-evaluated wins from grid, replacing with spine animations');
      replaceWithSpineAnimations(self, dt);
    }
  } catch (e) {
    console.warn('[Symbols] Failed to re-evaluate wins from current grid:', e);
  }
}

function getYPos(self: Symbols, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}

/**
 * After all tumbles have finished, resume multiplier symbol animations (index >= 10)
 * and wait until their animations have completed (based on the longest duration).
 */
async function playMultiplierSymbolAnimations(self: Symbols): Promise<void> {
  try {
    const cols = self.symbols?.length || 0;
    const rows = cols > 0 && self.symbols[0] ? self.symbols[0].length : 0;
    const numCols = self.symbols?.length || 0;
    const scale = self.getSpineSymbolScale(10);
    if (cols > 0 && rows > 0) {
      const isTurbo = (self.scene as any)?.gameData?.isTurbo || gameStateManager.isTurbo;
      const speedMultiplier = isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1;
      // Stagger each dove’s departure so multiple multipliers don’t all launch at once.
      // Keep this turbo-scaled so turbo still feels fast.
      const birdDepartureStaggerMs = 800;
      let birdDepartureIndex = 0;
      const baseTimeScale = self.getSymbolWinTimeScale(10);
      const timeScale = isTurbo
        ? baseTimeScale * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
        : baseTimeScale;

      let maxDurationMs = 0;
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const value = self.currentSymbolData?.[row]?.[col];
          if (typeof value === 'number' && value >= 10) {
            const originalObj: any = self.symbols[col]?.[row];

            // Base position for the multiplier visuals
            const baseX = originalObj?.x ?? 0;
            const baseY = originalObj?.y ?? getYPos(self, row);

            // Shared references/parameters so value image can follow the dove
            let valueImage: any = null;
            let leaveTargetX = 0;
            let leaveTargetY = 0;
            let leaveDelay = 0;
            let leaveDuration = 0;
            let returnStartingX = 0;
            let returnStartingY = 0;
            let returnTargetX = 0;
            let returnTargetY = 0;
            let returnDelay = 0;
            let returnDuration = 0;
            // Vertical offset for the value image relative to the dove (about 50px)
            const returnValueOffsetY = 150 * scale;

            // Remove the original multiplier object – it will be replaced by the new assets
            if (originalObj) {
              try { self.scene.tweens.killTweensOf(originalObj); } catch { }
              try { originalObj.destroy(); } catch { }
            }

            // Container that will hold frame, dove and value – also used for tweening
            const multContainer = self.scene.add.container(baseX, baseY);
            // Ensure multiplier visuals render above all other symbols/overlays
            try { multContainer.setDepth(700); } catch { }
            // Replace grid reference with the new container so cleanup logic still works
            try { self.symbols[col][row] = multContainer as any; } catch { }

            let localMaxDurationMs = 0;

            // Helper to update the maximum duration
            const updateDurationFromSpine = (spineObj: any, animNameFallback?: string) => {
              try {
                const state = spineObj?.animationState;
                if (!state) return;

                // Try to set an explicit animation if provided
                if (animNameFallback) {
                  try { state.setAnimation(0, animNameFallback, false); } catch { }
                }

                let durSec: number | undefined;
                const data = spineObj?.skeleton?.data;
                if (data?.findAnimation && animNameFallback) {
                  durSec = data.findAnimation(animNameFallback)?.duration;
                }

                // Fallback: use first animation in the skeleton, if any
                if ((durSec === undefined || durSec <= 0) && Array.isArray(data?.animations) && data.animations.length > 0) {
                  durSec = (data.animations[0] as any).duration;
                }

                const ts = state.timeScale || 1;
                if (typeof durSec === 'number' && durSec > 0 && ts > 0) {
                  const durMs = (durSec * 1000) / ts;
                  if (durMs > localMaxDurationMs) {
                    localMaxDurationMs = durMs;
                  }
                }
              } catch { }
            };

            // Create shatter spine (pooled)
            try {
              const shatterKey = 'shatter_frame';
              const shatterAtlasKey = `${shatterKey}-atlas`;
              const shatterSpine = acquireSpineFromPool(self, shatterKey, shatterAtlasKey);
              if (shatterSpine) {
                try {
                  shatterSpine.setOrigin(0.5, 0.5);
                  shatterSpine.setScale(scale * 0.4);
                  // Start hidden but active; will be made visible when its animation starts
                  shatterSpine.setVisible(false);
                  shatterSpine.setActive(true);
                  multContainer.add(shatterSpine);

                  const shatterDelay = 500 / speedMultiplier;
                  self.scene.time.delayedCall(shatterDelay, () => {
                    shatterSpine.setVisible(true);
                    // get first animation in skeleton
                    const animationName = shatterSpine.skeleton?.data?.animations[0]?.name ?? 'animation';
                    shatterSpine.animationState.setAnimation(0, animationName, false);
                    shatterSpine.animationState.timeScale = timeScale;
                  });
                } catch { }
              }
            } catch (e) {
              console.warn('[Symbols] Failed to create shatter spine:', e);
            }

            // Create multiplier frame spine (pooled)
            try {
              const frameKey = 'multiplier_frame';
              const frameAtlasKey = `${frameKey}-atlas`;
              const frameSpine: any = acquireSpineFromPool(self, frameKey, frameAtlasKey);
              if (frameSpine) {
                try {
                  const origin = self.getSpineSymbolOrigin(value);
                  frameSpine.setOrigin(origin.x, origin.y);
                  frameSpine.setScale(scale);
                  frameSpine.setVisible(true);
                  frameSpine.setActive(true);
                  multContainer.add(frameSpine);
                  if (frameSpine.animationState) {
                    frameSpine.animationState.setAnimation(0, `symbol${value}_WF`, false);
                    frameSpine.animationState.timeScale = timeScale;
                  }
                } catch { }
                updateDurationFromSpine(frameSpine, `symbol${value}_WF`);
              }
            } catch (e) {
              console.warn('[Symbols] Failed to create multiplier frame spine:', e);
            }

            // Create multiplier dove spine (pooled)
            try {
              const doveKey = 'multiplier_dove';
              const doveAtlasKey = `${doveKey}-atlas`;
              const doveSpine: any = acquireSpineFromPool(self, doveKey, doveAtlasKey);
              if (doveSpine) {
                try {
                  doveSpine.setOrigin(0.5, 0.5);
                  doveSpine.setDepth(999);
                    // Reset any residual state from the pool
                    try { self.scene.tweens.killTweensOf(doveSpine); } catch { }
                    doveSpine.setVisible(true);
                    doveSpine.setActive(true);
                    doveSpine.setAlpha(1);
                    doveSpine.setRotation(0);
                    doveSpine.setAngle(0);
                    doveSpine.setPosition(0, 0);
                    if (doveSpine.animationState) {
                      try { doveSpine.animationState.clearTracks(); } catch { }
                    }
                  multContainer.add(doveSpine);
                  if (doveSpine.animationState) {
                    doveSpine.animationState.setAnimation(0, `symbol10_WF`, true);

                    // Play spin sound effect
                    if ((window as any).audioManager) {
                      (window as any).audioManager.playOneShot(SoundEffectType.MULTI);
                      console.log('[Symbols] Playing multiplier sound effect');
                    }

                    // Pre‑compute path parameters so both dove and value image can share them
                    // First hop: exit diagonally toward the opposite side of the screen
                    const isOnLeftSide = col < numCols / 2;
                    // Push the exit point fully off-screen on the opposite side
                    leaveTargetX = isOnLeftSide
                      ? self.scene.scale.width * 1.2
                      : -self.scene.scale.width * 1.2;
                    leaveTargetY = -self.scene.scale.height * (Math.random() * 0.2 + 0.3);
                    const baseRandomLeaveDelayMs = (Math.random() * 300 + 120);
                    const staggerLeaveDelayMs = birdDepartureIndex * birdDepartureStaggerMs;
                    birdDepartureIndex += 1;
                    leaveDelay = (baseRandomLeaveDelayMs + staggerLeaveDelayMs) / speedMultiplier;
                    leaveDuration = 1250 / speedMultiplier;
                    const leaveFacingDirection = isOnLeftSide ? 1 : -1;
                    doveSpine.setScale(leaveFacingDirection * scale, scale);
                    scheduleTranslate(self, doveSpine, leaveDelay, leaveDuration, leaveTargetX, leaveTargetY);

                    // Second hop: re-enter from a random point above the screen, heading to the target
                    returnStartingX = Math.random() * self.scene.scale.width * 1.1 - self.scene.scale.width * 0.1;
                    returnStartingY = -self.scene.scale.height * (0.15 + Math.random() * 0.1);

                    returnTargetX = self.scene.scale.width * 0.68 + Math.random() * self.scene.scale.width * 0.07;
                    returnTargetY = self.scene.scale.height * 0.1;
                    const returnPause = (Math.random() * 250 + 150) / speedMultiplier;
                    returnDelay = leaveDelay + leaveDuration + returnPause;
                    returnDuration = (Math.random() * 400 + 600) / speedMultiplier;

                    // Ensure the awaited duration also covers the full leave + return tweens,
                    // including the final value-image drop/fade sequence that runs after the
                    // dove has reached its target.
                    //
                    //  - Outbound:  leaveDelay + leaveDuration
                    //  - Return:    returnDelay + returnDuration (where returnDelay already
                    //               includes leaveDelay + leaveDuration)
                    //  - Tail:      ~400ms for the drop (250ms) + fade (150ms, delayed by 250ms)
                    //
                    // We only care about when everything is visually finished, so use the
                    // actual tween timings (already turbo-adjusted above).
                    const tweenTailMs = 400 / speedMultiplier;
                    const extraDelayMs = 150 / speedMultiplier;
                    const totalTweenDurationMs = returnDelay + returnDuration + tweenTailMs + extraDelayMs;
                    if (totalTweenDurationMs > localMaxDurationMs) {
                      localMaxDurationMs = totalTweenDurationMs;
                    }

                    console.log('[Symbols] returnStartingX ', returnStartingX);
                    const preReturnRepositionMs = 50 / speedMultiplier;
                    self.scene.time.delayedCall(Math.max(0, returnDelay - preReturnRepositionMs), () => {
                      multContainer.remove(doveSpine);
                      doveSpine.animationState.setAnimation(0, `symbol10_WF`, true);
                      doveSpine.setPosition(returnStartingX, returnStartingY);

                      const returnFacingDirection = returnStartingX > returnTargetX ? 1 : -1;
                      doveSpine.setScale(returnFacingDirection * scale, scale);

                      // play multiplier_added_wf sound effect
                      if ((window as any).audioManager) {
                        (window as any).audioManager.playSoundEffect(SoundEffectType.MULTIPLIER_ADDED);
                        console.log('[Symbols] Playing multiplier_added_wf sound effect');
                      }

                      // Detach value image and place it under the dove before the return flight
                      if (valueImage) {
                        try {
                          multContainer.remove(valueImage);
                        } catch { }
                        try {
                          valueImage.setPosition(returnStartingX, returnStartingY + returnValueOffsetY);
                        } catch { }
                        // Start the value image return tween slightly after this callback,
                        // so it lines up with the dove's return tween start.
                        try {
                          scheduleTranslate(
                            self,
                            valueImage,
                            50 / speedMultiplier,
                            returnDuration,
                            returnTargetX,
                            returnTargetY + returnValueOffsetY,
                            true
                          );
                        } catch { }
                      }
                    });

                    const onComplete = () => {
                      // Final white-flash on dove, then drop and fade out the value image
                      doveSpine.animationState.setAnimation(0, `symbol10_WF_white`, true);

                      if (valueImage) {
                        try {
                          // Drop the value image by ~50px over 300ms
                          self.scene.tweens.add({
                            targets: valueImage,
                            y: valueImage.y + 20,
                            duration: 250 / speedMultiplier,
                            ease: Phaser.Math.Easing.Cubic.In,
                          });

                          // Fade out quickly while (or just after) dropping, then destroy
                          self.scene.tweens.add({
                            targets: valueImage,
                            alpha: 0,
                            duration: 150 / speedMultiplier,
                            delay: 250 / speedMultiplier,
                            ease: Phaser.Math.Easing.Quadratic.Out,
                            onComplete: () => {

                              // call event here to update multiplier value in normal or bonus header
                              const multiplierValue = self.multiplierIndexMapping[value];

                              gameEventManager.emit(GameEventType.UPDATE_MULTIPLIER_VALUE,
                                { multiplier: multiplierValue } as UpdateMultiplierValueEventData
                              );
                              try { valueImage.destroy(); } catch { }
                            }
                          });
                        } catch { }
                      }

                      self.scene.time.delayedCall(300 / speedMultiplier, () => {
                        try { releaseSpineToPool(self, doveSpine); } catch { }
                      });
                    };
                    scheduleTranslate(self, doveSpine, returnDelay, returnDuration, returnTargetX, returnTargetY, true, onComplete);

                    doveSpine.animationState.timeScale = timeScale;
                  }
                } catch { }
                updateDurationFromSpine(doveSpine, `symbol10_WF`);
              }
            } catch (e) {
              console.warn('[Symbols] Failed to create multiplier dove spine:', e);
            }

            // Create multiplier value sprite (image key derived from symbol value)
            try {
              // Symbol 10 is missing in documentation and backend so we start at 11 for multiplier indices
              // Map backend multiplier value (>=11) into the available sprite indices (multiplier_0..multiplier_14)
              let spriteIndex = Number(value) - 11;
              if (!Number.isFinite(spriteIndex) || spriteIndex < 0) spriteIndex = 0;

              const valueKey = `multiplier_${spriteIndex}`;
              valueImage = self.scene.add.image(0, 0, valueKey);
              if (valueImage) {
                try {
                  valueImage.setOrigin(0.5, 1);
                  valueImage.setPosition(55 * scale, 70 * scale);
                  valueImage.setScale(scale);
                  multContainer.add(valueImage);

                  // Make the value image follow the dove on the outbound flight
                  try {
                    scheduleTranslate(self, valueImage, leaveDelay, leaveDuration, leaveTargetX, leaveTargetY);
                  } catch { }
                } catch { }
              }
            } catch (e) {
              console.warn('[Symbols] Failed to create multiplier value sprite for value', value, e);
            }

            // Apply subtle scale and translate tweens to the whole multiplier container
            try { scheduleScaleUp(self, multContainer, 20 / speedMultiplier, 200 / speedMultiplier, 1.05); } catch { }
            try { scheduleTranslate(self, multContainer, 20 / speedMultiplier, 200 / speedMultiplier, 0, -3); } catch { }

            // Update global maximum duration
            if (localMaxDurationMs > maxDurationMs) {
              maxDurationMs = localMaxDurationMs;
            }
          }
        }
      }

      console.log(
        `[Symbols] Multiplier symbol timeScale set to ${timeScale} after tumbles (turbo=${isTurbo}), maxDurationMs=${maxDurationMs}`
      );

      // Wait until the (longest) multiplier animation finishes
      if (maxDurationMs > 0) {
        await delay(maxDurationMs);
      }
    }
  } catch (err) {
    console.warn('[Symbols] Failed to update multiplier symbol timeScale after tumbles:', err);
  }

  // Notify listeners that multiplier animations have completed
  try {
    gameEventManager.emit(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE);
  } catch (e) {
    console.warn('[Symbols] Failed to emit SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE:', e);
  }
}


/**
 * Play a sound effect when a tumble step is applied.
 * Uses turbo drop SFX when turbo is active, otherwise uses the regular reel drop SFX.
 */
function playTumbleSfx(self: Symbols): void {
  try {
    const audio = (window as any)?.audioManager;
    if (!audio || typeof audio.playSoundEffect !== 'function') {
      return;
    }

    const isTurbo = !!(self.scene?.gameData?.isTurbo || gameStateManager.isTurbo);
    let sfxType: SoundEffectType = SoundEffectType.TWIN1;
    switch (self.scene.gameAPI.getCurrentTumbleIndex() - 1) {
      case 0:
        sfxType = gameStateManager.isBonus ? SoundEffectType.TWINHEAVEN1 : SoundEffectType.TWIN1;
        break;
      case 1:
        sfxType = gameStateManager.isBonus ? SoundEffectType.TWINHEAVEN2 : SoundEffectType.TWIN2;
        break;
      case 2:
        sfxType = gameStateManager.isBonus ? SoundEffectType.TWINHEAVEN3 : SoundEffectType.TWIN3;
        break;
      default:
        sfxType = gameStateManager.isBonus ? SoundEffectType.TWINHEAVEN4 : SoundEffectType.TWIN4;
        break;
    }
    audio.playSoundEffect(sfxType);
    console.log('[Symbols] Playing tumble sound effect', { isTurbo, sfxType });
  } catch (e) {
    console.warn('[Symbols] Failed to play tumble SFX:', e);
  }
}

/**
 * Apply a sequence of tumble steps: remove "out" symbols, compress columns down, and drop "in" symbols from top.
 * Expects tumbles to be in the SpinData format: [{ symbols: { in: number[][], out: {symbol:number,count:number,win:number}[] }, win: number }, ...]
 */
async function applyTumbles(self: Symbols, tumbles: any[], mockData?: Data): Promise<void> {
  for (const tumble of tumbles) {
    await applySingleTumble(self, tumble);
    if (mockData) {
      synchronizeMockDataSymbols(self, mockData);
    }
  }

  // Notify listeners that all tumbles have completed
  try {
    gameEventManager.emit(GameEventType.SYMBOLS_TUMBLES_COMPLETE);
  } catch (e) {
    console.warn('[Symbols] Failed to emit SYMBOLS_TUMBLES_COMPLETE:', e);
  }
}

/**
 * Rebuild mock data symbols (column-major, bottom-up) from the current row-major symbol grid
 * so backend consumers (scatter detection, etc.) stay in sync with on-screen tumbles.
 */
function synchronizeMockDataSymbols(self: Symbols, mockData: Data): void {
  if (!mockData || !self.currentSymbolData || !self.currentSymbolData.length) {
    return;
  }

  const rowCount = self.currentSymbolData.length;
  const colCount = self.currentSymbolData[0]?.length ?? 0;
  if (colCount === 0) return;

  const rebuilt: number[][] = Array.from({ length: colCount }, () => Array<number>(rowCount).fill(0));

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const value = self.currentSymbolData[row]?.[col];
      const safeValue = typeof value === 'number' ? value : 0;
      const backendRowIndex = (rowCount - 1) - row; // backend arrays use bottom->top order
      rebuilt[col][backendRowIndex] = safeValue;
    }
  }

  mockData.symbols = rebuilt;
}

// Helper: Rebuild currentSymbolData after compression (extracted to avoid duplication)
function rebuildCurrentSymbolDataAfterCompression(self: Symbols, numCols: number, numRows: number): void {
  if (!self.currentSymbolData) return;
  const rebuilt: (number | null)[][] = Array.from({ length: numRows }, () => Array<number | null>(numCols).fill(null));
  for (let col = 0; col < numCols; col++) {
    const keptValues: number[] = [];
    for (let row = 0; row < numRows; row++) {
      const v = self.currentSymbolData[row]?.[col];
      if (typeof v === 'number') keptValues.push(v);
    }
    const bottomStart = numRows - keptValues.length;
    for (let i = 0; i < keptValues.length; i++) {
      const newRow = bottomStart + i;
      rebuilt[newRow][col] = keptValues[i];
    }
  }
  const finalized: number[][] = rebuilt.map(row => row.map(v => (typeof v === 'number' ? v : 0)));
  self.currentSymbolData = finalized;
}

// Helper: Create drop promise for a symbol (extracted to avoid duplication)
function createDropPromise(
  self: Symbols,
  created: any,
  col: number,
  targetY: number,
  sequenceIndex: number,
  MANUAL_STAGGER_MS: number,
  isOverlap: boolean,
  gameData: any
): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      // Tumble-only slowdown (requested): affect ONLY tumble "in" symbol drops.
      // 1.0 = unchanged, 1.5 = ~50% slower (longer), 2.0 = ~2x slower.
      const TUMBLE_DROP_TIME_MULTIPLIER = 1.5;
      const DROP_STAGGER_MS = (gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
      const computedStartDelay = (gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex);
      const skipPreHop = !!(gameData?.tumbleSkipPreHop);
      const symbolHop = (gameData?.winUpHeight ?? 0) * 0.5;

      const preHopDuration = (gameData?.winUpDuration ?? 1000) * TUMBLE_DROP_TIME_MULTIPLIER;
      const dropDurationBase = isOverlap
        ? ((gameData?.dropDuration ?? 1000) * 1.2)
        : ((gameData?.dropDuration ?? 1000) * 0.9);
      const dropDuration = dropDurationBase * TUMBLE_DROP_TIME_MULTIPLIER;
      const tweensArr: any[] = [];
      const handleLanding = () => {
        try {
          const mag = (gameData as any)?.dropShakeMagnitude ?? 0;
          const dur = Math.max(50, (gameData as any)?.dropShakeDurationMs ?? 120);
          if (mag > 0) {
            const axis = (gameData as any)?.dropShakeAxis ?? 'both';
            if (!gameStateManager.isTurbo) simulateCameraShake(self, getObjectsToShake(self), dur, mag, axis);
          }
        } catch { }
        try {
          if (!gameData?.isTurbo && (window as any).audioManager) {
            (window as any).audioManager.playSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_REEL_DROP : SoundEffectType.REEL_DROP);
          }
        } catch { }
        tryPlaySparkVFXForColumn(self, col, created);
        resolve();
      };
      if (!skipPreHop) {
        tweensArr.push({
          delay: computedStartDelay,
          y: `-= ${symbolHop}`,
          duration: preHopDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        });
        tweensArr.push({
          y: targetY,
          duration: dropDuration,
          ease: Phaser.Math.Easing.Linear,
          onComplete: handleLanding
        });
      } else {
        tweensArr.push({
          delay: computedStartDelay,
          y: targetY,
          duration: dropDuration,
          ease: Phaser.Math.Easing.Linear,
          onComplete: handleLanding
        });
      }
      self.scene.tweens.chain({ targets: created, tweens: tweensArr });
    } catch { resolve(); }
  });
}

async function applySingleTumble(self: Symbols, tumble: any): Promise<void> {
  self.dropSparkPlayedColumns.clear();
  const outs = (tumble?.symbols?.out || []) as Array<{ symbol: number; count: number }>;
  const ins = (tumble?.symbols?.in || []) as number[][]; // per real column (x index)

  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.warn('[Symbols] applySingleTumble: Symbols grid not initialized');
    return;
  }

  // Play an SFX to indicate that a tumble step is being applied
  playTumbleSfx(self);

  // Grid orientation: self.symbols[col][row]
  const numCols = self.symbols.length;
  const numRows = self.symbols[0].length;

  // Cache frequently accessed values for performance
  const gameData = self.scene?.gameData;
  const currentSymbolData = self.currentSymbolData;
  const MANUAL_STAGGER_MS: number = (gameData?.tumbleStaggerMs ?? 100);

  // Build / reuse a removal mask per cell
  // removeMask[col][row]
  if (!Array.isArray(self.tumbleRemoveMask)) {
    self.tumbleRemoveMask = [];
  }
  for (let col = 0; col < numCols; col++) {
    const colArr = self.tumbleRemoveMask[col] || (self.tumbleRemoveMask[col] = []);
    for (let row = 0; row < numRows; row++) {
      colArr[row] = false;
    }
    // Trim any stale rows from previous larger grids
    colArr.length = numRows;
  }
  // Trim any extra columns from previous larger grids
  self.tumbleRemoveMask.length = numCols;
  const removeMask: boolean[][] = self.tumbleRemoveMask;

  // Identify symbols that meet the high-count threshold (>=8)
  const highCountSymbols = new Set<number>();
  for (const out of outs) {
    const c = Number(out?.count || 0);
    const s = Number(out?.symbol);
    if (!isNaN(c) && !isNaN(s) && c >= 8) {
      highCountSymbols.add(s);
    }
  }

  // Build position indices by symbol (topmost-first per column)
  // Use Map for better performance than object with string keys
  const positionsBySymbol = new Map<number, Array<{ col: number; row: number }>>();
  let sequenceIndex = 0; // ensures 1-by-1 ordering across columns left-to-right
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      const val = currentSymbolData?.[row]?.[col];
      if (typeof val !== 'number') continue;
      let list = positionsBySymbol.get(val);
      if (!list) {
        list = [];
        positionsBySymbol.set(val, list);
      }
      list.push({ col, row });
    }
  }
  // Sort each symbol's positions top-to-bottom (row asc), then left-to-right (col asc)
  for (const list of positionsBySymbol.values()) {
    list.sort((a, b) => a.row - b.row || a.col - b.col);
  }

  // Determine per-column incoming counts
  const insCountByCol: number[] = Array.from({ length: numCols }, (_, c) => (Array.isArray(ins?.[c]) ? ins[c].length : 0));
  let targetRemovalsPerCol: number[] = insCountByCol.slice();

  // Helper to pick and mark a position for a symbol in a preferred column
  // Optimized: use index tracking instead of splice (O(n) -> O(1))
  const usedIndicesBySymbol = new Map<number, Set<number>>();
  function pickAndMark(symbol: number, preferredCol: number | null): boolean {
    const list = positionsBySymbol.get(symbol);
    if (!list) return false;
    let usedIndices = usedIndicesBySymbol.get(symbol);
    if (!usedIndices) {
      usedIndices = new Set<number>();
      usedIndicesBySymbol.set(symbol, usedIndices);
    }
    for (let i = 0; i < list.length; i++) {
      if (usedIndices.has(i)) continue; // already used
      const p = list[i];
      if (removeMask[p.col][p.row]) continue; // already marked
      if (preferredCol !== null && p.col !== preferredCol) continue;
      removeMask[p.col][p.row] = true;
      usedIndices.add(i); // Mark as used instead of removing
      return true;
    }
    return false;
  }

  // First pass: satisfy per-column targets using outs composition
  for (const out of outs) {
    let remaining = Number(out?.count || 0);
    const targetSymbol = Number(out?.symbol);
    if (isNaN(remaining) || isNaN(targetSymbol) || remaining <= 0) continue;
    // Try to allocate removals in columns that expect incoming symbols first
    while (remaining > 0) {
      let allocated = false;
      for (let col = 0; col < numCols && remaining > 0; col++) {
        if (targetRemovalsPerCol[col] <= 0) continue;
        if (pickAndMark(targetSymbol, col)) {
          targetRemovalsPerCol[col]--;
          remaining--;
          allocated = true;
        }
      }
      if (!allocated) break; // proceed to second pass
    }
    // Second pass: allocate any remainder anywhere
    while (remaining > 0) {
      if (pickAndMark(targetSymbol, null)) {
        remaining--;
      } else {
        console.warn('[Symbols] Not enough matching symbols in grid to satisfy tumble outs for symbol', targetSymbol);
        break;
      }
    }
  }

  // Debug: per-column removal vs incoming (gated behind debug flag)
  if (DEBUG_SYMBOLS_TUMBLES) {
    try {
      const removedPerCol: number[] = Array.from({ length: numCols }, () => 0);
      for (let col = 0; col < numCols; col++) {
        for (let row = 0; row < numRows; row++) {
          if (removeMask[col][row]) removedPerCol[col]++;
        }
      }
      console.log('[Symbols] Tumble removedPerCol:', removedPerCol, 'insCountByCol:', insCountByCol);
    } catch { }

    // Debug: report which cells are marked for removal per symbol
    try {
      const removedBySymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
      let totalRemoved = 0;
      for (let col = 0; col < numCols; col++) {
        for (let row = 0; row < numRows; row++) {
          if (removeMask[col][row]) {
            const val = currentSymbolData?.[row]?.[col];
            const key = typeof val === 'number' ? val : -1;
            if (!removedBySymbol[key]) removedBySymbol[key] = [];
            removedBySymbol[key].push({ col, row });
            totalRemoved++;
          }
        }
      }
      console.log('[Symbols] Tumble removal mask summary:', { totalRemoved, removedBySymbol });
    } catch { }
  }

  // Animate removal: for high-count sugar symbols (1..9), play SW_Win before destroy; otherwise fade out
  const removalPromises: Promise<void>[] = [];
  const STAGGER_MS = 50; // match drop sequence stagger (shortened)

  try { self.showWinningOverlay(); } catch { }

  // Track unique winning symbols and their positions for win amount popup
  const uniqueWinningSymbols = new Map<number, Array<{ x: number; y: number; isEdge: boolean }>>();

  const trackWinningSymbolPosition = (symbolValue: number, x: number, y: number, col: number, row: number) => {
    try {
      const isEdge = col === 0 || col === numCols - 1 || row === 0 || row === numRows - 1;
      if (!uniqueWinningSymbols.has(symbolValue)) {
        uniqueWinningSymbols.set(symbolValue, []);
      }
      uniqueWinningSymbols.get(symbolValue)!.push({ x, y, isEdge });
    } catch { }
  };

  const clearSymbolSlot = (col: number, row: number) => {
    self.symbols[col][row] = null as any;
    if (self.currentSymbolData && self.currentSymbolData[row]) {
      (self.currentSymbolData[row] as any)[col] = null;
    }
  };

  const destroySymbolSafe = (obj: any) => {
    try { self.scene.tweens.killTweensOf(obj); } catch { }
    try { obj.destroy(); } catch { }
  };

  const playFallbackTweenOnSymbol = (obj: any, col: number, row: number, vNum: number, resolve: () => void) => {
    const x = obj.x;
    const y = obj.y;

    try { self.moveSymbolToFront(obj); } catch { }
    try { scheduleScaleUp(self, obj, 100, 500, 1.1); } catch { }
    try { scheduleScaleUp(self, obj, 700, 200, 0); } catch { }
    try {
      scheduleTranslate(self, obj, 400, 500, 0, -3, false, () => {
        destroySymbolSafe(obj);
        clearSymbolSlot(col, row);
        trackWinningSymbolPosition(vNum, x, y, col, row);
        resolve();
      });
    } catch {
      destroySymbolSafe(obj);
      clearSymbolSlot(col, row);
      resolve();
    }
  };

  const playSpineWinEffect = (obj: any, col: number, row: number, vNum: number, resolve: () => void) => {
    const isHighPaying = vNum >= 1 && vNum <= 5;
    const spineKey = `Symbol_${isHighPaying ? 'HP' : 'LP'}_WF`;
    const spineAtlasKey = `${spineKey}-atlas`;
    const x = obj.x;
    const y = obj.y;

    try {
      const fx = acquireSpineFromPool(self, spineKey, spineAtlasKey);
      if (!fx) {
        playFallbackTweenOnSymbol(obj, col, row, vNum, resolve);
        return;
      }

      let animationCanPlay = false;
      let animationDuration = 1000;
      let completed = false;

      try {
        fx.setPosition(x, y);
        fx.setVisible(true);
        fx.setActive(true);
        fx.setOrigin(0.5, 0.5);
      } catch { }

      try {
        fx.setScale(self.getSpineSymbolScale(vNum));
      } catch { }

      try {
        const animationName = isHighPaying ? `symbol${vNum}_WF_win` : `symbol${vNum}_WF`;
        console.log('[Symbols] Playing animation:', animationName);
        if (fx.animationState && fx.animationState.setAnimation) {
          const entry: any = fx.animationState.setAnimation(0, animationName, false);
          animationCanPlay = !!entry;
          try {
            fx.animationState.timeScale = gameData?.isTurbo
              ? self.getSymbolWinTimeScale(vNum) * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
              : self.getSymbolWinTimeScale(vNum);
          } catch { }
          try {
            const dur = fx.skeleton?.data?.findAnimation?.(animationName)?.duration;
            animationDuration = (typeof dur === 'number' ? dur : 0.798) * 1000 * (fx.animationState.timeScale || 1);
          } catch {
            animationDuration = 1000 * (fx.animationState.timeScale || 1);
          }

          const onDone = () => {
            console.log('[Symbols] Animation complete (track/state listener)');
            if (completed) return; completed = true;
            try { releaseSpineToPool(self, fx); } catch { }
            resolve();
          };

          try {
            if (entry && (entry.setListener || 'listener' in entry)) {
              if (typeof entry.setListener === 'function') {
                entry.setListener({ complete: onDone, end: onDone });
              } else {
                (entry as any).listener = { complete: onDone, end: onDone };
              }
            }
          } catch { }
          try {
            if (fx.animationState && fx.animationState.addListener) {
              fx.animationState.addListener({ complete: onDone, end: onDone } as any);
            }
          } catch { }
        }
      } catch {
        animationCanPlay = false;
      }

      if (!animationCanPlay) {
        try { releaseSpineToPool(self, fx); } catch { }
        playFallbackTweenOnSymbol(obj, col, row, vNum, resolve);
        return;
      }

      destroySymbolSafe(obj);
      clearSymbolSlot(col, row);

      try {
        const audio = (window as any)?.audioManager;
        if (audio && typeof audio.playSingleInstanceSoundEffect === 'function') {
          const delay = 700 / (gameStateManager.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1);
          self.scene.time.delayedCall(delay, () => {
            audio.playSingleInstanceSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_EXPLOSION : SoundEffectType.EXPLOSION);
            console.log('[Symbols] Playing explosion SFX');
          });
        }
      } catch { }

      try { self.moveSymbolToFront(fx); } catch { }
      try { scheduleScaleUp(self, fx, 20, 200, 1.05); } catch { }
      try { scheduleTranslate(self, fx, 20, 200, 0, -3); } catch { }
      trackWinningSymbolPosition(vNum, x, y, col, row);

      console.log('[Symbols] Animation duration:', animationDuration);
      self.scene.time.delayedCall(Math.max(animationDuration, (gameData?.winUpDuration ?? 0) + animationDuration), () => {
        if (completed) return; completed = true;
        try { releaseSpineToPool(self, fx); } catch { }
        resolve();
      });
    } catch {
      playFallbackTweenOnSymbol(obj, col, row, vNum, resolve);
    }
  };

  const playFadeOutRemoval = (obj: any, col: number, row: number, resolve: () => void) => {
    try { self.scene.tweens.killTweensOf(obj); } catch { }
    self.scene.tweens.add({
      targets: obj,
      alpha: 0,
      duration: gameData?.winUpDuration ?? 1000,
      ease: Phaser.Math.Easing.Cubic.In,
      onComplete: () => {
        try { obj.destroy(); } catch { }
        clearSymbolSlot(col, row);
        resolve();
      }
    });
  };

  const createRemovalPromise = (col: number, row: number, obj: any) => new Promise<void>((resolve) => {
    try {
      const value = currentSymbolData?.[row]?.[col];
      const vNum = Number(value);
      const isIndex1to9 = Number.isFinite(vNum) && vNum >= 1 && vNum <= 9;

      if (isIndex1to9) {
        playSpineWinEffect(obj, col, row, vNum, resolve);
      } else {
        playFadeOutRemoval(obj, col, row, resolve);
      }
    } catch {
      try { obj.destroy(); } catch { }
      clearSymbolSlot(col, row);
      console.log('[Symbols] Animation complete (fallback)');
      resolve();
    }
  });

  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      if (!removeMask[col][row]) continue;
      const obj = self.symbols[col][row];
      if (obj) {
        removalPromises.push(createRemovalPromise(col, row, obj));
      } else {
        clearSymbolSlot(col, row);
        console.log('[Symbols] Animation complete (no object)');
      }
    }
  }

  // Schedule win amount popup once per unique winning symbol, preferring non-edge positions
  // Pre-build win amount map for O(1) lookup instead of O(n*m) nested loops
  const winAmountBySymbol = new Map<number, number>();
  const tumbles = gameStateManager.isBonus
    ? self.currentSpinData?.slot?.freespin?.items[self.scene.gameAPI.getCurrentFreeSpinIndex() - 1]?.tumble
    : self.currentSpinData?.slot?.tumbles;
  if (tumbles && Array.isArray(tumbles.items)) {
    for (const tumbleItem of tumbles.items) {
      if (tumbleItem.symbols?.out) {
        for (const out of tumbleItem.symbols.out) {
          if (typeof out.symbol === 'number' && typeof out.win === 'number') {
            winAmountBySymbol.set(out.symbol, out.win);
          }
        }
      }
    }
  }

  for (const [symbolValue, positions] of uniqueWinningSymbols.entries()) {
    try {
      // Prefer non-edge positions, fallback to edge positions
      const nonEdgePositions = positions.filter(p => !p.isEdge);
      const positionsToChooseFrom = nonEdgePositions.length > 0 ? nonEdgePositions : positions;
      const randomIndex = Math.floor(Math.random() * positionsToChooseFrom.length);
      const selectedPosition = positionsToChooseFrom[randomIndex];

      // Use pre-built map for O(1) lookup
      const displayAmount = winAmountBySymbol.get(symbolValue) || 0;

      const delayMs = 750 / (gameData?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1);
      const durationMs = 1000;
      scheduleWinAmountPopup(self, selectedPosition.x, selectedPosition.y, displayAmount, delayMs, durationMs);
    } catch { }
  }

  await Promise.all(removalPromises);

  try { self.hideWinningOverlay(); } catch { }

  // Compress each column downwards and compute target indices for remaining symbols
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  // Prepare a new grid to place references post-compression
  const newGrid: any[][] = Array.from({ length: numCols }, () => Array<any>(numRows).fill(null));
  const compressPromises: Promise<void>[] = [];

  for (let col = 0; col < numCols; col++) {
    const kept: Array<{ obj: any, oldRow: number }> = [];
    for (let row = 0; row < numRows; row++) {
      const obj = self.symbols[col][row];
      if (obj) kept.push({ obj, oldRow: row });
    }
    const bottomStart = numRows - kept.length; // first row index for packed symbols at bottom
    kept.forEach((entry, idx) => {
      const obj = entry.obj;
      const oldRow = entry.oldRow;
      const newRow = bottomStart + idx;
      const targetY = startY + newRow * symbolTotalHeight + symbolTotalHeight * 0.5;
      newGrid[col][newRow] = obj;
      const needsMove = newRow !== oldRow;
      if (!needsMove) {
        // No movement needed; ensure y is correct and resolve immediately
        try { if (typeof obj.setY === 'function') obj.setY(targetY); } catch { }
        return; // no promise push to avoid waiting on a non-existent tween
      }
      compressPromises.push(new Promise<void>((resolve) => {
        try {
          self.scene.tweens.add({
            targets: obj,
            y: targetY,
            delay: STAGGER_MS * col * (gameData?.compressionDelayMultiplier ?? 1),
            duration: (gameData?.dropDuration ?? 1000) / 2,
            // ease: Phaser.Math.Easing.Bounce.Out,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => resolve(),
          });
        } catch { resolve(); }
      }));
    });
  }

  // Overlap-aware drop scheduling: if enabled, start drops during compression; otherwise, drop after compression completes
  const overlapDrops = !!(gameData?.tumbleOverlapDropsDuringCompression);
  const dropPromises: Promise<void>[] = [];
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const startX = self.slotX - self.totalGridWidth * 0.5;
  let totalSpawned = 0;

  if (overlapDrops) {
    // Replace grid immediately so top nulls represent empty slots while compression runs
    self.symbols = newGrid;
    // Rebuild currentSymbolData to reflect compressed positions now
    try {
      rebuildCurrentSymbolDataAfterCompression(self, numCols, numRows);
    } catch { }

    // Start drops now, while compression tweens are in-flight
    for (let col = 0; col < numCols; col++) {
      const incoming = Array.isArray(ins?.[col]) ? ins[col] : [];
      if (incoming.length === 0) continue;

      let emptyCount = 0;
      for (let row = 0; row < numRows; row++) {
        if (!self.symbols[col][row]) emptyCount++;
        else break;
      }
      const spawnCount = Math.min(emptyCount, incoming.length);
      console.log(`[Symbols] (overlap) Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      for (let j = 0; j < spawnCount; j++) {
        const targetRow = Math.max(0, emptyCount - 1 - j);
        const targetY = startY + targetRow * symbolTotalHeight + symbolTotalHeight * 0.5;
        const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;

        const srcIndex = Math.max(0, incoming.length - 1 - j);
        const value = incoming[srcIndex];
        const topOfGridCenterY = startY + symbolTotalHeight * 0.5;
        const startYPos = topOfGridCenterY - self.scene.scale.height + (j * symbolTotalHeight);
        const created: any = createSpineOrPngSymbol(self, value, xPos, startYPos, 1);

        self.symbols[col][targetRow] = created;
        if (self.currentSymbolData && self.currentSymbolData[targetRow]) {
          (self.currentSymbolData[targetRow] as any)[col] = value;
        }

        try { playDropAnimationIfAvailable(created); } catch { }

        dropPromises.push(createDropPromise(self, created, col, targetY, sequenceIndex, MANUAL_STAGGER_MS, true, gameData));
        sequenceIndex++;
        totalSpawned++;
      }
    }

    // Wait for both compression and drop to finish
    await Promise.all([...compressPromises, ...dropPromises]);
  } else {
    // Default behavior: wait compression, then set grid and drop
    await Promise.all(compressPromises);
    self.symbols = newGrid;
    try {
      rebuildCurrentSymbolDataAfterCompression(self, numCols, numRows);
    } catch { }

    for (let col = 0; col < numCols; col++) {
      const incoming = Array.isArray(ins?.[col]) ? ins[col] : [];
      if (incoming.length === 0) continue;
      let emptyCount = 0;
      for (let row = 0; row < numRows; row++) {
        if (!self.symbols[col][row]) emptyCount++;
        else break;
      }
      const spawnCount = Math.min(emptyCount, incoming.length);
      console.log(`[Symbols] Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      for (let j = 0; j < spawnCount; j++) {
        const targetRow = Math.max(0, emptyCount - 1 - j);
        const targetY = startY + targetRow * symbolTotalHeight + symbolTotalHeight * 0.5;
        const xPos = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
        const srcIndex = Math.max(0, incoming.length - 1 - j);
        const value = incoming[srcIndex];
        const topOfGridCenterY = startY + symbolTotalHeight * 0.5;
        const startYPos = topOfGridCenterY - self.scene.scale.height + (j * symbolTotalHeight);
        const created: any = createSpineOrPngSymbol(self, value, xPos, startYPos, 1);
        self.symbols[col][targetRow] = created;
        if (self.currentSymbolData && self.currentSymbolData[targetRow]) {
          (self.currentSymbolData[targetRow] as any)[col] = value;
        }
        try { playDropAnimationIfAvailable(created); } catch { }
        dropPromises.push(createDropPromise(self, created, col, targetY, sequenceIndex, MANUAL_STAGGER_MS, false, gameData));
        sequenceIndex++;
        totalSpawned++;
      }
    }
    await Promise.all(dropPromises);
  }

  // Debug: validate totals between outs and ins after spawn
  try {
    const totalOutRequested = outs.reduce((s, o) => s + (Number(o?.count) || 0), 0);
    if (totalOutRequested !== totalSpawned) {
      console.warn('[Symbols] Tumble total mismatch: out.count sum != spawned', {
        totalOutRequested,
        totalSpawned
      });
    } else {
      console.log('[Symbols] Tumble totals OK: removed == spawned', { totalSpawned });
    }
  } catch { }

  // Re-evaluate wins after each tumble drop completes (async so visuals continue)
  try { reevaluateWinsFromGrid(self); } catch { }
}


function replaceWithSpineAnimations(self: Symbols, data: Data) {
  const wins = data.wins;

  // Safety check: only proceed if wins exist and have the expected structure
  if (!wins || !wins.allMatching || wins.allMatching.size === 0) {
    console.log('[Symbols] No wins to process, skipping Spine animation replacement');
    return;
  }

  // Safety check: ensure symbols array exists and has the expected dimensions
  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.log('[Symbols] Symbols array not properly initialized, skipping Spine animation replacement');
    return;
  }

  console.log(`[Symbols] Processing ${wins.allMatching.size} winning patterns for Spine animations`);
  console.log(`[Symbols] Current symbols array dimensions: ${self.symbols.length} columns x ${self.symbols[0].length} rows`);

  // Determine if any winning symbol is a wildcard and prepare SFX selection
  let hasWildcardInWin = false;
  try {
    const wildcardSet = new Set<number>(WILDCARD_SYMBOLS);
    for (const win of wins.allMatching.values()) {
      for (const grid of win) {
        const valueAtGrid = data.symbols?.[grid.y]?.[grid.x];
        if (typeof valueAtGrid === 'number' && wildcardSet.has(valueAtGrid)) {
          hasWildcardInWin = true;
          break;
        }
      }
      if (hasWildcardInWin) break;
    }
  } catch { }

  // Ensure we only play the win SFX once per win animation start
  let hasPlayedWinSfx = false;

  for (const win of wins.allMatching.values()) {
    for (const grid of win) {
      // Safety check: ensure grid coordinates are within bounds
      if (grid.y < 0 || grid.y >= self.symbols.length || grid.x < 0 || grid.x >= self.symbols[0].length) {
        console.warn(`[Symbols] Grid coordinates (${grid.x}, ${grid.y}) out of bounds for symbols array [${self.symbols.length}][${self.symbols[0].length}], skipping`);
        continue;
      }

      const currentSymbol = self.symbols[grid.y][grid.x];

      if (currentSymbol) {
        // Get the symbol value and construct the Spine key
        const symbolValue = data.symbols[grid.y][grid.x];

        // For symbol 0 and symbols 10–21, keep PNGs: do not replace with Spine
        if (typeof symbolValue === 'number' && (symbolValue === 0 || (symbolValue >= 10 && symbolValue <= 21))) {
          continue;
        }


        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';

        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;

        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);

          // Remove the current sprite
          currentSymbol.destroy();

          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          try { (spineSymbol as any).symbolValue = symbolValue; } catch { }
          spineSymbol.setOrigin(0.5, 0.5);

          // Use configured scale for this specific symbol
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          spineSymbol.setScale(configuredScale);
          console.log(`[Symbols] Applied scale ${configuredScale} to symbol ${symbolValue}`);

          // Play the win animation for matched symbols
          try {
            const animationName = (symbolValue >= 1 && symbolValue <= 5) ? `symbol${symbolValue}_WF_win` : `symbol${symbolValue}_WF`;
            if (spineSymbol.animationState && spineSymbol.animationState.setAnimation) {
              spineSymbol.animationState.setAnimation(0, animationName, false);
              // Apply configured time scale (accounting for turbo mode)
              const isTurbo = self.scene.gameData?.isTurbo || gameStateManager.isTurbo;
              const timeScale = isTurbo
                ? self.getSymbolWinTimeScale(symbolValue) * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
                : self.getSymbolWinTimeScale(symbolValue);
              try { spineSymbol.animationState.timeScale = timeScale; } catch { }
              console.log(`[Symbols] Playing win animation: ${animationName} with timeScale: ${timeScale}`);
            }
          } catch (error) {
            console.warn(`[Symbols] Failed to set win animation for symbol ${symbolValue}:`, error);
          }

          scheduleScaleUp(self, spineSymbol, 500);

          // Play win SFX once when winning symbol animations start
          try {
            if (!hasPlayedWinSfx) {
              const audio = (window as any)?.audioManager;
              if (audio && typeof audio.playSoundEffect === 'function') {
                // Use MULTI when a wildcard is present in the win, otherwise use the standard hit win SFX
                const sfx = hasWildcardInWin ? SoundEffectType.MULTI : SoundEffectType.HIT_WIN_ALT;
                audio.playSoundEffect(sfx);
                hasPlayedWinSfx = true;
                // If this spin triggered scatter, chain play scatter after the hit/multi SFX
                try {
                  if (gameStateManager.isScatter) {
                    // short chain delay to ensure ordering
                    this.scene.time.delayedCall(100, () => {
                      try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch { }
                    });
                  }
                } catch { }
              }
            }
          } catch { }

          // Add to container and update reference
          self.container.add(spineSymbol);
          self.symbols[grid.y][grid.x] = spineSymbol;

          console.log(`[Symbols] Successfully replaced sprite with Spine animation at (${grid.x}, ${grid.y})`);

        } catch (error) {
          console.warn(`[Symbols] Failed to replace sprite with Spine animation at (${grid.x}, ${grid.y}):`, error);

          // Clear animation fallback: recreate a static symbol without pulsing/tint effects
          try {
            const recreated = createSpineOrPngSymbol(self, symbolValue, x, y, 1);
            self.symbols[grid.y][grid.x] = recreated;
            if (self.container) {
              self.container.add(recreated);
            }
          } catch { }
        }
      }
    }
  }
}

function createMultiplierSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  // Multiplier symbols prefer a Spine representation with timeScale = 0 (frozen pose)
  // to keep a rich visual while avoiding continuous animation cost. If the Spine
  // asset or pool is not available, gracefully fall back to a PNG symbol.
  const adjustedIndex = value - 1;

  // Use the pooled multiplier frame Spine (defined in AssetConfig / symbol assets)
  const spineKey = 'multiplier_WF';
  const atlasKey = `${spineKey}-atlas`;

  let spine: SpineGameObject | null = null;
  try {
    spine = acquireSpineFromPool(self, spineKey, atlasKey);
  } catch (e) {
    console.warn('[Symbols] Failed to acquire pooled multiplier Spine, falling back to PNG:', e);
  }

  // Fallback: if Spine could not be acquired/created, use the existing PNG path
  if (!spine) {
    return createPngSymbol(self, adjustedIndex, x, y, alpha);
  }

  try {
    // Configure basic transform
    const origin = self.getSpineSymbolOrigin(adjustedIndex);
    const scale = self.getSpineSymbolScale(adjustedIndex);

    spine.setOrigin(origin.x, origin.y);
    spine.setScale(scale);
    spine.setPosition(x, y);

    try {
      spine.setVisible(true);
      spine.setActive(true);
      spine.setAlpha(alpha);
    } catch { }

    // Tag with symbol value for any downstream logic (tumbles, effects, etc.)
    try { (spine as any).symbolValue = adjustedIndex; } catch { }

    // Ensure the multiplier Spine lives inside the main symbols container
    try {
      if (self.container && spine.parentContainer !== self.container) {
        self.container.add(spine);
      }
    } catch { }

    // Set an appropriate animation for this multiplier and freeze it
    try {
      const state = spine.animationState;
      if (state) {
        // Animation names follow the `symbol{value}_WF` convention used elsewhere
        const animName = `symbol${adjustedIndex}_WF`;
        try {
          state.setAnimation(0, animName, true);
        } catch {
          // If specific animation is missing, fall back to the first available one
          try {
            const firstAnimName = spine.skeleton?.data?.animations?.[0]?.name;
            if (firstAnimName) {
              state.setAnimation(0, firstAnimName, true);
            }
          } catch { }
        }
        // Freeze animation playback as requested
        state.timeScale = 0;
      }
    } catch { }

    return spine;
  } catch (configureError) {
    console.warn('[Symbols] Failed to configure multiplier Spine, falling back to PNG:', configureError);
    try { releaseSpineToPool(self, spine as any); } catch { }
    return createPngSymbol(self, adjustedIndex, x, y, alpha);
  }
}

/**
 * Calculate total win using SpinData (base paylines or all free spins)
 */
function calculateTotalWinFromPaylines(spinData: SpinData): number {
  if (!spinData) {
    return 0;
  }

  const totalWin = SpinDataUtils.getAggregateTotalWin(spinData);
  console.log(`[Symbols] Calculated aggregate total win from SpinData: ${totalWin}`);
  return totalWin;
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

// Add method to reset symbols visibility
function resetSymbolsVisibility(self: Symbols): void {
  if (self.container) {
    self.container.setAlpha(1);
  }
}
