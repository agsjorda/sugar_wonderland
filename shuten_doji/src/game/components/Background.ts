import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { getFullScreenSpineScale, playSpineAnimationSequence } from "./SpineBehaviorHelper";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SoundEffectType } from "../../managers/AudioManager";
import { gameStateManager } from "../../managers/GameStateManager";

export class Background {
	private bgContainer: Phaser.GameObjects.Container;
	private backgroundVisual?: Phaser.GameObjects.Image | SpineGameObject;
	private reelBackground?: Phaser.GameObjects.Rectangle;
	private reelFrameContainer?: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

	private reelFrameDepth: number = 550;

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
	}

	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		// Add main background
		this.backgroundVisual = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'default_background'
		).setOrigin(0.5, 0.5);
		this.fitBackgroundToScreen(scene);
		this.bgContainer.add(this.backgroundVisual);

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
			// Add rectangle first so it renders behind the frame pieces
			this.reelFrameContainer.add(topRightFrame);
			this.reelFrameContainer.add(topLeftFrame);
			this.reelFrameContainer.add(bottomLeftFrame);
			this.reelFrameContainer.add(bottomRightFrame);
		}
	}

	private fitBackgroundToScreen(scene: Scene): void {
		if (!this.backgroundVisual) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		if (this.backgroundVisual instanceof Phaser.GameObjects.Image) {
			const imageWidth = this.backgroundVisual.frame.width;
			const imageHeight = this.backgroundVisual.frame.height;
			if (imageWidth === 0 || imageHeight === 0) {
				return;
			}
			const scaleX = screenWidth / imageWidth;
			const scaleY = screenHeight / imageHeight;
			const scale = Math.max(scaleX, scaleY);
			this.backgroundVisual.setScale(scale);
		} else {
			const scale = getFullScreenSpineScale(scene, this.backgroundVisual, true);
			this.backgroundVisual.setScale(scale.x, scale.y);
		}

		this.backgroundVisual.setPosition(screenWidth * 0.5, screenHeight * 0.5);
	}

	/**
	 * Scales the reel frame so that it fits the full screen width
	 * while preserving its aspect ratio.
	 */
	private fitReelFrameToScreenWidth(scene: Scene): void {
		// if (!this.reelFrame) return;

		// const screenWidth = scene.scale.width;
		// const screenHeight = scene.scale.height;

		// const imageWidth = this.reelFrame.frame.width;
		// const imageHeight = this.reelFrame.frame.height;

		// if (imageWidth === 0 || imageHeight === 0) return;

		// // Uniform scale, based only on width, to keep aspect ratio
		// const scale = screenWidth / imageWidth;

		// this.reelFrame.setScale(scale);
		
		// // Update background to match reel frame position and size
		// this.updateReelFrameBackground(scene);
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.fitBackgroundToScreen(scene);
		this.fitReelFrameToScreenWidth(scene);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}
}
