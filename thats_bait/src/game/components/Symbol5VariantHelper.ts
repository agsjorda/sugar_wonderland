import { SLOT_COLUMNS, SLOT_ROWS } from '../../config/GameConfig';
import type { SpinData } from '../../backend/SpinData';

// Logical variants for the money symbol 5 now map to the new Spine assets:
// Symbol5_TB (1x), Symbol12_TB (2x), Symbol13_TB (3x), Symbol14_TB (4x).
export type Symbol5VariantId = 'Symbol5_TB' | 'Symbol12_TB' | 'Symbol13_TB' | 'Symbol14_TB';

// Map money/bet multipliers to visual variants. The exact mapping can be
// tuned but the important part is that each bucket resolves to one of the
// four visual variants above.
const multiplierToVariant: Record<number, Symbol5VariantId> = {
  2: 'Symbol5_TB',
  5: 'Symbol5_TB',
  10: 'Symbol12_TB',
  15: 'Symbol12_TB',
  20: 'Symbol13_TB',
  25: 'Symbol13_TB',
  50: 'Symbol14_TB',
  2000: 'Symbol14_TB',
};

const allSymbol5Variants: Symbol5VariantId[] = [
  'Symbol5_TB',
  'Symbol12_TB',
  'Symbol13_TB',
  'Symbol14_TB',
];

export function getDefaultSymbol5Variant(): Symbol5VariantId {
  return 'Symbol5_TB';
}

export function getRandomSymbol5Variant(): Symbol5VariantId {
  const index = Math.floor(Math.random() * allSymbol5Variants.length);
  return allSymbol5Variants[index];
}

function normalizeMoneyGrid(rawMoney: any): number[][] {
  if (!Array.isArray(rawMoney) || !Array.isArray(rawMoney[0])) {
    return [];
  }

  const outer = rawMoney.length;
  const inner = Array.isArray(rawMoney[0]) ? rawMoney[0].length : 0;

  if (outer === SLOT_COLUMNS && inner === SLOT_ROWS) {
    return rawMoney;
  }

  if (outer === SLOT_ROWS && inner === SLOT_COLUMNS) {
    const transposed: number[][] = [];
    for (let c = 0; c < SLOT_COLUMNS; c++) {
      transposed[c] = [];
      for (let r = 0; r < SLOT_ROWS; r++) {
        transposed[c][r] = rawMoney[r][c];
      }
    }
    return transposed;
  }

  return rawMoney;
}

export function getSymbol5VariantForCell(
  spinData: SpinData | null | undefined,
  column: number,
  row: number
): Symbol5VariantId | null {
  try {
    if (!spinData || !spinData.slot || !Array.isArray(spinData.slot.area)) {
      return null;
    }

    const area = spinData.slot.area;
    if (!Array.isArray(area[column]) || area[column][row] !== 5) {
      return null;
    }

    const rawMoney = spinData.slot.money;
    if (!Array.isArray(rawMoney)) {
      return null;
    }

    const money = normalizeMoneyGrid(rawMoney);
    const value = money?.[column]?.[row] ?? 0;
    const betStr = (spinData as any).baseBet ?? spinData.bet;
    const bet = parseFloat(betStr);

    if (!bet || value <= 0) {
      return null;
    }

    const multiplier = value / bet;
    const variant = multiplierToVariant[multiplier];
    return variant ?? null;
  } catch {
    return null;
  }
}

export function getSymbol5SpineKeyForVariant(variant: Symbol5VariantId): { spineKey: string; atlasKey: string } {
  // Extract the numeric part from the variant name: Symbol5_TB, Symbol12_TB, ...
  const match = variant.match(/Symbol(\d+)_TB/);
  const id = match ? parseInt(match[1], 10) : 5;
  const spineKey = `symbol_${id}_spine`;
  return { spineKey, atlasKey: `${spineKey}-atlas` };
}

export function getSymbol5ImageKeyForVariant(variant: Symbol5VariantId): string {
  const match = variant.match(/Symbol(\d+)_TB/);
  const id = match ? parseInt(match[1], 10) : 5;
  return `symbol_${id}`;
}

export function getSymbol5ImageKeyForCell(
  spinData: SpinData | null | undefined,
  column: number,
  row: number
): string | null {
  const variant = getSymbol5VariantForCell(spinData, column, row);
  if (!variant) {
    return null;
  }
  return getSymbol5ImageKeyForVariant(variant);
}

export function getMoneyValueForCell(
	spinData: SpinData | null | undefined,
	column: number,
	row: number
): number | null {
	try {
		if (!spinData || !spinData.slot || !Array.isArray(spinData.slot.area)) {
			return null;
		}

		const area = spinData.slot.area;
		const symbol = area?.[column]?.[row];
		if (symbol !== 5 && symbol !== 12 && symbol !== 13 && symbol !== 14) {
			return null;
		}

		const rawMoney = spinData.slot.money;
		if (!Array.isArray(rawMoney)) {
			return null;
		}

		const money = normalizeMoneyGrid(rawMoney);
		const value = money?.[column]?.[row];
		if (typeof value !== 'number' || value < 0) {
			return null;
		}

		return value;
	} catch {
		return null;
	}
}

export function getMoneyMultiplierForCell(
	spinData: SpinData | null | undefined,
	column: number,
	row: number
): number | null {
	try {
		const value = getMoneyValueForCell(spinData, column, row);
		if (value == null) {
			return null;
		}

		const betStr = (spinData as any).baseBet ?? spinData!.bet;
		const bet = parseFloat(betStr);
		if (!bet) {
			return null;
		}

		return value / bet;
	} catch {
		return null;
	}
}
