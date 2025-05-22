import { Events } from "../scenes/components/Events";
import { GameData } from "../scenes/components/GameData";
import { Autoplay } from "../scenes/components/Autoplay";

export class Buttons {
	static PANEL_WIDTH = 250;
	static PANEL_HEIGHT = 120;
	
  constructor() {
    this.spinButton = null;
    this.turboButton = null;
    this.slotX = 400;
    this.slotY = 300;

		this.buyFeaturePriceText = null;
		this.doubleFeaturePriceText = null;
		this.currency = "$";
		this.autoplay = new Autoplay();
  }

  preload(scene) {
    this.width = scene.scale.width;
    this.height = scene.scale.height;
	
    const prefix = 'assets/Controllers';
    scene.load.image('spinButton', prefix + '/Spin.png');

    scene.load.image('turboButton', prefix + '/Turbo.png');
    scene.load.image('turboOn', prefix + '/Turbo_ON.png');

	scene.load.image('autoplayButton', prefix + '/Autoplay.png');
	scene.load.image('autoplayOn', prefix + '/Autoplay_ON.png');

	scene.load.image('info', prefix + '/Info.png');
	scene.load.image('infoOn', prefix + '/Info_ON.png');

	scene.load.image('plus', prefix + '/Plus.png');
	scene.load.image('minus', prefix + '/Minus.png');

	scene.load.image('logo', 'assets/Logo/Logo.png');

	scene.load.image('volume', prefix + '/Volume.png');
	scene.load.image('settings', prefix + '/Settings.png');

	scene.load.image('star', prefix + '/star.png');
	scene.load.image('buyFeatBG', 'assets/Reels/BuyFeatureBG.png');
  }

  create(scene) {
		this.createContainer(scene);
    	this.createTurboButton(scene);
    	this.createSpinButton(scene);
		this.createAutoplay(scene);
		this.createInfo(scene);

		this.createBalance(scene);
		this.createTotalWin(scene);
		this.createBet(scene);
		//this.createLine(scene)
		this.createBuyFeature(scene);
		this.createDoubleFeature(scene);

		this.createLogo(scene);
		this.createVolumeSettings(scene);
		this.createSettingsButton(scene);
  }

	createContainer(scene) {
		this.buttonContainer = scene.add.container(0, 0);
		this.buttonContainer.setDepth(4);
	}

	createTurboButton(scene) {
		const x = this.width * 0.85;
		const y = this.height * 0.29;
		const container = scene.add.container(x, y)

		this.turboButton = scene.add.image(0, 0, 'turboButton');
		this.turboOnButton = scene.add.image(0, 0, 'turboOn');
		this.turboOnButton.visible = false;
			
		const width = this.turboButton.width * 0.75;
		const height = this.turboButton.height * 0.75;

		const innerCircle = scene.add.graphics();
		innerCircle.fillStyle(0x000000, 0.5);
		innerCircle.fillCircle(0, 0, width * 1.25);
		container.add(innerCircle);

		const border = scene.add.graphics();
		border.fillStyle(0x000000, 0.15);
		border.fillCircle(0, 0, width * 1.55);

		container.add(border);

		this.turboButton.displayWidth = width;
		this.turboButton.displayHeight = height;
		this.turboOnButton.displayWidth = width * 3;
		this.turboOnButton.displayHeight = height * 2.25;
		this.turboButton.setInteractive().isButton = true;
		this.turboOnButton.setInteractive().isButton = true;
		container.add(this.turboButton);
		container.add(this.turboOnButton);
			
		this.buttonContainer.add(container);

		container.setInteractive(
			new Phaser.Geom.Circle(0, 0, width * 1.25), 
			Phaser.Geom.Circle.Contains
		).isButton = true;

		container.on('pointerdown', () => {
			this.toggleTurbo(scene);
		});

		this.turboButton.on('pointerdown', () => {
			this.toggleTurbo(scene);
		});

		this.turboOnButton.on('pointerdown', () => {
			this.toggleTurbo(scene);
		});
	}

	toggleTurbo(scene) {
		//if(scene.gameData.isSpinning) return;
		scene.audioManager.UtilityButtonSFX.play();
		this.turboButton.visible = !this.turboButton.visible;
		this.turboOnButton.visible = !this.turboOnButton.visible;
		scene.gameData.turbo = !scene.gameData.turbo;
	}

	idleTween = null;	
	createSpinButton(scene) {
		const x = this.width * 0.85;
		const y = this.height * 0.443;
		const container = scene.add.container(x, y)

		this.spinButton = scene.add.image(0, 0, 'spinButton');
		const width = this.spinButton.width * 0.75;
		const height = this.spinButton.height * 0.75;

		const spinButtonBackgroundCircle = scene.add.graphics();
		spinButtonBackgroundCircle.fillStyle(0x000000, 0.15);
		const spinCircleRadius = width * 0.57;
		spinButtonBackgroundCircle.fillCircle(0, 0, spinCircleRadius);

		container.add(spinButtonBackgroundCircle);

		this.spinButton.displayWidth = width;
		this.spinButton.displayHeight = height;
		this.spinButton.setInteractive().isButton = true;
		container.add(this.spinButton);

		this.buttonContainer.add(container);

		const startIdleRotation = () => {
			if(scene.gameData.isSpinning) return;
			if (this.idleTween) {
				this.idleTween.stop();
			}
			this.idleTween = scene.tweens.add({
				targets: this.spinButton,
				angle: '+=360',
				duration: 8000,
				repeat: -1,
				ease: 'Linear'
			});
		};

		const stopIdleRotation = () => {
			if(scene.gameData.isSpinning) return;
			if (this.idleTween) {
				this.idleTween.stop();
			}
		};

		startIdleRotation();

		this.spinButton.on('pointerover', stopIdleRotation);
		this.spinButton.on('pointerout', startIdleRotation);

		const spinAction = () => {
			if(scene.gameData.isSpinning) return;
			scene.audioManager.SpinSFX.play();
			stopIdleRotation();
			scene.tweens.add({
				targets: this.spinButton,
				angle: '+=720',
				duration: 1000,
				ease: 'Quint.easeInOut',
				onComplete: () => {
					Events.emitter.emit(Events.SPIN, {
						currentRow: scene.gameData.currentRow,
						symbols: scene.gameData.slot.values
					});
					scene.gameData.totalWin = 0;
					Events.emitter.emit(Events.WIN, {});
					startIdleRotation();
				}
			});
		};

		this.spinButton.on('pointerdown', spinAction);

		// Add spacebar input to trigger spin
		scene.input.keyboard.on('keydown-SPACE', spinAction);
	}

	createAutoplay(scene) {
		const x = this.width * 0.85;
		const y = this.height * 0.598;
		const radius = 60;

		const container = scene.add.container(x, y)

		this.autoplayButton = scene.add.image(0, 0, 'autoplayButton');
		this.autoplayOnButton = scene.add.image(0, 0, 'autoplayOn');
		
		const innerCircle = scene.add.graphics();
		innerCircle.fillStyle(0x000000, 0.5);
		innerCircle.fillCircle(0, 0, radius * 0.78);
		container.add(innerCircle);

		const outerCircle = scene.add.graphics();
		outerCircle.fillStyle(0x000000, 0.15);
		outerCircle.fillCircle(0, 0, radius * 0.95);

		container.add(outerCircle);

		this.autoplayButton.setInteractive().isButton = true;
		this.autoplayOnButton.setInteractive().isButton = true;
		this.autoplayOnButton.scale = 1.1;
		container.add(this.autoplayButton);
		container.add(this.autoplayOnButton);
		this.autoplayOnButton.visible = false;

		this.buttonContainer.add(container);

		// --- AUTOPLAY SETTINGS POPUP ---
		const popupWidth = 466;
		const popupHeight = 400;
		const popup = scene.add.container(this.width / 2 - popupWidth / 2, this.height / 2 - popupHeight / 2);
		popup.setDepth(1000);
		popup.setVisible(false);

		// Popup background
		const bg = scene.add.graphics();
		bg.fillStyle(0x000000, 0.8);
		bg.lineStyle(1, 0x66D449, 1);
		bg.strokeRoundedRect(0, 0, popupWidth, popupHeight, 16);
		bg.fillRoundedRect(0, 0, popupWidth, popupHeight, 16);
		popup.add(bg);
		// Add blur effect (backdrop-filter)
		if (scene.sys.game.renderer.pipelines) {
			bg.setPipeline('BlurPostFX');
		}

		// Title
		const title = scene.add.text(popupWidth / 2, 32, 'AUTOPLAY SETTINGS', {
			fontSize: '24px', fill: '#66D449', fontStyle: 'bold', fontFamily: 'Poppins'
		});
		title.setOrigin(0.5, 0.5);
		popup.add(title);

		// Close button (white)
		const closeBtn = scene.add.text(popupWidth - 32, 32, '×', {
			fontSize: '28px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins', align: 'center'
		});
		closeBtn.setOrigin(0.5, 0.5);
		closeBtn.setInteractive().isButton = true;
		popup.add(closeBtn);

		// Balance
		const balanceLabel = scene.add.text(32, 80, 'Balance', { fontSize: '18px', fill: '#fff', fontFamily: 'Poppins' });
		popup.add(balanceLabel);
		const balanceValue = scene.add.text(popupWidth - 32, 80, '', { fontSize: '20px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins' });
		balanceValue.setOrigin(1, 0);
		popup.add(balanceValue);

		// Number of autospins
		const spinsLabel = scene.add.text(32, 130, 'Number of autospins', { fontSize: '18px', fill: '#fff', fontFamily: 'Poppins' });
		popup.add(spinsLabel);
		const spinOptions = [10, 30, 50, 75, 100, 150, 500, 1000];
		let selectedSpins = spinOptions[0];
		const spinButtons = [];
		for (let i = 0; i < spinOptions.length; i++) {
			const col = i % 4;
			const row = Math.floor(i / 4);
			const btnX = 32 + col * 100;
			const btnY = 160 + row * 45;
			const btnBg = scene.add.graphics();
			btnBg.fillStyle(0x232323, 1);
			btnBg.fillRoundedRect(btnX, btnY, 80, 40, 8);
			btnBg.setDepth(1);
			popup.add(btnBg);
			const btnText = scene.add.text(btnX + 40, btnY + 20, spinOptions[i].toString(), {
				fontSize: '20px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold'
			});
			btnText.setOrigin(0.5, 0.5);
			btnText.setDepth(2);
			popup.add(btnText);
			btnBg.setInteractive(new Phaser.Geom.Rectangle(btnX, btnY, 80, 40), Phaser.Geom.Rectangle.Contains).isButton = true;
			btnBg.on('pointerdown', () => {
				selectedSpins = spinOptions[i];
				updateSpinButtonStyles();
			});
			spinButtons.push({ btnBg, btnText });
		}
		function updateSpinButtonStyles() {
			for (let i = 0; i < spinButtons.length; i++) {
				if (spinOptions[i] === selectedSpins) {
					spinButtons[i].btnBg.clear();
					// Green gradient for selected
					const g = spinButtons[i].btnBg;
					g.fillGradientStyle(0x66D449, 0x66D449, 0x379557, 0x379557, 1, 1, 0, 0);
					g.fillRoundedRect(32 + (i % 4) * 100, 160 + Math.floor(i / 4) * 45, 80, 40, 8);
					spinButtons[i].btnText.setColor('#000000');
				} else {
					spinButtons[i].btnBg.clear();
					spinButtons[i].btnBg.fillStyle(0x232323, 1);
					spinButtons[i].btnBg.fillRoundedRect(32 + (i % 4) * 100, 160 + Math.floor(i / 4) * 45, 80, 40, 8);
					spinButtons[i].btnText.setColor('#ffffff');
				}
			}
		}
		updateSpinButtonStyles();

		// Total Bet
		const betLabel = scene.add.text(32, 280, 'Total Bet', { fontSize: '18px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins' });
		popup.add(betLabel);
		let bet = scene.gameData.bet;
		const betValue = scene.add.text(popupWidth - 32, 280, '', { fontSize: '32px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins' });
		betValue.setOrigin(1, 0);
		popup.add(betValue);
		const minus = scene.add.text(popupWidth - 120, 280, '-', { fontSize: '32px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins' });
		minus.setInteractive().isButton = true;
		popup.add(minus);
		const plus = scene.add.text(popupWidth - 80, 280, '+', { fontSize: '32px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Poppins' });
		plus.setInteractive().isButton = true;
		popup.add(plus);

		minus.on('pointerdown', () => {
			if (bet > 1) {
				bet--;
				updateBetDisplay();
			}
		});
		plus.on('pointerdown', () => {
			bet++;
			updateBetDisplay();
		});
		function updateBetDisplay() {
			betValue.setText('£' + bet.toLocaleString());
		}
		updateBetDisplay();

		// Start Autoplay button
		const startBtnBg = scene.add.graphics();
		// Green gradient, white border, border-radius: 37px
		startBtnBg.fillGradientStyle(0x66D449, 0x66D449, 0x379557, 0x379557, 1, 1, 0, 0);
		startBtnBg.fillRoundedRect(32, popupHeight - 80, popupWidth - 64, 50, 37);
		startBtnBg.lineStyle(2, 0xffffff, 0.5);
		startBtnBg.strokeRoundedRect(32, popupHeight - 80, popupWidth - 64, 50, 37);
		popup.add(startBtnBg);
		const startBtnText = scene.add.text(popupWidth / 2, popupHeight - 55, 'START AUTOPLAY', {
			fontSize: '24px', fill: '#000000', fontStyle: 'bold', fontFamily: 'Poppins'
		});
		startBtnText.setOrigin(0.5, 0.5);
		popup.add(startBtnText);
		startBtnBg.setInteractive(new Phaser.Geom.Rectangle(32, popupHeight - 80, popupWidth - 64, 50), Phaser.Geom.Rectangle.Contains).isButton = true;
		startBtnBg.on('pointerdown', () => {
			this.autoplayButton.visible = false;
			this.autoplayOnButton.visible = true;
			popup.setVisible(false);
			
			// Start autoplay 
			scene.gameData.bet = bet;
			Events.emitter.emit(Events.CHANGE_BET, { bet });
			this.autoplay.start(scene, selectedSpins);
			Events.emitter.emit(Events.AUTOPLAY_START);
		});

		closeBtn.on('pointerdown', () => {
			popup.setVisible(false);
		});

		// Update balance display when popup is shown
		const updateBalance = () => {
			const balance = scene.gameData.balance;
			balanceValue.setText('£' + balance.toLocaleString());
		};

		// Show popup when autoplay button is pressed
		this.autoplayButton.on('pointerdown', () => {
			updateBalance();
			bet = scene.gameData.bet;
			updateBetDisplay();
			popup.setVisible(true);
		});

		this.autoplayOnButton.on('pointerdown', () => {
			this.autoplayButton.visible = true;
			this.autoplayOnButton.visible = false;
			this.autoplay.stop();
			Events.emitter.emit(Events.AUTOPLAY_STOP);
		});

		// Listen for autoplay complete
		Events.emitter.on(Events.AUTOPLAY_COMPLETE, () => {
			this.autoplayButton.visible = true;
			this.autoplayOnButton.visible = false;
		});

		this.buttonContainer.add(popup);
	}

	createInfo(scene) {
		const x = this.width * 0.85;
    	const y = this.height * 0.693;
		const radius = 50;

		const container = scene.add.container(x, y)

		const innerCircle = scene.add.graphics();
		innerCircle.fillStyle(0x000000, 0.5);
		innerCircle.fillCircle(0, 0, radius * 0.78);
		container.add(innerCircle);

		const outerCircle = scene.add.graphics();
		outerCircle.fillStyle(0x000000, 0.15);
		outerCircle.fillCircle(0, 0, radius * 0.95);

		container.add(outerCircle);

		const infoButton = scene.add.image(0, 0, 'info');
		infoButton.scale = 0.6;
		infoButton.setInteractive().isButton = true;
		container.add(infoButton);

		const infoOnButton = scene.add.image(0, 0, 'infoOn');
		infoOnButton.scale = 1.2;
		infoOnButton.setInteractive().isButton = true;
		infoOnButton.visible = false;
		container.add(infoOnButton);

		this.buttonContainer.add(container);

		container.setInteractive(
			new Phaser.Geom.Circle(0, 0, radius * 0.95), 
			Phaser.Geom.Circle.Contains
		).isButton = true;

		const toggleInfo = () => {
			scene.audioManager.UtilityButtonSFX.play();
			infoButton.visible = !infoButton.visible;
			infoOnButton.visible = !infoOnButton.visible;
		};

		container.on('pointerdown', toggleInfo);
		infoButton.on('pointerdown', toggleInfo);
		infoOnButton.on('pointerdown', toggleInfo);
	}

	createBalance(scene) {
		const width = Buttons.PANEL_WIDTH * 1.5;
		const x = this.width * 0.24;
		const y = this.height * 0.83;
		const cornerRadius = 10;

		const container = scene.add.container(x, y);

		
		// Create a gradient texture
		const gradientTexture = scene.textures.createCanvas('balanceGradient', width, Buttons.PANEL_HEIGHT);
		const context = gradientTexture.getContext();
		const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
		gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
		gradientTexture.refresh();

		// Create the background with gradient and border
		this.balance = scene.add.graphics();
		this.balance.fillStyle(0x000000, 0.5);
		this.balance.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		this.balance.lineStyle(1, 0x00FFFC);
		this.balance.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		container.add(this.balance);

		const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BALANCE', {
			fontSize: '25px',
			fill: '#57FFA3',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(text1);
		text1.setOrigin(0.5, 0.5);

		const balance = scene.gameData.balance;
		const balanceString = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

		const text2 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${balanceString}`, {
			fontSize: '35px',
			fill: '#ffffff',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(text2);
		text2.setOrigin(0.5, 0.5);

		Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
			const balance2 = scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			text2.setText(`$ ${balance2}`)
		})

		Events.emitter.on(Events.WIN, () => {
			const balance2 = scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			text2.setText(`$ ${balance2}`)
		})

		this.balanceContainer = container;
		this.buttonContainer.add(container);
	}

	createTotalWin(scene) {
		const width = Buttons.PANEL_WIDTH * 1.5;
		const x = this.balanceContainer.x + width + this.width * 0.01;
    	const y = this.balanceContainer.y;
		const cornerRadius = 10;

		const container = scene.add.container(x, y)

		// Create a gradient texture for totalWin
		const gradientTexture = scene.textures.createCanvas('totalWinGradient', width, Buttons.PANEL_HEIGHT);
		const context = gradientTexture.getContext();
		const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
		gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
		gradientTexture.refresh();

		// Create the background with gradient and border
		this.totalWin = scene.add.graphics();
		this.totalWin.fillStyle(0x000000, 0.5);
		this.totalWin.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		this.totalWin.lineStyle(1, 0x00FFFC);
		this.totalWin.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		container.add(this.totalWin);

		const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'TOTAL WIN', {
			fontSize: '25px',
			fill: '#57FFA3',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(text1);
		text1.setOrigin(0.5, 0.5);
		let totalWin = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

		const text2 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${totalWin}`, {
			fontSize: '35px',
			fill: '#ffffff',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(text2);
		text2.setOrigin(0.5, 0.5);

		Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
			let totalWin2 = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			text2.setText(`$ ${totalWin2}`)
		})

		Events.emitter.on(Events.WIN, () => {
			let totalWin2 = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
			text2.setText(`$ ${totalWin2}`)
		})

		this.totalWinContainer = container;

		this.buttonContainer.add(container);
	}

	createBet(scene) {
		const width = Buttons.PANEL_WIDTH;
		const x = this.totalWinContainer.x + width * 1.5 + this.width * 0.01;
    	const y = this.totalWinContainer.y;
		const cornerRadius = 10;

		const container = scene.add.container(x, y)

		// Create a gradient texture for bet
		const gradientTexture = scene.textures.createCanvas('betGradient', width, Buttons.PANEL_HEIGHT);
		const context = gradientTexture.getContext();
		const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
		gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
		gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
		gradientTexture.refresh();

		// Create the background with gradient and border
		this.totalBet = scene.add.graphics();
		this.totalBet.fillStyle(0x000000, 0.5);
		this.totalBet.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		this.totalBet.lineStyle(1, 0x00FFFC);
		this.totalBet.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		container.add(this.totalBet);

		const lineText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BET', {
			fontSize: '25px',
			fill: '#57FFA3',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(lineText);
		lineText.setOrigin(0.5, 0.5);

		const numberText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, scene.gameData.bet, {
			fontSize: '35px',
			fill: '#ffffff',
			align: 'center',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		container.add(numberText);
		numberText.setOrigin(0.5, 0.5);

		const minus = scene.add.image(width * 0.25, Buttons.PANEL_HEIGHT * 0.65, 'minus');
		minus.scale = 0.25;
		minus.setInteractive().isButton = true;
		minus.on('pointerdown', () => {
			if(scene.gameData.isSpinning) return;
			if (scene.gameData.bet <= 1) return;
			scene.audioManager.UtilityButtonSFX.play();
			scene.gameData.bet -= 1;
			numberText.setText(scene.gameData.bet);
			Events.emitter.emit(Events.CHANGE_BET, {
				bet: scene.gameData.bet
			});
		})

		container.add(minus);

		const plus = scene.add.image(width * 0.75, Buttons.PANEL_HEIGHT * 0.65, 'plus');
		plus.scale = 0.25;
		plus.setInteractive().isButton = true;
		plus.on('pointerdown', () => {
			if(scene.gameData.isSpinning) return;
			scene.audioManager.UtilityButtonSFX.play();
			scene.gameData.bet += 1;
			numberText.setText(scene.gameData.bet);
			Events.emitter.emit(Events.CHANGE_BET, {
				bet: scene.gameData.bet
			});	
		})
		container.add(plus);

		this.betContainer = container
		this.buttonContainer.add(container);
	}

	createLine(scene) {
		const width = Buttons.PANEL_WIDTH;
		const x = this.betContainer.x + width + this.width * 0.01;
    const y = this.betContainer.y;
		const cornerRadius = 10;

		const container = scene.add.container(x, y)

		this.line = scene.add.graphics();
		this.line.fillStyle(0x000000, 0.35);
		this.line.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
		container.add(this.line);

		const lineText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'LINE', {
			fontSize: '25px',
			fill: '#57ffa3',
			align: 'center',
			fontStyle: 'bold'
		});
		container.add(lineText);
		lineText.setOrigin(0.5, 0.5);

		const numberText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, scene.gameData.line + 1, {
			fontSize: '35px',
			fill: '#ffffff',
			align: 'center',
			fontStyle: 'bold'
		});
		container.add(numberText);
		numberText.setOrigin(0.5, 0.5);


		const minus = scene.add.image(width * 0.25, Buttons.PANEL_HEIGHT * 0.65, 'minus');
		minus.scale = 0.25;
		minus.setInteractive().isButton = true;
		minus.on('pointerdown', () => {
			if (scene.gameData.line == 0) return;
			scene.gameData.line -= 1;
			numberText.setText(scene.gameData.line + 1);
			
			Events.emitter.emit(Events.CHANGE_LINE, { 
				line: scene.gameData.line
			});
		})
		container.add(minus);

		const plus = scene.add.image(width * 0.75, Buttons.PANEL_HEIGHT * 0.65, 'plus');
		plus.scale = 0.25;
		plus.setInteractive().isButton = true;
		plus.on('pointerdown', () => {
			if (scene.gameData.line == GameData.WIN_LINES.length - 1) return;
			scene.gameData.line += 1;
			numberText.setText(scene.gameData.line + 1);

			Events.emitter.emit(Events.CHANGE_LINE, { 
				line: scene.gameData.line
			});
		})
		container.add(plus);

		this.buttonContainer.add(container);
	}

	createBuyFeature(scene) {
		// Elliptical buy feature button in upper left
		const x = this.width * 0.15;
		const y = this.height * 0.13;
		const ellipseWidth = 277;
		const ellipseHeight = 114;
		const container = scene.add.container(x, y);

		// Button background
		const buttonBg = scene.add.graphics();
		buttonBg.fillStyle(0x181818, 0.95);
		buttonBg.lineStyle(10, 0x57FFA3, 1);
		buttonBg.strokeRoundedRect(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight, ellipseHeight/2);
		buttonBg.fillRoundedRect(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight, ellipseHeight/2);
		container.add(buttonBg);

		// Stars
		const starLeft = scene.add.image(-ellipseWidth/2 + 32, -24, 'star');
		container.add(starLeft);
		const starRight = scene.add.image(ellipseWidth/2 - 32, -24, 'star');
		container.add(starRight);

		// BUY FEATURE text
		const buttonText = scene.add.text(0, -24, 'BUY FEATURE', {
			fontSize: '24px',
			fill: '#fff',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center',
			letterSpacing: 1.5,
			stroke: '#181818',
			strokeThickness: 2,
			shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 4, fill: true }
		});
		buttonText.setOrigin(0.5, 0.5);
		container.add(buttonText);

		// Price text (large, green)
		const price = scene.gameData.getBuyFeaturePrice();
		this.buyFeaturePriceText = scene.add.text(0, 24, this.currency + price.toLocaleString(), {
			fontSize: '42px',
			fill: '#00FF6A',
			fontFamily: 'Poppins',
			align: 'center',
			fontStyle: 'bold'
		});
		this.buyFeaturePriceText.setOrigin(0.5, 0.5);
		
		// Listen for bet changes to update double feature price
		Events.emitter.on(Events.CHANGE_BET, (data) => {
			this.updateBuyFeaturePrice(scene.gameData.getBuyFeaturePrice());
		});

		container.add(this.buyFeaturePriceText);

		// Make button interactive - using the buttonBg graphics object instead of container
		buttonBg.setInteractive(new Phaser.Geom.Rectangle(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight), Phaser.Geom.Rectangle.Contains);
		buttonBg.isButton = true;

		this.buyFeatureButton = buttonBg;
		this.buttonContainer.add(container);

		// Create the popup (existing popup code)
		const width = 420;
		const height = 260;
		const popupX = scene.scale.width / 2 - width / 2;
		const popupY = scene.scale.height / 2 - height / 2;

		const popupContainer = scene.add.container(popupX, popupY);
		popupContainer.setDepth(1000);
		popupContainer.setVisible(false);

		// Popup background
		const bg = scene.add.image(width/2, height/2, 'buyFeatBG');
		bg.setOrigin(0.5, 0.5);
		popupContainer.add(bg);
		// Add blur effect (backdrop-filter)
		if (scene.sys.game.renderer.pipelines) {
			bg.setPipeline('BlurPostFX');
		}

		// Title
		const title = scene.add.text(width / 2, 32, 'FREE SPIN', {
			fontSize: '24px', fill: '#66D449', fontStyle: 'bold', fontFamily: 'Poppins'
		});
		title.setOrigin(0.5, 0.5);
		popupContainer.add(title);

		// Main text
		const buyText = scene.add.text(width / 2, 90, '', {
			fontSize: '28px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 40 }
		});
		buyText.setOrigin(0.5, 0.5);
		popupContainer.add(buyText);

		// Buy and Close buttons
		const buyBtnBg = scene.add.graphics();
		buyBtnBg.fillGradientStyle(0x66D449, 0x66D449, 0x379557, 0x379557, 1);
		buyBtnBg.lineStyle(2, 0xffffff, 0.5);
		buyBtnBg.fillRoundedRect(width / 2 - 90, height - 70, 100, 44, 22);
		buyBtnBg.strokeRoundedRect(width / 2 - 90, height - 70, 100, 44, 22);
		popupContainer.add(buyBtnBg);
		const buyBtnText = scene.add.text(width / 2 - 100, height - 48, 'Buy', {
			fontSize: '32px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold', align: 'center'
		});
		buyBtnText.setOrigin(-0.5, 0.5);
		popupContainer.add(buyBtnText);

		const closeBtnText = scene.add.text(width / 2 + 100, height - 48, 'Close', {
			fontSize: '32px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold'
		});
		closeBtnText.setOrigin(0.5, 0.5);
		popupContainer.add(closeBtnText);

		buyBtnBg.setInteractive(new Phaser.Geom.Rectangle(width / 2 - 90, height - 70, 100, 44), Phaser.Geom.Rectangle.Contains).isButton = true;
		buyBtnBg.on('pointerdown', () => {
			popupContainer.setVisible(false);
			// Add buy logic here
			scene.gameData.minScatter = 4;
			
			Events.emitter.emit(Events.SPIN, {
				currentRow: scene.gameData.currentRow,
				symbols: scene.gameData.slot.values
			});	
		});
		closeBtnText.setInteractive().isButton = true;
		closeBtnText.on('pointerdown', () => {
			popupContainer.setVisible(false);
		});

		// Show popup when buy feature is pressed
		const showBuyFeaturePopup = () => {
			const cost = scene.gameData.getBuyFeaturePrice();
			buyText.setText(`Buy 10 Free Spin\nAt the cost of $${cost}?`);
			buyText.setStyle({
				color: '#FFF',
				fontFamily: 'Poppins',
				fontSize: '32px',
				fontStyle: 'normal',
				fontWeight: '700',
				align: 'center',
				lineHeight: 'normal'
			});
			popupContainer.setVisible(true);
		};

		// Attach to the buy feature button
		if (this.buyFeatureButton) {
			this.buyFeatureButton.on('pointerdown', showBuyFeaturePopup);
		}

		// Or, if you want to show from anywhere:
		scene.events.on('showBuyFeaturePopup', showBuyFeaturePopup);

		this.buttonContainer.add(popupContainer);
		this.buyFeaturePopup = popupContainer;
	}

	updateBuyFeaturePrice(newPrice) {
		if (this.buyFeaturePriceText) {
			this.buyFeaturePriceText.setText(this.currency + newPrice.toLocaleString());
		}
	}

	createDoubleFeature(scene) {
		const width = 254;
		const height = 131;
		const cornerRadius = 19;
		const x = this.width * 0.8;
		const y = this.height * 0.82;

		const container = scene.add.container(x, y);

		// Green gradient background with border
		const bg = scene.add.graphics();
		bg.fillGradientStyle(0x66D449, 0x66D449, 0x379557, 0x379557, 1);
		bg.lineStyle(2, 0xffffff, 0.5);
		bg.fillRoundedRect(0, 0, width, height, cornerRadius);
		bg.strokeRoundedRect(0, 0, width, height, cornerRadius);
		container.add(bg);

		// Bet box (left)
		const betBox = scene.add.graphics();
		betBox.fillStyle(0x181818, 1);
		betBox.fillRoundedRect(15, 20, 90, 90, 16);
		container.add(betBox);
		const betLabel = scene.add.text(60, 45, 'BET', {
			fontSize: '24px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold', align: 'center'
		});
		betLabel.setOrigin(0.5, 0.5);
		container.add(betLabel);
		this.doubleFeaturePriceText = scene.add.text(60, 90, scene.gameData.getDoubleFeaturePrice(), {
			fontSize: '36px', fill: '#57FFA3', fontFamily: 'Poppins', fontStyle: 'bold', align: 'center'
		});
		this.doubleFeaturePriceText.setOrigin(0.5, 0.75);
		container.add(this.doubleFeaturePriceText);

		// Enhanced Bet label (right, top)
		const enhancedLabel = scene.add.text(width - 140, 10, 'Enhanced Bet', {
			fontSize: '14px', fill: '#fff', fontFamily: 'Poppins', fontStyle: 'bold'
		});
		container.add(enhancedLabel);

		// Toggle switch (right, middle)
		const toggleX = width - 120;
		const toggleY = 40;
		const toggleWidth = 64;
		const toggleHeight = 36;
		const toggleRadius = 18;
		const toggleBg = scene.add.graphics();
		toggleBg.fillStyle(0x181818, 1);
		toggleBg.lineStyle(3, 0xffffff, 0.5);
		toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
		toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
		container.add(toggleBg);
		const toggleCircle = scene.add.graphics();
		let isEnabled = !!scene.gameData.doubleChanceEnabled;
		function drawToggle() {
			toggleCircle.clear();
			if (isEnabled) {
				toggleBg.clear();
				toggleBg.fillStyle(0x379557, 1);
				toggleBg.lineStyle(5, 0xffffff, 1);
				toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
				toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
				toggleCircle.fillStyle(0x3FFF0D, 1);
				toggleCircle.fillCircle(toggleX + toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
				
				// Gray out bet box when enabled
				betBox.clear();
				betBox.fillStyle(0x333333, 1);
				betBox.fillRoundedRect(15, 20, 90, 90, 16);
				scene.buttons.doubleFeaturePriceText.setFill('#3FFF0D');

			} else {
				toggleBg.clear();
				toggleBg.fillStyle(0x66D449, 1);
				toggleBg.lineStyle(3, 0xFFFFFF, 1);
				toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
				toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
				toggleCircle.fillStyle(0xFFFFFF, 1);
				toggleCircle.fillCircle(toggleX + toggleWidth - toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
				
				// Normal bet box when disabled
				betBox.clear();
				betBox.fillStyle(0x181818, 1);
				betBox.fillRoundedRect(15, 20, 90, 90, 16);
				scene.buttons.doubleFeaturePriceText.setFill('#FFFFFF');
			}
		}
		drawToggle();
		container.add(toggleCircle);

		// Toggle logic
		const toggleArea = scene.add.zone(toggleX, toggleY, toggleWidth, toggleHeight).setOrigin(0, 0).setInteractive();
		toggleArea.on('pointerdown', () => {
			isEnabled = !isEnabled;
			scene.gameData.doubleChanceEnabled = isEnabled;
			drawToggle();
		});
		container.add(toggleArea);

		// Description (right, bottom)
		const desc = scene.add.text(width - 140, 105, 'Higher odds for\nFree Spins', {
			fontSize: '14px', fill: '#fff', fontFamily: 'Poppins', align: 'center'
		});
		desc.setOrigin(0, 0.5);
		container.add(desc);

		// Listen for bet changes to update double feature price
		Events.emitter.on(Events.CHANGE_BET, (data) => {
			this.updateDoubleFeaturePrice(scene.gameData.getDoubleFeaturePrice());
		});

		container.setDepth(5);
		this.buttonContainer.add(container);
	}

	updateDoubleFeaturePrice(newPrice) {
		if (this.doubleFeaturePriceText) {
			this.doubleFeaturePriceText.setText(newPrice);
		}
	}

	createLogo(scene) {
		const x = this.width * 0.86;
		const y = this.height * 0.12;
		scene
			.add
			.image(x, y, 'logo')
			.setDepth(5)
			.setScale(0.75);
	}

	createSettingsButton(scene) {
		const x = this.width * 0.0825;
		const y = this.height * 0.95;
		const container = scene.add.container(x, y);

		const scaleFactor = 1.5; // x2 size
		const radius = 40 * scaleFactor;

		// Add settings icon
		const settingsIcon = scene.add.image(0, 0, 'settings');
		settingsIcon.setOrigin(0.5, 0.5);
		settingsIcon.setScale(0.6 * scaleFactor);
		container.add(settingsIcon);

		// Make container interactive
		container.setInteractive(
			new Phaser.Geom.Rectangle(-radius, -radius, radius * 2, radius * 2),
			Phaser.Geom.Rectangle.Contains
		).isButton = true;

		// Add to button container
		this.buttonContainer.add(container);
	}

	createVolumeSettings(scene) {
		const x = this.width * 0.05;
		const y = this.height * 0.95;
		const container = scene.add.container(x, y);

		const scaleFactor = 1.5; // x2 size

		const radius = 40 * scaleFactor;

		// Add volume icon
		const volumeIcon = scene.add.image(0, 0, 'volume');
		volumeIcon.setOrigin(0.5, 0.5);
		volumeIcon.setScale(0.6 * scaleFactor);
		container.add(volumeIcon);

		// Make container interactive
		container.setInteractive(
			new Phaser.Geom.Rectangle(-radius, -radius, radius * 2, radius * 2),
			Phaser.Geom.Rectangle.Contains
		).isButton = true;

		// Create the settings panel (initially hidden off-screen)
		const panelWidth = 260 * scaleFactor;
		const panelHeight = 120 * scaleFactor;
		const panel = scene.add.container(0, 0); // Start at (0,0) relative to container
		panel.setDepth(100);

		// Panel background
		const bg = scene.add.graphics();
		bg.fillStyle(0x181818, 0.95);
		bg.lineStyle(2 * scaleFactor, 0x57FFA3, 1);
		bg.strokeRoundedRect(0, 0, panelWidth, panelHeight, 12 * scaleFactor);
		bg.fillRoundedRect(0, 0, panelWidth, panelHeight, 12 * scaleFactor);
		panel.add(bg);

		// Title
		const title = scene.add.text(panelWidth/2, 18 * scaleFactor, 'SYSTEM SETTINGS', {
			fontSize: `${18 * scaleFactor}px`,
			fill: '#57FFA3',
			fontStyle: 'bold',
			fontFamily: 'Poppins'
		});
		title.setOrigin(0.5, 0.5);
		panel.add(title);

		// Close button
		const closeBtn = scene.add.text(panelWidth - 18 * scaleFactor, 18 * scaleFactor, '×', {
			fontSize: `${22 * scaleFactor}px`,
			fill: '#57FFA3',
			fontStyle: 'bold',
			fontFamily: 'Poppins',
			align: 'center'
		});
		closeBtn.setOrigin(0.5, 0.5);
		closeBtn.setInteractive().isButton = true;
		panel.add(closeBtn);

		// Music row
		const musicIcon = scene.add.image(24 * scaleFactor, 48 * scaleFactor, 'volume').setScale(0.35 * scaleFactor);
		panel.add(musicIcon);
		const musicLabel = scene.add.text(48 * scaleFactor, 40 * scaleFactor, 'Music', {
			fontSize: `${16 * scaleFactor}px`, fill: '#fff', fontFamily: 'Poppins'
		});
		panel.add(musicLabel);
		const musicValue = scene.add.text(100 * scaleFactor, 40 * scaleFactor, '75%', {
			fontSize: `${16 * scaleFactor}px`, fill: '#fff', fontFamily: 'Poppins'
		});
		panel.add(musicValue);

		// SFX row
		const sfxIcon = scene.add.image(24 * scaleFactor, 88 * scaleFactor, 'volume').setScale(0.35 * scaleFactor);
		panel.add(sfxIcon);
		const sfxLabel = scene.add.text(48 * scaleFactor, 80 * scaleFactor, 'SFX', {
			fontSize: `${16 * scaleFactor}px`, fill: '#fff', fontFamily: 'Poppins'
		});
		panel.add(sfxLabel);
		const sfxValue = scene.add.text(100 * scaleFactor, 80 * scaleFactor, '75%', {
			fontSize: `${16 * scaleFactor}px`, fill: '#fff', fontFamily: 'Poppins'
		});
		panel.add(sfxValue);

		// Music slider
		const musicSliderBg = scene.add.graphics();
		musicSliderBg.fillStyle(0x333333, 1);
		musicSliderBg.fillRoundedRect(150 * scaleFactor, 48 * scaleFactor, 90 * scaleFactor, 6 * scaleFactor, 3 * scaleFactor);
		panel.add(musicSliderBg);
		const musicSlider = scene.add.graphics();
		musicSlider.fillStyle(0xffffff, 1);
		musicSlider.fillCircle(150 * scaleFactor + 0.75 * 90 * scaleFactor, 51 * scaleFactor, 9 * scaleFactor);
		panel.add(musicSlider);

		// SFX slider
		const sfxSliderBg = scene.add.graphics();
		sfxSliderBg.fillStyle(0x333333, 1);
		sfxSliderBg.fillRoundedRect(150 * scaleFactor, 88 * scaleFactor, 90 * scaleFactor, 6 * scaleFactor, 3 * scaleFactor);
		panel.add(sfxSliderBg);
		const sfxSlider = scene.add.graphics();
		sfxSlider.fillStyle(0xffffff, 1);
		sfxSlider.fillCircle(150 * scaleFactor + 0.75 * 90 * scaleFactor, 91 * scaleFactor, 9 * scaleFactor);
		panel.add(sfxSlider);

		// Helper to update slider positions and values
		const updateSliders = (musicX = null, sfxX = null) => {
			const musicVol = musicX !== null ? 
				(musicX - 150 * scaleFactor) / (90 * scaleFactor) : 
				scene.audioManager.musicVolume;
			
			const sfxVol = sfxX !== null ? 
				(sfxX - 150 * scaleFactor) / (90 * scaleFactor) : 
				scene.audioManager.sfxVolume;
			
			// Update music slider
			musicSlider.clear();
			musicSlider.fillStyle(0xffffff, 1);
			const musicSliderX = 150 * scaleFactor + musicVol * 90 * scaleFactor;
			musicSlider.fillCircle(musicSliderX, 51 * scaleFactor, 9 * scaleFactor);
			musicValue.setText(Math.round(musicVol * 100) + '%');
			
			// Update SFX slider
			sfxSlider.clear();
			sfxSlider.fillStyle(0xffffff, 1);
			const sfxSliderX = 150 * scaleFactor + sfxVol * 90 * scaleFactor;
			sfxSlider.fillCircle(sfxSliderX, 91 * scaleFactor, 9 * scaleFactor);
			sfxValue.setText(Math.round(sfxVol * 100) + '%');

			// Update volumes
			if (musicX !== null) scene.audioManager.setMusicVolume(musicVol);
			if (sfxX !== null) scene.audioManager.setSFXVolume(sfxVol);
		};
		updateSliders();

		// Make sliders draggable
		let isDraggingMusic = false;
		let isDraggingSFX = false;

		// Music slider drag
		musicSlider.setInteractive(
			new Phaser.Geom.Circle(150 * scaleFactor + scene.audioManager.musicVolume * 90 * scaleFactor, 51 * scaleFactor, 12 * scaleFactor),
			Phaser.Geom.Circle.Contains
		);

		musicSlider.on('pointerdown', () => {
			isDraggingMusic = true;
		});

		// SFX slider drag
		sfxSlider.setInteractive(
			new Phaser.Geom.Circle(150 * scaleFactor + scene.audioManager.sfxVolume * 90 * scaleFactor, 91 * scaleFactor, 12 * scaleFactor),
			Phaser.Geom.Circle.Contains
		);

		sfxSlider.on('pointerdown', () => {
			isDraggingSFX = true;
		});

		// Global pointer move and up handlers
		scene.input.on('pointermove', (pointer) => {
			if (!isOpen) return;

			const panelWorldMatrix = panel.getWorldTransformMatrix();
			const localX = pointer.x - panelWorldMatrix.tx;

			if (isDraggingMusic) {
				const clampedX = Phaser.Math.Clamp(localX, 150 * scaleFactor, 240 * scaleFactor);
				updateSliders(clampedX, null);
			}
			if (isDraggingSFX) {
				const clampedX = Phaser.Math.Clamp(localX, 150 * scaleFactor, 240 * scaleFactor);
				updateSliders(null, clampedX);
			}
		});

		scene.input.on('pointerup', () => {
			isDraggingMusic = false;
			isDraggingSFX = false;
		});

		// Music slider bar click
		musicSliderBg.setInteractive(
			new Phaser.Geom.Rectangle(150 * scaleFactor, 48 * scaleFactor - 10 * scaleFactor, 90 * scaleFactor, 20 * scaleFactor),
			Phaser.Geom.Rectangle.Contains
		).on('pointerdown', (pointer) => {
			const localX = Phaser.Math.Clamp(pointer.x - panel.getWorldTransformMatrix().tx, 150 * scaleFactor, 240 * scaleFactor);
			updateSliders(localX, null);
		});

		// SFX slider bar click
		sfxSliderBg.setInteractive(
			new Phaser.Geom.Rectangle(150 * scaleFactor, 88 * scaleFactor - 10 * scaleFactor, 90 * scaleFactor, 20 * scaleFactor),
			Phaser.Geom.Rectangle.Contains
		).on('pointerdown', (pointer) => {
			const localX = Phaser.Math.Clamp(pointer.x - panel.getWorldTransformMatrix().tx, 150 * scaleFactor, 240 * scaleFactor);
			updateSliders(null, localX);
		});

		// Show/hide panel logic
		let isOpen = false;
		const showPanel = () => {
			if (isOpen) return;
			isOpen = true;
			// Move panel to visible position relative to container
			panel.x = -panelWidth/5;
			panel.y = -panelHeight  * scaleFactor;
			panel.setVisible(true);
			scene.tweens.add({
				targets: panel,
				alpha: { from: 0, to: 1 },
				duration: 200,
				ease: 'Cubic.easeOut'
			});
		};
		const hidePanel = () => {
			if (!isOpen) return;
			isOpen = false;
			scene.tweens.add({
				targets: panel,
				alpha: { from: 1, to: 0 },
				duration: 200,
				ease: 'Cubic.easeIn',
				onComplete: () => {
					panel.setVisible(false);
				}
			});
		};

		// Start hidden
		panel.setVisible(false);
		panel.alpha = 0;

		volumeIcon.setInteractive().on('pointerdown', showPanel);
		closeBtn.on('pointerdown', hidePanel);

		this.buttonContainer.add(container);
		// Add panel as a child of the container so it moves with the icon
		container.add(panel);
	}

	
  update(scene, time, delta) {

  }
}
