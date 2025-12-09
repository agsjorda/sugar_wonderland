/**
 * Game Configuration Constants
 * Centralized configuration for the slot game
 */

// Grid Configuration
export const SLOT_COLUMNS: number = 3;
export const SLOT_ROWS: number = 5;

// Symbol Configuration
export const SCATTER_SYMBOL: number[] = [0]; // Renamed from SCATTER_SYMBOL
export const NORMAL_SYMBOLS: number[] = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
export const MULTIPLIER_SYMBOLS: number[] = [5, 12, 13, 14]; 
export const ALL_SYMBOLS: number[] = [...SCATTER_SYMBOL, ...NORMAL_SYMBOLS, ...MULTIPLIER_SYMBOLS];
export const SCATTER_MULTIPLIERS: number[] = [9, 11, 13, 15, 17, 19, 21, 23, 25, 27];

// Timing Configuration
export const DELAY_BETWEEN_SPINS: number = 2500;

// Winline Configuration
export const WINLINES: number[][][] = [
  [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
  ],
  [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
  ],
  [
    [0, 0, 0, 1, 1],
    [0, 0, 1, 0, 0],
    [1, 1, 0, 0, 0],
  ],
  [
    [1, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 1],
  ],
  [
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
  ],
];
