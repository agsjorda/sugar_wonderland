import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { StudioLoadingScreen, queueGameAssetLoading } from '../components/StudioLoadingScreen';
import { ClockDisplay } from '../components/ClockDisplay';
import { SoundEffectType } from '../../managers/AudioManager';

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
	private preloaderVerticalOffsetModifier: number = 10;
	private clockDisplay?: ClockDisplay;
	private lazyBonusLoadStarted: boolean = false;

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
		
		console.log(`[Preloader] Applying asset scale: ${assetScale}x`);
		
		// Background color for studio loading (#10161D)
		this.cameras.main.setBackgroundColor(0x10161D);

		// Layered loading backgrounds (default first, then loading overlay), both scaled to cover
		const bgDefault = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			"loading_background_default"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-2);

		const defScaleX = this.scale.width / bgDefault.width;
		const defScaleY = this.scale.height / bgDefault.height;
		const defScale = Math.max(defScaleX, defScaleY);
		bgDefault.setScale(defScale);

		const bgLoading = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			"loading_background"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-1);

		const loadScaleX = this.scale.width / bgLoading.width;
		const loadScaleY = this.scale.height / bgLoading.height;
		const loadScale = Math.max(loadScaleX, loadScaleY);
		bgLoading.setScale(loadScale);

		console.log(`[Preloader] BG-default size: ${bgDefault.width}x${bgDefault.height} scale=${defScale}`);
		console.log(`[Preloader] BG-loading size: ${bgLoading.width}x${bgLoading.height} scale=${loadScale}`);

		// Create persistent clock display (stays visible during studio loading and preloader)
		const clockY = this.scale.height * 0.009; // Slightly below top edge
		this.clockDisplay = new ClockDisplay(this, {
			offsetX: -155,
			offsetY: clockY,
			fontSize: 16,
			color: '#FFFFFF',
			alpha: 0.5,
			depth: 30000, // Very high depth to stay above all overlays and transitions
			scale: 0.7,
			suffixText: ' | Kobo Ass',
			additionalText: 'DiJoker',
			additionalTextOffsetX: 185,
			additionalTextOffsetY: 0,
			additionalTextScale: 0.7,
			additionalTextColor: '#FFFFFF',
			additionalTextFontSize: 16
		});
		this.clockDisplay.create();

		// Add loading frame, tagline, and website URL on top of background
		const loadingFrameY = 335 + this.preloaderVerticalOffsetModifier;
		const loadingFrame = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5 + loadingFrameY,
			"loading_frame_2"
		).setOrigin(0.5, 0.5).setScrollFactor(0);

		// Scale loading frame using same modifier as studio loading screen (0.04)
		const frameScale = (Math.max(this.scale.width / loadingFrame.width, this.scale.height / loadingFrame.height)) * 0.04;
		loadingFrame.setScale(frameScale);

		// "PLAY LOUD. WIN WILD. DIJOKER STYLE" tagline
		const textY = 365 + this.preloaderVerticalOffsetModifier;
		const tagline = this.add.text(
			this.scale.width * 0.5 - 5,
			this.scale.height * 0.5 + textY,
			'PLAY LOUD. WIN WILD. DIJOKER STYLE',
			{
				fontFamily: 'Poppins-Regular',
				fontSize: '14px',
				color: '#FFFFFF',
				fontStyle: 'normal',
				align: 'center'
			}
		).setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setAlpha(1);

		// Set font weight to 500 for tagline
		try {
			const textObj = tagline as any;
			const originalUpdateText = textObj.updateText?.bind(textObj);
			if (originalUpdateText) {
				textObj.updateText = function (this: any) {
					originalUpdateText();
					if (this.context) {
						this.context.font = `500 14px Poppins-Regular`;
					}
				}.bind(textObj);
				textObj.updateText();
			}
		} catch (e) {
			console.warn('[Preloader] Could not set font weight for loading text', e);
		}

		// "www.dijoker.com" text below tagline
		const websiteTextY = 395 + this.preloaderVerticalOffsetModifier;
		const websiteText = this.add.text(
			this.scale.width * 0.5,
			this.scale.height * 0.5 + websiteTextY,
			'www.dijoker.com',
			{
				fontFamily: 'Poppins-Regular',
				fontSize: '14px',
				color: '#FFFFFF',
				fontStyle: 'normal',
				align: 'center'
			}
		).setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setAlpha(1);

		// Set font weight to 500 for website text and add "Win up to 21,000x" breathing text
		try {
			const textObj = websiteText as any;
			const originalUpdateText = textObj.updateText?.bind(textObj);
			if (originalUpdateText) {
				textObj.updateText = function (this: any) {
					originalUpdateText();
					if (this.context) {
						this.context.font = `500 14px Poppins-Regular`;
					}
				}.bind(textObj);
				textObj.updateText();
			}

			// "Win up to 21,000x" text with breathing animation
			const winTextY = 140 + this.preloaderVerticalOffsetModifier;
			const winText = this.add.text(
				this.scale.width * 0.5,
				this.scale.height * 0.5 + winTextY,
				'Win up to 6,750x',
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

			this.tweens.add({
				targets: winText,
				scale: { from: 0.90, to: 1.15 },
				duration: 1200,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1,
				hold: 0,
				delay: 0
			});

			winText.setStroke('#379557', 4)
				.setShadow(0, 2, '#000000', 4, true, true);
		} catch (e) {
			console.warn('[Preloader] Could not set font weight for website / win text', e);
		}

		if (screenConfig.isPortrait) {
			// Match button vertical offset
			const buttonY = this.scale.height * 0.77;
			
			// Scale buttons based on quality
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

			// Breathing animation for the logo
			this.tweens.add({
				targets: kobi_logo,
				scale: { from: assetScale * 0.95, to: assetScale * 1.15 },
				duration: 1500,
				ease: 'Sine.easeInOut',
				yoyo: true,
				repeat: -1,
				hold: 0,
				delay: 0
			});

			this.tweens.add({
				targets: this.buttonSpin,
				rotation: Math.PI * 2,
				duration: 5000,
				repeat: -1,
			});

			// No additional text label below the button in this version

		}

		// Ensure HTML boot-loader overlay is gone
		try { (window as any).hideBootLoader?.(); } catch {}
		
		EventBus.emit('current-scene-ready', this);	
	}

	preload ()
	{
		// No heavy loading here; assets are loaded during Boot's studio loading
		this.assetConfig.getDebugInfo();
		console.log(`[Preloader] Assets already loaded during Boot studio loading`);
	}

    async create ()
    {
        // Initialize GameAPI, generate token, and call backend initialize endpoint
        try {
            console.log('[Preloader] Initializing GameAPI...');
            const gameToken = await this.gameAPI.initializeGame();
            console.log('[Preloader] Game URL Token:', gameToken);
            console.log('[Preloader] GameAPI initialized successfully!');

            // Fetch initialization data (including any granted free spin rounds)
            try {
                console.log('[Preloader] Calling backend slot initialization...');
                const slotInitData = await this.gameAPI.initializeSlotSession();
                console.log('[Preloader] Slot initialization data:', slotInitData);
            } catch (error) {
                console.error('[Preloader] Failed to initialize slot session:', error);
            }
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

		// Hover/click feedback and click SFX on the preloader button (mirror other project)
		if (this.buttonSpin) {
			const spin = this.buttonSpin;
			const bg = this.buttonBg;
			const baseScaleX = spin.scaleX;
			const baseScaleY = spin.scaleY;
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
				// Play click SFX (prefer AudioManager if available; fallback to raw sound)
				try {
					const audio = (window as any).audioManager;
					if (audio && typeof audio.playSoundEffect === 'function') {
						audio.playSoundEffect(SoundEffectType.MENU_CLICK);
					} else {
						try { this.sound.play('click_sw', { volume: 0.55 }); } catch {}
					}
				} catch {}
				// Press visual
				this.tweens.killTweensOf(spin);
				if (bg) this.tweens.killTweensOf(bg);
				this.tweens.add({
					targets: [spin, bg].filter(Boolean) as any,
					scaleX: (t: any) => (t === spin ? baseScaleX * 0.9 : baseBgScaleX * 0.96),
					scaleY: (t: any) => (t === spin ? baseScaleY * 0.9 : baseBgScaleY * 0.96),
					duration: 80,
					ease: 'Power2'
				});
				if (bg) {
					const startAlpha = bg.alpha;
					this.tweens.add({ targets: bg, alpha: Math.min(0.5, startAlpha + 0.2), duration: 80, yoyo: true, ease: 'Linear' });
				}
			});
			const bounceBack = () => {
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
                        screenModeManager: this.screenModeManager,
                        // Pass the same GameAPI instance so initialization data is shared
                        gameAPI: this.gameAPI
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
