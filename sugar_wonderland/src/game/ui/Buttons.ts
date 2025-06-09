import { Scene, GameObjects, Tweens, Geom } from 'phaser';
import { Events } from '../scenes/components/Events';
import { GameData } from '../scenes/components/GameData';
import { Autoplay } from '../scenes/components/Autoplay';
import { AudioManager } from '../scenes/components/AudioManager';
import { SlotMachine } from '../scenes/components/SlotMachine';
import { HelpScreen } from '../scenes/components/HelpScreen';
// Custom button interfaces with proper type safety
interface ButtonBase {
    isButton: boolean;
}

// Use type assertion to avoid complex type issues
type ButtonContainer = GameObjects.Container & ButtonBase;
type ButtonImage = GameObjects.Image & ButtonBase;
type ButtonText = GameObjects.Text & ButtonBase;
type ButtonZone = GameObjects.Zone & ButtonBase;

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    helpScreen: HelpScreen;
}

export class Buttons {

    private spinButton: ButtonImage;
    private greenCircBtn: ButtonImage;
    private turboButton: ButtonImage;
    private turboOnButton: ButtonImage;
    public buttonContainer: ButtonContainer;
    private width: number;
    private height: number;
    private buyFeaturePriceText: ButtonText;
    private doubleFeaturePriceText: ButtonText;
    private buyFeatureButton: Phaser.GameObjects.Graphics | null = null;
    private autoplayPopup: GameObjects.Container | null = null;
    private buyFeaturePopup: GameObjects.Container | null = null;
    private balance: Phaser.GameObjects.Graphics;
    private totalWin: Phaser.GameObjects.Graphics;
    private totalBet: Phaser.GameObjects.Graphics;
    private balanceContainer: Phaser.GameObjects.Container;
    private totalWinContainer: Phaser.GameObjects.Container;
    private betContainer: Phaser.GameObjects.Container;
    public autoplay: Autoplay;
    private idleTween: Tweens.Tween | null = null;
    private static PANEL_WIDTH = 250;
    private static PANEL_HEIGHT = 120;
    private autoplayButton: ButtonImage;
    private autoplayOnButton: ButtonImage;
    private betValue: ButtonText;
    private coinValue: ButtonText;
    private totalValue: ButtonText;
    protected betParameters : number[][] = [[1, 0.01, 0.2],[2, 0.01, 0.4],[3, 0.01, 0.6],[4, 0.01, 0.8],[5, 0.01, 1],[6, 0.01, 1.2],[7, 0.01, 1.4],[8, 0.01, 1.6],[9, 0.01, 1.8],[10, 0.01, 2],[4, 0.03, 2.4],[5, 0.03, 3],[6, 0.03, 3.6],[4, 0.05, 4],[7, 0.03, 4.2],[8, 0.03, 4.8],[5, 0.05, 5],[9, 0.03, 5.4],[10, 0.03, 6],[7, 0.05, 7],[8, 0.05, 8],[9, 0.05, 9],[10, 0.05, 10],[6, 0.1, 12],[7, 0.1, 14],[8, 0.1, 16],[9, 0.1, 18],[10, 0.1, 20],[6, 0.2, 24],[7, 0.2, 28],[3, 0.5, 30],[8, 0.2, 32],[9, 0.2, 36],[10, 0.2, 40],[5, 0.5, 50],[6, 0.5, 60],[7, 0.5, 70],[8, 0.5, 80],[9, 0.5, 90],[10, 0.5, 10]];
    constructor() {
        this.autoplay = new Autoplay();
    }

    preload(scene: GameScene): void {
        this.width = scene.scale.width;
        this.height = scene.scale.height;
    
        const prefix = 'assets/Controllers';
        scene.load.image('spinButton', `${prefix}/Spin.png`);
        scene.load.image('turboButton', `${prefix}/Turbo.png`);
        scene.load.image('turboOn', `${prefix}/Turbo_ON.png`);
        scene.load.image('autoplayButton', `${prefix}/Autoplay.png`);
        scene.load.image('autoplayOn', `${prefix}/Autoplay_ON.png`);
        scene.load.image('info', `${prefix}/Info.png`);
        scene.load.image('infoOn', `${prefix}/Info_ON.png`);
        scene.load.image('plus', `${prefix}/Plus.png`);
        scene.load.image('minus', `${prefix}/Minus.png`);
        scene.load.image('logo', 'assets/Logo/Logo.png');
        scene.load.image('volume', `${prefix}/Volume.png`);
        scene.load.image('settings', `${prefix}/Settings.png`);
        scene.load.image('star', `${prefix}/star.png`);
        
        scene.load.image('buyFeatBG', 'assets/Reels/BuyFeatureBG.png');

        scene.load.image('greenBtn', 'assets/Buttons/greenBtn.png');
        scene.load.image('greenLongBtn', 'assets/Buttons/greenLongBtn.png');
        scene.load.image('greenRectBtn', 'assets/Buttons/greenRectBtn.png');
        scene.load.image('greenCircBtn', 'assets/Buttons/greenCircBtn.png');

        // Preload help screen assets
        const helpScreen = new HelpScreen();
        helpScreen.preload(scene);
    }

    create(scene: GameScene): void {
        this.createContainer(scene);
        this.createTurboButton(scene);
        this.createSpinButton(scene);
        this.createAutoplay(scene);
        this.createInfo(scene);
        this.createBalance(scene);
        this.createTotalWin(scene);
        this.createBet(scene);
        this.createBuyFeature(scene);
        this.createDoubleFeature(scene);
        this.createLogo(scene);
        this.createVolumeSettings(scene);
        this.createSettingsButton(scene);
    }

    private createContainer(scene: GameScene): void {
        this.buttonContainer = scene.add.container(0, 0) as ButtonContainer;
        this.buttonContainer.setDepth(4);
    }

    private toggleTurbo(scene: GameScene): void {
        scene.audioManager.UtilityButtonSFX.play();
        
        // Only toggle if not currently spinning or wait for current spin to complete
        if (!scene.gameData.isSpinning) {
            this.turboButton.visible = !this.turboButton.visible;
            this.turboOnButton.visible = !this.turboOnButton.visible;
            scene.gameData.turbo = !scene.gameData.turbo;
        } else {
            // Queue the turbo toggle for after current spin completes
            const onSpinComplete = () => {
                this.turboButton.visible = !this.turboButton.visible;
                this.turboOnButton.visible = !this.turboOnButton.visible;
                scene.gameData.turbo = !scene.gameData.turbo;
                Events.emitter.off(Events.MATCHES_DONE, onSpinComplete); // Remove listener after use
            };
            Events.emitter.once(Events.MATCHES_DONE, onSpinComplete);
        }
    }

    private createTurboButton(scene: GameScene): void {
        const x = this.width * 0.85;
        const y = this.height * 0.29;
        const container = scene.add.container(x, y) as ButtonContainer;

        this.turboButton = scene.add.image(0, 0, 'turboButton') as ButtonImage;
        this.turboOnButton = scene.add.image(0, 0, 'turboOn') as ButtonImage;
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
            new Geom.Circle(0, 0, width * 1.25), 
            Geom.Circle.Contains
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

    private createSpinButton(scene: GameScene): void {
        const x = this.width * 0.85;
        const y = this.height * 0.443;
        const container = scene.add.container(x, y) as ButtonContainer;

        this.spinButton = scene.add.image(0, 0, 'spinButton') as ButtonImage;
        const width = this.spinButton.width * 0.75;
        const height = this.spinButton.height * 0.75;
        
        this.greenCircBtn = scene.add.image(0, 0, 'greenCircBtn') as ButtonImage;
        const widthgcb = this.greenCircBtn.width * 0.9;
        const heightgcb = this.greenCircBtn.height * 0.9;

        const spinButtonBackgroundCircle = scene.add.graphics();
        spinButtonBackgroundCircle.fillStyle(0x000000, 0.15);
        const spinCircleRadius = width * 0.57;
        spinButtonBackgroundCircle.fillCircle(0, 0, spinCircleRadius);

        container.add(spinButtonBackgroundCircle);

        this.spinButton.displayWidth = width;
        this.spinButton.displayHeight = height;
        this.spinButton.setInteractive().isButton = true;
        container.add(this.spinButton);

        this.greenCircBtn.displayWidth = widthgcb;
        this.greenCircBtn.displayHeight = heightgcb;
        this.greenCircBtn.setInteractive().isButton = true;
        container.add(this.greenCircBtn);

        this.buttonContainer.add(container);

        const startIdleRotation = () => {
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
            if (this.idleTween) {
                this.idleTween.stop();
            }
        };

        const canIdleRotate = () => {
            return !scene.gameData.isSpinning && !this.autoplay.isAutoPlaying;
        };

        const updateSpinButtonState = () => {
            // Only disable spin button during actual spin animation or when win overlay is active
            if (scene.gameData.isSpinning || scene.slotMachine.activeWinOverlay) {
                this.spinButton.setAlpha(0.5);
                this.spinButton.disableInteractive();
            } else {
                this.spinButton.setAlpha(1);
                this.spinButton.setInteractive();
            }
        };

        const spinAction = () => {
            // Don't allow spin if currently spinning or win overlay is active
            if (scene.gameData.isSpinning || scene.slotMachine.activeWinOverlay) {
                return;
            }

            // Close help screen if it's open
            if (scene.gameData.isHelpScreenVisible) {
                scene.helpScreen.hide();
            }

            // If autoplay is active, stop it
            if (this.autoplay.isAutoPlaying) {
                this.autoplay.stop();
                this.autoplayButton.visible = true;
                this.autoplayOnButton.visible = false;
                Events.emitter.emit(Events.AUTOPLAY_STOP);
            }

            // Reset total win for new spin
            scene.gameData.totalWin = 0;
            Events.emitter.emit(Events.WIN, {});

            // Trigger spin
            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values
            });
        };

        this.spinButton.on('pointerdown', () => spinAction());

        this.greenCircBtn.on('pointerdown', () => spinAction());
        this.greenCircBtn.visible=false;

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            stopIdleRotation();
            updateSpinButtonState();
        });

        Events.emitter.on(Events.MATCHES_DONE, () => {
            updateSpinButtonState();
            if (canIdleRotate()) {
                startIdleRotation();
            }
        });

        Events.emitter.on(Events.SPIN_ANIMATION_END, () => {
            updateSpinButtonState();
        });

        // Listen for win overlay state changes
        Events.emitter.on(Events.WIN_OVERLAY_SHOW, () => {
            updateSpinButtonState();
        });

        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            updateSpinButtonState();
        });

        // Initial state
        updateSpinButtonState();
        if (canIdleRotate()) {
            startIdleRotation();
        }
    }

    private createAutoplay(scene: GameScene): void {
        const x = this.width * 0.85;
        const y = this.height * 0.598;
        const radius = 60;

        const container = scene.add.container(x, y) as ButtonContainer;

        this.autoplayButton = scene.add.image(0, 0, 'autoplayButton') as ButtonImage;
        this.autoplayOnButton = scene.add.image(0, 0, 'autoplayOn') as ButtonImage;
        
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

        // Store popup reference for external access
        this.autoplayPopup = popup;

        // Popup background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.lineStyle(1, 0x66D449, 1);
        bg.strokeRoundedRect(0, 0, popupWidth, popupHeight, 16);
        bg.fillRoundedRect(0, 0, popupWidth, popupHeight, 16);
        popup.add(bg);
        
        // Add blur effect if available
        if ((scene.sys.game.renderer as any).pipelines) {
            bg.setPipeline('BlurPostFX');
        }

        // Title
        const title = scene.add.text(popupWidth / 2, 32, 'AUTOPLAY SETTINGS', {
            fontSize: '28px',
            color: '#66D449',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });
        title.setOrigin(0.5, 0.5);
        popup.add(title);

        // Close button
        const closeBtn = scene.add.text(popupWidth - 32, 32, '×', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        closeBtn.setOrigin(0.5, 0.5);
        (closeBtn as any as ButtonText).setInteractive().isButton = true;
        popup.add(closeBtn);

        // Balance section
        const balanceLabel = scene.add.text(32, 80, 'Balance', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        popup.add(balanceLabel);

        const balanceValue = scene.add.text(popupWidth - 32, 80, scene.gameData.currency + scene.gameData.balance.toLocaleString(), {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'right'
        });
        balanceValue.setOrigin(1, 0);
        popup.add(balanceValue);

        // Number of autospins section
        const spinsLabel = scene.add.text(32, 130, 'Number of autospins', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        popup.add(spinsLabel);

        // Spin options
        const spinOptions = [10, 30, 50, 75, 100, 150, 500, 1000];
        const buttonWidth = 90;
        const buttonHeight = 40;
        const spacing = 16;
        let selectedSpins = spinOptions[0]; // Set default to first option
        let selectedButton: GameObjects.Container | null = null;

        const buttons = spinOptions.map((spins, index) => {
            const row = Math.floor(index / 4);
            const col = index % 4;
            const x = 32 + col * (buttonWidth + spacing);
            const y = 170 + row * (buttonHeight + spacing);

            const buttonContainer = scene.add.container(x, y);

            // Button background
            const buttonBg = scene.add.graphics();
            buttonBg.fillStyle(index === 0 ? 0x66D449 : 0x181818, 1); // Highlight first button by default
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            buttonContainer.add(buttonBg);

            // Button text
            const text = scene.add.text(buttonWidth/2, buttonHeight/2, spins.toString(), {
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold'
            });
            text.setOrigin(0.5);
            buttonContainer.add(text);

            // Make button interactive
            const hitArea = new Geom.Rectangle(0, 0, buttonWidth, buttonHeight);
            buttonContainer.setInteractive(hitArea, Geom.Rectangle.Contains);
            (buttonContainer as any).isButton = true;

            buttonContainer.on('pointerdown', () => {
                scene.audioManager.UtilityButtonSFX.play();
                
                // Deselect previous button
                if (selectedButton) {
                    const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                    prevBg.clear();
                    prevBg.fillStyle(0x181818, 1);
                    prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                }
                
                // Select this button
                buttonBg.clear();
                buttonBg.fillStyle(0x66D449, 1);
                buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                selectedButton = buttonContainer;
                selectedSpins = spins;

                // Update total bet display
                updateBetDisplay();
            });

            popup.add(buttonContainer);
            return buttonContainer;
        });

        // Set initial selected button
        selectedButton = buttons[0];

        // Total bet section
        const betLabel = scene.add.text(32, 300, 'Total Bet', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        popup.add(betLabel);

        // Bet controls
        const minusBtn = scene.add.image(popupWidth/2 - 100, 300, 'minus');
        minusBtn.setScale(0.4);
        (minusBtn as any as ButtonImage).setInteractive().isButton = true;
        popup.add(minusBtn);

        let bet = scene.gameData.bet * selectedSpins; // Initialize bet with selected spins
        const betValue = scene.add.text(popupWidth/2, 300, scene.gameData.currency + '0', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'center'
        }) as ButtonText;
        betValue.setOrigin(0.5, 0);
        popup.add(betValue);

        const plusBtn = scene.add.image(popupWidth/2 + 100, 300, 'plus');
        plusBtn.setScale(0.4);
        (plusBtn as any as ButtonImage).setInteractive().isButton = true;
        popup.add(plusBtn);

        plusBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            
            // Find the next higher spin option
            const nextSpinOption = spinOptions.find(spins => spins > selectedSpins);
            if (nextSpinOption) {
                // Update selected spins and bet immediately
                selectedSpins = nextSpinOption;
                bet = scene.gameData.bet * selectedSpins;
                
                // Update button appearance
                if (selectedButton) {
                    const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                    prevBg.clear();
                    prevBg.fillStyle(0x181818, 1);
                    prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                }
                
                // Select the next button
                const nextButton = buttons[spinOptions.indexOf(nextSpinOption)];
                const nextBg = nextButton.list[0] as GameObjects.Graphics;
                nextBg.clear();
                nextBg.fillStyle(0x66D449, 1);
                nextBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                selectedButton = nextButton;
                
                // Update display
                updateBetDisplay();
            }
        });

        minusBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            
            // Find the next lower spin option
            const prevSpinOption = [...spinOptions].reverse().find(spins => spins < selectedSpins);
            if (prevSpinOption) {
                // Update selected spins and bet immediately
                selectedSpins = prevSpinOption;
                bet = scene.gameData.bet * selectedSpins;
                
                // Update button appearance
                if (selectedButton) {
                    const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                    prevBg.clear();
                    prevBg.fillStyle(0x181818, 1);
                    prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                }
                
                // Select the previous button
                const prevButton = buttons[spinOptions.indexOf(prevSpinOption)];
                const prevBg = prevButton.list[0] as GameObjects.Graphics;
                prevBg.clear();
                prevBg.fillStyle(0x66D449, 1);
                prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                selectedButton = prevButton;
                
                // Update display
                updateBetDisplay();
            }
        });

        function updateBetDisplay() {
            const autoplayCost = scene.gameData.bet * selectedSpins;
            betValue.setText(scene.gameData.currency + autoplayCost.toLocaleString());
        }
        updateBetDisplay();

        // Start Autoplay button - moved down to avoid overlap
        const startBtnBg = scene.add.image(popupWidth / 2, popupHeight - 35, 'greenLongBtn');
        startBtnBg.displayWidth = popupWidth - 64;
        startBtnBg.displayHeight = 50;
        startBtnBg.setOrigin(0.5, 0.5);
        popup.add(startBtnBg);

        const startBtnText = scene.add.text(popupWidth / 2, popupHeight - 35, 'START AUTOPLAY', {
            fontSize: '28px',
            color: '#000000',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });
        startBtnText.setOrigin(0.5, 0.5);
        popup.add(startBtnText);

        (startBtnBg as any as ButtonImage).setInteractive().isButton = true;
        startBtnBg.on('pointerdown', () => {
            if (selectedSpins > 0) {
                scene.audioManager.UtilityButtonSFX.play();
                this.autoplayButton.visible = false;
                this.autoplayOnButton.visible = true;
                popup.setVisible(false);
                
                // Start autoplay 
                this.autoplay.start(scene, selectedSpins);
                Events.emitter.emit(Events.AUTOPLAY_START);
            }
        });

        closeBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            popup.setVisible(false);
        });

        // Update balance display when popup is shown
        const updateBalance = () => {
            const balance = scene.gameData.balance;
            balanceValue.setText(scene.gameData.currency + balance.toLocaleString());
        };

        // Show popup when autoplay button is pressed
        this.autoplayButton.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            
            // Close buy feature popup if open
            if (this.buyFeaturePopup && this.buyFeaturePopup.visible) {
                this.closeBuyFeaturePopup();
            }
            updateBalance();
            bet = scene.gameData.bet * selectedSpins;
            updateBetDisplay();
            popup.setVisible(true);
        });

        this.autoplayOnButton.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
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

    private createInfo(scene: GameScene): void {
        const x = this.width * 0.85;
        const y = this.height * 0.70;
        const container = scene.add.container(x, y) as ButtonContainer;

        const infoButton = scene.add.image(0, 0, 'info') as ButtonImage;
        const infoOnButton = scene.add.image(0, 0, 'infoOn') as ButtonImage;
        infoOnButton.visible = false;

        const width = infoButton.width * 0.6;
        const height = infoButton.height * 0.6;

        // inner circle
        const innerCircle = scene.add.graphics();
        innerCircle.fillStyle(0x000000, 0.5);
        innerCircle.fillCircle(0, 0, width * 1.5);
        container.add(innerCircle);

        // outer circle
        const border = scene.add.graphics();
        border.fillStyle(0x000000, 0.15);
        border.fillCircle(0, 0, width * 2.25);
        container.add(border);

        infoButton.displayWidth = width;
        infoButton.displayHeight = height;
        infoOnButton.displayWidth = width * 4.5;
        infoOnButton.displayHeight = height * 2.25;
        infoButton.setInteractive().isButton = true;
        infoOnButton.setInteractive().isButton = true;
        container.add(infoButton);
        container.add(infoOnButton);

        this.buttonContainer.add(container);

        container.setInteractive(
            new Geom.Circle(0, 0, width * 1.25),
            Geom.Circle.Contains
        ).isButton = true;

        const toggleInfo = () => {
            scene.audioManager.UtilityButtonSFX.play();
            this.hideBetPopup(scene);
            
            if (scene.gameData.isHelpScreenVisible) {
                // If help screen is visible, hide and destroy it
                scene.helpScreen.hide();
                infoButton.visible = true;
                infoOnButton.visible = false;
            } else {
                // If help screen is hidden, create and show it
                if (!scene.helpScreen) {
                    scene.helpScreen = new HelpScreen();
                }
                scene.helpScreen.create(scene);
                scene.helpScreen.show();
                infoButton.visible = false;
                infoOnButton.visible = true;
            }
            
            scene.gameData.isHelpScreenVisible = !scene.gameData.isHelpScreenVisible;
        };

        container.on('pointerdown', toggleInfo);
        infoButton.on('pointerdown', toggleInfo);
        infoOnButton.on('pointerdown', toggleInfo);

        // Listen for help screen toggle event
        Events.emitter.on(Events.HELP_SCREEN_TOGGLE, () => {
            // Update button state based on help screen visibility
            const isVisible = scene.gameData.isHelpScreenVisible;
            infoButton.visible = !isVisible;
            infoOnButton.visible = isVisible;
        });
    }

    private createBalance(scene: GameScene): void {
        const width = Buttons.PANEL_WIDTH * 1.5;
        const x = this.width * 0.24;
        const y = this.height * 0.83;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;

        // Create a gradient texture for balance
        const gradientTexture = scene.textures.createCanvas('balanceGradient', width, Buttons.PANEL_HEIGHT);
        if (gradientTexture) {
            const context = gradientTexture.getContext();
            const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
            gradientTexture.refresh();
        }

        // Create the background with gradient and border
        this.balance = scene.add.graphics();
        this.balance.fillStyle(0x000000, 0.5);
        this.balance.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.balance.lineStyle(1, 0x00FFFC);
        this.balance.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.balance);

        const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BALANCE', {
            fontSize: '25px',
            color: '#57FFA3',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        const balance = scene.gameData.balance;
        const balanceString = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const text2 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${balanceString}`, {
            fontSize: '35px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text2);
        text2.setOrigin(0.5, 0.5);

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            const balance2 = scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            text2.setText(`$ ${balance2}`);
        });

        Events.emitter.on(Events.WIN, () => {
            const balance2 = scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            text2.setText(`$ ${balance2}`);
        });

        this.balanceContainer = container;
        this.buttonContainer.add(container);
    }

    private createTotalWin(scene: GameScene): void {
        const width = Buttons.PANEL_WIDTH * 1.5;
        const x = this.balanceContainer.x + width + this.width * 0.01;
        const y = this.balanceContainer.y;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;
        container.setDepth(4);

        // Create a gradient texture for totalWin
        const gradientTexture = scene.textures.createCanvas('totalWinGradient', width, Buttons.PANEL_HEIGHT);
        if (gradientTexture) {
            const context = gradientTexture.getContext();
            const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
            gradientTexture.refresh();
        }

        // Create the background with gradient and border
        this.totalWin = scene.add.graphics();
        this.totalWin.fillStyle(0x000000, 0.5);
        this.totalWin.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.totalWin.lineStyle(1, 0x00FFFC);
        this.totalWin.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.totalWin);

        const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'TOTAL WIN', {
            fontSize: '25px',
            color: '#57FFA3',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        let totalWin = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const text2 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${totalWin}`, {
            fontSize: '35px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text2);
        text2.setOrigin(0.5, 0.5);

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            let totalWin2 = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            text2.setText(`$ ${totalWin2}`);
        });

        Events.emitter.on(Events.WIN, () => {
            let totalWin2 = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            text2.setText(`$ ${totalWin2}`);
        });

        this.totalWinContainer = container;
        this.buttonContainer.add(container);
    }

    private createBet(scene: GameScene): void {
        const width = Buttons.PANEL_WIDTH;
        const x = this.totalWinContainer.x + width * 1.5 + this.width * 0.01;
        const y = this.height * 0.83;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;
        container.setDepth(4);

        // Create the background with gradient and border
        this.totalBet = scene.add.graphics();
        this.totalBet.fillStyle(0x000000, 0.5);
        this.totalBet.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.totalBet.lineStyle(1, 0x00FFFC);
        this.totalBet.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.totalBet);

        const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BET', {
            fontSize: '25px',
            color: '#57FFA3',
            align: 'center', 
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        // Add bet value text under BET
        const betValueText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, scene.gameData.currency + (scene.gameData.baseBet * scene.gameData.coinValue * 20).toFixed(2), {
            fontSize: '35px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(betValueText);
        betValueText.setOrigin(0.5, 0.5);

        // Create plus/minus buttons
        const plusBtn = scene.add.image(width * 0.9, Buttons.PANEL_HEIGHT * 0.65, 'plus') as ButtonImage;
        plusBtn.setScale(0.25);
        plusBtn.setInteractive().isButton = true;
        container.add(plusBtn);

        const minusBtn = scene.add.image(width * 0.1, Buttons.PANEL_HEIGHT * 0.65, 'minus') as ButtonImage;
        minusBtn.setScale(0.25);
        minusBtn.setInteractive().isButton = true;
        container.add(minusBtn);

        // Add click handlers to show bet popup
        plusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            
            this.showBetPopup(scene);
        });

        minusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            this.showBetPopup(scene);
        });

        // Update bet value when it changes
        Events.emitter.on(Events.CHANGE_BET, () => {
            const totalBet = (scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            betValueText.setText(scene.gameData.currency + totalBet);
        });

        Events.emitter.on(Events.ENHANCE_BET_TOGGLE, (data: any) => {
            if(scene.gameData.doubleChanceEnabled) {
                betValueText.setText(scene.gameData.currency + (scene.gameData.baseBet * scene.gameData.coinValue * 1.25 * 20).toFixed(2));
            } else {
                betValueText.setText(scene.gameData.currency + (scene.gameData.baseBet * scene.gameData.coinValue  * 20).toFixed(2));
            }
        });

        this.buttonContainer.add(container);

        // Create bet adjustment popup
        const betContainer = scene.add.container(0, 0);
        betContainer.setDepth(5);

        // Create bet background
        const betBg = scene.add.graphics();
        betBg.fillStyle(0x333333, 0.95);
        betBg.fillRoundedRect(0, 0, 400, 300, 20);
        betBg.lineStyle(4, 0x57FFA3);
        betBg.strokeRoundedRect(0, 0, 400, 300, 20);
        betContainer.add(betBg);

        // Title
        const titleText = scene.add.text(200, 30, 'BET ADJUSTMENT', {
            fontSize: '32px',
            color: '#57FFA3',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        titleText.setOrigin(0.5, 0.5);
        betContainer.add(titleText);

        // Close button
        const closeBtn = scene.add.text(380, 30, '×', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        }) as ButtonText;
        closeBtn.setOrigin(0.5, 0.5);
        closeBtn.setInteractive().isButton = true;
        betContainer.add(closeBtn);

        // Add hover effect for close button
        closeBtn.on('pointerover', () => {
            closeBtn.setColor('#57FFA3');
        });

        closeBtn.on('pointerout', () => {
            closeBtn.setColor('#FFFFFF');
        });

        // Close button click handler
        closeBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            this.hideBetPopup(scene);
        });

        // Row spacing constants
        const rowHeight = 60;
        const startY = 100;
        const labelX = 50;
        const valueX = 280;
        const buttonSpacing = 70;

        // Bet Controls
        const betLabel = scene.add.text(labelX * 1.8, startY, 'BET', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        betContainer.add(betLabel);

        const betValue = scene.add.text(valueX, startY + rowHeight / 4, scene.gameData.baseBet.toString(), {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        betValue.setOrigin(0.5);
        betContainer.add(betValue);

        // Bet plus/minus buttons
        const betMinusBtn = scene.add.image(valueX - buttonSpacing, startY + rowHeight / 4, 'minus') as ButtonImage;
        betMinusBtn.setScale(0.25);
        betMinusBtn.setInteractive().isButton = true;
        betContainer.add(betMinusBtn);

        const betPlusBtn = scene.add.image(valueX + buttonSpacing, startY + rowHeight / 4, 'plus') as ButtonImage;
        betPlusBtn.setScale(0.25);
        betPlusBtn.setInteractive().isButton = true;
        betContainer.add(betPlusBtn);

        // Coin Value Controls
        const coinLabel = scene.add.text(labelX - 10, startY + rowHeight, 'COIN VALUE', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        betContainer.add(coinLabel);

        const coinValue = scene.add.text(valueX, startY + rowHeight * 1.25,
            scene.gameData.currency + scene.gameData.coinValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        coinValue.setOrigin(0.5);
        betContainer.add(coinValue);

        // Coin value plus/minus buttons
        const coinMinusBtn = scene.add.image(valueX - buttonSpacing, startY + rowHeight * 1.25, 'minus') as ButtonImage;
        coinMinusBtn.setScale(0.25);
        coinMinusBtn.setInteractive().isButton = true;
        betContainer.add(coinMinusBtn);

        const coinPlusBtn = scene.add.image(valueX + buttonSpacing, startY + rowHeight * 1.25, 'plus') as ButtonImage;
        coinPlusBtn.setScale(0.25);
        coinPlusBtn.setInteractive().isButton = true;
        betContainer.add(coinPlusBtn);

        // Total Bet Display
        const totalLabel = scene.add.text(labelX, startY + rowHeight * 2, 'TOTAL BET', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        betContainer.add(totalLabel);

        const totalValue = scene.add.text(valueX, startY + rowHeight * 2.25, '$100', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        totalValue.setOrigin(0.5);
        betContainer.add(totalValue);

        // Total bet plus/minus buttons
        const totalMinusBtn = scene.add.image(valueX - buttonSpacing, startY + rowHeight * 2.25, 'minus') as ButtonImage;
        totalMinusBtn.setScale(0.25);
        totalMinusBtn.setInteractive().isButton = true;
        betContainer.add(totalMinusBtn);

        const totalPlusBtn = scene.add.image(valueX + buttonSpacing, startY + rowHeight * 2.25, 'plus') as ButtonImage;
        totalPlusBtn.setScale(0.25);
        totalPlusBtn.setInteractive().isButton = true;
        betContainer.add(totalPlusBtn);

        // Bet Max Button
        const betMaxBtn = scene.add.graphics();
        betMaxBtn.fillStyle(0x57FFA3, 1);
        betMaxBtn.fillRoundedRect(100, startY + rowHeight * 3, 200, 40, 20);
        betContainer.add(betMaxBtn);

        const betMaxText = scene.add.text(200, startY + rowHeight * 3 + 20, 'BET MAX', {
            fontSize: '24px',
            color: '#000000',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        betMaxText.setOrigin(0.5, 0.5);
        betContainer.add(betMaxText);

        // Make bet max button interactive
        const betMaxZone = scene.add.zone(200, startY + rowHeight * 3 + 20, 200, 40);
        betMaxZone.setInteractive();
        betContainer.add(betMaxZone);

        // Add hover effects
        betMaxZone.on('pointerover', () => {
            betMaxBtn.clear();
            betMaxBtn.fillStyle(0x3FFF0D, 1);
            betMaxBtn.fillRoundedRect(100, startY + rowHeight * 3, 200, 40, 20);
        });

        betMaxZone.on('pointerout', () => {
            betMaxBtn.clear();
            betMaxBtn.fillStyle(0x57FFA3, 1);
            betMaxBtn.fillRoundedRect(100, startY + rowHeight * 3, 200, 40, 20);
        });

        // Position the container
        betContainer.setPosition(scene.scale.width / 2 - 200, scene.scale.height / 2 - 150);
        betContainer.setVisible(false);

        // Store references
        this.betContainer = betContainer;
        this.betValue = betValue;
        this.coinValue = coinValue;
        this.totalValue = totalValue;

        // Coin value options
        const coinValues = [0.01, 0.03, 0.05, 0.1, 0.2, 0.5];
        let currentCoinIndex = coinValues.indexOf(parseFloat(coinValue.text.replace('$', '')));
        if (currentCoinIndex === -1) currentCoinIndex = 0;

        // Update total bet display
        const updateTotalBet = () => {
            const bet = scene.gameData.baseBet;
            const coin = scene.gameData.coinValue;
            const total = (bet * coin * 20).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            totalValue.setText('$' + total);
            return total;
        };

        // Update bet value display
        const updateBetValue = (value: number) => {
            betValue.setText(value.toString());
            scene.gameData.baseBet = value;
            updateTotalBet();
        };

        // Update coin value display
        const updateCoinValue = (index: number) => {
            currentCoinIndex = index;
            coinValue.setText('$' + coinValues[index].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            scene.gameData.coinValue = coinValues[index];
            updateTotalBet();
        };

        // Bet value controls
        betMinusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            const currentBet = parseInt(betValue.text);
            if (currentBet > 1) {
                updateBetValue(currentBet - 1);
            }
            updateGameData();
        });

        betPlusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            const currentBet = parseInt(betValue.text);
            if (currentBet < 10) {
                updateBetValue(currentBet + 1);
            }
            updateGameData();
        });

        // Coin value controls
        coinMinusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            if (currentCoinIndex > 0) {
                updateCoinValue(currentCoinIndex - 1);
            }
            updateGameData();
        });

        coinPlusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            if (currentCoinIndex < coinValues.length - 1) {
                updateCoinValue(currentCoinIndex + 1);
            }
            updateGameData();
        });

        // Total bet controls
        totalMinusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            const currentBet = parseInt(betValue.text);
            if (currentBet > 1) {
                updateBetValue(currentBet - 1);
            } else if (currentCoinIndex > 0) {
                updateBetValue(10);
                updateCoinValue(currentCoinIndex - 1);
            }
            updateGameData();
        });

        totalPlusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            const currentBet = parseInt(betValue.text);
            if (currentBet < 10) {
                updateBetValue(currentBet + 1);
            } else if (currentCoinIndex < coinValues.length - 1) {
                updateBetValue(1);
                updateCoinValue(currentCoinIndex + 1);
            }
            updateGameData();
        });

        // Bet max button
        betMaxZone.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            updateBetValue(10);
            updateCoinValue(coinValues.length - 1);
            updateGameData();
        });

        // Update game data when values change
        const updateGameData = () => {
            const baseBet = parseInt(betValue.text);
            const coin = parseFloat(coinValue.text.replace('$', ''));
            scene.gameData.baseBet = baseBet;
            scene.gameData.coinValue = coin;
            scene.gameData.bet = baseBet * coin * 20;
            
            Events.emitter.emit(Events.CHANGE_BET, {});
        };

        // Add change handlers
        betValue.on('changedata', updateGameData);
        coinValue.on('changedata', updateGameData);
    }

    private updateTotalBet(scene: GameScene): void {
        const baseBet = parseInt(this.betValue.text);
        const coinValue = parseFloat(this.coinValue.text.replace('$', ''));
        const total = (baseBet * coinValue).toFixed(2);
        
        this.totalValue.setText('$' + total);

        // Update game data
        scene.gameData.baseBet = baseBet;
        scene.gameData.coinValue = coinValue;
        scene.gameData.bet = (baseBet * coinValue * 20);
        
        Events.emitter.emit(Events.CHANGE_BET, {});
    }

    public showBetPopup(scene: GameScene): void {
        if (this.betContainer) {
            // Initialize values from current game state
            this.betValue.setText(scene.gameData.baseBet.toString());
            this.coinValue.setText('$' + scene.gameData.coinValue.toFixed(2));
            this.updateTotalBet(scene);

            this.betContainer.setVisible(true);
            this.betContainer.setAlpha(0);
            scene.tweens.add({
                targets: this.betContainer,
                alpha: 1,
                duration: 1000,
                ease: 'Back.easeOut'
            });
        }
    }

    public hideBetPopup(scene: GameScene): void {
        if (this.betContainer) {
            scene.tweens.add({
                targets: this.betContainer,
                alpha: 0,
                duration: 200,
                ease: 'Back.easeIn',
                onComplete: () => {
                    this.betContainer.setVisible(false);
                }
            });
        }
    }

    private createBuyFeature(scene: GameScene): void {
        // Elliptical buy feature button in upper left
        const x = this.width * 0.15;
        const y = this.height * 0.13;
        const ellipseWidth = 277;
        const ellipseHeight = 114;
        const container = scene.add.container(x, y) as ButtonContainer;

        // Button background
        const buttonBg = scene.add.graphics();
        buttonBg.fillStyle(0x181818, 0.95);
        buttonBg.lineStyle(10, 0x57FFA3, 1);
        buttonBg.strokeRoundedRect(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight, ellipseHeight/2);
        buttonBg.fillRoundedRect(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight, ellipseHeight/2);
        container.add(buttonBg);

        // Stars
        const starLeft = scene.add.image(-ellipseWidth/2 + 32, -24, 'star') as ButtonImage;
        container.add(starLeft);
        const starRight = scene.add.image(ellipseWidth/2 - 32, -24, 'star') as ButtonImage;
        container.add(starRight);

        // BUY FEATURE text
        const buttonText = scene.add.text(0, -24, 'BUY FEATURE', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            letterSpacing: 1.5,
            stroke: '#181818',
            strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true }
        }) as ButtonText;
        buttonText.setOrigin(0.5, 0.5);
        container.add(buttonText);

        // Price text (large, green)
        const price = scene.gameData.getBuyFeaturePrice();
        this.buyFeaturePriceText = scene.add.text(0, 24, scene.gameData.currency + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), {
            fontSize: '42px',
            color: '#00FF6A',
            fontFamily: 'Poppins',
            align: 'center',
            fontStyle: 'bold'
        }) as ButtonText;
        this.buyFeaturePriceText.setOrigin(0.5, 0.5);
        container.add(this.buyFeaturePriceText);

        // Make button interactive
        buttonBg.setInteractive(
            new Geom.Rectangle(-ellipseWidth/2, -ellipseHeight/2, ellipseWidth, ellipseHeight),
            Geom.Rectangle.Contains
        );
        (buttonBg as any).isButton = true;
        this.buyFeatureButton = buttonBg;
        this.buttonContainer.add(container);

        // Create the popup
        const width = 420;
        const height = 260;
        const popupX = scene.scale.width / 2 - width / 2;
        const popupY = scene.scale.height / 2 - height / 2;

        const popupContainer = scene.add.container(popupX, popupY) as ButtonContainer;
        popupContainer.setDepth(1000);
        popupContainer.setVisible(false);

        // Popup background
        const bg = scene.add.image(width/2, height/2, 'buyFeatBG') as ButtonImage;
        bg.setOrigin(0.5, 0.5);
        popupContainer.add(bg);
        if ((scene.sys.game.renderer as any).pipelines) {
            bg.setPipeline('BlurPostFX');
        }

        // Title
        const title = scene.add.text(width / 2, 32, 'FREE SPIN', {
            fontSize: '24px',
            color: '#66D449',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        title.setOrigin(0.5, 0.5);
        popupContainer.add(title);

        // Main text
        const buyText = scene.add.text(width / 2, 100, '', {
            fontSize: '28px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width }
        }) as ButtonText;
        buyText.setOrigin(0.5, 0.5);
        popupContainer.add(buyText);

        // Buy and Close buttons
        const buyBtnBg = scene.add.image(width / 2 - 100, height - 48, 'greenBtn') as ButtonImage;
        buyBtnBg.displayWidth = 100;
        buyBtnBg.displayHeight = 44;
        buyBtnBg.setOrigin(0.5, 0.5);
        popupContainer.add(buyBtnBg);
        
        const buyBtnText = scene.add.text(width / 9, height - 48, 'Buy', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        buyBtnText.setOrigin(-0.5, 0.5);
        popupContainer.add(buyBtnText);

        const closeBtnText = scene.add.text(width / 2 + 100, height - 48, 'Close', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        }) as ButtonText;
        closeBtnText.setOrigin(0.5, 0.5);
        popupContainer.add(closeBtnText);

        buyBtnBg.setInteractive().isButton = true;
        buyBtnBg.on('pointerdown', () => {
            // Set up for guaranteed scatter trigger
            scene.gameData.minScatter = 4;
            scene.gameData.balance -= scene.gameData.getBuyFeaturePrice() - scene.gameData.bet;
            
            // Reset any existing state
            scene.gameData.isSpinning = false;
            scene.gameData.totalWin = 0;
            Events.emitter.emit(Events.WIN, {});
            
            // Hide the popup
            popupContainer.setVisible(false);
            
            // Trigger the spin without deducting bet amount
            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values,
                isBuyFeature: true  // Add flag to indicate this is a buy feature spin
            });
        });

        // Function to update button state
        const updateButtonState = () => {
            // Disable if spinning, autoplay is active, or in bonus round
            const shouldDisable = scene.gameData.isSpinning || 
                this.autoplay.isAutoPlaying || 
                scene.gameData.isBonusRound;

            if (shouldDisable) {
                buttonBg.setAlpha(0.5);
                this.buyFeaturePriceText.setAlpha(0.5);
                buttonText.setAlpha(0.5);
                starLeft.setAlpha(0.5);
                starRight.setAlpha(0.5);
            } else {
                buttonBg.setAlpha(1);
                this.buyFeaturePriceText.setAlpha(1);
                buttonText.setAlpha(1);
                starLeft.setAlpha(1);
                starRight.setAlpha(1);
            }
        };

        // Show popup when buy feature is pressed
        const showBuyFeaturePopup = () => {
            // Don't show if spinning, autoplay is active, or in bonus round
            if (scene.gameData.isSpinning || 
                this.autoplay.isAutoPlaying || 
                scene.gameData.isBonusRound) return;
            
            // Close autoplay settings if open
            if (this.autoplayPopup && this.autoplayPopup.visible) {
                this.autoplayPopup.setVisible(false);
            }
            const cost = scene.gameData.getBuyFeaturePrice().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            buyText.setText(`Buy 10 Free Spin\nAt the cost of $${cost}?`);
            buyText.setStyle({
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontSize: '32px',
                fontStyle: 'normal',
                fontWeight: '700',
                align: 'center',
                lineHeight: 'normal'
            });
            popupContainer.setVisible(true);
            popupContainer.alpha = 0;
            scene.tweens.add({
                targets: popupContainer,
                alpha: { from: 0, to: 1 },
                duration: 200,
                ease: 'Cubic.easeOut'
            });
        };

        // Add click handlers
        buttonBg.on('pointerdown', showBuyFeaturePopup);
        closeBtnText.setInteractive().isButton = true;
        closeBtnText.on('pointerdown', () => {
            popupContainer.setVisible(false);
        });

        // Listen for spin state changes
        Events.emitter.on(Events.SPIN_ANIMATION_START, updateButtonState);
        Events.emitter.on(Events.SPIN_ANIMATION_END, updateButtonState);
        Events.emitter.on(Events.MATCHES_DONE, updateButtonState);
        
		// Listen for bet changes to update price
		Events.emitter.on(Events.CHANGE_BET, () => {
			this.updateBuyFeaturePrice(scene, scene.gameData.getBuyFeaturePrice());
		});
    }

    updateBuyFeaturePrice(scene: GameScene, newPrice: number) {
		if (this.buyFeaturePriceText) {
			this.buyFeaturePriceText.setText(scene.gameData.currency + newPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
		}
	}


    private createDoubleFeature(scene: GameScene): void {
        const width = 254;
        const height = 131;
        const x = this.width * 0.8;
        const y = this.height * 0.82;

        const container = scene.add.container(x, y) as ButtonContainer;

        // Green gradient background with border
        const bg = scene.add.image(width / 2, height / 2, 'greenRectBtn') as ButtonImage;
        bg.displayWidth = width;
        bg.displayHeight = height;
        bg.setOrigin(0.5, 0.5);
        container.add(bg);

        // Bet box (left)
        const betBox = scene.add.graphics();
        betBox.fillStyle(0x181818, 1);
        betBox.fillRoundedRect(15, 20, 90, 90, 16);
        container.add(betBox);
        
        const betLabel = scene.add.text(60, 45, 'BET', {
            fontSize: '24px',
            color: '#DDDDDD',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        betLabel.setOrigin(0.5, 0.5);
        container.add(betLabel);

        // Create auto-sized double feature price text
        this.doubleFeaturePriceText = scene.add.text(60, 90, scene.gameData.getDoubleFeaturePrice().toString(), {
            fontSize: '36px',
            color: '#57FFA3',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: 80 }, // Slightly less than box width for padding
            metrics: {
                fontSize: 36,
                ascent: 28,
                descent: 8
            }
        }) as ButtonText;
        this.doubleFeaturePriceText.setOrigin(0.5, 0.75);
        container.add(this.doubleFeaturePriceText);

        // Function to update text size based on content
        const updateTextSize = () => {
            const maxWidth = 80; // Maximum width available in the box
            const currentWidth = this.doubleFeaturePriceText.width;
            const currentSize = parseInt(this.doubleFeaturePriceText.style.fontSize as string);
            
            if (currentWidth > maxWidth) {
                // Calculate new size, but not smaller than minFontSize
                let newSize = Math.max(24, Math.floor(currentSize * (maxWidth / currentWidth)));
                // Cap at maxFontSize
                newSize = Math.min(36, newSize);
                this.doubleFeaturePriceText.setStyle({ fontSize: `${newSize}px` });
            } else if (currentWidth < maxWidth * 0.8 && currentSize < 36) {
                // Try to increase size if there's room, but not larger than maxFontSize
                let newSize = Math.min(36, Math.floor(currentSize * (maxWidth / currentWidth)));
                // Don't go below minFontSize
                newSize = Math.max(24, newSize);
                this.doubleFeaturePriceText.setStyle({ fontSize: `${newSize}px` });
            }
        };

        // Initial size update
        updateTextSize();

        // Update text size when the price changes
        Events.emitter.on(Events.CHANGE_BET, () => {
            if (this.doubleFeaturePriceText) {
                this.doubleFeaturePriceText.setText(scene.gameData.getDoubleFeaturePrice().toString());
                updateTextSize();
            }
        });

        // Enhanced Bet label (right, top)
        const enhancedLabel = scene.add.text(width - 140, 10, 'Enhanced Bet', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        }) as ButtonText;
        container.add(enhancedLabel);

        // Toggle switch (right, middle)
        const toggleX = width - 120;
        const toggleY = 40;
        const toggleWidth = 64;
        const toggleHeight = 36;
        const toggleRadius = 18;
        const toggleBg = scene.add.graphics();
        toggleBg.fillStyle(0x181818, 1);
        toggleBg.lineStyle(3, 0xFFFFFF, 0.5);
        toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
        toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
        container.add(toggleBg);

        const toggleCircle = scene.add.graphics();
        let isEnabled = !!scene.gameData.doubleChanceEnabled;

        const drawToggle = () => {
            toggleCircle.clear();
            if (isEnabled) {
                toggleBg.clear();
                toggleBg.fillStyle(0x379557, 1);
                toggleBg.lineStyle(5, 0xFFFFFF, 1);
                toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleCircle.fillStyle(0x3FFF0D, 1);
                toggleCircle.fillCircle(toggleX + toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
                
                // Gray out bet box when enabled
                betBox.clear();
                betBox.fillStyle(0x000000, 1);
                betBox.fillRoundedRect(15, 20, 90, 90, 16);

                betLabel.setColor('#FFFFFF');
                this.doubleFeaturePriceText.setColor('#3FFF0D');

                scene.gameData.doubleChanceEnabled = true;
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            } else {
                toggleBg.clear();
                toggleBg.fillStyle(0xDDDDDD, 1);
                toggleBg.lineStyle(3, 0xFFFFFF, 1);
                toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleCircle.fillStyle(0xFFFFFF, 1);
                toggleCircle.fillCircle(toggleX + toggleWidth - toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
                
                // Normal bet box when disabled
                betBox.clear();
                betBox.fillStyle(0x181818, 1);
                betBox.fillRoundedRect(15, 20, 90, 90, 16);
                betLabel.setColor('#888888');
                this.doubleFeaturePriceText.setColor('#888888');

                scene.gameData.doubleChanceEnabled = false;
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        };
        drawToggle();
        container.add(toggleCircle);

        // Toggle logic
        const toggleArea = scene.add.zone(toggleX, toggleY, toggleWidth, toggleHeight).setOrigin(0, 0) as ButtonZone;
        toggleArea.setInteractive().isButton = true;
        toggleArea.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            isEnabled = !isEnabled;
            scene.gameData.doubleChanceEnabled = isEnabled;
            drawToggle();
        });
        container.add(toggleArea);

        // Description (right, bottom)
        const desc = scene.add.text(width - 140, 105, 'Higher odds for\nFree Spins', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'center'
        }) as ButtonText;
        desc.setOrigin(0, 0.5);
        container.add(desc);

        container.setDepth(5);
        this.buttonContainer.add(container);
    }

    private createLogo(scene: GameScene): void {
        const x = this.width * 0.86;
        const y = this.height * 0.12;
        const container = scene.add.container(x, y) as ButtonContainer;

        const logo = scene.add.image(0, 0, 'logo') as ButtonImage;
        logo.setScale(0.2);
        container.add(logo);
        this.buttonContainer.add(container);
    }

    private createVolumeSettings(scene: GameScene): void {
        const x = this.width * 0.05;
        const y = this.height * 0.95;
        const container = scene.add.container(x, y) as ButtonContainer;

        const scaleFactor = 1.5; // x2 size
        const radius = 40 * scaleFactor;

        // Add volume icon
        const volumeIcon = scene.add.image(0, 0, 'volume') as ButtonImage;
        volumeIcon.setOrigin(0.5, 0.5);
        volumeIcon.setScale(0.6 * scaleFactor);
        container.add(volumeIcon);

        // Make container interactive
        container.setInteractive(
            new Geom.Rectangle(-radius, -radius, radius * 2, radius * 2),
            Geom.Rectangle.Contains
        ).isButton = true;

        // Create the settings panel (initially hidden off-screen)
        const panelWidth = 260 * scaleFactor;
        const panelHeight = 120 * scaleFactor;
        const panel = scene.add.container(-panelWidth, -panelHeight) as ButtonContainer; // Start off-screen
        panel.setDepth(100);
        panel.setAlpha(0); // Start fully transparent

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
            color: '#57FFA3',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        title.setOrigin(0.5, 0.5);
        panel.add(title);

        // Close button
        const closeBtn = scene.add.text(panelWidth - 18 * scaleFactor, 18 * scaleFactor, '×', {
            fontSize: `${22 * scaleFactor}px`,
            color: '#57FFA3',
            fontStyle: 'bold',
            fontFamily: 'Poppins',
            align: 'center'
        }) as ButtonText;
        closeBtn.setOrigin(0.5, 0.5);
        closeBtn.setInteractive().isButton = true;
        panel.add(closeBtn);

        // Music row
        const musicIcon = scene.add.image(24 * scaleFactor, 48 * scaleFactor, 'volume').setScale(0.35 * scaleFactor);
        panel.add(musicIcon);
        const musicLabel = scene.add.text(48 * scaleFactor, 40 * scaleFactor, 'Music', {
            fontSize: `${16 * scaleFactor}px`, color: '#fff', fontFamily: 'Poppins'
        }) as ButtonText;
        panel.add(musicLabel);
        const musicValue = scene.add.text(100 * scaleFactor, 40 * scaleFactor, '75%', {
            fontSize: `${16 * scaleFactor}px`, color: '#fff', fontFamily: 'Poppins'
        }) as ButtonText;

        panel.add(musicValue);


        // SFX row
        const sfxIcon = scene.add.image(24 * scaleFactor, 88 * scaleFactor, 'volume').setScale(0.35 * scaleFactor);
        panel.add(sfxIcon);
        const sfxLabel = scene.add.text(48 * scaleFactor, 80 * scaleFactor, 'SFX', {
            fontSize: `${16 * scaleFactor}px`, color: '#fff', fontFamily: 'Poppins'
        }) as ButtonText;
        panel.add(sfxLabel);
        const sfxValue = scene.add.text(100 * scaleFactor, 80 * scaleFactor, '75%', {
            fontSize: `${16 * scaleFactor}px`, color: '#fff', fontFamily: 'Poppins'
        }) as ButtonText;
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
        const updateSliders = (musicX: number | null = null, sfxX: number | null = null) => {
            const sliderStart = 150 * scaleFactor;
            const sliderWidth = 90 * scaleFactor;
            const sliderEnd = sliderStart + sliderWidth;

            const musicVol = musicX !== null ? 
                Math.max(0, Math.min(1, (musicX - sliderStart) / sliderWidth)) : 
                scene.audioManager.getMusicVolume();
            
            const sfxVol = sfxX !== null ? 
                Math.max(0, Math.min(1, (sfxX - sliderStart) / sliderWidth)) : 
                scene.audioManager.getSFXVolume();
            
            // Update music slider
            musicSlider.clear();
            musicSlider.fillStyle(0xffffff, 1);
            const musicSliderX = sliderStart + (musicVol * sliderWidth);
            musicSlider.fillCircle(musicSliderX, 51 * scaleFactor, 9 * scaleFactor);
            musicValue.setText(Math.round(musicVol * 100) + '%');
            
            // Update SFX slider
            sfxSlider.clear();
            sfxSlider.fillStyle(0xffffff, 1);
            const sfxSliderX = sliderStart + (sfxVol * sliderWidth);
            sfxSlider.fillCircle(sfxSliderX, 91 * scaleFactor, 9 * scaleFactor);
            sfxValue.setText(Math.round(sfxVol * 100) + '%');

            // Update volumes
            if (musicX !== null) scene.audioManager.setMusicVolume(musicVol);
            if (sfxX !== null) scene.audioManager.setSFXVolume(sfxVol);

            // Update interactive areas for sliders
            musicSlider.setInteractive(
                new Geom.Circle(musicSliderX, 51 * scaleFactor, 12 * scaleFactor),
                Geom.Circle.Contains
            );
            sfxSlider.setInteractive(
                new Geom.Circle(sfxSliderX, 91 * scaleFactor, 12 * scaleFactor),
                Geom.Circle.Contains
            );
        };

        // Initial slider setup
        updateSliders();
        
        musicIcon.setInteractive();
        musicIcon.on('pointerdown', () => {
            if(scene.audioManager.getMusicVolume() === 0) {
                scene.audioManager.setMusicVolume(1);
                musicIcon.setTint(0xFFFFFF);
            } else {
                scene.audioManager.setMusicVolume(0);
                musicIcon.setTint(0xFF0000);
            }
            updateSliders();
        });

        sfxIcon.setInteractive();
        sfxIcon.on('pointerdown', () => {
            if(scene.audioManager.getSFXVolume() === 0) {
                scene.audioManager.setSFXVolume(1);
                sfxIcon.setTint(0xFFFFFF);
            } else {
                scene.audioManager.setSFXVolume(0);
                sfxIcon.setTint(0xFF0000);
            }
            updateSliders();
        });

        // Make sliders draggable
        let isDraggingMusic = false;
        let isDraggingSFX = false;

        // Global pointer move and up handlers
        let isOpen = false;
        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!isOpen) return;

            const panelWorldMatrix = panel.getWorldTransformMatrix();
            const localX = pointer.x - panelWorldMatrix.tx;
            const sliderStart = 150 * scaleFactor;
            const sliderEnd = sliderStart + (90 * scaleFactor);

            if (isDraggingMusic) {
                const clampedX = Math.max(sliderStart, Math.min(localX, sliderEnd));
                updateSliders(clampedX, null);
            }
            if (isDraggingSFX) {
                const clampedX = Math.max(sliderStart, Math.min(localX, sliderEnd));
                updateSliders(null, clampedX);
            }
        });

        scene.input.on('pointerup', () => {
            isDraggingMusic = false;
            isDraggingSFX = false;
        });

        // Music slider bar click
        musicSliderBg.setInteractive(
            new Geom.Rectangle(150 * scaleFactor, 48 * scaleFactor - 10 * scaleFactor, 90 * scaleFactor, 20 * scaleFactor),
            Geom.Rectangle.Contains
        ).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const panelWorldMatrix = panel.getWorldTransformMatrix();
            const localX = pointer.x - panelWorldMatrix.tx;
            const sliderStart = 150 * scaleFactor;
            const sliderEnd = sliderStart + (90 * scaleFactor);
            const clampedX = Math.max(sliderStart, Math.min(localX, sliderEnd));
            updateSliders(clampedX, null);
            isDraggingMusic = true;
        });

        // SFX slider bar click
        sfxSliderBg.setInteractive(
            new Geom.Rectangle(150 * scaleFactor, 88 * scaleFactor - 10 * scaleFactor, 90 * scaleFactor, 20 * scaleFactor),
            Geom.Rectangle.Contains
        ).on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const panelWorldMatrix = panel.getWorldTransformMatrix();
            const localX = pointer.x - panelWorldMatrix.tx;
            const sliderStart = 150 * scaleFactor;
            const sliderEnd = sliderStart + (90 * scaleFactor);
            const clampedX = Math.max(sliderStart, Math.min(localX, sliderEnd));
            updateSliders(null, clampedX);
            isDraggingSFX = true;
        });

        // Add pointerdown handlers for sliders
        musicSlider.on('pointerdown', () => {
            isDraggingMusic = true;
        });

        sfxSlider.on('pointerdown', () => {
            isDraggingSFX = true;
        });

        // Show/hide panel logic
        const showPanel = () => {
            if (isOpen) return;
            isOpen = true;
            panel.setPosition(panelWidth/10, panelHeight * 4.5); // Position below the volume button
            panel.setAlpha(1);
        };

        const hidePanel = () => {
            if (!isOpen) return;
            isOpen = false;
            panel.setPosition(-panelWidth, -panelHeight); // Move off-screen
            panel.setAlpha(0);
        };

        // Initial panel state - make sure it's hidden
        hidePanel();

        // Toggle panel on volume icon click
        container.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            if (isOpen) {
                hidePanel();
            } else {
                showPanel();
            }
        });

        // Close panel on close button click
        closeBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            hidePanel();
        });

        this.buttonContainer.add(container);
        this.buttonContainer.add(panel);
    }

    private createSettingsButton(scene: GameScene): void {
        const x = this.width * 0.0825;
        const y = this.height * 0.95;
        const container = scene.add.container(x, y) as ButtonContainer;

        const settingsButton = scene.add.image(0, 0, 'settings') as ButtonImage;
        settingsButton.setScale(0.75);
        settingsButton.setInteractive().isButton = true;

        container.add(settingsButton);
        this.buttonContainer.add(container);

        settingsButton.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            // Toggle settings panel visibility
            // Implementation of settings panel will be added later
        });
    }

    update(): void {
        // No update needed since Autoplay handles its own state
    }

    public startIdleAnimation(scene: GameScene): void {
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
    }

    public stopIdleAnimation(): void {
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
    }

    private closeBuyFeaturePopup(): void {
        if (this.buyFeaturePopup) {
            this.buyFeaturePopup.setVisible(false);
        }
    }
} 