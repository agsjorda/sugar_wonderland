import { Scene } from 'phaser';
import { IMAGE_SHINE_PIPELINE_KEY } from '../shaders/ImageShinePipeline';
import type { ImageShinePipelineData } from '../shaders/ImageShinePipeline';

// Split-transition shine preset (copied from GameData.LOGO_SHINE_SHADER_CONFIG for now).
// Intentionally kept local so you can tweak it here without following references.
const SPLIT_TRANSITION_SHINE_SHADER_CONFIG: Readonly<ImageShinePipelineData> = {
	// Movement direction (object pixel space)
	moveDirX: 0,
	moveDirY: -1,

	// Stripe direction angle (degrees)
	stripeAngleDeg: 40,

	// Band shape (px)
	thicknessPx: 250,
	softnessPx: 100,

	// Speed (px/sec)
	speedPxPerSec: 22500,

	// Make the shine effectively one-shot (sweep once, then wait "forever" so it doesn't loop).
	repeatDelaySec: 999999,

	// Start point (px) - X is fixed; Y is derived at call site
	startXPx: -14000,

	// Strength
	intensity: 0.9,
	color: { r: 1, g: 1, b: 1 },
};

export type SplitTransitionMode =
	| 'vertical'
	| 'diagonal'
	| 'diagonal_reverse'
	| 'diagonal_height'
	| 'diagonal_height_reverse';

/**
 * SplitTransition creates a visual where a single sprite appears to split
 * into two halves that slide outward to the screen edges.
 */
export class SplitTransition {
	private scene: Scene;
	
	constructor(scene: Scene) {
		this.scene = scene;
	}

	public static readonly SplitModes = {
		VERTICAL: 'vertical',
		DIAGONAL: 'diagonal',
		DIAGONAL_REVERSE: 'diagonal_reverse',
		DIAGONAL_HEIGHT: 'diagonal_height',
		DIAGONAL_HEIGHT_REVERSE: 'diagonal_height_reverse',
	} as const;

	/**
	 * Plays the split animation on a given sprite/image.
	 * - Duplicates the target into two cropped halves
	 * - Hides the original during the animation
	 * - Moves halves outward to the left/right screen edges
	 * - Destroys the halves when complete
	 * - By default restores the original when complete (optionally destroys it)
	 *
	 * Returns a Promise that resolves when the animation finishes.
	 */
	public async playOn(
		target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
		duration: number = 300,
        delay: number = 250,
		ease: string = 'Cubic.easeInOut',
        targetPosition?: number,
		splitMode: SplitTransitionMode = SplitTransition.SplitModes.VERTICAL,
		diagonalOffsetRatio: number = 0.18,
		moveAlongSplitNormal: boolean = false,
		moveAlongSplitTangent: boolean = false,
		offscreenPadding: number = 100,
		/**
		 * If true, destroys `target` after the transition finishes. If false, the target is
		 * restored (made visible again) and left intact.
		 */
		destroyTargetOnComplete: boolean = false
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
		const bgDepth = halvesDepth - 1;

		// White backdrop behind the loading background/split halves.
		// This will fade out at the end of the split movement.
		const whiteBackdrop = this.scene.add
			.rectangle(cam.midPoint.x, cam.midPoint.y, cam.width, cam.height, 0xffffff, 1)
			.setOrigin(0.5)
			.setScrollFactor(0)
			.setDepth(bgDepth);

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

		// Compute where each half's center should end up.
		// Default: lateral X slide to left/right edges (existing behavior)
		// Optional: move along the split normal (diagonal separation) while still sliding "apart".
		const excessFinalX = offscreenPadding;
		let leftFinalX = targetPosition ? this.scene.scale.width / 2 - targetPosition - excessFinalX : view.left - excessFinalX;
		let rightFinalX = targetPosition ? this.scene.scale.width / 2 + targetPosition + excessFinalX : view.right + excessFinalX;
		let leftFinalY = target.y;
		let rightFinalY = target.y;
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

		// Create right half clone
		const rightHalf = this.scene.add.image(target.x, y, target.texture.key, frame.name)
			.setOrigin(target.originX, target.originY)
			.setScale(target.scaleX, target.scaleY)
			.setRotation(target.rotation)
			.setFlip((target as any).flipX ?? false, (target as any).flipY ?? false)
			.setDepth(target.depth + 1)
			.setAlpha(target.alpha)
			.setScrollFactor((target as any).scrollFactorX ?? 1, (target as any).scrollFactorY ?? 1);

		// Split implementation: vertical uses crop (fast, axis-aligned), diagonal uses geometry masks (polygon clip).
		let leftMaskGfx: Phaser.GameObjects.Graphics | undefined;
		let rightMaskGfx: Phaser.GameObjects.Graphics | undefined;
		// Cache mask anchor offsets (origin-aware) so we don't recompute per-frame.
		let maskOffsetX = 0;
		let maskOffsetY = 0;
		// If we are moving along the split normal/tangent, compute the direction vector after we know the split line.
		let moveNormal: Phaser.Math.Vector2 | undefined;
		let moveTangent: Phaser.Math.Vector2 | undefined;
		if (splitMode === SplitTransition.SplitModes.VERTICAL) {
			leftHalf.setCrop(0, 0, Math.floor(frameWidth / 2), frameHeight);
			rightHalf.setCrop(Math.floor(frameWidth / 2), 0, Math.ceil(frameWidth / 2), frameHeight);

			if (moveAlongSplitNormal) {
				// Vertical split -> normal points left (-x). Right half moves opposite (+x).
				moveNormal = new Phaser.Math.Vector2(-1, 0);
			}
			if (moveAlongSplitTangent) {
				// Vertical split line -> tangent points down (+y). Right half moves opposite (up).
				moveTangent = new Phaser.Math.Vector2(0, 1);
			}
		} else {
			// Clamp offset ratio so we never exceed the image bounds.
			const clampedOffset = Phaser.Math.Clamp(diagonalOffsetRatio, 0, 0.49);

			// Display-space dimensions (after scaling)
			const displayW = frameWidth * leftHalf.scaleX;
			const displayH = frameHeight * leftHalf.scaleY;

			// Compute top-left of the image in world space (origin-aware)
			// IMPORTANT: our mask graphics are positioned at the image's top-left, not its origin.
			// We'll keep them synced to the image every frame during the tween to avoid drift.
			maskOffsetX = displayW * leftHalf.originX;
			maskOffsetY = displayH * leftHalf.originY;
			const topLeftX = leftHalf.x - maskOffsetX;
			const topLeftY = leftHalf.y - maskOffsetY;

			const isHeightCut =
				splitMode === SplitTransition.SplitModes.DIAGONAL_HEIGHT ||
				splitMode === SplitTransition.SplitModes.DIAGONAL_HEIGHT_REVERSE;
			const isReverse =
				splitMode === SplitTransition.SplitModes.DIAGONAL_REVERSE ||
				splitMode === SplitTransition.SplitModes.DIAGONAL_HEIGHT_REVERSE;

			// We create two complementary polygons separated by a diagonal line passing through center.
			// - width cut: line intersects TOP and BOTTOM edges (xTop/xBottom)
			// - height cut: line intersects LEFT and RIGHT edges (yLeft/yRight)
			const dir = isReverse ? -1 : 1;

			// Compute split line endpoints in local image space, so we can derive a normal for motion.
			// We'll move halves along the normal (perpendicular to the cut), which reads as "opening along the cut angle".
			const splitP0 = new Phaser.Math.Vector2();
			const splitP1 = new Phaser.Math.Vector2();

			// Left mask graphics (in local coordinates), positioned at the image's top-left.
			leftMaskGfx = this.scene.add.graphics();
			leftMaskGfx.setPosition(topLeftX, topLeftY);
			leftMaskGfx.setScrollFactor((leftHalf as any).scrollFactorX ?? 1, (leftHalf as any).scrollFactorY ?? 1);
			leftMaskGfx.fillStyle(0xffffff, 1);
			leftMaskGfx.beginPath();
			if (!isHeightCut) {
				// width cut (existing): "left-ish" half
				const xTop = displayW * 0.5 - dir * displayW * clampedOffset;
				const xBottom = displayW * 0.5 + dir * displayW * clampedOffset;
				splitP0.set(xTop, 0);
				splitP1.set(xBottom, displayH);
				leftMaskGfx.moveTo(0, 0);
				leftMaskGfx.lineTo(xTop, 0);
				leftMaskGfx.lineTo(xBottom, displayH);
				leftMaskGfx.lineTo(0, displayH);
			} else {
				// height cut (new): "top-ish" half (still slides left on x)
				const yLeft = displayH * 0.5 - dir * displayH * clampedOffset;
				const yRight = displayH * 0.5 + dir * displayH * clampedOffset;
				splitP0.set(0, yLeft);
				splitP1.set(displayW, yRight);
				leftMaskGfx.moveTo(0, 0);
				leftMaskGfx.lineTo(displayW, 0);
				leftMaskGfx.lineTo(displayW, yRight);
				leftMaskGfx.lineTo(0, yLeft);
			}
			leftMaskGfx.closePath();
			leftMaskGfx.fillPath();
			leftMaskGfx.setVisible(false);

			// Right mask graphics (complement polygon)
			rightMaskGfx = this.scene.add.graphics();
			rightMaskGfx.setPosition(topLeftX, topLeftY);
			rightMaskGfx.setScrollFactor((rightHalf as any).scrollFactorX ?? 1, (rightHalf as any).scrollFactorY ?? 1);
			rightMaskGfx.fillStyle(0xffffff, 1);
			rightMaskGfx.beginPath();
			if (!isHeightCut) {
				// width cut (existing): "right-ish" half
				const xTop = displayW * 0.5 - dir * displayW * clampedOffset;
				const xBottom = displayW * 0.5 + dir * displayW * clampedOffset;
				rightMaskGfx.moveTo(xTop, 0);
				rightMaskGfx.lineTo(displayW, 0);
				rightMaskGfx.lineTo(displayW, displayH);
				rightMaskGfx.lineTo(xBottom, displayH);
			} else {
				// height cut (new): "bottom-ish" half (still slides right on x)
				const yLeft = displayH * 0.5 - dir * displayH * clampedOffset;
				const yRight = displayH * 0.5 + dir * displayH * clampedOffset;
				rightMaskGfx.moveTo(0, yLeft);
				rightMaskGfx.lineTo(displayW, yRight);
				rightMaskGfx.lineTo(displayW, displayH);
				rightMaskGfx.lineTo(0, displayH);
			}
			rightMaskGfx.closePath();
			rightMaskGfx.fillPath();
			rightMaskGfx.setVisible(false);

			leftHalf.setMask(leftMaskGfx.createGeometryMask());
			rightHalf.setMask(rightMaskGfx.createGeometryMask());

			{
				const lineDir = splitP1.clone().subtract(splitP0);
				const lenLine = lineDir.length();
				if (lenLine > 0) {
					// Tangent is the cut direction itself (along the diagonal seam).
					moveTangent = lineDir.clone().scale(1 / lenLine);

					// Normal points to the "left half" side (matches the old "left goes left" intuition).
					// With y-down screen coords, (-dy, dx) gives the left-hand normal.
					moveNormal = new Phaser.Math.Vector2(-moveTangent.y, moveTangent.x);
				}
			}

			// Helper to keep the mask graphics perfectly aligned with each half.
			const syncMaskToHalf = (half: Phaser.GameObjects.Image, mask: Phaser.GameObjects.Graphics) => {
				mask.setPosition(half.x - maskOffsetX, half.y - maskOffsetY);
			};
			// Initial sync (in case any upstream code changed positions after we created masks)
			syncMaskToHalf(leftHalf, leftMaskGfx);
			syncMaskToHalf(rightHalf, rightMaskGfx);
		}

		// Optional: replace the final destinations with a movement along the split direction.
		// - normal: perpendicular to seam (opens "away" from the cut)
		// - tangent: along seam (moves "in the direction of the angle")
		const moveVector =
			moveAlongSplitTangent ? moveTangent :
			moveAlongSplitNormal ? moveNormal :
			undefined;
		if (moveVector) {
			// Move far enough so pieces are fully off-screen in any direction.
			const distance = Math.max(cam.width, cam.height) + offscreenPadding;
			leftFinalX = leftHalf.x + moveVector.x * distance;
			leftFinalY = leftHalf.y + moveVector.y * distance;
			rightFinalX = rightHalf.x - moveVector.x * distance;
			rightFinalY = rightHalf.y - moveVector.y * distance;
		}

		// Elevate halves above everything else but below the blocker
		leftHalf.setDepth(halvesDepth);
		rightHalf.setDepth(halvesDepth);


		await new Promise<void>((resolve) => {
			let completed = 0;
			let finishing = false;
			let shineTriggered = false;
			let cleanedUp = false;

			let openDelayTimer: Phaser.Time.TimerEvent | undefined;
			const activeTweens: any[] = [];
			let whiteFadeTween: Phaser.Tweens.Tween | undefined;

			const safeDestroy = (obj: any) => {
				try {
					if (obj && !obj.destroyed) obj.destroy();
				} catch (_e) {
					/* no-op */
				}
			};

			const resetPipeline = (obj?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite) => {
				try {
					obj?.resetPipeline?.();
					if (obj) (obj as any).pipelineData = undefined;
				} catch (_e) {
					/* no-op */
				}
			};

			let detachSceneEvents = () => {};

			const cleanupAndResolve = () => {
				if (cleanedUp) return;
				cleanedUp = true;

				detachSceneEvents();

				try {
					openDelayTimer?.remove(false);
				} catch (_e) {
					/* no-op */
				}
				openDelayTimer = undefined;

				try {
					for (const t of activeTweens) t.stop();
					whiteFadeTween?.stop();
				} catch (_e) {
					/* no-op */
				}

				// Cleanup and restore original
				if (keyboard && prevKeyboardEnabled !== undefined) {
					keyboard.enabled = prevKeyboardEnabled;
				}
				safeDestroy(blocker);
				// Note: masks are owned by their graphics objects; destroy them explicitly.
				try {
					leftHalf.clearMask(true);
					rightHalf.clearMask(true);
				} catch (_e) {
					/* no-op */
				}
				safeDestroy(leftMaskGfx);
				safeDestroy(rightMaskGfx);
				resetPipeline(leftHalf);
				resetPipeline(rightHalf);
				safeDestroy(leftHalf);
				safeDestroy(rightHalf);

				if (destroyTargetOnComplete) {
					safeDestroy(target);
				} else {
					try {
						target.setVisible(true);
					} catch (_e) {
						/* no-op */
					}
				}

				safeDestroy(whiteBackdrop);
				resolve();
			};

			// Ensure we don't leak if the scene transitions away mid-effect.
			try {
				this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupAndResolve);
				this.scene.events.once(Phaser.Scenes.Events.DESTROY, cleanupAndResolve);
				detachSceneEvents = () => {
					try {
						this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanupAndResolve);
						this.scene.events.off(Phaser.Scenes.Events.DESTROY, cleanupAndResolve);
					} catch (_e) {
						/* no-op */
					}
				};
			} catch (_e) {
				/* no-op */
			}

			// Trigger the shine shader once, immediately when the transition starts (before the delay).
			// We apply it to the halves (the original is hidden so we don't double-draw).
			if (!shineTriggered) {
				shineTriggered = true;
				const baseCfg = SPLIT_TRANSITION_SHINE_SHADER_CONFIG;
				const thicknessPx = baseCfg.thicknessPx ?? 20;
				const timeOffsetSec = this.scene.game.loop.time / 1000;

				const startYPx =
					typeof baseCfg.startYPx === 'number'
						? baseCfg.startYPx
						: (leftHalf.displayHeight + thicknessPx * 0.5);

				const pipelineData = {
					...baseCfg,
					timeOffsetSec,
					startYPx,
				};

				target.setVisible(false);
				leftHalf.setPipeline(IMAGE_SHINE_PIPELINE_KEY, pipelineData);
				rightHalf.setPipeline(IMAGE_SHINE_PIPELINE_KEY, pipelineData);
			}

			const onDone = () => {
				completed += 1;
				if (completed === 2 && !finishing) {
					finishing = true;
					// Fade out the white background once the split movement is finished.
					whiteFadeTween = this.scene.tweens.add({
						targets: whiteBackdrop,
						alpha: 0,
						duration: 200,
						ease: 'Linear',
						onComplete: cleanupAndResolve
					});
				}
			};

            const openAnimation = () => {
				if (cleanedUp) return;
				if (!this.scene.sys || !this.scene.sys.isActive()) {
					cleanupAndResolve();
					return;
				}

				// Movement is intentionally split into 2 parts:
				// - Part 1: tiny displacement over most of the duration (slow "nudge")
				// - Part 2: large displacement over a very short duration (fast "snap")
				// Tune how far the slow "nudge" travels (as a ratio of total travel distance).
				// Example: 0.05 = 5% slow, 95% fast.
				const slowPartTravelRatio = 0.015;
				// Instead of a pause, we do a "creep" phase:
				// - very small additional displacement
				// - very long duration
				// This creep is INCLUDED in `duration` (i.e., slow + creep + fast === duration).
				const creepPartDurationRatio = 0.85;
				// Additional travel performed during the creep phase (ratio of total travel).
				// Example: 0.005 = +0.5% travel during the long creep.
				const creepPartExtraTravelRatio = 0.005;
				// Tune how short the "fast snap" phase is (as a ratio of total duration).
				// Increasing this makes the FIRST phase end sooner (so it feels less slow).
				const fastPartDurationRatio = 0.075;
				const addTwoPartMove = (
					half: Phaser.GameObjects.Image,
					finalX: number,
					finalY: number,
					maskGfx?: Phaser.GameObjects.Graphics
				) => {
					const startX = half.x;
					const startY = half.y;
					const dx = finalX - startX;
					const dy = finalY - startY;

					const fastDuration = Math.max(1, Math.floor(duration * fastPartDurationRatio));
					let creepDuration = Math.max(0, Math.floor(duration * creepPartDurationRatio));
					let slowDuration = duration - fastDuration - creepDuration;
					// If the configured ratios oversubscribe the duration, steal time from creep first.
					if (slowDuration < 1) {
						const minSlow = 1;
						const maxCreep = Math.max(0, duration - fastDuration - minSlow);
						creepDuration = Math.min(creepDuration, maxCreep);
						slowDuration = duration - fastDuration - creepDuration;
					}

					const midRatio1 = Phaser.Math.Clamp(slowPartTravelRatio, 0, 1);
					const midRatio2 = Phaser.Math.Clamp(midRatio1 + creepPartExtraTravelRatio, 0, 1);
					const midX1 = startX + dx * midRatio1;
					const midY1 = startY + dy * midRatio1;
					const midX2 = startX + dx * midRatio2;
					const midY2 = startY + dy * midRatio2;

					const updateMask = () => {
						if (!maskGfx) return;
						// Keep the diagonal mask locked to the moving image (no independent tween drift)
						maskGfx.setPosition(half.x - maskOffsetX, half.y - maskOffsetY);
					};

					// TweenChain-based move: fewer userland tween objects + no nested callbacks.
					// (Uses Phaser's TweenChain system, which is typed in this repo.)
					const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = [
						{
							targets: half,
							x: midX1,
							y: midY1,
							duration: Math.max(1, slowDuration),
							ease,
							onUpdate: updateMask,
						},
					];

					if (creepDuration > 0 && (midRatio2 !== midRatio1)) {
						tweens.push({
							targets: half,
							x: midX2,
							y: midY2,
							duration: creepDuration,
							ease: 'Linear',
							onUpdate: updateMask,
						});
					}

					tweens.push({
						targets: half,
						x: finalX,
						y: finalY,
						duration: fastDuration,
						ease,
						onUpdate: updateMask,
					});

					const chain = this.scene.tweens.chain({
						targets: half,
						tweens,
						onComplete: onDone,
					});
					activeTweens.push(chain);
				};

				addTwoPartMove(leftHalf, leftFinalX, leftFinalY, leftMaskGfx);
				addTwoPartMove(rightHalf, rightFinalX, rightFinalY, rightMaskGfx);
            }

            openDelayTimer = this.scene.time.delayedCall(delay, openAnimation);
		});
	}
}