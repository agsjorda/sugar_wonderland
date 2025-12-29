import { GameData } from "./GameData";
import { gameStateManager } from "../../managers/GameStateManager";
import { SLOT_ROWS, SLOT_COLUMNS } from "../../config/GameConfig";
import { SoundEffectType } from "../../managers/AudioManager";
import { getRandomSymbol5Variant, getSymbol5ImageKeyForVariant } from "./Symbol5VariantHelper";
import { ScatterAnticipationSequenceController } from "./ScatterAnticipationSequenceController";

/**
 * Run the reel-drop sequence, including previous symbols, filler symbols, and new symbols.
 * This is extracted from Symbols.ts so it can be reused as an independent script.
 */
export async function runDropReels(self: any, symbols: number[][], fillerCount: number): Promise<void> {
  // Play turbo drop sound effect at the start of reel drop sequence when in turbo mode
  try {
    if (self.scene.gameData.isTurbo && (window as any).audioManager) {
      (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
      console.log("[ReelDropScript] Playing turbo drop sound effect at start of reel drop sequence");
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
  const useSequentialStartForBuyAnticipation = !!gameStateManager.isBuyFeatureSpin && extendLastReelDrop;
  let sequentialStartDelayMs = REEL_STAGGER_MS;
  try {
    const hasIsSkipFn = typeof (self as any)?.isSkipReelDropsActive === 'function';
    const isSkipActive = hasIsSkipFn
      ? !!(self as any).isSkipReelDropsActive()
      : !!((self as any)?.skipReelDropsPending || (self as any)?.skipReelDropsActive);
    if (isSkipActive) {
      sequentialStartDelayMs = 0;
    }
  } catch {}

  for (let col = 0; col < SLOT_COLUMNS; col++) {
    console.log(`[ReelDropScript] Processing reel ${col}`);
    const extendThisReel = !!extendReels?.[col];

    const stopStaggerMs = useSequentialStartForBuyAnticipation ? 0 : Math.max(0, col * REEL_STAGGER_MS);

    dropPrevSymbols(self, fillerCount, col, extendThisReel, stopStaggerMs);
    dropFillers(self, fillerCount, col, extendThisReel, stopStaggerMs);
    const reelPromise = dropNewSymbols(self, fillerCount, col, extendThisReel, stopStaggerMs, anticipationController);
    reelCompletionPromises.push(reelPromise);

    if (useSequentialStartForBuyAnticipation && sequentialStartDelayMs > 0 && col < (SLOT_COLUMNS - 1)) {
      await delay(sequentialStartDelayMs);
    }
  }

  // Wait for all reel animations to complete
  console.log("[ReelDropScript] Waiting for all reels to complete animation...");
  await Promise.all(reelCompletionPromises);
  console.log("[ReelDropScript] All reels have completed animation");
}

/**
 * Apply skip-reel tweaks: speed up symbol-related tweens and shrink drop delays/durations.
 * Extracted from Symbols.requestSkipReelDrops for reuse.
 */
export function applySkipReelTweaks(self: any, gd: GameData, timeScale: number): void {
  try {
    // Speed up only symbol-related tweens (avoid global tween timeScale to not affect logo breathing)
    const accel = (obj: any) => {
      try {
        const tweens = self.scene.tweens.getTweensOf(obj) as any[];
        if (Array.isArray(tweens)) {
          for (const t of tweens) {
            try { (t as any).timeScale = Math.max(1, timeScale); } catch {}
          }
        }
      } catch {}
    };

    // Existing symbols
    try {
      if (self.symbols) {
        for (let c = 0; c < self.symbols.length; c++) {
          const col = self.symbols[c];
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
      if (self.newSymbols) {
        for (let c = 0; c < self.newSymbols.length; c++) {
          const col = self.newSymbols[c];
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
      const list: any[] = (self.container as any)?.list || [];
      for (const child of list) accel(child);
    } catch {}

    // Foreground scatter container (anticipation overlays)
    try {
      const list: any[] = (self.scatterForegroundContainer as any)?.list || [];
      for (const child of list) accel(child);
    } catch {}

    // Overlays
    try { if (self.overlayRect) accel(self.overlayRect); } catch {}
    try { if (self.baseOverlayRect) accel(self.baseOverlayRect); } catch {}

    // Reduce any further delays/durations used by drop logic
    gd.dropReelsDelay = 0;
    gd.dropDuration = Math.max(1, Math.floor(gd.dropDuration * 0.1));
    gd.dropReelsDuration = Math.max(1, Math.floor(gd.dropReelsDuration * 0.1));
    gd.winUpDuration = Math.max(1, Math.floor(gd.winUpDuration * 0.1));
  } catch (e) {
    console.warn("[ReelDropScript] Failed to apply skip reel tweaks:", e);
  }
}

function dropPrevSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false, stopStaggerMs: number = 0) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

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
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
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

function dropFillers(self: any, fillerCount: number, index: number, extendDuration: boolean = false, stopStaggerMs: number = 0) {
  // Check if symbols array has valid structure
  if (!Array.isArray(self.symbols) || self.symbols.length === 0 || !Array.isArray(self.symbols[0]) || self.symbols[0].length === 0) {
    console.warn("[ReelDropScript] dropFillers: symbols array structure is invalid, skipping");
    return;
  }

  const isBuyFeatureSpin = !!gameStateManager.isBuyFeatureSpin;
  const isAnticipationLastReel = !!extendDuration && !!(self.scene as any)?.__isScatterAnticipationActive;
  const anticipationEase = (window as any).Phaser?.Math?.Easing?.Cubic?.Out
    || (window as any).Phaser?.Math?.Easing?.Quadratic?.Out
    || (window as any).Phaser?.Math?.Easing?.Linear;

  const height = self.displayHeight + self.verticalSpacing;
  const maskBottomPad = Math.max(0, Number((self as any)?.gridMaskPaddingBottom) || 0);
  const baseTotal = fillerCount + SLOT_ROWS;
  const baseDropDistance = baseTotal * height + GameData.WIN_UP_HEIGHT;
  const extraMs = (extendDuration ? 3000 : 0) + Math.max(0, stopStaggerMs);
  const baseDropMs = isBuyFeatureSpin ? self.scene.gameData.dropReelsDuration : (self.scene.gameData.dropDuration * 0.9);
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const TOTAL_ITEMS = fillerCount + SLOT_ROWS + extraRows;
  const EXTRA_VISUAL_ROWS = 0;
  const DROP_DISTANCE = (TOTAL_ITEMS + EXTRA_VISUAL_ROWS) * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: any[] = [];

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

  for (let i = 0; i < TOTAL_ITEMS - SLOT_ROWS; i++) {
    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_ROWS);
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y);

    // Restrict filler symbols to those that have dedicated WEBP icons in assets/portrait/high/symbols
    const fillerPool: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,];
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

    const hasSprite = spriteKey ? self.scene.textures.exists(spriteKey) : false;

    // Always try to use the lightweight WEBP symbol sprites for fillers when available
    if (hasSprite) {
      try {
        symbol = self.scene.add.sprite(x, y, spriteKey as string);
        symbol.displayWidth = self.displayWidth;
        symbol.displayHeight = self.displayHeight;
      } catch (e) {
        console.warn(`[ReelDropScript] Failed to create sprite filler symbol ${symbolId} from key ${spriteKey}:`, e);
        symbol = null as any;
      }
    }

    // If we failed to create a symbol, skip adding it to containers/tweens entirely
    if (!symbol) {
      console.warn(`[ReelDropScript] No WEBP sprite texture for filler symbol ${symbolId} (key=${spriteKey}) - skipping filler.`);
      continue;
    }

    try {
      self.container.add(symbol);
    } catch {}

    try { (symbol as any).__fillerReelIndex = index; } catch {}
    try { registerActiveFiller(self, symbol); } catch {}

    fillerSymbols.push(symbol);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    if (isBuyFeatureSpin) {
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
            y: `+= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: (window as any).Phaser?.Math?.Easing?.Linear,
          },
          {
            y: `-= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: (window as any).Phaser?.Math?.Easing?.Linear,
            onComplete: () => {
              try { (fillerSymbols[i] as any).__fillerDropDone = true; } catch {}
            }
          }
        ]
      });
    } else {
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
            y: `+= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: (window as any).Phaser?.Math?.Easing?.Linear,
          },
          {
            y: `-= ${40}`,
            duration: self.scene.gameData.dropDuration * 0.05,
            ease: (window as any).Phaser?.Math?.Easing?.Linear,
            onComplete: () => {
              try { (fillerSymbols[i] as any).__fillerDropDone = true; } catch {}
            }
          }
        ]
      });
    }
  }
}

function dropNewSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false, stopStaggerMs: number = 0, anticipationController?: ScatterAnticipationSequenceController | null): Promise<void> {
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
    const baseDropDistance = START_INDEX_BASE * height + self.scene.gameData.winUpHeight;
    const extraMs = (extendDuration ? 3000 : 0) + Math.max(0, stopStaggerMs);
    const baseDropMs = (!!gameStateManager.isBuyFeatureSpin) ? self.scene.gameData.dropReelsDuration : (self.scene.gameData.dropDuration * 0.9);
    const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
    const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
    const START_INDEX = START_INDEX_BASE + extraRows;
    const DROP_DISTANCE = START_INDEX * height + self.scene.gameData.winUpHeight;

    const isAnticipationLastReel = !!extendDuration && !!(self.scene as any)?.__isScatterAnticipationActive;
    const anticipationEase = (window as any).Phaser?.Math?.Easing?.Cubic?.Out
      || (window as any).Phaser?.Math?.Easing?.Quadratic?.Out
      || (window as any).Phaser?.Math?.Easing?.Linear;

    let completedAnimations = 0;
    const column = self.newSymbols?.[index];
    const totalAnimations = Array.isArray(column) ? column.length : 0;
    const START_INDEX_Y = -(fillerCount + SLOT_ROWS + extraRows);

    if (!Array.isArray(column) || totalAnimations === 0) {
      finalize();
      return;
    }

    for (let row = 0; row < column.length; row++) {
      const symbol = column[row];
      if (!symbol) {
        completedAnimations++;
        if (completedAnimations === totalAnimations) {
          finalize();
        }
        continue;
      }

      const startIndex = row + START_INDEX_Y;
      symbol.y = getYPos(self, startIndex);

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

      if (isBuyFeatureSpin) {
        self.scene.tweens.chain({
          targets: symbol,
          tweens: [
            {
              y: `-= ${self.scene.gameData.winUpHeight}`,
              duration: self.scene.gameData.winUpDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
            },
            ...mainDropTweens,
            {
              y: `+= ${40}`,
              duration: self.scene.gameData.dropDuration * 0.05,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `-= ${40}`,
              duration: self.scene.gameData.dropDuration * 0.05,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
              onComplete: () => {
                // Play reel drop sound effect only when turbo mode is off
                try {
                  if ((window as any).audioManager) {
                    (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                    console.log(`[ReelDropScript] Playing reel drop sound effect for reel ${index} after drop completion`);
                  }
                } catch {}

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
              y: `-= ${self.scene.gameData.winUpHeight}`,
              duration: self.scene.gameData.winUpDuration,
              ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
            },
            ...mainDropTweens,
            {
              y: `+= ${40}`,
              duration: self.scene.gameData.dropDuration * 0.05,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
            },
            {
              y: `-= ${40}`,
              duration: self.scene.gameData.dropDuration * 0.05,
              ease: (window as any).Phaser?.Math?.Easing?.Linear,
              onComplete: () => {
                // Play reel drop sound effect only when turbo mode is off
                try {
                  if ((window as any).audioManager) {
                    (window as any).audioManager.playSoundEffect(SoundEffectType.REEL_DROP);
                    console.log(`[ReelDropScript] Playing reel drop sound effect for reel ${index} after drop completion`);
                  }
                } catch {}

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

    function finalize() {
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
        self.scene?.tweens?.add?.({
          targets: s,
          y: (s.y as number) + (height * 1.75) + maskBottomPad,
          alpha: 0,
          duration: isBuyFeatureSpin ? 380 : 300,
          ease: 'Cubic.easeIn',
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

async function delay(duration: number) {
  // The duration should already be turbo-adjusted from the backend
  // No need to apply turbo mode again here
  console.log(`[ReelDropScript] Delay: ${duration}ms (should already be turbo-adjusted), turbo state: ${gameStateManager.isTurbo}`);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}
