import { EventManager, GameEvents } from "../event/EventManager";

export class MockBackend {
  private static instance: MockBackend;
  private data: Data;

  private constructor() {
    this.data = new Data();
  }

  private static getInstance(): MockBackend {
    if (!MockBackend.instance) {
      MockBackend.instance = new MockBackend();
    }
    return MockBackend.instance;
  }

  public static init(): void {
    let backend = MockBackend.getInstance();
    
    // Implement backend logic here
    start(backend.data);
    spin(backend.data);
    winline(backend.data);
  }
}

export class Data {
  public static SLOT_COLUMNS: number = 3;
  public static SLOT_ROWS: number = 5;
  public static TOTAL_SYMBOLS: number = 12;

  symbols: number[][];

  constructor() {
    this.symbols = [
      [0, 1, 2, 3, 4],
      [3, 4, 5, 6, 7],
      [6, 7, 8, 9, 0]
    ];
  }
}


function start(data: Data) {
  EventManager.on(GameEvents.START_REQUEST, () => {
    // Do some magic here

    EventManager.emit(GameEvents.START_RESPONSE, data);
  });
}

function spin(data: Data) {
  EventManager.on(GameEvents.SPIN_REQUEST, () => {

    setNewSymbols(data);
    EventManager.emit(GameEvents.SPIN_RESPONSE, data);
  });
}

function winline(data: Data) {
  EventManager.on(GameEvents.WINLINE_REQUEST, () => {
    // const lineData = getMatchResult(data);

    console.log('winline', data);
  });
}




function setNewSymbols(data: Data) {
  data.symbols = [
    [0, 0, 5, 1, 0],
    [1, 5, 2, 5, 2],
    [2, 5, 5, 1, 5]
  ];

  // for (let col = 0; col < Data.SLOT_COLUMNS; col++) {
  //   for (let row = 0; row < Data.SLOT_ROWS; row++) {
  //     data.symbols[col][row] = Math.floor(Math.random() * Data.TOTAL_SYMBOLS);
  //   }
  // }

}

/*
 * Getting all the matched symbols count and index on the winline
 *  Iterate to winlines
 *  Return the matched symbol and count
 */




// function getWinlineIndexAndSymbol(data: Data): [number, number] {
//   const results = [];

//   for (let index = 0; index < WINLINES.length; index++) {
//     const winline = WINLINES[index];
//     const symbol = getMatchResult(data, winline);
//     if (symbol != -1) {
//       // return [index, symbol];
//       results.push([index, symbol]);
//     }
//   }
//   return [-1, -1];
// }

/* function getMatchResult(data: Data, winline: number[][]): SymbolsResult {
  let res = new SymbolsResult();
  for (let col = 0; col < Data.SLOT_COLUMNS; col++) {
    for (let row = 0; row < Data.SLOT_ROWS; row++) {
      if (winline[col][row] === 0) {
        continue;
      }

      if (res.matchedCount === 0) {
        res.matchedSymbol = data.symbols[col][row];
      }

      if (res.matchedSymbol === data.symbols[col][row]) {
        res.matchedCount++;
      }

    }
  }

  return res;
} */

// function getResults(data: Data) {
//   // TODO: Get all symbols and count on the winline

  
// }


export class SymbolsResult{
  public symbol: number;
  public count: number;
}


/* 
// Winline detection
const WINLINES = [
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
]

class WinlineData {
  public winlineIndex: number;
  public symbol: number;
  public count: number;
}
 */