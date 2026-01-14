import Phaser, { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class GaugeMeter {
	private scene?: Scene;
	private container?: Phaser.GameObjects.Container;
	private level1MeterContainer?: Phaser.GameObjects.Container;
	private level2MeterContainer?: Phaser.GameObjects.Container;
	private level3MeterContainer?: Phaser.GameObjects.Container;
	private bar?: Phaser.GameObjects.Rectangle;
	private indicator?: Phaser.GameObjects.Image;
	private indicator2?: Phaser.GameObjects.Image;
	private indicator3?: Phaser.GameObjects.Image;
	private level1?: Phaser.GameObjects.Image;
	private level2?: Phaser.GameObjects.Image;
	private level3?: Phaser.GameObjects.Image;
	private stage1Container?: Phaser.GameObjects.Container;
	private stage1Shadows: Phaser.GameObjects.Image[] = [];
	private stage1Glows: Phaser.GameObjects.Image[] = [];
	private stage1Indicators: Phaser.GameObjects.Image[] = [];
	private stage1CompleteImage?: any;
	private stage1RewardImage?: Phaser.GameObjects.Image;
	private stage1MultiplierImage?: Phaser.GameObjects.Image;
	private stage1RewardHighlightTween?: Phaser.Tweens.Tween;
	private stage1RewardIntroTween?: Phaser.Tweens.Tween;
	private stage1RewardAnimating: boolean = false;
	private stage1MultiplierIdleTween?: Phaser.Tweens.Tween;
	private stage1MultiplierIntroTween?: Phaser.Tweens.Tween;
	private stage1MultiplierAnimating: boolean = false;
	private stage1CompletePromise?: Promise<void>;
	private stage1CompletePromiseResolve?: () => void;
	private stage1FloatTween?: Phaser.Tweens.Tween;
	private stage2Container?: Phaser.GameObjects.Container;
	private stage2Shadows: Phaser.GameObjects.Image[] = [];
	private stage2Glows: Phaser.GameObjects.Image[] = [];
	private stage2Indicators: Phaser.GameObjects.Image[] = [];
	private stage2CompleteImage?: any;
	private stage2RewardImage?: Phaser.GameObjects.Image;
	private stage2MultiplierImage?: Phaser.GameObjects.Image;
	private stage2RewardHighlightTween?: Phaser.Tweens.Tween;
	private stage2RewardIntroTween?: Phaser.Tweens.Tween;
	private stage2RewardAnimating: boolean = false;
	private stage2MultiplierIdleTween?: Phaser.Tweens.Tween;
	private stage2MultiplierIntroTween?: Phaser.Tweens.Tween;
	private stage2MultiplierAnimating: boolean = false;
	private stage2CompletePromise?: Promise<void>;
	private stage2CompletePromiseResolve?: () => void;
	private stage2FloatTween?: Phaser.Tweens.Tween;
	private stage3Container?: Phaser.GameObjects.Container;
	private stage3Shadows: Phaser.GameObjects.Image[] = [];
	private stage3Glows: Phaser.GameObjects.Image[] = [];
	private stage3Indicators: Phaser.GameObjects.Image[] = [];
	private stage3CompleteImage?: any;
	private stage3RewardImage?: Phaser.GameObjects.Image;
	private stage3MultiplierImage?: Phaser.GameObjects.Image;
	private stage3RewardHighlightTween?: Phaser.Tweens.Tween;
	private stage3RewardIntroTween?: Phaser.Tweens.Tween;
	private stage3RewardAnimating: boolean = false;
	private stage3MultiplierIdleTween?: Phaser.Tweens.Tween;
	private stage3MultiplierIntroTween?: Phaser.Tweens.Tween;
	private stage3MultiplierAnimating: boolean = false;
	private stage3CompletePromise?: Promise<void>;
	private stage3CompletePromiseResolve?: () => void;
	private stage3FloatTween?: Phaser.Tweens.Tween;
	private resizeHandler?: () => void;
	private indicatorIntroPromise?: Promise<void>;
	private indicatorIntroPlayed: boolean = false;
	private stage1Progress: number = 0;
	private level1MeterFaded: boolean = false;
	private stage1CompleteAnimating: boolean = false;
	private stage1CompleteDone: boolean = false;
	private stage2Progress: number = 0;
	private level2MeterFaded: boolean = false;
	private stage2CompleteAnimating: boolean = false;
	private stage2CompleteDone: boolean = false;
	private stage3Progress: number = 0;
	private level3MeterFaded: boolean = false;
	private stage3CompleteAnimating: boolean = false;
	private stage3CompleteDone: boolean = false;

	private modifiers = {
		offsetX: 0,
		offsetY: 20,
		spacingX: 120,
		barThickness: 6,
		indicatorOffsetX: 15,
		indicatorOffsetY: -5,
		indicatorScale: 0.3,
		indicator2OffsetX: 15,
		indicator2OffsetY: -5,
		indicator2Scale: 0.3,
		indicator3OffsetX: 15,
		indicator3OffsetY: -5,
		indicator3Scale: 0.3,
		indicatorIntroDuration: 420,
		stage1OffsetX: 0,
		stage1OffsetY: 0,
		stage1Scale: 1.3,
		stage1Gap: 8,
		stage1ShadowOffsetX: 4,
		stage1ShadowOffsetY: 4,
		stage1ShadowAlpha: 0.35,
		stage1ShadowScale: 1.03,
		stage1GlowTint: 0xfff6b0,
		stage1GlowAlpha: 0.85,
		stage1GlowScale: 1.45,
		stage1GlowDuration: 320,
		stage1UnlockDuration: 220,
		stage1UnlockYOffset: -6,
		stage1FloatAmplitude: 1.8,
		stage1FloatDuration: 1800,
		stage2OffsetX: 0,
		stage2OffsetY: 0,
		stage2Scale: 1.3,
		stage2Gap: 8,
		stage2ShadowOffsetX: 4,
		stage2ShadowOffsetY: 4,
		stage2ShadowAlpha: 0.35,
		stage2ShadowScale: 1.03,
		stage2GlowTint: 0xfff6b0,
		stage2GlowAlpha: 0.85,
		stage2GlowScale: 1.45,
		stage2GlowDuration: 320,
		stage2UnlockDuration: 220,
		stage2UnlockYOffset: -6,
		stage2FloatAmplitude: 1.8,
		stage2FloatDuration: 1800,
		stage1RewardScale: 1,
		stage1MultiplierScale: 1,
		stage2RewardScale: 1,
		stage2MultiplierScale: 1,
		stage3OffsetX: 0,
		stage3OffsetY: 0,
		stage3Scale: 1.3,
		stage3Gap: 8,
		stage3ShadowOffsetX: 4,
		stage3ShadowOffsetY: 4,
		stage3ShadowAlpha: 0.35,
		stage3ShadowScale: 1.03,
		stage3GlowTint: 0xfff6b0,
		stage3GlowAlpha: 0.85,
		stage3GlowScale: 1.45,
		stage3GlowDuration: 320,
		stage3UnlockDuration: 220,
		stage3UnlockYOffset: -6,
		stage3FloatAmplitude: 1.8,
		stage3FloatDuration: 1800,
		stage3RewardScale: 1,
		stage3MultiplierScale: 1,
		scale: 2.5,
		depth: 950
	};

	create(scene: Scene): void {
		this.scene = scene;

		try {
			this.container?.destroy();
		} catch {}
		this.container = scene.add.container(0, 0);
		this.container.setDepth(this.modifiers.depth);
		try {
			this.level1MeterContainer?.destroy();
		} catch {}
		this.level1MeterContainer = scene.add.container(0, 0);
		try {
			this.level2MeterContainer?.destroy();
		} catch {}
		this.level2MeterContainer = scene.add.container(0, 0);
		try {
			this.level3MeterContainer?.destroy();
		} catch {}
		this.level3MeterContainer = scene.add.container(0, 0);

		this.bar = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.45);
		this.bar.setOrigin(0.5, 0.5);

		this.indicator = scene.add.image(0, 0, 'meter-indicator').setOrigin(0.5, 0.5);
		this.indicator.setVisible(false);
		this.indicator.setAlpha(0);

		this.indicator2 = scene.add.image(0, 0, 'meter-indicator').setOrigin(0.5, 0.5);
		this.indicator2.setVisible(false);
		this.indicator2.setAlpha(0);

		this.indicator3 = scene.add.image(0, 0, 'meter-indicator').setOrigin(0.5, 0.5);
		this.indicator3.setVisible(false);
		this.indicator3.setAlpha(0);

		this.level1 = scene.add.image(0, 0, 'level1-meter').setOrigin(0.5, 0.5);
		this.level2 = scene.add.image(0, 0, 'level2-meter').setOrigin(0.5, 0.5);
		this.level3 = scene.add.image(0, 0, 'level3-meter').setOrigin(0.5, 0.5);

		this.stage1Container = scene.add.container(0, 0);
		this.stage1Shadows = [];
		this.stage1Glows = [];
		this.stage1Indicators = [];
		this.stage1CompleteImage = undefined;
		this.stage1RewardImage = undefined;
		this.stage1MultiplierImage = undefined;
		this.stage1RewardHighlightTween = undefined;
		this.stage1RewardIntroTween = undefined;
		this.stage1RewardAnimating = false;
		this.stage1MultiplierIdleTween = undefined;
		this.stage1MultiplierIntroTween = undefined;
		this.stage1MultiplierAnimating = false;
		this.stage1CompletePromise = undefined;
		this.stage1CompletePromiseResolve = undefined;
		this.stage2Progress = 0;
		this.level2MeterFaded = false;
		this.stage2CompleteAnimating = false;
		this.stage2CompleteDone = false;
		this.stage2CompletePromise = undefined;
		this.stage2CompletePromiseResolve = undefined;
		this.stage2FloatTween = undefined;
		this.stage2RewardImage = undefined;
		this.stage2MultiplierImage = undefined;
		this.stage2RewardHighlightTween = undefined;
		this.stage2RewardIntroTween = undefined;
		this.stage2RewardAnimating = false;
		this.stage2MultiplierIdleTween = undefined;
		this.stage2MultiplierIntroTween = undefined;
		this.stage2MultiplierAnimating = false;
		this.stage3Progress = 0;
		this.level3MeterFaded = false;
		this.stage3CompleteAnimating = false;
		this.stage3CompleteDone = false;
		this.stage3CompletePromise = undefined;
		this.stage3CompletePromiseResolve = undefined;
		this.stage3FloatTween = undefined;
		this.stage3RewardImage = undefined;
		this.stage3MultiplierImage = undefined;
		this.stage3RewardHighlightTween = undefined;
		this.stage3RewardIntroTween = undefined;
		this.stage3RewardAnimating = false;
		this.stage3MultiplierIdleTween = undefined;
		this.stage3MultiplierIntroTween = undefined;
		this.stage3MultiplierAnimating = false;
		for (let i = 1; i <= 4; i++) {
			try {
				const shadow = scene.add.image(0, 0, `stage1_${i}`).setOrigin(0.5, 0.5);
				shadow.setTint(0x000000);
				shadow.setAlpha(0);
				shadow.setVisible(false);
				const glow = scene.add.image(0, 0, `stage1_${i}`).setOrigin(0.5, 0.5);
				glow.setAlpha(0);
				glow.setVisible(false);
				try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? Phaser.BlendModes.ADD); } catch {}
				const img = scene.add.image(0, 0, `stage1_${i}`).setOrigin(0.5, 0.5);
				img.setAlpha(1);
				img.setVisible(false);
				this.stage1Shadows.push(shadow);
				this.stage1Glows.push(glow);
				this.stage1Indicators.push(img);
				this.stage1Container.add([shadow, glow, img]);
			} catch {}
		}
		try {
			const createStage1Complete = () => {
				try {
					if (!this.scene || !this.stage1Container || this.stage1CompleteImage) return;
					if (!ensureSpineFactory(scene, '[GaugeMeter] create stage1_5')) return;
					if (!scene.cache.json.has('stage1_5')) return;
					const spine = (scene.add as any).spine(0, 0, 'stage1_5', 'stage1_5-atlas');
					try { spine.updateSize?.(); } catch {}
					try { spine.setOrigin(0.5, 0.5); } catch {}
					try { spine.setVisible(false); } catch {}
					try { spine.setAlpha(0); } catch {}
					this.stage1CompleteImage = spine;
					this.stage1Container.add(spine);
				} catch {}
			};
			createStage1Complete();
			if (!this.stage1CompleteImage) {
				scene.time.delayedCall(300, createStage1Complete);
			}
		} catch {}
		try {
			const reward = scene.add.image(0, 0, 'win-10-free-spins').setOrigin(0.5, 0.5);
			reward.setVisible(false);
			reward.setAlpha(0);
			this.stage1RewardImage = reward;
			this.stage1Container.add(reward);
		} catch {}
		try {
			const mult = scene.add.image(0, 0, '2x_multiplier').setOrigin(0.5, 0.5);
			mult.setVisible(false);
			mult.setAlpha(0);
			this.stage1MultiplierImage = mult;
			this.stage1Container.add(mult);
		} catch {}

		this.stage2Container = scene.add.container(0, 0);
		this.stage2Shadows = [];
		this.stage2Glows = [];
		this.stage2Indicators = [];
		this.stage2CompleteImage = undefined;
		this.stage2CompletePromise = undefined;
		this.stage2CompletePromiseResolve = undefined;
		for (let i = 1; i <= 4; i++) {
			try {
				const shadow = scene.add.image(0, 0, `stage2_${i}`).setOrigin(0.5, 0.5);
				shadow.setTint(0x000000);
				shadow.setAlpha(0);
				shadow.setVisible(false);
				const glow = scene.add.image(0, 0, `stage2_${i}`).setOrigin(0.5, 0.5);
				glow.setAlpha(0);
				glow.setVisible(false);
				try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? Phaser.BlendModes.ADD); } catch {}
				const img = scene.add.image(0, 0, `stage2_${i}`).setOrigin(0.5, 0.5);
				img.setAlpha(1);
				img.setVisible(false);
				this.stage2Shadows.push(shadow);
				this.stage2Glows.push(glow);
				this.stage2Indicators.push(img);
				this.stage2Container.add([shadow, glow, img]);
			} catch {}
		}
		try {
			const createStage2Complete = () => {
				try {
					if (!this.scene || !this.stage2Container || this.stage2CompleteImage) return;
					if (!ensureSpineFactory(scene, '[GaugeMeter] create stage2_5')) return;
					if (!scene.cache.json.has('stage2_5')) return;
					const spine = (scene.add as any).spine(0, 0, 'stage2_5', 'stage2_5-atlas');
					try { spine.updateSize?.(); } catch {}
					try { spine.setOrigin(0.5, 0.5); } catch {}
					try { spine.setVisible(false); } catch {}
					try { spine.setAlpha(0); } catch {}
					this.stage2CompleteImage = spine;
					this.stage2Container.add(spine);
				} catch {}
			};
			createStage2Complete();
			if (!this.stage2CompleteImage) {
				scene.time.delayedCall(300, createStage2Complete);
			}
		} catch {}
		try {
			const reward = scene.add.image(0, 0, 'win-10-free-spins').setOrigin(0.5, 0.5);
			reward.setVisible(false);
			reward.setAlpha(0);
			this.stage2RewardImage = reward;
			this.stage2Container.add(reward);
		} catch {}
		try {
			const mult = scene.add.image(0, 0, '3x_Multiplier_TB').setOrigin(0.5, 0.5);
			mult.setVisible(false);
			mult.setAlpha(0);
			this.stage2MultiplierImage = mult;
			this.stage2Container.add(mult);
		} catch {}

		this.stage3Container = scene.add.container(0, 0);
		this.stage3Shadows = [];
		this.stage3Glows = [];
		this.stage3Indicators = [];
		this.stage3CompleteImage = undefined;
		this.stage3CompletePromise = undefined;
		this.stage3CompletePromiseResolve = undefined;
		for (let i = 1; i <= 4; i++) {
			try {
				const shadow = scene.add.image(0, 0, `stage3_${i}`).setOrigin(0.5, 0.5);
				shadow.setTint(0x000000);
				shadow.setAlpha(0);
				shadow.setVisible(false);
				const glow = scene.add.image(0, 0, `stage3_${i}`).setOrigin(0.5, 0.5);
				glow.setAlpha(0);
				glow.setVisible(false);
				try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? Phaser.BlendModes.ADD); } catch {}
				const img = scene.add.image(0, 0, `stage3_${i}`).setOrigin(0.5, 0.5);
				img.setAlpha(1);
				img.setVisible(false);
				this.stage3Shadows.push(shadow);
				this.stage3Glows.push(glow);
				this.stage3Indicators.push(img);
				this.stage3Container.add([shadow, glow, img]);
			} catch {}
		}
		try {
			const createStage3Complete = () => {
				try {
					if (!this.scene || !this.stage3Container || this.stage3CompleteImage) return;
					if (!ensureSpineFactory(scene, '[GaugeMeter] create stage3_5')) return;
					if (!scene.cache.json.has('stage3_5')) return;
					const spine = (scene.add as any).spine(0, 0, 'stage3_5', 'stage3_5-atlas');
					try { spine.updateSize?.(); } catch {}
					try { spine.setOrigin(0.5, 0.5); } catch {}
					try { spine.setVisible(false); } catch {}
					try { spine.setAlpha(0); } catch {}
					this.stage3CompleteImage = spine;
					this.stage3Container.add(spine);
				} catch {}
			};
			createStage3Complete();
			if (!this.stage3CompleteImage) {
				scene.time.delayedCall(300, createStage3Complete);
			}
		} catch {}
		try {
			const reward = scene.add.image(0, 0, 'win-10-free-spins').setOrigin(0.5, 0.5);
			reward.setVisible(false);
			reward.setAlpha(0);
			this.stage3RewardImage = reward;
			this.stage3Container.add(reward);
		} catch {}
		try {
			const mult = scene.add.image(0, 0, '10x_Multiplier_TB').setOrigin(0.5, 0.5);
			mult.setVisible(false);
			mult.setAlpha(0);
			this.stage3MultiplierImage = mult;
			this.stage3Container.add(mult);
		} catch {}

		try {
			this.level1MeterContainer.add([this.indicator, this.level1, this.stage1Container]);
		} catch {}
		try {
			this.level2MeterContainer.add([this.indicator2, this.level2, this.stage2Container]);
		} catch {}
		try {
			this.level3MeterContainer.add([this.indicator3, this.level3, this.stage3Container]);
		} catch {}
		this.container.add([this.bar, this.level2MeterContainer, this.level3MeterContainer, this.level1MeterContainer]);

		this.refreshLayout();

		try {
			this.resizeHandler = () => {
				try { this.refreshLayout(); } catch {}
			};
			scene.scale.on('resize', this.resizeHandler);
			scene.events.once('shutdown', () => {
				try {
					if (this.resizeHandler) {
						scene.scale.off('resize', this.resizeHandler);
					}
				} catch {}
				this.resizeHandler = undefined;
			});
		} catch {}
	}

	private animateStage3Unlock(index: number): void {
		try {
			if (!this.scene || !this.stage3Container) return;
			const img = this.stage3Indicators[index];
			const shadow = this.stage3Shadows[index];
			const glow = this.stage3Glows[index];
			if (!img || !shadow || !glow) return;

			try { this.refreshLayout(); } catch {}

			const baseScale = (img.scaleX ?? 1) as number;
			const baseX = (img.x ?? 0) as number;
			const baseY = (img.y ?? 0) as number;
			const yOff = Number((this.modifiers as any).stage3UnlockYOffset) || -6;
			const dur = Math.max(80, Number((this.modifiers as any).stage3UnlockDuration) || 220);
			const glowDur = Math.max(80, Number((this.modifiers as any).stage3GlowDuration) || 320);
			const glowTint = Number((this.modifiers as any).stage3GlowTint) || 0xfff6b0;
			const glowAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage3GlowAlpha) || 0.85));
			const glowScale = Math.max(0.5, Number((this.modifiers as any).stage3GlowScale) || 1.45);
			const shadowAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage3ShadowAlpha) || 0.35));

			try {
				this.scene.tweens.killTweensOf([img, shadow, glow]);
			} catch {}

			img.setVisible(true);
			shadow.setVisible(true);
			glow.setVisible(true);

			img.setAlpha(0);
			img.setScale(baseScale * 0.7);
			img.setPosition(baseX, baseY + yOff);

			shadow.setAlpha(0);
			shadow.setScale((shadow.scaleX ?? baseScale) as number);

			glow.setTint(glowTint);
			glow.setAlpha(glowAlpha);
			glow.setScale(baseScale * glowScale);
			glow.setPosition(baseX, baseY);
			try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? 1); } catch {}

			this.scene.tweens.add({
				targets: img,
				alpha: 1,
				scaleX: baseScale,
				scaleY: baseScale,
				y: baseY,
				duration: dur,
				ease: 'Back.easeOut',
				onComplete: () => {
					try {
						this.scene?.tweens?.killTweensOf?.(img);
						const bobAmp = Math.max(2, Math.min(8, Math.abs(yOff) || 4));
						this.scene?.tweens?.add?.({
							targets: img,
							y: baseY - bobAmp,
							duration: 140,
							ease: 'Sine.easeInOut',
							yoyo: true,
							repeat: 5
						});
					} catch {}
					try {
						if (this.indicator3) {
							try {
								if (!this.indicator3.visible) {
									this.indicator3.setVisible(true);
								}
								if ((this.indicator3.alpha ?? 1) <= 0.01) {
									this.indicator3.setAlpha(1);
								}
							} catch {}
							const indBaseY = (this.indicator3.y ?? 0) as number;
							this.scene?.tweens?.killTweensOf?.(this.indicator3);
							this.scene?.tweens?.add?.({
								targets: this.indicator3,
								y: indBaseY - 8,
								duration: 150,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: 5,
								onComplete: () => {
								try { this.indicator3?.setY(indBaseY); } catch {}
							}
							});
						}
					} catch {}
				}
			});
			this.scene.tweens.add({
				targets: shadow,
				alpha: shadowAlpha,
				duration: Math.max(80, Math.floor(dur * 0.75)),
				ease: 'Sine.easeOut'
			});
			this.scene.tweens.add({
				targets: glow,
				alpha: 0,
				scaleX: baseScale * 1.05,
				scaleY: baseScale * 1.05,
				duration: glowDur,
				ease: 'Sine.easeOut',
				onComplete: () => {
					try { glow.setVisible(false); } catch {}
				}
			});
		} catch {}
	}

	private ensureStage2RewardHighlight(): void {
		try {
			if (!this.scene || !this.stage2RewardImage) return;
			if (!this.stage2RewardImage.visible) return;
			const playingFn = (this.stage2RewardHighlightTween as any)?.isPlaying;
			if (this.stage2RewardHighlightTween && typeof playingFn === 'function' && playingFn.call(this.stage2RewardHighlightTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage2RewardImage); } catch {}
			const baseScale = (this.stage2RewardImage.scaleX ?? 1) as number;
			this.stage2RewardHighlightTween = this.scene.tweens.add({
				targets: this.stage2RewardImage,
				alpha: { from: 0.75, to: 1 },
				scaleX: { from: baseScale, to: baseScale * 1.06 },
				scaleY: { from: baseScale, to: baseScale * 1.06 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage2RewardIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage2RewardImage) {
					resolve();
					return;
				}
				this.stage2RewardAnimating = true;
				try { this.stage2RewardHighlightTween?.stop(); } catch {}
				this.stage2RewardHighlightTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage2RewardImage); } catch {}
				const baseScale = (this.stage2RewardImage.scaleX ?? 1) as number;
				const baseX = (this.stage2RewardImage.x ?? 0) as number;
				const baseY = (this.stage2RewardImage.y ?? 0) as number;
				this.stage2RewardImage.setVisible(true);
				this.stage2RewardImage.setAlpha(0);
				this.stage2RewardImage.setScale(baseScale * 0.9);
				this.stage2RewardImage.setPosition(baseX, baseY + 6);
				this.stage2RewardIntroTween = this.scene.tweens.add({
					targets: this.stage2RewardImage,
					alpha: 1,
					scaleX: baseScale,
					scaleY: baseScale,
					y: baseY,
					duration: 320,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage2RewardAnimating = false;
						try { this.ensureStage2RewardHighlight(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage2RewardAnimating = false;
				resolve();
			}
		});
	}

	private ensureStage2MultiplierIdle(): void {
		try {
			if (!this.scene || !this.stage2MultiplierImage) return;
			if (!this.stage2MultiplierImage.visible) return;
			const playingFn = (this.stage2MultiplierIdleTween as any)?.isPlaying;
			if (this.stage2MultiplierIdleTween && typeof playingFn === 'function' && playingFn.call(this.stage2MultiplierIdleTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage2MultiplierImage); } catch {}
			this.stage2MultiplierIdleTween = this.scene.tweens.add({
				targets: this.stage2MultiplierImage,
				alpha: { from: 0.7, to: 1 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage2MultiplierIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage2MultiplierImage) {
					resolve();
					return;
				}
				this.stage2MultiplierAnimating = true;
				try { this.stage2MultiplierIdleTween?.stop(); } catch {}
				this.stage2MultiplierIdleTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage2MultiplierImage); } catch {}
				const baseScale = (this.stage2MultiplierImage.scaleX ?? 1) as number;
				this.stage2MultiplierImage.setVisible(true);
				this.stage2MultiplierImage.setAlpha(0);
				this.stage2MultiplierImage.setAngle(-18);
				this.stage2MultiplierImage.setScale(baseScale * 1.35);
				this.stage2MultiplierImage.setPosition(0, -6);
				try {
					const audio = (window as any)?.audioManager;
					if (audio && typeof audio.playSoundEffect === 'function') {
						audio.playSoundEffect('multi_add_3_TB');
					}
				} catch {}
				this.stage2MultiplierIntroTween = this.scene.tweens.add({
					targets: this.stage2MultiplierImage,
					alpha: 1,
					angle: 0,
					scaleX: baseScale,
					scaleY: baseScale,
					x: 0,
					y: 0,
					duration: 180,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage2MultiplierAnimating = false;
						try { this.ensureStage2MultiplierIdle(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage2MultiplierAnimating = false;
				try { this.ensureStage2MultiplierIdle(); } catch {}
				resolve();
			}
		});
	}

	private ensureStage2FloatTween(): void {
		try {
			if (!this.scene || !this.stage2Container) return;
			const visible = this.stage2Container.visible && this.stage2Progress > 0;
			if (!visible) {
				try { this.stage2FloatTween?.stop(); } catch {}
				this.stage2FloatTween = undefined;
				return;
			}
			const playingFn = (this.stage2FloatTween as any)?.isPlaying;
			if (this.stage2FloatTween && typeof playingFn === 'function' && playingFn.call(this.stage2FloatTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage2Container); } catch {}
			const amp = Number((this.modifiers as any).stage2FloatAmplitude ?? 0) || 0;
			const dur = Math.max(300, Number((this.modifiers as any).stage2FloatDuration ?? 1800) || 1800);
			if (!(isFinite(amp) && Math.abs(amp) > 0.01)) {
				return;
			}
			const baseY = this.stage2Container.y;
			this.stage2FloatTween = this.scene.tweens.add({
				targets: this.stage2Container,
				y: baseY + amp,
				duration: dur,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private updateStage2IndicatorsVisibility(): void {
		try {
			if (this.stage2CompleteDone) {
				for (let i = 0; i < this.stage2Indicators.length; i++) {
					const img = this.stage2Indicators[i];
					if (img) img.setVisible(false);
					const s = this.stage2Shadows[i];
					if (s) { s.setVisible(false); s.setAlpha(0); }
					const g = this.stage2Glows[i];
					if (g) { g.setVisible(false); g.setAlpha(0); }
				}
				if (this.stage2CompleteImage) {
					this.stage2CompleteImage.setVisible(true);
					if ((this.stage2CompleteImage.alpha ?? 0) <= 0.01) {
						this.stage2CompleteImage.setAlpha(1);
					}
				}
				if (this.stage2RewardImage) {
					this.stage2RewardImage.setVisible(true);
					if (!this.stage2RewardAnimating && (this.stage2RewardImage.alpha ?? 0) <= 0.01) {
						this.stage2RewardImage.setAlpha(1);
					}
					try { if (!this.stage2RewardAnimating) this.ensureStage2RewardHighlight(); } catch {}
				}
				if (this.stage2MultiplierImage) {
					this.stage2MultiplierImage.setVisible(true);
					if (!this.stage2MultiplierAnimating && (this.stage2MultiplierImage.alpha ?? 0) <= 0.01) {
						this.stage2MultiplierImage.setAlpha(1);
					}
					try { if (!this.stage2MultiplierAnimating) this.ensureStage2MultiplierIdle(); } catch {}
				}
				if (this.stage2Container) {
					this.stage2Container.setVisible(true);
				}
				this.ensureStage2FloatTween();
				try { this.updateLevel2MeterFade(); } catch {}
				return;
			}
			for (let i = 0; i < this.stage2Indicators.length; i++) {
				const img = this.stage2Indicators[i];
				if (!img) continue;
				const v = this.stage2Progress >= (i + 1);
				img.setVisible(v);
				const s = this.stage2Shadows[i];
				if (s) {
					s.setVisible(v);
				}
				const g = this.stage2Glows[i];
				if (g && !v) {
					g.setVisible(false);
					g.setAlpha(0);
				}
			}
			if (this.stage2Container) {
				this.stage2Container.setVisible(this.stage2Progress > 0);
			}
			try {
				if (this.stage2RewardImage) {
					this.stage2RewardImage.setVisible(false);
					this.stage2RewardImage.setAlpha(0);
				}
				try { this.stage2RewardHighlightTween?.stop(); } catch {}
				this.stage2RewardHighlightTween = undefined;
				this.stage2RewardIntroTween = undefined;
				this.stage2RewardAnimating = false;
			} catch {}
			try {
				if (this.stage2MultiplierImage) {
					this.stage2MultiplierImage.setVisible(false);
					this.stage2MultiplierImage.setAlpha(0);
				}
				try { this.stage2MultiplierIdleTween?.stop(); } catch {}
				this.stage2MultiplierIdleTween = undefined;
				this.stage2MultiplierIntroTween = undefined;
				this.stage2MultiplierAnimating = false;
			} catch {}
			this.ensureStage2FloatTween();
			try { this.updateLevel2MeterFade(); } catch {}
		} catch {}
	}

	private animateStage2Complete(): void {
		try {
			if (!this.scene || !this.stage2Container || !this.stage2CompleteImage) return;
			if (this.stage2CompleteDone || this.stage2CompleteAnimating) return;
			if ((this.stage2Progress || 0) < 4) return;
			this.stage2CompleteAnimating = true;
			try { this.refreshLayout(); } catch {}
			try { this.stage2FloatTween?.stop(); } catch {}
			this.stage2FloatTween = undefined;

			const centerX = 0;
			const centerY = 0;
			const flashDur = 80;
			const flashRepeats = 5;
			const combineDur = 260;
			let combineDone = 0;
			const total = Math.min(4, this.stage2Indicators.length);

			try {
				for (let i = 0; i < total; i++) {
					const img = this.stage2Indicators[i];
					const sh = this.stage2Shadows[i];
					const gl = this.stage2Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try { this.scene?.tweens?.killTweensOf?.([img, sh, gl]); } catch {}
					try {
						if (img) {
							img.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: img,
								alpha: 0.2,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
					try {
						if (sh) {
							sh.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: sh,
								alpha: 0.05,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
				}
			} catch {}

			this.scene.time.delayedCall(flashDur * (flashRepeats + 1), () => {
				try {
					const targetScale = (this.stage2CompleteImage?.scaleX ?? 1) as number;
					this.stage2CompleteImage?.setVisible(false);
					this.stage2CompleteImage?.setAlpha(0);
					this.stage2CompleteImage?.setScale(targetScale);
					this.stage2CompleteImage?.setPosition(centerX, centerY);
				} catch {}

				const finish = () => {
					try {
						const targetScale = (this.stage2CompleteImage?.scaleX ?? 1) as number;
						if (this.stage2CompleteImage) {
							this.stage2CompleteImage.setVisible(true);
							this.stage2CompleteImage.setAlpha(0);
							this.stage2CompleteImage.setScale(targetScale * 0.6);
							this.stage2CompleteImage.setPosition(centerX, centerY);
							this.scene?.tweens?.killTweensOf?.(this.stage2CompleteImage);
							this.scene?.tweens?.add?.({
								targets: this.stage2CompleteImage,
								alpha: 1,
								scaleX: targetScale,
								scaleY: targetScale,
								duration: 320,
								ease: 'Back.easeOut',
								onComplete: () => {
								this.stage2CompleteAnimating = false;
								this.stage2CompleteDone = true;
								try { this.updateStage2IndicatorsVisibility(); } catch {}
								try { this.ensureStage2FloatTween(); } catch {}
								try {
									const p1 = this.playStage2RewardIntro();
									const p2 = this.playStage2MultiplierIntro();
									Promise.all([Promise.resolve(p1), Promise.resolve(p2)]).then(() => {
										try { this.resolveStage2CompletePromise(); } catch {}
									}).catch(() => {
										try { this.resolveStage2CompletePromise(); } catch {}
									});
								} catch {
									try { this.resolveStage2CompletePromise(); } catch {}
								}
							}
							});
						}
					} catch {
						this.stage2CompleteAnimating = false;
						this.stage2CompleteDone = true;
						try { this.updateStage2IndicatorsVisibility(); } catch {}
						try { this.ensureStage2FloatTween(); } catch {}
						try { this.resolveStage2CompletePromise(); } catch {}
					}
				};

				for (let i = 0; i < total; i++) {
					const img = this.stage2Indicators[i];
					const sh = this.stage2Shadows[i];
					const gl = this.stage2Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try {
						this.scene?.tweens?.killTweensOf?.([img, sh]);
					} catch {}
					const onOneComplete = () => {
						combineDone++;
						if (combineDone >= total) {
							finish();
						}
					};
					try {
						if (img) {
							this.scene?.tweens?.add?.({
								targets: img,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (img.scaleX ?? 1) * 0.15,
								scaleY: (img.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { img.setVisible(false); img.setAlpha(1); } catch {}
								onOneComplete();
							}
							});
						} else {
							onOneComplete();
						}
					} catch {
						onOneComplete();
					}
					try {
						if (sh) {
							this.scene?.tweens?.add?.({
								targets: sh,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (sh.scaleX ?? 1) * 0.15,
								scaleY: (sh.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { sh.setVisible(false); sh.setAlpha(0); } catch {}
							}
							});
						}
					} catch {}
				}
			});
		} catch {}
	}

	private updateLevel2MeterFade(): void {
		try {
			if (!this.scene || !this.level2) return;
			const containerVisible = !!this.container?.visible;
			const shouldFade = containerVisible && (this.stage2Progress || 0) > 0;
			if (shouldFade === this.level2MeterFaded) {
				return;
			}
			this.level2MeterFaded = shouldFade;
			const targetAlpha = shouldFade ? 0 : 1;
			try { this.scene.tweens.killTweensOf(this.level2); } catch {}
			try {
				this.scene.tweens.add({
					targets: this.level2,
					alpha: targetAlpha,
					duration: 260,
					ease: 'Sine.easeOut'
				});
			} catch {
				try { this.level2.setAlpha(targetAlpha); } catch {}
			}
		} catch {}
	}

	private ensureStage1MultiplierIdle(): void {
		try {
			if (!this.scene || !this.stage1MultiplierImage) return;
			if (!this.stage1MultiplierImage.visible) return;
			const playingFn = (this.stage1MultiplierIdleTween as any)?.isPlaying;
			if (this.stage1MultiplierIdleTween && typeof playingFn === 'function' && playingFn.call(this.stage1MultiplierIdleTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage1MultiplierImage); } catch {}
			this.stage1MultiplierIdleTween = this.scene.tweens.add({
				targets: this.stage1MultiplierImage,
				alpha: { from: 0.7, to: 1 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage1MultiplierIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage1MultiplierImage) {
					resolve();
					return;
				}
				this.stage1MultiplierAnimating = true;
				try { this.stage1MultiplierIdleTween?.stop(); } catch {}
				this.stage1MultiplierIdleTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage1MultiplierImage); } catch {}
				const baseScale = (this.stage1MultiplierImage.scaleX ?? 1) as number;
				this.stage1MultiplierImage.setVisible(true);
				this.stage1MultiplierImage.setAlpha(0);
				this.stage1MultiplierImage.setAngle(-18);
				this.stage1MultiplierImage.setScale(baseScale * 1.35);
				this.stage1MultiplierImage.setPosition(0, -6);
				try {
					const audio = (window as any)?.audioManager;
					if (audio && typeof audio.playSoundEffect === 'function') {
						audio.playSoundEffect('multi_add_2_TB');
					}
				} catch {}
				this.stage1MultiplierIntroTween = this.scene.tweens.add({
					targets: this.stage1MultiplierImage,
					alpha: 1,
					angle: 0,
					scaleX: baseScale,
					scaleY: baseScale,
					x: 0,
					y: 0,
					duration: 180,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage1MultiplierAnimating = false;
						try { this.ensureStage1MultiplierIdle(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage1MultiplierAnimating = false;
				try { this.ensureStage1MultiplierIdle(); } catch {}
				resolve();
			}
		});
	}

	private animateStage1Complete(): void {
		try {
			if (!this.scene || !this.stage1Container || !this.stage1CompleteImage) return;
			if (this.stage1CompleteDone || this.stage1CompleteAnimating) return;
			if ((this.stage1Progress || 0) < 4) return;
			this.stage1CompleteAnimating = true;
			try { this.refreshLayout(); } catch {}
			try { this.stage1FloatTween?.stop(); } catch {}
			this.stage1FloatTween = undefined;

			const centerX = 0;
			const centerY = 0;
			const flashDur = 80;
			const flashRepeats = 5;
			const combineDur = 260;
			let combineDone = 0;
			const total = Math.min(4, this.stage1Indicators.length);

			try {
				for (let i = 0; i < total; i++) {
					const img = this.stage1Indicators[i];
					const sh = this.stage1Shadows[i];
					const gl = this.stage1Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try { this.scene?.tweens?.killTweensOf?.([img, sh, gl]); } catch {}
					try {
						if (img) {
							img.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: img,
								alpha: 0.2,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
					try {
						if (sh) {
							sh.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: sh,
								alpha: 0.05,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
				}
			} catch {}

			this.scene.time.delayedCall(flashDur * (flashRepeats + 1), () => {
				try {
					const targetScale = (this.stage1CompleteImage?.scaleX ?? 1) as number;
					this.stage1CompleteImage?.setVisible(false);
					this.stage1CompleteImage?.setAlpha(0);
					this.stage1CompleteImage?.setScale(targetScale);
					this.stage1CompleteImage?.setPosition(centerX, centerY);
				} catch {}

				const finish = () => {
					try {
						const targetScale = (this.stage1CompleteImage?.scaleX ?? 1) as number;
						if (this.stage1CompleteImage) {
							this.stage1CompleteImage.setVisible(true);
							this.stage1CompleteImage.setAlpha(0);
							this.stage1CompleteImage.setScale(targetScale * 0.6);
							this.stage1CompleteImage.setPosition(centerX, centerY);
							this.scene?.tweens?.killTweensOf?.(this.stage1CompleteImage);
							this.scene?.tweens?.add?.({
								targets: this.stage1CompleteImage,
								alpha: 1,
								scaleX: targetScale,
								scaleY: targetScale,
								duration: 320,
								ease: 'Back.easeOut',
								onComplete: () => {
								this.stage1CompleteAnimating = false;
								this.stage1CompleteDone = true;
								try { this.scene?.events?.emit?.('bonusStage1Complete'); } catch {}
								try { this.updateStage1IndicatorsVisibility(); } catch {}
								try { this.ensureStage1FloatTween(); } catch {}
								try {
									const p1 = this.playStage1RewardIntro();
									const p2 = this.playStage1MultiplierIntro();
									Promise.all([Promise.resolve(p1), Promise.resolve(p2)]).then(() => {
										try { this.resolveStage1CompletePromise(); } catch {}
									}).catch(() => {
										try { this.resolveStage1CompletePromise(); } catch {}
									});
								} catch {
									try { this.resolveStage1CompletePromise(); } catch {}
								}
							}
							});
						}
					} catch {
						this.stage1CompleteAnimating = false;
						this.stage1CompleteDone = true;
						try { this.updateStage1IndicatorsVisibility(); } catch {}
						try { this.ensureStage1FloatTween(); } catch {}
						try { this.resolveStage1CompletePromise(); } catch {}
					}
				};

				for (let i = 0; i < total; i++) {
					const img = this.stage1Indicators[i];
					const sh = this.stage1Shadows[i];
					const gl = this.stage1Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try {
						this.scene?.tweens?.killTweensOf?.([img, sh]);
					} catch {}
					const onOneComplete = () => {
						combineDone++;
						if (combineDone >= total) {
							finish();
						}
					};
					try {
						if (img) {
							this.scene?.tweens?.add?.({
								targets: img,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (img.scaleX ?? 1) * 0.15,
								scaleY: (img.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { img.setVisible(false); img.setAlpha(1); } catch {}
								onOneComplete();
							}
							});
						} else {
							onOneComplete();
						}
					} catch {
						onOneComplete();
					}
					try {
						if (sh) {
							this.scene?.tweens?.add?.({
								targets: sh,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (sh.scaleX ?? 1) * 0.15,
								scaleY: (sh.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { sh.setVisible(false); sh.setAlpha(0); } catch {}
							}
							});
						}
					} catch {}
				}
			});
		} catch {}
	}

	setVisible(visible: boolean): void {
		try { this.container?.setVisible(visible); } catch {}
		if (!visible) {
			try { this.resolveStage1CompletePromise(); } catch {}
			try { this.resolveStage2CompletePromise(); } catch {}
			try { this.resolveStage3CompletePromise(); } catch {}
			this.indicatorIntroPlayed = false;
			this.indicatorIntroPromise = undefined;
			this.stage1Progress = 0;
			this.level1MeterFaded = false;
			this.stage1CompleteAnimating = false;
			this.stage1CompleteDone = false;
			this.stage2Progress = 0;
			this.level2MeterFaded = false;
			this.stage2CompleteAnimating = false;
			this.stage2CompleteDone = false;
			this.stage3Progress = 0;
			this.level3MeterFaded = false;
			this.stage3CompleteAnimating = false;
			this.stage3CompleteDone = false;
			this.stage1RewardAnimating = false;
			this.stage1MultiplierAnimating = false;
			this.stage3RewardAnimating = false;
			this.stage3MultiplierAnimating = false;
			this.stage1CompletePromise = undefined;
			this.stage1CompletePromiseResolve = undefined;
			this.stage2CompletePromise = undefined;
			this.stage2CompletePromiseResolve = undefined;
			this.stage3CompletePromise = undefined;
			this.stage3CompletePromiseResolve = undefined;
			try {
				if (this.scene && this.indicator) {
					this.scene.tweens.killTweensOf(this.indicator);
				}
			} catch {}
			try {
				if (this.scene && this.indicator2) {
					this.scene.tweens.killTweensOf(this.indicator2);
				}
			} catch {}
			try {
				if (this.scene && this.indicator3) {
					this.scene.tweens.killTweensOf(this.indicator3);
				}
			} catch {}
			try {
				if (this.scene && this.level1) {
					this.scene.tweens.killTweensOf(this.level1);
					this.level1.setAlpha(1);
				}
			} catch {}
			try {
				if (this.scene && this.level2) {
					this.scene.tweens.killTweensOf(this.level2);
					this.level2.setAlpha(1);
				}
			} catch {}
			try {
				if (this.scene && this.level3) {
					this.scene.tweens.killTweensOf(this.level3);
					this.level3.setAlpha(1);
				}
			} catch {}
			try {
				this.indicator?.setVisible(false);
				this.indicator?.setAlpha(0);
			} catch {}
			try {
				this.indicator2?.setVisible(false);
				this.indicator2?.setAlpha(0);
			} catch {}
			try {
				this.indicator3?.setVisible(false);
				this.indicator3?.setAlpha(0);
			} catch {}
			try {
				if (this.scene && this.stage1Container) {
					this.scene.tweens.killTweensOf(this.stage1Container);
				}
				this.stage1FloatTween?.stop();
				this.stage1FloatTween = undefined;
				this.stage1Container?.setVisible(false);
				for (const img of this.stage1Indicators) {
					try { img.setVisible(false); } catch {}
				}
				for (const s of this.stage1Shadows) {
					try { s.setVisible(false); s.setAlpha(0); } catch {}
				}
				for (const g of this.stage1Glows) {
					try { g.setVisible(false); g.setAlpha(0); } catch {}
				}
				try {
					if (this.stage1CompleteImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage1CompleteImage); } catch {}
						this.stage1CompleteImage.setVisible(false);
						this.stage1CompleteImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage1RewardImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage1RewardImage); } catch {}
						try { this.stage1RewardHighlightTween?.stop(); } catch {}
						this.stage1RewardHighlightTween = undefined;
						this.stage1RewardIntroTween = undefined;
						this.stage1RewardImage.setVisible(false);
						this.stage1RewardImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage1MultiplierImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage1MultiplierImage); } catch {}
						try { this.stage1MultiplierIdleTween?.stop(); } catch {}
						this.stage1MultiplierIdleTween = undefined;
						this.stage1MultiplierIntroTween = undefined;
						this.stage1MultiplierImage.setVisible(false);
						this.stage1MultiplierImage.setAlpha(0);
					}
				} catch {}
			} catch {}
			try {
				if (this.scene && this.stage2Container) {
					this.scene.tweens.killTweensOf(this.stage2Container);
				}
				this.stage2FloatTween?.stop();
				this.stage2FloatTween = undefined;
				this.stage2Container?.setVisible(false);
				for (const img of this.stage2Indicators) {
					try { img.setVisible(false); } catch {}
				}
				for (const s of this.stage2Shadows) {
					try { s.setVisible(false); s.setAlpha(0); } catch {}
				}
				for (const g of this.stage2Glows) {
					try { g.setVisible(false); g.setAlpha(0); } catch {}
				}
				try {
					if (this.stage2CompleteImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage2CompleteImage); } catch {}
						this.stage2CompleteImage.setVisible(false);
						this.stage2CompleteImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage2RewardImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage2RewardImage); } catch {}
						try { this.stage2RewardHighlightTween?.stop(); } catch {}
						this.stage2RewardHighlightTween = undefined;
						this.stage2RewardIntroTween = undefined;
						this.stage2RewardImage.setVisible(false);
						this.stage2RewardImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage2MultiplierImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage2MultiplierImage); } catch {}
						try { this.stage2MultiplierIdleTween?.stop(); } catch {}
						this.stage2MultiplierIdleTween = undefined;
						this.stage2MultiplierIntroTween = undefined;
						this.stage2MultiplierImage.setVisible(false);
						this.stage2MultiplierImage.setAlpha(0);
					}
				} catch {}
			} catch {}
			try {
				if (this.scene && this.stage3Container) {
					this.scene.tweens.killTweensOf(this.stage3Container);
				}
				this.stage3FloatTween?.stop();
				this.stage3FloatTween = undefined;
				this.stage3Container?.setVisible(false);
				for (const img of this.stage3Indicators) {
					try { img.setVisible(false); } catch {}
				}
				for (const s of this.stage3Shadows) {
					try { s.setVisible(false); s.setAlpha(0); } catch {}
				}
				for (const g of this.stage3Glows) {
					try { g.setVisible(false); g.setAlpha(0); } catch {}
				}
				try {
					if (this.stage3CompleteImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage3CompleteImage); } catch {}
						this.stage3CompleteImage.setVisible(false);
						this.stage3CompleteImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage3RewardImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage3RewardImage); } catch {}
						try { this.stage3RewardHighlightTween?.stop(); } catch {}
						this.stage3RewardHighlightTween = undefined;
						this.stage3RewardIntroTween = undefined;
						this.stage3RewardImage.setVisible(false);
						this.stage3RewardImage.setAlpha(0);
					}
				} catch {}
				try {
					if (this.stage3MultiplierImage) {
						try { this.scene?.tweens?.killTweensOf?.(this.stage3MultiplierImage); } catch {}
						try { this.stage3MultiplierIdleTween?.stop(); } catch {}
						this.stage3MultiplierIdleTween = undefined;
						this.stage3MultiplierIntroTween = undefined;
						this.stage3MultiplierImage.setVisible(false);
						this.stage3MultiplierImage.setAlpha(0);
					}
				} catch {}
			} catch {}
		}
		try {
			if (visible) {
				this.updateLevel1MeterFade();
				this.updateLevel2MeterFade();
				this.updateLevel3MeterFade();
			}
		} catch {}
	}

	getLevel1WorldPosition(): { x: number; y: number } | undefined {
		try {
			if (!this.level1) {
				return undefined;
			}
			const b = this.level1.getBounds();
			return { x: b.centerX, y: b.centerY };
		} catch {
			return undefined;
		}
	}

	getLevel2WorldPosition(): { x: number; y: number } | undefined {
		try {
			if (!this.level2) {
				return undefined;
			}
			const b = this.level2.getBounds();
			return { x: b.centerX, y: b.centerY };
		} catch {
			return undefined;
		}
	}

	getLevel3WorldPosition(): { x: number; y: number } | undefined {
		try {
			if (!this.level3) {
				return undefined;
			}
			const b = this.level3.getBounds();
			return { x: b.centerX, y: b.centerY };
		} catch {
			return undefined;
		}
	}

	getActiveLevelWorldPosition(): { x: number; y: number } | undefined {
		try {
			if (this.stage2CompleteDone) {
				return this.getLevel3WorldPosition();
			}
		} catch {}
		try {
			if (this.stage1CompleteDone) {
				return this.getLevel2WorldPosition();
			}
		} catch {}
		return this.getLevel1WorldPosition();
	}

	incrementStage1Progress(): Promise<void> {
		const prev = this.stage1Progress || 0;
		this.stage1Progress = Math.min(4, Math.max(0, prev + 1));
		this.updateStage1IndicatorsVisibility();
		try { this.updateLevel1MeterFade(); } catch {}
		try {
			if (this.stage1Progress > prev) {
				for (let i = prev; i < this.stage1Progress; i++) {
					this.animateStage1Unlock(i);
				}
			}
		} catch {}
		let completionPromise: Promise<void> | undefined;
		try {
			if (prev < 4 && this.stage1Progress >= 4 && !this.stage1CompleteDone) {
				completionPromise = this.beginStage1CompleteSequence();
			}
		} catch {}
		return completionPromise || Promise.resolve();
	}

	incrementActiveStageProgress(): Promise<void> {
		try {
			if (this.stage2CompleteDone) {
				return this.incrementStage3Progress();
			}
		} catch {}
		try {
			if (this.stage1CompleteDone) {
				return this.incrementStage2Progress();
			}
		} catch {}
		return this.incrementStage1Progress();
	}

	incrementStage3Progress(): Promise<void> {
		const prev = this.stage3Progress || 0;
		this.stage3Progress = Math.min(4, Math.max(0, prev + 1));
		this.updateStage3IndicatorsVisibility();
		try { this.updateLevel3MeterFade(); } catch {}
		try {
			if (this.stage3Progress > prev) {
				for (let i = prev; i < this.stage3Progress; i++) {
					this.animateStage3Unlock(i);
				}
			}
		} catch {}
		let completionPromise: Promise<void> | undefined;
		try {
			if (prev < 4 && this.stage3Progress >= 4 && !this.stage3CompleteDone) {
				completionPromise = this.beginStage3CompleteSequence();
			}
		} catch {}
		return completionPromise || Promise.resolve();
	}

	private beginStage3CompleteSequence(): Promise<void> {
		try {
			if (this.stage3CompleteDone) {
				return Promise.resolve();
			}
			if (this.stage3CompletePromise) {
				return this.stage3CompletePromise;
			}
			try { this.scene?.events?.emit?.('bonusStage3Complete'); } catch {}
			this.stage3CompletePromise = new Promise<void>((resolve) => {
				this.stage3CompletePromiseResolve = resolve;
			});
			const delay = 520;
			this.scene?.time?.delayedCall?.(delay, () => {
				try {
					this.animateStage3Complete();
					if (!this.stage3CompleteAnimating && !this.stage3CompleteDone) {
						this.resolveStage3CompletePromise();
					}
				} catch {
					this.resolveStage3CompletePromise();
				}
			});
			return this.stage3CompletePromise;
		} catch {
			return Promise.resolve();
		}
	}

	incrementStage2Progress(): Promise<void> {
		const prev = this.stage2Progress || 0;
		this.stage2Progress = Math.min(4, Math.max(0, prev + 1));
		this.updateStage2IndicatorsVisibility();
		try { this.updateLevel2MeterFade(); } catch {}
		try {
			if (this.stage2Progress > prev) {
				for (let i = prev; i < this.stage2Progress; i++) {
					this.animateStage2Unlock(i);
				}
			}
		} catch {}
		let completionPromise: Promise<void> | undefined;
		try {
			if (prev < 4 && this.stage2Progress >= 4 && !this.stage2CompleteDone) {
				completionPromise = this.beginStage2CompleteSequence();
			}
		} catch {}
		return completionPromise || Promise.resolve();
	}

	private beginStage2CompleteSequence(): Promise<void> {
		try {
			if (this.stage2CompleteDone) {
				return Promise.resolve();
			}
			if (this.stage2CompletePromise) {
				return this.stage2CompletePromise;
			}
			try { this.scene?.events?.emit?.('bonusStage2Complete'); } catch {}
			this.stage2CompletePromise = new Promise<void>((resolve) => {
				this.stage2CompletePromiseResolve = resolve;
			});
			const delay = 520;
			this.scene?.time?.delayedCall?.(delay, () => {
				try {
					this.animateStage2Complete();
					if (!this.stage2CompleteAnimating && !this.stage2CompleteDone) {
						this.resolveStage2CompletePromise();
					}
				} catch {
					this.resolveStage2CompletePromise();
				}
			});
			return this.stage2CompletePromise;
		} catch {
			return Promise.resolve();
		}
	}

	private beginStage1CompleteSequence(): Promise<void> {
		try {
			if (this.stage1CompleteDone) {
				return Promise.resolve();
			}
			if (this.stage1CompletePromise) {
				return this.stage1CompletePromise;
			}
			try { this.scene?.events?.emit?.('bonusStage1Complete'); } catch {}
			this.stage1CompletePromise = new Promise<void>((resolve) => {
				this.stage1CompletePromiseResolve = resolve;
			});
			const delay = 520;
			this.scene?.time?.delayedCall?.(delay, () => {
				try {
					this.animateStage1Complete();
					if (!this.stage1CompleteAnimating && !this.stage1CompleteDone) {
						this.resolveStage1CompletePromise();
					}
				} catch {
					this.resolveStage1CompletePromise();
				}
			});
			return this.stage1CompletePromise;
		} catch {
			return Promise.resolve();
		}
	}

	private resolveStage1CompletePromise(): void {
		try {
			const r = this.stage1CompletePromiseResolve;
			this.stage1CompletePromiseResolve = undefined;
			this.stage1CompletePromise = undefined;
			try { r?.(); } catch {}
		} catch {}
	}

	private resolveStage2CompletePromise(): void {
		try {
			const r = this.stage2CompletePromiseResolve;
			this.stage2CompletePromiseResolve = undefined;
			this.stage2CompletePromise = undefined;
			try { r?.(); } catch {}
		} catch {}
	}

	private resolveStage3CompletePromise(): void {
		try {
			const r = this.stage3CompletePromiseResolve;
			this.stage3CompletePromiseResolve = undefined;
			this.stage3CompletePromise = undefined;
			try { r?.(); } catch {}
		} catch {}
	}

	private ensureStage3RewardHighlight(): void {
		try {
			if (!this.scene || !this.stage3RewardImage) return;
			if (!this.stage3RewardImage.visible) return;
			const playingFn = (this.stage3RewardHighlightTween as any)?.isPlaying;
			if (this.stage3RewardHighlightTween && typeof playingFn === 'function' && playingFn.call(this.stage3RewardHighlightTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage3RewardImage); } catch {}
			const baseScale = (this.stage3RewardImage.scaleX ?? 1) as number;
			this.stage3RewardHighlightTween = this.scene.tweens.add({
				targets: this.stage3RewardImage,
				alpha: { from: 0.75, to: 1 },
				scaleX: { from: baseScale, to: baseScale * 1.06 },
				scaleY: { from: baseScale, to: baseScale * 1.06 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage3RewardIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage3RewardImage) {
					resolve();
					return;
				}
				this.stage3RewardAnimating = true;
				try { this.stage3RewardHighlightTween?.stop(); } catch {}
				this.stage3RewardHighlightTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage3RewardImage); } catch {}
				const baseScale = (this.stage3RewardImage.scaleX ?? 1) as number;
				const baseX = (this.stage3RewardImage.x ?? 0) as number;
				const baseY = (this.stage3RewardImage.y ?? 0) as number;
				this.stage3RewardImage.setVisible(true);
				this.stage3RewardImage.setAlpha(0);
				this.stage3RewardImage.setScale(baseScale * 0.9);
				this.stage3RewardImage.setPosition(baseX, baseY + 6);
				this.stage3RewardIntroTween = this.scene.tweens.add({
					targets: this.stage3RewardImage,
					alpha: 1,
					scaleX: baseScale,
					scaleY: baseScale,
					y: baseY,
					duration: 320,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage3RewardAnimating = false;
						try { this.ensureStage3RewardHighlight(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage3RewardAnimating = false;
				resolve();
			}
		});
	}

	private ensureStage3MultiplierIdle(): void {
		try {
			if (!this.scene || !this.stage3MultiplierImage) return;
			if (!this.stage3MultiplierImage.visible) return;
			const playingFn = (this.stage3MultiplierIdleTween as any)?.isPlaying;
			if (this.stage3MultiplierIdleTween && typeof playingFn === 'function' && playingFn.call(this.stage3MultiplierIdleTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage3MultiplierImage); } catch {}
			this.stage3MultiplierIdleTween = this.scene.tweens.add({
				targets: this.stage3MultiplierImage,
				alpha: { from: 0.7, to: 1 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage3MultiplierIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage3MultiplierImage) {
					resolve();
					return;
				}
				this.stage3MultiplierAnimating = true;
				try { this.stage3MultiplierIdleTween?.stop(); } catch {}
				this.stage3MultiplierIdleTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage3MultiplierImage); } catch {}
				const baseScale = (this.stage3MultiplierImage.scaleX ?? 1) as number;
				this.stage3MultiplierImage.setVisible(true);
				this.stage3MultiplierImage.setAlpha(0);
				this.stage3MultiplierImage.setAngle(-18);
				this.stage3MultiplierImage.setScale(baseScale * 1.35);
				this.stage3MultiplierImage.setPosition(0, -6);
				try {
					const audio = (window as any)?.audioManager;
					if (audio && typeof audio.playSoundEffect === 'function') {
						audio.playSoundEffect('multi_add_4_TB');
					}
				} catch {}
				this.stage3MultiplierIntroTween = this.scene.tweens.add({
					targets: this.stage3MultiplierImage,
					alpha: 1,
					angle: 0,
					scaleX: baseScale,
					scaleY: baseScale,
					x: 0,
					y: 0,
					duration: 180,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage3MultiplierAnimating = false;
						try { this.ensureStage3MultiplierIdle(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage3MultiplierAnimating = false;
				try { this.ensureStage3MultiplierIdle(); } catch {}
				resolve();
			}
		});
	}

	private ensureStage3FloatTween(): void {
		try {
			if (!this.scene || !this.stage3Container) return;
			const visible = this.stage3Container.visible && this.stage3Progress > 0;
			if (!visible) {
				try { this.stage3FloatTween?.stop(); } catch {}
				this.stage3FloatTween = undefined;
				return;
			}
			const playingFn = (this.stage3FloatTween as any)?.isPlaying;
			if (this.stage3FloatTween && typeof playingFn === 'function' && playingFn.call(this.stage3FloatTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage3Container); } catch {}
			const amp = Number((this.modifiers as any).stage3FloatAmplitude ?? 0) || 0;
			const dur = Math.max(300, Number((this.modifiers as any).stage3FloatDuration ?? 1800) || 1800);
			if (!(isFinite(amp) && Math.abs(amp) > 0.01)) {
				return;
			}
			const baseY = this.stage3Container.y;
			this.stage3FloatTween = this.scene.tweens.add({
				targets: this.stage3Container,
				y: baseY + amp,
				duration: dur,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private updateStage3IndicatorsVisibility(): void {
		try {
			if (this.stage3CompleteDone) {
				for (let i = 0; i < this.stage3Indicators.length; i++) {
					const img = this.stage3Indicators[i];
					if (img) img.setVisible(false);
					const s = this.stage3Shadows[i];
					if (s) { s.setVisible(false); s.setAlpha(0); }
					const g = this.stage3Glows[i];
					if (g) { g.setVisible(false); g.setAlpha(0); }
				}
				if (this.stage3CompleteImage) {
					this.stage3CompleteImage.setVisible(true);
					if ((this.stage3CompleteImage.alpha ?? 0) <= 0.01) {
						this.stage3CompleteImage.setAlpha(1);
					}
				}
				if (this.stage3RewardImage) {
					this.stage3RewardImage.setVisible(true);
					if (!this.stage3RewardAnimating && (this.stage3RewardImage.alpha ?? 0) <= 0.01) {
						this.stage3RewardImage.setAlpha(1);
					}
					try { if (!this.stage3RewardAnimating) this.ensureStage3RewardHighlight(); } catch {}
				}
				if (this.stage3MultiplierImage) {
					this.stage3MultiplierImage.setVisible(true);
					if (!this.stage3MultiplierAnimating && (this.stage3MultiplierImage.alpha ?? 0) <= 0.01) {
						this.stage3MultiplierImage.setAlpha(1);
					}
					try { if (!this.stage3MultiplierAnimating) this.ensureStage3MultiplierIdle(); } catch {}
				}
				if (this.stage3Container) {
					this.stage3Container.setVisible(true);
				}
				this.ensureStage3FloatTween();
				try { this.updateLevel3MeterFade(); } catch {}
				return;
			}
			for (let i = 0; i < this.stage3Indicators.length; i++) {
				const img = this.stage3Indicators[i];
				if (!img) continue;
				const v = this.stage3Progress >= (i + 1);
				img.setVisible(v);
				const s = this.stage3Shadows[i];
				if (s) {
					s.setVisible(v);
				}
				const g = this.stage3Glows[i];
				if (g && !v) {
					g.setVisible(false);
					g.setAlpha(0);
				}
			}
			if (this.stage3Container) {
				this.stage3Container.setVisible(this.stage3Progress > 0);
			}
			try {
				if (this.stage3RewardImage) {
					this.stage3RewardImage.setVisible(false);
					this.stage3RewardImage.setAlpha(0);
				}
				try { this.stage3RewardHighlightTween?.stop(); } catch {}
				this.stage3RewardHighlightTween = undefined;
				this.stage3RewardIntroTween = undefined;
				this.stage3RewardAnimating = false;
			} catch {}
			try {
				if (this.stage3MultiplierImage) {
					this.stage3MultiplierImage.setVisible(false);
					this.stage3MultiplierImage.setAlpha(0);
				}
				try { this.stage3MultiplierIdleTween?.stop(); } catch {}
				this.stage3MultiplierIdleTween = undefined;
				this.stage3MultiplierIntroTween = undefined;
				this.stage3MultiplierAnimating = false;
			} catch {}
			this.ensureStage3FloatTween();
			try { this.updateLevel3MeterFade(); } catch {}
		} catch {}
	}

	private animateStage3Complete(): void {
		try {
			if (!this.scene || !this.stage3Container || !this.stage3CompleteImage) return;
			if (this.stage3CompleteDone || this.stage3CompleteAnimating) return;
			if ((this.stage3Progress || 0) < 4) return;
			this.stage3CompleteAnimating = true;
			try { this.refreshLayout(); } catch {}
			try { this.stage3FloatTween?.stop(); } catch {}
			this.stage3FloatTween = undefined;

			const centerX = 0;
			const centerY = 0;
			const flashDur = 80;
			const flashRepeats = 5;
			const combineDur = 260;
			let combineDone = 0;
			const total = Math.min(4, this.stage3Indicators.length);

			try {
				for (let i = 0; i < total; i++) {
					const img = this.stage3Indicators[i];
					const sh = this.stage3Shadows[i];
					const gl = this.stage3Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try { this.scene?.tweens?.killTweensOf?.([img, sh, gl]); } catch {}
					try {
						if (img) {
							img.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: img,
								alpha: 0.2,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
					try {
						if (sh) {
							sh.setVisible(true);
							this.scene?.tweens?.add?.({
								targets: sh,
								alpha: 0.05,
								duration: flashDur,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: flashRepeats
							});
						}
					} catch {}
				}
			} catch {}

			this.scene.time.delayedCall(flashDur * (flashRepeats + 1), () => {
				try {
					const targetScale = (this.stage3CompleteImage?.scaleX ?? 1) as number;
					this.stage3CompleteImage?.setVisible(false);
					this.stage3CompleteImage?.setAlpha(0);
					this.stage3CompleteImage?.setScale(targetScale);
					this.stage3CompleteImage?.setPosition(centerX, centerY);
				} catch {}

				const finish = () => {
					try {
						const targetScale = (this.stage3CompleteImage?.scaleX ?? 1) as number;
						if (this.stage3CompleteImage) {
							this.stage3CompleteImage.setVisible(true);
							this.stage3CompleteImage.setAlpha(0);
							this.stage3CompleteImage.setScale(targetScale * 0.6);
							this.stage3CompleteImage.setPosition(centerX, centerY);
							this.scene?.tweens?.killTweensOf?.(this.stage3CompleteImage);
							this.scene?.tweens?.add?.({
								targets: this.stage3CompleteImage,
								alpha: 1,
								scaleX: targetScale,
								scaleY: targetScale,
								duration: 320,
								ease: 'Back.easeOut',
								onComplete: () => {
								this.stage3CompleteAnimating = false;
								this.stage3CompleteDone = true;
								try { this.updateStage3IndicatorsVisibility(); } catch {}
								try { this.ensureStage3FloatTween(); } catch {}
								try {
									const p1 = this.playStage3RewardIntro();
									const p2 = this.playStage3MultiplierIntro();
									Promise.all([Promise.resolve(p1), Promise.resolve(p2)]).then(() => {
										try { this.resolveStage3CompletePromise(); } catch {}
									}).catch(() => {
										try { this.resolveStage3CompletePromise(); } catch {}
									});
								} catch {
									try { this.resolveStage3CompletePromise(); } catch {}
								}
							}
							});
						}
					} catch {
						this.stage3CompleteAnimating = false;
						this.stage3CompleteDone = true;
						try { this.updateStage3IndicatorsVisibility(); } catch {}
						try { this.ensureStage3FloatTween(); } catch {}
						try { this.resolveStage3CompletePromise(); } catch {}
					}
				};

				for (let i = 0; i < total; i++) {
					const img = this.stage3Indicators[i];
					const sh = this.stage3Shadows[i];
					const gl = this.stage3Glows[i];
					try { gl?.setVisible(false); gl?.setAlpha(0); } catch {}
					try { this.scene?.tweens?.killTweensOf?.([img, sh]); } catch {}
					const onOneComplete = () => {
						combineDone++;
						if (combineDone >= total) {
							finish();
						}
					};
					try {
						if (img) {
							this.scene?.tweens?.add?.({
								targets: img,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (img.scaleX ?? 1) * 0.15,
								scaleY: (img.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { img.setVisible(false); img.setAlpha(1); } catch {}
								onOneComplete();
							}
							});
						} else {
							onOneComplete();
						}
					} catch {
						onOneComplete();
					}
					try {
						if (sh) {
							this.scene?.tweens?.add?.({
								targets: sh,
								x: centerX,
								y: centerY,
								alpha: 0,
								scaleX: (sh.scaleX ?? 1) * 0.15,
								scaleY: (sh.scaleY ?? 1) * 0.15,
								duration: combineDur,
								ease: 'Back.easeIn',
								onComplete: () => {
								try { sh.setVisible(false); sh.setAlpha(0); } catch {}
							}
							});
						}
					} catch {}
				}
			});
		} catch {}
	}

	private updateLevel3MeterFade(): void {
		try {
			if (!this.scene || !this.level3) return;
			const containerVisible = !!this.container?.visible;
			const shouldFade = containerVisible && (this.stage3Progress || 0) > 0;
			if (shouldFade === this.level3MeterFaded) {
				return;
			}
			this.level3MeterFaded = shouldFade;
			const targetAlpha = shouldFade ? 0 : 1;
			try { this.scene.tweens.killTweensOf(this.level3); } catch {}
			try {
				this.scene.tweens.add({
					targets: this.level3,
					alpha: targetAlpha,
					duration: 260,
					ease: 'Sine.easeOut'
				});
			} catch {
				try { this.level3.setAlpha(targetAlpha); } catch {}
			}
		} catch {}
	}

	private updateLevel1MeterFade(): void {
		try {
			if (!this.scene || !this.level1) return;
			const containerVisible = !!this.container?.visible;
			const shouldFade = containerVisible && (this.stage1Progress || 0) > 0;
			if (shouldFade === this.level1MeterFaded) {
				return;
			}
			this.level1MeterFaded = shouldFade;
			const targetAlpha = shouldFade ? 0 : 1;
			try { this.scene.tweens.killTweensOf(this.level1); } catch {}
			try {
				this.scene.tweens.add({
					targets: this.level1,
					alpha: targetAlpha,
					duration: 260,
					ease: 'Sine.easeOut'
				});
			} catch {
				try { this.level1.setAlpha(targetAlpha); } catch {}
			}
		} catch {}
	}

	private updateStage1IndicatorsVisibility(): void {
		try {
			if (this.stage1CompleteDone) {
				for (let i = 0; i < this.stage1Indicators.length; i++) {
					const img = this.stage1Indicators[i];
					if (img) img.setVisible(false);
					const s = this.stage1Shadows[i];
					if (s) { s.setVisible(false); s.setAlpha(0); }
					const g = this.stage1Glows[i];
					if (g) { g.setVisible(false); g.setAlpha(0); }
				}
				if (this.stage1CompleteImage) {
					this.stage1CompleteImage.setVisible(true);
					if ((this.stage1CompleteImage.alpha ?? 0) <= 0.01) {
						this.stage1CompleteImage.setAlpha(1);
					}
				}
				if (this.stage1RewardImage) {
					this.stage1RewardImage.setVisible(true);
					if (!this.stage1RewardAnimating && (this.stage1RewardImage.alpha ?? 0) <= 0.01) {
						this.stage1RewardImage.setAlpha(1);
					}
					try { if (!this.stage1RewardAnimating) this.ensureStage1RewardHighlight(); } catch {}
				}
				if (this.stage1MultiplierImage) {
					this.stage1MultiplierImage.setVisible(true);
					if (!this.stage1MultiplierAnimating && (this.stage1MultiplierImage.alpha ?? 0) <= 0.01) {
						this.stage1MultiplierImage.setAlpha(1);
					}
					try { if (!this.stage1MultiplierAnimating) this.ensureStage1MultiplierIdle(); } catch {}
				}
				if (this.stage1Container) {
					this.stage1Container.setVisible(true);
				}
				this.ensureStage1FloatTween();
				try { this.updateLevel1MeterFade(); } catch {}
				return;
			}
			for (let i = 0; i < this.stage1Indicators.length; i++) {
				const img = this.stage1Indicators[i];
				if (!img) continue;
				const v = this.stage1Progress >= (i + 1);
				img.setVisible(v);
				const s = this.stage1Shadows[i];
				if (s) {
					s.setVisible(v);
				}
				const g = this.stage1Glows[i];
				if (g && !v) {
					g.setVisible(false);
					g.setAlpha(0);
				}
			}
			if (this.stage1Container) {
				this.stage1Container.setVisible(this.stage1Progress > 0);
			}
			try {
				if (this.stage1RewardImage) {
					this.stage1RewardImage.setVisible(false);
					this.stage1RewardImage.setAlpha(0);
				}
				try { this.stage1RewardHighlightTween?.stop(); } catch {}
				this.stage1RewardHighlightTween = undefined;
				this.stage1RewardIntroTween = undefined;
				this.stage1RewardAnimating = false;
			} catch {}
			try {
				if (this.stage1MultiplierImage) {
					this.stage1MultiplierImage.setVisible(false);
					this.stage1MultiplierImage.setAlpha(0);
				}
				try { this.stage1MultiplierIdleTween?.stop(); } catch {}
				this.stage1MultiplierIdleTween = undefined;
				this.stage1MultiplierIntroTween = undefined;
				this.stage1MultiplierAnimating = false;
			} catch {}
			this.ensureStage1FloatTween();
			try { this.updateLevel1MeterFade(); } catch {}
		} catch {}
	}

	private ensureStage1RewardHighlight(): void {
		try {
			if (!this.scene || !this.stage1RewardImage) return;
			if (!this.stage1RewardImage.visible) return;
			const playingFn = (this.stage1RewardHighlightTween as any)?.isPlaying;
			if (this.stage1RewardHighlightTween && typeof playingFn === 'function' && playingFn.call(this.stage1RewardHighlightTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage1RewardImage); } catch {}
			const baseScale = (this.stage1RewardImage.scaleX ?? 1) as number;
			this.stage1RewardHighlightTween = this.scene.tweens.add({
				targets: this.stage1RewardImage,
				alpha: { from: 0.75, to: 1 },
				scaleX: { from: baseScale, to: baseScale * 1.06 },
				scaleY: { from: baseScale, to: baseScale * 1.06 },
				duration: 520,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private playStage1RewardIntro(): Promise<void> {
		return new Promise<void>((resolve) => {
			try {
				if (!this.scene || !this.stage1RewardImage) {
					resolve();
					return;
				}
				this.stage1RewardAnimating = true;
				try { this.stage1RewardHighlightTween?.stop(); } catch {}
				this.stage1RewardHighlightTween = undefined;
				try { this.scene.tweens.killTweensOf(this.stage1RewardImage); } catch {}
				const baseScale = (this.stage1RewardImage.scaleX ?? 1) as number;
				const baseX = (this.stage1RewardImage.x ?? 0) as number;
				const baseY = (this.stage1RewardImage.y ?? 0) as number;
				this.stage1RewardImage.setVisible(true);
				this.stage1RewardImage.setAlpha(0);
				this.stage1RewardImage.setScale(baseScale * 0.9);
				this.stage1RewardImage.setPosition(baseX, baseY + 6);
				this.stage1RewardIntroTween = this.scene.tweens.add({
					targets: this.stage1RewardImage,
					alpha: 1,
					scaleX: baseScale,
					scaleY: baseScale,
					y: baseY,
					duration: 320,
					ease: 'Back.easeOut',
					onComplete: () => {
						this.stage1RewardAnimating = false;
						try { this.ensureStage1RewardHighlight(); } catch {}
						resolve();
					}
				});
			} catch {
				this.stage1RewardAnimating = false;
				resolve();
			}
		});
	}

	private ensureStage1FloatTween(): void {
		try {
			if (!this.scene || !this.stage1Container) return;
			const visible = this.stage1Container.visible && this.stage1Progress > 0;
			if (!visible) {
				try { this.stage1FloatTween?.stop(); } catch {}
				this.stage1FloatTween = undefined;
				return;
			}
			const playingFn = (this.stage1FloatTween as any)?.isPlaying;
			if (this.stage1FloatTween && typeof playingFn === 'function' && playingFn.call(this.stage1FloatTween)) {
				return;
			}
			try { this.scene.tweens.killTweensOf(this.stage1Container); } catch {}
			const amp = Number(this.modifiers.stage1FloatAmplitude) || 0;
			const dur = Math.max(300, Number(this.modifiers.stage1FloatDuration) || 1800);
			if (!(isFinite(amp) && Math.abs(amp) > 0.01)) {
				return;
			}
			const baseY = this.stage1Container.y;
			this.stage1FloatTween = this.scene.tweens.add({
				targets: this.stage1Container,
				y: baseY + amp,
				duration: dur,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1
			});
		} catch {}
	}

	private animateStage1Unlock(index: number): void {
		try {
			if (!this.scene || !this.stage1Container) return;
			const img = this.stage1Indicators[index];
			const shadow = this.stage1Shadows[index];
			const glow = this.stage1Glows[index];
			if (!img || !shadow || !glow) return;

			try { this.refreshLayout(); } catch {}

			const baseScale = (img.scaleX ?? 1) as number;
			const baseX = (img.x ?? 0) as number;
			const baseY = (img.y ?? 0) as number;
			const yOff = Number(this.modifiers.stage1UnlockYOffset) || -6;
			const dur = Math.max(80, Number(this.modifiers.stage1UnlockDuration) || 220);
			const glowDur = Math.max(80, Number(this.modifiers.stage1GlowDuration) || 320);
			const glowTint = Number(this.modifiers.stage1GlowTint) || 0xfff6b0;
			const glowAlpha = Math.max(0, Math.min(1, Number(this.modifiers.stage1GlowAlpha) || 0.85));
			const glowScale = Math.max(0.5, Number(this.modifiers.stage1GlowScale) || 1.45);
			const shadowAlpha = Math.max(0, Math.min(1, Number(this.modifiers.stage1ShadowAlpha) || 0.35));

			try {
				this.scene.tweens.killTweensOf([img, shadow, glow]);
			} catch {}

			img.setVisible(true);
			shadow.setVisible(true);
			glow.setVisible(true);

			img.setAlpha(0);
			img.setScale(baseScale * 0.7);
			img.setPosition(baseX, baseY + yOff);

			shadow.setAlpha(0);
			shadow.setScale((shadow.scaleX ?? baseScale) as number);

			glow.setTint(glowTint);
			glow.setAlpha(glowAlpha);
			glow.setScale(baseScale * glowScale);
			glow.setPosition(baseX, baseY);
			try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? 1); } catch {}

			this.scene.tweens.add({
				targets: img,
				alpha: 1,
				scaleX: baseScale,
				scaleY: baseScale,
				y: baseY,
				duration: dur,
				ease: 'Back.easeOut',
				onComplete: () => {
					try {
						this.scene?.tweens?.killTweensOf?.(img);
						const bobAmp = Math.max(2, Math.min(8, Math.abs(yOff) || 4));
						this.scene?.tweens?.add?.({
							targets: img,
							y: baseY - bobAmp,
							duration: 140,
							ease: 'Sine.easeInOut',
							yoyo: true,
							repeat: 5
						});
					} catch {}
					try {
						if (this.indicator) {
							try {
								if (!this.indicator.visible) {
									this.indicator.setVisible(true);
								}
								if ((this.indicator.alpha ?? 1) <= 0.01) {
									this.indicator.setAlpha(1);
								}
							} catch {}
							const indBaseY = (this.indicator.y ?? 0) as number;
							this.scene?.tweens?.killTweensOf?.(this.indicator);
							this.scene?.tweens?.add?.({
								targets: this.indicator,
								y: indBaseY - 8,
								duration: 150,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: 5,
								onComplete: () => {
								try { this.indicator?.setY(indBaseY); } catch {}
							}
							});
						}
					} catch {}
				}
			});
			this.scene.tweens.add({
				targets: shadow,
				alpha: shadowAlpha,
				duration: Math.max(80, Math.floor(dur * 0.75)),
				ease: 'Sine.easeOut'
			});
			this.scene.tweens.add({
				targets: glow,
				alpha: 0,
				scaleX: baseScale * 1.05,
				scaleY: baseScale * 1.05,
				duration: glowDur,
				ease: 'Sine.easeOut',
				onComplete: () => {
					try { glow.setVisible(false); } catch {}
				}
			});
		} catch {}
	}

	private animateStage2Unlock(index: number): void {
		try {
			if (!this.scene || !this.stage2Container) return;
			const img = this.stage2Indicators[index];
			const shadow = this.stage2Shadows[index];
			const glow = this.stage2Glows[index];
			if (!img || !shadow || !glow) return;

			try { this.refreshLayout(); } catch {}

			const baseScale = (img.scaleX ?? 1) as number;
			const baseX = (img.x ?? 0) as number;
			const baseY = (img.y ?? 0) as number;
			const yOff = Number((this.modifiers as any).stage2UnlockYOffset) || -6;
			const dur = Math.max(80, Number((this.modifiers as any).stage2UnlockDuration) || 220);
			const glowDur = Math.max(80, Number((this.modifiers as any).stage2GlowDuration) || 320);
			const glowTint = Number((this.modifiers as any).stage2GlowTint) || 0xfff6b0;
			const glowAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage2GlowAlpha) || 0.85));
			const glowScale = Math.max(0.5, Number((this.modifiers as any).stage2GlowScale) || 1.45);
			const shadowAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage2ShadowAlpha) || 0.35));

			try {
				this.scene.tweens.killTweensOf([img, shadow, glow]);
			} catch {}

			img.setVisible(true);
			shadow.setVisible(true);
			glow.setVisible(true);

			img.setAlpha(0);
			img.setScale(baseScale * 0.7);
			img.setPosition(baseX, baseY + yOff);

			shadow.setAlpha(0);
			shadow.setScale((shadow.scaleX ?? baseScale) as number);

			glow.setTint(glowTint);
			glow.setAlpha(glowAlpha);
			glow.setScale(baseScale * glowScale);
			glow.setPosition(baseX, baseY);
			try { glow.setBlendMode((Phaser as any)?.BlendModes?.ADD ?? 1); } catch {}

			this.scene.tweens.add({
				targets: img,
				alpha: 1,
				scaleX: baseScale,
				scaleY: baseScale,
				y: baseY,
				duration: dur,
				ease: 'Back.easeOut',
				onComplete: () => {
					try {
						this.scene?.tweens?.killTweensOf?.(img);
						const bobAmp = Math.max(2, Math.min(8, Math.abs(yOff) || 4));
						this.scene?.tweens?.add?.({
							targets: img,
							y: baseY - bobAmp,
							duration: 140,
							ease: 'Sine.easeInOut',
							yoyo: true,
							repeat: 5
						});
					} catch {}
					try {
						if (this.indicator2) {
							try {
								if (!this.indicator2.visible) {
									this.indicator2.setVisible(true);
								}
								if ((this.indicator2.alpha ?? 1) <= 0.01) {
									this.indicator2.setAlpha(1);
								}
							} catch {}
							const indBaseY = (this.indicator2.y ?? 0) as number;
							this.scene?.tweens?.killTweensOf?.(this.indicator2);
							this.scene?.tweens?.add?.({
								targets: this.indicator2,
								y: indBaseY - 8,
								duration: 150,
								ease: 'Sine.easeInOut',
								yoyo: true,
								repeat: 5,
								onComplete: () => {
								try { this.indicator2?.setY(indBaseY); } catch {}
							}
							});
						}
					} catch {}
				}
			});
			this.scene.tweens.add({
				targets: shadow,
				alpha: shadowAlpha,
				duration: Math.max(80, Math.floor(dur * 0.75)),
				ease: 'Sine.easeOut'
			});
			this.scene.tweens.add({
				targets: glow,
				alpha: 0,
				scaleX: baseScale * 1.05,
				scaleY: baseScale * 1.05,
				duration: glowDur,
				ease: 'Sine.easeOut',
				onComplete: () => {
					try { glow.setVisible(false); } catch {}
				}
			});
		} catch {}
	}

	private refreshLayout(): void {
		if (!this.scene || !this.container) {
			return;
		}

		const baseX = this.scene.scale.width * 0.5;
		const baseY = this.scene.scale.height * 0.22;

		let renderScale = 1;
		try {
			const anyScene: any = this.scene as any;
			const assetScale = Number(anyScene?.networkManager?.getAssetScale?.() ?? 1) || 1;
			const widthScale = (this.scene.scale.width && isFinite(this.scene.scale.width)) ? (this.scene.scale.width / 1920) : 1;
			const computed = assetScale * widthScale;
			renderScale = (isFinite(computed) && computed > 0) ? computed : 1;
		} catch {}

		this.container.setPosition(baseX + this.modifiers.offsetX, baseY + this.modifiers.offsetY);
		this.container.setScale(renderScale * this.modifiers.scale);

		const w1 = (this.level1?.width ?? 0) as number;
		const w2 = (this.level2?.width ?? 0) as number;
		const w3 = (this.level3?.width ?? 0) as number;
		const s = (this.modifiers.spacingX ?? 0) as number;

		const x2 = 0;
		const x1 = x2 - (w2 * 0.5 + s + w1 * 0.5);
		const x3 = x2 + (w2 * 0.5 + s + w3 * 0.5);
		const barWidth = Math.max(10, x3 - x1);

		if (this.level2MeterContainer) {
			this.level2MeterContainer.setPosition(x2, 0);
		}
		if (this.level1MeterContainer) {
			this.level1MeterContainer.setPosition(x1, 0);
		}
		if (this.level3MeterContainer) {
			this.level3MeterContainer.setPosition(x3, 0);
		}
		if (this.level2) {
			this.level2.setPosition(0, 0);
		}
		if (this.level1) {
			this.level1.setPosition(0, 0);
		}
		if (this.level3) {
			this.level3.setPosition(0, 0);
		}
		if (this.indicator) {
			try {
				if (this.indicatorIntroPlayed || !this.indicatorIntroPromise) {
					const ix = (this.modifiers.indicatorOffsetX ?? 0) as number;
					const iy = (this.modifiers.indicatorOffsetY ?? 0) as number;
					this.indicator.setPosition(ix, iy);
					this.indicator.setScale((this.modifiers.indicatorScale ?? 1) as number);
				}
			} catch {}
		}
		if (this.indicator2) {
			try {
				const ix = ((this.modifiers as any).indicator2OffsetX ?? 0) as number;
				const iy = ((this.modifiers as any).indicator2OffsetY ?? 0) as number;
				this.indicator2.setPosition(ix, iy);
				this.indicator2.setScale(((this.modifiers as any).indicator2Scale ?? 1) as number);
			} catch {}
		}
		if (this.indicator3) {
			try {
				const ix = ((this.modifiers as any).indicator3OffsetX ?? 0) as number;
				const iy = ((this.modifiers as any).indicator3OffsetY ?? 0) as number;
				this.indicator3.setPosition(ix, iy);
				this.indicator3.setScale(((this.modifiers as any).indicator3Scale ?? 1) as number);
			} catch {}
		}
		if (this.stage2Container && this.stage2Indicators.length > 0) {
			try {
				const sx = ((this.modifiers as any).stage2OffsetX ?? 0) as number;
				const sy = ((this.modifiers as any).stage2OffsetY ?? 0) as number;
				this.stage2Container.setPosition(sx, sy);

				const gap = ((this.modifiers as any).stage2Gap ?? 0) as number;
				let totalW = 0;
				for (let i = 0; i < this.stage2Indicators.length; i++) {
					const img = this.stage2Indicators[i];
					if (!img) continue;
					totalW += (img.width ?? 0) as number;
				}
				totalW += gap * Math.max(0, this.stage2Indicators.length - 1);

				const meterW = (this.level2?.width ?? 0) as number;
				const maxW = meterW > 0 ? meterW * 0.68 : totalW;
				let iconScale = 1;
				if (totalW > 0 && maxW > 0) {
					iconScale = maxW / totalW;
				}
				iconScale *= (((this.modifiers as any).stage2Scale ?? 1) as number);
				if (!isFinite(iconScale) || iconScale <= 0) iconScale = 1;

				try {
					if (this.stage2CompleteImage) {
						const completeW = (this.stage2CompleteImage.width ?? 0) as number;
						let completeScale = 1;
						if (completeW > 0 && maxW > 0) {
							completeScale = maxW / completeW;
						}
						completeScale *= (((this.modifiers as any).stage2Scale ?? 1) as number);
						if (!isFinite(completeScale) || completeScale <= 0) completeScale = 1;
						this.stage2CompleteImage.setScale(completeScale);
						this.stage2CompleteImage.setPosition(0, 0);
					}
				} catch {}
				try {
					if (this.stage2RewardImage) {
						const rewardW = (this.stage2RewardImage.width ?? 0) as number;
						let rewardScale = 1;
						if (rewardW > 0 && maxW > 0) {
							rewardScale = maxW / rewardW;
						}
						rewardScale *= (((this.modifiers as any).stage2Scale ?? 1) as number);
						rewardScale *= Number((this.modifiers as any).stage2RewardScale ?? 1) || 1;
						if (!isFinite(rewardScale) || rewardScale <= 0) rewardScale = 1;
						this.stage2RewardImage.setScale(rewardScale);
						const ch = (this.stage2CompleteImage?.displayHeight ?? 0) as number;
						const rh = (this.stage2RewardImage.displayHeight ?? 0) as number;
						const yOff = (ch > 0 && rh > 0) ? (ch * 0.62 + rh * 0.62 + 8) : 46;
						this.stage2RewardImage.setPosition(0, yOff);
					}
				} catch {}
				try {
					if (this.stage2MultiplierImage) {
						const multW = (this.stage2MultiplierImage.width ?? 0) as number;
						let multScale = 1;
						const cw = (this.stage2CompleteImage?.displayWidth ?? 0) as number;
						const targetW = cw > 0 ? cw * 0.42 : (maxW > 0 ? maxW * 0.28 : multW);
						if (multW > 0 && targetW > 0) {
							multScale = targetW / multW;
						}
						multScale *= Number((this.modifiers as any).stage2MultiplierScale ?? 1) || 1;
						if (!isFinite(multScale) || multScale <= 0) multScale = 1;
						this.stage2MultiplierImage.setScale(multScale);
						this.stage2MultiplierImage.setPosition(0, 0);
					}
				} catch {}

				if (!this.stage2CompleteAnimating) {
					let rowW = 0;
					for (let i = 0; i < this.stage2Indicators.length; i++) {
						const img = this.stage2Indicators[i];
						if (!img) continue;
						rowW += ((img.width ?? 0) as number) * iconScale;
					}
					rowW += gap * iconScale * Math.max(0, this.stage2Indicators.length - 1);

					let cursor = -rowW * 0.5;
					const shx = Number((this.modifiers as any).stage2ShadowOffsetX) || 0;
					const shy = Number((this.modifiers as any).stage2ShadowOffsetY) || 0;
					const shScale = Math.max(0.1, Number((this.modifiers as any).stage2ShadowScale) || 1.03);
					const shAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage2ShadowAlpha) || 0.35));
					const glowTint = Number((this.modifiers as any).stage2GlowTint) || 0xfff6b0;
					for (let i = 0; i < this.stage2Indicators.length; i++) {
						const img = this.stage2Indicators[i];
						if (!img) continue;
						const w = ((img.width ?? 0) as number) * iconScale;
						const cx = cursor + w * 0.5;
						img.setScale(iconScale);
						img.setPosition(cx, 0);
						const shadow = this.stage2Shadows[i];
						if (shadow) {
							shadow.setScale(iconScale * shScale);
							shadow.setPosition(cx + shx, shy);
							if (shadow.visible) shadow.setAlpha(shAlpha);
						}
						const glow = this.stage2Glows[i];
						if (glow) {
							glow.setTint(glowTint);
							glow.setPosition(cx, 0);
						}
						cursor += w + gap * iconScale;
					}
				}
				this.updateStage2IndicatorsVisibility();
			} catch {}
		}
		if (this.stage3Container && this.stage3Indicators.length > 0) {
			try {
				const sx = ((this.modifiers as any).stage3OffsetX ?? 0) as number;
				const sy = ((this.modifiers as any).stage3OffsetY ?? 0) as number;
				this.stage3Container.setPosition(sx, sy);

				const gap = ((this.modifiers as any).stage3Gap ?? 0) as number;
				let totalW = 0;
				for (let i = 0; i < this.stage3Indicators.length; i++) {
					const img = this.stage3Indicators[i];
					if (!img) continue;
					totalW += (img.width ?? 0) as number;
				}
				totalW += gap * Math.max(0, this.stage3Indicators.length - 1);

				const meterW = (this.level3?.width ?? 0) as number;
				const maxW = meterW > 0 ? meterW * 0.68 : totalW;
				let iconScale = 1;
				if (totalW > 0 && maxW > 0) {
					iconScale = maxW / totalW;
				}
				iconScale *= (((this.modifiers as any).stage3Scale ?? 1) as number);
				if (!isFinite(iconScale) || iconScale <= 0) iconScale = 1;

				try {
					if (this.stage3CompleteImage) {
						const completeW = (this.stage3CompleteImage.width ?? 0) as number;
						let completeScale = 1;
						if (completeW > 0 && maxW > 0) {
							completeScale = maxW / completeW;
						}
						completeScale *= (((this.modifiers as any).stage3Scale ?? 1) as number);
						if (!isFinite(completeScale) || completeScale <= 0) completeScale = 1;
						this.stage3CompleteImage.setScale(completeScale);
						this.stage3CompleteImage.setPosition(0, 0);
					}
				} catch {}
				try {
					if (this.stage3RewardImage) {
						const rewardW = (this.stage3RewardImage.width ?? 0) as number;
						let rewardScale = 1;
						if (rewardW > 0 && maxW > 0) {
							rewardScale = maxW / rewardW;
						}
						rewardScale *= (((this.modifiers as any).stage3Scale ?? 1) as number);
						rewardScale *= Number((this.modifiers as any).stage3RewardScale ?? 1) || 1;
						if (!isFinite(rewardScale) || rewardScale <= 0) rewardScale = 1;
						this.stage3RewardImage.setScale(rewardScale);
						const ch = (this.stage3CompleteImage?.displayHeight ?? 0) as number;
						const rh = (this.stage3RewardImage.displayHeight ?? 0) as number;
						const yOff = (ch > 0 && rh > 0) ? (ch * 0.62 + rh * 0.62 + 8) : 46;
						this.stage3RewardImage.setPosition(0, yOff);
					}
				} catch {}
				try {
					if (this.stage3MultiplierImage) {
						const multW = (this.stage3MultiplierImage.width ?? 0) as number;
						let multScale = 1;
						const cw = (this.stage3CompleteImage?.displayWidth ?? 0) as number;
						const targetW = cw > 0 ? cw * 0.42 : (maxW > 0 ? maxW * 0.28 : multW);
						if (multW > 0 && targetW > 0) {
							multScale = targetW / multW;
						}
						multScale *= Number((this.modifiers as any).stage3MultiplierScale ?? 1) || 1;
						if (!isFinite(multScale) || multScale <= 0) multScale = 1;
						this.stage3MultiplierImage.setScale(multScale);
						this.stage3MultiplierImage.setPosition(0, 0);
					}
				} catch {}

				if (!this.stage3CompleteAnimating) {
					let rowW = 0;
					for (let i = 0; i < this.stage3Indicators.length; i++) {
						const img = this.stage3Indicators[i];
						if (!img) continue;
						rowW += ((img.width ?? 0) as number) * iconScale;
					}
					rowW += gap * iconScale * Math.max(0, this.stage3Indicators.length - 1);

					let cursor = -rowW * 0.5;
					const shx = Number((this.modifiers as any).stage3ShadowOffsetX) || 0;
					const shy = Number((this.modifiers as any).stage3ShadowOffsetY) || 0;
					const shScale = Math.max(0.1, Number((this.modifiers as any).stage3ShadowScale) || 1.03);
					const shAlpha = Math.max(0, Math.min(1, Number((this.modifiers as any).stage3ShadowAlpha) || 0.35));
					const glowTint = Number((this.modifiers as any).stage3GlowTint) || 0xfff6b0;
					for (let i = 0; i < this.stage3Indicators.length; i++) {
						const img = this.stage3Indicators[i];
						if (!img) continue;
						const w = ((img.width ?? 0) as number) * iconScale;
						const cx = cursor + w * 0.5;
						img.setScale(iconScale);
						img.setPosition(cx, 0);
						const shadow = this.stage3Shadows[i];
						if (shadow) {
							shadow.setScale(iconScale * shScale);
							shadow.setPosition(cx + shx, shy);
							if (shadow.visible) shadow.setAlpha(shAlpha);
						}
						const glow = this.stage3Glows[i];
						if (glow) {
							glow.setTint(glowTint);
							glow.setPosition(cx, 0);
						}
						cursor += w + gap * iconScale;
					}
				}
				this.updateStage3IndicatorsVisibility();
			} catch {}
		}
		if (this.stage1Container && this.stage1Indicators.length > 0) {
			try {
				const sx = (this.modifiers.stage1OffsetX ?? 0) as number;
				const sy = (this.modifiers.stage1OffsetY ?? 0) as number;
				this.stage1Container.setPosition(sx, sy);

				const gap = (this.modifiers.stage1Gap ?? 0) as number;
				let totalW = 0;
				for (let i = 0; i < this.stage1Indicators.length; i++) {
					const img = this.stage1Indicators[i];
					if (!img) continue;
					totalW += (img.width ?? 0) as number;
				}
				totalW += gap * Math.max(0, this.stage1Indicators.length - 1);

				const meterW = (this.level1?.width ?? 0) as number;
				const maxW = meterW > 0 ? meterW * 0.68 : totalW;
				let iconScale = 1;
				if (totalW > 0 && maxW > 0) {
					iconScale = maxW / totalW;
				}
				iconScale *= (this.modifiers.stage1Scale ?? 1) as number;
				if (!isFinite(iconScale) || iconScale <= 0) iconScale = 1;

				try {
					if (this.stage1CompleteImage) {
						const completeW = (this.stage1CompleteImage.width ?? 0) as number;
						let completeScale = 1;
						if (completeW > 0 && maxW > 0) {
							completeScale = maxW / completeW;
						}
						completeScale *= (this.modifiers.stage1Scale ?? 1) as number;
						if (!isFinite(completeScale) || completeScale <= 0) completeScale = 1;
						this.stage1CompleteImage.setScale(completeScale);
						this.stage1CompleteImage.setPosition(0, 0);
					}
				} catch {}
				try {
					if (this.stage1RewardImage) {
						const rewardW = (this.stage1RewardImage.width ?? 0) as number;
						let rewardScale = 1;
						if (rewardW > 0 && maxW > 0) {
							rewardScale = maxW / rewardW;
						}
						rewardScale *= (this.modifiers.stage1Scale ?? 1) as number;
						rewardScale *= Number((this.modifiers as any).stage1RewardScale ?? 1) || 1;
						if (!isFinite(rewardScale) || rewardScale <= 0) rewardScale = 1;
						this.stage1RewardImage.setScale(rewardScale);
						const ch = (this.stage1CompleteImage?.displayHeight ?? 0) as number;
						const rh = (this.stage1RewardImage.displayHeight ?? 0) as number;
						const yOff = (ch > 0 && rh > 0) ? (ch * 0.62 + rh * 0.62 + 8) : 46;
						this.stage1RewardImage.setPosition(0, yOff);
					}
				} catch {}
				try {
					if (this.stage1MultiplierImage) {
						const multW = (this.stage1MultiplierImage.width ?? 0) as number;
						let multScale = 1;
						const cw = (this.stage1CompleteImage?.displayWidth ?? 0) as number;
						const targetW = cw > 0 ? cw * 0.42 : (maxW > 0 ? maxW * 0.28 : multW);
						if (multW > 0 && targetW > 0) {
							multScale = targetW / multW;
						}
						multScale *= Number((this.modifiers as any).stage1MultiplierScale ?? 1) || 1;
						if (!isFinite(multScale) || multScale <= 0) multScale = 1;
						this.stage1MultiplierImage.setScale(multScale);
						this.stage1MultiplierImage.setPosition(0, 0);
					}
				} catch {}

				if (!this.stage1CompleteAnimating) {
					let rowW = 0;
					for (let i = 0; i < this.stage1Indicators.length; i++) {
						const img = this.stage1Indicators[i];
						if (!img) continue;
						rowW += ((img.width ?? 0) as number) * iconScale;
					}
					rowW += gap * iconScale * Math.max(0, this.stage1Indicators.length - 1);

					let cursor = -rowW * 0.5;
					const shx = Number(this.modifiers.stage1ShadowOffsetX) || 0;
					const shy = Number(this.modifiers.stage1ShadowOffsetY) || 0;
					const shScale = Math.max(0.1, Number(this.modifiers.stage1ShadowScale) || 1.03);
					const shAlpha = Math.max(0, Math.min(1, Number(this.modifiers.stage1ShadowAlpha) || 0.35));
					const glowTint = Number(this.modifiers.stage1GlowTint) || 0xfff6b0;
					for (let i = 0; i < this.stage1Indicators.length; i++) {
						const img = this.stage1Indicators[i];
						if (!img) continue;
						const w = ((img.width ?? 0) as number) * iconScale;
						const cx = cursor + w * 0.5;
						img.setScale(iconScale);
						img.setPosition(cx, 0);
						const shadow = this.stage1Shadows[i];
						if (shadow) {
							shadow.setScale(iconScale * shScale);
							shadow.setPosition(cx + shx, shy);
							if (shadow.visible) shadow.setAlpha(shAlpha);
						}
						const glow = this.stage1Glows[i];
						if (glow) {
							glow.setTint(glowTint);
							glow.setPosition(cx, 0);
						}
						cursor += w + gap * iconScale;
					}
				}
				this.updateStage1IndicatorsVisibility();
			} catch {}
		}
		if (this.bar) {
			this.bar.setPosition((x1 + x3) * 0.5, 0);
			this.bar.setSize(barWidth, Math.max(1, this.modifiers.barThickness));
		}
	}

	destroy(): void {
		try {
			if (this.scene && this.resizeHandler) {
				this.scene.scale.off('resize', this.resizeHandler);
			}
		} catch {}
		this.resizeHandler = undefined;

		try {
			if (this.scene && this.stage1Container) {
				this.scene.tweens.killTweensOf(this.stage1Container);
			}
		} catch {}

		try {
			if (this.scene) {
				try { if (this.stage1CompleteImage) this.scene.tweens.killTweensOf(this.stage1CompleteImage); } catch {}
				try { if (this.stage1RewardImage) this.scene.tweens.killTweensOf(this.stage1RewardImage); } catch {}
				try { if (this.stage1MultiplierImage) this.scene.tweens.killTweensOf(this.stage1MultiplierImage); } catch {}
				try { if (this.stage2CompleteImage) this.scene.tweens.killTweensOf(this.stage2CompleteImage); } catch {}
				try { if (this.stage2RewardImage) this.scene.tweens.killTweensOf(this.stage2RewardImage); } catch {}
				try { if (this.stage2MultiplierImage) this.scene.tweens.killTweensOf(this.stage2MultiplierImage); } catch {}
				try { if (this.stage3CompleteImage) this.scene.tweens.killTweensOf(this.stage3CompleteImage); } catch {}
				try { if (this.stage3RewardImage) this.scene.tweens.killTweensOf(this.stage3RewardImage); } catch {}
				try { if (this.stage3MultiplierImage) this.scene.tweens.killTweensOf(this.stage3MultiplierImage); } catch {}
			}
			try { this.stage1RewardHighlightTween?.stop(); } catch {}
			try { this.stage1RewardIntroTween?.stop(); } catch {}
			try { this.stage1MultiplierIdleTween?.stop(); } catch {}
			try { this.stage1MultiplierIntroTween?.stop(); } catch {}
			try { this.stage2RewardHighlightTween?.stop(); } catch {}
			try { this.stage2RewardIntroTween?.stop(); } catch {}
			try { this.stage2MultiplierIdleTween?.stop(); } catch {}
			try { this.stage2MultiplierIntroTween?.stop(); } catch {}
			try { this.stage3RewardHighlightTween?.stop(); } catch {}
			try { this.stage3RewardIntroTween?.stop(); } catch {}
			try { this.stage3MultiplierIdleTween?.stop(); } catch {}
			try { this.stage3MultiplierIntroTween?.stop(); } catch {}
		} catch {}

		try { this.container?.destroy(true); } catch {}
		this.container = undefined;
		this.level1MeterContainer = undefined;
		this.level2MeterContainer = undefined;
		this.level3MeterContainer = undefined;
		this.bar = undefined;
		this.indicator = undefined;
		this.indicator2 = undefined;
		this.indicator3 = undefined;
		this.level1 = undefined;
		this.level2 = undefined;
		this.level3 = undefined;
		this.stage1Container = undefined;
		this.stage1Shadows = [];
		this.stage1Glows = [];
		this.stage1Indicators = [];
		this.stage1CompleteImage = undefined;
		this.stage1RewardImage = undefined;
		this.stage1MultiplierImage = undefined;
		this.stage1RewardHighlightTween = undefined;
		this.stage1RewardIntroTween = undefined;
		this.stage1RewardAnimating = false;
		this.stage1MultiplierIdleTween = undefined;
		this.stage1MultiplierIntroTween = undefined;
		this.stage1MultiplierAnimating = false;
		try { this.resolveStage1CompletePromise(); } catch {}
		try { this.resolveStage2CompletePromise(); } catch {}
		this.stage2Container = undefined;
		this.stage2Shadows = [];
		this.stage2Glows = [];
		this.stage2Indicators = [];
		this.stage2CompleteImage = undefined;
		this.stage2RewardImage = undefined;
		this.stage2MultiplierImage = undefined;
		this.stage2RewardHighlightTween = undefined;
		this.stage2RewardIntroTween = undefined;
		this.stage2RewardAnimating = false;
		this.stage2MultiplierIdleTween = undefined;
		this.stage2MultiplierIntroTween = undefined;
		this.stage2MultiplierAnimating = false;
		this.stage2CompletePromise = undefined;
		this.stage2CompletePromiseResolve = undefined;
		this.stage2FloatTween = undefined;
		this.stage3Container = undefined;
		this.stage3Shadows = [];
		this.stage3Glows = [];
		this.stage3Indicators = [];
		this.stage3CompleteImage = undefined;
		this.stage3RewardImage = undefined;
		this.stage3MultiplierImage = undefined;
		this.stage3RewardHighlightTween = undefined;
		this.stage3RewardIntroTween = undefined;
		this.stage3RewardAnimating = false;
		this.stage3MultiplierIdleTween = undefined;
		this.stage3MultiplierIntroTween = undefined;
		this.stage3MultiplierAnimating = false;
		this.stage3CompletePromise = undefined;
		this.stage3CompletePromiseResolve = undefined;
		this.stage3FloatTween = undefined;
		this.scene = undefined;
	}
}
