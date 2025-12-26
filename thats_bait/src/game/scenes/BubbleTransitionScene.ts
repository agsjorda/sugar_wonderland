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

export class BubbleTransitionScene extends Scene {
	private transitionData?: BubbleTransitionData;
	private hasStartedGame: boolean = false;
	private hasFinished: boolean = false;
	private hasPlayedTransitionSfx: boolean = false;
	private transitionSpine?: any;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private gameCamera?: Phaser.Cameras.Scene2D.Camera;
	private didFadeGameCamera: boolean = false;
	private toSceneKey?: string;
	private hardStopTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super('BubbleTransition');
	}

	init(data: BubbleTransitionData): void {
		this.transitionData = data;
		try { this.hasPlayedTransitionSfx = false; } catch {}
	}

	create(): void {
		console.log('[BubbleTransitionScene] create');
		try { this.hasPlayedTransitionSfx = false; } catch {}
		this.cameras.main.setBackgroundColor(0x050d18);
		try {
			// Make camera background fully transparent so we can see scenes underneath
			(this.cameras.main.backgroundColor as any).alpha = 0;
		} catch {}
		try { this.hardStopTimer?.destroy(); } catch {}
		try {
			this.hardStopTimer = this.time.delayedCall(4500, () => {
				if (this.hasFinished) return;
				console.warn('[BubbleTransitionScene] Hard stop fallback triggered');
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
			0x050d18,
			1
		).setOrigin(0.5, 0.5);
		this.overlayRect.setDepth(0);
		this.overlayRect.setAlpha(0);

		this.playBubbleAnimation();
	}

	private cleanupAndStop(): void {
		try {
			const toKey = this.toSceneKey || this.transitionData?.toSceneKey || 'Game';
			const toScene: any = this.scene.get(toKey) as any;
			const evt = this.transitionData?.toSceneEventOnFinish;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[BubbleTransitionScene] emit toSceneEventOnFinish', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventOnFinishData);
			}
		} catch {}
		try { this.transitionSpine?.destroy(); } catch {}
		try { this.overlayRect?.destroy(); } catch {}
		try { this.hardStopTimer?.destroy(); } catch {}
		try { this.hardStopTimer = undefined; } catch {}
		try { this.scene.stop(); } catch {}
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

	private playBubbleAnimation(): void {
		this.playTransitionSfxOnce();
		const hasFactory = ensureSpineFactory(this as any, '[BubbleTransitionScene] playBubbleAnimation');
		if (!hasFactory) {
			const targets: any[] = [];
			if (this.overlayRect) targets.push(this.overlayRect);
			if (targets.length > 0) {
				this.tweens.add({ targets, alpha: 1, duration: 350, ease: 'Power2' });
			}
			this.time.delayedCall(600, () => { this.startGameIfNeeded(); });
			this.time.delayedCall(1200, () => { this.finishTransition(); });
			return;
		}

		const spineKey = 'bubbles_transition';
		const atlasKey = spineKey + '-atlas';

		const jsonCache: any = (this.cache as any).json;
		if (!jsonCache?.has?.(spineKey)) {
			const targets: any[] = [];
			if (this.overlayRect) targets.push(this.overlayRect);
			if (targets.length > 0) {
				this.tweens.add({ targets, alpha: 1, duration: 350, ease: 'Power2' });
			}
			this.time.delayedCall(600, () => { this.startGameIfNeeded(); });
			this.time.delayedCall(1200, () => { this.finishTransition(); });
			return;
		}

		const cx = this.scale.width * 0.5;
		const cy = this.scale.height * 0.5;
		const spine = (this.add as any).spine(cx, cy, spineKey, atlasKey);
		this.transitionSpine = spine;
		spine.setOrigin(0.5, 0.5);
		spine.setDepth(1);

		const desiredHeight = this.scale.height * 1.1;
		const spineH = (spine as any).height || 800;
		const scale = desiredHeight / spineH;
		spine.setScale(scale);
		spine.setAlpha(0);

		const fadeInTargets: any[] = [];
		if (this.overlayRect) fadeInTargets.push(this.overlayRect);
		fadeInTargets.push(spine);
		this.tweens.add({
			targets: fadeInTargets,
			alpha: 1,
			duration: 800,
			ease: 'Power2'
		});

		let data: any = undefined;
		let animations: any[] = [];
		try {
			data = spine.skeleton?.data;
			animations = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
		} catch {}

		let animName: string | null = null;
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

		let durationSec = 2.0;
		try {
			if (animName && data && typeof data.findAnimation === 'function') {
				const anim = data.findAnimation(animName);
				if (anim && typeof anim.duration === 'number') {
					durationSec = Math.max(0.1, anim.duration);
				}
			} else if (Array.isArray(animations) && animations[0]?.duration) {
				const d = animations[0].duration;
				if (typeof d === 'number') durationSec = Math.max(0.1, d);
			}
		} catch {}

		let state: any = undefined;
		try {
			state = spine.animationState;
			if (animName) {
				state.setAnimation(0, animName, false);
			}
		} catch {}

		const rawTimeScale = state?.timeScale;
		const timeScale = (typeof rawTimeScale === 'number' && isFinite(rawTimeScale) && rawTimeScale > 0.05)
			? rawTimeScale
			: 1;
		let totalMs = (durationSec / timeScale) * 1000;
		if (!isFinite(totalMs) || totalMs <= 0) totalMs = 2000;
		const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
		const toKey = this.transitionData?.toSceneKey || 'Game';
		const sameScene = fromKey === toKey;
		if (sameScene) totalMs = 2000;
		totalMs = Math.min(totalMs, 2400);
		const midMs = sameScene ? 650 : totalMs * 0.5;
		// Start fade-out a bit earlier so Game cross-fades in while bubbles are still visible
		const endMs = sameScene ? 1200 : totalMs * 0.6;

		this.time.delayedCall(midMs, () => {
			this.startGameIfNeeded();
		});

		this.time.delayedCall(endMs, () => {
			this.finishTransition();
		});
	}

	private startGameIfNeeded(): void {
		if (this.hasStartedGame) return;
		this.hasStartedGame = true;

		const toKey = this.transitionData?.toSceneKey || 'Game';
		const fromKey = this.transitionData?.fromSceneKey || 'Preloader';
		const startData = this.transitionData?.gameStartData || {};
		this.toSceneKey = toKey;
		this.didFadeGameCamera = false;

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
		try {
			const evt = this.transitionData?.toSceneEvent;
			if (evt && toScene?.events && typeof toScene.events.emit === 'function') {
				console.log('[BubbleTransitionScene] emit toSceneEvent', evt);
				toScene.events.emit(evt, this.transitionData?.toSceneEventData);
			}
		} catch {}
		try {
			const cam = toScene?.cameras?.main;
			if (cam) {
				this.gameCamera = cam;
				if (fromKey !== toKey) {
					this.didFadeGameCamera = true;
					this.gameCamera?.setAlpha(0);
				}
			}
		} catch {}
	}

	private finishTransition(): void {
		if (this.hasFinished) return;
		this.hasFinished = true;

		const targets: any[] = [];
		if (this.transitionSpine) targets.push(this.transitionSpine);
		if (this.overlayRect) targets.push(this.overlayRect);

		if (targets.length === 0) {
			if (this.gameCamera) {
				try { this.gameCamera.setAlpha(1); } catch {}
			}
			this.cleanupAndStop();
			return;
		}

		this.tweens.add({
			targets,
			alpha: 0,
			duration: 800,
			ease: 'Power2',
			onComplete: () => {
				this.cleanupAndStop();
			}
		});

		if (this.gameCamera && this.didFadeGameCamera) {
			this.tweens.add({
				targets: this.gameCamera,
				alpha: 1,
				duration: 600,
				ease: 'Power2'
			});
		}
	}
}
