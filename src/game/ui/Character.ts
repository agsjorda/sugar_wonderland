import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { Scene } from 'phaser';
import { Events } from '../scenes/components/Events';

export class Character {
    private spineObject?: SpineGameObject;

    constructor() {
    }

    preload(scene: Scene): void {
        const prefix = 'assets/Assets/Character';
        scene.load.spineAtlas('character-atlas', `${prefix}/char.atlas`);
        scene.load.spineJson('character', `${prefix}/char.json`);
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('device') == 'mobile'){
            return true;
        }else if(urlParams.get('device') == 'desktop'){
            return false;
        }
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    create(scene: Scene): void {
        let width = scene.scale.width;
        let height = scene.scale.height;
        let x = this.isMobileDevice() ? width * 0.80 : width * 0.14;
        let y = this.isMobileDevice() ? height * 0.13 : height * 0.5;

        this.spineObject = scene.add.spine(x, y, 'character', 'character-atlas') as SpineGameObject;
        this.spineObject.setScale(this.isMobileDevice() ? 0.12 : 0.25);
        this.spineObject.animationState.setAnimation(0, 'Idle', true);
        this.spineObject.setDepth(10);

        // Pause/resume character animation during win overlay
        Events.emitter.on(Events.WIN_OVERLAY_SHOW, () => {
            if (this.spineObject && this.spineObject.animationState) {
                this.spineObject.animationState.timeScale = 0;
            }
        });
        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            if (this.spineObject && this.spineObject.animationState) {
                this.spineObject.animationState.timeScale = 1;
            }
        });

        // Stop character on session timeout
        Events.emitter.on(Events.SESSION_TIMEOUT, () => {
            if (this.spineObject && this.spineObject.animationState) {
                this.spineObject.animationState.timeScale = 0;
            }
        });

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