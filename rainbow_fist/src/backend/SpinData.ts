/**
 * SpinData interface representing the complete spin response from the server
 * This matches the JSON structure returned by the game API
 */

export interface SpinData {
  /** Bet amount for this spin */
  bet: string;
  
  /** Slot game data containing the grid and win information */
  slot: SlotData;
}

/**
 * Slot data containing the game grid and win information
 */
export interface SlotData {
  /** Grid of symbols (6 rows x 5 columns) */
  area: number[][];
  
  /** Total win for this spin */
  totalWin: number;

  /** Tumble data containing items and multiplier information */
  tumbles: TumblesData;
  
  /** Free spin information */
  freeSpin: FreeSpinData;
}

/**
 * Tumbles data structure
 */
export interface TumblesData {
  /** Array of tumble items */
  items: TumbleItem[];
  
  /** Multiplier information */
  multiplier: TumbleMultiplier;
}

/**
 * Tumble item containing symbol in/out information
 */
export interface TumbleItem {
  /** Symbol positions and win information */
  symbols: TumbleSymbols;
  
  /** Win amount for this tumble */
  win: number;
}

/**
 * Tumble symbols data
 */
export interface TumbleSymbols {
  /** Array of arrays representing symbols coming in per column */
  in: number[][];
  
  /** Array of symbols going out with win information */
  out: TumbleOutSymbol[];
}

/**
 * Tumble out symbol data
 */
export interface TumbleOutSymbol {
  /** Symbol identifier */
  symbol: number;
  
  /** Count of symbols */
  count: number;
  
  /** Win amount */
  win: number;
}

/**
 * Tumble multiplier data
 */
export interface TumbleMultiplier {
  /** Array of multiplier symbols */
  symbols: any[];
  
  /** Total multiplier value */
  total: number;
}

/**
 * Free spin bonus data
 */
export interface FreeSpinData {
  /** Multiplier value for free spins */
  multiplierValue: number;
  
  /** Array of individual free spin items */
  items: FreeSpinItem[];
}

/**
 * Individual free spin item data
 */
export interface FreeSpinItem {
  /** Number of spins remaining after this spin */
  spinsLeft: number;
  
  /** Current multiplier value */
  multiplier: number;
  
  /** Grid of symbols for this free spin (6 rows x 5 columns) */
  area: number[][];
  
  /** Total win for this specific free spin */
  totalWin: number;
  
  /** Tumble data for this free spin */
  tumble: FreeSpinTumble;
}

/**
 * Free spin tumble data
 */
export interface FreeSpinTumble {
  /** Array of tumble items */
  items: TumbleItem[];
  
  /** Multiplier value */
  multiplier: number;
}

/**
 * Utility functions for working with SpinData
 */
export class SpinDataUtils {
  /**
   * Multiplier symbol indices used by this game.
   * (Matches the multiplier index mapping used in `Symbols.ts`: 11..25)
   */
  static isMultiplierSymbolIndex(symbol: unknown): boolean {
    return typeof symbol === 'number' && Number.isFinite(symbol) && symbol >= 11 && symbol <= 25;
  }

  /**
   * Get tumble items from a spin payload.
   * Supports both base-game tumbles (`slot.tumbles`) and bonus/free-spin tumbles (`freespin.items[i].tumble`).
   *
   * The backend shape is handled defensively:
   * - container could be `{ items: [...] }`
   * - or directly an array `[...]`
   */
  static getTumbleItems(spinData: any, freeSpinIndex?: number): any[] {
    if (!spinData || !spinData.slot) return [];
    const slotAny = spinData.slot as any;

    const getContainerItems = (container: any): any[] => {
      if (!container) return [];
      if (Array.isArray(container?.items)) return container.items;
      if (Array.isArray(container)) return container;
      return [];
    };

    // Prefer explicit free-spin tumble when a freeSpinIndex is provided
    if (typeof freeSpinIndex === 'number' && freeSpinIndex >= 0) {
      const fs = slotAny.freespin || slotAny.freeSpin;
      const fsItem = fs?.items?.[freeSpinIndex];
      const fsTumble = fsItem?.tumble;
      const fsItems = getContainerItems(fsTumble);
      if (fsItems.length > 0) return fsItems;
    }

    // Base-game tumbles
    return getContainerItems(slotAny.tumbles);
  }

  /**
   * True if the spin has any symbol matches (either paylines, or tumble outs).
   */
  static hasAnyMatch(spinData: SpinData | any, freeSpinIndex?: number): boolean {
    if (!spinData) return false;

    // Tumble wins: any out entry with a positive count indicates a match occurred
    const tumbleItems = this.getTumbleItems(spinData, freeSpinIndex);
    for (const t of tumbleItems) {
      const outs = t?.symbols?.out;
      if (!Array.isArray(outs)) continue;
      for (const outEntry of outs) {
        const c = Number(outEntry?.count ?? 0);
        if (Number.isFinite(c) && c > 0) return true;
      }
    }

    return false;
  }

  /**
   * True if the spin/tumble chain contains any multiplier symbols (either via payline multipliers,
   * or present in the visible grid / tumble ins/outs).
   */
  static hasAnyMultiplierSymbol(spinData: SpinData | any, freeSpinIndex?: number): boolean {
    if (!spinData) return false;

    // 1) Payline multiplier metadata (if present)
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? ((spinData.slot as any).paylines as any[])
      : [];
    for (const payline of paylines) {
      const multipliers = Array.isArray(payline?.multipliers) ? payline.multipliers : [];
      for (const m of multipliers) {
        const cnt = Number(m?.count ?? 0);
        if (Number.isFinite(cnt) && cnt > 0 && this.isMultiplierSymbolIndex(m?.symbol)) {
          return true;
        }
      }
    }

    // Helper to scan a column-major numeric grid (area[col][row])
    const scanArea = (area: any): boolean => {
      if (!Array.isArray(area)) return false;
      for (const col of area) {
        if (!Array.isArray(col)) continue;
        for (const v of col) {
          if (this.isMultiplierSymbolIndex(v)) return true;
        }
      }
      return false;
    };

    // 2) Visible grid
    if (scanArea((spinData as any)?.slot?.area)) return true;

    // 3) Tumble ins/outs can introduce/remove multipliers
    const tumbleItems = this.getTumbleItems(spinData, freeSpinIndex);
    for (const t of tumbleItems) {
      // symbols.in is per-column arrays of new symbol indices
      const ins = t?.symbols?.in;
      if (Array.isArray(ins)) {
        for (const colArr of ins) {
          if (!Array.isArray(colArr)) continue;
          for (const v of colArr) {
            if (this.isMultiplierSymbolIndex(v)) return true;
          }
        }
      }
      const outs = t?.symbols?.out;
      if (Array.isArray(outs)) {
        for (const outEntry of outs) {
          if (this.isMultiplierSymbolIndex(outEntry?.symbol)) return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate total win amount from all paylines
   */
  static getTotalWin(spinData: SpinData): number {
    return spinData?.slot?.totalWin ?? 0;
  }
  
  /**
   * Get all unique symbols that have wins
   */
  static getWinningSymbols(spinData: SpinData): number[] {
    const winningSymbols = new Set<number>();
    const tumbles = spinData?.slot?.tumbles?.items ?? [];
    tumbles.forEach(tumble => {
      if (tumble?.symbols?.out) {
        tumble.symbols.out.forEach(out => {
          if (typeof out.symbol === 'number') winningSymbols.add(out.symbol);
        });
      }
    });
    return Array.from(winningSymbols);
  }
  
  /**
   * Get all unique multiplier symbols
   */
  static getMultiplierSymbols(spinData: SpinData): number[] {
    const multiplierSymbols = new Set<number>();
    const multipliers = spinData?.slot?.tumbles?.multiplier?.symbols ?? [];
    multipliers.forEach(symbol => {
      if (typeof symbol === 'number') multiplierSymbols.add(symbol);
    });
    return Array.from(multiplierSymbols);
  }
  
  /**
   * Check if this spin has any wins
   */
  static hasWin(spinData: SpinData): boolean {
    return spinData?.slot?.tumbles?.items?.length > 0;
  }
  
  /**
   * Check if this spin triggered free spins
   */
  static hasFreeSpins(spinData: SpinData): boolean {
    return spinData.slot.freeSpin?.items?.length > 0;
  }
  
  /**
   * Get total win amount from all free spins
   */
  static getFreeSpinTotalWin(spinData: SpinData): number {
    let totalWin = 0;
    for (const item of spinData.slot.freeSpin.items) {
      totalWin += item.totalWin;
    }
    return totalWin;
  }
  
  /**
   * Get the number of free spins remaining
   */
  static getFreeSpinCount(spinData: SpinData): number {
    return spinData.slot.freeSpin?.items?.length || 0;
  }
  
  /**
   * Get all free spin items
   */
  static getFreeSpinItems(spinData: SpinData): FreeSpinItem[] {
    return spinData?.slot?.freeSpin?.items ?? [];
  }
  
  /**
   * Get a specific free spin item by index
   */
  static getFreeSpinItem(spinData: SpinData, index: number): FreeSpinItem | null {
    const items = spinData?.slot?.freeSpin?.items ?? [];
    return (index >= 0 && index < items.length) ? items[index] : null;
  }
  
  /**
   * Get the symbol at a specific grid position in a free spin item
   */
  static getFreeSpinSymbolAt(spinData: SpinData, freespinIndex: number, column: number, row: number): number | null {
    const freeSpinItem = this.getFreeSpinItem(spinData, freespinIndex);
    if (!freeSpinItem) return null;
    
    if (column >= 0 && column < freeSpinItem.area.length && 
        row >= 0 && row < freeSpinItem.area[column].length) {
      return freeSpinItem.area[column][row];
    }
    return null;
  }
  
  /**
   * Check if a specific free spin item has any wins
   */
  static hasFreeSpinWins(spinData: SpinData, freespinIndex: number): boolean {
    return false;
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
   * Calculate win multiplier (total win / bet)
   */
  static getWinMultiplier(spinData: SpinData): number {
    const betAmount = parseFloat(spinData.bet);
    if (betAmount === 0) return 0;
    return this.getTotalWin(spinData) / betAmount;
  }

  static getTotalWinFromFreeSpin(spinData: any): number {
    const freespin = spinData.slot.freespin || spinData.slot.freeSpin;
    if (!freespin || !Array.isArray(freespin.items)) return 0;
    return freespin.items.reduce((sum: number, item: any) => sum + (item?.totalWin || 0), 0);
  }

  static getScatterSpinWins(spinData: any): number {
    const totalWin = spinData?.slot?.totalWin ?? 0;
    const freeSpinWin = this.getTotalWinFromFreeSpin(spinData);
    console.log(`[SpinDataUtils] Scatter spin wins: ${totalWin} - ${freeSpinWin} = ${totalWin - freeSpinWin}`);
    return totalWin - freeSpinWin;
  }

  static getBonusSpinWins(spinData: SpinData, freeSpinIndex: number): number {
    return (spinData as any)?.slot?.freeSpin?.items?.[freeSpinIndex]?.totalWin ?? 0;
  }
}
