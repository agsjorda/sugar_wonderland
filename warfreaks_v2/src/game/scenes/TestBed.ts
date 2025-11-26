import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { SpineGameObject, TrackEntry } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, hideSpineAttachmentsByKeywords, playSpineAnimationSequence } from '../components/SpineBehaviorHelper';
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

		// this.loadSpineAsset(winPath, 'win_dialog');
		this.loadSpineAsset(winPath, 'total_win');
		this.loadSpineAsset(winPath, 'free_spin');
		this.loadSpineAsset(winPath, 'max_win');
		this.load.image('max_win_background', `${winPath}/max_win_background.png`);
		this.load.image('total_win_background', `${winPath}/total_win_background.png`);
		this.load.image('total_win_foreground', `${winPath}/total_win_foreground.png`);

		const logoPath = 'assets/portrait/high/logo';
		this.loadSpineAsset(logoPath, 'logo_250');

		const testPath = 'assets/portrait/high/background';

		this.loadSpineAsset(testPath, 'columns_rifle');

		const nukePath = 'assets/portrait/high/win';
		this.loadSpineAsset(nukePath, 'nuclear');

		const symbolPath = 'assets/portrait/high/symbols/Animations';
		this.loadSpineAsset(symbolPath, 'Symbol_LP_256');
		this.loadSpineAsset(symbolPath, 'Symbol_HP_256');

		const multiplierPath = 'assets/portrait/high/symbols/multipliers';
		this.loadSpineAsset(multiplierPath, 'multiplier_WF');
		this.loadSpineAsset(multiplierPath, 'multiplier_WF_frame');
		this.loadSpineAsset(multiplierPath, 'multiplier_WF_dove');
		for(let i = 0; i < 15; i++) {
			this.load.image(`multiplier_${i}`, `${multiplierPath}/multiplier_${i}.png`);
		}
	}

	create() {
		console.log('[TestBed] create');
		this.testPfx = new TestPfx();
		this.testPfx.create(this);

		// this.testPfx.createFeatherFx();
		
		// this.displayWinDialogueSpine();
		// this.displayTotalWinSpine();
		// this.displayFreeSpinSpine();
		// this.displayMaxWinSpine();
		// this.displayLogoSpine();
		// this.displayColumnRifleSpine();
		this.displayMultiplierWFSpine(0);
		// this.displayNuclearSpine();

		this.displayMultiplierSymbolSpine(14, 0.4);

		// this.displaySymbolLPSpine(1.75);
		// this.displaySymbolHPSpine(0);
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

	displayMultiplierWFSpine(timeScale: number = 1.0) {
		const spine = this.add.spine(0, 0, 'multiplier_WF-json', 'multiplier_WF-atlas') as SpineGameObject;
		const scale = { x: 1, y: 1 };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);

		spine.animationState.timeScale = timeScale;
	}

	displayMultiplierSymbolSpine(multiplierIndex: number, desiredScale: number = 0.99) {
		const framePosition = this.displayMultiplierFrameSpine(desiredScale);
		this.displayMultiplierDoveSpine(desiredScale);

		const offset = { x: 115 * desiredScale, y: 40 * desiredScale };
		const positionX = framePosition.x + offset.x;
		const positionY = framePosition.y + offset.y;
		this.multiplierImage = this.add.image(positionX, positionY, `multiplier_${multiplierIndex}`);
		this.multiplierImage.setDepth(2);
		this.multiplierImage.setOrigin(1, 0.5);
		this.multiplierImage.setScale(desiredScale);

		if (this.multiplierDove) {
			this.multiplierImageOffset = {
				x: this.multiplierImage.x - this.multiplierDove.x,
				y: this.multiplierImage.y - this.multiplierDove.y
			};
		}
	}

	displayMultiplierFrameSpine(desiredScale: number = 0.99) : {x: number, y: number} {
		const spine = this.add.spine(0, 0, 'multiplier_WF_frame-json', 'multiplier_WF_frame-atlas') as SpineGameObject;
		const scale = { x: desiredScale, y: desiredScale };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.505, y: 0.3475 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset, 0, false);
		spine.animationState.timeScale = 1;

		return {x: spine.x, y: spine.y};
	}

	displayMultiplierDoveSpine(desiredScale: number = 0.99) {
		this.multiplierDove = this.add.spine(0, 0, 'multiplier_WF_dove-json', 'multiplier_WF_dove-atlas') as SpineGameObject;
		const scale = { x: -desiredScale, y: desiredScale };
		const offset = { x: -20 * desiredScale, y: 0 * desiredScale };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, this.multiplierDove, [0], scale, anchor, origin, offset, 1);
		this.multiplierDove.animationState.timeScale = 1;

		const facingDirection = Math.sign(this.multiplierDove.scaleX);

		this.tweens.add({
			delay: 600,
			targets: this.multiplierDove,
			x: (this.multiplierDove.x + 500) * -facingDirection,
			y: this.multiplierDove.y - 300,
			duration: 2000,
			ease: 'Power2',
			onUpdate: () => {
				if (this.multiplierDove && this.multiplierImage && this.multiplierImageOffset) {
					this.multiplierImage.setPosition(
						this.multiplierDove.x + this.multiplierImageOffset.x,
						this.multiplierDove.y + this.multiplierImageOffset.y
					);
				}
			},
			onComplete: () => {
				const randomStartingX = Math.random() * this.scale.width;
				const randomStartingY = -Math.random() * this.scale.height * 0.1;

				const targetX = Math.random() * this.scale.width * 0.8 + this.scale.width * 0.1;
				const targetY = Math.random() * this.scale.height * 0.1 +  this.scale.height * 0.2;

				this.multiplierDove.setPosition(randomStartingX, randomStartingY);

				const facingScaleX = Math.sign(randomStartingX - targetX) * Math.abs(scale.x);
				this.multiplierDove.setScale(facingScaleX, scale.y);

				this.tweens.add({
					targets: this.multiplierDove,
					x: targetX,
					y: targetY,
					duration: 500,
					ease: 'Power2.easeIn',
					onUpdate: () => {
						if (this.multiplierDove && this.multiplierImage && this.multiplierImageOffset) {
							this.multiplierImage.setPosition(
								this.multiplierDove.x + this.multiplierImageOffset.x,
								this.multiplierDove.y + this.multiplierImageOffset.y
							);
						}
					},
					onComplete: () => {
						playSpineAnimationSequence(this, this.multiplierDove, [1], {x: facingScaleX, y: scale.y}, anchor, origin, offset, 1, false);
						this.multiplierDove.setPosition(targetX, targetY);
					}
				});
			}
		});
	}

	displaySymbolLPSpine(timeScale: number = 1.0) {
		const spine = this.add.spine(0, 0, 'Symbol_LP_256-json', 'Symbol_LP_256-atlas') as SpineGameObject;
		const scale = { x: 1, y: 1 };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.25 };
		const origin = { x: 0.5, y: 0.5 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);
		spine.animationState.timeScale = timeScale;
	}

	displaySymbolHPSpine(timeScale: number = 1.0) {
		const spine = this.add.spine(0, 0, 'Symbol_HP_256-json', 'Symbol_HP_256-atlas') as SpineGameObject;
		const scale = { x: 1, y: 1 };
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5};
		const origin = { x: 0.5, y: 0.5 };
		
		playSpineAnimationSequence(this, spine, [1], scale, anchor, origin, offset);

		spine.animationState.timeScale = timeScale;
	}
	displayNuclearSpine() {
		const spine = this.add.spine(0, 0, 'nuclear-json', 'nuclear-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, true);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.5 };

		const onComplete = () => {
			console.log('[TestBed] Nuclear spine animation completed');
			//create a tween on a spine that fades the spine out using a render texture snapshot
			const rt = this.add.renderTexture(0, 0, spine.width, spine.height);
			rt.setOrigin(0, 0);
			rt.setDepth(spine.depth ?? 0);
			rt.setAlpha(1);
			rt.draw(spine, spine.x, spine.y, spine.width, spine.height);
			spine.destroy();
			this.tweens.add({
				targets: rt,
				alpha: 0,
				duration: 500,
				ease: 'Power2',
				onComplete: () => {
				}
			});
		};

		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset, 0, false, onComplete);
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
		const background = this.add.image(this.scale.width / 2, this.scale.height / 2, 'max_win_background');
		background.setOrigin(0.5, 0.5);
		background.setDepth(0);
		const spine = this.add.spine(0, 0, 'max_win-json', 'max_win-atlas') as SpineGameObject;
		const scale = getFullScreenSpineScale(this, spine, false);
		const offset = { x: 0, y: 0 };
		const anchor = { x: 0.5, y: 0.5 };
		const origin = { x: 0.5, y: 0.51 };
		playSpineAnimationSequence(this, spine, [0], scale, anchor, origin, offset);

		hideSpineAttachmentsByKeywords(spine, ['feather_fx2', 'feather_fx']);

		this.testPfx.createFeatherFx();
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


