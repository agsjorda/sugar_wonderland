import { Game } from '../scenes/Game';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SpinData, PaylineData } from '../../backend/SpinData';
import { WINLINES } from '../../config/GameConfig';

interface Grid {
  x: number;
  y: number;
  symbol: number;
}

export class WinLineDrawer {
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.GameObject[] = [];

  private symbolsReference: any;
  private currentWinPatterns: [number, Grid[]][] = [];
  private currentPaylinesByKey: Map<number, PaylineData> = new Map();
  private isLooping: boolean = false;
  private loopTimer?: Phaser.Time.TimerEvent;
  private hasEmittedFirstLoopWinStop: boolean = false;
  private wasInterruptedByManualSpin: boolean = false;

  private bubbleDensityMultiplier: number = 2;
  private bubbleScaleRandomness: number = 1.0;
  private bubbleWobbleAmount: number = 0.8;
  private bubbleWobbleSpeed: number = 1.0;
  public bubbleAlphaMultiplier: number = 0.4;

  private lineDisplayTime: number = 250;
  private cycleEndPause: number = 250;
  private animationSpeed: number = 2;

  private minLineDisplayTime: number = 500;
  private minCycleEndPause: number = 800;

  private originalLineDisplayTime?: number;
  private originalCycleEndPause?: number;
  private originalAnimationSpeed?: number;
  private turboApplied: boolean = false;

  constructor(scene: Game, symbolsReference: any) {
    this.scene = scene;
    this.symbolsReference = symbolsReference;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(900);
  }

  public setBubbleStyle(options: {
    densityMultiplier?: number;
    scaleRandomness?: number;
    wobbleAmount?: number;
    wobbleSpeed?: number;
  }): void {
    if (options.densityMultiplier !== undefined) {
      this.bubbleDensityMultiplier = Math.max(0.25, Math.min(4.0, options.densityMultiplier));
    }
    if (options.scaleRandomness !== undefined) {
      this.bubbleScaleRandomness = Math.max(0.1, Math.min(4.0, options.scaleRandomness));
    }
    if (options.wobbleAmount !== undefined) {
      this.bubbleWobbleAmount = Math.max(0.1, Math.min(4.0, options.wobbleAmount));
    }
    if (options.wobbleSpeed !== undefined) {
      this.bubbleWobbleSpeed = Math.max(0.25, Math.min(4.0, options.wobbleSpeed));
    }
  }

  public setBubbleOpacity(alpha: number): void {
    this.bubbleAlphaMultiplier = Math.max(0, Math.min(1, alpha));
  }

  public drawWinLinesFromSpinData(spinData: SpinData): void {
    this.stopLooping();
    this.clearLines();

    if (!spinData.slot.paylines || spinData.slot.paylines.length === 0) {
      console.log('[WinLineDrawer] No paylines to draw lines for');
      return;
    }

    this.currentWinPatterns = this.convertPaylinesToWinPatterns(spinData);
    this.isLooping = true;
    this.hasEmittedFirstLoopWinStop = false;
    this.wasInterruptedByManualSpin = false;

    console.log('[WinLineDrawer] Emitting WIN_START for winline animations (looping)');
    gameEventManager.emit(GameEventType.WIN_START);

    this.drawWinLinesSequentially(0);
  }

  public drawWinLinesOnceFromSpinData(spinData: SpinData): void {
    this.stopLooping();
    this.clearLines();

    if (!spinData.slot.paylines || spinData.slot.paylines.length === 0) {
      console.log('[WinLineDrawer] No paylines to draw lines for (once)');
      if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
        this.symbolsReference.hideWinningOverlay();
      }
      this.scene.time.delayedCall(50, () => {
        console.log('[WinLineDrawer] Emitting WIN_STOP for no-wins scenario');
        gameEventManager.emit(GameEventType.WIN_STOP);
      });
      return;
    }

    this.currentWinPatterns = this.convertPaylinesToWinPatterns(spinData);
    try {
      const numLines = Math.max(1, this.currentWinPatterns.length);
      const isTurbo = !!(((this.scene as any)?.gameData?.isTurbo) || gameStateManager.isTurbo);
      const totalBudget = isTurbo ? 900 : 1800;
      const endPause = Math.min(200, Math.floor(totalBudget * 0.15));
      const perLine = Math.max(40, Math.floor((totalBudget - endPause) / numLines));
      const speed = isTurbo ? 2.0 : 1.5;

      this.minLineDisplayTime = perLine;
      this.minCycleEndPause = endPause;
      this.lineDisplayTime = perLine;
      this.cycleEndPause = endPause;
      this.animationSpeed = speed;
      console.log(`[WinLineDrawer] Dynamic timing applied: lines=${numLines}, turbo=${isTurbo}, perLine=${perLine}ms, endPause=${endPause}ms, speed=${speed}x`);
    } catch {}
    this.isLooping = false;
    this.wasInterruptedByManualSpin = false;

    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns stored, emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    console.log('[WinLineDrawer] Emitting WIN_START for winline animations');
    gameEventManager.emit(GameEventType.WIN_START);

    this.drawWinLinesSequentiallyOnce(0);
  }

  private drawWinLinesSequentiallyOnce(currentIndex: number): void {
    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns to draw, emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    if (currentIndex === 0) {
      this.clearLines();
    }

    const [winlineIndex, winningGrids] = this.currentWinPatterns[currentIndex];

    try {
      const payline = this.currentPaylinesByKey.get(winlineIndex) || null;
      const tracker = (this.scene as any).winTracker;
      if (tracker && typeof tracker.showForPayline === 'function') {
        tracker.showForPayline(payline);
      }
    } catch {}

    const completeWinlineGrids = this.getCompleteWinlineGrids(winlineIndex);

    this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
      const nextIndex = currentIndex + 1;

      if (nextIndex < this.currentWinPatterns.length) {
        this.loopTimer = this.scene.time.delayedCall(this.lineDisplayTime, () => {
          this.clearLines();
          this.drawWinLinesSequentiallyOnce(nextIndex);
        });
      } else {
        this.loopTimer = this.scene.time.delayedCall(this.cycleEndPause, () => {
          const isNormalAutoplay = gameStateManager.isAutoPlaying;
          const isFreeSpinAutoplay = this.symbolsReference && (this.symbolsReference as any).freeSpinAutoplayActive;
          const isAnyAutoplay = isNormalAutoplay || isFreeSpinAutoplay;

          if (isAnyAutoplay) {
            this.scene.time.delayedCall(300, () => {
              this.clearLines();
              if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
                this.symbolsReference.hideWinningOverlay();
              }
              console.log('[WinLineDrawer] Cleared win lines and overlay (autoplay) after extra delay');
            });
          } else {
            console.log('[WinLineDrawer] Preserving win lines and overlay (manual spin)');
          }
          gameEventManager.emit(GameEventType.REELS_STOP);
          gameEventManager.emit(GameEventType.WIN_STOP);
        });
      }
    });
  }

  private drawWinLinesSequentially(currentIndex: number): void {
    if (!this.isLooping || this.currentWinPatterns.length === 0) {
      return;
    }

    this.clearLines();

    const [winlineIndex, winningGrids] = this.currentWinPatterns[currentIndex];

    try {
      const payline = this.currentPaylinesByKey.get(winlineIndex) || null;
      const tracker = (this.scene as any).winTracker;
      if (tracker && typeof tracker.showForPayline === 'function') {
        tracker.showForPayline(payline);
      }
    } catch {}

    const completeWinlineGrids = this.getCompleteWinlineGrids(winlineIndex);

    this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
      const nextIndex = (currentIndex + 1) % this.currentWinPatterns.length;
      const isEndOfCycle = nextIndex === 0;
      const displayTime = isEndOfCycle ? this.cycleEndPause : this.lineDisplayTime;

      if (isEndOfCycle) {
        console.log('[WinLineDrawer] Completed full cycle, will restart loop');
      }

      this.loopTimer = this.scene.time.delayedCall(displayTime, () => {
        if (isEndOfCycle && !this.hasEmittedFirstLoopWinStop) {
          console.log('[WinLineDrawer] First loop completed - emitting REELS_STOP and WIN_STOP before continuing to loop');
          this.hasEmittedFirstLoopWinStop = true;
          gameEventManager.emit(GameEventType.REELS_STOP);
          gameEventManager.emit(GameEventType.WIN_STOP);
        }
        if (this.isLooping) {
          this.drawWinLinesSequentially(nextIndex);
        }
      });
    });
  }

  private drawWinLineWithCallbackAndBrightness(completeGrids: Grid[], winningGrids: Grid[], winlineIndex: number, onComplete: () => void): void {
    if (completeGrids.length < 2) {
      onComplete();
      return;
    }

    try {
      const ref: any = this.symbolsReference;
      if (ref && typeof ref.pulseWinningSymbols === 'function') {
        ref.pulseWinningSymbols(winningGrids);
      }
    } catch {}

    const neonColors = [
      0x00FF41,
      0xFF0080,
      0x00BFFF,
      0xFFFF00,
      0xFF4500,
      0x8A2BE2,
      0x00FFFF,
      0xFF1493,
      0x32CD32,
      0xFF6347,
      0x9370DB,
      0x00FA9A,
      0xFF69B4,
      0x1E90FF,
      0xFFD700,
      0xDA70D6,
      0x7FFF00,
      0xFF4500,
      0x40E0D0,
      0xEE82EE
    ];

    const lineColor = neonColors[winlineIndex % neonColors.length];

    const winningPositions = new Set<string>();
    for (const grid of winningGrids) {
      winningPositions.add(`${grid.x},${grid.y}`);
    }

    const allSymbolsWinning = completeGrids.every(grid =>
      winningPositions.has(`${grid.x},${grid.y}`)
    );

    const pathPoints: { x: number, y: number, isWinning: boolean }[] = [];
    const extensionLength = 50;

    const symbolPositions: { x: number, y: number, isWinning: boolean }[] = [];
    for (let i = 0; i < completeGrids.length; i++) {
      const grid = completeGrids[i];
      const pos = this.getSymbolCenterPosition(grid.x, grid.y);
      const isWinning = allSymbolsWinning || winningPositions.has(`${grid.x},${grid.y}`);
      symbolPositions.push({ ...pos, isWinning });
    }

    let leftmostIndex = 0;
    let rightmostIndex = 0;

    for (let i = 1; i < symbolPositions.length; i++) {
      if (symbolPositions[i].x < symbolPositions[leftmostIndex].x) {
        leftmostIndex = i;
      }
      if (symbolPositions[i].x > symbolPositions[rightmostIndex].x) {
        rightmostIndex = i;
      }
    }

    const screenCenterX = this.scene.scale.width * 0.5;
    const leftmostPos = symbolPositions[leftmostIndex];
    const rightmostPos = symbolPositions[rightmostIndex];
    const centerX = (leftmostPos.x + rightmostPos.x) / 2;
    const span = rightmostPos.x - leftmostPos.x;

    const leftExtensionX = screenCenterX - (span / 2) - extensionLength;
    const rightExtensionX = screenCenterX + (span / 2) + extensionLength;

    for (let i = 0; i < symbolPositions.length; i++) {
      const pos = symbolPositions[i];

      if (i === leftmostIndex) {
        pathPoints.push({ x: leftExtensionX, y: pos.y, isWinning: allSymbolsWinning });
      }

      pathPoints.push(pos);

      if (i === rightmostIndex) {
        pathPoints.push({ x: rightExtensionX, y: pos.y, isWinning: allSymbolsWinning });
      }
    }

    try {
      const sceneAny: any = this.scene as any;
      const audio = sceneAny?.audioManager || (window as any)?.audioManager;
      const shouldPlay = (!this.isLooping) || (this.isLooping && !this.hasEmittedFirstLoopWinStop);
      if (shouldPlay && audio && typeof audio.playRandomWinlineSfx === 'function') {
        audio.playRandomWinlineSfx();
      }
    } catch {}

    this.createBubbleLine(pathPoints, winlineIndex, onComplete);
  }

  private createBubbleLine(
    pathPoints: { x: number; y: number; isWinning?: boolean }[],
    _winlineIndex: number,
    onComplete: () => void
  ): void {
    if (!pathPoints || pathPoints.length < 2) {
      onComplete();
      return;
    }

    const lineContainer = this.scene.add.container(0, 0);
    this.container.add(lineContainer);
    this.lines.push(lineContainer);

    const segmentLengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(len);
      totalLength += len;
    }

    if (totalLength <= 0) {
      onComplete();
      return;
    }

    const pixelsPerSecond = 800;
    const baseDuration = Math.max(400, (totalLength / pixelsPerSecond) * 1000);
    const totalDuration = baseDuration / this.animationSpeed;

    const baseSpacing = 22;
    const density = this.bubbleDensityMultiplier || 1.0;
    const rawSpacing = baseSpacing / density;
    const spacing = Math.max(8, Math.min(60, rawSpacing));
    const baseMaxBubbles = 80;
    const maxBubbles = Math.max(1, Math.floor(baseMaxBubbles * Math.min(density, 3)));

    const bubblePositions: { x: number; y: number; isWinning: boolean }[] = [];
    let distanceAlong = 0;
    let guard = 0;
    while (distanceAlong <= totalLength && guard++ < maxBubbles) {
      let remaining = distanceAlong;
      let segIndex = 0;
      while (segIndex < segmentLengths.length && remaining > segmentLengths[segIndex]) {
        remaining -= segmentLengths[segIndex];
        segIndex++;
      }
      if (segIndex >= segmentLengths.length) {
        break;
      }
      const segLen = segmentLengths[segIndex] || 1;
      const t = Math.max(0, Math.min(1, remaining / segLen));
      const start = pathPoints[segIndex];
      const end = pathPoints[segIndex + 1];
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const isWinning = !!(start.isWinning || end.isWinning);
      bubblePositions.push({ x, y, isWinning });
      distanceAlong += spacing;
    }

    const lastPoint = pathPoints[pathPoints.length - 1];
    if (
      bubblePositions.length === 0 ||
      Math.hypot(
        bubblePositions[bubblePositions.length - 1].x - lastPoint.x,
        bubblePositions[bubblePositions.length - 1].y - lastPoint.y
      ) > spacing * 0.5
    ) {
      bubblePositions.push({ x: lastPoint.x, y: lastPoint.y, isWinning: !!lastPoint.isWinning });
    }

    if (bubblePositions.length === 0) {
      onComplete();
      return;
    }

    const hasBubbleTexture = this.scene.textures.exists('bubble');
    const hasWinlineBubble1 = this.scene.textures.exists('winline-bubble-1');
    const hasWinlineBubble2 = this.scene.textures.exists('winline-bubble-2');
    const winlineBubbleKeys: string[] = [];
    if (hasWinlineBubble1) {
      winlineBubbleKeys.push('winline-bubble-1');
    }
    if (hasWinlineBubble2) {
      winlineBubbleKeys.push('winline-bubble-2');
    }
    const bubbleImageScale = 0.005;

    const baseRadiusMin = 0.5;
    const baseRadiusMax = 3;
    const randomness = this.bubbleScaleRandomness || 1.0;
    const midRadius = (baseRadiusMin + baseRadiusMax) * 0.5;
    const halfRange = (baseRadiusMax - baseRadiusMin) * 0.5 * randomness;
    const radiusMin = Math.max(0.1, midRadius - halfRange);
    const radiusMax = midRadius + halfRange;

    const perBubbleDelay = bubblePositions.length > 1 ? totalDuration / (bubblePositions.length - 1) : 0;
    const appearDuration = Math.max(120, totalDuration * 0.25);
    const lastBubbleIndex = bubblePositions.length - 1;

    bubblePositions.forEach((pos, index) => {
      let bubble: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (winlineBubbleKeys.length > 0) {
        const keyIndex = Math.floor(Math.random() * winlineBubbleKeys.length);
        const textureKey = winlineBubbleKeys[keyIndex];
        const img = this.scene.add.image(pos.x, pos.y, textureKey);
        img.setOrigin(0.5, 0.5);
        bubble = img;
      } else if (hasBubbleTexture) {
        const img = this.scene.add.image(pos.x, pos.y, 'bubble');
        img.setOrigin(0.5, 0.5);
        bubble = img;
      } else {
        const g = this.scene.add.graphics();
        const baseFillAlpha = 0.8;
        const fillAlpha = Math.max(0, Math.min(1, baseFillAlpha * (this.bubbleAlphaMultiplier || 1.0)));
        g.fillStyle(0xffffff, fillAlpha);
        g.fillCircle(pos.x, pos.y, 4);
        bubble = g;
      }
      lineContainer.add(bubble);

      (bubble as any).alpha = 0;
      if ((bubble as any).setScale) {
        (bubble as any).setScale(0);
      }

      const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      const radiusFactor = radius / Math.max(1, radiusMin);
      const finalScale = bubbleImageScale * radiusFactor;
      const baseAlpha = pos.isWinning ? 0.9 : 0.7;
      const finalAlpha = Math.max(0, Math.min(1, baseAlpha * (this.bubbleAlphaMultiplier || 1.0)));

      const wobbleAmount = this.bubbleWobbleAmount || 1.0;
      const baseWobbleMin = 3;
      const baseWobbleRange = 4;
      const wobbleX = (baseWobbleMin + Math.random() * baseWobbleRange) * wobbleAmount;
      const wobbleY = (baseWobbleMin + Math.random() * baseWobbleRange) * wobbleAmount;

      const wobbleSpeed = this.bubbleWobbleSpeed || 1.0;
      const baseDurationMin = 700;
      const baseDurationRange = 500;
      const wobbleDuration = (baseDurationMin + Math.random() * baseDurationRange) / wobbleSpeed;

      this.scene.tweens.add({
        targets: bubble,
        alpha: finalAlpha,
        scaleX: finalScale,
        scaleY: finalScale,
        duration: appearDuration,
        delay: index * perBubbleDelay,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          try {
            const baseX = (bubble as any).x;
            const baseY = (bubble as any).y;
            this.scene.tweens.add({
              targets: bubble,
              x: { from: baseX - wobbleX, to: baseX + wobbleX },
              y: { from: baseY - wobbleY, to: baseY + wobbleY },
              duration: wobbleDuration,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          } catch {}

          if (index === lastBubbleIndex) {
            onComplete();
          }
        }
      });
    });
  }

  private getSymbolCenterPosition(gridX: number, gridY: number): { x: number; y: number } {
    const ref: any = this.symbolsReference || {};
    const displayWidth = ref.displayWidth || 68;
    const displayHeight = ref.displayHeight || 68;
    const horizontalSpacing = ref.horizontalSpacing || 10;
    const verticalSpacing = ref.verticalSpacing || 5;

    const symbolTotalWidth = displayWidth + horizontalSpacing;
    const symbolTotalHeight = displayHeight + verticalSpacing;

    const totalGridWidth = ref.totalGridWidth || symbolTotalWidth * 5;
    const totalGridHeight = ref.totalGridHeight || symbolTotalHeight * 3;
    const slotX = ref.slotX || this.scene.scale.width * 0.5;
    const slotY = ref.slotY || this.scene.scale.height * 0.5;

    const startX = slotX - totalGridWidth * 0.5;
    const startY = slotY - totalGridHeight * 0.5;

    const x = startX + gridX * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = startY + gridY * symbolTotalHeight + symbolTotalHeight * 0.5;

    return { x, y };
  }

  private convertPaylinesToWinPatterns(spinData: SpinData): [number, Grid[]][] {
    const winPatterns: [number, Grid[]][] = [];
    this.currentPaylinesByKey.clear();

    for (const payline of spinData.slot.paylines) {
      const resolvedLineKey = this.resolveBestWinlineIndex(spinData, payline);
      const winningGrids = this.getWinningGridsForResolvedWinline(spinData, payline, resolvedLineKey);
      this.currentPaylinesByKey.set(resolvedLineKey, payline);
      if (winningGrids.length > 0) {
        winPatterns.push([resolvedLineKey, winningGrids]);
      }
    }

    return winPatterns;
  }

  private resolveBestWinlineIndex(spinData: SpinData, payline: PaylineData): number {
    const desired = typeof payline.lineKey === 'number' ? payline.lineKey : 0;
    const count = Number(payline.count) || 0;
    const targetSymbol = Number(payline.symbol);

    let bestIndex = (desired >= 0 && desired < WINLINES.length) ? desired : 0;
    let bestLen = -1;
    let bestExact = false;

    for (let i = 0; i < WINLINES.length; i++) {
      const streak = this.computeStreakForWinline(spinData, i, targetSymbol, count);
      const len = streak.length;
      const exact = count > 0 && len === count;
      if (exact && !bestExact) {
        bestExact = true;
        bestLen = len;
        bestIndex = i;
        continue;
      }
      if (bestExact && exact) {
        if (Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
          bestLen = len;
          bestIndex = i;
        }
        continue;
      }
      if (!bestExact) {
        if (len > bestLen) {
          bestLen = len;
          bestIndex = i;
        } else if (len === bestLen && Math.abs(i - desired) < Math.abs(bestIndex - desired)) {
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  private getWinningGridsForResolvedWinline(spinData: SpinData, payline: PaylineData, resolvedLineKey: number): Grid[] {
    const count = payline.count;
    const targetSymbol = payline.symbol;
    return this.computeStreakForWinline(spinData, resolvedLineKey, targetSymbol, count);
  }

  private computeStreakForWinline(spinData: SpinData, lineKey: number, targetSymbol: number, count: number): Grid[] {
    if (lineKey < 0 || lineKey >= WINLINES.length) {
      return [];
    }

    const winline = WINLINES[lineKey];
    const winlinePositions: { x: number; y: number }[] = [];
    for (let x = 0; x < winline.length; x++) {
      for (let y = 0; y < winline[x].length; y++) {
        if (winline[x][y] === 1) {
          winlinePositions.push({ x, y });
        }
      }
    }

    winlinePositions.sort((a, b) => a.x - b.x);

    const streak: Grid[] = [];
    for (const pos of winlinePositions) {
      const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];

      if (symbolAtPosition === targetSymbol) {
        streak.push({ x: pos.x, y: pos.y, symbol: symbolAtPosition });
        if (count > 0 && streak.length === count) {
          break;
        }
      } else if (streak.length > 0) {
        break;
      }
    }

    return streak;
  }

  private getCompleteWinlineGrids(winlineIndex: number): Grid[] {
    if (winlineIndex < 0 || winlineIndex >= WINLINES.length) {
      console.warn(`[WinLineDrawer] Invalid winline index: ${winlineIndex}`);
      return [];
    }

    const winline = WINLINES[winlineIndex];
    const completeGrids: Grid[] = [];

    for (let x = 0; x < winline.length; x++) {
      for (let y = 0; y < winline[x].length; y++) {
        if (winline[x][y] === 1) {
          completeGrids.push({ x, y, symbol: 0 });
        }
      }
    }

    return completeGrids;
  }

  public stopLooping(): void {
    this.isLooping = false;
    if (this.loopTimer) {
      this.loopTimer.remove();
      this.loopTimer = undefined;
    }
  }

  public clearLines(): void {
    try {
      const ref: any = this.symbolsReference;
      if (ref && typeof ref.pulseWinningSymbols === 'function') {
        ref.pulseWinningSymbols([]);
      }
    } catch {}
    this.lines.forEach(line => {
      try { this.scene.tweens.killTweensOf(line); } catch {}
      try {
        (line as any).destroy(true);
      } catch {
        try { (line as any).destroy(); } catch {}
      }
    });
    this.lines = [];
  }

  public hasActiveLines(): boolean {
    return this.lines.length > 0 || this.currentWinPatterns.length > 0;
  }

  private animateSingleLine(line: Phaser.GameObjects.GameObject): void {
  }

  public animateLines(): void {
    this.lines.forEach((line, index) => {
      setTimeout(() => {
        this.animateSingleLine(line);
      }, index * 150);
    });
  }

  public fadeOutLines(duration: number = 1000): Promise<void> {
    this.stopLooping();
    
    return new Promise((resolve) => {
      if (this.lines.length === 0) {
        resolve();
        return;
      }

      let completedTweens = 0;
      const totalTweens = this.lines.length;

      this.lines.forEach((line, index) => {
        this.scene.tweens.killTweensOf(line);
        
        this.scene.tweens.add({
          targets: line,
          alpha: 0,
          duration: duration,
          delay: index * 100,
          ease: 'Power2',
          onComplete: () => {
            completedTweens++;
            if (completedTweens === totalTweens) {
              this.clearLines();
              resolve();
            }
          }
        });
      });
    });
  }

  public setTimingIntervals(options: {
    lineDisplayTime?: number;
    cycleEndPause?: number;
    animationSpeed?: number;
  }): void {
    if (options.lineDisplayTime !== undefined) {
      this.lineDisplayTime = Math.max(500, options.lineDisplayTime);
    }
    if (options.cycleEndPause !== undefined) {
      this.cycleEndPause = Math.max(800, options.cycleEndPause);
    }
    if (options.animationSpeed !== undefined) {
      this.animationSpeed = Math.max(0.1, Math.min(3.0, options.animationSpeed));
    }
    
  }

  public getTimingIntervals(): { lineDisplayTime: number, cycleEndPause: number, animationSpeed: number } {
    return {
      lineDisplayTime: this.lineDisplayTime,
      cycleEndPause: this.cycleEndPause,
      animationSpeed: this.animationSpeed
    };
  }

  public setTimingPreset(preset: 'fast' | 'normal' | 'slow' | 'showcase'): void {
    switch (preset) {
      case 'fast':
        this.setTimingIntervals({
          lineDisplayTime: 1000,
          cycleEndPause: 1500,
          animationSpeed: 1.5
        });
        break;
      case 'normal':
        this.setTimingIntervals({
          lineDisplayTime: 1800,
          cycleEndPause: 2500,
          animationSpeed: 1.0
        });
        break;
      case 'slow':
        this.setTimingIntervals({
          lineDisplayTime: 3000,
          cycleEndPause: 4000,
          animationSpeed: 0.7
        });
        break;
      case 'showcase':
        this.setTimingIntervals({
          lineDisplayTime: 4000,
          cycleEndPause: 5000,
          animationSpeed: 0.5
        });
        break;
    }
  }

  public setTurboMode(isEnabled: boolean): void {
    if (isEnabled) {
      if (!this.turboApplied) {
        this.originalLineDisplayTime = this.lineDisplayTime;
        this.originalCycleEndPause = this.cycleEndPause;
        this.originalAnimationSpeed = this.animationSpeed;
        
        this.setTimingIntervals({
          lineDisplayTime: Math.max(this.minLineDisplayTime, this.lineDisplayTime * TurboConfig.TURBO_DURATION_MULTIPLIER),
          cycleEndPause: Math.max(this.minCycleEndPause, this.cycleEndPause * TurboConfig.TURBO_DURATION_MULTIPLIER),
          animationSpeed: this.animationSpeed * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
        });
        this.turboApplied = true;
      }
    } else {
      if (this.turboApplied && this.originalLineDisplayTime !== undefined && this.originalCycleEndPause !== undefined && this.originalAnimationSpeed !== undefined) {
        this.setTimingIntervals({
          lineDisplayTime: Math.max(this.minLineDisplayTime, this.originalLineDisplayTime),
          cycleEndPause: Math.max(this.minCycleEndPause, this.originalCycleEndPause),
          animationSpeed: this.originalAnimationSpeed
        });
        this.originalLineDisplayTime = undefined;
        this.originalCycleEndPause = undefined;
        this.originalAnimationSpeed = undefined;
        this.turboApplied = false;
      } else {
      }
    }
  }

  public resetToDefaultTiming(): void {
    this.lineDisplayTime = 1200;
    this.cycleEndPause = 1000;
    this.animationSpeed = 1.5;
    
    this.originalLineDisplayTime = undefined;
    this.originalCycleEndPause = undefined;
    this.originalAnimationSpeed = undefined;
    this.turboApplied = false;
  }

  public hasFirstLoopCompleted(): boolean {
    return this.hasEmittedFirstLoopWinStop;
  }

  public wasInterruptedBySpin(): boolean {
    return this.wasInterruptedByManualSpin;
  }

  public resetInterruptedFlag(): void {
    this.wasInterruptedByManualSpin = false;
  }

  public forceEmitWinStopIfNeeded(): void {
    if (!this.hasEmittedFirstLoopWinStop && this.isLooping) {
      console.log('[WinLineDrawer] First loop not completed - forcing WIN_STOP emission');
      this.hasEmittedFirstLoopWinStop = true;
      this.wasInterruptedByManualSpin = true;
      
      this.stopLooping();
      
      this.clearLines();
      
      if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
        this.symbolsReference.hideWinningOverlay();
      }
      
      gameEventManager.emit(GameEventType.REELS_STOP);
      gameEventManager.emit(GameEventType.WIN_STOP);
    }
  }

  public destroy(): void {
    this.stopLooping();
    this.clearLines();
    this.container.destroy();
  }
}