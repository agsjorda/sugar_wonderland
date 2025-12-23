import { gameStateManager } from './GameStateManager';

export enum MusicType {
	MAIN = 'main',
	BONUS = 'bonus', 
	FREE_SPIN = 'freespin'
}

export enum SoundEffectType {
	SPIN = 'spin',
	BONUS_SPIN = 'bonus_spin',
	REEL_DROP = 'reeldrop',
	BONUS_REEL_DROP = 'bonus_reeldrop',
	TURBO_DROP = 'turbodrop',
	BONUS_TURBO_DROP = 'bonus_turbodrop',
	WHEEL_SPIN = 'wheelspin',
	MENU_CLICK = 'menu_click',
	HIT_WIN = 'hitwin',
	WILD_MULTI = 'wildmulti',
	SCATTER = 'scatter',
	SCATTER_ANIMATION = 'scatter_animation',
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
	DIALOG_CONGRATS = 'dialog_congrats',

	HIT_WIN_2 = 'hit_win_2_wf',
	HIT_WIN_ALT = 'hit_win_wf',
	MISSILE = 'missile_wf',
	MULTI = 'multi_wf',
	NUKE = 'nuke_wf',
	UTILITY_BUTTON = 'utility_button',

	MULTIPLIER_ADDED = 'multiplier_added',
	MAXW_END = 'maxw_end',
	MAXW = 'maxw',
	TWIN1 = 'twin1',
	TWIN2 = 'twin2',
	TWIN3 = 'twin3',
	TWIN4 = 'twin4',
	MULTIPLIER_HIT = "MULTIPLIER_HIT",
	SYMBOL_KISS = 'symbol_kiss',
	SYMBOL_NYET = 'symbol_nyet',
	SYMBOL_PAU = 'symbol_pau',
	SYMBOL_PUNCH = 'symbol_punch',
}

export class AudioManager {
	private scene: Phaser.Scene;
	private currentMusic: MusicType | null = null;
	private musicVolume: number = 1;
	private sfxVolume: number = 1;
	private ambientVolume: number = 0.5; // Volume for ambient audio layer
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
		this.scene.load.audio('mainbg', 'assets/sounds/BG/mainbg_RF.ogg');
		
		// Bonus background music
		this.scene.load.audio('bonusbg', 'assets/sounds/BG/bonusbg_RF.ogg');
		
		// Free spin background music
		this.scene.load.audio('freespinbg', 'assets/sounds/BG/freespinbg_RF.ogg');
		
		// Ambient audio
		this.scene.load.audio('ambience', 'assets/sounds/SFX/ambience.ogg');
		
		// Sound effects
		this.scene.load.audio('click', 'assets/sounds/click.ogg');
		this.scene.load.audio('reeldrop', 'assets/sounds/SFX/reeldrop_RF.ogg');
		this.scene.load.audio('turbodrop', 'assets/sounds/SFX/turbodrop_RF.ogg');
		
		console.log('[AudioManager] Audio files preloaded successfully');
	}

	/**
	 * Create music and sound effect instances after loading
	 */
	createMusicInstances(): void {
		console.log('[AudioManager] Creating audio instances...');

		const addSfxInstance = (type: SoundEffectType, key: string, loop: boolean = false, volumeMultiplier: number = 1) => {
			try {
				const sfx = this.scene.sound.add(key, { volume: this.sfxVolume * volumeMultiplier, loop });
				this.sfxInstances.set(type, sfx);
				console.log(`[AudioManager] ${key} SFX instance created (multiplier=${volumeMultiplier})`);
			} catch (e) {
				console.warn(`[AudioManager] Failed to create ${key} SFX instance:`, e);
			}
		};

		// Create main background music
		try {
			const mainMusic = this.scene.sound.add('mainbg', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.MAIN, mainMusic);
			console.log('[AudioManager] Main background music instance created');
		} catch (e) {
			console.warn('[AudioManager] Failed to create main background music instance:', e);
		}

		// Create bonus background music
		try {
			const bonusMusic = this.scene.sound.add('bonusbg', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.BONUS, bonusMusic);
			console.log('[AudioManager] Bonus background music instance created');
		} catch (e) {
			console.warn('[AudioManager] Failed to create bonus background music instance:', e);
		}

		// Create free spin background music
		try {
			const freespinMusic = this.scene.sound.add('freespinbg', {
				volume: this.musicVolume,
				loop: true
			});
			this.musicInstances.set(MusicType.FREE_SPIN, freespinMusic);
			console.log('[AudioManager] Free spin background music instance created');
		} catch (e) {
			console.warn('[AudioManager] Failed to create free spin background music instance:', e);
		}

		// Create sound effect instances (use addOptionalSfx for per-instance error handling)
		addSfxInstance(SoundEffectType.SPIN, 'spin');
		addSfxInstance(SoundEffectType.MENU_CLICK, 'click');
		addSfxInstance(SoundEffectType.REEL_DROP, 'reeldrop');
		addSfxInstance(SoundEffectType.TURBO_DROP, 'turbodrop');
		addSfxInstance(SoundEffectType.HIT_WIN, 'hit_win');
		addSfxInstance(SoundEffectType.SCATTER, 'scatter');
		addSfxInstance(SoundEffectType.SCATTER_ANIMATION, 'scatter_animation');
		addSfxInstance(SoundEffectType.SYMBOL_KISS, 'symbol_kiss');
		addSfxInstance(SoundEffectType.SYMBOL_NYET, 'symbol_nyet');
		addSfxInstance(SoundEffectType.SYMBOL_PAU, 'symbol_pau');
		addSfxInstance(SoundEffectType.SYMBOL_PUNCH, 'symbol_punch');
		addSfxInstance(SoundEffectType.MULTIPLIER_HIT, 'multiplier_hit');

		// Win dialog SFX instances
		addSfxInstance(SoundEffectType.WIN_BIG, 'bigw');
		addSfxInstance(SoundEffectType.WIN_MEGA, 'megaw');
		addSfxInstance(SoundEffectType.WIN_SUPER, 'superw');
		addSfxInstance(SoundEffectType.WIN_EPIC, 'epicw');

		// Dialog-specific SFX instances
		addSfxInstance(SoundEffectType.DIALOG_FREESPIN, 'freespin');
		addSfxInstance(SoundEffectType.DIALOG_CONGRATS, 'totalw');

		// Create instances for unused-but-available SFX and win audio keys from AssetConfig
		// ARGUN SFX is intentionally quieter (50% of base SFX volume)
		addSfxInstance(SoundEffectType.MULTIPLIER_ADDED, 'multiplier_added');
		addSfxInstance(SoundEffectType.HIT_WIN_2, 'hit_win_2');
		addSfxInstance(SoundEffectType.HIT_WIN_ALT, 'hit_win_alt');
		addSfxInstance(SoundEffectType.MULTI, 'multi_wf');
		addSfxInstance(SoundEffectType.BONUS_SPIN, 'spin');
		addSfxInstance(SoundEffectType.UTILITY_BUTTON, 'utility_button');

		addSfxInstance(SoundEffectType.MAXW_END, 'maxw_end');
		addSfxInstance(SoundEffectType.MAXW, 'maxw');
		addSfxInstance(SoundEffectType.TWIN1, 'twin1');
		addSfxInstance(SoundEffectType.TWIN2, 'twin2');
		addSfxInstance(SoundEffectType.TWIN3, 'twin3');
		addSfxInstance(SoundEffectType.TWIN4, 'twin4');
		addSfxInstance(SoundEffectType.BONUS_REEL_DROP, 'reeldrop2');
		addSfxInstance(SoundEffectType.BONUS_TURBO_DROP, 'turbodrop2');

		console.log('[AudioManager] Total SFX instances:', this.sfxInstances.size);

		console.log('[AudioManager] All audio instances created (with per-instance error handling)');
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

	playOneShot(sfxType: SoundEffectType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping sound effect');
			return;
		}

		let sfxInstance = this.sfxInstances.get(sfxType);
		let actualSfxType = sfxType;
		
		// If bonus SFX doesn't exist, fallback to non-bonus version
		if (!sfxInstance) {
			const fallbackType = this.getFallbackSfxType(sfxType);
			if (fallbackType) {
				sfxInstance = this.sfxInstances.get(fallbackType);
				actualSfxType = fallbackType;
				if (sfxInstance) {
					console.log(`[AudioManager] Bonus SFX ${sfxType} not found, falling back to ${fallbackType}`);
				}
			}
		}

		const sfxKey = sfxInstance?.key;
		// Special handling for missile SFX so it can play once per scatter symbol (multiple overlapping instances)
		try {
			const oneShotInstance = this.scene.sound.add(sfxKey ?? '', {
			volume: this.sfxVolume,
			loop: false
			});

			oneShotInstance.once('complete', () => {
			try {
				oneShotInstance.destroy();
			} catch { }
			});

			oneShotInstance.play();
			console.log(`[AudioManager] Playing ${actualSfxType} SFX as one-shot instance`);
			return;
		} catch (error) {
			console.warn(`[AudioManager] Failed to play ${actualSfxType} SFX as one-shot instance, falling back to pooled instance:`, error);
			// fall through to pooled-instance logic below
		}
	}

	/**
	 * Get fallback SFX type for bonus-related SFX
	 */
	private getFallbackSfxType(sfxType: SoundEffectType): SoundEffectType | null {
		const bonusToRegularMap: Map<SoundEffectType, SoundEffectType> = new Map([
			[SoundEffectType.BONUS_SPIN, SoundEffectType.SPIN],
			[SoundEffectType.BONUS_REEL_DROP, SoundEffectType.REEL_DROP],
			[SoundEffectType.BONUS_TURBO_DROP, SoundEffectType.TURBO_DROP],
		]);
		return bonusToRegularMap.get(sfxType) || null;
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
		
		let sfx = this.sfxInstances.get(sfxType);
		let actualSfxType = sfxType;
		
		// If bonus SFX doesn't exist, fallback to non-bonus version
		if (!sfx) {
			const fallbackType = this.getFallbackSfxType(sfxType);
			if (fallbackType) {
				sfx = this.sfxInstances.get(fallbackType);
				actualSfxType = fallbackType;
				if (sfx) {
					console.log(`[AudioManager] Bonus SFX ${sfxType} not found, falling back to ${fallbackType}`);
				}
			}
		}
		
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
				console.log(`[AudioManager] Successfully playing ${actualSfxType} sound effect`);
			} catch (error) {
				console.error(`[AudioManager] Error playing ${actualSfxType} sound effect:`, error);
			}
		} else {
			console.warn(`[AudioManager] Sound effect instance not found for type: ${sfxType}`);
		}
	}

	playSingleInstanceSoundEffect(sfxType: SoundEffectType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping sound effect');
			return;
		}

		console.log(`[AudioManager] Attempting to play ${sfxType} sound effect`);
		console.log(`[AudioManager] Available SFX instances:`, Array.from(this.sfxInstances.keys()));
		
		let sfx = this.sfxInstances.get(sfxType);
		let actualSfxType = sfxType;
		
		// If bonus SFX doesn't exist, fallback to non-bonus version
		if (!sfx) {
			const fallbackType = this.getFallbackSfxType(sfxType);
			if (fallbackType) {
				sfx = this.sfxInstances.get(fallbackType);
				actualSfxType = fallbackType;
				if (sfx) {
					console.log(`[AudioManager] Bonus SFX ${sfxType} not found, falling back to ${fallbackType}`);
				}
			}
		}
		
		if (sfx) {
			try {
				if(sfx.isPlaying) {
					return;
				}
				sfx.play();
				console.log(`[AudioManager] Successfully playing ${actualSfxType} sound effect`);
			} catch (error) {
				console.error(`[AudioManager] Error playing ${actualSfxType} sound effect:`, error);
			}
		} else {
			console.warn(`[AudioManager] Sound effect instance not found for type: ${sfxType}`);
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
				case 'bigwin':
					effect = SoundEffectType.WIN_BIG_TURBO; break;
				case 'megawin':
					effect = SoundEffectType.WIN_MEGA_TURBO; break;
				case 'superwin':
					effect = SoundEffectType.WIN_SUPER_TURBO; break;
				case 'epicwin':
					effect = SoundEffectType.WIN_EPIC_TURBO; break;
				case 'maxwin':
					// No turbo-specific MaxWin SFX configured; use the standard MaxWin sound
					effect = SoundEffectType.MAXW; break;
				default:
					break;
			}
		} else {
			switch (t) {
				case 'bigwin':
					effect = SoundEffectType.WIN_BIG; break;
				case 'megawin':
					effect = SoundEffectType.WIN_MEGA; break;
				case 'superwin':
					effect = SoundEffectType.WIN_SUPER; break;
				case 'epicwin':
					effect = SoundEffectType.WIN_EPIC; break;
				case 'maxwin':
					effect = SoundEffectType.MAXW; break;
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
