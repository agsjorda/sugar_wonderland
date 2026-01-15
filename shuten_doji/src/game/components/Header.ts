import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { GameEventData, gameEventManager, GameEventType, UpdateMultiplierValueEventData } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { Game } from "../scenes/Game";
import { NumberDisplay, NumberDisplayConfig } from "./NumberDisplay";
import { TurboConfig } from "../../config/TurboConfig";
import { GameData } from "./GameData";
import { IMAGE_SHINE_PIPELINE_KEY } from "../shaders/ImageShinePipeline";

export class Header {
	// DEBUGGING
	public showMultiplierWireframe: boolean = false;
	private multiplierWireframe: Phaser.GameObjects.Graphics | null = null;

	private headerContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private winBarImage?: Phaser.GameObjects.Image;
	private winBarBackplate?: Phaser.GameObjects.Rectangle;
	private amountText: Phaser.GameObjects.Text;
	private amountTotalText: Phaser.GameObjects.Text | null = null;
	private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	private pendingWinnings: number = 0;
	private multiplierDisplay: NumberDisplay | null = null;
	private scene: Game;
	private currentMultiplier: number = 0;
	private winBarCenterX: number = 0;
	private yTextOffset: number = 20;

	// Slightly adjusted for larger font sizes (amount +2px, label +2px)
	private winningsLabelTextOffset: {x: number, y: number} = {x: 0, y: -14};
	private winningsValueTextOffset: {x: number, y: number} = {x: 0, y: 8};
	private multiplierNumberDisplayOffset: {x: number, y: number} = {x: 0, y: 0};

	// Win amount text base color (spec)
	private totalAmountTextColor: string = '#FFB837';
	// Text outline (spec)
	private textStrokeColor: string = '#99030A';
	private textStrokeThickness: number = 3;
	private logoImage: Phaser.GameObjects.Image;

	private getWinningsCenterX(): number {
		return this.winBarCenterX || this.scene?.scale?.width * 0.5 || 0;
	}

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
		// Match shuten_doji_old layout ratios/offsets
		const winBarWidthRatio = 0.5;
		const winBarHeightRatio = 0.16;
		const winBarX = scene.scale.width * winBarWidthRatio;
		const winBarY = scene.scale.height * winBarHeightRatio;
		this.winBarCenterX = winBarX;

		// Add win bar first, then place the logo above it (container render order matters)
		this.createWinBar(scene, winBarX, winBarY, assetScale);
		this.createWinBarText(scene, winBarX, winBarY + this.yTextOffset);
		this.createRectangle(scene, winBarX, winBarY);
		if (this.winBarBackplate) {
			this.headerContainer.sendToBack(this.winBarBackplate);
		}

		// Add logo and ensure it's above the win bar in the container's display list
		this.createLogoImage(scene, assetScale);
		if (this.logoImage && this.winBarImage) {
			this.headerContainer.moveAbove(this.logoImage, this.winBarImage);
		}

		// Add multiplier bar
		const multiplierBarWidthRatio = 0.85;
		const multiplierBarHeightRatio = 0.18;
		const multiplierBarX = scene.scale.width * multiplierBarWidthRatio;
		const multiplierBarY = scene.scale.height * multiplierBarHeightRatio;
		this.createMultiplierDisplay(scene, multiplierBarX, multiplierBarY);
	}

	private createMultiplierBar(scene: Scene, x: number, y: number, assetScale: number): void {
		const multiplierBar = scene.add.image(x, y, 'multiplier_bar')
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
			scale: 0.15,
			prefixScale: 0.1,
			prefixYOffset: 0,
			spacing: -10,
			alignment: 'center',
			decimalPlaces: 0,
			showCommas: false,
			prefix: 'x',
			shouldTickUp: false,
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
		const targetWidth = scene.scale.width * 0.99;
		const winBar = scene.add.image(winBarX, winBarY, 'win_bar')
			.setOrigin(0.5, 0.5)
			.setDepth(501); // Above idle symbols (0) but below winning symbols (600) and overlay (500)

		this.winBarImage = winBar;

		const s = winBar.width > 0 ? (targetWidth / winBar.width) : 1;
		winBar.setScale(s * assetScale);

		this.headerContainer.add(winBar);
	}	

	private createRectangle(scene: Scene, x: number, y: number): void {
		const rectangleWidth = scene.scale.width * 0.7;
		const rectangleHeight = scene.scale.height * 0.0675;
		const xOffset = scene.scale.width * 0.25;
		const yOffset = 20;

		this.winBarBackplate = scene.add.rectangle(
			x - xOffset,
			y + yOffset,
			rectangleWidth,
			rectangleHeight,
			0x777777,
			0.5
		)
			.setOrigin(0, 0.5)
			.setDepth(1);

		this.headerContainer.add(this.winBarBackplate);
	}

	private createLogoImage(scene: Scene, assetScale: number): void {
		const logoWidthRatio = 0.8;
		const logoVerticalOffsetRatio = 0.028;
		const logoHorizontalOffsetRatio = 0.55;
		const logo = scene.add.image(
			scene.scale.width * logoHorizontalOffsetRatio,
			scene.scale.height * logoVerticalOffsetRatio,
			'logo'
		).setOrigin(0.5, 0).setDepth(11);
		this.logoImage = logo;

		// Scale logo to a reasonable fraction of screen width
		const targetWidth = scene.scale.width * logoWidthRatio;
		const s = logo.width ? (targetWidth / logo.width) : 1;
		logo.setScale(s * assetScale);

		// Apply shine shader to header logo (uses same preset as Preloader)
		const baseCfg = GameData.LOGO_SHINE_SHADER_CONFIG;
		const thicknessPx = baseCfg.thicknessPx ?? 20;
		logo.setPipeline(IMAGE_SHINE_PIPELINE_KEY, {
			...baseCfg,
			startYPx: logo.displayHeight + thicknessPx * 0.5,
		});

		this.headerContainer.add(logo);
	}

	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x + this.winningsLabelTextOffset.x, y + this.winningsLabelTextOffset.y, 'YOU WON', {
			fontSize: '15px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0.5, 0.5).setDepth(301); // Higher depth than win bar, above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting (base winnings / expression prefix)
		// Check if demo mode is active - if so, use blank currency symbol
		const isDemoInitial = this.scene?.gameAPI?.getDemoState();
		const currencySymbolInitial = isDemoInitial ? '' : '$';
		this.amountText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, `${currencySymbolInitial}${currencySymbolInitial ? ' ' : ''}0.00`, {
			fontSize: '22px',
			color: this.totalAmountTextColor,
			fontFamily: 'Poppins-Bold',
			stroke: this.textStrokeColor,
			strokeThickness: this.textStrokeThickness,
		}).setOrigin(0.5, 0.5).setDepth(301); // Higher depth than win bar, above idle symbols (0) but below winning symbols (600) and overlay (500)
		this.headerContainer.add(this.amountText);

		// Separate text object for the total winnings part (shown in green)
		this.amountTotalText = scene.add.text(x + this.winningsValueTextOffset.x, y + this.winningsValueTextOffset.y, '', {
			fontSize: '22px',
			color: this.totalAmountTextColor,
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
				this.animateWinningsDisplay(this.amountTotalText);
				return;
			}

			if (this.amountText && this.currentWinnings > 0) {
				this.amountText.setColor(this.totalAmountTextColor);
				// For total win, use the configured stroke
				this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
				// Animate the final total win display
				this.animateWinningsDisplay(this.amountText);
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

			const spinData = this.scene.gameAPI.getCurrentSpinData();
			console.log('[Header] spinData: ', spinData);
			if(spinData) {
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

			// Reset to configured winnings color for regular winnings display
			this.amountText.setColor(this.totalAmountTextColor);
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountText.setText(formattedWinnings);
			this.amountText.setPosition(this.getWinningsCenterX(), this.amountText.y);
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
			// Base expression (e.g. "$ 10.00  x  5  =  ")
			this.amountText.setColor(this.totalAmountTextColor);
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountText.setText(prefixText);
			this.amountText.setVisible(true);
		}

		if (this.amountTotalText) {
			// Total winnings (e.g. "$ 50.00") is rendered separately
			this.amountTotalText.setColor(this.totalAmountTextColor);
			// Use the configured stroke
			this.amountTotalText.setStroke(this.textStrokeColor, this.textStrokeThickness);
			this.amountTotalText.setText(totalText);
			this.amountTotalText.setVisible(true);

			const baseX = this.getWinningsCenterX();
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
			
			// Reset to configured winnings color when showing standard winnings
			this.amountText.setColor(this.totalAmountTextColor);
			this.amountText.setStroke(this.textStrokeColor, this.textStrokeThickness);

			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			this.amountText.setPosition(this.getWinningsCenterX(), this.amountText.y);
			
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
			duration: 150 * (gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1),
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
	 * Format currency value for display
	 */
	private formatCurrency(amount: number): string {
		// Check if demo mode is active - if so, use blank currency symbol
		const isDemo = this.scene?.gameAPI?.getDemoState();
		const currencySymbol = isDemo ? '' : '$';
		
		if (amount === 0) {
			return `${currencySymbol} 0.00`;
		}
		
		// Format with commas for thousands and 2 decimal places
		const formatted = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
		
		return `${currencySymbol}${formatted}`;
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
