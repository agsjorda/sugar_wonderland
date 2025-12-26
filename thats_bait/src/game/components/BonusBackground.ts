import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { WaterWavePipeline, WaterWaveVerticalPipeline, WaterRipplePipeline } from "../pipelines/WaterWavePipeline";

export class BonusBackground {
	private bgContainer!: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private sceneRef: Scene | null = null;
	private seaEdgeWidthMultiplier: number = 1.1;
	private bgDepth?: Phaser.GameObjects.Image;
	private bgFog?: Phaser.GameObjects.Image;
	private bgSurface?: Phaser.GameObjects.Image;
	private bgSky?: Phaser.GameObjects.Image;
	private seaEdge?: Phaser.GameObjects.Image;
	private reelBottomSpine?: any;
	private characterSpine?: any;
	private rippleVfxSpine?: any;
	private lastHookSurfaceContact: boolean = false;
	private readonly hookSplashTextureKey: string = 'splash';
	private readonly hookSplashModifiers = {
		offsetX: 0,
		offsetY: 0,
		scale: 0.75,
	};
	private readonly reelBottomModifiers = {
		offsetX: 0,
		offsetY: -112,
		scale: 4,
	};
	private readonly rippleVfxModifiers = {
		offsetX: 0,
		offsetY: 7,
		scale: 1,
	};
	private characterModifiers = {
		offsetX: -50,
		offsetY: -345,
		scale: 0.65,
	};
	private readonly depthBackgroundModifiers = {
		offsetX: 0,
		offsetY: -360,
		scale: 0.71,
		scaleXMultiplier: 1,
		scaleYMultiplier: 0.6,
	};
	private readonly fogBackgroundModifiers = {
		offsetX: 0,
		offsetY: -230,
		scale: 0.71,
		scaleXMultiplier: 0.9,
		scaleYMultiplier: 0.35,
		opacity: 0.5,
	};
	private readonly surfaceBackgroundModifiers = {
		offsetX: 0,
		offsetY: -618,
		scale: 0.18,
		scaleXMultiplier: 1,
		scaleYMultiplier: 0.95,
	};
	private readonly skyBackgroundModifiers = {
		offsetX: 0,
		offsetY: -367,
		scale: 0.209,
		scaleXMultiplier: 1,
		scaleYMultiplier: 1,
	};

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		console.log(`[BonusBackground] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		this.sceneRef = scene;
		this.bgContainer = scene.add.container(0, 0);
		this.bgContainer.setDepth(-10);
		const assetScale = this.networkManager.getAssetScale();
		this.createBackgroundLayers(scene, assetScale);
	}

	public updateHookSurfaceInteraction(hookX: number, hookY: number): void {
		if (!this.bgSurface || !this.sceneRef) {
			this.lastHookSurfaceContact = false;
			return;
		}

		const w = this.bgSurface.displayWidth;
		const h = this.bgSurface.displayHeight;
		if (w <= 0 || h <= 0) {
			this.lastHookSurfaceContact = false;
			return;
		}

		const left = this.bgSurface.x - w * 0.5;
		const top = this.bgSurface.y - h * 0.5;
		const right = left + w;
		const bottom = top + h;

		const insideX = hookX >= left && hookX <= right;
		const contactBand = 10;
		const inContact = insideX && hookY >= bottom && hookY <= bottom + contactBand;

		if (inContact && !this.lastHookSurfaceContact) {
			this.playHookSplash(hookX, hookY);
		}

		this.lastHookSurfaceContact = inContact;
	}

	private playHookSplash(hookX: number, hookY: number): void {
		const scene = this.sceneRef as any;
		if (!scene) return;
		try {
			const textures: any = scene.textures;
			if (!textures || typeof textures.exists !== 'function' || !textures.exists(this.hookSplashTextureKey)) {
				return;
			}
		} catch {
			return;
		}
		const x = hookX + this.hookSplashModifiers.offsetX;
		const y = hookY + this.hookSplashModifiers.offsetY;
		let img: Phaser.GameObjects.Image | undefined;
		try {
			img = scene.add.image(x, y, this.hookSplashTextureKey).setOrigin(0.5, 1);
			if (!img) {
				return;
			}
			img.setScrollFactor(0);
			img.setAlpha(0);
			const baseScale = (scene.scale.width / 1920) * this.hookSplashModifiers.scale;
			img.setScale(baseScale * 1.05, baseScale * 0.2);
			const seaDepth = (this.seaEdge && typeof (this.seaEdge as any).depth === 'number') ? (this.seaEdge as any).depth : 892;
			img.setDepth(seaDepth - 1);
			const y0 = y;
			scene.tweens.chain({
				targets: img,
				tweens: [
					{
						alpha: 1,
						scaleY: baseScale * 1.55,
						y: y0 - 8,
						duration: 140,
						ease: 'Sine.Out',
					},
					{
						alpha: 0,
						scaleX: baseScale * 1.25,
						scaleY: baseScale * 1.05,
						y: y0 - 14,
						duration: 240,
						ease: 'Sine.In',
						onComplete: () => {
							try { img?.destroy(); } catch {}
						}
					}
				]
			});
		} catch {
			try { img?.destroy(); } catch {}
		}
	}

	setCharacterLayout(options: { offsetX?: number; offsetY?: number; scale?: number }): void {
		if (typeof options.offsetX === 'number') {
			this.characterModifiers.offsetX = options.offsetX;
		}
		if (typeof options.offsetY === 'number') {
			this.characterModifiers.offsetY = options.offsetY;
		}
		if (typeof options.scale === 'number' && isFinite(options.scale) && options.scale > 0) {
			this.characterModifiers.scale = options.scale;
		}
		try {
			if (this.sceneRef) {
				this.applyCharacterTransform(this.sceneRef);
			}
		} catch {}
	}

	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		const bgDepth = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Bonus-Depth'
		).setOrigin(0.5, 0.5);
		this.bgDepth = bgDepth;

		const bgFog = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Fog'
		).setOrigin(0.5, 0.5);
		this.bgFog = bgFog;
		bgFog.setDepth(900);
		bgFog.setAlpha(this.fogBackgroundModifiers.opacity);

		const bgSky = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-Bonus-Sky'
		).setOrigin(0.5, 0.5);
		this.bgSky = bgSky;

		const bgSurface = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Bonus-Surface'
		).setOrigin(0.5, 0.5);
		this.bgSurface = bgSurface;

		this.bgContainer.add(bgSky);
		this.bgContainer.add(bgSurface);
		this.bgContainer.add(bgDepth);

		const scaleDepthX = scene.scale.width / bgDepth.width;
		const scaleDepthY = scene.scale.height / bgDepth.height;
		const depthCoverBase = Math.max(scaleDepthX, scaleDepthY) * this.depthBackgroundModifiers.scale;
		bgDepth.setScale(
			depthCoverBase * this.depthBackgroundModifiers.scaleXMultiplier,
			depthCoverBase * this.depthBackgroundModifiers.scaleYMultiplier
		);

		const scaleFogX = scene.scale.width / bgFog.width;
		const scaleFogY = scene.scale.height / bgFog.height;
		const fogCoverBase = Math.max(scaleFogX, scaleFogY) * this.fogBackgroundModifiers.scale;
		bgFog.setScale(
			fogCoverBase * this.fogBackgroundModifiers.scaleXMultiplier,
			fogCoverBase * this.fogBackgroundModifiers.scaleYMultiplier
		);

		const scaleSurfaceX = scene.scale.width / bgSurface.width;
		const scaleSurfaceY = scene.scale.height / bgSurface.height;
		const surfaceCoverBase = Math.max(scaleSurfaceX, scaleSurfaceY) * this.surfaceBackgroundModifiers.scale;
		bgSurface.setScale(
			surfaceCoverBase * this.surfaceBackgroundModifiers.scaleXMultiplier,
			surfaceCoverBase * this.surfaceBackgroundModifiers.scaleYMultiplier
		);

		const scaleSkyX = scene.scale.width / bgSky.width;
		const scaleSkyY = scene.scale.height / bgSky.height;
		const skyCoverBase = Math.max(scaleSkyX, scaleSkyY) * this.skyBackgroundModifiers.scale;
		bgSky.setScale(
			skyCoverBase * this.skyBackgroundModifiers.scaleXMultiplier,
			skyCoverBase * this.skyBackgroundModifiers.scaleYMultiplier
		);

		const baseDepthX = scene.scale.width * 0.5;
		const baseDepthY = scene.scale.height * 0.9;
		bgDepth.setPosition(
			baseDepthX + this.depthBackgroundModifiers.offsetX,
			baseDepthY + this.depthBackgroundModifiers.offsetY
		);

		const baseFogX = scene.scale.width * 0.5;
		const baseFogY = scene.scale.height * 0.0 + scene.scale.height * 0.9;
		bgFog.setPosition(
			baseFogX + this.fogBackgroundModifiers.offsetX,
			baseFogY + this.fogBackgroundModifiers.offsetY
		);

		const baseSurfaceX = scene.scale.width * 0.5;
		const baseSurfaceY = scene.scale.height * 0.9;
		bgSurface.setPosition(
			baseSurfaceX + this.surfaceBackgroundModifiers.offsetX,
			baseSurfaceY + this.surfaceBackgroundModifiers.offsetY
		);
		this.createRippleVfxSpine(scene, bgSurface);

		const baseSkyX = scene.scale.width * 0.5;
		const baseSkyY = scene.scale.height * 0.5;
		bgSky.setPosition(
			baseSkyX + this.skyBackgroundModifiers.offsetX,
			baseSkyY + this.skyBackgroundModifiers.offsetY
		);

		const seaEdgeY = scene.scale.height * 0.5;
		const seaEdge = scene.add.image(
			scene.scale.width * 0.5,
			seaEdgeY,
			'Sea-Edge-Bonus'
		).setOrigin(0.5, 5.0);
		this.seaEdge = seaEdge;
		const seaEdgeScaleBase = scene.scale.width / seaEdge.width;
		const seaEdgeScale = seaEdgeScaleBase * assetScale;
		seaEdge.setScale(seaEdgeScale * this.seaEdgeWidthMultiplier, seaEdgeScale);
		seaEdge.setDepth(892);

		this.createCharacterSpine(scene);
		this.createReelBottomSpine(scene);
		this.applyWaterPipelines(scene);
	}

	private createRippleVfxSpine(scene: Scene, bgSurface?: Phaser.GameObjects.Image): void {
		const context = "[BonusBackground] createRippleVfxSpine";
		try {
			try { this.rippleVfxSpine?.destroy(); } catch {}
			this.rippleVfxSpine = undefined;

			const hasFactory = ensureSpineFactory(scene, context);
			if (!hasFactory) {
				console.warn(`${context}: Spine factory not available; skipping Ripple_VFX_TB.`);
				return;
			}
			const jsonCache: any = (scene.cache as any).json;
			const hasJson = typeof jsonCache?.has === "function" && jsonCache.has("Ripple_VFX_TB");
			console.log(`${context}: hasJson=${hasJson}`);
			if (!hasJson) {
				console.warn(`${context}: Spine JSON not found in cache for key Ripple_VFX_TB; ensure background assets are preloaded.`);
				return;
			}

			const baseX = bgSurface?.x ?? (scene.scale.width * 0.5);
			const baseY = bgSurface?.y ?? (scene.scale.height * 0.9);
			const x = baseX + this.rippleVfxModifiers.offsetX;
			const y = baseY + this.rippleVfxModifiers.offsetY;

			this.rippleVfxSpine = (scene.add as any).spine(
				x,
				y,
				"Ripple_VFX_TB",
				"Ripple_VFX_TB-atlas"
			);
			try {
				if (this.bgContainer) {
					const containerAny: any = this.bgContainer as any;
					const hasAddAt = typeof containerAny.addAt === 'function';
					const hasGetIndex = typeof containerAny.getIndex === 'function';
					const surfaceIndex = (bgSurface && hasGetIndex) ? containerAny.getIndex(bgSurface) : -1;
					if (bgSurface && hasAddAt && surfaceIndex >= 0) {
						containerAny.addAt(this.rippleVfxSpine, surfaceIndex + 1);
					} else {
						this.bgContainer.add(this.rippleVfxSpine);
					}
				}
			} catch {}
			if (typeof this.rippleVfxSpine.setScrollFactor === "function") {
				this.rippleVfxSpine.setScrollFactor(0);
			}

			let baseScale = (scene.scale.width / 1920) * this.rippleVfxModifiers.scale;
			try {
				const spineAny: any = this.rippleVfxSpine;
				if (bgSurface && typeof spineAny.getBounds === "function") {
					try { spineAny.update?.(0); } catch {}
					const b = spineAny.getBounds();
					const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
					if (sizeX > 0 && typeof bgSurface.displayWidth === 'number' && bgSurface.displayWidth > 0) {
						baseScale = (bgSurface.displayWidth / sizeX) * this.rippleVfxModifiers.scale;
					}
				}
			} catch {}
			this.rippleVfxSpine.setScale(baseScale);

			try {
				const spineAny: any = this.rippleVfxSpine;
				const animations: any[] | undefined = spineAny?.skeleton?.data?.animations;
				let animName: string = "Ripple_VFX_TB_idle";
				if (Array.isArray(animations) && animations.length > 0) {
					const preferred = ["Ripple_VFX_TB_idle", "idle", "Idle", "IDLE", "animation", "Animation"];
					const found = preferred.find(name => animations.some(a => a && a.name === name));
					animName = found ?? (animations[0].name ?? animName);
				}
				if (spineAny.animationState && typeof spineAny.animationState.setAnimation === "function") {
					spineAny.animationState.setAnimation(0, animName, true);
				}
				console.log(`${context}: playing animation '${animName}' for Ripple_VFX_TB`);
			} catch (_e) {}
			console.log(`${context}: created Ripple_VFX_TB at (${x}, ${y}) scale=${baseScale}`);
		} catch (e) {
			console.error(`${context}: Failed to create Ripple_VFX_TB spine`, e);
		}
	}

	private createReelBottomSpine(scene: Scene): void {
		const context = "[BonusBackground] createReelBottomSpine";
		try {
			const hasFactory = ensureSpineFactory(scene, context);
			if (!hasFactory) {
				console.warn(`${context}: Spine factory not available; skipping ReelBottom_Bonus_TB.`);
				return;
			}
			const jsonCache: any = (scene.cache as any).json;
			const hasJson = typeof jsonCache?.has === "function" && jsonCache.has("ReelBottom_Bonus_TB");
			console.log(`${context}: hasJson=${hasJson}`);
			if (!hasJson) {
				console.warn(`${context}: Spine JSON not found in cache for key ReelBottom_Bonus_TB; ensure background assets are preloaded.`);
				return;
			}
			const centerX = scene.scale.width * 0.5 + this.reelBottomModifiers.offsetX;
			const baseY = scene.scale.height * 0.78 + this.reelBottomModifiers.offsetY;
			this.reelBottomSpine = (scene.add as any).spine(
				centerX,
				baseY,
				"ReelBottom_Bonus_TB",
				"ReelBottom_Bonus_TB-atlas"
			);
			const baseScale = (scene.scale.width / 1920) * this.reelBottomModifiers.scale;
			this.reelBottomSpine.setScale(baseScale);
			this.reelBottomSpine.setDepth(900);
			if (typeof this.reelBottomSpine.setScrollFactor === "function") {
				this.reelBottomSpine.setScrollFactor(0);
			}
			try {
				const spineAny: any = this.reelBottomSpine;
				if (typeof spineAny.getBounds === "function") {
					try { spineAny.update?.(0); } catch {}
					const b = spineAny.getBounds();
					const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
					const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
					const offX = (b?.offset?.x ?? 0);
					const offY = (b?.offset?.y ?? 0);
					if (sizeX > 0 && sizeY > 0) {
						const centerWorldX = offX + sizeX * 0.5;
						const centerWorldY = offY + sizeY * 0.5;
						const dx = centerX - centerWorldX;
						const dy = baseY - centerWorldY;
						spineAny.x += dx;
						spineAny.y += dy;
					}
				}
			} catch {}
			try {
				const spineAny: any = this.reelBottomSpine;
				const animations: any[] | undefined = spineAny?.skeleton?.data?.animations;
				let idleName: string = "animation";
				if (Array.isArray(animations) && animations.length > 0) {
					const preferred = ["idle", "Idle", "IDLE", "animation", "Animation"];
					const found = preferred.find(name => animations.some(a => a && a.name === name));
					idleName = found ?? (animations[0].name ?? idleName);
				}
				if (spineAny.animationState && typeof spineAny.animationState.setAnimation === "function") {
					spineAny.animationState.setAnimation(0, idleName, true);
				}
				console.log(`${context}: playing idle animation '${idleName}' for ReelBottom_Bonus_TB`);
			} catch (_e) {}
			console.log(`${context}: created ReelBottom_Bonus_TB at (${centerX}, ${baseY}) scale=${baseScale}`);
		} catch (e) {
			console.error(`${context}: Failed to create ReelBottom_Bonus_TB spine`, e);
		}
	}

	private createCharacterSpine(scene: Scene): void {
		const context = "[BonusBackground] createCharacterSpine";
		try {
			try { this.characterSpine?.destroy(); } catch {}
			this.characterSpine = undefined;

			const hasFactory = ensureSpineFactory(scene, context);
			if (!hasFactory) {
				console.warn(`${context}: Spine factory not available; skipping Character_TB.`);
				return;
			}
			const jsonCache: any = (scene.cache as any).json;
			const hasJson = typeof jsonCache?.has === "function" && jsonCache.has("Character_TB");
			console.log(`${context}: hasJson=${hasJson}`);
			if (!hasJson) {
				console.warn(`${context}: Spine JSON not found in cache for key Character_TB; ensure background assets are preloaded.`);
				return;
			}
			const centerX = scene.scale.width * 0.5 + this.characterModifiers.offsetX;
			const baseY = scene.scale.height * 0.5 + this.characterModifiers.offsetY;
			this.characterSpine = (scene.add as any).spine(
				centerX,
				baseY,
				"Character_TB",
				"Character_TB-atlas"
			);
			const baseScale = (scene.scale.width / 1920) * this.characterModifiers.scale;
			this.characterSpine.setScale(baseScale);
			this.characterSpine.setDepth(883);
			if (typeof this.characterSpine.setScrollFactor === "function") {
				this.characterSpine.setScrollFactor(0);
			}
			try { this.applyCharacterTransform(scene); } catch {}
			try {
				const spineAny: any = this.characterSpine;
				const animations: any[] | undefined = spineAny?.skeleton?.data?.animations;
				let idleName: string = "Character_TB_idle";
				if (Array.isArray(animations) && animations.length > 0) {
					const preferred = ["Character_TB_idle", "idle", "Idle", "IDLE", "animation", "Animation"];
					const found = preferred.find(name => animations.some(a => a && a.name === name));
					idleName = found ?? (animations[0].name ?? idleName);
				}
				if (spineAny.animationState && typeof spineAny.animationState.setAnimation === "function") {
					spineAny.animationState.setAnimation(0, idleName, true);
				}
				console.log(`${context}: playing idle animation '${idleName}' for Character_TB`);
			} catch (_e) {}
			console.log(`${context}: created Character_TB at (${centerX}, ${baseY}) scale=${baseScale}`);
		} catch (e) {
			console.error(`${context}: Failed to create Character_TB spine`, e);
		}
	}

	private alignSpineToTarget(spine: any, targetX: number, targetY: number): void {
		try {
			const spineAny: any = spine;
			if (!spineAny || typeof spineAny.getBounds !== 'function') {
				return;
			}
			try { spineAny.update?.(0); } catch {}
			const b = spineAny.getBounds();
			const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
			const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
			const offX = (b?.offset?.x ?? 0);
			const offY = (b?.offset?.y ?? 0);
			if (sizeX > 0 && sizeY > 0) {
				const centerWorldX = offX + sizeX * 0.5;
				const centerWorldY = offY + sizeY * 0.5;
				spineAny.x += (targetX - centerWorldX);
				spineAny.y += (targetY - centerWorldY);
			}
		} catch {}
	}

	private applyCharacterTransform(scene: Scene): void {
		if (!this.characterSpine) {
			return;
		}
		const centerX = scene.scale.width * 0.5 + this.characterModifiers.offsetX;
		const baseY = scene.scale.height * 0.5 + this.characterModifiers.offsetY;
		const baseScale = (scene.scale.width / 1920) * this.characterModifiers.scale;
		try { this.characterSpine.setScale(baseScale); } catch {}
		try { this.characterSpine.setPosition(centerX, baseY); } catch {}
		try { this.alignSpineToTarget(this.characterSpine, centerX, baseY); } catch {}
	}

	private applyWaterPipelines(scene: Scene): void {
		const renderer: any = scene.game.renderer;
		const pipelineManager: any = renderer && renderer.pipelines;
		if (!pipelineManager || typeof pipelineManager.add !== 'function') return;
		try {
			const store = pipelineManager.pipelines;
			const hasVerticalEdge = store && typeof store.has === 'function' && store.has('WaterWaveVerticalSeaEdge');
			const hasDepth = store && typeof store.has === 'function' && store.has('WaterWaveDepth');
			const hasSurface = store && typeof store.has === 'function' && store.has('WaterWaveSurface');
			if (!hasVerticalEdge) {
				pipelineManager.add('WaterWaveVerticalSeaEdge', new WaterWaveVerticalPipeline(scene.game, {
					amplitude: 0.015,
					frequency: 15.0,
					speed: 6
				}));
			}
			if (!hasDepth) {
				pipelineManager.add('WaterWaveDepth', new WaterWavePipeline(scene.game, {
					amplitude: 0.02,
					frequency: 10.0,
					speed: 2.0
				}));
			}
			if (!hasSurface) {
				pipelineManager.add('WaterWaveSurface', new WaterRipplePipeline(scene.game, {
					waveAmplitude: 0.015,
					waveFrequency: .2,
					waveSpeed: 1.5,
					rippleAmplitude: 0.0,
					rippleFrequency: 1.0,
					rippleSpeed: 17.5,
					rippleDecay: 0.2
				}));
			}
		} catch (_e) {}
		try { this.seaEdge?.setPipeline('WaterWaveVerticalSeaEdge'); } catch {}
		try { this.bgDepth?.setPipeline('WaterWaveDepth'); } catch {}
		try { this.bgSurface?.setPipeline('WaterWaveSurface'); } catch {}
		try { (this.bgSky as any)?.resetPipeline?.(); } catch {}
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		try { this.applyCharacterTransform(scene); } catch {}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	public darkenDepthForWinSequence(): void {
		try {
			if (!this.bgDepth || !this.sceneRef) {
				return;
			}
			const scene: any = this.sceneRef;
			const depth: any = this.bgDepth as any;
			try {
				if (typeof depth.__winOriginalAlpha !== 'number') {
					depth.__winOriginalAlpha = typeof depth.alpha === 'number' ? depth.alpha : 1;
				}
				if (typeof depth.__winOriginalTint !== 'number') {
					const currentTint: number = (depth.tintTopLeft as number) ?? 0xffffff;
					depth.__winOriginalTint = currentTint;
				}
			} catch {}
			try { scene.tweens?.killTweensOf?.(depth); } catch {}
			try {
				const pipelineAny: any = (depth as any).pipeline;
				if (pipelineAny) {
					try { scene.tweens?.killTweensOf?.(pipelineAny); } catch {}
					try {
						scene.tweens.add({
							targets: pipelineAny,
							darkenFactor: 0.6,
							duration: 800,
							ease: 'Sine.easeOut',
						});
					} catch {}
				}
			} catch {}
			const baseAlpha = typeof depth.alpha === 'number' ? depth.alpha : 1;
			const targetAlpha = Math.max(0, Math.min(1, baseAlpha * 0.7));
			try {
				if (typeof depth.setTint === 'function') {
					depth.setTint(0x202020);
				}
			} catch {}
			try {
				scene.tweens.add({
					targets: depth,
					alpha: targetAlpha,
					duration: 800,
					ease: 'Sine.easeOut',
				});
			} catch {}
		} catch {}
	}

	public restoreDepthAfterWinSequence(): void {
		try {
			if (!this.bgDepth || !this.sceneRef) {
				return;
			}
			const scene: any = this.sceneRef;
			const depth: any = this.bgDepth as any;
			const origAlpha =
				typeof depth.__winOriginalAlpha === 'number'
					? depth.__winOriginalAlpha
					: (typeof depth.alpha === 'number' ? depth.alpha : 1);
			const origTint: number | undefined =
				typeof depth.__winOriginalTint === 'number'
					? depth.__winOriginalTint
					: undefined;
			try { scene.tweens?.killTweensOf?.(depth); } catch {}
			try {
				const pipelineAny: any = (depth as any).pipeline;
				if (pipelineAny) {
					try { scene.tweens?.killTweensOf?.(pipelineAny); } catch {}
					try {
						scene.tweens.add({
							targets: pipelineAny,
							darkenFactor: 0.0,
							duration: 600,
							ease: 'Sine.easeOut',
						});
					} catch {}
				}
			} catch {}
			try {
				scene.tweens.add({
					targets: depth,
					alpha: origAlpha,
					duration: 600,
					ease: 'Sine.easeOut',
					onComplete: () => {
						try {
							if (typeof depth.setTint === 'function') {
								if (typeof origTint === 'number') {
									depth.setTint(origTint);
								} else if (typeof depth.clearTint === 'function') {
									depth.clearTint();
								}
							}
						} catch {}
						try { delete depth.__winOriginalAlpha; } catch {}
						try { delete depth.__winOriginalTint; } catch {}
					},
				});
			} catch {}
		} catch {}
	}

	getCharacterSpine(): any | undefined {
		return this.characterSpine;
	}

	setVisible(visible: boolean): void {
		try { this.bgContainer?.setVisible(visible); } catch {}
		try { this.bgFog?.setVisible(visible); } catch {}
		try { this.seaEdge?.setVisible(visible); } catch {}
		try { this.reelBottomSpine?.setVisible(visible); } catch {}
		try { this.characterSpine?.setVisible(visible); } catch {}
		try { this.rippleVfxSpine?.setVisible(visible); } catch {}
	}

	destroy(): void {
		try { this.bgContainer?.destroy(); } catch {}
		try { this.seaEdge?.destroy(); } catch {}
		try { this.reelBottomSpine?.destroy(); } catch {}
		try { this.characterSpine?.destroy(); } catch {}
		try { this.rippleVfxSpine?.destroy(); } catch {}
		this.sceneRef = null;
	}
}


