import { Scene, GameObjects } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

interface FieryParticle {
    graphics: GameObjects.Graphics;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: number;
    alpha: number;
    lifetime: number;
    age: number;
    screenWidth: number;
    screenHeight: number;
}

export class Background {
    private main_background: GameObjects.Image;
    private rifle: GameObjects.Image;

    private bonus_background: GameObjects.Image;
    private arch: GameObjects.Image;

    private dove: SpineGameObject;
    private dove2: SpineGameObject;
    private jetfighter_02: SpineGameObject;

    private particles: FieryParticle[] = [];
    private readonly PARTICLE_COUNT = 150; // Random between 50-100
    private readonly SCREEN_MARGIN = 100; // Margin for particles to go off-screen
    
    // Fullscreen button and handlers
    private fsButton: Phaser.GameObjects.Image | null = null;
    private onEnterFs?: () => void;
    private onLeaveFs?: () => void;
  
    private onDomFsChange?: () => void;
    private onResize?: () => void;
    // Wind system
    private windDirectionX: number = 0; // -1 for left, 0 for calm, 1 for right
    private windDirectionY: number = 0; // -1 for up, 0 for calm, 1 for down
    private windStrength: number = 0; // 0 to 1
    private windChangeTimer: number = 0;
    private readonly WIND_CHANGE_INTERVAL = 3000; // 3 seconds between wind changes
    private readonly WIND_STRENGTH_MAX = 0.8;

    preload(scene: Scene): void {
        const prefix = 'assets/Mobile';
        scene.load.image('mobile_main_background', `${prefix}/Main_Background.png`);
        scene.load.image('mobile_bonus_background', `${prefix}/Bonus_Background.png`);
        scene.load.image('rifle', `${prefix}/rifle.png`);
        scene.load.image('arch', `${prefix}/arch.png`);

        scene.load.spineAtlas(`dove`,`assets/background/dove.atlas`);
        scene.load.spineJson(`dove`,`assets/background/dove.json`); // animation

        scene.load.spineAtlas(`jetfighter_02`,`assets/background/jetfighter_02.atlas`);
        scene.load.spineJson(`jetfighter_02`,`assets/background/jetfighter_02.json`); // jetfighter_wf_win
    }

    create(scene: Scene): void {
        this.createBackground(scene);
        this.createParticleSystem(scene);
        
        scene.gameData.isBonusRound = false;
        this.toggleBackground(scene);
        // Add fullscreen toggle button above backgrounds
        this.createFullscreenToggle(scene);
    }

    private createFullscreenToggle(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;
        const padding = 10;

        // Create button
        const key = scene.scale.isFullscreen ? 'fs_min' : 'fs_max';
        const btn = scene.add.image(width - padding, padding, key);
        btn.setOrigin(1, 0);
        const size = 28;
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

        // Also listen to DOM fullscreen changes for desktop browsers
        this.onDomFsChange = updateIcon;
        document.addEventListener('fullscreenchange', this.onDomFsChange);
        // @ts-ignore - Safari prefix
        document.addEventListener('webkitfullscreenchange', this.onDomFsChange);

        // Reposition on resize (enter/exit fullscreen changes size)
        const reposition = () => {
            const w = scene.scale.width;
            const p = padding;
            if (this.fsButton) this.fsButton.setPosition(w - p, p);
        };
        this.onResize = reposition;
        scene.scale.on('resize', this.onResize);

        // Cleanup on shutdown
        (scene as any).events?.once && (scene as any).events.once('shutdown', () => {
            if (this.onEnterFs) scene.scale.off('enterfullscreen', this.onEnterFs);
            if (this.onLeaveFs) scene.scale.off('leavefullscreen', this.onLeaveFs);
          
            if (this.onResize) scene.scale.off('resize', this.onResize);
            if (this.onDomFsChange) {
                document.removeEventListener('fullscreenchange', this.onDomFsChange);
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
        });
    }


    toggleBackground(_scene: Scene): void {
        let main_status = 0;
        let bonus_status = 0;

        if(_scene.gameData.isBonusRound){
            main_status = 0;
            bonus_status = 1;
        } else {
            main_status = 1;
            bonus_status = 0;
        }

        this.main_background.alpha = main_status;
        this.rifle.alpha = main_status;

        this.jetfighter_02.setVisible(main_status ? true : false);

        this.bonus_background.alpha = bonus_status;
        this.arch.alpha = bonus_status;

        this.dove.setVisible(bonus_status ? true : false);
        this.dove2.setVisible(bonus_status ? true : false);

    }

    private createBackground(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        const centerX = width * 0.5;
        const centerY = height * 0.5;

        /// main

        this.main_background = scene.add.image(centerX, centerY, 'mobile_main_background');
        this.main_background.setDisplaySize(width, height);
        this.main_background.setOrigin(0.5, 0.5);

        this.rifle = scene.add.image(centerX, scene.scale.height, 'rifle');
        this.rifle.setOrigin(0.5, 1);

        this.jetfighter_02 = scene.add.spine(centerX, centerY, 'jetfighter_02', 'jetfighter_02');     
        this.jetfighter_02.animationState.setAnimation(0, 'jetfighter_wf_win', true);
        this.jetfighter_02.animationState.timeScale = 0.5;
        /// bonus
    
        this.bonus_background = scene.add.image(centerX, centerY, 'mobile_bonus_background');
        this.bonus_background.setDisplaySize(width, height);
        this.bonus_background.setOrigin(0.5, 0.5);

        this.dove = scene.add.spine(centerX, centerY, 'dove', 'dove');
        this.dove.setScale(0.25);
        this.dove.setPosition(scene.scale.width * 0.2, scene.scale.height * 0.10);
        this.dove.animationState.setAnimation(0, 'animation', true);
        this.dove.animationState.timeScale = 0.75

        this.dove2 = scene.add.spine(centerX, centerY, 'dove', 'dove');
        this.dove2.setScale(-0.25, 0.25);
        this.dove2.setPosition(scene.scale.width * 0.8, scene.scale.height * 0.10);
        this.dove2.animationState.setAnimation(0, 'animation', true);
        this.dove2.animationState.timeScale = 0.75
        
        this.arch = scene.add.image(centerX, scene.scale.height, 'arch');
        const archRatio = scene.scale.width / this.arch.width;1
        this.arch.setScale(archRatio);
        this.arch.setOrigin(0.5, 1);
    }

    private createParticleSystem(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        // Create fiery particles
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            this.createFieryParticle(scene, width, height);
        }
    }

    private createFieryParticle(scene: Scene, screenWidth: number, screenHeight: number): void {
        const graphics = scene.add.graphics();
        
        // Random position (including off-screen areas)
        const x = Math.random() * (screenWidth + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
        const y = Math.random() * (screenHeight + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
        
        // Random size (1.5-3.5 pixels)
        const size = Math.random() * 2.5 + 1;
        
        // Random velocity
        const vx = (Math.random() - 0.5) * 2; // -1 to 1
        const vy = (Math.random() - 0.5) * 2; // -1 to 1
        
        // Random fiery color
        const colors = [
            0xff4400, // Bright orange-red
            0xff6600, // Orange
            0xff8800, // Light orange
            0xffaa00, // Yellow-orange
            //0xff2200, // Dark red
            //0xff0000  // Pure red
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Random alpha
        const alpha = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
        
        // Random lifetime
        const lifetime = Math.random() * 10000 + 5000; // 5-15 seconds
        
        // Create particle data
        const particle: FieryParticle = {
            graphics,
            x,
            y,
            vx,
            vy,
            size,
            color,
            alpha,
            lifetime,
            age: 0,
            screenWidth,
            screenHeight
        };
        
        this.particles.push(particle);
        this.drawParticle(scene, particle);
    }

    private drawParticle(scene: Scene, particle: FieryParticle): void {
        const { graphics, x, y, size, color, alpha } = particle;
        
        graphics.clear();
        
        // Create cylindrical shapes with varying aspect ratios
        const width = size * (Math.random() * 0.8 + 0.6); // 0.6x to 1.4x of size
        const height = size * (Math.random() * 1.2 + 0.8); // 0.8x to 2.0x of size
        
        // Create a multi-layered cylindrical glow effect
        // Outer glow (largest, most transparent)
        graphics.fillStyle(color, alpha * 0.1);
        graphics.fillEllipse(x, y, width * 3, height * 3);
        
        // Middle glow (medium size, semi-transparent)
        graphics.fillStyle(color, alpha * 0.2);
        graphics.fillEllipse(x, y, width * 2.2, height * 2.2);
        
        // Inner glow (smaller, more opaque)
        graphics.fillStyle(color, alpha * 0.4);
        graphics.fillEllipse(x, y, width * 1.5, height * 1.5);
        
        // Core glow (bright center)
        graphics.fillStyle(color, alpha * 0.7);
        graphics.fillEllipse(x, y, width * 0.8, height * 0.8);
        
        // Bright center (smallest, most opaque)
        graphics.fillStyle(color, alpha);
        graphics.fillEllipse(x, y, width * 0.4, height * 0.4);
        
        // Add a subtle white/yellow center for extra brightness
        const brightColor = 0xffffaa;
        graphics.fillStyle(brightColor, alpha * 0.3);
        graphics.fillEllipse(x, y, width * 0.2, height * 0.2);
        
        graphics.setDepth(0);
        graphics.setVisible(!scene.gameData.isBonusRound);
    }

    update(scene: Scene, _time: number, delta: number): void {
        this.updateWind(delta);
        this.updateParticles(scene, delta);
    }

    private updateWind(delta: number): void {
        this.windChangeTimer += delta;
        
        if (this.windChangeTimer >= this.WIND_CHANGE_INTERVAL) {
            this.windChangeTimer = 0;
            
            // Random wind direction change
            const windChance = Math.random();
            // Use a formula to control wind direction and strength based on windChance
            // 0.00-0.15: left, 0.15-0.30: right, 0.30-0.45: upper left, 0.45-0.60: upper right, else: calm

            let directionX = 0;
            let directionY = 0;
            let strength = 0;

            if (windChance < 0.60) {
                // Map windChance to 4 main directions in 0.15 intervals
                // 0: left, 1: right, 2: upper left, 3: upper right
                const dirIndex = Math.floor(windChance / 0.15);
                // Direction lookup: [left, right, upper left, upper right]
                const directions = [
                    { x: -1, y: 0 },   // left
                    { x: 1,  y: 0 },   // right
                    { x: -1, y: -1 },  // upper left
                    { x: 1,  y: -1 }   // upper right
                ];
                directionX = directions[dirIndex].x;
                directionY = directions[dirIndex].y;
                strength = Math.random() * this.WIND_STRENGTH_MAX + 0.2;
            } else {
                // Calm wind
                directionX = 0;
                directionY = 0;
                strength = Math.random() * 0.3;
            }

            this.windDirectionX = directionX;
            this.windDirectionY = directionY;
            this.windStrength = strength;
        }
    }

    private updateParticles(scene: Scene, delta: number): void {
        this.particles.forEach((particle, index) => {
            // Update age
            particle.age += delta;
            
            // Remove old particles
            if (particle.age > particle.lifetime) {
                particle.graphics.destroy();
                this.particles.splice(index, 1);
                return;
            }
            
            // Apply wind effect to both horizontal and vertical movement
            const windEffectX = this.windDirectionX * this.windStrength * 0.5;
            const windEffectY = this.windDirectionY * this.windStrength * 0.3; // Slightly less vertical movement
            particle.vx += windEffectX;
            particle.vy += windEffectY;
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Add slight random movement for more natural feel (reduced during strong wind)
            const randomFactor = this.windStrength > 0.5 ? 0.05 : 0.1;
            particle.vx += (Math.random() - 0.5) * randomFactor;
            particle.vy += (Math.random() - 0.5) * randomFactor;
            
            // Clamp velocity to prevent too fast movement
            particle.vx = Math.max(-3, Math.min(3, particle.vx));
            particle.vy = Math.max(-2, Math.min(2, particle.vy));
            
            // Wrap around screen edges
            if (particle.x < -this.SCREEN_MARGIN) {
                particle.x = particle.screenWidth + this.SCREEN_MARGIN;
            } else if (particle.x > particle.screenWidth + this.SCREEN_MARGIN) {
                particle.x = -this.SCREEN_MARGIN;
            }
            
            if (particle.y < -this.SCREEN_MARGIN) {
                particle.y = particle.screenHeight + this.SCREEN_MARGIN;
            } else if (particle.y > particle.screenHeight + this.SCREEN_MARGIN) {
                particle.y = -this.SCREEN_MARGIN;
            }
            
            // Fade out as particle ages
            const ageRatio = particle.age / particle.lifetime;
            particle.alpha = Math.max(0.1, 1 - ageRatio * 0.5);
            
            // Update visual
            this.drawParticle(scene, particle);
        });
        
        // Maintain particle count by creating new ones if needed
        if (this.particles.length < this.PARTICLE_COUNT) {
            const scene = this.main_background.scene;
            this.createFieryParticle(scene, scene.scale.width, scene.scale.height);
        }
    }
} 