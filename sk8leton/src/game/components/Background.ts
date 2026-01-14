 import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class Background {
  private bgContainer!: Phaser.GameObjects.Container;
  private networkManager: NetworkManager;
  private screenModeManager: ScreenModeManager;
  private sceneRef: Scene | null = null;
  private backgroundSpine?: any;
  private seaEdgeWidthMultiplier: number = 1.1;
  private bubbleSystem?: any;
  private bubbleStreamSystems: any[] = [];
  private readonly SCREEN_MARGIN: number = 80;
  private readonly bubbleStreamModifiers = [
    { offsetX: -195, offsetY: 90 },
    { offsetX: -110, offsetY: 90 },
    { offsetX: -35, offsetY: 90 },
    { offsetX: 45, offsetY: 90 },
    { offsetX: 120, offsetY: 90 },
    { offsetX: 200, offsetY: 90 },
  ];
  private bgDepth?: Phaser.GameObjects.Image;
  private bgFog?: Phaser.GameObjects.Image;
  private bgSurface?: Phaser.GameObjects.Image;
  private bgSky?: Phaser.GameObjects.Image;
  private seaEdge?: Phaser.GameObjects.Image;
  private reelBottomSpine?: any;
  private rippleVfxSpine?: any;
  private depthWavePipeline?: any;
  private surfaceWavePipeline?: any;
  private seaEdgeWavePipeline?: any;
  private readonly SURFACE_RIPPLE_INTERVAL_MS: number = 2000;
  private enableAutoSurfaceRipple: boolean = false;
  private surfaceRippleElapsed: number = 0;
  private lastHookSurfaceContact: boolean = false;
  private readonly hookSplashTextureKey: string = '';
  private readonly hookSplashModifiers = {
    offsetX: 0,
    offsetY: 0,
    scale: 0.75,
  };
  private surfaceRippleModifiers = {
    amplitude: 0.035,
    frequency: 35.0,
    speed: 17.5,
    decay: 0.8,
  };
  private seaEdgeBaseWaveAmplitude: number = 0.015;
  private seaEdgeWaveAmplitude: number = 0.015;
  private readonly SEA_EDGE_WAVE_AMPLITUDE_MULTIPLIER: number = 3.0;
  private readonly SEA_EDGE_WAVE_IMPULSE: number = 0.02;
  private readonly SEA_EDGE_WAVE_DECAY_PER_SECOND: number = 1.5;
  private readonly depthBackgroundModifiers = {
    offsetX: 0,
    offsetY: -360,
    scale: 0.71,
    scaleXMultiplier: 1,
    scaleYMultiplier: 0.6,
  };
  private readonly fogBackgroundModifiers = {
    offsetX: 0,
    offsetY: -230,
    scale: 0.71,
    scaleXMultiplier: 0.9,
    scaleYMultiplier: 0.35,
    opacity: 0.5,
  };
  private readonly surfaceBackgroundModifiers = {
    offsetX: 0,
    offsetY: -618,
    scale: 0.18,
    scaleXMultiplier: 1,
    scaleYMultiplier: 1,
  };
  private readonly skyBackgroundModifiers = {
    offsetX: 0,
    offsetY: -367,
    scale: 0.209,
    scaleXMultiplier: 1,
    scaleYMultiplier: 1,
  };
  private readonly reelBottomModifiers = {
    offsetX: 0,
    offsetY: -112,
    scale: 4,
  };
  private readonly rippleVfxModifiers = {
    offsetX: 0,
    offsetY: 7,
    scale: 1,
  };
  private enableWaterPipelines: boolean = true;
  private enableBubbleEffects: boolean = true;
  private bubbleParticleImageScale: number = 0.01;
  private bubbleStreamImageScale: number = 0.005;
  private enableBackgroundSpineDecorations: boolean = true;

  constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
    this.networkManager = networkManager;
    this.screenModeManager = screenModeManager;
  }

  preload(scene: Scene): void {
    // Assets are now loaded centrally through AssetConfig in Preloader
    console.log(`[Background] Assets loaded centrally through AssetConfig`);
  }

  create(scene: Scene): void {
    console.log("[Background] Creating background elements");
    this.sceneRef = scene;
    
    // Create main container for all background elements
    this.bgContainer = scene.add.container(0, 0);
    // Ensure background renders beneath base symbols background (-5)
    this.bgContainer.setDepth(-10);

    // Base background (Spine)
    try {
      if (ensureSpineFactory(scene, '[Background] NormalBackground_SK8')) {
        const spine: any = (scene as any).add.spine(
          scene.scale.width * 0.5,
          scene.scale.height * 0.5,
          'NormalBackground_SK8',
          'NormalBackground_SK8-atlas'
        );
        this.backgroundSpine = spine;
        try { this.bgContainer.add(spine); } catch {}

        const applyCoverScale = () => {
          try {
            if (!this.sceneRef || !this.backgroundSpine || this.backgroundSpine.destroyed) return;
            let b: any = null;
            try { b = this.backgroundSpine.getBounds?.(); } catch { b = null; }
            const bw = Number(b?.width);
            const bh = Number(b?.height);
            if (!(isFinite(bw) && isFinite(bh) && bw > 1 && bh > 1)) return;
            const sx = this.sceneRef.scale.width / bw;
            const sy = this.sceneRef.scale.height / bh;
            const s = Math.max(sx, sy);
            try { this.backgroundSpine.setScale?.(s); } catch { try { this.backgroundSpine.scaleX = s; this.backgroundSpine.scaleY = s; } catch {} }
            try { this.backgroundSpine.x = this.sceneRef.scale.width * 0.5; } catch {}
            try { this.backgroundSpine.y = this.sceneRef.scale.height * 0.5; } catch {}
          } catch {}
        };

        // Play default animation (loop)
        try {
          const data: any = this.backgroundSpine?.skeleton?.data;
          const animations: any[] = Array.isArray(data?.animations) ? data.animations : [];
          let animName: string | null = null;
          try {
            if (data?.findAnimation?.('animation')) {
              animName = 'animation';
            } else if (animations.length > 0 && typeof animations[0]?.name === 'string') {
              animName = animations[0].name;
            }
          } catch {}
          if (animName) {
            try { this.backgroundSpine.animationState?.setAnimation?.(0, animName, true); } catch {}
          }
        } catch {}

        try { scene.time.delayedCall(0, applyCoverScale); } catch { try { applyCoverScale(); } catch {} }
        try {
          scene.scale.on('resize', () => {
            try { applyCoverScale(); } catch {}
          });
        } catch {}
      }
    } catch {}
    try {
      this.bgDepth = undefined;
      this.bgFog = undefined;
      this.bgSurface = undefined;
      this.bgSky = undefined;
      this.seaEdge = undefined;
      this.reelBottomSpine = undefined;
      this.rippleVfxSpine = undefined;
      this.depthWavePipeline = undefined;
      this.surfaceWavePipeline = undefined;
      this.seaEdgeWavePipeline = undefined;
      this.bubbleSystem = undefined;
      this.bubbleStreamSystems = [];
    } catch {}
  }

  private createBackgroundLayers(_scene: Scene, _assetScale: number): void {
    return;
  }

  private createRippleVfxSpine(_scene: Scene, _bgSurface?: Phaser.GameObjects.Image): void {
    return;
  }

  private createReelBottomSpine(_scene: Scene): void {
    return;
  }

  private handleUpdate(_time: number, _delta: number): void {
    return;
  }

  public updateHookSurfaceInteraction(_hookX: number, _hookY: number): void {
    this.lastHookSurfaceContact = false;
    return;
  }

  private playHookSplash(_hookX: number, _hookY: number): void {
    return;
  }

  public updateSurfaceRippleModifiers(mods: { amplitude?: number; frequency?: number; speed?: number; decay?: number }): void {
    if (typeof mods.amplitude === 'number') this.surfaceRippleModifiers.amplitude = mods.amplitude;
    if (typeof mods.frequency === 'number') this.surfaceRippleModifiers.frequency = mods.frequency;
    if (typeof mods.speed === 'number') this.surfaceRippleModifiers.speed = mods.speed;
    if (typeof mods.decay === 'number') this.surfaceRippleModifiers.decay = mods.decay;
  }

  updateSurfaceBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
    if (typeof mods.offsetX === 'number') this.surfaceBackgroundModifiers.offsetX = mods.offsetX;
    if (typeof mods.offsetY === 'number') this.surfaceBackgroundModifiers.offsetY = mods.offsetY;
    if (typeof mods.scale === 'number') this.surfaceBackgroundModifiers.scale = mods.scale;
    if (typeof mods.scaleXMultiplier === 'number') this.surfaceBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
    if (typeof mods.scaleYMultiplier === 'number') this.surfaceBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
    if (this.bgSurface && this.sceneRef) {
      const scaleSurfaceX = this.sceneRef.scale.width / this.bgSurface.width;
      const scaleSurfaceY = this.sceneRef.scale.height / this.bgSurface.height;
      const surfaceCoverBase = Math.max(scaleSurfaceX, scaleSurfaceY) * this.surfaceBackgroundModifiers.scale;
      this.bgSurface.setScale(
        surfaceCoverBase * this.surfaceBackgroundModifiers.scaleXMultiplier,
        surfaceCoverBase * this.surfaceBackgroundModifiers.scaleYMultiplier
      );

      const baseSurfaceX = this.sceneRef.scale.width * 0.5;
      const baseSurfaceY = this.sceneRef.scale.height * 0.9;
      this.bgSurface.setPosition(
        baseSurfaceX + this.surfaceBackgroundModifiers.offsetX,
        baseSurfaceY + this.surfaceBackgroundModifiers.offsetY
      );
    }
  }

  resize(scene: Scene): void {
    if (this.bgContainer) {
      this.bgContainer.setSize(scene.scale.width, scene.scale.height);
    }
    if (this.bubbleSystem) {
      this.bubbleSystem.resize();
    }
    if (this.bubbleStreamSystems.length > 0) {
      const baseStreamCenterX = scene.scale.width * 0.5;
      const baseStreamCenterY = scene.scale.height * 0.5;
      for (let i = 0; i < this.bubbleStreamSystems.length; i++) {
        const mods = this.bubbleStreamModifiers[i] ?? { offsetX: 0, offsetY: 0 };
        const streamCenterX = baseStreamCenterX + mods.offsetX;
        const streamCenterY = baseStreamCenterY + mods.offsetY;
        this.bubbleStreamSystems[i].setOrigin(streamCenterX, streamCenterY);
      }
    }
  }

  configureBubbleParticles(_modifiers: any): void {
    return;
  }

  updateBubbleStreamModifier(index: number, mods: { offsetX?: number; offsetY?: number }): void {
    if (index < 0 || index >= this.bubbleStreamModifiers.length) {
      return;
    }
    const entry = this.bubbleStreamModifiers[index];
    if (typeof mods.offsetX === 'number') entry.offsetX = mods.offsetX;
    if (typeof mods.offsetY === 'number') entry.offsetY = mods.offsetY;
    if (this.sceneRef && this.bubbleStreamSystems[index]) {
      const baseStreamCenterX = this.sceneRef.scale.width * 0.5;
      const baseStreamCenterY = this.sceneRef.scale.height * 0.5;
      const streamCenterX = baseStreamCenterX + entry.offsetX;
      const streamCenterY = baseStreamCenterY + entry.offsetY;
      this.bubbleStreamSystems[index].setOrigin(streamCenterX, streamCenterY);
    }
  }

  updateDepthBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
    if (typeof mods.offsetX === 'number') this.depthBackgroundModifiers.offsetX = mods.offsetX;
    if (typeof mods.offsetY === 'number') this.depthBackgroundModifiers.offsetY = mods.offsetY;
    if (typeof mods.scale === 'number') this.depthBackgroundModifiers.scale = mods.scale;
    if (typeof mods.scaleXMultiplier === 'number') this.depthBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
    if (typeof mods.scaleYMultiplier === 'number') this.depthBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
    if (this.bgDepth && this.sceneRef) {
      const scaleDepthX = this.sceneRef.scale.width / this.bgDepth.width;
      const scaleDepthY = this.sceneRef.scale.height / this.bgDepth.height;
      const depthCoverBase = Math.max(scaleDepthX, scaleDepthY) * this.depthBackgroundModifiers.scale;
      this.bgDepth.setScale(
        depthCoverBase * this.depthBackgroundModifiers.scaleXMultiplier,
        depthCoverBase * this.depthBackgroundModifiers.scaleYMultiplier
      );

      const baseDepthX = this.sceneRef.scale.width * 0.5;
      const baseDepthY = this.sceneRef.scale.height * 0.9;
      this.bgDepth.setPosition(
        baseDepthX + this.depthBackgroundModifiers.offsetX,
        baseDepthY + this.depthBackgroundModifiers.offsetY
      );
    }
  }

  updateDepthWaveModifiers(mods: { amplitude?: number; frequency?: number; speed?: number }): void {
    if (!this.depthWavePipeline) {
      return;
    }
    if (typeof mods.amplitude === 'number') {
      this.depthWavePipeline.setAmplitude(mods.amplitude);
    }
    if (typeof mods.frequency === 'number') {
      this.depthWavePipeline.setFrequency(mods.frequency);
    }
    if (typeof mods.speed === 'number') {
      this.depthWavePipeline.setSpeed(mods.speed);
    }
  }

  updateSurfaceWaveModifiers(mods: { amplitude?: number; frequency?: number; speed?: number }): void {
    if (!this.surfaceWavePipeline) {
      return;
    }
    if (typeof mods.amplitude === 'number') {
      this.surfaceWavePipeline.setAmplitude(mods.amplitude);
    }
    if (typeof mods.frequency === 'number') {
      this.surfaceWavePipeline.setFrequency(mods.frequency);
    }
    if (typeof mods.speed === 'number') {
      this.surfaceWavePipeline.setSpeed(mods.speed);
    }
  }

	updateSkyBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number; scaleXMultiplier?: number; scaleYMultiplier?: number }): void {
		if (typeof mods.offsetX === 'number') this.skyBackgroundModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.skyBackgroundModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.skyBackgroundModifiers.scale = mods.scale;
		if (typeof mods.scaleXMultiplier === 'number') this.skyBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
		if (typeof mods.scaleYMultiplier === 'number') this.skyBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
		if (this.bgSky && this.sceneRef) {
			const scaleSkyX = this.sceneRef.scale.width / this.bgSky.width;
			const scaleSkyY = this.sceneRef.scale.height / this.bgSky.height;
			const skyCoverBase = Math.max(scaleSkyX, scaleSkyY) * this.skyBackgroundModifiers.scale;
			this.bgSky.setScale(
				skyCoverBase * this.skyBackgroundModifiers.scaleXMultiplier,
				skyCoverBase * this.skyBackgroundModifiers.scaleYMultiplier
			);

			const baseSkyX = this.sceneRef.scale.width * 0.5;
			const baseSkyY = this.sceneRef.scale.height * 0.5;
			this.bgSky.setPosition(
				baseSkyX + this.skyBackgroundModifiers.offsetX,
				baseSkyY + this.skyBackgroundModifiers.offsetY
			);
		}
	}

	updateReelBottomModifiers(mods: { offsetX?: number; offsetY?: number; scale?: number }): void {
		if (typeof mods.offsetX === 'number') this.reelBottomModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.reelBottomModifiers.offsetY = mods.offsetY;
		if (typeof mods.scale === 'number') this.reelBottomModifiers.scale = mods.scale;
		if (this.reelBottomSpine && this.sceneRef) {
			const reelBaseX = this.sceneRef.scale.width * 0.5 + this.reelBottomModifiers.offsetX;
			const reelBaseY = this.sceneRef.scale.height * 0.78 + this.reelBottomModifiers.offsetY;
			this.reelBottomSpine.x = reelBaseX;
			this.reelBottomSpine.y = reelBaseY;
			const baseScale = (this.sceneRef.scale.width / 1920) * this.reelBottomModifiers.scale;
			this.reelBottomSpine.setScale(baseScale);
		}
	}

	getCharacterSpine(): any | undefined {
		return undefined;
	}

	setVisible(visible: boolean): void {
		try { this.bgContainer?.setVisible(visible); } catch {}
		try { this.bgFog?.setVisible(visible); } catch {}
		try { this.seaEdge?.setVisible(visible); } catch {}
		try { this.reelBottomSpine?.setVisible(visible); } catch {}
		try { this.rippleVfxSpine?.setVisible(visible); } catch {}
		try { this.bubbleSystem?.getContainer?.()?.setVisible(visible); } catch {}
		try {
			if (Array.isArray(this.bubbleStreamSystems)) {
				for (const stream of this.bubbleStreamSystems) {
					try { stream?.getContainer?.()?.setVisible(visible); } catch {}
				}
			}
		} catch {}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	public darkenDepthForWinSequence(): void {
		return;
	}

	public restoreDepthAfterWinSequence(): void {
		return;
	}
}
