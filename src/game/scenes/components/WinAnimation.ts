import { Scene } from 'phaser';
import { Events } from "./Events";
import { Attachment, Bone, SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

export class WinAnimation {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
        this.scene.load.spineAtlas('myWinAnim', 'assets/Win/Test/Win.atlas');
        this.scene.load.spineJson('myWinAnim', 'assets/Win/Test/Win.json');

        this.scene.load.spineAtlas('myWinAnim2', 'assets/Win/Win.atlas');
        this.scene.load.spineJson('myWinAnim2', 'assets/Win/Win.json');
    }

    create(): void {
        let spineObject2 = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        
        spineObject2.setPosition(0, 0);
        spineObject2.setAlpha(0);
    }

    update(): void {
    }

    playWinAnimation(spineObject: SpineGameObject, totalwin: number, winType:string = ''): void {
        spineObject.setAlpha(1);
        let animationName = '';
        let animationName2 = '';
        
        const sampleDuration = 25;
        const intervalWin = totalwin/sampleDuration;
        let runningWin = 0;
        let runningChar : string[] = [];

        // Get the AmountWin bone
        const amountWinBone = spineObject.skeleton.findBone('AmountWin');
        if (!amountWinBone) {
            console.error(`${amountWinBone} bone not found`);
            return;
        }

        // Position the AmountWin bone at the center of the screen
        const screenWidth = this.scene.cameras.main.width;
        amountWinBone.x = screenWidth / 2;
        amountWinBone.y = 0; // Adjust this if you need vertical positioning

        for(let i = 0 ; i < sampleDuration; i++){
            setTimeout(() => {
                // increment
                if(runningWin >= totalwin){
                    runningWin = totalwin;
                }
                else{
                    runningWin += intervalWin;
                    runningWin = Math.round(runningWin * 100) / 100;
                }
                
                Events.emitter.emit(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN, runningWin);

                // Convert running win to character array
                runningChar = [];
                const numStr = runningWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                for (let i = 0; i < numStr.length; i++) {
                    if (numStr[i] === '.') {
                        runningChar.push('dot');
                    } else if (numStr[i] === ',') {
                        runningChar.push('coma');
                    } else {
                        runningChar.push(numStr[i]);
                    }
                }
                

            }, sampleDuration * i * 10);
        }
    
        switch (winType) {
            case 'BigWin':
                animationName = 'BigWin-Intro';
                animationName2 = 'BigWin-Idle';                

                break;
            case 'EpicWin':
                animationName = 'EpicWin-Intro';
                animationName2 = 'EpicWin-Idle';

                break;
            case 'FreeSpin':
                animationName = 'FreeSpin-Intro';
                animationName2 = 'FreeSpin-Idle';
                break;
            case 'MegaWin':
                animationName = 'MegaWin-Intro';
                animationName2 = 'MegaWin-Idle';
                break;
            case 'SuperWin':
                animationName = 'SuperWin-Intro';
                animationName2 = 'SuperWin-Idle';
                break;
            case 'Congrats':
                animationName = 'Congrats-Intro';
                animationName2 = 'Congrats-Idle';
                break;
        }
        
        spineObject.animationState.setAnimation(0, animationName, false);
        spineObject.animationState.addAnimation(1, animationName2, true);
    }
} 