import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

interface BubbleTransitionData {
	fromSceneKey?: string;
	toSceneKey?: string;
	gameStartData?: any;
}

export class BubbleTransitionScene extends Scene {
	private transitionData?: BubbleTransitionData;
	private hasStartedGame: boolean = false;
	private hasFinished: boolean = false;
	private transitionSpine?: any;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private gameCamera?: Phaser.Cameras.Scene2D.Camera;

	constructor() {
		super('BubbleTransition');
	}

	init(data: BubbleTransitionData): void {
		this.transitionData = data;
	}

	create(): void {
		this.cameras.main.setBackgroundColor(0x050d18);
		try {
			// Make camera background fully transparent so we can see scenes underneath
			(this.cameras.main.backgroundColor as any).alpha = 0;
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

	private playBubbleAnimation(): void {
		const hasFactory = ensureSpineFactory(this as any, '[BubbleTransitionScene] playBubbleAnimation');
		if (!hasFactory) {
			this.startGameIfNeeded();
			this.finishTransition();
			return;
		}

		const spineKey = 'bubbles_transition';
		const atlasKey = spineKey + '-atlas';

		const jsonCache: any = (this.cache as any).json;
		if (!jsonCache?.has?.(spineKey)) {
			this.startGameIfNeeded();
			this.finishTransition();
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

		const timeScale = Math.max(0.0001, state?.timeScale || 1);
		const totalMs = (durationSec / timeScale) * 1000;
		const midMs = totalMs * 0.5;
		// Start fade-out a bit earlier so Game cross-fades in while bubbles are still visible
		const endMs = totalMs * 0.6;

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

		try {
			if (fromKey && this.scene.isActive(fromKey)) {
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
			const cam = toScene?.cameras?.main;
			if (cam) {
				this.gameCamera = cam;
				this.gameCamera?.setAlpha(0);
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
			this.scene.stop();
			return;
		}

		this.tweens.add({
			targets,
			alpha: 0,
			duration: 800,
			ease: 'Power2',
			onComplete: () => {
				try { this.transitionSpine?.destroy(); } catch {}
				try { this.overlayRect?.destroy(); } catch {}
				this.scene.stop();
			}
		});

		if (this.gameCamera) {
			this.tweens.add({
				targets: this.gameCamera,
				alpha: 1,
				duration: 600,
				ease: 'Power2'
			});
		}
	}
}
