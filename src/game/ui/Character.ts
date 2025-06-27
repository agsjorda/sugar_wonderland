import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { Scene } from 'phaser';

export class Character {

    constructor() {
    }

    preload(scene: Scene): void {
        const prefix = 'assets/Assets/Character';
        scene.load.spineAtlas('character-atlas', `${prefix}/char.atlas`);
        scene.load.spineJson('character', `${prefix}/char.json`);
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    create(scene: Scene): void {
        let width = scene.scale.width;
        let height = scene.scale.height;
        let x = this.isMobileDevice() ? width * 0.80 : width * 0.14;
        let y = this.isMobileDevice() ? height * 0.13 : height * 0.5;

        let spineObject = scene.add.spine(x, y, 'character', 'character-atlas') as SpineGameObject;
        spineObject.setScale(this.isMobileDevice() ? 0.12 : 0.25);
        spineObject.animationState.setAnimation(0, 'Idle', true);
        spineObject.setDepth(10);

        //Events.emitter.on(Events.WIN, () => {
        //    spineObject.animationState.setAnimation(0, 'Win', true);
        //
        //    const id = setTimeout(() => {
        //        spineObject.animationState.setAnimation(0, 'Idle', true);
        //        clearTimeout(id);
        //    }, 2000);
        //});
    }
} 