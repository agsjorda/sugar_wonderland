import { Scene } from "phaser";
import { BackendEvent, BackendEvents } from "../../tmp_backend/BackendEvent";
import { Data } from "../../tmp_backend/Data";
import { EventManager, GameEvents } from "../../event/EventManager";

export class Spinner {
  public scene: Scene;
  public container: Phaser.GameObjects.Container;
  public spinTween: Phaser.Tweens.Tween;
  public spin2: Phaser.GameObjects.Image;

  // The values on the wheel, in counter-clockwise order.
  private segments: number = Data.SCATTER_MULTIPLIERS.length;
  private pointerOffsetRad: number = -(2 * Math.PI) / (2 * this.segments);

  constructor() { }

  public preload(scene: Scene) {
    const PREFIX = 'assets/spinner/';
    scene.load.image('spin_01', PREFIX + 'spin_01.png');
    scene.load.image('spin_02', PREFIX + 'spin_02.png');
    scene.load.image('spin_03', PREFIX + 'spin_03.png');
    scene.load.image('spin_04', PREFIX + 'spin_04.png');
  }

  public create(scene: Scene) {
    this.scene = scene;
    const x = scene.scale.width * 0.495;
    const y = scene.scale.height * 0.19;
    this.container = scene.add.container(x, y);
		this.container.setVisible(false);

    const spin1 = scene.add.image(0, 0, 'spin_01');
    this.spin2 = scene.add.image(0, 0, 'spin_02');
    const spin3 = scene.add.image(0, 0, 'spin_03');
    const spin4 = scene.add.image(0, scene.scale.height * 0.425, 'spin_04');
    this.container.add([spin1, this.spin2, spin3, spin4]);

    this.setToIndex(0);
    console.log("Wheel set to index 0 (value 9).");

		this.onSpinResponse();
  }

  private onSpinResponse() {
    EventManager.on(GameEvents.REEL_DONE, (data: Data) => {
      if (data.isScatter) {
				this.container.setVisible(true);
				this.spinAndStopAt(data, data.scatterIndex);
				// console.log(`Scatter index: ${data.scatterIndex}`);
			}
    });

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      this.container.setVisible(false);
    });
  }
	

  public setToIndex(index: number) {
    if (index < 0 || index >= this.segments) {
      console.error(`Invalid index: ${index}`);
      return;
    }
    // The angle calculation now uses the corrected negative offset.
    const targetAngleRad = (2 * Math.PI * index / this.segments) + this.pointerOffsetRad;
    this.spin2.rotation = targetAngleRad;
  }

  public spinAndStopAt(data: Data, index: number) {
    if (index < 0 || index >= this.segments) {
      console.error(`Invalid index provided to spinAndStopAt: ${index}`);
      return;
    }

    if (this.spinTween && this.spinTween.isPlaying()) {
      this.spinTween.stop();
    }

    const targetAngleRad = (2 * Math.PI * index / this.segments) + this.pointerOffsetRad;

    const fullSpins = 5;
    const finalAngle = this.spin2.rotation + (Math.PI * 2 * fullSpins) + this.getShortestAngleDifference(this.spin2.rotation, targetAngleRad);


    this.spinTween = this.scene.tweens.add({
      targets: this.spin2,
      rotation: finalAngle,
      duration: 2000,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.spin2.rotation = targetAngleRad;
        EventManager.emit(GameEvents.SPIN_DONE, data);
      }
    });
  }
    
  private getShortestAngleDifference(current: number, target: number): number {
    const fullCircle = 2 * Math.PI;
    const normalizedCurrent = (current % fullCircle + fullCircle) % fullCircle;
    const normalizedTarget = (target % fullCircle + fullCircle) % fullCircle;
    let difference = normalizedTarget - normalizedCurrent;
    if (difference > Math.PI) {
        difference -= fullCircle;
    } else if (difference < -Math.PI) {
        difference += fullCircle;
    }
    return difference;
  }

  public update(time: number, delta: number) { }
}