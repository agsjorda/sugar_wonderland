export class AudioManager {
  constructor() {
    this.musicVolume = 1.0; // Default music volume (0.0 - 1.0)
    this.sfxVolume = 1.0;   // Default SFX volume (0.0 - 1.0)
  }

  preload(scene) {
    const prefixBGMusic = 'assets/Audio/BGMusic';
    const prefixWins = 'assets/Audio/Wins';
    const prefixSFX = 'assets/Audio/SFX';

    // BGMusic
    scene.load.audio('BonusBG', prefixBGMusic + '/BonusBG_SW.wav');
    scene.load.audio('MainBG', prefixBGMusic + '/MainBG_SW.wav');

    // SFX
    scene.load.audio('ClickSFX', prefixSFX + '/ClickSFX_SW.wav');
    scene.load.audio('ReelDrop', prefixSFX + '/ReelDrop_SW.wav');
    scene.load.audio('TurboDrop', prefixSFX + '/TurboDropSFX_SW.wav');
    scene.load.audio('SpinSFX', prefixSFX + '/SpinSFX_SW.wav');
    scene.load.audio('UtilityButtonSFX', prefixSFX + '/UtilityButtonSFX_SW.wav');
    scene.load.audio('ScatterSFX', prefixSFX + '/ScatterSFX_SW.wav');
    
    // Wins
    scene.load.audio('BigW', prefixWins + '/BigW_SW.wav');
    scene.load.audio('BonusW', prefixWins + '/BonusW_SW.wav');
    scene.load.audio('HugeW', prefixWins + '/HugeW_SW.wav');
    scene.load.audio('MediumW', prefixWins + '/MediumW_SW.wav');
    scene.load.audio('SmallW', prefixWins + '/SmallW_SW.wav');
    
    // Quick Wins
    scene.load.audio('QW1Wins', prefixWins + '/QW1_SW.wav');
    scene.load.audio('QW2Wins', prefixWins + '/QW2_SW.wav');
    scene.load.audio('QW3Wins', prefixWins + '/QW3_SW.wav');
    scene.load.audio('QW4Wins', prefixWins + '/QW4_SW.wav');

  }

  create(scene) {
    this.ClickSFX = scene.sound.add('ClickSFX', { volume: this.sfxVolume });

    this.QW1Wins = scene.sound.add('QW1Wins', { volume: this.sfxVolume });
    this.QW2Wins = scene.sound.add('QW2Wins', { volume: this.sfxVolume });
    this.QW3Wins = scene.sound.add('QW3Wins', { volume: this.sfxVolume });
    this.QW4Wins = scene.sound.add('QW4Wins', { volume: this.sfxVolume });

    this.ReelDrop = scene.sound.add('ReelDrop', { volume: this.sfxVolume });
    this.TurboDrop = scene.sound.add('TurboDrop', { volume: this.sfxVolume });
    this.SpinSFX = scene.sound.add('SpinSFX', { volume: this.sfxVolume });
    this.UtilityButtonSFX = scene.sound.add('UtilityButtonSFX', { volume: this.sfxVolume });
    this.ScatterSFX = scene.sound.add('ScatterSFX', { volume: this.sfxVolume });

    this.SmallW = scene.sound.add('SmallW', { volume: this.sfxVolume });
    this.MediumW = scene.sound.add('MediumW', { volume: this.sfxVolume });
    this.BigW = scene.sound.add('BigW', { volume: this.sfxVolume });
    this.HugeW = scene.sound.add('HugeW', { volume: this.sfxVolume });
    this.BonusW = scene.sound.add('BonusW', { volume: this.sfxVolume });

    this.BonusBG = scene.sound.add('BonusBG', { 
      loop: true, 
      volume: this.musicVolume
     });
    this.MainBG = scene.sound.add('MainBG', {
        loop: true,
        volume: this.musicVolume
    });
    this.MainBG.play();

    scene.input.on('pointerdown', (pointer, gameObjects) => {
        const clickedButton = gameObjects.find(obj=>obj.isButton);
        if(!clickedButton) 
            this.ClickSFX.play({ volume: this.sfxVolume });
    });
  }

  changeBackgroundMusic(scene) {
    if(scene.gameData.isBonusRound) {
      this.BonusBG.play();
      this.MainBG.stop();
    } else {
      this.MainBG.play();
      this.BonusBG.stop();
    }
  }

  playRandomQuickWin() {
    const randSFX = Math.floor(Math.random() * 4);
    if(randSFX == 0) {
        this.QW1Wins.play({ volume: this.sfxVolume });
    } else if(randSFX == 1) {
        this.QW2Wins.play({ volume: this.sfxVolume });
    } else if(randSFX == 2) {
        this.QW3Wins.play({ volume: this.sfxVolume });
    } else if(randSFX == 3) {
        this.QW4Wins.play({ volume: this.sfxVolume });
    }    
  }

  playWinSFX(multiplier) {
    if(multiplier < 10) {
      return;
    }
    this.MainBG.pause();

    let winSound;
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

  stopWinSFX() {
    this.MainBG.resume();
    this.SmallW.stop();
    this.MediumW.stop();
    this.HugeW.stop();
    this.BigW.stop();
  }

  update(scene, time, delta) {
  }

  setMusicVolume(vol) {
    this.musicVolume = vol;
    if (this.MainBG) this.MainBG.setVolume(this.musicVolume);
    if (this.BonusBG) this.BonusBG.setVolume(this.musicVolume);
  }

  setSFXVolume(vol) {
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
}