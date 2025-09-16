import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';

export class Preloader extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;
	private gameAPI: GameAPI;

	constructor ()
	{
		super('Preloader');
	}

	init (data: any)
	{
		// Receive managers from Boot scene
		this.networkManager = data.networkManager;
		this.screenModeManager = data.screenModeManager;
		
		// Initialize asset configuration
		this.assetConfig = new AssetConfig(this.networkManager, this.screenModeManager);
		this.assetLoader = new AssetLoader(this.assetConfig);
		
		// Initialize GameAPI
		const gameData = new GameData();
		this.gameAPI = new GameAPI(gameData);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Preloader] Applying asset scale: ${assetScale}x`);
		
		// Always show background since we're forcing portrait mode
		const background = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height * 0.5, 
			"loading_background"
		).setOrigin(0.5, 0.5).setScrollFactor(0);
		
		// Calculate scale to cover the entire screen
		const scaleX = this.scale.width / background.width;
		const scaleY = this.scale.height / background.height;
		const scale = Math.max(scaleX, scaleY);
		
		background.setScale(scale);
		
		console.log(`[Preloader] Background original size: ${background.width}x${background.height}`);
		console.log(`[Preloader] Canvas size: ${this.scale.width}x${this.scale.height}`);
		console.log(`[Preloader] Calculated scale: ${scale} (scaleX: ${scaleX}, scaleY: ${scaleY})`);
		
		
		console.log(`[Preloader] Background dimensions: ${background.width}x${background.height}, canvas: ${this.scale.width}x${this.scale.height}`);
		console.log(`[Preloader] Background display size: ${this.scale.width}x${this.scale.height}`);
		console.log(`[Preloader] Background position: (${this.scale.width * 0.5}, ${this.scale.height * 0.5})`);

		if (screenConfig.isPortrait) {
			const buttonY = this.scale.height * 0.8;
			
			// Scale buttons based on quality (low quality assets need 2x scaling)
			const buttonBg = this.add.image(
				this.scale.width * 0.5, 
				buttonY, 
				"button_bg"
			).setOrigin(0.5, 0.5).setScale(assetScale);

			const buttonSpin = this.add.image(
				this.scale.width * 0.5, 
				buttonY, 
				"button_spin"
			).setOrigin(0.5, 0.5).setScale(assetScale);

			console.log(`[Preloader] Button scaling: ${assetScale}x`);

			// Add Kobi logo
			const kobi_logo = this.add.image(
				this.scale.width * 0.5, 
				this.scale.height * 0.14, 
				"kobi_logo_loading"
			).setOrigin(0.5, 0.5).setScale(assetScale);
			
			console.log(`[Preloader] Added kobi_logo_loading at scale: ${assetScale}x`);

			this.tweens.add({
				targets: buttonSpin,
				rotation: Math.PI * 2,
				duration: 5000,
				repeat: -1,
			});
		}

		// Set up progress event listener
		this.load.on('progress', (progress: number) => {
			EventBus.emit('progress', progress);
		});
		
		EventBus.emit('current-scene-ready', this);	
	}

	preload ()
	{
		// Show debug info
		this.assetConfig.getDebugInfo();

		
		// Load background and header assets (will be used in Game scene)
		this.assetLoader.loadBackgroundAssets(this);
		this.assetLoader.loadHeaderAssets(this);
		this.assetLoader.loadBonusHeaderAssets(this);
		this.assetLoader.loadSymbolAssets(this);
		this.assetLoader.loadButtonAssets(this);
		this.assetLoader.loadFontAssets(this);
		this.assetLoader.loadSpinnerAssets(this);
		this.assetLoader.loadDialogAssets(this);
		this.assetLoader.loadBonusBackgroundAssets(this);
		this.assetLoader.loadNumberAssets(this);
		this.assetLoader.loadCoinAssets(this);
		this.assetLoader.loadBuyFeatureAssets(this);
		this.assetLoader.loadAudioAssets(this);
		
		console.log(`[Preloader] Loading assets for Preloader and Game scenes`);
		
		// Load some dummy assets for loading simulation
		const prefix = this.assetConfig['getAssetPrefix']();
		for (let i = 0; i < 10; i++) {
			this.load.image(`dummy ${i}`, prefix + '/loading/image.png');
		}
	}

	async create ()
	{
		//  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
		//  For example, you can define global animations here, so we can use them in other scenes.
		
		// Initialize GameAPI and get the game token
		try {
			console.log('[Preloader] Initializing GameAPI...');
			const gameToken = await this.gameAPI.initializeGame();
			console.log('[Preloader] Game URL Token:', gameToken);
			console.log('[Preloader] GameAPI initialized successfully!');
		} catch (error) {
			console.error('[Preloader] Failed to initialize GameAPI:', error);
		}
		
		// Create fade to black overlay
		const fadeOverlay = this.add.rectangle(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			this.scale.width,
			this.scale.height,
			0x000000
		).setOrigin(0.5, 0.5).setScrollFactor(0).setAlpha(0);
		
		// Fade to black and then start the Game scene
		this.tweens.add({
			targets: fadeOverlay,
			alpha: 1,
			duration: 500,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Preloader] Fade to black complete, starting Game scene');
				//  Move to the Game scene and pass the managers
				this.scene.start('Game', { 
					networkManager: this.networkManager, 
					screenModeManager: this.screenModeManager 
				});
			}
		});
		
	}
}
