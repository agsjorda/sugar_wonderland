import { Scene } from "phaser";

export interface BubbleStreamConfig {
	x: number;
	y: number;
	depth?: number;
	count?: number;
	spawnPerSecond?: number;
	speedMin?: number;
	speedMax?: number;
	lifeMin?: number;
	lifeMax?: number;
	spreadX?: number;
	spreadY?: number;
	opacityMin?: number;
	opacityMax?: number;
	radiusMin?: number;
	radiusMax?: number;
	maskLeft?: number;
	maskRight?: number;
	maskTop?: number;
	maskBottom?: number;
	showMaskDebug?: boolean;
	textureKey?: string;
	imageScale?: number;
}

interface StreamBubble {
	graphics?: Phaser.GameObjects.Graphics;
	image?: Phaser.GameObjects.Image;
	offset: number; // vertical offset in pixels from the origin
	phase: number;
	amplitude: number;
	radius: number;
	opacity: number;
}

export class BubbleStreamSystem {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private bubbles: StreamBubble[] = [];

	private originX: number;
	private originY: number;

	// Number of bubbles in the vertical train
	private count = 10;
	// Bubbles per second passing a given point (controls spacing together with speed)
	private spawnPerSecond = 3;
	// Vertical speed in pixels per second (shared by all bubbles)
	private verticalSpeed = 80;
	// Vertical spacing in pixels between consecutive bubbles
	private spacing = 16;
	// Visual style
	private radiusMin = 3;
	private radiusMax = 4;
	private opacityMin = 0.4;
	private opacityMax = 1.0;
	private baseColor = 0x8fd3ff;
	private textureKey?: string;
	private imageScale: number = 1;

	// Height of the full train, used for wrapping
	private streamLength = 0;
	private elapsedTime = 0;
	private horizontalAmplitude = 1;
	private horizontalFrequency = 0.5;

	// Simple rectangular view mask (like BubbleParticleSystem)
	private insetLeft = 0;
	private insetRight = 0;
	private insetTop = 0;
	private insetBottom = 0;
	private showMaskDebug = false;
	private maskGraphics?: Phaser.GameObjects.Graphics;
	private mask?: Phaser.Display.Masks.GeometryMask;
	private maskDebugGraphics?: Phaser.GameObjects.Graphics;

	constructor(scene: Scene, config: BubbleStreamConfig) {
		this.scene = scene;
		this.container = scene.add.container(0, 0);
		this.container.setDepth(config.depth ?? -8);

		this.originX = config.x;
		this.originY = config.y;

		if (typeof config.count === "number") {
			this.count = Math.max(1, Math.floor(config.count));
		}
		if (typeof config.spawnPerSecond === "number") {
			this.spawnPerSecond = Math.max(0.1, config.spawnPerSecond);
		}

		// Use speedMin / speedMax as a hint for the one shared vertical speed.
		let speedFromConfig: number | undefined;
		if (typeof config.speedMin === "number" && typeof config.speedMax === "number") {
			speedFromConfig = (config.speedMin + config.speedMax) * 0.5;
		} else if (typeof config.speedMin === "number") {
			speedFromConfig = config.speedMin;
		} else if (typeof config.speedMax === "number") {
			speedFromConfig = config.speedMax;
		}
		if (typeof speedFromConfig === "number" && speedFromConfig > 0) {
			this.verticalSpeed = speedFromConfig;
		}

		if (typeof config.opacityMin === "number") {
			this.opacityMin = Math.max(0, Math.min(1, config.opacityMin));
		}
		if (typeof config.opacityMax === "number") {
			this.opacityMax = Math.max(0, Math.min(1, config.opacityMax));
		}
		if (this.opacityMax < this.opacityMin) {
			const tmp = this.opacityMin;
			this.opacityMin = this.opacityMax;
			this.opacityMax = tmp;
		}

		if (typeof config.radiusMin === "number") {
			this.radiusMin = Math.max(0, config.radiusMin);
		}
		if (typeof config.radiusMax === "number") {
			this.radiusMax = Math.max(0, config.radiusMax);
		}
		if (this.radiusMax < this.radiusMin) {
			const tmp = this.radiusMin;
			this.radiusMin = this.radiusMax;
			this.radiusMax = tmp;
		}
		if (typeof config.textureKey === "string" && config.textureKey.trim().length > 0) {
			this.textureKey = config.textureKey.trim();
		}
		if (typeof config.imageScale === "number") {
			this.imageScale = config.imageScale;
		}

		// Optional mask configuration
		if (typeof config.maskLeft === "number") {
			this.insetLeft = Math.max(0, config.maskLeft);
		}
		if (typeof config.maskRight === "number") {
			this.insetRight = Math.max(0, config.maskRight);
		}
		if (typeof config.maskTop === "number") {
			this.insetTop = Math.max(0, config.maskTop);
		}
		if (typeof config.maskBottom === "number") {
			this.insetBottom = Math.max(0, config.maskBottom);
		}
		if (typeof config.showMaskDebug === "boolean") {
			this.showMaskDebug = config.showMaskDebug;
		}

		this.updateMask();

		this.rebuildBubbles();
	}

	update(delta: number): void {
		if (this.bubbles.length === 0) {
			return;
		}

		const dt = delta / 1000;
		const travel = this.verticalSpeed * dt;
		this.elapsedTime += dt;

		for (let i = 0; i < this.bubbles.length; i++) {
			const bubble = this.bubbles[i];
			bubble.offset += travel;

			if (this.streamLength > 0 && bubble.offset > this.streamLength) {
				bubble.offset -= this.streamLength;
			}

			const baseX = this.originX;
			const horizontalOffset = bubble.amplitude * Math.sin(this.elapsedTime * this.horizontalFrequency * Math.PI * 2 + bubble.phase);
			const x = baseX + horizontalOffset;
			const y = this.originY - bubble.offset;
			this.drawBubble(bubble, x, y);
		}
	}

	setOrigin(x: number, y: number): void {
		this.originX = x;
		this.originY = y;
	}

	configure(config: Partial<BubbleStreamConfig>): void {
		if (typeof config.x === "number") {
			this.originX = config.x;
		}
		if (typeof config.y === "number") {
			this.originY = config.y;
		}

		let needsRebuild = false;
		let needsMaskUpdate = false;

		if (typeof config.count === "number") {
			const newCount = Math.max(1, Math.floor(config.count));
			if (newCount !== this.count) {
				this.count = newCount;
				needsRebuild = true;
			}
		}
		if (typeof config.spawnPerSecond === "number") {
			this.spawnPerSecond = Math.max(0.1, config.spawnPerSecond);
			needsRebuild = true;
		}

		let speedFromConfig: number | undefined;
		if (typeof config.speedMin === "number" && typeof config.speedMax === "number") {
			speedFromConfig = (config.speedMin + config.speedMax) * 0.5;
		} else if (typeof config.speedMin === "number") {
			speedFromConfig = config.speedMin;
		} else if (typeof config.speedMax === "number") {
			speedFromConfig = config.speedMax;
		}
		if (typeof speedFromConfig === "number" && speedFromConfig > 0) {
			this.verticalSpeed = speedFromConfig;
			needsRebuild = true;
		}

		if (typeof config.opacityMin === "number") {
			this.opacityMin = Math.max(0, Math.min(1, config.opacityMin));
		}
		if (typeof config.opacityMax === "number") {
			this.opacityMax = Math.max(0, Math.min(1, config.opacityMax));
		}
		if (this.opacityMax < this.opacityMin) {
			const tmp = this.opacityMin;
			this.opacityMin = this.opacityMax;
			this.opacityMax = tmp;
		}

		if (typeof config.maskLeft === "number") {
			this.insetLeft = Math.max(0, config.maskLeft);
			needsMaskUpdate = true;
		}
		if (typeof config.maskRight === "number") {
			this.insetRight = Math.max(0, config.maskRight);
			needsMaskUpdate = true;
		}
		if (typeof config.maskTop === "number") {
			this.insetTop = Math.max(0, config.maskTop);
			needsMaskUpdate = true;
		}
		if (typeof config.maskBottom === "number") {
			this.insetBottom = Math.max(0, config.maskBottom);
			needsMaskUpdate = true;
		}
		if (typeof config.showMaskDebug === "boolean") {
			this.showMaskDebug = config.showMaskDebug;
			needsMaskUpdate = true;
		}

		if (needsRebuild) {
			this.rebuildBubbles();
		}
		if (needsMaskUpdate) {
			this.updateMask();
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.container;
	}

	destroy(): void {
		for (const bubble of this.bubbles) {
			try { bubble.graphics?.destroy(); } catch {}
			try { bubble.image?.destroy(); } catch {}
		}
		this.bubbles = [];
		try { this.container.destroy(true); } catch {}
		try { this.maskGraphics?.destroy(); } catch {}
		try { this.maskDebugGraphics?.destroy(); } catch {}
	}

	private rebuildBubbles(): void {
		for (const bubble of this.bubbles) {
			try { bubble.graphics?.destroy(); } catch {}
			try { bubble.image?.destroy(); } catch {}
		}
		this.bubbles = [];

		this.spacing = this.verticalSpeed / this.spawnPerSecond;
		if (!isFinite(this.spacing) || this.spacing <= 0) {
			this.spacing = 16;
		}
		this.streamLength = this.spacing * Math.max(1, this.count - 1);

		for (let i = 0; i < this.count; i++) {
			const offset = i * this.spacing;
			const bubble = this.createBubble(offset, i);
			this.bubbles.push(bubble);
		}
	}

	private createBubble(offset: number, index: number): StreamBubble {
		let graphics: Phaser.GameObjects.Graphics | undefined;
		let image: Phaser.GameObjects.Image | undefined;
		const useImage = this.textureKey && this.scene.textures.exists(this.textureKey);
		if (useImage) {
			image = this.scene.add.image(this.originX, this.originY, this.textureKey!);
			this.container.add(image);
			image.setOrigin(0.5, 0.5);
		} else {
			graphics = this.scene.add.graphics();
			this.container.add(graphics);
		}
		// Randomize phase and amplitude per bubble to make zigzag unique
		const phase = Math.random() * Math.PI * 2;
		const amplitude = this.horizontalAmplitude * (0.5 + Math.random());
		const radius = this.radiusMin + Math.random() * (this.radiusMax - this.radiusMin);
		const opacity = this.opacityMin + Math.random() * (this.opacityMax - this.opacityMin);
		return { graphics, image, offset, phase, amplitude, radius, opacity };
	}

	private drawBubble(bubble: StreamBubble, x: number, y: number): void {
		const { graphics, image, radius, opacity } = bubble;
		const alpha = opacity;
		if (image) {
			const baseScale = this.imageScale > 0 ? this.imageScale : 1;
			const radiusFactor = radius / Math.max(1, this.radiusMin);
			const finalScale = baseScale * radiusFactor;
			image.setPosition(x, y);
			image.setScale(finalScale);
			image.setAlpha(alpha);
			return;
		}
		if (!graphics) {
			return;
		}
		graphics.clear();

		const outerW = radius * 2.4;
		const outerH = radius * 2.4;

		graphics.fillStyle(this.baseColor, alpha * 0.20);
		graphics.fillEllipse(x, y, outerW, outerH);
		graphics.lineStyle(1.5, 0xffffff, alpha * 0.8);
		graphics.strokeEllipse(x, y, outerW * 0.95, outerH * 0.95);
		graphics.fillStyle(0xffffff, alpha * 0.9);
		graphics.fillEllipse(x - radius * 0.4, y - radius * 0.5, radius * 0.6, radius * 0.6);
		graphics.lineStyle(0, 0, 0);
		graphics.setDepth(this.container.depth ?? -8);
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
}
