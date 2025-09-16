import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";

export class Background {
	private bgContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

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
		
		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		// Add background layers
		this.createBackgroundLayers(scene, assetScale);
		
		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);
		
		// Add UI elements
		//this.createUIElements(scene, assetScale);
	}

	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		// Add main background
		const bgDefault = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-Default'
		).setOrigin(0.5, 0.5).setScale(assetScale);
    this.bgContainer.add(bgDefault);

    // Add reel frame
    const reelFrame = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.483,
			'reel-frame'
		).setOrigin(0.5, 0.5).setScale(0.39).setAlpha(0);
		this.bgContainer.add(reelFrame);

    /*
    
    	// Add bulbs
		const bulb1 = scene.add.image(
			scene.scale.width * 0.21,
			scene.scale.height * 0.40,
			'bulb-01'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb1);

		const bulb2 = scene.add.image(
			scene.scale.width * 0.521,
			scene.scale.height * 0.40,
			'bulb-02'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb2);

		const bulb3 = scene.add.image(
			scene.scale.width * 0.818,
			scene.scale.height * 0.40,
			'bulb-03'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb3);
    */

    // Tent moved to Header component
	}

	private createDecorativeElements(scene: Scene, assetScale: number): void {
		// Add balloons
		const balloon1 = scene.add.image(
			scene.scale.width * 0.04,
			scene.scale.height * 0.5,
			'balloon-01'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon1);

		const balloon2 = scene.add.image(
			scene.scale.width * 0.06,
			scene.scale.height * 0.3,
			'balloon-02'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon2);

		const balloon3 = scene.add.image(
			scene.scale.width * 0.95,
			scene.scale.height * 0.6,
			'balloon-03'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon3);

		const balloon4 = scene.add.image(
			scene.scale.width * 0.92,
			scene.scale.height * 0.35,
			'balloon-04'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon4);

		// Add Christmas lights
		const xmasLights = scene.add.image(
			scene.scale.width * 0.495,
			scene.scale.height * 0.40,
			'reel-xmaslight-default'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(xmasLights);

	
	}

	private createUIElements(scene: Scene, assetScale: number): void {
		// Add logo
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.05,
			'kobi-logo'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bgContainer.add(logo);
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}
}
