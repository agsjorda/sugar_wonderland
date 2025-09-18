import { Scene } from 'phaser';

export function ensureSpineFactory(scene: Scene, context: string): boolean {
	const addAny = scene.add as any;
	const hasFactory = typeof addAny?.spine === 'function';
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


