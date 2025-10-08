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

    create(scene: Scene): void {
        let width = scene.scale.width;
        let height = scene.scale.height;
        let x = width * 0.80;
        let y = height * 0.13;

        let spineObject = scene.add.spine(x, y, 'character', 'character-atlas') as SpineGameObject;
        spineObject.setScale(0.12);
        spineObject.animationState.setAnimation(0, 'Idle', true);
        spineObject.setDepth(10);

        spineObject.setVisible(false);
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