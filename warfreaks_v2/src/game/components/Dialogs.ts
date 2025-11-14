import { Scene } from 'phaser';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { IrisTransition } from './IrisTransition';
import { gameStateManager } from '../../managers/GameStateManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, playSpineAnimationSequence } from './SpineBehaviorHelper';

export interface DialogConfig {
	//type: 'confetti_KA' | 'Congrats_KA' | 'Explosion_AK' | 'FreeSpinDialog_KA' | 'largeW_KA' | 'LargeW_KA' | 'MediumW_KA' | 'SmallW_KA' | 'SuperW_KA';
	type: 'Congrats_KA' | 'Explosion_AK' | 'FreeSpinDialog' | 'BigWin' | 'MegaWin' | 'EpicWin' | 'SuperWin';
	position?: { x: number; y: number };
	scale?: number;
	duration?: number;
	onComplete?: () => void;
	winAmount?: number; // Amount to display in the dialog
	freeSpins?: number; // Number of free spins won
}

export class Dialogs {
	// Main dialog container that covers the entire screen
	private dialogOverlay: Phaser.GameObjects.Container;
	
	// Black background overlay
	private blackOverlay: Phaser.GameObjects.Graphics;
	
	// Effects container (confetti, explosion, paint)
	private effectsContainer: Phaser.GameObjects.Container;
	
	// Dialog content container (the actual dialog animations)
	private dialogContentContainer: Phaser.GameObjects.Container;
	
	// Continue text
	private continueText: Phaser.GameObjects.Text | null = null;
	
	// Number display container
	private numberDisplayContainer: Phaser.GameObjects.Container | null = null;
	
	// Click handler area
	private clickArea: Phaser.GameObjects.Rectangle | null = null;
	
	// Current dialog state
	private currentDialog: any = null; // Spine object type
	private isDialogActive: boolean = false;
	private currentDialogType: string | null = null;
	
	// Auto-close timer for win dialogs during autoplay
	private autoCloseTimer: Phaser.Time.TimerEvent | null = null;
	
	// Managers
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private currentScene: Scene | null = null;
	
	// Iris transition for scatter animation
	private irisTransition: IrisTransition | null = null;

	// Dialog configuration
	private dialogScales: Record<string, number> = {
		'Congrats_KA': 0.3,
		'Explosion_AK': 0.8,
		'FreeSpinDialog_KA': 0.7,
		'EpicWin': 0.9,
		'MegaWin': 0.9,
		'BigWin': 0.9,
		'SuperWin': 0.9,
		'Paint_KA': 0.41
	};

	// Dialog positions (relative: 0.0 = left/top, 0.5 = center, 1.0 = right/bottom)
	private dialogPositions: Record<string, { x: number; y: number }> = {
		'Congrats_KA': { x: 0.5, y: 0.5 },
		'Explosion_AK': { x: 0.5, y: 0.5 },
		'FreeSpinDialog_KA': { x: 0.5, y: 0.5 },
		'EpicWin': { x: 0.5, y: 0.5 },
		'MegaWin': { x: 0.5, y: 0.5 },
		'BigWin': { x: 0.5, y: 0.5 },
		'SuperWin': { x: 0.5, y: 0.5 },
		'Paint_KA': { x: 0.52, y: 0.72 }
	};

	private dialogLoops: Record<string, boolean> = {
		// Effects
		'Explosion_AK': true,
		'Paint_KA': false,
		// Dialog texts
		'Congrats_KA': true,
		'FreeSpinDialog_KA': true,
		'EpicWin': true,
		'MegaWin': true,
		'BigWin': true,
		'SuperWin': true
	};

	private winDialogAnimationNames: Record<string, string> = {
		'BigWin': 'big_WF',
		'MegaWin': 'mega_WF',
		'EpicWin': 'epic_WF',
		'SuperWin': 'super_WF'
	}

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	create(scene: Scene): void {
		// Store scene reference for later use
		this.currentScene = scene;
		
		// Initialize iris transition for scatter animation
		this.irisTransition = new IrisTransition(scene);
		
		// Create main dialog overlay container
		this.dialogOverlay = scene.add.container(0, 0);
		this.dialogOverlay.setDepth(1000); // Very high depth to cover everything
		this.dialogOverlay.setVisible(false); // Hidden by default
		
		// Create black overlay background first (lowest depth = behind everything)
		this.blackOverlay = scene.add.graphics();
		this.blackOverlay.fillStyle(0x000000, 0.7); // Black with 70% alpha
		this.blackOverlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		this.blackOverlay.setDepth(100); // Very low depth to be behind everything
		this.dialogOverlay.add(this.blackOverlay);
		
		// Create effects container (higher depth = in front of black overlay)
		this.effectsContainer = scene.add.container(0, 0);
		this.effectsContainer.setDepth(200); // Higher depth to be in front
		this.dialogOverlay.add(this.effectsContainer);
		
		// Create dialog content container (highest depth = in front of everything)
		this.dialogContentContainer = scene.add.container(0, 0);
		this.dialogContentContainer.setDepth(300); // Highest depth to be in front
		this.dialogOverlay.add(this.dialogContentContainer);
		
		console.log('[Dialogs] Dialog system created');
	}

	/**
	 * Show a dialog with the specified configuration
	 */
	public showDialog(scene: Scene, config: DialogConfig): void {
		if (this.isDialogActive) {
			this.hideDialog();
		}

		console.log(`[Dialogs] Showing dialog: ${config.type}`);
		
		// Track current dialog type for bonus mode detection
		this.currentDialogType = config.type;
		
		// Debug dialog type detection
		console.log(`[Dialogs] Dialog type: ${config.type}, isWinDialog(): ${this.isWinDialog()}`);
		
		// Ensure dialog overlay is visible and reset alpha for new dialog
		this.dialogOverlay.setVisible(true);
		this.dialogOverlay.setAlpha(1);
		this.isDialogActive = true;
		
		console.log(`[Dialogs] Dialog overlay set to visible: ${this.dialogOverlay.visible}, alpha: ${this.dialogOverlay.alpha}`);
		
		// Always ensure black overlay is properly set up for new dialog
		console.log('[Dialogs] Setting up black overlay for dialog type:', config.type);
		console.log('[Dialogs] Black overlay current state:', {
			visible: this.blackOverlay.visible,
			alpha: this.blackOverlay.alpha,
			exists: !!this.blackOverlay
		});
		
		// Handle black overlay based on dialog type
		if (!this.isWinDialog()) {
			console.log('[Dialogs] Non-win dialog detected - setting up black overlay');
			
			// Ensure black overlay is visible and reset to transparent for fade-in
			this.blackOverlay.setVisible(true);
			this.blackOverlay.setAlpha(0);
			console.log('[Dialogs] Non-win dialog - black overlay will fade in');
			console.log('[Dialogs] Black overlay reset to visible=true, alpha=0 for fade-in');
		
			// Fade in the black overlay
			scene.tweens.add({
				targets: this.blackOverlay,
				alpha: 1,
				duration: 500,
				ease: 'Power2',
				onComplete: () => {
					console.log('[Dialogs] Black overlay fade-in complete');
				}
			});
		} else {
			console.log('[Dialogs] Win dialog - setting black overlay to semi-transparent background');
			// For win dialogs, ensure black overlay is visible and set to semi-transparent background
			this.blackOverlay.setVisible(true);
			this.blackOverlay.setAlpha(0.7); // Semi-transparent background
		}
		
		// Log final black overlay state for debugging
		console.log('[Dialogs] Final black overlay state:', {
			visible: this.blackOverlay.visible,
			alpha: this.blackOverlay.alpha,
			exists: !!this.blackOverlay
		});
		
		// Create the dialog content
		this.createDialogContentWithCustomSpineName(scene, 'win_dialog', config);

		// if(this.currentDialog)
		// {
		// 	this.currentDialog.destroy();
		// 	this.currentDialog = null;
		// }

		// this.currentDialog = scene.add.spine(0, 0, 'win_dialog', 'win_dialog-atlas');
		// const scale = 0.8;
		// const offset = { x: 0, y: 0 };
		// const anchor = { x: 0.5, y: 0.1 };
		// const origin = { x: 0.5, y: 0 };
		// const sequence: number[] = this.winDialogAnimationSequences[config.type];
		// playSpineAnimationSequence(scene, this.currentDialog, sequence, {x:scale, y:scale}, anchor, origin, offset, 101);
		// this.dialogContentContainer.add(this.currentDialog);

        // Play dialog-specific SFX (FreeSpin/ Congrats) when shown
		try {
			const audioManager = (window as any).audioManager;
			if (audioManager && typeof audioManager.playSoundEffect === 'function') {
				const type = (this.currentDialogType || '').toLowerCase();
                if (type === 'freespindialog_ka') {
                    // Use congrats_ka for the FreeSpin dialog per request
                    audioManager.playSoundEffect('dialog_congrats');
                    // Duck background music similar to win dialogs
                    if (typeof audioManager.duckBackground === 'function') {
                        audioManager.duckBackground(0.3);
                    }
                } else if (type === 'congrats_ka') {
					audioManager.playSoundEffect('dialog_congrats');
                    if (typeof audioManager.duckBackground === 'function') {
                        audioManager.duckBackground(0.3);
                    }
				}
			}
		} catch {}
		
		// Play win dialog SFX if applicable
		try {
			if (this.isWinDialog()) {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.playWinDialogSfx === 'function') {
					audioManager.playWinDialogSfx(this.currentDialogType);
				}
				// Duck background music while win dialog is visible
				if (audioManager && typeof audioManager.duckBackground === 'function') {
					audioManager.duckBackground(0.3);
				}
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to play win dialog SFX:', e);
		}

		// Create effects based on dialog type (KA Effects)
		// this.createEffects(scene, config.type);
		
		// Fade in dialog content and effects
		if (this.currentDialog) {
			this.currentDialog.setAlpha(0);
			
			// Adjust timing based on dialog type
			const contentDelay = this.isWinDialog() ? 0 : 200; // No delay for win dialogs
			
			scene.tweens.add({
				targets: this.currentDialog,
				alpha: 1,
				duration: 800,
				ease: 'Power2',
				delay: contentDelay, // Start immediately for win dialogs
				onComplete: () => {
					console.log('[Dialogs] Dialog content fade-in complete');
				}
			});
		}
		
		// Fade in effects with slight delay
		this.effectsContainer.setAlpha(0);
		
		// Adjust timing based on dialog type
		const effectsDelay = this.isWinDialog() ? 200 : 400; // Shorter delay for win dialogs
		
		scene.tweens.add({
			targets: this.effectsContainer,
			alpha: 1,
			duration: 600,
			ease: 'Power2',
			delay: effectsDelay, // Shorter delay for win dialogs
			onComplete: () => {
				console.log('[Dialogs] Effects fade-in complete');
			}
		});
		
		// Create number display if win amount or free spins are provided (AFTER effects)
		if (config.winAmount !== undefined || config.freeSpins !== undefined) {
			// const randomValue = Math.random() * 1000000;
			// this.createNumberDisplay(scene, randomValue, config.freeSpins);
			this.createNumberDisplay(scene, config.winAmount || 0, config.freeSpins);
		}
		
		// Create continue text (delayed)
		this.createContinueText(scene);
		
		// Create click handler
		this.createClickHandler(scene);
		
		// Set up auto-close timer for win dialogs during autoplay
		this.setupAutoCloseTimer(scene);
	}

	/**
	 * Create the main dialog content (FreeSpinDialog_KA, LargeW_KA, etc.)
	 */
	private createDialogContent(scene: Scene, config: DialogConfig): void {
		// Clean up existing dialog
		if (this.currentDialog) {
			this.currentDialog.destroy();
			this.currentDialog = null;
		}

		const position = config.position || this.getDialogPosition(config.type, scene);
		const scale = config.scale || this.getDialogScale(config.type);
		
		// Create Spine animation for the dialog
		try {
			console.log(`[Dialogs] Creating Spine animation for dialog: ${config.type}`);
			console.log(`[Dialogs] Using atlas: ${config.type}-atlas`);
			this.currentDialog = scene.add.spine(
				position.x,
				position.y,
				config.type,
				`${config.type}-atlas`
			);
			this.currentDialog.setOrigin(0.5, 0.5);
			
			// Play intro animation first, then loop idle based on configuration (fallback to idle if intro missing)
			const shouldLoop = this.getDialogLoop(config.type);
			try {
				console.log(`[Dialogs] Playing intro animation: ${config.type}_win`);
				this.currentDialog.animationState.setAnimation(0, `${config.type}_win`, false);
				this.currentDialog.animationState.addAnimation(0, `${config.type}_idle`, shouldLoop, 0);
			} catch (error) {
				console.log(`[Dialogs] Intro animation failed, falling back to idle: ${config.type}_idle`);
				// Fallback to idle animation if intro is missing
				this.currentDialog.animationState.setAnimation(0, `${config.type}_idle`, shouldLoop);
			}
		} catch (error) {
			console.error(`[Dialogs] Error creating dialog content: ${config.type}`, error);
			console.error(`[Dialogs] This might be due to missing assets for ${config.type}`);
			return;
		}
		
		this.currentDialog.setScale(scale);
		this.currentDialog.setDepth(101);
		
		// Add to dialog content container
		this.dialogContentContainer.add(this.currentDialog);
		
		console.log(`[Dialogs] Created dialog content: ${config.type}`);
	}

	private createDialogContentWithCustomSpineName(scene: Scene, spineName: string, config: DialogConfig): void {
		// Clean up existing dialog
		if (this.currentDialog) {
			this.currentDialog.destroy();
			this.currentDialog = null;
		}

		const position = config.position || this.getDialogPosition(config.type, scene);
		const scale = config.scale || this.getDialogScale(config.type);
		
		// Create Spine animation for the dialog
		try {
			console.log(`[Dialogs] Creating Spine animation for dialog: ${config.type}`);
			console.log(`[Dialogs] Using atlas: ${config.type}-atlas`);
			this.currentDialog = scene.add.spine(
				position.x,
				position.y,
				spineName,
				`${spineName}-atlas`
			);
			this.currentDialog.setOrigin(0.5, 0.5);
			
			// Play intro animation first, then loop idle based on configuration (fallback to idle if intro missing)
			const shouldLoop = this.getDialogLoop(config.type);
			const rootAnimName = this.winDialogAnimationNames[config.type];
			try {
				console.log(`[Dialogs] Playing intro animation: ${rootAnimName ? rootAnimName : config.type}_win`);
				this.currentDialog.animationState.setAnimation(0, `${rootAnimName ? rootAnimName : config.type}_win`, false);
				this.currentDialog.animationState.addAnimation(0, `${rootAnimName ? rootAnimName : config.type}_idle`, shouldLoop, 0);
			} catch (error) {
				console.log(`[Dialogs] Intro animation failed, falling back to idle: ${rootAnimName ? rootAnimName : config.type}_idle`);
				// Fallback to idle animation if intro is missing
				this.currentDialog.animationState.setAnimation(0, `${rootAnimName ? rootAnimName : config.type}_idle`, shouldLoop);
			}
		} catch (error) {
			console.error(`[Dialogs] Error creating dialog content: ${config.type}`, error);
			console.error(`[Dialogs] This might be due to missing assets for ${config.type}`);
			return;
		}
		
		this.currentDialog.setScale(scale);
		this.currentDialog.setDepth(101);
		
		// Add to dialog content container
		this.dialogContentContainer.add(this.currentDialog);
		
		console.log(`[Dialogs] Created dialog content: ${config.type}`);

	}
	/**
	 * Set up auto-close timer for win dialogs during autoplay or when scatter is hit
	 */
	private setupAutoCloseTimer(scene: Scene): void {
		// Clear any existing timer
		if (this.autoCloseTimer) {
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
		}
		
		// Set up auto-close for win dialogs during autoplay OR when scatter is hit
		console.log('[Dialogs] Auto-close timer setup check:', {
			isWinDialog: this.isWinDialog(),
			isAutoPlaying: gameStateManager.isAutoPlaying,
			isScatter: gameStateManager.isScatter,
			currentDialogType: this.currentDialogType
		});
		
		const shouldAutoClose = this.isWinDialog() && (gameStateManager.isAutoPlaying || gameStateManager.isScatter);
		
		if (shouldAutoClose) {
			const reason = gameStateManager.isAutoPlaying ? 'autoplay' : 'scatter hit';
			console.log(`[Dialogs] Setting up auto-close timer for win dialog during ${reason} (2 seconds)`);
			console.log(`[Dialogs] Win dialog will automatically close in 2 seconds due to ${reason}`);
			
			this.autoCloseTimer = scene.time.delayedCall(2500, () => {
				console.log(`[Dialogs] Auto-close timer triggered for win dialog during ${reason} - closing dialog`);
				this.handleDialogClick(scene);
			});
		} else {
			console.log('[Dialogs] No auto-close timer needed:', {
				isWinDialog: this.isWinDialog(),
				isAutoPlaying: gameStateManager.isAutoPlaying,
				isScatter: gameStateManager.isScatter
			});
		}
	}

	/**
	 * Create effects (confetti, explosion, paint)
	 */
	private createEffects(scene: Scene, dialogType: string): void {
		// Clear existing effects
		this.effectsContainer.removeAll();
		
		// Always create all three effects for all dialogs
		this.createConfettiEffect(scene);
		this.createExplosionEffect(scene);
		this.createPaintEffect(scene);
	}

	/**
	 * Create confetti effect
	 */
	private createConfettiEffect(scene: Scene): void {
		try {
			// Get position and scale from dialog configuration
			const position = this.getDialogPosition('confetti_KA', scene);
			const scale = this.getDialogScale('confetti_KA');
			
			const confetti = scene.add.spine(
				position.x,
				position.y,
				'confetti_KA',
				'confetti_KA-atlas'
			);
			confetti.setOrigin(0.5, 0.5);
			confetti.setScale(scale);
			
					// Play intro animation first, then loop idle based on configuration (fallback to idle if intro missing)
		const shouldLoop = this.getDialogLoop('confetti_KA');
		try {
			confetti.animationState.setAnimation(0, 'confetti_KA_win', false);
			confetti.animationState.addAnimation(0, 'confetti_KA_idle', shouldLoop, 0);
		} catch (error) {
			// Fallback to idle animation if intro is missing
			confetti.animationState.setAnimation(0, 'confetti_KA_idle', shouldLoop);
		}
			
			confetti.setDepth(102);
			this.effectsContainer.add(confetti);
			console.log(`[Dialogs] Created confetti effect at (${position.x}, ${position.y}) with scale: ${scale}`);
		} catch (error) {
			console.error('[Dialogs] Error creating confetti effect:', error);
		}
	}

	/**
	 * Create explosion effect
	 */
	private createExplosionEffect(scene: Scene): void {
		try {
			// Get position and scale from dialog configuration
			const position = this.getDialogPosition('Explosion_AK', scene);
			const scale = this.getDialogScale('Explosion_AK');
			
			const explosion = scene.add.spine(
				position.x,
				position.y,
				'Explosion_AK',
				'Explosion_AK-atlas'
			);
			explosion.setOrigin(0.5, 0.5);
			explosion.setScale(scale);
			
					// Play intro animation first, then loop idle based on configuration (fallback to idle if intro missing)
		const shouldLoop = this.getDialogLoop('Explosion_AK');
		try {
			explosion.animationState.setAnimation(0, 'Explosion_AK_win', false);
			explosion.animationState.addAnimation(0, 'Explosion_AK_idle', shouldLoop, 0);
		} catch (error) {
			// Fallback to idle animation if intro is missing
			explosion.animationState.setAnimation(0, 'Explosion_AK_idle', shouldLoop);
		}
			
			explosion.setDepth(102);
			this.effectsContainer.add(explosion);
			console.log(`[Dialogs] Created explosion effect at (${position.x}, ${position.y}) with scale: ${scale}`);
		} catch (error) {
			console.error('[Dialogs] Error creating explosion effect:', error);
		}
	}

	/**
	 * Create paint effect
	 */
	private createPaintEffect(scene: Scene): void {
		try {
			// Get position and scale from dialog configuration
			const position = this.getDialogPosition('Paint_KA', scene);
			const scale = this.getDialogScale('Paint_KA');
			
			const paint = scene.add.spine(
				position.x,
				position.y,
				'Paint_KA',
				'Paint_KA-atlas'
			);
			paint.setOrigin(0.5, 0.5);
			paint.setScale(scale);
			
					// Play intro animation first, then loop idle based on configuration (fallback to idle if intro missing)
		const shouldLoop = this.getDialogLoop('Paint_KA');
		try {
			// Play intro animation first, then loop idle based on configuration
			const introAnimation = paint.animationState.setAnimation(0, 'Paint_KA_win', false);
			paint.animationState.addAnimation(0, 'Paint_KA_idle', shouldLoop, 0);
			
			console.log('[Dialogs] Paint intro animation started');
			
			// Simple approach: fade in number display after paint intro animation
			// Most paint intro animations are around 1-2 seconds
			const introDuration = 1500; // 1.5 seconds
			
			scene.time.delayedCall(introDuration, () => {
				console.log('[Dialogs] Paint intro animation complete, fading in number display');
				this.fadeInNumberDisplay(scene);
			});
			
		} catch (error) {
			console.log('[Dialogs] Paint intro animation failed, falling back to idle:', error);
			// Fallback to idle animation if intro is missing
			paint.animationState.setAnimation(0, 'Paint_KA_idle', shouldLoop);
			// If intro animation is missing, trigger number display fade-in after a short delay
			scene.time.delayedCall(500, () => {
				console.log('[Dialogs] Fallback: triggering number display fade-in after 0.5 seconds');
				this.fadeInNumberDisplay(scene);
			});
		}
			
			paint.setDepth(102);
			this.effectsContainer.add(paint);
			console.log(`[Dialogs] Paint effect added to effectsContainer, container children count:`, this.effectsContainer.length);
		} catch (error) {
			console.error('[Dialogs] Error creating paint effect:', error);
		}
	}

	/**
	 * Create the "Press anywhere to continue" text
	 */
	private createContinueText(scene: Scene): void {
		console.log('[Dialogs] Creating continue text for dialog type:', this.currentDialogType);
		
		// Clean up existing text
		if (this.continueText) {
			this.continueText.destroy();
			this.continueText = null;
		}
		
		// Create the text with your original styling
		this.continueText = scene.add.text(
			scene.scale.width / 2,
			scene.scale.height / 2 + 300,
			'Press anywhere to continue',
			{
				fontFamily: 'Poppins-Bold',
				fontSize: '20px',
				color: '#FFFFFF',
				stroke: '#379557',
				strokeThickness: 5,
				shadow: {
					offsetX: 2,
					offsetY: 2,
					color: '#000000',
					blur: 4,
					fill: true
				}
			}
		);
		
		this.continueText.setOrigin(0.5, 0.5);
		this.continueText.setDepth(104);
		this.continueText.setAlpha(0); // Start invisible
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.continueText);
		
		// Fade in the text after 1 seconds (reduced from 4.5 seconds)
		scene.tweens.add({
			targets: this.continueText,
			alpha: 1,
			duration: 500,
			delay: 1000,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Dialogs] Continue text fade-in complete');
			}
		});
		
		console.log('[Dialogs] Created continue text with original styling');
	}

	/**
	 * Create number display for win amounts
	 */
	private createNumberDisplay(scene: Scene, winAmount: number, freeSpins?: number): void {
		// Clean up existing number display
		if (this.numberDisplayContainer) {
			this.numberDisplayContainer.destroy();
			this.numberDisplayContainer = null;
		}
		
		// Create number display configuration
		const numberConfig: NumberDisplayConfig = {
			x: scene.scale.width / 2,
			y: scene.scale.height / 2 + 110,
			scale: 0.1,
			spacing: 8,
			alignment: 'center',
			decimalPlaces: freeSpins !== undefined ? 0 : 2, // No decimals for free spins
			showCommas: freeSpins !== undefined ? false : true, // No commas for free spins
			prefix: '', // No prefix for any number display
			suffix: '', // No suffix - only display numbers
			commaYOffset: 18,
			dotYOffset: 18
		};

		// Create the number display
		const numberDisplay = new NumberDisplay(this.networkManager, this.screenModeManager, numberConfig);
		numberDisplay.create(scene);
		// Display free spins if provided, otherwise display win amount
		const displayValue = freeSpins !== undefined ? freeSpins : winAmount;
		numberDisplay.displayValue(displayValue);
		
		// Create container for number displays
		this.numberDisplayContainer = scene.add.container(0, 0);
		this.numberDisplayContainer.setDepth(103);
		this.numberDisplayContainer.add(numberDisplay.getContainer());
		
		// Start with alpha 0 (invisible) - will be faded in after paint effect
		this.numberDisplayContainer.setAlpha(1);
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.numberDisplayContainer);
		
		console.log('[Dialogs] Created number display');
	}
	
	/**
	 * Fade in the number display with animation
	 */
	private fadeInNumberDisplay(scene: Scene): void {
		console.log('[Dialogs] fadeInNumberDisplay called');
		
		if (this.numberDisplayContainer) {
			console.log('[Dialogs] Fading in number display');
			
			// Fade in over 2 seconds (as set by user)
			scene.tweens.add({
				targets: this.numberDisplayContainer,
				alpha: 1,
				duration: 4500,
				ease: 'Power2',
				onComplete: () => {
					console.log('[Dialogs] Number display fade-in complete');
				}
			});
			
			console.log('[Dialogs] Fade-in tween added');
		} else {
			console.error('[Dialogs] numberDisplayContainer is null, cannot fade in');
		}
	}

	/**
	 * Handle dialog click event
	 */
	private handleDialogClick(scene: Scene): void {
		console.log('[Dialogs] Dialog clicked, starting fade-out sequence');
		
		// Clear auto-close timer if it exists (prevents double-triggering)
		if (this.autoCloseTimer) {
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
			console.log('[Dialogs] Auto-close timer cleared due to manual click');
		}
		
		// Start the fade-out sequence first (while isDialogActive is still true)
		this.startFadeOutSequence(scene);
		
		// Apply the same reset logic that happens when a new spin is triggered
		this.resetGameStateForNewSpin(scene);
		
		// Note: WIN_DIALOG_CLOSED event will be emitted when fade-out completes
		// This prevents double emission of the event
	}

	/**
	 * Immediately disable all win dialog elements when clicked
	 */
	private disableAllWinDialogElements(): void {
		console.log('[Dialogs] Disabling all win dialog elements immediately');
		
		// Disable click area to prevent multiple clicks
		if (this.clickArea) {
			this.clickArea.disableInteractive();
			console.log('[Dialogs] Click area disabled');
		}
		
		// Hide black overlay immediately
		if (this.blackOverlay) {
			this.blackOverlay.setVisible(false);
			this.blackOverlay.setAlpha(0);
			console.log('[Dialogs] Black overlay hidden and alpha set to 0');
		}
		
		// Hide current dialog immediately
		if (this.currentDialog) {
			this.currentDialog.setVisible(false);
			this.currentDialog.setAlpha(0);
			console.log('[Dialogs] Current dialog hidden and alpha set to 0');
			
			// Stop Spine animation if it exists
			if (this.currentDialog.animationState) {
				this.currentDialog.animationState.clearTracks();
				console.log('[Dialogs] Current dialog Spine animation cleared');
			}
		}
		
		// Stop all effect animations immediately
		this.stopAllEffectAnimations();
		console.log('[Dialogs] All effect animations stopped');
		
		// Hide all effects immediately
		this.hideAllEffects();
		console.log('[Dialogs] All effects hidden');
		
		// Hide continue text immediately
		if (this.continueText) {
			this.continueText.setVisible(false);
			console.log('[Dialogs] Continue text hidden');
		}
		
		// Hide number display immediately
		if (this.numberDisplayContainer) {
			this.numberDisplayContainer.setVisible(false);
			console.log('[Dialogs] Number display hidden');
		}
		
		// Hide the entire dialog overlay container
		if (this.dialogOverlay) {
			this.dialogOverlay.setVisible(false);
			this.dialogOverlay.setAlpha(0);
			console.log('[Dialogs] Dialog overlay container hidden and alpha set to 0');
		}
		
		// Set dialog as inactive immediately
		this.isDialogActive = false;
		console.log('[Dialogs] Dialog marked as inactive');
		
		console.log('[Dialogs] All win dialog elements disabled successfully');
	}

	/**
	 * Reset game state for new spin (same logic as when spin is triggered)
	 */
	private resetGameStateForNewSpin(scene: Scene): void {
		console.log('[Dialogs] Resetting game state for new spin (manual dialog close)');
		
		// Get the Game scene to access its methods
		const gameScene = scene as any; // Cast to access Game scene methods
		
		// Clear win queue if the method exists
		if (gameScene.clearWinQueue && typeof gameScene.clearWinQueue === 'function') {
			gameScene.clearWinQueue();
			console.log('[Dialogs] Cleared win queue for manual dialog close');
		}
		
		// Reset win dialog state
		gameStateManager.isShowingWinDialog = false;
		console.log('[Dialogs] Reset isShowingWinDialog to false for manual dialog close');
		
		// Reset winlines tracking if the property exists
		if (gameScene.hasWinlinesThisSpin !== undefined) {
			gameScene.hasWinlinesThisSpin = false;
			console.log('[Dialogs] Reset hasWinlinesThisSpin to false for manual dialog close');
		}
		
		
		
		// NOTE: Do NOT call ensureCleanSymbolState() here as it immediately clears winning symbols
		// The winning symbols should remain visible until the next spin starts
		// The actual symbol reset will happen when the next spin is triggered
		console.log('[Dialogs] Preserving winning symbols visibility until next spin starts');
		
		console.log('[Dialogs] Game state reset complete for manual dialog close');
	}

	/**
	 * Create the click handler for the dialog
	 */
	private createClickHandler(scene: Scene): void {
		// Create a clickable area that covers the entire dialog
		this.clickArea = scene.add.rectangle(
			scene.cameras.main.centerX,
			scene.cameras.main.centerY,
			scene.cameras.main.width,
			scene.cameras.main.height,
			0x000000,
			0
		);
		
		this.clickArea.setOrigin(0.5);
		this.clickArea.setDepth(105);
		this.clickArea.setInteractive();
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.clickArea);
		
		// For win dialogs, enable clicking after continue text appears (1.5s delay)
		// For free spin dialogs, delay clicking to allow animations to complete
		if (this.isWinDialog()) {
			console.log('[Dialogs] Win dialog - enabling clicking after 1.5s delay for continue text visibility');
			// Delay to ensure continue text appears before allowing clicks
			scene.time.delayedCall(1000, () => {
				if (this.clickArea) {
					this.clickArea.on('pointerdown', () => {
						this.handleDialogClick(scene);
						this.clickArea?.disableInteractive();
					});
					console.log('[Dialogs] Click handler enabled for win dialog');
				}
			});
		} else {
			console.log('[Dialogs] Free spin dialog - delaying click enablement for 2.2 seconds');
			// Delay for free spin dialogs to allow animations to complete
		scene.time.delayedCall(2200, () => {
				if (this.clickArea) {
					this.clickArea.on('pointerdown', () => {
						console.log('[Dialogs] Free spin dialog clicked!');
						this.handleDialogClick(scene);
						this.clickArea?.disableInteractive();
					});
					console.log('[Dialogs] Click handler enabled for free spin dialog');
				}
			});
		}
		
		console.log('[Dialogs] Click handler created for dialog');
	}

	/**
	 * Stop all effect animations without hiding them (for fade-out)
	 */
	private stopAllEffectAnimations(): void {
		console.log('[Dialogs] Stopping all effect animations');
		
		// Stop all Spine animations in the effects container
		this.effectsContainer.getAll().forEach((effect: any) => {
			if (effect.animationState) {
				try {
					effect.animationState.clearTracks();
					// Don't hide effects immediately - let them fade out naturally
					// effect.setVisible(false);
					console.log('[Dialogs] Stopped effect animation:', effect.texture?.key || 'unknown');
				} catch (error) {
					console.warn('[Dialogs] Error stopping effect animation:', error);
				}
			}
		});
	}

	/**
	 * Hide all effects after fade-out completes
	 */
	private hideAllEffects(): void {
		console.log('[Dialogs] Hiding all effects after fade-out');
		
		// Hide all effects in the effects container
		this.effectsContainer.getAll().forEach((effect: any) => {
			if (effect && typeof effect.setVisible === 'function') {
				effect.setVisible(false);
				console.log('[Dialogs] Hidden effect:', effect.texture?.key || 'unknown');
			}
		});
	}

	/**
	 * Start the centralized transition when dialog is clicked
	 */
	private startFadeOutSequence(scene: Scene): void {
		console.log('[Dialogs] startFadeOutSequence called, isDialogActive:', this.isDialogActive, 'currentDialogType:', this.currentDialogType);
		
		if (!this.isDialogActive) {
			console.log('[Dialogs] Dialog not active, skipping fade-out sequence');
			return;
		}
		
		// Check if this is a win dialog - handle differently than free spin dialog
		if (this.isWinDialog()) {
			console.log('[Dialogs] Win dialog clicked - starting direct fade-out sequence');
			// Disable dialog elements for win dialogs
			// this.disableAllWinDialogElements();
			this.startWinDialogFadeOut(scene);
			return;
		}
		
		// Check if this is a free spin dialog - use iris transition
		if (this.currentDialogType === 'FreeSpinDialog_KA') {
			console.log('[Dialogs] Free spin dialog clicked - starting iris transition');
			// Don't disable dialog elements yet for free spin dialogs - let iris transition handle it
			this.startIrisTransition(scene);
			return;
		}
		
		// Use normal transition for other dialogs
		console.log('[Dialogs] Other dialog type - starting normal transition');
		// Disable dialog elements for other dialogs
		this.disableAllWinDialogElements();
		this.startNormalTransition(scene);
	}

	/**
	 * Check if the current dialog is a win dialog
	 */
	private isWinDialog(): boolean {
		return this.currentDialogType === 'BigWin' || 
			   this.currentDialogType === 'MegaWin' || 
			   this.currentDialogType === 'EpicWin' || 
			   this.currentDialogType === 'SuperWin';
	}
	
	/**
	 * Start iris transition for free spin dialog
	 */
	private startIrisTransition(scene: Scene): void {
		if (!this.irisTransition) {
			console.warn('[Dialogs] Iris transition not available, falling back to normal transition');
			this.startNormalTransition(scene);
			return;
		}
		
		console.log('[Dialogs] Starting iris transition for free spin dialog');
		
		// Store the dialog type before cleanup for bonus mode check
		const dialogTypeBeforeCleanup = this.currentDialogType;
		
		// Stop all effect animations immediately
		this.stopAllEffectAnimations();
		
		// Disable spinner immediately when iris transition starts
		scene.events.emit('disableSpinner');
		console.log('[Dialogs] Spinner disabled during iris transition');
		
		// Show iris transition overlay
		this.irisTransition.show();
		
		// Start iris transition - zoom in to small radius (closing iris effect)
		this.irisTransition.zoomInToRadius(28, 1500); // Fast transition to 28px radius
		
		// Hide dialog content quickly after iris starts closing (200ms delay)
		scene.time.delayedCall(200, () => {
			console.log('[Dialogs] Hiding dialog content quickly for better iris visibility');
			// Fade out FreeSpin dialog SFX if playing
			try {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.fadeOutSfx === 'function') {
					audioManager.fadeOutSfx('dialog_congrats', 400);
				}
			} catch {}
			// Disable dialog elements before cleanup
			this.disableAllWinDialogElements();
			this.cleanupDialog();
		});
		
		// Wait for iris transition to complete, then proceed
		scene.time.delayedCall(1500, () => {
			console.log('[Dialogs] Iris closed - triggering bonus mode');
			
			// Trigger bonus mode during closed iris
			console.log('[Dialogs] Triggering bonus mode during closed iris');
			this.triggerBonusMode(scene);
			
			// Wait 0.5 seconds, then open iris (zoom out) - faster for better flow
			scene.time.delayedCall(500, () => {
				console.log('[Dialogs] Opening iris transition');
				this.irisTransition!.zoomInToRadius(1000, 1500); // Open iris to full size
				
				// Clean up after iris opens
				scene.time.delayedCall(1500, () => {
					console.log('[Dialogs] Iris transition complete');
					// Hide the iris transition overlay
					this.irisTransition!.hide();
					
					// Emit dialog animations complete event AFTER the full iris transition completes
					scene.events.emit('dialogAnimationsComplete');
					console.log('[Dialogs] Dialog animations complete event emitted after full iris transition');
					// Restore background music volume after dialog completes
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				});
			});
		});
	}
	
	/**
	 * Start normal black screen transition for non-free spin dialogs
	 */
	private startNormalTransition(scene: Scene): void {
		console.log('[Dialogs] Starting normal black screen transition');
		
		
		// Store the dialog type before cleanup for bonus mode check
		const dialogTypeBeforeCleanup = this.currentDialogType;
		
		// Stop all effect animations immediately
		this.stopAllEffectAnimations();
		
		// Create centralized black screen overlay
		const blackScreen = scene.add.graphics();
		blackScreen.setDepth(10000); // Very high depth to cover everything
		blackScreen.fillStyle(0x000000, 1);
		blackScreen.fillRect(0, 0, scene.scale.width, scene.scale.height);
		blackScreen.setAlpha(0); // Start transparent
		
		// Disable spinner immediately when black screen starts fading in
		scene.events.emit('disableSpinner');
		console.log('[Dialogs] Spinner disabled during transition');
		
		// Fade in black screen
		scene.tweens.add({
			targets: blackScreen,
			alpha: 1,
			duration: 300,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Dialogs] Black screen fade-in complete');
				
				// Hide dialog immediately while screen is black
				this.cleanupDialog();

				// Check if we need to trigger bonus mode while screen is black
				if (dialogTypeBeforeCleanup === 'FreeSpinDialog_KA') {
					console.log('[Dialogs] Triggering bonus mode during black screen');
					this.triggerBonusMode(scene);
				} else {
					// If congrats closed while in bonus mode, revert to base visuals and reset symbols
					if (dialogTypeBeforeCleanup === 'Congrats_KA') {
						console.log('[Dialogs] Congrats dialog closed - reverting from bonus visuals to base');
						// Switch off bonus mode visuals and music
						scene.events.emit('setBonusMode', false);
						scene.events.emit('hideBonusBackground');
						scene.events.emit('hideBonusHeader');
						// Reset symbols/winlines state for base game
						scene.events.emit('resetSymbolsForBase');

						// Ensure win sequence finalization when starting normal transition
					try {
						gameEventManager.emit(GameEventType.WIN_STOP);
						console.log('[Dialogs] Emitted WIN_STOP at start of normal transition');
					} catch {}

					}
					// Re-enable symbols after transition completes (normal flow)
					scene.events.emit('enableSymbols');
					console.log('[Dialogs] Symbols re-enabled after transition');
				}
				
					// Emit dialog animations complete event for scatter bonus reset
					scene.events.emit('dialogAnimationsComplete');
				console.log('[Dialogs] Dialog animations complete event emitted');
					// Restore background music volume after dialog completes
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				
				// Wait 0.7 seconds, then fade out
				scene.time.delayedCall(700, () => {
					scene.tweens.add({
						targets: blackScreen,
						alpha: 0,
						duration: 300,
						ease: 'Power2',
						onComplete: () => {
							// Clean up black screen
							blackScreen.destroy();
							
							// Ensure UI is back to normal only when congrats dialog closes
							if (dialogTypeBeforeCleanup === 'Congrats_KA') {
								console.log('[Dialogs] Black screen faded out after congrats - restoring normal background and header');
								scene.events.emit('hideBonusBackground');
								scene.events.emit('hideBonusHeader');
							}
							
							console.log('[Dialogs] Black screen transition complete');
						}
					});
				});
			}
		});
	}

	/**
	 * Start direct fade-out sequence for win dialogs (no black overlay)
	 */
	private startWinDialogFadeOut(scene: Scene): void {
		console.log('[Dialogs] Starting win dialog direct fade-out');

		// Fade out any currently playing win SFX
		try {
			const audioManager = (window as any).audioManager;
			if (audioManager && typeof audioManager.fadeOutCurrentWinSfx === 'function') {
				audioManager.fadeOutCurrentWinSfx(450);
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to fade out win dialog SFX:', e);
		}
		
		// Keep the black overlay visible as background - don't hide it
		// The black overlay provides the dialog background for readability
		console.log('[Dialogs] Keeping black overlay visible as background for win dialog fade-out');
		
		// Don't stop effect animations yet - let them fade out naturally
		// this.stopAllEffectAnimations();
		
		// Re-enable symbols immediately for win dialays
		scene.events.emit('enableSymbols');
		console.log('[Dialogs] Symbols re-enabled for win dialog');
		
		// Collect all elements that need to fade out
		const fadeOutTargets: any[] = [];
		
		// Don't fade out the dialog overlay container - only fade out its contents
		// This prevents conflicts between container and child element fade-outs
		
		// Add black overlay if visible
		if (this.blackOverlay && this.blackOverlay.visible) {
			fadeOutTargets.push(this.blackOverlay);
			console.log('[Dialogs] Adding black overlay to fade-out targets');
		}
		
		// Add current dialog if it exists
		if (this.currentDialog) {
			// Don't add Spine animation to main fade-out targets - we'll control it manually
			// fadeOutTargets.push(this.currentDialog);
			console.log('[Dialogs] Current dialog found - will be controlled manually during fade-out');
			
			// Debug Spine animation properties
			if (this.currentDialog.animationState) {
				console.log('[Dialogs] Current dialog is Spine animation');
				console.log('[Dialogs] Current dialog alpha before fade-out:', this.currentDialog.alpha);
				console.log('[Dialogs] Current dialog visible:', this.currentDialog.visible);
				console.log('[Dialogs] Current dialog active animations:', this.currentDialog.animationState.getCurrent(0)?.animation?.name);
				console.log('[Dialogs] Current dialog type:', typeof this.currentDialog);
				console.log('[Dialogs] Current dialog has alpha property:', 'alpha' in this.currentDialog);
				console.log('[Dialogs] Current dialog alpha property type:', typeof this.currentDialog.alpha);
			}
		}
		
		// Add effects container if it has elements
		if (this.effectsContainer && this.effectsContainer.length > 0) {
			fadeOutTargets.push(this.effectsContainer);
			console.log('[Dialogs] Adding effects container to fade-out targets');
		}
		
		// Add number display if it exists
		if (this.numberDisplayContainer) {
			fadeOutTargets.push(this.numberDisplayContainer);
			console.log('[Dialogs] Adding number display to fade-out targets');
		}
		
		// Add continue text if it exists
		if (this.continueText) {
			fadeOutTargets.push(this.continueText);
			console.log('[Dialogs] Adding continue text to fade-out targets');
		}
		
		console.log(`[Dialogs] Total fade-out targets: ${fadeOutTargets.length}`);

		const delay = 100;
		const duration = 500;
		
		// Fade out all elements together
		scene.tweens.add({
			targets: fadeOutTargets,
			alpha: 0,
			duration: duration,
			ease: 'Power2',
			delay: delay,
			onStart: () => {
				console.log('[Dialogs] Win dialog fade-out animation started');
				console.log('[Dialogs] Fade-out targets:', fadeOutTargets);
				
				// Log the current alpha values of all targets
				fadeOutTargets.forEach((target, index) => {
					if (target && typeof target.alpha === 'number') {
						console.log(`[Dialogs] Target ${index} alpha before fade-out:`, target.alpha);
					}
				});
				
				// Specifically check the Spine animation
				if (this.currentDialog && this.currentDialog.animationState) {
					console.log('[Dialogs] Spine animation alpha at fade-out start:', this.currentDialog.alpha);
					console.log('[Dialogs] Spine animation visible at fade-out start:', this.currentDialog.visible);
				}
			},
			onUpdate: (tween) => {
				// Log progress every 100ms
				const progress = Math.floor(tween.progress * 100);
				if (progress % 20 === 0) { // Log every 20%
					console.log(`[Dialogs] Fade-out progress: ${progress}%`);
					
					// Check Spine animation during fade-out
					if (this.currentDialog && this.currentDialog.animationState) {
						console.log(`[Dialogs] Spine animation alpha at ${progress}%:`, this.currentDialog.alpha);
					}
				}
				
				// Manually control Spine animation alpha during fade-out
				if (this.currentDialog && this.currentDialog.animationState) {
					const targetAlpha = 1 - tween.progress; // Calculate target alpha based on progress
					this.currentDialog.setAlpha(targetAlpha);
					console.log(`[Dialogs] Manual Spine alpha update: ${targetAlpha.toFixed(2)}`);
				}
			},
			onComplete: () => {
				console.log('[Dialogs] Win dialog fade-out complete');
				
				// Log final alpha values
				fadeOutTargets.forEach((target, index) => {
					if (target && typeof target.alpha === 'number') {
						console.log(`[Dialogs] Target ${index} alpha after fade-out:`, target.alpha);
					}
				});
				
				// Check Spine animation after fade-out
				if (this.currentDialog && this.currentDialog.animationState) {
					console.log('[Dialogs] Spine animation alpha after fade-out:', this.currentDialog.alpha);
					console.log('[Dialogs] Spine animation visible after fade-out:', this.currentDialog.visible);
				}
				
				// Wait a moment to ensure fade-out is completely visible before cleanup
				scene.time.delayedCall(100, () => {
					console.log('[Dialogs] Starting cleanup after fade-out completion');
					
					// Now stop effect animations after fade-out completes
					this.stopAllEffectAnimations();
					console.log('[Dialogs] Effect animations stopped after fade-out');
					
					// Hide all effects after fade-out completes
					this.hideAllEffects();
					console.log('[Dialogs] All effects hidden after fade-out');
					
					// Clean up dialog content after fade-out
					this.cleanupDialogContent();
					
					// Now perform the actual cleanup of destroyed elements
					this.performDialogCleanup();
					console.log('[Dialogs] Dialog elements cleaned up after fade-out');
					
					// Reset alpha to 1 for next dialog
					this.dialogOverlay.setAlpha(1);
					
					// Ensure black overlay is completely hidden after win dialog closes
					if (this.blackOverlay) {
						this.blackOverlay.setVisible(false);
						this.blackOverlay.setAlpha(0);
						console.log('[Dialogs] Black overlay completely hidden after win dialog fade-out');
					}
					
					// Emit dialog animations complete event
					scene.events.emit('dialogAnimationsComplete');
					console.log('[Dialogs] Win dialog animations complete event emitted');
					
					// Emit win dialog closed event for autoplay
					gameEventManager.emit(GameEventType.WIN_DIALOG_CLOSED);
					console.log('[Dialogs] WIN_DIALOG_CLOSED event emitted after fade-out');
					// Restore background music volume
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				});
			}
		});

		// Fade out current win dialog spine
		this.startSpineFadeOut(scene, delay, duration);
		
		// Remove the separate Spine tween to avoid timing conflicts
		// The main tween should handle all elements including the Spine animation
	}

	private startSpineFadeOut(scene: Scene, delay: number, duration: number): void {
		const spine = this.currentDialog;

		// Create a render texture snapshot and fade that out
		try {
			const rt = scene.add.renderTexture(0, 0, scene.scale.width, scene.scale.height);
			rt.setOrigin(0, 0);
			rt.setDepth((spine.depth ?? 0) + 1);
			rt.setAlpha(1);

			// Capture at the start of the fade so we get the latest animation frame
			scene.time.delayedCall(delay, () => {
				try {
					rt.clear();
					rt.draw(spine, spine.x, spine.y, spine.width, spine.height);
					spine.setVisible(false);

					scene.tweens.add({
						targets: rt,
						alpha: 0,
						duration: duration,
						ease: 'Power2',
						onComplete: () => {
							try { rt.destroy(); } catch {}
						}
					});
				} catch {}
			});
		} catch {}
	}

	/**
	 * Clean up dialog content without hiding the overlay (for win dialogs)
	 */
	private cleanupDialogContent(): void {
		console.log('[Dialogs] Cleaning up dialog content (keeping overlay visible)');
		
		// Stop all effect animations
		this.stopAllEffectAnimations();
		
		// Don't hide the dialog overlay - keep it visible for next dialog
		// this.dialogOverlay.setVisible(false);
		// Don't set isDialogActive to false yet - keep it true until cleanup is complete
		// this.isDialogActive = false;
		
		// Reset current dialog type
		this.currentDialogType = null;
		
		// Don't call performDialogCleanup here - it destroys elements that are still fading out
		// Instead, just reset the state and let the fade-out animation complete naturally
		// The actual cleanup will happen after the fade-out completes
		
		// Don't hide the black overlay when win dialog closes - let the next dialog handle it
		// This ensures that if a free spin dialog appears next, it will have the black overlay available
		console.log('[Dialogs] Keeping black overlay visible for potential next dialog');
		
		console.log('[Dialogs] Dialog content cleanup complete (overlay remains visible)');
	}

	/**
	 * Check if we should trigger bonus mode based on current dialog type
	 */
	private shouldTriggerBonusMode(): boolean {
		return this.currentDialogType === 'FreeSpinDialog_KA';
	}

	/**
	 * Trigger bonus mode by enabling bonus background and header
	 */
	private triggerBonusMode(scene: Scene): void {
		console.log('[Dialogs] ===== TRIGGERING BONUS MODE TRANSITION =====');
		console.log('[Dialogs] Scene exists:', !!scene);
		console.log('[Dialogs] Scene events exists:', !!scene.events);
		
		// Set bonus mode in backend data
		scene.events.emit('setBonusMode', true);
		console.log('[Dialogs] Emitted setBonusMode event');
		
		// Switch to bonus background
		scene.events.emit('showBonusBackground');
		console.log('[Dialogs] Emitted showBonusBackground event');
		
		// Switch to bonus header
		scene.events.emit('showBonusHeader');
		console.log('[Dialogs] Emitted showBonusHeader event');
		
		// Re-enable symbols after bonus mode setup
		scene.events.emit('enableSymbols');
		console.log('[Dialogs] Emitted enableSymbols event');
		
		// Emit dialog animations complete event for scatter bonus reset
		scene.events.emit('dialogAnimationsComplete');
		console.log('[Dialogs] Dialog animations complete event emitted for bonus mode');
		
		console.log('[Dialogs] ===== BONUS MODE ACTIVATED - BACKGROUND AND HEADER SWITCHED =====');
	}

	/**
	 * Clean up dialog without any transition effects
	 */
	private cleanupDialog(): void {
		if (!this.isDialogActive) return;
		
		console.log('[Dialogs] Cleaning up dialog');
		
		// Stop all effect animations
		this.stopAllEffectAnimations();
		
		// Hide the dialog overlay
		this.dialogOverlay.setVisible(false);
		this.isDialogActive = false;
		
		// Reset current dialog type
		this.currentDialogType = null;
		
		// Clean up all dialog elements
		this.performDialogCleanup();
		
		console.log('[Dialogs] Dialog cleanup complete');
	}

	/**
	 * Perform the actual cleanup of dialog elements
	 */
	private performDialogCleanup(): void {
		console.log('[Dialogs] Starting dialog cleanup');
		
		// Clean up current dialog
		if (this.currentDialog) {
			console.log('[Dialogs] Destroying current dialog');
			this.currentDialog.destroy();
			this.currentDialog = null;
		}
		
		// Clean up continue text
		if (this.continueText) {
			console.log('[Dialogs] Destroying continue text');
			this.continueText.destroy();
			this.continueText = null;
		}
		
		// Clean up number display
		if (this.numberDisplayContainer) {
			console.log('[Dialogs] Destroying number display');
			this.numberDisplayContainer.destroy();
			this.numberDisplayContainer = null;
		}
		
		// Clean up click area
		if (this.clickArea) {
			console.log('[Dialogs] Destroying click area');
			// Properly disable interactivity before destroying
			if (this.clickArea.input && this.clickArea.input.enabled) {
				this.clickArea.disableInteractive();
			}
			this.clickArea.destroy();
			this.clickArea = null;
		}
		
		// Destroy all effects in the container
		console.log('[Dialogs] Destroying effects, count:', this.effectsContainer.length);
		this.effectsContainer.getAll().forEach((effect: any, index: number) => {
			if (effect && effect.destroy) {
				console.log(`[Dialogs] Destroying effect ${index}:`, effect.texture?.key || 'unknown');
				effect.destroy();
			}
		});
		
		// Clear effects container
		this.effectsContainer.removeAll();
		
		// Clear auto-close timer if it exists
		if (this.autoCloseTimer) {
			console.log('[Dialogs] Destroying auto-close timer during cleanup');
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
		}
		
		// Now that all elements are destroyed, set dialog as inactive
		this.isDialogActive = false;
		console.log('[Dialogs] Dialog cleanup complete - isDialogActive set to false');
	}

	/**
	 * Hide the dialog with a simple black overlay transition
	 */
	hideDialog(): void {
		if (!this.isDialogActive) return;
		
		console.log('[Dialogs] Hiding dialog with black overlay transition');
		
		if (this.currentScene) {
			// Stop all effect animations immediately
			this.stopAllEffectAnimations();
			
			// Create a black overlay for transition
			const transitionOverlay = this.currentScene.add.graphics();
			transitionOverlay.setDepth(10000); // Very high depth to cover everything
			transitionOverlay.fillStyle(0x000000, 1);
			transitionOverlay.fillRect(0, 0, this.currentScene.scale.width, this.currentScene.scale.height);
			transitionOverlay.setAlpha(0); // Start transparent
			
			// Fade in black overlay over 0.75 seconds
			this.currentScene.tweens.add({
				targets: transitionOverlay,
				alpha: 1,
				duration: 750,
				ease: 'Power2',
				onComplete: () => {
					console.log('[Dialogs] Transition overlay fade-in complete');
					
					// Hide dialog immediately while screen is black
					this.dialogOverlay.setVisible(false);
					this.isDialogActive = false;
					
					// Fade out black overlay over 0.75 seconds
					this.currentScene!.tweens.add({
						targets: transitionOverlay,
						alpha: 0,
						duration: 750,
						ease: 'Power2',
						onComplete: () => {
							// Clean up transition overlay
							transitionOverlay.destroy();
							console.log('[Dialogs] Black overlay transition complete, dialog hidden');
						}
					});
				}
			});
		} else {
			// Fallback if no scene reference
			this.dialogOverlay.setVisible(false);
			this.isDialogActive = false;
		}
		
		// Perform cleanup after transition
		this.performDialogCleanup();
		
		console.log('[Dialogs] Dialog hidden and cleaned up');
	}

	/**
	 * Check if dialog is currently showing
	 */
	isDialogShowing(): boolean {
		return this.isDialogActive;
	}

	/**
	 * Get the current dialog type
	 */
	getCurrentDialogType(): string | null {
		return this.currentDialog ? this.currentDialog.texture.key : null;
	}

	/**
	 * Resize the dialog overlay when screen size changes
	 */
	resize(scene: Scene): void {
		// Update stored scene reference
		this.currentScene = scene;
		
		if (this.blackOverlay) {
			this.blackOverlay.clear();
			this.blackOverlay.fillStyle(0x000000, 0.7);
			this.blackOverlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		}
	}

	/**
	 * Get the dialog overlay container
	 */
	getContainer(): Phaser.GameObjects.Container {
		return this.dialogOverlay;
	}

	/**
	 * Destroy the dialog system
	 */
	destroy(): void {
		this.hideDialog();
		if (this.dialogOverlay) {
			this.dialogOverlay.destroy();
		}
	}

	// Helper methods for dialog configuration
	private getDialogScale(dialogType: string): number {
		return this.dialogScales[dialogType] || 1.0;
	}

	private getDialogPosition(dialogType: string, scene: Scene): { x: number; y: number } {
		const position = this.dialogPositions[dialogType];
		if (position) {
			// Convert relative positions (0.0 to 1.0) to absolute screen coordinates
			return {
				x: position.x * scene.scale.width,
				y: position.y * scene.scale.height
			};
		}
		// Default to center of screen
		return { x: scene.scale.width / 2, y: scene.scale.height / 2 };
	}

	private getDialogLoop(dialogType: string): boolean {
		return this.dialogLoops[dialogType] || false;
		}
		
	// Convenience methods for specific dialog types
	showCongrats(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'Congrats_KA', ...config });
	}

	showFreeSpinDialog(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'FreeSpinDialog', ...config });
	}

	// 20x
	showBigWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'BigWin', ...config });
	}
		
	// 30x
	showMegaWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'MegaWin', ...config });
	}

	// 45x
	showEpicWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'EpicWin', ...config });
	}

	// 60x
	showSuperWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'SuperWin', ...config });
	}
}
