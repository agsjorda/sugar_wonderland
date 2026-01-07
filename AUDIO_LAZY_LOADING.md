# AUDIO_LAZY_LOADING.md

This doc describes the **audio lazy-loading pattern** used in:
- `felice_in_space_v2`
- `sugar_wonderland_v2`

Goal: **do not block StudioLoading / Preloader completion on audio**, but still start downloading audio as early as possible and **play it whenever it becomes ready**.

---

## Why this is needed (Phaser constraint)

In Phaser, anything queued in a Scene’s `preload()` must finish before that Scene’s `create()` runs.

So if you do:
- `Preloader.preload()` → `this.load.audio(...)`

…then `Preloader.create()` (and anything after it, like enabling “Press Play”, hiding StudioLoading, etc.) **will wait for audio**.

Lazy loading fixes this by:
- loading **visual/gameplay-critical assets** in `Preloader.preload()`
- starting **audio downloads only after** the visual preload finishes (non-blocking)

---

## High-level pattern

### 1) Keep audio definitions in `AssetConfig.getAudioAssets()`

All games should have a map like:
- `AssetConfig.getAudioAssets(): { audio: { [key: string]: string } }`

This keeps audio centralized and lets both Preloader + Game fallback load the same list.

---

### 2) **Do NOT load audio** in `Preloader.preload()`

Remove/avoid:
- `this.assetLoader.loadAudioAssets(this)`
- `this.load.audio(...)` calls

`Preloader.preload()` should only queue non-audio assets required to show the loading UI and start the game visuals.

---

### 3) Start audio download after the main preload completes (in `Preloader.create()`)

Add a helper in Preloader like:
- `startBackgroundAudioLoad()`

It should:
- read `this.assetConfig.getAudioAssets().audio`
- queue audio that isn’t already in cache
- call `this.load.start()` to begin downloading **without blocking StudioLoading**, because this happens after `preload()` completion

Notes:
- Prefer to avoid driving “boot progress UI” using this background audio load (see next section).
- If your game can trigger other runtime loads, guard with:
  - `if ((this.load as any).isLoading?.()) return;`
  - or queue + start later when idle.

---

### 4) Prevent background audio load from affecting boot/studio progress UI

If your Preloader does:
- `this.load.on('progress', ...)` to update an external boot loader UI

…make sure you **detach that progress handler** after the main preload completes.

Otherwise, your background audio load may:
- reset/animate the boot loader UI again
- show unexpected “loading” behavior after the StudioLoading screen is gone

Implementation approach:
- store the progress handler in a member like `bootProgressHandler`
- `off('progress', bootProgressHandler)` inside `this.load.once('complete', ...)`

---

### 5) Game scene must be resilient: initialize audio when it becomes available

Because Preloader can be stopped early (player clicks quickly), audio might not finish downloading before Game starts.

So in `Game.create()`:
- create `AudioManager` immediately
- attempt `audioManager.createMusicInstances()` + `playBackgroundMusic(...)`
  - if it works → done
  - if it fails → **fallback**:
    - queue the same `AssetConfig.getAudioAssets().audio` keys on `Game.load`
    - `load.once('complete', ...)` → retry audio init
    - `load.start()`

This ensures:
- fast “start game” UX
- audio starts whenever it becomes ready

---

## StudioLoadingScreen rule

`StudioLoadingScreen` should:
- **never** queue audio
- **never** wait for audio completion

It should only fade out when the main preload’s loader completes for the assets it is responsible for (visuals, spines, UI, etc.).

---

## Copy/paste checklist (apply to any new game)

### Preloader
- [ ] Remove audio from `Preloader.preload()`
- [ ] Add `startBackgroundAudioLoad()` in `Preloader`
- [ ] Call `startBackgroundAudioLoad()` at the end of `Preloader.create()`
- [ ] If Preloader uses a progress handler for boot UI, detach it after the main preload completes

### StudioLoadingScreen
- [ ] Ensure it does not call `assetLoader.loadAudioAssets(...)`
- [ ] Ensure completion/fade is not gated by audio

### Game
- [ ] Create `AudioManager` early
- [ ] Try `createMusicInstances()` + `playBackgroundMusic()` immediately
- [ ] If it throws/fails, queue audio keys from `AssetConfig.getAudioAssets()` and retry on `load.complete`

---

## Notes / gotchas

- **Phaser Loader can only run one batch at a time**.
  - If you have other runtime loads, ensure you don’t call `load.start()` while a load is already active.
- **Decoding vs download**:
  - Some browsers may delay decode; `sound.add(key)` may fail until decode is ready.
  - The “try init → fallback load → retry” strategy handles this.
- **Mute policies**:
  - Most games already have an audio visibility/mute policy (don’t suspend closed AudioContext). Keep that unchanged.


