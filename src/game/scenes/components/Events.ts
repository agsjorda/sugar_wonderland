import { Events as PhaserEvents } from 'phaser';

export class Events {
    static readonly START: string = 'start';

    static readonly SPIN: string = 'spin';
    static readonly SPIN_END: string = 'spinEnd';

    static readonly SPIN_ANIMATION_START: string = 'spin_animation_start';
    static readonly SPIN_BEFORE_ANIMATION_END: string = 'spinBeforeAnimationEnd';
    static readonly SPIN_ANIMATION_END: string = 'spin_animation_end';
    static readonly MATCHES_DONE: string = 'matches_done';

    static readonly WIN: string = 'win';
    static readonly CHANGE_LINE: string = 'changeLine';
    static readonly CHANGE_BET: string = 'change_bet';

    // Autoplay events
    static readonly AUTOPLAY_START: string = 'autoplay_start';
    static readonly AUTOPLAY_STOP: string = 'autoplay_stop';
    static readonly AUTOPLAY_COMPLETE: string = 'autoplay_complete';

    static readonly BONUS_WIN_CLOSED: string = 'bonus_win_closed';

    static readonly emitter: PhaserEvents.EventEmitter = new PhaserEvents.EventEmitter();
} 