import { gameStateManager } from './GameStateManager';

export enum MusicType {
	MAIN = 'main',
	BONUS = 'bonus', 
	FREE_SPIN = 'freespin',
	PICK_A_CARD = 'pickacard',
	BIG_WIN = 'bigwin'
}

export enum SoundEffectType {
	SPIN = 'spin',
	REEL_DROP = 'reeldrop',
	TURBO_DROP = 'turbodrop',
	WHEEL_SPIN = 'wheelspin',
	MENU_CLICK = 'menu_click',
	BUTTON_FX = 'button_fx',
	HIT_WIN = 'hitwin',
	SCATTER = 'scatter',
	ANTICIPATION = 'anticipation',
	WIN_LINE_1 = 'winline_1',
	WIN_LINE_2 = 'winline_2',
	COIN_THROW = 'coin_throw',
	COIN_DROP = 'coin_drop',
	// Win dialog effects
	WIN_BIG = 'win_big',
	WIN_MEGA = 'win_mega',
	WIN_SUPER = 'win_super',
	WIN_EPIC = 'win_epic',

	WIN_BIG_TURBO = 'win_big_turbo',
	WIN_MEGA_TURBO = 'win_mega_turbo',
	WIN_SUPER_TURBO = 'win_super_turbo',
	WIN_EPIC_TURBO = 'win_epic_turbo'
	,
	DIALOG_FREESPIN = 'dialog_freespin',
	DIALOG_CONGRATS = 'dialog_congrats'
}

export class AudioManager {
	private scene: Phaser.Scene;
	private currentMusic: MusicType | null = null;
	private lockedMusic: MusicType | null = null;
	private musicVolume: number = 0.2;
	private sfxVolume: number = 0.55;
	private ambientVolume: number = 0.3; // Volume for ambient audio layer
	private isMuted: boolean = false;
	private musicInstances: Map<MusicType, Phaser.Sound.BaseSound> = new Map();
	private sfxInstances: Map<SoundEffectType, Phaser.Sound.BaseSound> = new Map();
	private ambientInstance: Phaser.Sound.BaseSound | null = null; // Ambient audio instance
	private currentWinSfx: Phaser.Sound.BaseSound | null = null;
	private isDucked: boolean = false;
	private savedMusicVolume: number | null = null;
	private savedAmbientVolume: number | null = null;
	private duckFadeTimer: any = null;
	private restoreFadeTimer: any = null;
	// Page visibility / focus handling
	private visibilityHandlersInstalled: boolean = false;
	private wasPlayingBeforeHide: MusicType | null = null;
	private wasAmbientPlayingBeforeHide: boolean = false;
	private isPageHidden: boolean = false;
	private resumeDebounceTimer: any = null;
    // Suppressed one-shot SFX while page is hidden (key -> count)
    private suppressedOneShotCounts: Map<string, number> = new Map();
    // One-shot rate limiting and overlap control
    private lastOneShotAt: Map<string, number> = new Map();
    private defaultOneShotMinIntervalMs: number = 100;
    private oneShotMinIntervalOverrides: Record<string, number> = { 'fireworks_hh': 450 };
    private oneShotSkipIfPlaying: Set<string> = new Set(['fireworks_hh']);
	// Map music type to the underlying Phaser audio key so we can stop by key across scenes
	private readonly musicKeyByType: Record<string, string> = {
		[MusicType.MAIN]: 'mainbg_hh',
		[MusicType.BONUS]: 'bonusbg_hh',
		[MusicType.FREE_SPIN]: 'freespinbg_ka',
		[MusicType.PICK_A_CARD]: 'bgpickacard_hh',
		[MusicType.BIG_WIN]: 'bigw_hh'
	};

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		// Disable Phaser's default pause/mute-on-blur so we control lifecycle ourselves
		const soundMgr = this.scene.sound as any;
		if (soundMgr) {
			try { soundMgr.pauseOnBlur = false; } catch {}
			try { soundMgr.resumeOnFocus = false; } catch {}
			try { soundMgr.muteOnPause = false; } catch {}
		}
		this.patchPhaserVisibilityAudioHandling();
		this.ensureAudioContext();
		console.log('[AudioManager] AudioManager initialized');
		this.installVisibilityHandlers();
	}

	/**
	 * Preload all background music and sound effect files
	 */
	preloadMusic(): void {
		console.log('[AudioManager] Preloading audio files...');
		
		// Main background music
		this.scene.load.audio('mainbg_hh', 'assets/sounds/BG/mainbg_hh.ogg');
		
		// Bonus background music
		this.scene.load.audio('bonusbg_hh', 'assets/sounds/BG/bonusbg_hh.ogg');
		
		// Free spin background music
		this.scene.load.audio('freespinbg_ka', 'assets/sounds/BG/freespinbg_ka.ogg');
		// Pick-a-card background music
		this.scene.load.audio('bgpickacard_hh', 'assets/sounds/BG/bgpickacard_hh.ogg');
		// Big Win background music
		this.scene.load.audio('bigw_hh', 'assets/sounds/Wins/bigw_hh.ogg');
		
		// Ambient audio
		this.scene.load.audio('ambience_hh', 'assets/sounds/SFX/ambience_hh.ogg');
		// Fire SFX
		this.scene.load.audio('fire_hh', 'assets/sounds/SFX/fire_hh.ogg');
		// Blaze SFX removed with fire transitions
		
		// Sound effects
		this.scene.load.audio('spin_hh', 'assets/sounds/SFX/spin_hh.ogg');
		this.scene.load.audio('click_sw', 'assets/sounds/click_sw.ogg');
		this.scene.load.audio('button_fx', 'assets/sounds/SFX/button_fx.ogg');
		this.scene.load.audio('reeldrop_hh', 'assets/sounds/SFX/reeldrop_hh.ogg');
		this.scene.load.audio('turbodrop_hh', 'assets/sounds/SFX/turbodrop_hh.ogg');
		this.scene.load.audio('coin_drop_ka', 'assets/sounds/SFX/coin_drop_ka.ogg');
		
		console.log('[AudioManager] Audio files preloaded successfully');
	}

	/**
	 * Create music and sound effect instances after loading
	 */
	createMusicInstances(): void {
		console.log('[AudioManager] Creating audio instances...');
		
		try {
			// Create main background music
			const mainMusic = this.scene.sound.add('mainbg_hh', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.MAIN, mainMusic);
			console.log('[AudioManager] Main background music instance created');

			// Create bonus background music
			const bonusMusic = this.scene.sound.add('bonusbg_hh', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.BONUS, bonusMusic);
			console.log('[AudioManager] Bonus background music instance created');

			// Create free spin background music
			const freespinMusic = this.scene.sound.add('freespinbg_ka', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.FREE_SPIN, freespinMusic);
			console.log('[AudioManager] Free spin background music instance created');

			// Create pick-a-card background music
			try {
				const pickMusic = this.scene.sound.add('bgpickacard_hh', { volume: this.musicVolume, loop: true });
				this.musicInstances.set(MusicType.PICK_A_CARD, pickMusic);
				console.log('[AudioManager] Pick-a-card background music instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create bgpickacard_hh music instance:', e);
			}

			// Create sound effect instances
			const spinSfx = this.scene.sound.add('spin_hh', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.SPIN, spinSfx);
			// Fire SFX instance
			try {
				const fireSfx = this.scene.sound.add('fire_hh', { volume: this.sfxVolume, loop: false });
				// Use a custom key for ad-hoc SFX not in enum
				this.sfxInstances.set('fire_hh' as any, fireSfx);
				console.log('[AudioManager] Fire SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create fire_hh SFX instance:', e);
			}
			// Fireworks SFX instance (optional; we can also play one-shot)
			try {
				const fireworksSfx = this.scene.sound.add('fireworks_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set('fireworks_hh' as any, fireworksSfx);
				console.log('[AudioManager] Fireworks SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create fireworks_hh SFX instance:', e);
			}
			// Blaze SFX for Fire_Transition
			try {
				const blazeSfx = this.scene.sound.add('blaze_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set('blaze_hh' as any, blazeSfx);
				console.log('[AudioManager] Blaze SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create blaze_hh SFX instance:', e);
			}
			console.log('[AudioManager] Spin sound effect instance created');

			// Menu click SFX
			try {
				const clickSfx = this.scene.sound.add('click_sw', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.MENU_CLICK, clickSfx);
				console.log('[AudioManager] Menu click SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create click_sw SFX instance:', e);
			}

			// Button FX SFX
			try {
				const buttonFxSfx = this.scene.sound.add('button_fx', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.BUTTON_FX, buttonFxSfx);
				console.log('[AudioManager] Button FX SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create button_fx SFX instance:', e);
			}

			// Card deal SFX for ScatterWinOverlay
			try {
				const cardDeal = this.scene.sound.add('carddeal_hh', { volume: this.sfxVolume, loop: false });
				// store under raw key to allow playSoundEffect('carddeal_hh') calls
				this.sfxInstances.set('carddeal_hh' as any, cardDeal);
				console.log('[AudioManager] Card deal SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create carddeal_hh SFX instance:', e);
			}

			// Card pick SFX for ScatterWinOverlay
			try {
				const cardPick = this.scene.sound.add('cardpick_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set('cardpick_hh' as any, cardPick);
				console.log('[AudioManager] Card pick SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create cardpick_hh SFX instance:', e);
			}

			// Card flip SFX for ScatterWinOverlay
			try {
				const cardFlip = this.scene.sound.add('cardflip_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set('cardflip_hh' as any, cardFlip);
				console.log('[AudioManager] Card flip SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create cardflip_hh SFX instance:', e);
			}

			const reelDropSfx = this.scene.sound.add('reeldrop_hh', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.REEL_DROP, reelDropSfx);
			console.log('[AudioManager] Reel drop sound effect instance created');

			const turboDropSfx = this.scene.sound.add('turbodrop_hh', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.TURBO_DROP, turboDropSfx);
			console.log('[AudioManager] Turbo drop sound effect instance created');

			// Create wheel spin sound effect instance
			const wheelSpinSfx = this.scene.sound.add('wheelspin_ka', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.WHEEL_SPIN, wheelSpinSfx);
			console.log('[AudioManager] Wheel spin sound effect instance created');

			// Create winline SFX instances
			const winline1 = this.scene.sound.add('winline_1_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_LINE_1, winline1);
			const winline2 = this.scene.sound.add('winline_2_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_LINE_2, winline2);
			console.log('[AudioManager] Winline SFX instances created');

			// coin_throw_ka removed per request

			// Create coin drop SFX instance
			try {
				const coinDrop = this.scene.sound.add('coin_drop_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.COIN_DROP, coinDrop);
				console.log('[AudioManager] Coin drop SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create coin_drop_ka SFX instance:', e);
			}

			// Create hit win SFX instance
			try {
				const hitWin = this.scene.sound.add('hitwin_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.HIT_WIN, hitWin);
				console.log('[AudioManager] Hit win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create hitwin_hh SFX instance:', e);
			}

			// Create scatter SFX instance
			try {
				const scatter = this.scene.sound.add('scatter_hh', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.SCATTER, scatter);
				console.log('[AudioManager] Scatter SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create scatter_hh SFX instance:', e);
			}

			// Create anticipation SFX instance (looping)
			try {
				const anticipation = this.scene.sound.add('anticipation_hh', { volume: this.sfxVolume, loop: true });
				this.sfxInstances.set(SoundEffectType.ANTICIPATION, anticipation);
				console.log('[AudioManager] Anticipation SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create anticipation_hh SFX instance:', e);
			}

			// Create win dialog SFX instances
			const bigWinSfx = this.scene.sound.add('bigw_hh', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_BIG, bigWinSfx);
			const megaWinSfx = this.scene.sound.add('megaw_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_MEGA, megaWinSfx);
			const superWinSfx = this.scene.sound.add('superw_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_SUPER, superWinSfx);
			const epicWinSfx = this.scene.sound.add('epicw_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_EPIC, epicWinSfx);
			// Create win dialog SFX instances turbo
			const bigWinSfxTurbo = this.scene.sound.add('bigwskip_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_BIG_TURBO, bigWinSfxTurbo);
			const megaWinSfxTurbo = this.scene.sound.add('megawskip_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_MEGA_TURBO, megaWinSfxTurbo);
			const superWinSfxTurbo = this.scene.sound.add('superwskip_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_SUPER_TURBO, superWinSfxTurbo);
			const epicWinSfxTurbo = this.scene.sound.add('epicwskip_ka', { volume: this.sfxVolume, loop: false });
			this.sfxInstances.set(SoundEffectType.WIN_EPIC_TURBO, epicWinSfxTurbo);
			console.log('[AudioManager] Win dialog SFX instances created');

			// Create Big Win background music instance
			try {
				const bigWinMusic = this.scene.sound.add('bigw_hh', {
					volume: this.musicVolume,
					loop: true
				});
				this.musicInstances.set(MusicType.BIG_WIN, bigWinMusic);
				console.log('[AudioManager] Big Win background music instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create bigw_hh music instance:', e);
			}

			// Create dialog-specific SFX instances
			try {
				const freeSpinDlg = this.scene.sound.add('freespin_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.DIALOG_FREESPIN, freeSpinDlg);
				console.log('[AudioManager] Free spin dialog SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create freespin_ka SFX instance:', e);
			}
			try {
				const congratsDlg = this.scene.sound.add('congrats_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.DIALOG_CONGRATS, congratsDlg);
				console.log('[AudioManager] Congrats dialog SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create congrats_ka SFX instance:', e);
			}
			console.log('[AudioManager] Total SFX instances:', this.sfxInstances.size);

			// Create ambient audio instance
			this.ambientInstance = this.scene.sound.add('ambience_hh', {
				volume: this.ambientVolume,
				loop: true
			});
			console.log('[AudioManager] Ambient audio instance created');

			console.log('[AudioManager] All audio instances created successfully');
		} catch (error) {
			console.error('[AudioManager] Error creating audio instances:', error);
		}
	}

	/**
	 * Play a random winline SFX
	 */
	playRandomWinlineSfx(): void {
		if (this.isMuted) return;
		const pick = Math.random() < 0.5 ? SoundEffectType.WIN_LINE_1 : SoundEffectType.WIN_LINE_2;
		this.playSoundEffect(pick);
	}

	/**
	 * Crossfade from current music to the target music type without gaps
	 */
	crossfadeTo(nextType: MusicType, durationMs: number = 500): void {
		if (this.isMuted) return;
		if (this.currentMusic === nextType) return;

		// Respect music lock
		if (this.lockedMusic && nextType !== this.lockedMusic) {
			console.log(`[AudioManager] Music locked to ${this.lockedMusic}, ignoring crossfade to ${nextType}`);
			return;
		}

		const currentType = this.currentMusic;
		const from = currentType ? this.musicInstances.get(currentType) : null;
		const to = this.musicInstances.get(nextType);
		if (!to) {
			console.warn('[AudioManager] Crossfade target music not found:', nextType);
			this.playBackgroundMusic(nextType);
			return;
		}

		// If nothing is currently playing, just play the target
		if (!from || !from.isPlaying) {
			try {
				if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
					(to as any).setVolume(0);
				}
				to.play();
				this.currentMusic = nextType;
				const steps = 10;
				const interval = Math.max(10, Math.floor(durationMs / steps));
				let step = 0;
				const timer = setInterval(() => {
					step++;
					const t = step / steps;
					if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
						(to as any).setVolume(this.musicVolume * t);
					}
					if (step >= steps) {
						clearInterval(timer);
						if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
							(to as any).setVolume(this.musicVolume);
						}
					}
				}, interval);
			} catch (e) {
				console.warn('[AudioManager] Failed simple fade-in for target music, falling back to play:', e);
				this.playBackgroundMusic(nextType);
			}
			return;
		}

		// Crossfade between two tracks
		try {
			const fromStart = (from as any).volume ?? this.musicVolume;
			// Ensure target starts at 0 volume
			if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
				(to as any).setVolume(0);
			}
			if (!to.isPlaying) to.play();

			const steps = 12;
			const interval = Math.max(10, Math.floor(durationMs / steps));
			let step = 0;
			const timer = setInterval(() => {
				step++;
				const t = step / steps;
				const toVol = this.musicVolume * t;
				const fromVol = Math.max(0, fromStart * (1 - t));
				if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
					(to as any).setVolume(toVol);
				}
				if ('setVolume' in from && typeof (from as any).setVolume === 'function') {
					(from as any).setVolume(fromVol);
				}
				if (step >= steps) {
					clearInterval(timer);
					// Stop the old track and finalize volumes
					try { if (from.isPlaying) from.stop(); } catch {}
					if ('setVolume' in to && typeof (to as any).setVolume === 'function') {
						(to as any).setVolume(this.musicVolume);
					}
					this.currentMusic = nextType;
					this.startAmbientAudio();
				}
			}, interval);
		} catch (e) {
			console.warn('[AudioManager] Crossfade failed, falling back to direct switch:', e);
			this.playBackgroundMusic(nextType);
		}
	}
		
	/**
	 * Play background music based on game state
	 */
	playBackgroundMusic(musicType: MusicType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping music playback');
			return;
		}

		// If page is hidden, defer starting tracks to avoid resume bursts
		if (this.isPageHidden) {
			console.log(`[AudioManager] Page hidden; deferring music start for ${musicType}`);
			// Do not change currentMusic here to avoid inconsistent state; it will be resumed based on game state
			return;
		}

		// Respect music lock
		if (this.lockedMusic && musicType !== this.lockedMusic) {
			console.log(`[AudioManager] Music locked to ${this.lockedMusic}, ignoring request for ${musicType}`);
			return;
		}

		// Defensive: stop any stray BGM instances that might be playing (across scenes)
		this.stopAllMusicByKeys();

		const music = this.musicInstances.get(musicType);
		// If the requested music is already current and playing, do nothing to avoid a hard restart
		if (this.currentMusic === musicType && music && music.isPlaying) {
			console.log(`[AudioManager] ${musicType} already playing; skipping restart`);
			this.startAmbientAudio();
			return;
		}

		// Stop only non-target tracks that may be playing
		try {
			this.musicInstances.forEach((inst, type) => {
				if (type !== musicType && inst && inst.isPlaying) {
					try { inst.stop(); } catch {}
				}
			});
		} catch {}

		if (music) {
			try {
				music.play();
				this.currentMusic = musicType;
				console.log(`[AudioManager] Playing ${musicType} background music`);
				this.startAmbientAudio();
			} catch (error) {
				console.error(`[AudioManager] Error playing ${musicType} music:`, error);
			}
		} else {
			console.warn(`[AudioManager] Music instance not found for type: ${musicType}`);
		}
	}

	/**
	 * Single-slot background music: stop any playing tracks and start the requested one.
	 * Optional fade-out duration for the currently playing track(s) can be added later; for now it's immediate.
	 */
	setExclusiveBackground(musicType: MusicType): void {
		if (this.isMuted) return;
		if (this.isPageHidden) {
			console.log(`[AudioManager] Page hidden; deferring exclusive background set to ${musicType}`);
			return;
		}
		// Respect lock
		if (this.lockedMusic && musicType !== this.lockedMusic) {
			console.log(`[AudioManager] Music locked to ${this.lockedMusic}, ignoring exclusive set to ${musicType}`);
			return;
		}
		// If already playing the requested type, don't restart to avoid audible glitch
		const current = this.musicInstances.get(musicType);
		if (this.currentMusic === musicType && current && current.isPlaying) {
			console.log(`[AudioManager] ${musicType} already playing (exclusive); skipping restart`);
			return;
		}
		// Defensive: stop any stray BGM instances before playing target
		this.stopAllMusicByKeys();
		// Stop only non-target tracks
		try {
			this.musicInstances.forEach((inst, type) => {
				if (type !== musicType && inst && inst.isPlaying) {
					try { inst.stop(); } catch {}
				}
			});
		} catch {}
		this.playBackgroundMusic(musicType);
	}

	/**
	 * Stop current background music
	 */
	stopCurrentMusic(): void {
		if (this.currentMusic) {
			const music = this.musicInstances.get(this.currentMusic);
			if (music && music.isPlaying) {
				music.stop();
				console.log(`[AudioManager] Stopped ${this.currentMusic} background music`);
			}
			this.currentMusic = null;
		}
	}

	/**
	 * Stop all background music
	 */
	stopAllMusic(): void {
		console.log('[AudioManager] Stopping all background music');
		this.musicInstances.forEach((music, type) => {
			if (music.isPlaying) {
				music.stop();
				console.log(`[AudioManager] Stopped ${type} music`);
			}
		});
		this.currentMusic = null;
		this.stopAmbientAudio();
		// Also stop any stray BGM instances not tracked in the map
		this.stopAllMusicByKeys();
	}

	/** Stop a specific background music instance by type. */
	stopMusicByType(type: MusicType): void {
		try {
			const music = this.musicInstances.get(type);
			if (music && music.isPlaying) {
				music.stop();
				console.log(`[AudioManager] Stopped music by type: ${type}`);
			}
			// Also stop any stray instances with the same key
			const key = this.musicKeyByType[type as any];
			if (key) {
				try {
					const sounds: Phaser.Sound.BaseSound[] = (this.scene.sound as any).sounds || [];
					for (const s of sounds) {
						if ((s as any).key === key && s.isPlaying) {
							s.stop();
							console.log(`[AudioManager] Force-stopped stray instance for key: ${key}`);
						}
					}
				} catch {}
			}
			if (this.currentMusic === type) {
				this.currentMusic = null;
			}
		} catch (e) {
			console.warn('[AudioManager] stopMusicByType failed:', e);
		}
	}

	/**
	 * Defensive: stop any potentially playing BGM by audio key, even if spawned by another scene
	 */
	private stopAllMusicByKeys(): void {
		try {
			const keys = Object.values(this.musicKeyByType);
			for (const key of keys) {
				try {
					// Stop ALL instances with this key, not just the first
					const sounds: Phaser.Sound.BaseSound[] = (this.scene.sound as any).sounds || [];
					for (const s of sounds) {
						if ((s as any).key === key && s.isPlaying) {
							s.stop();
							console.log(`[AudioManager] Force-stopped music by key: ${key}`);
						}
					}
				} catch {}
			}
			this.currentMusic = null;
			this.stopAmbientAudio();
		} catch (e) {
			console.warn('[AudioManager] stopAllMusicByKeys failed:', e);
		}
	}

	/** Stop every currently playing sound except tracks we intend to resume (music + ambient). */
	private stopAllNonMusic(): void {
		try {
			const musicKeys = new Set(Object.values(this.musicKeyByType));
			const ambientKey = this.ambientInstance ? (this.ambientInstance as any).key : null;
			try {
				this.sfxInstances.forEach((sfx) => {
					if (sfx && sfx.isPlaying) {
						sfx.stop();
					}
				});
			} catch {}
			const sounds: Phaser.Sound.BaseSound[] = (this.scene.sound as any).sounds || [];
			for (const sound of sounds) {
				const key = (sound as any).key;
				const isMusic = key && musicKeys.has(key);
				const isAmbient = ambientKey && key === ambientKey;
				if (!isMusic && !isAmbient && sound.isPlaying) {
					try { sound.stop(); } catch {}
				}
			}
		} catch (e) {
			console.warn('[AudioManager] stopAllNonMusic failed:', e);
		}
	}

	/** Ensure there is a usable AudioContext and recreate it if the browser closed it. */
	private ensureAudioContext(): AudioContext | null {
		try {
			const soundMgr: any = this.scene.sound;
			if (!soundMgr) return null;
			const current: AudioContext | undefined = soundMgr.context;
			if (current && current.state !== 'closed') {
				return current;
			}
			const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
			if (!AudioCtor) {
				console.warn('[AudioManager] Web Audio API unavailable, cannot recreate AudioContext');
				return null;
			}
			const newContext: AudioContext = new AudioCtor();
			if (typeof soundMgr.setAudioContext === 'function') {
				soundMgr.setAudioContext(newContext);
			} else {
				soundMgr.context = newContext;
			}
			if (typeof soundMgr.unlock === 'function') {
				try {
					soundMgr.locked = newContext.state === 'suspended';
					soundMgr.unlock();
				} catch {}
			}
			console.log('[AudioManager] AudioContext recreated after closure');
			return newContext;
		} catch (err) {
			console.warn('[AudioManager] ensureAudioContext failed:', err);
			return null;
		}
	}

	/** Patch Phaser's visibility handler to guard against closed AudioContext errors. */
	private patchPhaserVisibilityAudioHandling(): void {
		try {
			const soundMgr: any = this.scene.sound;
			if (!soundMgr || soundMgr.__hhPatchedVisibilityAudio) {
				return;
			}
			soundMgr.__hhPatchedVisibilityAudio = true;

			const safeResume = () => {
				const latest = this.ensureAudioContext();
				if (!latest || latest.state === 'closed') {
					return;
				}
				try {
					const resumeResult = latest.resume?.();
					if (resumeResult && typeof resumeResult.catch === 'function') {
						resumeResult.catch((err: any) => console.warn('[AudioManager] AudioContext.resume rejected:', err));
					}
				} catch (err) {
					console.warn('[AudioManager] AudioContext.resume threw:', err);
				}
			};

			soundMgr.onGameVisible = () => {
				window.setTimeout(() => {
					const ctx = this.ensureAudioContext();
					if (!ctx || ctx.state === 'closed') {
						return;
					}
					let suspendResult: any = null;
					try {
						suspendResult = ctx.suspend?.();
						if (suspendResult && typeof suspendResult.catch === 'function') {
							suspendResult.catch((err: any) => console.warn('[AudioManager] AudioContext.suspend rejected:', err));
						}
					} catch (err) {
						console.warn('[AudioManager] AudioContext.suspend threw:', err);
					}
					if (suspendResult && typeof suspendResult.then === 'function') {
						suspendResult.then(safeResume).catch(safeResume);
					} else {
						safeResume();
					}
				}, 120);
			};
		} catch (err) {
			console.warn('[AudioManager] Failed to patch Phaser visibility audio handler:', err);
		}
	}

	/** Returns true if any background music instance is currently playing. */
	isAnyMusicPlaying(): boolean {
		try {
			for (const music of this.musicInstances.values()) {
				if (music && music.isPlaying) return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	/** Prevent any music other than the specified type from playing until unlocked. */
	lockMusicTo(type: MusicType): void {
		this.lockedMusic = type;
		console.log(`[AudioManager] Music locked to: ${type}`);
	}

	/** Clear the music lock to allow normal music changes. */
	unlockMusic(): void {
		console.log('[AudioManager] Music lock cleared');
		this.lockedMusic = null;
	}

	/**
	 * Set music volume
	 */
	setVolume(volume: number): void {
		this.musicVolume = Math.max(0, Math.min(1, volume));
		
		this.musicInstances.forEach((music) => {
			if ('setVolume' in music && typeof music.setVolume === 'function') {
				music.setVolume(this.musicVolume);
			}
		});
		
		console.log(`[AudioManager] Music volume set to: ${this.musicVolume}`);
	}

	/**
	 * Temporarily reduce background (music + ambient) volume by a factor
	 */
	duckBackground(factor: number = 0.3, durationMs: number = 300): void {
		if (this.isMuted) return;
		// Cancel any ongoing restore fade
		if (this.restoreFadeTimer) {
			clearInterval(this.restoreFadeTimer);
			this.restoreFadeTimer = null;
		}
		// Save current volumes once
		if (!this.isDucked) {
			this.savedMusicVolume = this.musicVolume;
			this.savedAmbientVolume = this.ambientVolume;
		}
		this.isDucked = true;
		const startMusic = this.getVolume();
		const startAmbient = this.getAmbientVolume();
		const targetMusic = Math.max(0, Math.min(1, startMusic * factor));
		const targetAmbient = Math.max(0, Math.min(1, startAmbient * factor));
		if (durationMs <= 0) {
			this.musicInstances.forEach((music) => {
				if ('setVolume' in music && typeof music.setVolume === 'function') {
					music.setVolume(targetMusic);
				}
			});
			if (this.ambientInstance && 'setVolume' in this.ambientInstance && typeof (this.ambientInstance as any).setVolume === 'function') {
				(this.ambientInstance as any).setVolume(targetAmbient);
			}
			console.log(`[AudioManager] Background ducked instantly to factor ${factor} (music=${targetMusic}, ambient=${targetAmbient})`);
			return;
		}
		// Fade
		if (this.duckFadeTimer) {
			clearInterval(this.duckFadeTimer);
		}
		const steps = 10;
		const interval = Math.max(10, Math.floor(durationMs / steps));
		let step = 0;
		this.duckFadeTimer = setInterval(() => {
			step++;
			const t = step / steps;
			const curMusic = startMusic + (targetMusic - startMusic) * t;
			const curAmbient = startAmbient + (targetAmbient - startAmbient) * t;
			this.musicInstances.forEach((music) => {
				if ('setVolume' in music && typeof music.setVolume === 'function') {
					music.setVolume(curMusic);
				}
			});
			if (this.ambientInstance && 'setVolume' in this.ambientInstance && typeof (this.ambientInstance as any).setVolume === 'function') {
				(this.ambientInstance as any).setVolume(curAmbient);
			}
			if (step >= steps) {
				clearInterval(this.duckFadeTimer);
				this.duckFadeTimer = null;
				console.log(`[AudioManager] Background ducked to factor ${factor} (music=${targetMusic}, ambient=${targetAmbient})`);
			}
		}, interval);
	}

	/**
	 * Restore background (music + ambient) volume after ducking
	 */
	restoreBackground(durationMs: number = 500): void {
		if (this.isMuted) return;
		if (!this.isDucked) return;
		// Cancel any ongoing duck fade
		if (this.duckFadeTimer) {
			clearInterval(this.duckFadeTimer);
			this.duckFadeTimer = null;
		}
		const targetMusic = this.savedMusicVolume ?? this.musicVolume;
		const targetAmbient = this.savedAmbientVolume ?? this.ambientVolume;
		// Read current applied volumes from any music instance (all share same intended volume)
		let currentMusic = targetMusic;
		this.musicInstances.forEach((music) => {
			try {
				currentMusic = (music as any).volume ?? targetMusic;
				throw new Error('break');
			} catch {}
		});
		let currentAmbient = targetAmbient;
		if (this.ambientInstance) {
			currentAmbient = (this.ambientInstance as any).volume ?? targetAmbient;
		}
		if (durationMs <= 0) {
			this.musicInstances.forEach((music) => {
				if ('setVolume' in music && typeof music.setVolume === 'function') {
					music.setVolume(targetMusic);
				}
			});
			if (this.ambientInstance && 'setVolume' in this.ambientInstance && typeof (this.ambientInstance as any).setVolume === 'function') {
				(this.ambientInstance as any).setVolume(targetAmbient);
			}
			this.isDucked = false;
			this.savedMusicVolume = null;
			this.savedAmbientVolume = null;
			console.log('[AudioManager] Background volume restored instantly');
			return;
		}
		if (this.restoreFadeTimer) {
			clearInterval(this.restoreFadeTimer);
		}
		const steps = 10;
		const interval = Math.max(10, Math.floor(durationMs / steps));
		let step = 0;
		this.restoreFadeTimer = setInterval(() => {
			step++;
			const t = step / steps;
			const curMusic = currentMusic + (targetMusic - currentMusic) * t;
			const curAmbient = currentAmbient + (targetAmbient - currentAmbient) * t;
			this.musicInstances.forEach((music) => {
				if ('setVolume' in music && typeof music.setVolume === 'function') {
					music.setVolume(curMusic);
				}
			});
			if (this.ambientInstance && 'setVolume' in this.ambientInstance && typeof (this.ambientInstance as any).setVolume === 'function') {
				(this.ambientInstance as any).setVolume(curAmbient);
			}
			if (step >= steps) {
				clearInterval(this.restoreFadeTimer);
				this.restoreFadeTimer = null;
				this.isDucked = false;
				this.savedMusicVolume = null;
				this.savedAmbientVolume = null;
				console.log('[AudioManager] Background volume restored');
			}
		}, interval);
	}

	/**
	 * Get current music volume
	 */
	getVolume(): number {
		return this.musicVolume;
	}

	/**
	 * Toggle mute state
	 */
	toggleMute(): void {
		this.isMuted = !this.isMuted;
		
		if (this.isMuted) {
			this.stopAllMusic();
			console.log('[AudioManager] Audio muted');
		} else {
			console.log('[AudioManager] Audio unmuted');
			// Resume music based on current game state
			this.resumeMusicBasedOnGameState();
		}
	}

	/**
	 * Set mute state
	 */
	setMuted(muted: boolean): void {
		this.isMuted = muted;
		
		if (this.isMuted) {
			this.stopAllMusic();
			console.log('[AudioManager] Audio muted');
		} else {
			console.log('[AudioManager] Audio unmuted');
			this.resumeMusicBasedOnGameState();
		}
	}

	/**
	 * Get mute state
	 */
	isAudioMuted(): boolean {
		return this.isMuted;
	}

	/**
	 * Resume music based on current game state
	 */
	resumeMusicBasedOnGameState(): void {
		if (this.isMuted) return;

		// Determine music type based on game state
		let musicType: MusicType;
		
		if (gameStateManager.isBonus) {
			// Check if we're in free spin mode
			// You might want to add a specific state for free spins
			musicType = MusicType.BONUS;
		} else {
			musicType = MusicType.MAIN;
		}

		this.playBackgroundMusic(musicType);
		this.startAmbientAudio();
	}

	/**
	 * Start ambient audio
	 */
	startAmbientAudio(): void {
		if (this.isMuted || !this.ambientInstance) return;

		if (!this.ambientInstance.isPlaying) {
			this.ambientInstance.play();
			console.log('[AudioManager] Ambient audio started');
		}
	}

	/**
	 * Stop ambient audio
	 */
	stopAmbientAudio(): void {
		if (this.ambientInstance && this.ambientInstance.isPlaying) {
			this.ambientInstance.stop();
			console.log('[AudioManager] Ambient audio stopped');
		}
	}

	/**
	 * Set ambient audio volume
	 */
	setAmbientVolume(volume: number): void {
		this.ambientVolume = Math.max(0, Math.min(1, volume));
		
		if (this.ambientInstance && 'setVolume' in this.ambientInstance && typeof this.ambientInstance.setVolume === 'function') {
			this.ambientInstance.setVolume(this.ambientVolume);
		}
		
		console.log(`[AudioManager] Ambient volume set to: ${this.ambientVolume}`);
	}

	/**
	 * Get ambient audio volume
	 */
	getAmbientVolume(): number {
		return this.ambientVolume;
	}

	/**
	 * Handle game state changes and switch music accordingly
	 */
	onGameStateChange(): void {
		if (this.isMuted) return;

		let musicType: MusicType;
		
		if (gameStateManager.isBonus) {
			musicType = MusicType.BONUS;
		} else {
			musicType = MusicType.MAIN;
		}

		// Only switch if the music type has changed
		if (this.currentMusic !== musicType) {
			this.playBackgroundMusic(musicType);
		}
	}

	/**
	 * Switch to free spin music (can be called during bonus mode)
	 */
	switchToFreeSpinMusic(): void {
		if (this.isMuted) return;
		
		this.playBackgroundMusic(MusicType.FREE_SPIN);
		console.log('[AudioManager] Switched to free spin background music');
	}

	/**
	 * Play a sound effect
	 */
	playSoundEffect(sfxType: SoundEffectType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping sound effect');
			return;
		}
		if (this.isPageHidden) {
			// Drop SFX while page is hidden to avoid burst upon resume
			return;
		}

		console.log(`[AudioManager] Attempting to play ${sfxType} sound effect`);
		console.log(`[AudioManager] Available SFX instances:`, Array.from(this.sfxInstances.keys()));
		
		const sfx = this.sfxInstances.get(sfxType);
		if (sfx) {
			try {
				// Ensure looping SFX restarts if needed
				if (sfxType === SoundEffectType.ANTICIPATION && sfx.isPlaying) {
					sfx.stop();
				}
				sfx.play();
				// Track current win SFX so we can fade it out on dialog close
				if (sfxType === SoundEffectType.WIN_BIG || sfxType === SoundEffectType.WIN_MEGA || sfxType === SoundEffectType.WIN_SUPER || sfxType === SoundEffectType.WIN_EPIC) {
					this.currentWinSfx = sfx;
				}
				console.log(`[AudioManager] Successfully playing ${sfxType} sound effect`);
			} catch (error) {
				console.error(`[AudioManager] Error playing ${sfxType} sound effect:`, error);
			}
		} else {
			console.warn(`[AudioManager] Sound effect instance not found for type: ${sfxType}`);
		}
	}

	/**
	 * Play an arbitrary one-shot SFX by audio key with optional volume override.
	 */
    playOneShot(key: string, volume?: number): void {
        if (this.isMuted) return;
        // When page is hidden, suppress one-shots to avoid queued burst on resume
        if (this.isPageHidden) {
            const cur = this.suppressedOneShotCounts.get(key) || 0;
            this.suppressedOneShotCounts.set(key, cur + 1);
            return;
        }
        const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const minInterval = this.oneShotMinIntervalOverrides[key] ?? this.defaultOneShotMinIntervalMs;
        const lastAt = this.lastOneShotAt.get(key) || 0;
        if (now - lastAt < minInterval) {
            return;
        }
        this.lastOneShotAt.set(key, now);
        if (this.oneShotSkipIfPlaying.has(key)) {
            try {
                const sounds: Phaser.Sound.BaseSound[] = (this.scene.sound as any).sounds || [];
                for (const s of sounds) {
                    if ((s as any).key === key && s.isPlaying) {
                        return;
                    }
                }
            } catch {}
        }
        try {
            const vol = Math.max(0, Math.min(1, volume != null ? volume : this.sfxVolume));
            (this.scene.sound as any).play?.(key, { volume: vol, loop: false });
        } catch (e) {
            console.warn('[AudioManager] playOneShot failed for key:', key, e);
        }
    }

	/** Stop all currently playing sounds by audio key (SFX or music). */
	stopByKey(key: string): void {
		try {
			const sounds: Phaser.Sound.BaseSound[] = (this.scene.sound as any).sounds || [];
			for (const s of sounds) {
				if ((s as any).key === key && s.isPlaying) {
					s.stop();
				}
			}
		} catch (e) {
			console.warn('[AudioManager] stopByKey failed for key:', key, e);
		}
	}

	/**
	 * Fade out a specific SFX by type and stop it when done
	 */
	fadeOutSfx(sfxType: SoundEffectType, durationMs: number = 400): void {
		const sfx = this.sfxInstances.get(sfxType);
		if (!sfx || !sfx.isPlaying) return;
		try {
			const startVolume = (sfx as any).volume ?? this.sfxVolume;
			const steps = 8;
			const interval = Math.max(10, Math.floor(durationMs / steps));
			let step = 0;
			const timer = setInterval(() => {
				step++;
				const t = step / steps;
				const vol = startVolume * (1 - t);
				if ('setVolume' in sfx && typeof (sfx as any).setVolume === 'function') {
					(sfx as any).setVolume(Math.max(0, vol));
				}
				if (step >= steps) {
					clearInterval(timer);
					if (sfx.isPlaying) sfx.stop();
					if ('setVolume' in sfx && typeof (sfx as any).setVolume === 'function') {
						(sfx as any).setVolume(this.sfxVolume);
					}
				}
			}, interval);
		} catch (e) {
			console.warn('[AudioManager] Failed to fade out SFX:', e);
			try { if (sfx.isPlaying) sfx.stop(); } catch {}
		}
	}

	/**
	 * Fade out any currently playing win SFX and stop it when done
	 */
	fadeOutCurrentWinSfx(durationMs: number = 400): void {
		if (!this.currentWinSfx) return;
		const sfx = this.currentWinSfx;
		try {
			const startVolume = (sfx as any).volume ?? this.sfxVolume;
			const steps = 8;
			const interval = Math.max(10, Math.floor(durationMs / steps));
			let step = 0;
			const timer = setInterval(() => {
				step++;
				const t = step / steps;
				const vol = startVolume * (1 - t);
				if ('setVolume' in sfx && typeof (sfx as any).setVolume === 'function') {
					(sfx as any).setVolume(Math.max(0, vol));
				}
				if (step >= steps) {
					clearInterval(timer);
					if (sfx.isPlaying) sfx.stop();
					if ('setVolume' in sfx && typeof (sfx as any).setVolume === 'function') {
						(sfx as any).setVolume(this.sfxVolume);
					}
					if (this.currentWinSfx === sfx) this.currentWinSfx = null;
				}
			}, interval);
		} catch (e) {
			console.warn('[AudioManager] Failed to fade out win SFX:', e);
			try { if (sfx.isPlaying) sfx.stop(); } catch {}
			if (this.currentWinSfx === sfx) this.currentWinSfx = null;
		}
	}

	/**
	 * Play win dialog SFX based on dialog type
	 */
	playWinDialogSfx(dialogType: string): void {
		if (this.isMuted) return;
		let effect: SoundEffectType | null = null;
		const t = (dialogType || '').toLowerCase();
		const sceneAny: any = this.scene as any;
		const symbolsRef = sceneAny?.symbols;
		const isFsAuto = symbolsRef && typeof symbolsRef.isFreeSpinAutoplayActive === 'function' ? !!symbolsRef.isFreeSpinAutoplayActive() : false;
		const isAuto = !!(gameStateManager.isAutoPlaying || gameStateManager.isAutoPlaySpinRequested || sceneAny?.gameData?.isAutoPlaying || isFsAuto);
		const isTurbo = !!(sceneAny?.gameData?.isTurbo || gameStateManager.isTurbo);

		if (isAuto && isTurbo) {
			switch (t) {
				case 'smallw_ka':
					effect = SoundEffectType.WIN_BIG_TURBO; break;
				case 'mediumw_ka':
					effect = SoundEffectType.WIN_MEGA_TURBO; break;
				case 'largew_ka':
					effect = SoundEffectType.WIN_SUPER_TURBO; break;
				case 'superw_ka':
					effect = SoundEffectType.WIN_EPIC_TURBO; break;
				default:
					break;
			}
		} else {
			switch (t) {
				case 'smallw_ka':
					effect = SoundEffectType.WIN_BIG; break;
				case 'mediumw_ka':
					effect = SoundEffectType.WIN_MEGA; break;
				case 'largew_ka':
					effect = SoundEffectType.WIN_SUPER; break;
				case 'superw_ka':
					effect = SoundEffectType.WIN_EPIC; break;
				default:
					break;
			}
		}

		if (effect) {
			this.playSoundEffect(effect);
		}
	}

	/**
	 * Set sound effect volume
	 */
	setSfxVolume(volume: number): void {
		this.sfxVolume = Math.max(0, Math.min(1, volume));
		
		this.sfxInstances.forEach((sfx) => {
			if ('setVolume' in sfx && typeof sfx.setVolume === 'function') {
				sfx.setVolume(this.sfxVolume);
			}
		});
		
		console.log(`[AudioManager] Sound effect volume set to: ${this.sfxVolume}`);
	}

	/** Get sound effect volume. */
	getSfxVolume(): number {
		return this.sfxVolume;
	}

	/** Clean up resources and event listeners. */
	destroy(): void {
		console.log('[AudioManager] Destroying AudioManager...');
		this.stopAllMusic();
		this.musicInstances.clear();
		this.sfxInstances.clear();
		this.ambientInstance = null;
		// Remove visibility handlers
		try {
			if (this.visibilityHandlersInstalled) {
				document.removeEventListener('visibilitychange', this.handleVisibilityChange as any);
				window.removeEventListener('blur', this.handlePageBlur as any);
				window.removeEventListener('focus', this.handlePageFocus as any);
				this.visibilityHandlersInstalled = false;
			}
		} catch {}
		console.log('[AudioManager] AudioManager destroyed');
	}

	// ===== Visibility / Focus handling (in-class) =====
	private installVisibilityHandlers(): void {
		if (this.visibilityHandlersInstalled) return;
		try { document.addEventListener('visibilitychange', this.handleVisibilityChange as any, { passive: true } as any); } catch {}
		try { window.addEventListener('blur', this.handlePageBlur as any, { passive: true } as any); } catch {}
		try { window.addEventListener('focus', this.handlePageFocus as any, { passive: true } as any); } catch {}
		this.visibilityHandlersInstalled = true;
	}

	private handleVisibilityChange = (): void => {
		const hidden = !!(document as any).hidden;
		if (hidden) {
			this.onPageHidden();
		} else {
			this.onPageVisible();
		}
	}

	private handlePageBlur = (): void => {
		this.onPageHidden();
	}

	private handlePageFocus = (): void => {
		this.onPageVisible();
	}

    private onPageHidden(): void {
        if (this.isPageHidden) return;
        this.isPageHidden = true;
        // Start fresh suppression window for one-shots
        try { this.suppressedOneShotCounts.clear(); } catch {}
        // Cancel any pending resume debounce
        if (this.resumeDebounceTimer) { try { clearTimeout(this.resumeDebounceTimer); } catch {} this.resumeDebounceTimer = null; }
        // Save current states
        this.wasPlayingBeforeHide = this.currentMusic;
        this.wasAmbientPlayingBeforeHide = !!(this.ambientInstance && this.ambientInstance.isPlaying);
        // Stop fades
        if (this.duckFadeTimer) { try { clearInterval(this.duckFadeTimer); } catch {} this.duckFadeTimer = null; }
        if (this.restoreFadeTimer) { try { clearInterval(this.restoreFadeTimer); } catch {} this.restoreFadeTimer = null; }
        // Pause bgm
        try { this.musicInstances.forEach((m) => { try { if (m.isPlaying) (m as any).pause?.(); } catch {} }); } catch {}
        // Pause ambient
        try { if (this.ambientInstance && this.ambientInstance.isPlaying) (this.ambientInstance as any).pause?.(); } catch {}
        // Stop SFX and any stray non-music sounds to avoid resume burst
        this.stopAllNonMusic();
    }

    private onPageVisible(): void {
        if (!this.isPageHidden) return;
        this.isPageHidden = false;
        this.ensureAudioContext();
        if (this.isMuted) return;
        if (this.resumeDebounceTimer) { try { clearTimeout(this.resumeDebounceTimer); } catch {} }
        this.resumeDebounceTimer = setTimeout(() => {
            this.resumeDebounceTimer = null;
            try {
                let resumed = false;
                const target: MusicType | null = this.lockedMusic ?? this.wasPlayingBeforeHide ?? null;
                if (target) {
                    const inst = this.musicInstances.get(target);
                    if (inst) {
                        try {
                            // Attempt to resume from paused position (no restart)
                            (inst as any).resume?.();
                            this.currentMusic = target;
                            resumed = true;
                            // Ensure volume is correct after resume
                            if ('setVolume' in inst && typeof (inst as any).setVolume === 'function') {
                                (inst as any).setVolume(this.musicVolume);
                            }
                        } catch {}
                    }
                }
                if (!resumed) {
                    // Fall back to normal logic if nothing to resume
                    if (this.lockedMusic) {
                        this.setExclusiveBackground(this.lockedMusic);
                    } else if (this.wasPlayingBeforeHide) {
                        this.setExclusiveBackground(this.wasPlayingBeforeHide);
                    } else {
                        this.resumeMusicBasedOnGameState();
                    }
                }
            } catch {}
            // Ambient: resume if it was playing before hide; otherwise start if appropriate
            try {
                if (this.wasAmbientPlayingBeforeHide && this.ambientInstance) {
                    try { (this.ambientInstance as any).resume?.(); } catch {}
                    try {
                        if ('setVolume' in this.ambientInstance && typeof (this.ambientInstance as any).setVolume === 'function') {
                            (this.ambientInstance as any).setVolume(this.ambientVolume);
                        }
                    } catch {}
                } else {
                    this.startAmbientAudio();
                }
            } catch {}
            // Flush suppressed one-shots: play at most one per key to avoid burst
            try {
                if (this.suppressedOneShotCounts.size > 0) {
                    const entries = Array.from(this.suppressedOneShotCounts.keys());
                    this.suppressedOneShotCounts.clear();
                    // Space them slightly to avoid concurrent spikes
                    let delay = 0;
                    for (const k of entries) {
                        try { setTimeout(() => { try { this.playOneShot(k); } catch {} }, delay); } catch {}
                        delay += 40; // 40ms between keys
                    }
                }
            } catch {}
        }, 60);
    }

    /** Returns true if background music is active and not muted. */
    isMusicPlaying(): boolean {
        return this.currentMusic !== null && !this.isMuted;
    }
}