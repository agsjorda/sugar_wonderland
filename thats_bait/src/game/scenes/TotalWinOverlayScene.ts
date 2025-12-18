import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class TotalWinOverlayScene extends Scene {
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private overlaySpine?: any;
	private clickCatcher?: Phaser.GameObjects.Rectangle;
	private isClosing: boolean = false;
	private resizeHandler?: () => void;

	constructor() {
		super('TotalWinOverlay');
	}

	create(): void {
		try { this.scene.bringToTop('TotalWinOverlay'); } catch {}
		this.cameras.main.setBackgroundColor(0x000000);
		try { (this.cameras.main.backgroundColor as any).alpha = 0; } catch {}

		try {
			this.events.once('shutdown', () => {
				try {
					if (this.resizeHandler) {
						this.scale.off('resize', this.resizeHandler);
					}
				} catch {}
				this.resizeHandler = undefined;
				try { this.clickCatcher?.removeAllListeners?.(); } catch {}
				try { this.clickCatcher?.destroy(); } catch {}
				try { this.overlayRect?.destroy(); } catch {}
				try { this.overlaySpine?.destroy?.(); } catch {}
				this.clickCatcher = undefined;
				this.overlayRect = undefined;
				this.overlaySpine = undefined;
			});
		} catch {}

		this.resizeHandler = () => {
			try { this.layoutToCamera(); } catch {}
		};
		try { this.scale.on('resize', this.resizeHandler); } catch {}

		this.overlayRect = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000,
			1
		).setOrigin(0.5, 0.5);
		this.overlayRect.setDepth(0);
		this.overlayRect.setAlpha(0.75);
		try { (this.overlayRect as any).setScrollFactor?.(0); } catch {}

		this.createSpine();
		this.createClickCatcher();
		try { this.layoutToCamera(); } catch {}
	}

	private layoutToCamera(): void {
		try {
			const cam = this.cameras.main;
			const cx = cam.centerX;
			const cy = cam.centerY;
			const w = cam.width;
			const h = cam.height;
			try {
				if (this.overlayRect) {
					this.overlayRect.setPosition(cx, cy);
					this.overlayRect.setSize(w, h);
				}
			} catch {}
			try {
				if (this.clickCatcher) {
					this.clickCatcher.setPosition(cx, cy);
					this.clickCatcher.setSize(w, h);
				}
			} catch {}
			try {
				if (this.overlaySpine) {
					this.overlaySpine.setPosition(cx, cy);
					let bw = 0;
					let bh = 0;
					try {
						const b = this.overlaySpine.getBounds?.();
						bw = (b?.size?.x ?? b?.size?.width ?? (b as any)?.width ?? 0) as number;
						bh = (b?.size?.y ?? b?.size?.height ?? (b as any)?.height ?? 0) as number;
					} catch {}
					if (!bw || !bh) {
						bw = (this.overlaySpine.width ?? this.overlaySpine.displayWidth ?? 0) as number;
						bh = (this.overlaySpine.height ?? this.overlaySpine.displayHeight ?? 0) as number;
					}
					if (bw > 0 && bh > 0) {
						const targetW = w * 0.92;
						const targetH = h * 0.78;
						const s = Math.min(targetW / bw, targetH / bh);
						if (isFinite(s) && s > 0) {
							this.overlaySpine.setScale(s);
						}
					}
				}
			} catch {}
		} catch {}
	}

	private createSpine(): void {
		if (!ensureSpineFactory(this as any, '[TotalWinOverlayScene]')) return;

		const spineKey = 'TotalW_TB';
		const atlasKey = spineKey + '-atlas';
		const jsonCache: any = (this.cache as any).json;
		if (!jsonCache?.has?.(spineKey)) {
			return;
		}

		const cx = this.cameras.main.centerX;
		const cy = this.cameras.main.centerY;
		let spine: any;
		try {
			spine = (this.add as any).spine(cx, cy, spineKey, atlasKey);
		} catch {
			return;
		}

		this.overlaySpine = spine;
		try { spine.setOrigin(0.5, 0.5); } catch {}
		try { spine.setDepth(2); } catch {}
		try { spine.setAlpha(1); } catch {}
		try { spine.setScrollFactor?.(0); } catch {}

		try { this.layoutToCamera(); } catch {}

		try {
			const data: any = spine.skeleton?.data;
			const animations: any[] = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
			let animName: string | null = null;
			if (Array.isArray(animations) && animations.length > 0) {
				const preferred = ['animation', 'Animation', 'idle', 'Idle'];
				for (const name of preferred) {
					const found = animations.find((a) => a && a.name === name);
					if (found) {
						animName = found.name;
						break;
					}
				}
				if (!animName) animName = animations[0]?.name || null;
			}
			if (!animName) animName = 'animation';
			const state = spine.animationState;
			if (state && typeof state.setAnimation === 'function') {
				state.setAnimation(0, animName, true);
			}
		} catch {}
	}

	private createClickCatcher(): void {
		this.clickCatcher = this.add.rectangle(
			this.cameras.main.centerX,
			this.cameras.main.centerY,
			this.cameras.main.width,
			this.cameras.main.height,
			0x000000,
			0
		).setOrigin(0.5, 0.5);
		this.clickCatcher.setDepth(999999);
		try { (this.clickCatcher as any).setScrollFactor?.(0); } catch {}
		this.clickCatcher.setInteractive();
		this.clickCatcher.on('pointerdown', () => this.requestClose());
	}

	private requestClose(): void {
		if (this.isClosing) return;
		this.isClosing = true;
		try { this.clickCatcher?.disableInteractive(); } catch {}

		try {
			const sceneAny: any = this.scene as any;
			if (sceneAny?.isActive?.('BubbleOverlayTransition') || sceneAny?.isSleeping?.('BubbleOverlayTransition')) {
				sceneAny.stop('BubbleOverlayTransition');
			}
		} catch {}

		try {
			this.scene.launch('BubbleOverlayTransition', {
				fromSceneKey: 'TotalWinOverlay',
				toSceneKey: 'Game',
				stopFromScene: true,
				toSceneEventOnFinish: 'finalizeBonusExit'
			});
			try { this.scene.bringToTop?.('BubbleOverlayTransition'); } catch {}
		} catch {
			try { this.scene.stop('TotalWinOverlay'); } catch {}
		}
	}
}
