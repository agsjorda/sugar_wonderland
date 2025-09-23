import Phaser from 'phaser';

type RowOptions = {
    x: number;            // center X of the row
    y: number;            // center Y of the row
    maxWidth: number;     // total width available for the whole row
    gap?: number;         // desired gap between items (unscaled)
    align?: 'center'|'left'|'right'; // horizontal alignment within maxWidth
};

/**
 * Lay out up to 3 containers side-by-side. Excess items are ignored.
 * Automatically scales the set down to fit maxWidth (never scales up).
 */
export function layoutContainersRow(
    scene: Phaser.Scene,
    items: Phaser.GameObjects.Container[],
    opts: RowOptions
) {
    const gap = opts.gap ?? 16;
    const visibleItems = items.slice(0, 3).filter(Boolean);

    // Hide anything not used
    items.forEach((c) => {
        c.setVisible(visibleItems.includes(c));
    });

    if (visibleItems.length === 0) return;

    // Measure natural widths (including current scale) using bounds
    const widths = visibleItems.map((c) => {
        const b = c.getBounds();
        return b.width;
    });
    const totalNaturalWidth = widths.reduce((acc, w) => acc + w, 0) + gap * (visibleItems.length - 1);

    // Determine scale factor to fit inside maxWidth (never scale up)
    const scale = Math.min(1, opts.maxWidth / Math.max(1, totalNaturalWidth));
    visibleItems.forEach((c) => c.setScale(c.scaleX * scale, c.scaleY * scale));

    // Re-measure after scaling
    const scaledWidths = visibleItems.map((c) => c.getBounds().width);
    const rowWidth = scaledWidths.reduce((acc, w) => acc + w, 0) + gap * (visibleItems.length - 1);

    // Left origin for alignment
    let leftX = opts.x;
    if (opts.align === 'left') {
        leftX = opts.x - opts.maxWidth / 2;
    } else if (opts.align === 'right') {
        leftX = opts.x + opts.maxWidth / 2 - rowWidth;
    } else {
        // center
        leftX = opts.x - rowWidth / 2;
    }

    // Position items along the row
    let cursor = leftX;
    visibleItems.forEach((c, i) => {
        const w = scaledWidths[i];
        const halfW = w / 2;
        c.setPosition(cursor + halfW, opts.y);
        cursor += w + gap;
    });
}


