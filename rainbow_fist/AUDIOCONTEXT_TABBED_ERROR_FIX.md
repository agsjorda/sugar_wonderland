# AudioContext visibility errors fix (Phaser WebAudio)

## Problem

When the game is **loading** and the user switches to a different browser tab (or the page loses visibility), the console may show:

- `InvalidStateError: Cannot suspend a closed AudioContext.`
- `InvalidStateError: Cannot resume a closed AudioContext.`

These are typically logged as **unhandled promise rejections**.

## Root cause

With Phaser WebAudio enabled, Phaser registers internal visibility handlers that call `AudioContext.suspend()` / `resume()` during `VISIBLE`, `BLUR`, and `FOCUS` events.

In some browsers, if the game loads while backgrounded, the underlying `AudioContext` can already be in the `"closed"` state. Calling `suspend()` / `resume()` on a closed context throws `InvalidStateError`.

## Fix overview

We replace Phaser’s registered handlers with **guarded** versions that:

- no-op when `context.state === "closed"`
- swallow promise rejections from `suspend()` / `resume()` (to avoid noisy console logs)

## Implementation details

**Location:** `src/game/main.ts`

**Entry point:** called right after the Phaser game is created:

- `hardenPhaserWebAudioVisibilityHandlers(game)`

**What it does:**

- Detects if the current Phaser sound manager exposes a WebAudio `context`
- Removes Phaser’s internal listeners:
  - `game.events.off(Phaser.Core.Events.VISIBLE, soundManager.onGameVisible, soundManager)`
  - `game.events.off(Phaser.Core.Events.BLUR, soundManager.onBlur, soundManager)`
  - `game.events.off(Phaser.Core.Events.FOCUS, soundManager.onFocus, soundManager)`
- Re-adds safe versions that check `context.state` and wrap `suspend()` / `resume()` calls

## How to reproduce (original bug)

- Start the game and keep DevTools Console open
- While it’s still loading, switch to a different tab for a few seconds
- Switch back
- Observe the `InvalidStateError` logs

## How to verify the fix

- Repeat the same steps above
- Confirm the console no longer logs:
  - `Cannot suspend a closed AudioContext`
  - `Cannot resume a closed AudioContext`

## Notes / maintenance

- This solution relies on Phaser internal event handler names (`onGameVisible`, `onBlur`, `onFocus`) and core event constants (`Phaser.Core.Events.*`).
- The code is wrapped in `try/catch` and fails open (no crash) if Phaser internals change in a future upgrade.

