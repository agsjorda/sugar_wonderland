import { Game } from '../scenes/Game';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SpinData, PaylineData } from '../../backend/SpinData';
import { SCATTER_SYMBOL, WINLINES } from '../../config/GameConfig';

interface Grid {
  x: number;
  y: number;
  symbol: number;
}

export class WinLineDrawer {
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.GameObject[] = [];
  private tearingLines: Phaser.GameObjects.GameObject[] = [];
  private activeTearAway?: Promise<void>;

  private symbolsReference: any;
  private currentWinPatterns: [number, Grid[]][] = [];
  private currentPaylinesByKey: Map<number, PaylineData> = new Map();
  private currentCompleteGridsByKey: Map<number, Grid[]> = new Map();
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
  private cycleEndPause: number = 110;
  private animationSpeed: number = 1.3;
  private tapeHeightMultiplier: number = 0.3;

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
    this.container.setDepth(879);
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

  public setTapeHeightMultiplier(multiplier: number): void {
    this.tapeHeightMultiplier = Math.max(0.25, Math.min(1.0, multiplier));
  }

  public drawWinLinesFromSpinData(spinData: SpinData): void {
    this.stopLooping();
    this.clearLines();

    if (!spinData.slot.paylines || spinData.slot.paylines.length === 0) {
      console.log('[WinLineDrawer] No paylines to draw lines for');
      return;
    }

    this.currentWinPatterns = this.convertPaylinesToWinPatterns(spinData);
    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns stored (looping), emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }
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
      const speed = isTurbo ? 1.6 : 1.25;

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

    if (currentIndex === 0 && (this.lines.length + this.tearingLines.length) > 0) {
      void this.tearAwayLines().then(() => {
        this.drawWinLinesSequentiallyOnce(currentIndex);
      });
      return;
    }

    const [winlineIndex, winningGrids] = this.currentWinPatterns[currentIndex];

    try {
      const payline = this.currentPaylinesByKey.get(winlineIndex) || null;
      const tracker = (this.scene as any).winTracker;
      if (tracker && typeof tracker.showForPayline === 'function') {
        tracker.showForPayline(payline);
      }
      try {
        if (payline) {
          (this.scene as any)?.events?.emit?.('winline-shown', payline);
        }
      } catch {}
    } catch {}

    const completeWinlineGrids = this.currentCompleteGridsByKey.get(winlineIndex) || this.getCompleteWinlineGrids(winlineIndex);

    this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
      const nextIndex = currentIndex + 1;

      if (nextIndex < this.currentWinPatterns.length) {
        this.loopTimer = this.scene.time.delayedCall(this.lineDisplayTime, () => {
          void this.tearAwayLines().then(() => {
            this.drawWinLinesSequentiallyOnce(nextIndex);
          });
        });
      } else {
        this.loopTimer = this.scene.time.delayedCall(this.cycleEndPause, () => {
          const isNormalAutoplay = gameStateManager.isAutoPlaying;
          const isFreeSpinAutoplay = this.symbolsReference && (this.symbolsReference as any).freeSpinAutoplayActive;
          const isAnyAutoplay = isNormalAutoplay || isFreeSpinAutoplay;

          if (isAnyAutoplay) {
            this.scene.time.delayedCall(300, () => {
              void this.tearAwayLines();
              if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
                this.symbolsReference.hideWinningOverlay();
              }
              console.log('[WinLineDrawer] Cleared win lines and overlay (autoplay) after extra delay');
            });
          } else {
            console.log('[WinLineDrawer] Preserving win lines and overlay (manual spin)');
          }
          gameEventManager.emit(GameEventType.WIN_STOP);
        });
      }
    });
  }

  private drawWinLinesSequentially(currentIndex: number): void {
    if (!this.isLooping || this.currentWinPatterns.length === 0) {
      return;
    }

    void this.tearAwayLines().then(() => {
      if (!this.isLooping || this.currentWinPatterns.length === 0) {
        return;
      }

      const [winlineIndex, winningGrids] = this.currentWinPatterns[currentIndex];

      try {
        const payline = this.currentPaylinesByKey.get(winlineIndex) || null;
        const tracker = (this.scene as any).winTracker;
        if (tracker && typeof tracker.showForPayline === 'function') {
          tracker.showForPayline(payline);
        }
        try {
          if (!this.hasEmittedFirstLoopWinStop && payline) {
            (this.scene as any)?.events?.emit?.('winline-shown', payline);
          }
        } catch {}
      } catch {}

      const completeWinlineGrids = this.currentCompleteGridsByKey.get(winlineIndex) || this.getCompleteWinlineGrids(winlineIndex);

      this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
        const nextIndex = (currentIndex + 1) % this.currentWinPatterns.length;
        const isEndOfCycle = nextIndex === 0;
        const displayTime = isEndOfCycle ? this.cycleEndPause : this.lineDisplayTime;

        if (isEndOfCycle) {
          console.log('[WinLineDrawer] Completed full cycle, will restart loop');
        }

        this.loopTimer = this.scene.time.delayedCall(displayTime, () => {
          if (isEndOfCycle && !this.hasEmittedFirstLoopWinStop) {
            console.log('[WinLineDrawer] First loop completed - emitting WIN_STOP before continuing to loop');
            this.hasEmittedFirstLoopWinStop = true;
            gameEventManager.emit(GameEventType.WIN_STOP);
          }
          if (this.isLooping) {
            this.drawWinLinesSequentially(nextIndex);
          }
        });
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
    void lineColor;

    const winningPositions = new Set<string>();
    for (const grid of winningGrids) {
      winningPositions.add(`${grid.x},${grid.y}`);
    }

    const allSymbolsWinning = completeGrids.every(grid =>
      winningPositions.has(`${grid.x},${grid.y}`)
    );

    const pathPoints: { x: number, y: number, isWinning: boolean }[] = [];
    const extensionPadding = 160;

    const symbolPositions: { x: number, y: number, isWinning: boolean }[] = [];
    for (let i = 0; i < completeGrids.length; i++) {
      const grid = completeGrids[i];
      const pos = this.getSymbolCenterPosition(grid.x, grid.y);
      const isWinning = allSymbolsWinning || winningPositions.has(`${grid.x},${grid.y}`);
      symbolPositions.push({ ...pos, isWinning });
    }

    const ordered = symbolPositions.slice().sort((a, b) => a.x - b.x);
    const first = ordered[0];
    const second = ordered[1];
    const last = ordered[ordered.length - 1];
    const prevLast = ordered[ordered.length - 2];

    const screenCenterX = this.scene.scale.width * 0.5;
    const span = last.x - first.x;
    let leftExtensionX = screenCenterX - (span / 2) - extensionPadding;
    let rightExtensionX = screenCenterX + (span / 2) + extensionPadding;
    leftExtensionX = Math.min(leftExtensionX, -extensionPadding);
    rightExtensionX = Math.max(rightExtensionX, this.scene.scale.width + extensionPadding);

    pathPoints.push({
      x: leftExtensionX,
      y: first.y,
      isWinning: allSymbolsWinning
    });
    for (const pos of ordered) {
      pathPoints.push(pos);
    }
    pathPoints.push({
      x: rightExtensionX,
      y: last.y,
      isWinning: allSymbolsWinning
    });

    try {
      const sceneAny: any = this.scene as any;
      const audio = sceneAny?.audioManager || (window as any)?.audioManager;
      const shouldPlay = (!this.isLooping) || (this.isLooping && !this.hasEmittedFirstLoopWinStop);
      if (shouldPlay && audio && typeof audio.playRandomWinlineSfx === 'function') {
        audio.playRandomWinlineSfx();
      }
    } catch {}

    this.createDangerTapePathLine(pathPoints, onComplete);
  }

  private ensureCautionTapeTexture(): { key: string; srcW: number; srcH: number } {
    const key = 'winline-danger-tape';
    const srcW = 520;
    const srcH = 64;
    try {
      if (this.scene.textures.exists(key)) {
        const tex: any = this.scene.textures.get(key);
        const src: any = tex?.getSourceImage?.(0) ?? tex?.source?.[0]?.image ?? null;
        const w = Math.max(0, Number(src?.width) || 0);
        const h = Math.max(0, Number(src?.height) || 0);
        if ((w || srcW) === srcW && (h || srcH) === srcH) {
          return { key, srcW, srcH };
        }
        try { this.scene.textures.remove(key); } catch {}
      }
    } catch {}
    try {
      const canvasTex = this.scene.textures.createCanvas(key, srcW, srcH);
      if (!canvasTex) {
        return { key, srcW, srcH };
      }
      const canvas = canvasTex.getCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        canvasTex.refresh();
        return { key, srcW, srcH };
      }

      ctx.clearRect(0, 0, srcW, srcH);
      ctx.fillStyle = '#FFD400';
      ctx.fillRect(0, 0, srcW, srcH);

      const bandH = 14;
      const stripeW = 10;
      const gap = 10;
      const period = stripeW + gap;
      const drawDiagonalStripes = (y: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, srcW, bandH);
        ctx.clip();
        ctx.fillStyle = '#000000';

        for (let yy = 0; yy < bandH; yy++) {
          const yAbs = (Math.floor(y) + yy);
          for (let t = -srcH; t < srcW + srcH; t += period) {
            const startX = t - yAbs;
            const sx = Math.max(0, startX);
            const ex = Math.min(srcW, startX + stripeW);
            if (ex > sx) {
              ctx.fillRect(sx, yAbs, ex - sx, 1);
            }
          }
        }

        ctx.restore();
      };

      drawDiagonalStripes(0);
      drawDiagonalStripes(srcH - bandH);

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, bandH, srcW, 2);
      ctx.fillRect(0, srcH - bandH - 2, srcW, 2);

      ctx.font = 'bold 26px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      const label = 'DANGER';
      const metrics = ctx.measureText(label);
      const minStep = Math.max(140, Math.ceil(metrics.width + 80));
      const maxCount = Math.max(1, Math.floor(srcW / minStep));
      let count = maxCount;
      while (count > 1 && (srcW % count) !== 0) {
        count--;
      }
      const step = Math.max(1, Math.floor(srcW / count));
      const pad = Math.max(0, Math.floor((step - metrics.width) * 0.5));
      const textY = Math.floor(srcH * 0.5) + 2;
      for (let i = 0; i < count; i++) {
        ctx.fillText(label, i * step + pad, textY);
      }

      canvasTex.refresh();
    } catch {
      try {
        const canvasTex = this.scene.textures.createCanvas(key, 2, 2);
        if (canvasTex) {
          canvasTex.refresh();
        }
      } catch {}
      return { key, srcW: 2, srcH: 2 };
    }

    return { key, srcW, srcH };
  }

  private computeExtensionToExitScreen(x: number, y: number, dirX: number, dirY: number, padding: number): number {
    const w = Number(this.scene.scale.width) || 0;
    const h = Number(this.scene.scale.height) || 0;
    const eps = 1e-6;
    const ts: number[] = [];

    if (Math.abs(dirX) > eps) {
      const tx = dirX > 0 ? ((w + padding) - x) / dirX : ((-padding) - x) / dirX;
      if (isFinite(tx) && tx > 0) ts.push(tx);
    }
    if (Math.abs(dirY) > eps) {
      const ty = dirY > 0 ? ((h + padding) - y) / dirY : ((-padding) - y) / dirY;
      if (isFinite(ty) && ty > 0) ts.push(ty);
    }

    if (ts.length === 0) {
      return Math.max(0, padding);
    }

    const t = Math.min(...ts);
    return Math.max(padding, t);
  }

  private createDangerTapePathLine(
    pathPoints: { x: number; y: number; isWinning?: boolean }[],
    onComplete: () => void
  ): void {
    if (!pathPoints || pathPoints.length < 2) {
      onComplete();
      return;
    }

    const lineContainer = this.scene.add.container(0, 0);
    this.container.add(lineContainer);
    this.lines.push(lineContainer);

    let destroyed = false;
    try {
      (lineContainer as any).once?.('destroy', () => {
        destroyed = true;
      });
    } catch {}

    const texInfo = this.ensureCautionTapeTexture();
    const texKey = texInfo.key;
    const srcW = texInfo.srcW;
    const srcH = texInfo.srcH;

    const ref: any = this.symbolsReference || {};
    const displayHeight = Number(ref.displayHeight || 68);
    const targetHeight = Math.max(12, Math.floor(displayHeight * this.tapeHeightMultiplier));
    const scale = targetHeight / srcH;
    const fullPieceLen = srcW * scale;

    const overlapWorld = Math.max(6, targetHeight * 0.75);
    const overlapSrc = overlapWorld / (scale || 1);
    const joinStripWorld = Math.max(overlapWorld * 2, targetHeight * 1.4);
    const joinStripSrc = joinStripWorld / (scale || 1);
    const joinCapWorld = Math.max(overlapWorld * 1.4, targetHeight * 1.1);
    const joinCapSrc = joinCapWorld / (scale || 1);
    const pieceOverlapWorld = Math.min(overlapWorld, Math.max(2, targetHeight * 0.18));
    const pieceOverlapSrc = pieceOverlapWorld / (scale || 1);

    const segments: { ax: number; ay: number; len: number; angle: number }[] = [];
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.5) {
        segments.push({ ax: a.x, ay: a.y, len, angle: Math.atan2(dy, dx) });
      }
    }
    if (segments.length === 0) {
      onComplete();
      return;
    }

    const pixelsPerSecond = 1200;
    const cornerPauseMs = 100;
    let segIndex = 0;
    let segOffset = 0;
    let sourceOffsetX = 0;
    let lastJoinAddedForSeg = -1;
    let pendingCornerPauseMs = 0;

    const addJoinPatch = (fromSegIndex: number): void => {
      if (destroyed) return;
      if (fromSegIndex < 0 || fromSegIndex >= segments.length - 1) return;
      if (lastJoinAddedForSeg === fromSegIndex) return;
      lastJoinAddedForSeg = fromSegIndex;

      const a0 = segments[fromSegIndex];
      const a1 = segments[fromSegIndex + 1];
      const jx = a1.ax;
      const jy = a1.ay;

      const addStrip = (angle: number): void => {
        const sx = jx - Math.cos(angle) * (joinStripWorld * 0.5);
        const sy = jy - Math.sin(angle) * (joinStripWorld * 0.5);
        const strip = this.scene.add.tileSprite(sx, sy, joinStripSrc, srcH, texKey);
        strip.setOrigin(0, 0.5);
        strip.setRotation(angle);
        strip.setScale(scale);
        strip.tilePositionX = Math.max(0, sourceOffsetX - joinStripSrc * 0.5);
        lineContainer.add(strip);
      };

      addStrip(a0.angle);
      addStrip(a1.angle);

      const cap = this.scene.add.tileSprite(jx, jy, joinCapSrc, srcH, texKey);
      cap.setOrigin(0.5, 0.5);
      cap.setRotation(a1.angle);
      cap.setScale(scale);
      cap.tilePositionX = Math.max(0, sourceOffsetX - joinCapSrc * 0.5);
      lineContainer.add(cap);
    };

    const advanceSegment = (): void => {
      const from = segIndex;
      const prevAngle = segments[from]?.angle ?? 0;
      segIndex++;
      if (segIndex < segments.length) {
        addJoinPatch(from);
        const nextAngle = segments[segIndex]?.angle ?? prevAngle;
        const delta = Math.atan2(Math.sin(nextAngle - prevAngle), Math.cos(nextAngle - prevAngle));
        if (Math.abs(delta) > 0.01) {
          pendingCornerPauseMs = cornerPauseMs;
          segOffset = 0;
        } else {
          segOffset = -overlapWorld;
          sourceOffsetX = Math.max(0, sourceOffsetX - overlapSrc);
        }
      } else {
        segOffset = 0;
      }
    };

    const spawnNextPiece = (): void => {
      if (destroyed) {
        return;
      }

      if (pendingCornerPauseMs > 0) {
        const pause = pendingCornerPauseMs;
        pendingCornerPauseMs = 0;
        try {
          this.scene.time.delayedCall(pause, () => {
            if (destroyed) return;
            spawnNextPiece();
          });
        } catch {
          spawnNextPiece();
        }
        return;
      }

      if (segIndex >= segments.length) {
        onComplete();
        return;
      }

      const seg = segments[segIndex];
      const remainingInSeg = Math.max(0, seg.len - segOffset);
      if (remainingInSeg <= 0.5) {
        advanceSegment();
        spawnNextPiece();
        return;
      }

      const pieceLen = Math.min(fullPieceLen, remainingInSeg);
      const localWidth = Math.max(1, pieceLen / scale);
      const startX = seg.ax + Math.cos(seg.angle) * segOffset;
      const startY = seg.ay + Math.sin(seg.angle) * segOffset;

      const tape = this.scene.add.tileSprite(startX, startY, 1, srcH, texKey);
      tape.setOrigin(0, 0.5);
      tape.setRotation(seg.angle);
      tape.setScale(scale);
      tape.tilePositionX = sourceOffsetX;
      lineContainer.add(tape);

      const duration = Math.max(60, (pieceLen / pixelsPerSecond) * 1000) / this.animationSpeed;
      this.scene.tweens.add({
        targets: tape,
        width: localWidth,
        duration,
        ease: 'Linear',
        onComplete: () => {
          if (destroyed) return;
          sourceOffsetX += localWidth;
          segOffset += pieceLen;
          if (segOffset < seg.len - 0.5) {
            if (pieceLen > pieceOverlapWorld * 2) {
              segOffset = Math.max(0, segOffset - pieceOverlapWorld);
              sourceOffsetX = Math.max(0, sourceOffsetX - pieceOverlapSrc);
            }
          }
          if (segOffset >= seg.len - 0.5) {
            advanceSegment();
          }
          spawnNextPiece();
        }
      });
    };

    spawnNextPiece();
  }

  private tearAwayLines(): Promise<void> {
    if (this.activeTearAway) {
      if (this.lines.length === 0) {
        return this.activeTearAway;
      }
      return this.activeTearAway.then(() => this.tearAwayLines());
    }

    try {
      const ref: any = this.symbolsReference;
      if (ref && typeof ref.pulseWinningSymbols === 'function') {
        ref.pulseWinningSymbols([]);
      }
    } catch {}

    const toRemove = this.lines.slice();
    this.lines = [];
    this.tearingLines.push(...toRemove);
    if (toRemove.length === 0) {
      return Promise.resolve();
    }

    const p = new Promise<void>((resolve) => {
      let remainingLines = toRemove.length;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.activeTearAway = undefined;
        resolve();
      };

      const finishLine = (line: Phaser.GameObjects.GameObject): void => {
        try {
          const idx = this.tearingLines.indexOf(line);
          if (idx >= 0) this.tearingLines.splice(idx, 1);
        } catch {}
        remainingLines--;
        if (remainingLines <= 0) {
          finish();
        }
      };

      for (const line of toRemove) {
        try { this.scene.tweens.killTweensOf(line); } catch {}

        let children: any[] = [];
        try {
          const list: any = (line as any).list;
          if (Array.isArray(list)) {
            children = list.slice();
          }
        } catch {}

        if (children.length === 0) {
          try {
            (line as any).destroy(true);
          } catch {
            try { (line as any).destroy(); } catch {}
          }
          finishLine(line);
          continue;
        }

        let remainingChildren = children.length;
        const childDone = (): void => {
          remainingChildren--;
          if (remainingChildren <= 0) {
            try {
              (line as any).destroy(true);
            } catch {
              try { (line as any).destroy(); } catch {}
            }
            finishLine(line);
          }
        };

        for (const child of children) {
          try { this.scene.tweens.killTweensOf(child); } catch {}
          const baseX = Number((child as any).x) || 0;
          const baseY = Number((child as any).y) || 0;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const tx = baseX + dir * (18 + Math.random() * 32);
          const ty = baseY + (Math.random() * 28 - 14);
          const tr = (Number((child as any).rotation) || 0) + dir * (0.25 + Math.random() * 0.65);
          const delay = Math.floor(Math.random() * 100);
          const duration = 220 + Math.floor(Math.random() * 220);

          try {
            this.scene.tweens.add({
              targets: child,
              alpha: 0,
              x: tx,
              y: ty,
              rotation: tr,
              duration,
              delay,
              ease: 'Quad.easeIn',
              onComplete: () => {
                try { (child as any).destroy?.(); } catch {}
                childDone();
              }
            });
          } catch {
            try { (child as any).destroy?.(); } catch {}
            childDone();
          }
        }
      }
    });

    this.activeTearAway = p;
    return p;
  }

  public clearLines(): void {
    try {
      const ref: any = this.symbolsReference;
      if (ref && typeof ref.pulseWinningSymbols === 'function') {
        ref.pulseWinningSymbols([]);
      }
    } catch {}

    const allLines = [...this.lines, ...this.tearingLines];
    this.lines = [];
    this.tearingLines = [];

    for (const line of allLines) {
      try { this.scene.tweens.killTweensOf(line); } catch {}
      try {
        const list: any = (line as any).list;
        if (Array.isArray(list)) {
          list.forEach((child: any) => {
            try { this.scene.tweens.killTweensOf(child); } catch {}
          });
        }
      } catch {}

      try {
        (line as any).destroy(true);
      } catch {
        try { (line as any).destroy(); } catch {}
      }
    }

    this.activeTearAway = undefined;
  }

  public stopLooping(): void {
    this.isLooping = false;
    if (this.loopTimer) {
      this.loopTimer.remove();
      this.loopTimer = undefined;
    }
  }

  public hasActiveLines(): boolean {
    return (this.lines.length + this.tearingLines.length) > 0 || this.currentWinPatterns.length > 0;
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
    this.currentCompleteGridsByKey.clear();

    let syntheticKey = 1000;
    const paylines = spinData?.slot?.paylines || [];
    for (const payline of paylines) {
      const resolvedLineKey = this.resolveBestWinlineIndex(spinData, payline);
      let winningGrids = this.getWinningGridsForResolvedWinline(spinData, payline, resolvedLineKey);
      let key = resolvedLineKey;
      let completeGrids: Grid[] | null = null;

      try {
        if ((!winningGrids || winningGrids.length === 0) && Array.isArray((payline as any)?.positions)) {
          const positions: any[] = (payline as any).positions;
          if (positions.length > 0) {
            const derived: Grid[] = [];
            for (const p of positions) {
              const x = Number((p as any)?.x);
              const y = Number((p as any)?.y);
              if (!isFinite(x) || !isFinite(y)) continue;
              const sx = Math.floor(x);
              const sy = Math.floor(y);
              const sym = Number(spinData?.slot?.area?.[sx]?.[sy] ?? 0);
              derived.push({ x: sx, y: sy, symbol: isFinite(sym) ? sym : 0 });
            }
            derived.sort((a, b) => a.x - b.x);
            if (derived.length > 0) {
              winningGrids = derived;
              key = syntheticKey++;
              completeGrids = derived;
            }
          }
        }
      } catch {}

      if (!winningGrids || winningGrids.length === 0) {
        continue;
      }

      this.currentPaylinesByKey.set(key, payline);
      this.currentCompleteGridsByKey.set(key, completeGrids || this.getCompleteWinlineGrids(resolvedLineKey));
      winPatterns.push([key, winningGrids]);
    }

    return winPatterns;
  }

  private resolveBestWinlineIndex(spinData: SpinData, payline: PaylineData): number {
    const desired = typeof payline.lineKey === 'number' ? payline.lineKey : 0;
    const count = Number((payline as any)?.count) || 0;
    const targetSymbol = Number((payline as any)?.symbol);

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
    const count = Number((payline as any)?.count) || 0;
    const targetSymbol = Number((payline as any)?.symbol);
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

    const requiredMin = (Number(targetSymbol) === 1) ? 2 : 3;
    const requiredCount = Math.max(0, Number(count) || 0);
    if (requiredCount > 0 && requiredCount < requiredMin) {
      return [];
    }

    const scatterVal = Number((SCATTER_SYMBOL as any)?.[0] ?? 0);
    const collectorVal = 11;
    const matchesTarget = (sym: any): boolean => {
      const v = Number(sym);
      return v === targetSymbol || (v === collectorVal && targetSymbol !== scatterVal);
    };

    if (Number(targetSymbol) === 1) {
      let current: Grid[] = [];
      let prevX: number | null = null;
      for (let i = 0; i < winlinePositions.length; i++) {
        const pos = winlinePositions[i];
        const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];

        const contiguous = prevX === null ? true : (pos.x === prevX + 1);
        if (!contiguous) {
          current = [];
        }

        if (matchesTarget(symbolAtPosition)) {
          current.push({ x: pos.x, y: pos.y, symbol: Number(symbolAtPosition) || 0 });
          if (requiredCount >= requiredMin && current.length >= requiredCount) {
            return current.slice(0, requiredCount);
          }
        } else {
          current = [];
        }

        prevX = pos.x;
      }

      return [];
    }

    const firstPos = winlinePositions[0];
    if (!firstPos || firstPos.x !== 0) {
      return [];
    }

    const firstSymbol = spinData.slot.area?.[firstPos.x]?.[firstPos.y];
    if (!matchesTarget(firstSymbol)) {
      return [];
    }

    const streak: Grid[] = [{ x: firstPos.x, y: firstPos.y, symbol: Number(firstSymbol) || 0 }];
    for (let i = 1; i < winlinePositions.length; i++) {
      const pos = winlinePositions[i];
      const prev = winlinePositions[i - 1];

      if (pos.x !== prev.x + 1) {
        break;
      }

      const symbolAtPosition = spinData.slot.area?.[pos.x]?.[pos.y];
      if (matchesTarget(symbolAtPosition)) {
        streak.push({ x: pos.x, y: pos.y, symbol: Number(symbolAtPosition) || 0 });
        if (requiredCount > 0 && streak.length === requiredCount) {
          break;
        }
      } else {
        break;
      }
    }

    if (streak.length < requiredMin) {
      return [];
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

  public fadeOutLines(duration: number = 1000): Promise<void> {
    this.stopLooping();
    
    return new Promise((resolve) => {
      const allLines = [...this.lines, ...this.tearingLines];
      if (allLines.length === 0) {
        resolve();
        return;
      }

      let completedTweens = 0;
      const totalTweens = allLines.length;

      allLines.forEach((line, index) => {
        try { this.scene.tweens.killTweensOf(line); } catch {}
        try {
          const list = (line as any)?.list;
          if (Array.isArray(list)) {
            list.forEach((child: any) => {
              try { this.scene.tweens.killTweensOf(child); } catch {}
            });
          }
        } catch {}
        
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

      gameEventManager.emit(GameEventType.WIN_STOP);
    }
  }

  public destroy(): void {
    this.stopLooping();
    this.clearLines();
    this.container.destroy();
  }
}