import { Scene } from 'phaser';
import { Data } from '../tmp_backend/Data';
import { SpinData } from '../backend/SpinData';
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
  private overlayComponent: any = null; // No longer used (WinCardOverlay removed)
  private scatterWinOverlay: any = null; // Reference to the ScatterWinOverlay component
  private isAnimating: boolean = false;
  public delayedScatterData: any = null;
  private scatterSymbols: any[] = []; // Store references to scatter symbols
  private useSpinner: boolean = false; // TEMP: disable spinner, use overlay

  // Event listener references for cleanup
  private wheelSpinStartListener: ((data?: any) => void) | null = null;
  private wheelSpinDoneListener: ((data?: any) => void) | null = null;

  private config: ScatterAnimationConfig = {
    scatterRevealDelay: 500,
    slideInDuration: 1200,
    spinDelay: 500,
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

  public initialize(scene: Scene, symbolsContainer: Phaser.GameObjects.Container, spinnerContainer: Phaser.GameObjects.Container, spinnerComponent?: any, dialogsComponent?: any, _overlayComponent?: any, scatterWinOverlay?: any): void {
    this.scene = scene;
    this.symbolsContainer = symbolsContainer;
    this.spinnerContainer = spinnerContainer;
    this.spinnerComponent = spinnerComponent;
    this.dialogsComponent = dialogsComponent;
    this.overlayComponent = null;
    this.scatterWinOverlay = scatterWinOverlay || null;

    // Set up event listeners for wheel events
    this.setupWheelEventListeners();

    console.log('[ScatterAnimationManager] Initialized with containers, spinner and dialogs components');
  }

  public setConfig(config: Partial<ScatterAnimationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set up event listeners for wheel events
   */
  private setupWheelEventListeners(): void {
    // Listen for wheel spin start
    this.wheelSpinStartListener = (data: any) => {
      if (data) {
        console.log(`[ScatterAnimationManager] Wheel spin started for scatter index ${data.scatterIndex} with multiplier ${data.multiplier}`);
        // Update game state to reflect wheel spinning
        gameStateManager.isWheelSpinning = true;
      }
    };
    gameEventManager.on(GameEventType.WHEEL_SPIN_START, this.wheelSpinStartListener);

    // Listen for wheel spin completion
    this.wheelSpinDoneListener = (data: any) => {
      if (data) {
        console.log(`[ScatterAnimationManager] Wheel spin completed for scatter index ${data.scatterIndex} with multiplier ${data.multiplier}`);
        // Update game state to reflect wheel stopped
        gameStateManager.isWheelSpinning = false;
        // Update the final scatter index from the wheel result
        gameStateManager.scatterIndex = data.scatterIndex;
      }
    };
    gameEventManager.on(GameEventType.WHEEL_SPIN_DONE, this.wheelSpinDoneListener);
  }

  public async playScatterAnimation(data: Data): Promise<void> {
    if (this.isAnimating || !this.scene || !this.symbolsContainer) {
      console.warn('[ScatterAnimationManager] Cannot play animation - scene or symbols container not ready');
      return;
    }

    this.isAnimating = true;
    console.log('[ScatterAnimationManager] Starting scatter animation sequence');

    // Defer background music control to overlays/scenes to avoid overlap

    try {
      // Step 1: Wait for player to see scatter symbols
      console.log('[ScatterAnimationManager] Waiting for player to see scatter symbols...');
      await this.delay(this.getTurboAdjustedDelay(this.config.scatterRevealDelay));

      // Step 2: Show scatter win overlay
      if (this.scatterWinOverlay) {
        console.log('[ScatterAnimationManager] Showing scatter win overlay');
        // Pass free spin information into the overlay if available
        try {
          const gameScene = this.scene as any;
          const currentSpinData = gameScene?.symbols?.currentSpinData;
          // Smoothly fade out reel background while scatter win overlay is visible
          try { gameScene?.symbols?.fadeOutReelBackground?.(400); } catch {}
          if (currentSpinData && typeof this.scatterWinOverlay.setFreeSpinsFromSpinData === 'function') {
            this.scatterWinOverlay.setFreeSpinsFromSpinData(currentSpinData);
          } else if (typeof this.scatterWinOverlay.setFreeSpinsCount === 'function') {
            // Fallback: compute index then map to SCATTER_MULTIPLIERS value if we only have scatter index
            let count = 0;
            const indexFromData = this.getFreeSpinIndexFromSpinData?.() ?? -1;
            if (indexFromData >= 0) {
              count = SCATTER_MULTIPLIERS[indexFromData] || 0;
            }
            try { this.scatterWinOverlay.setFreeSpinsCount(count); } catch {}
          }
        } catch {}
        await new Promise<void>((resolve) => {
          // Use the requested overlay tint color
          this.scatterWinOverlay.show(0x0c2121, 0.92, 700, async () => {
            console.log('[ScatterAnimationManager] Scatter win overlay shown');
            
            // Step 3: After overlay is shown, disable symbols
            await this.disableSymbols();

            // Step 4: Wait for user to dismiss overlay (interaction), then continue
            if (typeof this.scatterWinOverlay.waitUntilDismissed === 'function') {
              await this.scatterWinOverlay.waitUntilDismissed();
              console.log('[ScatterAnimationManager] Scatter win overlay dismissed by user');
            }

            // Step 5: Skip legacy free spins dialog/spinner; overlay will transition directly to bonus autoplay

            // Step 6: Hide scatter win overlay after dialog is shown
            this.scatterWinOverlay.hide(300, () => {
              console.log('[ScatterAnimationManager] Scatter win overlay hidden');
              // Smoothly fade reel background back in before entering bonus
              try {
                const symbols = (this.scene as any)?.symbols;
                symbols?.fadeInReelBackground?.(400);
              } catch {}
              resolve();
            });
          });
        });
      } else {
        // Fallback in case scatterWinOverlay is not available
        console.warn('[ScatterAnimationManager] ScatterWinOverlay not available, skipping legacy free spins dialog');
        await this.disableSymbols();
      }

      // Note: Symbol reset will happen after dialog animations complete
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

    // Immediately disable symbols by setting alpha to 0
    this.symbolsContainer.setAlpha(0);

    // Also hide scatter symbols that are added directly to the scene
    this.hideScatterSymbols();

    // Add a small delay to ensure the disable is visible
    await this.delay(50);

    console.log('[ScatterAnimationManager] Symbols disabled');
  }

  private async slideSpinnerIn(): Promise<void> {
    if (!this.spinnerContainer) return;

    console.log('[ScatterAnimationManager] Sliding spinner in...');

    // Store original position
    const originalY = this.spinnerContainer.y;
    const targetY = originalY;
    const startY = originalY - this.config.slideDistance;

    // Set initial position above and make visible
    this.spinnerContainer.setPosition(this.spinnerContainer.x, startY);
    this.spinnerContainer.setVisible(true);

    return new Promise<void>((resolve) => {
      this.scene!.tweens.add({
        targets: this.spinnerContainer,
        y: targetY,
        duration: this.config.slideInDuration,
        ease: 'Back.easeOut',
        onComplete: () => {
          console.log('[ScatterAnimationManager] Spinner slid in and is in place');
          this.startSpin03Pulse();
          resolve();
        }
      });
    });
  }

  private startSpin03Pulse(): void {
    if (!this.spinnerContainer) return;

    // Find the spin_03 element in the spinner container
    const spin03 = this.spinnerContainer.getByName('spin_03') as Phaser.GameObjects.Image;
    if (!spin03) {
      console.warn('[ScatterAnimationManager] spin_03 element not found');
      return;
    }

    console.log('[ScatterAnimationManager] Starting spin_03 pulse animation...');

    // Create a single pulse animation at 10% bigger scale
    this.scene!.tweens.add({
      targets: spin03,
      scaleX: 0.65,
      scaleY: 0.65,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 0, // Pulse only once
      onComplete: () => {
        console.log('[ScatterAnimationManager] spin_03 pulse animation completed');
      }
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene!.time.delayedCall(ms, () => {
        resolve();
      });
    });
  }

  private triggerSpinnerRotation(data: Data): void {
    console.log('[ScatterAnimationManager] Triggering spinner rotation after 0.5s delay when spinner is in place');

    // First try to get the index from SpinData
    let scatterIndex = this.getFreeSpinIndexFromSpinData();

    if (scatterIndex >= 0) {
      // Use the index from SpinData
      console.log(`[ScatterAnimationManager] Using SpinData-based index: ${scatterIndex}`);
      const freeSpins = SCATTER_MULTIPLIERS[scatterIndex];
      console.log(`[ScatterAnimationManager] SpinData free spins: ${freeSpins}`);

      // Update the backend data with the SpinData values
      data.freeSpins = freeSpins;
      data.scatterIndex = scatterIndex;
      console.log(`[ScatterAnimationManager] Updated backend data with SpinData values: freeSpins=${freeSpins}, scatterIndex=${scatterIndex}`);
    } else {
      // Fallback to calculating scatter index based on number of scatter symbols found
      console.log('[ScatterAnimationManager] SpinData not available, calculating scatter index from symbols');
      const scatterGrids = this.getScatterGridsFromData(data);
      const scatterCount = scatterGrids.length;

      // Scatter index is based on number of scatter symbols (3+ = index 0, 4+ = index 1, etc.)
      // But we need to ensure it doesn't exceed the array bounds
      const maxScatterIndex = SCATTER_MULTIPLIERS.length - 1;
      scatterIndex = Math.min(Math.max(0, scatterCount - 3), maxScatterIndex);

      console.log(`[ScatterAnimationManager] Scatter calculation: ${scatterCount} symbols found, using index ${scatterIndex}`);

      // Get the free spins count from the calculated scatter index
      const freeSpins = SCATTER_MULTIPLIERS[scatterIndex];
      console.log(`[ScatterAnimationManager] Wheel will determine free spins: index ${scatterIndex} = ${freeSpins} free spins`);

      // Update the backend data with the calculated free spins value
      data.freeSpins = freeSpins;
      data.scatterIndex = scatterIndex;
      console.log(`[ScatterAnimationManager] Updated backend data with calculated values: freeSpins=${freeSpins}, scatterIndex=${scatterIndex}`);
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
        // Fallback to index-based spinner
        this.spinnerComponent.startScatterSpinner(data, scatterIndex);
        console.log(`[ScatterAnimationManager] Spinner rotation triggered with scatter index ${scatterIndex}`);
      } else {
        console.warn('[ScatterAnimationManager] Spinner component not available or missing required methods');
        gameEventManager.emit(GameEventType.WHEEL_SPIN_DONE);
      }
    } else if (this.spinnerComponent && typeof this.spinnerComponent.startScatterSpinner === 'function') {
      // Fallback to index-based spinner
      this.spinnerComponent.startScatterSpinner(data, scatterIndex);
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
        if (currentSpinData.slot && currentSpinData.slot.freespin) {
          const freeSpinsCount = currentSpinData.slot.freespin.count || 0;
          console.log(`[ScatterAnimationManager] Found freeSpins count in SpinData: ${freeSpinsCount}`);

          // Find the index in SCATTER_MULTIPLIERS array
          const index = SCATTER_MULTIPLIERS.indexOf(freeSpinsCount);
          console.log(`[ScatterAnimationManager] Looking for ${freeSpinsCount} in SCATTER_MULTIPLIERS:`, SCATTER_MULTIPLIERS);
          console.log(`[ScatterAnimationManager] Found index: ${index}`);

          if (index >= 0) {
            return index;
          } else {
            console.warn(`[ScatterAnimationManager] Free spins count ${freeSpinsCount} not found in SCATTER_MULTIPLIERS, using fallback`);
          }
        }
      }
    }

    // SpinData not available - return -1 to indicate no scatter found
    console.log('[ScatterAnimationManager] SpinData not available, no scatter index found');
    return -1;
  }

  /**
   * Get scatter grids from the data to calculate scatter index
   */
  private getScatterGridsFromData(data: Data): any[] {
    const scatterGrids: any[] = [];
    for (let y = 0; y < data.symbols.length; y++) {
      for (let x = 0; x < data.symbols[y].length; x++) {
        if (data.symbols[y][x] === Data.SCATTER[0]) {
          scatterGrids.push({ x, y, symbol: data.symbols[y][x] });
        }
      }
    }
    return scatterGrids;
  }

  private async waitForSpinnerAndShowDialog(data: Data): Promise<void> {
    console.log('[ScatterAnimationManager] ===== WAIT FOR SPINNER AND SHOW DIALOG CALLED =====');
    console.log('[ScatterAnimationManager] Waiting for spinner to complete and then showing dialog effects...');

    // Wait for the spinner animation duration (2000ms) plus our dialog delay
    const spinnerDuration = 9500; // Duration of the spinner tween
    const totalWaitTime = spinnerDuration + this.config.dialogDelay;

    console.log(`[ScatterAnimationManager] Waiting ${totalWaitTime}ms for spinner animation + dialog delay`);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('[ScatterAnimationManager] ===== TIMEOUT COMPLETED - SHOWING DIALOG =====');
        console.log('[ScatterAnimationManager] Spinner animation completed, showing dialog effects');
        this.showFreeSpinsDialog(data);
        resolve();
      }, totalWaitTime);
    });
  }

  private showFreeSpinsDialog(data: Data): void {
    console.log('[ScatterAnimationManager] ===== SHOW FREE SPINS DIALOG CALLED =====');
    console.log('[ScatterAnimationManager] Dialogs component available:', !!this.dialogsComponent);

    if (!this.dialogsComponent) {
      console.warn('[ScatterAnimationManager] Dialogs component not available');
      return;
    }

    // Get free spins count from the current spinData
    let freeSpins = 0; // Default to 0, will be set from spinData

    // Get free spins from the current spinData directly from symbols
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols && gameScene.symbols.currentSpinData) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        if (currentSpinData.slot) {
          // Handle both freespin and freeSpin property names
          const freespinData = currentSpinData.slot.freespin || currentSpinData.slot.freeSpin;
          if (freespinData && freespinData.count !== undefined) {
            freeSpins = freespinData.count;
            console.log(`[ScatterAnimationManager] Using current spinData freespin count: ${freeSpins}`);

            // Verify the freeSpins value exists in SCATTER_MULTIPLIERS
            const index = SCATTER_MULTIPLIERS.indexOf(freeSpins);
            if (index >= 0) {
              console.log(`[ScatterAnimationManager] Current spinData freeSpins ${freeSpins} found at index ${index} in SCATTER_MULTIPLIERS`);
            } else {
              console.warn(`[ScatterAnimationManager] Current spinData freeSpins ${freeSpins} not found in SCATTER_MULTIPLIERS`);
            }
          } else {
            console.warn(`[ScatterAnimationManager] No freespin count in current spinData`);
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

    console.log(`[ScatterAnimationManager] Free spins awarded: ${freeSpins}. Skipping legacy FreeSpinDialog_KA.`);
    console.log(`[ScatterAnimationManager] Backend data state: freeSpins=${data.freeSpins}, scatterIndex=${data.scatterIndex}`);

    // Update game state to reflect bonus mode
    console.log('[ScatterAnimationManager] Setting isBonus to true');
    gameStateManager.isBonus = true;
    console.log('[ScatterAnimationManager] isBonus is now:', gameStateManager.isBonus);

    // Do not force-dismiss overlays; bonus will continue after overlays end

    // Directly emit events and proceed to bonus without showing an intermediate dialog
    gameEventManager.emit(GameEventType.IS_BONUS, {
      scatterCount: data.scatterIndex,
      bonusType: 'freeSpins'
    });

    if (this.scene) {
      const eventData = { scatterIndex: data.scatterIndex, actualFreeSpins: freeSpins };
      console.log(`[ScatterAnimationManager] Emitting scatterBonusActivated event with data:`, eventData);
      this.scene.events.emit('scatterBonusActivated', eventData);
      console.log(`[ScatterAnimationManager] Emitted scatterBonusActivated event with index ${data.scatterIndex} and ${freeSpins} free spins`);
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
        if (currentSpinData && currentSpinData.slot && currentSpinData.slot.freespin) {
          return currentSpinData.slot.freespin.count || 0;
        }
      }
    }
    // No SpinData available - return 0
    return 0;
  }

  private resetAllSymbolsAndAnimations(): void {
    // Stop any active background music to let overlays/scenes manage BGM exclusively
    try {
      const audioMgr = (window as any).audioManager;
      if (audioMgr && typeof audioMgr.stopCurrentMusic === 'function') {
        audioMgr.stopCurrentMusic();
        console.log('[ScatterAnimationManager] Stopped current background music to defer control to overlay');
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

  public destroy(): void {
    // Clean up event listeners
    if (this.wheelSpinStartListener) {
      gameEventManager.off(GameEventType.WHEEL_SPIN_START, this.wheelSpinStartListener);
    }
    if (this.wheelSpinDoneListener) {
      gameEventManager.off(GameEventType.WHEEL_SPIN_DONE, this.wheelSpinDoneListener);
    }
    
    this.scene = null;
    this.symbolsContainer = null;
    this.spinnerContainer = null;
    this.spinnerComponent = null;
    this.isAnimating = false;
    this.wheelSpinStartListener = null;
    this.wheelSpinDoneListener = null;
    console.log('[ScatterAnimationManager] Destroyed');
  }
} 