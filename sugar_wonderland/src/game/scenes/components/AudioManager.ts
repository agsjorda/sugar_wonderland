import { Scene, Sound } from 'phaser';

export class AudioManager {
    private musicVolume: number = 1.0; // Default music volume (0.0 - 1.0)
    private sfxVolume: number = 1.0;   // Default SFX volume (0.0 - 1.0)

    // Background Music
    public MainBG: Sound.WebAudioSound;
    public BonusBG: Sound.WebAudioSound;

    // SFX
    private ClickSFX: Sound.WebAudioSound;
    public ReelDrop: Sound.WebAudioSound;
    public TurboDrop: Sound.WebAudioSound;
    public SpinSFX: Sound.WebAudioSound;
    public UtilityButtonSFX: Sound.WebAudioSound;
    public ScatterSFX: Sound.WebAudioSound;

    // Quick Wins
    private QW1Wins: Sound.WebAudioSound;
    private QW2Wins: Sound.WebAudioSound;
    private QW3Wins: Sound.WebAudioSound;
    private QW4Wins: Sound.WebAudioSound;

    // Win Sounds
    public SmallW: Sound.WebAudioSound;
    public MediumW: Sound.WebAudioSound;
    public BigW: Sound.WebAudioSound;
    public HugeW: Sound.WebAudioSound;
    public BonusW: Sound.WebAudioSound;

    preload(scene: Scene): void {
        const prefixBGMusic = 'assets/Audio/BGMusic';
        const prefixWins = 'assets/Audio/Wins';
        const prefixSFX = 'assets/Audio/SFX';

        // BGMusic
        scene.load.audio('BonusBG', `${prefixBGMusic}/BonusBG_SW.wav`);
        scene.load.audio('MainBG', `${prefixBGMusic}/MainBG_SW.wav`);

        // SFX
        scene.load.audio('ClickSFX', `${prefixSFX}/ClickSFX_SW.wav`);
        scene.load.audio('ReelDrop', `${prefixSFX}/ReelDrop_SW.wav`);
        scene.load.audio('TurboDrop', `${prefixSFX}/TurboDropSFX_SW.wav`);
        scene.load.audio('SpinSFX', `${prefixSFX}/SpinSFX_SW.wav`);
        scene.load.audio('UtilityButtonSFX', `${prefixSFX}/UtilityButtonSFX_SW.wav`);
        scene.load.audio('ScatterSFX', `${prefixSFX}/ScatterSFX_SW.wav`);
        
        // Wins
        scene.load.audio('BigW', `${prefixWins}/BigW_SW.wav`);
        scene.load.audio('BonusW', `${prefixWins}/BonusW_SW.wav`);
        scene.load.audio('HugeW', `${prefixWins}/HugeW_SW.wav`);
        scene.load.audio('MediumW', `${prefixWins}/MediumW_SW.wav`);
        scene.load.audio('SmallW', `${prefixWins}/SmallW_SW.wav`);
        
        // Quick Wins
        scene.load.audio('QW1Wins', `${prefixWins}/QW1_SW.wav`);
        scene.load.audio('QW2Wins', `${prefixWins}/QW2_SW.wav`);
        scene.load.audio('QW3Wins', `${prefixWins}/QW3_SW.wav`);
        scene.load.audio('QW4Wins', `${prefixWins}/QW4_SW.wav`);
    }

    create(scene: Scene): void {
        this.ClickSFX = scene.sound.add('ClickSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.QW1Wins = scene.sound.add('QW1Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.QW2Wins = scene.sound.add('QW2Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.QW3Wins = scene.sound.add('QW3Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.QW4Wins = scene.sound.add('QW4Wins', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.ReelDrop = scene.sound.add('ReelDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TurboDrop = scene.sound.add('TurboDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.SpinSFX = scene.sound.add('SpinSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.UtilityButtonSFX = scene.sound.add('UtilityButtonSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.ScatterSFX = scene.sound.add('ScatterSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;

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
        this.MainBG.play();

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
                this.QW1Wins.play({ volume: this.sfxVolume });
                break;
            case 1:
                this.QW2Wins.play({ volume: this.sfxVolume });
                break;
            case 2:
                this.QW3Wins.play({ volume: this.sfxVolume });
                break;
            case 3:
                this.QW4Wins.play({ volume: this.sfxVolume });
                break;
        }
    }

    playWinSFX(multiplier: number): void {
        if (multiplier < 10) {
            return;
        }
        this.MainBG.pause();

        let winSound: Sound.WebAudioSound | undefined;
        if (multiplier >= 10 && multiplier < 25) {
            winSound = this.SmallW;
        } else if (multiplier >= 25 && multiplier < 50) {
            winSound = this.MediumW;
        } else if (multiplier >= 50 && multiplier < 100) {
            winSound = this.HugeW;
        } else if (multiplier >= 100) {
            winSound = this.BigW;
        }

        if (winSound) {
            winSound.once('complete', () => {
                this.MainBG.resume();
            });
            winSound.play({ volume: this.sfxVolume });
        }
    }

    stopWinSFX(): void {
        this.MainBG.resume();
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
        if (this.QW1Wins) this.QW1Wins.setVolume(this.sfxVolume);
        if (this.QW2Wins) this.QW2Wins.setVolume(this.sfxVolume);
        if (this.QW3Wins) this.QW3Wins.setVolume(this.sfxVolume);
        if (this.QW4Wins) this.QW4Wins.setVolume(this.sfxVolume);
        if (this.ReelDrop) this.ReelDrop.setVolume(this.sfxVolume);
        if (this.SpinSFX) this.SpinSFX.setVolume(this.sfxVolume);
        if (this.UtilityButtonSFX) this.UtilityButtonSFX.setVolume(this.sfxVolume);
        if (this.SmallW) this.SmallW.setVolume(this.sfxVolume);
        if (this.MediumW) this.MediumW.setVolume(this.sfxVolume);
        if (this.BigW) this.BigW.setVolume(this.sfxVolume);
        if (this.HugeW) this.HugeW.setVolume(this.sfxVolume);
        if (this.BonusW) this.BonusW.setVolume(this.sfxVolume);
    }

    getSFXVolume(): number {
        return this.sfxVolume;
    }
} 