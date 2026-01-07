import { Scene } from 'phaser';
import { Data } from '../tmp_backend/Data';
import { SpinData } from '../backend/SpinData';
import { gameEventManager, GameEventType } from '../event/EventManager';
import { gameStateManager } from './GameStateManager';
import { SoundEffectType } from './AudioManager';
import { TurboConfig } from '../config/TurboConfig';
import { SCATTER_MULTIPLIERS } from '../config/GameConfig';
import { getFullScreenSpineScale, playSpineAnimationSequenceWithConfig } from '../game/components/SpineBehaviorHelper';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { RainbowTransition } from '../game/components/RainbowTransition';

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
  private isAnimating: boolean = false;
  public delayedScatterData: any = null;
  private scatterSymbols: any[] = []; // Store references to scatter symbols
  private rainbowTransition: RainbowTransition | null = null;

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

  private constructor() { }

  public static getInstance(): ScatterAnimationManager {
    if (!ScatterAnimationManager.instance) {
      ScatterAnimationManager.instance = new ScatterAnimationManager();
    }
    return ScatterAnimationManager.instance;
  }

  public initialize(scene: Scene, symbolsContainer: Phaser.GameObjects.Container, spinnerContainer: Phaser.GameObjects.Container, spinnerComponent?: any, dialogsComponent?: any): void {
    this.scene = scene;
    this.symbolsContainer = symbolsContainer;
    this.spinnerContainer = spinnerContainer;
    this.spinnerComponent = spinnerComponent;
    this.dialogsComponent = dialogsComponent;

    // Initialize RainbowTransition component
    this.rainbowTransition = new RainbowTransition();
    this.rainbowTransition.init(scene);

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
    if (this.isAnimating || !this.scene || !this.symbolsContainer || !this.spinnerContainer) {
      console.warn('[ScatterAnimationManager] Cannot play animation - not ready or already animating');
      return;
    }

    this.isAnimating = true;
    console.log('[ScatterAnimationManager] Starting scatter animation sequence - player will see scatter symbols for 1 second');

    // Switch BG music to Free Spin track when scatter animation starts
    try {
      const audioMgr = (window as any).audioManager;
      if (audioMgr && typeof audioMgr.switchToFreeSpinMusic === 'function') {
        audioMgr.switchToFreeSpinMusic();
        console.log('[ScatterAnimationManager] Requested switch to free spin background music');
      }
    } catch (e) {
      console.warn('[ScatterAnimationManager] Failed to switch to free spin music', e);
    }

    try {
      // Step 1: Wait for player to see scatter symbols
      console.log('[ScatterAnimationManager] Waiting for player to see scatter symbols...');
      await this.delay(this.getTurboAdjustedDelay(this.config.scatterRevealDelay));

      // Step 2: Disable symbols
      // await this.disableSymbols();

      // Step 3: Slide spinner down
      // await this.slideSpinnerIn();

      // Step 4: Wait for delay then trigger spinner rotation
      // await this.delay(this.config.spinDelay);

      // Step 5: Trigger the spinner rotation
      // this.triggerSpinnerRotation(data);

      // Step 6: Wait for spinner to complete and show free spins dialog
      await this.waitForFreeSpinDialogInput(data);

      // Call custom transition here
      await this.startCustomTransition(this.scene, 0.6, 800);
 
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

  private async runFadeToBlackFallback(scene: Scene, flashDuration?: number): Promise<void> {
    if (!scene) return;

    const duration = flashDuration || 500;
    const camera = scene.cameras.main;

    console.warn('[ScatterAnimationManager] Falling back to fade-to-black transition');

    return new Promise<void>((resolve) => {
      const onFadeOutComplete = () => {
        scene.events.emit('scatterBonusCompleted');
        this.triggerBonusMode(scene);
        camera.fadeIn(duration, 0, 0, 0);
      };

      const onFadeInComplete = () => {
        camera.off('camerafadeoutcomplete', onFadeOutComplete);
        camera.off('camerafadeincomplete', onFadeInComplete);
        resolve();
      };

      camera.once('camerafadeoutcomplete', onFadeOutComplete);
      camera.once('camerafadeincomplete', onFadeInComplete);
      camera.fadeOut(duration, 0, 0, 0);
    });
  }

  private async startCustomTransition(scene: Scene, delayModifier?: number, flashDuration?: number): Promise<void> {
    if (!scene) {
      console.warn('[ScatterAnimationManager] Scene not available, using fade-to-black fallback');
      await this.runFadeToBlackFallback(scene, flashDuration);
      return;
    }

    if (!this.rainbowTransition) {
      console.warn('[ScatterAnimationManager] RainbowTransition not initialized, using fade-to-black fallback');
      await this.runFadeToBlackFallback(scene, flashDuration);
      return;
    }

    const hasSpineSupport = !!(scene.add as any)?.spine;
    if (!hasSpineSupport) {
      console.warn('[ScatterAnimationManager] Spine support missing, using fade-to-black fallback');
      await this.runFadeToBlackFallback(scene, flashDuration);
      return;
    }

    try {
      let scatterBonusEmitted = false;
      let resolved = false;

      const safeResolve = (resolve: () => void) => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      return new Promise<void>((resolve) => {
        const finish = () => {
          // Restore background music volume after the transition completes
          try {
            const audioManager = (window as any).audioManager;
            if (audioManager && typeof audioManager.restoreBackground === 'function') {
              audioManager.restoreBackground();
            }
          } catch { }

          safeResolve(resolve);
        };

        // Use RainbowTransition component with progress callback
        // Emit scatterBonusCompleted midway through (at progress 0.5)
        this.rainbowTransition!.playTransition(
          () => {
            // onComplete callback
            finish();
          },
          (progress: number) => {
            // onProgress callback - emit scatterBonusCompleted at 0.5 progress
            if (progress >= 0.5 && !scatterBonusEmitted) {
              scatterBonusEmitted = true;
              scene.events.emit('scatterBonusCompleted');
              this.triggerBonusMode(scene);
            }
          },
          250 // progressInterval: 250ms default
        );
      });
    } catch (error) {
      console.warn('[ScatterAnimationManager] Custom transition unavailable, using fade-to-black fallback', error);
      await this.runFadeToBlackFallback(scene, flashDuration);
    }
  }

  private triggerBonusMode(scene: Scene): void {
    console.log('[Dialogs] ===== TRIGGERING BONUS MODE TRANSITION =====');
    console.log('[Dialogs] Scene exists:', !!scene);
    console.log('[Dialogs] Scene events exists:', !!scene.events);

    // Set bonus mode in backend data
    scene.events.emit('setBonusMode', true);
    console.log('[Dialogs] Emitted setBonusMode event');

    // Switch to bonus background
    scene.events.emit('showBonusBackground');
    console.log('[Dialogs] Emitted showBonusBackground event');

    // Switch to bonus header
    scene.events.emit('showBonusHeader');
    console.log('[Dialogs] Emitted showBonusHeader event');

    // Re-enable symbols after bonus mode setup
    scene.events.emit('enableSymbols');
    console.log('[Dialogs] Emitted enableSymbols event');

    // Emit dialog animations complete event for scatter bonus reset
    scene.events.emit('dialogAnimationsComplete');
    console.log('[Dialogs] Dialog animations complete event emitted for bonus mode');

    console.log('[Dialogs] ===== BONUS MODE ACTIVATED - BACKGROUND AND HEADER SWITCHED =====');
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
        const freeSpinsCount = this.deriveFreeSpinsFromSpinData(currentSpinData);
        console.log(`[ScatterAnimationManager] Free spins derived for index lookup: ${freeSpinsCount}`);

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

    // SpinData not available - return -1 to indicate no scatter found
    console.log('[ScatterAnimationManager] SpinData not available, no scatter index found');
    return -1;
  }

  /**
   * Robustly derive number of free spins from SpinData supporting several formats.
   */
  private deriveFreeSpinsFromSpinData(currentSpinData: any): number {
    if (!currentSpinData || !currentSpinData.slot) {
      return 0;
    }

    // Accept both legacy 'freespin' and 'freeSpin' shapes
    const freespin = currentSpinData.slot.freespin;
    const freeSpin = currentSpinData.slot.freeSpin;

    // 1) Prefer explicit count if provided
    const count = (freespin && typeof freespin.count === 'number' && freespin.count) ||
                  (freeSpin && typeof freeSpin.count === 'number' && freeSpin.count) ||
                  0;
    if (count > 0) {
      return count;
    }

    // 2) Prefer items[0].spinsLeft if present (newer format)
    const items = (freeSpin && Array.isArray(freeSpin.items) && freeSpin.items) ||
                  (freespin && Array.isArray(freespin.items) && freespin.items) ||
                  [];
    const firstItem = items.length > 0 ? items[0] : null;
    const spinsLeft = firstItem && typeof firstItem.spinsLeft === 'number' ? firstItem.spinsLeft : 0;
    if (spinsLeft > 0) {
      return spinsLeft;
    }

    // 3) Fallback to items length if available
    if (items.length > 0) {
      return items.length;
    }

    return 0;
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

  private async waitForFreeSpinDialogInput(data: Data): Promise<void> {
    console.log('[ScatterAnimationManager] Showing FreeSpin dialog via showFreeSpinsDialog');
    this.showFreeSpinsDialog(data);

    // Wait until the Free Spin dialog is clicked before proceeding
    return new Promise<void>((resolve) => {
      if (!this.scene) {
        resolve();
        return;
      }

      let resolved = false;

      const resolveOnce = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      // Resolve when the Free Spin dialog is clicked
      this.scene.events.once('freeSpinDialogClicked', () => {
        console.log('[ScatterAnimationManager] freeSpinDialogClicked received - proceeding to transition');
        resolveOnce();
      });
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
        freeSpins = this.deriveFreeSpinsFromSpinData(currentSpinData);
        if (freeSpins > 0) {
          // Verify the freeSpins value exists in SCATTER_MULTIPLIERS
          const index = SCATTER_MULTIPLIERS.indexOf(freeSpins);
          if (index >= 0) {
            console.log(`[ScatterAnimationManager] Current spinData freeSpins ${freeSpins} found at index ${index} in SCATTER_MULTIPLIERS`);
          } else {
            console.warn(`[ScatterAnimationManager] Current spinData freeSpins ${freeSpins} not found in SCATTER_MULTIPLIERS`);
          }
        } else {
          console.warn(`[ScatterAnimationManager] Could not derive freeSpins from current SpinData`);
        }
      } else {
        console.warn(`[ScatterAnimationManager] Symbols or currentSpinData not available`);
      }
    }

    // If we couldn't get freeSpins from spinData, log error and use 0
    if (freeSpins === 0) {
      console.error(`[ScatterAnimationManager] Could not get freeSpins from current spinData - dialog will show 0`);
    }

    console.log(`[ScatterAnimationManager] Showing free spins dialog for ${freeSpins} free spins`);
    console.log(`[ScatterAnimationManager] Backend data state: freeSpins=${data.freeSpins}, scatterIndex=${data.scatterIndex}`);

    // Update game state to reflect bonus mode
    console.log('[ScatterAnimationManager] Setting isBonus to true');
    gameStateManager.isBonus = true;
    console.log('[ScatterAnimationManager] isBonus is now:', gameStateManager.isBonus);

    // Show the FreeSpinDialog_KA with all effects - this will trigger bonus mode when clicked
    try {
      console.log('[ScatterAnimationManager] Calling dialogsComponent.showDialog with type: FreeSpinDialog_KA, freeSpins:', freeSpins);
      this.dialogsComponent.showDialog(this.scene, {
        type: 'FreeSpinDialog',
        freeSpins: freeSpins
      });

      console.log('[ScatterAnimationManager] Free spins dialog displayed successfully');

      // Emit IS_BONUS event through the EventManager
      gameEventManager.emit(GameEventType.IS_BONUS, {
        scatterCount: data.scatterIndex,
        bonusType: 'freeSpins'
      });

      // Emit scatter bonus activated event with scatter index and actual free spins for UI updates
      if (this.scene) {
        const eventData = {
          scatterIndex: data.scatterIndex,
          actualFreeSpins: freeSpins
        };
        console.log(`[ScatterAnimationManager] Emitting scatterBonusActivated event with data:`, eventData);

        this.scene.events.emit('scatterBonusActivated', eventData);
        console.log(`[ScatterAnimationManager] Emitted scatterBonusActivated event with index ${data.scatterIndex} and ${freeSpins} free spins`);
      }

      // Set up listener for when dialog animations complete
      this.setupDialogCompletionListener();

    } catch (error) {
      console.error('[ScatterAnimationManager] Error showing dialog effects:', error);
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
   * Check if we're currently in an active bonus mode (free spins)
   */
  private isInActiveBonusMode(): boolean {
    // Check if we have free spins remaining or if we're in bonus mode
    // Use SpinData freespin count
    const hasFreeSpins = this.getCurrentFreeSpinsCount() > 0;
    const isBonusMode = gameStateManager.isBonus;

    console.log(`[ScatterAnimationManager] Checking bonus mode: hasFreeSpins=${hasFreeSpins}, isBonus=${isBonusMode}`);

    return hasFreeSpins || isBonusMode;
  }

  /**
   * Get the current free spins count from SpinData
   */
  private getCurrentFreeSpinsCount(): number {
    // Try to get free spins count from the current spin data
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols) {
        const currentSpinData = gameScene.symbols.currentSpinData;
        if (currentSpinData) {
          return this.deriveFreeSpinsFromSpinData(currentSpinData);
        }
      }
    }

    // No SpinData available - return 0
    return 0;
  }

  /**
   * Consume one free spin (decrement count)
   * Note: freespin.count should remain the original total count from API response
   */
  public consumeFreeSpin(): void {
    const currentCount = this.getCurrentFreeSpinsCount();
    if (currentCount > 0) {
      const newCount = currentCount - 1;
      console.log(`[ScatterAnimationManager] Consuming free spin: ${currentCount} -> ${newCount}`);

      // Note: We should NOT modify freespin.count as it represents the original total won
      // The remaining spins should be tracked separately for display purposes

      // Free spins count updated in SpinData

      // If no more free spins, end bonus mode
      if (newCount === 0) {
        this.endBonusMode();
      }
    }
  }

  /**
   * End bonus mode when free spins are completed
   */
  public endBonusMode(): void {
    console.log('[ScatterAnimationManager] Ending bonus mode');
    gameStateManager.isBonus = false;

    // Note: We should NOT modify freespin.count as it represents the original total won
    // Only clear the items array and totalWin for cleanup
    if (this.scene) {
      const gameScene = this.scene as any; // Cast to access symbols property
      if (gameScene.symbols && gameScene.symbols.currentSpinData) {
        if (gameScene.symbols.currentSpinData.slot && gameScene.symbols.currentSpinData.slot.freespin) {
          // Keep original count - don't modify freespin.count
          gameScene.symbols.currentSpinData.slot.freespin.totalWin = 0;
          gameScene.symbols.currentSpinData.slot.freespin.items = [];
        }
      }
    }

    // Free spins data cleared from SpinData (except original count)

    // Emit events to switch back to normal mode
    if (this.scene) {
      this.scene.events.emit('hideBonusBackground');
      this.scene.events.emit('hideBonusHeader');
    }
  }

  /**
   * Reset all symbols and animations after scatter bonus completes
   */
  private async resetAllSymbolsAndAnimations(): Promise<void> {
    console.log('[ScatterAnimationManager] Resetting all symbols and animations...');

    try {
      // If free spin music is playing, stop it and switch to bonus music when entering bonus mode
      try {
        const audioMgr = (window as any).audioManager;
        const currentType = audioMgr && typeof audioMgr.getCurrentMusicType === 'function' ? audioMgr.getCurrentMusicType() : null;
        if (currentType === 'freespin') {
          if (typeof audioMgr.stopCurrentMusic === 'function') {
            audioMgr.stopCurrentMusic();
            console.log('[ScatterAnimationManager] Stopped free spin music after scatter animation finishes');
          }
          if (gameStateManager.isBonus) {
            if (typeof audioMgr.crossfadeTo === 'function') {
              audioMgr.crossfadeTo('bonus', 600);
              console.log('[ScatterAnimationManager] Crossfading to bonus background music after scatter animation');
            } else if (typeof audioMgr.playBackgroundMusic === 'function') {
              audioMgr.playBackgroundMusic('bonus');
              console.log('[ScatterAnimationManager] Started bonus background music after scatter animation');
            }
          }
        }
      } catch { }

      // Reset game state - but don't reset isBonus if we're in an active bonus mode
      gameStateManager.isScatter = false;

      // Only reset isBonus if we're not in an active bonus mode (free spins)
      // The bonus mode should persist throughout the free spins
      if (!this.isInActiveBonusMode()) {
        console.log('[ScatterAnimationManager] Not in active bonus mode, resetting isBonus to false');
        gameStateManager.isBonus = false;
      } else {
        console.log('[ScatterAnimationManager] In active bonus mode, keeping isBonus as true');
      }

      gameStateManager.scatterIndex = 0;

      // Reset symbols container visibility
      if (this.symbolsContainer) {
        this.symbolsContainer.setAlpha(1);
        this.symbolsContainer.setVisible(true);
        console.log('[ScatterAnimationManager] Symbols container reset to visible with alpha 1');
      }

      // Re-enable scatter symbols
      this.showScatterSymbols();

      // Hide spinner container
      if (this.spinnerContainer) {
        this.spinnerContainer.setVisible(false);
        console.log('[ScatterAnimationManager] Spinner container hidden');
      }

      // Reset any active tweens on the spinner
      if (this.spinnerContainer) {
        this.scene?.tweens.killTweensOf(this.spinnerContainer);
        console.log('[ScatterAnimationManager] Spinner tweens killed');
      }

      // Kill any active tweens on the symbols container
      if (this.symbolsContainer) {
        this.scene?.tweens.killTweensOf(this.symbolsContainer);
        console.log('[ScatterAnimationManager] Symbols container tweens killed');
      }

      // Emit event to notify Symbols component to restore symbol visibility
      if (this.scene) {
        this.scene.events.emit('scatterBonusCompleted');
        console.log('[ScatterAnimationManager] Emitted scatterBonusCompleted event');
      }

      console.log('[ScatterAnimationManager] All symbols and animations reset successfully');

    } catch (error) {
      console.error('[ScatterAnimationManager] Error resetting symbols and animations:', error);
    }
  }

  public hideSpinner(): void {
    if (this.spinnerContainer) {
      this.spinnerContainer.setVisible(false);
    }
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

    // Clean up RainbowTransition
    if (this.rainbowTransition) {
      this.rainbowTransition.cleanup();
      this.rainbowTransition = null;
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