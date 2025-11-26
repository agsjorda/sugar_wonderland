import { Scene } from 'phaser';

/**
 * SplitTransition creates a visual where a single sprite appears to split
 * vertically into two halves that slide outward to the screen edges.
 */
export class SplitTransition {
	private scene: Scene;
	
	constructor(scene: Scene) {
		this.scene = scene;
	}

	/**
	 * Plays the split animation on a given sprite/image.
	 * - Duplicates the target into two cropped halves
	 * - Hides the original during the animation
	 * - Moves halves outward to the left/right screen edges
	 * - Destroys the halves and restores the original when complete
	 *
	 * Returns a Promise that resolves when the animation finishes.
	 */
	public async playOn(
		target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
		duration: number = 600,
        delay: number = 250,
		ease: string = 'Cubic.easeInOut',
        targetPosition?: number
	): Promise<void> {
		if (!target.texture || !target.frame) {
			return;
		}

		const frame = target.frame;
		const frameWidth = frame.cutWidth;
		const frameHeight = frame.cutHeight;

		const cam = this.scene.cameras.main;
		const view = cam.worldView;
		
		// Ensure our effect and blocker sit above everything
		const baseTopDepth = 9000;
		const halvesDepth = baseTopDepth - 1;

		// Create an invisible input blocker covering the viewport
		const blocker = this.scene.add
			.zone(cam.midPoint.x, cam.midPoint.y, cam.width, cam.height)
			.setOrigin(0.5)
			.setScrollFactor(0)
			.setDepth(baseTopDepth)
			.setInteractive();

		// Temporarily disable keyboard input as well
		const keyboard = this.scene.input.keyboard;
		const prevKeyboardEnabled = keyboard ? keyboard.enabled : undefined;
		if (keyboard) {
			keyboard.enabled = false;
		}

		// Compute where each half's center should end up (flush to screen edges)
        const excessFinalX = 100;
		const leftFinalX = targetPosition? this.scene.scale.width / 2 - targetPosition - excessFinalX : view.left - excessFinalX;
		const rightFinalX = targetPosition? this.scene.scale.width / 2 + targetPosition + excessFinalX : view.right + excessFinalX;
		const y = target.y;

		// Create left half clone
		const leftHalf = this.scene.add.image(target.x, y, target.texture.key, frame.name)
			.setOrigin(target.originX, target.originY)
			.setScale(target.scaleX, target.scaleY)
			.setRotation(target.rotation)
			.setFlip((target as any).flipX ?? false, (target as any).flipY ?? false)
			.setDepth(target.depth + 1)
			.setAlpha(target.alpha)
			.setScrollFactor((target as any).scrollFactorX ?? 1, (target as any).scrollFactorY ?? 1);
		leftHalf.setCrop(0, 0, Math.floor(frameWidth / 2), frameHeight);

		// Create right half clone
		const rightHalf = this.scene.add.image(target.x, y, target.texture.key, frame.name)
			.setOrigin(target.originX, target.originY)
			.setScale(target.scaleX, target.scaleY)
			.setRotation(target.rotation)
			.setFlip((target as any).flipX ?? false, (target as any).flipY ?? false)
			.setDepth(target.depth + 1)
			.setAlpha(target.alpha)
			.setScrollFactor((target as any).scrollFactorX ?? 1, (target as any).scrollFactorY ?? 1);
		rightHalf.setCrop(Math.floor(frameWidth / 2), 0, Math.ceil(frameWidth / 2), frameHeight);

		// Elevate halves above everything else but below the blocker
		leftHalf.setDepth(halvesDepth);
		rightHalf.setDepth(halvesDepth);


		await new Promise<void>((resolve) => {
			let completed = 0;
			const onDone = () => {
				completed += 1;
				if (completed === 2) {
					// Cleanup and restore original
					if (keyboard && prevKeyboardEnabled !== undefined) {
						keyboard.enabled = prevKeyboardEnabled;
					}
					blocker.destroy();
					leftHalf.destroy();
					rightHalf.destroy();
					target.destroy();
					resolve();
				}
			};

            const openAnimation = () => {
                // Hide the original during the effect
                target.setVisible(false);

                this.scene.tweens.add({
                    targets: leftHalf,
                    x: leftFinalX,
                    duration,
                    ease,
					onComplete: onDone
                });
    
                this.scene.tweens.add({
                    targets: rightHalf,
                    x: rightFinalX,
                    duration,
                    ease,
					onComplete: onDone
                });
            }

            this.scene.time.delayedCall(delay, openAnimation);

		});
	}
}