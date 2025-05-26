import { Scene } from 'phaser';
import { State } from '../../fsm/state';
import { Events } from './Events';
import { GameData, Slot } from './GameData';
import { AudioManager } from './AudioManager';
import { Background } from './Background';
import { SlotMachine } from './SlotMachine';
import { Buttons } from '../../ui/Buttons';

// Event data interfaces
interface SpinEventData {
    symbols: number[][];
    currentRow: number;
    newRandomValues?: number[][];
}

interface GameScene extends Scene {
    gameData: GameData;
    background: Background;
    audioManager: AudioManager;
    buttons: Buttons;
    slotMachine: SlotMachine;
}

export class IdleState extends State {
    private spinEventListener?: (data: SpinEventData) => void;
    private changeLineListener?: () => void;

    start(scene: Scene): void {
        const gameScene = scene as GameScene;
        gameScene.gameData.currentRow = 0;
        gameScene.gameData.isSpinning = false;

        Events.emitter.emit(Events.START, {
            symbols: gameScene.gameData.slot.values,
            currentRow: gameScene.gameData.currentRow
        });
        this.initEventListeners(gameScene);
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        // Empty implementation
    }

    end(_scene: Scene): void {
        if (this.spinEventListener) {
            Events.emitter.off(Events.SPIN, this.spinEventListener);
            this.spinEventListener = undefined;
        }

        if (this.changeLineListener) {
            Events.emitter.off(Events.CHANGE_LINE, this.changeLineListener);
            this.changeLineListener = undefined;
        }

    }

    private spin(scene: GameScene, _data?: SpinEventData): void {
        if (scene.gameData.isSpinning) { return; }
        scene.gameData.isSpinning = true;

        if (scene.gameData.freeSpins > 0) {
            scene.gameData.freeSpins--;
            if (scene.gameData.freeSpins === 0) {
                // End of bonus round
                scene.gameData.isBonusRound = false;
                scene.background.disableBonusBackground(scene);
                scene.audioManager.changeBackgroundMusic(scene);
                
                // Stop autoplay when free spins are done
                if (scene.buttons.autoplay.isAutoPlaying) {
                    scene.buttons.autoplay.stop();
                }

                // Show bonus end summary after the last spin completes
                const bonusWin = scene.gameData.totalBonusWin;
                Events.emitter.once(Events.SPIN_ANIMATION_END, () => {
                    scene.slotMachine.showBonusWin(scene, bonusWin);
                });
            }
        } else {
            reduceBalance(scene);
        }

        const slot = scene.gameData.slot;
        const newRandomValues: number[][] = Array(Slot.ROWS).fill(null).map(() => Array(Slot.COLUMNS).fill(null));
        for (let i = 0; i < Slot.ROWS; i++) {
            newRandomValues[i] = getRandomRows();
        }
        for (let i = 0; i < Slot.ROWS; i++) {
            slot.setRows(newRandomValues[i], i);
        }
        // Place scatters after the grid is built
        slot.placeScatters(scene.gameData.minScatter, scene.gameData.maxScatter, scene.gameData.scatterChance);
        scene.gameData.minScatter = 0;

        // Add listener to reset isSpinning when animation ends
        Events.emitter.once(Events.SPIN_ANIMATION_END, () => {
            scene.gameData.isSpinning = false;
        });

        Events.emitter.emit(Events.SPIN_ANIMATION_START, {
            symbols: slot.values,
            currentRow: scene.gameData.currentRow,
            newRandomValues: newRandomValues
        });
    }

    private initEventListeners(scene: GameScene): void {
        this.spinEventListener = (data: SpinEventData) => {
            this.spin(scene, data);
        };

        Events.emitter.on(Events.SPIN, this.spinEventListener);

        this.changeLineListener = () => {
            this.initSpin();
        };
        Events.emitter.on(Events.CHANGE_LINE, this.changeLineListener);
    }

    private initSpin(): void {
        // Empty implementation
    }
}

export function isWinLineMatching(scene: GameScene, slotRowIndex: number): boolean {
    const slot = scene.gameData.slot;
    scene.gameData.currentMatchingSymbols = [];
    
    const lineToMatch = GameData.WIN_LINES[scene.gameData.line];
    if (!lineToMatch) return false;

    let symbolToDetect = -1;

    for (let col = 0; col < Slot.COLUMNS; col++) {
        for (let row = 0; row <= slotRowIndex; row++) {
            const selectedSymbol = slot.values[col][row];
            const isDetect = lineToMatch[col][row];

            if (isDetect === 0) {
                continue;
            }

            if (symbolToDetect === -1) {
                symbolToDetect = selectedSymbol;
            }

            if (symbolToDetect !== selectedSymbol) {
                return false;
            }

            scene.gameData.currentMatchingSymbols.push(selectedSymbol);
        }
    }

    return symbolToDetect !== -1 && scene.gameData.currentMatchingSymbols.length > 0;
}

export function getRandomRows(): number[] {
    const symbolPool: number[] = Array(Slot.SYMBOLS).fill(null);
    const poolSize = Slot.TOGGLE_DIFFICULTY ? Slot.DIFFICULTY_SYMBOLS : Slot.SYMBOLS;
    let poolIndex = 0;
    
    while (poolIndex < poolSize) {
        const symbol = Math.floor(Math.random() * Slot.SYMBOLS);
        if (!symbolPool.includes(symbol)) {
            symbolPool[poolIndex] = symbol;
            poolIndex++;
        }
    }

    const columns: number[] = Array(Slot.COLUMNS).fill(null);
    for (let col = 0; col < Slot.COLUMNS; col++) {
        const randomIndex = Math.floor(Math.random() * poolSize);
        columns[col] = symbolPool[randomIndex];
    }
    return columns;
}

function reduceBalance(scene: GameScene): void {
    if (scene.gameData.doubleChanceEnabled) {
        scene.gameData.balance -= scene.gameData.getDoubleFeaturePrice();
    } else {
        scene.gameData.balance -= scene.gameData.bet;
    }
} 