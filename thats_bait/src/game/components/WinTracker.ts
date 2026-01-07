import { Scene } from 'phaser';
import { SpinData, PaylineData } from '../../backend/SpinData';
import { SCATTER_SYMBOL, WINLINES } from '../../config/GameConfig';
import { getMoneyValueForCell } from './Symbol5VariantHelper';

interface WinTrackerLayoutOptions {
  offsetX?: number;
  offsetY?: number;
  baseOffsetX?: number;
  baseOffsetY?: number;
  bonusOffsetX?: number;
  bonusOffsetY?: number;
  spacing?: number;
  iconScale?: number;
  innerGap?: number;
  multiplierIconScale?: number;
  multiplierIconGap?: number;
  useAutoPosition?: boolean;
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
  private isBonusMode: boolean = false;
  private useAutoPosition: boolean = true;
  private baseModeOffsetX: number = 0;
  private baseModeOffsetY: number = 0;
  private bonusModeOffsetX: number = 0;
  private bonusModeOffsetY: number = 0;
  private offsetX: number = 0;
  private offsetY: number = -460;
  private itemSpacing: number = 80;
  private iconScale: number = 1;
  private innerGap: number = 13;
  private horizontalGap: number = 20;
  private multiplierIconScale: number = 2;
  private multiplierIconGap: number = 0.5;
  private autoHideTimer: Phaser.Time.TimerEvent | null = null;

  private maxWidth: number = 0;
  private rowHeight: number = 0;
  private rowSpacing: number = 0;

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
      const bonusModeHandler = (isBonus: boolean) => {
        try { this.isBonusMode = !!isBonus; } catch {}
        try { this.refreshLayout(); } catch {}
        try {
          if (this.container && this.container.visible && !this.isFadingOut && this.lastRenderedSummary) {
            this.renderFromSummary(this.lastRenderedSummary);
          }
        } catch {}
      };

      this.resizeHandler = () => {
        try { this.refreshLayout(); } catch {}
        try {
          if (this.container && this.container.visible && !this.isFadingOut && this.lastRenderedSummary) {
            this.renderFromSummary(this.lastRenderedSummary);
          }
        } catch {}
      };
      this.scene.scale.on('resize', this.resizeHandler);
      try { this.scene.events.on('setBonusMode', bonusModeHandler); } catch {}
      this.scene.events.once('shutdown', () => {
        try {
          if (this.resizeHandler) {
            this.scene.scale.off('resize', this.resizeHandler);
          }
        } catch {}
        try { this.scene.events.off('setBonusMode', bonusModeHandler); } catch {}
        this.resizeHandler = undefined;
      });
    } catch {}
  }

  private areAreasEqual(a: any, b: any): boolean {
    try {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const ac = a[i];
        const bc = b[i];
        if (!Array.isArray(ac) || !Array.isArray(bc)) return false;
        if (ac.length !== bc.length) return false;
        for (let j = 0; j < ac.length; j++) {
          if (Number(ac[j]) !== Number(bc[j])) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private getCurrentFreeSpinItem(spinData: any): any | null {
    try {
      const items: any[] | undefined = spinData?.slot?.freespin?.items || spinData?.slot?.freeSpin?.items;
      if (!Array.isArray(items) || items.length <= 0) return null;

      const slotArea = spinData?.slot?.area;
      if (Array.isArray(slotArea) && Array.isArray(slotArea[0])) {
        const match = items.find((it: any) => this.areAreasEqual(it?.area, slotArea));
        if (match) return match;
      }

      const withSpins = items.find((it: any) => (Number(it?.spinsLeft) || 0) > 0);
      return withSpins ?? items[0];
    } catch {
      return null;
    }
  }

  private isCollectorOnlyBonusSpin(spinData: SpinData): boolean {
    try {
      const slot: any = (spinData as any)?.slot;
      const area: any[][] = slot?.area;
      if (!Array.isArray(area) || area.length <= 0) return false;

      const pls: any[] = slot?.paylines;
      const hasPaylines = Array.isArray(pls) && pls.some((pl: any) => (Number(pl?.win) || 0) > 0);
      if (hasPaylines) return false;

      let hasCollector = false;
      let hasMoneyValue = false;
      for (let col = 0; col < area.length; col++) {
        const colArr = area[col];
        if (!Array.isArray(colArr)) continue;
        for (let row = 0; row < colArr.length; row++) {
          const id = Number(colArr[row]);
          if (id === 11) {
            hasCollector = true;
            continue;
          }
          if (id === 5 || id === 12 || id === 13 || id === 14) {
            const v = Number(getMoneyValueForCell(spinData as any, col, row));
            if (isFinite(v) && v > 0) {
              hasMoneyValue = true;
              break;
            }
          }
        }
        if (hasMoneyValue) break;
      }

      return hasCollector && !hasMoneyValue;
    } catch {
      return false;
    }
  }

  private hasCollectorInArea(spinData: SpinData): boolean {
    try {
      const slot: any = (spinData as any)?.slot;
      const area: any[][] = slot?.area;
      if (!Array.isArray(area) || area.length <= 0) return false;

      for (let col = 0; col < area.length; col++) {
        const colArr = area[col];
        if (!Array.isArray(colArr)) continue;
        for (let row = 0; row < colArr.length; row++) {
          if (Number(colArr[row]) === 11) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private resolvePaylineToRegisteredWinlineIndex(spinData: SpinData, payline: PaylineData): number | null {
    try {
      const desired = typeof payline.lineKey === 'number' ? payline.lineKey : -1;
      const count = Math.max(0, Number(payline.count) || 0);
      const targetSymbol = Number(payline.symbol);
      const requiredMin = (Number(targetSymbol) === 1) ? 2 : 3;

      const withinRange = isFinite(desired) && desired >= 0 && desired < WINLINES.length;
      if (withinRange) {
        const len = this.computeStreakLengthForWinline(spinData, desired, targetSymbol, count);
        if (len >= requiredMin) {
          return desired;
        }
      }

      let bestIndex: number | null = null;
      let bestLen = -1;
      let bestExact = false;

      for (let i = 0; i < WINLINES.length; i++) {
        const len = this.computeStreakLengthForWinline(spinData, i, targetSymbol, count);
        const exact = count >= requiredMin && len === count;

        if (exact && !bestExact) {
          bestExact = true;
          bestLen = len;
          bestIndex = i;
          continue;
        }

        if (bestExact && exact) {
          if (bestIndex === null || Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
            bestLen = len;
            bestIndex = i;
          }
          continue;
        }

        if (!bestExact) {
          if (len > bestLen) {
            bestLen = len;
            bestIndex = i;
          } else if (len === bestLen && bestIndex !== null && Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
            bestIndex = i;
          } else if (len === bestLen && bestIndex === null) {
            bestIndex = i;
          }
        }
      }

      if (bestIndex === null) {
        return null;
      }

      return bestLen >= requiredMin ? bestIndex : null;
    } catch {
      return null;
    }
  }

  private computeStreakLengthForWinline(
    spinData: SpinData,
    winlineIndex: number,
    targetSymbol: number,
    requiredCount?: number
  ): number {
    if (winlineIndex < 0 || winlineIndex >= WINLINES.length) {
      return 0;
    }

    const winline = WINLINES[winlineIndex];
    const positions: Array<{ x: number; y: number }> = [];
    for (let x = 0; x < winline.length; x++) {
      for (let y = 0; y < winline[x].length; y++) {
        if (winline[x][y] === 1) {
          positions.push({ x, y });
        }
      }
    }

    positions.sort((a, b) => a.x - b.x);
    const firstPos = positions[0];
    if (!firstPos || firstPos.x !== 0) {
      return 0;
    }

    const required = Math.max(0, Number(requiredCount) || 0);
    const requiredMin = (Number(targetSymbol) === 1) ? 2 : 3;
    if (required > 0 && required < requiredMin) {
      return 0;
    }

    const firstSymbol = spinData.slot.area?.[firstPos.x]?.[firstPos.y];
    const scatterVal = Number((SCATTER_SYMBOL as any)?.[0] ?? 0);
    const collectorVal = 11;
    const matchesTarget = (sym: any): boolean => {
      const v = Number(sym);
      return v === targetSymbol || (v === collectorVal && targetSymbol !== scatterVal);
    };
    if (!matchesTarget(firstSymbol)) {
      return 0;
    }

    let len = 1;
    for (let i = 1; i < positions.length; i++) {
      const pos = positions[i];
      const prev = positions[i - 1];
      if (pos.x !== prev.x + 1) {
        break;
      }
      const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];
      if (matchesTarget(symbolAtPosition)) {
        len++;
        if (required >= requiredMin && len >= required) {
          return required;
        }
      } else {
        break;
      }
    }

    return len;
  }

  private refreshLayout(): void {
    if (!this.scene || !this.container) {
      return;
    }
    const anyScene: any = this.scene as any;
    const symbolsAny: any = anyScene?.symbols;

    const slotX = Number(symbolsAny?.slotX);
    const slotY = Number(symbolsAny?.slotY);
    this.baseX = (isFinite(slotX) && slotX !== 0) ? slotX : (this.scene.scale.width * 0.5);
    this.baseY = (isFinite(slotY) && slotY !== 0) ? slotY : (this.scene.scale.height * 0.76);

    const assetScale = Number(anyScene?.networkManager?.getAssetScale?.() ?? 1) || 1;
    const widthScale = (this.scene.scale.width && isFinite(this.scene.scale.width)) ? (this.scene.scale.width / 428) : 1;
    const computed = assetScale * widthScale;
    this.renderScale = (isFinite(computed) && computed > 0) ? computed : 1;

    const gridW = Number(symbolsAny?.totalGridWidth) || 0;
    const gridH = Number(symbolsAny?.totalGridHeight) || 0;
    const symbolH = Number(symbolsAny?.displayHeight) || 0;

    const maxW = (gridW > 0) ? (gridW * 0.95) : (this.scene.scale.width * 0.92);
    this.maxWidth = Math.max(180, Math.min(this.scene.scale.width * 0.98, maxW));

    const baseRowHeight = (symbolH > 0) ? (symbolH * 0.42) : (26 * this.renderScale);
    this.rowHeight = Math.max(18, Math.min(70, baseRowHeight));

    const desiredSpacing = this.itemSpacing * this.renderScale;
    const minSpacing = Math.max(6, this.rowHeight * 1.05);
    const maxSpacing = Math.max(minSpacing, this.rowHeight * 1.75);
    this.rowSpacing = Math.max(minSpacing, Math.min(maxSpacing, desiredSpacing));

    const autoOffsetX = 0;
    const autoOffsetY = (gridH > 0)
      ? (-(gridH * 0.5) - (this.rowHeight * 0.6))
      : this.offsetY;

    const effectiveOffsetX = this.useAutoPosition ? autoOffsetX : this.offsetX;
    const effectiveOffsetY = this.useAutoPosition ? autoOffsetY : this.offsetY;

    const modeOffsetX = this.isBonusMode ? this.bonusModeOffsetX : this.baseModeOffsetX;
    const modeOffsetY = this.isBonusMode ? this.bonusModeOffsetY : this.baseModeOffsetY;

    this.container.setPosition(
      this.baseX + effectiveOffsetX + modeOffsetX,
      this.baseY + effectiveOffsetY + modeOffsetY
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

    const count = Number(payline.count) || 0;
    const win = Number(payline.win) || 0;
    const requiredMin = (Number(payline.symbol) === 1) ? 2 : 3;
    if (win <= 0 || count < requiredMin) {
      this.clear();
      return;
    }

    // Only allow preview if this payline corresponds to a registered winline.
    // Note: WinLineDrawer may resolve a payline to a different winline index than payline.lineKey,
    // so avoid validating against payline.lineKey directly.
    const spinData = this.lastSpinData;
    if (spinData) {
      const resolvedLineKey = this.resolvePaylineToRegisteredWinlineIndex(spinData, payline);
      if (resolvedLineKey === null) {
        this.clear();
        return;
      }
      const streakLen = this.computeStreakLengthForWinline(spinData, resolvedLineKey, Number(payline.symbol), payline.count);
      if (streakLen < requiredMin) {
        this.clear();
        return;
      }
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

    const maxW = Math.max(140, this.maxWidth || (this.scene.scale.width * 0.92));
    const baseGap = Math.max(8, Math.floor((this.horizontalGap || 20) * this.renderScale));
    const count = Math.max(0, items.length | 0);

    if (count <= 0) {
      return;
    }

    const gap = (count > 1) ? baseGap : 0;
    const computedPer = (count > 1) ? ((maxW - gap * (count - 1)) / count) : maxW;
    const perItemMaxW = Math.max(10, computedPer);
    const totalAllocW = (perItemMaxW * count) + gap * Math.max(0, count - 1);
    const startX = -(totalAllocW * 0.5) + (perItemMaxW * 0.5);

    for (let i = 0; i < count; i++) {
      const [symbolId, data] = items[i];
      const x = startX + i * (perItemMaxW + gap);
      this.addSymbolRow(x, 0, symbolId, data, perItemMaxW);
    }
  }

  private addSymbolRow(x: number, y: number, symbolId: number, data: SymbolSummary, maxWOverride?: number): void {
    const key = `symbol_${symbolId}`;

    const s = this.renderScale;
    const rowH = Math.max(12, this.rowHeight || (24 * s));
    const maxW = (typeof maxWOverride === 'number')
      ? Math.max(10, maxWOverride)
      : Math.max(140, (this.maxWidth || (this.scene.scale.width * 0.92)));

    const fontPx = Math.max(10, Math.min(24, rowH * 0.65));
    const gap = Math.max(4, Math.min(22, (this.innerGap * s) * 0.6));

    const countLabel = this.scene.add.text(
      0,
      0,
      `${data.lines}`,
      {
        fontSize: `${fontPx}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    countLabel.setOrigin(0.5, 0.5);
    countLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    const icon = this.scene.add.image(0, 0, key);
    icon.setOrigin(0.5, 0.5);
    const shadow = this.scene.add.image(0, 0, key);
    shadow.setOrigin(0.5, 0.5);
    shadow.setTint(0x000000);
    shadow.setAlpha(this.shadowAlpha);

    const iconTargetH = Math.max(10, rowH * 0.9);
    const srcH = (icon as any).height || 0;
    const baseIconScale = (srcH > 0) ? (iconTargetH / srcH) : 1;
    const iconScale = baseIconScale * (this.iconScale || 1);
    icon.setScale(iconScale);
    shadow.setScale(iconScale);

    const eqLabel = this.scene.add.text(
      0,
      0,
      '=',
      {
        fontSize: `${fontPx}px`,
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
        fontSize: `${fontPx}px`,
        color: '#ffffff',
        fontFamily: this.labelFontFamily,
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center'
      }
    );
    valueLabel.setOrigin(0.5, 0.5);
    valueLabel.setShadow(1 * s, .5 * s, this.accentShadowColor, 1 * s, true, true);

    let totalWidth =
      countLabel.displayWidth +
      gap +
      icon.displayWidth +
      gap +
      eqLabel.displayWidth +
      gap +
      valueLabel.displayWidth;

    const fit = (totalWidth > 0) ? Math.min(1, maxW / totalWidth) : 1;
    if (fit < 1) {
      countLabel.setScale(fit);
      eqLabel.setScale(fit);
      valueLabel.setScale(fit);
      icon.setScale(icon.scaleX * fit, icon.scaleY * fit);
      shadow.setScale(shadow.scaleX * fit, shadow.scaleY * fit);
    }

    totalWidth =
      countLabel.displayWidth +
      gap +
      icon.displayWidth +
      gap +
      eqLabel.displayWidth +
      gap +
      valueLabel.displayWidth;

    let cursor = x - (totalWidth * 0.5);

    countLabel.setPosition(cursor + countLabel.displayWidth * 0.5, y);
    cursor += countLabel.displayWidth + gap;

    icon.setPosition(cursor + icon.displayWidth * 0.5, y);
    shadow.setPosition(icon.x + this.shadowOffsetX * s, icon.y + this.shadowOffsetY * s);
    cursor += icon.displayWidth + gap;

    eqLabel.setPosition(cursor + eqLabel.displayWidth * 0.5, y);
    cursor += eqLabel.displayWidth + gap;

    valueLabel.setPosition(cursor + valueLabel.displayWidth * 0.5, y);

    this.container.add(shadow);
    this.container.add(icon);
    this.container.add(countLabel);
    this.container.add(eqLabel);
    this.container.add(valueLabel);
  }

  private buildSummary(spinData: SpinData | null): Map<number, SymbolSummary> | null {
    try {
      if (this.isBonusMode && spinData) {
        if (this.isCollectorOnlyBonusSpin(spinData)) {
          return null;
        }
      }
    } catch {}

    if (!spinData || !spinData.slot || !Array.isArray(spinData.slot.paylines) || spinData.slot.paylines.length === 0) {
      return null;
    }

    const summary = new Map<number, SymbolSummary>();
    for (const payline of spinData.slot.paylines) {
      const win = Number(payline.win) || 0;
      if (win <= 0) {
        continue;
      }
      const requiredMin = (Number(payline.symbol) === 1) ? 2 : 3;
      const resolvedLineKey = this.resolvePaylineToRegisteredWinlineIndex(spinData, payline);
      if (resolvedLineKey === null) {
        continue;
      }
      const streakLen = this.computeStreakLengthForWinline(spinData, resolvedLineKey, Number(payline.symbol), payline.count);
      if (streakLen < requiredMin) {
        continue;
      }
      const stats = this.getPaylineMultiplierStats(payline);
      const existing = summary.get(payline.symbol) || { lines: 0, totalWin: 0, multiplier: 1, baseValue: 0, multiplierIcons: [] };
      // Track the total count of matching symbols across winning lines for this symbol
      existing.lines += streakLen;
      existing.totalWin += win;
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
    return summary.size > 0 ? summary : null;
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
    let hasOffsetUpdate = false;
    if (typeof options.useAutoPosition === 'boolean') {
      this.useAutoPosition = options.useAutoPosition;
    }
    if (typeof options.offsetX === 'number') {
      this.offsetX = options.offsetX;
      hasOffsetUpdate = true;
    }
    if (typeof options.offsetY === 'number') {
      this.offsetY = options.offsetY;
      hasOffsetUpdate = true;
    }
    if (typeof options.baseOffsetX === 'number') {
      this.baseModeOffsetX = options.baseOffsetX;
    }
    if (typeof options.baseOffsetY === 'number') {
      this.baseModeOffsetY = options.baseOffsetY;
    }
    if (typeof options.bonusOffsetX === 'number') {
      this.bonusModeOffsetX = options.bonusOffsetX;
    }
    if (typeof options.bonusOffsetY === 'number') {
      this.bonusModeOffsetY = options.bonusOffsetY;
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

    if (hasOffsetUpdate && options.useAutoPosition !== true) {
      this.useAutoPosition = false;
    }

    if (this.container) {
      this.refreshLayout();
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
