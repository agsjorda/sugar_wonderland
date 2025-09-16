import { Scene } from 'phaser';
import { Background } from '../components/Background';
import { Symbols } from '../components/Symbols';
import { Buttons } from '../components/Buttons';
import { Backend } from '../../tmp_backend/Backend';
import { BackendEvent, BackendEvents } from '../../tmp_backend/BackendEvent';
import { EventManager } from '../../event/EventManager';
import { Coins } from '../components/Coins';
import { DiscoBallLights } from '../components/DiscoBallLights';
import { KobiAss } from '../components/KobiAss';
import { Debugger } from '../components/Debugger';
import { GameData } from '../components/GameData';
import { Spinner } from '../components/Spinner';
import { BonusBackground } from '../components/BonusBackground';
import { Cat } from '../components/Cat';

export class Game extends Scene {
  private debugger: Debugger;
  private background: Background;
  private bonusBackground: BonusBackground;
  private symbols: Symbols;
  private buttons: Buttons;
  private coins: Coins;
  private discoBallLights: DiscoBallLights;
  private kobiAss: KobiAss;
  private spinner: Spinner;
  private cat: Cat;
  public gameData: GameData;

  constructor ()
  {
    super('Game');
    this.background = new Background();
    this.bonusBackground = new BonusBackground();
    this.symbols = new Symbols();
    this.buttons = new Buttons();
    this.coins = new Coins();
    this.discoBallLights = new DiscoBallLights();
    this.kobiAss = new KobiAss();
    this.spinner = new Spinner();
    this.cat = new Cat();
    this.gameData = new GameData();
  }

  preload() {
    this.debugger = new Debugger();
    this.background.preload(this);
    this.bonusBackground.preload(this);
    this.spinner.preload(this);
    this.symbols.preload(this);
    this.buttons.preload(this);
    this.coins.preload(this);
    this.discoBallLights.preload(this);
    this.kobiAss.preload(this);
    this.cat.preload(this);
    this.load.spritesheet('coin', 'assets/coin.png', {
      frameWidth: 85,
      frameHeight: 85,
    });

    Backend.init();
  }

  create ()
  {
    this.debugger.create();
    this.background.create();
    this.bonusBackground.create(this);
    this.spinner.create(this);
    this.symbols.create();
    this.buttons.create();
    this.coins.create(this);
    this.discoBallLights.create(this);
    this.kobiAss.create(this);
    this.cat.create(this);
    BackendEvent.emit(BackendEvents.START);
    this.shutdown()
  }

  update(time: number, delta: number) {
    this.spinner.update(time, delta);

    Backend.update(delta);
  }

  shutdown() {
    this.events.once('shutdown', () => {
      EventManager.clear();
    });
  }
  
}
