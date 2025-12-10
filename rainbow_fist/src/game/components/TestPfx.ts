import { Scene } from 'phaser';
import { emit } from 'process';

export class TestPfx {
	private scene: Scene;
	private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
	private particleManager: any = null; // Phaser ParticleEmitterManager type
	private featherManager: any = null; // Manager for falling leaves effect
    private dovesManagerLeft: any = null; // Manager for doves from left side
    private dovesManagerRight: any = null; // Manager for doves from right side

	constructor() {
		// Constructor can be empty or take managers if needed
	}

	/**
	 * Initialize the particle system
	 */
	create(scene: Scene): void {
		this.scene = scene;

		// Create a simple particle texture (white circle)
		// If you have a custom particle texture, load it in preload and use its key here
		const graphics = scene.add.graphics();
		graphics.fillStyle(0xffffff, 1);
		graphics.fillCircle(0, 0, 4);
		graphics.generateTexture('particle', 8, 8);
		graphics.destroy();
		
		console.log('[TestPfx] Particle system created');
	}

	/**
	 * Stop emitting particles
	 */
	stop(): void {
		if (this.particleEmitter) {
			this.particleEmitter.stop();
			this.particleEmitter = null;
		}
		if (this.particleManager) {
			this.particleManager.destroy();
			this.particleManager = null;
		}
	}

	/**
	 * Set the particle texture (call this if you want to use a custom texture)
	 * Note: This will regenerate the particle texture. Make sure to call this before using start() or burst()
	 */
	setTexture(textureKey: string): void {
		// If texture doesn't exist, create it
		if (!this.scene.textures.exists(textureKey)) {
			console.warn(`[TestPfx] Texture '${textureKey}' does not exist. Make sure to load it in preload or create it first.`);
		}
		console.log(`[TestPfx] Using particle texture: ${textureKey}`);
	}

	/**
	 * Update emitter position (useful for following objects)
	 */
	setPosition(x: number, y: number): void {
		if (this.particleEmitter) {
			this.particleEmitter.setPosition(x, y);
		} else if (this.particleManager) {
			// Update the manager's position if emitter is not directly accessible
			this.particleManager.setPosition(x, y);
		}
	}

	/**
	 * Create falling leaves effect with side-to-side swaying motion
	 * Leaves fall from the top of the screen and sway horizontally as they descend
	 */
	createFeatherFx(): void {
		// Create feather fx texture if it doesn't exist
		if (!this.scene.textures.exists('feather_fx')) {
			const graphics = this.scene.add.graphics();
			// Create a feather fx-like oval shape
			graphics.fillStyle(0xFFFFFF, 1); // White base
			graphics.fillEllipse(0, 0, 48, 32);
			graphics.generateTexture('feather_fx', 24, 16);
			graphics.destroy();
		}

		// Stop any existing leaves effect
		this.stopParticleEffects(this.featherManager);

		// Feather fx colors
		const featherColors = [0xFFFFFF]; // Different variations of white color

		// Create particle manager for feather fx
		// Emit from across the top of the screen
        const offset = 10;
		const screenWidth = this.scene.scale.width;
		const topY = this.scene.scale.height + offset; // Top of the screen

		// Create emission zone across the top of the screen
		// Define the emission line in local coords (relative to manager position)
		const emitZone = new Phaser.Geom.Line(0, 0, screenWidth, 0);

		this.featherManager = this.scene.add.particles(0, topY, 'feather_fx', {
			// Emission zone - across the top of the screen
			emitZone: {
				type: 'random',
				source: emitZone,
				quantity: 1
			},
			
            x: 
            { 
                onUpdate: (particle, key, t, value) => 
                {
                    if(t > 0.95)
                        console.log("[TestPfx] maxVelocityY: " + particle.velocityY);
                    return this.calculateSwirl(particle, t, value, {x: 100, y: 200});
                },
            },
			// Particle properties
			speed: { min: 0, max: 100 }, // Slow initial speed
			scale: {
				onEmit: (particle: any) => {
					if (!particle.data) {
						particle.data = {};
					}
					const d = particle.data as any;
					d.baseScaleStart = 0.9;
					d.baseScaleEnd = 0.5;
					// Ensure swirl params exist for consistent depth scaling even if calculateSwirl hasn't run yet
					if (d.swirlPhase === undefined) {
						d.swirlPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
					}
					if (d.swirlSpeed === undefined) {
						d.swirlSpeed = Phaser.Math.FloatBetween(0.5, 2.0);
					}
					return d.baseScaleStart;
				},
				onUpdate: (particle: any, key: string, t: number) => {
					const d = (particle.data || {}) as any;
					const baseStart = d.baseScaleStart ?? 0.8;
					const baseEnd = d.baseScaleEnd ?? 0.3;
					const baseScale = Phaser.Math.Linear(baseStart, baseEnd, t);
					// Use the same angle logic as swirl for depth factor
					const angle = t * Math.PI * 2 * (d.swirlSpeed ?? 1) + (d.swirlPhase ?? 0);
					const depthAmplitude = 0.25; // tweak for noticeable effect without extremes
					const depthFactor = 1 + depthAmplitude * Math.cos(angle);
					return baseScale * depthFactor;
				}
			}, // Slightly shrink as they fall with depth modulation
			alpha: { start: 0.95, end: 0.5 }, // Slight fade
			lifespan: {min: 7000, max: 12000}, // Long lifespan for slow fall
			frequency: 500, // Emit a feather fx every 500ms
			quantity: 1, // One feather fx at a time
            maxVelocityY: 125,
            maxAliveParticles: 50,
			
			// Physics - slow gravity for gentle fall
			gravityY: -50,
			
			// Rotation - leaves tumble as they fall
			rotate: { start: 0, end: 360 }, // Full rotation over lifespan
			
			// Random tint from autumn colors
			tint: () => {
				return featherColors[Math.floor(Math.random() * featherColors.length)];
			},
			
			// Blend mode
			blendMode: 'NORMAL',
			
			// Add some horizontal velocity variation for swaying
			angle: { min: 260, max: 280 } // Slight angle variation (mostly downward)
		});

		this.featherManager.setDepth(10);

		console.log('[TestPfx] Falling leaves effect created');
	}

    createDovePfx() : void
    {
        // Create Graphic
        if (!this.scene.textures.exists('dove')) {
			const graphics = this.scene.add.graphics();
			// Create a dove-like oval shape
			graphics.fillStyle(0xFFFFFF, 1); // Brown base
			graphics.fillEllipse(0, 0, 32, 32);
			graphics.generateTexture('dove', 24, 24);
			graphics.destroy();
		}
        // Stop particle emitters if existing
        this.stopParticleEffects(this.dovesManagerLeft);
        this.stopParticleEffects(this.dovesManagerRight);

        const screenWidth = this.scene.scale.width;
        const emitY = 200;
        const emitX = 20;
        
        // Base particle config shared by both managers
        const baseConfig = {
			scale: { min: 0.7, max: 1.1 }, // Slightly shrink as they fall
			lifespan: {min: 1500, max: 3000}, // Long lifespan for slow fall
			frequency: 200, // Emit a dove every 500ms
			quantity: { min: 1, max: 3 }, // One dove at a time
            maxVelocityY: 125,
            maxAliveParticles: 1,
            y:
            {
                onUpdate: (particle, key, t, value) =>
                {
                    return this.calculateUpwardMovement(particle, t, value, -emitY * 2, emitY);
                }
            }
        };

        // Left manager config - particles move from left to right
        const leftManagerX = -emitX;
        const leftConfig = {
            ...baseConfig,
            x: {
                onEmit: (particle: any, key?: string, value?: number) => {
                    if (!particle.data) {
                        particle.data = {};
                    }
                    const d = particle.data as any;
                    d.startX = leftManagerX;
                    d.targetX = screenWidth + emitX; // Move to right side
                    return leftManagerX;
                },
                onUpdate: (particle: any, key: string, t: number, value: number) => {
                    return this.calculateCrossScreenMovement(particle, t, value, screenWidth);
                }
            }
        };

        // Right manager config - particles move from right to left
        const rightManagerX = screenWidth / 2 + emitX;
        const rightConfig = {
            ...baseConfig,
            x: {
                onEmit: (particle: any, key?: string, value?: number) => {
                    if (!particle.data) {
                        particle.data = {};
                    }
                    const d = particle.data as any;
                    d.startX = rightManagerX;
                    d.targetX = -screenWidth / 2 - emitX; // Move to left side
                    return rightManagerX;
                },
                onUpdate: (particle: any, key: string, t: number, value: number) => {
                    return this.calculateCrossScreenMovement(particle, t, value, screenWidth);
                }
            }
        };

        // Create Particle Manager for left side (x=-emitX)
        this.dovesManagerLeft = this.scene.add.particles(leftManagerX, emitY, 'dove', leftConfig);

        // Create Particle Manager for right side (x=screenWidth + emitX)
        this.dovesManagerRight = this.scene.add.particles(rightManagerX, emitY, 'dove', rightConfig);
    }

	private calculateSway(particle: Phaser.GameObjects.Particles.Particle, t: number, value: number): number
	{
		if (!particle.data) {
			particle.data = {};
		}

		const d = particle.data as any;

		// Initialize per-particle sway params
		if (d.baseX === undefined) {
			// Use the op's provided value (spawn X) as base, fallback to current x
			d.baseX = (value !== undefined ? value : particle.x);
		}
		if (d.swayPhase === undefined) {
			d.swayPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
		}
		if (d.swayFreq === undefined) {
			// cycles per lifespan (0.8 to 1.6 cycles)
			d.swayFreq = Phaser.Math.FloatBetween(0.8, 1.6);
		}
		if (d.swayAmp === undefined) {
			// amplitude in pixels; random direction left/right
			const amp = Phaser.Math.Between(30, 90);
			const dir = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
			d.swayAmp = amp * dir;
		}

		// t is 0..1 over lifespan. Convert to angle and return new X
		const angle = t * Math.PI * 2 * d.swayFreq + d.swayPhase;
		return d.baseX + Math.sin(angle) * d.swayAmp;
	}

	private calculateSwirl(particle: Phaser.GameObjects.Particles.Particle, t: number, value: number, swirlRange: {x: number, y: number}): number
	{
		if (!particle.data) {
			particle.data = {};
		}

		const d = particle.data as any;
		const screenWidth = this.scene.scale.width;
		const screenCenterX = screenWidth / 2;

		// Initialize per-particle swirl params
		if (d.swirlStartX === undefined) {
			// Determine if particle starts from left (0) or right (screenWidth) side
			// Use spawn position to determine side, or random if value is center
			const spawnX = value !== undefined ? value : particle.x;
			d.swirlStartX = spawnX < screenCenterX ? 0 : screenWidth;
			d.swirlDirection = spawnX < screenCenterX ? 1 : -1; // 1 = from left, -1 = from right
		}
		if (d.swirlPhase === undefined) {
			// Random phase offset for variation
			d.swirlPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
		}
		if (d.swirlRadius === undefined) {
			// Maximum radius of the swirl (distance from center)
			d.swirlRadius = Phaser.Math.Between(swirlRange.x, swirlRange.y);
		}
		if (d.swirlSpeed === undefined) {
			// How many full rotations over the lifespan (1-3 rotations)
			d.swirlSpeed = Phaser.Math.FloatBetween(0.5, 2.0);
		}
		if (d.swirlCenterY === undefined) {
			// Vertical center point for the swirl (middle of screen or based on particle Y)
			d.swirlCenterY = particle.y;
		}

		// Calculate spiral motion
		// t goes from 0 to 1 over lifespan
		// Angle increases as particle ages, creating spiral
		const angle = t * Math.PI * 2 * d.swirlSpeed + d.swirlPhase;
		
		// Radius decreases over time (spiral inward) or stays constant
		const currentRadius = d.swirlRadius * (1 - t * 0.5); // Spiral inward
		
		// Calculate X position based on spiral
		// Start from left/right edge and spiral toward/around center
		const spiralOffsetX = Math.cos(angle) * currentRadius;
		
		// Base position moves from edge toward center, with spiral motion
		const baseProgress = t; // 0 to 1
		const targetX = screenCenterX; // Spiral toward center
		const startX = d.swirlStartX;
		const linearX = startX + (targetX - startX) * baseProgress;
		
		// Combine linear movement toward center with spiral motion
		return linearX + spiralOffsetX * d.swirlDirection;
	}

	private calculateCrossScreenMovement(particle: Phaser.GameObjects.Particles.Particle, t: number, value: number, screenWidth: number): number
	{
		if (!particle.data) {
			particle.data = {};
		}

		const d = particle.data as any;
        
		// Direction should be set in onEmit, but safety check if it wasn't
		if (d.startX === undefined || d.targetX === undefined) {
			const screenCenterX = screenWidth / 2;
			d.startX = particle.x;
			d.targetX = d.startX < screenCenterX ? screenWidth : 0;
		}

		// Linear interpolation from start to target based on lifespan progress (t)
		return d.startX + (d.targetX - d.startX) * t;
	}

	private calculateUpwardMovement(particle: Phaser.GameObjects.Particles.Particle, t: number, value: number, targetRange: number, spawnRange: number): number
	{
		if (!particle.data) {
            particle.data = {};
        }

        const d = particle.data as any;

        if(d.radomStartY === undefined)
        {
            d.randomStartY = particle.y + Math.random() * spawnRange - spawnRange / 2;
        
            console.log("Calculate upward angle" + d.randomStartY);
        }
        
        if (d.startY === undefined) {
            // Store the initial spawn Y position
            d.startY = value !== undefined ? value : d.randomStartY;
        }
        if (d.targetY === undefined) {
            d.targetY = Math.random() * targetRange;
        }

		return d.startY + (d.targetY - d.startY) * t;
	}

	/**
	 * Stop the falling leaves effect
	 */
	stopParticleEffects(pfx: any): void {
		if (pfx) {
			pfx.destroy();
			pfx = null;
			console.log('[TestPfx] Particle effect stopped');
		}
	}

    stopAllParticleEffects() {
        this.stopParticleEffects(this.featherManager);
        this.stopParticleEffects(this.dovesManagerLeft);
        this.stopParticleEffects(this.dovesManagerRight);
    }


	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.stop();
		this.stopParticleEffects(this.featherManager);
		this.stopParticleEffects(this.dovesManagerLeft);
		this.stopParticleEffects(this.dovesManagerRight);
		if (this.particleManager) {
			this.particleManager.destroy();
			this.particleManager = null;
		}
		console.log('[TestPfx] Particle system destroyed');
	}
}

