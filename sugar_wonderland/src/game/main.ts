import { Game as MainGame } from './scenes/Game';
import { LandingPage } from './scenes/LandingPage';
import { LoadingPage } from './scenes/LoadingPage';
import { AUTO, Game, Scale, Types } from 'phaser';
import { ensurePortraitFullscreen, onOrientationChange } from './utils/orientation';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const desktopConfig: Types.Core.GameConfig = {
    type: AUTO,
    width: 1920,
    height: 1080,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        LandingPage,
        LoadingPage,
        MainGame,
    ],
    plugins: {
        scene: [
            {
                key: 'spine.SpinePlugin',
                plugin: SpinePlugin,
                mapping: 'spine'
            }
        ]
    },
    dom: {
        createContainer: true
    },
    input: {
        activePointers: 3
    }
};

const mobileConfig: Types.Core.GameConfig = {
    type: AUTO,
    width: 428,
    height: 926,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        LandingPage,
        LoadingPage,
        MainGame,
    ],
    plugins: {
        scene: [
            {
                key: 'spine.SpinePlugin',
                plugin: SpinePlugin,
                mapping: 'spine'
            }
        ]
    },
    dom: {
        createContainer: true
    },
    input: {
        activePointers: 3
    }
};

// Function to detect if the device is mobile (honors ?device=mobile/desktop override)
const isMobile = (): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    const deviceParam = urlParams.get('device');
    if (deviceParam === 'desktop') return false;
    if (deviceParam === 'mobile') return true;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
};

declare global {
    interface Window {
        phaserGame?: Game;
    }
}

const StartGame = (parent: string): Game => {
    const config = isMobile() ? mobileConfig : desktopConfig;
    //setupAspectRatioReload();
    const game = new Game({ ...config, parent });
  
    // Enforce portrait on mobile: show overlay and block play in landscape
    try {
        const overlay = document.getElementById('orientation-overlay') as HTMLElement | null;
        const overlayImage = overlay ? (overlay.querySelector('#orientation-image') as HTMLImageElement | null) : null;
        const gameContainer = (document.getElementById(parent) || document.getElementById('game-container')) as HTMLElement | null;
        const deviceParam = new URLSearchParams(window.location.search).get('device');
        const forceMobile = deviceParam === 'mobile';
        const forceDesktop = deviceParam === 'desktop';
        const pausedSceneKeys = new Set<string>();
        const updateOrientationLock = () => {
            // If explicitly desktop via URL or general desktop, ensure overlay hidden and resume
            if (!isMobile()) {
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.setAttribute('aria-hidden', 'true');
                    const content = overlay.querySelector('.orientation-overlay-content') as HTMLElement | null;
                    if (content) content.style.display = '';
                    if (overlayImage) overlayImage.style.display = 'none';
                    overlay.style.backgroundImage = '';
                }
                if (gameContainer) gameContainer.style.visibility = 'visible';
                // Re-enable input and resume any paused scenes
                if (game.input) game.input.enabled = true;
                pausedSceneKeys.forEach((key) => {
                    try {
                        // @ts-ignore accessing by key
                        if (game.scene.isPaused(key)) game.scene.resume(key);
                    } catch (_e) { /* no-op */ }
                });
                pausedSceneKeys.clear();
                return;
            }

            const portraitMedia = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
            const isPortrait = portraitMedia || (window.innerHeight >= window.innerWidth);
            if (isPortrait) {
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.setAttribute('aria-hidden', 'true');
                    const content = overlay.querySelector('.orientation-overlay-content') as HTMLElement | null;
                    if (content) content.style.display = '';
                    if (overlayImage) overlayImage.style.display = 'none';
                    overlay.style.backgroundImage = '';
                }
                if (gameContainer) gameContainer.style.visibility = 'visible';
                if (game.input) game.input.enabled = true;
                // Resume paused scenes
                pausedSceneKeys.forEach((key) => {
                    try {
                        // @ts-ignore
                        if (game.scene.isPaused(key)) game.scene.resume(key);
                    } catch (_e) { /* no-op */ }
                });
                pausedSceneKeys.clear();
            } else {
                if (overlay) {
                    overlay.style.display = 'block';
                    overlay.setAttribute('aria-hidden', 'false');
                    const content = overlay.querySelector('.orientation-overlay-content') as HTMLElement | null;
                    if (content) content.style.display = 'none';
                    if (overlayImage) {
                        // Try primary path, then fallback
                        overlayImage.style.display = 'block';
                        const primarySrc = '/rotatedDevice.jpg';
                        const fallbackSrc = '/rotatedDevice.jpg';
                        if (overlayImage.getAttribute('src') !== primarySrc && overlayImage.getAttribute('src') !== fallbackSrc) {
                            overlayImage.src = primarySrc;
                        }
                        overlayImage.onerror = () => {
                            overlayImage.onerror = null;
                            overlayImage.src = fallbackSrc;
                            // If fallback also fails, show text as last resort
                            overlayImage.onerror = () => {
                                overlayImage.style.display = 'none';
                                if (content) content.style.display = '';
                            };
                        };
                    }
                    // Clear any background image usage
                    overlay.style.backgroundImage = '';
                }
                // If device=mobile in URL, hide the game completely under the text
                if (forceMobile && gameContainer) {
                    gameContainer.style.visibility = 'hidden';
                } else if (gameContainer) {
                    gameContainer.style.visibility = 'visible';
                }
                // Disable input and pause running scenes
                if (game.input) game.input.enabled = false;
                try {
                    // @ts-ignore Phaser typing
                    const runningScenes = game.scene.getScenes(true) as any[];
                    runningScenes.forEach((s: any) => {
                        const key = (s && s.sys && s.sys.settings && s.sys.settings.key) as string;
                        if (key && !pausedSceneKeys.has(key)) {
                            try { game.scene.pause(key); } catch (_e) { /* no-op */ }
                            pausedSceneKeys.add(key);
                        }
                    });
                } catch (_e) { /* no-op */ }
            }
        };
        window.addEventListener('resize', updateOrientationLock);
        // Some devices fire orientationchange more reliably
        // @ts-ignore legacy event exists on some platforms
        window.addEventListener('orientationchange', updateOrientationLock);
        // Initial check
        updateOrientationLock();
    } catch (_e) { /* no-op */ }
  
    // Harden input reliability on mobile Safari/Chrome by setting runtime styles
    try {
        const appElement = document.getElementById('app');
        const container = document.getElementById(parent) || appElement;
        const canvas = game.canvas as HTMLCanvasElement | null;
        // Ensure touch listeners can call preventDefault on Safari/Chrome mobile
        if (canvas) {
            const noopPrevent = (e: Event) => {
                // Prevent browser scroll/zoom from stealing the gesture
                e.preventDefault();
            };
            canvas.addEventListener('touchstart', noopPrevent, { passive: false });
            canvas.addEventListener('touchmove', noopPrevent, { passive: false });
            canvas.addEventListener('touchend', noopPrevent, { passive: false });
            canvas.addEventListener('touchcancel', noopPrevent, { passive: false });
        }
        const applyTouchSafeStyles = (el: HTMLElement | null | undefined) => {
            if (!el) return;
            el.style.touchAction = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).msTouchAction = 'none';
            el.style.userSelect = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).webkitUserSelect = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).webkitTapHighlightColor = 'transparent';
            (el.style as any).overscrollBehavior = 'contain';
        };
        applyTouchSafeStyles(appElement as HTMLElement);
        applyTouchSafeStyles(container as HTMLElement);
        applyTouchSafeStyles(canvas as unknown as HTMLElement);
    } catch (_e) { /* no-op */ }
    // Make canvas focusable to improve gesture handling after exiting fullscreen
    if (game.canvas && !game.canvas.hasAttribute('tabindex')) {
        game.canvas.setAttribute('tabindex', '0');
    }
    // Expose game globally for UI overlay controls
    window.phaserGame = game;
    // Ensure the fullscreen element includes the HTML overlay controls
    const appElement = document.getElementById('app');
    if (appElement) {
        // Phaser will request fullscreen on this element, so overlay stays visible
        // @ts-ignore - property exists on Phaser 3 ScaleManager
        game.scale.fullscreenTarget = appElement as unknown as HTMLElement;
    }
    // Try to automatically enter fullscreen without prompting the user
    const tryStartFullscreen = () => {
        try {
            if (!game.scale.isFullscreen) {
                const maybePromise = (game.scale as any).startFullscreen?.();
                if (maybePromise && typeof (maybePromise as any).catch === 'function') {
                    (maybePromise as Promise<any>).catch(() => {});
                }
            }
        } catch { /* ignore */ }
    };
    // Best-effort attempts at and shortly after boot
    tryStartFullscreen();
    setTimeout(tryStartFullscreen, 300);
    setTimeout(tryStartFullscreen, 1000);
    // Enter fullscreen on the first user interaction (silent, no UI prompt)
    const onFirstGesture = () => tryStartFullscreen();
    document.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true });
    document.addEventListener('keydown', onFirstGesture, { once: true });
    document.addEventListener('touchend', onFirstGesture, { once: true, passive: false });
    // Ensure ability to re-enter fullscreen after exiting
    game.scale.on('leavefullscreen', () => {
        // Refocus canvas so the next user gesture is captured
        game.canvas?.focus();
    });
    // Cross-browser: also listen for DOM fullscreen change
    const onFsChange = () => {
        if (!game.scale.isFullscreen) {
            game.canvas?.focus();
        }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // @ts-ignore - Safari legacy prefix
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // Globally suppress known, benign fullscreen permission rejections
    const onUnhandled = (event: PromiseRejectionEvent) => {
        try {
            const msg = String((event && (event.reason?.message || event.reason)) || '');
            if (msg && msg.toLowerCase().includes('permissions check failed')) {
                event.preventDefault();
            }
        } catch {}
    };
    window.addEventListener('unhandledrejection', onUnhandled);

    // Enforce portrait fullscreen when rotating back to portrait
    // Attach listeners once after game is created
    const removeOrientationListener = onOrientationChange(() => {
        // Best-effort: when back to portrait, ensure fullscreen + portrait lock
        ensurePortraitFullscreen(() => game?.scale ?? null);
    });
    // Also retry fullscreen when tab becomes visible again
    const onVisibility = () => {
        if (document.visibilityState === 'visible') {
            tryStartFullscreen();
        }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Clean up on game destroy
    game.events.on(Phaser.Core.Events.DESTROY, () => {
        try { removeOrientationListener(); } catch {}
        try { document.removeEventListener('visibilitychange', onVisibility); } catch {}
        try { window.removeEventListener('unhandledrejection', onUnhandled); } catch {}
    });

    return game;
};

export default StartGame;   