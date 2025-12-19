import { Scene } from "phaser";
import { ensureSpineFactory } from "../../utils/SpineGuard";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { getFullScreenSpineScale, playSpineAnimationSequence } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private bonusBackgroundVisual?: Phaser.GameObjects.Image | SpineGameObject;
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

		// Arch – fit to width and anchor to bottom
		// this.createArchImage(scene, assetScale);

		// Add reel frame
		this.reelFrame = scene.add.image(
			scene.scale.width * this.reelFramePosition.x,
			scene.scale.height * 0.415,
			'reel_frame'
		).setOrigin(0.5, 0.5)
		.setDepth(this.reelFrameDepth);

		// Fit reel frame to screen width while preserving aspect ratio
		this.fitReelFrameToScreenWidth(scene);

		this.bonusContainer.add(this.reelFrame);
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
		const context = `[BonusBackground] ${spineKey}`;

		if (ensureSpineFactory(scene, context)) {
			try {
				const addAny: any = scene.add;
				const spine = addAny.spine?.(centerX, centerY, spineKey, `${spineKey}-atlas`) as SpineGameObject;
				if (spine) {
					spine.setOrigin(0.5075, 0.5);
					playSpineAnimationSequence(spine, [0], true);
					return spine;
				}
			} catch (error) {
				console.warn(`[BonusBackground] Failed to create spine '${spineKey}':`, error);
			}
		}

		console.warn(`[BonusBackground] Spine '${spineKey}' unavailable. Falling back to image '${imageKey}'`);
		return scene.add.image(centerX, centerY, imageKey).setOrigin(0.5, 0.5);
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
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
