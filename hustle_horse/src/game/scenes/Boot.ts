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
		this.assetConfig.getDebugInfo();
		
		console.log(`[Boot] Asset loading configuration:`);
		console.log(`[Boot] - Asset scale: ${this.networkManager.getAssetScale()}x`);
		console.log(`[Boot] - Asset prefix: ${this.assetConfig['getAssetPrefix']()}`);
		
		this.load.on('progress', (p: number) => {
			try { (window as any).setBootLoaderProgress?.(p * 0.25); } catch {}
		});
		
		this.assetLoader.loadLoadingAssets(this);
		this.assetLoader.loadFontAssets(this);
		
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
		
		// Start Preloader only after web fonts are ready, so Poppins-Regular is applied correctly
		const startPreloader = () => {
			this.scene.start('Preloader', {
				networkManager: this.networkManager,
				screenModeManager: this.screenModeManager
			});
		};
		
		const fontsObj: any = (document as any).fonts;
		if (fontsObj && typeof fontsObj.ready?.then === 'function') {
			fontsObj.ready.then(() => {
				console.log('[Boot] Web fonts ready, starting Preloader');
				startPreloader();
			}).catch((error: any) => {
				console.warn('[Boot] Font loading error, starting Preloader anyway', error);
				startPreloader();
			});
		} else {
			console.log('[Boot] document.fonts API not available, starting Preloader immediately');
			startPreloader();
		}
	}
}
