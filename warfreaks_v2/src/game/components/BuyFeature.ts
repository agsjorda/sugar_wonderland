import { Scene } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { SlotController } from './SlotController';

export interface BuyFeatureConfig {
	position?: { x: number; y: number };
	scale?: number;
	onClose?: () => void;
	onConfirm?: () => void;
	featurePrice?: number;
}

export class BuyFeature {
	private container: Phaser.GameObjects.Container;
	private background: Phaser.GameObjects.Graphics;
	private backgroundMask: Phaser.GameObjects.Graphics;
	private confirmButtonMask: Phaser.GameObjects.Graphics;
	private featurePrice: number = 24000.00;
	private currentBet: number = 0.2; // Start with first bet option
	private slotController: SlotController | null = null;
	private readonly BET_MULTIPLIER: number = 100; // Multiplier for price display
	private betOptions: number[] = [
		0.2, 0.4, 0.6, 0.8, 1,
		1.2, 1.6, 2, 2.4, 2.8,
		3.2, 3.6, 4, 5, 6,
		8, 10, 14, 18, 24,
		32, 40, 60, 80, 100,
		110, 120, 130, 140, 150
	];
	private currentBetIndex: number = 0; // Index in betOptions array
	private closeButton: Phaser.GameObjects.Text;
	private confirmButton: Phaser.GameObjects.Text;
	private betDisplay: Phaser.GameObjects.Text;
	private minusButton: Phaser.GameObjects.Text;
	private plusButton: Phaser.GameObjects.Text;
	
	// Continuous button press functionality
	private minusButtonTimer: Phaser.Time.TimerEvent | null = null;
	private plusButtonTimer: Phaser.Time.TimerEvent | null = null;
	private readonly CONTINUOUS_DELAY: number = 500; // 1 second initial delay
	private readonly CONTINUOUS_INTERVAL: number = 200; // 150ms interval for continuous press
	private priceDisplay: Phaser.GameObjects.Text;
	private featureLogo: SpineGameObject;
	private backgroundImage: Phaser.GameObjects.Image;
	private onCloseCallback?: () => void;
	private onConfirmCallback?: () => void;
	private backgroundHeight: number = 735;
	private globalBottomAnchorOffset: number = 80;
	private globalTopAnchorOffset: number = 50;

	constructor() {
		// Constructor for BuyFeature component
	}

	/**
	 * Set the SlotController reference for accessing current bet
	 */
	public setSlotController(slotController: SlotController): void {
		this.slotController = slotController;
		console.log('[BuyFeature] SlotController reference set');
	}

	/**
	 * Get the current bet value multiplied by the multiplier (for price display)
	 */
	private getCurrentBetValue(): number {
		return this.currentBet * this.BET_MULTIPLIER;
	}

	/**
	 * Get the current bet value (for bet display)
	 */
	private getCurrentBet(): number {
		return this.currentBet;
	}

	/**
	 * Get the current bet value (public method for external access)
	 */
	public getCurrentBetAmount(): number {
		return this.currentBet;
	}

	/**
	 * Initialize bet index based on current bet from SlotController
	 */
	private initializeBetIndex(): void {
		if (this.slotController) {
			const currentBaseBet = this.slotController.getBaseBetAmount();
			
			// Find the closest bet option
			let closestIndex = 0;
			let closestDifference = Math.abs(this.betOptions[0] - currentBaseBet);
			
			for (let i = 1; i < this.betOptions.length; i++) {
				const difference = Math.abs(this.betOptions[i] - currentBaseBet);
				if (difference < closestDifference) {
					closestDifference = difference;
					closestIndex = i;
				}
			}
			
			this.currentBetIndex = closestIndex;
			this.currentBet = this.betOptions[closestIndex];
			console.log(`[BuyFeature] Initialized bet index ${closestIndex} with bet $${this.currentBet.toFixed(2)}`);
		}
	}

	create(scene: Scene): void {
		console.log("[BuyFeature] Creating buy feature component");
		
		// Create main container
		this.container = scene.add.container(0, 0);
		this.container.setDepth(2000); // Very high depth to appear above everything
		
		// Create background
		this.createBackground(scene);
		
		// Create feature logo
		this.createFeatureLogo(scene);
		
		// Create title
		this.createTitle(scene);
		
		// Create feature name
		this.createFeatureName(scene);
		
		// Create price display
		this.createPriceDisplay(scene);
		
		// Create bet input
		this.createBetInput(scene);
		
		// Create buy button
		this.createBuyButton(scene);
		
		// Create close button
		this.createCloseButton(scene);
		
		// Initially hide the component
		this.hide();
	}

	private createBackground(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - this.backgroundHeight;

		// Create semi-transparent mask
		this.backgroundMask = scene.add.graphics();
		this.backgroundMask.fillStyle(0x000000, 0.7);
		this.backgroundMask.fillRect(0, 0, screenWidth, screenHeight);
		
		// Make the background interactive to block clicks behind it
		this.backgroundMask.setInteractive(new Phaser.Geom.Rectangle(0, backgroundTop, screenWidth, this.backgroundHeight), Phaser.Geom.Rectangle.Contains);
		this.container.add(this.backgroundMask);
		
		// Create background image to fill the background area
		this.backgroundImage = scene.add.image(screenWidth / 2, backgroundTop + this.backgroundHeight / 2, 'buy_feature_bg');
		
		// Scale the image to fill the background area (this.backgroundHeight)
		const scaleY = this.backgroundHeight / this.backgroundImage.height;
		const scaleX = screenWidth / this.backgroundImage.width;
		const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure full coverage
		this.backgroundImage.setScale(scaleX, scaleY);
		
		this.container.add(this.backgroundImage);
		
		// Create semi-transparent overlay with rounded top corners
		this.background = scene.add.graphics();
		this.background.fillStyle(0x000000, 0.6);
		this.background.fillRoundedRect(0, backgroundTop, screenWidth, this.backgroundHeight, 2);
		
		// Make the background interactive to block clicks behind it
		this.background.setInteractive(new Phaser.Geom.Rectangle(0, backgroundTop, screenWidth, this.backgroundHeight), Phaser.Geom.Rectangle.Contains);
		
		this.container.add(this.background);
	}

	private createFeatureLogo(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;

		const x = screenWidth / 2;
		const y = screenHeight - this.globalBottomAnchorOffset - 385;
		const spineKey = 'Symbol0_WF';
		const spineAtlasKey = `${spineKey}-atlas`;

		// Scatter symbol idle loop reused as the buy feature logo to keep the area animated
		this.featureLogo = scene.add.spine(x, y, spineKey, spineAtlasKey) as SpineGameObject;
		this.featureLogo.setOrigin(0.485, 0.55);
		this.featureLogo.setScale(0.65);

		try {
			this.featureLogo.animationState.setAnimation(0, 'symbol0_WF', true);
		} catch (error) {
			console.warn('[BuyFeature] Unable to start feature logo animation', error);
		}

		const featureLogoBg = scene.add.image(x, y, 'buy_feature_logo_bg');
		featureLogoBg.setOrigin(0.5, 0.5);
		featureLogoBg.setScale(1.1);

		this.container.add(featureLogoBg);
		this.container.add(this.featureLogo);
	}

	private createTitle(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const x = screenHeight - this.backgroundHeight + this.globalTopAnchorOffset;

		const title = scene.add.text(screenWidth / 2 - 110, x, 'Buy Feature', {
			fontSize: '24px',
			fontFamily: 'Poppins-Regular',
			color: '#00ff00',
			fontStyle: 'bold'
		});
		title.setOrigin(0.5);
		this.container.add(title);
	}

	private createFeatureName(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const x = screenHeight - this.globalBottomAnchorOffset - 510;
		
		const featureName = scene.add.text(screenWidth / 2, x, "Heaven's Welcome Bonus", {
			fontSize: '24px',
			fontFamily: 'Poppins-Regular',
			color: '#ffffff',
			fontStyle: 'bold'
		});
		featureName.setOrigin(0.5);
		this.container.add(featureName);
	}

	private createPriceDisplay(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const x = screenHeight - this.globalBottomAnchorOffset - 250;
		
		// Calculate price as 100 * current base bet
		const calculatedPrice = this.getCurrentBetValue();
		
		this.priceDisplay = scene.add.text(screenWidth / 2, x, `£${this.formatNumberWithCommas(calculatedPrice)}`, {
			fontSize: '42px',
			fontFamily: 'Poppins-Regular',
			color: '#ffffff',
			fontStyle: 'bold'
		});
		this.priceDisplay.setOrigin(0.5);
		this.container.add(this.priceDisplay);
	}


	private createBuyButton(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const x = screenWidth / 2;
		const y = screenHeight - this.globalBottomAnchorOffset;
		
		// Use long_button image to match other confirm buttons
		const buttonImage = scene.add.image(x, y, 'long_button');
		buttonImage.setOrigin(0.5, 0.5);
		buttonImage.setDisplaySize(364, 62);
		this.container.add(buttonImage);
		
		// Button label
		this.confirmButton = scene.add.text(x, y, 'BUY FEATURE', {
			fontSize: '24px',
			fontFamily: 'Poppins-Bold',
			color: '#000000'
		});
		this.confirmButton.setOrigin(0.5);
		this.container.add(this.confirmButton);
		
		buttonImage.setInteractive();
		buttonImage.on('pointerdown', () => this.confirmPurchase());
	}

	private createCloseButton(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const x = screenHeight - this.backgroundHeight + this.globalTopAnchorOffset;

		this.closeButton = scene.add.text(screenWidth / 2 + 160, x, '×', {
			fontSize: '40px',
			fontFamily: 'Poppins-Regular',
			color: '#ffffff'
		});
		this.closeButton.setOrigin(0.5);
		this.closeButton.setInteractive();
		this.closeButton.on('pointerdown', () => this.close());
		this.container.add(this.closeButton);
	}


	private confirmPurchase(): void {
		console.log(`[BuyFeature] Confirming purchase`);
		
		if (this.onConfirmCallback) {
			this.onConfirmCallback();
		}
		
		this.close();
	}

	private updatePriceDisplay(): void {
		if (this.priceDisplay) {
			const calculatedPrice = this.getCurrentBetValue();
			this.priceDisplay.setText(`$${this.formatNumberWithCommas(calculatedPrice)}`);
		}
	}

	private formatNumberWithCommas(num: number): string {
		return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}

	private animateIn(): void {
		if (!this.container || !this.container.scene) {
			return;
		}

		this.container.alpha = 0;

		this.container.setY(0);
		this.container.setVisible(true);

		this.container.scene.tweens.add({
			targets: this.container,
			alpha: 1,
			duration: 200,
			ease: 'Cubic.easeOut',
			onComplete: () => {
				console.log("[BuyFeature] Drawer animation completed");
			}
		});
	}

	private animateOut(): void {
		if (!this.container || !this.container.scene) {
			return;
		}

		// Create slide-down animation
		this.container.scene.tweens.add({
			targets: this.container,
			alpha: 0,
			duration: 200,
			ease: 'Cubic.easeIn',
			onComplete: () => {
				this.container.setVisible(false);
				console.log("[BuyFeature] Drawer hidden");
			}
		});
	}

	private createBetInput(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;

		const localAdditiveBottomOffset = 100;
		const x = screenWidth * 0.5;
		const y = screenHeight - this.globalBottomAnchorOffset - localAdditiveBottomOffset;
		
		// "Bet" label
		const betLabel = scene.add.text(x - 182, y - 70, 'Bet', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		betLabel.setOrigin(0, 0.5);
		this.container.add(betLabel);
		
		// Bet input background
		const inputBg = scene.add.graphics();
		inputBg.fillStyle(0x000000, 0.4);
		inputBg.fillRoundedRect(-182, -37, 364, 74, 10);
		inputBg.lineStyle(0.5, 0xffffff, 1);
		inputBg.strokeRoundedRect(-182, -37, 364, 74, 10);
		inputBg.setPosition(x, y);
		this.container.add(inputBg);
		
		// Minus button
		this.minusButton = scene.add.text(x - 150, y, '-', {
			fontSize: '30px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.minusButton.setOrigin(0.5, 0.5);
		this.minusButton.setInteractive();
		
		// Handle pointer down for continuous press
		this.minusButton.on('pointerdown', () => {
			this.selectPreviousBet();
			this.startContinuousDecrement(scene);
		});
		
		// Handle pointer up to stop continuous press
		this.minusButton.on('pointerup', () => {
			this.stopContinuousDecrement();
		});
		
		// Handle pointer out to stop continuous press
		this.minusButton.on('pointerout', () => {
			this.stopContinuousDecrement();
		});
		
		this.container.add(this.minusButton);
		
		// Bet display - show current bet value
		this.betDisplay = scene.add.text(x, y, `$${this.getCurrentBet().toFixed(2)}`, {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.betDisplay.setOrigin(0.5, 0.5);
		this.container.add(this.betDisplay);
		
		// Plus button
		this.plusButton = scene.add.text(x + 150, y, '+', {
			fontSize: '30px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.plusButton.setOrigin(0.5, 0.5);
		this.plusButton.setInteractive();
		
		// Handle pointer down for continuous press
		this.plusButton.on('pointerdown', () => {
			this.selectNextBet();
			this.startContinuousIncrement(scene);
		});
		
		// Handle pointer up to stop continuous press
		this.plusButton.on('pointerup', () => {
			this.stopContinuousIncrement();
		});
		
		// Handle pointer out to stop continuous press
		this.plusButton.on('pointerout', () => {
			this.stopContinuousIncrement();
		});
		
		this.container.add(this.plusButton);
	}

	private selectPreviousBet(): void {
		if (this.currentBetIndex > 0) {
			this.currentBetIndex--;
			this.currentBet = this.betOptions[this.currentBetIndex];
			this.updateBetDisplay();
			this.updatePriceDisplay();
			console.log(`[BuyFeature] Previous bet selected: $${this.currentBet.toFixed(2)}`);
		}
	}

	private selectNextBet(): void {
		if (this.currentBetIndex < this.betOptions.length - 1) {
			this.currentBetIndex++;
			this.currentBet = this.betOptions[this.currentBetIndex];
			this.updateBetDisplay();
			this.updatePriceDisplay();
			console.log(`[BuyFeature] Next bet selected: $${this.currentBet.toFixed(2)}`);
		}
	}

	/**
	 * Start continuous decrement after initial delay
	 */
	private startContinuousDecrement(scene: Scene): void {
		// Clear any existing timer
		this.stopContinuousDecrement();
		
		// Start timer after initial delay
		this.minusButtonTimer = scene.time.delayedCall(this.CONTINUOUS_DELAY, () => {
			// Start continuous decrement
			this.minusButtonTimer = scene.time.addEvent({
				delay: this.CONTINUOUS_INTERVAL,
				callback: () => {
					this.selectPreviousBet();
				},
				loop: true
			});
		});
	}

	/**
	 * Stop continuous decrement
	 */
	private stopContinuousDecrement(): void {
		if (this.minusButtonTimer) {
			this.minusButtonTimer.destroy();
			this.minusButtonTimer = null;
		}
	}

	/**
	 * Start continuous increment after initial delay
	 */
	private startContinuousIncrement(scene: Scene): void {
		// Clear any existing timer
		this.stopContinuousIncrement();
		
		// Start timer after initial delay
		this.plusButtonTimer = scene.time.delayedCall(this.CONTINUOUS_DELAY, () => {
			// Start continuous increment
			this.plusButtonTimer = scene.time.addEvent({
				delay: this.CONTINUOUS_INTERVAL,
				callback: () => {
					this.selectNextBet();
				},
				loop: true
			});
		});
	}

	/**
	 * Stop continuous increment
	 */
	private stopContinuousIncrement(): void {
		if (this.plusButtonTimer) {
			this.plusButtonTimer.destroy();
			this.plusButtonTimer = null;
		}
	}

	private updateBetDisplay(): void {
		if (this.betDisplay) {
			this.betDisplay.setText(`$${this.getCurrentBet().toFixed(2)}`);
		}
	}

	public show(config?: BuyFeatureConfig): void {
		console.log("[BuyFeature] Showing buy feature drawer");
		
		if (config) {
			if (config.featurePrice !== undefined) {
				this.featurePrice = config.featurePrice;
			}
			if (config.onClose) {
				this.onCloseCallback = config.onClose;
			}
			if (config.onConfirm) {
				this.onConfirmCallback = config.onConfirm;
			}
		}
		
		// Initialize bet index based on current bet from SlotController
		this.initializeBetIndex();
		
		this.updatePriceDisplay();
		this.updateBetDisplay();
		this.animateIn();
		
		// Show the mask when the panel is shown (same as BetOptions)
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(true);
			this.confirmButtonMask.setAlpha(1);
		}
	}

	public hide(): void {
		console.log("[BuyFeature] Hiding buy feature drawer");
		
		// Stop any continuous button presses
		this.stopContinuousDecrement();
		this.stopContinuousIncrement();
		
		this.animateOut();
		
		// Hide the mask when the panel is hidden (same as BetOptions)
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(false);
			this.confirmButtonMask.setAlpha(0);
		}
	}

	public close(): void {
		console.log("[BuyFeature] Closing buy feature drawer");
		this.hide();
		
		if (this.onCloseCallback) {
			this.onCloseCallback();
		}
	}

	public destroy(): void {
		// Stop any continuous button presses
		this.stopContinuousDecrement();
		this.stopContinuousIncrement();
		
		if (this.container) {
			this.container.destroy();
		}
	}
}
