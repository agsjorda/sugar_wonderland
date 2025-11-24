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
	// Fireworks configuration (disabled by default – assets were removed for this game)
	private fireworkMode: 'random' | 'fixedLine' = 'random';
	private fireworkLineXMul: number = 0.1; // 0..1 across width
	private fireworkYMinMul: number = 0.05; // normalized height
	private fireworkYMaxMul: number = 0.10; // normalized height
	private fireworkScale: number = 0.4;
	private fireworksPerInterval: number = 0;
	private fireworkIntervalMs: number = 600;
	private activeFireworks: number = 2;
	private fireworkSfxVolume: number = 0.3;

	// Bonus embers (independent from base scene)
	private embersContainer?: Phaser.GameObjects.Container;
	private emberParticles: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; size: number; color: number; alpha: number; lifetime: number; age: number; screenWidth: number; screenHeight: number; }>=[];
	private emberParticleCount: number = 40;
	private emberScreenMargin: number = 80;
	private emberWindDirectionX: number = 0;
	private emberWindDirectionY: number = 0;
	private emberWindStrength: number = 0;
	private emberWindChangeTimer: number = 0;
	private emberWindChangeInterval: number = 3000;
	private emberWindStrengthMax: number = 0.8;
	private emberAlphaMin: number = 0.25;
	private emberAlphaMax: number = 0.8;
	private emberSizeMin: number = 1.5;
	private emberSizeMax: number = 3.5;
	private emberUpdateHandler?: (time: number, delta: number) => void;

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
		this.fireworksContainer.setDepth(-9); // scene-level: between BG (-10) and roof (50)
		this.fireworksContainer.setVisible(false);

		// Listen for bonus mode toggles to start/stop fireworks
		scene.events.on('setBonusMode', (isBonus: boolean) => {
			if (isBonus) {
				this.startFireworks(scene);
			} else {
				this.stopFireworks();
			}
		});

		// Allow external stop (e.g., on congrats overlay)
		scene.events.on('stopBonusEffects', () => {
			this.stopFireworks();
			this.stopBonusEmbers();
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
		this.startBonusEmbers(scene);
		this.scheduleNextBurst(scene);
	}

	private stopFireworks(): void {
		this.fireworksActive = false;
		try { this.respawnTimer?.remove?.(); } catch {}
		this.respawnTimer = undefined;
		this.activeFireworks = 0;
		if (this.fireworksSpine) {
			try { this.fireworksSpine.destroy(); } catch {}
			this.fireworksSpine = undefined;
		}
		if (this.fireworksContainer) {
			this.fireworksContainer.setVisible(false);
		}
		this.stopBonusEmbers();
	}

	private scheduleNextBurst(scene: Scene): void {
		if (!this.fireworksActive) return;
		const count = Math.max(0, Math.floor(this.fireworksPerInterval));
		for (let i = 0; i < count; i++) {
			this.spawnOneFirework(scene);
		}
		const delay = Math.max(100, Math.floor(this.fireworkIntervalMs));
		this.respawnTimer = scene.time.delayedCall(delay, () => this.scheduleNextBurst(scene));
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

		// Compute spawn position
		let x: number;
		if (this.fireworkMode === 'fixedLine') {
			x = scene.scale.width * this.fireworkLineXMul;
		} else {
			x = scene.scale.width * (0.15 + Math.random() * 0.7);
		}
		const yRange = Math.max(0, this.fireworkYMaxMul - this.fireworkYMinMul);
		const y = scene.scale.height * (this.fireworkYMinMul + Math.random() * yRange);
		const spine = scene.add.spine(x, y, 'fireworks', 'fireworks-atlas');
		spine.setOrigin(0.5, 0.5);
		spine.setScale(this.fireworkScale);
		spine.setDepth(-9);
		this.fireworksContainer.add(spine);
		this.fireworksSpine = spine;
		this.activeFireworks++;

		// Play per-spawn SFX
		try {
			const audio = (window as any).audioManager;
			if (audio && typeof audio.playOneShot === 'function') {
				audio.playOneShot('fireworks_hh', this.fireworkSfxVolume);
			}
		} catch {}

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
			spine.animationState.setAnimation(0, animName, false);
			spine.animationState.addListener({
				complete: (_entry: any) => {
					try { spine.destroy(); } catch {}
					this.activeFireworks = Math.max(0, this.activeFireworks - 1);
				}
			});
		} catch {
			// Safety: if animation fails, try again soon
			scene.time.delayedCall(400, () => this.spawnOneFirework(scene));
		}
	}

	public configureFireworks(config: {
		mode?: 'random' | 'fixedLine';
		lineXMul?: number;
		yMinMul?: number;
		yMaxMul?: number;
		scale?: number;
		perInterval?: number;
		intervalMs?: number;
		sfxVolume?: number;
	}): void {
		if (config.mode) this.fireworkMode = config.mode;
		if (typeof config.lineXMul === 'number') this.fireworkLineXMul = config.lineXMul;
		if (typeof config.yMinMul === 'number') this.fireworkYMinMul = config.yMinMul;
		if (typeof config.yMaxMul === 'number') this.fireworkYMaxMul = config.yMaxMul;
		if (typeof config.scale === 'number') this.fireworkScale = config.scale;
		if (typeof config.perInterval === 'number') this.fireworksPerInterval = Math.max(0, Math.floor(config.perInterval));
		if (typeof config.intervalMs === 'number') this.fireworkIntervalMs = Math.max(100, Math.floor(config.intervalMs));
		if (typeof config.sfxVolume === 'number') this.fireworkSfxVolume = Math.max(0, Math.min(1, config.sfxVolume));
		if (this.fireworkYMaxMul < this.fireworkYMinMul) {
			const t = this.fireworkYMinMul;
			this.fireworkYMinMul = this.fireworkYMaxMul;
			this.fireworkYMaxMul = t;
		}
	}

	// ===== Bonus embers system =====
	private startBonusEmbers(scene: Scene): void {
		try { this.stopBonusEmbers(); } catch {}
		this.embersContainer = scene.add.container(0, 0);
		// Place between BG (-10) and fireworks (-9)
		try { this.embersContainer.setDepth(-9.5 as any); } catch {}
		this.emberParticles = [];
		// Create initial particles
		const w = scene.scale.width;
		const h = scene.scale.height;
		for (let i = 0; i < this.emberParticleCount; i++) {
			this.createOneEmber(scene, w, h);
		}
		// Hook update loop
		this.emberUpdateHandler = (_t: number, d: number) => this.updateEmbers(scene, d);
		try { scene.events.on('update', this.emberUpdateHandler, this); } catch {}
	}

	private stopBonusEmbers(): void {
		const scene = (this.bonusContainer && (this.bonusContainer.scene as any)) as Scene | undefined;
		try { if (scene && this.emberUpdateHandler) scene.events.off('update', this.emberUpdateHandler, this); } catch {}
		this.emberUpdateHandler = undefined;
		// Destroy particles
		if (this.emberParticles && this.emberParticles.length) {
			for (const p of this.emberParticles) { try { p.graphics.destroy(); } catch {} }
		}
		this.emberParticles = [];
		try { this.embersContainer?.destroy(true); } catch {}
		this.embersContainer = undefined;
	}

	private createOneEmber(scene: Scene, screenWidth: number, screenHeight: number): void {
		const g = scene.add.graphics();
		if (this.embersContainer) this.embersContainer.add(g);
		const x = Math.random() * (screenWidth + this.emberScreenMargin * 2) - this.emberScreenMargin;
		const y = Math.random() * (screenHeight + this.emberScreenMargin * 2) - this.emberScreenMargin;
		const size = Math.random() * (this.emberSizeMax - this.emberSizeMin) + this.emberSizeMin;
		const colors = [0xffd700, 0xffe04a, 0xfff0a0, 0xffc107];
		const color = colors[Math.floor(Math.random() * colors.length)];
		const alpha = Math.random() * (this.emberAlphaMax - this.emberAlphaMin) + this.emberAlphaMin;
		const lifetime = Math.random() * 10000 + 5000;
		const particle = { graphics: g, x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size, color, alpha, lifetime, age: 0, screenWidth, screenHeight };
		this.emberParticles.push(particle);
		this.drawEmber(particle);
	}

	private drawEmber(p: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; size: number; color: number; alpha: number; }): void {
		const { graphics, x, y, size, color, alpha } = p;
		graphics.clear();
		const w = size * (Math.random() * 0.8 + 0.6);
		const h = size * (Math.random() * 1.2 + 0.8);
		graphics.fillStyle(color, alpha * 0.10); graphics.fillEllipse(x, y, w * 3.0, h * 3.0);
		graphics.fillStyle(color, alpha * 0.20); graphics.fillEllipse(x, y, w * 2.2, h * 2.2);
		graphics.fillStyle(color, alpha * 0.40); graphics.fillEllipse(x, y, w * 1.5, h * 1.5);
		graphics.fillStyle(color, alpha * 0.70); graphics.fillEllipse(x, y, w * 0.8, h * 0.8);
		graphics.fillStyle(0xffffaa, alpha * 0.30); graphics.fillEllipse(x, y, w * 0.35, h * 0.35);
	}

	private updateEmbers(scene: Scene, delta: number): void {
		if (!this.emberParticles || !this.embersContainer) return;
		this.emberWindChangeTimer += delta;
		if (this.emberWindChangeTimer >= this.emberWindChangeInterval) {
			this.emberWindChangeTimer = 0;
			const windChance = Math.random();
			let dx = 0, dy = 0, s = 0;
			if (windChance < 0.60) {
				const dirIndex = Math.floor(windChance / 0.15);
				const dirs = [ {x:-1,y:0}, {x:1,y:0}, {x:-1,y:-1}, {x:1,y:-1} ];
				dx = dirs[dirIndex].x; dy = dirs[dirIndex].y; s = Math.random() * this.emberWindStrengthMax + 0.2;
			} else { dx = 0; dy = 0; s = Math.random() * 0.3; }
			this.emberWindDirectionX = dx; this.emberWindDirectionY = dy; this.emberWindStrength = s;
		}
		const sw = scene.scale.width;
		const sh = scene.scale.height;
		for (let i = this.emberParticles.length - 1; i >= 0; i--) {
			const p = this.emberParticles[i];
			p.age += delta;
			if (p.age > p.lifetime) {
				try { p.graphics.destroy(); } catch {}
				this.emberParticles.splice(i, 1);
				continue;
			}
			// Wind influence and jitter
			p.vx += this.emberWindDirectionX * this.emberWindStrength * 0.5;
			p.vy += this.emberWindDirectionY * this.emberWindStrength * 0.3;
			const rf = this.emberWindStrength > 0.5 ? 0.05 : 0.10;
			p.vx += (Math.random() - 0.5) * rf;
			p.vy += (Math.random() - 0.5) * rf;
			// Clamp
			p.vx = Math.max(-3, Math.min(3, p.vx));
			p.vy = Math.max(-2, Math.min(2, p.vy));
			p.x += p.vx; p.y += p.vy;
			// Wrap
			if (p.x < -this.emberScreenMargin) p.x = sw + this.emberScreenMargin; else if (p.x > sw + this.emberScreenMargin) p.x = -this.emberScreenMargin;
			if (p.y < -this.emberScreenMargin) p.y = sh + this.emberScreenMargin; else if (p.y > sh + this.emberScreenMargin) p.y = -this.emberScreenMargin;
			// Fade
			const ageRatio = p.age / p.lifetime; p.alpha = Math.max(0.1, 1 - ageRatio * 0.5);
			this.drawEmber(p);
		}
		// Maintain target count
		while (this.emberParticles.length < this.emberParticleCount) {
			this.createOneEmber(scene, sw, sh);
		}
	}

	public configureBonusEmbers(options: {
		count?: number;
		windStrengthMax?: number;
		sizeMin?: number;
		sizeMax?: number;
		alphaMin?: number;
		alphaMax?: number;
	}): void {
		if (typeof options.count === 'number') this.emberParticleCount = Math.max(0, Math.floor(options.count));
		if (typeof options.windStrengthMax === 'number') this.emberWindStrengthMax = Math.max(0, options.windStrengthMax);
		if (typeof options.sizeMin === 'number') this.emberSizeMin = Math.max(0.1, options.sizeMin);
		if (typeof options.sizeMax === 'number') this.emberSizeMax = Math.max(this.emberSizeMin, options.sizeMax);
		if (typeof options.alphaMin === 'number') this.emberAlphaMin = Math.max(0, Math.min(1, options.alphaMin));
		if (typeof options.alphaMax === 'number') this.emberAlphaMax = Math.max(this.emberAlphaMin, Math.min(1, options.alphaMax));
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


