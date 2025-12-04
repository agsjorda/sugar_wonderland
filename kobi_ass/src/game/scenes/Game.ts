import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Background } from '../components/Background';
import { Header } from '../components/Header';
import { SlotController } from '../components/SlotController';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { PaylineData } from '../../backend/SpinData';
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
import { IrisTransition } from '../components/IrisTransition';
import { CoinAnimation } from '../components/CoinAnimation';
import { GameAPI } from '../../backend/GameAPI';
import { SpinData } from '../../backend/SpinData';
import { AudioManager, MusicType, SoundEffectType } from '../../managers/AudioManager';
import { Menu } from '../components/Menu';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ScatterAnticipation } from '../components/ScatterAnticipation';
import { ClockDisplay } from '../components/ClockDisplay';
import { WinTracker } from '../components/WinTracker';
import { FreeRoundManager } from '../components/FreeRoundManager';

// Layer depths for consistent layering - higher values render on top
const LAYERS = {
    // Base background elements (furthest back)
    BACKGROUND: 0,
    // Reel frame/container (behind symbols but above background)
    REEL_FRAME: 100,
    // Actual reel symbols (on top of reel frame)
    REEL_SYMBOLS: 500,
    // Props and effects that should appear above reels but below header / coin effects
    PROPS_AND_EFFECTS: 600,
    // Header and other top-of-screen UI (above background/props, but below coin effects & dialogs)
    UI: 700,
    // Dialogs and popups (above regular UI)
    DIALOGS: 2000,
    // Transitions (topmost layer)
    TRANSITIONS: 3000
};

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
	private irisTransition: IrisTransition;
	private coinAnimation: CoinAnimation;
	public gameAPI: GameAPI;
	public audioManager: AudioManager;
	private menu: Menu;
	private scatterAnticipation: ScatterAnticipation;
	private clockDisplay: ClockDisplay;
	private winTracker: WinTracker;
	private freeRoundManager: FreeRoundManager;
	
	// Note: Payout data now calculated directly from paylines in WIN_STOP handler
	// Track whether this spin has winlines to animate
	private hasWinlinesThisSpin: boolean = false;
	
	// Queue for wins that occur while a dialog is already showing
	private winQueue: Array<{ payout: number; bet: number }> = [];
	private suppressWinDialogsUntilNextSpin: boolean = false;

	public gameData: GameData;
	private symbols: Symbols;

	constructor ()
	{
		super('Game');

		this.gameData = new GameData();
		this.symbols = new Symbols();
		this.menu = new Menu();
		this.scatterAnticipation = new ScatterAnticipation();
		this.winTracker = new WinTracker();
		this.freeRoundManager = new FreeRoundManager();
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
		// Ensure background container is behind reels and UI
		this.background.getContainer().setDepth(LAYERS.BACKGROUND);
		
		// Create spinner using the managers
		this.spinner = new Spinner(this.networkManager, this.screenModeManager);
		this.spinner.create(this);

		// Create header using the managers
		this.header = new Header(this.networkManager, this.screenModeManager);
		this.header.create(this);
		// Ensure header UI renders above props and reels
		this.header.getContainer().setDepth(LAYERS.UI);

		// Create persistent clock display (stays on screen above the game)
		const clockY = this.scale.height * 0.009; // Slightly below top edge
		this.clockDisplay = new ClockDisplay(this, {
			offsetX: -155,
			offsetY: clockY,
			fontSize: 16,
			color: '#FFFFFF',
			alpha: 0.9,
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

		// Create bonus background using the managers (initially hidden)
		console.log('[Game] Creating bonus background...');
		this.bonusBackground = new BonusBackground(this.networkManager, this.screenModeManager);
		this.bonusBackground.create(this);
		// Bonus background shares the same base depth as normal background
		this.bonusBackground.getContainer().setVisible(false).setDepth(LAYERS.BACKGROUND);
		console.log('[Game] Bonus background created and hidden');

		// Create bonus header using the managers (initially hidden)
		console.log('[Game] Creating bonus header...');
		this.bonusHeader = new BonusHeader(this.networkManager, this.screenModeManager);
		this.bonusHeader.create(this);
		// Bonus header uses the same UI layer depth
		this.bonusHeader.getContainer().setVisible(false).setDepth(LAYERS.UI);
		console.log('[Game] Bonus header created and hidden');

		//Create symbols
		console.log(`[Game] Creating symbols...`);
		this.symbols.create(this);
		// Ensure symbols container is above background but below UI
		if (this.symbols.container) {
			this.symbols.container.setDepth(LAYERS.REEL_SYMBOLS);
		}
		// Create win tracker bar below the reels in the base scene
		this.winTracker.create(this);
		try { (this as any).winTracker = this.winTracker; } catch {}
		// Console helper to adjust scale at runtime: setWinTrackerScale(0.2)
		try {
			(window as any).setWinTrackerScale = (scale: number) => {
				this.winTracker.setLayout({ iconScale: scale });
				return scale;
			};
			// Console helper to adjust modifier icon scale: setWinTrackerModifierScale(2)
			(window as any).setWinTrackerModifierScale = (scale: number) => {
				this.winTracker.setLayout({ multiplierIconScale: scale });
				return scale;
			};
		} catch {}

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

		// Create initialization FreeRoundManager AFTER SlotController so it can attach to its UI.
		try {
			const initData = this.gameAPI.getInitializationData
				? this.gameAPI.getInitializationData()
				: null;
			const initFsRemaining = this.gameAPI.getRemainingInitFreeSpins
				? this.gameAPI.getRemainingInitFreeSpins()
				: 0;
			const initFsBet = this.gameAPI.getInitFreeSpinBet
				? this.gameAPI.getInitFreeSpinBet()
				: null;

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
		
		// Create iris transition component
		this.irisTransition = new IrisTransition(this);
		// Show the iris transition and set it to radius 30 for game scene start
		this.irisTransition.show();
		// Set the iris to radius 30 (zoomed in) immediately for game scene
		this.irisTransition.setRadiusImmediate(30);
		
		// Create coin animation component
		this.coinAnimation = new CoinAnimation(this.networkManager, this.screenModeManager);
		this.coinAnimation.create(this);

		// Create scatter anticipation component inside background container to avoid symbol mask and stay behind symbols
		this.scatterAnticipation.create(this, this.background.getContainer());
		this.scatterAnticipation.hide();
		(this as any).scatterAnticipation = this.scatterAnticipation;
		
		// Zoom out the iris transition after 0.5 seconds
		this.time.delayedCall(500, () => {
			console.log('[Game] Starting iris zoom out from radius 30 to 1000');
			this.irisTransition.zoomInToRadius(1000, 2500); // Zoom out over 1.5 seconds
		});
		
		// Initialize balance on game start
		this.initializeGameBalance();
		
		// Add spacebar key listener for coin spawning
		this.input.keyboard?.on('keydown-SPACE', () => {
			console.log('[Game] Spacebar pressed - spawning coins');
			this.spawnCoins(3); // Spawn 3 coins when spacebar is pressed
		});
		
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
		//this.dialogs.showCongrats(this);

		// Show congratulations dialog (on top)
		//this.dialogs.showFreeSpinDialog(this);

		// Show large win dialog (on top)
		//this.dialogs.showLargeWin(this);

		// Show medium win dialog (on top)
		//this.dialogs.showMediumWin(this);

		// Bet options will be shown when + or - buttons are clicked

		// Show small win dialog (on top)
		//this.dialogs.showSmallWin(this, { winAmount: 123456789.00 });

		// Show medium win dialog (on top)
		//this.dialogs.showMediumWin(this, { winAmount: 2500000.50 });

		// Show large win dialog (on top)
		//this.dialogs.showLargeWin(this, { winAmount: 5000000.75 });

		// Show super win dialog (on top)
		// this.dialogs.showSuperWin(this, { winAmount: 10000000.00 });

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
			
			// Block bet options during scatter animation or bonus mode
			if (this.gameStateManager.isScatter || this.gameStateManager.isBonus ||
				this.gameStateManager.isReelSpinning || this.gameStateManager.isAutoPlaying ||
				this.gameStateManager.isShowingWinlines || this.gameStateManager.isWheelSpinning) {
				console.log('[Game] Bet options blocked (busy state active)');
				return;
			}
			
			// Get the current base bet from the slot controller (fallback to display if unavailable)
			const currentBetText = this.slotController.getBetAmountText();
			const baseBetAmount = this.slotController.getBaseBetAmount();
			const normalizedCurrentBet = Number.isFinite(baseBetAmount)
				? baseBetAmount
				: (currentBetText ? parseFloat(currentBetText) : 0.20);
			
			this.betOptions.show({
				currentBet: normalizedCurrentBet,
				onClose: () => {
					console.log('[Game] Bet options closed');
				},
				onConfirm: (betAmount: number) => {
					console.log(`[Game] Bet confirmed: £${betAmount}`);
					// Update the bet display in the slot controller
					this.slotController.updateBetAmount(betAmount);
					// Update the bet amount in the backend
					gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: betAmount, previousBet: normalizedCurrentBet });
				}
			});
		});

		// Listen for autoplay button click
		EventBus.on('autoplay', () => {
			console.log('[Game] Autoplay button clicked - showing options');
			
			const currentBetText = this.slotController.getBetAmountText();
			const baseBetAmount = this.slotController.getBaseBetAmount();
			const normalizedCurrentBet = Number.isFinite(baseBetAmount)
				? baseBetAmount
				: (currentBetText ? parseFloat(currentBetText) : 0.20);
			
			// Get the most current balance as a numeric value from the SlotController
			const currentBalance = this.slotController.getBalanceAmount();
			
			console.log(`[Game] Current balance for autoplay options: $${currentBalance}`);
			
			this.autoplayOptions.show({
				currentAutoplayCount: 10,
				currentBet: normalizedCurrentBet,
				currentBalance: currentBalance,
				onClose: () => {
					console.log('[Game] Autoplay options closed');
				},
				onConfirm: (autoplayCount: number) => {
					console.log(`[Game] Autoplay confirmed: ${autoplayCount} spins`);
					// Read the bet selected within the autoplay panel
					const selectedBet = this.autoplayOptions.getCurrentBet();
					// If bet changed, update UI and backend
					if (Math.abs(selectedBet - normalizedCurrentBet) > 0.0001) {
						this.slotController.updateBetAmount(selectedBet, { preserveAmplify: true });
						gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: selectedBet, previousBet: normalizedCurrentBet });
					}
					console.log(`[Game] Total cost: $${(selectedBet * autoplayCount).toFixed(2)}`);
					
					// Start autoplay using the new SlotController method
					this.slotController.startAutoplay(autoplayCount);
				}
			});
		});

		// Note: SPIN_RESPONSE event listeners removed - now using SPIN_DATA_RESPONSE

		// Listen for win start to spawn coins based on win amount
		gameEventManager.on(GameEventType.WIN_START, (data: any) => {
			console.log('[Game] WIN_START event received - spawning coins based on win amount');
			
			// Get current spin data to determine win amount
			if (this.symbols && this.symbols.currentSpinData) {
				const spinData = this.symbols.currentSpinData;
				const totalWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
				const betAmount = parseFloat(spinData.bet);
				
				console.log(`[Game] WIN_START: Total win: $${totalWin}, bet: $${betAmount}`);
				this.spawnCoinsForWin(totalWin, betAmount);
			} else {
				console.log('[Game] WIN_START: No current spin data available, spawning default 5 coins');
				this.spawnCoins(5);
			}
		});

		// Listen for winline animations completion to show win dialogs
		gameEventManager.on(GameEventType.WIN_STOP, (data: any) => {
			console.log('[Game] WIN_STOP event received');
			
			// Get the current spin data from the Symbols component
			if (this.symbols && this.symbols.currentSpinData) {
				const spinData = this.symbols.currentSpinData;
				console.log('[Game] WIN_STOP: Found current spin data, calculating total win from paylines');
				
				// Calculate total win from paylines
				const totalWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
				const betAmount = parseFloat(spinData.bet);
				
				console.log(`[Game] WIN_STOP: Total win calculated: $${totalWin}, bet: $${betAmount}`);
				// Schedule win tracker auto-hide shortly after win animations complete
				try { this.winTracker.autoHideAfter(1500); } catch {}
				
				if (totalWin > 0) {
					// Note: Win dialog threshold check moved to Symbols component for earlier detection
					this.checkAndShowWinDialog(totalWin, betAmount);
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

		// Listen for reel completion to handle balance updates only
		gameEventManager.on(GameEventType.REELS_STOP, () => {
			console.log('[Game] REELS_STOP event received');
			
			// Update balance from server after REELS_STOP (for no-wins scenarios)
			// Skip during scatter/bonus; balance will be finalized after bonus ends
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceAfterWinStop();
			} else {
				console.log('[Game] Skipping balance update on REELS_STOP (scatter/bonus active)');
			}
			
			// Request balance update to finalize the spin (add winnings to balance)
			// This is needed to complete the spin cycle and update the final state
			console.log('[Game] Reels done - requesting balance update to finalize spin');
			gameEventManager.emit(GameEventType.BALANCE_UPDATE);
			
			// Note: Win dialog logic moved to WIN_STOP handler using payline data
			// No fallback logic needed here - WinLineDrawer handles all timing
			console.log('[Game] REELS_STOP: Balance update requested, WIN_STOP handled by winline animations');
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
			// Clear win tracker display for the new spin so it only shows during active winlines
			try { this.winTracker.clear(); } catch {}
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
	 * Calculate total win amount from paylines array
	 */
	private calculateTotalWinFromPaylines(paylines: PaylineData[]): number {
		if (!paylines || paylines.length === 0) {
			return 0;
		}
		
		const totalWin = paylines.reduce((sum, payline) => {
			const winAmount = payline.win || 0;
			console.log(`[Game] Payline ${payline.lineKey}: ${winAmount} (symbol ${payline.symbol}, count ${payline.count})`);
			return sum + winAmount;
		}, 0);
		
		console.log(`[Game] Calculated total win: ${totalWin} from ${paylines.length} paylines`);
		return totalWin;
	}

	/**
	 * Check if payout reaches win dialog thresholds and show appropriate dialog
	 */
	private checkAndShowWinDialog(payout: number, bet: number): void {
		// Suppress win dialogs if we're transitioning out of bonus back to base
		if (this.suppressWinDialogsUntilNextSpin) {
			console.log('[Game] Suppressing win dialog (transitioning from bonus to base)');
			return;
		}
		console.log(`[Game] checkAndShowWinDialog called with payout: $${payout}, bet: $${bet}`);
		console.log(`[Game] Current win queue length: ${this.winQueue.length}`);
		console.log(`[Game] Current isShowingWinDialog state: ${gameStateManager.isShowingWinDialog}`);
		console.log(`[Game] Current dialog showing state: ${this.dialogs.isDialogShowing()}`);
		
		// Check if the win line animation was interrupted by a manual spin
		if (this.symbols && this.symbols.winLineDrawer && this.symbols.winLineDrawer.wasInterruptedBySpin()) {
			console.log('[Game] Win line animation was interrupted by manual spin - preventing win dialog from showing');
			return;
		}
		
		// Check if a dialog is already showing - prevent multiple dialogs
		if (this.dialogs.isDialogShowing()) {
			console.log('[Game] Dialog already showing, skipping win dialog for this payout');
			// Add to queue if dialog is already showing
			this.winQueue.push({ payout: payout, bet: bet });
			console.log(`[Game] Added to win queue. Queue length: ${this.winQueue.length}`);
			return;
		}
		
		const multiplier = payout / bet;
		console.log(`[Game] Win detected - Payout: $${payout}, Bet: $${bet}, Multiplier: ${multiplier}x`);
		
		// Only show dialogs for wins that are at least 20x the bet size
		if (multiplier < 20) {
			console.log(`[Game] Win below threshold - No dialog shown for ${multiplier.toFixed(2)}x multiplier`);
			// Clear the win dialog state since no dialog was shown
			gameStateManager.isShowingWinDialog = false;
			return;
		}
		
		// Determine which win dialog to show based on multiplier thresholds
		if (multiplier >= 60) {
			console.log(`[Game] Large Win! Showing LargeW_KA dialog for ${multiplier.toFixed(2)}x multiplier`);
			this.dialogs.showLargeWin(this, { winAmount: payout });
		} else if (multiplier >= 45) {
			console.log(`[Game] Super Win! Showing SuperW_KA dialog for ${multiplier.toFixed(2)}x multiplier`);
			this.dialogs.showSuperWin(this, { winAmount: payout });
		} else if (multiplier >= 30) {
			console.log(`[Game] Medium Win! Showing MediumW_KA dialog for ${multiplier.toFixed(2)}x multiplier`);
			this.dialogs.showMediumWin(this, { winAmount: payout });
		} else if (multiplier >= 20) {
			console.log(`[Game] Small Win! Showing SmallW_KA dialog for ${multiplier.toFixed(2)}x multiplier`);
			this.dialogs.showSmallWin(this, { winAmount: payout });
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
	 * Spawn coins manually (for testing or special events)
	 */
	public spawnCoins(count: number = 3): void {
		if (this.coinAnimation) {
			this.coinAnimation.spawnCoins(count);
			// Play coin throw SFX once when coins spawn
			try {
				const audio = (window as any).audioManager as AudioManager | undefined;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect(SoundEffectType.COIN_THROW);
				}
			} catch {}
		}
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
		// Delay 1 second before spawning coins and playing SFX
		this.time.delayedCall(500, () => {
			// Play coin throw SFX once at start of win-based coin spawn
			try {
				const audio = (window as any).audioManager as AudioManager | undefined;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect(SoundEffectType.COIN_THROW);
				}
			} catch {}
			// Spawn coins over 1.5 seconds
			this.spawnCoinsOverTime(coinCount, 1500);
		});
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
				// Ensure bet options panel is closed during bonus
				try {
					if (this.betOptions && this.betOptions.isVisible()) {
						this.betOptions.hide();
						console.log('[Game] Closed BetOptions panel on bonus start');
					}
				} catch {}
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
			
			// Hide normal background and props
			if (this.background) {
				this.background.getContainer().setVisible(false);
				this.background.hideProps();
				console.log('[Game] Normal background and props hidden');
			}
			
			// Show bonus background and its props
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(true);
				this.bonusBackground.showProps();
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
			
			// Show normal background and props
			if (this.background) {
				this.background.getContainer().setVisible(true);
				this.background.showProps();
				console.log('[Game] Normal background and props shown');
			}
			
			// Hide bonus background and its props
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(false);
				this.bonusBackground.hideProps();
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
		
		// Add coin testing methods
		(window as any).spawnCoins = (count: number = 3) => {
			console.log(`[Game] TEST: Spawning ${count} coins (or press SPACEBAR)`);
			this.spawnCoins(count);
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
		
		// Reset the interrupted flag for the new spin
		if (this.symbols && this.symbols.winLineDrawer) {
			this.symbols.winLineDrawer.resetInterruptedFlag();
		}
		
		// Check if win line drawer is still animating and hasn't completed first loop
		if (this.symbols && this.symbols.winLineDrawer) {
			this.symbols.winLineDrawer.forceEmitWinStopIfNeeded();
		}
		
		this.gameStateManager.startSpin();
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
		// Game state manager handles its own updates through event listeners
	}

	shutdown() {
		this.events.once('shutdown', () => {
			// Clean up any game-specific resources if needed
		});
	}
}
