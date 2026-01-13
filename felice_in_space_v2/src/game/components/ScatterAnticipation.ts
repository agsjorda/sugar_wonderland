import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class ScatterAnticipation {
	private scene: Scene;
	private container: Phaser.GameObjects.Container | null = null;
	private spineObject: any | null = null;
	private ownsContainer: boolean = false;

	private readonly spineKey: string = 'scatter_anticipation_spine';

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

		// Always create our own container so we can safely show/hide and position without
		// affecting the parent container.
		this.container = scene.add.container(0, 0);
		this.ownsContainer = true;

		try {
			// Put it above the background art but (typically) behind symbols (symbols live in their own container).
			this.container.setDepth(5);
		} catch {}

		// If a parent container is provided, attach under it so it inherits that container's mask
		// (e.g. Symbols' reel window mask).
		if (parentContainer) {
			try {
				// Render behind symbols by default (insert at the start of the Symbols container).
				if (typeof (parentContainer as any).addAt === 'function') {
					(parentContainer as any).addAt(this.container, 0);
				} else {
					parentContainer.add(this.container);
				}
			} catch {}
		}

		// Create spine
		try {
			const atlasKey = `${this.spineKey}-atlas`;
			this.spineObject = (scene.add as any).spine(0, 0, this.spineKey, atlasKey);
			if (this.spineObject && typeof this.spineObject.setOrigin === 'function') {
				this.spineObject.setOrigin(0.5, 0.5);
			}
			if (this.container && this.spineObject) {
				this.container.add(this.spineObject);
			}
		} catch (e) {
			console.warn('[ScatterAnticipation] Failed to create spine object:', e);
			this.spineObject = null;
		}

		// Start hidden by default
		this.hide();
	}

	public setPosition(x: number, y: number): void {
		if (!this.container) return;
		try {
			this.container.setPosition(x, y);
		} catch {}
	}

	/**
	 * Best-effort sizing: scale the spine to match a desired display height.
	 */
	public setDesiredHeight(desiredHeight: number): void {
		if (!this.spineObject || !desiredHeight || desiredHeight <= 0) return;
		try {
			const h = Number(this.spineObject.height || this.spineObject.displayHeight || 0);
			if (!h || h <= 0) return;
			const s = desiredHeight / h;
			// Slightly stretch vertically to make the anticipation feel longer.
			const yStretch = 1.2;
			const xStretch = 0.7
			if (typeof this.spineObject.setScale === 'function') {
				// Phaser's setScale supports (x, y). Keep X fitted, increase Y by 10%.
				this.spineObject.setScale(s * xStretch, s * yStretch);
			} else {
				// Fallback for non-standard spine objects
				this.spineObject.scaleY = s * yStretch;
				this.spineObject.scaleX = s * xStretch;
			}
		} catch {}
	}

	public show(): void {
		if (this.container) {
			this.container.setVisible(true);
			// Ensure animation is playing when shown
			this.playDefaultLoop();
			// Play anticipation loop SFX
			try {
				const audio = (window as any)?.audioManager;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect('anticipation');
				}
			} catch {}
		}
	}

	public hide(): void {
		if (!this.container) return;
		this.container.setVisible(false);
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


