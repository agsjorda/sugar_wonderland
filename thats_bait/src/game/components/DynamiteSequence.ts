import { gameStateManager } from '../../managers/GameStateManager';

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

function getActiveCharacterSpine(scene: any): any {
	try {
		const fn: any = (scene as any)?.getActiveCharacterSpine;
		if (typeof fn === 'function') {
			const spine = fn.call(scene);
			if (spine) return spine;
		}
	} catch {}
	try {
		const bg: any = (scene as any)?.background;
		const spine = bg?.getCharacterSpine?.();
		if (spine) return spine;
	} catch {}
	try {
		const bb: any = (scene as any)?.bonusBackground;
		const spine = bb?.getCharacterSpine?.();
		if (spine) return spine;
	} catch {}
	return null;
}

function pickIdleAnimationName(spine: any): string | null {
	try {
		const animations: any[] | undefined = spine?.skeleton?.data?.animations;
		const hasAnim = (name: string) => Array.isArray(animations) && animations.some(a => a && a.name === name);
		const preferred = ['Character_TB_idle', 'idle', 'Idle', 'IDLE', 'animation', 'Animation'];
		const found = preferred.find(n => hasAnim(n));
		if (found) return found;
		return Array.isArray(animations) && animations.length > 0 ? (animations[0]?.name ?? null) : null;
	} catch {
		return null;
	}
}

function setRopeAndHookVisible(scene: any, visible: boolean): void {
	try {
		(scene as any)?.rope?.setVisible?.(visible);
	} catch {}
	try {
		(scene as any)?.hookImage?.setVisible?.(visible);
	} catch {}
}

async function playCharacterBonusAndWait(scene: any): Promise<void> {
	try {
		const sc: any = scene as any;
		const existing: any = sc?.__dynamiteCharacterBonusPromise;
		if (existing && typeof existing.then === 'function') {
			await existing;
			return;
		}
	} catch {}

	const promise = (async (): Promise<void> => {
		try {
			const spine = getActiveCharacterSpine(scene);
			if (!spine) {
				try { console.warn('[DynamiteSequence] playCharacterBonusAndWait: Character spine not found'); } catch {}
				return;
			}
			const state: any = spine?.animationState;
			if (!state || typeof state.setAnimation !== 'function') {
				try { console.warn('[DynamiteSequence] playCharacterBonusAndWait: animationState not available'); } catch {}
				return;
			}
			const animations: any[] | undefined = spine?.skeleton?.data?.animations;
			const hasAnim = (name: string) => Array.isArray(animations) && animations.some(a => a && a.name === name);
			const bonusName = hasAnim('Character_TB_bonus') ? 'Character_TB_bonus' : null;
			if (!bonusName) {
				try { console.warn('[DynamiteSequence] playCharacterBonusAndWait: Character_TB_bonus animation not found on spine'); } catch {}
				return;
			}
			const idleName = pickIdleAnimationName(spine);

			let restored = false;
			const restore = (): void => {
				if (restored) return;
				restored = true;
				try { setRopeAndHookVisible(scene, true); } catch {}
				try {
					if (idleName) {
						state.setAnimation(0, idleName, true);
					}
				} catch {}
			};

			try { setRopeAndHookVisible(scene, false); } catch {}

			let entry: any = null;
			try { entry = state.setAnimation(0, bonusName, false); } catch {}

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
				let gateMs = 0;
				try {
					const durationSec = entry?.animation?.duration;
					if (typeof durationSec === 'number' && isFinite(durationSec) && durationSec > 0) {
						gateMs = Math.floor(durationSec * 1000 * clampedRatio);
					}
				} catch {}
				if (!(gateMs > 0)) {
					gateMs = 420;
				}
				scene?.time?.delayedCall?.(Math.max(0, gateMs), () => {
					try { (scene as any)?.__dynamiteCharacterBonusGateResolve?.(); } catch {}
				});
			} catch {}

			await new Promise<void>((resolve) => {
				let done = false;
				const finish = (): void => {
					if (done) return;
					done = true;
					try { restore(); } catch {}
					resolve();
				};

				try {
					if (typeof state.addListener === 'function') {
						const listener = {
							complete: (_trackEntry: any) => {
								try {
									if (_trackEntry && entry && _trackEntry !== entry) {
										return;
									}
								} catch {}
								finish();
								try { state.removeListener?.(listener); } catch {}
							}
						};
						state.addListener(listener);
					}
				} catch {}

				try {
					let fallbackMs = 900;
					try {
						const durationSec = entry?.animation?.duration;
						if (typeof durationSec === 'number' && isFinite(durationSec) && durationSec > 0) {
							fallbackMs = Math.floor(durationSec * 1000 * 1.05);
						}
					} catch {}
					scene?.time?.delayedCall?.(Math.max(120, fallbackMs), () => finish());
				} catch {
					finish();
				}
			});
		} catch {
			try { setRopeAndHookVisible(scene, true); } catch {}
		}
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
	let boom: any = null;
	try { (gameStateManager as any).acquireCriticalSequenceLock?.(); } catch {}
	try {
		try {
			if (!scene?.textures?.exists?.('boom')) return;
			boom = scene.add.image(x, y, 'boom').setOrigin(0.5, 0.5);
			try { boom.setDepth(depth); } catch {}
			try { boom.setScrollFactor(0); } catch {}
			try { boom.setAlpha(1); } catch {}
			try {
				const baseW = (boom.width ?? 1) as number;
				const baseH = (boom.height ?? 1) as number;
				let fit = 1;
				try {
					const tw = Number(targetW ?? 0);
					const th = Number(targetH ?? 0);
					if (isFinite(tw) && isFinite(th) && tw > 0 && th > 0 && baseW > 0 && baseH > 0) {
						fit = Math.max(0.01, Math.min(tw / baseW, th / baseH));
					}
				} catch {}
				boom.__boomFitScale = fit;
				boom.setScale(fit * 0.25);
			} catch {
				try { boom.setScale(0.25); } catch {}
			}
		} catch {
			boom = null;
		}
		if (!boom) return;

		try {
			try { scene?.cameras?.main?.shake?.(70, 0.002); } catch {}
			const speed = gameStateManager.isTurbo ? 0.65 : 1.0;
			let fit = 1;
			try {
				const f = Number((boom as any).__boomFitScale ?? 1);
				if (isFinite(f) && f > 0) fit = f;
			} catch {}
			await tween(scene, boom, {
				scaleX: fit * 1.25,
				scaleY: fit * 1.25,
				alpha: 0,
				duration: Math.max(140, Math.floor(280 * speed)),
				ease: 'Sine.easeOut',
			});
		} catch {}
		try { boom.destroy?.(); } catch {}
	} finally {
		try { (gameStateManager as any).releaseCriticalSequenceLock?.(); } catch {}
	}
}
