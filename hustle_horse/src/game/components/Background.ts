import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";

export class Background {
	private bgContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private sceneRef: Scene | null = null;

	// Ember/fiery particle system (inspired by warfreaks)
	private particles: Array<{
		graphics: Phaser.GameObjects.Graphics;
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		color: number;
		alpha: number;
		lifetime: number;
		age: number;
		screenWidth: number;
		screenHeight: number;
	}> = [];
	private readonly PARTICLE_COUNT: number = 30;
	private readonly SCREEN_MARGIN: number = 80;
	private windDirectionX: number = 0;
	private windDirectionY: number = 0;
	private windStrength: number = 0;
	private windChangeTimer: number = 0;
	private readonly WIND_CHANGE_INTERVAL: number = 3000;
	private readonly WIND_STRENGTH_MAX: number = 0.8;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Background] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Background] Creating background elements");
		this.sceneRef = scene;
		
		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);
		// Ensure background renders beneath base symbols background (-5)
		this.bgContainer.setDepth(-10);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		// Add background layers
		this.createBackgroundLayers(scene, assetScale);

		// (Spine-based border is handled by `Symbols` component)

		// Create ember/fiery particle backdrop (behind gameplay)
		this.createParticleSystem(scene);
		// Drive particles using scene update events
		scene.events.on('update', this.handleUpdate, this);
		scene.events.once('shutdown', () => {
			try { scene.events.off('update', this.handleUpdate, this); } catch {}
			this.destroyParticles();
		});
		
		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);
		
		// Add UI elements
		//this.createUIElements(scene, assetScale);
	}


	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		// Replace with a single normal background, scaled to cover
		const bg = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-Normal'
		).setOrigin(0.5, 0.5);
		this.bgContainer.add(bg);

		// Scale to cover viewport
		const scaleX = scene.scale.width / bg.width;
		const scaleY = scene.scale.height / bg.height;
		const coverScale = Math.max(scaleX, scaleY);
		bg.setScale(coverScale);

		// Optional tiny padding if desired to avoid edge seams
		// bg.setScale(bg.scaleX * 1.02, bg.scaleY * 1.02);

		// Add reel frame (kept as-is, initially hidden alpha)
		const reelFrame = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.483,
			'reel-frame'
		).setOrigin(0.5, 0.5).setScale(0.39).setAlpha(0);
		this.bgContainer.add(reelFrame);
	}

	private createParticleSystem(scene: Scene): void {
		const width = scene.scale.width;
		const height = scene.scale.height;
		for (let i = 0; i < this.PARTICLE_COUNT; i++) {
			this.createFieryParticle(scene, width, height);
		}
	}

	private createFieryParticle(scene: Scene, screenWidth: number, screenHeight: number): void {
		const graphics = scene.add.graphics();
		// Random position including off-screen margins for smooth entry
		const x = Math.random() * (screenWidth + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
		const y = Math.random() * (screenHeight + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
		// Size 1.5–3.5 px
		const size = Math.random() * 2.0 + 1.5;
		// Random velocity
		const vx = (Math.random() - 0.5) * 2;
		const vy = (Math.random() - 0.5) * 2;
		// Gold palette
		const colors = [0xffd700, 0xffe04a, 0xfff0a0, 0xffc107];
		const color = colors[Math.floor(Math.random() * colors.length)];
		// Base alpha
		const alpha = Math.random() * 0.6 + 0.3;
		// Lifetime 5–15s
		const lifetime = Math.random() * 10000 + 5000;
		const particle = { graphics, x, y, vx, vy, size, color, alpha, lifetime, age: 0, screenWidth, screenHeight };
		this.particles.push(particle);
		this.bgContainer.add(graphics);
		this.drawParticle(particle);
	}

	private drawParticle(particle: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; size: number; color: number; alpha: number; }): void {
		const { graphics, x, y, size, color, alpha } = particle;
		graphics.clear();
		// Layered glow ellipses
		const w = size * (Math.random() * 0.8 + 0.6);
		const h = size * (Math.random() * 1.2 + 0.8);
		graphics.fillStyle(color, alpha * 0.10); graphics.fillEllipse(x, y, w * 3.0, h * 3.0);
		graphics.fillStyle(color, alpha * 0.20); graphics.fillEllipse(x, y, w * 2.2, h * 2.2);
		graphics.fillStyle(color, alpha * 0.40); graphics.fillEllipse(x, y, w * 1.5, h * 1.5);
		graphics.fillStyle(color, alpha * 0.70); graphics.fillEllipse(x, y, w * 0.8, h * 0.8);
		graphics.fillStyle(0xffffaa, alpha * 0.30); graphics.fillEllipse(x, y, w * 0.35, h * 0.35);
		graphics.setDepth(-9); // just above base bg, still behind gameplay
	}

	private handleUpdate(_time: number, delta: number): void {
		if (!this.sceneRef) return;
		this.updateWind(delta);
		this.updateParticles(delta);
	}

	private updateWind(delta: number): void {
		this.windChangeTimer += delta;
		if (this.windChangeTimer >= this.WIND_CHANGE_INTERVAL) {
			this.windChangeTimer = 0;
			const windChance = Math.random();
			let dx = 0, dy = 0, s = 0;
			if (windChance < 0.60) {
				const dirIndex = Math.floor(windChance / 0.15);
				const dirs = [ {x:-1,y:0}, {x:1,y:0}, {x:-1,y:-1}, {x:1,y:-1} ];
				dx = dirs[dirIndex].x; dy = dirs[dirIndex].y; s = Math.random() * this.WIND_STRENGTH_MAX + 0.2;
			} else { dx = 0; dy = 0; s = Math.random() * 0.3; }
			this.windDirectionX = dx; this.windDirectionY = dy; this.windStrength = s;
		}
	}

	private updateParticles(delta: number): void {
		if (!this.sceneRef) return;
		const sw = this.sceneRef.scale.width;
		const sh = this.sceneRef.scale.height;
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.age += delta;
			if (p.age > p.lifetime) {
				try { p.graphics.destroy(); } catch {}
				this.particles.splice(i, 1);
				continue;
			}
			// Wind influence
			p.vx += this.windDirectionX * this.windStrength * 0.5;
			p.vy += this.windDirectionY * this.windStrength * 0.3;
			// Random jitter (reduced under strong wind)
			const rf = this.windStrength > 0.5 ? 0.05 : 0.10;
			p.vx += (Math.random() - 0.5) * rf;
			p.vy += (Math.random() - 0.5) * rf;
			// Clamp speed
			p.vx = Math.max(-3, Math.min(3, p.vx));
			p.vy = Math.max(-2, Math.min(2, p.vy));
			// Integrate
			p.x += p.vx; p.y += p.vy;
			// Wrap around
			if (p.x < -this.SCREEN_MARGIN) p.x = sw + this.SCREEN_MARGIN; else if (p.x > sw + this.SCREEN_MARGIN) p.x = -this.SCREEN_MARGIN;
			if (p.y < -this.SCREEN_MARGIN) p.y = sh + this.SCREEN_MARGIN; else if (p.y > sh + this.SCREEN_MARGIN) p.y = -this.SCREEN_MARGIN;
			// Fade by age
			const ageRatio = p.age / p.lifetime; p.alpha = Math.max(0.1, 1 - ageRatio * 0.5);
			this.drawParticle(p);
		}
		// Maintain target count
		while (this.particles.length < this.PARTICLE_COUNT) {
			this.createFieryParticle(this.sceneRef, sw, sh);
		}
	}

	private destroyParticles(): void {
		for (const p of this.particles) {
			try { p.graphics.destroy(); } catch {}
		}
		this.particles = [];
	}

	private createDecorativeElements(scene: Scene, assetScale: number): void {
		// Add balloons
		const balloon1 = scene.add.image(
			scene.scale.width * 0.04,
			scene.scale.height * 0.5,
			'balloon-01'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon1);

		const balloon2 = scene.add.image(
			scene.scale.width * 0.06,
			scene.scale.height * 0.3,
			'balloon-02'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon2);

		const balloon3 = scene.add.image(
			scene.scale.width * 0.95,
			scene.scale.height * 0.6,
			'balloon-03'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon3);

		const balloon4 = scene.add.image(
			scene.scale.width * 0.92,
			scene.scale.height * 0.35,
			'balloon-04'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon4);

		// Add Christmas lights
		const xmasLights = scene.add.image(
			scene.scale.width * 0.495,
			scene.scale.height * 0.40,
			'reel-xmaslight-default'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(xmasLights);

		
	}

	private createUIElements(scene: Scene, assetScale: number): void {
		// Add logo
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.05,
			'hustle-horse-logo'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bgContainer.add(logo);
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}
}
