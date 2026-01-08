import { Scene } from 'phaser';
import { resolveAssetUrl } from '../../utils/AssetLoader';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { SlotController } from './SlotController';
import { SoundEffectType } from '../../managers/AudioManager';
import { BET_OPTIONS } from '../../config/BetConfig';

export interface BuyFeatureConfig {
	position?: { x: number; y: number };
	scale?: number;
	logoScale?: number;
	logoBackgroundScale?: number;
	onClose?: () => void;
	onConfirm?: () => void;
	featurePrice?: number;
}

export class BuyFeature {
	private container!: Phaser.GameObjects.Container;
	private background!: Phaser.GameObjects.Graphics;
	private confirmButtonMask!: Phaser.GameObjects.Graphics;
	private featurePrice: number = 24000.00;
	private currentBet: number = 0.2; // Start with first bet option
	private slotController: SlotController | null = null;
	private readonly BET_MULTIPLIER: number = 100; // Multiplier for price display
	private betOptions: number[] = BET_OPTIONS;
	private currentBetIndex: number = 0; // Index in betOptions array
	private closeButton!: Phaser.GameObjects.Text;
	private confirmButton!: Phaser.GameObjects.Text;
	private betDisplay!: Phaser.GameObjects.Text;
	private minusButton!: Phaser.GameObjects.Text;
	private plusButton!: Phaser.GameObjects.Text;
	private readonly betButtonDisabledAlpha: number = 0.35;
	private readonly betButtonEnabledAlpha: number = 1;
	
	// Continuous button press functionality
	private minusButtonTimer: Phaser.Time.TimerEvent | null = null;
	private plusButtonTimer: Phaser.Time.TimerEvent | null = null;
	private readonly CONTINUOUS_DELAY: number = 500; // 1 second initial delay
	private readonly CONTINUOUS_INTERVAL: number = 200; // 150ms interval for continuous press
	private priceDisplay!: Phaser.GameObjects.Text;
	private featureLogo?: Phaser.GameObjects.Image;
	private featureLogoBackground?: Phaser.GameObjects.Image;
	private featureLogoSpine?: any;
	private featureLogoScale: number = 0.35; // Manual scale for scatter logo (spine or image)
	private featureLogoBackgroundScale: number = 0.89; // Manual scale for background PNG logo
	private backgroundImage!: Phaser.GameObjects.Image;
	private onCloseCallback?: () => void;
	private onConfirmCallback?: () => void;
	private sceneRef?: Scene;
	private featureLogoSpineRetryTimer: Phaser.Time.TimerEvent | null = null;

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
			// Initialize from SlotController's main BET
			let currentBaseBet = this.slotController.getBaseBetAmount();
			if (!isFinite(currentBaseBet) || currentBaseBet <= 0) {
				try {
					const txt = (this.slotController as any).getBetAmountText?.();
					const parsed = txt ? parseFloat(String(txt)) : NaN;
					if (isFinite(parsed) && parsed > 0) currentBaseBet = parsed;
				} catch {}
			}
			
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
			// Sync HUD Buy Feature price to this initial value
			try { (this.slotController as any).setBuyFeatureBetAmount?.(this.currentBet); } catch {}
		}
	}

	create(scene: Scene): void {
		console.log("[BuyFeature] Creating buy feature component");
		this.sceneRef = scene;
		
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
		
		// Ensure the drawer starts hidden off-screen without playing the hide animation
		this.hideImmediately();
	}

	private createBackground(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		
		// Create semi-transparent overlay with rounded top corners
		this.background = scene.add.graphics();
		this.background.fillStyle(0x000000, 0.80);
		this.background.fillRoundedRect(0, screenHeight - 736, screenWidth, 736, 20);
		this.background.setDepth(-412412);
		try { (this.background as any).setName?.('buy_feature_overlay'); } catch {}
		// Make the background interactive to block clicks behind it
		this.background.setInteractive(new Phaser.Geom.Rectangle(0, 0, screenWidth, screenHeight), Phaser.Geom.Rectangle.Contains);
		
		this.container.add(this.background);
		
		// Create background image to fill the background area
		const backgroundTop = screenHeight - 736;
		this.backgroundImage = scene.add.image(screenWidth / 2, backgroundTop + 368, 'buy_feature_bg');
		
		// Scale the image to fill the background area (736px height)
		const scaleY = 736 / this.backgroundImage.height;
		const scaleX = screenWidth / this.backgroundImage.width;
		const scale = Math.max(scaleX, scaleY); // Use the larger scale to ensure full coverage
		this.backgroundImage.setScale(scale);
		
		this.container.add(this.backgroundImage);
	}

	private createFeatureLogo(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - 736;
		const centerX = screenWidth / 2;
		const centerY = backgroundTop + 210;

		// Create dedicated background PNG (always behind)
		let bgKey = 'scatter_logo_background';
		let hasBg = false;
		try { hasBg = scene.textures.exists(bgKey); } catch { hasBg = false; }
		const availableKeys = (scene.textures as any).getTextureKeys?.() || Object.keys((scene.textures as any).list || {});
		console.log('[BuyFeature] Checking background texture', { key: bgKey, exists: hasBg, availableKeys });
        if (!hasBg) {
			// Fallback: load it dynamically at runtime from the known path and render after load completes
            const runtimeKey = 'scatter_logo_background_runtime';
            const runtimePath = resolveAssetUrl('/assets/portrait/high/buy_feature/scatter_logo_background.webp');
			console.warn('[BuyFeature] Background not preloaded. Loading at runtime from', runtimePath);
			try {
				// Avoid duplicate loads
				if (!scene.textures.exists(runtimeKey)) {
					(scene.load as any).image(runtimeKey, runtimePath);
				}
				scene.load.once('filecomplete-image-' + runtimeKey, () => {
                    try {
                        this.featureLogoBackground = scene.add.image(centerX, centerY, runtimeKey);
                        this.featureLogoBackground.setScale(this.featureLogoBackgroundScale);
                        this.featureLogoBackground.setDepth(101);
                        this.container.add(this.featureLogoBackground);
                        console.log(`[BuyFeature] Background logo CREATED (runtime) key=${runtimeKey} w=${this.featureLogoBackground.width} h=${this.featureLogoBackground.height} scale=${this.featureLogoBackgroundScale}`);
					} catch (err) {
						console.error('[BuyFeature] Failed to create runtime background image', err);
					}
				});
				scene.load.once('complete', () => {
					console.log('[BuyFeature] Runtime loader complete for background');
				});
				scene.load.start();
			} catch (err) {
				console.error('[BuyFeature] Error scheduling runtime load for background', err);
			}
			// Proceed to attempt Spine; background will appear once loaded
        } else {
            this.featureLogoBackground = scene.add.image(centerX, centerY, bgKey);
            this.featureLogoBackground.setScale(this.featureLogoBackgroundScale);
            this.featureLogoBackground.setDepth(101);
            this.container.add(this.featureLogoBackground);
            console.log(`[BuyFeature] Background logo CREATED key=${bgKey} w=${this.featureLogoBackground.width} h=${this.featureLogoBackground.height} scale=${this.featureLogoBackgroundScale}`);
		}

		try {
			this.ensureScatterSpine(scene, centerX, centerY);
		} catch {}
	}

	private scheduleScatterSpineRetry(scene: Scene, x: number, y: number, delayMs: number): void {
		try {
			if (this.featureLogoSpineRetryTimer) {
				try { this.featureLogoSpineRetryTimer.destroy(); } catch {}
				this.featureLogoSpineRetryTimer = null;
			}
		} catch {}
		try {
			this.featureLogoSpineRetryTimer = scene.time.delayedCall(Math.max(0, delayMs | 0), () => {
				try {
					if (!this.container || !this.container.active) return;
					if (!this.sceneRef || this.sceneRef !== scene) return;
					this.ensureScatterSpine(scene, x, y);
				} catch {}
			});
		} catch {}
	}

	private ensureScatterSpine(scene: Scene, centerX: number, centerY: number): void {
		if (!this.container) return;
		try {
			if (this.featureLogoSpine && this.featureLogoSpine.active) {
				try { this.featureLogoSpine.setPosition(centerX, centerY); } catch {}
				try { this.featureLogoSpine.setScale(this.featureLogoScale); } catch {}
				return;
			}
		} catch {}

		if (!ensureSpineFactory(scene, '[BuyFeature] ensureScatterSpine')) {
			this.scheduleScatterSpineRetry(scene, centerX, centerY, 300);
			return;
		}

		const spineKey = 'symbol_0_spine';
		const spineAtlasKey = spineKey + '-atlas';
		if (!(scene.cache.json as any)?.has?.(spineKey)) {
			this.scheduleScatterSpineRetry(scene, centerX, centerY, 600);
			return;
		}

		let s: any = null;
		try {
			s = (scene.add as any).spine(centerX, centerY, spineKey, spineAtlasKey);
		} catch {
			s = null;
		}
		if (!s) {
			this.scheduleScatterSpineRetry(scene, centerX, centerY, 600);
			return;
		}

		try { s.setOrigin(0.5, 0.5); } catch {}
		try { s.skeleton?.setToSetupPose?.(); s.update?.(0); } catch {}
		try { s.setScale(this.featureLogoScale); } catch {}
		try {
			// Keep ordering: background -> logo background -> logo spine -> rest of UI
			const idx = this.featureLogoBackground ? this.container.getIndex(this.featureLogoBackground) : -1;
			if (idx >= 0) {
				this.container.addAt(s, idx + 1);
			} else {
				this.container.add(s);
			}
		} catch {
			try { this.container.add(s); } catch {}
		}
		this.featureLogoSpine = s;

		try {
			const symbolName = 'Symbol0_HTBH';
			const anims = s.skeleton?.data?.animations?.map((a: any) => a?.name).filter(Boolean) || [];
			const preferred = `${symbolName}_win`;
			const fallback = `${symbolName}_hit`;
			const chosen = anims.includes(preferred)
				? preferred
				: (anims.includes(fallback) ? fallback : (anims[0] || null));
			if (chosen) {
				s.animationState?.setAnimation?.(0, chosen, true);
			}
		} catch {}
	}

	private updateFeatureLogoScale(): void {
		if (this.featureLogoSpine) {
			try { this.featureLogoSpine.setScale(this.featureLogoScale); } catch {}
		} else if (this.featureLogo) {
			// No spine available; apply scale to PNG as a fallback representation of the logo
			this.featureLogo.setScale(this.featureLogoScale);
		}
	}

	public setLogoScale(scale: number): void {
		// Clamp to reasonable range
		this.featureLogoScale = Math.max(0.05, Math.min(2.0, scale));
		this.updateFeatureLogoScale();
	}

	private updateFeatureLogoBackgroundScale(): void {
		if (this.featureLogoBackground) {
			this.featureLogoBackground.setScale(this.featureLogoBackgroundScale);
		}
	}

	public setLogoBackgroundScale(scale: number): void {
		// Clamp to reasonable range
		this.featureLogoBackgroundScale = Math.max(0.05, Math.min(3.0, scale));
		this.updateFeatureLogoBackgroundScale();
	}

	private createTitle(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - 736;
		
		const title = scene.add.text(screenWidth / 2 - 110, backgroundTop + 40, 'Buy Feature', {
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
		const backgroundTop = screenHeight - 736;
		
		const featureName = scene.add.text(screenWidth / 2, backgroundTop + 100, "Hustler's Luck Bonus", {
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
		const backgroundTop = screenHeight - 736;
		
		// Calculate price as 100 * current base bet
		const calculatedPrice = this.getCurrentBetValue();
		
		this.priceDisplay = scene.add.text(screenWidth / 2, backgroundTop + 340, `£${this.formatNumberWithCommas(calculatedPrice)}`, {
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
		const backgroundTop = screenHeight - 736;
		const x = screenWidth / 2;
		const y = backgroundTop + 560;
		
		// Use long_button image to match other confirm buttons
		const buttonImage = scene.add.image(x, y, 'long_button');
		buttonImage.setOrigin(0.5, 0.5);
		buttonImage.setDisplaySize(364, 62);
		try { (buttonImage as any).setName?.('buy_feature_confirm_button'); } catch {}
		this.container.add(buttonImage);
		
		// Button label
		this.confirmButton = scene.add.text(x, y, 'BUY FEATURE', {
			fontSize: '24px',
			fontFamily: 'Poppins-Bold',
			color: '#000000'
		});
		this.confirmButton.setOrigin(0.5);
		this.container.add(this.confirmButton);
		
		try {
			buttonImage.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 10 });
		} catch {
			buttonImage.setInteractive();
			try {
				(buttonImage as any).input.pixelPerfect = true;
				(buttonImage as any).input.alphaTolerance = 10;
			} catch {}
		}
		buttonImage.on('pointerdown', () => {
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.confirmPurchase();
		});
	}

	private createCloseButton(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - 736;
		
		this.closeButton = scene.add.text(screenWidth / 2 + 180, backgroundTop + 40, '×', {
			fontSize: '30px',
			fontFamily: 'Poppins-Regular',
			color: '#ffffff'
		});
		try { (this.closeButton as any).setName?.('buy_feature_close_button'); } catch {}
		this.closeButton.setOrigin(0.5);
		this.closeButton.setInteractive();
		this.closeButton.on('pointerdown', () => {
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.close();
		});
		this.container.add(this.closeButton);
	}


	private confirmPurchase(): void {
		console.log(`[BuyFeature] Confirming purchase`);
		// Trigger symbol flash effect
		// Play spin sound immediately when buy feature is confirmed
		try {
			const am: any = (window as any).audioManager;
			if (am && typeof am.playSoundEffect === 'function') {
				am.playSoundEffect(SoundEffectType.SPIN);
			}
		} catch {}
		
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

		// Start positioned below the screen for slide-up effect
		this.container.setY(this.container.scene.scale.height);
		this.container.setVisible(true);
		this.setInputEnabled(true);
		
		// Create slide-up animation
		this.container.scene.tweens.add({
			targets: this.container,
			y: 0,
			duration: 300,
			ease: 'Power2.easeOut',
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
			y: this.container.scene.scale.height,
			duration: 250,
			ease: 'Power2.easeIn',
			onComplete: () => {
				this.container.setVisible(false);
				this.setInputEnabled(false);
				console.log("[BuyFeature] Drawer hidden");
			}
		});
	}

	private createBetInput(scene: Scene): void {
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - 736;
		const x = screenWidth * 0.5;
		const y = backgroundTop + 470;
		
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
		inputBg.fillRoundedRect(-182, -37, 364, 74, 15);
		inputBg.lineStyle(0.5, 0xffffff, 1);
		inputBg.strokeRoundedRect(-182, -37, 364, 74, 15);
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
			if (!this.minusButton?.input?.enabled) {
				return;
			}
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.playBetButtonClickAnimation(this.minusButton);
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
			if (!this.plusButton?.input?.enabled) {
				return;
			}
			if ((window as any).audioManager) {
				(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
			}
			this.playBetButtonClickAnimation(this.plusButton);
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
		this.updateBetButtonStates();
	}

	private playBetButtonClickAnimation(btn: Phaser.GameObjects.Text): void {
		const scene = this.container?.scene;
		if (!scene) return;
		try { scene.tweens.killTweensOf(btn); } catch {}
		try { btn.setScale(1); } catch {}
		try {
			scene.tweens.add({
				targets: btn,
				scaleX: 1.15,
				scaleY: 1.15,
				duration: 70,
				ease: 'Sine.easeOut',
				yoyo: true
			});
		} catch {}
	}

	private setBetButtonEnabled(btn: Phaser.GameObjects.Text, enabled: boolean): void {
		try {
			if (btn?.input) {
				btn.input.enabled = enabled;
			}
		} catch {}
		try {
			btn.setAlpha(enabled ? this.betButtonEnabledAlpha : this.betButtonDisabledAlpha);
		} catch {}
		try {
			btn.setColor(enabled ? '#ffffff' : '#777777');
		} catch {}
	}

	private updateBetButtonStates(): void {
		const atMin = this.currentBetIndex <= 0;
		const atMax = this.currentBetIndex >= this.betOptions.length - 1;
		if (this.minusButton) {
			this.setBetButtonEnabled(this.minusButton, !atMin);
			if (atMin) {
				this.stopContinuousDecrement();
			}
		}
		if (this.plusButton) {
			this.setBetButtonEnabled(this.plusButton, !atMax);
			if (atMax) {
				this.stopContinuousIncrement();
			}
		}
	}

	private selectPreviousBet(): void {
		if (this.currentBetIndex > 0) {
			this.currentBetIndex--;
			this.currentBet = this.betOptions[this.currentBetIndex];
			this.updateBetDisplay();
			this.updatePriceDisplay();
			// Update HUD Buy Feature price indicator
			if (this.slotController && (this.slotController as any).setBuyFeatureBetAmount) {
				(this.slotController as any).setBuyFeatureBetAmount(this.currentBet);
			}
			console.log(`[BuyFeature] Previous bet selected: $${this.currentBet.toFixed(2)}`);
		}
		this.updateBetButtonStates();
	}

	private selectNextBet(): void {
		if (this.currentBetIndex < this.betOptions.length - 1) {
			this.currentBetIndex++;
			this.currentBet = this.betOptions[this.currentBetIndex];
			this.updateBetDisplay();
			this.updatePriceDisplay();
			// Update HUD Buy Feature price indicator
			if (this.slotController && (this.slotController as any).setBuyFeatureBetAmount) {
				(this.slotController as any).setBuyFeatureBetAmount(this.currentBet);
			}
			console.log(`[BuyFeature] Next bet selected: $${this.currentBet.toFixed(2)}`);
		}
		this.updateBetButtonStates();
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
			if (config.logoScale !== undefined) {
				this.setLogoScale(config.logoScale);
			}
			if (config.logoBackgroundScale !== undefined) {
				this.setLogoBackgroundScale(config.logoBackgroundScale);
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
		
		// Ensure logo/background exists or is loaded at runtime (logs inside)
		try {
			this.ensureLogoGeneratedOnShow();
		} catch (e) {
			console.warn('[BuyFeature] ensureLogoGeneratedOnShow threw:', e);
		}
		this.updatePriceDisplay();
		this.updateBetDisplay();
		this.updateBetButtonStates();
		this.setInputEnabled(true);
		this.animateIn();
		
		// Show the mask when the panel is shown (same as BetOptions)
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(true);
			this.confirmButtonMask.setAlpha(1);
		}
	}

	private ensureLogoGeneratedOnShow(): void {
		if (!this.sceneRef) return;
		const scene = this.sceneRef;
		console.log('[BuyFeature] ensureLogoGeneratedOnShow invoked');
		if (!this.featureLogoBackground || !this.featureLogoBackground.active) {
			console.log('[BuyFeature] Logo background missing or inactive; creating now');
			this.createFeatureLogo(scene);
			return;
		}
		// Update position/scale to current layout
		const screenWidth = scene.cameras.main.width;
		const screenHeight = scene.cameras.main.height;
		const backgroundTop = screenHeight - 736;
		const centerX = screenWidth / 2;
		const centerY = backgroundTop + 210;
		this.featureLogoBackground.setPosition(centerX, centerY);
		this.featureLogoBackground.setScale(this.featureLogoBackgroundScale);
		console.log('[BuyFeature] Logo background updated on show', {
			pos: { x: centerX, y: centerY },
			scale: this.featureLogoBackgroundScale,
			texture: this.featureLogoBackground.texture?.key
		});
		try { this.ensureScatterSpine(scene, centerX, centerY); } catch {}
	}

	private hideImmediately(): void {
		if (!this.container) return;
		const scene = this.container.scene;
		if (scene) {
			this.container.setY(scene.scale.height);
		}
		this.container.setVisible(false);
		this.setInputEnabled(false);
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
		try {
			if (this.featureLogoSpineRetryTimer) {
				this.featureLogoSpineRetryTimer.destroy();
				this.featureLogoSpineRetryTimer = null;
			}
		} catch {}
		
		if (this.container) {
			this.setInputEnabled(false);
			this.container.destroy();
		}
	}
}
