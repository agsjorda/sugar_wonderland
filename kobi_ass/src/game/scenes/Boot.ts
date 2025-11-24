import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { StudioLoadingScreen, queueGameAssetLoading } from '../components/StudioLoadingScreen';

export class Boot extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;

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
		
		// Forward boot progress to optional HTML boot-loader (0%→25% of total)
		this.load.on('progress', (p: number) => {
			try { (window as any).setBootLoaderProgress?.(p * 0.25); } catch {}
		});

		// Load loading assets + web fonts up front
		this.assetLoader.loadLoadingAssets(this);
		this.assetLoader.loadFontAssets(this);
		
		console.log(`[Boot] Loading assets for Boot scene`);
	}

	create ()
	{
		// Emit the screen mode manager so UI components can access it
		EventBus.emit('screen-mode-manager-ready', this.screenModeManager);
		
		// Show in-game studio loading screen and start asset downloads here
		const startStudioLoading = () => {
			try { (window as any).hideBootLoader?.(); } catch {}
			const studio = new StudioLoadingScreen(this, {
				loadingFrameOffsetX: 0,
				loadingFrameOffsetY: 335,
				loadingFrameScaleModifier: 0.04,
				text: 'PLAY LOUD. WIN WILD. DIJOKER STYLE',
				textOffsetX: -5,
				textOffsetY: 365,
				textScale: 1,
				textColor: '#FFFFFF',
				text2: 'www.dijoker.com',
				text2OffsetX: 0,
				text2OffsetY: 370,
				text2Scale: 1,
				text2Color: '#FFFFFF'
			});
			studio.show();

			// Queue all game assets and start loader (progress handled by studio screen)
			queueGameAssetLoading(this, this.assetLoader);
			this.load.once('complete', () => {
				// After studio screen fades out, proceed to Preloader UI
				this.events.once('studio-fade-complete', () => {
					this.scene.start('Preloader', { 
						networkManager: this.networkManager, 
						screenModeManager: this.screenModeManager 
					});
				});
			});
			this.load.start();
		};

		// Start studio loading after web fonts are ready so text renders correctly
		const fontsObj: any = (document as any).fonts;
		if (fontsObj && typeof fontsObj.ready?.then === 'function') {
			fontsObj.ready.then(() => startStudioLoading()).catch(() => startStudioLoading());
		} else {
			startStudioLoading();
		}
	}
}
