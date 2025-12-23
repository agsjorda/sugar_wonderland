import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { SpineGameObject, TrackEntry } from '@esotericsoftware/spine-phaser-v3';
import { getFullScreenSpineScale, hideSpineAttachmentsByKeywords, playSpineAnimationSequence } from '../components/SpineBehaviorHelper';
import { NumberDisplay, NumberDisplayConfig } from '../components/NumberDisplay';
import { TestPfx } from '../components/TestPfx';
import { SplitTransition } from '../components/SplitTransition';

interface DialogRequest {
	key: string;
	animation?: string;
	loop?: boolean;
	scale?: number;
	depth?: number;
	onComplete?: () => void;
}

export class TestBed extends Scene {
	public displaySize: number = 150;
	public numberDisplay: NumberDisplay;

	public targetSpine: SpineGameObject;
	testPfx: TestPfx;
	splitTransition: SplitTransition;

	private dialogDefinitions: Record<string, { atlasKey: string; scale?: number; depth?: number }> = {
		epic_win: { atlasKey: 'epic_win-atlas', scale: 0.5, depth: 100 },
		mega_win: { atlasKey: 'mega_win-atlas', scale: 0.5, depth: 100 },
	};
	private dialogQueue: DialogRequest[] = [];
	private dialogPlaying: boolean = false;
	private activeDialog?: SpineGameObject;
	private activeListener?: any;

	constructor() {
		super('TestBed');
	}

	init() {
		console.log('[TestBed] init');

		// Hide the HTML boot loader as soon as the TestBed scene starts
		try {
			const hideBootLoader = (window as any).hideBootLoader;
			if (typeof hideBootLoader === 'function') {
				hideBootLoader();
			}
		} catch (_e) {
			/* no-op */
		}

		EventBus.emit('current-scene-ready', this);
	}

	preload() {
		this.loadSpineAsset('assets/portrait/high/dialogs/epic_win', 'epic_win');
		this.loadSpineAsset('assets/portrait/high/dialogs/mega_win', 'mega_win');
	}

	create() {
		// Demo: queue a couple of dialogs; each advances when its animation completes
		this.queueDialog({ key: 'epic_win', animation: 'animation' });
		this.queueDialog({ key: 'mega_win', animation: 'animation' });
	}

	update()
	{
	}

	loadSpineAsset(path: string, name: string)
	{
		// Use consistent keys so we can reference them when creating the spine
		(this.load as any).spineAtlas(`${name}-atlas`, `${path}/${name}.atlas`);
		(this.load as any).spineJson(`${name}`, `${path}/${name}.json`);
	}

	createEpicWinDialog()
	{
		const { centerX, centerY } = this.cameras.main;

		// Create the epic win spine using the keys we loaded above
		const epicWinDialog = this.add.spine(centerX, centerY, 'epic_win', 'epic_win-atlas');
		epicWinDialog.setScale(0.5);
		epicWinDialog.setOrigin(0.5, 0.5);
		epicWinDialog.setDepth(100);

		playSpineAnimationSequence(epicWinDialog, [0], true);
	}

	createMegaWinDialog()
	{
		const { centerX, centerY } = this.cameras.main;

		// Create the mega win spine using the keys we loaded above
		const megaWinDialog = this.add.spine(centerX, centerY, 'mega_win', 'mega_win-atlas');
		megaWinDialog.setScale(0.5);
		megaWinDialog.setOrigin(0.5, 0.5);
		megaWinDialog.setDepth(100);

		playSpineAnimationSequence(megaWinDialog, [0], true);
	}

	queueDialog(request: DialogRequest)
	{
		this.dialogQueue.push(request);
		this.playNextDialog();
	}

	private playNextDialog()
	{
		if (this.dialogPlaying)
			return;

		const next = this.dialogQueue.shift();
		if (!next)
			return;

		const def = this.dialogDefinitions[next.key];
		if (!def) {
			console.warn(`[TestBed] Unknown dialog key "${next.key}"`);
			this.playNextDialog();
			return;
		}

		const { centerX, centerY } = this.cameras.main;
		const dialog = this.add.spine(centerX, centerY, next.key, def.atlasKey);
		dialog.setOrigin(0.5, 0.5);
		dialog.setDepth(next.depth ?? def.depth ?? 100);
		dialog.setScale(next.scale ?? def.scale ?? 1);

		this.activeDialog = dialog;
		this.dialogPlaying = true;

		const chosenAnimation = this.playAnimationOnSpine(dialog, next.animation, next.loop ?? false);
		if (!chosenAnimation) {
			this.finishDialog(next);
			return;
		}

		const state = (dialog as any)?.animationState;
		if (!state) {
			this.finishDialog(next);
			return;
		}

		const listener = {
			complete: (entry: any) => {
				try {
					const isTrack0 = entry?.trackIndex === 0;
					const animName = entry?.animation?.name ?? '';
					if (isTrack0 && animName === chosenAnimation) {
						state.removeListener(listener as any);
						this.finishDialog(next);
					}
				} catch { /* no-op */ }
			}
		};

		this.activeListener = listener;
		state.addListener(listener as any);
	}

	private finishDialog(request: DialogRequest)
	{
		this.clearActiveDialogListener();
		if (this.activeDialog) {
			this.activeDialog.destroy(true);
			this.activeDialog = undefined;
		}

		if (request.onComplete) {
			request.onComplete();
		}

		this.dialogPlaying = false;
		this.playNextDialog();
	}

	private clearActiveDialogListener()
	{
		try {
			if (this.activeDialog && this.activeListener) {
				(this.activeDialog as any)?.animationState?.removeListener(this.activeListener);
			}
		} catch { /* no-op */ }
		this.activeListener = undefined;
	}

	private playAnimationOnSpine(spine: SpineGameObject, requestedAnimation?: string, loop: boolean = false): string | undefined
	{
		try {
			const animations = ((spine as any)?.skeleton?.data?.animations || []) as Array<{ name: string }>;
			if (!animations.length) {
				console.warn('[TestBed] No animations found on spine dialog');
				return undefined;
			}

			const hasRequested = requestedAnimation && animations.some(a => a?.name === requestedAnimation);
			const chosen = hasRequested ? requestedAnimation as string : animations[0].name;

			if (!hasRequested && requestedAnimation) {
				console.warn(`[TestBed] Animation "${requestedAnimation}" not found; using "${chosen}" instead.`);
			}

			(spine as any)?.animationState?.setAnimation(0, chosen, loop);
			return chosen;
		} catch {
			return undefined;
		}
	}
}


