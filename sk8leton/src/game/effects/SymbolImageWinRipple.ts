import Phaser from 'phaser';

function getSymbolWorldCenter(symbol: any): { x: number; y: number } {
  try {
    if (symbol && typeof symbol.getBounds === 'function') {
      const b = symbol.getBounds();
      if (b && isFinite(b.centerX) && isFinite(b.centerY)) {
        return { x: b.centerX, y: b.centerY };
      }
    }
  } catch {}
  try {
    const anySymbol: any = symbol as any;
    return { x: (anySymbol?.x ?? 0) as number, y: (anySymbol?.y ?? 0) as number };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function applyImageSymbolWinRipple(scene: Phaser.Scene, symbol: any): void {
  try {
    if (!scene || !symbol || (symbol as any).destroyed) {
      return;
    }
    const anySymbol: any = symbol as any;
    if (anySymbol.__isCollectorPlaceholder) {
      return;
    }
    // If a ripple ring already exists, do not stack another one on top.
    if (anySymbol.__winRippleRing) {
      return;
    }
    let radius = 0;
    try {
      const size = (anySymbol as any).__pngSize as { w?: number; h?: number } | undefined;
      const w = (size?.w ?? anySymbol.displayWidth ?? anySymbol.width ?? 0) as number;
      const h = (size?.h ?? anySymbol.displayHeight ?? anySymbol.height ?? 0) as number;
      radius = Math.max(w, h) * 0.5;
    } catch {}
    if (!radius || radius <= 0) {
      radius = 50;
    }
    const p0 = getSymbolWorldCenter(anySymbol);
    const ring = scene.add.circle(p0.x, p0.y, radius, 0xffffff, 0);
    try { (ring as any).setStrokeStyle?.(radius * 0.12, 0xffffff, 1); } catch {}
    try {
      const bgDepthRaw = Number((scene as any)?.slotBackground?.depth);
      const minDepth = isFinite(bgDepthRaw) ? bgDepthRaw + 1 : 880;
      const parentDepthRaw = Number((anySymbol as any)?.parentContainer?.depth);
      const ownDepthRaw = Number((anySymbol as any)?.depth);
      const baseDepth = isFinite(parentDepthRaw) ? parentDepthRaw : (isFinite(ownDepthRaw) ? ownDepthRaw : 0);
      ring.setDepth(Math.max(minDepth, baseDepth + 1));
    } catch {}
    try {
      if (typeof (ring as any).setScrollFactor === 'function') {
        const sfx = (anySymbol.scrollFactorX as number) ?? 0;
        const sfy = (anySymbol.scrollFactorY as number) ?? sfx;
        (ring as any).setScrollFactor(sfx, sfy);
      }
    } catch {}
    anySymbol.__winRippleRing = ring;

    // Keep ripple ring positioned on the symbol as it moves (e.g. collector being pulled).
    try {
      const updateFn = () => {
        try {
          const isSymbolVisible = (() => {
            try {
              if (!anySymbol || anySymbol.destroyed) return false;
              if (anySymbol.visible === false) return false;
              const a = (anySymbol.alpha ?? 1) as number;
              if (typeof a === 'number' && isFinite(a) && a <= 0.01) return false;
              return true;
            } catch {
              return false;
            }
          })();

          if (!anySymbol || anySymbol.destroyed || !ring || (ring as any).destroyed || !isSymbolVisible) {
            try { clearImageSymbolWinRipple(scene, anySymbol); } catch {}
            return;
          }
          const p = getSymbolWorldCenter(anySymbol);
          ring.x = p.x;
          ring.y = p.y;
          try {
            const bgDepthRaw = Number((scene as any)?.slotBackground?.depth);
            const minDepth = isFinite(bgDepthRaw) ? bgDepthRaw + 1 : 880;
            const parentDepthRaw = Number((anySymbol as any)?.parentContainer?.depth);
            const ownDepthRaw = Number((anySymbol as any)?.depth);
            const baseDepth = isFinite(parentDepthRaw) ? parentDepthRaw : (isFinite(ownDepthRaw) ? ownDepthRaw : 0);
            ring.setDepth(Math.max(minDepth, baseDepth + 1));
          } catch {}
        } catch {}
      };
      anySymbol.__winRippleUpdateFn = updateFn;
      scene.events.on('update', updateFn);
    } catch {}

    try {
      const ringTween = scene.tweens.add({
        targets: ring,
        scale: { from: 0, to: 1.4 },
        alpha: { from: 0.9, to: 0 },
        duration: 450,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.Out,
      });
      anySymbol.__winRippleRingTween = ringTween;
    } catch {}

    // Add a subtle size pulse on the symbol itself.
    // Store the base scale so we can restore it cleanly when clearing the ripple.
    try {
      const baseScaleX = (anySymbol.scaleX ?? 1) as number;
      const baseScaleY = (anySymbol.scaleY ?? 1) as number;
      (anySymbol as any).__winRippleBaseScaleX = baseScaleX;
      (anySymbol as any).__winRippleBaseScaleY = baseScaleY;
      try {
        const prevPulse: any = (anySymbol as any).__winRipplePulseTween;
        if (prevPulse) {
          try { prevPulse.stop?.(); } catch {}
          try { prevPulse.remove?.(); } catch {}
          try { delete (anySymbol as any).__winRipplePulseTween; } catch {}
        }
      } catch {}
      const pulseTween = scene.tweens.add({
        targets: anySymbol,
        scaleX: baseScaleX * 1.15,
        scaleY: baseScaleY * 1.15,
        duration: 220,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
      (anySymbol as any).__winRipplePulseTween = pulseTween;
    } catch {}
  } catch {}
}

export function clearImageSymbolWinRipple(scene: Phaser.Scene, symbol: any): void {
  try {
    if (!scene || !symbol) {
      return;
    }
    const anySymbol: any = symbol as any;
    try {
      const pulseTween: any = (anySymbol as any).__winRipplePulseTween;
      if (pulseTween) {
        try { pulseTween.stop?.(); } catch {}
        try { pulseTween.remove?.(); } catch {}
        try { delete (anySymbol as any).__winRipplePulseTween; } catch {}
      }
    } catch {}
    try {
      const updateFn = anySymbol.__winRippleUpdateFn;
      if (updateFn) {
        try { scene.events.off('update', updateFn); } catch {}
        try { delete anySymbol.__winRippleUpdateFn; } catch {}
      }
    } catch {}
    const ring = anySymbol.__winRippleRing;
    if (ring) {
      try {
        const ringTween: any = (anySymbol as any).__winRippleRingTween;
        if (ringTween) {
          try { ringTween.stop?.(); } catch {}
          try { ringTween.remove?.(); } catch {}
          try { delete (anySymbol as any).__winRippleRingTween; } catch {}
        } else {
          try { scene.tweens.killTweensOf(ring); } catch {}
        }
      } catch {}
      try { ring.destroy(); } catch {}
      try { delete anySymbol.__winRippleRing; } catch {}
    }
    // Restore the symbol's original scale and kill any lingering scale tweens
    try {
      const baseX = (anySymbol as any).__winRippleBaseScaleX;
      const baseY = (anySymbol as any).__winRippleBaseScaleY;
      if (typeof baseX === 'number' && typeof baseY === 'number') {
        try { anySymbol.setScale(baseX, baseY); } catch {}
      }
      try { delete (anySymbol as any).__winRippleBaseScaleX; } catch {}
      try { delete (anySymbol as any).__winRippleBaseScaleY; } catch {}
    } catch {}
  } catch {}
}
