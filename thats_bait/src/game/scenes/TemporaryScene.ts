import Phaser, { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { RopeCable } from '../components/RopeCable';

/**
 * Minimal playground scene with a white background and a reusable rope cable demo.
 */
export class TemporaryScene extends Scene
{
	private rope?: RopeCable;
	private startHandle?: Phaser.GameObjects.Arc;
	private endHandle?: Phaser.GameObjects.Arc;
	private readonly startAnchor = new Phaser.Math.Vector2();
	private readonly endAnchor = new Phaser.Math.Vector2();
	private readonly dragBoundsPadding = 32;
	private readonly ropeStyle = {
		color: 0x11161f,
		coreColor: 0x29b1ff,
		outlineVisible: false,
		damping: 0.96
	};

	constructor ()
	{
		super('TemporaryScene');
	}

	create ()
	{
		this.cameras.main.setBackgroundColor('#FFFFFF');
		this.cameras.main.fadeIn(250, 255, 255, 255);

		this.setupRopeCable();
		EventBus.emit('current-scene-ready', this);
	}

	update (_time: number, delta: number)
	{
		this.rope?.update(delta);
	}

	private setupRopeCable(): void
	{
		const width = this.scale.width;
		const height = this.scale.height;

		this.startHandle?.destroy();
		this.endHandle?.destroy();
		this.rope?.destroy();

		this.startAnchor.set(width * 0.35, height * 0.45);
		this.endAnchor.set(width * 0.65, height * 0.55);

		this.rope = new RopeCable(this, {
			segmentCount: 20,
			iterations: 6,
			gravity: 2200,
			thickness: 8,
			coreThickness: 6,
			color: this.ropeStyle.color,
			coreColor: this.ropeStyle.coreColor,
			coreVisible: this.ropeStyle.outlineVisible,
			damping: this.ropeStyle.damping,
			depth: 5
		});

		this.rope.setAnchorProviders(
			() => this.startAnchor,
			() => this.endAnchor
		);
		this.applyRopeStyle();

		this.startHandle = this.createHandle(
			this.startAnchor,
			18,
			0x4a90e2,
			0x0f1a3d,
			10
		);

		this.endHandle = this.createHandle(
			this.endAnchor,
			20,
			0xff6a2c,
			0xffffff,
			12
		);
	}

	private createHandle(
		anchor: Phaser.Math.Vector2,
		radius: number,
		fillColor: number,
		strokeColor: number,
		depth: number
	): Phaser.GameObjects.Arc
	{
		const handle = this.add.circle(anchor.x, anchor.y, radius, fillColor, 0.9)
			.setStrokeStyle(3, strokeColor, 0.95)
			.setDepth(depth)
			.setInteractive({ useHandCursor: true, draggable: true });

		this.input.setDraggable(handle);

		handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
			const clampedX = Phaser.Math.Clamp(dragX, this.dragBoundsPadding, this.scale.width - this.dragBoundsPadding);
			const clampedY = Phaser.Math.Clamp(dragY, this.dragBoundsPadding, this.scale.height - this.dragBoundsPadding);
			anchor.set(clampedX, clampedY);
			handle.setPosition(clampedX, clampedY);
		});

		handle.on('dragstart', () => handle.setScale(1.08));
		handle.on('dragend', () => handle.setScale(1));

		return handle;
	}

	private applyRopeStyle(): void
	{
		if (!this.rope) {
			return;
		}
		this.rope.setPrimaryColor(this.ropeStyle.color);
		this.rope.setCoreColor(this.ropeStyle.coreColor);
		this.rope.setCoreVisible(this.ropeStyle.outlineVisible);
		this.rope.setDamping(this.ropeStyle.damping);
	}
}
