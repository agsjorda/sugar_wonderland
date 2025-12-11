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
import { RopeCable } from '../components/RopeCable';
import { Background } from '../components/Background';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { AutoplayOptions } from '../components/AutoplayOptions';

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
	private isHookScatterEventActive: boolean = false;
	private hookScatterPointer?: Phaser.GameObjects.Arc;
	private hookScatterTarget?: Phaser.Math.Vector2;
	private hookScatterTween?: Phaser.Tweens.Tween;
	private wasInputEnabledBeforeHookScatter: boolean = true;
	private hookPointerOffsetX: number = 0;
	private hookPointerOffsetY: number = -80;
	private wasRopeEndInitiallyPinned: boolean = true;
	private hookScatterCol: number = -1;
	private hookScatterRow: number = -1;
	private hookScatterSymbol?: any;
	private hookOffscreenOffsetY: number = 200;
	private hookOriginalDepth: number = 0;
	private hookScatterStartTimingMultiplier: number = 0.5;
	private hookScatterEndTimingMultiplier: number = 0.35;
	private enableRope: boolean = true;

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

		this.autoplayOptions = new AutoplayOptions(this.networkManager, this.screenModeManager);
		this.autoplayOptions.create(this);

		// Create and expose the Symbols component for the base game grid
		this.symbols = new Symbols();
		(this as any).symbols = this.symbols;
		this.symbols.create(this as any);
		this.slotController.setSymbols(this.symbols);
	
		// Create rope and draggable handles after the main UI so they sit on top visually.
		if (this.enableRope) {
			this.setupRopeCable();
			this.bringRopeToFront();
		}
		void this.initializeTokenAndBalance();

		this.registerUiEventListeners();
		this.events.on('hook-scatter', this.handleHookScatter, this);
		
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

		const pointerX = worldX + this.hookPointerOffsetX;
		const pointerY = worldY + this.hookPointerOffsetY;
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
				duration: 1000,
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
			const bgAny: any = this.background as any;
			const spine: any = bgAny?.getCharacterSpine?.();
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
			const bgAny: any = this.background as any;
			const spine: any = bgAny?.getCharacterSpine?.();
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
		const cellX = startX + row * symbolTotalWidth + symbolTotalWidth * 0.5;
		const cellY = startY + col * symbolTotalHeight + symbolTotalHeight * 0.5;

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
			duration: 1000,
			ease: 'Sine.easeOut',
			onComplete: () => {
				this.finishHookScatterWithSymbol(cellX, cellY);
			}
		});
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
			this.events.off('hook-scatter', this.handleHookScatter, this);
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

		const characterSpine = (this.background as any)?.getCharacterSpine?.();
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
