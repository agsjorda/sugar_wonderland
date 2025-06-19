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

    this.scene.load.image('Bonus-background 1', PREFIX + 'Bonus-background 1.png');
    this.scene.load.image('disco-ball-light 1', PREFIX + 'disco-ball-light 1.png');
    this.scene.load.image('spotlight_r 1', PREFIX + 'spotlight_r 1.png');

    this.scene.load.image('BG-Default', PREFIX + 'BG-Default.png');
    this.scene.load.image('reel-frame', PREFIX + 'reel-frame.png');
    this.scene.load.image('kobi-tent', PREFIX + 'kobi-tent.png');
    this.scene.load.image('kobiass', PREFIX + 'kobiass.png');

    this.scene.load.image('balloon-01', PREFIX + 'balloon-01.png');
    this.scene.load.image('balloon-02', PREFIX + 'balloon-02.png');
    this.scene.load.image('balloon-03', PREFIX + 'balloon-03.png');
    this.scene.load.image('balloon-04', PREFIX + 'balloon-04.png');

    this.scene.load.image('kobi-logo', PREFIX + 'kobi-logo.png');
    this.scene.load.image('kobi-cat', PREFIX + 'kobi-cat.png');
  }


  public create() {
    this.scene.cameras.main.setBackgroundColor('#FFFFFF');
    
    this.createBackground();
    this.createReelFrame();
    this.createTent();
    this.createBallons();
    this.createLogo();
    this.createKobiCat();
  }

  private createBackground() {
    this.scene.add.image(
      this.scene.scale.width * 0.5, 
      this.scene.scale.height * 0.5, 
      'BG-Default'
    );
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
      this.scene.scale.height * 0.09, 
      'kobi-tent'
    );
  }

  private createLogo() {
    this.scene.add.image(
      this.scene.scale.width * 0.5, 
      this.scene.scale.height * 0.075, 
      'kobi-logo'
    );
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

  private createKobiCat() {
    this.scene.add.image(
      this.scene.scale.width * 0.775, 
      this.scene.scale.height * 0.78, 
      'kobi-cat'
    );
  }
}
