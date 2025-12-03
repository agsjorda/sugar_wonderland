import { Scene } from "phaser";

export interface BubbleParticleModifiers {
	count?: number;
	speedMin?: number;
	speedMax?: number;
	lifeMin?: number;
	lifeMax?: number;
	screenMargin?: number;
	spawnPerSecond?: number;
	maskLeft?: number;
	maskRight?: number;
	maskTop?: number;
	maskBottom?: number;
	showMaskDebug?: boolean;
	burstOnStart?: boolean;
	opacity?: number;
	opacityMin?: number;
	opacityMax?: number;
}

interface BubbleParticle {
	graphics: Phaser.GameObjects.Graphics;
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: number;
	alpha: number;
	opacityFactor: number;
	lifetime: number;
	age: number;
	riseSpeed: number;
	isPopping: boolean;
	popAge: number;
	popDuration: number;
}

export class BubbleParticleSystem {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private particles: BubbleParticle[] = [];
	private maskGraphics?: Phaser.GameObjects.Graphics;
	private mask?: Phaser.Display.Masks.GeometryMask;
	private maskDebugGraphics?: Phaser.GameObjects.Graphics;
	private insetLeft = 0;
	private insetRight = 0;
	private insetTop = 0;
	private insetBottom = 0;
	private showMaskDebug = true;
	private colors = [0x8fd3ff, 0xaee7ff, 0xd2f5ff, 0x7fd0ff];
	private count = 30;
	private speedMin = 0.3;
	private speedMax = 1.0;
	private lifeMin = 6000;
	private lifeMax = 16000;
	private screenMargin = 80;
	private spawnPerSecond = 60;
	private spawnAccumulator = 0;
	private burstOnStart = true;
	private opacity = 1;
	private opacityMin = 1;
	private opacityMax = 1;

	constructor(scene: Scene, depth: number, modifiers?: BubbleParticleModifiers) {
		this.scene = scene;
		this.container = scene.add.container(0, 0);
		this.container.setDepth(depth);
		this.applyModifiers(modifiers);
		this.updateMask();
		if (this.burstOnStart) {
			this.createInitialParticles();
		}
	}

	configure(modifiers: BubbleParticleModifiers): void {
		this.applyModifiers(modifiers);
		this.updateMask();
	}

	update(delta: number): void {
		const sw = this.scene.scale.width;
		const sh = this.scene.scale.height;
		const dt = delta / 1000;
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.age += delta;
			if (p.isPopping) {
				p.popAge += delta;
				const t = Math.min(1, p.popAge / p.popDuration);
				p.alpha = Math.max(0, 1 - t);
				this.drawParticle(p);
				if (t >= 1) {
					try { p.graphics.destroy(); } catch {}
					this.particles.splice(i, 1);
				}
				continue;
			}
			if (p.age > p.lifetime) {
				try { p.graphics.destroy(); } catch {}
				this.particles.splice(i, 1);
				continue;
			}
			if (!p.isPopping && p.y <= this.insetTop && Math.random() < 0.02) {
				p.isPopping = true;
				p.popAge = 0;
				p.vx = 0;
				p.vy = 0;
				this.drawParticle(p);
				continue;
			}
			p.vx = 0;
			p.vy = -p.riseSpeed;
			p.x += p.vx; p.y += p.vy;
			const maskLeft = this.insetLeft;
			const maskRight = sw - this.insetRight;
			const maskTop = this.insetTop;
			const maskBottom = sh - this.insetBottom;
			const margin = this.screenMargin;
			if (p.x < maskLeft - margin) p.x = maskRight + margin; else if (p.x > maskRight + margin) p.x = maskLeft - margin;
			if (p.y < maskTop - margin) p.y = maskBottom + margin; else if (p.y > maskBottom + margin) p.y = maskTop - margin;
			const ageRatio = p.age / p.lifetime;
			p.alpha = Math.max(0.1, 1 - ageRatio * 0.5);
			this.drawParticle(p);
		}
		if (this.particles.length < this.count) {
			if (this.burstOnStart) {
				while (this.particles.length < this.count) {
					this.spawnOne(sw, sh);
				}
			} else if (this.spawnPerSecond > 0) {
				this.spawnAccumulator += dt * this.spawnPerSecond;
				const missing = this.count - this.particles.length;
				let toSpawn = Math.min(missing, Math.floor(this.spawnAccumulator));
				if (toSpawn > 0) {
					for (let i = 0; i < toSpawn; i++) {
						this.spawnOne(sw, sh);
					}
					this.spawnAccumulator -= toSpawn;
				}
			}
		}
	}

	resize(): void {
		this.updateMask();
	}

	destroy(): void {
		for (const p of this.particles) {
			try { p.graphics.destroy(); } catch {}
		}
		this.particles = [];
		try { this.container.destroy(true); } catch {}
		try { this.maskGraphics?.destroy(); } catch {}
		try { this.maskDebugGraphics?.destroy(); } catch {}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.container;
	}

	private applyModifiers(modifiers?: BubbleParticleModifiers): void {
		if (!modifiers) return;
		if (typeof modifiers.count === "number") this.count = Math.max(0, Math.floor(modifiers.count));
		if (typeof modifiers.speedMin === "number") this.speedMin = Math.max(0, modifiers.speedMin);
		if (typeof modifiers.speedMax === "number") this.speedMax = Math.max(this.speedMin, modifiers.speedMax);
		if (typeof modifiers.lifeMin === "number") this.lifeMin = Math.max(0, modifiers.lifeMin);
		if (typeof modifiers.lifeMax === "number") this.lifeMax = Math.max(this.lifeMin, modifiers.lifeMax);
		if (typeof modifiers.screenMargin === "number") this.screenMargin = Math.max(0, modifiers.screenMargin);
		if (typeof modifiers.spawnPerSecond === "number") this.spawnPerSecond = Math.max(0, modifiers.spawnPerSecond);
		if (typeof modifiers.maskLeft === "number") this.insetLeft = Math.max(0, modifiers.maskLeft);
		if (typeof modifiers.maskRight === "number") this.insetRight = Math.max(0, modifiers.maskRight);
		if (typeof modifiers.maskTop === "number") this.insetTop = Math.max(0, modifiers.maskTop);
		if (typeof modifiers.maskBottom === "number") this.insetBottom = Math.max(0, modifiers.maskBottom);
		if (typeof modifiers.showMaskDebug === "boolean") this.showMaskDebug = modifiers.showMaskDebug;
		if (typeof modifiers.burstOnStart === "boolean") this.burstOnStart = modifiers.burstOnStart;
		if (typeof modifiers.opacity === "number") this.opacity = Math.max(0, Math.min(1, modifiers.opacity));
		if (typeof modifiers.opacityMin === "number" || typeof modifiers.opacityMax === "number") {
			let newMin = this.opacityMin;
			let newMax = this.opacityMax;
			if (typeof modifiers.opacityMin === "number") {
				newMin = Math.max(0, Math.min(1, modifiers.opacityMin));
			}
			if (typeof modifiers.opacityMax === "number") {
				newMax = Math.max(0, Math.min(1, modifiers.opacityMax));
			}
			if (newMax < newMin) {
				const tmp = newMin;
				newMin = newMax;
				newMax = tmp;
			}
			this.opacityMin = newMin;
			this.opacityMax = newMax;
		}
	}

	private updateMask(): void {
		const width = this.scene.scale.width;
		const height = this.scene.scale.height;
		const x = this.insetLeft;
		const y = this.insetTop;
		const w = Math.max(0, width - this.insetLeft - this.insetRight);
		const h = Math.max(0, height - this.insetTop - this.insetBottom);
		if (!this.maskGraphics) {
			this.maskGraphics = this.scene.add.graphics();
			this.maskGraphics.setScrollFactor(0);
			this.mask = this.maskGraphics.createGeometryMask();
			this.maskGraphics.visible = false;
			if (this.mask) {
				this.container.setMask(this.mask);
			}
		}
		this.maskGraphics.clear();
		this.maskGraphics.fillStyle(0xffffff, 1);
		this.maskGraphics.fillRect(x, y, w, h);
		if (!this.maskDebugGraphics) {
			this.maskDebugGraphics = this.scene.add.graphics();
			this.maskDebugGraphics.setScrollFactor(0);
			this.maskDebugGraphics.setDepth(1000);
		}
		this.maskDebugGraphics.clear();
		if (this.showMaskDebug && w > 0 && h > 0) {
			this.maskDebugGraphics.lineStyle(2, 0x00ff00, 0.8);
			this.maskDebugGraphics.strokeRect(x, y, w, h);
		} else {
			this.maskDebugGraphics.setVisible(false);
		}
	}

	private createInitialParticles(): void {
		const sw = this.scene.scale.width;
		const sh = this.scene.scale.height;
		for (let i = 0; i < this.count; i++) {
			this.spawnOne(sw, sh);
		}
	}

	private spawnOne(screenWidth: number, screenHeight: number): void {
		const graphics = this.scene.add.graphics();
		this.container.add(graphics);
		const maskLeft = this.insetLeft;
		const maskRight = screenWidth - this.insetRight;
		const maskBottom = screenHeight - this.insetBottom;
		const spawnWidth = Math.max(0, maskRight - maskLeft);
		const x = maskLeft + (spawnWidth > 0 ? Math.random() * spawnWidth : 0);
		const y = maskBottom + Math.random() * this.screenMargin;
		const size = Math.random() * 2.0 + 2.0;
		const riseSpeed = Math.random() * (this.speedMax - this.speedMin) + this.speedMin;
		const color = this.colors[Math.floor(Math.random() * this.colors.length)];
		const alpha = Math.random() * 0.4 + 0.2;
		const opacityFactor = this.opacityMin + Math.random() * (this.opacityMax - this.opacityMin);
		const lifetime = Math.random() * (this.lifeMax - this.lifeMin) + this.lifeMin;
		const particle: BubbleParticle = {
			graphics,
			x,
			y,
			vx: 0,
			vy: -riseSpeed,
			size,
			color,
			alpha,
			opacityFactor,
			lifetime,
			age: 0,
			riseSpeed,
			isPopping: false,
			popAge: 0,
			popDuration: 200 + Math.random() * 200,
		};
		this.particles.push(particle);
		this.drawParticle(particle);
	}

	private drawParticle(particle: BubbleParticle): void {
		const { graphics, x, y, size, color, alpha, isPopping, popAge, popDuration, opacityFactor } = particle;
		graphics.clear();
		const baseRadius = size * (Math.random() * 0.6 + 0.7);
		let popScale = 1;
		if (isPopping && popDuration > 0) {
			const t = Math.min(1, popAge / popDuration);
			popScale = 1 + t * 0.8;
		}
		const radius = baseRadius * popScale;
		const outerW = radius * 2.4;
		const outerH = radius * 2.4;
		const factor = typeof opacityFactor === "number" ? opacityFactor : 1;
		const effectiveAlpha = alpha * this.opacity * factor;
		graphics.fillStyle(color, effectiveAlpha * 0.20); graphics.fillEllipse(x, y, outerW, outerH);
		graphics.lineStyle(1.5, 0xffffff, effectiveAlpha * 0.8); graphics.strokeEllipse(x, y, outerW * 0.95, outerH * 0.95);
		graphics.fillStyle(0xffffff, effectiveAlpha * 0.9); graphics.fillEllipse(x - radius * 0.4, y - radius * 0.5, radius * 0.6, radius * 0.6);
		graphics.lineStyle(0, 0, 0);
		graphics.setDepth(-9);
	}
}
