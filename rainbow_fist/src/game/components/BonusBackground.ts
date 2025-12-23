import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { getFullScreenSpineScale, playSpineAnimationSequence } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private bonusBackgroundVisual?: Phaser.GameObjects.Image | SpineGameObject;
	private sparkleBackground?: SpineGameObject;
	private arch: Phaser.GameObjects.Image;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private archSpine: SpineGameObject;
	private reelFrame: Phaser.GameObjects.Image;
	private movingDoves: SpineGameObject[] = [];

	private reelFrameDepth: number = 550;

	private reelFramePosition: {x: number, y: number} = {x: 0.5, y: 0.2};

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

	private createBonusElements(scene: Scene, _assetScale: number): void {
		void _assetScale;
		this.createPortraitBonusBackground(scene, _assetScale);
	}

	private createPortraitBonusBackground(scene: Scene, _assetScale: number): void {
		void _assetScale;
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		const backgroundVisual = this.createBonusBackgroundVisual(scene, 'bonus_background', 'bonus_background_spine');
		this.bonusBackgroundVisual = backgroundVisual;
		backgroundVisual.setDepth(1);
		this.bonusContainer.add(backgroundVisual);
		this.fitBackgroundToScreen(scene);

		// Add reel frame
		this.reelFrame = scene.add.image(
			scene.scale.width * this.reelFramePosition.x,
			scene.scale.height * 0.415,
			'reel_frame'
		).setOrigin(0.5, 0.5)
		.setDepth(this.reelFrameDepth);
		
		// Create sparkle background first (behind everything except bonus_background_spine)
		const sparkleBackground = this.createSparkleBackground(scene);
		if (sparkleBackground) {
			console.log(`[BonusBackground] Adding sparkle background to container`);
			this.sparkleBackground = sparkleBackground;
			sparkleBackground.setDepth(1);
			sparkleBackground.setVisible(true);
			this.bonusContainer.add(sparkleBackground);
			// this.fitSparkleBackgroundToScreen(scene);
			console.log(`[BonusBackground] Sparkle background added and fitted to screen`);
		} else {
			console.warn(`[BonusBackground] Sparkle background was not created, skipping addition to container`);
		}

		// Fit reel frame to screen width while preserving aspect ratio
		this.fitReelFrameToScreenWidth(scene);

		this.bonusContainer.add(this.reelFrame);
	}

	private fitSparkleBackgroundToScreen(scene: Scene): void {
		if (!this.sparkleBackground) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		const scale = getFullScreenSpineScale(scene, this.sparkleBackground, true);
		this.sparkleBackground.setScale(scale.x, scale.y);
		this.sparkleBackground.setPosition(screenWidth * 0.5, screenHeight * 0.5);
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

	private createSparkleBackground(scene: Scene): SpineGameObject | undefined {
		const centerX = scene.scale.width * 0.5;
		const centerY = scene.scale.height * 0.5;
		const spineKey = 'sparkle_background';
		const atlasKey = `${spineKey}-atlas`;

		console.log(`[BonusBackground] Attempting to create sparkle background: ${spineKey} with atlas: ${atlasKey}`);

		try {
			const spine = scene.add.spine(centerX, centerY, spineKey, atlasKey) as SpineGameObject;
			console.log(`[BonusBackground] Sparkle background spine created successfully`);
			spine.setOrigin(0.5, 0.5);
			spine.setVisible(true);
			// Play animation at index 0 in a continuous loop
			playSpineAnimationSequence(spine, [0], true);
			console.log(`[BonusBackground] Sparkle background animation started`);
			return spine;
		} catch (error) {
			console.error(`[BonusBackground] Failed to create sparkle background spine '${spineKey}':`, error);
			return undefined;
		}
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
		this.fitSparkleBackgroundToScreen(scene);
		this.fitBackgroundToScreen(scene);
		this.fitArchToBottom(scene);
		this.fitReelFrameToScreenWidth(scene);
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
