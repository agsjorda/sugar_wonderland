import { Scene } from 'phaser';
import { EventManager, GameEvents } from '../../event/EventManager';
import { Symbols } from '../components/Symbols';
import { MockBackend } from '../../tmp_backend/MockBackend';
import { Buttons } from '../components/Buttons';
import { Background } from '../components/Background';

export class Game extends Scene {
  private background: Background;
  private symbols: Symbols;
  private buttons: Buttons;

  constructor ()
  {
    super('Game');
    this.background = new Background();
    this.symbols = new Symbols();
    this.buttons = new Buttons();
  }

  preload() {
    this.background.preload(this);
    this.symbols.preload(this);
    this.buttons.preload(this);

    this.load.video('video', 'assets/coins.mp4');

    MockBackend.init();
  }

  create ()
  { 
    this.background.create();
    this.symbols.create();
    this.buttons.create();
    EventManager.emit(GameEvents.START_REQUEST);

    // this.createSampleVideo();

    this.shutdown()
  }


  createSampleVideo() {
    let video = this.add.video(this.cameras.main.width / 2, this.cameras.main.height / 2, 'video');
    video.play(true);
    video.setOrigin(0.5, 0.5);

    let scale = this.cameras.main.width / video.width;
    video.setScale(scale);
    video.setDepth(-1);
  }

  shutdown() {
    this.events.once('shutdown', () => {
      EventManager.clear();
    });
  }
  
}
