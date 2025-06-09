import { Scene, GameObjects, Geom } from 'phaser';
import { Events } from "./Events";
import { Slot } from "./GameData";
import { GameData } from "./GameData";
import { AudioManager } from "./AudioManager";
import { Animation } from './Animation';
import { WinAnimation } from './WinAnimation';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
}

// Improved SymbolGrid interface with proper typing
interface SymbolGrid {
    [index: number]: GameObjects.Sprite[];
    length: number;
    map: <T>(callback: (row: GameObjects.Sprite[], index: number) => T[]) => T[][];
    forEach: (callback: (row: GameObjects.Sprite[], index: number) => void) => void;
}


interface SpinData {
    symbols: number[][];
    currentRow: number;
}

export class SlotMachine {
    private container: GameObjects.Container;
    private symbolGrid: SymbolGrid;
    private symbolDisplayWidth: number;
    private symbolDisplayHeight: number;
    private horizontalSpacing: number;
    private verticalSpacing: number;
    private width: number;
    private centerX: number;
    private totalGridWidth: number;
    private totalGridHeight: number;
    private slotX: number;
    private slotY: number;
    public activeWinOverlay: boolean = false;
    private winOverlayContainer: GameObjects.Container | null = null;
    private animation: Animation;
    private winAnimation: WinAnimation;

    constructor() {
        this.symbolDisplayWidth = 153.17;
        this.symbolDisplayHeight = 147.2;
        this.horizontalSpacing = 10;
        this.verticalSpacing = 10;

        this.symbolGrid = {
            length: 0,
            map: () => [],
            forEach: () => {}
        };
    }

    preload(scene: Scene): void {
        scene.load.image('slotBackground', 'assets/Reels/Property 1=Default.png');

        // Initialize animation
        this.animation = new Animation(scene);
        this.animation.preload();

        this.winAnimation = new WinAnimation(scene);
        this.winAnimation.preload();

        this.initVariables(scene);
    }

    private initVariables(scene: GameScene): void {
        this.width = scene.scale.width;

        this.centerX = this.width * 0.5;

        this.totalGridWidth = 1000;
        this.totalGridHeight = 775;

        this.slotX = this.centerX - this.totalGridWidth * 0.475;
        this.slotY = 85;
    }

    create(scene: Scene): void {
        this.createContainer(scene);
        this.createBackground(scene);
        this.createSlot(scene);
        this.eventListeners(scene);
        
        // Initialize animations
        this.animation.create();
        this.winAnimation.create();
    }

    private createContainer(scene: GameScene): void {
        this.container = scene.add.container(this.slotX, this.slotY);
        this.container.setDepth(4);
    }

    private createBackground(scene: GameScene): void {
        const background = scene.add.image(0, 0, 'slotBackground').setOrigin(0, 0);
        background.setDepth(3);

        const paddingX = 90;
        const paddingY = 75;

        background.x = this.slotX - paddingX/2;
        background.y = this.slotY - paddingY/2;

        background.displayWidth = this.totalGridWidth + paddingX;
        background.displayHeight = this.totalGridHeight + paddingY;
    }

    private createSlot(scene: GameScene): void {
        const maskShape = scene.add.graphics();
        maskShape.fillRect(this.slotX, this.slotY, this.totalGridWidth, this.totalGridHeight);

        const mask = maskShape.createGeometryMask();
        this.container.setMask(mask);
        maskShape.setVisible(false);
    }

    private createReel(scene: GameScene, data: SpinData): void {
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        const newValues = data.symbols;
        let completedSymbols = 0;
        const totalSymbols = numCols * numRows;

        // Initialize newSymbolGrid with proper nested arrays
        let newSymbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as unknown as SymbolGrid;
        Object.assign(newSymbolGrid, {
            length: numRows,
            map: (callback: (row: GameObjects.Sprite[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(newSymbolGrid[row], row)),
            forEach: (callback: (row: GameObjects.Sprite[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(newSymbolGrid[index], index))
        });

        const rowInterval = 150; // ms between each row's arrival in a column
        let turboSpeed = scene.gameData.turbo ? 0.2 : 1;
        let offsetDelay = 1100;

        for (let col = 0; col < numCols; col++) {
            for (let row = numRows - 1; row >= 0; row--) {
                const symbol = this.symbolGrid[row][col];
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const symbolY = centerY + row * (height + verticalSpacing);
                const delay = (col * 250 + (numRows - 1 - row) * rowInterval) * turboSpeed;

                // Modify the symbol creation part
                const symbolValue = newValues[row][col];
                let symbolKey = 'Symbol0_SW'; // Default to scatter symbol
                let frameKey = 'Symbol0_SW-00000.png';
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_SW`;
                    frameKey = `Symbol${symbolValue}_SW-00000.png`;
                }
                const startY = symbolY - height * (numRows + 1);
                const newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey);

                // Set the display size based on the symbol type
                if (symbolValue === 0) {
                    newSymbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else {
                    newSymbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                }   

                // Calculate duration based on distance to maintain consistent speed
                const distance = symbolY - startY;
                const baseSpeed = 2; // pixels per millisecond
                let duration = (distance / baseSpeed) * turboSpeed;
                if (scene.gameData.turbo) {
                    duration = Math.min(duration, 1250 * turboSpeed);
                }

                // Add extra delay for turbo mode to prevent overlap
                let tweenDelay = (delay + offsetDelay) * turboSpeed;
                if (scene.gameData.turbo) {
                    tweenDelay += duration / turboSpeed;
                    scene.audioManager.TurboDrop.play();
                }

                // Tween out the old symbol
                if (symbol) {
                    const endY = symbol.y + height * (numRows + 1);
                    const distance = endY - symbol.y;
                    const baseSpeed = 2;
                    const durationOld = (distance / baseSpeed) * turboSpeed;

                    // Add enhanced blur effect to the symbol
                    if ((scene.sys.game.renderer as any).pipelines) {
                        symbol.setPipeline('BlurPostFX');
                        (symbol as any).blurStrength = 0.5;
                    }

                    // Create multiple motion trails
                    const trails: Phaser.GameObjects.Sprite[] = [];
                    const numTrails = 10;
                    const trailSpacing = -100; // Space between trails

                    for (let i = 0; i < numTrails; i++) {
                        const trail = scene.add.sprite(symbol.x, symbol.y, symbol.texture.key, symbol.frame.name);
                        trail.setDisplaySize(symbol.displayWidth, symbol.displayHeight);
                        trail.setAlpha(0.7 - (i * 0.15)); // Decreasing alpha for each trail
                        trail.setPipeline('BlurPostFX');

                        (trail as any).blurStrength = 0.8 + (i * 0.1); // Increasing blur for each trail
                        trail.setDepth(symbol.depth - (i + 1)); // Place trails behind the symbol
                        if(scene.gameData.turbo == false) {
                            this.container.add(trail);
                            trails.push(trail);
                        }
                    }

                    scene.tweens.add({
                        targets: symbol,
                        y: endY,
                        alpha: 0.1,
                        scale: 0.5,
                        duration: durationOld ,
                        delay: delay,
                        ease: 'Quart.easeInOut',
                        onUpdate: () => {
                            // Update trail positions and fade
                            if(scene.gameData.turbo == false) {
                                setTimeout(() => {
                                    trails.forEach((trail, index) => {
                                        trail.y = symbol.y - (trailSpacing * (index + 1));
                                        trail.alpha = symbol.alpha * (0.7 - (index * 0.15));
                                    });
                                }, 100);
                            }
                        },
                        onComplete: () => {
                            trails.forEach(trail => trail.destroy());
                            symbol.destroy();
                        }
                    });
                }

                this.container.add(newSymbol);
                newSymbolGrid[row][col] = newSymbol;

                scene.tweens.add({
                    targets: newSymbol,
                    y: symbolY,
                    duration: duration,
                    delay: tweenDelay,
                    ease: 'Quart.easeInOut',
                    onComplete: () => {
                        completedSymbols++;
                        if (!scene.gameData.turbo) {
                            if (row === 4) {
                                scene.audioManager.ReelDrop.play();
                            }
                        }

                        if (completedSymbols === totalSymbols) {
                            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                                symbols: newValues,
                                currentRow: data.currentRow
                            });
                            if(this.checkMatch(newValues, scene) === "No more matches" ) {
                                scene.gameData.isSpinning = false;
                            }
                        }
                    }
                });
            }
        }

        this.symbolGrid = newSymbolGrid;
    }

    private eventListeners(scene: GameScene): void {
        Events.emitter.on(Events.SPIN_ANIMATION_START, (data: SpinData) => {
            this.createReel(scene, data);
        });

        Events.emitter.on(Events.START, (data: SpinData) => {
            this.createSampleSymbols(scene, data.symbols);
        });
    }

    private createSampleSymbols(scene: GameScene, symbols: number[][]): void {
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        // Initialize the symbolGrid with proper nested arrays
        this.symbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as unknown as SymbolGrid;
        Object.assign(this.symbolGrid, {
            map: (callback: (row: GameObjects.Sprite[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(this.symbolGrid[row], row)),
            forEach: (callback: (row: GameObjects.Sprite[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(this.symbolGrid[index], index))
        });

        for (let row = 0; row < numRows; row++) {
            let sampleScatterCount = 0;
            for (let col = 0; col < numCols; col++) {
                const symbolValue = symbols[row][col];
                let symbolKey = 'Symbol0_SW'; // Default to scatter symbol
                let frameKey = 'Symbol0_SW-00000.png';
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_SW`;
                    frameKey = `Symbol${symbolValue}_SW-00000.png`;
                }
                const centerX = width * 0.5 + 20;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const symbolY = centerY + row * (height + verticalSpacing);

                const symbol = scene.add.sprite(symbolX, symbolY, symbolKey, frameKey);

                if (symbolValue === 0 && sampleScatterCount < 3){
                    sampleScatterCount++;
                    symbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else {
                    symbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                }

                this.container.add(symbol);
                this.symbolGrid[row][col] = symbol;
            }
        }
    }


    public spin(scene: Scene, data: any, turboSpeed: number = 1): void {
        let numRows = Slot.ROWS;
        let numCols = Slot.COLUMNS;
        let width = this.symbolDisplayWidth;
        let height = this.symbolDisplayHeight;
        let horizontalSpacing = this.horizontalSpacing;
        let verticalSpacing = this.verticalSpacing;

        let newValues = data.symbols;
        let totalSymbols = numCols * numRows;
        let completedSymbols = 0;

        let rowInterval = 150; // ms between each row's arrival in a column

        for (let col = 0; col < numCols; col++) {
            for (let row = numRows - 1; row >= 0; row--) {
                let symbol = this.symbolGrid[row][col];
                let centerX = width * 0.5;
                let centerY = height * 0.5;
                let symbolX = centerX + col * (width + horizontalSpacing);
                let symbolY = centerY + row * (height + verticalSpacing);
                let delay = (col * 250 + (numRows - 1 - row) * rowInterval) * turboSpeed;

                // Create new symbol
                let symbolValue = newValues[row][col];
                let symbolKey = symbolValue === 0 ? 'Symbol0_SW' : `Symbol${symbolValue}_SW`;
                let frameKey = `${symbolKey}-00000.png`;
                let startY = symbolY - height * (numRows + 1);
                let newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey);

                // Calculate duration based on distance and speed
                let distance = symbolY - startY;
                let baseSpeed = 2; // pixels per millisecond
                let duration = (distance / baseSpeed) * turboSpeed;

                // Move old symbol up and destroy
                let endY = symbol.y + height * (numRows + 1);
                let distance2 = endY - symbol.y;
                let durationOld = (distance2 / baseSpeed) * turboSpeed;

                scene.tweens.add({
                    targets: symbol,
                    y: endY,
                    duration: durationOld,
                    ease: 'Cubic.easeIn',
                    delay: delay,
                    onComplete: () => {
                        symbol.destroy();
                    }
                });

                // Move new symbol down
                scene.tweens.add({
                    targets: newSymbol,
                    y: symbolY,
                    duration: duration,
                    ease: 'Cubic.easeOut',
                    delay: delay,
                    onComplete: () => {
                        completedSymbols++;
                        if (completedSymbols === totalSymbols) {
                            Events.emitter.emit(Events.SPIN_ANIMATION_END);
                        }
                    }
                });

                newSymbol.setDisplaySize(width, height);
                this.symbolGrid[row][col] = newSymbol;
            }
        }
    }


    public showBonusWin(scene: GameScene, totalWin: number): void {
        let overlay = scene.add.container(0, 0);
        overlay.setDepth(5);

        let width = scene.scale.width;
        let height = scene.scale.height;

        let background = scene.add.graphics();
        background.fillStyle(0x000000, 0.8);
        background.fillRect(0, 0, width, height);
        overlay.add(background);

        let bonusText = scene.add.text(width * 0.5, height * 0.3, 'BONUS ROUND COMPLETE!', {
            fontSize: '48px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        bonusText.setOrigin(0.5);
        overlay.add(bonusText);

        let totalWinText = scene.add.text(width * 0.5, height * 0.4, 'TOTAL BONUS WIN', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        totalWinText.setOrigin(0.5);
        overlay.add(totalWinText);

        let amountText = scene.add.text(width * 0.5, height * 0.5, `${scene.gameData.currency}${totalWin.toFixed(2)}`, {
            fontSize: '64px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        amountText.setOrigin(0.5);
        overlay.add(amountText);

        let numStars = 30;
        let stars: GameObjects.Image[] = [];

        for (let i = 0; i < numStars; i++) {
            let star = scene.add.image(
                Math.random() * width,
                Math.random() * height,
                'star'
            );
            star.setScale(0.5);
            star.setAlpha(0);
            stars.push(star);
            overlay.add(star);

            scene.tweens.add({
                targets: star,
                alpha: { from: 0, to: 1 },
                scale: { from: 0.5, to: 1 },
                duration: 1000,
                delay: i * 100,
                ease: 'Power2',
                yoyo: true,
                repeat: -1
            });
        }

        let continueText = scene.add.text(width * 0.5, height * 0.8, 'Click to continue', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        continueText.setOrigin(0.5);
        overlay.add(continueText);

        let clickHandler = () => {
            scene.tweens.add({
                targets: overlay,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    overlay.destroy();
                    stars.forEach(star => star.destroy());
                    // Emit event when bonus win overlay is closed
                    Events.emitter.emit(Events.BONUS_WIN_CLOSED);
                    // Enable spin button by setting isSpinning to false
                    scene.gameData.isSpinning = false;
                }
            });
        };

        overlay.setInteractive(new Geom.Rectangle(0, 0, width, height), Geom.Rectangle.Contains);
        overlay.on('pointerdown', clickHandler);
    }

    public update(): void {
        // Empty implementation - can be used for future animations or updates
    }

    private showFreeSpinsPopup(scene: GameScene, freeSpins: number): void {
        // Create a semi-transparent background
        const overlay = scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
        overlay.setDepth(10000); // Increased depth to match win overlay

        // Create the popup container
        const container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
        container.setDepth(10001); // Increased depth to match win overlay

        // Add popup background
        const popupBg = scene.add.graphics();
        popupBg.fillStyle(0x333333, 0.95);
        popupBg.fillRoundedRect(-325, -150, 650, 300, 20);
        popupBg.lineStyle(4, 0x57FFA3);
        popupBg.strokeRoundedRect(-325, -150, 650, 300, 20);
        container.add(popupBg);

        // Add title text
        const titleText = scene.add.text(0, -100, 'BONUS ROUND', {
            fontSize: '48px',
            color: '#57FFA3',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        titleText.setOrigin(0.5);
        container.add(titleText);

        // Add free spins amount text
        const spinsText = scene.add.text(0, 0, `You got ${freeSpins} FREE SPINS!`, {
            fontSize: '48px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        spinsText.setOrigin(0.5);
        container.add(spinsText);

        // Add start button using greenLongBtn image
        const startButton = scene.add.image(0, 90, 'greenLongBtn');
        startButton.displayWidth = 300;
        startButton.displayHeight = 60;
        container.add(startButton);

        const buttonText = scene.add.text(0, 90, 'START', {
            fontSize: '32px',
            color: '#000000',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        buttonText.setOrigin(0.5);
        container.add(buttonText);

        // Make button interactive
        startButton.setInteractive();

        const startFreeSpins = () => {
            scene.audioManager.UtilityButtonSFX.play();
            
            // Clean up
            container.destroy();
            overlay.destroy();

            // Start the free spins
            scene.gameData.isSpinning = false;

            // Always start with autoplay
            scene.buttons.autoplay.start(scene, freeSpins);

            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values
            });
        };

        // Add hover effects
        startButton.on('pointerover', () => {
            startButton.setTint(0x3FFF0D);
        });

        startButton.on('pointerout', () => {
            startButton.clearTint();
        });

        startButton.on('pointerdown', startFreeSpins);

        // Animate the popup
        container.setScale(0);
        scene.tweens.add({
            targets: container,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    private showWinOverlay(scene: GameScene, totalWin: number, bet: number): void {
        // Calculate multiplier for win type
        const multiplier = totalWin / bet;
        if(multiplier < 1) return;
        
        // Store reference to the win overlay container
        this.winOverlayContainer = scene.add.container(0, 0);
        this.activeWinOverlay = true;

        // Emit event that win overlay is showing
        Events.emitter.emit(Events.WIN_OVERLAY_SHOW);

        // Create semi-transparent background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRect(0, 0, scene.scale.width, scene.scale.height);
        this.winOverlayContainer.add(bg);

        // Create container for content
        const container = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
        this.winOverlayContainer.add(container);

        let winType = '';
        if (multiplier >= 25) winType = 'SuperWin';
        else if (multiplier >= 20) winType = 'MegaWin';
        else if (multiplier >= 15) winType = 'EpicWin';
        else if (multiplier >= 1) winType = 'BigWin'; // test win

        // Add win type text
       //const winTypeText = scene.add.text(0, -80, winType, {
       //    fontSize: '64px',
       //    color: '#57FFA3',
       //    fontFamily: 'Poppins',
       //    fontStyle: 'bold',
       //    align: 'center'
       //});
       //winTypeText.setOrigin(0.5);
       //container.add(winTypeText);

        // Add win animation
        const winAnim = scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        winAnim.setScale(1);
        winAnim.setPosition(0, 0);
        container.add(winAnim);

        this.winAnimation.playWinAnimation(winAnim, totalWin, winType);

        // Add win amount
        const winText = scene.add.text(0, 80, '0.00', {
            fontSize: '84px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3
        });
        winText.setOrigin(0.5);
        container.add(winText);

        Events.emitter.on(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN, (totalWin: number) => {
            winText.setText(`${totalWin.toFixed(2)}`);
        });

        // Add continue button
        const buttonBg = scene.add.graphics();
        buttonBg.lineStyle(3, 0x000000);
        buttonBg.fillStyle(0x57FFA3, 1);
        buttonBg.fillRoundedRect(-100, 120, 200, 60, 30);
        buttonBg.strokeRoundedRect(-100, 120, 200, 60, 30);
        container.add(buttonBg);

        const buttonText = scene.add.text(0, 150, 'CONTINUE', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3
        });
        buttonText.setOrigin(0.5);
        container.add(buttonText);

        // Add particles
        this.createWinParticles(scene, scene.scale.width / 2, scene.scale.height / 2);

        // Set depth - Increase depth values to ensure overlay is on top
        this.winOverlayContainer.setDepth(10000); 

        // Make button interactive - align with button background
        const buttonZone = scene.add.zone(0, 150, 200, 60);
        buttonZone.setInteractive();
        container.add(buttonZone);

        // Add hover effects
        buttonZone.on('pointerover', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x3FFF0D, 1);
            buttonBg.fillRoundedRect(-100, 120, 200, 60, 30);
        });

        buttonZone.on('pointerout', () => {
            buttonBg.clear();
            buttonBg.fillStyle(0x57FFA3, 1);
            buttonBg.fillRoundedRect(-100, 120, 200, 60, 30);
        });

        // Get the appropriate win sound based on multiplier
        let winSound = scene.audioManager.SmallW;
        if(multiplier >= 20 && multiplier < 30) {
            winSound = scene.audioManager.SmallW;
        } else if (multiplier >= 30 && multiplier < 50) {
            winSound = scene.audioManager.MediumW;
        } else if (multiplier >= 50 && multiplier < 100) {
            winSound = scene.audioManager.HugeW;
        } else if (multiplier >= 100) {
            winSound = scene.audioManager.BigW;
        }

        // Listen for win sound completion
        winSound.once('complete', () => {
            if (this.activeWinOverlay) {
                Events.emitter.off(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN);
                this.destroyWinOverlay(scene);
                
            }
            // not complete, sound will continue playing until winning counting to final value
        });

        buttonZone.on('pointerdown', () => {
            scene.audioManager.WinSkip.play();
            // skip winning counting to final value
            Events.emitter.off(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN);
            this.destroyWinOverlay(scene);
        });

        // Animate container
        container.setScale(0);
        scene.tweens.add({
            targets: container,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    public destroyWinOverlay(scene: GameScene): void {
        if (this.winOverlayContainer) {
            this.winOverlayContainer.destroy();
            this.winOverlayContainer = null;
            this.activeWinOverlay = false;
            scene.audioManager.stopWinSFX(scene);
            
            // Emit event that win overlay is hidden
            Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
        }
    }

    private createWinParticles(scene: GameScene, x: number, y: number, color: number = 0xFFD700): void {
        // Create a particle emitter for sparks
        const sparks = scene.add.particles(x, y, 'star', {
            speed: { min: 200, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            gravityY: 300,
            quantity: 1,
            frequency: 50,
            tint: color,
            emitting: false
        });

        // Create a particle emitter for glowing effect
        const glow = scene.add.particles(x, y, 'star', {
            speed: { min: 50, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.2, end: 0.4, ease: 'Quad.easeOut' },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 1500,
            quantity: 1,
            frequency: 50,
            tint: color,
            emitting: false
        });

        // Emit particles in a burst
        sparks.explode(15);
        glow.explode(10);

        // Create expanding ring effect
        const ring = scene.add.graphics();
        ring.lineStyle(2, color, 1);
        ring.strokeCircle(0, 0, 10);
        ring.setPosition(x, y);

        // Animate the ring
        scene.tweens.add({
            targets: ring,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                ring.destroy();
            }
        });

        // Cleanup particles after animation
        scene.time.delayedCall(1500, () => {
            sparks.destroy();
            glow.destroy();
        });
    }

    private checkMatch(symbolGrid: number[][], scene: GameScene): string {
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const symbolCount: { [key: number]: number } = {};
        const matchIndices: { [key: number]: { row: number; col: number; }[] } = {};

        // 1. Count occurrences and collect indices
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const symbol = symbolGrid[row][col];
                symbolCount[symbol] = (symbolCount[symbol] || 0) + 1;
                if (!matchIndices[symbol]) matchIndices[symbol] = [];
                matchIndices[symbol].push({ row, col });
            }
        }

        // 2. Find symbols with >=8 matches
        let foundMatch = false;
        let matchedSymbol: number | null = null;
        for (const symbol in symbolCount) {
            if (symbolCount[symbol] >= 8) {
                foundMatch = true;
                matchedSymbol = parseInt(symbol);
                break;
            }
        }

        if (!foundMatch) {
            // --- SCATTER CHECK ---
            const scatterCount = symbolCount[0] || 0;
            if (scatterCount >= 4 || (scene.gameData.isBonusRound && scatterCount >= 3)) {
                // Prevent new spins during scatter sequence
                scene.gameData.isSpinning = true;
                
                // Play animation for all scatter symbols
                let scatterSprites: GameObjects.Sprite[] = [];
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        if (symbolGrid[row][col] === 0 && this.symbolGrid[row][col]) {
                            scatterSprites.push(this.symbolGrid[row][col]);
                        }
                    }
                }
                let animationsToComplete = scatterSprites.length;
                const onAllAnimationsComplete = () => {
                    // Award free spins based on scatterCount
                    let freeSpins = scene.gameData.freeSpins || 0;

                    if (scene.gameData.isBonusRound) {
                        // During bonus round, add 5 spins for 3+ scatters
                        if (scatterCount === 3) freeSpins += 5;
                        else if (scatterCount === 4) freeSpins += 10;
                        else if (scatterCount === 5) freeSpins += 12;
                        else if (scatterCount === 6) freeSpins += 15;
                        
                        scene.gameData.freeSpins = freeSpins;
                        // Update the remaining spins display
                        if (scene.buttons.autoplay.isAutoPlaying) {
                            scene.buttons.autoplay.updateRemainingSpinsDisplay();
                        }
                        // Continue with next spin since we're already in bonus
                        scene.gameData.isSpinning = false;
                        Events.emitter.emit(Events.SPIN, {
                            currentRow: scene.gameData.currentRow,
                            symbols: scene.gameData.slot.values
                        });
                    } else {
                        // Initial bonus trigger
                        if (scatterCount === 4) freeSpins += 10;
                        else if (scatterCount === 5) freeSpins += 12;
                        else if (scatterCount === 6) freeSpins += 15;

                        // Enable bonus round state
                        scene.gameData.isBonusRound = true;
                        scene.gameData.freeSpins = freeSpins;
                        scene.gameData.totalBonusWin = 0; // Reset bonus win counter at start
                        
                        
                        scene.background.toggleBackground(scene);
                        scene.audioManager.changeBackgroundMusic(scene);

                        // If in autoplay, stop it before showing free spins popup
                        if (scene.buttons.autoplay.isAutoPlaying) {
                            scene.buttons.autoplay.stop();
                        }

                        // Show the popup for initial trigger
                        this.showFreeSpinsPopup(scene, freeSpins);
                    }
                };

                if (animationsToComplete === 0) {
                    onAllAnimationsComplete();
                } else {
                    scene.audioManager.ScatterSFX.play();
                    
                    scatterSprites.forEach((sprite) => {
                        // Create particles for scatter explosion
                        this.createWinParticles(scene, sprite.x, sprite.y, 0xFF0000);
                        
                        // Play scatter symbol animation
                        this.animation.playSymbolAnimation(sprite, 0);
                        sprite.once('animationcomplete', () => {
                            sprite.alpha = 0;
                            animationsToComplete--;
                            if (animationsToComplete === 0) {
                                onAllAnimationsComplete();
                            }
                        });
                    });
                }

                Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
                return "free spins";
            }

            // At the end, emit WIN to update totalWin text
            Events.emitter.emit(Events.WIN, {});
            scene.gameData.isSpinning = false;
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: symbolGrid,
                newRandomValues: symbolGrid
            });

            // Play win audio and show overlay based on totalWin/bet multiplier
            const bet = scene.gameData.bet || 1;
            const totalWin = scene.gameData.totalWin || 0;
            const multiplier = totalWin / bet;
            
            if (multiplier > 1) {
                this.showWinOverlay(scene, totalWin, bet);
            }
            scene.audioManager.playWinSFX(multiplier, scene);

            Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
            return "No more matches";
        }

        // 3. Get all matched indices for the symbol
        const matchedCells = matchIndices[matchedSymbol!];

        // 4. Add to totalWin and balance
        const bet = scene.gameData.bet || 1;
        // WIN AMOUNT SHOULD BE IN BACKEND 
        // TEMPORARY ONLY FOR TESTING
        let winAmount = 0;
        if (matchedSymbol !== null) {
            if (matchedCells.length === 8 || matchedCells.length === 9) {
                winAmount = matchedSymbol === 0 ? 100 * bet :
                           scene.gameData.winamounts[0][matchedSymbol] * bet;

            } else if (matchedCells.length === 10 || matchedCells.length === 11) {
                winAmount = matchedSymbol === 0 ? 5 * bet :
                           scene.gameData.winamounts[1][matchedSymbol] * bet;

            } else if (matchedCells.length >= 12) {
                winAmount = matchedSymbol === 0 ? 3 * bet :
                           scene.gameData.winamounts[2][matchedSymbol] * bet;
            }
        }

        // TEMPORARY ONLY FOR TESTING


        scene.gameData.totalWin += winAmount; // win amount should already be calculated in backend
        scene.gameData.balance += winAmount; // balance should already be updated in backend
        
        // Track bonus wins separately
        if (scene.gameData.isBonusRound) {
            scene.gameData.totalBonusWin += winAmount; // bonus win amount should already be calculated in backend
        }
        
        Events.emitter.emit(Events.WIN, {});

        // Popup text at the matched symbol closest to the center
        const gridCenter = { row: (rows - 1) / 2, col: (cols - 1) / 2 };
        let minDist = Infinity;
        let popupPos = { x: scene.scale.width / 2, y: scene.scale.height / 2 };
        matchedCells.forEach(({ row, col }) => {
            const dist = Math.abs(row - gridCenter.row) + Math.abs(col - gridCenter.col);
            if (dist < minDist && this.symbolGrid[row][col]) {
                minDist = dist;
                const symbolSprite = this.symbolGrid[row][col];
                popupPos = { x: symbolSprite.x, y: symbolSprite.y };
            }
        });

        const popupText = scene.add.text(
            popupPos.x,
            popupPos.y,
            `+$${winAmount.toFixed(2)}`,
            {
                fontSize: '64px',
                color: '#FFD700',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 6,
                fontFamily: 'Poppins'
            }
        );

        popupText.setOrigin(0.5, 0.5);
        popupText.setDepth(100);

        // Animate the popup text with scale and float effect
        scene.tweens.add({
            targets: popupText,
            y: popupPos.y - 80,
            alpha: 0,
            scale: 1.5,
            duration: 2000,
            ease: 'Back.easeOut',
            onComplete: () => {
                popupText.destroy();
            }
        });

        // 5. Mark matched cells for removal
        const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
        matchedCells.forEach(({ row, col }) => {
            toRemove[row][col] = true;
        });

        // 6. Animate matched symbols out with particles
        let tweensToComplete = 0;
        
        scene.audioManager.playRandomQuickWin();

        matchedCells.forEach(({ row, col }) => {
            const symbolSprite = this.symbolGrid[row][col];
            if (symbolSprite) {
                tweensToComplete++;
                
                // Create particles for each matched symbol
                this.createWinParticles(scene, symbolSprite.x, symbolSprite.y, 0xFFD700);
                
                scene.tweens.add({
                    targets: symbolSprite,
                    alpha: 1,
                    scale: 1,
                    duration: 1000,
                    ease: 'Circ.easeInOut',
                    onStart: () => {
                        // Add blur effect when starting the removal animation
                        if ((scene.sys.game.renderer as any).pipelines) {
                            symbolSprite.setPipeline('BlurPostFX');
                            (symbolSprite as any).blurStrength = 0.8;
                        }
                       
                    },
                    onComplete: () => {
                        symbolSprite.destroy();
                        tweensToComplete--;
                        if (tweensToComplete === 0) {
                            this.dropAndRefill(symbolGrid, toRemove, scene);
                        }
                    }
                });
            }
        });

        // Store matched cells for reference
        scene.gameData.currentMatchingSymbols = matchedCells.map(() => 
            matchedSymbol !== null ? matchedSymbol : 0
        );

        // After finding matches of 8 or more symbols
        if (matchedCells.length >= 8 && matchedSymbol !== null && matchedSymbol >= 1 && matchedSymbol <= 9) {
            matchedCells.forEach(({ row, col }) => {
                const symbolSprite = this.symbolGrid[row][col];
                if (symbolSprite) {
                    this.animation.playSymbolAnimation(symbolSprite, matchedSymbol);
                }
            });
        }

        return "continue match";
    }

    private dropAndRefill(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene): void {
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;
        const dropTweens: Promise<void>[] = [];
        const newSymbols: GameObjects.Sprite[] = [];

        // For each column, drop down and fill new randoms
        for (let col = 0; col < cols; col++) {
            // Build new column after removals
            const newCol: number[] = [];
            let dropMap: number[] = [];
            for (let row = rows - 1; row >= 0; row--) {
                if (!toRemove[row][col]) {
                    newCol.unshift(symbolGrid[row][col]);
                    dropMap.unshift(row);
                }
            }

            // Fill the rest with new random symbols at the top
            const numNew = rows - newCol.length;
            for (let i = 0; i < numNew; i++) {
                const newSymbol = Math.floor(Math.random() * Slot.SYMBOLS) + 1;
                newCol.unshift(newSymbol);
            }

            // Animate drop for each cell in this column
            let targetRow = rows - 1;
            for (let i = dropMap.length - 1; i >= 0; i--) {
                const fromRow = dropMap[i];
                const symbolSprite = this.symbolGrid[fromRow][col];
                if (symbolSprite) {
                    const newY = (height * 0.5) + targetRow * (height + verticalSpacing);
                    dropTweens.push(new Promise(resolve => {
                        scene.tweens.add({
                            targets: symbolSprite,
                            y: newY,
                            duration: 300,
                            ease: 'Cubic.easeIn',
                            onComplete: () => resolve()
                        });
                    }));
                    this.symbolGrid[targetRow][col] = symbolSprite;
                    symbolGrid[targetRow][col] = symbolGrid[fromRow][col];
                }
                targetRow--;
            }

            // Create and animate new symbols at the top
            for (let i = 0; i < numNew; i++) {
                const symbolValue = newCol[i];
                let symbolKey = 'Symbol0_SW'; // Default to scatter symbol
                let frameKey = 'Symbol0_SW-00000.png';
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_SW`;
                    frameKey = `Symbol${symbolValue}_SW-00000.png`;
                }
                const centerX = width * 0.5 + col * (width + horizontalSpacing);
                const startY = (height * 0.5) + (i - numNew) * (height + verticalSpacing);
                const endY = (height * 0.5) + i * (height + verticalSpacing);
                const newSymbol = scene.add.sprite(centerX, startY, symbolKey, frameKey);

                if (symbolValue === 0) {
                    newSymbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else {
                    newSymbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                }

                this.container.add(newSymbol);
                newSymbols.push(newSymbol);
                this.symbolGrid[i][col] = newSymbol;
                symbolGrid[i][col] = symbolValue;

                dropTweens.push(new Promise(resolve => {
                    scene.tweens.add({
                        targets: newSymbol,
                        y: endY,
                        duration: 300,
                        ease: 'Cubic.easeIn',
                        onComplete: () => resolve()
                    });
                }));
            }
        }

        // After all drops complete, check for new matches
        Promise.all(dropTweens).then(() => {
			const result = this.checkMatch(symbolGrid, scene);
			if (result === "No more matches" || result === "free spins") {
				Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
				scene.gameData.isSpinning = false;
			}
        });
    }
} 