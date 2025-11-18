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
import { SLOT_ROWS, SLOT_COLUMNS, DELAY_BETWEEN_SPINS } from '../../config/GameConfig';
import { SoundEffectType } from '../../managers/AudioManager';
import { BORDER_UPPER_OFFSET_Y, BORDER_LOWER_OFFSET_Y } from '../../config/UIPositionConfig';
import { DebugSymbolProbe } from './DebugSymbolProbe';
import { ensureSpineFactory } from '../../utils/SpineGuard';

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
  private baseOverlayBounds?: Phaser.Geom.Rectangle;
  private reelBackground?: Phaser.GameObjects.Image;
  private reelBgTintTween?: Phaser.Tweens.Tween;
  private reelBgFlashTween?: Phaser.Tweens.Tween;
  private scatterForegroundContainer?: Phaser.GameObjects.Container;
  private liftedScatterSymbols: Array<{ obj: any; col: number; row: number }> = [];
  // Reel background modifiers
  private reelBgScale: number = 1.0; // uniform scale to apply after size fitting
  private reelBgOffsetX: number = 0;  // pixel offset on X
  private reelBgOffsetY: number = 0;  // pixel offset on Y
  private reelBgWidthMultiplier: number = 1.15;  // multiply base fitted width
  private reelBgHeightMultiplier: number = 1.15; // multiply base fitted height
  private reelBgAlpha: number = 0.2; // opacity 0..1
  private reelBgTintDefaultColor: number = 0xffffff;
  private reelBgTintDefaultAlpha: number = 0.20;
  private reelBgTintSpinColor: number = 0x282828;
  private reelBgTintSpinAlpha: number = 0.5;
  private reelBgTintWinColor: number = 0x000000;
  private reelBgTintWinAlpha: number = 0.7;
  private reelBgTintAnticipationColor: number = 0x000000;
  private reelBgTintAnticipationAlpha: number = 0.8;
  private reelBgTintAnticipationTransfer: number = 0x2D2D2D;
  // Flag to control use of legacy black winning overlay graphics
  private useLegacyWinningOverlay: boolean = false;
  private baseOverlayBorderUpper?: any;
  private baseOverlayBorderLower?: any;
  // Keep separate references for base vs bonus dragons
  private baseTopDragon?: any;
  private baseBottomDragon?: any;
  private bonusTopDragon?: any;
  private bonusBottomDragon?: any;
  private hasEmittedScatterWinStart: boolean = false;
  private baseBorderContainer?: Phaser.GameObjects.Container;
  public currentSpinData: any = null; // Store current spin data for access by other components
  
  

  // Grid mask configuration and references
  public gridMaskShape?: Phaser.GameObjects.Graphics;
  public gridMask?: Phaser.Display.Masks.GeometryMask;
  public gridMaskPaddingLeft: number = 10;
  public gridMaskPaddingRight: number = 20;
  public gridMaskPaddingTop: number = 11;
  public gridMaskPaddingBottom: number = 25;

  // Flash overlay defaults (used by flashAllSymbolsOverlay)
  private flashOverlayAlphaStart: number = 0.9;
  private flashOverlayFadeTo: number = 0.0;
  private flashOverlayDurationMs: number = 120;
  private flashOverlaySpeedMultiplier: number = 1.0;

  // Bonus dragon border spine Y-offsets (apply only to spines/images in bonus)
  public bonusDragonTopOffsetY: number = 0;
  public bonusDragonBottomOffsetY: number = 0;

  // Base overlay (light grey behind symbols) padding in pixels
  public baseOverlayPaddingLeft: number = 20;
  public baseOverlayPaddingRight: number = 20;
  public baseOverlayPaddingTop: number = 10;
  public baseOverlayPaddingBottom: number = 27; // slightly larger bottom by default

  // PNG border offsets (apply to image-based borders in any mode)
  public borderTopOffsetY: number = 0;
  public borderBottomOffsetY: number = -14;

  // Modifier for base-scene upper border skeleton (scale and position offsets)
  private baseBorderSkeletonScale: number = 3;
  private baseBorderSkeletonOffsetX: number = 420;
  private baseBorderSkeletonOffsetY: number = -15;
  private baseBorderSkeletonUseAbsoluteScale: boolean = false;
  private baseBorderSkeletonAbsoluteScale: number = 1.0;
  private baseBorderSkeletonHalfOffscreen: boolean = false;
  private baseBorderSkeletonOffscreenSide: 'left' | 'right' = 'left';
  private baseBorderSkeletonTimeScale: number = 1.6;
  private baseBorderSkeletonFrameStep: number = 1;
  private baseBorderSkeletonFrameCounter: number = 0;

  // Separate modifiers for bottom mirrored dragon_default
  private baseBorderBottomScale: number = 3.9;
  private baseBorderBottomOffsetX: number = 620;
  private baseBorderBottomOffsetY: number = 8;
  private baseBorderBottomUseAbsoluteScale: boolean = false;
  private baseBorderBottomAbsoluteScale: number = 1.0;
  private baseBorderBottomTimeScale: number = 1.5;
  private baseBorderBottomFrameStep: number = 1;
  private baseBorderBottomFrameCounter: number = 0;

  // Start time (in seconds) to loop dragon_default from, skipping 0..start
  private dragonLoopStartSeconds: number = 1.8;
  // Speed modifier for Dragon_Top_Bonus (applied in bonus mode)
  private dragonTopBonusSpeedModifier: number = 1.5;
  // Speed modifier for bottom dragon_bonus (applied in bonus mode)
  private dragonBottomBonusSpeedModifier: number = 1.0;

  // Extra bonus-only offset for bottom dragon (applied on top of base bottom offsets)
  private bonusBottomExtraOffsetY: number = -15;

  private __borderUpdateHandler?: (time: number, delta: number) => void;

  // Configuration for Spine symbol scales - adjust these values manually
  private spineSymbolScales: { [key: number]: number } = {
    0:  0.085,   // Symbol0_HTBH (scatter) scale
    1:  0.075,  // Symbol1_HTBH scale
    2:  0.070,  // Symbol2_HTBH scale
    3:  0.130,  // Symbol3_HTBH scale
    4:  0.085,  // Symbol4_HTBH scale
    5:  0.180,  // Symbol5_HTBH scale
    6:  0.085,  // Symbol6_HTBH scale
    7:  0.070,  // Symbol7_HTBH scale
    8:  0.070,  // Symbol8_HTBH scale
    9:  0.070,  // Symbol9_HTBH scale
    10: 0.070,  // Symbol10_HTBH scale
    11: 0.070,  // Symbol11_HTBH scale
    12: 0.173,  // Symbol12_HTBH (wildcard x2) scale
    13: 0.173,  // Symbol13_HTBH (wildcard x3) scale
    14: 0.173  // Symbol14_HTBH (wildcard x4) scale
  };
  
  // Configuration for Spine symbol scales in idle animations - adjust these values manually
  private idleSpineSymbolScales: { [key: number]: number } = {
    0:  0.065,   // Symbol0_HTBH (scatter) idle scale
    1:  0.070,  // Symbol1_HTBH idle scale
    2:  0.065,  // Symbol2_HTBH idle scale
    3:  0.130,  // Symbol3_HTBH idle scale
    4:  0.070,  // Symbol4_HTBH idle scale
    5:  0.175,  // Symbol5_HTBH idle scale
    6:  0.075,  // Symbol6_HTBH idle scale
    7:  0.070,  // Symbol7_HTBH idle scale
    8:  0.070,  // Symbol8_HTBH idle scale
    9:  0.070,  // Symbol9_HTBH idle scale
    10: 0.070,  // Symbol10_HTBH idle scale
    11: 0.070,  // Symbol11_HTBH idle scale
    12: 0.153,  // Symbol12_HTBH (wildcard x2) idle scale
    13: 0.153,  // Symbol13_HTBH (wildcard x3) idle scale
    14: 0.153   // Symbol14_HTBH (wildcard x4) idle scale
  };
  
  private idleScaleMultipliers: { [key: number]: number } = {};
  private spineScaleMultipliers: { [key: number]: number } = {};

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

  // Sticky wild / multiplier tracking for bonus free spins (client-side visual layer)
  private stickyMultiplierPositions: Array<{ col: number; row: number; symbol: number }> = [];
  private stickyMultiplierOverlays: Array<{ col: number; row: number; sprite: Phaser.GameObjects.Sprite }> = [];
  // Previous-spin sticky positions (used to decide which cells should be reused/skipped this spin)
  private prevStickyMultiplierPositions: Array<{ col: number; row: number; symbol: number }> = [];

  // Scatter anticipation overlay
  private scatterOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor() { 
    this.scatterAnimationManager = ScatterAnimationManager.getInstance();
    this.symbolDetector = new SymbolDetector();
  }

  public startReelBgAnticipationFlash(cycleDurationMs: number = 600): void {
    if (!this.reelBackground || !this.scene) return;
    try {
      const img = this.reelBackground as any;
      try { this.reelBgTintTween?.stop(); this.reelBgTintTween = undefined; } catch {}
      try { this.reelBgFlashTween?.stop(); this.reelBgFlashTween = undefined; } catch {}
      this.scene.tweens.killTweensOf(img);
      const from = Phaser.Display.Color.IntegerToRGB(this.reelBgTintAnticipationTransfer);
      const to = Phaser.Display.Color.IntegerToRGB(this.reelBgTintAnticipationColor);
      const data: any = { r: from.r, g: from.g, b: from.b };
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const eff = Math.max(60, Math.floor(cycleDurationMs * turboMul));
      img.setVisible(true);
      this.reelBgFlashTween = this.scene.tweens.add({
        targets: data,
        r: to.r,
        g: to.g,
        b: to.b,
        duration: eff,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        onUpdate: () => {
          try { img.setTint(Phaser.Display.Color.GetColor(Math.floor(data.r), Math.floor(data.g), Math.floor(data.b))); } catch {}
          try { img.setAlpha(this.reelBgTintAnticipationAlpha); } catch {}
        }
      });
    } catch {}
  }

  public stopReelBgAnticipationFlash(): void {
    try { this.reelBgFlashTween?.stop(); } catch {}
    try { this.reelBgFlashTween = undefined; } catch {}
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
      try { this.fadeOutReelBackground(durationMs); } catch {}
      try { this.scene.time.delayedCall(Math.max(0, durationMs + 50), () => { try { this.clearWinLines(); } catch {} }); } catch {}
    } catch {}
  }

  public flashReelOverlay(reelIndex: number): void {
    try {
      if (!this.symbols || !this.symbols.length || !this.symbols[0] || !this.symbols[0].length) return;
      let overlaysCreated = 0;
      let pending = 0;
      for (let col = 0; col < this.symbols.length; col++) {
        const obj = this.symbols[col][reelIndex];
        if (!obj) continue;
        if ((obj as any).animationState) {
          const center = (this as any).getCellCenter(col, reelIndex);
          const w = Math.max(2, this.displayWidth);
          const h = Math.max(2, this.displayHeight);
          const g = this.scene.add.graphics();
          g.fillStyle(0xffffff, Math.max(0, Math.min(1, this.flashOverlayAlphaStart)));
          g.fillRect(center.x - w * 0.5, center.y - h * 0.5, w, h);
          try { g.setDepth(1005); } catch {}
          overlaysCreated++;
          const effectiveSpeed = Math.max(0.05, this.flashOverlaySpeedMultiplier);
          const dur = Math.max(20, Math.floor(this.flashOverlayDurationMs / effectiveSpeed));
          pending++;
          this.scene.tweens.add({
            targets: g,
            alpha: Math.max(0, Math.min(1, this.flashOverlayFadeTo)),
            duration: dur,
            ease: 'Sine.easeOut',
            onComplete: () => {
              try { g.destroy(); } catch {}
              try {
                pending--;
                if (pending === 0 && overlaysCreated > 0) {
                  this.clearWinLines();
                }
              } catch {}
            }
          });
          continue;
        }
        let symbolValue: number | undefined;
        try {
          const key: string | undefined = (obj as any)?.texture?.key;
          if (key && key.startsWith('symbol_')) {
            const parts = key.split('_');
            const parsed = parseInt(parts[1], 10);
            if (!Number.isNaN(parsed)) symbolValue = parsed;
          }
        } catch {}
        const pngKey = symbolValue !== undefined ? `symbol_${symbolValue}` : ((obj as any)?.texture?.key || '');
        if (!pngKey || !this.scene.textures.exists(pngKey)) continue;
        const home = (obj as any).__pngHome as { x: number; y: number } | undefined;
        const size = (obj as any).__pngSize as { w: number; h: number } | undefined;
        const nudge = (obj as any).__pngNudge as { x: number; y: number } | undefined;
        const overlayOnly = (symbolValue !== undefined ? this.getOverlayNudge(symbolValue) : undefined) || { x: 0, y: 0 };
        const centerX = (home?.x ?? obj.x) + (nudge?.x ?? 0) + overlayOnly.x;
        const centerY = (home?.y ?? obj.y) + (nudge?.y ?? 0) + overlayOnly.y;
        const w = Math.max(2, size?.w ?? obj.displayWidth ?? 0);
        const h = Math.max(2, size?.h ?? obj.displayHeight ?? 0);
        const overlayImg = this.scene.add.image(centerX, centerY, pngKey);
        overlayImg.setOrigin(0.5, 0.5);
        overlayImg.setDisplaySize(w, h);
        try { overlayImg.setDepth(1005); } catch {}
        if (typeof (overlayImg as any).setBlendMode === 'function') {
          (overlayImg as any).setBlendMode(Phaser.BlendModes.ADD);
        }
        if (typeof (overlayImg as any).setTintFill === 'function') {
          (overlayImg as any).setTintFill(0xffffff);
        } else if (typeof (overlayImg as any).setTint === 'function') {
          (overlayImg as any).setTint(0xffffff);
        }
        overlayImg.setAlpha(Math.max(0, Math.min(1, this.flashOverlayAlphaStart)));
        overlayImg.setVisible(true);
        overlaysCreated++;
        const effectiveSpeed2 = Math.max(0.05, this.flashOverlaySpeedMultiplier);
        const dur2 = Math.max(20, Math.floor(this.flashOverlayDurationMs / effectiveSpeed2));
        pending++;
        this.scene.tweens.add({
          targets: overlayImg,
          alpha: Math.max(0, Math.min(1, this.flashOverlayFadeTo)),
          duration: dur2,
          ease: 'Sine.easeOut',
          onComplete: () => {
            try { overlayImg.destroy(); } catch {}
            try {
              pending--;
              if (pending === 0 && overlaysCreated > 0) {
                this.clearWinLines();
              }
            } catch {}
          }
        });
      }
      console.log(`[Symbols] flashReelOverlay overlays: ${overlaysCreated} (reel ${reelIndex})`);
    } catch {}
  }

  public liftReelSymbolsAboveReelBg(reelRowIndex: number): void {
    try {
      this.ensureScatterForegroundContainer();
      const grid = (this.newSymbols && this.newSymbols.length > 0) ? this.newSymbols : this.symbols;
      if (!grid) return;
      for (let col = 0; col < grid.length; col++) {
        try {
          const column = grid[col];
          const obj = column?.[reelRowIndex];
          if (!obj) continue;
          const parent = (obj as any).parentContainer as Phaser.GameObjects.Container | undefined;
          if (parent === this.scatterForegroundContainer) continue;
          try { this.container?.remove(obj); } catch {}
          try { this.scatterForegroundContainer?.add(obj); } catch {}
          this.liftedScatterSymbols.push({ obj, col, row: reelRowIndex });
        } catch {}
      }
      try { (this.scene as any)?.children?.bringToTop?.(this.scatterForegroundContainer); } catch {}
    } catch {}
  }

  /** Accessor: container that holds dragon_default and related base border visuals */
  public getBaseBorderContainer(): Phaser.GameObjects.Container | undefined {
    return this.baseBorderContainer;
  }

  /** Animate top dragon (upper) to a target X */
  public animateTopDragonToX(targetX: number, durationMs: number = 1200, ease: string = 'Sine.easeInOut'): void {
    try {
      const target: any = this.baseTopDragon || this.baseOverlayBorderUpper; // fallback to current upper
      if (!target) return;
      this.scene.tweens.add({
        targets: target,
        x: targetX,
        duration: Math.max(0, durationMs),
        ease,
        onStart: () => { try { this.scene.events.emit('baseTopDragonMoveStart'); } catch {} },
        onComplete: () => { try { this.scene.events.emit('baseTopDragonMoveComplete'); } catch {} }
      });
    } catch {}
  }

  /** Animate bottom dragon (lower) to a target X */
  public animateBottomDragonToX(targetX: number, durationMs: number = 1200, ease: string = 'Sine.easeInOut'): void {
    try {
      const target: any = this.baseBottomDragon || this.baseOverlayBorderLower; // fallback to current lower
      if (!target) return;
      this.scene.tweens.add({ targets: target, x: targetX, duration: Math.max(0, durationMs), ease });
    } catch {}
  }

  /** Bonus-only: set extra offset Y for bottom dragon (applied on top of base bottom offsets) */
  public setBonusBottomExtraOffsetY(offsetY: number): void {
    this.bonusBottomExtraOffsetY = offsetY || 0;
    try {
      const d: any = this.bonusBottomDragon;
      if (d) {
        const baseY = (d as any).__bonusBottomBaseY ?? (d.y - (this.baseBorderBottomOffsetY || 0) - (this.bonusBottomExtraOffsetY || 0));
        d.y = baseY + (this.baseBorderBottomOffsetY || 0) + this.bonusBottomExtraOffsetY;
      }
    } catch {}
  }

  /**
   * Update base-scene border skeleton modifier values.
   * Provide any subset; omitted fields remain unchanged.
   */
  public setBaseBorderSkeletonModifier(mod: { scale?: number; offsetX?: number; offsetY?: number; useAbsoluteScale?: boolean; absoluteScale?: number; halfOffscreen?: boolean; offscreenSide?: 'left' | 'right'; timeScale?: number }): void {
    if (typeof mod.scale === 'number') this.baseBorderSkeletonScale = mod.scale;
    if (typeof mod.offsetX === 'number') this.baseBorderSkeletonOffsetX = mod.offsetX;
    if (typeof mod.offsetY === 'number') this.baseBorderSkeletonOffsetY = mod.offsetY;
    if (typeof mod.useAbsoluteScale === 'boolean') this.baseBorderSkeletonUseAbsoluteScale = mod.useAbsoluteScale;
    if (typeof mod.absoluteScale === 'number') this.baseBorderSkeletonAbsoluteScale = mod.absoluteScale;
    if (typeof mod.halfOffscreen === 'boolean') this.baseBorderSkeletonHalfOffscreen = mod.halfOffscreen;
    if (mod.offscreenSide === 'left' || mod.offscreenSide === 'right') this.baseBorderSkeletonOffscreenSide = mod.offscreenSide;
    if (typeof mod.timeScale === 'number') {
      this.baseBorderSkeletonTimeScale = Math.max(0.0001, mod.timeScale);
      try {
        const st = (this.baseOverlayBorderUpper as any)?.animationState;
        if (st) st.timeScale = this.baseBorderSkeletonTimeScale;
      } catch {}
    }
    if (typeof (mod as any).frameStep === 'number') {
      const step = Math.max(1, Math.floor((mod as any).frameStep));
      this.baseBorderSkeletonFrameStep = step;
      try {
        const st = (this.baseOverlayBorderUpper as any)?.animationState;
        if (st) st.timeScale = (step > 1) ? 0 : this.baseBorderSkeletonTimeScale;
      } catch {}
    }
  }

  /** Update bottom mirrored dragon modifiers */
  public setBaseBorderBottomModifier(mod: { scale?: number; offsetX?: number; offsetY?: number; useAbsoluteScale?: boolean; absoluteScale?: number; timeScale?: number; frameStep?: number }): void {
    if (typeof mod.scale === 'number') this.baseBorderBottomScale = mod.scale;
    if (typeof mod.offsetX === 'number') this.baseBorderBottomOffsetX = mod.offsetX;
    if (typeof mod.offsetY === 'number') this.baseBorderBottomOffsetY = mod.offsetY;
    if (typeof mod.useAbsoluteScale === 'boolean') this.baseBorderBottomUseAbsoluteScale = mod.useAbsoluteScale;
    if (typeof mod.absoluteScale === 'number') this.baseBorderBottomAbsoluteScale = mod.absoluteScale;
    if (typeof mod.timeScale === 'number') {
      this.baseBorderBottomTimeScale = Math.max(0.0001, mod.timeScale);
      try {
        const st = (this.baseOverlayBorderLower as any)?.animationState;
        if (st) st.timeScale = this.baseBorderBottomTimeScale;
      } catch {}
    }
    if (typeof mod.frameStep === 'number') {
      const step = Math.max(1, Math.floor(mod.frameStep));
      this.baseBorderBottomFrameStep = step;
      try {
        const st = (this.baseOverlayBorderLower as any)?.animationState;
        if (st) st.timeScale = (step > 1) ? 0 : this.baseBorderBottomTimeScale;
      } catch {}
    }
  }

  /** Compute the canonical center of a grid cell (col,row) in scene coordinates */
  private getCellCenter(col: number, row: number): { x: number; y: number } {
    const symbolTotalWidth = this.displayWidth + this.horizontalSpacing;
    const symbolTotalHeight = this.displayHeight + this.verticalSpacing;
    const startX = this.slotX - this.totalGridWidth * 0.5;
    const startY = this.slotY - this.totalGridHeight * 0.5;
    const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;
    return { x, y };
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

  /**
   * Re-center a Spine instance to the desired cell center on the next tick, after animations update bounds.
   * Useful when skeleton animation changes bounds from setup pose and initial centering is no longer accurate.
   */
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

  /** Win animation nudges (used for win/hit animations, sticky wilds, etc.) */
  public getWinSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Provide separate offsets for win/hit animations if their bounds differ
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
  }

  /** Optional per-symbol micro adjustments for the flash overlay only (in pixels) */
  private getOverlayNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Adjust these to fine-tune overlay alignment without affecting Spine placement
      1: { x: 0, y: 0 }, // Symbol1_HTBH overlay-only nudge (edit here)
    };
    return nudges[symbolValue];
  }

  // Manually step border animations when frameStep > 1
  private stepBorderAnimations(delta: number): void {
    const dtSec = Math.max(0, (delta || 0) / 1000);
    try {
      const upper: any = this.baseOverlayBorderUpper;
      const stepU = Math.max(1, Math.floor(this.baseBorderSkeletonFrameStep || 1));
      if (upper && upper.animationState && stepU > 1) {
        this.baseBorderSkeletonFrameCounter = (this.baseBorderSkeletonFrameCounter + 1) % stepU;
        if (this.baseBorderSkeletonFrameCounter === 0) {
          try { upper.update(dtSec * Math.max(0.0001, this.baseBorderSkeletonTimeScale)); } catch {}
        }
      }
    } catch {}
    try {
      const lower: any = this.baseOverlayBorderLower;
      const stepL = Math.max(1, Math.floor(this.baseBorderBottomFrameStep || 1));
      if (lower && lower.animationState && stepL > 1) {
        this.baseBorderBottomFrameCounter = (this.baseBorderBottomFrameCounter + 1) % stepL;
        if (this.baseBorderBottomFrameCounter === 0) {
          try { lower.update(dtSec * Math.max(0.0001, this.baseBorderBottomTimeScale)); } catch {}
        }
      }
    } catch {}
  }

  /** 
   * Create a persistent light grey background behind the symbol grid (50% opacity)
   * This is independent of the winning overlay (black) and remains visible.
   */
  /**
   * Create and manage the scatter anticipation overlay
   */
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

  public tweenReelBackgroundToDefaultTint(durationMs: number = 300): void {
    if (!this.reelBackground) return;
    try {
      try { this.reelBgFlashTween?.stop(); this.reelBgFlashTween = undefined; } catch {}
      const img = this.reelBackground as any;
      try { this.reelBgTintTween?.stop(); } catch {}
      this.scene.tweens.killTweensOf(img);
      const start = Phaser.Display.Color.IntegerToRGB(img.tintTopLeft ?? 0xffffff);
      const target = Phaser.Display.Color.IntegerToRGB(this.reelBgTintDefaultColor);
      const data: any = { r: start.r, g: start.g, b: start.b, a: img.alpha ?? this.reelBgTintDefaultAlpha };
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      if (effDuration <= 0) {
        try { img.setTint(Phaser.Display.Color.GetColor(target.r, target.g, target.b)); } catch {}
        try { img.setAlpha(this.reelBgTintDefaultAlpha); } catch {}
        return;
      }
      this.reelBgTintTween = this.scene.tweens.add({
        targets: data,
        r: target.r,
        g: target.g,
        b: target.b,
        a: this.reelBgTintDefaultAlpha,
        duration: effDuration,
        onUpdate: () => {
          try { img.setTint(Phaser.Display.Color.GetColor(Math.floor(data.r), Math.floor(data.g), Math.floor(data.b))); } catch {}
          try { img.setAlpha(data.a); } catch {}
        },
        onComplete: () => { try { this.reelBgTintTween = undefined; } catch {} }
      });
    } catch {}
  }

  public tweenReelBackgroundToSpinTint(durationMs: number = 300): void {
    if (!this.reelBackground) return;
    try {
      try { this.reelBgFlashTween?.stop(); this.reelBgFlashTween = undefined; } catch {}
      const img = this.reelBackground as any;
      try { this.reelBgTintTween?.stop(); } catch {}
      this.scene.tweens.killTweensOf(img);
      const start = Phaser.Display.Color.IntegerToRGB(img.tintTopLeft ?? 0xffffff);
      const target = Phaser.Display.Color.IntegerToRGB(this.reelBgTintSpinColor);
      const data: any = { r: start.r, g: start.g, b: start.b, a: img.alpha ?? this.reelBgTintSpinAlpha };
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      if (effDuration <= 0) {
        try { img.setTint(Phaser.Display.Color.GetColor(target.r, target.g, target.b)); } catch {}
        try { img.setAlpha(this.reelBgTintSpinAlpha); } catch {}
        return;
      }
      this.reelBgTintTween = this.scene.tweens.add({
        targets: data,
        r: target.r,
        g: target.g,
        b: target.b,
        a: this.reelBgTintSpinAlpha,
        duration: effDuration,
        onUpdate: () => {
          try { img.setTint(Phaser.Display.Color.GetColor(Math.floor(data.r), Math.floor(data.g), Math.floor(data.b))); } catch {}
          try { img.setAlpha(data.a); } catch {}
        },
        onComplete: () => { try { this.reelBgTintTween = undefined; } catch {} }
      });
    } catch {}
  }

  public tweenReelBackgroundToWinTint(durationMs: number = 300): void {
    if (!this.reelBackground) return;
    try {
      try { this.reelBgFlashTween?.stop(); this.reelBgFlashTween = undefined; } catch {}
      const img = this.reelBackground as any;
      try { this.reelBgTintTween?.stop(); } catch {}
      this.scene.tweens.killTweensOf(img);
      const start = Phaser.Display.Color.IntegerToRGB(img.tintTopLeft ?? 0xffffff);
      const target = Phaser.Display.Color.IntegerToRGB(this.reelBgTintWinColor);
      const data: any = { r: start.r, g: start.g, b: start.b, a: img.alpha ?? this.reelBgTintWinAlpha };
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      if (effDuration <= 0) {
        try { img.setTint(Phaser.Display.Color.GetColor(target.r, target.g, target.b)); } catch {}
        try { img.setAlpha(this.reelBgTintWinAlpha); } catch {}
        return;
      }
      this.reelBgTintTween = this.scene.tweens.add({
        targets: data,
        r: target.r,
        g: target.g,
        b: target.b,
        a: this.reelBgTintWinAlpha,
        duration: effDuration,
        onUpdate: () => {
          try { img.setTint(Phaser.Display.Color.GetColor(Math.floor(data.r), Math.floor(data.g), Math.floor(data.b))); } catch {}
          try { img.setAlpha(data.a); } catch {}
        },
        onComplete: () => { try { this.reelBgTintTween = undefined; } catch {} }
      });
    } catch {}
  }

  public tweenReelBackgroundToAnticipationTint(durationMs: number = 300): void {
    if (!this.reelBackground) return;
    try {
      try { this.reelBgFlashTween?.stop(); this.reelBgFlashTween = undefined; } catch {}
      const img = this.reelBackground as any;
      try { this.reelBgTintTween?.stop(); } catch {}
      this.scene.tweens.killTweensOf(img);
      const start = Phaser.Display.Color.IntegerToRGB(img.tintTopLeft ?? 0xffffff);
      const target = Phaser.Display.Color.IntegerToRGB(this.reelBgTintAnticipationColor);
      const data: any = { r: start.r, g: start.g, b: start.b, a: img.alpha ?? this.reelBgTintAnticipationAlpha };
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      if (effDuration <= 0) {
        try { img.setTint(Phaser.Display.Color.GetColor(target.r, target.g, target.b)); } catch {}
        try { img.setAlpha(this.reelBgTintAnticipationAlpha); } catch {}
        return;
      }
      this.reelBgTintTween = this.scene.tweens.add({
        targets: data,
        r: target.r,
        g: target.g,
        b: target.b,
        a: this.reelBgTintAnticipationAlpha,
        duration: effDuration,
        onUpdate: () => {
          try { img.setTint(Phaser.Display.Color.GetColor(Math.floor(data.r), Math.floor(data.g), Math.floor(data.b))); } catch {}
          try { img.setAlpha(data.a); } catch {}
        },
        onComplete: () => { try { this.reelBgTintTween = undefined; } catch {} }
      });
    } catch {}
  }

  public hideReelBackground(): void {
    try { this.stopReelBgAnticipationFlash(); } catch {}
    try { this.reelBackground?.setVisible(false); } catch {}
  }

  public showReelBackground(): void {
    try {
      const img: any = this.reelBackground;
      if (!img) return;
      img.setVisible(true);
      // Ensure it's not fully transparent before tint tween runs
      try {
        if (typeof img.alpha !== 'number' || img.alpha < this.reelBgTintDefaultAlpha) {
          img.setAlpha(this.reelBgTintDefaultAlpha);
        }
      } catch {}
    } catch {}
  }

  public fadeOutReelBackground(durationMs: number = 300): void {
    if (!this.reelBackground || !this.scene) return;
    try {
      try { this.stopReelBgAnticipationFlash(); } catch {}
      const img = this.reelBackground as any;
      this.scene.tweens.killTweensOf(img);
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: effDuration,
        ease: 'Cubic.easeOut',
        onStart: () => { try { img.setVisible(true); } catch {} },
        onComplete: () => { try { img.setVisible(false); } catch {} }
      });
    } catch {}
  }

  public fadeInReelBackground(durationMs: number = 300): void {
    if (!this.reelBackground || !this.scene) return;
    try {
      const img = this.reelBackground as any;
      this.scene.tweens.killTweensOf(img);
      // Ensure default tint before fading in
      try {
        const target = Phaser.Display.Color.IntegerToRGB(this.reelBgTintDefaultColor);
        img.setTint(Phaser.Display.Color.GetColor(target.r, target.g, target.b));
      } catch {}
      img.setAlpha(0);
      img.setVisible(true);
      const turboMul = gameStateManager.isTurbo ? TurboConfig.TURBO_DURATION_MULTIPLIER : 1.0;
      const effDuration = Math.max(0, Math.floor(durationMs * turboMul));
      this.scene.tweens.add({
        targets: img,
        alpha: this.reelBgTintDefaultAlpha,
        duration: effDuration,
        ease: 'Cubic.easeOut'
      });
    } catch {}
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
      this.baseOverlayBounds = new Phaser.Geom.Rectangle(
        gridBounds.x - padL,
        gridBounds.y - padT,
        gridBounds.width + padL + padR,
        gridBounds.height + padT + padB
      );
      // Create/update reel background image to sit just behind symbols
      try { this.reelBackground?.destroy?.(); } catch {}
      try {
        const baseX = gridBounds.x - padL;
        const baseY = gridBounds.y - padT;
        const baseW = gridBounds.width + padL + padR;
        const baseH = gridBounds.height + padT + padB;
        const img = this.scene.add.image(0, 0, 'reel-background');
        img.setOrigin(0, 0);
        // Apply width/height multipliers and uniform scale, keep centered to the base rectangle
        const effW = baseW * this.reelBgWidthMultiplier;
        const effH = baseH * this.reelBgHeightMultiplier;
        const finalW = effW * this.reelBgScale;
        const finalH = effH * this.reelBgScale;
        try { (img as any).setDisplaySize ? img.setDisplaySize(finalW, finalH) : img.setScale(finalW / img.width, finalH / img.height); } catch { img.setScale(finalW / (img.width || 1), finalH / (img.height || 1)); }
        // Center inside the base rectangle, then apply pixel offsets
        const drawX = baseX + (baseW - finalW) * 0.5 + this.reelBgOffsetX;
        const drawY = baseY + (baseH - finalH) * 0.5 + this.reelBgOffsetY;
        img.setPosition(drawX, drawY);
        // Depth between main background (-10) and symbols (0)
        img.setDepth(-3);
        img.setAlpha(this.reelBgAlpha);
        img.setVisible(true);
        this.reelBackground = img;
      } catch {}
      // Scene-level depth to sit between background (at -10) and symbols (0)
      this.baseOverlayRect.setDepth(-5);
      // Keep base overlay hidden by default; reel background handles visuals now
      this.baseOverlayRect.setVisible(false);
      console.log('[Symbols] Base light grey grid background created (hidden)');

      // Create/top border aligned to the top edge of the base overlay (with adjustable offsets)
      const baseTopY = gridBounds.y - padT;
      const baseBottomY = gridBounds.y + gridBounds.height + padB;
      const topY = baseTopY + BORDER_UPPER_OFFSET_Y; // positive moves downward
      const bottomY = baseBottomY + BORDER_LOWER_OFFSET_Y; // negative moves upward
      const totalWidth = gridBounds.width + padL + padR;

      // Destroy existing borders if recreating
      try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
      try { this.baseOverlayBorderLower?.destroy?.(); } catch {}

      // Create borders depending on bonus mode
      const isBonus = !!gameStateManager.isBonus;
      const centerX = this.scene.scale.width * 0.5;
      if (isBonus && ensureSpineFactory(this.scene as any, '[Symbols] bonus border spines')) {
        // Use spine borders in bonus stage
        try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
        try { this.baseOverlayBorderLower?.destroy?.(); } catch {}
        // Upper spine
        let upper: any = null;
        try { upper = (this.scene.add as any).spine(centerX, topY + this.bonusDragonTopOffsetY, 'Dragon_Top_Bonus', 'Dragon_Top_Bonus-atlas'); } catch {}
        if (upper) {
          try { upper.setOrigin(0.5, 1.0); } catch {}
          try { upper.setDepth(50); } catch {}
          // Play its single available animation (looping)
          try {
            const state = (upper as any).animationState;
            let played = false;
            try { state.setAnimation(0, 'animation', true); played = true; } catch {}
            if (!played) {
              try {
                const anims = (upper as any)?.skeleton?.data?.animations || [];
                const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
              } catch {}
            }
            // Apply Dragon_Top_Bonus speed modifier
            try {
              const ts = Math.max(0.0001, this.dragonTopBonusSpeedModifier);
              state.timeScale = ts;
            } catch {}
          } catch {}
          // Fit width using bounds
          try {
            const b = upper.getBounds?.();
            const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (upper.displayWidth || 0);
            if (width > 0) {
              const currentScaleX = upper.scaleX || 1;
              const scaledWidth = width * currentScaleX;
              const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
              upper.setScale(desiredScale * this.baseBorderSkeletonScale);
            }
          } catch {}
          // Apply position offsets
          try { upper.x += this.baseBorderSkeletonOffsetX; upper.y += this.baseBorderSkeletonOffsetY; } catch {}
          this.baseOverlayBorderUpper = upper;
          this.baseTopDragon = upper;
        } else {
          // No fallback used in bonus; skip upper border if spine is unavailable
          try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
          this.baseOverlayBorderUpper = undefined as any;
        }
        // Lower spine
        let lower: any = null;
        try { lower = (this.scene.add as any).spine(centerX, bottomY + this.bonusDragonBottomOffsetY, 'dragon_bonus', 'dragon_bonus-atlas'); } catch {}
        if (lower) {
          try { lower.setOrigin(0.5, 0.0); } catch {}
          try { lower.setDepth(2); } catch {}
          // Play its single available animation (looping)
          try {
            const state = (lower as any).animationState;
            let played = false;
            try { state.setAnimation(0, 'animation', true); played = true; } catch {}
            if (!played) {
              try {
                const anims = (lower as any)?.skeleton?.data?.animations || [];
                const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
              } catch {}
            }
            // Apply bottom dragon_bonus speed modifier
            try {
              const ts = Math.max(0.0001, this.dragonBottomBonusSpeedModifier);
              state.timeScale = ts;
            } catch {}
          } catch {}
          try {
            const b = lower.getBounds?.();
            const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (lower.displayWidth || 0);
            if (width > 0) {
              const currentScaleX = lower.scaleX || 1;
              const scaledWidth = width * currentScaleX;
              const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
              const finalScale = this.baseBorderBottomUseAbsoluteScale
                ? this.baseBorderBottomAbsoluteScale
                : (desiredScale * this.baseBorderBottomScale);
              // Mirror horizontally for bottom bonus dragon while using base bottom modifiers
              lower.setScale(-finalScale, finalScale);
            }
          } catch {}
          // Apply base bottom offsets
          try { lower.x += this.baseBorderBottomOffsetX; lower.y += this.baseBorderBottomOffsetY; } catch {}
          // Remember base Y before extra bonus offset, then apply extra bonus-only offset
          try { (lower as any).__bonusBottomBaseY = lower.y - this.bonusBottomExtraOffsetY; } catch {}
          try { lower.y += this.bonusBottomExtraOffsetY; } catch {}
          this.baseOverlayBorderLower = lower;
          this.bonusBottomDragon = lower;
        } else {
          // Fallback to PNG if spine not available
          this.baseOverlayBorderLower = this.scene.add.image(centerX, bottomY + this.borderBottomOffsetY, 'Border_Lower').setOrigin(0.5, 0.0);
          this.baseOverlayBorderLower.setDepth(2);
          const lowerScaleX = totalWidth / this.baseOverlayBorderLower.width;
          this.baseOverlayBorderLower.setScale(lowerScaleX);
          this.baseOverlayBorderLower.setVisible(true);
        }
      } else {
        // Base scene: try animated dragon_default spine, fallback to PNG
        // Ensure a dedicated container exists for the base border so it can be moved independently
        if (!this.baseBorderContainer) {
          try {
            this.baseBorderContainer = this.scene.add.container(0, 0);
            try { this.baseBorderContainer.setDepth(2); } catch {}
          } catch {}
        }
        let upper: any = null;
        if (ensureSpineFactory(this.scene as any, '[Symbols] base border spine dragon_tail')) {
          try { upper = (this.scene.add as any).spine(centerX, topY + this.borderTopOffsetY, 'dragon_default', 'dragon_default-atlas'); } catch {}
        }
        if (upper) {
          try { upper.setOrigin(0.5, 1.0); } catch {}
          try { upper.setDepth(2); } catch {}
          // Play available animation (looping), fallback to first
          try {
            const state = (upper as any).animationState;
            let played = false;
            try { state.setAnimation(0, 'animation', true); played = true; } catch {}
            if (!played) {
              try {
                const anims = (upper as any)?.skeleton?.data?.animations || [];
                const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
              } catch {}
            }
            // Apply configured timeScale / frame stepping
            try {
              const ts = Math.max(0.0001, this.baseBorderSkeletonTimeScale);
              const step = Math.max(1, Math.floor(this.baseBorderSkeletonFrameStep || 1));
              state.timeScale = (step > 1) ? 0 : ts;
            } catch {}
          } catch {}
          // Fit/scale and position modifiers
          try {
            const b = upper.getBounds?.();
            const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (upper.displayWidth || 0);
            if (width > 0) {
              const currentScaleX = upper.scaleX || 1;
              const scaledWidth = width * currentScaleX;
              const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
              const finalScale = this.baseBorderSkeletonUseAbsoluteScale
                ? this.baseBorderSkeletonAbsoluteScale
                : (desiredScale * this.baseBorderSkeletonScale);
              upper.setScale(finalScale);
            }
          } catch {}
          // Apply offsets and optional half-offscreen placement
          try { upper.x += this.baseBorderSkeletonOffsetX; upper.y += this.baseBorderSkeletonOffsetY; } catch {}
          try {
            if (this.baseBorderSkeletonHalfOffscreen) {
              upper.x = this.baseBorderSkeletonOffscreenSide === 'right' ? this.scene.scale.width : 0;
              upper.x += this.baseBorderSkeletonOffsetX;
            }
          } catch {}
          // Add to the dedicated container so future movement/animation is simple
          try { this.baseBorderContainer?.add(upper); } catch {}
          this.baseOverlayBorderUpper = upper;
          // Notify scene that the base top dragon is ready (movement/creation complete)
          try { this.scene.events.emit('baseTopDragonMoveComplete'); } catch {}
        } else {
          // Fallback PNG (mapped to skeleton.png in portrait/high)
          this.baseOverlayBorderUpper = this.scene.add.image(
            centerX,
            topY + this.borderTopOffsetY,
            'Border_Upper'
          ).setOrigin(0.5, 1.0);
          this.baseOverlayBorderUpper.setDepth(2);
          const upperScaleX = totalWidth / this.baseOverlayBorderUpper.width;
          this.baseOverlayBorderUpper.setScale(upperScaleX);
          this.baseOverlayBorderUpper.setVisible(true);
          // Add to container for consistency
          try { this.baseBorderContainer?.add(this.baseOverlayBorderUpper); } catch {}
          this.baseTopDragon = this.baseOverlayBorderUpper;
          // Notify scene even when using PNG fallback
          try { this.scene.events.emit('baseTopDragonMoveComplete'); } catch {}
        }

        // Try mirrored dragon_default at the bottom; fallback to PNG
        let lowerDragon: any = null;
        if (ensureSpineFactory(this.scene as any, '[Symbols] base border spine dragon_tail bottom')) {
          try { lowerDragon = (this.scene.add as any).spine(centerX, bottomY + this.borderBottomOffsetY, 'dragon_default', 'dragon_default-atlas'); } catch {}
        }
        if (lowerDragon) {
          try { lowerDragon.setOrigin(0.5, 0.0); } catch {}
          try { lowerDragon.setDepth(2); } catch {}
          // Play available animation (looping), fallback to first
          try {
            const state = (lowerDragon as any).animationState;
            let played = false;
            try { state.setAnimation(0, 'animation', true); played = true; } catch {}
            if (!played) {
              try {
                const anims = (lowerDragon as any)?.skeleton?.data?.animations || [];
                const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
              } catch {}
            }
            // Apply bottom timeScale / frame stepping
            try {
              const ts = Math.max(0.0001, this.baseBorderBottomTimeScale);
              const step = Math.max(1, Math.floor(this.baseBorderBottomFrameStep || 1));
              state.timeScale = (step > 1) ? 0 : ts;
            } catch {}
            // BOTTOM dragon: loop only from desired start to end (skip 0..start entirely)
            try {
              const entry = (state as any)?.tracks?.[0] || null;
              if (entry && this.dragonLoopStartSeconds > 0) {
                const dur = entry?.animation?.duration ?? 0;
                if (dur > 0) {
                  const epsilon = 1 / 60;
                  const start = Math.min(Math.max(0, this.dragonLoopStartSeconds), Math.max(0, dur - epsilon));
                  if (start > 0 && start < dur) {
                    try { entry.animationStart = start; } catch {}
                    try { entry.animationEnd = dur; } catch {}
                    try { entry.trackTime = 0; } catch {}
                  }
                }
              }
            } catch {}
          } catch {}
          // Fit/scale to width and mirror horizontally
          try {
            const b = lowerDragon.getBounds?.();
            const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (lowerDragon.displayWidth || 0);
            if (width > 0) {
              const currentScaleX = lowerDragon.scaleX || 1;
              const scaledWidth = width * currentScaleX;
              const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
              const finalScale = this.baseBorderBottomUseAbsoluteScale
                ? this.baseBorderBottomAbsoluteScale
                : (desiredScale * this.baseBorderBottomScale);
              lowerDragon.setScale(-finalScale, finalScale);
            }
          } catch {}
          // Apply bottom offsets
          try { lowerDragon.x += this.baseBorderBottomOffsetX; lowerDragon.y += this.baseBorderBottomOffsetY; } catch {}
          // Add to container for independent movement
          try { this.baseBorderContainer?.add(lowerDragon); } catch {}
          this.baseOverlayBorderLower = lowerDragon;
          this.baseBottomDragon = lowerDragon;
        } else {
          this.baseOverlayBorderLower = this.scene.add.image(
            centerX,
            bottomY + this.borderBottomOffsetY,
            'Border_Lower'
          ).setOrigin(0.5, 0.0);
          this.baseOverlayBorderLower.setDepth(2);
          const lowerScaleX = totalWidth / this.baseOverlayBorderLower.width;
          this.baseOverlayBorderLower.setScale(lowerScaleX);
          this.baseOverlayBorderLower.setVisible(true);
          try { this.baseBorderContainer?.add(this.baseOverlayBorderLower); } catch {}
          this.baseBottomDragon = this.baseOverlayBorderLower;
        }
      }
    } catch (e) {
      console.warn('[Symbols] Failed to create base grid background:', e);
    }
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
    
    // Flash handling is centralized via beginSpinPhase; listener set in setupSpinEventListener
    
    // Create a persistent light grey, semi-transparent background behind the symbol grid
    this.createBaseOverlayRect();

    // Install border stepper for frame-skipping if needed
    if (!this.__borderUpdateHandler) {
      this.__borderUpdateHandler = (_time: number, delta: number) => this.stepBorderAnimations(delta);
      try { this.scene.events.on('update', this.__borderUpdateHandler, this); } catch {}
      this.scene.events.once('shutdown', () => {
        try { this.scene.events.off('update', this.__borderUpdateHandler!, this); } catch {}
        this.__borderUpdateHandler = undefined;
      });
    }

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
    try { this.hideWinningOverlay(); } catch {}
    try { this.resetSymbolDepths(); } catch {}
    try { this.restoreSymbolVisibility(); } catch {}
    try { this.restoreSymbolsAboveReelBg(); } catch {}
    // Ensure reel background starts at default tint on initial create
    // try { this.tweenReelBackgroundToDefaultTint(0); } catch {}

    // External trigger to flash all symbols with white overlay at spin-click time
    this.scene.events.on('flashAllSymbolsNow', () => {
      try {
        // Ensure PNGs so overlay aligns perfectly
        this.ensureCleanSymbolState();
        // Avoid briefly revealing symbols during scatter/overlay transitions
        if (!gameStateManager.isScatter) {
          this.restoreSymbolVisibility();
        }
        this.flashAllSymbolsOverlay();
      } catch {}
    });
  }

  /** Synchronized: wrap up win visuals and restore layering */
  private endWinPhase(): void {
    try { this.clearWinLines(); } catch {}
    try { this.hideWinningOverlay(); } catch {}
    try { this.resetSymbolDepths(); } catch {}
    try { this.restoreSymbolsAboveReelBg(); } catch {}
    try { this.tweenReelBackgroundToDefaultTint(300); } catch {}
  }

  /** Synchronized: start win visuals and layering */
  private beginWinPhase(): void {
    try { (this.scene as any).__isScatterAnticipationActive = false; } catch {}
    try { this.restoreLiftedScatterSymbols(); } catch {}
    try { this.restoreSymbolsAboveReelBg(); } catch {}
    try { if (this.overlayRect) this.scene.tweens.killTweensOf(this.overlayRect); } catch {}
    try { this.overlayRect?.setVisible(false); this.overlayRect?.setAlpha(0); } catch {}
    try { if (this.baseOverlayRect) this.scene.tweens.killTweensOf(this.baseOverlayRect); } catch {}
    try { this.baseOverlayRect?.setAlpha(0); } catch {}
    try { this.tweenReelBackgroundToDefaultTint(0); } catch {}
    try { const sa = (this.scene as any)?.scatterAnticipation; sa?.hide?.(); } catch {}
    try { this.showWinningOverlay(); } catch {}
    // Move winning symbols to front using current spin data if available
    try {
      const data = this.currentSpinData;
      if (data) { this.moveWinningSymbolsToFront(data); }
    } catch {}
    // Push non-winning behind reel background in base mode
    try { this.setNonWinningSymbolsBehindReelBg(true); } catch {}
  }

  /** Synchronized: wrap up spin when reels stop and there are no wins */
  private endSpinPhase(): void {
    try {
      const noWins = !this.hasCurrentWins();
      if (noWins) {
        // No wins: ensure clean default state
        this.clearWinLines();
        this.hideWinningOverlay();
        try { this.resetSymbolDepths(); } catch {}
        try { this.restoreSymbolsAboveReelBg(); } catch {}
        try { this.tweenReelBackgroundToDefaultTint(300); } catch {}
      }
    } catch {}
  }

  private beginSpinPhase(): void {
    try { this.clearWinLines(); } catch {}
    try { this.hideWinningOverlay(); } catch {}
    try { this.resetSymbolDepths(); } catch {}
    try { this.restoreSymbolsAboveReelBg(); } catch {}
    try { this.restoreSymbolVisibility(); } catch {}
    try { this.restoreLiftedScatterSymbols(); } catch {}
    try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
    try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
    try {
      if (gameStateManager.isBonus) {
        try { this.showReelBackground(); } catch {}
        this.tweenReelBackgroundToSpinTint(300);
      } else {
        this.tweenReelBackgroundToDefaultTint(300);
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
      this.beginSpinPhase();
    });
    
    // Listen for winline completion to resume autoplay and end win phase
    gameEventManager.on(GameEventType.WIN_STOP, () => {
      console.log('[Symbols] WIN_STOP event received - resuming autoplay');
      console.log('[Symbols] freeSpinAutoplayWaitingForWinlines:', this.freeSpinAutoplayWaitingForWinlines);
      console.log('[Symbols] freeSpinAutoplayActive:', this.freeSpinAutoplayActive);
      
      // Handle free spin autoplay waiting for winlines
      this.handleFreeSpinAutoplayWinStop();
      if (gameStateManager.isAutoPlaying) {
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

    // Ensure spin tint is applied at every bonus REELS_START from within Symbols (avoids ordering issues)
    gameEventManager.on(GameEventType.REELS_START, () => {
      try {
        if (gameStateManager.isBonus) {
          console.log('[Symbols] REELS_START in bonus - enforcing spin tint');
          this.showReelBackground();
          this.restoreSymbolsAboveReelBg();
          this.tweenReelBackgroundToSpinTint(0);
        }
      } catch {}
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
                
                // Create PNG sprite in its place using stored PNG home if available
                const home = (symbol as any).__pngHome as { x: number; y: number } | undefined;
                const px = (home && typeof home.x === 'number') ? home.x : x;
                const py = (home && typeof home.y === 'number') ? home.y : y;
                const pngSprite = this.scene.add.sprite(px, py, spriteKey);
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
      
      // Reset any symbol tints/effects that might be active
      this.resetSymbolsState();
    });

    // Listen for scatter bonus activation to capture free spins data
    this.scene.events.on('scatterBonusActivated', (data: { scatterIndex: number; actualFreeSpins: number }) => {
      console.log(`[Symbols] Scatter bonus activated with ${data.actualFreeSpins} free spins - storing data for autoplay`);
      this.pendingFreeSpinsData = data;
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.restoreSymbolsAboveReelBg(); } catch {}
      try { this.restoreSymbolVisibility(); } catch {}
      try { this.convertScatterSpinesToPNGs(true); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    gameEventManager.on(GameEventType.IS_BONUS, () => {
      try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
      try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
      try { this.restoreSymbolsAboveReelBg(); } catch {}
      try { this.restoreSymbolVisibility(); } catch {}
      try { this.convertScatterSpinesToPNGs(true); } catch {}
      try { this.ensureScatterSymbolsVisible(); } catch {}
    });

    const __turboLayerFix = () => {
      try {
        const active = !!(this.scene as any)?.__isScatterAnticipationActive;
        if (!active) return;
        try { this.pushAllSymbolsBehindReelBg(); } catch {}
        try { this.liftScatterSymbolsAboveReelBg(); } catch {}
        try { this.liftReelSymbolsAboveReelBg((SLOT_ROWS - 1)); } catch {}
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
          // Clear sticky multiplier visual overlays when leaving bonus
          try {
            this.stickyMultiplierOverlays.forEach(entry => {
              try { entry.sprite.destroy(); } catch {}
            });
          } catch {}
          this.stickyMultiplierOverlays = [];
          try { this.restoreLiftedScatterSymbols(); } catch {}
          try { this.resetSymbolDepths(); } catch {}
          try { this.restoreSymbolsAboveReelBg(); } catch {}
          try { this.restoreSymbolVisibility(); } catch {}
          try { this.tweenReelBackgroundToDefaultTint(0); } catch {}
        } else {
          try { this.container?.setVisible(true); this.container?.setAlpha(1); } catch {}
          try { this.scatterForegroundContainer?.setVisible(true); this.scatterForegroundContainer?.setAlpha(1); } catch {}
          try { this.restoreSymbolsAboveReelBg(); } catch {}
          try { this.restoreSymbolVisibility(); } catch {}
          try { this.convertScatterSpinesToPNGs(true); } catch {}
          try { this.ensureScatterSymbolsVisible(); } catch {}
        }
        // Recreate borders if base overlay exists
        if (this.baseOverlayRect && this.baseOverlayBounds) {
          // Use stored bounds from creation time
          const gridBounds = this.baseOverlayBounds;
          const expandX = 0;
          const expandY = 0;
          const baseTopY = gridBounds.y - expandY;
          const baseBottomY = gridBounds.y - expandY + (gridBounds.height + expandY * 2);
          const topY = baseTopY + BORDER_UPPER_OFFSET_Y;
          const bottomY = baseBottomY + BORDER_LOWER_OFFSET_Y;
          const totalWidth = gridBounds.width + expandX * 2;

          // Destroy old borders
          try { this.baseOverlayBorderUpper?.destroy?.(); } catch {}
          try { this.baseOverlayBorderLower?.destroy?.(); } catch {}

          const centerX = this.scene.scale.width * 0.5;
          if (isBonus && ensureSpineFactory(this.scene as any, '[Symbols] bonus border spines (toggle)')) {
            // Create spine borders
            let upper: any = null;
            try { upper = (this.scene.add as any).spine(centerX, topY + this.bonusDragonTopOffsetY, 'dragon_bonus', 'dragon_bonus-atlas'); } catch {}
            if (upper) {
              try { upper.setOrigin(0.5, 1.0); upper.setDepth(2); } catch {}
              // Play its single available animation (looping)
              try {
                const state = (upper as any).animationState;
                let played = false;
                try { state.setAnimation(0, 'animation', true); played = true; } catch {}
                if (!played) {
                  try {
                    const anims = (upper as any)?.skeleton?.data?.animations || [];
                    const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
                  } catch {}
                }
                // Apply bonus dragon speed modifier (toggle section)
                try {
                  const ts = Math.max(0.0001, this.dragonTopBonusSpeedModifier);
                  state.timeScale = ts;
                } catch {}
              } catch {}
              try {
                const b = upper.getBounds?.();
                const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (upper.displayWidth || 0);
                if (width > 0) {
                  const currentScaleX = upper.scaleX || 1;
                  const scaledWidth = width * currentScaleX;
                  const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
                  const finalScale = this.baseBorderSkeletonUseAbsoluteScale
                    ? this.baseBorderSkeletonAbsoluteScale
                    : (desiredScale * this.baseBorderSkeletonScale);
                  upper.setScale(finalScale);
                }
              } catch {}
              // Apply offsets and optional half-offscreen placement
              try { upper.x += this.baseBorderSkeletonOffsetX; upper.y += this.baseBorderSkeletonOffsetY; } catch {}
              try {
                if (this.baseBorderSkeletonHalfOffscreen) {
                  upper.x = this.baseBorderSkeletonOffscreenSide === 'right' ? this.scene.scale.width : 0;
                  upper.x += this.baseBorderSkeletonOffsetX;
                }
              } catch {}
              this.baseOverlayBorderUpper = upper;
              this.bonusTopDragon = upper;
            }

            let lower: any = null;
            try { lower = (this.scene.add as any).spine(centerX, bottomY + this.bonusDragonBottomOffsetY, 'dragon_bonus', 'dragon_bonus-atlas'); } catch {}
            if (lower) {
              try { lower.setOrigin(0.5, 0.0); lower.setDepth(2); } catch {}
              // Play its single available animation (looping)
              try {
                const state = (lower as any).animationState;
                let played = false;
                try { state.setAnimation(0, 'animation', true); played = true; } catch {}
                if (!played) {
                  try {
                    const anims = (lower as any)?.skeleton?.data?.animations || [];
                    const first = anims[0]?.name; if (first) state.setAnimation(0, first, true);
                  } catch {}
                }
                // Apply bottom bonus dragon speed modifier (toggle section)
                try {
                  const ts = Math.max(0.0001, this.dragonBottomBonusSpeedModifier);
                  state.timeScale = ts;
                } catch {}
              } catch {}
              try {
                const b = lower.getBounds?.();
                const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (lower.displayWidth || 0);
                if (width > 0) {
                  const currentScaleX = lower.scaleX || 1;
                  const scaledWidth = width * currentScaleX;
                  const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
                  const finalScale = this.baseBorderBottomUseAbsoluteScale
                    ? this.baseBorderBottomAbsoluteScale
                    : (desiredScale * this.baseBorderBottomScale);
                  // Mirror horizontally for bottom bonus dragon and apply base-bottom modifiers
                  lower.setScale(-finalScale, finalScale);
                }
              } catch {}
              // Apply base bottom offsets
              try { lower.x += this.baseBorderBottomOffsetX; lower.y += this.baseBorderBottomOffsetY; } catch {}
              // Remember base Y before extra bonus offset, then apply extra bonus-only offset
              try { (lower as any).__bonusBottomBaseY = lower.y; } catch {}
              try { lower.y += this.bonusBottomExtraOffsetY; } catch {}
              this.baseOverlayBorderLower = lower;
              this.bonusBottomDragon = lower;
            }
          } else {
            // Base scene after toggle: try animated dragon_default spine, fallback to PNG
            if (!this.baseBorderContainer) {
              try {
                this.baseBorderContainer = this.scene.add.container(0, 0);
                try { this.baseBorderContainer.setDepth(2); } catch {}
              } catch {}
            }
            let upper: any = null;
            if (ensureSpineFactory(this.scene as any, '[Symbols] base border spine dragon_tail (toggle)')) {
              try { upper = (this.scene.add as any).spine(centerX, topY, 'dragon_default', 'dragon_default-atlas'); } catch {}
            }
            if (upper) {
              try { upper.setOrigin(0.5, 1.0); upper.setDepth(2); } catch {}
              // Play animation loop or first available
              try {
                const state = (upper as any).animationState;
                let played = false;
                try { state.setAnimation(0, 'animation', true); played = true; } catch {}
                if (!played) {
                  try { const anims = (upper as any)?.skeleton?.data?.animations || []; const first = anims[0]?.name; if (first) state.setAnimation(0, first, true); } catch {}
                }
                // Apply configured timeScale / frame stepping
                try {
                  const ts = Math.max(0.0001, this.baseBorderSkeletonTimeScale);
                  const step = Math.max(1, Math.floor(this.baseBorderSkeletonFrameStep || 1));
                  state.timeScale = (step > 1) ? 0 : ts;
                } catch {}
              } catch {}
              try {
                const b = upper.getBounds?.();
                const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (upper.displayWidth || 0);
                if (width > 0) {
                  const currentScaleX = upper.scaleX || 1;
                  const scaledWidth = width * currentScaleX;
                  const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
                  const finalScale = this.baseBorderSkeletonUseAbsoluteScale
                    ? this.baseBorderSkeletonAbsoluteScale
                    : (desiredScale * this.baseBorderSkeletonScale);
                  upper.setScale(finalScale);
                }
              } catch {}
              // Apply offsets and optional half-offscreen placement
              try { upper.x += this.baseBorderSkeletonOffsetX; upper.y += this.baseBorderSkeletonOffsetY; } catch {}
              try {
                if (this.baseBorderSkeletonHalfOffscreen) {
                  upper.x = this.baseBorderSkeletonOffscreenSide === 'right' ? this.scene.scale.width : 0;
                  upper.x += this.baseBorderSkeletonOffsetX;
                }
              } catch {}
              try { this.baseBorderContainer?.add(upper); } catch {}
              this.baseOverlayBorderUpper = upper;
              this.baseTopDragon = upper;
            } else {
              this.baseOverlayBorderUpper = this.scene.add.image(centerX, topY, 'Border_Upper').setOrigin(0.5, 1.0);
              this.baseOverlayBorderUpper.setDepth(2);
              const upperScaleX = totalWidth / this.baseOverlayBorderUpper.width;
              this.baseOverlayBorderUpper.setScale(upperScaleX);
              this.baseOverlayBorderUpper.setVisible(true);
              try { this.baseBorderContainer?.add(this.baseOverlayBorderUpper); } catch {}
              this.baseTopDragon = this.baseOverlayBorderUpper;
            }

            // Bottom: try mirrored dragon_default; fallback to PNG
            let lowerDragon: any = null;
            if (ensureSpineFactory(this.scene as any, '[Symbols] base border spine dragon_tail bottom (toggle)')) {
              try { lowerDragon = (this.scene.add as any).spine(centerX, bottomY, 'dragon_default', 'dragon_default-atlas'); } catch {}
            }
            if (lowerDragon) {
              try { lowerDragon.setOrigin(0.5, 0.0); lowerDragon.setDepth(2); } catch {}
              try {
                const state = (lowerDragon as any).animationState;
                let played = false;
                try { state.setAnimation(0, 'animation', true); played = true; } catch {}
                if (!played) {
                  try { const anims = (lowerDragon as any)?.skeleton?.data?.animations || []; const first = anims[0]?.name; if (first) state.setAnimation(0, first, true); } catch {}
                }
                try {
                  const ts = Math.max(0.0001, this.baseBorderBottomTimeScale);
                  const step = Math.max(1, Math.floor(this.baseBorderBottomFrameStep || 1));
                  state.timeScale = (step > 1) ? 0 : ts;
                } catch {}
                // BOTTOM dragon: loop only from desired start to end (skip 0..start entirely)
                try {
                  const entry = (state as any)?.tracks?.[0] || null;
                  if (entry && this.dragonLoopStartSeconds > 0) {
                    const dur = entry?.animation?.duration ?? 0;
                    if (dur > 0) {
                      const epsilon = 1 / 60;
                      const start = Math.min(Math.max(0, this.dragonLoopStartSeconds), Math.max(0, dur - epsilon));
                      if (start > 0 && start < dur) {
                        try { entry.animationStart = start; } catch {}
                        try { entry.animationEnd = dur; } catch {}
                        try { entry.trackTime = 0; } catch {}
                      }
                    }
                  }
                } catch {}
              } catch {}
              try {
                const b = lowerDragon.getBounds?.();
                const width = b && (b.size?.x || b.width) ? (b.size?.x || b.width) : (lowerDragon.displayWidth || 0);
                if (width > 0) {
                  const currentScaleX = lowerDragon.scaleX || 1;
                  const scaledWidth = width * currentScaleX;
                  const desiredScale = scaledWidth > 0 ? (totalWidth / scaledWidth) * currentScaleX : currentScaleX;
                  const finalScale = this.baseBorderBottomUseAbsoluteScale ? this.baseBorderBottomAbsoluteScale : (desiredScale * this.baseBorderBottomScale);
                  lowerDragon.setScale(-finalScale, finalScale);
                }
              } catch {}
              try { lowerDragon.x += this.baseBorderBottomOffsetX; lowerDragon.y += this.baseBorderBottomOffsetY; } catch {}
              // Remember base Y before extra bonus offset, then apply extra bonus-only offset
              try { (lowerDragon as any).__bonusBottomBaseY = lowerDragon.y; } catch {}
              try { lowerDragon.y += this.bonusBottomExtraOffsetY; } catch {}
              try { this.baseBorderContainer?.add(lowerDragon); } catch {}
              this.baseOverlayBorderLower = lowerDragon;
              this.baseBottomDragon = lowerDragon;
            } else {
              this.baseOverlayBorderLower = this.scene.add.image(centerX, bottomY, 'Border_Lower').setOrigin(0.5, 0.0);
              this.baseOverlayBorderLower.setDepth(2);
              const lowerScaleX = totalWidth / this.baseOverlayBorderLower.width;
              this.baseOverlayBorderLower.setScale(lowerScaleX);
              this.baseOverlayBorderLower.setVisible(true);
              try { this.baseBorderContainer?.add(this.baseOverlayBorderLower); } catch {}
              this.baseBottomDragon = this.baseOverlayBorderLower;
            }
          }
        }
      } catch {}
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
      
      // Ensure symbols are above reel background and default tint restored in base
      try { this.resetSymbolDepths(); } catch {}
      try { this.restoreSymbolsAboveReelBg(); } catch {}
      try { this.tweenReelBackgroundToDefaultTint(0); } catch {}
      
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

  public getIdleSpineSymbolScale(symbolValue: number): number {
    const v = this.idleSpineSymbolScales[symbolValue];
    if (typeof v === 'number') return v;
    return this.getSpineSymbolScale(symbolValue);
  }

  public getIdleScaleMultiplier(symbolValue: number): number {
    const v = this.idleScaleMultipliers[symbolValue];
    return (typeof v === 'number' && v > 0) ? v : 1;
  }

  public getSpineScaleMultiplier(symbolValue: number): number {
    const v = this.spineScaleMultipliers[symbolValue];
    return (typeof v === 'number' && v > 0) ? v : 1;
  }

  // Auto-fit a Spine instance to the target cell size, with a safe fallback scale
  public getFittedSpineScale(spine: any, targetWidth: number, targetHeight: number, fallbackScale: number): number {
    try {
      const bounds = spine?.getBounds?.();
      const bw = (bounds?.size?.width ?? bounds?.size?.x ?? 0);
      const bh = (bounds?.size?.height ?? bounds?.size?.y ?? 0);
      if (bw > 0 && bh > 0) {
        const sx = targetWidth / bw;
        const sy = targetHeight / bh;
        // Slight padding to avoid touching borders
        return Math.min(sx, sy) * 0.95;
      }
    } catch {}
    return fallbackScale;
  }

  // Resolve the best animation name for a given symbol value based on cached Spine JSON
  private resolveSymbolAnimName(spineKey: string, symbolValue: number): string {
    const base = `Symbol${symbolValue}_HTBH`;
    const prefer = `${base}_win`;
    const fallback = `${base}_hit`;
    try {
      const cachedJson: any = (this.scene.cache.json as any).get(spineKey);
      const anims = cachedJson?.animations ? Object.keys(cachedJson.animations) : [];
      if (anims.includes(prefer)) return prefer;
      if (anims.includes(fallback)) return fallback;
      if (anims.length > 0) return anims[0];
    } catch {}
    return prefer; // default attempt
  }

  /**
   * Trigger _idle animations for NEW symbols in a specific reel after it drops
   * This works with the symbols that are currently being dropped (newSymbols)
   */
  public triggerIdleAnimationsForNewReel(reelIndex: number): void {
    console.log(`[Symbols] Triggering _idle animations for NEW reel ${reelIndex}`);
    
    if (!this.newSymbols || !this.newSymbols[0] || reelIndex >= this.newSymbols[0].length) {
      console.warn(`[Symbols] Invalid new reel index ${reelIndex} or new symbols not ready`);
      return;
    }

    // Get winning positions from scene data
    let currentWinningPositions: Set<string> | undefined;
    try {
      const sceneData = (this.scene as any)?.currentWinningPositions;
      if (sceneData) {
        currentWinningPositions = sceneData;
      }
    } catch {}

    // Process each column for this specific reel
    for (let col = 0; col < this.newSymbols.length; col++) {
      const symbol = this.newSymbols[col][reelIndex];
      if (!symbol) continue;

      // Skip if already a Spine animation
      if ((symbol as any).animationState) continue;

      // Skip if this position is part of a winning combination
      if (currentWinningPositions && currentWinningPositions.has(`${col}_${reelIndex}`)) {
        console.log(`[Symbols] Skipping winning symbol at (${reelIndex}, ${col}) from idle animation`);
        continue;
      }

      try {
        // Get symbol value from current data
        const symbolValue = (this.scene as any)?.currentSymbolData?.[col]?.[reelIndex];
        if (typeof symbolValue !== 'number') continue;

        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';
        const symbolName = `Symbol${symbolValue}_HTBH`;
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

        // Store position and display size from PNG
        const x = symbol.x;
        const y = symbol.y;
        const displayWidth = symbol.displayWidth;
        const displayHeight = symbol.displayHeight;

        // Destroy PNG and create Spine in-place
        symbol.destroy();
        const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
        spineSymbol.setOrigin(0.5, 0.5);
        const baseScale = this.getIdleSpineSymbolScale(symbolValue);
        try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
        try { (spineSymbol as any).__pngSize = { w: displayWidth, h: displayHeight }; } catch {}
        try { (spineSymbol as any).__pngNudge = this.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 }; } catch {}
        try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
        this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, baseScale, this.getIdleSymbolNudge(symbolValue));
        try { const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue); if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m); } catch {}
        // Dev toggle: force reel symbol placement to match the debug probe exactly
        try {
          const forceMatch = (window as any).DEV_MATCH_PROBE === true;
          if (forceMatch && symbolValue === 1) {
            const probe = (this as any).__debugProbe?.spine;
            if (probe) {
              spineSymbol.x = probe.x;
              spineSymbol.y = probe.y;
              try { spineSymbol.setScale(probe.scaleX, probe.scaleY); } catch {}
            }
          }
        } catch {}
        this.container.add(spineSymbol);
        this.newSymbols[col][reelIndex] = spineSymbol;
        
        // Play idle animation (loop)
        spineSymbol.animationState.setAnimation(0, idleAnim, true);
        // Re-center on next tick to compensate for bounds changes after animation starts
        this.reCenterSpineNextTick(spineSymbol, x, y, this.getIdleSymbolNudge(symbolValue));
        console.log(`[Symbols] Set NEW symbol at (${reelIndex}, ${col}) to idle animation: ${idleAnim}`);
      } catch (e) {
        console.warn(`[Symbols] Failed to set idle Spine on NEW symbol at (${reelIndex}, ${col}):`, e);
      }
    }
    // After all 3 symbols in this reel are set to idle, flash an overlay masked to them
    this.flashReelOverlayForSymbols(reelIndex);
  }

  /**
   * Briefly blink the symbol itself using additive blend and alpha pulses,
   * then restore original blend mode and alpha.
   */
  private blinkSymbolGlow(target: any): void {
    try {
      const originalBlend = (target as any).blendMode;
      const originalAlpha = typeof target.alpha === 'number' ? target.alpha : 1;
      if (typeof target.setBlendMode === 'function') {
        target.setBlendMode(Phaser.BlendModes.ADD);
      }
      this.scene.tweens.add({
        targets: target,
        alpha: { from: 1, to: 0.55 },
        duration: 120,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          try {
            if (typeof target.setBlendMode === 'function') {
              target.setBlendMode(typeof originalBlend === 'number' ? originalBlend : Phaser.BlendModes.NORMAL);
            }
          } catch {}
          try {
            if (typeof target.setAlpha === 'function') {
              target.setAlpha(originalAlpha);
            }
          } catch {}
        }
      });
    } catch {}
  }

  /**
   * Simpler and safe: duplicate the symbol as an additive Spine overlay and pulse alpha.
   * No global masks or pipelines involved, so no black-screen side effects.
   */
  private flashDuplicateSpine(baseSpine: any, spineKey: string, atlasKey: string, animName: string): void {
    try {
      if (!baseSpine || !spineKey || !atlasKey) {
        this.blinkSymbolGlow(baseSpine);
        return;
      }
      const flash = this.scene.add.spine(baseSpine.x, baseSpine.y, spineKey, atlasKey);
      flash.setOrigin(0.5, 0.5);
      try { flash.skeleton.setToSetupPose(); flash.update(0); } catch {}
      try { flash.setScale(baseSpine.scaleX, baseSpine.scaleY); } catch {}
      try { flash.animationState.setAnimation(0, animName, true); } catch {}
      if (this.container) this.container.add(flash);
      try { (flash as any).setDepth(((baseSpine as any).depth ?? 0) + 1); } catch {}
      if (typeof (flash as any).setBlendMode === 'function') {
        (flash as any).setBlendMode(Phaser.BlendModes.ADD);
      }
      (flash as any).setAlpha?.(0.95);

      this.scene.tweens.add({
        targets: flash,
        alpha: 0.25,
        duration: 120,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          try { flash.destroy(); } catch {}
        }
      });
    } catch {
      this.blinkSymbolGlow(baseSpine);
    }
  }

  /**
   * Full-grid white overlay masked by the 3 landed symbols' bounds for this reel.
   * Avoids Spine masking/pipelines; uses a GeometryMask with simple rects at symbol bounds.
   */
  private flashReelOverlayForSymbols(reelIndex: number): void {
    try {
      if (!this.newSymbols || !this.newSymbols.length) return;

      // Exclude winners
      let winning: Set<string> | undefined;
      try { winning = (this.scene as any)?.currentWinningPositions; } catch {}

      for (let col = 0; col < this.newSymbols.length; col++) {
        const obj = this.newSymbols[col]?.[reelIndex];
        if (!obj) continue;
        if (winning && winning.has(`${col}_${reelIndex}`)) continue;

        // Determine symbol value to find its PNG texture
        let symbolValue: number | undefined;
        try { symbolValue = (this.scene as any)?.currentSymbolData?.[col]?.[reelIndex]; } catch {}
        if (typeof symbolValue !== 'number') continue;
        const pngKey = `symbol_${symbolValue}`;
        if (!this.scene.textures.exists(pngKey)) continue;

        // Prefer aligning to the original PNG anchor and size, plus the same nudge used for Spine
        const home = (obj as any).__pngHome as { x: number; y: number } | undefined;
        const size = (obj as any).__pngSize as { w: number; h: number } | undefined;
        const nudge = (obj as any).__pngNudge as { x: number; y: number } | undefined;
        // Add overlay-only correction without touching Spine placement
        const overlayOnly = this.getOverlayNudge(symbolValue) || { x: 0, y: 0 };
        const centerX = (home?.x ?? obj.x) + (nudge?.x ?? 0) + overlayOnly.x;
        const centerY = (home?.y ?? obj.y) + (nudge?.y ?? 0) + overlayOnly.y;
        const w = Math.max(2, size?.w ?? obj.displayWidth ?? 0);
        const h = Math.max(2, size?.h ?? obj.displayHeight ?? 0);

        // Simple overlay: reuse the symbol's PNG as the shape; tint white and pulse
        const overlayImg = this.scene.add.image(centerX, centerY, pngKey);
        overlayImg.setOrigin(0.5, 0.5);
        overlayImg.setDisplaySize(w, h);
        // Add to the same container as symbols to inherit positioning/scale and avoid UI offset
        try { this.container?.add(overlayImg); } catch {}
        // Keep local depth low within the symbols layer so it never overlaps HUD/controllers
        try { overlayImg.setDepth(1); } catch {}
        if (typeof (overlayImg as any).setBlendMode === 'function') {
          (overlayImg as any).setBlendMode(Phaser.BlendModes.ADD);
        }
        // Ensure it's bright white regardless of source
        if (typeof (overlayImg as any).setTintFill === 'function') {
          (overlayImg as any).setTintFill(0xffffff);
        } else if (typeof (overlayImg as any).setTint === 'function') {
          (overlayImg as any).setTint(0xffffff);
        }
        overlayImg.setAlpha(0.95);

        this.scene.tweens.add({
          targets: overlayImg,
          alpha: 0,
          duration: 140,
          ease: 'Sine.easeOut',
          onComplete: () => {
            try { overlayImg.destroy(); } catch {}
          }
        });
      }
    } catch {}
  }

  /**
   * Create a short white blinking glow overlay at a cell. The glow uses additive blending
   * and self-destroys after a few pulses to avoid leaking display objects.
   */
  private addBlinkGlowAt(centerX: number, centerY: number, targetWidth: number, targetHeight: number): void {
    try {
      const glow = this.scene.add.graphics();
      glow.setDepth(550); // above base symbols, below win lines
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setAlpha(0);

      // Slightly larger than cell to look like a glow
      const w = targetWidth * 1.15;
      const h = targetHeight * 1.15;
      glow.fillStyle(0xFFFFFF, 1);
      glow.fillRoundedRect(centerX - w * 0.5, centerY - h * 0.5, w, h, Math.min(w, h) * 0.08);

      // Attach to the same container for correct relative depth
      if (this.container) {
        this.container.add(glow);
      }

      // Blink a few times then destroy
      this.scene.tweens.add({
        targets: glow,
        alpha: 0.85,
        duration: 120,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          try { glow.destroy(); } catch {}
        }
      });
    } catch {}
  }

  /**
   * Trigger _idle animations for symbols in a specific reel after it drops
   * Excludes winning symbols from getting idle animations
   */
  public triggerIdleAnimationsForReel(reelIndex: number, winningPositions?: Set<string>): void {
    console.log(`[Symbols] Triggering _idle animations for reel ${reelIndex}`);
    
    if (!this.symbols || !this.symbols[0] || reelIndex >= this.symbols[0].length) {
      console.warn(`[Symbols] Invalid reel index ${reelIndex} or symbols not ready`);
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
    for (let col = 0; col < this.symbols.length; col++) {
      const symbol = this.symbols[col][reelIndex];
      if (!symbol) continue;

      // Skip if already a Spine animation
      if ((symbol as any).animationState) continue;

      // Skip if this position is part of a winning combination
      if (currentWinningPositions && currentWinningPositions.has(`${col}_${reelIndex}`)) {
        console.log(`[Symbols] Skipping winning symbol at (${reelIndex}, ${col}) from idle animation`);
        continue;
      }

      try {
        // Get symbol value from current data
        const symbolValue = (this.scene as any)?.currentSymbolData?.[col]?.[reelIndex];
        if (typeof symbolValue !== 'number') continue;

        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';
        const symbolName = `Symbol${symbolValue}_HTBH`;
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

        // Store position and display size from PNG
        const x = symbol.x;
        const y = symbol.y;
        const displayWidth = symbol.displayWidth;
        const displayHeight = symbol.displayHeight;

        // Destroy PNG and create Spine in-place
        symbol.destroy();
        const spineSymbol = this.scene.add.spine(x, y, spineKey, spineAtlasKey);
        spineSymbol.setOrigin(0.5, 0.5);
        const baseScale = this.getIdleSpineSymbolScale(symbolValue);
        try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
        try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
        this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, baseScale, this.getIdleSymbolNudge(symbolValue));
        try { const m = this.getSpineScaleMultiplier(symbolValue) * this.getIdleScaleMultiplier(symbolValue); if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m); } catch {}
        // Dev toggle: force reel symbol placement to match the debug probe exactly
        try {
          const forceMatch = (window as any).DEV_MATCH_PROBE === true;
          if (forceMatch && symbolValue === 1) {
            const probe = (this as any).__debugProbe?.spine;
            if (probe) {
              spineSymbol.x = probe.x;
              spineSymbol.y = probe.y;
              try { spineSymbol.setScale(probe.scaleX, probe.scaleY); } catch {}
            }
          }
        } catch {}
        this.container.add(spineSymbol);
        this.symbols[col][reelIndex] = spineSymbol;
        
        // Play idle animation (loop)
        spineSymbol.animationState.setAnimation(0, idleAnim, true);
        // Re-center on next tick to compensate for bounds changes after animation starts
        this.reCenterSpineNextTick(spineSymbol, x, y, this.getIdleSymbolNudge(symbolValue));
        console.log(`[Symbols] Set symbol at (${reelIndex}, ${col}) to idle animation: ${idleAnim}`);
      } catch (e) {
        console.warn(`[Symbols] Failed to set idle Spine on symbol at (${reelIndex}, ${col}):`, e);
      }
    }
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
    // Restore base overlay visibility and opacity
    try {
      if (this.baseOverlayRect) {
        this.scene.tweens.killTweensOf(this.baseOverlayRect);
        this.baseOverlayRect.setVisible(true);
        this.baseOverlayRect.setAlpha(1);
      }
    } catch {}
    
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
    try {
      if (!gameStateManager.isBonus) {
        this.stickyMultiplierPositions = [];
        return;
      }
      if (!this.symbols || this.symbols.length === 0) {
        return;
      }
      for (const pos of this.stickyMultiplierPositions) {
        const { col, row, symbol } = pos;
        if (col < 0 || row < 0 || col >= this.symbols.length || row >= this.symbols[col].length) {
          continue;
        }
        const sprite = this.symbols[col][row];
        if (sprite && typeof sprite.setVisible === 'function') {
          try { sprite.setVisible(true); } catch {}
        }
        // Ensure the underlying symbol data is consistent with sticky multiplier
        try {
          if (this.currentSymbolData && this.currentSymbolData[col]) {
            this.currentSymbolData[col][row] = symbol;
          }
        } catch {}
      }
    } catch {}
  }

  /**
   * Create or update overlay sprites for sticky multipliers so they persist visually across bonus spins
   */
  private updateStickyMultiplierOverlays(): void {
    try {
      if (!gameStateManager.isBonus) {
        try {
          this.stickyMultiplierOverlays.forEach(entry => {
            try { entry.sprite.destroy(); } catch {}
          });
        } catch {}
        this.stickyMultiplierOverlays = [];
        return;
      }

      if (!this.symbols || this.symbols.length === 0) {
        return;
      }

      const active: Array<{ col: number; row: number; sprite: Phaser.GameObjects.Sprite }> = [];
      for (const pos of this.stickyMultiplierPositions) {
        const { col, row, symbol } = pos;
        if (col < 0 || row < 0 || col >= this.symbols.length || row >= this.symbols[col].length) {
          continue;
        }

        // If the actual symbol exists in the grid, do NOT create an overlay.
        // This keeps the visual as the real symbol “stuck” in the cell.
        const baseSprite = this.symbols[col]?.[row];
        if (baseSprite) {
          // Ensure visibility of the base symbol
          try { baseSprite.setVisible(true); } catch {}
          // If there is an existing overlay for this cell, it will be destroyed in the cleanup loop below
          continue;
        }

        let overlay = this.stickyMultiplierOverlays.find(e => e.col === col && e.row === row);
        if (!overlay) {
          const center = (this as any).getCellCenter(col, row);
          const spriteKey = 'symbol_' + symbol;
          if (!this.scene.textures.exists(spriteKey)) {
            continue;
          }
          const sprite = this.scene.add.sprite(center.x, center.y, spriteKey);
          // Slightly smaller and semi-transparent to read as a highlight overlay
          sprite.displayWidth = this.displayWidth * 0.9;
          sprite.displayHeight = this.displayHeight * 0.9;
          try { sprite.setAlpha(0.7); } catch {}
          try { sprite.setTint(0xffff99); } catch {}
          try { this.container.add(sprite); } catch {}
          try { sprite.setDepth(3); } catch {}
          overlay = { col, row, sprite };
        } else {
          try { overlay.sprite.setVisible(true); } catch {}
        }
        active.push(overlay);
      }

      // Destroy overlays that no longer correspond to sticky positions
      for (const entry of this.stickyMultiplierOverlays) {
        const stillActive = active.find(a => a.col === entry.col && a.row === entry.row);
        if (!stillActive) {
          try { entry.sprite.destroy(); } catch {}
        }
      }

      this.stickyMultiplierOverlays = active;
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
   * Create semi-transparent rectangle overlay above symbols
   */
  private createOverlayRect(): void {
    if (this.overlayRect) {
      this.overlayRect.destroy();
    }
    
    // Create overlay graphics
    this.overlayRect = this.scene.add.graphics();
    
    // Set semi-transparent black fill
    this.overlayRect.fillStyle(0x000000, 1.0);
    
    // Fill rectangle covering the symbol grid area
    const gridBounds = this.getSymbolGridBounds();
    // Apply padding similar to the base grey background
    const overlayExpandX = 20; // horizontal padding (px)
    const overlayExpandY = 10; // vertical padding (px)
    this.overlayRect.fillRect(
      gridBounds.x - overlayExpandX, 
      gridBounds.y - overlayExpandY, 
      gridBounds.width + overlayExpandX * 15, 
      gridBounds.height + overlayExpandY * 2
    );
    
    // Set depth to be above symbols (0) but just behind borders (2)
    this.overlayRect.setDepth(-1);
    
    // Hide by default
    this.overlayRect.setVisible(false);
    
    console.log('[Symbols] Semi-transparent overlay rectangle created (hidden by default)');
  }

  // Lower the symbols container so non-winning symbols (remaining in container) render behind the reel background
  private setNonWinningSymbolsBehindReelBg(enable: boolean): void {
    try {
      if (!this.container) return;
      // Reel bg depth is -3; set container to -4 to place it behind
      this.container.setDepth(enable ? -4 : 0);
    } catch {}
  }

  // Public helper to restore symbol container above reel background immediately
  public restoreSymbolsAboveReelBg(): void {
    this.setNonWinningSymbolsBehindReelBg(false);
    try {
      if (this.container && (this.scene as any)?.children?.bringToTop) {
        (this.scene as any).children.bringToTop(this.container);
      }
    } catch {}
  }

  public pushAllSymbolsBehindReelBg(): void {
    this.setNonWinningSymbolsBehindReelBg(true);
  }

  private ensureScatterForegroundContainer(): void {
    if (!this.scatterForegroundContainer) {
      try {
        this.scatterForegroundContainer = this.scene.add.container(0, 0);
        this.scatterForegroundContainer.setDepth(0);
      } catch {}
    }
    try { if (this.gridMask) { this.scatterForegroundContainer?.setMask(this.gridMask); } } catch {}
    try { (this.scene as any)?.children?.bringToTop?.(this.scatterForegroundContainer); } catch {}
  }

  public liftScatterSymbolsAboveReelBg(): void {
    try {
      this.ensureScatterForegroundContainer();
      this.liftedScatterSymbols = [];

      const data = this.currentSymbolData;
      const grid = (this.newSymbols && this.newSymbols.length > 0) ? this.newSymbols : this.symbols;
      if (!grid || !data) return;

      for (let col = 0; col < grid.length; col++) {
        const column = grid[col];
        for (let row = 0; row < (column ? column.length : 0); row++) {
          try {
            const val = data?.[col]?.[row];
            if (val === 0) { // Symbol0_HTBH (scatter)
              const obj = column[row];
              if (!obj) continue;
              const parent = (obj as any).parentContainer as Phaser.GameObjects.Container | undefined;
              if (parent === this.scatterForegroundContainer) continue;
              try { this.container?.remove(obj); } catch {}
              try { this.scatterForegroundContainer?.add(obj); } catch {}
              this.liftedScatterSymbols.push({ obj, col, row });
            }
          } catch {}
        }
      }
      try { (this.scene as any)?.children?.bringToTop?.(this.scatterForegroundContainer); } catch {}
    } catch {}
  }

  public restoreLiftedScatterSymbols(): void {
    try {
      for (const entry of this.liftedScatterSymbols) {
        const obj = entry.obj;
        if (!obj || !obj.active) continue;
        try { this.scatterForegroundContainer?.remove(obj); } catch {}
        try { this.container?.add(obj); } catch {}
      }
    } catch {}
    this.liftedScatterSymbols = [];
  }

  /**
   * Flash all PNG symbols with a white overlay pulse (same style as reel overlay)
   */
  private flashAllSymbolsOverlay(): void {
    try {
      if (!this.symbols || !this.symbols.length || !this.symbols[0] || !this.symbols[0].length) return;
      let overlaysCreated = 0;
      let pending = 0;

      // Flash per reel (group of 3 symbols vertically), retaining the same visual output
      const reelsCount = this.symbols[0].length; // horizontal count
      for (let reelIndex = 0; reelIndex < reelsCount; reelIndex++) {
        for (let col = 0; col < this.symbols.length; col++) {
          const obj = this.symbols[col][reelIndex];
          if (!obj) continue;
          // If it's a Spine symbol, flash with a white rectangle overlay sized to the cell
          if ((obj as any).animationState) {
            const center = (this as any).getCellCenter(col, reelIndex);
            const w = Math.max(2, this.displayWidth);
            const h = Math.max(2, this.displayHeight);
            const g = this.scene.add.graphics();
            g.fillStyle(0xffffff, Math.max(0, Math.min(1, this.flashOverlayAlphaStart)));
            // Draw a rectangle centered on the cell
            g.fillRect(center.x - w * 0.5, center.y - h * 0.5, w, h);
            try { g.setDepth(1005); } catch {}
            overlaysCreated++;
            const effectiveSpeed = Math.max(0.05, this.flashOverlaySpeedMultiplier);
            const dur = Math.max(20, Math.floor(this.flashOverlayDurationMs / effectiveSpeed));
            pending++;
            this.scene.tweens.add({
              targets: g,
              alpha: Math.max(0, Math.min(1, this.flashOverlayFadeTo)),
              duration: dur,
              ease: 'Sine.easeOut',
              onComplete: () => {
                try { g.destroy(); } catch {}
                try {
                  pending--;
                  if (pending === 0 && overlaysCreated > 0) {
                    this.clearWinLines();
                  }
                } catch {}
              }
            });
            continue;
          }

          // Determine symbol value to find its PNG texture
          let symbolValue: number | undefined;
          try {
            const key: string | undefined = (obj as any)?.texture?.key;
            if (key && key.startsWith('symbol_')) {
              const parts = key.split('_');
              const parsed = parseInt(parts[1], 10);
              if (!Number.isNaN(parsed)) symbolValue = parsed;
            }
          } catch {}
          const pngKey = symbolValue !== undefined ? `symbol_${symbolValue}` : ((obj as any)?.texture?.key || '');
          if (!pngKey || !this.scene.textures.exists(pngKey)) continue;

          // Prefer aligning to the original PNG anchor and size, plus the same nudge used for Spine
          const home = (obj as any).__pngHome as { x: number; y: number } | undefined;
          const size = (obj as any).__pngSize as { w: number; h: number } | undefined;
          const nudge = (obj as any).__pngNudge as { x: number; y: number } | undefined;
          const overlayOnly = (symbolValue !== undefined ? this.getOverlayNudge(symbolValue) : undefined) || { x: 0, y: 0 };
          const centerX = (home?.x ?? obj.x) + (nudge?.x ?? 0) + overlayOnly.x;
          const centerY = (home?.y ?? obj.y) + (nudge?.y ?? 0) + overlayOnly.y;
          const w = Math.max(2, size?.w ?? obj.displayWidth ?? 0);
          const h = Math.max(2, size?.h ?? obj.displayHeight ?? 0);

          const overlayImg = this.scene.add.image(centerX, centerY, pngKey);
          overlayImg.setOrigin(0.5, 0.5);
          overlayImg.setDisplaySize(w, h);
          // Draw on scene root (not in symbols container) so it can render above the dark overlay
          try { overlayImg.setDepth(1005); } catch {}
          if (typeof (overlayImg as any).setBlendMode === 'function') {
            (overlayImg as any).setBlendMode(Phaser.BlendModes.ADD);
          }
          // Ensure it's bright white regardless of source
          if (typeof (overlayImg as any).setTintFill === 'function') {
            (overlayImg as any).setTintFill(0xffffff);
          } else if (typeof (overlayImg as any).setTint === 'function') {
            (overlayImg as any).setTint(0xffffff);
          }
          overlayImg.setAlpha(Math.max(0, Math.min(1, this.flashOverlayAlphaStart)));
          overlayImg.setVisible(true);
          overlaysCreated++;

          const effectiveSpeed = Math.max(0.05, this.flashOverlaySpeedMultiplier);
          const dur = Math.max(20, Math.floor(this.flashOverlayDurationMs / effectiveSpeed));
          pending++;
          this.scene.tweens.add({
            targets: overlayImg,
            alpha: Math.max(0, Math.min(1, this.flashOverlayFadeTo)),
            duration: dur,
            ease: 'Sine.easeOut',
            onComplete: () => {
              try { overlayImg.destroy(); } catch {}
              try {
                pending--;
                if (pending === 0 && overlaysCreated > 0) {
                  this.clearWinLines();
                }
              } catch {}
            }
          });
        }
      }
      console.log(`[Symbols] flashAllSymbolsOverlay created overlays (per reel): ${overlaysCreated}`);
    } catch {}
  }

  /**
   * Show overlay for winning patterns with fade in animation
   */
  public showWinningOverlay(): void {
    // If legacy overlay is disabled, only drive reel background tint
    if (!this.useLegacyWinningOverlay) {
      try { this.tweenReelBackgroundToWinTint(300); } catch {}
      console.log('[Symbols] showWinningOverlay (legacy overlay disabled) - applying win tint only');
      return;
    }
    if (!this.overlayRect) {
      this.createOverlayRect();
    }
    if (this.overlayRect) {
      // Hide the base overlay while the winning overlay is visible
      if (this.baseOverlayRect) {
        this.baseOverlayRect.setVisible(false);
      }
      // Stop any existing tweens on the overlay
      this.scene.tweens.killTweensOf(this.overlayRect);
      
      // If already visible, ensure full opacity and avoid re-tweening to prevent flicker
      if (this.overlayRect.visible && this.overlayRect.alpha >= 0.15) {
        this.overlayRect.setAlpha(0.15);
        console.log('[Symbols] Winning overlay already visible - ensuring alpha 1');
        return;
      }
      
      // Set initial state for fade in
      this.overlayRect.setVisible(true);
      this.overlayRect.setAlpha(0);

      // Also tint reel background to win state (if available)
      try { this.tweenReelBackgroundToWinTint(300); } catch {}
      
      // Animate fade in
      this.scene.tweens.add({
        targets: this.overlayRect,
        alpha: 0.15,
        duration: 300,
        ease: 'Power2.easeOut',
        onComplete: () => {
          console.log('[Symbols] Winning overlay shown');
        }
      });
    }
    console.log('[Symbols] Winning overlay fade in started');
  }

  /**
   * Hide the overlay with fade out animation
   */
  public hideWinningOverlay(): void {
    // If legacy overlay is disabled, only restore reel background tint
    if (!this.useLegacyWinningOverlay) {
      try {
        if (gameStateManager.isBonus && gameStateManager.isReelSpinning) {
          // During an active bonus spin, keep spin tint instead of reverting to default
          this.tweenReelBackgroundToSpinTint(0);
        } else {
          this.tweenReelBackgroundToDefaultTint(300);
        }
      } catch {}
      console.log('[Symbols] hideWinningOverlay (legacy overlay disabled) - restoring default tint only');
      return;
    }
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
          // Restore the base overlay visibility once the winning overlay is hidden
          if (this.baseOverlayRect) {
            this.baseOverlayRect.setVisible(true);
          }
          console.log('[Symbols] Winning overlay fade out completed');
        }
      });
      // Restore reel background to its default tint when win overlay hides
      try {
        if (gameStateManager.isBonus && gameStateManager.isReelSpinning) {
          this.tweenReelBackgroundToSpinTint(0);
        } else {
          this.tweenReelBackgroundToDefaultTint(300);
        }
      } catch {}
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
          symbol.setDepth(990); // Above all gameplay layers, just below dialogs (1000)
        }
        console.log(`[Symbols] Symbol at (${grid.x}, ${grid.y}) moved to scene with depth:`, symbol.depth);
        movedCount++;
      } else {
        console.warn(`[Symbols] Symbol at (${grid.x}, ${grid.y}) not found or invalid`);
      }
    }

    console.log(`[Symbols] Successfully moved ${movedCount} out of ${uniqueGrids.length} winning symbols to front`);

    // Push remaining non-winning symbols behind the reel background in base scene
    // Apply this even during autoplay when NOT in bonus mode, per base-scene requirement
    try {
      const inBonus = gameStateManager.isBonus;
      if (!inBonus) {
        this.setNonWinningSymbolsBehindReelBg(true);
      }
    } catch {}
  }

  /**
   * Reset all symbol depths to default and move them back to container
   */
  public resetSymbolDepths(): void {
    if (!this.symbols || this.symbols.length === 0) {
      // Even if there are no symbols, ensure container depth is restored
      this.setNonWinningSymbolsBehindReelBg(false);
      return;
    }

    let resetCount = 0;
    let scatterSymbolsReset = 0;
    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];
        if (symbol) {
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
              const regularSprite = this.scene.add.sprite(x, y, 'symbol_0');
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
            try {
              // Adding to the container will handle removing it from any previous display list
              // Avoid direct calls to scene.children.remove to prevent errors on destroyed/unlisted objects
              this.container.add(symbol);
            } catch (e) {
              console.warn(`[Symbols] Failed to re-add symbol at (${col}, ${row}) to container:`, e);
            }
          }
          if (typeof symbol.setDepth === 'function') {
            symbol.setDepth(0); // Reset to default depth
            }
          }
          resetCount++;
        }
      }
    }
    console.log(`[Symbols] Reset depths and container for ${resetCount} symbols (${scatterSymbolsReset} scatter symbols converted to normal sprites)`);
  }

  /**
   * Move scatter symbols to front (above overlay) - similar to winning symbols
   */
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
            const symbolName = `Symbol${symbolValue}_HTBH`;
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
                const configuredScale = this.getSpineSymbolScale(symbolValue);
                // Remember the original PNG home position so PNG can restore it later
                try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
                // Set canonical measurement pose before centering
                try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
                this.centerAndFitSpine(spineSymbol, x, y, displayWidth, displayHeight, configuredScale, this.getWinSymbolNudge(symbolValue));
                try { const m = this.getSpineScaleMultiplier(symbolValue); if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m); } catch {}
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

  /**
   * Stop all Spine animations on current symbol objects without destroying them.
   * Safe to call even if symbols contain plain Sprites.
   */
  public stopAllSpineAnimations(): void {
    try {
      if (!this.symbols) return;
      for (let c = 0; c < this.symbols.length; c++) {
        const col = this.symbols[c];
        if (!Array.isArray(col)) continue;
        for (let r = 0; r < col.length; r++) {
          const obj: any = col[r];
          if (!obj) continue;
          try { this.scene?.tweens?.killTweensOf?.(obj); } catch {}
          try {
            const st = obj.animationState;
            if (st) {
              try { st.clearTracks?.(); } catch {}
              try { st.setEmptyAnimation?.(0, 0); } catch {}
              try { st.timeScale = 0; } catch {}
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Symbols] stopAllSpineAnimations encountered an error', e);
    }
  }

  /**
   * Stop all symbol-related animations (both Spine and Sprite tweens/anims).
   * Does not convert Spine back to PNG; it only halts motion for safety.
   */
  public stopAllSymbolAnimations(): void {
    try {
      if (!this.symbols) return;
      for (let c = 0; c < this.symbols.length; c++) {
        const col = this.symbols[c];
        if (!Array.isArray(col)) continue;
        for (let r = 0; r < col.length; r++) {
          const obj: any = col[r];
          if (!obj) continue;
          try { this.scene?.tweens?.killTweensOf?.(obj); } catch {}
          try { obj.anims?.stop?.(); } catch {}
          try {
            const st = obj.animationState;
            if (st) {
              try { st.clearTracks?.(); } catch {}
              try { st.setEmptyAnimation?.(0, 0); } catch {}
              try { st.timeScale = 0; } catch {}
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Symbols] stopAllSymbolAnimations encountered an error', e);
    }
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

  public convertScatterSpinesToPNGs(makeVisible: boolean = true): void {
    try {
      const data = this.currentSymbolData;
      const grid = this.symbols;
      if (!grid || !data) return;
      for (let col = 0; col < grid.length; col++) {
        const column = grid[col];
        for (let row = 0; row < (column ? column.length : 0); row++) {
          try {
            const val = data?.[col]?.[row];
            if (val !== 0) continue;
            const obj: any = column[row];
            if (!obj) continue;
            const isSpine = !!obj.animationState;
            if (!isSpine) {
              try { if (makeVisible && typeof obj.setVisible === 'function') obj.setVisible(true); } catch {}
              continue;
            }
            try { this.scene?.tweens?.killTweensOf?.(obj); } catch {}
            try { this.scatterAnimationManager?.unregisterScatterSymbol?.(obj); } catch {}
            const x = obj.x;
            const y = obj.y;
            const home = (obj as any).__pngHome as { x: number; y: number } | undefined;
            const px = (home && typeof home.x === 'number') ? home.x : x;
            const py = (home && typeof home.y === 'number') ? home.y : y;
            try { this.scene?.children?.remove?.(obj); } catch {}
            try { obj.destroy?.(); } catch {}
            const spriteKey = 'symbol_0';
            if (this.scene.textures.exists(spriteKey)) {
              const pngSprite = this.scene.add.sprite(px, py, spriteKey);
              pngSprite.setOrigin(0.5, 0.5);
              pngSprite.displayWidth = this.displayWidth;
              pngSprite.displayHeight = this.displayHeight;
              try { this.container?.add(pngSprite); } catch {}
              column[row] = pngSprite;
              try { if (makeVisible) pngSprite.setVisible(true); } catch {}
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
              
              // Resolve home position: prefer stored PNG home from Spine if available
              const home = (symbol as any).__pngHome as { x: number; y: number } | undefined;
              const px = (home && typeof home.x === 'number') ? home.x : x;
              const py = (home && typeof home.y === 'number') ? home.y : y;
              // Create PNG sprite in its place using the stored home position
              const pngSprite = this.scene.add.sprite(px, py, spriteKey);
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
          // sticky wilds removed: no special-case hiding
        }
      } catch {}

      rows.push(symbol);
    }
    self.symbols.push(rows);
  }
  console.log('[Symbols] Initial symbols created successfully');

  
  const ENABLE_SYMBOL1_PROBE = false;
  if (ENABLE_SYMBOL1_PROBE) {
    try {
      const PROBE_SYMBOL_VALUE = 1; // Symbol index
      const PROBE_COL = 1;          // Column index (0..SLOT_COLUMNS-1)
      const PROBE_ROW = 2;          // Row index (0..SLOT_ROWS-1)
      const probe = new DebugSymbolProbe(self, PROBE_SYMBOL_VALUE, PROBE_COL, PROBE_ROW);
      (self as any).__debugProbe = probe; // attach for optional later cleanup
      console.log('[Symbols] DebugSymbolProbe active at col,row =', PROBE_COL, PROBE_ROW);
    } catch {}
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
  
  // Handle sticky multiplier behaviour in bonus mode: merge existing sticky positions and update list
  try {
    if (!gameStateManager.isBonus) {
      self["stickyMultiplierPositions"] = [];
      self["prevStickyMultiplierPositions"] = [];
    } else {
      const stickyList: Array<{ col: number; row: number; symbol: number }> = (self as any)["stickyMultiplierPositions"] || [];
      // Snapshot previous sticky positions for this spin's reuse/skip logic
      (self as any)["prevStickyMultiplierPositions"] = Array.isArray(stickyList) ? stickyList.map(p => ({ ...p })) : [];
      if (Array.isArray(stickyList) && stickyList.length > 0) {
        for (const pos of stickyList) {
          const { col, row, symbol } = pos;
          if (
            col >= 0 &&
            row >= 0 &&
            col < symbols.length &&
            row < symbols[col].length
          ) {
            symbols[col][row] = symbol;
          }
        }
      }
      const updatedSticky: Array<{ col: number; row: number; symbol: number }> = [];
      for (let c = 0; c < symbols.length; c++) {
        for (let r = 0; r < symbols[c].length; r++) {
          const v = symbols[c][r];
          if (v === 12 || v === 13 || v === 14) {
            updatedSticky.push({ col: c, row: r, symbol: v });
          }
        }
      }
      (self as any)["stickyMultiplierPositions"] = updatedSticky;
    }
  } catch {}

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
  // Safety: ensure symbol container is above reel background at start of this spin (base & bonus)
  self.restoreSymbolsAboveReelBg();
  // Re-apply spin tint after cleanup so it persists during this spin's drop/reel animation
  try { self.showReelBackground(); } catch {}
  try { self.tweenReelBackgroundToSpinTint(300); } catch {}
    
    self.resetSymbolDepths();
    self.restoreSymbolVisibility();
  
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
  
  // Set spinning state
  gameStateManager.isReelSpinning = true;
  // Immediately enforce spin tint after reels are marked spinning (bonus)
  try {
    if (gameStateManager.isBonus) {
      self.showReelBackground();
      self.restoreSymbolsAboveReelBg();
      self.tweenReelBackgroundToSpinTint(0);
    }
  } catch {}
  
  // Use the existing createNewSymbols function
  createNewSymbols(self, mockData);
  
  // Use the existing dropReels function
  await dropReels(self, mockData);
  
  // Update symbols after animation
  try {
    if (gameStateManager.isBonus) {
      const stickyPrev: Array<{ col: number; row: number; symbol: number }> = (self as any)["prevStickyMultiplierPositions"] || [];
      for (const pos of stickyPrev) {
        try {
          if (self.symbols && self.symbols[pos.col] && self.symbols[pos.col][pos.row]) {
            self.symbols[pos.col][pos.row] = null as any;
          }
        } catch {}
      }
    }
  } catch {}
  disposeSymbols(self.symbols);
  self.symbols = self.newSymbols;
  self.newSymbols = [];

  // Update sticky multiplier overlays for bonus mode so visuals persist across spins
  try { (self as any).updateStickyMultiplierOverlays?.(); } catch {}
  
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
    
    // Stop normal autoplay immediately when scatter is detected
    if (gameStateManager.isAutoPlaying) {
      console.log('[Symbols] Scatter detected during autoplay - stopping normal autoplay immediately');
      // Access SlotController to stop autoplay
      const slotController = (self.scene as any).slotController;
      if (slotController && typeof slotController.stopAutoplay === 'function') {
        slotController.stopAutoplay();
        console.log('[Symbols] Normal autoplay stopped due to scatter detection');
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

      let symbol: any;
      try {
        const stickyPrev: Array<{ col: number; row: number; symbol: number }> = (self as any)["prevStickyMultiplierPositions"] || [];
        const isSticky = gameStateManager.isBonus && stickyPrev.some(p => p.col === col && p.row === row);
        if (isSticky && self.symbols && self.symbols[col] && self.symbols[col][row]) {
          symbol = self.symbols[col][row];
          try {
            const center = (self as any).getCellCenter(col, row);
            symbol.x = center.x;
            symbol.y = center.y;
            symbol.displayWidth = self.displayWidth;
            symbol.displayHeight = self.displayHeight;
          } catch {}
          try {
            const parent: any = (symbol as any).parentContainer;
            if (parent !== self.container) {
              try { parent?.remove?.(symbol); } catch {}
              try { self.container.add(symbol); } catch {}
            }
          } catch {}
        } else {
          symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
          symbol.displayWidth = self.displayWidth;
          symbol.displayHeight = self.displayHeight;
          self.container.add(symbol);
        }
      } catch {
        symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
        symbol.displayWidth = self.displayWidth;
        symbol.displayHeight = self.displayHeight;
        self.container.add(symbol);
      }

      rows.push(symbol);
    }

    self.newSymbols.push(rows);
  }
}

async function dropReels(self: Symbols, data: Data): Promise<void> {
  // Remove init check since we're not using it anymore
  console.log('[Symbols] dropReels called with data:', data);
  console.log('[Symbols] SLOT_ROWS:', SLOT_ROWS);
  // Safety: ensure symbols are above reel background during reel drop animations
  try { self.restoreSymbolsAboveReelBg(); } catch {}
  // Bonus: enforce spin tint right before drop sequence starts
  try {
    if (gameStateManager.isBonus) {
      self.showReelBackground();
      self.tweenReelBackgroundToSpinTint(0);
    }
  } catch {}

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
    try {
      const stickyPrev: Array<{ col: number; row: number; symbol: number }> = (self as any)["prevStickyMultiplierPositions"] || [];
      const isSticky = gameStateManager.isBonus && stickyPrev.some(p => p.col === i && p.row === index);
      if (isSticky) {
        continue;
      }
    } catch {}

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
          ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1)) ? Phaser.Math.Easing.Cubic.Out : Phaser.Math.Easing.Bounce.Out,
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
    try {
      const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
      if (isAnticipation && index === (SLOT_ROWS - 1)) {
        try { (self as any).ensureScatterForegroundContainer?.(); } catch {}
        const fg: Phaser.GameObjects.Container | undefined = (self as any).scatterForegroundContainer;
        if (fg && typeof fg.add === 'function') {
          fg.add(symbol);
        } else {
          self.container.add(symbol);
        }
      } else {
        self.container.add(symbol);
      }
    } catch { self.container.add(symbol); }

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
          ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1)) ? Phaser.Math.Easing.Cubic.Out : Phaser.Math.Easing.Linear,
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

    try {
      const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
      if (isAnticipation && index === (SLOT_ROWS - 1)) {
        self.liftReelSymbolsAboveReelBg(index);
      }
    } catch {}

    for (let col = 0; col < self.newSymbols.length; col++) {
      let symbol = self.newSymbols[col][index];

      try {
        const stickyPrev: Array<{ col: number; row: number; symbol: number }> = (self as any)["prevStickyMultiplierPositions"] || [];
        const isSticky = gameStateManager.isBonus && stickyPrev.some(p => p.col === col && p.row === index);
        if (isSticky) {
          try {
            const center = (self as any).getCellCenter(col, index);
            if (symbol) {
              symbol.x = center.x;
              symbol.y = center.y;
            }
          } catch {}
          completedAnimations++;
          if (completedAnimations === totalAnimations) {
            self.triggerIdleAnimationsForNewReel(index);
            try {
              const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
              if (isAnticipation && index === 2) {
                if (self.overlayRect) {
                  if (self.baseOverlayRect) {
                    self.scene.tweens.add({
                      targets: self.baseOverlayRect,
                      alpha: 0,
                      duration: 300,
                      ease: 'Cubic.easeOut'
                    });
                  }
                  self.overlayRect.setAlpha(0);
                  self.overlayRect.setVisible(true);
                  self.scene.tweens.add({
                    targets: self.overlayRect,
                    alpha: 0.85,
                    duration: 500,
                    ease: 'Cubic.easeOut'
                  });
                }
                try { self.tweenReelBackgroundToAnticipationTint(300); } catch {}
                const sa = (self.scene as any)?.scatterAnticipation;
                if (sa && typeof sa.show === 'function') { sa.show(); }
                const sa2 = (self.scene as any)?.scatterAnticipation2;
                if (sa2 && typeof sa2.show === 'function') { sa2.show(); }
                console.log('[Symbols] Scatter anticipation shown after 3rd reel drop');
              }
            } catch {}
            try {
              const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
              if (isAnticipation && index === (SLOT_ROWS - 1)) {
                const sa = (self.scene as any)?.scatterAnticipation;
                if (sa && typeof sa.hide === 'function') { sa.hide(); }
                const sa2 = (self.scene as any)?.scatterAnticipation2;
                if (sa2 && typeof sa2.hide === 'function') { sa2.hide(); }
                if (self.overlayRect) {
                  self.scene.tweens.add({
                    targets: self.overlayRect,
                    alpha: 0,
                    duration: 300,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                      if (self.overlayRect) { self.overlayRect.setVisible(false); }
                    }
                  });
                  if (self.baseOverlayRect) {
                    self.baseOverlayRect.setAlpha(0);
                    self.baseOverlayRect.setVisible(true);
                    self.scene.tweens.add({
                      targets: self.baseOverlayRect,
                      alpha: 0.2,
                      duration: 300,
                      ease: 'Cubic.easeOut'
                    });
                  }
                }
                try { self.flashReelOverlay(index); } catch {}
                console.log('[Symbols] Scatter anticipation hidden after last reel drop');
                (self.scene as any).__isScatterAnticipationActive = false;
              }
            } catch {}
            resolve();
          }
          continue;
        }
      } catch {}

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
            ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1)) ? Phaser.Math.Easing.Cubic.Out : Phaser.Math.Easing.Linear,
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
                // Trigger _idle animations for this reel's NEW symbols immediately after drop completion
                self.triggerIdleAnimationsForNewReel(index);
                
                // Show after 3rd reel completes if anticipation is active
                try {
                  const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
                  if (isAnticipation && index === 2) {
                    // Show black overlay for scatter anticipation
                    if (self.overlayRect) {
                      // Fade out the base overlay first
                      if (self.baseOverlayRect) {
                        self.scene.tweens.add({
                          targets: self.baseOverlayRect,
                          alpha: 0,
                          duration: 300,
                          ease: 'Cubic.easeOut'
                        });
                      }
                      
                      // Fade in the black overlay
                      self.overlayRect.setAlpha(0);
                      self.overlayRect.setVisible(true);
                      self.scene.tweens.add({
                        targets: self.overlayRect,
                        alpha: 0.85, // Darker overlay during scatter anticipation
                        duration: 500,
                        ease: 'Cubic.easeOut'
                      });
                    }
                    // Also tint reel background to anticipation state
                    try { self.tweenReelBackgroundToAnticipationTint(300); } catch {}
                    
                    // Show scatter anticipation animations
                    const sa = (self.scene as any)?.scatterAnticipation;
                    if (sa && typeof sa.show === 'function') {
                      sa.show();
                    }
                    const sa2 = (self.scene as any)?.scatterAnticipation2;
                    if (sa2 && typeof sa2.show === 'function') {
                      sa2.show();
                    }
                    console.log('[Symbols] Scatter anticipation shown after 3rd reel drop');
                  }
                } catch {}

                // Hide after last reel completes if anticipation is active
                try {
                  const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
                  if (isAnticipation && index === (SLOT_ROWS - 1)) {
                    // Hide scatter anticipation animations
                    const sa = (self.scene as any)?.scatterAnticipation;
                    if (sa && typeof sa.hide === 'function') {
                      sa.hide();
                    }
                    const sa2 = (self.scene as any)?.scatterAnticipation2;
                    if (sa2 && typeof sa2.hide === 'function') {
                      sa2.hide();
                    }
                    
                    // Transition back to base overlay
                    if (self.overlayRect) {
                      // Fade out the black overlay
                      self.scene.tweens.add({
                        targets: self.overlayRect,
                        alpha: 0,
                        duration: 300,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                          if (self.overlayRect) {
                            self.overlayRect.setVisible(false);
                          }
                        }
                      });
                      
                      // Fade in the base overlay
                      if (self.baseOverlayRect) {
                        self.baseOverlayRect.setAlpha(0);
                        self.baseOverlayRect.setVisible(true);
                        self.scene.tweens.add({
                          targets: self.baseOverlayRect,
                          alpha: 0.2, // Original base overlay alpha
                          duration: 300,
                          ease: 'Cubic.easeOut'
                        });
                      }
                    }
                    try { self.flashReelOverlay(index); } catch {}
                    
                    console.log('[Symbols] Scatter anticipation hidden after last reel drop');
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
  
  
  
  // Ensure we only play the win SFX once per win animation start
  let hasPlayedWinSfx = false;
  
  // Track all winning grid positions to identify non-winners later
  const winningPositions = new Set<string>();

  for (const win of wins.allMatching.values()) {
    for (const grid of win) {
      // Safety check: ensure grid coordinates are within bounds
      if (grid.y < 0 || grid.y >= self.symbols.length || grid.x < 0 || grid.x >= self.symbols[0].length) {
        console.warn(`[Symbols] Grid coordinates (${grid.x}, ${grid.y}) out of bounds for symbols array [${self.symbols.length}][${self.symbols[0].length}], skipping`);
        continue;
      }

      const currentSymbol = self.symbols[grid.y][grid.x];
      
      if (currentSymbol) {
        // Mark this cell as a winner
        winningPositions.add(`${grid.y}_${grid.x}`);
        // If there is a sticky multiplier overlay at this cell, hide it while Spine animation is active
        try {
          const overlay = (self as any).stickyMultiplierOverlays?.find?.((e: any) => e.col === grid.y && e.row === grid.x);
          if (overlay && overlay.sprite && typeof overlay.sprite.setVisible === 'function') {
            overlay.sprite.setVisible(false);
          }
        } catch {}
        
        // Get the symbol value and construct the Spine key
        const symbolValue = data.symbols[grid.y][grid.x];

        
        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';
        const symbolName = `Symbol${symbolValue}_HTBH`;
        // Prefer *_win if present, else *_hit
        let hitAnimationName = `${symbolName}_win`;
        try {
          const cachedJson: any = (self.scene.cache.json as any).get(spineKey);
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
        
        try {
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          
          // Remove the current sprite
          currentSymbol.destroy();
          
          // Create Spine animation in its place
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          // Use controlled scaling from configuration, then center and fit to cell
          const configuredScale = self.getSpineSymbolScale(symbolValue);
          // Remember the original PNG home position so PNG can restore it later
          try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
          // Set canonical measurement pose before centering
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
          self.centerAndFitSpine(spineSymbol, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));
          try { const m = self.getSpineScaleMultiplier(symbolValue); if (m !== 1) spineSymbol.setScale(spineSymbol.scaleX * m, spineSymbol.scaleY * m); } catch {}
          console.log(`[Symbols] Applied scale ${configuredScale} to symbol ${symbolValue}`);
          
          // Play the hit animation (looped)
          spineSymbol.animationState.setAnimation(0, hitAnimationName, true);
          // Apply turbo timeScale to win symbol animations
          try {
            const speed = (window as any)?.gameStateManager?.isTurbo ? TurboConfig.WINLINE_ANIMATION_SPEED_MULTIPLIER : 1.0;
            (spineSymbol as any).animationState.timeScale = Math.max(0.0001, speed);
          } catch {}
          // Re-center on next tick to compensate for bounds changes after animation starts
          self.reCenterSpineNextTick(spineSymbol, x, y, self.getWinSymbolNudge(symbolValue));
          console.log(`[Symbols] Playing looped animation: ${hitAnimationName}`);

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

  // Note: Non-winning symbols idle animations are now handled per-reel in dropNewSymbols
  // This ensures idle animations start after each reel drops rather than all at once
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

