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

export function isSpineAssetCached(scene: Scene | null | undefined, jsonKey: string, atlasKey?: string): boolean {
	if (!scene || (!jsonKey && !atlasKey)) return false;
	const cacheAny = (scene as any)?.cache;
	if (!cacheAny) return false;

	const spineCustom = getCustomCacheSection(cacheAny, 'spine');
	const sections = [spineCustom, cacheAny.spine, cacheAny.json, cacheAny.text].filter(Boolean);

	const jsonLoaded = jsonKey ? sections.some((section) => hasCacheEntry(section, jsonKey)) : true;
	const atlasLoaded = atlasKey ? sections.some((section) => hasCacheEntry(section, atlasKey)) : true;
	return jsonLoaded && atlasLoaded;
}

function getCustomCacheSection(cacheAny: any, sectionKey: string): any {
	if (!cacheAny || !cacheAny.custom) return null;
	const custom = cacheAny.custom;
	try {
		if (typeof custom.get === 'function') {
			const section = custom.get(sectionKey);
			if (section) return section;
		}
	} catch {}
	try {
		if (custom.entries && typeof custom.entries.get === 'function') {
			const section = custom.entries.get(sectionKey);
			if (section) return section;
		}
	} catch {}
	if (custom[sectionKey]) {
		return custom[sectionKey];
	}
	try {
		if (typeof custom.has === 'function' && custom.has(sectionKey) && typeof custom.get === 'function') {
			return custom.get(sectionKey);
		}
	} catch {}
	return null;
}

function hasCacheEntry(cacheSection: any, key: string): boolean {
	if (!cacheSection || !key) return false;
	try {
		if (typeof cacheSection.has === 'function' && cacheSection.has(key)) {
			return true;
		}
		if (typeof cacheSection.exists === 'function' && cacheSection.exists(key)) {
			return true;
		}
		if (typeof cacheSection.get === 'function') {
			const entry = cacheSection.get(key);
			if (entry !== undefined && entry !== null) {
				return true;
			}
		}
		if (cacheSection.entries) {
			if (typeof cacheSection.entries.has === 'function' && cacheSection.entries.has(key)) {
				return true;
			}
			if (typeof cacheSection.entries.get === 'function') {
				const entry = cacheSection.entries.get(key);
				if (entry !== undefined && entry !== null) {
					return true;
				}
			}
		}
	} catch {}
	return false;
}
