import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class BonusBackground {
	private bgContainer!: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private sceneRef: Scene | null = null;
	private backgroundSpine?: any;
	private seaEdgeWidthMultiplier: number = 1.1;
	private bubbleStreamSystems: any[] = [];
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
	private enableBubbleEffects: boolean = true;
	private bubbleStreamImageScale: number = 0.005;
	private lastHookSurfaceContact: boolean = false;
	private readonly hookSplashTextureKey: string = '';
	private readonly hookSplashModifiers = {
		offsetX: 0,
		offsetY: 0,
		scale: 0.8,
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
		scaleYMultiplier: 0.95,
	};
	private readonly skyBackgroundModifiers = {
		offsetX: 0,
		offsetY: -367,
		scale: 0.209,
		scaleXMultiplier: 1,
		scaleYMultiplier: 1,
	};

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		console.log(`[BonusBackground] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		this.sceneRef = scene;
		this.bgContainer = scene.add.container(0, 0);
		this.bgContainer.setDepth(-10);

		// Bonus background (Spine)
		try {
			if (ensureSpineFactory(scene, '[BonusBackground] BonusBackground_SK8')) {
				const spine: any = (scene as any).add.spine(
					scene.scale.width * 0.5,
					scene.scale.height * 0.5,
					'BonusBackground_SK8',
					'BonusBackground_SK8-atlas'
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
			this.bubbleStreamSystems = [];
		} catch {}
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

	setCharacterLayout(options: { offsetX?: number; offsetY?: number; scale?: number }): void {
		if (typeof options.offsetX === 'number') {
			this.characterModifiers.offsetX = options.offsetX;
		}
		if (typeof options.offsetY === 'number') {
			this.characterModifiers.offsetY = options.offsetY;
		}
		if (typeof options.scale === 'number' && isFinite(options.scale) && options.scale > 0) {
			this.characterModifiers.scale = options.scale;
		}
		try {
			if (this.sceneRef) {
				this.applyCharacterTransform(this.sceneRef);
			}
		} catch {}
	}

	private createBackgroundLayers(_scene: Scene, _assetScale: number): void {
		return;
	}

	private createCharacterSpine(_scene: Scene): void {
		return;
	}

	private createRippleVfxSpine(_scene: Scene, _bgSurface?: Phaser.GameObjects.Image): void {
		return;
	}

	private createReelBottomSpine(_scene: Scene): void {
		return;
	}

	private alignSpineToTarget(spine: any, targetX: number, targetY: number): void {
		try {
			const spineAny: any = spine;
			if (!spineAny || typeof spineAny.getBounds !== 'function') {
				return;
			}
			try { spineAny.update?.(0); } catch {}
			const b = spineAny.getBounds();
			const sizeX = (b?.size?.width ?? b?.size?.x ?? 0);
			const sizeY = (b?.size?.height ?? b?.size?.y ?? 0);
			const offX = (b?.offset?.x ?? 0);
			const offY = (b?.offset?.y ?? 0);
			if (sizeX > 0 && sizeY > 0) {
				const centerWorldX = offX + sizeX * 0.5;
				const centerWorldY = offY + sizeY * 0.5;
				spineAny.x += (targetX - centerWorldX);
				spineAny.y += (targetY - centerWorldY);
			}
		} catch {}
	}

	private applyCharacterTransform(_scene: Scene): void {
		return;
	}

	private applyWaterPipelines(_scene: Scene): void {
		return;
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
		try { this.applyCharacterTransform(scene); } catch {}
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

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	public darkenDepthForWinSequence(): void {
		return;
	}

	public restoreDepthAfterWinSequence(): void {
		return;
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
		try {
			if (Array.isArray(this.bubbleStreamSystems)) {
				for (const stream of this.bubbleStreamSystems) {
					try { stream?.getContainer?.()?.setVisible(visible); } catch {}
				}
			}
		} catch {}
	}

	destroy(): void {
		try {
			if (this.sceneRef) {
				try { this.sceneRef.events.off('update', this.handleUpdate, this); } catch {}
			}
		} catch {}
		try {
			for (const stream of this.bubbleStreamSystems) {
				try { stream.destroy(); } catch {}
			}
			this.bubbleStreamSystems = [];
		} catch {}
		try { this.bgContainer?.destroy(); } catch {}
		try { this.seaEdge?.destroy(); } catch {}
		try { this.reelBottomSpine?.destroy(); } catch {}
		try { this.rippleVfxSpine?.destroy(); } catch {}
		this.sceneRef = null;
	}
}


