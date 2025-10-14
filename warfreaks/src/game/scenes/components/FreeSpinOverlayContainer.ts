import { Scene, GameObjects, Sound } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { Events } from './Events';
import { GameData } from './GameData';
import { AudioManager } from './AudioManager';
import { getDigitFontFamily } from '../../utils/fonts';

interface GameScene extends Scene {
	gameData: GameData;
	audioManager: AudioManager;
	buttons: any;
	autoplay: any;
	slotMachine: any;
}

export class FreeSpinOverlayContainer {
	private scene: GameScene;
	private container: GameObjects.Container;
	private spinsText: GameObjects.Text;
	private hintText: GameObjects.Text;
	private anim: SpineGameObject;
	private buttonZone: GameObjects.Zone;
	private isActive: boolean = false;

	constructor(scene: GameScene) {
		this.scene = scene;
		this.container = scene.add.container(0, 0);
		this.container.setDepth(10000);
		this.createOverlay();
	}

	private createOverlay(): void {
		const bg = this.scene.add.graphics();
		bg.fillStyle(0x000000, 0.7);
		bg.fillRect(0, 0, this.scene.scale.width * 2, this.scene.scale.height * 2);
		this.container.add(bg);

		const content = this.scene.add.container(this.scene.scale.width / 2, 0);
		this.container.add(content);

		this.anim = this.scene.add.spine(0, 0, 'freeSpinAnim', 'freeSpinAnim') as SpineGameObject;
		this.anim.setOrigin(0.5, 0);
        this.anim.setPosition(0, 50);
		content.add(this.anim);

		this.spinsText = this.scene.add.text(0, this.scene.scale.height * 0.625, '0', {
			fontSize: '72px',
			color: '#00FF88',
			fontFamily: getDigitFontFamily(),
			fontStyle: 'bold',
			align: 'center',
			stroke: '#004422',
			strokeThickness: 8,
            letterSpacing: 10
		});
		this.spinsText.setOrigin(0.5);
		content.add(this.spinsText);

		this.hintText = this.scene.add.text(0, this.scene.scale.height * 0.7, 'Press anywhere to continue', {
			fontSize: '20px',
			color: '#FFFFFF',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		this.hintText.setOrigin(0.5);
		content.add(this.hintText);

		this.buttonZone = this.scene.add.zone(0, 0, this.scene.scale.width, this.scene.scale.height);
		this.buttonZone.setInteractive(
			new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width * 2, this.scene.scale.height * 2),
			Phaser.Geom.Rectangle.Contains
		);
		content.add(this.buttonZone);

		this.buttonZone.on('pointerdown', () => {
			this.buttonZone.disableInteractive();
			this.endAndDestroy();
		});
	}

	public show(): void {
		if (this.isActive) return;
		this.isActive = true;
		try { (this.scene.audioManager.FreeSpinW as Sound.WebAudioSound)?.play(); } catch (_e) {}
		this.spinsText.setText(`${this.scene.gameData.totalFreeSpins?.toFixed?.(0) ?? this.scene.gameData.freeSpins ?? 0}`);
		// Notify listeners that the Free Spin overlay is now visible (for UI sync)
		try { Events.emitter.emit(Events.FREE_SPIN_OVERLAY_SHOW); } catch (_e) {}
		try {
			this.anim.animationState.setAnimation(0, 'freespin_WF_idle', true);
            // this.anim.animationState.addAnimation(0, 'free5spin_WF_idle', false); retrigger
		} catch (_e) {}
	}

	private endAndDestroy(): void {
		this.scene.tweens.add({
			targets: this.container,
			alpha: 0,
			duration: 600,
			ease: 'Power2',
			onComplete: () => this.destroy()
		});
	}

	public destroy(): void {
		if (!this.isActive) return;
		this.isActive = false;
		try { this.scene.slotMachine.activeWinOverlay = false; } catch (_e) {}
		try { this.scene.audioManager.stopWinSFX(this.scene); } catch (_e) {}
		try { Events.emitter.emit(Events.WIN_OVERLAY_HIDE); } catch (_e) {}
		this.container.destroy();
	}
}


