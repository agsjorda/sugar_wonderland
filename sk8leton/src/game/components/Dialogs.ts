import { Scene } from 'phaser';

import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { AudioManager, SoundEffectType } from '../../managers/AudioManager';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';
import { FreeSpinOverlay } from './FreeSpinOverlay';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';

type WinTier = 'BigW_TB' | 'EpicW_TB' | 'MegaW_TB' | 'SuperW_TB';
type DialogType = WinTier | 'TotalW_TB';

 type DialogSpineTransform = { offsetX: number; offsetY: number; scaleX: number; scaleY: number };

export class Dialogs {
	public isDialogActive: boolean = false;
	public currentDialog: any = null;
	public currentDialogType: string | null = null;

	private scene: Scene | null = null;
	private overlay: Phaser.GameObjects.Container | null = null;
	private blackOverlay: Phaser.GameObjects.Rectangle | null = null;
	private clickCatcher: Phaser.GameObjects.Rectangle | null = null;
	private continueText: Phaser.GameObjects.Text | null = null;

	private numberDisplay: NumberDisplay | null = null;
	private numberContainer: Phaser.GameObjects.Container | null = null;
	private numberTween: Phaser.Tweens.Tween | null = null;
	private numberAnimObj: { value: number } = { value: 0 };
	private lastRenderedNumber: number = Number.NaN;

	private autoCloseTimer: Phaser.Time.TimerEvent | null = null;

	private staged: boolean = false;
	private stages: Array<{ type: DialogType; target: number }> = [];
	private stageIndex: number = 0;
	private stageTimer: Phaser.Time.TimerEvent | null = null;
	private totalWinScaleMultiplierX: number = 1.37;
	private totalWinScaleMultiplierY: number = 1.4;
	private lastNumberAutoFitAt: number = 0;
	private dialogSpineTransformByType: Record<string, DialogSpineTransform> = {
		BigW_TB: { offsetX: 0, offsetY: -690, scaleX: 1.7, scaleY: 1.7 },
		EpicW_TB: { offsetX: 0, offsetY: -690, scaleX: 1.7, scaleY: 1.7 },
		MegaW_TB: { offsetX: 0, offsetY: -690, scaleX: 1.7, scaleY: 1.7 },
		SuperW_TB: { offsetX: 0, offsetY: -690, scaleX: 1.7, scaleY: 1.7 },
		TotalW_TB: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
	};

	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private freeSpinOverlay: FreeSpinOverlay | null = null;
	private overlayGateHeld: boolean = false;
	private showRequestSeq: number = 0;
	private pendingWinDialogRequestId: number | null = null;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	create(scene: Scene): void {
		this.scene = scene;

		this.overlay = scene.add.container(0, 0);
		this.overlay.setDepth(10000);
		this.overlay.setVisible(false);

		this.blackOverlay = scene.add.rectangle(scene.scale.width * 0.5, scene.scale.height * 0.5, scene.scale.width, scene.scale.height, 0x000000, 1);
		this.blackOverlay.setOrigin(0.5, 0.5);
		this.blackOverlay.setAlpha(0.7);
		this.overlay.add(this.blackOverlay);

		this.freeSpinOverlay = new FreeSpinOverlay(scene, this.networkManager, this.screenModeManager);

		const onWinStop = () => {
			try {
				const gs: any = scene as any;
				if (gameStateManager.isBonus && gs && typeof gs.enqueueBonusOverlay === 'function') {
					const enqueueLater = () => {
						try {
							gs.enqueueBonusOverlay(async () => {
								await this.tryShowWinDialogFromSpinDataQueued();
							});
						} catch {}
					};
					try {
						scene.time.delayedCall(0, () => enqueueLater());
					} catch {
						try { setTimeout(() => enqueueLater(), 0); } catch { enqueueLater(); }
					}
				} else {
					this.tryShowWinDialogFromSpinData();
				}
			} catch {}
		};
		gameEventManager.on(GameEventType.WIN_STOP, onWinStop);
		scene.events.once('shutdown', () => {
			try { gameEventManager.off(GameEventType.WIN_STOP, onWinStop); } catch {}
			try { this.hideDialog(true); } catch {}
		});
		try { this.installDebugConsoleHelpers(); } catch {}
	}

	public getDialogSpineTransform(type: DialogType): DialogSpineTransform {
		const key = String(type);
		const t = this.dialogSpineTransformByType[key];
		if (!t) return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
		return { offsetX: Number(t.offsetX) || 0, offsetY: Number(t.offsetY) || 0, scaleX: Number(t.scaleX) || 1, scaleY: Number(t.scaleY) || 1 };
	}

	public setDialogSpineTransform(type: DialogType, next: Partial<DialogSpineTransform>): void {
		const key = String(type);
		const prev = this.getDialogSpineTransform(type);
		const merged: DialogSpineTransform = {
			offsetX: isFinite(Number((next as any)?.offsetX)) ? Number((next as any).offsetX) : prev.offsetX,
			offsetY: isFinite(Number((next as any)?.offsetY)) ? Number((next as any).offsetY) : prev.offsetY,
			scaleX: isFinite(Number((next as any)?.scaleX)) && Number((next as any).scaleX) > 0 ? Number((next as any).scaleX) : prev.scaleX,
			scaleY: isFinite(Number((next as any)?.scaleY)) && Number((next as any).scaleY) > 0 ? Number((next as any).scaleY) : prev.scaleY
		};
		this.dialogSpineTransformByType[key] = merged;
		try {
			if (this.currentDialog && this.currentDialogType === key) {
				this.applyDialogSpineTransformToCurrent();
			}
		} catch {}
	}

	private applyNumberDisplayAutoFit(force: boolean = false): void {
		const scene = this.scene;
		if (!scene || !this.numberDisplay) return;
		const now = Number((scene as any)?.time?.now);
		if (!force) {
			if (isFinite(now) && (now - this.lastNumberAutoFitAt) < 80) return;
		}
		this.lastNumberAutoFitAt = isFinite(now) ? now : (Date.now ? Date.now() : this.lastNumberAutoFitAt);

		const c: any = (this.numberDisplay as any)?.getContainer?.();
		if (!c) return;

		const baseX = Number((c as any).__dialogsNumberBaseScaleX);
		const baseY = Number((c as any).__dialogsNumberBaseScaleY);
		const resetX = (isFinite(baseX) && baseX > 0) ? baseX : (Number((c as any).scaleX) || 1);
		const resetY = (isFinite(baseY) && baseY > 0) ? baseY : (Number((c as any).scaleY) || 1);
		try { c.setScale(resetX, resetY); } catch {}

		let b: any = null;
		try { b = c.getBounds?.(); } catch {}
		const bw = Number(b?.width ?? 0) || 0;
		const bh = Number(b?.height ?? 0) || 0;
		if (!(bw > 0) || !(bh > 0)) return;

		const marginX = scene.scale.width * 0.06;
		const marginY = scene.scale.height * 0.06;
		const maxW = Math.max(1, scene.scale.width - marginX * 2);
		const maxH = Math.max(1, scene.scale.height - marginY * 2);
		const sFit = Math.min(1, maxW / bw, maxH / bh);
		if (!isFinite(sFit) || !(sFit > 0) || sFit >= 1) return;
		try { c.setScale(resetX * sFit, resetY * sFit); } catch {}
	}

	private getDebugGameScene(): Scene | null {
		try {
			if (this.scene) return this.scene;
		} catch {}
		try {
			const s = (window as any)?.game?.scene?.getScene?.('Game') as Scene | undefined;
			if (s) return s;
		} catch {}
		return null;
	}

	public debugShowDialog(type: DialogType, opts?: { winAmount?: number }): void {
		const scene = this.getDebugGameScene();
		if (!scene) return;
		try { this.scene = scene; } catch {}
		try {
			if (!this.overlay || !this.blackOverlay) {
				this.create(scene);
			}
		} catch {}
		const winAmount = Number(opts?.winAmount);
		const resolved = (isFinite(winAmount) && winAmount >= 0) ? winAmount : 1234.56;
		try {
			this.showDialogInternal(scene, type, { winAmount: resolved, betAmount: 0 });
		} catch {}
	}

	private applyDialogSpineTransformToCurrent(): void {
		const scene = this.scene;
		if (!scene) return;
		const type = this.currentDialogType as DialogType | null;
		if (!type) return;
		const spine: any = this.currentDialog;
		if (!spine) return;
		this.applyDialogSpineTransformToSpine(type, spine);
	}

	private applyDialogSpineTransformToSpine(type: DialogType, spine: any): void {
		const scene = this.scene;
		if (!scene || !spine) return;
		const t = this.getDialogSpineTransform(type);
		const baseScaleX = Number((spine as any).__dialogsBaseScaleX);
		const baseScaleY = Number((spine as any).__dialogsBaseScaleY);
		const sx = (isFinite(baseScaleX) && baseScaleX > 0) ? baseScaleX : (Number((spine as any).scaleX) || 1);
		const sy = (isFinite(baseScaleY) && baseScaleY > 0) ? baseScaleY : (Number((spine as any).scaleY) || 1);
		try { spine.setScale(sx * t.scaleX, sy * t.scaleY); } catch {}
		try { this.recenterDialogSpineWithOffset(spine, type); } catch {}
	}

	private recenterDialogSpineWithOffset(spine: any, type: DialogType): void {
		const scene = this.scene;
		if (!scene || !spine) return;
		const t = this.getDialogSpineTransform(type);
		const baseX = scene.scale.width * 0.5;
		const baseY = scene.scale.height * 0.5;
		try {
			spine.x = baseX;
			spine.y = baseY;
		} catch {}
		try { spine.update?.(0); } catch {}
		const b: any = spine.getBounds?.();
		const w = Number(b?.width ?? b?.size?.width ?? b?.size?.x ?? 0) || 0;
		const h = Number(b?.height ?? b?.size?.height ?? b?.size?.y ?? 0) || 0;
		const offX = Number(b?.offset?.x ?? b?.x ?? 0) || 0;
		const offY = Number(b?.offset?.y ?? b?.y ?? 0) || 0;
		if (!(w > 0) || !(h > 0)) {
			try {
				spine.x = baseX + t.offsetX;
				spine.y = baseY + t.offsetY;
			} catch {}
			return;
		}
		const cx = offX + w * 0.5;
		const cy = offY + h * 0.5;
		try {
			spine.x += baseX - cx;
			spine.y += baseY - cy;
			spine.x += t.offsetX;
			spine.y += t.offsetY;
		} catch {}
	}

	private installDebugConsoleHelpers(): void {
		try {
			const w: any = window as any;
			w.__dialogs = this;
			w.__dialogsWinMods = {
				get: () => {
					try { return JSON.parse(JSON.stringify(this.dialogSpineTransformByType)); } catch { return { ...this.dialogSpineTransformByType }; }
				},
				set: (type: DialogType, mods: Partial<DialogSpineTransform>) => {
					try { this.setDialogSpineTransform(type, mods); } catch {}
					try { return this.getDialogSpineTransform(type); } catch { return null; }
				},
				apply: () => {
					try { this.applyDialogSpineTransformToCurrent(); } catch {}
					try { return this.currentDialogType ? this.getDialogSpineTransform(this.currentDialogType as any) : null; } catch { return null; }
				},
				show: (type: DialogType, winAmount?: number) => {
					try { this.debugShowDialog(type, { winAmount }); } catch {}
				},
				big: (winAmount?: number) => { try { this.debugShowDialog('BigW_TB', { winAmount }); } catch {} },
				epic: (winAmount?: number) => { try { this.debugShowDialog('EpicW_TB', { winAmount }); } catch {} },
				mega: (winAmount?: number) => { try { this.debugShowDialog('MegaW_TB', { winAmount }); } catch {} },
				super: (winAmount?: number) => { try { this.debugShowDialog('SuperW_TB', { winAmount }); } catch {} },
				total: (winAmount?: number) => { try { this.debugShowDialog('TotalW_TB', { winAmount }); } catch {} },
				hide: () => { try { this.hideDialog(true); } catch {} }
			};
		} catch {}
	}

	getFreeSpinOverlay(): FreeSpinOverlay | null {
		return this.freeSpinOverlay;
	}

	isDialogShowing(): boolean {
		return this.isDialogActive;
	}

	isWinDialog(): boolean {
		return this.currentDialogType === 'BigW_TB'
			|| this.currentDialogType === 'EpicW_TB'
			|| this.currentDialogType === 'MegaW_TB'
			|| this.currentDialogType === 'SuperW_TB';
	}

	setTotalWinScaleMultiplier(multiplier: number): void {
		this.setTotalWinScaleMultiplierXY(multiplier, multiplier);
	}

	setTotalWinScaleMultiplierX(multiplier: number): void {
		this.setTotalWinScaleMultiplierXY(multiplier, this.totalWinScaleMultiplierY);
	}

	setTotalWinScaleMultiplierY(multiplier: number): void {
		this.setTotalWinScaleMultiplierXY(this.totalWinScaleMultiplierX, multiplier);
	}

	setTotalWinScaleMultiplierXY(multiplierX: number, multiplierY: number): void {
		const vx = Number(multiplierX);
		const vy = Number(multiplierY);
		if (!isFinite(vx) || vx <= 0) return;
		if (!isFinite(vy) || vy <= 0) return;

		const prevX = this.totalWinScaleMultiplierX;
		const prevY = this.totalWinScaleMultiplierY;
		this.totalWinScaleMultiplierX = vx;
		this.totalWinScaleMultiplierY = vy;
		const factorX = prevX > 0 ? (vx / prevX) : 1;
		const factorY = prevY > 0 ? (vy / prevY) : 1;

		try {
			if (this.currentDialogType === 'TotalW_TB' && this.currentDialog && typeof (this.currentDialog as any).setScale === 'function') {
				const sx = Number((this.currentDialog as any).scaleX);
				const sy = Number((this.currentDialog as any).scaleY);
				const baseX = (isFinite(sx) && sx > 0) ? sx : 1;
				const baseY = (isFinite(sy) && sy > 0) ? sy : 1;
				(this.currentDialog as any).setScale(baseX * factorX, baseY * factorY);
			}
		} catch {}
		try {
			const nd = this.numberDisplay as any;
			const c = nd?.getContainer?.();
			if (this.currentDialogType === 'TotalW_TB' && c && typeof c.setScale === 'function') {
				const storedBaseX = Number((c as any).__dialogsNumberBaseScaleX);
				const storedBaseY = Number((c as any).__dialogsNumberBaseScaleY);
				const sx = Number((c as any).scaleX);
				const sy = Number((c as any).scaleY);
				const baseX = (isFinite(storedBaseX) && storedBaseX > 0) ? storedBaseX : ((isFinite(sx) && sx > 0) ? sx : 1);
				const baseY = (isFinite(storedBaseY) && storedBaseY > 0) ? storedBaseY : ((isFinite(sy) && sy > 0) ? sy : 1);
				const nextBaseX = baseX * factorX;
				const nextBaseY = baseY * factorY;
				(c as any).__dialogsNumberBaseScaleX = nextBaseX;
				(c as any).__dialogsNumberBaseScaleY = nextBaseY;
				c.setScale(nextBaseX, nextBaseY);
				try { this.applyNumberDisplayAutoFit(true); } catch {}
			}
		} catch {}
		try {
			if (this.currentDialogType === 'TotalW_TB' && this.continueText && typeof (this.continueText as any).setScale === 'function') {
				const sx = Number((this.continueText as any).scaleX);
				const sy = Number((this.continueText as any).scaleY);
				const baseX = (isFinite(sx) && sx > 0) ? sx : 1;
				const baseY = (isFinite(sy) && sy > 0) ? sy : 1;
				(this.continueText as any).setScale(baseX * factorX, baseY * factorY);
			}
		} catch {}
	}

	showCongrats(scene: Scene, config?: { winAmount?: number }): void {
		let winAmount = Number(config?.winAmount) || 0;
		const passedWinAmount = winAmount;
		try {
			if (gameStateManager.isBonus) {
				const sceneAny: any = scene as any;
				const symbols: any = sceneAny?.symbols;
				const sd: any = symbols?.currentSpinData;
				let resolved: number | null = null;
				try {
					const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
					const items: any[] | undefined = fs?.items;
					const slotArea = sd?.slot?.area;
					let it0: any = null;
					if (Array.isArray(items) && items.length > 0) {
						if (Array.isArray(slotArea) && Array.isArray(slotArea[0])) {
							it0 = items.find((it: any) => {
								try {
									const a = it?.area;
									if (!Array.isArray(a) || a.length !== slotArea.length) return false;
									for (let i = 0; i < a.length; i++) {
										const ac = a[i];
										const bc = slotArea[i];
										if (!Array.isArray(ac) || !Array.isArray(bc) || ac.length !== bc.length) return false;
										for (let j = 0; j < ac.length; j++) {
											if (Number(ac[j]) !== Number(bc[j])) return false;
										}
									}
									return true;
								} catch {
									return false;
								}
							});
						}
						if (!it0) {
							it0 = items.find((it: any) => (Number(it?.spinsLeft) || 0) > 0) ?? items[0];
						}
					}
					const vRun = Number(it0?.runningWin);
					if (isFinite(vRun) && vRun >= 0) resolved = vRun;
				} catch {}
				try {
					const v0 = Number(sd?.slot?.__backendTotalWin);
					if (isFinite(v0) && v0 >= 0) resolved = v0;
				} catch {}
				if (resolved == null) {
					try {
						const v1 = Number(sd?.slot?.totalWin);
						if (isFinite(v1) && v1 >= 0) resolved = v1;
					} catch {}
				}
				if (resolved == null) {
					try {
						const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
						const v2 = Number(fs?.__backendTotalWin);
						if (isFinite(v2) && v2 >= 0) resolved = v2;
					} catch {}
				}
				if (resolved == null) {
					try {
						const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
						const v3 = Number(fs?.totalWin);
						if (isFinite(v3) && v3 >= 0) resolved = v3;
					} catch {}
				}
				if (resolved != null) {
					if (passedWinAmount > 0 && resolved < passedWinAmount) {
						winAmount = passedWinAmount;
					} else {
						winAmount = resolved;
					}
				} else {
					winAmount = passedWinAmount;
				}
			}
		} catch {}
		if (!(winAmount > 0)) {
			try {
				const sceneAny: any = scene as any;
				const symbols: any = sceneAny?.symbols;
				const vCached = Number((symbols as any)?.lastBonusTotalWin);
				if (isFinite(vCached) && vCached > 0) winAmount = vCached;
			} catch {}
		}
		if (!(winAmount > 0)) {
			try {
				const sceneAny: any = scene as any;
				const bonusHeader: any = sceneAny?.bonusHeader;
				const vHeader = Number(bonusHeader?.getCurrentWinnings?.());
				if (isFinite(vHeader) && vHeader > 0) winAmount = vHeader;
			} catch {}
		}
		const sceneAny: any = scene as any;
		const mgr: any = sceneAny?.scene;
		const canLaunch = !!(mgr && typeof mgr.launch === 'function');
		const shouldUseBubble = !!gameStateManager.isBonus;
		if (!shouldUseBubble || !canLaunch) {
			void (async () => {
				try { await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 }); } catch {}
				try { await gameStateManager.waitUntilOverlaysClosed(15000); } catch {}
				this.showDialog(scene, 'TotalW_TB', { winAmount });
			})();
			return;
		}
		void (async () => {
			try { await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 }); } catch {}
			try { await gameStateManager.waitUntilOverlaysClosed(15000); } catch {}
			this.launchTotalWinIntroTransition(scene, winAmount);
		})();
	}

	async showCongratsQueued(scene: Scene, config?: { winAmount?: number }): Promise<void> {
		const winAmount = Number(config?.winAmount) || 0;
		try {
			await new Promise<void>((resolve) => {
				let done = false;
				let finishOnDialogClose: (() => void) | null = null;
				const finish = () => {
					if (done) return;
					done = true;
					try { scene.events.off('finalizeBonusExit', finish as any); } catch {}
					try {
						if (finishOnDialogClose) {
							gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, finishOnDialogClose as any);
						}
					} catch {}
					resolve();
				};

				const sceneAny: any = scene as any;
				const mgr: any = sceneAny?.scene;
				const canLaunch = !!(mgr && typeof mgr.launch === 'function');
				const isBonus = !!gameStateManager.isBonus;
				const willUseBubble = !!(isBonus && canLaunch);
				try { scene.events.once('finalizeBonusExit', finish as any); } catch {}

				// If we're not in bonus, we don't necessarily get bonus-exit events.
				// In that case (or if Bubble transition can't run), resolve on dialog close as a fallback.
				if (!willUseBubble) {
					finishOnDialogClose = () => finish();
					try { gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, finishOnDialogClose as any); } catch {}
				}
				try {
					scene.time.delayedCall(15000, () => finish());
				} catch {
					try { setTimeout(() => finish(), 15000); } catch { finish(); }
				}

				try {
					this.showCongrats(scene, { winAmount });
				} catch {
					finish();
				}
			});
		} catch {}
	}

	private launchTotalWinIntroTransition(scene: Scene, winAmount: number): void {
		const sceneAny: any = scene as any;
		const mgr: any = sceneAny?.scene;
		if (!mgr || typeof mgr.launch !== 'function') {
			void (async () => {
				try { await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 }); } catch {}
				try { await gameStateManager.waitUntilOverlaysClosed(15000); } catch {}
				this.showDialog(scene, 'TotalW_TB', { winAmount });
			})();
			return;
		}

		let shown = false;
		const showNow = (data?: any) => {
			if (shown) return;
			shown = true;
			try { scene.events.off('showTotalWinOverlay', showNow as any); } catch {}
			let resolved = winAmount;
			try {
				const vEvt = Number(data?.winAmount);
				if (isFinite(vEvt) && vEvt >= 0) {
					const vArg = Number(winAmount);
					resolved = (isFinite(vArg) && vArg >= 0) ? Math.max(vEvt, vArg) : vEvt;
				}
			} catch {}
			try {
				if (gameStateManager.isBonus) {
					const sceneAny: any = scene as any;
					const symbols: any = sceneAny?.symbols;
					const sd: any = symbols?.currentSpinData;
					let backendTotal: number | null = null;
					try {
						const items: any[] | undefined = sd?.slot?.freespin?.items || sd?.slot?.freeSpin?.items;
						const slotArea = sd?.slot?.area;
						let it0: any = null;
						if (Array.isArray(items) && items.length > 0) {
							if (Array.isArray(slotArea) && Array.isArray(slotArea[0])) {
								it0 = items.find((it: any) => {
									try {
										const a = it?.area;
										if (!Array.isArray(a) || a.length !== slotArea.length) return false;
										for (let i = 0; i < a.length; i++) {
											const ac = a[i];
											const bc = slotArea[i];
											if (!Array.isArray(ac) || !Array.isArray(bc) || ac.length !== bc.length) return false;
											for (let j = 0; j < ac.length; j++) {
												if (Number(ac[j]) !== Number(bc[j])) return false;
											}
										}
										return true;
									} catch {
										return false;
									}
								});
							}
							if (!it0) {
								it0 = items.find((it: any) => (Number(it?.spinsLeft) || 0) > 0) ?? items[0];
							}
						}
						const vRun = Number(it0?.runningWin);
						if (isFinite(vRun) && vRun >= 0) backendTotal = vRun;
					} catch {}
					try {
						const v0 = Number(sd?.slot?.__backendTotalWin);
						if (isFinite(v0) && v0 >= 0) backendTotal = backendTotal == null ? v0 : Math.max(backendTotal, v0);
					} catch {}
					if (backendTotal == null) {
						try {
							const v1 = Number(sd?.slot?.totalWin);
							if (isFinite(v1) && v1 >= 0) backendTotal = v1;
						} catch {}
					}
					if (backendTotal == null) {
						try {
							const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
							const v2 = Number(fs?.__backendTotalWin);
							if (isFinite(v2) && v2 >= 0) backendTotal = v2;
						} catch {}
					}
					if (backendTotal == null) {
						try {
							const fs: any = sd?.slot?.freespin || sd?.slot?.freeSpin;
							const v3 = Number(fs?.totalWin);
							if (isFinite(v3) && v3 >= 0) backendTotal = v3;
						} catch {}
					}
					try {
						if (backendTotal != null) {
							const bt = Number(backendTotal);
							if (isFinite(bt) && bt >= 0) {
								resolved = (resolved > 0) ? Math.max(resolved, bt) : bt;
							}
						}
					} catch {}
				}
			} catch {}
			if (!(resolved >= 0)) {
				const amount = Number(data?.winAmount);
				resolved = isFinite(amount) ? amount : winAmount;
			}
			if (!(resolved > 0)) {
				try {
					const sceneAny: any = scene as any;
					const symbols: any = sceneAny?.symbols;
					const vCached = Number((symbols as any)?.lastBonusTotalWin);
					if (isFinite(vCached) && vCached > 0) resolved = vCached;
				} catch {}
			}
			if (!(resolved > 0)) {
				try {
					const sceneAny: any = scene as any;
					const bonusHeader: any = sceneAny?.bonusHeader;
					const vHeader = Number(bonusHeader?.getCurrentWinnings?.());
					if (isFinite(vHeader) && vHeader > 0) resolved = vHeader;
				} catch {}
			}
			this.showDialog(scene, 'TotalW_TB', { winAmount: resolved });
		};

		try { scene.events.off('showTotalWinOverlay', showNow as any); } catch {}
		try { scene.events.once('showTotalWinOverlay', showNow as any); } catch {}
		try {
			scene.time.delayedCall(2500, () => {
				if (shown) return;
				try { showNow({ winAmount }); } catch {}
			});
		} catch {
			try {
				setTimeout(() => {
					if (shown) return;
					try { showNow({ winAmount }); } catch {}
				}, 2500);
			} catch {}
		}

		try {
			if (mgr.isActive?.('BubbleOverlayTransition') || mgr.isSleeping?.('BubbleOverlayTransition')) {
				try { mgr.stop('BubbleOverlayTransition'); } catch {}
			}
		} catch {}

		void (async () => {
			try { await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 }); } catch {}
			try { await gameStateManager.waitUntilOverlaysClosed(15000); } catch {}
			try {
				mgr.launch('BubbleOverlayTransition', {
					fromSceneKey: 'Game',
					toSceneKey: 'Game',
					stopFromScene: false,
					toSceneEvent: 'showTotalWinOverlay',
					toSceneEventData: { winAmount }
				});
				try { mgr.bringToTop?.('BubbleOverlayTransition'); } catch {}
			} catch {
				try { showNow({ winAmount }); } catch {}
			}
		})();
	}

	async showFreeSpinRetriggerOverlay(opts: { overlayId?: number; spinsLeft: number; multiplierKey?: string | null; multiplierOptionsByKey?: Record<string, { offsetX?: number; offsetY?: number; scale?: number }> }): Promise<void> {
		const scene = this.scene;
		if (!scene || !this.freeSpinOverlay) return;
		const overlayId = Number(opts.overlayId) || 0;
		let overlayLockHeld = false;

		try {
			await gameStateManager.waitForOverlaySafeState({ timeoutMs: 8000 });
		} catch {}
		try {
			await gameStateManager.waitUntilOverlaysClosed(10000);
		} catch {}

		try {
			try {
				gameStateManager.acquireOverlayLock();
				overlayLockHeld = true;
			} catch {}
			try { gameStateManager.isShowingWinDialog = true; } catch {}
			try {
				const map = opts.multiplierOptionsByKey || {};
				for (const k of Object.keys(map)) {
					this.freeSpinOverlay.setMultiplierDisplayOptionsForKey(k, map[k]);
				}
			} catch {}

			await new Promise<void>((resolve) => {
				try {
					this.freeSpinOverlay!.show(Number(opts.spinsLeft) || 0, () => resolve(), 'FreeSpinRetri_TB', opts.multiplierKey ?? null);
				} catch {
					resolve();
				}
			});

			try { await this.freeSpinOverlay.waitUntilDismissed(); } catch {}

			await new Promise<void>((resolve) => {
				try { this.freeSpinOverlay!.hide(250, () => resolve()); } catch { resolve(); }
			});
		} finally {
			try { gameStateManager.isShowingWinDialog = false; } catch {}
			try {
				if (overlayLockHeld) {
					gameStateManager.releaseOverlayLock();
				}
			} catch {}
			try { scene.events.emit('freeSpinRetriggerOverlayClosed', overlayId); } catch {}
		}
	}

	showDialog(scene: Scene, type: DialogType, cfg?: { winAmount?: number; betAmount?: number }): void {
		this.scene = scene;
		this.hideDialog(true, false);
		const requestId = ++this.showRequestSeq;
		this.pendingWinDialogRequestId = requestId;
		try { gameStateManager.isShowingWinDialog = true; } catch {}

		void (async () => {
			try {
				await gameStateManager.waitForOverlaySafeState({ timeoutMs: 8000 });
			} catch {}
			try {
				await gameStateManager.waitUntilOverlaysClosed(10000);
			} catch {}
			if (requestId !== this.showRequestSeq) {
				try {
					if (this.pendingWinDialogRequestId === requestId) {
						this.pendingWinDialogRequestId = null;
						try { gameStateManager.isShowingWinDialog = false; } catch {}
					}
				} catch {}
				return;
			}
			this.pendingWinDialogRequestId = null;
			this.showDialogInternal(scene, type, cfg);
		})();
	}

	private showDialogInternal(scene: Scene, type: DialogType, cfg?: { winAmount?: number; betAmount?: number }): void {
		this.scene = scene;
		this.hideDialog(true, false);

		if (!this.overlay || !this.blackOverlay) {
			this.create(scene);
		}
		if (!this.overlay || !this.blackOverlay) return;

		this.isDialogActive = true;
		this.currentDialogType = type;
		this.overlay.setVisible(true);
		this.overlay.setAlpha(1);
		try { gameEventManager.emit(GameEventType.DIALOG_START, { dialogType: type }); } catch {}

		try {
			this.blackOverlay.setPosition(scene.scale.width * 0.5, scene.scale.height * 0.5);
			this.blackOverlay.setSize(scene.scale.width, scene.scale.height);
			this.blackOverlay.setAlpha(0.7);
		} catch {}

		const winAmount = Number(cfg?.winAmount) || 0;
		const betAmount = Number(cfg?.betAmount) || 0;

		this.staged = false;
		this.stages = [];
		this.stageIndex = 0;

		if (type !== 'TotalW_TB') {
			this.setupStagesIfNeeded(type, winAmount, betAmount);
		}

		try {
			const symbols: any = (scene as any)?.symbols;
			symbols?.winLineDrawer?.stopLooping?.();
			symbols?.winLineDrawer?.clearLines?.();
		} catch {}

		try {
			if (!this.overlayGateHeld) {
				gameStateManager.acquireOverlayLock();
				this.overlayGateHeld = true;
			}
		} catch {}

		try { gameStateManager.isShowingWinDialog = true; } catch {}

		if (this.staged && this.stages.length > 0) {
			this.showStage(0, false);
		} else {
			this.createSpine(type);
			this.ensureNumberDisplay(0);
			this.animateNumber(0, winAmount, 1500, false);
			this.playTierSfx(type);
		}

		this.createContinueText();
		this.createClickCatcher();
		this.setupAutoClose();
	}

	hideDialog(immediate: boolean = false, cancelPending: boolean = true): void {
		const scene = this.scene;
		if (!scene) return;
		this.setClickCatcherEnabled(false);
		if (cancelPending) {
			try { this.showRequestSeq++; } catch {}
		}
		if (!this.isDialogActive && !this.overlay?.visible) {
			try {
				if (cancelPending) {
					this.pendingWinDialogRequestId = null;
					try { gameStateManager.isShowingWinDialog = false; } catch {}
				}
				this.setClickCatcherEnabled(false);
				try {
					if (this.overlayGateHeld) {
						gameStateManager.releaseOverlayLock();
						this.overlayGateHeld = false;
					}
				} catch {}
			} catch {}
			return;
		}
		const closingType = this.currentDialogType;

		this.isDialogActive = false;

		try { this.autoCloseTimer?.destroy(); } catch {}
		this.autoCloseTimer = null;
		try { this.stageTimer?.destroy(); } catch {}
		this.stageTimer = null;

		this.staged = false;
		this.stages = [];
		this.stageIndex = 0;

		const finalize = () => {
			this.cleanupVisuals();
			try {
				const audioManager = (window as any)?.audioManager as AudioManager | undefined;
				if (audioManager && typeof audioManager.restoreBackground === 'function') {
					audioManager.restoreBackground(320);
				}
			} catch {}
			try { gameStateManager.isShowingWinDialog = false; } catch {}
			try {
				if (this.overlayGateHeld) {
					gameStateManager.releaseOverlayLock();
					this.overlayGateHeld = false;
				}
			} catch {}
			try { gameEventManager.emit(GameEventType.DIALOG_STOP, { dialogType: closingType || '' }); } catch {}
			try { gameEventManager.emit(GameEventType.WIN_DIALOG_CLOSED); } catch {}
			try { scene.events.emit('dialogAnimationsComplete'); } catch {}
		};

		if (immediate) {
			finalize();
			return;
		}

		try {
			scene.tweens.add({
				targets: this.overlay,
				alpha: 0,
				duration: 280,
				ease: 'Cubic.easeIn',
				onComplete: () => finalize()
			});
		} catch {
			finalize();
		}
	}

	private tryShowWinDialogFromSpinData(): void {
		const scene = this.scene;
		if (!scene) return;
		if (this.isDialogActive) return;
		if (gameStateManager.isScatter) return;

		const spinData: any = (scene as any)?.symbols?.currentSpinData;
		const paylines = spinData?.slot?.paylines;
		if (!Array.isArray(paylines) || paylines.length <= 0) return;

		let totalWin = 0;
		for (const pl of paylines) totalWin += Number(pl?.win) || 0;

		const bet = Number.parseFloat(String(spinData?.bet ?? '0')) || 0;
		if (!(bet > 0) || !(totalWin > 0)) return;

		const m = totalWin / bet;
		if (!(m >= 20)) return;

		let final: WinTier = 'BigW_TB';
		if (m >= 60) final = 'SuperW_TB';
		else if (m >= 45) final = 'MegaW_TB';
		else if (m >= 30) final = 'EpicW_TB';

		this.showDialog(scene, final, { winAmount: totalWin, betAmount: bet });
	}

	private async tryShowWinDialogFromSpinDataQueued(): Promise<void> {
		const scene = this.scene;
		if (!scene) return;
		if (this.isDialogActive) return;
		if (gameStateManager.isScatter) return;

		const spinData: any = (scene as any)?.symbols?.currentSpinData;
		const paylines = spinData?.slot?.paylines;
		if (!Array.isArray(paylines) || paylines.length <= 0) return;

		let totalWin = 0;
		for (const pl of paylines) totalWin += Number(pl?.win) || 0;

		const bet = Number.parseFloat(String(spinData?.bet ?? '0')) || 0;
		if (!(bet > 0) || !(totalWin > 0)) return;

		const m = totalWin / bet;
		if (!(m >= 20)) return;

		let final: WinTier = 'BigW_TB';
		if (m >= 60) final = 'SuperW_TB';
		else if (m >= 45) final = 'MegaW_TB';
		else if (m >= 30) final = 'EpicW_TB';

		await new Promise<void>((resolve) => {
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				try { gameEventManager.off(GameEventType.WIN_DIALOG_CLOSED, onClosed); } catch {}
				resolve();
			};
			const onClosed = () => finish();
			try { gameEventManager.on(GameEventType.WIN_DIALOG_CLOSED, onClosed); } catch {}
			try { scene.time.delayedCall(9000, () => finish()); } catch { try { setTimeout(() => finish(), 9000); } catch { finish(); } }
			try { this.showDialog(scene, final, { winAmount: totalWin, betAmount: bet }); } catch { finish(); }
		});
	}

	private setupStagesIfNeeded(finalType: WinTier, winAmount: number, betAmount: number): void {
		if (!(winAmount > 0) || !(betAmount > 0)) return;

		const order: Array<{ type: WinTier; mult: number }> = [
			{ type: 'BigW_TB', mult: 20 },
			{ type: 'EpicW_TB', mult: 30 },
			{ type: 'MegaW_TB', mult: 45 },
			{ type: 'SuperW_TB', mult: 60 }
		];

		const finalIdx = order.findIndex((x) => x.type === finalType);
		if (finalIdx <= 0) return;

		const stages: Array<{ type: DialogType; target: number }> = [];
		let last = 0;
		for (let i = 0; i < finalIdx; i++) {
			const t = betAmount * order[i].mult;
			if (winAmount >= t && t > last) {
				stages.push({ type: order[i].type, target: t });
				last = t;
			}
		}
		stages.push({ type: finalType, target: winAmount });
		if (stages.length <= 1) return;

		this.staged = true;
		this.stages = stages;
		this.stageIndex = 0;
	}

	private showStage(index: number, fastFromSkip: boolean): void {
		const scene = this.scene;
		if (!scene) return;
		if (!this.staged || !this.isDialogActive) return;
		if (index < 0 || index >= this.stages.length) return;

		try { this.stageTimer?.destroy(); } catch {}
		this.stageTimer = null;
		this.stageIndex = index;

		const stage = this.stages[index];
		this.currentDialogType = stage.type;
		this.createSpine(stage.type as any);
		this.ensureNumberDisplay(Number(this.numberAnimObj.value) || 0);
		this.playTierSfx(stage.type);

		const duration = fastFromSkip ? 450 : 1500;
		this.animateNumber(this.numberAnimObj.value || 0, stage.target, duration, true);

		if (index < this.stages.length - 1 && !fastFromSkip) {
			this.stageTimer = scene.time.delayedCall(2000, () => {
				this.showStage(index + 1, false);
			});
		}
	}

	private onClick(fromAutoClose: boolean): void {
		const scene = this.scene;
		if (!scene) return;
		if (!this.isDialogActive) return;

		if (!fromAutoClose && this.staged && this.stageIndex < this.stages.length - 1) {
			try { this.autoCloseTimer?.destroy(); } catch {}
			this.autoCloseTimer = null;
			this.showStage(this.stageIndex + 1, true);
			return;
		}

		const wasTotal = this.currentDialogType === 'TotalW_TB';
		if (wasTotal) {
			try { this.autoCloseTimer?.destroy(); } catch {}
			this.autoCloseTimer = null;
			try { this.clickCatcher?.removeAllListeners?.(); } catch {}
			try { (this.clickCatcher as any)?.disableInteractive?.(); } catch {}
			this.launchBonusExitTransition(true);
			return;
		}
		this.hideDialog(false);
	}

	private launchBonusExitTransition(hideDialogMidTransition: boolean = false): void {
		const scene = this.scene as any;
		if (!scene?.scene?.launch) return;
		if (hideDialogMidTransition) {
			let hidden = false;
			const hideNow = () => {
				if (hidden) return;
				hidden = true;
				try { scene.events.off('prepareBonusExit', hideNow as any); } catch {}
				try { this.hideDialog(true); } catch {}
			};
			try { scene.events.off('prepareBonusExit', hideNow as any); } catch {}
			try { scene.events.once('prepareBonusExit', hideNow as any); } catch {}
			try {
				scene.time?.delayedCall?.(2500, () => {
					if (hidden) return;
					try { hideNow(); } catch {}
				});
			} catch {
				try { setTimeout(() => { if (!hidden) hideNow(); }, 2500); } catch {}
			}
		}
		void (async () => {
			try { await gameStateManager.waitForOverlaySafeState({ timeoutMs: 15000 }); } catch {}
			// If this dialog is holding the overlay lock, waiting for "overlays closed" will deadlock.
			// In that case, proceed to launch the exit transition immediately.
			try {
				if (!this.overlayGateHeld) {
					await gameStateManager.waitUntilOverlaysClosed(15000);
				}
			} catch {}
			try {
				if (scene.scene.isActive('BubbleOverlayTransition') || scene.scene.isSleeping('BubbleOverlayTransition')) {
					try { scene.scene.stop('BubbleOverlayTransition'); } catch {}
				}
				scene.scene.launch('BubbleOverlayTransition', {
					fromSceneKey: 'Game',
					toSceneKey: 'Game',
					stopFromScene: false,
					toSceneEvent: 'prepareBonusExit',
					toSceneEventOnFinish: 'finalizeBonusExit',
					transitionPreset: 'bonusExit',
					timings: {
						overlayAlpha: 0.55,
						overlayInMs: 520,
						overlayDelayMs: 30,
						spineInMs: 620,
						switchProgress: 0.5,
						overlayOutMs: 200,
						finishOutMs: 500
					}
				});
				try { scene.scene.bringToTop?.('BubbleOverlayTransition'); } catch {}
			} catch {}
		})();
	}

	private setupAutoClose(): void {
		const scene = this.scene;
		if (!scene) return;
		try { this.autoCloseTimer?.destroy(); } catch {}
		this.autoCloseTimer = null;

		if (!this.isWinDialog()) return;

		let isFsAuto = false;
		try {
			const symbols: any = (scene as any)?.symbols;
			if (symbols && typeof symbols.isFreeSpinAutoplayActive === 'function') {
				isFsAuto = !!symbols.isFreeSpinAutoplayActive();
			}
		} catch {}

		const should = !!(gameStateManager.isAutoPlaying || isFsAuto || gameStateManager.isScatter);
		if (!should) return;

		let delay = 2500;
		if (this.staged && this.stages.length > 1) {
			delay = 2000 * this.stages.length + 1500;
		}
		this.autoCloseTimer = scene.time.delayedCall(delay, () => this.onClick(true));
	}

	private createSpine(type: DialogType): void {
		const scene = this.scene;
		if (!scene || !this.overlay) return;

		try { this.currentDialog?.destroy?.(); } catch {}
		this.currentDialog = null;

		if (!ensureSpineFactory(scene as any, '[Dialogs]')) return;

		const key = type;
		const atlasKey = `${key}-atlas`;
		const jsonCache: any = (scene.cache as any).json;
		if (!jsonCache?.has?.(key)) return;

		let spine: any = null;
		try {
			spine = (scene.add as any).spine(scene.scale.width * 0.5, scene.scale.height * 0.5, key, atlasKey);
		} catch {
			spine = null;
		}
		if (!spine) return;

		this.currentDialog = spine;
		try { spine.setOrigin(0.5, 0.5); } catch {}
		try { spine.setScrollFactor?.(0); } catch {}
		try { spine.setDepth(10000); } catch {}

		try {
			spine.skeleton?.setToSetupPose?.();
			spine.update?.(0);
		} catch {}

		try {
			spine.setScale(1);
			try { spine.update?.(0); } catch {}
			const b = spine.getBounds?.();
			let bw = Number(b?.width ?? b?.size?.width ?? b?.size?.x ?? 0) || 0;
			let bh = Number(b?.height ?? b?.size?.height ?? b?.size?.y ?? 0) || 0;
			if (!(bw > 0) || !(bh > 0)) {
				bw = Number((spine as any).width) || 0;
				bh = Number((spine as any).height) || 0;
			}
			if (bw > 0 && bh > 0) {
				const targetW = scene.scale.width * 0.92;
				const targetH = (type === 'TotalW_TB') ? (scene.scale.height * 0.75) : (scene.scale.height * 0.86);
				const sFit = Math.min(targetW / bw, targetH / bh);
				if (isFinite(sFit) && sFit > 0) {
					if (type === 'TotalW_TB') {
						const mx = Number(this.totalWinScaleMultiplierX);
						const my = Number(this.totalWinScaleMultiplierY);
						spine.setScale(sFit * ((isFinite(mx) && mx > 0) ? mx : 1), sFit * ((isFinite(my) && my > 0) ? my : 1));
					} else {
						spine.setScale(sFit);
					}
				}
			}
		} catch {}

		try {
			(spine as any).__dialogsBaseScaleX = Number((spine as any).scaleX) || 1;
			(spine as any).__dialogsBaseScaleY = Number((spine as any).scaleY) || 1;
		} catch {}

		try {
			const data: any = spine.skeleton?.data;
			const anims: any[] = Array.isArray(data?.animations) ? data.animations : [];
			const name = (anims[0] && anims[0].name) ? anims[0].name : 'animation';
			spine.animationState?.setAnimation?.(0, name, true);
		} catch {}

		try {
			const recenter = () => {
				try { this.applyDialogSpineTransformToSpine(type, spine); } catch {}
			};
			recenter();
			try { scene.time.delayedCall(0, () => { try { recenter(); } catch {} }); } catch {}
		} catch {}

		try {
			this.overlay.add(spine);
		} catch {}

		try {
			spine.setAlpha(0);
			scene.tweens.add({ targets: spine, alpha: 1, duration: 260, ease: 'Sine.easeOut' });
		} catch {}
	}

	private ensureNumberDisplay(initial: number): void {
		const scene = this.scene;
		if (!scene || !this.overlay) return;

		try { this.numberTween?.stop(); } catch {}
		this.numberTween = null;
		try { this.numberDisplay?.destroy(); } catch {}
		this.numberDisplay = null;
		try { this.numberContainer?.destroy(); } catch {}
		this.numberContainer = null;

		const cfg: NumberDisplayConfig = {
			x: scene.scale.width * 0.5,
			y: scene.scale.height * 0.55,
			scale: 0.55,
			spacing: 0,
			alignment: 'center',
			decimalPlaces: 2,
			showCommas: true,
			prefix: '$',
			suffix: '',
			commaYOffset: 12,
			dotYOffset: 10
		};

		const nd = new NumberDisplay(this.networkManager, this.screenModeManager, cfg);
		nd.create(scene);
		nd.displayValue(initial);
		this.numberDisplay = nd;
		try {
			if (this.currentDialogType === 'TotalW_TB') {
				const mx = Number(this.totalWinScaleMultiplierX);
				const my = Number(this.totalWinScaleMultiplierY);
				if (isFinite(mx) && mx > 0 && isFinite(my) && my > 0) {
					(nd as any).getContainer?.()?.setScale?.(mx, my);
				}
			}
		} catch {}
		try {
			const c: any = (nd as any)?.getContainer?.();
			if (c) {
				(c as any).__dialogsNumberBaseScaleX = Number((c as any).scaleX) || 1;
				(c as any).__dialogsNumberBaseScaleY = Number((c as any).scaleY) || 1;
			}
		} catch {}
		this.lastRenderedNumber = Number.NaN;
		this.numberAnimObj.value = initial;

		this.numberContainer = scene.add.container(0, 0);
		this.numberContainer.setDepth(10002);
		this.numberContainer.add(nd.getContainer());
		this.overlay.add(this.numberContainer);
		try { this.applyNumberDisplayAutoFit(true); } catch {}
		try {
			scene.time.delayedCall(0, () => {
				try { this.applyNumberDisplayAutoFit(true); } catch {}
			});
		} catch {}
	}

	private animateNumber(from: number, to: number, durationMs: number, startFromCurrent: boolean): void {
		const scene = this.scene;
		if (!scene || !this.numberDisplay) return;

		try { this.numberTween?.stop(); } catch {}
		this.numberTween = null;

		const start = startFromCurrent ? (Number(this.numberAnimObj.value) || 0) : from;
		this.numberAnimObj.value = start;
		this.lastRenderedNumber = Number.NaN;

		this.numberTween = scene.tweens.add({
			targets: this.numberAnimObj,
			value: to,
			duration: Math.max(0, durationMs | 0),
			ease: 'Power2',
			onUpdate: () => {
				const v = Number(this.numberAnimObj.value) || 0;
				const rounded = Math.floor(v * 100) / 100;
				if (rounded === this.lastRenderedNumber) return;
				this.lastRenderedNumber = rounded;
				try { this.numberDisplay!.displayValue(rounded); } catch {}
				try { this.applyNumberDisplayAutoFit(false); } catch {}
			}
		});
	}

	private playTierSfx(type: DialogType): void {
		try {
			const audioManager = (window as any).audioManager as AudioManager | undefined;
			if (!audioManager) return;
			if (typeof audioManager.duckBackground === 'function') {
				audioManager.duckBackground(0.3);
			}
			if (typeof audioManager.fadeOutCurrentWinSfx === 'function') {
				audioManager.fadeOutCurrentWinSfx(150);
			}
			switch (type) {
				case 'BigW_TB':
					audioManager.playSoundEffect(SoundEffectType.WIN_BIG as any);
					break;
				case 'MegaW_TB':
					audioManager.playSoundEffect(SoundEffectType.WIN_MEGA as any);
					break;
				case 'EpicW_TB':
					audioManager.playSoundEffect(SoundEffectType.WIN_EPIC as any);
					break;
				case 'SuperW_TB':
					audioManager.playSoundEffect(SoundEffectType.WIN_SUPER as any);
					break;
				case 'TotalW_TB':
					audioManager.playSoundEffect(SoundEffectType.DIALOG_CONGRATS as any);
					break;
			}
		} catch {}
	}

	private createContinueText(): void {
		const scene = this.scene;
		if (!scene || !this.overlay) return;
		try { this.continueText?.destroy(); } catch {}
		this.continueText = null;

		try {
			const t = scene.add.text(scene.scale.width * 0.5, scene.scale.height * 0.82, 'Press anywhere to continue', {
				fontFamily: 'Poppins-Bold',
				fontSize: '18px',
				color: '#FFFFFF'
			});
			t.setOrigin(0.5, 0.5);
			t.setDepth(10003);
			t.setAlpha(0);
			this.continueText = t;
			this.overlay.add(t);
			try {
				if (this.currentDialogType === 'TotalW_TB') {
					const mx = Number(this.totalWinScaleMultiplierX);
					const my = Number(this.totalWinScaleMultiplierY);
					if (isFinite(mx) && mx > 0 && isFinite(my) && my > 0) {
						(t as any).setScale?.(mx, my);
					}
				}
			} catch {}
			scene.tweens.add({ targets: t, alpha: 1, duration: 250, ease: 'Sine.easeOut', delay: 700 });
		} catch {}
	}

	private createClickCatcher(): void {
		const scene = this.scene;
		if (!scene || !this.overlay) return;
		try { this.clickCatcher?.removeAllListeners?.(); } catch {}
		try { (this.clickCatcher as any)?.disableInteractive?.(); } catch {}
		try { this.clickCatcher?.destroy(); } catch {}
		this.clickCatcher = null;

		try {
			const r = scene.add.rectangle(scene.scale.width * 0.5, scene.scale.height * 0.5, scene.scale.width, scene.scale.height, 0x000000, 0);
			r.setOrigin(0.5, 0.5);
			r.setDepth(10001);
			r.setInteractive();
			try { (r as any).input.enabled = true; } catch {}
			r.on('pointerdown', () => this.onClick(false));
			this.clickCatcher = r;
			this.overlay.add(r);
		} catch {}
	}

	private setClickCatcherEnabled(enabled: boolean): void {
		const r: any = this.clickCatcher as any;
		if (!r) return;
		try {
			if (r.input) {
				r.input.enabled = enabled;
			} else if (!enabled) {
				r.disableInteractive?.();
			}
		} catch {}
	}

	private cleanupVisuals(): void {
		try { this.numberTween?.stop(); } catch {}
		this.numberTween = null;
		try { this.numberDisplay?.destroy(); } catch {}
		this.numberDisplay = null;
		try { this.numberContainer?.destroy(); } catch {}
		this.numberContainer = null;
		try { this.currentDialog?.destroy?.(); } catch {}
		this.currentDialog = null;
		try { this.clickCatcher?.removeAllListeners?.(); } catch {}
		try { this.clickCatcher?.destroy(); } catch {}
		this.clickCatcher = null;
		try { this.continueText?.destroy(); } catch {}
		this.continueText = null;
		try {
			if (this.overlay) {
				this.overlay.setVisible(false);
				this.overlay.setAlpha(1);
			}
		} catch {}
		this.currentDialogType = null;
	}
}
