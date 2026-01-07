import { Scene } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale } from './SpineBehaviorHelper';

export class RainbowTransition {
	private scene: Scene | undefined;
	private rainbowSpine: SpineGameObject | undefined;
	private sparkleSpine: SpineGameObject | undefined;
	private rainbowListener: any;
	private sparkleListener: any;
	private progressTimer: Phaser.Time.TimerEvent | undefined;
	private isPlaying: boolean = false;

	/**
	 * Initialize the RainbowTransition component with a scene
	 */
	init(scene: Scene): void {
		this.scene = scene;
	}

	/**
	 * Play the rainbow transition animation with sparkle VFX
	 * @param onComplete Optional callback when the transition completes
	 * @param onProgress Optional callback called at intervals with progress (0-1)
	 * @param progressInterval Interval in milliseconds for progress callbacks (default: 250ms)
	 */
	playTransition(onComplete?: () => void, onProgress?: (progress: number) => void, progressInterval: number = 250): void {
		if (!this.scene) {
			console.warn('[RainbowTransition] Scene not initialized');
			onComplete?.();
			return;
		}

		if (this.isPlaying) {
			console.warn('[RainbowTransition] Transition already playing');
			return;
		}

		this.isPlaying = true;
		this.cleanup(); // Clean up any existing instances

		const transitionKey = 'rainbow_transition';
		const sparkleKey = 'sparkle_background';

		const centerX = this.scene.scale.width * 0.5;
		const centerY = this.scene.scale.height * 0.5;
		const transitionX = this.scene.scale.width * 0.165;
		const transitionY = this.scene.scale.height * 0.735;

		let completed = false;

		const cleanup = () => {
			try {
				if (this.rainbowSpine && this.rainbowListener) {
					const state: any = (this.rainbowSpine as any)?.animationState;
					state?.removeListener?.(this.rainbowListener);
				}
			} catch {}

			try {
				if (this.sparkleSpine && this.sparkleListener) {
					const state: any = (this.sparkleSpine as any)?.animationState;
					state?.removeListener?.(this.sparkleListener);
				}
			} catch {}

			try {
				if (this.progressTimer) {
					this.progressTimer.destroy();
					this.progressTimer = undefined;
				}
			} catch {}

			this.hideAndReset();
			this.rainbowSpine = undefined;
			this.sparkleSpine = undefined;
			this.rainbowListener = undefined;
			this.sparkleListener = undefined;
		};

		const finish = () => {
			if (completed) return;
			completed = true;
			this.isPlaying = false;
			cleanup();
			onComplete?.();
		};

		const fail = () => {
			if (completed) return;
			completed = true;
			this.isPlaying = false;
			cleanup();
			onComplete?.();
		};

		try {
			// Create sparkle VFX - loop for the full duration
			const addAny: any = this.scene.add;
			this.sparkleSpine = addAny.spine?.(centerX, centerY, sparkleKey, `${sparkleKey}-atlas`) as SpineGameObject;

			if (this.sparkleSpine) {
				this.sparkleSpine.setOrigin(0.5, 0.5);
				this.sparkleSpine.setScrollFactor(0);
				this.sparkleSpine.setDepth(30001); // Above rainbow transition
				this.sparkleSpine.setVisible(false); // Avoid flash on creation - will be revealed with rainbow
				this.sparkleSpine.setScale(0.7);

				const sparkleAnimations = (this.sparkleSpine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;
				if (sparkleAnimations && sparkleAnimations.length > 0) {
					const sparkleAnimationName = sparkleAnimations[0].name;
					const sparkleState: any = (this.sparkleSpine as any).animationState;
					if (sparkleState?.setAnimation) {
						sparkleState.setAnimation(0, sparkleAnimationName, true); // Loop
					}
				}
			}

			// Create rainbow transition - play once
			this.rainbowSpine = addAny.spine?.(0, 0, transitionKey, `${transitionKey}-atlas`) as SpineGameObject;
			if (!this.rainbowSpine) {
				fail();
				return;
			}

			const scale = getFullScreenSpineScale(this.scene, this.rainbowSpine, true);
			this.rainbowSpine.setPosition(transitionX, transitionY);
			this.rainbowSpine.setOrigin(0.5, 0.5);
			this.rainbowSpine.setScrollFactor(0);
			this.rainbowSpine.setDepth(30000);
			this.rainbowSpine.setVisible(false); // Avoid flash on creation
			this.rainbowSpine.setScale(scale.x * 1.1, scale.y * 1.1);

			const rainbowAnimations = (this.rainbowSpine as any)?.skeleton?.data?.animations as Array<{ name: string; duration: number }> | undefined;
			if (!rainbowAnimations || rainbowAnimations.length === 0) {
				fail();
				return;
			}

			const firstAnimation = rainbowAnimations[0];
			const rainbowState: any = (this.rainbowSpine as any).animationState;
			const entry = rainbowState?.setAnimation?.(0, firstAnimation.name, false); // Play once
			if (!entry) {
				fail();
				return;
			}

			// Reveal after first frame renders
			this.scene.time.delayedCall(30, () => {
				try {
					this.rainbowSpine?.setVisible(true);
					this.sparkleSpine?.setVisible(true); // Reveal sparkle at the same time as rainbow
				} catch {}
			});

			// Set normal speed
			rainbowState.timeScale = 1;

			// Calculate animation duration
			const durationMs = firstAnimation.duration > 0 ? firstAnimation.duration * 1000 : 1200;
			const durationSec = firstAnimation.duration > 0 ? firstAnimation.duration : 1.2;

			// Set up progress callback if provided
			if (onProgress && progressInterval > 0) {
				// Call immediately with 0 progress
				onProgress(0);

				// Set up repeating timer for progress updates
				this.progressTimer = this.scene.time.addEvent({
					delay: progressInterval,
					callback: () => {
						if (!this.rainbowSpine || completed) {
							return;
						}

						try {
							const state: any = (this.rainbowSpine as any)?.animationState;
							const tracks = state?.tracks;
							if (tracks && tracks.length > 0) {
								const trackEntry = tracks[0];
								// Get current animation time (animationTime is the time within the current animation)
								const currentTime = trackEntry?.animationTime || trackEntry?.trackTime || 0;
								// Calculate progress (0 to 1)
								const progress = Math.max(0, Math.min(1, currentTime / durationSec));
								onProgress(progress);

								// If we've reached the end, ensure we call with 1.0 and stop the timer
								if (progress >= 1.0) {
									onProgress(1.0);
									if (this.progressTimer) {
										this.progressTimer.destroy();
										this.progressTimer = undefined;
									}
								}
							}
						} catch (error) {
							console.warn('[RainbowTransition] Error calculating progress:', error);
						}
					},
					repeat: -1, // Repeat indefinitely until cleaned up
					loop: true
				});
			}

			// Listen for completion
			this.rainbowListener = {
				complete: () => {
					// Ensure final progress callback is called
					if (onProgress) {
						onProgress(1.0);
					}
					finish();
				}
			};
			rainbowState?.addListener?.(this.rainbowListener);

			// Safety timeout
			this.scene.time.delayedCall(durationMs + 500, () => {
				// Ensure final progress callback is called
				if (onProgress) {
					onProgress(1.0);
				}
				finish();
			});

		} catch (error) {
			console.warn('[RainbowTransition] Failed to play transition:', error);
			fail();
		}
	}

	/**
	 * Hide all spines and reset their animation states
	 */
	private hideAndReset(): void {
		try {
			if (this.rainbowSpine) {
				this.rainbowSpine.setVisible(false);
				const rainbowState: any = (this.rainbowSpine as any)?.animationState;
				if (rainbowState) {
					rainbowState.clearTracks();
					rainbowState.timeScale = 1;
				}
				try {
					this.rainbowSpine.destroy();
				} catch {}
			}
		} catch (error) {
			console.warn('[RainbowTransition] Error hiding rainbow spine:', error);
		}

		try {
			if (this.sparkleSpine) {
				this.sparkleSpine.setVisible(false);
				const sparkleState: any = (this.sparkleSpine as any)?.animationState;
				if (sparkleState) {
					sparkleState.clearTracks();
					sparkleState.timeScale = 1;
				}
				try {
					this.sparkleSpine.destroy();
				} catch {}
			}
		} catch (error) {
			console.warn('[RainbowTransition] Error hiding sparkle spine:', error);
		}
	}

	/**
	 * Clean up all resources
	 */
	cleanup(): void {
		try {
			if (this.progressTimer) {
				this.progressTimer.destroy();
				this.progressTimer = undefined;
			}
		} catch {}

		this.hideAndReset();
		this.isPlaying = false;
	}

	/**
	 * Play the rainbow transition animation backwards (from end to start) with sparkle VFX
	 * @param onComplete Optional callback when the transition completes
	 * @param onProgress Optional callback called at intervals with progress (0-1)
	 * @param progressInterval Interval in milliseconds for progress callbacks (default: 250ms)
	 */
	playTransitionBackwards(onComplete?: () => void, onProgress?: (progress: number) => void, progressInterval: number = 100): void {
		if (!this.scene) {
			console.warn('[RainbowTransition] Scene not initialized');
			onComplete?.();
			return;
		}

		if (this.isPlaying) {
			console.warn('[RainbowTransition] Transition already playing');
			return;
		}

		this.isPlaying = true;
		this.cleanup(); // Clean up any existing instances

		const transitionKey = 'rainbow_transition';
		const sparkleKey = 'sparkle_background';

		const centerX = this.scene.scale.width * 0.5;
		const centerY = this.scene.scale.height * 0.5;
		const transitionX = this.scene.scale.width * 0.165;
		const transitionY = this.scene.scale.height * 0.735;

		let completed = false;

		const cleanup = () => {
			try {
				if (this.rainbowSpine && this.rainbowListener) {
					const state: any = (this.rainbowSpine as any)?.animationState;
					state?.removeListener?.(this.rainbowListener);
				}
			} catch {}

			try {
				if (this.sparkleSpine && this.sparkleListener) {
					const state: any = (this.sparkleSpine as any)?.animationState;
					state?.removeListener?.(this.sparkleListener);
				}
			} catch {}

			try {
				if (this.progressTimer) {
					this.progressTimer.destroy();
					this.progressTimer = undefined;
				}
			} catch {}

			this.hideAndReset();
			this.rainbowSpine = undefined;
			this.sparkleSpine = undefined;
			this.rainbowListener = undefined;
			this.sparkleListener = undefined;
		};

		const finish = () => {
			if (completed) return;
			
			console.log('[RainbowTransition] Complete callback called (backup)');
			completed = true;
			this.isPlaying = false;
			cleanup();
			onComplete?.();
		};

		const fail = () => {
			if (completed) return;
			completed = true;
			this.isPlaying = false;
			cleanup();
			onComplete?.();
		};

		try {
			// Create sparkle VFX - loop for the full duration
			const addAny: any = this.scene.add;
			this.sparkleSpine = addAny.spine?.(centerX, centerY, sparkleKey, `${sparkleKey}-atlas`) as SpineGameObject;

			if (this.sparkleSpine) {
				this.sparkleSpine.setOrigin(0.5, 0.5);
				this.sparkleSpine.setScrollFactor(0);
				this.sparkleSpine.setDepth(30001); // Above rainbow transition
				this.sparkleSpine.setVisible(false); // Avoid flash on creation - will be revealed with rainbow
				this.sparkleSpine.setScale(0.7);

				const sparkleAnimations = (this.sparkleSpine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;
				if (sparkleAnimations && sparkleAnimations.length > 0) {
					const sparkleAnimationName = sparkleAnimations[0].name;
					const sparkleState: any = (this.sparkleSpine as any).animationState;
					if (sparkleState?.setAnimation) {
						sparkleState.setAnimation(0, sparkleAnimationName, true); // Loop
					}
				}
			}

			// Create rainbow transition - play backwards
			this.rainbowSpine = addAny.spine?.(0, 0, transitionKey, `${transitionKey}-atlas`) as SpineGameObject;
			if (!this.rainbowSpine) {
				fail();
				return;
			}

			const scale = getFullScreenSpineScale(this.scene, this.rainbowSpine, true);
			this.rainbowSpine.setPosition(transitionX, transitionY);
			this.rainbowSpine.setOrigin(0.5, 0.5);
			this.rainbowSpine.setScrollFactor(0);
			this.rainbowSpine.setDepth(30000);
			this.rainbowSpine.setVisible(false); // Ensure it's not visible
			this.rainbowSpine.setScale(scale.x * 1.1, scale.y * 1.1);

			const rainbowAnimations = (this.rainbowSpine as any)?.skeleton?.data?.animations as Array<{ name: string; duration: number }> | undefined;
			if (!rainbowAnimations || rainbowAnimations.length === 0) {
				fail();
				return;
			}

			const firstAnimation = rainbowAnimations[0];
			const rainbowState: any = (this.rainbowSpine as any).animationState;
			
			// Set animation duration
			const durationMs = firstAnimation.duration > 0 ? firstAnimation.duration * 1000 : 1200;
			const durationSec = firstAnimation.duration > 0 ? firstAnimation.duration : 1.2;

			// Set the animation to play backwards by:
			// 1. Setting the track time to the end of the animation
			// 2. Using negative timeScale to play backwards
			const entry = rainbowState?.setAnimation?.(0, firstAnimation.name, false); // Play once
			if (!entry) {
				fail();
				return;
			}

			// Set track time to the end of the animation
			if (entry.trackTime !== undefined) {
				entry.trackTime = durationSec;
			}
			if (entry.animationTime !== undefined) {
				entry.animationTime = durationSec;
			}

			// Set negative timeScale to play backwards
			rainbowState.timeScale = -1;

			// Reveal after animation state is properly set up
			this.scene.time.delayedCall(50, () => {
				try {
					if (this.rainbowSpine) {
						this.rainbowSpine.setVisible(true);
					}
					this.sparkleSpine?.setVisible(true); // Reveal sparkle at the same time as rainbow
				} catch {}
			});

			// Set up progress callback if provided
			if (onProgress && progressInterval > 0) {
				// Call immediately with 0.0 progress (animationTime = duration, so progress = 0)
				onProgress(0.0);

				// Set up repeating timer for progress updates
				this.progressTimer = this.scene.time.addEvent({
					delay: progressInterval,
					callback: () => {
						if (!this.rainbowSpine || completed) {
							return;
						}

						try {
							const state: any = (this.rainbowSpine as any)?.animationState;
							const tracks = state?.tracks;
							if (tracks && tracks.length > 0) {
								const trackEntry = tracks[0];
								// Get current animation time (animationTime is the time within the current animation)
								const currentTime = trackEntry?.animationTime || trackEntry?.trackTime || durationSec;
								// Calculate raw progress: when animationTime = duration, progress = 1.0; when animationTime = 0, progress = 0.0
								const progress = Math.max(0, Math.min(1, currentTime / durationSec));
								// Convert to user-facing progress: when animationTime = duration, progress = 0; when animationTime = 0, progress = 1
								onProgress(1.0 - progress);

								// If we've reached the end (animationTime = 0, so progress = 0), ensure we call with 1.0 and finish
								if (progress <= 0) {
									onProgress(1.0);
									if (this.progressTimer) {
										this.progressTimer.destroy();
										this.progressTimer = undefined;
									}
									finish();
								}
							}
						} catch (error) {
							console.warn('[RainbowTransition] Error calculating backwards progress:', error);
						}
					},
					repeat: -1, // Repeat indefinitely until cleaned up
					loop: true
				});
			}

			// Listen for completion as a backup (note: complete event may not fire reliably when playing backwards)
			// Primary completion detection is handled by the progress timer above
			this.rainbowListener = {
				complete: () => {
					// Note: This may not fire when playing backwards with negative timeScale
					// The progress timer handles completion detection instead
					if (onProgress) {
						onProgress(1.0);
					}
					finish();
				}
			};
			rainbowState?.addListener?.(this.rainbowListener);

			// Safety timeout
			this.scene.time.delayedCall(durationMs, () => {
				// Ensure final progress callback is called (animationTime = 0, progress = 1)
				if (onProgress) {
					onProgress(1.0);
				}
				finish();
			});

		} catch (error) {
			console.warn('[RainbowTransition] Failed to play backwards transition:', error);
			fail();
		}
	}

	/**
	 * Check if transition is currently playing
	 */
	isTransitionPlaying(): boolean {
		return this.isPlaying;
	}
}

