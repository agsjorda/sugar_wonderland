import { Scene } from "phaser";


export class Background {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Scene) {
    this.scene = scene;
    loadImages(this);
  }

  public create() {
    this.scene.cameras.main.setBackgroundColor('#FFFFFF');

    this.scene.add.image(0, 0, 'BG-Default')
      .setX(this.scene.scale.width / 2)
      .setY(this.scene.scale.height / 2);

    this.scene.add.image(0, 0, 'kobiass')
      .setX(this.scene.scale.width * 0.18)
      .setY(this.scene.scale.height * 0.7);
  }
}

// preload()
function loadImages(self: Background) {
  const PREFIX = 'assets/background/';

  self.scene.load.image('Bonus-background 1', PREFIX + 'Bonus-background 1.png');
  self.scene.load.image('disco-ball-light 1', PREFIX + 'disco-ball-light 1.png');
  self.scene.load.image('spotlight_r 1', PREFIX + 'spotlight_r 1.png');

  self.scene.load.image('BG-Default', PREFIX + 'BG-Default.png');
  self.scene.load.image('kobiass', PREFIX + 'kobiass.png');
}


