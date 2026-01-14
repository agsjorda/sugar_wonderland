import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";

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
	overlaySpineKey?: string | null;
	overlaySpineAnimation?: string;
	overlaySpineScale?: number;
	overlaySpineScaleX?: number;
	overlaySpineScaleY?: number;
	overlaySpineDepthOffset?: number;
	overlaySpineTimeScale?: number;
	overlaySpineOffsetX?: number;
	overlaySpineOffsetY?: number;
	overlaySpineAlpha?: number;
}

export class BoilingBubblesEffect {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private overlayContainer?: Phaser.GameObjects.Container;
	private overlaySpine?: any;
	private overlaySpineKey: string | null = null;
	private overlaySpineAnimation: string = '';
	private overlaySpineScale: number = 1;
	private overlaySpineScaleX: number | null = null;
	private overlaySpineScaleY: number | null = null;
	private overlaySpineDepthOffset: number = 1;
	private overlaySpineTimeScale: number = 1;
	private overlaySpineOffsetX: number = 0;
	private overlaySpineOffsetY: number = 0;
	private overlaySpineAlpha: number = 1;
	private mask?: Phaser.Display.Masks.GeometryMask | null;
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

		this.overlaySpineKey = (typeof config.overlaySpineKey === 'string' && config.overlaySpineKey.trim().length > 0)
			? config.overlaySpineKey.trim()
			: null;
		this.overlaySpineAnimation = (typeof config.overlaySpineAnimation === 'string' && config.overlaySpineAnimation.trim().length > 0)
			? config.overlaySpineAnimation.trim()
			: 'loop_Emitter 1';
		this.overlaySpineScale = (typeof config.overlaySpineScale === 'number' && isFinite(config.overlaySpineScale))
			? Math.max(0.01, config.overlaySpineScale)
			: 0.35;
		this.overlaySpineScaleX = (typeof config.overlaySpineScaleX === 'number' && isFinite(config.overlaySpineScaleX))
			? Math.max(0.01, config.overlaySpineScaleX)
			: null;
		this.overlaySpineScaleY = (typeof config.overlaySpineScaleY === 'number' && isFinite(config.overlaySpineScaleY))
			? Math.max(0.01, config.overlaySpineScaleY)
			: null;
		this.overlaySpineDepthOffset = (typeof config.overlaySpineDepthOffset === 'number' && isFinite(config.overlaySpineDepthOffset))
			? Math.floor(config.overlaySpineDepthOffset)
			: 1;
		this.overlaySpineTimeScale = (typeof config.overlaySpineTimeScale === 'number' && isFinite(config.overlaySpineTimeScale))
			? Math.max(0.01, config.overlaySpineTimeScale)
			: 1;
		this.overlaySpineOffsetX = (typeof config.overlaySpineOffsetX === 'number' && isFinite(config.overlaySpineOffsetX))
			? config.overlaySpineOffsetX
			: 0;
		this.overlaySpineOffsetY = (typeof config.overlaySpineOffsetY === 'number' && isFinite(config.overlaySpineOffsetY))
			? config.overlaySpineOffsetY
			: 0;
		this.overlaySpineAlpha = (typeof config.overlaySpineAlpha === 'number' && isFinite(config.overlaySpineAlpha))
			? Math.max(0, Math.min(1, config.overlaySpineAlpha))
			: 1;

		try { this.container.setDepth(this.depth); } catch {}
		if (this.overlaySpineKey) {
			try {
				this.overlayContainer = scene.add.container(config.x, config.y);
				this.overlayContainer.setDepth(this.depth + this.overlaySpineDepthOffset);
			} catch {
				this.overlayContainer = undefined;
			}
		}
	}

	setPosition(x: number, y: number): void {
		this.x = x;
		this.y = y;
		try { this.container.setPosition(x, y); } catch {}
		try { this.overlayContainer?.setPosition(x, y); } catch {}
	}

	setEmitOffset(x: number, y: number): void {
		this.emitOffsetX = (typeof x === 'number' && isFinite(x)) ? x : 0;
		this.emitOffsetY = (typeof y === 'number' && isFinite(y)) ? y : 0;
		try { this.syncOverlaySpineTransform(); } catch {}
	}

	setEmitOffsetY(y: number): void {
		this.emitOffsetY = (typeof y === 'number' && isFinite(y)) ? y : 0;
		try { this.syncOverlaySpineTransform(); } catch {}
	}

	setMask(mask: Phaser.Display.Masks.GeometryMask | null | undefined): void {
		this.mask = mask ?? null;
		try {
			if (!mask) {
				this.container.clearMask(true);
				this.overlayContainer?.clearMask(true);
				return;
			}
			this.container.setMask(mask);
			this.overlayContainer?.setMask(mask);
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
		try {
			const spine: any = this.overlaySpine;
			if (spine) {
				try { spine.animationState?.clearTracks?.(); } catch {}
				try { spine.setVisible(false); } catch {}
			}
		} catch {}
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
		try { this.overlayContainer?.destroy(true); } catch {}
		this.overlayContainer = undefined;
		this.overlaySpine = undefined;
	}

	private syncOverlaySpineTransform(): void {
		const spine: any = this.overlaySpine;
		if (!spine) return;
		const sx = (typeof this.overlaySpineScaleX === 'number' ? this.overlaySpineScaleX : (this.overlaySpineScale || 1));
		const sy = (typeof this.overlaySpineScaleY === 'number' ? this.overlaySpineScaleY : (this.overlaySpineScale || 1));
		try {
			spine.setPosition(
				(this.emitOffsetX || 0) + (this.overlaySpineOffsetX || 0),
				(this.emitOffsetY || 0) + (this.overlaySpineOffsetY || 0)
			);
		} catch {}
		try { spine.setScale?.(sx, sy); } catch {}
		try { spine.setAlpha?.(this.overlaySpineAlpha); } catch {}
	}

	private ensureOverlaySpine(): void {
		if (this.overlaySpine) return;
		if (!this.overlayContainer) return;
		const key = this.overlaySpineKey;
		if (!key) return;
		try {
			if (!ensureSpineFactory(this.scene, '[BoilingBubblesEffect] ensureOverlaySpine')) return;
		} catch {
			return;
		}
		try {
			if (!(this.scene.cache?.json as any)?.has?.(key)) return;
		} catch {
			return;
		}
		let spine: any;
		try {
			spine = (this.scene.add as any).spine(0, 0, key, `${key}-atlas`);
		} catch {
			spine = null;
		}
		if (!spine) return;
		try { spine.setOrigin?.(0.5, 0.5); } catch {}
		try { spine.setVisible?.(false); } catch {}
		try { spine.setAlpha?.(this.overlaySpineAlpha); } catch {}
		try { spine.setScale?.(this.overlaySpineScale); } catch {}
		try { this.overlayContainer.add(spine); } catch {}
		this.overlaySpine = spine;
		try { this.syncOverlaySpineTransform(); } catch {}
		try { if (this.mask) this.overlayContainer.setMask(this.mask); } catch {}
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
		try {
			this.ensureOverlaySpine();
			const spine: any = this.overlaySpine;
			if (spine) {
				try { spine.setVisible(true); } catch {}
				try { spine.animationState.timeScale = this.overlaySpineTimeScale || 1; } catch {}
				try {
					if (this.overlaySpineAnimation && spine.animationState?.setAnimation) {
						spine.animationState.setAnimation(0, this.overlaySpineAnimation, true);
					}
				} catch {}
			}
		} catch {}

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
