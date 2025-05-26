export class GameData {
    static readonly WIN_LINES: number[][][] = []; // This needs to be populated with actual win lines

    currency: string = '$';
    slot: Slot = new Slot();
    line: number = 0;
    currentRow: number = 0;
    bet: number = 1;
    maxBet: number = 100;
    minBet: number = 1;

    balance: number = 18000;
    totalWin: number = 0;
    totalBonusWin: number = 0; // Track bonus round wins separately
    doubleChanceEnabled: boolean = false;
    isSpinning: boolean = false;
    turbo: boolean = false;
    isBonusRound: boolean = false;

    scatterCount: number = 0;
    scatterChance: number = 0.025;
    maxScatter: number = 6;
    minScatter: number = 0;

    defaultMinScatter: number = 0;

    currentMatchingSymbols: number[] = [];
    doubleChanceMultiplier: number = 2;
    
    freeSpins: number = 0;

    getDoubleFeaturePrice(): number {
        const doubleMultiplier = 1.25; // temporary multiplier
        return Math.round(this.bet * doubleMultiplier * 100) / 100;
    }

    getBuyFeaturePrice(): number {
        const featureMultiplier = 100; // temporary multiplier
        return Math.round(this.bet * featureMultiplier * 100) / 100;
    }
}

export class Slot {
    static readonly TOGGLE_DIFFICULTY: boolean = true;
    static readonly TOGGLE_WIN_EFFECT: boolean = false;

    static readonly DIFFICULTY_SYMBOLS: number = 4;
    static readonly SYMBOLS: number = 9;
    static readonly ROWS: number = 5;
    static readonly COLUMNS: number = 6;
    static readonly SCATTER_SYMBOL: number = 99;

    values: number[][] = [];
    scatterCount: number = 0;

    constructor() {
        // 5 x 6
        for (let x = 0; x < Slot.ROWS; x++) {
            const cols: number[] = [];
            for (let y = 0; y < Slot.COLUMNS; y++) {
                const symbolIndex = Math.floor(Math.random() * Slot.SYMBOLS);
                cols.push(symbolIndex);
            }
            this.values.push(cols);
        }
    }

    setRows(rowValues: number[], index: number): void {
        for (let y = 0; y < Slot.COLUMNS; y++) {
            this.values[index][y] = rowValues[y];
        }
    }

    placeScatters(minScatter: number = 0, maxScatter: number, scatterChance: number): void {
        this.scatterCount = 0; // Reset before placing
        
        // Flatten all cell positions
        interface Cell {
            row: number;
            col: number;
        }

        const allCells: Cell[] = [];
        for (let r = 0; r < Slot.ROWS; r++) {
            for (let c = 0; c < Slot.COLUMNS; c++) {
                allCells.push({ row: r, col: c });
            }
        }

        // Shuffle
        for (let i = allCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
        }

        // Place scatters
        for (let i = 0; i < allCells.length && this.scatterCount < maxScatter; i++) {
            if (this.scatterCount < minScatter) {
                const { row, col } = allCells[i];
                this.values[row][col] = Slot.SCATTER_SYMBOL;
                this.scatterCount++;
            } else {
                if (Math.random() < scatterChance) {
                    const { row, col } = allCells[i];
                    this.values[row][col] = Slot.SCATTER_SYMBOL;
                    this.scatterCount++;
                }
            }
        }
    }
} 