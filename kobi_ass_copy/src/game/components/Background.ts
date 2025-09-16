import { Scene } from "phaser";

export class Background {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Scene) {
    this.scene = scene;
    this.loadImages();
  }

  loadImages() {
    const PREFIX = 'assets/background/';

    this.scene.load.image('BG-Default', PREFIX + 'BG-Default.png');
    this.scene.load.image('reel-frame', PREFIX + 'reel-frame.png');
    this.scene.load.image('kobi-tent', PREFIX + 'kobi-tent.png');

    this.scene.load.image('balloon-01', PREFIX + 'balloon-01.png');
    this.scene.load.image('balloon-02', PREFIX + 'balloon-02.png');
    this.scene.load.image('balloon-03', PREFIX + 'balloon-03.png');
    this.scene.load.image('balloon-04', PREFIX + 'balloon-04.png');

    this.scene.load.image('kobi-logo', PREFIX + 'kobi-logo.png');

    this.scene.load.image('reel-xmaslight-default', PREFIX + 'reel-xmaslight-default.png');
    this.scene.load.image('bulb-01', PREFIX + 'bulb-01.png');
    this.scene.load.image('bulb-02', PREFIX + 'bulb-02.png');
    this.scene.load.image('bulb-03', PREFIX + 'bulb-03.png');
  }


  public create() {
    this.scene.cameras.main.setBackgroundColor('#FFFFFF');
    
    this.createBackground();
    this.createReelFrame();
    this.createTent();
    this.createBallons();
    this.createLogo();
  }

  private createBackground() {
    this.container = this.scene.add.container(0, 0);

    this.container.add(this.scene.add.image(
      this.scene.scale.width * 0.5, 
      this.scene.scale.height * 0.5, 
      'BG-Default'
    ));
  }

  private createReelFrame() {
    this.scene.add.image(
      this.scene.scale.width * 0.495, 
      this.scene.scale.height * 0.40, 
      'reel-frame'
    );
  }

  private createTent() {
    const tent = this.scene.add.image(
      this.scene.scale.width * 0.5, 
      this.scene.scale.height * 0.0875, 
      'kobi-tent'
    )
    .setDepth(1);
  }

  private createLogo() {
    this.scene.add.image(
      this.scene.scale.width * 0.5, 
      this.scene.scale.height * 0.05, 
      'kobi-logo'
    )
    .setDepth(1);
  }

  private createBallons() {
    this.scene.add.image(
      this.scene.scale.width * 0.04, 
      this.scene.scale.height / 2, 
      'balloon-01'
    );

    this.scene.add.image(
      this.scene.scale.width * 0.06, 
      this.scene.scale.height * 0.3, 
      'balloon-02'
    );

    this.scene.add.image(
      this.scene.scale.width * 0.95, 
      this.scene.scale.height * 0.6, 
      'balloon-03'
    );

    this.scene.add.image(
      this.scene.scale.width * 0.92, 
      this.scene.scale.height * 0.35, 
      'balloon-04'
    );
  }
}
