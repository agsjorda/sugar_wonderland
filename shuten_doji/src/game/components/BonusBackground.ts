import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { getFullScreenSpineScale, playSpineAnimationSequence } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private bonusBackgroundVisual?: Phaser.GameObjects.Image | SpineGameObject;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private reelFrame: Phaser.GameObjects.Image;
	private reelFrameBackground?: Phaser.GameObjects.Rectangle;

	private reelFrameDepth: number = 550;
	private reelBackground: Phaser.GameObjects.Rectangle;
	private reelFrameContainer: Phaser.GameObjects.Container;

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
		this.createPortraitBonusBackground(scene, assetScale);
	}

	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		// Main bonus background
		this.bonusBackgroundVisual = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'bonus_background'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.fitBackgroundToScreen(scene);
		this.bonusContainer.add(this.bonusBackgroundVisual);

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
		).setOrigin(0, 0).setScale(assetScale * -1, assetScale).setDepth(this.reelFrameDepth);

		
		const topLeftFrame = scene.add.image(
			-xOffset,
			gridY - gridHeight * 0.5,
			'reel_frame_top'
		).setOrigin(0, 0).setScale(assetScale, assetScale).setDepth(this.reelFrameDepth);
		
		const bottomRightFrame = scene.add.image(
			scene.scale.width + xOffset,
			gridY + gridHeight * 0.5,
			'reel_frame_bottom'
		).setOrigin(0, 1).setScale(assetScale * -1, assetScale).setDepth(this.reelFrameDepth);

		const bottomLeftFrame = scene.add.image(
			-xOffset,
			gridY + gridHeight * 0.5,
			'reel_frame_bottom'
		).setOrigin(0, 1).setScale(assetScale, assetScale).setDepth(this.reelFrameDepth);
		
		if (this.reelFrameContainer) {
			this.reelFrameContainer.add(topRightFrame);
			this.reelFrameContainer.add(topLeftFrame);
			this.reelFrameContainer.add(bottomLeftFrame);
			this.reelFrameContainer.add(bottomRightFrame);
		}
	}

	private fitBackgroundToScreen(scene: Scene): void {
		if (!this.bonusBackgroundVisual) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		if (this.bonusBackgroundVisual instanceof Phaser.GameObjects.Image) {
			const imageWidth = this.bonusBackgroundVisual.frame.width;
			const imageHeight = this.bonusBackgroundVisual.frame.height;
			if (imageWidth === 0 || imageHeight === 0) {
				return;
			}
			const scaleX = screenWidth / imageWidth;
			const scaleY = screenHeight / imageHeight;
			const scale = Math.max(scaleX, scaleY);
			this.bonusBackgroundVisual.setScale(scale);
		} else {
			const scale = getFullScreenSpineScale(scene, this.bonusBackgroundVisual, true);
			this.bonusBackgroundVisual.setScale(scale.x, scale.y);
		}

		this.bonusBackgroundVisual.setPosition(screenWidth * 0.5, screenHeight * 0.5);
	}

	private createBonusBackgroundVisual(scene: Scene, imageKey: string, spineKey: string): Phaser.GameObjects.Image | SpineGameObject {
		const centerX = scene.scale.width * 0.5;
		const centerY = scene.scale.height * 0.5;

		try {
			const spine = scene.add.spine(centerX, centerY, spineKey, `${spineKey}-atlas`) as SpineGameObject;
			spine.setOrigin(0.5075, 0.5);
			playSpineAnimationSequence(spine, [0], true);
			return spine;
		} catch (error) {
			console.warn(`[BonusBackground] Failed to create spine '${spineKey}':`, error);
			console.warn(`[BonusBackground] Spine '${spineKey}' unavailable. Falling back to image '${imageKey}'`);
			return scene.add.image(centerX, centerY, imageKey).setOrigin(0.5, 0.5);
		}
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.fitBackgroundToScreen(scene);
		this.fitReelFrameToScreenWidth(scene);
		// Update background position when resizing
		this.updateReelFrameBackground(scene);
	}

	/**
	 * Scales the reel frame so that it fits the full screen width
	 * while preserving its aspect ratio.
	 */
	private fitReelFrameToScreenWidth(scene: Scene): void {
		if (!this.reelFrame) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		const imageWidth = this.reelFrame.frame.width;
		const imageHeight = this.reelFrame.frame.height;

		if (imageWidth === 0 || imageHeight === 0) return;

		// Uniform scale, based only on width, to keep aspect ratio
		const scale = screenWidth / imageWidth;

		this.reelFrame.setScale(scale);
		
		// Update background to match reel frame position and size
		this.updateReelFrameBackground(scene);
	}

	/**
	 * Creates a semi-transparent white rectangle background that follows the reel frame position
	 */
	private createReelFrameBackground(scene: Scene): void {
		if (!this.reelFrame) return;

		const x = this.reelFrame.x;
		const y = this.reelFrame.y;
		const displayWidth = this.reelFrame.displayWidth;
		const displayHeight = this.reelFrame.displayHeight - 10;

		this.reelFrameBackground = scene.add.rectangle(x, y, displayWidth, displayHeight, 0xffffff, 0.15)
			.setOrigin(0.5, 0.5)
			.setDepth(this.reelFrameDepth - 1); // Place it behind the reel frame
	}

	/**
	 * Updates the background rectangle to match the reel frame's position and size
	 */
	private updateReelFrameBackground(scene: Scene): void {
		if (!this.reelFrame || !this.reelFrameBackground) return;

		this.reelFrameBackground.setPosition(this.reelFrame.x, this.reelFrame.y);
		this.reelFrameBackground.setSize(this.reelFrame.displayWidth, this.reelFrame.displayHeight);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	getReelFrame(): Phaser.GameObjects.Image {
		return this.reelFrame;
	}

	destroy(): void {
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}
	}
}
