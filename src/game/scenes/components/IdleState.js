import { State } from "../../fsm/state";
import { Events } from "./Events";
import { GameData, Slot } from "./GameData";
import { LoseState } from "./LostState";
import { WinState } from "./WinState";

export class IdleState extends State {
	start(scene) {
		this.scene = scene
		scene.gameData.currentRow = 0
		scene.gameData.isSpinning = false

		Events.emitter.emit(Events.START, { 
			symbols: scene.gameData.slot.values,
			currentRow: scene.gameData.currentRow
		});
		this.initEventListeners(scene)

		this.initCheat()
	}

	update(scene, time, delta) {}

	end() {
		Events.emitter.off(Events.SPIN, this.spinEventListener)
		this.spinEventListener = undefined

		Events.emitter.off(Events.CHANGE_LINE, this.changeLineListener)
		this.changeLineListener = undefined
	}


	spin(scene, data) {
		if (scene.gameData.isSpinning) { return }
		scene.gameData.isSpinning = true

		if(scene.gameData.freeSpins > 0) {
			scene.gameData.freeSpins--;
		}
		else {
			reduceBalance(scene)
		}

		const slot = scene.gameData.slot
		const newRandomValues = [];
		for (let i = 0; i < Slot.ROWS; i++) {
			newRandomValues[i] = getRandomRows(i);
		}
		for (let i = 0; i < Slot.ROWS; i++) {
			slot.setRows(newRandomValues[i], i);
		}
		// Place scatters after the grid is built
		slot.placeScatters(scene.gameData.minScatter, scene.gameData.maxScatter, scene.gameData.scatterChance);
		scene.gameData.minScatter = 0;
		Events.emitter.emit(Events.SPIN_ANIMATION_START, {
			symbols: slot.values,
			currentRow: scene.gameData.currentRow,
			newRandomValues: newRandomValues
		});
	}

	initEventListeners(scene) {
		this.spinEventListener = (...args) => {
			this.spin(scene, ...args);
		};

		Events.emitter.on(Events.SPIN, this.spinEventListener)

		this.changeLineListener = (...args) => {
			this.initSpin()
			//this.initCheat()
		}
		Events.emitter.on(Events.CHANGE_LINE, this.changeLineListener)
	}

	initSpin(){


	}

	initCheat() {
		if (!GameData.CHEAT_COMBINATION_ENABLED) return;

		let winLines = GameData.WIN_LINES[this.scene.gameData.line]
		const winSymbol = Math.floor(Math.random() * Slot.SYMBOLS)
		
		for (let y = 0; y < Slot.COLUMNS; y++) {
			for (let x = 0; x < Slot.ROWS; x++) {
				if (winLines[y][x] == 1) {
					GameData.CHEAT_COMBINATION[y][x] = winSymbol
				} else {
					GameData.CHEAT_COMBINATION[y][x] = Math.floor(Math.random() * Slot.SYMBOLS)
				}
			}
		}
	}
}


function isWinLineMatching(scene, slotRowIndex) {
	const slot = scene.gameData.slot
	scene.gameData.currentMatchingSymbols = []
	return;
	// Comparison
	const lineToMatch = GameData.WIN_LINES[scene.gameData.line]

	let symbolToDetect = -1
	for (let col = 0; col < Slot.COLUMNS; col++) {

		for (let row = 0; row <= slotRowIndex; row++) {
			const selectedSymbol = slot.values[col][row];
			const isDetect = lineToMatch[col][row];

			if (isDetect === 0) {	// 1 is the detect symbol
				continue;
			}

			// Set the starting symbol to detect
			if (symbolToDetect === -1) {
				symbolToDetect = selectedSymbol;
			} 

			if (symbolToDetect !== selectedSymbol) {
				return false
			}

			scene.gameData.currentMatchingSymbols.push(selectedSymbol)
		}
	}

	return true
}

export function getRandomRows(rowIndex) {
	if (GameData.CHEAT_COMBINATION_ENABLED) {
		return cheatRows(rowIndex)
	}
	let columns = [];
	for (let col = 0; col < Slot.COLUMNS; col++) {
		const index = Math.floor(Math.random() * Slot.SYMBOLS);
		columns.push(index);
	}
	return columns;
}

function cheatRows(rowIndex) {
	// 0 is top, 1 middle, 2 bottom
	// rowIndex represents from left to right

	const visualCheatCode = GameData.CHEAT_COMBINATION

	// Flipping to make it a per row to represent vertical reel
	let values = []
	for (let x = 0; x < Slot.ROWS; x++) {
		let reel = []
		for (let y = 0; y < Slot.COLUMNS; y++) {
			reel.push(visualCheatCode[y][x])
		}
		values.push(reel)
	}
	return values[rowIndex]
}



function reduceBalance(scene) {
	if(scene.gameData.doubleChanceEnabled) {
		scene.gameData.balance -= scene.gameData.getDoubleFeaturePrice();
	} else {
		scene.gameData.balance -= scene.gameData.bet;
	}
}






/**
 * Make everything work for now here
 * Then refactor later
 */