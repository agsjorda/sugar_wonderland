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

export class Game extends Scene {
  private debugger: Debugger;
  private background: Background;
  private symbols: Symbols;
  private buttons: Buttons;
  private coins: Coins;
  private discoBallLights: DiscoBallLights;
  private kobiAss: KobiAss;
  public gameData: GameData;

  constructor ()
  {
    super('Game');
    this.background = new Background();
    this.symbols = new Symbols();
    this.buttons = new Buttons();
    this.coins = new Coins();
    this.discoBallLights = new DiscoBallLights();
    this.kobiAss = new KobiAss();
    this.gameData = new GameData();
  }

  preload() {
    this.debugger = new Debugger();
    this.background.preload(this);
    this.symbols.preload(this);
    this.buttons.preload(this);
    this.coins.preload(this);
    this.discoBallLights.preload(this);
    this.kobiAss.preload(this);
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
    this.symbols.create();
    this.buttons.create();
    this.coins.create(this);
    this.discoBallLights.create(this);
    this.kobiAss.create(this);

    BackendEvent.emit(BackendEvents.START);
    this.shutdown()
  }

  shutdown() {
    this.events.once('shutdown', () => {
      EventManager.clear();
    });
  }
  
}
