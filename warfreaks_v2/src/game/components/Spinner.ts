import { Scene } from "phaser";
import { Data } from "../../tmp_backend/Data";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { SCATTER_MULTIPLIERS } from '../../config/GameConfig';
import { SpinData } from '../../backend/SpinData';
import { AudioManager, SoundEffectType } from '../../managers/AudioManager';

export class Spinner {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;
  public spinTween: Phaser.Tweens.Tween;
  public spin2: Phaser.GameObjects.Image;
  private networkManager: NetworkManager;
  private screenModeManager: ScreenModeManager;
  private scatterAnimationManager: ScatterAnimationManager;

  // The values on the wheel, in counter-clockwise order.
  private segments: number = Data.SCATTER_MULTIPLIERS.length;
  private pointerOffsetRad: number = -(2 * Math.PI) / (2 * this.segments);

  constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
    this.networkManager = networkManager;
    this.screenModeManager = screenModeManager;
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
  }

  public preload(scene: Scene) {
    // Assets are now loaded centrally through AssetConfig in Preloader
    console.log(`[Spinner] Assets loaded centrally through AssetConfig`);
  }

  public create(scene: Scene) {
    this.scene = scene;
    const assetScale = this.networkManager.getAssetScale();
    const screenConfig = this.screenModeManager.getScreenConfig();
    
    console.log(`[Spinner] Creating spinner with scale: ${assetScale}x for ${screenConfig.isPortrait ? 'portrait' : 'landscape'} mode`);
    
    // Create main container
    this.container = scene.add.container(0, 0);
    this.container.setVisible(false); // Temporarily visible for layout testing

    // Create spinner elements based on screen orientation
    if (screenConfig.isPortrait) {
      this.createPortraitSpinner(scene, assetScale);
    } else {
      this.createLandscapeSpinner(scene, assetScale);
    }

    this.setToIndex(0);
    console.log("Wheel set to index 0 (value 9).");

    this.onSpinResponse();
    this.setupDialogEventListeners();
  }

  private createPortraitSpinner(scene: Scene, assetScale: number): void {
    console.log("[Spinner] Creating portrait spinner layout");
    
    const x = scene.scale.width * 0.5;
    const y = scene.scale.height * 0.5;
    const scaleMultiplier = 0.378;
    this.container.setPosition(x, y);

    const wheelPosx = 0;
    const wheelPosy = -90;

    const spin1 = scene.add.image(wheelPosx, wheelPosy, 'spin_01').setOrigin(0.5,0.5).setScale(assetScale * scaleMultiplier);
    this.spin2 = scene.add.image(wheelPosx, wheelPosy, 'spin_02').setOrigin(0.5,0.5).setScale(assetScale * scaleMultiplier);
    const spin3 = scene.add.image(wheelPosx, wheelPosy, 'spin_03').setOrigin(0.5,0.5).setScale(assetScale * scaleMultiplier).setName('spin_03');
    const spin4 = scene.add.image(wheelPosx, wheelPosy + 185, 'spin_04').setOrigin(0.5,0.5).setScale(assetScale * scaleMultiplier * 1.05);
    
    // Create single square mask for spin1, spin2, spin3
    const maskSize = 400;
    const maskGraphics = scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(scene.scale.width/2 - maskSize/2, scene.scale.height/2 - maskSize/2, maskSize, maskSize);
    maskGraphics.setVisible(false); // Hide the graphics object
    const squareMask = maskGraphics.createGeometryMask();
    
    // Apply the same mask to all three spinner elements
    spin1.setMask(squareMask);
    this.spin2.setMask(squareMask);
    spin3.setMask(squareMask);
    
    this.container.add([spin1, this.spin2, spin3, spin4]);
  }

  private createLandscapeSpinner(scene: Scene, assetScale: number): void {
    console.log("[Spinner] Creating landscape spinner layout");
    
    const x = scene.scale.width * 0.8;
    const y = scene.scale.height * 0.5;
    this.container.setPosition(x, y);

    const spin1 = scene.add.image(0, 0, 'spin_01').setScale(assetScale * 0.4);
    this.spin2 = scene.add.image(0, 0, 'spin_02').setScale(assetScale * 0.4);
    const spin3 = scene.add.image(0, 0, 'spin_03').setScale(assetScale * 0.4).setName('spin_03');
    const spin4 = scene.add.image(0, scene.scale.height * 0.3, 'spin_04').setScale(assetScale * 0.4);
    
    // Create single square mask for spin1, spin2, spin3
    const maskSize = 200;
    const maskGraphics = scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(scene.scale.width/2 - maskSize/2, scene.scale.height/2 - maskSize/2, maskSize, maskSize);
    maskGraphics.setVisible(false); // Hide the graphics object
    const squareMask = maskGraphics.createGeometryMask();
    
    // Apply the same mask to all three spinner elements
    spin1.setMask(squareMask);
    this.spin2.setMask(squareMask);
    spin3.setMask(squareMask);
    
    this.container.add([spin1, this.spin2, spin3, spin4]);
  }

  private onSpinResponse() {
    gameEventManager.on(GameEventType.WIN_STOP, (data: any) => {
      if (gameStateManager.isScatter) {
        // Check if scatter animation is in progress
        if (this.scatterAnimationManager.isAnimationInProgress()) {
          console.log('[Spinner] Scatter animation in progress, skipping direct spin');
          return;
        }
        
        // Don't immediately show and spin - let ScatterAnimationManager control the timing
        console.log('[Spinner] Scatter detected, waiting for ScatterAnimationManager to control spinner timing');
      }
    });

    gameEventManager.on(GameEventType.WHEEL_SPIN_DONE, (data: any) => {
      // Don't hide the wheel during scatter animations - let it stay visible
      if (!this.scatterAnimationManager.isAnimationInProgress()) {
        this.container.setVisible(false);
      }
    });
  }

  private setupDialogEventListeners() {
    // Listen for dialog events to disable/hide spinner
    this.scene.events.on('disableSpinner', () => {
      console.log('[Spinner] Disabling spinner due to dialog transition');
      
      // Stop any active spin tween
      if (this.spinTween && this.spinTween.isPlaying()) {
        this.spinTween.stop();
        console.log('[Spinner] Stopped active spin tween');
      }
      
      // Hide the spinner container
      this.container.setVisible(false);
      console.log('[Spinner] Spinner hidden during dialog transition');
    });
  }

  public setToIndex(index: number) {
    if (index < 0 || index >= this.segments) {
      console.error(`Invalid index: ${index}`);
      return;
    }
    // The angle calculation now uses the corrected negative offset.
    const targetAngleRad = (2 * Math.PI * index / this.segments) + this.pointerOffsetRad;
    this.spin2.rotation = targetAngleRad;
  }

  public spinAndStopAt(data: Data, index: number) {
    if (index < 0 || index >= this.segments) {
      console.error(`Invalid index provided to spinAndStopAt: ${index}`);
      return;
    }

    if (this.spinTween && this.spinTween.isPlaying()) {
      this.spinTween.stop();
    }

    // Play wheel spin sound effect
    if ((window as any).audioManager) {
      (window as any).audioManager.playSoundEffect(SoundEffectType.WHEEL_SPIN);
      console.log('[Spinner] Wheel spin sound effect played');
    } else {
      console.warn('[Spinner] AudioManager not found on window');
    }

    // Emit WHEEL_SPIN_START event when wheel starts spinning
    console.log('[Spinner] Wheel spin started, emitting WHEEL_SPIN_START event');
    gameEventManager.emit(GameEventType.WHEEL_SPIN_START, { 
      scatterIndex: index, 
      multiplier: Data.SCATTER_MULTIPLIERS[index] || 0 
    });

    const targetAngleRad = (2 * Math.PI * index / this.segments) + this.pointerOffsetRad;

    const fullSpins = 18;
    const finalAngle = this.spin2.rotation + (Math.PI * 2 * fullSpins) + this.getShortestAngleDifference(this.spin2.rotation, targetAngleRad);

    this.spinTween = this.scene.tweens.add({
      targets: this.spin2,
      rotation: finalAngle,
      duration: 9000,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.spin2.rotation = targetAngleRad;
        console.log('[Spinner] Wheel spin completed, emitting WHEEL_SPIN_DONE event');
        gameEventManager.emit(GameEventType.WHEEL_SPIN_DONE, { 
          scatterIndex: gameStateManager.scatterIndex || 0, 
          multiplier: Data.SCATTER_MULTIPLIERS[gameStateManager.scatterIndex || 0] || 0 
        });
      }
    });
  }

  /**
   * Start spinner animation for scatter bonus (called by ScatterAnimationManager)
   */
  public startScatterSpinner(data: Data, index: number): void {
    console.log('[Spinner] Starting scatter spinner animation');
    this.spinAndStopAt(data, index);
  }

  /**
   * Start spinner animation using SpinData (finds index from SCATTER_MULTIPLIERS)
   */
  public startScatterSpinnerFromSpinData(spinData: SpinData): void {
    console.log('[Spinner] Starting scatter spinner from SpinData');
    
    // Derive the number of free spins from SpinData robustly
    const freeSpinsCount = this.deriveFreeSpinsFromSpinData(spinData);
    console.log(`[Spinner] Free spins count from SpinData: ${freeSpinsCount}`);
    
    // Find the index in SCATTER_MULTIPLIERS that matches the free spins count
    const multiplierIndex = this.getFreeSpinsIndex(freeSpinsCount);
    console.log(`[Spinner] Found multiplier index ${multiplierIndex} for ${freeSpinsCount} free spins`);
    
    if (multiplierIndex >= 0) {
      // Show the spinner and spin to the calculated index
      this.container.setVisible(true);
      this.spinAndStopAt(new Data(), multiplierIndex);
    } else {
      console.warn(`[Spinner] No matching multiplier found for ${freeSpinsCount} free spins, using index 0`);
      // Default to index 0 if no match found
      this.container.setVisible(true);
      this.spinAndStopAt(new Data(), 0);
    }
  }

  /**
   * Get the index of the free spins count in SCATTER_MULTIPLIERS array
   */
  private getFreeSpinsIndex(freeSpinsCount: number): number {
    const index = SCATTER_MULTIPLIERS.indexOf(freeSpinsCount);
    console.log(`[Spinner] Looking for ${freeSpinsCount} in SCATTER_MULTIPLIERS:`, SCATTER_MULTIPLIERS);
    console.log(`[Spinner] Found index: ${index}`);
    return index;
  }

  /**
   * Robust extraction of free spins count from SpinData supporting multiple shapes.
   */
  private deriveFreeSpinsFromSpinData(spinData: any): number {
    if (!spinData || !spinData.slot) {
      return 0;
    }

    // Accept both legacy 'freespin' and 'freeSpin' shapes
    const freespin = spinData.slot.freespin;
    const freeSpin = spinData.slot.freeSpin;

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
    
  private getShortestAngleDifference(current: number, target: number): number {
    const fullCircle = 2 * Math.PI;
    const normalizedCurrent = (current % fullCircle + fullCircle) % fullCircle;
    const normalizedTarget = (target % fullCircle + fullCircle) % fullCircle;
    let difference = normalizedTarget - normalizedCurrent;
    if (difference > Math.PI) {
        difference -= fullCircle;
    } else if (difference < -Math.PI) {
        difference += fullCircle;
    }
    return difference;
  }

  public update(time: number, delta: number) { }
}