import { Scene } from 'phaser';
import { SpinData, PaylineData } from '../../backend/SpinData';

interface WinTrackerLayoutOptions {
  offsetX?: number;
  offsetY?: number;
  spacing?: number;
  iconScale?: number;
  innerGap?: number;
}

interface SymbolSummary {
  lines: number;
  totalWin: number;
  multiplier: number;
}

export class WinTracker {
  private container!: Phaser.GameObjects.Container;
  private scene!: Scene;
  private lastSpinData: SpinData | null = null;

  private baseX: number = 0;
  private baseY: number = 0;
  private offsetX: number = 0;
  private offsetY: number = -70;
  private itemSpacing: number = 120;
  private iconScale: number = 0.5;
  private innerGap: number = 20;
  private horizontalGap: number = 20;
  private autoHideTimer: Phaser.Time.TimerEvent | null = null;

  private readonly depth: number = 905;
  private readonly shadowOffsetX: number = 4;
  private readonly shadowOffsetY: number = 4;
  private readonly shadowAlpha: number = 0.45;
  private readonly labelFontSize: number = 18;
  private readonly labelFontFamily: string = 'Poppins-Bold';

  create(scene: Scene): void {
    this.scene = scene;
    this.baseX = scene.scale.width * 0.5;
    this.baseY = scene.scale.height * 0.76;

    this.container = scene.add.container(
      this.baseX + this.offsetX,
      this.baseY + this.offsetY
    );
    this.container.setDepth(this.depth);
    this.container.setVisible(false);
    this.container.setAlpha(1);
  }

  clear(): void {
    if (!this.container) {
      return;
    }
    if (this.autoHideTimer) {
      try { this.autoHideTimer.remove(false); } catch {}
      this.autoHideTimer = null;
    }
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.container.setAlpha(1);
    this.lastSpinData = null;
  }

  updateFromSpinData(spinData: SpinData | null): void {
    this.lastSpinData = spinData;
  }

  showLatest(): void {
    if (!this.container) {
      return;
    }
    this.renderFromSpinData(this.lastSpinData);
  }

  public showForPayline(payline: PaylineData | null): void {
    if (!this.container) {
      return;
    }
    if (!payline) {
      this.clear();
      return;
    }

    if (this.autoHideTimer) {
      try { this.autoHideTimer.remove(false); } catch {}
      this.autoHideTimer = null;
    }
    try {
      if (this.scene) {
        this.scene.tweens.killTweensOf(this.container);
      }
    } catch {}
    this.container.setVisible(true);
    this.container.setAlpha(1);

    const summary = new Map<number, SymbolSummary>();
    // For a single payline preview, show the count of matching symbols on that line (payline.count)
    // rather than the number of lines.
    const m = this.getPaylineMultiplier(payline);
    summary.set(payline.symbol, { lines: payline.count, totalWin: payline.win, multiplier: m });
    this.renderFromSummary(summary);
  }

  private renderFromSpinData(spinData: SpinData | null): void {
    const summary = this.buildSummary(spinData);
    this.renderFromSummary(summary);
  }

  private renderFromSummary(summary: Map<number, SymbolSummary> | null): void {
    this.container.removeAll(true);
    if (!summary) {
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);
    this.container.setAlpha(1);

    const items = Array.from(summary.entries()).sort(
      (a, b) => b[1].totalWin - a[1].totalWin
    );

    const spacing = this.itemSpacing;
    const startX = -((items.length - 1) * spacing) / 2;
    let index = 0;

    for (const [symbolId, data] of items) {
      const x = startX + index * spacing;
      this.addSymbolItem(x, symbolId, data);
      index += 1;
    }
  }

  private buildSummary(spinData: SpinData | null): Map<number, SymbolSummary> | null {
    if (!spinData || !spinData.slot || !Array.isArray(spinData.slot.paylines) || spinData.slot.paylines.length === 0) {
      return null;
    }

    const summary = new Map<number, SymbolSummary>();
    for (const payline of spinData.slot.paylines) {
      const m = this.getPaylineMultiplier(payline);
      const existing = summary.get(payline.symbol) || { lines: 0, totalWin: 0, multiplier: 1 };
      // Track the total count of matching symbols across winning lines for this symbol
      existing.lines += (payline.count || 0);
      existing.totalWin += payline.win;
      existing.multiplier = Math.max(existing.multiplier || 1, m || 1);
      summary.set(payline.symbol, existing);
    }
    return summary;
  }

  private addSymbolItem(x: number, symbolId: number, data: SymbolSummary): void {
    const key = `symbol_${symbolId}`;

    const icon = this.scene.add.image(0, 0, key);
    icon.setOrigin(0.5, 0.5);
    icon.setScale(this.iconScale);

    const shadow = this.scene.add.image(0, 0, key);
    shadow.setOrigin(0.5, 0.5);
    shadow.setScale(this.iconScale);
    shadow.setTint(0x000000);
    shadow.setAlpha(this.shadowAlpha);

    const countLabel = this.scene.add.text(
      0,
      0,
      `${data.lines}`,
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    countLabel.setOrigin(0.5, 0.5);
    countLabel.setShadow(3, 3, '#000000', 4, true, true);

    const hasMul = Math.max(1, Math.floor((data.multiplier || 1))) > 1;
    let xLabel: Phaser.GameObjects.Text | null = null;
    let multiplierLabel: Phaser.GameObjects.Text | null = null;
    if (hasMul) {
      xLabel = this.scene.add.text(
        0,
        0,
        'x',
        {
          fontSize: `${this.labelFontSize}px`,
          color: '#ffffff',
          fontFamily: this.labelFontFamily,
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center'
        }
      );
      xLabel.setOrigin(0.5, 0.5);
      xLabel.setShadow(3, 3, '#000000', 4, true, true);

      const multiplierText = `${Math.max(1, Math.floor((data.multiplier || 1)))}`;
      multiplierLabel = this.scene.add.text(
        0,
        0,
        multiplierText,
        {
          fontSize: `${this.labelFontSize}px`,
          color: '#ffffff',
          fontFamily: this.labelFontFamily,
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center'
        }
      );
      multiplierLabel.setOrigin(0.5, 0.5);
      multiplierLabel.setShadow(3, 3, '#000000', 4, true, true);
    }

    const eqLabel = this.scene.add.text(
      0,
      0,
      '=',
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    eqLabel.setOrigin(0.5, 0.5);
    eqLabel.setShadow(3, 3, '#000000', 4, true, true);

    const valueLabel = this.scene.add.text(
      0,
      0,
      `$${data.totalWin.toFixed(2)}`,
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    valueLabel.setOrigin(0.5, 0.5);
    valueLabel.setShadow(3, 3, '#000000', 4, true, true);

    const gap = this.innerGap;
    const totalWidth =
      countLabel.displayWidth +
      gap +
      icon.displayWidth +
      gap +
      (hasMul && xLabel && multiplierLabel ? (xLabel.displayWidth + gap + multiplierLabel.displayWidth + gap) : 0) +
      eqLabel.displayWidth +
      gap +
      valueLabel.displayWidth;

    let cursor = x - totalWidth * 0.5;

    countLabel.setPosition(cursor + countLabel.displayWidth * 0.5, 0);
    cursor += countLabel.displayWidth + gap;

    icon.setPosition(cursor + icon.displayWidth * 0.5, 0);
    shadow.setPosition(icon.x + this.shadowOffsetX, icon.y + this.shadowOffsetY);
    cursor += icon.displayWidth + gap;

    if (hasMul && xLabel && multiplierLabel) {
      xLabel.setPosition(cursor + xLabel.displayWidth * 0.5, 0);
      cursor += xLabel.displayWidth + gap;

      multiplierLabel.setPosition(cursor + multiplierLabel.displayWidth * 0.5, 0);
      cursor += multiplierLabel.displayWidth + gap;
    }

    eqLabel.setPosition(cursor + eqLabel.displayWidth * 0.5, 0);
    cursor += eqLabel.displayWidth + gap;

    valueLabel.setPosition(cursor + valueLabel.displayWidth * 0.5, 0);

    this.container.add(shadow);
    this.container.add(icon);
    this.container.add(countLabel);
    if (hasMul && xLabel && multiplierLabel) {
      this.container.add(xLabel);
      this.container.add(multiplierLabel);
    }
    this.container.add(eqLabel);
    this.container.add(valueLabel);
  }

  private getPaylineMultiplier(payline: PaylineData): number {
    try {
      const arr = (payline && Array.isArray(payline.multipliers)) ? payline.multipliers : [];
      let factor = 1;
      for (const m of arr) {
        const base = this.getMultiplierValueForSymbol(m?.symbol);
        const count = Math.max(0, Math.floor(m?.count || 0));
        if (base > 1 && count > 0) {
          factor *= Math.pow(base, count);
        }
      }
      return Math.max(1, Math.floor(factor));
    } catch {
      return 1;
    }
  }

  private getMultiplierValueForSymbol(symbolId: number | undefined): number {
    switch (symbolId) {
      case 12: return 2;
      case 13: return 3;
      case 14: return 4;
      default: return 1;
    }
  }

  public setLayout(options: WinTrackerLayoutOptions): void {
    if (typeof options.offsetX === 'number') {
      this.offsetX = options.offsetX;
    }
    if (typeof options.offsetY === 'number') {
      this.offsetY = options.offsetY;
    }
    if (typeof options.spacing === 'number' && options.spacing > 0) {
      this.itemSpacing = options.spacing;
    }
    if (typeof options.iconScale === 'number' && options.iconScale > 0) {
      this.iconScale = options.iconScale;
    }
    if (typeof options.innerGap === 'number' && options.innerGap >= 0) {
      this.innerGap = options.innerGap;
    }

    if (this.container) {
      this.container.setPosition(
        this.baseX + this.offsetX,
        this.baseY + this.offsetY
      );
    }
  }

  public autoHideAfter(delayMs: number): void {
    if (!this.scene || !this.container) {
      return;
    }
    if (this.autoHideTimer) {
      try { this.autoHideTimer.remove(false); } catch {}
      this.autoHideTimer = null;
    }
    this.autoHideTimer = this.scene.time.delayedCall(delayMs, () => {
      this.autoHideTimer = null;
      this.fadeOut(250);
    });
  }

  private fadeOut(durationMs: number): void {
    if (!this.scene || !this.container) {
      return;
    }
    if (!this.container.visible) {
      return;
    }
    try {
      this.scene.tweens.killTweensOf(this.container);
    } catch {}
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.clear();
      }
    });
  }
}
