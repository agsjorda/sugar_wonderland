import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS, WILDCARD_SYMBOLS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';

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

  public readonly baseSymbolWidth: number = 69;
  public readonly baseSymbolHeight: number = 69;

  public gridOffsetX: number = 0;
  public gridOffsetY: number = -55;
  public baseCenterX: number = 0;
  public baseCenterY: number = 0;

  public readonly symbolWinTimeScale: number = 1.5;

  private spineSymbolOrigins: { [key: number]: {x: number, y: number} } = 
  {
    0:  {x: 0.482, y: 0.55},
    1:  {x: 0.5, y: 0.5}, 
    2:  {x: 0.5, y: 0.5}, 
    3:  {x: 0.5, y: 0.5}, 
    4:  {x: 0.5, y: 0.5}, 
    5:  {x: 0.5, y: 0.5}, 
    6:  {x: 0.5, y: 0.505},  
    7:  {x: 0.5, y: 0.505},  
    8:  {x: 0.5, y: 0.505},  
    9:  {x: 0.5, y: 0.505}, 
    10: {x: 0.5, y: 0.5}, 
    11: {x: 0.5, y: 0.5}, 
    12: {x: 0.5, y: 0.5},  
    13: {x: 0.5, y: 0.5},  
    14: {x: 0.5, y: 0.5}  
  }

  // Configuration for Spine symbol scales - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0:  0.275,   // Symbol0_KA (scatter) scale
    1:  0.2725,  // Symbol1_KA scale
    2:  0.2725,  // Symbol2_KA scale
    3:  0.2725,  // Symbol3_KA scale
    4:  0.2725,  // Symbol4_KA scale
    5:  0.2725,  // Symbol5_KA scale
    6:  0.2925,  // Symbol6_KA scale
    7:  0.2925,  // Symbol7_KA scale
    8:  0.2925,  // Symbol8_KA scale
    9:  0.2925,  // Symbol9_KA scale
    10: 0.135,  // Symbol10_KA scale
    11: 0.135,  // Symbol11_KA scale
    12: 0.137,  // Symbol12_KA (wildcard x2) scale
    13: 0.137,  // Symbol13_KA (wildcard x3) scale
    14: 0.137  // Symbol14_KA (wildcard x4) scale
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
  private dialogListenerSetup: boolean = false;

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  public create(scene: Game) {
    this.scene = scene;
    initVariables(this);
    createContainer(this);
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
        this.showCongratsDialogAfterDelay();
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
          } catch {}
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
          console.log('[Symbols] Dialog animations complete - waiting additional 3000ms before starting autoplay');
          // Add 3000ms delay AFTER the iris transition completes
          this.scene.time.delayedCall(1000, () => {
            console.log('[Symbols] Additional 1200ms delay completed - now triggering autoplay for free spins');
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
    return this.spineSymbolScales[symbolValue] || 1; // Default scale if not configured
  }

  /**
   * Get the configured origin for a specific symbol's Spine animation
   */
  public getSpineSymbolOrigin(symbolValue: number): {x: number, y: number} {
    return this.spineSymbolOrigins[symbolValue] || {x: 0.5, y: 0.5}; // Default origin if not configured
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
      
      // Force all symbols to be visible as a final safety measure
      this.forceAllSymbolsVisible();
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
              
              // Destroy the Spine object
              symbol.destroy();
              
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
            this.scene.tweens.killTweensOf(symbol);
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
  public moveWinningSymbolsToFront(data: Data): void {
    if (!data.wins || data.wins.allMatching.size === 0) {
      console.log('[Symbols] No wins to move to front');
      return;
    }

    // Collect all unique winning grids from all win patterns
    const allWinningGrids = new Set<string>();
    const uniqueGrids: { x: number, y: number }[] = [];

    for (const winningGrids of data.wins.allMatching.values()) {
      for (const grid of winningGrids) {
        const gridKey = `${grid.x},${grid.y}`;
        if (!allWinningGrids.has(gridKey)) {
          allWinningGrids.add(gridKey);
          uniqueGrids.push({ x: grid.x, y: grid.y });
        }
      }
    }

    console.log(`[Symbols] Found ${uniqueGrids.length} unique winning symbols to move to front`);

    // Set depth of winning symbols to be above the overlay
    let movedCount = 0;
    for (const grid of uniqueGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x] && !this.symbols[grid.y][grid.x].destroyed) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);
        
        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);
        
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        console.log(`[Symbols] Symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${uniqueGrids.length} winning symbols to front`);
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
    this.hideAllSymbols();
    this.hideWinningOverlay();
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
      this.scatterAnimationManager.playScatterAnimation(mockData);
    } else {
      console.warn('[Symbols] ScatterAnimationManager not available');
    }
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
    return;

    console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);

    // Replace scatter symbols with Spine animations
    const animationPromises = scatterGrids.map(grid => {
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
            const symbolValue = 0; // Symbol 0 is scatter
            const spineKey = `symbol_${symbolValue}_spine`;
            const spineAtlasKey = spineKey + '-atlas';
            const symbolName = `Symbol${symbolValue}_KA`;
            const hitAnimationName = `${symbolName}_hit`;
            
            // Store original position and scale
            const x = currentSymbol.x;
            const y = currentSymbol.y;
            const displayWidth = currentSymbol.displayWidth;
            const displayHeight = currentSymbol.displayHeight;
            
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
                
                console.log(`[Symbols] Successfully replaced scatter sprite with Spine animation at column ${col}, row ${row} with depth:`, spineSymbol.depth);
                
                // Play the hit animation (looped)
                spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
                console.log(`[Symbols] Playing looped scatter animation: ${hitAnimationName}`);
                
                // Create smooth scale tween to increase size by 20%
                const enlargedScale = configuredScale * 1.5; // Increase by 20%
                this.scene.tweens.add({
                  targets: spineSymbol,
                  scaleX: enlargedScale,
                  scaleY: enlargedScale,
                  duration: 500, // Smooth 500ms transition
                  ease: 'Power2.easeOut', // Smooth easing
                  onComplete: () => {
                    console.log(`[Symbols] Scatter symbol scale tween completed: ${configuredScale} → ${enlargedScale}`);
                  }
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
      const fsItems = this.currentSpinData?.slot?.freeSpin?.items || this.currentSpinData?.slot?.freespin?.items || [];
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
        // Use the same timing as normal autoplay (1000ms base with turbo multiplier)
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
    const baseDelay = 500;
    const turboDelay = gameStateManager.isTurbo ? 
      baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
    console.log(`[Symbols] Scheduling next free spin in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
    
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
    console.log('[Symbols] Showing congrats dialog after delay');
    
    // Close any open win dialogs first (safety check)
    const gameScene = this.scene as any;
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }
    
    // Calculate total win from freespinItems
    let totalWin = 0;
    if (this.currentSpinData && this.currentSpinData.slot) {
      const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
      if (freespinData && freespinData.items && Array.isArray(freespinData.items)) {
        totalWin = freespinData.items.reduce((sum: number, item: any) => {
          return sum + (item.subTotalWin || 0);
        }, 0);
        console.log(`[Symbols] Calculated total win from freespinItems: ${totalWin}`);
      }
    }
    
    // Show congrats dialog with total win amount
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongrats === 'function') {
      gameScene.dialogs.showCongrats(this.scene, { winAmount: totalWin });
      console.log(`[Symbols] Congrats dialog shown with total win: ${totalWin}`);
    } else {
      console.warn('[Symbols] Dialogs component not available for congrats dialog');
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
    //this.scheduleCongratsDialogAfterAutoplay();
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
    console.log('[Symbols] Stored current spin data for access by other components');
    
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
    } catch {}
    try {
      const header = self.scene?.getHeader?.();
      const headerContainer = header?.getContainer?.();
      if (headerContainer) { targets.push(headerContainer); }
    } catch {}
  } catch {}

  return targets;
}

// Shake only the grid container and the reel frame (border), not the whole camera
function simulateCameraShake(self: Symbols, targets: any[], durationMs: number, magnitude: number, axis: 'x' | 'y' | 'both' = 'both'): void {
  if (targets.length === 0) return;

  if(self.scene.gameData.isTurbo) { 
    return; // turbo mode does not shake the camera
  }

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
              try { tgt.x = base.x; tgt.y = base.y; } catch {}
            }
          }
          try { state.timer?.remove(false); } catch {}
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
          } catch {}
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
      const created = createSpineOrPngSymbol(self, value, x, y, 1);
      rows.push(created);
    }

    
  // const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  // const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  // const startX = self.slotX - self.totalGridWidth * 0.5;
  // const startY = self.slotY - self.totalGridHeight * 0.5;
  
  // for (let col = 0; col < initialRowMajor.length; col++) {
  //   let rows: any[] = [];
  //   for (let row = 0; row < initialRowMajor[col].length; row++) {
  //     const symbolIndex = initialRowMajor[col][row];
  //     const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
  //     const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

  //     const isHighPaying = initialRowMajor[col][row] >= 1 && initialRowMajor[col][row] <= 5;
  //     let symbol: any;

  //     if(isHighPaying)
  //     {
  //       try {
  //         const spineKey = `Symbol${symbolIndex}_WF`;
  //         const spineAtlasKey = `${spineKey}-atlas`;
  //         const idleAnimationName = `symbol${symbolIndex}_WF_idle`;
          
  //         console.log('[Symbols] Creating Spine animation for symbol:', spineKey, spineAtlasKey, idleAnimationName);
          
  //         const spineSymbol = scene.add.spine(x, y, spineKey, spineAtlasKey);
  //         fitSpineToSymbolBox(self, spineSymbol);
  //         const origin = {x: 0.5, y: 0.5};

  //         spineSymbol.setOrigin(origin.x, origin.y);
  //         spineSymbol.setScale(self.getSpineSymbolScale(symbolIndex));
  //         spineSymbol.animationState.setAnimation(0, idleAnimationName, true);
  
  //         symbol = spineSymbol;
  //       } catch {}
  //     }
  //     else
  //     {
  //       try {
  //         const spineKey = `Symbol${symbolIndex}_WF`;
  //         const spineAtlasKey = `${spineKey}-atlas`;
  //         const idleAnimationName = `symbol${symbolIndex}_WF`;
          
  //         console.log('[Symbols] Creating Spine animation for symbol:', spineKey, spineAtlasKey, idleAnimationName);
          
  //         const spineSymbol = scene.add.spine(x, y, spineKey, spineAtlasKey);
  //         const origin = self.getSpineSymbolOrigin(symbolIndex);
          
  //         spineSymbol.setOrigin(origin.x, origin.y);
  //         spineSymbol.setScale(self.getSpineSymbolScale(symbolIndex));
  //         spineSymbol.animationState.setAnimation(0, idleAnimationName, true);
  //         spineSymbol.animationState.timeScale = 0;
  
  //         symbol = spineSymbol;
  //       } catch {}
  //     }
        
  //     if(!symbol) {
  //       console.log('[Symbols] Creating Spine animation for symbol: Failed. Defaulted to PNG sprite');
  //       symbol = scene.add.sprite(x, y, 'symbol_' + symbolIndex);
      
  //       symbol.displayWidth = self.displayWidth;
  //       symbol.displayHeight = self.displayHeight;
  //     }

  //     self.container.add(symbol);

  //     rows.push(symbol);
  //   }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');
}

/**
 * Process symbols from SpinData (GameAPI response)
 */
async function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols:', symbols);
  
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
      : (spinData?.slot?.freespin?.count || 0)
  );
  
  // Set proper timing for animations
  const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
  const adjustedDelay = gameStateManager.isTurbo ? 
    baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER : baseDelay;
  
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
  
  // Use the existing createNewSymbols function
  createNewSymbols(self, mockData);
  
  // Use the existing dropReels function
  await dropReels(self, mockData);
  
  // Update symbols after animation
  disposeSymbols(self.symbols);
    self.symbols = self.newSymbols;
    self.newSymbols = [];
  
  // Re-evaluate wins after initial drop completes
  try { reevaluateWinsFromGrid(self); } catch {}

  // Apply tumble steps if provided by backend
  try {
    const tumbles = spinData?.slot?.tumbles;
    if (Array.isArray(tumbles) && tumbles.length > 0) {
      console.log(`[Symbols] Applying ${tumbles.length} tumble step(s) from SpinData`);
      await applyTumbles(self, tumbles);
      console.log('[Symbols] Tumbles applied');
    }
  } catch (e) {
    console.warn('[Symbols] Failed applying tumbles:', e);
  }

  // Replace with spine animations if needed (disabled while using symbol-count logic)
  if (!(Symbols as any).WINLINE_CHECKING_DISABLED) {
    replaceWithSpineAnimations(self, mockData);
  }
  
  // Check for scatter symbols and trigger scatter bonus if found
  console.log('[Symbols] Checking for scatter symbols...');
  console.log('[Symbols] MockData symbols:', mockData.symbols);
  console.log('[Symbols] SCATTER_SYMBOL from Data:', Data.SCATTER);
  
  // Create a transposed copy for scatter detection since SymbolDetector expects [row][col] format
  // but SpinData provides [col][row] format
  const transposedSymbols: number[][] = [];
  for (let row = 0; row < mockData.symbols[0].length; row++) {
    transposedSymbols[row] = [];
    for (let col = 0; col < mockData.symbols.length; col++) {
      // Invert vertical order when transposing: SpinData area uses bottom->top
      const colLen = mockData.symbols[col].length;
      transposedSymbols[row][col] = mockData.symbols[col][colLen - 1 - row];
    }
  }
  
  // Create a temporary Data object with transposed symbols for scatter detection
  const scatterData = new Data();
  scatterData.symbols = transposedSymbols;
  console.log('[Symbols] Transposed symbols for scatter detection:', transposedSymbols);
  
  const scatterGrids = self.symbolDetector.getScatterGrids(scatterData);
  console.log('[Symbols] ScatterGrids found:', scatterGrids);
  console.log('[Symbols] ScatterGrids length:', scatterGrids.length);
  
  // Check if this win meets the dialog threshold and pause autoplay if so
  if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
    const totalWin = calculateTotalWinFromPaylines(spinData.slot.paylines);
    const betAmount = parseFloat(spinData.bet);
    const multiplier = totalWin / betAmount;
    
    if (multiplier >= 20) {
      console.log(`[Symbols] Win meets dialog threshold (${multiplier.toFixed(2)}x) - pausing autoplay immediately`);
      gameStateManager.isShowingWinDialog = true;
    } else {
      console.log(`[Symbols] Win below dialog threshold (${multiplier.toFixed(2)}x) - autoplay continues`);
    }
  }

  // Without WinLineDrawer, just handle overlay and symbol layering for wins
  const hasPaylines = Array.isArray(spinData.slot?.paylines) && spinData.slot.paylines.length > 0;
  if (hasPaylines) {
    // Show the black overlay behind symbols for wins
    self.showWinningOverlay();
    // Move winning symbols to appear above the overlay
    self.moveWinningSymbolsToFront(mockData);
  }

  // NOW handle scatter symbols AFTER winlines are drawn
  if (scatterGrids.length >= 4) {
    console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
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
    } catch {}
    
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
    
    // Animate the individual scatter symbols with their hit animations
    console.log('[Symbols] Starting scatter symbol hit animations...');
    try {
      await self.animateScatterSymbols(mockData, scatterGrids);
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
        self.startScatterAnimationSequence(mockData);
      };
      
      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
    } else {
      console.log('[Symbols] No win dialog showing - starting scatter animation immediately');
      // No win dialog, start scatter animation immediately
      self.startScatterAnimationSequence(mockData);
    }
  } else {
    console.log(`[Symbols] No scatter detected (found ${scatterGrids.length} scatter symbols, need 4+)`);
  }
  
  // Set spinning state to false
  gameStateManager.isReelSpinning = false;
  
  console.log('[Symbols] SpinData symbols processed successfully');
  
  // Mark spin as done after all animations and tumbles finish (no winline drawer flow)
  console.log('[Symbols] Emitting REELS_STOP and WIN_STOP after symbol animations and tumbles (no winlines flow)');
  try {
    gameEventManager.emit(GameEventType.REELS_STOP);
    gameEventManager.emit(GameEventType.WIN_STOP);
  } catch (e) {
    console.warn('[Symbols] Failed to emit REELS_STOP/WIN_STOP:', e);
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
    
    // Use the slot.area from SpinData instead of data.symbols
    const symbols = data.spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the same logic as before
    await processSpinDataSymbols(self, symbols, data.spinData);
  });
}

/**
 * Attempt to scale a Spine object so it visually fits within the PNG dimensions
 * used by symbols (self.displayWidth x self.displayHeight).
 */
function fitSpineToSymbolBox(self: Symbols, spineObj: any): void {
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
    } catch {}

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
    } catch {}

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
      spineObj.setScale( self.getSpineSymbolScale(0) );
    }
  } catch {}
}

/**
 * Schedule a scale-up effect (+30%) after a delay (default 500ms)
 */
function scheduleScaleUp(self: Symbols, obj: any, delayMs: number = 500): void {
  try {
    const baseX = obj?.scaleX ?? 1;
    const baseY = obj?.scaleY ?? 1;
    const targetX = baseX * 1.6;
    const targetY = baseY * 1.6;
    self.scene.time.delayedCall(delayMs, () => {
      try {
        self.scene.tweens.add({
          targets: obj,
          scaleX: targetX,
          scaleY: targetY,
          duration: 200,
          ease: Phaser.Math.Easing.Cubic.Out,
        });
      } catch {}
    });
  } catch {}
}

/**
 * Create a sugar Spine symbol (Symbol1–Symbol9) playing idle, or PNG fallback
 */
function createSpineOrPngSymbol(self: Symbols, value: number, x: number, y: number, alpha: number = 1): any {
  // Try sugar spine for Symbol1–Symbol9
  console.log(`[Symbols] Creating spine or PNG symbol for value: ${value}`);
  if (value >= 1 && value <= 9) {
    try {
      console.log(`[Symbols] Creating spine symbol for value: ${value}`);
      const spineKey = `symbol_${value}_spine`;
      const spineAtlasKey = `${spineKey}-atlas`;
      const go: any = (self.scene.add as any).spine
        ? (self.scene.add as any).spine(x, y, spineKey, spineAtlasKey)
        : null;
      if (go) {
        try { (go as any).symbolValue = value; } catch {}
        if (typeof go.setOrigin === 'function') go.setOrigin(0.5, 0.5);
        fitSpineToSymbolBox(self, go);
        if (typeof go.setAlpha === 'function') go.setAlpha(alpha);
        // Play idle animation if available
        try {
          const idle = `Symbol${value}_SW_Idle`;
          const drop = `Symbol${value}_SW_Drop`;
          if (go.animationState && go.animationState.setAnimation) {
            // Try to play drop first, then transition to idle on complete
            let playedDrop = false;
            try {
              const hasDrop = !!(go as any)?.skeleton?.data?.findAnimation?.(drop);
              if (hasDrop) {
                const dropEntry = go.animationState.setAnimation(0, drop, false);
                playedDrop = true;
                if (go.animationState.addListener) {
                  const listener = {
                    complete: (entry: any) => {
                      try {
                        if (!entry || entry.animation?.name !== drop) return;
                      } catch {}
                      // Switch to idle loop with random offset and slight speed jitter
                      try {
                        const idleEntry = go.animationState.setAnimation(0, idle, true);
                        const duration = (go as any)?.skeleton?.data?.findAnimation?.(idle)?.duration;
                        if (typeof duration === 'number' && duration > 0 && idleEntry) {
                          (idleEntry as any).trackTime = Math.random() * duration;
                        }
                        const speedJitter = 0.95 + Math.random() * 0.1;
                        if (go.animationState) (go.animationState as any).timeScale = speedJitter;
                        else if ((go as any).timeScale !== undefined) (go as any).timeScale = speedJitter;
                      } catch {}
                    }
                  } as any;
                  go.animationState.addListener(listener);
                }
              }
            } catch {}
            if (!playedDrop) {
              // Fallback: play idle immediately with desync tweaks
              const idleEntry = go.animationState.setAnimation(0, idle, true);
              try {
                const duration = (go as any)?.skeleton?.data?.findAnimation?.(idle)?.duration;
                if (typeof duration === 'number' && duration > 0 && idleEntry) {
                  (idleEntry as any).trackTime = Math.random() * duration;
                }
              } catch {}
              try {
                const speedJitter = 0.95 + Math.random() * 0.1;
                if (go.animationState) (go.animationState as any).timeScale = speedJitter;
                else if ((go as any).timeScale !== undefined) (go as any).timeScale = speedJitter;
              } catch {}
            }
          }
        } catch {}
        self.container.add(go);
        return go;
      }
      else
      {
        console.error(`[Symbols] Failed to create spine symbol ${value}: ${spineKey}`);
      }
    } catch {}
  }

  // Fallback to PNG sprite
  const sprite = self.scene.add.sprite(x, y, 'symbol_' + value);
  try { (sprite as any).symbolValue = value; } catch {}
  sprite.displayWidth = self.displayWidth;
  sprite.displayHeight = self.displayHeight;
  if (typeof sprite.setAlpha === 'function') sprite.setAlpha(alpha);
  self.container.add(sprite);
  return sprite;
}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;
  disposeSymbols(self.newSymbols);
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

  // Play turbo drop sound effect at the start of reel drop sequence when in turbo mode
  if (self.scene.gameData.isTurbo && (window as any).audioManager) {
    (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
    console.log('[Symbols] Playing turbo drop sound effect at start of reel drop sequence');
  }

  // Stagger reel starts at a fixed interval and let them overlap

  // Anticipation disabled: do not check columns for scatter, no reel extension
  const extendLastReelDrop = false;
  try { (self.scene as any).__isScatterAnticipationActive = false; } catch {}

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
      // rowDropPrevSymbols(self, actualRow, isLastReel && extendLastReelDrop)

      // Wait before spawning new symbols so previous ones are cleared first
      await delay(PREV_TO_NEW_DELAY_MS);
      await dropNewSymbols(self, actualRow, isLastReel && extendLastReelDrop);
    })();
    reelPromises.push(p);
  }
  console.log('[Symbols] Waiting for all reels to complete animation...');
  await Promise.all(reelPromises);
  console.log('[Symbols] All reels have completed animation');
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
  const STAGGER_MS = 50; // match dropNewSymbols stagger (left-to-right, one by one feel)
  const clearHop = self.scene.gameData.winUpHeight * 0.2;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[Symbols] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }
    
    // Trigger drop animation on the symbol if available (sugar Spine)
    try { playDropAnimationIfAvailable(self.symbols[i][index]); } catch {}

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
    const STAGGER_MS = 150; // delay between each column drop
    const symbolHop = self.scene.gameData.winUpHeight * 0.5;

    for (let col = 0; col < self.newSymbols.length; col++) {
      let symbol = self.newSymbols[col][index];
      const targetY = getYPos(self, index);
      
      // Trigger drop animation on the new symbol if available (sugar Spine)
      try { playDropAnimationIfAvailable(symbol); } catch {}

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
              } catch {}
              // Play reel drop sound effect only when turbo mode is off
              if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                console.log(`[Symbols] Playing reel drop sound effect for reel ${index} after drop completion`);
              }
              
              completedAnimations++;
              if (completedAnimations === totalAnimations) {
                // Anticipation behavior disabled
                resolve();
              }
            }
          }
        ]
      })
    }
  });
}


function disposeSymbols(symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;
  
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol = symbols[col][row];
      if (symbol && symbol.destroy && !symbol.destroyed) {
        try {
          const symbolType = symbol.animationState ? 'Spine' : 'PNG';
          const symbolKey = symbol.texture?.key || 'unknown';
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
      } catch {}
    }
  } catch {}
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
    const totalWinningCells = Array.from(wins.allMatching.values()).reduce((s, arr) => s + arr.length, 0);
    console.log('[Symbols] Re-evaluated wins after drop:', { matchCount: wins.symbolCounts.size, patterns: wins.allMatching.size, totalWinningCells });

    if(wins.symbolCounts.size > 0) {
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
 * Apply a sequence of tumble steps: remove "out" symbols, compress columns down, and drop "in" symbols from top.
 * Expects tumbles to be in the SpinData format: [{ symbols: { in: number[][], out: {symbol:number,count:number,win:number}[] }, win: number }, ...]
 */
async function applyTumbles(self: Symbols, tumbles: any[]): Promise<void> {
  for (const tumble of tumbles) {
    await applySingleTumble(self, tumble);
  }
}

async function applySingleTumble(self: Symbols, tumble: any): Promise<void> {
  const outs = (tumble?.symbols?.out || []) as Array<{ symbol: number; count: number }>;
  const ins = (tumble?.symbols?.in || []) as number[][]; // per real column (x index)

  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.warn('[Symbols] applySingleTumble: Symbols grid not initialized');
    return;
  }

  // Grid orientation: self.symbols[col][row]
  const numCols = self.symbols.length;
  const numRows = self.symbols[0].length;

  // Match manual drop timings and staggering for visual consistency
  const MANUAL_STAGGER_MS: number = (self.scene?.gameData?.tumbleStaggerMs ?? 100);

  // Debug: log incoming tumble payload
  try {
    const totalOutRequested = outs.reduce((s, o) => s + (Number(o?.count) || 0), 0);
    const totalInProvided = (Array.isArray(ins) ? ins.flat().length : 0);
    console.log('[Symbols] Tumble payload:', {
      outs,
      insColumns: Array.isArray(ins) ? ins.map((col, idx) => ({ col: idx, count: Array.isArray(col) ? col.length : 0 })) : [],
      totals: { totalOutRequested, totalInProvided }
    });
  } catch {}

  // Build a removal mask per cell
  // removeMask[col][row]
  const removeMask: boolean[][] = Array.from({ length: numCols }, () => Array<boolean>(numRows).fill(false));

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
  const positionsBySymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
  let sequenceIndex = 0; // ensures 1-by-1 ordering across columns left-to-right
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      const val = self.currentSymbolData?.[row]?.[col];
      if (typeof val !== 'number') continue;
      if (!positionsBySymbol[val]) positionsBySymbol[val] = [];
      positionsBySymbol[val].push({ col, row });
    }
  }
  // Sort each symbol's positions top-to-bottom (row asc), then left-to-right (col asc)
  Object.keys(positionsBySymbol).forEach(k => {
    positionsBySymbol[Number(k)].sort((a, b) => a.row - b.row || a.col - b.col);
  });

  // Determine per-column incoming counts
  const insCountByCol: number[] = Array.from({ length: numCols }, (_, c) => (Array.isArray(ins?.[c]) ? ins[c].length : 0));
  let targetRemovalsPerCol: number[] = insCountByCol.slice();

  // Helper to pick and mark a position for a symbol in a preferred column
  function pickAndMark(symbol: number, preferredCol: number | null): boolean {
    const list = positionsBySymbol[symbol] || [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (removeMask[p.col][p.row]) continue; // already marked
      if (preferredCol !== null && p.col !== preferredCol) continue;
      removeMask[p.col][p.row] = true;
      // Remove from list for efficiency
      list.splice(i, 1);
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
  try {
    const removedPerCol: number[] = Array.from({ length: numCols }, () => 0);
    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        if (removeMask[col][row]) removedPerCol[col]++;
      }
    }
    console.log('[Symbols] Tumble per-column removal vs incoming:', removedPerCol.map((r, c) => ({ col: c, removed: r, incoming: insCountByCol[c] })));
  } catch {}

  // Debug: report which cells are marked for removal per symbol
  try {
    const removedBySymbol: { [key: number]: Array<{ col: number; row: number }> } = {};
    let totalRemoved = 0;
    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        if (removeMask[col][row]) {
          const val = self.currentSymbolData?.[row]?.[col];
          const key = typeof val === 'number' ? val : -1;
          if (!removedBySymbol[key]) removedBySymbol[key] = [];
          removedBySymbol[key].push({ col, row });
          totalRemoved++;
        }
      }
    }
    console.log('[Symbols] Tumble removal mask summary:', { totalRemoved, removedBySymbol });
  } catch {}

  // Animate removal: for high-count sugar symbols (1..9), play SW_Win before destroy; otherwise fade out
  const removalPromises: Promise<void>[] = [];
  const STAGGER_MS = 50; // match drop sequence stagger (shortened)
  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      if (removeMask[col][row]) {
        const obj = self.symbols[col][row];
        if (obj) {
          removalPromises.push(new Promise<void>((resolve) => {
            try {
              const value = self.currentSymbolData?.[row]?.[col];
              const canPlaySugarWin = typeof value === 'number' && value >= 1 && value <= 9 && highCountSymbols.has(value) && obj.animationState && obj.animationState.setAnimation;
              if (canPlaySugarWin) {
                try { if (obj.animationState.clearTracks) obj.animationState.clearTracks(); } catch {}
                const winAnim = `Symbol${value}_SW_Win`;
                let completed = false;
                try {
                  if (obj.animationState.addListener) {
                    const listener = {
                      complete: (entry: any) => {
                        try {
                          if (!entry || entry.animation?.name !== winAnim) return;
                        } catch {}
                        if (completed) return; completed = true;
                        try { obj.destroy(); } catch {}
                        self.symbols[col][row] = null as any;
                        if (self.currentSymbolData && self.currentSymbolData[row]) {
                          (self.currentSymbolData[row] as any)[col] = null;
                        }
                        resolve();
                      }
                    } as any;
                    obj.animationState.addListener(listener);
                  }
                  obj.animationState.setAnimation(0, winAnim, false);
                  // Scale up by 30% after 0.5s
                  scheduleScaleUp(self, obj, 500);
                  // Safety timeout in case complete isn't fired
                  self.scene.time.delayedCall(self.scene.gameData.winUpDuration + 700, () => {
                    if (completed) return; completed = true;
                    try { obj.destroy(); } catch {}
                    self.symbols[col][row] = null as any;
                    if (self.currentSymbolData && self.currentSymbolData[row]) {
                      (self.currentSymbolData[row] as any)[col] = null;
                    }
                    resolve();
                  });
                } catch {
                  // Fallback to fade if animation fails
                  try { self.scene.tweens.killTweensOf(obj); } catch {}
                  self.scene.tweens.add({
                    targets: obj,
                    alpha: 0,
                    // No scale change to avoid perceived scale-up/down
                    duration: self.scene.gameData.winUpDuration,
                    ease: Phaser.Math.Easing.Cubic.In,
                    onComplete: () => {
                      try { obj.destroy(); } catch {}
                      self.symbols[col][row] = null as any;
                      if (self.currentSymbolData && self.currentSymbolData[row]) {
                        (self.currentSymbolData[row] as any)[col] = null;
                      }
                      resolve();
                    }
                  });
                }
              } else {
                // Replace fade with Spine effect for matched symbols
                const vNum = Number(value);
                const isIndex1to9 = Number.isFinite(vNum) && vNum >= 1 && vNum <= 9;
                if (isIndex1to9) {
                  // Choose effect by index range
                  // const spineKey = (vNum >= 1 && vNum <= 5) ? 'Symbol_HP_256' : 'Symbol_LP_256';
                  const spineKey = `Symbol${vNum}_WF`;
                  const spineAtlasKey = `${spineKey}-atlas`;
                  const x = obj.x;
                  const y = obj.y;
                  
                  // Remove the matched symbol immediately; effect will play at its position
                  try { self.scene.tweens.killTweensOf(obj); } catch {}
                  try { obj.destroy(); } catch {}
                  self.symbols[col][row] = null as any;
                  if (self.currentSymbolData && self.currentSymbolData[row]) {
                    (self.currentSymbolData[row] as any)[col] = null;
                  }
                  
                  try {
                    const fx = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
                    try { fx.setOrigin(0.5, 0.5); } catch {}
                    // Fit effect to symbol box for consistent sizing
                    try { 
                      fx.setScale(self.getSpineSymbolScale(vNum));
                      // fitSpineToSymbolBox(self, fx); 
                    } catch {}

                    let animationDuration = 1000;                    
                    let completed = false;
                    try {
                      const animationName = (vNum >= 1 && vNum <= 5) ? `symbol${vNum}_WF_win` : `symbol${vNum}_WF`;
                      if (fx.animationState && fx.animationState.setAnimation) {
                        // Set animation and attach listener to TrackEntry if possible
                        const entry: any = fx.animationState.setAnimation(0, animationName, false);
                        // Apply configured time scale (use self scope)
                        try { fx.animationState.timeScale = self.scene.gameData.isTurbo ? self.symbolWinTimeScale * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : self.symbolWinTimeScale; } catch {}
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
                          if (completed) return; completed = true;
                          try { fx.destroy(); } catch {}
                          resolve();
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
                        } catch {}
                        // Fallback: state-level listener
                        try {
                          if (fx.animationState && fx.animationState.addListener) {
                            fx.animationState.addListener({ complete: onDone, end: onDone } as any);
                          }
                        } catch {}
                      }
                    } catch {}
                    
                    console.log('[Symbols] Animation duration:', animationDuration);
                    // Safety timeout in case Spine complete event does not fire
                    self.scene.time.delayedCall(Math.max(animationDuration, self.scene.gameData.winUpDuration + animationDuration), () => {
                      if (completed) return; completed = true;
                      try { fx.destroy(); } catch {}
                      resolve();
                    });
                  } catch {
                    // Fallback to immediate resolve if spine creation fails
                    resolve();
                  }
                } else {
                  // Non-sugar or unsupported index: fallback to soft fade without scale change
                  try { self.scene.tweens.killTweensOf(obj); } catch {}
                  self.scene.tweens.add({
                    targets: obj,
                    alpha: 0,
                    // No scale change
                    duration: self.scene.gameData.winUpDuration,
                    ease: Phaser.Math.Easing.Cubic.In,
                    onComplete: () => {
                      try { obj.destroy(); } catch {}
                      // Leave null placeholder for compression step
                      self.symbols[col][row] = null as any;
                      if (self.currentSymbolData && self.currentSymbolData[row]) {
                        (self.currentSymbolData[row] as any)[col] = null;
                      }
                      resolve();
                    }
                  });
                }
              }
            } catch {
              try { obj.destroy(); } catch {}
              self.symbols[col][row] = null as any;
              if (self.currentSymbolData && self.currentSymbolData[row]) {
                (self.currentSymbolData[row] as any)[col] = null;
              }
              resolve();
            }
          }));
        } else {
          self.symbols[col][row] = null as any;
          if (self.currentSymbolData && self.currentSymbolData[row]) {
            (self.currentSymbolData[row] as any)[col] = null;
          }
        }
      }
    }
  }

  await Promise.all(removalPromises);

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
        try { if (typeof obj.setY === 'function') obj.setY(targetY); } catch {}
        return; // no promise push to avoid waiting on a non-existent tween
      }
      compressPromises.push(new Promise<void>((resolve) => {
        try {
          self.scene.tweens.add({
            targets: obj,
            y: targetY,
            delay: STAGGER_MS * col * (self.scene?.gameData?.compressionDelayMultiplier ?? 1),
            duration: self.scene.gameData.dropDuration / 2,
            // ease: Phaser.Math.Easing.Bounce.Out,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => resolve(),
          });
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
    } catch {}

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

        try { playDropAnimationIfAvailable(created); } catch {}

        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        dropPromises.push(new Promise<void>((resolve) => {
          try {
            const computedStartDelay = (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];
            if (!skipPreHop) {
              tweensArr.push({
                delay: computedStartDelay,
                y: `-= ${symbolHop}`,
                duration: self.scene.gameData.winUpDuration,
                ease: Phaser.Math.Easing.Circular.Out,
              });
              tweensArr.push({
                y: targetY,
                duration: (self.scene.gameData.dropDuration * 1.2),
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
                  } catch {}
                  try {
                    if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                      (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                    }
                  } catch {}
                  resolve();
                }
              });
            } else {
              tweensArr.push({
                delay: computedStartDelay,
                y: targetY,
                duration: (self.scene.gameData.dropDuration * 1.2),
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
                  } catch {}
                  try {
                    if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                      (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                    }
                  } catch {}
                  resolve();
                }
              });
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
    } catch {}

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
        try { playDropAnimationIfAvailable(created); } catch {}
        const DROP_STAGGER_MS = (self.scene?.gameData?.tumbleDropStaggerMs ?? (MANUAL_STAGGER_MS * 0.25));
        const symbolHop = self.scene.gameData.winUpHeight * 0.5;
        dropPromises.push(new Promise<void>((resolve) => {
          try {
            const computedStartDelay = (self.scene?.gameData?.tumbleDropStartDelayMs ?? 0) + (DROP_STAGGER_MS * sequenceIndex);
            const skipPreHop = !!(self.scene?.gameData?.tumbleSkipPreHop);
            const tweensArr: any[] = [];
            if (!skipPreHop) {
              tweensArr.push({ delay: computedStartDelay, y: `-= ${symbolHop}`, duration: self.scene.gameData.winUpDuration, ease: Phaser.Math.Easing.Circular.Out });
              tweensArr.push({ y: targetY, duration: (self.scene.gameData.dropDuration * 0.9), ease: Phaser.Math.Easing.Linear, onComplete: () => { try { const mag = (self.scene.gameData as any)?.dropShakeMagnitude ?? 0; const dur = Math.max(50, (self.scene.gameData as any)?.dropShakeDurationMs ?? 120); if (mag > 0) { const axis = (self.scene.gameData as any)?.dropShakeAxis ?? 'both'; simulateCameraShake(self, getObjectsToShake(self), dur, mag, axis); } } catch {} try { if (!self.scene.gameData.isTurbo && (window as any).audioManager) { (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP); } } catch {} resolve(); } });
            } else {
              tweensArr.push({ delay: computedStartDelay, y: targetY, duration: (self.scene.gameData.dropDuration * 0.9), ease: Phaser.Math.Easing.Linear, onComplete: () => { try { const mag = (self.scene.gameData as any)?.dropShakeMagnitude ?? 0; const dur = Math.max(50, (self.scene.gameData as any)?.dropShakeDurationMs ?? 120); if (mag > 0) { const axis = (self.scene.gameData as any)?.dropShakeAxis ?? 'both'; simulateCameraShake(self, getObjectsToShake(self), dur, mag, axis); } } catch {} try { if (!self.scene.gameData.isTurbo && (window as any).audioManager) { (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP); } } catch {} resolve(); } });
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
  } catch {}

  // Re-evaluate wins after each tumble drop completes
  try { reevaluateWinsFromGrid(self); } catch {}
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
  } catch {}
  
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
        // Removing KA hit animation usage for winning symbols
        
        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;
        const displayWidth = currentSymbol.displayWidth;
        const displayHeight = currentSymbol.displayHeight;
        
        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          
          // Remove the current sprite
          currentSymbol.destroy();
          
          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          try { (spineSymbol as any).symbolValue = symbolValue; } catch {}
          spineSymbol.setOrigin(0.5, 0.5);
          
          // Use configured scale for this specific symbol
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          spineSymbol.setScale(configuredScale);
          console.log(`[Symbols] Applied scale ${configuredScale} to symbol ${symbolValue}`);
          
          // No KA hit animation; keep subtle emphasis via scale-up only
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
                      try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch {}
                    });
                  }
                } catch {}
              }
            }
          } catch {}
          
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
          } catch {}
        }
      }
    }
  }
}


/**
 * Calculate total win amount from paylines array
 */
function calculateTotalWinFromPaylines(paylines: any[]): number {
  if (!paylines || paylines.length === 0) {
    return 0;
  }
  
  const totalWin = paylines.reduce((sum, payline) => {
    const winAmount = payline.win || 0;
    console.log(`[Symbols] Payline ${payline.lineKey}: ${winAmount} (symbol ${payline.symbol}, count ${payline.count})`);
    return sum + winAmount;
  }, 0);
  
  console.log(`[Symbols] Calculated total win: ${totalWin} from ${paylines.length} paylines`);
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

