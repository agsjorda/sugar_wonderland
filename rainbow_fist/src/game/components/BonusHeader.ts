import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { SpinData, SpinDataUtils } from "../../backend/SpinData";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { playSpineAnimationSequenceWithConfig } from "./SpineBehaviorHelper";
import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { Game } from "../scenes/Game";
import { TurboConfig } from "../../config/TurboConfig";
import { NumberDisplay, NumberDisplayConfig } from "./NumberDisplay";

export class BonusHeader {
	private scene: Game;
	private bonusHeaderContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private spotlight: Phaser.GameObjects.Image;
    private logoImage: Phaser.GameObjects.Image;
	private spotlightBounds: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	};
	private amountText: Phaser.GameObjects.Text;
	private amountTotalText: Phaser.GameObjects.Text | null = null;
	private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	private multiplierDisplay: NumberDisplay | null = null;
	private currentMultiplier: number = 0;
	private currentBaseWinnings: number = 0;
	/**
	 * Tracks whether the CURRENT tumble has received any multiplier update event.
	 * If not, we should not display an equation and should not multiply base winnings.
	 */
	private didMultiplierUpdateForCurrentTumble: boolean = false;

	// Slightly adjusted for larger font sizes (amount +2px, label +2px)
	private winningsLabelTextOffset: {x: number, y: number} = {x: 0, y: -15};
    private winningsValueTextOffset: {x: number, y: number} = {x: 0, y: 7};
    private multiplierNumberDisplayOffset: {x: number, y: number} = {x: 12, y: 0};

    private totalAmountTextColor: string = '#00ff00';
	// Theme-contrasting outline used across the UI (see SlotController/Preloader)
	private textStrokeColor: string = '#004400'; // dark green
	private textStrokeThickness: number = 2;

	private readonly handleBonusModeToggle = (isBonus: boolean) => {
		if (typeof isBonus !== 'boolean') {
			return;
		}

		console.log(`[BonusHeader] Bonus mode ${isBonus ? 'started' : 'ended'} - resetting display state`);
		this.resetBonusDisplayState(isBonus);
	};

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[BonusHeader] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		this.scene = scene as Game;
		console.log("[BonusHeader] Creating bonus header elements");
		
		// Create main container for all bonus header elements
		this.bonusHeaderContainer = scene.add.container(0, 0);
		this.bonusHeaderContainer.setDepth(501); // Keep bonus header above symbols/overlay (500) but below winning symbols (600)
		this.currentWinnings = this.getCachedPreBonusWins();
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[BonusHeader] Creating bonus header with scale: ${assetScale}x`);

		// Add bonus header elements
		this.createBonusHeaderElements(scene, assetScale);
		
		// Set up event listeners for winnings updates (like regular header)
		this.setupWinningsEventListener();
		
		// Reset multiplier value
		this.resetMultiplierValue();

		if (this.scene?.events) {
			this.scene.events.on('setBonusMode', this.handleBonusModeToggle);
		}
	}

	private createBonusHeaderElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		this.createPortraitBonusHeader(scene, assetScale);
	}

	private createPortraitBonusHeader(scene: Scene, assetScale: number): void {
		console.log("[BonusHeader] Creating portrait bonus header layout");
		
        // Add Kobi logo bonus (top-anchored, width-ratio scaling)
		this.createLogoImage(scene);

		// Add text inside the win bar bonus
		const winBarBonusWidthMultiplier = 0.5;
		const winBarBonusHeightMultiplier = 0.2125;
		const winBarX = scene.scale.width * winBarBonusWidthMultiplier;
		const winBarY = scene.scale.height * winBarBonusHeightMultiplier;
		this.createWinBar(scene, winBarX, winBarY, assetScale);
		this.createWinBarText(scene, winBarX, winBarY);

		// Add multiplier bar
		const multiplierBarWidthMultiplier = 0.775;
		const multiplierBarHeightMultiplier = 0.1725;
		const multiplierBarX = scene.scale.width * multiplierBarWidthMultiplier;
		const multiplierBarY = scene.scale.height * multiplierBarHeightMultiplier;
		this.createMultiplierBar(scene, multiplierBarX, multiplierBarY, assetScale);
		this.createMultiplierDisplay(scene, multiplierBarX, multiplierBarY);
	}
	
	private createMultiplierBar(scene: Scene, x: number, y: number, assetScale: number): void {
		const multiplierBar = scene.add.image(x, y, 'multiplier-bar-bonus')
		.setOrigin(0.5, 0.5)
		.setScale(assetScale * 1.2)
		.setDepth(10);
		this.bonusHeaderContainer.add(multiplierBar);
	}

	private createMultiplierDisplay(scene: Scene, x: number, y: number): void {
        const displayX = x + this.multiplierNumberDisplayOffset.x;
        const displayY = y + this.multiplierNumberDisplayOffset.y;

		const multiplierConfig: NumberDisplayConfig = {
            x: displayX,
            y: displayY,
			scale: 0.019,
			prefixScale: 0.009,
			prefixYOffset: 0.5,
			spacing: -10,
			alignment: 'center',
			decimalPlaces: 0,
			showCommas: false,
			prefix: 'x',
		};

		this.multiplierDisplay = new NumberDisplay(multiplierConfig, this.networkManager, this.screenModeManager);
		this.multiplierDisplay.create(scene);
		this.multiplierDisplay.toggleBorder(false);
		// change drop shadow to a dark green color
		this.multiplierDisplay.setDropShadow(true, 2, 2, 0.5, 0x008000);

		const container = this.multiplierDisplay.getContainer();
		if (container) {
			container.setDepth(11);
			this.bonusHeaderContainer.add(container);
		}

		this.multiplierDisplay.displayValue(1);
		this.hideMultiplierText();
	}

	private createLogoImage(scene: Scene): void {
        this.logoImage = scene.add.image(
            scene.scale.width *  0.5,
            scene.scale.height * 0.0225,
            'logo'
        ).setOrigin(0.5, 0).setDepth(300).setScale(1);
        this.bonusHeaderContainer.add(this.logoImage);
	}

	private createWinBar(scene: Scene, x: number, y: number, assetScale: number): void {
		const winBarBonus = scene.add.image(
			x,
			y,
			'win-bar-bonus'
		).setOrigin(0.5, 0.5)
		.setScale(assetScale)
		.setDepth(501);
		this.bonusHeaderContainer.add(winBarBonus);
	}


	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x + this.winningsLabelTextOffset.x, y + this.winningsLabelTextOffset.y, 'YOU WON', {
			fontSize: '14px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular',
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting
		this.amountText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, '$ 999,999,999,999.00', {
			fontSize: '22px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.amountText);

		// Separate text object for the total winnings part (shown in green)
		this.amountTotalText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, '', {
			fontSize: '22px',
			color: this.totalAmountTextColor,
			fontFamily: 'Poppins-Bold',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0, 0.5).setDepth(11);
		this.amountTotalText.setVisible(false);
		this.bonusHeaderContainer.add(this.amountTotalText);
	}

	/**
	 * Update the winnings display in the bonus header
	 */
	public updateWinningsDisplay(winnings: number, animate: boolean = true): void {
		if (this.amountText && this.youWonText) {
			const formattedWinnings = this.formatCurrency(winnings);
			this.amountText.setColor('#ffffff');
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.scene.scale.width * 0.5, this.amountText.y);
			
			// Show both texts when updating winnings
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);

			// Hide and clear the separate total text when not showing the expression
			if (this.amountTotalText) {
				this.amountTotalText.setVisible(false);
				this.amountTotalText.setText('');
			}

			if (animate) {
				this.animateWinningsDisplay(this.amountText);
			}

			console.log(`[BonusHeader] Winnings updated to: ${formattedWinnings} (raw: ${winnings})`);
		}
	}

	/**
	 * Hide the winnings display (both "YOU WON" text and amount)
	 */
	public hideWinningsDisplay(): void {
		if (this.amountText && this.youWonText) {
			// Hide both texts
			this.youWonText.setVisible(false);
			this.amountText.setVisible(false);

			// Also hide the separate total text, if present
			if (this.amountTotalText) {
				this.amountTotalText.setVisible(false);
			}
			
			console.log('[BonusHeader] Winnings display hidden');
		} else {
			console.warn('[BonusHeader] Cannot hide winnings display - text objects not available', {
				amountText: !!this.amountText,
				youWonText: !!this.youWonText
			});
		}
	}

	/**
	 * Show the winnings display with both "YOU WON" text and amount
	 */
	public showWinningsDisplay(winnings: number): void {
		if (this.amountText && this.youWonText) {
			const formattedWinnings = this.formatCurrency(winnings);

			// Reset color to default white when showing standard winnings
			this.amountText.setColor('#ffffff');
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);

			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			
			// Update amount text with winnings
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.scene.scale.width * 0.5, this.amountText.y);
			
			console.log(`[BonusHeader] Winnings display shown: ${formattedWinnings} (raw: ${winnings})`);

			// Hide and clear the separate total text when showing standard winnings
			if (this.amountTotalText) {
				this.amountTotalText.setVisible(false);
				this.amountTotalText.setText('');
			}
		} else {
			console.warn('[BonusHeader] Cannot show winnings display - text objects not available', {
				amountText: !!this.amountText,
				youWonText: !!this.youWonText
			});
		}
	}

	public updateWinningsDisplayEquation(prefixText: string, totalText: string): void {
		// Backwards-compatible wrapper name for existing call sites.
		// Implementation matches Header.ts equation layout.
		this.updateWinningsDisplayAsText(prefixText, totalText);
	}

	/**
	 * Render an equation-like winnings display where the prefix stays white and the total is green.
	 * Matches Header.ts behavior: keep the prefix centered and let the total extend to the right.
	 */
	public updateWinningsDisplayAsText(prefixText: string, totalText: string): void {
		if (this.amountText) {
			// Base expression (e.g. "$ 10.00  x  5  =  ") stays white
			this.amountText.setColor('#ffffff');
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountText.setText(prefixText);
			this.amountText.setVisible(true);
		}

		if (this.amountTotalText) {
			// Total winnings (e.g. "$ 50.00") is rendered separately in green
			this.amountTotalText.setColor(this.totalAmountTextColor);
			// When the value is green, use the same theme stroke
			this.amountTotalText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountTotalText.setText(totalText);
			this.amountTotalText.setVisible(true);

			const baseX = this.scene.scale.width * 0.5;
			const baseY = this.amountText.y;

			// Keep the base centered and let the total extend to the right
			this.amountText.setOrigin(0.5, 0.5);
			this.amountTotalText.setOrigin(0, 0.5);

			this.amountText.setPosition(baseX - this.amountTotalText.width / 2, baseY);
			this.amountTotalText.setPosition(this.amountText.x + this.amountText.width / 2, baseY);
		}

		this.animateWinningsDisplay(this.amountTotalText);
	}

	public animateWinningsDisplay(target: any): void {
		if (!target) {
			return;
		}

		this.scene.tweens.add({
			targets: target,
			scaleX: 1.25,
			scaleY: 1.25,
			duration: 150 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1),
			ease: 'Sine.easeInOut',
			yoyo: true,
		});
	}

	/**
	 * Format currency value for display
	 */
	private formatCurrency(amount: number): string {
		if (amount === 0) {
			return '$ 0.00';
		}
		
		// Format with commas for thousands and 2 decimal places
		const formatted = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
		
		return formatted;
	}

	private getCachedPreBonusWins(): number {
		const symbolsComponent = (this.bonusHeaderContainer?.scene as any)?.symbols;
		const cachedValue = symbolsComponent?.cachedPreBonusWins;
		return typeof cachedValue === 'number' && !Number.isNaN(cachedValue) ? cachedValue : 0;
	}

	/**
	 * Get current winnings amount
	 */
	public getCurrentWinnings(): number {
		return this.currentWinnings;
	}

	/**
	 * Reset winnings display to zero
	 */
	public resetWinnings(): void {
		this.updateWinningsDisplay(0);
	}

	/**
	 * Initialize winnings display when bonus header starts
	 */
	public initializeWinnings(): void {
		console.log('[BonusHeader] Initializing winnings display - starting hidden');
		this.currentWinnings = this.getCachedPreBonusWins();
		this.hideWinningsDisplay();
	}

	/**
	 * Hide winnings display at the start of a new spin (like regular header)
	 */
	public hideWinningsForNewSpin(): void {
		console.log('[BonusHeader] Hiding winnings display for new spin');
		this.hideWinningsDisplay();
	}

	/**
	 * Set up event listener for winnings updates from backend (like regular header)
	 */
	private setupWinningsEventListener(): void {
		gameEventManager.on(GameEventType.UPDATE_MULTIPLIER_VALUE, (data: GameEventData) => {
			// Ensure `data` is of the expected type before processing
			if (!data || typeof (data as UpdateMultiplierValueEventData).multiplier !== "number") {
				console.warn('[BonusHeader] UPDATE_MULTIPLIER_VALUE received with invalid data:', data);
				return;
			}

			if (!gameStateManager.isBonus) {
				this.currentMultiplier = 0;
				this.didMultiplierUpdateForCurrentTumble = false;
				this.updateMultiplierValue(this.currentMultiplier);

				return;
			}

			const multiplier = (data as UpdateMultiplierValueEventData).multiplier;
			this.didMultiplierUpdateForCurrentTumble = true;

			// Accumulate the multiplier value within the bonus
			this.currentMultiplier = this.currentMultiplier > 0 ? this.currentMultiplier + multiplier : multiplier;
			this.updateMultiplierValue(this.currentMultiplier);

			// During multiplier updates, show the equation:
			// baseWinnings * multiplier = baseWinnings * multiplier
			const baseWinnings = this.currentBaseWinnings;
			const multipliedWinnings = baseWinnings * this.currentMultiplier;

			console.log(`[BonusHeader] Multiplier Updated (bonus): base=${baseWinnings}, multiplier=${this.currentMultiplier}, product=${multipliedWinnings}, currentTotal=${this.currentWinnings}`);

			const formattedBaseWinnings = this.formatCurrency(baseWinnings);
			const formattedMultipliedWinnings = this.formatCurrency(multipliedWinnings);

			this.scene.time.delayedCall(250 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1), () => {
				// Use a separate text object to render the total winnings in green
				this.updateWinningsDisplayEquation(
					`${formattedBaseWinnings}  x  ${this.currentMultiplier}  =  `,
					formattedMultipliedWinnings
				);
			});
		});

		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[BonusHeader] REELS_START received');

			const cachedPreBonusWins = this.getCachedPreBonusWins();
			if (this.currentWinnings <= 0 && cachedPreBonusWins > 0) {
				this.currentWinnings = cachedPreBonusWins;
			}

			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			const spinData = symbolsComponent?.currentSpinData;
			if(spinData) {
				const freeSpin = spinData.slot?.freeSpin || spinData.slot?.freespin;
				// add all tumble item wins
				const tumbleItems = spinData.slot.tumbles?.items;
				const tumbleWins = tumbleItems !== undefined && tumbleItems.length > 0 ? tumbleItems.reduce((sum, item) => sum + item.win, 0) : 0;
				if(freeSpin && this.currentWinnings <= 0) {
					this.currentWinnings += freeSpin.multiplierValue ?? 0;
				}
				if (tumbleWins > 0) {
					this.currentWinnings += tumbleWins;
				}
				console.log(`[BonusHeader] REELS_START: free spin multiplier: ${freeSpin?.multiplierValue}, tumble wins: ${tumbleWins}, total winnings: ${this.currentWinnings}`);
			}
			
			// On reels start, roll the last tumble's winnings into the running total.
			// If there was no multiplier update for that tumble, do NOT multiply the base winnings.
			if (this.currentBaseWinnings !== 0) {
				const addedWinnings = this.didMultiplierUpdateForCurrentTumble
				? this.currentBaseWinnings * Math.max(1, this.currentMultiplier)
				: this.currentBaseWinnings;
				this.currentWinnings += addedWinnings;
				console.log(`[BonusHeader] REELS_START: applying base=${this.currentBaseWinnings}${this.didMultiplierUpdateForCurrentTumble ? ` * multiplier=${this.currentMultiplier}` : ''} => +${addedWinnings}, new total=${this.currentWinnings}`);

				// Clear base winnings after they have been applied
				this.currentBaseWinnings = 0;
				this.didMultiplierUpdateForCurrentTumble = false;
			}

			// Then update the display to show the total win
			this.updateDisplayTextToTotalWin(this.currentWinnings);
		});

		// Listen for win dialog close
		// NOTE: During bonus, we must NOT reset currentWinnings here – it should
		// only be cleared once the bonus round has actually ended.
		gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
			console.log('[BonusHeader] WIN_DIALOG_CLOSED received');

			if (gameStateManager.isBonus) {
				console.log('[BonusHeader] Bonus active – keeping total winnings on screen');

				this.updateCurrentWinnings();

				if (this.currentWinnings > 0) {
					this.updateDisplayTextToTotalWin(this.currentWinnings);
				}

				return;
			}

			// Outside of bonus, it's safe to reset like the regular header does
			console.log('[BonusHeader] Not in bonus – resetting winnings display');
		});

		// On WIN_START during bonus, show the current tumble winnings (base winnings before multiplier)
		gameEventManager.on(GameEventType.WIN_START, () => {
			if (!gameStateManager.isBonus) {
				return;
			}

			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			const spinData = symbolsComponent?.currentSpinData;

			if (!symbolsComponent || !spinData) {
				return;
			}
			
			// New tumble starts accumulating base winnings; reset per-tumble multiplier-update tracking.
			this.didMultiplierUpdateForCurrentTumble = false;

			const fsIndex = this.scene.gameAPI.getCurrentFreeSpinIndex() - 1;
			const freespinItem = spinData?.slot?.freespin?.items?.[fsIndex];

			// Base winnings for the CURRENT tumble (before multiplier is applied)
			const baseWinnings = freespinItem?.tumble?.items[this.scene.gameAPI.getCurrentTumbleIndex()].win ?? 0;

			// On win start, track just the current tumble's base winnings
			this.currentBaseWinnings += baseWinnings;

			const updateDelay = 700 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1);
			this.scene.time.delayedCall(updateDelay, () => {
				this.youWonText.setText('YOU WIN');
				// Display the current tumble winnings
				this.updateWinningsDisplay(this.currentBaseWinnings);
			});
		});

		// On REELS_STOP during bonus, mimic the multiplier update equation display,
		// but show it immediately (no additional delay).
		gameEventManager.on(GameEventType.REELS_STOP, () => {
			if (!gameStateManager.isBonus) {
				return;
			}

			// Check the current free-spin tumble's multiplier value from spin data.
			// Reference shape: see BONUS_FREE_SPIN_TEST_DATA in TestSpinData.ts
			// slot.freeSpin/freespin.items[freeSpinIndex].tumble.multiplier
			let currentTumbleMultiplier = 0;
			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			const spinData = symbolsComponent?.currentSpinData;

			if (symbolsComponent && spinData?.slot?.freespin?.items) {
				const fsIndex = this.scene.gameAPI.getCurrentFreeSpinIndex() - 1;
				const freespinItem = spinData.slot.freespin.items[fsIndex];
				currentTumbleMultiplier = freespinItem?.tumble?.multiplier ?? 0;
			}

			// If the current tumble *does* have a multiplier, UPDATE_MULTIPLIER_VALUE should be emitted
			// and will handle the equation display. This REELS_STOP path is only for tumbles where the
			// multiplier doesn't change.
			if (currentTumbleMultiplier > 0) {
				console.log('[BonusHeader] REELS_STOP: tumble has multiplier update, skipping no-change handling');
				return;
			}

			if(this.currentMultiplier <= 0) {
				console.log('[BonusHeader] REELS_STOP: no current multiplier, skipping no-change handling');
				return;
			}

			if (this.currentBaseWinnings <= 0) {
				console.log('[BonusHeader] REELS_STOP: no current base winnings, skipping no-change handling');
				return;
			}
			
			// New behavior: when the multiplier doesn't change, do NOT show an equation and do NOT
			// multiply the base winnings. Display the base winnings as-is.
			this.updateWinningsDisplay(this.currentBaseWinnings);

			if(gameStateManager.isBonusFinished)
			{
				this.updateCurrentWinnings();

				this.scene.time.delayedCall(1000, () => {
					this.updateDisplayTextToTotalWin(this.currentWinnings);
				});
			}
		});
	}

	private updateCurrentWinnings(): void {
		if(this.currentBaseWinnings > 0)
		{			
			this.currentWinnings += this.didMultiplierUpdateForCurrentTumble
			? this.currentBaseWinnings * Math.max(1, this.currentMultiplier)
			: this.currentBaseWinnings;
			this.currentBaseWinnings = 0;
			this.didMultiplierUpdateForCurrentTumble = false;
		}
	}

	private resetBonusDisplayState(isBonus: boolean = false): void {
		this.currentWinnings = isBonus ? this.getCachedPreBonusWins() : 0;
		this.currentBaseWinnings = 0;
		this.currentMultiplier = 0;
		this.didMultiplierUpdateForCurrentTumble = false;
		this.hideWinningsDisplay();
		this.resetMultiplierValue();
	}

	resetMultiplierValue() {
		this.currentMultiplier = 0;
		this.updateMultiplierValue(this.currentMultiplier);
	}

	updateMultiplierValue(multiplier: number) {
		if(multiplier > 0) {
			this.showMultiplierText();
		} else {
			this.hideMultiplierText();
		}
		
		const displayValue = multiplier > 0 ? multiplier : 1;
		this.multiplierDisplay?.displayValue(displayValue);
	}

	updateDisplayTextToTotalWin(totalWin: number) : void{
		this.youWonText.setText('TOTAL WIN');
		// Render total win value in green (and rely on other display paths to reset to white)
		this.updateWinningsDisplay(totalWin, false);
		this.amountText?.setColor(this.totalAmountTextColor);
		// For green total win, use the same theme stroke
		this.amountText?.setStroke(this.textStrokeColor, this.textStrokeThickness);
	}

	/**
	 * Update winnings display with subTotalWin from current spin data
	 * Hides display when no subTotalWin (similar to regular header behavior)
	 */
	public updateWinningsFromSpinData(spinData: any): void {
		if (!spinData) {
			console.warn('[BonusHeader] No spin data provided for winnings update');
			this.hideWinningsDisplay();
			return;
		}

		// Check if this is a free spin with subTotalWin
		if (spinData.slot?.freespin?.items && spinData.slot.freespin.items.length > 0) {
			// Find the current free spin item (usually the first one with spinsLeft > 0)
			const currentFreeSpinItem = spinData.slot.freespin.items.find((item: any) => item.spinsLeft > 0);
			
			if (currentFreeSpinItem && currentFreeSpinItem.subTotalWin !== undefined) {
				const subTotalWin = currentFreeSpinItem.subTotalWin;
				console.log(`[BonusHeader] Found subTotalWin: $${subTotalWin}`);
				
				// Only show display if subTotalWin > 0, otherwise hide it
				if (subTotalWin > 0) {
					console.log(`[BonusHeader] Showing winnings display with subTotalWin: $${subTotalWin}`);
					this.updateWinningsDisplay(subTotalWin);
				} else {
					console.log(`[BonusHeader] subTotalWin is 0, hiding winnings display`);
					this.hideWinningsDisplay();
				}
				return;
			}
		}

		// Fallback: calculate from aggregate SpinData if no subTotalWin available
		const totalWin = this.calculateTotalWinFromPaylines(spinData as SpinData);
		console.log(`[BonusHeader] Calculated aggregate total win from SpinData: $${totalWin}`);

		// Only show display if totalWin > 0, otherwise hide it
		if (totalWin > 0) {
			console.log(`[BonusHeader] Showing winnings display with aggregate calculation: $${totalWin}`);
			this.updateWinningsDisplay(totalWin);
		} else {
			console.log(`[BonusHeader] No wins found in SpinData, hiding winnings display`);
			this.hideWinningsDisplay();
		}
	}

	/**
	 * Calculate total win using SpinData (base paylines or all free spins)
	 */
	private calculateTotalWinFromPaylines(spinData: SpinData): number {
		if (!spinData) {
			return 0;
		}

		return SpinDataUtils.getAggregateTotalWin(spinData);
	}

	private hideMultiplierText(): void {
		this.multiplierDisplay?.setVisible(false);
	}

	private showMultiplierText(): void {
		this.multiplierDisplay?.setVisible(true);
	}

	resize(scene: Scene): void {
		if (this.bonusHeaderContainer) {
			this.bonusHeaderContainer.setSize(scene.scale.width, scene.scale.height);
		}

		// Update spotlight bounds on resize
		if (this.spotlight && this.spotlightBounds) {
			const screenConfig = this.screenModeManager.getScreenConfig();
			
			if (screenConfig.isPortrait) {
				this.spotlightBounds = {
					minX: scene.scale.width * 0.2,
					maxX: scene.scale.width * 0.8,
					minY: scene.scale.height * 0.08,
					maxY: scene.scale.height * 0.25
				};
			} else {
				this.spotlightBounds = {
					minX: scene.scale.width * 0.1,
					maxX: scene.scale.width * 0.9,
					minY: scene.scale.height * 0.1,
					maxY: scene.scale.height * 0.6
				};
			}
		}

        this.fitLogoToTop(scene, 0.30);
	}

    private fitLogoToTop(scene: Scene, scale: number): void {
        if (!this.logoImage) return;
        const screenWidth = scene.scale.width;
        const screenHeight = scene.scale.height;
        const frame = this.logoImage.frame;
        const imageWidth = frame?.width || 0;
        const imageHeight = frame?.height || 0;
        if (!imageWidth || !imageHeight) return;

        // Choose a width ratio that looks good across devices
        const widthRatio = scale; // % of screen width
        const targetWidth = screenWidth * widthRatio;
        const uniformScale = targetWidth / imageWidth;

        this.logoImage.setScale(uniformScale); // preserves aspect ratio
        this.logoImage.setOrigin(0.5, 0);
        const topMargin = Math.max(0, screenHeight * 0.005);
        this.logoImage.setPosition(screenWidth * 0.5, topMargin);
    }

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusHeaderContainer;
	}

	destroy(): void {
		if (this.scene?.events) {
			this.scene.events.off('setBonusMode', this.handleBonusModeToggle);
		}

		if (this.bonusHeaderContainer) {
			this.bonusHeaderContainer.destroy();
		}
	}
}
