import { Scene } from 'phaser';
import { EventManager, GameEvents } from '../../event/EventManager';

export class Game extends Scene
{
  camera: Phaser.Cameras.Scene2D.Camera;
  background: Phaser.GameObjects.Image;
  msg_text : Phaser.GameObjects.Text;

  tmpInterval: number;

  constructor ()
  {
    super('Game');
  }

  preload() {}

  create ()
  {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x00ff00);

    this.background = this.add.image(512, 384, 'background');
    this.background.setAlpha(0.5);

    this.msg_text = this.add.text(512, 384, 'Make something fun!\nand share it with us:\nsupport@phaser.io', {
        fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
        stroke: '#000000', strokeThickness: 8,
        align: 'center'
    });
    this.msg_text.setOrigin(0.5);

    this.sampleEventManagerUsage();

    this.shutdown()
  }

  sampleEventManagerUsage() {
    setTimeout(() => {
      EventManager.emit(GameEvents.INIT);
    }, 10);


    EventManager.on(GameEvents.INIT, () => {
      this.msg_text.setText(GameEvents.INIT);

      setTimeout(() => {
        EventManager.emit(GameEvents.START);
      }, 1000);
    });

    EventManager.on(GameEvents.START, () => {
      this.msg_text.setText(GameEvents.START);

      setTimeout(() => {
        EventManager.emit(GameEvents.SPIN);
      }, 1000);
    });

    EventManager.on(GameEvents.SPIN, () => {
      this.msg_text.setText(GameEvents.SPIN);

      setTimeout(() => {
        EventManager.emit(GameEvents.SPIN_END);
      }, 1000);
    });

    EventManager.on(GameEvents.SPIN_END, () => {
      this.msg_text.setText(GameEvents.SPIN_END);

      setTimeout(() => {
        EventManager.emit(GameEvents.INIT);
      }, 1000);
    });
  }


  shutdown() {
    this.events.once('shutdown', () => {
      EventManager.clear();
    });
  }
  
}
