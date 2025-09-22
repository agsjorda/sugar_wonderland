import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class ScatterAnticipation {
	private scene: Scene;
	private container: Phaser.GameObjects.Container | null = null;
	private spineObject: any | null = null;
	private ownsContainer: boolean = false;
	private retryCount: number = 0;

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

	public create(scene: Scene, parentContainer?: Phaser.GameObjects.Container): void {
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
			// Fallback: create our own container at a safe depth above background
			this.container = scene.add.container(0, 0);
			this.container.setDepth(1);
			this.ownsContainer = true;
		}


		const centerX = scene.scale.width * 0.87;
		const centerY = scene.scale.height * 0.49;

		this.tryCreateSpine(centerX, centerY);
	}

	private tryCreateSpine(centerX: number, centerY: number): void {
		if (!this.container) return;
		// Ensure spine data is in cache; if not, retry a few times
		if (!(this.scene.cache.json as any).has('reelanim_KA')) {
			if (this.retryCount < 5) {
				this.retryCount++;
				console.warn(`[ScatterAnticipation] Spine json 'reelanim_KA' not ready. Retrying (${this.retryCount}/5)...`);
				this.scene.time.delayedCall(250, () => this.tryCreateSpine(centerX, centerY));
				return;
			} else {
				console.error('[ScatterAnticipation] Spine assets still not ready after retries. Skipping creation.');
				return;
			}
		}

		try {
			this.spineObject = this.scene.add.spine(centerX, centerY, 'reelanim_KA', 'reelanim_KA-atlas');
			this.spineObject.setOrigin(0.5, 0.5);
			this.spineObject.setScale(0.42);
			this.spineObject.setDepth(0);
			this.playDefaultLoop();
			this.container.add(this.spineObject);
			// Do not change visibility here; Game controls start visibility
			console.log('[ScatterAnticipation] Created spine animation at center');
		} catch (error) {
			console.error('[ScatterAnticipation] Failed to create spine animation', error);
		}
	}

	public show(): void {
		if (this.container) {
			if (this.ownsContainer) {
				this.container.setVisible(true);
			} else if (this.spineObject) {
				this.spineObject.setVisible(true);
			}
			// Ensure animation is playing when shown
			this.playDefaultLoop();
		}
	}

	public hide(): void {
		if (!this.container) return;
		if (this.ownsContainer) {
			this.container.setVisible(false);
		} else if (this.spineObject) {
			this.spineObject.setVisible(false);
		}
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


