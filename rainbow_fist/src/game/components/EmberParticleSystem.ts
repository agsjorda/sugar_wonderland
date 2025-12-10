import { GameObjects, Scene } from "phaser";
import { GameStateManager } from "../../managers/GameStateManager";


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

export class EmberParticleSystem {
    private scene: Scene;
    private gameStateManager: GameStateManager;
    private parentContainer?: Phaser.GameObjects.Container;
        
    private particles: FieryParticle[] = [];
    private readonly PARTICLE_COUNT = 150; // Random between 50-100
    private readonly SCREEN_MARGIN = 100; // Margin for particles to go off-screen
    
    // Wind system
    private windDirectionX: number = 0; // -1 for left, 0 for calm, 1 for right
    private windDirectionY: number = 0; // -1 for up, 0 for calm, 1 for down
    private windStrength: number = 0; // 0 to 1
    private windChangeTimer: number = 0;
    private readonly WIND_CHANGE_INTERVAL = 3000; // 3 seconds between wind changes
    private readonly WIND_STRENGTH_MAX = 0.8;

    create(scene: Scene, gameStateManager: GameStateManager, parentContainer?: Phaser.GameObjects.Container): void {
        this.scene = scene;
        this.gameStateManager = gameStateManager;
        this.parentContainer = parentContainer;
        this.createParticleSystem(scene);
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
        // If a parent container is provided (e.g., background), insert embers just above the background image
        if (this.parentContainer) {
            // Insert at index 1 so we stay above the first child (background image) but below other background elements
            this.parentContainer.addAt(graphics, 1);
        }
        
        // Random position (including off-screen areas)
        const x = Math.random() * (screenWidth + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
        const y = Math.random() * (screenHeight + this.SCREEN_MARGIN * 2) - this.SCREEN_MARGIN;
        
        // Random size (1.5-3.5 pixels)
        const size = Math.random() * 4 + 1;
        
        // Random velocity
        const vx = (Math.random() - 0.5) * 2; // -1 to 1
        const vy = (Math.random() - 0.5) * 2; // -1 to 1
        
        // Random fiery color
        const colors = [
            0xffAA33, // Bright yellow-orange
            0xff6600, // Orange
            0xff8800, // Light orange
            0xffaa00, // Yellow-orange
            //0xff2200, // Dark red
            //0xff0000  // Pure red
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        // Random alpha
        const alpha = Math.random() * 0.2 + 0.2; // 0.4 to 1.0
        
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
        const width = size * (Math.random() * 0.6 + 0.6); // 0.6x to 1.4x of size
        const height = size * (Math.random() * 0.9 + 0.8); // 0.8x to 2.0x of size
        
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
        
        // Render just above the background but below all other content
        graphics.setDepth(0.1);
        // is bonus round boolean

        graphics.setVisible(!this.gameStateManager.isBonus);
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
            this.createFieryParticle(scene, scene.scale.width, scene.scale.height);
        }
    }
}