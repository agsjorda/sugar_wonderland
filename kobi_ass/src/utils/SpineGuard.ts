import { Scene } from 'phaser';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

export function ensureSpineFactory(scene: Scene, context: string): boolean {
	let addAny = scene.add as any;
	let hasFactory = typeof addAny?.spine === 'function';
	if (!hasFactory) {
		// Try to install the Spine scene plugin dynamically as a fallback
		try {
			const sysAny = (scene as any).sys;
			const pluginMgr: any = sysAny?.plugins;
			if (pluginMgr?.installScenePlugin) {
				pluginMgr.installScenePlugin('SpinePlugin', SpinePlugin as any, 'spine', scene);
				// Re-check after attempting to install
				addAny = scene.add as any;
				hasFactory = typeof addAny?.spine === 'function';
				if (hasFactory) {
					console.info(`[SpineGuard] Installed SpinePlugin dynamically for ${context}`);
				}
			}
		} catch (e) {
			console.warn(`[SpineGuard] Failed dynamic SpinePlugin install in ${context}:`, e);
		}

		// If still unavailable, log diagnostics
		if (!hasFactory) {
		const loadAny = scene.load as any;
		const hasLoaderJson = typeof loadAny?.spineJson === 'function';
		const hasLoaderAtlas = typeof loadAny?.spineAtlas === 'function';
		try {
			const sysAny = (scene as any).sys;
			const pluginKeys = sysAny?.plugins?.pluginKeys || Object.keys(sysAny?.plugins?.plugins || {});
			console.warn(`[SpineGuard] Missing scene.add.spine in ${context}. hasLoaderJson=${hasLoaderJson} hasLoaderAtlas=${hasLoaderAtlas} pluginKeys=`, pluginKeys);
		} catch {
			console.warn(`[SpineGuard] Missing scene.add.spine in ${context}.`);
		}
		}
	}
	return hasFactory;
}

export function ensureSpineLoader(scene: Scene, context: string): boolean {
	const loadAny = scene.load as any;
	const hasLoader = typeof loadAny?.spineJson === 'function' && typeof loadAny?.spineAtlas === 'function';
	if (!hasLoader) {
		console.warn(`[SpineGuard] Spine loader APIs not present in ${context} (spineJson/spineAtlas).`);
	}
	return hasLoader;
}


