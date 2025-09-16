import { Wins } from "./SymbolDetector";

export class Data {
  public static SLOT_COLUMNS: number = 3;
  public static SLOT_ROWS: number = 5;
  public static SCATTER: number[] = [0];
  public static NORMAL_SYMBOLS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  public static WILDCARDS: number[] = [12, 13, 14]; // 12 = x2, 13 = x3, 14 = x4
  public static ALL_SYMBOLS: number[] = [...Data.SCATTER, ...Data.NORMAL_SYMBOLS, ...Data.WILDCARDS];
  public static SCATTER_MULTIPLIERS: number[] = [9, 11, 13, 15, 17, 19, 21, 23, 25, 27];

  public static DELAY_BETWEEN_SPINS: number = 2500;

  public static WINLINES: number[][][] = [
    [
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
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
      [0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0],
    ],
    [
      [0, 0, 1, 0, 0],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
    [
      [0, 0, 0, 1, 1],
      [0, 0, 1, 0, 0],
      [1, 1, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1],
    ],
    [
      [0, 0, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
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
  ];
  public symbols: number[][];
  public wins: Wins;

  public balance: number = 200000;
  public totalWins: number = 0;
  public bet: number = 10;
  public isScatter: boolean = false;
  public scatterIndex: number = 0;
  public isBonus: boolean = false;
  public bonusCount: number = 0;


  public timeScale: number = 1;
  public init: boolean = true;

  public isSpinning: boolean = false;
  public isNormalSpin: boolean = false;
  public isAutoPlaying: boolean = false;
	public isTurbo: boolean = false;

  public delayBetweenSpins: number = Data.DELAY_BETWEEN_SPINS;
  public spinTimer: number = 0;
  
  constructor() {
    this.symbols = [
			[1, 5, 1, 4 ,1],
			[0, 3, 2, 4, 1],
			[1, 2, 3, 1, 4],
		];
  }
}