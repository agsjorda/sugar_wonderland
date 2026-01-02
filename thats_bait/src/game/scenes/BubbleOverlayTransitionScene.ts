import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { gameStateManager } from '../../managers/GameStateManager';

 type TransitionPreset = 'default' | 'bonusEnter' | 'bonusExit';

 interface BubbleTransitionTimings {
 	overlayAlpha?: number;
 	overlayInMs?: number;
 	overlayDelayMs?: number;
 	spineInMs?: number;
 	switchProgress?: number;
 	switchMs?: number;
 	overlayOutMs?: number;
 	finishOutMs?: number;
 }

 interface ResolvedBubbleTransitionTimings {
 	overlayAlpha: number;
 	overlayInMs: number;
 	overlayDelayMs: number;
 	spineInMs: number;
 	switchProgress: number;
 	switchMs: number | null;
 	overlayOutMs: number;
 	finishOutMs: number;
 }

interface BubbleTransitionData {
	fromSceneKey?: string;
	toSceneKey?: string;
	gameStartData?: any;
	stopFromScene?: boolean;
	toSceneEvent?: string;
	toSceneEventData?: any;
	toSceneEventOnFinish?: string;
	toSceneEventOnFinishData?: any;
	transitionPreset?: TransitionPreset;
	timings?: BubbleTransitionTimings;
	overlayAlpha?: number;
	overlayFadeInDurationMs?: number;
	overlayFadeInDelayMs?: number;
	spineFadeInDurationMs?: number;
	spineOffsetX?: number;
	spineOffsetY?: number;
	sceneSwitchProgress?: number;
}

export class BubbleOverlayTransitionScene extends Scene {
	private transitionData?: BubbleTransitionData;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private transitionSpine?: any;
	private bubbles: Phaser.GameObjects.Arc[] = [];
	private hasStarted: boolean = false;
	private hasFinished: boolean = false;
	private hasPlayedTransitionSfx: boolean = false;
	private hardStopTimer?: Phaser.Time.TimerEvent;
	private toSceneKey?: string;
	private ensureOnTopTimer?: Phaser.Time.TimerEvent;
	private startGameStarted: boolean = false;
	private resolvedTimings?: ResolvedBubbleTransitionTimings;

	constructor() {
		super('BubbleOverlayTransition');
	}

	init(data: BubbleTransitionData): void {
		this.transitionData = data;
		try { this.hasStarted = false; } catch {}
		try { this.hasFinished = false; } catch {}
		try { this.toSceneKey = undefined; } catch {}
		try { this.resolvedTimings = undefined; } catch {}
		try { this.hasPlayedTransitionSfx = false; } catch {}
	}

	create(): void {
		console.log('[BubbleOverlayTransitionScene] create');
		try { this.hasStarted = false; } catch {}
		try { this.hasFinished = false; } catch {}
		try { this.toSceneKey = undefined; } catch {}
		try { this.startGameStarted = false; } catch {}
		try { this.resolvedTimings = undefined; } catch {}
		try { this.hasPlayedTransitionSfx = false; } catch {}
		try { this.scene.bringToTop('BubbleOverlayTransition'); } catch {}
		this.cameras.main.setBackgroundColor(0x000000);
		try { (this.cameras.main.backgroundColor as any).alpha = 0; } catch {}

		try {
			this.events.once('shutdown', () => {
				try { this.ensureOnTopTimer?.destroy(); } catch {}
				try { this.ensureOnTopTimer = undefined; } catch {}
				try { this.hardStopTimer?.destroy(); } catch {}
				try { this.hardStopTimer = undefined; } catch {}
				try { (this.overlayRect as any)?.disableInteractive?.(); } catch {}
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
		try { (this.overlayRect as any)?.disableInteractive?.(); } catch {}
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

	private playTransitionSfxOnce(): void {
		if (this.hasPlayedTransitionSfx) return;
		this.hasPlayedTransitionSfx = true;
		const playNow = () => {
			try {
				const audio = (this as any)?.audioManager ?? ((window as any)?.audioManager ?? null);
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect('bubble_transition_TB');
					return;
				}
			} catch {}
			try { this.sound.play('bubble_transition_TB'); } catch {}
		};

		const shouldDelay = this.transitionData?.toSceneEvent === 'activateBonusMode';
		if (shouldDelay) {
			try {
				this.time.delayedCall(1250, () => playNow());
				return;
			} catch {}
		}
		playNow();
	}

	private resolvePreset(): TransitionPreset {
		const raw = this.transitionData?.transitionPreset;
		if (raw === 'bonusEnter' || raw === 'bonusExit' || raw === 'default') return raw;
		const evt = this.transitionData?.toSceneEvent;
		if (evt === 'activateBonusMode') return 'bonusEnter';
		if (evt === 'prepareBonusExit') return 'bonusExit';
		return 'default';
	}

	private resolveTimings(isFallback: boolean): ResolvedBubbleTransitionTimings {
		const preset = this.resolvePreset();
		const presetDefaults = (() => {
			switch (preset) {
				case 'bonusEnter':
					return { overlayAlpha: 1, overlayInMs: 560, overlayDelayMs: 1800, spineInMs: 620, switchProgress: 0.5, overlayOutMs: 200, finishOutMs: 500 };
				case 'bonusExit':
					return { overlayAlpha: 0.55, overlayInMs: 520, overlayDelayMs: 30, spineInMs: 620, switchProgress: 0.5, overlayOutMs: 200, finishOutMs: 500 };
				default:
					return { overlayAlpha: 0.65, overlayInMs: 200, overlayDelayMs: undefined as any, spineInMs: 800, switchProgress: 0.5, overlayOutMs: 200, finishOutMs: 500 };
			}
		})();

		const t = this.transitionData?.timings;
		const num = (v: any): number => Number(v);
		const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
		const resolveDelayDefault = (): number => {
			const d = num((presetDefaults as any).overlayDelayMs);
			if (isFinite(d)) return Math.max(0, d | 0);
			return isFallback ? 0 : 600;
		};

		const overlayAlphaRaw = num(t?.overlayAlpha);
		const overlayAlphaLegacyRaw = num(this.transitionData?.overlayAlpha);
		const overlayAlphaDefaultRaw = num((presetDefaults as any).overlayAlpha);
		const overlayAlpha = clamp01(
			isFinite(overlayAlphaRaw) ? overlayAlphaRaw : (isFinite(overlayAlphaLegacyRaw) ? overlayAlphaLegacyRaw : (isFinite(overlayAlphaDefaultRaw) ? overlayAlphaDefaultRaw : 0.65))
		);

		const overlayInRaw = num(t?.overlayInMs);
		const overlayInLegacyRaw = num(this.transitionData?.overlayFadeInDurationMs);
		const overlayInDefaultRaw = num((presetDefaults as any).overlayInMs);
		const overlayInMs = (isFinite(overlayInRaw) ? Math.max(0, overlayInRaw | 0) : (isFinite(overlayInLegacyRaw) ? Math.max(0, overlayInLegacyRaw | 0) : (isFinite(overlayInDefaultRaw) ? Math.max(0, overlayInDefaultRaw | 0) : 200)));

		const overlayDelayRaw = num(t?.overlayDelayMs);
		const overlayDelayLegacyRaw = num(this.transitionData?.overlayFadeInDelayMs);
		const overlayDelayMs = (isFinite(overlayDelayRaw) ? Math.max(0, overlayDelayRaw | 0) : (isFinite(overlayDelayLegacyRaw) ? Math.max(0, overlayDelayLegacyRaw | 0) : resolveDelayDefault()));

		const spineInRaw = num(t?.spineInMs);
		const spineInLegacyRaw = num(this.transitionData?.spineFadeInDurationMs);
		const spineInDefaultRaw = num((presetDefaults as any).spineInMs);
		const spineInMs = (isFinite(spineInRaw) ? Math.max(0, spineInRaw | 0) : (isFinite(spineInLegacyRaw) ? Math.max(0, spineInLegacyRaw | 0) : (isFinite(spineInDefaultRaw) ? Math.max(0, spineInDefaultRaw | 0) : 800)));

		const switchProgressRaw = num(t?.switchProgress);
		const switchProgressLegacyRaw = num(this.transitionData?.sceneSwitchProgress);
		const switchProgressDefaultRaw = num((presetDefaults as any).switchProgress);
		const switchProgress = (isFinite(switchProgressRaw) ? clamp01(switchProgressRaw) : (isFinite(switchProgressLegacyRaw) ? clamp01(switchProgressLegacyRaw) : (isFinite(switchProgressDefaultRaw) ? clamp01(switchProgressDefaultRaw) : 0.5)));

		const switchMsRaw = num(t?.switchMs);
		const switchMs = (isFinite(switchMsRaw) && switchMsRaw >= 0) ? Math.max(0, switchMsRaw | 0) : null;

		const overlayOutRaw = num(t?.overlayOutMs);
		const overlayOutDefaultRaw = num((presetDefaults as any).overlayOutMs);
		const overlayOutMs = (isFinite(overlayOutRaw) ? Math.max(0, overlayOutRaw | 0) : (isFinite(overlayOutDefaultRaw) ? Math.max(0, overlayOutDefaultRaw | 0) : 200));

		const finishOutRaw = num(t?.finishOutMs);
		const finishOutDefaultRaw = num((presetDefaults as any).finishOutMs);
		const finishOutMs = (isFinite(finishOutRaw) ? Math.max(0, finishOutRaw | 0) : (isFinite(finishOutDefaultRaw) ? Math.max(0, finishOutDefaultRaw | 0) : 500));

		return { overlayAlpha, overlayInMs, overlayDelayMs, spineInMs, switchProgress, switchMs, overlayOutMs, finishOutMs };
	}

	private playBubbleAnimation(): void {
		this.playTransitionSfxOnce();
		const hasFactory = ensureSpineFactory(this as any, '[BubbleOverlayTransitionScene] playBubbleAnimation');
		if (!hasFactory) {
			this.playFallbackOverlay();
			return;
		}
		this.resolvedTimings = this.resolveTimings(false);

		const shouldUseTbTransition = this.transitionData?.toSceneEvent === 'activateBonusMode';
		const spineKey = shouldUseTbTransition ? 'bubbles_transition_TB' : 'bubbles_transition';
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
			const desiredWidth = this.scale.width * 1.1;
			const desiredHeight = this.scale.height * 1.1;
			const bounds: any = (spine as any).getBounds?.();
			const spineW = (bounds?.width && isFinite(bounds.width) && bounds.width > 0)
				? bounds.width
				: ((spine as any).width || 1200);
			const spineH = (bounds?.height && isFinite(bounds.height) && bounds.height > 0)
				? bounds.height
				: ((spine as any).height || 800);
			const scale = Math.max(desiredWidth / spineW, desiredHeight / spineH);
			spine.setScale(scale);
			const boundsAfter: any = (spine as any).getBounds?.();
			if (boundsAfter && isFinite(boundsAfter.x) && isFinite(boundsAfter.y) && isFinite(boundsAfter.width) && isFinite(boundsAfter.height)) {
				spine.x += cx - (boundsAfter.x + boundsAfter.width * 0.5);
				spine.y += cy - (boundsAfter.y + boundsAfter.height * 0.5);
			}
		} catch {}
		try {
			if (shouldUseTbTransition) {
				const rawX = Number(this.transitionData?.spineOffsetX);
				const rawY = Number(this.transitionData?.spineOffsetY);
				const offsetX = isFinite(rawX) ? rawX : 0;
				const offsetY = isFinite(rawY) ? rawY : 0;
				spine.x += offsetX;
				spine.y += offsetY;
			}
		} catch {}
		try { spine.setAlpha(0); } catch {}

		try {
			const timing = this.resolvedTimings || this.resolveTimings(false);
			if (this.overlayRect) {
				this.tweens.add({
					targets: this.overlayRect,
					alpha: Math.max(0, Math.min(1, timing.overlayAlpha)),
					duration: timing.overlayInMs,
					delay: timing.overlayDelayMs,
					ease: 'Power2'
				});
			}
			this.tweens.add({
				targets: spine,
				alpha: 1,
				duration: timing.spineInMs,
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

		let totalMsForTiming = 2000;
		try {
			const rawTimeScale = state?.timeScale;
			const timeScale = (typeof rawTimeScale === 'number' && isFinite(rawTimeScale) && rawTimeScale > 0.05)
				? rawTimeScale
				: 1;
			let totalMs = (durationSec / timeScale) * 1000;
			if (!isFinite(totalMs) || totalMs <= 0) totalMs = 2000;
			totalMsForTiming = Math.min(Math.max(totalMs, 1200), 4200);
		} catch {
			totalMsForTiming = 2000;
		}

		const timing = this.resolvedTimings || this.resolveTimings(false);
		const midMs = (timing.switchMs !== null)
			? Math.max(0, Math.min(totalMsForTiming, timing.switchMs))
			: Math.max(0, Math.round(totalMsForTiming * timing.switchProgress));
		this.time.delayedCall(midMs, () => {
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
			this.time.delayedCall(totalMsForTiming + 50, () => safeFinish());
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
		this.resolvedTimings = this.resolveTimings(true);
		try {
			const timing = this.resolvedTimings || this.resolveTimings(true);
			this.tweens.add({
				targets: this.overlayRect,
				alpha: Math.max(0, Math.min(1, timing.overlayAlpha)),
				duration: timing.overlayInMs,
				delay: timing.overlayDelayMs,
				ease: 'Power2'
			});
		} catch {}

		this.spawnBubbles();

		const timing = this.resolvedTimings || this.resolveTimings(true);
		const totalMsForTiming = 2200;
		const midMs = (timing.switchMs !== null)
			? Math.max(0, Math.min(totalMsForTiming, timing.switchMs))
			: Math.max(0, Math.round(totalMsForTiming * timing.switchProgress));
		this.time.delayedCall(midMs, () => {
			this.startGameIfNeeded();
			this.fadeOverlayOutEarly();
		});
		this.time.delayedCall(totalMsForTiming, () => {
			this.finishTransition();
		});
	}

	private fadeOverlayOutEarly(): void {
		try {
			if (!this.overlayRect) return;
			if (this.hasFinished) return;
			this.tweens.killTweensOf(this.overlayRect);
			const timing = this.resolvedTimings || this.resolveTimings(false);
			this.tweens.add({
				targets: this.overlayRect,
				alpha: 0,
				duration: timing.overlayOutMs,
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
		if (this.startGameStarted) return;
		this.startGameStarted = true;

		void (async () => {
			try {
				await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 });
			} catch {}
			this.startGameIfNeededInternal();
		})();
	}

	private startGameIfNeededInternal(): void {
		if (this.hasFinished) return;

		const toKey = this.transitionData?.toSceneKey || 'Game';
		const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
		const startData = this.transitionData?.gameStartData || {};
		this.toSceneKey = toKey;

		try {
			const stopFrom = this.transitionData?.stopFromScene;
			const shouldStopFrom = stopFrom !== false;
			if (
				shouldStopFrom &&
				fromKey &&
				fromKey !== toKey &&
				(this.scene.isActive(fromKey) || this.scene.isSleeping(fromKey))
			) {
				this.scene.stop(fromKey);
			}
		} catch {}

		let toScene: any;
		try {
			if (this.scene.isSleeping(toKey)) {
				this.scene.wake(toKey);
			} else if (!this.scene.isActive(toKey)) {
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
		void (async () => {
			try {
				await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 });
			} catch {}
			this.finishTransitionInternal();
		})();
	}

	private finishTransitionInternal(): void {
		const targets: any[] = [];
		if (this.transitionSpine) targets.push(this.transitionSpine);
		if (this.overlayRect) targets.push(this.overlayRect);
		for (const b of this.bubbles) targets.push(b);

		if (targets.length === 0) {
			this.cleanupAndStop();
			return;
		}

		try {
			const timing = this.resolvedTimings || this.resolveTimings(false);
			this.tweens.add({
				targets,
				alpha: 0,
				duration: timing.finishOutMs,
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

		try { (this.overlayRect as any)?.disableInteractive?.(); } catch {}
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
