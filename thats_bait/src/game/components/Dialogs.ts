import { Scene } from 'phaser';
import { MusicType, SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineLoader, ensureSpineFactory } from '../../utils/SpineGuard';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { gameStateManager } from '../../managers/GameStateManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { resolveAssetUrl } from '../../utils/AssetLoader';

export interface DialogConfig {
	type: 'Congrats';
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
	
	// Optional background container for certain dialogs (e.g., Congrats)
	private dialogBackgroundContainer: Phaser.GameObjects.Container;
	// Separate container for the congrats character (independent of background)
	private dialogCharacterContainer: Phaser.GameObjects.Container;
	
	// Dialog content container (the actual dialog animations)
	private dialogContentContainer: Phaser.GameObjects.Container;
	
	// Continue text
	private continueText: Phaser.GameObjects.Text | null = null;
	private continueTextOffsetX: number = 0;
	private continueTextOffsetY: number = 330;
	
	// Number display container
	private numberDisplayContainer: Phaser.GameObjects.Container | null = null;
	private numberDisplayRef: NumberDisplay | null = null;
	// Number display position offsets (modifiers)
	private numberDisplayOffsetX: number = 0;
	private numberDisplayOffsetY: number = 25;
	

	
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

	// Congrats-specific extras
	private congratsBgImage: Phaser.GameObjects.Image | null = null;
	private congratsBgScale: number = 1.0;
	private congratsBgOffsetX: number = 0;
	private congratsBgOffsetY: number = 0;
	// Congrats background fire spine behind the PNG bg
	private congratsFireSpine: any | null = null;
	private congratsFireScale: number = 0.70; // tuned for fireanimation01_HTBH
	private congratsFireOffsetX: number = 0;  // tuned for fireanimation01_HTBH
	private congratsFireOffsetY: number = -35; // tuned for fireanimation01_HTBH
	private congratsFireTimeScale: number = 1;
	private congratsFireAnimName: string = 'animation';
	// Congrats title image (PNG) with breathing animation
	private congratsWinTitleImage: Phaser.GameObjects.Image | null = null;
	private congratsWinTitleScale: number = 1.0;
	private congratsWinTitleOffsetX: number = 0;
	private congratsWinTitleOffsetY: number = 15;
	private congratsWinTitleBreathDurationMs: number = 120;
	private congratsWinTitleTween: Phaser.Tweens.Tween | null = null;

	// Congrats numbers defaults (editable in code)
	private congratsNumberSpacing: number = -30 ;

	// End-of-bonus fire transition (before Congrats)
	private endTransitionContainer: Phaser.GameObjects.Container | null = null;
	private endTransitionBg: Phaser.GameObjects.Rectangle | null = null;
	private endTransitionSpine: any | null = null;
	private endFireTransitionLoadState: 'unloaded' | 'loading' | 'loaded' | 'failed' = 'unloaded';
	private endFireTransitionLoadPromise: Promise<boolean> | null = null;
	private endFireTransitionTimeScale: number = 0.85;
	private endFireTransitionMidTriggerRatio: number = 0.5;
	private endBlackOverlay: Phaser.GameObjects.Rectangle | null = null;
	// Black overlay timing to feel slightly longer than fire transition
	private endBlackOverlayLeadMs: number = 120; // start before spine anim
	private endBlackOverlayTailMs: number = 140; // end after spine anim
	private endBlackOverlayFadeInMs: number = 80;
	private endBlackOverlayHoldMs: number = 0;
	private endBlackOverlayFadeOutMs: number = 110;

	// Pre-Congrats fire transition: hold the black mask after fire completes (ms)
	private startFireBlackHoldMs: number = 120;

	// Congrats number counting speed modifier (>1 is faster, <1 is slower)
	private congratsNumberSpeedMul: number = 1.0;

	// Extra settle timers to eliminate scene glimpse
	private blackCoverPreCleanupDelayMs: number = 50; // wait after black reaches 1 before cleanup/switch
	private postSwitchSettleMs: number = 100; // wait after switching to base before revealing anything
	private preFireRevealMs: number = 50; // wait after fire starts before reducing black from 1 to 0.7

	// Embers anticipation (rising flakes over black)
	private embersContainer: Phaser.GameObjects.Container | null = null;
	private embersSpawnTimer: Phaser.Time.TimerEvent | null = null;
	private emberParticles: Array<{ graphics: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; size: number; color: number; alpha: number; lifetime: number; age: number; } > = [];
	private emberUpdateHandler: ((time: number, delta: number) => void) | null = null;

    private congratsCharSpine: SpineGameObject | null = null;
    private congratsCharScale: number = 0.75;
    private congratsCharX: number | null = null;
    private congratsCharY: number | null = null;
    private congratsCharOffsetX: number = 120;
    private congratsCharOffsetY: number = 40;
    private congratsCharTimeScale: number = 1.0;
	// Nested containers for precise transforms
	private congratsCharRoot: Phaser.GameObjects.Container | null = null; // base position
	private congratsCharOffsetContainer: Phaser.GameObjects.Container | null = null; // pixel offsets
	private congratsCharScaleContainer: Phaser.GameObjects.Container | null = null; // scale/rotation

	// Dialog configuration
	private dialogScales: Record<string, number> = {};

	// Dialog positions (relative: 0.0 = left/top, 0.5 = center, 1.0 = right/bottom)
	private dialogPositions: Record<string, { x: number; y: number }> = {};

	private dialogLoops: Record<string, boolean> = {};

	private getAssetPrefix(): string {
		try {
			const isPortrait = !!this.screenModeManager?.getScreenConfig?.().isPortrait;
			const isHigh = !!this.networkManager?.getNetworkSpeed?.();
			const orientation = isPortrait ? 'portrait' : 'landscape';
			const quality = isHigh ? 'high' : 'low';
			return `assets/${orientation}/${quality}`;
		} catch { return 'assets/portrait/high'; }
	}

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	// ===== End-of-bonus Fire Transition before Congrats =====
	private loadEndFireTransitionIfNeeded(): Promise<boolean> {
		if (!this.currentScene) return Promise.resolve(false);
		if (this.endFireTransitionLoadState === 'loaded') return Promise.resolve(true);
		if (this.endFireTransitionLoadState === 'failed') return Promise.resolve(false);
		if (this.endFireTransitionLoadState === 'loading' && this.endFireTransitionLoadPromise) return this.endFireTransitionLoadPromise;

		this.endFireTransitionLoadState = 'loading';
		this.endFireTransitionLoadPromise = new Promise<boolean>((resolve) => {
			try {
				if (!ensureSpineLoader(this.currentScene!, '[Dialogs] end fire transition dynamic load')) {
					this.endFireTransitionLoadState = 'failed';
					resolve(false);
					return;
				}
                const loader = (this.currentScene as any).load;
                const prefix = this.getAssetPrefix();
				try { loader?.spineAtlas?.('fire_transition_atlas', resolveAssetUrl(`${prefix}/fire_animations/Fire_Transition.atlas`)); } catch {}
				try { loader?.spineJson?.('fire_transition', resolveAssetUrl(`${prefix}/fire_animations/Fire_Transition.json`)); } catch {}
				const onComplete = () => { this.endFireTransitionLoadState = 'loaded'; resolve(true); };
				const onError = () => { this.endFireTransitionLoadState = 'failed'; resolve(false); };
				try { (this.currentScene as any).load?.once('complete', onComplete); } catch {}
				try { (this.currentScene as any).load?.once('loaderror', onError); } catch {}
				try { (this.currentScene as any).load?.start(); } catch {}
			} catch (e) {
				console.warn('[Dialogs] End fire transition dynamic load failed:', e);
				this.endFireTransitionLoadState = 'failed';
				resolve(false);
			}
		});
		return this.endFireTransitionLoadPromise;
	}

	private playEndFireTransitionThen(next: () => void): void {
		const scene = this.currentScene;
		if (!scene || !ensureSpineFactory(scene, '[Dialogs] end fire transition factory')) { next(); return; }
		this.loadEndFireTransitionIfNeeded().then((loaded) => {
			if (!loaded) { next(); return; }
			try {
				// Prepare elements
				if (!this.endTransitionBg) {
					this.endTransitionBg = scene.add.rectangle(
						scene.cameras.main.width / 2,
						scene.cameras.main.height / 2,
						scene.cameras.main.width * 2,
						scene.cameras.main.height * 2,
						0x000000,
						1
					);
					this.endTransitionBg.setOrigin(0.5);
					this.endTransitionBg.setAlpha(1);
					try { this.endTransitionBg.setInteractive(); } catch {}
					this.endTransitionContainer?.add(this.endTransitionBg);
				}
				if (this.endTransitionSpine) { try { this.endTransitionSpine.destroy(); } catch {} this.endTransitionSpine = null; }
				this.endTransitionSpine = (scene.add as any).spine(
					scene.cameras.main.width * 0.5,
					scene.cameras.main.height * 0.5,
					'fire_transition',
					'fire_transition_atlas'
				);
				try { this.endTransitionSpine.setOrigin(0.5, 0.5); } catch {}
				try { (this.endTransitionSpine as any).setDepth?.(1); } catch {}
				// Pin to camera space
				try { (this.endTransitionSpine as any).setScrollFactor?.(0); } catch {}
				try { this.endTransitionContainer?.setScrollFactor?.(0); } catch {}
				try { this.endTransitionBg?.setScrollFactor?.(0); } catch {}
				this.endTransitionContainer?.add(this.endTransitionSpine);
				// Show on top
				this.endTransitionContainer?.setVisible(true);
				this.endTransitionContainer?.setAlpha(1);
				try { scene.children.bringToTop(this.endTransitionContainer!); } catch {}
				// Fast fade-in for black mask behind fire transition
					try {
						if (this.endTransitionBg) {
							// Delay black mask fade until after the fire transition completes
							this.endTransitionBg.setAlpha(0);
						}
					} catch {}
				// Cover-fit scaling with slight overscan to avoid any gaps
				try {
					const w = scene.cameras.main.width;
					const h = scene.cameras.main.height;
					let bw = 0; let bh = 0;
					try {
						const b = (this.endTransitionSpine as any).getBounds?.();
						bw = (b && (b.size?.x || (b as any).width)) || 0;
						bh = (b && (b.size?.y || (b as any).height)) || 0;
					} catch {}
					if (!bw || !bh) { bw = (this.endTransitionSpine as any).displayWidth || 0; bh = (this.endTransitionSpine as any).displayHeight || 0; }
					if (bw > 0 && bh > 0) {
						const scaleToCover = Math.max(w / bw, h / bh) * 2.0;
						(this.endTransitionSpine as any).setScale(scaleToCover);
					}
				} catch {}
				// Stop any currently playing BGM defensively to avoid overlaps
				try {
					const audio = (window as any).audioManager;
					if (audio && typeof audio.stopAllMusic === 'function') {
						audio.stopAllMusic();
					}
				} catch {}
				// Play blaze SFX consistently with Fire_Transition
				try {
					const audio = (window as any).audioManager;
					if (audio && typeof audio.playSoundEffect === 'function') {
						audio.playSoundEffect('blaze_hh' as any);
					} else {
						try { (scene as any).sound?.play?.('blaze_hh'); } catch {}
					}
				} catch {}
				// timeScale
				try { (this.endTransitionSpine as any).animationState.timeScale = Math.max(0.05, this.endFireTransitionTimeScale); } catch {}
				// Keep opaque mask behind spine to ensure no gaps
				// Play animation
				let finished = false;
				let congratsShown = false;
				const showCongratsIfNeeded = () => {
					if (congratsShown) return; congratsShown = true; next();
				};
				const fadeOutMaskAndEmit = () => {
					// Fade out blaze SFX as transition ends
					try {
						const audio = (window as any).audioManager;
						if (audio && typeof audio.fadeOutSfx === 'function') {
							audio.fadeOutSfx('blaze_hh' as any, 200);
						}
					} catch {}
					scene.tweens.add({
						targets: this.endTransitionContainer,
						alpha: 0,
						duration: 200,
						ease: 'Cubic.easeIn',
						onComplete: () => {
							try {
								this.endTransitionContainer?.setVisible(false);
								this.endTransitionContainer?.setAlpha(1);
								if (this.endTransitionSpine) { this.endTransitionSpine.destroy(); this.endTransitionSpine = null; }
								if (this.endTransitionBg) { this.endTransitionBg.setAlpha(0); }
							} catch {}
							// Mask gone → tell Congrats to start number counting
							try { scene.events.emit('preCongratsMaskGone'); } catch {}
							// Ensure congrats is shown
							showCongratsIfNeeded();
						}
					});
				};

					const finish = () => {
					if (finished) return; finished = true;
						// Now bring in the black overlay for congrats after fire completes
						try {
							if (this.endBlackOverlay && scene?.tweens) {
								try { scene.tweens.killTweensOf(this.endBlackOverlay); } catch {}
								this.endBlackOverlay.setVisible(true);
								this.endBlackOverlay.setAlpha(0);
								scene.tweens.add({
									targets: this.endBlackOverlay,
									alpha: 0.7,
									duration: Math.max(20, this.endBlackOverlayFadeInMs),
									ease: 'Cubic.easeOut'
								});
							}
						} catch {}
					const hold = Math.max(0, this.startFireBlackHoldMs || 0);
					if (hold > 0) {
						scene.time.delayedCall(hold, fadeOutMaskAndEmit);
					} else {
						fadeOutMaskAndEmit();
					}
				};
				try {
					const state = (this.endTransitionSpine as any).animationState;
					let entry: any = null;
					let played = false;
					try { entry = state.setAnimation(0, 'animation', false); played = true; } catch {}
					if (!played) {
						try {
							const anims = (this.endTransitionSpine as any)?.skeleton?.data?.animations || [];
							const first = anims[0]?.name; if (first) { entry = state.setAnimation(0, first, false); played = true; }
						} catch {}
					}
					// mid trigger to show congrats
					try {
						const rawDurationSec = Math.max(0.1, entry?.animation?.duration || 1.2);
						const ratio = Math.min(0.95, Math.max(0.05, this.endFireTransitionMidTriggerRatio));
						const midDelayMs = Math.max(50, (rawDurationSec / Math.max(0.0001, this.endFireTransitionTimeScale)) * 1000 * ratio);
						scene.time.delayedCall(midDelayMs, showCongratsIfNeeded);
					} catch {}
					try { state?.setListener?.({ complete: finish } as any); } catch {}
					// Fallback complete
					scene.time.delayedCall(1200, finish);
				} catch {
					finish();
				}
			} catch {
				next();
			}
		});
	}

	public setEndFireTransitionTimeScale(scale: number = 0.85): void {
		this.endFireTransitionTimeScale = Math.max(0.05, scale);
	}

	public setEndFireTransitionMidTriggerRatio(ratio: number = 0.5): void {
		this.endFireTransitionMidTriggerRatio = Math.min(0.95, Math.max(0.05, ratio));
	}

	create(scene: Scene): void {
		// Store scene reference for later use
		this.currentScene = scene
		
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
		
		// Create background container between black overlay and effects
		this.dialogBackgroundContainer = scene.add.container(0, 0);
		this.dialogBackgroundContainer.setDepth(150);
		this.dialogOverlay.add(this.dialogBackgroundContainer);
		
		// Create character container above background (separate, not anchored to bg)
		this.dialogCharacterContainer = scene.add.container(0, 0);
		this.dialogCharacterContainer.setDepth(250);
		this.dialogOverlay.add(this.dialogCharacterContainer);
		
		// Create dialog content container (highest depth = in front of everything)
		this.dialogContentContainer = scene.add.container(0, 0);
		this.dialogContentContainer.setDepth(300); // Highest depth to be in front
		this.dialogOverlay.add(this.dialogContentContainer);

		// End-of-bonus fire transition container (above everything, hidden by default)
		this.endTransitionContainer = scene.add.container(0, 0);
		this.endTransitionContainer.setDepth(20000);
		this.endTransitionContainer.setVisible(false);
		// Add shared black overlay for quick fade between congrats and base
		this.endBlackOverlay = scene.add.rectangle(
			scene.scale.width * 0.5,
			scene.scale.height * 0.5,
			scene.scale.width * 2,
			scene.scale.height * 2,
			0x000000,
			1
		);
		this.endBlackOverlay.setOrigin(0.5);
		this.endBlackOverlay.setAlpha(0);
		this.endBlackOverlay.setVisible(false);
		this.endTransitionContainer.add(this.endBlackOverlay);
		try { this.endTransitionContainer.sendToBack(this.endBlackOverlay); } catch {}
		
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

	// Safety: ensure Congrats-only fire is gone when not in Congrats
		if (this.currentDialogType !== 'Congrats' && this.congratsFireSpine) {
			try { this.congratsFireSpine.destroy(); } catch {}
			this.congratsFireSpine = null;
		}
		
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
		this.createDialogContent(scene, config);

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

		// Create effects based on dialog type
		this.createEffects(scene, config.type);
		// Add Congrats fire AFTER effects are created (effects container is cleared inside createEffects)
		if (config.type === 'Congrats') {
			try {
				if (this.congratsFireSpine) { try { this.congratsFireSpine.destroy(); } catch {} this.congratsFireSpine = null; }
				if (ensureSpineFactory(scene, '[Dialogs] congrats fire spine (post-effects)')) {
					const centerX = scene.scale.width * 0.5;
					const centerY = scene.scale.height * 0.5;
					const fire = (scene.add as any).spine(centerX + this.congratsFireOffsetX, centerY + this.congratsFireOffsetY, 'fireanimation01_HTBH', 'fireanimation01_HTBH-atlas');
					try { fire.setOrigin(0.5, 0.5); } catch {}
					try { fire.setScale(Math.max(0.05, this.congratsFireScale)); } catch {}
					try {
						const animName = this.congratsFireAnimName || 'animation';
						let played = false;
						try { fire.animationState.setAnimation(0, animName, true); played = true; } catch {}
						if (!played) {
							try {
								const anims = (fire as any)?.skeleton?.data?.animations || [];
								const first = anims[0]?.name; if (first) { fire.animationState.setAnimation(0, first, true); played = true; }
							} catch {}
						}
					} catch {}
					try { fire.animationState.timeScale = Math.max(0.0001, this.congratsFireTimeScale || 1.0); } catch {}
					// Place in content container so title added later sits above it automatically
					try { this.dialogContentContainer.add(fire); } catch {}
					try { (this.dialogContentContainer as any).sendToBack?.(fire); } catch {}
					this.congratsFireSpine = fire;
				}
			} catch {}
		}
		// Expose runtime setter for background fire spine options (debug)
		try {
			const self = this;
			(window as any).setCongratsFire = function(opts: { offsetX?: number; offsetY?: number; scale?: number; timeScale?: number; anim?: string }) {
				self.setCongratsFireOptions(opts || {});
				return { offsetX: self.congratsFireOffsetX, offsetY: self.congratsFireOffsetY, scale: self.congratsFireScale, timeScale: self.congratsFireTimeScale, anim: self.congratsFireAnimName };
			};
		} catch {}
		
		// If Congrats, add the PNG title with breathing tween (after main content is created)
		if (config.type === 'Congrats') {
			try {
				// Clean any prior title image instance
				if (this.congratsWinTitleImage) { try { this.congratsWinTitleImage.destroy(); } catch {} this.congratsWinTitleImage = null; }
				if (this.congratsWinTitleTween) { try { this.congratsWinTitleTween.stop(); } catch {} this.congratsWinTitleTween = null; }
				const centerX = scene.scale.width * 0.5;
				const centerY = scene.scale.height * 0.5;
				const img = scene.add.image(centerX + this.congratsWinTitleOffsetX, centerY + this.congratsWinTitleOffsetY, 'congratulations-you-won');
				img.setOrigin(0.5, 0.5);
				img.setScale(Math.max(0.05, this.congratsWinTitleScale));
				img.setAlpha(1);
				this.dialogContentContainer.add(img);
				this.dialogContentContainer.bringToTop(img);
				this.congratsWinTitleImage = img;
				// Breathing tween
				this.congratsWinTitleTween = scene.tweens.add({
					targets: img,
					scaleX: img.scaleX * 1.045,
					scaleY: img.scaleY * 1.045,
					duration: Math.max(100, this.congratsWinTitleBreathDurationMs),
					ease: 'Sine.inOut',
					yoyo: true,
					repeat: -1
				});
			} catch (e) {
				console.warn('[Dialogs] Failed to create congrats title image', e);
			}
		}

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

		// Clear any congrats-specific background/character from previous dialog
		if (this.congratsBgImage) { try { this.congratsBgImage.destroy(); } catch {} this.congratsBgImage = null; }
		if (this.congratsFireSpine) { try { this.congratsFireSpine.destroy(); } catch {} this.congratsFireSpine = null; }
		if (this.congratsCharSpine) { try { this.congratsCharSpine.destroy(); } catch {} this.congratsCharSpine = null; }
		if (this.congratsWinTitleImage) { try { this.congratsWinTitleImage.destroy(); } catch {} this.congratsWinTitleImage = null; }
		// Reset nested containers references
		this.congratsCharRoot = null;
		this.congratsCharOffsetContainer = null;
		this.congratsCharScaleContainer = null;

		const position = config.position || this.getDialogPosition(config.type, scene);
		const scale = config.scale || this.getDialogScale(config.type);
		
		// If Congrats dialog, add background fire spine, background image, and character
		if (config.type === 'Congrats') {
			try {
				const centerX = scene.scale.width * 0.5;
				const centerY = scene.scale.height * 0.5;
				// (Congrats fire will be added after createEffects to avoid being cleared.)
				// Background image scaled to cover
				const bg = scene.add.image(centerX, centerY, 'congrats-bg');
				bg.setOrigin(0.5, 0.5);
				const coverScaleX = scene.scale.width / Math.max(1, bg.width);
				const coverScaleY = scene.scale.height / Math.max(1, bg.height);
				const coverScale = Math.max(coverScaleX, coverScaleY) * Math.max(0.05, this.congratsBgScale);
				bg.setScale(coverScale);
				bg.x = centerX + this.congratsBgOffsetX;
				bg.y = centerY + this.congratsBgOffsetY;
				// Depth within background container is relative; container depth is already 150
				this.dialogBackgroundContainer.add(bg);
				this.congratsBgImage = bg;
			} catch (e) {
				console.warn('[Dialogs] Failed to create congrats background image', e);
			}
			try {
				// Nested containers: base position -> pixel offset -> scale
				const baseX = (typeof this.congratsCharX === 'number' && isFinite(this.congratsCharX)) ? this.congratsCharX : scene.scale.width * 0.5;
				const baseY = (typeof this.congratsCharY === 'number' && isFinite(this.congratsCharY)) ? this.congratsCharY : scene.scale.height * 0.5;
				this.congratsCharRoot = scene.add.container(baseX, baseY);
				this.congratsCharOffsetContainer = scene.add.container((this.congratsCharOffsetX || 0), (this.congratsCharOffsetY || 0));
				this.congratsCharScaleContainer = scene.add.container(0, 0);
				this.congratsCharRoot.add(this.congratsCharOffsetContainer);
				this.congratsCharOffsetContainer.add(this.congratsCharScaleContainer);
				this.dialogCharacterContainer.add(this.congratsCharRoot);

				// Character at 0,0 inside the scale container for stable scaling
				const char = scene.add.spine(0, 0, 'HustleForSpine', 'HustleForSpine-atlas') as SpineGameObject;
				char.setOrigin(0.5, 0.5);
				try { char.animationState.setAnimation(0, '_win', true); } catch {}
				try { char.animationState.timeScale = Math.max(0.0001, this.congratsCharTimeScale); } catch {}
				this.congratsCharScaleContainer.add(char);
				this.congratsCharScaleContainer.setScale(Math.max(0.05, this.congratsCharScale));
				this.congratsCharSpine = char;
			} catch (e) {
				console.warn('[Dialogs] Failed to create congrats character spine', e);
			}
		}

		// Create Spine animation for the dialog, except for Congrats (now PNG-only)
		if (config.type !== 'Congrats') {
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
		} else {
			// For Congrats, no Spine dialog; handled by PNG + effects
			this.currentDialog = null;
			console.log('[Dialogs] Skipping Congrats Spine creation (PNG-based congrats title in use)');
		}

		// Expose console helpers when showing Congrats dialog
		if (config.type === 'Congrats') {
			try {
				const self = this;
				(window as any).setCongratsBg = function(opts: { scale?: number; offsetX?: number; offsetY?: number }) {
					self.setCongratsBgOptions(opts);
					return { scale: self.congratsBgScale, offsetX: self.congratsBgOffsetX, offsetY: self.congratsBgOffsetY };
				};
                (window as any).setCongratsChar = function(opts: { x?: number; y?: number; offsetX?: number; offsetY?: number; scale?: number; timeScale?: number }) {
					self.setCongratsCharacterOptions(opts);
                    return { x: self.congratsCharX, y: self.congratsCharY, offsetX: self.congratsCharOffsetX, offsetY: self.congratsCharOffsetY, scale: self.congratsCharScale, timeScale: self.congratsCharTimeScale };
				};
                (window as any).setCongratsCharOffset = function(opts: { offsetX?: number; offsetY?: number }) {
                    self.setCongratsCharacterOffset(opts);
                    return { offsetX: self.congratsCharOffsetX, offsetY: self.congratsCharOffsetY };
                };
				(window as any).setCongratsTitle = function(opts: { offsetX?: number; offsetY?: number; scale?: number; durationMs?: number }) {
					self.setCongratsTitleOptions(opts);
					return { offsetX: self.congratsWinTitleOffsetX, offsetY: self.congratsWinTitleOffsetY, scale: self.congratsWinTitleScale, durationMs: self.congratsWinTitleBreathDurationMs };
				};
				(window as any).setCongratsTitleOffset = function(opts: { offsetX?: number; offsetY?: number }) {
					self.setCongratsTitleOptions({ offsetX: opts.offsetX, offsetY: opts.offsetY });
					return { offsetX: self.congratsWinTitleOffsetX, offsetY: self.congratsWinTitleOffsetY };
				};
				(window as any).setCongratsNumberSpacing = function(spacing: number) {
					self.setCongratsNumberSpacing(spacing);
					return { spacing };
				};
				(window as any).getCongratsNodes = function() {
					return { bg: self.congratsBgImage, char: self.congratsCharSpine, title: self.congratsWinTitleImage };
				};
				(window as any).setEndBlackOverlayTiming = function(opts: { fadeInMs?: number; holdMs?: number; fadeOutMs?: number; leadMs?: number; tailMs?: number }) {
					self.setEndBlackOverlayTiming(opts);
					return {
						fadeInMs: self.endBlackOverlayFadeInMs,
						holdMs: self.endBlackOverlayHoldMs,
						fadeOutMs: self.endBlackOverlayFadeOutMs,
						leadMs: self.endBlackOverlayLeadMs,
						tailMs: self.endBlackOverlayTailMs
					};
				};
				console.log('[Dialogs] Console helpers available: setCongratsBg({...}), setCongratsChar({...}), setCongratsCharOffset({...}), setCongratsTitle({...}), setCongratsTitleOffset({...}), setCongratsNumberSpacing(n), getCongratsNodes()');
			} catch {}
		}
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
		// Effects removed from project (confetti/explosion/paint)
		try { console.log('[Dialogs] Skipping effects (confetti/explosion/paint removed)'); } catch {}
	}

	/**
	 * Create confetti effect
	 */
// removed: confetti effect no longer supported

	/**
	 * Create explosion effect
	 */
// removed: explosion effect no longer supported

	/**
	 * Create paint effect
	 */
// removed: paint effect no longer supported

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
			scene.scale.width / 2 + this.continueTextOffsetX,
			scene.scale.height / 2 + this.continueTextOffsetY,
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
		
		// Fade in the text after 1.5 seconds (reduced from 4.5 seconds)
		scene.tweens.add({
			targets: this.continueText,
			alpha: 1,
			duration: 500,
			delay: 1500,
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
		const isCongrats = (this.currentDialogType === 'Congrats');
		const numberConfig: NumberDisplayConfig = {
			x: scene.scale.width / 2,
			y: scene.scale.height / 2 + 200,
			scale: isCongrats ? 0.085 : 0.15,
			spacing: isCongrats ? this.congratsNumberSpacing : -8,
			alignment: 'center',
			decimalPlaces: freeSpins !== undefined ? 0 : 2, // No decimals for free spins
			showCommas: freeSpins !== undefined ? false : true, // No commas for free spins
			prefix: '', // No prefix for any number display
			suffix: '', // No suffix - only display numbers
			commaYOffset: 12,
			dotYOffset: 10
		};

		// Create the number display
		const numberDisplay = new NumberDisplay(this.networkManager, this.screenModeManager, numberConfig);
		numberDisplay.create(scene);
		// Display free spins if provided, otherwise display win amount
		const displayValue = freeSpins !== undefined ? freeSpins : winAmount;
		// For non-animated cases, we set the final value immediately. For Congrats, we'll animate below
		if (this.currentDialogType !== 'Congrats') {
			numberDisplay.displayValue(displayValue);
		}
		// Keep a reference for live spacing updates
		this.numberDisplayRef = numberDisplay;
		

		
		// Create container for number displays (apply offsets via container position)
		this.numberDisplayContainer = scene.add.container(0, 0);
		this.numberDisplayContainer.setDepth(103);
		this.numberDisplayContainer.add(numberDisplay.getContainer());
		// Apply current offsets
		this.numberDisplayContainer.x = this.numberDisplayOffsetX;
		this.numberDisplayContainer.y = this.numberDisplayOffsetY;
		
		// Start with alpha 0 (invisible) - will be faded in; for Congrats we handle fade-in here
		this.numberDisplayContainer.setAlpha(0);
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.numberDisplayContainer);
		
		console.log('[Dialogs] Created number display');

		// If Congrats overlay, wait for pre-Congrats mask to finish, then fade in and animate counting
		if (this.currentDialogType === 'Congrats') {
			const startCounting = () => {
				// Fade in the number display quickly
				scene.tweens.add({ targets: this.numberDisplayContainer, alpha: 1, duration: 250, ease: 'Power2' });
				// Animate the number from 0 to displayValue
				try {
					const decimals = Math.max(0, numberConfig.decimalPlaces || 0);
					const counter = { v: 0 };
					const baseDuration = 1500;
					const speed = Math.max(0.05, this.congratsNumberSpeedMul || 1.0);
					const duration = Math.max(50, Math.floor(baseDuration / speed));
					scene.tweens.add({
						targets: counter,
						v: displayValue,
						duration,
						ease: 'Cubic.easeOut',
						onUpdate: () => {
							const shown = parseFloat(counter.v.toFixed(decimals));
							numberDisplay.displayValue(shown);
						}
					});
				} catch {}
			};
			try {
				// Start when the pre-Congrats fire mask has fully faded out
				scene.events.once('preCongratsMaskGone', startCounting);
				// Fallback: if event never arrives, start after a small delay
				scene.time.delayedCall(1200, startCounting);
			} catch {
				startCounting();
			}
		}
	}

	/** Public API: set offset modifiers for number display position (applied as container offset). */
	public setNumberDisplayOffset(offsetX: number = 0, offsetY: number = 0): void {
		this.numberDisplayOffsetX = offsetX | 0;
		this.numberDisplayOffsetY = offsetY | 0;
		if (this.numberDisplayContainer) {
			try { this.numberDisplayContainer.x = this.numberDisplayOffsetX; } catch {}
			try { this.numberDisplayContainer.y = this.numberDisplayOffsetY; } catch {}
		}
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
		// Clear number display reference
		this.numberDisplayRef = null;
		// Stop and clear title tween, hide title
		if (this.congratsWinTitleTween) {
			try { this.congratsWinTitleTween.stop(); } catch {}
			this.congratsWinTitleTween = null;
		}
		if (this.congratsWinTitleImage) {
			this.congratsWinTitleImage.setVisible(false);
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
		
		// Reset win line drawer interrupted flag if symbols exist
		if (gameScene.symbols && gameScene.symbols.winLineDrawer && 
			gameScene.symbols.winLineDrawer.resetInterruptedFlag) {
			gameScene.symbols.winLineDrawer.resetInterruptedFlag();
			console.log('[Dialogs] Reset win line drawer interrupted flag for manual dialog close');
		}
		
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
			scene.time.delayedCall(1500, () => {
				if (this.clickArea) {
					this.clickArea.on('pointerdown', () => {
						if ((window as any).audioManager) {
							(window as any).audioManager.playSoundEffect(SoundEffectType.BUTTON_FX);
						}
						this.handleDialogClick(scene);
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
						if ((window as any).audioManager) {
							(window as any).audioManager.playSoundEffect('button_fx' as any);
						}
						this.handleDialogClick(scene);
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
			this.disableAllWinDialogElements();
			this.startWinDialogFadeOut(scene);
			return;
		}
		
	// Free spin dialog removed
		
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
        // Legacy win dialogs removed; overlays handle wins
        return false;
    }
	
	/**
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

		// Determine current dialog type before cleanup
		const dialogTypeBeforeCleanup = this.currentDialogType;

		// If closing Congrats, use end fire transition back to base
		if (dialogTypeBeforeCleanup === 'Congrats') {
			console.log('[Dialogs] Congrats dialog closed - using end fire transition back to base');
			// Stop effects but keep Congrats visible until mask covers
			this.stopAllEffectAnimations();
			this.playBlackCoverThenBaseThenFire(scene, () => {
				try { scene.events.emit('dialogAnimationsComplete'); } catch {}
				try {
					const audioManager = (window as any).audioManager;
					if (audioManager && typeof audioManager.restoreBackground === 'function') {
						audioManager.restoreBackground();
					}
				} catch {}
			});
			return;
		}
		// Store the dialog type before cleanup for other transitions
		// const dialogTypeBeforeCleanup = this.currentDialogType;
		
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

				// Free spin dialog removed; handle only Congrats branch
				if (false) { } else {
					// If congrats closed while in bonus mode, revert to base visuals and reset symbols
					if (dialogTypeBeforeCleanup === 'Congrats') {
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
						if (dialogTypeBeforeCleanup === 'Congrats') {
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

	// End fire transition used when leaving Congrats and returning to base
	private playEndFireTransitionOutToBase(scene: Scene, onDone?: () => void): void {
		let overlayActive = false;
		let baseSwitchedEarly = false;
		const showOverlay = () => {
			if (!this.endBlackOverlay || !scene?.tweens) {
				overlayActive = false;
				return;
			}
			try { scene.tweens.killTweensOf(this.endBlackOverlay); } catch {}
			this.endBlackOverlay.setVisible(true);
			this.endBlackOverlay.setAlpha(0);
			scene.tweens.add({ targets: this.endBlackOverlay, alpha: 0.7, duration: Math.max(20, this.endBlackOverlayFadeInMs), ease: 'Cubic.easeOut', onComplete: () => {
				// Once mask fully covers, hide congrats content to avoid snapping
				try { this.cleanupDialog(); } catch {}
				// While covered, switch back to base under mask so fire sits between states
				try { scene.events.emit('setBonusMode', false); } catch {}
				try { scene.events.emit('hideBonusBackground'); } catch {}
				try { scene.events.emit('hideBonusHeader'); } catch {}
				try {
					const audio = (window as any).audioManager;
					if (audio && typeof audio.setExclusiveBackground === 'function') {
						audio.setExclusiveBackground(MusicType.MAIN);
					}
				} catch {}
				try { gameEventManager.emit(GameEventType.WIN_STOP); } catch {}
				try { scene.events.emit('resetSymbolsForBase'); } catch {}
				try { scene.events.emit('enableSymbols'); } catch {}
				baseSwitchedEarly = true;
			}});
			overlayActive = true;
		};

		const fadeOutOverlay = (callback?: () => void) => {
			if (!overlayActive || !this.endBlackOverlay || !scene?.tweens) {
				overlayActive = false;
				if (this.endBlackOverlay) {
					try { this.endBlackOverlay.setVisible(false); this.endBlackOverlay.setAlpha(0); } catch {}
				}
				callback && callback();
				return;
			}
			try { scene.tweens.killTweensOf(this.endBlackOverlay); } catch {}
			scene.tweens.add({
				targets: this.endBlackOverlay,
				alpha: 0,
				duration: Math.max(20, this.endBlackOverlayFadeOutMs),
				ease: 'Cubic.easeIn',
				onComplete: () => {
					try { this.endBlackOverlay?.setVisible(false); } catch {}
					overlayActive = false;
					callback && callback();
				}
			});
		};

		const complete = () => {
			try {
				const audio = (window as any).audioManager;
				if (audio && typeof audio.unlockMusic === 'function') audio.unlockMusic();
			} catch {}
			onDone && onDone();
		};

		const runTransition = () => {
			if (!ensureSpineFactory(scene, '[Dialogs] end fire transition factory')) {
				fadeOutOverlay(complete);
				return;
			}
			this.loadEndFireTransitionIfNeeded()
				.then((loaded) => {
					if (!loaded) {
						fadeOutOverlay(complete);
						return;
					}
					try {
						try {
							const audio = (window as any).audioManager;
							if (audio) {
								if (typeof audio.lockMusicTo === 'function') audio.lockMusicTo(MusicType.MAIN);
								if (typeof audio.stopAllMusic === 'function') audio.stopAllMusic();
							}
						} catch {}

						if (!this.endTransitionContainer) {
							this.endTransitionContainer = scene.add.container(0, 0);
							this.endTransitionContainer.setDepth(20000);
						}
					if (this.endBlackOverlay && this.endTransitionContainer && this.endBlackOverlay.parentContainer !== this.endTransitionContainer) {
						try { this.endTransitionContainer.add(this.endBlackOverlay); } catch {}
					}
						if (!this.endTransitionBg) {
						this.endTransitionBg = scene.add.rectangle(
								scene.cameras.main.width / 2,
								scene.cameras.main.height / 2,
								scene.cameras.main.width * 2,
								scene.cameras.main.height * 2,
							0x000000,
							1
							);
							this.endTransitionBg.setOrigin(0.5);
						this.endTransitionBg.setAlpha(1);
							try { this.endTransitionBg.setInteractive(); } catch {}
							this.endTransitionContainer.add(this.endTransitionBg);
						}
						if (this.endTransitionSpine) { try { this.endTransitionSpine.destroy(); } catch {} this.endTransitionSpine = null; }
						this.endTransitionSpine = (scene.add as any).spine(
							scene.cameras.main.width * 0.5,
							scene.cameras.main.height * 0.5,
							'fire_transition',
							'fire_transition_atlas'
						);
						try { this.endTransitionSpine.setOrigin(0.5, 0.5); } catch {}
					try { (this.endTransitionSpine as any).setDepth?.(1); } catch {}
					// Pin to camera space
					try { (this.endTransitionSpine as any).setScrollFactor?.(0); } catch {}
					try { this.endTransitionContainer?.setScrollFactor?.(0); } catch {}
					try { this.endTransitionBg?.setScrollFactor?.(0); } catch {}
					this.endTransitionContainer.add(this.endTransitionSpine);
						this.endTransitionContainer.setVisible(true);
						this.endTransitionContainer.setAlpha(1);
						try { scene.children.bringToTop(this.endTransitionContainer); } catch {}
					// Ensure layering inside the container: black overlay behind, fire spine on top
					try {
						if (this.endBlackOverlay) this.endTransitionContainer?.sendToBack(this.endBlackOverlay);
						if (this.endTransitionSpine) this.endTransitionContainer?.bringToTop(this.endTransitionSpine);
					} catch {}
					// Defer showing the endBlackOverlay until after the fire transition
				// Cover-fit scaling with slight overscan to avoid any gaps
				try {
					const w = scene.cameras.main.width;
					const h = scene.cameras.main.height;
					let bw = 0; let bh = 0;
					try {
						const b = (this.endTransitionSpine as any).getBounds?.();
						bw = (b && (b.size?.x || (b as any).width)) || 0;
						bh = (b && (b.size?.y || (b as any).height)) || 0;
					} catch {}
					if (!bw || !bh) { bw = (this.endTransitionSpine as any).displayWidth || 0; bh = (this.endTransitionSpine as any).displayHeight || 0; }
					if (bw > 0 && bh > 0) {
						const scaleToCover = Math.max(w / bw, h / bh) * 2.0;
						(this.endTransitionSpine as any).setScale(scaleToCover);
					}
				} catch {}
						// Play blaze SFX consistently with Fire_Transition
						try {
							const audio = (window as any).audioManager;
							if (audio && typeof audio.playSoundEffect === 'function') {
								audio.playSoundEffect('blaze_hh' as any);
							} else {
								try { (scene as any).sound?.play?.('blaze_hh'); } catch {}
							}
						} catch {}
						try { (this.endTransitionSpine as any).animationState.timeScale = Math.max(0.05, this.endFireTransitionTimeScale); } catch {}
					// Keep opaque mask behind spine to ensure no gaps

						let finished = false;
						let baseSwitched = false;
						const switchToBaseIfNeeded = () => {
							if (baseSwitched || baseSwitchedEarly) return;
							baseSwitched = true;
							try { scene.events.emit('setBonusMode', false); } catch {}
							try { scene.events.emit('hideBonusBackground'); } catch {}
							try { scene.events.emit('hideBonusHeader'); } catch {}
							try {
								const audio = (window as any).audioManager;
								if (audio && typeof audio.setExclusiveBackground === 'function') {
									audio.setExclusiveBackground(MusicType.MAIN);
								}
							} catch {}
							try {
								gameEventManager.emit(GameEventType.WIN_STOP);
								console.log('[Dialogs] Emitted WIN_STOP during end fire transition');
							} catch {}
							try { scene.events.emit('resetSymbolsForBase'); } catch {}
							try { scene.events.emit('enableSymbols'); } catch {}
						};

						const finish = () => {
							if (finished) return;
							finished = true;
							scene.tweens.add({
								targets: this.endTransitionContainer,
								alpha: 0,
								duration: 200,
								ease: 'Cubic.easeIn',
								onComplete: () => {
									try {
										this.endTransitionContainer?.setVisible(false);
										this.endTransitionContainer?.setAlpha(1);
										if (this.endTransitionSpine) { this.endTransitionSpine.destroy(); this.endTransitionSpine = null; }
										if (this.endTransitionBg) { this.endTransitionBg.setAlpha(0); }
									} catch {}
									const tail = Math.max(0, this.endBlackOverlayTailMs || 0);
							// Fade out blaze SFX as transition ends
							try {
								const audio = (window as any).audioManager;
								if (audio && typeof audio.fadeOutSfx === 'function') {
									audio.fadeOutSfx('blaze_hh' as any, 200);
								}
							} catch {}
							if (tail > 0) {
										scene.time.delayedCall(tail, () => fadeOutOverlay(complete));
									} else {
										fadeOutOverlay(complete);
									}
								}
							});
						};

						try {
						const startAnim = () => {
								const state = (this.endTransitionSpine as any).animationState;
								let entry: any = null;
								let played = false;
								try { entry = state.setAnimation(0, 'animation', false); played = true; } catch {}
								if (!played) {
									try {
										const anims = (this.endTransitionSpine as any)?.skeleton?.data?.animations || [];
										const first = anims[0]?.name;
										if (first) { entry = state.setAnimation(0, first, false); played = true; }
									} catch {}
								}
								try {
									const rawDurationSec = Math.max(0.1, entry?.animation?.duration || 1.2);
									const ratio = Math.min(0.95, Math.max(0.05, this.endFireTransitionMidTriggerRatio));
									const midDelayMs = Math.max(50, (rawDurationSec / Math.max(0.0001, this.endFireTransitionTimeScale)) * 1000 * ratio);
									scene.time.delayedCall(midDelayMs, switchToBaseIfNeeded);
								} catch {}
								try { state?.setListener?.({ complete: finish } as any); } catch {}
								// Fallback complete safety, include lead time
								scene.time.delayedCall(Math.max(1200, this.endBlackOverlayLeadMs + 1200), finish);
							};
							const lead = Math.max(0, this.endBlackOverlayLeadMs || 0);
							if (lead > 0) {
								scene.time.delayedCall(lead, startAnim);
							} else {
								startAnim();
							}
						} catch {
							switchToBaseIfNeeded();
							fadeOutOverlay(complete);
						}
					} catch {
						fadeOutOverlay(complete);
					}
				})
				.catch(() => fadeOutOverlay(complete));
		};

		runTransition();
	}

	/**
	 * Flow requested: Fade to black → switch to base under cover → fade black out → play fire (no mask) → done.
	 */
	private playBlackCoverThenBaseThenFire(scene: Scene, onDone?: () => void): void {
		// Ensure container and black overlay exist
		if (!this.endTransitionContainer) {
			this.endTransitionContainer = scene.add.container(0, 0);
			this.endTransitionContainer.setDepth(20000);
		}
		if (!this.endBlackOverlay) {
			this.endBlackOverlay = scene.add.rectangle(
				scene.scale.width * 0.5,
				scene.scale.height * 0.5,
				scene.scale.width * 2,
				scene.scale.height * 2,
				0x000000,
				1
			);
			this.endBlackOverlay.setOrigin(0.5);
			this.endBlackOverlay.setAlpha(0);
			try { this.endTransitionContainer.add(this.endBlackOverlay); } catch {}
		}
		try {
			if (this.endBlackOverlay.parentContainer !== this.endTransitionContainer) {
				this.endTransitionContainer.add(this.endBlackOverlay);
			}
		} catch {}
		this.endTransitionContainer.setVisible(true);
		try { scene.children.bringToTop(this.endTransitionContainer); } catch {}
		try { scene.tweens.killTweensOf(this.endBlackOverlay); } catch {}
		this.endBlackOverlay.setVisible(true);
		this.endBlackOverlay.setAlpha(0);
		// 1) Fade in to black
		scene.tweens.add({
			targets: this.endBlackOverlay,
			alpha: 1,
			duration: 350,
			ease: 'Cubic.easeOut',
			onComplete: () => {
				// Small extra wait to ensure draw cycle finishes at full black
				scene.time.delayedCall(Math.max(1, this.blackCoverPreCleanupDelayMs), () => {
					// 2) Under full black, cleanup congrats and switch to base visuals/music (embers will run post-fire)
					try { this.cleanupDialog(); } catch {}
					try { scene.events.emit('setBonusMode', false); } catch {}
					try { scene.events.emit('hideBonusBackground'); } catch {}
					try { scene.events.emit('hideBonusHeader'); } catch {}
					try {
						const audio = (window as any).audioManager;
						if (audio && typeof audio.setExclusiveBackground === 'function') {
							audio.setExclusiveBackground(MusicType.MAIN);
						}
					} catch {}
					try { gameEventManager.emit(GameEventType.WIN_STOP); } catch {}
					try { scene.events.emit('resetSymbolsForBase'); } catch {}
					try { scene.events.emit('enableSymbols'); } catch {}
					// Allow systems to settle under cover
					scene.time.delayedCall(Math.max(1, this.postSwitchSettleMs), () => {
						// 3) Start fire (still fully black) and fade black out over 0.5s simultaneously
						this.playFireTransitionNoMask(scene, () => {
							// Fire ended: embers will run for 2s from playFireTransitionNoMask, then container will be hidden
							try { this.endBlackOverlay!.setVisible(false); } catch {}
							onDone && onDone();
						});
						scene.tweens.add({ targets: this.endBlackOverlay!, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
					});
				});
			}
		});
	}

	// ========= Embers anticipation helpers =========
	private startEmbers(scene: Scene): void {
		try {
			if (!this.endTransitionContainer) {
				this.endTransitionContainer = scene.add.container(0, 0);
				this.endTransitionContainer.setDepth(20000);
			}
			if (this.embersContainer) { try { this.embersContainer.destroy(true); } catch {} this.embersContainer = null; }
			this.embersContainer = scene.add.container(0, 0);
			this.embersContainer.setAlpha(0);
			scene.tweens.add({ targets: this.embersContainer, alpha: 1, duration: 220, ease: 'Cubic.easeOut' });
			try { this.endTransitionContainer.add(this.embersContainer); } catch {}
			// Reset particles and start update loop
			this.emberParticles = [];
			if (this.emberUpdateHandler) { try { scene.events.off('update', this.emberUpdateHandler); } catch {} this.emberUpdateHandler = null; }
			this.emberUpdateHandler = (_t: number, d: number) => this.updateEmbers(scene, d);
			scene.events.on('update', this.emberUpdateHandler);
			// Spawn loop
			if (this.embersSpawnTimer) { try { this.embersSpawnTimer.remove(false); } catch {} this.embersSpawnTimer = null; }
			this.embersSpawnTimer = scene.time.addEvent({ delay: 90, loop: true, callback: () => this.spawnOneEmber(scene) });
			// Bring layering: black at back, embers in middle, fire on top later
			try {
				if (this.endBlackOverlay) this.endTransitionContainer?.sendToBack(this.endBlackOverlay);
				this.endTransitionContainer?.bringToTop(this.embersContainer!);
			} catch {}
		} catch {}
	}

	private stopEmbers(): void {
		try {
			if (this.embersSpawnTimer) { this.embersSpawnTimer.remove(false); this.embersSpawnTimer = null; }
			if (this.emberUpdateHandler && this.currentScene) { try { this.currentScene.events.off('update', this.emberUpdateHandler); } catch {} this.emberUpdateHandler = null; }
			if (this.embersContainer) {
				const cont = this.embersContainer;
				this.currentScene?.tweens.add({
					targets: cont,
					alpha: 0,
					duration: 300,
					ease: 'Cubic.easeOut',
					onComplete: () => {
						try { cont.getAll().forEach((child: any) => { try { child.destroy(); } catch {} }); } catch {}
						try { cont.destroy(true); } catch {}
						this.embersContainer = null;
					}
				});
			}
		} catch {}
	}

private spawnOneEmber(scene: Scene): void {
    try {
        if (!this.embersContainer) return;
        const w = scene.cameras.main.width;
        const h = scene.cameras.main.height;
        const g = scene.add.graphics();
        this.embersContainer.add(g);
        // Start near bottom, rising up across the whole screen
        const x = Math.random() * w;
        const y = h + 30 + Math.random() * 40;
        // Bigger embers for anticipation
        const size = Math.random() * 2.5 + 3.0;
        const colors = [0xffd700, 0xffe04a, 0xfff0a0, 0xffc107];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const alpha = Math.random() * 0.5 + 0.4;
        // Longer life so they traverse screen
        const lifetime = 1800 + Math.random() * 1200; // 1.8s – 3.0s
        const totalFramesAt60 = lifetime / (1000 / 60);
        const vy = -(h + 60) / Math.max(1, totalFramesAt60); // reach above top by end of life
        const vx = (Math.random() - 0.5) * 0.9; // gentle horizontal drift
        const particle = { graphics: g, x, y, vx, vy, size, color, alpha, lifetime, age: 0 };
        this.emberParticles.push(particle);
        this.drawEmberParticle(particle);
    } catch {}
}

private drawEmberParticle(p: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; size: number; color: number; alpha: number; }): void {
    const { graphics, x, y, size, color, alpha } = p;
    graphics.clear();
    const w = size * (Math.random() * 0.8 + 0.6);
    const h = size * (Math.random() * 1.2 + 0.8);
    graphics.fillStyle(color, alpha * 0.10); graphics.fillEllipse(x, y, w * 3.0, h * 3.0);
    graphics.fillStyle(color, alpha * 0.20); graphics.fillEllipse(x, y, w * 2.2, h * 2.2);
    graphics.fillStyle(color, alpha * 0.40); graphics.fillEllipse(x, y, w * 1.5, h * 1.5);
    graphics.fillStyle(color, alpha * 0.70); graphics.fillEllipse(x, y, w * 0.8, h * 0.8);
    graphics.fillStyle(0xffffaa, alpha * 0.30); graphics.fillEllipse(x, y, w * 0.35, h * 0.35);
}

private updateEmbers(scene: Scene, delta: number): void {
    // Move, age, fade
    for (let i = this.emberParticles.length - 1; i >= 0; i--) {
        const p = this.emberParticles[i];
        p.age += delta;
        if (p.age >= p.lifetime) {
            try { p.graphics.destroy(); } catch {}
            this.emberParticles.splice(i, 1);
            continue;
        }
        // Integrate (scale velocities by delta vs 60fps)
        const dt = delta / (1000 / 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Fade by age
        const ageRatio = p.age / p.lifetime;
        p.alpha = Math.max(0.05, 1 - ageRatio);
        this.drawEmberParticle(p);
    }
}

	/** Play the fire transition overlay without internal black mask. */
	private playFireTransitionNoMask(scene: Scene, onDone?: () => void): void {
		if (!ensureSpineFactory(scene, '[Dialogs] fire transition (no mask)')) { onDone && onDone(); return; }
		this.loadEndFireTransitionIfNeeded().then((loaded) => {
			if (!loaded) { onDone && onDone(); return; }
			try {
				if (!this.endTransitionContainer) {
					this.endTransitionContainer = scene.add.container(0, 0);
					this.endTransitionContainer.setDepth(20000);
				}
				// Ensure any background mask is hidden
				if (this.endTransitionBg) { try { this.endTransitionBg.setAlpha(0); this.endTransitionBg.setVisible(false); } catch {} }
				if (this.endTransitionSpine) { try { this.endTransitionSpine.destroy(); } catch {} this.endTransitionSpine = null; }
				this.endTransitionSpine = (scene.add as any).spine(
					scene.cameras.main.width * 0.5,
					scene.cameras.main.height * 0.5,
					'fire_transition',
					'fire_transition_atlas'
				);
				try { this.endTransitionSpine.setOrigin(0.5, 0.5); } catch {}
				try { (this.endTransitionSpine as any).setDepth?.(1); } catch {}
				try { (this.endTransitionSpine as any).setScrollFactor?.(0); } catch {}
				try { this.endTransitionContainer?.setScrollFactor?.(0); } catch {}
				this.endTransitionContainer.add(this.endTransitionSpine);
				this.endTransitionContainer.setVisible(true);
				this.endTransitionContainer.setAlpha(1);
				try { scene.children.bringToTop(this.endTransitionContainer); } catch {}
				// Cover-fit
				try {
					const w = scene.cameras.main.width; const h = scene.cameras.main.height;
					let bw = 0, bh = 0;
					try { const b = (this.endTransitionSpine as any).getBounds?.(); bw = (b && (b.size?.x || (b as any).width)) || 0; bh = (b && (b.size?.y || (b as any).height)) || 0; } catch {}
					if (!bw || !bh) { bw = (this.endTransitionSpine as any).displayWidth || 0; bh = (this.endTransitionSpine as any).displayHeight || 0; }
					if (bw > 0 && bh > 0) { (this.endTransitionSpine as any).setScale(Math.max(w / bw, h / bh) * 2.0); }
				} catch {}
                try { (this.endTransitionSpine as any).animationState.timeScale = Math.max(0.05, this.endFireTransitionTimeScale); } catch {}
                // Play blaze SFX consistently with Fire_Transition (no-mask variant)
                try {
                    const audio = (window as any).audioManager;
                    if (audio && typeof audio.playSoundEffect === 'function') {
                        audio.playSoundEffect('blaze_hh' as any);
                    } else {
                        try { (scene as any).sound?.play?.('blaze_hh'); } catch {}
                    }
                } catch {}
				let finished = false;
				const finish = () => {
					if (finished) return; finished = true;
                    // Fade out blaze SFX as transition ends (no-mask variant)
                    try {
                        const audio = (window as any).audioManager;
                        if (audio && typeof audio.fadeOutSfx === 'function') {
                            audio.fadeOutSfx('blaze_hh' as any, 200);
                        }
                    } catch {}
					// Remove fire and clean up immediately (embers removed)
					try { if (this.endTransitionSpine) { this.endTransitionSpine.destroy(); this.endTransitionSpine = null; } } catch {}
					try { this.endTransitionContainer?.setVisible(false); this.endTransitionContainer?.setAlpha(1); } catch {}
					onDone && onDone();
				};
				try {
					const state = (this.endTransitionSpine as any).animationState;
					let entry: any = null; let played = false;
					try { entry = state.setAnimation(0, 'animation', false); played = true; } catch {}
					if (!played) {
						try { const anims = (this.endTransitionSpine as any)?.skeleton?.data?.animations || []; const first = anims[0]?.name; if (first) { entry = state.setAnimation(0, first, false); played = true; } } catch {}
					}
					try { state?.setListener?.({ complete: finish } as any); } catch {}
					scene.time.delayedCall(1200, finish);
				} catch { finish(); }
			} catch { onDone && onDone(); }
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
		
		// Fade out all elements together
		scene.tweens.add({
			targets: fadeOutTargets,
			alpha: 0,
			duration: 500,
			ease: 'Power2',
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
		
		// Remove the separate Spine tween to avoid timing conflicts
		// The main tween should handle all elements including the Spine animation
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
	private shouldTriggerBonusMode(): boolean { return false; }

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
		
		// Clean up congrats-specific extras if present
		if (this.congratsBgImage) {
			try { this.congratsBgImage.destroy(); } catch {}
			this.congratsBgImage = null;
		}
		if (this.congratsCharSpine) {
			try { this.congratsCharSpine.destroy(); } catch {}
			this.congratsCharSpine = null;
		}
		if (this.dialogBackgroundContainer) {
			try { this.dialogBackgroundContainer.removeAll(true); } catch {}
		}
		if (this.dialogCharacterContainer) {
			try { this.dialogCharacterContainer.removeAll(true); } catch {}
			// Also clear nested container references to avoid stale pointers
			this.congratsCharRoot = null;
			this.congratsCharOffsetContainer = null;
			this.congratsCharScaleContainer = null;
		}
		// Destroy title image if present
		if (this.congratsWinTitleImage) {
			try { this.congratsWinTitleImage.destroy(); } catch {}
			this.congratsWinTitleImage = null;
		}
		if (this.congratsFireSpine) {
			try { this.congratsFireSpine.destroy(); } catch {}
			this.congratsFireSpine = null;
		}
		
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
		this.numberDisplayRef = null;
		
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
	 * Check if congrats dialog is currently showing
	 */
	isCongratsShowing(): boolean {
		return this.isDialogActive && this.currentDialogType === 'Congrats';
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
		
		// Re-apply background cover scaling and positions on resize
		if (this.congratsBgImage) {
			const centerX = scene.scale.width * 0.5;
			const centerY = scene.scale.height * 0.5;
			const coverScaleX = scene.scale.width / Math.max(1, this.congratsBgImage.width);
			const coverScaleY = scene.scale.height / Math.max(1, this.congratsBgImage.height);
			const coverScale = Math.max(coverScaleX, coverScaleY) * Math.max(0.05, this.congratsBgScale);
			this.congratsBgImage.setScale(coverScale);
			this.congratsBgImage.x = centerX + this.congratsBgOffsetX;
			this.congratsBgImage.y = centerY + this.congratsBgOffsetY;
		}
		// Reposition title image on resize
		if (this.congratsWinTitleImage) {
			const centerX = scene.scale.width * 0.5;
			const centerY = scene.scale.height * 0.5;
			this.congratsWinTitleImage.x = centerX + this.congratsWinTitleOffsetX;
			this.congratsWinTitleImage.y = centerY + this.congratsWinTitleOffsetY;
		}
		if (this.congratsCharSpine) {
			const baseX = (typeof this.congratsCharX === 'number' && isFinite(this.congratsCharX)) ? this.congratsCharX : scene.scale.width * 0.5;
			const baseY = (typeof this.congratsCharY === 'number' && isFinite(this.congratsCharY)) ? this.congratsCharY : scene.scale.height * 0.5;
			if (this.congratsCharRoot) { this.congratsCharRoot.x = baseX; this.congratsCharRoot.y = baseY; }
			if (this.congratsCharOffsetContainer) { this.congratsCharOffsetContainer.x = (this.congratsCharOffsetX || 0); this.congratsCharOffsetContainer.y = (this.congratsCharOffsetY || 0); }
			if (this.congratsCharScaleContainer) { this.congratsCharScaleContainer.setScale(Math.max(0.05, this.congratsCharScale)); }
		}
		// Reposition continue text on resize
		if (this.continueText) {
			this.continueText.x = scene.scale.width / 2 + this.continueTextOffsetX;
			this.continueText.y = scene.scale.height / 2 + this.continueTextOffsetY;
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
		
	// Public modifiers for Congrats extras
	public setStartFireBlackHoldMs(ms: number): void {
		this.startFireBlackHoldMs = Math.max(0, ms | 0);
	}

	public setCongratsNumberSpeed(speedMul: number): void {
		this.congratsNumberSpeedMul = Math.max(0.05, speedMul);
	}
	public setEndBlackOverlayTiming(opts: { fadeInMs?: number; holdMs?: number; fadeOutMs?: number; leadMs?: number; tailMs?: number }): void {
		if (opts.fadeInMs !== undefined) this.endBlackOverlayFadeInMs = Math.max(20, opts.fadeInMs);
		if (opts.holdMs !== undefined) this.endBlackOverlayHoldMs = Math.max(0, opts.holdMs);
		if (opts.fadeOutMs !== undefined) this.endBlackOverlayFadeOutMs = Math.max(20, opts.fadeOutMs);
		if (opts.leadMs !== undefined) this.endBlackOverlayLeadMs = Math.max(0, opts.leadMs);
		if (opts.tailMs !== undefined) this.endBlackOverlayTailMs = Math.max(0, opts.tailMs);
		console.log('[Dialogs] Updated end black overlay timing:', {
			fadeInMs: this.endBlackOverlayFadeInMs,
			holdMs: this.endBlackOverlayHoldMs,
			fadeOutMs: this.endBlackOverlayFadeOutMs,
			leadMs: this.endBlackOverlayLeadMs,
			tailMs: this.endBlackOverlayTailMs
		});
	}
	public setCongratsBgOptions(opts: { scale?: number; offsetX?: number; offsetY?: number }): void {
		if (opts.scale !== undefined) this.congratsBgScale = Math.max(0.05, opts.scale);
		if (opts.offsetX !== undefined) this.congratsBgOffsetX = opts.offsetX;
		if (opts.offsetY !== undefined) this.congratsBgOffsetY = opts.offsetY;
		// Apply live if image exists
		if (this.currentScene && this.congratsBgImage) {
			const coverScaleX = this.currentScene.scale.width / Math.max(1, this.congratsBgImage.width);
			const coverScaleY = this.currentScene.scale.height / Math.max(1, this.congratsBgImage.height);
			const coverScale = Math.max(coverScaleX, coverScaleY) * Math.max(0.05, this.congratsBgScale);
			this.congratsBgImage.setScale(coverScale);
			this.congratsBgImage.x = this.currentScene.scale.width * 0.5 + this.congratsBgOffsetX;
			this.congratsBgImage.y = this.currentScene.scale.height * 0.5 + this.congratsBgOffsetY;
		}
	}

	public setCongratsNumberSpacing(spacing: number): void {
		if (!this.numberDisplayRef) return;
		try {
			(this.numberDisplayRef as any).updateConfig({ spacing });
			console.log('[Dialogs] Updated congrats number spacing to', spacing);
		} catch (e) {
			console.warn('[Dialogs] Failed to update number spacing:', e);
		}
	}

	public setCongratsTitleOptions(opts: { offsetX?: number; offsetY?: number; scale?: number; durationMs?: number }): void {
		if (opts.offsetX !== undefined) this.congratsWinTitleOffsetX = opts.offsetX;
		if (opts.offsetY !== undefined) this.congratsWinTitleOffsetY = opts.offsetY;
		if (opts.scale !== undefined) this.congratsWinTitleScale = Math.max(0.05, opts.scale);
		if (opts.durationMs !== undefined) this.congratsWinTitleBreathDurationMs = Math.max(100, opts.durationMs);
		if (this.currentScene && this.congratsWinTitleImage) {
			const centerX = this.currentScene.scale.width * 0.5;
			const centerY = this.currentScene.scale.height * 0.5;
			this.congratsWinTitleImage.x = centerX + this.congratsWinTitleOffsetX;
			this.congratsWinTitleImage.y = centerY + this.congratsWinTitleOffsetY;
			this.congratsWinTitleImage.setScale(Math.max(0.05, this.congratsWinTitleScale));
			// Rebuild tween with new speed if provided
			if (this.congratsWinTitleTween) { try { this.congratsWinTitleTween.stop(); } catch {} this.congratsWinTitleTween = null; }
			this.congratsWinTitleTween = this.currentScene.tweens.add({
				targets: this.congratsWinTitleImage,
				scaleX: this.congratsWinTitleImage.scaleX * 1.045,
				scaleY: this.congratsWinTitleImage.scaleY * 1.045,
				duration: Math.max(100, this.congratsWinTitleBreathDurationMs),
				ease: 'Sine.inOut',
				yoyo: true,
				repeat: -1
			});
		}
	}

	public setCongratsFireOptions(opts: { offsetX?: number; offsetY?: number; scale?: number; timeScale?: number; anim?: string }): void {
		if (opts.offsetX !== undefined) this.congratsFireOffsetX = opts.offsetX;
		if (opts.offsetY !== undefined) this.congratsFireOffsetY = opts.offsetY;
		if (opts.scale !== undefined) this.congratsFireScale = Math.max(0.05, opts.scale);
		if (opts.timeScale !== undefined) this.congratsFireTimeScale = Math.max(0.0001, opts.timeScale);
		if (opts.anim !== undefined) this.congratsFireAnimName = opts.anim || 'animation';
		if (this.currentScene && this.congratsFireSpine) {
			try { this.congratsFireSpine.x = this.currentScene.scale.width * 0.5 + this.congratsFireOffsetX; } catch {}
			try { this.congratsFireSpine.y = this.currentScene.scale.height * 0.5 + this.congratsFireOffsetY; } catch {}
			try { this.congratsFireSpine.setScale(Math.max(0.05, this.congratsFireScale)); } catch {}
			try { this.congratsFireSpine.animationState.timeScale = Math.max(0.0001, this.congratsFireTimeScale); } catch {}
			try { if (opts.anim) this.congratsFireSpine.animationState.setAnimation(0, this.congratsFireAnimName, true); } catch {}
		}
	}

    public setCongratsCharacterOptions(opts: { x?: number; y?: number; offsetX?: number; offsetY?: number; scale?: number; timeScale?: number }): void {
        if (opts.x !== undefined) this.congratsCharX = opts.x;
        if (opts.y !== undefined) this.congratsCharY = opts.y;
        if (opts.offsetX !== undefined) this.congratsCharOffsetX = opts.offsetX;
        if (opts.offsetY !== undefined) this.congratsCharOffsetY = opts.offsetY;
        if (opts.scale !== undefined) this.congratsCharScale = Math.max(0.05, opts.scale);
        if (opts.timeScale !== undefined) this.congratsCharTimeScale = Math.max(0.0001, opts.timeScale);
        if (this.currentScene && this.congratsCharSpine) {
            const baseX = (typeof this.congratsCharX === 'number' && isFinite(this.congratsCharX)) ? this.congratsCharX : this.currentScene.scale.width * 0.5;
            const baseY = (typeof this.congratsCharY === 'number' && isFinite(this.congratsCharY)) ? this.congratsCharY : this.currentScene.scale.height * 0.5;
            if (this.congratsCharRoot) { this.congratsCharRoot.x = baseX; this.congratsCharRoot.y = baseY; }
            if (this.congratsCharOffsetContainer) { this.congratsCharOffsetContainer.x = (this.congratsCharOffsetX || 0); this.congratsCharOffsetContainer.y = (this.congratsCharOffsetY || 0); }
            if (this.congratsCharScaleContainer) { this.congratsCharScaleContainer.setScale(Math.max(0.05, this.congratsCharScale)); }
            try { this.congratsCharSpine.animationState.timeScale = Math.max(0.0001, this.congratsCharTimeScale); } catch {}
        }
    }

    /** Convenience: set only offset for congrats character. */
	public setCongratsCharacterOffset(opts: { offsetX?: number; offsetY?: number }): void {
        if (opts.offsetX !== undefined) this.congratsCharOffsetX = opts.offsetX;
        if (opts.offsetY !== undefined) this.congratsCharOffsetY = opts.offsetY;
        if (this.currentScene && this.congratsCharSpine) {
            const baseX = (typeof this.congratsCharX === 'number' && isFinite(this.congratsCharX)) ? this.congratsCharX : this.currentScene.scale.width * 0.5;
            const baseY = (typeof this.congratsCharY === 'number' && isFinite(this.congratsCharY)) ? this.congratsCharY : this.currentScene.scale.height * 0.5;
            if (this.congratsCharRoot) { this.congratsCharRoot.x = baseX; this.congratsCharRoot.y = baseY; }
            if (this.congratsCharOffsetContainer) { this.congratsCharOffsetContainer.x = (this.congratsCharOffsetX || 0); this.congratsCharOffsetContainer.y = (this.congratsCharOffsetY || 0); }
        }
    }

    /** Set offset position for continue text. */
    public setContinueTextOffset(offsetX: number = 0, offsetY: number = 300): void {
        this.continueTextOffsetX = offsetX;
        this.continueTextOffsetY = offsetY;
        if (this.currentScene && this.continueText) {
            this.continueText.x = this.currentScene.scale.width / 2 + this.continueTextOffsetX;
            this.continueText.y = this.currentScene.scale.height / 2 + this.continueTextOffsetY;
        }
    }
		
	/** Entering Congrats with new flow: fade to black → build Congrats under cover → fade out with fire + embers. */
	private playEnterFireTransitionThen(next: () => void): void {
		const scene = this.currentScene;
		if (!scene || !ensureSpineFactory(scene, '[Dialogs] enter fire transition')) { next(); return; }
		this.loadEndFireTransitionIfNeeded().then((loaded) => {
			if (!loaded) { next(); return; }
			try {
				if (!this.endTransitionContainer) {
					this.endTransitionContainer = scene.add.container(0, 0);
					this.endTransitionContainer.setDepth(20000);
				}
				if (!this.endBlackOverlay) {
					this.endBlackOverlay = scene.add.rectangle(
						scene.scale.width * 0.5,
						scene.scale.height * 0.5,
						scene.scale.width * 2,
						scene.scale.height * 2,
						0x000000,
						1
					);
					this.endBlackOverlay.setOrigin(0.5);
					this.endBlackOverlay.setAlpha(0);
					try { this.endTransitionContainer.add(this.endBlackOverlay); } catch {}
				} else {
					try {
						if (this.endBlackOverlay.parentContainer !== this.endTransitionContainer) {
							this.endTransitionContainer.add(this.endBlackOverlay);
						}
					} catch {}
				}
				this.endTransitionContainer.setVisible(true);
				try { scene.children.bringToTop(this.endTransitionContainer!); } catch {}
				try { scene.tweens.killTweensOf(this.endBlackOverlay); } catch {}
				this.endBlackOverlay.setVisible(true);
				this.endBlackOverlay.setAlpha(0);

				// Fade to black (0.35s)
				scene.tweens.add({
					targets: this.endBlackOverlay!,
					alpha: 1,
					duration: 350,
					ease: 'Cubic.easeOut',
					onComplete: () => {
						// small wait to ensure full black is painted
						scene.time.delayedCall(Math.max(1, this.blackCoverPreCleanupDelayMs), () => {
							// build Congrats under cover
							try { next(); } catch {}
							// settle
							scene.time.delayedCall(Math.max(1, this.postSwitchSettleMs), () => {
								// start fire (no mask) and fade black out over 0.5s
							this.playFireTransitionNoMask(scene, () => {
								try { this.endBlackOverlay!.setVisible(false); } catch {}
								try { scene.events.emit('preCongratsMaskGone'); } catch {}
							});
								scene.tweens.add({ targets: this.endBlackOverlay!, alpha: 0, duration: 500, ease: 'Cubic.easeOut' });
							});
						});
					}
				});
			} catch {
				next();
			}
		});
	}

	// Convenience methods for specific dialog types
	showCongrats(scene: Scene, config?: Partial<DialogConfig>): void {
		// New flow: fade to black → build Congrats under cover → fade out with fire + embers
		this.playEnterFireTransitionThen(() => {
			this.showDialog(scene, { type: 'Congrats', ...config });
		});
	}

// Removed: FreeSpinDialog_KA is no longer used in the project

showLargeWin(scene: Scene, config?: Partial<DialogConfig>): void {
		// Redirect Large Win to Super Win overlay
		try {
			const amount = (config as any)?.winAmount ?? 0;
			const overlay = (scene as any)?.superWinOverlay;
			const mgr = (scene as any)?.winOverlayManager;
			if (mgr && typeof mgr.enqueueShow === 'function') {
				mgr.enqueueShow('super', amount);
				return;
			}
			if (overlay && typeof overlay.show === 'function') {
				overlay.show(amount);
				return;
			}
		} catch {}
		try { console.warn('[Dialogs] LargeW_KA replaced. SuperWinOverlay unavailable; skipping.'); } catch {}
		}
		
showMediumWin(scene: Scene, config?: Partial<DialogConfig>): void {
		// Redirect Medium Win to Mega Win overlay
		try {
			const amount = (config as any)?.winAmount ?? 0;
			const overlay = (scene as any)?.megaWinOverlay;
			const mgr = (scene as any)?.winOverlayManager;
			if (mgr && typeof mgr.enqueueShow === 'function') {
				mgr.enqueueShow('mega', amount);
				return;
			}
			if (overlay && typeof overlay.show === 'function') {
				overlay.show(amount);
				return;
			}
		} catch {}
		try { console.warn('[Dialogs] MediumW_KA replaced. MegaWinOverlay unavailable; skipping.'); } catch {}
		}

showSmallWin(scene: Scene, config?: Partial<DialogConfig>): void {
		// Redirect Small Win to Big Win overlay; legacy SmallW_KA replaced
		try {
			const amount = (config as any)?.winAmount ?? 0;
			const overlay = (scene as any)?.bigWinOverlay;
			const mgr = (scene as any)?.winOverlayManager;
			if (mgr && typeof mgr.enqueueShow === 'function') {
				mgr.enqueueShow('big', amount);
				return;
			}
			if (overlay && typeof overlay.show === 'function') {
				overlay.show(amount);
				return;
			}
		} catch {}
		try { console.warn('[Dialogs] SmallW_KA replaced. BigWinOverlay unavailable; skipping.'); } catch {}
		}

showSuperWin(scene: Scene, config?: Partial<DialogConfig>): void {
		// Redirect Super Win to Epic Win overlay
		try {
			const amount = (config as any)?.winAmount ?? 0;
			const overlay = (scene as any)?.epicWinOverlay;
			const mgr = (scene as any)?.winOverlayManager;
			if (mgr && typeof mgr.enqueueShow === 'function') {
				mgr.enqueueShow('epic', amount);
				return;
			}
			if (overlay && typeof overlay.show === 'function') {
				overlay.show(amount);
				return;
			}
		} catch {}
		try { console.warn('[Dialogs] SuperW_KA replaced. EpicWinOverlay unavailable; skipping.'); } catch {}
	}
}

