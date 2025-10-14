import { Scene, GameObjects, Sound } from 'phaser';
import { SpineGameObject, TextureWrap } from '@esotericsoftware/spine-phaser-v3';
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

export class CongratsOverlayContainer {
	private scene: GameScene;
	private container: GameObjects.Container;
	private titleText: GameObjects.Text;
	private amountText: GameObjects.Text;
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

		this.anim = this.scene.add.spine(0, 0, 'totalWinAnim', 'totalWinAnim') as SpineGameObject;
		this.anim.setOrigin(0.5, 0);
        this.anim.setScale(1);
        this.anim.setPosition(20, 50);
		content.add(this.anim);

		this.amountText = this.scene.add.text(0, this.scene.scale.height * 0.625, '0.00', {
			fontSize: '80px',
			color: '#00FF88',
			fontFamily: getDigitFontFamily(),
			fontStyle: 'bold',
			align: 'center',
			stroke: '#004422',
			strokeThickness: 8
		});
		this.amountText.setOrigin(0.5);
		content.add(this.amountText);

		this.hintText = this.scene.add.text(0, this.scene.scale.height * 0.7, 'Press anywhere to continue', {
			fontSize: '20px',
			color: '#00FF88',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center',
			stroke: '#000000',
			strokeThickness: 1
		});
		this.hintText.setOrigin(0.5);
        this.hintText.setVisible(false);
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

	public show(totalWin: number): void {
		if (this.isActive) return;
		this.isActive = true;
		try { (this.scene.audioManager.CongratsW as Sound.WebAudioSound)?.play(); } catch (_e) {}
		this.amountText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
		try {
			this.anim.animationState.setAnimation(0, 'total_win_win', false);
			this.anim.animationState.addAnimation(0, 'total_win_idle', true);
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
		// After Congrats closes, toggle back to main/base game
		try { this.scene.gameData.isBonusRound = false; } catch (_e) {}
		try { this.scene.background.toggleBackground(this.scene); } catch (_e) {}
		try { this.scene.slotMachine.toggleBackground(this.scene); } catch (_e) {}
		try { this.scene.audioManager.changeBackgroundMusic(this.scene); } catch (_e) {}
		this.container.destroy();
	}
}


