			import { Scene, Geom } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { EventBus } from "../EventBus";
import { GameData, setSpeed } from "./GameData";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { GameAPI } from '../../backend/GameAPI';
import { SpinData, SpinDataUtils } from '../../backend/SpinData';
import { BuyFeature } from './BuyFeature';
import { Symbols } from './Symbols';
import { SoundEffectType } from '../../managers/AudioManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { SymbolGenerator } from '../../tmp_backend/SymbolGenerator';
import {
  TURBO_OFFSET_X, TURBO_OFFSET_Y,
  AUTOPLAY_OFFSET_X, AUTOPLAY_OFFSET_Y,
  AMPLIFY_OFFSET_X, AMPLIFY_OFFSET_Y,
  FEATURE_OFFSET_X, FEATURE_OFFSET_Y,
  BET_MINUS_OFFSET_X, BET_MINUS_OFFSET_Y,
  BET_PLUS_OFFSET_X, BET_PLUS_OFFSET_Y,
  TURBO_LABEL_OFFSET_X, TURBO_LABEL_OFFSET_Y,
  AUTOPLAY_LABEL_OFFSET_X, AUTOPLAY_LABEL_OFFSET_Y,
  AMPLIFY_LABEL_OFFSET_X, AMPLIFY_LABEL_OFFSET_Y,
  MENU_LABEL_OFFSET_X, MENU_LABEL_OFFSET_Y,
  CONTROLLER_CONTAINER_OFFSET_X, CONTROLLER_CONTAINER_OFFSET_Y
} from '../../config/UIPositionConfig';
import { AMPLIFY_DESCRIPTION_OFFSET_X, AMPLIFY_DESCRIPTION_OFFSET_Y } from '../../config/UIPositionConfig';

export class SlotController {
	private controllerContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private scene: Scene | null = null;
	private gameData: GameData | null = null;
	private gameAPI: GameAPI | null = null;
	private symbols: Symbols | null = null;
	private buttons: Map<string, Phaser.GameObjects.Image> = new Map();
	private betAmountText: Phaser.GameObjects.Text;
	private betDollarText: Phaser.GameObjects.Text;
	private balanceAmountText: Phaser.GameObjects.Text;
	private balanceDollarText: Phaser.GameObjects.Text;
	private featureAmountText: Phaser.GameObjects.Text;
	private featureDollarText: Phaser.GameObjects.Text;
	private primaryControllers: Phaser.GameObjects.Container;
	private controllerTexts: Phaser.GameObjects.Text[] = [];
	private amplifyDescriptionContainer: Phaser.GameObjects.Container;
	// References for bet UI interactivity control
	private betLabelRef: Phaser.GameObjects.Text | null = null;
	private betCentralZone: Phaser.GameObjects.Zone | null = null;
	// Adjustable UI hitbox modifiers (tweak these to trim or clamp clickable widths)
	private uiHitboxModifiers: {
		marginPx: number; // gap between feature button and bet zone when auto-resizing
		betCenterWidthPx?: number; // optional hard cap for bet zone width
		betCenterTrimLeftPx?: number; // extra trim on left side of bet zone
		betCenterTrimRightPx?: number; // extra trim on right side of bet zone
		featureTrimLeftPx?: number; // optional trim for feature button (left side)
		featureTrimRightPx?: number; // optional trim for feature button (right side)
	} = {
		marginPx: 8,
		betCenterWidthPx: undefined,
		betCenterTrimLeftPx: 0,
		betCenterTrimRightPx: 0,
		featureTrimLeftPx: 0,
		featureTrimRightPx: 0
	};
    private freeSpinLabel: Phaser.GameObjects.Text;
    private freeSpinNumber: Phaser.GameObjects.Text;
    private freeSpinSubLabel: Phaser.GameObjects.Text;
    // Digit-based free spin number display (using number_0..9 images)
    private freeSpinDigitsContainer: Phaser.GameObjects.Container;
    private freeSpinNumberDigitSprites: Phaser.GameObjects.Image[] = [];
    private freeSpinDigitsScale: number = .5;
    private freeSpinDigitsOffsetX: number = -4;
    private freeSpinDigitsOffsetY: number = -250;
    private freeSpinDigitsSpacing: number = 2;
    private freeSpinDigitsAlign: 'left' | 'center' | 'right' = 'left';
    // Free spin display base and configurable offset
    private freeSpinBaseX: number = 0;
    private freeSpinBaseY: number = 0;
    private freeSpinOffsetX: number = 0;
    private freeSpinOffsetY: number = 60;
	private autoplaySpinsRemainingText!: Phaser.GameObjects.Text;
	private isSpinLocked: boolean = false;
	private isBuyFeatureLocked: boolean = false;
	private pendingFreeSpinsData: { scatterIndex: number; actualFreeSpins: number } | null = null;
	
	// Store pending balance updates until reels stop spinning
	private pendingBalanceUpdate: { balance: number; bet: number; winnings?: number } | null = null;
	
	// Spine animation for spin button
	private spinButtonAnimation: any = null;
	
	// Spine animation for autoplay button (looping when active)
	private autoplayButtonAnimation: any = null;
	
	// Spine animation for turbo button (looping when active)
	private turboButtonAnimation: any = null;
	
	// Spin icon overlay and its tween
	private spinIcon: Phaser.GameObjects.Image | null = null;
	private spinIconTween: Phaser.Tweens.Tween | null = null;
	
	// Autoplay stop icon overlay
	private autoplayStopIcon: Phaser.GameObjects.Image | null = null;
	// Guard to prevent re-entrant stop logic
	private isStoppingAutoplay: boolean = false;

	// Guard to ensure we decrement autoplay counter once per spin at REELS_START
	private hasDecrementedAutoplayForCurrentSpin: boolean = false;
	// Guard to ensure we only schedule the next autoplay spin once per spin
	private hasScheduledNextAutoplayForCurrentSpin: boolean = false;
	// Per-spin identity to avoid duplicate decrement/schedule across duplicate events
	private spinSequence: number = 0;
	private currentSpinId: number = 0;
	private lastDecrementSpinId: number = -1;
	private lastScheduleSpinId: number = -1;
	
	// Buy feature drawer component
	private buyFeature: BuyFeature | null = null;
	
	// Amplify bet pulsing system
	private amplifyBetBounceTimer: Phaser.Time.TimerEvent | null = null;
	
	// Amplify bet spine animation
	private amplifyBetAnimation: any = null;

	// Enhance Bet idle loop spine animation (shown when enhanced bet is ON)
	private enhanceBetIdleAnimation: any = null;
	
	// Flag to prevent amplify bet reset during internal bet changes
	private isInternalBetChange: boolean = false;

	// Feature button enable guard: only allow enabling after explicit setBonusMode(false)
	private canEnableFeatureButton: boolean = true;
	
	// Store the base bet amount (without amplify bet increase) for API calls
	private baseBetAmount: number = 0;
	// Store an independent Buy Feature bet amount (decoupled from main BET)
	private buyFeatureBetAmount: number = 0.2;

	// Predefined bet steps (must match BetOptions)
	private readonly betOptions: number[] = [
		0.2, 0.4, 0.6, 0.8, 1,
		1.2, 1.6, 2, 2.4, 2.8,
		3.2, 3.6, 4, 5, 6,
		8, 10, 14, 18, 24,
		32, 40, 60, 80, 100,
		110, 120, 130, 140, 150
	];
	
	// Simple autoplay system
	private autoplaySpinsRemaining: number = 0;
	private autoplayTimer: Phaser.Time.TimerEvent | null = null;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
		
		// Initialize buy feature component
		this.buyFeature = new BuyFeature();
		
		// Listen for autoplay state changes
		this.setupAutoplayEventListeners();
	}

	private showOutOfBalancePopup(message?: string): void {
		const scene = this.scene as Scene | null;
		if (!scene) return;
		import('./OutOfBalancePopup').then(module => {
			const Popup = module.OutOfBalancePopup;
			const popup = new Popup(scene);
			if (message) popup.updateMessage(message);
			popup.show();
		}).catch(() => {});
	}

	/**
	 * Set the symbols component reference
	 * This allows the SlotController to access free spin data from the Symbols component
	 */
	public setSymbols(symbols: Symbols): void {
		this.symbols = symbols;
		console.log('[SlotController] Symbols component reference set');
	}

	/**
	 * Set the BuyFeature reference in the BuyFeature component
	 * This allows the BuyFeature to access current bet information
	 */
	public setBuyFeatureReference(): void {
		if (this.buyFeature) {
			this.buyFeature.setSlotController(this);
			console.log('[SlotController] BuyFeature reference set');
		}
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[SlotController] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[SlotController] Creating controller elements");
		
		// Store scene reference for event listening
		this.scene = scene;
		
		// Get GameData from the scene
		if (scene.scene.key === 'Game') {
			this.gameData = (scene as any).gameData;
			this.gameAPI = (scene as any).gameAPI;
		}
		
		// Create main container for all controller elements
		this.controllerContainer = scene.add.container(0, 0);
		// Ensure controller UI renders above coin animations (800) but below dialogs (1000)
		this.controllerContainer.setDepth(900);
		// Apply container-level global offset so all buttons and labels move together
		this.controllerContainer.setPosition(
			CONTROLLER_CONTAINER_OFFSET_X,
			CONTROLLER_CONTAINER_OFFSET_Y
		);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[SlotController] Creating controller with scale: ${assetScale}x`);

		// Add controller elements
		this.createControllerElements(scene, assetScale);
		
		// Create buy feature component
		if (this.buyFeature) {
			this.buyFeature.create(scene);
		}
		
		// Setup bonus mode event listener
		this.setupBonusModeEventListener();
		
		// Setup spin state change listener
		this.setupSpinStateListener();
		
		// No need to set initial spin button state here - will be handled when reels finish
	}

	private getTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
		return {
			fontSize: '10px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular',
		};
	}

	private createControllerElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		if (screenConfig.isPortrait) {
			this.createPortraitController(scene, assetScale);
		} else {
			this.createLandscapeController(scene, assetScale);
		}
	}


	/**
	 * Create the spin button spine animation
	 */
	private createSpinButtonAnimation(scene: Scene, assetScale: number): void {
		try {
			// Ensure Spine factory is available; retry shortly if not
			if (!ensureSpineFactory(scene, '[SlotController] createSpinButtonAnimation')) {
				scene.time.delayedCall(300, () => this.createSpinButtonAnimation(scene, assetScale));
				return;
			}
			// Check if the spine assets are loaded
			if (!scene.cache.json.has('spin_button_animation')) {
				console.warn('[SlotController] spin_button_animation spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createSpinButtonAnimation(scene, assetScale);
				});
				return;
			}

			// Get the spin button position to place the animation at the same location
			const spinButton = this.buttons.get('spin');
			if (!spinButton) {
				console.warn('[SlotController] Spin button not found, cannot position animation');
				return;
			}

			// Create spine animation at the same position as the spin button
			// Following the exact same pattern as kobi-ass animation in Header.ts
			this.spinButtonAnimation = scene.add.spine(
				spinButton.x, 
				spinButton.y, 
				"spin_button_animation", 
				"spin_button_animation-atlas"
			);
			
			// Set properties following the same pattern as kobi-ass
			this.spinButtonAnimation.setOrigin(0.495, 0.49);
			this.spinButtonAnimation.setScale(assetScale * 0.465); // Same scale as spin button
			this.spinButtonAnimation.setDepth(9); // Behind the spin button
			
			// Set animation speed to 1.3x
			this.spinButtonAnimation.animationState.timeScale = 1.3;
			
			// Initially hide the animation
			this.spinButtonAnimation.setVisible(false);
			this.spinButtonAnimation.setAlpha(0.8);
			
			// Add to the primary controllers container just below the spin button
			if (this.primaryControllers) {
				const spinIndex = this.primaryControllers.getIndex(spinButton);
				this.primaryControllers.addAt(this.spinButtonAnimation, spinIndex);
			} else {
				this.controllerContainer.add(this.spinButtonAnimation);
			}
			
			console.log('[SlotController] Spin button spine animation created successfully with 1.3x speed');
		} catch (error) {
			console.error('[SlotController] Error creating Spine button animation:', error);
		}
	}

	/**
	 * Create the autoplay button spine animation
	 */
	private createAutoplayButtonAnimation(scene: Scene, assetScale: number): void {
		try {
			// Ensure Spine factory is available; retry shortly if not
			if (!ensureSpineFactory(scene, '[SlotController] createAutoplayButtonAnimation')) {
				scene.time.delayedCall(300, () => this.createAutoplayButtonAnimation(scene, assetScale));
				return;
			}
			// Check if the spine assets are loaded
			if (!scene.cache.json.has('button_animation_idle')) {
				console.warn('[SlotController] button_animation_idle spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createAutoplayButtonAnimation(scene, assetScale);
				});
				return;
			}

			// Get the autoplay button position to place the animation at the same location
			const autoplayButton = this.buttons.get('autoplay');
			if (!autoplayButton) {
				console.warn('[SlotController] Autoplay button not found, cannot position animation');
				return;
			}

			// Create spine animation at the same position as the autoplay button
			// Following the exact same pattern as kobi-ass animation in Header.ts
			this.autoplayButtonAnimation = scene.add.spine(
				autoplayButton.x - 4, 
				autoplayButton.y - 26, 
				"button_animation_idle", 
				"button_animation_idle-atlas"
			);
			
			// Set properties following the same pattern as kobi-ass
			this.autoplayButtonAnimation.setOrigin(0.5, 0.5);
			this.autoplayButtonAnimation.setScale(assetScale * 0.16); // Same scale as autoplay button
			this.autoplayButtonAnimation.setDepth(11); // Above the autoplay button
			
			// Set animation speed to 1.3x (same as spin button)
			this.autoplayButtonAnimation.animationState.timeScale = 1;
			
			// Initially hide the animation
			this.autoplayButtonAnimation.setVisible(false);
			
			// Add to the primary controllers container so it gets disabled/enabled with other controls
			this.primaryControllers.add(this.autoplayButtonAnimation);
			
			console.log('[SlotController] Autoplay button spine animation created successfully with 1.3x speed');
		} catch (error) {
			console.error('[SlotController] Error creating Spine autoplay button animation:', error);
		}
	}

	/**
	 * Create the turbo button spine animation
	 */
	private createTurboButtonAnimation(scene: Scene, assetScale: number): void {
		try {
			// Ensure Spine factory is available; retry shortly if not
			if (!ensureSpineFactory(scene, '[SlotController] createTurboButtonAnimation')) {
				scene.time.delayedCall(300, () => this.createTurboButtonAnimation(scene, assetScale));
				return;
			}
			// Check if the spine assets are loaded
			if (!scene.cache.json.has('turbo_animation')) {
				console.warn('[SlotController] turbo_animation spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createTurboButtonAnimation(scene, assetScale);
				});
				return;
			}

			// Get the turbo button position to place the animation at the same location
			const turboButton = this.buttons.get('turbo');
			if (!turboButton) {
				console.warn('[SlotController] Turbo button not found, cannot position animation');
				return;
			}

			// Create spine animation at the same position as the turbo button
			// Following the exact same pattern as kobi-ass animation in Header.ts
			this.turboButtonAnimation = scene.add.spine(
				turboButton.x, 
				turboButton.y + 7, 
				"turbo_animation", 
				"turbo_animation-atlas"
			);
			
			// Set properties following the same pattern as kobi-ass
			this.turboButtonAnimation.setOrigin(0.5, 0.5);
			this.turboButtonAnimation.setScale(assetScale * 1); // Same scale as turbo button
			this.turboButtonAnimation.setDepth(11); // Above the turbo button
			
			// Set animation speed to 1.3x (same as spin button)
			this.turboButtonAnimation.animationState.timeScale = 1;
			
			// Initially hide the animation
			this.turboButtonAnimation.setVisible(false);
			
			// Add to the primary controllers container so it gets disabled/enabled with other controls
			this.primaryControllers.add(this.turboButtonAnimation);
			
			console.log('[SlotController] Turbo button spine animation created successfully with 1.3x speed');
		} catch (error) {
			console.error('[SlotController] Error creating Spine turbo button animation:', error);
		}
	}

	/**
	 * Create the autoplay spins remaining text
	 */
	private createAutoplaySpinsRemainingText(scene: Scene, assetScale: number): void {
		// Get the spin button position to place the text at the same location
		const spinButton = this.buttons.get('spin');
		if (!spinButton) {
			console.warn('[SlotController] Spin button not found, cannot position autoplay spins text');
			return;
		}

		// Create text element positioned at the same location as the spin button
		this.autoplaySpinsRemainingText = scene.add.text(
			spinButton.x,
			spinButton.y,
			'0',
			{
				fontSize: '24px',
				color: '#ffffff',
				fontFamily: 'Poppins-Regular',
				stroke: '#379557',
				strokeThickness: 4
			}
		);
		
		// Set properties
		this.autoplaySpinsRemainingText.setOrigin(0.5, 0.5);
		this.autoplaySpinsRemainingText.setDepth(20); // Ensure above spin button, spin icon, and stop icon
		
		// Initially hide the text (only show when autoplay is active)
		this.autoplaySpinsRemainingText.setVisible(false);
		
		// Add to the primary controllers container so it gets disabled/enabled with other controls
		this.primaryControllers.add(this.autoplaySpinsRemainingText);
		// Ensure it's on top within the container ordering
		this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
		
		console.log('[SlotController] Autoplay spins remaining text created successfully');
	}

	/**
	 * Show the autoplay spins remaining text
	 */
	private showAutoplaySpinsRemainingText(): void {
		if (this.autoplaySpinsRemainingText) {
			this.autoplaySpinsRemainingText.setVisible(true);
			if (this.primaryControllers) {
				this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
			}
			console.log('[SlotController] Autoplay spins remaining text shown');
		}
	}

	/**
	 * Hide the autoplay spins remaining text
	 */
	private hideAutoplaySpinsRemainingText(): void {
		if (this.autoplaySpinsRemainingText) {
			this.autoplaySpinsRemainingText.setVisible(false);
			console.log('[SlotController] Autoplay spins remaining text hidden');
		}
	}

	/**
	 * Disable bet buttons (grey out and disable interaction)
	 */
	private disableBetButtons(): void {
		const decreaseBetButton = this.buttons.get('decrease_bet');
		const increaseBetButton = this.buttons.get('increase_bet');
		
		if (decreaseBetButton) {
			decreaseBetButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			decreaseBetButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Decrease bet button disabled');
		}
		
		if (increaseBetButton) {
			increaseBetButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			increaseBetButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Increase bet button disabled');
		}

		// Also disable bet label and central zone
		if (this.betLabelRef) {
			this.betLabelRef.disableInteractive();
		}
		if (this.betCentralZone) {
			this.betCentralZone.disableInteractive();
		}
		if (this.betAmountText) {
			this.betAmountText.disableInteractive();
		}
	}

	/**
	 * Enable bet buttons (restore opacity and enable interaction)
	 */
	private enableBetButtons(): void {
		const decreaseBetButton = this.buttons.get('decrease_bet');
		const increaseBetButton = this.buttons.get('increase_bet');
		
		if (decreaseBetButton) {
			decreaseBetButton.setAlpha(1.0); // Restore full opacity
			decreaseBetButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Decrease bet button enabled');
		}
		
		if (increaseBetButton) {
			increaseBetButton.setAlpha(1.0); // Restore full opacity
			increaseBetButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Increase bet button enabled');
		}

		// Also re-enable bet label and central zone
		if (this.betLabelRef) {
			this.betLabelRef.setInteractive();
		}
		if (this.betCentralZone) {
			this.betCentralZone.setInteractive();
		}
		if (this.betAmountText) {
			this.betAmountText.setInteractive();
		}
	}

	/**
	 * Disable feature button (grey out and disable interaction)
	 */
	private disableFeatureButton(): void {
		const featureButton = this.buttons.get('feature');
		
		if (featureButton) {
			featureButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			featureButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Feature button disabled');
		}
	}

	/**
	 * Enable feature button (restore opacity and enable interaction)
	 */
	private enableFeatureButton(): void {
		const featureButton = this.buttons.get('feature');
		
		if (featureButton) {
			// Guard: never enable while reels are spinning or spin flow is locked
			if (gameStateManager.isReelSpinning || this.isSpinLocked) {
				console.log('[SlotController] Skipping feature enable (reels spinning or spin locked)');
				return;
			}
			const gameData = this.getGameData();
			// Guard: do not re-enable during bonus or before explicit allow
			if (gameStateManager.isBonus || !this.canEnableFeatureButton || (gameData && gameData.isEnhancedBet)) {
				console.log('[SlotController] Skipping feature enable (bonus active or not allowed yet)');
				return;
			}
			featureButton.setAlpha(1.0); // Restore full opacity
			featureButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Feature button enabled');
		}
	}

	/**
	 * Update the autoplay spins remaining text
	 */
	private updateAutoplaySpinsRemainingText(spinsRemaining: number): void {
		if (this.autoplaySpinsRemainingText) {
			this.autoplaySpinsRemainingText.setText(spinsRemaining.toString());
			if (this.primaryControllers) {
				this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
			}
			console.log(`[SlotController] Autoplay spins remaining text updated to: ${spinsRemaining}`);
		}
	}

    /** Render free spin count using digit images (number_0..number_9). */
    private renderFreeSpinDigits(value: number): void {
        if (!this.freeSpinDigitsContainer || !this.scene) return;
        // Clear previous digits
        for (const s of this.freeSpinNumberDigitSprites) { try { s.destroy(); } catch {} }
        this.freeSpinNumberDigitSprites = [];

        const valueStr = `${Math.max(0, Math.floor(value))}`;
        if (valueStr.length === 0) return;

        // Create sprites at base scale
        const temp: Phaser.GameObjects.Image[] = [];
        for (let i = 0; i < valueStr.length; i++) {
            const key = `number_${valueStr[i]}`;
            if (this.scene.textures.exists(key)) {
                const img = this.scene.add.image(0, 0, key);
                img.setOrigin(0.5, 0.5);
                img.setScale(this.freeSpinDigitsScale);
                temp.push(img);
            }
        }
        if (temp.length === 0) return;

        // Compute total width and clamp to a max region width
        const screenW = this.scene.scale.width;
        const maxRegionWidth = Math.max(80, Math.min(screenW * 0.25, screenW - 40));
        let totalW = 0;
        for (let i = 0; i < temp.length; i++) {
            totalW += temp[i].displayWidth;
            if (i < temp.length - 1) totalW += this.freeSpinDigitsSpacing;
        }
        if (totalW > maxRegionWidth) {
            const adjust = maxRegionWidth / totalW;
            for (const s of temp) s.setScale(s.scaleX * adjust);
            // Recompute
            totalW = 0;
            for (let i = 0; i < temp.length; i++) {
                totalW += temp[i].displayWidth;
                if (i < temp.length - 1) totalW += this.freeSpinDigitsSpacing;
            }
        }

        // Position digits inside the container around (0,0) with offsets
        let startX = this.freeSpinDigitsOffsetX;
        if (this.freeSpinDigitsAlign === 'center') startX -= totalW / 2;
        else if (this.freeSpinDigitsAlign === 'right') startX -= totalW;
        const baseY = this.freeSpinDigitsOffsetY;

        let cursor = startX;
        for (let i = 0; i < temp.length; i++) {
            const s = temp[i];
            s.setPosition(cursor + s.displayWidth / 2, baseY);
            cursor += s.displayWidth + (i < temp.length - 1 ? this.freeSpinDigitsSpacing : 0);
            this.freeSpinDigitsContainer.add(s);
            this.freeSpinNumberDigitSprites.push(s);
        }

        // Clamp container X so digits remain within the screen
        const half = totalW / 2;
        const minX = 20 + half;
        const maxX = screenW - 20 - half;
        if (this.freeSpinDigitsAlign === 'center') {
            const currentX = this.freeSpinDigitsContainer.x + this.freeSpinDigitsOffsetX;
            const targetX = Math.max(minX, Math.min(maxX, currentX));
            // Shift container to keep centered digits within bounds
            const delta = targetX - currentX;
            this.freeSpinDigitsContainer.x += delta;
        } else if (this.freeSpinDigitsAlign === 'left') {
            const leftEdge = this.freeSpinDigitsContainer.x + startX;
            if (leftEdge < 20) this.freeSpinDigitsContainer.x += (20 - leftEdge);
            const rightEdge = this.freeSpinDigitsContainer.x + startX + totalW;
            if (rightEdge > screenW - 20) this.freeSpinDigitsContainer.x -= (rightEdge - (screenW - 20));
        } else { // right aligned
            const rightEdge = this.freeSpinDigitsContainer.x + startX + totalW;
            if (rightEdge > screenW - 20) this.freeSpinDigitsContainer.x -= (rightEdge - (screenW - 20));
            const leftEdge = this.freeSpinDigitsContainer.x + startX;
            if (leftEdge < 20) this.freeSpinDigitsContainer.x += (20 - leftEdge);
        }

        // Keep on top
        try { this.controllerContainer?.bringToTop(this.freeSpinDigitsContainer); } catch {}
    }

    /** Configure digit display options (scale, offsets, spacing, alignment). */
    public setFreeSpinDigitOptions(options: { scale?: number; offsetX?: number; offsetY?: number; spacing?: number; align?: 'left' | 'center' | 'right'; }): void {
        if (options.scale !== undefined) this.freeSpinDigitsScale = Math.max(0.05, options.scale);
        if (options.offsetX !== undefined) this.freeSpinDigitsOffsetX = options.offsetX;
        if (options.offsetY !== undefined) this.freeSpinDigitsOffsetY = options.offsetY;
        if (options.spacing !== undefined) this.freeSpinDigitsSpacing = options.spacing;
        if (options.align !== undefined) this.freeSpinDigitsAlign = options.align;
    }

	/**
	 * Bounce the autoplay spins remaining text
	 */
	private bounceAutoplaySpinsRemainingText(): void {
		if (!this.autoplaySpinsRemainingText || !this.scene) {
			return;
		}

		try {
			// Create a bounce animation sequence
			this.scene.tweens.add({
				targets: this.autoplaySpinsRemainingText,
				scaleX: 1.45,
				scaleY: 1.45,
				duration: 100,
				ease: 'Power2',
				yoyo: true,
				onComplete: () => {
					// Reset to original scale
					this.autoplaySpinsRemainingText.setScale(1, 1);
					console.log('[SlotController] Autoplay spins remaining text bounce completed');
				}
			});
			
			console.log('[SlotController] Autoplay spins remaining text bounce started');
		} catch (error) {
			console.error('[SlotController] Error bouncing autoplay spins remaining text:', error);
		}
	}

	/**
	 * Play the autoplay button animation once per spin
	 */
	private playAutoplayAnimation(): void {
		// Ensure the animation exists
		this.ensureAutoplayAnimationExists();
		
		if (!this.autoplayButtonAnimation) {
			console.warn('[SlotController] Autoplay button animation not available');
			return;
		}

		try {
			// Show the animation
			this.autoplayButtonAnimation.setVisible(true);
			
			// Play animation once following the same pattern as spin button
			this.autoplayButtonAnimation.animationState.setAnimation(0, "animation", false);
			
			// Listen for animation completion to hide it
			this.autoplayButtonAnimation.animationState.addListener({
				complete: (entry: any) => {
					if (entry.animation.name === "animation") {
						this.autoplayButtonAnimation.setVisible(false);
					}
				}
			});
			
			console.log('[SlotController] Autoplay button spine animation played once');
		} catch (error) {
			console.error('[SlotController] Error playing autoplay button animation:', error);
			// Hide the animation if there's an error
			if (this.autoplayButtonAnimation) {
				this.autoplayButtonAnimation.setVisible(false);
			}
		}
	}

	/**
	 * Start the autoplay button animation (looping)
	 */
	private startAutoplayAnimation(): void {
		// Ensure the animation exists
		this.ensureAutoplayAnimationExists();
		
		if (!this.autoplayButtonAnimation) {
			console.warn('[SlotController] Autoplay button animation not available');
			return;
		}

		try {
			// Show the animation
			this.autoplayButtonAnimation.setVisible(true);
			
			// Start looping animation following the same pattern as kobi-ass
			// Use animationState.setAnimation with loop = true for continuous looping
			this.autoplayButtonAnimation.animationState.setAnimation(0, "animation", true);
			
			console.log('[SlotController] Autoplay button spine animation started (looping)');
		} catch (error) {
			console.error('[SlotController] Error starting autoplay button animation:', error);
		}
	}

	/**
	 * Stop the autoplay button animation
	 */
	private stopAutoplayAnimation(): void {
		if (!this.autoplayButtonAnimation) {
			console.warn('[SlotController] Autoplay button animation not available');
			return;
		}

		try {
			// Hide the animation
			this.autoplayButtonAnimation.setVisible(false);
			
			// Stop the animation
			this.autoplayButtonAnimation.animationState.clearTracks();
			
			console.log('[SlotController] Autoplay button spine animation stopped');
		} catch (error) {
			console.error('[SlotController] Error stopping autoplay button animation:', error);
		}
	}

	/**
	 * Ensure the autoplay animation exists and recreate if needed
	 */
	private ensureAutoplayAnimationExists(): void {
		if (!this.autoplayButtonAnimation && this.scene) {
			console.log('[SlotController] Autoplay animation not found, recreating...');
			const screenConfig = this.screenModeManager.getScreenConfig();
			const assetScale = this.networkManager.getAssetScale();
			this.createAutoplayButtonAnimation(this.scene, assetScale);
		}
	}

	/**
	 * Play the spin button spine animation
	 */
	private playSpinButtonAnimation(): void {
		if (!this.spinButtonAnimation) {
			console.warn('[SlotController] Spin button animation not available');
			return;
		}

		try {
			// Show the animation
			this.spinButtonAnimation.setVisible(true);
			
			// Play the animation following the same pattern as kobi-ass
			// Use animationState.setAnimation like in Header.ts
			this.spinButtonAnimation.animationState.setAnimation(0, "animation", false);
			
			// Listen for animation completion to hide it
			this.spinButtonAnimation.animationState.addListener({
				complete: (entry: any) => {
					if (entry.animation.name === "animation") {
						this.spinButtonAnimation.setVisible(false);
					}
				}
			});
			
			console.log('[SlotController] Spin button spine animation played');
		} catch (error) {
			console.error('[SlotController] Error playing Spine button animation:', error);
			// Hide the animation if there's an error
			if (this.spinButtonAnimation) {
				this.spinButtonAnimation.setVisible(false);
			}
		}
	}

	/**
	 * Rotate the spin button clockwise
	 */
	private rotateSpinButton(): void {
		const spinButton = this.buttons.get('spin');
		if (!spinButton) {
			console.warn('[SlotController] Spin button not found for rotation');
			return;
		}

		try {
			// Create a clockwise rotation tween
			// Rotate 360 degrees clockwise over 0.5 seconds
			this.scene?.tweens.add({
				targets: spinButton,
				angle: 360,
				duration: 500,
				ease: 'Power2',
				onComplete: () => {
					// Reset the angle to 0 after rotation completes
					spinButton.setAngle(0);
					console.log('[SlotController] Spin button rotation completed');
				}
			});
			
			console.log('[SlotController] Spin button rotation started');
		} catch (error) {
			console.error('[SlotController] Error rotating spin button:', error);
		}
	}

	private createPortraitController(scene: Scene, assetScale: number): void {
		console.log("[SlotController] Creating portrait controller layout");
		
		// Create primary controllers container
		this.primaryControllers = scene.add.container(0, 0);
		this.controllerContainer.add(this.primaryControllers);
		
		// Create vertical buttons on the right side
		const middleRef = scene.scale.height * 0.87;
		const buttonSpacing = 80;
		
		// Spin button (main action)
		const spinButton = scene.add.image(
			scene.scale.width * 0.5,
			middleRef,
			'spin'
		).setOrigin(0.5, 0.5).setScale(assetScale * 1.2).setDepth(10);
		// Position relative to container; container-level offset is applied to controllerContainer


		// Spin icon overlay in front of and aligned with the spin button
		this.spinIcon = scene.add.image(
			spinButton.x,
			spinButton.y,
			'spin_icon'
		).setOrigin(0.5, 0.5).setScale(assetScale * 1.2).setDepth(11);
		this.primaryControllers.add(this.spinIcon);

		// Gentle rotation animation for the icon
		this.spinIconTween = scene.tweens.add({
			targets: this.spinIcon,
			angle: 360,
			duration: 4000,
			repeat: -1,
			ease: 'Linear'
		});

		// Autoplay stop icon overlay (hidden by default), same position as spin
		this.autoplayStopIcon = scene.add.image(
			spinButton.x,
			spinButton.y,
			'autoplay_stop_icon'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.45).setDepth(12).setVisible(false);
		this.primaryControllers.add(this.autoplayStopIcon);

		spinButton.setInteractive();
		// Press animation
		this.attachPushEffect(spinButton);
		spinButton.on('pointerdown', async () => {
			if (this.isSpinLocked) {
				console.log('[SlotController] Spin click ignored - spin is locked');
				return;
			}
			console.log('[SlotController] Spin button clicked');
			// Ensure symbols container is restored for the new spin
			try { this.symbols?.restoreSymbolsAboveReelBg?.(); } catch {}
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			// Block spin during scatter anticipation/transition to overlay
			if (gameStateManager.isScatter) {
				console.log('[SlotController] Spin blocked - scatter transition/animation in progress');
				this.disableSpinButton();
				return;
			}
			// If autoplay is active, clicking spin will stop autoplay instead
			if (gameStateManager.isAutoPlaying) {
				console.log('[SlotController] Stopping autoplay via spin button click');
				this.stopAutoplay();
				return;
			}
			if (gameStateManager.isReelSpinning) {
				console.log('[SlotController] Spin blocked - already spinning');
				return;
			}
			
			this.isSpinLocked = true;
			try {
				// Disable spin button, bet buttons, feature button and play animations
				this.disableSpinButton();
				this.disableBetButtons();
				this.disableFeatureButton();
				this.playSpinButtonAnimation();
				this.rotateSpinButton();
				
				// Use the centralized spin handler
				await this.handleSpin();
			} finally {
				this.isSpinLocked = false;
			}
		});
		this.buttons.set('spin', spinButton);
		this.primaryControllers.add(spinButton);

		// Ensure icon is positioned exactly and rendered above the spin button
		if (this.spinIcon) {
			this.spinIcon.setPosition(spinButton.x, spinButton.y);
			this.primaryControllers.bringToTop(this.spinIcon);
		}

		// Ensure icon is positioned exactly and rendered above the spin button
		if (this.spinIcon) {
			this.spinIcon.setPosition(spinButton.x, spinButton.y);
			this.primaryControllers.bringToTop(this.spinIcon);
		}

		// Turbo button
		const turboButton = scene.add.image(
			scene.scale.width * 0.9,
			middleRef + 5,
			'turbo_off'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		turboButton.setPosition(
			turboButton.x + TURBO_OFFSET_X,
			turboButton.y + TURBO_OFFSET_Y
		);
		turboButton.setInteractive();
		// Press animation
		this.attachPushEffect(turboButton);
		turboButton.on('pointerdown', () => {
			console.log('[SlotController] Turbo button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.handleTurboButtonClick();
		});
		this.buttons.set('turbo', turboButton);
		this.primaryControllers.add(turboButton);

		// Turbo text label
		const turboText = scene.add.text(
			turboButton.x,
			middleRef - 50,
			'Turbo',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		turboText.setPosition(
			turboText.x + TURBO_LABEL_OFFSET_X,
			turboText.y + TURBO_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(turboText);
		this.controllerTexts.push(turboText);

		// Amplify button
		const amplifyButton = scene.add.image(
			scene.scale.width * 0.73,
			middleRef,
			'amplify'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		amplifyButton.setPosition(
			amplifyButton.x + AMPLIFY_OFFSET_X,
			amplifyButton.y + AMPLIFY_OFFSET_Y
		);
		amplifyButton.setInteractive();
		// Press animation
		this.attachPushEffect(amplifyButton);
		amplifyButton.on('pointerdown', () => {
			console.log('[SlotController] Amplify button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.handleAmplifyButtonClick();
		});
		this.buttons.set('amplify', amplifyButton);
		this.primaryControllers.add(amplifyButton);

		// Amplify text label
		const amplifyText = scene.add.text(
			amplifyButton.x,
			amplifyButton.y - 50,
			'Amplify Bet',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		amplifyText.setPosition(
			amplifyText.x + AMPLIFY_LABEL_OFFSET_X,
			amplifyText.y + AMPLIFY_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(amplifyText);
		this.controllerTexts.push(amplifyText);

		// Amplify description container
		this.createAmplifyDescription(scene, assetScale);

		// Autoplay button
		const autoplayButton = scene.add.image(
			scene.scale.width * 0.27,
			middleRef,
			'autoplay_off'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		autoplayButton.setPosition(
			autoplayButton.x + AUTOPLAY_OFFSET_X,
			autoplayButton.y + AUTOPLAY_OFFSET_Y
		);
		autoplayButton.setInteractive();
		// Press animation
		this.attachPushEffect(autoplayButton);
		autoplayButton.on('pointerdown', () => {
			console.log('[SlotController] Autoplay button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.handleAutoplayButtonClick();
		});
		this.buttons.set('autoplay', autoplayButton);
		this.primaryControllers.add(autoplayButton);

		// Autoplay text label
		const autoplayText = scene.add.text(
			autoplayButton.x,
			autoplayButton.y - 50,
			'Autoplay',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		autoplayText.setPosition(
			autoplayText.x + AUTOPLAY_LABEL_OFFSET_X,
			autoplayText.y + AUTOPLAY_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(autoplayText);
		this.controllerTexts.push(autoplayText);

		// Menu button
		const menuButton = scene.add.image(
			scene.scale.width * 0.1,
			middleRef + 5,
			'menu'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		// Position relative to container; container-level offset moves everything
		menuButton.setInteractive();
		// Press animation
		this.attachPushEffect(menuButton);
		menuButton.on('pointerdown', () => {
			console.log('[SlotController] Menu button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			EventBus.emit('menu');
		});
		this.buttons.set('menu', menuButton);
		this.primaryControllers.add(menuButton);

		// Menu text label
		const menuText = scene.add.text(
			menuButton.x,
			menuButton.y - 50,
			'Menu',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		menuText.setPosition(
			menuText.x + MENU_LABEL_OFFSET_X,
			menuText.y + MENU_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(menuText);
		this.controllerTexts.push(menuText);

		// Balance display container
		this.createBalanceDisplay(scene, assetScale);

		// Bet display container
		this.createBetDisplay(scene, assetScale);
		
		// Feature button container
		this.createFeatureButton(scene, assetScale);
		
		// Free spin display container
		this.createFreeSpinDisplay(scene, assetScale);
		
		// Create the spin button animation
		this.createSpinButtonAnimation(scene, assetScale);
		
		// Create the autoplay button animation
		this.createAutoplayButtonAnimation(scene, assetScale);
		
		// Create the turbo button animation
		this.createTurboButtonAnimation(scene, assetScale);
		
		// Create the autoplay spins remaining text
		this.createAutoplaySpinsRemainingText(scene, assetScale);
		// Initialize amplify button state
		this.initializeAmplifyButtonState();
	}

	private createAmplifyDescription(scene: Scene, assetScale: number): void {
		// Position for amplify description (above amplify button)
		const amplifyX = scene.scale.width * 0.73;
		const amplifyY = scene.scale.height * 0.875;
		const descriptionX = amplifyX + AMPLIFY_DESCRIPTION_OFFSET_X;
		const descriptionY = (amplifyY - 50) + AMPLIFY_DESCRIPTION_OFFSET_Y; // Higher than amplify button
		const containerWidth = 90;
		const containerHeight = 30;
		const cornerRadius = 8;

		// Create container for amplify description elements
		this.amplifyDescriptionContainer = scene.add.container(0, 0);

		// Create rounded rectangle background with green outline
		const descriptionBg = scene.add.graphics();
		descriptionBg.fillStyle(0x000000, 0.65); // Dark background
		descriptionBg.fillRoundedRect(
			descriptionX - containerWidth / 2,
			descriptionY - containerHeight / 2,
			containerWidth,
			containerHeight,
			cornerRadius
		);
		descriptionBg.lineStyle(1, 0x00ff00, 1); // Green outline
		descriptionBg.strokeRoundedRect(
			descriptionX - containerWidth / 2,
			descriptionY - containerHeight / 2,
			containerWidth,
			containerHeight,
			cornerRadius
		);
		descriptionBg.setDepth(8);
		this.amplifyDescriptionContainer.add(descriptionBg);

		// "Double Chance" label (1st line)
		const descriptionLabel1 = scene.add.text(
			descriptionX,
			descriptionY - 5,
			'Double Chance',
			{
				fontSize: '9px',
				color: '#ffffff', // Green color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.amplifyDescriptionContainer.add(descriptionLabel1);

		// "For Feature" label (2nd line)
		const descriptionLabel2 = scene.add.text(
			descriptionX,
			descriptionY + 6,
			'For Feature',
			{
				fontSize: '9px',
				color: '#ffffff', // White color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.amplifyDescriptionContainer.add(descriptionLabel2);

		// Add the container to the main controller container
		this.controllerContainer.add(this.amplifyDescriptionContainer);
	}

	private createBalanceDisplay(scene: Scene, assetScale: number): void {
		// Position for balance display (top center)
		const balanceX = scene.scale.width * 0.19;
		const balanceY = scene.scale.height * 0.77;
		const containerWidth = 125;
		const containerHeight = 55;
		const cornerRadius = 10;
		const balanceValueOffset = 5;

		// Create rounded rectangle background
		const balanceBg = scene.add.graphics();
		balanceBg.fillStyle(0x000000, 0.65); // Dark gray with 80% alpha
		balanceBg.fillRoundedRect(
			balanceX - containerWidth / 2,
			balanceY - containerHeight / 2,
			containerWidth,
			containerHeight,
			cornerRadius
		);
		balanceBg.setDepth(8);
		this.controllerContainer.add(balanceBg);

		// "BALANCE" label (1st line)
		const balanceLabel = scene.add.text(
			balanceX,
			balanceY - 8,
			'BALANCE',
			{
				fontSize: '12px',
				color: '#00ff00', // Green color
				fontFamily: 'Poppins-Bold',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(balanceLabel);

		// "200,000.00" amount (2nd line, right part)
		this.balanceAmountText = scene.add.text(
			balanceX + balanceValueOffset,
			balanceY + 8,
			'200,000.00',
			{
				fontSize: '14px',
				color: '#ffffff', // White color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.balanceAmountText);

		// "$" symbol (2nd line, left part) - positioned dynamically
		this.balanceDollarText = scene.add.text(
			balanceX - (this.balanceAmountText.width / 2) - 3.5,
			balanceY + 8,
			'$',
			{
				fontSize: '14px',
				color: '#ffffff', // White color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.balanceDollarText);
	}

	private createBetDisplay(scene: Scene, assetScale: number): void {
		// Position for bet display (proportionate opposite side of balance display)
		const betX = scene.scale.width * 0.81;
		const betY = scene.scale.height * 0.77;
		const containerWidth = 125;
		const containerHeight = 55;
		const cornerRadius = 10;
		const  betValueOffset = 3;


		// Create amplify bet spine animation (behind bet background)
		this.createAmplifyBetAnimation(scene, betX, betY, containerWidth, containerHeight);
		// Create enhance-bet idle spine animation (behind bet background)
		this.createEnhanceBetIdleAnimation(scene, betX, betY, containerWidth, containerHeight);
		
		// Create rounded rectangle background
		const betBg = scene.add.graphics();
		betBg.fillStyle(0x000000, 0.65); // Dark gray with 65% alpha
		betBg.fillRoundedRect(
			betX - containerWidth / 2,
			betY - containerHeight / 2,
			containerWidth,
			containerHeight,
			cornerRadius
		);
		betBg.setDepth(8);
		this.controllerContainer.add(betBg);
		

		// "BET" label (1st line)
		const betLabel = scene.add.text(
			betX,
			betY - 8,
			'BET',
			{
				fontSize: '12px',
				color: '#00ff00', // Green color
				fontFamily: 'Poppins-Bold',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(betLabel);
		this.betLabelRef = betLabel;

		// Make BET label clickable to open bet selection UI
		betLabel.setInteractive();
		// Press animation
		this.attachPushEffect(betLabel, { downScale: 0.97 });
		betLabel.on('pointerdown', () => {
			console.log('[SlotController] BET label clicked - showing bet options');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			EventBus.emit('show-bet-options');
		});

		// "0.60" amount (2nd line, right part)
		this.betAmountText = scene.add.text(
			betX + betValueOffset,
			betY + 8,
			'0.20',
			{
				fontSize: '14px',
				color: '#ffffff', // White color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.betAmountText);

		// Initialize base bet amount
		this.baseBetAmount = 0.20;

		// "$" symbol (2nd line, left part) - positioned dynamically
		this.betDollarText = scene.add.text(
			betX - (this.betAmountText.width / 2) - 3.5,
			betY + 8,
			'$',
			{
				fontSize: '14px',
				color: '#ffffff', // White color
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.betDollarText);

		// Decrease bet button (left side within container)
		const decreaseBetButton = scene.add.image(
			betX - 42, // Left side within container
			betY + 8,
			'decrease_bet'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.55).setDepth(10);
		decreaseBetButton.setPosition(
			decreaseBetButton.x + BET_MINUS_OFFSET_X,
			decreaseBetButton.y + BET_MINUS_OFFSET_Y
		);
		decreaseBetButton.setInteractive();
		// Press animation
		this.attachPushEffect(decreaseBetButton);
		decreaseBetButton.on('pointerdown', () => {
			console.log('[SlotController] Decrease bet button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.changeBetBy(-1);
		});
		this.buttons.set('decrease_bet', decreaseBetButton);
		this.controllerContainer.add(decreaseBetButton);

		// Increase bet button (right side within container)
		const increaseBetButton = scene.add.image(
			betX + 42, // Right side within container
			betY + 8,
			'increase_bet'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.55).setDepth(10);
		increaseBetButton.setPosition(
			increaseBetButton.x + BET_PLUS_OFFSET_X,
			increaseBetButton.y + BET_PLUS_OFFSET_Y
		);
		increaseBetButton.setInteractive();
		// Press animation
		this.attachPushEffect(increaseBetButton);
		increaseBetButton.on('pointerdown', () => {
			console.log('[SlotController] Increase bet button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.changeBetBy(1);
		});
		this.buttons.set('increase_bet', increaseBetButton);
		this.controllerContainer.add(increaseBetButton);

		// Make bet value clickable to open bet selection UI
		this.betAmountText.setInteractive();
		// Press animation
		this.attachPushEffect(this.betAmountText, { downScale: 0.97 });
		this.betAmountText.on('pointerdown', () => {
			console.log('[SlotController] Bet value clicked - showing bet options');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			EventBus.emit('show-bet-options');
		});

		// Add a central clickable zone (excluding +/- buttons) to open bet options
		const centralZoneWidth = containerWidth - 50; // leave space for +/- buttons at ~±42
		const centralZone = scene.add.zone(
			betX,
			betY,
			centralZoneWidth,
			containerHeight
		).setOrigin(0.5, 0.5).setDepth(12);
        // Limit bet central zone to strictly inside container to prevent overlap
        try {
            centralZone.setInteractive(
                new Geom.Rectangle(-centralZoneWidth * 0.5, -containerHeight * 0.5, centralZoneWidth, containerHeight),
                Geom.Rectangle.Contains
            );
        } catch {
            centralZone.setInteractive();
        }
		centralZone.on('pointerdown', () => {
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			console.log('[SlotController] Bet central area clicked - showing bet options');
			EventBus.emit('show-bet-options');
		});
		this.controllerContainer.add(centralZone);
		this.betCentralZone = centralZone;

		// Initialize min/max button visual state
		this.updateBetButtonStates();
	}

	/**
	 * Create amplify bet spine animation behind the bet background
	 */
	private createAmplifyBetAnimation(scene: Scene, betX: number, betY: number, containerWidth: number, containerHeight: number): void {
		try {
			// Ensure Spine factory is available before creating
			if (!ensureSpineFactory(scene, '[SlotController] createAmplifyBetAnimation')) {
				console.warn('[SlotController] Spine factory unavailable, retrying amplify bet animation shortly');
				scene.time.delayedCall(300, () => this.createAmplifyBetAnimation(scene, betX, betY, containerWidth, containerHeight));
				return;
			}
			// Check if the spine assets are loaded
			if (!scene.cache.json.has('amplify_bet')) {
				console.warn('[SlotController] Amplify bet spine assets not loaded, skipping animation creation');
				return;
			}

			// Create the spine animation
			const amplifyOffsetX = -4; // slight left
			const amplifyOffsetY =  0; // slight up
			this.amplifyBetAnimation = scene.add.spine(
				betX + amplifyOffsetX, 
				betY + amplifyOffsetY, 
				'amplify_bet', 
				'amplify_bet-atlas'
			);
			
			// Scale the animation to fit within the bet background area
			const scale = Math.min(containerWidth / 200, containerHeight / 100); // Adjust scale based on container size
			this.amplifyBetAnimation.setScale(1);
			
			// Position it behind the bet background
			this.amplifyBetAnimation.setDepth(7); // Lower depth than bet background (8)
			
			// Initially hidden - will be shown when amplify bet is active and spin is triggered
			this.amplifyBetAnimation.setVisible(false);
			
			// Add to controller container
			this.controllerContainer.add(this.amplifyBetAnimation);
			
			console.log('[SlotController] Amplify bet spine animation created and positioned behind bet background');
			
		} catch (error) {
			console.error('[SlotController] Failed to create amplify bet spine animation:', error);
		}
	}

	/**
	 * Create the Enhance Bet idle loop spine animation near the Amplify button
	 */
	private createEnhanceBetIdleAnimation(scene: Scene, betX: number, betY: number, containerWidth: number, containerHeight: number): void {
		try {
			// Ensure Spine factory is available before creating
			if (!ensureSpineFactory(scene, '[SlotController] createEnhanceBetIdleAnimation')) {
				console.warn('[SlotController] Spine factory unavailable, retrying enhance bet idle animation shortly');
				scene.time.delayedCall(300, () => this.createEnhanceBetIdleAnimation(scene, betX, betY, containerWidth, containerHeight));
				return;
			}
			if (!scene.cache.json.has('enhance_bet_idle_on')) {
				console.warn('[SlotController] enhance_bet_idle_on spine assets not loaded, skipping idle animation creation');
				return;
			}

			// Position to exactly match amplify bet animation if available, including offsets
			const targetX = this.amplifyBetAnimation ? this.amplifyBetAnimation.x : (betX - 4);
			const targetY = this.amplifyBetAnimation ? this.amplifyBetAnimation.y : (betY);
			this.enhanceBetIdleAnimation = scene.add.spine(targetX, targetY, 'enhance_bet_idle_on', 'enhance_bet_idle_on-atlas');
			this.enhanceBetIdleAnimation.setOrigin(0.5, 0.5);
			// Match scale and depth to amplify bet animation if present
			if (this.amplifyBetAnimation) {
				this.enhanceBetIdleAnimation.setScale(this.amplifyBetAnimation.scaleX, this.amplifyBetAnimation.scaleY);
				this.enhanceBetIdleAnimation.setDepth(this.amplifyBetAnimation.depth);
			} else {
				this.enhanceBetIdleAnimation.setScale(1);
				this.enhanceBetIdleAnimation.setDepth(7);
			}
			this.enhanceBetIdleAnimation.setVisible(false);

			// Add to controller container so it renders with HUD
			this.controllerContainer.add(this.enhanceBetIdleAnimation);

			console.log('[SlotController] Enhance Bet idle spine created');
		} catch (error) {
			console.error('[SlotController] Failed to create enhance bet idle animation:', error);
		}
	}

	/** Start the enhance bet idle loop (loop=true) */
	private showEnhanceBetIdleLoop(): void {
		if (!this.enhanceBetIdleAnimation) {
			return;
		}
		this.enhanceBetIdleAnimation.setVisible(true);
		const idleName = 'animation'; // single animation in JSON is named 'animation'
		if (this.enhanceBetIdleAnimation.skeleton?.data.findAnimation(idleName)) {
			this.enhanceBetIdleAnimation.animationState.setAnimation(0, idleName, true);
		} else {
			const animations = this.enhanceBetIdleAnimation.skeleton?.data.animations || [];
			if (animations.length > 0) {
				this.enhanceBetIdleAnimation.animationState.setAnimation(0, animations[0].name, true);
			}
		}
	}

	/** Stop and hide the enhance bet idle loop */
	private hideEnhanceBetIdleLoop(): void {
		if (!this.enhanceBetIdleAnimation) {
			return;
		}
		this.enhanceBetIdleAnimation.animationState.clearTracks();
		this.enhanceBetIdleAnimation.setVisible(false);
	}

	private createFeatureButton(scene: Scene, assetScale: number): void {
		// Position for feature button (between balance and bet containers)
		const featureX = scene.scale.width * 0.5; // Center between balance and bet
		const featureY = scene.scale.height * 0.77; // Same Y as balance and bet containers

		// Feature button image (serves as background)
		const featureButton = scene.add.image(
			featureX,
			featureY,
			'feature'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		featureButton.setPosition(featureButton.x + FEATURE_OFFSET_X, featureButton.y + FEATURE_OFFSET_Y);
        // Tighten interactive hit area to avoid overlaps with neighboring zones
        try { featureButton.setInteractive({ useHandCursor: true }); } catch { featureButton.setInteractive(); }
		featureButton.on('pointerdown', () => {
			if (this.isBuyFeatureLocked) {
				console.log('[SlotController] Feature button click ignored - buy feature is locked');
				return;
			}
			console.log('[SlotController] Feature button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.showBuyFeatureDrawer();
		});
		this.buttons.set('feature', featureButton);
		this.controllerContainer.add(featureButton);

		// Apply any configured feature button hitbox trims
		this.applyFeatureButtonHitbox(featureButton);

		// Press animation
		this.attachPushEffect(featureButton);

        // Ensure bet clickable zone doesn't overlap the feature button horizontally
        this.adjustBetZoneToAvoidFeatureOverlap(featureButton);

		// "BUY FEATURE" label (1st line)
		const featureLabel1 = scene.add.text(
			featureX,
			featureY - 8,
			'BUY FEATURE',
			{
				fontSize: '12px',
				color: '#ffffff',
				fontFamily: 'Poppins-Bold',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(featureLabel1);

		// Amount (2nd line, right part) - bound to current bet x100
		this.featureAmountText = scene.add.text(
			featureX + 5,
			featureY + 8,
			'0',
			{
				fontSize: '14px',
				color: '#ffffff',
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.featureAmountText);

		// "$" symbol (2nd line, left part) - positioned dynamically
		this.featureDollarText = scene.add.text(
			featureX - (this.featureAmountText.width / 2) - 3,
			featureY + 8,
			'$',
			{
				fontSize: '14px',
				color: '#ffffff',
				fontFamily: 'Poppins-Regular',
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.featureDollarText);

		// Initialize amount from current bet
		this.updateFeatureAmountFromCurrentBet();
	}

	/**
	 * Reduce BET central zone width if it would overlap the Buy Feature button horizontally
	 */
	private adjustBetZoneToAvoidFeatureOverlap(featureButton: Phaser.GameObjects.Image): void {
		try {
			if (!this.betCentralZone || !featureButton) return;
			// Current zone hit area
			const zone = this.betCentralZone;
			const hit: any = (zone.input && (zone.input as any).hitArea) || null;
			const currentWidth: number = hit?.width || zone.width || 0;
			const currentHeight: number = hit?.height || zone.height || 55;
			if (!currentWidth || currentWidth <= 0) return;

			// Compute right edge of feature and left edge of zone
			const fb = featureButton.getBounds();
			const featureRight = fb.right;
			const margin = this.uiHitboxModifiers.marginPx ?? 8;
			// Desired left edge of zone must be to the right of featureRight + margin
			const zoneCenterX = zone.x;
			const maxHalfWidth = Math.max(10, zoneCenterX - (featureRight + margin));
			let desiredWidth = Math.min(currentWidth, Math.max(20, maxHalfWidth * 2));
			// Apply optional hard cap for bet zone width
			if (this.uiHitboxModifiers.betCenterWidthPx && this.uiHitboxModifiers.betCenterWidthPx > 0) {
				desiredWidth = Math.min(desiredWidth, this.uiHitboxModifiers.betCenterWidthPx);
			}
			// Apply extra trims to left/right if provided
			const trimLeft = this.uiHitboxModifiers.betCenterTrimLeftPx ?? 0;
			const trimRight = this.uiHitboxModifiers.betCenterTrimRightPx ?? 0;
			const finalWidth = Math.max(10, desiredWidth - (trimLeft + trimRight));
			const offsetX = (trimRight - trimLeft) * 0.5;
			if (finalWidth < currentWidth) {
				zone.setInteractive(
					new Geom.Rectangle(-finalWidth * 0.5 + offsetX, -currentHeight * 0.5, finalWidth, currentHeight),
					Geom.Rectangle.Contains
				);
			}
		} catch {}
	}

	// Apply optional trims to the feature button hitbox (no-op when trims are zero)
	private applyFeatureButtonHitbox(featureButton: Phaser.GameObjects.Image): void {
		try {
			const trimLeft = this.uiHitboxModifiers.featureTrimLeftPx ?? 0;
			const trimRight = this.uiHitboxModifiers.featureTrimRightPx ?? 0;
			if (!trimLeft && !trimRight) return; // nothing to change
			const fullW = featureButton.displayWidth;
			const fullH = featureButton.displayHeight || 55;
			const w = Math.max(10, fullW - (trimLeft + trimRight));
			const offsetX = (trimRight - trimLeft) * 0.5;
			featureButton.setInteractive(
				new Geom.Rectangle(-w * 0.5 + offsetX, -fullH * 0.5, w, fullH),
				Geom.Rectangle.Contains
			);
		} catch {}
	}

	// Public API to change UI hitbox behavior at runtime
	public setUiHitboxModifiers(mods: Partial<typeof this.uiHitboxModifiers>): void {
		this.uiHitboxModifiers = { ...this.uiHitboxModifiers, ...mods };
		const featureButton = this.buttons.get('feature');
		if (featureButton) {
			this.applyFeatureButtonHitbox(featureButton);
			this.adjustBetZoneToAvoidFeatureOverlap(featureButton);
		}
	}

	// Small press/release scale animation for clickable UI
	private attachPushEffect(go: any, options?: { downScale?: number; downMs?: number; upMs?: number }): void {
		try {
			if (!go || !go.scene || typeof go.setScale !== 'function') return;
			const scene: Scene = go.scene;
			const originalScaleX: number = typeof go.scaleX === 'number' ? go.scaleX : 1;
			const originalScaleY: number = typeof go.scaleY === 'number' ? go.scaleY : 1;
			const downScale = options?.downScale ?? 0.94;
			const downMs = options?.downMs ?? 60;
			const upMs = options?.upMs ?? 80;

			const press = () => {
				try { scene.tweens.killTweensOf(go); } catch {}
				scene.tweens.add({
					targets: go,
					scaleX: originalScaleX * downScale,
					scaleY: originalScaleY * downScale,
					duration: downMs,
					ease: 'Quad.easeOut'
				});
			};

			const release = () => {
				try { scene.tweens.killTweensOf(go); } catch {}
				scene.tweens.add({
					targets: go,
					scaleX: originalScaleX,
					scaleY: originalScaleY,
					duration: upMs,
					ease: 'Quad.easeOut'
				});
			};

			go.on('pointerdown', press);
			go.on('pointerup', release);
			go.on('pointerout', release);
		} catch {}
	}

	private createLandscapeController(scene: Scene, assetScale: number): void {
		console.log("[SlotController] Creating landscape controller layout");
		
		// Create primary controllers container
		this.primaryControllers = scene.add.container(0, 0);
		this.controllerContainer.add(this.primaryControllers);
		
		// Create buttons for landscape layout
		const middleRef = scene.scale.height * 0.9;
		const buttonSpacing = 100;
		
		// Spin button (main action)
		const spinButton = scene.add.image(
			scene.scale.width * 0.5,
			middleRef,
			'spin'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		// Position relative to container; container-level offset is applied to controllerContainer

		// Spin icon overlay in front of and aligned with the spin button (landscape)
		if (!this.spinIcon) {
			this.spinIcon = scene.add.image(
				spinButton.x,
				spinButton.y,
				'spin_icon'
			).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(11);
			this.primaryControllers.add(this.spinIcon);
			this.spinIconTween = scene.tweens.add({
				targets: this.spinIcon,
				angle: 360,
				duration: 4000,
				repeat: -1,
				ease: 'Linear'
			});
		}

		// Autoplay stop icon overlay (hidden by default), same position as spin (landscape)
		if (!this.autoplayStopIcon) {
			this.autoplayStopIcon = scene.add.image(
				spinButton.x,
				spinButton.y,
				'autoplay_stop_icon'
			).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(12).setVisible(false);
			this.primaryControllers.add(this.autoplayStopIcon);
		}

		spinButton.setInteractive();
		// Press animation
		this.attachPushEffect(spinButton);
		spinButton.on('pointerdown', async () => {
			console.log('[SlotController] Spin button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			// Block spin during scatter anticipation/transition to overlay
			if (gameStateManager.isScatter) {
				console.log('[SlotController] Spin blocked - scatter transition/animation in progress');
				this.disableSpinButton();
				return;
			}
			// If autoplay is active, clicking spin will stop autoplay instead
			if (gameStateManager.isAutoPlaying) {
				console.log('[SlotController] Stopping autoplay via spin button click');
				this.stopAutoplay();
				return;
			}
			if (gameStateManager.isReelSpinning) {
				console.log('[SlotController] Spin blocked - already spinning');
				return;
			}
			
			// Disable spin button, bet buttons, feature button and play animations
			this.disableSpinButton();
			this.disableBetButtons();
			this.disableFeatureButton();
			this.playSpinButtonAnimation();
			this.rotateSpinButton();
			
			// Use the centralized spin handler
			await this.handleSpin();
		});
		this.buttons.set('spin', spinButton);
		this.primaryControllers.add(spinButton);

		// Turbo button
		const turboButton = scene.add.image(
			scene.scale.width * 0.5 - buttonSpacing,
			middleRef,
			'turbo_off'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		// Apply per-button offsets only; container handles global offset
		turboButton.setPosition(
			turboButton.x + TURBO_OFFSET_X,
			turboButton.y + TURBO_OFFSET_Y
		);
		turboButton.setInteractive();
		// Press animation
		this.attachPushEffect(turboButton);
		turboButton.on('pointerdown', () => {
			console.log('[SlotController] Turbo button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.handleTurboButtonClick();
		});
		this.buttons.set('turbo', turboButton);
		this.primaryControllers.add(turboButton);

		// Turbo text label
		const turboText = scene.add.text(
			scene.scale.width * 0.5 - buttonSpacing,
			middleRef + (turboButton.displayHeight * 0.5) + 15,
			'Turbo',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		// Apply per-label offsets only; container handles global offset
		turboText.setPosition(
			turboText.x + TURBO_LABEL_OFFSET_X,
			turboText.y + TURBO_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(turboText);
		this.controllerTexts.push(turboText);

		// Autoplay button
		const autoplayButton = scene.add.image(
			scene.scale.width * 0.5 + buttonSpacing,
			middleRef,
			'autoplay_off'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		// Apply per-button offsets only; container handles global offset
		autoplayButton.setPosition(
			autoplayButton.x + AUTOPLAY_OFFSET_X,
			autoplayButton.y + AUTOPLAY_OFFSET_Y
		);
		autoplayButton.setInteractive();
		// Press animation
		this.attachPushEffect(autoplayButton);
		autoplayButton.on('pointerdown', () => {
			console.log('[SlotController] Autoplay button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.handleAutoplayButtonClick();
		});
		this.buttons.set('autoplay', autoplayButton);
		this.primaryControllers.add(autoplayButton);

		// Autoplay text label
		const autoplayText = scene.add.text(
			scene.scale.width * 0.5 + buttonSpacing,
			middleRef + (autoplayButton.displayHeight * 0.5) + 15,
			'Autoplay',
			this.getTextStyle(),
		).setOrigin(0.5, 0.5).setDepth(10);
		// Apply per-label offsets only; container handles global offset
		autoplayText.setPosition(
			autoplayText.x + AUTOPLAY_LABEL_OFFSET_X,
			autoplayText.y + AUTOPLAY_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(autoplayText);
		this.controllerTexts.push(autoplayText);

		// Menu button
		const menuButton = scene.add.image(
			scene.scale.width * 0.5 + buttonSpacing * 2,
			middleRef,
			'menu'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		// Position relative to container; container-level offset moves everything
		menuButton.setInteractive();
		// Press animation
		this.attachPushEffect(menuButton);
		menuButton.on('pointerdown', () => {
			console.log('[SlotController] Menu button clicked');
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			EventBus.emit('menu');
		});
		this.buttons.set('menu', menuButton);
		this.primaryControllers.add(menuButton);

		// Menu text label
		const menuText = scene.add.text(
			scene.scale.width * 0.5 + buttonSpacing * 2,
			middleRef + (menuButton.displayHeight * 0.5) + 15,
			'Menu',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		// Apply per-label offsets only; container handles global offset
		menuText.setPosition(
			menuText.x + MENU_LABEL_OFFSET_X,
			menuText.y + MENU_LABEL_OFFSET_Y
		);
		this.controllerContainer.add(menuText);
		this.controllerTexts.push(menuText);

		// Amplify description container
		this.createAmplifyDescription(scene, assetScale);

		// Balance display container
		this.createBalanceDisplay(scene, assetScale);

		// Bet display container
		this.createBetDisplay(scene, assetScale);
		
		// Feature button container
		this.createFeatureButton(scene, assetScale);
		
		// Free spin display container
		this.createFreeSpinDisplay(scene, assetScale);
		
		// Create the spin button animation
		this.createSpinButtonAnimation(scene, assetScale);
		
		// Create the autoplay button animation
		this.createAutoplayButtonAnimation(scene, assetScale);
		
		// Create the turbo button animation
		this.createTurboButtonAnimation(scene, assetScale);
		
		// Create the autoplay spins remaining text
		this.createAutoplaySpinsRemainingText(scene, assetScale);
	}

	updateButtonState(buttonName: string, isActive: boolean): void {
		const button = this.buttons.get(buttonName);
		if (button) {
			const newTexture = isActive ? `${buttonName}_on` : `${buttonName}_off`;
			button.setTexture(newTexture);
		}
	}

	resize(scene: Scene): void {
		if (this.controllerContainer) {
			this.controllerContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.controllerContainer;
	}

	getButton(buttonName: string): Phaser.GameObjects.Image | undefined {
		return this.buttons.get(buttonName);
	}

	updateBetAmount(betAmount: number): void {
		if (this.betAmountText) {
			this.betAmountText.setText(betAmount.toFixed(2));
			
			// Update dollar sign position based on new bet amount width
			if (this.betDollarText) {
				const betX = this.betAmountText.x;
				const betY = this.betAmountText.y;
				this.betDollarText.setPosition(betX - (this.betAmountText.width / 2) - 5, betY);
			}
		}

		// Update plus/minus visual/interactivity based on boundaries
		this.updateBetButtonStates();
		
		// Keep the Buy Feature amount synced with current base bet
		this.setBuyFeatureBetAmount(betAmount);
		
		// Always update base bet amount to keep stepping consistent
		this.baseBetAmount = betAmount;
		// Reset amplify bet state only when bet amount is changed externally
		if (!this.isInternalBetChange) {
			this.resetAmplifyBetOnBetChange();
		}
	}

	/**
	 * Enable/disable and grey out bet +/- buttons at min/max values
	 */
	private updateBetButtonStates(): void {
		try {
			const minusBtn = this.buttons.get('decrease_bet');
			const plusBtn = this.buttons.get('increase_bet');
			if (!minusBtn || !plusBtn) return;

			// Determine current bet and nearest index
			let currentBet = this.baseBetAmount || 0.2;
			if (this.betAmountText) {
				const parsed = parseFloat(this.betAmountText.text);
				if (!isNaN(parsed)) currentBet = parsed;
			}
			const idx = this.findClosestBetIndex(currentBet);
			const minIdx = 0;
			const maxIdx = Math.max(0, this.betOptions.length - 1);
			const atMin = idx <= minIdx || Math.abs(currentBet - this.betOptions[minIdx]) < 0.0001;
			const atMax = idx >= maxIdx || Math.abs(currentBet - this.betOptions[maxIdx]) < 0.0001;

			this.applyButtonEnabled(minusBtn, !atMin);
			this.applyButtonEnabled(plusBtn, !atMax);
		} catch {}
	}

	private applyButtonEnabled(btn: Phaser.GameObjects.Image, enabled: boolean): void {
		try {
			if (enabled) {
				btn.clearTint();
				btn.setAlpha(1);
				// Only re-enable if not already interactive and the controller is visible
				if (!btn.input?.enabled) {
					btn.setInteractive();
				}
			} else {
				btn.setTint(0x777777);
				btn.setAlpha(0.6);
				btn.disableInteractive();
			}
		} catch {}
	}

	/**
	 * Change bet by a step in the predefined bet options
	 * Negative step decreases, positive increases
	 */
	private changeBetBy(stepDelta: number): void {
		try {
			// Set flag to indicate this is an internal bet change
			this.isInternalBetChange = true;
			
			// Step relative to base bet (not the amplified display)
			let currentBet = this.baseBetAmount || 0.2;
			if (isNaN(currentBet) || currentBet <= 0) {
				const currentBetText = this.getBetAmountText();
				const parsed = currentBetText ? parseFloat(currentBetText) : NaN;
				if (!isNaN(parsed)) currentBet = parsed;
			}
			if (isNaN(currentBet)) {
				this.isInternalBetChange = false; // Reset flag on error
				return;
			}
			const currentIndex = this.findClosestBetIndex(currentBet);
			const newIndex = Phaser.Math.Clamp(currentIndex + stepDelta, 0, this.betOptions.length - 1);
			if (newIndex === currentIndex) {
				this.isInternalBetChange = false; // Reset flag if no change
				return; // No change
			}
			const previousBet = this.betOptions[currentIndex];
			const newBet = this.betOptions[newIndex];
			this.updateBetAmount(newBet);
			// Notify systems of bet change
			gameEventManager.emit(GameEventType.BET_UPDATE, { newBet, previousBet });
			// If amplify is ON, re-apply the 25% visual increase to the updated base
			try {
				const gd = this.getGameData();
				if (gd && gd.isEnhancedBet) {
					this.applyAmplifyBetIncrease();
				}
			} catch {}
			
			// Reset the flag after bet update is complete
			this.isInternalBetChange = false;
		} catch (e) {
			console.warn('[SlotController] Failed to change bet:', e);
			this.isInternalBetChange = false; // Ensure flag is reset on error
		}
	}

	/**
	 * Find the closest bet option index to a given value
	 */
	private findClosestBetIndex(value: number): number {
		let closestIndex = 0;
		let closestDiff = Math.abs(this.betOptions[0] - value);
		for (let i = 1; i < this.betOptions.length; i++) {
			const diff = Math.abs(this.betOptions[i] - value);
			if (diff < closestDiff) {
				closestDiff = diff;
				closestIndex = i;
			}
		}
		return closestIndex;
	}

	/**
	 * Update the Buy Feature button amount to current base bet x100
	 */
	private updateFeatureAmountFromCurrentBet(): void {
		if (!this.featureAmountText || !this.featureDollarText) {
			return;
		}
    // Always use the independent Buy Feature bet (decoupled from main BET)
    const displayedBet = this.getBuyFeatureBetAmount() || 0;
		const price = displayedBet * 100;
		// Format with thousands separators and 2 decimals
		this.featureAmountText.setText(price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
		// Reposition dollar sign based on updated width
		const x = this.featureAmountText.x;
		const y = this.featureAmountText.y;
		this.featureDollarText.setPosition(x - (this.featureAmountText.width / 2) - 3, y);
	}

	getBetAmountText(): string | null {
		return this.betAmountText ? this.betAmountText.text : null;
	}

	/**
	 * Get the base bet amount for API calls (without amplify bet increase)
	 */
	getBaseBetAmount(): number {
		return this.baseBetAmount;
	}

/** Get the independent Buy Feature bet amount */
getBuyFeatureBetAmount(): number {
    return this.buyFeatureBetAmount;
}

/** Set the independent Buy Feature bet amount and refresh HUD price */
setBuyFeatureBetAmount(amount: number): void {
    const clamped = Math.max(0, amount);
    this.buyFeatureBetAmount = clamped;
    this.updateFeatureAmountFromCurrentBet();
}

	updateBalanceAmount(balanceAmount: number): void {
		if (this.balanceAmountText) {
			this.balanceAmountText.setText(balanceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			
			// Update dollar sign position based on new balance amount width
			if (this.balanceDollarText) {
				const balanceX = this.balanceAmountText.x;
				const balanceY = this.balanceAmountText.y;
				this.balanceDollarText.setPosition(balanceX - (this.balanceAmountText.width / 2) - 5, balanceY);
			}
		}
	}

	/**
	 * Decrement balance by the current bet amount (frontend only)
	 */
	private decrementBalanceByBet(): void {
		try {
			// Get current balance and bet amount
			const currentBalance = this.getBalanceAmount();
			const currentBet = this.getBaseBetAmount();
			const gameData = this.getGameData();

			// If Enhanced Bet is active, include the additional 25% in the deducted amount (frontend only)
			const totalBetToCharge = (gameData && gameData.isEnhancedBet)
				? currentBet * 1.25
				: currentBet;
			
			console.log(`[SlotController] Decrementing balance: $${currentBalance} - $${totalBetToCharge} ${gameData && gameData.isEnhancedBet ? '(enhanced bet +25%)' : ''}`);
			
			// Calculate new balance
			const newBalance = Math.max(0, currentBalance - totalBetToCharge); // Ensure balance doesn't go below 0
			
			// Update balance display immediately
			this.updateBalanceAmount(newBalance);
			
			console.log(`[SlotController] Balance decremented: $${currentBalance} -> $${newBalance} (bet charged: $${totalBetToCharge})`);
			
		} catch (error) {
			console.error('[SlotController] Error decrementing balance:', error);
		}
	}

	getBalanceAmountText(): string | null {
		return this.balanceAmountText ? this.balanceAmountText.text : null;
	}

	getBalanceAmount(): number {
		if (this.balanceAmountText) {
			// Remove the "$" symbol and parse the numeric value
			const balanceText = this.balanceAmountText.text.replace('$', '').replace(/,/g, '');
			return parseFloat(balanceText) || 0;
		}
		return 0;
	}

	enablePrimaryControllers(): void {
		if (this.primaryControllers) {
			this.primaryControllers.setVisible(true);
			this.primaryControllers.setInteractive(true);
		}
	}

	disablePrimaryControllers(): void {
		if (this.primaryControllers) {
			this.primaryControllers.setVisible(false);
			this.primaryControllers.setInteractive(false);
		}
	}

	/**
	 * Setup event listeners for autoplay state changes
	 */
	private setupAutoplayEventListeners(): void {
		// Listen for balance initialization
		gameEventManager.on(GameEventType.BALANCE_INITIALIZED, (data: any) => {
			console.log('[SlotController] Balance initialized event received:', data);
			
			if (data && data.newBalance !== undefined) {
				console.log(`[SlotController] Updating balance display to: $${data.newBalance}`);
				this.updateBalanceAmount(data.newBalance);
			}
		});

		// Listen for any spin to start (manual or autoplay)
		gameEventManager.on(GameEventType.SPIN, () => {
			console.log('[SlotController] Spin event received');
			
			// CRITICAL: Block autoplay spins if win dialog is showing, but allow manual spins
			// This fixes the timing issue where manual spin button animation was blocked
			if (gameStateManager.isShowingWinDialog && this.gameData?.isAutoPlaying) {
				console.log('[SlotController] Autoplay SPIN event BLOCKED - win dialog is showing');
				console.log('[SlotController] Manual spins are still allowed to proceed');
				return;
			}
			
			// Check if free spin autoplay is active - if so, don't play spin button animation
			const symbolsComponent = (this.scene as any).symbols;
			if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function' && symbolsComponent.isFreeSpinAutoplayActive()) {
				console.log('[SlotController] Free spin autoplay is active - skipping spin button animation');
				return;
			}
			
			// For manual spins, disable spin. Keep enabled during autoplay to allow stopping autoplay
			if (!gameStateManager.isAutoPlaying) {
				this.disableSpinButton();
			}
			
			// Play the spin button spine animation for all spins (manual and autoplay)
			this.playSpinButtonAnimation();
			
			// Rotate the spin button for all spins (manual and autoplay)
			this.rotateSpinButton();
			
			
			// Removed pulsing of autoplay spins remaining text during spin
			
			// Log current GameData animation values to debug turbo mode
			console.log('[SlotController] Spin started - GameData animation values:', this.getGameDataAnimationInfo());
			
			// Ensure turbo speed is applied to scene GameData before winline animations start
			this.forceApplyTurboToSceneGameData();
			
			// Ensure turbo speed is applied to winline animations via Symbols component
			this.applyTurboToWinlineAnimations();
		});

		// Listen for reels start to disable amplify button
		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[SlotController] Reels started - disabling amplify and bet UI');
			this.disableAmplifyButton();
			this.disableBetButtons();
			// Reset per-spin guards at the start of each spin
			this.hasDecrementedAutoplayForCurrentSpin = false;
			this.hasScheduledNextAutoplayForCurrentSpin = false;
			// Bump spin sequence and tag this spin
			this.currentSpinId = ++this.spinSequence;
			// During autoplay (base or bonus), flash all symbols at spin start
			try {
				if (gameStateManager.isAutoPlaying) {
					const symbolsComponent = (this.scene as any).symbols;
					if (symbolsComponent) {
						// Ensure symbols render correctly at spin start (base & bonus)
						try { symbolsComponent.restoreSymbolsAboveReelBg?.(); } catch {}
					}
				}
			} catch {}
		});

		gameEventManager.on(GameEventType.REELS_STOP, () => {
			console.log('[SlotController] Reels stopped event received - updating spin button state');
			// Single decrement per spinId at REELS_STOP
			if (gameStateManager.isAutoPlaying && this.autoplaySpinsRemaining > 0 && !this.hasDecrementedAutoplayForCurrentSpin) {
				if (this.lastDecrementSpinId !== this.currentSpinId) {
					this.autoplaySpinsRemaining = Math.max(0, this.autoplaySpinsRemaining - 1);
					this.updateAutoplaySpinsRemainingText(this.autoplaySpinsRemaining);
					this.hasDecrementedAutoplayForCurrentSpin = true;
					this.lastDecrementSpinId = this.currentSpinId;
					console.log(`[SlotController] Decremented on REELS_STOP (spinId=${this.currentSpinId}). Remaining: ${this.autoplaySpinsRemaining}`);
				}
			}

			// Schedule next autoplay spin only once per spinId and only if no win dialog is showing
			if (gameStateManager.isAutoPlaying && this.autoplaySpinsRemaining > 0 && !gameStateManager.isShowingWinDialog && !this.hasScheduledNextAutoplayForCurrentSpin && this.lastScheduleSpinId !== this.currentSpinId) {
				const baseDelay = 500;
				const gameData = this.getGameData();
				const isTurbo = gameData?.isTurbo || false;
				const turboDelay = isTurbo ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
				console.log(`[SlotController] Scheduling next autoplay spin after REELS_STOP in ${turboDelay}ms (spinId=${this.currentSpinId})`);
				this.hasScheduledNextAutoplayForCurrentSpin = true;
				this.lastScheduleSpinId = this.currentSpinId;
				this.scheduleNextAutoplaySpin(turboDelay);
			}

			// If no spins remain after decrement, stop autoplay
			if (gameStateManager.isAutoPlaying && this.autoplaySpinsRemaining === 0) {
				console.log('[SlotController] No autoplay spins remaining - emitting AUTO_STOP at REELS_STOP');
				gameEventManager.emit(GameEventType.AUTO_STOP);
			}

			// Update balance from server every time reels stop (skip during scatter/bonus)
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceFromServer();
			} else {
				console.log('[SlotController] Skipping server balance update on REELS_STOP (scatter/bonus active)');
			}
			
			// Apply pending balance update now that reels have stopped spinning
			if (this.pendingBalanceUpdate) {
				console.log('[SlotController] Applying pending balance update after reels stopped:', this.pendingBalanceUpdate);
				
				// Update balance display with final balance (including winnings)
				if (this.pendingBalanceUpdate.balance !== undefined) {
					const oldBalance = this.getBalanceAmountText();
					this.updateBalanceAmount(this.pendingBalanceUpdate.balance);
					
					if (this.pendingBalanceUpdate.winnings && this.pendingBalanceUpdate.winnings > 0) {
						console.log(`[SlotController] Balance updated after reels stopped: ${oldBalance} -> ${this.pendingBalanceUpdate.balance} (added winnings: ${this.pendingBalanceUpdate.winnings})`);
					} else {
						console.log(`[SlotController] Balance updated after reels stopped: ${oldBalance} -> ${this.pendingBalanceUpdate.balance}`);
					}
				}
				
				// Clear the pending update
				this.pendingBalanceUpdate = null;
				console.log('[SlotController] Pending balance update cleared');
			} else {
				console.log('[SlotController] No pending balance update to apply');
			}
			
			// If we're in bonus mode, check if free spins are finishing now
			if (gameStateManager.isBonus) {
				try {
					// Frontend-only: increment balance by the current free spin subtotal win
					if (this.gameAPI) {
						const currentSpin = this.gameAPI.getCurrentSpinData();
						if (currentSpin && currentSpin.slot && Array.isArray(currentSpin.slot.paylines)) {
							const spinSubtotalWin = SpinDataUtils.getTotalWin(currentSpin);
							if (spinSubtotalWin && spinSubtotalWin > 0) {
								const oldBalanceVal = this.getBalanceAmount();
								const newBalanceVal = oldBalanceVal + spinSubtotalWin;
								this.updateBalanceAmount(newBalanceVal);
								console.log(`[SlotController] Bonus mode: incremented balance by subtotalWin ${spinSubtotalWin}. ${oldBalanceVal} -> ${newBalanceVal}`);
							}
						}
					}
					
					const gameScene: any = this.scene as any;
					const symbolsComponent = gameScene?.symbols;
					// Prefer Symbols' remaining counter if available
					if (symbolsComponent && typeof symbolsComponent.freeSpinAutoplaySpinsRemaining === 'number') {
						const remaining: number = symbolsComponent.freeSpinAutoplaySpinsRemaining;
						// If after this spin there are no spins remaining, flag bonus finished
						if (remaining <= 0) {
							console.log('[SlotController] REELS_STOP: remaining free spins <= 0 – setting isBonusFinished=true');
							gameStateManager.isBonusFinished = true;
						}
					} else if (this.gameAPI && typeof this.gameAPI.getCurrentSpinData === 'function') {
						// Fallback: inspect GameAPI spin data for remaining spins
						const apiSpinData: any = this.gameAPI.getCurrentSpinData();
						const fs = apiSpinData?.slot?.freespin || apiSpinData?.slot?.freeSpin;
						if (fs?.items && Array.isArray(fs.items)) {
							const totalRemaining = fs.items.reduce((sum: number, it: any) => sum + (it?.spinsLeft || 0), 0);
							if (totalRemaining <= 1) {
								console.log('[SlotController] REELS_STOP: totalRemaining free spins <= 1 – setting isBonusFinished=true');
								gameStateManager.isBonusFinished = true;
							}
						}
					}
				} catch (e) {
					console.warn('[SlotController] REELS_STOP: Unable to evaluate bonus finish state:', e);
				}
			}
			
			// If scatter/bonus mode is active, keep buttons disabled
			if (gameStateManager.isScatter || gameStateManager.isBonus) {
				console.log('[SlotController] Bonus active - keeping buttons disabled on REELS_STOP');
				return;
			}
			
			// Check if free spin autoplay is active - if so, don't re-enable buttons
			const symbolsComponent = (this.scene as any).symbols;
			if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function' && symbolsComponent.isFreeSpinAutoplayActive()) {
				console.log('[SlotController] Free spin autoplay is active - keeping buttons disabled');
				return;
			}
			
			// Note: autoplaySpinsRemaining is decremented in REELS_STOP (single decrement per spin)
			// Note: AUTO_STOP is emitted when spins reach 0
			
			// For manual spins, re-enable spin button and hide autoplay counter immediately after REELS_STOP
			// Check autoplay counter instead of state manager to avoid timing issues
			if (this.autoplaySpinsRemaining === 0) {
				this.enableSpinButton();
				this.enableAutoplayButton();
				this.enableBetButtons();
				// Keep feature disabled during bonus or until explicitly allowed
				if (!gameStateManager.isBonus && this.canEnableFeatureButton) {
					this.enableFeatureButton();
				}
				this.enableAmplifyButton();
				this.hideAutoplaySpinsRemainingText();
				this.updateAutoplayButtonState();
				console.log('[SlotController] Manual spin - all buttons re-enabled after REELS_STOP');
				return;
			}
			
			// Update spin button state when spin completes
			// Only enable spin button if not autoplaying AND reels are not spinning
			if(!this.gameData?.isAutoPlaying && !gameStateManager.isReelSpinning) {
				this.enableSpinButton();
				this.enableAutoplayButton();
				this.enableBetButtons();
				// Keep feature disabled during bonus or until explicitly allowed
				if (!gameStateManager.isBonus && this.canEnableFeatureButton) {
					this.enableFeatureButton();
				}
				this.enableAmplifyButton();
				console.log('[SlotController] All buttons enabled - manual spin completed and reels stopped');
				return;
			}
			
			// If autoplaying or reels still spinning, keep button disabled
			if(this.gameData?.isAutoPlaying) {
				console.log('[SlotController] Spin button remains disabled - autoplay active');
			} else if(gameStateManager.isReelSpinning) {
				console.log('[SlotController] Spin button remains disabled - reels still spinning');
			}
		});

		// Listen for autoplay start
		gameEventManager.on(GameEventType.AUTO_START, () => {
			console.log('[SlotController] Autoplay started - changing button to ON state');
			// Guard against accidental starts while already autoplaying or stopping
			if (this.isStoppingAutoplay || this.gameData?.isAutoPlaying || gameStateManager.isAutoPlaying) {
				console.log('[SlotController] Ignoring AUTO_START - already autoplaying or stopping');
				return;
			}
			
			// Update GameData autoplay state
			if (this.gameData) {
				this.gameData.isAutoPlaying = true;
				console.log('[SlotController] Updated GameData.isAutoPlaying to true');
			}
			
			this.setAutoplayButtonState(true);
			// Keep spin button enabled during autoplay (allow stopping autoplay)
			// Hide and pause spin icon completely during autoplay, show stop icon
			if (this.spinIcon) {
				this.spinIcon.setVisible(false);
			}
			if (this.spinIconTween) {
				this.spinIconTween.pause();
			}
			if (this.autoplayStopIcon) {
				this.autoplayStopIcon.setVisible(true);
				this.primaryControllers.bringToTop(this.autoplayStopIcon);
			}
			// Keep spins text above all
			if (this.autoplaySpinsRemainingText && this.primaryControllers) {
				this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
			}
			// No need to update spin button state here - will be handled when reels finish
		});

		// Listen for autoplay stop
		gameEventManager.on(GameEventType.AUTO_STOP, () => {
			console.log('[SlotController] AUTO_STOP event received');
			console.log('[SlotController] Current state - isAutoPlaying:', gameStateManager.isAutoPlaying, 'isReelSpinning:', gameStateManager.isReelSpinning);
			console.log('[SlotController] Autoplay counter:', this.autoplaySpinsRemaining);
			
			// Always reset autoplay UI when AUTO_STOP is received
			// (AUTO_STOP should only be emitted when autoplay is finished)
			console.log('[SlotController] Resetting autoplay UI on AUTO_STOP');
			
			// Reset autoplay button to off
			this.setAutoplayButtonState(false);
			console.log('[SlotController] Autoplay button set to OFF');
			
			// Hide autoplay spin count display
			this.hideAutoplaySpinsRemainingText();
			console.log('[SlotController] Autoplay spin count hidden');
			
			// Re-enable spin button, autoplay button, bet buttons, and feature button
			// If reels are spinning (e.g., autoplay canceled mid-spin), keep controls disabled
			if (gameStateManager.isReelSpinning) {
				console.log('[SlotController] AUTO_STOP during active spin - keeping controls disabled until REELS_STOP');
				this.disableSpinButton();
				this.disableAutoplayButton();
				this.disableBetButtons();
				this.disableFeatureButton();
				this.disableAmplifyButton();
			} else {
				this.enableSpinButton();
				this.enableAutoplayButton();
				this.enableBetButtons();
				this.enableFeatureButton();
				this.enableAmplifyButton();
			}
			// Update spin icons depending on whether controls are enabled
			if (this.autoplayStopIcon) {
				this.autoplayStopIcon.setVisible(false);
			}
			if (gameStateManager.isReelSpinning) {
				// Keep disabled look
				if (this.spinIcon) { this.spinIcon.setVisible(true); this.spinIcon.setAlpha(0.5); }
				if (this.spinIconTween) { this.spinIconTween.pause(); }
			} else {
				// Controls enabled – restore normal look
				if (this.spinIcon) { this.spinIcon.setVisible(true); this.spinIcon.setAlpha(1); }
				if (this.spinIconTween) { this.spinIconTween.resume(); }
			}
			// Keep spins text above all
			if (this.autoplaySpinsRemainingText && this.primaryControllers) {
				this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
			}
			console.log('[SlotController] Spin, autoplay, bet, feature, and amplify buttons enabled');
			
			console.log('[SlotController] Autoplay UI reset completed');
			// Reset stopping guard at the end of AUTO_STOP handling
			this.isStoppingAutoplay = false;
		});


		// Listen for when reels stop spinning to enable spin button for manual spins
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			console.log('[SlotController] WIN_STOP received - checking if spin button should be enabled');
			
			// If scatter/bonus mode is active, keep buttons disabled
			if (gameStateManager.isScatter || gameStateManager.isBonus) {
				console.log('[SlotController] Bonus in progress - skipping UI re-enable in WIN_STOP');
				return;
			}
			
			// Check if free spin autoplay is active - if so, don't re-enable buttons
			const symbolsComponent = (this.scene as any).symbols;
			if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function' && symbolsComponent.isFreeSpinAutoplayActive()) {
				console.log('[SlotController] Free spin autoplay is active - skipping button re-enable in WIN_STOP');
				return;
			}
			
			// Handle autoplay spin completion
			// Check if autoplay is active by checking both the counter and the game state
			const isAutoplayActive = this.autoplaySpinsRemaining > 0 || gameStateManager.isAutoPlaying;
			
			if (isAutoplayActive) {
				console.log('[SlotController] Autoplay spin completed, checking for next spin');
				console.log(`[SlotController] Autoplay state: spinsRemaining=${this.autoplaySpinsRemaining}, isAutoPlaying=${gameStateManager.isAutoPlaying}`);
				
				// Note: Do not decrement here; handle decrement once at REELS_STOP only
				
				// Note: scheduling of the next autoplay spin is handled at REELS_STOP to ensure reels are fully stopped
				if (this.autoplaySpinsRemaining === 0) {
					console.log('[SlotController] No autoplay spins remaining - autoplay finished');
					gameEventManager.emit(GameEventType.AUTO_STOP);
				}
			} else {
				// Manual spin completed - emit AUTO_STOP for UI reset
				console.log('[SlotController] Manual spin completed - emitting AUTO_STOP for UI reset');
				gameEventManager.emit(GameEventType.AUTO_STOP);
			}
		});

		// Listen for win dialog close (for high winnings case)
		gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
			console.log('[SlotController] WIN_DIALOG_CLOSED received');
			console.log('[SlotController] Current autoplay state:', {
				autoplaySpinsRemaining: this.autoplaySpinsRemaining,
				isAutoPlaying: gameStateManager.isAutoPlaying,
				isShowingWinDialog: gameStateManager.isShowingWinDialog
			});
			
			// If autoplay is active and win dialog was closed, wait for winlines to complete
			// Note: autoplaySpinsRemaining was already decremented in WIN_STOP handler
			if (this.autoplaySpinsRemaining > 0) {
				console.log('[SlotController] Scheduling next autoplay spin after closing Win Dialog');
				
				const baseDelay = 500;
					// FIXED: Use GameData.isTurbo instead of gameStateManager.isTurbo for consistency
					const gameData = this.getGameData();
					const isTurbo = gameData?.isTurbo || false;
					const turboDelay = isTurbo ? 
						baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
					console.log(`[SlotController] Autoplay delay: ${baseDelay}ms -> ${turboDelay}ms (turbo: ${isTurbo})`);
					this.scheduleNextAutoplaySpin(turboDelay);
			} else {
				// Only show this log if we're not in bonus mode (free spin autoplay)
				if (!gameStateManager.isBonus) {
					console.log('[SlotController] No autoplay spins remaining, not scheduling next spin');
				} else {
					console.log('[SlotController] In bonus mode - free spin autoplay is handled by Symbols component');
				}
			}
		});

		// Note: SPIN_RESPONSE event listeners removed - now using SPIN_DATA_RESPONSE
	}

	/**
	 * Handle turbo button click - toggle between on and off states
	 */
	private handleTurboButtonClick(): void {
		// Check GameData state to determine current turbo status
		const gameData = this.getGameData();
		if (!gameData) {
			console.error('[SlotController] GameData not available for turbo button click');
			return;
		}
		
		if (gameData.isTurbo) {
			// Turbo is active, turn it off
			console.log('[SlotController] Turning turbo OFF via button click');
			gameData.isTurbo = false;
			this.setTurboButtonState(false);
		} else {
			// Turbo is not active, turn it on
			console.log('[SlotController] Turning turbo ON via button click');
			gameData.isTurbo = true;
			this.setTurboButtonState(true);
		}
		
		// Apply turbo speed modifications
		this.applyTurboSpeedModifications();
		
		// Force apply turbo to scene GameData (used by Symbols component)
		this.forceApplyTurboToSceneGameData();
		
		// Apply turbo to winline animations via Symbols component
		this.applyTurboToWinlineAnimations();
		
		// Emit turbo event for other components to handle
		EventBus.emit('turbo', gameData.isTurbo);
		
		// Send turbo state to backend for speed modifications
		if (gameData.isTurbo) {
			gameEventManager.emit(GameEventType.TURBO_ON);
		} else {
			gameEventManager.emit(GameEventType.TURBO_OFF);
		}
		
		console.log(`[SlotController] Turbo state changed to: ${gameData.isTurbo} and sent to backend`);
	}

	/**
	 * Handle amplify button click - toggle between on and off states
	 */
	private handleAmplifyButtonClick(): void {
		// Check GameData state to determine current amplify bet status
		const gameData = this.getGameData();
		if (!gameData) {
			console.error('[SlotController] GameData not available for amplify button click');
			return;
		}
		
		if (gameData.isEnhancedBet) {
			// Amplify bet is active, turn it off
			console.log('[SlotController] Turning amplify bet OFF via button click');
			gameData.isEnhancedBet = false;
			this.setAmplifyButtonState(false);
			// Hide the animation when turning off
			this.hideAmplifyBetAnimation();
			this.hideEnhanceBetIdleLoop();
			// Restore original bet amount (remove 25% increase)
			this.restoreOriginalBetAmount();
			// Re-enable feature button when amplify is turned OFF
			this.enableFeatureButton();
		} else {
			// Amplify bet is not active, turn it on
			console.log('[SlotController] Turning amplify bet ON via button click');
			gameData.isEnhancedBet = true;
			this.setAmplifyButtonState(true);
			// Trigger animation when turning ON
			this.triggerAmplifyBetAnimation();
			// Apply 25% bet increase
			this.applyAmplifyBetIncrease();
			// Disable feature button when amplify is turned ON
			this.disableFeatureButton();
		}
		
		// Control the amplify bet button pulsing based on state
		this.controlAmplifyBetAnimation();
		
		// Emit amplify event for other components to handle
		EventBus.emit('amplify', gameData.isEnhancedBet);
		
		console.log(`[SlotController] Amplify bet state changed to: ${gameData.isEnhancedBet}`);
	}

	/**
	 * Handle autoplay button click - either start autoplay or stop if already running
	 */
	private handleAutoplayButtonClick(): void {
		// Prevent re-entrancy
		if (this.isStoppingAutoplay) {
			console.log('[SlotController] Autoplay stop already in progress; ignoring button click');
			return;
		}
		// If autoplay is active, stop it
		if (this.autoplaySpinsRemaining > 0 || this.gameData?.isAutoPlaying || gameStateManager.isAutoPlaying) {
			console.log('[SlotController] Stopping autoplay via button click');
			this.stopAutoplay();
			return;
		}
		// If reels are spinning, do not open autoplay options mid-spin
		if (gameStateManager.isReelSpinning) {
			console.log('[SlotController] Reels are spinning; delaying autoplay options until REELS_STOP');
			return;
		}
		// Autoplay is not active and reels are idle: show options
		console.log('[SlotController] Showing autoplay options');
		EventBus.emit('autoplay');
	}

	/**
	 * Start autoplay with specified number of spins
	 */
	public startAutoplay(spins: number): void {
		console.log(`[SlotController] Starting autoplay with ${spins} spins`);
		
		// Update state
		this.autoplaySpinsRemaining = spins;
		
		// Update GameData and GameStateManager
		if (this.gameData) {
			this.gameData.isAutoPlaying = true;
		}
		gameStateManager.isAutoPlaying = true;
		console.log('[SlotController] Set gameStateManager.isAutoPlaying to true for autoplay start');
		
		// Update UI
		this.setAutoplayButtonState(true);
		this.showAutoplaySpinsRemainingText();
		this.updateAutoplaySpinsRemainingText(spins);
		// Hide and pause spin icon completely during autoplay, show stop icon
		if (this.spinIcon) {
			this.spinIcon.setVisible(false);
		}
		if (this.spinIconTween) {
			this.spinIconTween.pause();
		}
		if (this.autoplayStopIcon) {
			this.autoplayStopIcon.setVisible(true);
			if (this.primaryControllers) this.primaryControllers.bringToTop(this.autoplayStopIcon);
		}
		
		// Keep spin button enabled during autoplay (allow stopping autoplay)
		this.disableBetButtons();
		this.disableFeatureButton();
		
		// Start the first autoplay spin immediately
		this.performAutoplaySpin();
	}

	/**
	 * Stop autoplay
	 */
	public stopAutoplay(): void {
		console.log('[SlotController] Stopping autoplay');
		console.log('[SlotController] Before stopAutoplay - isAutoPlaying:', gameStateManager.isAutoPlaying, 'isReelSpinning:', gameStateManager.isReelSpinning);
		if (this.isStoppingAutoplay) {
			console.log('[SlotController] stopAutoplay called while already stopping; ignoring');
			return;
		}
		this.isStoppingAutoplay = true;
		
		// Clear timer
		if (this.autoplayTimer) {
			this.autoplayTimer.destroy();
			this.autoplayTimer = null;
		}
		
		// Update state
		this.autoplaySpinsRemaining = 0;
		
		// Update GameData and GameStateManager
		if (this.gameData) {
			this.gameData.isAutoPlaying = false;
		}
		gameStateManager.isAutoPlaying = false;
		
		console.log('[SlotController] After stopAutoplay - isAutoPlaying:', gameStateManager.isAutoPlaying, 'isReelSpinning:', gameStateManager.isReelSpinning);
		
		// Update UI
		this.setAutoplayButtonState(false);
		this.hideAutoplaySpinsRemainingText();
		// Show and resume spin icon after autoplay stops, hide stop icon
		if (this.spinIcon) {
			this.spinIcon.setVisible(true);
		}
		if (this.spinIconTween) {
			this.spinIconTween.resume();
		}
		if (this.autoplayStopIcon) {
			this.autoplayStopIcon.setVisible(false);
		}
		
		// If scatter/bonus active, keep controls disabled
		if (gameStateManager.isScatter || gameStateManager.isBonus) {
			this.disableSpinButton();
			this.disableAutoplayButton();
			this.disableAmplifyButton();
			return;
		}
		
		// If reels are still spinning, immediately disable spin to prevent manual spin
		if (gameStateManager.isReelSpinning) {
			this.disableSpinButton();
			this.disableBetButtons();
			this.disableFeatureButton();
			// Controls will be re-enabled on REELS_STOP
			return;
		}
		// If not spinning anymore, it's safe to re-enable spin
		this.enableSpinButton();
		// Reset stopping guard once state has settled
		this.isStoppingAutoplay = false;
	}

	/**
	 * Perform a single autoplay spin
	 */
	private async performAutoplaySpin(): Promise<void> {
		// Play spin button animations
		this.playSpinButtonAnimation();
		this.rotateSpinButton();
		
		// Play autoplay button animation once per spin
		this.playAutoplayAnimation();
		
		// Removed pulsing of autoplay spins remaining text during autoplay
		
		// Use the centralized spin handler
		await this.handleSpin();
		
		// Note: autoplaySpinsRemaining is decremented in REELS_STOP handler
		// This ensures the counter is decremented after the spin is fully processed
		console.log(`[SlotController] Autoplay spin initiated, spins remaining: ${this.autoplaySpinsRemaining}`);
	}

	/**
	 * Schedule next autoplay spin based on game state
	 * @param delay - Delay in milliseconds (will be affected by turbo if not already applied)
	 */
	public scheduleNextAutoplaySpin(delay: number = 500): void {
		if (this.autoplaySpinsRemaining <= 0) {
			console.log('[SlotController] No more autoplay spins to schedule');
			return;
		}

		console.log(`[SlotController] Scheduling next autoplay spin in ${delay}ms`);
		console.log('[SlotController] Scene available for timer:', !!this.scene);
		console.log('[SlotController] Current autoplay timer:', !!this.autoplayTimer);

		// Clear existing timer
		if (this.autoplayTimer) {
			console.log('[SlotController] Destroying existing autoplay timer');
			this.autoplayTimer.destroy();
		}

		// Create new timer
		this.autoplayTimer = this.scene?.time.delayedCall(delay, () => {
			console.log('[SlotController] Autoplay timer callback triggered - calling performAutoplaySpin');
			this.performAutoplaySpin();
		}) || null;
		
		console.log('[SlotController] New autoplay timer created:', !!this.autoplayTimer);
		if (this.autoplayTimer) {
			console.log('[SlotController] Timer delay set to:', this.autoplayTimer.delay);
		}
	}

	/**
	 * Change autoplay button visual state
	 */
	public setAutoplayButtonState(isOn: boolean): void {
		const autoplayButton = this.buttons.get('autoplay');
		if (autoplayButton) {
			const textureKey = isOn ? 'autoplay_on' : 'autoplay_off';
			autoplayButton.setTexture(textureKey);
			console.log(`[SlotController] Autoplay button texture changed to: ${textureKey}`);
		}
		
		// Control the autoplay animation based on state
		if (isOn) {
			this.startAutoplayAnimation();
		} else {
			this.stopAutoplayAnimation();
		}
	}

	/**
	 * Disable the turbo button (grey out and disable interaction)
	 */
	public disableTurboButton(): void {
		const turboButton = this.buttons.get('turbo');
		if (turboButton) {
			turboButton.setTint(0x666666); // Grey out the button
			turboButton.disableInteractive();
			console.log('[SlotController] Turbo button disabled and greyed out');
		}
	}

	/**
	 * Enable the turbo button (remove grey tint and enable interaction)
	 */
	public enableTurboButton(): void {
		const turboButton = this.buttons.get('turbo');
		if (turboButton) {
			turboButton.clearTint(); // Remove grey tint
			turboButton.setInteractive();
			console.log('[SlotController] Turbo button enabled');
		}
	}

	/**
	 * Disable the amplify button (disable interaction only, no visual changes)
	 */
	public disableAmplifyButton(): void {
		const amplifyButton = this.buttons.get('amplify');
		if (amplifyButton) {
			amplifyButton.removeInteractive();
			console.log('[SlotController] Amplify button disabled');
		}
	}

	/**
	 * Enable the amplify button (enable interaction)
	 */
	public enableAmplifyButton(): void {
		const amplifyButton = this.buttons.get('amplify');
		if (amplifyButton) {
			amplifyButton.setInteractive();
			console.log('[SlotController] Amplify button enabled');
		}
	}

	/**
	 * Update turbo button state based on game conditions
	 */
	public updateTurboButtonState(): void {
		const gameData = this.getGameData();
		if (!gameData || !this.buttons.has('turbo')) {
			return;
		}

		const turboButton = this.buttons.get('turbo');
		if (!turboButton) return;

		// Disable turbo button if spinning, enable otherwise
		if (gameStateManager.isReelSpinning) {
			console.log(`[SlotController] Disabling turbo button - isReelSpinning: ${gameStateManager.isReelSpinning}`);
			this.disableTurboButton();
		} else {
			console.log(`[SlotController] Enabling turbo button - not spinning`);
			this.enableTurboButton();
		}
	}

	/**
	 * Change turbo button visual state
	 */
	public setTurboButtonState(isOn: boolean): void {
		const turboButton = this.buttons.get('turbo');
		if (turboButton) {
			const textureKey = isOn ? 'turbo_on' : 'turbo_off';
			turboButton.setTexture(textureKey);
			console.log(`[SlotController] Turbo button texture changed to: ${textureKey}`);
		}
		
		// Control the turbo animation based on state
		if (isOn) {
			this.startTurboAnimation();
		} else {
			this.stopTurboAnimation();
		}
	}

	/**
	 * Change amplify button visual state
	 */
	public setAmplifyButtonState(isOn: boolean): void {
		const amplifyButton = this.buttons.get('amplify');
		if (amplifyButton) {
			if (isOn) {
				// Add a yellow tint when active
				amplifyButton.setTint(0xffff00); // Yellow tint to indicate active
				// Don't change scale here - let the pulsing handle it
			} else {
				// Remove effects when inactive
				amplifyButton.clearTint();
				// Don't change scale here - let the pulsing handle it
			}
			console.log(`[SlotController] Amplify button state changed to: ${isOn ? 'ON' : 'OFF'}`);
		}
	}

	/**
	 * Initialize amplify button state based on GameData
	 */
	private initializeAmplifyButtonState(): void {
		const gameData = this.getGameData();
		if (!gameData) {
			return;
		}

		// Set the initial button state
		this.setAmplifyButtonState(gameData.isEnhancedBet);
		
		// Control the animation based on initial state
		this.controlAmplifyBetAnimation();
		
		// Apply initial feature button availability based on amplify state
		if (gameData.isEnhancedBet) {
			this.disableFeatureButton();
		} else {
			this.enableFeatureButton();
		}
		
		console.log(`[SlotController] Amplify button initialized with state: ${gameData.isEnhancedBet ? 'ON' : 'OFF'}`);
	}

	/**
	 * Control the amplify bet animation based on toggle state
	 */
	private controlAmplifyBetAnimation(): void {
		const gameData = this.getGameData();
		if (!gameData) {
			return;
		}

		// Remove pulsing/bouncing regardless of state; keep only color/tint change
		this.stopAmplifyBetBouncing();

		// Only hide idle when turning off/resetting; show is handled after toggle animation completes
		if (!gameData.isEnhancedBet) {
			this.hideEnhanceBetIdleLoop();
		}
	}



	/**
	 * Start the amplify button pulsing effect
	 */
	private startAmplifyBetBouncing(): void {
		const amplifyButton = this.buttons.get('amplify');
		if (!amplifyButton || !this.scene) {
			console.warn('[SlotController] Amplify button or scene not available for pulsing');
			return;
		}

		// Clear any existing timer
		if (this.amplifyBetBounceTimer) {
			this.amplifyBetBounceTimer.destroy();
		}

		// Create a continuous pulsing animation
		this.scene.tweens.add({
			targets: amplifyButton,
			scaleX: amplifyButton.scaleX * 1.1,
			scaleY: amplifyButton.scaleY * 1.1,
			duration: 500,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1 // Infinite repeat
		});

		console.log('[SlotController] Amplify button pulsing started');
	}

	/**
	 * Stop the amplify button pulsing effect
	 */
	private stopAmplifyBetBouncing(): void {
		const amplifyButton = this.buttons.get('amplify');
		if (amplifyButton && this.scene) {
			// Stop any active tweens on the button
			this.scene.tweens.killTweensOf(amplifyButton);
			
			// Reset to original scale
			const originalScale = this.getAmplifyButtonOriginalScale();
			amplifyButton.setScale(originalScale, originalScale);
		}

		// Clear any existing timer
		if (this.amplifyBetBounceTimer) {
			this.amplifyBetBounceTimer.destroy();
			this.amplifyBetBounceTimer = null;
		}

		console.log('[SlotController] Amplify button pulsing stopped');
	}

	/**
	 * Get the original scale of the amplify button
	 */
	private getAmplifyButtonOriginalScale(): number {
		// Return the base scale used when creating the button
		// This should match the scale used in createPortraitController
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		return assetScale; // This is the original scale used for the amplify button
	}

	/**
	 * Trigger amplify bet spine animation when spin occurs while amplify bet is on
	 */
	private triggerAmplifyBetAnimation(): void {
		const gameData = this.getGameData();
		if (!gameData || !gameData.isEnhancedBet) {
			console.log('[SlotController] Amplify bet not active, skipping animation');
			return;
		}

		if (!this.amplifyBetAnimation) {
			console.warn('[SlotController] Amplify bet animation not available');
			return;
		}

		console.log('[SlotController] Triggering amplify bet spine animation');
		
		// Stop and clear any existing animation first
		this.amplifyBetAnimation.animationState.clearTracks();
		this.amplifyBetAnimation.animationState.clearListeners();
		
		// Reset the skeleton to its initial pose
		this.amplifyBetAnimation.skeleton.setToSetupPose();
		this.amplifyBetAnimation.animationState.setEmptyAnimation(0, 0);
		
		// Hide the animation to reset it
		this.amplifyBetAnimation.setVisible(false);
		
		// Small delay to ensure proper reset, then show and play
		this.scene?.time.delayedCall(50, () => {
			console.log('[SlotController] Showing and playing amplify bet animation after delay');
			// Show the animation
			this.amplifyBetAnimation.setVisible(true);
			this.playAmplifyBetAnimation();
		});
	}

	/**
	 * Play the amplify bet animation once
	 */
	private playAmplifyBetAnimation(): void {
		if (!this.amplifyBetAnimation) {
			console.warn('[SlotController] Amplify bet animation not available for playing');
			return;
		}

		const animationName = 'animation';
		
		// Try to play the animation using animationState.setAnimation (play once)
		if (this.amplifyBetAnimation.skeleton && this.amplifyBetAnimation.skeleton.data.findAnimation(animationName)) {
			this.amplifyBetAnimation.animationState.setAnimation(0, animationName, false); // Play once, no loop
			
			// Listen for animation completion to hide it and start idle loop
			this.amplifyBetAnimation.animationState.addListener({
				complete: (entry: any) => {
					if (entry.animation.name === animationName) {
						this.amplifyBetAnimation.setVisible(false);
						console.log('[SlotController] Amplify bet animation completed and hidden');
						// After toggle animation completes, show the idle loop if enhanced bet is still ON
						const gameData = this.getGameData();
						if (gameData && gameData.isEnhancedBet) {
							this.showEnhanceBetIdleLoop();
						}
					}
				}
			});
			
			console.log('[SlotController] Playing amplify bet animation once:', animationName);
		} else {
			// Fallback: try to play any available animation
			const animations = this.amplifyBetAnimation.skeleton?.data.animations || [];
			if (animations.length > 0) {
				console.log('[SlotController] Using fallback animation:', animations[0].name);
				this.amplifyBetAnimation.animationState.setAnimation(0, animations[0].name, false);
				
				// Listen for animation completion to hide it and start idle loop
				this.amplifyBetAnimation.animationState.addListener({
					complete: (entry: any) => {
						if (entry.animation.name === animations[0].name) {
							this.amplifyBetAnimation.setVisible(false);
							console.log('[SlotController] Amplify bet fallback animation completed and hidden');
							const gameData = this.getGameData();
							if (gameData && gameData.isEnhancedBet) {
								this.showEnhanceBetIdleLoop();
							}
						}
					}
				});
			} else {
				console.warn('[SlotController] No animations found for amplify bet spine');
			}
		}
	}

	/**
	 * Hide amplify bet animation
	 */
	private hideAmplifyBetAnimation(): void {
		if (this.amplifyBetAnimation) {
			this.amplifyBetAnimation.setVisible(false);
			// Stop the animation
			this.amplifyBetAnimation.animationState.clearTracks();
			console.log('[SlotController] Amplify bet animation hidden and stopped');
		}
	}

	/**
	 * Apply 25% bet increase when amplify bet is activated
	 */
	private applyAmplifyBetIncrease(): void {
		const currentBetText = this.getBetAmountText();
		if (!currentBetText) {
			console.warn('[SlotController] No current bet amount to increase');
			return;
		}

		const currentBet = parseFloat(currentBetText);
		const increasedBet = currentBet * 1.25; // Add 25%
		
		// Only update the display, keep baseBetAmount unchanged for API calls
		if (this.betAmountText) {
			this.betAmountText.setText(increasedBet.toFixed(2));
			
			// Update dollar sign position based on new bet amount width
			if (this.betDollarText) {
				const betX = this.betAmountText.x;
				const betY = this.betAmountText.y;
				this.betDollarText.setPosition(betX - (this.betAmountText.width / 2) - 5, betY);
			}
		}
		
		// Even though base bet doesn't change, price uses base bet x100
		this.updateFeatureAmountFromCurrentBet();
		
		console.log(`[SlotController] Amplify bet applied: $${currentBet} -> $${increasedBet.toFixed(2)} (+25%) - Base bet for API: $${this.baseBetAmount}`);
	}

	/**
	 * Restore original bet amount when amplify bet is deactivated
	 */
	private restoreOriginalBetAmount(): void {
		// Restore display to base bet amount
		if (this.betAmountText) {
			this.betAmountText.setText(this.baseBetAmount.toFixed(2));
			
			// Update dollar sign position based on new bet amount width
			if (this.betDollarText) {
				const betX = this.betAmountText.x;
				const betY = this.betAmountText.y;
				this.betDollarText.setPosition(betX - (this.betAmountText.width / 2) - 5, betY);
			}
		}
		
		// Keep Buy Feature price in sync
		this.updateFeatureAmountFromCurrentBet();
		
		console.log(`[SlotController] Amplify bet removed: Display restored to base bet: $${this.baseBetAmount}`);
	}

	/**
	 * Reset amplify bet state when bet amount is changed externally
	 */
	private resetAmplifyBetOnBetChange(): void {
		const gameData = this.getGameData();
		if (!gameData || !gameData.isEnhancedBet) {
			return; // Amplify bet is not active, nothing to reset
		}

		console.log('[SlotController] Bet amount changed externally - resetting amplify bet state');
		
		// Reset amplify bet state
		gameData.isEnhancedBet = false;
		this.setAmplifyButtonState(false);
		this.hideAmplifyBetAnimation();
		this.hideEnhanceBetIdleLoop();
		this.stopAmplifyBetBouncing();
		// Price still reflects base bet x100, so refresh it
		this.updateFeatureAmountFromCurrentBet();
		
		console.log('[SlotController] Amplify bet state reset due to bet change');
	}


	/**
	 * Apply turbo speed modifications to winline animations
	 */
	private applyTurboSpeedModifications(): void {
		const gameData = this.getGameData();
		if (!gameData) {
			console.warn('[SlotController] GameData not available for turbo speed modifications');
			return;
		}

		console.log(`[SlotController] Applying turbo speed modifications - isTurbo: ${gameData.isTurbo}`);
		console.log(`[SlotController] Current GameData reference:`, gameData);
		console.log(`[SlotController] GameData memory address:`, gameData.toString());

		if (gameData.isTurbo) {
			// Apply turbo speed (4x faster = 0.25x duration)
			const originalWinUp = gameData.winUpDuration;
			const originalDrop = gameData.dropDuration;
			const originalDelay = gameData.dropReelsDelay;
			const originalDuration = gameData.dropReelsDuration;
			
			gameData.winUpDuration = gameData.winUpDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
			gameData.dropDuration = gameData.dropDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
			gameData.dropReelsDelay = gameData.dropReelsDelay * TurboConfig.TURBO_SPEED_MULTIPLIER;
			gameData.dropReelsDuration = gameData.dropReelsDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
			
			console.log(`[SlotController] Turbo speed applied to winline animations (4x faster):`);
			console.log(`  winUpDuration: ${originalWinUp} -> ${gameData.winUpDuration}`);
			console.log(`  dropDuration: ${originalDrop} -> ${gameData.dropDuration}`);
			console.log(`  dropReelsDelay: ${originalDelay} -> ${gameData.dropReelsDelay}`);
			console.log(`  dropReelsDuration: ${originalDuration} -> ${gameData.dropReelsDuration}`);
			
			// Verify the changes were applied
			console.log(`[SlotController] Verification - Current GameData values:`);
			console.log(`  winUpDuration: ${gameData.winUpDuration}`);
			console.log(`  dropDuration: ${gameData.dropDuration}`);
			console.log(`  dropReelsDelay: ${gameData.dropReelsDelay}`);
			console.log(`  dropReelsDuration: ${gameData.dropReelsDuration}`);
			
			// Also check if the scene's GameData is the same reference
			if (this.scene && (this.scene as any).gameData) {
				const sceneGameData = (this.scene as any).gameData;
				console.log(`[SlotController] Scene GameData reference:`, sceneGameData);
				console.log(`[SlotController] Scene GameData memory address:`, sceneGameData.toString());
				console.log(`[SlotController] Are references the same?`, gameData === sceneGameData);
				
				if (gameData !== sceneGameData) {
					console.warn(`[SlotController] WARNING: Different GameData references! Applying turbo to scene GameData as well.`);
					// Apply turbo to scene GameData as well
					sceneGameData.winUpDuration = sceneGameData.winUpDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
					sceneGameData.dropDuration = sceneGameData.dropDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
					sceneGameData.dropReelsDelay = sceneGameData.dropReelsDelay * TurboConfig.TURBO_SPEED_MULTIPLIER;
					sceneGameData.dropReelsDuration = sceneGameData.dropReelsDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
					console.log(`[SlotController] Turbo also applied to scene GameData`);
				}
			}
		} else {
			// Reset to normal speed by calling setSpeed with the original delay
			const originalDelay = 2500; // This should match Data.DELAY_BETWEEN_SPINS
			setSpeed(gameData, originalDelay);
			console.log('[SlotController] Normal speed restored for winline animations');
		}
	}

	/**
	 * Hide the primary controller during bonus mode
	 */
	public hidePrimaryController(): void {
		if (this.primaryControllers) {
			console.log('[SlotController] Hiding primary controller');
			this.primaryControllers.setVisible(false);
		}
		
		// Hide all controller text labels
		this.controllerTexts.forEach(text => {
			text.setVisible(false);
		});
		console.log(`[SlotController] Hiding ${this.controllerTexts.length} controller text labels`);
		
		// Hide amplify description container
		if (this.amplifyDescriptionContainer) {
			this.amplifyDescriptionContainer.setVisible(false);
		 console.log('[SlotController] Hiding amplify description');
		}
		
		// Grey out the feature button
		const featureButton = this.buttons.get('feature');
		if (featureButton) {
			featureButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			featureButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Feature button greyed out and disabled');
		}
		
		// Grey out the bet buttons
		const decreaseBetButton = this.buttons.get('decrease_bet');
		const increaseBetButton = this.buttons.get('increase_bet');
		
		if (decreaseBetButton) {
			decreaseBetButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			decreaseBetButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Decrease bet button greyed out and disabled');
		}
		
		if (increaseBetButton) {
			increaseBetButton.setAlpha(0.3); // Make it semi-transparent/greyed out
			increaseBetButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Increase bet button greyed out and disabled');
		}
		
		// Note: Free spin display will be shown separately with actual scatter data
		console.log('[SlotController] Primary controller hidden, free spin display will be shown separately');
	}

	/**
	 * Hide the primary controller during bonus mode with scatter data
	 */
	public hidePrimaryControllerWithScatter(scatterIndex: number): void {
		// Hide the primary controller first
		this.hidePrimaryController();
		
		// Note: Free spin display will be shown after dialog animations complete
		console.log(`[SlotController] Primary controller hidden for scatter index ${scatterIndex}, free spin display will appear after dialog closes`);
	}

	/**
	 * Show the primary controller after bonus mode ends
	 */
	public showPrimaryController(): void {
		if (this.primaryControllers) {
			console.log('[SlotController] Showing primary controller');
			this.primaryControllers.setVisible(true);
		}
		
		// Show all controller text labels
		this.controllerTexts.forEach(text => {
			text.setVisible(true);
		});
		console.log(`[SlotController] Showing ${this.controllerTexts.length} controller text labels`);
		
		// Show amplify description container
		if (this.amplifyDescriptionContainer) {
			this.amplifyDescriptionContainer.setVisible(true);
			console.log('[SlotController] Showing amplify description');
		}
		
		// Restore the feature button
		const featureButton = this.buttons.get('feature');
		if (featureButton) {
			featureButton.setAlpha(1.0); // Restore full opacity
			featureButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Feature button restored and enabled');
		}
		
		// Restore the bet buttons
		const decreaseBetButton = this.buttons.get('decrease_bet');
		const increaseBetButton = this.buttons.get('increase_bet');
		
		if (decreaseBetButton) {
			decreaseBetButton.setAlpha(1.0); // Restore full opacity
			decreaseBetButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Decrease bet button restored and enabled');
		}
		
		if (increaseBetButton) {
			increaseBetButton.setAlpha(1.0); // Restore full opacity
			increaseBetButton.setInteractive(); // Re-enable clicking
			console.log('[SlotController] Increase bet button restored and enabled');
		}
		
		// Hide the free spin display when bonus mode ends
		this.hideFreeSpinDisplay();
		
		// Clear any pending free spins data
		if (this.pendingFreeSpinsData) {
			console.log('[SlotController] Bonus mode ended - clearing pending free spins data');
			this.pendingFreeSpinsData = null;
		}
	}

	/**
	 * Create the free spin display elements
	 */
	private createFreeSpinDisplay(scene: Scene, assetScale: number): void {
		// Position for free spin display (centrally below control panel)
        const freeSpinX = scene.scale.width * 0.45;
        const freeSpinY = scene.scale.height * 0.81; // Below the control panel
        // Save base for later offsetting
        this.freeSpinBaseX = freeSpinX;
        this.freeSpinBaseY = freeSpinY;
		
		// Create "Remaining" label (first line)
		this.freeSpinLabel = scene.add.text(
			freeSpinX - 20, // Offset to the left to center with the number
			freeSpinY - 15, // First line, positioned above
			'Remaining',
			{
				fontSize: '30px',
				color: '#00ff00', // Bright vibrant green as shown in image
				fontFamily: 'Poppins-Bold',
			}
		).setOrigin(0.5, 0.5).setDepth(15);
		this.controllerContainer.add(this.freeSpinLabel);
		
		// Create "Free Spin : " label (second line)
		this.freeSpinSubLabel = scene.add.text(
			freeSpinX - 15, // Same X position as first line
			freeSpinY + 20, // Second line, positioned below
			'Free Spin : ',
			{
				fontSize: '30px',
				color: '#00ff00', // Bright vibrant green as shown in image
				fontFamily: 'Poppins-Bold',
			}
		).setOrigin(0.5, 0.5).setDepth(15);
		this.controllerContainer.add(this.freeSpinSubLabel);
		
        // Create free spin number display (text, hidden; replaced by digit sprites)
        this.freeSpinNumber = scene.add.text(
            freeSpinX + 110,
            freeSpinY + 5,
            '0',
            { fontSize: '80px', color: '#ffffff', fontFamily: 'Poppins-Bold', }
        ).setOrigin(0.5, 0.5).setDepth(15);
        this.freeSpinNumber.setVisible(false);
        this.controllerContainer.add(this.freeSpinNumber);

        // Create container for digit sprites
        this.freeSpinDigitsContainer = scene.add.container(freeSpinX + 110, freeSpinY + 5);
        this.freeSpinDigitsContainer.setDepth(15);
        this.controllerContainer.add(this.freeSpinDigitsContainer);
		
		// Initially hide the free spin display (only show during bonus mode)
		this.freeSpinLabel.setVisible(false);
		this.freeSpinSubLabel.setVisible(false);
        this.freeSpinNumber.setVisible(false);
        this.freeSpinDigitsContainer.setVisible(false);
		
		console.log('[SlotController] Free spin display created');
        // Apply any configured offset immediately
        this.applyFreeSpinDisplayOffset();
	}

	/**
	 * Show the free spin display with the specified number of spins
	 */
	public showFreeSpinDisplay(spinsRemaining: number): void {
		if (this.freeSpinLabel && this.freeSpinNumber && this.freeSpinSubLabel) {
			this.freeSpinNumber.setText(spinsRemaining.toString());
			this.freeSpinLabel.setVisible(true);
			this.freeSpinSubLabel.setVisible(true);
			this.freeSpinNumber.setVisible(true);
			if (this.freeSpinDigitsContainer) this.freeSpinDigitsContainer.setVisible(false);
			console.log(`[SlotController] Free spin display shown with ${spinsRemaining} spins remaining`);
		}
	}

	/**
	 * Show the free spin display with the actual free spins won from scatter bonus
	 */
	public showFreeSpinDisplayFromScatter(scatterIndex: number): void {
		// The actual free spins value will be passed directly from ScatterAnimationManager
		// This method is called when scatterBonusActivated event is received
		if (this.freeSpinLabel && this.freeSpinNumber && this.freeSpinSubLabel) {
			// Initially show with the scatter index, will be updated with actual value
			this.freeSpinNumber.setText(`Index: ${scatterIndex}`);
			this.freeSpinLabel.setVisible(true);
			this.freeSpinSubLabel.setVisible(true);
			this.freeSpinNumber.setVisible(true);
			console.log(`[SlotController] Free spin display shown for scatter index ${scatterIndex}`);
		}
	}

	/**
	 * Show the free spin display with the actual free spins value
	 */
	public showFreeSpinDisplayWithActualValue(actualFreeSpins: number): void {
		if (this.freeSpinLabel && this.freeSpinNumber && this.freeSpinSubLabel) {
			this.freeSpinNumber.setText(actualFreeSpins.toString());
			this.freeSpinLabel.setVisible(true);
			this.freeSpinSubLabel.setVisible(true);
			this.freeSpinNumber.setVisible(true);
			if (this.freeSpinDigitsContainer) this.freeSpinDigitsContainer.setVisible(false);
			console.log(`[SlotController] Free spin display shown with actual value: ${actualFreeSpins} spins`);
		}
	}

	/**
	 * Update the free spin display with the actual free spins value
	 */
	public updateFreeSpinDisplayWithActualValue(actualFreeSpins: number): void {
		if (this.freeSpinLabel && this.freeSpinNumber && this.freeSpinSubLabel) {
			this.freeSpinNumber.setText(actualFreeSpins.toString());
			console.log(`[SlotController] Free spin display updated with actual value: ${actualFreeSpins} spins`);
		}
	}

    /** Update the free spin number during autoplay (uses digit sprites). */
    public updateFreeSpinNumber(spinsRemaining: number): void {
        if (this.freeSpinNumber) {
            let displayValue = spinsRemaining;
            if (gameStateManager.isBonus && spinsRemaining > 0) {
                displayValue = spinsRemaining;
            }
            this.freeSpinNumber.setText(displayValue.toString());
            this.freeSpinNumber.setVisible(true);
            if (this.freeSpinDigitsContainer) this.freeSpinDigitsContainer.setVisible(false);
            console.log(`[SlotController] Free spin number updated to ${displayValue} (actual: ${spinsRemaining})`);
            // Ensure offset remains applied after updates
            this.applyFreeSpinDisplayOffset();
        }
    }

	/**
 * Disable the autoplay button (grey out and disable interaction)
 */
public disableAutoplayButton(): void {
    const autoplayButton = this.buttons.get('autoplay');
    if (autoplayButton) {
        autoplayButton.setTint(0x666666); // Grey out the button
        autoplayButton.disableInteractive();
        console.log('[SlotController] Autoplay button disabled and greyed out');
    }
}

/**
 * Enable the autoplay button (remove grey tint and enable interaction)
 */
public enableAutoplayButton(): void {
    const autoplayButton = this.buttons.get('autoplay');
    if (autoplayButton) {
        autoplayButton.clearTint(); // Remove grey tint
        autoplayButton.setInteractive();
        console.log('[SlotController] Autoplay button enabled');
    }
}

/**
 * Update autoplay button state based on game conditions
 */
public updateAutoplayButtonState(): void {
    const gameData = this.getGameData();
    if (!gameData || !this.buttons.has('autoplay')) {
        return;
    }

    const autoplayButton = this.buttons.get('autoplay');
    if (!autoplayButton) return;

    		// Disable autoplay button if spinning, enable otherwise
		if (gameStateManager.isReelSpinning) {
			console.log(`[SlotController] Disabling autoplay button - isReelSpinning: ${gameStateManager.isReelSpinning}`);
			this.disableAutoplayButton();
		} else {
			console.log(`[SlotController] Enabling autoplay button - not spinning`);
			this.enableAutoplayButton();
		}
}

	/**
	 * Hide the free spin display
	 */
	public hideFreeSpinDisplay(): void {
		if (this.freeSpinLabel && this.freeSpinNumber && this.freeSpinSubLabel) {
			this.freeSpinLabel.setVisible(false);
			this.freeSpinSubLabel.setVisible(false);
			this.freeSpinNumber.setVisible(false);
            if (this.freeSpinDigitsContainer) {
                this.freeSpinDigitsContainer.setVisible(false);
                // Clear digit sprites
                if (this.freeSpinNumberDigitSprites && this.freeSpinNumberDigitSprites.length) {
                    for (const s of this.freeSpinNumberDigitSprites) { try { s.destroy(); } catch {} }
                    this.freeSpinNumberDigitSprites = [];
                }
            }
			console.log('[SlotController] Free spin display hidden');
		}
	}

	/** Apply configured offset to free spin display elements */
	private applyFreeSpinDisplayOffset(): void {
		try {
			const baseX = this.freeSpinBaseX || 0;
			const baseY = this.freeSpinBaseY || 0;
			const dx = this.freeSpinOffsetX || 0;
			const dy = this.freeSpinOffsetY || 0;
			if (this.freeSpinLabel) {
				this.freeSpinLabel.setPosition(baseX - 20 + dx, baseY - 15 + dy);
			}
			if (this.freeSpinSubLabel) {
				this.freeSpinSubLabel.setPosition(baseX - 15 + dx, baseY + 20 + dy);
			}
			if (this.freeSpinNumber) {
				this.freeSpinNumber.setPosition(baseX + 110 + dx, baseY + 5 + dy);
			}
			if (this.freeSpinDigitsContainer) {
				this.freeSpinDigitsContainer.setPosition(baseX + 110 + dx, baseY + 5 + dy);
			}
		} catch {}
	}

	/** Public setter to move the free spin display block by offset */
	public setFreeSpinDisplayOffset(offsetX: number, offsetY: number): void {
		this.freeSpinOffsetX = offsetX || 0;
		this.freeSpinOffsetY = offsetY || 0;
		this.applyFreeSpinDisplayOffset();
	}

	/**
	 * Update the free spin number display
	 * In bonus mode, decrement the display value by 1 for frontend only
	 */
    // Removed legacy text-based updateFreeSpinNumber (replaced by digit sprites)

	/**
	 * Handle spin logic - either normal API call or free spin simulation
	 */
	private async handleSpin(): Promise<void> {
		// Ensure game token exists; if missing, initialize before spinning
		try {
			if (typeof localStorage !== 'undefined' && !localStorage.getItem('token') && this.gameAPI?.initializeGame) {
				console.warn('[SlotController] No token found. Initializing game token before spin...');
				await this.gameAPI.initializeGame();
			}
		} catch (e) {
			console.warn('[SlotController] Token initialization failed; proceeding with fallback if available.', e);
		}

		if (!this.gameAPI) {
			console.warn('[SlotController] GameAPI not available, falling back to EventBus');
			EventBus.emit('spin');
			return;
		}

		// Guard: ensure sufficient balance before proceeding
		try {
			const currentBalance = this.getBalanceAmount();
			const currentBet = this.getBaseBetAmount() || 0;
			const gd = this.getGameData();
			const totalBetToCharge = gd && gd.isEnhancedBet ? currentBet * 1.25 : currentBet;
			if (currentBalance < totalBetToCharge) {
				console.error(`[SlotController] Insufficient balance for spin: $${currentBalance} < $${totalBetToCharge}`);
				if (this.autoplaySpinsRemaining > 0 || this.gameData?.isAutoPlaying || gameStateManager.isAutoPlaying) {
					this.stopAutoplay();
				}
				this.showOutOfBalancePopup();
				this.enableSpinButton();
				this.enableAutoplayButton();
				this.enableBetButtons();
				this.enableFeatureButton();
				this.enableAmplifyButton();
				return;
			}
		} catch {}

		// Play spin sound effect
		if ((window as any).audioManager) {
			(window as any).audioManager.playSoundEffect(SoundEffectType.SPIN);
			console.log('[SlotController] Playing spin sound effect');
		}

		// Decrement balance by bet amount (frontend only)
		this.decrementBalanceByBet();

		try {
			let spinData: SpinData | null = null;

			// Check if we're in bonus mode and use free spin simulation
			if (gameStateManager.isBonus) {
				// Guard: ensure valid free spin data exists and there are remaining spins; otherwise fall back to normal spin
				const current = this.gameAPI.getCurrentSpinData();
				const fs = current?.slot?.freespin || current?.slot?.freeSpin;
				const hasFsItems = Array.isArray(fs?.items) && fs!.items.length > 0;
				const hasRemainingFs = hasFsItems ? fs!.items.some((it: any) => (it?.spinsLeft || 0) > 0) : false;
				if (!hasFsItems || !hasRemainingFs) {
					console.log('[SlotController] Bonus flag set but no usable free spin data/remaining spins; falling back to normal spin');
					gameStateManager.isBonus = false;
					gameStateManager.isBonusFinished = false;
				} else {
					console.log('[SlotController] In bonus mode - using free spin simulation...');
					spinData = await this.gameAPI.simulateFreeSpin();
					
					// Update free spin display with remaining count from Symbols component
					const gameScene = this.scene as any; // Cast to access symbols property
					if (gameScene.symbols && gameScene.symbols.freeSpinAutoplaySpinsRemaining !== undefined) {
						this.updateFreeSpinNumber(gameScene.symbols.freeSpinAutoplaySpinsRemaining);
						console.log(`[SlotController] Updated free spin display to ${gameScene.symbols.freeSpinAutoplaySpinsRemaining} remaining`);
						
						// Check if there are any more free spins available
						const hasMoreFreeSpins = spinData.slot.freespin.items.some((item: any) => item.spinsLeft > 0);
						if (!hasMoreFreeSpins) {
							// No more free spins - end bonus mode
							console.log('[SlotController] No more free spins available - ending bonus mode');
							gameStateManager.isBonus = false;
							gameStateManager.isBonusFinished = true;
							// Emit event to show primary controller and hide bonus components
							if (this.scene) {
								this.scene.events.emit('setBonusMode', false);
							}
						}
					} else {
						// No more free spins - end bonus mode
						console.log('[SlotController] No more free spins - ending bonus mode');
						gameStateManager.isBonus = false;
						gameStateManager.isBonusFinished = true;
						// Emit event to show primary controller and hide bonus components
						if (this.scene) {
							this.scene.events.emit('setBonusMode', false);
						}
					}
				}
			}
			if (!spinData) {
				console.log('[SlotController] Normal mode - calling GameAPI.doSpin...');
				// Use base bet amount for API calls (without amplify bet increase)
				const currentBet = this.getBaseBetAmount() || 10;
				const gameData = this.getGameData();
				const isEnhancedBet = gameData ? gameData.isEnhancedBet : false;
				spinData = await this.gameAPI.doSpin(currentBet, false, isEnhancedBet);
				console.log('[SlotController] Spin data:', spinData);
			}

			// Display comprehensive spin data information
			if (!spinData) {
				console.error('[SlotController] No spin data available after spin attempt');
				return;
			}
			console.log('[SlotController] 🎰 ===== SPIN DATA RECEIVED =====');
			console.log('[SlotController] 📊 Basic Info:');
			console.log('  - Player ID:', spinData.playerId);
			console.log('  - Bet Amount:', spinData.bet);
			console.log('  - Total Win:', SpinDataUtils.getTotalWin(spinData));
			console.log('  - Has Wins:', SpinDataUtils.hasWins(spinData));
			console.log('  - Has Free Spins:', SpinDataUtils.hasFreeSpins(spinData));
			console.log('  - Win Multiplier:', SpinDataUtils.getWinMultiplier(spinData));
			
			console.log('[SlotController] 🎯 Grid Layout (3x5):');
			if (spinData.slot?.area) {
				for (let row = 0; row < spinData.slot.area.length; row++) {
					console.log(`  Row ${row}: [${spinData.slot.area[row].join(', ')}]`);
				}
			} else {
				console.log('  No area data available');
			}
			
			console.log('[SlotController] 💎 Paylines:');
			if (spinData.slot?.paylines && spinData.slot.paylines.length > 0) {
				spinData.slot.paylines.forEach((payline, index) => {
					console.log(`  Payline ${index}:`, {
						lineKey: payline.lineKey,
						symbol: payline.symbol,
						count: payline.count,
						win: payline.win,
						multipliers: payline.multipliers
					});
				});
			} else {
				console.log('  No paylines data available');
			}
			
			console.log('[SlotController] 🎁 Free Spins Info:');
			if (spinData.slot?.freespin) {
				console.log(`  - Count: ${spinData.slot.freespin.count}`);
				console.log(`  - Total Win: ${spinData.slot.freespin.totalWin}`);
				console.log(`  - Items: ${spinData.slot.freespin.items.length} items`);
			} else {
				console.log('  No free spins data available');
			}
			
			console.log('[SlotController] 🎰 ===== END SPIN DATA =====');
			
			// Emit the spin data response event
			gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, {
				spinData: spinData
			});

		} catch (error) {
			console.error('[SlotController] ❌ Spin failed:', error);
			// Fallback: if free spin simulation failed due to no data, try a normal spin
			try {
				if (gameStateManager.isBonus) {
					console.log('[SlotController] Free spin simulation failed; clearing bonus flag and attempting normal spin');
					gameStateManager.isBonus = false;
				}
				const currentBet = this.getBaseBetAmount() || 10;
				const gameData = this.getGameData();
				const isEnhancedBet = gameData ? gameData.isEnhancedBet : false;
				const fallbackSpinData = await this.gameAPI.doSpin(currentBet, false, isEnhancedBet);
				gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, { spinData: fallbackSpinData });
				return;
			} catch (fallbackError) {
				console.error('[SlotController] ❌ Fallback normal spin failed:', fallbackError);
				// Offline/dev fallback: generate a local spin and emit SPIN_DATA_RESPONSE
				try {
					const generator = new SymbolGenerator();
					const colsByRows = generator.generate(); // [columns][rows]
					const rows: number[][] = [];
					const numRows = colsByRows[0]?.length || 0;
					const numCols = colsByRows.length;
					for (let r = 0; r < numRows; r++) {
						const row: number[] = [];
						for (let c = 0; c < numCols; c++) {
							row.push(colsByRows[c][r]);
						}
						rows.push(row);
					}
					const currentBetStr = (this.getBaseBetAmount?.() || 10).toString();
					const localSpinData: any = {
						playerId: 'local',
						bet: currentBetStr,
						slot: {
							area: rows,
							paylines: [],
							freespin: { count: 0, totalWin: 0, items: [] }
						}
					};
					console.warn('[SlotController] Using local fallback spin data');
					gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, { spinData: localSpinData });
					return;
				} catch (localError) {
					console.error('[SlotController] Local fallback spin generation failed:', localError);
					// As a last resort, restore controls so the UI is not stuck
					this.enableSpinButton();
					this.enableAutoplayButton();
					this.enableBetButtons();
					this.enableAmplifyButton();
				}
			}
		}
	}

	/**
	 * Show the buy feature drawer
	 */
	private showBuyFeatureDrawer(): void {
		console.log('[SlotController] Showing buy feature drawer');
		
		if (!this.buyFeature) {
			console.warn('[SlotController] Buy feature component not initialized');
			return;
		}
		
		// Lock buy feature to prevent spamming while drawer is open/processing
		this.isBuyFeatureLocked = true;
		
		// Show the buy feature drawer
		this.buyFeature.show({
			featurePrice: 24000.00, // Default feature price
			onClose: () => {
				console.log('[SlotController] Buy feature drawer closed');
				// Unlock when drawer is closed without purchase
				this.isBuyFeatureLocked = false;
			},
			onConfirm: () => {
				console.log('[SlotController] Buy feature confirmed');
				// Ensure symbols container is above reel background; full reset/visibility will happen on SPIN event
				try {
					const gameScene: any = this.scene as any;
					const symbols = gameScene?.symbols;
					symbols?.restoreSymbolsAboveReelBg?.();
				} catch {}
				// Immediately disable interactions to prevent other actions
				this.disableSpinButton();
				this.disableAutoplayButton();
				this.disableFeatureButton();
				this.disableBetButtons();
				this.disableAmplifyButton();
				this.handleBuyFeature();
				// Unlock after starting buy feature processing; spin lock will protect spin flow
				this.isBuyFeatureLocked = false;
			}
		});
	}

	/**
	 * Handle buy feature purchase
	 */
	private async handleBuyFeature(): Promise<void> {
		console.log('[SlotController] Processing buy feature purchase');
		
		if (!this.buyFeature || !this.gameAPI) {
			console.error('[SlotController] Buy feature or GameAPI not available');
			return;
		}
		
		try {
			// Get the current bet from BuyFeature
			const buyFeatureBet = this.buyFeature.getCurrentBetAmount();
			const calculatedPrice = buyFeatureBet * 100; // Same multiplier as BuyFeature uses
			
			// Do NOT sync main BET with Buy Feature selection to keep them independent
			
			console.log(`[SlotController] Buy feature bet: $${buyFeatureBet.toFixed(2)}, calculated price: $${calculatedPrice.toFixed(2)}`);
			
			// Check if player has enough balance
			const currentBalance = this.getBalanceAmount();
			if (currentBalance < calculatedPrice) {
				console.error(`[SlotController] Insufficient balance: $${currentBalance.toFixed(2)} < $${calculatedPrice.toFixed(2)}`);
				// Re-enable controls since purchase cannot proceed
				this.enableSpinButton();
				this.enableAutoplayButton();
				this.enableFeatureButton();
				this.enableBetButtons();
				this.enableAmplifyButton();
				this.showOutOfBalancePopup();
				return;
			}
			
			// Deduct the calculated price from balance (frontend only)
			const newBalance = currentBalance - calculatedPrice;
			this.updateBalanceAmount(newBalance);
			console.log(`[SlotController] Balance deducted: $${currentBalance.toFixed(2)} -> $${newBalance.toFixed(2)}`);
			
			// Ensure turbo effects are applied for buy feature flow if turbo is ON
			try {
				this.forceApplyTurboToSceneGameData();
				this.applyTurboToWinlineAnimations();
			} catch {}
			
			// Call doSpin with buy feature parameters
			console.log('[SlotController] Calling doSpin for buy feature...');
			const spinData = await this.gameAPI.doSpin(buyFeatureBet, true, false); // isBuyFs: true, isEnhancedBet: false
			
			console.log('[SlotController] Buy feature spin completed:', spinData);
			
			// Note: Do not disable turbo during buy feature scatter; honor user's turbo setting
			
			// Process the spin result (same as normal spin)
			if (spinData) {
				// Emit spin data response event to trigger game logic
				gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, { spinData });
			}
			
		} catch (error) {
			console.error('[SlotController] Error processing buy feature purchase:', error);
			// Re-enable controls on error to avoid locking the UI
			this.enableSpinButton();
			this.enableAutoplayButton();
			this.enableFeatureButton();
			this.enableBetButtons();
			this.enableAmplifyButton();
			// TODO: Show error message to user and restore balance if needed
		}
	}

	/**
	 * Update balance from server using getBalance API
	 */
	private async updateBalanceFromServer(): Promise<void> {
		try {
			console.log('[SlotController] 💰 Updating balance from server after reels stopped...');
			
			if (!this.gameAPI) {
				console.warn('[SlotController] GameAPI not available for balance update');
				return;
			}
			
			const balanceResponse = await this.gameAPI.getBalance();
			console.log('[SlotController] Balance response received:', balanceResponse);
			
			// Extract balance from response - adjust this based on actual API response structure
			let newBalance = 0;
			if (balanceResponse && balanceResponse.data && balanceResponse.data.balance !== undefined) {
				newBalance = parseFloat(balanceResponse.data.balance);
			} else if (balanceResponse && balanceResponse.balance !== undefined) {
				newBalance = parseFloat(balanceResponse.balance);
			} else {
				console.warn('[SlotController] Unexpected balance response structure:', balanceResponse);
				return;
			}
			
			const oldBalance = this.getBalanceAmount();
			console.log(`[SlotController] 💰 Server balance update: $${oldBalance} -> $${newBalance}`);
			
			// Update the balance display
			this.updateBalanceAmount(newBalance);
			if (newBalance <= 0) {
				this.showOutOfBalancePopup();
			}
			
			console.log('[SlotController] ✅ Balance updated from server successfully');
			
		} catch (error) {
			console.error('[SlotController] ❌ Error updating balance from server:', error);
		}
	}

	/**
	 * Setup bonus mode event listener to hide/show primary controller
	 */
	private setupBonusModeEventListener(): void {
		if (!this.scene) {
			console.warn('[SlotController] Cannot setup bonus mode listener - scene not available');
			return;
		}

		console.log('[SlotController] Setting up bonus mode event listener');
		
		// Listen for bonus mode events from the scene
		this.scene.events.on('setBonusMode', (isBonus: boolean) => {
			if (isBonus) {
				console.log('[SlotController] Bonus mode activated - hiding primary controller');
				this.hidePrimaryController();
				// Always keep the buy feature disabled during bonus mode
				this.canEnableFeatureButton = false;
				this.disableFeatureButton();
			} else {
				console.log('[SlotController] Bonus mode deactivated - showing primary controller');
				this.showPrimaryController();
				// Force clear scatter/bonus blockers to ensure spin is allowed
				try {
					gameStateManager.isScatter = false;
					gameStateManager.isReelSpinning = false;
				} catch {}
				// Clear any pending free spins data when bonus mode ends
				if (this.pendingFreeSpinsData) {
					console.log('[SlotController] Bonus mode ended - clearing pending free spins data');
					this.pendingFreeSpinsData = null;
				}
				// Allow feature button to be enabled again (now that bonus is off)
				this.canEnableFeatureButton = true;
				// Re-enable buy feature only after bonus is fully deactivated
				this.enableFeatureButton();
				// Ensure all primary controls are interactive again when returning to base game
				try {
					this.enableSpinButton();
					this.enableAutoplayButton();
					this.enableBetButtons();
					this.enableAmplifyButton();
					this.enableTurboButton();
					// Restore turbo visual state to current setting
					const gd = this.getGameData();
					if (gd) {
						this.setTurboButtonState(!!gd.isTurbo);
						// Re-apply turbo to symbols/winlines and scene GameData after mode transitions
						this.forceApplyTurboToSceneGameData();
						this.applyTurboToWinlineAnimations();
					}
					this.updateAutoplayButtonState && this.updateAutoplayButtonState();
					console.log('[SlotController] Restored interactivity for spin, autoplay, bet, and amplify buttons after bonus');
				} catch (e) {
					console.warn('[SlotController] Failed to restore controller interactivity after bonus:', e);
				}
			}
		});

		// Disable controls immediately when scatter anticipation/transition starts
		this.scene.events.on('scatterTransitionStart', () => {
			console.log('[SlotController] scatterTransitionStart received - disabling controls');
			this.disableSpinButton();
			this.disableAutoplayButton();
			this.disableAmplifyButton();
			this.disableBetButtons();
			this.disableTurboButton();
			this.disableFeatureButton();
		});

		// Listen for scatter bonus events with scatter index and actual free spins
		this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
			console.log(`[SlotController] scatterBonusActivated event received with data:`, data);
			console.log(`[SlotController] Data validation: scatterIndex=${data.scatterIndex}, actualFreeSpins=${data.actualFreeSpins}`);
			
			// Stop normal autoplay when scatter is hit
			if (this.autoplaySpinsRemaining > 0) {
				console.log(`[SlotController] Scatter hit during autoplay - stopping normal autoplay (${this.autoplaySpinsRemaining} spins remaining)`);
				this.stopAutoplay();
			}
			
			// Keep controls disabled/greyed out while scatter/bonus sequence proceeds
			this.disableSpinButton();
			this.disableAutoplayButton();
			this.disableAmplifyButton();
			
			console.log(`[SlotController] Scatter bonus activated with index ${data.scatterIndex} and ${data.actualFreeSpins} free spins - hiding primary controller, free spin display will appear after dialog closes`);
			this.hidePrimaryControllerWithScatter(data.scatterIndex);
			// Store the free spins data for later display after dialog closes
			this.pendingFreeSpinsData = data;
		});

		// Listen for dialog animations completion to show free spin display (only if not already visible)
		this.scene.events.on('dialogAnimationsComplete', () => {
			console.log('[SlotController] Dialog animations completed - checking if free spin display should be shown');
			console.log('[SlotController] Current pendingFreeSpinsData:', this.pendingFreeSpinsData);
			// If there is no pending data, do nothing
			if (!this.pendingFreeSpinsData) {
				console.log('[SlotController] No pending free spins data - free spin display not shown');
				return;
			}
			// If display is already visible (e.g., shown by ScatterWinOverlay), avoid re-showing and clear pending
			const alreadyVisible = !!(this.freeSpinLabel?.visible || this.freeSpinNumber?.visible || this.freeSpinDigitsContainer?.visible);
			if (alreadyVisible) {
				console.log('[SlotController] Free spin display already visible - clearing pending data and skipping re-show');
				this.pendingFreeSpinsData = null;
				return;
			}
			console.log(`[SlotController] Showing free spin display with ${this.pendingFreeSpinsData.actualFreeSpins} spins after dialog closed`);
			this.showFreeSpinDisplayWithActualValue(this.pendingFreeSpinsData.actualFreeSpins);
			this.pendingFreeSpinsData = null;
		});

		// When scatter sequence fully completes, clear scatter flag and re-enable controls if not in bonus
		this.scene.events.on('scatterBonusCompleted', () => {
			try {
				console.log('[SlotController] scatterBonusCompleted received');
				gameStateManager.isScatter = false;
				if (!gameStateManager.isBonus) {
					this.showPrimaryController();
					this.enableSpinButton();
					this.enableAutoplayButton();
					this.enableBetButtons();
					this.enableAmplifyButton();
					this.enableTurboButton();
					this.enableFeatureButton();
					this.updateAutoplayButtonState && this.updateAutoplayButtonState();
					// Re-apply turbo settings after scatter flow in case they were affected by animations
					this.forceApplyTurboToSceneGameData();
					this.applyTurboToWinlineAnimations();
					console.log('[SlotController] Re-enabled controls after scatter completion');
				} else {
					console.log('[SlotController] Bonus active after scatter completion - keeping controls hidden');
				}
			} catch (e) {
				console.warn('[SlotController] Error handling scatterBonusCompleted:', e);
			}
		});

		// Listen for free spin autoplay events
		gameEventManager.on(GameEventType.FREE_SPIN_AUTOPLAY, async () => {
			console.log('[SlotController] FREE_SPIN_AUTOPLAY event received - triggering free spin simulation');
			// Trigger same white overlay flash for bonus spins
			// Ensure symbols are above background at the immediate start of the free spin
			try {
				const symbolsComponent = (this.scene as any)?.symbols;
				if (symbolsComponent) {
					try { symbolsComponent.restoreSymbolsAboveReelBg?.(); } catch {}
				}
			} catch {}
			
			// Apply turbo mode to game data and winlines (same as normal autoplay)
			this.forceApplyTurboToSceneGameData();
			this.applyTurboToWinlineAnimations();
			
			if (gameStateManager.isBonus && this.gameAPI && this.symbols) {
				try {
					// Get free spin data from GameAPI directly (this should have the original scatter data)
					const gameAPISpinData = this.gameAPI.getCurrentSpinData();
					if (gameAPISpinData && (gameAPISpinData.slot?.freespin?.items || gameAPISpinData.slot?.freeSpin?.items)) {
						console.log('[SlotController] Found free spin data in GameAPI');
						const freespinData = gameAPISpinData.slot?.freespin || gameAPISpinData.slot?.freeSpin;
						console.log('[SlotController] GameAPI currentSpinData has freespin:', !!gameAPISpinData.slot?.freespin);
						console.log('[SlotController] GameAPI currentSpinData has freeSpin:', !!gameAPISpinData.slot?.freeSpin);
						console.log('[SlotController] GameAPI currentSpinData has items:', !!freespinData?.items);
						console.log('[SlotController] GameAPI currentSpinData items count:', freespinData?.items?.length);
					} else {
						console.error('[SlotController] No free spin data available in GameAPI');
						console.error('[SlotController] GameAPI currentSpinData:', gameAPISpinData);
						console.error('[SlotController] GameAPI currentSpinData.slot:', gameAPISpinData?.slot);
						console.error('[SlotController] GameAPI currentSpinData.slot.freespin:', gameAPISpinData?.slot?.freespin);
						console.error('[SlotController] GameAPI currentSpinData.slot.freeSpin:', gameAPISpinData?.slot?.freeSpin);
						console.error('[SlotController] GameAPI currentSpinData.slot.freespin.items:', gameAPISpinData?.slot?.freespin?.items);
						console.error('[SlotController] GameAPI currentSpinData.slot.freeSpin.items:', gameAPISpinData?.slot?.freeSpin?.items);
						return;
					}
					
					// Use our free spin simulation
					const spinData = await this.gameAPI.simulateFreeSpin();
					
					// Update free spin display with remaining count from Symbols component
					const gameScene = this.scene as any; // Cast to access symbols property
					if (gameScene.symbols && gameScene.symbols.freeSpinAutoplaySpinsRemaining !== undefined) {
						this.updateFreeSpinNumber(gameScene.symbols.freeSpinAutoplaySpinsRemaining);
						console.log(`[SlotController] Updated free spin display to ${gameScene.symbols.freeSpinAutoplaySpinsRemaining} remaining`);
						
						// Check if there are any more free spins available
						const freespinData = spinData.slot?.freespin || spinData.slot?.freeSpin;
						const hasMoreFreeSpins = freespinData?.items?.some(item => item.spinsLeft > 0);
						if (!hasMoreFreeSpins) {
							// No more free spins - end bonus mode
							console.log('[SlotController] No more free spins available - ending bonus mode');
							gameStateManager.isBonus = false;
							gameStateManager.isBonusFinished = true;
							// Emit event to show primary controller and hide bonus components
							if (this.scene) {
								this.scene.events.emit('setBonusMode', false);
							}
						}
					} else {
						// No more free spins - end bonus mode
						console.log('[SlotController] No more free spins - ending bonus mode');
						gameStateManager.isBonus = false;
						gameStateManager.isBonusFinished = true;
						// Emit event to show primary controller and hide bonus components
						if (this.scene) {
							this.scene.events.emit('setBonusMode', false);
						}
					}

					// Process the spin data directly for free spin autoplay
					if (this.scene && (this.scene as any).symbols) {
						const symbolsComponent = (this.scene as any).symbols;
						if (symbolsComponent && typeof symbolsComponent.processSpinData === 'function') {
							console.log('[SlotController] Processing free spin data directly via symbols component');
							symbolsComponent.processSpinData(spinData);
						} else {
							console.log('[SlotController] Symbols component not available, falling back to SPIN_DATA_RESPONSE');
							gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, {
								spinData: spinData
							});
						}
					} else {
						console.log('[SlotController] Scene or symbols not available, falling back to SPIN_DATA_RESPONSE');
						gameEventManager.emit(GameEventType.SPIN_DATA_RESPONSE, {
							spinData: spinData
						});
					}

				} catch (error) {
					console.error('[SlotController] Free spin simulation failed:', error);
				}
			} else {
				console.warn('[SlotController] Not in bonus mode or GameAPI not available for free spin autoplay');
			}
		});

		// Listen for scatter bonus activation to reset free spin index
		this.scene.events.on('scatterBonusActivated', () => {
			console.log('[SlotController] Scatter bonus activated - resetting free spin index');
			if (this.gameAPI) {
				this.gameAPI.resetFreeSpinIndex();
			}
		});

		console.log('[SlotController] Bonus mode event listener setup complete');
	}

	/**
	 * Setup spin state change listener
	 */
	private setupSpinStateListener(): void {
		if (!this.gameData) {
			console.warn('[SlotController] GameData not available for spin state listener');
			return;
		}

		// No more polling - we'll manage button state purely through events
		console.log('[SlotController] Spin state listener setup complete - no polling');
	}

	/**
	 * Refresh the GameData reference from the scene
	 */
	private refreshGameDataReference(): void {
		if (this.scene && this.scene.scene.key === 'Game') {
			const newGameData = (this.scene as any).gameData;
			if (newGameData && newGameData !== this.gameData) {
				console.log('[SlotController] Refreshing GameData reference');
				this.gameData = newGameData;
			}
		}
	}

	/**
	 * Get the current GameData instance, refreshing if needed
	 */
	private getGameData(): GameData | null {
		if (!this.gameData) {
			this.refreshGameDataReference();
		}
		return this.gameData;
	}

	/**
	 * Disable the spin button
	 */
	public disableSpinButton(): void {
		const spinButton = this.buttons.get('spin');
		if (spinButton) {
			spinButton.setTint(0x666666); // Gray out the button
			spinButton.disableInteractive();
			// Dim and pause icon animation
			if (this.spinIcon) {
				this.spinIcon.setAlpha(0.5);
			}
			if (this.spinIconTween) {
				this.spinIconTween.pause();
			}
		}
	}

	/**
	 * Enable the spin button
	 */
	public enableSpinButton(): void {
		const spinButton = this.buttons.get('spin');
		if (spinButton) {
			// Safety guard: never enable spin while reels are spinning or while a spin is locked
			if (this.isSpinLocked || gameStateManager.isReelSpinning) {
				console.log('[SlotController] enableSpinButton skipped - isSpinLocked or reels still spinning');
				spinButton.disableInteractive();
				return;
			}
			spinButton.clearTint(); // Remove gray tint
			spinButton.setInteractive();
			console.log('[SlotController] Spin button enabled');
			// Restore icon animation
			if (this.spinIcon) {
				this.spinIcon.setAlpha(1);
			}
			if (this.spinIconTween) {
				this.spinIconTween.resume();
			}
		}
	}

	/**
	 * Public method to manually update spin button state
	 */
	public updateSpinButtonState(): void {
		const gameData = this.getGameData();
		if (!gameData || !this.buttons.has('spin')) {
			return;
		}

		const spinButton = this.buttons.get('spin');
		if (!spinButton) return;

		if(gameData.isAutoPlaying){
			this.disableSpinButton();
			return;
		}


		// Simple logic: disable if spinning or autoplay active, enable otherwise
		if (gameData.isAutoPlaying || gameStateManager.isReelSpinning) {
			console.log(`[SlotController] Disabling spin button - isReelSpinning: ${gameStateManager.isReelSpinning}, isAutoPlaying: ${gameData.isAutoPlaying}`);
			this.disableSpinButton();
		} else {
			console.log(`[SlotController] Enabling spin button - no active game state`);
			this.enableSpinButton();
		}
	}

	/**
	 * Get the current state of the spin button
	 */
	public isSpinButtonEnabled(): boolean {
		const spinButton = this.buttons.get('spin');
		return spinButton ? spinButton.input?.enabled || false : false;
	}

	/**
	 * Force refresh the spin button state
	 */
	public refreshSpinButtonState(): void {
		this.updateSpinButtonState();
	}

	/**
	 * Re-enable the spin button (force enable regardless of state)
	 */
	public reEnableSpinButton(): void {
		console.log('[SlotController] Force re-enabling spin button');
		
		// Log current state for debugging
		const gameData = this.getGameData();
		if (gameData) {
			console.log(`[SlotController] Current state when re-enabling: isReelSpinning=${gameStateManager.isReelSpinning}, isAutoPlaying=${gameData.isAutoPlaying}`);
		}
		
		// Simply enable the button
		this.enableSpinButton();
		console.log('[SlotController] Spin button re-enabled');
	}

	/**
	 * Manually trigger spin button state update (useful for external components)
	 */
	public forceUpdateSpinButtonState(): void {
		console.log('[SlotController] Force updating spin button state');
		this.updateSpinButtonState();
	}

	/**
	 * Get current state information for debugging
	 */
	public getSpinButtonStateInfo(): string {
		const gameData = this.getGameData();
		if (!gameData) {
			return 'GameData not available';
		}
		
		const isEnabled = this.isSpinButtonEnabled();
		return `Spin Button: ${isEnabled ? 'ENABLED' : 'DISABLED'} | isReelSpinning: ${gameStateManager.isReelSpinning} | isAutoPlaying: ${gameData.isAutoPlaying}`;
	}

	/**
	 * Get current GameData animation timing values for debugging
	 */
	public getGameDataAnimationInfo(): string {
		const gameData = this.getGameData();
		if (!gameData) {
			return 'GameData not available';
		}
		
		return `GameData Animation Values: winUpDuration=${gameData.winUpDuration}, dropDuration=${gameData.dropDuration}, dropReelsDelay=${gameData.dropReelsDelay}, dropReelsDuration=${gameData.dropReelsDuration}, isTurbo=${gameData.isTurbo}`;
	}

	/**
	 * Force apply turbo speed to scene GameData (used by Symbols component)
	 */
	public forceApplyTurboToSceneGameData(): void {
		if (!this.scene || !(this.scene as any).gameData) {
			console.warn('[SlotController] Scene or scene GameData not available');
			return;
		}

		const sceneGameData = (this.scene as any).gameData;
		const gameData = this.getGameData();
		
		if (gameData) {
			if (gameData.isTurbo) {
				console.log('[SlotController] Force applying turbo to scene GameData');
				
				// Apply turbo speed to scene GameData
				sceneGameData.winUpDuration = sceneGameData.winUpDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
				sceneGameData.dropDuration = sceneGameData.dropDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
				sceneGameData.dropReelsDelay = sceneGameData.dropReelsDelay * TurboConfig.TURBO_SPEED_MULTIPLIER;
				sceneGameData.dropReelsDuration = sceneGameData.dropReelsDuration * TurboConfig.TURBO_SPEED_MULTIPLIER;
				
				console.log(`[SlotController] Scene GameData turbo applied:`);
				console.log(`  winUpDuration: ${sceneGameData.winUpDuration}`);
				console.log(`  dropDuration: ${sceneGameData.dropDuration}`);
				console.log(`  dropReelsDelay: ${sceneGameData.dropReelsDelay}`);
				console.log(`  dropReelsDuration: ${sceneGameData.dropReelsDuration}`);
			} else {
				console.log('[SlotController] Resetting scene GameData to normal speed');
				
				// Reset to normal speed by calling setSpeed with the original delay
				const originalDelay = 2500; // This should match Data.DELAY_BETWEEN_SPINS
				setSpeed(sceneGameData, originalDelay);
				
				console.log(`[SlotController] Scene GameData reset to normal speed:`);
				console.log(`  winUpDuration: ${sceneGameData.winUpDuration}`);
				console.log(`  dropDuration: ${sceneGameData.dropDuration}`);
				console.log(`  dropReelsDelay: ${sceneGameData.dropReelsDelay}`);
				console.log(`  dropReelsDuration: ${sceneGameData.dropReelsDuration}`);
			}
		}
	}

	/**
	 * Apply turbo mode to winline animations via Symbols component
	 */
	public applyTurboToWinlineAnimations(): void {
		if (!this.scene) {
			console.warn('[SlotController] Scene not available for winline turbo');
			return;
		}

		// Try to access the Symbols component from the scene
		const symbolsComponent = (this.scene as any).symbols;
		if (symbolsComponent && typeof symbolsComponent.setTurboMode === 'function') {
			const gameData = this.getGameData();
			if (gameData) {
				symbolsComponent.setTurboMode(gameData.isTurbo);
				console.log(`[SlotController] Turbo mode ${gameData.isTurbo ? 'enabled' : 'disabled'} for winline animations via Symbols component`);
			}
		} else {
			console.warn('[SlotController] Symbols component or setTurboMode method not available');
		}
	}

	/**
	 * Reset winline animations to default timing via Symbols component
	 */
	public resetWinlineTiming(): void {
		if (!this.scene) {
			console.warn('[SlotController] Scene not available for winline timing reset');
			return;
		}

		// Try to access the Symbols component from the scene
		const symbolsComponent = (this.scene as any).symbols;
		if (symbolsComponent && typeof symbolsComponent.resetWinlineTiming === 'function') {
			symbolsComponent.resetWinlineTiming();
			console.log('[SlotController] Winline timing reset to default values via Symbols component');
		} else {
			console.warn('[SlotController] Symbols component or resetWinlineTiming method not available');
		}
	}

	/**
	 * Clear any pending balance updates
	 */
	public clearPendingBalanceUpdate(): void {
		if (this.pendingBalanceUpdate) {
			console.log('[SlotController] Clearing pending balance update:', this.pendingBalanceUpdate);
			this.pendingBalanceUpdate = null;
		}
	}

	/**
	 * Get current pending balance update for debugging
	 */
	public getPendingBalanceUpdate(): { balance: number; bet: number; winnings?: number } | null {
		return this.pendingBalanceUpdate;
	}

	/**
	 * Check if there are pending balance updates
	 */
	public hasPendingBalanceUpdate(): boolean {
		return this.pendingBalanceUpdate !== null;
	}

	/**
	 * Check if there are pending winnings to be added
	 */
	public hasPendingWinnings(): boolean {
		return this.pendingBalanceUpdate?.winnings !== undefined && this.pendingBalanceUpdate.winnings > 0;
	}

	/**
	 * Get the amount of pending winnings
	 */
	public getPendingWinnings(): number {
		return this.pendingBalanceUpdate?.winnings || 0;
	}

	/**
	 * Force apply pending balance update (useful for debugging or special cases)
	 */
	public forceApplyPendingBalanceUpdate(): void {
		if (this.pendingBalanceUpdate) {
			console.log('[SlotController] Force applying pending balance update:', this.pendingBalanceUpdate);
			
			// Update balance display
			if (this.pendingBalanceUpdate.balance !== undefined) {
				const oldBalance = this.getBalanceAmountText();
				this.updateBalanceAmount(this.pendingBalanceUpdate.balance);
				
				if (this.pendingBalanceUpdate.winnings && this.pendingBalanceUpdate.winnings > 0) {
					console.log(`[SlotController] Balance force updated: ${oldBalance} -> ${this.pendingBalanceUpdate.balance} (added winnings: ${this.pendingBalanceUpdate.winnings})`);
				} else {
					console.log(`[SlotController] Balance force updated: ${oldBalance} -> ${this.pendingBalanceUpdate.balance}`);
				}
			}
			
			// Update bet display
			if (this.pendingBalanceUpdate.bet !== undefined) {
				this.updateBetAmount(this.pendingBalanceUpdate.bet);
				console.log('[SlotController] Bet force updated:', this.pendingBalanceUpdate.bet);
			}
			
			// Clear the pending update
			this.pendingBalanceUpdate = null;
		} else {
			console.log('[SlotController] No pending balance update to force apply');
		}
	}

	/**
	 * Log current state for debugging
	 */
	public logCurrentState(): void {
		const gameData = this.getGameData();
		if (!gameData) {
			console.log('[SlotController] GameData not available');
			return;
		}
		
		console.log(`[SlotController] Current State:`, {
			spinButtonEnabled: this.isSpinButtonEnabled(),
			isSpinning: gameData.isReelSpinning,
			isAutoPlaying: gameData.isAutoPlaying,
			hasSpinButton: this.buttons.has('spin'),
			pendingBalanceUpdate: this.pendingBalanceUpdate
		});
	}

	/**
	 * Start the turbo button animation (looping)
	 */
	private startTurboAnimation(): void {
		// Ensure the animation exists
		this.ensureTurboAnimationExists();
		
		if (!this.turboButtonAnimation) {
			console.warn('[SlotController] Turbo button animation not available');
			return;
		}

		try {
			// Show the animation
			this.turboButtonAnimation.setVisible(true);
			
			// Start looping animation following the same pattern as kobi-ass
			// Use animationState.setAnimation with loop = true for continuous looping
			this.turboButtonAnimation.animationState.setAnimation(0, "animation", true);
			
			console.log('[SlotController] Turbo button spine animation started (looping)');
		} catch (error) {
			console.error('[SlotController] Error starting turbo button animation:', error);
		}
	}

	/**
	 * Stop the turbo button animation
	 */
	private stopTurboAnimation(): void {
		if (!this.turboButtonAnimation) {
			console.warn('[SlotController] Turbo button animation not available');
			return;
		}

		try {
			// Hide the animation
			this.turboButtonAnimation.setVisible(false);
			
			// Stop the animation
			this.turboButtonAnimation.animationState.clearTracks();
			
			console.log('[SlotController] Turbo button spine animation stopped');
		} catch (error) {
			console.error('[SlotController] Error stopping turbo button animation:', error);
		}
	}

	/**
	 * Ensure the turbo animation exists and recreate if needed
	 */
	private ensureTurboAnimationExists(): void {
		if (!this.turboButtonAnimation && this.scene) {
			console.log('[SlotController] Turbo animation not found, recreating...');
			const screenConfig = this.screenModeManager.getScreenConfig();
			const assetScale = this.networkManager.getAssetScale();
			this.createTurboButtonAnimation(this.scene, assetScale);
		}
	}
}
