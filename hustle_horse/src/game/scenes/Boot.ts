import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { ClockDisplay } from '../components/ClockDisplay';

export class Boot extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;
	private clockDisplay?: ClockDisplay;

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
		
		console.log(`[Boot] Loading assets for Boot scene`);
	}

	create ()
	{
		// Create persistent clock display (stays on screen forever)
		const clockY = this.scale.height * 0.05; // 5% from top
		this.clockDisplay = new ClockDisplay(this, {
			offsetX: 0,
			offsetY: clockY,
			fontSize: 16,
			color: '#FFFFFF',
			alpha: 0.80,
			depth: 30000, // Very high depth to stay above all overlays and transitions
			suffixText: ' | Hustle The Blazing Horse',
			additionalText: 'DiJoker',
			additionalTextOffsetX: 0,
			additionalTextOffsetY: 0,
			additionalTextScale: 1.0,
			additionalTextColor: '#FFFFFF',
			additionalTextFontSize: 16
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
