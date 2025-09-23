// Utilities for enforcing portrait orientation and fullscreen behavior

export function isPortrait(): boolean {
    return window.matchMedia('(orientation: portrait)').matches || window.innerHeight >= window.innerWidth;
}

export async function requestPortraitLock(): Promise<boolean> {
    try {
        // Prefer Screen Orientation API if available and allowed
        // Some browsers require fullscreen to lock
        // @ts-ignore
        if (screen.orientation && screen.orientation.lock) {
            // @ts-ignore
            await screen.orientation.lock('portrait');
            return true;
        }
    } catch (_e) {
        // Ignore; fallback to best-effort
    }
    return false;
}

export function onOrientationChange(handler: () => void): () => void {
    const listener = () => handler();
    // Primary event
    window.addEventListener('orientationchange', listener);
    // Fallback via resize (covers desktop and some Android devices)
    window.addEventListener('resize', listener);
    return () => {
        window.removeEventListener('orientationchange', listener);
        window.removeEventListener('resize', listener);
    };
}

export async function ensurePortraitFullscreen(getPhaserScale: () => { isFullscreen: boolean; startFullscreen: () => void } | null): Promise<void> {
    // Only act when in portrait
    if (!isPortrait()) return;
    const scale = getPhaserScale();
    if (!scale) return;
    // Try to lock orientation first (no-op if unsupported)
    await requestPortraitLock();
    // If not fullscreen, request it
    if (!scale.isFullscreen) {
        try {
            const maybePromise = (scale as any).startFullscreen?.();
            if (maybePromise && typeof (maybePromise as any).catch === 'function') {
                (maybePromise as Promise<any>).catch(() => {});
            }
        } catch { /* no-op */ }
    }
}


