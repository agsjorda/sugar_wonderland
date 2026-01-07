
import Phaser from 'phaser';

export enum MusicType {
	MAIN = 'mainbg_TB',
	BONUS = 'bonusbg_TB',
	FREE_SPIN = 'freespinbg_TB'
}

export enum SoundEffectType {
	CLICK = 'click_sw',
	UTILITY_BUTTON = 'button_fx',
	BUTTON_FX = 'button_fx',
	SPIN = 'spin_button_TB',
	REEL_DROP = 'reel_drop_TB',
	TURBO_DROP = 'turbo_drop_TB',
	CASTLINE = 'castline_TB',
	FISHREEL = 'fishreel_TB',
	EXPLOSION = 'explosion_TB',
	HELLO = 'hello_TB',
	SPLASH = 'splash_TB',
	MULTI_ADD_1 = 'multi_add_1_TB',
	MULTI_ADD_2 = 'multi_add_2_TB',
	MULTI_ADD_3 = 'multi_add_3_TB',
	MULTI_ADD_4 = 'multi_add_4_TB',
	MULTI_FLY = 'multi_fly_TB',
	HIT_WIN = 'hit_win_TB',
	SCATTER = 'scatter_TB',
	SCATTER_HIT = 'scatter_hit_TB',
	WIN_BIG = 'bigw_TB',
	WIN_MEGA = 'megaw_TB',
	WIN_SUPER = 'superw_TB',
	WIN_EPIC = 'epicw_TB',
	DIALOG_CONGRATS = 'congrats_TB'
}

type AnySoundManager = Phaser.Sound.BaseSoundManager & {
	locked?: boolean;
	unlock?: () => void;
	context?: AudioContext;
	webaudio?: { context?: AudioContext };
	pauseOnBlur?: boolean;
	resumeOnFocus?: boolean;
	muteOnPause?: boolean;
};

export class AudioManager {
	private static instances: Set<AudioManager> = new Set();
	private static globalUnlockHandlersInstalled = false;

	private scene: Phaser.Scene;
	private boundSoundManager: AnySoundManager | null = null;

	private musicVolume = 1;
	private sfxVolume = 0.5;
	private duckFactor = 1;

	private currentMusicType: MusicType | null = null;
	private currentMusicSound: Phaser.Sound.BaseSound | null = null;
	private tempMusicStack: Array<{ temp: MusicType; prev: MusicType | null }> = [];
	private musicChangeSeq = 0;
	private pendingMusicTimer: Phaser.Time.TimerEvent | null = null;

	private currentWinSfx: Phaser.Sound.BaseSound | null = null;

	private pendingOps: Array<() => void> = [];
	private pendingDesiredMusic: MusicType | null = null;
	private pendingDesiredMusicFadeMs = 0;
	private lastUnlockAttemptAt = 0;
	private unlockComplete = false;

	constructor(scene: Phaser.Scene) {
		this.scene = scene;
		this.bindSoundManagerFromScene(scene);
		AudioManager.instances.add(this);
		AudioManager.installGlobalUnlockHandlers();
		this.tryUnlockAudio();
	}

	setScene(scene: Phaser.Scene): void {
		const prevMgr = this.boundSoundManager;
		this.scene = scene;
		this.bindSoundManagerFromScene(scene);
		if (prevMgr && this.boundSoundManager && prevMgr !== this.boundSoundManager) {
			try { this.stopCurrentMusic(); } catch {}
			try { this.fadeOutCurrentWinSfx(0); } catch {}
		}
		this.tryUnlockAudio();
	}

	createMusicInstances(): void {
		try { this.scene.cache.audio.exists(String(MusicType.MAIN)); } catch {}
		try { this.scene.cache.audio.exists(String(MusicType.BONUS)); } catch {}
		try { this.scene.cache.audio.exists(String(MusicType.FREE_SPIN)); } catch {}
	}

	getVolume(): number {
		return this.musicVolume;
	}

	setVolume(volume: number): void {
		const v = Phaser.Math.Clamp(Number(volume) || 0, 0, 1);
		this.musicVolume = v;
		this.applyMusicVolume();
	}

	getSfxVolume(): number {
		return this.sfxVolume;
	}

	setSfxVolume(volume: number): void {
		this.sfxVolume = Phaser.Math.Clamp(Number(volume) || 0, 0, 1);
	}

	isAnyMusicPlaying(): boolean {
		try {
			return !!(this.currentMusicSound && this.currentMusicSound.isPlaying);
		} catch {
			return false;
		}
	}

	playBackgroundMusic(music: MusicType, fadeMs: number = 0): void {
		this.pendingDesiredMusic = music;
		this.pendingDesiredMusicFadeMs = Math.max(0, Number(fadeMs) || 0);
		if (this.isLocked()) {
			this.tryUnlockAudio();
			return;
		}
		this.pendingDesiredMusic = null;
		this.pendingDesiredMusicFadeMs = 0;
		this.playBackgroundMusicInternal(music, fadeMs);
	}

	crossfadeTo(music: MusicType, durationMs: number = 0): void {
		this.playBackgroundMusic(music, durationMs);
	}

	beginTemporaryMusic(music: MusicType, fadeMs: number = 0): void {
		try {
			this.tempMusicStack.push({ temp: music, prev: this.currentMusicType });
		} catch {}
		this.crossfadeTo(music, fadeMs);
	}

	endTemporaryMusic(fadeMs: number = 0): void {
		let entry: { temp: MusicType; prev: MusicType | null } | null = null;
		try {
			entry = this.tempMusicStack.length > 0 ? (this.tempMusicStack.pop() as any) : null;
		} catch {
			entry = null;
		}
		if (!entry) {
			this.crossfadeTo(MusicType.MAIN, fadeMs);
			return;
		}
		// Only restore if we're *still* on the temporary track.
		// If another system (e.g. bonus mode) already switched music, do not override it.
		if (this.currentMusicType === entry.temp) {
			this.crossfadeTo(entry.prev || MusicType.MAIN, fadeMs);
		}
	}

	stopCurrentMusic(): void {
		this.musicChangeSeq++;
		try { this.pendingMusicTimer?.destroy(); } catch {}
		this.pendingMusicTimer = null;
		try {
			this.stopAllMusicSounds(null);
			if (this.currentMusicSound) {
				try { this.currentMusicSound.stop(); } catch {}
				try { this.currentMusicSound.destroy(); } catch {}
			}
		} catch {}
		this.currentMusicSound = null;
		this.currentMusicType = null;
	}

	duckBackground(duckToFactor: number): void {
		const f = Phaser.Math.Clamp(Number(duckToFactor) || 0, 0, 1);
		this.duckFactor = f;
		this.applyMusicVolume();
	}

	restoreBackground(durationMs: number = 0): void {
		const from = this.duckFactor;
		const to = 1;
		this.tweenValue(from, to, durationMs, (v) => {
			this.duckFactor = Phaser.Math.Clamp(v, 0, 1);
			this.applyMusicVolume();
		});
	}

	fadeOutCurrentWinSfx(durationMs: number = 0): void {
		const s = this.currentWinSfx;
		this.currentWinSfx = null;
		if (!s) return;
		const stopNow = () => {
			try { s.stop(); } catch {}
			try { s.destroy(); } catch {}
		};
		if (!(durationMs > 0)) {
			stopNow();
			return;
		}
		const start = Number((s as any).volume ?? 1);
		this.tweenValue(start, 0, durationMs, (v) => {
			try { (s as any).setVolume?.(Math.max(0, v)); } catch {}
		}, () => stopNow());
	}

	playSoundEffect(sfx: SoundEffectType | string, cfg?: Phaser.Types.Sound.SoundConfig): void {
		const key = String(sfx);
		this.ensureUnlockedOrQueue(() => {
			this.playSoundEffectInternal(key, cfg);
		});
	}

	playOneShot(key: string, cfg?: Phaser.Types.Sound.SoundConfig): void {
		this.playSoundEffect(key, cfg);
	}

	private bindSoundManagerFromScene(scene: Phaser.Scene): void {
		let mgr: AnySoundManager | null = null;
		try {
			mgr = (scene as any)?.sound as AnySoundManager;
		} catch {
			mgr = null;
		}
		this.boundSoundManager = mgr;
		try {
			if (mgr) {
				mgr.pauseOnBlur = false;
				mgr.resumeOnFocus = false;
				mgr.muteOnPause = false;
			}
		} catch {}
	}

	private getAudioContext(): AudioContext | null {
		const mgr = this.boundSoundManager;
		if (!mgr) return null;
		const anyMgr: any = mgr as any;
		return (anyMgr?.context as AudioContext) || (anyMgr?.webaudio?.context as AudioContext) || null;
	}

	private isLocked(): boolean {
		const mgr = this.boundSoundManager;
		if (!mgr) return true;
		const ctx = this.getAudioContext();
		const state = ctx?.state;
		if (state === 'suspended' || state === 'closed') return true;
		if ((mgr as any).locked === true) return true;
		if (!this.unlockComplete && state !== 'running') return true;
		return false;
	}

	private ensureUnlockedOrQueue(fn: () => void): void {
		if (this.isLocked()) {
			this.pendingOps.push(fn);
			this.tryUnlockAudio();
			return;
		}
		fn();
	}

	private playBackgroundMusicInternal(music: MusicType, fadeMs: number): void {
		if (!this.boundSoundManager) return;
		this.musicChangeSeq++;
		const seq = this.musicChangeSeq;
		try { this.pendingMusicTimer?.destroy(); } catch {}
		this.pendingMusicTimer = null;

		if (this.currentMusicType === music && this.currentMusicSound && this.currentMusicSound.isPlaying) {
			this.applyMusicVolume();
			return;
		}

		const prev = this.currentMusicSound;
		const prevType = this.currentMusicType;
		if (prev) {
			try { this.scene.tweens.killTweensOf(prev as any); } catch {}
		}
		this.stopAllMusicSounds(prev);

		const fade = Math.max(0, Number(fadeMs) || 0);
		if (prev && prev.isPlaying && fade > 0) {
			try {
				(this.scene as any).tweens.add({
					targets: prev as any,
					volume: 0,
					duration: fade,
					ease: 'Linear',
					onComplete: () => {
						if (this.musicChangeSeq !== seq) return;
						try { prev.stop(); } catch {}
						try { prev.destroy(); } catch {}
					}
				});
			} catch {
				try { prev.stop(); } catch {}
				try { prev.destroy(); } catch {}
			}
			try {
				this.pendingMusicTimer = this.scene.time.delayedCall(fade, () => {
					if (this.musicChangeSeq !== seq) return;
					this.startMusicNow(music, fade);
				});
			} catch {
				this.startMusicNow(music, fade);
			}
			return;
		}

		if (prev) {
			try { prev.stop(); } catch {}
			try { prev.destroy(); } catch {}
		}
		if (prevType) {
			this.currentMusicType = null;
		}
		this.currentMusicSound = null;
		this.startMusicNow(music, fade);
	}

	private startMusicNow(music: MusicType, fadeMs: number): void {
		if (!this.boundSoundManager) return;
		const next = this.getOrCreateMusic(music);
		if (!next) return;
		this.currentMusicSound = next;
		this.currentMusicType = music;
		try { (next as any)?.setLoop?.(true); } catch {}
		try { (next as any)?.setVolume?.(0); } catch {}
		try { next.play(); } catch {}
		const targetVol = this.getEffectiveMusicVolume();
		const fade = Math.max(0, Number(fadeMs) || 0);
		try { this.scene.tweens.killTweensOf(next as any); } catch {}
		if (fade > 0) {
			try {
				(this.scene as any).tweens.add({
					targets: next as any,
					volume: targetVol,
					duration: fade,
					ease: 'Linear'
				});
				return;
			} catch {}
		}
		try { (next as any)?.setVolume?.(targetVol); } catch {}
	}

	private stopAllMusicSounds(except?: Phaser.Sound.BaseSound | null): void {
		const mgr: any = this.boundSoundManager as any;
		if (!mgr) return;
		const list: any[] = Array.isArray(mgr.sounds) ? mgr.sounds : (Array.isArray(mgr._sounds) ? mgr._sounds : []);
		if (!Array.isArray(list) || list.length <= 0) return;
		const musicKeys = new Set<string>([String(MusicType.MAIN), String(MusicType.BONUS), String(MusicType.FREE_SPIN)]);
		for (const s of list) {
			try {
				if (!s) continue;
				if (except && s === except) continue;
				const key = String((s as any).key ?? (s as any).assetKey ?? '');
				if (!musicKeys.has(key)) continue;
				try { this.scene.tweens.killTweensOf(s as any); } catch {}
				try { (s as any).stop?.(); } catch {}
				try { (s as any).destroy?.(); } catch {}
			} catch {}
		}
	}

	private getOrCreateMusic(music: MusicType): Phaser.Sound.BaseSound | null {
		if (!this.boundSoundManager) return null;
		const key = String(music);
		try {
			if (!this.scene.cache.audio.exists(key)) {
				return null;
			}
		} catch {
			return null;
		}
		try {
			return this.boundSoundManager.add(key, { loop: true, volume: 0 });
		} catch {
			return null;
		}
	}

	private playSoundEffectInternal(key: string, cfg?: Phaser.Types.Sound.SoundConfig): void {
		if (!this.boundSoundManager) return;
		let has = true;
		try { has = this.scene.cache.audio.exists(key); } catch { has = true; }
		if (!has) {
			try { console.warn('[AudioManager] Missing audio key:', key); } catch {}
		}

		const baseCfg: Phaser.Types.Sound.SoundConfig = {
			volume: this.sfxVolume
		};
		const merged: Phaser.Types.Sound.SoundConfig = {
			...baseCfg,
			...(cfg || {})
		};
		try {
			merged.volume = Phaser.Math.Clamp(Number(merged.volume) || 0, 0, 1);
		} catch {}
		try { (this.boundSoundManager as any).mute = false; } catch {}

		if (key === SoundEffectType.HIT_WIN) {
			let s: Phaser.Sound.BaseSound | null = null;
			try {
				s = this.boundSoundManager.add(key, { ...merged, loop: false, volume: Math.max(0.0001, Number(merged.volume) || 0) });
			} catch {
				s = null;
			}
			if (!s) {
				try { (this.boundSoundManager as any).play?.(key, merged); } catch {}
				return;
			}
			try {
				(s as any).once?.('complete', () => {
					try { s?.destroy(); } catch {}
				});
			} catch {}
			try { s.play(); } catch {}
			try {
				this.scene.time.delayedCall(60, () => {
					try {
						if (!s || (s as any).destroyed) return;
						if ((s as any).isPlaying) return;
						s.play();
					} catch {}
				});
			} catch {}
			return;
		}

		const isWinTier = this.isWinTierKey(key);
		if (!isWinTier) {
			let played = false;
			try {
				const res: any = (this.boundSoundManager as any).play?.(key, merged);
				played = res === true || typeof res === 'undefined';
			} catch {
				played = false;
			}
			if (!played) {
				try {
					const s = (this.boundSoundManager as any).add?.(key, { ...merged, loop: false });
					if (s && typeof s.play === 'function') {
						try { s.play(); } catch {}
					}
				} catch {}
			}
			return;
		}

		try { this.fadeOutCurrentWinSfx(0); } catch {}
		let s: Phaser.Sound.BaseSound | null = null;
		try {
			s = this.boundSoundManager.add(key, { ...merged, loop: false });
		} catch {
			s = null;
		}
		if (!s) {
			try {
				(this.boundSoundManager as any).play?.(key, merged);
			} catch {}
			return;
		}
		this.currentWinSfx = s;
		try { s.play(); } catch {}
	}

	private isWinTierKey(key: string): boolean {
		return key === SoundEffectType.WIN_BIG
			|| key === SoundEffectType.WIN_MEGA
			|| key === SoundEffectType.WIN_EPIC
			|| key === SoundEffectType.WIN_SUPER
			|| key === SoundEffectType.DIALOG_CONGRATS;
	}

	private getEffectiveMusicVolume(): number {
		return Phaser.Math.Clamp((this.musicVolume || 0) * (this.duckFactor || 0), 0, 1);
	}

	private applyMusicVolume(): void {
		const v = this.getEffectiveMusicVolume();
		try { (this.currentMusicSound as any)?.setVolume?.(v); } catch {}
	}

	private tryUnlockAudio(): void {
		const now = Date.now();
		if (now - this.lastUnlockAttemptAt < 60) return;
		this.lastUnlockAttemptAt = now;

		const mgr = this.boundSoundManager;
		if (!mgr) return;

		try { mgr.unlock?.(); } catch {}
		const ctx = this.getAudioContext();
		let resumePromise: any = null;
		try { resumePromise = ctx?.resume?.(); } catch {}
		try { (this.scene.game as any)?.sound?.context?.resume?.(); } catch {}
		try { (this.scene.game as any)?.sound?.webaudio?.context?.resume?.(); } catch {}

		try {
			if (this.scene.cache.audio.exists(SoundEffectType.CLICK)) {
				mgr.play(SoundEffectType.CLICK, { volume: 0, loop: false });
			}
		} catch {}

		const finalize = () => {
			const state = ctx?.state;
			if (state === 'running') {
				try { (mgr as any).locked = false; } catch {}
				this.unlockComplete = true;
				this.flushPending();
			}
		};
		finalize();
		try {
			if (resumePromise && typeof resumePromise.then === 'function') {
				resumePromise.then(() => {
					try { finalize(); } catch {}
				}).catch(() => {});
			}
		} catch {}
	}

	private flushPending(): void {
		if (this.isLocked()) return;
		const ops = this.pendingOps.slice();
		this.pendingOps.length = 0;
		for (const op of ops) {
			try { op(); } catch {}
		}
		try {
			if (this.pendingDesiredMusic) {
				const m = this.pendingDesiredMusic;
				const fadeMs = Math.max(0, Number(this.pendingDesiredMusicFadeMs) || 0);
				this.pendingDesiredMusic = null;
				this.pendingDesiredMusicFadeMs = 0;
				this.playBackgroundMusicInternal(m, fadeMs);
			}
		} catch {}
	}

	private tweenValue(from: number, to: number, durationMs: number, onUpdate: (v: number) => void, onComplete?: () => void): void {
		const scene = this.scene;
		if (!scene || !(durationMs > 0) || !scene.tweens) {
			try { onUpdate(to); } catch {}
			try { onComplete?.(); } catch {}
			return;
		}
		try {
			scene.tweens.addCounter({
				from,
				to,
				duration: Math.max(0, durationMs | 0),
				ease: 'Linear',
				onUpdate: (t) => {
					try { onUpdate((t as any).getValue()); } catch {}
				},
				onComplete: () => {
					try { onComplete?.(); } catch {}
				}
			});
		} catch {
			try { onUpdate(to); } catch {}
			try { onComplete?.(); } catch {}
		}
	}

	private static installGlobalUnlockHandlers(): void {
		if (AudioManager.globalUnlockHandlersInstalled) return;
		AudioManager.globalUnlockHandlersInstalled = true;

		const handler = () => {
			for (const inst of Array.from(AudioManager.instances)) {
				try { inst.tryUnlockAudio(); } catch {}
			}
		};

		try { window.addEventListener('pointerdown', handler, { capture: true, passive: true }); } catch {}
		try { window.addEventListener('touchstart', handler, { capture: true, passive: true }); } catch {}
		try { window.addEventListener('mousedown', handler, { capture: true, passive: true }); } catch {}
		try { window.addEventListener('keydown', handler, { capture: true, passive: true }); } catch {}
		try { document.addEventListener('visibilitychange', handler, { capture: true, passive: true } as any); } catch {}
		try { window.addEventListener('focus', handler, { capture: true, passive: true }); } catch {}
		try { window.addEventListener('pageshow', handler, { capture: true, passive: true } as any); } catch {}
	}
}

