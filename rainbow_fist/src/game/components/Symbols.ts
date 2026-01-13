import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS, WILDCARD_SYMBOLS, SCATTER_MULTIPLIERS } from '../../config/GameConfig';
import { AudioManager, SoundEffectType } from '../../managers/AudioManager';
import { Dialogs } from "./Dialogs";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import {
  AUTO_SPIN_START_DELAY
} from "../../config/GameConfig";
import { hideSpineAttachmentsByKeywords, playSpineAnimationSequence, playSpineAnimationSequenceWithConfig, getSpineAnimationDurationMs } from "./SpineBehaviorHelper";
import { NumberDisplay, NumberDisplayConfig } from "./NumberDisplay";
import { SpinData, SpinDataUtils } from "../../backend/SpinData";
import regularScatterData from "../spinDataScenarios/regular_scatter.json";
import endRetriggerData from "../spinDataScenarios/end_retrigger.json";
import untriggeredRetriggerData from "../spinDataScenarios/untriggered_retrigger.json";
import end_retrigger_v2 from "../spinDataScenarios/end_retrigger_v2.json";



// Debug flags for verbose tumble logging / diagnostics
const DEBUG_SYMBOLS_TUMBLES = false;
// Debug gate for verbose Symbols logging (especially inside loops).
// Runtime override: set `window.__DEBUG_SYMBOLS_LOGS__ = true` in DevTools.
const DEBUG_SYMBOLS_LOGS = false;

function isSymbolsVerboseLoggingEnabled(): boolean {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  // Respect global debug kill-switch used elsewhere in the project.
  if (w && w.__DEBUGGING_ON__ === false) return false;
  return DEBUG_SYMBOLS_LOGS || (w && w.__DEBUG_SYMBOLS_LOGS__ === true);
}

export class Symbols {
  // DEBUGGING
  public showWireframes: boolean = false; // Toggle to show/hide wireframe boxes
  public showMaskWireframe: boolean = false; // Toggle to show/hide mask wireframe

  /**
   * True while a reel drop/tumble sequence is actively animating.
   * Used to prevent "cleanup" routines (often triggered by dialogs/transitions) from killing in-flight drop tweens.
   */
  public isReelDropping: boolean = false;

  public wireframeBoxes: Phaser.GameObjects.Graphics[] = [];
  public maskWireframe?: Phaser.GameObjects.Graphics;


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
  public scatterTransposedBuffer: number[][] = [];
  public scatterDataBuffer: Data | null = null;
  private overlayRect?: Phaser.GameObjects.Graphics;
  public currentSpinData: any = null; // Store current spin data for access by other components
  private dialogs: Dialogs;
  public dropSparkPlayedColumns: Set<number> = new Set();
  // Turbo drop SFX guard to ensure we only fire once per spin.
  public turboDropSfxPlayedThisSpin: boolean = false;
  public sparkVFXPool: SpineGameObject[] = [];
  public symbolSpritePool: GameObjects.Sprite[] = [];
  public spinePools: { [key: string]: SpineGameObject[] } = {};
  // Multiplier symbols are discovered via scanning the current grid when needed (no caching).
  public tumbleRemoveMask: boolean[][] = [];

  private symbolSpineKey: string = 'Symbol_WF';
  private symbolPngKey: string = 'symbol_';
  private symbolSpineAtlasKey: string = 'Symbol_WF-atlas';
  public static readonly SCATTER_SPINE_KEY: string = 'symbol0_spine';
  public static readonly SCATTER_HIT_ANIMATION_NAME: string = 'Symbol0_RF_win';
  public static readonly MULTIPLIER_SPINE_KEY: string = 'multiplier_spine';

  public static readonly MULTIPLIER_ANIMATION_TIME_SCALE: number = 0.5;
  public static readonly MULTIPLIER_FRONT_DEPTH: number = 650;

  public readonly baseSymbolWidth: number = 70;
  public readonly baseSymbolHeight: number = 70;

  public gridOffsetX: number = 2;
  public gridOffsetY: number = -40;
  public baseCenterX: number = 0;
  public baseCenterY: number = 0;

  public maskPadding: { left: number, right: number, top: number, bottom: number } = { left: 14, right: 14, top: 54, bottom: 7 };

  private symbolWinTimeScales: { [key: number]: number } = {
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
    7: 1,
    8: 1,
    9: 1,
    10: 1,
  }

  private multiplierAnimationMapping: { [key: number]: string } = {
    11: '2x',
    12: '3x',
    13: '4x',
    14: '5x',
    15: '6x',
    16: '8x',
    17: '10x',
    18: '12x',
    19: '15x',
    20: '20x',
    21: '25x',
    22: '50x',
    23: '100x',
    24: '250x',
    25: '500x',
  }

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

  public static readonly SPINE_SYMBOL_ORIGINS: { [key: number]: { x: number, y: number } } =
    {
      0: { x: 0.47, y: 0.5 },
      1: { x: 0.46, y: 0.6 },
      2: { x: 0.5, y: 0.5 },
      3: { x: 0.5, y: 0.5 },
      4: { x: 0.5, y: 0.55 },
      5: { x: 0.5, y: 0.5 },
      6: { x: 0.5, y: 0.5 },
      7: { x: 0.5, y: 0.5 },
      8: { x: 0.5, y: 0.5 },
      9: { x: 0.5, y: 0.5 },
      10: { x: 0.5, y: 0.6 },
    }

  // Configuration for Spine symbol scales - adjust these values manually
  public static readonly SPINE_SYMBOL_SCALES: { [key: number]: number } = {
    0: 0.045,   // Symbol0_RF scale (scatter)
    1: 0.51,  // Symbol1_RF scale (HP)
    2: 0.054,  // Symbol2_RF scale (HP)
    3: 0.045,  // Symbol3_RF scale (HP)
    4: 0.041,  // Symbol4_RF scale (HP)
    5: 0.1,  // Symbol5_RF scale (LP)
    6: 0.1,  // Symbol6_RF scale (LP)
    7: 0.1,  // Symbol7_RF scale (LP)
    8: 0.1,  // Symbol8_RF scale (LP)
    9: 0.1,  // Symbol9_RF scale (LP)
    10: 0.055,  // Symbol10_RF scale (multiplier)
  };

  /**
   * Scatter (value 0) is rendered as a PNG on the reels (Spine is only used for the big center hit).
   * Use a multiplier here to make the Scatter PNG visually larger than the standard symbol box.
   */
  public static readonly SCATTER_PNG_SCALE_MULTIPLIER: number = 1.25;

  /**
   * When scaling Scatter up, optionally offset it to keep it visually aligned inside the symbol box.
   * Default behavior: keep the *bottom* of the sprite aligned (shift up as it scales up).
   * - 0.0 = no auto-offset
   * - 1.0 = full bottom alignment correction
   */
  public static readonly SCATTER_PNG_BOTTOM_ALIGN_FACTOR: number = 0.5;

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
    // Start staggered prewarm asynchronously so scene setup is not blocked.
    void schedulePrewarmAsync(this);
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
      // Reset symbol depths
      this.resetSymbolDepths();
      // Restore symbol visibility for new spin
      this.restoreSymbolVisibility();
    });

    // WIN_START/WIN_STOP disabled

    // Listen for win dialog close
    gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
      console.log('[Symbols] WIN_DIALOG_CLOSED event received');
      // Reset dialog showing flag
      gameStateManager.isShowingWinDialog = false;

      // If bonus just finished, immediately show congrats and reset flag
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] isBonusFinished is true on WIN_DIALOG_CLOSED - showing congrats now');
        // Show congrats now and reset the flag; bonus mode exit happens on congrats close
        this.showCongratsDialogAfterDelay(4000 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1));
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
      // IMPORTANT: Do not kill active tweens here. Dialogs can close while reel drop tweens
      // are still running (especially around bonus transitions / large win dialogs). Killing
      // tweens mid-chain leaves symbols stuck partway through their drop.
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
      if (this.isReelDropping) {
        console.log('[Symbols] Skipping stopAllSymbolAnimations because reel drop is in progress');
      } else {
        this.stopAllSymbolAnimations();
      }

      // Restore all symbols to visible state
      this.restoreSymbolVisibility();

      // Specifically ensure scatter symbols are visible
      this.ensureScatterSymbolsVisible();

      // After the scatter hit sequence finishes, tween all gathered scatters back to their start positions
      try {
        this.tweenGatheredScatterSymbolsBackToStart();
      } catch (error) {
        console.warn('[Symbols] Failed to tween scatter symbols back to start:', error);
      }

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
    symbolValue = Math.min(symbolValue, Object.keys(Symbols.SPINE_SYMBOL_SCALES).length - 1);

    return Symbols.SPINE_SYMBOL_SCALES[symbolValue] || 1; // Default scale if not configured
  }

  /**
   * Get the configured origin for a specific symbol's Spine animation
   */
  public getSpineSymbolOrigin(symbolValue: number): { x: number, y: number } {
    symbolValue = Math.min(symbolValue, Object.keys(Symbols.SPINE_SYMBOL_ORIGINS).length - 1);

    return Symbols.SPINE_SYMBOL_ORIGINS[symbolValue] || { x: 0.5, y: 0.5 }; // Default origin if not configured
  }

  /**
   * Finds the animation name by looping through the multiplier spine animations
   * and matching the last part after "_" with the multiplierAnimationMapping.
   * @param spine - The multiplier spine object to search animations in
   * @param symbolIndex - The symbol index (e.g., 10, 11, 12)
   * @returns The animation name if found (e.g., "Symbol10_RF_2x"), null otherwise
   */
  public findMultiplierAnimationNameByIndex(spine: SpineGameObject, symbolIndex: number): string | null {
    if (symbolIndex == null || !(symbolIndex in this.multiplierAnimationMapping) || !spine) {
      return null;
    }

    const multiplierValue = this.multiplierAnimationMapping[symbolIndex];

    try {
      const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;

      if (animations) {
        // Loop through all animations
        for (const animation of animations) {
          if (!animation.name || !animation.name.includes('_')) {
            continue;
          }

          // Get the last part after "_"
          const parts = animation.name.split('_');
          const lastPart = parts[parts.length - 1];

          // Match with the multiplier value from the mapping
          if (lastPart === multiplierValue) {
            return animation.name;
          }
        }
      }
    } catch (error) {
      console.warn('[Symbols] Error accessing spine animations:', error);
    }

    return null;
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
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Restored visibility for ${resetCount} symbols, set ${visibleCount} to visible`);
      }

      // Also log the current state of the container
      if (this.container) {
        if (isSymbolsVerboseLoggingEnabled()) {
          console.log(`[Symbols] Container alpha after restore: ${this.container.alpha}, visible: ${this.container.visible}`);
        }
      }

      // Log the state of any scatter symbols specifically
      this.logScatterSymbolsState();

      // Force all symbols to be visible as a final safety measure
      this.forceAllSymbolsVisible();
    }
  }

  /**
   * Log the current state of scatter symbols for debugging
   */
  private logScatterSymbolsState(): void {
    if (!isSymbolsVerboseLoggingEnabled()) {
      return;
    }
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let scatterCount = 0;
    let visibleScatterCount = 0;
    const sample: string[] = [];
    const MAX_SAMPLE = 12;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
          scatterCount++;
          if (symbol.visible) {
            visibleScatterCount++;
          }
          if (sample.length < MAX_SAMPLE) {
            sample.push(`(${row},${col}) v=${!!symbol.visible} a=${Number(symbol.alpha ?? 1).toFixed(2)}`);
          }
        }
      }
    }

    console.log(
      `[Symbols] Scatter symbols state: ${visibleScatterCount}/${scatterCount} visible` +
      (sample.length > 0 ? ` sample=[${sample.join(' ')}]` : '')
    );
  }

  /**
   * Stop all Spine animations on symbols (without converting them)
   */
  public stopAllSpineAnimations(): void {
    if (isSymbolsVerboseLoggingEnabled()) {
      console.log('[Symbols] Stopping all Spine animations on symbols...');
    }

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
              }
            } catch (error) {
              if (isSymbolsVerboseLoggingEnabled()) {
                console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
              }
            }
          }
        }
      }

      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Stopped ${spineAnimationsStopped} Spine animations`);
      }
    }
  }

  /**
   * Stop all active animations on symbols (no conversion back to PNG)
   */
  public stopAllSymbolAnimations(): void {
    if (isSymbolsVerboseLoggingEnabled()) {
      console.log('[Symbols] Stopping all active symbol animations (no PNG reversion)...');
    }

    // Important: during reel drops we must not kill symbol tweens, or the drop sequence will appear "interrupted".
    // This can happen if dialog/bonus cleanup fires while a new spin is already dropping.
    if (this.isReelDropping) {
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log('[Symbols] stopAllSymbolAnimations skipped (reel drop in progress)');
      }
      return;
    }

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
                if (isSymbolsVerboseLoggingEnabled()) {
                  console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
                }
              }
            }
          }
        }
      }

      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Stopped animations on ${animationsStopped} symbols, cleared tracks on ${spineTracksCleared} Spine symbols`);
      }
    }

    // Also kill any tweens on the container
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log('[Symbols] Container tweens killed');
      }
    }

    // Restore subtle idle motion for any static PNGs after wiping tweens.
    reapplyIdleTweensToStaticSymbols(this);
  }

  /**
   * Specifically ensure scatter symbols are visible
   */
  public ensureScatterSymbolsVisible(): void {
    if (isSymbolsVerboseLoggingEnabled()) {
      console.log('[Symbols] Specifically ensuring scatter symbols are visible');
    }

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
            }
          }
        }
      }

      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Found ${scatterFound} scatter symbols, made ${scatterMadeVisible} visible`);
      }

      // Log the state after making them visible
      if (scatterFound > 0) {
        this.logScatterSymbolsState();
      }
    }
  }

  /**
   * Force all symbols to be visible (for debugging and recovery)
   */
  public forceAllSymbolsVisible(): void {
    if (isSymbolsVerboseLoggingEnabled()) {
      console.log('[Symbols] Force setting all symbols to visible');
    }

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
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Force set ${forceVisibleCount} symbols to visible`);
      }
    }

    // Also ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log('[Symbols] Container forced to visible with alpha 1');
      }
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

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log('[Symbols] Resetting Spine symbols back to PNG sprites');
    }

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
          } else {
            pngCount++;
          }
        }
      }
    }

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Before cleanup: ${spineCount} Spine symbols, ${pngCount} PNG symbols`);
    }

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];

        // Check if this is a Spine object (has animationState property)
        if (symbol && symbol.animationState) {
          try {
            // Get the original symbol value from stored data
            const symbolValue = this.currentSymbolData[col][row];

            if (symbolValue !== undefined) {

              // Store original position and dimensions
              const x = symbol.x;
              const y = symbol.y;

              // Destroy the Spine object
              symbol.destroy();

              // Create PNG sprite in its place
              const spriteKey = 'symbol_' + symbolValue;

              // Check if the sprite texture exists
              if (!this.scene.textures.exists(spriteKey)) {
                console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist!`);
                if (isSymbolsVerboseLoggingEnabled()) {
                  console.log('[Symbols] Available textures:', this.scene.textures.getTextureKeys().filter(key => key.includes('symbol')));
                }
                continue;
              }

              const pngSprite = this.scene.add.sprite(x, y, spriteKey);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;

              // Add to container and update reference
              this.container.add(pngSprite);
              this.symbols[col][row] = pngSprite;

              resetCount++;
            } else {
              console.warn(`[Symbols] Symbol value is undefined for (${col}, ${row})`);
            }
          } catch (error) {
            console.error(`[Symbols] Failed to reset Spine symbol at (${col}, ${row}):`, error);
          }
        }
      }
    }

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Reset complete: Found ${spineCount} Spine symbols, successfully reset ${resetCount}`);
    }
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
          }
        }
      }
      console.log('[Symbols] Reset symbols state - cleared tints and stopped animations');
    }

    // Reapply idle tweens to static PNGs so they continue breathing/shining.
    reapplyIdleTweensToStaticSymbols(this);
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
    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Reset depths and container for ${resetCount} symbols`);
    }
  }

  /**
   * Move scatter symbols to front (above overlay) - similar to winning symbols
   */
  public moveScatterSymbolsToFront(data: Data, scatterGrids: any[]): void {
    if (scatterGrids.length === 0) {
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log('[Symbols] No scatter symbols to move to front');
      }
      return;
    }

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Moving ${scatterGrids.length} scatter symbols to front`);
    }

    // Set depth of scatter symbols to be above the overlay
    let movedCount = 0;
    for (const grid of scatterGrids) {
      // NOTE: this.symbols is [col][row]; scatterGrids coordinates in this class are treated as { x: col, y: row }
      const col = grid.x;
      const row = grid.y;
      if (this.symbols && this.symbols[col] && this.symbols[col][row]) {
        const symbol = this.symbols[col][row];

        // Remove symbol from container and add directly to scene for independent depth control
        try { this.container?.remove(symbol); } catch { }
        try { this.scene?.add?.existing(symbol); } catch { }

        if (typeof symbol.setDepth === 'function') {
          // Above win overlay (500) but BELOW major fullscreen/dialog Spine layers.
          // Keep this relatively low so big scatter Spine overlays can sit above the gathered PNGs.
          symbol.setDepth(550);
        }
        movedCount++;
      } else {
        if (isSymbolsVerboseLoggingEnabled()) {
          console.warn(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) not found or invalid`);
        }
      }
    }

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Successfully moved ${movedCount} out of ${scatterGrids.length} scatter symbols to front`);
    }
  }

  /**
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(mockData: any): void {
    console.log('[Symbols] Starting scatter animation sequence');

    // Cleanup any leftover big-center scatter Spine from a previous scatter flow (or aborted run)
    // before starting a new sequence.
    this.cleanupActiveBigScatterSpine();

    // Note: returning gathered scatter PNGs + big scatter cleanup is now handled immediately
    // after the big scatter Spine finishes its 2-play hit animation (with fallback), so we no
    // longer tie the reset to dialogAnimationsComplete here.

    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    this.stopAllSymbolAnimations();
    // this.hideAllSymbols();
    this.hideWinningOverlay();

    // Base-game scatter hits should still show the header win value (scatter payout).
    // Only hide the winnings display if we're already in bonus mode (bonus-mode retrigger UX).
    if (gameStateManager.isBonus) {
      const header = (this.scene as any).header;
      if (header && typeof header.hideWinningsDisplay === 'function') {
        console.log('[Symbols] Hiding winnings display for scatter animation (bonus mode)');
        header.hideWinningsDisplay();
      } else {
        console.warn('[Symbols] Header not available or hideWinningsDisplay method not found');
      }
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
   * Handle scatter retriggers that occur while already in bonus/free-spin mode.
   * Shows a short Bonus Free Spin dialog, auto-closes it, and resumes play.
   */
  public async handleBonusScatterRetrigger(mockData: any, scatterGrids: any[], spinData: SpinData): Promise<void> {
    console.log('[Symbols] Handling bonus-mode scatter retrigger');

    const awardedFreeSpins = this.scene.gameData?.bonusRetriggerFreeSpins ?? 5;
    console.log(`[Symbols] Bonus scatter retrigger - awarding ${awardedFreeSpins} extra free spins from GameData`);

    // Extend the free-spin autoplay counter when active so the UI/state stay in sync.
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
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
        console.log('[Symbols] Emitted SYMBOLS_BONUS_RETRIGGER_COMPLETE (dialogs unavailable)');
      } catch (error) {
        console.warn('[Symbols] Failed to emit SYMBOLS_BONUS_RETRIGGER_COMPLETE:', error);
      }
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
      try {
        gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
        console.log('[Symbols] Emitted SYMBOLS_BONUS_RETRIGGER_COMPLETE (dialogs unavailable)');
      } catch (error) {
        console.warn('[Symbols] Failed to emit SYMBOLS_BONUS_RETRIGGER_COMPLETE:', error);
      }
      return;
    }

    // Wait for the user to close the retrigger dialog (no auto-close).
    await new Promise<void>((resolve) => {
      const onClosed = () => {
        try { gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onClosed); } catch {}
        resolve();
      };
      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onClosed);
    });

    // Retrigger UX: after the player closes the retrigger dialog, resume quickly.
    // We mark one-shot flags to skip any extra "multiplier hit" / autoplay delays once.
    try { (this as any).__skipStopEventDelayOnce = true; } catch {}
    try { (this as any).__skipNextFreeSpinAutoplayExtraDelayOnce = true; } catch {}

    // Cleanup state after the dialog is closed.
    gameStateManager.isShowingWinDialog = false;
    gameStateManager.isScatter = false;
    try {
      gameEventManager.emit(GameEventType.SYMBOLS_BONUS_RETRIGGER_COMPLETE);
      console.log('[Symbols] Emitted SYMBOLS_BONUS_RETRIGGER_COMPLETE after bonus retrigger dialog');
    } catch (error) {
      console.warn('[Symbols] Failed to emit SYMBOLS_BONUS_RETRIGGER_COMPLETE after bonus retrigger dialog:', error);
    }
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
   * Release the pooled "big-center" scatter Spine (spawned during scatter gather) if it's still active.
   * Prevents the scatter Spine from persisting across spins / bonus transitions.
   */
  private cleanupActiveBigScatterSpine(): void {
    const bigScatter: SpineGameObject | null = ((this as any).__activeBigScatterSpine as SpineGameObject) ?? null;
    if (!bigScatter) return;
    try { releaseSpineToPool(this, bigScatter as any); } catch { }
    (this as any).__activeBigScatterSpine = null;
  }

  /**
   * Tween any previously "gathered" scatter PNGs back to their stored start positions.
   * Symbols participating in the gather store `startX/startY/startScaleX/startScaleY` via setData().
   */
  private tweenGatheredScatterSymbolsBackToStart(duration: number = 550): void {
    if (!this.scene || !this.symbols || this.symbols.length === 0) return;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol: any = this.symbols?.[col]?.[row];
        this.tweenOneGatheredScatterSymbolBackToStart(symbol, duration);
      }
    }
  }

  /**
   * Awaitable variant for returning gathered scatter PNGs back to their stored start positions.
   * Scoped to the provided scatter grids so we don't scan the entire grid.
   *
   * Note: `tweenOneGatheredScatterSymbolBackToStart` clears the stored start data and does not
   * expose a completion callback, so we resolve based on duration with a small buffer.
   */
  private async tweenGatheredScatterSymbolsBackToStartAsync(scatterGrids: any[], duration: number = 550): Promise<void> {
    try {
      if (!this.scene || !Array.isArray(scatterGrids) || scatterGrids.length === 0) return;

      const waits = scatterGrids.map((grid) => {
        return new Promise<void>((resolve) => {
          try {
            const col = grid?.x;
            const row = grid?.y;
            const symbol: any =
              (typeof col === 'number' && typeof row === 'number') ? this.symbols?.[col]?.[row] : null;

            const startX = symbol?.getData?.('startX');
            const startY = symbol?.getData?.('startY');
            if (typeof startX !== 'number' || typeof startY !== 'number') {
              resolve();
              return;
            }

            try { this.tweenOneGatheredScatterSymbolBackToStart(symbol, duration); } catch { }
            this.scene.time.delayedCall(duration + 50, () => resolve());
          } catch {
            resolve();
          }
        });
      });

      await Promise.all(waits);
    } catch { }
  }

  private tweenOneGatheredScatterSymbolBackToStart(symbol: any, duration: number = 550): void {
    if (!symbol || typeof symbol.getData !== 'function') return;

    const startX = symbol.getData('startX');
    const startY = symbol.getData('startY');
    if (typeof startX !== 'number' || typeof startY !== 'number') {
      return;
    }

    // Clear stored start data early so multiple listeners (per-symbol + global) won't double-reset.
    try { symbol.data?.remove?.('startX'); } catch { }
    try { symbol.data?.remove?.('startY'); } catch { }
    try { symbol.data?.remove?.('startScaleX'); } catch { }
    try { symbol.data?.remove?.('startScaleY'); } catch { }

    const startScaleX = (typeof symbol.getData === 'function' ? symbol.getData('startScaleX') : undefined);
    const startScaleY = (typeof symbol.getData === 'function' ? symbol.getData('startScaleY') : undefined);
    const targetScaleX = (typeof startScaleX === 'number' ? startScaleX : (symbol.scaleX ?? 1));
    const targetScaleY = (typeof startScaleY === 'number' ? startScaleY : (symbol.scaleY ?? 1));

    // Stop any in-flight gather/fade tweens before tweening back.
    try { this.scene.tweens.killTweensOf(symbol); } catch { }

    // Ensure the symbol is visible for the return tween.
    try { symbol.setVisible?.(true); } catch { }
    try { symbol.setAlpha?.(Math.max(0.001, symbol.alpha ?? 1)); } catch { }
    try { symbol.setDepth?.(550); } catch { }

    try {
      this.scene.tweens.add({
        targets: symbol,
        x: startX,
        y: startY,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        alpha: 1,
        angle: 0,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Put the symbol back under the symbols container so later spins / visibility logic behaves normally.
          try {
            if (symbol.parentContainer !== this.container) {
              this.scene.children.remove(symbol);
              this.container.add(symbol);
            }
          } catch { }
          try { symbol.setDepth?.(0); } catch { }
          try { symbol.setAlpha?.(1); } catch { }
          try { symbol.setVisible?.(true); } catch { }
          try { symbol.setAngle?.(0); } catch { }
        }
      });
    } catch {
      // Fallback: snap if tween fails for any reason.
      try { symbol.setPosition?.(startX, startY); } catch { }
      try { symbol.setScale?.(targetScaleX, targetScaleY); } catch { }
      try { symbol.setAlpha?.(1); } catch { }
      try { symbol.setVisible?.(true); } catch { }
      try { symbol.setAngle?.(0); } catch { }
      try {
        if (symbol.parentContainer !== this.container) {
          this.scene.children.remove(symbol);
          this.container.add(symbol);
        }
      } catch { }
      try { symbol.setDepth?.(0); } catch { }
    }
  }

  /**
   * Animate scatter symbols with Spine animations (no winlines)
   */
  public async animateScatterSymbols(data: Data, scatterGrids: any[]): Promise<void> {
    if (scatterGrids.length === 0) {
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log('[Symbols] No scatter symbols to animate');
      }
      return;
    }

    if (isSymbolsVerboseLoggingEnabled()) {
      console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);
    }

    // Keep scatter symbols as PNGs (no Spine replacement)
    const animationPromises = scatterGrids.map((grid) => {
      return new Promise<void>((resolve) => {
        // Note: scatterGrids coordinates are [row][col] from transposed data
        // but this.symbols array is [col][row] format, so we need to swap coordinates
        const col = grid.x; // grid.x is actually the column in transposed data
        const row = grid.y; // grid.y is actually the row in transposed data

        // Extremely verbose per-symbol diagnostics removed; enable debug and add breakpoints if needed.

        if (this.symbols && this.symbols[col] && this.symbols[col][row]) {
          const currentSymbol = this.symbols[col][row];

          // Ensure symbol can render above the win overlay (overlayRect is a top-level scene object at depth 500).
          // If the symbol stays inside `this.container`, its own depth won't beat `overlayRect`.
          try {
            if (currentSymbol.parentContainer === this.container) {
              this.container.remove(currentSymbol);
              this.scene.add.existing(currentSymbol);
            }
          } catch { }
          // Above win overlay (500) but under big scatter/bonus Spine overlays
          try { currentSymbol.setDepth?.(550); } catch { }

          // Light pulse to highlight the scatter hit
          try {
            this.scene.tweens.add({
              targets: currentSymbol,
              scaleX: currentSymbol.scaleX * 1.1,
              scaleY: currentSymbol.scaleY * 1.1,
              duration: 250,
              yoyo: true,
              ease: 'Sine.easeInOut',
              onComplete: () => resolve()
            });
          } catch {
            resolve();
          }
        } else {
          resolve();
        }
      });
    });

    // Wait for all Spine animations to start
    await Promise.all(animationPromises);

    // Briefly hold the initial hit pose so players can see all scatters
    await this.delay(500);

    // Gather all scatter symbols to a single focal point near the slot center
    const centerX = this.slotX;
    const centerY = this.slotY;
    const gatherDuration = 700;

    const gatherPromises = scatterGrids.map(grid => {
      return new Promise<void>((resolve) => {
        const col = grid.x;
        const row = grid.y;
        const symbol: any = this.symbols?.[col]?.[row];
        if (!symbol) {
          resolve();
          return;
        }

        // Store original position/scale once so we can reset after the big scatter hit completes.
        // (We no longer tie this to dialogAnimationsComplete; we return immediately after the 2-hit sequence.)
        try {
          const hasStartPosition = typeof symbol.getData === 'function' ? symbol.getData('startX') !== undefined : false;
          if (!hasStartPosition && typeof symbol.setData === 'function') {
            symbol.setData('startX', symbol.x);
            symbol.setData('startY', symbol.y);
            symbol.setData('startScaleX', (symbol as any)?.scaleX ?? 1);
            symbol.setData('startScaleY', (symbol as any)?.scaleY ?? 1);
          }
        } catch { }

        // Re-assert depth before the gather tween in case something re-ordered it.
        // Keep it above the win overlay but below big scatter/bonus Spine overlays.
        try { symbol.setDepth?.(550); } catch { }

        // Tween symbol toward the focal point
        this.scene.tweens.add({
          targets: symbol,
          x: centerX,
          y: centerY,
          duration: gatherDuration,
          ease: 'Sine.easeInOut',
          onComplete: () => resolve()
        });
      });
    });

    await Promise.all(gatherPromises);
    console.log('[Symbols] Scatter symbols gathered to center');

    // After gathering, spawn a single big-center Scatter as SPINE (not PNG).
    // Keep reel scatters gathered but fade them out so the center spine reads cleanly.
    try {
      for (const grid of scatterGrids) {
        const symbol: any = this.symbols?.[grid.x]?.[grid.y];
        if (!symbol) continue;
        try { symbol.setDepth?.(550); } catch { }
        try {
          this.scene.tweens.add({
            targets: symbol,
            alpha: 0,
            duration: 150,
            ease: 'Sine.easeOut',
            onComplete: () => {
              try { symbol.setVisible?.(false); } catch { }
            }
          });
        } catch { }
      }
    } catch { }

    const bigScatterSpineKey = Symbols.SCATTER_SPINE_KEY; // 'symbol0_spine'
    const bigScatterAtlasKey = `${bigScatterSpineKey}-atlas`;
    const bigCenterX = this.slotX;
    const bigCenterY = this.slotY;

    // Reuse a previously spawned big-scatter spine if it exists (helps during iteration/testing)
    let bigScatter: SpineGameObject | null = ((this as any).__activeBigScatterSpine as SpineGameObject) ?? null;
    if (!bigScatter) {
      try {
        bigScatter = acquireSpineFromPool(this, bigScatterSpineKey, bigScatterAtlasKey);
        (this as any).__activeBigScatterSpine = bigScatter;
      } catch (e) {
        console.warn('[Symbols] Failed to acquire big scatter Spine from pool:', e);
        bigScatter = null;
      }
    }

    if (bigScatter) {
      try {
        // Ensure it renders above overlay and gathered symbols.
        // Note: pooled spines may still live under a container; detach if needed.
        try { (bigScatter as any)?.parentContainer?.remove?.(bigScatter); } catch { }

        bigScatter.setPosition(bigCenterX, bigCenterY);
        bigScatter.setOrigin(0.5, 0.5);
        bigScatter.setDepth(800);
        bigScatter.setVisible(true);
        bigScatter.setActive(true);
        try { bigScatter.setAlpha(1); } catch { }

        // Scale: reuse configured scatter scale and amplify to match the previous PNG 4.5x enlargement.
        const baseScatterScale = this.getSpineSymbolScale(0);
        const targetScatterScale = baseScatterScale * 4.5;
        const startScatterScale = Math.max(0.0001, baseScatterScale * 0.6);
        bigScatter.setScale(startScatterScale);

        // Kick the Scatter win animation by name; fallback to first animation if missing.
        // IMPORTANT: We must not start the freespins scatter sequence until this big-center scatter
        // finishes its 2-play hit animation. Use Spine completion events, with a hard 5s fallback.
        //
        // Note: The scale "pop-in" tween should start immediately (visual feedback), while the
        // await below only gates progression to the freespins dialog/sequence.
        let waitForTwoPlays: Promise<void> = Promise.resolve();
        try {
          const desired = Symbols.SCATTER_HIT_ANIMATION_NAME; // 'Symbol0_RF_win'
          const animations = (bigScatter as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;
          const hasDesired = Array.isArray(animations) && animations.some(a => a?.name === desired);
          const fallback = Array.isArray(animations) && animations.length > 0 ? animations[0]?.name : undefined;
          const nameToPlay = hasDesired ? desired : fallback;
          const state = (bigScatter as any)?.animationState;

          if (nameToPlay && state?.setAnimation) {
            const playScatterAnimSfx = () => {
              try {
                const audio = (window as any)?.audioManager;
                if (audio && typeof audio.playSoundEffect === 'function') {
                  audio.playSoundEffect(SoundEffectType.SCATTER_ANIMATION);
                }
              } catch { }
            };

            try { state.clearTracks?.(); } catch { }

            waitForTwoPlays = new Promise<void>((resolve) => {
              let completedCount = 0;
              let resolved = false;
              let listener: any = null;

              const safeResolve = () => {
                if (resolved) return;
                resolved = true;
                try { if (listener) state.removeListener?.(listener as any); } catch { }
                resolve();
              };

              listener = {
                complete: (entry: any) => {
                  try {
                    const isTrack0 = entry?.trackIndex === 0;
                    const animName = entry?.animation?.name ?? "";
                    if (!isTrack0) return;
                    if (animName !== nameToPlay) return;

                    completedCount++;
                    if (completedCount === 1) {
                      // Immediately replay the same animation once more
                      this.scene?.time?.delayedCall?.(250, () => {
                        playScatterAnimSfx();
                      });
                      try { state.setAnimation(0, nameToPlay, false); } catch { }
                      return;
                    }

                    if (completedCount >= 2) {
                      safeResolve();
                    }
                  } catch {
                    // If anything unexpected happens inside the listener, let the 5s fallback release us.
                  }
                }
              };

              // Hard fallback: never block the game flow on missing/interrupting Spine events.
              try {
                this.scene?.time?.delayedCall?.(5000, () => {
                  console.warn('[Symbols] Big scatter Spine did not complete twice within 5s; continuing scatter flow (fallback)');
                  safeResolve();
                });
              } catch { }

              try { state.addListener?.(listener as any); } catch { }
              try {
                this.scene?.time?.delayedCall?.(200, () => {
                  playScatterAnimSfx();
                });
                state.setAnimation(0, nameToPlay, false);
              } catch { safeResolve(); }
            });
          }
        } catch (e) {
          console.warn('[Symbols] Failed to play big scatter Spine animation:', e);
        }

        // Pop-in scale tween for the big center scatter.
        try {
          this.scene.tweens.add({
            targets: bigScatter,
            scaleX: targetScatterScale,
            scaleY: targetScatterScale,
            duration: 450,
            ease: 'Sine.easeOut'
          });
        } catch { }

        // Gate progression to the freespins dialog/sequence on 2 animation plays (with fallback).
        try { await waitForTwoPlays; } catch { }

        // Cleanup/outro: scale the big scatter back down, then return the gathered scatter PNGs.
        try {
          // Scale back down to the starting scale (with a small safety timeout).
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };
            try { this.scene?.time?.delayedCall?.(1000, () => finish()); } catch { }
            try {
              this.scene?.tweens?.add?.({
                targets: bigScatter,
                scaleX: startScatterScale,
                scaleY: startScatterScale,
                duration: 250,
                ease: 'Sine.easeInOut',
                onComplete: () => finish()
              });
            } catch {
              finish();
            }
          });
        } catch { }

        // Now remove the big scatter spine (cleanup) and tween the scatter PNGs back.
        try { this.cleanupActiveBigScatterSpine(); } catch { }
        try { await this.tweenGatheredScatterSymbolsBackToStartAsync(scatterGrids, 550); } catch { }
      } catch (e) {
        console.warn('[Symbols] Failed to configure big scatter Spine:', e);
        // If configuration failed, do return it to pool to avoid a broken persistent spine.
        try { releaseSpineToPool(this, bigScatter as any); } catch { }
        bigScatter = null;
      }
    }

    console.log('[Symbols] Scatter symbol Spine animation completed (or fallback reached)');
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
    const paddingY = 30.5;

    const offsetX = 1;
    const offsetY = -12;

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
      const fsItems = this.currentSpinData?.slot?.freespin?.items || this.currentSpinData?.slot?.freeSpin?.items;
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

    console.log(`[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);

    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    // Check if win dialog is showing - pause autoplay if so
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - pausing free spin autoplay');
      // Wait for dialog animations to complete instead of using a fixed delay
      console.log('[Symbols] Waiting for dialogAnimationsComplete event before continuing free spin autoplay');
      this.scene.events.once('dialogAnimationsComplete', () => {
        console.log('[Symbols] Dialog animations complete - continuing free spin autoplay');
        // Use the same timing as normal autoplay (500ms base with turbo multiplier)
        const baseDelay = 500;
        const turboDelay = gameStateManager.isTurbo ?
          baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
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

    console.log('[Symbols] WIN_STOP received - continuing free spin autoplay after winlines complete');
    this.freeSpinAutoplayWaitingForWinlines = false;

    // Clear any existing timer since WIN_STOP fired properly
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }

    // Use the same timing as normal autoplay (500ms base with turbo multiplier)
    // Retrigger UX: optionally skip extra delays once right after the retrigger dialog closes.
    const skipExtraDelayOnce = !!(this as any).__skipNextFreeSpinAutoplayExtraDelayOnce;
    if (skipExtraDelayOnce) {
      try { (this as any).__skipNextFreeSpinAutoplayExtraDelayOnce = false; } catch {}
    }

    const baseDelay = skipExtraDelayOnce ? 150 : 500;
    const turboDelay = gameStateManager.isTurbo ?
      baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;

    // Extra delay when: multiplier symbol exists AND any match occurred (spin or tumble)
    let extraDelay = 0;
    if (skipExtraDelayOnce) {
      extraDelay = 0;
    }
    try {
      if (skipExtraDelayOnce) {
        // Intentionally skip extra-delay logic for fast retrigger resume.
      } else {
        const spinData = this.scene?.gameAPI?.getCurrentSpinData?.();
      // For free spins, GameAPI's index is already incremented for the *next* spin,
      // so use the just-finished index (current - 1).
      const finishedFreeSpinIndex = Math.max(0, (this.scene?.gameAPI?.getCurrentFreeSpinIndex?.() ?? 1) - 1);
      if (spinData) {
        const hasMatch = SpinDataUtils.hasAnyMatch(spinData, finishedFreeSpinIndex);
        const hasMultiplier = SpinDataUtils.hasAnyMultiplierSymbol(spinData, finishedFreeSpinIndex);
        if (hasMatch && hasMultiplier) {
          extraDelay = 1000;
        }
        console.log('[Symbols] Free spin extra-delay check:', { hasMatch, hasMultiplier, extraDelay });
      }
      }
    } catch (e) {
      console.warn('[Symbols] Failed extra-delay check for free spin autoplay:', e);
    }

    const totalDelay = turboDelay + extraDelay;
    console.log(`[Symbols] Scheduling next free spin in ${totalDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo}, extra: ${extraDelay}ms)`);

    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(totalDelay, () => {
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
  private showCongratsDialogAfterDelay(delay: number = 1000): void {
    console.log('[Symbols] Showing congrats dialog after delay');

    // Close any open win dialogs first (safety check)
    const gameScene = this.scene as any;
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }

    const totalWin = this.scene.gameAPI.getCurrentSpinData()?.slot?.totalWin;

    // Show congrats dialog with total win amount
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongratulations === 'function') {
      this.scene.time.delayedCall(delay, () => {
        gameScene.dialogs.showCongratulations(this.scene, { winAmount: totalWin });
      });
      console.log(`[Symbols] Congratulations dialog shown with total win: ${totalWin}`);
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
  public async processSpinData(spinData: SpinData): Promise<void> {
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

  /**
   * Perform an offline spin using test data
   */
  public async performOfflineSpin(scenario: any | undefined): Promise<void> {
    console.log('[Symbols] Performing offline spin with test data...');

    let testSpinData: SpinData;

    if (scenario) {
      testSpinData = getTestSpinData(scenario) as SpinData;
    } else {
      testSpinData = getTestSpinData() as SpinData;
    }
    
    this.scene.gameAPI?.setCurrentSpinData(testSpinData, { resetFreeSpinIndex: true, resetTumbleIndex: true });
    await this.processSpinData(testSpinData);
  }
}

function getTestSpinData(scenario: 'regular_scatter' | 'end_retrigger' | 'untriggered_retrigger' | 'end_retrigger_v2' = 'regular_scatter'): any {
  switch (scenario) {
    case 'regular_scatter':
      return regularScatterData;
    case 'end_retrigger':
      return endRetriggerData;
    case 'untriggered_retrigger':
      return untriggeredRetriggerData;
    case 'end_retrigger_v2':
      return end_retrigger_v2;
    default:
      return regularScatterData;
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

  // Calculate mask dimensions
  const maskX = self.slotX - self.totalGridWidth * 0.5 - self.maskPadding.left;
  const maskY = self.slotY - self.totalGridHeight * 0.5 - self.maskPadding.top;
  const maskWidth = self.totalGridWidth + self.maskPadding.left + self.maskPadding.right;
  const maskHeight = self.totalGridHeight + self.maskPadding.top + self.maskPadding.bottom;

  // Add padding to prevent sprite cutoff, especially on the right side
  maskShape.fillRect(maskX, maskY, maskWidth, maskHeight);

  const mask = maskShape.createGeometryMask();
  self.container.setMask(mask);
  maskShape.setVisible(false);

  // Create wireframe for mask (if enabled)
  if (self.showMaskWireframe) {
    self.maskWireframe = self.scene.add.graphics();
    self.maskWireframe.lineStyle(2, 0xff0000, 1); // Red wireframe, 2px line width
    self.maskWireframe.strokeRect(maskX, maskY, maskWidth, maskHeight);
    self.maskWireframe.setDepth(100); // Same depth as symbol wireframes
    console.log('[Symbols] Mask wireframe created');
  }

  console.log(`[Symbols] Mask created with padding - Left: ${self.maskPadding.left}, Right: ${self.maskPadding.right}, Top: ${self.maskPadding.top}, Bottom: ${self.maskPadding.bottom}`);
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

async function schedulePrewarmAsync(self: Symbols) {
  const prewarmDelayMs = 500;

  // Let create() finish before kicking off heavier work.
  await yieldToScene(self);

  await prewarmSymbolSpinePools(self, 1);
  await waitForSceneDelay(self, prewarmDelayMs);
  await prewarmSymbolSpinePools(self, 2);
  await waitForSceneDelay(self, prewarmDelayMs);
  await prewarmSymbolSpinePools(self, 2);
}

function waitForSceneDelay(self: Symbols, delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!self.scene?.time) {
      setTimeout(resolve, delayMs);
      return;
    }
    self.scene.time.delayedCall(delayMs, () => resolve());
  });
}

// Yield to the next tick/frame to keep prewarm work non-blocking.
function yieldToScene(self: Symbols): Promise<void> {
  return waitForSceneDelay(self, 0);
}

async function prewarmSymbolSpinePools(self: Symbols, countPerSymbol: number = 8) {
  // Pre-warm Spine instances for symbols 1-9 to avoid first-use hitches.
  const symbolValues = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const value of symbolValues) {
    const spineKey = `symbol${value}_spine`;
    const atlasKey = `${spineKey}-atlas`;

    let failedForValue = false; // stop noisy retries if the asset is missing
    await yieldToScene(self);
    for (let i = 0; i < countPerSymbol; i++) {
      await yieldToScene(self);
      try {
        const spine = acquireSpineFromPool(self, spineKey, atlasKey);
        if (!spine) {
          console.warn('[Symbols] Spine not available during prewarm, skipping further attempts for', spineKey);
          failedForValue = true;
          break;
        }
        releaseSpineToPool(self, spine);
      } catch (e) {
        failedForValue = true;
        break;
      }
    }
    if (failedForValue) {
      continue;
    }
  }
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
    available = pool.find((fx: any) => !(fx as any).__pooledActive);
  }
  if (available) {
    (available as any).__pooledActive = true;
    try {
      // Remove any lingering listeners from previous uses before clearing tracks
      const state: any = available.animationState;
      if (state?.clearListeners) {
        state.clearListeners();
      } else if (state?.listeners?.length) {
        state.listeners.length = 0;
      }

      available.setVisible(false);
      available.setActive(false);
      // Reset animation state and pose so new animations always start from time 0
      available.animationState?.clearTracks();
      try {
        available.skeleton?.setToSetupPose();
      } catch { }
    } catch { }
    return available;
  }

  try {
    if (!ensureSpineFactory(self.scene, '[Symbols] acquireSpineFromPool')) {
      // If the global factory exists but the scene plugin instance isn't attached yet,
      // creating spines will intermittently crash. Let callers fallback/retry.
      console.warn('[Symbols] Spine factory unavailable while acquiring from pool. Skipping creation:', spineKey);
      return null;
    }
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
    // Clear listeners first so clearTracks does not dispatch stale callbacks
    const state: any = spine.animationState;
    if (state?.clearListeners) {
      state.clearListeners();
    } else if (state?.listeners?.length) {
      state.listeners.length = 0;
    }
    state?.clearTracks?.();
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

function releaseSpriteToPool(self: Symbols, sprite: GameObjects.Sprite): void {
  if (!sprite) return;
  try { self.scene.tweens.killTweensOf(sprite); } catch { }
  try {
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setAlpha(1);
  } catch { }
  self.symbolSpritePool.push(sprite);
}

/**
 * Add idle motion to static PNG symbols so they feel alive.
 * Uses a quick squash + settle loop.
 */
function applyIdleTweensToPngSymbol(self: Symbols, sprite: GameObjects.Sprite): void {
  if (!sprite || !self?.scene) {
    return;
  }

  // Clear any previous tweens (pooled sprites may carry old ones)
  try { self.scene.tweens.killTweensOf(sprite); } catch { }

  const baseScaleX = sprite.scaleX || 1;
  const baseScaleY = sprite.scaleY || 1;
  const squashX = baseScaleX * Phaser.Math.FloatBetween(1.025, 1.05);
  const squashY = baseScaleY * Phaser.Math.FloatBetween(0.94, 0.96);
  const settleDuration = Phaser.Math.Between(110, 170);
  const delay = Phaser.Math.Between(0, 200);

  try {
    self.scene.tweens.add({
      targets: sprite,
      scaleX: squashX,
      scaleY: squashY,
      duration: settleDuration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay,
      repeatDelay: Phaser.Math.Between(1000, 2000), // cycle every ~1–2s
    });
  } catch { }
}

/**
 * Reapply idle tweens to all current static (PNG) symbols.
 * Useful after global tween kill/reset routines.
 */
function reapplyIdleTweensToStaticSymbols(self: Symbols): void {
  if (!self?.symbols || self.symbols.length === 0) {
    return;
  }

  for (let col = 0; col < self.symbols.length; col++) {
    for (let row = 0; row < self.symbols[col].length; row++) {
      const symbol = self.symbols[col][row];
      // Only apply to non-Spine symbols (lack animationState) that look like sprites
      if (symbol && !symbol.animationState && typeof symbol.setAlpha === 'function') {
        applyIdleTweensToPngSymbol(self, symbol as GameObjects.Sprite);
      }
    }
  }
}

/**
 * Create a plain PNG symbol sprite and add it to the symbols container.
 */
function createPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  const spriteKey = `symbol${value}`;

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
      // If texture reset fails, drop the sprite and create a new one
      sprite = undefined;
    }
  }

  if (!sprite) {
    sprite = self.scene.add.sprite(x, y, spriteKey);
  } else {
    sprite.setPosition(x, y);
  }

  try { (sprite as any).symbolValue = value; } catch { }
  sprite.displayWidth = self.displayWidth;
  sprite.displayHeight = self.displayHeight;

  // Special-case: Scatter should render larger than other PNG symbols.
  // Important: apply after displayWidth/Height so we multiply the fit-to-box scale.
  if (value === 0) {
    const mult = (Symbols.SCATTER_PNG_SCALE_MULTIPLIER || 1);
    try {
      const sx = (sprite.scaleX || 1) * mult;
      const sy = (sprite.scaleY || 1) * mult;
      sprite.setScale(sx, sy);
    } catch { }

    // Offset based on scale so enlarged Scatter stays aligned in the symbol box.
    // With origin at 0.5,0.5, scaling increases height around center; to keep the bottom edge
    // in the same place (Phaser +Y is down), shift DOWN by (H * (mult - 1)) / 2.
    const alignFactor = Symbols.SCATTER_PNG_BOTTOM_ALIGN_FACTOR ?? 0;
    if (alignFactor) {
      try {
        const dy = self.displayHeight * (mult - 1) * 0.5 * alignFactor;
        sprite.setPosition(x, y + dy);
      } catch { }
    }
  }

  if (typeof sprite.setAlpha === 'function') sprite.setAlpha(alpha);
  try { sprite.setVisible(true); sprite.setActive(true); } catch { }
  if (self.container && sprite.parentContainer !== self.container) {
    self.container.add(sprite);
  }
  // Apply idle breathing and shine with a slight random stagger so symbols are de-synced.
  applyIdleTweensToPngSymbol(self, sprite);
  return sprite;
}

function createInitialSymbols(self: Symbols) {
  let scene = self.scene;

  // Check if symbol textures are available
  const testKey = 'symbol0';
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

  // Create wireframe boxes to show symbol positions (if enabled)
  if (self.showWireframes) {
    for (let col = 0; col < colCount; col++) {
      for (let row = 0; row < rowCount; row++) {
        const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
        const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

        // Create wireframe box at symbol position
        const wireframeBox = scene.add.graphics();
        wireframeBox.lineStyle(1, 0x00ff00, 1); // Green wireframe, 1px line width

        // Draw rectangle centered at symbol position with base width and height
        const halfWidth = self.baseSymbolWidth * 0.5;
        const halfHeight = self.baseSymbolHeight * 0.5;
        wireframeBox.strokeRect(x - halfWidth, y - halfHeight, self.baseSymbolWidth, self.baseSymbolHeight);

        // Add to scene and store reference
        wireframeBox.setDepth(100); // Above symbols but below UI elements
        self.wireframeBoxes.push(wireframeBox);
      }
    }
  }

  // Build symbols as column-major [col][row] for rendering
  for (let col = 0; col < colCount; col++) {
    let rows: any[] = [];
    for (let row = 0; row < rowCount; row++) {
      const x = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

      const value = initialRowMajor[row][col];
      // Use Spine symbols at startup (falls back to PNG if Spine unavailable).
      const created = createSpineOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }
    self.symbols.push(rows);
  }

  console.log('[Symbols] Initial symbols created successfully');
  console.log(`[Symbols] Created ${self.wireframeBoxes.length} wireframe boxes`);
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
  spinData: SpinData,
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
        try { disposeSymbols(self, oldSymbols); } catch { }
      }
    } catch { }

    // Re-evaluate wins after initial drop completes (async so visuals continue)
    try {
      try { reevaluateWinsFromGrid(self); } catch { }
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
        playMultiplierSymbolAnimations(self)
          .then(() => {
            console.log('[Symbols] Multiplier symbol animations completed successfully');
            try {
              gameEventManager.emit(GameEventType.SYMBOLS_MULTIPLIER_ANIMATIONS_COMPLETE);
            } catch { }
          })
          .catch((e) => {
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
function handlePostMultiplierFlow(self: Symbols, mockData: Data, spinData: SpinData): void {
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
  console.log('[Symbols] SCATTER_SYMBOL from Data:', Data.SCATTER);

  // Get the current symbol grid state after all tumbles have completed
  // Directly transpose from row-major (currentSymbolData[row][col]) to row-major output
  // The two inversions in the original code cancel out, so we can just transpose directly
  if (self.currentSymbolData && self.currentSymbolData.length > 0) {
    const numRows = self.currentSymbolData.length;
    const numCols = self.currentSymbolData[0]?.length ?? 0;
    
    // Ensure outer buffer size
    if (!Array.isArray(self.scatterTransposedBuffer)) {
      self.scatterTransposedBuffer = [];
    }

    // Direct transpose: rowArr[col] = currentSymbolData[row][col]
    for (let row = 0; row < numRows; row++) {
      const rowArr = self.scatterTransposedBuffer[row] || (self.scatterTransposedBuffer[row] = []);
      for (let col = 0; col < numCols; col++) {
        rowArr[col] = self.currentSymbolData[row]?.[col] ?? 0;
      }
      // Trim any stale columns from previous larger grids
      rowArr.length = numCols;
    }
    // Trim any extra rows from previous larger grids
    self.scatterTransposedBuffer.length = numRows;
    
    console.log('[Symbols] Using updated grid state after tumbles for scatter detection');
  } else {
    // Fallback to mockData if currentSymbolData is not available
    console.warn('[Symbols] currentSymbolData not available, falling back to mockData.symbols');
    // Convert mockData.symbols (column-major) to row-major format for scatterTransposedBuffer
    const srcSymbols = mockData.symbols;
    const rowCount = srcSymbols[0]?.length ?? 0;
    const colCount = srcSymbols.length;
    
    if (rowCount > 0 && colCount > 0) {
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
        rowArr.length = colCount;
      }
      self.scatterTransposedBuffer.length = rowCount;
    } else {
      self.scatterTransposedBuffer.length = 0;
    }
  }
  
  console.log('[Symbols] Transposed symbols for scatter detection:', self.scatterTransposedBuffer);

  // Reuse a single Data instance for scatter detection
  if (!self.scatterDataBuffer) {
    self.scatterDataBuffer = new Data();
  }
  const scatterData = self.scatterDataBuffer;
  scatterData.symbols = self.scatterTransposedBuffer;

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
  spinData: SpinData,
  scatterGrids: any[]
): void {
  console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
  gameStateManager.isScatter = true;

  // Normal-mode scatter hits (4+) can award a direct scatter payout in addition to tumble wins.
  // Ensure the header win value reflects that scatter payout/total. Do NOT do this for bonus-mode retriggers.
  if (!gameStateManager.isBonus) {
    const header = (self.scene as any).header;
    const scatterWinsRaw = SpinDataUtils.getPreBonusWins(spinData as any);
    const scatterWins = Number.isFinite(scatterWinsRaw) ? scatterWinsRaw : 0;

    if (header && typeof header.showWinningsDisplay === 'function') {
      console.log(`[Symbols] Base-game scatter hit - updating header winnings to ${scatterWins}`);
      header.showWinningsDisplay(scatterWins);
    } else if (header && typeof header.updateWinningsDisplay === 'function') {
      console.log(`[Symbols] Base-game scatter hit - updating header winnings (fallback) to ${scatterWins}`);
      header.updateWinningsDisplay(scatterWins);
    }
  }

  // If there are no normal wins (no paylines), play scatter SFX now
  try {
    const audio = (window as any)?.audioManager;
    if (audio && typeof audio.playSoundEffect === 'function') {
      audio.playSoundEffect(SoundEffectType.SCATTER);
      console.log('[Symbols] Played scatter SFX for scatter-only hit');
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
    self.animateScatterSymbols(mockData, scatterGrids)
      .then(() => {
        console.log('[Symbols] Scatter symbol animations completed successfully');
        try {
          gameEventManager.emit(GameEventType.SYMBOLS_SCATTER_ANIMATIONS_COMPLETE);
        } catch { }
      })
      .catch((error: any) => {
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
function finalizeSpinProcessing(self: Symbols, spinData: SpinData): void {
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
    const scene = self.scene;

    // Optional delay: if a multiplier was actually "hit" (multiplier symbol present AND a match occurred),
    // pause stop-events briefly so multiplier hit animations can finish before downstream systems advance.
    let extraDelayMs = 0;
    try {
      const skipStopDelayOnce = !!(self as any).__skipStopEventDelayOnce;
      if (skipStopDelayOnce) {
        try { (self as any).__skipStopEventDelayOnce = false; } catch {}
        console.log('[Symbols] Skipping stop-event extra delay once (bonus retrigger resume)');
      } else {
      const freeSpinIndex = gameStateManager.isBonus
        ? Math.max(0, (scene?.gameAPI?.getCurrentFreeSpinIndex?.() ?? 1) - 1)
        : undefined;
      const hasMatch = SpinDataUtils.hasAnyMatch(spinData, freeSpinIndex);
      const hasMultiplier = SpinDataUtils.hasAnyMultiplierSymbol(spinData, freeSpinIndex);
      if (hasMatch && hasMultiplier) {
        const baseExtraDelayMs = 800;
        extraDelayMs = gameStateManager.isTurbo ? baseExtraDelayMs * TurboConfig.TURBO_DELAY_MULTIPLIER : baseExtraDelayMs;
      }
      console.log('[Symbols] Stop-event delay check:', { hasMatch, hasMultiplier, extraDelayMs, freeSpinIndex });
      }
    } catch (e) {
      console.warn('[Symbols] Failed stop-event delay check:', e);
    }

    const emitStops = () => {
      try {
        gameEventManager.emit(GameEventType.WIN_STOP, { spinData });
        if (scene?.time) {
          scene.time.delayedCall(50, () => {
            gameEventManager.emit(GameEventType.REELS_STOP, { spinData });
          });
        } else {
          // Fallback if scene/time is unavailable; emit immediately to avoid stalling
          gameEventManager.emit(GameEventType.REELS_STOP, { spinData });
        }
      } catch (e) {
        console.warn('[Symbols] Failed to emit REELS_STOP/WIN_STOP:', e);
      }
    };

    if (extraDelayMs > 0 && scene?.time) {
      console.log(`[Symbols] Delaying WIN_STOP/REELS_STOP by ${extraDelayMs}ms due to multiplier hit`);
      scene.time.delayedCall(extraDelayMs, emitStops);
    } else {
      emitStops();
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
 * Process symbols from SpinData (GameAPI response)
 */
function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: SpinData) {
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

  // Reset depths and visibility (using rainbow_fist's separate methods)
  self.resetSymbolDepths();
  self.restoreSymbolVisibility();

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
    (spinData?.slot?.freeSpin?.items && Array.isArray(spinData.slot.freeSpin.items))
      ? spinData.slot.freeSpin.items.length
      : (spinData?.slot?.freeSpin?.items?.length || 0)
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
  const currentSpinDataFromGameAPI = self.scene.gameAPI.getCurrentSpinData();
  try {
    tumbles = gameStateManager.isBonus
      ? currentSpinDataFromGameAPI?.slot?.freeSpin?.items[self.scene.gameAPI.getCurrentFreeSpinIndex() - 1]?.tumble
      : currentSpinDataFromGameAPI?.slot?.tumbles;
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

  // Get the winline pattern for this lineKey
  if (lineKey < 0 || lineKey >= Data.WINLINES.length) {
    console.warn(`[Symbols] Invalid lineKey: ${lineKey}`);
    return [];
  }

  const winline = Data.WINLINES[lineKey];

  // Get all positions in the winline pattern (where winline[y][x] === 1)
  const winlinePositions: { x: number, y: number }[] = [];
  for (let x = 0; x < winline[0].length; x++) {
    for (let y = 0; y < winline.length; y++) {
      if (winline[y][x] === 1) {
        winlinePositions.push({ x, y });
      }
    }
  }

  // Sort positions by x coordinate to get left-to-right order
  winlinePositions.sort((a, b) => a.x - b.x);

  // Take only the first 'count' positions as winning symbols
  const winningPositions = winlinePositions.slice(0, count);

  // Add the winning positions to the result (SpinData.area is [column][row], bottom->top)
  for (const pos of winningPositions) {
    const colLen = spinData.slot.area[pos.x]?.length || 0;
    const rowIndex = Math.max(0, colLen - 1 - pos.y);
    const symbolAtPosition = spinData.slot.area[pos.x][rowIndex];
    winningGrids.push(new Grid(pos.x, pos.y, symbolAtPosition));
  }

  return winningGrids;
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

    // Process the symbols using the same logic as before, using mock scatter data
    await processSpinDataSymbols(self, symbols, data.spinData);
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
    scale: 0.2,
    spacing: -10,
    alignment: 'center',
    decimalPlaces: 2,
    showCommas: true,
    prefix: '',
    suffix: '',
    commaYOffset: 7,
    dotYOffset: 7,
    shouldTickUp: false,
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
 * Create a sugar Spine symbol (Symbol1–Symbol9) playing idle, or PNG fallback
 */
function createSpineOrPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  console.log(`[Symbols] Creating spine or PNG symbol for value: ${value}`);

  // Try pooled spine for Symbol0–Symbol9
  if (value >= 1 && value <= 9) {
    const spineKey = `symbol${value}_spine`;
    const atlasKey = `${spineKey}-atlas`;
    try {
      const spine = acquireSpineFromPool(self, spineKey, atlasKey);
      if (spine) {
        spine.setPosition(x, y);
        spine.setOrigin(self.getSpineSymbolOrigin(value).x, self.getSpineSymbolOrigin(value).y);
        spine.setScale(self.getSpineSymbolScale(value));
        try { spine.setVisible(true); spine.setActive(true); spine.setAlpha(alpha); } catch { }
        try { (spine as any).symbolValue = value; } catch { }
        try {
          playSpineAnimationSequence(spine, [0], true);
        } catch {
          console.error(`[Symbols] Failed to play idle animation for symbol ${value}`);
        }

        // Freeze the timeline until explicitly advanced
        if (self.container && spine.parentContainer !== self.container) {
          self.container.add(spine);
        }
        return spine;
      }
    } catch {
      console.warn(`[Symbols] Failed to create spine symbol ${value}`);
    }
  } else if (value >= 10) {
    try {
      return createMultiplierSymbol(self, value, x, y, alpha);
    } catch {
      console.error('[Symbols] Failed to create multiplier symbol: ', value);
    }
  }

  // Fallback to PNG sprite (pooled)
  const sprite = createPngSymbol(self, value, x, y, alpha);
  // Ensure idle tweening on fallback PNG symbols so they breathe/shine.
  applyIdleTweensToPngSymbol(self, sprite);
  console.warn(`[Symbols] Created fallback PNG sprite for symbol ${value}`);
  return sprite;
}

function createNewSymbols(self: Symbols, data: Data) {
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

  self.isReelDropping = true;
  self.dropSparkPlayedColumns.clear();
  // Reset turbo drop guard so it can fire once during this spin's overshoot.
  self.turboDropSfxPlayedThisSpin = false;

  try {
    // Stagger reel starts at a fixed interval and let them overlap

    // Anticipation disabled: do not check columns for scatter, no reel extension
    const extendLastReelDrop = false;
    try { (self.scene as any).__isScatterAnticipationActive = false; } catch { }

    const reelPromises: Promise<void>[] = [];
    // Adjustable gap between clearing previous symbols and spawning new ones per row
    const PREV_TO_NEW_DELAY_MS = (self.scene.gameData as any)?.prevToNewDelayMs ?? 750;
    // Reverse the sequence: start from bottom row to top row
    for (let step = 0; step < SLOT_COLUMNS; step++) {
      const actualRow = (SLOT_COLUMNS - 1) - step;
      const isLastReel = actualRow === 0;
      const startDelay = gameStateManager.isTurbo ? 0 : self.scene.gameData.dropReelsDelay * step;
      const p = (async () => {
        // Use Phaser time so dialog/scene pauses don't desync reel scheduling
        // await phaserDelay(self.scene, startDelay);
        await delay(startDelay);
        console.log(`[Symbols] Processing row ${actualRow}`);
        dropPrevSymbols(self, actualRow, isLastReel && extendLastReelDrop);

        // Wait before spawning new symbols so previous ones are cleared first
        // await phaserDelay(self.scene, PREV_TO_NEW_DELAY_MS);
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
  } finally {
    self.isReelDropping = false;
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
  const STAGGER_MS = gameStateManager.isTurbo ? 0 : 150; // mirror dropNewSymbols stagger
  const symbolHop = self.scene.gameData.winUpHeight * 0.1;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[Symbols] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }

    // Trigger drop animation on the symbol if available (sugar Spine)
    try { playDropAnimationIfAvailable(self.symbols[i][index]); } catch { }

    const symbol = self.symbols[i][index];
    const targetY = symbol.y + DROP_DISTANCE;

    // Copy dropNewSymbols animation sequencing (hop + optional overshoot/settle)
    // Make previous-symbols clear-out a bit snappier than the main drop by default.
    // You can tune this at runtime via `gameData.dropPrevDurationMultiplier` (e.g. 0.75..0.9).
    const prevDropMultRaw = (self.scene.gameData as any)?.dropPrevDurationMultiplier;
    const prevDropMult =
      (typeof prevDropMultRaw === 'number' && prevDropMultRaw > 0)
        ? prevDropMultRaw
        : 0.8;
    const dropTotalMs = (self.scene.gameData.dropDuration * prevDropMult) + extraMs;
    const overshootPxRaw = (self.scene.gameData as any)?.dropOvershootPx;
    const overshootPx = Math.max(
      0,
      typeof overshootPxRaw === 'number'
        ? overshootPxRaw
        : Math.min(32, Math.max(10, height * 0.2)),
    );
    const fallFracRaw = (self.scene.gameData as any)?.dropOvershootFallFraction;
    const fallFrac = (typeof fallFracRaw === 'number' && fallFracRaw > 0 && fallFracRaw < 1) ? fallFracRaw : 0.7;
    const fallMs = Math.max(1, Math.floor(dropTotalMs * fallFrac));
    const settleMs = Math.max(1, Math.floor(dropTotalMs - fallMs));
    const overshootY = targetY + overshootPx;
    const doOvershoot = overshootPx > 0 && settleMs > 0;

    const tweensArr: any[] = [
      {
        delay: STAGGER_MS * i,
        y: `-= ${symbolHop}`,
        duration: self.scene.gameData.winUpDuration * prevDropMult,
        ease: Phaser.Math.Easing.Circular.Out,
      },
    ];

    if (doOvershoot) {
      tweensArr.push({ y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
      tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out });
    } else {
      tweensArr.push({ y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear });
    }

    self.scene.tweens.chain({
      targets: symbol,
      tweens: tweensArr,
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
  const baseDropMs = self.scene.gameData.dropDuration;
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
            fillerSymbols[i].destroy();
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

    // Play reel drop SFX per-symbol, timed to the overshoot (settle) start.
    const playReelDropSfx = (phase: 'overshoot' | 'landing', col: number) => {
      const playedTurbo = playTurboDropSfxOnce(self, phase);
      if (!playedTurbo) {
        playReelDropSfxIfAllowed(self);
      }
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Playing reel drop sound effect for symbol col ${col}, reel ${index} at ${phase}`);
      }
    };

    for (let col = 0; col < self.newSymbols.length; col++) {
      let symbol = self.newSymbols[col][index];
      const targetY = getYPos(self, index);

      // Trigger drop animation on the new symbol if available (sugar Spine)
      try { playDropAnimationIfAvailable(symbol); } catch { }

      // Overshoot config (optional). If not provided, we use a subtle default based on symbol height.
      const dropTotalMs = (self.scene.gameData.dropDuration * 0.9) + extraMs;
      const overshootPxRaw = (self.scene.gameData as any)?.dropOvershootPx;
      const overshootPx = Math.max(
        0,
        typeof overshootPxRaw === 'number'
          ? overshootPxRaw
          // Bouncy default: a bit more travel, capped so it doesn't look too floaty
          : Math.min(32, Math.max(10, height * 0.2)),
      );
      const fallFracRaw = (self.scene.gameData as any)?.dropOvershootFallFraction;
      // Bouncy default: give settle more time
      const fallFrac = (typeof fallFracRaw === 'number' && fallFracRaw > 0 && fallFracRaw < 1) ? fallFracRaw : 0.7;
      const fallMs = Math.max(1, Math.floor(dropTotalMs * fallFrac));
      const settleMs = Math.max(1, Math.floor(dropTotalMs - fallMs));
      const overshootY = targetY + overshootPx;
      const doOvershoot = overshootPx > 0 && settleMs > 0;

      const onLanding = () => {
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
      };

      const tweensArr: any[] = [
        {
          delay: STAGGER_MS * col,
          y: `-= ${symbolHop}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
      ];

      if (doOvershoot) {
        tweensArr.push({ y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
        // Back.Out gives a springy settle (it will briefly overshoot past the target and return)
        tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out, onStart: () => playReelDropSfx('overshoot', col), onComplete: onLanding });
      } else {
        tweensArr.push({ y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear, onComplete: () => { playReelDropSfx('landing', col); onLanding(); } });
      }

      self.scene.tweens.chain({
        targets: symbol,
        tweens: tweensArr
      })
    }
  });
}

function disposeSymbols(self: Symbols, symbols: any[][]) {
  if (!symbols) return;
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;

  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol = symbols[col][row];
      if (!symbol) continue;

      // try { self.scene.tweens.killTweensOf(symbol); } catch { }

      try {
        if ((symbol as any).__spinePoolKey) {
          releaseSpineToPool(self, symbol as any);
        } else if (symbol.animationState) {
          symbol.destroy();
        } else {
          releaseSpriteToPool(self, symbol as any);
        }
        disposedCount++;
      } catch (error) {
        console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
      } finally {
        symbols[col][row] = null as any;
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

function playReelDropSfxIfAllowed(self: Symbols): void {
  try {
    if ((window as any).audioManager) {
      (window as any).audioManager.playSoundEffect(
        gameStateManager.isBonus ? SoundEffectType.BONUS_REEL_DROP : SoundEffectType.REEL_DROP
      );
    }
  } catch { }
}

/**
 * Guarded turbo drop SFX trigger.
 * Fires once per spin, specifically at the start of the overshoot phase.
 */
function playTurboDropSfxOnce(self: Symbols, phase: 'overshoot' | 'landing'): boolean {
  try {
    const isTurbo = !!(self?.scene?.gameData?.isTurbo || gameStateManager.isTurbo);
    if (!isTurbo) return false;
    // Only allow during the overshoot start and once per spin.
    if (phase !== 'overshoot' || self.turboDropSfxPlayedThisSpin) return false;

    const audio = (window as any)?.audioManager;
    if (!audio || typeof audio.playSoundEffect !== 'function') return false;

    const sfx = gameStateManager.isBonus ? SoundEffectType.BONUS_TURBO_DROP : SoundEffectType.TURBO_DROP;
    audio.playSoundEffect(sfx);
    self.turboDropSfxPlayedThisSpin = true;
    console.log('[Symbols] Playing turbo drop sound effect at overshoot start', { sfx });
    return true;
  } catch (e) {
    console.warn('[Symbols] Failed to play turbo drop SFX:', e);
    return false;
  }
}

function reevaluateWinsFromGrid(self: Symbols): void {
  try {
    // Build Data with current row-major symbols
    const dt = new Data();
    // Ensure currentSymbolData is populated; if not, derive from self.symbols
    if (!self.currentSymbolData) {
      const numCols = self.symbols?.length || 0;
      const numRows = numCols > 0 ? (self.symbols[0]?.length || 0) : 0;
      const rowMajor: number[][] = [];
      for (let row = 0; row < numRows; row++) {
        rowMajor[row] = [];
        for (let col = 0; col < numCols; col++) {
          // Attempt to read a value property stored during drops; fallback to 0
          try {
            const obj: any = self.symbols[col][row];
            const val = self.currentSymbolData?.[row]?.[col];
            rowMajor[row][col] = typeof val === 'number' ? val : (obj?.symbolValue ?? 0);
          } catch {
            rowMajor[row][col] = 0;
          }
        }
      }
      dt.symbols = rowMajor;
    } else {
      dt.symbols = self.currentSymbolData;
    }

    // Compute wins using SymbolDetector
    const wins = self.symbolDetector.getWins(dt);
    dt.wins = wins;
    console.log('[Symbols] Re-evaluated wins after drop:', { matchCount: wins.symbolCounts.size });

    if (wins.symbolCounts.size > 0) {
      console.log('[Symbols] Symbol counts:', wins.symbolCounts.entries());
      gameEventManager.emit(GameEventType.WIN_START);
    }

    // Apply highlighting only if not disabled
    if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
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
    // Reset the sequence counter for fly-out animations to ensure proper staggering
    (animateMultiplierValueToPosition as any)._seq = 0;
    
    const cols = self.symbols?.length || 0;
    const rows = cols > 0 && self.symbols[0] ? self.symbols[0].length : 0;

    const isTurbo = (self.scene as any)?.gameData?.isTurbo || gameStateManager.isTurbo;
    const baseTimeScale = self.getSymbolWinTimeScale(10);
    const timeScale = isTurbo
      ? baseTimeScale * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
      : baseTimeScale;

    // We want multiplier symbols to feel "counted" and readable, so stagger their animation starts.
    // Requirement: 500ms delay between each multiplier symbol being animated, applied BEFORE the spine animation starts.
    const MULTIPLIER_ANIM_STAGGER_MS = 750;

    // We wait for the longest end-time (startOffset + duration), then subtract the time we've already spent staggering.
    let maxEndOffsetMs = 0;
    const flyOutPromises: Promise<void>[] = [];

    const processSymbol = (symbolObj: any, fallbackValue?: number): number | null => {
      const symbolValue = typeof fallbackValue === 'number'
        ? fallbackValue
        : (symbolObj as any)?.symbolValue;

      if (typeof symbolValue !== 'number' || symbolValue < 10) return null;

      try {
        if (self.container?.bringToTop && self.container.list?.includes(symbolObj)) {
          self.container.bringToTop(symbolObj);
        } else if (symbolObj?.parentContainer?.bringToTop) {
          symbolObj.parentContainer.bringToTop(symbolObj);
        }

        if (typeof symbolObj?.setDepth === 'function') {
          symbolObj.setDepth(Symbols.MULTIPLIER_FRONT_DEPTH);
        }
      } catch (err) {
        console.warn('[Symbols] Failed to elevate multiplier symbol depth:', err);
      }

      const state = symbolObj?.animationState;
      const skeletonData: any = symbolObj?.skeleton?.data;
      if (!state) return null;

      // Prefer the currently assigned animation, otherwise find one that matches the multiplier value.
      let animationName = state.tracks?.[0]?.animation?.name;
      if (!animationName) {
        animationName =
          self.findMultiplierAnimationNameByIndex(symbolObj, symbolValue) ??
          skeletonData?.animations?.[0]?.name ??
          null;
      }

      let animDurationMs: number | null = null;
      if (animationName) {
        // Play multiplier-hit SFX right when the multiplier spine animation starts.
        try {
          const audio = (window as any)?.audioManager;
          if (audio && typeof audio.playSoundEffect === 'function') {
            audio.playSoundEffect(SoundEffectType.MULTIPLIER_HIT);
          }
        } catch { }
        // Clear the track first to ensure the animation restarts from the beginning
        // This is important when multiple multipliers need to animate in quick succession
        try {
          state.clearTrack(0);
          state.setAnimation(0, animationName, false);
        } catch { }
        // Estimate duration so we can await the longest-running animation.
        const animDurationSec =
          skeletonData?.findAnimation?.(animationName)?.duration ??
          skeletonData?.animations?.[0]?.duration;
        if (typeof animDurationSec === 'number' && animDurationSec > 0 && timeScale > 0) {
          animDurationMs = (animDurationSec * 1000) / timeScale;
        }
      }

      try { state.timeScale = timeScale; } catch { }

      // After the spine animation completes, fly the multiplier value to the header
      const symbolX = (symbolObj as any)?.x;
      const symbolY = (symbolObj as any)?.y;
      if (typeof symbolX === 'number' && typeof symbolY === 'number') {
        // Start the value fly-out slightly BEFORE the multiplier symbol animation completes.
        // This keeps the UI feeling snappier and better synced to the end of the spine motion.
        const FLY_OUT_EARLY_MS = 200;
        const delayMs = Math.max(0, (animDurationMs ?? 0) - FLY_OUT_EARLY_MS);
        flyOutPromises.push((async () => {
          try {
            if (delayMs > 0) {
              await delay(delayMs);
            }
            await animateMultiplierValueToPosition(self, symbolValue, symbolX, symbolY);
          } catch (err) {
            console.warn('[Symbols] Failed to animate multiplier fly-out:', err);
          }
        })());
      }

      return animDurationMs ?? 0;
    };

    if (cols && rows) {
      // Scan the current grid for multiplier symbols (value >= 10), then animate them sequentially.
      const multiplierSymbols: Array<{ symbolObj: any; symbolValue: number }> = [];
      // Invert the col and row loop so that it starts from the end of the array, and swap the row and col loops
      for (let col = cols - 1; col >= 0; col--) {
        for (let row = rows - 1; row >= 0; row--) {
          const gridValue = self.currentSymbolData?.[row]?.[col];
          const symbolObj: any = self.symbols[col]?.[row];
          const symbolValue = typeof gridValue === 'number' ? gridValue : (symbolObj as any)?.symbolValue;
          if (typeof symbolValue === 'number' && symbolValue >= 10 && symbolObj?.animationState) {
            multiplierSymbols.push({ symbolObj, symbolValue });
          }
        }
      }

      let startOffsetMs = 0;
      for (let i = 0; i < multiplierSymbols.length; i++) {
        // Apply the requested 500ms gap *before* the next multiplier's spine animation starts.
        if (i > 0) {
          await phaserDelay(self.scene, MULTIPLIER_ANIM_STAGGER_MS);
          startOffsetMs += MULTIPLIER_ANIM_STAGGER_MS;
        }

        const { symbolObj, symbolValue } = multiplierSymbols[i];
        const animDurationMs = processSymbol(symbolObj, symbolValue) ?? 0;
        const endOffsetMs = startOffsetMs + Math.max(0, animDurationMs);
        if (endOffsetMs > maxEndOffsetMs) {
          maxEndOffsetMs = endOffsetMs;
        }
      }

      // We already "spent" startOffsetMs time waiting between symbol starts.
      // Wait only the remaining time until the longest-running (staggered) animation should have ended.
      const remainingMs = Math.max(0, maxEndOffsetMs - startOffsetMs);
      const waitAnimations = remainingMs > 0 ? phaserDelay(self.scene, remainingMs) : Promise.resolve();
      const waitFlyOuts = flyOutPromises.length ? Promise.all(flyOutPromises) : Promise.resolve();
      await Promise.all([waitAnimations, waitFlyOuts]);
      return;
    }

    // No grid to scan; just resolve.
    const waitAnimations = Promise.resolve();
    const waitFlyOuts = flyOutPromises.length ? Promise.all(flyOutPromises) : Promise.resolve();
    await Promise.all([waitAnimations, waitFlyOuts]);
  } catch (err) {
    console.warn('[Symbols] Failed to play multiplier symbol animations:', err);
  }
}

async function animateMultiplierValueToPosition(self: Symbols, value: number, x: number, y: number): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const scene = self?.scene;
      if (!scene) {
        resolve();
        return;
      }

      // Hardcoded win bar position (matches HUD ratios)
      const targetX = scene.scale.width * 0.75;
      // Positive Y goes downward in Phaser, so a positive offset lands slightly LOWER than the win bar.
      // Scaled to screen height so it remains subtle but consistent across resolutions.
      const targetY = scene.scale.height * 0.1575;

      // Reuse the multiplier bar texture so we know the asset is available
      const baseScale = self.getSpineSymbolScale(value);
      // Pre-flight scale punch: scale up to 3.0, then settle at 2.0 before traveling.
      // Applied relative to the symbol's baseScale so it stays consistent across resolutions.
      const MULTIPLIER_PREFLIGHT_SCALE_UP = 3.0;
      const MULTIPLIER_TRAVEL_SCALE = 2.0;
      const travelScale = baseScale * MULTIPLIER_TRAVEL_SCALE;
      const multiplierNumber = `multiplier_number_${value}x`;
      const floatImage = scene.add.image(x, y, multiplierNumber)
        .setOrigin(0.5, 0.5)
        .setScale(baseScale)
        .setDepth(900);

      // Keep the value attached for debugging/telemetry if needed
      try { floatImage.setData?.('multiplierValue', value); } catch { }

      // Stagger multiplier fly-outs so they don't all launch at once.
      const seq = typeof (animateMultiplierValueToPosition as any)._seq === 'number'
        ? (animateMultiplierValueToPosition as any)._seq
        : 0;
      const baseStaggerMs = 90;
      const jitterMs = Phaser.Math.Between(0, 45);
      const startDelayMs = seq * baseStaggerMs + jitterMs;
      (animateMultiplierValueToPosition as any)._seq = seq + 1;

      const emitMultiplierLanded = () => {
        try {
          const mappedValue = self?.multiplierIndexMapping?.[value];
          if (typeof mappedValue === 'number') {
            gameEventManager.emit(
              GameEventType.UPDATE_MULTIPLIER_VALUE,
              { multiplier: mappedValue } as UpdateMultiplierValueEventData
            );
          } else {
            console.warn('[Symbols] Multiplier mapping missing for symbol index:', value);
          }
        } catch (err) {
          console.warn('[Symbols] Failed to emit multiplier update:', err);
        }
      };

      const kickOff = () => {
        // Pick a tween variant (structure allows adding more variants later)
        const variant = MULTIPLIER_TWEEN_VARIANTS[
          Math.floor(Math.random() * MULTIPLIER_TWEEN_VARIANTS.length)
        ] || tweenMultiplierLine;

        // Ensure the scale punch completes BEFORE any movement begins.
        tweenMultiplierPreFlightScale(scene, floatImage, { baseScale, scaleUpTo: baseScale * MULTIPLIER_PREFLIGHT_SCALE_UP, settleTo: travelScale })
          .catch(() => { /* if scale tween fails, still attempt the flight */ })
          .then(() => variant(scene, floatImage, { startX: x, startY: y, targetX, targetY, baseScale, travelScale }))
          .then(() => {
            emitMultiplierLanded();
            resolve();
          })
          .catch((err: any) => {
            console.warn('[Symbols] Multiplier tween variant failed:', err);
            try { floatImage.destroy(); } catch { }
            emitMultiplierLanded();
            resolve();
          });
      };

      if (startDelayMs > 0) {
        delay(startDelayMs).then(kickOff);
      } else {
        kickOff();
      }
    } catch (err) {
      console.warn('[Symbols] Failed to animate multiplier value to header:', err);
      resolve();
    }
  });
}

type MultiplierTweenParams = {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  baseScale: number;
  travelScale: number;
};

function tweenMultiplierPreFlightScale(
  scene: any,
  floatImage: any,
  params: { baseScale: number; scaleUpTo: number; settleTo: number }
): Promise<void> {
  const { baseScale, scaleUpTo, settleTo } = params;
  return new Promise<void>((resolve) => {
    try {
      // If the object is already gone or the tween manager isn't available, just continue.
      if (!scene?.tweens?.addTimeline || !floatImage || floatImage?.destroyed) {
        try { floatImage?.setScale?.(settleTo ?? baseScale); } catch { }
        resolve();
        return;
      }

      scene.tweens.addTimeline({
        targets: floatImage,
        tweens: [
          {
            duration: 170,
            scale: scaleUpTo,
            ease: Phaser.Math.Easing.Cubic.Out,
          },
          {
            duration: 140,
            scale: settleTo,
            ease: Phaser.Math.Easing.Cubic.Out,
          },
        ],
        onComplete: () => resolve(),
      });
    } catch {
      try { floatImage?.setScale?.(settleTo ?? baseScale); } catch { }
      resolve();
    }
  });
}

// Variant 0: straight-line flight to the target (win bar) using an ease-in-out.
function tweenMultiplierLine(scene: any, floatImage: any, params: MultiplierTweenParams): Promise<void> {
  const { startX: x, startY: y, targetX, targetY, travelScale } = params;

  return new Promise<void>((resolve) => {
    try {
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Slower, smoother travel than the arc variant
      const duration = Phaser.Math.Clamp(distance * 2.80, 900, 2600);

      scene.tweens.add({
        targets: floatImage,
        duration,
        x: targetX,
        y: targetY,
        ease: Phaser.Math.Easing.Sine.InOut,
        onComplete: () => {
          // Small "pop" and fade-out on arrival
          scene.tweens.add({
            targets: floatImage,
            duration: 180,
            scale: travelScale * 1.15,
            alpha: 0,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => {
              try { floatImage.destroy(); } catch { }
              resolve();
            },
          });
        },
      });
    } catch {
      try { floatImage.destroy(); } catch { }
      resolve();
    }
  });
}

// Variant 1: basketball-style arc shot toward the multiplier bar (ring)
function tweenMultiplierArc(scene: any, floatImage: any, params: MultiplierTweenParams): Promise<void> {
  const { startX: x, startY: y, targetX, targetY, travelScale } = params;

  return new Promise<void>((resolve) => {
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const arcLift = Math.max(80, Math.min(200, distance * 0.25));
    const apexX = x + dx * 0.5 + dx * 0.08; // slight additional X drift near apex
    const apexY = Math.min(y, targetY) - arcLift;
    const driftAtApex = dx * 0.12;
    const tinyFall = Math.min(8, arcLift * 0.03);

    // Phase 1: quick shoot upward
    scene.tweens.add({
      targets: floatImage,
      duration: 320,
      x: x + dx * 0.45,
      y: apexY,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        // Phase 2: brief rest at apex (minimal vertical movement, slight X drift)
        scene.tweens.add({
          targets: floatImage,
          duration: 240,
          x: apexX + driftAtApex,
          y: apexY + tinyFall,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => {
            // Phase 3: controlled drop toward the ring
            scene.tweens.add({
              targets: floatImage,
              duration: 780,
              x: targetX,
              y: targetY,
              scale: travelScale,
              alpha: 1,
              ease: Phaser.Math.Easing.Cubic.Out,
              onComplete: () => {
                scene.tweens.add({
                  targets: floatImage,
                  duration: 180,
                  scale: travelScale * 1.15,
                  alpha: 0,
                  ease: Phaser.Math.Easing.Cubic.Out,
                  onComplete: () => {
                    try { floatImage.destroy(); } catch { }
                    resolve();
                  },
                });
              },
            });
          },
        });
      },
    });
  });
}

// Variant 2: ricochet bounce off screen edges, then a top bounce, then into the ring
function tweenMultiplierRicochet(scene: any, floatImage: any, params: MultiplierTweenParams): Promise<void> {
  const { startX: x, startY: y, targetX, targetY, travelScale } = params;

  return new Promise<void>((resolve) => {
    try {
      const width = scene.scale?.width ?? 720;
      const height = scene.scale?.height ?? 1280;
      const margin = 8; // tighter buffer so ricochets appear near the edge

      // Row-based ricochet count: fewer on top half, slightly more on bottom half
      const startRatio = height > 0 ? y / height : 0.5;
      let bounceCount = 2;
      if (startRatio < 0.5) {
        bounceCount = 1 + Math.floor(Math.random() * 2); // 1-2 ricochets
      } else {
        bounceCount = 2 + Math.floor(Math.random() * 2); // 2-3 ricochets
      }

      const points: Array<{ x: number; y: number }> = [];
      let currentX = x;
      let currentY = y;

      // Ensure starting direction alternates between calls
      const startLeft = (() => {
        if (typeof (tweenMultiplierRicochet as any)._lastStartLeft === 'boolean') {
          return !(tweenMultiplierRicochet as any)._lastStartLeft;
        }
        return x >= width * 0.5; // initial seed based on position
      })();
      (tweenMultiplierRicochet as any)._lastStartLeft = startLeft;

      let nextSideLeft = startLeft;

      // Side ricochets
      for (let i = 0; i < bounceCount; i++) {
        const towardLeft = nextSideLeft; // alternate sides
        const targetSideX = towardLeft ? margin : width - margin;
        const ascent = Phaser.Math.Between(Math.floor(height * 0.08), Math.floor(height * 0.16));
        const targetSideY = Math.max(margin + 4, currentY - ascent); // always move up with tiny buffer
        points.push({ x: targetSideX, y: targetSideY });
        currentX = targetSideX;
        currentY = targetSideY;
        nextSideLeft = !nextSideLeft; // flip for the next bounce
      }

      // One last ricochet at the top, then to the ring
      const topX = Phaser.Math.Between(Math.floor(width * 0.2), Math.floor(width * 0.8));
      const topY = margin;
      points.push({ x: topX, y: topY });
      points.push({ x: targetX, y: targetY });

      const tweenToPoint = (toX: number, toY: number, ease: any, isFinalLeg: boolean) => {
        const dx = (floatImage.x ?? 0) - toX;
        const dy = (floatImage.y ?? 0) - toY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speedFactor = isFinalLeg ? 1.0 : 0.8; // faster on side hops, normal on final leg
        const duration = Phaser.Math.Clamp(dist * speedFactor * 1.35, 220, isFinalLeg ? 720 : 560);
        return new Promise<void>((res) => {
          scene.tweens.add({
            targets: floatImage,
            x: toX,
            y: toY,
            duration,
            ease,
            onComplete: () => res(),
          });
        });
      };

      (async () => {
        for (let i = 0; i < points.length; i++) {
          const isLastLeg = i === points.length - 1;
          const isTopBounce = i === points.length - 2;
          const useEase = isLastLeg ? Phaser.Math.Easing.Cubic.Out : Phaser.Math.Easing.Linear;
          await tweenToPoint(points[i].x, points[i].y, useEase, isLastLeg);
        }

        scene.tweens.add({
          targets: floatImage,
          duration: 160,
          scale: travelScale * 1.1,
          alpha: 0,
          ease: Phaser.Math.Easing.Cubic.Out,
          onComplete: () => {
            try { floatImage.destroy(); } catch { }
            resolve();
          },
        });
      })().catch(() => {
        try { floatImage.destroy(); } catch { }
        resolve();
      });
    } catch {
      try { floatImage.destroy(); } catch { }
      resolve();
    }
  });
}

// Register available tween variants here to allow easy randomization/expansion.
const MULTIPLIER_TWEEN_VARIANTS: Array<(scene: any, floatImage: any, params: MultiplierTweenParams) => Promise<void>> = [
  tweenMultiplierLine,
  // tweenMultiplierArc,
  // tweenMultiplierRicochet,
];


/**
 * Play a sound effect when a tumble step is applied.
 * Uses turbo drop SFX when turbo is active, otherwise uses the regular reel drop SFX.
 */
function playTumbleSfx(self: Symbols): void {
  console.log('[Symbols] Playing tumble sound effect');
  try {
    const audio = (window as any)?.audioManager;
    if (!audio || typeof audio.playSoundEffect !== 'function') {
      return;
    }

    let sfxType: SoundEffectType = SoundEffectType.TWIN1;
    switch (self.scene.gameAPI.getCurrentTumbleIndex()) {
      case 0:
        sfxType = SoundEffectType.TWIN1;
        break;
      case 1: 
        sfxType = SoundEffectType.TWIN2;
        break;
      case 2:
        sfxType = SoundEffectType.TWIN3;
        break;
      default:
        sfxType = SoundEffectType.TWIN4;
        break;
    }
    audio.playSoundEffect(sfxType);
    console.log('[Symbols] Playing tumble sound effect', { sfxType });
  } catch (e) {
    console.warn('[Symbols] Failed to play tumble SFX:', e);
  }
}

/**
 * Map the symbol index to the hit/effect sound effect that should be used.
 * Lower symbol indices take precedence when multiple symbols are removed.
 */
function resolveSymbolHitSfx(symbolIndex: number): SoundEffectType | null {
  if (!Number.isFinite(symbolIndex) || symbolIndex <= 0) {
    return null;
  }
  if (symbolIndex === 1) {
    return SoundEffectType.SYMBOL_PUNCH;
  }
  if (symbolIndex === 2) {
    return SoundEffectType.SYMBOL_PAU;
  }
  if (symbolIndex === 3) {
    return SoundEffectType.HIT_WIN;
  }
  if (symbolIndex === 4) {
    return SoundEffectType.SYMBOL_NYET;
  }
  return SoundEffectType.SYMBOL_KISS;
}

/**
 * Apply a sequence of tumble steps: remove "out" symbols, compress columns down, and drop "in" symbols from top.
 * Expects tumbles to be in the SpinData format: [{ symbols: { in: number[][], out: {symbol:number,count:number,win:number}[] }, win: number }, ...]
 */
async function applyTumbles(self: Symbols, tumbles: any[], mockData?: Data): Promise<void> {
  for (const tumble of tumbles) {
    self.scene.gameAPI.incrementCurrentTumbleIndex();
    await applySingleTumble(self, tumble);
  }

  // Synchronize mockData.symbols with the current grid state after all tumbles
  // Convert from row-major (self.currentSymbolData[row][col]) to column-major (col[row])
  // with bottom-to-top indexing within each column to match SpinData format
  if (mockData && self.currentSymbolData && self.currentSymbolData.length > 0) {
    try {
      const numRows = self.currentSymbolData.length;
      const numCols = self.currentSymbolData[0]?.length ?? 0;
      const columnMajor: number[][] = [];
      for (let col = 0; col < numCols; col++) {
        columnMajor[col] = [];
        for (let row = 0; row < numRows; row++) {
          // Convert row-major to column-major with bottom-to-top indexing
          // SpinData uses bottom->top, so row 0 (bottom) becomes last index in column
          const value = self.currentSymbolData[row]?.[col] ?? 0;
          columnMajor[col][numRows - 1 - row] = value;
        }
      }
      mockData.symbols = columnMajor;
      console.log('[Symbols] Synchronized mockData.symbols with updated grid after tumbles');
    } catch (e) {
      console.warn('[Symbols] Failed to synchronize mockData.symbols:', e);
    }
  }

  // Notify listeners that all tumbles have completed
  try {
    gameEventManager.emit(GameEventType.SYMBOLS_TUMBLES_COMPLETE);
  } catch (e) {
    console.warn('[Symbols] Failed to emit SYMBOLS_TUMBLES_COMPLETE:', e);
  }
}

async function applySingleTumble(self: Symbols, tumble: any): Promise<void> {
  self.dropSparkPlayedColumns.clear();
  // NOTE: `out` entries can include a per-symbol win amount coming from the game API / scenarios.
  const outs = (tumble?.symbols?.out || []) as Array<{ symbol: number; count: number; win?: number }>;
  const ins = (tumble?.symbols?.in || []) as number[][]; // per real column (x index)
  let symbolHitSfxSelection: { type: SoundEffectType; priority: number } | undefined = undefined;

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

  // Debug: per-column removal vs incoming
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

  try { self.showWinningOverlay(); } catch { }

  // Track unique winning symbols and their positions for win amount popup
  const uniqueWinningSymbols = new Map<number, Array<{ x: number; y: number; row?: number; isEdge: boolean }>>();
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      if (removeMask[col][row]) {
        const obj = self.symbols[col][row];
        if (obj) {
          // Select a single "hit" SFX for the tumble step synchronously.
          // (Don't do this only inside Promise executors; TypeScript may treat it as async and infer unreachable usage later.)
          try {
            const value = self.currentSymbolData?.[row]?.[col];
            const vNum = Number(value);
            const sfxTypeCandidate = resolveSymbolHitSfx(vNum);
            if (sfxTypeCandidate !== null) {
              const candidatePriority = Number.isFinite(vNum) ? vNum : Number.POSITIVE_INFINITY;
              if (Number.isFinite(candidatePriority)) {
                if (!symbolHitSfxSelection || candidatePriority < symbolHitSfxSelection.priority) {
                  symbolHitSfxSelection = { type: sfxTypeCandidate, priority: candidatePriority };
                }
              }
            }
          } catch { }

          removalPromises.push(new Promise<void>((resolve) => {
            try {
              const value = self.currentSymbolData?.[row]?.[col];
              const vNum = Number(value);
              const x = obj.x;
              const y = obj.y;

              // Record positions for win amount popup for all valid symbols (including image-only)
              if (Number.isFinite(vNum)) {
                try {
                  const isEdge = col === 0 || col === numCols - 1 || row === 0 || row === numRows - 1;
                  if (!uniqueWinningSymbols.has(vNum)) {
                    uniqueWinningSymbols.set(vNum, []);
                  }
                  uniqueWinningSymbols.get(vNum)!.push({ x, y, row, isEdge });
                } catch { }
              }

              // Replace fade with Spine effect for matched symbols
              const isIndex1to9 = Number.isFinite(vNum) && vNum >= 1 && vNum <= 9;
              if (isIndex1to9) {
                // Choose effect by index range
                // const spineKey = (vNum >= 1 && vNum <= 5) ? 'Symbol_HP_256' : 'Symbol_LP_256';
                // Use the same spine keys that are loaded in AssetConfig (symbol{n}_spine)
                const spineKey = `symbol${vNum}_spine`;
                const spineAtlasKey = `${spineKey}-atlas`;

                // Remove the matched symbol immediately; effect will play at its position
                try { self.scene.tweens.killTweensOf(obj); } catch { }
                try { obj.destroy(); } catch { }
                self.symbols[col][row] = null as any;
                if (self.currentSymbolData && self.currentSymbolData[row]) {
                  (self.currentSymbolData[row] as any)[col] = null;
                }

                // Unified resolver to avoid double-complete
                let completed = false;
                const finish = () => { if (completed) return; completed = true; resolve(); };

                // PNG fallback helper when Spine create/anim fails
                const fallbackToPng = () => {
                  try {
                    const durationMs = 300;
                    const png = createPngSymbol(self, vNum, x, y, 1);
                    try { self.container?.add?.(png); } catch { }
                    try { self.moveSymbolToFront(png); } catch { }
                    try { scheduleScaleUp(self, png, 20, durationMs, 1.1); } catch { }
                    try { scheduleTranslate(self, png, 20, durationMs, 0, -3); } catch { }
                    self.scene.time.delayedCall(durationMs, () => {
                      try { png.destroy(); } catch { }
                      // Spawn a brief hit effect when the PNG is removed
                      const playHitEffect = () => {
                        try {
                          if (!ensureSpineFactory(self.scene, '[Symbols] playHitEffect')) return finish();
                          const effect = self.scene.add.spine(x, y, 'hit_effect', 'hit_effect-atlas');
                          try { effect.setOrigin(0.5, 0.5); } catch { }
                          try { effect.setScale(0.25); } catch { }
                          try { self.moveSymbolToFront(effect); } catch { }

                          let effectDurationMs = 500;
                          const onEffectDone = () => {
                            try { effect.destroy(); } catch { }
                            finish();
                          };

                          try {
                            const animationName = effect.skeleton?.data?.animations?.[0]?.name || 'animation';
                            let entry: any = null;
                            if (effect.animationState?.setAnimation) {
                              entry = effect.animationState.setAnimation(0, animationName, false);
                            }
                            effectDurationMs = Math.max(100, getSpineAnimationDurationMs(effect, animationName, effectDurationMs));
                            try {
                              if (entry && (entry.setListener || 'listener' in entry)) {
                                if (typeof entry.setListener === 'function') {
                                  entry.setListener({ complete: onEffectDone, end: onEffectDone });
                                } else {
                                  entry.listener = { complete: onEffectDone, end: onEffectDone };
                                }
                              }
                            } catch { }
                            try { effect.animationState?.addListener?.({ complete: onEffectDone, end: onEffectDone } as any); } catch { }
                          } catch {
                            onEffectDone();
                            return;
                          }

                          // Safety in case listeners don't fire
                          self.scene.time.delayedCall(effectDurationMs + 100, () => onEffectDone());
                        } catch {
                          finish();
                        }
                      };

                      playHitEffect();
                    });
                  } catch {
                    finish();
                  }
                };

                try {
                  if (!ensureSpineFactory(self.scene, '[Symbols] playWinLineFx')) throw new Error('Spine factory unavailable');
                  const fx = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
                  try { fx.setOrigin(0.5, 0.5); } catch { }
                  // Fit effect to symbol box for consistent sizing
                  try {
                    fx.setScale(self.getSpineSymbolScale(vNum));
                    // fitSpineToSymbolBox(self, fx); 
                  } catch { }

                  let animationDuration = 1000;
                  try {
                    // High-paying symbols (<=5) have explicit win animations; low-paying reuse idle/wiggle
                    const animationName = `Symbol${vNum}_RF_win`;
                    if (fx.animationState && fx.animationState.setAnimation) {
                      // Set animation and attach listener to TrackEntry if possible
                      const entry: any = fx.animationState.setAnimation(0, animationName, false);
                      // Apply configured time scale (use self scope)
                      try { fx.animationState.timeScale = self.scene.gameData.isTurbo ? self.getSymbolWinTimeScale(vNum) * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : self.getSymbolWinTimeScale(vNum); } catch { }
                      // Resolve duration from skeleton data
                      try {
                        const dur = fx.skeleton?.data?.findAnimation?.(animationName)?.duration;
                        animationDuration = (typeof dur === 'number' ? dur : 0.798) * 1000 * (fx.animationState.timeScale || 1);
                      } catch {
                        animationDuration = 1000 * (fx.animationState.timeScale || 1);
                      }
                      // Unified completion handler
                      const onDone = () => {
                        console.log('[Symbols] Animation complete (track/state listener)');
                          try { fx.destroy(); } catch { }
                        finish();
                      };
                      // Prefer TrackEntry listener if available
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
                        if (fx.animationState && fx.animationState.addListener) {
                          fx.animationState.addListener({ complete: onDone, end: onDone } as any);
                        }
                      } catch {
                        console.warn('[Symbols] Failed to animate symbols using spine animation');
                      }
                    } else {
                      console.warn('[Symbols] Spine animationState missing, falling back to PNG');
                      try { fx.destroy(); } catch { }
                      fallbackToPng();
                      return;
                    }

                    try { self.moveSymbolToFront(fx); } catch { }
                    try { scheduleScaleUp(self, fx, 20, 200, 1.05); } catch { }
                    try { scheduleTranslate(self, fx, 20, 200, 0, -3); } catch { }
                  } catch {
                    try { fx.destroy(); } catch { }
                    fallbackToPng();
                    return;
                  }

                  console.log('[Symbols] Animation duration:', animationDuration);
                  // Safety timeout in case Spine complete event does not fire
                  self.scene.time.delayedCall(Math.max(animationDuration, self.scene.gameData.winUpDuration + animationDuration), () => {
                    if (completed) return; completed = true;
                    try { fx.destroy(); } catch { }
                    resolve();
                  });
                } catch {
                  // Fallback to PNG if spine creation fails
                  fallbackToPng();
                }
              } else {
                // Non-sugar or unsupported index: soften the removal but still give a pop.
                try { self.scene.tweens.killTweensOf(obj); } catch { }
                try { scheduleScaleUp(self, obj, 20, 200, 1.5); } catch { }
                try { scheduleTranslate(self, obj, 20, 200, 0, -10); } catch { }
                console.log('[Symbols] Animation complete (tween fallback)');
              }

            } catch {
              try { obj.destroy(); } catch { }
              self.symbols[col][row] = null as any;
              if (self.currentSymbolData && self.currentSymbolData[row]) {
                (self.currentSymbolData[row] as any)[col] = null;
              }
              console.log('[Symbols] Animation complete (fallback)');
              resolve();
            }
          }));
        } else {
          self.symbols[col][row] = null as any;
          if (self.currentSymbolData && self.currentSymbolData[row]) {
            (self.currentSymbolData[row] as any)[col] = null;
          }
          console.log('[Symbols] Animation complete (no object)');
        }
      }
    }
  }

  // Schedule win amount popup once per unique winning symbol, preferring non-edge positions
  const usedRows = new Set<number>();
  for (const [symbolValue, positions] of uniqueWinningSymbols.entries()) {
    try {
      // Prefer non-edge positions, fallback to edge positions
      const nonEdgePositions = positions.filter(p => !p.isEdge);
      const positionsToChooseFrom = nonEdgePositions.length > 0 ? nonEdgePositions : positions;

      // Prefer a position whose row is not already used by other selections
      const rowDistinctChoices = positionsToChooseFrom.filter(p => typeof p.row === 'number' && !usedRows.has(p.row));
      const selectionPool = rowDistinctChoices.length > 0 ? rowDistinctChoices : positionsToChooseFrom;

      const randomIndex = Math.floor(Math.random() * selectionPool.length);
      const selectedPosition = selectionPool[randomIndex];
      if (typeof selectedPosition.row === 'number') {
        usedRows.add(selectedPosition.row);
      }

      // Calculate win amount for this unique symbol for THIS tumble step only.
      // `uniqueWinningSymbols` is derived from the current tumble's removal mask, so summing across all tumble items is incorrect here.
      const matchingOut = outs.find(o => Number(o?.symbol) === Number(symbolValue));
      const displayAmount = Number(matchingOut?.win ?? 0) || 0;

      const delayMs = 500 / (self.scene.gameData.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1);
      const durationMs = 1000;
      scheduleWinAmountPopup(self, selectedPosition.x, selectedPosition.y, displayAmount, delayMs, durationMs);
    } catch { }
  }

  if (symbolHitSfxSelection) {
    try {
      const audio = (window as any)?.audioManager;
      if (audio && typeof audio.playSingleInstanceSoundEffect === 'function') {
        // symbolHitSfxSelection is an object { type, priority }; AudioManager expects the SoundEffectType key
        audio.playSingleInstanceSoundEffect(symbolHitSfxSelection.type);
      }
    } catch { }
  }

  await Promise.all(removalPromises);

  try { self.hideWinningOverlay(); } catch { }

  // Base stagger for tumble compression (existing symbols moving down)
  const STAGGER_MS = 50;

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
          const compressionDelay = STAGGER_MS * col * (self.scene?.gameData?.compressionDelayMultiplier ?? 1);
          const compressionTotalMs = self.scene.gameData.dropDuration / 2;
          
          // Overshoot config for compression
          const overshootPxRaw = self.scene.gameData?.compressionOvershootPx;
          const overshootPx = Math.max(
            0,
            typeof overshootPxRaw === 'number'
              ? overshootPxRaw
              // Bouncy default
              : Math.min(32, Math.max(10, symbolTotalHeight * 0.15)),
          );
          const fallFracRaw = self.scene.gameData?.compressionOvershootFallFraction;
          const fallFrac = (typeof fallFracRaw === 'number' && fallFracRaw > 0 && fallFracRaw < 1) ? fallFracRaw : 0.65;
          const fallMs = Math.max(1, Math.floor(compressionTotalMs * fallFrac));
          const settleMs = Math.max(1, Math.floor(compressionTotalMs - fallMs));
          const overshootY = targetY + overshootPx;
          const doOvershoot = overshootPx > 0 && settleMs > 0;

          if (doOvershoot) {
            // Use chain for overshoot: fall to overshoot, then settle to target
            const tweensArr: any[] = [
              {
                delay: compressionDelay,
                y: overshootY,
                duration: fallMs,
                ease: Phaser.Math.Easing.Quadratic.In,
              },
              {
                y: targetY,
                duration: settleMs,
                ease: Phaser.Math.Easing.Back.Out,
                onStart: () => playReelDropSfxIfAllowed(self),
                onComplete: () => resolve(),
              },
            ];
            self.scene.tweens.chain({ targets: obj, tweens: tweensArr });
          } else {
            // No overshoot: simple tween to target
            self.scene.tweens.add({
              targets: obj,
              y: targetY,
              delay: compressionDelay,
              duration: compressionTotalMs,
              ease: Phaser.Math.Easing.Cubic.Out,
              onComplete: () => resolve(),
            });
          }
        } catch { resolve(); }
      }));
    });
  }

  // Overlap-aware drop scheduling: if enabled, start drops during compression; otherwise, drop after compression completes
  const overlapDrops = !!(self.scene?.gameData?.tumbleOverlapDropsDuringCompression);
  const dropPromises: Promise<void>[] = [];
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const startX = self.slotX - self.totalGridWidth * 0.5;
  let totalSpawned = 0;

  if (overlapDrops) {
    // Replace grid immediately so top nulls represent empty slots while compression runs
    self.symbols = newGrid;
    // Rebuild currentSymbolData to reflect compressed positions now
    try {
      if (self.currentSymbolData) {
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
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] (overlap) Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      }
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

        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        dropPromises.push(new Promise<void>((resolve) => {
          try {
            const computedStartDelay = (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];

            // Overshoot config (tumble-specific overrides supported)
            const dropTotalMs = (self.scene.gameData.dropDuration * 1.2);
            const overshootPxRaw = (self.scene.gameData as any)?.tumbleDropOvershootPx ?? (self.scene.gameData as any)?.dropOvershootPx;
            const overshootPx = Math.max(
              0,
              typeof overshootPxRaw === 'number'
                ? overshootPxRaw
                // Bouncy default
                : Math.min(32, Math.max(10, symbolTotalHeight * 0.2)),
            );
            const fallFracRaw = (self.scene.gameData as any)?.tumbleDropOvershootFallFraction ?? (self.scene.gameData as any)?.dropOvershootFallFraction;
            const fallFrac = (typeof fallFracRaw === 'number' && fallFracRaw > 0 && fallFracRaw < 1) ? fallFracRaw : 0.7;
            const fallMs = Math.max(1, Math.floor(dropTotalMs * fallFrac));
            const settleMs = Math.max(1, Math.floor(dropTotalMs - fallMs));
            const overshootY = targetY + overshootPx;
            const doOvershoot = overshootPx > 0 && settleMs > 0;

            const handleLanding = () => {
              resolve();
            };
            if (!skipPreHop) {
              tweensArr.push({
                delay: computedStartDelay,
                y: `-= ${symbolHop}`,
                duration: self.scene.gameData.winUpDuration,
                ease: Phaser.Math.Easing.Circular.Out,
              });
              if (doOvershoot) {
                tweensArr.push({ y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
                tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out, onStart: () => playReelDropSfxIfAllowed(self), onComplete: handleLanding });
              } else {
                tweensArr.push({ y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear, onComplete: () => {playReelDropSfxIfAllowed(self);  handleLanding } });
              }
            } else {
              if (doOvershoot) {
                tweensArr.push({ delay: computedStartDelay, y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
                tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out, onStart: () => playReelDropSfxIfAllowed(self), onComplete: handleLanding });
              } else {
                tweensArr.push({ delay: computedStartDelay, y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear, onComplete: () => {playReelDropSfxIfAllowed(self); handleLanding } });
              }
            }
            self.scene.tweens.chain({ targets: created, tweens: tweensArr });
          } catch { resolve(); }
        }));
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
      if (self.currentSymbolData) {
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
      if (isSymbolsVerboseLoggingEnabled()) {
        console.log(`[Symbols] Column ${col}: empty=${emptyCount}, incoming=${incoming.length}, spawning=${spawnCount}`);
      }
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
        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        dropPromises.push(new Promise<void>((resolve) => {
          try {
            const computedStartDelay = (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];

            // Overshoot config (tumble-specific overrides supported)
            const dropTotalMs = (self.scene.gameData.dropDuration * 0.9);
            const overshootPxRaw = (self.scene.gameData as any)?.tumbleDropOvershootPx ?? (self.scene.gameData as any)?.dropOvershootPx;
            const overshootPx = Math.max(
              0,
              typeof overshootPxRaw === 'number'
                ? overshootPxRaw
                // Bouncy default
                : Math.min(32, Math.max(10, symbolTotalHeight * 0.2)),
            );
            const fallFracRaw = (self.scene.gameData as any)?.tumbleDropOvershootFallFraction ?? (self.scene.gameData as any)?.dropOvershootFallFraction;
            const fallFrac = (typeof fallFracRaw === 'number' && fallFracRaw > 0 && fallFracRaw < 1) ? fallFracRaw : 0.7;
            const fallMs = Math.max(1, Math.floor(dropTotalMs * fallFrac));
            const settleMs = Math.max(1, Math.floor(dropTotalMs - fallMs));
            const overshootY = targetY + overshootPx;
            const doOvershoot = overshootPx > 0 && settleMs > 0;

            const handleLanding = () => {
              try {
                const mag = (self.scene.gameData as any)?.dropShakeMagnitude ?? 0;
                const dur = Math.max(50, (self.scene.gameData as any)?.dropShakeDurationMs ?? 120);
                if (mag > 0) {
                  const axis = (self.scene.gameData as any)?.dropShakeAxis ?? 'both';
                  if (!gameStateManager.isTurbo) simulateCameraShake(self, getObjectsToShake(self), dur, mag, axis);
                }
              } catch { }
              resolve();
            };
            if (!skipPreHop) {
              tweensArr.push({ delay: computedStartDelay, y: `-= ${symbolHop}`, duration: self.scene.gameData.winUpDuration, ease: Phaser.Math.Easing.Circular.Out });
              if (doOvershoot) {
                tweensArr.push({ y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
                tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out, onComplete: handleLanding });
              } else {
                tweensArr.push({ y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear, onComplete: handleLanding });
              }
            } else {
              if (doOvershoot) {
                tweensArr.push({ delay: computedStartDelay, y: overshootY, duration: fallMs, ease: Phaser.Math.Easing.Quadratic.In });
                tweensArr.push({ y: targetY, duration: settleMs, ease: Phaser.Math.Easing.Back.Out, onComplete: handleLanding });
              } else {
                tweensArr.push({ delay: computedStartDelay, y: targetY, duration: dropTotalMs, ease: Phaser.Math.Easing.Linear, onComplete: handleLanding });
              }
            }
            self.scene.tweens.chain({ targets: created, tweens: tweensArr });
          } catch { resolve(); }
        }));
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

  // Re-evaluate wins after each tumble drop completes
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
          // Still give PNG-only matches a small pop so wins feel responsive.
          try { scheduleScaleUp(self, currentSymbol, 20, 200, 1.05); } catch { }
          try { scheduleTranslate(self, currentSymbol, 20, 200, 0, -3); } catch { }
          continue;
        }


        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';

        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;

        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);

          // If spine isn't ready, keep the sprite and apply a small pop so the win still feels responsive.
          if (!ensureSpineFactory(self.scene, '[Symbols] replaceSpriteWithSpine')) {
            try { scheduleScaleUp(self, currentSymbol, 20, 200, 1.05); } catch { }
            try { scheduleTranslate(self, currentSymbol, 20, 200, 0, -3); } catch { }
            continue;
          }

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
                const sfx = hasWildcardInWin ? SoundEffectType.WILD_MULTI : SoundEffectType.HIT_WIN;
                audio.playSoundEffect(sfx);
                hasPlayedWinSfx = true;
                // If this spin triggered scatter, chain play scatter_ka after hit/wildmulti
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
            // If recreation fell back to PN,G still apply a subtle win bump.
            try {
              if (!(recreated as any)?.animationState) {
                scheduleScaleUp(self, recreated, 20, 200, 2);
                scheduleTranslate(self, recreated, 20, 200, 0, -10);
              }
            } catch { }
          } catch { }
        }
      }
    }
  }
}

function createMultiplierSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  console.log(`[Symbols] Creating multiplier symbol: ${value}`);

  let spine: SpineGameObject | null = null;
  try {
    spine = acquireSpineFromPool(self, Symbols.MULTIPLIER_SPINE_KEY, `${Symbols.MULTIPLIER_SPINE_KEY}-atlas`);
  } catch (e) {
    console.warn('[Symbols] Failed to acquire pooled multiplier Spine, falling back to PNG:', e);
  }

  // Fallback: if Spine could not be acquired/created, use the existing PNG path
  if (!spine) {
    return createPngSymbol(self, value, x, y, alpha);
  }

  try {
    const origin = self.getSpineSymbolOrigin(value);
    const scale = self.getSpineSymbolScale(value);

    spine.setOrigin(origin.x, origin.y);
    spine.setScale(scale);
    spine.setPosition(x, y);

    try {
      spine.setVisible(true);
      spine.setActive(true);
      spine.setAlpha(alpha);
    } catch { }

    try { (spine as any).symbolValue = value; } catch { }

    try {
      if (self.container && spine.parentContainer !== self.container) {
        self.container.add(spine);
      }
    } catch { }

    try {
      const state = spine.animationState;
      if (state) {
        const animName = self.findMultiplierAnimationNameByIndex(spine, value);
        const fallbackAnimName = spine.skeleton?.data?.animations?.[0]?.name;
        const nameToPlay = animName ?? fallbackAnimName;

        if (nameToPlay) {
          state.setAnimation(0, nameToPlay, false);
        }

        state.timeScale = 0;
      }
    } catch {
      console.error('[Symbols] Failed to set animation for multiplier symbol: ', value);
    }

    return spine;
  } catch (configureError) {
    console.warn('[Symbols] Failed to configure multiplier Spine, falling back to PNG:', configureError);
    try { releaseSpineToPool(self, spine as any); } catch { }
    return createPngSymbol(self, value, x, y, alpha);
  }
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

/**
 * Promise-based delay that uses Phaser's clock (scene time), so it respects scene pauses / time scaling.
 * This is important for reel/drop sequencing: we don't want real-time JS timers to elapse while the
 * scene/tweens are paused due to dialogs/transitions.
 */
function phaserDelay(scene: Phaser.Scene, durationMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      if (!scene || !scene.time || durationMs <= 0) {
        resolve();
        return;
      }
      scene.time.delayedCall(durationMs, () => resolve());
    } catch {
      resolve();
    }
  });
}

// Add method to reset symbols visibility
function resetSymbolsVisibility(self: Symbols): void {
  if (self.container) {
    self.container.setAlpha(1);
  }
}
