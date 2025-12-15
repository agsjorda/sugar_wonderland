import Phaser, { Scene } from 'phaser';

export class GaugeMeter {
	private scene?: Scene;
	private container?: Phaser.GameObjects.Container;
	private bar?: Phaser.GameObjects.Rectangle;
	private indicator?: Phaser.GameObjects.Image;
	private level1?: Phaser.GameObjects.Image;
	private level2?: Phaser.GameObjects.Image;
	private level3?: Phaser.GameObjects.Image;
	private stage1Container?: Phaser.GameObjects.Container;
	private stage1Shadows: Phaser.GameObjects.Image[] = [];
	private stage1Glows: Phaser.GameObjects.Image[] = [];
	private stage1Indicators: Phaser.GameObjects.Image[] = [];
	private stage1CompleteImage?: Phaser.GameObjects.Image;
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
	private resizeHandler?: () => void;
	private indicatorIntroPromise?: Promise<void>;
	private indicatorIntroPlayed: boolean = false;
	private stage1Progress: number = 0;
	private level1MeterFaded: boolean = false;
	private stage1CompleteAnimating: boolean = false;
	private stage1CompleteDone: boolean = false;

	private modifiers = {
		offsetX: 0,
		offsetY: 20,
		spacingX: 120,
		barThickness: 6,
		indicatorOffsetX: 15,
		indicatorOffsetY: -5,
		indicatorScale: 0.3,
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
		stage1RewardScale: 1,
		stage1MultiplierScale: 1,
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

		this.bar = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.45);
		this.bar.setOrigin(0.5, 0.5);

		this.indicator = scene.add.image(0, 0, 'meter-indicator').setOrigin(0.5, 0.5);
		this.indicator.setVisible(false);
		this.indicator.setAlpha(0);

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
			const complete = scene.add.image(0, 0, 'stage1_5').setOrigin(0.5, 0.5);
			complete.setVisible(false);
			complete.setAlpha(0);
			this.stage1CompleteImage = complete;
			this.stage1Container.add(complete);
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

		this.container.add([this.bar, this.indicator, this.level1, this.level2, this.level3, this.stage1Container]);

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
			this.indicatorIntroPlayed = false;
			this.indicatorIntroPromise = undefined;
			this.stage1Progress = 0;
			this.level1MeterFaded = false;
			this.stage1CompleteAnimating = false;
			this.stage1CompleteDone = false;
			this.stage1RewardAnimating = false;
			this.stage1MultiplierAnimating = false;
			this.stage1CompletePromise = undefined;
			this.stage1CompletePromiseResolve = undefined;
			try {
				if (this.scene && this.indicator) {
					this.scene.tweens.killTweensOf(this.indicator);
				}
			} catch {}
			try {
				if (this.scene && this.level1) {
					this.scene.tweens.killTweensOf(this.level1);
					this.level1.setAlpha(1);
				}
			} catch {}
			try {
				this.indicator?.setVisible(false);
				this.indicator?.setAlpha(0);
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
		}
		try {
			if (visible) {
				this.updateLevel1MeterFade();
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

	private beginStage1CompleteSequence(): Promise<void> {
		try {
			if (this.stage1CompleteDone) {
				return Promise.resolve();
			}
			if (this.stage1CompletePromise) {
				return this.stage1CompletePromise;
			}
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

	playIndicatorIntro(): Promise<void> {
		if (this.indicatorIntroPlayed) {
			return Promise.resolve();
		}
		if (this.indicatorIntroPromise) {
			return this.indicatorIntroPromise;
		}
		try { this.refreshLayout(); } catch {}
		this.indicatorIntroPromise = new Promise<void>((resolve) => {
			if (!this.scene || !this.indicator) {
				this.indicatorIntroPlayed = true;
				resolve();
				return;
			}
			try {
				this.scene.tweens.killTweensOf(this.indicator);
			} catch {}
			try {
				const baseX = (this.indicator.x ?? 0) as number;
				const baseY = (this.indicator.y ?? 0) as number;
				const baseScale = (this.indicator.scaleX ?? (this.modifiers.indicatorScale ?? 1)) as number;
				this.indicator.setVisible(true);
				this.indicator.setAlpha(0);
				this.indicator.setAngle(-8);
				this.indicator.setScale(baseScale * 1.06);
				this.indicator.setPosition(baseX, baseY - 8);
				this.scene.tweens.add({
					targets: this.indicator,
					alpha: 1,
					angle: 0,
					scaleX: baseScale,
					scaleY: baseScale,
					y: baseY,
					duration: Math.max(50, Number(this.modifiers.indicatorIntroDuration) || 420),
					ease: 'Sine.easeOut',
					onComplete: () => {
						this.indicatorIntroPlayed = true;
						this.indicatorIntroPromise = undefined;
						resolve();
					}
				});
			} catch {
				this.indicatorIntroPlayed = true;
				this.indicatorIntroPromise = undefined;
				resolve();
			}
		});
		return this.indicatorIntroPromise;
	}

	updateModifiers(mods: { offsetX?: number; offsetY?: number; spacingX?: number; barThickness?: number; indicatorOffsetX?: number; indicatorOffsetY?: number; indicatorScale?: number; indicatorIntroDuration?: number; stage1OffsetX?: number; stage1OffsetY?: number; stage1Scale?: number; stage1Gap?: number; stage1ShadowOffsetX?: number; stage1ShadowOffsetY?: number; stage1ShadowAlpha?: number; stage1ShadowScale?: number; stage1GlowTint?: number; stage1GlowAlpha?: number; stage1GlowScale?: number; stage1GlowDuration?: number; stage1UnlockDuration?: number; stage1UnlockYOffset?: number; stage1FloatAmplitude?: number; stage1FloatDuration?: number; stage1RewardScale?: number; stage1MultiplierScale?: number; scale?: number; depth?: number }): void {
		if (typeof mods.offsetX === 'number') this.modifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.modifiers.offsetY = mods.offsetY;
		if (typeof mods.spacingX === 'number' && isFinite(mods.spacingX)) this.modifiers.spacingX = mods.spacingX;
		if (typeof mods.barThickness === 'number' && isFinite(mods.barThickness) && mods.barThickness > 0) this.modifiers.barThickness = mods.barThickness;
		if (typeof mods.indicatorOffsetX === 'number' && isFinite(mods.indicatorOffsetX)) this.modifiers.indicatorOffsetX = mods.indicatorOffsetX;
		if (typeof mods.indicatorOffsetY === 'number' && isFinite(mods.indicatorOffsetY)) this.modifiers.indicatorOffsetY = mods.indicatorOffsetY;
		if (typeof mods.indicatorScale === 'number' && isFinite(mods.indicatorScale) && mods.indicatorScale > 0) this.modifiers.indicatorScale = mods.indicatorScale;
		if (typeof mods.indicatorIntroDuration === 'number' && isFinite(mods.indicatorIntroDuration) && mods.indicatorIntroDuration > 0) this.modifiers.indicatorIntroDuration = mods.indicatorIntroDuration;
		if (typeof mods.stage1OffsetX === 'number' && isFinite(mods.stage1OffsetX)) this.modifiers.stage1OffsetX = mods.stage1OffsetX;
		if (typeof mods.stage1OffsetY === 'number' && isFinite(mods.stage1OffsetY)) this.modifiers.stage1OffsetY = mods.stage1OffsetY;
		if (typeof mods.stage1Scale === 'number' && isFinite(mods.stage1Scale) && mods.stage1Scale > 0) this.modifiers.stage1Scale = mods.stage1Scale;
		if (typeof mods.stage1Gap === 'number' && isFinite(mods.stage1Gap) && mods.stage1Gap >= 0) this.modifiers.stage1Gap = mods.stage1Gap;
		if (typeof mods.stage1ShadowOffsetX === 'number' && isFinite(mods.stage1ShadowOffsetX)) this.modifiers.stage1ShadowOffsetX = mods.stage1ShadowOffsetX;
		if (typeof mods.stage1ShadowOffsetY === 'number' && isFinite(mods.stage1ShadowOffsetY)) this.modifiers.stage1ShadowOffsetY = mods.stage1ShadowOffsetY;
		if (typeof mods.stage1ShadowAlpha === 'number' && isFinite(mods.stage1ShadowAlpha) && mods.stage1ShadowAlpha >= 0) this.modifiers.stage1ShadowAlpha = mods.stage1ShadowAlpha;
		if (typeof mods.stage1ShadowScale === 'number' && isFinite(mods.stage1ShadowScale) && mods.stage1ShadowScale > 0) this.modifiers.stage1ShadowScale = mods.stage1ShadowScale;
		if (typeof mods.stage1GlowTint === 'number' && isFinite(mods.stage1GlowTint)) this.modifiers.stage1GlowTint = mods.stage1GlowTint;
		if (typeof mods.stage1GlowAlpha === 'number' && isFinite(mods.stage1GlowAlpha) && mods.stage1GlowAlpha >= 0) this.modifiers.stage1GlowAlpha = mods.stage1GlowAlpha;
		if (typeof mods.stage1GlowScale === 'number' && isFinite(mods.stage1GlowScale) && mods.stage1GlowScale > 0) this.modifiers.stage1GlowScale = mods.stage1GlowScale;
		if (typeof mods.stage1GlowDuration === 'number' && isFinite(mods.stage1GlowDuration) && mods.stage1GlowDuration > 0) this.modifiers.stage1GlowDuration = mods.stage1GlowDuration;
		if (typeof mods.stage1UnlockDuration === 'number' && isFinite(mods.stage1UnlockDuration) && mods.stage1UnlockDuration > 0) this.modifiers.stage1UnlockDuration = mods.stage1UnlockDuration;
		if (typeof mods.stage1UnlockYOffset === 'number' && isFinite(mods.stage1UnlockYOffset)) this.modifiers.stage1UnlockYOffset = mods.stage1UnlockYOffset;
		if (typeof mods.stage1FloatAmplitude === 'number' && isFinite(mods.stage1FloatAmplitude)) this.modifiers.stage1FloatAmplitude = mods.stage1FloatAmplitude;
		if (typeof mods.stage1FloatDuration === 'number' && isFinite(mods.stage1FloatDuration) && mods.stage1FloatDuration > 0) this.modifiers.stage1FloatDuration = mods.stage1FloatDuration;
		if (typeof mods.stage1RewardScale === 'number' && isFinite(mods.stage1RewardScale) && mods.stage1RewardScale > 0) (this.modifiers as any).stage1RewardScale = mods.stage1RewardScale;
		if (typeof mods.stage1MultiplierScale === 'number' && isFinite(mods.stage1MultiplierScale) && mods.stage1MultiplierScale > 0) (this.modifiers as any).stage1MultiplierScale = mods.stage1MultiplierScale;
		if (typeof mods.scale === 'number' && isFinite(mods.scale) && mods.scale > 0) this.modifiers.scale = mods.scale;
		if (typeof mods.depth === 'number' && isFinite(mods.depth)) this.modifiers.depth = mods.depth;
		try {
			if (this.container) {
				this.container.setDepth(this.modifiers.depth);
			}
		} catch {}
		this.refreshLayout();
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

		if (this.level2) {
			this.level2.setPosition(x2, 0);
		}
		if (this.level1) {
			this.level1.setPosition(x1, 0);
		}
		if (this.level3) {
			this.level3.setPosition(x3, 0);
		}
		if (this.indicator) {
			try {
				if (this.indicatorIntroPlayed || !this.indicatorIntroPromise) {
					const ix = (this.modifiers.indicatorOffsetX ?? 0) as number;
					const iy = (this.modifiers.indicatorOffsetY ?? 0) as number;
					this.indicator.setPosition(x1 + ix, iy);
					this.indicator.setScale((this.modifiers.indicatorScale ?? 1) as number);
				}
			} catch {}
		}
		if (this.stage1Container && this.stage1Indicators.length > 0) {
			try {
				const sx = (this.modifiers.stage1OffsetX ?? 0) as number;
				const sy = (this.modifiers.stage1OffsetY ?? 0) as number;
				this.stage1Container.setPosition(x1 + sx, sy);

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
			}
			try { this.stage1RewardHighlightTween?.stop(); } catch {}
			try { this.stage1RewardIntroTween?.stop(); } catch {}
			try { this.stage1MultiplierIdleTween?.stop(); } catch {}
			try { this.stage1MultiplierIntroTween?.stop(); } catch {}
		} catch {}

		try { this.container?.destroy(true); } catch {}
		this.container = undefined;
		this.bar = undefined;
		this.indicator = undefined;
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
		this.scene = undefined;
	}
}
