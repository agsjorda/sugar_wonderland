import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

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

		// Kobi tent bonus
		const kobiTentBonus = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.3275,
			'kobi-tent-bonus'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(3);
		this.bonusContainer.add(kobiTentBonus);

		// Mobile disco lights spine animation
		this.createMobileDiscoLights(scene, assetScale);

		// Grass element (created last to ensure it's on top)
		const grass = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.884,
			'grass'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(20);
		this.bonusContainer.add(grass);
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

		// Kobi tent bonus
		const kobiTentBonus = scene.add.image(
			scene.scale.width * 0.3,
			scene.scale.height * 0.4,
			'kobi-tent-bonus'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(3);
		this.bonusContainer.add(kobiTentBonus);

		// Mobile disco lights spine animation
		this.createMobileDiscoLights(scene, assetScale);

		// Grass element (created last to ensure it's on top)
		const grass = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'grass'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(20);
		this.bonusContainer.add(grass);
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	destroy(): void {
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
	}
}
