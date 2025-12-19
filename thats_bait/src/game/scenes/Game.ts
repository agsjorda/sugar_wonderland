import Phaser from 'phaser';

import { SlotController } from '../components/SlotController';
import { Symbols } from '../components/Symbols';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { GameData } from '../components/GameData';
import { EventBus } from '../EventBus';
import { GameAPI } from '../../backend/GameAPI';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { AudioManager, MusicType } from '../../managers/AudioManager';
import { RopeCable } from '../components/RopeCable';
import { Background } from '../components/Background';
import { BonusBackground } from '../components/BonusBackground';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { AutoplayOptions } from '../components/AutoplayOptions';
import { Header } from '../components/Header';
import { WinTracker } from '../components/WinTracker';
import { FreeSpinOverlay } from '../components/FreeSpinOverlay';
import { Dialogs } from '../components/Dialogs';
import { ScatterAnimationManager } from '../../managers/ScatterAnimationManager';
import { BonusHeader } from '../components/BonusHeader';
import { GaugeMeter } from '../components/GaugeMeter';
import {
  WINTRACKER_BASE_OFFSET_X,
  WINTRACKER_BASE_OFFSET_Y,
  WINTRACKER_BONUS_OFFSET_X,
  WINTRACKER_BONUS_OFFSET_Y
} from '../../config/UIPositionConfig';

export class Game extends Phaser.Scene {
	private networkManager!: NetworkManager;
	private screenModeManager!: ScreenModeManager;
	private slotController!: SlotController;
	private infoText!: Phaser.GameObjects.Text;
	private autoplayOptions!: AutoplayOptions;
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
		damping: 0.85
	};
	private readonly ropeDepth = 890;
	private readonly ropeHandleDepth = 860;
	private readonly rodTipBoneName = 'bone59';
	private hookImage?: Phaser.GameObjects.Image;
	private readonly hookTextureKey = 'hook';
	private readonly hookScale = 0.20;
	private readonly hookTipAttachFactor: number = 0.78;
	private isHookScatterEventActive: boolean = false;
	private hookScatterPointer?: Phaser.GameObjects.Arc;
	private hookScatterTarget?: Phaser.Math.Vector2;
	private hookScatterTween?: Phaser.Tweens.Tween;
	private wasInputEnabledBeforeHookScatter: boolean = true;
	private hookPointerOffsetX: number = 0;
	private hookPointerOffsetY: number = 0;
	private wasRopeEndInitiallyPinned: boolean = true;
	private hookScatterCol: number = -1;
	private hookScatterRow: number = -1;
	private hookScatterSymbol?: any;
	private hookOffscreenOffsetY: number = 200;
	private hookOriginalDepth: number = 0;
	private hookCollectorRopeGraphics?: Phaser.GameObjects.Graphics;
	private hookCollectorRopeOriginalDepth: number = 0;
	private hookCollectorCollectorOriginalDepth: number = 0;
	private hookCollectorRaisedCollector?: any;
	private hookCollectorOverlayContainer?: Phaser.GameObjects.Container;
	private hookCollectorCollectorOriginalParent?: Phaser.GameObjects.Container;
	private hookCollectorCollectorOriginalParentIndex: number = -1;
	private hookCollectorRaisedParentContainer?: Phaser.GameObjects.Container;
	private hookCollectorParentContainerOriginalDepth: number = 0;
	private hookCollectorRaisedSymbolsContainer?: Phaser.GameObjects.Container;
	private hookCollectorSymbolsContainerOriginalDepth: number = 0;
	private hookCollectorSymbolsContainerOriginalMask?: any;
	private hookCollectorCollectorOriginalMask?: any;
	private hookCollectorRaisedDepths: boolean = false;
	private hookScatterStartTimingMultiplier: number = 0.5;
	private hookScatterEndTimingMultiplier: number = 0.35;
	private enableRope: boolean = true;
	private reelsStopListener?: (data?: any) => void;
	private winStopListener?: (data?: any) => void;
	private winTrackerHideListener?: () => void;
	private bonusOverlayQueue: Array<() => Promise<void>> = [];
	private bonusOverlayQueueRunning: boolean = false;
	private freeSpinRetriggerOverlaySeq: number = 0;
	private shownBonusRetriggerStages: Set<number> = new Set<number>();

	public readonly gameData: GameData;
	public readonly gameAPI: GameAPI;
	private background!: Background;
	private bonusBackground!: BonusBackground;
	private slotBackground?: Phaser.GameObjects.Image;
	private fullscreenBtn?: Phaser.GameObjects.Image;
	private symbols!: Symbols;
	private header!: Header;
	private bonusHeader!: BonusHeader;
	private gaugeMeter!: GaugeMeter;
	private winTracker!: WinTracker;
	private dialogs?: Dialogs;
	private freeSpinOverlay?: FreeSpinOverlay;
	private audioManager?: AudioManager;
	private readonly freeSpinRetriggerMultiplierDisplayOptions: Record<string, { offsetX?: number; offsetY?: number; scale?: number }> = {
		'2x_multiplier': { offsetX: 0, offsetY: 0, scale: 1 },
		'3x_Multiplier_TB': { offsetX: 0, offsetY: 0, scale: 1 },
		'10x_Multiplier_TB': { offsetX: 0, offsetY: 0, scale: 1 }
	};
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

		this.gaugeMeter = new GaugeMeter();
		this.gaugeMeter.create(this);
		this.gaugeMeter.setVisible(false);
		(this as any).gaugeMeter = this.gaugeMeter;

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

		this.autoplayOptions = new AutoplayOptions(this.networkManager, this.screenModeManager);
		this.autoplayOptions.create(this);

		// Create and expose the Symbols component for the base game grid
		this.symbols = new Symbols();
		(this as any).symbols = this.symbols;
		this.symbols.create(this as any);
		this.slotController.setSymbols(this.symbols);
		this.header = new Header(this.networkManager, this.screenModeManager);
		(this as any).header = this.header;
		this.header.create(this);
		this.bonusHeader = new BonusHeader(this.networkManager, this.screenModeManager);
		(this as any).bonusHeader = this.bonusHeader;
		this.bonusHeader.create(this);
		this.winTracker = new WinTracker();
		(this as any).winTracker = this.winTracker;
		this.winTracker.create(this);
		try {
			this.winTracker.setLayout({
				useAutoPosition: true,
				baseOffsetX: WINTRACKER_BASE_OFFSET_X,
				baseOffsetY: WINTRACKER_BASE_OFFSET_Y,
				bonusOffsetX: WINTRACKER_BONUS_OFFSET_X,
				bonusOffsetY: WINTRACKER_BONUS_OFFSET_Y
			});
		} catch {}
		try {
			this.dialogs = new Dialogs(this.networkManager, this.screenModeManager);
			(this as any).dialogs = this.dialogs;
			this.dialogs.create(this);
		} catch (e) {
			try { console.warn('[Game] Failed to initialize Dialogs component:', e); } catch {}
			try { (this as any).dialogs = undefined; } catch {}
		}
		try {
			this.freeSpinOverlay = (this.dialogs as any)?.getFreeSpinOverlay?.() || undefined;
			if (!this.freeSpinOverlay) {
				this.freeSpinOverlay = new FreeSpinOverlay(this, this.networkManager, this.screenModeManager);
			}
			(this as any).freeSpinOverlay = this.freeSpinOverlay;
		} catch {
			this.freeSpinOverlay = new FreeSpinOverlay(this, this.networkManager, this.screenModeManager);
			(this as any).freeSpinOverlay = this.freeSpinOverlay;
		}

		// Called when TotalWinOverlay is dismissed (triggered by BubbleOverlayTransition from TotalWinOverlay)
		this.events.on('finalizeBonusExit', () => {
			try {
				// Ensure we return to base visuals/state
				try { this.events.emit('deactivateBonusMode'); } catch {}
				try { this.events.emit('resetSymbolsForBase'); } catch {}
				try { gameEventManager.emit(GameEventType.WIN_STOP); } catch {}
				try { this.events.emit('enableSymbols'); } catch {}
				try { gameStateManager.isBonus = false; } catch {}
				try { gameStateManager.isBonusFinished = false; } catch {}
				try { gameStateManager.isShowingWinDialog = false; } catch {}
				try { gameStateManager.isHookScatterActive = false; } catch {}
				try { (this as any).isHookScatterEventActive = false; } catch {}
				try { this.input.enabled = true; } catch {}
				try { this.slotController?.setExternalControlLock(false); } catch {}
				try {
					if (this.scene.isActive('BubbleOverlayTransition') || this.scene.isSleeping('BubbleOverlayTransition')) {
						this.scene.stop('BubbleOverlayTransition');
					}
				} catch {}
			} catch {}
		});
		this.events.on('prepareBonusExit', () => {
			try {
				try { this.events.emit('deactivateBonusMode'); } catch {}
				try { this.events.emit('resetSymbolsForBase'); } catch {}
				try { gameEventManager.emit(GameEventType.WIN_STOP); } catch {}
				try { this.events.emit('enableSymbols'); } catch {}
				try { gameStateManager.isBonus = false; } catch {}
				try { gameStateManager.isBonusFinished = false; } catch {}
				try { gameStateManager.isShowingWinDialog = false; } catch {}
				try { gameStateManager.isHookScatterActive = false; } catch {}
				try { (this as any).isHookScatterEventActive = false; } catch {}
				try { this.input.enabled = true; } catch {}
				try { this.slotController?.setExternalControlLock(false); } catch {}
			} catch {}
		});
		this.events.on('bonusRetrigger', (data: any) => {
			try {
				const addedSpins = Number(data?.addedSpins) || 0;
				const totalSpins = Number(data?.totalSpins) || 0;
				const rawStage = Number(data?.stage) || 0;
				if (rawStage <= 0 || rawStage > 3) {
					return;
				}
				const stage = Math.max(1, Math.min(3, rawStage));
				try {
					if (this.shownBonusRetriggerStages.has(stage)) {
						return;
					}
				} catch {}
				let multKey: string | null = null;
				try {
					if (stage >= 3) multKey = '10x_Multiplier_TB';
					else if (stage >= 2) multKey = '3x_Multiplier_TB';
					else if (stage >= 1) multKey = '2x_multiplier';
				} catch {
					multKey = null;
				}
				if (totalSpins > 0) {
					try { this.slotController?.updateFreeSpinNumber?.(totalSpins); } catch {}
				}
				if (addedSpins > 0) {
					this.enqueueBonusOverlay(async () => {
						await this.showRetriggerOverlayFlow({ addedSpins, totalSpins, stage, multKey });
					});
				}
			} catch {}
		});
		// Initialize ScatterAnimationManager with scene and symbol container so it can drive the overlay
		try {
			const scatterManager = ScatterAnimationManager.getInstance();
			const symbolsContainer = this.symbols && this.symbols.container ? this.symbols.container : this.add.container(0, 0);
			// Spinner and dialogs are not used for the new mechanic; pass a hidden dummy container for spinner
			const dummySpinner = this.add.container(0, 0);
			dummySpinner.setVisible(false);
			scatterManager.initialize(this, symbolsContainer, dummySpinner, undefined, undefined, undefined, this.freeSpinOverlay);
		} catch {}

		// Create rope and draggable handles after the main UI so they sit on top visually.
		if (this.enableRope) {
			this.setupRopeCable();
			this.bringRopeToFront();
		}
		void this.initializeTokenAndBalance();

		this.registerUiEventListeners();
		this.events.on('hook-scatter', this.handleHookScatter, this);
		this.events.on('hook-collector', this.handleHookCollector, this);
		this.registerBonusUiEventListeners();
		try {
			this.audioManager = new AudioManager(this);
			(this as any).audioManager = this.audioManager;
			(window as any).audioManager = this.audioManager;
			this.audioManager.createMusicInstances();
			try {
				this.input.once('pointerdown', () => {
					try { this.audioManager?.playBackgroundMusic(MusicType.MAIN); } catch {}
				});
			} catch {}
		} catch {}

		// Let any downstream listeners know the simple scene is ready.
		gameEventManager.emit(GameEventType.START);
	}

	private registerBonusUiEventListeners(): void {
		this.events.on('showBonusBackground', () => {
			try { this.bonusBackground?.setVisible(true); } catch {}
			try { this.background?.setVisible(false); } catch {}
			try { this.gaugeMeter?.setVisible(true); } catch {}
		});
		this.events.on('hideBonusBackground', () => {
			try { this.bonusBackground?.setVisible(false); } catch {}
			try { this.background?.setVisible(true); } catch {}
			try { this.gaugeMeter?.setVisible(false); } catch {}
		});
		this.events.on('showBonusHeader', () => {
			try { this.bonusHeader?.setVisible(true); } catch {}
			try { this.header?.getContainer()?.setVisible(false); } catch {}
		});
		this.events.on('hideBonusHeader', () => {
			try { this.bonusHeader?.setVisible(false); } catch {}
			try { this.header?.getContainer()?.setVisible(true); } catch {}
		});
		this.events.on('activateBonusMode', () => {
			try { this.events.emit('setBonusMode', true); } catch {}
			try { this.events.emit('showBonusBackground'); } catch {}
			try { this.events.emit('showBonusHeader'); } catch {}
			try { this.events.emit('enableSymbols'); } catch {}
			try { this.freeSpinRetriggerOverlaySeq = 0; } catch {}
			try { this.shownBonusRetriggerStages.clear(); } catch {}
		});
		this.events.on('deactivateBonusMode', () => {
			try { this.events.emit('setBonusMode', false); } catch {}
			try { this.events.emit('hideBonusBackground'); } catch {}
			try { this.events.emit('hideBonusHeader'); } catch {}
		});
	}

	private enqueueBonusOverlay(fn: () => Promise<void>): void {
		try {
			this.bonusOverlayQueue.push(fn);
		} catch {
			return;
		}
		if (this.bonusOverlayQueueRunning) return;
		this.bonusOverlayQueueRunning = true;
		void this.runBonusOverlayQueue();
	}

	private runWithTimeout(p: Promise<void>, timeoutMs: number): Promise<void> {
		return new Promise<void>((resolve) => {
			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				resolve();
			};
			let t: any = null;
			try { t = setTimeout(() => finish(), Math.max(0, (Number(timeoutMs) || 0) | 0)); } catch {}
			Promise.resolve(p).then(() => {
				try { if (t) clearTimeout(t); } catch {}
				finish();
			}).catch(() => {
				try { if (t) clearTimeout(t); } catch {}
				finish();
			});
		});
	}

	private async runBonusOverlayQueue(): Promise<void> {
		try {
			while (this.bonusOverlayQueue.length > 0) {
				const fn = this.bonusOverlayQueue.shift();
				if (!fn) continue;
				try {
					await this.runWithTimeout(Promise.resolve(fn()), 15000);
				} catch {}
				await new Promise<void>((resolve) => {
					try { this.time.delayedCall(0, () => resolve()); } catch { resolve(); }
				});
			}
		} finally {
			this.bonusOverlayQueueRunning = false;
		}
	}

	private async showRetriggerOverlayFlow(data: { addedSpins: number; totalSpins: number; stage: number; multKey: string | null }): Promise<void> {
		const stage = Math.max(1, Math.min(3, Number((data as any)?.stage) || 0));
		try {
			if (this.shownBonusRetriggerStages.has(stage)) {
				return;
			}
			this.shownBonusRetriggerStages.add(stage);
		} catch {}

		// If a win dialog is currently up, wait for it to close before showing retrigger overlay.
		try {
			const dlg: any = this.dialogs as any;
			const shouldWait = !!(dlg && typeof dlg.isDialogShowing === 'function' && dlg.isDialogShowing());
			if (shouldWait) {
				await new Promise<void>((resolve) => {
					let done = false;
					const finish = () => {
						if (done) return;
						done = true;
						try { gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, finish as any); } catch {}
						resolve();
					};
					try { gameEventManager.once(GameEventType.WIN_DIALOG_CLOSED, finish as any); } catch {}
					try { this.time.delayedCall(4500, () => finish()); } catch { try { setTimeout(() => finish(), 4500); } catch { finish(); } }
				});
			}
		} catch {}

		// Ensure we don't show the retrigger overlay while reels are still animating.
		// This prevents the "symbols still spinning behind overlay" effect.
		try {
			if (gameStateManager.isReelSpinning) {
				try { (this as any)?.symbols?.requestSkipReelDrops?.(); } catch {}
				await new Promise<void>((resolve) => {
					let done = false;
					const finish = () => {
						if (done) return;
						done = true;
						try { gameEventManager.off(GameEventType.REELS_STOP, finish as any); } catch {}
						resolve();
					};
					try { gameEventManager.once(GameEventType.REELS_STOP, finish as any); } catch {}
					try { this.time.delayedCall(1600, () => finish()); } catch { try { setTimeout(() => finish(), 1600); } catch { finish(); } }
				});
			}
		} catch {}

		const overlayId = (Number(this.freeSpinRetriggerOverlaySeq) || 0) + 1;
		this.freeSpinRetriggerOverlaySeq = overlayId;
		await new Promise<void>((resolve) => {
			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				resolve();
			};
			const onClosed = (id?: any) => {
				try { if (Number(id) !== overlayId) return; } catch {}
				try { gameStateManager.isShowingWinDialog = false; } catch {}
				finish();
			};
			try { this.events.once('freeSpinRetriggerOverlayClosed', onClosed); } catch {}
			try {
				if (this.dialogs && typeof (this.dialogs as any).showFreeSpinRetriggerOverlay === 'function') {
					(this.dialogs as any).showFreeSpinRetriggerOverlay({
						overlayId,
						spinsLeft: Number(data?.totalSpins) || 0,
						multiplierKey: data?.multKey ?? null,
						multiplierOptionsByKey: this.freeSpinRetriggerMultiplierDisplayOptions
					}).then(() => finish()).catch(() => finish());
				} else {
					finish();
				}
			} catch {
				finish();
			}
		});
	}

	public updateGaugeMeterModifiers(mods: { offsetX?: number; offsetY?: number; spacingX?: number; barThickness?: number; indicatorOffsetX?: number; indicatorOffsetY?: number; indicatorScale?: number; indicatorIntroDuration?: number; stage1OffsetX?: number; stage1OffsetY?: number; stage1Scale?: number; stage1Gap?: number; stage1ShadowOffsetX?: number; stage1ShadowOffsetY?: number; stage1ShadowAlpha?: number; stage1ShadowScale?: number; stage1GlowTint?: number; stage1GlowAlpha?: number; stage1GlowScale?: number; stage1GlowDuration?: number; stage1UnlockDuration?: number; stage1UnlockYOffset?: number; stage1FloatAmplitude?: number; stage1FloatDuration?: number; scale?: number; depth?: number }): void {
		try { (this.gaugeMeter as any)?.updateModifiers(mods); } catch {}
	}

	private getActiveCharacterSpine(): any | undefined {
		try {
			const bonusVisible = !!(this.bonusBackground as any)?.getContainer?.()?.visible;
			if (bonusVisible) {
				return (this.bonusBackground as any)?.getCharacterSpine?.() || (this.background as any)?.getCharacterSpine?.();
			}
		} catch {}
		try {
			return (this.background as any)?.getCharacterSpine?.() || (this.bonusBackground as any)?.getCharacterSpine?.();
		} catch {}
		return undefined;
	}

	private createBackground(): void {
		this.background = new Background(this.networkManager, this.screenModeManager);
		this.background.create(this);
		this.bonusBackground = new BonusBackground(this.networkManager, this.screenModeManager);
		this.bonusBackground.create(this);
		this.bonusBackground.setVisible(false);
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
		bg.setDepth(892);
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
		if (!this.enableRope) {
			return;
		}
		this.rope?.update(delta);
		if (this.rope && this.hookImage) {
			const ropeAny: any = this.rope as any;
			const points: Phaser.Math.Vector2[] = typeof ropeAny.getRenderedPoints === 'function'
				? ropeAny.getRenderedPoints()
				: this.rope.getPoints();
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
		if (this.hookImage && (this.background as any)?.updateHookSurfaceInteraction) {
			try {
				(this.background as any).updateHookSurfaceInteraction(this.hookImage.x, this.hookImage.y);
			} catch {}
		}
	}

	private handleHookScatter(worldX: number, worldY: number, col?: number, row?: number): void {
		if (!this.rope || !this.hookImage) {
			return;
		}
		if (this.isHookScatterEventActive) {
			return;
		}
		if (typeof col !== 'number' || typeof row !== 'number') {
			return;
		}
		this.hookScatterCol = col;
		this.hookScatterRow = row;
	
		this.isHookScatterEventActive = true;
		gameStateManager.isHookScatterActive = true;
		this.wasInputEnabledBeforeHookScatter = this.input.enabled;
		this.input.enabled = false;
		try {
			this.slotController?.setExternalControlLock(true);
		} catch {}

		const pointerX = worldX;
		const pointerY = worldY;
		const offscreenX = pointerX;
		const offscreenY = this.scale.height + this.hookOffscreenOffsetY;

		try { this.hookScatterPointer?.destroy(); } catch {}
		this.hookScatterPointer = undefined;

		const points = this.rope.getPoints();
		const count = points.length;
		const end = count > 0 ? points[count - 1] : this.endAnchor;
		this.hookScatterTarget = new Phaser.Math.Vector2(end.x, end.y);
	
		this.rope.setCurveAmount(1);

		if (this.hookImage) {
			this.hookOriginalDepth = this.hookImage.depth;
			const characterSpine: any = (this.background as any)?.getCharacterSpine?.();
			const characterDepth = typeof characterSpine?.depth === 'number' ? characterSpine.depth : this.hookOriginalDepth;
			this.hookImage.setDepth(891);
		}
		this.startHookScatterWithCharacter(pointerX, pointerY, offscreenX, offscreenY);
	}

	private handleHookCollector(worldX: number, worldY: number, col?: number, row?: number): void {
		if (!this.rope || !this.hookImage) {
			try { this.events.emit('hook-collector-complete'); } catch {}
			return;
		}
		if (this.isHookScatterEventActive) {
			try { this.events.emit('hook-collector-complete'); } catch {}
			return;
		}
		if (typeof col !== 'number' || typeof row !== 'number') {
			try { this.events.emit('hook-collector-complete'); } catch {}
			return;
		}

		this.hookScatterCol = col;
		this.hookScatterRow = row;

		this.isHookScatterEventActive = true;
		gameStateManager.isHookScatterActive = true;
		this.wasInputEnabledBeforeHookScatter = this.input.enabled;
		this.input.enabled = false;
		try {
			this.slotController?.setExternalControlLock(true);
		} catch {}

		let collectorObj: any = null;
		let centerX = worldX;
		let centerY = worldY;
		try {
			const grid: any[][] = (this.symbols as any)?.symbols;
			collectorObj = grid && grid[col] ? grid[col][row] : null;
			this.hookScatterSymbol = collectorObj;
			if (collectorObj && typeof collectorObj.getBounds === 'function') {
				const b = collectorObj.getBounds();
				centerX = b.centerX;
				centerY = b.centerY;
			} else if (collectorObj && typeof collectorObj.x === 'number' && typeof collectorObj.y === 'number') {
				let px = collectorObj.x;
				let py = collectorObj.y;
				try {
					const parent: any = collectorObj.parentContainer;
					if (parent) {
						px = (parent.x ?? 0) + px;
						py = (parent.y ?? 0) + py;
					}
				} catch {}
				centerX = px;
				centerY = py;
			}
		} catch {}

		let hookTipOffsetY = 0;
		try {
			const h = (this.hookImage?.displayHeight ?? 0) as number;
			if (isFinite(h) && h > 0) {
				hookTipOffsetY = h * (this.hookTipAttachFactor || 0.78);
			}
		} catch {}

		const pointerX = centerX + this.hookPointerOffsetX;
		const pointerY = centerY - hookTipOffsetY + this.hookPointerOffsetY;

		const points = this.rope.getPoints();
		const count = points.length;
		const end = count > 0 ? points[count - 1] : this.endAnchor;
		const homeX = end.x;
		const homeY = end.y;
		this.hookScatterTarget = new Phaser.Math.Vector2(homeX, homeY);

		this.rope.setCurveAmount(1);

		if (this.hookImage) {
			this.hookOriginalDepth = this.hookImage.depth;
		}
		this.raiseHookCollectorDepths(collectorObj);

		this.startHookCollectorWithCharacter(pointerX, pointerY, homeX, homeY);
	}

	private raiseHookCollectorDepths(collectorObj: any): void {
		if (this.hookCollectorRaisedDepths) return;
		this.hookCollectorRaisedDepths = true;
		try {
			const existing: any = this.hookCollectorOverlayContainer as any;
			if (!existing || existing.destroyed) {
				this.hookCollectorOverlayContainer = this.add.container(0, 0);
				try { this.hookCollectorOverlayContainer.setScrollFactor(0); } catch {}
			}
			try {
				this.hookCollectorOverlayContainer?.setDepth(20000);
				if (this.hookCollectorOverlayContainer) {
					try { this.children.bringToTop(this.hookCollectorOverlayContainer); } catch {}
				}
			} catch {}
		} catch {}
		try {
			const ropeAny: any = this.rope as any;
			const g: any = ropeAny?.ropeGraphics || ropeAny?.options?.graphics;
			if (g && typeof g.setDepth === 'function') {
				this.hookCollectorRopeGraphics = g as any;
				this.hookCollectorRopeOriginalDepth = typeof g.depth === 'number' ? g.depth : 0;
				g.setDepth(20006);
				try { this.children.bringToTop(g); } catch {}
			}
		} catch {}
		try {
			if (this.hookImage) {
				this.hookImage.setDepth(20008);
				try { this.children.bringToTop(this.hookImage); } catch {}
			}
		} catch {}
		try {
			if (collectorObj && typeof collectorObj.setDepth === 'function') {
				this.hookCollectorRaisedCollector = collectorObj;
				this.hookCollectorCollectorOriginalDepth = typeof collectorObj.depth === 'number' ? collectorObj.depth : 0;
				try {
					this.hookCollectorCollectorOriginalMask = (collectorObj as any).mask;
					if (typeof (collectorObj as any).setMask === 'function') {
						(collectorObj as any).setMask(null);
					}
				} catch {}
				collectorObj.setDepth(20004);
				try { this.children.bringToTop(collectorObj); } catch {}
			}
		} catch {}
		try {
			const overlay = this.hookCollectorOverlayContainer;
			const parent: any = collectorObj?.parentContainer;
			if (collectorObj && overlay && parent && parent !== overlay) {
				this.hookCollectorCollectorOriginalParent = parent as Phaser.GameObjects.Container;
				try {
					const list: any[] = Array.isArray((parent as any).list) ? (parent as any).list : [];
					this.hookCollectorCollectorOriginalParentIndex = list.indexOf(collectorObj);
				} catch {
					this.hookCollectorCollectorOriginalParentIndex = -1;
				}

				let wx = (collectorObj?.x ?? 0) as number;
				let wy = (collectorObj?.y ?? 0) as number;
				try {
					if (typeof collectorObj.getBounds === 'function') {
						const b = collectorObj.getBounds();
						wx = b.centerX;
						wy = b.centerY;
					}
				} catch {}

				try { (parent as any).remove?.(collectorObj); } catch {}
				try { overlay.add(collectorObj); } catch {}
				try { collectorObj.x = wx; collectorObj.y = wy; } catch {}
			}
		} catch {}
		try {
			let parent: any = collectorObj?.parentContainer;
			try {
				while (parent && parent.parentContainer) {
					parent = parent.parentContainer;
				}
			} catch {}
			try {
				const symbolsContainer: any = (this.symbols as any)?.container;
				if (symbolsContainer && parent === symbolsContainer) {
					return;
				}
			} catch {}
			if (parent && typeof parent.setDepth === 'function') {
				this.hookCollectorRaisedParentContainer = parent;
				this.hookCollectorParentContainerOriginalDepth = typeof parent.depth === 'number' ? parent.depth : 0;
				parent.setDepth(20000);
				try { this.children.bringToTop(parent); } catch {}
				try { parent.bringToTop?.(collectorObj); } catch {}
			}
		} catch {}
	}

	private restoreHookCollectorDepths(): void {
		if (!this.hookCollectorRaisedDepths) return;
		this.hookCollectorRaisedDepths = false;
		try {
			if (this.hookCollectorRaisedSymbolsContainer) {
				try {
					if (typeof (this.hookCollectorRaisedSymbolsContainer as any).setMask === 'function') {
						(this.hookCollectorRaisedSymbolsContainer as any).setMask(this.hookCollectorSymbolsContainerOriginalMask ?? null);
					}
				} catch {}
				this.hookCollectorRaisedSymbolsContainer.setDepth(this.hookCollectorSymbolsContainerOriginalDepth);
			}
		} catch {}
		this.hookCollectorSymbolsContainerOriginalMask = undefined;
		this.hookCollectorRaisedSymbolsContainer = undefined;
		try {
			if (this.hookCollectorRopeGraphics) {
				this.hookCollectorRopeGraphics.setDepth(this.hookCollectorRopeOriginalDepth);
			}
		} catch {}
		this.hookCollectorRopeGraphics = undefined;
		try {
			const collectorObj: any = this.hookCollectorRaisedCollector;
			const originalParent: any = this.hookCollectorCollectorOriginalParent;
			const overlay: any = this.hookCollectorOverlayContainer;
			const idx = this.hookCollectorCollectorOriginalParentIndex;
			const wasCollected = !!(collectorObj as any)?.__collectedByHook;
			if (wasCollected) {
				try { overlay?.remove?.(collectorObj); } catch {}
				try { collectorObj?.destroy?.(); } catch {}
				try { if (this.hookScatterSymbol === collectorObj) this.hookScatterSymbol = undefined; } catch {}
			} else if (collectorObj && originalParent && overlay && collectorObj.parentContainer === overlay) {
				let wx = (collectorObj?.x ?? 0) as number;
				let wy = (collectorObj?.y ?? 0) as number;
				try {
					if (typeof collectorObj.getBounds === 'function') {
						const b = collectorObj.getBounds();
						wx = b.centerX;
						wy = b.centerY;
					}
				} catch {}
				try { overlay.remove?.(collectorObj); } catch {}
				try {
					if (typeof originalParent.addAt === 'function' && typeof idx === 'number' && idx >= 0) {
						originalParent.addAt(collectorObj, idx);
					} else {
						originalParent.add(collectorObj);
					}
				} catch {}
				try {
					if (typeof originalParent.getWorldTransformMatrix === 'function') {
						const m: any = originalParent.getWorldTransformMatrix();
						if (m && typeof m.applyInverse === 'function') {
							const pt: any = m.applyInverse(wx, wy);
							collectorObj.x = pt.x;
							collectorObj.y = pt.y;
						} else {
							collectorObj.x = wx - (originalParent.x ?? 0);
							collectorObj.y = wy - (originalParent.y ?? 0);
						}
					} else {
						collectorObj.x = wx - (originalParent.x ?? 0);
						collectorObj.y = wy - (originalParent.y ?? 0);
					}
				} catch {}
			}
		} catch {}
		this.hookCollectorCollectorOriginalParent = undefined;
		this.hookCollectorCollectorOriginalParentIndex = -1;
		try {
			if (this.hookCollectorRaisedCollector && typeof this.hookCollectorRaisedCollector.setDepth === 'function') {
				try {
					if (typeof (this.hookCollectorRaisedCollector as any).setMask === 'function') {
						(this.hookCollectorRaisedCollector as any).setMask(this.hookCollectorCollectorOriginalMask ?? null);
					}
				} catch {}
				this.hookCollectorRaisedCollector.setDepth(this.hookCollectorCollectorOriginalDepth);
			}
		} catch {}
		this.hookCollectorCollectorOriginalMask = undefined;
		this.hookCollectorRaisedCollector = undefined;
		try {
			if (this.hookCollectorRaisedParentContainer) {
				this.hookCollectorRaisedParentContainer.setDepth(this.hookCollectorParentContainerOriginalDepth);
			}
		} catch {}
		this.hookCollectorRaisedParentContainer = undefined;
	}

	private getHookCollectorSpeedMultiplier(): number {
		let m = 1;
		try {
			if (gameStateManager.isBonus) {
				m *= 0.85;
			}
		} catch {}
		try {
			if (gameStateManager.isTurbo) {
				m *= 0.75;
			}
		} catch {}
		return Math.max(0.25, m);
	}

	private scaleHookCollectorMs(baseMs: number, minMs: number): number {
		try {
			const m = this.getHookCollectorSpeedMultiplier();
			return Math.max(minMs, Math.round((Number(baseMs) || 0) * m));
		} catch {
			return Math.max(minMs, Number(baseMs) || minMs);
		}
	}

	private startHookCollectorWithCharacter(pointerX: number, pointerY: number, homeX: number, homeY: number): void {
		const hookToCollector = () => {
			if (!this.isHookScatterEventActive || !this.rope) {
				try { this.completeHookCollectorEvent(); } catch {}
				return;
			}
			try {
				const points = this.rope.getPoints();
				const count = points.length;
				if (count > 0) {
					const endPoint = points[count - 1];
					if (this.hookScatterTarget) {
						this.hookScatterTarget.set(endPoint.x, endPoint.y);
					} else {
						this.hookScatterTarget = new Phaser.Math.Vector2(endPoint.x, endPoint.y);
					}
				}
			} catch {}
			if (!this.hookScatterTarget) {
				try { this.completeHookCollectorEvent(); } catch {}
				return;
			}
			this.rope.setPinnedEnds(true, true);
			this.hookScatterTween = this.tweens.add({
				targets: this.hookScatterTarget,
				x: pointerX,
				y: pointerY,
				duration: this.scaleHookCollectorMs(1000, 260),
				ease: 'Sine.easeIn',
				onComplete: () => {
					try {
						if (this.hookScatterTarget) {
							this.hookScatterTarget.set(pointerX, pointerY);
						}
					} catch {}
					try {
						this.time.delayedCall(this.scaleHookCollectorMs(120, 50), () => {
							if (!this.isHookScatterEventActive) {
								try { this.completeHookCollectorEvent(); } catch {}
								return;
							}
							this.handleHookCollectorPullWithCharacter(homeX, homeY);
						});
					} catch {
						this.handleHookCollectorPullWithCharacter(homeX, homeY);
					}
				}
			});
		};
		this.playCharacterStartThenMiddle(hookToCollector);
	}

	private handleHookCollectorPullWithCharacter(homeX: number, homeY: number): void {
		const pullHook = () => {
			if (!this.isHookScatterEventActive) {
				try { this.completeHookCollectorEvent(); } catch {}
				return;
			}
			this.startHookCollectorReturnSequence(homeX, homeY);
		};
		this.playCharacterEndThenIdle(pullHook);
	}

	private startHookCollectorReturnSequence(homeX: number, homeY: number): void {
		if (!this.rope || !this.hookScatterTarget) {
			this.completeHookCollectorEvent();
			return;
		}

		const curveProxy = { value: 1 };
		this.tweens.add({
			targets: curveProxy,
			value: 0,
			duration: this.scaleHookCollectorMs(420, 160),
			ease: 'Sine.easeInOut',
			onUpdate: () => {
				if (this.rope) {
					this.rope.setCurveAmount(curveProxy.value);
				}
			}
		});

		let collectorObj: any = null;
		try {
			const grid: any[][] = this.symbols?.symbols;
			const col = this.hookScatterCol;
			const row = this.hookScatterRow;
			collectorObj = grid && grid[col] ? grid[col][row] : null;
			if (collectorObj) {
				this.hookScatterSymbol = collectorObj;
			}
		} catch {}

		const setCollectorWorldPos = (wx: number, wy: number) => {
			if (!collectorObj) return;
			try {
				const parent: any = collectorObj.parentContainer;
				if (parent && typeof parent.getWorldTransformMatrix === 'function') {
					let m: any = null;
					try { m = parent.getWorldTransformMatrix(); } catch {}
					if (m && typeof m.applyInverse === 'function') {
						const pt: any = m.applyInverse(wx, wy);
						collectorObj.x = pt.x;
						collectorObj.y = pt.y;
						return;
					}
					if (m && typeof m.clone === 'function' && typeof m.transformPoint === 'function') {
						try {
							const inv = m.clone();
							if (inv && typeof inv.invert === 'function') {
								inv.invert();
								const p = inv.transformPoint(wx, wy);
								collectorObj.x = p.x;
								collectorObj.y = p.y;
								return;
							}
						} catch {}
					}
				}
			} catch {}
			try {
				const parent: any = collectorObj.parentContainer;
				if (parent) {
					const psx = parent && typeof parent.scaleX === 'number' && isFinite(parent.scaleX) && parent.scaleX !== 0 ? parent.scaleX : 1;
					const psy = parent && typeof parent.scaleY === 'number' && isFinite(parent.scaleY) && parent.scaleY !== 0 ? parent.scaleY : 1;
					collectorObj.x = (wx - (parent.x ?? 0)) / psx;
					collectorObj.y = (wy - (parent.y ?? 0)) / psy;
					return;
				}
			} catch {}
			collectorObj.x = wx;
			collectorObj.y = wy;
		};

		this.hookScatterTween = this.tweens.add({
			targets: this.hookScatterTarget,
			x: homeX,
			y: homeY,
			duration: this.scaleHookCollectorMs(1000, 260),
			ease: 'Sine.easeOut',
			onUpdate: () => {
				try {
					if (this.hookScatterTarget) {
						setCollectorWorldPos(this.hookScatterTarget.x, this.hookScatterTarget.y);
					}
				} catch {}
			},
			onComplete: () => {
				try {
					if (this.hookScatterTarget) {
						setCollectorWorldPos(this.hookScatterTarget.x, this.hookScatterTarget.y);
					}
				} catch {}
				try {
					const p = this.playCollectorDisintegrateToLevel1();
					if (p && typeof (p as any).then === 'function') {
						Promise.resolve(p).then(() => {
							this.completeHookCollectorEvent();
						}).catch(() => {
							this.completeHookCollectorEvent();
						});
						return;
					}
				} catch {}
				this.completeHookCollectorEvent();
			}
		});
	}

	private playCollectorDisintegrateToLevel1(): Promise<void> {
		return new Promise<void>((resolve) => {
			const gm: any = (this as any)?.gaugeMeter;
			let bonusVisible = false;
			try {
				bonusVisible = !!(this.bonusBackground as any)?.getContainer?.()?.visible;
			} catch {}
			if (!bonusVisible) {
				resolve();
				return;
			}
			const target = gm && typeof gm.getActiveLevelWorldPosition === 'function'
				? gm.getActiveLevelWorldPosition()
				: (gm && typeof gm.getLevel1WorldPosition === 'function' ? gm.getLevel1WorldPosition() : undefined);
			if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
				resolve();
				return;
			}

			let finished = false;
			let incremented = false;
			const complete = () => {
				if (finished) {
					return;
				}
				if (!incremented) {
					incremented = true;
					let p: any = undefined;
					try {
						if (gm && typeof gm.incrementActiveStageProgress === 'function') {
							p = gm.incrementActiveStageProgress();
						} else if (gm && typeof gm.incrementStage1Progress === 'function') {
							p = gm.incrementStage1Progress();
						}
					} catch {}
					if (p && typeof p.then === 'function') {
						Promise.resolve(p).then(() => {
							if (!finished) {
								finished = true;
								resolve();
							}
						}).catch(() => {
							if (!finished) {
								finished = true;
								resolve();
							}
						});
						return;
					}
				}
				finished = true;
				resolve();
			};

			const collectorObj: any = this.hookScatterSymbol;
			try {
				const col = this.hookScatterCol;
				const row = this.hookScatterRow;
				const grid: any[][] = (this.symbols as any)?.symbols;
				const symbolsContainer: any = (this.symbols as any)?.container;
				if (grid && grid[col] && grid[col][row] === collectorObj) {
					let w = (collectorObj?.displayWidth ?? (this.symbols as any)?.displayWidth ?? 1) as number;
					let h = (collectorObj?.displayHeight ?? (this.symbols as any)?.displayHeight ?? 1) as number;
					if (!isFinite(w) || w <= 0) w = 1;
					if (!isFinite(h) || h <= 0) h = 1;
					let lx = (collectorObj?.x ?? 0) as number;
					let ly = (collectorObj?.y ?? 0) as number;
					try {
						if (typeof collectorObj.getBounds === 'function') {
							const b = collectorObj.getBounds();
							lx = b.centerX;
							ly = b.centerY;
						}
					} catch {}
					let px = lx;
					let py = ly;
					try {
						if (symbolsContainer && typeof symbolsContainer.getWorldTransformMatrix === 'function') {
							const m: any = symbolsContainer.getWorldTransformMatrix();
							if (m && typeof m.applyInverse === 'function') {
								const pt: any = m.applyInverse(lx, ly);
								px = pt.x;
								py = pt.y;
							} else {
								px = lx - (symbolsContainer.x ?? 0);
								py = ly - (symbolsContainer.y ?? 0);
							}
						}
					} catch {}
					const placeholder: any = this.add.zone(px, py, w, h);
					try { placeholder.setVisible(false); } catch {}
					try { placeholder.setAlpha(0); } catch {}
					try { placeholder.setDepth((collectorObj?.depth ?? 0) as number); } catch {}
					try { (placeholder as any).__isCollectorPlaceholder = true; } catch {}
					try { symbolsContainer?.add?.(placeholder); } catch {}
					grid[col][row] = placeholder;
					try { (collectorObj as any).__collectedByHook = true; } catch {}
				}
			} catch {}
			let sx = 0;
			let sy = 0;
			try {
				if (collectorObj && typeof collectorObj.getBounds === 'function') {
					const b = collectorObj.getBounds();
					sx = b.centerX;
					sy = b.centerY;
				} else if (collectorObj && typeof collectorObj.x === 'number' && typeof collectorObj.y === 'number') {
					sx = collectorObj.x;
					sy = collectorObj.y;
				}
			} catch {}
			if (!isFinite(sx) || !isFinite(sy)) {
				resolve();
				return;
			}

			try {
				if (collectorObj) {
					this.tweens.killTweensOf(collectorObj);
					try { collectorObj.setVisible(false); } catch { try { collectorObj.visible = false; } catch {} }
					try { collectorObj.setAlpha(0); } catch { try { collectorObj.alpha = 0; } catch {} }
				}
			} catch {}

			const count = 14;
			let done = 0;
			const finish = () => {
				done += 1;
				if (done >= count) {
					complete();
				}
			};

			for (let i = 0; i < count; i++) {
				let star: Phaser.GameObjects.Arc | undefined;
				try {
					const ox = (Math.random() - 0.5) * 40;
					const oy = (Math.random() - 0.5) * 40;
					const r = 2 + Math.random() * 2;
					star = this.add.circle(sx + ox, sy + oy, r, 0xffffff, 1);
					star.setDepth(960);
					star.setAlpha(0.95);
				} catch {
					finish();
					continue;
				}

				try {
					this.tweens.add({
						targets: star,
						x: target.x,
						y: target.y,
						scale: 0.2,
						alpha: 0,
						duration: 420 + Math.floor(Math.random() * 160),
						ease: 'Sine.easeIn',
						onComplete: () => {
							try { star?.destroy(); } catch {}
							finish();
						}
					});
				} catch {
					try { star?.destroy(); } catch {}
					finish();
				}
			}

			try {
				this.time.delayedCall(900, () => {
					complete();
				});
			} catch {}
		});
	}

	private completeHookCollectorEvent(): void {
		try {
			this.completeHookScatterEvent();
		} catch {
			try {
				this.isHookScatterEventActive = false;
				gameStateManager.isHookScatterActive = false;
			} catch {}
		}
		try { this.events.emit('hook-collector-complete'); } catch {}
	}

	private startHookScatterWithCharacter(pointerX: number, pointerY: number, offscreenX: number, offscreenY: number): void {
		const throwHook = () => {
			if (!this.isHookScatterEventActive || !this.rope) {
				return;
			}
			try {
				const points = this.rope.getPoints();
				const count = points.length;
				if (count > 0) {
					const endPoint = points[count - 1];
					if (this.hookScatterTarget) {
						this.hookScatterTarget.set(endPoint.x, endPoint.y);
					} else {
						this.hookScatterTarget = new Phaser.Math.Vector2(endPoint.x, endPoint.y);
					}
				}
			} catch {}
			if (!this.hookScatterTarget) {
				return;
			}
			this.rope.setPinnedEnds(true, true);
			this.hookScatterTween = this.tweens.add({
				targets: this.hookScatterTarget,
				x: offscreenX,
				y: offscreenY,
				duration: 420,
				ease: 'Sine.easeIn',
				onComplete: () => {
					this.handleHookReturnWithCharacter(pointerX, pointerY);
				}
			});
		};
		this.playCharacterStartThenMiddle(throwHook);
	}

	private handleHookReturnWithCharacter(pointerX: number, pointerY: number): void {
		const pullHook = () => {
			if (!this.isHookScatterEventActive) {
				return;
			}
			this.startHookReturnSequence(pointerX, pointerY);
		};
		this.playCharacterEndThenIdle(pullHook);
	}

	private playCharacterStartThenMiddle(onReady: () => void): void {
		try {
			const spine: any = this.getActiveCharacterSpine();
			if (!spine || !spine.skeleton || !spine.animationState) {
				onReady();
				return;
			}
			const data: any = spine.skeleton.data;
			const animations: any[] = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
			const hasAnim = (name: string): boolean => {
				if (!name) return false;
				try {
					if (typeof data.findAnimation === 'function') {
						return !!data.findAnimation(name);
					}
				} catch {}
				return Array.isArray(animations) && animations.some(a => a && a.name === name);
			};
			const state: any = spine.animationState;
			const startName = hasAnim('Character_TB_start') ? 'Character_TB_start' : null;
			let middleName: string | null = null;
			if (Array.isArray(animations) && animations.length > 0) {
				const preferred = ['Character_TB_middle', 'Character_TB_idle', 'idle', 'Idle', 'IDLE', 'animation', 'Animation'];
				const found = preferred.find(n => hasAnim(n));
				middleName = found ?? (animations[0].name || null);
			}
			if (!startName) {
				// No dedicated start animation: jump straight to middle and trigger the hook.
				if (middleName) {
					try { state.setAnimation(0, middleName, true); } catch {}
				}
				onReady();
				return;
			}
			let entry: any = null;
			try {
				entry = state.setAnimation(0, startName, false);
			} catch {
				// If we cannot play _start, fall back to middle + immediate hook.
				if (middleName) {
					try { state.setAnimation(0, middleName, true); } catch {}
				}
				onReady();
				return;
			}
			// Chain _middle (or idle) to start immediately after _start using Spine's queue.
			if (middleName) {
				try { state.addAnimation(0, middleName, true, 0); } catch {}
			}
			let onReadyCalled = false;
			const fireOnReady = () => {
				if (onReadyCalled) return;
				onReadyCalled = true;
				onReady();
			};
			try {
				const stateAny: any = state;
				const rawDurationSec = Math.max(0.05, entry?.animation?.duration || 0.8);
				const timeScale = Math.max(0.0001, stateAny.timeScale || 1);
				// When the hook throw actually starts, somewhere inside the _start clip.
				const factorValue = typeof this.hookScatterStartTimingMultiplier === 'number' ? this.hookScatterStartTimingMultiplier : 1;
				const factor = factorValue < 0 ? 0 : factorValue;
				const throwDelayMs = (rawDurationSec * factor / timeScale) * 1000;
				this.time.delayedCall(throwDelayMs, () => fireOnReady());
			} catch {
				const factorValue = typeof this.hookScatterStartTimingMultiplier === 'number' ? this.hookScatterStartTimingMultiplier : 1;
				const factor = factorValue < 0 ? 0 : factorValue;
				this.time.delayedCall(800 * (factor || 1), () => fireOnReady());
			}
		} catch {
			onReady();
		}
	}

	private playCharacterEndThenIdle(onReady: () => void): void {
		try {
			const spine: any = this.getActiveCharacterSpine();
			if (!spine || !spine.skeleton || !spine.animationState) {
				onReady();
				return;
			}
			const data: any = spine.skeleton.data;
			const animations: any[] = (data && Array.isArray(data.animations)) ? data.animations : (data?.animations || []);
			const hasAnim = (name: string): boolean => {
				if (!name) return false;
				try {
					if (typeof data.findAnimation === 'function') {
						return !!data.findAnimation(name);
					}
				} catch {}
				return Array.isArray(animations) && animations.some(a => a && a.name === name);
			};
			const state: any = spine.animationState;
			const endName = hasAnim('Character_TB_end') ? 'Character_TB_end' : null;
			let idleName: string | null = null;
			if (Array.isArray(animations) && animations.length > 0) {
				const preferred = ['Character_TB_idle', 'idle', 'Idle', 'IDLE', 'animation', 'Animation'];
				const found = preferred.find(n => hasAnim(n));
				idleName = found ?? (animations[0].name || null);
			}
			const playIdle = () => {
				if (!idleName) return;
				try { state.setAnimation(0, idleName, true); } catch {}
			};
			if (!endName) {
				// No dedicated end animation: go directly to idle and start the hook return.
				playIdle();
				onReady();
				return;
			}
			let entry: any = null;
			try {
				entry = state.setAnimation(0, endName, false);
			} catch {
				// If we cannot play _end, go straight to idle and complete the hook return.
				playIdle();
				onReady();
				return;
			}
			// Queue idle to play automatically after _end finishes.
			try {
				if (idleName) {
					state.addAnimation(0, idleName, true, 0);
				}
			} catch {}
			let onReadyCalled = false;
			const fireOnReady = () => {
				if (onReadyCalled) return;
				onReadyCalled = true;
				onReady();
			};
			try {
				const stateAny: any = state;
				const rawDurationSec = Math.max(0.05, entry?.animation?.duration || 0.8);
				const timeScale = Math.max(0.0001, stateAny.timeScale || 1);
				// When the hook pull/return actually starts, somewhere inside the _end clip.
				const factorValue = typeof this.hookScatterEndTimingMultiplier === 'number' ? this.hookScatterEndTimingMultiplier : 1;
				const factor = factorValue < 0 ? 0 : factorValue;
				const pullDelayMs = (rawDurationSec * factor / timeScale) * 1000;
				this.time.delayedCall(pullDelayMs, () => fireOnReady());
			} catch {
				const factorValue = typeof this.hookScatterEndTimingMultiplier === 'number' ? this.hookScatterEndTimingMultiplier : 1;
				const factor = factorValue < 0 ? 0 : factorValue;
				this.time.delayedCall(800 * (factor || 1), () => fireOnReady());
			}
		} catch {
			onReady();
		}
	}

	private completeHookScatterEvent(): void {
		if (!this.isHookScatterEventActive) {
			return;
		}
		this.isHookScatterEventActive = false;
		gameStateManager.isHookScatterActive = false;

		if (this.hookScatterTween) {
			try { this.hookScatterTween.stop(); } catch {}
			this.hookScatterTween = undefined;
		}

		try { this.hookScatterPointer?.destroy(); } catch {}
		this.hookScatterPointer = undefined;

		this.hookScatterTarget = undefined;

		if (this.rope) {
			this.rope.setPinnedEnds(true, this.wasRopeEndInitiallyPinned);
			this.rope.setCurveAmount(0);
		}

		try {
			this.restoreHookCollectorDepths();
		} catch {}

		if (this.hookImage && this.hookOriginalDepth) {
			this.hookImage.setDepth(this.hookOriginalDepth);
		}

		this.input.enabled = this.wasInputEnabledBeforeHookScatter;
		try {
			this.slotController?.setExternalControlLock(false);
		} catch {}
	}

	private startHookReturnSequence(pointerX: number, pointerY: number): void {
		if (!this.rope || !this.hookScatterTarget || !this.symbols) {
			this.completeHookScatterEvent();
			return;
		}
		const col = this.hookScatterCol;
		const row = this.hookScatterRow;
		if (col < 0 || row < 0) {
			this.completeHookScatterEvent();
			return;
		}

		const curveProxy = { value: 1 };
		this.tweens.add({
			targets: curveProxy,
			value: 0,
			duration: 1000,
			ease: 'Sine.easeInOut',
			onUpdate: () => {
				if (this.rope) {
					this.rope.setCurveAmount(curveProxy.value);
				}
			}
		});

		const displayWidth = this.symbols.displayWidth;
		const displayHeight = this.symbols.displayHeight;
		const horizontalSpacing = this.symbols.horizontalSpacing;
		const verticalSpacing = this.symbols.verticalSpacing;
		const symbolTotalWidth = displayWidth + horizontalSpacing;
		const symbolTotalHeight = displayHeight + verticalSpacing;
		const totalGridWidth = this.symbols.totalGridWidth;
		const totalGridHeight = this.symbols.totalGridHeight;
		const slotX = this.symbols.slotX;
		const slotY = this.symbols.slotY;
		const startX = slotX - totalGridWidth * 0.5;
		const startY = slotY - totalGridHeight * 0.5;
		const cellX = startX + col * symbolTotalWidth + symbolTotalWidth * 0.5;
		const cellY = startY + row * symbolTotalHeight + symbolTotalHeight * 0.5;

		const spawnX = this.hookScatterTarget.x;
		const spawnY = this.hookScatterTarget.y;

		let symbol: any = null;
		try {
			const scene: any = this;
			const symbolValue = 0;
			const spineKey = `symbol_${symbolValue}_spine`;
			const atlasKey = spineKey + '-atlas';
			const hasSpine = (scene.cache.json as any)?.has?.(spineKey);
			if (hasSpine && (scene.add as any)?.spine) {
				symbol = (scene.add as any).spine(spawnX, spawnY, spineKey, atlasKey);
				symbol.setOrigin(0.5, 0.5);
				try { symbol.skeleton.setToSetupPose(); symbol.update(0); } catch {}
				try {
					const baseScale = this.symbols.getIdleSpineSymbolScale(symbolValue);
					this.symbols.centerAndFitSpine(symbol, cellX, cellY, displayWidth, displayHeight, baseScale, this.symbols.getIdleSymbolNudge(symbolValue));
					const m = this.symbols.getSpineScaleMultiplier(symbolValue) * this.symbols.getIdleScaleMultiplier(symbolValue);
					if (m !== 1) symbol.setScale(symbol.scaleX * m, symbol.scaleY * m);
				} catch {}
				try {
					(symbol as any).__pngHome = { x: cellX, y: cellY };
					(symbol as any).__pngSize = { w: displayWidth, h: displayHeight };
					(symbol as any).__pngNudge = this.symbols.getIdleSymbolNudge(symbolValue) || { x: 0, y: 0 };
				} catch {}
				try {
					(symbol as any).displayWidth = displayWidth;
					(symbol as any).displayHeight = displayHeight;
				} catch {}
				try { this.symbols.container.add(symbol); } catch {}
			} else {
				const spriteKey = 'symbol_' + 0;
				if (this.textures.exists(spriteKey)) {
					symbol = this.add.sprite(spawnX, spawnY, spriteKey);
					symbol.displayWidth = displayWidth;
					symbol.displayHeight = displayHeight;
					try { this.symbols.container.add(symbol); } catch {}
				}
			}
		} catch {}

		this.hookScatterSymbol = symbol;
		const targets: any[] = [this.hookScatterTarget];
		if (symbol) {
			targets.push(symbol);
		}

		this.hookScatterTween = this.tweens.add({
			targets,
			x: cellX,
			y: cellY,
			duration: 420,
			ease: 'Sine.easeOut',
			onComplete: () => {
				this.finishHookScatterWithSymbol(cellX, cellY);
			}
		});
	}

	private handleReelsStopForWinTracker(_data?: any): void {
		if (!this.winTracker) {
			return;
		}
		const symbolsAny: any = (this as any).symbols;
		const spinData: any = symbolsAny?.currentSpinData ?? null;
		try {
			this.winTracker.updateFromSpinData(spinData);
			this.winTracker.showLatest();
			this.winTracker.autoHideAfter(3000);
		} catch {
			// Fail silently to avoid impacting the main game loop.
		}
	}

	private finishHookScatterWithSymbol(targetX: number, targetY: number): void {
		const col = this.hookScatterCol;
		const row = this.hookScatterRow;
		if (!this.symbols || col < 0 || row < 0) {
			this.completeHookScatterEvent();
			return;
		}

		const grid: any[][] = this.symbols.symbols;
		const oldSymbol = grid && grid[col] ? grid[col][row] : null;
		const newSymbol = this.hookScatterSymbol;

		if (oldSymbol && oldSymbol !== newSymbol) {
			try {
				this.tweens.add({
					targets: oldSymbol,
					y: oldSymbol.y - 150,
					alpha: 0,
					duration: 400,
					ease: 'Cubic.easeIn',
					onComplete: () => {
						try { oldSymbol.destroy(); } catch {}
					}
				});
			} catch {
				try { oldSymbol.destroy(); } catch {}
			}
		}

		if (newSymbol) {
			try { newSymbol.x = targetX; newSymbol.y = targetY; } catch {}
			if (grid && grid[col]) {
				grid[col][row] = newSymbol;
			}
		}
		this.completeHookScatterEvent();
		try {
			const symbolsAny: any = (this as any).symbols;
			const spinData: any = symbolsAny?.currentSpinData ?? null;
			const fs: any = spinData?.slot?.freespin || spinData?.slot?.freeSpin;
			let spinsLeft = 0;
			if (fs?.items && Array.isArray(fs.items) && fs.items.length > 0) {
				const itemWithSpins = fs.items.find((it: any) => (it?.spinsLeft ?? 0) > 0) ?? fs.items[0];
				spinsLeft = Number(itemWithSpins?.spinsLeft) || 0;
			}
			if (!spinsLeft && typeof fs?.count === 'number') {
				spinsLeft = fs.count;
			}
			if (typeof spinsLeft !== 'number' || spinsLeft <= 0) {
				return;
			}

			try {
				const scatterMgr = ScatterAnimationManager.getInstance();
				if (gameStateManager.isBonus || gameStateManager.isScatter || scatterMgr.isAnimationInProgress()) {
					return;
				}
			} catch {}

			try { gameStateManager.isScatter = true; } catch {}
			try { (this.events as any)?.emit?.('scatterTransitionStart'); } catch {}
			try {
				(this.symbols as any)?.startScatterAnimationSequence?.();
			} catch {
				try {
					ScatterAnimationManager.getInstance().playScatterAnimation();
				} catch {}
			}
		} catch {}
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
		this.reelsStopListener = (data?: any) => this.handleReelsStopForWinTracker(data);
		gameEventManager.on(GameEventType.REELS_STOP, this.reelsStopListener);
		this.winStopListener = () => {
			try {
				this.winTracker?.hideWithFade(250);
			} catch {}
		};
		gameEventManager.on(GameEventType.WIN_STOP, this.winStopListener);
		this.winTrackerHideListener = () => {
			try {
				this.winTracker?.hideWithFade(250);
			} catch {}
		};
		gameEventManager.on(GameEventType.SPIN, this.winTrackerHideListener);
		gameEventManager.on(GameEventType.AUTO_START, this.winTrackerHideListener);
		gameEventManager.on(GameEventType.REELS_START, this.winTrackerHideListener);

		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			EventBus.off('menu', this.handleMenuRequest, this);
			EventBus.off('show-bet-options', this.handleBetOptionsRequest, this);
			EventBus.off('autoplay', this.handleAutoplayRequest, this);
			this.events.off('hook-scatter', this.handleHookScatter, this);
			this.events.off('hook-collector', this.handleHookCollector, this);
			if (this.reelsStopListener) {
				gameEventManager.off(GameEventType.REELS_STOP, this.reelsStopListener);
				this.reelsStopListener = undefined;
			}
			if (this.winStopListener) {
				gameEventManager.off(GameEventType.WIN_STOP, this.winStopListener);
				this.winStopListener = undefined;
			}
			if (this.winTrackerHideListener) {
				gameEventManager.off(GameEventType.SPIN, this.winTrackerHideListener);
				gameEventManager.off(GameEventType.AUTO_START, this.winTrackerHideListener);
				gameEventManager.off(GameEventType.REELS_START, this.winTrackerHideListener);
				this.winTrackerHideListener = undefined;
			}
		});
	}

	private handleMenuRequest(): void {
		this.updateInfoText('Menu button clicked – hook your menu panel here.');
	}

	private handleBetOptionsRequest(): void {
		this.updateInfoText('Bet options requested – plug in the new selector UI.');
	}

	private handleAutoplayRequest(): void {
		const currentBetText = this.slotController.getBetAmountText();
		const displayedBet = currentBetText ? parseFloat(currentBetText) : 0.20;
		const baseBet = this.slotController.getBaseBetAmount();
		const normalizedBaseBet = !isNaN(baseBet) && baseBet > 0 ? baseBet : displayedBet;
		const currentBalance = this.slotController.getBalanceAmount();
		const isEnhancedBet = this.gameData.isEnhancedBet;

		this.autoplayOptions.show({
			currentAutoplayCount: 10,
			currentBet: normalizedBaseBet,
			currentBalance,
			isEnhancedBet,
			onClose: () => {
				this.updateInfoText('Autoplay options closed.');
			},
			onConfirm: (autoplayCount: number) => {
				const selectedBet = this.autoplayOptions.getCurrentBet();
				if (Math.abs(selectedBet - normalizedBaseBet) > 0.0001) {
					this.slotController.updateBetAmount(selectedBet);
					gameEventManager.emit(GameEventType.BET_UPDATE, {
						newBet: selectedBet,
						previousBet: normalizedBaseBet
					});
				}
				this.slotController.startAutoplay(autoplayCount);
				this.updateInfoText(`Autoplay started with ${autoplayCount} spins.`);
			}
		});
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
			segmentCount: 7,
			iterations: 6,
			gravity: 2000,
			thickness: 2,
			coreThickness: 6,
			color: this.ropeStyle.color,
			coreColor: this.ropeStyle.coreColor,
			coreVisible: this.ropeStyle.outlineVisible,
			damping: this.ropeStyle.damping,
			depth: this.ropeDepth
		});

		const characterSpine = this.getActiveCharacterSpine();
		const useCharacterAnchor = !!characterSpine;
		this.wasRopeEndInitiallyPinned = !useCharacterAnchor;
		if (useCharacterAnchor) {
			this.rope.setPinnedEnds(true, false);
		} else {
			this.rope.setPinnedEnds(true, true);
		}
		// Gentle horizontal swaying (wind) for dangling rope/hook
		this.rope.setWind(true, this.scale.width * 0.8, 0.35);
		this.rope.setCurveProfile(this.scale.height * 0.06, 1.5);
		this.rope.setCurveAmount(0);
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
					const spine: any = this.getActiveCharacterSpine();
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
					if (this.hookScatterTarget) {
						return this.hookScatterTarget;
					}
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
				() => this.hookScatterTarget ?? this.endAnchor
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
		if (this.startHandle) this.startHandle.setDepth(this.ropeHandleDepth + 10);
		if (this.endHandle) this.endHandle.setDepth(this.ropeHandleDepth + 12);
		if (this.hookImage) this.hookImage.setDepth(this.ropeDepth + 1);
	}
}
