import { Scene } from "phaser";

export interface BoilingBubblesConfig {
	x: number;
	y: number;
	emitOffsetX?: number;
	emitOffsetY?: number;
	depth?: number;
	textureKey?: string;
	spawnPerSecond?: number;
	spreadX?: number;
	riseDistanceMin?: number;
	riseDistanceMax?: number;
	lifeMinMs?: number;
	lifeMaxMs?: number;
	scaleMin?: number;
	scaleMax?: number;
	alphaMin?: number;
	alphaMax?: number;
	antiSfxVolumeMultiplier?: number;
}

export class BoilingBubblesEffect {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private timer?: Phaser.Time.TimerEvent;
	private running: boolean = false;
	private antiSfxSound: Phaser.Sound.BaseSound | null = null;
	private antiSfxKey: string = 'scat_anti_TB';
	private antiSfxVolumeMultiplier: number = 2.2;

	private x: number;
	private y: number;
	private emitOffsetX: number;
	private emitOffsetY: number;
	private depth: number;
	private textureKey: string;
	private spawnPerSecond: number;
	private spreadX: number;
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
		this.container = scene.add.container(config.x, config.y);

		this.x = config.x;
		this.y = config.y;
		this.emitOffsetX = (typeof config.emitOffsetX === 'number' && isFinite(config.emitOffsetX)) ? config.emitOffsetX : 0;
		this.emitOffsetY = (typeof config.emitOffsetY === 'number' && isFinite(config.emitOffsetY)) ? config.emitOffsetY : 0;
		this.depth = typeof config.depth === 'number' ? config.depth : 29950;
		this.textureKey = (typeof config.textureKey === 'string' && config.textureKey.trim().length > 0) ? config.textureKey.trim() : 'bubble';
		this.spawnPerSecond = typeof config.spawnPerSecond === 'number' ? Math.max(1, config.spawnPerSecond) : 14;
		this.spreadX = typeof config.spreadX === 'number' ? Math.max(0, config.spreadX) : 40;
		this.riseDistanceMin = typeof config.riseDistanceMin === 'number' ? Math.max(10, config.riseDistanceMin) : 140;
		this.riseDistanceMax = typeof config.riseDistanceMax === 'number' ? Math.max(this.riseDistanceMin, config.riseDistanceMax) : 220;
		this.lifeMinMs = typeof config.lifeMinMs === 'number' ? Math.max(80, config.lifeMinMs) : 260;
		this.lifeMaxMs = typeof config.lifeMaxMs === 'number' ? Math.max(this.lifeMinMs, config.lifeMaxMs) : 420;
		this.scaleMin = typeof config.scaleMin === 'number' ? Math.max(0.01, config.scaleMin) : 0.25;
		this.scaleMax = typeof config.scaleMax === 'number' ? Math.max(this.scaleMin, config.scaleMax) : 0.55;
		this.alphaMin = typeof config.alphaMin === 'number' ? Math.max(0, Math.min(1, config.alphaMin)) : 0.25;
		this.alphaMax = typeof config.alphaMax === 'number' ? Math.max(0, Math.min(1, config.alphaMax)) : 0.85;
		this.antiSfxVolumeMultiplier = typeof config.antiSfxVolumeMultiplier === 'number' && isFinite(config.antiSfxVolumeMultiplier)
			? Math.max(0, config.antiSfxVolumeMultiplier)
			: 1;

		try { this.container.setDepth(this.depth); } catch {}
	}

	setPosition(x: number, y: number): void {
		this.x = x;
		this.y = y;
		try { this.container.setPosition(x, y); } catch {}
	}

	setEmitOffset(x: number, y: number): void {
		this.emitOffsetX = (typeof x === 'number' && isFinite(x)) ? x : 0;
		this.emitOffsetY = (typeof y === 'number' && isFinite(y)) ? y : 0;
	}

	setEmitOffsetY(y: number): void {
		this.emitOffsetY = (typeof y === 'number' && isFinite(y)) ? y : 0;
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

	start(withBurst: boolean = true): void {
		this.startInternal(!!withBurst);
	}

	stopSpawning(): void {
		this.running = false;
		this.stopAntiSfxLoop();
		try { this.timer?.destroy(); } catch {}
		this.timer = undefined;
	}

	resume(): void {
		this.startInternal(false);
	}

	stopGracefully(): void {
		this.stopSpawning();
	}

	clearBubbles(): void {
		try {
			const children = this.container.list.slice();
			for (const obj of children) {
				try { this.scene.tweens.killTweensOf(obj); } catch {}
				try { (obj as any)?.destroy?.(); } catch {}
			}
			this.container.removeAll(true);
		} catch {}
	}

	stop(): void {
		this.stopSpawning();
		this.clearBubbles();
	}

	destroy(): void {
		this.stop();
		try { this.container.destroy(true); } catch {}
	}

	private spawnOne(): void {
		if (!this.scene || !this.running) return;
		if (!this.scene.textures || !this.scene.textures.exists(this.textureKey)) return;

		const ox = this.emitOffsetX + (Math.random() * 2 - 1) * this.spreadX;
		const oy = this.emitOffsetY;
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

	private startAntiSfxLoop(): void {
		if (!this.scene) return;
		const existing = this.antiSfxSound;
		try {
			if (existing && (existing as any).isPlaying) return;
		} catch {}
		try {
			if (!this.scene.cache?.audio?.exists?.(this.antiSfxKey)) return;
		} catch {}

		let vol = 0.40;
		try {
			const mgr = (this.scene as any)?.audioManager ?? ((window as any)?.audioManager ?? null);
			if (mgr && typeof mgr.getSfxVolume === 'function') {
				const v = Number(mgr.getSfxVolume());
				if (isFinite(v)) vol = Math.max(0, Math.min(1, v));
			}
		} catch {}
		try {
			vol = Math.max(0, vol * (this.antiSfxVolumeMultiplier || 0));
		} catch {}

		try {
			const s = this.scene.sound.add(this.antiSfxKey, { loop: true, volume: vol });
			this.antiSfxSound = s;
			s.play();
		} catch {
			this.antiSfxSound = null;
		}
	}

	private stopAntiSfxLoop(): void {
		const s = this.antiSfxSound;
		this.antiSfxSound = null;
		if (!s) return;
		try { s.stop(); } catch {}
		try { s.destroy(); } catch {}
	}

	private startInternal(withBurst: boolean): void {
		if (this.running) return;
		this.running = true;
		this.startAntiSfxLoop();

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

		if (!withBurst) return;
		try {
			for (let i = 0; i < 3; i++) {
				this.spawnOne();
			}
		} catch {}
	}
}
