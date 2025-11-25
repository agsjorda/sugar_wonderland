import Phaser, { Scene } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { Bone, Vector2 as SpineVector2 } from '@esotericsoftware/spine-core';
import { EventBus } from '../EventBus';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { ensureSpineFactory, ensureSpineLoader } from '../../utils/SpineGuard';
import { resolveAssetUrl } from '../../utils/AssetLoader';

const DRAGON_SPINE_KEY = 'dragon_default';
const DRAGON_SPINE_ATLAS_KEY = 'dragon_default-atlas';
const DRAGON_ASSET_PATH = 'assets/portrait/high/background';
const DRAGON_START_BONE = 'bone_start';
const DRAGON_TIP_BONE = 'bone_end';

type SceneTransferData = {
	networkManager?: NetworkManager;
	screenModeManager?: ScreenModeManager;
};

/**
 * Temporary placeholder scene that appears after the preloader.
 * Displays a white background and allows the user to continue to the main game.
 */
export class TemporaryScene extends Scene
{
	private networkManager?: NetworkManager;
	private screenModeManager?: ScreenModeManager;
	private dragon?: SpineGameObject;
	private ropeBones: Bone[] = [];
	private ropeGraphic?: Phaser.GameObjects.Graphics;
	private startPointer?: Phaser.GameObjects.Arc;
	private endPointer?: Phaser.GameObjects.Arc;
	private anchorHome: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
	private targetPoint: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
	private tipMarker?: Phaser.GameObjects.Arc;
	private startBone?: Bone;
	private tipBone?: Bone;
	private ropeNodes: Phaser.Math.Vector2[] = [];
	private ropePrevNodes: Phaser.Math.Vector2[] = [];
	private ropeLengths: number[] = [];
	private ropeSkeletonNodes: Phaser.Math.Vector2[] = [];
	private readonly ropeIterations = 6;
	private readonly maxTimeStep = 1 / 30;
	private ropeGravity = 2600;
	private readonly dragBoundsPadding = 24;

	constructor ()
	{
		super('TemporaryScene');
	}

	init (data: SceneTransferData)
	{
		this.networkManager = data?.networkManager;
		this.screenModeManager = data?.screenModeManager;
	}

	preload ()
	{
		// Ensure the Spine loader exists before queueing assets
		if (!ensureSpineLoader(this, '[TemporaryScene] preload')) {
			ensureSpineFactory(this, '[TemporaryScene] preload.factory');
		}

		const hasSpineSupport = typeof (this.load as any).spineJson === 'function' && typeof (this.load as any).spineAtlas === 'function';
		if (hasSpineSupport) {
			this.load.spineAtlas(DRAGON_SPINE_ATLAS_KEY, resolveAssetUrl(`${DRAGON_ASSET_PATH}/dragon_default.atlas`));
			this.load.spineJson(DRAGON_SPINE_KEY, resolveAssetUrl(`${DRAGON_ASSET_PATH}/dragon_default.json`));
		} else {
			console.warn('[TemporaryScene] Spine loader is unavailable. Dragon showcase will be skipped.');
		}
	}

	create ()
	{
		this.cameras.main.setBackgroundColor('#FFFFFF');
		this.cameras.main.fadeIn(250, 255, 255, 255);

		const title = this.add.text(
			this.scale.width * 0.5,
			this.scale.height * 0.4,
			'Prototype Workspace',
			{
				fontFamily: 'Poppins-Bold, Arial, sans-serif',
				fontSize: '30px',
				color: '#111111',
				align: 'center'
			}
		).setOrigin(0.5);

		const subtitle = this.add.text(
			this.scale.width * 0.5,
			title.y + 52,
			'Use this scene to iterate on new features.',
			{
				fontFamily: 'Poppins-Regular, Arial, sans-serif',
				fontSize: '18px',
				color: '#555555',
				align: 'center',
				wordWrap: { width: this.scale.width * 0.8 }
			}
		).setOrigin(0.5);

		const status = this.add.text(
			this.scale.width * 0.5,
			subtitle.y + 38,
			'Reload the app when changes are ready to test.',
			{
				fontFamily: 'Poppins-Regular, Arial, sans-serif',
				fontSize: '16px',
				color: '#777777',
				align: 'center',
				wordWrap: { width: this.scale.width * 0.8 }
			}
		).setOrigin(0.5);

		this.tweens.add({
			targets: [subtitle, status],
			alpha: { from: 0.35, to: 0.95 },
			duration: 1600,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
			delay: (_target, key, value, targetIndex) => targetIndex * 200
		});

		EventBus.emit('current-scene-ready', this);

		this.spawnDragonRopeShowcase();
	}

	update (_time: number, delta: number)
	{
		this.simulateRope(delta);
		this.renderRopeGraphic();
		this.updateTipMarkerPosition();
	}

	private spawnDragonRopeShowcase(): void
	{
		if (!ensureSpineFactory(this, '[TemporaryScene] spawnDragonRopeShowcase')) {
			return;
		}

		if (!this.cache.json.has(DRAGON_SPINE_KEY)) {
			console.warn('[TemporaryScene] Dragon spine data is missing from cache. Did preload() run?');
			return;
		}

		const x = this.scale.width * 0.15;
		const y = this.scale.height * 0.25;
		this.dragon = this.add.spine(x, y, DRAGON_SPINE_KEY, DRAGON_SPINE_ATLAS_KEY);
		this.dragon.setOrigin(0, 0.5);
		const baseWidth = this.dragon.width || 1;
		const scale = (this.scale.width * 0.9) / baseWidth;
		this.dragon.setScale(scale, scale);
		this.dragon.setDepth(4);
		this.dragon.setVisible(false);
		this.dragon.animationState.clearTracks();
		this.dragon.animationState.setEmptyAnimation(0, 0);

		this.startBone = this.dragon.skeleton.findBone(DRAGON_START_BONE) ?? undefined;
		this.tipBone = this.dragon.skeleton.findBone(DRAGON_TIP_BONE) ?? undefined;
		this.buildRopeChain();

		this.ropeGraphic?.destroy();
		this.ropeGraphic = this.add.graphics();
		this.ropeGraphic.setDepth(28);

		const anchorX = this.scale.width * 0.75;
		const anchorY = this.scale.height * 0.25;
		this.createStartPointer(anchorX - 220, anchorY - 60);
		this.createEndPointer(anchorX, anchorY);
		this.initializeRopeNodes();
		this.createTipMarker();
		this.updateTipMarkerPosition();
	}

	private createStartPointer(x: number, y: number): void
	{
		const clampX = (value: number) => Phaser.Math.Clamp(value, this.dragBoundsPadding, this.scale.width - this.dragBoundsPadding);
		const clampY = (value: number) => Phaser.Math.Clamp(value, this.dragBoundsPadding, this.scale.height - this.dragBoundsPadding);

		this.startPointer?.destroy();
		this.startPointer = this.add.circle(x, y, 18, 0x56a0ff, 0.85)
			.setStrokeStyle(3, 0x0f1a3d, 0.9)
			.setDepth(29)
			.setInteractive({ useHandCursor: true, draggable: true });
		this.input.setDraggable(this.startPointer);

		this.startPointer.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			const clampedX = clampX(dragX);
			const clampedY = clampY(dragY);
			this.anchorHome.set(clampedX, clampedY);
			this.startPointer?.setPosition(clampedX, clampedY);
			this.pinRopeAnchors(true);
		});

		this.startPointer.on('dragstart', () => this.startPointer?.setScale(1.08));
		this.startPointer.on('dragend', () => this.startPointer?.setScale(1));
		this.anchorHome.set(clampX(x), clampY(y));
		this.pinRopeAnchors(true);
	}

	private createEndPointer(x: number, y: number): void
	{
		const clampX = (value: number) => Phaser.Math.Clamp(value, this.dragBoundsPadding, this.scale.width - this.dragBoundsPadding);
		const clampY = (value: number) => Phaser.Math.Clamp(value, this.dragBoundsPadding, this.scale.height - this.dragBoundsPadding);

		this.endPointer?.destroy();
		this.endPointer = this.add.circle(x, y, 20, 0xff6a2c, 0.9)
			.setStrokeStyle(3, 0xffffff, 0.95)
			.setDepth(30)
			.setInteractive({ useHandCursor: true, draggable: true });
		this.input.setDraggable(this.endPointer);

		this.endPointer.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			const clampedX = clampX(dragX);
			const clampedY = clampY(dragY);
			this.endPointer?.setPosition(clampedX, clampedY);
			this.targetPoint.set(clampedX, clampedY);
			this.pinRopeAnchors(true);
		});

		this.endPointer.on('dragstart', () => this.endPointer?.setScale(1.08));
		this.endPointer.on('dragend', () => this.endPointer?.setScale(1));
		this.targetPoint.set(clampX(x), clampY(y));
		this.pinRopeAnchors(true);
	}

	private createTipMarker(): void
	{
		this.tipMarker?.destroy();
		this.tipMarker = this.add.circle(0, 0, 6, 0x32f490, 0.55)
			.setStrokeStyle(2, 0x0b3c23, 0.9)
			.setDepth(32);
	}

	private updateTipMarkerPosition(): void
	{
		if (!this.tipMarker || this.ropeNodes.length === 0) {
			return;
		}
		const tipPoint = this.ropeNodes[this.ropeNodes.length - 1];
		this.tipMarker.setPosition(tipPoint.x, tipPoint.y);
	}

	private renderRopeGraphic(): void
	{
		if (!this.ropeGraphic || this.ropeNodes.length === 0) {
			return;
		}
		this.ropeGraphic.clear();
		this.ropeGraphic.lineStyle(14, 0x11161f, 1);
		this.ropeGraphic.beginPath();
		const first = this.ropeNodes[0];
		this.ropeGraphic.moveTo(first.x, first.y);
		for (let i = 1; i < this.ropeNodes.length; i++) {
			const pt = this.ropeNodes[i];
			this.ropeGraphic.lineTo(pt.x, pt.y);
		}
		this.ropeGraphic.strokePath();
		this.ropeGraphic.lineStyle(6, 0x29b1ff, 0.35);
		this.ropeGraphic.beginPath();
		this.ropeGraphic.moveTo(first.x, first.y);
		for (let i = 1; i < this.ropeNodes.length; i++) {
			const pt = this.ropeNodes[i];
			this.ropeGraphic.lineTo(pt.x, pt.y);
		}
		this.ropeGraphic.strokePath();
	}

	private buildRopeChain(): void
	{
		if (!this.dragon) {
			this.ropeBones = [];
			return;
		}
		const start = this.dragon.skeleton.findBone(DRAGON_START_BONE);
		const tip = this.dragon.skeleton.findBone(DRAGON_TIP_BONE);
		if (!start || !tip) {
			console.warn('[TemporaryScene] Unable to find rope bones in skeleton.');
			this.ropeBones = [];
			return;
		}
		const chain: Bone[] = [];
		let walker: Bone | null = tip;
		while (walker && walker !== start) {
			chain.push(walker);
			walker = walker.parent as Bone;
		}
		chain.push(start);
		chain.reverse();
		this.ropeBones = chain;
	}

	private initializeRopeNodes(): void
	{
		const segments = this.ropeBones.length;
		if (segments === 0) {
			this.ropeNodes = [];
			this.ropePrevNodes = [];
			this.ropeSkeletonNodes = [];
			this.ropeLengths = [];
			return;
		}
		const nodesCount = segments + 1;
		this.ropeNodes = [];
		this.ropePrevNodes = [];
		this.ropeSkeletonNodes = [];
		this.ropeLengths = [];

		const start = this.anchorHome.clone();
		const end = this.targetPoint.clone();

		const scale = this.dragon ? this.dragon.scaleX : 1;
		const boneLengths = this.ropeBones.map((bone) => (bone.data.length || 1) * scale);
		const directLength = Phaser.Math.Distance.BetweenPoints(start, end);
		const totalLength = boneLengths.reduce((sum, len) => sum + len, 0) || directLength || segments;

		const cumulative: number[] = [0];
		for (let i = 0; i < boneLengths.length; i++) {
			cumulative[i + 1] = cumulative[i] + boneLengths[i];
		}

		for (let i = 0; i < nodesCount; i++) {
			const t = cumulative[i] / totalLength;
			const x = Phaser.Math.Linear(start.x, end.x, t);
			const y = Phaser.Math.Linear(start.y, end.y, t);
			this.ropeNodes.push(new Phaser.Math.Vector2(x, y));
			this.ropePrevNodes.push(new Phaser.Math.Vector2(x, y));
			this.ropeSkeletonNodes.push(new Phaser.Math.Vector2());
			if (i < segments) {
				this.ropeLengths.push(boneLengths[i] || (totalLength / segments));
			}
		}
		this.pinRopeAnchors(true);
	}

	private simulateRope(delta: number): void
	{
		if (!this.ropeNodes.length) {
			return;
		}
		const dt = Math.min(delta / 1000, this.maxTimeStep);
		this.pinRopeAnchors();

		for (let i = 1; i < this.ropeNodes.length - 1; i++) {
			const pos = this.ropeNodes[i];
			const prev = this.ropePrevNodes[i];
			const velX = pos.x - prev.x;
			const velY = pos.y - prev.y;
			prev.set(pos.x, pos.y);
			pos.x += velX;
			pos.y += velY + this.ropeGravity * dt * dt;
		}

		for (let iter = 0; iter < this.ropeIterations; iter++) {
			for (let i = 0; i < this.ropeLengths.length; i++) {
				const p1 = this.ropeNodes[i];
				const p2 = this.ropeNodes[i + 1];
				const restLength = this.ropeLengths[i];
				let dx = p2.x - p1.x;
				let dy = p2.y - p1.y;
				let dist = Math.sqrt(dx * dx + dy * dy);
				if (dist === 0) {
					dist = 0.0001;
				}
				const diff = (dist - restLength) / dist;
				if (i !== 0) {
					p1.x += dx * diff * 0.5;
					p1.y += dy * diff * 0.5;
				}
				if (i + 1 !== this.ropeNodes.length - 1) {
					p2.x -= dx * diff * 0.5;
					p2.y -= dy * diff * 0.5;
				}
			}
			this.pinRopeAnchors();
		}
	}

	private pinRopeAnchors(resetPrev = false): void
	{
		if (!this.ropeNodes.length) {
			return;
		}
		const first = this.ropeNodes[0];
		first.set(this.anchorHome.x, this.anchorHome.y);
		const lastIndex = this.ropeNodes.length - 1;
		const last = this.ropeNodes[lastIndex];
		last.set(this.targetPoint.x, this.targetPoint.y);
		if (this.ropePrevNodes[0]) {
			this.ropePrevNodes[0].set(first.x, first.y);
		}
		if (this.ropePrevNodes[lastIndex]) {
			this.ropePrevNodes[lastIndex].set(last.x, last.y);
		}
		if (resetPrev) {
			for (let i = 1; i < this.ropePrevNodes.length - 1; i++) {
				if (this.ropePrevNodes[i]) {
					this.ropePrevNodes[i].set(this.ropeNodes[i].x, this.ropeNodes[i].y);
				}
			}
		}
	}

	private applyRopePose(): void
	{
		if (!this.dragon || !this.ropeBones.length) {
			return;
		}
		this.cacheSkeletonSpaceNodes();
		for (let i = 0; i < this.ropeBones.length; i++) {
			const bone = this.ropeBones[i];
			const parent = bone.parent;
			const start = this.ropeSkeletonNodes[i];
			const end = this.ropeSkeletonNodes[i + 1];
			const startLocal = new SpineVector2(start.x, start.y);
			const endLocal = new SpineVector2(end.x, end.y);
			if (parent) {
				parent.worldToLocal(startLocal);
				parent.worldToLocal(endLocal);
			}
			const dx = endLocal.x - startLocal.x;
			const dy = endLocal.y - startLocal.y;
			const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
			bone.x = startLocal.x;
			bone.y = startLocal.y;
			bone.rotation = angle;
			bone.scaleX = 1;
			bone.scaleY = 1;
			(bone as any).appliedValid = false;
			if (typeof (bone as any).updateAppliedTransform === 'function') {
				(bone as any).updateAppliedTransform();
			}
		}
	}

	private cacheSkeletonSpaceNodes(): void
	{
		if (!this.dragon || !this.ropeNodes.length) {
			return;
		}
		for (let i = 0; i < this.ropeNodes.length; i++) {
			const cached = this.ropeSkeletonNodes[i] ?? (this.ropeSkeletonNodes[i] = new Phaser.Math.Vector2());
			cached.copy(this.ropeNodes[i]);
			this.dragon.phaserWorldCoordinatesToSkeleton(cached);
		}
	}
}

