import Phaser from 'phaser';

export function applyImageSymbolWinRipple(scene: Phaser.Scene, symbol: any): void {
  try {
    if (!scene || !symbol || (symbol as any).destroyed) {
      return;
    }
    const anySymbol: any = symbol as any;
    if (anySymbol.__winRippleRing) {
      return;
    }
    let radius = 0;
    try {
      const w = (anySymbol.displayWidth ?? anySymbol.width ?? 0) as number;
      const h = (anySymbol.displayHeight ?? anySymbol.height ?? 0) as number;
      radius = Math.max(w, h) * 0.5;
    } catch {}
    if (!radius || radius <= 0) {
      radius = 50;
    }
    const ring = scene.add.circle(anySymbol.x, anySymbol.y, radius, 0xffffff, 0);
    try { (ring as any).setStrokeStyle?.(radius * 0.12, 0xffffff, 1); } catch {}
    try {
      const depth = (anySymbol.depth as number) ?? 0;
      ring.setDepth(depth + 1);
    } catch {}
    try {
      if (typeof (ring as any).setScrollFactor === 'function') {
        const sfx = (anySymbol.scrollFactorX as number) ?? 0;
        const sfy = (anySymbol.scrollFactorY as number) ?? sfx;
        (ring as any).setScrollFactor(sfx, sfy);
      }
    } catch {}
    anySymbol.__winRippleRing = ring;
    try {
      scene.tweens.add({
        targets: ring,
        scale: { from: 0, to: 1.4 },
        alpha: { from: 0.9, to: 0 },
        duration: 450,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.Out,
      });
    } catch {}

    // Add a subtle size pulse on the symbol itself, similar to the earlier effect
    try {
      const baseScaleX = (anySymbol.scaleX ?? 1) as number;
      const baseScaleY = (anySymbol.scaleY ?? 1) as number;
      scene.tweens.add({
        targets: anySymbol,
        scaleX: baseScaleX * 1.15,
        scaleY: baseScaleY * 1.15,
        duration: 220,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
    } catch {}
  } catch {}
}

export function clearImageSymbolWinRipple(scene: Phaser.Scene, symbol: any): void {
  try {
    if (!scene || !symbol) {
      return;
    }
    const anySymbol: any = symbol as any;
    const ring = anySymbol.__winRippleRing;
    if (ring) {
      try { scene.tweens.killTweensOf(ring); } catch {}
      try { ring.destroy(); } catch {}
      try { delete anySymbol.__winRippleRing; } catch {}
    }
  } catch {}
}
