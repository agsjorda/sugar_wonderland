// BackendEvent import removed - no longer needed in this file


export class GameData {
	static WIN_UP_HEIGHT: number = 50;

  public isAutoPlaying: boolean = false;
  public isShowingWinlines: boolean = false; // Track if winline animations are playing
	public isTurbo: boolean = false;
	public isReelSpinning: boolean = false;
	public isEnhancedBet: boolean = false; // Track amplify bet toggle state
	public winUpHeight: number = GameData.WIN_UP_HEIGHT;
	public winUpDuration: number = 0;
	public dropDuration: number = 0;
	public dropReelsDelay: number = 0;
	public dropReelsDuration: number = 0;

	public constructor() {
		setSpeed(this, 1.0);
	}
}

export function setSpeed(data: GameData, DELAY_BETWEEN_SPINS: number) {
	data.winUpDuration = DELAY_BETWEEN_SPINS * 0.1;
	data.dropDuration = DELAY_BETWEEN_SPINS * 0.4;
	data.dropReelsDelay = DELAY_BETWEEN_SPINS * 0.1;
	data.dropReelsDuration = DELAY_BETWEEN_SPINS * 0.4;
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