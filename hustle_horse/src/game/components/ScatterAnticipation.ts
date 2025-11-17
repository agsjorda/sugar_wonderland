import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { TurboConfig } from '../../config/TurboConfig';
import { gameStateManager } from '../../managers/GameStateManager';
import { SCATTER_ANTICIPATION_POS_X_MUL, SCATTER_ANTICIPATION_POS_Y_MUL, SCATTER_ANTICIPATION_DEFAULT_SCALE } from '../../config/UIPositionConfig';

// Animation configuration
const ANIMATION_CONFIG = {
  OVERLAY: {
    DURATION: 500,
    EASE: 'Cubic.easeOut',
    HIDE_EASE: 'Cubic.easeIn',
    BASE_OVERLAY_OPACITY: 0.2,
    OVERLAY_OPACITY: 0.85
  },
  SHAKE: {
    DURATION: 2500,
    INTENSITY: 0.004,
    DRAGON_MOVE_DURATION: 1200,
    DRAGON_MOVE_DELAY: 500
  }
} as const;

interface ScatterAnticipationOptions {
  x?: number;
  y?: number;
  scale?: number;
}

export class ScatterAnticipation {
  private scene: Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private spineObject: any | null = null;
  private ownsContainer: boolean = false;
  private retryCount: number = 0;
  private desiredX?: number;
  private desiredY?: number;
  private desiredScale?: number;
  private isVisible: boolean = false;
  // Flag to control use of legacy anticipation black overlay graphics
  private useLegacyAnticipationOverlay: boolean = false;

  private playDefaultLoop(): void {
    if (!this.spineObject) return;
    
    try {
      const { animationState } = this.spineObject;
      animationState.clearTracks();
      animationState.timeScale = Math.max(0.0001, animationState.timeScale || 1);
      
      // Try default animation first, fallback to first available
      const animations = animationState.data.skeletonData.animations;
      const defaultAnim = animations.some(a => a.name === 'default') 
        ? 'default' 
        : animations[0]?.name;
      
      if (defaultAnim) {
        animationState.setAnimation(0, defaultAnim, true);
        console.log(`[ScatterAnticipation] Playing animation: ${defaultAnim} (loop)`);
      }
    } catch (error) {
      console.error('[ScatterAnticipation] Error playing animation:', error);
    }
  }

	constructor() {}

  public create(
    scene: Scene, 
    parentContainer?: Phaser.GameObjects.Container, 
    options: ScatterAnticipationOptions = {}
  ): void {
    this.scene = scene;

    if (!ensureSpineFactory(scene, '[ScatterAnticipation] create')) {
      console.warn('[ScatterAnticipation] Spine factory unavailable. Skipping creation.');
      return;
    }

    this.initializeContainer(parentContainer);
    this.updatePositionOptions(options);
    
    const centerX = this.desiredX ?? scene.scale.width * SCATTER_ANTICIPATION_POS_X_MUL;
    const centerY = this.desiredY ?? scene.scale.height * SCATTER_ANTICIPATION_POS_Y_MUL;

    this.tryCreateSpine(centerX, centerY);
    this.setupEventListeners();
  }

  private initializeContainer(parentContainer?: Phaser.GameObjects.Container): void {
    if (parentContainer) {
      this.container = parentContainer;
      this.ownsContainer = false;
    } else {
      this.container = this.scene.add.container(0, 0);
      this.container.setDepth(30000);
      this.ownsContainer = true;
    }
  }

  private updatePositionOptions(options: ScatterAnticipationOptions): void {
    this.desiredX = options.x ?? this.desiredX;
    this.desiredY = options.y ?? this.desiredY;
    this.desiredScale = options.scale ?? this.desiredScale;
  }

  private setupEventListeners(): void {
    this.setupTurboListeners();
    this.setupWinListeners();
  }

  private tryCreateSpine(centerX: number, centerY: number): void {
    if (!this.container) return;

    if (!this.isSpineDataReady()) {
      this.retrySpineCreation(centerX, centerY);
      return;
    }

    this.createSpineObject(centerX, centerY);
  }

  private isSpineDataReady(): boolean {
    const isReady = (this.scene.cache.json as any).has('Sparkler_Reel');
    if (!isReady && this.retryCount < 5) {
      this.retryCount++;
      return false;
    }
    return isReady;
  }

  private retrySpineCreation(centerX: number, centerY: number): void {
    console.warn(`[ScatterAnticipation] Spine json 'Sparkler_Reel' not ready. Retrying (${this.retryCount}/5)...`);
    this.scene.time.delayedCall(250, () => this.tryCreateSpine(centerX, centerY));
  }

  private createSpineObject(centerX: number, centerY: number): void {
    try {
      this.spineObject = this.scene.add.spine(centerX, centerY, 'Sparkler_Reel', 'Sparkler_Reel-atlas');
      this.spineObject.setOrigin(0.5, 0.5);
      this.spineObject.setScale(this.desiredScale ?? SCATTER_ANTICIPATION_DEFAULT_SCALE);
      this.spineObject.setDepth(0);
      this.spineObject.setVisible(false); // Start hidden
      this.container?.add(this.spineObject);
      console.log('[ScatterAnticipation] Created spine animation at center (hidden)');
    } catch (error) {
      console.error('[ScatterAnticipation] Failed to create spine animation', error);
    }
  }

  public setPosition(x: number, y: number): void {
    this.desiredX = x;
    this.desiredY = y;
    this.spineObject?.setPosition(x, y);
  }

  public setScale(scale: number): void {
    this.desiredScale = scale;
    this.spineObject?.setScale(scale);
  }

  public show(): void {
    if (!this.container) return;
    
    this.setVisibility(true);
    this.startOverlayTransition(true);
    this.playAnticipationSound();
    this.applyTurboToAnticipation();
    
    // Ensure the animation is playing when shown
    if (this.spineObject) {
      this.playDefaultLoop();
    }
  }

  private setVisibility(visible: boolean): void {
    this.isVisible = visible;
    if (this.spineObject) {
      this.spineObject.setVisible(visible);
    }
    if (this.ownsContainer) {
      this.container?.setVisible(visible);
    }
  }

  private startOverlayTransition(show: boolean): void {
    try {
      const symbols = (this.scene as any)?.symbols;
      if (!symbols) return;

      try {
        if (show) {
          symbols.pushAllSymbolsBehindReelBg?.();
          symbols.liftScatterSymbolsAboveReelBg?.();
        } else {
          symbols.restoreLiftedScatterSymbols?.();
          symbols.restoreSymbolsAboveReelBg?.();
        }
      } catch {}

      if (!this.useLegacyAnticipationOverlay) {
        try {
          if (show) {
            symbols.tweenReelBackgroundToAnticipationTint?.(ANIMATION_CONFIG.OVERLAY.DURATION);
          } else {
            symbols.tweenReelBackgroundToDefaultTint?.(ANIMATION_CONFIG.OVERLAY.DURATION);
          }
        } catch {}
        console.log('[ScatterAnticipation] startOverlayTransition (legacy overlay disabled) - using reel background tint only');
        return;
      }

      this.ensureOverlaysExist(symbols);
      
      if (show) {
        this.showOverlays(symbols);
      } else {
        this.hideOverlays(symbols);
      }
    } catch (error) {
      console.error(`[ScatterAnticipation] Error in ${show ? 'show' : 'hide'} overlay transition:`, error);
    }
  }

  private ensureOverlaysExist(symbols: any): void {
    if (!symbols.baseOverlayRect) symbols.createBaseOverlayRect();
    if (!symbols.overlayRect) symbols.createOverlayRect();
    
    // Ensure overlays are visible before starting transitions
    symbols.baseOverlayRect?.setVisible(true);
    symbols.overlayRect?.setVisible(true);
  }

  private showOverlays(symbols: any): void {
    const { baseOverlayRect, overlayRect } = symbols;
    const { DURATION, EASE, OVERLAY_OPACITY } = ANIMATION_CONFIG.OVERLAY;

    // Fade out base overlay
    this.scene.tweens.add({
      targets: baseOverlayRect,
      alpha: 0,
      duration: DURATION,
      ease: EASE
    });

    // Fade in black overlay (opacity controlled by graphics alpha)
    overlayRect.setAlpha(0);
    this.scene.tweens.add({
      targets: overlayRect,
      alpha: OVERLAY_OPACITY,
      duration: DURATION,
      ease: EASE,
      onStart: () => overlayRect.setVisible(true)
    });
  }

  private playAnticipationSound(): void {
    try {
      const audio = (window as any)?.audioManager;
      audio?.playSoundEffect?.('anticipation');
    } catch (error) {
      console.error('[ScatterAnticipation] Error playing anticipation sound:', error);
    }
  }

  private applyTurboToAnticipation(): void {
    try {
      const animationState = this.spineObject?.animationState;
      if (!animationState) return;
      
      const isTurbo = (window as any)?.gameStateManager?.isTurbo ?? false;
      const speed = isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
      animationState.timeScale = Math.max(0.0001, speed);
    } catch (error) {
      console.error('[ScatterAnticipation] Error applying turbo:', error);
    }
  }

  private setupTurboListeners(): void {
    try {
      const handler = () => this.applyTurboToAnticipation();
      gameEventManager.on(GameEventType.TURBO_ON, handler);
      gameEventManager.on(GameEventType.TURBO_OFF, handler);
    } catch (error) {
      console.error('[ScatterAnticipation] Error setting up turbo listeners:', error);
    }
  }

  private setupWinListeners(): void {
    try {
      const triggerSequence = this.createWinSequenceHandler();
      
      // Register for different win events
      gameEventManager.on(GameEventType.WIN_START, triggerSequence);
      this.scene.events.on('scatterBonusActivated', triggerSequence);
      this.scene.events.on('symbol0-win-start', triggerSequence);
    } catch (error) {
      console.error('[ScatterAnticipation] Error setting up win listeners:', error);
    }
  }

  private createWinSequenceHandler(): () => void {
    return () => {
      if (!this.shouldTriggerWinSequence()) return;
      this.triggerCameraShake();
      this.animateDragons();
    };
  }

  private shouldTriggerWinSequence(): boolean {
    try {
      return !gameStateManager?.isBonus && gameStateManager?.isScatter === true;
    } catch {
      return false;
    }
  }

  private triggerCameraShake(): void {
    try {
      const turboMul = gameStateManager?.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const { DURATION, INTENSITY } = ANIMATION_CONFIG.SHAKE;
      const shakeMs = Math.max(50, Math.floor(DURATION * turboMul));
      
      this.scene.cameras.main.shake(shakeMs, INTENSITY);
      this.scene.sound.play('rumble_hh');
    } catch (error) {
      console.error('[ScatterAnticipation] Error triggering camera shake:', error);
    }
  }

  private animateDragons(): void {
    try {
      const symbols = (this.scene as any)?.symbols;
      if (!symbols?.animateBottomDragonToX || !symbols.animateTopDragonToX) return;

      const turboMul = gameStateManager?.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const {
        DRAGON_MOVE_DURATION: baseDuration,
        DRAGON_MOVE_DELAY: baseDelay
      } = ANIMATION_CONFIG.SHAKE;
      
      const moveDur = Math.max(100, Math.floor(baseDuration * turboMul));
      const delayTop = Math.max(0, Math.floor(baseDelay * turboMul));
      
      // Animate bottom dragon to right
      const rightX = this.scene.scale.width + 900;
      symbols.animateBottomDragonToX(rightX, moveDur, 'Sine.easeInOut');
      
      // Animate top dragon to left after delay
      this.scene.time.delayedCall(delayTop, () => {
        const leftX = -900;
        symbols.animateTopDragonToX(leftX, moveDur, 'Sine.easeInOut');
      });
    } catch (error) {
      console.error('[ScatterAnticipation] Error animating dragons:', error);
    }
  }

  public hide(): void {
    if (!this.container || !this.isVisible) return;
    
    this.isVisible = false;
    this.startOverlayTransition(false);
    this.setVisibility(false);
    this.fadeOutAnticipationSound();
  }

  private hideOverlays(symbols: any): void {
    const { baseOverlayRect, overlayRect } = symbols;
    const { DURATION, EASE, HIDE_EASE, BASE_OVERLAY_OPACITY } = ANIMATION_CONFIG.OVERLAY;

    // Fade out black overlay
    this.scene.tweens.add({
      targets: overlayRect,
      alpha: 0,
      duration: DURATION,
      ease: HIDE_EASE,
      onComplete: () => overlayRect.setVisible(false)
    });

    // Fade in base overlay
    baseOverlayRect.fillStyle(0xE5E5E5, BASE_OVERLAY_OPACITY);
    baseOverlayRect.setAlpha(0);
    baseOverlayRect.setVisible(true);
    
    this.scene.tweens.add({
      targets: baseOverlayRect,
      alpha: 1,
      duration: DURATION,
      ease: EASE
    });
  }

  private fadeOutAnticipationSound(): void {
    try {
      const audio = (window as any)?.audioManager;
      audio?.fadeOutSfx?.('anticipation', 300);
    } catch (error) {
      console.error('[ScatterAnticipation] Error fading out anticipation sound:', error);
    }
  }

	public destroy(): void {
		if (this.spineObject) {
			this.spineObject.destroy();
			this.spineObject = null;
		}
		if (this.container && this.ownsContainer) {
			this.container.destroy();
			this.container = null;
		}
	}
}


