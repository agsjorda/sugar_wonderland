import { Scene, GameObjects } from 'phaser';
import { Events } from "./Events";
import { Slot } from "./GameData";
import { GameData } from "./GameData";
import { AudioManager } from "./AudioManager";
import { Animation } from './Animation';
import { WinAnimation } from './WinAnimation';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { WinOverlayContainer } from './WinOverlayContainer';
import { GameAPI } from '../backend/GameAPI';
import { BombContainer } from './BombContainer';

// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameAPI: GameAPI;
    gameData: GameData;
    audioManager: AudioManager;
    buttons: any; // Reference to buttons for immediate state updates
    helpScreen: any; // Reference to help screen
    slotMachine: any; // Reference to slot machine for win overlay checks
    background: any; // Reference to background for bonus round changes
}

// Improved SymbolGrid interface with proper typing
interface SymbolGrid {
    [index: number]: (GameObjects.Sprite | SpineGameObject | BombContainer)[];
    length: number;
    map: <T>(callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => T[]) => T[][];
    forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => void;
}

interface SpinData {
    symbols: number[][];
    currentRow: number;
}

function transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
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
    public tweensToComplete: number = 0;
    private bombAnimationActive: boolean = false;
    private lastSpinTimestamp: number = 0;
    private readonly MIN_SPIN_INTERVAL = 200; // Minimum 200ms between spins

    public winOverlayContainers: WinOverlayContainer[] = [];
    private bombPopupContainer: GameObjects.Container | null = null;

    private animation: Animation;
    private winAnimation: WinAnimation;

    private isMobile: boolean = false;

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

        this.initVariables(scene as GameScene);
        this.isMobile = this.isMobileDevice();
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
        this.createContainer(scene as GameScene);
        this.createBackground(scene as GameScene);
        this.createSlot(scene as GameScene);
        this.eventListeners(scene as GameScene);
        
        // Initialize animations
        this.animation.create();
        this.winAnimation.create();
        
        // Set up bomb animation callbacks
        this.winAnimation.setBombAnimationCallbacks(
            () => this.setBombAnimationActive(true),  // On start
            () => this.setBombAnimationActive(false)  // On end
        );
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    private createContainer(scene: GameScene): void {
        this.container = scene.add.container(
            this.isMobile ? scene.scale.width * 0.01 : this.slotX,
            this.isMobile ? scene.scale.height * 0.23 : this.slotY);
        this.container.setScale(this.isMobile ? 0.43 : 1);

        this.totalGridWidth = this.isMobile ? this.totalGridWidth * 0.43 : this.totalGridWidth;
        this.totalGridHeight = this.isMobile ? this.totalGridHeight * 0.43 : this.totalGridHeight; 
        this.container.setDepth(4);
    }

    private createBackground(scene: GameScene): void {
        if(this.isMobile) return;
        const background = scene.add.image(0, 0, 'slotBackground').setOrigin(0, 0);
        background.setDepth(3);

        const paddingX = 90;
        const paddingY = 75;

        background.x = this.slotX - paddingX / 2;
        background.y = this.slotY - paddingY / 2;

        background.displayWidth = this.totalGridWidth + paddingX;
        background.displayHeight = this.totalGridHeight + paddingY;
    }

    private createSlot(scene: GameScene): void {
        const x = this.isMobile ? scene.scale.width * 0 : this.slotX - 45;    
        const y = this.isMobile ? scene.scale.height * 0.21 : this.slotY - 75/5;
        const width = this.isMobile ? this.totalGridWidth  : this.totalGridWidth + 90;
        const height = this.isMobile ? this.totalGridHeight * 1.22 : this.totalGridHeight + 75*0.8;
        
        const maskShape = scene.add.graphics();
        maskShape.fillRect(x, y, width, height);

        const mask = maskShape.createGeometryMask();
        this.container.setMask(mask);
        maskShape.setVisible(false);
    }

    private async createReel(scene: GameScene, data: SpinData): Promise<void> {
        
        Events.emitter.emit(Events.UPDATE_BALANCE);

        scene.gameAPI.getBalance().then((data) => {
            scene.gameData.debugLog(data);
            Events.emitter.emit(Events.UPDATE_BALANCE, data);
        });

        this.cleanupAloneSymbols();
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;
        let newValues: number[][] = [];
        
        // Wait for doSpin to complete
        const result = await scene.gameAPI.doSpin(scene.gameData.bet);
        scene.gameData.debugLog("result", result);
        scene.gameData.debugLog("slotArea", result.data.slotArea.SlotArea);
        
        newValues = transpose(result.data.slotArea.SlotArea);
        for(let i = 0; i < newValues.length; i++){
            for(let j = 0; j < newValues[i].length; j++){
                if(newValues[i][j] == 0)
                    //newValues[i][j] = -1;
                    // currently disable scatter 
                    newValues[i][j] ++;
                //}
            }
        }

        // Wait for all spin animations to complete
        await this.playSpinAnimations(scene, newValues, data);
        
        // Now sequentially process matches and drop/refill
        await this.processMatchesSequentially(scene, newValues);
    }

    private async playSpinAnimations(scene: GameScene, newValues: number[][], data: SpinData): Promise<void> {
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        let completedSymbols = 0;
        const totalSymbols = numCols * numRows;

        // Initialize newSymbolGrid with proper nested arrays
        let newSymbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as unknown as SymbolGrid;
        Object.assign(newSymbolGrid, {
            length: numRows,
            map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(newSymbolGrid[row], row)),
            forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(newSymbolGrid[index], index))
        });

        const rowInterval = 150; // ms between each row's arrival in a column
        let turboSpeed = scene.gameData.turbo ? 0.2 : 1;
        let offsetDelay = 1100;
        
        if(scene.gameData.turbo){
            scene.audioManager.TurboDrop.play();
        }

        const animationPromises: Promise<void>[] = [];

        for (let col = 0; col < numCols; col++) {
            for (let row = numRows - 1; row >= 0; row--) {
                const symbol = this.symbolGrid[row][col];
                const centerX = width * 0.5 + col * (width + horizontalSpacing);
                const centerY = height * 0.5;
                const symbolX = centerX;
                const symbolY = centerY + row * (height + verticalSpacing);
                const delay = (col * 250 + (numRows - 1 - row) * rowInterval) * turboSpeed;

                // Modify the symbol creation part
                const symbolValue = newValues[row][col];
                
                let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer | null = null;
                let symbolKey = 'Symbol0_SW'; // Default to scatter symbol
                let frameKey = 'Symbol0_SW-00000.png';
                const startY = symbolY - height * (numRows + 1);

                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_SW`;
                    frameKey = `Symbol${symbolValue}_SW-00000.png`;
                    newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey) as GameObjects.Sprite;
                } else if (symbolValue >= 10 && symbolValue <= 22) {
                    // Create BombContainer for bomb
                    newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                    scene.gameData.debugLog('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                } else {
                    newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey) as GameObjects.Sprite;
                }

                // Set the display size based on the symbol type
                if (symbolValue === 0) {
                    newSymbol?.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else if (symbolValue >= 10 && symbolValue <= 22) {
                    // Handle BombContainer display size
                    if (newSymbol instanceof BombContainer) {
                        newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                    } else if (newSymbol) {
                        newSymbol.setDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                    }
                    scene.gameData.debugLog("symbolValue", symbolValue);
                } else {
                    newSymbol?.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
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
                }

                // Tween out the old symbol
                if (symbol) {
                    const endY = symbol.y + height * (numRows + 1);
                    const distance = endY - symbol.y;
                    const baseSpeed = 2;
                    const durationOld = (distance / baseSpeed) * turboSpeed;

                    // Create multiple motion trails
                    const trails: Phaser.GameObjects.Sprite[] = [];
                    const numTrails = 10;
                    const trailSpacing = -100; // Space between trails

                    for (let i = 0; i < numTrails; i++) {
                        if(scene.gameData.turbo == false && 'texture' in symbol) {
                            const trail = scene.add.sprite(symbol.x, symbol.y, symbol.texture.key, symbol.frame.name);
                            trail.setDisplaySize(symbol.displayWidth, symbol.displayHeight);
                            trail.setAlpha(0.7 - (i * 0.15)); // Decreasing alpha for each trail
                            trail.setPipeline('BlurPostFX');

                            (trail as any).blurStrength = 0.8 + (i * 0.1); // Increasing blur for each trail
                            trail.setDepth(symbol.depth - (i + 1)); // Place trails behind the symbol
                            this.container.add(trail);
                            trails.push(trail);
                        }
                    }

                    scene.tweens.add({
                        targets: symbol,
                        y: endY,
                        alpha: 0.1,
                        scale: 0.5,
                        duration: durationOld,
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

                // Move new symbol down
                if(newSymbol) {
                    const animationPromise = new Promise<void>((resolve) => {
                        scene.tweens.add({
                            targets: newSymbol,
                            y: symbolY,
                            duration: duration,
                            ease: 'Quart.easeInOut',
                            delay: tweenDelay,
                            onComplete: () => {
                                if(row === 4){
                                    if(!scene.gameData.turbo){
                                        scene.audioManager.ReelDrop.play();
                                    }
                                }
                                resolve();
                            }
                        });
                    });
                    animationPromises.push(animationPromise);
                    
                    this.container.add(newSymbol);
                    newSymbolGrid[row][col] = newSymbol;
                }
            }
        }

        this.symbolGrid = newSymbolGrid;
        
        // Wait for all animations to complete
        await Promise.all(animationPromises);
        
        Events.emitter.emit(Events.SPIN_ANIMATION_END, {
            symbols: newValues,
            currentRow: data.currentRow
        });
    }

    private async processMatchesSequentially(scene: GameScene, symbolGrid: number[][]): Promise<void> {
        let continueMatching = true;
        let lastResult: string | undefined = undefined;
        try {
            while (continueMatching) {
                const result = await this.checkMatchAsync(symbolGrid, scene);
                scene.gameData.debugLog("Match result:", result);
                lastResult = result;
                if (result === "No more matches" || result === "free spins") {
                    continueMatching = false;
                }
                // If result is "continue match", the loop will continue
            }
        } catch (error) {
            scene.gameData.debugError("Error in match processing: " + error);
        } finally {
            // Only show win overlay at the end of all matches
            const bet = scene.gameData.bet || 1;
            const totalWin = scene.gameData.totalWin || 0;
            const multiplierWin = totalWin / bet;
            if (multiplierWin >= 10 && lastResult === "No more matches") {
                this.showWinOverlay(scene, totalWin, bet);
            }
            // Always ensure spinning state is reset
            scene.gameData.isSpinning = false;
            scene.gameData.debugLog("Spin sequence completed, isSpinning reset to false");
            // Immediately re-enable buttons when spinning completes
            if (scene.buttons && scene.buttons.enableButtonsVisually) {
                scene.buttons.enableButtonsVisually(scene);
            }
        }
    }

    private eventListeners(scene: GameScene): void {
        Events.emitter.on(Events.SPIN, async (data: SpinData) => {
            const currentTime = Date.now();
            
            // Immediate check to prevent overlapping spins
            if (scene.gameData.isSpinning) {
                scene.gameData.debugLog("Spin already in progress, ignoring new spin request");
                return;
            }
            
            // Rate limiting: prevent spins that are too close together
            if (currentTime - this.lastSpinTimestamp < this.MIN_SPIN_INTERVAL) {
                scene.gameData.debugLog(`Spin rate limited, ${this.MIN_SPIN_INTERVAL}ms cooldown active`);
                return;
            }
            
            // Set spinning state immediately to block further spin attempts
            scene.gameData.isSpinning = true;
            this.lastSpinTimestamp = currentTime;
            
            // Ensure buttons stay disabled during actual spin processing
            if (scene.buttons && scene.buttons.updateButtonStates) {
                scene.buttons.updateButtonStates(scene);
            }
            
            try {
                scene.audioManager.ReelStart.play();
                await this.createReel(scene, data);
            } catch (error) {
                scene.gameData.debugError("Error during spin: " + error);
                scene.gameData.isSpinning = false; // Reset state on error
                
                // Re-enable buttons on error
                if (scene.buttons && scene.buttons.enableButtonsVisually) {
                    scene.buttons.enableButtonsVisually(scene);
                }
            }
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
        this.symbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as SymbolGrid;
        Object.assign(this.symbolGrid, {
            map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(this.symbolGrid[row], row)),
            forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => 
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
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const symbolY = centerY + row * (height + verticalSpacing);

                const symbol = scene.add.sprite(symbolX, symbolY, symbolKey, frameKey) as GameObjects.Sprite;

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


    public async spin(scene: Scene, data: any): Promise<void> {
        // Clear previous bomb animations
        
        const gameScene = scene as GameScene;
        


        // Create new spin data
        const spinData: SpinData = {
            symbols: data.symbols,
            currentRow: 0
        };

        // Place scatters if needed
        if (gameScene.gameData.scatterCount > 0) {
            gameScene.gameData.slot.placeScatters(
                gameScene.gameData.minScatter,
                gameScene.gameData.maxScatter,
                gameScene.gameData.scatterChance
            );
        }

        // Place bombs during bonus round
        if (gameScene.gameData.isBonusRound) {
            // Create a copy of the symbols array to modify
            const symbols: number[][] = data.symbols.map((row: number[]) => [...row]);
            
            // Place bombs in the grid
            for (let row = 0; row < Slot.ROWS; row++) {
                for (let col = 0; col < Slot.COLUMNS; col++) {
                    // Only replace regular symbols (1-9)
                    if (symbols[row][col] >= 1 && symbols[row][col] <= 9) {
                        // Determine if we should place a bomb
                        if (Math.random() < gameScene.gameData.bombChance / 100) { // Convert percentage to decimal
                            // Determine bomb type based on probabilities
                            const rand = Math.random();
                            let bombType: number;
                            if (rand < 0.6) { // Low (60%)
                                bombType = Math.floor(Math.random() * 7) + 10; // 10-16
                            } else if (rand < 0.9) { // Medium (30%)
                                bombType = Math.floor(Math.random() * 4) + 17; // 17-20
                            } else { // High (10%)
                                bombType = Math.floor(Math.random() * 2) + 21; // 21-22
                            }
                            symbols[row][col] = bombType;
                            gameScene.gameData.slot.bombCount++;
                        }
                    }
                }
            }
            
            // Update the spin data with the modified symbols
            spinData.symbols = symbols;
        }
        // Create the reel
        this.createReel(gameScene, spinData);
    }


    public showBonusWin(scene: GameScene, totalWin: number): void {    
        // Create win overlay container for bonus completion
        const winOverlay = new WinOverlayContainer(scene, this.winAnimation);
        this.winOverlayContainers.push(winOverlay);
        this.activeWinOverlay = true;

        // Show the bonus win overlay (-2 indicates "Congrats" type)
        winOverlay.show(totalWin, -2);

        scene.buttons.freeSpinBtn.visible = false;
    }

    public update(): void {
        // Empty implementation - can be used for future animations or updates
    }

    private showFreeSpinsPopup(scene: GameScene, freeSpins: number): void {
        // Check if there's an active win overlay
        if (this.activeWinOverlay) {
            // Wait for the win overlay to be removed before proceeding
            const checkOverlay = () => {
                if (this.activeWinOverlay) {
                    // Still active, check again in a short delay
                    scene.time.delayedCall(1000, checkOverlay);
                    scene.gameData.debugLog("overlay active, waiting to show free spins popup");
                } else {
                    // Overlay removed, proceed with free spins popup
                    scene.gameData.debugLog("overlay removed, showing free spins popup");
                    this.showWinOverlay(scene, freeSpins, -1);
                }
            };
            checkOverlay();
        } else {
            scene.gameData.debugLog("no overlay active, showing free spins popup immediately");
            // No overlay active, proceed immediately
            this.showWinOverlay(scene, freeSpins, -1);
        }
    }


    private showWinOverlay(scene: GameScene, totalWin: number, bet: number): void {
        // Calculate multiplier for win type
        let multiplier = 1;
        if(bet > 0)
             multiplier = totalWin / bet;
        else
            multiplier = bet;

        // Don't create overlay if multiplier is 0 or there's already an active overlay for the same type
        if(multiplier === 0) {
            return;
        }

        // Create new win overlay container
        const winOverlay = new WinOverlayContainer(scene, this.winAnimation);
        this.winOverlayContainers.push(winOverlay);
        this.activeWinOverlay = true;

        // Show the win overlay
        winOverlay.show(totalWin, multiplier);
    }

    public destroyWinOverlay(scene: GameScene): void {
        // Destroy all win overlay containers
        // Note: Each container will remove itself from the array when destroyed
        const overlays = [...this.winOverlayContainers]; // Create a copy to avoid mutation issues
        overlays.forEach(container => container.destroy());
        
        // Ensure array is cleared and state is reset
        this.winOverlayContainers = [];
        this.activeWinOverlay = false;
        scene.audioManager.stopWinSFX(scene);
        Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
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

    private async checkMatchAsync(symbolGrid: number[][], scene: GameScene): Promise<string> {
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
                // Handle scatter logic (keeping original logic)
                return await this.handleScatterMatch(scene, symbolGrid, scatterCount);
            }

            // At the end, emit WIN to update totalWin text
            Events.emitter.emit(Events.WIN, {});
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: symbolGrid,
                newRandomValues: symbolGrid
            });

            Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
            return "No more matches";
        }

        // Process the match
        const matchedCells = matchIndices[matchedSymbol!];
        
        // Calculate win amount
        const bet = scene.gameData.bet || 1;
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

        // Update game data
        scene.gameData.totalWin += winAmount;
        scene.gameData.balance += winAmount;
        
        if (scene.gameData.isBonusRound) {
            scene.gameData.totalBonusWin += winAmount;
        }
        
        Events.emitter.emit(Events.WIN, {});

        // Handle UI updates
        if(this.isMobile) {
            Events.emitter.emit(Events.UPDATE_TOTAL_WIN, winAmount);
        } else {
            // Show popup text
            this.showWinPopup(scene, matchedCells, winAmount);
        }

        // Mark matched cells for removal
        const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
        matchedCells.forEach(({ row, col }) => {
            toRemove[row][col] = true;
        });

        // Wait for match animations to complete
        await this.animateMatchedSymbols(scene, matchedCells, matchedSymbol!);
        
        // Wait for drop and refill to complete
        await this.dropAndRefillAsync(symbolGrid, toRemove, scene);

        return "continue match";
    }

    private async handleScatterMatch(scene: GameScene, symbolGrid: number[][], scatterCount: number): Promise<string> {
        // Prevent new spins during scatter sequence
        scene.gameData.isSpinning = true;
        
        // Play animation for all scatter symbols
        let scatterSprites: GameObjects.Sprite[] = [];
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (symbolGrid[row][col] === 0 && this.symbolGrid[row][col]) {
                    scatterSprites.push(this.symbolGrid[row][col] as GameObjects.Sprite);
                }
            }
        }

        // Wait for scatter animations to complete
        await this.animateScatterSymbols(scene, scatterSprites, scatterCount);

        Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
        return "free spins";
    }

    private async animateScatterSymbols(scene: GameScene, scatterSprites: GameObjects.Sprite[], scatterCount: number): Promise<void> {
        if (scatterSprites.length === 0) {
            this.handleScatterRewards(scene, scatterCount);
            return;
        }

        scene.audioManager.ScatterSFX.play();
        
        const animationPromises: Promise<void>[] = [];
        
        scatterSprites.forEach((sprite) => {
            const animationPromise = new Promise<void>((resolve) => {
                // Create particles for scatter explosion
                this.createWinParticles(scene, sprite.x, sprite.y, 0xFF0000);
                
                // Play scatter symbol animation
                this.animation.playSymbolAnimation(sprite, 0);
                sprite.once('animationcomplete', () => {
                    sprite.alpha = 0;
                    resolve();
                });
            });
            animationPromises.push(animationPromise);
        });

        await Promise.all(animationPromises);
        
        // Handle scatter rewards after animations complete
        this.handleScatterRewards(scene, scatterCount);
    }

    private handleScatterRewards(scene: GameScene, scatterCount: number): void {
        // Award free spins based on scatterCount
        let freeSpins = scene.gameData.freeSpins || 0;

        if (scene.gameData.isBonusRound) {
            // During bonus round, add spins for 3+ scatters
            let addFreeSpins = 0;
            if (scatterCount === 3) addFreeSpins = 3;
            else if (scatterCount === 4) addFreeSpins = 5;
            else if (scatterCount === 5) addFreeSpins = 10;
            else if (scatterCount === 6) addFreeSpins = 15;

            scene.gameData.totalFreeSpins += addFreeSpins;
            scene.gameData.freeSpins += addFreeSpins;
            scene.buttons.autoplay.addSpins(addFreeSpins);
            
            // Update the remaining spins display
            if (scene.buttons.autoplay.isAutoPlaying) {
                scene.buttons.autoplay.updateRemainingSpinsDisplay();
            }

            // Show retrigger popup
            this.showRetriggerPopup(scene, addFreeSpins);
        } else {
            // Initial bonus trigger
            if (scatterCount === 4) freeSpins += 10;
            else if (scatterCount === 5) freeSpins += 12;
            else if (scatterCount === 6) freeSpins += 15;

            // Enable bonus round state
            scene.gameData.totalFreeSpins = 0 + freeSpins;
            scene.gameData.freeSpins = freeSpins;
            scene.gameData.totalBonusWin = 0;
            
            scene.gameData.isBonusRound = true;
            scene.background.toggleBackground(scene);
            scene.audioManager.changeBackgroundMusic(scene);

            // If in autoplay, stop it before showing free spins popup
            if (scene.buttons.autoplay.isAutoPlaying) {
                scene.buttons.autoplay.stop();
                
                // Wait a moment before starting free spins autoplay to ensure clean state transition
                scene.time.delayedCall(100, () => {
                    Events.emitter.emit(Events.AUTOPLAY_START, freeSpins);
                });
            } else {
                // Not in autoplay, start free spins autoplay immediately
                Events.emitter.emit(Events.AUTOPLAY_START, freeSpins);
            }

            // Show the popup for initial trigger
            this.showFreeSpinsPopup(scene, freeSpins);
        }
    }

    private showRetriggerPopup(scene: GameScene, addFreeSpins: number): void {
        const popupContainer = scene.add.container(
            this.isMobile ? scene.scale.width * 0.5: scene.scale.width/2,
            this.isMobile ? scene.scale.height * 0.5 : scene.scale.height/2);
        popupContainer.setDepth(1000);
    
        const bg = scene.add.image(0, 0, 'buyFeatBG');
        bg.setOrigin(0.5, 0.5);
        popupContainer.add(bg);
        if ((scene.sys.game.renderer as any).pipelines) {
            bg.setPipeline('BlurPostFX');
        }
        const text = scene.add.text(0, 0, `You won\n\n\nmore free spins`, {
            fontSize: '48px',
            color: '#FFFFFF',
            fontFamily: 'Poppins', 
            fontStyle: 'bold',
            align: 'center', 
        });
        text.setOrigin(0.5, 0.5);

        const freeSpinsCount = scene.add.text(0, 0, `${addFreeSpins}`, {
            fontSize: '88px',
            color: '#FFFFFF',
            fontFamily: 'Poppins', 
            fontStyle: 'bold',
            align: 'center'
        });
        freeSpinsCount.setOrigin(0.5, 0.5);
        
        const gradient = freeSpinsCount.context.createLinearGradient(0,0,0,freeSpinsCount.height);
        gradient.addColorStop(0, '#FFF15A');
        gradient.addColorStop(0.5, '#FFD000');
        gradient.addColorStop(1, '#FFB400');
        freeSpinsCount.setFill(gradient);

        popupContainer.add(text);
        popupContainer.add(freeSpinsCount);
        popupContainer.setScale(this.isMobile ? 0.5 : 1);

        // Make container interactive
        popupContainer.setInteractive(new Phaser.Geom.Rectangle(-popupContainer.width/2, -popupContainer.height/2, popupContainer.width, popupContainer.height), Phaser.Geom.Rectangle.Contains);
        
        // Auto-hide popup after 1 second
        scene.time.delayedCall(1000, () => {
            scene.tweens.add({
                targets: popupContainer,
                alpha: 0,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    popupContainer.destroy();
                    
                    // Continue with next spin since we're already in bonus
                    Events.emitter.emit(Events.SPIN, {
                        currentRow: scene.gameData.currentRow,
                        symbols: scene.gameData.slot.values
                    });
                }
            });
        });

        // Also allow manual click to dismiss
        popupContainer.once('pointerdown', () => {
            scene.tweens.add({
                targets: popupContainer,
                alpha: 0,
                duration: 500,
                ease: 'Power2',
                onComplete: () => {
                    popupContainer.destroy();
                    
                    // Continue with next spin since we're already in bonus
                    Events.emitter.emit(Events.SPIN, {
                        currentRow: scene.gameData.currentRow,
                        symbols: scene.gameData.slot.values
                    });
                }
            });
        });
    }

    private showWinPopup(scene: GameScene, matchedCells: { row: number; col: number; }[], winAmount: number): void {
        const rows = Slot.ROWS;
        const cols = Slot.COLUMNS;
        
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
    }

    private async animateMatchedSymbols(scene: GameScene, matchedCells: { row: number; col: number; }[], matchedSymbol: number): Promise<void> {
        scene.audioManager.playRandomQuickWin();

        const animationPromises: Promise<void>[] = [];

        matchedCells.forEach(({ row, col }) => {
            const symbolSprite = this.symbolGrid[row][col];
            if (symbolSprite) {
                const animationPromise = new Promise<void>((resolve) => {
                    // Create particles for each matched symbol
                    this.createWinParticles(scene, symbolSprite.x, symbolSprite.y, 0xFFD700);
                    
                    scene.tweens.add({
                        targets: symbolSprite,
                        alpha: 0,
                        scale: 0.5,
                        duration: 1000,
                        ease: 'Circ.easeInOut',
                        onComplete: () => {
                            symbolSprite.destroy();
                            resolve();
                        }
                    });
                });
                animationPromises.push(animationPromise);
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
                    try {
                        this.animation.playSymbolAnimation(symbolSprite as GameObjects.Sprite, matchedSymbol);
                    } catch (error) {
                        scene.gameData.debugError("Error playing symbol animation: " + error);
                    }
                }
            });
        }

        await Promise.all(animationPromises);
    }

    private async dropAndRefillAsync(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene): Promise<void> {
        scene.gameData.debugLog("processing drop and refill");

        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        // Clean up any Alone symbols that might be left on screen
        this.cleanupAloneSymbols();

        const dropPromises: Promise<void>[] = [];

        // For each column, drop down and fill new randoms
        for (let col = 0; col < cols; col++) {
            // Build new column after removals
            const newCol: number[] = [];
            let dropMap: number[] = [];
            for (let row = 0; row < rows; row++) {
                if (!toRemove[row][col]) {
                    newCol.push(symbolGrid[row][col]);
                    dropMap.push(row);
                }
            }

            // Fill the rest with new random symbols at the top
            const numNew = rows - newCol.length;
            for (let i = 0; i < numNew; i++) {
                const newSymbol = Math.floor(Math.random() * Slot.SYMBOLS) + 1;
                newCol.unshift(newSymbol);
            }

            // Create a temporary grid to track the new positions
            const tempSymbolGrid: (GameObjects.Sprite | SpineGameObject | BombContainer)[] = [];
            
            // Animate drop for each cell in this column
            let targetRow = rows - 1;
            for (let i = dropMap.length - 1; i >= 0; i--) {
                const fromRow = dropMap[i];
                const symbolSprite = this.symbolGrid[fromRow][col];
                if (symbolSprite && symbolSprite.active) {
                    const newY = (height * 0.5) + targetRow * (height + verticalSpacing);
                    const dropPromise = new Promise<void>((resolve) => {
                        scene.tweens.add({
                            targets: symbolSprite,
                            y: newY,
                            duration: 300,
                            ease: 'Cubic.easeIn',
                            onComplete: () => resolve()
                        });
                    });
                    dropPromises.push(dropPromise);
                    tempSymbolGrid[targetRow] = symbolSprite;
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
                
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const startY = centerY + (i - numNew) * (height + verticalSpacing);
                const endY = centerY + i * (height + verticalSpacing);
                
                let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer;
                
                if (symbolValue >= 10 && symbolValue <= 22) {
                    // Create BombContainer for bomb
                    newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                    scene.gameData.debugLog('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                } else {
                    newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey) as GameObjects.Sprite;
                    if (symbolValue === 0) {
                        newSymbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                    } else {
                        newSymbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                    }
                }

                this.container.add(newSymbol);
                tempSymbolGrid[i] = newSymbol;
                symbolGrid[i][col] = symbolValue;

                const dropPromise = new Promise<void>((resolve) => {
                    scene.tweens.add({
                        targets: newSymbol,
                        y: endY,
                        duration: 300,
                        ease: 'Cubic.easeIn',
                        onComplete: () => resolve()
                    });
                });
                dropPromises.push(dropPromise);
            }
            
            // Update the symbol grid for this column after all tweens are set up
            for (let row = 0; row < rows; row++) {
                if (tempSymbolGrid[row]) {
                    this.symbolGrid[row][col] = tempSymbolGrid[row];
                }
            }
        }

        // Wait for all drop animations to complete
        await Promise.all(dropPromises);

        // Handle win effects after drop completes
        const bet = scene.gameData.bet || 1;
        const totalWin = scene.gameData.totalWin || 0;
        const multiplierWin = totalWin / bet;
        
        // For autoplay, use shorter delays to keep the flow moving
        const delay = scene.buttons.autoplay.isAutoPlaying ? 300 : 1500;
        
        await new Promise<void>((resolve) => {
            scene.time.delayedCall(delay, () => {
                // Play win audio (but do NOT show overlay here)
                scene.audioManager.playWinSFX(multiplierWin, scene);
                resolve();
            });
        });
        Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
    }

    private cleanupAloneSymbols(): void {
        // Clean up any symbols that might be left on screen but not in the grid
        this.container.each((child: any) => {
            if ((child instanceof Phaser.GameObjects.Sprite || child instanceof SpineGameObject) && child.active) {
                let foundInGrid = false;
                for (let row = 0; row < this.symbolGrid.length; row++) {
                    for (let col = 0; col < this.symbolGrid[row].length; col++) {
                        if (this.symbolGrid[row][col] === child) {
                            foundInGrid = true;
                            break;
                        }
                    }
                    if (foundInGrid) break;
                }
                
                if (!foundInGrid && child.parentContainer === this.container) {
                    console.log("cleaning up Alone symbol");
                    child.destroy();
                }
            }
        });
    }

    public destroy(): void {
        // Clean up win animation
        if (this.winAnimation) {
            this.winAnimation.destroy();
        }
        
        // Clean up win overlay containers
        const overlays = [...this.winOverlayContainers]; // Create a copy to avoid mutation issues
        overlays.forEach(container => container.destroy());
        this.winOverlayContainers = [];
        
        // Clean up bomb popup container
        if (this.bombPopupContainer) {
            this.bombPopupContainer.destroy();
            this.bombPopupContainer = null;
        }
        
        // Clean up container
        if (this.container) {
            this.container.destroy();
        }
        
        // Reset state
        this.activeWinOverlay = false;
        this.tweensToComplete = 0;
    }

    /**
     * Fetches the latest balance from the backend and updates GameData.
     * @param scene The current game scene (must have gameAPI and gameData)
     */
    public async getBalance(scene: Scene): Promise<void> {
        const gameScene = scene as GameScene;
        try {
            await gameScene.gameAPI.getBalance();
            // Optionally, emit an event to update UI or notify listeners
            Events.emitter.emit(Events.UPDATE_CURRENCY, {
                balance: gameScene.gameData.balance,
                currency: gameScene.gameData.currency
            });
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    }

    private hasActiveBombAnimations(): boolean {
        // Check if bomb animation is active through WinAnimation system
        if (this.bombAnimationActive) {
            return true;
        }
        
        // Check if any BombContainer is playing animation
        for (let row = 0; row < this.symbolGrid.length; row++) {
            for (let col = 0; col < this.symbolGrid[row].length; col++) {
                const symbol = this.symbolGrid[row][col];
                if (symbol instanceof BombContainer) {
                    if (symbol.isPlayingAnimation()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public setBombAnimationActive(active: boolean): void {
        this.bombAnimationActive = active;
        
        // If setting to active, add a timeout to reset it after a reasonable time
        if (active) {
            // Reset after 5 seconds as a fallback (bomb animations typically last 2-3 seconds)
            setTimeout(() => {
                this.bombAnimationActive = false;
            }, 5000);
        }
    }
} 