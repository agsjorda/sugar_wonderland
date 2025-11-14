import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { SpineGameObject, TrackEntry } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, hideSpineAttachmentsByKeywords, playSpineAnimationSequence } from '../components/SpineBehaviorHelper';
import { NumberDisplay, NumberDisplayConfig } from '../components/NumberDisplay';

export class TestBed extends Scene {
	public displaySize: number = 150;
	public numberDisplay: NumberDisplay;

	public targetSpine: SpineGameObject;

	constructor() {
		super('TestBed');
	}

	init() {
		console.log('[TestBed] init');
		EventBus.emit('current-scene-ready', this);
	}

	preload() {
		console.log('[TestBed] preload');

		const winPath = 'assets/portrait/high/win';

		// this.loadSpineAsset(winPath, 'win_dialog');
		this.loadSpineAsset(winPath, 'total_win');
		this.loadSpineAsset(winPath, 'free_spin');
		this.loadSpineAsset(winPath, 'max_win');

		const logoPath = 'assets/portrait/high/logo';
		this.loadSpineAsset(logoPath, 'logo_250');

		const testPath = 'assets/portrait/high/background';

		this.loadSpineAsset(testPath, 'columns_rifle');

		const nukePath = 'assets/portrait/high/win';
		this.loadSpineAsset(nukePath, 'nuclear');

		const symbolPath = 'assets/portrait/high/symbols/Animations';
		this.loadSpineAsset(symbolPath, 'Symbol_LP_256');
		this.loadSpineAsset(symbolPath, 'Symbol_HP_256');
	}

	create() {
		console.log('[TestBed] create');

		// this.displayWinDialogueSpine();
		// this.displayTotalWinSpine();
		// this.displayFreeSpinSpine();
		// this.displayMaxWinSpine();
		// this.displayLogoSpine();
		// this.displayColumnRifleSpine();
		// this.displayNuclearSpine();

		this.displaySymbolLPSpine();
		// this.displaySymbolHPSpine(0.15, 0.0);

	}

	update()
	{
		if (this.targetSpine) {
			let newY = this.targetSpine.y + 1;

			if(newY > this.scale.height) {
				newY = 0;
			}
			this.targetSpine.setPosition(this.targetSpine.x, newY);
		}
	}

	loadSpineAsset(path: string, name: string)
	{
		(this.load as any).spineAtlas(`${name}-atlas`, `${path}/${name}.atlas`);
		(this.load as any).spineJson(`${name}-json`, `${path}/${name}.json`);
	}

	displaySymbolLPSpine() {
		const spine = this.add.spine(0, 0, 'Symbol_LP_256-json', 'Symbol_LP_256-atlas') as SpineGameObject;
		const scale = { x: 1, y: 1 };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.25 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset, 0.9);

		// spine.animationState.timeScale = 1.0;
		// const current: any = spine.animationState.getCurrent(0);
		// if (current) {
		// 	current.trackTime = 1.7;
		// }
		// this.targetSpine = spine;
	}

	displaySymbolHPSpine(height: number, time: number) {
		const spine = this.add.spine(0, 0, 'Symbol_HP_256-json', 'Symbol_HP_256-atlas') as SpineGameObject;
		const scale = { x: 1, y: 1 };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: height};
		const origin = { x: 0.5, y: 0.5 };
		
		const randomTime = Math.random();
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset, time);
	}
	displayNuclearSpine() {
		const spine = this.add.spine(0, 0, 'nuclear-json', 'nuclear-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, true);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);
	}

	displayTotalWinSpine() {
		const spine = this.add.spine(0, 0, 'total_win-json', 'total_win-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, false);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.4 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);
	}

	displayWinDialogueSpine() {
		const spine = this.add.spine(0, 0, 'win_dialog-json', 'win_dialog-atlas') as SpineGameObject;
		const scale = 0.8;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.1 };
		const origin = { x: 0.5, y: 0 };
		playSpineAnimationSequence(this, spine, [7, 6, 5, 4, 3, 2, 1, 0], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayFreeSpinSpine() {
		const spine = this.add.spine(0, 0, 'free_spin-json', 'free_spin-atlas') as SpineGameObject;
		const scale = 1;
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, spine, [0, 1], { x: scale, y: scale }, anchor, origin, offset);
	}

	displayMaxWinSpine() {
		const spine = this.add.spine(0, 0, 'max_win-json', 'max_win-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, false);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.51 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);
	}

	displayLogoSpine()
	{
		const spine = this.add.spine(0, 0, 'logo_250-json', 'logo_250-atlas') as SpineGameObject;
		const scale = 1;
		const offset = {x: 0, y: 0};
		const anchor = {x: 0.5, y: 0.5};
		const origin = {x: 0.5, y: 0.5};

		// Attempt to hide flower-related elements if present
		hideSpineAttachmentsByKeywords(spine, ['bonus_base']);
		playSpineAnimationSequence(this, spine, [0], {x: scale, y: scale}, anchor, origin, offset);
	}

	displayColumnRifleSpine()
	{
		const spine = this.add.spine(0, 0, 'columns_rifle-json', 'columns_rifle-atlas') as SpineGameObject;
		const scale = 0.3;
		const offset = {x: 0, y: 0};
		const anchor = {x: 0.5, y: 0.5};
		const origin = {x: 0.5, y: 0.5};
		playSpineAnimationSequence(this, spine, [1], {x: scale, y: scale}, anchor, origin, offset);
	}
}


