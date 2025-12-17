/**
 * SpinData interface representing the complete spin response from the server
 * This matches the JSON structure returned by the game API
 */

export interface SpinData {
  /** Player ID for the current session */
  playerId: string;
  
  /** Bet amount for this spin */
  bet: string;
  
  /** Slot game data containing the grid and win information */
  slot: SlotData;
}

/**
 * Slot data containing the game grid and win information
 */
export interface SlotData {
  /** 3x5 grid of symbols (columns x rows) */
  area: number[][];
  
  /** Array of winning paylines */
  paylines: PaylineData[];

  /** Total win for this spin (base + bonus) */
  totalWin?: number;

  /** Optional tumble steps for cluster wins (array of steps with in/out and win) */
  tumbles?: any[];
  
  /** Free spin information (lowercase - matches TypeScript interface) */
  freespin: FreespinData;
  
  /** Free spin information (camelCase - matches API response) */
  freeSpin?: FreespinData;
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
  
  /** Win amount for this specific free spin */
  subTotalWin: number;
  
  /** Total win for this specific free spin (when provided) */
  totalWin?: number;
  
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

    // Base wins from paylines
    const hasPaylines = this.hasWins(spinData as SpinData);
    if (hasPaylines) return true;

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
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? (spinData.slot as any).paylines as PaylineData[]
      : [];
    return paylines.reduce((total, payline) => total + (payline?.win || 0), 0);
  }

  /**
   * Get the effective total win for a spin.
   *
   * Priority:
   * 1) If a `totalWin` field exists (on the spin, slot, or freespin), use it.
   * 2) Otherwise, if free spins exist, sum all wins from their items.
   * 3) Fallback to summing base-game paylines.
   */
  static getAggregateTotalWin(spinData: SpinData): number {
    if (!spinData || !spinData.slot) {
      return 0;
    }

    const slotAny = spinData.slot as any;

    // 1) Direct totalWin fields (handle different API shapes defensively)
    const directTotalWin =
      (typeof (spinData as any).totalWin === 'number' ? (spinData as any).totalWin : undefined) ??
      (typeof slotAny.totalWin === 'number' ? slotAny.totalWin : undefined) ??
      (typeof slotAny.freespin?.totalWin === 'number' ? slotAny.freespin.totalWin : undefined) ??
      (typeof slotAny.freeSpin?.totalWin === 'number' ? slotAny.freeSpin.totalWin : undefined);

    if (typeof directTotalWin === 'number') {
      return directTotalWin;
    }

    // 2) Sum all free spin items if available
    const freespin = slotAny.freespin || slotAny.freeSpin;
    if (freespin && Array.isArray(freespin.items) && freespin.items.length > 0) {
      const sumFs = freespin.items.reduce((sum: number, item: any) => {
        const itemWin =
          typeof item?.totalWin === 'number'
            ? item.totalWin
            : typeof item?.subTotalWin === 'number'
            ? item.subTotalWin
            : 0;
        return sum + itemWin;
      }, 0);

      if (sumFs > 0) {
        return sumFs;
      }
    }

    // 3) Fallback: base-game paylines
    return this.getTotalWin(spinData);
  }
  
  /**
   * Get all unique symbols that have wins
   */
  static getWinningSymbols(spinData: SpinData): number[] {
    const winningSymbols = new Set<number>();
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? (spinData.slot as any).paylines as PaylineData[]
      : [];
    paylines.forEach(payline => {
      if (payline && typeof payline.symbol === 'number') winningSymbols.add(payline.symbol);
    });
    return Array.from(winningSymbols);
  }
  
  /**
   * Get all unique multiplier symbols
   */
  static getMultiplierSymbols(spinData: SpinData): number[] {
    const multiplierSymbols = new Set<number>();
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? (spinData.slot as any).paylines as PaylineData[]
      : [];
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
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? (spinData.slot as any).paylines as PaylineData[]
      : [];
    return paylines.length > 0;
  }
  
  /**
   * Check if this spin triggered free spins
   */
  static hasFreeSpins(spinData: SpinData): boolean {
    return spinData.slot.freespin?.count > 0;
  }
  
  /**
   * Get total win amount from all free spins
   */
  static getFreespinTotalWin(spinData: SpinData): number {
    return spinData.slot.freespin?.totalWin || 0;
  }
  
  /**
   * Get the number of free spins remaining
   */
  static getFreespinCount(spinData: SpinData): number {
    return spinData.slot.freespin?.count || 0;
  }
  
  /**
   * Get all free spin items
   */
  static getFreespinItems(spinData: SpinData): FreespinItem[] {
    return spinData.slot.freespin?.items || [];
  }
  
  /**
   * Get a specific free spin item by index
   */
  static getFreespinItem(spinData: SpinData, index: number): FreespinItem | null {
    const items = spinData.slot.freespin?.items || [];
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
    const paylines = (spinData && spinData.slot && Array.isArray((spinData.slot as any).paylines))
      ? (spinData.slot as any).paylines as PaylineData[]
      : [];
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

  static getBonusSpinWins(spinData: any, freeSpinIndex: number): number {
    const freeSpinWin = spinData?.slot?.freespin?.items?.[freeSpinIndex]?.totalWin ?? 0;
    return freeSpinWin;
  }
}
