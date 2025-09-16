import { BackendEvent, BackendEvents } from "../../tmp_backend/BackendEvent";


export class GameData {
	static WIN_UP_HEIGHT: number = 50;

  public isSpinning: boolean = false;
  public isAutoPlaying: boolean = false;
	public isTurbo: boolean = false;

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
	if (data.isSpinning) return;
	BackendEvent.emit(BackendEvents.SPIN);
	data.isSpinning = true;
}