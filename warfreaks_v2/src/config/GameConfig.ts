/**
 * Game Configuration Constants
 * Centralized configuration for the slot game
 */

// Grid Configuration
export const SLOT_COLUMNS: number = 5; // vertical rows
export const SLOT_ROWS: number = 6; // horizontal columns

// Symbol Configuration
export const SCATTER_SYMBOL: number[] = [0]; // Renamed from SCATTER_SYMBOL
export const NORMAL_SYMBOLS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const WILDCARD_SYMBOLS: number[] = [10]; // 10 = x2
export const ALL_SYMBOLS: number[] = [...SCATTER_SYMBOL, ...NORMAL_SYMBOLS, ...WILDCARD_SYMBOLS];
export const SCATTER_MULTIPLIERS: number[] = [9, 11, 13, 15, 17, 19, 21, 23, 25, 27];

// Timing Configuration
export const DELAY_BETWEEN_SPINS: number = 2000;
// Ratio for time between column starts relative to DELAY_BETWEEN_SPINS
export const DROP_REEL_START_INTERVAL_RATIO: number = 0;
// Delay before starting autoplay for free spins
export const AUTO_SPIN_START_DELAY: number = 1000;
export const AUTO_SPIN_WIN_DIALOG_TIMEOUT: number = 2500;
// Delay before showing tiered win dialogs while in bonus mode (ms)
export const BONUS_WIN_DIALOG_DELAY_MS: number = 1500;

/**
 * Internal "demo mode" toggle.
 * When enabled, the game can run even if there is no API token (no token popups, no hard failures).
 *
 * Flip this to `false` to restore normal token-required API behavior.
 */
export const DEMO_ALLOW_NO_TOKEN: boolean = true;

/**
 * API-driven popups (token expired, out-of-balance, etc).
 * Kept as a derived flag so existing call sites can stay simple.
 */
export const ENABLE_API_POPUPS: boolean = !DEMO_ALLOW_NO_TOKEN;

export const MULTIPLIER_VALUE_REFERENCE: { [key: number]: number } = {
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 6,
  15: 8,
  16: 10,
  17: 12,
  18: 15,
  19: 20,
  20: 25,
  21: 50,
  22: 100,
  23: 250,
  24: 500,
};

export const SCATTER_VALUE_MAPPING: { [key: number]: number } = {
  4: 3,
  5: 5,
  6: 100,
};
