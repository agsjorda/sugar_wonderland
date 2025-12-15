import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';

export class FreeSpinOverlay {
	private scene: Scene | null = null;
	private container: Phaser.GameObjects.Container | null = null;
	private background: Phaser.GameObjects.Rectangle | null = null;
	private spine: any | null = null;
	private numberDisplay: NumberDisplay | null = null;
	private valueOffsetX: number = -10;
	private valueOffsetY: number = -95;
	private valueOffsetModifierX: number = 1;
	private valueOffsetModifierY: number = 1;
	private valueScaleModifier: number = 2.5;
	private valueBobAmplitude: number = 2;
	private valueBobDurationMs: number = 1200;
	private valueBobTween: Phaser.Tweens.Tween | null = null;
	private isInitialized: boolean = false;
	private isShowing: boolean = false;
	private dismissResolver?: () => void;
	private networkManager: NetworkManager | null = null;
	private screenModeManager: ScreenModeManager | null = null;

	constructor(scene?: Scene, networkManager?: NetworkManager, screenModeManager?: ScreenModeManager) {
		if (scene) {
			this.initialize(scene, networkManager || null, screenModeManager || null);
		}
	}

	public setValuePositionOffset(offsetX: number, offsetY: number): void {
		this.valueOffsetX = offsetX;
		this.valueOffsetY = offsetY;
	}

	public setValueOffsetModifier(modifierX: number, modifierY: number): void {
		this.valueOffsetModifierX = isFinite(modifierX) && modifierX !== 0 ? modifierX : 1;
		this.valueOffsetModifierY = isFinite(modifierY) && modifierY !== 0 ? modifierY : 1;
	}

	public setValueScaleModifier(modifier: number): void {
		this.valueScaleModifier = modifier > 0 ? modifier : 1;
	}

	public setValueBobEffect(amplitude: number, durationMs: number): void {
		this.valueBobAmplitude = isFinite(amplitude) ? Math.max(0, amplitude) : this.valueBobAmplitude;
		this.valueBobDurationMs = isFinite(durationMs) ? Math.max(200, durationMs) : this.valueBobDurationMs;
	}

	public initialize(scene: Scene, networkManager?: NetworkManager | null, screenModeManager?: ScreenModeManager | null): void {
		if (this.isInitialized) return;
		this.scene = scene;
		this.networkManager = networkManager || null;
		this.screenModeManager = screenModeManager || null;
		this.container = this.scene.add.container(0, 0);
		this.container.setDepth(10000);
		this.container.setVisible(false);
		this.background = this.scene.add.rectangle(
			this.scene.cameras.main.centerX,
			this.scene.cameras.main.centerY,
			this.scene.cameras.main.width * 2,
			this.scene.cameras.main.height * 2,
			0x000000,
			1
		);
		this.background.setOrigin(0.5);
		this.background.setAlpha(0);
		this.background.setInteractive();
		this.container.add(this.background);
		try {
			(this.container as any).setScrollFactor?.(0);
			(this.background as any).setScrollFactor?.(0);
		} catch {}
		this.background.on('pointerdown', () => {
			if (!this.isShowing) return;
			this.hide(200);
		});
		this.isInitialized = true;
	}

	public show(spinsLeft: number, onComplete?: () => void): void {
		if (!this.scene || !this.container || !this.background) return;
		if (this.isShowing) {
			if (onComplete) onComplete();
			return;
		}
		this.isShowing = true;
		this.container.setVisible(true);
		this.container.setDepth(10000);
		try {
			this.container.setAlpha(1);
		} catch {}
		this.background.setFillStyle(0x000000, 1);
		this.background.setAlpha(0);
		if (this.spine) {
			try {
				this.spine.destroy();
			} catch {}
			this.spine = null;
		}
		if (this.numberDisplay) {
			try {
				this.numberDisplay.destroy();
			} catch {}
			this.numberDisplay = null;
		}
		if (this.valueBobTween) {
			try { this.valueBobTween.stop(); } catch {}
			this.valueBobTween = null;
		}
		const targetAlpha = 0.5;
		const durationMs = 700;
		this.scene.tweens.add({
			targets: this.background,
			alpha: targetAlpha,
			duration: durationMs,
			ease: 'Cubic.easeOut',
			onComplete: () => {
				this.createSpine();
				this.createNumberDisplay(spinsLeft);
				if (onComplete) onComplete();
			}
		});
	}

	private createSpine(): void {
		if (!this.scene || !this.container) return;
		if (!ensureSpineFactory(this.scene, '[FreeSpinOverlay]')) return;
		const cam = this.scene.cameras.main;
		const x = cam.width * 0.5;
		const y = cam.height * 0.45;
		try {
			const spineObj = (this.scene.add as any).spine(x, y, 'FreeSpin_TB', 'FreeSpin_TB-atlas');
			try {
				spineObj.setOrigin(0.5, 0.5);
			} catch {}
			try {
				spineObj.setScrollFactor?.(0);
			} catch {}
			const scale = this.getSpineScale(spineObj);
			try {
				spineObj.setScale(scale);
			} catch {}
			this.container.add(spineObj);
			this.spine = spineObj;
			try {
				const state = spineObj.animationState;
				if (state && typeof state.setAnimation === 'function') {
					let animName: string | null = null;
					try {
						const data = spineObj.skeleton?.data;
						const anims: any[] = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
						if (anims && anims.length > 0) {
							animName = anims[0].name || null;
						}
					} catch {}
					if (!animName) animName = 'animation';
					state.setAnimation(0, animName, true);
				}
			} catch {}
		} catch {}
	}

	private getSpineScale(spineObj: any): number {
		try {
			const cam = this.scene!.cameras.main;
			let bw = 0;
			let bh = 0;
			try {
				const b = spineObj.getBounds?.();
				bw = (b && (b.size?.x || b.size?.width || (b as any).width)) || 0;
				bh = (b && (b.size?.y || b.size?.height || (b as any).height)) || 0;
			} catch {}
			if (!bw || !bh) {
				bw = spineObj.displayWidth || 0;
				bh = spineObj.displayHeight || 0;
			}
			if (!bw || !bh) return 1;
			const targetW = cam.width * 0.7;
			const targetH = cam.height * 0.6;
			const sx = targetW / bw;
			const sy = targetH / bh;
			const s = Math.min(sx, sy);
			return s;
		} catch {
			return 1;
		}
	}

	private createNumberDisplay(spinsLeft: number): void {
		if (!this.scene) return;
		const sceneAny: any = this.scene as any;
		const networkManager = sceneAny?.networkManager as NetworkManager | undefined;
		const screenModeManager = sceneAny?.screenModeManager as ScreenModeManager | undefined;
		if (!networkManager || !screenModeManager) return;
		const cam = this.scene.cameras.main;
		const baseX = cam.centerX;
		const baseY = cam.centerY;
		const baseScale = 0.26;
		const offsetX = this.valueOffsetX * this.valueOffsetModifierX;
		const offsetY = this.valueOffsetY * this.valueOffsetModifierY;
		const cfg: NumberDisplayConfig = {
			x: baseX + offsetX,
			y: baseY + offsetY,
			scale: baseScale,
			spacing: 0,
			alignment: 'center',
			decimalPlaces: 0,
			showCommas: false,
			prefix: '',
			suffix: '',
			commaYOffset: 12,
			dotYOffset: 10
		};
		const nd = new NumberDisplay(networkManager, screenModeManager, cfg);
		nd.create(this.scene);
		nd.displayValue(Math.max(0, spinsLeft | 0));
		this.numberDisplay = nd;
		const cont = nd.getContainer();
		const targetY = cont.y;
		const startY = targetY + 12;
		try {
			cont.setAlpha(0);
			cont.y = startY;
			cont.setScale(0.7 * this.valueScaleModifier);
		} catch {}
		this.container?.add(cont);
		this.scene.tweens.add({
			targets: cont,
			alpha: 1,
			y: targetY,
			scaleX: this.valueScaleModifier,
			scaleY: this.valueScaleModifier,
			duration: 450,
			ease: 'Back.Out',
			delay: 200,
			onComplete: () => {
				if (!this.scene) return;
				if (this.valueBobTween) {
					try { this.valueBobTween.stop(); } catch {}
					this.valueBobTween = null;
				}
				const amp = Math.max(0, this.valueBobAmplitude);
				if (amp <= 0) return;
				try {
					this.valueBobTween = this.scene.tweens.add({
						targets: cont,
						y: { from: targetY - amp, to: targetY + amp },
						duration: Math.max(200, this.valueBobDurationMs),
						ease: 'Sine.easeInOut',
						yoyo: true,
						repeat: -1
					});
				} catch {}
			}
		});
	}

	public hide(duration: number = 300, onComplete?: () => void): void {
		if (!this.isShowing || !this.scene || !this.container) {
			if (onComplete) onComplete();
			return;
		}
		const target = this.container;
		this.scene.tweens.add({
			targets: target,
			alpha: 0,
			duration,
			ease: 'Cubic.easeIn',
			onComplete: () => {
				try {
					target.setVisible(false);
					target.setAlpha(1);
				} catch {}
				this.isShowing = false;
				if (this.valueBobTween) {
					try { this.valueBobTween.stop(); } catch {}
					this.valueBobTween = null;
				}
				if (this.spine) {
					try {
						this.spine.destroy();
					} catch {}
					this.spine = null;
				}
				if (this.numberDisplay) {
					try {
						const cont = this.numberDisplay.getContainer?.();
						if (cont) {
							try { this.scene?.tweens.killTweensOf(cont); } catch {}
						}
					} catch {}
					try {
						this.numberDisplay.destroy();
					} catch {}
					this.numberDisplay = null;
				}
				if (onComplete) onComplete();
				if (this.dismissResolver) {
					const resolver = this.dismissResolver;
					this.dismissResolver = undefined;
					resolver();
				}
			}
		});
	}

	public waitUntilDismissed(): Promise<void> {
		if (!this.isShowing) return Promise.resolve();
		return new Promise<void>((resolve) => {
			this.dismissResolver = resolve;
		});
	}

	public getIsShowing(): boolean {
		return this.isShowing;
	}
}
