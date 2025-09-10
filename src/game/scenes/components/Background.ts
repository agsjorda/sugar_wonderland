import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import chalk from 'chalk';
import { getFontFamily } from '../../utils/fonts';

export class Background {
    private initialLayerX: number = 0;
    private initialLayerY: number = 0;
    private isMobile: boolean = false;
    private paused: boolean = false;

    private main_background: GameObjects.Image;
    private bonus_background: GameObjects.Image;

    private main_cloud: GameObjects.Image;
    private bonus_cloud: GameObjects.Image;

    private main_foreground: GameObjects.Image;
    private bonus_foreground: GameObjects.Image;
    
    private main_lantern1: GameObjects.Image;
    private main_lantern2: GameObjects.Image;
    private main_lantern3: GameObjects.Image;
    private bonus_lantern1: GameObjects.Image;
    private bonus_lantern2: GameObjects.Image;
    private bonus_lantern3: GameObjects.Image;

    private lanternTweens: Phaser.Tweens.Tween[] = [];

    // Fullscreen button and handlers
    private fsButton: Phaser.GameObjects.Image | null = null;
    private onEnterFs?: () => void;
    private onLeaveFs?: () => void;

    private floatingSpeedX: number = 0.001;
    private floatingSpeedY: number = 0.0012;

    private floatingAmplitudeX: number = 200;
    private floatingAmplitudeY: number = 250;

    private cloudParallaxSpeed: number = 0.1;
    private foregroundParallaxSpeed: number = 0.0;

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('device') == 'mobile'){
            return true;
        }else if(urlParams.get('device') == 'desktop'){
            return false;
        }
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    preload(scene: Scene): void {
        this.isMobile = this.isMobileDevice();

        if(this.isMobile){
            const prefix = 'assets/Mobile';
            scene.load.image('mobile_main_background', `${prefix}/Main_Background.png`);
            scene.load.image('mobile_bonus_background', `${prefix}/Bonus_Background.png`);
        }
        else{
            const prefix = 'assets/background';
            scene.load.image('bonus_background', `${prefix}/Bonus_Background.png`);
            scene.load.image('bonus_cloud', `${prefix}/Bonus_Cloud.png`);
            scene.load.image('bonus_foreground', `${prefix}/Bonus_Foreground.png`);
            scene.load.image('bonus_lantern', `${prefix}/Bonus_Lantern.png`);

            scene.load.image('main_background', `${prefix}/Main_Background.png`);
            scene.load.image('main_cloud', `${prefix}/Main_Cloud.png`);
            scene.load.image('main_foreground', `${prefix}/Main_Foreground.png`);
            scene.load.image('main_lantern', `${prefix}/Main_Lantern.png`);
        }

        // Fullscreen toggle icons
        scene.load.image('fs_max', 'assets/Controllers/Maximize.png');
        scene.load.image('fs_min', 'assets/Controllers/Minimize.png');
    }

    create(scene: Scene): void {
        this.createBackground(scene);
        
        // Only create lanterns for desktop
        if (!this.isMobile) {
            this.createLanterns(scene);
        }

		scene.gameData.isBonusRound = false;
		console.log(chalk.green.bold(`[BG] create: isBonusRound=${scene.gameData.isBonusRound}`));
        this.toggleBackground(scene);

        // Pause/resume background animations when win overlay is shown/hidden
        (scene as any).events?.on && (scene as any).events.on('shutdown', () => {
            this.lanternTweens = [];
        });

        // Use global Events emitter to detect overlay state
        Events.emitter.on(Events.WIN_OVERLAY_SHOW, () => {
            this.paused = true;
            this.pauseLanternTweens(scene);
        });
        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            this.paused = false;
            this.resumeLanternTweens(scene);
        });

        // Pause background when session timeout occurs
        Events.emitter.on(Events.SESSION_TIMEOUT, () => {
            this.paused = true;
            this.pauseLanternTweens(scene);
        });

        // Version label bottom-right
        const cfgVersion = (typeof window !== 'undefined' && (window as any).APP_CONFIG) ? (window as any).APP_CONFIG.version : undefined;
        let versionText = cfgVersion ?? (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');
        if (versionText && !versionText.startsWith('v')) {
            versionText = `v${versionText}`;
        }
        const width = scene.scale.width;
        const height = scene.scale.height;
        const isMobileish = width <= 500;
        const versionLabel = scene.add.text(
            width - 10,
            height - 10,
            versionText,
            {
                fontSize: isMobileish ? '12px' : '14px',
                color: '#ffffff',
                fontFamily: getFontFamily(),
                stroke: '#000000',
                strokeThickness: 2,
            }
        );
        versionLabel.setOrigin(1, 1).setAlpha(0.2);
        // Ensure above background/foreground but below UI; backgrounds use depths 0-2
        versionLabel.setDepth(3);

        // Add fullscreen toggle button above backgrounds
        this.createFullscreenToggle(scene);
    }

	toggleBackground(_scene: Scene): void {
        let main_status = 0;
        let bonus_status = 0;

        if(_scene.gameData.isBonusRound){
            main_status = 0;
            bonus_status = 1;
            console.log(chalk.redBright.bold(`[BG] toggleBackground called. isBonusRound=${_scene.gameData.isBonusRound}`));
        } else {
            main_status = 1;
            bonus_status = 0;
            console.log(chalk.red.bold(`[BG] toggleBackground called. isBonusRound=${_scene.gameData.isBonusRound}`));
        }

		this.main_background.alpha = main_status;
        this.bonus_background.alpha = bonus_status;

        // Only toggle other elements for desktop
        if (!this.isMobile) {
            this.main_cloud.alpha = main_status;
            this.main_foreground.alpha = main_status;
            this.main_lantern1.alpha = main_status;
            this.main_lantern2.alpha = main_status;
            this.main_lantern3.alpha = main_status;

            this.bonus_cloud.alpha = bonus_status;
            this.bonus_foreground.alpha = bonus_status;
            this.bonus_lantern1.alpha = bonus_status;
            this.bonus_lantern2.alpha = bonus_status;
            this.bonus_lantern3.alpha = bonus_status;
        }
    }

    private createFullscreenToggle(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;
        const padding = this.isMobile ? 10 : 12;

        // Create button
        const key = scene.scale.isFullscreen ? 'fs_min' : 'fs_max';
        const btn = scene.add.image(width - padding, padding, key);
        btn.setOrigin(1, 0);
        const size = this.isMobile ? 28 : 32;
        btn.setDisplaySize(size, size);
        btn.setInteractive({ useHandCursor: true });
        btn.setDepth(4); // Above backgrounds and version label
        this.fsButton = btn;

        // Toggle on click
        btn.on('pointerup', () => {
            if (scene.scale.isFullscreen) {
                scene.scale.stopFullscreen();
            } else {
                scene.scale.startFullscreen();
            }
        });

        // Update icon on fs change
        const updateIcon = () => {
            if (!this.fsButton) return;
            this.fsButton.setTexture(scene.scale.isFullscreen ? 'fs_min' : 'fs_max');
        };
        this.onEnterFs = updateIcon;
        this.onLeaveFs = updateIcon;
        scene.scale.on('enterfullscreen', this.onEnterFs);
        scene.scale.on('leavefullscreen', this.onLeaveFs);

        // Cleanup on shutdown
        (scene as any).events?.once && (scene as any).events.once('shutdown', () => {
            if (this.onEnterFs) scene.scale.off('enterfullscreen', this.onEnterFs);
            if (this.onLeaveFs) scene.scale.off('leavefullscreen', this.onLeaveFs);
            this.onEnterFs = undefined;
            this.onLeaveFs = undefined;
            if (this.fsButton) {
                this.fsButton.destroy();
                this.fsButton = null;
            }
        });
    }

    private createBackground(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        const centerX = width * 0.5;
        const centerY = height * 0.5;
        this.initialLayerX = centerX;
        this.initialLayerY = centerY;

        if (this.isMobile) {
            // Mobile: Only create main and bonus backgrounds
            this.main_background = scene.add.image(centerX, centerY, 'mobile_main_background');
            this.main_background.setScale(1);
            this.main_background.setOrigin(0.5, 0.5);
            this.bonus_background = scene.add.image(centerX, centerY, 'mobile_bonus_background');
            this.bonus_background.setScale(1);
            this.bonus_background.setOrigin(0.5, 0.5);
            
            // Set depth for mobile
            this.main_background.setDepth(0);
            this.bonus_background.setDepth(0);
            
            // Initialize other properties to avoid errors
            this.main_cloud = null as any;
            this.bonus_cloud = null as any;
            this.main_lantern1 = null as any;
            this.main_lantern2 = null as any;
            this.main_lantern3 = null as any;
            this.main_foreground = null as any;
            this.bonus_foreground = null as any;
            this.bonus_lantern1 = null as any;
            this.bonus_lantern2 = null as any;
            this.bonus_lantern3 = null as any;
        } else {
            // Desktop: Full experience with all elements
            this.main_background = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_background');
            this.main_cloud = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_cloud');
            this.main_foreground = scene.add.image(this.initialLayerX, height * 0.4, 'main_foreground');

            this.bonus_background = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_background');
            this.bonus_cloud = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_cloud');
            this.bonus_foreground = scene.add.image(this.initialLayerX, height * 0.4, 'bonus_foreground');

            const scaleFactor = 0.525;
            this.main_background.setScale(scaleFactor);
            this.main_cloud.setScale(scaleFactor * 1.25);
            this.main_foreground.setScale(scaleFactor);

            this.main_background.setDepth(0);
            this.main_cloud.setDepth(1);
            this.main_foreground.setDepth(2);
            

            this.bonus_background.setScale(scaleFactor);
            this.bonus_cloud.setScale(scaleFactor * 1.25);
            this.bonus_foreground.setScale(scaleFactor);

            this.bonus_background.setDepth(0);
            this.bonus_cloud.setDepth(1);
            this.bonus_foreground.setDepth(2);
        }
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        // Only update animations for desktop
        if (this.isMobile) {
            return;
        }

        // Pause floating/parallax while overlays are active
        if (this.paused || (_scene as any).slotMachine?.activeWinOverlay) {
            return;
        }

        const floatingOffsetX = Math.sin(_time * this.floatingSpeedX) * this.floatingAmplitudeX;
        const floatingOffsetY = Math.sin(_time * this.floatingSpeedY) * this.floatingAmplitudeY;

        if (this.main_cloud) {
            this.main_cloud.x = this.initialLayerX + floatingOffsetX * this.cloudParallaxSpeed;
            this.main_cloud.y = this.initialLayerY + floatingOffsetY * this.cloudParallaxSpeed;
        }

        if (this.bonus_cloud) {
            this.bonus_cloud.x = this.initialLayerX + floatingOffsetX * this.cloudParallaxSpeed;
            this.bonus_cloud.y = this.initialLayerY + floatingOffsetY * this.cloudParallaxSpeed;
        }

        if (this.main_foreground) {
            this.main_foreground.x = this.initialLayerX + floatingOffsetX * this.foregroundParallaxSpeed;
            this.main_foreground.y = this.initialLayerY + floatingOffsetY * this.foregroundParallaxSpeed;
        }

        if (this.bonus_foreground) {
            this.bonus_foreground.x = this.initialLayerX + floatingOffsetX * this.foregroundParallaxSpeed;
            this.bonus_foreground.y = this.initialLayerY + floatingOffsetY * this.foregroundParallaxSpeed;
        }
    }

	createLanterns(scene: Scene) {
        // Only create lanterns for desktop
        if (this.isMobile) {
            return;
        }

		const width = scene.scale.width;
		const height = scene.scale.height;
        const depth = 2;
        
        // Main Lanterns
		this.main_lantern1 = scene.add.image(width * 0.1, height * 0.25, 'main_lantern');
		this.main_lantern1.setScale(0.325);
		this.main_lantern1.setDepth(depth);
		this.main_lantern1.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.main_lantern1,
			angle: { from: 0, to: 20 },
			duration: 1000,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
        });
        this.captureTweensForTarget(scene, this.main_lantern1);

		this.main_lantern2 = scene.add.image(width * 0.1825, height * 0.19, 'main_lantern');
		this.main_lantern2.setScale(0.45);
		this.main_lantern2.setDepth(depth);
		this.main_lantern2.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.main_lantern2,
			angle: { from: 0, to: 20 },
			duration: 1200,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
        this.captureTweensForTarget(scene, this.main_lantern2);

		this.main_lantern3 = scene.add.image(width * 0.94, height * 0.15, 'main_lantern');
		this.main_lantern3.setScale(0.325);
		this.main_lantern3.setDepth(depth);
		this.main_lantern3.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.main_lantern3,
			angle: { from: 0, to: 20 },
			duration: 1100,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		}); 
        this.captureTweensForTarget(scene, this.main_lantern3);


		// Bonus Lanterns
		this.bonus_lantern1 = scene.add.image(width * 0.1, height * 0.2, 'bonus_lantern');
		this.bonus_lantern1.setScale(0.325);
		this.bonus_lantern1.setDepth(depth);
		this.bonus_lantern1.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.bonus_lantern1,
			angle: { from: 0, to: 20 },
			duration: 1000,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
        this.captureTweensForTarget(scene, this.bonus_lantern1);

		this.bonus_lantern2 = scene.add.image(width * 0.1825, height * 0.14, 'bonus_lantern');
		this.bonus_lantern2.setScale(0.45);
		this.bonus_lantern2.setDepth(depth);
		this.bonus_lantern2.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.bonus_lantern2,
			angle: { from: 0, to: 20 },
			duration: 1200,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
        this.captureTweensForTarget(scene, this.bonus_lantern2);

		this.bonus_lantern3 = scene.add.image(width * 0.94, height * 0.10, 'bonus_lantern');
		this.bonus_lantern3.setScale(0.325);
		this.bonus_lantern3.setDepth(depth);
		this.bonus_lantern3.setOrigin(0.5, 0);

		scene.tweens.add({
			targets: this.bonus_lantern3,
			angle: { from: 0, to: 20 },
			duration: 1100,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1
		});
        this.captureTweensForTarget(scene, this.bonus_lantern3);
	}

    private captureTweensForTarget(scene: Scene, target: Phaser.GameObjects.GameObject): void {
        const tweens = (scene.tweens as any).getTweensOf ? (scene.tweens as any).getTweensOf(target) : [];
        if (Array.isArray(tweens)) {
            this.lanternTweens.push(...tweens);
        }
    }

    private pauseLanternTweens(scene: Scene): void {
        if (!scene || !scene.tweens) return;
        this.lanternTweens.forEach(t => t.pause());
    }

    private resumeLanternTweens(scene: Scene): void {
        if (!scene || !scene.tweens) return;
        this.lanternTweens.forEach(t => t.resume());
    }
} 