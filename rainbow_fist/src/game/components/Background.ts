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
	private rifleSpine: SpineGameObject;
	private reelFrame?: Phaser.GameObjects.Image;
	private reelFrameBackground?: Phaser.GameObjects.Rectangle;
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
		const backgroundVisual = this.createBackgroundVisual(scene, 'default_background', 'default_background_spine');
		this.backgroundVisual = backgroundVisual;
		this.bgContainer.add(backgroundVisual);
		this.fitBackgroundToScreen(scene);

		// Add reel frame
		this.reelFrame = scene.add.image(
				scene.scale.width * this.reelFramePosition.x,
				scene.scale.height * 0.415,
				'reel_frame'
			).setOrigin(0.5, 0.5)
			.setDepth(this.reelFrameDepth);

		// Fit reel frame to screen width while preserving aspect ratio
		this.fitReelFrameToScreenWidth(scene);

		// Create semi-transparent white rectangle background that follows reel frame
		// (must be created before adding reelFrame to container to ensure proper z-order)
		this.createReelFrameBackground(scene);

		// Add background first, then reelFrame so reelFrame renders on top
		this.bgContainer.add(this.reelFrameBackground!);
		this.bgContainer.add(this.reelFrame);
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

	private createBackgroundVisual(scene: Scene, imageKey: string, spineKey: string): Phaser.GameObjects.Image | SpineGameObject {
		const centerX = scene.scale.width * 0.5;
		const centerY = scene.scale.height * 0.5;
		const context = `[Background] ${spineKey}`;

		if (ensureSpineFactory(scene, context)) {
			try {
				const addAny: any = scene.add;
				const spine = addAny.spine?.(centerX, centerY, spineKey, `${spineKey}-atlas`) as SpineGameObject;
				if (spine) {
					spine.setOrigin(0.32925, 0.5);
					playSpineAnimationSequence(spine, [0], true);
					return spine;
				}
			} catch (error) {
				console.warn(`[Background] Failed to create spine '${spineKey}':`, error);
			}
		}

		console.warn(`[Background] Spine '${spineKey}' unavailable. Falling back to image '${imageKey}'`);
		return scene.add.image(centerX, centerY, imageKey).setOrigin(0.5, 0.5);
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

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.fitBackgroundToScreen(scene);
		this.fitReelFrameToScreenWidth(scene);
		// Update background position when resizing
		this.updateReelFrameBackground(scene);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	getReelFrame(): Phaser.GameObjects.Image | undefined {
		return this.reelFrame;
	}
}
