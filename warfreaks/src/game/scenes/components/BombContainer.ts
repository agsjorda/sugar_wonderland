import { Scene, GameObjects } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { GameData } from './GameData';
import { Events } from './Events';

// Depth used to ensure bombs are always rendered in front of symbols
const BOMB_FRONT_DEPTH = 1000000;

/**
 * BombContainer class that manages bomb sprites with text overlays
 * The container handles traversal during drop and refill operations
 */
export class BombContainer extends GameObjects.Container {
    private bombSprite: SpineGameObject;
    private textOverlay: GameObjects.Text;
    private floatingText?: GameObjects.Text;
    private orbitTimer?: Phaser.Time.TimerEvent;
    private overlayBomb?: SpineGameObject;
    private multiplier: number;
    private bombType: string;
    public scene: Scene;
    private gameData: GameData;
    private isMobile: boolean = false;


    constructor(scene: Scene, x: number, y: number, bombValue: number, gameData: GameData) {
        super(scene, x, y);
        
        this.scene = scene;
        this.gameData = gameData;
        this.multiplier = this.getMultiplierFromBombValue(bombValue);
        this.bombType = this.getBombTypeFromMultiplier(this.multiplier);


        // Set the animation based on the bomb type
        // Create the bomb sprite
        this.bombSprite = scene.add.spine(0, 0, 'Symbol10_SW', 'Symbol10_SW');
        this.bombSprite.setVisible(true);
        this.bombSprite.setScale(1, 1.5);
        this.bombSprite.setDepth(10000);
        
        // Set the animation time scale to 0
        this.bombSprite.animationState.timeScale = 0;

        // Set the animation based on the bomb type

        this.bombSprite.animationState.setAnimation(0, `symbol${bombValue}_WF`, false);
        
        // Create the text overlay
        this.textOverlay = scene.add.text(0, 0, `${this.multiplier}X`, {
            fontSize: '32px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#FF0000',
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#FFFFFF',
                blur: 10,
                stroke: true,
                fill: false
            }, 
        });
        
        // Apply gradient to text
        const gradient = this.textOverlay.context.createLinearGradient(0, 0, 0, this.textOverlay.height);
        gradient.addColorStop(0, '#FFF15A');
        gradient.addColorStop(0.5, '#FFD000');
        gradient.addColorStop(1, '#FFB400');
        this.textOverlay.setFill(gradient);
        
        // Add both elements to the container
        this.add([this.bombSprite, this.textOverlay]);
        
        // Set initial visibility
        this.textOverlay.setAlpha(0);
        
        // Debug logging
        this.gameData.debugLog('BombContainer created', {
            bombValue,
            multiplier: this.multiplier,
            bombType: this.bombType,
            position: { x, y }
        });
        
        // Keep this container on top; hook into the scene update loop
        try { this.scene.events.on('postupdate', this.ensureFront, this); } catch (_e) {}
    }

    /**
     * Ensure this container renders above sibling symbols by setting a high depth
     * and reordering it to the top of its parent (or the scene display list).
     */
    private bringSelfToFront(): void {
        try {
            // Assign a high depth so the container sits above sibling symbols
            this.setDepth(BOMB_FRONT_DEPTH);
            const parent: any = (this as any).parentContainer;
            if (parent && typeof parent.bringToTop === 'function') {
                parent.bringToTop(this);
            } else {
                // Fallback to scene-level display list
                this.scene.children.bringToTop(this);
            }
        } catch (_e) {
            // no-op
        }
    }

    /**
     * Maintain front ordering each frame. This covers cases where new symbols are
     * created after the bomb started animating.
     */
    private ensureFront(): void {
        if (!this.active || !this.visible) return;
        try {
            this.setDepth(BOMB_FRONT_DEPTH);
            const parent: any = (this as any).parentContainer;
            if (parent && typeof parent.bringToTop === 'function') {
                parent.bringToTop(this);
                if (this.overlayBomb) parent.bringToTop(this.overlayBomb);
            } else {
                this.scene.children.bringToTop(this);
                if (this.overlayBomb) this.scene.children.bringToTop(this.overlayBomb);
            }
            if (this.overlayBomb) {
                try { this.overlayBomb.setDepth(BOMB_FRONT_DEPTH); } catch (_e) {}
            }
        } catch (_e) { /* no-op */ }
    }

    /**
     * Get multiplier value from bomb symbol value (10-22)
     */
    private getMultiplierFromBombValue(bombValue: number): number {
        if (bombValue < 10 || bombValue > 24) {
            this.gameData.debugError('Invalid bomb value:', bombValue);
            return bombValue; // Default fallback
        }
        
        const multiplierIndex = bombValue - 10;
        const multipliers = this.gameData.bombMultiplier;
        
        if (multiplierIndex >= 0 && multiplierIndex < multipliers.length) {
            return multipliers[multiplierIndex];
        }
        
        this.gameData.debugError('Multiplier index out of range:', multiplierIndex);
        return 2; // Default fallback
    }

    /**
     * Get bomb type (low/medium/high) based on multiplier value
     */
    private getBombTypeFromMultiplier(multiplier: number): string {
        if (multiplier > 25) {
            return 'high';
        } else if (multiplier > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Set the display size for both bomb sprite and text overlay
     */
    setBombDisplaySize(width: number, height: number): void {
        this.bombSprite.setDisplaySize(width, height);
        
        // Scale text overlay proportionally
        const textScale = 0//Math.min(width, height) / 100; // Adjust based on your needs
        this.textOverlay.setScale(textScale);
        
        this.gameData.debugLog('Bomb display size set', { width, height, textScale });
    }

    /**
     * Play bomb animation based on type
     * Controls timescale from 0 to 1 when animating and toggles mask accordingly
     */
    playBombAnimation(): void {
        this.gameData.debugLog('Playing bomb animation', { bombType: this.bombType });
        
        // Check current timescale to determine animation state
        const currentTimeScale = this.bombSprite.animationState.timeScale;
        
        if (currentTimeScale === 0) {
            // When starting the animation, ensure this bomb is above other symbols
            this.bringSelfToFront();
            // Start animation: set timescale to 1 and remove mask
            this.bombSprite.animationState.timeScale = 1;
            (this.scene as any).slotMachine.toggleBombMask(true); // isRemove = true when timeScale = 1
            this.gameData.debugLog('Started bomb animation - timeScale: 1, mask removed');
        } else {
            // Stop animation: set timescale to 0 and apply mask
            this.bombSprite.animationState.timeScale = 0;
            (this.scene as any).slotMachine.toggleBombMask(false); // isRemove = false when timeScale = 0
            this.gameData.debugLog('Stopped bomb animation - timeScale: 0, mask applied');
        }
    }

    /**
     * Check if the bomb is currently playing an animation
     */
    isPlayingAnimation(): boolean {
        if (this.bombSprite && this.bombSprite.animationState.tracks.length > 0) {
            const currentAnimation = this.bombSprite.animationState.getCurrent(0);
            if (currentAnimation && currentAnimation.animation) {
                const animationName = currentAnimation.animation.name;
                // Check for both animation types: 'low-animation', 'medium-animation', 'high-animation'
                // and also 'low-static', 'medium-static', 'high-static' (used by WinAnimation)
                return animationName.includes('animation') || animationName.includes('static');
            }
        }
        return false;
    }

    /**
     * Get the bomb sprite for external animations
     */
    getBombSprite(): SpineGameObject {
        return this.bombSprite;
    }

    /**
     * Get the text overlay for external modifications
     */
    getTextOverlay(): GameObjects.Text {
        return this.textOverlay;
    }

    /**
     * Get the multiplier value
     */
    getMultiplier(): number {
        return this.multiplier;
    }

    /**
     * Get the bomb type
     */
    getBombType(): string {
        return this.bombType;
    }

    /**
     * Show explosion effect
     */
    showExplosion(): void {
        //console.log('Showing bomb explosion');
        
        // Use an overlay bomb so the animation sits above other symbols
        try {
            this.scene.audioManager.TExplosion.play();
            this.scene.audioManager.BonusBG.resume();
            } catch (_e) {}
        // Ensure the container itself is above siblings during the explosion sequence
        this.bringSelfToFront();
        // Pause at the 22nd frame (assuming 30 FPS)
        switch(this.bombType){
            case 'low':
                this.spawnOverlayBombAnimation('Symbols10_FIS', 1500, 31, 30);
                break;
            case 'medium':
                this.spawnOverlayBombAnimation('Symbols11_FIS', 1500, 31, 30);
                break;
            case 'high':
                this.spawnOverlayBombAnimation('Symbols12_FIS', 1500, 31, 30);
                break;
        }
        // During explosion, lower other symbols (regular/scatter) so bomb visually dominates
        this.setOtherSymbolsDepth(0);
        
        // Animate text overlay
        this.scene.tweens.add({
            targets: this.bombSprite,
            
            duration: 500,
            ease: 'Power2',
        });
        
        // Also move floating text during explosion for visibility
        this.startFloatingTextRise();
    }

    /**
     * Spawns a temporary overlay Spine bomb at the same visual position and plays an animation.
     * The overlay is added to the parent container (so masking applies) and brought to the top.
     */
    private spawnOverlayBombAnimation(animationName: string = '', durationMs: number = 650, pauseAtFrame?: number, frameRate: number = 30): void {
        try {
            const parent: any = (this as any).parentContainer;
            // Position overlay relative to parent container so it aligns under the same mask/transform
            const overlayX = this.x + this.bombSprite.x;
            const overlayY = this.y + this.bombSprite.y;
            let overlay: SpineGameObject = null!;
            
            overlay = this.scene.add.spine(overlayX, overlayY, animationName, animationName) as SpineGameObject;
            // Match visual size of the original bomb sprite
            //overlay.setScale(this.bombSprite.scaleX, this.bombSprite.scaleY);
            overlay.setAlpha(1);
            overlay.setDepth(BOMB_FRONT_DEPTH);
            // Scale down overlay from 100% to 50% at animation start
            try {
                this.scene.tweens.add({
                    targets: overlay,
                    duration: 800,
                    ease: 'Power2'
                });
            } catch (_e) { /* no-op */ }
            // Place inside the same container (for masking) and bring to top
            if (parent && typeof parent.add === 'function') {
                parent.add(overlay);
                if (typeof parent.bringToTop === 'function') {
                    parent.bringToTop(overlay);
                }
            } else {
                // Fallback: set a very high depth on scene root
                overlay.setDepth(BOMB_FRONT_DEPTH);
            }
            this.overlayBomb = overlay;

            // Play the requested animation on the overlay
            overlay.animationState.timeScale = 1;
            const entry = overlay.animationState.setAnimation(0, animationName, false);

            // If asked to pause at a specific frame, schedule a pause at that timestamp
            if (typeof pauseAtFrame === 'number' && pauseAtFrame >= 0 && frameRate > 0) {
                const pauseMs = (pauseAtFrame / frameRate) * 1000;
                this.scene.time.delayedCall(pauseMs, () => {
                    try {
                        // Freeze the animation at the pause time
                        overlay.animationState.timeScale = 0;
                        const current = overlay.animationState.getCurrent(0) || entry;
                        if (current) {
                            current.trackTime = pauseMs / 1000;
                        }
                        overlay.animationState.update(0);
                        (overlay as any).skeleton?.updateWorldTransform?.();
                        // Keep the paused frame fully visible
                        overlay.setAlpha(1);
                        overlay.setVisible(true);
                        // Emit world coordinates for floating text illusion in Buttons
                        const wm = this.getWorldTransformMatrix(new Phaser.GameObjects.Components.TransformMatrix());
                        const lx = this.textOverlay.x;
                        const ly = this.textOverlay.y;
                        const worldX = wm.a * lx + wm.c * ly + wm.tx;
                        const worldY = wm.b * lx + wm.d * ly + wm.ty;
                        Events.emitter.emit(Events.BOMB_FLOAT_TEXT, {
                            x: worldX,
                            y: worldY,
                            valueText: this.textOverlay.text
                        });
                    } catch (_e) { /* no-op */ }
                });
                // Ensure overlay lifetime exceeds pause time
                durationMs = Math.max(durationMs, pauseMs + 500);
            }
            // Do not auto-destroy; keep overlay frozen at frame 31 until the next spin clears the grid
        } catch (_e) {
            // If overlay fails, fall back to animating the internal sprite
            try {
                this.bombSprite.animationState.timeScale = 1;
                const fallbackEntry = this.bombSprite.animationState.setAnimation(0, animationName, false);
                // Scale down internal sprite from 100% to 50% at animation start
                try {
                    this.scene.tweens.add({
                        targets: this.bombSprite,
                        duration: 400,
                        ease: 'Power2'
                    });
                } catch (__e) { /* no-op */ }
                // If asked to pause at a specific frame, pause the internal sprite as well
                if (typeof pauseAtFrame === 'number' && pauseAtFrame >= 0 && frameRate > 0) {
                    const pauseMs = (pauseAtFrame / frameRate) * 1000;
                    this.scene.time.delayedCall(pauseMs, () => {
                        try {
                            this.bombSprite.animationState.timeScale = 0;
                            const current = this.bombSprite.animationState.getCurrent(0) || fallbackEntry;
                            if (current) {
                                current.trackTime = pauseMs / 1000;
                            }
                            (this.bombSprite as any).skeleton?.updateWorldTransform?.();
                            // Keep sprite fully visible on paused frame
                            this.bombSprite.setAlpha(1);
                        } catch (__e) { /* no-op */ }
                    });
                }
            } catch (__e) {}
        }
    }

    private setOtherSymbolsDepth(depth: number): void {
        try {
            const parent: any = (this as any).parentContainer;
            if (!parent || !parent.list) return;
            parent.list.forEach((child: any) => {
                if (!child || child === this) return;
                // Lower any sibling that supports setDepth (Sprites, Spine, Containers, etc.)
                if (typeof child.setDepth === 'function') {
                    try { child.setDepth(depth); } catch (_e) {}
                }
                // If sibling is a Container, also lower its immediate children
                if (Array.isArray(child?.list)) {
                    child.list.forEach((grandChild: any) => {
                        if (!grandChild || grandChild === this) return;
                        if (typeof grandChild.setDepth === 'function') {
                            try { grandChild.setDepth(depth); } catch (_e) {}
                        }
                    });
                }
            });
        } catch (_e) {
            // no-op
        }
    }

    /**
     * Clean up the bomb container
     */
    destroy(): void {
        // console.log('Destroying bomb container');
        
        try { this.scene.events.off('postupdate', this.ensureFront, this); } catch (_e) {}

        if (this.orbitTimer) {
            try { this.orbitTimer.remove(false); } catch (_e) {}
            this.orbitTimer = undefined;
        }
        if (this.floatingText) {
            try { this.floatingText.destroy(); } catch (_e) {}
            this.floatingText = undefined;
        }
        if (this.overlayBomb) {
            try { this.overlayBomb.destroy(); } catch (_e) {}
            this.overlayBomb = undefined;
        }
        
        if (this.bombSprite) {  
            // console.error('destroying bomb sprite', this.bombSprite);
            this.bombSprite.animationState.timeScale = 1;
            this.bombSprite.animationState.addListener({
                complete: () => {
                    //console.error('destroying bomb sprite complete');
                this.bombSprite.destroy();
            }});
        }
        
        if (this.textOverlay) {
            this.textOverlay.destroy();
        }
        
        super.destroy();
    }

    /**
     * Compute the bomb's world position to anchor the floating text motion.
     */
    private getBombWorldPosition(): { x: number; y: number } {
        try {
            const wm = this.getWorldTransformMatrix(new Phaser.GameObjects.Components.TransformMatrix());
            const lx = this.bombSprite.x;
            const ly = this.bombSprite.y;
            const worldX = wm.a * lx + wm.c * ly + wm.tx;
            const worldY = wm.b * lx + wm.d * ly + wm.ty;
            return { x: worldX, y: worldY };
        } catch (_e) {
            return { x: this.x, y: this.y };
        }
    }

    /**
     * Place the floating text at the bomb center and log its coordinates.
     */
    private updateFloatingTextPosition(): void {
        if (!this.floatingText) return;
        const center = this.getBombWorldPosition();
        this.floatingText.setPosition(center.x, center.y);
    }

    /**
     * Start a tween that moves the floating text from the bomb center to
     * the top-quarter of the screen around the middle X.
     */
    private startFloatingTextRise(): void {
        if (!this.floatingText) return;
        // Stop any existing timer-based motion
        if (this.orbitTimer) {
            try { this.orbitTimer.remove(false); } catch (_e) {}
            this.orbitTimer = undefined;
        }
        // Start at bomb center
        const start = this.getBombWorldPosition();
        this.floatingText.setPosition(start.x, start.y);
        try { this.scene.children.bringToTop(this.floatingText); } catch (_e) {}

        // Compute target at top-quarter of the current camera view, centered on X
        const cam = this.scene.cameras.main;
        const view = cam.worldView;
        let targetX = this.isMobile ? view.x + view.width * 0.5 : view.x + view.width * 0.55;
        let targetY = this.isMobile ? view.y + view.height * 0.1875 : view.y + view.height * 0.90;
        this.textOverlay.setText('');

        this.scene.tweens.add({
            targets: this.floatingText,
            x: targetX,
            y: targetY,
            duration: 900,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                if (!this.floatingText) return;
                //console.log('FloatingText position:', { x: this.floatingText.x, y: this.floatingText.y });
            },
            onComplete: () => {
                try { 
                    this.scene.children.bringToTop(this.floatingText!);
                    setTimeout(() => {
                        this.floatingText?.destroy();
                        // event call to update the total win text, multiply by the bomb multiplier amount
                        this.scene.gameData.totalBombWin += this.getMultiplier();
                        Events.emitter.emit(Events.SHOW_BOMB_WIN);
                        // console.log(this.scene.gameData.totalWinFreeSpinPerTumble[this.scene.gameData.apiFreeSpinsIndex]);
                        Events.emitter.emit(Events.UPDATE_TOTAL_WIN, 0, true);
                    }, 15);
                 } catch (_e) {}
            }
        });
    }
} 