import Phaser from 'phaser';
import { Symbols } from './Symbols';

export class DebugSymbolProbe {
  private scene: Phaser.Scene;
  private symbols: Symbols;
  private symbolValue: number;
  private col: number;
  private row: number;
  private spine?: any;
  private gfx?: Phaser.GameObjects.Graphics;

  constructor(symbols: Symbols, symbolValue: number, col: number, row: number) {
    this.symbols = symbols;
    this.scene = symbols['scene'];
    this.symbolValue = symbolValue;
    this.col = col;
    this.row = row;
    this.create();
  }

  private getCellCenter(): { x: number; y: number } {
    const symbolTotalWidth = this.symbols['displayWidth'] + this.symbols['horizontalSpacing'];
    const symbolTotalHeight = this.symbols['displayHeight'] + this.symbols['verticalSpacing'];
    const startX = this.symbols['slotX'] - this.symbols['totalGridWidth'] * 0.5;
    const startY = this.symbols['slotY'] - this.symbols['totalGridHeight'] * 0.5;
    const x = startX + this.row * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = startY + this.col * symbolTotalHeight + symbolTotalHeight * 0.5;
    return { x, y };
  }

  private create(): void {
    const { x, y } = this.getCellCenter();
    const spineKey = `symbol_${this.symbolValue}_spine`;
    const spineAtlasKey = spineKey + '-atlas';

    if ((this.scene.cache.json as any).has(spineKey)) {
      const s = (this.scene.add as any).spine(x, y, spineKey, spineAtlasKey);
      s.setOrigin(0.5, 0.5);
      const fallbackScale = this.symbols['getSpineSymbolScale'](this.symbolValue);
      // Reset to setup pose so bounds are stable for scale fitting
      try { s.skeleton.setToSetupPose(); s.update(0); } catch {}
      // Use the same centering helper as gameplay (includes bounds alignment and nudges)
      try {
        const n = this.symbols['getSymbolNudge'](this.symbolValue);
        this.symbols['centerAndFitSpine'](s, x, y, this.symbols['displayWidth'], this.symbols['displayHeight'], fallbackScale, n);
        // Apply the same scale multipliers used by gameplay symbols (idle/new symbols path)
        try {
          const baseMul = this.symbols['getSpineScaleMultiplier']?.(this.symbolValue) ?? 1;
          const idleMul = this.symbols['getIdleScaleMultiplier']?.(this.symbolValue) ?? 1;
          const m = baseMul * idleMul;
          if (m !== 1) s.setScale(s.scaleX * m, s.scaleY * m);
        } catch {}
      } catch {}
      // Ensure the probe is clearly visible above all layers
      try { s.setDepth(1000000); } catch {}
      this.spine = s;
      // Keep probe on the scene root (do not add to masked symbols container)
      // Note: scene.add.spine already places it on the root display list.

      // Try to play animation in a loop: prefer *_win, fallback *_hit, else first
      try {
        const symbolName = `Symbol${this.symbolValue}_HTBH`;
        const anims = s.skeleton?.data?.animations?.map((a: any) => a?.name) || [];
        const preferred = `${symbolName}_win`;
        const fallback = `${symbolName}_hit`;
        const chosen = anims.includes(preferred)
          ? preferred
          : (anims.includes(fallback) ? fallback : (anims[0] || null));
        if (chosen) {
          s.animationState.setAnimation(0, chosen, true);
        }
      } catch {}
    }

    this.gfx = this.scene.add.graphics();
    this.gfx.setDepth(1000001); // above the Spine probe
    try { this.scene.children.bringToTop(this.gfx); } catch {}
    this.drawOverlay();
  }

  private drawOverlay(): void {
    if (!this.gfx) return;
    this.gfx.clear();
    const { x, y } = this.getCellCenter();
    this.gfx.lineStyle(1, 0xff0000, 0.9);
    this.gfx.strokeCircle(x, y, 6);
    this.gfx.lineBetween(x - 10, y, x + 10, y);
    this.gfx.lineBetween(x, y - 10, x, y + 10);
  }

  public destroy(): void {
    try { this.spine?.destroy?.(); } catch {}
    try { this.gfx?.destroy?.(); } catch {}
    this.spine = undefined;
    this.gfx = undefined;
  }
}
