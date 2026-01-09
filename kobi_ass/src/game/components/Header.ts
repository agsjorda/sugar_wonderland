import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { Data } from "../../tmp_backend/Data";
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { PaylineData } from '../../backend/SpinData';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from '../../utils/SpineGuard';


export class Header {
	private headerContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private amountText: Phaser.GameObjects.Text;
	private youWonText: Phaser.GameObjects.Text;
	private currentWinnings: number = 0;
	private pendingWinnings: number = 0;
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
		console.log(`[Header] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Header] Creating header elements");
		
		// Create main container for all header elements
		this.headerContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Header] Creating header with scale: ${assetScale}x`);

		// Add header elements
		this.createHeaderElements(scene, assetScale);
		
		// Set up event listeners for winnings updates
		this.setupWinningsEventListener();
	}

	private createHeaderElements(scene: Scene, assetScale: number): void {

		// Add logo – prefer Spine animation (logo_kobo), fall back to PNG if unavailable
		try {
			if (!ensureSpineFactory(scene, '[Header] createHeaderElements logo')) {
				console.warn('[Header] Spine factory unavailable. Skipping spine logo creation.');
				const logo = scene.add.image(
					scene.scale.width * 0.39 + this.logoOffsetX,
					scene.scale.height * 0.13 + this.logoOffsetY,
					'kobi-logo'
				).setOrigin(0.5, 0.5).setScale(assetScale * this.logoScaleMul).setDepth(1);
				this.headerContainer.add(logo);
			} else if (!(scene.cache.json as any).has('logo_kobo')) {
				console.warn('[Header] Spine json for logo_kobo not loaded. Falling back to PNG logo.');
				const logo = scene.add.image(
					scene.scale.width * 0.39 + this.logoOffsetX,
					scene.scale.height * 0.13 + this.logoOffsetY,
					'kobi-logo'
				).setOrigin(0.5, 0.5).setScale(assetScale * this.logoScaleMul).setDepth(1);
				this.headerContainer.add(logo);
			} else {
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
					// Copy idle animation selection from the other project
					const anySpine: any = logoSpine as any;
					const animations = anySpine?.skeleton?.data?.animations;
					if (animations && animations.length > 0) {
						const names = animations.map((a: any) => a.name || a);
						const idleName = names.includes('logo_idle_animation') ? 'logo_idle_animation' : names[0];
						logoSpine.animationState.setAnimation(0, idleName, true);
					}
				} catch {}
				this.headerContainer.add(logoSpine);
				this.logoSpine = logoSpine;
			}
		} catch (e) {
			console.warn('[Header] Failed to create spine logo, falling back to PNG:', e);
			const logo = scene.add.image(
				scene.scale.width * 0.39 + this.logoOffsetX,
				scene.scale.height * 0.13 + this.logoOffsetY,
				'kobi-logo'
			).setOrigin(0.5, 0.5).setScale(assetScale * this.logoScaleMul).setDepth(1);
			this.headerContainer.add(logo);
		}

		// Add Spine animated character (before win bar)
		this.createCharacterSpineAnimation(scene, assetScale);
		
		// Add Spine animated cat (before win bar)
		this.createCatSpineAnimation(scene, assetScale);

		// Add win bar last to ensure it appears on top
		const winBar = scene.add.image(
			scene.scale.width * 0.51,
			scene.scale.height * 0.315, // Positioned above the tent
			'win-bar'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(10); // Higher depth to appear above tent and kobi-ass
		this.headerContainer.add(winBar);

		// Add text inside the win bar
		this.createWinBarText(scene, scene.scale.width * 0.51, scene.scale.height * 0.315);
		
		
	}

	private createCharacterSpineAnimation(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[Header] createCharacterSpineAnimation')) {
				console.warn('[Header] Spine factory unavailable. Skipping character spine creation.');
				return;
			}
			const width = scene.scale.width;
			const height = scene.scale.height;

			// Create the Spine animation object
			const spineObject = scene.add.spine(width * 0.78, height * 0.175, "kobiass", "kobiass-atlas");
			spineObject.setOrigin(0.5, 0.5);
			spineObject.setScale(-0.13, 0.13); // Negative X scale to flip horizontally
			spineObject.setDepth(5); // Set explicit depth below win bar (10)
			spineObject.animationState.setAnimation(0, "idle", true);
			
			this.headerContainer.add(spineObject);

			console.log('[Header] Spine character animation created successfully');
		} catch (error) {
			console.error('[Header] Error creating Spine character animation:', error);
		}
	}

	private createCatSpineAnimation(scene: Scene, assetScale: number): void {
		try {
			if (!ensureSpineFactory(scene, '[Header] createCatSpineAnimation')) {
				console.warn('[Header] Spine factory unavailable. Skipping cat spine creation.');
				return;
			}
			const width = scene.scale.width;
			const height = scene.scale.height;

			// Create the cat Spine animation object
			const catSpineObject = scene.add.spine(width * 0.13, height * 0.26, "Cat_default", "Cat_default-atlas");
			catSpineObject.setOrigin(0.5, 0.5);
			catSpineObject.setScale(0.178);
			catSpineObject.setDepth(5); // Set explicit depth below win bar (10)
			catSpineObject.animationState.setAnimation(0, "cat_default_bg", true);
			
			this.headerContainer.add(catSpineObject);

			console.log('[Header] Spine cat animation created successfully');
		} catch (error) {
			console.error('[Header] Error creating Spine cat animation:', error);
		}
	}

	private createWinBarText(scene: Scene, x: number, y: number): void {
		// Line 1: "YOU WON"
		this.youWonText = scene.add.text(x, y - 7, 'YOU WIN', {
			fontSize: '16px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.headerContainer.add(this.youWonText);

		// Line 2: "$ 160.00" with bold formatting
		// Check if demo mode is active - if so, use blank currency symbol
		const sceneAny: any = scene;
		const isDemoInitial = sceneAny?.gameAPI?.getDemoState();
		const currencySymbolInitial = isDemoInitial ? '' : '$';
		const initialText = isDemoInitial ? '0.00' : `$ 0.00`;
		this.amountText = scene.add.text(x, y + 14, initialText, {
			fontSize: '20px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		}).setOrigin(0.5, 0.5).setDepth(11); // Higher depth than win bar
		this.headerContainer.add(this.amountText);
	}

	resize(scene: Scene): void {
		if (this.headerContainer) {
			this.headerContainer.setSize(scene.scale.width, scene.scale.height);
		}
		if (this.logoSpine) {
			// Match repositioning & scaling behaviour from the other project
			const s = this.networkManager.getAssetScale();
			this.logoSpine.x = scene.scale.width * 0.39 + this.logoOffsetX;
			this.logoSpine.y = scene.scale.height * 0.13 + this.logoOffsetY;
			this.logoSpine.setScale(s * this.logoScaleMul);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.headerContainer;
	}

	/**
	 * Set up event listener for winnings updates from backend
	 */
	private setupWinningsEventListener(): void {
		

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
		});

		// Listen for reel done events to show winnings display
		gameEventManager.on(GameEventType.REELS_STOP, (data: any) => {
			console.log(`[Header] REELS_STOP received - checking for wins`);
			
			// Get the current spin data from the Symbols component
			const symbolsComponent = (this.headerContainer.scene as any).symbols;
			if (symbolsComponent && symbolsComponent.currentSpinData) {
				const spinData = symbolsComponent.currentSpinData;
				console.log(`[Header] Found current spin data:`, spinData);
				
				if (spinData.slot && spinData.slot.paylines && spinData.slot.paylines.length > 0) {
					const totalWin = this.calculateTotalWinningsFromPaylines(spinData.slot.paylines);
					console.log(`[Header] Total winnings calculated from paylines: ${totalWin}`);
					
					if (totalWin > 0) {
						this.showWinningsDisplay(totalWin);
					} else {
						this.hideWinningsDisplay();
					}
				} else {
					console.log('[Header] No paylines in current spin data - hiding winnings display');
					this.hideWinningsDisplay();
				}
			} else {
				console.log('[Header] No current spin data available - hiding winnings display');
				this.hideWinningsDisplay();
			}
		});

		// Play logo win animation when scatter anticipation results in a bonus (free spins)
		// This is emitted by ScatterAnimationManager.showFreeSpinsDialog via GameEventType.IS_BONUS
		gameEventManager.on(GameEventType.IS_BONUS, (data: any) => {
			try {
				const bonusType = data?.bonusType;
				if (bonusType === 'freeSpins') {
					console.log('[Header] IS_BONUS (freeSpins) received – playing logo win animation');
					this.playLogoWin();
				}
			} catch (e) {
				console.warn('[Header] Failed handling IS_BONUS for logo animation', e);
			}
		});
	}

	/**
	 * Update the winnings display in the header
	 */
	public updateWinningsDisplay(winnings: number): void {
		if (this.amountText) {
			this.currentWinnings = winnings;
			const formattedWinnings = this.formatCurrency(winnings);
			this.amountText.setText(formattedWinnings);
			console.log(`[Header] Winnings updated to: ${formattedWinnings} (raw: ${winnings})`);
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
			// Revert logo to idle animation when hiding winnings (copied behaviour)
			this.playLogoIdle();
			
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
			
			// Show both texts
			this.youWonText.setVisible(true);
			this.amountText.setVisible(true);
			// Trigger logo win animation while winnings are visible (copied behaviour)
			this.playLogoWin();
			
			// Update amount text with winnings
			this.amountText.setText(formattedWinnings);
			
			console.log(`[Header] Winnings display shown: ${formattedWinnings} (raw: ${winnings})`);
		} else {
			console.warn('[Header] Cannot show winnings display - text objects not available', {
				amountText: !!this.amountText,
				youWonText: !!this.youWonText
			});
		}
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
		// Check if demo mode is active - if so, remove currency symbol
		const sceneAny: any = this.headerContainer?.scene;
		const isDemo = sceneAny?.gameAPI?.getDemoState();
		
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

	// --- Logo animation helpers copied from the other project ---

	// Play logo idle animation if available, otherwise keep current
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

	public setLogoOffset(x: number, y: number): void {
		this.logoOffsetX = x;
		this.logoOffsetY = y;
		if (this.logoSpine) {
			this.logoSpine.x = (this.logoSpine.scene.scale.width * 0.39) + this.logoOffsetX;
			this.logoSpine.y = (this.logoSpine.scene.scale.height * 0.13) + this.logoOffsetY;
		}
	}

	public setLogoScaleMultiplier(multiplier: number): void {
		this.logoScaleMul = multiplier;
		if (this.logoSpine) {
			const s = this.networkManager.getAssetScale();
			this.logoSpine.setScale(s * this.logoScaleMul);
		}
	}

	public getLogoConfig(): { offsetX: number; offsetY: number; scaleMultiplier: number } {
		return { offsetX: this.logoOffsetX, offsetY: this.logoOffsetY, scaleMultiplier: this.logoScaleMul };
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
