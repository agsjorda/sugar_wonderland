import { Boot } from './scenes/Boot';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { FireOverlayTransitionScene } from './scenes/FireOverlayTransitionScene';
// Import Spine runtime and plugin
import * as Spine from '@esotericsoftware/spine-phaser-v3';

// Make Spine available globally for debugging
(window as any).Spine = Spine;

const isClosedAudioContextError = (err: any): boolean => {
    try {
        const name = (err && (err.name || err.constructor?.name)) ? String(err.name || err.constructor?.name) : '';
        const message = err && (err.message || err.toString) ? String(err.message ?? err.toString()) : '';
        if (name && name !== 'InvalidStateError' && name !== 'DOMException') return false;
        return /closed\s+AudioContext/i.test(message) && /(suspend|resume)/i.test(message);
    } catch {
        return false;
    }
};

const patchAudioContextSuspendResume = (): void => {
    const w: any = window as any;
    if (w.__patchedClosedAudioContextSuspendResume) return;
    w.__patchedClosedAudioContextSuspendResume = true;

    const patchCtor = (Ctor: any) => {
        try {
            if (!Ctor || !Ctor.prototype) return;
            const proto: any = Ctor.prototype;

            const origSuspend = proto.suspend;
            if (typeof origSuspend === 'function' && !origSuspend.__patchedClosedGuard) {
                const wrappedSuspend = function (this: any, ...args: any[]) {
                    try {
                        if (this && this.state === 'closed') return Promise.resolve();
                    } catch {}
                    try {
                        const p = origSuspend.apply(this, args);
                        if (p && typeof p.catch === 'function') {
                            return p.catch((e: any) => {
                                if (isClosedAudioContextError(e)) return;
                                throw e;
                            });
                        }
                        return p;
                    } catch (e: any) {
                        if (isClosedAudioContextError(e)) return Promise.resolve();
                        throw e;
                    }
                };
                (wrappedSuspend as any).__patchedClosedGuard = true;
                proto.suspend = wrappedSuspend;
                (proto.suspend as any).__patchedClosedGuard = true;
            }

            const origResume = proto.resume;
            if (typeof origResume === 'function' && !origResume.__patchedClosedGuard) {
                const wrappedResume = function (this: any, ...args: any[]) {
                    try {
                        if (this && this.state === 'closed') return Promise.resolve();
                    } catch {}
                    try {
                        const p = origResume.apply(this, args);
                        if (p && typeof p.catch === 'function') {
                            return p.catch((e: any) => {
                                if (isClosedAudioContextError(e)) return;
                                throw e;
                            });
                        }
                        return p;
                    } catch (e: any) {
                        if (isClosedAudioContextError(e)) return Promise.resolve();
                        throw e;
                    }
                };
                (wrappedResume as any).__patchedClosedGuard = true;
                proto.resume = wrappedResume;
                (proto.resume as any).__patchedClosedGuard = true;
            }
        } catch {
        }
    };

    try { patchCtor((window as any).AudioContext); } catch {}
    try { patchCtor((window as any).webkitAudioContext); } catch {}
};

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
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
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 1000 },
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        FireOverlayTransitionScene,
        MainGame,
    ],
    plugins: {
        scene: [
            {
                key: 'spine',
                plugin: Spine.SpinePlugin,
                mapping: 'spine',
                systemKey: 'spine',
                sceneKey: 'spine'
            }
        ]
    },
    render: {
		antialias: true,
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

    patchAudioContextSuspendResume();

    let game: Phaser.Game = new Game({ ...config, parent });
    (window as any).game = game;

	// Global DOM-level audio unlock: ensures AudioContext.resume() runs inside a real user gesture
	// (capture phase), preventing the "tab away and back" workaround.
	try {
		const w: any = window as any;
		if (!w.__globalAudioUnlockInstalled) {
			w.__globalAudioUnlockInstalled = true;
			const unlock = () => {
				try {
					const sm: any = (game as any)?.sound;
					try { sm?.unlock?.(); } catch {}
					try { sm?.context?.resume?.(); } catch {}
					try { sm?.webaudio?.context?.resume?.(); } catch {}
					try { (game as any)?.sound?.context?.resume?.(); } catch {}
					try { (game as any)?.sound?.webaudio?.context?.resume?.(); } catch {}
					// Try a silent play to force-unlock on some browsers (ignore if not loaded yet)
					try { (game as any)?.sound?.play?.('click_sw', { volume: 0, loop: false }); } catch {}
					const locked = !!sm?.locked;
					const state = sm?.context?.state || sm?.webaudio?.context?.state || null;
					if (!locked && state !== 'suspended') {
						try {
							document.removeEventListener('pointerdown', unlock as any, true as any);
							document.removeEventListener('touchstart', unlock as any, true as any);
							document.removeEventListener('keydown', unlock as any, true as any);
							document.removeEventListener('mousedown', unlock as any, true as any);
						} catch {}
					}
				} catch {}
			};
			try { document.addEventListener('pointerdown', unlock as any, true as any); } catch {}
			try { document.addEventListener('touchstart', unlock as any, true as any); } catch {}
			try { document.addEventListener('keydown', unlock as any, true as any); } catch {}
			try { document.addEventListener('mousedown', unlock as any, true as any); } catch {}
			try { unlock(); } catch {}
		}
	} catch {}

    let isRestarting = false;
    let lastRestartAt = 0;
    let boundToCanvas: HTMLCanvasElement | null = null;

    const rebindPerGameHandlers = () => {
        try {
            if (isMobile()) {
                try {
                    const appElement = document.getElementById('root');
                    const container = document.getElementById(parent) || appElement;
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
                    applyTouchSafeStyles(appElement as HTMLElement);
                    applyTouchSafeStyles(container as HTMLElement);
                    applyTouchSafeStyles(canvas as unknown as HTMLElement);
                    if (game.canvas && !game.canvas.hasAttribute('tabindex')) {
                        game.canvas.setAttribute('tabindex', '0');
                    }
                } catch {}
            }

            const appElement = document.getElementById('root');
            if (appElement) {
                (game.scale as any).fullscreenTarget = appElement as unknown as HTMLElement;
            }

            game.scale.on('leavefullscreen', () => {
                try { game.canvas?.focus(); } catch {}
            });

            const lockPortraitIfPossible = async () => {
                try {
                    if ((screen as any) && (screen as any).orientation && (screen as any).orientation.lock) {
                        await (screen as any).orientation.lock('portrait');
                    }
                } catch {}
            };
            game.scale.on('enterfullscreen', lockPortraitIfPossible);
            game.scale.on('resize', () => {
                try {
                    const root = document.getElementById('root');
                    if (root) {
                        const vv = (window as any).visualViewport;
                        const height = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
                        (root as HTMLElement).style.height = `${height}px`;
                    }
                } catch {}
            });
        } catch {}
    };

    const restartGame = () => {
        try {
            const now = Date.now();
            if (isRestarting) return;
            if (now - lastRestartAt < 1500) return;
            isRestarting = true;
            lastRestartAt = now;

            const old = game;
            try {
                if (boundToCanvas) {
                    boundToCanvas.removeEventListener('webglcontextlost', onWebGLContextLost as any);
                    boundToCanvas.removeEventListener('webglcontextrestored', onWebGLContextRestored as any);
                }
            } catch {}

            try { old.destroy(true); } catch {}

            game = new Game({ ...config, parent });
            (window as any).game = game;
            (window as any).phaserGame = game;
            boundToCanvas = game.canvas as HTMLCanvasElement | null;
            if (boundToCanvas) {
                boundToCanvas.addEventListener('webglcontextlost', onWebGLContextLost as any, { passive: false } as any);
                boundToCanvas.addEventListener('webglcontextrestored', onWebGLContextRestored as any);
            }

            rebindPerGameHandlers();
            try {
                window.dispatchEvent(new CustomEvent('phaser-game-restarted', { detail: { game } }));
            } catch {}
        } catch {
        } finally {
            isRestarting = false;
        }
    };

    const onWebGLContextLost = (e: Event) => {
        try {
            const anyE: any = e as any;
            if (typeof anyE?.preventDefault === 'function') {
                anyE.preventDefault();
            }
        } catch {}
        restartGame();
    };
    const onWebGLContextRestored = () => {
        restartGame();
    };

    const onGlobalError = (e: any) => {
        try {
            (window as any).__lastGameError = e;
        } catch {}
        try {
            const err = (e && (e.error || e.reason)) ? (e.error || e.reason) : e;
            console.error('[Game] Global error', err);
        } catch {}
        try { restartGame(); } catch {}
    };
    const onUnhandledRejection = (e: any) => {
        try {
            (window as any).__lastGameRejection = e;
        } catch {}
        try {
            const reason = e?.reason ?? e;
            if (isClosedAudioContextError(reason)) {
                try { e?.preventDefault?.(); } catch {}
                return;
            }
        } catch {}
        try {
            console.error('[Game] Unhandled rejection', e?.reason ?? e);
        } catch {}
        try { restartGame(); } catch {}
    };
    try { window.addEventListener('error', onGlobalError as any); } catch {}
    try { window.addEventListener('unhandledrejection', onUnhandledRejection as any); } catch {}

    boundToCanvas = game.canvas as HTMLCanvasElement | null;
    if (boundToCanvas) {
        boundToCanvas.addEventListener('webglcontextlost', onWebGLContextLost as any, { passive: false } as any);
        boundToCanvas.addEventListener('webglcontextrestored', onWebGLContextRestored as any);
    }

    if (isMobile()) {
        try {
            const appElement = document.getElementById('root');
            const container = document.getElementById(parent) || appElement;
            const getViewportSize = () => {
                const vv = (window as any).visualViewport;
                const width = vv && vv.width ? Math.round(vv.width) : window.innerWidth;
                const height = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
                return { width, height };
            };
            const applyContainerSize = () => {
                const { height } = getViewportSize();
                if (appElement) {
                    (appElement as HTMLElement).style.width = '100vw';
                    (appElement as HTMLElement).style.height = `${height}px`;
                }
                if (container) {
                    (container as HTMLElement).style.width = '100vw';
                    (container as HTMLElement).style.height = `${height}px`;
                }
            };
            const scheduleScaleRefresh = () => {
                try { game.scale.refresh(); } catch (_e) { /* no-op */ }
                [60, 180, 360, 720].forEach((ms) => {
                    window.setTimeout(() => {
                        applyContainerSize();
                        try { game.scale.refresh(); } catch (_e) { /* no-op */ }
                    }, ms);
                });
            };
            applyContainerSize();
            if (appElement) {
                (appElement.style as any).display = appElement.style.display || 'flex';
                (appElement.style as any).justifyContent = appElement.style.justifyContent || 'center';
                (appElement.style as any).alignItems = appElement.style.alignItems || 'center';
            }
            if (container) {
                (container.style as any).aspectRatio = '';
                container.style.maxWidth = '100vw';
                container.style.maxHeight = '100vh';
            }
            const onViewportChange = () => {
                applyContainerSize();
                scheduleScaleRefresh();
            };
            onViewportChange();
            window.addEventListener('resize', onViewportChange);
            window.addEventListener('orientationchange', onViewportChange as any);
            const vv = (window as any).visualViewport;
            if (vv && vv.addEventListener) {
                vv.addEventListener('resize', onViewportChange);
            }
        } catch (_err) { /* no-op */ }
        try {
            const appElement = document.getElementById('root');
            const container = document.getElementById(parent) || appElement;
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
            applyTouchSafeStyles(appElement as HTMLElement);
            applyTouchSafeStyles(container as HTMLElement);
            applyTouchSafeStyles(canvas as unknown as HTMLElement);
        } catch (_e) { /* no-op */ }
        if (game.canvas && !game.canvas.hasAttribute('tabindex')) {
            game.canvas.setAttribute('tabindex', '0');
        }
    }

    (window as any).phaserGame = game;
    const appElement = document.getElementById('root');
    if (appElement) {
        (game.scale as any).fullscreenTarget = appElement as unknown as HTMLElement;
    }
    game.scale.on('leavefullscreen', () => {
        try { game.canvas?.focus(); } catch (_e) {}
    });
    const onFsChange = () => {
        if (!game.scale.isFullscreen) {
            try { game.canvas?.focus(); } catch (_e) {}
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
            const root = document.getElementById('root');
            if (root) {
                const vv = (window as any).visualViewport;
                const height = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
                (root as HTMLElement).style.height = `${height}px`;
            }
        } catch (_e) { /* no-op */ }
    });

    return game;

}

export default StartGame;
