import { Scene } from 'phaser';

interface SessionTimeoutOverlayOptions {
	panelWidth?: number;
	panelHeight?: number;
	onRefresh?: () => void;
}

export class SessionTimeoutOverlay {
	private scene: Scene;
	private container?: Phaser.GameObjects.Container;
	private overlayRect?: Phaser.GameObjects.Rectangle;
	private panel?: Phaser.GameObjects.Rectangle;
	private refreshButton?: Phaser.GameObjects.Rectangle;
	private refreshText?: Phaser.GameObjects.Text;
	private closeIcon?: Phaser.GameObjects.Text;
	private titleText?: Phaser.GameObjects.Text;
	private messageText?: Phaser.GameObjects.Text;
	private supportingText?: Phaser.GameObjects.Text;
	private options: SessionTimeoutOverlayOptions;
	private isCreated: boolean = false;

	constructor(scene: Scene, options?: SessionTimeoutOverlayOptions) {
		this.scene = scene;
		this.options = options || {};
	}

	public create(): void {
		if (this.isCreated) {
			return;
		}

		const width = this.scene.scale.width;
		const height = this.scene.scale.height;

		const panelWidth = this.options.panelWidth || Math.min(420, width * 0.85);
		const panelHeight = this.options.panelHeight || Math.min(460, height * 0.7);

		const container = this.scene.add.container(0, 0);
		container.setScrollFactor(0);
		container.setDepth(50000);
		container.setVisible(false);

		const overlayRect = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.75);
		overlayRect.setOrigin(0, 0);
		overlayRect.setScrollFactor(0);
		overlayRect.setInteractive({ useHandCursor: false });
		try { overlayRect.disableInteractive(); } catch {}
		container.add(overlayRect);

		const panel = this.scene.add.rectangle(width * 0.5, height * 0.5, panelWidth, panelHeight, 0x101010, 0.95);
		panel.setStrokeStyle(2, 0x2bff7d, 0.9);
		panel.setScrollFactor(0);
		panel.setInteractive({ useHandCursor: false });
		try { panel.disableInteractive(); } catch {}
		container.add(panel);

		const titleText = this.scene.add.text(panel.x, panel.y - panelHeight * 0.32, 'Session Time Out', {
			fontFamily: 'Poppins-Bold',
			fontSize: `${Math.round(panelHeight * 0.12)}px`,
			color: '#2bff7d',
			align: 'center'
		}).setOrigin(0.5, 0.5).setScrollFactor(0);
		container.add(titleText);

		const bodyText = 'Your session has expired.\nPlease log in again to keep playing.';
		const messageText = this.scene.add.text(panel.x, panel.y - panelHeight * 0.08, bodyText, {
			fontFamily: 'Poppins-Regular',
			fontSize: `${Math.round(panelHeight * 0.07)}px`,
			color: '#FFFFFF',
			align: 'center',
			wordWrap: { width: panelWidth * 0.8 }
		}).setOrigin(0.5, 0.5).setScrollFactor(0);
		container.add(messageText);

		const progressMessage = 'If you were actively playing a game, your progress has been saved, and you can pick up right where you left off after logging back in.';
		const progressText = this.scene.add.text(panel.x, panel.y + panelHeight * 0.14, progressMessage, {
			fontFamily: 'Poppins-Regular',
			fontSize: `${Math.round(panelHeight * 0.055)}px`,
			color: '#AAAAAA',
			align: 'center',
			wordWrap: { width: panelWidth * 0.84 }
		}).setOrigin(0.5, 0.5).setScrollFactor(0);
		container.add(progressText);

		const buttonWidth = panelWidth * 0.65;
		const buttonHeight = Math.max(56, panelHeight * 0.16);
		const refreshButton = this.scene.add.rectangle(panel.x, panel.y + panelHeight * 0.34, buttonWidth, buttonHeight, 0x2bff7d, 1);
		refreshButton.setOrigin(0.5, 0.5);
		refreshButton.setScrollFactor(0);
		refreshButton.setInteractive({ useHandCursor: true });
		try { refreshButton.disableInteractive(); } catch {}
		container.add(refreshButton);

		const refreshText = this.scene.add.text(refreshButton.x, refreshButton.y, 'REFRESH', {
			fontFamily: 'Poppins-Bold',
			fontSize: `${Math.round(buttonHeight * 0.45)}px`,
			color: '#000000',
			align: 'center'
		}).setOrigin(0.5, 0.5).setScrollFactor(0);
		container.add(refreshText);

		const closeIcon = this.scene.add.text(panel.x + panelWidth * 0.42, panel.y - panelHeight * 0.42, 'X', {
			fontFamily: 'Poppins-Bold',
			fontSize: `${Math.round(panelHeight * 0.08)}px`,
			color: '#FFFFFF',
			align: 'center'
		}).setOrigin(0.5, 0.5).setScrollFactor(0);
		closeIcon.setAlpha(0.8);
		closeIcon.setInteractive({ useHandCursor: true });
		try { (closeIcon as any).disableInteractive?.(); } catch {}
		container.add(closeIcon);

		refreshButton.on('pointerover', () => {
			refreshButton.setFillStyle(0x48ffa1, 1);
		});
		refreshButton.on('pointerout', () => {
			refreshButton.setFillStyle(0x2bff7d, 1);
		});
		refreshButton.on('pointerdown', () => {
			refreshButton.setScale(0.98);
		});
		refreshButton.on('pointerup', () => {
			refreshButton.setScale(1);
			this.handleRefresh();
		});

		closeIcon.on('pointerup', () => {
			this.handleRefresh();
		});

		this.scene.scale.on('resize', this.handleResize, this);

		this.container = container;
		this.overlayRect = overlayRect;
		this.panel = panel;
		this.refreshButton = refreshButton;
		this.refreshText = refreshText;
		this.closeIcon = closeIcon;
		this.titleText = titleText;
		this.messageText = messageText;
		this.supportingText = progressText;
		this.isCreated = true;
	}

	public show(onRefresh?: () => void): void {
		if (!this.isCreated) {
			this.create();
		}
		if (!this.container) {
			return;
		}
		if (onRefresh) {
			this.options.onRefresh = onRefresh;
		}
		try {
			const anyOverlay: any = this.overlayRect as any;
			if (anyOverlay?.input) anyOverlay.input.enabled = true;
			else this.overlayRect?.setInteractive?.({ useHandCursor: false });
		} catch {}
		try {
			const anyPanel: any = this.panel as any;
			if (anyPanel?.input) anyPanel.input.enabled = true;
			else this.panel?.setInteractive?.({ useHandCursor: false });
		} catch {}
		try {
			const anyBtn: any = this.refreshButton as any;
			if (anyBtn?.input) anyBtn.input.enabled = true;
			else this.refreshButton?.setInteractive?.({ useHandCursor: true });
		} catch {}
		try {
			const anyClose: any = this.closeIcon as any;
			if (anyClose?.input) anyClose.input.enabled = true;
			else this.closeIcon?.setInteractive?.({ useHandCursor: true });
		} catch {}
		this.container.setVisible(true);
		this.container.setAlpha(0);
		this.scene.tweens.add({
			targets: this.container,
			alpha: 1,
			duration: 200,
			ease: 'Quad.easeOut'
		});
	}

	public hide(): void {
		if (!this.container) {
			return;
		}
		this.scene.tweens.add({
			targets: this.container,
			alpha: 0,
			duration: 150,
			ease: 'Quad.easeIn',
			onComplete: () => {
				this.container?.setVisible(false);
				try { this.overlayRect?.disableInteractive?.(); } catch {}
				try { this.panel?.disableInteractive?.(); } catch {}
				try { this.refreshButton?.disableInteractive?.(); } catch {}
				try { (this.closeIcon as any)?.disableInteractive?.(); } catch {}
			}
		});
	}

	public destroy(): void {
		this.scene.scale.off('resize', this.handleResize, this);
		try { this.overlayRect?.disableInteractive?.(); } catch {}
		try { this.panel?.disableInteractive?.(); } catch {}
		try { this.refreshButton?.disableInteractive?.(); } catch {}
		try { (this.closeIcon as any)?.disableInteractive?.(); } catch {}
		try { this.container?.destroy(); } catch {}
		this.container = undefined;
		this.overlayRect = undefined;
		this.panel = undefined;
		this.refreshButton = undefined;
		this.refreshText = undefined;
		this.closeIcon = undefined;
		this.titleText = undefined;
		this.messageText = undefined;
		this.supportingText = undefined;
		this.isCreated = false;
	}

	private handleResize(gameSize: Phaser.Structs.Size): void {
		if (!this.container || !this.overlayRect || !this.panel) {
			return;
		}
		const width = gameSize.width;
		const height = gameSize.height;
		this.overlayRect.setSize(width, height);
		const panelWidth = this.options.panelWidth || Math.min(420, width * 0.85);
		const panelHeight = this.options.panelHeight || Math.min(460, height * 0.7);
		this.panel.setPosition(width * 0.5, height * 0.5);
		this.panel.setSize(panelWidth, panelHeight);
		if (this.titleText) {
			this.titleText.setPosition(this.panel.x, this.panel.y - panelHeight * 0.32);
			this.titleText.setFontSize(Math.round(panelHeight * 0.12));
		}
		if (this.messageText) {
			this.messageText.setPosition(this.panel.x, this.panel.y - panelHeight * 0.08);
			this.messageText.setFontSize(Math.round(panelHeight * 0.07));
			this.messageText.setWordWrapWidth(panelWidth * 0.8, true);
		}
		if (this.refreshButton && this.refreshText) {
			const buttonWidth = panelWidth * 0.65;
			const buttonHeight = Math.max(56, panelHeight * 0.16);
			this.refreshButton.setPosition(this.panel.x, this.panel.y + panelHeight * 0.34);
			this.refreshButton.setSize(buttonWidth, buttonHeight);
			this.refreshText.setPosition(this.refreshButton.x, this.refreshButton.y);
			this.refreshText.setFontSize(Math.round(buttonHeight * 0.45));
		}
		if (this.supportingText) {
			this.supportingText.setPosition(this.panel.x, this.panel.y + panelHeight * 0.14);
			this.supportingText.setFontSize(Math.round(panelHeight * 0.055));
			this.supportingText.setWordWrapWidth(panelWidth * 0.84, true);
		}
		if (this.closeIcon) {
			this.closeIcon.setPosition(this.panel.x + panelWidth * 0.42, this.panel.y - panelHeight * 0.42);
			this.closeIcon.setFontSize(Math.round(panelHeight * 0.08));
		}
	}

	private handleRefresh(): void {
		if (typeof this.options.onRefresh === 'function') {
			try {
				this.options.onRefresh();
			} catch (e) {
				console.warn('[SessionTimeoutOverlay] onRefresh handler error:', e);
			}
			return;
		}
		try {
			window.location.reload();
		} catch (e) {
			console.warn('[SessionTimeoutOverlay] Failed to reload window:', e);
		}
	}
}

