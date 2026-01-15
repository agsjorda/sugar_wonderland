// BackendEvent import removed - no longer needed in this file

import type { ImageShinePipelineData } from '../shaders/ImageShinePipeline';


export class GameData {
	static WIN_UP_HEIGHT: number = 75;

	/**
	 * FX preset: Shine shader config shared by Header logos.
	 * Note: `startYPx` is intentionally not included because it depends on the final displayHeight.
	 */
	public static readonly LOGO_SHINE_SHADER_CONFIG: Readonly<ImageShinePipelineData> = {
		// Movement direction (object pixel space)
		moveDirX: 1,
		moveDirY: 0,

		// Stripe direction angle (degrees)
		stripeAngleDeg: 120,

		// Band shape (px)
		thicknessPx: 20,
		softnessPx: 20,

		// Speed (px/sec)
		speedPxPerSec: 220,

		// Delay after sweep finishes (sec)
		repeatDelaySec: 1.0,

		// Start point (px) - X is fixed; Y is derived at call site
		startXPx: -40,

		// Strength
		intensity: 0.65,
		color: { r: 1, g: 1, b: 1 },
	};

  	public isAutoPlaying: boolean = false;
  	public isShowingWinlines: boolean = false; // Track if winline animations are playing
	public isTurbo: boolean = false;
	public isReelSpinning: boolean = false;
	public isEnhancedBet: boolean = false; // Track amplify bet toggle state
	// Number of extra free spins awarded when scatters retrigger during bonus
	public bonusRetriggerFreeSpins: number = 5;
	public winUpHeight: number = GameData.WIN_UP_HEIGHT;
	public winUpDuration: number = 0;
	public dropDuration: number = 0;
	public dropReelsDelay: number = 0;
	public dropReelsDuration: number = 0;
	public compressionDelayMultiplier: number = 0.5;

	// Drop overshoot/settle tuning (used by Symbols.ts drop tweens)
	// If null/undefined, Symbols.ts will use its built-in defaults.
	public dropOvershootPx: number | null = 25;
	public dropOvershootFallFraction: number | null = 0.6; // 0..1 (portion of time spent falling into the overshoot)
	public tumbleDropOvershootPx: number | null = 25;
	public tumbleDropOvershootFallFraction: number | null = 0.6; // 0..1
	// Compression overshoot/settle tuning (used by Symbols.ts compression tweens)
	public compressionOvershootPx: number | null = 10; // overshoot distance in pixels
	public compressionOvershootFallFraction: number | null = 0.4; // 0..1 (portion of time spent falling into the overshoot)
	// Tumble-only timing controls (do not affect global spin timings)
	public tumbleStaggerMs: number = 200; // base stagger used by tumble sequences
	public tumbleDropStaggerMs: number | null = null; // if null, defaults to tumbleStaggerMs * 0.25
	public tumbleDropStartDelayMs: number = 50; // additional start delay before dropping ins (post-compression)
	public tumbleSkipPreHop: boolean = false; // if true, skip pre-hop and start falling immediately
	public tumbleOverlapDropsDuringCompression: boolean = true; // if true, start drops while compression tweens are running

	// Camera shake on column drop
	public dropShakeMagnitude: number = 1.5; // 0 disables shake; typical values ~0.002 - 0.01
	public dropShakeDurationMs: number = 150; // duration per shake event
	public dropShakeAxis: 'both' | 'x' | 'y' = 'both'; // restrict shake to one dimension if needed
	public bigWinThreshold: number = 20;
	public megaWinThreshold: number = 30;
	public epicWinThreshold: number = 45;
	public superWinThreshold: number = 60;
	public constructor() {
		setSpeed(this, 1.0);
	}
}

import { DROP_REEL_START_INTERVAL_RATIO } from '../../config/GameConfig';

// Global time multiplier for symbol drop and reset animations
// Lower than 1.0 = faster; higher than 1.0 = slower
export const DROP_RESET_TIME_MULTIPLIER: number = 1.0;

export function setSpeed(data: GameData, DELAY_BETWEEN_SPINS: number) {
	// Apply global multiplier to win-up (reset) and drop durations
	data.winUpDuration = DELAY_BETWEEN_SPINS * 0.05 * DROP_RESET_TIME_MULTIPLIER;
	data.dropDuration = DELAY_BETWEEN_SPINS * 0.4 * DROP_RESET_TIME_MULTIPLIER;
    data.dropReelsDelay = DELAY_BETWEEN_SPINS * 0.2 * DROP_REEL_START_INTERVAL_RATIO;
	data.dropReelsDuration = DELAY_BETWEEN_SPINS * 0.5 * DROP_RESET_TIME_MULTIPLIER;
}

export function gameSpin(data: GameData) {
	// This function is deprecated - use GameStateManager.isReelSpinning instead
	// The spinning state is now managed centrally by GameStateManager
	console.warn('[GameData] gameSpin function is deprecated - use GameStateManager.isReelSpinning instead');
}

export function isWinlinesShowing(data: GameData): boolean {
	return data.isShowingWinlines;
}

export function pauseAutoplayForWinlines(data: GameData): void {
	data.isShowingWinlines = true;
	console.log('[GameData] Autoplay paused for winline animations');
}

export function resumeAutoplayAfterWinlines(data: GameData): void {
	data.isShowingWinlines = false;
	console.log('[GameData] Autoplay resumed after winline animations');
}