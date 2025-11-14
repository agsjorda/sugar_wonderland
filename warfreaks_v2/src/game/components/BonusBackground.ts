import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { playSpineAnimationSequence } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private bonusBg: Phaser.GameObjects.Image;
	private arch: Phaser.GameObjects.Image;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private archSpine: SpineGameObject;

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
		
		this.createPortraitBonusBackground(scene, assetScale);
	}

	private createDoveSpineAnimation(scene: Scene, assetScale: number, position: {x: number, y: number}, scale: {x: number, y: number}): void {
		try {
			if (!ensureSpineFactory(scene, '[BonusBackground] createDoveSpineAnimation')) {
				console.warn('[BonusBackground] Spine factory unavailable. Skipping dove spine.');
				return;
			}
			
			// Create the mobile disco lights Spine animation object
			const doveSpineObject = scene.add.spine(position.x, position.y, "dove", "dove-atlas");
			doveSpineObject.setOrigin(0.5, 0.5);
			doveSpineObject.setScale(scale.x, scale.y);
			doveSpineObject.setDepth(5);
			doveSpineObject.animationState.setAnimation(0, "animation", true);
			
			this.bonusContainer.add(doveSpineObject);
			
			console.log('[BonusBackground] Mobile dove Spine animation created successfully');
		} catch (error) {
			console.error('[BonusBackground] Error creating dove Spine animation:', error);
			console.error('[BonusBackground] This usually means the dove spine assets are not loaded or the paths are incorrect.');
			console.error('[BonusBackground] Expected assets:');
			console.error('[BonusBackground] - assets/portrait/high/bonus_background/dove/dove.atlas');
			console.error('[BonusBackground] - assets/portrait/high/bonus_background/dove/dove.json');
		}
	}

	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		// Main bonus background
		this.bonusBg = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'bonus_background'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.fitBackgroundToScreen(scene);
		this.bonusContainer.add(this.bonusBg);

		// Arch – fit to width and anchor to bottom
		// this.createArchImage(scene, assetScale);

		// Add arch spine
		this.createArchSpine(scene, assetScale);

		// Add reel frame
		const reelFrame = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.61,
			'bonus-reel-frame'
		).setOrigin(0.5, 0.95).setScale(assetScale * 0.325, assetScale * 0.275).setDepth(5);
		this.bonusContainer.add(reelFrame);

		// Dove spine animation
		const doveYPosition = scene.scale.height * 0.09;
		const doveLeftXPosition = scene.scale.width * 0.8;
		const doveRightXPosition = scene.scale.width * 0.2;
		const doveScale = 0.45;
		this.createDoveSpineAnimation(scene, assetScale,  {x: doveLeftXPosition, y: doveYPosition}, {x: -doveScale, y: doveScale});
		this.createDoveSpineAnimation(scene, assetScale, {x: doveRightXPosition, y: doveYPosition}, {x: doveScale, y: doveScale});
	}

	private createArchImage(scene: Scene, assetScale: number): void {
		this.arch = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height,
			'arch'
		).setOrigin(0.5, 1).setDepth(3);
		this.fitArchToBottom(scene);
		this.bonusContainer.add(this.arch);
	}

	private createArchSpine(scene: Scene, assetScale: number): void {
		this.archSpine = scene.add.spine(0, 0, "columns_rifle", "columns_rifle-atlas");
		const scale = 0.42;
		const offset = {x: 3, y: 0};
		const anchor = {x: 0.5, y: 1};
		const origin = {x: 0.5, y: 0.89};
		playSpineAnimationSequence(scene, this.archSpine, [0], {x: scale, y: scale}, anchor, origin, offset);
		this.bonusContainer.add(this.archSpine);
	}

	private fitBackgroundToScreen(scene: Scene): void {
		if (!this.bonusBg) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		// Use frame width/height (intrinsic texture size) to avoid compounding scales
		const imageWidth = this.bonusBg.frame.width;
		const imageHeight = this.bonusBg.frame.height;

		if (imageWidth === 0 || imageHeight === 0) return;

		const scaleX = screenWidth / imageWidth;
		const scaleY = screenHeight / imageHeight;
		const scale = Math.max(scaleX, scaleY);

		this.bonusBg.setScale(scale);
		this.bonusBg.setPosition(screenWidth * 0.5, screenHeight * 0.5);
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.fitBackgroundToScreen(scene);
		this.fitArchToBottom(scene);
	}

	private fitArchToBottom(scene: Scene): void {
		if (!this.arch) return;
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const imageWidth = this.arch.frame.width;
		const imageHeight = this.arch.frame.height;
		if (!imageWidth || !imageHeight) return;
		const scale = screenWidth / imageWidth; // cover width, maintain aspect ratio
		this.arch.setScale(scale);
		this.arch.setOrigin(0.5, 1);
		this.arch.setPosition(screenWidth * 0.5, screenHeight);
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
