import { BackendEvent, BackendEvents } from "../../tmp_backend/BackendEvent";


export class GameData {
	static WIN_UP_HEIGHT: number = 50;
	static WIN_UP_DURATION: number = 500;
	static DROP_DURATION: number = 1000;
	static DROP_REELS_DELAY: number = 200;
	static DROP_REELS_DURATION: number = 1700;

  public isSpinning: boolean = false;
  public isAutoPlaying: boolean = false;
	public isTurbo: boolean = false;

	public winUpHeight: number = 0;
	public winUpDuration: number = 0;
	public dropDuration: number = 0;
	public dropReelsDelay: number = 0;
	public dropReelsDuration: number = 0;

	public constructor() {
		setSpeed(this, 1.0);
	}
}

export function setSpeed(data: GameData, speed: number) {
	data.winUpHeight = GameData.WIN_UP_HEIGHT / speed;
	data.winUpDuration = GameData.WIN_UP_DURATION / speed;
	data.dropDuration = GameData.DROP_DURATION / speed;
	data.dropReelsDelay = GameData.DROP_REELS_DELAY / speed;
	data.dropReelsDuration = GameData.DROP_REELS_DURATION / speed;
}

export function gameSpin(data: GameData) {
	if (data.isSpinning) return;
	BackendEvent.emit(BackendEvents.SPIN);
	data.isSpinning = true;
}