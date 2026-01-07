# Demo Mode Implementation Changes (Sugar Wonderland v2)

This document outlines the changes made to support **demo mode** functionality in **Sugar Wonderland v2**, following the same naming + detection patterns used in `rainbow_fist`.

## Overview

Demo mode allows the game to run without requiring authentication tokens or making real API calls for balance/history. When demo mode is active, the game uses mock data and simplified API interactions, and keeps a local demo balance in sync with gameplay events.

## Changes Made

### 1. `src/backend/GameAPI.ts`

#### Constants Added

- **`GAME_ID`**
  - Used in demo spin requests and URL token generation request body
  - Current value: `'00010525'`

- **`DEMO_BALANCE`**
  - Default demo balance
  - Current value: `10000`

#### Methods Modified

##### `initializeGame()`
- **Demo Storage**: when the `demo` URL param is detected, it is stored in both `localStorage` and `sessionStorage`:

  ```ts
  localStorage.setItem('demo', isDemo);
  sessionStorage.setItem('demo', isDemo);
  ```

- **Early Return**: when demo mode is active, returns `''` and does **not** require a token.

##### `gameLauncher()`
- **Demo Cleanup**: removes `demo` from both storages during cleanup.

##### `getBalance()`
- **Demo Check**: uses the same detection pattern:

  ```ts
  const isDemo = this.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
  ```

- **Mock Response**: in demo mode returns:

  ```ts
  { data: { balance: GameAPI.DEMO_BALANCE } }
  ```

- **No Token / No API Call**: demo mode does not show token-expired popup and does not hit `/api/v1/slots/balance`.

##### `initializeBalance()`
- **Demo Behavior**: returns `GameAPI.DEMO_BALANCE` directly in demo mode.
- **Purpose**: many flows use this as the “balance refresh” path; in demo mode it effectively refreshes UI from the in-memory demo balance.

##### `doSpin(bet, isBuyFs, isEnhancedBet, isFs?)`
- **Demo Check**: uses the same detection pattern as `getBalance()`.
- **Token Requirement**: only enforced when **not** in demo mode.
- **Conditional Authorization Header**: included only if a token exists.
- **Demo Endpoint**: `/api/v1/analytics/spin`
- **Normal Endpoint**: `/api/v1/slots/bet`
- **Demo Request Body**:

  ```ts
  {
    bet: bet.toString(),
    gameId: GameAPI.GAME_ID,
    isEnhancedBet,
    isBuyFs,
    isFs: false
  }
  ```

> Note: non-demo mode preserves Sugar Wonderland’s existing initialization free-spin handling (`remainingInitFreeSpins` → `isFs`).

##### `getHistory(page, limit)`
- **Demo Behavior**: returns empty history immediately, no API call:

  ```ts
  {
    data: [],
    meta: { page: 1, pageCount: 1, totalPages: 1, total: 0 }
  }
  ```

#### Methods Added (same naming as `rainbow_fist`)

- **`getDemoState()`**: reads `demo` from URL params
- **`getGameId()`**: returns `GAME_ID`
- **`getDemoBalance()`**: returns `DEMO_BALANCE`
- **`updateDemoBalance(newBalance)`**: updates `DEMO_BALANCE`

---

### 2. `src/game/scenes/Preloader.ts`

#### Modified behavior

- **Demo State Logging**: logs demo state at startup.
- **Slot Session Init Skip**: `initializeSlotSession()` is skipped in demo mode, since it requires a token.
- **UI Indicator**: clock suffix includes `| DEMO` when demo mode is active.

---

### 3. `src/game/scenes/Game.ts`

#### Modified behavior

##### `WIN_STOP` handling
- In demo mode and **only in base game** (not scatter, not bonus), demo balance is increased by the win amount:

  ```ts
  if (isDemo && !gameStateManager.isScatter && !gameStateManager.isBonus) {
    this.gameAPI.updateDemoBalance(this.gameAPI.getDemoBalance() + totalWin);
  }
  ```

#### UI Indicator
- Clock suffix includes `| DEMO` when demo mode is active.

---

### 4. `src/game/components/SlotController.ts`

#### Modified behavior

##### `decrementBalanceByBet()`
- In demo mode, after deducting the bet locally, demo balance is synced:

  ```ts
  if (this.gameAPI?.getDemoState()) {
    this.gameAPI.updateDemoBalance(newBalance);
  }
  ```

##### `handleBuyFeature()`
- In demo mode, after deducting buy-feature price locally, demo balance is synced.

##### `updateBalanceFromServer()`
- In demo mode, server refresh is skipped entirely.

#### Currency Symbol Removal + Centering
- Balance, bet, and buy-feature amount fields hide currency symbols and center the numeric value when demo is active.

---

### 5. `src/game/components/Menu.ts` — History Tab

#### Modified behavior

- **Tab still visible** but **disabled** in demo mode (opacity reduced and `disableInteractive()` applied).
- **Tab switching protected**: prevents switching to `history` tab programmatically in demo mode.
- **History content**: shows `History is not available in demo mode` and makes no API calls.

---

### 6. Currency Symbol Removal Across UI

In demo mode, currency symbols are removed (or omitted) in several UI surfaces to match the `rainbow_fist` behavior:

- `Header.ts`
- `BonusHeader.ts`
- `WinTracker.ts`
- `MenuTabs/HelpScreen.ts`
- `AutoplayOptions.ts`
- `BetOptions.ts`
- `BuyFeature.ts`
- `FreeRoundManager.ts`
- `Dialogs.ts` (Congrats totals prefix)

---

## Demo Mode Detection Pattern

Throughout the codebase, demo mode is detected using:

```ts
const isDemo = this.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
```

## Storage Pattern

- **Key**: `demo`
- **Locations**: `localStorage` and `sessionStorage`
- **Set**: in `initializeGame()`
- **Cleared**: in `gameLauncher()`

## Usage

### Enabling Demo Mode

Add `?demo=true` to the game URL.

Example:

```
http://localhost:8080/?demo=true
```


