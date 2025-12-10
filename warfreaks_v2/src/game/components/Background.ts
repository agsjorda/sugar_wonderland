import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { playSpineAnimationSequence } from "./SpineBehaviorHelper";
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

		// Add plane spine animation
		this.createJetFighterSpineAnimation(scene, assetScale);

		// Add reel frame
		this.reelFrame = scene.add.image(
				scene.scale.width * 0.495,
				scene.scale.height * 0.61,
				'reel-frame'
			).setOrigin(0.5, 0.95)
			.setScale(assetScale * 0.323, assetScale * 0.291)
			.setDepth(this.reelFrameDepth);
		this.bgContainer.add(this.reelFrame);

		// Add rifle spine
		this.createRifleSpine(scene);

		// Listen for symbol match (use WIN_START as the global signal for wins)
		gameEventManager.on(GameEventType.WIN_START, () => {
			// this.toggleRifleSpineAnimation(true);
		});

		// Listen for symbol match (use WIN_START as the global signal for wins)
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			// this.toggleRifleSpineAnimation(false);
		});
	}

	private createRifleImage(scene: Scene, assetScale: number) : void 
	{
		const rifleImage = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height,
			'rifle'
		).setOrigin(0.5, 1).setScale(assetScale).setDepth(1);
		this.bgContainer.add(rifleImage);
	}

	private createRifleSpine(scene: Scene) : void 
	{
		this.rifleSpine = scene.add.spine(0, 0, "columns_rifle", "columns_rifle-atlas");
		const scale = 0.425;
		const offset = {x: 0, y: 0};
		const anchor = {x: 0.5, y: 1};
		const origin = {x: 0.5, y: 0.85};
		playSpineAnimationSequence(scene, this.rifleSpine, [1], {x: scale, y: scale}, anchor, origin, offset);
		this.rifleSpine.animationState.timeScale = 0;

		this.bgContainer.add(this.rifleSpine);
	}

	private toggleRifleSpineAnimation(isPlaying: boolean) : void {
		if(gameStateManager.isBonus) {
			this.rifleSpine.animationState.timeScale = 0;
			return;
		}
		
		const trackEntry = this.rifleSpine.animationState.getCurrent(0);
		if(trackEntry && trackEntry.trackTime) {
			trackEntry.trackTime = 0;
		}
		this.rifleSpine.animationState.timeScale = isPlaying ? 1 : 0;

		// Play / stop ARGUN_WF SFX in sync with rifle animation
		try {
			const audio = (window as any)?.audioManager;
			if (!audio) return;

			if (isPlaying && typeof audio.playSoundEffect === 'function') {
				audio.playSoundEffect(SoundEffectType.ARGUN);
				console.log('[Background] Playing ARGUN_WF SFX for rifle spine animation');
			} else if (!isPlaying && typeof audio.fadeOutSfx === 'function') {
				// Fade out and stop ARGUN when animation stops
				audio.fadeOutSfx(SoundEffectType.ARGUN, 300);
				console.log('[Background] Fading out ARGUN_WF SFX as rifle spine animation stops');
			}
		} catch {
			// Fail silently to avoid breaking gameplay if audio is unavailable
		}
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

	private createJetFighterSpineAnimation(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[Header] createJetFighterSpineAnimation')) {
				console.warn('[Header] Spine factory unavailable. Skipping jet fighter spine creation.');
				return;
			}
			const scale = {x: 1, y: 1};
			const depth = 1;
			const position = {x: scene.scale.width * 0.5, y: scene.scale.height * 0.1};

			// Create the Spine animation object
			const spineObject = scene.add.spine(position.x, position.y, "jetfighter", "jetfighter-atlas");
			spineObject.setOrigin(0.5, 0.5);
			spineObject.setScale(scale.x, scale.y); // Negative X scale to flip horizontally
			spineObject.setDepth(depth); // Set explicit depth below win bar (10)
			spineObject.animationState.setAnimation(0, "jetfighter_wf_win", true);
			spineObject.animationState.timeScale = 0.5;
			
			this.bgContainer.add(spineObject);

			console.log('[Header] Spine jet fighter animation created successfully');
		} catch (error) {
			console.error('[Header] Error creating Spine jet fighter animation:', error);
		}
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		this.fitBackgroundToScreen(scene);
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	getReelFrame(): Phaser.GameObjects.Image | undefined {
		return this.reelFrame;
	}
}
