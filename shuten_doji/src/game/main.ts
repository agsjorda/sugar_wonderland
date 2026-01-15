import { Boot } from './scenes/Boot';
import { TestBed } from './scenes/TestBed';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig

const targetFPS = 60;

/**
 * Phaser WebAudioSoundManager has a few internal visibility handlers that call
 * `AudioContext.suspend()` / `resume()` without checking if the context is already closed.
 * When the game loads while the tab is backgrounded, some browsers can close the context,
 * causing "Cannot suspend/resume a closed AudioContext" (often as unhandled promise rejections).
 *
 * This replaces the registered Game event handlers with guarded versions.
 */
const hardenPhaserWebAudioVisibilityHandlers = (game: Game): void => {
	try {
		const sm: any = (game as any)?.sound;
		const events: any = (game as any)?.events;
		const coreEvents: any = (Phaser as any)?.Core?.Events;

		if (!sm || !events || !coreEvents) return;
		// Only applies to WebAudio sound managers that expose an AudioContext
		if (!sm.context) return;

		const safeSuspend = (ctx: any): void => {
			if (!ctx || ctx.state === 'closed') return;
			try {
				const p = ctx.suspend();
				if (p && typeof p.catch === 'function') p.catch(() => {});
			} catch {
				// ignore
			}
		};

		const safeResume = (ctx: any): void => {
			if (!ctx || ctx.state === 'closed') return;
			try {
				const p = ctx.resume();
				if (p && typeof p.catch === 'function') p.catch(() => {});
			} catch {
				// ignore
			}
		};

		// Remove Phaser's original handlers (registered during sound manager construction)
		try { events.off(coreEvents.VISIBLE, sm.onGameVisible, sm); } catch { /* no-op */ }
		try { events.off(coreEvents.BLUR, sm.onBlur, sm); } catch { /* no-op */ }
		try { events.off(coreEvents.FOCUS, sm.onFocus, sm); } catch { /* no-op */ }

		// Replace with guarded versions
		function safeOnGameVisible(this: any): void {
			const self = this;
			// Match Phaser's behavior (setTimeout avoids iOS artifacts), but guard closed contexts.
			window.setTimeout(() => {
				const ctx = self?.context;
				if (!ctx || ctx.state === 'closed') return;
				safeSuspend(ctx);
				safeResume(ctx);
			}, 100);
		}

		function safeOnBlur(this: any): void {
			const ctx = this?.context;
			if (!ctx || ctx.state === 'closed') return;
			if (this?.locked) return;
			safeSuspend(ctx);
		}

		function safeOnFocus(this: any): void {
			const ctx = this?.context;
			if (!ctx || ctx.state === 'closed') return;
			if (this?.locked) return;
			if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
				safeResume(ctx);
			}
		}

		events.on(coreEvents.VISIBLE, safeOnGameVisible, sm);
		events.on(coreEvents.BLUR, safeOnBlur, sm);
		events.on(coreEvents.FOCUS, safeOnFocus, sm);
	} catch {
		// If anything about Phaser internals changes, fail open (no crash).
	}
};

const config: Phaser.Types.Core.GameConfig = {
	type: Phaser.WEBGL,
	width: 428,
	height: 926,
	parent: 'game-container',
	backgroundColor: 'transparent',
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH
	},
	fps: {
		target: targetFPS,
		min: 1,
		forceSetTimeOut: false
	},
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { x: 0, y: 1000 },
			debug: false
		}
	},
	scene: [
		// TestBed,
		Boot,
		Preloader,
		MainGame,
	],
	plugins: {
		scene: [
			{
				key: 'SpinePlugin',
				plugin: SpinePlugin,
				mapping: 'spine'
			}
		]
	},
	render: {
		antialias: true,
		antialiasGL: true,
		pixelArt: false,
		mipmapFilter: 'LINEAR',
		powerPreference: 'default',
		batchSize: 4096,
		roundPixels: false,
	}
};

const StartGame = (parent: string) => {
    // Helper to detect mobile devices (coarse heuristic)
    const isMobile = (): boolean => {
        try {
            const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera;
            return /android|iphone|ipad|ipod|iemobile|blackberry|mobile/i.test(ua);
        } catch (_e) {
            return false;
        }
    };

    const game = new Game({ ...config, parent });
    hardenPhaserWebAudioVisibilityHandlers(game);

    // --- Robust resize / centering ---
    // Phaser FIT + CENTER_BOTH relies on the parent container having correct dimensions,
    // and on ScaleManager noticing container resizes. In some layouts/browsers, window
    // resize doesn't reliably propagate, so we force refresh on any container size change.
    const rootEl = document.getElementById('root') as HTMLElement | null;
    const appEl = (document.getElementById('app') as HTMLElement | null) || rootEl;
    const containerEl = (document.getElementById(parent) as HTMLElement | null) || appEl || rootEl;

    const getViewportSize = () => {
        const vv = (window as any).visualViewport;
        const width = vv && vv.width ? Math.round(vv.width) : window.innerWidth;
        const height = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
        return { width, height };
    };

    const refreshScale = () => {
        try { game.scale.refresh(); } catch (_e) { /* no-op */ }
    };

    const applyViewportHeights = () => {
        // Mainly for mobile browsers where 100vh doesn't match the visible viewport.
        const { height } = getViewportSize();
        try {
            if (rootEl) rootEl.style.height = `${height}px`;
            if (appEl) appEl.style.height = `${height}px`;
            if (containerEl) (containerEl as HTMLElement).style.height = `${height}px`;
        } catch (_e) { /* no-op */ }
    };

    // ResizeObserver (best signal: actual container resize)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
        ro = new ResizeObserver(() => {
            refreshScale();
        });
        try { ro.observe(containerEl); } catch (_e) { /* no-op */ }
    }

    // Window / visualViewport fallback (covers desktop + mobile address bar changes)
    const onViewportChange = () => {
        if (isMobile()) {
            applyViewportHeights();
        }
        refreshScale();
        // Some browsers/layouts apply size changes over a few frames; re-check shortly.
        [60, 180, 360].forEach((ms) => {
            window.setTimeout(() => {
                if (isMobile()) applyViewportHeights();
                refreshScale();
            }, ms);
        });
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange as any);
    const vv = (window as any).visualViewport;
    if (vv && vv.addEventListener) {
        vv.addEventListener('resize', onViewportChange);
    }

    const cleanupResizeHooks = () => {
        try { window.removeEventListener('resize', onViewportChange); } catch { /* no-op */ }
        try { window.removeEventListener('orientationchange', onViewportChange as any); } catch { /* no-op */ }
        try { vv?.removeEventListener?.('resize', onViewportChange); } catch { /* no-op */ }
        try { ro?.disconnect?.(); } catch { /* no-op */ }
        ro = null;
    };
    try {
        game.events.once((Phaser as any).Core?.Events?.DESTROY, cleanupResizeHooks);
    } catch (_e) {
        // fail open
    }

    if (isMobile()) {
        try {
            // Keep the visible viewport height in sync on mobile (address bar / safe areas).
            applyViewportHeights();

            // Ensure the top-level wrapper centers the game container.
            if (appEl) {
                (appEl.style as any).display = appEl.style.display || 'flex';
                (appEl.style as any).justifyContent = appEl.style.justifyContent || 'center';
                (appEl.style as any).alignItems = appEl.style.alignItems || 'center';
                appEl.style.width = '100vw';
            }
            if (rootEl) {
                rootEl.style.width = '100vw';
            }
            if (containerEl) {
                containerEl.style.width = '100vw';
                (containerEl.style as any).aspectRatio = '';
                containerEl.style.maxWidth = '100vw';
                containerEl.style.maxHeight = '100vh';
            }

            onViewportChange();
        } catch (_err) { /* no-op */ }
        try {
            const canvas = game.canvas as HTMLCanvasElement | null;
            if (canvas) {
                const noopPrevent = (e: Event) => { e.preventDefault(); };
                canvas.addEventListener('touchstart', noopPrevent, { passive: false });
                canvas.addEventListener('touchmove', noopPrevent, { passive: false });
                canvas.addEventListener('touchend', noopPrevent, { passive: false });
                canvas.addEventListener('touchcancel', noopPrevent, { passive: false });
            }
            const applyTouchSafeStyles = (el: HTMLElement | null | undefined) => {
                if (!el) return;
                el.style.touchAction = 'none';
                (el.style as any).msTouchAction = 'none';
                el.style.userSelect = 'none';
                (el.style as any).webkitUserSelect = 'none';
                (el.style as any).webkitTapHighlightColor = 'transparent';
                (el.style as any).overscrollBehavior = 'contain';
            };
            applyTouchSafeStyles(rootEl as HTMLElement);
            applyTouchSafeStyles(appEl as HTMLElement);
            applyTouchSafeStyles(containerEl as HTMLElement);
            applyTouchSafeStyles(canvas as unknown as HTMLElement);
        } catch (_e) { /* no-op */ }
        if (game.canvas && !game.canvas.hasAttribute('tabindex')) {
            game.canvas.setAttribute('tabindex', '0');
        }
    }

    (window as any).phaserGame = game;
    // Prefer fullscreen targeting the actual app wrapper (#app), fallback to #root.
    if (appEl) {
        (game.scale as any).fullscreenTarget = appEl as unknown as HTMLElement;
    }
    game.scale.on('leavefullscreen', () => {
        game.canvas?.focus();
    });
    const onFsChange = () => {
        if (!game.scale.isFullscreen) {
            game.canvas?.focus();
        }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // @ts-ignore - Safari legacy prefix
    document.addEventListener('webkitfullscreenchange', onFsChange);
    const lockPortraitIfPossible = async () => {
        try {
            // @ts-ignore - not universally typed
            if ((screen as any) && (screen as any).orientation && (screen as any).orientation.lock) {
                // @ts-ignore
                await (screen as any).orientation.lock('portrait');
            }
        } catch (_e) { /* no-op */ }
    };
    game.scale.on('enterfullscreen', lockPortraitIfPossible);
    game.scale.on('resize', () => {
        try {
            if (isMobile()) {
                applyViewportHeights();
            }
        } catch (_e) { /* no-op */ }
    });

    return game;

}

export default StartGame;
