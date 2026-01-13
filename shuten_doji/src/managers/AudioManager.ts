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
	
	TURBO_REEL_DROP = 'turbodrop',
	BONUS_TURBO_REEL_DROP = 'bonus_turbodrop',
	WHEEL_SPIN = 'wheelspin',
	MENU_CLICK = 'menu_click',
	SCATTER = 'scatter',
	ANTICIPATION = 'anticipation',
	WIN_LINE_1 = 'winline_1',
	WIN_LINE_2 = 'winline_2',
	// Win dialog effects
	WIN_BIG = 'win_big',
	WIN_MEGA = 'win_mega',
	WIN_SUPER = 'win_super',
	WIN_EPIC = 'win_epic',

	DIALOG_FREESPIN = 'dialog_freespin',
	DIALOG_CONGRATS = 'dialog_congrats',

	// Unused SFX assets from AssetConfig (for future wiring)
	MULTI = 'multi_wf',
	UB_WIN = 'ub_win_wf',

	// Unused Win assets from AssetConfig (for future wiring)
	MULTIPLIER_ADDED = 'multiplier_added_wf',
	MAXW_END = 'maxw_end_wf',
	MAXW = 'maxw_wf',

	TWIN1 = 'twin1',
	TWIN2 = 'twin2',
	TWIN3 = 'twin3',
	TWIN4 = 'twin4',
}

export class AudioManager {
	private scene: Phaser.Scene;
	private currentMusic: MusicType | null = null;
	private musicVolume: number = 1;
	private sfxVolume: number = 1;
	private ambientVolume: number = 0.3; // Volume for ambient audio layer
	private cachedMusicVolume: number = 0.2;
	private cachedSfxVolume: number = 0.2;
	private cachedAmbientVolume: number = 0.3;
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
	 * Check if an audio key is loaded and ready
	 */
	private isAudioReady(key: string): boolean {
		try {
			return this.scene.cache.audio.has(key);
		} catch (e) {
			return false;
		}
	}

	/**
	 * Try to create audio instances for any newly loaded audio files
	 */
	tryCreateInstancesForReadyAudio(): void {
		// Try to create instances for music that's now ready
		if (!this.musicInstances.has(MusicType.MAIN) && this.isAudioReady('mainbg')) {
			try {
				const mainMusic = this.scene.sound.add('mainbg', {
					volume: this.musicVolume,
					loop: true
				});
				this.musicInstances.set(MusicType.MAIN, mainMusic);
				console.log('[AudioManager] Main background music instance created (lazy loaded)');
			} catch (e) {
				console.warn('[AudioManager] Failed to create main background music instance:', e);
			}
		}

		if (!this.musicInstances.has(MusicType.BONUS) && this.isAudioReady('bonusbg')) {
			try {
				const bonusMusic = this.scene.sound.add('bonusbg', {
					volume: this.musicVolume,
					loop: true
				});
				this.musicInstances.set(MusicType.BONUS, bonusMusic);
				console.log('[AudioManager] Bonus background music instance created (lazy loaded)');
			} catch (e) {
				console.warn('[AudioManager] Failed to create bonus background music instance:', e);
			}
		}

		if (!this.musicInstances.has(MusicType.FREE_SPIN) && this.isAudioReady('freespinbg')) {
			try {
				const freespinMusic = this.scene.sound.add('freespinbg', {
					volume: this.musicVolume,
					loop: true
				});
				this.musicInstances.set(MusicType.FREE_SPIN, freespinMusic);
				console.log('[AudioManager] Free spin background music instance created (lazy loaded)');
			} catch (e) {
				console.warn('[AudioManager] Failed to create free spin background music instance:', e);
			}
		}

		// Try to create ambient audio if ready
		if (!this.ambientInstance && this.isAudioReady('ambience')) {
			try {
				this.ambientInstance = this.scene.sound.add('ambience', {
					volume: this.ambientVolume,
					loop: true
				});
				console.log('[AudioManager] Ambient audio instance created (lazy loaded)');
			} catch (e) {
				console.warn('[AudioManager] Failed to create ambient audio instance:', e);
			}
		}

		// Try to create SFX instances for commonly used sounds
		this.tryCreateSfxInstance(SoundEffectType.SPIN, 'spin');
		this.tryCreateSfxInstance(SoundEffectType.MENU_CLICK, 'click');
		this.tryCreateSfxInstance(SoundEffectType.REEL_DROP, 'reeldrop');
		this.tryCreateSfxInstance(SoundEffectType.TURBO_REEL_DROP, 'turbodrop');
		this.tryCreateSfxInstance(SoundEffectType.SCATTER, 'scatter');
		this.tryCreateSfxInstance(SoundEffectType.WIN_BIG, 'bigw');
		this.tryCreateSfxInstance(SoundEffectType.WIN_MEGA, 'megaw');
		this.tryCreateSfxInstance(SoundEffectType.WIN_SUPER, 'superw');
		this.tryCreateSfxInstance(SoundEffectType.WIN_EPIC, 'epicw');
		this.tryCreateSfxInstance(SoundEffectType.DIALOG_FREESPIN, 'freespinbg');
		this.tryCreateSfxInstance(SoundEffectType.DIALOG_CONGRATS, 'congrats');

		// Try to create optional SFX instances
		this.tryCreateSfxInstance(SoundEffectType.MULTIPLIER_ADDED, 'multiplier_added');
		this.tryCreateSfxInstance(SoundEffectType.MULTI, 'multi');
		this.tryCreateSfxInstance(SoundEffectType.UB_WIN, 'ub');
		this.tryCreateSfxInstance(SoundEffectType.MAXW_END, 'maxw_end');
		this.tryCreateSfxInstance(SoundEffectType.MAXW, 'maxw');
		this.tryCreateSfxInstance(SoundEffectType.TWIN1, 'twin1');
		this.tryCreateSfxInstance(SoundEffectType.TWIN2, 'twin2');
		this.tryCreateSfxInstance(SoundEffectType.TWIN3, 'twin3');
		this.tryCreateSfxInstance(SoundEffectType.TWIN4, 'twin4');
	}

	/**
	 * Try to create an SFX instance if the audio is ready and instance doesn't exist
	 */
	private tryCreateSfxInstance(type: SoundEffectType, key: string, loop: boolean = false, volumeMultiplier: number = 1): void {
		if (!this.sfxInstances.has(type) && this.isAudioReady(key)) {
			try {
				const sfx = this.scene.sound.add(key, { volume: this.sfxVolume * volumeMultiplier, loop });
				this.sfxInstances.set(type, sfx);
				console.log(`[AudioManager] ${key} SFX instance created (lazy loaded, multiplier=${volumeMultiplier})`);
			} catch (e) {
				console.warn(`[AudioManager] Failed to create ${key} SFX instance:`, e);
			}
		}
	}

	/**
	 * Preload all background music and sound effect files
	 */
	preloadMusic(): void {
		console.log('[AudioManager] Preloading audio files...');
		
		// Main background music
		this.scene.load.audio('mainbg', 'assets/sounds/BG/mainbg.ogg');
		
		// Bonus background music
		this.scene.load.audio('bonusbg', 'assets/sounds/BG/bonusbg.ogg');
		
		// Free spin background music
		this.scene.load.audio('freespinbg', 'assets/sounds/BG/freespinbg.ogg');
		
		// Ambient audio
		this.scene.load.audio('ambience', 'assets/sounds/SFX/ambience.ogg');
		
		// Sound effects
		this.scene.load.audio('spin', 'assets/sounds/SFX/spin.ogg');
		this.scene.load.audio('click', 'assets/sounds/click.ogg');
		this.scene.load.audio('reeldrop', 'assets/sounds/SFX/reeldrop.ogg');
		this.scene.load.audio('turbodrop', 'assets/sounds/SFX/turbodrop.ogg');
		
		console.log('[AudioManager] Audio files preloaded successfully');
	}

	/**
	 * Create music and sound effect instances after loading
	 * Now handles lazy loading - only creates instances for audio that's ready
	 */
	createMusicInstances(): void {
		console.log('[AudioManager] Creating audio instances (checking readiness)...');
		
		// Try to create instances for any ready audio
		this.tryCreateInstancesForReadyAudio();

		const addOptionalSfx = (type: SoundEffectType, key: string, loop: boolean = false, volumeMultiplier: number = 1) => {
			// Only create if audio is ready
			if (!this.isAudioReady(key)) {
				console.log(`[AudioManager] ${key} not ready yet, skipping instance creation`);
				return;
			}
			try {
				const sfx = this.scene.sound.add(key, { volume: this.sfxVolume * volumeMultiplier, loop });
				this.sfxInstances.set(type, sfx);
				console.log(`[AudioManager] ${key} SFX instance created (multiplier=${volumeMultiplier})`);
			} catch (e) {
				console.warn(`[AudioManager] Failed to create ${key} SFX instance:`, e);
			}
		};

		// Create main background music (if ready)
		if (this.isAudioReady('mainbg')) {
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
		} else {
			console.log('[AudioManager] Main background music not ready yet');
		}

		// Create bonus background music (if ready)
		if (this.isAudioReady('bonusbg')) {
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
		} else {
			console.log('[AudioManager] Bonus background music not ready yet');
		}

		// Create free spin background music (if ready)
		if (this.isAudioReady('freespinbg')) {
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
		} else {
			console.log('[AudioManager] Free spin background music not ready yet');
		}

		// Create sound effect instances (only if ready)
		if (this.isAudioReady('spin')) {
			try {
				const spinSfx = this.scene.sound.add('spin', {
					volume: this.sfxVolume,
					loop: false
				});
				this.sfxInstances.set(SoundEffectType.SPIN, spinSfx);
				console.log('[AudioManager] Spin sound effect instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create spin_wf SFX instance:', e);
			}
		}

		// Menu click SFX
		if (this.isAudioReady('click')) {
			try {
				const clickSfx = this.scene.sound.add('click', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.MENU_CLICK, clickSfx);
				console.log('[AudioManager] Menu click SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create click_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('reeldrop')) {
			try {
				const reelDropSfx = this.scene.sound.add('reeldrop', {
					volume: this.sfxVolume,
					loop: false
				});
				this.sfxInstances.set(SoundEffectType.REEL_DROP, reelDropSfx);
				console.log('[AudioManager] Reel drop sound effect instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create reeldrop_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('turbodrop')) {
			try {
				const turboDropSfx = this.scene.sound.add('turbodrop', {
					volume: this.sfxVolume,
					loop: false
				});
				this.sfxInstances.set(SoundEffectType.TURBO_REEL_DROP, turboDropSfx);
				console.log('[AudioManager] Turbo drop sound effect instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create turbodrop_wf SFX instance:', e);
			}
		}

		// Create scatter SFX instance
		if (this.isAudioReady('scatter')) {
			try {
				const scatter = this.scene.sound.add('scatter', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.SCATTER, scatter);
				console.log('[AudioManager] Scatter SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create scatter SFX instance:', e);
			}
		}

		// Create win dialog SFX instances
		if (this.isAudioReady('bigw')) {
			try {
				const bigWinSfx = this.scene.sound.add('bigw', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.WIN_BIG, bigWinSfx);
				console.log('[AudioManager] Big win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create bigw_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('megaw')) {
			try {
				const megaWinSfx = this.scene.sound.add('megaw', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.WIN_MEGA, megaWinSfx);
				console.log('[AudioManager] Mega win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create megaw_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('superw')) {
			try {
				const superWinSfx = this.scene.sound.add('superw', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.WIN_SUPER, superWinSfx);
				console.log('[AudioManager] Super win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create superw_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('epicw')) {
			try {
				const epicWinSfx = this.scene.sound.add('epicw', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.WIN_EPIC, epicWinSfx);
				console.log('[AudioManager] Epic win SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create epicw_wf SFX instance:', e);
			}
		}

		// Create dialog-specific SFX instances
		if (this.isAudioReady('freespinbg')) {
			try {
				const freeSpinDlg = this.scene.sound.add('freespinbg', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.DIALOG_FREESPIN, freeSpinDlg);
				console.log('[AudioManager] Free spin dialog SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create freespin_wf SFX instance:', e);
			}
		}

		if (this.isAudioReady('congrats')) {
			try {
				const congratsDlg = this.scene.sound.add('congrats', { volume: this.sfxVolume, loop: false });
				this.sfxInstances.set(SoundEffectType.DIALOG_CONGRATS, congratsDlg);
				console.log('[AudioManager] Congrats dialog SFX instance created');
			} catch (e) {
				console.warn('[AudioManager] Failed to create congrats_wf SFX instance:', e);
			}
		}

		// Create instances for unused-but-available SFX and win audio keys from AssetConfig
		// ARGUN SFX is intentionally quieter (50% of base SFX volume)
		addOptionalSfx(SoundEffectType.MULTIPLIER_ADDED, 'multiplier_added');
		addOptionalSfx(SoundEffectType.MULTI, 'multi');
		addOptionalSfx(SoundEffectType.UB_WIN, 'ub');

		addOptionalSfx(SoundEffectType.MAXW_END, 'maxw_end');
		addOptionalSfx(SoundEffectType.MAXW, 'maxw');
		addOptionalSfx(SoundEffectType.TWIN1, 'twin1');
		addOptionalSfx(SoundEffectType.TWIN2, 'twin2');
		addOptionalSfx(SoundEffectType.TWIN3, 'twin3');
		addOptionalSfx(SoundEffectType.TWIN4, 'twin4');

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

		// Try to create instances for any newly loaded audio
		this.tryCreateInstancesForReadyAudio();

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
			// Audio might not be ready yet - log but don't error
			console.log(`[AudioManager] Music instance not ready yet for type: ${musicType} (will play when ready)`);
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

		const sfxKey = this.sfxInstances.get(sfxType)?.key;
		// Special handling for missile SFX so it can play once per scatter symbol (multiple overlapping instances)
		try {
			const sfxInstance = this.scene.sound.add(sfxKey ?? '', {
			volume: this.sfxVolume,
			loop: false
			});

			sfxInstance.once('complete', () => {
			try {
				sfxInstance.destroy();
			} catch { }
			});

			sfxInstance.play();
			console.log('[AudioManager] Playing MISSILE SFX as one-shot instance');
			return;
		} catch (error) {
			console.warn('[AudioManager] Failed to play MISSILE SFX as one-shot instance, falling back to pooled instance:', error);
			// fall through to pooled-instance logic below
		}
	}

	/**
	 * Play a sound effect
	 */
	playSoundEffect(sfxType: SoundEffectType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping sound effect');
			return;
		}

		// Try to create instances for any newly loaded audio
		this.tryCreateInstancesForReadyAudio();

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
			// Audio might not be ready yet - log but don't error
			console.log(`[AudioManager] Sound effect instance not ready yet for type: ${sfxType} (will play when ready)`);
		}
	}

	playSingleInstanceSoundEffect(sfxType: SoundEffectType): void {
		if (this.isMuted) {
			console.log('[AudioManager] Audio is muted, skipping sound effect');
			return;
		}

		console.log(`[AudioManager] Attempting to play ${sfxType} sound effect`);
		console.log(`[AudioManager] Available SFX instances:`, Array.from(this.sfxInstances.keys()));
		
		const sfx = this.sfxInstances.get(sfxType);
		if (sfx) {
			try {
				if(sfx.isPlaying) {
					return;
				}
				sfx.play();
				console.log(`[AudioManager] Successfully playing ${sfxType} sound effect`);
			} catch (error) {
				console.error(`[AudioManager] Error playing ${sfxType} sound effect:`, error);
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

		{
		// if (isAuto && isTurbo) {
		// 	switch (t) {
		// 		case 'bigwin':
		// 			effect = SoundEffectType.WIN_BIG_TURBO; break;
		// 		case 'megawin':
		// 			effect = SoundEffectType.WIN_MEGA_TURBO; break;
		// 		case 'superwin':
		// 			effect = SoundEffectType.WIN_SUPER_TURBO; break;
		// 		case 'epicwin':
		// 			effect = SoundEffectType.WIN_EPIC_TURBO; break;
		// 		default:
		// 			break;
		// 	}
		// } else {
		// 	switch (t) {
		// 		case 'bigwin':
		// 			effect = SoundEffectType.WIN_BIG; break;
		// 		case 'megawin':
		// 			effect = SoundEffectType.WIN_MEGA; break;
		// 		case 'superwin':
		// 			effect = SoundEffectType.WIN_SUPER; break;
		// 		case 'epicwin':
		// 			effect = SoundEffectType.WIN_EPIC; break;
		// 		default:
		// 			break;
		// 	}
		// }
		}
	
		switch (t) {
			case 'bigwin':
				effect = SoundEffectType.WIN_BIG; break;
			case 'megawin':
				effect = SoundEffectType.WIN_MEGA; break;
			case 'superwin':
				effect = SoundEffectType.WIN_SUPER; break;
			case 'epicwin':
				effect = SoundEffectType.WIN_EPIC; break;
			default:
				break;
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

	cacheSfxVolume(): void {
		this.cachedSfxVolume = this.sfxVolume;
	}

	cacheMusicVolume(): void {
		this.cachedMusicVolume = this.musicVolume;
	}

	cacheAmbientVolume(): void {
		this.cachedAmbientVolume = this.ambientVolume;
	}

	restoreSfxVolume(): void {
		this.sfxVolume = this.cachedSfxVolume;
	}
	
	restoreMusicVolume(): void {
		this.musicVolume = this.cachedMusicVolume;
	}
	
	restoreAmbientVolume(): void {
		this.ambientVolume = this.cachedAmbientVolume;
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
