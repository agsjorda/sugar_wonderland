import { Scene } from "phaser";
import { BackendEvent, BackendEvents } from "../../tmp_backend/BackendEvent";
import { Game } from "../scenes/Game";
import { Data } from "../../tmp_backend/Data";
import { EventManager, GameEvents } from "../../event/EventManager";
import { gameSpin, setSpeed } from "./GameData";


export class Buttons {
  public scene: Game;
  public container: Phaser.GameObjects.Container;

  constructor() { }

  public preload(scene: Game) {
    this.scene = scene;
    loadImages(this);
  }

  public create() {
    createContainer(this);
    this.createTurbo();
    this.createSpin();
    this.createAutoPlay();
    this.createInfo();
    this.createBalance();
    this.createTotalWin();
    this.createBet();
  }

  private createTurbo() {
    const x = this.scene.scale.width * 0.83;
    const y = this.scene.scale.height * 0.29;
    const turbo = this.scene.add.image(x, y, 'turbo');
    turbo.setInteractive();
    this.container.add(turbo);

    let gameData = this.scene.gameData;

    turbo.on('pointerdown', () => {
      gameData.isTurbo = !gameData.isTurbo;
      gameData.isAutoPlaying = false;
      setSpeed(gameData, 3.0);
      gameSpin(gameData);
    });


    EventManager.on(GameEvents.SPIN_DONE, () => {
      if (gameData.isTurbo) {
        setSpeed(gameData, 3.0);
        gameSpin(gameData);
      }
    });
  }

  private createSpin() {
    const x = this.scene.scale.width * 0.83;
    const y = this.scene.scale.height * 0.45;
    const spin = this.scene.add.image(x, y, 'spin');
    spin.setInteractive();
    this.container.add(spin);
    
    let gameData = this.scene.gameData;
    spin.on('pointerdown', () => {
      gameData.isTurbo = false;
      gameData.isAutoPlaying = false;

      setSpeed(gameData, 1.0);
      gameSpin(gameData);
    });
  }
  
  private createAutoPlay() {
    const x = this.scene.scale.width * 0.83;
    const y = this.scene.scale.height * 0.61;
    const autoPlay = this.scene.add.image(x, y, 'auto-play');
    autoPlay.setInteractive();
    this.container.add(autoPlay);

    let gameData = this.scene.gameData;
    autoPlay.on('pointerdown', () => {
      gameData.isTurbo = false;
      gameData.isAutoPlaying = true;
      setSpeed(gameData, 1.0);
      gameSpin(gameData);
    });

    EventManager.on(GameEvents.SPIN_DONE, () => {
      if (gameData.isAutoPlaying) {
        setSpeed(gameData, 1.0);
        gameSpin(gameData);
      }
    });
  }

  private createInfo() {
    const x = this.scene.scale.width * 0.83;
    const y = this.scene.scale.height * 0.72;
    const info = this.scene.add.image(x, y, 'info');
  }

  private createBalance() {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    const width = sw * 0.2;
		const x = sw * 0.225;
    const y = sh * 0.85;
		const cornerRadius = 10;

		const container = this.scene.add.container(x, y)
    container.setDepth(4);

		const balance = this.scene.add.graphics();
		balance.fillStyle(0x000000, 0.35);
		balance.fillRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
    balance.lineStyle(2, 0x379557, 1);
    balance.strokeRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
		container.add(balance);

		const balanceText = this.scene.add.text(width * 0.5, sh * 0.04, 'BALANCE', {
      fontFamily: 'poppins-bold',
			fontSize: '22pt',
      color: '#3ffe2d',
			align: 'center',
		});
		container.add(balanceText);
		balanceText.setOrigin(0.5, 0.5);

    // How to load fonts here from assets?
    const amountText = this.scene.add.text(width * 0.5, sh * 0.08, `$ 200,000`, {
      fontFamily: 'poppins-bold',
			fontSize: '25pt',
      color: '#ffffff',
			align: 'center',
		});
		container.add(amountText);
		amountText.setOrigin(0.5, 0.5);

    BackendEvent.on(BackendEvents.SPIN_RESPONSE, (data: Data) => {
      amountText.setText(`$ ${data.balance.toFixed(2)}`);
    });

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      amountText.setText(`$ ${data.balance.toFixed(2)}`);
    });
  }

  private createTotalWin() {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    const width = sw * 0.2;
		const x = sw * 0.429;
    const y = sh * 0.85;
		const cornerRadius = 10;

		const container = this.scene.add.container(x, y)
    container.setDepth(4);

		const totalWin = this.scene.add.graphics();
		totalWin.fillStyle(0x000000, 0.35);
		totalWin.fillRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
    totalWin.lineStyle(2, 0x379557, 1);
    totalWin.strokeRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
		container.add(totalWin);

		const totalWinText = this.scene.add.text(width * 0.5, sh * 0.04, 'TOTAL WIN', {
      fontFamily: 'poppins-bold',
			fontSize: '22pt',
      color: '#3ffe2d',
			align: 'center',
		});
		container.add(totalWinText);
		totalWinText.setOrigin(0.5, 0.5);

    const amountText = this.scene.add.text(width * 0.5, sh * 0.08, `$ 0.00`, {
      fontFamily: 'poppins-bold',
			fontSize: '25pt',
      color: '#ffffff',
			align: 'center',
		});
		container.add(amountText);
		amountText.setOrigin(0.5, 0.5);

    BackendEvent.on(BackendEvents.SPIN, () => {
      amountText.setText(`$ 0.00`);
    })

    EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
      amountText.setText(`$ ${data.totalWins.toFixed(2)}`);
    });
  }

  private createBet() {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    const width = sw * 0.13;
		const x = sw * 0.634;
    const y = sh * 0.85;
		const cornerRadius = 10;

		const container = this.scene.add.container(x, y)
    container.setDepth(4);

		const bet = this.scene.add.graphics();
		bet.fillStyle(0x000000, 0.35);
		bet.fillRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
    bet.lineStyle(2, 0x379557, 1);
    bet.strokeRoundedRect(0, 0, width, sh * 0.12, cornerRadius);
		container.add(bet);

		const betText = this.scene.add.text(width * 0.5, sh * 0.04, 'BET', {
      fontFamily: 'poppins-bold',
			fontSize: '22pt',
      color: '#3ffe2d',
			align: 'center',
		});
		container.add(betText);
		betText.setOrigin(0.5, 0.5);

    const amountText = this.scene.add.text(width * 0.5, sh * 0.08, `10`, {
      fontFamily: 'poppins-bold',
			fontSize: '25pt',
      color: '#ffffff',
			align: 'center',
		});
		container.add(amountText);
		amountText.setOrigin(0.5, 0.5);

    const minus = this.scene.add.image(width * 0.2, sh * 0.08, 'minus');
		minus.setInteractive();
		minus.on('pointerdown', () => {
      
		})
		container.add(minus);

		const plus = this.scene.add.image(width * 0.8, sh * 0.08, 'plus');
		plus.setInteractive();
		plus.on('pointerdown', () => {
      
		})
    container.add(plus);
  }
}

// preload()
function loadImages(self: Buttons) {
  const PREFIX = 'assets/buttons/';
  self.scene.load.image('spin', PREFIX + 'Spin.png');
  self.scene.load.image('turbo', PREFIX + 'Turbo.png');
  self.scene.load.image('auto-play', PREFIX + 'Autoplay.png');
  self.scene.load.image('info', PREFIX + 'Info.png');
  self.scene.load.image('minus', PREFIX + 'Minus.png');
  self.scene.load.image('plus', PREFIX + 'Plus.png');
}

// create()
function createContainer(self: Buttons) {
  self.container = self.scene.add.container(0, 0);
  self.container.setDepth(4);
}


