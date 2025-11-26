import { Scene } from 'phaser';

/**
 * FlashTransition component that displays a white flash overlay
 */
export class FlashTransition {
    private scene: Scene;
    private overlay: Phaser.GameObjects.Graphics;
    private animationSpeed: number = 1000; // Duration in milliseconds for radius changes
    private isAnimating: boolean = false;
    
    // Alpha range configuration
    private startAlpha: number = 0;
    private endAlpha: number = 1;
    private currentAlpha: number;

    private flashColor: number = 0xffffff; // white flash

    constructor(scene: Scene) {
		this.scene = scene;
		this.createOverlay();
		this.setupKeyboardInput();
		
		// Start hidden - only show when needed for transitions
		this.overlay.setVisible(false);
	}

    /**
     * Create the black overlay graphic with transparent circular hole
     */
    private createOverlay(): void {
        // Create a graphics object for the overlay
        this.overlay = this.scene.add.graphics();
        
        // Clear any existing graphics
        this.overlay.clear();

        // Set the fill style to black with full opacity
        this.overlay.fillStyle(this.flashColor, 1);

        // Draw a filled rectangle covering the entire screen
        this.overlay.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);

        // Set high depth to ensure overlay is in front
        this.overlay.setDepth(10000);

        // Make overlay visible
        this.overlay.setVisible(true);

        console.log('[FlashTransition] White flash overlay created');
    }

    /**
     * Setup keyboard input for T and Y keys
     */
    private setupKeyboardInput(): void {
        // F key - flash the overlay
        this.scene.input.keyboard?.on('keydown-F', () => {
            console.log('[FlashTransition] F key pressed - flashing the overlay');
            this.flashOverlay(1, 1000);
        });
    }

    /**
     * Flash the overlay smoothly
     * @param targetAlpha The target alpha to flash to
     * @param customSpeed Optional custom animation speed in milliseconds
     */
    public flashOverlay(targetAlpha: number, customSpeed?: number, easing?: string): void {
        if (this.isAnimating) {
            console.log('[FlashTransition] Already animating, ignoring request');
            return;
        }

        // Ensure target alpha is within valid range
        targetAlpha = Math.max(this.startAlpha, Math.min(this.endAlpha, targetAlpha));
        
        if (targetAlpha === this.currentAlpha) {
            console.log(`[FlashTransition] Already at target alpha: ${targetAlpha}`);
            return;
        }

        // Use custom speed if provided, otherwise use default animation speed
        const duration = customSpeed || this.animationSpeed;
        
        console.log(`[FlashTransition] Flashing from ${this.currentAlpha} to ${targetAlpha} with speed: ${duration}ms`);
        
        // Create smooth tween to the target radius
        this.scene.tweens.add({
            targets: this,
            currentAlpha: targetAlpha,
            duration: duration,
            ease: easing || 'InOut',
            onUpdate: () => {
                // Update the alpha in real-time during the tween
                this.overlay.setAlpha(this.currentAlpha);
            },
            onComplete: () => {
                console.log(`[FlashTransition] Zoom in complete, alpha: ${this.currentAlpha}`);
            }
        });
    }

    /**
     * Change the alpha smoothly (increase or decrease)
     */
    public changeAlpha(change: number): void {
        if (this.isAnimating) {
            console.log('[IrisTransition] Already animating, ignoring request');
            return;
        }

        // Calculate target radius
        const targetAlpha = Math.max(this.startAlpha, Math.min(this.endAlpha, this.currentAlpha + change));
        
        if (targetAlpha === this.currentAlpha) {
            console.log(`[IrisTransition] Already at ${change > 0 ? 'maximum' : 'minimum'} radius`);
            return;
        }

        this.isAnimating = true;
        const action = change > 0 ? 'enlarging' : 'shrinking';
        console.log(`[FlashTransition] Smoothly ${action} from ${this.currentAlpha} to ${targetAlpha}`);

        // Create smooth tween for the alpha
        this.scene.tweens.add({
            targets: this,
            currentAlpha: targetAlpha,
            duration: this.animationSpeed,
            ease: 'Power2',
            onUpdate: () => {
                // Update the alpha in real-time during the tween
                this.overlay.setAlpha(this.currentAlpha);
            },
            onComplete: () => {
                this.isAnimating = false;
                console.log(`[FlashTransition] ${action} complete, alpha: ${this.currentAlpha}`);
            }
        });
    }

    /**
     * Set radius to a specific value smoothly
     */
    private setAlpha(targetAlpha: number): void {
        if (this.isAnimating) {
            console.log('[IrisTransition] Cannot set radius while animating');
            return;
        }

        // Clamp to valid range
        targetAlpha = Math.max(this.startAlpha, Math.min(this.endAlpha, targetAlpha));
        
        if (targetAlpha === this.currentAlpha) {
            console.log(`[FlashTransition] Already at target alpha: ${targetAlpha}`);
            return;
        }

        console.log(`[FlashTransition] Setting alpha from ${this.currentAlpha} to ${targetAlpha}`);
        
        // Create smooth tween to the target radius
        this.scene.tweens.add({
            targets: this,
            currentAlpha: targetAlpha,
            duration: this.animationSpeed,
            ease: 'Power2',
            onUpdate: () => {
                // Update the mask in real-time during the tween
                this.overlay.setAlpha(this.currentAlpha);
            },
            onComplete: () => {
                console.log(`[FlashTransition] Set alpha complete: ${this.currentAlpha}`);
            }
        });
    }

    /**
     * Reset alpha to original value
     */
    private resetAlpha(): void {
        if (this.isAnimating) {
            console.log('[FlashTransition] Cannot reset while animating');
            return;
        }

        console.log(`[FlashTransition] Resetting alpha from ${this.currentAlpha} to ${this.startAlpha}`);
        
        // Create smooth tween to reset the alpha
        this.scene.tweens.add({
            targets: this,
            currentAlpha: this.startAlpha,
            duration: this.animationSpeed,
            ease: 'Power2',
            onUpdate: () => {
                // Update the alpha in real-time during the tween
                this.overlay.setAlpha(this.currentAlpha);
            },
            onComplete: () => {
                console.log(`[FlashTransition] Reset complete, alpha: ${this.currentAlpha}`);
            }
        });
    }

    /**
     * Set alpha immediately without animation
     * @param alpha The alpha to set immediately
     */
    public setAlphaImmediate(alpha: number): void {
        // Ensure alpha is within valid range
        alpha = Math.max(this.startAlpha, Math.min(this.endAlpha, alpha));
        
        this.currentAlpha = alpha;
        this.overlay.setAlpha(alpha);
        console.log(`[FlashTransition] Alpha set immediately to: ${this.currentAlpha}`);
    }

    /**
     * Set animation speed (in milliseconds)
     */
    public setAnimationSpeed(speed: number): void {
        this.animationSpeed = Math.max(50, Math.min(1000, speed));
        console.log(`[IrisTransition] Animation speed set to ${this.animationSpeed}ms`);
    }

    /**
     * Get current animation speed
     */
    public getAnimationSpeed(): number {
        return this.animationSpeed;
    }

    /**
     * Set radius range configuration
     */
    public setAlphaRange(start: number, end: number): void {
        this.startAlpha = Math.max(0, start);
        this.endAlpha = Math.max(0, end);
        console.log(`[FlashTransition] Alpha range set: start=${this.startAlpha}, end=${this.endAlpha}`);
    }

    	/**
	 * Get current radius range configuration
	 */
	public getAlphaRange(): { start: number; end: number } {
		return {
			start: this.startAlpha,
			end: this.endAlpha
		};
	}
	
	/**
	 * Show the iris transition overlay
	 */
	public show(): void {
		this.overlay.setVisible(true);
		console.log('[IrisTransition] Overlay shown');
	}
	
	/**
	 * Hide the iris transition overlay
	 */
	public hide(): void {
		this.overlay.setVisible(false);
		console.log('[IrisTransition] Overlay hidden');
	}
}