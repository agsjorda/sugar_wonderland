 import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { WaterWavePipeline, WaterWaveVerticalPipeline, WaterRipplePipeline } from "../pipelines/WaterWavePipeline";
import { BubbleParticleSystem, BubbleParticleModifiers } from "./BubbleParticleSystem";
import { BubbleStreamSystem } from "./BubbleStreamSystem";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class Background {
 	private bgContainer!: Phaser.GameObjects.Container;
 	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private sceneRef: Scene | null = null;
	private seaEdgeWidthMultiplier: number = 1.1;
	private bubbleSystem?: BubbleParticleSystem;
	private bubbleStreamSystems: BubbleStreamSystem[] = [];
	private readonly SCREEN_MARGIN: number = 80;
	private readonly bubbleStreamModifiers = [
		{ offsetX: -195, offsetY: 90 },
		{ offsetX: -110, offsetY: 90 },
		{ offsetX: -35, offsetY: 90 },
		{ offsetX: 45, offsetY: 90 },
		{ offsetX: 120, offsetY: 90 },
		{ offsetX: 200, offsetY: 90 },
	];
	private bgDepth?: Phaser.GameObjects.Image;
	private bgSurface?: Phaser.GameObjects.Image;
	private bgSky?: Phaser.GameObjects.Image;
	private reelBottomSpine?: any;
	private characterSpine?: any;
	private depthWavePipeline?: WaterWavePipeline;
	private surfaceWavePipeline?: WaterRipplePipeline;
	private surfaceRippleElapsed: number = 0;
	private readonly SURFACE_RIPPLE_INTERVAL_MS: number = 2000;
	private enableAutoSurfaceRipple: boolean = false;
	private lastHookSurfaceContact: boolean = false;
	private surfaceRippleModifiers = {
		amplitude: 0.035,
		frequency: 35.0,
		speed: 17.5,
		decay: 0.8,
	};
	private seaEdgeWavePipeline?: WaterWaveVerticalPipeline;
	private seaEdgeBaseWaveAmplitude: number = 0.015;
	private seaEdgeWaveAmplitude: number = 0.015;
	private readonly SEA_EDGE_WAVE_AMPLITUDE_MULTIPLIER: number = 3.0;
	private readonly SEA_EDGE_WAVE_IMPULSE: number = 0.02;
	private readonly SEA_EDGE_WAVE_DECAY_PER_SECOND: number = 1.5;
	private readonly depthBackgroundModifiers = {
		offsetX: 0,
		offsetY: -410,
		scale: 1,
 		scaleXMultiplier: 1,
 		scaleYMultiplier: 0.8,
 	};
 	private readonly surfaceBackgroundModifiers = {
 		offsetX: 0,
 		offsetY: -369.5,
 		scale: 1,
 		scaleXMultiplier: 1,
 		scaleYMultiplier: 1,
 	};
 	private readonly skyBackgroundModifiers = {
 		offsetX: 0,
 		offsetY: 0,
 		scale: 1,
 		scaleXMultiplier: 1,
 		scaleYMultiplier: 1,
 	};
	private readonly reelBottomModifiers = {
		offsetX: 0,
		offsetY: -112,
		scale: 4,
	};
	private readonly characterModifiers = {
		offsetX: -50,
		offsetY: -345,
		scale: 0.65,
	};
	private enableWaterPipelines: boolean = true;
	private enableBubbleEffects: boolean = true;
	private bubbleParticleImageScale: number = 0.01;
	private bubbleStreamImageScale: number = 0.005;
	private enableBackgroundSpineDecorations: boolean = true;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Background] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Background] Creating background elements");
		this.sceneRef = scene;
		
		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);
		// Ensure background renders beneath base symbols background (-5)
		this.bgContainer.setDepth(-10);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		// Add background layers
		this.createBackgroundLayers(scene, assetScale);
		// (Spine-based border is handled by `Symbols` component)
		if (this.enableBubbleEffects) {
			this.bubbleSystem = new BubbleParticleSystem(scene, -9, {
				count: 5,
				speedMin: 0.2,
				speedMax: 0.2,
				lifeMin: 6000,
				lifeMax: 16000,
				screenMargin: this.SCREEN_MARGIN,
				spawnPerSecond: 100,
				maskLeft: 0,
				maskRight: 0,
				maskTop: 280,
				maskBottom: 250,
				showMaskDebug: false,
				burstOnStart: false,
				opacityMin: 0.4,
				opacityMax: 1,
				textureKey: 'bubble',
				imageScale: this.bubbleParticleImageScale,
			});

			const baseStreamCenterX = scene.scale.width * 0.5;
			const baseStreamCenterY = scene.scale.height * 0.5;
			this.bubbleStreamSystems = [];
			for (let i = 0; i < this.bubbleStreamModifiers.length; i++) {
				const mods = this.bubbleStreamModifiers[i];
				const streamCenterX = baseStreamCenterX + mods.offsetX;
				const streamCenterY = baseStreamCenterY + mods.offsetY;
				const stream = new BubbleStreamSystem(scene, {
					x: streamCenterX,
					y: streamCenterY,
					depth: 878,
					count: 100,
					spawnPerSecond: 1.2,
					speedMin: 10,
					speedMax: 10,
					opacityMin: 0.2,
					opacityMax: 0.4,
					maskLeft: 0,
					maskRight: 0,
					maskTop: 280,
					radiusMin: 0.5,
					radiusMax: 3,
					maskBottom: 250,
					showMaskDebug: false,
					textureKey: 'bubble',
					imageScale: this.bubbleStreamImageScale,
				});
				this.bubbleStreamSystems.push(stream);
			}
			scene.events.on('update', this.handleUpdate, this);
			scene.events.once('shutdown', () => {
				try { scene.events.off('update', this.handleUpdate, this); } catch {}
				try { this.bubbleSystem?.destroy(); } catch {}
				try {
					for (const stream of this.bubbleStreamSystems) {
						try { stream.destroy(); } catch {}
					}
					this.bubbleStreamSystems = [];
				} catch {}
			});
		}
		
		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);
		
		// Add UI elements
		//this.createUIElements(scene, assetScale);
	}


	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		// Depth layer (behind)
		const bgDepth = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Depth'
		).setOrigin(0.5, 0.5);
		this.bgDepth = bgDepth;

		// Sky layer (in front, with its own offset)
		const bgSky = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-Sky'
		).setOrigin(0.5, 0.5);
		this.bgSky = bgSky;

		// Surface layer (between depth and sky)
		const bgSurface = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Surface'
		).setOrigin(0.5, 0.5);
		this.bgSurface = bgSurface;

		// Add to container back-to-front: Sky -> Surface -> Depth
		this.bgContainer.add(bgSky);
		this.bgContainer.add(bgSurface);
		this.bgContainer.add(bgDepth);

		// Scale both to cover viewport
		const scaleDepthX = scene.scale.width / bgDepth.width;
		const scaleDepthY = scene.scale.height / bgDepth.height;
		const depthCoverBase = Math.max(scaleDepthX, scaleDepthY) * this.depthBackgroundModifiers.scale;
		bgDepth.setScale(
			depthCoverBase * this.depthBackgroundModifiers.scaleXMultiplier,
			depthCoverBase * this.depthBackgroundModifiers.scaleYMultiplier
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

		// Apply per-layer offsets (tweak as needed)
		const baseDepthX = scene.scale.width * 0.5;
		const baseDepthY = scene.scale.height * 0.9;
		bgDepth.setPosition(
			baseDepthX + this.depthBackgroundModifiers.offsetX,
			baseDepthY + this.depthBackgroundModifiers.offsetY
		);
		const baseSurfaceX = scene.scale.width * 0.5;
		const baseSurfaceY = scene.scale.height * 0.9;
		bgSurface.setPosition(
			baseSurfaceX + this.surfaceBackgroundModifiers.offsetX,
			baseSurfaceY + this.surfaceBackgroundModifiers.offsetY
		);
		const baseSkyX = scene.scale.width * 0.5;
		const baseSkyY = scene.scale.height * 0.5;
		bgSky.setPosition(
			baseSkyX + this.skyBackgroundModifiers.offsetX,
			baseSkyY + this.skyBackgroundModifiers.offsetY
		);
		if (this.enableBackgroundSpineDecorations) {
			this.createCharacterSpine(scene);
			this.createReelBottomSpine(scene);
		}

		const seaEdgeY = scene.scale.height * 0.5;
		const seaEdge = scene.add.image(
			scene.scale.width * 0.5,
			seaEdgeY,
			'Sea-Edge'
		).setOrigin(0.5, 5.0);
		const seaEdgeScaleBase = scene.scale.width / seaEdge.width;
		const seaEdgeScale = seaEdgeScaleBase * assetScale;
		seaEdge.setScale(seaEdgeScale * this.seaEdgeWidthMultiplier, seaEdgeScale);
		// Place Sea-Edge above the reel slot background (depth 880) but below controller UI (900)
		seaEdge.setDepth(892);

		if (this.enableWaterPipelines) {
			const renderer: any = scene.game.renderer;
			const pipelineManager: any = renderer && renderer.pipelines;
			if (pipelineManager && typeof pipelineManager.add === 'function') {
				try {
					const store = pipelineManager.pipelines;
					const hasVerticalEdge = store && typeof store.has === 'function' && store.has('WaterWaveVerticalSeaEdge');
					const hasDepth = store && typeof store.has === 'function' && store.has('WaterWaveDepth');
					const hasSurface = store && typeof store.has === 'function' && store.has('WaterWaveSurface');
					if (!hasVerticalEdge) {
						const seaEdgePipeline = new WaterWaveVerticalPipeline(scene.game, {
							amplitude: this.seaEdgeBaseWaveAmplitude,
							frequency: 15.0,
							speed: 6
						});
						pipelineManager.add('WaterWaveVerticalSeaEdge', seaEdgePipeline);
						this.seaEdgeWavePipeline = seaEdgePipeline;
						this.seaEdgeWaveAmplitude = this.seaEdgeBaseWaveAmplitude;
					} else if (renderer && typeof renderer.getPipeline === 'function') {
						try {
							const existingSeaEdge = renderer.getPipeline('WaterWaveVerticalSeaEdge');
							if (existingSeaEdge) {
								this.seaEdgeWavePipeline = existingSeaEdge as WaterWaveVerticalPipeline;
								this.seaEdgeWaveAmplitude = this.seaEdgeBaseWaveAmplitude;
							}
						} catch (_getVerticalEdgeErr) {}
					}
					if (!hasDepth) {
						const depthWave = new WaterWavePipeline(scene.game, {
							amplitude: 0.02,
							frequency: 10.0,
							speed: 2.0
						});
						pipelineManager.add('WaterWaveDepth', depthWave);
						this.depthWavePipeline = depthWave;
					} else if (renderer && typeof renderer.getPipeline === 'function') {
						try {
							const existingDepth = renderer.getPipeline('WaterWaveDepth');
							if (existingDepth) {
								this.depthWavePipeline = existingDepth as WaterWavePipeline;
							}
						} catch (_getDepthErr) {}
					}
					if (!hasSurface) {
						const surfaceWave = new WaterRipplePipeline(scene.game, {
							waveAmplitude: 0.015,
							waveFrequency: .2,
							waveSpeed: 1.5,
							rippleAmplitude: 0.0,
							rippleFrequency: 1.0,
							rippleSpeed: 17.5,
							rippleDecay: 0.2
						});
						pipelineManager.add('WaterWaveSurface', surfaceWave);
						this.surfaceWavePipeline = surfaceWave;
					} else if (renderer && typeof renderer.getPipeline === 'function') {
						try {
							const existingSurface = renderer.getPipeline('WaterWaveSurface');
							if (existingSurface) {
								this.surfaceWavePipeline = existingSurface as WaterRipplePipeline;
							}
						} catch (_getSurfaceErr) {}
					}
				} catch (_e) {}
				seaEdge.setPipeline('WaterWaveVerticalSeaEdge');
				if (this.bgDepth) {
					this.bgDepth.setPipeline('WaterWaveDepth');
				}
				if (this.bgSurface) {
					this.bgSurface.setPipeline('WaterWaveSurface');
				}
			}
		}

		// Optional tiny padding if desired to avoid edge seams
		// bg.setScale(bg.scaleX * 1.02, bg.scaleY * 1.02);

		// Add reel frame (kept as-is, initially hidden alpha)
	}

	private createCharacterSpine(scene: Scene): void {
		const context = "[Background] createCharacterSpine";
		try {
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
			// Above background container (-10) but behind base overlay (-5) and reels/UI
			this.characterSpine.setDepth(883);
			if (typeof this.characterSpine.setScrollFactor === "function") {
				this.characterSpine.setScrollFactor(0);
			}
			try {
				const spineAny: any = this.characterSpine;
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

	private createReelBottomSpine(scene: Scene): void {
		const context = "[Background] createReelBottomSpine";
		try {
			const hasFactory = ensureSpineFactory(scene, context);
			if (!hasFactory) {
				console.warn(`${context}: Spine factory not available; skipping ReelBottom_Normal_TB.`);
				return;
			}
			const jsonCache: any = (scene.cache as any).json;
			const hasJson = typeof jsonCache?.has === "function" && jsonCache.has("ReelBottom_Normal_TB");
			console.log(`${context}: hasJson=${hasJson}`);
			if (!hasJson) {
				console.warn(`${context}: Spine JSON not found in cache for key ReelBottom_Normal_TB; ensure background assets are preloaded.`);
				return;
			}
			const centerX = scene.scale.width * 0.5 + this.reelBottomModifiers.offsetX;
			const baseY = scene.scale.height * 0.78 + this.reelBottomModifiers.offsetY;
			this.reelBottomSpine = (scene.add as any).spine(
				centerX,
				baseY,
				"ReelBottom_Normal_TB",
				"ReelBottom_Normal_TB-atlas"
			);
			const baseScale = (scene.scale.width / 1920) * this.reelBottomModifiers.scale;
			this.reelBottomSpine.setScale(baseScale);
			// Place between slot background (880) and Sea-Edge (885)
			this.reelBottomSpine.setDepth(879);
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
				console.log(`${context}: playing idle animation '${idleName}' for ReelBottom_Normal_TB`);
			} catch (_e) {}
			console.log(`${context}: created ReelBottom_Normal_TB at (${centerX}, ${baseY}) scale=${baseScale}`);
		} catch (e) {
			console.error(`${context}: Failed to create ReelBottom_Normal_TB spine`, e);
		}
	}

	private handleUpdate(_time: number, delta: number): void {
		if (!this.sceneRef) return;
		if (this.bubbleSystem) {
			this.bubbleSystem.update(delta);
		}
		for (const stream of this.bubbleStreamSystems) {
			stream.update(delta);
		}
		if (this.surfaceWavePipeline && this.enableAutoSurfaceRipple) {
			this.surfaceRippleElapsed += delta;
			if (this.surfaceRippleElapsed >= this.SURFACE_RIPPLE_INTERVAL_MS) {
				this.surfaceRippleElapsed -= this.SURFACE_RIPPLE_INTERVAL_MS;
				this.surfaceWavePipeline.triggerRippleAt(0.5, 0.5, {
					amplitude: 0.03,
					frequency: 35.0,
					speed: 17.5,
					decay: 0.8
				});
			}
		}
		if (this.seaEdgeWavePipeline) {
			const baseAmp = this.seaEdgeBaseWaveAmplitude;
			if (this.seaEdgeWaveAmplitude > baseAmp) {
				const dtSeconds = delta * 0.001;
				const diff = this.seaEdgeWaveAmplitude - baseAmp;
				const decayFactor = Math.exp(-this.SEA_EDGE_WAVE_DECAY_PER_SECOND * dtSeconds);
				this.seaEdgeWaveAmplitude = baseAmp + diff * decayFactor;
				this.seaEdgeWavePipeline.setAmplitude(this.seaEdgeWaveAmplitude);
			}
		}
	}

	public updateHookSurfaceInteraction(hookX: number, hookY: number): void {
		if (!this.bgSurface || !this.surfaceWavePipeline || !this.sceneRef) {
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
			const normX = (hookX - left) / w;
			const normY = (hookY - top) / h;
			const cfg = this.surfaceRippleModifiers;
			this.surfaceWavePipeline.triggerRippleAt(normX, normY, {
				amplitude: cfg.amplitude,
				frequency: cfg.frequency,
				speed: cfg.speed,
				decay: cfg.decay
			});
			if (this.seaEdgeWavePipeline) {
				const baseAmp = this.seaEdgeBaseWaveAmplitude;
				const maxAmp = baseAmp * this.SEA_EDGE_WAVE_AMPLITUDE_MULTIPLIER;
				this.seaEdgeWaveAmplitude = Math.min(
					maxAmp,
					this.seaEdgeWaveAmplitude + this.SEA_EDGE_WAVE_IMPULSE
				);
				this.seaEdgeWavePipeline.setAmplitude(this.seaEdgeWaveAmplitude);
			}
		}

		this.lastHookSurfaceContact = inContact;
	}

	public updateSurfaceRippleModifiers(mods: { amplitude?: number; frequency?: number; speed?: number; decay?: number }): void {
		if (typeof mods.amplitude === 'number') this.surfaceRippleModifiers.amplitude = mods.amplitude;
		if (typeof mods.frequency === 'number') this.surfaceRippleModifiers.frequency = mods.frequency;
		if (typeof mods.speed === 'number') this.surfaceRippleModifiers.speed = mods.speed;
		if (typeof mods.decay === 'number') this.surfaceRippleModifiers.decay = mods.decay;
	}

	updateSurfaceBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
		if (typeof mods.offsetX === 'number') this.surfaceBackgroundModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.surfaceBackgroundModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.surfaceBackgroundModifiers.scale = mods.scale;
		if (typeof mods.scaleXMultiplier === 'number') this.surfaceBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
		if (typeof mods.scaleYMultiplier === 'number') this.surfaceBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
		if (this.bgSurface && this.sceneRef) {
			const scaleSurfaceX = this.sceneRef.scale.width / this.bgSurface.width;
			const scaleSurfaceY = this.sceneRef.scale.height / this.bgSurface.height;
			const surfaceCoverBase = Math.max(scaleSurfaceX, scaleSurfaceY) * this.surfaceBackgroundModifiers.scale;
			this.bgSurface.setScale(
				surfaceCoverBase * this.surfaceBackgroundModifiers.scaleXMultiplier,
				surfaceCoverBase * this.surfaceBackgroundModifiers.scaleYMultiplier
			);

			const baseSurfaceX = this.sceneRef.scale.width * 0.5;
			const baseSurfaceY = this.sceneRef.scale.height * 0.9;
			this.bgSurface.setPosition(
				baseSurfaceX + this.surfaceBackgroundModifiers.offsetX,
				baseSurfaceY + this.surfaceBackgroundModifiers.offsetY
			);
		}
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		if (this.bubbleSystem) {
			this.bubbleSystem.resize();
		}
		if (this.bubbleStreamSystems.length > 0) {
			const baseStreamCenterX = scene.scale.width * 0.5;
			const baseStreamCenterY = scene.scale.height * 0.5;
			for (let i = 0; i < this.bubbleStreamSystems.length; i++) {
				const mods = this.bubbleStreamModifiers[i] ?? { offsetX: 0, offsetY: 0 };
				const streamCenterX = baseStreamCenterX + mods.offsetX;
				const streamCenterY = baseStreamCenterY + mods.offsetY;
				this.bubbleStreamSystems[i].setOrigin(streamCenterX, streamCenterY);
			}
		}
	}

	configureBubbleParticles(modifiers: BubbleParticleModifiers): void {
		if (this.bubbleSystem) {
			this.bubbleSystem.configure(modifiers);
		}
	}

	updateBubbleStreamModifier(index: number, mods: { offsetX?: number; offsetY?: number }): void {
		if (index < 0 || index >= this.bubbleStreamModifiers.length) {
			return;
		}
		const entry = this.bubbleStreamModifiers[index];
		if (typeof mods.offsetX === 'number') entry.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') entry.offsetY = mods.offsetY;
		if (this.sceneRef && this.bubbleStreamSystems[index]) {
			const baseStreamCenterX = this.sceneRef.scale.width * 0.5;
			const baseStreamCenterY = this.sceneRef.scale.height * 0.5;
			const streamCenterX = baseStreamCenterX + entry.offsetX;
			const streamCenterY = baseStreamCenterY + entry.offsetY;
			this.bubbleStreamSystems[index].setOrigin(streamCenterX, streamCenterY);
		}
	}

	updateDepthBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
		if (typeof mods.offsetX === 'number') this.depthBackgroundModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.depthBackgroundModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.depthBackgroundModifiers.scale = mods.scale;
		if (typeof mods.scaleXMultiplier === 'number') this.depthBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
		if (typeof mods.scaleYMultiplier === 'number') this.depthBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
		if (this.bgDepth && this.sceneRef) {
			const scaleDepthX = this.sceneRef.scale.width / this.bgDepth.width;
			const scaleDepthY = this.sceneRef.scale.height / this.bgDepth.height;
			const depthCoverBase = Math.max(scaleDepthX, scaleDepthY) * this.depthBackgroundModifiers.scale;
			this.bgDepth.setScale(
				depthCoverBase * this.depthBackgroundModifiers.scaleXMultiplier,
				depthCoverBase * this.depthBackgroundModifiers.scaleYMultiplier
			);

			const baseDepthX = this.sceneRef.scale.width * 0.5;
			const baseDepthY = this.sceneRef.scale.height * 0.9;
			this.bgDepth.setPosition(
				baseDepthX + this.depthBackgroundModifiers.offsetX,
				baseDepthY + this.depthBackgroundModifiers.offsetY
			);
		}
	}

	updateDepthWaveModifiers(mods: { amplitude?: number; frequency?: number; speed?: number }): void {
		if (!this.depthWavePipeline) {
			return;
		}
		if (typeof mods.amplitude === 'number') {
			this.depthWavePipeline.setAmplitude(mods.amplitude);
		}
		if (typeof mods.frequency === 'number') {
			this.depthWavePipeline.setFrequency(mods.frequency);
		}
		if (typeof mods.speed === 'number') {
			this.depthWavePipeline.setSpeed(mods.speed);
		}
	}

	updateSurfaceWaveModifiers(mods: { amplitude?: number; frequency?: number; speed?: number }): void {
		if (!this.surfaceWavePipeline) {
			return;
		}
		if (typeof mods.amplitude === 'number') {
			this.surfaceWavePipeline.setAmplitude(mods.amplitude);
		}
		if (typeof mods.frequency === 'number') {
			this.surfaceWavePipeline.setFrequency(mods.frequency);
		}
		if (typeof mods.speed === 'number') {
			this.surfaceWavePipeline.setSpeed(mods.speed);
		}
	}

	updateSkyBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
		if (typeof mods.offsetX === 'number') this.skyBackgroundModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.skyBackgroundModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.skyBackgroundModifiers.scale = mods.scale;
		if (typeof mods.scaleXMultiplier === 'number') this.skyBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
		if (typeof mods.scaleYMultiplier === 'number') this.skyBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
		if (this.bgSky && this.sceneRef) {
			const scaleSkyX = this.sceneRef.scale.width / this.bgSky.width;
			const scaleSkyY = this.sceneRef.scale.height / this.bgSky.height;
			const skyCoverBase = Math.max(scaleSkyX, scaleSkyY) * this.skyBackgroundModifiers.scale;
			this.bgSky.setScale(
				skyCoverBase * this.skyBackgroundModifiers.scaleXMultiplier,
				skyCoverBase * this.skyBackgroundModifiers.scaleYMultiplier
			);

			const baseSkyX = this.sceneRef.scale.width * 0.5;
			const baseSkyY = this.sceneRef.scale.height * 0.5;
			this.bgSky.setPosition(
				baseSkyX + this.skyBackgroundModifiers.offsetX,
				baseSkyY + this.skyBackgroundModifiers.offsetY
			);
		}
	}

	updateReelBottomModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number }): void {
		if (typeof mods.offsetX === 'number') this.reelBottomModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.reelBottomModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.reelBottomModifiers.scale = mods.scale;
		if (this.reelBottomSpine && this.sceneRef) {
			const reelBaseX = this.sceneRef.scale.width * 0.5 + this.reelBottomModifiers.offsetX;
			const reelBaseY = this.sceneRef.scale.height * 0.78 + this.reelBottomModifiers.offsetY;
			this.reelBottomSpine.x = reelBaseX;
			this.reelBottomSpine.y = reelBaseY;
			const baseScale = (this.sceneRef.scale.width / 1920) * this.reelBottomModifiers.scale;
			this.reelBottomSpine.setScale(baseScale);
		}
	}

	getCharacterSpine(): any | undefined {
		return this.characterSpine;
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	public darkenDepthForWinSequence(): void {
		try {
			if (!this.bgDepth || !this.sceneRef) {
				return;
			}
			const depth: any = this.bgDepth as any;
			const scene: any = this.sceneRef as any;
			try {
				if (typeof depth.__winOriginalAlpha !== 'number') {
					depth.__winOriginalAlpha = typeof depth.alpha === 'number' ? depth.alpha : 1;
				}
				if (typeof depth.__winOriginalTint !== 'number') {
					// Use the current tint if present, otherwise default to white
					const currentTint: number = (depth.tintTopLeft as number) ?? 0xffffff;
					depth.__winOriginalTint = currentTint;
				}
			} catch {}
			try { scene.tweens?.killTweensOf?.(depth); } catch {}
			try {
				// Also darken via the WaterWaveDepth shader pipeline so the effect
				// is visible even when tint/alpha are not applied inside the shader.
				if (this.depthWavePipeline) {
					const pipelineAny: any = this.depthWavePipeline as any;
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
				const baseAlpha = typeof depth.alpha === 'number' ? depth.alpha : 1;
				const targetAlpha = Math.max(0, Math.min(1, baseAlpha * 0.7));
				// Apply a dark tint as a secondary cue
				try {
					if (typeof depth.setTint === 'function') {
						depth.setTint(0x202020);
					}
				} catch {}
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
			const depth: any = this.bgDepth as any;
			const scene: any = this.sceneRef as any;
			const origAlpha: number =
				typeof depth.__winOriginalAlpha === 'number'
					? depth.__winOriginalAlpha
					: (typeof depth.alpha === 'number' ? depth.alpha : 1);
			const origTint: number | undefined =
				typeof depth.__winOriginalTint === 'number'
					? depth.__winOriginalTint
					: undefined;
			try { scene.tweens?.killTweensOf?.(depth); } catch {}
			try {
				if (this.depthWavePipeline) {
					const pipelineAny: any = this.depthWavePipeline as any;
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
}
