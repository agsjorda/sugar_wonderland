import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { gameStateManager } from '../../managers/GameStateManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';

type TransitionPreset = 'default' | 'bonusEnter' | 'bonusExit';

interface TransitionTimings {
	overlayAlpha?: number;
	overlayInMs?: number;
	overlayDelayMs?: number;
	spineInMs?: number;
	switchProgress?: number;
	switchMs?: number;
	overlayOutMs?: number;
	finishOutMs?: number;
}

interface ResolvedTransitionTimings {
	overlayAlpha: number;
	overlayInMs: number;
	overlayDelayMs: number;
	spineInMs: number;
	switchProgress: number;
	switchMs: number | null;
	overlayOutMs: number;
	finishOutMs: number;
}

export const FIRE_TRANSITION_MOTION_DEFAULTS = {
	enabled: true,
	startDeltaX: 0,
	startDeltaY: 860,
	endDeltaX: 0,
	endDeltaY: -750,
	durationMs: 1600,
	delayMs: 0,
	ease: 'Sine.easeInOut'
} as const;

export const FIRE_TRANSITION_ANIMATION_SPEED_MULTIPLIER_DEFAULT = 3;

export const FIRE_TRANSITION_SCALE_MULTIPLIER_DEFAULTS = {
	x: 1.2,
	y: 1
} as const;

interface FireTransitionData {
	fromSceneKey?: string;
	toSceneKey?: string;
	gameStartData?: any;
	stopFromScene?: boolean;
	toSceneEvent?: string;
	toSceneEventData?: any;
	toSceneEventOnFinish?: string;
	toSceneEventOnFinishData?: any;
	transitionPreset?: TransitionPreset;
	timings?: TransitionTimings;
	overlayAlpha?: number;
	overlayFadeInDurationMs?: number;
	overlayFadeInDelayMs?: number;
	spineFadeInDurationMs?: number;
	spineOffsetX?: number;
	spineOffsetY?: number;
	spineStartX?: number;
	spineStartY?: number;
	spineEndX?: number;
	spineEndY?: number;
	spineMoveDurationMs?: number;
	spineMoveDelayMs?: number;
	spineMoveEase?: string;
	spineAnimationSpeedMultiplier?: number;
	spineScaleXMultiplier?: number;
	spineScaleYMultiplier?: number;
	coverFirst?: boolean;
	coverFadeOutMs?: number;
	sceneSwitchProgress?: number;
}

export class FireOverlayTransitionScene extends Scene {
	private transitionData?: FireTransitionData;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private coverRect?: Phaser.GameObjects.Rectangle;
	private transitionSpine?: any;
	private gameCamera?: Phaser.Cameras.Scene2D.Camera;
	private didFadeGameCamera: boolean = false;
	private coverFirstTriggered: boolean = false;
	private hasStarted: boolean = false;
	private hasFinished: boolean = false;
	private hasPlayedTransitionSfx: boolean = false;
	private hardStopTimer?: Phaser.Time.TimerEvent;
	private toSceneKey?: string;
	private ensureOnTopTimer?: Phaser.Time.TimerEvent;
	private coverPollTimer?: Phaser.Time.TimerEvent;
	private startGameStarted: boolean = false;
	private resolvedTimings?: ResolvedTransitionTimings;

	constructor() {
		super('FireOverlayTransition');
	}

	init(data: FireTransitionData): void {
		this.transitionData = data;
		try { this.hasStarted = false; } catch {}
		try { this.hasFinished = false; } catch {}
		try { this.toSceneKey = undefined; } catch {}
		try { this.resolvedTimings = undefined; } catch {}
		try { this.hasPlayedTransitionSfx = false; } catch {}
		try { this.coverFirstTriggered = false; } catch {}
		try { this.coverRect?.destroy(); } catch {}
		try { this.coverRect = undefined; } catch {}
	}

	create(): void {
		console.log('[FireOverlayTransitionScene] create');
		try { gameEventManager.emit(GameEventType.OVERLAY_SHOW, { overlayType: 'FireOverlayTransition' } as any); } catch {}
		try { this.hasStarted = false; } catch {}
		try { this.hasFinished = false; } catch {}
		try { this.toSceneKey = undefined; } catch {}
		try { this.startGameStarted = false; } catch {}
		try { this.resolvedTimings = undefined; } catch {}
		try { this.hasPlayedTransitionSfx = false; } catch {}
		try { this.coverFirstTriggered = false; } catch {}
		try { this.scene.bringToTop('FireOverlayTransition'); } catch {}
		this.cameras.main.setBackgroundColor(0x000000);
		try { (this.cameras.main.backgroundColor as any).alpha = 0; } catch {}

		try {
			this.events.once('shutdown', () => {
				try { this.ensureOnTopTimer?.destroy(); } catch {}
				try { this.ensureOnTopTimer = undefined; } catch {}
				try { this.coverPollTimer?.destroy(); } catch {}
				try { this.coverPollTimer = undefined; } catch {}
				try { this.hardStopTimer?.destroy(); } catch {}
				try { this.hardStopTimer = undefined; } catch {}
				try { (this.overlayRect as any)?.disableInteractive?.(); } catch {}
				try { (this.coverRect as any)?.disableInteractive?.(); } catch {}
				try { this.overlayRect?.destroy(); } catch {}
				try { this.coverRect?.destroy(); } catch {}
				try { this.transitionSpine?.destroy(); } catch {}
			});
		} catch {}

		try { this.hardStopTimer?.destroy(); } catch {}
		try {
			this.hardStopTimer = this.time.delayedCall(4500, () => {
				if (this.hasFinished) return;
				console.warn('[FireOverlayTransitionScene] Hard stop fallback triggered');
				try {
					if (this.transitionData?.coverFirst && !this.startGameStarted) {
						try { this.hasStarted = true; } catch {}
						try { this.startGameStarted = true; } catch {}
						try { this.startGameIfNeededInternal(); } catch {}
					}
				} catch {}
				try { this.hasFinished = true; } catch {}
				try {
					if (this.gameCamera && this.didFadeGameCamera) {
						this.gameCamera.setAlpha(1);
					}
				} catch {}
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
					try { this.scene.bringToTop('FireOverlayTransition'); } catch {}
				}
			});
		} catch {}

		this.playFireAnimation();
	}

	private playTransitionSfxOnce(): void {
		if (this.hasPlayedTransitionSfx) return;
		this.hasPlayedTransitionSfx = true;
		try {
			const audio = (this as any)?.audioManager ?? ((window as any)?.audioManager ?? null);
			if (audio && typeof audio.playSoundEffect === 'function') {
				audio.playSoundEffect('bubble_transition_TB');
				return;
			}
		} catch {}
		try { this.sound.play('bubble_transition_TB'); } catch {}
	}

	private resolvePreset(): TransitionPreset {
		const raw = this.transitionData?.transitionPreset;
		if (raw === 'bonusEnter' || raw === 'bonusExit' || raw === 'default') return raw;
		const evt = this.transitionData?.toSceneEvent;
		if (evt === 'activateBonusMode') return 'bonusEnter';
		if (evt === 'prepareBonusExit') return 'bonusExit';
		return 'default';
	}

	private resolveTimings(isFallback: boolean): ResolvedTransitionTimings {
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

	private playFireAnimation(): void {
		this.playTransitionSfxOnce();
		const hasFactory = ensureSpineFactory(this as any, '[FireOverlayTransitionScene] playFireAnimation');
		if (!hasFactory) {
			this.playFallbackOverlay();
			return;
		}
		this.resolvedTimings = this.resolveTimings(false);
		let coverFirst = !!this.transitionData?.coverFirst;

		const spineKey = 'Fire_Transition';
		const atlasKey = spineKey + '-atlas';
		const jsonCache: any = (this.cache as any).json;
		if (!jsonCache?.has?.(spineKey)) {
			this.playFallbackOverlay();
			return;
		}

		const cx = this.scale.width * 0.5;
		const cy = this.scale.height * 0.5;
		const rawScaleX = Number(this.transitionData?.spineScaleXMultiplier);
		const rawScaleY = Number(this.transitionData?.spineScaleYMultiplier);
		const scaleXMult = (isFinite(rawScaleX) && rawScaleX > 0) ? rawScaleX : FIRE_TRANSITION_SCALE_MULTIPLIER_DEFAULTS.x;
		const scaleYMult = (isFinite(rawScaleY) && rawScaleY > 0) ? rawScaleY : FIRE_TRANSITION_SCALE_MULTIPLIER_DEFAULTS.y;
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
			const finalScaleX = scale * scaleXMult;
			const finalScaleY = scale * scaleYMult;
			try {
				spine.setScale(finalScaleX, finalScaleY);
			} catch {
				try { spine.setScale(Math.max(finalScaleX, finalScaleY)); } catch {}
				try { (spine as any).scaleX = finalScaleX; } catch {}
				try { (spine as any).scaleY = finalScaleY; } catch {}
			}
			const boundsAfter: any = (spine as any).getBounds?.();
			if (boundsAfter && isFinite(boundsAfter.x) && isFinite(boundsAfter.y) && isFinite(boundsAfter.width) && isFinite(boundsAfter.height)) {
				spine.x += cx - (boundsAfter.x + boundsAfter.width * 0.5);
				spine.y += cy - (boundsAfter.y + boundsAfter.height * 0.5);
			}
		} catch {}
		try {
			const rawX = Number(this.transitionData?.spineOffsetX);
			const rawY = Number(this.transitionData?.spineOffsetY);
			const offsetX = isFinite(rawX) ? rawX : 0;
			const offsetY = isFinite(rawY) ? rawY : 0;
			spine.x += offsetX;
			spine.y += offsetY;
		} catch {}
		try { spine.setAlpha(0); } catch {}

		if (coverFirst) {
			try { this.coverRect?.destroy(); } catch {}
			try {
				const baseW = this.scale.width / Math.max(0.0001, scaleXMult);
				const baseH = this.scale.height / Math.max(0.0001, scaleYMult);
				this.coverRect = this.add.rectangle(cx, cy, baseW, baseH, 0x000000, 1).setOrigin(0.5, 1);
				this.coverRect.setDepth(0.9);
				this.coverRect.setAlpha(1);
				this.coverRect.setScale(scaleXMult, scaleYMult);
				try { (this.coverRect as any)?.disableInteractive?.(); } catch {}
			} catch {
				try { this.coverRect?.destroy(); } catch {}
				this.coverRect = undefined;
			}
			if (!this.coverRect) {
				coverFirst = false;
			}
		}

		try {
			const rawStartX = Number(this.transitionData?.spineStartX);
			const rawStartY = Number(this.transitionData?.spineStartY);
			const startX = isFinite(rawStartX) ? rawStartX : null;
			const startY = isFinite(rawStartY) ? rawStartY : null;
			if (startX !== null) spine.x = startX;
			if (startY !== null) spine.y = startY;
		} catch {}

		if (coverFirst && this.coverRect) {
			try {
				const h = this.coverRect.displayHeight;
				this.coverRect.x = spine.x;
				this.coverRect.y = spine.y + h;
			} catch {}
		}

		try {
			const timing = this.resolvedTimings || this.resolveTimings(false);
			if (!coverFirst && this.overlayRect) {
				this.tweens.add({
					targets: this.overlayRect,
					alpha: Math.max(0, Math.min(1, timing.overlayAlpha)),
					duration: timing.overlayInMs,
					delay: timing.overlayDelayMs,
					ease: 'Power2'
				});
			} else {
				try { this.overlayRect?.setAlpha(0); } catch {}
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
		let willLoop = true;
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
				willLoop = true;
				try {
					const rawMult = Number(this.transitionData?.spineAnimationSpeedMultiplier);
					const mult = (isFinite(rawMult) && rawMult > 0) ? rawMult : FIRE_TRANSITION_ANIMATION_SPEED_MULTIPLIER_DEFAULT;
					const base = (typeof state?.timeScale === 'number' && isFinite(state.timeScale) && state.timeScale > 0) ? state.timeScale : 1;
					state.timeScale = base * mult;
				} catch {}
				state.setAnimation(0, animName, true);
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

		let motionStartX = spine.x;
		let motionStartY = spine.y;
		let motionEndX = spine.x;
		let motionEndY = spine.y;
		let motionDurationMs = totalMsForTiming;
		let motionDelayMs = 0;
		let motionEase = 'Linear';
		let motionTweenCreatedAtMs = Number((this.time as any)?.now) || 0;

		let finishScheduled = false;
		const safeFinish = () => {
			if (finishScheduled || this.hasFinished) return;
			finishScheduled = true;
			this.finishTransition();
		};

		try {
			const rawStartX = Number(this.transitionData?.spineStartX);
			const rawStartY = Number(this.transitionData?.spineStartY);
			const explicitStartX = isFinite(rawStartX) ? rawStartX : null;
			const explicitStartY = isFinite(rawStartY) ? rawStartY : null;

			const rawEndX = Number(this.transitionData?.spineEndX);
			const rawEndY = Number(this.transitionData?.spineEndY);
			const explicitEndX = isFinite(rawEndX) ? rawEndX : null;
			const explicitEndY = isFinite(rawEndY) ? rawEndY : null;

			const useDefaults = !!FIRE_TRANSITION_MOTION_DEFAULTS.enabled;
			const hasExplicitMotion = (explicitStartX !== null || explicitStartY !== null || explicitEndX !== null || explicitEndY !== null);
			const shouldMove = hasExplicitMotion || useDefaults;
			if (!shouldMove) {
				motionStartX = spine.x;
				motionStartY = spine.y;
				motionEndX = spine.x;
				motionEndY = spine.y;
				motionDurationMs = 0;
				motionDelayMs = 0;
				motionEase = 'Linear';
			} else {
				const baseX = spine.x;
				const baseY = spine.y;

				const startX = explicitStartX !== null ? explicitStartX : (useDefaults ? baseX + FIRE_TRANSITION_MOTION_DEFAULTS.startDeltaX : baseX);
				const startY = explicitStartY !== null ? explicitStartY : (useDefaults ? baseY + FIRE_TRANSITION_MOTION_DEFAULTS.startDeltaY : baseY);
				const endX = explicitEndX !== null ? explicitEndX : (useDefaults ? baseX + FIRE_TRANSITION_MOTION_DEFAULTS.endDeltaX : baseX);
				const endY = explicitEndY !== null ? explicitEndY : (useDefaults ? baseY + FIRE_TRANSITION_MOTION_DEFAULTS.endDeltaY : baseY);

				motionStartX = startX;
				motionStartY = startY;
				motionEndX = endX;
				motionEndY = endY;

				try {
					if (explicitStartX === null && explicitStartY === null && useDefaults) {
						spine.x = startX;
						spine.y = startY;
					}
				} catch {}

				const rawDur = Number(this.transitionData?.spineMoveDurationMs);
				const duration = (isFinite(rawDur) && rawDur >= 0)
					? Math.max(0, rawDur | 0)
					: (useDefaults ? FIRE_TRANSITION_MOTION_DEFAULTS.durationMs : totalMsForTiming);
				const rawDelay = Number(this.transitionData?.spineMoveDelayMs);
				const delay = (isFinite(rawDelay) && rawDelay >= 0)
					? Math.max(0, rawDelay | 0)
					: (useDefaults ? FIRE_TRANSITION_MOTION_DEFAULTS.delayMs : 0);
				const ease = (this.transitionData?.spineMoveEase && String(this.transitionData.spineMoveEase).trim().length > 0)
					? String(this.transitionData.spineMoveEase)
					: (useDefaults ? FIRE_TRANSITION_MOTION_DEFAULTS.ease : 'Linear');

				motionDurationMs = duration;
				motionDelayMs = delay;
				motionEase = ease;

				motionTweenCreatedAtMs = Number((this.time as any)?.now) || 0;
				this.tweens.add({
					targets: spine,
					x: endX,
					y: endY,
					duration,
					delay,
					ease
				});
			}
		} catch {}

		if (!coverFirst) {
			const timing = this.resolvedTimings || this.resolveTimings(false);
			const midMs = (timing.switchMs !== null)
				? Math.max(0, Math.min(totalMsForTiming, timing.switchMs))
				: Math.max(0, Math.round(totalMsForTiming * timing.switchProgress));
			this.time.delayedCall(midMs, () => {
				this.startGameIfNeeded();
				try {
					const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
					const toKey = this.transitionData?.toSceneKey || 'Game';
					if (fromKey === toKey) {
						this.fadeOverlayOutEarly();
					}
				} catch {}
			});

			try {
				this.time.delayedCall(totalMsForTiming + 50, () => safeFinish());
			} catch {
				this.time.delayedCall(2000, () => safeFinish());
			}
		} else {
			try { this.coverPollTimer?.destroy(); } catch {}
			try {
				this.coverPollTimer = this.time.addEvent({
					delay: 16,
					loop: true,
					callback: () => {
						if (this.hasFinished) return;
						if (!this.coverRect) return;
						if (!this.transitionSpine) return;
						try {
							const h = this.coverRect.displayHeight;
							this.coverRect.x = this.transitionSpine.x;
							const desiredBottom = this.transitionSpine.y + h;
							this.coverRect.y = Math.max(desiredBottom, h);
							const top = this.coverRect.y - h;
							if (!this.coverFirstTriggered && top <= 0) {
								this.coverFirstTriggered = true;
								try { this.hasStarted = true; } catch {}
								try { this.startGameStarted = true; } catch {}
								try { this.startGameIfNeededInternal(); } catch {}
								try {
									const raw = Number(this.transitionData?.coverFadeOutMs);
									const returnMs = (isFinite(raw) && raw >= 0)
										? Math.max(0, raw | 0)
										: Math.max(300, Math.round((motionDurationMs || 0) * 0.9));
									const nowMs = Number((this.time as any)?.now) || 0;
									const elapsedMs = Math.max(0, nowMs - (Number(motionTweenCreatedAtMs) || 0));
									const remainingToEndMs = Math.max(0, (Math.max(0, motionDelayMs | 0) + Math.max(0, motionDurationMs | 0)) - elapsedMs);
									this.time.delayedCall(remainingToEndMs, () => {
										if (this.hasFinished) return;
										if (!this.transitionSpine) {
											try { this.hasFinished = true; } catch {}
											this.cleanupAndStop();
											return;
										}
										try {
											this.tweens.killTweensOf(this.transitionSpine);
										} catch {}
										try {
											this.tweens.add({
												targets: this.transitionSpine,
												x: motionStartX,
												y: motionStartY,
												duration: returnMs,
												ease: motionEase,
												onComplete: () => {
												try { this.hasFinished = true; } catch {}
												this.cleanupAndStop();
											}
										});
										} catch {
											try { this.hasFinished = true; } catch {}
											this.cleanupAndStop();
										}
									});
								} catch {
									this.cleanupAndStop();
								}
							}
						} catch {}
					}
				});
			} catch {}
		}

		try {
			if (!willLoop && state && typeof state.addListener === 'function') {
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

		const timing = this.resolvedTimings || this.resolveTimings(true);
		const totalMsForTiming = 2200;
		const midMs = (timing.switchMs !== null)
			? Math.max(0, Math.min(totalMsForTiming, timing.switchMs))
			: Math.max(0, Math.round(totalMsForTiming * timing.switchProgress));
		this.time.delayedCall(midMs, () => {
			this.startGameIfNeeded();
			try {
				const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
				const toKey = this.transitionData?.toSceneKey || 'Game';
				if (fromKey === toKey) {
					this.fadeOverlayOutEarly();
				}
			} catch {}
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
		this.didFadeGameCamera = false;
		this.gameCamera = undefined;

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
		try { this.scene.bringToTop('FireOverlayTransition'); } catch {}
		try {
			const cam = toScene?.cameras?.main;
			if (cam) {
				this.gameCamera = cam;
				if (fromKey !== toKey && !this.transitionData?.coverFirst) {
					this.didFadeGameCamera = true;
					this.gameCamera?.setAlpha(0);
				}
			}
		} catch {}

		try {
			const evt = this.transitionData?.toSceneEvent;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[FireOverlayTransitionScene] emit toSceneEvent', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventData);
			}
		} catch {}
		try { this.scene.bringToTop('FireOverlayTransition'); } catch {}
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
		if (this.coverRect) targets.push(this.coverRect);

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

		if (this.gameCamera && this.didFadeGameCamera) {
			try {
				this.tweens.add({
					targets: this.gameCamera,
					alpha: 1,
					duration: 600,
					ease: 'Power2'
				});
			} catch {}
		}
	}

	private cleanupAndStop(): void {
		try { this.ensureOnTopTimer?.destroy(); } catch {}
		try { this.ensureOnTopTimer = undefined; } catch {}
		try { this.coverPollTimer?.destroy(); } catch {}
		try { this.coverPollTimer = undefined; } catch {}
		try { gameEventManager.emit(GameEventType.OVERLAY_HIDE, { overlayType: 'FireOverlayTransition' } as any); } catch {}
		try {
			const toKey = this.toSceneKey || this.transitionData?.toSceneKey || 'Game';
			const toScene: any = this.scene.get(toKey) as any;
			const evt = this.transitionData?.toSceneEventOnFinish;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[FireOverlayTransitionScene] emit toSceneEventOnFinish', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventOnFinishData);
			}
		} catch {}

		try { (this.overlayRect as any)?.disableInteractive?.(); } catch {}
		try { (this.coverRect as any)?.disableInteractive?.(); } catch {}
		try { this.overlayRect?.destroy(); } catch {}
		try { this.coverRect?.destroy(); } catch {}
		try { this.transitionSpine?.destroy(); } catch {}

		try { this.hardStopTimer?.destroy(); } catch {}
		try { this.hardStopTimer = undefined; } catch {}

		try { this.scene.stop(); } catch {}
	}
}
