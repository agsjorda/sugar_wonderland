import { Scene } from 'phaser';
import { FreeSpinOverlay } from '../components/FreeSpinOverlay';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';

export interface FreeSpinRetriggerOverlayData {
	fromSceneKey?: string;
	overlayId?: number;
	spinsLeft?: number;
	multiplierKey?: string | null;
	multiplierOptionsByKey?: Record<string, { offsetX?: number; offsetY?: number; scale?: number }>;
}

export class FreeSpinRetriggerOverlayScene extends Scene {
	private overlay?: FreeSpinOverlay;
	private fromSceneKey: string = 'Game';
	private overlayId: number = 0;
	private spinsLeft: number = 0;
	private multiplierKey: string | null = null;
	private multiplierOptionsByKey: Record<string, { offsetX?: number; offsetY?: number; scale?: number }> = {};
	private networkManager?: NetworkManager;
	private screenModeManager?: ScreenModeManager;
	private isClosing: boolean = false;
	private wasFromSceneInputEnabled: boolean | null = null;
	private autoCloseTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super('FreeSpinRetriggerOverlay');
	}

	init(data: FreeSpinRetriggerOverlayData): void {
		try {
			this.fromSceneKey = (data?.fromSceneKey && typeof data.fromSceneKey === 'string') ? data.fromSceneKey : 'Game';
		} catch {
			this.fromSceneKey = 'Game';
		}
		try {
			this.overlayId = Number((data as any)?.overlayId) || 0;
		} catch {
			this.overlayId = 0;
		}
		this.spinsLeft = Number(data?.spinsLeft) || 0;
		try {
			this.multiplierKey = (typeof data?.multiplierKey === 'string' && data.multiplierKey.length > 0) ? data.multiplierKey : null;
		} catch {
			this.multiplierKey = null;
		}
		try {
			this.multiplierOptionsByKey = (data?.multiplierOptionsByKey && typeof data.multiplierOptionsByKey === 'object') ? data.multiplierOptionsByKey : {};
		} catch {
			this.multiplierOptionsByKey = {};
		}

		try {
			const from: any = this.scene?.get?.(this.fromSceneKey);
			this.networkManager = from?.networkManager as NetworkManager | undefined;
			this.screenModeManager = from?.screenModeManager as ScreenModeManager | undefined;
		} catch {
			this.networkManager = undefined;
			this.screenModeManager = undefined;
		}
	}

	create(): void {
		try { this.scene.bringToTop('FreeSpinRetriggerOverlay'); } catch {}
		try {
			this.events.once('shutdown', () => {
				try { this.autoCloseTimer?.destroy(); } catch {}
				try { this.autoCloseTimer = undefined; } catch {}
				try {
					if (!this.isClosing) {
						try {
							const from: any = this.scene?.get?.(this.fromSceneKey);
							from?.events?.emit?.('freeSpinRetriggerOverlayClosed', this.overlayId);
						} catch {}
						try {
							if (this.fromSceneKey) {
								const from: any = this.scene?.get?.(this.fromSceneKey);
								if (from?.input) {
									if (this.wasFromSceneInputEnabled !== null) {
										from.input.enabled = this.wasFromSceneInputEnabled;
									} else {
										from.input.enabled = true;
									}
								}
							}
						} catch {}
					}
				} catch {}
			});
		} catch {}
		try {
			if (this.fromSceneKey) {
				const from: any = this.scene?.get?.(this.fromSceneKey);
				try {
					if (typeof from?.input?.enabled === 'boolean') {
						this.wasFromSceneInputEnabled = from.input.enabled;
						from.input.enabled = false;
					}
				} catch {}
			}
		} catch {}

		this.overlay = new FreeSpinOverlay(this, this.networkManager, this.screenModeManager);
		try {
			for (const k of Object.keys(this.multiplierOptionsByKey || {})) {
				const opts = this.multiplierOptionsByKey[k];
				this.overlay.setMultiplierDisplayOptionsForKey(k, opts);
			}
		} catch {}

		this.overlay.show(this.spinsLeft, undefined, 'FreeSpinRetri_TB', this.multiplierKey);
		try {
			try { this.autoCloseTimer?.destroy(); } catch {}
			this.autoCloseTimer = this.time.delayedCall(3500, () => {
				this.requestClose();
			});
		} catch {}
		this.overlay.waitUntilDismissed().then(() => {
			this.requestClose();
		}).catch(() => {
			this.requestClose();
		});
	}

	private requestClose(): void {
		if (this.isClosing) return;
		this.isClosing = true;
		try { this.autoCloseTimer?.destroy(); } catch {}
		try { this.autoCloseTimer = undefined; } catch {}

		try {
			const from: any = this.scene?.get?.(this.fromSceneKey);
			from?.events?.emit?.('freeSpinRetriggerOverlayClosed', this.overlayId);
		} catch {}

		try {
			if (this.fromSceneKey) {
				const from: any = this.scene?.get?.(this.fromSceneKey);
				if (from?.input) {
					if (this.wasFromSceneInputEnabled !== null) {
						from.input.enabled = this.wasFromSceneInputEnabled;
					} else {
						from.input.enabled = true;
					}
				}
			}
		} catch {}

		try {
			this.scene.stop('FreeSpinRetriggerOverlay');
		} catch {
			try { this.scene.stop(); } catch {}
		}
	}
}
