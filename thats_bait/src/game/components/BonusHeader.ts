import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { HEADER_YOUWIN_OFFSET_X, HEADER_YOUWIN_OFFSET_Y, HEADER_AMOUNT_OFFSET_X, HEADER_AMOUNT_OFFSET_Y } from '../../config/UIPositionConfig';

export class BonusHeader {
    private bonusHeaderContainer!: Phaser.GameObjects.Container;
    private networkManager: NetworkManager;
    private screenModeManager: ScreenModeManager;
	private headerOffsetX: number = 0;
	private headerOffsetY: number = 470;
	private headerScale: number = 1.0;
	private amountText!: Phaser.GameObjects.Text;
	private youWonText!: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	// Tracks cumulative total during bonus mode by incrementing each spin's subtotal
	private cumulativeBonusWin: number = 0;
	private hasStartedBonusTracking: boolean = false;
	private lastBackendTotalWin: number = -1;
	private spinBaseTotalWin: number = 0;
	private spinSeenPaylineKeys: Set<string> = new Set();
	private spinIncrementalActive: boolean = false;

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
		this.bonusHeaderContainer.setDepth(900);
		this.bonusHeaderContainer.setVisible(false);
		
		const assetScale = this.networkManager.getAssetScale();
		const width = scene.scale.width;
		const height = scene.scale.height;
		const headerCenterX = width * 0.5 + this.headerOffsetX;
		const headerCenterY = height * 0.12 + this.headerOffsetY;
		
		console.log(`[BonusHeader] Creating bonus header with scale: ${assetScale}x`);
		this.createPortraitBonusHeader(scene, assetScale, headerCenterX, headerCenterY);
		try { this.youWonText?.setText('TOTAL WIN'); } catch {}
		
		// Set up event listeners for winnings updates (like regular header)
		this.setupWinningsEventListener();
		try {
			const sceneAny: any = this.bonusHeaderContainer?.scene as any;
			sceneAny?.events?.on?.('bonus-total-win-updated', (totalWin: number) => {
				try {
					if (!gameStateManager.isBonus) return;
					const v = Number(totalWin);
					if (!isFinite(v) || v < 0) return;
					this.lastBackendTotalWin = v;
				} catch {}
			});
			try {
				sceneAny?.events?.on?.('activateBonusMode', () => {
					try {
						this.spinIncrementalActive = false;
						this.spinSeenPaylineKeys.clear();
						this.lastBackendTotalWin = -1;
						this.cumulativeBonusWin = 0;
						this.currentWinnings = 0;
						this.hasStartedBonusTracking = true;
						try { this.youWonText?.setText('TOTAL WIN'); } catch {}
						try { this.showWinningsDisplay(0); } catch {}
					} catch {}
				});
			} catch {}
			sceneAny?.events?.on?.('bonus-win-delta', (delta: number) => {
				try {
					if (!gameStateManager.isBonus) return;
					const d = Number(delta);
					if (!isFinite(d) || d <= 0) return;

					let cap: number | null = null;
					try {
						const symbolsComponent = sceneAny?.symbols;
						const spinData = symbolsComponent?.currentSpinData;
						const items: any[] | undefined = spinData?.slot?.freespin?.items || spinData?.slot?.freeSpin?.items;
						if (Array.isArray(items) && items.length > 0) {
							const v = Number(items[0]?.runningWin);
							if (isFinite(v) && v >= 0) cap = v;
						}
					} catch {}

					const from = Number(this.currentWinnings ?? 0) || 0;
					let target = from + d;
					if (cap != null && cap > from && target > cap) target = cap;
					if (target > from) {
						this.animateTotalWinTo(target);
					}
				} catch {}
			});
			const onWinlineShown = (payline: any) => {
				try {
					if (!gameStateManager.isBonus) return;
					if (!this.spinIncrementalActive) return;
					const w = Number(payline?.win);
					if (!isFinite(w) || w <= 0) return;
					const k = `${Number(payline?.lineKey)}_${Number(payline?.symbol)}_${Number(payline?.count)}_${w}`;
					if (this.spinSeenPaylineKeys.has(k)) return;
					this.spinSeenPaylineKeys.add(k);

					let cap: number | null = null;
					try {
						const symbolsComponent = sceneAny?.symbols;
						const spinData = symbolsComponent?.currentSpinData;
						const items: any[] | undefined = spinData?.slot?.freespin?.items || spinData?.slot?.freeSpin?.items;
						if (Array.isArray(items) && items.length > 0) {
							const v = Number(items[0]?.runningWin);
							if (isFinite(v) && v >= 0) cap = v;
						}
					} catch {}

					const from = Number(this.currentWinnings ?? 0) || 0;
					let target = from + w;
					if (cap != null && cap > from && target > cap) target = cap;
					if (target > from) {
						this.animateTotalWinTo(target);
					}
				} catch {}
			};
			sceneAny?.events?.on?.('winline-shown', onWinlineShown);
		} catch {}
		this.initializeWinnings();
	}

	setVisible(visible: boolean): void {
		try { this.bonusHeaderContainer?.setVisible(visible); } catch {}
	}

	private createPortraitBonusHeader(scene: Scene, assetScale: number, x: number, y: number): void {
		console.log("[BonusHeader] Creating portrait bonus header layout");
		// Add win text at same position as base header (0.51w, 0.237h)
		this.createWinBarText(scene, x, y, assetScale);
		// Spotlight removed
	}


	private createWinBarText(scene: Scene, x: number, y: number, assetScale: number): void {
		const fontScale = assetScale * this.headerScale;
		const headerTopOffset = -7 * fontScale;
		const headerAmountOffset = 14 * fontScale;
		const shadowOffsetY = 2 * fontScale;
		const shadowBlur = 4 * fontScale;
		// Line 1: "TOTAL WIN"
		this.youWonText = scene.add.text(x + HEADER_YOUWIN_OFFSET_X, y + headerTopOffset + HEADER_YOUWIN_OFFSET_Y, 'TOTAL WIN', {
			fontSize: `${16 * fontScale}px`,
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.youWonText.setShadow(0, shadowOffsetY, '#000000', shadowBlur, true, true);
		this.bonusHeaderContainer.add(this.youWonText);

		// Line 2: "$ 0.00" with bold formatting
		this.amountText = scene.add.text(x + HEADER_AMOUNT_OFFSET_X, y + headerAmountOffset + HEADER_AMOUNT_OFFSET_Y, '$ 0.00', {
			fontSize: `${20 * fontScale}px`,
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.amountText.setShadow(0, shadowOffsetY, '#000000', shadowBlur, true, true);
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
			try { this.youWonText.setText('TOTAL WIN'); } catch {}
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			
			console.log(`[BonusHeader] Winnings updated to: ${formattedWinnings} (raw: ${winnings})`);
		}
	}

	private getBackendTotalWin(spinData: any): number | null {
		const currentTotal = Number(this.cumulativeBonusWin ?? 0) || 0;
		const isBonus = !!gameStateManager.isBonus;

		let fsTotal: number | null = null;
		let slotTotal: number | null = null;
		let running: number | null = null;

		try {
			const items: any[] | undefined = spinData?.slot?.freespin?.items || spinData?.slot?.freeSpin?.items;
			if (Array.isArray(items) && items.length > 0) {
				const v = Number(items[0]?.runningWin);
				if (isFinite(v) && v >= 0) running = v;
			}
		} catch {}

		try {
			const v = Number(spinData?.slot?.freespin?.totalWin);
			if (isFinite(v) && v >= 0) fsTotal = v;
		} catch {}
		try {
			const v = Number(spinData?.slot?.freeSpin?.totalWin);
			if (isFinite(v) && v >= 0) fsTotal = fsTotal == null ? v : Math.max(fsTotal, v);
		} catch {}
		try {
			const v = Number(spinData?.slot?.totalWin);
			if (isFinite(v) && v >= 0) slotTotal = v;
		} catch {}

		// Prefer slot/freespin totals for incremental UI updates; use runningWin as a fallback/cap.
		const preferred = isBonus
			? (fsTotal != null ? fsTotal : (slotTotal != null ? slotTotal : running))
			: (slotTotal != null ? slotTotal : (fsTotal != null ? fsTotal : running));
		if (typeof preferred === 'number' && isFinite(preferred) && preferred >= 0) {
			// During bonus, never allow the displayed total to regress (common backend transient where totalWin arrives as 0).
			if (isBonus && currentTotal > 0 && preferred < currentTotal) {
				return currentTotal;
			}
			return preferred;
		}

		// Legacy fallbacks
		try {
			const v4 = Number(spinData?.slot?.freeSpin?.win);
			if (isFinite(v4) && v4 >= 0) return (isBonus && currentTotal > 0 && v4 < currentTotal) ? currentTotal : v4;
		} catch {}
		try {
			const v5 = Number(spinData?.slot?.freespin?.win);
			if (isFinite(v5) && v5 >= 0) return (isBonus && currentTotal > 0 && v5 < currentTotal) ? currentTotal : v5;
		} catch {}
		try {
			const v6 = Number(spinData?.slot?.freeSpin?.subTotalWin);
			if (isFinite(v6) && v6 >= 0) return (isBonus && currentTotal > 0 && v6 < currentTotal) ? currentTotal : v6;
		} catch {}
		try {
			const v7 = Number(spinData?.slot?.freespin?.subTotalWin);
			if (isFinite(v7) && v7 >= 0) return (isBonus && currentTotal > 0 && v7 < currentTotal) ? currentTotal : v7;
		} catch {}

		return null;
	}

	public animateTotalWinTo(totalWin: number): void {
		try {
			if (!this.amountText || !this.youWonText || !this.bonusHeaderContainer) return;
			const scene: any = this.bonusHeaderContainer.scene;
			if (!scene) return;
			const to = Number(totalWin);
			if (!isFinite(to) || to < 0) return;

			// In bonus mode, avoid snapping the display back to 0/regressing if backend sends a transient lower value.
			try {
				if (gameStateManager.isBonus) {
					const current = Number(this.cumulativeBonusWin ?? 0) || 0;
					if (current > 0 && to < current) {
						return;
					}
				}
			} catch {}

			if (!this.hasStartedBonusTracking) {
				this.cumulativeBonusWin = 0;
				this.hasStartedBonusTracking = true;
			}

			this.cumulativeBonusWin = to;

			try {
				if (this.youWonText) {
					this.youWonText.setText('TOTAL WIN');
				}
			} catch {}
			try { this.youWonText.setVisible(true); } catch {}
			try { this.amountText.setVisible(true); } catch {}

			const from = Number(this.currentWinnings ?? 0) || 0;
			if (Math.abs(to - from) < 0.0001) {
				this.updateWinningsDisplay(to);
				this.lastBackendTotalWin = to;
				return;
			}

			let speed = 1.0;
			try { speed = gameStateManager.isTurbo ? 0.65 : 1.0; } catch {}
			const duration = Math.max(220, Math.floor(520 * speed));

			const proxy: any = { value: from };
			try { (this as any).__totalWinProxy = proxy; } catch {}
			try { scene.tweens.killTweensOf(proxy); } catch {}
			try {
				scene.tweens.add({
					targets: proxy,
					value: to,
					duration,
					ease: 'Sine.easeOut',
					onUpdate: () => {
						try { this.updateWinningsDisplay(Number(proxy.value) || 0); } catch {}
					},
					onComplete: () => {
						try { this.updateWinningsDisplay(to); } catch {}
					}
				});
			} catch {
				this.updateWinningsDisplay(to);
			}

			try {
				try { scene.tweens.killTweensOf([this.amountText, this.youWonText]); } catch {}
				const ax = (this.amountText.scaleX ?? 1) as number;
				const ay = (this.amountText.scaleY ?? 1) as number;
				const yx = (this.youWonText.scaleX ?? 1) as number;
				const yy = (this.youWonText.scaleY ?? 1) as number;
				scene.tweens.add({
					targets: this.amountText,
					scaleX: ax * 1.08,
					scaleY: ay * 1.08,
					duration: Math.max(90, Math.floor(140 * speed)),
					ease: 'Sine.easeOut',
					yoyo: true,
					repeat: 1
				});
				scene.tweens.add({
					targets: this.youWonText,
					scaleX: yx * 1.08,
					scaleY: yy * 1.08,
					duration: Math.max(90, Math.floor(140 * speed)),
					ease: 'Sine.easeOut',
					yoyo: true,
					repeat: 1
				});
			} catch {}

			try {
				try { this.amountText.setColor('#ffd166'); } catch {}
				try { this.youWonText.setColor('#ffd166'); } catch {}
				try {
					scene.time.delayedCall(Math.max(140, Math.floor(220 * speed)), () => {
						try { this.amountText.setColor('#ffffff'); } catch {}
						try { this.youWonText.setColor('#ffffff'); } catch {}
					});
				} catch {
					try {
						setTimeout(() => {
							try { this.amountText.setColor('#ffffff'); } catch {}
							try { this.youWonText.setColor('#ffffff'); } catch {}
						}, Math.max(140, Math.floor(220 * speed)));
					} catch {}
				}
			} catch {}

			this.lastBackendTotalWin = to;
		} catch {}
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
			try { this.youWonText.setText('TOTAL WIN'); } catch {}
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
	 * Initialize winnings display when bonus header starts
	 */
	public initializeWinnings(): void {
		console.log('[BonusHeader] Initializing winnings display - starting hidden');
		this.currentWinnings = 0;
		try {
			if (this.youWonText) {
				this.youWonText.setText('TOTAL WIN');
			}
		} catch {}
		try { this.showWinningsDisplay(0); } catch { this.hideWinningsDisplay(); }
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
			if (gameStateManager.isBonus) {
				try { this.showWinningsDisplay(this.cumulativeBonusWin); } catch {}
				return;
			}
			this.hideWinningsDisplay();
		});

		// Listen for autoplay start to hide winnings display
		gameEventManager.on(GameEventType.AUTO_START, () => {
			console.log('[BonusHeader] Auto play started - hiding winnings display');
			if (gameStateManager.isBonus) {
				try { this.showWinningsDisplay(this.cumulativeBonusWin); } catch {}
				return;
			}
			this.hideWinningsDisplay();
		});

		// Listen for reels start to hide winnings display
		gameEventManager.on(GameEventType.REELS_START, () => {
			console.log('[BonusHeader] Reels started');
			// During bonus mode, display TOTAL WIN accumulated so far at the start of the spin
			if (gameStateManager.isBonus) {
				// Initialize tracking on first spin in bonus mode
				if (!this.hasStartedBonusTracking) {
					this.cumulativeBonusWin = 0;
					this.hasStartedBonusTracking = true;
				}
				const totalWinSoFar = this.cumulativeBonusWin;
				console.log(`[BonusHeader] REELS_START (bonus): showing TOTAL WIN so far = $${totalWinSoFar}`);
				
				try {
					if (this.youWonText) {
						this.youWonText.setText('TOTAL WIN');
					}
				} catch {}
				try { this.showWinningsDisplay(totalWinSoFar); } catch {}
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

		gameEventManager.on(GameEventType.WIN_START, () => {
			if (!gameStateManager.isBonus) return;
			try {
				this.spinIncrementalActive = true;
				this.spinSeenPaylineKeys.clear();
				this.spinBaseTotalWin = Number(this.cumulativeBonusWin ?? 0) || 0;
				try { this.youWonText?.setText('TOTAL WIN'); } catch {}
				try { this.showWinningsDisplay(this.spinBaseTotalWin); } catch {}
			} catch {}
		});

		// On WIN_STOP during bonus, only accumulate subtotal for next REELS_START display
		gameEventManager.on(GameEventType.WIN_STOP, () => {
			if (!gameStateManager.isBonus) {
				return;
			}
			try { this.spinIncrementalActive = false; } catch {}
		});

		try {
			const sceneAny: any = this.bonusHeaderContainer?.scene as any;
			sceneAny?.events?.on?.('hook-collector-complete', () => {
				try {
					if (!gameStateManager.isBonus) return;
					return;
				} catch {}
			});
		} catch {}

		try {
			const sceneAny: any = this.bonusHeaderContainer?.scene as any;
			sceneAny?.events?.on?.('dynamite-complete', () => {
				try {
					if (!gameStateManager.isBonus) return;
					return;
				} catch {}
			});
		} catch {}
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

		if (gameStateManager.isBonus) {
			// Bonus TOTAL WIN is driven by per-event deltas (winline-shown / bonus-win-delta).
			// Do not snap the display to backend-provided totals/subtotals.
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
