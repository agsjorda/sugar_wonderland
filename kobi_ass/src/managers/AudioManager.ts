import { gameStateManager } from './GameStateManager';

export enum MusicType {
	MAIN = 'main',
	BONUS = 'bonus', 
	FREE_SPIN = 'freespin'
}

export enum SoundEffectType {
	SPIN = 'spin',
	REEL_DROP = 'reeldrop',
	TURBO_DROP = 'turbodrop',
	WHEEL_SPIN = 'wheelspin',
	HIT_WIN = 'hitwin',
	WILD_MULTI = 'wildmulti',
	SCATTER = 'scatter',
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
	private musicVolume: number = 0.5;
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

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		console.log('[AudioManager] AudioManager initialized');
	}

	/**
	 * Preload all background music and sound effect files
	 */
	preloadMusic(): void {
		console.log('[AudioManager] Preloading audio files...');
		
		// Main background music
		this.scene.load.audio('mainbg_ka', 'assets/sounds/BG/mainbg_ka.ogg');
		
		// Bonus background music
		this.scene.load.audio('bonusbg_ka', 'assets/sounds/BG/bonusbg_ka.ogg');
		
		// Free spin background music
		this.scene.load.audio('freespinbg_ka', 'assets/sounds/BG/freespinbg_ka.ogg');
		
		// Ambient audio
		this.scene.load.audio('ambience_ka', 'assets/sounds/SFX/ambience_ka.ogg');
		
		// Sound effects
		this.scene.load.audio('spinb_ka', 'assets/sounds/SFX/spinb_ka.ogg');
		this.scene.load.audio('reeldrop_ka', 'assets/sounds/SFX/reeldrop_ka.ogg');
		this.scene.load.audio('turbodrop_ka', 'assets/sounds/SFX/turbodrop_ka.ogg');
		this.scene.load.audio('coin_throw_ka', 'assets/sounds/SFX/coin_throw_ka.ogg');
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
			const mainMusic = this.scene.sound.add('mainbg_ka', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.MAIN, mainMusic);
			console.log('[AudioManager] Main background music instance created');

			// Create bonus background music
			const bonusMusic = this.scene.sound.add('bonusbg_ka', {
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

			// Create sound effect instances
			const spinSfx = this.scene.sound.add('spinb_ka', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.SPIN, spinSfx);
			console.log('[AudioManager] Spin sound effect instance created');

			const reelDropSfx = this.scene.sound.add('reeldrop_ka', {
				volume: this.sfxVolume,
				loop: false
			});
			this.sfxInstances.set(SoundEffectType.REEL_DROP, reelDropSfx);
			console.log('[AudioManager] Reel drop sound effect instance created');

			const turboDropSfx = this.scene.sound.add('turbodrop_ka', {
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

			// Create coin throw SFX instance
			try {
				const coinThrow = this.scene.sound.add('coin_throw_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.COIN_THROW, coinThrow);
				console.log('[AudioManager] Coin throw SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create coin_throw_ka SFX instance:', e);
			}

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
				const hitWin = this.scene.sound.add('hitwin_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.HIT_WIN, hitWin);
				console.log('[AudioManager] Hit win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create hitwin_ka SFX instance:', e);
			}

			// Create wild multi SFX instance
			try {
				const wildMulti = this.scene.sound.add('wildmulti_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.WILD_MULTI, wildMulti);
				console.log('[AudioManager] Wild multi SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create wildmulti_ka SFX instance:', e);
			}

			// Create scatter SFX instance
			try {
				const scatter = this.scene.sound.add('scatter_ka', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.SCATTER, scatter);
				console.log('[AudioManager] Scatter SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create scatter_ka SFX instance:', e);
			}

			// Create win dialog SFX instances
			const bigWinSfx = this.scene.sound.add('bigw_ka', { volume: this.sfxVolume, loop: false });
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
			this.ambientInstance = this.scene.sound.add('ambience_ka', {
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
	 * Play background music based on game state
	 */
	playBackgroundMusic(musicType: MusicType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping music playback');
			return;
		}

		// Stop current music if playing
		this.stopCurrentMusic();

		const music = this.musicInstances.get(musicType);
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

		console.log(`[AudioManager] Attempting to play ${sfxType} sound effect`);
		console.log(`[AudioManager] Available SFX instances:`, Array.from(this.sfxInstances.keys()));
		
		const sfx = this.sfxInstances.get(sfxType);
		if (sfx) {
			try {
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

	/**
	 * Get sound effect volume
	 */
	getSfxVolume(): number {
		return this.sfxVolume;
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		console.log('[AudioManager] Destroying AudioManager...');
		this.stopAllMusic();
		this.musicInstances.clear();
		this.sfxInstances.clear();
		this.ambientInstance = null;
		console.log('[AudioManager] AudioManager destroyed');
	}

	/**
	 * Get current playing music type
	 */
	getCurrentMusicType(): MusicType | null {
		return this.currentMusic;
	}

	/**
	 * Check if any music is currently playing
	 */
	isMusicPlaying(): boolean {
		return this.currentMusic !== null && !this.isMuted;
	}
}
