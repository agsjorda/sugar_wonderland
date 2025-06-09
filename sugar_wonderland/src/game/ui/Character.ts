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

        let spineObject = scene.add.spine(width * 0.14, height * 0.5, 'character', 'character-atlas') as SpineGameObject;
        spineObject.setScale(0.25);
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