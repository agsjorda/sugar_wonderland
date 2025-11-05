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

		// Always show layered backgrounds: default first, then loading overlay; both scaled to cover
		const bgDefault = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			"loading_background_default"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-2);

		// Scale default to cover
		const defScaleX = this.scale.width / bgDefault.width;
		const defScaleY = this.scale.height / bgDefault.height;
		const defScale = Math.max(defScaleX, defScaleY);
		bgDefault.setScale(defScale);

		const bgLoading = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			"loading_background"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-1);

		// Scale loading to cover
		const loadScaleX = this.scale.width / bgLoading.width;
		const loadScaleY = this.scale.height / bgLoading.height;
		const loadScale = Math.max(loadScaleX, loadScaleY);
		bgLoading.setScale(loadScale);

		console.log(`[Preloader] BG-default size: ${bgDefault.width}x${bgDefault.height} scale=${defScale}`);
		console.log(`[Preloader] BG-loading size: ${bgLoading.width}x${bgLoading.height} scale=${loadScale}`);

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

			// Add Hustle Horse logo
			const hustle_horse_logo = this.add.image(
				this.scale.width * 0.5, 
				this.scale.height * 0.14, 
				"hustle_horse_logo"
			).setOrigin(0.5, 0.5).setScale(assetScale);
            
            console.log(`[Preloader] Added hustle_horse_logo at scale: ${assetScale}x`);

            // Smooth lively pulse (scale up/down) using Sine for commercial-like feel
            const baseLogoScaleX = hustle_horse_logo.scaleX;
            const baseLogoScaleY = hustle_horse_logo.scaleY;
            this.tweens.add({
                targets: hustle_horse_logo,
                scaleX: baseLogoScaleX * 1.30,
                scaleY: baseLogoScaleY * 1.30,
                duration: 600,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

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
		// Load free-spin card spine for scatter card overlay
		this.assetLoader.loadAssetGroup(this, this.assetConfig.getFreeSpinCardAssets());
		// Ensure scatter win overlay assets (including fire spine) are loaded
		this.assetLoader.loadAssetGroup(this, this.assetConfig.getScatterWinOverlayAssets());
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

        // Simple hover and click animations for the loading spin button
        if (this.buttonSpin) {
            const spin = this.buttonSpin;
            const baseScaleX = spin.scaleX;
            const baseScaleY = spin.scaleY;
            const bg = this.buttonBg;
            const baseBgScaleX = bg ? bg.scaleX : 1;
            const baseBgScaleY = bg ? bg.scaleY : 1;
            spin.on('pointerover', () => {
                this.tweens.add({
                    targets: spin,
                    scaleX: baseScaleX * 1.05,
                    scaleY: baseScaleY * 1.05,
                    duration: 120,
                    ease: 'Power2'
                });
            });
            spin.on('pointerout', () => {
                this.tweens.add({
                    targets: [spin, bg].filter(Boolean) as any,
                    scaleX: (t: any) => (t === spin ? baseScaleX : baseBgScaleX),
                    scaleY: (t: any) => (t === spin ? baseScaleY : baseBgScaleY),
                    duration: 120,
                    ease: 'Power2'
                });
            });
            spin.on('pointerdown', () => {
                // Clear any ongoing tweens on press
                this.tweens.killTweensOf(spin);
                if (bg) this.tweens.killTweensOf(bg);
                // Press-in: scale both foreground and background for a clear feedback
                this.tweens.add({
                    targets: [spin, bg].filter(Boolean) as any,
                    scaleX: (t: any) => (t === spin ? baseScaleX * 0.9 : baseBgScaleX * 0.96),
                    scaleY: (t: any) => (t === spin ? baseScaleY * 0.9 : baseBgScaleY * 0.96),
                    duration: 80,
                    ease: 'Power2'
                });
                // Optional quick background flash for emphasis
                if (bg) {
                    const startAlpha = bg.alpha;
                    this.tweens.add({ targets: bg, alpha: Math.min(0.5, startAlpha + 0.2), duration: 80, yoyo: true, ease: 'Linear' });
                }
            });
            const bounceBack = () => {
                // Release: bounce a bit larger then settle to base
                this.tweens.add({
                    targets: spin,
                    scaleX: baseScaleX * 1.06,
                    scaleY: baseScaleY * 1.06,
                    duration: 90,
                    ease: 'Power2',
                    yoyo: true,
                    onYoyo: () => {
                        this.tweens.add({
                            targets: spin,
                            scaleX: baseScaleX,
                            scaleY: baseScaleY,
                            duration: 90,
                            ease: 'Power2'
                        });
                    }
                });
                if (bg) {
                    this.tweens.add({
                        targets: bg,
                        scaleX: baseBgScaleX,
                        scaleY: baseBgScaleY,
                        duration: 150,
                        ease: 'Power2'
                    });
                }
            };
            spin.on('pointerup', bounceBack);
            spin.on('pointerupoutside', bounceBack);
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
            // Fade out the Preloader camera, then start Game when complete
            this.cameras.main.once('camerafadeoutcomplete', () => {
                console.log('[Preloader] Starting Game scene after camera fade out');
                this.scene.start('Game', {
                    networkManager: this.networkManager,
                    screenModeManager: this.screenModeManager
                });
            });
            this.cameras.main.fadeOut(500, 0, 0, 0);
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
