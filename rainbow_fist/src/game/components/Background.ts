import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { playSpineAnimationSequenceWithConfig } from "./SpineBehaviorHelper";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SoundEffectType } from "../../managers/AudioManager";
import { gameStateManager } from "../../managers/GameStateManager";

export class Background {
	private bgContainer: Phaser.GameObjects.Container;
	private bgDefault: Phaser.GameObjects.Image;
	private rifleSpine: SpineGameObject;
	private reelFrame?: Phaser.GameObjects.Image;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

	private reelFrameDepth: number = 550;

	private reelFramePosition: {x: number, y: number} = {x: 0.5, y: 0.2};

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
		this.bgDefault = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			'default_background'
		).setOrigin(0.5, 0.5);
		this.fitBackgroundToScreen(scene);
		this.bgContainer.add(this.bgDefault);

		// Add reel frame
		this.reelFrame = scene.add.image(
				scene.scale.width * this.reelFramePosition.x,
				scene.scale.height * 0.415,
				'reel_frame'
			).setOrigin(0.5, 0.5)
			.setDepth(this.reelFrameDepth);

		// Fit reel frame to screen width while preserving aspect ratio
		this.fitReelFrameToScreenWidth(scene);

		this.bgContainer.add(this.reelFrame);
	}

	private fitBackgroundToScreen(scene: Scene): void {
		if (!this.bgDefault) return;

		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;

		// Use frame width/height (intrinsic texture size) to avoid compounding scales
		const imageWidth = this.bgDefault.frame.width;
		const imageHeight = this.bgDefault.frame.height;

		if (imageWidth === 0 || imageHeight === 0) return;

		const scaleX = screenWidth / imageWidth;
		const scaleY = screenHeight / imageHeight;
		const scale = Math.max(scaleX, scaleY);

		this.bgDefault.setScale(scale);
		this.bgDefault.setPosition(screenWidth * 0.5, screenHeight * 0.5);
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

	getReelFrame(): Phaser.GameObjects.Image | undefined {
		return this.reelFrame;
	}
}
