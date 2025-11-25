import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { AssetLoader } from '../../utils/AssetLoader';
import { GameAPI } from '../../backend/GameAPI';
import { GameData } from '../components/GameData';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { StudioLoadingScreen, queueGameAssetLoading } from '../components/StudioLoadingScreen';
import { ClockDisplay } from '../components/ClockDisplay';

export class Preloader extends Scene
{
	private networkManager!: NetworkManager;
	private screenModeManager!: ScreenModeManager;
	private assetConfig!: AssetConfig;
	private assetLoader!: AssetLoader;
	private gameAPI!: GameAPI;
	private studio?: StudioLoadingScreen;

	// UI elements we need after load
	private buttonSpin?: Phaser.GameObjects.Image;
	private buttonBg?: Phaser.GameObjects.Image;
	private pressToPlayText?: Phaser.GameObjects.Text;
	private progressText?: Phaser.GameObjects.Text;
	private fullscreenBtn?: Phaser.GameObjects.Image;
	private clockDisplay?: ClockDisplay;
	private preloaderVerticalOffsetModifier: number = 10; // Vertical offset for Preloader elements only

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
		
		// Background color for studio loading (#10161D)
		this.cameras.main.setBackgroundColor(0x10161D);

		// Show a single loading background scaled to cover
		const bgLoading = this.add.image(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			"loading_background"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(-2);

		// Scale loading to cover
		const loadScaleX = this.scale.width / bgLoading.width;
		const loadScaleY = this.scale.height / bgLoading.height;
		const loadScale = Math.max(loadScaleX, loadScaleY);
		bgLoading.setScale(loadScale);

		console.log(`[Preloader] BG-loading size: ${bgLoading.width}x${bgLoading.height} scale=${loadScale}`);

		// Create persistent clock display (stays on screen forever)
		const clockY = this.scale.height * 0.009; // 2% from top
		this.clockDisplay = new ClockDisplay(this, {
			offsetX: -120,
			offsetY: clockY,
			fontSize: 16,
			color: '#FFFFFF',
			alpha: 0.5,
			depth: 30000, // Very high depth to stay above all overlays and transitions
			scale: 0.7,
			suffixText: ' | That\'s Bait',
			additionalText: 'DiJoker',
			additionalTextOffsetX: 185,
			additionalTextOffsetY: 0,
			additionalTextScale: 0.7,
			additionalTextColor: '#FFFFFF',
			additionalTextFontSize: 16
		});
		this.clockDisplay.create();

		// Add loading frame, text and website URL on top of BG-loading (appears instantly)
		const loadingFrameY = 335 + this.preloaderVerticalOffsetModifier;
		const loadingFrame = this.add.image(
			this.scale.width * 0.5 + 0,  // Offset X: 0 to match studio loading screen
			this.scale.height * 0.5 + loadingFrameY, // Y position with modifier
			"loading_frame_2"
		).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(0);

		// Scale loading frame using the same scale modifier as studio loading screen (0.04)
		const frameScale = (Math.max(this.scale.width / loadingFrame.width, this.scale.height / loadingFrame.height)) * 0.04;
		loadingFrame.setScale(frameScale);

		// Add "PLAY LOUD. WIN WILD. DIJOKER STYLE" text
		const textY = 365 + this.preloaderVerticalOffsetModifier;
		const text = this.add.text(
			this.scale.width * 0.5 - 5, // Slight offset to match original
			this.scale.height * 0.5 + textY, // Position with modifier
			'PLAY LOUD. WIN WILD. DIJOKER STYLE',
			{
				fontFamily: 'Poppins-Regular',
				fontSize: '14px',
				color: '#FFFFFF',
				fontStyle: 'normal',
				align: 'center',
				
			}
		).setOrigin(0.5, 0.5)
		.setScrollFactor(0)
		.setAlpha(1);

		// Set font weight to 500
		try {
			const textObj = text as any;
			const originalUpdateText = textObj.updateText?.bind(textObj);
			if (originalUpdateText) {
				textObj.updateText = function(this: any) {
					originalUpdateText();
					if (this.context) {
						this.context.font = `500 14px Poppins-Regular`;
					}
				}.bind(textObj);
				textObj.updateText();
			}
		} catch (e) {
			console.warn('Could not set font weight for loading text');
		}

		// Add "www.dijoker.com" text
		const websiteTextY = 395 + this.preloaderVerticalOffsetModifier;
		const websiteText = this.add.text(
			this.scale.width * 0.5,
			this.scale.height * 0.5 + websiteTextY, // Position with modifier
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

		// Set font weight to 500 for website text
		try {
			const textObj = websiteText as any;
			const originalUpdateText = textObj.updateText?.bind(textObj);
			if (originalUpdateText) {
				textObj.updateText = function(this: any) {
					originalUpdateText();
					if (this.context) {
						this.context.font = `500 14px Poppins-Regular`;
					}
				}.bind(textObj);
				textObj.updateText();

			// Add "Win up to 21,000x" text with the same style as "Press anywhere to continue"
			const winTextY = 140 + this.preloaderVerticalOffsetModifier;
			const winText = this.add.text(
				this.scale.width * 0.5,
				this.scale.height * 0.5 + winTextY,
				'Win up to 21,000x',
				{
					fontFamily: 'Poppins-Bold, Poppins-Regular, Arial, sans-serif',
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

		if (screenConfig.isPortrait) {
			// Display studio loading screen with loading frame and text options
			this.studio = new StudioLoadingScreen(this, {
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
			this.studio.show();

			// Delay any post-fade actions
			this.events.once('studio-fade-complete', () => {
				// Any post-fade actions can go here
			});

			const buttonY = this.scale.height * 0.77;
			this.buttonBg = this.add.image(this.scale.width * 0.5, buttonY, "button_bg").setOrigin(0.5, 0.5).setScale(assetScale);
			this.buttonSpin = this.add.image(this.scale.width * 0.5, buttonY, "button_spin").setOrigin(0.5, 0.5).setScale(assetScale);
			this.buttonSpin.setTint(0x777777).setAlpha(0.9);
			this.buttonBg.setTint(0x777777).setAlpha(0.9);
			this.buttonSpin.disableInteractive();
			console.log(`[Preloader] Button scaling: ${assetScale}x`);

			const logoY = this.scale.height * 0.14;
			const thatsBaitLogo = this.add.image(this.scale.width * 0.5, logoY, "thats-bait-logo")
				.setOrigin(0.5, 0.5)
				.setScale(assetScale);
			console.log(`[Preloader] Added thats-bait-logo at scale: ${assetScale}x`);

			// Wave-like "floating on water" motion: gentle vertical bob + slight tilt
			const waveOffset = this.scale.height * 0.01; // 1% of screen height
			this.tweens.add({
				targets: thatsBaitLogo,
				y: { from: logoY - waveOffset, to: logoY + waveOffset },
				rotation: { from: -0.03, to: 0.03 },
				duration: 2200,
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
		}

		try { (window as any).hideBootLoader?.(); } catch {}

		this.load.on('progress', (progress: number) => {
			EventBus.emit('progress', progress);
			try { (window as any).setBootLoaderProgress?.(0.25 + progress * 0.75); } catch {}
		});
		this.load.once('complete', () => {
			try { (window as any).setBootLoaderProgress?.(1); } catch {}
		});
		
		EventBus.emit('current-scene-ready', this);
	}

	preload () {
		// Queue assets during Phaser's preload so the loader starts automatically afterwards
		queueGameAssetLoading(this, this.assetLoader);
		console.log(`[Preloader] Queued assets via queueGameAssetLoading()`);
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
                console.log('[Preloader] Starting TemporaryScene scene after camera fade out');
                this.scene.start('TemporaryScene', {
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
				this.progressText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
				this.pressToPlayText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
			}).catch(() => {
				// Fallback: set families anyway
				this.progressText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
				this.pressToPlayText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
			});
		} else {
			// Browser without document.fonts support
			this.progressText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
			this.pressToPlayText?.setFontFamily('Poppins-Regular, Arial, sans-serif');
		}
    }
}
