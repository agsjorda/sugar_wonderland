import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { playSpineAnimationSequenceWithConfig } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private bonusBg: Phaser.GameObjects.Image;
	private arch: Phaser.GameObjects.Image;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private archSpine: SpineGameObject;
	private reelFrameContainer?: Phaser.GameObjects.Container;
	private movingDoves: SpineGameObject[] = [];
	private reelBackground: Phaser.GameObjects.Rectangle;

	private reelFrameDepth: number = 550;

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
		// Separate overlay container so the reel frame can sit above symbols
		this.reelFrameContainer = scene.add.container(0, 0).setDepth(this.reelFrameDepth);
		
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

			doveSpineObject.animationState.timeScale = 0.5;
			
			this.bonusContainer.add(doveSpineObject);
			
			console.log('[BonusBackground] Mobile dove Spine animation created successfully');
		} catch (e) {
			console.warn('[BonusBackground] createDoveSpineAnimation failed:', e);
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

		this.createReelFrame(scene, assetScale);
	}

	private createReelFrame(scene: Scene, assetScale: number): void {
		const gridY = scene.scale.height * 0.483 - 53;
		const gridHeight = 385;
		const xOffset = 10;

		// Create dark gray rectangle behind the reel frame
		this.reelBackground = scene.add.rectangle(
			scene.scale.width * 0.5,
			gridY,
			scene.scale.width,
			gridHeight * 0.97,
			0x777777
		).setAlpha(0.5);

		const topRightFrame = scene.add.image(
			scene.scale.width + xOffset,
			gridY - gridHeight * 0.5,
			'reel_frame_top'
		).setOrigin(0, 0).setScale(assetScale * -1, assetScale);

		
		const topLeftFrame = scene.add.image(
			-xOffset,
			gridY - gridHeight * 0.5,
			'reel_frame_top'
		).setOrigin(0, 0).setScale(assetScale, assetScale);
		
		const bottomRightFrame = scene.add.image(
			scene.scale.width + xOffset,
			gridY + gridHeight * 0.5,
			'reel_frame_bottom'
		).setOrigin(0, 1).setScale(assetScale * -1, assetScale);

		const bottomLeftFrame = scene.add.image(
			-xOffset,
			gridY + gridHeight * 0.5,
			'reel_frame_bottom'
		).setOrigin(0, 1).setScale(assetScale, assetScale);
		
		if (this.reelFrameContainer) {
			this.reelFrameContainer.add(topRightFrame);
			this.reelFrameContainer.add(topLeftFrame);
			this.reelFrameContainer.add(bottomLeftFrame);
			this.reelFrameContainer.add(bottomRightFrame);
		}
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

	setVisible(isVisible: boolean): void {
		if (this.bonusContainer) {
			this.bonusContainer.setVisible(isVisible);
		}
		if (this.reelFrameContainer) {
			this.reelFrameContainer.setVisible(isVisible);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	getReelFrameContainer(): Phaser.GameObjects.Container | undefined {
		return this.reelFrameContainer;
	}

	destroy(): void {
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
		if (this.reelFrameContainer) {
			this.reelFrameContainer.destroy();
		}
	}
}
