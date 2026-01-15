import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenConfig, ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { StudioLoadingScreen } from '../components/StudioLoadingScreen';
import { ClockDisplay } from '../components/ClockDisplay';
import { playUtilityButtonSfx } from '../../utils/audioHelpers';
import { IMAGE_SHINE_PIPELINE_KEY } from '../shaders/ImageShinePipeline';


export class Preloader extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;
	private gameAPI: GameAPI;

	// Loading bar graphics
	private progressBarBg?: Phaser.GameObjects.Graphics;
	private progressBarFill?: Phaser.GameObjects.Graphics;
	private progressText?: Phaser.GameObjects.Text;
	private progressBarX?: number;
	private progressBarY?: number;
	private progressBarWidth?: number;
	private progressBarHeight?: number;
	private progressBarPadding: number = 3;

	// UI elements we need after load
	private buttonSpin?: Phaser.GameObjects.Image;
	private buttonBg?: Phaser.GameObjects.Image;
	private pressToPlayText?: Phaser.GameObjects.Text;
	private fullscreenBtn?: Phaser.GameObjects.Image;
	private clockDisplay: ClockDisplay;

	private studioLoadingScreen?: StudioLoadingScreen;
	private preloaderLogo?: Phaser.GameObjects.Image;
	private darkFeatheringTop?: Phaser.GameObjects.Image;
	private darkFeatheringBottom?: Phaser.GameObjects.Image;
	private assetsLoaded: boolean = false;
	private backendInitialized: boolean = false;
	private gameTransitionStarted: boolean = false;

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

		this.createClockDisplay();
		this.createWebsiteText();
		
		console.log(`[Preloader] Applying asset scale: ${assetScale}x`);
		
		// Black background for studio loading
		this.cameras.main.setBackgroundColor(0x000000);

		// Hide the HTML boot loader right as the Phaser preloader scene begins,
		// so the studio loading screen underneath becomes visible.
		try {
			const hideBootLoader = (window as any).hideBootLoader;
			if (typeof hideBootLoader === 'function') {
				hideBootLoader();
			}
		} catch (_e) {
			/* no-op */
		}

		this.createBackground();

		// Feathering overlays (already loaded in Boot via getLoadingAssets)
		this.createDarkFeatheringOverlays();

		// Logo (will appear once `logo` finishes loading in this scene)
		this.createLogoImage();

		this.scale.on('resize', () => this.layoutPreloaderOverlays());

		this.setUpStudioLoadingScreen(screenConfig, assetScale);
		

		// Set up progress event listener
		this.load.on('progress', (progress: number) => {
			// Update studio loading screen progress bar
			if (this.studioLoadingScreen) {
				this.studioLoadingScreen.updateProgress(progress);
			}

			// Update in-scene progress bar
			if (this.progressBarFill && this.progressBarX !== undefined && this.progressBarY !== undefined && this.progressBarWidth !== undefined && this.progressBarHeight !== undefined) {
				const innerX = this.progressBarX - this.progressBarWidth * 0.5 + this.progressBarPadding;
				const innerY = this.progressBarY - this.progressBarHeight * 0.5 + this.progressBarPadding;
				const innerWidth = this.progressBarWidth - this.progressBarPadding * 2;
				const innerHeight = this.progressBarHeight - this.progressBarPadding * 2;
				this.progressBarFill.clear();
				this.progressBarFill.fillStyle(0x66D449, 1);
				this.progressBarFill.fillRoundedRect(
					innerX,
					innerY,
					Math.max(0.0001, innerWidth * progress),
					innerHeight,
					innerHeight * 0.5
				);
			}
			if (this.progressText) {
				this.progressText.setText(`${Math.round(progress * 100)}%`);
			}

			// Mirror progress to the HTML boot loader (if present)
			try {
				const setBootLoaderProgress = (window as any).setBootLoaderProgress;
				if (typeof setBootLoaderProgress === 'function') {
					setBootLoaderProgress(progress);
				}
			} catch (_e) {
				/* no-op */
			}

			// Keep emitting for React overlay listeners if any
			EventBus.emit('progress', progress);
		});

		// Set up complete event listener to mark assets as loaded
		this.load.on('complete', () => {
			console.log('[Preloader] All assets loaded');
			this.assetsLoaded = true;
			this.checkReadyToTransition();
		});
		
		EventBus.emit('current-scene-ready', this);	
	}

	preload ()
	{
		// Ensure logo appears ASAP once it's available
		this.load.once('filecomplete-image-logo', () => {
			this.createLogoImage();
			this.layoutPreloaderOverlays();
		});

		// Prefer more parallel requests on modern networks
		this.load.maxParallelDownloads = Math.max(this.load.maxParallelDownloads, 8);
		// Show debug info
		this.assetConfig.getDebugInfo();
		
		// Load background and header assets (will be used in Game scene)
		this.assetLoader.loadBackgroundAssets(this);
		this.assetLoader.loadHeaderAssets(this);
		this.assetLoader.loadBonusHeaderAssets(this);
		this.assetLoader.loadSymbolAssets(this);
		this.assetLoader.loadSymbolEffectsAssets(this);
		this.assetLoader.loadButtonAssets(this);
		// Fonts are already loaded in Boot scene, no need to load again
		this.assetLoader.loadSpinnerAssets(this);
		this.assetLoader.loadDialogAssets(this);
		// Load Scatter Anticipation spine (portrait/high only asset paths)
		this.assetLoader.loadScatterAnticipationAssets(this);
		this.assetLoader.loadBonusBackgroundAssets(this);
		this.assetLoader.loadNumberAssets(this);
		this.assetLoader.loadCoinAssets(this);
		this.assetLoader.loadBuyFeatureAssets(this);
		this.assetLoader.loadMenuAssets(this);
		this.assetLoader.loadHelpScreenAssets(this);
		this.assetLoader.loadAudioAssets(this);
		
		console.log(`[Preloader] Loading assets for Preloader and Game scenes`);
	}

    async create ()
    {
		try {
			const demoState = this.gameAPI.getDemoState();
			console.log('[Preloader] Demo state:', demoState);
		} catch (error) {
			console.error('[Preloader] Failed to get demo state:', error);
		}
		
        // Initialize GameAPI and get the game token
        try {
            console.log('[Preloader] Initializing GameAPI...');
            const gameToken = await this.gameAPI.initializeGame();
            console.log('[Preloader] Game URL Token:', gameToken);
            console.log('[Preloader] GameAPI initialized successfully!');
        } catch (error) {
            console.error('[Preloader] Failed to initialize GameAPI:', error);
        }

        // Finalize the HTML boot loader progress (it was hidden in init)
        try {
            const setBootLoaderProgress = (window as any).setBootLoaderProgress;
            if (typeof setBootLoaderProgress === 'function') {
                setBootLoaderProgress(1);
            }
        } catch (_e) {
            /* no-op */
        }

		// Mark backend as initialized (even if it failed, we don't want to deadlock the loader)
		this.backendInitialized = true;
		this.checkReadyToTransition();

        // Create fullscreen toggle now that assets are loaded (using shared manager)
        const assetScale = this.networkManager.getAssetScale();
        this.fullscreenBtn = FullScreenManager.addToggle(this, {
            margin: 16 * assetScale,
            iconScale: 1.5 * assetScale,
            depth: 10000,
            maximizeKey: 'maximize',
            minimizeKey: 'minimize'
        });

        // Enable the spin button for user to continue
        if (this.buttonSpin) {
            this.buttonSpin.clearTint();
            this.buttonSpin.setAlpha(1);
            this.buttonSpin.setInteractive({ useHandCursor: true });
        }
        if (this.buttonBg) {
            this.buttonBg.clearTint();
            this.buttonBg.setAlpha(1);
        }

        // Show call-to-action text
        if (this.pressToPlayText) {
            this.pressToPlayText.setAlpha(1);
            this.tweens.add({
                targets: this.pressToPlayText,
                alpha: 0.3,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        // Start game on click
        this.buttonSpin?.once('pointerdown', () => {
            playUtilityButtonSfx(this);
			this.captureSnapshotAndStart();
        });

		// Ensure web fonts are applied after they are ready
		const fontsObj: any = (document as any).fonts;
		if (fontsObj && typeof fontsObj.ready?.then === 'function') {
			fontsObj.ready.then(() => {
				this.progressText?.setFontFamily('poppins-bold');
				this.pressToPlayText?.setFontFamily('poppins-regular');
			}).catch(() => {
				// Fallback: set families anyway
				this.progressText?.setFontFamily('poppins-bold');
				this.pressToPlayText?.setFontFamily('poppins-regular');
			});
		} else {
			// Browser without document.fonts support
			this.progressText?.setFontFamily('poppins-bold');
			this.pressToPlayText?.setFontFamily('poppins-regular');
		}
    }

	private createClockDisplay()
	{
		this.clockDisplay = new ClockDisplay(this, {
			gameTitle: `The Shuten Doji${this.gameAPI.getDemoState() ? ' | DEMO' : ''}`,
		});
		this.clockDisplay.create();
	}

	private createWebsiteText()
	{
		const preloaderVerticalOffsetModifier = 180;

		// "Win up to 21,000x" breathing text (aligned with felice_in_space_v2)
		// Must be above StudioLoadingScreen (depth 999) to be visible in forced-portrait games.
		const winTextY = preloaderVerticalOffsetModifier;
		const winText = this.add.text(
			this.scale.width * 0.5,
			this.scale.height * 0.5 + winTextY,
			'Win up to 21,000x',
			{
				fontFamily: 'poppins-bold',
				fontSize: '35px',
				color: '#FFFFFF',
				align: 'center'
			}
		)
		.setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setAlpha(1)
		.setDepth(998);

		// Add breathing animation to the win text
		this.tweens.add({
			targets: winText,
			scale: { from: 0.90, to: 1.15 },
			duration: 1200,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,  // Infinite repeat
			hold: 0,
			delay: 0
		});

		winText.setStroke('#99030A', 4) // Add red outline
		.setShadow(0, 2, '#000000', 4, true, true); // Add shadow for better visibility
	}

	private setUpStudioLoadingScreen(screenConfig: ScreenConfig, assetScale: number): void
	{
		if (!screenConfig.isPortrait) {
			return;
		}

		// Display studio loading screen
		this.studioLoadingScreen = new StudioLoadingScreen(this, {
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

		this.studioLoadingScreen.show();
		// Note: we fade the studio screen only once assets + backend are ready (see checkReadyToTransition)

		// Delay revealing Preloader's own progress UI until studio fade completes
		this.events.once('studio-fade-complete', () => {
			// Optionally, we could reveal or update UI elements here if they were hidden
			// For now, no-op; Preloader already shows its own progress bar
		});

		const buttonY = this.scale.height * 0.8;

		// Scale buttons based on quality (low quality assets need 2x scaling)
		this.buttonBg = this.add.image(
			this.scale.width * 0.5,
			buttonY,
			"button_bg"
		).setOrigin(0.5, 0.5).setScale(assetScale);

		this.buttonSpin = this.add.image(
			this.scale.width * 0.5,
			buttonY,
			"button_spin"
		).setOrigin(0.5, 0.5).setScale(assetScale);

		// Grey out and disable the spin button and background until load completes
		this.buttonSpin.setTint(0x777777).setAlpha(0.9);
		this.buttonBg.setTint(0x777777).setAlpha(0.9);
		this.buttonSpin.disableInteractive();

		console.log(`[Preloader] Button scaling: ${assetScale}x`);

		this.tweens.add({
			targets: this.buttonSpin,
			rotation: Math.PI * 2,
			duration: 5000,
			repeat: -1,
		});
	}
	
	private captureSnapshotAndStart()
	{
		// Prevent multiple attempts
		if (this.gameTransitionStarted) {
			return;
		}

		const startWithoutSnapshot = () => {
			this.startGameScene();
		};

		const snapshotKey = 'preloader_snapshot';

		try {
			// Remove any previous snapshot texture to avoid cache conflicts
			if (this.textures.exists(snapshotKey)) {
				this.textures.remove(snapshotKey);
			}

			// Create a RenderTexture snapshot of the current scene (mirrors shuten_doji_old).
			// We exclude the RT itself from the draw list so we don't recursively draw the snapshot into itself.
			const snapshotRT = this.add
				.renderTexture(0, 0, this.scale.width, this.scale.height)
				.setOrigin(0, 0);
			snapshotRT.setVisible(false);

			// Draw the current scene visuals into the RT, then save it as a texture key.
			const drawList = this.children.list.filter((go) => go !== snapshotRT);
			snapshotRT.draw(drawList);
			snapshotRT.saveTexture(snapshotKey);
			snapshotRT.destroy();

			console.log(`[Preloader] Saved snapshot texture: ${snapshotKey}`);
			this.startGameScene(snapshotKey);
		} catch (error) {
			console.warn('[Preloader] Snapshot capture failed; starting without overlay.', error);
			startWithoutSnapshot();
		}
	}


	private startGameScene(preloaderSnapshotKey?: string)
	{
		if (this.gameTransitionStarted) {
			return;
		}

		this.gameTransitionStarted = true;

		console.log('[Preloader] Starting Game scene after click');
		this.scene.start('Game', { 
			networkManager: this.networkManager, 
			screenModeManager: this.screenModeManager,
			gameAPI: this.gameAPI,
			preloaderSnapshotKey,
		});
	}

	private createBackground()
	{
		// Always show background since we're forcing portrait mode
		const background = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height * 0.5, 
			"loading_bg"
		).setOrigin(0.5, 0.5).setScrollFactor(0);
		
		// Calculate scale to cover the entire screen
		const scaleX = this.scale.width / background.width;
		const scaleY = this.scale.height / background.height;
		const scale = Math.max(scaleX, scaleY);
		
		background.setScale(scale);
	}

	private checkReadyToTransition()
	{
		// Only proceed if both assets and backend are ready
		if (!this.assetsLoaded || !this.backendInitialized) {
			console.log(`[Preloader] Waiting for completion... Assets: ${this.assetsLoaded}, Backend: ${this.backendInitialized}`);
			return;
		}

		console.log('[Preloader] All assets and backend ready! Transitioning studio loading screen...');

		// Trigger studio loading screen fade-out with minimum 3s visible time
		if (this.studioLoadingScreen) {
			this.studioLoadingScreen.bedazzle(2000, 500);
		}
	}

	private createDarkFeatheringOverlays()
	{
		try {
			if (this.darkFeatheringTop || this.darkFeatheringBottom) {
				return;
			}

			if (!this.textures.exists('dark_feathering')) {
				return;
			}

			const x = this.scale.width * 0.5;

			// Top overlay
			this.darkFeatheringTop = this.add.image(x, 0, 'dark_feathering')
				.setOrigin(0.5, 0)
				.setScrollFactor(0);

			// Bottom overlay (flipped vertically)
			this.darkFeatheringBottom = this.add.image(x, this.scale.height, 'dark_feathering')
				.setOrigin(0.5, 1)
				.setScrollFactor(0)
				.setFlipY(true);

			this.layoutPreloaderOverlays();
		} catch (e) {
			console.warn('[Preloader] Failed to create dark feathering overlays:', e);
		}
	}
	
	private createLogoImage()
	{
		try {
			if (this.preloaderLogo) {
				return;
			}

			if (!this.textures.exists('logo')) {
				return;
			}

			const x = this.scale.width * 0.5;
			const y = this.scale.height * 0.01;

			this.preloaderLogo = this.add.image(x, y, 'logo')
				.setOrigin(0.5, 0)
				.setScrollFactor(0)
				.setDepth(5);

			this.layoutPreloaderOverlays();
		} catch (e) {
			console.warn('[Preloader] Failed to create preloader logo image:', e);
		}
	}

	private layoutPreloaderOverlays()
	{
		// Stretch feathering along width; keep aspect ratio (scale uniformly by width)
		const featherScaleX = (img: Phaser.GameObjects.Image) => {
			if (!img.width) return 1;
			return this.scale.width / img.width;
		};

		if (this.darkFeatheringTop) {
			const s = featherScaleX(this.darkFeatheringTop);
			this.darkFeatheringTop
				.setPosition(this.scale.width * 0.5, 0)
				.setScale(s);
		}

		if (this.darkFeatheringBottom) {
			const s = featherScaleX(this.darkFeatheringBottom);
			this.darkFeatheringBottom
				.setPosition(this.scale.width * 0.5, this.scale.height)
				.setScale(s);
		}

		if (this.preloaderLogo) {
			const logoWidthRatio = 0.925;
			const logoVerticalOffsetRatio = 0.05;
			const logoHorizontalOffsetRatio = 0.55;

			// Scale logo to a reasonable fraction of screen width
			const targetWidth = this.scale.width * logoWidthRatio;
			const s = this.preloaderLogo.width ? (targetWidth / this.preloaderLogo.width) : 1;
			this.preloaderLogo
				.setPosition(this.scale.width * logoHorizontalOffsetRatio, this.scale.height * logoVerticalOffsetRatio)
				.setScale(s);

			// Apply shine shader to the logo (bottom -> top, 20px thickness)
			// Applied here so displayWidth/displayHeight are correct (pixel-based uniforms).
			const baseCfg = GameData.LOGO_SHINE_SHADER_CONFIG;
			const thicknessPx = baseCfg.thicknessPx ?? 20;

			this.preloaderLogo.setPipeline(IMAGE_SHINE_PIPELINE_KEY, {
				...baseCfg,
				startYPx: this.preloaderLogo.displayHeight + thicknessPx * 0.5,
			});
		}
	}
}
