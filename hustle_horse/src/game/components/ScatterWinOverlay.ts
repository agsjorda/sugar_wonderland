import { Scene } from 'phaser';
import { ensureSpineLoader, ensureSpineFactory } from '../../utils/SpineGuard';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
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
    private cardsContainer: Phaser.GameObjects.Container | null = null;
    private cards: Phaser.GameObjects.GameObject[] = [];
    private pngCardScale: number = 0.85;
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
    private overlayTextOffsetX: number = -35; // px offset from card center
    private overlayTextOffsetY: number = -140; // px offset from card center
    private overlayTextScaleFactor: number = 1; // relative to card scale
    private overlayTextRef: Phaser.GameObjects.Image | null = null;
    private congratsRef: Phaser.GameObjects.Image | null = null;
    private pressAnyText: Phaser.GameObjects.Text | null = null;
    // Congrats popup options
    private congratsBaseScale: number = 0.66;
    private congratsOffsetX: number = 0;
    private congratsOffsetY: number = 0;
    private congratsYOffsetRatio: number = 0.8; // portion of card height above card center
    private congratsPulseAmplitude: number = 0.1; // ±3%
    private congratsPulseDurationMs: number = 200;
    private congratsPopDurationMs: number = 350;
    private congratsShowDelayMs: number = 400;
    private lastFreeSpinsCount: number | null = null;
    // Press-anywhere hint options
    private pressAnyShowDelayMs: number = 300; // after congrats appears
    private pressAnyOffsetX: number = 0;
    private pressAnyOffsetY: number = 16;
    private pressAnyScale: number = 1;
    // Card animation timing (ms)
    private cardIntroInitialDelayMs: number = 1200; // wait after overlay shows
    private cardPerCardIntervalMs: number = 400;    // delay between each card
    private cardThrowDurationMs: number = 900;      // single card fly-in duration
    // Card layout defaults (ratios and angles) – tuned to reference image
    private cardTargetYRatio: number = 0.59;
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
    // Free spin digits display options
    private fsDigitsScaleFactor: number = 1.1; // multiplier for manual descaling/rescaling
    private fsDigitsOffsetX: number = -16;       // extra offset from default base
    private fsDigitsOffsetY: number = 0;       // extra offset from default base
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

            // Add elements to container
            this.container.add([
                this.background,
                this.fireContainer,
                this.imagesContainer,
                this.cardsContainer
            ]);
            
            this.container.setVisible(false);
            
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
        if (this.isShowing || !this.scene || !this.container || !this.background || !this.pickACard) {
            if (onComplete) onComplete();
            return;
        }
        
        // Clear any existing animations
        this.clearAnimations();
        
        this.isShowing = true;
        this.onCompleteCallback = onComplete;
        // reset dismissal promise resolver
        this.dismissResolver = undefined;
        
        // Set initial state
        // Ensure fill is fully opaque and tween the display alpha for proper fade effect
        this.background.setFillStyle(color, 1);
        this.background.setAlpha(0);
        // Reset any previous fire object state; we'll create it after loading
        if (this.winFont) {
            try { this.winFont.destroy?.(); } catch {}
            this.winFont = null;
        }
        this.pickACard.setScale(0);
        this.pickACard.setAlpha(0);
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
            ease: 'Cubic.easeOut'
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
                try { loader?.spineAtlas?.('overlay_fire_atlas', '/assets/animations/Fire/fireanimation01_HTBH.atlas'); } catch {}
                try { loader?.spineJson?.('overlay_fire', '/assets/animations/Fire/fireanimation01_HTBH.json'); } catch {}

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
        this.pickScale = Math.max(0.05, scale);
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
        
        // Fade out all elements
        const fadeOutTweens: Phaser.Tweens.Tween[] = [];
        // Stop idle animation when hiding
        this.isIdleAnimating = false;
        
        if (this.background) {
            const bgTween = this.scene.tweens.add({
                targets: this.background,
                alpha: 0,
                duration: duration,
                ease: 'Cubic.easeIn'
            });
            fadeOutTweens.push(bgTween);
        }
        
        if (this.winFont) {
            const winTween = this.scene.tweens.add({
                targets: this.winFont,
                alpha: 0,
                scaleX: this.fireScale * 0.8,
                scaleY: this.fireScale * 0.8,
                duration: duration,
                ease: 'Cubic.easeIn'
            });
            fadeOutTweens.push(winTween);
        }
        
        if (this.pickACard) {
            const cardTween = this.scene.tweens.add({
                targets: this.pickACard,
                alpha: 0,
                scale: 0.5,
                duration: duration - 100,
                ease: 'Cubic.easeIn'
            });
            fadeOutTweens.push(cardTween);
        }
        
        if (this.chooseText) {
            const textTween = this.scene.tweens.add({
                targets: this.chooseText,
                alpha: 0,
                scale: 0.5,
                duration: duration - 100,
                ease: 'Cubic.easeIn'
            });
            fadeOutTweens.push(textTween);
        }
        
        // Wait for all tweens to complete
        this.scene.tweens.add({
            targets: { value: 0 },
            value: 1,
            duration: duration,
            onComplete: () => {
                if (this.container) this.container.setVisible(false);
                this.isShowing = false;
                this.clearAnimations();
                if (onComplete) onComplete();
                if (this.dismissResolver) {
                    const resolve = this.dismissResolver;
                    this.dismissResolver = undefined;
                    resolve();
                }
            }
        });
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
                onStart: () => { if (this.cardsContainer) this.cardsContainer.setAlpha(1); },
                onComplete: () => {
                    completed++;
                    if (completed === 3) {
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
    }): void {
        if (options.baseScale !== undefined) this.congratsBaseScale = Math.max(0.05, options.baseScale);
        if (options.offsetX !== undefined) this.congratsOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.congratsOffsetY = options.offsetY;
        if (options.yOffsetRatio !== undefined) this.congratsYOffsetRatio = Math.min(2, Math.max(0, options.yOffsetRatio));
        if (options.pulseAmplitude !== undefined) this.congratsPulseAmplitude = Math.max(0, options.pulseAmplitude);
        if (options.pulseDurationMs !== undefined) this.congratsPulseDurationMs = Math.max(50, options.pulseDurationMs);
        if (options.popDurationMs !== undefined) this.congratsPopDurationMs = Math.max(50, options.popDurationMs);
        if (options.showDelayMs !== undefined) this.congratsShowDelayMs = Math.max(0, options.showDelayMs);
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
            // Destroy digit sprites if any
            if (this.fsDigitSprites && this.fsDigitSprites.length) {
                for (const spr of this.fsDigitSprites) { try { spr.destroy(); } catch {} }
                this.fsDigitSprites = [];
            }
            if (this.congratsRef) {
                try { this.congratsRef.destroy(); } catch {}
                this.congratsRef = null;
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
            const w = this.scene.cameras.main.width;
            const h = this.scene.cameras.main.height;
            // Position relative to the chosen card's final position and size
            const baseX = (chosen?.x ?? w * 0.5) + this.congratsOffsetX;
            const baseY = (chosen?.y ?? h * this.flippedCardTargetYRatio) - ((chosen?.displayHeight || 200) * this.congratsYOffsetRatio) + this.congratsOffsetY;
            const img = this.scene.add.image(baseX, baseY, 'congrats');
            img.setOrigin(0.5, 0.5);
            img.setAlpha(0);
            img.setScale(this.congratsBaseScale * 0.9);
            try { (img as any).setDepth?.(10005); } catch {}
            this.congratsRef = img;

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
                // Hide overlay
                this.hide(300);
                // Mark bonus mode if not already
                gameStateManager.isBonus = true;
                // Kick off free spin autoplay via Symbols
                const gameScene = this.scene as any;
                if (gameScene.symbols && typeof gameScene.symbols.triggerAutoplayForFreeSpins === 'function') {
                    gameScene.symbols.triggerAutoplayForFreeSpins();
                } else {
                    // Fallback: emit a generic event SlotController listens to
                    gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);
                }
            };
            this.background.once('pointerdown', onceHandler);
        } catch {}
    }

    /** Configure the press-anywhere hint options. */
    public setPressAnyOptions(options: { showDelayMs?: number; offsetX?: number; offsetY?: number; scale?: number; }): void {
        if (options.showDelayMs !== undefined) this.pressAnyShowDelayMs = Math.max(0, options.showDelayMs);
        if (options.offsetX !== undefined) this.pressAnyOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.pressAnyOffsetY = options.offsetY;
        if (options.scale !== undefined) this.pressAnyScale = Math.max(0.1, options.scale);
    }
}
