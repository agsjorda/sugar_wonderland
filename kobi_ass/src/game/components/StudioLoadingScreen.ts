import { Scene } from 'phaser';
import { ensureSpineLoader } from '../../utils/SpineGuard';
import { getMilitaryTime } from '../../utils/TimeUtils';

export interface StudioLoadingScreenOptions {
    loadingFrameOffsetX?: number;
    loadingFrameOffsetY?: number;
    loadingFrameScaleModifier?: number;
    text?: string;
    textOffsetX?: number;
    textOffsetY?: number;
    textScale?: number;
    textColor?: string;
    text2?: string;
    text2OffsetX?: number;
    text2OffsetY?: number;
    text2Scale?: number;
    text2Color?: string;
    showTime?: boolean;
    timeOffsetX?: number;
    timeOffsetY?: number;
    timeScale?: number;
    timeColor?: string;
}

export class StudioLoadingScreen {
    private scene: Scene;
    private container: Phaser.GameObjects.Container;
    private shownAtMs: number = 0;
    private spine?: any;
    private bg?: Phaser.GameObjects.Rectangle;
    private loadingFrame?: Phaser.GameObjects.Image;
    private text?: Phaser.GameObjects.Text;
    private text2?: Phaser.GameObjects.Text;
    private timeText?: Phaser.GameObjects.Text;
    private timeUpdateTimer?: Phaser.Time.TimerEvent;
    private progressBarBg?: Phaser.GameObjects.Graphics;
    private progressBarFill?: Phaser.GameObjects.Graphics;
	private progressBarX?: number;
    private progressBarY?: number;
    private progressBarWidth?: number;
    private progressBarHeight?: number;
    private progressBarPadding: number = 3;
    private onProgressHandler?: (progress: number) => void;
    private options: StudioLoadingScreenOptions;
    private dotGrid?: Phaser.GameObjects.Graphics;

    constructor(scene: Scene, options?: StudioLoadingScreenOptions) {
        this.scene = scene;
        this.container = scene.add.container(0, 0);
        this.container.setDepth(999);
        this.options = options || {
            loadingFrameOffsetX: 0,
            loadingFrameOffsetY: 0,
            loadingFrameScaleModifier: 1.0,
            text: 'Play Loud. Win Wild. DiJoker Style',
            textOffsetX: 0,
            textOffsetY: 0,
            textScale: 1.0,
            textColor: '#FFFFFF',
        };
    }

    public show(): void {
        try {
            this.shownAtMs = this.scene.time.now;
            // Solid background color #10161D
            const bgColor = 0x10161D;
            const bg = this.scene.add.rectangle(
                this.scene.scale.width * 0.5,
                this.scene.scale.height * 0.5,
                this.scene.scale.width,
                this.scene.scale.height,
                bgColor
            ).setOrigin(0.5, 0.5);
            this.container.add(bg);
            this.bg = bg;

            // Create dot grid background overlay
            this.createDotGrid();

            // Add loading frame if texture exists
            if (this.scene.textures.exists("loading_frame")) {
                const centerX = this.scene.scale.width * 0.5 + (this.options.loadingFrameOffsetX || 0);
                // Match Hustle Horse: fixed base Y from center (options control X and scale only)
                const baseY = 315;
                const centerY = this.scene.scale.height * 0.5 + baseY;
                
                const loadingFrame = this.scene.add.image(
                    centerX,
                    centerY,
                    "loading_frame"
                ).setOrigin(0.5, 0.5).setScrollFactor(0);

                // Scale loading frame to cover screen, then apply scale modifier
                const frameScaleX = this.scene.scale.width / loadingFrame.width;
                const frameScaleY = this.scene.scale.height / loadingFrame.height;
                const baseScale = Math.max(frameScaleX, frameScaleY);
                const finalScale = baseScale * (this.options.loadingFrameScaleModifier || 1.0);
                loadingFrame.setScale(finalScale);

                this.container.add(loadingFrame);
                this.loadingFrame = loadingFrame;
                console.log(`[StudioLoadingScreen] Loading frame displayed at scale: ${finalScale}x (base: ${baseScale}x, modifier: ${this.options.loadingFrameScaleModifier || 1.0})`);
            } else {
                console.warn('[StudioLoadingScreen] Loading frame texture not found');
            }

            // Add main tagline text if provided
            if (this.options.text) {
                const textX = this.scene.scale.width * 0.5 + (this.options.textOffsetX || 0);
                // Match Hustle Horse: fixed base Y (options control X / scale / color only)
                const textBaseY = 345;
                const textY = this.scene.scale.height * 0.5 + textBaseY;
                
                const baseFontSize = 14;
                const fontSize = baseFontSize * (this.options.textScale || 1.0);

                const textColor = this.options.textColor || '#FFFFFF';
                const alpha = 0.50;

                const text = this.scene.add.text(
                    textX,
                    textY,
                    this.options.text.toUpperCase(),
                    {
                        fontFamily: 'Poppins-Regular',
                        fontSize: `${fontSize}px`,
                        color: textColor,
                        fontStyle: 'normal',
                        align: 'center'
                    }
                ).setOrigin(0.5, 0.5)
                 .setScrollFactor(0)
                 .setAlpha(alpha);

                try {
                    const textObj = text as any;
                    const originalUpdateText = textObj.updateText?.bind(textObj);
                    if (originalUpdateText) {
                        textObj.updateText = function(this: any) {
                            originalUpdateText();
                            if (this.context) {
                                this.context.font = `500 ${fontSize}px Poppins-Regular`;
                            }
                        }.bind(textObj);
                        textObj.updateText();
                    }
                } catch (e) {
                    console.warn('[StudioLoadingScreen] Could not set font weight 500, using default. Error:', e);
                }

                this.container.add(text);
                this.text = text;
                console.log(`[StudioLoadingScreen] Text displayed: "${this.options.text}" at (${textX}, ${textY}) with font size ${fontSize}px, weight 500, and alpha ${alpha}`);
            }

            // Add secondary text if provided
            if (this.options.text2) {
                const text2X = this.scene.scale.width * 0.5 + (this.options.text2OffsetX || 0);
                const text2BaseY = this.options.text2OffsetY ?? 0;
                const text2Y = this.scene.scale.height * 0.5 + text2BaseY;
                
                const baseFontSize = 14;
                const fontSize = baseFontSize * (this.options.text2Scale || 1.0);

                const textColor = this.options.text2Color || '#FFFFFF';
                const alpha = 0.50;

                const text2 = this.scene.add.text(
                    text2X,
                    text2Y,
                    this.options.text2,
                    {
                        fontFamily: 'Poppins-Regular',
                        fontSize: `${fontSize}px`,
                        color: textColor,
                        fontStyle: 'normal',
                        align: 'center'
                    }
                ).setOrigin(0.5, 0.5)
                 .setScrollFactor(0)
                 .setAlpha(alpha);

                try {
                    const textObj = text2 as any;
                    const originalUpdateText = textObj.updateText?.bind(textObj);
                    if (originalUpdateText) {
                        textObj.updateText = function(this: any) {
                            originalUpdateText();
                            if (this.context) {
                                this.context.font = `500 ${fontSize}px Poppins-Regular`;
                            }
                        }.bind(textObj);
                        textObj.updateText();
                    }
                } catch (e) {
                    console.warn('[StudioLoadingScreen] Could not set font weight 500 for text2, using default. Error:', e);
                }

                this.container.add(text2);
                this.text2 = text2;
                console.log(`[StudioLoadingScreen] Text2 displayed: "${this.options.text2}" at (${text2X}, ${text2Y}) with font size ${fontSize}px, weight 500, and alpha ${alpha}`);
            }

            // Optional time display
            if (this.options.showTime) {
                const timeX = this.scene.scale.width * 0.5 + (this.options.timeOffsetX || 0);
                const timeY = this.scene.scale.height * 0.5 + (this.options.timeOffsetY || 0);
                
                const baseFontSize = 14;
                const fontSize = baseFontSize * (this.options.timeScale || 1.0);

                const textColor = this.options.timeColor || '#FFFFFF';
                const alpha = 0.50;

                const initialTime = getMilitaryTime();
                const timeText = this.scene.add.text(
                    timeX,
                    timeY,
                    initialTime,
                    {
                        fontFamily: 'Arial',
                        fontSize: `${fontSize}px`,
                        color: textColor,
                        fontStyle: 'normal',
                        align: 'center'
                    }
                ).setOrigin(0.5, 0.5)
                 .setScrollFactor(0)
                 .setAlpha(alpha);

                try {
                    const textObj = timeText as any;
                    const originalUpdateText = textObj.updateText?.bind(textObj);
                    if (originalUpdateText) {
                        textObj.updateText = function(this: any) {
                            originalUpdateText();
                            if (this.context) {
                                this.context.font = `500 ${fontSize}px Arial`;
                            }
                        }.bind(textObj);
                        textObj.updateText();
                    }
                } catch (e) {
                    console.warn('[StudioLoadingScreen] Could not set font weight 500 for time text, using default. Error:', e);
                }

                this.container.add(timeText);
                this.timeText = timeText;
                console.log(`[StudioLoadingScreen] Time display created at (${timeX}, ${timeY}) with font size ${fontSize}px, weight 500, and alpha ${alpha}`);

                this.timeUpdateTimer = this.scene.time.addEvent({
                    delay: 1000,
                    callback: () => {
                        if (this.timeText) {
                            const currentTime = getMilitaryTime();
                            this.timeText.setText(currentTime);
                        }
                    },
                    loop: true
                });
            }

            // Spine animation (DI JOKER)
            const hasSpine = ensureSpineLoader(this.scene, '[StudioLoadingScreen] show');
            if (hasSpine) {
                const cx = this.scene.scale.width * 0.35;
                const cy = this.scene.scale.height * 0.48;
                const spine = (this.scene.add as any).spine(cx, cy, 'di_joker', 'di_joker-atlas');
                spine.setOrigin(0.5, 0.5);

                const desiredHeight = this.scene.scale.height * 0.4;
                const spineH = (spine as any).height || 800;
                const scale = desiredHeight / spineH;
                spine.setScale(0.09);
                this.container.add(spine);
                this.spine = spine;

                try { (spine as any).animationState?.setAnimation(0, 'animation', true); } catch {}
                
                // Add DiJoker logo next to the spine
                if (this.scene.textures.exists('dijoker_logo')) {
                    const logo = this.scene.add.image(
                        cx + this.scene.scale.width * 0.27,
                        cy,
                        'dijoker_logo'
                    );
                    
                    const logoScale = 1;
                    logo.setScale(logoScale);
                    logo.setOrigin(0.5, 0.5);
                    this.container.add(logo);
                } else {
                    console.warn('DiJoker logo texture not found');
                }
            }

            // Progress bar (similar to reference) – positioned just below the spine
            const assetScale = 1;
            const barWidth = this.scene.scale.width * 0.5;
            const barHeight = Math.max(13, 13 * assetScale);
            const barX = this.scene.scale.width * 0.5;
            let barY = this.scene.scale.height * 0.8;
            if (this.spine) {
                const cy = this.scene.scale.height * 0.5;
                const spineH = ((this.spine as any).height || 800) as number;
                const appliedScaleY = (this.spine.scaleY ?? this.spine.scale ?? 1) as number;
                const displayH = spineH * appliedScaleY;
                barY = cy + displayH * 0.5 + Math.max(20, 24 * assetScale);
            }

            this.progressBarX = barX;
            this.progressBarY = barY;
            this.progressBarWidth = barWidth;
            this.progressBarHeight = barHeight;

            this.progressBarBg = this.scene.add.graphics();
            this.progressBarBg.setPosition(0, 0);
            this.progressBarBg.setScrollFactor(0);
            this.progressBarBg.fillStyle(0x000000, 0.5);
            this.progressBarBg.fillRoundedRect(barX - barWidth * 0.5, barY - barHeight * 0.5, barWidth, barHeight, barHeight * 0.5);
            this.container.add(this.progressBarBg);

            this.progressBarFill = this.scene.add.graphics();
            this.progressBarFill.setPosition(0, 0);
            this.progressBarFill.setScrollFactor(0);
            const innerX = barX - barWidth * 0.5 + this.progressBarPadding;
            const innerY = barY - barHeight * 0.5 + this.progressBarPadding;
            const innerWidth = barWidth - this.progressBarPadding * 2;
            const innerHeight = barHeight - this.progressBarPadding * 2;
            this.progressBarFill.fillStyle(0x66D449, 1);
            this.progressBarFill.fillRoundedRect(innerX, innerY, 0, innerHeight, innerHeight * 0.5);
            this.container.add(this.progressBarFill);

            const updateFill = (progress: number) => {
                if (!this.progressBarFill || this.progressBarX === undefined || this.progressBarY === undefined || this.progressBarWidth === undefined || this.progressBarHeight === undefined) {
                    return;
                }
                const fillX = this.progressBarX - this.progressBarWidth * 0.5 + this.progressBarPadding;
                const fillY = this.progressBarY - this.progressBarHeight * 0.5 + this.progressBarPadding;
                const fillWidth = this.progressBarWidth - this.progressBarPadding * 2;
                const fillHeight = this.progressBarHeight - this.progressBarPadding * 2;
                const p = Math.max(0, Math.min(1, progress));
                this.progressBarFill.clear();
                this.progressBarFill.fillStyle(0x37DB6E, 1);
                this.progressBarFill.fillRoundedRect(
                    fillX,
                    fillY,
                    Math.max(0.0001, fillWidth * p),
                    fillHeight,
                    fillHeight * 0.5
                );
            };

            updateFill(0);

            this.onProgressHandler = (p: number) => updateFill(p);
            this.scene.load.on('progress', this.onProgressHandler as any);

            this.scene.load.once('complete', () => {
                this.fadeOutAndDestroy(3000, 500);
            });
        } catch (e) {
            console.warn('[StudioLoadingScreen] Failed to display spine:', e);
        }
    }

    public fadeOutAndDestroy(minVisibleMs: number = 3000, fadeMs: number = 500, onComplete?: () => void): void {
        const elapsed = this.scene.time.now - this.shownAtMs;
        const wait = Math.max(0, minVisibleMs - elapsed);
        this.scene.time.delayedCall(wait, () => {
			try {
				if (this.onProgressHandler) {
					this.scene.load.off('progress', this.onProgressHandler as any);
					this.onProgressHandler = undefined;
				}
				this.progressBarFill?.setVisible(false);
				this.progressBarBg?.setVisible(false);
			} catch {}

            try {
                if (this.timeUpdateTimer) {
                    this.timeUpdateTimer.destroy();
                    this.timeUpdateTimer = undefined;
                }
            } catch {}

            try {
                if (this.spine) {
                    this.spine.animationState?.clearTracks();
                    this.spine.setVisible(false);
                }
            } catch {}

            this.scene.tweens.add({
                targets: this.container,
                alpha: 0,
                duration: fadeMs,
                ease: 'Power2',
                onComplete: () => {
                    this.hide();
                    try { this.scene.events.emit('studio-fade-complete'); } catch {}
                    if (onComplete) onComplete();
                }
            });
        });
    }

    public hide(): void {
        this.container.destroy(true);
    }

    private createDotGrid(): void {
        const dotGridGraphics = this.scene.add.graphics();
        
        const dotSpacing = 20;
        const dotRadius = 1;
        const dotColor = 0xFFFFFF;
        const dotAlpha = 0.15;
        
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        
        const cols = Math.ceil(width / dotSpacing) + 1;
        const rows = Math.ceil(height / dotSpacing) + 1;
        
        const offsetX = (width - (cols - 1) * dotSpacing) * 0.5;
        const offsetY = (height - (rows - 1) * dotSpacing) * 0.5;
        
        dotGridGraphics.fillStyle(dotColor, dotAlpha);
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetX + col * dotSpacing;
                const y = offsetY + row * dotSpacing;
                dotGridGraphics.fillCircle(x, y, dotRadius);
            }
        }
        
        dotGridGraphics.setPosition(0, 0);
        dotGridGraphics.setScrollFactor(0);
        this.container.add(dotGridGraphics);
        this.dotGrid = dotGridGraphics;
        
        console.log(`[StudioLoadingScreen] Dot grid created: ${cols}x${rows} dots, spacing: ${dotSpacing}px, radius: ${dotRadius}px`);
    }
}

// Centralized asset queue helpers (mirrors reference game's pattern)
// These allow the Preloader to enqueue all required assets consistently.
export function queueGameAssetLoading(scene: Phaser.Scene, assetLoader: import('../../utils/AssetLoader').AssetLoader): void {
	// Order chosen to prioritize frequently-visible assets
	assetLoader.loadCoinAssets(scene);
	assetLoader.loadBuyFeatureAssets(scene);
	assetLoader.loadBackgroundAssets(scene);
	assetLoader.loadBonusBackgroundAssets(scene);
	assetLoader.loadBonusHeaderAssets(scene);
	assetLoader.loadScatterAnticipationAssets(scene);
	assetLoader.loadButtonAssets(scene);
	assetLoader.loadHeaderAssets(scene);
	assetLoader.loadMenuAssets(scene);
	assetLoader.loadHelpScreenAssets(scene);
	assetLoader.loadSymbolAssets(scene);
	assetLoader.loadNumberAssets(scene);
	assetLoader.loadDialogAssets(scene);
	assetLoader.loadAudioAssets(scene);
	assetLoader.loadSpinnerAssets(scene);
	console.log('[StudioLoadingScreen] Queued game asset loading (optimized)');
}

