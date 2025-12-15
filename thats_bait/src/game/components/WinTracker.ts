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
}

interface SymbolSummary {
  lines: number;
  totalWin: number;
  multiplier: number;
  baseValue: number;
  multiplierIcons?: Array<{ symbol: number; count: number }>;
}

export class WinTracker {
  private container!: Phaser.GameObjects.Container;
  private scene!: Scene;
  private lastSpinData: SpinData | null = null;
  private lastRenderedSummary: Map<number, SymbolSummary> | null = null;
  private isFadingOut: boolean = true;

  private renderScale: number = 1;
  private resizeHandler?: () => void;

  private baseX: number = 0;
  private baseY: number = 0;
  private offsetX: number = 0;
  private offsetY: number = -460;
  private itemSpacing: number = 80;
  private iconScale: number = 0.3;
  private innerGap: number = 13;
  private horizontalGap: number = 20;
  private multiplierIconScale: number = 2;
  private multiplierIconGap: number = 0.5;
  private autoHideTimer: Phaser.Time.TimerEvent | null = null;

  private readonly depth: number = 905;
  private readonly shadowOffsetX: number = 4;
  private readonly shadowOffsetY: number = 4;
  private readonly shadowAlpha: number = 0.45;
  private readonly labelFontSize: number = 14;
  private readonly labelFontFamily: string = 'Poppins-Bold';
  private readonly accentShadowColor: string = '#0B5D1E';

  create(scene: Scene): void {
    this.scene = scene;
    try {
      if ((this as any).container) {
        this.container.removeAll(true);
        this.container.destroy();
      }
    } catch {}

    this.container = scene.add.container(0, 0);
    this.container.setDepth(this.depth);
    this.container.setVisible(false);
    this.container.setAlpha(1);

    this.refreshLayout();
    try {
      this.resizeHandler = () => {
        try { this.refreshLayout(); } catch {}
        try {
          if (this.container && this.container.visible && !this.isFadingOut && this.lastRenderedSummary) {
            this.renderFromSummary(this.lastRenderedSummary);
          }
        } catch {}
      };
      this.scene.scale.on('resize', this.resizeHandler);
      this.scene.events.once('shutdown', () => {
        try {
          if (this.resizeHandler) {
            this.scene.scale.off('resize', this.resizeHandler);
          }
        } catch {}
        this.resizeHandler = undefined;
      });
    } catch {}
  }

  private refreshLayout(): void {
    if (!this.scene || !this.container) {
      return;
    }
    this.baseX = this.scene.scale.width * 0.5;
    this.baseY = this.scene.scale.height * 0.76;

    const anyScene: any = this.scene as any;
    const assetScale = Number(anyScene?.networkManager?.getAssetScale?.() ?? 1) || 1;
    const widthScale = (this.scene.scale.width && isFinite(this.scene.scale.width)) ? (this.scene.scale.width / 428) : 1;
    const computed = assetScale * widthScale;
    this.renderScale = (isFinite(computed) && computed > 0) ? computed : 1;

    this.container.setPosition(
      this.baseX + this.offsetX,
      this.baseY + this.offsetY
    );
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
    this.lastRenderedSummary = null;
    this.isFadingOut = false;
  }

  updateFromSpinData(spinData: SpinData | null): void {
    this.lastSpinData = spinData;
  }

  showLatest(): void {
    if (!this.container) {
      return;
    }
    this.isFadingOut = false;
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
    this.isFadingOut = false;
    this.container.setVisible(true);
    this.container.setAlpha(1);

    const summary = new Map<number, SymbolSummary>();
    // For a single payline preview, show the count of matching symbols on that line (payline.count)
    // rather than the number of lines.
    const stats = this.getPaylineMultiplierStats(payline);
    const multiplier = Math.max(1, Math.floor(stats.product));
    const baseValue = payline.win / multiplier;
    summary.set(payline.symbol, {
      lines: payline.count,
      totalWin: payline.win,
      multiplier,
      baseValue,
      multiplierIcons: stats.icons,
    });
    this.renderFromSummary(summary);
  }

  private renderFromSpinData(spinData: SpinData | null): void {
    const summary = this.buildSummary(spinData);
    this.renderFromSummary(summary);
  }

  private renderFromSummary(summary: Map<number, SymbolSummary> | null): void {
    this.container.removeAll(true);
    if (!summary) {
      this.lastRenderedSummary = null;
      this.container.setVisible(false);
      return;
    }

    this.lastRenderedSummary = this.cloneSummary(summary);

    this.container.setVisible(true);
    this.container.setAlpha(1);

    const items = Array.from(summary.entries()).sort(
      (a, b) => b[1].totalWin - a[1].totalWin
    );

    const spacing = this.itemSpacing * this.renderScale;
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
      const existing = summary.get(payline.symbol) || { lines: 0, totalWin: 0, multiplier: 1, baseValue: 0, multiplierIcons: [] };
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
      const effectiveMultiplier = Math.max(1, Math.floor(existing.multiplier || 1));
      existing.baseValue = existing.totalWin / effectiveMultiplier;
      summary.set(payline.symbol, existing);
    }
    return summary;
  }

  private addSymbolItem(x: number, symbolId: number, data: SymbolSummary): void {
    const key = `symbol_${symbolId}`;

    const s = this.renderScale;

    const icon = this.scene.add.image(0, 0, key);
    icon.setOrigin(0.5, 0.5);
    icon.setScale(this.iconScale * s);

    const shadow = this.scene.add.image(0, 0, key);
    shadow.setOrigin(0.5, 0.5);
    shadow.setScale(this.iconScale * s);
    shadow.setTint(0x000000);
    shadow.setAlpha(this.shadowAlpha);

    const countLabel = this.scene.add.text(
      0,
      0,
      `${data.lines}`,
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    countLabel.setOrigin(0.5, 0.5);
    countLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const pipeLabel = this.scene.add.text(
      0,
      0,
      '|',
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    pipeLabel.setOrigin(0.5, 0.5);
    pipeLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const baseValueLabel = this.scene.add.text(
      0,
      0,
      `$${(data.baseValue ?? data.totalWin).toFixed(2)}`,
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    baseValueLabel.setOrigin(0.5, 0.5);
    baseValueLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const mulXLabel = this.scene.add.text(
      0,
      0,
      'x',
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    mulXLabel.setOrigin(0.5, 0.5);
    mulXLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const addedMul = Math.max(1, Math.floor(data.multiplier || 1));
    const mulCountLabel = this.scene.add.text(
      0,
      0,
      `${addedMul}`,
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    mulCountLabel.setOrigin(0.5, 0.5);
    mulCountLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const eqLabel = this.scene.add.text(
      0,
      0,
      '=',
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    eqLabel.setOrigin(0.5, 0.5);
    eqLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const valueLabel = this.scene.add.text(
      0,
      0,
      `$${data.totalWin.toFixed(2)}`,
      {
        fontSize: `${this.labelFontSize * s}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    valueLabel.setOrigin(0.5, 0.5);
    valueLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const baseGap = this.innerGap * s;
    const gap = Math.max(6, Math.floor(baseGap * 0.6));
    const pipeGap = Math.max(4, Math.floor(gap * 0.6));
    const iconGapBase = Math.max(2, Math.floor(gap * 0.5));
    const iconGap = Math.max(1, Math.floor(iconGapBase * (this.multiplierIconGap || 1)));

    const mulIcons: Phaser.GameObjects.Image[] = [];
    let mulIconsWidth = 0;
    if (Array.isArray(data.multiplierIcons) && data.multiplierIcons.length > 0) {
      const mulIconTargetH = Math.max(16 * s, icon.displayHeight * 0.3);
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
            img.setScale(this.iconScale * s * 0.25 * (this.multiplierIconScale || 1));
          }
          mulIcons.push(img);
        }
      }
      mulIconsWidth = mulIcons.reduce((acc, img) => acc + img.displayWidth, 0) + iconGap * Math.max(0, mulIcons.length - 1);
    }
    const totalWidth =
      countLabel.displayWidth +
      gap +
      icon.displayWidth +
      (mulIconsWidth > 0 ? (gap + mulIconsWidth) : 0) +
      gap +
      pipeLabel.displayWidth +
      pipeGap +
      baseValueLabel.displayWidth +
      gap +
      mulXLabel.displayWidth +
      iconGap +
      mulCountLabel.displayWidth +
      gap +
      eqLabel.displayWidth +
      gap +
      valueLabel.displayWidth;

    let cursor = x - totalWidth * 0.5;

    countLabel.setPosition(cursor + countLabel.displayWidth * 0.5, 0);
    cursor += countLabel.displayWidth + gap;

    icon.setPosition(cursor + icon.displayWidth * 0.5, 0);
    shadow.setPosition(icon.x + this.shadowOffsetX * s, icon.y + this.shadowOffsetY * s);
    cursor += icon.displayWidth;

    if (mulIcons.length > 0) {
      cursor += gap;
      for (let i = 0; i < mulIcons.length; i++) {
        const img = mulIcons[i];
        img.setPosition(cursor + img.displayWidth * 0.5, 0);
        cursor += img.displayWidth + (i < mulIcons.length - 1 ? iconGap : 0);
      }
    }

    cursor += gap;

    pipeLabel.setPosition(cursor + pipeLabel.displayWidth * 0.5, 0);
    cursor += pipeLabel.displayWidth + pipeGap;

    baseValueLabel.setPosition(cursor + baseValueLabel.displayWidth * 0.5, 0);
    cursor += baseValueLabel.displayWidth + gap;

    mulXLabel.setPosition(cursor + mulXLabel.displayWidth * 0.5, 0);
    cursor += mulXLabel.displayWidth + iconGap;

    mulCountLabel.setPosition(cursor + mulCountLabel.displayWidth * 0.5, 0);
    cursor += mulCountLabel.displayWidth + gap;

    eqLabel.setPosition(cursor + eqLabel.displayWidth * 0.5, 0);
    cursor += eqLabel.displayWidth + gap;

    valueLabel.setPosition(cursor + valueLabel.displayWidth * 0.5, 0);

    this.container.add(shadow);
    this.container.add(icon);
    this.container.add(countLabel);
    for (const img of mulIcons) { this.container.add(img); }
    this.container.add(pipeLabel);
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

  private getPaylineMultiplierStats(payline: PaylineData): { product: number; icons: Array<{ symbol: number; count: number }> } {
    try {
      const arr = (payline && Array.isArray(payline.multipliers)) ? payline.multipliers : [];
      let product = 1;
      const iconMap = new Map<number, number>();
      for (const m of arr) {
        const base = this.getMultiplierValueForSymbol(m?.symbol);
        const count = Math.max(0, Math.floor(m?.count || 0));
        if (base > 1 && count > 0) {
          product *= Math.pow(base, count);
          iconMap.set(m.symbol, (iconMap.get(m.symbol) || 0) + count);
        }
      }
      const icons = Array.from(iconMap.entries()).map(([symbol, count]) => ({ symbol, count }));
      return { product: Math.max(1, Math.floor(product)), icons };
    } catch {
      return { product: 1, icons: [] };
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

    if (this.container) {
      this.container.setPosition(
        this.baseX + this.offsetX,
        this.baseY + this.offsetY
      );
    }

    if (this.container && this.container.visible && !this.isFadingOut && this.lastRenderedSummary) {
      this.renderFromSummary(this.lastRenderedSummary);
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

  public hideWithFade(durationMs: number = 250): void {
    if (!this.scene || !this.container) {
      return;
    }
    if (this.autoHideTimer) {
      try { this.autoHideTimer.remove(false); } catch {}
      this.autoHideTimer = null;
    }
    this.fadeOut(durationMs);
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
    this.isFadingOut = true;
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

  private cloneSummary(summary: Map<number, SymbolSummary>): Map<number, SymbolSummary> {
    const entries: Array<[number, SymbolSummary]> = [];
    for (const [key, value] of summary.entries()) {
      entries.push([
        key,
        {
          ...value,
          multiplierIcons: value.multiplierIcons
            ? value.multiplierIcons.map((it) => ({ ...it }))
            : undefined
        }
      ]);
    }
    return new Map(entries);
  }
}
