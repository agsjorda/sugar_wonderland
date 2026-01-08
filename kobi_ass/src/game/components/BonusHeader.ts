import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class BonusHeader {
	private bonusHeaderContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private spotlight: Phaser.GameObjects.Image;
	private spotlightBounds: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	};
	private amountText: Phaser.GameObjects.Text;
	private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	// Tracks cumulative total during bonus mode by incrementing each spin's subtotal
	private cumulativeBonusWin: number = 0;
	private hasStartedBonusTracking: boolean = false;
	private hasShownFinalTotalWin: boolean = false;

	// Logo spine config (mirrors base header)
	private logoOffsetX: number = 0;
	private logoOffsetY: number = 0;
	private logoScaleMul: number = 0.1;
	private logoSpine?: SpineGameObject;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[BonusHeader] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
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
		
		// Start spotlight animation
		this.startSpotlightAnimation(scene);
	}

	private createBonusHeaderElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		if (screenConfig.isPortrait) {
			this.createPortraitBonusHeader(scene, assetScale);
		} else {
			this.createLandscapeBonusHeader(scene, assetScale);
		}
	}

	private createPortraitBonusHeader(scene: Scene, assetScale: number): void {
		console.log("[BonusHeader] Creating portrait bonus header layout");
		
		// Add Kobo logo as Spine animation (logo_kobo), matching base header behaviour
		this.createLogoSpine(scene, assetScale);

		// Create Spine animated cat bonus
		this.createCatBonusSpineAnimation(scene, assetScale);
		
		// Create Spine animated kobiass bonus
		this.createKobiassBonusSpineAnimation(scene, assetScale);
		
		// Add win bar bonus last to ensure it appears on top
		const winBarBonus = scene.add.image(
			scene.scale.width * 0.51,
			scene.scale.height * 0.315, // Positioned above the tent
			'win-bar-bonus'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10); // Higher depth to appear above tent and kobi-ass
		this.bonusHeaderContainer.add(winBarBonus);

		// Add text inside the win bar bonus
		this.createWinBarText(scene, scene.scale.width * 0.51, scene.scale.height * 0.315);
		
		// Add spotlight
		this.spotlight = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.2,
			'spotlight'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(20).setTint(0xffffff).setAlpha(0.75);
		this.bonusHeaderContainer.add(this.spotlight);

		// Set spotlight bounds for portrait mode
		this.spotlightBounds = {
			minX: scene.scale.width * 0.2,
			maxX: scene.scale.width * 0.8,
			minY: scene.scale.height * 0.08,
			maxY: scene.scale.height * 0.25
		};
	}

	private createLandscapeBonusHeader(scene: Scene, assetScale: number): void {
		console.log("[BonusHeader] Creating landscape bonus header layout");
		
		// Add Kobo logo as Spine animation (logo_kobo), matching base header behaviour
		this.createLogoSpine(scene, assetScale);

		// Create Spine animated cat bonus
		this.createCatBonusSpineAnimation(scene, assetScale);
		
		// Create Spine animated kobiass bonus
		this.createKobiassBonusSpineAnimation(scene, assetScale);
		
		// Add win bar bonus last to ensure it appears on top
		const winBarBonus = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.4, // Positioned in center for landscape
			'win-bar-bonus'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10); // Higher depth to appear above other elements
		this.bonusHeaderContainer.add(winBarBonus);

		// Add text inside the win bar bonus
		this.createWinBarText(scene, scene.scale.width * 0.5, scene.scale.height * 0.4);
		
		// Add spotlight
		this.spotlight = scene.add.image(
			scene.scale.width * 0.7,
			scene.scale.height * 0.3,
			'spotlight'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(20).setTint(0xFFFFFF).setAlpha(0.75);
		this.bonusHeaderContainer.add(this.spotlight);

		// Set spotlight bounds for landscape mode
		this.spotlightBounds = {
			minX: scene.scale.width * 0.1,
			maxX: scene.scale.width * 0.9,
			minY: scene.scale.height * 0.1,
			maxY: scene.scale.height * 0.6
		};
	}

	// Create Spine logo (logo_kobo) with same positioning / scaling / animation as base header
	private createLogoSpine(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[BonusHeader] createLogoSpine')) {
				console.warn('[BonusHeader] Spine factory unavailable. Skipping bonus spine logo creation.');
				return;
			}

			if (!(scene.cache.json as any).has('logo_kobo')) {
				console.warn('[BonusHeader] Spine json for logo_kobo not loaded. Skipping bonus spine logo creation.');
				return;
			}

			const logoSpine = scene.add.spine(
				scene.scale.width * 0.39 + this.logoOffsetX,
				scene.scale.height * 0.13 + this.logoOffsetY,
				'logo_kobo',
				'logo_kobo-atlas'
			);

			logoSpine.setOrigin(0.5, 0.5);
			logoSpine.setScale(assetScale * this.logoScaleMul);
			logoSpine.setDepth(1);

			try {
				const anySpine: any = logoSpine as any;
				const animations = anySpine?.skeleton?.data?.animations;
				if (animations && animations.length > 0) {
					const names = animations.map((a: any) => a.name || a);
					const idleName = names.includes('logo_idle_animation') ? 'logo_idle_animation' : names[0];
					logoSpine.animationState.setAnimation(0, idleName, true);
				}
			} catch {}

			this.bonusHeaderContainer.add(logoSpine);
			this.logoSpine = logoSpine;
		} catch (e) {
			console.warn('[BonusHeader] Failed to create spine logo for bonus header:', e);
		}
	}

	private createCatBonusSpineAnimation(scene: Scene, assetScale: number): void {
		try {
			const width = scene.scale.width;
			const height = scene.scale.height;
			const screenConfig = this.screenModeManager.getScreenConfig();

			// Position cat bonus based on screen orientation
			let catX, catY;
			if (screenConfig.isPortrait) {
				catX = width * 0.13;
				catY = height * 0.26;
			} else {
				catX = width * 0.2;
				catY = height * 0.3;
			}

			// Create the cat bonus Spine animation object
			const catBonusSpineObject = scene.add.spine(catX, catY, "Cat_bonus", "Cat_bonus-atlas");
			catBonusSpineObject.setOrigin(0.5, 0.5);
			catBonusSpineObject.setScale(0.178);
			catBonusSpineObject.setDepth(5);
			catBonusSpineObject.animationState.setAnimation(0, "cat_bonus_bg", true);
			
			this.bonusHeaderContainer.add(catBonusSpineObject);

			console.log('[BonusHeader] Spine cat bonus animation created successfully');
		} catch (error) {
			console.error('[BonusHeader] Error creating Spine cat bonus animation:', error);
		}
	}

	private createKobiassBonusSpineAnimation(scene: Scene, assetScale: number): void {
		try {
			const width = scene.scale.width;
			const height = scene.scale.height;
			const screenConfig = this.screenModeManager.getScreenConfig();

			// Position kobiass bonus based on screen orientation
			let kobiX, kobiY;
			if (screenConfig.isPortrait) {
				kobiX = width * 0.78;
				kobiY = height * 0.175;
			} else {
				kobiX = width * 0.8;
				kobiY = height * 0.25;
			}

			// Create the kobiass bonus Spine animation object
			const kobiassBonusSpineObject = scene.add.spine(kobiX, kobiY, "kobiass_bonus", "kobiass_bonus-atlas");
			kobiassBonusSpineObject.setOrigin(0.5, 0.5);
			kobiassBonusSpineObject.setScale(-0.13, 0.13); // Negative X scale to flip horizontally
			kobiassBonusSpineObject.setDepth(5);
			kobiassBonusSpineObject.animationState.setAnimation(0, "win", true);
			
			this.bonusHeaderContainer.add(kobiassBonusSpineObject);

			console.log('[BonusHeader] Spine kobiass bonus animation created successfully');
		} catch (error) {
			console.error('[BonusHeader] Error creating Spine kobiass bonus animation:', error);
		}
	}

	private startSpotlightAnimation(scene: Scene): void {
		if (!this.spotlight) {
			console.warn('[BonusHeader] Spotlight not found, cannot start animation');
			return;
		}

		console.log('[BonusHeader] Starting continuous spotlight animation');
		
		// Start continuous movement
		this.moveSpotlightContinuously(scene);
	}

	private moveSpotlightContinuously(scene: Scene): void {
		if (!this.spotlight || !this.spotlightBounds) {
			return;
		}

		// Generate random position within bounds
		const randomX = Phaser.Math.Between(this.spotlightBounds.minX, this.spotlightBounds.maxX);
		const randomY = Phaser.Math.Between(this.spotlightBounds.minY, this.spotlightBounds.maxY);

		// Create smooth tween animation with continuous loop
		scene.tweens.add({
			targets: this.spotlight,
			x: randomX,
			y: randomY,
			duration: 1200, // 1.2 seconds for smooth movement
			ease: 'Sine.easeInOut',
			onComplete: () => {
				// Immediately start next movement for continuous flow
				this.moveSpotlightContinuously(scene);
			}
		});
	}

	private stopSpotlightAnimation(): void {
		if (this.spotlight) {
			// Stop all tweens on the spotlight
			this.spotlight.scene.tweens.killTweensOf(this.spotlight);
		}
	}

	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x, y - 7, 'YOU WON', {
			fontSize: '16px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting
		// Check if demo mode is active - if so, use blank currency symbol
		const sceneAny: any = scene;
		const isDemoInitial = sceneAny?.gameAPI?.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
		const currencySymbolInitial = isDemoInitial ? '' : '$';
		const initialText = isDemoInitial ? '0.00' : `$ 0.00`;
		this.amountText = scene.add.text(x, y + 14, initialText, {
			fontSize: '20px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.amountText);
	}

	/**
	 * Update the winnings display in the bonus header
	 */
	public updateWinningsDisplay(winnings: number): void {
		if (this.amountText && this.youWonText) {
			this.currentWinnings = winnings;
			const formattedWinnings = this.formatCurrency(winnings);
			this.amountText.setText(formattedWinnings);
			
			// Show both texts when updating winnings
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			
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

			// Revert logo to idle animation when hiding winnings (match base header behaviour)
			this.playLogoIdle();
			
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
			this.currentWinnings = winnings;
			const formattedWinnings = this.formatCurrency(winnings);
			
			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);

			// Trigger logo win animation only when there is an actual win amount
			// Avoid playing win animation for 0 / non-positive totals (e.g. at bonus start)
			if (winnings > 0) {
				this.playLogoWin();
			} else {
				// Ensure we stay in idle state when there is no win yet
				this.playLogoIdle();
			}
			
			// Update amount text with winnings
			this.amountText.setText(formattedWinnings);
			
			console.log(`[BonusHeader] Winnings display shown: ${formattedWinnings} (raw: ${winnings})`);
		} else {
			console.warn('[BonusHeader] Cannot show winnings display - text objects not available', {
				amountText: !!this.amountText,
				youWonText: !!this.youWonText
			});
		}
	}

	/**
	 * Format currency value for display
	 */
	private formatCurrency(amount: number): string {
		// Check if demo mode is active - if so, remove currency symbol
		const sceneAny: any = this.bonusHeaderContainer?.scene;
		const isDemo = sceneAny?.gameAPI?.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
		
		if (amount === 0) {
			return isDemo ? '0.00' : '$ 0.00';
		}
		
		// Format with commas for thousands and 2 decimal places
		if (isDemo) {
			// In demo mode, format without currency symbol
			return amount.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		} else {
			const formatted = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(amount);
			
			return formatted;
		}
	}

	/**
	 * Get current winnings amount
	 */
	public getCurrentWinnings(): number {
		return this.currentWinnings;
	}

	/**
	 * Get cumulative bonus win total
	 */
	public getCumulativeBonusWin(): number {
		return this.cumulativeBonusWin;
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
		// Listen for spin events to hide winnings display at start of manual spin
		gameEventManager.on(GameEventType.SPIN, () => {
			console.log('[BonusHeader] Manual spin started - hiding winnings display');
			this.hideWinningsDisplay();
		});

		// Listen for autoplay start to hide winnings display
		gameEventManager.on(GameEventType.AUTO_START, () => {
			console.log('[BonusHeader] Auto play started - hiding winnings display');
			this.hideWinningsDisplay();
		});

		// Listen for autoplay stop to reveal final TOTAL WIN when bonus free spins finish
		gameEventManager.on(GameEventType.AUTO_STOP, () => {
			// Only react when bonus free spins have fully completed
			if (!gameStateManager.isBonusFinished || this.hasShownFinalTotalWin) {
				return;
			}
			let totalWin = this.cumulativeBonusWin;
			try {
				const sceneAny: any = this.bonusHeaderContainer?.scene;
				const symbolsComponent = sceneAny?.symbols;
				const spinData = symbolsComponent?.currentSpinData;
				const slot = spinData?.slot;
				if (slot) {
					const freespinData = slot.freespin || slot.freeSpin;
					if (freespinData) {
						if (typeof freespinData.totalWin === 'number') {
							totalWin = freespinData.totalWin;
						} else if (Array.isArray(freespinData.items)) {
							totalWin = freespinData.items.reduce((sum: number, item: any) => {
								return sum + (item.subTotalWin || 0);
							}, 0);
						}
					}
				}
			} catch (e) {
				console.warn('[BonusHeader] AUTO_STOP: failed to derive backend freespin total, falling back to cumulativeBonusWin', e);
			}
			console.log(`[BonusHeader] AUTO_STOP (bonus finished): showing final TOTAL WIN = $${totalWin}`);
			if (this.youWonText) {
				this.youWonText.setText('TOTAL WIN');
			}
			this.showWinningsDisplay(totalWin);
			this.hasShownFinalTotalWin = true;
		});

		// Listen for reels start to hide winnings display
		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[BonusHeader] Reels started');
			if (gameStateManager.isBonus) {
				// Initialize tracking on first spin in bonus mode
				if (!this.hasStartedBonusTracking) {
					this.cumulativeBonusWin = 0;
					this.hasStartedBonusTracking = true;
					this.hasShownFinalTotalWin = false;
				}
				const totalWinSoFar = this.cumulativeBonusWin;
				console.log(`[BonusHeader] REELS_START (bonus): showing TOTAL WIN so far = $${totalWinSoFar}`);
				
				if (this.youWonText) {
					this.youWonText.setText('TOTAL WIN');
				}
				this.showWinningsDisplay(totalWinSoFar);
			} else {
				// Normal mode behavior: hide winnings at the start of the spin
				this.hasStartedBonusTracking = false;
				this.cumulativeBonusWin = 0;
				this.hideWinningsDisplay();
			}
		});

		// Listen for reel done events to show winnings display (like regular header)
		gameEventManager.on(GameEventType.REELS_STOP, (data: any) => {
			console.log(`[BonusHeader] REELS_STOP received - checking for wins`);

			// In bonus mode, per-spin display is handled on WIN_STOP; skip here to avoid label mismatch
			if (gameStateManager.isBonus) {
				console.log('[BonusHeader] In bonus mode - skipping REELS_STOP winnings update (handled on WIN_STOP)');
				return;
			}
			
			// Get the current spin data from the Symbols component
			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			if (symbolsComponent && symbolsComponent.currentSpinData) {
				const spinData = symbolsComponent.currentSpinData;
				console.log(`[BonusHeader] Found current spin data:`, spinData);
				
				// Use the same logic as regular header - calculate from paylines
				if (spinData.slot && spinData.slot.paylines && spinData.slot.paylines.length > 0) {
					const totalWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
					console.log(`[BonusHeader] Total winnings calculated from paylines: ${totalWin}`);
					
					if (totalWin > 0) {
						this.showWinningsDisplay(totalWin);
					} else {
						this.hideWinningsDisplay();
					}
				} else {
					console.log('[BonusHeader] No paylines in current spin data - hiding winnings display');
					this.hideWinningsDisplay();
				}
			} else {
				console.log('[BonusHeader] No current spin data available - hiding winnings display');
				this.hideWinningsDisplay();
			}
		});

		// On WIN_START during bonus, show per-spin win with "YOU WON"
		gameEventManager.on(GameEventType.WIN_START, () => {
			if (!gameStateManager.isBonus) {
				return;
			}
			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			const spinData = symbolsComponent?.currentSpinData;
			let spinWin = 0;
			if (spinData?.slot?.paylines && spinData.slot.paylines.length > 0) {
				spinWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
			}
			if (this.youWonText) {
				this.youWonText.setText('YOU WIN');
			}
			if (spinWin > 0) {
				this.showWinningsDisplay(spinWin);
			} else {
				this.hideWinningsDisplay();
			}
		});

		// On WIN_STOP during bonus, accumulate subtotal and, on the final free spin, show TOTAL WIN immediately
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			if (!gameStateManager.isBonus && !gameStateManager.isBonusFinished) {
				return;
			}
			const symbolsComponent = (this.bonusHeaderContainer.scene as any).symbols;
			const spinData = symbolsComponent?.currentSpinData;
			let spinWin = 0;
			if (spinData?.slot?.paylines && spinData.slot.paylines.length > 0) {
				spinWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
			}
			if (!this.hasStartedBonusTracking) {
				this.cumulativeBonusWin = 0;
				this.hasStartedBonusTracking = true;
			}
			this.cumulativeBonusWin += (spinWin || 0);
			console.log(`[BonusHeader] WIN_STOP (bonus): accumulated spinWin=$${spinWin}, cumulativeBonusWin=$${this.cumulativeBonusWin}`);

			// When the bonus is finished, show the final TOTAL WIN for the entire bonus session
			if (gameStateManager.isBonusFinished && !this.hasShownFinalTotalWin) {
				this.hasShownFinalTotalWin = true;
				try {
					const totalToShow = this.cumulativeBonusWin;
					if (this.youWonText) {
						this.youWonText.setText('TOTAL WIN');
					}
					this.showWinningsDisplay(totalToShow);
				} catch {}
			}
		});
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

		// Fallback: calculate from paylines if no subTotalWin available
		if (spinData.slot?.paylines && spinData.slot.paylines.length > 0) {
			const totalWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
			console.log(`[BonusHeader] Calculated from paylines: $${totalWin}`);
			
			// Only show display if totalWin > 0, otherwise hide it
			if (totalWin > 0) {
				console.log(`[BonusHeader] Showing winnings display with payline calculation: $${totalWin}`);
				this.updateWinningsDisplay(totalWin);
			} else {
				console.log(`[BonusHeader] No wins from paylines, hiding winnings display`);
				this.hideWinningsDisplay();
			}
		} else {
			console.log('[BonusHeader] No win data available in spin data, hiding display');
			this.hideWinningsDisplay();
		}
	}

	/**
	 * Calculate total win from paylines (fallback method)
	 */
	private calculateTotalWinFromPaylines(paylines: any[]): number {
		let totalWin = 0;
		for (const payline of paylines) {
			if (payline.win && payline.win > 0) {
				totalWin += payline.win;
			}
		}
		return totalWin;
	}

	resize(scene: Scene): void {
		if (this.bonusHeaderContainer) {
			this.bonusHeaderContainer.setSize(scene.scale.width, scene.scale.height);
		}

		// Reposition / rescale logo spine on resize (mirrors base header)
		if (this.logoSpine) {
			const s = this.networkManager.getAssetScale();
			this.logoSpine.x = scene.scale.width * 0.39 + this.logoOffsetX;
			this.logoSpine.y = scene.scale.height * 0.13 + this.logoOffsetY;
			this.logoSpine.setScale(s * this.logoScaleMul);
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
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusHeaderContainer;
	}

	// --- Logo animation helpers (mirrors base header) ---
	private playLogoIdle(): void {
		try {
			if (!this.logoSpine) return;
			const anySpine: any = this.logoSpine as any;
			const animations = anySpine?.skeleton?.data?.animations;
			if (!animations || animations.length === 0) return;
			const names = animations.map((a: any) => a.name || a);
			const idleName = names.includes('logo_idle_animation') ? 'logo_idle_animation' : null;
			if (!idleName) return;
			const current = this.logoSpine.animationState.getCurrent(0);
			const currentName = current?.animation?.name;
			// Do not restart if already playing idle
			if (currentName === idleName) return;
			this.logoSpine.animationState.setAnimation(0, idleName, true);
		} catch {}
	}

	// Play logo win animation once, then queue back to idle
	private playLogoWin(): void {
		try {
			if (!this.logoSpine) return;
			const anySpine: any = this.logoSpine as any;
			const animations = anySpine?.skeleton?.data?.animations;
			if (!animations || animations.length === 0) return;
			const names = animations.map((a: any) => a.name || a);
			const winName = names.includes('logo_win_animation') ? 'logo_win_animation' : null;
			if (winName) {
				// Loop win animation during active winnings
				this.logoSpine.animationState.setAnimation(0, winName, true);
			}
		} catch {}
	}

	destroy(): void {
		// Stop spotlight animation
		this.stopSpotlightAnimation();
		
		if (this.bonusHeaderContainer) {
			this.bonusHeaderContainer.destroy();
		}
	}
}
