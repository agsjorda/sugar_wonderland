import { Scene } from 'phaser';
import { ensureSpineLoader } from '../../utils/SpineGuard';

export class StudioLoadingScreen {
    private scene: Scene;
    private container: Phaser.GameObjects.Container;
    private shownAtMs: number = 0;
    private spine?: any;
    private bg?: Phaser.GameObjects.Rectangle;
    private progressBarBg?: Phaser.GameObjects.Graphics;
    private progressBarFill?: Phaser.GameObjects.Graphics;
	private progressBarX?: number;
    private progressBarY?: number;
    private progressBarWidth?: number;
    private progressBarHeight?: number;
    private progressBarPadding: number = 3;
    private onProgressHandler?: (progress: number) => void;

    constructor(scene: Scene) {
        this.scene = scene;
        this.container = scene.add.container(0, 0);
        this.container.setDepth(999);
    }

    public show(): void {
        try {
            this.shownAtMs = this.scene.time.now;
            // Black fullscreen background
            const bg = this.scene.add.rectangle(
                this.scene.scale.width * 0.5,
                this.scene.scale.height * 0.5,
                this.scene.scale.width,
                this.scene.scale.height,
                0x000000
            ).setOrigin(0.5, 0.5);
            this.container.add(bg);
            this.bg = bg;

            // Spine animation (DI JOKER)
            const hasSpine = ensureSpineLoader(this.scene, '[StudioLoadingScreen] show');
            if (hasSpine) {
                const cx = this.scene.scale.width * 0.5;
                const cy = this.scene.scale.height * 0.45;
                const spine = (this.scene.add as any).spine(cx, cy, 'di_joker', 'di_joker-atlas');
                spine.setOrigin(0.5, 0.5);

                // Auto scale to fit comfortably
                const desiredHeight = this.scene.scale.height * 0.4;
                const spineH = (spine as any).height || 800;
                const scale = desiredHeight / spineH;
                spine.setScale(0.08);
                this.container.add(spine);
                this.spine = spine;

                try { (spine as any).animationState?.setAnimation(0, 'animation', true); } catch {}
            }

            // Progress bar (similar to Preloader) – positioned just below the spine
            const assetScale = 1; // static scale for studio screen
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

            this.progressBarBg = this.scene.add.graphics();
            this.progressBarBg.fillStyle(0x000000, 0.5);
            this.progressBarBg.fillRoundedRect(barX - barWidth * 0.5, barY - barHeight * 0.5, barWidth, barHeight, barHeight * 0.5);
            this.container.add(this.progressBarBg);

            this.progressBarFill = this.scene.add.graphics();
            this.progressBarFill.fillStyle(0x66D449, 1);
            this.progressBarFill.fillRoundedRect(barX - barWidth * 0.5 + this.progressBarPadding, barY - barHeight * 0.5 + this.progressBarPadding, 0, barHeight - this.progressBarPadding * 2, (barHeight - this.progressBarPadding * 2) * 0.5);
            this.container.add(this.progressBarFill);

            this.progressBarX = barX;
            this.progressBarY = barY - 40;
            this.progressBarWidth = barWidth;
            this.progressBarHeight = barHeight;

            // Time-driven progress fill over 3 seconds (independent of loader progress)
            const counter = { p: 0 } as any;
            this.scene.tweens.add({
                targets: counter,
                p: 1,
                duration: 3000,
                ease: 'Linear',
                onUpdate: () => {
                    if (this.progressBarFill && this.progressBarX !== undefined && this.progressBarY !== undefined && this.progressBarWidth !== undefined && this.progressBarHeight !== undefined) {
                        const innerX = this.progressBarX - this.progressBarWidth * 0.5 + this.progressBarPadding;
                        const innerY = this.progressBarY - this.progressBarHeight * 0.5 + this.progressBarPadding;
                        const innerWidth = this.progressBarWidth - this.progressBarPadding * 2;
                        const innerHeight = this.progressBarHeight - this.progressBarPadding * 2;
                        const progress = Math.max(0, Math.min(1, counter.p));
                        this.progressBarFill.clear();
                        this.progressBarFill.fillStyle(0x37DB6E, 1);
                        this.progressBarFill.fillRoundedRect(
                            innerX,
                            innerY,
                            Math.max(0.0001, innerWidth * progress),
                            innerHeight,
                            innerHeight * 0.5
                        );
                    }
                }
            });
        } catch (e) {
            console.warn('[StudioLoadingScreen] Failed to display spine:', e);
        }
    }

    public fadeOutAndDestroy(minVisibleMs: number = 3000, fadeMs: number = 500, onComplete?: () => void): void {
        const elapsed = this.scene.time.now - this.shownAtMs;
        const wait = Math.max(0, minVisibleMs - elapsed);
        this.scene.time.delayedCall(wait, () => {
			// Detach progress listener and hide progress bar before fade
			try {
				if (this.onProgressHandler) {
					this.scene.load.off('progress', this.onProgressHandler as any);
					this.onProgressHandler = undefined;
				}
				this.progressBarFill?.setVisible(false);
				this.progressBarBg?.setVisible(false);
			} catch {}

            // First disable/stop spine animations and hide it
            try {
                if (this.spine) {
                    this.spine.animationState?.clearTracks();
                    this.spine.setVisible(false);
                }
            } catch {}

            // Fade out only the black background to reveal Preloader underneath
            const target = this.bg || this.container;
            this.scene.tweens.add({
                targets: target,
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
}


