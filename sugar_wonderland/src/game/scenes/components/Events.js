import Phaser from 'phaser';

export class Events {
	static START = 'start';

	static SPIN = 'spin';
	static SPIN_END = 'spinEnd';


	static SPIN_ANIMATION_START = 'spinAnimationStart';
	static SPIN_BEFORE_ANIMATION_END = 'spinBeforeAnimationEnd';
	static SPIN_ANIMATION_END = 'spinAnimationEnd';
	static MATCHES_DONE = 'matchesDone';

	static WIN = 'win';
	static CHANGE_LINE = 'changeLine';
	static CHANGE_BET = 'changeBet';

	// Autoplay events
	static AUTOPLAY_START = 'autoplayStart';
	static AUTOPLAY_STOP = 'autoplayStop';
	static AUTOPLAY_COMPLETE = 'autoplayComplete';

	static emitter = new Phaser.Events.EventEmitter();
}
