# Spine plugin intermittent “add.spine missing” fix (Phaser 3.90 + `@esotericsoftware/spine-phaser-v3` 4.2.82)

This repo uses `@esotericsoftware/spine-phaser-v3` as a **Scene Plugin** (see each game’s `src/game/main.ts`), which should provide:

- Loader APIs: `scene.load.spineJson(...)`, `scene.load.spineAtlas(...)` (and sometimes `scene.load.spine(...)`)
- Factory API: `scene.add.spine(...)` (and `scene.make.spine(...)`)

## Symptoms

- Console shows errors like:
  - `Missing scene.add.spine ... hasLoaderJson=true hasLoaderAtlas=true pluginKeys=[]`
  - Or intermittent failures where Spine assets are skipped during load, then later code tries to create Spine objects.

## Root cause

There are two separate issues that can happen:

### 1) Loader API detection was too strict

Some runtimes expose **combined** loader API `load.spine(...)` instead of (or earlier than) the separate `spineJson/spineAtlas` functions.
If your guard checks only `spineJson/spineAtlas`, it may falsely conclude “no Spine loader”, causing your `AssetLoader` to skip all spine asset groups.

### 2) Dynamic plugin attachment failed due to Phaser’s `fromLoader` flag

In Phaser 3.90, `PluginManager.installScenePlugin(key, plugin, mapping, addToScene, fromLoader)` will log:

- `Scene Plugin key in use: SpinePlugin`

and then **return early** if `fromLoader` is `false` and the plugin key already exists.

That means the plugin is registered globally, but it doesn’t get attached to the current scene, so `scene.add.spine` remains missing.

### 3) `add.spine` factory can look up the plugin instance from the “wrong” sys key

In `@esotericsoftware/spine-phaser-v3`, the function behind `scene.add.spine(...)` is registered **globally** (via `registerGameObject`) the first time a `SpinePlugin` instance is constructed.
That factory closes over the `pluginKey` used at that moment and later looks up the plugin instance via:

```ts
const spinePlugin = this.scene.sys[pluginKey];
```

If anything in your app ever caused the first constructed instance to use a different key (commonly `'spine'` vs `'SpinePlugin'`), you can end up with:

- `scene.add.spine` exists
- `scene.sys.SpinePlugin` exists
- but the factory looks for `scene.sys.spine` (or vice versa), passing `undefined` into `SpineGameObject` and crashing at `isAtlasPremultiplied`.

**Fix:** in your guard, keep both sys keys (`scene.sys.SpinePlugin` and `scene.sys.spine`) pointing to the same instance (and keep `scene.spine` mapping in sync).

### 4) Components calling `scene.add.spine(...)` directly (bypassing your guard)

Even with a perfect `SpineGuard`, you’ll still get intermittent:

- `TypeError: Cannot read properties of undefined (reading 'isAtlasPremultiplied')`

if some code paths call `scene.add.spine(...)` **without** first ensuring the plugin instance is attached to that specific scene (and sys keys are synced).

This showed up in `sugar_wonderland_v2` where `SlotController` and `BuyFeature` were calling `scene.add.spine(...)` directly during `Game.create()`.

## The fix (copy/paste)

### A) Update `ensureSpineLoader` to accept combined OR separate loader APIs

Make sure your Spine loader guard returns `true` if *either* of these is present:

- `scene.load.spine(...)`
- `scene.load.spineJson(...)` AND `scene.load.spineAtlas(...)`

### B) When installing the scene plugin dynamically, pass `fromLoader=true`

When you call `installScenePlugin`, pass the final argument `true`:

```ts
pluginMgr.installScenePlugin('SpinePlugin', SpinePlugin as any, 'spine', scene, true);
```

This matches how Phaser’s loader installs scene plugins and avoids the “Scene Plugin key in use” early return.

### C) Keep sys keys in sync (`SpinePlugin` and `spine`)

Add a small helper that ensures:

- `scene.sys.SpinePlugin === scene.sys.spine === scene.spine` (when an instance exists)

### D) Ensure all Spine creation paths go through `ensureSpineFactory(...)`

Recommended patterns:

- Add a **global safety net** at the start of your `Game.create()`:

```ts
try { ensureSpineFactory(this, '[Game] create'); } catch {}
```

- In components that create Spine objects (e.g. controller button animations), call:

```ts
if (!ensureSpineFactory(scene, '[Component] createSomethingSpine')) {
  // optionally retry shortly
  scene.time.delayedCall(250, () => this.createSomethingSpine(scene, assetScale));
  return;
}
```

This avoids calling `scene.add.spine(...)` during moments where the global factory exists but the scene plugin instance isn’t attached yet.

## Reference implementation (already applied in `felice_in_space_v2`)

Files changed:

- `felice_in_space_v2/src/utils/SpineGuard.ts`
- `felice_in_space_v2/src/utils/AssetLoader.ts`

Additional reference (applied in `sugar_wonderland_v2`):

- `sugar_wonderland_v2/src/utils/SpineGuard.ts`
- `sugar_wonderland_v2/src/utils/AssetLoader.ts`
- `sugar_wonderland_v2/src/game/scenes/Game.ts` (calls `ensureSpineFactory` at top of `create()`)
- `sugar_wonderland_v2/src/game/components/SlotController.ts` (guards all button/bet spine creations)
- `sugar_wonderland_v2/src/game/components/BuyFeature.ts` (guards scatter spine creation)

If you want to replicate the exact implementation, copy those changes into the target game folder.

## Checklist to apply to another game folder

For a game folder like `hustle_horse/` or `warfreaks_v2/`:

- **Confirm plugin config exists** in `src/game/main.ts`:
  - `plugins.scene` includes `{ key: 'SpinePlugin', plugin: SpinePlugin, mapping: 'spine' }`
- **Update `src/utils/SpineGuard.ts`**:
  - Loader readiness accepts `load.spine` OR `load.spineJson+spineAtlas`
  - Dynamic `installScenePlugin(..., scene, true)` uses `fromLoader=true`
- **Ensure all `add.spine(...)` call sites are guarded**:
  - Prefer calling `ensureSpineFactory(scene, '...')` before any Spine creation
  - Add a global safety call in `Game.create()` if you have many components creating Spine objects
- **If you have an `AssetLoader`** that conditionally skips spine groups:
  - Ensure it calls `ensureSpineLoader` and does not incorrectly skip when `load.spine` exists.

## Quick runtime verification

In any scene where you create Spine objects, you should be able to log:

```ts
console.log('has add.spine', typeof (this.add as any).spine === 'function');
console.log('has load.spineJson', typeof (this.load as any).spineJson === 'function');
console.log('has load.spineAtlas', typeof (this.load as any).spineAtlas === 'function');
console.log('has load.spine', typeof (this.load as any).spine === 'function');
```

If loader is true but `add.spine` is false, the plugin is not attached to that scene (and the `fromLoader=true` fix is required).


