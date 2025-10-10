import { Scene } from 'phaser';
import { GameAPI } from './backend/GameAPI';
import { getFontFamily, logFontStatus } from '../utils/fonts';

export class LandingPage extends Scene {
    private spinButton!: Phaser.GameObjects.Image;
    private notificationText!: Phaser.GameObjects.Text;;
    private isRotating: boolean = false;
    protected pressed: boolean = false;
    private isTransitioning: boolean = false;

    private fsButton: Phaser.GameObjects.Image | null = null;
    private onEnterFs?: () => void;
    private onLeaveFs?: () => void;
    
    private onDomFsChange?: () => void;
    private onResize?: () => void;

    constructor() {
        super('LandingPage');
    }

    preload(): void {
        this.load.image('logostart', 'assets/Logo/Logo.png');
        this.load.image('background_mobile', 'assets/background/preloader_mobile.png');
        this.load.image('spinButton', 'assets/Controllers/Spin.png');
        this.load.image('gameTemplateBackground', 'assets/background/Main_Background.png')
        // Fullscreen toggle icons
        this.load.image('fs_max', 'assets/Controllers/Maximize.png');
        this.load.image('fs_min', 'assets/Controllers/Minimize.png');
    }

    create(): void {
        // console.log(this.cameras.main.width, this.cameras.main.height);
        
        // Log font status for debugging
        logFontStatus();
        
        // Choose background based on device
        const backgroundKey = 'background_mobile' 
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, backgroundKey)
        .setOrigin(0.5).setDisplaySize(428, 926);
        
        // Fullscreen toggle button (above background)
        const padding = 10;
        const size = 28;
        const fsKey = this.scale.isFullscreen ? 'fs_min' : 'fs_max';
        const btn = this.add.image(this.cameras.main.width - padding, padding, fsKey);
        btn.setOrigin(1, 0);
        btn.setDisplaySize(size, size);
        btn.setDepth(1000);
        btn.setInteractive({ useHandCursor: true });
        this.fsButton = btn;
        btn.on('pointerup', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });
        const updateIcon = () => {
            const btn = this.fsButton;
            if (!btn || !(btn as any).scene || !(btn as any).scene.sys) return;
            const key = this.scale.isFullscreen ? 'fs_min' : 'fs_max';
            // Ensure texture exists before swapping
            if (this.textures && this.textures.exists(key)) {
                btn.setTexture(key);
            }
        };
        this.onEnterFs = updateIcon;
        this.onLeaveFs = updateIcon;
        this.scale.on('enterfullscreen', this.onEnterFs);
        this.scale.on('leavefullscreen', this.onLeaveFs);

        // Also listen to DOM fullscreen changes for desktop
        this.onDomFsChange = updateIcon;
        document.addEventListener('fullscreenchange', this.onDomFsChange);
        // @ts-ignore - Safari prefix
        document.addEventListener('webkitfullscreenchange', this.onDomFsChange);

        // Reposition on resize
        const reposition = () => {
            const p = padding;
            if (this.fsButton) this.fsButton.setPosition(this.cameras.main.width - p, p);
        };
        this.onResize = reposition;
        this.scale.on('resize', this.onResize);
        
        // Cleanup on scene shutdown/remove
        this.events.once('shutdown', () => this.cleanupFullscreenHandlers());
        this.events.once('destroy', () => this.cleanupFullscreenHandlers());
        
        // Adjust logo position and scale based on device
        const logoScale = 0.25
        const logoX =  this.cameras.main.width / 2 
        const logoY =  this.cameras.main.height * 0.2
        
        this.add.image(logoX, logoY, 'logostart')
        .setScale(logoScale).setVisible(false);

        // Adjust win text position and size
        const winTextX = this.cameras.main.width / 2 
        const winTextY = this.cameras.main.height * 0.7 
        const winTextSize = '32px' 
        
        this.add.text(winTextX, winTextY, 'Win up to 21,000x', {
            fontSize: winTextSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: getFontFamily(),
            stroke: '#379557',
            strokeThickness: 4,
            shadow: {
                offsetX: 1,
                offsetY: 4,
                color: '#000000',
                blur: 0,
                fill: true
            }
        }).setOrigin(0.5);

        // Adjust notification text position and size
        const notifX = this.cameras.main.width *  0.25
        const notifY = this.cameras.main.height * 0.88
        const notifSize = '18px'
        
        this.notificationText = this.add.text(notifX, notifY, 'Press Play To Continue', {
            fontSize: notifSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: getFontFamily(),
            stroke: '#379557',
        }).setAlpha(0);

        // Adjust spin button position and scale
        const buttonX = this.cameras.main.width / 2
        const buttonY = this.cameras.main.height * 0.8
        const buttonScale = 0.4
        
        this.spinButton = this.add.image(buttonX, buttonY, 'spinButton').setScale(buttonScale);
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
    
    private cleanupFullscreenHandlers(): void {
        if (this.onEnterFs) this.scale.off('enterfullscreen', this.onEnterFs);
        if (this.onLeaveFs) this.scale.off('leavefullscreen', this.onLeaveFs);
        if (this.onResize) this.scale.off('resize', this.onResize);
        if (this.onDomFsChange) {
            document.removeEventListener('fullscreenchange', this.onDomFsChange as any);
            // @ts-ignore
            document.removeEventListener('webkitfullscreenchange', this.onDomFsChange);
        }
        this.onEnterFs = undefined;
        this.onLeaveFs = undefined;
        this.onResize = undefined;
        this.onDomFsChange = undefined;
        if (this.fsButton) {
            this.fsButton.destroy();
            this.fsButton = null;
        }
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
        
           // Initialize and run the game launcher with retries
           const gameAPI = new GameAPI(this.gameData);
           const maxRetries = 50;
           let retryCount = 0;
           
           const tryLaunchGame = async () => {
               try {
                   await gameAPI.gameLauncher();
                   this.spinButton.setAlpha(1);
               } catch (error) {
                   console.error(`Failed to launch game (attempt ${retryCount + 1}):`, error);
                   if (retryCount < maxRetries) {
                       retryCount++;
                       await tryLaunchGame();
                   } else {
                       console.error('Max retries reached, game launch failed');
                       this.spinButton.setAlpha(0.75);
                   }
               }
           };

           tryLaunchGame();

           // Fade out the current scene
           this.cameras.main.fadeOut(1000, 0, 0, 0);

           // When fade out is complete, start the Game scene
           this.cameras.main.once('camerafadeoutcomplete', () => {
               this.scene.start('Game');
               this.scene.remove('LoadingPage');
           });
    }
}                                                                                           