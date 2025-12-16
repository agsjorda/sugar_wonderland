import { Scene } from "phaser";
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
import { Dialogs } from "./Dialogs";
import { playUtilityButtonSfx } from '../../utils/audioHelpers';

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
	private featureLabelText: Phaser.GameObjects.Text;
	private primaryControllers: Phaser.GameObjects.Container;
	private controllerTexts: Phaser.GameObjects.Text[] = [];
	private amplifyDescriptionContainer: Phaser.GameObjects.Container;
	private freeSpinLabel: Phaser.GameObjects.Text;
	private freeSpinNumber: Phaser.GameObjects.Text;
	private freeSpinSubLabel: Phaser.GameObjects.Text;
	private autoplaySpinsRemainingText: Phaser.GameObjects.Text;
	private pendingFreeSpinsData: { scatterIndex: number; actualFreeSpins: number } | null = null;

	// Store pending balance updates until reels stop spinning
	private pendingBalanceUpdate: { balance: number; bet: number; winnings?: number } | null = null;

	// Turbo state that should be applied on the next spin boundary
	private desiredTurboState: boolean | null = null;

	// Spine animation for spin button
	private spinButtonAnimation: any = null;

	// Spine animation for free round spin button (used during initialization free rounds)
	private freeRoundSpinButtonAnimation: any = null;

	// Spine animation for autoplay button (looping when active)
	private autoplayButtonAnimation: any = null;

	// Spine animation for turbo button (looping when active)
	private turboButtonAnimation: any = null;

	// Spin icon overlay and its tween
	private spinIcon: Phaser.GameObjects.Image | null = null;
	private spinIconTween: Phaser.Tweens.Tween | null = null;

	// Autoplay stop icon overlay
	private autoplayStopIcon: Phaser.GameObjects.Image | null = null;

	// Guard to ensure we decrement autoplay counter once per spin at REELS_START
	private hasDecrementedAutoplayForCurrentSpin: boolean = false;

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

	// Simple autoplay system
	private autoplaySpinsRemaining: number = 0;
	private autoplayTimer: Phaser.Time.TimerEvent | null = null;

	// Guards and timing to avoid overlapping enable/disable calls and keep buttons responsive
	private inProcessOfReenablingSpinButton: boolean = false;
	private inProcessOfReenablingAutoplayButton: boolean = false;
	private inProcessOfReenablingFeatureButton: boolean = false;
	private readonly buttonReenableDelay: number = 0;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;

		// Initialize buy feature component
		this.buyFeature = new BuyFeature();

		// Listen for autoplay state changes
		this.setupAutoplayEventListeners();
	}

	private playButtonSfx(): void {
		playUtilityButtonSfx(this.scene);
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
			fontFamily: 'poppins-regular'
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
	 * Helper method to center a Spine animation on the spin button.
	 * This tries to align the visual center of the Spine bounds with the spin button center.
	 */
	private centerSpineOnSpinButton(spineObj: any, spinButton: Phaser.GameObjects.Image): void {
		if (!spineObj || !spinButton) {
			return;
		}

		try {
			const anySpine: any = spineObj as any;

			if (typeof anySpine.getBounds !== 'function') {
				spineObj.setPosition(spinButton.x, spinButton.y);
				return;
			}

			const bounds = anySpine.getBounds();
			if (!bounds || !bounds.offset || !bounds.size) {
				spineObj.setPosition(spinButton.x, spinButton.y);
				return;
			}

			const centerX = bounds.offset.x + bounds.size.x * 0.5;
			const centerY = bounds.offset.y + bounds.size.y * 0.5;

			const scaleX = (spineObj.scaleX !== undefined ? spineObj.scaleX : spineObj.scale) || 1;
			const scaleY = (spineObj.scaleY !== undefined ? spineObj.scaleY : spineObj.scale) || 1;

			// Shift the local position so that the visual center of the Spine bounds
			// is aligned with the spin button center.
			spineObj.x = spinButton.x - centerX * scaleX;
			spineObj.y = spinButton.y - centerY * scaleY;
		} catch (e) {
			console.warn('[SlotController] Failed to auto-center spin button animation:', e);
			spineObj.setPosition(spinButton.x, spinButton.y);
		}
	}

	/**
	 * Create the spin button spine animation
	 */
	private createSpinButtonAnimation(scene: Scene, assetScale: number): void {
		try {
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
			this.spinButtonAnimation.setOrigin(0.5, 0.5);
			this.spinButtonAnimation.setScale(assetScale * 0.435); // Same scale as spin button
			this.spinButtonAnimation.setDepth(9); // Behind the spin button

			// Set animation speed to 1.3x
			this.spinButtonAnimation.animationState.timeScale = 1.3;

			// Initially hide the animation
			this.spinButtonAnimation.setVisible(false);

			// Add to the primary controllers container just below the spin button
			if (this.primaryControllers) {
				const spinIndex = this.primaryControllers.getIndex(spinButton);
				this.primaryControllers.addAt(this.spinButtonAnimation, spinIndex);
			} else {
				this.controllerContainer.add(this.spinButtonAnimation);
			}

			console.log('[SlotController] Spin button spine animation created successfully with 1.3x speed');

			// ------------------------------------------------------------------
			// Optional: create dedicated free-round spin button animation
			// ------------------------------------------------------------------
			// Only available as a portrait/high asset; we still attempt to load it
			// in all modes using the fixed asset path.
			if (scene.cache.json.has('fr_spin_button_animation')) {
				try {
					const spineScale = assetScale * 1.2;

					this.freeRoundSpinButtonAnimation = scene.add.spine(
						spinButton.x,
						spinButton.y,
						"fr_spin_button_animation",
						"fr_spin_button_animation-atlas"
					);
					this.freeRoundSpinButtonAnimation.setOrigin(0.5, 0.5);
					this.freeRoundSpinButtonAnimation.setScale(spineScale);
					// Depth is managed by container order; keep a sensible default here.
					this.freeRoundSpinButtonAnimation.setDepth(11);
					this.freeRoundSpinButtonAnimation.setVisible(false);

					// Center the free-round Spine animation on the spin button as well.
					this.centerSpineOnSpinButton(this.freeRoundSpinButtonAnimation, spinButton);

					// Try to automatically center the visual bounds of the Spine animation
					// inside the spin background, so the glow/effects appear centered on
					// the spin button.
					try {
						const anySpine: any = this.freeRoundSpinButtonAnimation as any;
						if (typeof anySpine.getBounds === 'function') {
							const bounds = anySpine.getBounds();
							if (bounds && bounds.offset && bounds.size) {
								const centerX = bounds.offset.x + bounds.size.x * 0.5;
								const centerY = bounds.offset.y + bounds.size.y * 0.5;
								this.freeRoundSpinButtonAnimation.x = spinButton.x * spineScale;
								this.freeRoundSpinButtonAnimation.y = spinButton.y * spineScale;
							}
						}
					} catch (e) {
						console.warn('[SlotController] Failed to auto-center free-round spin animation:', e);
					}

					if (this.primaryControllers) {
						const spinIndex = this.primaryControllers.getIndex(spinButton);
						// Insert directly ABOVE the spin button so it renders in front
						// of the spin background, but still below the spin icon / stop icon.
						this.primaryControllers.addAt(this.freeRoundSpinButtonAnimation, spinIndex + 1);
					} else {
						this.controllerContainer.add(this.freeRoundSpinButtonAnimation);
					}

					console.log('[SlotController] Free-round spin button spine animation created successfully');
				} catch (e) {
					console.warn('[SlotController] Failed to create free-round spin button animation:', e);
					this.freeRoundSpinButtonAnimation = null;
				}
			} else {
				console.warn('[SlotController] fr_spin_button_animation spine assets not found in cache; free-round spin animation will be skipped');
			}
		} catch (error) {
			console.error('[SlotController] Error creating Spine button animation:', error);
		}
	}

	/**
	 * Create the autoplay button spine animation
	 */
	private createAutoplayButtonAnimation(scene: Scene, assetScale: number): void {
		try {
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
				fontFamily: 'poppins-regular',
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
	}

	/**
	 * Disable feature button (grey out and disable interaction)
	 */
	private disableFeatureButton(): void {
		const featureButton = this.buttons.get('feature');

		const desiredAlpha = 0.3;

		if (featureButton) {
			featureButton.setAlpha(desiredAlpha); // Make it semi-transparent/greyed out
			featureButton.disableInteractive(); // Disable clicking
			console.log('[SlotController] Feature button disabled');
		}

		this.featureLabelText?.setAlpha(desiredAlpha);
		this.featureAmountText?.setAlpha(desiredAlpha);
		this.featureDollarText?.setAlpha(desiredAlpha);
	}

	/**
	 * Enable feature button (restore opacity and enable interaction)
	 */
	private enableFeatureButton(): void {
		if (this.inProcessOfReenablingFeatureButton) {
			return;
		}
		this.inProcessOfReenablingFeatureButton = true;

		const reenable = () => {
			const featureButton = this.buttons.get('feature');
			const desiredAlpha = 1.0;

			if (featureButton) {
				// Guard: do not re-enable during bonus or before explicit allow
				if (gameStateManager.isBonus || !this.canEnableFeatureButton) {
					console.log('[SlotController] Skipping feature enable (bonus active or not allowed yet)');
					this.inProcessOfReenablingFeatureButton = false;
					return;
				}
				featureButton.setAlpha(desiredAlpha); // Restore full opacity
				featureButton.setInteractive(); // Re-enable clicking
				console.log('[SlotController] Feature button enabled');
			}

			this.featureLabelText?.setAlpha(desiredAlpha);
			this.featureAmountText?.setAlpha(desiredAlpha);
			this.featureDollarText?.setAlpha(desiredAlpha);
			this.inProcessOfReenablingFeatureButton = false;
		};

		if (this.scene) {
			this.scene.time.delayedCall(this.buttonReenableDelay, reenable);
		} else {
			reenable();
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
		// During initialization free-round spins, prefer the dedicated free-round
		// animation when available. This flag is managed by FreeRoundManager.
		const isInFreeRoundSpins =
			(gameStateManager as any)?.isInFreeSpinRound === true;

		const targetAnimation = isInFreeRoundSpins && this.freeRoundSpinButtonAnimation
			? this.freeRoundSpinButtonAnimation
			: this.spinButtonAnimation;

		if (!targetAnimation) {
			console.warn('[SlotController] Spin button animation not available (no default or free-round animation)');
			return;
		}

		try {
			// Hide the non-selected animation (if any) so only one effect plays
			if (targetAnimation === this.freeRoundSpinButtonAnimation && this.spinButtonAnimation) {
				this.spinButtonAnimation.setVisible(false);
			}
			if (targetAnimation === this.spinButtonAnimation && this.freeRoundSpinButtonAnimation) {
				this.freeRoundSpinButtonAnimation.setVisible(false);
			}

			// Show the chosen animation
			targetAnimation.setVisible(true);

			// Play the animation following the same pattern as kobi-ass
			// Use animationState.setAnimation like in Header.ts.
			// For the free-round button animation, the Spine animation name is
			// "Button_Bonus_Bottom" (see Button_Bonus_VFX.json). The default
			// spin button animation uses "animation".
			const animationName =
				targetAnimation === this.freeRoundSpinButtonAnimation
					? "Button_Bonus_Bottom"
					: "animation";

			// Start the animation and obtain the track entry so we can adjust
			// its effective duration for the free-round Spine.
			const trackEntry: any = targetAnimation.animationState.setAnimation(0, animationName, false);

			// For the free-round Spine, stop the animation 0.5s before the end so
			// the last few frames are not played.
			if (targetAnimation === this.freeRoundSpinButtonAnimation && trackEntry) {
				try {
					const anySpine: any = targetAnimation as any;
					const animData = anySpine?.skeleton?.data?.findAnimation?.(animationName);
					const duration: number | undefined = animData?.duration;
					if (typeof duration === 'number' && duration > 0.01) {
						trackEntry.animationEnd = Math.max(0, duration - 0.01);
						console.log(
							`[SlotController] Free-round spin animation duration=${duration?.toFixed?.(
								3
							)}s, clamped to ${trackEntry.animationEnd?.toFixed?.(3)}s`
						);
					}
				} catch (e) {
					console.warn('[SlotController] Failed to clamp free-round spin animationEnd:', e);
				}
			}

			// Listen for animation completion to hide it
			targetAnimation.animationState.addListener({
				complete: (entry: any) => {
					if (entry.animation.name === animationName) {
						targetAnimation.setVisible(false);
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
			if (this.freeRoundSpinButtonAnimation) {
				this.freeRoundSpinButtonAnimation.setVisible(false);
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
		const middleRef = scene.scale.height * 0.82;
		const buttonSpacing = 80;

		// Spin button (main action)
		const spinButton = scene.add.image(
			scene.scale.width * 0.5,
			middleRef,
			'spin'
		).setOrigin(0.5, 0.5).setScale(assetScale * 1.2).setDepth(10);


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
		spinButton.on('pointerdown', async () => {
			console.log('[SlotController] Spin button clicked');
			// If autoplay is active, clicking spin will stop autoplay instead
			if (gameStateManager.isAutoPlaying) {
				console.log('[SlotController] Stopping autoplay via spin button click');
				this.stopAutoplay();
				return;
			}
			if (gameStateManager.isProcessingSpin) {
				console.log('[SlotController] Spin blocked - already processing');
				return;
			}

			// Mark the spin as being processed right away to guard rapid re-presses
			gameStateManager.isProcessingSpin = true;

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
		turboButton.setInteractive();
		turboButton.on('pointerdown', () => {
			console.log('[SlotController] Turbo button clicked');
			this.playButtonSfx();
			this.handleTurboButtonClick();
		});
		this.buttons.set('turbo', turboButton);
		this.primaryControllers.add(turboButton);

		// Turbo text label
		const turboText = scene.add.text(
			scene.scale.width * 0.9,
			middleRef + 5 + (turboButton.displayHeight * 0.5) + 15,
			'Turbo',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		this.controllerContainer.add(turboText);
		this.controllerTexts.push(turboText);

		// Amplify button
		const amplifyButton = scene.add.image(
			scene.scale.width * 0.73,
			middleRef,
			'amplify'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		amplifyButton.setInteractive();
		amplifyButton.on('pointerdown', () => {
			console.log('[SlotController] Amplify button clicked');
			this.playButtonSfx();
			this.handleAmplifyButtonClick();
		});
		this.buttons.set('amplify', amplifyButton);
		this.primaryControllers.add(amplifyButton);

		// Amplify text label
		const amplifyText = scene.add.text(
			scene.scale.width * 0.73,
			middleRef + (amplifyButton.displayHeight * 0.5) + 15,
			'Amplify Bet',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
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
		autoplayButton.setInteractive();
		autoplayButton.on('pointerdown', () => {
			console.log('[SlotController] Autoplay button clicked');
			this.playButtonSfx();
			this.handleAutoplayButtonClick();
		});
		this.buttons.set('autoplay', autoplayButton);
		this.primaryControllers.add(autoplayButton);

		// Autoplay text label
		const autoplayText = scene.add.text(
			scene.scale.width * 0.27,
			middleRef + (autoplayButton.displayHeight * 0.5) + 15,
			'Autoplay',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
		this.controllerContainer.add(autoplayText);
		this.controllerTexts.push(autoplayText);

		// Menu button
		const menuButton = scene.add.image(
			scene.scale.width * 0.1,
			middleRef + 5,
			'menu'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		menuButton.setInteractive();
		menuButton.on('pointerdown', () => {
			console.log('[SlotController] Menu button clicked');
			this.playButtonSfx();
			EventBus.emit('menu');
		});
		this.buttons.set('menu', menuButton);
		this.primaryControllers.add(menuButton);

		// Menu text label
		const menuText = scene.add.text(
			scene.scale.width * 0.1,
			middleRef + 5 + (menuButton.displayHeight * 0.5) + 15,
			'Menu',
			this.getTextStyle()
		).setOrigin(0.5, 0.5).setDepth(10);
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
		const amplifyY = scene.scale.height * 0.833;
		const descriptionX = amplifyX;
		const descriptionY = amplifyY - 50; // Higher than amplify button
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
				fontFamily: 'poppins-regular'
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
				fontFamily: 'poppins-regular'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.amplifyDescriptionContainer.add(descriptionLabel2);

		// Add the container to the main controller container
		this.controllerContainer.add(this.amplifyDescriptionContainer);
	}

	private createBalanceDisplay(scene: Scene, assetScale: number): void {
		// Position for balance display (top center)
		const balanceX = scene.scale.width * 0.19;
		const balanceY = scene.scale.height * 0.724;
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
				fontFamily: 'poppins-bold'
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
				fontFamily: 'poppins-bold'
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
				fontFamily: 'poppins-regular'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.balanceDollarText);
	}

	private createBetDisplay(scene: Scene, assetScale: number): void {
		// Position for bet display (proportionate opposite side of balance display)
		const betX = scene.scale.width * 0.81;
		const betY = scene.scale.height * 0.724;
		const containerWidth = 125;
		const containerHeight = 55;
		const cornerRadius = 10;
		const betValueOffset = 3;


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

		// Open Bet Options when the bet background is clicked
		betBg.setInteractive(
			new Phaser.Geom.Rectangle(
				betX - containerWidth / 2,
				betY - containerHeight / 2,
				containerWidth,
				containerHeight
			),
			Phaser.Geom.Rectangle.Contains
		);
		betBg.on('pointerdown', () => {
			if(gameStateManager.isBonus) {
				console.log('[SlotController] Bet background clicked in bonus mode - ignoring');
				return;
			}
			
			console.log('[SlotController] Bet background clicked');
			this.playButtonSfx();
			EventBus.emit('show-bet-options');
		});


		// "BET" label (1st line)
		const betLabel = scene.add.text(
			betX,
			betY - 8,
			'BET',
			{
				fontSize: '12px',
				color: '#00ff00', // Green color
				fontFamily: 'poppins-bold'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(betLabel);

		// "0.60" amount (2nd line, right part)
		this.betAmountText = scene.add.text(
			betX + betValueOffset,
			betY + 8,
			'0.20',
			{
				fontSize: '14px',
				color: '#ffffff', // White color
				fontFamily: 'poppins-bold'
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
				fontFamily: 'poppins-regular'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.betDollarText);

		// Decrease bet button (left side within container)
		const decreaseBetButton = scene.add.image(
			betX - 42, // Left side within container
			betY + 8,
			'decrease_bet'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.55).setDepth(10);
		decreaseBetButton.setInteractive();
		decreaseBetButton.on('pointerdown', () => {
			console.log('[SlotController] Decrease bet button clicked');
			this.playButtonSfx();
			this.adjustBetByStep(-1);
		});
		this.buttons.set('decrease_bet', decreaseBetButton);
		this.controllerContainer.add(decreaseBetButton);

		// Increase bet button (right side within container)
		const increaseBetButton = scene.add.image(
			betX + 42, // Right side within container
			betY + 8,
			'increase_bet'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.55).setDepth(10);
		increaseBetButton.setInteractive();
		increaseBetButton.on('pointerdown', () => {
			console.log('[SlotController] Increase bet button clicked');
			this.playButtonSfx();
			this.adjustBetByStep(1);
		});
		this.buttons.set('increase_bet', increaseBetButton);
		this.controllerContainer.add(increaseBetButton);
	}

	/** Move the bet to the next/previous level based on the BetOptions ladder */
	private adjustBetByStep(direction: 1 | -1): void {
		try {
			// Keep the ladder in sync with BetOptions.ts
			const betLevels: number[] = [
				0.2, 0.4, 0.6, 0.8, 1,
				1.2, 1.6, 2, 2.4, 2.8,
				3.2, 3.6, 4, 5, 6,
				8, 10, 14, 18, 24,
				32, 40, 60, 80, 100,
				110, 120, 130, 140, 150
			];

			// Use base bet (without amplify) to find current index
			const currentBaseBet = this.getBaseBetAmount() || 0.2;
			let idx = 0;
			let bestDiff = Number.POSITIVE_INFINITY;
			for (let i = 0; i < betLevels.length; i++) {
				const diff = Math.abs(betLevels[i] - currentBaseBet);
				if (diff < bestDiff) { bestDiff = diff; idx = i; }
			}

			const newIdx = Math.max(0, Math.min(betLevels.length - 1, idx + direction));
			const previousBet = currentBaseBet;
			const newBet = betLevels[newIdx];

			// Update UI and internal base bet via existing API (resets amplify if active)
			this.updateBetAmount(newBet);

			// Notify rest of the system
			gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: newBet, previousBet: previousBet });
		} catch (e) {
			console.warn('[SlotController] adjustBetByStep failed:', e);
		}
	}

	/**
	 * Create amplify bet spine animation behind the bet background
	 */
	private createAmplifyBetAnimation(scene: Scene, betX: number, betY: number, containerWidth: number, containerHeight: number): void {
		try {
			// Check if the spine assets are loaded
			if (!scene.cache.json.has('amplify_bet')) {
				console.warn('[SlotController] Amplify bet spine assets not loaded, skipping animation creation');
				return;
			}

			// Create the spine animation
			const amplifyOffsetX = -4; // slight left
			const amplifyOffsetY = 0; // slight up
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
		const featureY = scene.scale.height * 0.724; // Same Y as balance and bet containers

		// Feature button image (serves as background)
		const featureButton = scene.add.image(
			featureX,
			featureY,
			'feature'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		featureButton.setInteractive();
		featureButton.on('pointerdown', () => {
			console.log('[SlotController] Feature button clicked');
			this.playButtonSfx();
			this.showBuyFeatureDrawer();
		});
		this.buttons.set('feature', featureButton);
		this.controllerContainer.add(featureButton);

		// "BUY FEATURE" label (1st line)
		this.featureLabelText = scene.add.text(
			featureX,
			featureY - 8,
			'BUY FEATURE',
			{
				fontSize: '12px',
				color: '#ffffff',
				fontFamily: 'poppins-regular'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.featureLabelText);

		// Amount (2nd line, right part) - bound to current bet x100
		this.featureAmountText = scene.add.text(
			featureX + 5,
			featureY + 8,
			'0',
			{
				fontSize: '14px',
				color: '#ffffff',
				fontFamily: 'poppins-bold'
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
				fontFamily: 'poppins-regular'
			}
		).setOrigin(0.5, 0.5).setDepth(9);
		this.controllerContainer.add(this.featureDollarText);

		// Initialize amount from current bet
		this.updateFeatureAmountFromCurrentBet();
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
		spinButton.on('pointerdown', async () => {
			console.log('[SlotController] Spin button clicked');
			// If autoplay is active, clicking spin will stop autoplay instead
			if (gameStateManager.isAutoPlaying) {
				console.log('[SlotController] Stopping autoplay via spin button click');
				this.stopAutoplay();
				return;
			}
			if (gameStateManager.isProcessingSpin) {
				console.log('[SlotController] Spin blocked - already processing');
				return;
			}

			// Mark the spin as being processed right away to guard rapid re-presses
			gameStateManager.isProcessingSpin = true;

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
		turboButton.setInteractive();
		turboButton.on('pointerdown', () => {
			console.log('[SlotController] Turbo button clicked');
			this.playButtonSfx();
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
		this.controllerContainer.add(turboText);
		this.controllerTexts.push(turboText);

		// Autoplay button
		const autoplayButton = scene.add.image(
			scene.scale.width * 0.5 + buttonSpacing,
			middleRef,
			'autoplay_off'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		autoplayButton.setInteractive();
		autoplayButton.on('pointerdown', () => {
			console.log('[SlotController] Autoplay button clicked');
			this.playButtonSfx();
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
		this.controllerContainer.add(autoplayText);
		this.controllerTexts.push(autoplayText);

		// Menu button
		const menuButton = scene.add.image(
			scene.scale.width * 0.5 + buttonSpacing * 2,
			middleRef,
			'menu'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10);
		menuButton.setInteractive();
		menuButton.on('pointerdown', () => {
			console.log('[SlotController] Menu button clicked');
			this.playButtonSfx();
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
		// Preserve enhanced bet state and display the correct value
		const gameData = this.getGameData();
		const isEnhanced = !!gameData?.isEnhancedBet;
		const displayBet = isEnhanced ? betAmount * 1.25 : betAmount;

		if (this.betAmountText) {
			this.betAmountText.setText(displayBet.toFixed(2));

			// Update dollar sign position based on new bet amount width
			if (this.betDollarText) {
				const betX = this.betAmountText.x;
				const betY = this.betAmountText.y;
				this.betDollarText.setPosition(betX - (this.betAmountText.width / 2) - 5, betY);
			}
		}

		// Keep the Buy Feature amount synced with current base bet
		this.updateFeatureAmountFromCurrentBet();

		// Update base bet amount when changed externally (not by amplify bet)
		if (!this.isInternalBetChange) {
			this.baseBetAmount = betAmount;
			// Do NOT reset enhanced bet or re-enable feature; retain current state
		}
	}

	/**
	 * Update the Buy Feature button amount to current base bet x100
	 */
	private updateFeatureAmountFromCurrentBet(): void {
		if (!this.featureAmountText || !this.featureDollarText) {
			return;
		}
		// Prefer displayed bet (reflects amplify), fallback to base bet
		let displayedBet = 0;
		if (this.betAmountText) {
			displayedBet = parseFloat(this.betAmountText.text) || 0;
		}
		if (displayedBet === 0) {
			displayedBet = this.getBaseBetAmount() || 0;
		}
		if (this.getGameData()?.isEnhancedBet) {
			displayedBet /= 1.25;
		}

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
			console.log('[SlotController] Reels started - disabling amplify button');
			this.disableAmplifyButton();
			// Decrement normal autoplay spins at start of reels
			if (this.autoplaySpinsRemaining > 0 && gameStateManager.isAutoPlaying && !gameStateManager.isBonus) {
				if (!this.hasDecrementedAutoplayForCurrentSpin) {
					this.autoplaySpinsRemaining = Math.max(0, this.autoplaySpinsRemaining - 1);
					this.updateAutoplaySpinsRemainingText(this.autoplaySpinsRemaining);
					this.hasDecrementedAutoplayForCurrentSpin = true;
					console.log(`[SlotController] Autoplay decremented on REELS_START. Remaining: ${this.autoplaySpinsRemaining}`);
				}
			}
		});

		gameEventManager.on(GameEventType.REELS_STOP, () => {
			console.log('[SlotController] Reels stopped event received - updating spin button state');

			// Apply any queued turbo toggle now that the spin has completed
			this.applyPendingTurboState('reels-stop');

			// Reset decrement guard for next spin
			this.hasDecrementedAutoplayForCurrentSpin = false;

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

			// If scatter bonus just triggered or bonus mode is active, keep buttons disabled
			if (gameStateManager.isScatter || gameStateManager.isBonus) {
				console.log('[SlotController] Scatter/Bonus active - keeping buttons disabled on REELS_STOP');
				return;
			}

			// Check if free spin autoplay is active - if so, don't re-enable buttons
			const symbolsComponent = (this.scene as any).symbols;
			if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function' && symbolsComponent.isFreeSpinAutoplayActive()) {
				console.log('[SlotController] Free spin autoplay is active - keeping buttons disabled');
				return;
			}

			// Note: autoplaySpinsRemaining is decremented in WIN_STOP handler after win processing

			// Note: AUTO_STOP is now emitted in WIN_STOP handler after stopAutoplay() is called

			// Helper: re-enable all primary controls with a short delay after reels stop
			const enableControlsWithDelay = (logLabel: string) => {
				const delayMs = 150;
				if (this.scene) {
					this.scene.time.delayedCall(delayMs, () => {
						// Guard: don't re-enable controls if a new spin started,
						// reels started again, or a win dialog is now showing
						if (
							gameStateManager.isProcessingSpin ||
							gameStateManager.isReelSpinning ||
							gameStateManager.isShowingWinDialog
						) {
							console.log(
								`[SlotController] Skipping control enable (${logLabel}) - state changed during delay`,
							);
							return;
						}
						this.enableSpinButton();
						this.enableAutoplayButton();
						this.enableBetButtons();
						// Keep feature disabled during bonus or until explicitly allowed
						if (!gameStateManager.isBonus && this.canEnableFeatureButton) {
							this.enableFeatureButton();
						}
						this.enableAmplifyButton();
						console.log(`[SlotController] Controls enabled after REELS_STOP with delay (${logLabel})`);
					});
				} else {
					// Same guards when we don't have a scene timer available
					if (
						gameStateManager.isProcessingSpin ||
						gameStateManager.isReelSpinning ||
						gameStateManager.isShowingWinDialog
					) {
						console.log(
							`[SlotController] Skipping control enable (${logLabel}) without delay - state changed`,
						);
						return;
					}

					this.enableSpinButton();
					this.enableAutoplayButton();
					this.enableBetButtons();
					if (!gameStateManager.isBonus && this.canEnableFeatureButton) {
						this.enableFeatureButton();
					}
					this.enableAmplifyButton();
					console.log(`[SlotController] Controls enabled after REELS_STOP without delay (${logLabel})`);
				}
			};

			// For manual spins, re-enable controls and hide autoplay counter shortly after REELS_STOP
			// Check autoplay counter instead of state manager to avoid timing issues
			if (this.autoplaySpinsRemaining === 0 && !gameStateManager.isShowingWinDialog) {
				enableControlsWithDelay('manual-spin');
				this.hideAutoplaySpinsRemainingText();
				this.updateAutoplayButtonState();
				return;
			}

			// Update spin button state when spin completes
			// Only enable spin button if not autoplaying AND reels are not spinning
			if (!this.gameData?.isAutoPlaying && !gameStateManager.isReelSpinning && !gameStateManager.isShowingWinDialog) {
				enableControlsWithDelay('not-autoplaying');
				return;
			}

			// If autoplaying or reels still spinning, keep button disabled
			if (this.gameData?.isAutoPlaying) {
				console.log('[SlotController] Spin button remains disabled - autoplay active');
			} else if (gameStateManager.isReelSpinning) {
				console.log('[SlotController] Spin button remains disabled - reels still spinning');
			}
		});

		// Listen for autoplay start
		gameEventManager.on(GameEventType.AUTO_START, () => {
			console.log('[SlotController] Autoplay started - changing button to ON state');

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
			this.enableSpinButton();
			this.enableAutoplayButton();
			this.enableBetButtons();
			this.enableFeatureButton();
			this.enableAmplifyButton();
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
			// Keep spins text above all
			if (this.autoplaySpinsRemainingText && this.primaryControllers) {
				this.primaryControllers.bringToTop(this.autoplaySpinsRemainingText);
			}
			console.log('[SlotController] Spin, autoplay, bet, feature, and amplify buttons enabled');

			console.log('[SlotController] Autoplay UI reset completed');
		});


		// Listen for when reels stop spinning to enable spin button for manual spins
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			console.log('[SlotController] WIN_STOP received - checking if spin button should be enabled');

			// If scatter bonus is in progress or bonus mode is active, keep buttons disabled
			if (gameStateManager.isScatter || gameStateManager.isBonus) {
				console.log('[SlotController] Scatter/Bonus in progress - skipping UI re-enable in WIN_STOP');
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

				// Decrement now handled at REELS_START for normal autoplay

				// Check if a win dialog is showing - pause autoplay if so
				if (gameStateManager.isShowingWinDialog) {
					console.log('[SlotController] Win dialog is showing - pausing autoplay until dialog closes');
					return;
				}

				// Only schedule next spin if we have spins remaining
				if (this.autoplaySpinsRemaining > 0 && !gameStateManager.isShowingWinDialog) {
					console.log(`[SlotController] Scheduling next autoplay spin. ${this.autoplaySpinsRemaining} spins remaining`);
					// WIN_STOP is emitted both for no wins (immediately) and after first win loop
					// Apply turbo to the delay
					const baseDelay = 250;
					// FIXED: Use GameData.isTurbo instead of gameStateManager.isTurbo for consistency
					const gameData = this.getGameData();
					const isTurbo = gameData?.isTurbo || false;
					const turboDelay = isTurbo ?
						baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
					console.log(`[SlotController] Autoplay delay: ${baseDelay}ms -> ${turboDelay}ms (turbo: ${isTurbo})`);
					this.scheduleNextAutoplaySpin(turboDelay);
				} else {
					console.log('[SlotController] No autoplay spins remaining - autoplay finished');
					// Emit AUTO_STOP when autoplay is truly finished
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
		const gameData = this.getGameData();
		if (!gameData) {
			console.error('[SlotController] GameData not available for turbo button click');
			return;
		}

		// Toggle desired state (use pending desired if one exists to keep UX consistent)
		const currentVisualState = this.desiredTurboState !== null ? this.desiredTurboState : gameData.isTurbo;
		const nextDesiredState = !currentVisualState;
		this.desiredTurboState = nextDesiredState;

		// Update the button visuals immediately to reflect the requested state
		this.setTurboButtonState(nextDesiredState);

		const hasActiveSpin = gameStateManager.isReelSpinning || gameStateManager.isProcessingSpin;
		console.log(`[SlotController] Turbo toggle scheduled -> ${nextDesiredState ? 'ON' : 'OFF'} (current applied: ${gameData.isTurbo}, activeSpin: ${hasActiveSpin})`);

		// If no spin is currently active, apply immediately so the upcoming spin uses it.
		if (!hasActiveSpin) {
			this.applyPendingTurboState('idle-toggle');
		}
	}

	/**
	 * Apply any pending turbo state change at a safe boundary (reels stop or spin start)
	 */
	private applyPendingTurboState(reason: string = 'unspecified'): void {
		const gameData = this.getGameData();
		if (!gameData) {
			console.warn('[SlotController] GameData not available to apply pending turbo state');
			return;
		}

		if (this.desiredTurboState === null) {
			return;
		}

		if (gameData.isTurbo === this.desiredTurboState) {
			console.log(`[SlotController] Pending turbo state matches current (${gameData.isTurbo}) - clearing (reason: ${reason})`);
			this.desiredTurboState = null;
			return;
		}

		// Apply pending state to game data and global state manager
		gameData.isTurbo = this.desiredTurboState;
		gameStateManager.isTurbo = this.desiredTurboState;
		this.setTurboButtonState(this.desiredTurboState);

		// Apply turbo-related speed modifications and propagate to other components
		this.applyTurboSpeedModifications();
		this.forceApplyTurboToSceneGameData();
		this.applyTurboToWinlineAnimations();

		// Emit events so other systems stay in sync
		EventBus.emit('turbo', gameData.isTurbo);
		gameEventManager.emit(gameData.isTurbo ? GameEventType.TURBO_ON : GameEventType.TURBO_OFF);

		console.log(`[SlotController] Applied pending turbo state: ${gameData.isTurbo} (reason: ${reason})`);

		// Clear pending flag
		this.desiredTurboState = null;
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

		if (gameStateManager.isProcessingSpin) {
			console.log('[SlotController] Amplify button clicked - blocked by recent press');
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
			// Enable Buy Feature button
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
			// Disable Buy Feature button
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
		// Check if autoplay is currently active
		if (this.autoplaySpinsRemaining > 0) {
			// Autoplay is active, stop it
			console.log('[SlotController] Stopping autoplay via button click');
			this.stopAutoplay();
		} else {
			// Autoplay is not active, show options to start it
			console.log('[SlotController] Showing autoplay options');
			EventBus.emit('autoplay');
		}
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
		if (this.spinIconTween && !gameStateManager.isProcessingSpin) {
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

		// Re-enable spin button promptly when no spin is being processed
		if (!gameStateManager.isProcessingSpin) {
			if (this.scene) {
				// Only re-enable if we're still not spinning and autoplay hasn't restarted
				if (!gameStateManager.isProcessingSpin && !gameStateManager.isAutoPlaying) {
					this.enableSpinButton();
				}
			} else {
				this.enableSpinButton();
			}
		}
	}

	/**
	 * Perform a single autoplay spin
	 */
	private async performAutoplaySpin(): Promise<void> {
		if (this.autoplaySpinsRemaining <= 0 || !gameStateManager.isAutoPlaying) {
			console.log('[SlotController] No autoplay spins remaining');
			return;
		}

		if (gameStateManager.isProcessingSpin) {
			console.log('[SlotController] Autoplay spin blocked - already processing spin');

			this.scene?.time.delayedCall(200, () => {
				this.performAutoplaySpin();
			});

			return;
		}

		// Mark the beginning of an autoplay spin attempt on this frame
		gameStateManager.isProcessingSpin = true;

		console.log(`[SlotController] Performing autoplay spin. ${this.autoplaySpinsRemaining} spins remaining`);

		// During autoplay spins, keep spin button enabled to allow stopping autoplay
		this.disableBetButtons();
		this.disableFeatureButton();

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
		this.enableFeatureButton();

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

		// Create "Remaining" label (first line)
		this.freeSpinLabel = scene.add.text(
			freeSpinX - 20, // Offset to the left to center with the number
			freeSpinY - 10, // First line, positioned above
			'Remaining',
			{
				fontSize: '30px',
				color: '#00ff00', // Bright vibrant green as shown in image
				fontFamily: 'poppins-bold',
				stroke: '#004400', // Dark green stroke for better readability
				strokeThickness: 4
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
				fontFamily: 'poppins-bold',
				stroke: '#004400', // Dark green stroke for better readability
				strokeThickness: 4
			}
		).setOrigin(0.5, 0.5).setDepth(15);
		this.controllerContainer.add(this.freeSpinSubLabel);

		// Create free spin number display
		this.freeSpinNumber = scene.add.text(
			freeSpinX + 110, // Positioned to the right of the label
			freeSpinY + 5, // Centered vertically between the two lines
			'3', // Default value, will be updated dynamically
			{
				fontSize: '80px', // Larger and bolder than the label
				color: '#ffffff', // Pure white as shown in image
				fontFamily: 'poppins-bold',
				stroke: '#004400', // Dark green stroke around the free spin amount
				strokeThickness: 6
			}
		).setOrigin(0.5, 0.5).setDepth(15);
		this.controllerContainer.add(this.freeSpinNumber);

		// Initially hide the free spin display (only show during bonus mode)
		this.freeSpinLabel.setVisible(false);
		this.freeSpinSubLabel.setVisible(false);
		this.freeSpinNumber.setVisible(false);

		console.log('[SlotController] Free spin display created');
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
		if (this.inProcessOfReenablingAutoplayButton) {
			return;
		}
		this.inProcessOfReenablingAutoplayButton = true;

		const reenable = () => {
			const autoplayButton = this.buttons.get('autoplay');
			if (autoplayButton) {
				autoplayButton.clearTint(); // Remove grey tint
				autoplayButton.setInteractive();
				console.log('[SlotController] Autoplay button enabled');
			}
			this.inProcessOfReenablingAutoplayButton = false;
		};

		if (this.scene) {
			this.scene.time.delayedCall(this.buttonReenableDelay, reenable);
		} else {
			reenable();
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
			console.log('[SlotController] Free spin display hidden');
		}
	}

	/**
	 * Update the free spin number display
	 * In bonus mode, decrement the display value by 1 for frontend only
	 */
	public updateFreeSpinNumber(spinsRemaining: number): void {
		if (this.freeSpinNumber) {
			// In bonus mode, decrement display value by 1 for frontend only
			let displayValue = spinsRemaining;
			if (gameStateManager.isBonus && spinsRemaining > 0) {
				displayValue = spinsRemaining;
				console.log(`[SlotController] Bonus mode: displaying ${displayValue} (actual: ${spinsRemaining})`);
			}

			this.freeSpinNumber.setText(displayValue.toString());
			console.log(`[SlotController] Free spin number updated to ${displayValue} (actual: ${spinsRemaining})`);
		}
	}

	/**
	 * Handle spin logic - either normal API call or free spin simulation
	 */
	private async handleSpin(): Promise<void> {
		// Mark any spin path as processing immediately to gate rapid re-presses
		gameStateManager.isProcessingSpin = true;

		// Apply any pending turbo toggle so it takes effect for this spin (never mid-spin)
		this.applyPendingTurboState('spin-start');

		if (!this.gameAPI) {
			console.warn('[SlotController] GameAPI not available, falling back to EventBus');
			// No backend call is made in this fallback path, consider spin processing done
			gameStateManager.isProcessingSpin = false;
			EventBus.emit('spin');
			return;
		}

		// Play spin sound effect
		if ((window as any).audioManager) {
			(window as any).audioManager.playSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_SPIN : SoundEffectType.SPIN);
			console.log('[SlotController] Playing spin sound effect');
		}

		// Decrement balance by bet amount (frontend only)
		this.decrementBalanceByBet();

		try {
			let spinData: SpinData;

			// Check if we're in bonus mode and use free spin simulation
			if (gameStateManager.isBonus) {
				console.log('[SlotController] In bonus mode - using free spin simulation...');
				spinData = await this.gameAPI.simulateFreeSpin();

				// Update free spin display with remaining count from Symbols component
				const gameScene = this.scene as any; // Cast to access symbols property
				if (gameScene.symbols && gameScene.symbols.freeSpinAutoplaySpinsRemaining !== undefined) {
					this.updateFreeSpinNumber(gameScene.symbols.freeSpinAutoplaySpinsRemaining);
					console.log(`[SlotController] Updated free spin display to ${gameScene.symbols.freeSpinAutoplaySpinsRemaining} remaining`);

					// Check if there are any more free spins available
					const hasMoreFreeSpins = spinData.slot.freespin.items.some(item => item.spinsLeft > 0);
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
			} else {
				console.log('[SlotController] Normal mode - calling GameAPI.doSpin...');
				// Use base bet amount for API calls (without amplify bet increase)
				const currentBet = this.getBaseBetAmount() || 10;
				const gameData = this.getGameData();
				const isEnhancedBet = gameData ? gameData.isEnhancedBet : false;
				spinData = await this.gameAPI.doSpin(currentBet, false, isEnhancedBet);
				console.log('[SlotController] Spin data:', spinData);
			}

			// If no spin data is returned, treat the spin as finished and recover UI
			if (!spinData) {
				console.log('[SlotController] No spin data received - stopping spin early');
				gameStateManager.isReelSpinning = false;
				gameStateManager.isProcessingSpin = false;
				this.enableSpinButton();
				return;
			}

			// Display comprehensive spin data information
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
			// Any failure to obtain or process spin data should clear the processing flag
			gameStateManager.isProcessingSpin = false;
			// Allow UI controls to recover in case of error and avoid emitting spin events
			this.enableSpinButton();
			this.enableAutoplayButton();
			this.enableBetButtons();
			this.enableFeatureButton();
			this.enableAmplifyButton();
			// Don't emit the spin event if the API call failed
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

		// Show the buy feature drawer
		this.buyFeature.show({
			featurePrice: 24000.00, // Default feature price
			onClose: () => {
				console.log('[SlotController] Buy feature drawer closed');
			},
			onConfirm: () => {
				console.log('[SlotController] Buy feature confirmed');
				// Immediately disable interactions to prevent other actions
				this.disableSpinButton();
				this.disableAutoplayButton();
				this.disableFeatureButton();
				this.disableBetButtons();
				this.disableAmplifyButton();
				this.handleBuyFeature();
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

			// Update SlotController bet to match the selected Buy Feature bet
			// This updates both the displayed bet and the internal baseBetAmount
			this.updateBetAmount(buyFeatureBet);

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
				// TODO: Show insufficient balance message to user
				return;
			}

			// Deduct the calculated price from balance (frontend only)
			const newBalance = currentBalance - calculatedPrice;
			this.updateBalanceAmount(newBalance);
			console.log(`[SlotController] Balance deducted: $${currentBalance.toFixed(2)} -> $${newBalance.toFixed(2)}`);

			// Call doSpin with buy feature parameters
			console.log('[SlotController] Calling doSpin for buy feature...');
			const spinData = await this.gameAPI.doSpin(buyFeatureBet, true, false); // isBuyFs: true, isEnhancedBet: false

			console.log('[SlotController] Buy feature spin completed:', spinData);

			// If this buy feature spin contains free spin data (scatter), temporarily disable turbo so
			// scatter symbol animations and sequence play at normal speed, then restore after dialogs
			try {
				const hasFsItems = !!(spinData?.slot?.freespin?.items || spinData?.slot?.freeSpin?.items);
				if (hasFsItems) {
					const gd = this.getGameData();
					if (gd) {
						const wasTurboGD = !!gd.isTurbo;
						const wasTurboGSM = !!gameStateManager.isTurbo;
						if (wasTurboGD || wasTurboGSM) {
							console.log('[SlotController] Buy feature with scatter during turbo - temporarily disabling turbo for scatter sequence');
							// Disable both UI/gameData and central state turbo flags
							gd.isTurbo = false;
							gameStateManager.isTurbo = false;
							// Restore turbo after dialog animations complete
							if (this.scene) {
								this.scene.events.once('dialogAnimationsComplete', () => {
									try {
										if (wasTurboGD) {
											gd.isTurbo = true;
										}
										if (wasTurboGSM) {
											gameStateManager.isTurbo = true;
										}
										console.log('[SlotController] Restored turbo after scatter sequence dialogs completed');
									} catch (e) {
										console.warn('[SlotController] Failed to restore turbo after dialogs:', e);
									}
								});
							}
						}
					}
				}
			} catch (e) {
				console.warn('[SlotController] Turbo normalization for buy feature scatter failed:', e);
			}

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
				// Clear any pending free spins data when bonus mode ends
				if (this.pendingFreeSpinsData) {
					console.log('[SlotController] Bonus mode ended - clearing pending free spins data');
					this.pendingFreeSpinsData = null;
				}
				// Allow feature button to be enabled again (now that bonus is off)
				this.canEnableFeatureButton = true;
				// Re-enable buy feature only after bonus is fully deactivated
				this.enableFeatureButton();
			}
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

		// Listen for dialog animations completion to show free spin display
		this.scene.events.on('dialogAnimationsComplete', () => {
			console.log('[SlotController] Dialog animations completed - checking if free spin display should be shown');
			console.log('[SlotController] Current pendingFreeSpinsData:', this.pendingFreeSpinsData);

			if (this.pendingFreeSpinsData) {
				console.log(`[SlotController] Showing free spin display with ${this.pendingFreeSpinsData.actualFreeSpins} spins after dialog closed`);
				this.showFreeSpinDisplayWithActualValue(this.pendingFreeSpinsData.actualFreeSpins);
				// Clear the pending data
				this.pendingFreeSpinsData = null;
			} else {
				console.log('[SlotController] No pending free spins data - free spin display not shown');
			}
		});

		// Listen for free spin autoplay events
		gameEventManager.on(GameEventType.FREE_SPIN_AUTOPLAY, async () => {
			console.log('[SlotController] FREE_SPIN_AUTOPLAY event received - triggering free spin simulation');

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
		if (this.inProcessOfReenablingSpinButton) {
			return;
		}
		this.inProcessOfReenablingSpinButton = true;

		const reenable = () => {
			const spinButton = this.buttons.get('spin');
			if (spinButton) {
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
			this.inProcessOfReenablingSpinButton = false;
		};

		if (this.scene) {
			this.scene.time.delayedCall(this.buttonReenableDelay, reenable);
		} else {
			reenable();
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

		if (gameData.isAutoPlaying) {
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
