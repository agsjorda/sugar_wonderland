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
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { runDropReels, applySkipReelTweaks } from './ReelDropScript';
import { handleHookScatterHighlight } from './HookScatterHighlighter';

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
  
  

  // Grid mask configuration and references
  public gridMaskShape?: Phaser.GameObjects.Graphics;
  public gridMask?: Phaser.Display.Masks.GeometryMask;
  public gridMaskPaddingLeft: number = 10;
  public gridMaskPaddingRight: number = 20;
  public gridMaskPaddingTop: number = 50;
  public gridMaskPaddingBottom: number = 25;

  // Base overlay (light grey behind symbols) padding in pixels
  public baseOverlayPaddingLeft: number = 20;
  public baseOverlayPaddingRight: number = 20;
  public baseOverlayPaddingTop: number = 10;
  public baseOverlayPaddingBottom: number = 27; // slightly larger bottom by default

  // PNG border offsets (apply to image-based borders in any mode)
  public borderTopOffsetY: number = 0;
  public borderBottomOffsetY: number = -14;
  
  // Skip-drop state
  private skipReelDropsActive: boolean = false;

  // Configuration for Spine symbol scales in idle animations - adjust these values manually
  private idleSpineSymbolScales: { [key: number]: number } = {
    0:  0.065,   
    1:  0.060, 
    2:  0.060, 
    3:  0.060, 
    4:  0.050,  
    5:  0.090,
    6:  0.060,
    7:  0.060,
    8:  0.060,
    9:  0.060, 
    10: 0.060, 
    11: 0.060,
    12: 0.060,
    13: 0.060,
    14: 0.060
  };

  // Optional override scales for winning-symbol Spine animations (per symbol).
  // When not specified for a given symbol, win animations fall back to idle scales.
  private winSpineSymbolScales: { [key: number]: number } = {
    0:  0.085,   
    1:  0.180, 
    2:  0.080, 
    3:  0.080, 
    4:  0.180,  
    5:  0.090,
    6:  0.080,
    7:  0.080,
    8:  0.080,
    9:  0.080, 
    10: 0.080, 
    11: 0.080,
    12: 0.080,
    13: 0.080,
    14: 0.080
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

  public getWinSymbolNudge(symbolValue: number): { x: number; y: number } | undefined {
    const nudges: { [k: number]: { x: number; y: number } } = {
      // Provide separate offsets for win/hit animations if their bounds differ
      1:  { x: 0, y: 0 },
      13: { x: 0, y: 0 },
      14: { x: 0, y: 0 }
    };
    return nudges[symbolValue];
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
      this.ensureCleanSymbolState();
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

      try { this.resetAllSymbolsToIdle(); } catch {}

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
  
  public getIdleScaleMultiplier(symbolValue: number): number {
    // Multiplier disabled: rely solely on idleSpineSymbolScales for idle size
    return 1;
  }

  public getSpineScaleMultiplier(symbolValue: number): number {
    // Multiplier disabled: rely solely on idle/win scales for size
    return 1;
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

  public ensureCleanSymbolState(): void {
    console.log('[Symbols] ensureCleanSymbolState called');

    if (!this.symbols || this.symbols.length === 0) {
      console.warn('[Symbols] ensureCleanSymbolState: symbols grid is empty');
      return;
    }

    if (!this.currentSymbolData) {
      console.warn('[Symbols] ensureCleanSymbolState: currentSymbolData is null – cannot map PNG symbols');
      return;
    }

    let convertedCount = 0;
    let spineCount = 0;
    let missingTextureCount = 0;

    for (let col = 0; col < this.symbols.length; col++) {
      for (let row = 0; row < this.symbols[col].length; row++) {
        const symbol = this.symbols[col][row];

        if (symbol && (symbol as any).animationState) {
          spineCount++;
          try {
            const symbolValue = this.currentSymbolData[col]?.[row];
            if (symbolValue === undefined || symbolValue === null) {
              console.warn(`[Symbols] ensureCleanSymbolState: missing symbolValue for cell [${col}][${row}]`);
              continue;
            }

            const x = symbol.x;
            const y = symbol.y;
            const spriteKey = "symbol_" + symbolValue;

            if (!this.scene.textures.exists(spriteKey)) {
              missingTextureCount++;
              try {
                const allKeys = this.scene.textures.getTextureKeys?.() || [];
                const symbolKeys = allKeys.filter((k: string) => k.startsWith('symbol_'));
                console.warn(`[Symbols] ensureCleanSymbolState: texture '${spriteKey}' does not exist. Available symbol keys:`, symbolKeys);
              } catch {}
              continue;
            }

            const home = (symbol as any).__pngHome as { x: number; y: number } | undefined;
            const px = home && typeof home.x === "number" ? home.x : x;
            const py = home && typeof home.y === "number" ? home.y : y;

            try { this.container.remove(symbol); } catch {}
            try { symbol.destroy(); } catch {}

            const pngSprite = this.scene.add.sprite(px, py, spriteKey);
            pngSprite.displayWidth = this.displayWidth;
            pngSprite.displayHeight = this.displayHeight;
            try { (pngSprite as any).__pngHome = { x: px, y: py }; } catch {}
            try { (pngSprite as any).__pngSize = { w: this.displayWidth, h: this.displayHeight }; } catch {}

            this.container.add(pngSprite);
            this.symbols[col][row] = pngSprite;
            convertedCount++;
          } catch (e) {
            console.warn('[Symbols] ensureCleanSymbolState: error converting Spine symbol to PNG at', { col, row }, e);
          }
        }
      }
    }

    console.log(`[Symbols] ensureCleanSymbolState summary: spineCount=${spineCount}, converted=${convertedCount}, missingTextures=${missingTextureCount}`);
    if (convertedCount > 0) {
      console.log(`[Symbols] Converted ${convertedCount} Spine symbols back to PNG/WEBP for spin`);
    }
  }

  // Resolve the best animation name for a given symbol value based on cached Spine JSON
  public resolveSymbolAnimName(spineKey: string, symbolValue: number): string {
    const base = `Symbol${symbolValue}_TB`;
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

        const spineKey = `symbol_${symbolValue}_spine`;
        const symbolName = `Symbol${symbolValue}_TB`;
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

        // If this is still a PNG, skip idle Spine animation
        if (!isSpine) {
          console.log(`[Symbols] Skipping idle Spine animation for PNG/WEBP symbol ${symbolValue} at (${reelIndex}, ${col})`);
          continue;
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

  private resetAllSymbolsToIdle(): void {
    try {
      if (!this.symbols || !this.symbols[0]) {
        return;
      }
      const reels = this.symbols[0].length;
      const emptyWinningPositions = new Set<string>();
      for (let reelIndex = 0; reelIndex < reels; reelIndex++) {
        this.triggerIdleAnimationsForReel(reelIndex, emptyWinningPositions);
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

  // Ensure Spine factory is available for this scene so we can create Spine symbols
  const hasSpineFactory = ensureSpineFactory(scene as any, '[Symbols] createInitialSymbols');

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
      const symbolValue = symbols[col][row];
      let symbol: any;
      try {
        const spineKey = `symbol_${symbolValue}_spine`;
        const atlasKey = spineKey + '-atlas';
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
            self.reCenterSpineNextTick(spineSymbol, x, y, self.getIdleSymbolNudge(symbolValue));
          } catch {}
          self.container.add(spineSymbol);
          symbol = spineSymbol;
        } else {
          const spriteKey = 'symbol_' + symbolValue;
          if (scene.textures.exists(spriteKey)) {
            const sprite = scene.add.sprite(x, y, spriteKey);
            sprite.displayWidth = self.displayWidth;
            sprite.displayHeight = self.displayHeight;
            self.container.add(sprite);
            symbol = sprite;
          } else {
            console.warn(`[Symbols] No Spine or PNG texture for initial symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
            symbol = null as any;
          }
        }
      } catch {
        const spriteKey = 'symbol_' + symbolValue;
        if (scene.textures.exists(spriteKey)) {
          const sprite = scene.add.sprite(x, y, spriteKey);
          sprite.displayWidth = self.displayWidth;
          sprite.displayHeight = self.displayHeight;
          self.container.add(sprite);
          symbol = sprite;
        } else {
          console.warn(`[Symbols] Failed to create initial symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
          symbol = null as any;
        }
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
  
  // Use the existing dropReels function
  await runDropReels(self, mockData, Symbols.FILLER_COUNT);
  
  disposeSymbols(self.symbols);
  self.symbols = self.newSymbols;
  self.newSymbols = [];
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
      } else if (isSkipActive) {
        console.log('[Symbols] Drawing win lines from SpinData (single-pass due to skip request)');
        // Optional: accelerate winline animations similar to turbo
        if (slotController && typeof slotController.applyTurboToWinlineAnimations === 'function') {
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
      };
      
      gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onWinDialogClosed);
    } else {
      console.log('[Symbols] No win dialog showing - starting scatter animation immediately');
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
  
  // Process the symbols using the same logic as before
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
					try {
						const m = self.getSpineScaleMultiplier(symbolValue) * self.getIdleScaleMultiplier(symbolValue);
						if (m !== 1) symbol.setScale(symbol.scaleX * m, symbol.scaleY * m);
					} catch {}
					try {
						(symbol as any).__pngHome = { x, y };
						(symbol as any).__pngSize = { w: self.displayWidth, h: self.displayHeight };
						(symbol as any).__pngNudge = self.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 };
					} catch {}
					try {
						(symbol as any).displayWidth = self.displayWidth;
						(symbol as any).displayHeight = self.displayHeight;
					} catch {}
					self.container.add(symbol);
					try {
						const symbolName = `Symbol${symbolValue}_TB`;
						let idleAnim = `${symbolName}_idle`;
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
						try { (symbol as any).animationState?.setAnimation(0, idleAnim, true); } catch {}
						try { self.reCenterSpineNextTick(symbol, x, y, self.getIdleSymbolNudge(symbolValue)); } catch {}
					} catch {}
				} else {
					const spriteKey = 'symbol_' + symbolValue;
					if (scene.textures.exists(spriteKey)) {
						symbol = scene.add.sprite(x, y, spriteKey);
						symbol.displayWidth = self.displayWidth;
						symbol.displayHeight = self.displayHeight;
						self.container.add(symbol);
					} else {
						console.warn(`[Symbols] No Spine or PNG texture for new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
						symbol = null as any;
					}
				}
			} catch {
				// Final safety fallback to PNG if available
				const spriteKey = 'symbol_' + symbolValue;
				if (scene.textures.exists(spriteKey)) {
					symbol = scene.add.sprite(x, y, spriteKey);
					symbol.displayWidth = self.displayWidth;
					symbol.displayHeight = self.displayHeight;
					self.container.add(symbol);
				} else {
					console.warn(`[Symbols] Failed to create new symbol ${symbolValue} at [${col}, ${row}] – leaving empty.`);
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
        
        // Get the symbol value and construct the Spine key
        const symbolValue = data.symbols[grid.y][grid.x];

        const spineKey = `symbol_${symbolValue}_spine`;
        const spineAtlasKey = spineKey + '-atlas';
        // Resolve the best available animation for this symbol (prefer _win, then _hit, else first)
        const winAnimName = self.resolveSymbolAnimName(spineKey, symbolValue);
        
        // Store original position and scale
        const x = currentSymbol.x;
        const y = currentSymbol.y;
        const displayWidth = currentSymbol.displayWidth;
        const displayHeight = currentSymbol.displayHeight;
        
        try {
          const hasSpineJson = (self.scene.cache.json as any)?.has?.(spineKey);
          const canCreateSpine = hasSpineJson && (self.scene.add as any)?.spine;
          if (!canCreateSpine) {
            console.log(`[Symbols] No Spine data for winning symbol ${symbolValue} at (${grid.x}, ${grid.y}); keeping PNG/WEBP symbol.`);
            continue;
          }
          console.log(`[Symbols] Replacing sprite with Spine animation: ${spineKey} at (${grid.x}, ${grid.y})`);
          currentSymbol.destroy();
          const spineSymbol = self.scene.add.spine(x, y, spineKey, spineAtlasKey);
          spineSymbol.setOrigin(0.5, 0.5);
          const configuredScale = self.getWinSpineSymbolScale(symbolValue);
          try { (spineSymbol as any).__pngHome = { x, y }; } catch {}
          try { spineSymbol.skeleton.setToSetupPose(); spineSymbol.update(0); } catch {}
          self.centerAndFitSpine(spineSymbol, x, y, self.displayWidth, self.displayHeight, configuredScale, self.getWinSymbolNudge(symbolValue));

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

