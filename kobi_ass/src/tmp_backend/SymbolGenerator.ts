import { Data } from "./Data";


export class SymbolGenerator {
	public static SCATTER_ROWS: number[] = [0, 2, 4];
	public static WILDCARD_ROWS: number[] = [1, 2, 3];

  public generate(): number[][] {
		const newValues = [];

		for (let col = 0; col < Data.SLOT_COLUMNS; col++) {
			let rowValues: number[] = [];
			for (let row = 0; row < Data.SLOT_ROWS; row++) {
				let value = this.getValue(row, [])
				rowValues.push(value);
			}
			newValues.push(rowValues);
		}

		this.removeScatterDuplicates(newValues);

		return newValues;
  }


	private getValue(row: number, exclude: number[]): number {
		const selection = [];
		// Scatter only spawn at 0, 2, 4 indices
		// The exclusion should match using array instead of single value
		if (SymbolGenerator.SCATTER_ROWS.includes(row) && !this.hasMatched(Data.SCATTER, exclude)) {
			selection.push(...Data.SCATTER);
		}

		selection.push(...Data.NORMAL_SYMBOLS);

		// Wildcard only spawn at 1, 2, 3 indices
		if (SymbolGenerator.WILDCARD_ROWS.includes(row)) {
			selection.push(...Data.WILDCARDS);
		}

		return getRandomFromValues(selection);
	
	}

	private hasMatched(values: number[], exclude: number[]): boolean {
		for (let i = 0; i < exclude.length; i++) {
			if (values.includes(exclude[i])) {
				return true;
			}
		}
		return false;
	}

	private removeScatterDuplicates(newValues: number[][]): void {
		for (let row = 0; row < Data.SLOT_ROWS; row++) {
			let scatterCount = 0;
			for (let col = 0; col < Data.SLOT_COLUMNS; col++) {
				if (newValues[col][row] === Data.SCATTER[0]) {
					scatterCount++;
				}

				if (scatterCount > 1) {
					newValues[col][row] = this.getValue(row, Data.SCATTER);
				}
			}
		}
	}
}

function getRandomFromValues(values: number[]): number {
	const index = Math.floor(Math.random() * values.length);
	return values[index];
}



// TODO: Need mathematician to distribute the chances of scatter and wildcard spawns