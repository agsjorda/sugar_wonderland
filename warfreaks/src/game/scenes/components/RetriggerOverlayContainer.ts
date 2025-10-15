import { Scene, GameObjects } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { Events } from './Events';

interface GameScene extends Scene {
	buttons: any;
	slotMachine: any;
	audioManager: any;
}

export class RetriggerOverlayContainer {
	private scene: GameScene;
	private container: GameObjects.Container;
	private contentContainer: GameObjects.Container;
	private buttonZone: GameObjects.Zone;
	private inputLocked: boolean = false;
	private onSpaceDown?: (event: KeyboardEvent) => void;

	constructor(scene: GameScene) {
		this.scene = scene;
		this.container = this.scene.add.container(0, 0);
		this.container.setDepth(10000);
		this.container.setScale(0.5);

		// Semi-transparent fullscreen dimmer
		const dim = this.scene.add.graphics();
		dim.fillStyle(0x000000, 0.7);
		dim.fillRect(0, 0, 428 * 2, 926 * 2);
		this.container.add(dim);

		// Centered content container
		this.contentContainer = this.scene.add.container(428, 926);
		this.container.add(this.contentContainer);

		// Fullscreen interactive zone for click-to-continue
		this.buttonZone = this.scene.add.zone(0, 0, 428, 926);
		this.buttonZone.setInteractive(
			new Phaser.Geom.Rectangle(0, 0, 428 * 2, 926 * 2),
			Phaser.Geom.Rectangle.Contains
		);
		this.container.add(this.buttonZone);
	}

	public show(onClose?: () => void): void {
		// Play Free Spin retrigger animation
		let retriggerAnim: SpineGameObject | undefined;
		try {
			retriggerAnim = this.scene.add.spine(0, 0, 'freeSpinAnim', 'freeSpinAnim') as SpineGameObject;
			retriggerAnim.setOrigin(0.5, 0.5);
			retriggerAnim.setScale(2);
			// Ensure the animation sits above bg but below text
			this.contentContainer.addAt(retriggerAnim, 1);
			retriggerAnim.animationState.setAnimation(0, 'free5spin_WF_idle', false);
			// Play multi_wf.ogg instead of missile_wf.ogg for retrigger
			try { (this.scene.audioManager as any).MultiSFX?.play({ volume: this.scene.audioManager.getSFXVolume?.() || 1 }); } catch (_e) {}
		} catch (_e) {
			// Fallback: if spine not available, keep bg+text only
		}

		// Brief pause before allowing skip
		this.inputLocked = true;
		this.scene.time.delayedCall(400, () => {
			this.inputLocked = false;
		});

		// Pointer skip
		//this.buttonZone.on('pointerdown', () => this.tryClose(onClose));

		// Auto-close after a brief moment (retrigger overlay auto-dismiss)
		this.scene.time.delayedCall(666, () => this.tryClose(onClose));

		// Notify overlay shown and block win overlay queue in slotMachine
		if (this.scene.slotMachine) {
			this.scene.slotMachine.activeWinOverlay = true;
		}
		Events.emitter.emit(Events.WIN_OVERLAY_SHOW);
	}

	private tryClose(onClose?: () => void): void {
		if (this.inputLocked) return;
		this.end(() => {
			if (onClose) onClose();
		});
	}

	private end(cb: () => void): void {
		this.scene.tweens.add({
			targets: this.container,
			alpha: 0,
			duration: 666,
			ease: 'Power2',
			onComplete: () => {
				cb();
				this.destroy();
			}
		});
	}

	public destroy(): void {
		if (this.onSpaceDown && this.scene.input.keyboard) {
			this.scene.input.keyboard.off('keydown-SPACE', this.onSpaceDown);
			this.onSpaceDown = undefined;
		}
		if (this.scene.slotMachine) {
			this.scene.slotMachine.activeWinOverlay = false;
		}
		this.container.destroy();
		Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
	}
}


