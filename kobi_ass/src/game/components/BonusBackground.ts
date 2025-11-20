import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private propsBonusSpine?: any;
	private propsBonusContainer: Phaser.GameObjects.Container | null = null;
	private propsBonusOffsetX: number = -23.2;
	private propsBonusOffsetY: number = 0;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are loaded centrally through AssetConfig in Preloader
		console.log(`[BonusBackground] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[BonusBackground] Creating bonus background elements");
		
		// Create main container for all bonus background elements
		this.bonusContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[BonusBackground] Creating bonus background with scale: ${assetScale}x`);

		// Add bonus background elements
		this.createBonusElements(scene, assetScale);
	}

	private createBonusElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		if (screenConfig.isPortrait) {
			this.createPortraitBonusBackground(scene, assetScale);
		} else {
			this.createLandscapeBonusBackground(scene, assetScale);
		}
	}

	public setPropsBonusOffset(x: number, y: number): void {
		this.propsBonusOffsetX = x;
		this.propsBonusOffsetY = y;

		if (this.propsBonusSpine) {
			const scene = this.propsBonusSpine.scene;
			if (scene) {
				this.propsBonusSpine.x = (scene.scale.width * 0.5) + this.propsBonusOffsetX;
				this.propsBonusSpine.y = (scene.scale.height * 0.5) + this.propsBonusOffsetY;
			}
		}
	}

	public getPropsBonusOffset(): { x: number; y: number } {
		return {
			x: this.propsBonusOffsetX,
			y: this.propsBonusOffsetY,
		};
	}

	private createPropsBonusSpine(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[BonusBackground] createPropsBonusSpine')) {
				console.warn('[BonusBackground] Spine factory unavailable. Skipping props-bonus spine.');
				return;
			}

			const cacheJson: any = scene.cache.json as any;
			const hasJson = cacheJson && typeof cacheJson.has === 'function' && cacheJson.has('props-bonus');

			if (!hasJson) {
				console.warn('[BonusBackground] Spine json for props-bonus not loaded. Skipping props-bonus spine.');
				return;
			}

			// Ensure a dedicated container exists for the props-bonus spine so we can
			// layer it above the reels (similar to base game props).
			if (!this.propsBonusContainer) {
				this.propsBonusContainer = scene.add.container(0, 0);
				// Match base props layering: above symbols but below UI
				this.propsBonusContainer.setDepth(600);
				// Hidden by default; will be toggled by Game scene events
				this.propsBonusContainer.setVisible(false);
			}

			const width = scene.scale.width;
			const height = scene.scale.height;

			const propsBonusSpine = scene.add.spine(
				(width * 0.5) + this.propsBonusOffsetX,
				(height * 0.5) + this.propsBonusOffsetY,
				"props-bonus",
				"props-bonus-atlas"
			);

			propsBonusSpine.setOrigin(0.5, 0.5);
			propsBonusSpine.setScale(assetScale);

			// Add to the dedicated props container (not the main bonus background container)
			this.propsBonusContainer.add(propsBonusSpine);
			this.propsBonusSpine = propsBonusSpine;

			try {
				const anySpine: any = propsBonusSpine as any;
				const animations = anySpine?.skeleton?.data?.animations || [];

				if (animations.length > 0) {
					const animName = animations[0].name || animations[0];
					console.log(`[BonusBackground] Playing props-bonus animation: ${animName}`);

					scene.time.delayedCall(100, () => {
						try {
							propsBonusSpine.animationState.setAnimation(0, animName, true);
						} catch (e) {
							console.error('[BonusBackground] Failed to start props-bonus animation:', e);
						}
					});
				} else {
					console.warn('[BonusBackground] No animations found in props-bonus spine data');
				}
			} catch (e) {
				console.error('[BonusBackground] Error configuring props-bonus animation:', e);
			}
		} catch (error) {
			console.error('[BonusBackground] Error creating props-bonus Spine animation:', error);
		}
	}

	private createMobileDiscoLights(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[BonusBackground] createMobileDiscoLights')) {
				console.warn('[BonusBackground] Spine factory unavailable. Skipping disco lights spine.');
				return;
			}
			const width = scene.scale.width;
			const height = scene.scale.height;
			
			// Create the mobile disco lights Spine animation object
			const discoSpineObject = scene.add.spine(width * 0.5, height * 0.63, "mobile_disco_lights", "mobile_disco_lights-atlas");
			discoSpineObject.setOrigin(0.5, 0.5);
			discoSpineObject.setScale(0.17);
			discoSpineObject.setDepth(5);
			discoSpineObject.animationState.setAnimation(0, "mobile_disco_ball_bonus", true);
			
			this.bonusContainer.add(discoSpineObject);
			
			console.log('[BonusBackground] Mobile disco lights Spine animation created successfully');
		} catch (error) {
			console.error('[BonusBackground] Error creating mobile disco lights Spine animation:', error);
			console.error('[BonusBackground] This usually means the mobile disco lights spine assets are not loaded or the paths are incorrect.');
			console.error('[BonusBackground] Expected assets:');
			console.error('[BonusBackground] - assets/portrait/high/bonus_background/mobile_disco_lights/mobile_disco_lights.atlas');
			console.error('[BonusBackground] - assets/portrait/high/bonus_background/mobile_disco_lights/mobile_disco_lights.json');
		}
	}

	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		// Main bonus background
		const bonusBg = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'bonus_background'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bonusContainer.add(bonusBg);

		// Background spine animation visible only in bonus mode
		this.createPropsBonusSpine(scene, assetScale);

		// Mobile disco lights spine animation
		this.createMobileDiscoLights(scene, assetScale);

	}

	private createLandscapeBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating landscape bonus background layout");
		
		// Main bonus background
		const bonusBg = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'bonus_background'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bonusContainer.add(bonusBg);

		// Background spine animation visible only in bonus mode
		this.createPropsBonusSpine(scene, assetScale);

		// Mobile disco lights spine animation
		this.createMobileDiscoLights(scene, assetScale);

	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	public showProps(): void {
		if (this.propsBonusContainer) {
			this.propsBonusContainer.setVisible(true);
		}
	}

	public hideProps(): void {
		if (this.propsBonusContainer) {
			this.propsBonusContainer.setVisible(false);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	destroy(): void {
		if (this.propsBonusContainer) {
			this.propsBonusContainer.removeAll(true);
			this.propsBonusContainer.destroy();
			this.propsBonusContainer = null;
		}

		this.propsBonusSpine = undefined;

		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
	}
}
