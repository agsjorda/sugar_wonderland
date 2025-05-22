export class GameData {
	// Set to true to return the exact value set in CHEAT_COMBINATION
	static CHEAT_COMBINATION_ENABLED = false
	static CHEAT_COMBINATION = [
		[1, 0, 0, 0, 1],
		[0, 0, 0, 0, 2],
		[0, 1, 1, 1, 0],
	];
	
	slot = new Slot();
	line = 0;
	currentRow = 0;
	bet = 18;

	balance = 18000;
	totalWin = 0;
	doubleChanceEnabled = false;
	isSpinning = false
	turbo = false;
	isBonusRound = false;

	scatterCount = 0;
	scatterChance = 0.025;
	maxScatter = 6;
	minScatter = 0;

	defaultMinScatter = 0;

	currentMatchingSymbols = [];
	doubleChanceMultiplier = 2;
	static WIN_LINES = [
		[
			[0, 0, 0, 0, 0],
			[1, 1, 1, 1, 1],
			[0, 0, 0, 0, 0],
		],
		[
			[1, 1, 1, 1, 1],
			[0, 0, 0, 0, 0],
			[0, 0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0, 0],
			[0, 0, 0, 0, 0],
			[1, 1, 1, 1, 1],
		],
		[
			[1, 0, 0, 0, 1],
			[0, 1, 0, 1, 0],
			[0, 0, 1, 0, 0],
		],
		[
			[0, 0, 1, 0, 0],
			[0, 1, 0, 1, 0],
			[1, 0, 0, 0, 1],
		],


		[
			[0, 1, 1, 1, 0],
			[1, 0, 0, 0, 1],
			[0, 0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0, 0],
			[1, 0, 0, 0, 1],
			[0, 1, 1, 1, 0],
		],
		[
			[1, 1, 0, 0, 0],
			[0, 0, 1, 0, 0],
			[0, 0, 0, 1, 1],
		],
		[
			[0, 0, 0, 1, 1],
			[0, 0, 1, 0, 0],
			[1, 1, 0, 0, 0],
		],
		[
			[0, 0, 0, 1, 0],
			[1, 0, 1, 0, 1],
			[0, 1, 0, 0, 0],
		],


		[
			[0, 1, 0, 0, 0],
			[1, 0, 1, 0, 1],
			[0, 0, 0, 1, 0],
		],
		[
			[1, 0, 0, 0, 1],
			[0, 1, 1, 1, 0],
			[0, 0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0, 0],
			[0, 1, 1, 1, 0],
			[1, 0, 0, 0, 1],
		],
		[
			[1, 0, 1, 0, 1],
			[0, 1, 0, 1, 0],
			[0, 0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0, 0],
			[0, 1, 0, 1, 0],
			[1, 0, 1, 0, 1],
		],


		[
			[0, 0, 1, 0, 0],
			[1, 1, 0, 1, 1],
			[0, 0, 0, 0, 0],
		],
		[
			[0, 0, 0, 0, 0],
			[1, 1, 0, 1, 1],
			[0, 0, 1, 0, 0],
		],
		[
			[1, 1, 0, 1, 1],
			[0, 0, 0, 0, 0],
			[0, 0, 1, 0, 0],
		],
		[
			[0, 0, 1, 0, 0],
			[0, 0, 0, 0, 0],
			[1, 1, 0, 1, 1],
		],
		[
			[1, 0, 0, 0, 1],
			[0, 0, 0, 0, 0],
			[0, 1, 1, 1, 0],
		],
	];

	freeSpins = 0;

	getDoubleFeaturePrice() {
		const doubleMultiplier = 1.25; // temporary multiplier
		return Math.round(this.bet * doubleMultiplier);
	}

	getBuyFeaturePrice() {
		const featureMultiplier = 100; // temporary multiplier
		return Math.round(this.bet * featureMultiplier * 100) / 100; 
	}
}

export class Slot {
	static SYMBOLS = 8;
	static ROWS = 5;
	static COLUMNS = 6;
	static SCATTER_SYMBOL = 99;
	values = [];
	scatterCount = 0;

	constructor() {
		// 5 x 6
		for (let x = 0; x < Slot.ROWS; x++) {
			let cols = [];
			for (let y = 0; y < Slot.COLUMNS; y++) {
				const symbolIndex = Math.floor(Math.random() * Slot.SYMBOLS)
				cols.push(symbolIndex);
			}
			this.values.push(cols);
		}
	}

	setRows(rowValues, index) {
		for (let y = 0; y < Slot.COLUMNS; y++) {
			this.values[index][y] = rowValues[y];
		}
	}

	placeScatters(minScatter = 0, maxScatter, scatterChance) {
		this.scatterCount = 0; // Reset before placing
		// Flatten all cell positions
		let allCells = [];
		for (let r = 0; r < Slot.ROWS; r++) {
			for (let c = 0; c < Slot.COLUMNS; c++) {
				allCells.push({ row: r, col: c });
			}
		}
		// Shuffle
		for (let i = allCells.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[allCells[i], allCells[j]] = [allCells[j], allCells[i]];
		}
		// Place scatters
		for (let i = 0; i < allCells.length && this.scatterCount < maxScatter; i++) {

			if (this.scatterCount < minScatter) {
					const { row, col } = allCells[i];
					this.values[row][col] = Slot.SCATTER_SYMBOL;
					this.scatterCount++;
			}
			else {
				if (Math.random() < scatterChance) {
					const { row, col } = allCells[i];
					this.values[row][col] = Slot.SCATTER_SYMBOL;
					this.scatterCount++;
				}
			}
		}

	}
}


