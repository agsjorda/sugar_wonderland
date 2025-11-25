import { Scene } from 'phaser';
import { ensureSpineLoader, ensureSpineFactory, isSpineAssetCached } from '../../utils/SpineGuard';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { MusicType } from '../../managers/AudioManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { resolveAssetUrl } from '../../utils/AssetLoader';

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
    private showBuildTimer: Phaser.Time.TimerEvent | null = null;
    private prevMusicType: MusicType | null = null;
    private hasStoppedBigWinMusic: boolean = false;
    private isTransitioning: boolean = false;
    private hasEmittedWinStop: boolean = false;
    private transitionContainer: Phaser.GameObjects.Container | null = null;
    private transitionBg: Phaser.GameObjects.Rectangle | null = null;
    private transitionSpine: any | null = null;
    private fireTransitionLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private fireTransitionLoadPromise: Promise<boolean> | null = null;
    private fireTransitionTimeScale: number = 0.85;

    // Managers needed by NumberDisplay
    private networkManager: NetworkManager | null = null;
    private screenModeManager: ScreenModeManager | null = null;

    // Layout ratios
    private firePosRatio = { x: 0.5, y: 0.18 };
    private titlePosRatio = { x: 0.5, y: 0.26 };
    private amountPosRatio = { x: 0.5, y: 0.44 };
    private continuePosRatio = { x: 0.5, y: 0.58 };

    private fireScale: number = 0.6; // match ScatterWinOverlay default
    private pickScale: number = 0.8; // default base scale for Big Win title
    private isIdleAnimating: boolean = false;
    private idlePulseScale: number = 1.16;
    private idlePulseDuration: number = 700;
    // Bounds for title PNG scaling (clamped everywhere)
    private titleScaleMin: number = 0.2;
    private titleScaleMax: number = 1.4;
    private amountScale: number = 0.31;

    // Bottom corner fire (like ScatterWinOverlay)
    private bottomFireContainer: Phaser.GameObjects.Container | null = null;
    private mainFireSpines: any[] = [];
    private mainFireLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private mainFireLoadPromise: Promise<boolean> | null = null;
    private mainFireHeightScale: number = 1.1;
    private bottomLeftFireMarginX: number = -90;
    private bottomLeftFireMarginY: number = 6;
    private bottomLeftFireRotationDeg: number = 20;
    private bottomLeftFireScaleMul: number = 1.8;
    private bottomRightFireMarginX: number = 0;
    private bottomRightFireMarginY: number = 0;
    private bottomRightFireRotationDeg: number = -20;
    private bottomRightFireScaleMul: number = 1.8;
    private bottomLeftFireOffsetX: number = -160;
    private bottomLeftFireOffsetY: number = 20;
    private bottomRightFireOffsetX: number = 160;
    private bottomRightFireOffsetY: number = 20;

    private fireSpineLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private fireLoadPromise: Promise<boolean> | null = null;
    private titleLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
    private titleKey: string = 'big_win_title_png';
    private getAssetPrefix(): string {
        try {
            const sm = this.screenModeManager as any;
            const nm = this.networkManager as any;
            const isPortrait = !!sm?.getScreenConfig?.().isPortrait;
            const isHigh = !!nm?.getNetworkSpeed?.();
            const orientation = isPortrait ? 'portrait' : 'landscape';
            const quality = isHigh ? 'high' : 'low';
            return `assets/${orientation}/${quality}`;
        } catch { return 'assets/portrait/high'; }
    }

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
        this.bottomFireContainer = this.scene.add.container(0, 0);
        this.bottomFireContainer.setAlpha(0);

        this.container.add([
            this.background,
            this.fireContainer,
            this.amountContainer,
            this.bottomFireContainer
        ]);

        // Create transition container above everything
        this.transitionContainer = this.scene.add.container(0, 0);
        this.transitionContainer.setDepth(20000);
        this.transitionContainer.setVisible(false);

        this.background.on('pointerdown', (_p: any, _x: number, _y: number, event: any) => {
            try { event?.stopPropagation?.(); } catch {}
            // Ensure Big Win BGM is halted immediately on user click
            try {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.stopMusicByType === 'function') {
                    audio.stopMusicByType(MusicType.BIG_WIN);
                }
                this.hasStoppedBigWinMusic = true;
            } catch {}
            // Start fullscreen Fire_Transition overlay immediately; let it overlap fade
            this.isTransitioning = true;
            this.playFireTransitionThenFinish(() => {
                // After transition completes, restore previous music and finalize
                try {
                    const audio = (window as any).audioManager;
                    if (audio) {
                        if (typeof audio.unlockMusic === 'function') audio.unlockMusic();
                        if (this.prevMusicType && typeof audio.setExclusiveBackground === 'function') {
                            audio.setExclusiveBackground(this.prevMusicType);
                        } else if (typeof audio.stopAllMusic === 'function') {
                            audio.stopAllMusic();
                        }
                        this.prevMusicType = null;
                    }
                } catch {}
                this.isTransitioning = false;
            });
            // Begin fading out overlay visuals underneath
            this.hide();
        });

        this.markPreloadedSpines();
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
        try { this.container.setAlpha(1); } catch {}
        this.hasEmittedWinStop = false;

        // Switch background music exclusively to Big Win
        try {
            const audio = (window as any).audioManager;
            if (audio) {
                try { this.prevMusicType = typeof audio.getCurrentMusicType === 'function' ? audio.getCurrentMusicType() : null; } catch {}
                if (typeof audio.lockMusicTo === 'function') audio.lockMusicTo(MusicType.BIG_WIN);
                if (typeof audio.setExclusiveBackground === 'function') audio.setExclusiveBackground(MusicType.BIG_WIN);
                this.hasStoppedBigWinMusic = false;
            }
        } catch {}

        // Reset
        this.clearAnimations();
        if (this.titleImage) { try { this.titleImage.destroy(); } catch {} this.titleImage = null; }
        if (this.numberDisplay) { try { this.numberDisplay.destroy(); } catch {} this.numberDisplay = null; }
        if (this.continueText) { try { this.continueText.destroy(); } catch {} this.continueText = null; }
        if (this.winFont) { try { this.winFont.destroy?.(); } catch {} this.winFont = null; }
        try { this.fireContainer?.removeAll(true); } catch {}
        try { this.amountContainer?.removeAll(true); } catch {}
        try { this.fireContainer?.setAlpha(1); } catch {}
        try { this.amountContainer?.setAlpha(1); } catch {}
        try {
            if (this.bottomFireContainer) {
                this.bottomFireContainer.removeAll(true);
                this.bottomFireContainer.setAlpha(0);
            }
            this.mainFireSpines = [];
        } catch {}

        this.background.setFillStyle(color, 1);
        this.background.setAlpha(0);

        // Fade in background
        const bgTween = this.scene.tweens.add({
            targets: this.background,
            alpha: alpha,
            duration: durationMs,
            ease: 'Cubic.easeOut',
            onComplete: () => { try { this.showMainFire(); } catch {} }
        });
        this.animations.push(bgTween);

        // Load assets, then build visuals (store timer so we can cancel on hide)
        if (this.showBuildTimer) { try { this.showBuildTimer.remove(false); } catch {} this.showBuildTimer = null; }
        this.showBuildTimer = this.scene.time.delayedCall(120, async () => {
            if (!this.scene || !this.isShowing) return;
            const [fireReady, titleReady] = await Promise.all([
                this.loadFireSpineIfNeeded(),
                this.loadTitleIfNeeded()
            ]);
            if (!this.scene || !this.isShowing) return;

            // Fire spine (preferred), with PNG fallback to match ScatterWinOverlay behavior
            let overlayFireCreated = false;
            if (fireReady) {
                overlayFireCreated = this.tryCreateOverlayFireSpine();
            }
            if (!overlayFireCreated) {
                this.createOverlayFireFallbackImage();
            }

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

            // No starburst background for Big Win overlay

            // Show animations
            if (this.winFont) {
                const fireTween = this.scene.tweens.add({
                    targets: this.winFont,
                    alpha: 1,
                    // Keep fire at its base scale so only the title appears larger
                    scaleX: this.fireScale * 1.1,
                    scaleY: this.fireScale * 1.1,
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
                    scaleX: clamp(this.pickScale * 1.2),
                    scaleY: clamp(this.pickScale * 1.2),
                    duration: 500,
                    ease: 'Back.easeOut',
                    delay: 300, // mirror ScatterWinOverlay timing for PickACard
                    onComplete: () => {
                        if (!this.scene || !this.titleImage) return;
                        this.scene.tweens.add({
                            targets: this.titleImage,
                            scaleX: clamp(this.pickScale),
                            scaleY: clamp(this.pickScale),
                            duration: 260,
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
                spacing: -80,
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
            // Fit number width responsively (similar to Congrats overlay) – slightly larger, tighter spacing
            try {
                const targetWidth = this.scene.cameras.main.width * 0.66; // occupy more width for larger digits
                const minScale = 0.16;
                const maxScale = 0.34;
                const numContainer = this.numberDisplay.getContainer();
                // Measure at scale 1 to get raw width
                (numContainer as any).setScale?.(1, 1);
                const bounds = (numContainer as any).getBounds?.();
                const rawWidth = bounds?.width || 1;
                let fitScale = targetWidth / rawWidth;
                fitScale = Math.max(minScale, Math.min(maxScale, fitScale));
                (numContainer as any).setScale?.(fitScale, fitScale);
                (numContainer as any).setPosition?.(amountConfig.x, amountConfig.y);
            } catch {}

            // Reset to 0 and animate count-up to final amount
            try { this.numberDisplay.displayValue(0); } catch {}

            const amountFade = this.scene.tweens.add({
                targets: this.numberDisplay.getContainer(),
                alpha: 1,
                duration: 600,
                ease: 'Power2',
                delay: 420
            });
            this.animations.push(amountFade);

            // Count-up animation to final amount
            try {
                const startValue = 0;
                const endValue = amount;
                const durationMs = 1200;
                const dp = amountConfig.decimalPlaces ?? 2;
                const counter = { v: startValue } as any;
                const tween = this.scene.tweens.add({
                    targets: counter,
                    v: endValue,
                    duration: durationMs,
                    ease: 'Cubic.easeOut',
                    delay: 420,
                    onUpdate: () => {
                        try {
                            const val = Math.max(0, counter.v);
                            const rounded = Number(val.toFixed(dp));
                            this.numberDisplay?.displayValue(rounded);
                        } catch {}
                    },
                    onComplete: () => {
                        try { this.numberDisplay?.displayValue(endValue); } catch {}
                    }
                });
                this.animations.push(tween);
            } catch {}

            // No starburst animations

            // Continue text (match style from other overlays)
            this.continueText = this.scene.add.text(
                this.scene.cameras.main.width * this.continuePosRatio.x,
                this.scene.cameras.main.height * this.continuePosRatio.y,
                'Press anywhere to continue',
                {
                    fontFamily: 'Poppins-SemiBold, Poppins-Regular, Arial, sans-serif',
                    fontSize: '20px',
                    color: '#FFFFFF',
                    align: 'center'
                }
            );
            this.continueText.setOrigin(0.5, 0.5);
            this.continueText.setAlpha(0);
            try { this.continueText.setStroke('#379557', 4); } catch {}
            try { this.continueText.setShadow(0, 2, '#000000', 4, true, true); } catch {}
            this.container?.add(this.continueText);
            const hintFade = this.scene.tweens.add({
                targets: this.continueText,
                alpha: 1,
                duration: 500,
                delay: 1500,
                ease: 'Power2'
            });
            this.animations.push(hintFade);

            // No sparkles for Big Win overlay

            // No generic win SFX here; Big Win overlay has its own background music

            if (this.onCompleteCallback) this.onCompleteCallback();
        });

        // If turbo is enabled, auto-dismiss after ~3s
        try {
            const isTurbo = !!(((window as any)?.gameStateManager?.isTurbo) || ((this.scene as any)?.gameData?.isTurbo));
            if (isTurbo) {
                this.scene.time.delayedCall(3000, () => {
                    if (!this.scene || !this.isShowing) return;
                    try { this.hide(150); } catch {}
                });
            }
        } catch {}
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
        // Cancel any pending delayed build so it doesn't race after hide
        if (this.showBuildTimer) { try { this.showBuildTimer.remove(false); } catch {} this.showBuildTimer = null; }

        // Immediately stop Big Win music on early dismissal
        try {
            if (!this.hasStoppedBigWinMusic) {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.stopMusicByType === 'function') {
                    audio.stopMusicByType(MusicType.BIG_WIN);
                }
                this.hasStoppedBigWinMusic = true;
            }
        } catch {}

        this.scene.tweens.add({
            targets: [
                this.background,
                this.fireContainer,
                this.bottomFireContainer,
                this.titleImage,
                this.amountContainer,
                this.continueText,
                this.winFont
            ].filter(Boolean) as any,
            alpha: 0,
            duration,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                // Restore previous background music
                try {
                    const audio = (window as any).audioManager;
                    if (audio) {
                        // Ensure Big Win track is stopped explicitly
                        if (typeof audio.stopMusicByType === 'function') audio.stopMusicByType(MusicType.BIG_WIN);
                        // If transition is running, defer restoration to its callback
                        if (!this.isTransitioning) {
                            if (typeof audio.unlockMusic === 'function') audio.unlockMusic();
                            if (this.prevMusicType && typeof audio.setExclusiveBackground === 'function') {
                                audio.setExclusiveBackground(this.prevMusicType);
                            } else if (typeof audio.stopAllMusic === 'function') {
                                audio.stopAllMusic();
                            }
                            this.prevMusicType = null;
                        }
                    }
                } catch {}
                // Clear bottom fire spines to force a clean rebuild on next show
                try {
                    if (this.mainFireSpines && this.mainFireSpines.length) {
                        for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} }
                        this.mainFireSpines = [];
                    }
                    this.bottomFireContainer?.removeAll(true);
                    this.bottomFireContainer?.setAlpha(0);
                } catch {}
                if (this.container) this.container.setVisible(false);
                this.isShowing = false;
                this.clearAnimations();
                if (this.dismissResolver) { const r = this.dismissResolver; this.dismissResolver = undefined; r(); }
                try {
                    if (!this.hasEmittedWinStop) {
                        gameEventManager.emit(GameEventType.WIN_STOP);
                        this.hasEmittedWinStop = true;
                    }
                } catch {}
                // Notify dialog completion for bonus/auto flows
                // Also notify dialog completion for bonus manager
                try { (this.scene as any).events?.emit('dialogAnimationsComplete'); } catch {}
                // Emit win dialog closed event for bonus/autoplay flows
                try { gameEventManager.emit(GameEventType.WIN_DIALOG_CLOSED); } catch {}
                if (onComplete) onComplete();
            }
        });
    }

    // Load Fire_Transition spine dynamically
    private loadFireTransitionIfNeeded(): Promise<boolean> {
        if (!this.scene) return Promise.resolve(false);
        if (this.fireTransitionLoadState === 'loaded') return Promise.resolve(true);
        if (this.fireTransitionLoadState === 'failed') return Promise.resolve(false);
        if (this.fireTransitionLoadState === 'loading' && this.fireTransitionLoadPromise) return this.fireTransitionLoadPromise;

        this.fireTransitionLoadState = 'loading';
        this.fireTransitionLoadPromise = new Promise<boolean>((resolve) => {
            try {
                if (!ensureSpineLoader(this.scene!, '[BigWinOverlay] fire transition dynamic load')) {
                    this.fireTransitionLoadState = 'failed';
                    resolve(false);
                    return;
                }
                const loader = (this.scene as any).load;
                const prefix = this.getAssetPrefix();
                try { loader?.spineAtlas?.('fire_transition_atlas', resolveAssetUrl(`${prefix}/fire_animations/Fire_Transition.atlas`)); } catch {}
                try { loader?.spineJson?.('fire_transition', resolveAssetUrl(`${prefix}/fire_animations/Fire_Transition.json`)); } catch {}

                const onComplete = () => { this.fireTransitionLoadState = 'loaded'; resolve(true); };
                const onError = () => { this.fireTransitionLoadState = 'failed'; resolve(false); };
                try { (this.scene as any).load?.once('complete', onComplete); } catch {}
                try { (this.scene as any).load?.once('loaderror', onError); } catch {}
                try { (this.scene as any).load?.start(); } catch {}
            } catch (e) {
                console.warn('[BigWinOverlay] Fire_Transition dynamic load failed:', e);
                this.fireTransitionLoadState = 'failed';
                resolve(false);
            }
        });
        return this.fireTransitionLoadPromise;
    }

    // Play Fire_Transition overlay covering the full viewport, then invoke callback
    private async playFireTransitionThenFinish(onFinished?: () => void): Promise<void> {
        if (!this.scene || !this.transitionContainer) return;
        if (!ensureSpineFactory(this.scene, '[BigWinOverlay] fire transition factory')) {
            if (onFinished) onFinished();
            return;
        }
        const loaded = await this.loadFireTransitionIfNeeded();
        if (!loaded) {
            if (onFinished) onFinished();
            return;
        }

        try {
            // Ensure container visible and on top
            this.transitionContainer.setVisible(true);
            this.transitionContainer.setAlpha(1);
            try { this.scene.children.bringToTop(this.transitionContainer); } catch {}

            // Create/ensure background mask
            if (!this.transitionBg) {
                this.transitionBg = this.scene.add.rectangle(
                    this.scene.cameras.main.width / 2,
                    this.scene.cameras.main.height / 2,
                    this.scene.cameras.main.width * 2,
                    this.scene.cameras.main.height * 2,
                    0x000000,
                    0
                );
                this.transitionBg.setOrigin(0.5);
                try { this.transitionBg.setInteractive(); } catch {}
                this.transitionContainer.add(this.transitionBg);
            } else {
                this.transitionBg.setAlpha(0);
            }

            // Destroy previous spine if any
            try { this.transitionSpine?.destroy?.(); } catch {}
            this.transitionSpine = (this.scene.add as any).spine(
                this.scene.cameras.main.width * 0.5,
                this.scene.cameras.main.height * 0.5,
                'fire_transition',
                'fire_transition_atlas'
            );
            try { this.transitionSpine.setOrigin(0.5, 0.5); } catch {}
            try { (this.transitionSpine as any).setDepth?.(1); } catch {}
            try { (this.transitionSpine as any).setScrollFactor?.(0); } catch {}
            try { this.transitionContainer.setScrollFactor?.(0); } catch {}
            try { this.transitionBg.setScrollFactor?.(0); } catch {}
            this.transitionContainer.add(this.transitionSpine);

            // Scale to cover viewport generously
            try {
                const w = this.scene.cameras.main.width;
                const h = this.scene.cameras.main.height;
                let bw = 0, bh = 0;
                try {
                    const b = this.transitionSpine.getBounds();
                    bw = (b && (b.size?.x || (b as any).width)) || 0;
                    bh = (b && (b.size?.y || (b as any).height)) || 0;
                } catch {}
                if (bw > 0 && bh > 0) {
                    const cover = Math.max(w / bw, h / bh) * 2.0;
                    // Make it taller vertically to eliminate top/bottom gaps
                    const xScale = cover;
                    const yScale = cover * 1.25;
                    this.transitionSpine.setScale(xScale, yScale);
                    // Nudge upward if needed so the top extends beyond the viewport edge
                    try {
                        const bounds = this.transitionSpine.getBounds();
                        const offY = (bounds && (bounds.offset?.y || (bounds as any).y)) || 0;
                        const sY = (this.transitionSpine.scaleY || this.transitionSpine.scale || 1);
                        const topWorld = (this.transitionSpine.y || 0) + offY * sY;
                        const pad = Math.max(12, h * 0.02);
                        if (topWorld > -pad) {
                            const dy = topWorld + pad; // move up so top is off-screen slightly
                            this.transitionSpine.y = (this.transitionSpine.y || 0) - dy;
                        }
                    } catch {}
                }
            } catch {}

            // Time scale
            try { (this.transitionSpine as any).animationState.timeScale = Math.max(0.05, this.fireTransitionTimeScale || 1.0); } catch {}

            // Play SFX for transition
            try {
                const audio = (window as any).audioManager;
                if (audio && typeof audio.playSoundEffect === 'function') {
                    audio.playSoundEffect('blaze_hh' as any);
                } else {
                    // Fallback direct play
                    try { (this.scene as any).sound?.play?.('blaze_hh'); } catch {}
                }
            } catch {}

            // Play transition and cleanup after
            let finished = false;
            const finish = () => {
                if (finished) return; finished = true;
                try {
                    this.scene?.tweens.add({
                        targets: this.transitionContainer,
                        alpha: 0,
                        duration: 200,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            try {
                                this.transitionContainer?.setVisible(false);
                                this.transitionContainer?.setAlpha(1);
                                if (this.transitionSpine) { this.transitionSpine.destroy(); this.transitionSpine = null; }
                                if (this.transitionBg) { this.transitionBg.setAlpha(0); }
                            } catch {}
                            // Emit WIN_STOP if not already emitted
                            try {
                                if (!this.hasEmittedWinStop) {
                                    gameEventManager.emit(GameEventType.WIN_STOP);
                                    this.hasEmittedWinStop = true;
                                }
                            } catch {}
                            if (onFinished) onFinished();
                        }
                    });
                } catch { if (onFinished) onFinished(); }
            };

            try {
                const state = (this.transitionSpine as any).animationState;
                let played = false;
                let entry: any = null;
                try { entry = state.setAnimation(0, 'animation', false); played = true; } catch {}
                if (!played) {
                    try {
                        const anims = (this.transitionSpine as any)?.skeleton?.data?.animations || [];
                        const first = anims[0]?.name;
                        if (first) { entry = state.setAnimation(0, first, false); played = true; }
                    } catch {}
                }
                // Fallback completion
                const rawDurationSec = Math.max(0.1, entry?.animation?.duration || 1.2);
                const durMs = Math.max(200, (rawDurationSec / Math.max(0.0001, this.fireTransitionTimeScale || 1.0)) * 1000);
                this.scene.time.delayedCall(durMs + 50, finish);
                try { state?.setListener?.({ complete: finish } as any); } catch {}
            } catch { finish(); }
        } catch { if (onFinished) onFinished(); }
    }

    public waitUntilDismissed(): Promise<void> {
        if (!this.isShowing) return Promise.resolve();
        return new Promise<void>((resolve) => { this.dismissResolver = resolve; });
    }

    public getIsShowing(): boolean {
        return this.isShowing;
    }

    private async loadTitleIfNeeded(): Promise<boolean> {
        if (!this.scene) return false;
        // If already in texture cache, mark as loaded and return
        try { if ((this.scene as any).textures?.exists?.(this.titleKey)) { this.titleLoadState = 'loaded'; return true; } } catch {}
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
                    const prefix = this.getAssetPrefix();
                    try { loader.image(this.titleKey, resolveAssetUrl(`${prefix}/dialogs/big-win.png`)); } catch {}
                }
                const onComplete = () => {
                    try {
                        const ok = (this.scene as any).textures?.exists?.(this.titleKey);
                        this.titleLoadState = ok ? 'loaded' : 'failed';
                        resolve(!!ok);
                    } catch { this.titleLoadState = 'failed'; resolve(false); }
                };
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

    // no star loading required

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
                const prefix = this.getAssetPrefix();
                try { loader?.spineAtlas?.('overlay_fire_atlas', resolveAssetUrl(`${prefix}/fire_animations/fireanimation01_HTBH.atlas`)); } catch {}
                try { loader?.spineJson?.('overlay_fire', resolveAssetUrl(`${prefix}/fire_animations/fireanimation01_HTBH.json`)); } catch {}

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

    // Load Main_Fire assets dynamically
    private loadMainFireIfNeeded(): Promise<boolean> {
        if (!this.scene) return Promise.resolve(false);
        if (this.mainFireLoadState === 'loaded') return Promise.resolve(true);
        if (this.mainFireLoadState === 'failed') return Promise.resolve(false);
        if (this.mainFireLoadState === 'loading' && this.mainFireLoadPromise) return this.mainFireLoadPromise;

        this.mainFireLoadState = 'loading';
        this.mainFireLoadPromise = new Promise<boolean>((resolve) => {
            try {
                if (!ensureSpineLoader(this.scene!, '[BigWinOverlay] main fire dynamic load')) {
                    this.mainFireLoadState = 'failed';
                    resolve(false);
                    return;
                }
                const loader = (this.scene as any).load;
                const prefix = this.getAssetPrefix();
                try { loader?.spineAtlas?.('main_fire_atlas', resolveAssetUrl(`${prefix}/fire_animations/Main_Fire.atlas`)); } catch {}
                try { loader?.spineJson?.('main_fire', resolveAssetUrl(`${prefix}/fire_animations/Main_Fire.json`)); } catch {}

                const onComplete = () => { this.mainFireLoadState = 'loaded'; resolve(true); };
                const onError = () => { this.mainFireLoadState = 'failed'; resolve(false); };
                try { (this.scene as any).load?.once('complete', onComplete); } catch {}
                try { (this.scene as any).load?.once('loaderror', onError); } catch {}
                try { (this.scene as any).load?.start(); } catch {}
            } catch (e) {
                console.warn('[BigWinOverlay] Main_Fire dynamic load failed:', e);
                this.mainFireLoadState = 'failed';
                resolve(false);
            }
        });
        return this.mainFireLoadPromise;
    }

    // Create and show Main_Fire at bottom corners
    private async showMainFire(): Promise<void> {
        if (!this.scene || !this.bottomFireContainer) return;
        if (!ensureSpineFactory(this.scene, '[BigWinOverlay] main fire factory')) return;
        const loaded = await this.loadMainFireIfNeeded();
        if (!loaded) return;

        try {
            // Clear any previous main fire instances
            if (this.mainFireSpines && this.mainFireSpines.length) {
                for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} }
                this.mainFireSpines = [];
            }

            const w = this.scene.cameras.main.width;
            const h = this.scene.cameras.main.height;
            const leftBaseX = Math.max(0, this.bottomLeftFireMarginX);
            const rightBaseX = Math.max(0, w - this.bottomRightFireMarginX);
            const baseY = Math.max(0, h - Math.max(this.bottomLeftFireMarginY, this.bottomRightFireMarginY));
            const leftTargetX = leftBaseX + (this.bottomLeftFireOffsetX || 0);
            const rightTargetX = rightBaseX + (this.bottomRightFireOffsetX || 0);
            const leftTargetY = baseY + (this.bottomLeftFireOffsetY || 0);
            const rightTargetY = baseY + (this.bottomRightFireOffsetY || 0);
            const startY = h + 80;

            const left = (this.scene.add as any).spine(leftTargetX, startY, 'main_fire', 'main_fire_atlas');
            const right = (this.scene.add as any).spine(rightTargetX, startY, 'main_fire', 'main_fire_atlas');
            try { (left as any).setOrigin?.(0.0, 1.0); } catch {}
            try { (right as any).setOrigin?.(1.0, 1.0); } catch {}
            try { (left as any).setAngle?.(this.bottomLeftFireRotationDeg || 0); } catch {}
            try { (right as any).setAngle?.(this.bottomRightFireRotationDeg || 0); } catch {}
            this.bottomFireContainer.add(left);
            this.bottomFireContainer.add(right);
            this.mainFireSpines = [left, right];
            try { this.container?.bringToTop(this.bottomFireContainer); } catch {}

            // Play loop animations
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

            // Fit each to half screen width, apply height and side multipliers
            this.bottomFireContainer.setAlpha(0);
            this.scene.time.delayedCall(0, () => {
                if (!this.scene || !this.isShowing) return;
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
                            const uniform = desiredScale * Math.max(0.1, mul || 1);
                            const yScale = uniform * Math.max(0.1, this.mainFireHeightScale || 1);
                            sp.setScale(uniform, yScale);
                        }
                    } catch {}
                };
                fitHalf(left, this.bottomLeftFireScaleMul || 1);
                fitHalf(right, this.bottomRightFireScaleMul || 1);

                // Slide to targets and fade container in
                this.scene?.tweens.add({ targets: left, x: leftTargetX, y: leftTargetY, duration: 450, ease: 'Cubic.easeOut' });
                this.scene?.tweens.add({ targets: right, x: rightTargetX, y: rightTargetY, duration: 450, ease: 'Cubic.easeOut' });
                this.scene?.tweens.add({ targets: this.bottomFireContainer, alpha: 1, duration: 250, ease: 'Cubic.easeOut' });
            });
        } catch (e) {
            console.warn('[BigWinOverlay] Failed to show Main_Fire spine:', e);
        }
    }

    private clearAnimations(): void {
        if (!this.animations) return;
        for (const t of this.animations) {
            try { if (t && !t.isDestroyed()) t.remove(); } catch {}
        }
        this.animations = [];
    }

    private markPreloadedSpines(): void {
        if (!this.scene) return;
        if (isSpineAssetCached(this.scene, 'overlay_fire', 'overlay_fire_atlas')) {
            this.fireSpineLoadState = 'loaded';
        }
        if (isSpineAssetCached(this.scene, 'main_fire', 'main_fire_atlas')) {
            this.mainFireLoadState = 'loaded';
        }
        if (isSpineAssetCached(this.scene, 'fire_transition', 'fire_transition_atlas')) {
            this.fireTransitionLoadState = 'loaded';
        }
    }

    /** Attempt to create the overlay fire as a Spine object. Returns true on success. */
    private tryCreateOverlayFireSpine(): boolean {
        if (!this.scene) return false;
        if (!ensureSpineFactory(this.scene, '[BigWinOverlay] overlay fire factory')) return false;
        try {
            const spineObj = (this.scene.add as any).spine(
                this.scene.cameras.main.width * this.firePosRatio.x,
                this.scene.cameras.main.height * this.firePosRatio.y,
                'overlay_fire',
                'overlay_fire_atlas'
            );
            if (!spineObj) return false;
            this.winFont = spineObj;
            try { spineObj.setOrigin(0.5, 0.5); } catch {}
            try { spineObj.setScale(0); } catch {}
            try { spineObj.setAlpha(0); } catch {}
            this.fireContainer?.add(spineObj);
            return true;
        } catch (e) {
            console.warn('[BigWinOverlay] Failed creating overlay fire spine instance:', e);
            return false;
        }
    }

    /** Create a static PNG fallback for the overlay fire if Spine is unavailable. */
    private createOverlayFireFallbackImage(): void {
        if (!this.scene) return;
        try {
            const texExists = (this.scene as any).textures?.exists?.('fireanimation01_HTBH_img');
            if (!texExists) return;
            const img = this.scene.add.image(
                this.scene.cameras.main.width * this.firePosRatio.x,
                this.scene.cameras.main.height * this.firePosRatio.y,
                'fireanimation01_HTBH_img'
            );
            img.setOrigin(0.5, 0.5);
            img.setScale(0);
            img.setAlpha(0);
            this.fireContainer?.add(img);
            this.winFont = img;
        } catch {}
    }

    // no sparkles

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
                yoyoDelay: 40,
                repeatDelay: 70
            });
            this.animations.push(titlePulse);
        }

        // Fire title subtle counter-breath (match ScatterWinOverlay subtle amplitude)
        if (this.winFont) {
            const subtle = 0.015;
            const firePulse = this.scene.tweens.add({
                targets: this.winFont,
                scaleX: this.fireScale * (1.0 - subtle),
                scaleY: this.fireScale * (1.0 - subtle),
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
    public setPickScale(scale: number = 0.7): void {
        this.pickScale = Math.max(0.05, scale);
        if (this.titleImage) {
            const clamp = (v: number) => Math.min(this.titleScaleMax, Math.max(this.titleScaleMin, v));
            try { this.titleImage.setScale(clamp(this.pickScale)); } catch {}
        }
    }

    /**
     * Alias for clarity: adjust Big Win title image base scale.
     */
    public setTitleScale(scale: number = 0.7): void {
        this.setPickScale(scale);
    }

    /**
     * Adjust the fire (Spine title) base scale at runtime.
     */
    public setFireScale(scale: number = 0.6): void {
        this.fireScale = Math.max(0.05, scale);
        if (this.winFont) {
            try { (this.winFont as any).setScale?.(this.fireScale); } catch {}
        }
    }

    public destroy(): void {
        try {
            this.clearAnimations();
            if (this.background) { this.background.off('pointerdown'); this.background.destroy(); this.background = null; }
            if (this.fireContainer) { this.fireContainer.destroy(true); this.fireContainer = null; }
            if (this.bottomFireContainer) { try { this.bottomFireContainer.destroy(true); } catch {} this.bottomFireContainer = null; }
            if (this.mainFireSpines && this.mainFireSpines.length) { for (const s of this.mainFireSpines) { try { s.destroy(); } catch {} } this.mainFireSpines = []; }
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


