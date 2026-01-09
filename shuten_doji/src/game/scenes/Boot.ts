import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { ClockDisplay } from '../components/ClockDisplay';
import { ImageShinePipeline, IMAGE_SHINE_PIPELINE_KEY } from '../shaders/ImageShinePipeline';

export class Boot extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;
	private clockDisplay: ClockDisplay;

	constructor ()
	{
		super('Boot');
		this.networkManager = new NetworkManager();
		this.screenModeManager = new ScreenModeManager();
		this.screenModeManager.forceOrientation('portrait');
		
		// Initialize asset configuration
		this.assetConfig = new AssetConfig(this.networkManager, this.screenModeManager);
		this.assetLoader = new AssetLoader(this.assetConfig);
	}

	init ()
	{
		console.log('Boot scene init');
		EventBus.emit('current-scene-ready', this);
	}

	preload ()
	{
		// Show debug info
		this.assetConfig.getDebugInfo();
		
		console.log(`[Boot] Asset loading configuration:`);
		console.log(`[Boot] - Asset scale: ${this.networkManager.getAssetScale()}x`);
		console.log(`[Boot] - Asset prefix: ${this.assetConfig['getAssetPrefix']()}`);
		
		// Load loading assets using AssetLoader
		this.assetLoader.loadLoadingAssets(this);
		this.assetLoader.loadFontAssets(this);
		
		console.log(`[Boot] Loading assets for Boot scene`);
	}

	create ()
	{
		// Register custom pipelines once at boot (WebGL only).
		// Safe to call repeatedly, but we keep it here so all scenes can use the pipeline by key.
		if (this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
			this.game.renderer.pipelines.add(
				IMAGE_SHINE_PIPELINE_KEY,
				new ImageShinePipeline(this.game)
			);
		}

		this.clockDisplay = new ClockDisplay(this, {
			gameTitle: 'The Shuten Doji',
		});
		this.clockDisplay.create();

		// Emit the screen mode manager so UI components can access it
		EventBus.emit('screen-mode-manager-ready', this.screenModeManager);
		
		this.scene.start('Preloader', { 
			networkManager: this.networkManager, 
			screenModeManager: this.screenModeManager 
		});
	}
}
