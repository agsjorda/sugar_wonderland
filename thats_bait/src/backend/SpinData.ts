export interface SpinData {
  playerId: string;
  
  bet: string;
  baseBet?: string;
  
  slot: SlotData;
}

export interface SlotSpecialData {
  action: string;
  position?: {
    x: number;
    y: number;
  };

	items?: number[][];
}

export interface SlotData {
  area: number[][];
  
  paylines: PaylineData[];
  
  freespin: FreespinData;
  
  freeSpin?: FreespinData;

  money?: number[][];

  totalWin?: number;

  special?: SlotSpecialData;
}

export interface PaylineData {
  lineKey: number;
  
  symbol: number;
  
  count: number;
  
  win: number;

  positions?: Array<{ x: number; y: number }>;
  
  multipliers?: MultiplierData[];
}

export interface MultiplierData {
  symbol: number;
  
  count: number;
}

export interface FreespinData {
  count: number;
  
  totalWin: number;
  
  items: FreespinItem[];
}

export interface FreespinItem {
  spinsLeft: number;
  
  subTotalWin: number;

  runningWin?: number;

  collectorCount?: number;
  
  area: number[][];
  
  money?: number[][];
  
  payline: PaylineData[];

	special?: SlotSpecialData;
}

export class SpinDataUtils {
  static getTotalWin(spinData: SpinData): number {
    return spinData.slot.paylines.reduce((total, payline) => total + payline.win, 0);
  }
  
  static getWinningSymbols(spinData: SpinData): number[] {
    const winningSymbols = new Set<number>();
    spinData.slot.paylines.forEach(payline => {
      winningSymbols.add(payline.symbol);
    });
    return Array.from(winningSymbols);
  }
  
  static getMultiplierSymbols(spinData: SpinData): number[] {
    const multiplierSymbols = new Set<number>();
    spinData.slot.paylines.forEach(payline => {
      const multipliers = payline.multipliers || [];
      multipliers.forEach(multiplier => {
        multiplierSymbols.add(multiplier.symbol);
      });
    });
    return Array.from(multiplierSymbols);
  }
  
  static hasWins(spinData: SpinData): boolean {
    return spinData.slot.paylines.length > 0;
  }
  
  static hasFreeSpins(spinData: SpinData): boolean {
    return spinData.slot.freespin?.count > 0;
  }
  
  static getFreespinTotalWin(spinData: SpinData): number {
    return spinData.slot.freespin?.totalWin || 0;
  }
  
  static getFreespinCount(spinData: SpinData): number {
    return spinData.slot.freespin?.count || 0;
  }
  
  static getFreespinItems(spinData: SpinData): FreespinItem[] {
    return spinData.slot.freespin?.items || [];
  }
  
  static getFreespinItem(spinData: SpinData, index: number): FreespinItem | null {
    const items = spinData.slot.freespin?.items || [];
    return (index >= 0 && index < items.length) ? items[index] : null;
  }
  
  static getFreespinSymbolAt(spinData: SpinData, freespinIndex: number, column: number, row: number): number | null {
    const freespinItem = this.getFreespinItem(spinData, freespinIndex);
    if (!freespinItem) return null;
    
    if (column >= 0 && column < freespinItem.area.length && 
        row >= 0 && row < freespinItem.area[column].length) {
      return freespinItem.area[column][row];
    }
    return null;
  }
  
  static getFreespinPaylines(spinData: SpinData, freespinIndex: number): PaylineData[] {
    const freespinItem = this.getFreespinItem(spinData, freespinIndex);
    return freespinItem ? freespinItem.payline : [];
  }
  
  static hasFreespinWins(spinData: SpinData, freespinIndex: number): boolean {
    const paylines = this.getFreespinPaylines(spinData, freespinIndex);
    return paylines.length > 0;
  }
  
  static getSymbolAt(spinData: SpinData, column: number, row: number): number | null {
    if (column >= 0 && column < spinData.slot.area.length && 
        row >= 0 && row < spinData.slot.area[column].length) {
      return spinData.slot.area[column][row];
    }
    return null;
  }
  
  static getSymbolPositions(spinData: SpinData, symbol: number): Array<{column: number, row: number}> {
    const positions: Array<{column: number, row: number}> = [];
    
    for (let col = 0; col < spinData.slot.area.length; col++) {
      for (let row = 0; row < spinData.slot.area[col].length; row++) {
        if (spinData.slot.area[col][row] === symbol) {
          positions.push({ column: col, row: row });
        }
      }
    }
    
    return positions;
  }
  
  static getPaylinesForSymbol(spinData: SpinData, symbol: number): PaylineData[] {
    return spinData.slot.paylines.filter(payline => payline.symbol === symbol);
  }
  
  static getWinMultiplier(spinData: SpinData): number {
    const betAmount = parseFloat(spinData.bet);
    if (betAmount === 0) return 0;
    return this.getTotalWin(spinData) / betAmount;
  }
}
