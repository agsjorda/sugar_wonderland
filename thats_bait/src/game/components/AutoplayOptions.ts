import { Scene } from 'phaser';
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { SoundEffectType } from '../../managers/AudioManager';
import { BET_OPTIONS } from '../../config/BetConfig';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export interface AutoplayOptionsConfig {
	position?: { x: number; y: number };
	scale?: number;
	amplifyBetScaleModifierX?: number;
	amplifyBetScaleModifierY?: number;
	onClose?: () => void;
	onConfirm?: (autoplayCount: number) => void;
	currentAutoplayCount?: number;
	currentBet?: number;
	currentBalance?: number;
	isEnhancedBet?: boolean;
}

export class AutoplayOptions {
	private container!: Phaser.GameObjects.Container;
	private background!: Phaser.GameObjects.Graphics;
	private confirmButtonMask?: Phaser.GameObjects.Graphics;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private currentAutoplayCount: number = 10;
	private currentBet: number = 0.20; // Default bet amount
	private currentBalance: number = 0; // Current game balance
	private isEnhancedBet: boolean = false;
	private autoplayOptions: number[] = [
		10, 30, 50, 75, 100, 150, 500, 1000
	];
	private betOptions: number[] = BET_OPTIONS;
	private autoplayButtons: Phaser.GameObjects.Container[] = [];
	private selectedButtonIndex: number = -1;
	private selectedBetIndex: number = -1;
	private closeButton!: Phaser.GameObjects.Text;
	private confirmButton!: Phaser.GameObjects.Text;
	private autoplayDisplay!: Phaser.GameObjects.Text;
	private minusButton!: Phaser.GameObjects.Text;
	private plusButton!: Phaser.GameObjects.Text;
	private balanceAmountText!: Phaser.GameObjects.Text;

	private onCloseCallback?: () => void;
	private onConfirmCallback?: (autoplayCount: number) => void;
	private amplifyBetAnimation: any;
	private readonly betInputWidth: number = 364;
	private readonly betInputHeight: number = 74;
	private amplifyBetScaleModifierX: number = 1;
	private amplifyBetScaleModifierY: number = 1;
	private amplifyBetFitScale: number = 1;

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
		this.setInputEnabled(false);
	}

	public setAmplifyBetScaleModifier(scaleX: number, scaleY?: number): void {
		const x = Number(scaleX);
		const y = Number(scaleY ?? scaleX);
		this.amplifyBetScaleModifierX = Number.isFinite(x) ? x : 1;
		this.amplifyBetScaleModifierY = Number.isFinite(y) ? y : 1;
		try { this.updateAmplifyBetLayout(); } catch {}
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
		this.background.setInteractive(new Phaser.Geom.Rectangle(0, 0, screenWidth, screenHeight), Phaser.Geom.Rectangle.Contains);
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
		this.closeButton = scene.add.text(x + 180, headerY, '×', {
			fontSize: '30px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.closeButton.setOrigin(0.5, 0.5);
		this.closeButton.setInteractive();
		this.closeButton.on('pointerdown', () => {
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
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
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
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
		
		// Create amplify bet animation behind the bet display
		this.createAmplifyBetAnimation(scene, x, y);
		
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
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.selectPreviousBet();
		});
		this.container.add(this.minusButton);
		
		// Bet display
		this.autoplayDisplay = scene.add.text(x, y, `$${this.currentBet.toFixed(2)}` , {
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
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.selectNextBet();
		});
		this.container.add(this.plusButton);
	}

	private createAmplifyBetAnimation(scene: Scene, x: number, y: number): void {
		try {
			if (!ensureSpineFactory(scene, '[AutoplayOptions] createAmplifyBetAnimation')) {
				console.warn('[AutoplayOptions] Spine factory unavailable, skipping amplify bet animation');
				return;
			}
			if (!scene.cache.json.has('amplify_bet')) {
				console.warn('[AutoplayOptions] Amplify bet spine assets not loaded, skipping animation creation');
				return;
			}
			const spineObj = (scene.add as any).spine(x, y, 'amplify_bet', 'amplify_bet-atlas');
			this.amplifyBetAnimation = spineObj;
			this.amplifyBetAnimation.setOrigin(0.5, 0.5);
			this.amplifyBetAnimation.setScale(1);
			this.amplifyBetAnimation.setVisible(false);
			this.container.add(this.amplifyBetAnimation);
			try { this.updateAmplifyBetLayout(); } catch {}
			console.log('[AutoplayOptions] Amplify bet spine animation created for autoplay bet UI');
		} catch (error) {
			console.error('[AutoplayOptions] Failed to create amplify bet animation:', error);
		}
	}

	private updateAmplifyBetLayout(): void {
		if (!this.amplifyBetAnimation || !this.container || !this.container.scene) {
			return;
		}
		const scene: any = this.container.scene;
		
		try {
			const screenWidth = scene.scale.width;
			const screenHeight = scene.scale.height;
			const backgroundHeight = 772;
			const backgroundTop = screenHeight - backgroundHeight;
			const x = screenWidth * 0.5;
			const y = backgroundTop + 490;
			try { this.amplifyBetAnimation.setPosition(x, y); } catch {}
		} catch {}

		try {
			const prevScaleX = Number(this.amplifyBetAnimation.scaleX ?? 1);
			const prevScaleY = Number(this.amplifyBetAnimation.scaleY ?? 1);
			try { this.amplifyBetAnimation.setScale(1, 1); } catch {}
			try { this.amplifyBetAnimation.skeleton?.setToSetupPose?.(); this.amplifyBetAnimation.update?.(0); } catch {}
			let b: any = null;
			try { b = this.amplifyBetAnimation.getBounds?.(); } catch { b = null; }
			if (b && b.width > 0 && b.height > 0) {
				const fit = Math.min(this.betInputWidth / b.width, this.betInputHeight / b.height);
				this.amplifyBetFitScale = Math.max(0.01, fit * 1.05);
			} else {
				this.amplifyBetFitScale = Math.max(0.01, Number(this.amplifyBetFitScale || 1));
			}

			const finalScaleX = Math.max(0.01, this.amplifyBetFitScale * Number(this.amplifyBetScaleModifierX || 1));
			const finalScaleY = Math.max(0.01, this.amplifyBetFitScale * Number(this.amplifyBetScaleModifierY || 1));
			try { this.amplifyBetAnimation.setScale(finalScaleX, finalScaleY); } catch {
				try { this.amplifyBetAnimation.setScale(prevScaleX || prevScaleY || 1, prevScaleY || prevScaleX || 1); } catch {}
			}
		} catch {}
	}

	private createConfirmButton(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 772;
		const backgroundTop = screenHeight - backgroundHeight;
		
		const x = screenWidth * 0.5;
		const y = backgroundTop + 580;
		
		// Use long_button image instead of gradient/mask
		const buttonImage = scene.add.image(x, y, 'long_button');
		buttonImage.setOrigin(0.5, 0.5);
		buttonImage.setDisplaySize(364, 62);
		this.container.add(buttonImage);
		
		// Button label
		this.confirmButton = scene.add.text(x, y, 'START AUTOPLAY', {
			fontSize: '24px',
			color: '#000000',
			fontFamily: 'Poppins-Bold'
		});
		this.confirmButton.setOrigin(0.5, 0.5);
		this.container.add(this.confirmButton);
		
		buttonImage.setInteractive();
		buttonImage.on('pointerdown', () => {
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
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

	private updateAmplifyBetVisual(): void {
		if (!this.amplifyBetAnimation) {
			return;
		}
		try {
			try { this.updateAmplifyBetLayout(); } catch {}
			if (this.isEnhancedBet) {
				this.amplifyBetAnimation.setVisible(true);
				const data: any = this.amplifyBetAnimation.skeleton?.data;
				const idleName = 'animation';
				if (data && typeof data.findAnimation === 'function' && data.findAnimation(idleName)) {
					this.amplifyBetAnimation.animationState.setAnimation(0, idleName, true);
				} else {
					const animations = data?.animations || [];
					if (animations.length > 0) {
						this.amplifyBetAnimation.animationState.setAnimation(0, animations[0].name, true);
					}
				}
			} else {
				this.amplifyBetAnimation.setVisible(false);
				try {
					this.amplifyBetAnimation.animationState.clearTracks();
				} catch {}
			}
		} catch (e) {
			console.warn('[AutoplayOptions] Failed to update amplify bet visual:', e);
		}
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
		
		// Update selected button background to solid neon green
		const selectedButton = this.autoplayButtons[index];
		const selectedBg = (selectedButton as any).buttonBg;
		selectedBg.clear();
		selectedBg.fillStyle(0x66D449, 1);
		selectedBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 5);
		selectedBg.lineStyle(0.5, 0xffffff, 1);
		selectedBg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, 5);
		
		this.updateAutoplayDisplay();
	}

	private updateAutoplayDisplay(): void {
		if (this.autoplayDisplay) {
			this.autoplayDisplay.setText(`$${this.currentBet.toFixed(2)}`);
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

	private selectBet(index: number, value: number): void {
		this.selectedBetIndex = index;
		this.currentBet = value;
		this.updateAutoplayDisplay();
	}

	private selectPreviousBet(): void {
		if (this.selectedBetIndex > 0) {
			this.selectBet(this.selectedBetIndex - 1, this.betOptions[this.selectedBetIndex - 1]);
		}
	}

	private selectNextBet(): void {
		if (this.selectedBetIndex < this.betOptions.length - 1) {
			this.selectBet(this.selectedBetIndex + 1, this.betOptions[this.selectedBetIndex + 1]);
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
			if (config.isEnhancedBet !== undefined) {
				this.isEnhancedBet = config.isEnhancedBet;
			}
			if (config.amplifyBetScaleModifierX !== undefined || config.amplifyBetScaleModifierY !== undefined) {
				const x = (config.amplifyBetScaleModifierX !== undefined) ? config.amplifyBetScaleModifierX : 1;
				const y = (config.amplifyBetScaleModifierY !== undefined) ? config.amplifyBetScaleModifierY : x;
				this.setAmplifyBetScaleModifier(x, y);
			}
			this.onCloseCallback = config.onClose;
			this.onConfirmCallback = config.onConfirm;
		}
		
		// Update the balance display with current balance
		this.updateBalanceDisplay();
		this.updateAmplifyBetVisual();
		
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
		
		// Initialize bet selector to match current bet (closest option)
		const betMatchingIndex = this.betOptions.findIndex(option => Math.abs(option - this.currentBet) < 0.01);
		if (betMatchingIndex !== -1) {
			this.selectBet(betMatchingIndex, this.betOptions[betMatchingIndex]);
		} else {
			let closestBetIndex = 0;
			let closestBetDifference = Math.abs(this.betOptions[0] - this.currentBet);
			for (let i = 1; i < this.betOptions.length; i++) {
				const difference = Math.abs(this.betOptions[i] - this.currentBet);
				if (difference < closestBetDifference) {
					closestBetDifference = difference;
					closestBetIndex = i;
				}
			}
			this.selectBet(closestBetIndex, this.betOptions[closestBetIndex]);
		}

		this.updateAutoplayDisplay();
		
		// Start positioned below the screen for slide-up effect
		this.container.setY(this.container.scene.scale.height);
		this.setInputEnabled(true);
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
		this.setInputEnabled(false);
		
		// Hide the mask when the panel is hidden
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(false);
			this.confirmButtonMask.setAlpha(0);
		}
	}

	private setInputEnabled(enabled: boolean): void {
		const list = (this.container as any)?.list as any[] | undefined;
		if (!Array.isArray(list)) return;
		for (const obj of list) {
			const anyObj: any = obj as any;
			if (anyObj?.input) {
				try { anyObj.input.enabled = enabled; } catch {}
			} else if (!enabled) {
				try { anyObj?.disableInteractive?.(); } catch {}
			}
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
			this.setInputEnabled(false);
			this.container.destroy();
		}
	}
}