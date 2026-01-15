import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { SpineGameObject, TrackEntry } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, hideSpineAttachmentsByKeywords, playSpineAnimationSequenceWithConfig } from '../components/SpineBehaviorHelper';
import { SplitTransition } from '../components/SplitTransition';

export class TestBed extends Scene {
	public displaySize: number = 150;

	public targetSpine: SpineGameObject;
	splitTransition: SplitTransition;

	constructor() {
		super('TestBed');
	}

	init() {
		// If the HTML bootloader overlay is present, hide it when entering TestBed directly.
		// (When TestBed is first in the Phaser scene list, Boot/Preloader never run.)
		try {
			const hideBootLoader = (window as any).hideBootLoader;
			if (typeof hideBootLoader === 'function') {
				hideBootLoader();
			}
			const setBootLoaderProgress = (window as any).setBootLoaderProgress;
			if (typeof setBootLoaderProgress === 'function') {
				setBootLoaderProgress(1);
			}
		} catch (_e) {
			/* no-op */
		}

		console.log('[TestBed] init');
		EventBus.emit('current-scene-ready', this);
	}

	preload() {
		console.log('[TestBed] preload');

		const sk8Path = 'assets/portrait/high/Sk8/FreeSpinDialog_Sk8_Anim';

		this.loadSpineAsset(sk8Path, 'FreeSpinDialog_Sk8_Anim');
	}

	create() {
		// this.addWhiteBackground();

		this.displayFreeSpinSk8Spine();
	}

	update() {
	}

	loadSpineAsset(path: string, name: string) {
		(this.load as any).spineAtlas(`${name}-atlas`, `${path}/${name}.atlas`);
		(this.load as any).spineJson(`${name}-json`, `${path}/${name}.json`);
	}

	displayFreeSpinSk8Spine(animIndex: number = 0) {
		const spine = this.add.spine(0, 0, 'FreeSpinDialog_Sk8_Anim-json', 'FreeSpinDialog_Sk8_Anim-atlas') as SpineGameObject;
		const scale = 0.1;
		const offset = { x: 0, y: 0 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequenceWithConfig(this, spine, [animIndex], { x: scale, y: scale }, { x: 0.5, y: 0.5 }, origin, offset);
	}
}


