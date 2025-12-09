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

    const col = typeof special.position.x === 'number' ? special.position.x : -1;
    const row = typeof special.position.y === 'number' ? special.position.y : -1;

    if (
      col < 0 ||
      row < 0 ||
      !self.symbols ||
      col >= self.symbols.length ||
      !self.symbols[col] ||
      row >= self.symbols[col].length
    ) {
      console.warn('[HookScatterHighlighter] Hook-scatter position out of bounds for current grid:', {
        col,
        row,
        cols: self.symbols ? self.symbols.length : 0,
        rows: self.symbols && self.symbols[0] ? self.symbols[0].length : 0
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
