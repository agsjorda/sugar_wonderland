import { Scene, GameObjects } from 'phaser';
import { GameData } from './GameData';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

/**
 * SymbolContainer class that manages symbol sprites (Symbol1-Symbol9)
 * Similar to BombContainer but without text overlay and using regular sprite animations
 */
export class SymbolContainer extends GameObjects.Container {
    private symbolSprite: SpineGameObject | GameObjects.Image;
    private symbolValue: number;
    public scene: Scene;
    private gameData: GameData;
    private isHighPaying: boolean; // true for symbols 1-5, false for symbols 6-9

    constructor(scene: Scene, x: number, y: number, symbolValue: number, gameData: GameData) {
        super(scene, x, y);
        
        this.scene = scene;
        this.gameData = gameData;
        this.symbolValue = symbolValue;
        this.isHighPaying = symbolValue >= 1 && symbolValue <= 5;

        // Create the symbol based on the symbol value
        if (this.isHighPaying) {
            // Symbols 1-5: Create as SpineGameObject with idle animation
            const symbolKey = `Symbol${symbolValue}_WF`;
            this.symbolSprite = scene.add.spine(0, 0, symbolKey, symbolKey) as SpineGameObject;
            this.symbolSprite.setVisible(true);
            
            // Start with idle animation
            this.symbolSprite.animationState.setAnimation(0, `symbol${symbolValue}_WF_idle`, true);
        } else {
            // Symbols 6-9: Create as Image
            const imageKey = `symbol${symbolValue}_WF`;
            this.symbolSprite = scene.add.image(0, 0, imageKey) as GameObjects.Image;
            if(symbolValue === 0) {
                this.symbolSprite.setOrigin(0.5,1.05); 
                this.symbolSprite.setDepth(100000);
            }
            else {
                this.symbolSprite.setOrigin(0.5,1);
            }
            this.symbolSprite.setVisible(true);
        }
        
        // Add the sprite to the container
        this.add(this.symbolSprite);
        
        // Debug logging
        this.gameData.debugLog('SymbolContainer created', {
            symbolValue,
            position: { x, y },
            isHighPaying: this.isHighPaying
        });
    }

    /**
     * Set the display size for the symbol sprite
     */
    setSymbolDisplaySize(width: number, height: number): void {
        this.symbolSprite.setDisplaySize(width, height);
        
        this.gameData.debugLog('Symbol display size set', { 
            symbolValue: this.symbolValue, 
            width, 
            height 
        });
    }

    /**
     * Play the win animation when checkMatch is triggered (8+ matches)
     */
    playWinAnimation(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.gameData.debugLog('Playing win animation for symbol', { symbolValue: this.symbolValue });
            
            try {
                if (this.isHighPaying) {
                    // Symbols 1-5: Use win animation from the same atlas
                    const spineSprite = this.symbolSprite as SpineGameObject;
                    const animationState = spineSprite.animationState.setAnimation(0, `symbol${this.symbolValue}_WF_win`, false);
                    
                    // Set up listener for animation completion
                    animationState.listener = {
                        complete: () => {
                            // Remove the listener to prevent memory leaks
                            animationState.listener = null;
                            resolve();
                        }
                    };
                } else {
                    // Symbols 6-9: Replace image with Spine animation
                    const imageSprite = this.symbolSprite as GameObjects.Image;
                    
                    // Create new Spine sprite with win animation
                    const winSymbolKey = `Symbol${this.symbolValue}_WF_win`;
                    const winSpineSprite = this.scene.add.spine(0, 0, winSymbolKey, winSymbolKey) as SpineGameObject;
                    winSpineSprite.setDisplaySize(imageSprite.displayWidth, imageSprite.displayHeight);
                    winSpineSprite.setVisible(true);
                    
                    // Play the win animation
                    const animationState = winSpineSprite.animationState.setAnimation(0, `symbol${this.symbolValue}_WF`, false);
                    
                    animationState.timeScale = 1.25;
                    // Replace the image with the spine sprite
                    this.remove(imageSprite);
                    imageSprite.destroy();
                    this.symbolSprite = winSpineSprite;
                    this.add(winSpineSprite);
                    
                    // Set up listener for animation completion
                    animationState.listener = {
                        complete: () => {
                            // Remove the listener to prevent memory leaks
                            animationState.listener = null;
                            resolve();
                        }
                    };
                }
            } catch (error) {
                this.gameData.debugError('Could not play win animation for symbol', { 
                    symbolValue: this.symbolValue, 
                    error 
                });
                resolve(); // Resolve even if there's an error
            }
        });
    }

    /**
     * Play the main animation for this symbol
     * Note: This method is kept for compatibility, but Animation.ts now calls the sprite directly
     */
    playSymbolAnimation(): void {
        // console.log('Playing symbol animation', { symbolValue: this.symbolValue });
                
        try {
            if (this.isHighPaying) {
                // For high paying symbols, play the idle animation
                const spineSprite = this.symbolSprite as SpineGameObject;
                spineSprite.animationState.setAnimation(0, `symbol${this.symbolValue}_WF_idle`, true);
            }
            // For low paying symbols (6-9), they remain as static images during idle
        } catch (error) {
            this.gameData.debugError('Could not play animation for symbol', { 
                symbolValue: this.symbolValue, 
                error 
            });
        }
    }

    /**
     * Check if the symbol is currently playing an animation
     */
    isPlayingAnimation(): boolean {
        if (this.symbolSprite && this.isHighPaying) {
            const spineSprite = this.symbolSprite as SpineGameObject;
            if (spineSprite.animationState) {
                const currentAnimation = spineSprite.animationState.getCurrent(0);
                return !!(currentAnimation && currentAnimation.animation);
            }
        }
        return false;
    }

    /**
     * Get the symbol sprite for external animations
     */
    getSymbolSprite(): SpineGameObject | GameObjects.Image {
        return this.symbolSprite;
    }

    /**
     * Get the symbol value
     */
    getSymbolValue(): number {
        return this.symbolValue;
    }

    /**
     * Reset to idle/static state
     */
    resetToIdle(): void {
        if (this.isHighPaying) {
            const spineSprite = this.symbolSprite as SpineGameObject;
            spineSprite.animationState.setAnimation(0, `symbol${this.symbolValue}_WF_idle`, true);
        }
        // For low paying symbols, they remain as static images
    }
    
    /**
     * Clean up the symbol container
     */
    destroy(): void {
        this.gameData.debugLog('Destroying symbol container', { symbolValue: this.symbolValue });
        
        if (this.symbolSprite) {
            this.symbolSprite.destroy();
        }
        
        super.destroy();
    }
} 