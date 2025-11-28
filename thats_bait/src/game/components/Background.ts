 import { Scene } from "phaser";
 import { NetworkManager } from "../../managers/NetworkManager";
 import { ScreenModeManager } from "../../managers/ScreenModeManager";
 import { AssetConfig } from "../../config/AssetConfig";
 import { WaterWavePipeline, WaterWaveVerticalPipeline } from "../pipelines/WaterWavePipeline";
 import { BubbleParticleSystem, BubbleParticleModifiers } from "./BubbleParticleSystem";

export class Background {
 	private bgContainer!: Phaser.GameObjects.Container;
 	private networkManager: NetworkManager;
 	private screenModeManager: ScreenModeManager;
 	private sceneRef: Scene | null = null;
 	private seaEdgeWidthMultiplier: number = 1.1;
	private bubbleSystem?: BubbleParticleSystem;
	private readonly SCREEN_MARGIN: number = 80;
	private bgDepth?: Phaser.GameObjects.Image;
	private bgSurface?: Phaser.GameObjects.Image;
	private bgSky?: Phaser.GameObjects.Image;
	private depthWavePipeline?: WaterWavePipeline;
	private surfaceWavePipeline?: WaterWavePipeline;
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
		// Create ember/fiery particle backdrop (behind gameplay)
		this.bubbleSystem = new BubbleParticleSystem(scene, -9, {
			count: 15,
			speedMin: 0.5,
			speedMax: 1,
			lifeMin: 6000,
			lifeMax: 16000,
			screenMargin: this.SCREEN_MARGIN,
			spawnPerSecond: 5,
			maskLeft: 0,
			maskRight: 0,
			maskTop: 280,
			maskBottom: 250,
			showMaskDebug: false,
			burstOnStart: false,
		});
		// Drive particles using scene update events
		scene.events.on('update', this.handleUpdate, this);
		scene.events.once('shutdown', () => {
			try { scene.events.off('update', this.handleUpdate, this); } catch {}
			try { this.bubbleSystem?.destroy(); } catch {}
		});
		
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
		this.bgContainer.add(bgDepth);
		this.bgDepth = bgDepth;

		// Surface layer (between depth and sky)
		const bgSurface = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.9,
			'BG-Surface'
		).setOrigin(0.5, 0.5);
		this.bgContainer.add(bgSurface);
		this.bgSurface = bgSurface;

		// Sky layer (in front, with its own offset)
		const bgSky = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-Sky'
		).setOrigin(0.5, 0.5);
		this.bgContainer.add(bgSky);
		this.bgSky = bgSky;

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
		seaEdge.setDepth(885);

		const renderer: any = scene.game.renderer;
		const pipelineManager: any = renderer && renderer.pipelines;
		if (pipelineManager && typeof pipelineManager.add === 'function') {
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
					const surfaceWave = new WaterWavePipeline(scene.game, {
						amplitude: 0.02,
						frequency: 15.0,
						speed: 0.9
					});
					pipelineManager.add('WaterWaveSurface', surfaceWave);
					this.surfaceWavePipeline = surfaceWave;
				} else if (renderer && typeof renderer.getPipeline === 'function') {
					try {
						const existingSurface = renderer.getPipeline('WaterWaveSurface');
						if (existingSurface) {
							this.surfaceWavePipeline = existingSurface as WaterWavePipeline;
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

		// Optional tiny padding if desired to avoid edge seams
		// bg.setScale(bg.scaleX * 1.02, bg.scaleY * 1.02);

		// Add reel frame (kept as-is, initially hidden alpha)

	}

	private handleUpdate(_time: number, delta: number): void {
		if (!this.sceneRef) return;
		if (this.bubbleSystem) {
			this.bubbleSystem.update(delta);
		}
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
	}

	configureBubbleParticles(modifiers: BubbleParticleModifiers): void {
		if (this.bubbleSystem) {
			this.bubbleSystem.configure(modifiers);
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

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}
}
