import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class Background {
	private bgContainer!: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private propsOffsetX: number = -23.6;
	private propsOffsetY: number = 0;
	private propsSpine: any;
	private propsContainer: Phaser.GameObjects.Container | null = null;
	private isBonusMode: boolean = false;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	public setPropsOffset(x: number, y: number): void {
		this.propsOffsetX = x;
		this.propsOffsetY = y;
		if (this.propsSpine) {
			this.propsSpine.x = (this.propsSpine.scene.scale.width * 0.5) + this.propsOffsetX;
			this.propsSpine.y = (this.propsSpine.scene.scale.height * 0.5) + this.propsOffsetY;
		}
	}

	public getPropsOffset(): { x: number; y: number } {
		return { x: this.propsOffsetX, y: this.propsOffsetY };
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Background] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Background] Creating background elements");
		
		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		// Add background layers
		this.createBackgroundLayers(scene, assetScale);
		
		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);
		
		// Add UI elements
		//this.createUIElements(scene, assetScale);
	}

	private createBackgroundLayers(scene: Scene, assetScale: number): void {


    // Add reel frame
    const reelFrame = scene.add.image(
        scene.scale.width * 0.5,
        scene.scale.height * 0.520,
        'reel-frame'
    ).setOrigin(0.5, 0.5).setScale(1.02).setDepth(400);
    this.bgContainer.add(reelFrame);

	    const reelFrame2 = scene.add.image(
        scene.scale.width * 0.5,
        scene.scale.height * 0.483,
        'reel-frame-2'
    ).setOrigin(0.5, 0.5).setScale(1 ).setDepth(401);
    this.bgContainer.add(reelFrame2);

    /*
    
    	// Add bulbs
		const bulb1 = scene.add.image(
			scene.scale.width * 0.21,
			scene.scale.height * 0.40,
			'bulb-01'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb1);

		const bulb2 = scene.add.image(
			scene.scale.width * 0.521,
			scene.scale.height * 0.40,
			'bulb-02'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb2);

		const bulb3 = scene.add.image(
			scene.scale.width * 0.818,
			scene.scale.height * 0.40,
			'bulb-03'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb3);
    */

    // Spine background props (from assets/.../background/spine-background)
    console.log('[Background] Attempting to load spine animation...');
    try {
        const hasFactory = ensureSpineFactory(scene, '[Background] createBackgroundLayers');
        const hasJson = (scene.cache.json as any).has('props');
        console.log(`[Background] Spine factory available: ${hasFactory}, JSON loaded: ${hasJson}`);
        
        if (hasFactory && hasJson) {
            console.log('[Background] Creating spine animation container...');
            // Create a dedicated container for the props spine
            const propsContainer = scene.add.container(0, 0);
            propsContainer.setDepth(600); // Place above reels but below UI
            
            try {
                console.log('[Background] Creating spine animation instance...');
                const propsSpine = scene.add.spine(
                    scene.scale.width * 0.5 + this.propsOffsetX,
                    scene.scale.height * 0.5 + this.propsOffsetY,
                    'props',
                    'props-atlas'
                );
                
                console.log('[Background] Spine instance created:', propsSpine);
                
                propsSpine.setOrigin(0.5, 0.5);
                propsSpine.setScale(assetScale);
                
                // Add the spine to its container
                propsContainer.add(propsSpine);
                
                // Store references for later adjustments
                this.propsSpine = propsSpine;
                this.propsContainer = propsContainer;
                
                // Set initial visibility
                propsContainer.setVisible(true);
                
                // Add the props container to the scene at the correct depth
                scene.add.existing(propsContainer);
                propsContainer.setDepth(600); // Keep the same depth as before
                
                // Listen for bonus mode changes
                this.setupBonusModeListener(scene);

                // Play first available animation if present
                try {
                    console.log('[Background] Attempting to play spine animation...');
                    const anySpine: any = propsSpine as any;
                    console.log('[Background] Spine skeleton data:', anySpine.skeleton?.data);
                    
                    const animations = anySpine?.skeleton?.data?.animations;
                    console.log('[Background] Available animations:', animations);
                    
                    if (animations && animations.length > 0) {
                        const animName = animations[0].name || animations[0];
                        console.log(`[Background] Playing animation: ${animName}`);
                        
                        // Try with a small delay to ensure everything is ready
                        scene.time.delayedCall(100, () => {
                            try {
                                console.log(`[Background] Starting animation playback for: ${animName}`);
                                propsSpine.animationState.setAnimation(0, animName, true);
                                console.log('[Background] Animation playback started');
                            } catch (e) {
                                console.error('[Background] Error in delayed animation start:', e);
                            }
                        });
                    } else {
                        console.warn('[Background] No animations found in spine data');
                    }
                } catch (e) {
                    console.error('[Background] Failed to play props animation:', e);
                }
            } catch (spineError) {
                console.error('[Background] Error creating spine animation:', spineError);
            }
        } else {
            console.warn('[Background] Props spine not ready or spine factory missing.', {
                hasFactory,
                hasJson,
                jsonKeys: Object.keys((scene.cache.json as any).entries.keys || {})
            });
        }
    } catch (e) {
        console.warn('[Background] Failed to create props spine:', e);
    }

    // Tent moved to Header component
    }

    /**
     * Sets up event listeners for bonus mode changes
     */
    private setupBonusModeListener(scene: Scene): void {
        try {
            // Listen for bonus mode changes
            scene.events.on('bonusModeChanged', (isBonusMode: boolean) => {
                console.log(`[Background] Bonus mode changed to: ${isBonusMode}`);
                this.isBonusMode = isBonusMode;
                
                // Hide/show the props container based on bonus mode
                if (this.propsContainer) {
                    this.propsContainer.setVisible(!isBonusMode);
                    console.log(`[Background] Props container visibility set to: ${!isBonusMode}`);
                }
                
                // Handle any animation changes for the props
                if (this.propsSpine) {
                    try {
                        const anySpine: any = this.propsSpine;
                        const animations = anySpine?.skeleton?.data?.animations || [];
                        
                        if (animations.length > 0) {
                            // Try to find a specific animation for bonus mode, or use the first one
                            const animName = isBonusMode && animations.some((a: any) => a.name === 'bonus') 
                                ? 'bonus' 
                                : animations[0].name || animations[0];
                                
                            console.log(`[Background] Setting animation to: ${animName}`);
                            this.propsSpine.animationState.setAnimation(0, animName, true);
                        }
                    } catch (e) {
                        console.error('[Background] Error updating animation for bonus mode:', e);
                    }
                }
            });
            
            console.log('[Background] Bonus mode listener set up');
        } catch (e) {
            console.error('[Background] Failed to set up bonus mode listener:', e);
        }
    }

	private createDecorativeElements(scene: Scene, assetScale: number): void {
		// Add balloons
		const balloon1 = scene.add.image(
			scene.scale.width * 0.04,
			scene.scale.height * 0.5,
			'balloon-01'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon1);

		const balloon2 = scene.add.image(
			scene.scale.width * 0.06,
			scene.scale.height * 0.3,
			'balloon-02'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon2);

		const balloon3 = scene.add.image(
			scene.scale.width * 0.95,
			scene.scale.height * 0.6,
			'balloon-03'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon3);

		const balloon4 = scene.add.image(
			scene.scale.width * 0.92,
			scene.scale.height * 0.35,
			'balloon-04'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon4);

		// Add Christmas lights
		const xmasLights = scene.add.image(
			scene.scale.width * 0.495,
			scene.scale.height * 0.40,
			'reel-xmaslight-default'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(xmasLights);

	
	}

	private createUIElements(scene: Scene, assetScale: number): void {
		// Add logo
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.05,
			'kobi-logo'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bgContainer.add(logo);
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	public getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	/**
	 * Clean up resources when the scene is destroyed
	 */
	destroy(): void {
		try {
			console.log('[Background] Cleaning up resources...');
			
			// Clean up the props spine animation if it exists
			if (this.propsSpine) {
				console.log('[Background] Destroying props spine animation');
				
				// Stop any running animations
				if (this.propsSpine.animationState) {
					this.propsSpine.animationState.clearTracks();
				}
				
				// Remove from display list and destroy
				if (this.propsSpine.scene) {
					this.propsSpine.scene.tweens.killTweensOf(this.propsSpine);
				}
				
				// Destroy the spine object
				this.propsSpine.destroy();
				this.propsSpine = null;
			}
			
			// Clean up the props container
			if (this.propsContainer) {
				console.log('[Background] Hiding and cleaning up props container');
				// First hide the container
				this.propsContainer.setVisible(false);
				// Then clean up
				this.propsContainer.removeAll(true);
				if (this.propsContainer.scene) {
					this.propsContainer.scene.tweens.killTweensOf(this.propsContainer);
				}
				this.propsContainer.destroy();
				this.propsContainer = null;
			}
			
			// Clean up the main container
			if (this.bgContainer) {
				console.log('[Background] Destroying background container');
				this.bgContainer.removeAll(true);
			}
		} catch (error) {
			console.error('[Background] Error during cleanup:', error);
		}
	}
	
	/**
	 * Hides the props container
	 */
	public hideProps(): void {
		if (this.propsContainer) {
			this.propsContainer.setVisible(false);
			console.log('[Background] Props container hidden');
		}
	}
	
	/**
	 * Shows the props container
	 */
	public showProps(): void {
		if (this.propsContainer) {
			this.propsContainer.setVisible(true);
			console.log('[Background] Props container shown');
		}
	}
}
