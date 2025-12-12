/**
 * Game Scene - STABLE VERSION v1.0
 * 
 * This version includes:
 * - Complete asset management system with AssetConfig and AssetLoader
 * - NetworkManager and ScreenModeManager integration
 * - Background, Header, Symbols, Spinner, and SlotController components
 * - BonusBackground and BonusHeader components (commented out)
 * - Proper event handling and backend integration
 * 
 * Base stable version - revert to this if future changes break functionality
 */
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Background } from '../components/Background';
import { Header } from '../components/Header';
import { SlotController } from '../components/SlotController';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { PaylineData, SpinData, SpinDataUtils } from '../../backend/SpinData';
import { AssetLoader } from '../../utils/AssetLoader';
import { Symbols } from '../components/Symbols';
import { GameData } from '../components/GameData';
import { BonusBackground } from '../components/BonusBackground';
import { BonusHeader } from '../components/BonusHeader';
import { Spinner } from '../components/Spinner';
import { Dialogs } from '../components/Dialogs';
import { BetOptions } from '../components/BetOptions';
import { AutoplayOptions } from '../components/AutoplayOptions';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { SplitTransition } from '../components/SplitTransition';
import { CoinAnimation } from '../components/CoinAnimation';
import { GameAPI } from '../../backend/GameAPI';
import { AudioManager, MusicType, SoundEffectType } from '../../managers/AudioManager';
import { Menu } from '../components/Menu';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ScatterAnticipation } from '../components/ScatterAnticipation';
import { ClockDisplay } from '../components/ClockDisplay';
import { EmberParticleSystem } from '../components/EmberParticleSystem';
import { cameraShake } from '../components/CameraShake';
import { WinTracker } from '../components/WinTracker';
import { GameEventData, SpinDataEventData } from '../../event/EventManager';
import { BONUS_FREE_SPIN_TEST_DATA } from '../../testing/TestSpinData';
import { FreeRoundManager } from '../components/FreeRoundManager';

export class Game extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private gameStateManager: typeof gameStateManager;
	private background: Background;
	private header: Header;
	private slotController: SlotController;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;

	private bonusBackground: BonusBackground;
	private bonusHeader: BonusHeader;
	private spinner: Spinner;
	private dialogs: Dialogs;
	private betOptions: BetOptions;
	private autoplayOptions: AutoplayOptions;
	private splitTransition: SplitTransition;
	private coinAnimation: CoinAnimation;
	public gameAPI: GameAPI;
	public audioManager: AudioManager;
	private menu: Menu;
	private scatterAnticipation: ScatterAnticipation;
	private winTrackerRow?: Phaser.GameObjects.Container;
	private freeRoundManager: FreeRoundManager | null = null;

	private frameRateAccumulatorMs: number = 0;
	private frameCountAccumulator: number = 0;
	
	// Note: Payout data now calculated directly from paylines in WIN_STOP handler
	// Track whether this spin has winlines to animate
	private hasWinlinesThisSpin: boolean = false;
	
	// Queue for wins that occur while a dialog is already showing
	private winQueue: Array<{ payout: number; bet: number; }> = [];
	private suppressWinDialogsUntilNextSpin: boolean = false;

	public gameData: GameData;
	private symbols: Symbols;
	private clockDisplay: ClockDisplay;
	emberParticleSystem: any;

	constructor ()
	{
		super('Game');

		this.gameData = new GameData();
		this.symbols = new Symbols();
		this.menu = new Menu();
		this.scatterAnticipation = new ScatterAnticipation();
	}

	init (data: any)
	{
		// Receive managers from Preloader scene
		this.networkManager = data.networkManager;
		this.screenModeManager = data.screenModeManager;
		
		// Initialize game state manager
		this.gameStateManager = gameStateManager;
		console.log(`[Game] Initial isBonus state: ${this.gameStateManager.isBonus}`);
		
		// Initialize asset configuration
		this.assetConfig = new AssetConfig(this.networkManager, this.screenModeManager);
		
		// Initialize GameAPI
		// Prefer the instance passed from Preloader so we can reuse initialization data.
		if (data.gameAPI) {
			console.log('[Game] Using GameAPI instance from Preloader');
			this.gameAPI = data.gameAPI as GameAPI;
		} else {
			console.log('[Game] No GameAPI instance passed from Preloader, creating a new one');
			this.gameAPI = new GameAPI(this.gameData);
		}
		this.assetLoader = new AssetLoader(this.assetConfig);
		
		console.log(`[Game] Received managers from Preloader`);
	}

	public getBackground(): Background {
		return this.background;
	}

	public getBonusBackground(): BonusBackground {
		return this.bonusBackground;
	}

	public getHeader(): Header {
		return this.header;
	}

	public getBonusHeader(): BonusHeader {
		return this.bonusHeader;
	}

	public getCurrentBetAmount(): number {
		if (this.slotController) {
			const betText = this.slotController.getBetAmountText?.();
			const parsedBet = betText ? parseFloat(betText) : Number.NaN;
			if (!Number.isNaN(parsedBet) && parsedBet > 0) {
				return parsedBet;
			}

			const baseBet = this.slotController.getBaseBetAmount?.();
			if (typeof baseBet === 'number' && baseBet > 0) {
				return baseBet;
			}
		}
		return 1;
	}

	preload () 
	{
		// Assets are now loaded in Preloader scene
		console.log(`[Game] Assets already loaded in Preloader scene`);
		console.log(`[Game] Backend service initialized via GameStateManager`);

		// Preload Menu assets specific to the Game scene
		this.menu.preload(this);
	}

	create ()
	{
		this.clockDisplay = new ClockDisplay(this, {
			gameTitle: 'War Freaks',
		});
		this.clockDisplay.create();

		console.log(`[Game] Creating game scene`);
		
		// Set physics world bounds (physics is already enabled globally)
		if (this.physics && this.physics.world) {
			this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height - 220);
			console.log('[Game] Physics world bounds set');
		} else {
			console.warn('[Game] Physics system not available');
		}
		
		// Create fade overlay for transition from black
		const fadeOverlay = this.add.rectangle(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			this.scale.width,
			this.scale.height,
			0x000000
		).setOrigin(0.5, 0.5).setScrollFactor(0).setAlpha(1);
		
		// Backend initialization removed - using SlotController autoplay system
		
		// Create background using the managers
		this.background = new Background(this.networkManager, this.screenModeManager);
		this.background.create(this);

		// Create ember particles above background image but below everything else by parenting into background container
		// this.emberParticleSystem = new EmberParticleSystem();
		// this.emberParticleSystem.create(this, this.gameStateManager, this.background.getContainer());
		
		// Create spinner using the managers
		this.spinner = new Spinner(this.networkManager, this.screenModeManager);
		this.spinner.create(this);

		// Create header using the managers
		this.header = new Header(this.networkManager, this.screenModeManager);
		this.header.create(this);

		// Create bonus background using the managers (initially hidden)
		console.log('[Game] Creating bonus background...');
		this.bonusBackground = new BonusBackground(this.networkManager, this.screenModeManager);
		this.bonusBackground.create(this);
		this.bonusBackground.getContainer().setVisible(false);
		console.log('[Game] Bonus background created and hidden');

		// Create bonus header using the managers (initially hidden)
		console.log('[Game] Creating bonus header...');
		this.bonusHeader = new BonusHeader(this.networkManager, this.screenModeManager);
		this.bonusHeader.create(this);
		this.bonusHeader.getContainer().setVisible(false);
		console.log('[Game] Bonus header created and hidden');

		//Create symbols
		console.log(`[Game] Creating symbols...`);
		this.symbols.create(this);

		// Initialize AudioManager
		this.audioManager = new AudioManager(this);
		console.log('[Game] AudioManager initialized');

		// Defer audio loading: load audio assets in the background after visuals are ready
		this.time.delayedCall(0, () => {
			console.log('[Game] Background-loading audio assets...');
			this.load.on('complete', () => {
				try {
					this.audioManager.createMusicInstances();
					this.audioManager.playBackgroundMusic(MusicType.MAIN);
					console.log('[Game] Audio assets loaded and background music started');
				} catch (e) {
					console.warn('[Game] Failed to initialize or start audio after load:', e);
				}
			}, this);
			// Mirror AssetConfig audio definitions
			const audioAssets = new AssetConfig(this.networkManager, this.screenModeManager).getAudioAssets();
			if (audioAssets.audio) {
				Object.entries(audioAssets.audio).forEach(([key, path]) => {
					try { this.load.audio(key, path as string); } catch {}
				});
			}
			this.load.start();
		});

		// Make AudioManager available globally for other components
		(window as any).audioManager = this.audioManager;
		
		// Create dialogs using the managers
		this.dialogs = new Dialogs(this.networkManager, this.screenModeManager);
		this.dialogs.create(this);
		
		// Initialize scatter animation manager with both containers, spinner and dialogs components
		const scatterAnimationManager = this.symbols.scatterAnimationManager;
		scatterAnimationManager.initialize(this, this.symbols.container, this.spinner.container, this.spinner, this.dialogs);
		
		// Create bet options using the managers
		this.betOptions = new BetOptions(this.networkManager, this.screenModeManager);
		this.betOptions.create(this);
		
		// Create autoplay options using the managers
		this.autoplayOptions = new AutoplayOptions(this.networkManager, this.screenModeManager);
		this.autoplayOptions.create(this);
		
		// Create slot controller using the managers
		this.slotController = new SlotController(this.networkManager, this.screenModeManager);
		this.slotController.setSymbols(this.symbols); // Set symbols reference for free spin data access
		this.slotController.setBuyFeatureReference(); // Set BuyFeature reference for bet access
		this.slotController.create(this);

		// Create free round manager AFTER SlotController so it can mirror the spin button.
		// It will read the backend initialization data and decide whether to show itself.
		try {
			const initData = this.gameAPI.getInitializationData();
			const initFsRemaining = this.gameAPI.getRemainingInitFreeSpins();
			const initFsBet = this.gameAPI.getInitFreeSpinBet();

			this.freeRoundManager = new FreeRoundManager();
			this.freeRoundManager.create(this, this.gameAPI, this.slotController);

			if (initData && initData.hasFreeSpinRound && initFsRemaining > 0) {
				console.log(
					`[Game] Initialization indicates free spin round available (${initFsRemaining}). Enabling FreeRoundManager UI.`
				);

				// If backend provided a bet size for the free rounds, apply it to the SlotController
				// so both the UI and the underlying base bet used for spins match the init data.
				if (this.slotController && initFsBet && initFsBet > 0) {
					console.log(
						`[Game] Applying initialization free spin bet to SlotController: ${initFsBet.toFixed(2)}`
					);
					this.slotController.updateBetAmount(initFsBet);
				}

				this.freeRoundManager.setFreeSpins(initFsRemaining);
				this.freeRoundManager.enableFreeSpinMode();
			}
		} catch (e) {
			console.warn('[Game] Failed to create FreeRoundManager from initialization data:', e);
		}
		
		this.startSplitTransition();
		
		// Create coin animation component
		this.coinAnimation = new CoinAnimation(this.networkManager, this.screenModeManager);
		this.coinAnimation.create(this);

		// Create scatter anticipation component inside background container to avoid symbol mask and stay behind symbols
		this.scatterAnticipation.create(this, this.background.getContainer());
		this.scatterAnticipation.hide();
		(this as any).scatterAnticipation = this.scatterAnticipation;
		
		// (SplitTransition handles its own timing; no additional delayed zoom needed)
		
		// Initialize balance on game start
		this.initializeGameBalance();
		
		// Emit START event AFTER SlotController is created
		console.log(`[Game] Emitting START event to initialize game...`);
		gameEventManager.emit(GameEventType.START);
		
		// Trigger initial symbol display
		console.log(`[Game] Starting game...`);
		// Game starts automatically when scene is created
		
		// Initialize winnings display
		this.header.initializeWinnings();
		
		// Setup bonus mode event listeners
		this.setupBonusModeEventListeners();
		
		EventBus.emit('current-scene-ready', this);

		// Fade in from black after all components are created
		this.tweens.add({
			targets: fadeOverlay,
			alpha: 0,
			duration: 1000,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Game] Fade in from black complete');
				// Remove the fade overlay to clean up
				fadeOverlay.destroy();
			}
		});

		// Trigger layered effects when game starts
		console.log(`[Game] Triggering layered effects...`);
		

		// Show congratulations dialog (on top)
		//this.dialogs.showPaintEffect(this);
		
		// Show congratulations dialog (on top)
		this.time.delayedCall(2500, () => {
			// this.dialogs.showCongratulations(this, { winAmount: 10000.00 });

			// this.dialogs.showFreeSpinDialog(this, { freeSpins: 15 });
	
			// Show small win dialog (on top)
			// this.dialogs.showMegaWin(this, { winAmount: 1234567891231.00 });
			
			// Show medium win dialog (on top)
			//this.dialogs.showMediumWin(this, { winAmount: 2500000.50 });
	
			// Show large win dialog (on top)
			//this.dialogs.showLargeWin(this, { winAmount: 5000000.75 });
	
			// Show super win dialog (on top)
			// this.dialogs.showSuperWin(this, { winAmount: 10000000.00 });
		});

		EventBus.on('spin', () => {
			this.spin();
		});

		// Listen for menu button click
		EventBus.on('menu', () => {
			console.log('[Game] Menu button clicked - toggling menu');
			this.menu.toggleMenu(this);
		});

		EventBus.on('show-bet-options', () => {
			console.log('[Game] Showing bet options with fade-in effect');
			
			// Get the current bet from the slot controller display
			const currentBetText = this.slotController.getBetAmountText();
			const currentBet = currentBetText ? parseFloat(currentBetText) : 0.20;
			
			this.betOptions.show({
				currentBet: currentBet,
				onClose: () => {
					console.log('[Game] Bet options closed');
				},
				onConfirm: (betAmount: number) => {
					console.log(`[Game] Bet confirmed: £${betAmount}`);
					// Update the bet display in the slot controller
					this.slotController.updateBetAmount(betAmount);
					// Update the bet amount in the backend
					gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: betAmount, previousBet: currentBet });
				}
			});
		});

		// Listen for autoplay button click
		EventBus.on('autoplay', () => {
			console.log('[Game] Autoplay button clicked - showing options');
			
			const currentBetText = this.slotController.getBetAmountText();
			const currentBet = currentBetText ? parseFloat(currentBetText) : 0.20;
			
			// Get the most current balance as a numeric value from the SlotController
			const currentBalance = this.slotController.getBalanceAmount();
			
			console.log(`[Game] Current balance for autoplay options: $${currentBalance}`);

			// Disable the spin button while autoplay settings are open
			this.slotController.disableSpinButton();
			
			this.autoplayOptions.show({
				currentAutoplayCount: 10,
				currentBet: currentBet,
				currentBalance: currentBalance,
				onClose: () => {
					console.log('[Game] Autoplay options closed');
					// Re‑enable the spin button with a slight delay after closing the panel
					this.slotController.enableSpinButton();
				},
				onConfirm: (autoplayCount: number) => {
					console.log(`[Game] Autoplay confirmed: ${autoplayCount} spins`);
					// Read the bet selected within the autoplay panel
					const selectedBet = this.autoplayOptions.getCurrentBet();
					// If bet changed, update UI and backend
					if (Math.abs(selectedBet - currentBet) > 0.0001) {
						this.slotController.updateBetAmount(selectedBet);
						gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: selectedBet, previousBet: currentBet });
					}
					console.log(`[Game] Total cost: $${(selectedBet * autoplayCount).toFixed(2)}`);
					
					// Re‑enable the spin button shortly after the panel closes
					if (this.time) {
						this.time.delayedCall(150, () => {
							this.slotController.enableSpinButton();
						});
					} else {
						this.slotController.enableSpinButton();
					}

					// Start autoplay using the new SlotController method
					this.slotController.startAutoplay(autoplayCount);
				}
			});
		});

		// Note: SPIN_RESPONSE event listeners removed - now using SPIN_DATA_RESPONSE

		// Listen for win start to spawn coins based on win amount
		gameEventManager.on(GameEventType.WIN_START, (data: any) => {
			console.log('[Game] WIN_START event received - spawning coins based on win amount');
			// Advance tumble index so downstream consumers read the correct tumble step
			this.gameAPI.incrementCurrentTumbleIndex();
			
			// Try to obtain SpinData from the event payload, then fall back to Symbols.currentSpinData
			const spinDataFromEvent = (data as SpinDataEventData | undefined)?.spinData as SpinData | undefined;
			const spinData = spinDataFromEvent || (this.symbols?.currentSpinData as SpinData | null) || undefined;

			if (spinData) {
				this.showWinTrackerForSpinData(spinData);
			} else {
				console.warn('[Game] WIN_START: No SpinData available for WinTracker');
			}
			
			// Update balance from server after REELS_STOP (for no-wins scenarios)
			// Skip during scatter/bonus; balance will be finalized after bonus ends
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceAfterWinStop();
			} else {
				console.log('[Game] Skipping balance update on REELS_STOP (scatter/bonus active)');
			}
			
			// Get current spin data to determine win amount
			if (this.symbols && this.symbols.currentSpinData) {
				const spinData = this.symbols.currentSpinData as SpinData;
				const totalWin = this.calculateTotalWinFromPaylines(spinData);
				const betAmount = parseFloat(spinData.bet);
				
				console.log(`[Game] WIN_START: Total win: $${totalWin}, bet: $${betAmount}`);
			} 
		});

		// Listen for winline animations completion to show win dialogs
		gameEventManager.on(GameEventType.WIN_STOP, (data: any) => {
			console.log('[Game] WIN_STOP event received');
			
			// Get the current spin data from the Symbols component
			if (this.symbols && this.symbols.currentSpinData) {
				console.log('[Game] WIN_STOP: Found current spin data, calculating total win from paylines');
				
				const slotData = data.spinData?.slot || data?.slot;
				console.log('[Game] WIN_STOP: Slot data: ', slotData);

				let totalWin = 0;
				if(gameStateManager.isScatter)
					totalWin = SpinDataUtils.getScatterSpinWins(data.spinData);
				else if(gameStateManager.isBonus)
					totalWin = SpinDataUtils.getBonusSpinWins(data.spinData, this.gameAPI.getCurrentFreeSpinIndex() - 1);
				else
					totalWin = data.spinData.slot.totalWin;

				const betAmount = parseFloat(data.spinData.bet);

				console.log(`[Game] WIN_STOP: Total win calculated: $${totalWin}, bet: $${betAmount}`);
				
				if (totalWin > 0) {
					// Note: Win dialog threshold check moved to Symbols component for earlier detection
					console.log('[Game] WIN_STOP: Showing win dialog');
					this.checkAndShowWinDialog(totalWin, betAmount);
					console.log('[Game] WIN_STOP: Win dialog shown');
				} else {
					console.log('[Game] WIN_STOP: No wins detected from paylines');
				}
			} else {
				console.log('[Game] WIN_STOP: No current spin data available');
			}
			
			// Update balance from server after WIN_STOP (skip during scatter/bonus)
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceAfterWinStop();
			} else {
				console.log('[Game] Skipping balance update on WIN_STOP (scatter/bonus active)');
			}
		});

		// Listen for reel completion to handle balance updates and win tracker display
		gameEventManager.on(GameEventType.REELS_STOP, (eventData?: GameEventData) => {
			console.log('[Game] REELS_STOP event received');
			// Reset tumble index at the end of a reel cycle
			this.gameAPI.resetCurrentTumbleIndex();
			
			// Request balance update to finalize the spin (add winnings to balance)
			// This is needed to complete the spin cycle and update the final state
			console.log('[Game] Reels done - requesting balance update to finalize spin');
			gameEventManager.emit(GameEventType.BALANCE_UPDATE);
			
			// Note: Win dialog logic moved to WIN_STOP handler using payline data
			// No fallback logic needed here - WinLineDrawer handles all timing
			console.log('[Game] REELS_STOP: Balance update requested, WIN_STOP handled by winline animations');
		});

		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[Game] REELS_START event received');
			// Clear any existing win tracker row when reels start
			
			// Clear any existing win tracker row when a new spin starts
			WinTracker.clearFromScene(this);
		});

		// Listen for dialog animations to complete
		this.events.on('dialogAnimationsComplete', () => {
			console.log('[Game] Dialog animations complete event received');
			// Re-allow win dialogs after transitions complete
			this.suppressWinDialogsUntilNextSpin = false;
			
			// Clear the win dialog state - autoplay can resume
			gameStateManager.isShowingWinDialog = false;
			console.log('[Game] Set isShowingWinDialog to false - autoplay can resume');
			
			// Check if there's a delayed scatter animation waiting to start
			this.checkAndStartDelayedScatterAnimation();
			
			// Note: Autoplay continuation is now handled by SlotController's WIN_DIALOG_CLOSED handler
			// No need to retry spin here as it conflicts with SlotController's autoplay logic
			
			// Process any remaining wins in the queue
			this.processWinQueue();
		});

		// Listen for any spin to start (manual or autoplay)
		gameEventManager.on(GameEventType.SPIN, (eventData: any) => {
			console.log('[Game] SPIN event received - clearing win queue for new spin');
			// Reset winlines tracking for the new spin
			this.hasWinlinesThisSpin = false;

			// Allow win dialogs again on the next spin
			this.suppressWinDialogsUntilNextSpin = false;
			
			// CRITICAL: Block autoplay spins if win dialog is showing, but allow manual spins
			// This fixes the timing issue where manual spins were blocked
			if (gameStateManager.isShowingWinDialog && this.gameData?.isAutoPlaying) {
				console.log('[Game] Autoplay SPIN event BLOCKED - win dialog is showing');
				console.log('[Game] Manual spins are still allowed to proceed');
				return;
			}
			
			// Only clear win queue if this is a new spin (not a retry of a paused spin)
			// Check if we're retrying a paused autoplay spin
			const isRetryingPausedSpin = this.gameData?.isAutoPlaying && this.winQueue.length > 0;
			
			if (!isRetryingPausedSpin) {
				this.clearWinQueue();
				console.log('[Game] Cleared win queue for new spin');
				
				// Only clear win dialog state for completely new spins
				gameStateManager.isShowingWinDialog = false;
				console.log('[Game] Cleared isShowingWinDialog state for new spin');
			} else {
				console.log('[Game] Not clearing win queue - retrying paused autoplay spin');
				console.log('[Game] Keeping isShowingWinDialog state for paused spin retry');
			}
		});

		// Listen for autoplay start to prevent it when win dialogs are showing
		gameEventManager.on(GameEventType.AUTO_START, (eventData: any) => {
			// When autoplay resumes, ensure win dialogs are allowed again
			this.suppressWinDialogsUntilNextSpin = false;
			if (gameStateManager.isShowingWinDialog) {
				console.log('[Game] AUTO_START blocked - win dialog is showing');
				// Don't allow autoplay to start while win dialog is showing
				return;
			}
			console.log('[Game] AUTO_START allowed - no win dialog showing');
		});

		// Keyboard shortcuts to switch between base and bonus modes
		this.input.keyboard?.on('keydown-Q', () => {
			this.switchBetweenModes(true); // T => enter bonus mode
		});
		this.input.keyboard?.on('keydown-E', () => {
			this.switchBetweenModes(false); // Y => return to base mode
		});
	}

	/**
	 * Show a WinTracker row under the reels border based on SpinData paylines
	 */
	private showWinTrackerForSpinData(spinData: any): void {
		if (!spinData || !spinData.slot) {
			console.warn('[Game] showWinTrackerForSpinData called without valid SpinData');
			return;
		}

		// Ensure we have symbol grid metrics available
		if (!this.symbols) {
			console.warn('[Game] Symbols component not available - cannot position WinTracker');
			return;
		}

		console.log(`[Game] showWinTrackerForSpinData: `, spinData);

		const outResult = this.getWinTrackerOutResult(spinData);

		if (outResult && !outResult.length) {
			console.log('[Game] No winning symbols in tumble item - skipping WinTracker display');
			return;
		}

		// Clean up any existing WinTracker row
		if (this.winTrackerRow) {
			this.winTrackerRow.destroy();
			this.winTrackerRow = undefined;
		}

		// Compute position just under the reels border, using the same grid metrics as Symbols
		const slotX = this.symbols.slotX;
		const slotY = this.symbols.slotY;
		const totalGridHeight = this.symbols.totalGridHeight;

		// These values mirror the padding logic used in Symbols.getSymbolGridBounds()
		const paddingY = 8;
		const offsetY = 0.7;
		const reelsBottomY = slotY + totalGridHeight * 0.5 + paddingY + offsetY;

		const rowX = slotX;
		const rowY = reelsBottomY + 34; // Slight offset below the border

		console.log(`[Game] outResult: `, outResult);

		const isBonusMode = gameStateManager.isBonus;
		const winTextColor = isBonusMode ? '#ffffff' : '#ffffff';
		const winStrokeColor = isBonusMode ? '#4b5320' : '#cc6600'; // make this dark green for bonus, dark army green otherwise

		// Build one config per winning symbol and let WinTracker lay them out side by side
		const winRowConfigs = outResult?.map((item: any) => ({
			scene: this,
			symbolScale: 0.06,
			symbolIndex: item.symbol,
			symbolWinCount: item.count,
			totalWinAmount: item.win,
			x: rowX,
			y: rowY,
			depth: 950,
			textFontSize: '16px',
			textColor: winTextColor,
			textStyle: {
				stroke: winStrokeColor,
				strokeThickness: 2,
			},
		}));

		this.winTrackerRow = WinTracker.createSymbolWinRow(winRowConfigs ?? []);
		WinTracker.startWave(this.winTrackerRow, {scale: 1.3, duration: 150, staggerDelay: 100});

		console.log('[Game] WinTracker rows displayed under reels border from tumble data', {
			outResult,
			position: { x: rowX, y: rowY }
		});
	}

	/**
	 * Determine the "current" tumble out-result safely.
	 * We prefer the current tumble index when it is valid; otherwise we fall back to the
	 * latest tumble item that contains an `out` list.
	 */
	private getWinTrackerOutResult(spinData: any): any[] | undefined {
		const isBonus = gameStateManager.isBonus;

		const getItems = (maybe: any): any[] => {
			if (!maybe) return [];
			if (Array.isArray(maybe)) return maybe;
			if (Array.isArray(maybe.items)) return maybe.items;
			return [];
		};

		const tumbleItems = (() => {
			if (isBonus) {
				const fsIndex = this.gameAPI.getCurrentFreeSpinIndex() - 1;
				const fsItem = spinData.slot?.freespin?.items?.[fsIndex] ?? spinData.slot?.freeSpin?.items?.[fsIndex];
				return getItems(fsItem?.tumble);
			}
			return getItems(spinData.slot?.tumbles);
		})();

		if (!tumbleItems.length) {
			return undefined;
		}

		const preferredIndex = this.gameAPI.getCurrentTumbleIndex() - 1;
		const pickIndex = (idx: number) => {
			const item = tumbleItems[idx];
			const out = item?.symbols?.out;
			return Array.isArray(out) ? out : undefined;
		};

		// 1) Prefer the current tumble index if it's in range and has an out array
		if (preferredIndex >= 0 && preferredIndex < tumbleItems.length) {
			const preferredOut = pickIndex(preferredIndex);
			if (preferredOut) return preferredOut;
		}

		// 2) Fallback: last tumble step that has an out array
		for (let i = tumbleItems.length - 1; i >= 0; i--) {
			const out = pickIndex(i);
			if (out) return out;
		}

		return undefined;
	}

	// WinTracker wave tween + cleanup are handled by WinTracker.ts (startWave/clearContainer)

	/**
	 * Start the split transition animation
	 */
	private startSplitTransition(): void {
		// Create split transition component
		this.splitTransition = new SplitTransition(this);
		// Create a temporary fullscreen background image for the split transition effect
		try {
			const transitionImage = this.add.image(
				this.scale.width * 0.5,
				this.scale.height * 0.5,
				'loading_background'
			).setOrigin(0.5, 0.5);
			// Fit to screen (match logic used in Background)
			const imgFrame = transitionImage.frame;
			const imgW = imgFrame?.width || 1;
			const imgH = imgFrame?.height || 1;
			const scaleX = this.scale.width / imgW;
			const scaleY = this.scale.height / imgH;
			const fitScale = Math.max(scaleX, scaleY);
			transitionImage.setScale(fitScale * 1.05);
			// Play the split animation on this temporary image
			this.splitTransition.playOn(transitionImage, 1500, 250, 'Cubic.easeInOut', this.scale.width / 2);
			cameraShake(this, 1250 , 0.004, 100);
		} catch (e) {
			console.warn('[Game] SplitTransition failed to start:', e);
		}
	}

	/**
	 * Initialize the game balance on start
	 */
	private async initializeGameBalance(): Promise<void> {
		try {
			console.log('[Game] Initializing game balance...');
			
			// Call the GameAPI to get the current balance
			const balance = await this.gameAPI.initializeBalance();
			
			// Update the SlotController balance display
			if (this.slotController) {
				this.slotController.updateBalanceAmount(balance);
				console.log(`[Game] Balance initialized and updated in SlotController: $${balance}`);
			}
			
			// Emit balance initialized event
			gameEventManager.emit(GameEventType.BALANCE_INITIALIZED, {
				newBalance: balance,
				previousBalance: 0,
				change: balance
			});
			
			console.log('[Game] Balance initialization completed successfully');
			
		} catch (error) {
			console.error('[Game] Error initializing balance:', error);
			// Use default balance if initialization fails
			const defaultBalance = 200000.00;
			if (this.slotController) {
				this.slotController.updateBalanceAmount(defaultBalance);
				console.log(`[Game] Using default balance: $${defaultBalance}`);
			}
		}
	}

	/**
	 * Update balance from server after WIN_STOP or REELS_STOP
	 */
	private async updateBalanceAfterWinStop(): Promise<void> {
		try {
			console.log('[Game] Updating balance from server after WIN_STOP/REELS_STOP...');
			
			// Call the GameAPI to get the current balance from server
			const balance = await this.gameAPI.initializeBalance();
			
			// Update the SlotController balance display
			if (this.slotController) {
				this.slotController.updateBalanceAmount(balance);
				console.log(`[Game] Balance updated after WIN_STOP/REELS_STOP: $${balance}`);
			}
			
			// Update autoplay options balance if visible
			this.updateAutoplayOptionsBalance(balance);
			
		} catch (error) {
			console.error('[Game] Error updating balance after WIN_STOP/REELS_STOP:', error);
		}
	}

	/**
	 * Update the AutoplayOptions balance display
	 */
	private updateAutoplayOptionsBalance(balance: number): void {
		if (this.autoplayOptions && this.autoplayOptions.isVisible()) {
			this.autoplayOptions.setCurrentBalance(balance);
		}
	}

	/**
	 * Calculate total win amount using SpinData (base paylines or free spins)
	 */
	private calculateTotalWinFromPaylines(spinData: SpinData): number {
		if (!spinData) {
			return 0;
		}

		const totalWin = SpinDataUtils.getAggregateTotalWin(spinData);
		console.log(`[Game] Calculated aggregate total win from SpinData: ${totalWin}`);
		return totalWin;
	}

	/**
	 * Check if payout reaches win dialog thresholds and show appropriate dialog
	 */
	private checkAndShowWinDialog(payout: number, bet: number): void {
		console.log(`[Game] checkAndShowWinDialog started`);
		// Suppress win dialogs if we're transitioning out of bonus back to base
		if (this.suppressWinDialogsUntilNextSpin) {
			console.log('[Game] Suppressing win dialog (transitioning from bonus to base)');
			return;
		}
		console.log(`[Game] checkAndShowWinDialog called with payout: $${payout}, bet: $${bet}`);
		console.log(`[Game] Current win queue length: ${this.winQueue.length}`);
		console.log(`[Game] Current isShowingWinDialog state: ${gameStateManager.isShowingWinDialog}`);
		console.log(`[Game] Current dialog showing state: ${this.dialogs.isDialogShowing()}`);
		
		// Check if a dialog is already showing - prevent multiple dialogs
		if (this.dialogs.isDialogShowing()) {
			console.log('[Game] Dialog already showing, skipping win dialog for this payout');
			// Add to queue if dialog is already showing
			this.winQueue.push({ payout: payout, bet: bet });
			console.log(`[Game] Added to win queue. Queue length: ${this.winQueue.length}`);
			return;
		}

		const winRatio = payout / bet;
		
		console.log(`[Game] Win detected - Payout: $${payout}, Bet: $${bet}`);
		
		// Only show dialogs for wins that are at least the bigWinThreshold (e.g. 20x the bet size)
		if (winRatio < this.gameData.bigWinThreshold) {
			console.log(`[Game] Win below threshold - No dialog shown for ${winRatio.toFixed(2)}x multiplier`);
			// Clear the win dialog state since no dialog was shown
			gameStateManager.isShowingWinDialog = false;
			return;
		}

		// Determine which win dialog to show based on multiplier thresholds
		if (winRatio >= this.gameData.superWinThreshold) { // 60x
			console.log(`[Game] Large Win! Showing LargeW_KA dialog for ${winRatio.toFixed(2)}x multiplier`);
			this.dialogs.showSuperWin(this, { winAmount: payout });
		} else if (winRatio >= this.gameData.epicWinThreshold) { // 45x
			console.log(`[Game] Super Win! Showing superw_wf dialog for ${winRatio.toFixed(2)}x multiplier`);
			this.dialogs.showEpicWin(this, { winAmount: payout });
		} else if (winRatio >= this.gameData.megaWinThreshold) { // 30x
			console.log(`[Game] Medium Win! Showing MediumW_KA dialog for ${winRatio.toFixed(2)}x multiplier`);
			this.dialogs.showMegaWin(this, { winAmount: payout });
		} else if (winRatio >= this.gameData.bigWinThreshold) { // 20x
			console.log(`[Game] Small Win! Showing SmallW_KA dialog for ${winRatio.toFixed(2)}x multiplier`);
			this.dialogs.showBigWin(this, { winAmount: payout });
		}
		
		console.log(`[Game] Win dialog should now be visible. isShowingWinDialog: ${gameStateManager.isShowingWinDialog}`);
	}

	/**
	 * Process the win queue to show the next win dialog
	 */
	private processWinQueue(): void {
		if (this.suppressWinDialogsUntilNextSpin) {
			console.log('[Game] Suppressing processing of win queue (transitioning from bonus to base)');
			return;
		}
		console.log(`[Game] processWinQueue called. Queue length: ${this.winQueue.length}`);
		console.log(`[Game] Current isShowingWinDialog state: ${gameStateManager.isShowingWinDialog}`);
		console.log(`[Game] Current dialog showing state: ${this.dialogs.isDialogShowing()}`);
		
		// Check dialog overlay visibility
		const dialogContainer = this.dialogs.getContainer();
		if (dialogContainer) {
			console.log(`[Game] Dialog overlay visible: ${dialogContainer.visible}, alpha: ${dialogContainer.alpha}`);
		}
		
		if (this.winQueue.length === 0) {
			console.log('[Game] Win queue is empty, nothing to process');
			return;
		}
		
		if (this.dialogs.isDialogShowing()) {
			console.log('[Game] Dialog still showing, cannot process win queue yet');
			return;
		}
		
		// Get the next win from the queue
		const nextWin = this.winQueue.shift();
		if (nextWin) {
			console.log(`[Game] Processing next win from queue: $${nextWin.payout} on $${nextWin.bet} bet. Queue remaining: ${this.winQueue.length}`);
			this.checkAndShowWinDialog(nextWin.payout, nextWin.bet);
		}
	}

	/**
	 * Clear the win queue (useful for resetting state)
	 */
	public clearWinQueue(): void {
		const queueLength = this.winQueue.length;
		this.winQueue = [];
		console.log(`[Game] Win queue cleared. Removed ${queueLength} pending wins`);
	}

	/**
	 * Get current win queue status for debugging
	 */
	private getWinQueueStatus(): string {
		return `Win Queue: ${this.winQueue.length} pending wins`;
	}

	/**
	 * Spawn coins based on win amount and multiplier
	 */
	public spawnCoinsForWin(totalWin: number, betAmount: number): void {
		if (!this.coinAnimation) {
			console.warn('[Game] Coin animation not available for win');
			return;
		}

		const multiplier = totalWin / betAmount;
		let coinCount = 0;

		// Determine coin count based on win multiplier thresholds
		if (multiplier >= 60) {
			// Large win: 30 coins
			coinCount = 50;
			console.log(`[Game] Large Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 45) {
			// Super win: 20 coins
			coinCount = 30;
			console.log(`[Game] Super Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 30) {
			// Medium win: 15 coins
			coinCount = 20;
			console.log(`[Game] Medium Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 20) {
			// Small win: 10 coins
			coinCount = 10;
			console.log(`[Game] Small Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else {
			// Below threshold: 5 coins
			coinCount = 5;
			console.log(`[Game] Below threshold win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		}
	}

	/**
	 * Spawn coins over a specified time period using the manually set position
	 */
	private spawnCoinsOverTime(totalCoins: number, durationMs: number): void {
		if (!this.coinAnimation) {
			return;
		}

		// Use the same position as the manually set position in CoinAnimation
		const centerX = this.scale.width * 0.65;
		const centerY = this.scale.height * 0.22;

		const intervalMs = durationMs / totalCoins;
		console.log(`[Game] Spawning ${totalCoins} coins over ${durationMs}ms (${intervalMs.toFixed(1)}ms per coin) at position (${centerX}, ${centerY})`);

		for (let i = 0; i < totalCoins; i++) {
			this.time.delayedCall(i * intervalMs, () => {
				this.coinAnimation.spawnSingleCoin(centerX, centerY);
			});
		}
	}

	/**
	 * Spawn a single coin at specific position
	 */
	public spawnSingleCoin(x?: number, y?: number, velocityX?: number, velocityY?: number): void {
		if (this.coinAnimation) {
			this.coinAnimation.spawnSingleCoin(x, y, velocityX, velocityY);
		}
	}

	/**
	 * Check if there's a delayed scatter animation waiting and start it
	 */
	private checkAndStartDelayedScatterAnimation(): void {
		if (this.symbols && this.symbols.scatterAnimationManager) {
			const scatterManager = this.symbols.scatterAnimationManager;
			
			// Check if there's delayed scatter data waiting
			if (scatterManager.delayedScatterData) {
				console.log('[Game] Found delayed scatter animation data - starting scatter animation after win dialogs');
				
				// Get the delayed data and clear it
				const delayedData = scatterManager.delayedScatterData;
				scatterManager.delayedScatterData = null;
				
				// Start the scatter animation with a small delay to ensure win dialogs are fully closed
				this.time.delayedCall(100, () => {
					console.log('[Game] Starting delayed scatter animation');
					scatterManager.playScatterAnimation(delayedData);
				});
			} else {
				console.log('[Game] No delayed scatter animation data found');
			}
		}
	}

	private setupBonusModeEventListeners(): void {
		// Listen for bonus mode events from dialogs
		this.events.on('setBonusMode', (isBonus: boolean) => {
			console.log(`[Game] Setting bonus mode: ${isBonus}`); 
			console.log(`[Game] Current gameStateManager.isBonus: ${this.gameStateManager.isBonus}`);
			
			// Disable winningsDisplay when bonus mode starts
			if (isBonus) {
				// Reset bonus-finished flag at the start of bonus mode
				//this.gameStateManager.isBonusFinished = false;
				console.log('[Game] Bonus mode started - disabling winningsDisplay');
				if (this.header && typeof this.header.hideWinningsDisplay === 'function') {
					this.header.hideWinningsDisplay();
					console.log('[Game] Header winningsDisplay disabled');
				} else {
					console.warn('[Game] Header not available or hideWinningsDisplay method not found');
				}
				
				// Also disable bonus header winningsDisplay
				if (this.bonusHeader && typeof this.bonusHeader.hideWinningsDisplay === 'function') {
					this.bonusHeader.hideWinningsDisplay();
					console.log('[Game] Bonus header winningsDisplay disabled');
				} else {
					console.warn('[Game] Bonus header not available or hideWinningsDisplay method not found');
				}

				// Switch to bonus background music
				if (this.audioManager) {
					this.audioManager.playBackgroundMusic(MusicType.BONUS);
					console.log('[Game] Switched to bonus background music');
				}
			} else {
				console.log('[Game] Bonus mode ended - enabling winningsDisplay');
				// Ensure bonus-finished flag is cleared and bonus mode is turned off when leaving bonus
				this.gameStateManager.isBonus = false;
				this.gameStateManager.isBonusFinished = false;
				// Clear autoplay-related flags like on fresh spin
				this.gameStateManager.isAutoPlaying = false;
				this.gameStateManager.isAutoPlaySpinRequested = false;
				this.gameStateManager.isShowingWinlines = false;
				this.gameStateManager.isShowingWinDialog = false;
				// Suppress any win dialogs that might be triggered during the transition back to base
				this.suppressWinDialogsUntilNextSpin = true;
				// Prevent re-showing any queued base-game win dialogs after bonus ends
				this.clearWinQueue();
				// Proactively reset visuals and symbols in case the dialog didn't emit them
				this.events.emit('hideBonusBackground');
				this.events.emit('hideBonusHeader');
				this.events.emit('resetSymbolsForBase');
				// Reset free spin-related state across components
				this.events.emit('resetFreeSpinState');
				// Hide winnings displays on both headers (same as on spin start)
				try {
					if (this.header && typeof this.header.hideWinningsDisplay === 'function') {
						this.header.hideWinningsDisplay();
					}
					if (this.bonusHeader && typeof this.bonusHeader.hideWinningsDisplay === 'function') {
						this.bonusHeader.hideWinningsDisplay();
					}
				} catch (e) {
					console.warn('[Game] Failed to hide winnings displays on bonus end:', e);
				}
				// Notify other systems autoplay is fully stopped
				gameEventManager.emit(GameEventType.AUTO_STOP);
				// Switch back to main background music
				if (this.audioManager) {
					this.audioManager.playBackgroundMusic(MusicType.MAIN);
					console.log('[Game] Switched to main background music');
				}
			}
			
			// TODO: Update backend data isBonus flag if needed
		});

		this.events.on('showBonusBackground', () => {
			console.log('[Game] ===== SHOW BONUS BACKGROUND EVENT RECEIVED =====');
			console.log('[Game] Background exists:', !!this.background);
			console.log('[Game] BonusBackground exists:', !!this.bonusBackground);
			
			// Hide normal background
			if (this.background) {
				this.background.getContainer().setVisible(false);
				console.log('[Game] Normal background hidden');
			}
			
			// Show bonus background
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(true);
				console.log('[Game] Bonus background shown');
				console.log('[Game] Bonus background container visible:', this.bonusBackground.getContainer().visible);
			} else {
				console.error('[Game] BonusBackground is null!');
			}
			console.log('[Game] ===== BONUS BACKGROUND EVENT HANDLED =====');
		});

		this.events.on('showBonusHeader', () => {
			console.log('[Game] ===== SHOW BONUS HEADER EVENT RECEIVED =====');
			console.log('[Game] Header exists:', !!this.header);
			console.log('[Game] BonusHeader exists:', !!this.bonusHeader);
			
			// Hide normal header
			if (this.header) {
				this.header.getContainer().setVisible(false);
				console.log('[Game] Normal header hidden');
			}
			
			// Show bonus header
			if (this.bonusHeader) {
				this.bonusHeader.getContainer().setVisible(true);
				console.log('[Game] Bonus header shown');
				console.log('[Game] Bonus header container visible:', this.bonusHeader.getContainer().visible);
			} else {
				console.error('[Game] BonusHeader is null!');
			}
			console.log('[Game] ===== BONUS HEADER EVENT HANDLED =====');
		});

		this.events.on('hideBonusBackground', () => {
			console.log('[Game] Hiding bonus background');
			
			// Show normal background
			if (this.background) {
				this.background.getContainer().setVisible(true);
				console.log('[Game] Normal background shown');
			}
			
			// Hide bonus background
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(false);
				console.log('[Game] Bonus background hidden');
			}
		});

		this.events.on('hideBonusHeader', () => {
			console.log('[Game] Hiding bonus header');
			
			// Show normal header
			if (this.header) {
				this.header.getContainer().setVisible(true);
				console.log('[Game] Normal header shown');
			}
			
			// Hide bonus header
			if (this.bonusHeader) {
				this.bonusHeader.getContainer().setVisible(false);
				console.log('[Game] Bonus header hidden');
			}
		});

		// Reset symbols and winlines back to base state
		this.events.on('resetSymbolsForBase', () => {
			console.log('[Game] Resetting symbols and winlines to base state');
			try {
				if (this.symbols) {
					this.symbols.ensureCleanSymbolState();
					this.symbols.clearWinLines();
					// Also hide any winning overlays and restore depths/visibility
					if (typeof (this.symbols as any).hideWinningOverlay === 'function') {
						(this.symbols as any).hideWinningOverlay();
					}
					if (typeof (this.symbols as any).resetSymbolDepths === 'function') {
						(this.symbols as any).resetSymbolDepths();
					}
					if (typeof (this.symbols as any).restoreSymbolVisibility === 'function') {
						(this.symbols as any).restoreSymbolVisibility();
					}
				}
				// Reset any internal flags related to win dialogs/winlines
				this.hasWinlinesThisSpin = false;
				gameStateManager.isShowingWinDialog = false;
				console.log('[Game] Symbols and winlines reset complete');
			} catch (e) {
				console.error('[Game] Error resetting symbols for base:', e);
			}
		});

		console.log('[Game] Bonus mode event listeners setup complete');
		
		// Add fullscreen toggle button (top-right) using shared manager
		const assetScale = this.networkManager.getAssetScale();
		FullScreenManager.addToggle(this, {
			margin: 16 * assetScale,
			iconScale: 1.5 * assetScale,
			depth: 1500,
			maximizeKey: 'maximize',
			minimizeKey: 'minimize'
		});

		// Add a test method to manually trigger bonus mode (for debugging)
		(window as any).testBonusMode = () => {
			console.log('[Game] TEST: Manually triggering bonus mode');
			console.log('[Game] TEST: Current isBonus state:', this.gameStateManager.isBonus);
			this.gameStateManager.isBonus = true;
			console.log('[Game] TEST: After setting isBonus to true:', this.gameStateManager.isBonus);
			this.events.emit('showBonusBackground');
			this.events.emit('showBonusHeader');
		};
		
		// Add a test method to simulate free spin dialog close
		(window as any).testFreeSpinDialogClose = () => {
			console.log('[Game] TEST: Simulating free spin dialog close');
			this.events.emit('showBonusBackground');
			this.events.emit('showBonusHeader');
		};
		
		// Add a method to check current state
		(window as any).checkBonusState = () => {
			console.log('[Game] Current game state:');
			console.log('- isBonus:', this.gameStateManager.isBonus);
			console.log('- isScatter:', this.gameStateManager.isScatter);
			console.log('- Background exists:', !!this.background);
			console.log('- BonusBackground exists:', !!this.bonusBackground);
			console.log('- Header exists:', !!this.header);
			console.log('- BonusHeader exists:', !!this.bonusHeader);
			if (this.background) console.log('- Background visible:', this.background.getContainer().visible);
			if (this.bonusBackground) console.log('- BonusBackground visible:', this.bonusBackground.getContainer().visible);
			if (this.header) console.log('- Header visible:', this.header.getContainer().visible);
			if (this.bonusHeader) console.log('- BonusHeader visible:', this.bonusHeader.getContainer().visible);
		};
		
		(window as any).spawnSingleCoin = (x?: number, y?: number) => {
			console.log(`[Game] TEST: Spawning single coin at (${x || 'center'}, ${y || 'center'})`);
			this.spawnSingleCoin(x, y);
		};
		
		(window as any).clearCoins = () => {
			console.log('[Game] TEST: Clearing all coins');
			if (this.coinAnimation) {
				this.coinAnimation.clearAllCoins();
			}
		};
		
		(window as any).getCoinCount = () => {
			const count = this.coinAnimation ? this.coinAnimation.getCoinCount() : 0;
			console.log(`[Game] TEST: Current coin count: ${count}`);
			return count;
		};
		
		console.log('[Game] Coin system ready! Press SPACEBAR to spawn coins or use console commands:');
		console.log('- spawnCoins(5) - Spawn 5 coins');
		console.log('- spawnSingleCoin(400, 300) - Spawn one coin at position');
		console.log('- clearCoins() - Remove all coins');
		console.log('- getCoinCount() - Check active coin count');

		this.registerSpinTestHarness();
	}

	switchBetweenModes(isBonus: boolean): void {
		if (isBonus) {
			this.background.getContainer().setVisible(false);
			this.bonusBackground.getContainer().setVisible(true);	
			this.header.getContainer().setVisible(false);
			this.bonusHeader.getContainer().setVisible(true);
		} else {
			this.background.getContainer().setVisible(true);
			this.bonusBackground.getContainer().setVisible(false);
			this.header.getContainer().setVisible(true);
			this.bonusHeader.getContainer().setVisible(false);
		}
	}

	changeScene() {
		// Scene change logic if needed
	}

	spin() {
		console.log('Game Spin');
		
		// Check if we're in bonus mode - if so, let the free spin autoplay system handle it
		if (this.gameStateManager.isBonus) {
			console.log('[Game] In bonus mode - skipping old spin system, free spin autoplay will handle it');
			return;
		}
		

		this.gameStateManager.startSpin();
	}

	private registerSpinTestHarness(): void {
		const globalScope = window as any;
		const ensureData = (payload?: any) => payload ?? BONUS_FREE_SPIN_TEST_DATA;

		globalScope.debugSpinData = BONUS_FREE_SPIN_TEST_DATA;

		globalScope.playTestSpin = async (options?: { autoFreeSpins?: boolean; spinData?: any }) => {
			const data = ensureData(options?.spinData);
			await this.runDebugSpinData(data, options?.autoFreeSpins ?? false);
		};

		globalScope.injectSpinData = async (spinData: any, autoFreeSpins: boolean = false) => {
			await this.runDebugSpinData(spinData, autoFreeSpins);
		};

		globalScope.startTestFreeSpins = async (spinData?: any) => {
			const data = ensureData(spinData);
			await this.runDebugSpinData(data, false);
			this.forceDebugFreeSpinAutoplay(data);
		};

		console.log('[Game] Debug spin harness ready. Use playTestSpin({ autoFreeSpins: true }) or startTestFreeSpins().');
	}

	private async runDebugSpinData(rawSpinData: any, autoFreeSpins: boolean): Promise<void> {
		if (!rawSpinData) {
			console.warn('[Game] No spin data supplied for debug run');
			return;
		}

		const normalized = this.cloneAndNormalizeSpinData(rawSpinData);

		if (this.gameAPI && typeof this.gameAPI.setFreeSpinData === 'function') {
			this.gameAPI.setFreeSpinData(normalized as unknown as SpinData);
		}

		gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, { spinData: normalized });

		if (autoFreeSpins) {
			this.forceDebugFreeSpinAutoplay(normalized);
		}
	}

	private cloneAndNormalizeSpinData(spinData: any): any {
		const clone = JSON.parse(JSON.stringify(spinData ?? {}));
		clone.playerId = clone.playerId ?? 'debug-player';

		const slot = clone.slot || (clone.slot = {});
		slot.area = Array.isArray(slot.area) ? slot.area : [];
		slot.paylines = Array.isArray(slot.paylines) ? slot.paylines : [];

		if (!slot.tumbles) {
			slot.tumbles = { items: [], multiplier: { symbols: [], total: 0 } };
		} else {
			slot.tumbles.items = Array.isArray(slot.tumbles.items) ? slot.tumbles.items : [];
			slot.tumbles.multiplier = slot.tumbles.multiplier || { symbols: [], total: 0 };
			slot.tumbles.multiplier.symbols = Array.isArray(slot.tumbles.multiplier.symbols)
				? slot.tumbles.multiplier.symbols
				: [];
			slot.tumbles.multiplier.total = slot.tumbles.multiplier.total ?? 0;
		}

		const freeSpinData = slot.freeSpin || slot.freespin;
		if (freeSpinData) {
			slot.freeSpin = freeSpinData;
			slot.freespin = freeSpinData;
			freeSpinData.items = Array.isArray(freeSpinData.items) ? freeSpinData.items : [];
		} else {
			slot.freeSpin = slot.freespin = { count: 0, totalWin: 0, items: [] };
		}

		return clone;
	}

	private forceDebugFreeSpinAutoplay(spinData: any): void {
		const freeSpinBlock = spinData?.slot?.freeSpin || spinData?.slot?.freespin;
		if (!freeSpinBlock || !Array.isArray(freeSpinBlock.items) || freeSpinBlock.items.length === 0) {
			console.warn('[Game] Debug free spin autoplay requested but the payload has no free spins.');
			return;
		}

		this.gameStateManager.isScatter = true;
		this.gameStateManager.isBonus = true;

		this.events.emit('setBonusMode', true);
		this.events.emit('showBonusBackground');
		this.events.emit('showBonusHeader');

		if (this.symbols && typeof (this.symbols as any).debugTriggerFreeSpinAutoplay === 'function') {
			(this.symbols as any).debugTriggerFreeSpinAutoplay(spinData);
		} else {
			console.warn('[Game] Symbols debug helper missing; autoplay will not start automatically.');
		}
	}

	turbo() {
		console.log('Game Turbo');
		this.gameStateManager.toggleTurbo();
	}

	autoplay() {
		// Autoplay logic handled by SlotController
	}

	info() {
		console.log('Game Info');
	}

	betAdd() {
		// Bet increase logic
	}

	betMinus() {
		// Bet decrease logic
	}

	toggleSettings() {
		// Settings toggle logic
	}

	setVolume(_level: number) {
		// Volume setting logic
	}

	setSfx(_level: number) {
		// SFX setting logic
	}

	update(time: number, delta: number) {
		// this.emberParticleSystem.update(this, time, delta);
		// Game state manager handles its own updates through event listeners

		// Track and record average frame rate every 2 seconds for debugging
		this.frameRateAccumulatorMs += delta;
		this.frameCountAccumulator++;

		if (this.frameRateAccumulatorMs >= 2000) {
			const seconds = this.frameRateAccumulatorMs / 1000;
			const averageFps = seconds > 0 ? this.frameCountAccumulator / seconds : 0;

			// Update global game state manager
			this.gameStateManager.lastRecordedFrameRate = averageFps;
			console.log(
				`[Game] lastRecordedFrameRate updated: ${averageFps.toFixed(2)} FPS`
			);

			// Reset accumulators for next window
			this.frameRateAccumulatorMs = 0;
			this.frameCountAccumulator = 0;
		}
	}

	shutdown() {
		this.events.once('shutdown', () => {
			// Clean up any game-specific resources if needed
		});
	}
}