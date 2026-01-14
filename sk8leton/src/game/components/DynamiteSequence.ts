import { gameStateManager } from '../../managers/GameStateManager';
import { SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';

const WATER_BOMB_VFX_SCALE_MULTIPLIER = 2.2;
const WATER_BOMB_VFX_SHAKE_DURATION_MS = 90;
const WATER_BOMB_VFX_SHAKE_INTENSITY = 0.004;

function waitMs(scene: any, ms: number): Promise<void> {
	return new Promise((resolve) => {
		let timer: any = null;
		try {
			timer = scene?.time?.delayedCall?.(ms, () => resolve());
		} catch {
			try {
				setTimeout(() => resolve(), ms);
			} catch {
				resolve();
			}
		}
		void timer;
	});
}

function tween(scene: any, targets: any, config: any): Promise<void> {
	return new Promise((resolve) => {
		try {
			scene?.tweens?.add?.({
				targets,
				...config,
				onComplete: () => resolve(),
			});
		} catch {
			resolve();
		}
	});
}

export async function playMissileStrike(scene: any, targetX: number, targetY: number, depth: number = 20015, targetW?: number, targetH?: number): Promise<void> {
	let missile: any = null;
	try {
		if (!scene?.textures?.exists?.('symbol_1')) return;
		const sw = Number(scene?.scale?.width ?? 0);
		const sh = Number(scene?.scale?.height ?? 0);
		const safeW = (isFinite(sw) && sw > 0) ? sw : (Number(targetX) + 800);
		const safeH = (isFinite(sh) && sh > 0) ? sh : 800;
		const startX = safeW + 120;
		let startY = Number(targetY) - safeH * 0.35;
		if (!isFinite(startY)) startY = -120;
		startY = Math.min(startY, Number(targetY) - 80);
		startY = Math.max(-160, startY);

		try {
			missile = scene.add.image(startX, startY, 'symbol_1').setOrigin(0.5, 0.5);
		} catch {
			missile = null;
		}
		if (!missile) return;
		try { missile.setDepth?.(depth); } catch {}
		try { missile.setScrollFactor?.(0); } catch {}
		try { missile.setFlipX?.(true); } catch {}

		try {
			const baseW = Number(missile.width ?? 1) || 1;
			const baseH = Number(missile.height ?? 1) || 1;
			let fit = 1;
			const tw = Number(targetW ?? 0);
			const th = Number(targetH ?? 0);
			if (isFinite(tw) && isFinite(th) && tw > 0 && th > 0) {
				fit = Math.max(0.01, Math.min(tw / baseW, th / baseH));
			}
			const scale = fit * 0.75;
			try { missile.setScale?.(scale); } catch {}
		} catch {}

		let durationMs = 260;
		try {
			const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
			durationMs = Math.max(120, Math.floor(durationMs * speed));
		} catch {}

		try {
			await tween(scene, missile, {
				x: Number(targetX),
				y: Number(targetY),
				duration: durationMs,
				ease: 'Cubic.easeIn'
			});
		} catch {}
	} finally {
		try { missile?.destroy?.(); } catch {}
	}
}

async function playCharacterBonusAndWait(scene: any): Promise<void> {
	// Character_TB has been removed from the project. Preserve sequencing semantics
	// (including the optional timing gate) without relying on character/rope assets.
	try {
		const sc: any = scene as any;
		const existing: any = sc?.__dynamiteCharacterBonusPromise;
		if (existing && typeof existing.then === 'function') {
			await existing;
			return;
		}
	} catch {}

	const promise = (async (): Promise<void> => {
		// Provide a "gate" so other sequences can start mid-animation (e.g. 60% progress)
		try {
			const sc: any = scene as any;
			if (!sc.__dynamiteCharacterBonusGatePromise || typeof sc.__dynamiteCharacterBonusGateResolve !== 'function') {
				let resolveGate: (() => void) | null = null;
				const gatePromise = new Promise<void>((resolve) => {
					resolveGate = resolve;
				});
				sc.__dynamiteCharacterBonusGatePromise = gatePromise;
				sc.__dynamiteCharacterBonusGateResolve = () => {
					try { resolveGate?.(); } catch {}
				};
			}
			const ratio = Number((scene as any)?.__dynamiteCharacterBonusGateRatio ?? 0.6);
			const clampedRatio = Math.max(0, Math.min(1, isFinite(ratio) ? ratio : 0.6));
			const gateMs = Math.max(0, Math.floor(700 * clampedRatio));
			scene?.time?.delayedCall?.(gateMs, () => {
				try {
					const sc: any = scene as any;
					if (!sc.__dynamiteCharacterBonusExplosionSfxPlayed) {
						sc.__dynamiteCharacterBonusExplosionSfxPlayed = true;
						try {
							const audio: any = (scene as any)?.audioManager ?? (window as any)?.audioManager;
							if (audio && typeof audio.playSoundEffect === 'function') {
								audio.playSoundEffect(SoundEffectType.EXPLOSION);
							} else {
								try { scene?.sound?.play?.(String(SoundEffectType.EXPLOSION)); } catch {}
							}
						} catch {}
					}
				} catch {}
				try { (scene as any)?.__dynamiteCharacterBonusGateResolve?.(); } catch {}
			});
		} catch {}
		try { await waitMs(scene, 700); } catch {}
	})();

	try {
		const sc: any = scene as any;
		sc.__dynamiteCharacterBonusPromise = promise;
	} catch {}

	try {
		await promise;
	} finally {
		try {
			const sc: any = scene as any;
			delete sc.__dynamiteCharacterBonusPromise;
			delete sc.__dynamiteCharacterBonusGateResolve;
			delete sc.__dynamiteCharacterBonusGatePromise;
			delete sc.__dynamiteCharacterBonusGateRatio;
			delete sc.__dynamiteCharacterBonusExplosionSfxPlayed;
		} catch {}
	}
}

async function waitForCharacterBonusGate(scene: any, ratio: number = 0.6): Promise<void> {
	try {
		const sc: any = scene as any;
		sc.__dynamiteCharacterBonusGateRatio = ratio;
		if (!sc.__dynamiteCharacterBonusPromise) {
			// Kick off animation if not already running
			void playCharacterBonusAndWait(scene);
		}
		const gate: any = sc.__dynamiteCharacterBonusGatePromise;
		if (gate && typeof gate.then === 'function') {
			await gate;
			return;
		}
	} catch {}
	// Fallback if gate isn't available
	try { await waitMs(scene, 420); } catch {}
}

export async function waitForCharacterBonusComplete(scene: any, timeoutMs: number = 6000): Promise<void> {
	try {
		const sc: any = scene as any;
		const p: any = sc?.__dynamiteCharacterBonusPromise;
		if (!p || typeof p.then !== 'function') return;
		await Promise.race([
			Promise.resolve(p),
			waitMs(scene, Math.max(0, (Number(timeoutMs) || 0) | 0))
		]);
	} catch {}
}

export function triggerCharacterBonusOnce(scene: any): void {
	try {
		try {
			const sc: any = scene as any;
			if (sc && sc.__dynamiteCharacterBonusPlayed) {
				return;
			}
			if (sc) {
				sc.__dynamiteCharacterBonusPlayed = true;
				try {
					const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
					const clearMs = Math.max(300, Math.floor(1200 * speed));
					scene?.time?.delayedCall?.(clearMs, () => {
						try { delete (sc as any).__dynamiteCharacterBonusPlayed; } catch {}
					});
				} catch {}
			}
		} catch {}
		void playCharacterBonusAndWait(scene);
	} catch {}
}

export async function animateDynamiteImage(scene: any, img: any, shouldTriggerCharacter: boolean = true): Promise<void> {
	if (!img) return;
	try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
	try {
		const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
		try {
			if (shouldTriggerCharacter) {
				await playCharacterBonusAndWait(scene);
			}
		} catch {}
		await spawnDynamiteImage(scene, img, 500);
		await waitMs(scene, Math.max(80, Math.floor(130 * speed)));
		await despawnDynamiteImage(scene, img, Math.max(160, Math.floor(420 * speed)));
	} catch {} finally {
		try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
	}
}

export async function spawnDynamiteImage(scene: any, img: any, durationMs: number = 250): Promise<void> {
	if (!img) return;
	try {
		const baseScaleX = typeof img.scaleX === 'number' ? img.scaleX : 1;
		const baseScaleY = typeof img.scaleY === 'number' ? img.scaleY : 1;
		try { img.setAlpha?.(1); } catch {}
		try { img.setScale?.(baseScaleX * 0.1, baseScaleY * 0.1); } catch {}
		await tween(scene, img, {
			scaleX: baseScaleX,
			scaleY: baseScaleY,
			duration: Math.max(120, Math.floor(durationMs)),
			ease: 'Back.easeOut',
		});
	} catch {}
}

export async function despawnDynamiteImage(scene: any, img: any, durationMs: number = 220): Promise<void> {
	if (!img) return;
	try {
		const baseScaleX = typeof img.scaleX === 'number' ? img.scaleX : 1;
		const baseScaleY = typeof img.scaleY === 'number' ? img.scaleY : 1;
		await tween(scene, img, {
			scaleX: baseScaleX * 1.2,
			scaleY: baseScaleY * 1.2,
			alpha: 0,
			duration: Math.max(100, Math.floor(durationMs)),
			ease: 'Sine.easeIn',
		});
	} catch {}
}

export async function playDynamiteOverlay(scene: any, x: number, y: number, depth: number = 20012): Promise<void> {
	let img: any = null;
	try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
	try {
		try {
			if (!scene?.textures?.exists?.('dynamite')) return;
			img = scene.add.image(x, y, 'dynamite').setOrigin(0.5, 0.5);
			try { img.setDepth(depth); } catch {}
			try { img.setScrollFactor(0); } catch {}
			try { img.setAlpha(1); } catch {}
			try { img.setScale(1); } catch {}
		} catch {
			img = null;
		}
		if (!img) return;

		try {
			await spawnDynamiteImage(scene, img, 180);
			await waitMs(scene, 60);
			await despawnDynamiteImage(scene, img, 180);
			// Let the grid dynamite sequence start at ~60% of the character animation
			try { await waitForCharacterBonusGate(scene, 0.6); } catch {}
		} catch {}
		try { img.destroy?.(); } catch {}
	} finally {
		try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
	}
}

export async function playBoom(scene: any, x: number, y: number, depth: number = 20014, targetW?: number, targetH?: number): Promise<void> {
	let vfx: any = null;
	try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
	try {
		try {
			const speed = gameStateManager.isTurbo ? 0.8 : 1.0;
			scene?.cameras?.main?.shake?.(
				Math.max(30, Math.floor(WATER_BOMB_VFX_SHAKE_DURATION_MS * speed)),
				WATER_BOMB_VFX_SHAKE_INTENSITY
			);
		} catch {}
		try {
			const audio: any = (scene as any)?.audioManager ?? (window as any)?.audioManager;
			if (audio && typeof audio.playSoundEffect === 'function') {
				audio.playSoundEffect(SoundEffectType.EXPLOSION);
			} else {
				try { scene?.sound?.play?.(String(SoundEffectType.EXPLOSION)); } catch {}
			}
		} catch {}

		let canCreateSpine = false;
		try {
			canCreateSpine = ensureSpineFactory(scene as any, '[DynamiteSequence] playBoom')
				&& !!(scene?.cache?.json as any)?.has?.('Water_Bomb_VFX');
		} catch {
			canCreateSpine = false;
		}
		if (!canCreateSpine) return;

		try {
			vfx = (scene.add as any).spine(x, y, 'Water_Bomb_VFX', 'Water_Bomb_VFX-atlas');
		} catch {
			vfx = null;
		}
		if (!vfx) return;
		try { vfx.setOrigin?.(0.5, 0.5); } catch {}
		try { vfx.setDepth?.(depth); } catch {}
		try { vfx.setScrollFactor?.(0); } catch {}
		try { vfx.setAlpha?.(1); } catch {}

		try {
			let fit = 1;
			const baseW = 158;
			const baseH = 158;
			const tw = Number(targetW ?? 0);
			const th = Number(targetH ?? 0);
			if (isFinite(tw) && isFinite(th) && tw > 0 && th > 0 && baseW > 0 && baseH > 0) {
				fit = Math.max(0.01, Math.min(tw / baseW, th / baseH));
			}
			try { vfx.setScale?.(fit * WATER_BOMB_VFX_SCALE_MULTIPLIER); } catch {}
		} catch {}

		let durationMs = 1000;
		try {
			const data: any = vfx?.skeleton?.data;
			const anim: any = data?.findAnimation?.('Water_Bomb_VFX');
			const sec = Number(anim?.duration);
			if (isFinite(sec) && sec > 0) durationMs = Math.floor(sec * 1000);
		} catch {}
		try {
			const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
			durationMs = Math.max(180, Math.floor(durationMs * speed));
		} catch {}

		try {
			const state: any = vfx?.animationState;
			state?.setAnimation?.(0, 'Water_Bomb_VFX', false);
		} catch {}

		await new Promise<void>((resolve) => {
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				resolve();
			};
			try {
				const state: any = vfx?.animationState;
				if (state && typeof state.addListener === 'function') {
					const listener = {
						complete: () => {
							try { state.removeListener?.(listener); } catch {}
							finish();
						}
					};
					state.addListener(listener);
				}
			} catch {}
			try { scene?.time?.delayedCall?.(Math.max(120, durationMs), () => finish()); } catch { finish(); }
		});

		try { vfx.destroy?.(); } catch {}
	} finally {
		try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
	}
}
