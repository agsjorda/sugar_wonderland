import { Scene } from 'phaser';
import { ensureSpineLoader, ensureSpineFactory } from '../../utils/SpineGuard';
import { MusicType } from '../../managers/AudioManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { resolveAssetUrl } from '../../utils/AssetLoader';
import type { SpinData } from '../../backend/SpinData';

export class ScatterWinOverlay {
    private scene: Scene | null = null;
    private container: Phaser.GameObjects.Container | null = null;
    private background: Phaser.GameObjects.Rectangle | null = null;
    private winFont: any | null = null; // Spine for fire animation
    private pickACard: Phaser.GameObjects.Image | null = null;
    private chooseText: Phaser.GameObjects.Text | null = null;
    private imagesContainer: Phaser.GameObjects.Container | null = null;
    private fireContainer: Phaser.GameObjects.Container | null = null;
  private bottomFireContainer: Phaser.GameObjects.Container | null = null;
    private cardsContainer: Phaser.GameObjects.Container | null = null;
    private cards: Phaser.GameObjects.GameObject[] = [];
    private pngCardScale: number = 0.95;
    private pngCenterEnlargeMultiplier: number = 2;
    private flippedCardScaleMultiplier: number = 1; // applied to pngCardScale after flip
    private moveToCenterDurationMs: number = 350;
    private enlargeDurationMs: number = 400;
    // Fade timings for PNG flip reveal
    // Final resting position for the selected card after flip (upper center)
    private flippedCardTargetYRatio: number = 0.480;
    // Duration for moving the flipped card to its final upper-center position
    private moveToUpperCenterDurationMs: number = 600;
    // Overlay text (Free-spin-text.png) placement options
    private overlayTextOffsetX: number = -40; // px offset from card center
    private overlayTextOffsetY: number = -155; // px offset from card center
    private overlayTextScaleFactor: number = 1; // relative to card scale
    private overlayTextRef: Phaser.GameObjects.Image | null = null;
  private congratsRef: Phaser.GameObjects.Image | null = null;
  private congratsFireSpine: any | null = null;
  private congratsFireContainer: Phaser.GameObjects.Container | null = null;
  private pressAnyText: Phaser.GameObjects.Text | null = null;
  // Final transition overlay elements
  private transitionContainer: Phaser.GameObjects.Container | null = null;
  private transitionBg: Phaser.GameObjects.Rectangle | null = null;
  private transitionSpine: any | null = null;
  private fireTransitionLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
  private fireTransitionLoadPromise: Promise<boolean> | null = null;
  private fireTransitionTimeScale: number = 0.85;
  // Ratio in [0,1] at which to switch to bonus during Fire_Transition (0.5 = midway)
  private fireTransitionMidTriggerRatio: number = 0.5;
    // Delay before starting free-spin autoplay after entering bonus (ms)
    private freeSpinAutoplayDelayMs: number = 800;
  // Embers anticipation (post-fire)
  private overlayEmbersContainer: Phaser.GameObjects.Container | null = null;
  private overlayEmbersSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private overlayEmberParticles: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; size: number; color: number; alpha: number; lifetime: number; age: number; }> = [];
  private overlayEmbersUpdateHandler: ((time: number, delta: number) => void) | null = null;
    // Congrats popup options
    private congratsBaseScale: number = 0.66;
    private congratsOffsetX: number = 0;
    private congratsOffsetY: number = 15;
    private congratsYOffsetRatio: number = 0.8; // portion of card height above card center
    private congratsPulseAmplitude: number = 0.1; // ±3%
    private congratsPulseDurationMs: number = 200;
    private congratsPopDurationMs: number = 350;
    private congratsShowDelayMs: number = 400;
    // Congrats fire animation modifiers
    private congratsFireOffsetX: number = 0;
    private congratsFireOffsetY: number = -47;
    private congratsFireScaleModifier: number = 0.8;
    private lastFreeSpinsCount: number | null = null;
    // Press-anywhere hint options
    private pressAnyShowDelayMs: number = 300; // after congrats appears
    private pressAnyOffsetX: number = 0;
    private pressAnyOffsetY: number = 16;
    private pressAnyScale: number = 1;
    // Card animation timing (ms)
    private cardIntroInitialDelayMs: number = 1200; // wait after overlay shows
    private cardPerCardIntervalMs: number = 300;    // delay between each card
    private cardThrowDurationMs: number = 700;      // single card fly-in duration
    // Card layout defaults (ratios and angles) – tuned to reference image
    private cardTargetYRatio: number = 0.52;
    private cardSpacingRatio: number = 0.28;
    private cardAngleLeft: number = -8;
    private cardAngleRight: number = 8;
    private isShowing: boolean = false;
    private onCompleteCallback?: () => void;
    private isInitialized: boolean = false;
    private animations: Phaser.Tweens.Tween[] = [];
    private dismissResolver?: () => void;
    private canDismiss: boolean = false;
    private hasUserSelected: boolean = false;
    private selectedCardIndex: number | null = null;
    // Ratio-based positions for responsive layout (0..1 of screen size)
    private winFontPosRatio = { x: 0.5, y: 0.15 };
    private pickACardPosRatio = { x: 0.5, y: 0.25 };
    private chooseTextPosRatio = { x: 0.5, y: 0.35 };
    private isIdleAnimating: boolean = false;
    private idlePulseScale: number = 1.1;
    private idlePulseDuration: number = 900;
    private fireScale: number = 0.7;
    private pickScale: number = 0.7;
    // Pick-a-card breathing range (relative to pickScale). If unset, uses idlePulseScale.
    private pickBreathMinFactor: number | null = null;
    private pickBreathMaxFactor: number | null = null;
    private fireSpineLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private fireLoadPromise: Promise<boolean> | null = null;
    private fsDigitSprites: Phaser.GameObjects.Image[] = [];
  // Main_Fire spine at bottom
  private mainFireSpines: any[] = [];
  private mainFireLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
  private mainFireLoadPromise: Promise<boolean> | null = null;
  private mainFireHeightScale: number = 1.1; // vertical stretch factor for bottom fire
  // Bottom corner fire placement and transforms (individual modifiers)
  private bottomLeftFireMarginX: number = -90;   // px from left edge
  private bottomLeftFireMarginY: number = 6;    // px from bottom edge
  private bottomLeftFireRotationDeg: number = 20; // counter-clockwise tilt
  private bottomLeftFireScaleMul: number = 1.8; // extra uniform scale multiplier

  private bottomRightFireMarginX: number = 0;  // px from right edge
  private bottomRightFireMarginY: number = 0;   // px from bottom edge

  private bottomRightFireRotationDeg: number = -20; // clockwise tilt
  private bottomRightFireScaleMul: number = 1.8; // extra uniform scale multiplier

  private bottomLeftFireOffsetX: number = -160;    // additional offset from computed corner target
  private bottomLeftFireOffsetY: number = 20;

  private bottomRightFireOffsetX: number = 160;   // additional offset from computed corner target
  private bottomRightFireOffsetY: number = 20;
  // Glow overlay removed (will be replaced by PNG later)
    // Free spin digits display options
    private fsDigitsScaleFactor: number = 1.1; // multiplier for manual descaling/rescaling
    private fsDigitsOffsetX: number = -16;       // extra offset from default base
    private fsDigitsOffsetY: number = -5;       // extra offset from default base
    private fsDigitsSpacing: number = -30;       // extra spacing in px between digits (after scaling)
    private fsDigitsAlign: 'left' | 'center' | 'right' = 'center';
    private fsDigitsRelativeToCard: boolean = true; // fit digits to a fraction of card width
    private fsDigitsTargetWidthRatio: number = 0.38; // portion of card width to occupy
    private fsDigitsMinScale: number = 0.02; // lower clamp for safety
    private fsDigitsMaxScale: number = 1.0;  // upper clamp for safety

    private computeDigitScale(chosen: any, sprites: Phaser.GameObjects.Image[]): number {
        if (!chosen || !sprites || sprites.length === 0) return this.fsDigitsMinScale;
        const cardDisplayWidth = (chosen.displayWidth || 0) || 0;
        const cardScale = Math.min((chosen.scaleX || 1), (chosen.scaleY || 1));

        // Relative-to-card mode: fit value width to a target fraction of the card width
        if (this.fsDigitsRelativeToCard && cardDisplayWidth > 0) {
            const targetWidth = Math.max(1, cardDisplayWidth * this.fsDigitsTargetWidthRatio);
            // Sum original texture widths
            let rawWidth = 0;
            for (let i = 0; i < sprites.length; i++) {
                rawWidth += sprites[i].width;
            }
            if (rawWidth <= 0) return this.fsDigitsMinScale;
            // First pass scale ignoring spacing
            let scale = targetWidth / rawWidth;
            // Account for spacing after scaling; adjust scale so total fits targetWidth
            const totalSpacing = Math.max(0, sprites.length - 1) * this.fsDigitsSpacing;
            const availableForDigits = Math.max(1, targetWidth - totalSpacing);
            scale = availableForDigits / rawWidth;
            // Apply manual factor and clamp
            scale *= Math.max(0.05, this.fsDigitsScaleFactor);
            return Math.min(this.fsDigitsMaxScale, Math.max(this.fsDigitsMinScale, scale));
        }

        // Manual mode: based on overlay text scale and card scale
        const base = this.overlayTextScaleFactor * Math.max(0.05, this.fsDigitsScaleFactor) * cardScale;
        return Math.min(this.fsDigitsMaxScale, Math.max(this.fsDigitsMinScale, base));
    }

    constructor(scene?: Scene) {
        if (scene) {
            this.initialize(scene);
        }
    }

    public initialize(scene: Scene): void {
        if (this.isInitialized) {
            return;
        }

        try {
            this.scene = scene;
            this.container = this.scene.add.container(0, 0);
            this.container.setDepth(10000); // Ensure always on top of all scene UI
            
            // Create background with 0 alpha initially
            this.background = this.scene.add.rectangle(
                this.scene.cameras.main.width / 2,
                this.scene.cameras.main.height / 2,
                this.scene.cameras.main.width * 2, // Make it larger to cover any screen size
                this.scene.cameras.main.height * 2,
                0x4A148C, // Purple background from the reference
                1 // Use full fill alpha; we'll tween the game object's alpha instead
            );
            this.background.setOrigin(0.5);
            this.background.setAlpha(0); // start invisible for fade-in
            // Make the background capture all input so nothing underneath gets it
            this.background.setInteractive();
            // Ensure only the top-most object under the pointer gets the event
            try { (this.scene.input as any).topOnly = true; } catch {}
            
            // Container for title fire animation (kept separate from other images)
            this.fireContainer = this.scene.add.container(0, 0);
            this.fireContainer.setAlpha(1);

      // Container for bottom main fire (initially hidden)
      this.bottomFireContainer = this.scene.add.container(0, 0);
      this.bottomFireContainer.setAlpha(0);

      // Glow overlay removed; will be replaced by PNG later

            // Container that groups the overlay text images for shared animations
            this.imagesContainer = this.scene.add.container(0, 0);
            this.imagesContainer.setAlpha(1);

            // Container for cards
            this.cardsContainer = this.scene.add.container(0, 0);
            this.cardsContainer.setAlpha(0);

            // Defer creating the fire Spine until show(), to ensure plugin factory is ready
            this.winFont = null;
            
            // Create pick a card image
            this.pickACard = this.scene.add.image(
                this.scene.cameras.main.width * this.pickACardPosRatio.x,
                this.scene.cameras.main.height * this.pickACardPosRatio.y,
                'PickACard'
            );
            this.pickACard.setOrigin(0.5);
            this.pickACard.setScale(0);
            this.pickACard.setAlpha(0);
            
            // Subtitle text: "Choose one card"
            this.chooseText = this.scene.add.text(
                this.scene.cameras.main.width * this.chooseTextPosRatio.x,
                this.scene.cameras.main.height * this.chooseTextPosRatio.y,
                'Choose one card',
                {
                    fontFamily: 'Poppins-SemiBold, Poppins-Regular, Arial, sans-serif',
                    fontSize: '20px',
                    color: '#FFFFFF',
                    align: 'center'
                }
            );
            this.chooseText.setOrigin(0.5, 0.5);
            this.chooseText.setAlpha(0);
            this.chooseText.setScale(0);
            try { this.chooseText.setStroke('#379557', 4); } catch {}
            try { this.chooseText.setShadow(0, 2, '#000000', 4, true, true); } catch {}
            
            // Add images into the imagesContainer, then add to main container
            this.imagesContainer.add([
                // winFont will be added on demand in show()
                this.pickACard,
                this.chooseText
            ]);

      // Add elements to container (place fire above cards)
            this.container.add([
                this.background,
                this.fireContainer,
                this.imagesContainer,
        this.cardsContainer,
        this.bottomFireContainer
            ]);
            
            this.container.setVisible(false);

      // Create separate container for the final transition overlay above everything
      this.transitionContainer = this.scene.add.container(0, 0);
      this.transitionContainer.setDepth(20000);
      this.transitionContainer.setVisible(false);
            
            // Set up pointer down handler after the background is created
            this.background.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: any) => {
                // Swallow the event so it never reaches underlying buttons
                try { event?.stopPropagation?.(); } catch {}
                // Unskippable: do not hide on background click
            });
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing ScatterWinOverlay:', error);
            this.destroy();
            throw error;
        }
    }

    public show(color: number = 0x4A148C, alpha: number = 0.9, duration: number = 800, onComplete?: () => void): void {
        if (this.isShowing || !this.scene || !this.container || !this.background) {
            if (onComplete) onComplete();
            return;
        }
        
        // Clear any existing animations
        this.clearAnimations();
        // Ensure no transient elements from a previous run remain
        this.clearTransientOverlayElements();
        
        this.isShowing = true;
        this.onCompleteCallback = onComplete;
        // reset dismissal promise resolver
        this.dismissResolver = undefined;
        
        // Set initial state
        // Ensure fill is fully opaque and tween the display alpha for proper fade effect
        this.background.setFillStyle(color, 1);
        this.background.setAlpha(0);
        // Stop any existing BG music and start pick-a-card BG (single-slot)
        try {
            const audio = (window as any).audioManager;
            if (audio) {
                if (typeof audio.lockMusicTo === 'function') audio.lockMusicTo(MusicType.PICK_A_CARD);
                if (typeof audio.setExclusiveBackground === 'function') audio.setExclusiveBackground(MusicType.PICK_A_CARD);
            }
        } catch {}
        // Reset any previous fire object state; we'll create it after loading
        if (this.winFont) {
            try { this.winFont.destroy?.(); } catch {}
            this.winFont = null;
        }
        // Recreate headline UI if it was destroyed in a previous run
        if (!this.pickACard) {
            this.pickACard = this.scene.add.image(
                this.scene.cameras.main.width * this.pickACardPosRatio.x,
                this.scene.cameras.main.height * this.pickACardPosRatio.y,
                'PickACard'
            );
            this.pickACard.setOrigin(0.5);
            try { this.imagesContainer?.add(this.pickACard); } catch {}
        }
        if (!this.chooseText) {
            this.chooseText = this.scene.add.text(
                this.scene.cameras.main.width * this.chooseTextPosRatio.x,
                this.scene.cameras.main.height * this.chooseTextPosRatio.y,
                'Choose one card',
                {
                    fontFamily: 'Poppins-SemiBold, Poppins-Regular, Arial, sans-serif',
                    fontSize: '20px',
                    color: '#FFFFFF',
                    align: 'center'
                }
            );
            this.chooseText.setOrigin(0.5, 0.5);
            try { this.chooseText.setStroke('#379557', 4); } catch {}
            try { this.chooseText.setShadow(0, 2, '#000000', 4, true, true); } catch {}
            try { this.imagesContainer?.add(this.chooseText); } catch {}
        }

        // Reset initial states for headline UI
        if (this.pickACard) {
        this.pickACard.setScale(0);
        this.pickACard.setAlpha(0);
        }
        if (this.chooseText) {
            this.chooseText.setScale(0);
            this.chooseText.setAlpha(0);
        }
        if (this.imagesContainer) {
            this.imagesContainer.setScale(0.95);
            this.imagesContainer.setAlpha(0);
        }
        if (this.cardsContainer) {
            this.cardsContainer.setAlpha(0);
            this.cardsContainer.removeAll(true);
            this.cards = [];
        }
        this.container.setVisible(true);
        // Re-assert very high depth on show in case other systems changed layers
        this.container.setDepth(10000);
        this.canDismiss = false;
        this.hasUserSelected = false;
        this.selectedCardIndex = null;
        
        // Fade in background
        const bgTween = this.scene.tweens.add({
            targets: this.background,
            alpha: alpha,
            duration: duration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // After the tint overlay fade-in finishes, slide in the bottom fire
                this.showMainFire();
            }
        });
        this.animations.push(bgTween);
        
        // Subtle group fade/scale in for the combined images
        if (this.imagesContainer) {
            const groupTween = this.scene.tweens.add({
                targets: this.imagesContainer,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: Math.max(400, duration - 100),
                ease: 'Back.easeOut',
                delay: 150
            });
            this.animations.push(groupTween);
        }
        
        // Show fire title after a short delay (load spine dynamically first)
        if (!this.scene) return;

        this.scene.time.delayedCall(300, async () => {
            if (!this.scene) return;
            const loaded = await this.loadFireSpineIfNeeded();
            if (loaded && ensureSpineFactory(this.scene!, '[ScatterWinOverlay] create overlay fire')) {
                // Create the spine version
                try {
                    const spineObj = (this.scene.add as any).spine(
                        this.scene.cameras.main.width * this.winFontPosRatio.x,
                        this.scene.cameras.main.height * this.winFontPosRatio.y,
                        'overlay_fire',
                        'overlay_fire_atlas'
                    );
                    this.winFont = spineObj;
                    try { spineObj.setOrigin(0.5, 0.5); } catch {}
                    // Start animating immediately upon instantiation
                    try { (spineObj as any).animationState?.setAnimation(0, 'animation', true); } catch {}
                    // Start hidden (scale 0) to mimic PickACard pop-up
                    try { spineObj.setScale(0); } catch {}
                    try { spineObj.setAlpha(0); } catch {}
                    this.fireContainer?.add(spineObj);
                } catch (e) {
                    console.warn('[ScatterWinOverlay] Could not create overlay fire spine after load:', e);
                }
            }
            if (!this.winFont) {
                // Fallback to sprite image if spine couldn't be created/loaded
                const img = this.scene.add.image(
                    this.scene.cameras.main.width * this.winFontPosRatio.x,
                    this.scene.cameras.main.height * this.winFontPosRatio.y,
                    'fireanimation01_HTBH_img'
                );
                img.setOrigin(0.5, 0.5);
                // Start hidden (scale 0) to mimic PickACard pop-up
                img.setScale(0);
                img.setAlpha(0);
                this.fireContainer?.add(img);
                this.winFont = img;
            }

            if (!this.winFont) return;

            // Pop-up like PickACard: fade in + scale to 1.1x base then bounce to base
            const winFontTween = this.scene.tweens.add({
                targets: this.winFont,
                alpha: 1,
                scaleX: this.fireScale * 1.1,
                scaleY: this.fireScale * 1.1,
                duration: 500,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Settle to target fireScale with a small bounce
                    this.scene?.tweens.add({
                        targets: this.winFont,
                        scaleX: this.fireScale,
                        scaleY: this.fireScale,
                        duration: 300,
                        ease: 'Bounce.easeOut'
                    });
            // Start animation for spine (preferred)
            try { (this.winFont as any).animationState?.setAnimation(0, 'animation', true); } catch {}
                }
            });
            // Play fire pop SFX right as the fire appears
            try {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.playSoundEffect === 'function') {
                    audio.playSoundEffect('fire_hh');
                }
            } catch {}
            this.animations.push(winFontTween);

// Show pick a card after win font appears
            if (!this.scene) return;
            
            this.scene.time.delayedCall(300, () => {
                if (!this.scene || !this.pickACard) return;
                
                const pickACardTween = this.scene.tweens.add({
                    targets: this.pickACard,
                    alpha: 1,
                    scaleX: this.pickScale * 1.1,
                    scaleY: this.pickScale * 1.1,
                    duration: 500,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        if (!this.scene || !this.pickACard) return;
                        // Bounce effect
                        this.scene.tweens.add({
                            targets: this.pickACard,
                            scaleX: this.pickScale,
                            scaleY: this.pickScale,
                            duration: 300,
                            ease: 'Bounce.easeOut',
                            onComplete: () => {
                                // Reveal subtitle text below the headline
                                if (this.scene && this.chooseText) {
                                    const subtitleTween = this.scene.tweens.add({
                                        targets: this.chooseText,
                                        alpha: 1,
                                        scaleX: 1,
                                        scaleY: 1,
                                        duration: 300,
                                        ease: 'Back.easeOut'
                                    });
                                    this.animations.push(subtitleTween);
                                }
                                // Start idle animation once all items have settled
                                this.startIdleAnimation();
                                if (this.onCompleteCallback) {
                                    this.onCompleteCallback();
                                }
                            }
                        });
                    }
                });
                this.animations.push(pickACardTween);
            });
        });

        // Schedule throwing in three cards from bottom after an initial delay
        this.scene.time.delayedCall(this.cardIntroInitialDelayMs, () => this.throwInCards());
    }

    /** Dynamically load fire spine (atlas+json) without blocking preloader. */
    private loadFireSpineIfNeeded(): Promise<boolean> {
        if (!this.scene) return Promise.resolve(false);
        if (this.fireSpineLoadState === 'loaded') return Promise.resolve(true);
        if (this.fireSpineLoadState === 'failed') return Promise.resolve(false);
        if (this.fireSpineLoadState === 'loading' && this.fireLoadPromise) return this.fireLoadPromise;

        this.fireSpineLoadState = 'loading';
        this.fireLoadPromise = new Promise<boolean>((resolve) => {
            try {
                // Ensure Spine loader and factory
                if (!ensureSpineLoader(this.scene!, '[ScatterWinOverlay] fire dynamic load')) {
                    this.fireSpineLoadState = 'failed';
                    resolve(false);
                    return;
                }
                // Queue files
                const loader = (this.scene as any).load;
                try { loader?.spineAtlas?.('overlay_fire_atlas', resolveAssetUrl('/assets/animations/Fire/fireanimation01_HTBH.atlas')); } catch {}
                try { loader?.spineJson?.('overlay_fire', resolveAssetUrl('/assets/animations/Fire/fireanimation01_HTBH.json')); } catch {}

                const onComplete = () => {
                    this.fireSpineLoadState = 'loaded';
                    resolve(true);
                };
                const onError = () => {
                    this.fireSpineLoadState = 'failed';
                    resolve(false);
                };

                try { (this.scene as any).load?.once('complete', onComplete); } catch {}
                try { (this.scene as any).load?.once('loaderror', onError); } catch {}
                try { (this.scene as any).load?.start(); } catch {}
            } catch (e) {
                console.warn('[ScatterWinOverlay] Fire spine dynamic load failed:', e);
                this.fireSpineLoadState = 'failed';
                resolve(false);
            }
        });
        return this.fireLoadPromise;
    }

    /** Set the manual scale for the fire title image. */
    public setFireScale(scale: number = 1.0): void {
        this.fireScale = Math.max(0.005, scale);
        if (this.winFont) {
            try { (this.winFont as any).setScale?.(this.fireScale); } catch {}
        }
    }

    /** Set the manual scale for the PickACard text/image. */
    public setPickScale(scale: number = 1.0): void {
        this.pickScale = Math.max(0.09, scale);
        if (this.pickACard) {
            try { this.pickACard.setScale(this.pickScale); } catch {}
        }
    }

    public hide(duration: number = 300, onComplete?: () => void): void {
        if (!this.isShowing || !this.scene || !this.container || !this.background) {
            if (onComplete) onComplete();
            return;
        }
        // Prevent hiding until user selects a card
        if (!this.canDismiss) {
            if (onComplete) onComplete();
            return;
        }

        // Stop idle animation when hiding
        this.isIdleAnimating = false;

        // Clean up congrats fire immediately when hiding starts
        if (this.congratsFireSpine) {
            try { this.congratsFireSpine.destroy(); } catch {}
            this.congratsFireSpine = null;
        }
        if (this.congratsFireContainer) {
            try { this.congratsFireContainer.destroy(true); } catch {}
            this.congratsFireContainer = null;
        }
        // Fade entire overlay container simultaneously
        if (this.container) {
            this.scene.tweens.add({
                targets: this.container,
                alpha: 0,
                duration: duration,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.container?.setVisible(false);
                    this.container?.setAlpha(1);
                    this.isShowing = false;
                    this.clearAnimations();
                    // Destroy transient elements so a second show starts clean
                    this.clearTransientOverlayElements();
                    // Keep music lock through transition; will unlock after BONUS starts
                    if (onComplete) onComplete();
                    if (this.dismissResolver) {
                        const resolve = this.dismissResolver;
                        this.dismissResolver = undefined;
                        resolve();
                    }
                }
            });
        }
    }

    /** Wait until the user dismisses the overlay (pointer down triggers hide). */
    public waitUntilDismissed(): Promise<void> {
        if (!this.isShowing) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this.dismissResolver = resolve;
        });
    }

    /** Remove transient elements created during a run (digits, overlay text, congrats, hint). */
    private clearTransientOverlayElements(): void {
        try {
            if (this.overlayTextRef) { try { this.overlayTextRef.destroy(); } catch {}; this.overlayTextRef = null; }
            if (this.congratsRef) { try { this.congratsRef.destroy(); } catch {}; this.congratsRef = null; }
            if (this.pressAnyText) { try { this.pressAnyText.destroy(); } catch {}; this.pressAnyText = null; }
            if (this.fsDigitSprites && this.fsDigitSprites.length) {
                for (const spr of this.fsDigitSprites) { try { spr.destroy(); } catch {} }
                this.fsDigitSprites = [];
            }
      // Clear bottom main fire
      if (this.mainFireSpines && this.mainFireSpines.length) {
        for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} }
        this.mainFireSpines = [];
      }
      if (this.bottomFireContainer) { try { this.bottomFireContainer.setAlpha(0); this.bottomFireContainer.removeAll(true); } catch {} }
      // Glow overlay removed
        } catch {}
    }

    /**
     * Adjust the on-screen positions using ratios of the current camera size.
     * Values must be between 0 and 1.
     */
    public setPositions(winFontXRatio: number, winFontYRatio: number, pickXRatio: number, pickYRatio: number): void {
        if (winFontXRatio >= 0 && winFontXRatio <= 1) this.winFontPosRatio.x = winFontXRatio;
        if (winFontYRatio >= 0 && winFontYRatio <= 1) this.winFontPosRatio.y = winFontYRatio;
        if (pickXRatio >= 0 && pickXRatio <= 1) this.pickACardPosRatio.x = pickXRatio;
        if (pickYRatio >= 0 && pickYRatio <= 1) this.pickACardPosRatio.y = pickYRatio;
        // Keep subtitle aligned underneath the pick image by default
        this.chooseTextPosRatio.x = this.pickACardPosRatio.x;
        this.chooseTextPosRatio.y = Math.min(1, this.pickACardPosRatio.y + 0.06);
        this.applyPositions();
    }

    /** Apply current ratios to element positions. */
    private applyPositions(): void {
        if (!this.scene) return;
        const w = this.scene.cameras.main.width;
        const h = this.scene.cameras.main.height;
        if (this.winFont) {
            this.winFont.setPosition(w * this.winFontPosRatio.x, h * this.winFontPosRatio.y);
        }
        if (this.pickACard) {
            this.pickACard.setPosition(w * this.pickACardPosRatio.x, h * this.pickACardPosRatio.y);
        }
        if (this.chooseText) {
            this.chooseText.setPosition(w * this.chooseTextPosRatio.x, h * this.chooseTextPosRatio.y);
        }
        // Ensure imagesContainer stays at origin so images use absolute positions
        if (this.imagesContainer) {
            this.imagesContainer.setPosition(0, 0);
        }
    }

    /** Zoom the grouped images container to a target scale. */
    public zoomImages(targetScale: number = 1.05, duration: number = 250, ease: string = 'Sine.easeInOut'): void {
        if (!this.scene || !this.imagesContainer) return;
        this.scene.tweens.add({
            targets: this.imagesContainer,
            scaleX: targetScale,
            scaleY: targetScale,
            duration,
            ease
        });
    }

    /** Pulse the images container scale up then back to 1. */
    public pulseImages(scaleUp: number = 1.08, duration: number = 280): void {
        if (!this.scene || !this.imagesContainer) return;
        this.scene.tweens.add({
            targets: this.imagesContainer,
            scaleX: scaleUp,
            scaleY: scaleUp,
            duration,
            ease: 'Sine.easeOut',
            yoyo: true
        });
    }

    /** Create and animate three cards that fly up from bottom into positions. */
    private throwInCards(): void {
        if (!this.scene || !this.cardsContainer) return;
        // Ensure assets loaded
        const w = this.scene.cameras.main.width;
        const h = this.scene.cameras.main.height;

        // target positions (three columns)
        const midY = h * this.cardTargetYRatio;
        const spacing = w * this.cardSpacingRatio;
        const midX = w * 0.5;
        const targets = [midX - spacing, midX, midX + spacing];

        // Starting positions off screen bottom
        const startY = h + 120;
        const baseDelay = this.cardPerCardIntervalMs;

        // Create three image cards using PNG backs first (unflipped)
        let completed = 0;
        for (let i = 0; i < 3; i++) {
            const x = targets[i];
            const cardImg = this.scene.add.image(x, startY, 'free_spin_card');
            cardImg.setOrigin(0.5, 0.5);
            // start slightly smaller and grow to target scale for a snappier arrival
            cardImg.setScale(this.pngCardScale * 0.9);
            this.cardsContainer.add(cardImg);
            this.cards.push(cardImg);

            // Throw-in tween (with slight angle)
            const angleFrom = i === 0 ? this.cardAngleLeft * 1.8 : i === 2 ? this.cardAngleRight * 1.8 : 0;
            cardImg.setAngle(angleFrom);
            const t = this.scene.tweens.add({
                targets: cardImg,
                y: midY,
                angle: i === 0 ? this.cardAngleLeft : i === 2 ? this.cardAngleRight : 0,
                scaleX: this.pngCardScale,
                scaleY: this.pngCardScale,
                duration: this.cardThrowDurationMs,
                ease: 'Cubic.easeOut',
                delay: i * baseDelay,
                onStart: () => {
                    if (this.cardsContainer) this.cardsContainer.setAlpha(1);
                    // Play card deal SFX on each card slide
                    try {
                        const audio = (window as any).audioManager;
                        if (audio && typeof audio.playSoundEffect === 'function') {
                            audio.playSoundEffect('carddeal_hh');
                        }
                    } catch {}
                },
                onComplete: () => {
                    completed++;
                    if (completed === 3) {
              // Cards are ready – enable selection (bottom fire is now handled after tint fade-in)
                        this.enableCardSelection();
                    }
                }
            });
            this.animations.push(t);
        }
    }

    /** Make cards interactive and require the user to choose one. */
    private enableCardSelection(): void {
        if (!this.scene) return;
        this.cards.forEach((go, index) => {
            const img = go as Phaser.GameObjects.Image;
            try {
                img.setInteractive({ useHandCursor: true });
                img.on('pointerover', () => { this.scene?.tweens.add({ targets: img, scale: this.pngCardScale * 1.05, duration: 120, ease: 'Sine.easeOut' }); });
                img.on('pointerout', () => { this.scene?.tweens.add({ targets: img, scale: this.pngCardScale, duration: 120, ease: 'Sine.easeIn' }); });
                img.on('pointerdown', (pointer: any, x: number, y: number, event: any) => {
                    try { event?.stopPropagation?.(); } catch {}
                    this.handleCardSelected(index);
                });
            } catch {}
        });
    }

    /** When a card is chosen, slide others away, center+enlarge chosen, then swap to Spine. */
    private handleCardSelected(index: number): void {
        if (!this.scene || this.hasUserSelected) return;
        this.hasUserSelected = true;
        this.selectedCardIndex = index;

        // Play card pick SFX
        try {
            const audio = (window as any).audioManager;
            if (audio && typeof audio.playSoundEffect === 'function') {
                audio.playSoundEffect('cardpick_hh' as any);
            }
        } catch {}

        // Disable further input
        this.cards.forEach((go) => { try { (go as any).disableInteractive?.(); } catch {} });

        const chosen = this.cards[index] as any;
        if (!chosen) { this.canDismiss = true; return; }

        const pos = { x: (chosen.x ?? 0), y: (chosen.y ?? 0), angle: (chosen.angle ?? 0) };
        const center = { x: this.scene.cameras.main.width * 0.5, y: this.scene.cameras.main.height * this.cardTargetYRatio };

        // 1) Slide out non-selected cards off-screen and fade them
        this.cards.forEach((go, i) => {
            if (i === index) return;
            const isLeft = (go as any).x < pos.x;
            const targetX = isLeft ? -200 : this.scene!.cameras.main.width + 200;
            this.scene!.tweens.add({
                targets: go,
                x: targetX,
                alpha: 0,
                duration: 350,
                ease: 'Cubic.easeIn'
            });
        });

        // 2) Move selected PNG to center and enlarge, then flip PNG front
        try { this.scene.tweens.killTweensOf(chosen); } catch {}
        // Ensure a consistent starting scale and draw order
        try { (chosen as any).setDepth?.(10001); } catch {}
        try { (chosen as any).setScale?.(this.pngCardScale); } catch {}

        const enlargeScale = this.pngCardScale * this.pngCenterEnlargeMultiplier;
        const moveDuration = this.moveToCenterDurationMs;

        // Move to center
        this.scene.tweens.add({
            targets: chosen,
            x: center.x,
            y: center.y,
            angle: 0,
            duration: moveDuration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Then enlarge the PNG
                this.scene!.tweens.add({
                    targets: chosen,
                    scaleX: enlargeScale,
                    scaleY: enlargeScale,
                    duration: this.enlargeDurationMs,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        // Perform a code-based flip: scaleX to 0, swap texture to front, then scaleX up to final
                        const half = Math.max(80, Math.floor(this.enlargeDurationMs * 0.6));
                        this.scene!.tweens.add({
                            targets: chosen,
                            scaleX: 0.0001,
                            duration: half,
                            ease: 'Cubic.easeIn',
                            onStart: () => {
                                // Play card flip SFX at the beginning of the flip-in
                                try {
                                    const audio = (window as any).audioManager;
                                    if (audio && typeof audio.playSoundEffect === 'function') {
                                        audio.playSoundEffect('cardflip_hh' as any);
                                    }
                                } catch {}
                            },
                            onComplete: () => {
                                try {
                                    (chosen as Phaser.GameObjects.Image).setTexture('free_spin_card_front');
                                } catch {}
                                this.scene!.tweens.add({
                                    targets: chosen,
                                    scaleX: this.pngCardScale * this.flippedCardScaleMultiplier,
                                    scaleY: this.pngCardScale * this.flippedCardScaleMultiplier,
                                    duration: half,
                                    ease: 'Cubic.easeOut',
                                    onStart: () => {
                                        // Create overlay text immediately as front appears
                                        try {
                                            const cx = (chosen as any).x + this.overlayTextOffsetX;
                                            const cy = (chosen as any).y + this.overlayTextOffsetY;
                                            const overlay = this.scene!.add.image(cx, cy, 'free_spin_text');
                                            overlay.setOrigin((chosen as any).originX ?? 0.5, (chosen as any).originY ?? 0.5);
                                            overlay.setAngle((chosen as any).angle ?? 0);
                                            const startScale = Math.min((chosen as any).scaleX, (chosen as any).scaleY) * this.overlayTextScaleFactor;
                                            overlay.setScale(startScale);
                                            try { (overlay as any).setDepth?.(10003); } catch {}
                                            overlay.setAlpha(1);
                                            this.overlayTextRef = overlay;
                                            try { this.container?.add(overlay); } catch {}
                                        } catch {}
                                        // If free spins count is known, compose digit sprites using number assets
                                        try {
                                            // Clear any previous digits
                                            for (const spr of this.fsDigitSprites) { try { spr.destroy(); } catch {} }
                                            this.fsDigitSprites = [];
                                            if (this.lastFreeSpinsCount != null && this.scene) {
                                                const valueStr = `${this.lastFreeSpinsCount}`;
                                                // Determine base position under the overlay image
                                                const baseX = (chosen as any).x + this.overlayTextOffsetX + this.fsDigitsOffsetX;
                                                const baseY = (chosen as any).y + this.overlayTextOffsetY + (((chosen as any).displayHeight || 200) * 0.18) + this.fsDigitsOffsetY;
                                                // Create digit sprites first to compute final scale and layout
                                                const tempSprites: Phaser.GameObjects.Image[] = [];
                                                for (let i = 0; i < valueStr.length; i++) {
                                                    const ch = valueStr[i];
                                                    const key = `number_${ch}`;
                                                    if (this.scene.textures.exists(key)) {
                                                        const s = this.scene.add.image(0, 0, key);
                                                        s.setOrigin(0.5, 0.5);
                                                        // scale applied after computing final scale
                                                        try { (s as any).setDepth?.(10004); } catch {}
                                                        tempSprites.push(s);
                                                    }
                                                }
                                                // Compute final scale (relative to card or manual)
                                                const finalScale = this.computeDigitScale(chosen, tempSprites);
                                                for (const s of tempSprites) { s.setScale(finalScale); }
                                                // Compute total width including spacing at final scale
                                                let totalW = 0;
                                                for (let i = 0; i < tempSprites.length; i++) {
                                                    totalW += tempSprites[i].displayWidth;
                                                    if (i < tempSprites.length - 1) totalW += this.fsDigitsSpacing;
                                                }
                                                // Starting x based on alignment
                                                let cursorX = baseX;
                                                if (this.fsDigitsAlign === 'center') {
                                                    cursorX = baseX - totalW / 2;
                                                } else if (this.fsDigitsAlign === 'right') {
                                                    cursorX = baseX - totalW;
                                                }
                                                for (let i = 0; i < tempSprites.length; i++) {
                                                    const s = tempSprites[i];
                                                    s.setPosition(cursorX + s.displayWidth / 2, baseY);
                                                    this.fsDigitSprites.push(s);
                                                    try { this.container?.add(s); } catch {}
                                                    cursorX += s.displayWidth + (i < tempSprites.length - 1 ? this.fsDigitsSpacing : 0);
                                                }
                                            }
                                        } catch {}
                                    },
                                    onUpdate: () => {
                                        // Keep overlay aligned during this expansion
                                        try {
                                            const overlay = this.overlayTextRef;
                                            if (overlay) {
                                                overlay.x = (chosen as any).x + this.overlayTextOffsetX;
                                                overlay.y = (chosen as any).y + this.overlayTextOffsetY;
                                                overlay.angle = (chosen as any).angle ?? 0;
                                                const s = Math.min((chosen as any).scaleX, (chosen as any).scaleY) * this.overlayTextScaleFactor;
                                                overlay.setScale(s);
                                            }
                                            // Update digit sprites to follow and scale
                                            if (this.fsDigitSprites && this.fsDigitSprites.length) {
                                                const baseX = (chosen as any).x + this.overlayTextOffsetX + this.fsDigitsOffsetX;
                                                const baseY = (chosen as any).y + this.overlayTextOffsetY + (((chosen as any).displayHeight || 200) * 0.18) + this.fsDigitsOffsetY;
                                                const scaleBase = this.computeDigitScale(chosen, this.fsDigitSprites);
                                                // Recompute widths after scale change including spacing
                                                let totalW = 0;
                                                for (let i = 0; i < this.fsDigitSprites.length; i++) {
                                                    const s = this.fsDigitSprites[i];
                                                    s.setScale(scaleBase);
                                                    totalW += s.displayWidth;
                                                    if (i < this.fsDigitSprites.length - 1) totalW += this.fsDigitsSpacing;
                                                }
                                                let cursorX = baseX;
                                                if (this.fsDigitsAlign === 'center') {
                                                    cursorX = baseX - totalW / 2;
                                                } else if (this.fsDigitsAlign === 'right') {
                                                    cursorX = baseX - totalW;
                                                }
                                                for (let i = 0; i < this.fsDigitSprites.length; i++) {
                                                    const s = this.fsDigitSprites[i];
                                                    s.setPosition(cursorX + s.displayWidth / 2, baseY);
                                                    cursorX += s.displayWidth + (i < this.fsDigitSprites.length - 1 ? this.fsDigitsSpacing : 0);
                                                }
                                            }
                                        } catch {}
                                    },
                                    onComplete: () => {
                                        // Move UI out and position the card + overlay text to upper center
                                        this.animateHeadersOut();
                                        const w = this.scene!.cameras.main.width;
                                        const h = this.scene!.cameras.main.height;
                                        const targetX = w * 0.5;
                                        const targetY = h * this.flippedCardTargetYRatio;
                                        this.scene!.tweens.add({
                                            targets: chosen,
                                            x: targetX,
                                            y: targetY,
                                            angle: 0,
                                            duration: this.moveToUpperCenterDurationMs,
                                            ease: 'Cubic.easeInOut',
                                            onUpdate: () => { try { 
                                                if (this.overlayTextRef) { 
                                                    this.overlayTextRef.x = (chosen as any).x + this.overlayTextOffsetX; 
                                                    this.overlayTextRef.y = (chosen as any).y + this.overlayTextOffsetY; 
                                                    this.overlayTextRef.angle = (chosen as any).angle; 
                                                } 
                                                if (this.fsDigitSprites && this.fsDigitSprites.length) {
                                                    const baseX = (chosen as any).x + this.overlayTextOffsetX + this.fsDigitsOffsetX;
                                                    const baseY = (chosen as any).y + this.overlayTextOffsetY + (((chosen as any).displayHeight || 200) * 0.18) + this.fsDigitsOffsetY;
                                                    // Keep scale consistent relative to card in motion; include spacing and alignment
                                                    const scaleBase = this.computeDigitScale(chosen, this.fsDigitSprites);
                                                    let totalW = 0;
                                                    for (let i = 0; i < this.fsDigitSprites.length; i++) {
                                                        const s = this.fsDigitSprites[i];
                                                        s.setScale(scaleBase);
                                                        totalW += s.displayWidth;
                                                        if (i < this.fsDigitSprites.length - 1) totalW += this.fsDigitsSpacing;
                                                    }
                                                    let cursorX = baseX;
                                                    if (this.fsDigitsAlign === 'center') {
                                                        cursorX = baseX - totalW / 2;
                                                    } else if (this.fsDigitsAlign === 'right') {
                                                        cursorX = baseX - totalW;
                                                    }
                                                    for (let i = 0; i < this.fsDigitSprites.length; i++) {
                                                        const s = this.fsDigitSprites[i];
                                                        s.setPosition(cursorX + s.displayWidth / 2, baseY);
                                                        s.setAngle((chosen as any).angle || 0);
                                                        cursorX += s.displayWidth + (i < this.fsDigitSprites.length - 1 ? this.fsDigitsSpacing : 0);
                                                    }
                                                }
                                            } catch {} },
                                            onComplete: () => { this.canDismiss = true; }
                                        });
                                        // Show congrats image with breathing animation AFTER card reached upper center with delay
                                        this.scene!.time.delayedCall(this.congratsShowDelayMs, () => this.showCongratsBreathing(chosen));
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        // No parallel scale; enlargement happens after reaching center
    }

    /** Animate title fire, pick image, and subtitle out of view, then destroy them. */
    private animateHeadersOut(): void {
        if (!this.scene) return;
        const upwardY = -200;
        // Fire title (spine or image)
        if (this.winFont) {
            try {
                this.scene.tweens.add({
                    targets: this.winFont,
                    y: upwardY,
                    alpha: 0,
                    duration: 280,
                    ease: 'Cubic.easeIn',
                    onComplete: () => { try { (this.winFont as any).destroy?.(); this.winFont = null; } catch {} }
                });
            } catch {}
        }
        // Pick a Card image
        if (this.pickACard) {
            try {
                this.scene.tweens.add({
                    targets: this.pickACard,
                    y: upwardY,
                    alpha: 0,
                    duration: 260,
                    ease: 'Cubic.easeIn',
                    onComplete: () => { try { this.pickACard?.destroy(); this.pickACard = null; } catch {} }
                });
            } catch {}
        }
        // Subtitle text
        if (this.chooseText) {
            try {
                this.scene.tweens.add({
                    targets: this.chooseText,
                    alpha: 0,
                    duration: 200,
                    ease: 'Cubic.easeOut',
                    onComplete: () => { try { this.chooseText?.destroy(); this.chooseText = null; } catch {} }
                });
            } catch {}
        }
    }

    /** Configure card throw animation timings (ms). */
    public setCardAnimationTimings(initialDelayMs: number, perCardIntervalMs: number, throwDurationMs: number): void {
        this.cardIntroInitialDelayMs = Math.max(0, initialDelayMs);
        this.cardPerCardIntervalMs = Math.max(0, perCardIntervalMs);
        this.cardThrowDurationMs = Math.max(100, throwDurationMs);
    }

    /** Configure card layout: y position ratio, spacing ratio, and left/right final tilt. */
    public setCardLayoutOptions(yRatio: number, spacingRatio: number, leftAngle: number, rightAngle: number): void {
        this.cardTargetYRatio = Math.min(1, Math.max(0, yRatio));
        this.cardSpacingRatio = Math.max(0, spacingRatio);
        this.cardAngleLeft = leftAngle;
        this.cardAngleRight = rightAngle;
    }

    /** Adjust scale for PNG back cards; updates existing PNG cards immediately. */
    public setPngCardScale(scale: number = 0.04): void {
        this.pngCardScale = Math.max(0.005, scale);
        if (this.cards && this.cards.length) {
            this.cards.forEach((c: any) => {
                const isSpine = !!(c && (c as any).animationState);
                if (!isSpine) {
                    try { (c as any).setScale(this.pngCardScale); } catch {}
                }
            });
        }
    }

    // Spine-based card scaling removed

    /** Set how much the PNG enlarges while moving to center. */
    public setPngCenterEnlargeMultiplier(multiplier: number = 1.2): void {
        this.pngCenterEnlargeMultiplier = Math.max(0.1, multiplier);
    }

    /** Set the duration of the move-to-center animation (ms). */
    public setMoveToCenterDuration(durationMs: number = 650): void {
        this.moveToCenterDurationMs = Math.max(50, durationMs);
    }

    /** Set the duration of the enlarge animation (ms) right before the flip. */
    public setEnlargeDuration(durationMs: number = 300): void {
        this.enlargeDurationMs = Math.max(50, durationMs);
    }

    /** Set a multiplier applied to pngCardScale for the flipped card's final scale. */
    public setFlippedCardScaleMultiplier(multiplier: number = 1.0): void {
        this.flippedCardScaleMultiplier = Math.max(0.05, multiplier);
    }

    /** Set final Y ratio for the flipped card resting position (0..1). */
    public setFlippedCardTargetYRatio(ratio: number = 0.3): void {
        this.flippedCardTargetYRatio = Math.min(1, Math.max(0, ratio));
    }

    /** Set duration (ms) for moving the flipped card to the upper center. */
    public setMoveToUpperCenterDuration(durationMs: number = 350): void {
        this.moveToUpperCenterDurationMs = Math.max(50, durationMs);
    }

    /** Extract free spins count from SpinData (mirrors Spinner logic). */
    public extractFreeSpinsCount(spinData: SpinData | any): number {
        try {
            const freespinData = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
            const freeSpinsCount = freespinData?.count || 0;
            this.lastFreeSpinsCount = freeSpinsCount | 0;
            return this.lastFreeSpinsCount;
        } catch {
            this.lastFreeSpinsCount = 0;
            return 0;
        }
    }

    /** Set the free spins count using a SpinData object. */
    public setFreeSpinsFromSpinData(spinData: SpinData | any): void {
        this.extractFreeSpinsCount(spinData);
    }

    /** Set the free spins count directly. */
    public setFreeSpinsCount(count: number): void {
        this.lastFreeSpinsCount = count | 0;
    }

    /** Get the last known free spins count (0 if unset). */
    public getFreeSpinsCount(): number {
        return this.lastFreeSpinsCount ?? 0;
    }

    /** Configure the free spin digit display (scale factor, offsets, spacing, alignment). */
    public setFreeSpinDigitsOptions(options: {
        scaleFactor?: number; // relative to overlayTextScaleFactor
        offsetX?: number;
        offsetY?: number;
        spacing?: number; // pixels between digits after scaling
        align?: 'left' | 'center' | 'right';
        relativeToCard?: boolean; // toggle relative-to-card fit mode
        targetWidthRatio?: number; // fraction of card width to occupy
        minScale?: number;
        maxScale?: number;
    }): void {
        if (options.scaleFactor !== undefined) this.fsDigitsScaleFactor = Math.max(0.05, options.scaleFactor);
        if (options.offsetX !== undefined) this.fsDigitsOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.fsDigitsOffsetY = options.offsetY;
        if (options.spacing !== undefined) this.fsDigitsSpacing = Math.max(0, options.spacing);
        if (options.align !== undefined) this.fsDigitsAlign = options.align;
        if (options.relativeToCard !== undefined) this.fsDigitsRelativeToCard = !!options.relativeToCard;
        if (options.targetWidthRatio !== undefined) this.fsDigitsTargetWidthRatio = Math.min(1.0, Math.max(0.05, options.targetWidthRatio));
        if (options.minScale !== undefined) this.fsDigitsMinScale = Math.max(0.001, options.minScale);
        if (options.maxScale !== undefined) this.fsDigitsMaxScale = Math.max(this.fsDigitsMinScale, options.maxScale);
    }

    /** Configure overlay text placement: offset (px) and relative scale factor. */
    public setOverlayTextOptions(offsetX: number = 0, offsetY: number = 0, scaleFactor: number = 0.55): void {
        this.overlayTextOffsetX = offsetX;
        this.overlayTextOffsetY = offsetY;
        this.overlayTextScaleFactor = Math.max(0.05, scaleFactor);
        if (this.overlayTextRef) {
            try {
                const chosenScale = Math.min((this.overlayTextRef as any).scaleX || 1, (this.overlayTextRef as any).scaleY || 1);
                this.overlayTextRef.setScale(chosenScale * this.overlayTextScaleFactor);
            } catch {}
        }
    }

    /** Start an infinite gentle idle animation: PickACard breathes; fire breathes subtly in opposite phase. */
    private startIdleAnimation(): void {
        if (!this.scene || this.isIdleAnimating) return;
        this.isIdleAnimating = true;

        // PickACard: stronger breathing
        if (this.pickACard) {
            const useRange = this.pickBreathMinFactor != null || this.pickBreathMaxFactor != null;
            if (useRange) {
                const minF = Math.max(0.05, this.pickBreathMinFactor ?? 1.0);
                const maxF = Math.max(minF, this.pickBreathMaxFactor ?? 1.05);
                const up = this.pickScale * maxF;
                const down = this.pickScale * minF;
                const pickPulse = this.scene.tweens.add({
                    targets: this.pickACard,
                    scaleX: up,
                    scaleY: up,
                    duration: this.idlePulseDuration,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    yoyoDelay: 80,
                    repeatDelay: 120,
                    onYoyo: () => { try { this.pickACard?.setScale(down); } catch {} }
                });
                this.animations.push(pickPulse);
            } else {
                const pickPulse = this.scene.tweens.add({
                    targets: this.pickACard,
                    scaleX: this.idlePulseScale,
                    scaleY: this.idlePulseScale,
                    duration: this.idlePulseDuration,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    yoyoDelay: 80,
                    repeatDelay: 120
                });
                this.animations.push(pickPulse);
            }
        }

        // Fire title: very subtle, opposite phase (half-period delay) around base fireScale
        if (this.winFont) {
            const subtle = 0.015; // ±1.5%
            const firePulse = this.scene.tweens.add({
                targets: this.winFont,
                scaleX: this.fireScale * (1.0 - subtle),
                scaleY: this.fireScale * (1.0 - subtle),
                duration: this.idlePulseDuration,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: this.idlePulseDuration * 0.5 // opposite to pick
            });
            this.animations.push(firePulse);
        }
    }

    /** Optionally configure idle pulse animation. */
    public setIdlePulseOptions(scale: number = 1.1, durationMs: number = 1): void {
        this.idlePulseScale = Math.max(1.0, scale);
        this.idlePulseDuration = Math.max(50, durationMs);
    }

    /** Configure pick-a-card breathing range using factors relative to pickScale. */
    public setPickBreathRange(options: { minFactor?: number; maxFactor?: number; }): void {
        if (options.minFactor !== undefined) this.pickBreathMinFactor = Math.max(0.05, options.minFactor);
        if (options.maxFactor !== undefined) this.pickBreathMaxFactor = Math.max(this.pickBreathMinFactor ?? 0.05, options.maxFactor);
    }

    /** Configure congrats popup (scale, offsets, breathing amplitude/duration). */
    public setCongratsOptions(options: {
        baseScale?: number;
        offsetX?: number;
        offsetY?: number;
        yOffsetRatio?: number; // how far above the card, as fraction of card height
        pulseAmplitude?: number; // e.g., 0.03 for ±3%
        pulseDurationMs?: number;
        popDurationMs?: number;
        showDelayMs?: number;
        fireOffsetX?: number; // congrats fire X offset
        fireOffsetY?: number; // congrats fire Y offset
        fireScaleModifier?: number; // congrats fire scale multiplier
    }): void {
        if (options.baseScale !== undefined) this.congratsBaseScale = Math.max(0.05, options.baseScale);
        if (options.offsetX !== undefined) this.congratsOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.congratsOffsetY = options.offsetY;
        if (options.yOffsetRatio !== undefined) this.congratsYOffsetRatio = Math.min(2, Math.max(0, options.yOffsetRatio));
        if (options.pulseAmplitude !== undefined) this.congratsPulseAmplitude = Math.max(0, options.pulseAmplitude);
        if (options.pulseDurationMs !== undefined) this.congratsPulseDurationMs = Math.max(50, options.pulseDurationMs);
        if (options.popDurationMs !== undefined) this.congratsPopDurationMs = Math.max(50, options.popDurationMs);
        if (options.showDelayMs !== undefined) this.congratsShowDelayMs = Math.max(0, options.showDelayMs);
        if (options.fireOffsetX !== undefined) this.congratsFireOffsetX = options.fireOffsetX;
        if (options.fireOffsetY !== undefined) this.congratsFireOffsetY = options.fireOffsetY;
        if (options.fireScaleModifier !== undefined) this.congratsFireScaleModifier = Math.max(0.01, options.fireScaleModifier);
    }

    private clearAnimations(): void {
        if (!this.animations) return;
        
        for (const tween of this.animations) {
            try {
                if (tween && !tween.isDestroyed()) {
                    tween.remove();
                }
            } catch (error) {
                console.warn('Error removing tween:', error);
            }
        }
        this.animations = [];
    }
    
    public destroy(): void {
        try {
            this.clearAnimations();
            
            if (this.background) {
                this.background.off('pointerdown');
                this.background.destroy();
                this.background = null;
            }
            
            if (this.winFont) {
                this.winFont.destroy();
                this.winFont = null;
            }
            
            if (this.pickACard) {
                this.pickACard.destroy();
                this.pickACard = null;
            }
            
            if (this.chooseText) {
                this.chooseText.destroy();
                this.chooseText = null;
            }
            
            if (this.container) {
                this.container.destroy(true);
                this.container = null;
            }
      if (this.bottomFireContainer) {
        try { this.bottomFireContainer.destroy(true); } catch {}
        this.bottomFireContainer = null;
      }
      if (this.mainFireSpines && this.mainFireSpines.length) {
        for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} }
        this.mainFireSpines = [];
            }
            // Destroy digit sprites if any
            if (this.fsDigitSprites && this.fsDigitSprites.length) {
                for (const spr of this.fsDigitSprites) { try { spr.destroy(); } catch {} }
                this.fsDigitSprites = [];
            }
            if (this.congratsRef) {
                try { this.congratsRef.destroy(); } catch {}
                this.congratsRef = null;
            }
            if (this.congratsFireSpine) {
                try { this.congratsFireSpine.destroy(); } catch {}
                this.congratsFireSpine = null;
            }
            if (this.congratsFireContainer) {
                try { this.congratsFireContainer.destroy(true); } catch {}
                this.congratsFireContainer = null;
            }
            if (this.pressAnyText) {
                try { this.pressAnyText.destroy(); } catch {}
                this.pressAnyText = null;
            }
            
            this.scene = null;
            this.isInitialized = false;
            this.isShowing = false;
        } catch (error) {
            console.error('Error destroying ScatterWinOverlay:', error);
        }
    }

    /** Show a 'congrats' image with gentle breathing animation above the flipped card. */
    private showCongratsBreathing(chosen: any): void {
        if (!this.scene) return;
        try {
            // Stop bonus visual effects (fireworks and embers) and related SFX when congrats appears
            try { this.scene?.events.emit('stopBonusEffects'); } catch {}
            try {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.stopByKey === 'function') {
                    audio.stopByKey('fireworks_hh');
                } else {
                    (this.scene as any)?.sound?.sounds?.forEach?.((s: any) => { if (s?.key === 'fireworks_hh' && s.isPlaying) try { s.stop(); } catch {} });
                }
            } catch {}

            // Clean up any existing congrats fire from previous runs
            if (this.congratsFireSpine) {
                try { this.congratsFireSpine.destroy(); } catch {}
                this.congratsFireSpine = null;
            }
            if (this.congratsFireContainer) {
                try { this.congratsFireContainer.destroy(true); } catch {}
                this.congratsFireContainer = null;
            }

            const w = this.scene.cameras.main.width;
            const h = this.scene.cameras.main.height;
            // Position relative to the chosen card's final position and size
            const baseX = (chosen?.x ?? w * 0.5) + this.congratsOffsetX;
            const baseY = (chosen?.y ?? h * this.flippedCardTargetYRatio) - ((chosen?.displayHeight || 200) * this.congratsYOffsetRatio) + this.congratsOffsetY;

            // Create container for congrats fire animation (placed behind congrats PNG)
            if (!this.congratsFireContainer) {
                this.congratsFireContainer = this.scene.add.container(0, 0);
                try { this.congratsFireContainer.setDepth?.(10004); } catch {} // Behind congrats (10005)
                try { this.container?.add(this.congratsFireContainer); } catch {}
            }

            // Load and create fire animation behind congrats
            this.scene.time.delayedCall(0, async () => {
                if (!this.scene) return;
                const loaded = await this.loadFireSpineIfNeeded();
                if (loaded && ensureSpineFactory(this.scene, '[ScatterWinOverlay] create congrats fire')) {
                    try {
                        const fireX = baseX + this.congratsFireOffsetX;
                        const fireY = baseY + this.congratsFireOffsetY;
                        const spineObj = (this.scene.add as any).spine(
                            fireX,
                            fireY,
                            'overlay_fire',
                            'overlay_fire_atlas'
                        );
                        this.congratsFireSpine = spineObj;
                        try { spineObj.setOrigin(0.5, 0.5); } catch {}
                        // Scale using congrats fire scale modifier
                        try { spineObj.setScale(this.congratsBaseScale * this.congratsFireScaleModifier); } catch {}
                        try { spineObj.setAlpha(0); } catch {} // Start hidden
                        // Start animating
                        try { (spineObj as any).animationState?.setAnimation(0, 'animation', true); } catch {}
                        this.congratsFireContainer?.add(spineObj);

                        // Fade in the fire with the congrats
                        this.scene.tweens.add({
                            targets: spineObj,
                            alpha: 0.8, // Slightly transparent
                            duration: this.congratsPopDurationMs,
                            ease: 'Back.easeOut'
                        });
                    } catch (e) {
                        console.warn('[ScatterWinOverlay] Could not create congrats fire spine:', e);
                    }
                }
            });

            const img = this.scene.add.image(baseX, baseY, 'congrats');
            img.setOrigin(0.5, 0.5);
            img.setAlpha(0);
            img.setScale(this.congratsBaseScale * 0.9);
            try { (img as any).setDepth?.(10005); } catch {}
            this.congratsRef = img;
            try { this.container?.add(img); } catch {}

            // Pop-in tween
            this.scene.tweens.add({
                targets: img,
                alpha: 1,
                scaleX: this.congratsBaseScale,
                scaleY: this.congratsBaseScale,
                duration: this.congratsPopDurationMs,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Gentle breathing loop
                    this.scene?.tweens.add({
                        targets: img,
                        scaleX: this.congratsBaseScale * (1 + this.congratsPulseAmplitude),
                        scaleY: this.congratsBaseScale * (1 + this.congratsPulseAmplitude),
                        duration: this.congratsPulseDurationMs,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });

                    // Schedule press-anywhere hint after congrats appears
                    this.scene!.time.delayedCall(this.pressAnyShowDelayMs, () => this.showPressAnyHint(chosen));
                }
            });
        } catch {}
    }

    /** Show a text hint below the flipped card prompting to continue. */
    private showPressAnyHint(chosen: any): void {
        if (!this.scene) return;
        try {
            if (this.pressAnyText) { try { this.pressAnyText.destroy(); } catch {}; this.pressAnyText = null; }
            const w = this.scene.cameras.main.width;
            const h = this.scene.cameras.main.height;
            const cx = (chosen?.x ?? w * 0.5) + this.pressAnyOffsetX;
            const cy = (chosen?.y ?? h * this.flippedCardTargetYRatio) + ((chosen?.displayHeight || 200) * 0.58) + this.pressAnyOffsetY;
            const txt = this.scene.add.text(cx, cy, 'Press anywhere to continue', {
                fontFamily: 'Poppins-SemiBold, Poppins-Regular, Arial, sans-serif',
                fontSize: '20px',
                color: '#FFFFFF',
                align: 'center'
            });
            txt.setOrigin(0.5, 0.5);
            txt.setAlpha(0);
            txt.setScale(0);
            try { txt.setStroke('#379557', 4); } catch {}
            try { txt.setShadow(0, 2, '#000000', 4, true, true); } catch {}
            try { (txt as any).setDepth?.(10005); } catch {}
            this.pressAnyText = txt;
            try { this.container?.add(txt); } catch {}

            // Animate in similar to chooseText
            this.scene.tweens.add({
                targets: txt,
                alpha: 1,
                scaleX: this.pressAnyScale,
                scaleY: this.pressAnyScale,
                duration: 350,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // After the label appears, enable a one-shot click anywhere to continue
                    this.enableContinueClick();
                }
            });
        } catch {}
    }

    /** Enable one-shot click anywhere to continue into bonus autoplay. */
    private enableContinueClick(): void {
        if (!this.scene || !this.background) return;
        try {
            // Ensure the background is interactive and on top to catch the click
            this.background.setInteractive();
            const onceHandler = () => {
                try { this.background?.off('pointerdown', onceHandler); } catch {}
        // Hide overlay, then play full-screen fire transition into bonus
        this.hide(300, () => {
          this.playFireTransitionThenEnterBonus();
        });
            };
            this.background.once('pointerdown', onceHandler);
        } catch {}
    }

  /** Load Fire_Transition spine assets dynamically if needed. */
  private loadFireTransitionIfNeeded(): Promise<boolean> {
    if (!this.scene) return Promise.resolve(false);
    if (this.fireTransitionLoadState === 'loaded') return Promise.resolve(true);
    if (this.fireTransitionLoadState === 'failed') return Promise.resolve(false);
    if (this.fireTransitionLoadState === 'loading' && this.fireTransitionLoadPromise) return this.fireTransitionLoadPromise;

    this.fireTransitionLoadState = 'loading';
    this.fireTransitionLoadPromise = new Promise<boolean>((resolve) => {
      try {
        if (!ensureSpineLoader(this.scene!, '[ScatterWinOverlay] fire transition dynamic load')) {
          this.fireTransitionLoadState = 'failed';
          resolve(false);
          return;
        }
        const loader = (this.scene as any).load;
        try { loader?.spineAtlas?.('fire_transition_atlas', resolveAssetUrl('/assets/animations/Fire/Fire_Transition.atlas')); } catch {}
        try { loader?.spineJson?.('fire_transition', resolveAssetUrl('/assets/animations/Fire/Fire_Transition.json')); } catch {}

        const onComplete = () => { this.fireTransitionLoadState = 'loaded'; resolve(true); };
        const onError = () => { this.fireTransitionLoadState = 'failed'; resolve(false); };
        try { (this.scene as any).load?.once('complete', onComplete); } catch {}
        try { (this.scene as any).load?.once('loaderror', onError); } catch {}
        try { (this.scene as any).load?.start(); } catch {}
      } catch (e) {
        console.warn('[ScatterWinOverlay] Fire_Transition dynamic load failed:', e);
        this.fireTransitionLoadState = 'failed';
        resolve(false);
      }
    });
    return this.fireTransitionLoadPromise;
  }

  /** Dynamically load Main_Fire spine (atlas+json). */
  private loadMainFireIfNeeded(): Promise<boolean> {
    if (!this.scene) return Promise.resolve(false);
    if (this.mainFireLoadState === 'loaded') return Promise.resolve(true);
    if (this.mainFireLoadState === 'failed') return Promise.resolve(false);
    if (this.mainFireLoadState === 'loading' && this.mainFireLoadPromise) return this.mainFireLoadPromise;

    this.mainFireLoadState = 'loading';
    this.mainFireLoadPromise = new Promise<boolean>((resolve) => {
      try {
        if (!ensureSpineLoader(this.scene!, '[ScatterWinOverlay] main fire dynamic load')) {
          this.mainFireLoadState = 'failed';
          resolve(false);
          return;
        }
        const loader = (this.scene as any).load;
        try { loader?.spineAtlas?.('main_fire_atlas', resolveAssetUrl('/assets/animations/Fire/Main_Fire.atlas')); } catch {}
        try { loader?.spineJson?.('main_fire', resolveAssetUrl('/assets/animations/Fire/Main_Fire.json')); } catch {}

        const onComplete = () => { this.mainFireLoadState = 'loaded'; resolve(true); };
        const onError = () => { this.mainFireLoadState = 'failed'; resolve(false); };
        try { (this.scene as any).load?.once('complete', onComplete); } catch {}
        try { (this.scene as any).load?.once('loaderror', onError); } catch {}
        try { (this.scene as any).load?.start(); } catch {}
      } catch (e) {
        console.warn('[ScatterWinOverlay] Main_Fire dynamic load failed:', e);
        this.mainFireLoadState = 'failed';
        resolve(false);
      }
    });
    return this.mainFireLoadPromise;
  }

  /** Create and show the Main_Fire spine at the bottom center. */
  private async showMainFire(): Promise<void> {
    if (!this.scene || !ensureSpineFactory(this.scene, '[ScatterWinOverlay] main fire factory')) return;
    const loaded = await this.loadMainFireIfNeeded();
    if (!loaded) return;

    try {
      // Clear prior instance
      if (this.mainFireSpines && this.mainFireSpines.length) { for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} } this.mainFireSpines = []; }
      if (!this.bottomFireContainer) return;

      const w = this.scene.cameras.main.width;
      const h = this.scene.cameras.main.height;
      // Corner targets with margins from edges, plus per-side offsets
      const leftBaseX = Math.max(0, this.bottomLeftFireMarginX);
      const rightBaseX = Math.max(0, w - this.bottomRightFireMarginX);
      const baseY = Math.max(0, h - Math.max(this.bottomLeftFireMarginY, this.bottomRightFireMarginY));
      const leftTargetX = leftBaseX + (this.bottomLeftFireOffsetX || 0);
      const rightTargetX = rightBaseX + (this.bottomRightFireOffsetX || 0);
      const leftTargetY = baseY + (this.bottomLeftFireOffsetY || 0);
      const rightTargetY = baseY + (this.bottomRightFireOffsetY || 0);
      // Start just off-screen at bottom and slide upward
      const startY = h + 80;

      // Create two spines (left and right), start at off-screen bottom near their target X
      const left = (this.scene.add as any).spine(leftTargetX, startY, 'main_fire', 'main_fire_atlas');
      const right = (this.scene.add as any).spine(rightTargetX, startY, 'main_fire', 'main_fire_atlas');
      try { (left as any).setDepth?.(1); (right as any).setDepth?.(1); } catch {}
      // Anchor to bottom corners for precise corner placement
      try { (left as any).setOrigin?.(0.0, 1.0); } catch {}
      try { (right as any).setOrigin?.(1.0, 1.0); } catch {}
      // Initial hint angles
      try { (left as any).setAngle?.(this.bottomLeftFireRotationDeg || 0); } catch {}
      try { (right as any).setAngle?.(this.bottomRightFireRotationDeg || 0); } catch {}
      this.bottomFireContainer.add(left);
      this.bottomFireContainer.add(right);
      this.mainFireSpines = [left, right];
      try { this.container?.bringToTop(this.bottomFireContainer!); } catch {}

      // Play loop for both
      const playLoop = (sp: any) => {
        try {
          const state = sp.animationState;
          let played = false;
          try { state.setAnimation(0, 'animation', true); played = true; } catch {}
          if (!played) {
            const anims = sp?.skeleton?.data?.animations || [];
            const first = anims[0]?.name;
            if (first) { state.setAnimation(0, first, true); }
          }
        } catch {}
      };
      playLoop(left); playLoop(right);

      // Fit each to half screen width without distorting aspect ratio, then apply per-corner scale/rotation
      this.bottomFireContainer.setAlpha(0);
      this.scene.time.delayedCall(0, () => {
        const fitHalf = (sp: any, mul: number) => {
          try {
            const getBounds = sp?.getBounds?.bind(sp);
            let width = 0;
            if (typeof getBounds === 'function') {
              const b = getBounds();
              width = (b && b.size && b.size.x) ? b.size.x : (b && b.width) ? b.width : 0;
            }
            if (!width || width <= 0) width = sp.displayWidth || 0;
            if (width && width > 0) {
              const currentScaleX = sp.scaleX || 1;
              const scaledWidth = width * currentScaleX;
              const desiredScale = scaledWidth > 0 ? ((w * 0.5) / scaledWidth) * currentScaleX : currentScaleX;
              // Apply height modifier while preserving width fit and per-corner extra multiplier
              const uniform = desiredScale * Math.max(0.1, mul || 1);
              const yScale = uniform * Math.max(0.1, this.mainFireHeightScale || 1);
              sp.setScale(uniform, yScale);
            }
          } catch {}
        };
        fitHalf(left, this.bottomLeftFireScaleMul || 1);
        fitHalf(right, this.bottomRightFireScaleMul || 1);

        // Slide both up to their corner targets and fade in (individual Y targets)
        this.scene?.tweens.add({ targets: left, x: leftTargetX, y: leftTargetY, duration: 450, ease: 'Cubic.easeOut' });
        this.scene?.tweens.add({ targets: right, x: rightTargetX, y: rightTargetY, duration: 450, ease: 'Cubic.easeOut' });
        this.scene?.tweens.add({ targets: this.bottomFireContainer, alpha: 1, duration: 250, ease: 'Cubic.easeOut' });
      });
    } catch (e) {
      console.warn('[ScatterWinOverlay] Failed to show Main_Fire spine:', e);
    }
  }

  /** Individual modifiers for bottom-left corner fire. */
  public setBottomLeftFireOptions(options: { marginX?: number; marginY?: number; rotationDeg?: number; scaleMul?: number; offsetX?: number; offsetY?: number; }): void {
    if (options.marginX !== undefined) this.bottomLeftFireMarginX = Math.max(0, options.marginX);
    if (options.marginY !== undefined) this.bottomLeftFireMarginY = Math.max(0, options.marginY);
    if (options.rotationDeg !== undefined) this.bottomLeftFireRotationDeg = options.rotationDeg;
    if (options.scaleMul !== undefined) this.bottomLeftFireScaleMul = Math.max(0.1, options.scaleMul);
    if (options.offsetX !== undefined) this.bottomLeftFireOffsetX = options.offsetX;
    if (options.offsetY !== undefined) this.bottomLeftFireOffsetY = options.offsetY;
  }

  /** Individual modifiers for bottom-right corner fire. */
  public setBottomRightFireOptions(options: { marginX?: number; marginY?: number; rotationDeg?: number; scaleMul?: number; offsetX?: number; offsetY?: number; }): void {
    if (options.marginX !== undefined) this.bottomRightFireMarginX = Math.max(0, options.marginX);
    if (options.marginY !== undefined) this.bottomRightFireMarginY = Math.max(0, options.marginY);
    if (options.rotationDeg !== undefined) this.bottomRightFireRotationDeg = options.rotationDeg;
    if (options.scaleMul !== undefined) this.bottomRightFireScaleMul = Math.max(0.1, options.scaleMul);
    if (options.offsetX !== undefined) this.bottomRightFireOffsetX = options.offsetX;
    if (options.offsetY !== undefined) this.bottomRightFireOffsetY = options.offsetY;
  }

  /** Public API: set vertical height scale for Main_Fire (1 = original, >1 taller). */
  public setMainFireHeightScale(scale: number = 1.7): void {
    this.mainFireHeightScale = Math.max(0.1, scale);
    try {
      if (this.mainFireSpines && this.mainFireSpines.length) {
        for (const sp of this.mainFireSpines) {
          if (sp) {
            const sx = sp.scaleX || 1;
            sp.setScale(sx, sx * this.mainFireHeightScale);
          }
        }
      }
    } catch {}
  }

  /** Play the Fire_Transition overlay, then enter bonus and start autoplay. */
  private async playFireTransitionThenEnterBonus(): Promise<void> {
    if (!this.scene || !ensureSpineFactory(this.scene, '[ScatterWinOverlay] fire transition factory')) {
      // Fallback: proceed without transition
      this.enterBonusAndStartAutoplay();
      return;
    }
    // Lock to BONUS during transition and stop current BGM to avoid MAIN blips
    try {
      const audio = (window as any).audioManager;
      if (audio) {
        if (typeof audio.lockMusicTo === 'function') audio.lockMusicTo(MusicType.BONUS);
        if (typeof audio.stopCurrentMusic === 'function') audio.stopCurrentMusic();
      }
    } catch {}
    const loaded = await this.loadFireTransitionIfNeeded();
    if (!loaded) {
      this.enterBonusAndStartAutoplay();
      return;
    }

    // Create transition container elements if missing
    try {
      if (!this.transitionBg) {
        this.transitionBg = this.scene.add.rectangle(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2,
          this.scene.cameras.main.width * 2,
          this.scene.cameras.main.height * 2,
          0x000000,
          0 // initially zero fill; we'll set opaque fill when transition starts
        );
        this.transitionBg.setOrigin(0.5);
        this.transitionBg.setAlpha(1);
        try { this.transitionBg.setInteractive(); } catch {}
        this.transitionContainer?.add(this.transitionBg);
      }

      // Spine object
      try { if (this.transitionSpine) { this.transitionSpine.destroy(); this.transitionSpine = null; } } catch {}
      this.transitionSpine = (this.scene.add as any).spine(
        this.scene.cameras.main.width * 0.5,
        this.scene.cameras.main.height * 0.5,
        'fire_transition',
        'fire_transition_atlas'
      );
      try { this.transitionSpine.setOrigin(0.5, 0.5); } catch {}
      try { (this.transitionSpine as any).setDepth?.(1); } catch {}
      // Pin transition elements to camera (screen space)
      try { (this.transitionSpine as any).setScrollFactor?.(0); } catch {}
      try { this.transitionContainer?.setScrollFactor?.(0); } catch {}
      try { this.transitionBg?.setScrollFactor?.(0); } catch {}
      this.transitionContainer?.add(this.transitionSpine);

			// Ensure the transition spine covers the full viewport (no gaps at top/bottom)
			try {
				const w = this.scene.cameras.main.width;
				const h = this.scene.cameras.main.height;
				let bw = 0;
				let bh = 0;
				try {
					const b = this.transitionSpine.getBounds();
					bw = (b && (b.size?.x || (b as any).width)) || 0;
					bh = (b && (b.size?.y || (b as any).height)) || 0;
				} catch {}
				if (bw > 0 && bh > 0) {
					const scaleToCover = Math.max(w / bw, h / bh) * 2.0; // larger overscan to eliminate gaps
					this.transitionSpine.setScale(scaleToCover);
				}
			} catch {}

      // Ensure the background is an opaque fullscreen mask during transition (fast fade-in)
      try {
        this.transitionBg.setFillStyle(0x000000, 1);
        this.transitionBg.setAlpha(0);
        this.scene?.tweens.add({ targets: this.transitionBg, alpha: 0.7, duration: 80, ease: 'Cubic.easeOut' });
      } catch {}

      // Show container and ensure it renders above everything
      this.transitionContainer?.setVisible(true);
      this.transitionContainer?.setAlpha(1);
      try { this.scene.children.bringToTop(this.transitionContainer!); } catch {}

      // Play blaze SFX during fire transition
      try {
        const audio = (window as any).audioManager;
        if (audio && typeof audio.playOneShot === 'function') {
          audio.playOneShot('blaze_hh');
        } else {
          (this.scene as any)?.sound?.play?.('blaze_hh');
        }
      } catch {}

      // Aggressively stop any BGM to avoid overlaps before switching
      try {
        const audio = (window as any).audioManager;
        if (audio && typeof audio.stopAllMusic === 'function') {
          audio.stopAllMusic();
        }
      } catch {}

      // Blaze SFX removed with fire transitions

      // Apply optional timeScale modifier
      let s = 1.0;
      try {
        s = Math.max(0.05, this.fireTransitionTimeScale || 1.0);
        (this.transitionSpine as any).animationState.timeScale = s;
      } catch {}

       // Ensure transition background covers any edge gaps behind the spine
       try { this.transitionBg.setAlpha(1); } catch {}

      // Play transition animation (try named, else first available)
      let finished = false;
      let bonusEntered = false;
      const enterIfNeeded = () => {
        if (bonusEntered) return;
        bonusEntered = true;
        // Fade out blaze SFX when entering bonus mid-transition
        try {
          const audio = (window as any).audioManager;
          if (audio && typeof audio.fadeOutSfx === 'function') {
            audio.fadeOutSfx('blaze_hh' as any, 200);
          }
        } catch {}
        this.enterBonusAndStartAutoplay();
      };
      const finish = () => {
        if (finished) return; finished = true;
        // Fade out quickly and proceed
        this.scene?.tweens.add({
          targets: this.transitionContainer,
          alpha: 0,
          duration: 200,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            // Ensure blaze SFX is faded out at end of transition
            try {
              const audio = (window as any).audioManager;
              if (audio && typeof audio.fadeOutSfx === 'function') {
                audio.fadeOutSfx('blaze_hh' as any, 200);
              }
            } catch {}
            try {
              this.transitionContainer?.setVisible(false);
              this.transitionContainer?.setAlpha(1);
              if (this.transitionSpine) { this.transitionSpine.destroy(); this.transitionSpine = null; }
              if (this.transitionBg) { this.transitionBg.setAlpha(0); }
              // Remove per-frame refit binding
              try {
                if ((this as any).__transitionRefit) {
                  this.scene?.events.off('update', (this as any).__transitionRefit);
                  (this as any).__transitionRefit = undefined;
                }
              } catch {}
            } catch {}
            // Only enter bonus if we haven't already switched mid-animation
            enterIfNeeded();
            // Embers anticipation removed
          }
        });
      };

      try {
        const state = (this.transitionSpine as any).animationState;
        let played = false;
        let entry: any = null;
        try {
          entry = state.setAnimation(0, 'animation', false);
          played = true;
        } catch {}
        if (!played) {
          try {
            const anims = (this.transitionSpine as any)?.skeleton?.data?.animations || [];
            const first = anims[0]?.name;
            if (first) {
              entry = state.setAnimation(0, first, false);
              played = true;
            }
          } catch {}
        }
        // After animation selection, re-fit to cover again (bounds may change post-setup)
        try {
          const refit = () => {
            try {
              const w = this.scene!.cameras.main.width;
              const h = this.scene!.cameras.main.height;
              const b = this.transitionSpine.getBounds();
              const bw = (b && (b.size?.x || (b as any).width)) || 0;
              const bh = (b && (b.size?.y || (b as any).height)) || 0;
              if (bw > 0 && bh > 0) {
                const scaleToCover = Math.max(w / bw, h / bh) * 2.0;
                this.transitionSpine.setScale(scaleToCover);
                // Also adjust vertical position so the top of the spine extends beyond the top edge
                try {
                  const offsetX = (b.offset?.x || (b as any).x || 0);
                  const offsetY = (b.offset?.y || (b as any).y || 0);
                  const s = (this.transitionSpine.scaleY || this.transitionSpine.scale || 1);
                  // World-space top of the bounds
                  const topWorld = (this.transitionSpine.y || 0) + offsetY * s;
                  const pad = Math.max(8, h * 0.02);
                  if (topWorld > -pad) {
                    const dy = topWorld + pad; // amount we need to move up
                    this.transitionSpine.y = (this.transitionSpine.y || 0) - dy;
                  }
                } catch {}
              }
            } catch {}
          };
          // Refit now and after a short delay (in case bounds update)
          refit();
          this.scene!.time.delayedCall(50, refit);
          this.scene!.time.delayedCall(200, refit);
          // Keep refitting each frame during the transition window
          try {
            if ((this as any).__transitionRefit) {
              this.scene!.events.off('update', (this as any).__transitionRefit);
            }
            (this as any).__transitionRefit = refit;
            this.scene!.events.on('update', (this as any).__transitionRefit);
          } catch {}
        } catch {}

        // Schedule mid-transition bonus entry based on animation duration and timeScale
        try {
          const rawDurationSec = Math.max(0.1, entry?.animation?.duration || 1.2);
          const ratio = Math.min(0.95, Math.max(0.05, this.fireTransitionMidTriggerRatio || 0.5));
          const midDelayMs = Math.max(50, (rawDurationSec / Math.max(0.0001, s)) * 1000 * ratio);
          this.scene.time.delayedCall(midDelayMs, enterIfNeeded);
        } catch {}
        try { state?.setListener?.({ complete: finish } as any); } catch {}
        // Fallback timeout in case listener not available
        this.scene.time.delayedCall(1200, finish);
      } catch {
        // If anything fails, proceed immediately
        finish();
      }
    } catch {
      this.enterBonusAndStartAutoplay();
    }
  }

  /** Enter bonus stage and start free-spin autoplay, same behavior as previous flow. */
  private enterBonusAndStartAutoplay(): void {
    // Switch to bonus background music exclusively
    try {
      const audio = (window as any).audioManager;
      if (audio && typeof audio.crossfadeTo === 'function') {
        audio.crossfadeTo(MusicType.BONUS, 450);
      } else if (audio && typeof audio.setExclusiveBackground === 'function') {
        // Fallback for older AudioManager
        audio.setExclusiveBackground(MusicType.BONUS);
      }
      // Now that BONUS is active, release lock
      try { if (audio && typeof audio.unlockMusic === 'function') audio.unlockMusic(); } catch {}
    } catch {}
                // Mark bonus mode if not already
                gameStateManager.isBonus = true;
                // Notify systems of bonus mode (triggers Symbols to recreate dragon spines)
                try { this.scene?.events.emit('setBonusMode', true); } catch {}
                // Show bonus layers immediately
                try {
                    this.scene?.events.emit('showBonusBackground');
                    this.scene?.events.emit('showBonusHeader');
                } catch {}
                // Signal that dialog/overlay animations are complete so free-spin UI (counter) can show
                try { this.scene?.events.emit('dialogAnimationsComplete'); } catch {}
                // Emit legacy scatter bonus activation event for listeners (SlotController/Symbols)
                let actualFreeSpins = this.lastFreeSpinsCount || 0;
                try {
                    const scatterIndex = (gameStateManager as any).scatterIndex || 0;
                    this.scene?.events.emit('scatterBonusActivated', { scatterIndex, actualFreeSpins });
                } catch {}
                // Ensure reels/symbols are visible while waiting for autoplay delay
                try { this.scene?.events.emit('enableSymbols'); } catch {}
                // Also directly show the free spin counter via SlotController (immediate UX)
                try {
                    const slotCtrl = (this.scene as any)?.slotController;
                    if (slotCtrl && typeof slotCtrl.showFreeSpinDisplayWithActualValue === 'function') {
                        slotCtrl.showFreeSpinDisplayWithActualValue(actualFreeSpins);
                    }
                } catch {}

                // Kick off free spin autoplay via Symbols after optional delay
                const gameScene = this.scene as any;
                const startAutoplay = () => {
                    if (gameScene?.symbols && typeof gameScene.symbols.triggerAutoplayForFreeSpins === 'function') {
                    gameScene.symbols.triggerAutoplayForFreeSpins();
                } else {
                    // Fallback: emit a generic event SlotController listens to
                    gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);
                }
            };
                try {
                    this.scene?.time.delayedCall(Math.max(0, this.freeSpinAutoplayDelayMs), startAutoplay);
                } catch {
                    startAutoplay();
                }
  }

  // ======== Embers anticipation helpers (post-fire) ========
  private startOverlayEmbers(): void {
    if (!this.scene) return;
    try {
      if (this.overlayEmbersSpawnTimer) { try { this.overlayEmbersSpawnTimer.remove(false); } catch {} this.overlayEmbersSpawnTimer = null; }
      if (this.overlayEmbersContainer) { try { this.overlayEmbersContainer.destroy(true); } catch {} this.overlayEmbersContainer = null; }
      this.overlayEmbersContainer = this.scene.add.container(0, 0);
      this.overlayEmbersContainer.setAlpha(0);
      // fade in container for smooth start
      this.scene.tweens.add({ targets: this.overlayEmbersContainer, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
      // reset particles and spawn loop
      this.overlayEmberParticles = [];
      if (this.overlayEmbersUpdateHandler) { try { this.scene.events.off('update', this.overlayEmbersUpdateHandler); } catch {} this.overlayEmbersUpdateHandler = null; }
      this.overlayEmbersUpdateHandler = (_t: number, d: number) => this.updateOverlayEmbers(d);
      this.scene.events.on('update', this.overlayEmbersUpdateHandler);
      this.overlayEmbersSpawnTimer = this.scene.time.addEvent({ delay: 90, loop: true, callback: () => this.spawnOneOverlayEmber() });
      try { this.scene.children.bringToTop(this.overlayEmbersContainer); } catch {}
    } catch {}
  }

  private stopOverlayEmbers(): void {
    if (!this.scene) return;
    try {
      if (this.overlayEmbersSpawnTimer) { this.overlayEmbersSpawnTimer.remove(false); this.overlayEmbersSpawnTimer = null; }
      if (this.overlayEmbersUpdateHandler) { try { this.scene.events.off('update', this.overlayEmbersUpdateHandler); } catch {} this.overlayEmbersUpdateHandler = null; }
      if (this.overlayEmbersContainer) {
        const cont = this.overlayEmbersContainer;
        this.scene.tweens.add({
          targets: cont,
          alpha: 0,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            try { cont.getAll().forEach((child: any) => { try { child.destroy(); } catch {} }); } catch {}
            try { cont.destroy(true); } catch {}
            this.overlayEmbersContainer = null;
          }
        });
      }
    } catch {}
  }

  private spawnOneOverlayEmber(): void {
    if (!this.scene || !this.overlayEmbersContainer) return;
    try {
      const w = this.scene.cameras.main.width;
      const h = this.scene.cameras.main.height;
      const g = this.scene.add.graphics();
      this.overlayEmbersContainer.add(g);
      const x = Math.random() * w;
      const y = h + 30 + Math.random() * 40;
      // Bigger embers for anticipation
      const size = Math.random() * 2.5 + 3.0;
      const colors = [0xffd700, 0xffe04a, 0xfff0a0, 0xffc107];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const alpha = Math.random() * 0.5 + 0.4;
      const lifetime = 1800 + Math.random() * 1200; // 1.8s – 3.0s
      const totalFramesAt60 = lifetime / (1000 / 60);
      const vy = -(h + 60) / Math.max(1, totalFramesAt60);
      const vx = (Math.random() - 0.5) * 0.9;
      const p = { graphics: g, x, y, vx, vy, size, color, alpha, lifetime, age: 0 };
      this.overlayEmberParticles.push(p);
      this.drawOverlayEmber(p);
    } catch {}
  }

  private drawOverlayEmber(p: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; size: number; color: number; alpha: number; }): void {
    const { graphics, x, y, size, color, alpha } = p;
    graphics.clear();
    const w = size * (Math.random() * 0.8 + 0.6);
    const h = size * (Math.random() * 1.2 + 0.8);
    graphics.fillStyle(color, alpha * 0.10); graphics.fillEllipse(x, y, w * 3.0, h * 3.0);
    graphics.fillStyle(color, alpha * 0.20); graphics.fillEllipse(x, y, w * 2.2, h * 2.2);
    graphics.fillStyle(color, alpha * 0.40); graphics.fillEllipse(x, y, w * 1.5, h * 1.5);
    graphics.fillStyle(color, alpha * 0.70); graphics.fillEllipse(x, y, w * 0.8, h * 0.8);
    graphics.fillStyle(0xffffaa, alpha * 0.30); graphics.fillEllipse(x, y, w * 0.35, h * 0.35);
  }

  private updateOverlayEmbers(delta: number): void {
    for (let i = this.overlayEmberParticles.length - 1; i >= 0; i--) {
      const p = this.overlayEmberParticles[i];
      p.age += delta;
      if (p.age >= p.lifetime) {
        try { p.graphics.destroy(); } catch {}
        this.overlayEmberParticles.splice(i, 1);
        continue;
      }
      const dt = delta / (1000 / 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const ageRatio = p.age / p.lifetime;
      p.alpha = Math.max(0.05, 1 - ageRatio);
      this.drawOverlayEmber(p);
    }
  }

  // Glow overlay removed (placeholder for future PNG-based implementation)

  /** Public API: set Fire_Transition time scale (e.g., 0.5 = slower, 2 = faster). */
  public setFireTransitionTimeScale(scale: number = 0.5): void {
    this.fireTransitionTimeScale = Math.max(0.05, scale);
    try {
      if (this.transitionSpine && (this.transitionSpine as any).animationState) {
        (this.transitionSpine as any).animationState.timeScale = this.fireTransitionTimeScale;
      }
        } catch {}
    }

  /** Public API: set when to switch to bonus during Fire_Transition (0..1 of animation). */
  public setFireTransitionMidTriggerRatio(ratio: number = 0.5): void {
    this.fireTransitionMidTriggerRatio = Math.min(0.95, Math.max(0.05, ratio));
    }

    /** Public API: set delay (ms) before starting free-spin autoplay after bonus begins. */
    public setFreeSpinAutoplayDelay(delayMs: number = 0): void {
        this.freeSpinAutoplayDelayMs = Math.max(0, delayMs);
    }

    /** Configure the press-anywhere hint options. */
    public setPressAnyOptions(options: { showDelayMs?: number; offsetX?: number; offsetY?: number; scale?: number; }): void {
        if (options.showDelayMs !== undefined) this.pressAnyShowDelayMs = Math.max(0, options.showDelayMs);
        if (options.offsetX !== undefined) this.pressAnyOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.pressAnyOffsetY = options.offsetY;
        if (options.scale !== undefined) this.pressAnyScale = Math.max(0.1, options.scale);
    }
}
