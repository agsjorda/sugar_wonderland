import { Boot } from './scenes/Boot';
import { TestBed } from './scenes/TestBed';
import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';
import { DeviceCapabilityManager } from '../managers/DeviceCapabilityManager';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig

// LOW END MOBILE OPTIMIZATION: Detect device capabilities early to configure game settings
// This automatically adjusts FPS, power preference, and antialiasing based on device capabilities
const deviceCapabilityManager = new DeviceCapabilityManager();
const capabilities = deviceCapabilityManager.getCapabilities();

// LOW END MOBILE OPTIMIZATION: Determine optimal render settings based on device
const useWebGL = true; // Always use WEBGL for better performance
const useAntialias = !capabilities.isLowEndDevice && capabilities.gpuTier !== 'low';
const powerPreference = capabilities.shouldUseLowPowerMode ? 'low-power' : 'default';
const targetFPS = capabilities.recommendedFPS;

console.log(`[GameConfig] Device: ${capabilities.isMobile ? 'Mobile' : 'Desktop'}, GPU: ${capabilities.gpuTier}, FPS: ${targetFPS}, Antialias: ${useAntialias}, Power: ${powerPreference}`);

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
		forceSetTimeOut: false,
		// Throttle FPS when tab is hidden to save battery
		limit: document.hidden ? 10 : targetFPS
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
		// LOW END MOBILE OPTIMIZATION: Disable antialiasing on low-end devices
		antialias: useAntialias,
		antialiasGL: useAntialias,
		pixelArt: false,
		mipmapFilter: 'LINEAR',
		powerPreference: powerPreference,
		// LOW END MOBILE OPTIMIZATION: reduce batch size on low-end devices
		batchSize: capabilities.isLowEndDevice ? 1000 : 4096,
		// LOW END MOBILE OPTIMIZATION: round pixels on low-end devices for better performance
		roundPixels: capabilities.isLowEndDevice,
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

	// LOW END MOBILE OPTIMIZATION: Throttle FPS when tab is hidden to save battery
	if (capabilities.isMobile) {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				game.loop.targetFPS = 10; // Very low FPS when hidden
			} else {
				game.loop.targetFPS = targetFPS; // Restore normal FPS
			}
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		// Initial check
		if (document.hidden) {
			game.loop.targetFPS = 10;
		}
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
