import { Scene, GameObjects } from 'phaser';

export class Background {
    private initialLayerX: number = 0;
    private initialLayerY: number = 0;


    private background: GameObjects.Image;
    private bonusbackground: GameObjects.Image;


    preload(scene: Scene): void {
        const prefix = 'assets/background';

        scene.load.image('background', `${prefix}/mainBackground.png`);
        scene.load.image('bonusbackground', `${prefix}/bonusBackground.png`);
        scene.load.image('cloud', `${prefix}/Cloud.png`);
        scene.load.image('foreground', `${prefix}/Foreground.png`);
        scene.load.image('lantern', `${prefix}/Lantern.png`);
    }

    create(scene: Scene): void {
        this.createBackground(scene);
        //this.createLanterns(scene);
    }

    private createBackground(scene: Scene): void {
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


    enableBonusBackground(_scene: Scene): void {
        this.bonusbackground.setAlpha(1);
    }

    disableBonusBackground(_scene: Scene): void {
        this.bonusbackground.setAlpha(0);
    }

    update(): void {
        //const floatingOffsetX = Math.sin(time * this.floatingSpeedX) * this.floatingAmplitudeX;
        //const floatingOffsetY = Math.sin(time * this.floatingSpeedY) * this.floatingAmplitudeY;

        //if (this.cloud) {
        //    this.cloud.x = this.initialLayerX + floatingOffsetX * this.cloudParallaxSpeed;
        //    this.cloud.y = this.initialLayerY + floatingOffsetY * this.cloudParallaxSpeed;
        //}

        //if (this.foreground) {
        //    this.foreground.x = this.initialLayerX + floatingOffsetX * this.foregroundParallaxSpeed;
        //    this.foreground.y = this.initialLayerY + floatingOffsetY * this.foregroundParallaxSpeed;
        //}
    }
} 