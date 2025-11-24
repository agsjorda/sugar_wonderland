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
				pluginMgr.installScenePlugin('spine.SpinePlugin', SpinePlugin as any, 'spine', scene);
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
	let hasLoader = typeof loadAny?.spineJson === 'function' && typeof loadAny?.spineAtlas === 'function';
	if (!hasLoader) {
		// Attempt to install the scene plugin dynamically to register loader file types,
		// which can fail to register if the game boots in a background tab.
		try {
			const sysAny = (scene as any).sys;
			const pluginMgr: any = sysAny?.plugins;
			if (pluginMgr?.installScenePlugin) {
				pluginMgr.installScenePlugin('spine.SpinePlugin', SpinePlugin as any, 'spine', scene);
				// Re-evaluate after installation attempt
				const reLoad: any = scene.load as any;
				hasLoader = typeof reLoad?.spineJson === 'function' && typeof reLoad?.spineAtlas === 'function';
				if (hasLoader) {
					console.info(`[SpineGuard] Installed SpinePlugin to provide loader APIs for ${context}`);
				}
			}
		} catch (e) {
			console.warn(`[SpineGuard] Failed to install SpinePlugin for loader in ${context}:`, e);
		}
	}
	if (!hasLoader) {
		try {
			const sysAny = (scene as any).sys;
			const pluginKeys = sysAny?.plugins?.pluginKeys || Object.keys(sysAny?.plugins?.plugins || {});
			console.warn(`[SpineGuard] Spine loader APIs still missing in ${context}. pluginKeys=`, pluginKeys);
		} catch {
			console.warn(`[SpineGuard] Spine loader APIs still missing in ${context}.`);
		}
	}
	return hasLoader;
}


