/**
 * Console Debug Helpers
 * 
 * Provides console-callable debug functions for testing dialogs and mode switching.
 * 
 * Dialog Functions (DevTools console):
 *   showTotalWinDialog(12345)
 *   showTotalWinDialog(12345, { addSprites: true })
 *   showBigWinDialog(5000)
 *   showMegaWinDialog(15000)
 *   showEpicWinDialog(45000)
 *   showSuperWinDialog(90000)
 *   showMaxWinDialog(250000)
 *   showFreeSpinDialog(10)
 *   showRetriggerDialog(5) // bonus free spin dialog
 * 
 * Mode Toggle:
 *   Press Q to switch to normal/base mode
 *   Press E to switch to bonus mode
 * 
 * Global gate for ALL debug features (dialogs and Q/E mode toggle):
 * - Set to false to block:   window.__DEBUGGING_ON__ = false
 * - Re-enable:               window.__DEBUGGING_ON__ = true
 */

import { Input } from 'phaser';
import { MusicType } from '../managers/AudioManager';

// GameScene type - matches the Game class structure
type GameScene = any;

// Global debugging flag - accessible throughout the script
// Can be controlled via window.__DEBUGGING_ON__
const DEBUGGING_ON: boolean = true;

/**
 * Check if debugging features are enabled
 */
function isDebuggingEnabled(): boolean {
	if (!DEBUGGING_ON) {
		console.warn('[Debug] Debugging features are disabled (window.__DEBUGGING_ON__ = false).');
		return false;
	}
	return true;
}

/**
 * Initialize dialog debug helpers - exposes console functions for testing dialogs
 */
function initializeDialogDebugHelpers(): void {
	try {
		const w = window as any;

		const getGameScene = (): GameScene | null => {
			const phaserGame = w.phaserGame;
			return (
				phaserGame?.scene?.getScene?.('Game') ??
				phaserGame?.scene?.scenes?.find((s: any) => s?.scene?.key === 'Game')
			) as GameScene | null;
		};

		const getDialogs = () => {
			const gameScene = getGameScene();
			if (!gameScene) return { gameScene: null, dialogs: null };
			return { gameScene, dialogs: (gameScene as any).dialogs };
		};

		const closeIfOpen = (dialogs: any) => {
			try {
				if (typeof dialogs?.isDialogShowing === 'function' && dialogs.isDialogShowing()) {
					dialogs.hideDialog?.();
				}
			} catch {}
		};

		// Generic helper (optional, but handy)
		w.showDialog = (type: string, params?: any) => {
			if (!isDebuggingEnabled()) return false;
			const { gameScene, dialogs } = getDialogs();
			if (!gameScene) {
				console.warn('[Debug] Game scene not found. Is the game running?');
				return false;
			}
			if (!dialogs || typeof dialogs.showDialog !== 'function') {
				console.warn('[Debug] dialogs.showDialog not available on Game scene.');
				return false;
			}
			closeIfOpen(dialogs);
			dialogs.showDialog(gameScene, { type, ...(params || {}) });
			return true;
		};

		w.showTotalWinDialog = (winAmount: number = 1000, opts?: { addSprites?: boolean; closeExisting?: boolean }) => {
			if (!isDebuggingEnabled()) return false;
			const addSprites = opts?.addSprites ?? false;
			const closeExisting = opts?.closeExisting ?? true;

			const { gameScene, dialogs } = getDialogs();
			if (!gameScene) {
				console.warn('[Debug] Game scene not found. Is the game running?');
				return false;
			}
			if (!dialogs || typeof dialogs.showCongratulations !== 'function') {
				console.warn('[Debug] dialogs.showCongratulations not available on Game scene.');
				return false;
			}

			if (closeExisting) closeIfOpen(dialogs);
			dialogs.showCongratulations(gameScene, { winAmount: Number(winAmount) || 0 });
			try {
				if (addSprites && typeof dialogs.addTotalWinSprites === 'function') {
					dialogs.addTotalWinSprites(gameScene);
				}
			} catch {}
			return true;
		};

		// Win dialogs
		w.showBigWinDialog = (winAmount: number = 5000) => (isDebuggingEnabled() ? w.showDialog('BigWin', { winAmount: Number(winAmount) || 0 }) : false);
		w.showMegaWinDialog = (winAmount: number = 15000) => (isDebuggingEnabled() ? w.showDialog('MegaWin', { winAmount: Number(winAmount) || 0 }) : false);
		w.showEpicWinDialog = (winAmount: number = 45000) => (isDebuggingEnabled() ? w.showDialog('EpicWin', { winAmount: Number(winAmount) || 0 }) : false);
		w.showSuperWinDialog = (winAmount: number = 90000) => (isDebuggingEnabled() ? w.showDialog('SuperWin', { winAmount: Number(winAmount) || 0 }) : false);
		w.showMaxWinDialog = (winAmount: number = 250000) => (isDebuggingEnabled() ? w.showDialog('MaxWin', { winAmount: Number(winAmount) || 0 }) : false);

		// Free spin dialogs
		w.showFreeSpinDialog = (freeSpins: number = 10) => (isDebuggingEnabled() ? w.showDialog('FreeSpinDialog', { freeSpins: Number(freeSpins) || 0 }) : false);
		w.showRetriggerDialog = (freeSpins: number = 5) => (isDebuggingEnabled() ? w.showDialog('BonusFreeSpinDialog', { freeSpins: Number(freeSpins) || 0 }) : false);

		// Back-compat alias (some folks type this instinctively)
		w.totalWinDialog = w.showTotalWinDialog;
	} catch {}
}

/**
 * Handle mode toggle between normal and bonus mode
 */
function handleModeToggle(gameScene: GameScene, isBonus: boolean): void {
	if (!isDebuggingEnabled()) {
		return;
	}

	if (gameScene.gameStateManager.isBonus === isBonus) {
		console.log(`[Debug] Already in ${isBonus ? 'bonus' : 'base'} mode`);
		return;
	}

	gameScene.gameStateManager.isBonus = isBonus;
	gameScene.switchBetweenModes(isBonus);

	if (isBonus) {
		gameScene.audioManager?.playBackgroundMusic(MusicType.BONUS);
	} else {
		gameScene.audioManager?.playBackgroundMusic(MusicType.MAIN);
	}
}

/**
 * Initialize mode toggle keys (Q for normal, E for bonus)
 * Returns cleanup function to remove event listeners
 */
function setupModeToggleKeys(gameScene: GameScene): () => void {
	const keyboard = gameScene.input?.keyboard;
	if (!keyboard) {
		console.warn('[Debug] Keyboard input not available for mode toggle');
		return () => {}; // Return no-op cleanup function
	}

	const baseKey = keyboard.addKey(Input.Keyboard.KeyCodes.Q);
	const bonusKey = keyboard.addKey(Input.Keyboard.KeyCodes.E);

	baseKey.on('down', () => handleModeToggle(gameScene, false));
	bonusKey.on('down', () => handleModeToggle(gameScene, true));

	const cleanup = () => {
		baseKey.destroy();
		bonusKey.destroy();
	};

	// Register cleanup on scene shutdown
	gameScene.events.once('shutdown', cleanup);

	return cleanup;
}

/**
 * Initialize all console debug helpers
 * Call this from Game.ts create() method after dialogs are created
 */
export function initializeConsoleDebugHelpers(gameScene: GameScene): void {
	// Initialize dialog debug helpers
	initializeDialogDebugHelpers();

	// Setup mode toggle keys (Q/E)
	setupModeToggleKeys(gameScene);
}
