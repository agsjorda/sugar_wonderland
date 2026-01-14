import { Symbols } from './Symbols';

/**
 * Handle visual highlight for hook-scatter special from SpinData.
 * This is separated from Symbols.ts to keep the main component lean.
 */
export function handleHookScatterHighlight(self: Symbols, spinData: any): void {
  try {
    const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
    if (!special || special.action !== 'hook-scatter' || !special.position) {
      return;
    }

    console.log('[HookScatterHighlighter] Hook-scatter special detected at position:', special.position);

    let col = typeof special.position.x === 'number' ? special.position.x : -1;
    let row = typeof special.position.y === 'number' ? special.position.y : -1;

    const cols = self.symbols ? self.symbols.length : 0;
    const rows = (self.symbols && self.symbols[0]) ? self.symbols[0].length : 0;
    const isInBounds = (c: number, r: number): boolean => {
      if (c < 0 || r < 0) return false;
      if (!self.symbols) return false;
      if (c >= self.symbols.length) return false;
      const column = self.symbols[c];
      if (!column) return false;
      if (r >= column.length) return false;
      return true;
    };

    if (!isInBounds(col, row) && cols > 0 && rows > 0) {
      const candidates: Array<{ c: number; r: number }> = [
        { c: col, r: row },
        { c: row, r: col },
        { c: col - 1, r: row - 1 },
        { c: row - 1, r: col - 1 },
        { c: col - 1, r: row },
        { c: col, r: row - 1 },
        { c: row - 1, r: col },
        { c: row, r: col - 1 },
      ];
      for (const cand of candidates) {
        if (isInBounds(cand.c, cand.r)) {
          col = cand.c;
          row = cand.r;
          break;
        }
      }
    }

    if (!isInBounds(col, row)) {
      console.warn('[HookScatterHighlighter] Hook-scatter position out of bounds for current grid:', {
        col,
        row,
        cols,
        rows
      });
      return;
    }

    const target: any = self.symbols[col][row];
    if (!target) {
      console.warn('[HookScatterHighlighter] No symbol object found at hook-scatter position:', { col, row });
      return;
    }

    try {
      let worldX = target.x;
      let worldY = target.y;
      try {
        const parent: any = (target as any).parentContainer;
        if (parent) {
          worldX = parent.x + target.x;
          worldY = parent.y + target.y;
        }
      } catch {}

      self.scene.events.emit('hook-scatter', worldX, worldY, col, row);
    } catch (e) {
      console.warn('[HookScatterHighlighter] Failed to create hook-scatter highlight:', e);
    }
  } catch (e) {
    console.warn('[HookScatterHighlighter] Error while processing hook-scatter special:', e);
  }
}
