/**
 * SpinData interface representing the complete spin response from the server
 * This matches the JSON structure returned by the game API
 */

export interface SpinData {
  /** Player ID for the current session */
  playerId?: string;
  
  /** Bet amount for this spin */
  bet: string;
  
  /** Slot game data containing the grid and win information */
  slot: SlotData;
}

/**
 * Slot data containing the game grid and win information
 */
export interface SlotData {
  /**
   * Grid of symbols (column-major): `area[col][row]`.
   *
   * For this game, columns can be different heights (e.g. 3-4-5-5-4-3).
   * Symbols are typically encoded bottom->top within each column.
   */
  area: number[][];

  /**
   * Optional marker matrix (backend-defined).
   * Example from sample: `markers: number[][]`
   */
  markers?: number[][];
  
  /** Array of winning paylines */
  paylines?: PaylineData[];

  /**
   * Optional tumble steps for cluster wins (array of steps with in/out and win)
   * Matches sample shape: `tumbles[*].symbols.in/out` and `tumbles[*].win`
   */
  tumbles?: TumbleStep[];

  /** Optional total win amount for this spin (some backends provide this directly) */
  totalWin?: number;
  
  /** Free spin information (lowercase - matches TypeScript interface) */
  freespin?: FreespinData;
  
  /** Free spin information (camelCase - matches API response) */
  freeSpin?: FreespinData;
}

/**
 * Tumble (cluster) win step data
 */
export interface TumbleStep {
  symbols: TumbleSymbolsDelta;
  win: number;
}

export interface TumbleSymbolsDelta {
  /**
   * Symbols coming into the grid during this tumble step (column-major).
   * Backend-specific encoding; commonly IDs of symbols dropping in.
   */
  in: number[][];
  /**
   * Symbol win summaries removed in this step.
   */
  out: TumbleWinSummary[];
}

export interface TumbleWinSummary {
  symbol: number;
  count: number;
  /** "Ways" (optional) - present in the sample JSON */
  ways?: number;
  win: number;
}

/**
 * Individual payline win data
 */
export interface PaylineData {
  /** Payline identifier (line number) */
  lineKey: number;
  
  /** Symbol that created the win */
  symbol: number;
  
  /** Number of matching symbols in the payline */
  count: number;
  
  /** Win amount for this payline */
  win: number;
  
  /** Multiplier symbols that affect this payline */
  multipliers: MultiplierData[];
}

/**
 * Multiplier symbol data
 */
export interface MultiplierData {
  /** Symbol type that acts as multiplier */
  symbol: number;
  
  /** Number of multiplier symbols */
  count: number;
}

/**
 * Free spin bonus data
 */
export interface FreespinData {
  /** Number of free spins awarded */
  count: number;
  
  /** Total win amount from free spins */
  totalWin: number;
  
  /** Array of individual free spin items */
  items: FreespinItem[];
}

/**
 * Individual free spin item data
 */
export interface FreespinItem {
  /** Number of spins remaining after this spin */
  spinsLeft: number;
  
  /** Backend-reported total win for this specific free spin (may include paylines + tumbles) */
  totalWin?: number;
  
  /** Win amount for this specific free spin */
  subTotalWin: number;
  
  /** 3x5 grid of symbols for this free spin (columns x rows) */
  area: number[][];
  
  /** Array of winning paylines for this free spin */
  payline: PaylineData[];
}

/**
 * Utility functions for working with SpinData
 */
export class SpinDataUtils {
  /**
   * Calculate total win amount from all paylines
   */
  static getTotalWin(spinData: SpinData): number {
    // Prefer explicit totalWin if backend provides it
    const slotAny: any = spinData?.slot as any;
    if (slotAny && typeof slotAny.totalWin === 'number') return slotAny.totalWin;

    // Tumble-based (cluster) games: sum step.win (or out[*].win if needed)
    const tumbles = (slotAny && Array.isArray(slotAny.tumbles)) ? slotAny.tumbles as TumbleStep[] : [];
    if (tumbles.length > 0) {
      const byStep = tumbles.reduce((total, step) => total + (Number(step?.win) || 0), 0);
      if (byStep > 0) return byStep;
      // Fallback: sum out[*].win
      return tumbles.reduce((total, step) => {
        const out = (step && step.symbols && Array.isArray((step.symbols as any).out))
          ? (step.symbols as any).out as TumbleWinSummary[]
          : [];
        return total + out.reduce((t2, w) => t2 + (Number(w?.win) || 0), 0);
      }, 0);
    }

    // Payline-based fallback
    const paylines = (slotAny && Array.isArray(slotAny.paylines)) ? slotAny.paylines as PaylineData[] : [];
    return paylines.reduce((total, payline) => total + (Number(payline?.win) || 0), 0);
  }
  
  /**
   * Get all unique symbols that have wins
   */
  static getWinningSymbols(spinData: SpinData): number[] {
    const winningSymbols = new Set<number>();
    const slotAny: any = spinData?.slot as any;

    const tumbles = (slotAny && Array.isArray(slotAny.tumbles)) ? slotAny.tumbles as TumbleStep[] : [];
    if (tumbles.length > 0) {
      tumbles.forEach(step => {
        const out = (step && step.symbols && Array.isArray((step.symbols as any).out))
          ? (step.symbols as any).out as TumbleWinSummary[]
          : [];
        out.forEach(w => {
          if (w && typeof w.symbol === 'number') winningSymbols.add(w.symbol);
        });
      });
    } else {
      const paylines = (slotAny && Array.isArray(slotAny.paylines)) ? slotAny.paylines as PaylineData[] : [];
      paylines.forEach(payline => {
        if (payline && typeof payline.symbol === 'number') winningSymbols.add(payline.symbol);
      });
    }
    return Array.from(winningSymbols);
  }
  
  /**
   * Get all unique multiplier symbols
   */
  static getMultiplierSymbols(spinData: SpinData): number[] {
    const multiplierSymbols = new Set<number>();
    const slotAny: any = spinData?.slot as any;
    const paylines = (slotAny && Array.isArray(slotAny.paylines)) ? slotAny.paylines as PaylineData[] : [];
    paylines.forEach(payline => {
      const multipliers = (payline && Array.isArray((payline as any).multipliers))
        ? (payline as any).multipliers as MultiplierData[]
        : [];
      multipliers.forEach(multiplier => {
        if (multiplier && typeof multiplier.symbol === 'number') {
          multiplierSymbols.add(multiplier.symbol);
        }
      });
    });
    return Array.from(multiplierSymbols);
  }
  
  /**
   * Check if this spin has any wins
   */
  static hasWins(spinData: SpinData): boolean {
    const slotAny: any = spinData?.slot as any;
    const tumbles = (slotAny && Array.isArray(slotAny.tumbles)) ? slotAny.tumbles as TumbleStep[] : [];
    if (tumbles.length > 0) return true;
    const paylines = (slotAny && Array.isArray(slotAny.paylines)) ? slotAny.paylines as PaylineData[] : [];
    return paylines.length > 0;
  }
  
  /**
   * Check if this spin triggered free spins
   */
  static hasFreeSpins(spinData: SpinData): boolean {
    const fs = (spinData?.slot as any)?.freespin || (spinData?.slot as any)?.freeSpin;
    return (Number(fs?.count) || 0) > 0;
  }
  
  /**
   * Get total win amount from all free spins
   */
  static getFreespinTotalWin(spinData: SpinData): number {
    const fs = (spinData?.slot as any)?.freespin || (spinData?.slot as any)?.freeSpin;
    return Number(fs?.totalWin) || 0;
  }
  
  /**
   * Get the number of free spins remaining
   */
  static getFreespinCount(spinData: SpinData): number {
    const fs = (spinData?.slot as any)?.freespin || (spinData?.slot as any)?.freeSpin;
    return Number(fs?.count) || 0;
  }
  
  /**
   * Get all free spin items
   */
  static getFreespinItems(spinData: SpinData): FreespinItem[] {
    const fs = (spinData?.slot as any)?.freespin || (spinData?.slot as any)?.freeSpin;
    return (fs && Array.isArray(fs.items)) ? (fs.items as FreespinItem[]) : [];
  }
  
  /**
   * Get a specific free spin item by index
   */
  static getFreespinItem(spinData: SpinData, index: number): FreespinItem | null {
    const items = this.getFreespinItems(spinData);
    return (index >= 0 && index < items.length) ? items[index] : null;
  }
  
  /**
   * Get the symbol at a specific grid position in a free spin item
   */
  static getFreespinSymbolAt(spinData: SpinData, freespinIndex: number, column: number, row: number): number | null {
    const freespinItem = this.getFreespinItem(spinData, freespinIndex);
    if (!freespinItem) return null;
    
    if (column >= 0 && column < freespinItem.area.length && 
        row >= 0 && row < freespinItem.area[column].length) {
      return freespinItem.area[column][row];
    }
    return null;
  }
  
  /**
   * Get all winning paylines for a specific free spin item
   */
  static getFreespinPaylines(spinData: SpinData, freespinIndex: number): PaylineData[] {
    const freespinItem = this.getFreespinItem(spinData, freespinIndex);
    return freespinItem ? freespinItem.payline : [];
  }
  
  /**
   * Check if a specific free spin item has any wins
   */
  static hasFreespinWins(spinData: SpinData, freespinIndex: number): boolean {
    const paylines = this.getFreespinPaylines(spinData, freespinIndex);
    return paylines.length > 0;
  }
  
  /**
   * Get the symbol at a specific grid position
   */
  static getSymbolAt(spinData: SpinData, column: number, row: number): number | null {
    if (column >= 0 && column < spinData.slot.area.length && 
        row >= 0 && row < spinData.slot.area[column].length) {
      return spinData.slot.area[column][row];
    }
    return null;
  }
  
  /**
   * Get all positions of a specific symbol in the grid
   */
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
  
  /**
   * Get paylines for a specific symbol
   */
  static getPaylinesForSymbol(spinData: SpinData, symbol: number): PaylineData[] {
    const slotAny: any = spinData?.slot as any;
    const paylines = (slotAny && Array.isArray(slotAny.paylines)) ? slotAny.paylines as PaylineData[] : [];
    return paylines.filter(payline => payline && payline.symbol === symbol);
  }
  
  /**
   * Calculate win multiplier (total win / bet)
   */
  static getWinMultiplier(spinData: SpinData): number {
    const betAmount = parseFloat(spinData.bet);
    if (betAmount === 0) return 0;
    return this.getTotalWin(spinData) / betAmount;
  }
}
