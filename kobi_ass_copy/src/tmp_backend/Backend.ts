import { Events } from 'phaser';
import { BackendEvent, BackendEvents } from './BackendEvent';
import { Data } from './Data';
import { SymbolDetector, Wins } from './SymbolDetector';
import { Payout } from './Payout';
import { SymbolGenerator } from './SymbolGenerator';

export class Backend {
  private static data: Data = new Data();
  
  public static init() {
    let data = Backend.data;
    BackendEvent.on(BackendEvents.START, () => {
      console.log('START');
      data.spinTimer = data.delayBetweenSpins;
      data.init = true;
      data.wins = new Wins(new Map());
      data.symbols = [
        [0, 1, 3, 1, 0],
        [1, 5, 2, 5, 2],
        [2, 5, 5, 1, 5]
      ];
      data.totalWins = 0;

      processPayout(data);
      BackendEvent.emit(BackendEvents.RESPONSE, {...data});
      data.init = false;
    });

    BackendEvent.on(BackendEvents.SPIN, () => {
      data.isNormalSpin = true;
      data.isAutoPlaying = false;
      data.isTurbo = false;
    });

    
    BackendEvent.on(BackendEvents.AUTO, () => {
      data.isNormalSpin = false;
      data.isAutoPlaying = !data.isAutoPlaying;
      data.isTurbo = false;
    });

    BackendEvent.on(BackendEvents.TURBO, () => {
      data.isNormalSpin = false;
      data.isAutoPlaying = false;
      data.isTurbo = !data.isTurbo;
    });
  }

  public static update(delta: number) {
    if (Backend.data.isSpinning) {
      Backend.data.spinTimer -= delta;

      if (Backend.data.spinTimer <= 0) {
        Backend.data.isSpinning = false;
        Backend.data.spinTimer = Backend.data.delayBetweenSpins;
      }
    }

    if (!Backend.data.isSpinning && Backend.data.isNormalSpin) {
      setSpeed(Backend.data, Data.DELAY_BETWEEN_SPINS)
      Backend.data.isNormalSpin = false;
      spin(Backend.data);
    }

    if (!Backend.data.isSpinning && Backend.data.isAutoPlaying) {
      setSpeed(Backend.data, Data.DELAY_BETWEEN_SPINS)
      spin(Backend.data);
    }

    if (!Backend.data.isSpinning && Backend.data.isTurbo) {
      setSpeed(Backend.data, Data.DELAY_BETWEEN_SPINS * 0.25)
      spin(Backend.data);
    }
    
  }
}

function spin(data: Data) {
  data.isSpinning = true;
  setNewSymbols(data);
  processWinlines(data);
  data.balance -= data.bet;
  data.totalWins = 0;
  processPayout(data);
  BackendEvent.emit(BackendEvents.RESPONSE, {...data});
}


function setSpeed(data: Data, delay: number) {
  data.delayBetweenSpins = delay;
  data.spinTimer = delay;
}


function setNewSymbols(data: Data) {
  const symbolGenerator = new SymbolGenerator();
  if (data.isBonus && data.bonusCount > 0) {
    // data.symbols = symbolGenerator.generate(Data.SCATTER);

    // data.bonusCount--;
    // if (data.bonusCount === 0) {
    //   data.isBonus = false;
    // }
    // console.log(`Bonus count: ${data.bonusCount} isScatter: ${data.isScatter} isBonus: ${data.isBonus}`);
  } 
  
  if (!data.isScatter && !data.isBonus) {
    data.symbols = symbolGenerator.generate();
    // data.symbols = [
    //   [0, 1, 0, 1, 0],
    //   [1, 5, 2, 5, 2],
    //   [2, 5, 5, 1, 5]
    // ];
  }

 
}

function processWinlines(data: Data) {
  const symbolDetector = new SymbolDetector();
  const wins = symbolDetector.getWins(data);
  data.wins = wins;

  const scatterGrids = symbolDetector.getScatterGrids(data);
  if (scatterGrids.length === 3) {
    data.isScatter = true;
    data.scatterIndex = Math.floor(Math.random() * Data.SCATTER_MULTIPLIERS.length);
    data.bonusCount = Data.SCATTER_MULTIPLIERS[data.scatterIndex];
  }
}

function processPayout(data: Data) {
  const payout = Payout.calc(data);
  data.balance += payout;
  data.totalWins += payout;
}