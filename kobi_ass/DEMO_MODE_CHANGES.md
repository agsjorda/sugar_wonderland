# Demo Mode Implementation Changes

This document outlines all changes made to support demo mode functionality in the game.

## Overview

Demo mode allows the game to run without requiring authentication tokens or making real API calls. When demo mode is active, the game uses mock data and simplified API interactions.

## Changes Made

### 1. GameAPI.ts

#### Constants Added

- **`GAME_ID`**: Static readonly constant for the game ID
  - Value: `'00060725'`
  - Used in API requests to identify the game

- **`DEMO_BALANCE`**: Static readonly constant for demo mode balance
  - Value: `10000`
  - Used as the default balance when in demo mode

#### Methods Modified

##### `initializeGame()`
- **Demo Storage**: When demo parameter is detected in URL, it's stored in both `localStorage` and `sessionStorage` (similar to token storage pattern)
- **Early Return**: If demo mode is detected, the method returns an empty string without generating a token
- **Storage Pattern**: 
  ```typescript
  localStorage.setItem('demo', isDemo ? 'true' : 'false');
  sessionStorage.setItem('demo', isDemo ? 'true' : 'false');
  ```

##### `initializeBalance()`
- **Demo Check**: Checks for demo mode using `getDemoState()`, `localStorage`, or `sessionStorage`
- **Demo Behavior**: Returns the current `GameAPI.DEMO_BALANCE` without any API call when in demo mode
- **Purpose**: Many flows use this method as the "balance refresh" path; in demo mode it effectively refreshes UI from the in-memory demo balance.

##### `getBalance()`
- **Demo Check**: Checks for demo mode using `getDemoState()`, `localStorage`, or `sessionStorage`
- **Mock Response**: Returns a mock balance response when in demo mode:
  ```typescript
  {
      data: {
          balance: GameAPI.DEMO_BALANCE  // Returns 10000
      }
  }
  ```
- **No API Call**: Skips the actual API call when demo mode is active

##### `doSpin()`
- **Demo Check**: Checks for demo mode using the same pattern as `getBalance()`
- **Token Requirement**: Only requires token if NOT in demo mode
- **Conditional Authorization Header**: Only includes Authorization header if token exists
- **Different Endpoint**: Uses different API endpoint for demo mode:
  - Demo: `/api/v1/analytics/spin`
  - Normal: `/api/v1/slots/bet`
- **Different Request Body**: Uses different body structure based on demo mode:
  
  **Demo Mode Body:**
  ```typescript
  {
      bet: bet.toString(),
      gameId: GameAPI.GAME_ID,
      isEnhancedBet: isEnhancedBet,
      isBuyFs: isBuyFs,
      isFs: false,
      rtp: "95"
  }
  ```
  
  **Normal Mode Body:**
  ```typescript
  {
      action: 'spin',
      bet: bet.toString(),
      line: 1,
      isBuyFs: isBuyFs,
      isEnhancedBet: isEnhancedBet
  }
  ```

#### Methods Added

##### `getGameId()`
- Returns the `GAME_ID` constant
- Public method to access the game ID

##### `getDemoBalance()`
- Returns the `DEMO_BALANCE` constant
- Public method to access the demo balance value

##### `updateDemoBalance(newBalance: number)`
- Updates the `DEMO_BALANCE` constant with a new value
- Used to sync the demo balance during gameplay (e.g., after wins, bet deductions)
- Allows dynamic balance updates in demo mode

#### Existing Methods

##### `getDemoState()`
- Retrieves demo state from URL parameters
- Returns `boolean` type (`true` if demo parameter is `'true'`, otherwise `false`)
- Used throughout the codebase to check if demo mode is active

##### `gameLauncher()`
- **Demo Cleanup**: Removes demo from both `localStorage` and `sessionStorage` when cleaning up
- Part of the initialization cleanup process

### 2. Game.ts

#### Methods Modified

##### `WIN_STOP Event Handler`
- **Demo Balance Update**: When demo mode is active and a win occurs in the **base game** (not scatter, not bonus), updates the demo balance:
  ```typescript
  const isDemo = this.gameAPI.getDemoState();
  if (isDemo && !gameStateManager.isScatter && !gameStateManager.isBonus && totalWin > 0 && !this.demoBalanceUpdatedThisSpin) {
      this.gameAPI.updateDemoBalance(this.gameAPI.getDemoBalance() + totalWin);
      this.demoBalanceUpdatedThisSpin = true;
  }
  ```
- **Once Per Spin**: Uses `demoBalanceUpdatedThisSpin` boolean to ensure the update only runs once per spin
- **Reset on REELS_START**: The `demoBalanceUpdatedThisSpin` flag is reset to `false` when `REELS_START` event is received
- **Purpose**: Keeps the demo balance in sync with wins during gameplay

#### UI Indicator
- **Demo Title Marker**: Appends `| DEMO` to the game title when demo mode is active (via `getDemoState()`), e.g. `Kobi Ass | DEMO`.
  - Implemented in `create()` method when creating `ClockDisplay`

### 3. SlotController.ts

#### Methods Modified

##### `decrementBalanceByBet()`
- **Demo Balance Sync**: When balance is decremented after a bet, the demo balance is updated to match:
  ```typescript
  if(this.gameAPI?.getDemoState()) {
      this.gameAPI.updateDemoBalance(newBalance);
  }
  ```
- **Purpose**: Keeps demo balance in sync with bet deductions during normal gameplay

##### `updateBalanceFromServer()`
- **Demo Check**: Checks if demo mode is active using `gameAPI.getDemoState()`
- **Early Return**: Returns immediately if demo mode is detected, preventing balance updates from server
- **No Server Updates**: In demo mode, balance updates from server are completely disabled

##### `handleBuyFeature()`
- **Demo Balance Sync (Buy Feature)**: When Buy Feature is purchased, the UI balance is reduced by the calculated price (`bet * 100`), and in demo mode the `DEMO_BALANCE` value is updated to match:
  ```typescript
  const newBalance = currentBalance - calculatedPrice;
  if (this.gameAPI?.getDemoState()) {
      this.gameAPI.updateDemoBalance(newBalance);
  }
  this.updateBalanceAmount(newBalance);
  ```
- **Purpose**: Keeps demo balance consistent when using the Buy Feature flow (separate from normal bet deduction).

### 4. Preloader.ts

#### Methods Modified

##### `create()`
- **Demo State Logging**: Logs the demo state during initialization for debugging purposes:
  ```typescript
  const demoState = this.gameAPI.getDemoState();
  console.log('[Preloader] Demo state:', demoState);
  ```
- **Purpose**: Provides visibility into demo mode activation during the preloader phase

#### UI Indicator
- **Demo Title Marker**: Appends `| DEMO` to the game title when demo mode is active (via `getDemoState()`), e.g. `Kobi Ass | DEMO`.
  - Implemented in `createClockDisplay()` method when creating `ClockDisplay`

### 5. UI Currency Display

#### Currency Symbol Removal
- **Demo Mode Behavior**: All currency symbols (e.g., `$`, `£`) are removed from the UI when demo mode is active
- **Affected Components**: 
  - Balance display (SlotController)
  - Bet amount display (SlotController)
  - Feature button price (SlotController)
  - Winnings displays (Header, BonusHeader)
  - Win tracker rows (WinTracker)
  - Autoplay options balance and bet displays
  - Buy feature price and bet displays
  - Bet options display
  - Help screen payout tables

#### Value Text Positioning
- **Centering Adjustment**: Value texts are repositioned to account for the absence of currency symbols in demo mode
- **Implementation**: When currency symbols are removed, numeric values are shifted left by 4px to better center them within their containers
- **Affected Elements**: Balance, bet amount, and feature button value texts are dynamically repositioned when in demo mode

### 6. Menu.ts - History Tab

#### History Tab Behavior in Demo Mode
- **Tab Visibility**: History tab remains visible in the menu but is non-interactive in demo mode
- **Visual Indication**: History tab appears disabled with 50% opacity when in demo mode
- **No Interaction**: Clicking the history tab in demo mode does nothing (tab click handler is disabled)

#### Methods Modified

##### Tab Creation (`createMenu()`)
- **Demo Check**: Checks for demo mode when creating tabs
- **History Tab Disable**: If history tab is detected and demo mode is active:
  - Disables tab interaction using `disableInteractive()`
  - Sets tab opacity to 0.5 to visually indicate it's disabled
  - Skips adding the click handler for history tab
- **Implementation**:
  ```typescript
  const isDemo = scene.gameAPI?.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
  const isHistoryTab = tabConfig.icon === 'history';
  
  if (isHistoryTab && isDemo) {
      tabContainer.disableInteractive();
      tabContainer.setAlpha(0.5);
  } else {
      // Normal tab click handler
      tabContainer.on('pointerup', () => { ... });
  }
  ```

##### `switchTab()`
- **Demo Protection**: Prevents programmatically switching to history tab in demo mode
- **Fallback Behavior**: If attempting to switch to history tab in demo mode, redirects to first available non-history tab
- **Implementation**:
  ```typescript
  if (isDemo && tabKey === 'history') {
      const firstNonHistoryIndex = tabConfigs.findIndex((config, idx) => 
          config.icon !== 'history' && config.icon !== 'close'
      );
      if (firstNonHistoryIndex !== -1) {
          activeIndex = firstNonHistoryIndex;
      }
  }
  ```

##### `showHistoryContent()`
- **Demo Check**: Checks for demo mode before making API calls
- **Empty State**: In demo mode, displays empty state message instead of fetching history
- **No API Call**: Skips the `getHistory()` API call entirely in demo mode
- **Empty State Message**: Shows "History is not available in demo mode" message
- **No Pagination**: Pagination controls are not created in demo mode
- **Implementation**:
  ```typescript
  const isDemo = scene.gameAPI?.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
  
  if (isDemo) {
      // Display headers and empty state message
      // No API call, no pagination
      return;
  }
  ```

### 7. GameAPI.ts - History API

#### Methods Modified

##### `getHistory()`
- **Demo Check**: Checks for demo mode before making API call
- **Early Return**: Returns empty history data immediately in demo mode without making API call
- **Mock Response**: Returns empty history structure:
  ```typescript
  {
      data: [],
      meta: {
          page: 1,
          pageCount: 1,
          totalPages: 1,
          total: 0
      }
  }
  ```
- **No API Call**: Completely skips the fetch request when in demo mode
- **Purpose**: Prevents unnecessary API calls and ensures no history data is fetched in demo mode

## Demo Mode Detection Pattern

Throughout the codebase, demo mode is detected using this consistent pattern:

```typescript
const isDemo = this.getDemoState() || localStorage.getItem('demo') || sessionStorage.getItem('demo');
```

This checks:
1. URL parameters via `getDemoState()`
2. `localStorage` for stored demo value
3. `sessionStorage` for stored demo value

## Storage Pattern

Demo value is stored in the same pattern as tokens:
- **Storage Locations**: Both `localStorage` and `sessionStorage`
- **Key**: `'demo'`
- **Value**: Stored as string `'true'` or `'false'`
- **Initialization**: Stored in `initializeGame()` when demo parameter is detected
- **Cleanup**: Removed in `gameLauncher()` during cleanup

## API Behavior in Demo Mode

### Endpoints
- **Spin**: `/api/v1/analytics/spin` (demo) vs `/api/v1/slots/bet` (normal)
- **Balance**: Returns mock data, no API call
- **History**: Returns empty data, no API call

### Request Headers
- **Authorization**: Only included if token exists (optional in demo mode)

### Request Bodies
- Different structure for demo vs normal mode
- Demo mode uses simplified structure with hardcoded values

## Usage

### Enabling Demo Mode

Add `?demo=true` to the game URL:
```
https://your-game-url.com/?demo=true
```

### Demo Mode Features

1. **No Token Required**: Game can run without authentication
2. **Mock Balance**: Returns fixed balance of 10000 (can be updated dynamically)
3. **Analytics Endpoint**: Uses analytics endpoint for spins
4. **Simplified Requests**: Uses simplified request body structure
5. **Single Balance Fetch**: Balance is only fetched once during initialization
6. **Dynamic Balance Updates**: Demo balance is updated during gameplay:
   - **Wins (base game only)**: Updated from the `WIN_STOP` handler when not in scatter/bonus (only once per spin)
   - **Bet deductions**: Updated in `SlotController.decrementBalanceByBet()`
   - **Buy Feature deductions**: Updated in `SlotController.handleBuyFeature()`
7. **Currency Symbol Removal**: All currency symbols are hidden in demo mode, with value texts repositioned accordingly
8. **History Tab Disabled**: History tab is visible but non-interactive in demo mode, with no history API calls made

## Constants Reference

| Constant | Type | Value | Usage |
|----------|------|-------|-------|
| `GAME_ID` | `string` | `'00060725'` | Game identifier in API requests |
| `DEMO_BALANCE` | `number` | `10000` | Default balance in demo mode |

## Methods Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getDemoState()` | `boolean` | Gets demo state from URL parameters (returns `true` if `demo=true`, otherwise `false`) |
| `getGameId()` | `string` | Gets the game ID constant |
| `getDemoBalance()` | `number` | Gets the demo balance constant |
| `updateDemoBalance(newBalance)` | `void` | Updates the demo balance constant |

## Balance Management in Demo Mode

### Initial Balance
- Set to `DEMO_BALANCE` constant (10000) when game initializes
- Retrieved via `getBalance()` which returns mock data in demo mode

### Balance Updates During Gameplay
- **After Wins (base game only)**: Demo balance is updated in `WIN_STOP` event handler when not in scatter/bonus (Game.ts)
  - Adds win amount to current demo balance
  - Uses `updateDemoBalance()` to sync the constant
  - Only runs once per spin (controlled by `demoBalanceUpdatedThisSpin` boolean)
  - Flag is reset on `REELS_START` event
- **After Bet Deductions**: Balance is decremented locally in `SlotController.decrementBalanceByBet()` and demo balance is synced
- **After Buy Feature Purchase**: Balance is decremented locally in `SlotController.handleBuyFeature()` and demo balance is synced
- **No Server Calls**: Balance updates from server are skipped in demo mode

### Balance Synchronization
- `updateDemoBalance()` method allows dynamic updates to the demo balance constant
- Balance changes are tracked locally and reflected in the UI immediately
- No API calls are made to update balance in demo mode

## Notes

- Demo mode is detected at initialization and stored for the session
- All demo-related checks use the same detection pattern for consistency
- Demo mode bypasses authentication requirements
- Balance updates are prevented in demo mode after initial fetch
- Demo mode uses different API endpoints optimized for analytics/testing
- Demo balance is updated dynamically during gameplay to reflect wins and bet deductions
- Demo balance update on wins is limited to once per spin to prevent duplicate updates

