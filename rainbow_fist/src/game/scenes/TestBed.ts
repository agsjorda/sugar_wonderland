import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { SpineGameObject, TrackEntry } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, hideSpineAttachmentsByKeywords, playSpineAnimationSequenceWithConfig } from '../components/SpineBehaviorHelper';
import { NumberDisplay, NumberDisplayConfig } from '../components/NumberDisplay';
import { TestPfx } from '../components/TestPfx';
import { SplitTransition } from '../components/SplitTransition';

export class TestBed extends Scene {
	public displaySize: number = 150;
	public numberDisplay: NumberDisplay;

	public targetSpine: SpineGameObject;
	testPfx: TestPfx;
	splitTransition: SplitTransition;

	private multiplierDove: SpineGameObject;
	private multiplierImage: GameObjects.Image;
	private multiplierImageOffset?: { x: number; y: number };

	constructor() {
		super('TestBed');
	}

	init() {
		console.log('[TestBed] init');
		EventBus.emit('current-scene-ready', this);
	}

	preload() {
		console.log('[TestBed] preload');

		const winPath = 'assets/portrait/high/dialogs';

		this.loadSpineAsset(winPath + '/BWin_RF', 'BWin_RF');
		this.loadSpineAsset(winPath + '/FreeSpin_RF', 'FreeSpin_RF');
		this.loadSpineAsset(winPath + '/MaxW_RF', 'MaxW_RF');

		for (let i = 0; i <= 5; i++) {
			const symbolBasePath = `assets/portrait/high/symbols/Symbol${i}_RF`;
			this.loadSpineAsset(symbolBasePath, `Symbol${i}_RF`);
		}
	}

	create() {
		const scale = 0.05

		this.displaySymbolSpine(0, scale, { x: 0.2, y: 0.75 }, 0, false);
		this.displaySymbolSpine(1, scale, { x: 0.5, y: 0.75 }, 1);
		this.displaySymbolSpine(2, scale, { x: 0.8, y: 0.75 }, 1);
		this.displaySymbolSpine(3, scale, { x: 0.2, y: 0.85 }, 1);
		this.displaySymbolSpine(4, scale, { x: 0.5, y: 0.85 }, 1);
		this.displaySymbolSpine(5, scale, { x: 0.8, y: 0.85 }, 0, false);
		this.displaySymbolSpine(5, scale, { x: 0.2, y: 0.95 }, 1);
		this.displaySymbolSpine(5, scale, { x: 0.5, y: 0.95 }, 2);
		this.displaySymbolSpine(5, scale, { x: 0.8, y: 0.95 }, 3);

		this.displayFreeSpinSpine({ x: 0.3, y: 0.2 });
		this.displayMaxWinSpine({ x: 0.7, y: 0.2 });
	}

	update() {
	}

	loadSpineAsset(path: string, name: string) {
		(this.load as any).spineAtlas(`${name}-atlas`, `${path}/${name}.atlas`);
		(this.load as any).spineJson(`${name}-json`, `${path}/${name}.json`);
	}
	displaySymbolSpine(i: number, scale: number = 1, anchor: { x: number, y: number } = { x: 0.5, y: 0.5 }, animIndex: number = 0, playAnim: boolean = true) {
		const spine = this.add.spine(0, 0, `Symbol${i}_RF-json`, `Symbol${i}_RF-atlas`) as SpineGameObject;
		const offset = { x: 0, y: 0 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [animIndex], { x: scale, y: scale }, anchor, origin, offset);
		spine.animationState.timeScale = playAnim ? 1 : 0;
	}

	displayTotalWinSpine() {
		const spine = this.add.spine(0, 0, 'total_win-json', 'total_win-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, false);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.4 };
		playSpineAnimationSequenceWithConfig(this, spine, [0], scale, anchor, origin, offset);
	}

	displayWinDialogueSpine() {
		const spine = this.add.spine(0, 0, 'win_dialog-json', 'win_dialog-atlas') as SpineGameObject;
		const scale = 0.8;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.1 };
		const origin = { x: 0.5, y: 0 };
		playSpineAnimationSequenceWithConfig(this, spine, [7, 6, 5, 4, 3, 2, 1, 0], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayFreeSpinSpine(anchor: { x: number, y: number } = { x: 0.5, y: 0.5 }) {
		const spine = this.add.spine(0, 0, 'FreeSpin_RF-json', 'FreeSpin_RF-atlas') as SpineGameObject;
		const scale = 0.1;
		const offset = { x: 0, y: 0 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [0, 1], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayMaxWinSpine(anchor: { x: number, y: number } = { x: 0.5, y: 0.5 }) {
		const spine = this.add.spine(0, 0, 'MaxW_RF-json', 'MaxW_RF-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, false);
		const offset = { x: 0, y: 0 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [0], scale, anchor, origin, offset);

		this.testPfx.createFeatherFx();
	}

	displayLogoSpine() {
		const spine = this.add.spine(0, 0, 'logo_250-json', 'logo_250-atlas') as SpineGameObject;
		const scale = 1;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };

		// Attempt to hide flower-related elements if present
		hideSpineAttachmentsByKeywords(spine, ['bonus_base']);
		playSpineAnimationSequenceWithConfig(this, spine, [0], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayColumnRifleSpine() {
		const spine = this.add.spine(0, 0, 'columns_rifle-json', 'columns_rifle-atlas') as SpineGameObject;
		const scale = 0.3;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [1], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayBigWinSpine() {
		const spine = this.add.spine(0, 0, 'BWin_RF-json', 'BWin_RF-atlas') as SpineGameObject;
		const scale = 1;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [0], { x: scale, y: scale }, anchor, origin, offset);
	}
}


