import { Scene } from "phaser";

export interface BoilingBubblesConfig {
	x: number;
	y: number;
	depth?: number;
	textureKey?: string;
	spawnPerSecond?: number;
	spreadX?: number;
	spreadY?: number;
	riseDistanceMin?: number;
	riseDistanceMax?: number;
	lifeMinMs?: number;
	lifeMaxMs?: number;
	scaleMin?: number;
	scaleMax?: number;
	alphaMin?: number;
	alphaMax?: number;
}

export class BoilingBubblesEffect {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private timer?: Phaser.Time.TimerEvent;
	private running: boolean = false;

	private x: number;
	private y: number;
	private depth: number;
	private textureKey: string;
	private spawnPerSecond: number;
	private spreadX: number;
	private spreadY: number;
	private riseDistanceMin: number;
	private riseDistanceMax: number;
	private lifeMinMs: number;
	private lifeMaxMs: number;
	private scaleMin: number;
	private scaleMax: number;
	private alphaMin: number;
	private alphaMax: number;

	constructor(scene: Scene, config: BoilingBubblesConfig) {
		this.scene = scene;
		this.container = scene.add.container(0, 0);

		this.x = config.x;
		this.y = config.y;
		this.depth = typeof config.depth === 'number' ? config.depth : 29950;
		this.textureKey = (typeof config.textureKey === 'string' && config.textureKey.trim().length > 0) ? config.textureKey.trim() : 'bubble';
		this.spawnPerSecond = typeof config.spawnPerSecond === 'number' ? Math.max(1, config.spawnPerSecond) : 14;
		this.spreadX = typeof config.spreadX === 'number' ? Math.max(0, config.spreadX) : 40;
		this.spreadY = typeof config.spreadY === 'number' ? Math.max(0, config.spreadY) : 6;
		this.riseDistanceMin = typeof config.riseDistanceMin === 'number' ? Math.max(10, config.riseDistanceMin) : 140;
		this.riseDistanceMax = typeof config.riseDistanceMax === 'number' ? Math.max(this.riseDistanceMin, config.riseDistanceMax) : 220;
		this.lifeMinMs = typeof config.lifeMinMs === 'number' ? Math.max(80, config.lifeMinMs) : 260;
		this.lifeMaxMs = typeof config.lifeMaxMs === 'number' ? Math.max(this.lifeMinMs, config.lifeMaxMs) : 420;
		this.scaleMin = typeof config.scaleMin === 'number' ? Math.max(0.01, config.scaleMin) : 0.25;
		this.scaleMax = typeof config.scaleMax === 'number' ? Math.max(this.scaleMin, config.scaleMax) : 0.55;
		this.alphaMin = typeof config.alphaMin === 'number' ? Math.max(0, Math.min(1, config.alphaMin)) : 0.25;
		this.alphaMax = typeof config.alphaMax === 'number' ? Math.max(0, Math.min(1, config.alphaMax)) : 0.85;

		try { this.container.setDepth(this.depth); } catch {}
	}

	setPosition(x: number, y: number): void {
		this.x = x;
		this.y = y;
	}

	setMask(mask: Phaser.Display.Masks.GeometryMask | null | undefined): void {
		try {
			if (!mask) {
				this.container.clearMask(true);
				return;
			}
			this.container.setMask(mask);
		} catch {}
	}

	start(): void {
		if (this.running) return;
		this.running = true;

		try { this.timer?.destroy(); } catch {}
		this.timer = undefined;

		const delayMs = Math.max(10, Math.floor(1000 / Math.max(1, this.spawnPerSecond)));
		try {
			this.timer = this.scene.time.addEvent({
				delay: delayMs,
				loop: true,
				callback: () => {
					try { this.spawnOne(); } catch {}
				}
			});
		} catch {}

		try {
			for (let i = 0; i < 3; i++) {
				this.spawnOne();
			}
		} catch {}
	}

	stopSpawning(): void {
		this.running = false;
		try { this.timer?.destroy(); } catch {}
		this.timer = undefined;
	}

	stop(): void {
		this.stopSpawning();

		try {
			const children = this.container.list.slice();
			for (const obj of children) {
				try { this.scene.tweens.killTweensOf(obj); } catch {}
				try { (obj as any)?.destroy?.(); } catch {}
			}
			this.container.removeAll(true);
		} catch {}
	}

	destroy(): void {
		this.stop();
		try { this.container.destroy(true); } catch {}
	}

	private spawnOne(): void {
		if (!this.scene || !this.running) return;
		if (!this.scene.textures || !this.scene.textures.exists(this.textureKey)) return;

		const ox = this.x + (Math.random() * 2 - 1) * this.spreadX;
		const oy = this.y + (Math.random() * 2 - 1) * this.spreadY;
		const riseDist = this.riseDistanceMin + Math.random() * (this.riseDistanceMax - this.riseDistanceMin);
		const life = this.lifeMinMs + Math.random() * (this.lifeMaxMs - this.lifeMinMs);
		const scale = this.scaleMin + Math.random() * (this.scaleMax - this.scaleMin);
		const alpha = this.alphaMin + Math.random() * (this.alphaMax - this.alphaMin);
		const driftX = (Math.random() * 2 - 1) * Math.max(4, this.spreadX * 0.25);
		const rot = (Math.random() * 2 - 1) * 0.35;

		let img: Phaser.GameObjects.Image | undefined;
		try {
			img = this.scene.add.image(ox, oy, this.textureKey);
			img.setOrigin(0.5, 0.5);
			img.setAlpha(alpha);
			img.setScale(scale);
			img.setRotation(rot);
			this.container.add(img);
		} catch {
			try { img?.destroy(); } catch {}
			return;
		}

		try {
			this.scene.tweens.add({
				targets: img,
				y: oy - riseDist,
				x: ox + driftX,
				alpha: 0,
				duration: Math.max(60, Math.floor(life)),
				ease: 'Sine.easeOut',
				onComplete: () => {
					try { img?.destroy(); } catch {}
				}
			});
		} catch {
			try { img?.destroy(); } catch {}
		}
	}
}
