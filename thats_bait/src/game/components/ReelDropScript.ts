import { Data } from "../../tmp_backend/Data";
import { GameData } from "./GameData";
import { gameStateManager } from "../../managers/GameStateManager";
import { SLOT_ROWS, SLOT_COLUMNS } from "../../config/GameConfig";
import { SoundEffectType } from "../../managers/AudioManager";
import { getRandomSymbol5Variant, getSymbol5ImageKeyForVariant } from "./Symbol5VariantHelper";

/**
 * Run the reel-drop sequence, including previous symbols, filler symbols, and new symbols.
 * This is extracted from Symbols.ts so it can be reused as an independent script.
 */
export async function runDropReels(self: any, data: Data, fillerCount: number): Promise<void> {
  // Play turbo drop sound effect at the start of reel drop sequence when in turbo mode
  try {
    if (self.scene.gameData.isTurbo && (window as any).audioManager) {
      (window as any).audioManager.playSoundEffect(SoundEffectType.TURBO_DROP);
      console.log("[ReelDropScript] Playing turbo drop sound effect at start of reel drop sequence");
    }
  } catch {}

  const reelCompletionPromises: Promise<void>[] = [];

  // Anticipation: if upcoming SpinData shows a scatter on 1st or 3rd columns (x = 0 or 2),
  // extend only the last reel's animation (x = SLOT_ROWS - 1)
  let extendLastReelDrop = false;
  try {
    const s: number[][] = data.symbols || [];
    // symbols is [column][row]. Horizontal reels correspond to row indices.
    const scatterVal = (Data as any).SCATTER[0];
    const hasScatterCol1 = s.some(col => Array.isArray(col) && col[0] === scatterVal);
    const hasScatterCol3 = s.some(col => Array.isArray(col) && col[2] === scatterVal);
    extendLastReelDrop = !!(hasScatterCol1 && hasScatterCol3);
    console.log(`[ReelDropScript] Anticipation check (reel 1 AND reel 3 scatter): r1=${hasScatterCol1}, r3=${hasScatterCol3} → extend=${extendLastReelDrop}`);
  } catch (e) {
    console.warn("[ReelDropScript] Anticipation check failed:", e);
    extendLastReelDrop = false;
  }

  // Persist anticipation state on scene for cross-function checks
  try { (self.scene as any).__isScatterAnticipationActive = extendLastReelDrop; } catch {}

  for (let row = 0; row < SLOT_ROWS; row++) {
    console.log(`[ReelDropScript] Processing row ${row}`);
    const isLastReel = row === (SLOT_ROWS - 1);
    dropPrevSymbols(self, fillerCount, row, isLastReel && extendLastReelDrop);
    dropFillers(self, fillerCount, row, isLastReel && extendLastReelDrop);
    const reelPromise = dropNewSymbols(self, fillerCount, row, isLastReel && extendLastReelDrop);
    reelCompletionPromises.push(reelPromise);
    const delayMs = self.scene.gameData?.dropReelsDelay ?? 0;
    if (delayMs > 0) {
      await delay(delayMs);
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
    gd.winUpDuration = Math.max(1, Math.floor(gd.winUpDuration * 0.1));
  } catch (e) {
    console.warn("[ReelDropScript] Failed to apply skip reel tweaks:", e);
  }
}

function dropPrevSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

  // Check if symbols array has valid structure
  if (!self.symbols[0] || !self.symbols[0][0]) {
    console.warn("[ReelDropScript] dropPrevSymbols: symbols array structure is invalid, skipping");
    return;
  }

  // Use the canonical grid cell height instead of sampling from a specific symbol,
  // because individual symbol displayHeight can change after win animations.
  const height = self.displayHeight + self.verticalSpacing;
  const baseDropDistance = fillerCount * height + self.scene.gameData.winUpHeight;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropReelsDuration;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const DROP_DISTANCE = (fillerCount + extraRows) * height + self.scene.gameData.winUpHeight;

  for (let i = 0; i < self.symbols.length; i++) {
    // Check if the current row exists and has the required index
    if (!self.symbols[i] || !self.symbols[i][index]) {
      console.warn(`[ReelDropScript] dropPrevSymbols: skipping invalid row ${i} or index ${index}`);
      continue;
    }

    self.scene.tweens.chain({
      targets: self.symbols[i][index],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: (self.scene as any).Phaser?.Math?.Easing?.Circular?.Out || (window as any).Phaser?.Math?.Easing?.Circular?.Out || undefined,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropReelsDuration + extraMs,
          ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1))
            ? (window as any).Phaser?.Math?.Easing?.Cubic?.Out
            : (window as any).Phaser?.Math?.Easing?.Bounce?.Out,
        },
      ],
    });
  }
}

function dropFillers(self: any, fillerCount: number, index: number, extendDuration: boolean = false) {
  // Check if symbols array has valid structure
  if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
    console.warn("[ReelDropScript] dropFillers: symbols array structure is invalid, skipping");
    return;
  }

  const height = self.displayHeight + self.verticalSpacing;
  const baseTotal = fillerCount + SLOT_COLUMNS;
  const baseDropDistance = baseTotal * height + GameData.WIN_UP_HEIGHT;
  const extraMs = extendDuration ? 3000 : 0;
  const baseDropMs = self.scene.gameData.dropDuration * 0.9;
  const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
  const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
  const TOTAL_ITEMS = fillerCount + SLOT_COLUMNS + extraRows;
  const EXTRA_VISUAL_ROWS = 4;
  const DROP_DISTANCE = (TOTAL_ITEMS + EXTRA_VISUAL_ROWS) * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: any[] = [];

  for (let i = 0; i < TOTAL_ITEMS - SLOT_COLUMNS; i++) {
    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -(TOTAL_ITEMS - SLOT_COLUMNS);
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
      const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
      if (isAnticipation && index === (SLOT_ROWS - 1)) {
        try { (self as any).ensureScatterForegroundContainer?.(); } catch {}
        const fg: Phaser.GameObjects.Container | undefined = (self as any).scatterForegroundContainer;
        if (fg && typeof fg.add === "function") {
          fg.add(symbol);
          try { (fg as any).sendToBack?.(symbol as any); } catch {}
          try { (self.scene as any)?.children?.bringToTop?.(fg); } catch {}
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
          ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
          ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1))
            ? (window as any).Phaser?.Math?.Easing?.Cubic?.Out
            : (window as any).Phaser?.Math?.Easing?.Linear,
        },
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
            try { fillerSymbols[i].destroy(); } catch {}
          }
        }
      ]
    });
  }
}

function dropNewSymbols(self: any, fillerCount: number, index: number, extendDuration: boolean = false): Promise<void> {
  return new Promise<void>((resolve) => {
    // Check if symbols array has valid structure
    if (!self.symbols || !self.symbols[0] || !self.symbols[0][0]) {
      console.warn("[ReelDropScript] dropNewSymbols: symbols array structure is invalid, resolving immediately");
      resolve();
      return;
    }

    // Base drop distances on the canonical grid cell height so that new symbols
    // land exactly in their cell centers under the mask, independent of any
    // per-symbol scale tweaks from previous spins.
    const height = self.displayHeight + self.verticalSpacing;
    const START_INDEX_BASE = fillerCount + SLOT_COLUMNS;
    const baseDropDistance = START_INDEX_BASE * height + self.scene.gameData.winUpHeight;
    const extraMs = extendDuration ? 3000 : 0;
    const baseDropMs = self.scene.gameData.dropDuration * 0.9;
    const extraPixels = extraMs > 0 && baseDropMs > 0 ? (baseDropDistance * (extraMs / baseDropMs)) : 0;
    const extraRows = extraPixels > 0 ? Math.ceil(extraPixels / height) : 0;
    const START_INDEX = START_INDEX_BASE + extraRows;
    const DROP_DISTANCE = START_INDEX * height + self.scene.gameData.winUpHeight;

    let completedAnimations = 0;
    const totalAnimations = self.newSymbols.length;
    const START_INDEX_Y = -(fillerCount + SLOT_COLUMNS + extraRows);

    for (let col = 0; col < self.newSymbols.length; col++) {
      const symbol = self.newSymbols[col][index];
      if (!symbol) {
        completedAnimations++;
        if (completedAnimations === totalAnimations) {
          finalize();
        }
        continue;
      }

      const startIndex = col + START_INDEX_Y;
      symbol.y = getYPos(self, startIndex);

      self.scene.tweens.chain({
        targets: symbol,
        tweens: [
          {
            y: `-= ${self.scene.gameData.winUpHeight}`,
            duration: self.scene.gameData.winUpDuration,
            ease: (window as any).Phaser?.Math?.Easing?.Circular?.Out,
          },
          {
            y: `+= ${DROP_DISTANCE}`,
            duration: (self.scene.gameData.dropDuration * 0.9) + extraMs,
            ease: (((self.scene as any)?.__isScatterAnticipationActive) && index === (SLOT_ROWS - 1))
              ? (window as any).Phaser?.Math?.Easing?.Cubic?.Out
              : (window as any).Phaser?.Math?.Easing?.Linear,
          },
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
                if (!self.scene.gameData.isTurbo && (window as any).audioManager) {
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

    function finalize() {
      // Trigger _idle animations for this reel's NEW symbols immediately after drop completion
      self.triggerIdleAnimationsForNewReel(index);

      // Scatter anticipation show/hide logic mirrors existing behaviour
      try {
        const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
        if (isAnticipation && index === 2) {
          if (self.overlayRect) {
            if (self.baseOverlayRect) {
              self.scene.tweens.add({
                targets: self.baseOverlayRect,
                alpha: 0,
                duration: 300,
                ease: "Cubic.easeOut"
              });
            }
            self.overlayRect.setAlpha(0);
            self.overlayRect.setVisible(true);
            self.scene.tweens.add({
              targets: self.overlayRect,
              alpha: 0.85,
              duration: 500,
              ease: "Cubic.easeOut"
            });
          }
          const sa = (self.scene as any)?.scatterAnticipation;
          if (sa && typeof sa.show === "function") { sa.show(); }
          const sa2 = (self.scene as any)?.scatterAnticipation2;
          if (sa2 && typeof sa.show === "function") { sa2.show(); }
          console.log("[ReelDropScript] Scatter anticipation shown after 3rd reel drop");
        }
      } catch {}

      try {
        const isAnticipation = !!(self.scene as any)?.__isScatterAnticipationActive;
        if (isAnticipation && index === (SLOT_ROWS - 1)) {
          const sa = (self.scene as any)?.scatterAnticipation;
          if (sa && typeof sa.hide === "function") { sa.hide(); }
          const sa2 = (self.scene as any)?.scatterAnticipation2;
          if (sa2 && typeof sa.hide === "function") { sa2.hide(); }
          if (self.overlayRect) {
            self.scene.tweens.add({
              targets: self.overlayRect,
              alpha: 0,
              duration: 300,
              ease: "Cubic.easeIn",
              onComplete: () => {
                try { self.overlayRect.setVisible(false); } catch {}
              }
            });
            if (self.baseOverlayRect) {
              self.baseOverlayRect.setAlpha(0);
              self.baseOverlayRect.setVisible(true);
              self.scene.tweens.add({
                targets: self.baseOverlayRect,
                alpha: 0.2,
                duration: 300,
                ease: "Cubic.easeOut"
              });
            }
          }
          console.log("[ReelDropScript] Scatter anticipation hidden after last reel drop");
          (self.scene as any).__isScatterAnticipationActive = false;
        }
      } catch {}

      resolve();
    }
  });
}

function getYPos(self: any, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;
  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
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
