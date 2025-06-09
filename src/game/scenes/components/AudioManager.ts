import { Scene, Sound } from 'phaser';

export class AudioManager {
    private musicVolume: number = 1.0; // Default music volume (0.0 - 1.0)
    private sfxVolume: number = 1.0;   // Default SFX volume (0.0 - 1.0)

    // Background Music
    public MainBG: Sound.WebAudioSound;
    public BonusBG: Sound.WebAudioSound;
    public BGChecker: Sound.WebAudioSound;

    // SFX
    private ClickSFX: Sound.WebAudioSound;
    public ReelDrop: Sound.WebAudioSound;
    public TurboDrop: Sound.WebAudioSound;
    public SpinSFX: Sound.WebAudioSound;
    public UtilityButtonSFX: Sound.WebAudioSound;
    public ScatterSFX: Sound.WebAudioSound;
    public TExplosion: Sound.WebAudioSound;

    // Quick Wins
    private TW1Wins: Sound.WebAudioSound;
    private TW2Wins: Sound.WebAudioSound;
    private TW3Wins: Sound.WebAudioSound;
    private TW4Wins: Sound.WebAudioSound;


    // Win Sounds
    public SmallW: Sound.WebAudioSound;
    public MediumW: Sound.WebAudioSound;
    public BigW: Sound.WebAudioSound;
    public HugeW: Sound.WebAudioSound;
    public BonusW: Sound.WebAudioSound;
    public FreeSpinWon: Sound.WebAudioSound;
    public WinSkip: Sound.WebAudioSound;


    preload(scene: Scene): void {
        const prefixBGMusic = 'assets/Audio/BGMusic';
        const prefixWins = 'assets/Audio/Wins';
        const prefixSFX = 'assets/Audio/SFX';

        // BGMusic
        scene.load.audio('BonusBG', `${prefixBGMusic}/BonusBG_SW.wav`);
        scene.load.audio('MainBG', `${prefixBGMusic}/MainBG_SW.wav`);
        scene.load.audio('BGChecker', `${prefixBGMusic}/MainBG_SW.wav`);

        // SFX
        scene.load.audio('ClickSFX', `${prefixSFX}/ClickSFX_SW.wav`);
        scene.load.audio('ReelDrop', `${prefixSFX}/ReelDrop_SW.wav`);
        scene.load.audio('TurboDrop', `${prefixSFX}/TurboDropSFX_SW.wav`);
        scene.load.audio('SpinSFX', `${prefixSFX}/SpinSFX_SW.wav`);
        scene.load.audio('UtilityButtonSFX', `${prefixSFX}/UtilityButtonSFX_SW.wav`);
        scene.load.audio('ScatterSFX', `${prefixSFX}/ScatterSFX_SW.wav`);
        scene.load.audio('TExplosion', `${prefixSFX}/TExplosion_SW.wav`);
        
        // Wins
        scene.load.audio('BigW', `${prefixWins}/BigW_SW.wav`);
        scene.load.audio('BonusW', `${prefixWins}/BonusW_SW.wav`);
        scene.load.audio('HugeW', `${prefixWins}/SuperW_SW.wav`);
        scene.load.audio('MediumW', `${prefixWins}/MegaW_SW.wav`);
        scene.load.audio('SmallW', `${prefixWins}/EpicW_SW.wav`);
        scene.load.audio('FreeSpinWon', `${prefixWins}/FreeSpinWon_SW.wav`);
        scene.load.audio('WinSkip', `${prefixWins}/WSkip_SW.wav`);
        
        // Tumble Wins
        scene.load.audio('TW1Wins', `${prefixSFX}/TW1_SW.wav`);
        scene.load.audio('TW2Wins', `${prefixSFX}/TW2_SW.wav`);
        scene.load.audio('TW3Wins', `${prefixSFX}/TW3_SW.wav`);
        scene.load.audio('TW4Wins', `${prefixSFX}/TW4_SW.wav`);
    }

    create(scene: Scene): void {
        this.ClickSFX = scene.sound.add('ClickSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.TW1Wins = scene.sound.add('TW1Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TW2Wins = scene.sound.add('TW2Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TW3Wins = scene.sound.add('TW3Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TW4Wins = scene.sound.add('TW4Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.ReelDrop = scene.sound.add('ReelDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TurboDrop = scene.sound.add('TurboDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.SpinSFX = scene.sound.add('SpinSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.UtilityButtonSFX = scene.sound.add('UtilityButtonSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.ScatterSFX = scene.sound.add('ScatterSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TExplosion = scene.sound.add('TExplosion', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.FreeSpinWon = scene.sound.add('FreeSpinWon', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.WinSkip = scene.sound.add('WinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.SmallW = scene.sound.add('SmallW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.MediumW = scene.sound.add('MediumW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.BigW = scene.sound.add('BigW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.HugeW = scene.sound.add('HugeW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.BonusW = scene.sound.add('BonusW', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.BonusBG = scene.sound.add('BonusBG', { 
            loop: true, 
            volume: this.musicVolume
        }) as Sound.WebAudioSound;
        this.MainBG = scene.sound.add('MainBG', {
            loop: true,
            volume: this.musicVolume
        }) as Sound.WebAudioSound;
        this.BGChecker = scene.sound.add('BGChecker', {
            loop: true,
            volume: 0
        }) as Sound.WebAudioSound;
        this.MainBG.play();
        this.BGChecker.play();

        scene.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
            const clickedButton = gameObjects.find(obj => (obj as any).isButton);
            if (!clickedButton) {
                this.ClickSFX.play({ volume: this.sfxVolume });
            }
        });
    }

    changeBackgroundMusic(scene: Scene): void {
        if (scene.gameData.isBonusRound) {
            this.BonusBG.play();
            this.MainBG.stop();
        } else {
            this.MainBG.play();
            this.BonusBG.stop();
        }
    }

    playRandomQuickWin(): void {
        const randSFX = Math.floor(Math.random() * 4);
        switch (randSFX) {
            case 0:
                this.TW1Wins.play({ volume: this.sfxVolume });
                break;
            case 1:
                this.TW2Wins.play({ volume: this.sfxVolume });
                break;
            case 2:
                this.TW3Wins.play({ volume: this.sfxVolume });
                break;
            case 3:
                this.TW4Wins.play({ volume: this.sfxVolume });
                break;
        }
    }

    playWinSFX(multiplier: number, _scene: Scene): void {
        if(multiplier === -1) {
            this.BGChecker.pause();
            this.setMusicVolume(this.getMusicVolume() * 0.5);
            let winSound: Sound.WebAudioSound | undefined;
            winSound = this.FreeSpinWon;

            if (winSound) {
                winSound.once('complete', () => {
                    this.BGChecker.pause();
                    this.setMusicVolume(this.getMusicVolume() * 0.5);
                });
                winSound.play({ volume: this.sfxVolume });
            }
            return;
        }
        else
        { 
            if (multiplier < 15) {
                return;
            }
            
            this.BGChecker.pause();
            this.setMusicVolume(this.getMusicVolume() * 0.5);

            let winSound: Sound.WebAudioSound | undefined;
            if (multiplier >= 20 && multiplier < 30) {
                winSound = this.SmallW;
            } else if (multiplier >= 30 && multiplier < 50) {
                winSound = this.MediumW;
            } else if (multiplier >= 50 && multiplier < 100) {
                winSound = this.HugeW;
            } else if (multiplier >= 100) {
                winSound = this.BigW;
            }

            if (winSound) {
                winSound.once('complete', () => {
                    
                    this.BGChecker.resume();
                    this.setMusicVolume(this.getMusicVolume() / 0.5);
                    if(this.getMusicVolume() > 1) {
                        this.setMusicVolume(1);
                    }
                });
                winSound.play({ volume: this.sfxVolume });
            }
        }
    }

    stopWinSFX(_scene: Scene): void {   
            this.BGChecker.resume();
            this.setMusicVolume(this.getMusicVolume() / 0.5);
            if(this.getMusicVolume() > 1) {
                this.setMusicVolume(1);
            }
        this.SmallW.stop();
        this.MediumW.stop();
        this.HugeW.stop();
        this.BigW.stop();
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        // Empty implementation
    }

    setMusicVolume(vol: number): void {
        this.musicVolume = vol;
        if (this.MainBG) this.MainBG.setVolume(this.musicVolume);
        if (this.BonusBG) this.BonusBG.setVolume(this.musicVolume);
    }

    getMusicVolume(): number {
        return this.musicVolume;
    }

    setSFXVolume(vol: number): void {
        this.sfxVolume = vol;
        // Update all SFX objects
        if (this.ClickSFX) this.ClickSFX.setVolume(this.sfxVolume);
        if (this.TW1Wins) this.TW1Wins.setVolume(this.sfxVolume);
        if (this.TW2Wins) this.TW2Wins.setVolume(this.sfxVolume);
        if (this.TW3Wins) this.TW3Wins.setVolume(this.sfxVolume);
        if (this.TW4Wins) this.TW4Wins.setVolume(this.sfxVolume);
        if (this.ReelDrop) this.ReelDrop.setVolume(this.sfxVolume);
        if (this.SpinSFX) this.SpinSFX.setVolume(this.sfxVolume);
        if (this.UtilityButtonSFX) this.UtilityButtonSFX.setVolume(this.sfxVolume);
        if (this.SmallW) this.SmallW.setVolume(this.sfxVolume);
        if (this.MediumW) this.MediumW.setVolume(this.sfxVolume);
        if (this.BigW) this.BigW.setVolume(this.sfxVolume);
        if (this.HugeW) this.HugeW.setVolume(this.sfxVolume);
        if (this.BonusW) this.BonusW.setVolume(this.sfxVolume);
        if (this.FreeSpinWon) this.FreeSpinWon.setVolume(this.sfxVolume);
        if (this.WinSkip) this.WinSkip.setVolume(this.sfxVolume);
        if (this.TExplosion) this.TExplosion.setVolume(this.sfxVolume);
        
    }

    getSFXVolume(): number {
        return this.sfxVolume;
    }
} 