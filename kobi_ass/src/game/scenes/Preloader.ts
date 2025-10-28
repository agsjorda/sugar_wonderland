import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ensureSpineLoader } from '../../utils/SpineGuard';
import { StudioLoadingScreen } from '../components/StudioLoadingScreen';

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
		
		// Black background for studio loading
		this.cameras.main.setBackgroundColor(0x000000);

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
		// Display studio loading screen
		const studio = new StudioLoadingScreen(this);
		studio.show();
		// Schedule fade-out after minimum 3s, then reveal preloader UI if needed
		studio.fadeOutAndDestroy(3000, 500);

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

			// Add Kobi logo
			const kobi_logo = this.add.image(
				this.scale.width * 0.5, 
				this.scale.height * 0.14, 
				"kobi_logo_loading"
			).setOrigin(0.5, 0.5).setScale(assetScale);
			
			console.log(`[Preloader] Added kobi_logo_loading at scale: ${assetScale}x`);

			this.tweens.add({
				targets: this.buttonSpin,
				rotation: Math.PI * 2,
				duration: 5000,
				repeat: -1,
			});

			// Progress bar below the spinning button
			const barWidth = this.scale.width * 0.5;
			const barHeight = Math.max(18, 30 * assetScale);
			const barX = this.scale.width * 0.5;
			const barY = buttonY + (this.buttonBg.displayHeight * 0.5) + Math.max(20, 24 * assetScale) + 50;

			this.progressBarBg = this.add.graphics();
			this.progressBarBg.fillStyle(0x000000, 0.5);
			this.progressBarBg.fillRoundedRect(barX - barWidth * 0.5, barY - barHeight * 0.5, barWidth, barHeight, barHeight * 0.5);

			this.progressBarFill = this.add.graphics();
			this.progressBarFill.fillStyle(0x66D449, 1);
			this.progressBarFill.fillRoundedRect(barX - barWidth * 0.5 + this.progressBarPadding, barY - barHeight * 0.5 + this.progressBarPadding, 0, barHeight - this.progressBarPadding * 2, (barHeight - this.progressBarPadding * 2) * 0.5);

			// Save geometry for updates
			this.progressBarX = barX;
			this.progressBarY = barY;
			this.progressBarWidth = barWidth;
			this.progressBarHeight = barHeight;

			this.progressText = this.add.text(barX, barY, '0%', {
				fontFamily: 'poppins-bold',
				fontSize: `${Math.round(18 * assetScale)}px`,
				color: '#FFFFFF',
			})
			.setOrigin(0.5, 0.5)
			.setShadow(0, 3, '#000000', 6, true, true);

			// "Press Play To Continue" text (initially hidden)
			this.pressToPlayText = this.add.text(barX, barY - (barHeight * 1), 'Press Play To Continue', {
				fontFamily: 'Poppins-Regular',
				fontSize: `${Math.round(22 * assetScale)}px`,
				color: '#FFFFFF',
				align: 'center'
			})
			.setOrigin(0.5, 1)
			.setAlpha(0)
			.setShadow(0, 3, '#000000', 6, true, true);

		}

		// Set up progress event listener
		this.load.on('progress', (progress: number) => {
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

			// Keep emitting for React overlay listeners if any
			EventBus.emit('progress', progress);
		});
		
		EventBus.emit('current-scene-ready', this);	
	}

	preload ()
	{
		// Prefer more parallel requests on modern networks
		this.load.maxParallelDownloads = Math.max(this.load.maxParallelDownloads, 8);
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
		// Load Scatter Anticipation spine (portrait/high only asset paths)
		this.assetLoader.loadScatterAnticipationAssets(this);
		this.assetLoader.loadBonusBackgroundAssets(this);
		this.assetLoader.loadNumberAssets(this);
		this.assetLoader.loadCoinAssets(this);
		this.assetLoader.loadBuyFeatureAssets(this);
		this.assetLoader.loadMenuAssets(this);
		this.assetLoader.loadHelpScreenAssets(this);
		
		console.log(`[Preloader] Loading assets for Preloader and Game scenes`);
	}

    async create ()
    {
        // Initialize GameAPI and get the game token
        try {
            console.log('[Preloader] Initializing GameAPI...');
            const gameToken = await this.gameAPI.initializeGame();
            console.log('[Preloader] Game URL Token:', gameToken);
            console.log('[Preloader] GameAPI initialized successfully!');
        } catch (error) {
            console.error('[Preloader] Failed to initialize GameAPI:', error);
        }

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

        // Prepare fade overlay
        const fadeOverlay = this.add.rectangle(
            this.scale.width * 0.5,
            this.scale.height * 0.5,
            this.scale.width,
            this.scale.height,
            0x000000
        ).setOrigin(0.5, 0.5).setScrollFactor(0).setAlpha(0);

        // Start game on click
        this.buttonSpin?.once('pointerdown', () => {
            this.tweens.add({
                targets: fadeOverlay,
                alpha: 1,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    console.log('[Preloader] Starting Game scene after click');
                    this.scene.start('Game', { 
                        networkManager: this.networkManager, 
                        screenModeManager: this.screenModeManager 
                    });
                }
            });
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
}
