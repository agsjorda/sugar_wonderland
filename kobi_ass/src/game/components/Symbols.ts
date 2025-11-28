import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { WinLineDrawer } from './WinLineDrawer';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS, WILDCARD_SYMBOLS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';

export class Symbols {
  
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  public displayWidth: number;
  public displayHeight: number;
  public horizontalSpacing: number;
  public verticalSpacing: number;
  public symbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public newSymbols: any[][]; // Changed to any to support both Sprite and Spine objects
  public slotX: number;
  public slotY: number;
  public totalGridWidth: number;
  public totalGridHeight: number;
  public scatterAnimationManager: ScatterAnimationManager;
  public symbolDetector: SymbolDetector;
  public winLineDrawer: WinLineDrawer;
  private overlayRect?: Phaser.GameObjects.Graphics;
  public currentSpinData: any = null; // Store current spin data for access by other components

  // Skip-drop state
  private skipReelDropsActive: boolean = false;
  // Clickable hitbox over the symbol grid to allow skipping during reel drops
  private skipHitbox?: Phaser.GameObjects.Zone;
  
  // Idle "breathing" animation tweens per symbol (keyed by "col_row")
  private idleTweens: Map<string, Phaser.Tweens.Tween> = new Map();

  // Idle floating configuration (tweak these to adjust speed and height)
  public idleFloatConfig: {
    amplitudeYMin: number;       // minimum vertical float in pixels
    amplitudeYMax: number;       // maximum vertical float in pixels
    durationMinMs: number;       // minimum tween duration per half-cycle (ms)
    durationMaxMs: number;       // maximum tween duration per half-cycle (ms)
    startDelayMaxMs: number;     // maximum randomized start delay (ms)
    repeatDelayMaxMs: number;    // maximum randomized delay between cycles (ms)
    holdMaxMs: number;           // maximum hold/pause at peaks (ms)
  } = {
    amplitudeYMin: 4,
    amplitudeYMax: 5,
    durationMinMs: 500,
    durationMaxMs: 700,
    startDelayMaxMs: 450,
    repeatDelayMaxMs: 120,
    holdMaxMs: 90,
  };
  
  // Sticky wilds (persist across bonus free spins)
  public stickyWilds: Map<string, any> = new Map();
  public stickyWildsContainer?: Phaser.GameObjects.Container;

  // Configuration for Spine symbol scales - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0:  0.135,   // Symbol0_KA (scatter) scale
    1:  0.035,  // Symbol1_KA scale
    2:  0.035,  // Symbol2_KA scale
    3:  0.035,  // Symbol3_KA scale
    4:  0.135,  // Symbol4_KA scale
    5:  0.135,  // Symbol5_KA scale
    6:  0.135,  // Symbol6_KA scale
    7:  0.135,  // Symbol7_KA scale
    8:  0.135,  // Symbol8_KA scale
    9:  0.135,  // Symbol9_KA scale
    10: 0.135,  // Symbol10_KA scale
    11: 0.135,  // Symbol11_KA scale
    12: 0.137,  // Symbol12_KA (wildcard x2) scale
    13: 0.137,  // Symbol13_KA (wildcard x3) scale
    14: 0.137  // Symbol14_KA (wildcard x4) scale
  };

  // Store current symbol data for reset purposes
  public currentSymbolData: number[][] | null = null;
  
  // Store free spins data for autoplay
  private pendingFreeSpinsData: { scatterIndex: number; actualFreeSpins: number } | null = null;
  
  // Free spin autoplay state
  public freeSpinAutoplayActive: boolean = false;
  private freeSpinAutoplaySpinsRemaining: number = 0;
  private freeSpinAutoplayTimer: Phaser.Time.TimerEvent | null = null;
  private freeSpinAutoplayWaitingForReelsStop: boolean = false;
  private freeSpinAutoplayWaitingForWinlines: boolean = false;
  private freeSpinAutoplayTriggered: boolean = false;
  private freeSpinAutoplayWaitingForDialogClose: boolean = false;
  private dialogListenerSetup: boolean = false;

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  public create(scene: Game) {
    this.scene = scene;
    this.winLineDrawer = new WinLineDrawer(scene, this);
    initVariables(this);
    createContainer(this);
    onStart(this);
    onSpinDataReceived(this);
    this.onSpinDone(this.scene);
    this.setupDialogEventListeners();
    this.setupSpinEventListener(); // Re-enabled to clean up symbols at spin start
    
    // Prepare overlay container for sticky wilds above base symbols
    this.ensureStickyWildsContainer();
    
    // Clear sticky wilds when bonus mode ends
    this.scene.events.on('setBonusMode', (isBonus: boolean) => {
      if (!isBonus) {
        this.clearStickyWilds();
      }
    });
    // Also clear on bonus UI hide events
    this.scene.events.on('hideBonusBackground', () => this.clearStickyWilds());
    this.scene.events.on('hideBonusHeader', () => this.clearStickyWilds());
    this.scene.events.on('scatterBonusCompleted', () => this.clearStickyWilds());
//
    // Listen for a full free spin reset request (after congrats/bonus end)
    this.scene.events.on('resetFreeSpinState', () => {
      console.log('[Symbols] resetFreeSpinState received - clearing free spin autoplay state');
      if (this.freeSpinAutoplayTimer) {
        this.freeSpinAutoplayTimer.destroy();
        this.freeSpinAutoplayTimer = null;
      }
      this.freeSpinAutoplayActive = false;
      this.freeSpinAutoplaySpinsRemaining = 0;
      this.freeSpinAutoplayWaitingForReelsStop = false;
      this.freeSpinAutoplayWaitingForWinlines = false;
      this.freeSpinAutoplayTriggered = false;
      this.freeSpinAutoplayWaitingForDialogClose = false;
      this.dialogListenerSetup = false;
    });

    // Install per-spin skip zone over the reels
    this.createSkipHitbox();
  }

  // Ensure sticky wilds container exists (rendered above regular symbols and overlays)
  public ensureStickyWildsContainer(): void {
    if (!this.stickyWildsContainer) {
      this.stickyWildsContainer = this.scene.add.container(0, 0);
      // Place above overlay (overlay depth is 500) and above moved winning symbols (600)
      this.stickyWildsContainer.setDepth(700);
    }
  }

  /**
   * Request to skip current reel drop animations by speeding up symbol tweens
   * and shrinking the remaining delays/durations for drop logic.
   */
  public requestSkipReelDrops(): void {
    try {
      if (this.skipReelDropsActive) return;
      this.skipReelDropsActive = true;
      // Speed up active symbol tweens without touching global tween manager
      this.accelerateActiveSymbolTweens(60);
      // Cut down remaining drop timings so new tweens also finish fast
      const gd = (this.scene as any)?.gameData as GameData | undefined;
      if (gd) {
        gd.dropReelsDelay = 0;
        gd.dropDuration = Math.max(1, Math.floor(gd.dropDuration * 0.1));
        gd.winUpDuration = Math.max(1, Math.floor(gd.winUpDuration * 0.1));
      }
      console.log('[Symbols] Skip requested: speeding up reel drops and reducing delays');
    } catch (e) {
      console.warn('[Symbols] Failed to apply skip reel drops acceleration:', e);
    }
  }

  /**
   * Clear skip state once the spin has moved beyond reel drops.
   */
  public clearSkipReelDrops(): void {
    try {
      if (!this.skipReelDropsActive) return;
      this.skipReelDropsActive = false;
      console.log('[Symbols] Skip cleared');
    } catch (e) {
      console.warn('[Symbols] Failed to clear skip state:', e);
    }
  }

  public isSkipReelDropsActive(): boolean {
    return !!this.skipReelDropsActive;
  }

  /**
   * Create an invisible interactive hitbox over the symbol grid area that,
   * when clicked during a spin, requests skipping all reel drops.
   */
  private createSkipHitbox(): void {
    try {
      if (!this.scene) return;
      // Remove any previous hitbox to prevent duplicates
      try { this.skipHitbox?.destroy(); } catch {}

      const zone = this.scene.add.zone(
        this.slotX,
        this.slotY,
        this.totalGridWidth,
        this.totalGridHeight
      ).setOrigin(0.5, 0.5);

      zone.setDepth(20);
      zone.disableInteractive();

      zone.on('pointerdown', () => {
        try {
          if (gameStateManager.isReelSpinning && !gameStateManager.isTurbo) {
            this.requestSkipReelDrops();
          }
        } catch {}
      });

      this.skipHitbox = zone as Phaser.GameObjects.Zone;

      const enable = () => {
        try { this.updateSkipHitboxGeometry(); } catch {}
        if (gameStateManager.isTurbo) {
          try { this.skipHitbox?.disableInteractive(); } catch {}
        } else {
          try { this.skipHitbox?.setInteractive({ useHandCursor: false }); } catch {}
        }
      };

      const disable = () => {
        try { this.skipHitbox?.disableInteractive(); } catch {}
      };

      const onTurboOn = () => { try { this.skipHitbox?.disableInteractive(); } catch {} };
      const onTurboOff = () => {
        try {
          if (gameStateManager.isReelSpinning) enable();
        } catch {}
      };

      gameEventManager.on(GameEventType.REELS_START, enable);
      gameEventManager.on(GameEventType.REELS_STOP, disable);
      gameEventManager.on(GameEventType.TURBO_ON, onTurboOn);
      gameEventManager.on(GameEventType.TURBO_OFF, onTurboOff);

      this.scene.events.once('shutdown', () => {
        try { gameEventManager.off(GameEventType.REELS_START, enable); } catch {}
        try { gameEventManager.off(GameEventType.REELS_STOP, disable); } catch {}
        try { gameEventManager.off(GameEventType.TURBO_ON, onTurboOn); } catch {}
        try { gameEventManager.off(GameEventType.TURBO_OFF, onTurboOff); } catch {}
        try { this.skipHitbox?.destroy(); this.skipHitbox = undefined; } catch {}
      });
    } catch {}
  }

  /** Ensure the skip hitbox tracks the symbol grid geometry */
  private updateSkipHitboxGeometry(): void {
    try {
      if (!this.skipHitbox) return;
      this.skipHitbox.setPosition(this.slotX, this.slotY);
      try { (this.skipHitbox as any).setSize(this.totalGridWidth, this.totalGridHeight); } catch {}
    } catch {}
  }

  /** Speed up active tweens for all objects inside the symbol grid containers */
  private accelerateActiveSymbolTweens(timeScale: number): void {
    if (!this.scene?.tweens) return;
    try {
      const accel = (obj: any) => {
        if (!obj) return;
        try {
          const tweens = this.scene.tweens.getTweensOf(obj) as any[];
          if (Array.isArray(tweens)) {
            for (const t of tweens) {
              try { (t as any).timeScale = Math.max(1, timeScale); } catch {}
            }
          }
        } catch {}
      };

      const accelerateCollection = (collection?: any[][]) => {
        try {
          if (!Array.isArray(collection)) return;
          for (const col of collection) {
            if (!Array.isArray(col)) continue;
            for (const obj of col) accel(obj);
          }
        } catch {}
      };

      accelerateCollection(this.symbols);
      accelerateCollection(this.newSymbols);

      try {
        const list: any[] = (this.container as any)?.list || [];
        for (const child of list) accel(child);
      } catch {}

      try { if (this.overlayRect) accel(this.overlayRect); } catch {}
      try { if (this.stickyWildsContainer) accel(this.stickyWildsContainer); } catch {}
    } catch {}
  }

  private gridKey(col: number, row: number): string {
    return `${col}_${row}`;
  }

  /**
   * Create a gentle floating tween on the given sprite.
   * Stores/restores base position, rotation, and scale to avoid drift.
   */
  private createBreathingTweenFor(symbol: any): Phaser.Tweens.Tween | null {
    if (!symbol || !symbol.active || typeof symbol.scaleX !== 'number' || typeof symbol.scaleY !== 'number') {
      return null;
    }

    // Don't animate Spine objects (they have animationState)
    if ((symbol as any).animationState) {
      return null;
    }

    // Ensure base transforms are stored for later restoration
    try {
      if (typeof symbol.getData === 'function') {
        if (symbol.getData('baseScaleX') === undefined) symbol.setData('baseScaleX', symbol.scaleX);
        if (symbol.getData('baseScaleY') === undefined) symbol.setData('baseScaleY', symbol.scaleY);
        if (symbol.getData('baseX') === undefined) symbol.setData('baseX', symbol.x);
        if (symbol.getData('baseY') === undefined) symbol.setData('baseY', symbol.y);
        if (symbol.getData('baseRotation') === undefined) symbol.setData('baseRotation', symbol.rotation || 0);
      }
    } catch {}

    const baseY = symbol.y;

    // Vertical-only floating (no x drift or rotation)
    const cfg = this.idleFloatConfig;
    const ampRange = Math.max(0, (cfg.amplitudeYMax - cfg.amplitudeYMin));
    const yAmplitude = cfg.amplitudeYMin + Math.random() * ampRange;

    const durRange = Math.max(0, (cfg.durationMaxMs - cfg.durationMinMs));
    const duration = cfg.durationMinMs + Math.floor(Math.random() * (durRange || 1));
    const delay = Math.floor(Math.random() * Math.max(0, cfg.startDelayMaxMs));
    const repeatDelay = Math.floor(Math.random() * Math.max(0, cfg.repeatDelayMaxMs));
    const hold = Math.floor(Math.random() * Math.max(0, cfg.holdMaxMs));

    return this.scene.tweens.add({
      targets: symbol,
      y: baseY - yAmplitude,
      duration: duration,
      delay: delay,
      repeatDelay: repeatDelay,
      hold: hold,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private stopBreathingTweenFor(symbol: any): void {
    if (!symbol) return;
    try {
      this.scene.tweens.killTweensOf(symbol);
      // Restore base transforms if present
      if (typeof symbol.getData === 'function') {
        const bx = symbol.getData('baseScaleX');
        const by = symbol.getData('baseScaleY');
        const br = symbol.getData('baseRotation');
        if (typeof bx === 'number' && typeof by === 'number') {
          symbol.setScale(bx, by);
        }
        if (typeof br === 'number' && typeof symbol.setRotation === 'function') {
          symbol.setRotation(br);
        }
      }
    } catch {}
  }

  public stopAllIdleTweens(): void {
    if (!this.symbols) {
      this.idleTweens.clear();
      return;
    }
    try {
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const sym = this.symbols[col][row];
          this.stopBreathingTweenFor(sym);
        }
      }
    } catch {}
    // Also stop any tweens we may have tracked directly
    for (const tween of this.idleTweens.values()) {
      try { tween.stop(); } catch {}
    }
    this.idleTweens.clear();
  }

  /**
   * Start idle breathing animation on all symbols that are NOT winning.
   * Optionally exclude scatter symbols via provided scatter grids.
   */
  public startIdleAnimationForNonWinning(data: Data, scatterGrids?: Grid[]): void {
    if (!this.symbols || !data) return;

    // Build a set of winning positions "x_y"
    const winningSet = new Set<string>();
    try {
      const wins = (data as any).wins;
      if (wins && wins.allMatching && wins.allMatching.size > 0) {
        for (const match of wins.allMatching.values()) {
          for (const grid of match) {
            winningSet.add(`${grid.x}_${grid.y}`);
          }
        }
      }
    } catch {}

    // Include scatters in the "winning" exclusion set
    if (Array.isArray(scatterGrids)) {
      for (const g of scatterGrids) {
        winningSet.add(`${g.x}_${g.y}`);
      }
    }

    // Iterate symbols in [col][row] where col -> y, row -> x based on usage in this file
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const key = `${row}_${col}`; // translate to x_y
        const symbol = this.symbols[col][row];

        // Skip if this position is part of a win
        if (winningSet.has(key)) {
          this.stopBreathingTweenFor(symbol);
          continue;
        }

        // Skip sticky wild locations during bonus (they may have Spine overlays)
        if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
          this.stopBreathingTweenFor(symbol);
          continue;
        }

        // Create breathing tween if not already present
        if (symbol && symbol.active) {
          // Ensure any previous tween is stopped
          this.stopBreathingTweenFor(symbol);
          const tween = this.createBreathingTweenFor(symbol);
          if (tween) {
            this.idleTweens.set(this.gridKey(col, row), tween);
          }
        }
      }
    }
  }

  /**
   * Start idle breathing animation for all PNG symbols (used after win-stop).
   */
  public startIdleAnimationForAll(): void {
    if (!this.symbols) return;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        // Skip sticky wilds during bonus
        if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
          continue;
        }
        const symbol = this.symbols[col][row];
        if (!symbol || !symbol.active || (symbol as any).animationState) {
          continue;
        }
        // Replace any previous tween
        this.stopBreathingTweenFor(symbol);
        const tween = this.createBreathingTweenFor(symbol);
        if (tween) {
          this.idleTweens.set(this.gridKey(col, row), tween);
        }
      }
    }
  }

  /**
   * Smoothly move all symbols to the center of their cells, avoiding snaps at spin start.
   * Duration is per half-cycle tween toward center.
   */
  public smoothlyCenterAllSymbols(durationMs: number = 120): void {
    if (!this.symbols || !this.symbols.length || !this.symbols[0].length) return;

    const symbolTotalHeight = this.displayHeight + this.verticalSpacing;
    const startY = this.slotY - this.totalGridHeight * 0.5;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        // Skip sticky wild spines during bonus
        if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
          continue;
        }
        const symbol = this.symbols[col][row];
        if (!symbol || !symbol.active || (symbol as any).animationState) continue;

        // Center Y for this cell
        const centerY = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

        // Kill any current tweens (including idle), then tween to center
        this.scene.tweens.killTweensOf(symbol);
        this.scene.tweens.add({
          targets: symbol,
          y: centerY,
          duration: durationMs,
          ease: 'Sine.easeOut'
        });
      }
    }
  }

  /**
   * Update idle floating configuration at runtime.
   * Example:
   *   symbols.setIdleFloatConfig({ amplitudeYMin: 10, amplitudeYMax: 20, durationMinMs: 400, durationMaxMs: 900 });
   */
  public setIdleFloatConfig(config: Partial<{
    amplitudeYMin: number;
    amplitudeYMax: number;
    durationMinMs: number;
    durationMaxMs: number;
    startDelayMaxMs: number;
    repeatDelayMaxMs: number;
    holdMaxMs: number;
  }>): void {
    this.idleFloatConfig = { ...this.idleFloatConfig, ...config };
  }

  private getStickyKey(col: number, row: number): string {
    return `${col}_${row}`;
  }

  public hasStickyWildAt(col: number, row: number): boolean {
    return this.stickyWilds.has(this.getStickyKey(col, row));
  }

  public addStickyWildAt(col: number, row: number, symbolValue: number): void {
    // Only valid during bonus
    if (!gameStateManager.isBonus) return;
    // Only for rows 2-4 (0-indexed 1..3)
    if (row < 1 || row > 3) return;
    // Only for wildcard symbols
    if (!WILDCARD_SYMBOLS.includes(symbolValue)) return;
    
    this.ensureStickyWildsContainer();
    const key = this.getStickyKey(col, row);
    if (this.stickyWilds.has(key)) {
      // Sticky already exists here; hide the newly dropped wildcard sprite underneath
      const existingBase = this.symbols?.[col]?.[row];
      try {
        if (existingBase?.setVisible) existingBase.setVisible(false);
        else if (existingBase?.setAlpha) existingBase.setAlpha(0);
      } catch {}
      return;
    }
    
    const baseSymbol = this.symbols?.[col]?.[row];
    if (!baseSymbol) return;
    const x = baseSymbol.x;
    const y = baseSymbol.y;
    
    try {
      const spineKey = `symbol_${symbolValue}_spine`;
      const spineAtlasKey = spineKey + '-atlas';
      const spine = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
      spine.setOrigin(0.5, 0.5);
      spine.setScale(this.getSpineSymbolScale(symbolValue));
      // Keep looping animation so it remains visibly active
      const symbolName = `Symbol${symbolValue}_KA`;
      const anim = `${symbolName}_hit`;
      spine.animationState.setAnimation(0, anim, true);
      
      this.stickyWildsContainer?.add(spine);
      this.stickyWilds.set(key, spine);

      // Hide the base wildcard sprite underneath so only the sticky spine is visible
      try {
        if (baseSymbol?.setVisible) baseSymbol.setVisible(false);
        else if (baseSymbol?.setAlpha) baseSymbol.setAlpha(0);
      } catch {}
    } catch (e) {
      console.warn('[Symbols] Failed to create sticky wild spine at', col, row, e);
    }
  }

  public clearStickyWilds(): void {
    if (this.stickyWilds) {
      for (const spine of this.stickyWilds.values()) {
        try { spine?.destroy?.(); } catch {}
      }
      this.stickyWilds.clear();
    }
    if (this.stickyWildsContainer) {
      try { this.stickyWildsContainer.removeAll(true); } catch {}
    }
  }

  private setupSpinEventListener() {
    // Listen for spin events to reset any lingering Spine symbols
    gameEventManager.on(GameEventType.SPIN, () => {
      console.log('[Symbols] Spin event detected, ensuring clean state');
      
      // CRITICAL: Block autoplay spin actions if win dialog is showing, but allow manual spins
      // This fixes the timing issue where manual spin symbol cleanup was blocked
      if (gameStateManager.isShowingWinDialog && gameStateManager.isAutoPlaying) {
        console.log('[Symbols] Autoplay SPIN event BLOCKED - win dialog is showing');
        console.log('[Symbols] Manual spins are still allowed to proceed');
        return;
      }
      
      // Check if scatter animation is in progress before proceeding
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] WARNING: SPIN event received during scatter bonus - this should not happen!');
        console.log('[Symbols] Stack trace:', new Error().stack);
        return;
      }
      
      // Stop any idle breathing before starting a new spin
      this.stopAllIdleTweens();
      
      this.ensureCleanSymbolState();
      
      // Only clear winlines if they're not still animating or if this is a manual spin
      // This prevents interrupting winline animations during autoplay continuation
      if (this.winLineDrawer) {
        const hasActiveWinlines = this.winLineDrawer.hasActiveLines();
        const isManualSpin = !gameStateManager.isAutoPlaying;
        
        if (isManualSpin || !hasActiveWinlines) {
          console.log('[Symbols] Clearing winlines - manual spin or no active winlines');
          this.winLineDrawer.stopLooping();
          this.winLineDrawer.clearLines();
        } else {
          console.log('[Symbols] Preserving active winlines during autoplay continuation');
        }
      }
      // Hide winning overlay when spin starts
      this.hideWinningOverlay();
      // Reset symbol depths
      this.resetSymbolDepths();
      // Restore symbol visibility for new spin
      this.restoreSymbolVisibility();
      // Smoothly center symbols to avoid snap when reels start dropping
      this.smoothlyCenterAllSymbols(140);
      // Keep sticky wilds visible during bonus
      if (gameStateManager.isBonus) {
        this.restoreStickyWildsVisibility();
      }
    });
    
    // Listen for winline completion to resume autoplay
    gameEventManager.on(GameEventType.WIN_STOP, () => {
      console.log('[Symbols] WIN_STOP event received - resuming autoplay');
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
      console.log('[Symbols] freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
      
      // Handle free spin autoplay waiting for winlines
      this.handleFreeSpinAutoplayWinStop();
      
      // Clear win lines for autoplay to ensure clean start for next spin
      if (gameStateManager.isAutoPlaying) {
        console.log('[Symbols] Clearing win lines for autoplay on WIN_STOP');
        this.clearWinLines();
        this.hideWinningOverlay();
      }
      
      resumeAutoplayAfterWinlines(this.scene.gameData);

      // When wins finish and we're not auto-spinning, start idle on all symbols
      if (!gameStateManager.isAutoPlaying && !this.freeSpinAutoplayActive) {
        this.startIdleAnimationForAll();
      }

      // If bonus finished and no win dialog will show, display congrats now
      if (gameStateManager.isBonus && gameStateManager.isBonusFinished && !gameStateManager.isShowingWinDialog) {
        console.log('[Symbols] Bonus finished without win dialog on last spin - showing congrats');
        this.showCongratsDialogAfterDelay();
        gameStateManager.isBonusFinished = false;
      }
    });
    
    // Listen for winline start to pause autoplay
    gameEventManager.on(GameEventType.WIN_START, () => {
      console.log('[Symbols] WIN_START event received - pausing autoplay');
      pauseAutoplayForWinlines(this.scene.gameData);
    });

    // Listen for win dialog close
    gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => {
      console.log('[Symbols] WIN_DIALOG_CLOSED event received');
      // Reset dialog showing flag
      gameStateManager.isShowingWinDialog = false;

      // If bonus just finished, immediately show congrats and reset flag
      if (gameStateManager.isBonusFinished) {
        console.log('[Symbols] isBonusFinished is true on WIN_DIALOG_CLOSED - showing congrats now');
        // Show congrats now and reset the flag; bonus mode exit happens on congrats close
        this.showCongratsDialogAfterDelay();
        gameStateManager.isBonusFinished = false;
      }

      // If free spin autoplay was waiting for dialog close, resume autoplay
      if (this.freeSpinAutoplayActive && this.freeSpinAutoplayWaitingForDialogClose) {
        console.log('[Symbols] Free spin autoplay was waiting for dialog close - scheduling next free spin');
        this.freeSpinAutoplayWaitingForDialogClose = false;

        // Clear any existing timer since dialog has fully closed
        if (this.freeSpinAutoplayTimer) {
          this.freeSpinAutoplayTimer.destroy();
          this.freeSpinAutoplayTimer = null;
        }

        // Use the same timing as normal autoplay (500ms base with turbo multiplier)
        const baseDelay = 500;
        const turboDelay = gameStateManager.isTurbo ? 
          baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
        console.log(`[Symbols] Scheduling next free spin after dialog close in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);

        this.freeSpinAutoplayTimer = this.scene.time.delayedCall(turboDelay, () => {
          this.performFreeSpinAutoplay();
        });
      }
    });

  }

  /**
   * Ensure all symbols are in their base PNG state before spin animation
   */
  public ensureCleanSymbolState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }
    
    console.log('[Symbols] Ensuring clean symbol state for spin');
    let convertedCount = 0;
    
    // Convert any Spine symbols back to PNG without destroying them
    // This allows the normal spin animation to work properly
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        
        // Skip sticky wilds during bonus mode so they persist
        if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
          continue;
        }
        
        if (symbol && symbol.animationState) {
          // This is a Spine symbol, convert it back to PNG
          try {
            const symbolValue = this.currentSymbolData?.[col]?.[row];
            if (symbolValue !== undefined) {
              const x = symbol.x;
              const y = symbol.y;
              const spriteKey = 'symbol_' + symbolValue;
              
              if (this.scene.textures.exists(spriteKey)) {
                // Remove from container and destroy spine
                this.container.remove(symbol);
                symbol.destroy();
                
                // Create PNG sprite in its place
                const pngSprite = this.scene.add.sprite(x, y, spriteKey);
                pngSprite.displayWidth = this.displayWidth;
                pngSprite.displayHeight = this.displayHeight;
                
                // Add to container and update reference
                this.container.add(pngSprite);
                this.symbols[col][row] = pngSprite;
                convertedCount++;
                
                console.log(`[Symbols] Converted Spine to PNG at (${col}, ${row}): ${spriteKey}`);
              }
            }
          } catch (error) {
            console.error(`[Symbols] Error converting Spine symbol at (${col}, ${row}):`, error);
          }
        }
      }
    }
    
    if (convertedCount > 0) {
      console.log(`[Symbols] Converted ${convertedCount} Spine symbols back to PNG for spin`);
    }
  }

  private onSpinDone(scene: Game) {
    gameEventManager.on(GameEventType.REELS_STOP, (data: any) => {
      console.log('[Symbols] REELS_STOP event received');
      
      // Check if scatter animation is in progress - if so, don't trigger a new spin
      if (this.scatterAnimationManager && this.scatterAnimationManager.isAnimationInProgress()) {
        console.log('[Symbols] REELS_STOP received during scatter bonus - not triggering new spin');
        return;
      }
      
      // Note: Autoplay continuation is now handled in onSpinDataReceived after winline animations complete
      // This prevents conflicts and ensures proper timing
      console.log('[Symbols] REELS_STOP received - autoplay continuation handled separately in onSpinDataReceived');
    });
  }

  private setupDialogEventListeners() {
    // Listen for dialog events to re-enable symbols
    this.scene.events.on('enableSymbols', () => {
      console.log('[Symbols] Re-enabling symbols after dialog transition');
      
      // Make sure symbols container is visible and interactive
      if (this.container) {
        this.container.setAlpha(1);
        this.container.setVisible(true);
        console.log('[Symbols] Symbols container re-enabled and visible');
      }
      
      // Reset any symbol tints/effects that might be active
      this.resetSymbolsState();
    });

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
    });

    // Listen for scatter bonus completion to restore symbol visibility
    this.scene.events.on('scatterBonusCompleted', () => {
      console.log('[Symbols] Scatter bonus completed event received - restoring symbol visibility');
      
      // First stop all Spine animations immediately
      this.stopAllSpineAnimations();
      
      // Then stop all other animations and convert Spine symbols back to PNG
      this.stopAllSymbolAnimations();
      
      // Restore all symbols to visible state
      this.restoreSymbolVisibility();
      
      // Specifically ensure scatter symbols are visible
      this.ensureScatterSymbolsVisible();
      
      // Set up dialog animations complete listener only once
      if (!this.dialogListenerSetup) {
        console.log('[Symbols] Setting up dialog animations complete listener for the first time');
        this.dialogListenerSetup = true;
        
        // Wait for dialog animations (including iris transition) to complete before starting autoplay
        // This ensures the iris transition has fully completed before starting autoplay
        // Then wait an additional 3000ms before starting autoplay
        console.log('[Symbols] Waiting for dialog animations to complete before triggering free spins autoplay');
        this.scene.events.once('dialogAnimationsComplete', () => {
          console.log('[Symbols] Dialog animations complete - waiting additional 3000ms before starting autoplay');
          // Add 3000ms delay AFTER the iris transition completes
          this.scene.time.delayedCall(1000, () => {
            console.log('[Symbols] Additional 1200ms delay completed - now triggering autoplay for free spins');
            this.triggerAutoplayForFreeSpins();
          });
        });
      } else {
        console.log('[Symbols] Dialog animations complete listener already set up, skipping duplicate setup');
      }
      
      console.log('[Symbols] Symbol visibility restored after scatter bonus completion');
    });

    // Listen for reels stop to continue free spin autoplay
    gameEventManager.on(GameEventType.REELS_STOP, () => {
      if (this.freeSpinAutoplayActive && this.freeSpinAutoplayWaitingForReelsStop) {
        console.log('[Symbols] REELS_STOP received - continuing free spin autoplay');
        // Reset the waiting flag immediately to prevent multiple responses
        this.freeSpinAutoplayWaitingForReelsStop = false;
        this.continueFreeSpinAutoplay();
      }
    });
  }

  /**
   * Get the configured scale for a specific symbol's Spine animation
   */
  public getSpineSymbolScale(symbolValue: number): number {
    return this.spineSymbolScales[symbolValue] || 0.6; // Default scale if not configured
  }

  /**
   * Restore symbol visibility for new spin
   */
  public restoreSymbolVisibility(): void {
    console.log('[Symbols] Restoring symbol visibility for new spin');
    
    // Reset container alpha
    if (this.container) {
      this.container.setAlpha(1);
      console.log('[Symbols] Container alpha reset to 1');
    }
    
    // Reset visibility of any symbols that might have been hidden
    if (this.symbols && this.symbols.length > 0) {
      let resetCount = 0;
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (!symbol) continue;

          // Default: show symbol
          if (typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            visibleCount++;
          }
          resetCount++;

          // During bonus, if a sticky wild Spine exists here AND this PNG is a wildcard, keep it hidden
          if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
            try {
              const textureKey: string | undefined = symbol.texture?.key;
              const isWildByTexture = typeof textureKey === 'string' && (/^symbol_\d+$/).test(textureKey)
                ? (() => { const n = parseInt(textureKey.split('_')[1], 10); return WILDCARD_SYMBOLS.includes(n); })()
                : false;
              const valueFromData = this.currentSymbolData?.[col]?.[row];
              const isWildByData = typeof valueFromData === 'number' && WILDCARD_SYMBOLS.includes(valueFromData);
              if (isWildByTexture || isWildByData) {
                if (typeof symbol.setAlpha === 'function') {
                  symbol.setAlpha(0);
                } else if (typeof symbol.setVisible === 'function') {
                  symbol.setVisible(false);
                }
              }
            } catch {}
          }
        }
      }
      console.log(`[Symbols] Restored visibility for ${resetCount} symbols, set ${visibleCount} to visible`);
      
      // Also log the current state of the container
      if (this.container) {
        console.log(`[Symbols] Container alpha after restore: ${this.container.alpha}, visible: ${this.container.visible}`);
      }
      
      // Log the state of any scatter symbols specifically
      this.logScatterSymbolsState();
      
      // Force all symbols to be visible as a final safety measure
      this.forceAllSymbolsVisible();
    }
  }

  /**
   * Log the current state of scatter symbols for debugging
   */
  private logScatterSymbolsState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }
    
    let scatterCount = 0;
    let visibleScatterCount = 0;
    
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
          scatterCount++;
          if (symbol.visible) {
            visibleScatterCount++;
          }
          console.log(`[Symbols] Scatter symbol at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}, inContainer=${symbol.parentContainer === this.container}`);
        }
      }
    }
    
    console.log(`[Symbols] Scatter symbols state: ${visibleScatterCount}/${scatterCount} visible`);
  }

  /**
   * Stop all Spine animations on symbols (without converting them)
   */
  public stopAllSpineAnimations(): void {
    console.log('[Symbols] Stopping all Spine animations on symbols...');
    
    if (this.symbols && this.symbols.length > 0) {
      let spineAnimationsStopped = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.animationState) {
            try {
              if (symbol.animationState.clearTracks) {
                symbol.animationState.clearTracks();
                spineAnimationsStopped++;
                console.log(`[Symbols] Stopped Spine animation at (${row}, ${col})`);
              }
            } catch (error) {
              console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
            }
          }
        }
      }
      
      console.log(`[Symbols] Stopped ${spineAnimationsStopped} Spine animations`);
    }
  }

  /**
   * Stop all active animations on symbols and convert Spine symbols back to PNG
   */
  public stopAllSymbolAnimations(): void {
    console.log('[Symbols] Stopping all active symbol animations and converting Spine symbols back to PNG...');
    
    if (this.symbols && this.symbols.length > 0) {
      let animationsStopped = 0;
      let spineSymbolsConverted = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol) {
            // Kill any active tweens on this symbol
            this.scene.tweens.killTweensOf(symbol);
            animationsStopped++;
            
            // Check if this is a Spine animation (winning symbol) and convert it back to PNG
            if (symbol.animationState) {
              // Stop the Spine animation immediately
              try {
                if (symbol.animationState.clearTracks) {
                  symbol.animationState.clearTracks();
                  console.log(`[Symbols] Stopped Spine animation at (${row}, ${col})`);
                }
              } catch (error) {
                console.warn(`[Symbols] Could not stop Spine animation at (${row}, ${col}):`, error);
              }
              
              // Convert back to PNG if we have the data
              if (this.currentSymbolData) {
                try {
                  console.log(`[Symbols] Converting Spine symbol back to PNG at (${row}, ${col})`);
                  
                  // Get the original symbol value from currentSymbolData
                  const symbolValue = this.currentSymbolData[col]?.[row];
                  if (symbolValue !== undefined) {
                    const x = symbol.x;
                    const y = symbol.y;
                    const spriteKey = 'symbol_' + symbolValue;
                    
                    if (this.scene.textures.exists(spriteKey)) {
                      // Remove from container and destroy Spine object
                      this.container.remove(symbol);
                      symbol.destroy();
                      
                      // Create PNG sprite in its place
                      const pngSprite = this.scene.add.sprite(x, y, spriteKey);
                      pngSprite.displayWidth = this.displayWidth;
                      pngSprite.displayHeight = this.displayHeight;
                      
                      // Add to container and update reference
                      this.container.add(pngSprite);
                      this.symbols[col][row] = pngSprite;
                      
                      spineSymbolsConverted++;
                      console.log(`[Symbols] Successfully converted Spine to PNG at (${row}, ${col}): ${spriteKey}`);
                    } else {
                      console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist for conversion`);
                    }
                  }
                } catch (error) {
                  console.error(`[Symbols] Error converting Spine symbol at (${row}, ${col}):`, error);
                }
              } else {
                console.warn(`[Symbols] Cannot convert Spine symbol at (${row}, ${col}): currentSymbolData not available`);
              }
            }
          }
        }
      }
      
      console.log(`[Symbols] Stopped animations on ${animationsStopped} symbols, converted ${spineSymbolsConverted} Spine symbols to PNG`);
    }
    
    // Also kill any tweens on the container
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      console.log('[Symbols] Container tweens killed');
    }
  }

  /**
   * Specifically ensure scatter symbols are visible
   */
  public ensureScatterSymbolsVisible(): void {
    console.log('[Symbols] Specifically ensuring scatter symbols are visible');
    
    if (this.symbols && this.symbols.length > 0) {
      let scatterFound = 0;
      let scatterMadeVisible = 0;
      
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && symbol.texture && symbol.texture.key === 'symbol_0') {
            scatterFound++;
            
            if (typeof symbol.setVisible === 'function') {
              symbol.setVisible(true);
              scatterMadeVisible++;
              console.log(`[Symbols] Made scatter symbol visible at (${row}, ${col}): visible=${symbol.visible}, alpha=${symbol.alpha}`);
            }
          }
        }
      }
      
      console.log(`[Symbols] Found ${scatterFound} scatter symbols, made ${scatterMadeVisible} visible`);
      
      // Log the state after making them visible
      if (scatterFound > 0) {
        console.log('[Symbols] Scatter symbols state after ensuring visibility:');
        this.logScatterSymbolsState();
      }
    }
  }

  /**
   * Force all symbols to be visible (for debugging and recovery)
   */
  public forceAllSymbolsVisible(): void {
    console.log('[Symbols] Force setting all symbols to visible');
    
    if (this.symbols && this.symbols.length > 0) {
      let forceVisibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            forceVisibleCount++;
          }
        }
      }
      console.log(`[Symbols] Force set ${forceVisibleCount} symbols to visible`);
    }
    
    // Also ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container forced to visible with alpha 1');
    }
  }

  /**
   * Reset any Spine symbols back to PNG sprites (called when spin button is clicked)
   */
  public resetSpineSymbolsToPNG(): void {
    if (!this.symbols || this.symbols.length === 0) {
      console.warn('[Symbols] Cannot reset: symbols array is empty or null');
      return;
    }
    
    if (!this.currentSymbolData) {
      console.warn('[Symbols] Cannot reset: currentSymbolData is null');
      return;
    }
    
    console.log('[Symbols] Resetting Spine symbols back to PNG sprites');
    console.log('[Symbols] Current symbol data:', this.currentSymbolData);
    
    let spineCount = 0;
    let pngCount = 0;
    let resetCount = 0;
    
    // First, let's see what we have before cleanup
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
          if (symbol.animationState) {
            spineCount++;
            console.log(`[Symbols] Found Spine symbol at (${col}, ${row}): ${symbol.constructor.name}`);
          } else {
            pngCount++;
            console.log(`[Symbols] Found PNG symbol at (${col}, ${row}): ${symbol.texture?.key || 'unknown'}`);
          }
        } else {
          console.log(`[Symbols] Empty slot at (${col}, ${row})`);
        }
      }
    }
    
    console.log(`[Symbols] Before cleanup: ${spineCount} Spine symbols, ${pngCount} PNG symbols`);
    
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        
        // Check if this is a Spine object (has animationState property)
        if (symbol && symbol.animationState) {
          console.log(`[Symbols] Processing Spine symbol at (${col}, ${row})`);
          
          try {
            // Get the original symbol value from stored data
            const symbolValue = this.currentSymbolData[col][row];
            console.log(`[Symbols] Symbol value for (${col}, ${row}): ${symbolValue}`);
            
            if (symbolValue !== undefined) {
              
              // Store original position and dimensions
              const x = symbol.x;
              const y = symbol.y;
              console.log(`[Symbols] Position: (${x}, ${y}), Size: ${this.displayWidth}x${this.displayHeight}`);
              
              // Destroy the Spine object
              symbol.destroy();
              
              // Create PNG sprite in its place
              const spriteKey = 'symbol_' + symbolValue;
              console.log(`[Symbols] Creating PNG sprite with key: ${spriteKey}`);
              
              // Check if the sprite texture exists
              if (!this.scene.textures.exists(spriteKey)) {
                console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist!`);
                console.log('[Symbols] Available textures:', this.scene.textures.getTextureKeys().filter(key => key.includes('symbol')));
                continue;
              }
              
              const pngSprite = this.scene.add.sprite(x, y, spriteKey);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;
              
              // Add to container and update reference
              this.container.add(pngSprite);
              this.symbols[col][row] = pngSprite;
              
              resetCount++;
              console.log(`[Symbols] Successfully reset Spine symbol back to PNG: ${spriteKey} at (${col}, ${row})`);
            } else {
              console.warn(`[Symbols] Symbol value is undefined for (${col}, ${row})`);
            }
          } catch (error) {
            console.error(`[Symbols] Failed to reset Spine symbol at (${col}, ${row}):`, error);
          }
        }
      }
    }
    
    console.log(`[Symbols] Reset complete: Found ${spineCount} Spine symbols, successfully reset ${resetCount}`);
  }

  public resetSymbolsState() {
    // Reset any active symbol animations or tints
    if (this.symbols && this.symbols.length > 0) {
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          // Skip resetting sticky wild spines during bonus mode
          if (gameStateManager.isBonus && this.hasStickyWildAt(col, row)) {
            // Ensure underlying wildcard PNG stays hidden if present
            try {
              const textureKey: string | undefined = symbol?.texture?.key;
              const isWildByTexture = typeof textureKey === 'string' && (/^symbol_\d+$/).test(textureKey)
                ? (() => { const n = parseInt(textureKey.split('_')[1], 10); return WILDCARD_SYMBOLS.includes(n); })()
                : false;
              const valueFromData = this.currentSymbolData?.[col]?.[row];
              const isWildByData = typeof valueFromData === 'number' && WILDCARD_SYMBOLS.includes(valueFromData);
              if (isWildByTexture || isWildByData) {
                if (symbol?.setAlpha) symbol.setAlpha(0);
                else if (symbol?.setVisible) symbol.setVisible(false);
              }
            } catch {}
            continue;
          }
          if (symbol && symbol.active) {
            // Check if symbol has the required methods before calling them
            if (typeof symbol.clearTint === 'function') {
              symbol.clearTint();
            }
            if (typeof symbol.setBlendMode === 'function') {
              symbol.setBlendMode(Phaser.BlendModes.NORMAL);
            }
            if (typeof symbol.setAlpha === 'function') {
              symbol.setAlpha(1);
            }
            
            // Stop any active tweens on this symbol
            this.scene.tweens.killTweensOf(symbol);

            // Restore base transforms if breathing data is present
            try {
              if (typeof symbol.getData === 'function') {
                const bx = symbol.getData('baseScaleX');
                const by = symbol.getData('baseScaleY');
                const br = symbol.getData('baseRotation');
                if (typeof bx === 'number' && typeof by === 'number' && typeof symbol.setScale === 'function') {
                  symbol.setScale(bx, by);
                }
                if (typeof br === 'number' && typeof symbol.setRotation === 'function') {
                  symbol.setRotation(br);
                }
              }
            } catch {}
          }
        }
      }
      console.log('[Symbols] Reset symbols state - cleared tints and stopped animations');
    }
  }

  /**
   * Manually trigger win line drawing (for testing)
   */
  public showWinLines(data: Data): void {
    if (this.winLineDrawer && data.wins && data.wins.allMatching.size > 0) {
      this.winLineDrawer.drawWinLines(data); // Now starts looping automatically
    }
  }

  /**
   * Clear win lines and stop looping
   */
  public clearWinLines(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.stopLooping();
      this.winLineDrawer.clearLines();
    }
  }

  /**
   * Ensure sticky wild overlay stays visible across spins during bonus
   */
  public restoreStickyWildsVisibility(): void {
    if (this.stickyWildsContainer) {
      this.stickyWildsContainer.setVisible(true);
      this.stickyWildsContainer.setAlpha(1);
    }
  }

  /**
   * Check if there are currently visible wins (win lines or overlay)
   */
  public hasCurrentWins(): boolean {
    // Check if win line drawer has active lines
    const hasWinLines = this.winLineDrawer && this.winLineDrawer.hasActiveLines();
    
    // Check if black overlay is visible
    const hasOverlay = this.overlayRect && this.overlayRect.visible;
    
    return hasWinLines || (hasOverlay ?? false);
  }

  /**
   * Create semi-transparent rectangle overlay above symbols
   */
  private createOverlayRect(): void {
    if (this.overlayRect) {
      this.overlayRect.destroy();
    }
    
    // Create overlay graphics
    this.overlayRect = this.scene.add.graphics();
    
    // Set semi-transparent black fill
    this.overlayRect.fillStyle(0x000000, 0.7);
    
    // Fill rectangle covering the symbol grid area
    const gridBounds = this.getSymbolGridBounds();
    this.overlayRect.fillRect(
      gridBounds.x, 
      gridBounds.y, 
      gridBounds.width, 
      gridBounds.height
    );
    
    // Set depth to be above symbols but below winning symbols
    this.overlayRect.setDepth(500);
    
    // Hide by default
    this.overlayRect.setVisible(false);
    
    console.log('[Symbols] Semi-transparent overlay rectangle created (hidden by default)');
  }

  /**
   * Show overlay for winning patterns with fade in animation
   */
  public showWinningOverlay(): void {
    if (!this.overlayRect) {
      this.createOverlayRect();
    }
    if (this.overlayRect) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);
      
      // If already visible, ensure full opacity and avoid re-tweening to prevent flicker
      if (this.overlayRect.visible && this.overlayRect.alpha >= 1) {
        this.overlayRect.setAlpha(1);
        console.log('[Symbols] Winning overlay already visible - ensuring alpha 1');
        return;
      }
      
      // Set initial state for fade in
      this.overlayRect.setVisible(true);
      this.overlayRect.setAlpha(0);
      
      // Animate fade in
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 1,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => {
          console.log('[Symbols] Winning overlay fade in completed');
        }
      });
    }
    console.log('[Symbols] Winning overlay fade in started');
  }

  /**
   * Hide the overlay with fade out animation
   */
  public hideWinningOverlay(): void {
    if (this.overlayRect && this.overlayRect.visible) {
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);
      
      // Animate fade out
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 0,
        duration: 200,
        ease: 'Power2.easeIn',
        onComplete: () => {
          if (this.overlayRect) {
            this.overlayRect.setVisible(false);
          }
          console.log('[Symbols] Winning overlay fade out completed');
        }
      });
      console.log('[Symbols] Winning overlay fade out started');
    }
  }


  /**
   * Move winning symbols to appear in front of the overlay
   */
  public moveWinningSymbolsToFront(data: Data): void {
    if (!data.wins || data.wins.allMatching.size === 0) {
      console.log('[Symbols] No wins to move to front');
      return;
    }

    // Collect all unique winning grids from all win patterns
    const allWinningGrids = new Set<string>();
    const uniqueGrids: { x: number, y: number }[] = [];

    for (const winningGrids of data.wins.allMatching.values()) {
      for (const grid of winningGrids) {
        const gridKey = `${grid.x},${grid.y}`;
        if (!allWinningGrids.has(gridKey)) {
          allWinningGrids.add(gridKey);
          uniqueGrids.push({ x: grid.x, y: grid.y });
        }
      }
    }

    console.log(`[Symbols] Found ${uniqueGrids.length} unique winning symbols to move to front`);

    // Set depth of winning symbols to be above the overlay
    let movedCount = 0;
    for (const grid of uniqueGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x] && !this.symbols[grid.y][grid.x].destroyed) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);
        
        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);
        
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        console.log(`[Symbols] Symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${uniqueGrids.length} winning symbols to front`);
  }

  /**
   * Reset all symbol depths to default and move them back to container
   */
  public resetSymbolDepths(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }

    let resetCount = 0;
    let scatterSymbolsReset = 0;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];

        // Skip empty slots
        if (!symbol) {
          continue;
        }

        // Guard against symbols that have been detached from any scene
        const symbolScene = (symbol as any).scene;
        if (!symbolScene) {
          console.warn(`[Symbols] Skipping depth reset for symbol at (${col}, ${row}) without valid scene reference`);
          continue;
        }

        // Check if this is a Spine scatter symbol and reset it to normal sprite
        if (symbol.animationState && symbol.texture && symbol.texture.key.includes('symbol_0_spine')) {
          try {
            console.log(`[Symbols] Resetting scatter symbol at (${col}, ${row}) back to normal sprite`);

            // Unregister the scatter symbol from ScatterAnimationManager
            if (this.scatterAnimationManager) {
              this.scatterAnimationManager.unregisterScatterSymbol(symbol);
            }

            // Store position and scale for the new sprite
            const x = symbol.x;
            const y = symbol.y;
            const displayWidth = symbol.displayWidth;
            const displayHeight = symbol.displayHeight;

            // Destroy the Spine animation
            symbol.destroy();

            // Create regular sprite in its place
            const regularSprite = symbolScene.add.sprite(x, y, 'symbol_0');
            regularSprite.setOrigin(0.5, 0.5);
            regularSprite.displayWidth = displayWidth;
            regularSprite.displayHeight = displayHeight;
            regularSprite.setDepth(0); // Reset to normal depth

            // Add to container and update symbols array
            this.container.add(regularSprite);
            this.symbols[col][row] = regularSprite;

            scatterSymbolsReset++;
            console.log(`[Symbols] Successfully reset scatter symbol to normal sprite at (${col}, ${row})`);

          } catch (error) {
            console.warn(`[Symbols] Error resetting scatter symbol at (${col}, ${row}):`, error);
          }
        } else {
          // Move symbol back to container if it's not already there
          if (symbol.parentContainer !== this.container) {
            symbolScene.children.remove(symbol);
            this.container.add(symbol);
          }
          if (typeof symbol.setDepth === 'function') {
            symbol.setDepth(0); // Reset to default depth
          }
        }
        resetCount++;
      }
    }
    console.log(`[Symbols] Reset depths and container for ${resetCount} symbols (${scatterSymbolsReset} scatter symbols converted to normal sprites)`);
  }

  public moveScatterSymbolsToFront(data: Data, scatterGrids: any[]): void {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to move to front');
      return;
    }

    console.log(`[Symbols] Moving ${scatterGrids.length} scatter symbols to front`);

    // Set depth of scatter symbols to be above the overlay
    let movedCount = 0;
    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];
        console.log(`[Symbols] Moving scatter symbol at (${grid.x}, ${grid.y}) to front, current depth:`, symbol.depth);
        
        // Remove symbol from container and add directly to scene for independent depth control
        this.container.remove(symbol);
        this.scene.add.existing(symbol);
        
        if (typeof symbol.setDepth === 'function') {
          symbol.setDepth(600); // Above overlay (500) but below win lines (1000)
        }
        console.log(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${scatterGrids.length} scatter symbols to front`);
  }

  /**
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(mockData: any): void {
    console.log('[Symbols] Starting scatter animation sequence');
    
    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    this.stopAllSymbolAnimations();
    this.hideAllSymbols();
    this.hideWinningOverlay();
    this.clearWinLines();
    
    // Hide winnings display when scatter animation starts
    const header = (this.scene as any).header;
    if (header && typeof header.hideWinningsDisplay === 'function') {
      console.log('[Symbols] Hiding winnings display for scatter animation');
      header.hideWinningsDisplay();
    } else {
      console.warn('[Symbols] Header not available or hideWinningsDisplay method not found');
    }
    
    // Then trigger the scatter animation sequence (spinner, dialog, etc.)
    if (this.scatterAnimationManager) {
      console.log('[Symbols] Starting scatter animation sequence');
      this.scatterAnimationManager.playScatterAnimation(mockData);
    } else {
      console.warn('[Symbols] ScatterAnimationManager not available');
    }
  }

  /**
   * Animate scatter symbols with Spine animations (no winlines)
   */
  public async animateScatterSymbols(data: Data, scatterGrids: any[]): Promise<void> {
    if (scatterGrids.length === 0) {
      console.log('[Symbols] No scatter symbols to animate');
      return;
    }

    console.log(`[Symbols] Starting scatter symbol Spine animation for ${scatterGrids.length} symbols`);

    // Replace scatter symbols with Spine animations
    const animationPromises = scatterGrids.map(grid => {
      return new Promise<void>((resolve) => {
        // Note: scatterGrids coordinates are [row][col] from transposed data
        // but this.symbols array is [col][row] format, so we need to swap coordinates
        const col = grid.x; // grid.x is actually the column in transposed data
        const row = grid.y; // grid.y is actually the row in transposed data
        
        console.log(`[Symbols] ScatterGrid coordinates: grid.x=${grid.x}, grid.y=${grid.y} -> col=${col}, row=${row}`);
        console.log(`[Symbols] Accessing this.symbols[${col}][${row}]`);
        
        if (this.symbols && this.symbols[col] && this.symbols[col][row]) {
          const currentSymbol = this.symbols[col][row];
          
          try {
            // Get the scatter symbol value (0) and construct the Spine key
            const symbolValue = 0; // Symbol 0 is scatter
            const spineKey = `symbol_${symbolValue}_spine`;
            const spineAtlasKey = spineKey + '-atlas';
            const symbolName = `Symbol${symbolValue}_KA`;
            const hitAnimationName = `${symbolName}_hit`;
            
            // Store original position and scale
            const x = currentSymbol.x;
            const y = currentSymbol.y;
            const displayWidth = currentSymbol.displayWidth;
            const displayHeight = currentSymbol.displayHeight;
            
            console.log(`[Symbols] Replacing scatter sprite with Spine animation: ${spineKey} at column ${col}, row ${row}`);
            
            // Remove the current sprite
            currentSymbol.destroy();

            const attemptCreate = (attempts: number) => {
              try {
                if (!(this.scene.cache.json as any).has(spineKey)) {
                  if (attempts < 5) {
                    console.warn(`[Symbols] Spine json '${spineKey}' not ready. Retrying (${attempts + 1}/5)...`);
                    this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                    return;
                  }
                }
                // Create Spine animation in its place
                const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
                spineSymbol.setOrigin(0.5, 0.5);
                
                // Start with the configured base scale
                const configuredScale = this.getSpineSymbolScale(symbolValue);
                spineSymbol.setScale(configuredScale);
                
                // Add to scene directly (not container) to maintain elevated depth above overlay
                this.scene.add.existing(spineSymbol);
                this.symbols[col][row] = spineSymbol;
                
                // Register the scatter symbol with the ScatterAnimationManager
                if (this.scatterAnimationManager) {
                  this.scatterAnimationManager.registerScatterSymbol(spineSymbol);
                }
                
                // Ensure the Spine animation maintains the elevated depth
                spineSymbol.setDepth(600); // Above overlay (500) but below win lines (1000)
                
                console.log(`[Symbols] Successfully replaced scatter sprite with Spine animation at column ${col}, row ${row} with depth:`, spineSymbol.depth);
                
                // Play the hit animation (looped)
                spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
                console.log(`[Symbols] Playing looped scatter animation: ${hitAnimationName}`);
                
                // Create smooth scale tween to increase size by 20%
                const enlargedScale = configuredScale * 1.5; // Increase by 20%
                this.scene.tweens.add({
                  targets: spineSymbol,
                  scaleX: enlargedScale,
                  scaleY: enlargedScale,
                  duration: 500, // Smooth 500ms transition
                  ease: 'Power2.easeOut', // Smooth easing
                  onComplete: () => {
                    console.log(`[Symbols] Scatter symbol scale tween completed: ${configuredScale} → ${enlargedScale}`);
                  }
                });
                
                console.log(`[Symbols] Applied smooth scale tween: ${configuredScale} → ${enlargedScale} to scatter symbol ${symbolValue}`);
                
                // Resolve after a short delay to allow animation to start
                setTimeout(() => resolve(), 100);
              } catch (e) {
                if (attempts < 5) {
                  this.scene.time.delayedCall(150, () => attemptCreate(attempts + 1));
                  return;
                }
                throw e;
              }
            };
            attemptCreate(0);
            
          } catch (error) {
            console.warn(`[Symbols] Failed to replace scatter sprite with Spine animation at column ${col}, row ${row}:`, error);
            
            // Fallback to the old pulse method if Spine replacement fails
            if (this.symbols[col] && this.symbols[col][row]) {
              const symbol = this.symbols[col][row];
              
              // Pulse effect: scale up and down with glow
              this.scene.tweens.add({
                targets: symbol,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 300,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: 2, // Pulse 3 times total
                onComplete: () => {
                  resolve();
                }
              });
              
              // Add glow effect - check if methods exist before calling
              if (typeof symbol.setTint === 'function') {
                symbol.setTint(0x00FFFF); // Cyan tint for scatter
              }
              if (typeof symbol.setBlendMode === 'function') {
                symbol.setBlendMode(Phaser.BlendModes.ADD);
              }
            } else {
              resolve();
            }
          }
        } else {
          resolve();
        }
      });
    });
    
    // Wait for all Spine animations to start
    await Promise.all(animationPromises);
    
    // Wait longer for the animations to play and scale tween to complete
    // Apply turbo mode to the delay for consistent timing
    const baseDelay = 3000;
    const turboMultiplier = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
    const adjustedDelay = baseDelay * turboMultiplier;
    console.log(`[Symbols] Scatter animation delay: base=${baseDelay}ms, turbo=${gameStateManager.isTurbo}, adjusted=${adjustedDelay}ms`);
    await this.delay(adjustedDelay);
    
    console.log('[Symbols] Scatter symbol Spine animation completed');
  }

  /**
   * Helper method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => {
        resolve();
      });
    });
  }

  /**
   * Hide all symbols (including scatter symbols) by setting container alpha to 0
   */
  public hideAllSymbols(): void {
    if (this.container) {
      console.log('[Symbols] Hiding all symbols by setting container alpha to 0');
      this.container.setAlpha(0);
    }
  }

  /**
   * Hide scatter symbols specifically (they're on the scene, not in container)
   * Converts Spine symbols back to PNG and moves them to the container for proper hiding
   */
  public hideScatterSymbols(scatterGrids: any[]): void {
    if (!scatterGrids || scatterGrids.length === 0) {
      return;
    }

    console.log(`[Symbols] Hiding ${scatterGrids.length} scatter symbols and converting back to PNG`);
    
    let convertedCount = 0;
    let hiddenCount = 0;
    
    for (const grid of scatterGrids) {
      if (this.symbols && this.symbols[grid.y] && this.symbols[grid.y][grid.x]) {
        const symbol = this.symbols[grid.y][grid.x];
        
        // Check if this is a Spine animation (has animationState)
        if (symbol.animationState) {
          console.log(`[Symbols] Converting scatter Spine symbol back to PNG at (${grid.x}, ${grid.y})`);
          
          try {
            // Get the scatter symbol value (0) and create PNG sprite
            const symbolValue = 0; // Symbol 0 is scatter
            const spriteKey = 'symbol_' + symbolValue;
            
            // Store original position
            const x = symbol.x;
            const y = symbol.y;
            
            // Check if the sprite texture exists
            if (this.scene.textures.exists(spriteKey)) {
              // Remove from scene and destroy Spine object
              this.scene.children.remove(symbol);
              symbol.destroy();
              
              // Create PNG sprite in its place
              const pngSprite = this.scene.add.sprite(x, y, spriteKey);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;
              
              // Add to container and update reference
              this.container.add(pngSprite);
              this.symbols[grid.y][grid.x] = pngSprite;
              
              convertedCount++;
              console.log(`[Symbols] Successfully converted Spine to PNG at (${grid.x}, ${grid.y}): ${spriteKey}`);
            } else {
              console.error(`[Symbols] Sprite texture '${spriteKey}' does not exist for scatter symbol conversion`);
            }
          } catch (error) {
            console.error(`[Symbols] Error converting scatter Spine symbol at (${grid.x}, ${grid.y}):`, error);
          }
        } else {
          console.log(`[Symbols] Scatter symbol at (${grid.x}, ${grid.y}) is already PNG, no conversion needed`);
        }
        
        // Now hide the symbol (whether it's PNG or was just converted)
        const currentSymbol = this.symbols[grid.y][grid.x];
        if (currentSymbol && typeof currentSymbol.setVisible === 'function') {
          currentSymbol.setVisible(false);
          hiddenCount++;
          console.log(`[Symbols] Hidden symbol at (${grid.x}, ${grid.y}), visible: ${currentSymbol.visible}`);
        }
      }
    }
    
    console.log(`[Symbols] Successfully converted ${convertedCount} Spine symbols to PNG and hidden ${hiddenCount} total scatter symbols`);
  }

  /**
   * Get the bounds of the symbol grid
   */
  private getSymbolGridBounds(): { x: number, y: number, width: number, height: number } {
    // Add padding to make the overlay slightly larger than the symbol grid
    const paddingX = 9;
    const paddingY = 8;

    const offsetX = 1;
    const offsetY = 0.7;
    
    const x = this.slotX - this.totalGridWidth * 0.5 - paddingX + offsetX;
    const y = this.slotY - this.totalGridHeight * 0.5 - paddingY + offsetY;
    
    return {
      x: x + offsetX,
      y: y + offsetY,
      width: this.totalGridWidth + (paddingX * 2),
      height: this.totalGridHeight + (paddingY * 2)
    };
  }

  /**
   * Apply turbo mode to winline animations
   */
  public setTurboMode(isEnabled: boolean): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.setTurboMode(isEnabled);
      console.log(`[Symbols] Turbo mode ${isEnabled ? 'enabled' : 'disabled'} for winline animations`);
    } else {
      console.warn('[Symbols] WinLineDrawer not available for turbo mode');
    }
  }

  /**
   * Reset winline animations to default timing
   */
  public resetWinlineTiming(): void {
    if (this.winLineDrawer) {
      this.winLineDrawer.resetToDefaultTiming();
      console.log('[Symbols] Winline timing reset to default values');
    } else {
      console.warn('[Symbols] WinLineDrawer not available for timing reset');
    }
  }

  /**
   * Ensure symbols remain visible and in their current state after autoplay is stopped
   */
  public ensureSymbolsVisibleAfterAutoplayStop(): void {
    console.log('[Symbols] Ensuring symbols remain visible after autoplay stop');
    
    // Ensure container is visible
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
      console.log('[Symbols] Container visibility ensured after autoplay stop');
    }
    
    // Ensure all symbols are visible
    if (this.symbols && this.symbols.length > 0) {
      let visibleCount = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        for (let row = 0; row < this.symbols[col].length; row++) {
          const symbol = this.symbols[col][row];
          if (symbol && typeof symbol.setVisible === 'function') {
            symbol.setVisible(true);
            visibleCount++;
          }
        }
      }
      console.log(`[Symbols] Ensured ${visibleCount} symbols are visible after autoplay stop`);
    }
    
    // Clear any winlines that might be showing
    if (this.winLineDrawer) {
      this.winLineDrawer.clearLines();
      console.log('[Symbols] Cleared winlines after autoplay stop');
    }
    
    // Hide any winning overlay that might be showing
    this.hideWinningOverlay();
    console.log('[Symbols] Hidden winning overlay after autoplay stop');
  }

  /**
   * Trigger autoplay for free spins if available
   */
  private triggerAutoplayForFreeSpins(): void {
    // Prevent duplicate triggering - multiple checks for safety
    if (this.freeSpinAutoplayTriggered) {
      console.log('[Symbols] Free spin autoplay already triggered, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if autoplay is already active, don't start another one
    if (this.freeSpinAutoplayActive) {
      console.log('[Symbols] Free spin autoplay already active, skipping duplicate trigger');
      return;
    }
    
    // Additional check: if we're not in bonus mode, don't start free spin autoplay
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] Not in bonus mode, skipping free spin autoplay trigger');
      return;
    }

    let freeSpinsCount = 0;
    
    console.log('[Symbols] ===== TRIGGERING AUTOPLAY FOR FREE SPINS =====');
    console.log('[Symbols] Current state:');
    console.log('  - isBonus:', gameStateManager.isBonus);
    console.log('  - pendingFreeSpinsData:', this.pendingFreeSpinsData);
    console.log('  - currentSpinData:', this.currentSpinData);
    console.log('  - currentSpinData.slot:', this.currentSpinData?.slot);
    console.log('  - currentSpinData.slot.freespin:', this.currentSpinData?.slot?.freespin);
    console.log('  - freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
    console.log('  - freeSpinAutoplayTriggered:', this.freeSpinAutoplayTriggered);
    
    // Check if we have pending free spins data (from scatter bonus activation)
    if (this.pendingFreeSpinsData) {
      freeSpinsCount = this.pendingFreeSpinsData.actualFreeSpins;
      console.log(`[Symbols] Using pending free spins data: ${freeSpinsCount} free spins`);
      
      // Clear the pending data after use
      this.pendingFreeSpinsData = null;
    } 
    // Check if we're in bonus mode and have current spin data with free spins
    else if (gameStateManager.isBonus && this.currentSpinData?.slot?.freespin?.count) {
      freeSpinsCount = this.currentSpinData.slot.freespin?.count || 0;
      console.log(`[Symbols] Using current spin data free spins count: ${freeSpinsCount} free spins`);
    }
    // Check if we have current spin data with free spins (fallback)
    else if (this.currentSpinData?.slot?.freespin?.count) {
      freeSpinsCount = this.currentSpinData.slot.freespin?.count || 0;
      console.log(`[Symbols] Using current spin data free spins count (fallback): ${freeSpinsCount} free spins`);
    }
    
    if (freeSpinsCount > 0) {
      console.log(`[Symbols] Free spins available: ${freeSpinsCount}. Starting free spin autoplay.`);
      
      // Mark as triggered to prevent duplicates
      this.freeSpinAutoplayTriggered = true;
      
      // Start our custom free spin autoplay system
      this.startFreeSpinAutoplay(freeSpinsCount);
    } else {
      console.log('[Symbols] No free spins data available, not triggering autoplay.');
    }
    console.log('[Symbols] ===== END TRIGGERING AUTOPLAY FOR FREE SPINS =====');
  }

  /**
   * Start free spin autoplay using our custom system
   */
  private startFreeSpinAutoplay(spinCount: number): void {
    console.log(`[Symbols] ===== STARTING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Starting free spin autoplay with ${spinCount} spins`);
    
    // Set free spin autoplay state
    this.freeSpinAutoplayActive = true;
    this.freeSpinAutoplaySpinsRemaining = spinCount;
    
    // Set global autoplay state
    gameStateManager.isAutoPlaying = true;
    gameStateManager.isAutoPlaySpinRequested = true;
    this.scene.gameData.isAutoPlaying = true;
    
    // Apply turbo mode to winline animations if turbo is enabled (same as normal autoplay)
    if (gameStateManager.isTurbo) {
      console.log('[Symbols] Applying turbo mode to winline animations for free spin autoplay');
      this.setTurboMode(true);
    }
    
    // Start the first free spin immediately
    this.performFreeSpinAutoplay();
    
    console.log(`[Symbols] Free spin autoplay started with ${spinCount} spins`);
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY STARTED =====`);
  }

  /**
   * Perform a single free spin autoplay
   */
  private async performFreeSpinAutoplay(): Promise<void> {
    if (!this.freeSpinAutoplayActive || this.freeSpinAutoplaySpinsRemaining <= 0) {
      console.log('[Symbols] Free spin autoplay stopped or no spins remaining');
      this.stopFreeSpinAutoplay();
      return;
    }

    console.log(`[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    // Check if win dialog is showing - pause autoplay if so
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - pausing free spin autoplay');
      // Wait for dialog animations to complete instead of using a fixed delay
      console.log('[Symbols] Waiting for dialogAnimationsComplete event before continuing free spin autoplay');
      this.scene.events.once('dialogAnimationsComplete', () => {
        console.log('[Symbols] Dialog animations complete - continuing free spin autoplay');
        // Use the same timing as normal autoplay (1000ms base with turbo multiplier)
        const baseDelay = 500;
        const turboDelay = gameStateManager.isTurbo ? 
          baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
        console.log(`[Symbols] Scheduling free spin retry in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
        this.scene.time.delayedCall(turboDelay, () => {
          this.performFreeSpinAutoplay();
        });
      });
      return;
    }

    try {
      // Use our free spin simulation instead of the old backend
      console.log('[Symbols] Triggering free spin via SlotController...');
      
      // Emit a custom event that SlotController will handle
      gameEventManager.emit(GameEventType.FREE_SPIN_AUTOPLAY);
      
      // Decrement spins remaining
      this.freeSpinAutoplaySpinsRemaining--;
      console.log(`[Symbols] Free spin triggered. ${this.freeSpinAutoplaySpinsRemaining} spins remaining.`);
      
      // Set flag to wait for reels to stop before continuing
      this.freeSpinAutoplayWaitingForReelsStop = true;
      console.log('[Symbols] Waiting for reels to stop before continuing free spin autoplay');
      
    } catch (error) {
      console.error('[Symbols] Free spin autoplay error:', error);
      this.stopFreeSpinAutoplay();
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY COMPLETED =====`);
  }

  /**
   * Continue free spin autoplay after reels stop
   */
  private continueFreeSpinAutoplay(): void {
    console.log(`[Symbols] ===== CONTINUING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we still have spins remaining
    if (this.freeSpinAutoplaySpinsRemaining > 0) {
      // Wait for WIN_STOP event to ensure winlines complete before next spin
      // This is the same approach as normal autoplay - no safety timer needed
      console.log('[Symbols] Waiting for WIN_STOP event before continuing free spin autoplay');
      console.log('[Symbols] Setting freeSpinAutoplayWaitingForWinlines to true');
      this.freeSpinAutoplayWaitingForWinlines = true;
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines is now:', this.freeSpinAutoplayWaitingForWinlines);
    } else {
      console.log('[Symbols] All free spins completed');
      this.stopFreeSpinAutoplay();
    }
    
    console.log(`[Symbols] ===== FREE SPIN AUTOPLAY CONTINUED =====`);
  }

  /**
   * Handle WIN_STOP for free spin autoplay (similar to normal autoplay)
   */
  private handleFreeSpinAutoplayWinStop(): void {
    console.log('[Symbols] handleFreeSpinAutoplayWinStop called - freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
    if (!this.freeSpinAutoplayWaitingForWinlines) {
      console.log('[Symbols] Not waiting for winlines - skipping free spin autoplay continuation');
      return;
    }

    console.log('[Symbols] WIN_STOP received - continuing free spin autoplay after winlines complete');
    this.freeSpinAutoplayWaitingForWinlines = false;
    
    // Clear any existing timer since WIN_STOP fired properly
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }
    
    // Use the same timing as normal autoplay (500ms base with turbo multiplier)
    const baseDelay = 500;
    const turboDelay = gameStateManager.isTurbo ? 
      baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
    console.log(`[Symbols] Scheduling next free spin in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
    
    this.freeSpinAutoplayTimer = this.scene.time.delayedCall(turboDelay, () => {
      this.performFreeSpinAutoplay();
    });
  }

  /**
   * Schedule congrats dialog after free spin autoplay ends
   * Waits for any win dialogs to auto-close (2.5s) plus additional buffer time
   */
  private scheduleCongratsDialogAfterAutoplay(): void {
    console.log('[Symbols] Scheduling congrats dialog after free spin autoplay ends');
    
    // Check if there's currently a win dialog showing
    const gameScene = this.scene as any;
    const hasWinDialog = gameScene.dialogs && gameScene.dialogs.isDialogShowing() && gameScene.dialogs.isWinDialog();
    
    if (hasWinDialog) {
      console.log('[Symbols] Win dialog is currently showing - waiting for auto-close (2.5s) plus buffer time');
      // Wait for win dialog auto-close (2.5s) plus additional buffer time (1s) = 3.5s total
      this.scene.time.delayedCall(3500, () => {
        this.showCongratsDialogAfterDelay();
      });
    } else {
      console.log('[Symbols] No win dialog showing - waiting 1 second before showing congrats');
      // No win dialog, just wait a short buffer time
      this.scene.time.delayedCall(1000, () => {
        this.showCongratsDialogAfterDelay();
      });
    }
  }

  /**
   * Show congrats dialog after the delay period
   */
  private showCongratsDialogAfterDelay(): void {
    console.log('[Symbols] Showing congrats dialog after delay');
    
    // Close any open win dialogs first (safety check)
    const gameScene = this.scene as any;
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }
    
    // Calculate total win from freespinItems
    let totalWin = 0;
    if (this.currentSpinData && this.currentSpinData.slot) {
      const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
      if (freespinData && freespinData.items && Array.isArray(freespinData.items)) {
        totalWin = freespinData.items.reduce((sum: number, item: any) => {
          return sum + (item.subTotalWin || 0);
        }, 0);
        console.log(`[Symbols] Calculated total win from freespinItems: ${totalWin}`);
      }
    }
    
    // Show congrats dialog with total win amount
    if (gameScene.dialogs && typeof gameScene.dialogs.showCongrats === 'function') {
      gameScene.dialogs.showCongrats(this.scene, { winAmount: totalWin });
      console.log(`[Symbols] Congrats dialog shown with total win: ${totalWin}`);
    } else {
      console.warn('[Symbols] Dialogs component not available for congrats dialog');
    }
  }

  /**
   * Stop free spin autoplay
   */
  private stopFreeSpinAutoplay(): void {
    console.log('[Symbols] ===== STOPPING FREE SPIN AUTOPLAY =====');
    
    // Clear timer
    if (this.freeSpinAutoplayTimer) {
      this.freeSpinAutoplayTimer.destroy();
      this.freeSpinAutoplayTimer = null;
    }
    
    // Reset state
    this.freeSpinAutoplayActive = false;
    this.freeSpinAutoplaySpinsRemaining = 0;
    this.freeSpinAutoplayWaitingForReelsStop = false;
    this.freeSpinAutoplayWaitingForWinlines = false;
    this.freeSpinAutoplayTriggered = false;
    this.dialogListenerSetup = false; // Reset dialog listener setup flag
    
    // Reset global autoplay state
    gameStateManager.isAutoPlaying = false;
    gameStateManager.isAutoPlaySpinRequested = false;
    
    // Show congrats dialog after free spin autoplay ends
    //this.scheduleCongratsDialogAfterAutoplay();
    this.scene.gameData.isAutoPlaying = false;
    
    // Restore winline animation timing to normal mode (same as normal autoplay)
    console.log('[Symbols] Restoring winline animation timing to normal mode');
    this.setTurboMode(false);
    
    // Emit AUTO_STOP event to notify other systems
    gameEventManager.emit(GameEventType.AUTO_STOP);
    
    console.log('[Symbols] Free spin autoplay stopped');
    console.log('[Symbols] ===== FREE SPIN AUTOPLAY STOPPED =====');
  }

  /**
   * Check if free spin autoplay is currently active
   */
  public isFreeSpinAutoplayActive(): boolean {
    return this.freeSpinAutoplayActive;
  }

  /**
   * Process spin data directly (for free spin autoplay)
   */
  public async processSpinData(spinData: any): Promise<void> {
    console.log('[Symbols] Processing spin data directly:', spinData);
    
    if (!spinData || !spinData.slot || !spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    // Store the current spin data for access by other components
    this.currentSpinData = spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
    
    // Use the slot.area from SpinData
    const symbols = spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the same logic as before
    await processSpinDataSymbols(this, symbols, spinData);
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.497;
  let centerY = self.scene.scale.height * 0.483;

  self.symbols = [];
  self.newSymbols = [];
  self.displayWidth = 68;
  self.displayHeight = 68;
  self.horizontalSpacing = 10;
  self.verticalSpacing = 5;

  let spacingX = self.horizontalSpacing * (SLOT_ROWS - 1);
  let spacingY = self.verticalSpacing * (SLOT_COLUMNS - 1);
  self.totalGridWidth = (self.displayWidth * SLOT_ROWS) + spacingX;
  self.totalGridHeight = (self.displayHeight * SLOT_COLUMNS) + spacingY;

  self.slotX = centerX;
  self.slotY = centerY;
}

function createContainer(self: Symbols) {
  self.container = self.scene.add.container(0, 0);

  const maskShape = self.scene.add.graphics();
  
  // Add padding to prevent sprite cutoff, especially on the right side
  const maskPaddingLeft = 10;
  const maskPaddingRight = 20; // Extra padding on right side
  const maskPaddingTop = 2;
  const maskPaddingBottom = 10;
  
  maskShape.fillRect(
    self.slotX - self.totalGridWidth * 0.5 - maskPaddingLeft, 
    self.slotY - self.totalGridHeight * 0.5 - maskPaddingTop, 
    self.totalGridWidth + maskPaddingLeft + maskPaddingRight, 
    self.totalGridHeight + maskPaddingTop + maskPaddingBottom
  );

  const mask = maskShape.createGeometryMask();
  self.container.setMask(mask);
  maskShape.setVisible(false);
  
  console.log(`[Symbols] Mask created with padding - Left: ${maskPaddingLeft}, Right: ${maskPaddingRight}, Top: ${maskPaddingTop}, Bottom: ${maskPaddingBottom}`);
}

function onStart(self: Symbols) {
  console.log('[Symbols] onStart called');
  
  // Listen for START event to create initial symbols
  gameEventManager.on(GameEventType.START, () => {
    console.log('[Symbols] START event received, creating initial symbols...');
    
    // Create initial symbols with default data
    createInitialSymbols(self);
  });
}

function createInitialSymbols(self: Symbols) {
  let scene = self.scene;

  // Check if symbol textures are available
  const testKey = 'symbol_0';
  if (!scene.textures.exists(testKey)) {
    console.error('[Symbols] Symbol textures not loaded! Available textures:', Object.keys(scene.textures.list));
    return;
  }
  console.log('[Symbols] Symbol textures are available');

  // Use fixed symbols for testing
  const symbols = [
    [0, 1, 3, 1, 0],  // Column 0: scatter, symbol1, symbol3, symbol1, scatter
    [1, 5, 2, 5, 2],  // Column 1: symbol1, symbol5, symbol2, symbol5, symbol2
    [2, 5, 5, 1, 5]   // Column 2: symbol2, symbol5, symbol5, symbol1, symbol5
  ];
  console.log('[Symbols] Using fixed initial symbols:', symbols);
  
  // Store current symbol data for reset purposes
  self.currentSymbolData = symbols;
  
  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5;
  
  for (let col = 0; col < symbols.length; col++) {
    let rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

      let symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
      symbol.displayWidth = self.displayWidth;
      symbol.displayHeight = self.displayHeight;
      self.container.add(symbol);

      // During bonus: if a sticky wild already exists here and the new symbol is a wildcard (rows 2-4), hide the PNG
      try {
        if (gameStateManager.isBonus && row >= 1 && row <= 3) {
          const val = symbols[col][row];
          if (typeof val === 'number' && WILDCARD_SYMBOLS.includes(val) && self.hasStickyWildAt(col, row)) {
            if (typeof symbol.setAlpha === 'function') {
              symbol.setAlpha(0);
            } else if (typeof symbol.setVisible === 'function') {
              symbol.setVisible(false);
            }
          }
        }
      } catch {}

      rows.push(symbol);
    }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');

  // Start idle animation at game start so symbols breathe on first view
  try {
    self.startIdleAnimationForAll();
  } catch (e) {
    console.warn('[Symbols] Failed to start idle animation at start:', e);
  }
}

/**
 * Process symbols from SpinData (GameAPI response)
 */
async function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols:', symbols);
  
  // Clear all scatter symbols from previous spin
  if (self.scatterAnimationManager) {
    self.scatterAnimationManager.clearScatterSymbols();
  }
  
  // Reset symbols and clear previous state before starting new spin
    console.log('[Symbols] Resetting symbols and clearing previous state for new spin');
    self.ensureCleanSymbolState();
    self.resetSymbolsState();
    
    // Always clear win lines and overlay when a new spin starts
    console.log('[Symbols] Clearing win lines and overlay for new spin');
    self.clearWinLines();
    self.hideWinningOverlay();
    
    self.resetSymbolDepths();
    self.restoreSymbolVisibility();
  
  // Create a mock Data object to use with existing functions
  const mockData = new Data();
  mockData.symbols = symbols;
  
  // Convert SpinData paylines to the format expected by the game
  const convertedWins = convertPaylinesToWinFormat(spinData);
  console.log('[Symbols] Converted SpinData paylines to win format:', convertedWins);
  
  // Create a Wins object with the converted data
  mockData.wins = new Wins(convertedWins);
  
  mockData.balance = 0; // Not used in symbol processing
  mockData.bet = parseFloat(spinData.bet);
  mockData.freeSpins = spinData.slot.freespin?.count || 0;
  
  // Set proper timing for animations
  const baseDelay = DELAY_BETWEEN_SPINS; // 2500ms default
  const adjustedDelay = gameStateManager.isTurbo ? 
    baseDelay * TurboConfig.TURBO_SPEED_MULTIPLIER : baseDelay;
  
  console.log('[Symbols] Setting animation timing:', {
    baseDelay,
    isTurbo: gameStateManager.isTurbo,
    adjustedDelay
  });
  
  // Set the timing in the mock data
  mockData.delayBetweenSpins = adjustedDelay;
  
  // Apply timing to GameData for animations
  setSpeed(self.scene.gameData, adjustedDelay);
  
  // Set spinning state
  gameStateManager.isReelSpinning = true;
  
  // Use the existing createNewSymbols function
  createNewSymbols(self, mockData);
  
  // Use the existing dropReels function
  await dropReels(self, mockData);
  
  // Update symbols after animation
    disposeSymbols(self.symbols);
    self.symbols = self.newSymbols;
    self.newSymbols = [];
  
  // Replace with spine animations if needed
  replaceWithSpineAnimations(self, mockData);
  
  // Add sticky wilds during bonus mode on rows 2-4 (rows index 1..3)
  try {
    if (gameStateManager.isBonus && self.symbols && mockData.symbols) {
      for (let col = 0; col < mockData.symbols.length; col++) {
        for (let row = 1; row <= 3 && row < mockData.symbols[col].length; row++) {
          const val = mockData.symbols[col][row];
          if (typeof val === 'number' && WILDCARD_SYMBOLS.includes(val)) {
            if (typeof (self as any).addStickyWildAt === 'function') {
              (self as any).addStickyWildAt(col, row, val);
              // Ensure the newly dropped base symbol is hidden if sticky already exists
              try {
                const base = self.symbols?.[col]?.[row];
                if (base?.setVisible) base.setVisible(false);
                else if (base?.setAlpha) base.setAlpha(0);
              } catch {}
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Symbols] Error while adding sticky wilds:', e);
  }
  
  // Check for scatter symbols and trigger scatter bonus if found
  console.log('[Symbols] Checking for scatter symbols...');
  console.log('[Symbols] MockData symbols:', mockData.symbols);
  console.log('[Symbols] SCATTER_SYMBOL from Data:', Data.SCATTER);
  
  // Create a transposed copy for scatter detection since SymbolDetector expects [row][col] format
  // but SpinData provides [col][row] format
  const transposedSymbols: number[][] = [];
  for (let row = 0; row < mockData.symbols[0].length; row++) {
    transposedSymbols[row] = [];
    for (let col = 0; col < mockData.symbols.length; col++) {
      transposedSymbols[row][col] = mockData.symbols[col][row];
    }
  }
  
  // Create a temporary Data object with transposed symbols for scatter detection
  const scatterData = new Data();
  scatterData.symbols = transposedSymbols;
  console.log('[Symbols] Transposed symbols for scatter detection:', transposedSymbols);
  
  const scatterGrids = self.symbolDetector.getScatterGrids(scatterData);
  console.log('[Symbols] ScatterGrids found:', scatterGrids);
  console.log('[Symbols] ScatterGrids length:', scatterGrids.length);
  
  // Check if this win meets the dialog threshold and pause autoplay if so
  if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
    const totalWin = calculateTotalWinFromPaylines(spinData.slot.paylines);
    const betAmount = parseFloat(spinData.bet);
    const multiplier = totalWin / betAmount;
    
    if (multiplier >= 20) {
      console.log(`[Symbols] Win meets dialog threshold (${multiplier.toFixed(2)}x) - pausing autoplay immediately`);
      gameStateManager.isShowingWinDialog = true;
    } else {
      console.log(`[Symbols] Win below dialog threshold (${multiplier.toFixed(2)}x) - autoplay continues`);
    }
  }

  // Draw win lines using the new SpinData method
  if (self.winLineDrawer) {
    if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
      // Determine win line animation type based on autoplay state and counter
      const slotController = (self.scene as any).slotController;
      const isLastAutoplaySpin = slotController && slotController.autoplaySpinsRemaining === 0;
      const isAutoplayActive = slotController && slotController.autoplaySpinsRemaining > 0;
      const isFreeSpinAutoplay = self.freeSpinAutoplayActive;
      
      // Check free spin autoplay FIRST to prevent it from being treated as "last autoplay spin"
      if (isFreeSpinAutoplay) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for free spin autoplay)');
        // Apply turbo mode exactly like normal autoplay does
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
          console.log('[Symbols] Applying turbo mode to winlines via SlotController (same as normal autoplay)');
          slotController.applyTurboToWinlineAnimations();
        }
        self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else if (isLastAutoplaySpin) {
        console.log('[Symbols] Drawing win lines from SpinData (looping for last autoplay spin)');
        self.winLineDrawer.drawWinLinesFromSpinData(spinData);
      } else if (isAutoplayActive) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for normal autoplay)');
        // Apply turbo mode exactly like normal autoplay does
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
          console.log('[Symbols] Applying turbo mode to winlines via SlotController (same as normal autoplay)');
          slotController.applyTurboToWinlineAnimations();
        }
        self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else if (gameStateManager.isTurbo) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass for turbo mode)');
        self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
      } else {
        console.log('[Symbols] Drawing win lines from SpinData (looping for manual spin)');
        self.winLineDrawer.drawWinLinesFromSpinData(spinData);
      }
      
      // Show the black overlay behind symbols for wins
      self.showWinningOverlay();
      
      // Move winning symbols to appear above the overlay
      self.moveWinningSymbolsToFront(mockData);
      } else {
      console.log('[Symbols] No paylines in SpinData, calling WinLineDrawer for no-wins scenario');
      self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
    }
  }

  // NOW handle scatter symbols AFTER winlines are drawn
  if (scatterGrids.length >= 3) {
    console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
    gameStateManager.isScatter = true;

    // If there are no normal wins (no paylines), play scatter SFX now
    try {
      const hasWins = Array.isArray(spinData.slot?.paylines) && spinData.slot.paylines.length > 0;
      if (!hasWins) {
        const audio = (window as any)?.audioManager;
        if (audio && typeof audio.playSoundEffect === 'function') {
          audio.playSoundEffect(SoundEffectType.SCATTER);
          console.log('[Symbols] Played scatter SFX for scatter-only hit');
        }
      }
    } catch {}
    
    // Stop normal autoplay immediately when scatter is detected
    if (gameStateManager.isAutoPlaying) {
      console.log('[Symbols] Scatter detected during autoplay - stopping normal autoplay immediately');
      // Access SlotController to stop autoplay
      const slotController = (self.scene as any).slotController;
      if (slotController && typeof slotController.pauseAutoplayForBonus === 'function') {
        slotController.pauseAutoplayForBonus();
        console.log('[Symbols] Normal autoplay paused for bonus (will resume after bonus)');
      } else if (slotController && typeof slotController.stopAutoplay === 'function') {
        // Fallback for safety
        slotController.stopAutoplay();
        console.log('[Symbols] Normal autoplay stopped due to scatter detection (no pause method)');
      } else {
        console.warn('[Symbols] SlotController not available to stop autoplay');
      }
    }
    
    // Always show the winning overlay behind symbols for scatter
    self.showWinningOverlay();
    console.log('[Symbols] Showing winning overlay for scatter symbols');
    
    // Animate the individual scatter symbols with their hit animations
    console.log('[Symbols] Starting scatter symbol hit animations...');
    try {
      await self.animateScatterSymbols(mockData, scatterGrids);
      console.log('[Symbols] Scatter symbol hit animations completed');
    } catch (error) {
      console.error('[Symbols] Error animating scatter symbols:', error);
    }
    
    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    // Check if win dialog is showing - if so, wait for it to close before starting scatter animation
    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - waiting for WIN_DIALOG_CLOSED event before starting scatter animation');
      
      // Listen for WIN_DIALOG_CLOSED event to start scatter animation
      const onWinDialogClosed = () => {
        console.log('[Symbols] WIN_DIALOG_CLOSED received - starting scatter animation sequence');
        gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed); // Remove listener
        
        // Start scatter animation after win dialog closes
        self.startScatterAnimationSequence(mockData);
      };
      
      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
    } else {
      console.log('[Symbols] No win dialog showing - starting scatter animation immediately');
      // No win dialog, start scatter animation immediately
      self.startScatterAnimationSequence(mockData);
    }
  } else {
    console.log(`[Symbols] No scatter detected (found ${scatterGrids.length} scatter symbols, need 3+)`);
  }
  
  // Start idle animation on all non-winning symbols
  try {
    self.startIdleAnimationForNonWinning(mockData, scatterGrids);
  } catch (e) {
    console.warn('[Symbols] Failed to start idle animation for non-winning symbols:', e);
  }
  
  // Restore tween speeds if skip was requested and mark spin as complete
  try { (self as any).clearSkipReelDrops?.(); } catch {}
  // Set spinning state to false
  gameStateManager.isReelSpinning = false;
  
  console.log('[Symbols] SpinData symbols processed successfully');
}

/**
 * Convert SpinData paylines to the format expected by the game's win system
 */
function convertPaylinesToWinFormat(spinData: any): Map<number, any[]> {
  const allMatching = new Map<number, any[]>();
  
  for (const payline of spinData.slot.paylines) {
    const lineKey = payline.lineKey;
    const winningGrids = getWinningGridsForPayline(spinData, payline);
    
    if (winningGrids.length > 0) {
      allMatching.set(lineKey, winningGrids);
    }
  }
  
  return allMatching;
}

/**
 * Get winning grids for a specific payline from SpinData
 */
function getWinningGridsForPayline(spinData: any, payline: any): any[] {
  const winningGrids: any[] = [];
  const lineKey = payline.lineKey;
  const count = payline.count;
  
  // Get the winline pattern for this lineKey
  if (lineKey < 0 || lineKey >= Data.WINLINES.length) {
    console.warn(`[Symbols] Invalid lineKey: ${lineKey}`);
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



function onSpinDataReceived(self: Symbols) {
  // Listen for the new SPIN_DATA_RESPONSE event from GameAPI
  gameEventManager.on(GameEventType.SPIN_DATA_RESPONSE, async (data: any) => {
    console.log('[Symbols] SPIN_DATA_RESPONSE received:', data);
    console.log('[Symbols] SpinData:', data.spinData);
    
    if (!data.spinData || !data.spinData.slot || !data.spinData.slot.area) {
      console.error('[Symbols] Invalid SpinData received - missing slot.area');
      return;
    }
    
    // Store the current spin data for access by other components
    self.currentSpinData = data.spinData;
    console.log('[Symbols] Stored current spin data for access by other components');
    
    // Use the slot.area from SpinData instead of data.symbols
    const symbols = data.spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the same logic as before
    await processSpinDataSymbols(self, symbols, data.spinData);
  });







}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;
  disposeSymbols(self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;

  let symbols = data.symbols;
  console.log('[Symbols] New symbols from spin response:', symbols);
  
  // Update current symbol data for reset purposes
  self.currentSymbolData = symbols;
  
  self.newSymbols = [];

  for (let col = 0; col < symbols.length; col++) {
    let rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {

      const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

      let symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
      symbol.displayWidth = self.displayWidth;
      symbol.displayHeight = self.displayHeight;
      self.container.add(symbol);

      rows.push(symbol);
    }

    self.newSymbols.push(rows);
  }
}

async function dropReels(self: Symbols, data: Data): Promise<void> {
  // Remove init check since we're not using it anymore
  console.log('[Symbols] dropReels called with data:', data);
  console.log('[Symbols] SLOT_ROWS:', SLOT_ROWS);

  // Play turbo drop sound effect at the start of reel drop sequence when in turbo mode
  if (self.scene.gameData.isTurbo && (window as any).audioManager) {
    (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
    console.log('[Symbols] Playing turbo drop sound effect at start of reel drop sequence');
  }

  const reelCompletionPromises: Promise<void>[] = [];

  // Anticipation: if upcoming SpinData shows a scatter on 1st or 3rd columns (x = 0 or 2),
  // extend only the last reel's animation (x = SLOT_ROWS - 1)
  let extendLastReelDrop = false;
  try {
    const s: number[][] = data.symbols || [];
    // symbols is [column][row]. Horizontal reels correspond to row indices.
    const scatterVal = Data.SCATTER[0];
    const hasScatterCol1 = s.some(col => Array.isArray(col) && col[0] === scatterVal);
    const hasScatterCol3 = s.some(col => Array.isArray(col) && col[2] === scatterVal);
    extendLastReelDrop = !!(hasScatterCol1 && hasScatterCol3);
    console.log(`[Symbols] Anticipation check (reel 1 AND reel 3 scatter): r1=${hasScatterCol1}, r3=${hasScatterCol3} → extend=${extendLastReelDrop}`);
  } catch (e) {
    console.warn('[Symbols] Anticipation check failed:', e);
    extendLastReelDrop = false;
  }
  // Persist anticipation state on scene for cross-function checks
  try { (self.scene as any).__isScatterAnticipationActive = extendLastReelDrop; } catch {}

  for (let row = 0; row < SLOT_ROWS; row++) {
    console.log(`[Symbols] Processing row ${row}`);
    const isLastReel = row === (SLOT_ROWS - 1);
    dropPrevSymbols(self, row, isLastReel && extendLastReelDrop)
    dropFillers(self, row, isLastReel && extendLastReelDrop)
    const reelPromise = dropNewSymbols(self, row, isLastReel && extendLastReelDrop);
    reelCompletionPromises.push(reelPromise);
    await delay(self.scene.gameData.dropReelsDelay)
  }
  
  // Wait for all reel animations to complete
  console.log('[Symbols] Waiting for all reels to complete animation...');
  await Promise.all(reelCompletionPromises);
  console.log('[Symbols] All reels have completed animation');
}

function dropPrevSymbols(self: Symbols, index: number, extendDuration: boolean = false) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }
  
  // Check if symbols array has valid structure
  if (!self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropPrevSymbols: symbols array structure is invalid, skipping');
    return;
  }

  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const baseDropDistance = Symbols.FILLER_COUNT * height + self.scene.gameData.winUpHeight;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropReelsDuration;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const DROP_DISTANCE = (Symbols.FILLER_COUNT + extraRows) * height + self.scene.gameData.winUpHeight;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[Symbols] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }
    
    self.scene.tweens.chain({
      targets: self.symbols[i][index],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropReelsDuration + extraMs,
          ease: Phaser.Math.Easing.Bounce.Out,
        },
      ],
    });
  }
}

function dropFillers(self: Symbols, index: number, extendDuration: boolean = false) {
  // Check if symbols array has valid structure
  if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
    console.warn('[Symbols] dropFillers: symbols array structure is invalid, skipping');
    return;
  }
  
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const baseTotal = Symbols.FILLER_COUNT + SLOT_COLUMNS;
  const baseDropDistance = baseTotal * height + GameData.WIN_UP_HEIGHT;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropDuration * 0.9;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const TOTAL_ITEMS = Symbols.FILLER_COUNT + SLOT_COLUMNS + extraRows;
  const DROP_DISTANCE = TOTAL_ITEMS * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: GameObjects.Sprite[] = [];
  for (let i = 0; i < TOTAL_ITEMS - SLOT_COLUMNS; i++) {

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_COLUMNS);
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y)


    let symbol = self.scene.add.sprite(x, y, 'symbol_' + Math.floor(Math.random() * Data.ALL_SYMBOLS.length));
    symbol.displayWidth = self.displayWidth;
    symbol.displayHeight = self.displayHeight;
    self.container.add(symbol);

    fillerSymbols.push(symbol);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    self.scene.tweens.chain({
      targets: fillerSymbols[i],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
          onComplete: () => {
            fillerSymbols[i].destroy();
          }
        }
      ]
    })

  }
}

function dropNewSymbols(self: Symbols, index: number, extendDuration: boolean = false): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check if symbols array has valid structure
    if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
      console.warn('[Symbols] dropNewSymbols: symbols array structure is invalid, resolving immediately');
      resolve();
      return;
    }
    
    const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
    const START_INDEX_BASE = Symbols.FILLER_COUNT + SLOT_COLUMNS;
    const baseDropDistance = START_INDEX_BASE * height + self.scene.gameData.winUpHeight;
    const extraMs = extendDuration ? 3000 : 0;
    const baseDropMs = self.scene.gameData.dropDuration * 0.9;
    const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
    const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
    const START_INDEX = START_INDEX_BASE + extraRows;
    const DROP_DISTANCE = START_INDEX * height + self.scene.gameData.winUpHeight;

    let completedAnimations = 0;
    const totalAnimations = self.newSymbols.length;

    for (let col = 0; col < self.newSymbols.length; col++) {
      let symbol = self.newSymbols[col][index];

      const START_INDEX_Y = -(Symbols.FILLER_COUNT + SLOT_COLUMNS + extraRows);
      const y = getYPos(self, col + START_INDEX_Y)
      symbol.y = y;
      
      self.scene.tweens.chain({
        targets: symbol,
        tweens: [
          {
            y: `-= ${self.scene.gameData.winUpHeight}`,
            duration: self.scene.gameData.winUpDuration,
            ease: Phaser.Math.Easing.Circular.Out,
          },
          {
            y: `+= ${DROP_DISTANCE}`,
            duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
            ease: Phaser.Math.Easing.Linear,
          },
          {
            y: `+= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: Phaser.Math.Easing.Linear,
          },
          {
            y: `-= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: Phaser.Math.Easing.Linear,
            onComplete: () => {
              // Play reel drop sound effect only when turbo mode is off
              if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
                (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                console.log(`[Symbols] Playing reel drop sound effect for reel ${index} after drop completion`);
              }
              
              completedAnimations++;
              if (completedAnimations === totalAnimations) {
                // Show after 3rd reel completes if anticipation is active
                try {
                  const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
                  if (isAnticipation && index === 2) {
                    const sa = (self.scene as any)?.scatterAnticipation;
                    if (sa && typeof sa.show === 'function') {
                      sa.show();
                      console.log('[Symbols] Scatter anticipation shown after 3rd reel drop');
                    }
                  }
                } catch {}

                // Hide after last reel completes if anticipation is active
                try {
                  const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
                  if (isAnticipation && index === (SLOT_ROWS - 1)) {
                    const sa = (self.scene as any)?.scatterAnticipation;
                    if (sa && typeof sa.hide === 'function') {
                      sa.hide();
                      console.log('[Symbols] Scatter anticipation hidden after last reel drop');
                    }
                    // Reset anticipation flag for safety
                    (self.scene as any).__isScatterAnticipationActive = false;
                  }
                } catch {}
                resolve();
              }
            }
          }
        ]
      })
    }
  });
}


function disposeSymbols(symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;
  
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol = symbols[col][row];
      if (symbol && symbol.destroy && !symbol.destroyed) {
        try {
          const symbolType = symbol.animationState ? 'Spine' : 'PNG';
          const symbolKey = symbol.texture?.key || 'unknown';
          symbol.destroy();
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
        }
      }
    }
  }
  
  console.log(`[Symbols] Disposed ${disposedCount} symbols`);
}


function getYPos(self: Symbols, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}


function replaceWithSpineAnimations(self: Symbols, data: Data) {
  const wins = data.wins;

  // Safety check: only proceed if wins exist and have the expected structure
  if (!wins || !wins.allMatching || wins.allMatching.size === 0) {
    console.log('[Symbols] No wins to process, skipping Spine animation replacement');
    return;
  }

  // Safety check: ensure symbols array exists and has the expected dimensions
  if (!self.symbols || !self.symbols.length || !self.symbols[0] || !self.symbols[0].length) {
    console.log('[Symbols] Symbols array not properly initialized, skipping Spine animation replacement');
    return;
  }

  console.log(`[Symbols] Processing ${wins.allMatching.size} winning patterns for Spine animations`);
  console.log(`[Symbols] Current symbols array dimensions: ${self.symbols.length} columns x ${self.symbols[0].length} rows`);
  
  // Determine if any winning symbol is a wildcard and prepare SFX selection
  let hasWildcardInWin = false;
  try {
    const wildcardSet = new Set<number>(WILDCARD_SYMBOLS);
    for (const win of wins.allMatching.values()) {
      for (const grid of win) {
        const valueAtGrid = data.symbols?.[grid.y]?.[grid.x];
        if (typeof valueAtGrid === 'number' && wildcardSet.has(valueAtGrid)) {
          hasWildcardInWin = true;
          break;
        }
      }
      if (hasWildcardInWin) break;
    }
  } catch {}
  
  // Ensure we only play the win SFX once per win animation start
  let hasPlayedWinSfx = false;
  
  for (const win of wins.allMatching.values()) {
    for (const grid of win) {
      // Safety check: ensure grid coordinates are within bounds
      if (grid.y < 0 || grid.y >= self.symbols.length || grid.x < 0 || grid.x >= self.symbols[0].length) {
        console.warn(`[Symbols] Grid coordinates (${grid.x}, ${grid.y}) out of bounds for symbols array [${self.symbols.length}][${self.symbols[0].length}], skipping`);
        continue;
      }

      const currentSymbol = self.symbols[grid.y][grid.x];
      
      if (currentSymbol) {
        // Get the symbol value and construct the Spine key
        const symbolValue = data.symbols[grid.y][grid.x];

        // If this grid already has a sticky wild during bonus, ensure base is hidden and skip replacement
        if (gameStateManager.isBonus && self.hasStickyWildAt(grid.y, grid.x) && WILDCARD_SYMBOLS.includes(symbolValue)) {
          try {
            // Hide underlying base symbol to avoid double visuals
            const base = self.symbols?.[grid.y]?.[grid.x];
            if (base?.setVisible) base.setVisible(false);
            else if (base?.setAlpha) base.setAlpha(0);
            // Reconfirm sticky wild at this cell
            (self as any).addStickyWildAt(grid.y, grid.x, symbolValue);
          } catch {}
          continue;
        }
        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';
        const symbolName = `Symbol${symbolValue}_KA`;
        const hitAnimationName = `${symbolName}_hit`;
        
        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;
        const displayWidth = currentSymbol.displayWidth;
        const displayHeight = currentSymbol.displayHeight;
        
        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          
          // Remove the current sprite
          currentSymbol.destroy();
          
          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          
          // Use configured scale for this specific symbol
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          spineSymbol.setScale(configuredScale);
          console.log(`[Symbols] Applied scale ${configuredScale} to symbol ${symbolValue}`);
          
          // Play the hit animation (looped)
          spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
          console.log(`[Symbols] Playing looped animation: ${hitAnimationName}`);

          // Play win SFX once when winning symbol animations start
          try {
            if (!hasPlayedWinSfx) {
              const audio = (window as any)?.audioManager;
              if (audio && typeof audio.playSoundEffect === 'function') {
                const sfx = hasWildcardInWin ? SoundEffectType.WILD_MULTI : SoundEffectType.HIT_WIN;
                audio.playSoundEffect(sfx);
                hasPlayedWinSfx = true;
                // If this spin triggered scatter, chain play scatter_ka after hit/wildmulti
                try {
                  if (gameStateManager.isScatter) {
                    // short chain delay to ensure ordering
                    this.scene.time.delayedCall(100, () => {
                      try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch {}
                    });
                  }
                } catch {}
              }
            }
          } catch {}
          
          // Add to container and update reference
          self.container.add(spineSymbol);
          self.symbols[grid.y][grid.x] = spineSymbol;
          
          console.log(`[Symbols] Successfully replaced sprite with Spine animation at (${grid.x}, ${grid.y})`);
          
        } catch (error) {
          console.warn(`[Symbols] Failed to replace sprite with Spine animation at (${grid.x}, ${grid.y}):`, error);
          
          // Fallback to the old tint method if Spine replacement fails
          const fallbackSymbol = self.symbols[grid.y][grid.x];
          if (fallbackSymbol) {
            if (typeof fallbackSymbol.setTint === 'function') {
              fallbackSymbol.setTint(0xFFFFFF);
            }
            if (typeof fallbackSymbol.setBlendMode === 'function') {
              fallbackSymbol.setBlendMode(Phaser.BlendModes.ADD);
            }
            
            self.scene.tweens.add({
              targets: fallbackSymbol,
              alpha: 0.5, 
              duration: 250, 
              ease: Phaser.Math.Easing.Sine.InOut,
              yoyo: true,
              repeat: -1,
            });
          }
        }
      }
    }
  }
}


/**
 * Calculate total win amount from paylines array
 */
function calculateTotalWinFromPaylines(paylines: any[]): number {
  if (!paylines || paylines.length === 0) {
    return 0;
  }
  
  const totalWin = paylines.reduce((sum, payline) => {
    const winAmount = payline.win || 0;
    console.log(`[Symbols] Payline ${payline.lineKey}: ${winAmount} (symbol ${payline.symbol}, count ${payline.count})`);
    return sum + winAmount;
  }, 0);
  
  console.log(`[Symbols] Calculated total win: ${totalWin} from ${paylines.length} paylines`);
  return totalWin;
}

async function delay(duration: number) {
  // The duration should already be turbo-adjusted from the backend
  // No need to apply turbo mode again here
  console.log(`[Symbols] Delay: ${duration}ms (should already be turbo-adjusted), turbo state: ${gameStateManager.isTurbo}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}

// Add method to reset symbols visibility
function resetSymbolsVisibility(self: Symbols): void {
  if (self.container) {
    self.container.setAlpha(1);
  }
}

