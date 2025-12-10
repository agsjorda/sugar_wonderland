import { Data } from "../Data";
import { Multiplier, Payout } from "../Payout";
import { describe, it, expect, beforeEach } from 'vitest';
import { Grid, SymbolDetector } from "../SymbolDetector";


// Scatter 1, 3, 5
// Wildcard 2, 3, 4

describe('Payout', () => {
	let symbolDetector: SymbolDetector;

	beforeEach(() => {
		symbolDetector = new SymbolDetector();
	});

  it('should return 0 if no win', () => {
    const data = new Data();
		data.symbols = [
			[1, 0, 1, 4 ,1],
			[0, 3, 2, 4, 1],
			[1, 2, 3, 1, 4],
		];
    data.wins = symbolDetector.getWins(data);
    const payout = Payout.calc(data);
    expect(payout).toBe(0);
  });


	it('symbol 1 winline 0', () => {
    const data = new Data();

		data.bet = 1;
		data.symbols = [
			[1, 1, 1, 4 ,1],
			[0, 3, 2, 4, 1],
			[1, 2, 3, 1, 4],
		];

    data.wins = symbolDetector.getWins(data);
    const payout = Payout.calc(data);
    expect(payout).toBe(2.5);
  });

	it('symbol 1 winline 0, 10, 18', () => {
    const data = new Data();

		data.bet = 1;
		data.symbols = [
			[1, 1, 1, 4 ,1],
			[0, 1, 2, 4, 1],
			[1, 2, 3, 1, 4],
		];

    data.wins = symbolDetector.getWins(data);

    const payout = Payout.calc(data);
    expect(payout).toBe(7.5);
  });

});