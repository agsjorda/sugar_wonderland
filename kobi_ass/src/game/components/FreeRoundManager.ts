import { Scene } from 'phaser';
import { GameAPI, SlotInitializeData } from '../../backend/GameAPI';
import { gameStateManager } from '../../managers/GameStateManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SlotController } from './SlotController';

/**
 * Initialization Free Round Manager (Kobi Ass)
 *
 * Ported from Hustle Horse to manage backend initialization data (free spin rounds)
 * without changing the existing scatter/bonus free‑spin flow.
 *
 * Responsibilities:
 * - Read initialization data from GameAPI.
 * - If initialization reports free rounds, show a compact "Free Spin" panel
 *   above the controllers and an initial reward dialog.
 * - Track remaining initialization free rounds and total winnings for those
 *   spins only, using WIN_STOP/REELS_START events.
 * - When all initialization free rounds are consumed, show a completion panel
 *   and then restore the normal controls.
 *
 * Notes:
 * - This manager is intentionally UI‑only; the actual "this spin is free"
 *   contract is enforced by GameAPI.doSpin via the `isFs` flag.
 * - We avoid hard depending on SlotController internals; any optional helpers
 *   are accessed via `(slotController as any)` and guarded.
 */
export class FreeRoundManager {
  private container: Phaser.GameObjects.Container | null = null;
  private sceneRef: Scene | null = null;

  // Small inline panel above controllers
  private countText: Phaser.GameObjects.Text | null = null;
  private labelText: Phaser.GameObjects.Text | null = null;

  // Center reward / completion panel
  private panelContainer: Phaser.GameObjects.Container | null = null;
  private panelOverlay: Phaser.GameObjects.Rectangle | null = null;
  private panelSpinsText: Phaser.GameObjects.Text | null = null;
  private panelBetText: Phaser.GameObjects.Text | null = null;

  private initializationData: SlotInitializeData | null = null;
  private slotControllerRef: SlotController | undefined;

  // References to SlotController UI elements for texture swapping during free rounds
  private spinButton: Phaser.GameObjects.Image | null = null;
  private autoplayStopIcon: Phaser.GameObjects.Image | null = null;

  private initialFreeSpins: number = 0;
  private remainingFreeSpins: number = 0;
  private initBet: number | null = null;
  private completionPanelShown: boolean = false;

  // Tracks the real cumulative total win across all initialization freeround spins
  // started from this manager.
  private accumulatedFreeRoundWin: number = 0;
  // True while a dedicated initialization freeround session (started via reward panel) is active.
  private trackingFreeRoundSession: boolean = false;

  /**
   * Entry-point. Call once from the Game scene after SlotController is created.
   */
  public create(scene: Scene, gameAPI: GameAPI, slotController?: SlotController): void {
    if (this.container) {
      // Already initialized
      return;
    }

    this.sceneRef = scene;
    this.initializationData = gameAPI.getInitializationData();
    this.slotControllerRef = slotController;

    // Read remaining free rounds + associated bet from GameAPI
    this.initialFreeSpins = gameAPI.getRemainingInitFreeSpins();
    this.remainingFreeSpins = this.initialFreeSpins;
    this.initBet = gameAPI.getInitFreeSpinBet();

    // Get references to SlotController UI elements for texture swapping
    if (slotController) {
      try {
        const scAny: any = slotController as any;
        this.spinButton = scAny.buttons?.get('spin') || null;
        this.autoplayStopIcon = scAny.autoplayStopIcon || null;
      } catch (e) {
        console.warn('[FreeRoundManager] Failed to get SlotController UI element references:', e);
      }
    }

    const sceneWidth = scene.scale.width;
    const sceneHeight = scene.scale.height;

    // Main container for inline panel; attach at root (render depth set explicitly)
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1500);

    // -------------------------------------------------------------------------
    // Compact "Free Spin" info panel just above the controllers
    // -------------------------------------------------------------------------
    const infoWidth = 125;
    const infoHeight = 55;
    const infoX = sceneWidth * 0.5;
    const controllerBandY = sceneHeight * 0.7779;
    const infoY = controllerBandY;

    const infoBg = scene.add.graphics();
    const radius = 10;
    // Subtle gold frame with black interior
    infoBg.lineStyle(1.5, 0xfdb832, 1.5);
    infoBg.strokeRoundedRect(infoX - infoWidth / 2, infoY - infoHeight / 2, infoWidth, infoHeight, radius);
    infoBg.fillStyle(0x000000, 0.65);
    infoBg.fillRoundedRect(
      infoX - infoWidth / 2 + 2,
      infoY - infoHeight / 2 + 2,
      infoWidth - 4,
      infoHeight - 4,
      radius - 2
    );
    infoBg.setDepth(1500);
    this.container.add(infoBg);

    // "Free\nSpin" label on the left
    this.labelText = scene.add.text(
      infoX - infoWidth / 2 + 25,
      infoY,
      'Free\nSpin',
      {
        fontSize: '12px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold',
        align: 'left',
      }
    );
    this.labelText.setOrigin(0, 0.5);
    this.labelText.setDepth(1501);
    this.container.add(this.labelText);
    this.applyFreeSpinLabelGradient();

    // Remaining spin count on the right
    this.countText = scene.add.text(
      infoX + infoWidth / 2 - 43,
      infoY,
      this.remainingFreeSpins.toString(),
      {
        fontSize: '36px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold',
        align: 'middle',
        stroke: '#FFC45C',
        strokeThickness: 2,
        letterSpacing: 1
      }
    );
    this.countText.setOrigin(0.5, 0.5);
    this.countText.setDepth(1501);
    this.container.add(this.countText);

    this.setupFreeRoundWinTracking();
    this.setupManualFreeRoundSpinConsumption();

    // Listen for fsCount updates from backend (when isFs: true is posted)
    // This will update the remaining free spins display with the value from the server
    gameEventManager.on(GameEventType.FREEROUND_COUNT_UPDATE, (data: any) => {
      const fsCount = typeof data === 'number' ? data : (data?.fsCount ?? data);
      if (typeof fsCount === 'number') {
        console.log('[FreeRoundManager] Received FREEROUND_COUNT_UPDATE from backend:', fsCount);
        this.remainingFreeSpins = fsCount;
        this.setFreeSpins(fsCount);
      } else {
        console.warn('[FreeRoundManager] Invalid fsCount received:', data);
      }
    });

    const shouldUseFreeSpin =
      !!this.initializationData &&
      this.initializationData.hasFreeSpinRound &&
      this.initialFreeSpins > 0;

    if (!shouldUseFreeSpin) {
      // No initialization free rounds – hide panel by default.
      this.disableFreeSpinMode();
      return;
    }

    // Normal behavior: show the free spin start reward panel after a short delay
    // so the player can see the game state first.
    scene.time.delayedCall(1500, () => {
      if (!this.sceneRef) {
        return;
      }
      this.enableFreeSpinMode();
      this.createRewardPanel(this.sceneRef);
    });
  }

  /**
   * Update displayed free spin count (both inline panel and reward panel, if present).
   */
  public setFreeSpins(count: number): void {
    if (!this.sceneRef || !this.container || !this.container.scene) {
      return;
    }

    if (this.countText && this.countText.active) {
      this.countText.setText(count.toString());
      const digitCount = Math.abs(count).toString().length;
      const fontSize = digitCount > 2 ? 32 : 36;
      this.countText.setFontSize(fontSize);
    }

    if (this.panelSpinsText) {
      if (this.panelSpinsText.active) {
        this.panelSpinsText.setText(count.toString());
        this.applySpinCountGradient();
      } else {
        this.panelSpinsText = null;
      }
    }

    // When count drops to 0 or below, prepare to end free spin mode
    if (count <= 0 && !this.completionPanelShown && this.sceneRef) {
      this.completionPanelShown = true;
      this.scheduleCompletionPanelWhenSafe();
    }
  }

  // ---------------------------------------------------------------------------
  // Visibility helpers
  // ---------------------------------------------------------------------------

  public show(): void {
    if (this.container) {
      this.container.setVisible(true);
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.setVisible(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Text gradient helpers
  // ---------------------------------------------------------------------------

  /**
   * Apply a vertical color gradient to the big spin count on the reward panel.
   * Colors: #FFD180, #FDB832, #B4720A
   */
  private applySpinCountGradient(): void {
    if (!this.panelSpinsText) {
      return;
    }

    const text = this.panelSpinsText as any;
    const ctx: CanvasRenderingContext2D | undefined = text.context;
    if (!ctx) {
      return;
    }

    // Ensure text metrics are up to date before computing gradient height
    if (typeof text.updateText === 'function') {
      text.updateText();
    }

    const h = this.panelSpinsText.height || 1;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#FFD180');
    gradient.addColorStop(0.5, '#FDB832');
    gradient.addColorStop(1, '#B4720A');

    this.panelSpinsText.setFill(gradient as any);
  }

  /**
   * Apply a vertical green gradient (#66D449 → #379557) to a given text object.
   */
  private applyBetValueGradientToText(target: Phaser.GameObjects.Text | null): void {
    if (!target) {
      return;
    }

    const anyText = target as any;
    const ctx: CanvasRenderingContext2D | undefined = anyText.context;
    if (!ctx) {
      return;
    }

    if (typeof anyText.updateText === 'function') {
      anyText.updateText();
    }

    const h = target.height || 1;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#66D449');
    gradient.addColorStop(1, '#379557');

    target.setFill(gradient as any);
  }

  /**
   * Apply the gold vertical gradient (white → #FFD180 → #FDB832 → #B4720A)
   * to the small "Free / Spin" label in the main info panel.
   */
  private applyFreeSpinLabelGradient(): void {
    if (!this.labelText) {
      return;
    }

    const anyText = this.labelText as any;
    const ctx: CanvasRenderingContext2D | undefined = anyText.context;
    if (!ctx) {
      return;
    }

    if (typeof anyText.updateText === 'function') {
      anyText.updateText();
    }

    const h = this.labelText.height || 1;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0.0, '#ffffff');
    gradient.addColorStop(0.25, '#ffd180');
    gradient.addColorStop(0.65, '#fdb832');
    gradient.addColorStop(1.0, '#b4720a');

    this.labelText.setFill(gradient as any);
  }

  // ---------------------------------------------------------------------------
  // Tracking & bookkeeping
  // ---------------------------------------------------------------------------

  private startTrackingFreeRoundWins(): void {
    this.accumulatedFreeRoundWin = 0;
    this.trackingFreeRoundSession = true;
    console.log('[FreeRoundManager] Started tracking initialization freeround total win');
  }

  private stopTrackingFreeRoundWins(): void {
    if (!this.trackingFreeRoundSession) {
      return;
    }
    this.trackingFreeRoundSession = false;
    console.log(
      '[FreeRoundManager] Stopped tracking initialization freeround total win. Final:',
      this.accumulatedFreeRoundWin
    );
  }

  private getFinalFreeRoundTotalWin(): number {
    return this.accumulatedFreeRoundWin;
  }

  /**
   * Accumulate total win for initialization freerounds using WIN_STOP.
   */
  private setupFreeRoundWinTracking(): void {
    gameEventManager.on(GameEventType.WIN_STOP, () => {
      if (!this.trackingFreeRoundSession) {
        return;
      }
      if (!this.sceneRef) {
        return;
      }

      // Initialization freerounds are base-game spins (not bonus/scatter).
      if (gameStateManager.isBonus) {
        return;
      }

      const gsmAny: any = gameStateManager as any;
      if (gsmAny.isInFreeSpinRound !== true) {
        return;
      }

      try {
        const sceneAny: any = this.sceneRef as any;
        const symbolsComponent = sceneAny?.symbols;
        const spinData = symbolsComponent?.currentSpinData;
        if (!spinData || !spinData.slot) {
          console.log('[FreeRoundManager] No spin data available for win tracking');
          return;
        }

        const slot: any = spinData.slot;
        let spinWin = 0;

        // For kobi_ass, initialization free spins are base-game spins.
        // Calculate from paylines (kobi_ass uses paylines structure)
        if (Array.isArray(slot.paylines) && slot.paylines.length > 0) {
          console.log(`[FreeRoundManager] Processing ${slot.paylines.length} paylines for win calculation`);
          for (const payline of slot.paylines) {
            const w = Number((payline as any)?.win || 0);
            if (!isNaN(w) && w > 0) {
              console.log(`[FreeRoundManager] Payline ${payline.lineKey}: $${w} (symbol ${payline.symbol}, count ${payline.count})`);
              spinWin += w;
            }
          }
          console.log(`[FreeRoundManager] Total win calculated from paylines: $${spinWin}`);
        } else {
          console.log('[FreeRoundManager] No paylines in spin data (no win)');
        }

        if (spinWin > 0) {
          this.accumulatedFreeRoundWin += spinWin;
          console.log(
            `[FreeRoundManager] WIN_STOP (init freeround): added spinWin=$${spinWin.toFixed(2)}, accumulated=$${this.accumulatedFreeRoundWin.toFixed(2)}`
          );
        } else {
          console.log('[FreeRoundManager] No win detected for this free spin (spinWin=0)');
        }
      } catch (e) {
        console.warn('[FreeRoundManager] Failed to accumulate initialization freeround win on WIN_STOP:', e);
      }
    });
  }

  /**
   * For manual initialization free rounds, decrement the remaining count once per spin start.
   */
  /**
   * For manual initialization free rounds (no autoplay), decrement the remaining
   * free spin count once per spin start while we are in the dedicated
   * free-round context.
   * 
   * NOTE: Manual decrement is now DISABLED. The backend provides the fsCount
   * in the response (when isFs: true), and we listen for FREEROUND_COUNT_UPDATE
   * event to update the display instead.
   */
  private setupManualFreeRoundSpinConsumption(): void {
    // DISABLED: Backend now provides fsCount in response, so no manual decrement needed
    // The FREEROUND_COUNT_UPDATE event handler (set up in create()) will update
    // the remaining free spins display with the value from the server.
    console.log('[FreeRoundManager] Manual spin consumption disabled - using backend fsCount instead');
    
    // Legacy code commented out:
    /*
    gameEventManager.on(GameEventType.REELS_START, () => {
      if (!this.trackingFreeRoundSession) {
        return;
      }
      if (!this.sceneRef) {
        return;
      }
      if (gameStateManager.isBonus) {
        return;
      }

      const gsmAny: any = gameStateManager as any;
      if (gsmAny.isInFreeSpinRound !== true) {
        return;
      }

      if (this.remainingFreeSpins <= 0) {
        return;
      }

      this.remainingFreeSpins -= 1;
      this.setFreeSpins(this.remainingFreeSpins);
    });
    */
  }

  // ---------------------------------------------------------------------------
  // Reward & completion panels
  // ---------------------------------------------------------------------------

  private animatePanelIn(scene: Scene, container: Phaser.GameObjects.Container | null): void {
    if (!container) return;
    container.setScale(0.8);
    container.setAlpha(0);

    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 260,
      ease: 'Back.Out'
    });
  }

  private animatePanelOut(
    scene: Scene,
    container: Phaser.GameObjects.Container | null,
    onComplete: () => void
  ): void {
    if (!container) {
      onComplete();
      return;
    }

    scene.tweens.add({
      targets: container,
      scaleX: 0.85,
      scaleY: 0.85,
      alpha: 0,
      duration: 200,
      ease: 'Back.In',
      onComplete: () => onComplete()
    });
  }

  /**
   * Initial "Free Spin Reward" panel.
   */
  private createRewardPanel(scene: Scene): void {
    if (this.panelContainer || this.initialFreeSpins <= 0) {
      return;
    }

    const panelWidth = 397;
    const panelHeight = 442;
    const centerX = scene.scale.width * 0.5;
    const centerY = scene.scale.height * 0.5;

    this.panelOverlay = scene.add.rectangle(
      scene.scale.width * 0.5,
      scene.scale.height * 0.5,
      scene.scale.width,
      scene.scale.height,
      0x000000,
      0
    );
    this.panelOverlay.setOrigin(0.5, 0.5);
    this.panelOverlay.setScrollFactor(0);
    this.panelOverlay.setDepth(9000);
    this.panelOverlay.setInteractive({ useHandCursor: false });

    this.panelContainer = scene.add.container(centerX, centerY);
    this.panelContainer.setDepth(10000);
    this.animatePanelIn(scene, this.panelContainer);

    const bg = scene.add.graphics();
    bg.setAlpha(0.85);
    bg.fillStyle(0x000000, 0.95);
    bg.lineStyle(2, 0xffffff, 0.12);
    const panelRadius = 16;
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, panelRadius);
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, panelRadius);
    this.panelContainer.add(bg);

    // Title
    const titleText = scene.add.text(
      0,
      -panelHeight / 2 + 60,
      'Free Spin Reward',
      {
        fontSize: '24px',
        color: '#00ff00',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.applyBetValueGradientToText(titleText);
    this.panelContainer.add(titleText);

    // Subtitle
    const subtitleText = scene.add.text(
      0,
      -panelHeight / 2 + 110,
      'You have been Granted',
      {
        fontSize: '24px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(subtitleText);

    // Inner card
    const cardWidth = 144;
    const cardHeight = 135;
    const cardY = 0;
    const cardBg = scene.add.graphics();
    cardBg.fillStyle(0x212121, 1);
    cardBg.lineStyle(3, 0x4d4d4d, 1);
    const cardRadius = 12;
    cardBg.fillRoundedRect(-cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, cardRadius);
    cardBg.strokeRoundedRect(-cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, cardRadius);
    this.panelContainer.add(cardBg);

    // Big spins number
    this.panelSpinsText = scene.add.text(
      0,
      cardY - 25,
      this.initialFreeSpins.toString(),
      {
        fontSize: '64px',
        color: '#ffcc33',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.applySpinCountGradient();
    this.panelContainer.add(this.panelSpinsText);

    if (this.panelSpinsText) {
      this.panelSpinsText.setScale(1);
      scene.tweens.add({
        targets: this.panelSpinsText,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    const spinsLabel = scene.add.text(
      0,
      cardY + 15,
      'Spins',
      {
        fontSize: '20px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(spinsLabel);

    // "With $X.XX"
    const betValue =
      this.initBet != null
        ? this.initBet
        : (this.slotControllerRef && (this.slotControllerRef as any).getBaseBetAmount)
          ? (this.slotControllerRef as any).getBaseBetAmount()
          : 0;
    const betDisplay = betValue.toFixed(2);

    const withText = scene.add.text(
      0,
      0,
      'With',
      {
        fontSize: '14px',
        color: '#FFFFFF',
        fontFamily: 'poppins-regular'
      }
    );

    this.panelBetText = scene.add.text(
      0,
      0,
      `$${betDisplay}`,
      {
        fontSize: '20px',
        color: '#379557',
        fontFamily: 'poppins-bold'
      }
    );

    const spacing = 6;
    const totalWidth = withText.width + spacing + this.panelBetText.width;
    const baseX = -totalWidth / 2;
    const betY = cardY + 45;

    withText.setPosition(baseX + withText.width / 2, betY);
    this.panelBetText.setPosition(
      baseX + withText.width + spacing + this.panelBetText.width / 2,
      betY
    );

    withText.setOrigin(0.5, 0.5);
    this.panelBetText.setOrigin(0.5, 0.5);

    this.panelContainer.add(withText);
    this.panelContainer.add(this.panelBetText);
    // Apply gradient to the bet value text
    this.applyBetValueGradientToText(this.panelBetText);

    // "SPIN NOW" button using shared asset
    const buttonY = panelHeight / 2 - 85;
    const buttonImage = scene.add.image(0, buttonY, 'spin_now_button')
      .setOrigin(0.5, 0.5);
    this.panelContainer.add(buttonImage);

    const buttonLabel = scene.add.text(
      0,
      buttonY,
      'SPIN NOW',
      {
        fontSize: '24px',
        color: '#000000',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(buttonLabel);

    buttonImage.setInteractive({ useHandCursor: true });
    buttonImage.on('pointerdown', () => {
      if (!this.sceneRef) {
        if (this.panelContainer) {
          this.panelContainer.setVisible(false);
        }
        if (this.panelOverlay) {
          this.panelOverlay.setVisible(false);
          this.panelOverlay.disableInteractive();
        }
        if (this.slotControllerRef && this.initialFreeSpins > 0) {
          this.startTrackingFreeRoundWins();
          this.remainingFreeSpins = this.initialFreeSpins;
          this.setFreeSpins(this.remainingFreeSpins);
        }
        return;
      }

      this.animatePanelOut(this.sceneRef, this.panelContainer, () => {
        if (this.panelContainer) {
          this.panelContainer.setVisible(false);
        }
        if (this.panelOverlay) {
          this.panelOverlay.setVisible(false);
          this.panelOverlay.disableInteractive();
        }

        if (this.slotControllerRef && this.initialFreeSpins > 0) {
          this.startTrackingFreeRoundWins();
          this.remainingFreeSpins = this.initialFreeSpins;
          this.setFreeSpins(this.remainingFreeSpins);
        }
      });
    });
  }

  /**
   * Show a "Free Spin Done" credited completion panel.
   */
  private showCompletionCreditedPanel(totalWin: number): void {
    if (!this.sceneRef) {
      return;
    }

    const scene = this.sceneRef;
    const panelWidth = 397;
    const panelHeight = 318;
    const centerX = scene.scale.width * 0.5;
    const centerY = scene.scale.height * 0.5;

    if (!this.panelOverlay) {
      this.panelOverlay = scene.add.rectangle(
        scene.scale.width * 0.5,
        scene.scale.height * 0.5,
        scene.scale.width,
        scene.scale.height,
        0x000000,
        0
      );
      this.panelOverlay.setOrigin(0.5, 0.5);
      this.panelOverlay.setScrollFactor(0);
      this.panelOverlay.setDepth(9000);
    }
    this.panelOverlay.setVisible(true);
    this.panelOverlay.setInteractive({ useHandCursor: false });

    if (!this.panelContainer) {
      this.panelContainer = scene.add.container(centerX, centerY);
    }
    this.panelContainer.removeAll(true);
    this.panelContainer.setPosition(centerX, centerY);
    this.panelContainer.setDepth(10000);
    this.panelContainer.setVisible(true);
    this.animatePanelIn(scene, this.panelContainer);

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.95);
    bg.setAlpha(0.85);
    bg.lineStyle(2, 0xffffff, 0.12);
    const panelRadius = 16;
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, panelRadius);
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, panelRadius);
    this.panelContainer.add(bg);

    const titleText = scene.add.text(
      0,
      -panelHeight / 2 + 50,
      'Free Spin Done',
      {
        fontSize: '24px',
        color: '#00ff00',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.applyBetValueGradientToText(titleText);
    this.panelContainer.add(titleText);

    const totalWinDisplay = totalWin.toFixed(2);
    const winningsY = -50;

    const winningsText = scene.add.text(
      0,
      winningsY,
      `$${totalWinDisplay}`,
      {
        fontSize: '32px',
        color: '#00ff00',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.applyBetValueGradientToText(winningsText);
    this.panelContainer.add(winningsText);

    const creditedStatic = scene.add.text(
      0,
      -14,
      'has been credited',
      {
        fontSize: '24px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(creditedStatic);

    const line2 = scene.add.text(
      0,
      12,
      'to your balance',
      {
        fontSize: '22px',
        color: '#FFFFFF',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(line2);

    const buttonY = panelHeight / 2 - 70;
    const buttonImage = scene.add.image(0, buttonY, 'spin_now_button')
      .setOrigin(0.5, 0.5);
    this.panelContainer.add(buttonImage);

    const buttonLabel = scene.add.text(
      0,
      buttonY,
      'OK',
      {
        fontSize: '24px',
        color: '#000000',
        fontFamily: 'poppins-bold'
      }
    ).setOrigin(0.5, 0.5);
    this.panelContainer.add(buttonLabel);

    buttonImage.setInteractive({ useHandCursor: true });
    buttonImage.on('pointerdown', () => {
      if (!this.sceneRef) {
        if (this.panelContainer) {
          this.panelContainer.setVisible(false);
        }
        if (this.panelOverlay) {
          this.panelOverlay.setVisible(false);
          this.panelOverlay.disableInteractive();
        }
        this.stopTrackingFreeRoundWins();
        this.disableFreeSpinMode();
        // Optional helper on SlotController for restoring controls; guard with loose cast
        const scAny: any = this.slotControllerRef as any;
        if (scAny && typeof scAny.enableControlsAfterFreeRounds === 'function') {
          scAny.enableControlsAfterFreeRounds();
        }
        return;
      }

      this.animatePanelOut(this.sceneRef, this.panelContainer, () => {
        if (this.panelContainer) {
          this.panelContainer.setVisible(false);
        }
        if (this.panelOverlay) {
          this.panelOverlay.setVisible(false);
          this.panelOverlay.disableInteractive();
        }

        this.stopTrackingFreeRoundWins();
        this.disableFreeSpinMode();
        const scAny: any = this.slotControllerRef as any;
        if (scAny && typeof scAny.enableControlsAfterFreeRounds === 'function') {
          scAny.enableControlsAfterFreeRounds();
        }
      });
    });
  }

  /**
   * Wait until reels are stopped and win dialogs are done, then show completion panel.
   */
  private scheduleCompletionPanelWhenSafe(): void {
    const tryShow = () => {
      if (
        !gameStateManager.isReelSpinning &&
        !gameStateManager.isShowingWinDialog &&
        !gameStateManager.isShowingWinlines
      ) {
        this.showCompletionCreditedPanel(this.getFinalFreeRoundTotalWin());
        return;
      }

      let reelsStopUnsub: (() => void) | null = null;
      let winStopUnsub: (() => void) | null = null;
      let winDialogClosedUnsub: (() => void) | null = null;

      const attempt = () => {
        if (reelsStopUnsub) reelsStopUnsub();
        if (winStopUnsub) winStopUnsub();
        if (winDialogClosedUnsub) winDialogClosedUnsub();

        if (
          !gameStateManager.isReelSpinning &&
          !gameStateManager.isShowingWinDialog &&
          !gameStateManager.isShowingWinlines
        ) {
          this.showCompletionCreditedPanel(this.getFinalFreeRoundTotalWin());
        } else {
          tryShow();
        }
      };

      reelsStopUnsub = gameEventManager.on(GameEventType.REELS_STOP, () => attempt());
      winStopUnsub = gameEventManager.on(GameEventType.WIN_STOP, () => attempt());
      winDialogClosedUnsub = gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, () => attempt());
    };

    tryShow();
  }

  // ---------------------------------------------------------------------------
  // Mode toggles
  // ---------------------------------------------------------------------------

  public enableFreeSpinMode(): void {
    if (this.container) {
      this.container.setVisible(true);
    }

    console.log('[FreeRoundManager] Enabling initialization free spin mode (re-skinning SlotController spin button for free rounds)');

    // Re-skin the SlotController's spin button to use the freeround background,
    // but keep its interaction and core behavior intact.
    if (this.spinButton) {
      try {
        this.spinButton.setTexture('freeround_bg');
        this.spinButton.setVisible(true);
        this.spinButton.setInteractive();
      } catch (e) {
        console.warn('[FreeRoundManager] Failed to set freeround_bg texture on spin button:', e);
      }
    }
    // Hide autoplay stop icon during initialization free rounds; spin icon can
    // remain as-is so existing animation/UX is preserved.
    if (this.autoplayStopIcon) {
      this.autoplayStopIcon.setVisible(false);
    }

    // Disable other controls while free rounds are active (optional helper on SlotController)
    const scAny: any = this.slotControllerRef as any;
    if (scAny && typeof scAny.disableControlsForFreeRounds === 'function') {
      scAny.disableControlsForFreeRounds();
    }

    try {
      (gameStateManager as any).isInFreeSpinRound = true;
    } catch {
      // Optional flag
    }
  }

  public disableFreeSpinMode(): void {
    if (this.container) {
      this.container.setVisible(false);
    }

    console.log('[FreeRoundManager] Disabling initialization free spin mode (restoring normal spin button texture)');

    // Restore the spin button to use the regular spin texture
    if (this.spinButton) {
      try {
        this.spinButton.setTexture('spin');
        this.spinButton.setVisible(true);
        this.spinButton.setInteractive();
      } catch (e) {
        console.warn('[FreeRoundManager] Failed to restore spin texture on spin button:', e);
      }
    }
    // Restore autoplay stop icon visibility (it will be shown/hidden based on autoplay state)
    if (this.autoplayStopIcon) {
      // Don't force visible here; let SlotController manage its visibility
      // based on whether autoplay is actually running
      const scAny: any = this.slotControllerRef as any;
      if (scAny && scAny.gameData && scAny.gameData.isAutoPlaying) {
        this.autoplayStopIcon.setVisible(true);
      }
    }

    try {
      (gameStateManager as any).isInFreeSpinRound = false;
    } catch {
      // Optional flag
    }
  }

  /**
   * Clean up all created game objects.
   */
  public destroy(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
    if (this.panelOverlay) {
      this.panelOverlay.destroy();
      this.panelOverlay = null;
    }
    this.countText = null;
    this.labelText = null;
    this.panelSpinsText = null;
    this.panelBetText = null;
    this.sceneRef = null;
  }
}

