import { Events } from 'phaser';
import { BackendEvent, BackendEvents } from './BackendEvent';
import { Data } from './Data';
import { SymbolDetector } from './SymbolDetector';
import { Payout } from './Payout';
import { SymbolGenerator } from './SymbolGenerator';

export class Backend {
  public static init() {
    const data = new Data();
    const symbolDetector = new SymbolDetector();

    BackendEvent.on(BackendEvents.START, () => {
      console.log('START');
      BackendEvent.emit(BackendEvents.START_RESPONSE, data);
    });

    BackendEvent.on(BackendEvents.SPIN, () => {
      setNewSymbols(data);
      processWinlines(data);
      data.balance -= data.bet;
      data.totalWins = 0;

      processPayout(data);
      BackendEvent.emit(BackendEvents.SPIN_RESPONSE, {...data});
    });
  }
}

function setNewSymbols(data: Data) {
  // data.symbols = [
  //   [0, 1, 0, 1, 0],
  //   [1, 5, 2, 5, 2],
  //   [2, 5, 5, 1, 5]
  // ];

  const symbolGenerator = new SymbolGenerator();
  data.symbols = symbolGenerator.generate();
}

function processWinlines(data: Data) {
  const symbolDetector = new SymbolDetector();
  const wins = symbolDetector.getWins(data);
  data.wins = wins;


  const scatterGrids = symbolDetector.getScatterGrids(data);
  if (scatterGrids.length === 3) {
    console.log('scatter');
  }
}

function processPayout(data: Data) {
  const payout = Payout.calc(data);
  // console.log(payout);

  data.balance += payout;
  data.totalWins += payout;

  // BackendEvent.emit(BackendEvents.BALANCE_RESPONSE, data.balance);
  // BackendEvent.emit(BackendEvents.TOTAL_WIN_RESPONSE, data.totalWins);
}



/*
  BackendEvents
    Need event check

  ClientEvents
    SPIN

*/
