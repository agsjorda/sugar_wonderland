import { Scene } from "phaser";
import { EventManager, GameEvents } from "../../event/EventManager";


export class Buttons {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Scene) {
    this.scene = scene;
    loadImages(this);
  }

  public create() {
    createContainer(this);
    createSpin(this);
  }
}

// preload()
function loadImages(self: Buttons) {
  const PREFIX = 'assets/buttons/';
  self.scene.load.image('spin', PREFIX + 'Spin.png');
  self.scene.load.image('turbo', PREFIX + 'Turbo.png');
}

// create()
function createContainer(self: Buttons) {
  self.container = self.scene.add.container(0, 0);
  self.container.setDepth(4);
}

function createSpin(self: Buttons) {
  const x = self.scene.scale.width * 0.845;
  const y = self.scene.scale.height * 0.45;
  const spin = self.scene.add.image(x, y, 'spin');
  spin.setInteractive();
  self.container.add(spin);

  spin.on('pointerdown', () => {
    console.log('spin');
    EventManager.emit(GameEvents.SPIN_REQUEST, null);
  });
}

