import { EventManager, GameEvents } from "../../event/EventManager";
import { Data } from "../../tmp_backend/Data";
import { Game } from "../scenes/Game";


export class BonusBackground {
  public scene: Game;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Game) {
    const PREFIX = 'assets/background/';
    scene.load.image('bg-bonus', PREFIX + 'BG-Bonus.png');
    scene.load.image('spot-light-l', PREFIX + 'spot-light-l.png');
    scene.load.image('spot-light-r', PREFIX + 'spot-light-r.png');
    scene.load.image('disco-ball', PREFIX + 'kobi-disco-ball.png');
    scene.load.image('kobi-cat-bonus', PREFIX + 'kobi-cat-bonus.png');
  }

  public create(scene: Game) {
    this.createBackground(scene)
    this.createSpotLights(scene);
    this.createDiscoBall(scene);
    this.createKobiCat(scene);
  }


  private createBackground(scene: Game) { 
    const bg = scene.add.image(
      scene.scale.width * 0.5, 
      scene.scale.height * 0.5, 
      'bg-bonus'
    )
    .setVisible(false);

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      if (data.isScatter) {
        bg.setVisible(true);
      } else {
        bg.setVisible(false);
      }
    });
  }

  private createSpotLights(scene: Game) {
    const spotLightL = scene.add.image(
      scene.scale.width * 0.05, 
      scene.scale.height * 0.0, 
      'spot-light-l'
    )
    .setOrigin(0.1, 0.0)
    .setBlendMode('ADD')
    .setVisible(false)
    .setDepth(2);

    const spotLightR = scene.add.image(
      scene.scale.width * 0.95, 
      scene.scale.height * 0.0, 
      'spot-light-r'
    )
    .setOrigin(0.9, 0.0)
    .setBlendMode('ADD')
    .setVisible(false)
    .setDepth(2);

    scene.tweens.add({
      targets: spotLightL,
      x: {
        value: "+=300", 
        yoyo: true,
        repeat: -1 
      },
      duration: 2000,
      ease: 'Cubic.easeInOut',
    });

    scene.tweens.add({
      targets: spotLightR,
      x: {
        value: "-=300", 
        yoyo: true,
        repeat: -1 
      },
      duration: 2000,
      ease: 'Cubic.easeInOut',
    });

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      if (data.isScatter) {
        spotLightL.setVisible(true);
        spotLightR.setVisible(true);
      } else {
        spotLightL.setVisible(false);
        spotLightR.setVisible(false);
      }
    });
  }

  private createDiscoBall(scene: Game) {
    const discoBall = scene.add.image(
      scene.scale.width * 0.5, 
      scene.scale.height * 0.0725, 
      'disco-ball'
    )
    .setVisible(false)
    .setDepth(2);

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      if (data.isScatter) {
        discoBall.setVisible(true);
      } else {
        discoBall.setVisible(false);
      }
    });
  }

  private createKobiCat(scene: Game) {
    const kobiCat = scene.add.image(
      scene.scale.width * 0.78, 
      scene.scale.height * 0.75, 
      'kobi-cat-bonus'
    )
    .setVisible(false)
    .setDepth(2);

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      if (data.isScatter) {
        kobiCat.setVisible(true);
      } else {
        kobiCat.setVisible(false);
      }
    });
  }
}