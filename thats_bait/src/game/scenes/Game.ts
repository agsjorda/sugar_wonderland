import Phaser from 'phaser';

import { SlotController } from '../components/SlotController';
import { Symbols } from '../components/Symbols';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { GameData } from '../components/GameData';
import { EventBus } from '../EventBus';
import { GameAPI } from '../../backend/GameAPI';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { RopeCable } from '../components/RopeCable';
import { Background } from '../components/Background';
import { FullScreenManager } from '../../managers/FullScreenManager';

export class Game extends Phaser.Scene {
	private networkManager!: NetworkManager;
	private screenModeManager!: ScreenModeManager;
	private slotController!: SlotController;
	private infoText!: Phaser.GameObjects.Text;
	private rope?: RopeCable;
	private startHandle?: Phaser.GameObjects.Arc;
	private endHandle?: Phaser.GameObjects.Arc;
	private readonly startAnchor = new Phaser.Math.Vector2();
	private readonly endAnchor = new Phaser.Math.Vector2();
	private readonly dragBoundsPadding = 32;
	private readonly ropeStyle = {
		color: 0x000000,
		coreColor: 0x000000,
		outlineVisible: false,
		damping: 0.96
	};
	private readonly ropeDepth = Number.MAX_SAFE_INTEGER - 2;
	private readonly ropeHandleDepth = Number.MAX_SAFE_INTEGER - 1;
	private readonly rodTipBoneName = 'bone19';
	private hookImage?: Phaser.GameObjects.Image;
	private readonly hookTextureKey = 'hook';
	private readonly hookScale = 0.20;

	public readonly gameData: GameData;
	public readonly gameAPI: GameAPI;
	private background!: Background;
	private slotBackground?: Phaser.GameObjects.Image;
	private fullscreenBtn?: Phaser.GameObjects.Image;
	private symbols!: Symbols;
	private readonly slotBackgroundModifiers = {
		offsetX: 0,
		offsetY: 40,
		scaleMultiplier: 1.,
		scaleXMultiplier: 1.05,
		scaleYMultiplier: 1.22,
		anchorFromBottom: true
	};

	constructor() {
		super('Game');
		this.gameData = new GameData();
		this.gameAPI = new GameAPI(this.gameData);
	}

	init(data: { networkManager?: NetworkManager; screenModeManager?: ScreenModeManager }): void {
		this.networkManager = data?.networkManager ?? new NetworkManager();
		this.screenModeManager = data?.screenModeManager ?? new ScreenModeManager();
	}

	preload(): void {
		// Assets are loaded in the Preloader scene.
	}

	create(): void {
		this.cameras.main.setBackgroundColor('#050d18');
		this.createBackground();
		this.createSlotBackground();

		const assetScale = this.networkManager.getAssetScale();
		this.fullscreenBtn = FullScreenManager.addToggle(this, {
			margin: 16 * assetScale,
			iconScale: 1.5 * assetScale,
			depth: Number.MAX_SAFE_INTEGER
		});

		// Expose data so SlotController can latch on (mirrors the legacy scene behaviour).
		(this as any).gameData = this.gameData;
		(this as any).gameAPI = this.gameAPI;

		this.slotController = new SlotController(this.networkManager, this.screenModeManager);
		this.slotController.create(this);

		// Create and expose the Symbols component for the base game grid
		this.symbols = new Symbols();
		(this as any).symbols = this.symbols;
		this.symbols.create(this as any);
		this.slotController.setSymbols(this.symbols);
	
		// Create rope and draggable handles after the main UI so they sit on top visually.
		this.setupRopeCable();
		this.bringRopeToFront();
		void this.initializeTokenAndBalance();

		this.registerUiEventListeners();
		
		// Let any downstream listeners know the simple scene is ready.
		gameEventManager.emit(GameEventType.START);
	}

	private createBackground(): void {
		this.background = new Background(this.networkManager, this.screenModeManager);
		this.background.create(this);
	}

	private createSlotBackground(): void {
		try { this.slotBackground?.destroy(); } catch {}
		const bg = this.add.image(
			this.scale.width * 0.5 + this.slotBackgroundModifiers.offsetX,
			this.getSlotBackgroundBaseY(),
			'BG-Normal-Slots'
		).setOrigin(0.5, this.slotBackgroundModifiers.anchorFromBottom ? 1 : 0.5);
		const scaleX = this.scale.width / bg.width;
		const scaleY = (this.scale.height * 0.4) / bg.height;
		bg.setScale(
			scaleX * this.slotBackgroundModifiers.scaleMultiplier * this.slotBackgroundModifiers.scaleXMultiplier,
			scaleY * this.slotBackgroundModifiers.scaleMultiplier * this.slotBackgroundModifiers.scaleYMultiplier
		);
		bg.setDepth(880);
		bg.setScrollFactor(0);
		this.slotBackground = bg;
	}

	public updateSlotBackgroundModifiers(mods: { offsetX?: number; offsetY?: number; scaleMultiplier?: number; scaleXMultiplier?: number; scaleYMultiplier?: number; anchorFromBottom?: boolean }): void {
		if (typeof mods.anchorFromBottom === 'boolean') this.slotBackgroundModifiers.anchorFromBottom = mods.anchorFromBottom;
		if (typeof mods.offsetX === 'number') this.slotBackgroundModifiers.offsetX = mods.offsetX;
		if (typeof mods.offsetY === 'number') this.slotBackgroundModifiers.offsetY = mods.offsetY;
		if (typeof mods.scaleMultiplier === 'number') this.slotBackgroundModifiers.scaleMultiplier = mods.scaleMultiplier;
		if (typeof mods.scaleXMultiplier === 'number') this.slotBackgroundModifiers.scaleXMultiplier = mods.scaleXMultiplier;
		if (typeof mods.scaleYMultiplier === 'number') this.slotBackgroundModifiers.scaleYMultiplier = mods.scaleYMultiplier;
		if (this.slotBackground) {
			this.slotBackground.setOrigin(0.5, this.slotBackgroundModifiers.anchorFromBottom ? 1 : 0.5);
			this.slotBackground.setPosition(
				this.scale.width * 0.5 + this.slotBackgroundModifiers.offsetX,
				this.getSlotBackgroundBaseY()
			);
			const scaleX = this.scale.width / this.slotBackground.width;
			const scaleY = (this.scale.height * 0.4) / this.slotBackground.height;
			this.slotBackground.setScale(
				scaleX * this.slotBackgroundModifiers.scaleMultiplier * this.slotBackgroundModifiers.scaleXMultiplier,
				scaleY * this.slotBackgroundModifiers.scaleMultiplier * this.slotBackgroundModifiers.scaleYMultiplier
			);
		}
	}

	private getSlotBackgroundBaseY(): number {
		return (this.slotBackgroundModifiers.anchorFromBottom ? this.scale.height : this.scale.height * 0.8) + this.slotBackgroundModifiers.offsetY;
	}

	update(_time: number, delta: number): void {
		this.rope?.update(delta);
		if (this.rope && this.hookImage) {
			const points = this.rope.getPoints();
			const count = points.length;
			if (count > 0) {
				const end = points[count - 1];
				this.hookImage.setPosition(end.x, end.y);
				if (count > 1) {
					const prev = points[count - 2];
					const dx = end.x - prev.x;
					const dy = end.y - prev.y;
					const angle = Math.atan2(dy, dx) - Math.PI * 0.5;
					this.hookImage.setRotation(angle);
				}
			}
		}
	}

	private async initializeTokenAndBalance(): Promise<void> {
		try {
			await this.gameAPI.initializeGame();
			this.updateInfoText('Token ready. Loading balance…');
		} catch (error) {
			console.error('[Game] Failed to initialize token:', error);
			this.updateInfoText('Token setup failed. Check console for details.');
		}

		try {
			const balance = await this.gameAPI.initializeBalance();
			this.slotController?.updateBalanceAmount(balance);
			this.updateInfoText(`Balance loaded: $${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
		} catch (error) {
			console.error('[Game] Failed to initialize balance:', error);
			this.updateInfoText('Unable to fetch balance. Please retry.');
		}
	}

	private registerUiEventListeners(): void {
		EventBus.on('menu', this.handleMenuRequest, this);
		EventBus.on('show-bet-options', this.handleBetOptionsRequest, this);
		EventBus.on('autoplay', this.handleAutoplayRequest, this);

		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			EventBus.off('menu', this.handleMenuRequest, this);
			EventBus.off('show-bet-options', this.handleBetOptionsRequest, this);
			EventBus.off('autoplay', this.handleAutoplayRequest, this);
		});
	}

	private handleMenuRequest(): void {
		this.updateInfoText('Menu button clicked – hook your menu panel here.');
	}

	private handleBetOptionsRequest(): void {
		this.updateInfoText('Bet options requested – plug in the new selector UI.');
	}

	private handleAutoplayRequest(): void {
		this.updateInfoText('Autoplay options requested – show prototype dialog here.');
	}

	private updateInfoText(message: string): void {
		if (!this.infoText) return;
		this.infoText.setText(message);
		this.tweens.add({
			targets: this.infoText,
			alpha: { from: 0.4, to: 1 },
			duration: 250,
			yoyo: true
		});
	}

	private setupRopeCable(): void {
		const width = this.scale.width;
		const height = this.scale.height;

		this.startHandle?.destroy();
		this.endHandle?.destroy();
		this.rope?.destroy();
		this.hookImage?.destroy();
		this.hookImage = undefined;

		this.startAnchor.set(width * 0.35, height * 0.45);
		this.endAnchor.set(width * 0.65, height * 0.55);

		this.rope = new RopeCable(this, {
			segmentCount: 20,
			iterations: 6,
			gravity: 2200,
			thickness: 2,
			coreThickness: 6,
			color: this.ropeStyle.color,
			coreColor: this.ropeStyle.coreColor,
			coreVisible: this.ropeStyle.outlineVisible,
			damping: this.ropeStyle.damping,
			depth: this.ropeDepth
		});

		const characterSpine = (this.background as any)?.getCharacterSpine?.();
		const useCharacterAnchor = !!characterSpine;
		if (useCharacterAnchor) {
			this.rope.setPinnedEnds(true, false);
		} else {
			this.rope.setPinnedEnds(true, true);
		}
		// Gentle horizontal swaying (wind) for dangling rope/hook
		this.rope.setWind(true, this.scale.width * 0.8, 0.35);
		if (useCharacterAnchor) {
			try {
				const spineAny: any = characterSpine;
				const skeleton: any = spineAny && spineAny.skeleton;
				if (skeleton && Array.isArray(skeleton.bones)) {
					const bones = skeleton.bones
						.map((b: any) => b?.data?.name ?? b?.name)
						.filter((n: any) => typeof n === 'string');
				}
			} catch {}
		}

		if (useCharacterAnchor) {
			this.rope.setAnchorProviders(
				() => {
					const spine: any = (this.background as any)?.getCharacterSpine?.();
					if (!spine) {
						return this.startAnchor;
					}
					let bone: any = null;
					try {
						const skeleton: any = spine && spine.skeleton;
						if (skeleton && typeof skeleton.findBone === 'function') {
							bone = skeleton.findBone(this.rodTipBoneName);
						}
					} catch {}
					if (bone) {
						try {
							const scaleX = typeof spine.scaleX === 'number' ? spine.scaleX : (typeof spine.scale === 'number' ? spine.scale : 1);
							const scaleY = typeof spine.scaleY === 'number' ? spine.scaleY : (typeof spine.scale === 'number' ? spine.scale : 1);
							const x = spine.x + bone.worldX * scaleX;
							const y = spine.y + bone.worldY * scaleY;
							return { x, y };
						} catch {}
					}
					const fallbackOffsetX = 0;
					const fallbackOffsetY = -50;
					const fx = spine.x + fallbackOffsetX;
					const fy = spine.y + fallbackOffsetY;
					return { x: fx, y: fy };
				},
				() => {
					const spine: any = (this.background as any)?.getCharacterSpine?.();
					if (!spine) {
						return this.endAnchor;
					}
					let bone: any = null;
					try {
						const skeleton: any = spine && spine.skeleton;
						if (skeleton && typeof skeleton.findBone === 'function') {
							bone = skeleton.findBone(this.rodTipBoneName);
						}
					} catch {}
					if (bone) {
						try {
							const scaleX = typeof spine.scaleX === 'number' ? spine.scaleX : (typeof spine.scale === 'number' ? spine.scale : 1);
							const scaleY = typeof spine.scaleY === 'number' ? spine.scaleY : (typeof spine.scale === 'number' ? spine.scale : 1);
							const sx = spine.x + bone.worldX * scaleX;
							const sy = spine.y + bone.worldY * scaleY;
							const ropeVisualLength = this.scale.height * 0.09;
							const ex = sx;
							const ey = sy + ropeVisualLength;
							return { x: ex, y: ey };
						} catch {}
					}
					const fallbackLength = this.scale.height * 0.25;
					const ex = spine.x;
					const ey = spine.y + fallbackLength;
					return { x: ex, y: ey };
				}
			);
		} else {
			this.rope.setAnchorProviders(
				() => this.startAnchor,
				() => this.endAnchor
			);
		}
		this.applyRopeStyle();

		if (!useCharacterAnchor) {
			this.startHandle = this.createHandle(
				this.startAnchor,
				18,
				0x4a90e2,
				0x0f1a3d,
				10
			);
			this.endHandle = this.createHandle(
				this.endAnchor,
				20,
				0xff6a2c,
				0xffffff,
				12
			);
		} else {
			this.startHandle = undefined;
			this.endHandle = undefined;
		}

		if (this.textures.exists(this.hookTextureKey) && this.rope) {
			const points = this.rope.getPoints();
			const end = points.length > 0 ? points[points.length - 1] : this.endAnchor;
			const assetScale = this.networkManager.getAssetScale();
			this.hookImage = this.add.image(end.x, end.y, this.hookTextureKey);
			this.hookImage.setOrigin(0.5, 0);
			this.hookImage.setScale(assetScale * this.hookScale);
			this.hookImage.setDepth(this.ropeDepth + 1);
		}
	}

	private createHandle(anchor: Phaser.Math.Vector2, radius: number, fillColor: number, strokeColor: number, depth: number): Phaser.GameObjects.Arc {
		const handle = this.add.circle(anchor.x, anchor.y, radius, fillColor, 0.9)
			.setStrokeStyle(3, strokeColor, 0.95)
			.setDepth(this.ropeHandleDepth + depth)
			.setInteractive({ useHandCursor: true, draggable: true });

		handle.setScrollFactor(0);

		this.input.setDraggable(handle);

		handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			const clampedX = Phaser.Math.Clamp(dragX, this.dragBoundsPadding, this.scale.width - this.dragBoundsPadding);
			const clampedY = Phaser.Math.Clamp(dragY, this.dragBoundsPadding, this.scale.height - this.dragBoundsPadding);
			anchor.set(clampedX, clampedY);
			handle.setPosition(clampedX, clampedY);
		});

		handle.on('dragstart', () => handle.setScale(1.08));
		handle.on('dragend', () => handle.setScale(1));

		this.children.bringToTop(handle);
		return handle;
	}

	private applyRopeStyle(): void {
		if (!this.rope) {
			return;
		}
		this.rope.setPrimaryColor(this.ropeStyle.color);
		this.rope.setCoreColor(this.ropeStyle.coreColor);
		this.rope.setCoreVisible(this.ropeStyle.outlineVisible);
		this.rope.setDamping(this.ropeStyle.damping);
	}

	private bringRopeToFront(): void {
		if (this.startHandle) this.children.bringToTop(this.startHandle);
		if (this.endHandle) this.children.bringToTop(this.endHandle);
		if (this.hookImage) this.children.bringToTop(this.hookImage);
	}
}
