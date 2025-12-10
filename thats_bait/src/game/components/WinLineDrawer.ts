import { Game } from '../scenes/Game';
import { Data } from '../../tmp_backend/Data';
import { Grid } from '../../tmp_backend/SymbolDetector';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SpinData, PaylineData } from '../../backend/SpinData';
import { MULTIPLIER_SYMBOLS } from '../../config/GameConfig';

export class WinLineDrawer {
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  private lines: Phaser.GameObjects.GameObject[] = [];

  private symbolsReference: any;
  private currentWinPatterns: [number, Grid[]][] = []; // [lineKey, winningGrids][]
  private currentPaylinesByKey: Map<number, PaylineData> = new Map();
  private isLooping: boolean = false;
  private loopTimer?: Phaser.Time.TimerEvent;
  private hasEmittedFirstLoopWinStop: boolean = false;
  private wasInterruptedByManualSpin: boolean = false;

  // Bubble visual modifiers for winlines
  // 1.0 = baseline behaviour; adjust via setBubbleStyle
  private bubbleDensityMultiplier: number = 2;      // >1 = denser bubbles, <1 = sparser
  private bubbleScaleRandomness: number = 1.0;       // >1 = more variation in radius/scale
  private bubbleWobbleAmount: number = 0.8;          // >1 = larger wobble distance
  private bubbleWobbleSpeed: number = 1.0;           // >1 = faster wobble tween

  // Configurable timing intervals (in milliseconds)
  private lineDisplayTime: number = 250;     // How long each line stays visible after drawing (increased from 750ms)
  private cycleEndPause: number = 250;      // Extra pause at the end of a complete cycle (increased from 750ms)
  private animationSpeed: number = 2;      // Speed multiplier for drawing animation (1.0 = normal)

  // Minimum display times to ensure visibility (especially important in turbo mode)
  private minLineDisplayTime: number = 500;  // Increased minimum time each line must be visible
  private minCycleEndPause: number = 800;     // Increased minimum pause at end of cycle

  // Store original values for turbo mode restoration
  private originalLineDisplayTime?: number;
  private originalCycleEndPause?: number;
  private originalAnimationSpeed?: number;
  private turboApplied: boolean = false;

  constructor(scene: Game, symbolsReference: any) {
    this.scene = scene;
    this.symbolsReference = symbolsReference;
    this.container = scene.add.container(0, 0);
    // Set high depth to ensure winlines draw above symbols (container at 880) and bubble streams (878)
    this.container.setDepth(900);
  }

  /**
   * Configure the bubble winline visual style.
   * All parameters are multipliers relative to the internal defaults.
   */
  public setBubbleStyle(options: {
    densityMultiplier?: number;      // 1.0 = default spacing; >1 = denser, <1 = sparser
    scaleRandomness?: number;        // 1.0 = baseline radius variance; >1 = more, <1 = flatter
    wobbleAmount?: number;           // 1.0 = baseline XY wobble; >1 = more movement
    wobbleSpeed?: number;            // 1.0 = baseline wobble duration; >1 = faster wobble
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

  /**
   * Draw lines for all winning patterns with looping sequence (legacy Data method)
   */
  public drawWinLines(data: Data): void {
    this.stopLooping();
    this.clearLines();

    if (!data.wins || data.wins.allMatching.size === 0) {
      console.log('[WinLineDrawer] No wins to draw lines for');
      return;
    }

    // Store win patterns for looping
    this.currentWinPatterns = Array.from(data.wins.allMatching.entries());
    this.isLooping = true;
    this.hasEmittedFirstLoopWinStop = false;
    this.wasInterruptedByManualSpin = false;

    // Start the looping sequence
    this.drawWinLinesSequentially(0);
  }

  /**
   * Draw lines for all winning patterns with looping sequence (new SpinData method)
   */
  public drawWinLinesFromSpinData(spinData: SpinData): void {
    this.stopLooping();
    this.clearLines();

    if (!spinData.slot.paylines || spinData.slot.paylines.length === 0) {
      console.log('[WinLineDrawer] No paylines to draw lines for');
      return;
    }

    // Convert SpinData paylines to win patterns format
    this.currentWinPatterns = this.convertPaylinesToWinPatterns(spinData);
    this.isLooping = true;
    this.hasEmittedFirstLoopWinStop = false;
    this.wasInterruptedByManualSpin = false;

    // Emit WIN_START to pause autoplay during winline animations
    console.log('[WinLineDrawer] Emitting WIN_START for winline animations (looping)');
    gameEventManager.emit(GameEventType.WIN_START);

    // Start the looping sequence
    this.drawWinLinesSequentially(0);
  }

  /**
   * Draw lines for all winning patterns once (for autoplay) then emit completion (legacy Data method)
   */
  public drawWinLinesOnce(data: Data): void {
    this.stopLooping();
    this.clearLines();

    if (!data.wins || data.wins.allMatching.size === 0) {
      console.log('[WinLineDrawer] No wins to draw lines for (once)');
      // No wins, clear any existing overlay and emit completion immediately
      if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
        this.symbolsReference.hideWinningOverlay();
      }
      // Emit completion immediately for no-win scenarios
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    // Store win patterns for single pass
    this.currentWinPatterns = Array.from(data.wins.allMatching.entries());
    this.isLooping = false; // Not looping, just single pass
    this.wasInterruptedByManualSpin = false;

    // Safety check: ensure we have patterns to draw
    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns stored, emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    // Start the single-pass sequence
    this.drawWinLinesSequentiallyOnce(0);
  }

  /**
   * Draw lines for all winning patterns once (for autoplay) then emit completion (new SpinData method)
   */
  public drawWinLinesOnceFromSpinData(spinData: SpinData): void {
    this.stopLooping();
    this.clearLines();

    if (!spinData.slot.paylines || spinData.slot.paylines.length === 0) {
      console.log('[WinLineDrawer] No paylines to draw lines for (once)');
      // No wins, clear any existing overlay and emit completion immediately
      if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
        this.symbolsReference.hideWinningOverlay();
      }
      // Emit completion immediately for no-win scenarios
      // Add small delay to ensure free spin autoplay is ready
      this.scene.time.delayedCall(50, () => {
        console.log('[WinLineDrawer] Emitting WIN_STOP for no-wins scenario');
        gameEventManager.emit(GameEventType.WIN_STOP);
      });
      return;
    }

    // Convert SpinData paylines to win patterns format
    this.currentWinPatterns = this.convertPaylinesToWinPatterns(spinData);
    // Dynamically adjust timings based on number of lines and turbo
    try {
      const numLines = Math.max(1, this.currentWinPatterns.length);
      const isTurbo = !!(((this.scene as any)?.gameData?.isTurbo) || gameStateManager.isTurbo);
      // Total time budget per win cycle (ms)
      const totalBudget = isTurbo ? 900 : 1800;
      // Reserve a small end pause (part of budget)
      const endPause = Math.min(200, Math.floor(totalBudget * 0.15));
      // Per-line time from remaining budget
      const perLine = Math.max(40, Math.floor((totalBudget - endPause) / numLines));
      // Apply aggressively faster draw speed under turbo
      const speed = isTurbo ? 2.0 : 1.5;

      // Override all mins so large win counts don't balloon timing
      this.minLineDisplayTime = perLine;
      this.minCycleEndPause = endPause;
      this.lineDisplayTime = perLine;
      this.cycleEndPause = endPause;
      this.animationSpeed = speed;
      console.log(`[WinLineDrawer] Dynamic timing applied: lines=${numLines}, turbo=${isTurbo}, perLine=${perLine}ms, endPause=${endPause}ms, speed=${speed}x`);
    } catch {}
    this.isLooping = false; // Not looping, just single pass
    this.wasInterruptedByManualSpin = false;

    // Safety check: ensure we have patterns to draw
    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns stored, emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    // Emit WIN_START to pause autoplay during winline animations
    console.log('[WinLineDrawer] Emitting WIN_START for winline animations');
    gameEventManager.emit(GameEventType.WIN_START);

    // Start the single-pass sequence
    this.drawWinLinesSequentiallyOnce(0);
  }

  /**
   * Draw win lines one by one, removing previous line (single pass for autoplay)
   */
  private drawWinLinesSequentiallyOnce(currentIndex: number): void {
    if (this.currentWinPatterns.length === 0) {
      console.log('[WinLineDrawer] No win patterns to draw, emitting WIN_STOP immediately');
      gameEventManager.emit(GameEventType.WIN_STOP);
      return;
    }

    // Only clear lines at the start of the sequence, not between each line
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

    // Get the complete winline pattern for continuity
    const completeWinlineGrids = this.getCompleteWinlineGrids(winlineIndex);

    // Draw the current line with animation and wait for completion
    this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
      // Animation completed, check if we have more lines
      const nextIndex = currentIndex + 1;

      if (nextIndex < this.currentWinPatterns.length) {
        // More lines to show, clear current line and continue after display time

        this.loopTimer = this.scene.time.delayedCall(this.lineDisplayTime, () => {
          // Clear the current line before drawing the next one
          this.clearLines();
          this.drawWinLinesSequentiallyOnce(nextIndex);
        });
      } else {
        // All lines shown, wait then emit completion

        this.loopTimer = this.scene.time.delayedCall(this.cycleEndPause, () => {
          // Check if we're in any type of autoplay (normal or free spin)
          const isNormalAutoplay = gameStateManager.isAutoPlaying;
          const isFreeSpinAutoplay = this.symbolsReference && (this.symbolsReference as any).freeSpinAutoplayActive;
          const isAnyAutoplay = isNormalAutoplay || isFreeSpinAutoplay;

          if (isAnyAutoplay) {
            // Add extra delay before clearing winlines to ensure they're visible
            this.scene.time.delayedCall(300, () => {
              this.clearLines();
              // Also clear the overlay when autoplay winlines complete
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

  /**
   * Draw win lines one by one, removing previous line and looping
   */
  private drawWinLinesSequentially(currentIndex: number): void {
    if (!this.isLooping || this.currentWinPatterns.length === 0) {
      return;
    }

    // Clear any existing line
    this.clearLines();

    const [winlineIndex, winningGrids] = this.currentWinPatterns[currentIndex];

    try {
      const payline = this.currentPaylinesByKey.get(winlineIndex) || null;
      const tracker = (this.scene as any).winTracker;
      if (tracker && typeof tracker.showForPayline === 'function') {
        tracker.showForPayline(payline);
      }
    } catch {}

    // Get the complete winline pattern for continuity
    const completeWinlineGrids = this.getCompleteWinlineGrids(winlineIndex);

    // Draw the current line with animation and wait for completion
    this.drawWinLineWithCallbackAndBrightness(completeWinlineGrids, winningGrids, winlineIndex, () => {
      // Animation completed, now wait before showing next line
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

  /**
   * Draw a win line with different brightness for winning vs connecting segments
   */
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

    // Neon colors - bright, vibrant colors that don't repeat
    const neonColors = [
      0x00FF41, // Neon Green
      0xFF0080, // Hot Pink
      0x00BFFF, // Deep Sky Blue
      0xFFFF00, // Electric Yellow
      0xFF4500, // Orange Red
      0x8A2BE2, // Blue Violet
      0x00FFFF, // Cyan
      0xFF1493, // Deep Pink
      0x32CD32, // Lime Green
      0xFF6347, // Tomato
      0x9370DB, // Medium Purple
      0x00FA9A, // Medium Spring Green
      0xFF69B4, // Hot Pink 2
      0x1E90FF, // Dodger Blue
      0xFFD700, // Gold
      0xDA70D6, // Orchid
      0x7FFF00, // Chartreuse
      0xFF4500, // Red Orange
      0x40E0D0, // Turquoise
      0xEE82EE  // Violet
    ];

    // Ensure we don't repeat colors by using the winline index directly
    const lineColor = neonColors[winlineIndex % neonColors.length];

    // Create set of winning positions for quick lookup
    const winningPositions = new Set<string>();
    for (const grid of winningGrids) {
      winningPositions.add(`${grid.x},${grid.y}`);
    }

    // Check if all symbols in the complete winline are winning (complete win)
    const allSymbolsWinning = completeGrids.every(grid =>
      winningPositions.has(`${grid.x},${grid.y}`)
    );

    // Create path points for all symbols with horizontal extensions and brightness info
    const pathPoints: { x: number, y: number, isWinning: boolean }[] = [];
    const extensionLength = 50; // Pixels to extend horizontally

    // First, get all symbol positions
    const symbolPositions: { x: number, y: number, isWinning: boolean }[] = [];
    for (let i = 0; i < completeGrids.length; i++) {
      const grid = completeGrids[i];
      const pos = this.getSymbolCenterPosition(grid.x, grid.y);
      // If all symbols are winning, mark all as winning; otherwise use actual winning status
      const isWinning = allSymbolsWinning || winningPositions.has(`${grid.x},${grid.y}`);
      symbolPositions.push({ ...pos, isWinning });
    }

    // Find leftmost and rightmost positions based on actual X coordinates
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

    // Debug: Check if grid is centered properly
    const screenCenterX = this.scene.scale.width * 0.5;
    const leftmostPos = symbolPositions[leftmostIndex];
    const rightmostPos = symbolPositions[rightmostIndex];
    const centerX = (leftmostPos.x + rightmostPos.x) / 2;
    const span = rightmostPos.x - leftmostPos.x;

    // Extensions relative to screen center for perfect symmetry
    const leftExtensionX = screenCenterX - (span / 2) - extensionLength;
    const rightExtensionX = screenCenterX + (span / 2) + extensionLength;

    // Build path with extensions at actual leftmost and rightmost points
    for (let i = 0; i < symbolPositions.length; i++) {
      const pos = symbolPositions[i];

      // Add horizontal extension to leftmost point (extend left)
      if (i === leftmostIndex) {
        pathPoints.push({ x: leftExtensionX, y: pos.y, isWinning: allSymbolsWinning }); // Extensions are winning if all symbols are winning
      }

      // Add the actual symbol position
      pathPoints.push(pos);

      // Add horizontal extension to rightmost point (extend right)
      if (i === rightmostIndex) {
        pathPoints.push({ x: rightExtensionX, y: pos.y, isWinning: allSymbolsWinning }); // Extensions are winning if all symbols are winning
      }
    }

    // Play winline SFX when starting to draw the line
    try {
      const sceneAny: any = this.scene as any;
      const audio = sceneAny?.audioManager || (window as any)?.audioManager;
      const shouldPlay = (!this.isLooping) || (this.isLooping && !this.hasEmittedFirstLoopWinStop);
      if (shouldPlay && audio && typeof audio.playRandomWinlineSfx === 'function') {
        audio.playRandomWinlineSfx();
      }
    } catch {}

    // Now render the winline as a chain of wobbling bubbles instead of a neon line
    this.createBubbleLine(pathPoints, winlineIndex, onComplete);
  }

  /**
   * Create a chain of small, untinted bubble sprites along the winline path.
   * Bubbles wobble locally around their position instead of drawing a neon line.
   */
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

    // Compute total path length and segment lengths
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

    // Keep timing roughly in line with previous neon line-draw effect
    const pixelsPerSecond = 800;
    const baseDuration = Math.max(400, (totalLength / pixelsPerSecond) * 1000);
    const totalDuration = baseDuration / this.animationSpeed;

    // Sample bubble positions along the path at regular spacing.
    // Density multiplier >1.0 makes spacing smaller (denser); <1.0 makes spacing larger (sparser).
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

    // Ensure we always include a bubble at the final endpoint
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

    // Visuals: mirror BubbleStreamSystem (radius ~0.5–3, imageScale 0.005)
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

    // Scale randomness multiplier adjusts radius variance around a mid point.
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
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(pos.x, pos.y, 4);
        bubble = g;
      }
      lineContainer.add(bubble);

      // Start tiny and transparent
      (bubble as any).alpha = 0;
      if ((bubble as any).setScale) {
        (bubble as any).setScale(0);
      }

      const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
      const radiusFactor = radius / Math.max(1, radiusMin);
      const finalScale = bubbleImageScale * radiusFactor;
      const finalAlpha = pos.isWinning ? 0.9 : 0.7;

      // Small local wobble around base position, scaled by wobble modifiers
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

  /**
   * Calculate the center position of a symbol given its grid coordinates.
   * Mirrors the positioning logic from Symbols.ts so lines align with symbols.
   */
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

  /**
   * Convert SpinData paylines to win patterns format for compatibility
   */
  private convertPaylinesToWinPatterns(spinData: SpinData): [number, Grid[]][] {
    const winPatterns: [number, Grid[]][] = [];
    this.currentPaylinesByKey.clear();

    for (const payline of spinData.slot.paylines) {
      // ... (rest of the method remains the same)
      const lineKey = payline.lineKey;
      const winningGrids = this.getWinningGridsForPayline(spinData, payline);
      this.currentPaylinesByKey.set(lineKey, payline);
      if (winningGrids.length > 0) {
        winPatterns.push([lineKey, winningGrids]);
      }
    }
    
    return winPatterns;
  }

  /**
   * Get winning grids for a specific payline from SpinData
   */
  private getWinningGridsForPayline(spinData: SpinData, payline: PaylineData): Grid[] {
    const winningGrids: Grid[] = [];
    const lineKey = payline.lineKey;
    const count = payline.count;
    
    // Get the winline pattern for this lineKey
    if (lineKey < 0 || lineKey >= Data.WINLINES.length) {
      console.warn(`[WinLineDrawer] Invalid lineKey: ${lineKey}`);
      return [];
    }
    
    const winline = Data.WINLINES[lineKey];
    
    // Get all positions in the winline pattern (where winline[y][x] === 1)
    const winlinePositions: { x: number, y: number }[] = [];
    for (let x = 0; x < winline[0].length; x++) {
      for (let y = 0; y < winline.length; y++) {
        if (winline[y][x] === 1) {
          winlinePositions.push({ x, y });
        }
      }
    }
    
    // Sort positions by x coordinate to get left-to-right order
    winlinePositions.sort((a, b) => a.x - b.x);
    
    // Take only the first 'count' positions as winning symbols
    const winningPositions = winlinePositions.slice(0, count);
    
    // Add the winning positions to the result
    for (const pos of winningPositions) {
      const symbolAtPosition = spinData.slot.area[pos.y][pos.x];
      winningGrids.push(new Grid(pos.x, pos.y, symbolAtPosition));
    }
    
    return winningGrids;
  }

  /**
   * Get complete winline pattern grids for continuity
   */
  private getCompleteWinlineGrids(winlineIndex: number): Grid[] {
    if (winlineIndex < 0 || winlineIndex >= Data.WINLINES.length) {
      console.warn(`[WinLineDrawer] Invalid winline index: ${winlineIndex}`);
      return [];
    }
  
    const winline = Data.WINLINES[winlineIndex];
    const completeGrids: Grid[] = [];
  
    // Extract all positions where the winline has a 1 (complete pattern)
    for (let x = 0; x < winline[0].length; x++) {
      for (let y = 0; y < winline.length; y++) {
        if (winline[y][x] === 1) {
          // Create a dummy grid for positioning (symbol value doesn't matter for line drawing)
          completeGrids.push(new Grid(x, y, 0));
        }
      }
    }
    return completeGrids;
  }

  /**
   * Stop the looping animation
   */
  public stopLooping(): void {
    this.isLooping = false;
    if (this.loopTimer) {
      this.loopTimer.remove();
      this.loopTimer = undefined;
    }
  }

  /**
   * Clear all drawn lines
   */
  public clearLines(): void {
    this.lines.forEach(line => {
      try { this.scene.tweens.killTweensOf(line); } catch {}
      try {
        // Containers will destroy their children when fromScene=true
        (line as any).destroy(true);
      } catch {
        try { (line as any).destroy(); } catch {}
      }
    });
    this.lines = [];
  }

  /**
   * Check if there are currently active win lines
   */
  public hasActiveLines(): boolean {
    return this.lines.length > 0 || this.currentWinPatterns.length > 0;
  }

  /**
   * Animate a single line appearing with neon glow effect (legacy method)
   * Note: This is now handled by the animated drawing system
   */
  private animateSingleLine(line: Phaser.GameObjects.GameObject): void {
    // The animation is now handled by animateLineDraw method
    // This method is kept for backward compatibility but does nothing
  }

  /**
   * Animate all lines appearing with neon glow effect (legacy method for backward compatibility)
   */
  public animateLines(): void {
    this.lines.forEach((line, index) => {
      setTimeout(() => {
        this.animateSingleLine(line);
      }, index * 150);
    });
  }

  /**
   * Animate the lines disappearing
   */
  public fadeOutLines(duration: number = 1000): Promise<void> {
    this.stopLooping(); // Stop looping when fading out
    
    return new Promise((resolve) => {
      if (this.lines.length === 0) {
        resolve();
        return;
      }

      let completedTweens = 0;
      const totalTweens = this.lines.length;

      this.lines.forEach((line, index) => {
        // Stop any existing pulsing animations
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

  /**
   * Configure the timing intervals for line drawing
   */
  public setTimingIntervals(options: {
    lineDisplayTime?: number;    // Time each line stays visible (default: 1500ms)
    cycleEndPause?: number;      // Extra pause at end of cycle (default: 2000ms)  
    animationSpeed?: number;     // Animation speed multiplier (default: 1.0)
  }): void {
    if (options.lineDisplayTime !== undefined) {
      this.lineDisplayTime = Math.max(500, options.lineDisplayTime); // Minimum 500ms
    }
    if (options.cycleEndPause !== undefined) {
      this.cycleEndPause = Math.max(800, options.cycleEndPause); // Minimum 800ms
    }
    if (options.animationSpeed !== undefined) {
      this.animationSpeed = Math.max(0.1, Math.min(3.0, options.animationSpeed)); // Clamp between 0.1x and 3.0x
    }
    
  }

  /**
   * Get current timing configuration
   */
  public getTimingIntervals(): { lineDisplayTime: number, cycleEndPause: number, animationSpeed: number } {
    return {
      lineDisplayTime: this.lineDisplayTime,
      cycleEndPause: this.cycleEndPause,
      animationSpeed: this.animationSpeed
    };
  }

  /**
   * Quick preset configurations for common use cases
   */
  public setTimingPreset(preset: 'fast' | 'normal' | 'slow' | 'showcase'): void {
    switch (preset) {
      case 'fast':
        this.setTimingIntervals({
          lineDisplayTime: 1000,      // Increased from 800ms
          cycleEndPause: 1500,        // Increased from 1200ms
          animationSpeed: 1.5
        });
        break;
      case 'normal':
        this.setTimingIntervals({
          lineDisplayTime: 1800,      // Increased from 1500ms
          cycleEndPause: 2500,        // Increased from 2000ms
          animationSpeed: 1.0
        });
        break;
      case 'slow':
        this.setTimingIntervals({
          lineDisplayTime: 3000,      // Increased from 2500ms
          cycleEndPause: 4000,        // Increased from 3500ms
          animationSpeed: 0.7
        });
        break;
      case 'showcase':
        this.setTimingIntervals({
          lineDisplayTime: 4000,      // Increased from 3000ms
          cycleEndPause: 5000,        // Increased from 4000ms
          animationSpeed: 0.5
        });
        break;
    }
  }

  /**
   * Apply turbo mode timing (4x faster animations)
   */
  public setTurboMode(isEnabled: boolean): void {
    if (isEnabled) {
      // Only store and apply once per turbo session
      if (!this.turboApplied) {
        this.originalLineDisplayTime = this.lineDisplayTime;
        this.originalCycleEndPause = this.cycleEndPause;
        this.originalAnimationSpeed = this.animationSpeed;
        
        // Apply turbo speed using centralized TurboConfig
        this.setTimingIntervals({
          lineDisplayTime: Math.max(this.minLineDisplayTime, this.lineDisplayTime * TurboConfig.TURBO_DURATION_MULTIPLIER),
          cycleEndPause: Math.max(this.minCycleEndPause, this.cycleEndPause * TurboConfig.TURBO_DURATION_MULTIPLIER),
          animationSpeed: this.animationSpeed * TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER
        });
        this.turboApplied = true;
      }
    } else {
      // Restore original values only if turbo was applied
      if (this.turboApplied && this.originalLineDisplayTime !== undefined && this.originalCycleEndPause !== undefined && this.originalAnimationSpeed !== undefined) {
        this.setTimingIntervals({
          lineDisplayTime: Math.max(this.minLineDisplayTime, this.originalLineDisplayTime),
          cycleEndPause: Math.max(this.minCycleEndPause, this.originalCycleEndPause),
          animationSpeed: this.originalAnimationSpeed
        });
        // Clear stored original values and flag
        this.originalLineDisplayTime = undefined;
        this.originalCycleEndPause = undefined;
        this.originalAnimationSpeed = undefined;
        this.turboApplied = false;
      } else {
        // Nothing to restore; ignore silently to avoid log spam during free-spin flows
      }
    }
  }

  /**
   * Reset to default timing values (useful for debugging or clean state)
   */
  public resetToDefaultTiming(): void {
    this.lineDisplayTime = 1200;     // Default line display time (increased from 750ms)
    this.cycleEndPause = 1000;       // Default cycle end pause (increased from 750ms)
    this.animationSpeed = 1.5;      // Default animation speed
    
    // Clear stored original values
    this.originalLineDisplayTime = undefined;
    this.originalCycleEndPause = undefined;
    this.originalAnimationSpeed = undefined;
    this.turboApplied = false;
  }

  /**
   * Check if the first loop of win lines has completed
   */
  public hasFirstLoopCompleted(): boolean {
    return this.hasEmittedFirstLoopWinStop;
  }

  /**
   * Check if the win line animation was interrupted by a manual spin
   */
  public wasInterruptedBySpin(): boolean {
    return this.wasInterruptedByManualSpin;
  }

  /**
   * Reset the interrupted flag (called when starting a new spin)
   */
  public resetInterruptedFlag(): void {
    this.wasInterruptedByManualSpin = false;
  }

  /**
   * Force emit WIN_STOP if the first loop hasn't completed yet
   * This is used when the player manually presses spin before the win animation completes
   */
  public forceEmitWinStopIfNeeded(): void {
    if (!this.hasEmittedFirstLoopWinStop && this.isLooping) {
      console.log('[WinLineDrawer] First loop not completed - forcing WIN_STOP emission');
      this.hasEmittedFirstLoopWinStop = true;
      this.wasInterruptedByManualSpin = true; // Mark that this was interrupted by manual spin
      
      // Stop the looping animation to prevent further win line drawing
      this.stopLooping();
      
      // Clear any existing lines
      this.clearLines();
      
      // Hide winning overlay if it exists
      if (this.symbolsReference && this.symbolsReference.hideWinningOverlay) {
        this.symbolsReference.hideWinningOverlay();
      }
      
      // Emit the required events
      gameEventManager.emit(GameEventType.REELS_STOP);
      gameEventManager.emit(GameEventType.WIN_STOP);
    }
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.stopLooping();
    this.clearLines();
    this.container.destroy();
  }
} 