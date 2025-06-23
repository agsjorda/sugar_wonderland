import { Scene } from 'phaser';

export class LandingPage extends Scene {
    private spinButton!: Phaser.GameObjects.Image;
    private notificationText!: Phaser.GameObjects.Text;;
    private isRotating: boolean = false;
    protected pressed: boolean = false;
    private isTransitioning: boolean = false;
    constructor() {
        super('LandingPage');
    }

    preload(): void {
        this.load.image('logostart', 'assets/Logo/Logo.png');
        this.load.image('background', 'assets/background/preloader.png');
        this.load.image('spinButton', 'assets/Controllers/Spin.png');
    }

    create(): void {
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'background')
        .setOrigin(0.5);
        
        this.add.image(600, 150, 'logostart')
        .setScale(0.4);

        this.add.text(this.cameras.main.width / 4, this.cameras.main.height * 0.8, 'Win up to 21,000x', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Poppins',
            stroke: '#379557',
            strokeThickness: 8,
            shadow: {
                offsetX: 2,
                offsetY: 8,
                color: '#000000',
                blur: 0,
                fill: true
            }
        }).setOrigin(0.5);

        this.notificationText = this.add.text(this.cameras.main.width * 0.72, this.cameras.main.height * 0.6, 'Press Play To Continue', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Poppins',
            stroke: '#379557',
        }).setAlpha(0);

        this.spinButton = this.add.image(this.cameras.main.width * 0.8, this.cameras.main.height * 0.425, 'spinButton');
        this.spinButton.setAlpha(0.5);

        this.startIdleRotation();

        this.spinButton.setInteractive({useHandCursor: true});
        this.spinButton.on('pointerdown', () => {
            if(this.spinButton.alpha == 1) {
                //@ts-ignore
                this.scene.get('LoadingPage').hideLoadingBar();
                
                if (this.isTransitioning) return;
                this.isTransitioning = true;

                // Fade out the current scene
                this.cameras.main.fadeOut(1000, 0, 0, 0);

                // When fade out is complete, start the Game scene
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('Game');
                    this.scene.remove('LoadingPage');
                });
            }
        });

        this.scene.launch('LoadingPage');
    }

    
    private startIdleRotation(): void {
        if (!this.isRotating) {
            this.isRotating = true;
            this.tweens.add({
                targets: this.spinButton,
                angle: 360,
                duration: 12000,
                ease: 'Linear',
                repeat: -1
            });
        }
    }

    public doneLoading(): void {
        this.spinButton.setAlpha(1);
        this.notificationText.setAlpha(1);
    }
} 