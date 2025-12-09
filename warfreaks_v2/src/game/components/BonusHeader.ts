import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { SpinData, SpinDataUtils } from "../../backend/SpinData";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { hideSpineAttachmentsByKeywords, playSpineAnimationSequence } from "./SpineBehaviorHelper";
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
	private xTextOffset: number = 5;
	private readonly handleBonusModeToggle = (isBonus: boolean) => {
		if (typeof isBonus !== 'boolean') {
			return;
		}

		console.log(`[BonusHeader] Bonus mode ${isBonus ? 'started' : 'ended'} - resetting display state`);
		this.resetBonusDisplayState();
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
		this.createLogoSpine(scene);

		// Add text inside the win bar bonus
		const winBarBonusWidthMultiplier = 0.51;
		const winBarBonusHeightMultiplier = 0.205;
		const winBarX = scene.scale.width * winBarBonusWidthMultiplier;
		const winBarY = scene.scale.height * winBarBonusHeightMultiplier;
		this.createWinBar(scene, winBarX, winBarY, assetScale);
		this.createWinBarText(scene, winBarX, winBarY);

		// Add multiplier bar
		const multiplierBarWidthMultiplier = 0.74;
		const multiplierBarHeightMultiplier = 0.155;
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
		const multiplierConfig: NumberDisplayConfig = {
			x,
			y,
			scale: 0.055,
			prefixScale: 0.04,
			prefixYOffset: 1.5,
			spacing: 2,
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
            0,
            'logo-bonus'
        ).setOrigin(0.5, 0).setDepth(10);
        this.fitLogoToTop(scene, 0.3);
        this.bonusHeaderContainer.add(this.logoImage);
	}
	
	private createLogoSpine(scene: Scene): void {
		const spine = scene.add.spine(0, 0, 'warfreaks-logo-spine', 'warfreaks-logo-spine-atlas') as SpineGameObject;
		const scale = 0.7;
		const offset = {x: 0, y: 12.5};
		const anchor = {x: 0.5, y: 0};
		const origin = {x: 0.5, y: 0};

		playSpineAnimationSequence(scene, spine, [0], {x: scale, y: scale}, anchor, origin, offset);

		this.bonusHeaderContainer.add(spine);
	}

	private createWinBar(scene: Scene, x: number, y: number, assetScale: number): void {
		const winBarBonus = scene.add.image(
			x,
			y,
			'win-bar-bonus'
		).setOrigin(0.5, 0.5)
		.setScale(assetScale)
		.setDepth(10);
		this.bonusHeaderContainer.add(winBarBonus);
	}


	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x, y - 10, 'YOU WON', {
			fontSize: '12px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting
		this.amountText = scene.add.text(x, y + 6, '$ 999,999,999,999.00', {
			fontSize: '20px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.amountText);

		// Separate text object for the total winnings part (shown in green)
		this.amountTotalText = scene.add.text(x, y + 6, '', {
			fontSize: '20px',
			color: '#00ff00',
			fontFamily: 'Poppins-Bold'
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
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.scene.scale.width * 0.5 + this.xTextOffset, this.amountText.y);
			
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

			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			
			// Update amount text with winnings
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.scene.scale.width * 0.5 + this.xTextOffset, this.amountText.y);
			
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
		if (this.amountText) {
			// Base expression (e.g. "$ 10.00  x  5  =  ") stays white
			this.amountText.setColor('#ffffff');
			this.amountText.setText(prefixText);
			this.amountText.setVisible(true);
		}

		if (this.amountTotalText) {
			// Total winnings (e.g. "$ 50.00") is rendered separately in green
			this.amountTotalText.setColor('#00ff00');
			this.amountTotalText.setText(totalText);
			this.amountTotalText.setVisible(true);

			const baseX = this.scene.scale.width * 0.5 + this.xTextOffset;
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
			return '$0.00';
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
		this.currentWinnings = 0;
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
				this.updateMultiplierValue(this.currentMultiplier);

				return;
			}

			const multiplier = (data as UpdateMultiplierValueEventData).multiplier;

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

			if(this.currentWinnings <= 0) {
                const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
                const spinData = symbolsComponent?.currentSpinData;
                if(spinData) {
                    const freeSpin = spinData.slot?.freeSpin || spinData.slot?.freespin;
                    // add all tumble item wins
                    const tumbleItems = spinData.slot.tumbles?.items;
                    const tumbleWins = tumbleItems !== undefined && tumbleItems.length > 0 ? tumbleItems.reduce((sum, item) => sum + item.win, 0) : 0;
                    if(freeSpin) {
                        this.currentWinnings += freeSpin.multiplierValue ?? 0;
                    }
                    this.currentWinnings += tumbleWins;
                    console.log(`[BonusHeader] REELS_START: free spin multiplier: ${freeSpin.multiplierValue}, tumble wins: ${tumbleWins}, total winnings: ${this.currentWinnings}`);
                }
            }

			// On reels start, if baseWinnings != 0, add baseWinnings * multiplier to currentWinnings
			if (this.currentBaseWinnings !== 0) {
				const addedWinnings = this.currentBaseWinnings * Math.max(1, this.currentMultiplier);
				this.currentWinnings += addedWinnings;
				console.log(`[BonusHeader] REELS_START: applying base=${this.currentBaseWinnings} * multiplier=${this.currentMultiplier} => +${addedWinnings}, new total=${this.currentWinnings}`);

				// Clear base winnings after they have been applied
				this.currentBaseWinnings = 0;
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

			const fsIndex = this.scene.gameAPI.getCurrentFreeSpinIndex() - 1;
			const freespinItem = spinData?.slot?.freespin?.items?.[fsIndex];

			// Base winnings for the CURRENT tumble (before multiplier is applied)
			const baseWinnings = freespinItem?.tumble?.items[this.scene.gameAPI.getCurrentTumbleIndex() - 1].win ?? 0;

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

			// If there is no multiplier for the current tumble, skip showing the
			// multiplier equation here to avoid using a stale/incorrect value.
			if (currentTumbleMultiplier > 0) {
				console.log('[BonusHeader] REELS_STOP: no current free-spin tumble multiplier, skipping equation display');
				return;
			}

			if(this.currentMultiplier <= 0) {
				console.log('[BonusHeader] REELS_STOP: no current multiplier, skipping equation display');
				return;
			}

			if (this.currentBaseWinnings <= 0) {
				console.log('[BonusHeader] REELS_STOP: no current base winnings, skipping equation display');
				return;
			}

			const baseWinnings = this.currentBaseWinnings;
			const multipliedWinnings = baseWinnings * Math.max(1, this.currentMultiplier);
			const formattedBaseWinnings = this.formatCurrency(baseWinnings);
			const formattedMultipliedWinnings = this.formatCurrency(multipliedWinnings);

			// Immediately show the same style equation used in UPDATE_MULTIPLIER_VALUE,
			// but without the delayedCall.
			this.updateWinningsDisplayEquation(
				`${formattedBaseWinnings}  x  ${this.currentMultiplier}  =  `,
				formattedMultipliedWinnings
			);

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
			this.currentWinnings += this.currentBaseWinnings * Math.max(1, this.currentMultiplier);
			this.currentBaseWinnings = 0;
		}
	}

	private resetBonusDisplayState(): void {
		this.currentWinnings = 0;
		this.currentBaseWinnings = 0;
		this.currentMultiplier = 0;
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
		this.updateWinningsDisplay(totalWin, false);
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
