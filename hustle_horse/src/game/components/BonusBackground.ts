 import { Scene } from "phaser";
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
		// Match base scene layering: background at -10 so Symbols base overlay (-5) sits above it
		this.bonusContainer.setDepth(-10);
		
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

	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		// Main bonus background (match BG-Default sizing/position)
		const bonusBg = scene.add.image(
			scene.scale.width * 0.525,
			scene.scale.height * 0.36,
			'bonus_background'
		).setOrigin(0.5, 0.5);
		this.bonusContainer.add(bonusBg);

		// Fit to canvas width
		const scaleX = scene.scale.width / bonusBg.width;
		bonusBg.setScale(scaleX);

		// Apply slight additional padding (same as BG-Default)
		const padX = 0.17; // +17% width
		const padY = 0.01; // +1% height
		bonusBg.setScale(bonusBg.scaleX * (1 + padX), bonusBg.scaleY * (1 + padY));

		// Add Brick Wall background above bonus background and stick it to the bottom
		const brickWall = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-BrickWall'
		).setOrigin(0.5, 0.5);
		this.bonusContainer.add(brickWall);

		// Scale to fit width
		const brickScaleX = scene.scale.width / brickWall.width;
		brickWall.setScale(brickScaleX);
		// Apply slight additional padding
		const brickPadX = 0.02; // +2% width
		const brickPadY = 0.1; // +10% height
		brickWall.setScale(brickWall.scaleX * (1 + brickPadX), brickWall.scaleY * (1 + brickPadY));
		// Position at bottom without moving horizontally (after padding)
		brickWall.setY(scene.scale.height - brickWall.displayHeight * 0.5);

		// Elements removed: kobi tent, disco lights, grass
	}

	private createLandscapeBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating landscape bonus background layout");
		
		// Main bonus background (match BG-Default sizing/position)
		const bonusBg = scene.add.image(
			scene.scale.width * 0.525,
			scene.scale.height * 0.36,
			'bonus_background'
		).setOrigin(0.5, 0.5);
		this.bonusContainer.add(bonusBg);

		// Fit to canvas width
		const scaleX = scene.scale.width / bonusBg.width;
		bonusBg.setScale(scaleX);

		// Apply slight additional padding (same as BG-Default)
		const padX = 0.17; // +17% width
		const padY = 0.01; // +1% height
		bonusBg.setScale(bonusBg.scaleX * (1 + padX), bonusBg.scaleY * (1 + padY));

		// Add Brick Wall background above bonus background and stick it to the bottom
		const brickWall = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'BG-BrickWall'
		).setOrigin(0.5, 0.5);
		this.bonusContainer.add(brickWall);

		// Scale to fit width
		const brickScaleX = scene.scale.width / brickWall.width;
		brickWall.setScale(brickScaleX);
		// Apply slight additional padding
		const brickPadX = 0.02; // +2% width
		const brickPadY = 0.1; // +10% height
		brickWall.setScale(brickWall.scaleX * (1 + brickPadX), brickWall.scaleY * (1 + brickPadY));
		// Position at bottom without moving horizontally (after padding)
		brickWall.setY(scene.scale.height - brickWall.displayHeight * 0.5);

		// Elements removed: kobi tent, disco lights, grass
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
