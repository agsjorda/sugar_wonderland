import { Data } from "../../tmp_backend/Data";
import { GameObjects } from 'phaser';
import { BackendEvent, BackendEvents } from "../../tmp_backend/BackendEvent";
import { Game } from "../scenes/Game";
import { EventManager, GameEvents } from "../../event/EventManager";
import { GameData, setSpeed } from "./GameData";
type Sprite = GameObjects.Sprite;

export class Symbols {
  
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene: Game;
  public container: Phaser.GameObjects.Container;
  public displayWidth: number;
  public displayHeight: number;
  public horizontalSpacing: number;
  public verticalSpacing: number;
  public symbols: Phaser.GameObjects.Sprite[][];
  public newSymbols: Phaser.GameObjects.Sprite[][];
  public slotX: number;
  public slotY: number;
  public totalGridWidth: number;
  public totalGridHeight: number;

  constructor() { }

  public preload(scene: Game) {
    this.scene = scene;
    initVariables(this);
    loadImages(this)
  }

  public create() {
    createContainer(this);
    onStart(this);
    onSpinResponse(this);
    this.onSpinDone(this.scene);
  }

  private onSpinDone(scene: Game) {
    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      BackendEvent.emit(BackendEvents.SPIN, data);
    });
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.4875;
  let centerY = self.scene.scale.height * 0.41;

  self.symbols = [];
  self.newSymbols = [];
  self.displayWidth = 184;
  self.displayHeight = 184;
  self.horizontalSpacing = 20;
  self.verticalSpacing = 5;

  let spacingX = self.horizontalSpacing * (Data.SLOT_ROWS - 1);
  let spacingY = self.verticalSpacing * (Data.SLOT_COLUMNS - 1);
  self.totalGridWidth = (self.displayWidth * Data.SLOT_ROWS) + spacingX;
  self.totalGridHeight = (self.displayHeight * Data.SLOT_COLUMNS) + spacingY;

  self.slotX = centerX;
  self.slotY = centerY;
}

function loadImages(self: Symbols) {
  for (let i = 0; i < Data.ALL_SYMBOLS.length; i++) {
    self.scene.load.image('symbol_' + i, 'assets/symbols/Symbol' + i + '_KA.png');
  }
}

// create()
function createContainer(self: Symbols) {
  self.container = self.scene.add.container(0, 0);

  const maskShape = self.scene.add.graphics();
  maskShape.fillRect(
    self.slotX - self.totalGridWidth * 0.5, 
    self.slotY - self.totalGridHeight * 0.5, 
    self.totalGridWidth, 
    self.totalGridHeight
  );

  const mask = maskShape.createGeometryMask();
  self.container.setMask(mask);
  maskShape.setVisible(false);
}

function onStart(self: Symbols) {
  BackendEvent.on(BackendEvents.RESPONSE, (data: Data) => {
    if (!data.init) {
      return;
    }

    let scene = self.scene;

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

    const startX = self.slotX - self.totalGridWidth * 0.5;
    const startY = self.slotY - self.totalGridHeight * 0.5;

    let symbols = data.symbols;
    for (let col = 0; col < symbols.length; col++) {
      let rows = [];
      for (let row = 0; row < symbols[col].length; row++) {

        const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
				const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

        let symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
        symbol.displayWidth = self.displayWidth;
        symbol.displayHeight = self.displayHeight;
        self.container.add(symbol);

        rows.push(symbol);
      }

      self.symbols.push(rows);
    }
  });
}

function onSpinResponse(self: Symbols) {
  BackendEvent.on(BackendEvents.RESPONSE, async (data: Data) => {
    if (data.init) {
      return;
    }

    if (self.scene.gameData.isSpinning) {
      return;
    }
    self.scene.gameData.isSpinning = true;

    setSpeed(self.scene.gameData, data.delayBetweenSpins);
    createNewSymbols(self, data);
    await dropReels(self, data);
    
    disposeSymbols(self.symbols);
    self.symbols = self.newSymbols;
    self.newSymbols = [];
    tintWinSymbols(self, data);

    EventManager.emit(GameEvents.REEL_DONE, data);
    self.scene.gameData.isSpinning = false;
  });
}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;
  disposeSymbols(self.newSymbols);
  self.newSymbols = [];

  const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;

  const adjY = self.scene.scale.height * -1.0;

  const startX = self.slotX - self.totalGridWidth * 0.5;
  const startY = self.slotY - self.totalGridHeight * 0.5 + adjY;

  let symbols = data.symbols;
  for (let col = 0; col < symbols.length; col++) {
    let rows = [];
    for (let row = 0; row < symbols[col].length; row++) {

      const x = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
      const y = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

      let symbol = scene.add.sprite(x, y, 'symbol_' + symbols[col][row]);
      symbol.displayWidth = self.displayWidth;
      symbol.displayHeight = self.displayHeight;
      self.container.add(symbol);

      rows.push(symbol);
    }

    self.newSymbols.push(rows);
  }
}

async function dropReels(self: Symbols, data: Data) {
  if (data.init) { 
    data.init = false;
    return;
  }

  for (let row = 0; row < Data.SLOT_ROWS; row++) {
    dropPrevSymbols(self, row)
    dropFillers(self, row)
    dropNewSymbols(self, row)
    await delay(self.scene.gameData.dropReelsDelay)
  }
  await delay(self.scene.gameData.dropReelsDuration)
}

function dropPrevSymbols(self: Symbols, index: number) {
  if (self.symbols === undefined || self.symbols === null) {
    return;
  }

  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const DROP_DISTANCE = Symbols.FILLER_COUNT * height + self.scene.gameData.winUpHeight;

  for (let i = 0; i < self.symbols.length; i++) {
    self.scene.tweens.chain({
      targets: self.symbols[i][index],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropDuration * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        }
      ]
    })
  }
}

function dropFillers(self: Symbols, index: number) {
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const TOTAL_ITEMS = Symbols.FILLER_COUNT + Data.SLOT_COLUMNS;
  const DROP_DISTANCE = TOTAL_ITEMS * height + GameData.WIN_UP_HEIGHT;
  const fillerSymbols: Sprite[] = [];
  for (let i = 0; i < Symbols.FILLER_COUNT; i++) {

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -Symbols.FILLER_COUNT;
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y)


    let symbol = self.scene.add.sprite(x, y, 'symbol_' + Math.floor(Math.random() * Data.ALL_SYMBOLS.length));
    symbol.displayWidth = self.displayWidth;
    symbol.displayHeight = self.displayHeight;
    self.container.add(symbol);

    fillerSymbols.push(symbol);
  }

  for (let i = 0; i < fillerSymbols.length; i++) {
    self.scene.tweens.chain({
      targets: fillerSymbols[i],
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropDuration * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
          onComplete: () => {
            fillerSymbols[i].destroy();
          }
        }
      ]
    })

  }
}

function dropNewSymbols(self: Symbols, index: number) {
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const START_INDEX = Symbols.FILLER_COUNT + Data.SLOT_COLUMNS;
  const DROP_DISTANCE = START_INDEX * height + self.scene.gameData.winUpHeight;

  for (let col = 0; col < self.newSymbols.length; col++) {
    let symbol = self.newSymbols[col][index];

    const START_INDEX_Y = -(Symbols.FILLER_COUNT + Data.SLOT_COLUMNS);
    const y = getYPos(self, col + START_INDEX_Y)
    symbol.y = y;
    
    self.scene.tweens.chain({
      targets: symbol,
      tweens: [
        {
          y: `-= ${self.scene.gameData.winUpHeight}`,
          duration: self.scene.gameData.winUpDuration,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: self.scene.gameData.dropDuration * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: self.scene.gameData.dropDuration * 0.05,
          ease: Phaser.Math.Easing.Linear,
        }
      ]
    })
  }
}


function disposeSymbols(symbols: Phaser.GameObjects.Sprite[][]) {
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      symbols[col][row].destroy();
    }
  }
}


function getYPos(self: Symbols, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}


function tintWinSymbols(self: Symbols, data: Data) {
  const wins = data.wins;

  for (const win of wins.allMatching.values()) {
    for (const grid of win) {
      self.symbols[grid.y][grid.x].setTint(0xFFFFFF);
      self.symbols[grid.y][grid.x].setBlendMode(Phaser.BlendModes.ADD);

      self.scene.tweens.add({
        targets: self.symbols[grid.y][grid.x],
        alpha: 0.5, 
        duration: 250, 
        ease: Phaser.Math.Easing.Sine.InOut,
        yoyo: true,
        repeat: -1,
      });
    }
  }
}


async function delay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}

