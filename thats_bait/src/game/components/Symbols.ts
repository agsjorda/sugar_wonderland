import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { Game } from "../scenes/Game";
import { GameData, setSpeed, pauseAutoplayForWinlines, resumeAutoplayAfterWinlines, isWinlinesShowing } from "./GameData";
import { ScatterAnimationManager } from "../../managers/ScatterAnimationManager";
import { SymbolDetector, Grid, Wins } from "../../tmp_backend/SymbolDetector";
import { WinLineDrawer } from './WinLineDrawer';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { TurboConfig } from '../../config/TurboConfig';
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { runDropReels, applySkipReelTweaks } from './ReelDropScript';
import { handleHookScatterHighlight } from './HookScatterHighlighter';
import { flashAllSymbolsOverlay } from './SymbolFlash';
import { applyImageSymbolWinRipple, clearImageSymbolWinRipple } from '../effects/SymbolImageWinRipple';
import { applyNonWinningSymbolDim, clearNonWinningSymbolDim } from '../effects/NonWinningSymbolDimmer';
import { WaterWaveVerticalPipeline } from '../pipelines/WaterWavePipeline';
import { getSymbol5VariantForCell, getSymbol5SpineKeyForVariant, getDefaultSymbol5Variant, getSymbol5ImageKeyForVariant, getSymbol5ImageKeyForCell, getMoneyValueForCell } from './Symbol5VariantHelper';
import { MoneyValueOverlayManager } from './MoneyValueOverlayManager';

export class Symbols {
  
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene!: Game;
  public container!: Phaser.GameObjects.Container;
  public displayWidth!: number;
  public displayHeight!: number;
  public horizontalSpacing!: number;
  public verticalSpacing!: number;
  public symbols!: any[][]; // Changed to any to support both Sprite and Spine objects
  public newSymbols!: any[][]; // Changed to any to support both Sprite and Spine objects
  public slotX!: number;
  public slotY!: number;
  public totalGridWidth!: number;
  public totalGridHeight!: number;
  public scatterAnimationManager: ScatterAnimationManager;
  public symbolDetector: SymbolDetector;
  public winLineDrawer!: WinLineDrawer;
  public overlayRect?: Phaser.GameObjects.Graphics;
  public baseOverlayRect?: Phaser.GameObjects.Graphics;
  private scatterForegroundContainer?: Phaser.GameObjects.Container;
  // Flag to control use of legacy black winning overlay graphics
  private baseOverlayBorderUpper?: any;
  private baseOverlayBorderLower?: any;
  private hasEmittedScatterWinStart: boolean = false;
  public currentSpinData: any = null; // Store current spin data for access by other components
  private hasPendingHookScatter: boolean = false;
  private moneyValueOverlayManager?: MoneyValueOverlayManager;
  public moneyValueScaleModifier: number = 0.7;
  public moneyValueOffsetY: number = 0;
  public moneyValueWidthPaddingFactor: number = 0.8;
  public moneyValueHeightPaddingFactor: number = 0.35;
  public moneyValueSpacing: number = 1;
  
  

  // Grid mask configuration and references
  public gridMaskShape?: Phaser.GameObjects.Graphics;
  public gridMask?: Phaser.Display.Masks.GeometryMask;
  public gridMaskPaddingLeft: number = 10;
  public gridMaskPaddingRight: number = 20;
  public gridMaskPaddingTop: number = 45;
  public gridMaskPaddingBottom: number = 120;

  // Base overlay (light grey behind symbols) padding in pixels
  public baseOverlayPaddingLeft: number = 20;
  public baseOverlayPaddingRight: number = 20;
  public baseOverlayPaddingTop: number = 10;
  public baseOverlayPaddingBottom: number = 27; // slightly larger bottom by default
  
  // Skip-drop state
  private skipReelDropsActive: boolean = false;

  // Flash overlay configuration
  public flashOverlayAlphaStart: number = 1;
  public flashOverlayFadeTo: number = 0.0;
  public flashOverlayDurationMs: number = 120;
  public flashOverlaySpeedMultiplier: number = 1.0;
  public winSymbolFlashAlphaStart: number = 0.9;
  public winSymbolFlashFadeTo: number = 0.0;
  public winSymbolFlashDurationMs: number = 120;
  public winSymbolFlashSpeedMultiplier: number = 1.0;

  // Configuration for Spine symbol scales in idle animations - adjust these values manually
  private idleSpineSymbolScales: { [key: number]: number } = {
    0:  0.150,   
    1:  0.050, 
    2:  0.050, 
    3:  0.050, 
    4:  0.045,  
    5:  0.130,
    6:  0.045,
    7:  0.045,
    8:  0.060,
    9:  0.060, 
    10: 0.060, 
    11: 0.130,
    12: 0.130,
    13: 0.130,
    14: 0.130
  };

  // Optional override scales for winning-symbol Spine animations (per symbol).
  // When not specified for a given symbol, win animations fall back to idle scales.
  private winSpineSymbolScales: { [key: number]: number } = {
    0:  0.160,   
    1:  0.060, 
    2:  0.060, 
    3:  0.060, 
    4:  0.055,  
    5:  0.145,
    6:  0.055,
    7:  0.055,
    8:  0.070,
    9:  0.070, 
    10: 0.080, 
    11: 0.155,
    12: 0.155,
    13: 0.155,
    14: 0.155
  };
  
  private imageSymbolScaleMultipliers: { [key: number]: number } = {
    0:  1.0,
    1:  1.0,
    2:  1.0,
    3:  1.0,
    4:  1.0,
    5:  1.0,
    6:  1.0,
    7:  1.0,
    8:  1.0,
    9:  1.0,
    10: 1.0,
    11: 1.0,
    12: 1.0,
    13: 1.0,
    14: 1.0
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
  private dialogListenerSetup: boolean = false;
  // Scatter anticipation overlay
  private scatterOverlay: Phaser.GameObjects.Graphics | null = null;
  
  // Clickable hitbox over the symbol grid to allow skipping during reel drops
  private skipHitbox?: Phaser.GameObjects.Zone;

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  public fadeOutAllReelVisuals(durationMs: number = 250): void {
    try {
      if (this.container) {
        this.scene.tweens.killTweensOf(this.container);
        this.scene.tweens.add({ targets: this.container, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { this.container?.setVisible(false); } catch {} } });
      }
      if (this.scatterForegroundContainer) {
        this.scene.tweens.killTweensOf(this.scatterForegroundContainer);
        this.scene.tweens.add({ targets: this.scatterForegroundContainer, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { this.scatterForegroundContainer?.setVisible(false); } catch {} } });
      }
      try {
        if (this.symbols) {
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj: any = col[r];
              if (!obj) continue;
              const p = (obj as any).parentContainer as Phaser.GameObjects.Container | undefined;
              if (p !== this.container && p !== this.scatterForegroundContainer) {
                try { this.scene.tweens.killTweensOf(obj); } catch {}
                try { this.scene.tweens.add({ targets: obj, alpha: 0, duration: durationMs, ease: 'Cubic.easeOut', onComplete: () => { try { obj.setVisible?.(false); } catch {} } }); } catch {}
              }
            }
          }
        }
      } catch {}
      try {
        if (this.overlayRect) {
          this.scene.tweens.killTweensOf(this.overlayRect);
          this.scene.tweens.add({ targets: this.overlayRect, alpha: 0, duration: durationMs, ease: 'Cubic.easeIn', onComplete: () => { try { this.overlayRect?.setVisible(false); } catch {} } });
        }
      } catch {}
      try {
        if (this.baseOverlayRect) {
          this.scene.tweens.killTweensOf(this.baseOverlayRect);
          this.baseOverlayRect.setVisible(true);
          this.scene.tweens.add({ targets: this.baseOverlayRect, alpha: 0, duration: durationMs, ease: 'Cubic.easeIn', onComplete: () => { try { this.baseOverlayRect?.setVisible(false); } catch {} } });
        }
      } catch {}
      try { this.scene.time.delayedCall(Math.max(0, durationMs + 50), () => { try { this.clearWinLines(); } catch {} }); } catch {}
    } catch {}
  }

  public requestSkipReelDrops(): void {
    try {
      if (this.skipReelDropsActive) return;
      this.skipReelDropsActive = true;
      // Speed up only symbol-related tweens (avoid global tween timeScale to not affect logo breathing)
      const gd = (this.scene as any)?.gameData as GameData | undefined;
      if (gd) {
        applySkipReelTweaks(this, gd, 60);
      }
     
    } catch (e) {
 
    }
  }
  
  /**
   * Clear skip state and restore tween manager timescale.
   * Call once the spin flow has moved beyond reel drops.
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
   * Center a Spine instance within a target cell and fit its scale to the cell size.
   * This compensates for skeleton origin offsets and atlas scaling differences.
   */
  public centerAndFitSpine(spine: any, targetCenterX: number, targetCenterY: number, targetWidth: number, targetHeight: number, fallbackScale: number, nudge?: { x: number; y: number }): void {
    try {
      // 1) Fit scale to target cell (with provided fallback)
      const fitted = this.getFittedSpineScale(spine, targetWidth, targetHeight, fallbackScale);
      spine.setScale(fitted);

      // 2) Compute current bounds center in world space and shift to target center
      const b = spine?.getBounds?.();
      const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
      const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
      const offX = (b?.offset?.x ?? 0);
      const offY = (b?.offset?.y ?? 0);
      if (sizeX > 0 && sizeY > 0) {
        const centerWorldX = offX + sizeX * 0.5;
        const centerWorldY = offY + sizeY * 0.5;
        const dx = targetCenterX - centerWorldX;
        const dy = targetCenterY - centerWorldY;
        spine.x += dx;
        spine.y += dy;
      }

      // 3) Optional fine nudge per symbol to correct tiny visual offsets
      if (nudge) {
        spine.x += nudge.x;
        spine.y += nudge.y;
      }
    } catch {}
  }

  public reCenterSpineNextTick(spine: any, targetCenterX: number, targetCenterY: number, nudge?: { x: number; y: number }): void {
    try {
      this.scene.time.delayedCall(0, () => {
        try { spine.update?.(0); } catch {}
        try {
          const b = spine?.getBounds?.();
          const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
          const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
          const offX = (b?.offset?.x ?? 0);
          const offY = (b?.offset?.y ?? 0);
          if (sizeX > 0 && sizeY > 0) {
            const centerWorldX = offX + sizeX * 0.5;
            const centerWorldY = offY + sizeY * 0.5;
            const dx = targetCenterX - centerWorldX;
            const dy = targetCenterY - centerWorldY;
            spine.x += dx;
            spine.y += dy;
          }
          if (nudge) {
            spine.x += nudge.x;
            spine.y += nudge.y;
          }
        } catch {}
      });
    } catch {}
  }

  /** Optional per-symbol micro adjustments (in pixels) after centering) - legacy alias (idle by default) */
  public getSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    return this.getIdleSymbolNudge(symbolValue);
  }

  /** Idle animation nudges (used for post-drop idle conversions) */
  public getIdleSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Tweak these to align idle placement precisely per symbol
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
  }

  /** Win animation nudges (used for win/hit animations, etc.) */
  public getWinSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Provide separate offsets for win/hit animations if their bounds differ
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
  }

  public createScatterOverlay(): void {
    try {
      if (this.scatterOverlay) {
        this.scatterOverlay.destroy();
      }
      
      const bounds = this.getSymbolGridBounds();
      const padding = 110; // Extra padding around the grid
      
      this.scatterOverlay = this.scene.add.graphics();
      this.scatterOverlay.fillStyle(0x000000, 0.7); // 80% opacity black
      
      this.scatterOverlay.fillRect(
        bounds.x - padding,
        bounds.y - padding,
        bounds.width + padding * 2,
        bounds.height + padding * 2
      );
      
      this.scatterOverlay.setDepth(29000); // Just below scatter anticipation (30000)
      this.scatterOverlay.setAlpha(0); // Start transparent
      this.scene.add.existing(this.scatterOverlay);
    } catch (error) {
      console.error('[Symbols] Error creating scatter overlay:', error);
    }
  }

  public showScatterOverlay(): void {
    try {
      if (!this.scatterOverlay) {
        this.createScatterOverlay();
      }
      
      if (this.scatterOverlay) {
        this.scene.tweens.add({
          targets: this.scatterOverlay,
          alpha: 1,
          duration: 500,
          ease: 'Cubic.easeOut'
        });
      }
    } catch (error) {
      console.error('[Symbols] Error showing scatter overlay:', error);
    }
  }

  public hideScatterOverlay(): void {
    try {
      if (!this.scatterOverlay) return;
      
      this.scene.tweens.add({
        targets: this.scatterOverlay,
        alpha: 0,
        duration: 300,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          try {
            if (this.scatterOverlay) {
              this.scatterOverlay.destroy();
              this.scatterOverlay = null;
            }
          } catch (error) {
            console.error('[Symbols] Error in scatter overlay hide complete:', error);
          }
        }
      });
    } catch (error) {
      console.error('[Symbols] Error hiding scatter overlay:', error);
    }
  }

  private createBaseOverlayRect(): void {
    try {
      if (this.baseOverlayRect) {
        this.baseOverlayRect.destroy();
      }
      this.baseOverlayRect = this.scene.add.graphics();

      // Draw legacy base overlay fully transparent so only reel background is visible
      this.baseOverlayRect.fillStyle(0xE5E5E5, 0.0);
      const gridBounds = this.getSymbolGridBounds();

      const padL = this.baseOverlayPaddingLeft;
      const padR = this.baseOverlayPaddingRight;
      const padT = this.baseOverlayPaddingTop;
      const padB = this.baseOverlayPaddingBottom;
      this.baseOverlayRect.fillRect(
        gridBounds.x - padL,
        gridBounds.y - padT,
        gridBounds.width + padL + padR,
        gridBounds.height + padT + padB
      );
      // Scene-level depth to sit between background (at -10) and symbols (0)
      this.baseOverlayRect.setDepth(-5);
      // Keep base overlay hidden by default; it can be faded in by overlay effects when needed
      this.baseOverlayRect.setVisible(false);
      console.log('[Symbols] Base light grey grid background created (hidden)');
      // Destroy any existing borders and do not recreate them (no top/bottom border images in this project)
      try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
      try { this.baseOverlayBorderLower?.destroy?.(); } catch {}
      this.baseOverlayBorderUpper = undefined;
      this.baseOverlayBorderLower = undefined;
    } catch (e) {
      console.warn('[Symbols] Failed to create base grid background:', e);
    }
  }

  public create(scene: Game) {
    this.scene = scene;
    this.winLineDrawer = new WinLineDrawer(scene, this);
    initVariables(this);
    createContainer(this);
    this.moneyValueOverlayManager = new MoneyValueOverlayManager(this as any);
    onStart(this);
    onSpinDataReceived(this);
    this.onSpinDone(this.scene);
    this.setupDialogEventListeners();
    this.setupSpinEventListener(); // Re-enabled to clean up symbols at spin start

    this.scene.events.on('flashAllSymbolsNow', () => {
      try {
        this.ensureCleanSymbolState();
        if (this.container) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
        }
        flashAllSymbolsOverlay(this as any);
      } catch {}
    });

    // Create a persistent light grey, semi-transparent background behind the symbol grid
    this.createBaseOverlayRect();

    // Listen for a full free spin reset request (after congrats/bonus end)
    try {
      if (this.winLineDrawer) {
        const hasActive = this.winLineDrawer.hasActiveLines();
        const isManual = !gameStateManager.isAutoPlaying;
        if (isManual || !hasActive) {
          this.winLineDrawer.stopLooping();
          this.winLineDrawer.clearLines();
        }
      }
    } catch {}
    this.createSkipHitbox();
  }

  private beginSpinPhase(): void {
    try { this.clearWinLines(); } catch {}
    try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
    try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
  }

  private beginWinPhase(): void {
    try { this.clearSkipReelDrops(); } catch {}
  }

  private endWinPhase(): void {
    try { this.ensureSymbolsVisibleAfterAutoplayStop(); } catch {}
  }

  private endSpinPhase(): void {
    try {
      let hasWins = false;
      try { hasWins = this.hasCurrentWins(); } catch {}
      if (hasWins) {
        return;
      }
      try { this.clearSkipReelDrops(); } catch {}
      try { this.ensureSymbolsVisibleAfterAutoplayStop(); } catch {}
    } catch {}
  }

  private createSkipHitbox(): void {
    try {
      // Destroy any previous hitbox to avoid duplicates
      try { this.skipHitbox?.destroy(); } catch {}
      
      const zone = this.scene.add.zone(
        this.slotX,
        this.slotY,
        this.totalGridWidth,
        this.totalGridHeight
      ).setOrigin(0.5, 0.5);
      
      // Keep the zone invisible but above symbols
      zone.setDepth(20);
      // Disabled by default; only active while reels are spinning
      zone.disableInteractive();
      
      // Click to skip while spinning (disabled when turbo is ON)
      zone.on('pointerdown', () => {
        try {
          if (gameStateManager.isReelSpinning && !gameStateManager.isTurbo) {
            this.requestSkipReelDrops();
          }
        } catch {}
      });
      
      this.skipHitbox = zone as Phaser.GameObjects.Zone;
      
      // Enable/disable around spin lifecycle
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
      gameEventManager.on(GameEventType.REELS_START, enable);
      gameEventManager.on(GameEventType.REELS_STOP, disable);
      // React to turbo toggles: disable on TURBO_ON, enable on TURBO_OFF only if spinning
      const onTurboOn = () => { try { this.skipHitbox?.disableInteractive(); } catch {} };
      const onTurboOff = () => { try { if (gameStateManager.isReelSpinning) enable(); } catch {} };
      gameEventManager.on(GameEventType.TURBO_ON, onTurboOn);
      gameEventManager.on(GameEventType.TURBO_OFF, onTurboOff);
      
      // Cleanup listeners and object on shutdown
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
  
  /**
   * Speed up active tweens for all objects in the symbol grid containers
   */
  private accelerateActiveSymbolTweens(timeScale: number): void {
    try {
      const accel = (obj: any) => {
        try {
          const tweens = this.scene.tweens.getTweensOf(obj) as any[];
          if (Array.isArray(tweens)) {
            for (const t of tweens) {
              try { (t as any).timeScale = Math.max(1, timeScale); } catch {}
            }
          }
        } catch {}
      };
      // Existing symbols
      try {
        if (this.symbols) {
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) accel(obj);
            }
          }
        }
      } catch {}
      // New symbols currently dropping
      try {
        if (this.newSymbols) {
          for (let c = 0; c < this.newSymbols.length; c++) {
            const col = this.newSymbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) accel(obj);
            }
          }
        }
      } catch {}
      // Any filler/new objects inside the primary symbols container
      try {
        const list: any[] = (this.container as any)?.list || [];
        for (const child of list) accel(child);
      } catch {}
      // Foreground scatter container (anticipation overlays)
      try {
        const list: any[] = (this.scatterForegroundContainer as any)?.list || [];
        for (const child of list) accel(child);
      } catch {}
      // Overlays
      try { if (this.overlayRect) accel(this.overlayRect); } catch {}
      try { if (this.baseOverlayRect) accel(this.baseOverlayRect); } catch {}
    } catch {}
  }

  private pruneOrphanSymbolsInContainer(): void {
    try {
      if (!this.container) return;
      const keep = new Set<any>();
      try {
        if (this.symbols) {
          for (let c = 0; c < this.symbols.length; c++) {
            const col = this.symbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) keep.add(obj);
            }
          }
        }
      } catch {}
      try {
        if (this.newSymbols) {
          for (let c = 0; c < this.newSymbols.length; c++) {
            const col = this.newSymbols[c];
            if (!Array.isArray(col)) continue;
            for (let r = 0; r < col.length; r++) {
              const obj = col[r];
              if (obj) keep.add(obj);
            }
          }
        }
      } catch {}

      try {
        if (this.moneyValueOverlayManager) {
          const overlayContainers = this.moneyValueOverlayManager.getOverlayContainers();
          for (const cont of overlayContainers) {
            if (cont) {
              keep.add(cont);
            }
          }
        }
      } catch {}
      const list: any[] = (this.container as any)?.list || [];
      for (const child of list) {
        if (!keep.has(child)) {
          try {
            (this.container as any).remove(child, true);
          } catch {
            try { (child as any).destroy?.(); } catch {}
          }
        }
      }
    } catch {}
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
      // using the *previous* spin's symbol data before the new spin result arrives.
      try { this.ensureCleanSymbolState(); } catch {}
      // Clean up any orphaned display objects from previous spins
      try { this.pruneOrphanSymbolsInContainer(); } catch {}
      this.beginSpinPhase();
    });
    
    // Listen for winline completion to resume autoplay and end win phase
    gameEventManager.on(GameEventType.WIN_STOP, () => {
      console.log('[Symbols] WIN_STOP event received - resuming autoplay');
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
      console.log('[Symbols] freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
      
      // If this spin has a hook-scatter special pending, run it now after winlines
      // and disable/clear any remaining winline visuals to avoid overlap.
      try {
        const spinData = this.currentSpinData;
        let hasHookScatter = false;
        try {
          const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
          if (special && special.action === 'hook-scatter' && special.position) {
            hasHookScatter = true;
          }
        } catch {}

        if (this.hasPendingHookScatter && hasHookScatter) {
          this.hasPendingHookScatter = false;
          try {
            if (this.winLineDrawer) {
              this.winLineDrawer.stopLooping();
              this.winLineDrawer.clearLines();
            }
          } catch {}
          try {
            // Trigger hook-scatter highlight AFTER winlines complete
            handleHookScatterHighlight(this as any, spinData);
          } catch {}
        }
      } catch {}
      
      // Handle free spin autoplay waiting for winlines
      this.handleFreeSpinAutoplayWinStop();
      const slotController = (this.scene as any)?.slotController;
      const isLastNormalAutoplaySpin = !!(slotController && slotController.autoplaySpinsRemaining === 0 && !this.freeSpinAutoplayActive);
      if (gameStateManager.isAutoPlaying && !isLastNormalAutoplaySpin) {
        this.endWinPhase();
      }

      resumeAutoplayAfterWinlines(this.scene.gameData);

      // If bonus finished and no win dialog will show, display congrats now
      if (gameStateManager.isBonus && gameStateManager.isBonusFinished && !gameStateManager.isShowingWinDialog) {
        console.log('[Symbols] Bonus finished without win dialog on last spin - showing congrats');
        this.showCongratsDialogAfterDelay();
        gameStateManager.isBonusFinished = false;
      }
    });
    
    // Listen for winline start to pause autoplay and start win visuals
    gameEventManager.on(GameEventType.WIN_START, () => {
      console.log('[Symbols] WIN_START event received - pausing autoplay');
      pauseAutoplayForWinlines(this.scene.gameData);
      this.beginWinPhase();
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
    });

  }

  public ensureCleanSymbolState(): void {
    if (!this.symbols || this.symbols.length === 0) {
      return;
    }
    
    console.log('[Symbols] Ensuring clean symbol state for spin (converting Spine symbols to WEBP/PNG when possible)');
    try {
      const bg: any = (this.scene as any).background;
      if (bg && typeof bg.restoreDepthAfterWinSequence === 'function') {
        bg.restoreDepthAfterWinSequence();
      }
    } catch {}
    let processedCount = 0;
    let convertedCount = 0;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol: any = this.symbols[col][row];
        if (!symbol) {
          continue;
        }

        try { this.scene?.tweens?.killTweensOf?.(symbol); } catch {}
        try { clearImageSymbolWinRipple(this.scene, symbol); } catch {}
        try { clearNonWinningSymbolDim(this.scene, symbol); } catch {}

        try {
          if ((symbol as any).animationState) {
            const valueFromData = (this.currentSymbolData as any)?.[col]?.[row];
            if (typeof valueFromData === 'number') {
              // For money/multiplier symbols (5, 12, 13, 14), avoid destroying/replacing
              // the existing display object here. Just reset the Spine animation/scale
              // so they remain visible and stable across spins.
              if (valueFromData === 5 || valueFromData === 12 || valueFromData === 13 || valueFromData === 14) {
                try { (symbol as any).animationState.clearTracks(); } catch {}
                try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
                continue;
              }

              let spriteKey: string | null = null;

              if (valueFromData === 5) {
                // Symbol 5: resolve the correct variant image key when possible
                try {
                  const spinData: any = this.currentSpinData;
                  spriteKey = getSymbol5ImageKeyForCell(spinData, col, row);
                } catch {}

                if (!spriteKey) {
                  try {
                    spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
                  } catch {}
                }

                if (!spriteKey) {
                  // Absolute fallback: use the base Symbol 5 image key
                  spriteKey = 'symbol_5';
                }
              } else {
                spriteKey = 'symbol_' + valueFromData;
              }

              if (spriteKey && this.scene.textures.exists(spriteKey)) {
                const home = (symbol as any).__pngHome as { x: number; y: number } | undefined;
                const px = home && typeof home.x === 'number' ? home.x : symbol.x;
                const py = home && typeof home.y === 'number' ? home.y : symbol.y;

                let pngSprite: any = null;
                try {
                  pngSprite = this.scene.add.sprite(px, py, spriteKey);
                  const imageScale = this.getImageSymbolScaleMultiplier(valueFromData);
                  pngSprite.displayWidth = this.displayWidth * imageScale;
                  pngSprite.displayHeight = this.displayHeight * imageScale;
                  try { (pngSprite as any).displayWidth = this.displayWidth * imageScale; } catch {}
                  try { (pngSprite as any).displayHeight = this.displayHeight * imageScale; } catch {}
                  try { this.applyIdleWaveShaderIfSymbolImage(pngSprite, valueFromData); } catch {}
                  try { this.container.add(pngSprite); } catch {}
                } catch {
                  pngSprite = null;
                }

                if (pngSprite) {
                  try { this.container.remove(symbol); } catch {}
                  try { symbol.destroy(); } catch {}
                  this.symbols[col][row] = pngSprite;
                  convertedCount++;
                } else {
                  try { (symbol as any).animationState.clearTracks(); } catch {}
                  try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
                }
              } else {
                // Fallback: if we cannot find a PNG texture, at least reset the Spine towards idle scale
                try { (symbol as any).animationState.clearTracks(); } catch {}
                try { this.restoreIdleScaleForSymbol(symbol, valueFromData); } catch {}
              }
            }
          }
        } catch {}

        processedCount++;
      }
    }

    if (processedCount > 0) {
      console.log(`[Symbols] Cleaned state for ${processedCount} symbols before spin (converted ${convertedCount} Spine symbols to WEBP/PNG)`);
    }
  }

  private clearMoneyValueOverlays(): void {
    try {
      this.moneyValueOverlayManager?.clearOverlays();
    } catch {}
  }

  public updateMoneyValueOverlays(spinData: any, symbolsOverride?: any[][]): void {
    try {
      this.moneyValueOverlayManager?.updateOverlays(spinData, symbolsOverride);
    } catch {}
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
      // End-of-spin synchronized cleanup when there are no wins
      try { this.endSpinPhase(); } catch {}
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

    });

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    gameEventManager.on(GameEventType.IS_BONUS, () => {
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    const __turboLayerFix = () => {
      try {
        const active = !!(this.scene as any)?.__isScatterAnticipationActive;
        if (!active) return;
        try { (this.scene as any)?.children?.bringToTop?.(this.container); } catch {}
        try { (this.scene as any)?.children?.bringToTop?.(this.scatterForegroundContainer); } catch {}
      } catch {}
    };
    gameEventManager.on(GameEventType.TURBO_ON, __turboLayerFix);
    gameEventManager.on(GameEventType.TURBO_OFF, __turboLayerFix);

    // Listen for bonus mode toggles to recreate borders with correct assets
    this.scene.events.on('setBonusMode', (isBonus: boolean) => {
      try {
        if (!isBonus) {

        } else {
          try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
          try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
          try { this.ensureScatterSymbolsVisible(); } catch {}
        }
        // Rebuild simple PNG borders (no dragon or spine borders) based on current bounds
        try { this.createBaseOverlayRect(); } catch {}
      } catch {}
    });

    // Listen for scatter bonus completion to restore symbol visibility
    this.scene.events.on('scatterBonusCompleted', () => {
      console.log('[Symbols] Scatter bonus completed event received - restoring symbol visibility');
      
      
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
  public getIdleSpineSymbolScale(symbolValue: number): number {
    const v = this.idleSpineSymbolScales[symbolValue];
    if (typeof v === 'number') return v;
    return 0.6;
  }
  
  public getWinSpineSymbolScale(symbolValue: number): number {
    const v = this.winSpineSymbolScales[symbolValue];
    if (typeof v === 'number' && v > 0) return v;
    return this.getIdleSpineSymbolScale(symbolValue);
  }
  
  public getImageSymbolScaleMultiplier(symbolValue: number): number {
    const v = this.imageSymbolScaleMultipliers[symbolValue];
    if (typeof v === 'number' && v > 0) return v;
    return 1;
  }
  
  public getIdleScaleMultiplier(symbolValue: number): number {
    // Multiplier disabled: rely solely on idleSpineSymbolScales for idle size
    return 1;
  }

  public getSpineScaleMultiplier(symbolValue: number): number {
    // Multiplier disabled: rely solely on idle/win scales for size
    return 1;
  }

	public applyIdleWaveShaderIfSymbolImage(symbol: any, symbolValue: number): void {
		try {
			if (!symbol || !(symbolValue === 8 || symbolValue === 9 || symbolValue === 10)) {
				return;
			}
			const sceneAny: any = this.scene as any;
			const renderer: any = sceneAny?.game?.renderer;
			const pipelineManager: any = renderer && renderer.pipelines;
			if (pipelineManager && typeof pipelineManager.add === 'function') {
				try {
					const store = pipelineManager.pipelines;
					const has = store && typeof store.has === 'function' && store.has('SymbolWaveVertical');
					if (!has) {
						pipelineManager.add('SymbolWaveVertical', new WaterWaveVerticalPipeline(sceneAny.game, {
							amplitude: 0.02,
							frequency: 12.0,
							speed: 4.0,
						}));
					}
				} catch {}
			}
			try {
				if (typeof (symbol as any).setPipeline === 'function') {
					(symbol as any).setPipeline('SymbolWaveVertical');
				}
			} catch {}
		} catch {}
	}

  // Auto-fit a Spine instance to the target cell size, with a safe fallback scale
  public getFittedSpineScale(spine: any, targetWidth: number, targetHeight: number, fallbackScale: number): number {
    try {
      // Prefer explicit configured scale when provided so all states (idle, spin, win, fillers)
      // share the same visual size per symbol.
      if (typeof fallbackScale === 'number' && fallbackScale > 0) {
        return fallbackScale;
      }
      const bounds = spine?.getBounds?.();
      const bw = (bounds?.size?.width ?? bounds?.size?.x ?? 0);
      const bh = (bounds?.size?.height ?? bounds?.size?.y ?? 0);
      if (bw > 0 && bh > 0) {
        const sx = targetWidth / bw;
        const sy = targetHeight / bh;
        return Math.min(sx, sy) * 0.95;
      }
    } catch {}
    return fallbackScale;
  }

  // Resolve the best animation name for a given symbol value based on cached Spine JSON
  public resolveSymbolAnimName(spineKey: string, symbolValue: number): string {
    // Default TB base name
    let base = `Symbol${symbolValue}_TB`;

    // For the money symbol (5), the visual variant may be backed by Symbol5_TB,
    // Symbol12_TB, Symbol13_TB or Symbol14_TB assets. Infer the correct base
    // name from the spine key when possible: symbol_{id}_spine → Symbol{id}_TB.
    if (symbolValue === 5 && spineKey) {
      try {
        const match = spineKey.match(/^symbol_(\d+)_spine$/);
        if (match && match[1]) {
          const id = parseInt(match[1], 10);
          if (!Number.isNaN(id)) {
            base = `Symbol${id}_TB`;
          }
        }
      } catch {}
    }

    const prefer = `${base}_win`;
    const fallback = `${base}_hit`;
    try {
      const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
      const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
      if (anims.includes(prefer)) return prefer;
      if (anims.includes(fallback)) return fallback;

      // Fallback: choose any available *_win / *_hit / *_idle animation
      const anyWin = anims.find((name: string) => name.endsWith('_win'));
      if (anyWin) return anyWin;
      const anyHit = anims.find((name: string) => name.endsWith('_hit'));
      if (anyHit) return anyHit;
      const anyIdle = anims.find((name: string) => name.endsWith('_idle'));
      if (anyIdle) return anyIdle;

      if (anims.length > 0) return anims[0];
    } catch {}
    return prefer; // default attempt
  }

  /**
   * Trigger _idle animations for NEW symbols in a specific reel after it drops
   * This works with the symbols that are currently being dropped (newSymbols)
   */
  public triggerIdleAnimationsForNewReel(reelIndex: number): void {
    this.applyIdleAnimationsForReelGrid(this.newSymbols, reelIndex, undefined, true);
  }

  /**
   * Trigger _idle animations for symbols in a specific reel after it drops
   * Excludes winning symbols from getting idle animations
   */
  public triggerIdleAnimationsForReel(reelIndex: number, winningPositions?: Set<string>): void {
    this.applyIdleAnimationsForReelGrid(this.symbols, reelIndex, winningPositions, false);
  }

  private applyIdleAnimationsForReelGrid(grid: any[][] | undefined, reelIndex: number, winningPositions: Set<string> | undefined, isNew: boolean): void {
    const label = isNew ? 'NEW ' : '';
    console.log(`[Symbols] Triggering _idle animations for ${label}reel ${reelIndex}`);

    if (!grid || !grid[0] || reelIndex >= grid[0].length) {
      console.warn(`[Symbols] Invalid ${isNew ? 'new ' : ''}reel index ${reelIndex} or symbols not ready`);
      return;
    }

    // Get winning positions from scene data if not provided
    let currentWinningPositions = winningPositions;
    if (!currentWinningPositions) {
      try {
        const sceneData = (this.scene as any)?.currentWinningPositions;
        if (sceneData) {
          currentWinningPositions = sceneData;
        }
      } catch {}
    }

    // Process each column for this specific reel
    for (let col = 0; col < grid.length; col++) {
      const symbol = grid[col][reelIndex];
      if (!symbol) continue;

      // Skip if this position is part of a winning combination
      if (currentWinningPositions && currentWinningPositions.has(`${col}_${reelIndex}`)) {
        console.log(`[Symbols] Skipping winning symbol at (${reelIndex}, ${col}) from idle animation`);
        continue;
      }

      try {
        // Get symbol value from current data
        const symbolValue = (this.scene as any)?.currentSymbolData?.[col]?.[reelIndex];
        if (typeof symbolValue !== 'number') continue;

        // Resolve Spine key; symbol 5 uses variant-specific Spine keys
        let spineKey = `symbol_${symbolValue}_spine`;
        let spineAtlasKey = spineKey + '-atlas';
        if (symbolValue === 5) {
          try {
            const spinData: any = (this as any).currentSpinData;
            let variant = getSymbol5VariantForCell(spinData, col, reelIndex) || getDefaultSymbol5Variant();

            // Start from the variant suggested by SpinData (money grid), but be robust:
            // if that exact variant spine isn't available, fall back to any available Symbol 5 spine.
            let variantInfo = getSymbol5SpineKeyForVariant(variant);
            let candidateKey = variantInfo.spineKey;
            const cacheJson: any = (this.scene.cache.json as any);
            let hasSpine = cacheJson?.has?.(candidateKey);

            if (!hasSpine) {
              const fallbackVariants = ['Symbol5_TB', 'Symbol12_TB', 'Symbol13_TB', 'Symbol14_TB'];
              for (const v of fallbackVariants) {
                try {
                  const info = getSymbol5SpineKeyForVariant(v as any);
                  if (cacheJson?.has?.(info.spineKey)) {
                    variant = v as any;
                    variantInfo = info;
                    candidateKey = info.spineKey;
                    hasSpine = true;
                    break;
                  }
                } catch {}
              }
            }

            if (hasSpine) {
              spineKey = candidateKey;
              spineAtlasKey = variantInfo.atlasKey;
            }
          } catch {}
        }

        let symbolName = `Symbol${symbolValue}_TB`;
        if (symbolValue === 5 && spineKey) {
          try {
            const match = spineKey.match(/^symbol_(\d+)_spine$/);
            if (match && match[1]) {
              const id = parseInt(match[1], 10);
              if (!Number.isNaN(id)) {
                symbolName = `Symbol${id}_TB`;
              }
            }
          } catch {}
        }
        let idleAnim = `${symbolName}_idle`;

        // Resolve available animation
        try {
          const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
          const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
          if (!anims.includes(idleAnim)) {
            const preferWin = `${symbolName}_win`;
            const fallbackHit = `${symbolName}_hit`;
            if (anims.includes(preferWin)) idleAnim = preferWin;
            else if (anims.includes(fallbackHit)) idleAnim = fallbackHit;
            else if (anims.length > 0) idleAnim = anims[0];
          }
        } catch {}

        const isSpine = !!(symbol as any).animationState;

        // Store current position and display size from the existing object
        const x = symbol.x;
        const y = symbol.y;
        const displayWidth = symbol.displayWidth;
        const displayHeight = symbol.displayHeight;

        let target: any = symbol;

        // If this is still a PNG/WEBP sprite but Spine data exists, convert it back to Spine in-place
        if (!isSpine) {
          let hasSpineJson = (this.scene.cache.json as any)?.has?.(spineKey);

          // Extra robustness for Symbol 5: if the exact variant key is missing, fall back to any loaded variant.
          if (!hasSpineJson && symbolValue === 5) {
            const cacheJson: any = (this.scene.cache.json as any);
            const fallbackVariants = ['Symbol5_TB', 'Symbol12_TB', 'Symbol13_TB', 'Symbol14_TB'];
            for (const v of fallbackVariants) {
              try {
                const info = getSymbol5SpineKeyForVariant(v as any);
                if (cacheJson?.has?.(info.spineKey)) {
                  spineKey = info.spineKey;
                  spineAtlasKey = info.atlasKey;
                  hasSpineJson = true;
                  break;
                }
              } catch {}
            }
          }

          const canCreateSpine = hasSpineJson && (this.scene.add as any)?.spine;
          if (!canCreateSpine) {
            console.log(`[Symbols] Skipping idle Spine animation for PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${col}) - no Spine data`);
            continue;
          }

          try {
            symbol.destroy();
          } catch {}

          try {
            const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
            spineSymbol.setOrigin(0.5, 0.5);
            const baseScale = this.getIdleSpineSymbolScale(symbolValue);
            try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
            try { (spineSymbol as any).__pngSize = { w: displayWidth, h: displayHeight }; } catch {}
            try { (spineSymbol as any).__pngNudge = this.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 }; } catch {}
            try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
            this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, baseScale, this.getIdleSymbolNudge(symbolValue));
            try {
              const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
              if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
            } catch {}
            try { this.container.add(spineSymbol); } catch {}
            grid[col][reelIndex] = spineSymbol;
            target = spineSymbol;
            console.log(`[Symbols] Converted PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${col}) back to Spine for idle animation`);
          } catch (e) {
            console.warn(`[Symbols] Failed to convert PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${col}) back to Spine:`, e);
            continue;
          }
        }

        // At this point target is a Spine symbol – set idle animation (loop)
        try { target.animationState.setAnimation(0, idleAnim, true); } catch {}
        // Re-center on next tick to compensate for bounds changes after animation starts
        this.reCenterSpineNextTick(target, x, y, this.getIdleSymbolNudge(symbolValue));
        console.log(`[Symbols] Set ${label.toLowerCase()}symbol at (${reelIndex}, ${col}) to idle animation: ${idleAnim}`);
      } catch (e) {
        console.warn(`[Symbols] Failed to set idle Spine on ${label.toLowerCase()}symbol at (${reelIndex}, ${col}):`, e);
      }
    }
  }

  private restoreIdleScaleForSymbol(target: any, symbolValue: number): void {
    try {
      if (!target || !(target as any).animationState) return;

      // Prefer stored home/size/nudge when available so we exactly match the
      // original idle placement for this symbol.
      const home = (target as any).__pngHome;
      const size = (target as any).__pngSize;
      const storedNudge = (target as any).__pngNudge;

      const cx = (home && typeof home.x === 'number') ? home.x : target.x;
      const cy = (home && typeof home.y === 'number') ? home.y : target.y;
      const w = (size && typeof size.w === 'number') ? size.w : this.displayWidth;
      const h = (size && typeof size.h === 'number') ? size.h : this.displayHeight;
      const nudge = storedNudge || this.getIdleSymbolNudge(symbolValue);

      const baseScale = this.getIdleSpineSymbolScale(symbolValue);
      this.centerAndFitSpine(target, cx, cy, w, h, baseScale, nudge);

      // Re-apply any configured multipliers so idle scale stays consistent
      // with how symbols were originally placed.
      try {
        const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
        if (m !== 1 && typeof (target as any).setScale === 'function') {
          (target as any).setScale(target.scaleX * m, target.scaleY * m);
        }
      } catch {}
    } catch {}
  }

  private resetAllSymbolsToIdle(): void {
    try {
      if (!this.symbols || !this.symbols[0]) {
        return;
      }
      const reels = this.symbols[0].length;
      for (let reelIndex = 0; reelIndex < reels; reelIndex++) {
        // Pass no explicit winningPositions so applyIdleAnimationsForReelGrid
        // will use the scene's currentWinningPositions set and skip true
        // winning cells. This avoids restarting win animations that are
        // already playing on those symbols.
        this.triggerIdleAnimationsForReel(reelIndex);
      }
    } catch {}
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
   * Pulse / ripple the given winning symbols for the currently drawn winline.
   * This is called by WinLineDrawer via symbolsReference.pulseWinningSymbols(winningGrids).
   *
   * Behaviour:
   * - Clears any existing ripple rings from all symbols so only the active winline is highlighted.
   * - Applies the shared image ripple helper to the winning symbols, with a small left-to-right delay
   *   based on their column (x) order in the winline.
   */
  public pulseWinningSymbols(winningGrids: Grid[]): void {
    try {
      if (!this.scene || !this.symbols || !Array.isArray(this.symbols)) {
        return;
      }

      // First, clear existing ripples from all symbols so only the current line is highlighted
      try {
        for (let outer = 0; outer < this.symbols.length; outer++) {
          const colOrRow = this.symbols[outer];
          if (!Array.isArray(colOrRow)) {
            continue;
          }
          for (let inner = 0; inner < colOrRow.length; inner++) {
            const symbol: any = colOrRow[inner];
            if (!symbol) {
              continue;
            }
            try { clearImageSymbolWinRipple(this.scene, symbol); } catch {}
          }
        }
      } catch {}

      if (!winningGrids || winningGrids.length === 0) {
        return;
      }

      // Sort winning symbols by column so the pulse travels left-to-right along the winline
      const sorted = [...winningGrids].sort((a, b) => a.x - b.x);
      const perColumnDelay = 80; // ms between columns

      sorted.forEach((grid, index) => {
        const sy = grid.y;
        const sx = grid.x;

        const rowOrCol = this.symbols[sy];
        if (!rowOrCol || !Array.isArray(rowOrCol)) {
          return;
        }
        const symbol: any = rowOrCol[sx];
        if (!symbol) {
          return;
        }

        const delayMs = index * perColumnDelay;
        try {
          this.scene.time.delayedCall(delayMs, () => {
            try {
              if (!symbol || (symbol as any).destroyed === true || symbol.active === false) {
                return;
              }
              // Apply ripple ring + size pulse
              applyImageSymbolWinRipple(this.scene, symbol);

              // Also apply a one-shot flash overlay using the same
              // shape/scale approach as SymbolFlash, but only for this symbol.
              try {
                const anySymbol: any = symbol as any;
                const home = (anySymbol as any).__pngHome as { x: number; y: number } | undefined;
                const nudge = (anySymbol as any).__pngNudge as { x: number; y: number } | undefined;

                const centerX = (home?.x ?? anySymbol.x) + (nudge?.x ?? 0);
                const centerY = (home?.y ?? anySymbol.y) + (nudge?.y ?? 0);
                // Use the symbol's own drawn size so the flash hugs the symbol
                const rawW = (anySymbol.displayWidth ?? this.displayWidth) as number;
                const rawH = (anySymbol.displayHeight ?? this.displayHeight) as number;
                const w = Math.max(2, rawW);
                const h = Math.max(2, rawH);

                let overlay: any;
                try {
                  const sceneAny: any = this.scene as any;

                  // Try to resolve a PNG texture key that matches this symbol's artwork.
                  let pngKey: string | undefined;

                  // 1) Prefer the logical symbol value from currentSymbolData when available
                  try {
                    const symbolData: number[][] | null = this.currentSymbolData;
                    let symbolValue: number | undefined;
                    const v = symbolData?.[sy]?.[sx];
                    if (typeof v === 'number') {
                      symbolValue = v;
                    }

                    if (symbolValue !== undefined) {
                      if (symbolValue === 5) {
                        // Money symbol 5: resolve variant-specific PNG key when possible
                        let variantKey: string | null = null;
                        try {
                          const spinData: any = this.currentSpinData;
                          if (spinData) {
                            variantKey = getSymbol5ImageKeyForCell(spinData, sy, sx);
                          }
                        } catch {}

                        if (variantKey && sceneAny.textures?.exists?.(variantKey)) {
                          pngKey = variantKey;
                        } else {
                          try {
                            const fallbackKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
                            if (sceneAny.textures?.exists?.(fallbackKey)) {
                              pngKey = fallbackKey;
                            }
                          } catch {}
                        }
                      } else {
                        const baseKey = `symbol_${symbolValue}`;
                        if (sceneAny.textures?.exists?.(baseKey)) {
                          pngKey = baseKey;
                        }
                      }
                    }
                  } catch {}

                  // 2) Fallback: use the symbol's own texture key if valid
                  if (!pngKey) {
                    const texKey = (anySymbol.texture && (anySymbol.texture as any).key) as string | undefined;
                    if (texKey && sceneAny.textures?.exists?.(texKey)) {
                      pngKey = texKey;
                    }
                  }

                  if (pngKey && sceneAny.textures?.exists?.(pngKey)) {
                    overlay = sceneAny.add.image(centerX, centerY, pngKey);
                    overlay.setOrigin(0.5, 0.5);
                    overlay.setDisplaySize(w, h);
                  } else {
                    // Final fallback: simple rect if no PNG key can be resolved
                    overlay = sceneAny.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
                    try { overlay.setOrigin(0.5, 0.5); } catch {}
                  }
                } catch {
                  overlay = this.scene.add.rectangle(centerX, centerY, w, h, 0xffffff, 1.0);
                  try { (overlay as any).setOrigin(0.5, 0.5); } catch {}
                }

                try { overlay.setDepth(1005); } catch {}
                try { (overlay as any).setBlendMode?.(Phaser.BlendModes.ADD); } catch {}

                const alphaStart = Math.max(0, Math.min(1, this.winSymbolFlashAlphaStart));
                const alphaEnd = Math.max(0, Math.min(1, this.winSymbolFlashFadeTo));
                overlay.setAlpha(alphaStart);

                const effectiveSpeed = Math.max(0.05, this.winSymbolFlashSpeedMultiplier);
                const dur = Math.max(20, Math.floor(this.winSymbolFlashDurationMs / effectiveSpeed));

                this.scene.tweens.add({
                  targets: overlay,
                  alpha: alphaEnd,
                  duration: dur,
                  ease: 'Sine.easeOut',
                  onComplete: () => {
                    try { overlay.destroy(); } catch {}
                  }
                });
              } catch {}
            } catch {}
          });
        } catch {}
      });
    } catch {}
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
   * Start the scatter animation sequence (called after win dialog closes or immediately if no dialog)
   */
  public startScatterAnimationSequence(mockData: any): void {
    console.log('[Symbols] Starting scatter animation sequence');
    
    // Reset winning symbols spine animations back to PNG after scatter symbol animations
    this.fadeOutAllReelVisuals(300);
    
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

    // Reset one-shot event flag per scatter animation sequence
    this.hasEmittedScatterWinStart = false;

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
            const symbolName = `Symbol${symbolValue}_TB`;
            // Prefer *_win if present, else *_hit
            let hitAnimationName = `${symbolName}_win`;
            try {
              const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
              const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
              if (!anims.includes(hitAnimationName)) {
                const fallback = `${symbolName}_hit`;
                hitAnimationName = anims.includes(fallback) ? fallback : hitAnimationName;
              }
            } catch {}
            
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
                // Use controlled scaling from configuration, then center and fit to cell
                const configuredScale = this.getWinSpineSymbolScale(symbolValue);
                // Remember the original PNG home position so PNG can restore it later
                try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
                // Set canonical measurement pose before centering
                try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
                this.centerAndFitSpine(spineSymbol, x, y, this.displayWidth, this.displayHeight, configuredScale, this.getWinSymbolNudge(symbolValue));
                try {
                  const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue);
                  if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
                } catch {}
                // Keep scatter Spine on the scene root and render above all gameplay layers
                // Do not reparent into the masked symbols container
                spineSymbol.setDepth(990); // Above all gameplay layers, just below dialogs (1000)
                this.symbols[col][row] = spineSymbol;
                
                // Register the scatter symbol with the ScatterAnimationManager
                if (this.scatterAnimationManager) {
                  this.scatterAnimationManager.registerScatterSymbol(spineSymbol);
                }
                
                // Ensure the Spine animation maintains the elevated depth
                // Depth within container is sufficient; overlay and win lines manage their own depths
                
                console.log(`[Symbols] Successfully replaced scatter sprite with Spine animation at column ${col}, row ${row} with depth:`, spineSymbol.depth);
                
                // Play the hit animation (looped)
                spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
                // Notify listeners exactly when Symbol0 winning animation starts (base-only)
                try {
                  if (!gameStateManager.isBonus && !this.hasEmittedScatterWinStart) {
                    this.hasEmittedScatterWinStart = true;
                    this.scene.events.emit('symbol0-win-start');
                    // Also fade the light grey base overlay for base scene when scatter starts
                    this.fadeBaseOverlayForScatterStart(250, 0);
                  }
                } catch {}
                // Re-center on next tick to compensate for bounds changes after animation starts
                this.reCenterSpineNextTick(spineSymbol, x, y, this.getWinSymbolNudge(symbolValue));
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
    // Also fade out the base overlay (light grey background behind symbols)
    try {
      if (this.baseOverlayRect) {
        this.scene.tweens.killTweensOf(this.baseOverlayRect);
        if (!this.baseOverlayRect.visible || this.baseOverlayRect.alpha <= 0) {
          this.baseOverlayRect.setVisible(false);
        } else {
          this.scene.tweens.add({
            targets: this.baseOverlayRect,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => { try { this.baseOverlayRect?.setVisible(false); } catch {} }
          });
        }
      }
    } catch {}
  }

  public ensureScatterSymbolsVisible(): void {
    try {
      const data = this.currentSymbolData;
      const grid = this.symbols;
      if (!grid || !data) return;
      for (let col = 0; col < grid.length; col++) {
        const column = grid[col];
        for (let row = 0; row < (column ? column.length : 0); row++) {
          try {
            const val = data?.[col]?.[row];
            if (val === 0) {
              const obj = column[row];
              if (obj && typeof obj.setVisible === 'function') {
                obj.setVisible(true);
              }
            }
          } catch {}
        }
      }
    } catch {}
  }


  /** Fade the base light-grey grid background when scatter win starts (base scene). */
  private fadeBaseOverlayForScatterStart(durationMs: number = 250, toAlpha: number = 0): void {
    try {
      if (!this.baseOverlayRect) return;
      this.scene.tweens.killTweensOf(this.baseOverlayRect);
      // Ensure it's visible before fading
      this.baseOverlayRect.setVisible(true);
      const targetAlpha = Math.max(0, Math.min(1, toAlpha));
      this.scene.tweens.add({
        targets: this.baseOverlayRect,
        alpha: targetAlpha,
        duration: Math.max(0, durationMs),
        ease: 'Cubic.easeOut'
      });
    } catch {}
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

    // During free spin autoplay, wait until win visuals (winline/dim/bg darken)
    // are finished before starting the next automatic spin.
    try {
      const gameData: GameData | null = (this.scene as any)?.gameData ?? null;
      if (gameData && isWinlinesShowing(gameData)) {
        console.log('[Symbols] performFreeSpinAutoplay blocked - win visuals still active, rescheduling');
        if (this.freeSpinAutoplayTimer) {
          try { this.freeSpinAutoplayTimer.destroy(); } catch {}
          this.freeSpinAutoplayTimer = null;
        }
        this.freeSpinAutoplayTimer = this.scene.time.delayedCall(100, () => {
          this.performFreeSpinAutoplay();
        });
        return;
      }
    } catch {}

    console.log(`[Symbols] ===== PERFORMING FREE SPIN AUTOPLAY =====`);
    console.log(`[Symbols] Free spin autoplay: ${this.freeSpinAutoplaySpinsRemaining} spins remaining`);
    
    // Check if we're still in bonus mode
    if (!gameStateManager.isBonus) {
      console.log('[Symbols] No longer in bonus mode - stopping free spin autoplay');
      this.stopFreeSpinAutoplay();
      return;
    }

    if (gameStateManager.isShowingWinDialog) {
      console.log('[Symbols] Win dialog is showing - pausing free spin autoplay');
      const baseDelay = 500;
      const turboDelay = gameStateManager.isTurbo ? baseDelay * TurboConfig.TURBO_DELAY_MULTIPLIER : baseDelay;
      let resumed = false;
      const resume = () => {
        if (resumed) return;
        resumed = true;
        console.log(`[Symbols] Scheduling free spin retry in ${turboDelay}ms (base: ${baseDelay}ms, turbo: ${gameStateManager.isTurbo})`);
        this.scene.time.delayedCall(turboDelay, () => { this.performFreeSpinAutoplay(); });
      };
      if (!gameStateManager.isShowingWinDialog) { resume(); return; }
      try {
        const wom: any = (this.scene as any).winOverlayManager;
        const hasOverlay = !!(wom && typeof wom.hasActiveOrQueued === 'function' && wom.hasActiveOrQueued());
        if (!hasOverlay) {
          console.log('[Symbols] No active/queued win overlay but isShowingWinDialog=true - clearing flag and resuming');
          gameStateManager.isShowingWinDialog = false;
          resume();
          return;
        }
      } catch {}
      console.log('[Symbols] Waiting for dialog completion events before continuing free spin autoplay');
      this.scene.events.once('dialogAnimationsComplete', () => { console.log('[Symbols] dialogAnimationsComplete received'); resume(); });
      gameEventManager.once(GameEventType.WIN_DIALOG_CLOSED, () => { console.log('[Symbols] WIN_DIALOG_CLOSED received'); resume(); });
      this.scene.time.delayedCall(0, () => { if (!gameStateManager.isShowingWinDialog) { resume(); } });
      this.scene.time.delayedCall(1800, () => {
        if (resumed) return;
        try {
          const wom: any = (this.scene as any).winOverlayManager;
          const hasOverlay = !!(wom && typeof wom.hasActiveOrQueued === 'function' && wom.hasActiveOrQueued());
          if (!hasOverlay) {
            console.log('[Symbols] Safety resume: clearing stale isShowingWinDialog and continuing');
            gameStateManager.isShowingWinDialog = false;
            resume();
          }
        } catch {}
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
    
    const gameScene = this.scene as any;
    
    // Close any open win dialogs first (safety check)
    if (gameScene.dialogs && typeof gameScene.dialogs.hideDialog === 'function') {
      if (gameScene.dialogs.isDialogShowing()) {
        console.log('[Symbols] Closing any remaining win dialogs before showing congrats');
        gameScene.dialogs.hideDialog();
      }
    }

    // Hide any win overlays that might be showing
    try {
      if (gameScene.bigWinOverlay && typeof gameScene.bigWinOverlay.hide === 'function' && typeof gameScene.bigWinOverlay.getIsShowing === 'function' && gameScene.bigWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding BigWinOverlay before showing congrats');
        gameScene.bigWinOverlay.hide(150);
      }
      if (gameScene.superWinOverlay && typeof gameScene.superWinOverlay.hide === 'function' && typeof gameScene.superWinOverlay.getIsShowing === 'function' && gameScene.superWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding SuperWinOverlay before showing congrats');
        gameScene.superWinOverlay.hide(150);
      }
      if (gameScene.epicWinOverlay && typeof gameScene.epicWinOverlay.hide === 'function' && typeof gameScene.epicWinOverlay.getIsShowing === 'function' && gameScene.epicWinOverlay.getIsShowing()) {
        console.log('[Symbols] Hiding EpicWinOverlay before showing congrats');
        gameScene.epicWinOverlay.hide(150);
      }
    } catch (e) {
      console.warn('[Symbols] Error hiding win overlays:', e);
    }
    
    // Clear win queue to prevent queued win dialogs from showing after congrats
    if (gameScene.clearWinQueue && typeof gameScene.clearWinQueue === 'function') {
      console.log('[Symbols] Clearing win queue before showing congrats');
      gameScene.clearWinQueue();
    }

    // Reset win dialog state
    gameStateManager.isShowingWinDialog = false;
    
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
    
    // Check if we're stopping because free spins are complete (before resetting state)
    const spinsWereComplete = this.freeSpinAutoplaySpinsRemaining <= 0;
    
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
    
    // If we're in bonus mode and all free spins are complete, ensure bonus mode is properly ended
    // This is a safety check - SlotController should have already handled this, but ensure it happens
    // even if a win overlay was blocking the transition
    if (gameStateManager.isBonus && spinsWereComplete) {
      console.log('[Symbols] All free spins complete - marking bonus as finished');
      gameStateManager.isBonusFinished = true;
      // Note: We don't emit setBonusMode(false) here because it should be handled by SlotController
      // or by the win overlay dismissal handler. This ensures we don't have duplicate transitions.
    }
    
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
  let centerY = self.scene.scale.height * 0.455;

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
  // Ensure the entire symbol grid renders above bubble stream systems (depth 878)
  try { self.container.setDepth(880); } catch {}

  // Create and store a geometry mask with configurable padding
  self.gridMaskShape = self.scene.add.graphics();
  self.gridMaskShape.clear();
  self.gridMaskShape.fillRect(
    self.slotX - self.totalGridWidth * 0.5 - self.gridMaskPaddingLeft,
    self.slotY - self.totalGridHeight * 0.5 - self.gridMaskPaddingTop,
    self.totalGridWidth + self.gridMaskPaddingLeft + self.gridMaskPaddingRight,
    self.totalGridHeight + self.gridMaskPaddingTop + self.gridMaskPaddingBottom
  );
  self.gridMask = self.gridMaskShape.createGeometryMask();
  self.container.setMask(self.gridMask);
  self.gridMaskShape.setVisible(false);
  console.log(`[Symbols] Mask created with padding - Left: ${self.gridMaskPaddingLeft}, Right: ${self.gridMaskPaddingRight}, Top: ${self.gridMaskPaddingTop}, Bottom: ${self.gridMaskPaddingBottom}`);
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

  // Ensure Spine factory is available for this scene so we can create Spine symbols
  const hasSpineFactory = ensureSpineFactory(scene as any, '[Symbols] createInitialSymbols');

  // Use fixed symbols for testing
  const symbols = [
    [0, 1, 3, 1, 0],  // Column 0: scatter, symbol1, symbol3, symbol1, scatter
    [1, 4, 2, 2, 2],  // Column 1: symbol1, symbol5, symbol2, symbol5, symbol2
    [2, 6, 7, 1, 8]   // Column 2: symbol2, symbol5, symbol5, symbol1, symbol5
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
      const symbolValue = symbols[col][row];
      let symbol: any;
      try {
        let spineKey = `symbol_${symbolValue}_spine`;
        let atlasKey = spineKey + '-atlas';
        if (symbolValue === 5) {
          const variantInfo = getSymbol5SpineKeyForVariant('Symbol5_TB' as any);
          spineKey = variantInfo.spineKey;
          atlasKey = variantInfo.atlasKey;
        }
        const hasSpineJson = (scene.cache.json as any)?.has?.(spineKey);

        if (hasSpineJson && (scene.add as any)?.spine) {
          // Create Spine symbol for initial grid
          const spineSymbol = (scene.add as any).spine(x, y, spineKey, atlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
          const baseScale = self.getIdleSpineSymbolScale(symbolValue);
          self.centerAndFitSpine(
            spineSymbol,
            x,
            y,
            self.displayWidth,
            self.displayHeight,
            baseScale,
            self.getIdleSymbolNudge(symbolValue)
          );
          try {
            const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
            if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m);
          } catch {}
          try {
            (spineSymbol as any).__pngHome = { x, y };
            (spineSymbol as any).__pngSize = { w: self.displayWidth, h: self.displayHeight };
            (spineSymbol as any).__pngNudge = self.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 };
          } catch {}
          try {
            (spineSymbol as any).displayWidth = self.displayWidth;
            (spineSymbol as any).displayHeight = self.displayHeight;
          } catch {}
          try {
            const symbolName = `Symbol${symbolValue}_TB`;
            let idleAnim = `${symbolName}_idle`;

            // Resolve available animation
            try {
              const cachedJson: any = (scene.cache.json as any).get(spineKey);
              const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
              if (!anims.includes(idleAnim)) {
                const preferWin = `${symbolName}_win`;
                const fallbackHit = `${symbolName}_hit`;
                if (anims.includes(preferWin)) idleAnim = preferWin;
                else if (anims.includes(fallbackHit)) idleAnim = fallbackHit;
                else if (anims.length > 0) idleAnim = anims[0];
              }
            } catch {}

            try { spineSymbol.animationState.setAnimation(0, idleAnim, true); } catch {}
            // Re-center on next tick to compensate for bounds changes after animation starts
            self.reCenterSpineNextTick(spineSymbol, x, y, self.getIdleSymbolNudge(symbolValue));
          } catch {}
          self.container.add(spineSymbol);
          symbol = spineSymbol;
        } else {
          let spriteKey: string | null = null;
          if (symbolValue === 5) {
            try {
              const key = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
              if (scene.textures.exists(key)) {
                spriteKey = key;
              }
            } catch {}
          }
          if (!spriteKey) {
            spriteKey = 'symbol_' + symbolValue;
          }

          if (spriteKey && scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] Failed to create initial symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        }
      } catch (e) {
        console.error('[Symbols] Error creating initial symbol:', e);
      }

      rows.push(symbol);
    }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');
}

/**
 * Process symbols from SpinData (GameAPI response)
 */
async function processSpinDataSymbols(self: Symbols, symbols: number[][], spinData: any) {
  console.log('[Symbols] Processing SpinData symbols:', symbols);
  
  // Track whether this spin contains a hook-scatter special so we can
  // trigger the hook-scatter sequence only after winlines finish.
  try {
    const special = spinData && spinData.slot && spinData.slot.special ? spinData.slot.special : null;
    (self as any).hasPendingHookScatter = !!(special && special.action === 'hook-scatter' && special.position);
  } catch {
    (self as any).hasPendingHookScatter = false;
  }
  
  // Clear all scatter symbols from previous spin
  if (self.scatterAnimationManager) {
    self.scatterAnimationManager.clearScatterSymbols();
  }
  
  // Reset symbols and clear previous state before starting new spin
  console.log('[Symbols] Resetting symbols and clearing previous state for new spin');
  self.ensureCleanSymbolState();
  
  // Always clear win lines and overlay when a new spin starts
  console.log('[Symbols] Clearing win lines and overlay for new spin');
  self.clearWinLines();
  
  // Create a mock Data object to use with existing functions
  const mockData = new Data();
  mockData.symbols = symbols;
  
  // Store current symbol data for idle animation access
  (self.scene as any).currentSymbolData = symbols;
  
  // Store winning positions for idle animation exclusion
  const winningPositions = new Set<string>();
  if (spinData.slot?.paylines && Array.isArray(spinData.slot.paylines) && spinData.slot.paylines.length > 0) {
    for (const payline of spinData.slot.paylines) {
      if (payline.positions && Array.isArray(payline.positions)) {
        for (const pos of payline.positions) {
          if (pos.x !== undefined && pos.y !== undefined) {
            winningPositions.add(`${pos.y}_${pos.x}`);
          }
        }
      }
    }
  }
  (self.scene as any).currentWinningPositions = winningPositions;
  
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
  self.scene.gameData.dropReelsDelay = 0;
  
  // Set spinning state
  gameStateManager.isReelSpinning = true;
  
  // Use the existing createNewSymbols function
  createNewSymbols(self, mockData);
  
  try {
    self.updateMoneyValueOverlays(spinData, self.newSymbols);
  } catch {}
  
  // Use the existing dropReels function
  await runDropReels(self, mockData, Symbols.FILLER_COUNT);
  
  disposeSymbols(self.symbols);
  self.symbols = self.newSymbols;
  self.newSymbols = [];

  try {
    self.updateMoneyValueOverlays(spinData);
  } catch {}

  // Replace with spine animations: winners + idle non-winners if there are wins
  // Note: Idle animations for non-winning symbols are now triggered per-reel in dropNewSymbols
  try {
    const hasPaylines = Array.isArray(spinData.slot?.paylines) && spinData.slot.paylines.length > 0;
    if (hasPaylines) {
      replaceWithSpineAnimations(self, mockData);
    }
    // No wins case: idle animations are now handled per-reel in dropNewSymbols
  } catch {}
  
  
  
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
    } else {
      console.log(`[Symbols] Win below dialog threshold (${multiplier.toFixed(2)}x) - autoplay continues`);
    }
  }

  // Draw win lines using the new SpinData method
  if (self.winLineDrawer) {
    if (spinData.slot.paylines && spinData.slot.paylines.length > 0) {
      // Determine win line animation type based on autoplay state and counter
      const slotController = (self.scene as any).slotController;
      const autoplaySpinsRemaining = slotController ? slotController.autoplaySpinsRemaining : 0;
      const isFreeSpinAutoplay = self.freeSpinAutoplayActive;
      // Normal autoplay is tracked via GameStateManager; exclude free-spin autoplay from this flag
      const isNormalAutoplay = gameStateManager.isAutoPlaying && !isFreeSpinAutoplay;
      const isLastAutoplaySpin = isNormalAutoplay && autoplaySpinsRemaining === 0;
      const isAutoplayActive = isNormalAutoplay && autoplaySpinsRemaining > 0;
      const isSkipActive = typeof (self as any).isSkipReelDropsActive === 'function' ? (self as any).isSkipReelDropsActive() : false;
      
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
      } else {
        // Manual spins (with or without turbo) should always loop winlines
        console.log('[Symbols] Drawing win lines from SpinData (looping for manual spin)');
        self.winLineDrawer.drawWinLinesFromSpinData(spinData);
      }
      
      } else {
      console.log('[Symbols] No paylines in SpinData, calling WinLineDrawer for no-wins scenario');
      self.winLineDrawer.drawWinLinesOnceFromSpinData(spinData);
    }
  }

  // NOW handle scatter symbols AFTER winlines are drawn
  if (scatterGrids.length >= 3) {
    console.log(`[Symbols] Scatter detected! Found ${scatterGrids.length} scatter symbols`);
    gameStateManager.isScatter = true;
    // Disable spin/controls immediately during scatter anticipation/transition
    try { (self.scene as any)?.events?.emit('scatterTransitionStart'); } catch {}

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
    
    // Pause normal autoplay immediately when scatter is detected (will resume after bonus)
    if (gameStateManager.isAutoPlaying) {
      console.log('[Symbols] Scatter detected during autoplay - pausing normal autoplay for bonus');
      // Access SlotController to pause autoplay
      const slotController = (self.scene as any).slotController;
      if (slotController && typeof slotController.pauseAutoplayForBonus === 'function') {
        slotController.pauseAutoplayForBonus();
        console.log('[Symbols] Normal autoplay paused due to scatter detection');
      } else if (slotController && typeof slotController.stopAutoplay === 'function') {
        // Fallback: stop if pause method not available
        slotController.stopAutoplay();
        console.log('[Symbols] Fallback: Normal autoplay stopped due to scatter detection');
      } else {
        console.warn('[Symbols] SlotController not available to pause/stop autoplay');
      }
    }
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
  
  // Set spinning state to false
  gameStateManager.isReelSpinning = false;
  // Restore tween speed if skip was active
  try { (self as any).clearSkipReelDrops?.(); } catch {}
  
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

/**
 * Calculate total win from paylines
 */
function calculateTotalWinFromPaylines(paylines: any[]): number {
  let totalWin = 0;
  for (const payline of paylines) {
    totalWin += payline.win;
  }
  return totalWin;
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

    // Forward SpinData to Game scene WinTracker (if available) to update win summary bar
    try {
      const gameScene: any = self.scene;
      if (gameScene && gameScene.winTracker && typeof gameScene.winTracker.updateFromSpinData === 'function') {
        gameScene.winTracker.updateFromSpinData(data.spinData);
      }
    } catch (error) {
      console.warn('[Symbols] Failed to update WinTracker from SpinData:', error);
    }
    
    // Use the slot.area from SpinData instead of data.symbols
    const symbols = data.spinData.slot.area;
    console.log('[Symbols] Using symbols from SpinData slot.area:', symbols);
    
    // Process the symbols using the normal spin pipeline
    await processSpinDataSymbols(self, symbols, data.spinData);
  });
}

function createNewSymbols(self: Symbols, data: Data) {
  const scene = self.scene;
  disposeSymbols(self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;

  const symbols = data.symbols;
  console.log('[Symbols] New symbols from spin response:', symbols);

  // Update current symbol data for reset purposes
  self.currentSymbolData = symbols;

  for (let col = 0; col < symbols.length; col++) {
    const rows: any[] = [];
    for (let row = 0; row < symbols[col].length; row++) {
      const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;
      const symbolValue = symbols[col][row];

      let symbol: any = null;

      try {
        if (symbolValue === 5) {
          // Prefer Spine-based Symbol 5 variants when possible for visual consistency.
          const spinData: any = (self as any).currentSpinData;
          let variant = getSymbol5VariantForCell(spinData, col, row) || getDefaultSymbol5Variant();

          // Resolve preferred Spine key for this variant
          let variantInfo = getSymbol5SpineKeyForVariant(variant);
          let spineKey = variantInfo.spineKey;
          let spineAtlasKey = variantInfo.atlasKey;

          const cacheJson: any = (scene.cache.json as any);
          let hasSpine = cacheJson?.has?.(spineKey);

          // If the exact variant spine is not available, fall back to any available Symbol 5 spine
          if (!hasSpine) {
            const fallbackVariants = ['Symbol5_TB', 'Symbol12_TB', 'Symbol13_TB', 'Symbol14_TB'];
            for (const v of fallbackVariants) {
              try {
                const info = getSymbol5SpineKeyForVariant(v as any);
                if (cacheJson?.has?.(info.spineKey)) {
                  spineKey = info.spineKey;
                  spineAtlasKey = info.atlasKey;
                  hasSpine = true;
                  break;
                }
              } catch {}
            }
          }

          const canCreateSpine = hasSpine && (scene.add as any)?.spine;
          if (canCreateSpine) {
            try {
              const spineSymbol = (scene.add as any).spine(x, y, spineKey, spineAtlasKey);
              spineSymbol.setOrigin(0.5, 0.5);
              try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}

              const baseScale = self.getIdleSpineSymbolScale(symbolValue);
              self.centerAndFitSpine(
                spineSymbol,
                x,
                y,
                self.displayWidth,
                self.displayHeight,
                baseScale,
                self.getIdleSymbolNudge(symbolValue)
              );

              self.container.add(spineSymbol);
              symbol = spineSymbol;
            } catch (e) {
              console.warn(`[Symbols] Failed to create Spine Symbol 5 at [${col}, ${row}] – falling back to PNG.`, e);
            }
          }

          // Fallback: use PNG variants if Spine could not be created
          if (!symbol) {
            let imageKey: string | null = null;
            try {
              imageKey = getSymbol5ImageKeyForVariant(variant);
              if (!scene.textures.exists(imageKey)) {
                // Fallback to default variant if this specific variant texture is missing
                variant = getDefaultSymbol5Variant();
                imageKey = getSymbol5ImageKeyForVariant(variant);
              }
            } catch {}

            // As a final guard, try any available Symbol 5 variant key
            if (!imageKey || !scene.textures.exists(imageKey)) {
              const candidates = ['symbol_5', 'symbol_12', 'symbol_13', 'symbol_14'];
              const found = candidates.find(k => scene.textures.exists(k));
              if (found) {
                imageKey = found;
              }
            }

            if (imageKey && scene.textures.exists(imageKey)) {
              const sprite = scene.add.sprite(x, y, imageKey);
              const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
              sprite.displayWidth = self.displayWidth * imageScale;
              sprite.displayHeight = self.displayHeight * imageScale;
              try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
              self.container.add(sprite);
              symbol = sprite;
            } else {
              console.warn(`[Symbols] No WEBP/Spine texture available for Symbol 5 at [${col}, ${row}] – leaving empty.`);
              symbol = null as any;
            }
          }
        } else {
          // Prefer WEBP/PNG sprites during spin when available for non-Symbol5
          const spriteKey = 'symbol_' + symbolValue;
          if (scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            // Fallback to Spine if no sprite texture exists
            const spineKey = `symbol_${symbolValue}_spine`;
            const atlasKey = spineKey + '-atlas';
            const hasSpine = (scene.cache.json as any)?.has?.(spineKey);
            if (hasSpine && (scene.add as any)?.spine) {
              symbol = (scene.add as any).spine(x, y, spineKey, atlasKey);
              symbol.setOrigin(0.5, 0.5);
              try { symbol.skeleton.setToSetupPose(); symbol.update(0); } catch {}
              const baseScale = self.getIdleSpineSymbolScale(symbolValue);
              self.centerAndFitSpine(
                symbol,
                x,
                y,
                self.displayWidth,
                self.displayHeight,
                baseScale,
                self.getWinSymbolNudge(symbolValue)
              );
              self.container.add(symbol);
            } else {
              console.warn(`[Symbols] No Spine or PNG texture for new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
              symbol = null as any;
            }
          }
        }
      } catch (error) {
        // Final safety fallback to PNG if available
        let spriteKey: string;
        if (symbolValue === 5) {
          // Default Symbol 5 variant as last-resort fallback
          try {
            spriteKey = getSymbol5ImageKeyForVariant(getDefaultSymbol5Variant());
          } catch {
            spriteKey = 'symbol_5';
          }
        } else {
          spriteKey = 'symbol_' + symbolValue;
        }

        try {
          if (scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            const imageScale = self.getImageSymbolScaleMultiplier(symbolValue);
            sprite.displayWidth = self.displayWidth * imageScale;
            sprite.displayHeight = self.displayHeight * imageScale;
            try { self.applyIdleWaveShaderIfSymbolImage(sprite, symbolValue); } catch {}
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] Failed to create new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        } catch {
          console.warn(`[Symbols] Exception while creating fallback for symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
          symbol = null as any;
        }
      }

      rows.push(symbol);
    }

    self.newSymbols.push(rows);
  }
}

function disposeSymbols(symbols: any[][]) {
  console.log('[Symbols] Disposing old symbols...');
  let disposedCount = 0;
  
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      const symbol: any = symbols[col][row];
      if (symbol && symbol.destroy && !symbol.destroyed) {
        try {
          const symbolType = (symbol as any).animationState ? 'Spine' : 'PNG';
          const symbolKey = (symbol as any).texture?.key || 'unknown';
          (symbol as any).destroy();
          disposedCount++;
        } catch (error) {
          console.error(`[Symbols] Error disposing symbol at (${col}, ${row}):`, error);
        }
      }
    }
  }
  
  console.log(`[Symbols] Disposed ${disposedCount} symbols`);
}

function replaceWithSpineAnimations(self: Symbols, data: Data) {
  // Use the Wins map from the backend-style Data object
  const wins: any = (data as any).wins;
  if (!wins || !wins.allMatching || !(wins.allMatching instanceof Map)) {
    return;
  }

  const winningPositions = new Set<string>();
  let hasPlayedWinSfx = false;

  for (const [, grids] of wins.allMatching.entries()) {
    for (const grid of grids) {
      const currentSymbol = self.symbols[grid.y] && self.symbols[grid.y][grid.x];
      if (!currentSymbol) {
        continue;
      }

      // Mark this cell as a winner
      winningPositions.add(`${grid.y}_${grid.x}`);
      
      // Get the symbol value and construct the Spine key
      const symbolValue = data.symbols[grid.y][grid.x];

      let spineKey = `symbol_${symbolValue}_spine`;
      let spineAtlasKey = spineKey + '-atlas';
      if (symbolValue === 5) {
        try {
          const spinData: any = (self as any).currentSpinData;
          const variant = getSymbol5VariantForCell(spinData, grid.y, grid.x) || getDefaultSymbol5Variant();
          const variantInfo = getSymbol5SpineKeyForVariant(variant);
          spineKey = variantInfo.spineKey;
          spineAtlasKey = variantInfo.atlasKey;
        } catch {}
      }
      // Resolve the best available animation for this symbol (prefer _win, then _hit, else first)
      const winAnimName = self.resolveSymbolAnimName(spineKey, symbolValue);
      
      // Store original position and scale
      const x = currentSymbol.x;
      const y = currentSymbol.y;
      const displayWidth = currentSymbol.displayWidth;
      const displayHeight = currentSymbol.displayHeight;
      
      try {
        // Apply Spine-based win animation for this cell
        const hasExistingSpine = !!(currentSymbol as any)?.animationState;

        if (hasExistingSpine) {
          // Reuse existing Spine target
          const target: any = currentSymbol;

          // Capture starting scale to allow a smooth tween to the win scale
          const startScaleX = (target as any).scaleX ?? 1;
          const startScaleY = (target as any).scaleY ?? 1;

          const configuredScale = self.getWinSpineSymbolScale(symbolValue);
          self.centerAndFitSpine(target, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));

          // Compute final scale including any multipliers
          let finalScaleX = (target as any).scaleX;
          let finalScaleY = (target as any).scaleY;
          try {
            const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
            if (m !== 1) {
              finalScaleX *= m;
              finalScaleY *= m;
            }
          } catch {}

          // Reset to starting scale and tween smoothly up to the win scale
          try { (target as any).setScale(startScaleX, startScaleY); } catch {}
          try {
            self.scene.tweens.add({
              targets: target,
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              duration: 250,
              ease: 'Power2.easeOut',
            });
          } catch {}

          try { (target as any).animationState.setAnimation(0, winAnimName, true); } catch {}
          try {
            const speed = (window as any)?.gameStateManager?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
            (target as any).animationState.timeScale = Math.max(0.0001, speed);
          } catch {}
          self.reCenterSpineNextTick(target, x, y, self.getWinSymbolNudge(symbolValue));
        } else {
          // No existing Spine instance – create one if possible
          const hasSpineJson = (self.scene.cache.json as any)?.has?.(spineKey);
          const canCreateSpine = hasSpineJson && (self.scene.add as any)?.spine;
          if (!canCreateSpine) {
            console.log(`[Symbols] No Spine data for winning symbol ${symbolValue} at (${grid.x}, ${grid.y}); keeping PNG/WEBP symbol.`);
            // Keep the existing PNG/WEBP symbol without adding a special-case ripple here.
            // Ripple/pulse highlighting is now driven centrally by pulseWinningSymbols per winline.
            continue;
          }
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          // Remove the current sprite
          currentSymbol.destroy();
          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          const configuredScale = self.getWinSpineSymbolScale(symbolValue);
          try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
          self.centerAndFitSpine(spineSymbol, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));

          // Compute final target scale including multipliers, then tween up to it smoothly
          let finalScaleX = spineSymbol.scaleX;
          let finalScaleY = spineSymbol.scaleY;
          try {
            const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
            if (m !== 1) {
              finalScaleX *= m;
              finalScaleY *= m;
            }
          } catch {}

          try {
            const startScaleX = finalScaleX * 0.85;
            const startScaleY = finalScaleY * 0.85;
            spineSymbol.setScale(startScaleX, startScaleY);
            self.scene.tweens.add({
              targets: spineSymbol,
              scaleX: finalScaleX,
              scaleY: finalScaleY,
              duration: 250,
              ease: 'Power2.easeOut',
            });
          } catch {}

          spineSymbol.animationState.setAnimation(0, winAnimName, true);
          try {
            const speed = (window as any)?.gameStateManager?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
            (spineSymbol as any).animationState.timeScale = Math.max(0.0001, speed);
          } catch {}
          self.reCenterSpineNextTick(spineSymbol, x, y, self.getWinSymbolNudge(symbolValue));
          self.container.add(spineSymbol);
          self.symbols[grid.y][grid.x] = spineSymbol;
        }

        // Play win SFX once when winning symbol animations start
        try {
          if (!hasPlayedWinSfx) {
            const audio = (window as any)?.audioManager;
            if (audio && typeof audio.playSoundEffect === 'function') {
              audio.playSoundEffect(SoundEffectType.HIT_WIN);
              hasPlayedWinSfx = true;
              try {
                if (gameStateManager.isScatter) {
                  self.scene.time.delayedCall(100, () => {
                    try { audio.playSoundEffect(SoundEffectType.SCATTER); } catch {}
                  });
                }
              } catch {}
            }
          }
        } catch {}
        
      } catch (error) {
        console.warn(`[Symbols] Failed to apply Spine animation at (${grid.x}, ${grid.y}):`, error);
        // Fallback to the old tint method if animation target not available
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

  // After all winning symbols are handled, dim and shrink non-winning symbols
  if (winningPositions.size > 0) {
    try { applyNonWinningSymbolDim(self.scene, self.symbols, winningPositions, (self as any).currentSymbolData); } catch {}
  }

  // Note: Non-winning symbols idle animations are now handled per-reel in dropNewSymbols
  // This ensures idle animations start after each reel drops rather than all at once
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

