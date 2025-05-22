import { GameData, Slot } from "./GameData";


export class Cheat {

	constructor() {
		this.active = false;
	}

	preload(scene) {
		this.scene = scene
	}

	create(scene) {
		//scene.input.keyboard.on('keydown-C', this.handleCKeyPress, this);
	}

	update(scene, time, delta) {

	}

	end() {

	}


	handleCKeyPress() {
		return;
		GameData.CHEAT_COMBINATION_ENABLED = !GameData.CHEAT_COMBINATION_ENABLED
		console.log(`Cheat is ${GameData.CHEAT_COMBINATION_ENABLED}`)

		if (!GameData.CHEAT_COMBINATION_ENABLED) {
			return
		}

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
