import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { Data } from "../../tmp_backend/Data";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { PaylineData } from '../../backend/SpinData';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { hideSpineAttachmentsByKeywords, playSpineAnimationSequenceWithConfig } from "./SpineBehaviorHelper";
import { Game } from "../scenes/Game";
import { NumberDisplay, NumberDisplayConfig } from "./NumberDisplay";
import { TurboConfig } from "../../config/TurboConfig";

export class Header {
	// DEBUGGING
	public showMultiplierWireframe: boolean = false;
	private multiplierWireframe: Phaser.GameObjects.Graphics | null = null;

	private headerContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private amountText: Phaser.GameObjects.Text;
	private amountTotalText: Phaser.GameObjects.Text | null = null;
	private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	private pendingWinnings: number = 0;
	private multiplierDisplay: NumberDisplay | null = null;
	private scene: Game;
	private currentMultiplier: number = 0;

	// Slightly adjusted for larger font sizes (amount +2px, label +2px)
	private winningsLabelTextOffset: {x: number, y: number} = {x: 0, y: -16};
	private winningsValueTextOffset: {x: number, y: number} = {x: 0, y: 7};
	private multiplierNumberDisplayOffset: {x: number, y: number} = {x: 12, y: 0};

	private totalAmountTextColor: string = '#00ff00';
	// Theme-contrasting outline used across the UI (see SlotController/Preloader)
	private textStrokeColor: string = '#004400'; // dark green
	private textStrokeThickness: number = 2;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Header] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		this.scene = scene as Game;
		console.log("[Header] Creating header elements");
		
		// Create main container for all header elements
		this.headerContainer = scene.add.container(0, 0);
		this.headerContainer.setDepth(501); // Above idle symbols (0) but below winning symbols (600) and overlay (500)
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Header] Creating header with scale: ${assetScale}x`);

		// Add header elements
		this.createHeaderElements(scene, assetScale);
		
		// Set up event listeners for winnings updates
		this.setupWinningsEventListener();	
		this.resetMultiplierValue();
	}

	private createHeaderElements(scene: Scene, assetScale: number): void {
		// Add logo spine
		this.createLogoImage(scene, assetScale);

		// Add win bar last to ensure it appears on top
		const winBarWidthRatio = 0.5;
		const winBarHeightRatio = 0.2125;
		const winBarX = scene.scale.width * winBarWidthRatio;
		const winBarY = scene.scale.height * winBarHeightRatio;
		this.createWinBar(scene, winBarX, winBarY, assetScale);
		this.createWinBarText(scene, winBarX, winBarY);

		// Add multiplier bar
		const multiplierBarWidthRatio = 0.775;
		const multiplierBarHeightRatio = 0.1725;
		const multiplierBarX = scene.scale.width * multiplierBarWidthRatio;
		const multiplierBarY = scene.scale.height * multiplierBarHeightRatio;
		this.createMultiplierBar(scene, multiplierBarX, multiplierBarY, assetScale);
		this.createMultiplierDisplay(scene, multiplierBarX, multiplierBarY);

		this.scene.time.delayedCall(1000, () => {
			this.updateWinningsDisplay(20000);
		});
	}

	private createMultiplierBar(scene: Scene, x: number, y: number, assetScale: number): void {
		const multiplierBar = scene.add.image(x, y, 'multiplier-bar')
		.setOrigin(0.5, 0.5)
		.setScale(assetScale * 1.2)
		.setDepth(300); // Above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(multiplierBar);
	}

	private createMultiplierDisplay(scene: Scene, x: number, y: number): void {
		const displayX = x + this.multiplierNumberDisplayOffset.x;
		const displayY = y + this.multiplierNumberDisplayOffset.y;

		if(this.showMultiplierWireframe) {
			this.multiplierWireframe = this.createMultiplierWireframe(scene, displayX, displayY);
		}

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
			container.setDepth(301); // Above idle symbols (0) but below winning symbols (600) and overlay (500)
			this.headerContainer.add(container);
		}

		this.multiplierDisplay.displayValue(1);
		this.hideMultiplierText();
	}

	private createMultiplierWireframe(scene: Scene, x: number, y: number): Phaser.GameObjects.Graphics {
		const wireframeSize = 10;
		const halfSize = wireframeSize / 2;

		const wireframe = scene.add.graphics({ x, y });
		wireframe.lineStyle(1, 0xffffff, 1);
		wireframe.strokeRect(-halfSize, -halfSize, wireframeSize, wireframeSize);
		wireframe.setDepth(300);

		this.headerContainer.add(wireframe);

		return wireframe;
	}

	private createWinBar(scene: Scene, winBarX: number, winBarY: number, assetScale: number): void {
		const winBar = scene.add.image(winBarX, winBarY, 'win-bar')
		.setOrigin(0.5, 0.5)
		.setScale(assetScale)
		.setDepth(501); // Above idle symbols (0) but below winning symbols (600) and overlay (500)

		this.headerContainer.add(winBar);
	}	

	private createLogoSpine(scene: Scene): void {
		try {
			// Make sure the spine data is in cache before trying to create it
			const cacheJson: any = (scene as any).cache?.json;
			if (!cacheJson?.has('warfreaks-logo-spine')) {
				console.warn('[Header] Spine json \'warfreaks-logo-spine\' not ready. Skipping header logo spine.');
				return;
			}
	
			const spine = scene.add.spine(0, 0, 'warfreaks-logo-spine', 'warfreaks-logo-spine-atlas') as SpineGameObject;
			const scale = 0.7;
			const offset = { x: 0, y: 12.5 };
			const anchor = { x: 0.5, y: 0 };
			const origin = { x: 0.5, y: 0 };
	
			playSpineAnimationSequenceWithConfig(scene, spine, [0], { x: scale, y: scale }, anchor, origin, offset);
	
			this.headerContainer.add(spine);
		} catch (error) {
			console.warn('[Header] Failed to create header logo spine:', error);
		}
	}

	private createLogoImage(scene: Scene, assetScale: number): void {
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.0225,
			'logo'
		).setOrigin(0.5, 0).setScale(1).setDepth(300); // Above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(logo);
	}

	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x + this.winningsLabelTextOffset.x, y + this.winningsLabelTextOffset.y, 'YOU WON', {
			fontSize: '14px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular',
		}).setOrigin(0.5, 0.5).setDepth(301); // Higher depth than win bar, above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting (base winnings / expression prefix)
		this.amountText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, '$ 0.00', {
			fontSize: '22px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0.5, 0.5).setDepth(301); // Higher depth than win bar, above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(this.amountText);

		// Separate text object for the total winnings part (shown in green)
		this.amountTotalText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, '', {
			fontSize: '22px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0, 0.5).setDepth(301); // Above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.amountTotalText.setVisible(false);
		this.headerContainer.add(this.amountTotalText);
	}

	resize(scene: Scene): void {
		if (this.headerContainer) {
			this.headerContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.headerContainer;
	}

	/**
	 * Set up event listener for winnings updates from backend
	 */
	private setupWinningsEventListener(): void {
		gameEventManager.on(GameEventType.UPDATE_MULTIPLIER_VALUE, (data: GameEventData) => {
			// Ensure `data` is of the expected type before processing
			if (!data || typeof (data as UpdateMultiplierValueEventData).multiplier !== "number") {
				console.warn('[Header] UPDATE_MULTIPLIER_VALUE received with invalid data:', data);
				return;
			}

			if(gameStateManager.isBonus) {
				this.currentMultiplier = 0;
				this.updateMultiplierValue(this.currentMultiplier);
				
				return;
			}

			const multiplier = (data as UpdateMultiplierValueEventData).multiplier;
			console.log('[Header] UPDATE_MULTIPLIER_VALUE received - updating multiplier value', data);
			
			this.currentMultiplier = this.currentMultiplier > 0 ? this.currentMultiplier + multiplier : multiplier;
			this.updateMultiplierValue(this.currentMultiplier);

			this.scene.time.delayedCall(250 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1), () => {
				const formattedTotalWinnings = this.formatCurrency(this.currentWinnings * this.currentMultiplier);
				const formattedCurrentWinnings = this.formatCurrency(this.currentWinnings);

				// Use a separate text object to render the total winnings in green
				this.updateWinningsDisplayAsText(
					`${formattedCurrentWinnings}  x  ${this.currentMultiplier}  =  `,
					formattedTotalWinnings
				);
			});
		});

		// When the win sequence completes, the displayed winnings represent the total win for the spin.
		// Color that total in green; other update paths (e.g. WIN_START/REELS_START) reset back to white.
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			// If we're currently showing an equation (prefix + separate total), the total is already green.
			if (this.amountTotalText?.visible) {
				return;
			}

			if (this.amountText && this.currentWinnings > 0) {
				this.amountText.setColor(this.totalAmountTextColor);
				// For green total win, use the same theme stroke
				this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			}
		});

		// Note: SPIN_RESPONSE event listener removed - now using SPIN_DATA_RESPONSE

		// Listen for spin events to hide winnings display at start of manual spin
		gameEventManager.on(GameEventType.SPIN, () => {
			console.log('[Header] Manual spin started - showing winnings display');
			
			// CRITICAL: Block autoplay spin actions if win dialog is showing, but allow manual spins
			// This fixes the timing issue where manual spin winnings display was blocked
			if (gameStateManager.isShowingWinDialog && gameStateManager.isAutoPlaying) {
				console.log('[Header] Autoplay SPIN event BLOCKED - win dialog is showing');
				console.log('[Header] Manual spins are still allowed to proceed');
				return;
			}
			
			// Show the winnings display with the stored winnings
			this.hideWinningsDisplay();
			this.pendingWinnings = this.currentWinnings;
		});

		// Listen for autoplay start to hide winnings display
		gameEventManager.on(GameEventType.AUTO_START, () => {
			console.log('[Header] Auto play started - showing winnings display');
			this.hideWinningsDisplay();
		});

		// Listen for reels start to hide winnings display
		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[Header] Reels started - hiding winnings display');
			this.hideWinningsDisplay();
			this.currentWinnings = 0;
			this.resetMultiplierValue();
		});

		gameEventManager.on(GameEventType.WIN_START, () => {
			console.log('[Header] WIN_START received - showing winnings display');

			const symbolsComponent = (this.headerContainer.scene as any).symbols;
			if(symbolsComponent && symbolsComponent.currentSpinData) {
				const spinData = symbolsComponent.currentSpinData;
				const winnings = spinData?.slot?.tumbles?.items[this.scene.gameAPI.getCurrentTumbleIndex()]?.win || 0;

				console.log(`[Header] Current winnings: ${winnings} ${this.scene.gameAPI.getCurrentTumbleIndex()}`);

				if(this.currentWinnings > 0) {
					this.currentWinnings += winnings;
					this.updateWinningsDisplay(this.currentWinnings);
				} else {
					this.currentWinnings += winnings;
					this.showWinningsDisplay(this.currentWinnings);
				}
			}
		});
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

	/**
	 * Update the winnings display in the header
	 */
	public updateWinningsDisplay(winnings: number): void {
		if (this.amountText) {
			this.currentWinnings = winnings;
			const formattedWinnings = this.formatCurrency(winnings);

			// Reset color to default white for regular winnings display
			this.amountText.setColor('#ffffff');
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.scene.scale.width * 0.5, this.amountText.y);
			console.log(`[Header] Winnings updated to: ${formattedWinnings} (raw: ${winnings})`);

			// Hide and clear the separate total text when not showing the expression
			if (this.amountTotalText) {
				this.amountTotalText.setVisible(false);
				this.amountTotalText.setText('');
			}

			this.animateWinningsDisplay(this.amountText);
		}
	}

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
			
			console.log('[Header] Winnings display hidden');
		} else {
			console.warn('[Header] Cannot hide winnings display - text objects not available', {
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
			this.currentWinnings = winnings;
			const formattedWinnings = this.formatCurrency(winnings);
			
			// Reset color to default white when showing standard winnings
			this.amountText.setColor('#ffffff');
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);

			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			this.amountText.setPosition(this.scene.scale.width * 0.5, this.amountText.y);
			
			// Update amount text with winnings
			this.amountText.setText(formattedWinnings);
			console.log(`[Header] Winnings display shown: ${formattedWinnings} (raw: ${winnings})`);

			// Hide and clear the separate total text when showing standard winnings
			if (this.amountTotalText) {
				this.amountTotalText.setVisible(false);
				this.amountTotalText.setText('');
			}
		} else {
			console.warn('[Header] Cannot show winnings display - text objects not available', {
				amountText: !!this.amountText,
				youWonText: !!this.youWonText
			});
		}
	}

	public animateWinningsDisplay(target: any): void {
		this.scene.tweens.add({
			targets: target,
			scaleX: 1.25,
			scaleY: 1.25,
			duration: 250,
			ease: 'Sine.easeInOut',
			yoyo: true,
		});
	}

	private hideMultiplierText(): void {
		this.multiplierDisplay?.setVisible(false);
	}

	private showMultiplierText(): void {
		this.multiplierDisplay?.setVisible(true);
	}

	/**
	 * Calculate total winnings from paylines array
	 */
	private calculateTotalWinningsFromPaylines(paylines: PaylineData[]): number {
		if (!paylines || paylines.length === 0) {
			return 0;
		}
		
		const totalWin = paylines.reduce((sum, payline) => {
			const winAmount = payline.win || 0;
			console.log(`[Header] Payline ${payline.lineKey}: ${winAmount} (symbol ${payline.symbol}, count ${payline.count})`);
			return sum + winAmount;
		}, 0);
		
		console.log(`[Header] Calculated total winnings: ${totalWin} from ${paylines.length} paylines`);
		return totalWin;
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
	 * Debug method to check the current state of text objects
	 */
	public debugTextObjects(): void {
		console.log('[Header] Debug - Text objects state:', {
			amountText: {
				exists: !!this.amountText,
				visible: this.amountText?.visible,
				text: this.amountText?.text,
				alpha: this.amountText?.alpha
			},
			youWonText: {
				exists: !!this.youWonText,
				visible: this.youWonText?.visible,
				text: this.youWonText?.text,
				alpha: this.youWonText?.alpha
			},
			currentWinnings: this.currentWinnings
		});
	}

	/**
	 * Initialize winnings display when game starts
	 */
	public initializeWinnings(): void {
		console.log('[Header] Initializing winnings display - starting hidden');
		this.currentWinnings = 0;
		
		// Debug the text objects to make sure they exist
		this.debugTextObjects();
		
		this.hideWinningsDisplay();
	}
}
