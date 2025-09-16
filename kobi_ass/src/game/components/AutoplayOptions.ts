import { Scene } from 'phaser';
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";

export interface AutoplayOptionsConfig {
	position?: { x: number; y: number };
	scale?: number;
	onClose?: () => void;
	onConfirm?: (autoplayCount: number) => void;
	currentAutoplayCount?: number;
	currentBet?: number;
	currentBalance?: number;
}

export class AutoplayOptions {
	private container: Phaser.GameObjects.Container;
	private background: Phaser.GameObjects.Graphics;
	private confirmButtonMask: Phaser.GameObjects.Graphics;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private currentAutoplayCount: number = 10;
	private currentBet: number = 0.20; // Default bet amount
	private currentBalance: number = 0; // Current game balance
	private autoplayOptions: number[] = [
		10, 30, 50, 75, 100, 150, 500, 1000
	];
	private autoplayButtons: Phaser.GameObjects.Container[] = [];
	private selectedButtonIndex: number = -1;
	private closeButton: Phaser.GameObjects.Text;
	private confirmButton: Phaser.GameObjects.Text;
	private autoplayDisplay: Phaser.GameObjects.Text;
	private minusButton: Phaser.GameObjects.Text;
	private plusButton: Phaser.GameObjects.Text;
	private balanceAmountText: Phaser.GameObjects.Text;
	private onCloseCallback?: () => void;
	private onConfirmCallback?: (autoplayCount: number) => void;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	create(scene: Scene): void {
		console.log("[AutoplayOptions] Creating autoplay options component");
		
		// Create main container
		this.container = scene.add.container(0, 0);
		this.container.setDepth(2000); // Very high depth to appear above everything including winlines and symbols
		
		// Create background
		this.createBackground(scene);
		
		// Create header
		this.createHeader(scene);
		
		// Create autoplay options grid
		this.createAutoplayOptionsGrid(scene);
		
		// Create autoplay input section
		this.createAutoplayInput(scene);
		
		// Create confirm button
		this.createConfirmButton(scene);
		
		// Initially hide the component
		this.container.setVisible(false);
	}

	private createBackground(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		// Background overlay with rounded corners
		this.background = scene.add.graphics();
		this.background.fillStyle(0x000000, 0.80); // Semi-transparent black overlay
		this.background.fillRoundedRect(0, backgroundTop, screenWidth, backgroundHeight, 20);
		this.background.setInteractive(new Phaser.Geom.Rectangle(0, backgroundTop, screenWidth, backgroundHeight), Phaser.Geom.Rectangle.Contains);
		this.container.add(this.background);
	}

	private createHeader(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		const x = screenWidth * 0.5;
		const headerY = backgroundTop + 40; // Position relative to background top
		
		// AUTOPLAY SETTINGS title
		const autoplayTitle = scene.add.text(x - 180, headerY, 'AUTOPLAY SETTINGS', {
			fontSize: '24px',
			color: '#00ff00',
			fontFamily: 'Poppins-Bold'
		});
		autoplayTitle.setOrigin(0, 0.5);
		this.container.add(autoplayTitle);
		
		// Close button (X)
		this.closeButton = scene.add.text(x + 180, headerY, 'X', {
			fontSize: '20px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.closeButton.setOrigin(0.5, 0.5);
		this.closeButton.setInteractive();
		this.closeButton.on('pointerdown', () => {
			// Create slide-down animation
			if (this.container.scene) {
				this.container.scene.tweens.add({
					targets: this.container,
					y: this.container.scene.scale.height,
					duration: 400,
					ease: 'Power2.in',
					onComplete: () => {
						this.hide();
						if (this.onCloseCallback) this.onCloseCallback();
					}
				});
			} else {
				this.hide();
				if (this.onCloseCallback) this.onCloseCallback();
			}
		});
		this.container.add(this.closeButton);
		
		// Balance display below header
		this.createBalanceDisplay(scene, x, headerY + 60);
	}

	private createBalanceDisplay(scene: Scene, centerX: number, y: number): void {
		// Create balance display container
		const balanceContainer = scene.add.container(centerX, y + 20);
		
		// Balance container background
		const balanceWidth = 364;
		const balanceHeight = 68;
		const balanceBg = scene.add.graphics();
		balanceBg.fillStyle(0x1f1f1f, 1);
		balanceBg.fillRoundedRect(-balanceWidth/2, -balanceHeight/2, balanceWidth, balanceHeight, 10);
		balanceBg.lineStyle(1, 0x333333, 1);
		balanceBg.strokeRoundedRect(-balanceWidth/2, -balanceHeight/2, balanceWidth, balanceHeight, 10);
		balanceContainer.add(balanceBg);
		
		// "Balance" label
		const balanceLabel = scene.add.text(-150, 1, 'Balance', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		balanceLabel.setOrigin(0, 0.5);
		balanceContainer.add(balanceLabel);
		
		// Balance amount - using the current balance from game data
		const balanceAmount = scene.add.text(150, 1, `$${this.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
			fontSize: '24px',
			color: '#00ff00',
			fontFamily: 'Poppins-Bold'
		});
		balanceAmount.setOrigin(1, 0.5);
		this.balanceAmountText = balanceAmount; // Store reference
		balanceContainer.add(balanceAmount);
		
		// Add the balance container to the main container
		this.container.add(balanceContainer);
	}

	private createAutoplayOptionsGrid(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		const startX = screenWidth * 0.5 - 180;
		const startY = backgroundTop + 240; // Position relative to background top
		const buttonWidth = 79;
		const buttonHeight = 60;
		const spacing = 15;
		
		// "Number of autospins" label
		const selectSizeLabel = scene.add.text(startX, startY - 30, 'Number of autospins', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		selectSizeLabel.setOrigin(0, 0.5);
		this.container.add(selectSizeLabel);
		
		// Create grid of autoplay option buttons (2 rows of 4)
		for (let i = 0; i < this.autoplayOptions.length; i++) {
			const row = Math.floor(i / 4);
			const col = i % 4;
			const x = startX + col * (buttonWidth + spacing);
			const y = startY + row * (buttonHeight + spacing);
			
			const buttonContainer = this.createAutoplayOptionButton(scene, x, y, buttonWidth, buttonHeight, this.autoplayOptions[i], i);
			this.autoplayButtons.push(buttonContainer);
			this.container.add(buttonContainer);
		}
	}

	private createAutoplayOptionButton(scene: Scene, x: number, y: number, width: number, height: number, value: number, index: number): Phaser.GameObjects.Container {
		const container = scene.add.container(x, y);
		
		// Button background
		const buttonBg = scene.add.graphics();
		buttonBg.fillStyle(0x000000, 1);
		buttonBg.fillRoundedRect(0, 0, width, height, 5);
		buttonBg.lineStyle(0.5, 0xffffff, 1);
		buttonBg.strokeRoundedRect(0, 0, width, height, 5);
		container.add(buttonBg);
		
		// Store reference to background for selection state
		(container as any).buttonBg = buttonBg;
		(container as any).buttonValue = value;
		(container as any).buttonIndex = index;
		
		// Button text
		const buttonText = scene.add.text(width/2, height/2, value.toString(), {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		});
		buttonText.setOrigin(0.5, 0.5);
		container.add(buttonText);
		
		// Make interactive
		container.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
		container.on('pointerdown', () => {
			this.selectButton(index, value);
		});
		
		return container;
	}

	private createAutoplayInput(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		const x = screenWidth * 0.5;
		const y = backgroundTop + 490; // Position relative to background top
		
		// "Autospins" label
		const autoplayLabel = scene.add.text(x - 180, y - 70, 'Bet', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		autoplayLabel.setOrigin(0, 0.5);
		this.container.add(autoplayLabel);
		
		// Autoplay input background
		const inputBg = scene.add.graphics();
		inputBg.fillStyle(0x000000, 1);
		inputBg.fillRoundedRect(-182, -37, 364, 74, 10);
		inputBg.lineStyle(0.5, 0xffffff, 1);
		inputBg.strokeRoundedRect(-182, -37, 364, 74, 10);
		inputBg.setPosition(x, y);
		this.container.add(inputBg);
		
		// Minus button
		this.minusButton = scene.add.text(x - 150, y, '-', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.minusButton.setOrigin(0.5, 0.5);
		this.minusButton.setInteractive();
		this.minusButton.on('pointerdown', () => {
			this.selectPreviousAutoplay();
		});
		this.container.add(this.minusButton);
		
		// Autoplay display - show total cost (bet × spins)
		const totalCost = this.currentBet * this.currentAutoplayCount;
		this.autoplayDisplay = scene.add.text(x, y, `$${totalCost.toFixed(2)}`, {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		});
		this.autoplayDisplay.setOrigin(0.5, 0.5);
		this.container.add(this.autoplayDisplay);
		
		// Plus button
		this.plusButton = scene.add.text(x + 150, y, '+', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.plusButton.setOrigin(0.5, 0.5);
		this.plusButton.setInteractive();
		this.plusButton.on('pointerdown', () => {
			this.selectNextAutoplay();
		});
		this.container.add(this.plusButton);
	}

	private createConfirmButton(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		const x = screenWidth * 0.5;
		const y = backgroundTop + 580; // Position relative to background top
		
		// Button background with gradient effect
		const buttonBg = scene.add.graphics();
		
		// Create gradient effect by drawing multiple rectangles with different colors
		const rectHeight = 62;
		const segments = 25; // Increased from 10 to 25 for smoother gradient
		const segmentHeight = rectHeight / segments;
		
		// Create gradient container
		const gradientContainer = scene.add.container(x, y);
		
		// Create a mask for the rounded shape in a separate container
		this.confirmButtonMask = scene.add.graphics();
		this.confirmButtonMask.fillStyle(0xffffff, 1);
		this.confirmButtonMask.fillRoundedRect(-182, -31, 364, 62, 31);
		this.confirmButtonMask.setPosition(x, y);
		this.confirmButtonMask.setVisible(false); // Start hidden
		this.confirmButtonMask.setAlpha(0); // Set alpha to 0
		this.container.add(this.confirmButtonMask);
		
		gradientContainer.setMask(this.confirmButtonMask.createGeometryMask());
		
		for (let i = 0; i < segments; i++) {
			const y1 = -31 + (i * segmentHeight);
			
			// Interpolate between colors
			const ratio = i / (segments - 1);
			const r1 = 0x66, g1 = 0xD4, b1 = 0x49; // #66D449
			const r2 = 0x37, g2 = 0x95, b2 = 0x57; // #379557
			
			const r = Math.round(r1 + (r2 - r1) * ratio);
			const g = Math.round(g1 + (g2 - g1) * ratio);
			const b = Math.round(b1 + (b2 - b1) * ratio);
			
			const color = (r << 16) | (g << 8) | b;
			const segment = scene.add.graphics();
			segment.fillStyle(color, 1);
			segment.fillRect(-182, y1, 364, segmentHeight);
			segment.setPosition(0, 0);
			gradientContainer.add(segment);
		}
		
		this.container.add(gradientContainer);
		
		buttonBg.lineStyle(2, 0x00cc00, 1);
		buttonBg.strokeRoundedRect(-182, -31, 364, 62, 31);
		buttonBg.setPosition(x, y);
		this.container.add(buttonBg);
		
		// Button text
		this.confirmButton = scene.add.text(x, y, 'START AUTOPLAY', {
			fontSize: '24px',
			color: '#000000',
			fontFamily: 'Poppins-Bold'
		});
		this.confirmButton.setOrigin(0.5, 0.5);
		this.container.add(this.confirmButton);
		
		// Make the button background interactive instead of the text
		buttonBg.setInteractive(new Phaser.Geom.Rectangle(-182, -31, 364, 62), Phaser.Geom.Rectangle.Contains);
		buttonBg.on('pointerdown', () => {
			// Create slide-down animation
			if (this.container.scene) {
				this.container.scene.tweens.add({
					targets: this.container,
					y: this.container.scene.scale.height,
					duration: 400,
					ease: 'Power2.in',
					onComplete: () => {
						if (this.onConfirmCallback) this.onConfirmCallback(this.currentAutoplayCount);
						this.hide();
					}
				});
			} else {
				if (this.onConfirmCallback) this.onConfirmCallback(this.currentAutoplayCount);
				this.hide();
			}
		});
	}

	private selectButton(index: number, value: number): void {
		// Use the same dimensions as defined in createAutoplayOptionsGrid
		const buttonWidth = 79;
		const buttonHeight = 60;
		
		// Deselect previous button
		if (this.selectedButtonIndex >= 0 && this.selectedButtonIndex < this.autoplayButtons.length) {
			const prevButton = this.autoplayButtons[this.selectedButtonIndex];
			const prevBg = (prevButton as any).buttonBg;
			prevBg.clear();
			prevBg.fillStyle(0x000000, 1);
			prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 5);
			prevBg.lineStyle(0.5, 0xffffff, 1);
			prevBg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, 5);
		}
		
		// Select new button
		this.selectedButtonIndex = index;
		this.currentAutoplayCount = value;
		
		// Update selected button background to gradient
		const selectedButton = this.autoplayButtons[index];
		const selectedBg = (selectedButton as any).buttonBg;
		selectedBg.clear();
		
		// Create gradient for selected button
		const rectHeight = buttonHeight;
		const segments = 25;
		const segmentHeight = rectHeight / segments;
		
		for (let i = 0; i < segments; i++) {
			const y1 = i * segmentHeight;
			
			// Interpolate between colors
			const ratio = i / (segments - 1);
			const r1 = 0x66, g1 = 0xD4, b1 = 0x49; // #66D449
			const r2 = 0x37, g2 = 0x95, b2 = 0x57; // #379557
			
			const r = Math.round(r1 + (r2 - r1) * ratio);
			const g = Math.round(g1 + (g2 - g1) * ratio);
			const b = Math.round(b1 + (b2 - b1) * ratio);
			
			const color = (r << 16) | (g << 8) | b;
			selectedBg.fillStyle(color, 1);
			selectedBg.fillRect(0, y1, buttonWidth, segmentHeight);
		}
		
		selectedBg.lineStyle(0.5, 0xffffff, 1);
		selectedBg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, 5);
		
		this.updateAutoplayDisplay();
	}

	private updateAutoplayDisplay(): void {
		if (this.autoplayDisplay) {
			const totalCost = this.currentBet * this.currentAutoplayCount;
			this.autoplayDisplay.setText(`$${totalCost.toFixed(2)}`);
		}
	}

	private updateBalanceDisplay(): void {
		if (this.balanceAmountText) {
			this.balanceAmountText.setText(`$${this.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
		}
	}

	private selectPreviousAutoplay(): void {
		if (this.selectedButtonIndex > 0) {
			this.selectButton(this.selectedButtonIndex - 1, this.autoplayOptions[this.selectedButtonIndex - 1]);
		}
	}

	private selectNextAutoplay(): void {
		if (this.selectedButtonIndex < this.autoplayOptions.length - 1) {
			this.selectButton(this.selectedButtonIndex + 1, this.autoplayOptions[this.selectedButtonIndex + 1]);
		}
	}

	show(config?: AutoplayOptionsConfig): void {
		if (config) {
			if (config.currentAutoplayCount !== undefined) {
				this.currentAutoplayCount = config.currentAutoplayCount;
			}
			if (config.currentBet !== undefined) {
				this.currentBet = config.currentBet;
			}
			if (config.currentBalance !== undefined) {
				this.currentBalance = config.currentBalance;
			}
			this.onCloseCallback = config.onClose;
			this.onConfirmCallback = config.onConfirm;
		}
		
		// Update the balance display with current balance
		this.updateBalanceDisplay();
		
		// Find and select the button that matches the current autoplay count
		const matchingIndex = this.autoplayOptions.findIndex(option => option === this.currentAutoplayCount);
		if (matchingIndex !== -1) {
			this.selectButton(matchingIndex, this.autoplayOptions[matchingIndex]);
		} else {
			// If no exact match, select the closest option
			let closestIndex = 0;
			let closestDifference = Math.abs(this.autoplayOptions[0] - this.currentAutoplayCount);
			
			for (let i = 1; i < this.autoplayOptions.length; i++) {
				const difference = Math.abs(this.autoplayOptions[i] - this.currentAutoplayCount);
				if (difference < closestDifference) {
					closestDifference = difference;
					closestIndex = i;
				}
			}
			this.selectButton(closestIndex, this.autoplayOptions[closestIndex]);
		}
		
		this.updateAutoplayDisplay();
		
		// Start positioned below the screen for slide-up effect
		this.container.setY(this.container.scene.scale.height);
		this.container.setVisible(true);
		
		// Show the mask when the panel is shown
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(true);
			this.confirmButtonMask.setAlpha(1);
		}
		
		// Create slide-up animation
		if (this.container.scene) {
			this.container.scene.tweens.add({
				targets: this.container,
				y: 0,
				duration: 400,
				ease: 'Power2.out'
			});
		}
	}

	hide(): void {
		this.container.setVisible(false);
		
		// Hide the mask when the panel is hidden
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(false);
			this.confirmButtonMask.setAlpha(0);
		}
	}

	isVisible(): boolean {
		return this.container.visible;
	}

	setCurrentAutoplayCount(count: number): void {
		this.currentAutoplayCount = count;
		this.updateAutoplayDisplay();
	}

	getCurrentAutoplayCount(): number {
		return this.currentAutoplayCount;
	}

	setCurrentBet(bet: number): void {
		this.currentBet = bet;
		this.updateAutoplayDisplay();
	}

	setCurrentBalance(balance: number): void {
		this.currentBalance = balance;
		this.updateBalanceDisplay();
	}

	getCurrentBet(): number {
		return this.currentBet;
	}

	destroy(): void {
		if (this.container) {
			this.container.destroy();
		}
	}
} 