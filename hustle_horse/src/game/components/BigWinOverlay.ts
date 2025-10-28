import { Scene } from 'phaser';
import { ensureSpineLoader, ensureSpineFactory } from '../../utils/SpineGuard';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';

/**
 * BigWinOverlay - a lightweight overlay modeled after ScatterWinOverlay.
 * It reuses the fire spine/title effect and plays the same win SFX as existing
 * win dialogs, but renders a PNG title (big-win.png) and a NumberDisplay value.
 */
export class BigWinOverlay {
    private scene: Scene | null = null;
    private container: Phaser.GameObjects.Container | null = null;
    private background: Phaser.GameObjects.Rectangle | null = null;
    private fireContainer: Phaser.GameObjects.Container | null = null;
    private titleImage: Phaser.GameObjects.Image | null = null;
    private amountContainer: Phaser.GameObjects.Container | null = null;
    private continueText: Phaser.GameObjects.Text | null = null;
    private winFont: any | null = null; // fire spine or fallback image
    private numberDisplay: NumberDisplay | null = null;
    private isInitialized: boolean = false;
    private isShowing: boolean = false;
    private animations: Phaser.Tweens.Tween[] = [];
    private dismissResolver?: () => void;
    private onCompleteCallback?: () => void;

    // Managers needed by NumberDisplay
    private networkManager: NetworkManager | null = null;
    private screenModeManager: ScreenModeManager | null = null;

    // Layout ratios
    private firePosRatio = { x: 0.5, y: 0.18 };
    private titlePosRatio = { x: 0.5, y: 0.26 };
    private amountPosRatio = { x: 0.5, y: 0.44 };
    private continuePosRatio = { x: 0.5, y: 0.58 };

    private fireScale: number = 0.6; // match ScatterWinOverlay default
    private pickScale: number = 0.4; // use PickACard scale for title image
    private isIdleAnimating: boolean = false;
    private idlePulseScale: number = 1.1;
    private idlePulseDuration: number = 900;
    // Bounds for title PNG scaling (clamped everywhere)
    private titleScaleMin: number = 0.2;
    private titleScaleMax: number = 1.2;
    private amountScale: number = 0.18;

    private fireSpineLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private fireLoadPromise: Promise<boolean> | null = null;
    private titleLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private titleKey: string = 'big_win_title_png';

    constructor(scene?: Scene, networkManager?: NetworkManager, screenModeManager?: ScreenModeManager) {
        if (scene) {
            this.initialize(scene, networkManager!, screenModeManager!);
        }
    }

    public initialize(scene: Scene, networkManager?: NetworkManager, screenModeManager?: ScreenModeManager): void {
        if (this.isInitialized) return;

        this.scene = scene;
        this.networkManager = networkManager || null;
        this.screenModeManager = screenModeManager || null;

        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(10000);
        this.container.setVisible(false);

        this.background = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000,
            1
        );
        this.background.setOrigin(0.5);
        this.background.setAlpha(0);
        this.background.setInteractive();
        try { (this.scene.input as any).topOnly = true; } catch {}

        this.fireContainer = this.scene.add.container(0, 0);
        this.amountContainer = this.scene.add.container(0, 0);

        this.container.add([this.background, this.fireContainer, this.amountContainer]);

        this.background.on('pointerdown', (_p: any, _x: number, _y: number, event: any) => {
            try { event?.stopPropagation?.(); } catch {}
            this.hide();
        });

        this.isInitialized = true;
    }

    /**
     * Show the Big Win overlay.
     */
    public show(amount: number = 2500000.5, color: number = 0x0c2121, alpha: number = 0.92, durationMs: number = 700, onComplete?: () => void): void {
        if (!this.scene || !this.container || !this.background) return;
        if (this.isShowing) {
            if (onComplete) onComplete();
            return;
        }

        this.isShowing = true;
        this.onCompleteCallback = onComplete;
        this.dismissResolver = undefined;
        this.container.setVisible(true);
        this.container.setDepth(10000);

        // Reset
        this.clearAnimations();
        if (this.titleImage) { try { this.titleImage.destroy(); } catch {} this.titleImage = null; }
        if (this.numberDisplay) { try { this.numberDisplay.destroy(); } catch {} this.numberDisplay = null; }
        if (this.continueText) { try { this.continueText.destroy(); } catch {} this.continueText = null; }
        if (this.winFont) { try { this.winFont.destroy?.(); } catch {} this.winFont = null; }

        this.background.setFillStyle(color, 1);
        this.background.setAlpha(0);

        // Fade in background
        const bgTween = this.scene.tweens.add({
            targets: this.background,
            alpha: alpha,
            duration: durationMs,
            ease: 'Cubic.easeOut'
        });
        this.animations.push(bgTween);

        // Load assets, then build visuals
        this.scene.time.delayedCall(120, async () => {
            if (!this.scene) return;
            const [fireReady, titleReady] = await Promise.all([
                this.loadFireSpineIfNeeded(),
                this.loadTitleIfNeeded()
            ]);
            if (!this.scene) return;

            // Fire spine (preferred)
            if (fireReady && ensureSpineFactory(this.scene!, '[BigWinOverlay] create overlay fire')) {
                try {
                    const spineObj = (this.scene.add as any).spine(
                        this.scene.cameras.main.width * this.firePosRatio.x,
                        this.scene.cameras.main.height * this.firePosRatio.y,
                        'overlay_fire',
                        'overlay_fire_atlas'
                    );
                    this.winFont = spineObj;
                    try { spineObj.setOrigin(0.5, 0.5); } catch {}
                    try { spineObj.setScale(0); } catch {}
                    try { spineObj.setAlpha(0); } catch {}
                    this.fireContainer?.add(spineObj);
                } catch (e) {
                    console.warn('[BigWinOverlay] Could not create overlay fire spine after load:', e);
                }
            }
            // If spine not available, skip fire gracefully

            // Title image
            if (titleReady) {
                try {
                    this.titleImage = this.scene.add.image(
                        this.scene.cameras.main.width * this.titlePosRatio.x,
                        this.scene.cameras.main.height * this.titlePosRatio.y,
                        this.titleKey
                    );
                    this.titleImage.setOrigin(0.5);
                    this.titleImage.setScale(0);
                    this.titleImage.setAlpha(0);
                    this.container?.add(this.titleImage);
                } catch (e) {
                    console.warn('[BigWinOverlay] Failed to create title image:', e);
                }
            }

            // Show animations
            if (this.winFont) {
                const fireTween = this.scene.tweens.add({
                    targets: this.winFont,
                    alpha: 1,
                    scaleX: this.fireScale * 1.08,
                    scaleY: this.fireScale * 1.08,
                    duration: 500,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.scene?.tweens.add({
                            targets: this.winFont,
                            scaleX: this.fireScale,
                            scaleY: this.fireScale,
                            duration: 300,
                            ease: 'Bounce.easeOut'
                        });
                        try { (this.winFont as any).animationState?.setAnimation(0, 'animation', true); } catch {}
                    }
                });
                this.animations.push(fireTween);
                // Fire pop SFX
                try {
                    const audio = (window as any).audioManager;
                    if (audio && typeof audio.playSoundEffect === 'function') {
                        audio.playSoundEffect('fire_hh');
                    }
                } catch {}
            }

            if (this.titleImage) {
                const clamp = (v: number) => Math.min(this.titleScaleMax, Math.max(this.titleScaleMin, v));
                const titleTween = this.scene.tweens.add({
                    targets: this.titleImage,
                    alpha: 1,
                    scaleX: clamp(this.pickScale * 1.1),
                    scaleY: clamp(this.pickScale * 1.1),
                    duration: 500,
                    ease: 'Back.easeOut',
                    delay: 300, // mirror ScatterWinOverlay timing for PickACard
                    onComplete: () => {
                        if (!this.scene || !this.titleImage) return;
                        this.scene.tweens.add({
                            targets: this.titleImage,
                            scaleX: clamp(this.pickScale),
                            scaleY: clamp(this.pickScale),
                            duration: 300,
                            ease: 'Bounce.easeOut',
                            onComplete: () => {
                                this.startIdleAnimation();
                            }
                        });
                    }
                });
                this.animations.push(titleTween);
            }

            // Amount number display
            const amountConfig: NumberDisplayConfig = {
                x: this.scene.cameras.main.width * this.amountPosRatio.x,
                y: this.scene.cameras.main.height * this.amountPosRatio.y,
                scale: this.amountScale,
                spacing: -8,
                alignment: 'center',
                decimalPlaces: 2,
                showCommas: true,
                prefix: '',
                suffix: '',
                commaYOffset: 12,
                dotYOffset: 10
            };
            this.numberDisplay = new NumberDisplay(
                this.networkManager as any,
                this.screenModeManager as any,
                amountConfig
            );
            this.numberDisplay.create(this.scene);
            this.numberDisplay.displayValue(amount);
            this.amountContainer?.add(this.numberDisplay.getContainer());
            this.numberDisplay.setAlpha(0);
            this.scene.tweens.add({
                targets: this.numberDisplay.getContainer(),
                alpha: 1,
                duration: 600,
                ease: 'Power2',
                delay: 420
            });

            // Continue text
            this.continueText = this.scene.add.text(
                this.scene.cameras.main.width * this.continuePosRatio.x,
                this.scene.cameras.main.height * this.continuePosRatio.y,
                'Press anywhere to continue',
                {
                    fontFamily: 'Poppins-Bold',
                    fontSize: '20px',
                    color: '#FFFFFF',
                    stroke: '#379557',
                    strokeThickness: 5,
                    shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
                }
            );
            this.continueText.setOrigin(0.5, 0.5);
            this.continueText.setAlpha(0);
            this.container?.add(this.continueText);
            this.scene.tweens.add({
                targets: this.continueText,
                alpha: 1,
                duration: 500,
                delay: 1500,
                ease: 'Power2'
            });

            // Play win SFX consistent with MediumW (Big Win alias)
            try {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.playWinDialogSfx === 'function') {
                    audio.playWinDialogSfx('MediumW_KA');
                }
                if (audio && typeof audio.duckBackground === 'function') {
                    audio.duckBackground(0.3);
                }
            } catch {}

            if (this.onCompleteCallback) this.onCompleteCallback();
        });
    }

    public hide(duration: number = 300, onComplete?: () => void): void {
        if (!this.scene || !this.container || !this.background) {
            if (onComplete) onComplete();
            return;
        }
        if (!this.isShowing) {
            if (onComplete) onComplete();
            return;
        }

        this.isIdleAnimating = false;

        this.scene.tweens.add({
            targets: [
                this.background,
                this.fireContainer,
                this.titleImage,
                this.amountContainer,
                this.continueText,
                this.winFont
            ].filter(Boolean) as any,
            alpha: 0,
            duration,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                try {
                    const audio = (window as any).audioManager;
                    if (audio && typeof audio.restoreBackground === 'function') {
                        audio.restoreBackground();
                    }
                } catch {}
                if (this.container) this.container.setVisible(false);
                this.isShowing = false;
                this.clearAnimations();
                if (this.dismissResolver) { const r = this.dismissResolver; this.dismissResolver = undefined; r(); }
                if (onComplete) onComplete();
            }
        });
    }

    public waitUntilDismissed(): Promise<void> {
        if (!this.isShowing) return Promise.resolve();
        return new Promise<void>((resolve) => { this.dismissResolver = resolve; });
    }

    private async loadTitleIfNeeded(): Promise<boolean> {
        if (!this.scene) return false;
        if (this.titleLoadState === 'loaded') return true;
        if (this.titleLoadState === 'failed') return false;
        if (this.titleLoadState === 'loading') return new Promise<boolean>((res) => {
            const check = () => res(this.titleLoadState === 'loaded');
            this.scene!.time.delayedCall(0, check);
        });

        this.titleLoadState = 'loading';
        return new Promise<boolean>((resolve) => {
            try {
                const loader = (this.scene as any).load;
                if (!(this.scene as any).textures.exists(this.titleKey)) {
                    try { loader.image(this.titleKey, '/assets/portrait/high/win_titles/big_win.png'); } catch {}
                }
                const onComplete = () => { this.titleLoadState = 'loaded'; resolve(true); };
                const onError = () => { this.titleLoadState = 'failed'; resolve(false); };
                try { loader.once('complete', onComplete); } catch {}
                try { loader.once('loaderror', onError); } catch {}
                try { loader.start(); } catch {}
            } catch (e) {
                console.warn('[BigWinOverlay] Title dynamic load failed:', e);
                this.titleLoadState = 'failed';
                resolve(false);
            }
        });
    }

    private loadFireSpineIfNeeded(): Promise<boolean> {
        if (!this.scene) return Promise.resolve(false);
        if (this.fireSpineLoadState === 'loaded') return Promise.resolve(true);
        if (this.fireSpineLoadState === 'failed') return Promise.resolve(false);
        if (this.fireSpineLoadState === 'loading' && this.fireLoadPromise) return this.fireLoadPromise;

        this.fireSpineLoadState = 'loading';
        this.fireLoadPromise = new Promise<boolean>((resolve) => {
            try {
                if (!ensureSpineLoader(this.scene!, '[BigWinOverlay] fire dynamic load')) {
                    this.fireSpineLoadState = 'failed';
                    resolve(false);
                    return;
                }
                const loader = (this.scene as any).load;
                try { loader?.spineAtlas?.('overlay_fire_atlas', '/assets/animations/Fire/fireanimation01_HTBH.atlas'); } catch {}
                try { loader?.spineJson?.('overlay_fire', '/assets/animations/Fire/fireanimation01_HTBH.json'); } catch {}

                const onComplete = () => { this.fireSpineLoadState = 'loaded'; resolve(true); };
                const onError = () => { this.fireSpineLoadState = 'failed'; resolve(false); };
                try { (this.scene as any).load?.once('complete', onComplete); } catch {}
                try { (this.scene as any).load?.once('loaderror', onError); } catch {}
                try { (this.scene as any).load?.start(); } catch {}
            } catch (e) {
                console.warn('[BigWinOverlay] Fire spine dynamic load failed:', e);
                this.fireSpineLoadState = 'failed';
                resolve(false);
            }
        });
        return this.fireLoadPromise;
    }

    private clearAnimations(): void {
        if (!this.animations) return;
        for (const t of this.animations) {
            try { if (t && !t.isDestroyed()) t.remove(); } catch {}
        }
        this.animations = [];
    }

    /**
     * Start an infinite gentle idle animation for title image and fire.
     */
    private startIdleAnimation(): void {
        if (!this.scene || this.isIdleAnimating) return;
        this.isIdleAnimating = true;

        // Title image breathing (like PickACard)
        if (this.titleImage) {
            const clamp = (v: number) => Math.min(this.titleScaleMax, Math.max(this.titleScaleMin, v));
            const titlePulse = this.scene.tweens.add({
                targets: this.titleImage,
                scaleX: clamp(this.pickScale * this.idlePulseScale),
                scaleY: clamp(this.pickScale * this.idlePulseScale),
                duration: this.idlePulseDuration,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                yoyoDelay: 80,
                repeatDelay: 120
            });
            this.animations.push(titlePulse);
        }

        // Fire title subtle counter-breath
        if (this.winFont) {
                
            const firePulse = this.scene.tweens.add({
                targets: this.winFont,
                scaleX: this.fireScale * (1.0),
                scaleY: this.fireScale * (1.0),
                duration: this.idlePulseDuration,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: this.idlePulseDuration * 0.5
            });
            this.animations.push(firePulse);
        }
    }

    /**
     * Configure min/max scale bounds for the Big Win PNG title.
     */
    public setTitleScaleBounds(minScale: number, maxScale: number): void {
        this.titleScaleMin = Math.max(0.01, Math.min(minScale, maxScale));
        this.titleScaleMax = Math.max(this.titleScaleMin, maxScale);
        // Apply immediately if title exists
        if (this.titleImage) {
            const clamp = (v: number) => Math.min(this.titleScaleMax, Math.max(this.titleScaleMin, v));
            try { this.titleImage.setScale(clamp(this.pickScale)); } catch {}
        }
    }

    /**
     * Optional direct control over base title scale (same as PickACard concept).
     */
    public setPickScale(scale: number = 0.4): void {
        this.pickScale = Math.max(0.05, scale);
        if (this.titleImage) {
            const clamp = (v: number) => Math.min(this.titleScaleMax, Math.max(this.titleScaleMin, v));
            try { this.titleImage.setScale(clamp(this.pickScale)); } catch {}
        }
    }

    public destroy(): void {
        try {
            this.clearAnimations();
            if (this.background) { this.background.off('pointerdown'); this.background.destroy(); this.background = null; }
            if (this.fireContainer) { this.fireContainer.destroy(true); this.fireContainer = null; }
            if (this.amountContainer) { this.amountContainer.destroy(true); this.amountContainer = null; }
            if (this.titleImage) { this.titleImage.destroy(); this.titleImage = null; }
            if (this.numberDisplay) { this.numberDisplay.destroy(); this.numberDisplay = null; }
            if (this.winFont) { try { this.winFont.destroy?.(); } catch {} this.winFont = null; }
            if (this.container) { this.container.destroy(true); this.container = null; }
            this.scene = null;
            this.isInitialized = false;
            this.isShowing = false;
        } catch (e) {
            console.error('Error destroying BigWinOverlay:', e);
        }
    }
}


