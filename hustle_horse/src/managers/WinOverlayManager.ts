import { Scene } from 'phaser';

export type WinOverlayKind = 'big' | 'mega' | 'epic' | 'super';

/**
 * Centralized manager to ensure only one Win overlay shows at a time and to
 * serialize multiple requests across base and bonus scenes.
 */
export class WinOverlayManager {
  private scene: Scene;
  private queue: Array<{ kind: WinOverlayKind; amount: number }> = [];
  private isProcessing = false;
  private active: { kind: WinOverlayKind; amount: number } | null = null;
  private lastEnqueueAt = 0;
  private priorities: Record<WinOverlayKind, number> = { super: 4, epic: 3, mega: 2, big: 1 };

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public enqueueShow(kind: WinOverlayKind, amount: number): void {
    try {
      // If congrats is showing or bonus finished, ignore win overlays
      const dialogs: any = (this.scene as any).dialogs;
      const gsm: any = (this.scene as any).gameStateManager;
      if (dialogs?.isCongratsShowing?.()) return;
      if (gsm?.isBonus && gsm?.isBonusFinished) return;

      // Throttle very rapid duplicate enqueues
      const now = Date.now();
      this.lastEnqueueAt = now;

      // Coalesce into a single queued item, keeping highest priority and max amount
      const existingQueued = this.queue.length > 0 ? this.queue[0] : undefined;
      if (existingQueued) {
        const higher = this.priorities[kind] > this.priorities[existingQueued.kind] ? kind : existingQueued.kind;
        existingQueued.kind = higher as WinOverlayKind;
        existingQueued.amount = Math.max(existingQueued.amount, amount);
      } else if (this.active && this.active.kind === kind) {
        this.active.amount = Math.max(this.active.amount, amount);
      } else {
        this.queue.push({ kind, amount });
      }
      this.process();
    } catch {
      // Swallow errors defensively
    }
  }

  public clearQueue(): void {
    this.queue.length = 0;
  }

  public async hideActive(): Promise<void> {
    try {
      const sceneAny: any = this.scene as any;
      const overlay = this.getOverlay(this.active?.kind);
      await overlay?.hide?.(150);
    } catch {}
  }

  private async process(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        // Respect congrats/bonus-finished before each show
        const dialogs: any = (this.scene as any).dialogs;
        const gsm: any = (this.scene as any).gameStateManager;
        if (dialogs?.isCongratsShowing?.() || (gsm?.isBonus && gsm?.isBonusFinished)) {
          try {
            if (gsm?.isBonus && gsm?.isBonusFinished) {
              const scn: any = this.scene as any;
              if (!dialogs?.isCongratsShowing?.()) {
                scn.events?.emit?.('setBonusMode', false);
                const symbols = scn.symbols;
                if (symbols && typeof symbols.showCongratsDialogAfterDelay === 'function') {
                  symbols.showCongratsDialogAfterDelay();
                }
                try { if (gsm) gsm.isBonusFinished = false; } catch {}
              }
            }
          } catch {}
          this.queue.length = 0;
          try { if (this.active) await this.hideActive(); } catch {}
          break;
        }

        const next = this.queue.shift()!;
        this.active = { ...next };

        // Mark state so other systems know a win dialog is showing
        try { if (gsm) gsm.isShowingWinDialog = true; } catch {}

        const overlay = this.getOverlay(next.kind);
        if (!overlay || typeof overlay.show !== 'function') {
          // No overlay available; skip
          try { if (gsm) gsm.isShowingWinDialog = false; } catch {}
          this.active = null;
          continue;
        }

        // Show overlay and wait for dismissal
        try { overlay.show(next.amount); } catch {}
        try {
          if (typeof overlay.waitUntilDismissed === 'function') {
            await overlay.waitUntilDismissed();
          } else {
            // Fallback: wait a safe timeout
            await new Promise(res => setTimeout(res, 1800));
          }
        } catch {}

        // Clear dialog state
        try { if (gsm) gsm.isShowingWinDialog = false; } catch {}

        // After dismissal, if bonus finished flag got set while overlay was showing,
        // end bonus and show congrats automatically.
        try {
          const scn: any = this.scene as any;
          if (gsm?.isBonus && gsm?.isBonusFinished) {
            scn.events?.emit?.('setBonusMode', false);
            const symbols = scn.symbols;
            if (symbols && typeof symbols.showCongratsDialogAfterDelay === 'function') {
              symbols.showCongratsDialogAfterDelay();
              gsm.isBonusFinished = false;
            }
            // Do not continue queue if congrats is taking over
            this.queue.length = 0;
            this.active = null;
            break;
          }
        } catch {}

        this.active = null;
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public hasActiveOrQueued(): boolean {
    return !!this.active || this.queue.length > 0 || this.isProcessing;
  }

  private getOverlay(kind?: WinOverlayKind): any | null {
    const scn: any = this.scene as any;
    switch (kind) {
      case 'super': return scn.superWinOverlay ?? null;
      case 'epic': return scn.epicWinOverlay ?? null;
      case 'mega': return scn.megaWinOverlay ?? null;
      case 'big': return scn.bigWinOverlay ?? null;
      default: return null;
    }
  }
}
