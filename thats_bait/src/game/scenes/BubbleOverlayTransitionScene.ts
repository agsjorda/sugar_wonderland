import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

interface BubbleTransitionData {
	fromSceneKey?: string;
	toSceneKey?: string;
	gameStartData?: any;
	stopFromScene?: boolean;
	toSceneEvent?: string;
	toSceneEventData?: any;
	toSceneEventOnFinish?: string;
	toSceneEventOnFinishData?: any;
}

export class BubbleOverlayTransitionScene extends Scene {
	private transitionData?: BubbleTransitionData;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private transitionSpine?: any;
	private bubbles: Phaser.GameObjects.Arc[] = [];
	private hasStarted: boolean = false;
	private hasFinished: boolean = false;
	private hardStopTimer?: Phaser.Time.TimerEvent;
	private toSceneKey?: string;
	private ensureOnTopTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super('BubbleOverlayTransition');
	}

	init(data: BubbleTransitionData): void {
		this.transitionData = data;
	}

	create(): void {
		console.log('[BubbleOverlayTransitionScene] create');
		try { this.scene.bringToTop('BubbleOverlayTransition'); } catch {}
		this.cameras.main.setBackgroundColor(0x000000);
		try { (this.cameras.main.backgroundColor as any).alpha = 0; } catch {}

		try {
			this.events.once('shutdown', () => {
				try { this.ensureOnTopTimer?.destroy(); } catch {}
				try { this.ensureOnTopTimer = undefined; } catch {}
				try { this.hardStopTimer?.destroy(); } catch {}
				try { this.hardStopTimer = undefined; } catch {}
				try { this.overlayRect?.destroy(); } catch {}
				try { this.transitionSpine?.destroy(); } catch {}
				for (const b of this.bubbles) {
					try { b.destroy(); } catch {}
				}
				this.bubbles = [];
			});
		} catch {}

		try { this.hardStopTimer?.destroy(); } catch {}
		try {
			this.hardStopTimer = this.time.delayedCall(4500, () => {
				if (this.hasFinished) return;
				console.warn('[BubbleOverlayTransitionScene] Hard stop fallback triggered');
				try { this.hasFinished = true; } catch {}
				this.cleanupAndStop();
			});
		} catch {}

		this.overlayRect = this.add.rectangle(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			this.scale.width,
			this.scale.height,
			0x000000,
			1
		).setOrigin(0.5, 0.5);
		this.overlayRect.setDepth(0);
		this.overlayRect.setAlpha(0);
		try {
			try { this.ensureOnTopTimer?.destroy(); } catch {}
			this.ensureOnTopTimer = this.time.addEvent({
				delay: 100,
				loop: true,
				callback: () => {
					try { this.scene.bringToTop('BubbleOverlayTransition'); } catch {}
				}
			});
		} catch {}

		this.playBubbleAnimation();
	}

	private playBubbleAnimation(): void {
		const hasFactory = ensureSpineFactory(this as any, '[BubbleOverlayTransitionScene] playBubbleAnimation');
		if (!hasFactory) {
			this.playFallbackOverlay();
			return;
		}

		const spineKey = 'bubbles_transition';
		const atlasKey = spineKey + '-atlas';
		const jsonCache: any = (this.cache as any).json;
		if (!jsonCache?.has?.(spineKey)) {
			this.playFallbackOverlay();
			return;
		}

		const cx = this.scale.width * 0.5;
		const cy = this.scale.height * 0.5;
		let spine: any;
		try {
			spine = (this.add as any).spine(cx, cy, spineKey, atlasKey);
		} catch {
			this.playFallbackOverlay();
			return;
		}
		this.transitionSpine = spine;
		try { spine.setOrigin(0.5, 0.5); } catch {}
		try { spine.setDepth(1); } catch {}
		try {
			const desiredHeight = this.scale.height * 1.1;
			const spineH = (spine as any).height || 800;
			const scale = desiredHeight / spineH;
			spine.setScale(scale);
		} catch {}
		try { spine.setAlpha(0); } catch {}

		try {
			if (this.overlayRect) {
				this.tweens.add({
					targets: this.overlayRect,
					alpha: 0.65,
					duration: 200,
					ease: 'Power2'
				});
			}
			this.tweens.add({
				targets: spine,
				alpha: 1,
				duration: 800,
				ease: 'Power2'
			});
		} catch {}

		let animName: string | null = null;
		let durationSec = 2.0;
		let state: any = undefined;
		try {
			const data: any = spine.skeleton?.data;
			const animations: any[] = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
			if (Array.isArray(animations) && animations.length > 0) {
				const preferred = ['animation', 'Animation', 'idle', 'Idle'];
				const byName = (name: string) => animations.find(a => a && a.name === name);
				let found: any = null;
				for (const name of preferred) {
					found = byName(name);
					if (found) break;
				}
				if (!found) found = animations[0];
				animName = found?.name || null;
			}
			if (animName && data && typeof data.findAnimation === 'function') {
				const anim = data.findAnimation(animName);
				if (anim && typeof anim.duration === 'number') {
					durationSec = Math.max(0.1, anim.duration);
				}
			} else if (Array.isArray(animations) && typeof animations[0]?.duration === 'number') {
				durationSec = Math.max(0.1, animations[0].duration);
			}
			state = spine.animationState;
			if (animName) {
				state.setAnimation(0, animName, false);
			}
		} catch {}

		this.time.delayedCall(650, () => {
			this.startGameIfNeeded();
			this.fadeOverlayOutEarly();
		});

		let finishScheduled = false;
		const safeFinish = () => {
			if (finishScheduled || this.hasFinished) return;
			finishScheduled = true;
			this.finishTransition();
		};

		try {
			const rawTimeScale = state?.timeScale;
			const timeScale = (typeof rawTimeScale === 'number' && isFinite(rawTimeScale) && rawTimeScale > 0.05)
				? rawTimeScale
				: 1;
			let totalMs = (durationSec / timeScale) * 1000;
			if (!isFinite(totalMs) || totalMs <= 0) totalMs = 2000;
			totalMs = Math.min(Math.max(totalMs, 1200), 4200);
			this.time.delayedCall(totalMs + 50, () => safeFinish());
		} catch {
			this.time.delayedCall(2000, () => safeFinish());
		}

		try {
			if (state && typeof state.addListener === 'function') {
				state.addListener({
					complete: (entry: any) => {
						try {
							const name = entry?.animation?.name;
							if (!animName || name === animName) {
								safeFinish();
							}
						} catch {
							safeFinish();
						}
					}
				});
			}
		} catch {}
	}

	private playFallbackOverlay(): void {
		try {
			this.tweens.add({
				targets: this.overlayRect,
				alpha: 0.65,
				duration: 200,
				ease: 'Power2'
			});
		} catch {}

		this.spawnBubbles();

		this.time.delayedCall(650, () => {
			this.startGameIfNeeded();
			this.fadeOverlayOutEarly();
		});
		this.time.delayedCall(2200, () => {
			this.finishTransition();
		});
	}

	private fadeOverlayOutEarly(): void {
		try {
			if (!this.overlayRect) return;
			if (this.hasFinished) return;
			this.tweens.killTweensOf(this.overlayRect);
			this.tweens.add({
				targets: this.overlayRect,
				alpha: 0,
				duration: 200,
				ease: 'Power2'
			});
		} catch {}
	}

	private spawnBubbles(): void {
		const count = 26;
		for (let i = 0; i < count; i++) {
			const radius = Phaser.Math.Between(8, 26);
			const x = Phaser.Math.Between(Math.floor(-radius), Math.floor(this.scale.width + radius));
			const y = Phaser.Math.Between(
				Math.floor(this.scale.height + radius),
				Math.floor(this.scale.height + radius + 180)
			);
			const bubble = this.add.circle(x, y, radius, 0xffffff, 1);
			bubble.setDepth(999901);
			bubble.setAlpha(0);

			const delay = Phaser.Math.Between(0, 450);
			const floatDuration = Phaser.Math.Between(1100, 1650);
			const drift = Phaser.Math.Between(-40, 40);

			this.bubbles.push(bubble);

			try {
				this.tweens.add({
					targets: bubble,
					alpha: 0.22,
					duration: 250,
					delay,
					ease: 'Sine.easeOut'
				});
			} catch {}

			try {
				this.tweens.add({
					targets: bubble,
					y: -radius - 40,
					x: x + drift,
					duration: floatDuration,
					delay,
					ease: 'Sine.easeInOut',
					onComplete: () => {
						try { bubble.destroy(); } catch {}
					}
				});
			} catch {}

			try {
				const s0 = Phaser.Math.FloatBetween(0.35, 0.75);
				const s1 = Phaser.Math.FloatBetween(0.9, 1.35);
				bubble.setScale(s0);
				this.tweens.add({
					targets: bubble,
					scale: s1,
					duration: floatDuration,
					delay,
					ease: 'Sine.easeOut'
				});
			} catch {}
		}
	}

	private startGameIfNeeded(): void {
		if (this.hasStarted) return;
		this.hasStarted = true;

		const toKey = this.transitionData?.toSceneKey || 'Game';
		const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
		const startData = this.transitionData?.gameStartData || {};
		this.toSceneKey = toKey;

		try {
			const stopFrom = this.transitionData?.stopFromScene;
			const shouldStopFrom = stopFrom !== false;
			if (shouldStopFrom && fromKey && fromKey !== toKey && this.scene.isActive(fromKey)) {
				this.scene.stop(fromKey);
			}
		} catch {}

		let toScene: any;
		try {
			if (!this.scene.isActive(toKey)) {
				this.scene.launch(toKey, startData);
			}
			toScene = this.scene.get(toKey) as any;
		} catch {}
		try { this.scene.bringToTop('BubbleOverlayTransition'); } catch {}

		try {
			const evt = this.transitionData?.toSceneEvent;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[BubbleOverlayTransitionScene] emit toSceneEvent', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventData);
			}
		} catch {}
		try { this.scene.bringToTop('BubbleOverlayTransition'); } catch {}
	}

	private finishTransition(): void {
		if (this.hasFinished) return;
		this.hasFinished = true;

		const targets: any[] = [];
		if (this.transitionSpine) targets.push(this.transitionSpine);
		if (this.overlayRect) targets.push(this.overlayRect);
		for (const b of this.bubbles) targets.push(b);

		if (targets.length === 0) {
			this.cleanupAndStop();
			return;
		}

		try {
			this.tweens.add({
				targets,
				alpha: 0,
				duration: 500,
				ease: 'Power2',
				onComplete: () => {
					this.cleanupAndStop();
				}
			});
		} catch {
			this.cleanupAndStop();
		}
	}

	private cleanupAndStop(): void {
		try { this.ensureOnTopTimer?.destroy(); } catch {}
		try { this.ensureOnTopTimer = undefined; } catch {}
		try {
			const toKey = this.toSceneKey || this.transitionData?.toSceneKey || 'Game';
			const toScene: any = this.scene.get(toKey) as any;
			const evt = this.transitionData?.toSceneEventOnFinish;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[BubbleOverlayTransitionScene] emit toSceneEventOnFinish', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventOnFinishData);
			}
		} catch {}

		try { this.overlayRect?.destroy(); } catch {}
		try { this.transitionSpine?.destroy(); } catch {}
		for (const b of this.bubbles) {
			try { b.destroy(); } catch {}
		}
		this.bubbles = [];

		try { this.hardStopTimer?.destroy(); } catch {}
		try { this.hardStopTimer = undefined; } catch {}

		try { this.scene.stop(); } catch {}
	}
}
