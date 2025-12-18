import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ensureSpineLoader, ensureSpineFactory } from '../../utils/SpineGuard';
import { StudioLoadingScreen } from '../components/StudioLoadingScreen';
import { ClockDisplay } from '../components/ClockDisplay';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { hideSpineAttachmentsByKeywords, playSpineAnimationSequenceWithConfig } from '../components/SpineBehaviorHelper';
import { playUtilityButtonSfx } from '../../utils/audioHelpers';

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
	private preloaderLogoSpine?: SpineGameObject;
	private loadingHeaderTween?: Phaser.Tweens.Tween;
	private loadingHeaderBobTween?: Phaser.Tweens.Tween;
	private assetsLoaded: boolean = false;
	private backendInitialized: boolean = false;

	constructor ()
	{
		super('Preloader');
	}

	init (data: any)
	{
		// Check if add.spine is available - if not, reload the game
		const hasSpineFactory = ensureSpineFactory(this, '[Preloader] init');
		if (!hasSpineFactory) {
			console.error('[Preloader] add.spine is not recognized. Reloading the game...');
			setTimeout(() => {
				window.location.reload();
			}, 250);
			return;
		}

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
		this.createCharacter();
		this.createHeader();
		this.createFooter();

		// Cleanup any looping tweens when this scene transitions away.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			try { this.loadingHeaderTween?.stop(); } catch {}
			this.loadingHeaderTween = undefined;
			try { this.loadingHeaderBobTween?.stop(); } catch {}
			this.loadingHeaderBobTween = undefined;
		});
		
		// this.createSpineLogo();

		if (screenConfig.isPortrait) {
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

        // Prepare fade overlay
        const fadeOverlay = this.add.rectangle(
            this.scale.width * 0.5,
            this.scale.height * 0.5,
            this.scale.width,
            this.scale.height,
            0x000000
        )
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setAlpha(0)
            // Must render above the StudioLoadingScreen container (depth 999) and fullscreen toggle (depth 10000)
            .setDepth(20000);

        // Start game on click
        this.buttonSpin?.once('pointerdown', () => {
            playUtilityButtonSfx(this);
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

			// Cleanly fade out any remaining studio loading UI so it never overlaps gameplay.
			this.studioLoadingScreen?.fadeOutRemainingElements(500);
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
			gameTitle: 'Rainbow Fist',
		});
		this.clockDisplay.create();
	}

	private createWebsiteText()
	{
		const preloaderVerticalOffsetModifier = 10;
		
		// Add "www.dijoker.com" text
		const websiteTextY = 395 + preloaderVerticalOffsetModifier;
		const websiteText = this.add.text(
			this.scale.width * 0.5,
			this.scale.height * 0.5 + websiteTextY, // Position with modifier
			'www.dijoker.com',
			{
				fontFamily: 'poppins-regular',
				fontSize: '14px',
				color: '#FFFFFF',
				fontStyle: 'normal',
				align: 'center'
			}
		).setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setAlpha(1);

		// Set font weight to 500 for website text
		try {
			const textObj = websiteText as any;
			const originalUpdateText = textObj.updateText?.bind(textObj);
			if (originalUpdateText) {
				textObj.updateText = function(this: any) {
					originalUpdateText();
					if (this.context) {
						this.context.font = `500 14px poppins-regular`;
					}
				}.bind(textObj);
				textObj.updateText();

			// Add "Win up to 21,000x" text with the same style as "Press anywhere to continue"
			const winTextY = 140 + preloaderVerticalOffsetModifier;
			const winText = this.add.text(
				this.scale.width * 0.5,
				this.scale.height * 0.5 + winTextY,
				'Win up to 21,000x',
				{
					fontFamily: 'Poppins-SemiBold, Poppins-Regular, Arial, sans-serif',
					fontSize: '35px',
					color: '#FFFFFF',
					align: 'center'
				}
			)
			.setOrigin(0.5, 0.5)
			.setScrollFactor(0)
			.setAlpha(1);

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

			winText.setStroke('#379557', 4) // Add green outline
			.setShadow(0, 2, '#000000', 4, true, true); // Add shadow for better visibility
		}
		} catch (e) {
			console.warn('Could not set font weight for website text');
		}
	}

	private createBackground()
	{
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

	}

	private createHeader()
	{
		// Always show background since we're forcing portrait mode
		const background = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height * 0.5, 
			"loading_header"
		).setOrigin(0.5, 0.5).setScrollFactor(0);
		
		// Calculate scale to cover the entire screen
		const scaleX = this.scale.width / background.width;
		const scaleY = this.scale.height / background.height;
		const scale = Math.max(scaleX, scaleY);
		
		background.setScale(scale);

		// Subtle scale up/down ("breathing") animation for the header
		try {
			const baseScaleX = background.scaleX;
			const baseScaleY = background.scaleY;
			const amp = 1.02; // 2% pulse

			this.loadingHeaderTween?.stop();
			this.loadingHeaderTween = this.tweens.add({
				targets: background,
				scaleX: baseScaleX * amp,
				scaleY: baseScaleY * amp,
				duration: 900,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1,
			});

			// Small vertical bob to add a bit more life
			const baseY = background.y;
			const bobPx = 4;
			this.loadingHeaderBobTween?.stop();
			this.loadingHeaderBobTween = this.tweens.add({
				targets: background,
				y: baseY - bobPx,
				duration: 900,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1,
			});
		} catch (e) {
			console.warn('[Preloader] Could not start loading_header pulse tween:', e);
		}
	}

	private createFooter()
	{
		// Always show background since we're forcing portrait mode
		const footer = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height * 0.5, 
			"loading_footer"
		).setOrigin(0.5, 0.5).setScrollFactor(0);
		
		// Calculate scale to cover the entire screen
		const scaleX = this.scale.width / footer.width;
		const scaleY = this.scale.height / footer.height;
		const scale = Math.max(scaleX, scaleY);
		
		footer.setScale(scale);

		const feather = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height, 
			"loading_footer_feather"
		).setOrigin(0.5, 1).setScrollFactor(0);
	}

	private createCharacter()
	{
		// Always show background since we're forcing portrait mode
		const character = this.add.image(
			this.scale.width * 0.5, 
			this.scale.height * 0.5, 
			"loading_character"
		).setOrigin(0.5, 0.5).setScrollFactor(0);
		
		// Calculate scale to cover the entire screen
		const scaleX = this.scale.width / character.width;
		const scaleY = this.scale.height / character.height;
		const scale = Math.max(scaleX, scaleY);
		
		character.setScale(scale);
	}

	private createSpineLogo()
	{
		try {
			// Ensure Spine factory is available
			if (!ensureSpineFactory(this, '[Preloader] createSpineLogo')) {
				console.warn('[Preloader] Spine factory unavailable. Skipping preloader logo spine.');
				return;
			}

			// Make sure the spine data is in cache (Boot scene loads it via loading assets)
			const cacheJson: any = this.cache.json as any;
			if (!cacheJson?.has('warfreaks-logo-spine')) {
				console.warn('[Preloader] Spine json \'warfreaks-logo-spine\' not ready. Skipping preloader logo.');
				return;
			}

			const spine = (this.add as any).spine(0, 0, 'warfreaks-logo-spine', 'warfreaks-logo-spine-atlas') as SpineGameObject;
			const scale = 0.9;
			const offset = { x: 0, y: 12.5 };
			const anchor = { x: 0.5, y: 0 };
			const origin = { x: 0.5, y: 0 };

			hideSpineAttachmentsByKeywords(spine, ['bonus_base']);
			// Position at the top center of the screen, similar to header logo behavior
			playSpineAnimationSequenceWithConfig(this, spine, [0], { x: scale, y: scale }, anchor, origin, offset, 5, true);

			this.preloaderLogoSpine = spine;
		} catch (e) {
			console.warn('[Preloader] Failed to create preloader logo spine:', e);
		}
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
			this.studioLoadingScreen.bedazzle(3000, 500);
		}
	}
}
