import { Scene } from 'phaser';
import { SpinData, PaylineData } from '../../backend/SpinData';

interface WinTrackerLayoutOptions {
  offsetX?: number;
  offsetY?: number;
  spacing?: number;
  iconScale?: number;
  innerGap?: number;
  multiplierIconScale?: number;
  multiplierIconGap?: number;
  countIconGap?: number;
  paragraphGap?: number;
}

interface SymbolSummary {
  lines: number;
  totalWin: number;
  multiplier: number;
  baseValue: number;
  multiplierIcons?: Array<{ symbol: number; count: number }>;
  multiplierCount?: number;
}

export class WinTracker {
  private container!: Phaser.GameObjects.Container;
  private scene!: Scene;
  private lastSpinData: SpinData | null = null;
  private lastSummary: Map<number, SymbolSummary> | null = null;

  private baseX: number = 0;
  private baseY: number = 0;
  private offsetX: number = 0;
  private offsetY: number = -70;
  private itemSpacing: number = 100;
  private iconScale: number = 0.2;
  private innerGap: number = 15;
  private horizontalGap: number = 20;
  private multiplierIconScale: number = 1.8;
  private multiplierIconGap: number = 0.8;
  private countIconGap: number = 4;
  private paragraphGap: number = 30;
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
    this.lastSummary = null;
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
    const stats = this.getPaylineMultiplierStats(payline);
    const added = Math.max(1, Math.floor(stats.sum));
    const baseValue = payline.win / added;
    summary.set(payline.symbol, {
      lines: payline.count,
      totalWin: payline.win,
      multiplier: stats.product,
      baseValue,
      multiplierIcons: stats.icons,
      multiplierCount: added
    });
    this.renderFromSummary(summary);
  }

  private renderFromSpinData(spinData: SpinData | null): void {
    const summary = this.buildSummary(spinData);
    this.renderFromSummary(summary);
  }

  private renderFromSummary(summary: Map<number, SymbolSummary> | null): void {
    this.lastSummary = summary;
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
      const stats = this.getPaylineMultiplierStats(payline);
      const existing = summary.get(payline.symbol) || { lines: 0, totalWin: 0, multiplier: 1, baseValue: 0, multiplierIcons: [], multiplierCount: 0 };
      // Track the total count of matching symbols across winning lines for this symbol
      existing.lines += (payline.count || 0);
      existing.totalWin += payline.win;
      existing.multiplier = Math.max(existing.multiplier || 1, stats.product || 1);
      const prevMap = new Map<number, number>();
      for (const it of (existing.multiplierIcons || [])) {
        prevMap.set(it.symbol, (prevMap.get(it.symbol) || 0) + (it.count || 0));
      }
      for (const it of stats.icons) {
        prevMap.set(it.symbol, (prevMap.get(it.symbol) || 0) + (it.count || 0));
      }
      existing.multiplierIcons = Array.from(prevMap.entries()).map(([symbol, count]) => ({ symbol, count }));
      existing.multiplierCount = (existing.multiplierCount || 0) + Math.max(1, Math.floor(stats.sum));
      existing.baseValue = existing.totalWin / Math.max(1, existing.multiplierCount || 1);
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
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    countLabel.setOrigin(0.5, 0.5);
    countLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    // Check if demo mode is active - if so, remove currency symbol
    const sceneAny: any = this.scene;
    const isDemo = sceneAny?.gameAPI?.getDemoState();
    const currencySymbol = isDemo ? '' : '$';
    const baseValueLabel = this.scene.add.text(
      0,
      0,
      `${currencySymbol}${(data.baseValue ?? data.totalWin).toFixed(2)}`,
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    baseValueLabel.setOrigin(0.5, 0.5);
    baseValueLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    const mulXLabel = this.scene.add.text(
      0,
      0,
      'x',
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    mulXLabel.setOrigin(0.5, 0.5);
    mulXLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    const addedMul = Math.max(1, Math.floor(data.multiplierCount || 0));
    const mulCountLabel = this.scene.add.text(
      0,
      0,
      `${addedMul}`,
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    mulCountLabel.setOrigin(0.5, 0.5);
    mulCountLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    const eqLabel = this.scene.add.text(
      0,
      0,
      '=',
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    eqLabel.setOrigin(0.5, 0.5);
    eqLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    const valueLabel = this.scene.add.text(
      0,
      0,
      `${currencySymbol}${data.totalWin.toFixed(2)}`,
      {
        fontSize: `${this.labelFontSize}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#350400',
        strokeThickness: 4,
        align: 'outside'
      }
    );
    valueLabel.setOrigin(0.5, 0.5);
    valueLabel.setShadow(1, .5, '#FFFE48', 1, true, true);

    const baseGap = this.innerGap;
    const gap = Math.max(6, Math.floor(baseGap * 0.6));
    const iconGapBase = Math.max(2, Math.floor(gap * 0.5));
    const iconGap = Math.max(1, Math.floor(iconGapBase * (this.multiplierIconGap || 1)));
    const lineGap = this.paragraphGap != null
      ? Math.max(0, Math.floor(this.paragraphGap))
      : Math.max(10, Math.floor(this.innerGap * 1.6));
    const countIconGap = Math.max(0, Math.floor(this.countIconGap));

    const mulIcons: Phaser.GameObjects.Image[] = [];
    let mulIconsWidth = 0;
    if (Array.isArray(data.multiplierIcons) && data.multiplierIcons.length > 0) {
      const mulIconTargetH = Math.max(16, this.labelFontSize + 2);
      for (const it of data.multiplierIcons) {
        for (let i = 0; i < Math.max(0, Math.floor(it.count || 0)); i++) {
          const mk = `symbol_${it.symbol}`;
          const img = this.scene.add.image(0, 0, mk);
          img.setOrigin(0.5, 0.5);
          const srcH = (img as any).height || 0;
          if (srcH > 0) {
            const baseScale = mulIconTargetH / srcH;
            img.setScale(baseScale * (this.multiplierIconScale || 1));
          } else {
            img.setScale(this.iconScale * 0.25 * (this.multiplierIconScale || 1));
          }
          mulIcons.push(img);
        }
      }
      mulIconsWidth = mulIcons.reduce((acc, img) => acc + img.displayWidth, 0) + iconGap * Math.max(0, mulIcons.length - 1);
    }
    // Compute widths for two-line layout
    const line1Width =
      countLabel.displayWidth +
      countIconGap +
      icon.displayWidth +
      (mulIconsWidth > 0 ? (gap + mulIconsWidth) : 0);

    const line2Width =
      baseValueLabel.displayWidth +
      gap +
      mulXLabel.displayWidth +
      iconGap +
      mulCountLabel.displayWidth +
      gap +
      eqLabel.displayWidth +
      gap +
      valueLabel.displayWidth;

    // Center each line around the same x
    let cursor1 = x - line1Width * 0.5;
    let cursor2 = x - line2Width * 0.5;

    // Top line (count + icon + multiplier icons)
    const y1 = -Math.floor(lineGap * 0.6);
    const y2 = Math.floor(lineGap * 0.6);

    countLabel.setPosition(cursor1 + countLabel.displayWidth * 0.5, y1);
    cursor1 += countLabel.displayWidth + countIconGap;

    icon.setPosition(cursor1 + icon.displayWidth * 0.5, y1);
    shadow.setPosition(icon.x + this.shadowOffsetX, icon.y + this.shadowOffsetY);
    cursor1 += icon.displayWidth;

    if (mulIcons.length > 0) {
      cursor1 += gap;
      for (let i = 0; i < mulIcons.length; i++) {
        const img = mulIcons[i];
        img.setPosition(cursor1 + img.displayWidth * 0.5, y1);
        cursor1 += img.displayWidth + (i < mulIcons.length - 1 ? iconGap : 0);
      }
    }

    // Bottom line (baseValue x count = total)
    baseValueLabel.setPosition(cursor2 + baseValueLabel.displayWidth * 0.5, y2);
    cursor2 += baseValueLabel.displayWidth + gap;

    mulXLabel.setPosition(cursor2 + mulXLabel.displayWidth * 0.5, y2);
    cursor2 += mulXLabel.displayWidth + iconGap;

    mulCountLabel.setPosition(cursor2 + mulCountLabel.displayWidth * 0.5, y2);
    cursor2 += mulCountLabel.displayWidth + gap;

    eqLabel.setPosition(cursor2 + eqLabel.displayWidth * 0.5, y2);
    cursor2 += eqLabel.displayWidth + gap;

    valueLabel.setPosition(cursor2 + valueLabel.displayWidth * 0.5, y2);

    this.container.add(shadow);
    this.container.add(icon);
    this.container.add(countLabel);
    for (const img of mulIcons) { this.container.add(img); }
    this.container.add(baseValueLabel);
    this.container.add(mulXLabel);
    this.container.add(mulCountLabel);
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

  private getPaylineMultiplierStats(payline: PaylineData): { product: number; sum: number; icons: Array<{ symbol: number; count: number }> } {
    try {
      const arr = (payline && Array.isArray(payline.multipliers)) ? payline.multipliers : [];
      let product = 1;
      let sum = 0;
      const iconMap = new Map<number, number>();
      for (const m of arr) {
        const base = this.getMultiplierValueForSymbol(m?.symbol);
        const count = Math.max(0, Math.floor(m?.count || 0));
        if (base > 1 && count > 0) {
          product *= Math.pow(base, count);
          sum += base * count;
          iconMap.set(m.symbol, (iconMap.get(m.symbol) || 0) + count);
        }
      }
      if (sum === 0) sum = 1;
      const icons = Array.from(iconMap.entries()).map(([symbol, count]) => ({ symbol, count }));
      return { product: Math.max(1, Math.floor(product)), sum, icons };
    } catch {
      return { product: 1, sum: 1, icons: [] };
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
    if (typeof options.multiplierIconScale === 'number' && options.multiplierIconScale > 0) {
      this.multiplierIconScale = options.multiplierIconScale;
    }
    if (typeof options.multiplierIconGap === 'number' && options.multiplierIconGap > 0) {
      this.multiplierIconGap = options.multiplierIconGap;
    }
    if (typeof options.countIconGap === 'number' && options.countIconGap >= 0) {
      this.countIconGap = options.countIconGap;
    }
    if (typeof options.paragraphGap === 'number' && options.paragraphGap >= 0) {
      this.paragraphGap = options.paragraphGap;
    }

    if (this.container) {
      this.container.setPosition(
        this.baseX + this.offsetX,
        this.baseY + this.offsetY
      );
      // Re-render with the latest layout so scale/spacing changes apply immediately
      if (this.lastSummary) {
        this.renderFromSummary(this.lastSummary);
      } else if (this.lastSpinData) {
        this.renderFromSpinData(this.lastSpinData);
      }
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


