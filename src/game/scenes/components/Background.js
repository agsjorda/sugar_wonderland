export class Background {
  constructor() {
    this.initialLayerX = 0;
    this.initialLayerY = 0;

    this.floatingAmplitudeX = 200;
    this.floatingAmplitudeY = 250;
    this.floatingSpeedX = 0.001;
    this.floatingSpeedY = 0.0012;

    this.background = undefined;
    this.cloud = undefined;
    this.foreground = undefined;

    this.cloudParallaxSpeed = 0.1;
    this.foregroundParallaxSpeed = 0.0;
  }

  preload(scene) {
		const prefix = 'assets/background';

    scene.load.image('background', prefix + '/mainBackground.png');
    scene.load.image('bonusbackground', prefix + '/bonusBackground.png');
    scene.load.image('cloud', prefix + '/Cloud.png');
    scene.load.image('foreground', prefix + '/Foreground.png');
		scene.load.image('lantern', prefix + '/Lantern.png');
  }

  create(scene) {
    this.createBackground(scene);
		//this.createLanterns(scene)
  }

  createBackground(scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    this.initialLayerX = centerX;
    this.initialLayerY = centerY;

    this.background = scene.add.image(this.initialLayerX, this.initialLayerY, 'background');
    this.bonusbackground = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonusbackground');
    //this.cloud = scene.add.image(this.initialLayerX, this.initialLayerY, 'cloud');
    //this.foreground = scene.add.image(this.initialLayerX, height * 0.45, 'foreground');


    const scaleFactor = 1;
    this.background.setScale(scaleFactor);
    this.bonusbackground.setScale(scaleFactor);
    //this.cloud.setScale(scaleFactor);
    //this.foreground.setScale(scaleFactor);


    this.background.setDepth(0);
    this.bonusbackground.setDepth(0);
    this.bonusbackground.setAlpha(0);
    //this.cloud.setDepth(1);
    //this.foreground.setDepth(2);
  }

	createLanterns(scene) {
		const width = scene.scale.width;
		const height = scene.scale.height;

		const lantern1 = scene.add.image(width * 0.1, height * 0.2, 'lantern');
		lantern1.setScale(0.325);
		lantern1.setDepth(4);
		lantern1.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: lantern1,
			angle: { from: 0, to: 20 },
			duration: 1000,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});

		const lantern2 = scene.add.image(width * 0.1825, height * 0.14, 'lantern');
		lantern2.setScale(0.45);
		lantern2.setDepth(4);
		lantern2.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: lantern2,
			angle: { from: 0, to: 20 },
			duration: 1200,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});

		const lantern3 = scene.add.image(width * 0.94, height * 0.05, 'lantern');
		lantern3.setScale(0.325);
		lantern3.setDepth(4);
		lantern3.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: lantern3,
			angle: { from: 0, to: 20 },
			duration: 1100,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
	}

  enableBonusBackground(scene) {
    this.bonusbackground.setAlpha(1);
  }

  disableBonusBackground(scene) {
    this.bonusbackground.setAlpha(0);
  }

  update(scene, time, delta) {
    //const floatingOffsetX = Math.sin(time * this.floatingSpeedX) * this.floatingAmplitudeX;
    //const floatingOffsetY = Math.sin(time * this.floatingSpeedY) * this.floatingAmplitudeY;

    // this.cloud.x = this.initialLayerX + floatingOffsetX * this.cloudParallaxSpeed;
    //this.cloud.y = this.initialLayerY + floatingOffsetY * this.cloudParallaxSpeed;

    // this.foreground.x = this.initialLayerX + floatingOffsetX * this.foregroundParallaxSpeed;
    // this.foreground.y = this.initialLayerY + floatingOffsetY * this.foregroundParallaxSpeed;
  }
}
