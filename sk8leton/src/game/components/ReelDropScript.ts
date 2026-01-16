import { GameData } from "./GameData";
import { gameStateManager } from "../../managers/GameStateManager";
import { SLOT_ROWS, SLOT_COLUMNS } from "../../config/GameConfig";
import { SoundEffectType } from "../../managers/AudioManager";
import { getRandomSymbol5Variant, getSymbol5ImageKeyForVariant } from "./Symbol5VariantHelper";
import { ScatterAnticipationSequenceController } from "./ScatterAnticipationSequenceController";

function scheduleHeldReelSpinnerDecelForStop(self: any, reelIndex: number, mainDropDurationMs: number): void {
  try {
    const stateMap: any = (self as any).__heldReelSpinners;
    const st = stateMap?.[reelIndex];
    if (!st) return;
    const fn = st.__heldSpinnerSetTargetMultiplier;
    if (typeof fn !== 'function') return;

    try {
      const old = (st as any).__heldSpinnerDecelTimer;
      old?.remove?.(false);
      old?.destroy?.();
    } catch {}

    const total = Math.max(0, Number(mainDropDurationMs) || 0);
    if (!(total > 0)) return;

    // Match dropFillers/dropNewSymbols two-phase anticipation timing exactly:
    // finalDur = round(total*0.25), firstDur = round(total-finalDur)
    const finalDur = Math.max(0, Math.round(total * 0.25));
    const firstDur = Math.max(0, Math.round(total - finalDur));

    const ease = (window as any).Phaser?.Math?.Easing?.Cubic?.Out
      || (window as any).Phaser?.Math?.Easing?.Quadratic?.Out
      || (window as any).Phaser?.Math?.Easing?.Linear;

    const timer = self.scene?.time?.delayedCall?.(firstDur, () => {
      try { fn(0, finalDur, ease); } catch {}
    });
    try { (st as any).__heldSpinnerDecelTimer = timer; } catch {}
  } catch {}
}

function spawnReleaseFillersForHeldReel(
  self: any,
  fillerCount: number,
  reelIndex: number,
  extraRows: number,
  dropDistance: number,
  mainDropDuration: number,
  isAnticipationLastReel: boolean,
  anticipationEase: any,
  winUpHeightForDrop: number
): void {
  try {
    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;
    const x = startX + reelIndex * symbolTotalWidth + symbolTotalWidth * 0.5;

    const aboveCount = Math.max(0, Number(fillerCount) || 0) + Math.max(0, Number(extraRows) || 0);
    const totalItems = aboveCount + SLOT_ROWS;
    const fillersToCreate = totalItems;
    const startIndexY = -aboveCount;

    const mainDropTweens = (() => {
      if (!isAnticipationLastReel) {
        return [{
          y: `+= ${dropDistance}`,
          duration: mainDropDuration,
          ease: (window as any).Phaser?.Math?.Easing?.Linear,
        }];
      }

      const finalDist = Math.max(0, Math.round(dropDistance * 0.15));
      const firstDist = Math.max(0, Math.round(dropDistance - finalDist));
      const finalDur = Math.max(0, Math.round(mainDropDuration * 0.25));
      const firstDur = Math.max(0, Math.round(mainDropDuration - finalDur));

      return [
        {
          y: `+= ${firstDist}`,
          duration: firstDur,
          ease: (window as any).Phaser?.Math?.Easing?.Linear,
        },
        {
          y: `+= ${finalDist}`,
          duration: finalDur,
          ease: anticipationEase,
        }
      ];
    })();

    const settleDelta = 0;
    const settleDuration = 1;
    const winUpDurationForChain = (winUpHeightForDrop > 0) ? self.scene.gameData.winUpDuration : 1;

    for (let i = 0; i < fillersToCreate; i++) {
      const y = getYPos(self, i + startIndexY);

      let spriteKey: string | null = null;
      try {
        const pick = pickRandomHeldSpinnerSpritePick(self);
        spriteKey = pick?.key || null;
      } catch {
        spriteKey = null;
      }

      const safeSpriteKey = (() => {
        try {
          if (spriteKey && self.scene.textures.exists(spriteKey)) return spriteKey;
        } catch {}
        try {
          if (self.scene.textures.exists('symbol_0')) return 'symbol_0';
        } catch {}
        return null;
      })();
      if (!safeSpriteKey) continue;

      let s: any = null;
      try {
        s = self.scene.add.sprite(x, y, safeSpriteKey as string);
        s.displayWidth = self.displayWidth;
        s.displayHeight = self.displayHeight;
      } catch {
        s = null;
      }
      if (!s) continue;

      try { self.container.add(s); } catch {}
      try { (s as any).__fillerReelIndex = reelIndex; } catch {}
      try { (s as any).__fillerDropDone = false; } catch {}
      try {
        const dur = Math.max(1, Number(mainDropDuration) || 0);
        (s as any).__fillerPxPerMs = (Number(dropDistance) || 0) / dur;
      } catch {}
      try { registerActiveFiller(self, s); } catch {}

      try {
        self.scene.tweens.chain({
          targets: s,
          tweens: [
            {
              y: `-= ${winUpHeightForDrop}`,
              duration: winUpDurationForChain,
              ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
            },
            ...mainDropTweens,
            {
              y: `+= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `-= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
              onComplete: () => {
                try { (s as any).__fillerDropDone = true; } catch {}
              }
            }
          ]
        });
      } catch {
        try { (s as any).__fillerDropDone = true; } catch {}
      }
    }
  } catch {}
}

/**
 * Run the reel-drop sequence, including previous symbols, filler symbols, and new symbols.
 * This is extracted from Symbols.ts so it can be reused as an independent script.
 */
export async function runDropReels(self: any, symbols: number[][], fillerCount: number): Promise<void> {
  // Play turbo drop sound effect at the start of reel drop sequence when in turbo mode
  try {
    if (self.scene.gameData.isTurbo && (window as any).audioManager) {
      void 0;
    }
  } catch {}

  try { (self as any).__activeFillerSymbols = []; } catch {}
  try { (self.scene as any).__isScatterAnticipationOverlayVisible = false; } catch {}
  try {
    const bb = (self.scene as any).__boilingBubblesAnticipationEffect;
    if (bb && typeof bb.stop === 'function') {
      bb.stop();
    }
  } catch {}

  try { stopAllHeldReelSpinners(self); } catch {}

  const reelCompletionPromises: Promise<void>[] = [];

  let anticipationController: ScatterAnticipationSequenceController | null = null;
  let extendReels: boolean[] = new Array<boolean>(SLOT_COLUMNS).fill(false);
  try {
    anticipationController = (self.scene as any).__scatterAnticipationSequenceController as ScatterAnticipationSequenceController;
  } catch {
    anticipationController = null;
  }
  try {
    if (!anticipationController) {
      anticipationController = new ScatterAnticipationSequenceController(self);
      (self.scene as any).__scatterAnticipationSequenceController = anticipationController;
    }
  } catch {
    anticipationController = null;
  }
  try {
    if (anticipationController) {
      extendReels = anticipationController.resetForSpin(symbols);
    }
  } catch {}

  // Anticipation: if upcoming SpinData shows a scatter on 1st or 3rd columns (x = 0 or 2),
  // extend only the last reel's animation (x = SLOT_COLUMNS - 1)
  let extendLastReelDrop = false;
  try {
    extendLastReelDrop = Array.isArray(extendReels) ? extendReels.some(Boolean) : false;
    console.log(`[ReelDropScript] Anticipation check (dynamic): extend=${extendLastReelDrop}`);
  } catch (e) {
    console.warn("[ReelDropScript] Anticipation check failed:", e);
    extendLastReelDrop = false;
  }

  // Persist anticipation state on scene for cross-function checks
  try { (self.scene as any).__isScatterAnticipationActive = extendLastReelDrop; } catch {}

  const REEL_STAGGER_MS = 150;
  const turboSimultaneousDrop = (() => {
    try {
      return !!gameStateManager.isTurbo || !!self?.scene?.gameData?.isTurbo;
    } catch {
      return false;
    }
  })();
  const useSequentialStartForBuyAnticipation = !!gameStateManager.isBuyFeatureSpin && extendLastReelDrop && !turboSimultaneousDrop;
  let sequentialStartDelayMs = turboSimultaneousDrop ? 0 : REEL_STAGGER_MS;
  try {
    const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
    const isSkipActive = hasIsSkipFn
      ? !!(self as any).isSkipReelDropsActive()
      : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
    if (isSkipActive) {
      sequentialStartDelayMs = 0;
    }
  } catch {}

  const holdTargetByReel: Record<number, number> = {};
  try {
    const r4 = anticipationController?.getTargetReel?.(4);
    if (typeof r4 === 'number' && isFinite(r4)) {
      holdTargetByReel[r4] = typeof holdTargetByReel[r4] === 'number'
        ? Math.min(holdTargetByReel[r4], 4)
        : 4;
    }
  } catch {}
  try {
    const r5 = anticipationController?.getTargetReel?.(5);
    if (typeof r5 === 'number' && isFinite(r5)) {
      holdTargetByReel[r5] = typeof holdTargetByReel[r5] === 'number'
        ? Math.min(holdTargetByReel[r5], 5)
        : 5;
    }
  } catch {}

  const isSkipActiveNow = () => {
    try {
      const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
      return hasIsSkipFn
        ? !!(self as any).isSkipReelDropsActive()
        : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
    } catch {
      return false;
    }
  };

  const isReelHeld = (reelIndex: number): boolean => {
    try {
      const target = holdTargetByReel[reelIndex];
      if (!target) return false;
      if (isSkipActiveNow()) return false;
      const active = anticipationController?.getActiveTarget?.();
      if (typeof active === 'number' && active === target) return false;
      return true;
    } catch {
      return false;
    }
  };

  for (let col = 0; col < SLOT_COLUMNS; col++) {
    console.log(`[ReelDropScript] Processing reel ${col}`);
    const extendThisReel = !!extendReels?.[col];

    const holdTarget = holdTargetByReel[col];

    const stopStaggerMs = (turboSimultaneousDrop || useSequentialStartForBuyAnticipation || isSkipActiveNow())
      ? 0
      : Math.max(0, col * REEL_STAGGER_MS);

    dropPrevSymbols(self, fillerCount, col, extendThisReel, stopStaggerMs);
    if (holdTarget && isReelHeld(col)) {
      try { startHeldReelSpinner(self, fillerCount, col, false, stopStaggerMs); } catch {}
    } else {
      dropFillers(self, fillerCount, col, extendThisReel, stopStaggerMs);
    }
    const reelPromise = dropNewSymbols(self, fillerCount, col, extendThisReel, stopStaggerMs, anticipationController, holdTarget ? holdTarget : null);
    reelCompletionPromises.push(reelPromise);

    if (useSequentialStartForBuyAnticipation && sequentialStartDelayMs > 0 && col < (SLOT_COLUMNS - 1)) {
      await delay(sequentialStartDelayMs, () => {
        try { return isSkipActiveNow(); } catch { return false; }
      });
    }
  }

  // Wait for all reel animations to complete
  console.log("[ReelDropScript] Waiting for all reels to complete animation...");
  await Promise.all(reelCompletionPromises);
  console.log("[ReelDropScript] All reels have completed animation");
  try {
    if ((window as any).audioManager) {
      const isTurbo = !!gameStateManager.isTurbo || !!self?.scene?.gameData?.isTurbo;
      if (isTurbo) {
        (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
      }
    }
  } catch {}
}

/**
 * Apply skip-reel tweaks: speed up symbol-related tweens and shrink drop delays/durations.
 * Extracted from Symbols.requestSkipReelDrops for reuse.
 */
export function applySkipReelTweaks(self: any, gd: GameData, timeScale: number): void {
  try { void self; void gd; void timeScale; } catch {}
}

export function destroyActiveFillerSymbols(self: any, reelIndex?: number): void {
  try {
    const hasIndex = (typeof reelIndex === 'number' && isFinite(reelIndex));
    try {
      if (hasIndex) {
        stopHeldReelSpinner(self, reelIndex as number);
      } else {
        stopAllHeldReelSpinners(self);
      }
    } catch {}

    const arr = (self as any).__activeFillerSymbols;
    if (!Array.isArray(arr) || arr.length === 0) {
      if (!hasIndex) {
        try { (self as any).__activeFillerSymbols = []; } catch {}
      }
      return;
    }

    const keep: any[] = [];
    for (const s of arr) {
      if (!s || (s as any).destroyed) continue;
      const matches = !hasIndex || ((s as any).__fillerReelIndex === (reelIndex as number));
      if (!matches) {
        keep.push(s);
        continue;
      }
      try { self.scene?.tweens?.killTweensOf?.(s); } catch {}
      try { s.destroy?.(); } catch {}
    }

    try {
      (self as any).__activeFillerSymbols = hasIndex ? keep : [];
    } catch {}
  } catch {}
}

function dropPrevSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false, stopStaggerMs: number = 0) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

  try {
    const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
    const isSkipActive = hasIsSkipFn
      ? !!(self as any).isSkipReelDropsActive()
      : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
    if (isSkipActive) {
      try {
        const col = (self as any).symbols?.[index];
        if (Array.isArray(col)) {
          for (const obj of col) {
            if (!obj || (obj as any).destroyed) continue;
            try { self.scene?.tweens?.killTweensOf?.(obj); } catch {}
            try { (obj as any).alpha = 0; } catch {}
            try { (obj as any).setVisible?.(false); } catch {}
          }
        }
      } catch {}
      return;
    }
  } catch {}

  // Check if symbols array has valid structure
  if (!Array.isArray(self.symbols) || self.symbols.length === 0 || !Array.isArray(self.symbols[0]) || self.symbols[0].length === 0) {
    console.warn("[ReelDropScript] dropPrevSymbols: symbols array structure is invalid, skipping");
    return;
  }

  // Use the canonical grid cell height instead of sampling from a specific symbol,
  // because individual symbol displayHeight can change after win animations.
  const height = self.displayHeight + self.verticalSpacing;
  const baseDropDistance = fillerCount * height + self.scene.gameData.winUpHeight;
  const extraMs = (extendDuration ? 3000 : 0) + Math.max(0, stopStaggerMs);
  const baseDropMs = self.scene.gameData.dropReelsDuration;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRowsRaw = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const extraRows = Math.min(40, Math.max(0, extraRowsRaw));
  const DROP_DISTANCE = (fillerCount + extraRows) * height + self.scene.gameData.winUpHeight;

  const column = self.symbols[index];
  if (!Array.isArray(column)) {
    console.warn(`[ReelDropScript] dropPrevSymbols: symbols column ${index} is invalid, skipping`);
    return;
  }

  for (let row = 0; row < column.length; row++) {
    const target = column[row];
    // If a symbol display object is intentionally missing (e.g. unknown symbol id), skip silently.
    if (target === null || typeof target === 'undefined') {
      continue;
    }

    self.scene.tweens.chain({
      targets: target,
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: (self.scene as any).Phaser?.Math?.Easing?.Circular?.Out || (window as any).Phaser?.Math?.Easing?.Circular?.Out || undefined,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropReelsDuration + extraMs,
          ease: (window as any).Phaser?.Math?.Easing?.Bounce?.Out,
        },
      ],
    });
  }
}

function dropFillers(
  self: any,
  fillerCount: number,
  index: number,
  extendDuration: boolean = false,
  stopStaggerMs: number = 0,
  holdLoopFn?: () => boolean
) {
  // Check if symbols array has valid structure
  if (!Array.isArray(self.symbols) || self.symbols.length === 0 || !Array.isArray(self.symbols[0]) || self.symbols[0].length === 0) {
    console.warn("[ReelDropScript] dropFillers: symbols array structure is invalid, skipping");
    return;
  }

  const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;

  try {
    const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
    const isSkipActive = hasIsSkipFn
      ? !!(self as any).isSkipReelDropsActive()
      : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
    if (isSkipActive) {
      try { destroyActiveFillerSymbols(self, index); } catch {}
      return;
    }
  } catch {}

  const isAnticipationLastReel = !!extendDuration && !!(self.scene as any)?.__isScatterAnticipationActive;
  const anticipationEase = (window as any).Phaser?.Math?.Easing?.Cubic?.Out
    || (window as any).Phaser?.Math?.Easing?.Quadratic?.Out
    || (window as any).Phaser?.Math?.Easing?.Linear;

  const height = self.displayHeight + self.verticalSpacing;
  const maskBottomPad = Math.max(0, Number((self as any)?.gridMaskPaddingBottom) || 0);
  const baseTotal = fillerCount + SLOT_ROWS;
  const baseDropDistance = baseTotal * height + (Number(self.scene?.gameData?.winUpHeight) || 0);
  const extraMs = (extendDuration ? 3000 : 0) + Math.max(0, stopStaggerMs);
  const baseDropMs = isBuyFeatureSpin ? self.scene.gameData.dropReelsDuration : (self.scene.gameData.dropDuration * 0.9);
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRowsRaw = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const extraRows = Math.min(40, Math.max(0, extraRowsRaw));
  const TOTAL_ITEMS = fillerCount + SLOT_ROWS + extraRows;
  const EXTRA_VISUAL_ROWS = 0;
  const DROP_DISTANCE = (TOTAL_ITEMS + EXTRA_VISUAL_ROWS) * height + (Number(self.scene?.gameData?.winUpHeight) || 0);
  const fillerSymbols: any[] = [];

  const mainDropDuration = isBuyFeatureSpin
    ? (self.scene.gameData.dropReelsDuration + extraMs)
    : ((self.scene.gameData.dropDuration * 0.9) + extraMs);

  const netDeltaY = (() => {
    const wu = Number(self.scene?.gameData?.winUpHeight) || 0;
    return DROP_DISTANCE - wu;
  })();

  const settleDelta = 40;
  const settleDuration = self.scene.gameData.dropDuration * 0.05;

  const mainDropTweens = (() => {
    if (!isAnticipationLastReel) {
      return [{
        y: `+= ${DROP_DISTANCE}`,
        duration: mainDropDuration,
        ease: (window as any).Phaser?.Math?.Easing?.Linear,
      }];
    }

    const finalDist = Math.max(0, Math.round(DROP_DISTANCE * 0.15));
    const firstDist = Math.max(0, Math.round(DROP_DISTANCE - finalDist));
    const finalDur = Math.max(0, Math.round(mainDropDuration * 0.25));
    const firstDur = Math.max(0, Math.round(mainDropDuration - finalDur));

    return [
      {
        y: `+= ${firstDist}`,
        duration: firstDur,
        ease: (window as any).Phaser?.Math?.Easing?.Linear,
      },
      {
        y: `+= ${finalDist}`,
        duration: finalDur,
        ease: anticipationEase,
      }
    ];
  })();

  const initialVisibleOffsetRows = (() => {
    if (typeof holdLoopFn !== 'function') return 0;
    const desiredStartIndexY = -SLOT_ROWS;
    const currentStartIndexY = -(TOTAL_ITEMS - SLOT_ROWS);
    return Math.max(0, desiredStartIndexY - currentStartIndexY);
  })();

  for (let i = 0; i < TOTAL_ITEMS - SLOT_ROWS; i++) {
    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_ROWS) + initialVisibleOffsetRows;
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y);

    // Restrict filler symbols to those that have dedicated WEBP icons in assets/portrait/high/symbols
    const fillerPool: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const randIndex = Math.floor(Math.random() * fillerPool.length);
    const symbolId = fillerPool[randIndex];
    let symbol: any;

    let spriteKey: string | null = null;

    if (symbolId === 5) {
      const variant = getRandomSymbol5Variant();
      spriteKey = getSymbol5ImageKeyForVariant(variant);
    } else {
      spriteKey = "symbol_" + symbolId;
    }

    const safeSpriteKey = (() => {
      try {
        if (spriteKey && self.scene.textures.exists(spriteKey)) return spriteKey;
      } catch {}
      try {
        if (self.scene.textures.exists('symbol_0')) return 'symbol_0';
      } catch {}
      return null;
    })();

    if (safeSpriteKey) {
      try {
        symbol = self.scene.add.sprite(x, y, safeSpriteKey as string);
        symbol.displayWidth = self.displayWidth;
        symbol.displayHeight = self.displayHeight;
      } catch (e) {
        console.warn(`[ReelDropScript] Failed to create sprite filler symbol ${symbolId} from key ${safeSpriteKey}:`, e);
        symbol = null as any;
      }
    }

    // If we failed to create a symbol, skip adding it to containers/tweens entirely
    if (!symbol) {
      continue;
    }

    try {
      self.container.add(symbol);
    } catch {}

    try { (symbol as any).__fillerReelIndex = index; } catch {}
    try {
      const dur = Math.max(1, Number(mainDropDuration) || 0);
      (symbol as any).__fillerPxPerMs = (Number(DROP_DISTANCE) || 0) / dur;
    } catch {}
    try { registerActiveFiller(self, symbol); } catch {}

    fillerSymbols.push(symbol);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    if (isBuyFeatureSpin) {
      const startChain = () => {
        self.scene.tweens.chain({
          targets: fillerSymbols[i],
          tweens: [
            {
              y: `-= ${self.scene.gameData.winUpHeight}`,
              duration: self.scene.gameData.winUpDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
            },
            ...mainDropTweens,
            {
              y: `+= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `-= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
              onComplete: () => {
                try {
                  const shouldHold = typeof holdLoopFn === 'function' ? !!holdLoopFn() : false;
                  if (shouldHold) {
                    try { (fillerSymbols[i] as any).__fillerDropDone = false; } catch {}
                    try { fillerSymbols[i].y = (fillerSymbols[i].y as number) - netDeltaY; } catch {}
                    try { startChain(); } catch {}
                    return;
                  }
                } catch {}
                try { (fillerSymbols[i] as any).__fillerDropDone = true; } catch {}
              }
            }
          ]
        });
      };
      startChain();
    } else {
      const startChain = () => {
        self.scene.tweens.chain({
          targets: fillerSymbols[i],
          tweens: [
            {
              y: `-= ${self.scene.gameData.winUpHeight}`,
              duration: self.scene.gameData.winUpDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
            },
            ...mainDropTweens,
            {
              y: `+= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `-= ${settleDelta}`,
              duration: settleDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
              onComplete: () => {
                try {
                  const shouldHold = typeof holdLoopFn === 'function' ? !!holdLoopFn() : false;
                  if (shouldHold) {
                    try { (fillerSymbols[i] as any).__fillerDropDone = false; } catch {}
                    try { fillerSymbols[i].y = (fillerSymbols[i].y as number) - netDeltaY; } catch {}
                    try { startChain(); } catch {}
                    return;
                  }
                } catch {}
                try { (fillerSymbols[i] as any).__fillerDropDone = true; } catch {}
              }
            }
          ]
        });
      };
      startChain();
    }
  }
}

function dropNewSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false, stopStaggerMs: number = 0, anticipationController?: ScatterAnticipationSequenceController | null, holdTarget: number | null = null): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check if symbols array has valid structure
    if (!Array.isArray(self.symbols) || self.symbols.length === 0 || !Array.isArray(self.symbols[0]) || self.symbols[0].length === 0) {
      console.warn("[ReelDropScript] dropNewSymbols: symbols array structure is invalid, resolving immediately");
      resolve();
      return;
    }

    // Base drop distances on the canonical grid cell height so that new symbols
    // land exactly in their cell centers under the mask, independent of any
    // per-symbol scale tweaks from previous spins.
    const height = self.displayHeight + self.verticalSpacing;
    const START_INDEX_BASE = fillerCount + SLOT_ROWS;
    const isHeldAnticipationTarget = (typeof holdTarget === 'number' && isFinite(holdTarget));
    const winUpHeightForDrop = (isHeldAnticipationTarget && !!(self.scene as any)?.__isScatterAnticipationActive)
      ? 0
      : self.scene.gameData.winUpHeight;
    const baseDropDistance = START_INDEX_BASE * height + winUpHeightForDrop;
    const heldExtraMs = (isHeldAnticipationTarget && !!(self.scene as any)?.__isScatterAnticipationActive)
      ? Math.max(0, Math.round((Number(self.scene?.gameData?.dropDuration) || 0) * 0.9))
      : 0;
    const extraMs = ((extendDuration && !isHeldAnticipationTarget) ? 3000 : 0) + heldExtraMs + Math.max(0, stopStaggerMs);
    const baseDropMs = (!!gameStateManager.isBuyFeatureSpin) ? self.scene.gameData.dropReelsDuration : (self.scene.gameData.dropDuration * 0.9);
    const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
    const extraRowsRaw = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
    const extraRows = Math.min(40, Math.max(0, extraRowsRaw));
    const START_INDEX = START_INDEX_BASE + extraRows;
    const DROP_DISTANCE = START_INDEX * height + winUpHeightForDrop;

    const isAnticipationLastReel = !!(self.scene as any)?.__isScatterAnticipationActive
      && (!!extendDuration || (typeof holdTarget === 'number' && isFinite(holdTarget)));
    const anticipationEase = (window as any).Phaser?.Math?.Easing?.Cubic?.Out
      || (window as any).Phaser?.Math?.Easing?.Quadratic?.Out
      || (window as any).Phaser?.Math?.Easing?.Linear;

    let completedAnimations = 0;
    const column = self.newSymbols?.[index];
    const totalAnimations = Array.isArray(column) ? column.length : 0;
    const START_INDEX_Y = -(fillerCount + SLOT_ROWS + extraRows);
    let skipApplied = false;
    let dropSfxPlayed = false;

    if (!Array.isArray(column) || totalAnimations === 0) {
      finalize();
      return;
    }

    const isSkipActiveNow = () => {
      try {
        const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
        return hasIsSkipFn
          ? !!(self as any).isSkipReelDropsActive()
          : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
      } catch {
        return false;
      }
    };

    const shouldReleaseHold = () => {
      try {
        if (!(typeof holdTarget === 'number' && isFinite(holdTarget))) return true;
        if (isSkipActiveNow()) return true;
        const active = anticipationController?.getActiveTarget?.();
        return typeof active === 'number' && active === holdTarget;
      } catch {
        return true;
      }
    };
    try {
      if ((typeof holdTarget === 'number' && isFinite(holdTarget)) && !shouldReleaseHold()) {
        for (let row = 0; row < column.length; row++) {
          const symbol = column[row];
          if (!symbol) continue;
          const startIndex = row + START_INDEX_Y;
          try { symbol.y = getYPos(self, startIndex); } catch {}
          try {
            const anySym: any = symbol as any;
            if (typeof anySym.__holdOriginalAlpha !== 'number') {
              anySym.__holdOriginalAlpha = typeof anySym.alpha === 'number' ? anySym.alpha : 1;
            }
            anySym.alpha = 0;
          } catch {}
        }
      }
    } catch {}

    const startDropTweens = () => {
      const keepHiddenUntilStop = (() => {
        try {
          if (!(typeof holdTarget === 'number' && isFinite(holdTarget))) return false;
          if (isSkipActiveNow()) return false;
          return true;
        } catch {
          return false;
        }
      })();
      for (let row = 0; row < column.length; row++) {
        const symbol = column[row];
        if (!symbol) {
          completedAnimations++;
          if (completedAnimations === totalAnimations) {
            finalize();
          }
          continue;
        }

        try {
          (symbol as any).setVisible?.(true);
          if (!keepHiddenUntilStop) {
            const anySym: any = symbol as any;
            if (typeof anySym.__holdOriginalAlpha !== 'number') {
              anySym.alpha = 1;
            }
          }
        } catch {}

        const startIndex = row + START_INDEX_Y;
        symbol.y = getYPos(self, startIndex);

        try {
          const anySym: any = symbol as any;
          if (typeof anySym.__holdOriginalAlpha === 'number') {
            anySym.alpha = anySym.__holdOriginalAlpha;
            delete anySym.__holdOriginalAlpha;
          }
        } catch {}
        try { self.container?.bringToTop?.(symbol); } catch {}

        const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
        const mainDropDuration = isBuyFeatureSpin
          ? (self.scene.gameData.dropReelsDuration + extraMs)
          : ((self.scene.gameData.dropDuration * 0.9) + extraMs);

        const mainDropTweens = (() => {
          if (!isAnticipationLastReel) {
            return [{
              y: `+= ${DROP_DISTANCE}`,
              duration: mainDropDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            }];
          }

          const finalDist = Math.max(0, Math.round(DROP_DISTANCE * 0.15));
          const firstDist = Math.max(0, Math.round(DROP_DISTANCE - finalDist));
          const finalDur = Math.max(0, Math.round(mainDropDuration * 0.25));
          const firstDur = Math.max(0, Math.round(mainDropDuration - finalDur));

          return [
            {
              y: `+= ${firstDist}`,
              duration: firstDur,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `+= ${finalDist}`,
              duration: finalDur,
              ease: anticipationEase,
            }
          ];
        })();

        const settleDelta = isHeldAnticipationTarget ? 0 : 40;
        const settleDuration = isHeldAnticipationTarget ? 1 : (self.scene.gameData.dropDuration * 0.05);

        const winUpHeightForChain = winUpHeightForDrop;
        const winUpDurationForChain = (winUpHeightForChain > 0) ? self.scene.gameData.winUpDuration : 1;

        if (isBuyFeatureSpin) {
          self.scene.tweens.chain({
            targets: symbol,
            tweens: [
              {
                y: `-= ${winUpHeightForChain}`,
                duration: winUpDurationForChain,
                ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
              },
              ...mainDropTweens,
              {
                y: `+= ${settleDelta}`,
                duration: settleDuration,
                ease: (window as any).Phaser?.Math?.Easing?.Linear,
              },
              {
                y: `-= ${settleDelta}`,
                duration: settleDuration,
                ease: (window as any).Phaser?.Math?.Easing?.Linear,
                onComplete: () => {
                  completedAnimations++;
                  if (completedAnimations === totalAnimations) {
                    finalize();
                  }
                }
              }
            ]
          });
        } else {
          self.scene.tweens.chain({
            targets: symbol,
            tweens: [
              {
                y: `-= ${winUpHeightForChain}`,
                duration: winUpDurationForChain,
                ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
              },
              ...mainDropTweens,
              {
                y: `+= ${settleDelta}`,
                duration: settleDuration,
                ease: (window as any).Phaser?.Math?.Easing?.Linear,
              },
              {
                y: `-= ${settleDelta}`,
                duration: settleDuration,
                ease: (window as any).Phaser?.Math?.Easing?.Linear,
                onComplete: () => {
                  completedAnimations++;
                  if (completedAnimations === totalAnimations) {
                    finalize();
                  }
                }
              }
            ]
          });
        }
      }

      const applySkipToColumn = () => {
        try {
          if (skipApplied) return;
          skipApplied = true;
          try { destroyActiveFillerSymbols(self); } catch {}
          try {
            const prevCol = (self as any).symbols?.[index];
            if (Array.isArray(prevCol)) {
              for (const obj of prevCol) {
                if (!obj || (obj as any).destroyed) continue;
                try { self.scene?.tweens?.killTweensOf?.(obj); } catch {}
                try { (obj as any).alpha = 0; } catch {}
                try { (obj as any).setVisible?.(false); } catch {}
              }
            }
          } catch {}

          const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
          const baseDurationMs = isBuyFeatureSpin
            ? Number(self.scene?.gameData?.dropReelsDuration)
            : (Number(self.scene?.gameData?.dropDuration) * 0.9);
          const baseDurationSafe = (isFinite(baseDurationMs) && baseDurationMs > 0) ? baseDurationMs : 800;
          const startIndexBase = (Number(fillerCount) || 0) + SLOT_ROWS;
          const speedPxPerMs = (startIndexBase * height) / Math.max(1, baseDurationSafe);
          const padTop = Math.max(0, Number((self as any)?.gridMaskPaddingTop) || 0);
          const gridTop = (Number((self as any)?.slotY) || 0) - (Number((self as any)?.totalGridHeight) || 0) * 0.5;
          const maskTop = gridTop - padTop;
          const preDropY = maskTop + height * 0.5;

          for (let row = 0; row < column.length; row++) {
            const symbol = column[row];
            if (!symbol) {
              completedAnimations++;
              continue;
            }
            try { (symbol as any).setVisible?.(true); } catch {}
            try {
              const anySym: any = symbol as any;
              if (typeof anySym.__holdOriginalAlpha === 'number') {
                anySym.alpha = anySym.__holdOriginalAlpha;
                delete anySym.__holdOriginalAlpha;
              } else {
                anySym.alpha = 1;
              }
            } catch {}
            try { self.scene?.tweens?.killTweensOf?.(symbol); } catch {}
            try { self.container?.bringToTop?.(symbol); } catch {}

            const finalY = getYPos(self, row);
            const cy = Number((symbol as any).y) || 0;
            const startY = Math.max(cy, preDropY);
            try { (symbol as any).y = startY; } catch {}
            const dist = Math.max(0, finalY - startY);
            if (!(dist > 0)) {
              try { (symbol as any).y = finalY; } catch {}
              completedAnimations++;
              continue;
            }
            const dur = Math.max(60, Math.min(baseDurationSafe, Math.round(dist / Math.max(0.0001, speedPxPerMs))));
            try {
              self.scene?.tweens?.add?.({
                targets: symbol,
                y: finalY,
                duration: dur,
                ease: (window as any).Phaser?.Math?.Easing?.Linear,
                onComplete: () => {
                  try {
                    completedAnimations++;
                    if (completedAnimations >= totalAnimations) {
                      finalize();
                    }
                  } catch {}
                }
              });
            } catch {
              completedAnimations++;
            }
          }
          if (completedAnimations >= totalAnimations) {
            finalize();
          }
        } catch {}
      };

      const pollSkip = () => {
        try {
          if (skipApplied) return;
          if (completedAnimations >= totalAnimations) return;
          if (isSkipActiveNow()) {
            applySkipToColumn();
            return;
          }
          self.scene?.time?.delayedCall?.(16, pollSkip);
        } catch {}
      };
      try { self.scene?.time?.delayedCall?.(16, pollSkip); } catch {}
    };

    if (typeof holdTarget === 'number' && isFinite(holdTarget)) {
      const tickRelease = () => {
        if (!shouldReleaseHold()) {
          try {
            self.scene?.time?.delayedCall?.(16, () => {
              try { tickRelease(); } catch {}
            });
          } catch {
            try {
              setTimeout(() => {
                try { tickRelease(); } catch {}
              }, 16);
            } catch {}
          }
          return;
        }
        try {
          if (isSkipActiveNow()) {
            forceFinishFillersForReel(self, index);
          } else {
            try {
              const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
              const mainDropDuration = isBuyFeatureSpin
                ? (self.scene.gameData.dropReelsDuration + extraMs)
                : ((self.scene.gameData.dropDuration * 0.9) + extraMs);
              resetOtherHeldReelSpinnersToBase(self, index);
              stopHeldReelSpinner(self, index);
              spawnReleaseFillersForHeldReel(
                self,
                fillerCount,
                index,
                extraRows,
                DROP_DISTANCE,
                mainDropDuration,
                isAnticipationLastReel,
                anticipationEase,
                winUpHeightForDrop
              );
            } catch {}
          }
        } catch {}
        try { startDropTweens(); } catch {}
      };
      tickRelease();
    } else {
      startDropTweens();
    }

    function finalize() {
      try {
        if (!dropSfxPlayed && (window as any).audioManager) {
          dropSfxPlayed = true;
          const isTurbo = !!gameStateManager.isTurbo || !!self?.scene?.gameData?.isTurbo;
          if (!isTurbo) {
            (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
          }
        }
      } catch {}
      try {
        const keepHiddenUntilStop = (() => {
          try {
            if (!(typeof holdTarget === 'number' && isFinite(holdTarget))) return false;
            if (isSkipActiveNow()) return false;
            return true;
          } catch {
            return false;
          }
        })();
        if (keepHiddenUntilStop) {
          try { stopHeldReelSpinner(self, index); } catch {}
          try {
            const colArr = self.newSymbols?.[index];
            if (Array.isArray(colArr)) {
              for (const sym of colArr) {
                if (!sym) continue;
                try {
                  const anySym: any = sym as any;
                  if (typeof anySym.__holdOriginalAlpha === 'number') {
                    anySym.alpha = anySym.__holdOriginalAlpha;
                    delete anySym.__holdOriginalAlpha;
                  }
                } catch {}
              }
            }
          } catch {}
        }
      } catch {}
      try { detachFillersAfterReelStop(self, index); } catch {}
      // Trigger _idle animations for this reel's NEW symbols immediately after drop completion
      self.triggerIdleAnimationsForNewReel(index);

      try {
        anticipationController?.onReelStopped(index);
      } catch {}
      try {
        if (index === (SLOT_COLUMNS - 1)) {
          anticipationController?.finish();
        }
      } catch {}

      resolve();
    }
  });
}

function forceFinishFillersForReel(self: any, reelIndex: number): void {
  try {
		try { destroyActiveFillerSymbols(self, reelIndex); } catch {}
  } catch {}
}

function startHeldReelSpinner(self: any, fillerCount: number, reelIndex: number, extendDuration: boolean = false, stopStaggerMs: number = 0): void {
  try {
    const map = (self as any).__heldReelSpinners;
    const stateMap: any = (map && typeof map === 'object') ? map : ((self as any).__heldReelSpinners = {});
    if (stateMap[reelIndex]) return;

    const height = self.displayHeight + self.verticalSpacing;
    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;
    const x = startX + reelIndex * symbolTotalWidth + symbolTotalWidth * 0.5;

    const startY = self.slotY - self.totalGridHeight * 0.5;
    const topWrapEdge = startY - (height * 2);
    const bottomWrapEdge = startY + (SLOT_ROWS * height) + (height * 2);
    const count = Math.max(SLOT_ROWS + 6, SLOT_ROWS + 3);

    const sprites: any[] = [];
    for (let i = 0; i < count; i++) {
      const y = getYPos(self, (i - count));
      const s = createHeldSpinnerFillerSprite(self, x, y);
      if (!s) continue;
      try {
        applyHeldSpinnerSpriteSize(self, s);
      } catch {}
      try { self.container.add(s); } catch {}
      try { (s as any).__fillerReelIndex = reelIndex; } catch {}
      try { (s as any).__isHeldSpinnerFiller = true; } catch {}
      try { registerActiveFiller(self, s); } catch {}
      sprites.push(s);
    }

    const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
    const winUpHeight = Number(self.scene?.gameData?.winUpHeight) || 0;
    const baseTotal = Math.max(0, Number(fillerCount) || 0) + SLOT_ROWS;
    const baseDropMs = isBuyFeatureSpin
      ? Number(self.scene?.gameData?.dropReelsDuration)
      : (Number(self.scene?.gameData?.dropDuration) * 0.9);
    const baseDropMsSafe = (isFinite(baseDropMs) && baseDropMs > 0) ? baseDropMs : 800;
    const extraRows = 0;
    const totalItems = Math.max(0, Number(fillerCount) || 0) + SLOT_ROWS + extraRows;
    const dropDistance = totalItems * height + winUpHeight;
    const mainDropDuration = baseDropMsSafe;
    const baseSpeedPxPerMs = dropDistance / Math.max(1, mainDropDuration);
    let speedMultiplier = 1;
    let targetSpeedMultiplier = 1;
    let speedRampStartMultiplier = 1;
    let speedRampRemainingMs = 0;
    let speedRampTotalMs = 220;
    let speedRampEase: any = (window as any).Phaser?.Math?.Easing?.Linear;

    let kickActive = false;
    const applyKick = () => {
      try {
        if (kickActive) return;
        const wu = Number(self.scene?.gameData?.winUpHeight) || 0;
        const dur = Number(self.scene?.gameData?.winUpDuration) || 0;
        if (!(wu > 0) || !(dur > 0)) return;

        kickActive = true;
        try {
          for (const s of sprites) {
            if (!s || (s as any).destroyed) continue;
            try { self.scene?.tweens?.killTweensOf?.(s); } catch {}
          }
        } catch {}

        self.scene?.tweens?.add?.({
          targets: sprites,
          y: `-= ${wu}`,
          duration: dur,
          ease: (self.scene as any).Phaser?.Math?.Easing?.Circular?.Out || (window as any).Phaser?.Math?.Easing?.Circular?.Out || undefined,
          onComplete: () => {
            try { kickActive = false; } catch {}
          }
        });
      } catch {}
    };

    const updateCb = (_time: number, delta: number) => {
      try {
        const dtRaw = Number(delta);
        const dt = isFinite(dtRaw) ? Math.max(1, Math.min(100, dtRaw)) : 16;
        try {
          if (speedRampRemainingMs > 0) {
            const step = Math.min(speedRampRemainingMs, dt);
            speedRampRemainingMs -= step;
            const elapsed = Math.max(0, speedRampTotalMs - speedRampRemainingMs);
            const rawT = elapsed / Math.max(1, speedRampTotalMs);
            const t = Math.max(0, Math.min(1, rawT));
            const tt = (() => {
              try {
                return typeof speedRampEase === 'function' ? speedRampEase(t) : t;
              } catch {
                return t;
              }
            })();
            speedMultiplier = speedRampStartMultiplier + (targetSpeedMultiplier - speedRampStartMultiplier) * Math.max(0, Math.min(1, tt));
          } else {
            speedMultiplier = targetSpeedMultiplier;
          }
        } catch {}
        if (kickActive) return;
        for (const s of sprites) {
          if (!s || (s as any).destroyed) continue;
          try { s.y = (s.y as number) + (baseSpeedPxPerMs * speedMultiplier) * dt; } catch {}
          try {
            if (((s.y as number) - height * 0.5) > bottomWrapEdge) {
              s.y = (s.y as number) - count * height;
              randomizeHeldSpinnerSpriteTexture(self, s);
            }
          } catch {}
        }
      } catch {}
    };
    try { self.scene?.events?.on?.('update', updateCb); } catch {}

    stateMap[reelIndex] = {
      timer: null,
      sprites,
      __heldSpinnerUpdateCb: updateCb,
      __heldSpinnerScene: self.scene,
      __heldSpinnerDecelTimer: null,
      __heldSpinnerSetTargetMultiplier: (m: number, rampMs: number, ease?: any) => {
        try {
          const mm = isFinite(m) ? Math.max(0, Math.min(4, m)) : 1;
          speedRampStartMultiplier = speedMultiplier;
          targetSpeedMultiplier = mm;
          const rm = Math.max(0, Number(rampMs) || 0);
          speedRampTotalMs = Math.max(1, rm || 220);
          speedRampRemainingMs = rm;
          speedRampEase = typeof ease === 'function'
            ? ease
            : ((window as any).Phaser?.Math?.Easing?.Linear);
        } catch {}
      },
      __heldSpinnerKick: () => {
        try {
          const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
          const isSkipActive = hasIsSkipFn
            ? !!(self as any).isSkipReelDropsActive()
            : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
          if (isSkipActive) return;
        } catch {}
        try { applyKick(); } catch {}
      }
    };

    try { applyKick(); } catch {}
  } catch {}
}

function boostHeldReelSpinnerForAnticipation(self: any, reelIndex: number, extendDuration: boolean): void {
  try {
    const stateMap: any = (self as any).__heldReelSpinners;
    const st = stateMap?.[reelIndex];
    if (!st) return;
    const fn = st.__heldSpinnerSetTargetMultiplier;
    if (typeof fn !== 'function') return;

    let mult = extendDuration ? 1.35 : 1.2;
    try {
      const isTurbo = !!(self.scene?.gameData?.isTurbo || (gameStateManager as any)?.isTurbo);
      if (isTurbo) mult *= 1.15;
    } catch {}
    fn(mult, 240);
  } catch {}
}

function resetOtherHeldReelSpinnersToBase(self: any, keepReelIndex: number): void {
	try {
		const stateMap: any = (self as any).__heldReelSpinners;
		if (!stateMap || typeof stateMap !== 'object') return;
		for (const k of Object.keys(stateMap)) {
			const idx = Number(k);
			if (!isFinite(idx) || idx === keepReelIndex) continue;
			const st = stateMap[idx];
			const fn = st?.__heldSpinnerSetTargetMultiplier;
			if (typeof fn !== 'function') continue;
			try { fn(1, 120); } catch {}
		}
	} catch {}
}

function kickHeldReelSpinner(self: any, reelIndex: number): void {
  try {
    const stateMap: any = (self as any).__heldReelSpinners;
    const st = stateMap?.[reelIndex];
    const fn = st?.__heldSpinnerKick;
    if (typeof fn !== 'function') return;
    fn();
  } catch {}
}

function stopHeldReelSpinner(self: any, reelIndex: number): void {
  try {
    const stateMap: any = (self as any).__heldReelSpinners;
    if (!stateMap || typeof stateMap !== 'object') return;
    const st = stateMap[reelIndex];
    if (!st) return;
    try {
      const decel = (st as any).__heldSpinnerDecelTimer;
      decel?.remove?.(false);
      decel?.destroy?.();
    } catch {}
    try {
      const cb = (st as any).__heldSpinnerUpdateCb;
      const sc = (st as any).__heldSpinnerScene;
      if (typeof cb === 'function') {
        try { sc?.events?.off?.('update', cb); } catch {}
      }
    } catch {}
    try { st.timer?.destroy?.(); } catch {}
    try { st.timer?.remove?.(false); } catch {}
    const sprites: any[] = Array.isArray(st.sprites) ? st.sprites : [];
    for (const s of sprites) {
      if (!s || (s as any).destroyed) continue;
      try { self.scene?.tweens?.killTweensOf?.(s); } catch {}
      try { unregisterActiveFiller(self, s); } catch {}
      try { s.destroy?.(); } catch {}
    }
    try { delete stateMap[reelIndex]; } catch {}
  } catch {}
}

function stopAllHeldReelSpinners(self: any): void {
  try {
    const stateMap: any = (self as any).__heldReelSpinners;
    if (!stateMap || typeof stateMap !== 'object') return;
    const keys = Object.keys(stateMap);
    for (const k of keys) {
      const idx = Number(k);
      if (!isFinite(idx)) continue;
      try { stopHeldReelSpinner(self, idx); } catch {}
    }
  } catch {}
}

function createHeldSpinnerFillerSprite(self: any, x: number, y: number): any {
  try {
    const pick = pickRandomHeldSpinnerSpritePick(self);
    const key = pick?.key;
    if (!key) return null;
    const s = self.scene.add.sprite(x, y, key);
    try { (s as any).__heldSpinnerVisual = pick?.visual; } catch {}
    try { applyHeldSpinnerSpriteSize(self, s); } catch {}
    return s;
  } catch {
    return null;
  }
}

function pickRandomHeldSpinnerSpritePick(self: any): any {
  try {
    const fillerPool: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const symbolId = fillerPool[Math.floor(Math.random() * fillerPool.length)];
    let spriteKey: string | null = null;
    const visual = symbolId;
    if (symbolId === 5) {
      try {
        const variant = getRandomSymbol5Variant();
        spriteKey = getSymbol5ImageKeyForVariant(variant);
      } catch {
        spriteKey = 'symbol_5';
      }
    } else {
      spriteKey = 'symbol_' + symbolId;
    }
    try {
      if (spriteKey && self.scene.textures.exists(spriteKey)) return { key: spriteKey, visual };
    } catch {}
    try {
      if (self.scene.textures.exists('symbol_0')) return { key: 'symbol_0', visual: 0 };
    } catch {}
    return { key: null, visual: 0 };
  } catch {
    return { key: null, visual: 0 };
  }
}

function randomizeHeldSpinnerSpriteTexture(self: any, sprite: any): void {
  try {
    const pick = pickRandomHeldSpinnerSpritePick(self);
    const key = pick?.key;
    if (!key || !sprite) return;
    try { sprite.setTexture?.(key); } catch {}
    try { (sprite as any).__heldSpinnerVisual = pick?.visual; } catch {}
    try { applyHeldSpinnerSpriteSize(self, sprite); } catch {}
  } catch {}
}

function applyHeldSpinnerSpriteSize(self: any, sprite: any): void {
  try {
    if (!sprite) return;
    try { sprite.displayWidth = self.displayWidth; } catch {}
    try { sprite.displayHeight = self.displayHeight; } catch {}
  } catch {}
}

function detachFillersAfterReelStop(self: any, reelIndex: number, attempt: number = 0): void {
  try {
    const arr = (self as any).__activeFillerSymbols;
    if (!Array.isArray(arr) || arr.length === 0) return;

    const height = self.displayHeight + self.verticalSpacing;
    const maskBottomPad = Math.max(0, Number((self as any)?.gridMaskPaddingBottom) || 0);
    const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
    const maxWaitMs = isBuyFeatureSpin
      ? (Number(self.scene?.gameData?.winUpDuration) || 0) + (Number(self.scene?.gameData?.dropReelsDuration) || 0) + 4200
      : (Number(self.scene?.gameData?.winUpDuration) || 0) + (Number(self.scene?.gameData?.dropDuration) || 0) + 2200;

    const candidates = arr.filter((s: any) => s && !(s as any).destroyed && (s as any).__fillerReelIndex === reelIndex);
    if (!candidates || candidates.length === 0) return;

    const notReady = candidates.some((s: any) => !(s as any).__fillerDropDone);
    if (notReady && (attempt * 16) < maxWaitMs) {
      try {
        self.scene?.time?.delayedCall?.(16, () => {
          try { detachFillersAfterReelStop(self, reelIndex, attempt + 1); } catch {}
        });
      } catch {}
      return;
    }

    for (const s of candidates) {
      if (!s || (s as any).destroyed) continue;
      try { self.scene?.tweens?.killTweensOf?.(s); } catch {}
      try {
        const bottomEdge = (Number(self.slotY) || 0) + (Number(self.totalGridHeight) || 0) * 0.5 + maskBottomPad;
        const currentY = Number(s.y) || 0;
        const pxPerMsRaw = Number((s as any)?.__fillerPxPerMs);
        const basePxPerMs = (isFinite(pxPerMsRaw) && pxPerMsRaw > 0)
          ? pxPerMsRaw
          : (height / 16);
        const pxPerMs = basePxPerMs * 0.50;
        const targetY = Math.max(bottomEdge + height, currentY + height);
        const dist = Math.max(0, targetY - currentY);
        const computedDuration = Math.max(1, Math.round(dist / Math.max(0.0001, pxPerMs)));
        const duration = Math.max(80, Math.min(isBuyFeatureSpin ? 1000 : 900, computedDuration));

        if (!(dist > 0)) {
          try { unregisterActiveFiller(self, s); } catch {}
          try { s?.destroy?.(); } catch {}
          continue;
        }

        self.scene?.tweens?.add?.({
          targets: s,
          y: targetY,
          duration,
          ease: (window as any).Phaser?.Math?.Easing?.Linear,
          onComplete: () => {
            try { unregisterActiveFiller(self, s); } catch {}
            try { s?.destroy?.(); } catch {}
          }
        });
      } catch {
        try { unregisterActiveFiller(self, s); } catch {}
        try { s?.destroy?.(); } catch {}
      }
    }
  } catch {}
}

function getYPos(self: any, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;
  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}

function registerActiveFiller(self: any, symbol: any): void {
  try {
    if (!symbol) return;
    (symbol as any).__isReelFillerSymbol = true;
    try {
      // Only suppress filler visibility during the special Buy Feature anticipation window.
      // In normal spins, fillers should remain visible to preserve classic slot feel.
      if (
        !!gameStateManager.isBuyFeatureSpin &&
        !!(self.scene as any)?.__isScatterAnticipationOverlayVisible &&
        (symbol as any).__fillerReelIndex !== (SLOT_COLUMNS - 1)
      ) {
        try { symbol.setAlpha?.(0.6); } catch {}
      }
    } catch {}
    const arr = (self as any).__activeFillerSymbols;
    if (Array.isArray(arr)) {
      arr.push(symbol);
    } else {
      (self as any).__activeFillerSymbols = [symbol];
    }
  } catch {}
}

function unregisterActiveFiller(self: any, symbol: any): void {
  try {
    const arr = (self as any).__activeFillerSymbols;
    if (!Array.isArray(arr) || !symbol) return;
    const idx = arr.indexOf(symbol);
    if (idx >= 0) arr.splice(idx, 1);
  } catch {}
}

function hideActiveFillers(self: any): void {
  try {
    // Only hide fillers during Buy Feature anticipation. Regular spins should show fillers.
    if (!gameStateManager.isBuyFeatureSpin) return;
    const arr = (self as any).__activeFillerSymbols;
    if (!Array.isArray(arr) || arr.length === 0) return;
    for (const s of arr) {
      if (!s || (s as any).destroyed) continue;
      // Do not hide last-reel fillers mid-drop; last reel can be extended during anticipation.
      if ((s as any).__fillerReelIndex === (SLOT_COLUMNS - 1)) continue;
      try { s.setAlpha?.(0.6); } catch {}
    }
  } catch {}
}

async function delay(duration: number, shouldCancel?: () => boolean) {
	// The duration should already be turbo-adjusted from the backend
	// No need to apply turbo mode again here
  console.log(`[ReelDropScript] Delay: ${duration}ms (should already be turbo-adjusted), turbo state: ${gameStateManager.isTurbo}`);

  return new Promise((resolve) => {
    const ms = Math.max(0, Number(duration) || 0);
    const start = Date.now();
    const tick = () => {
      try {
        if (typeof shouldCancel === 'function' && shouldCancel()) {
          resolve(true);
          return;
        }
      } catch {}
      const elapsed = Date.now() - start;
      if (elapsed >= ms) {
        resolve(true);
        return;
      }
      setTimeout(tick, 16);
    };
    tick();
  });
}
