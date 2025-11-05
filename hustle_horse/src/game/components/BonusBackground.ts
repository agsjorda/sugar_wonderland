import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private fireworksContainer?: Phaser.GameObjects.Container;
	private fireworksSpine?: any;
	private fireworksActive: boolean = false;
	private respawnTimer?: Phaser.Time.TimerEvent;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		console.log("[BonusBackground] Assets loaded centrally through AssetConfig");
	}

	create(scene: Scene): void {
		this.bonusContainer = scene.add.container(0, 0);
		this.bonusContainer.setDepth(-10);
		this.createBackground(scene);

		// Create fireworks container layered above bonus background image but below UI
		this.fireworksContainer = scene.add.container(0, 0);
		this.fireworksContainer.setDepth(-9); // between layers (conceptually: Sky-Bonus < fireworks < Roof-Bonus)
		this.fireworksContainer.setVisible(false);
		this.bonusContainer.add(this.fireworksContainer);

		// Listen for bonus mode toggles to start/stop fireworks
		scene.events.on('setBonusMode', (isBonus: boolean) => {
			if (isBonus) {
				this.startFireworks(scene);
			} else {
				this.stopFireworks();
			}
		});
	}

	private createBackground(scene: Scene): void {
		const bg = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			"BG-Bonus"
		).setOrigin(0.5, 0.5);
		this.bonusContainer.add(bg);

		const scaleX = scene.scale.width / bg.width;
		const scaleY = scene.scale.height / bg.height;
		const coverScale = Math.max(scaleX, scaleY);
		bg.setScale(coverScale);
	}

	private startFireworks(scene: Scene): void {
		if (!this.fireworksContainer) return;
		this.fireworksActive = true;
		this.fireworksContainer.setVisible(true);
		this.spawnOneFirework(scene);
	}

	private stopFireworks(): void {
		this.fireworksActive = false;
		try { this.respawnTimer?.remove?.(); } catch {}
		this.respawnTimer = undefined;
		if (this.fireworksSpine) {
			try { this.fireworksSpine.destroy(); } catch {}
			this.fireworksSpine = undefined;
		}
		if (this.fireworksContainer) {
			this.fireworksContainer.setVisible(false);
		}
	}

	private spawnOneFirework(scene: Scene): void {
		if (!this.fireworksActive || !this.fireworksContainer) return;
		// Ensure spine ready
		if (!ensureSpineFactory(scene, '[BonusBackground] fireworks')) {
			// Retry shortly if plugin not yet ready
			scene.time.delayedCall(200, () => this.spawnOneFirework(scene));
			return;
		}
		if (!(scene.cache.json as any).has('fireworks')) {
			// Retry until assets available
			scene.time.delayedCall(200, () => this.spawnOneFirework(scene));
			return;
		}

		// Clean any previous
		if (this.fireworksSpine) {
			try { this.fireworksSpine.destroy(); } catch {}
			this.fireworksSpine = undefined;
		}

		// Random position in upper half
		const x = scene.scale.width * (0.15 + Math.random() * 0.7);
		const y = scene.scale.height * (0.18 + Math.random() * 0.25);
		const spine = scene.add.spine(x, y, 'fireworks', 'fireworks-atlas');
		spine.setOrigin(0.5, 0.5);
		spine.setScale(1.1);
		spine.setDepth(0);
		this.fireworksContainer.add(spine);
		this.fireworksSpine = spine;

		// Pick a random non-loop animation
		let animName: string | undefined;
		try {
			const anims: any[] = spine?.skeleton?.data?.animations || [];
			if (anims.length > 0) {
				animName = anims[Math.floor(Math.random() * anims.length)]?.name;
			}
		} catch {}
		if (!animName) animName = 'animation'; // common fallback

		try {
			const track = spine.animationState.setAnimation(0, animName, false);
			// When complete, spawn a new firework after a small random delay
			spine.animationState.addListener({
				complete: (_entry: any) => {
					try { spine.destroy(); } catch {}
					if (!this.fireworksActive) return;
					const delay = 200 + Math.random() * 600;
					this.respawnTimer = scene.time.delayedCall(delay, () => this.spawnOneFirework(scene));
				}
			});
		} catch {
			// Safety: if animation fails, try again soon
			scene.time.delayedCall(400, () => this.spawnOneFirework(scene));
		}
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	destroy(): void {
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
	}
}


