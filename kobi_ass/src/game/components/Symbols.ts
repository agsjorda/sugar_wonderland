import { Scene } from "phaser";
import { EventManager, GameEvents } from "../../event/EventManager";
import { Data } from "../../tmp_backend/MockBackend";
import { GameObjects } from 'phaser';
type Sprite = GameObjects.Sprite;

export class Symbols {  
  public static WIND_UP_HEIGHT: number = 50;
  public static WIND_UP_DURATION: number = 500;
  public static DROP_DURATION: number = 1000;
  public static FILLER_COUNT: number = 20;
  public reelCount: number = 0;
  public scene: Scene;
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

  public preload(scene: Scene) {
    this.scene = scene;
    initVariables(this);
    loadImages(this)
  }

  public create() {
    createContainer(this);
    onStart(this);
    onSpinResponse(this);
  }
}

// preload()
function initVariables(self: Symbols) {
  let centerX = self.scene.scale.width * 0.4875;
  let centerY = self.scene.scale.height * 0.41;

  // let centerX = self.scene.scale.width * 0.5;
  // let centerY = self.scene.scale.height * 0.5;

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
  for (let i = 0; i < Data.TOTAL_SYMBOLS; i++) {
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
  EventManager.on(GameEvents.START_RESPONSE, (data: Data) => {
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
  EventManager.on(GameEvents.SPIN_RESPONSE, async (data: Data) => {
    createNewSymbols(self, data);
    await dropReels(self, data)
    disposeSymbols(self.symbols);
    self.symbols = self.newSymbols;
    self.newSymbols = [];
    

    EventManager.emit(GameEvents.WINLINE_REQUEST);
  });
}

function createNewSymbols(self: Symbols, data: Data) {
  let scene = self.scene;

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
  for (let row = 0; row < Data.SLOT_ROWS; row++) {
    dropPrevSymbols(self, row)
    dropFillers(self, row)
    dropNewSymbols(self, row)
    await delay(200)
  }
  await delay(2000)
}




async function delay(duration: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, duration);
  });
}



function dropPrevSymbols(self: Symbols, index: number) {
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const DROP_DISTANCE = Symbols.FILLER_COUNT * height + Symbols.WIND_UP_HEIGHT;

  for (let i = 0; i < self.symbols.length; i++) {
    self.scene.tweens.chain({
      targets: self.symbols[i][index],
      tweens: [
        {
          y: `-= ${Symbols.WIND_UP_HEIGHT}`,
          duration: Symbols.WIND_UP_DURATION,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: Symbols.DROP_DURATION * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        }
      ]
    })
  }
}

function dropFillers(self: Symbols, index: number) {
  const height = self.symbols[0][0].displayHeight + self.verticalSpacing;
  const TOTAL_ITEMS = Symbols.FILLER_COUNT + Data.SLOT_COLUMNS;
  const DROP_DISTANCE = TOTAL_ITEMS * height + Symbols.WIND_UP_HEIGHT;
  const fillerSymbols: Sprite[] = [];
  for (let i = 0; i < Symbols.FILLER_COUNT; i++) {

    const symbolTotalWidth = self.displayWidth + self.horizontalSpacing;
    const startX = self.slotX - self.totalGridWidth * 0.5;

    const START_INDEX_Y = -Symbols.FILLER_COUNT;
    const x = startX + index * symbolTotalWidth + symbolTotalWidth * 0.5;
    const y = getYPos(self, i + START_INDEX_Y)

    let symbol = self.scene.add.sprite(x, y, 'symbol_' + Math.floor(Math.random() * Data.TOTAL_SYMBOLS));
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
          y: `-= ${Symbols.WIND_UP_HEIGHT}`,
          duration: Symbols.WIND_UP_DURATION,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: Symbols.DROP_DURATION * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
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

  const DROP_DISTANCE = START_INDEX * height + Symbols.WIND_UP_HEIGHT;

  for (let col = 0; col < self.newSymbols.length; col++) {
    let symbol = self.newSymbols[col][index];

    const START_INDEX_Y = -(Symbols.FILLER_COUNT + Data.SLOT_COLUMNS);
    const y = getYPos(self, col + START_INDEX_Y)
    symbol.y = y;
    

    self.scene.tweens.chain({
      targets: symbol,
      tweens: [
        {
          y: `-= ${Symbols.WIND_UP_HEIGHT}`,
          duration: Symbols.WIND_UP_DURATION,
          ease: Phaser.Math.Easing.Circular.Out,
        },
        {
          y: `+= ${DROP_DISTANCE}`,
          duration: Symbols.DROP_DURATION * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `+= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          y: `-= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        }
      ]
    })
  }
}






function playWindUpAnimation(self: Symbols, fillers: Sprite[], index: number) {
  for (let i = 0; i < self.symbols.length; i++) {
    self.scene.tweens.add({
      targets: self.symbols[i][index],
      y: `-= ${Symbols.WIND_UP_HEIGHT}`,
      duration: Symbols.WIND_UP_DURATION,
      ease: Phaser.Math.Easing.Circular.Out,
    });

    console.log("wind up", i)
  }
  
  // for (let i = 0; i < fillers.length; i++) {
  //   const filler = fillers[i];
  //   self.scene.tweens.add({
  //     targets: filler,
  //     y: `-= ${Symbols.WIND_UP_HEIGHT}`,
  //     duration: Symbols.WIND_UP_DURATION,
  //     ease: Phaser.Math.Easing.Circular.Out,
  //   });
  // }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, Symbols.WIND_UP_DURATION);
  });
}

function playDropAnimation(self: Symbols, fillers: Sprite[], index: number) { 
  const TOTAL_ITEMS = fillers.length;
  const SYMBOL_HEIGHT = fillers[0].displayHeight + self.verticalSpacing;
  const DROP_DISTANCE = TOTAL_ITEMS * SYMBOL_HEIGHT + Symbols.WIND_UP_HEIGHT;
  for (let i = 0; i < self.symbols.length; i++) {
    self.scene.tweens.add({
      targets: self.symbols[i][index],
      y: `+= ${DROP_DISTANCE}`,
      duration: Symbols.DROP_DURATION * 0.9,
      ease: Phaser.Math.Easing.Linear,
    });
  }
  
  for (let i = 0; i < fillers.length; i++) {
    const filler = fillers[i];
    self.scene.tweens.chain({
      targets: filler,
      tweens: [
        {
          targets: filler,
          y: `+= ${DROP_DISTANCE}`,
          duration: Symbols.DROP_DURATION * 0.9,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          targets: filler,
          y: `+= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
        {
          targets: filler,
          y: `-= ${40}`,
          duration: Symbols.DROP_DURATION * 0.05,
          ease: Phaser.Math.Easing.Linear,
        },
      ]
    })
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, Symbols.DROP_DURATION);
  });
}

function appendNewSymbols(self: Symbols, fillers: Sprite[], index: number) {
  const startIndex = fillers.length + Data.SLOT_COLUMNS;
  for (let i = 0; i < self.newSymbols.length; i++) {
    const clone = cloneSprite(self, self.newSymbols[i][index])
    clone.y = getYPos(self, i - startIndex)
    fillers.push(clone);
  }
}



function disposeSymbols(symbols: Phaser.GameObjects.Sprite[][]) {
  for (let col = 0; col < symbols.length; col++) {
    for (let row = 0; row < symbols[col].length; row++) {
      symbols[col][row].destroy();
    }
  }
}

function goToSymbolPosition(
  symbol: Phaser.GameObjects.Sprite, 
  targetY: number,
  duration: number
) {
  symbol.scene.tweens.add({
    targets: symbol,
    y: targetY,
    duration: duration,
    ease: 'power2.inOut',
  });
}


function cloneSprite(self: Symbols, original: Sprite): Sprite {
  const clone = self.scene.add.sprite(original.x, original.y, original.texture.key, original.frame.name);

  // Copy other desired properties
  clone.setScale(original.scaleX, original.scaleY);
  clone.setAlpha(original.alpha);
  clone.setFlip(original.flipX, original.flipY);
  clone.rotation = original.rotation;
  clone.setDepth(original.depth);
  clone.setTint(original.tintTopLeft);

  self.container.add(clone);

  return clone;
}


function getYPos(self: Symbols, index: number) {
  const symbolTotalHeight = self.displayHeight + self.verticalSpacing;
  const startY = self.slotY - self.totalGridHeight * 0.5;

  return startY + index * symbolTotalHeight + symbolTotalHeight * 0.5;
}