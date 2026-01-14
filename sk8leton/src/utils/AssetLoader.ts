import { Scene } from "phaser";
import { AssetConfig, AssetGroup } from "../config/AssetConfig";
import { ensureSpineLoader, ensureSpineFactory } from "./SpineGuard";

export function resolveAssetUrl(path: string): string {
    if (!path) {
        return path;
    }
    // Do not touch fully-qualified or special scheme URLs
    if (/^(?:https?:|data:|blob:)/i.test(path)) {
        return path;
    }
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    // Use the base as provided by Vite; supports '/', './', or '/repo/' for GitHub Pages
    const normalizedBase = base.endsWith('/') ? base : base + '/';
    // Strip any leading './' or '/' from provided path
    const normalizedPath = path.replace(/^\.\//, '').replace(/^\//, '');
    return `${normalizedBase}${normalizedPath}`;
}

export class AssetLoader {
    private assetConfig: AssetConfig;

    constructor(assetConfig: AssetConfig) {
        this.assetConfig = assetConfig;
    }

    loadAssetGroup(scene: Scene, assetGroup: AssetGroup): void {
        // Load images
        if (assetGroup.images) {
            Object.entries(assetGroup.images).forEach(([key, path]) => {
                console.log(`[AssetLoader] Loading image: ${key} from ${path}`);
                scene.load.image(key, resolveAssetUrl(path));
            });
        }

        // Load font files
        if (assetGroup.fonts) {
            Object.entries(assetGroup.fonts).forEach(([key, path]) => {
                console.log(`[AssetLoader] Preloading font: ${key} from ${path}`);
                this.preloadFont(key, path);
            });
        }

        // Load Spine animations
        if (assetGroup.spine) {
            let loaderReady = ensureSpineLoader(scene, '[AssetLoader] loadAssetGroup.pre');
            if (!loaderReady) {
                // Try to install the Spine plugin/factory which typically also registers loader filetypes
                ensureSpineFactory(scene, '[AssetLoader] install SpinePlugin for loader');
                loaderReady = ensureSpineLoader(scene, '[AssetLoader] loadAssetGroup.post');
            }
            if (!loaderReady) {
                console.warn('[AssetLoader] Spine loader not available. Skipping spine asset group.');
            } else {
                Object.entries(assetGroup.spine).forEach(([key, spineData]) => {
                    console.log(`[AssetLoader] Loading spine: ${key} from ${spineData.json}`);
                    scene.load.spineAtlas(`${key}-atlas`, resolveAssetUrl(spineData.atlas));
                    scene.load.spineJson(key, resolveAssetUrl(spineData.json));
                });
            }
        }

        // Load audio files
        if (assetGroup.audio) {
            Object.entries(assetGroup.audio).forEach(([key, path]) => {
                console.log(`[AssetLoader] Loading audio: ${key} from ${path}`);
                scene.load.audio(key, resolveAssetUrl(path));
            });
        }
    }

    loadBackgroundAssets(_scene: Scene): void {
        try {
            console.log('[AssetLoader] Loading background assets...');
            this.loadAssetGroup(_scene, this.assetConfig.getBackgroundAssets());
        } catch {}
    }

    loadBonusBackgroundAssets(_scene: Scene): void {
        try {
            console.log('[AssetLoader] Loading bonus background assets...');
            this.loadAssetGroup(_scene, this.assetConfig.getBonusBackgroundAssets());
        } catch {}
    }

    loadGaugeMeterAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading gauge meter assets...');
        this.loadAssetGroup(scene, this.assetConfig.getGaugeMeterAssets());
    }

    loadBonusHeaderAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading bonus header assets...');
        this.loadAssetGroup(scene, this.assetConfig.getBonusHeaderAssets());
    }

    loadTransitionAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading transition assets...');
        this.loadAssetGroup(scene, (this.assetConfig as any).getTransitionAssets());
    }

    loadDynamiteAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading dynamite assets...');
        const anyConfig: any = this.assetConfig as any;
        if (typeof anyConfig.getDynamiteAssets === 'function') {
            this.loadAssetGroup(scene, anyConfig.getDynamiteAssets());
        } else {
            console.warn('[AssetLoader] getDynamiteAssets not available on AssetConfig');
        }
        console.log('[AssetLoader] Dynamite assets loaded');
    }

    loadLoadingAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading loading assets...');
        this.loadAssetGroup(scene, this.assetConfig.getLoadingAssets());
    }

    loadSymbolAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading symbol assets...');
        this.loadAssetGroup(scene, this.assetConfig.getSymbolAssets());
        console.log('[AssetLoader] Symbol assets loaded');
    }

    loadButtonAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading button assets...');
        this.loadAssetGroup(scene, this.assetConfig.getButtonAssets());
        console.log('[AssetLoader] Button assets loaded');
    }

    loadFontAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading font assets...');
        this.loadAssetGroup(scene, this.assetConfig.getFontAssets());
        this.ensureFontsLoaded();
        console.log('[AssetLoader] Font assets loaded');
    }

    loadMenuAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading menu assets...');
        this.loadAssetGroup(scene, this.assetConfig.getMenuAssets());
        console.log('[AssetLoader] Menu assets loaded');
    }

    loadHelpScreenAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading help screen assets...');
        this.loadAssetGroup(scene, this.assetConfig.getHelpScreenAssets());
        console.log('[AssetLoader] Help screen assets loaded');
    }

    loadDialogAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading dialog assets...');
        this.loadAssetGroup(scene, this.assetConfig.getDialogAssets());
        console.log('[AssetLoader] Dialog assets loaded');
    }

    loadScatterAnticipationAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading scatter anticipation assets...');
        this.loadAssetGroup(scene, this.assetConfig.getScatterAnticipationAssets());
        console.log('[AssetLoader] Scatter anticipation assets loaded');
    }

    loadNumberAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading number assets...');
        this.loadAssetGroup(scene, this.assetConfig.getNumberAssets());
        console.log('[AssetLoader] Number assets loaded');
    }

    loadBuyFeatureAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading buy feature assets...');
        this.loadAssetGroup(scene, this.assetConfig.getBuyFeatureAssets());
        console.log('[AssetLoader] Buy feature assets loaded');
    }

	loadWinlineAssets(scene: Scene): void {
		console.log('[AssetLoader] Loading winline assets...');
		try {
			this.loadAssetGroup(scene, (this.assetConfig as any).getWinlineAssets());
		} catch {}
		console.log('[AssetLoader] Winline assets loaded');
	}


    loadScatterWinOverlayAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading scatter win overlay assets...');
        console.log('[AssetLoader] Scatter win overlay assets loaded');
    }

    loadFreeSpinOverlayAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading free spin overlay assets...');
        const anyConfig: any = this.assetConfig as any;
        if (typeof anyConfig.getFreeSpinOverlayAssets === 'function') {
            this.loadAssetGroup(scene, anyConfig.getFreeSpinOverlayAssets());
        } else {
            console.warn('[AssetLoader] getFreeSpinOverlayAssets not available on AssetConfig');
        }
        console.log('[AssetLoader] Free spin overlay assets loaded');
    }

    loadAudioAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading audio assets...');
        this.loadAssetGroup(scene, this.assetConfig.getAudioAssets());
        console.log('[AssetLoader] Audio assets loaded');
    }

    loadAllAssets(scene: Scene): void {
        console.log('[AssetLoader] Loading all assets...');
        const allAssets = this.assetConfig.getAllAssets();
        
        Object.entries(allAssets).forEach(([groupName, assetGroup]) => {
            console.log(`[AssetLoader] Loading ${groupName} assets...`);
            this.loadAssetGroup(scene, assetGroup);
        });
    }

    private preloadFont(fontFamily: string, fontPath: string): void {
        const srcUrl = resolveAssetUrl(fontPath);

        // Register @font-face for CSS usage (fallback-compatible)
        const style = document.createElement('style');
        style.textContent = `
            @font-face {
                font-family: '${fontFamily}';
                src: url('${srcUrl}') format('truetype');
                font-display: swap;
                font-style: normal;
                font-weight: 400;
            }
        `;
        document.head.appendChild(style);

        // Proactively load using FontFace API to ensure availability without 'preload' warnings
        try {
            if (typeof FontFace !== 'undefined') {
                const face = new FontFace(fontFamily, `url('${srcUrl}') format('truetype')`, { style: 'normal', weight: '400', display: 'swap' as any });
                face.load().then(loaded => {
                    (document as any).fonts?.add(loaded);
                    // Force a layout by attempting a fonts.load as well (best-effort)
                    try { (document as any).fonts?.load?.(`1em ${fontFamily}`); } catch {}
                    console.log(`[AssetLoader] Font ${fontFamily} loaded via FontFace API`);
                }).catch(err => {
                    console.warn(`[AssetLoader] FontFace load failed for ${fontFamily}:`, err);
                });
            } else {
                // Fallback: nudge browser to fetch via CSS by requesting it
                try { (document as any).fonts?.load?.(`1em ${fontFamily}`); } catch {}
            }
        } catch (e) {
            console.warn('[AssetLoader] Error while using FontFace API:', e);
        }

        console.log(`[AssetLoader] Font ${fontFamily} registered from ${fontPath}`);
    }

	private ensureFontsLoaded(): void {
		// Wait for fonts to be loaded using document.fonts API
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(() => {
				console.log('[AssetLoader] All fonts are loaded and ready');
			}).catch((error) => {
				console.warn('[AssetLoader] Font loading error:', error);
			});
		} else {
			// Fallback: wait a bit for fonts to load
			setTimeout(() => {
				console.log('[AssetLoader] Font loading timeout reached');
			}, 1000);
		}
	}


} 