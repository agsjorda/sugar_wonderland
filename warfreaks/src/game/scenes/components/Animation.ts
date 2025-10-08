import { Scene } from 'phaser';
import { Slot } from './GameData';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { SymbolContainer } from './SymbolContainer';

export class Animation {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
        // Load symbol atlases - High paying (Symbols 1-5)
        for (let i = 1; i <= 5; i++) {
            // Load the main atlas for both idle and win animations
            this.scene.load.spineAtlas(`Symbol${i}_WF`,`assets/Symbols/Animations/Symbol_HP_256.atlas`);
            this.scene.load.spineJson(`Symbol${i}_WF`,`assets/Symbols/Animations/Symbol_HP_256.json`);
        }
        
        // Load symbol atlases - Low paying (Symbols 6-9) for win animations
        for (let i = 6; i <= 9; i++) {
           this.scene.load.spineAtlas(`Symbol${i}_WF_win`,`assets/Symbols/Animations/Symbol_LP_256.atlas`);
           this.scene.load.spineJson(`Symbol${i}_WF_win`,`assets/Symbols/Animations/Symbol_LP_256.json`);
        }

        // Load static images for symbols 0, 6-9 (idle state)
        for (let i = 0; i <= 9; i++) {
            if (i === 0 || i >= 6) {
                this.scene.load.image(`symbol${i}_WF`,`assets/Symbols/symbol${i}_WF.png`);
            }
        }

        this.scene.load.spineAtlas(`Symbol0_WF`,`assets/Symbols/Animations/Symbol0_WF.atlas`);
        this.scene.load.spineJson(`Symbol0_WF`,`assets/Symbols/Animations/Symbol0_WF.json`);
    }

    create(): void {
        // Create Spine objects for symbols 1-5 (both idle and win animations use the same atlas)
        for(let i = 0; i <= 5; i++) {
            let symbol = this.scene.add.spine(0, 0, `Symbol${i}_WF`, `Symbol${i}_WF`) as SpineGameObject;
            symbol.setPosition(0, 0);
            symbol.setAlpha(0);
        }
        
        // Create Spine objects for symbols 6-9 win animations
        for(let i = 6; i <= 9; i++) {
            let symbolWin = this.scene.add.spine(0, 0, `Symbol${i}_WF_win`, `Symbol${i}_WF_win`) as SpineGameObject;
            symbolWin.setPosition(0, 0);
            symbolWin.setAlpha(0);

        }
    }

    playSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer, symbolValue: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (symbolValue >= 0 && symbolValue <= Slot.SYMBOLS) {
                // Play the animation for matched symbols
                //console.error("playing animation for symbol: " + symbolValue);
                
                let actualSprite: Phaser.GameObjects.Sprite;
                
                if (symbolSprite instanceof SymbolContainer) {
                    // For SymbolContainer, get the internal sprite and play animation directly
                    actualSprite = symbolSprite.getSymbolSprite() as unknown as Phaser.GameObjects.Sprite;
                    symbolSprite.setDepth(symbolSprite.depth + 1000);
                } else {
                    // For regular sprites
                    actualSprite = symbolSprite as Phaser.GameObjects.Sprite;
                    actualSprite.setDepth(actualSprite.depth + 1000);
                }
                
                // Play the animation using sprite.play() for both cases
                const spineObject = actualSprite as unknown as SpineGameObject;
                if(symbolValue >= 6 && symbolValue <= 9) {
                    if(spineObject.animationState) {
                    const animationState = spineObject.animationState.setAnimation(0, `animation`, false);
                    
                    animationState.timeScale = 1;
                    // Set up listener for animation completion
                    animationState.listener = {
                        complete: () => {
                            // Remove the listener to prevent memory leaks
                            animationState.listener = null;
                            resolve();
                        }
                    };
                    }
                    else {
                        resolve();
                    }
                }
                
            } else {
                // If symbol value is invalid, resolve immediately
                resolve();
            }
        });
    }

    stopSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer): void {
        if (symbolSprite instanceof SymbolContainer) {
            // For SymbolContainer, reset to idle
            (symbolSprite.getSymbolSprite() as SpineGameObject).animationState.setAnimation(0, `animation`, false);
        } else {
            // For regular sprites, use the old method
            // return; // wala pa nito - commented out to avoid unreachable code
            // symbolSprite.stop();
            // const symbolNum = symbolSprite.frame.texture.key.replace('Symbol', '').replace('_FIS', '');
            // symbolSprite.setFrame(`Symbol${symbolNum}_FIS-00000.png`);
        }
    }


    /**
     * Check if a symbol sprite is currently playing an animation
     */
    isSymbolAnimating(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer): boolean {
        try {
            let actualSprite: Phaser.GameObjects.Sprite;
            
            if (symbolSprite instanceof SymbolContainer) {
                actualSprite = symbolSprite.getSymbolSprite() as unknown as Phaser.GameObjects.Sprite;
            } else {
                actualSprite = symbolSprite as Phaser.GameObjects.Sprite;
            }
            
            const spineObject = actualSprite as unknown as SpineGameObject;
            if (spineObject && spineObject.animationState) {
                const currentAnimation = spineObject.animationState.getCurrent(0);
                return !!(currentAnimation && currentAnimation.animation && currentAnimation.animation.name === 'animation');
            }
        } catch (error) {
            this.scene.gameData.debugError("Error checking symbol animation state: " + error);
        }
        return false;
    }
} 