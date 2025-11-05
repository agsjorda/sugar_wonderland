import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { TurboConfig } from '../../config/TurboConfig';
import { gameStateManager } from '../../managers/GameStateManager';
import { SCATTER_ANTICIPATION_POS_X_MUL, SCATTER_ANTICIPATION_POS_Y_MUL, SCATTER_ANTICIPATION_DEFAULT_SCALE } from '../../config/UIPositionConfig';

export class ScatterAnticipation {
	private scene: Scene;
	private container: Phaser.GameObjects.Container | null = null;
	private spineObject: any | null = null;
	private ownsContainer: boolean = false;
	private retryCount: number = 0;
	// Optional desired overrides applied on create or via setters
	private desiredX?: number;
	private desiredY?: number;
	private desiredScale?: number;

	private playDefaultLoop(): void {
		if (!this.spineObject) return;
		try {
			// Ensure track is clean and running
			this.spineObject.animationState.clearTracks();
			this.spineObject.animationState.timeScale = Math.max(0.0001, this.spineObject.animationState.timeScale || 1);
			// Try required default name first
			this.spineObject.animationState.setAnimation(0, 'default', true);
			console.log('[ScatterAnticipation] Playing animation: default (loop)');
			return;
		} catch {}

		// Fallback to first available animation if default missing
		try {
			const animations = this.spineObject?.skeleton?.data?.animations || [];
			const first = animations[0]?.name;
			if (first) {
				this.spineObject.animationState.setAnimation(0, first, true);
				console.log(`[ScatterAnticipation] 'default' not found. Playing first animation: ${first} (loop)`);
			}
		} catch {}
	}

	constructor() {}

	public create(scene: Scene, parentContainer?: Phaser.GameObjects.Container, options?: { x?: number; y?: number; scale?: number }): void {
		this.scene = scene;

		// Guard against missing spine factory
		if (!ensureSpineFactory(scene, '[ScatterAnticipation] create')) {
			console.warn('[ScatterAnticipation] Spine factory unavailable. Skipping creation.');
			return;
		}

		// Use provided parent container to guarantee layering relative to symbols
		if (parentContainer) {
			this.container = parentContainer;
			this.ownsContainer = false;
		} else {
			// Fallback: create our own container; place above all other layers
			this.container = scene.add.container(0, 0);
			this.container.setDepth(30000);
			this.ownsContainer = true;
		}


		// Capture desired overrides if provided
		this.desiredX = options?.x ?? this.desiredX;
		this.desiredY = options?.y ?? this.desiredY;
		this.desiredScale = options?.scale ?? this.desiredScale;

		const centerX = (this.desiredX !== undefined ? this.desiredX : scene.scale.width * SCATTER_ANTICIPATION_POS_X_MUL);
		const centerY = (this.desiredY !== undefined ? this.desiredY : scene.scale.height * SCATTER_ANTICIPATION_POS_Y_MUL);

		this.tryCreateSpine(centerX, centerY);
		this.setupTurboListeners();
		this.setupWinListeners();
	}

	private tryCreateSpine(centerX: number, centerY: number): void {
		if (!this.container) return;
		// Ensure spine data is in cache; if not, retry a few times
		if (!(this.scene.cache.json as any).has('Sparkler_Reel')) {
			if (this.retryCount < 5) {
				this.retryCount++;
				console.warn(`[ScatterAnticipation] Spine json 'Sparkler_Reel' not ready. Retrying (${this.retryCount}/5)...`);
				this.scene.time.delayedCall(250, () => this.tryCreateSpine(centerX, centerY));
				return;
			} else {
				console.error('[ScatterAnticipation] Spine assets still not ready after retries. Skipping creation.');
				return;
			}
		}

		try {
			this.spineObject = this.scene.add.spine(centerX, centerY, 'Sparkler_Reel', 'Sparkler_Reel-atlas');
			this.spineObject.setOrigin(0.5, 0.5);
			this.spineObject.setScale(this.desiredScale !== undefined ? this.desiredScale : SCATTER_ANTICIPATION_DEFAULT_SCALE);
			this.spineObject.setDepth(0);
			this.playDefaultLoop();
			this.applyTurboToAnticipation();
			this.container.add(this.spineObject);
			// Do not change visibility here; Game controls start visibility
			console.log('[ScatterAnticipation] Created spine animation at center');
		} catch (error) {
			console.error('[ScatterAnticipation] Failed to create spine animation', error);
		}
	}

	public setPosition(x: number, y: number): void {
		this.desiredX = x;
		this.desiredY = y;
		if (this.spineObject) {
			this.spineObject.setPosition(x, y);
		}
	}

	public setScale(scale: number): void {
		this.desiredScale = scale;
		if (this.spineObject) {
			this.spineObject.setScale(scale);
		}
	}

	public show(): void {
		if (this.container) {
			if (this.ownsContainer) {
				this.container.setVisible(true);
			} else if (this.spineObject) {
				this.spineObject.setVisible(true);
			}
			// Ensure animation is playing when shown and turbo applied
			this.playDefaultLoop();
			this.applyTurboToAnticipation();
			// Play anticipation loop SFX
			try {
				const audio = (window as any)?.audioManager;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect('anticipation');
				}
			} catch {}
		}
	}

	private applyTurboToAnticipation(): void {
		try {
			if (this.spineObject && this.spineObject.animationState) {
				// Increase timeScale when turbo is ON
				const isTurbo = (window as any)?.gameStateManager?.isTurbo ?? false;
				const speed = isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
				this.spineObject.animationState.timeScale = Math.max(0.0001, speed);
			}
		} catch {}
	}

	private setupTurboListeners(): void {
		try {
			gameEventManager.on(GameEventType.TURBO_ON, () => this.applyTurboToAnticipation());
			gameEventManager.on(GameEventType.TURBO_OFF, () => this.applyTurboToAnticipation());
		} catch {}
	}

	// On win: shake camera, send bottom dragon to right edge, then top to left after 0.9s
	private setupWinListeners(): void {
		try {
			const triggerSequence = () => {
				// Only run this movement in BASE scene, not during bonus
				try {
					if (gameStateManager?.isBonus) { return; }
					// Only when scatter is actually hit on the base spin
					if (!gameStateManager?.isScatter) { return; }
				} catch {}
				try {
					const turboMul = gameStateManager?.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
					const shakeMs = Math.max(50, Math.floor(2500 * turboMul));
					const cam = this.scene.cameras?.main;
					cam?.shake(shakeMs, 0.004);
				} catch {}
				try {
					const sceneAny = this.scene as any;
					const symbols = sceneAny?.symbols;
					if (symbols && typeof symbols.animateBottomDragonToX === 'function' && typeof symbols.animateTopDragonToX === 'function') {
						const turboMul = gameStateManager?.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
						const moveDur = Math.max(100, Math.floor(1200 * turboMul));
						const delayTop = Math.max(0, Math.floor(500 * turboMul));
						const rightX = this.scene.scale.width + 900;
						symbols.animateBottomDragonToX(rightX, moveDur, 'Sine.easeInOut');
						this.scene.time.delayedCall(delayTop, () => {
							const leftX = -900;
							symbols.animateTopDragonToX(leftX, moveDur, 'Sine.easeInOut');
						});
					}
				} catch {}
			};

			// General win (kept, but base-only gate inside trigger)
			gameEventManager.on(GameEventType.WIN_START, triggerSequence);
			// Scene-level scatter activation (kept)
			try { this.scene.events.on('scatterBonusActivated', triggerSequence); } catch {}
			// Precise: when Symbol0_HTBH actually starts its winning animation
			try { this.scene.events.on('symbol0-win-start', triggerSequence); } catch {}
		} catch {}
	}

	public hide(): void {
		if (!this.container) return;
		if (this.ownsContainer) {
			this.container.setVisible(false);
		} else if (this.spineObject) {
			this.spineObject.setVisible(false);
		}
		// Fade out anticipation SFX
		try {
			const audio = (window as any)?.audioManager;
			if (audio && typeof audio.fadeOutSfx === 'function') {
				audio.fadeOutSfx('anticipation', 300);
			}
		} catch {}
	}

	public destroy(): void {
		if (this.spineObject) {
			this.spineObject.destroy();
			this.spineObject = null;
		}
		if (this.container && this.ownsContainer) {
			this.container.destroy();
			this.container = null;
		}
	}
}


