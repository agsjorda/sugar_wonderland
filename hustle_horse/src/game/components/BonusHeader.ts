import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { HEADER_YOUWIN_OFFSET_X, HEADER_YOUWIN_OFFSET_Y, HEADER_AMOUNT_OFFSET_X, HEADER_AMOUNT_OFFSET_Y } from '../../config/UIPositionConfig';

export class BonusHeader {
    private bonusHeaderContainer: Phaser.GameObjects.Container;
    private networkManager: NetworkManager;
    private screenModeManager: ScreenModeManager;
    private amountText: Phaser.GameObjects.Text;
    private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	// Tracks cumulative total during bonus mode by incrementing each spin's subtotal
	private cumulativeBonusWin: number = 0;
	private hasStartedBonusTracking: boolean = false;
	private hasAccumulatedForCurrentSpin: boolean = false;

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
		// Add base logo in bonus scene (same as base header)
		        const logo = scene.add.image(
            scene.scale.width * 0.5,
            scene.scale.height * 0.13,
            'hustle-horse-logo'
        ).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
        this.bonusHeaderContainer.add(logo);
        // Smooth, slower pulse animation for the bonus header logo (portrait)
        try {
            const baseX = logo.scaleX;
            const baseY = logo.scaleY;
            scene.tweens.add({
                targets: logo,
                scaleX: baseX * 1.08,
                scaleY: baseY * 1.08,
                duration: 1200,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        } catch {}

		// Add win text at same position as base header (0.51w, 0.237h)
		this.createWinBarText(scene, scene.scale.width * 0.51, scene.scale.height * 0.237);
		// Spotlight removed
	}

	private createLandscapeBonusHeader(scene: Scene, assetScale: number): void {
		console.log("[BonusHeader] Creating landscape bonus header layout");
		// Add base logo in bonus scene (same as base header)
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.13,
			'hustle-horse-logo'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bonusHeaderContainer.add(logo);

		// Add win text at same position as base header (0.51w, 0.237h)
		this.createWinBarText(scene, scene.scale.width * 0.51, scene.scale.height * 0.237);
	}

	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x + HEADER_YOUWIN_OFFSET_X, y - 7 + HEADER_YOUWIN_OFFSET_Y, 'YOU WON', {
			fontSize: '16px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.bonusHeaderContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting
		// Check if demo mode is active - if so, use blank currency symbol
		const sceneAny: any = scene;
		const isDemoInitial = sceneAny?.gameAPI?.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
		const currencySymbolInitial = isDemoInitial ? '' : '$';
		const initialText = isDemoInitial ? '0.00' : '$ 0.00';
		this.amountText = scene.add.text(x + HEADER_AMOUNT_OFFSET_X, y + 14 + HEADER_AMOUNT_OFFSET_Y, initialText, {
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
		const isDemo = sceneAny?.gameAPI?.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
		
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
			if (!gameStateManager.isBonusFinished) {
				return;
			}
			// Prefer backend freespin total so this matches the Congrats dialog
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
		});

		// Listen for reels start to hide winnings display
		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[BonusHeader] Reels started');
			this.hasAccumulatedForCurrentSpin = false;
			// During bonus mode, display TOTAL WIN accumulated so far at the start of the spin
			if (gameStateManager.isBonus) {
				// Initialize tracking on first spin in bonus mode
				if (!this.hasStartedBonusTracking) {
					this.cumulativeBonusWin = 0;
					this.hasStartedBonusTracking = true;
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
			const sceneAny: any = this.bonusHeaderContainer?.scene;
			const symbolsComponent = sceneAny?.symbols;
			const spinData = symbolsComponent?.currentSpinData;
			let spinWin = 0;
			if (spinData?.slot?.paylines && spinData.slot.paylines.length > 0) {
				spinWin = this.calculateTotalWinFromPaylines(spinData.slot.paylines);
			}
			if (spinWin > 0) {
				if (sceneAny?.time?.delayedCall) {
					sceneAny.time.delayedCall(300, () => {
						if (!gameStateManager.isBonus) {
							return;
						}
						if (this.youWonText) {
							this.youWonText.setText('YOU WIN');
						}
						this.showWinningsDisplay(spinWin);
					});
				} else {
					if (this.youWonText) {
						this.youWonText.setText('YOU WIN');
					}
					this.showWinningsDisplay(spinWin);
				}
			} else {
				this.hideWinningsDisplay();
			}
		});

		// On WIN_STOP during bonus, only accumulate subtotal for next REELS_START display
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			if (!gameStateManager.isBonus) {
				return;
			}
			if (this.hasAccumulatedForCurrentSpin) {
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
			this.hasAccumulatedForCurrentSpin = true;
			console.log(`[BonusHeader] WIN_STOP (bonus): accumulated spinWin=$${spinWin}, cumulativeBonusWin=$${this.cumulativeBonusWin}`);
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
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusHeaderContainer;
	}

	destroy(): void {
		if (this.bonusHeaderContainer) {
			this.bonusHeaderContainer.destroy();
		}
	}
}
