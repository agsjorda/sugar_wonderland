import Phaser from 'phaser';

export type RopeAnchorProvider = () => Phaser.Math.Vector2 | Phaser.Types.Math.Vector2Like;

export interface RopeCableOptions {
	segmentCount?: number;
	segmentLengths?: number[];
	gravity?: number;
	iterations?: number;
	maxTimeStep?: number;
	damping?: number;
	color?: number;
	coreColor?: number;
	thickness?: number;
	coreThickness?: number;
	coreVisible?: boolean;
	graphics?: Phaser.GameObjects.Graphics;
	depth?: number;
}

/**
 * Reusable Verlet-based rope / cable simulator.
 * Provides draggable or programmatic anchors that drive a flexible line
 * rendered via Phaser Graphics. Can be re-used across projects by instantiating
 * with the desired scene, anchor providers, and visual styling.
 */
export class RopeCable {
	private scene: Phaser.Scene;
	private options: Required<RopeCableOptions>;
	private ropeNodes: Phaser.Math.Vector2[] = [];
	private ropePrevNodes: Phaser.Math.Vector2[] = [];
	private ropeLengths: number[] = [];
	private ropeGraphics: Phaser.GameObjects.Graphics;
	private ropeIterations: number;
	private maxTimeStep: number;
	private gravity: number;
	private damping: number;
	private startProvider?: RopeAnchorProvider;
	private endProvider?: RopeAnchorProvider;
	private coreVisible: boolean;
	private pinStartAnchor: boolean;
	private pinEndAnchor: boolean;
	private windEnabled: boolean;
	private windAmplitude: number;
	private windFrequency: number;
	private windTime: number;

	constructor(scene: Phaser.Scene, options: RopeCableOptions = {})
	{
		this.scene = scene;
		this.options = {
			segmentCount: options.segmentCount ?? 18,
			segmentLengths: options.segmentLengths ?? [],
			gravity: options.gravity ?? 2400,
			iterations: options.iterations ?? 5,
			maxTimeStep: options.maxTimeStep ?? 1 / 60,
			damping: Phaser.Math.Clamp(options.damping ?? 0.98, 0, 1),
			color: options.color ?? 0x11161f,
			coreColor: options.coreColor ?? 0x29b1ff,
			thickness: options.thickness ?? 12,
			coreThickness: options.coreThickness ?? 5,
			coreVisible: options.coreVisible ?? true,
			graphics: options.graphics ?? scene.add.graphics(),
			depth: options.depth ?? 100
		};

		this.ropeGraphics = this.options.graphics;
		this.ropeGraphics.setDepth(this.options.depth);
		this.ropeIterations = this.options.iterations;
		this.maxTimeStep = this.options.maxTimeStep;
		this.gravity = this.options.gravity;
		this.damping = this.options.damping;
		this.coreVisible = this.options.coreVisible;
		this.pinStartAnchor = true;
		this.pinEndAnchor = true;
		this.windEnabled = false;
		this.windAmplitude = 0;
		this.windFrequency = 0;
		this.windTime = 0;

		this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
		this.scene.events.on(Phaser.Scenes.Events.DESTROY, this.destroy, this);
	}

	setAnchorProviders(startProvider: RopeAnchorProvider, endProvider: RopeAnchorProvider): void
	{
		this.startProvider = startProvider;
		this.endProvider = endProvider;
		this.resetNodes();
	}

	setGravity(value: number): void
	{
		this.gravity = value;
	}

	setDamping(value: number): void
	{
		this.damping = Phaser.Math.Clamp(value, 0, 1);
	}

	setIterations(iterations: number): void
	{
		this.ropeIterations = iterations;
	}

	setSegmentLengths(lengths: number[]): void
	{
		this.options.segmentLengths = lengths.slice();
		this.resetNodes();
	}

	setPrimaryColor(color: number): void
	{
		this.options.color = color;
		this.render();
	}

	setCoreColor(color: number): void
	{
		this.options.coreColor = color;
		this.render();
	}

	setCoreVisible(visible: boolean): void
	{
		this.coreVisible = visible;
		this.options.coreVisible = visible;
		this.render();
	}

	setPinnedEnds(pinStart: boolean, pinEnd: boolean): void
	{
		this.pinStartAnchor = !!pinStart;
		this.pinEndAnchor = !!pinEnd;
	}

	setWind(enabled: boolean, amplitude: number, frequency: number): void
	{
		this.windEnabled = !!enabled;
		this.windAmplitude = amplitude;
		this.windFrequency = frequency;
	}

	update(delta: number): void
	{
		if (!this.startProvider || !this.endProvider) {
			return;
		}
		if (!this.ropeNodes.length) {
			this.resetNodes();
		}

		const dt = Math.min(delta / 1000, this.maxTimeStep);
		const start = this.cloneProvider(this.startProvider);
		const end = this.cloneProvider(this.endProvider);
		if (!start || !end) {
			return;
		}

		// Integrate positions using Verlet.
		const lastIndex = this.ropeNodes.length - 1;
		const useWind = this.windEnabled && this.windAmplitude !== 0 && this.windFrequency !== 0;
		let windPhaseBase = 0;
		if (useWind) {
			this.windTime += dt;
			windPhaseBase = this.windTime * this.windFrequency * Math.PI * 2;
		}
		for (let i = 0; i < this.ropeNodes.length; i++) {
			const isStart = i === 0;
			const isEnd = i === lastIndex;
			if ((isStart && this.pinStartAnchor) || (isEnd && this.pinEndAnchor)) {
				continue;
			}
			const pos = this.ropeNodes[i];
			const prev = this.ropePrevNodes[i];
			const velX = (pos.x - prev.x) * this.damping;
			const velY = (pos.y - prev.y) * this.damping;
			let windAccX = 0;
			if (useWind) {
				const phase = windPhaseBase + i * 0.3;
				windAccX = Math.sin(phase) * this.windAmplitude;
			}
			prev.set(pos.x, pos.y);
			pos.x += velX + windAccX * dt * dt;
			pos.y += velY + this.gravity * dt * dt;
		}

		this.pinEnds(start, end, true);

		for (let iter = 0; iter < this.ropeIterations; iter++) {
			const lastIndexInner = this.ropeNodes.length - 1;
			for (let i = 0; i < this.ropeLengths.length; i++) {
				const p1 = this.ropeNodes[i];
				const p2 = this.ropeNodes[i + 1];
				const rest = this.ropeLengths[i];
				let dx = p2.x - p1.x;
				let dy = p2.y - p1.y;
				let dist = Math.sqrt(dx * dx + dy * dy);
				if (dist === 0) dist = 0.0001;
				const diff = (dist - rest) / dist;
				const isFirst = i === 0;
				const isLast = i + 1 === lastIndexInner;
				if (!(isFirst && this.pinStartAnchor)) {
					p1.x += dx * diff * 0.5;
					p1.y += dy * diff * 0.5;
				}
				if (!(isLast && this.pinEndAnchor)) {
					p2.x -= dx * diff * 0.5;
					p2.y -= dy * diff * 0.5;
				}
			}
			this.pinEnds(start, end);
		}

		this.render();
	}

	getPoints(): Phaser.Math.Vector2[]
	{
		return this.ropeNodes.map(node => node.clone());
	}

	resetNodes(): void
	{
		if (!this.startProvider || !this.endProvider) {
			return;
		}
		const start = this.cloneProvider(this.startProvider);
		const end = this.cloneProvider(this.endProvider);
		if (!start || !end) {
			return;
		}

		const segments = this.options.segmentLengths.length
			? this.options.segmentLengths.length
			: this.options.segmentCount;
		const nodesCount = segments + 1;

		this.ropeNodes = [];
		this.ropePrevNodes = [];
		this.ropeLengths = [];

		const lengths = this.options.segmentLengths.length
			? this.options.segmentLengths.slice()
			: new Array(segments).fill(0).map(() =>
				Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) / segments
			);

		const totalLength = lengths.reduce((sum, len) => sum + (len || 0), 0) || 1;
		const cumulative: number[] = [0];
		for (let i = 0; i < lengths.length; i++) {
			cumulative[i + 1] = cumulative[i] + (lengths[i] || 0);
		}

		for (let i = 0; i < nodesCount; i++) {
			const t = cumulative[i] / totalLength;
			const x = Phaser.Math.Linear(start.x, end.x, t);
			const y = Phaser.Math.Linear(start.y, end.y, t);
			this.ropeNodes.push(new Phaser.Math.Vector2(x, y));
			this.ropePrevNodes.push(new Phaser.Math.Vector2(x, y));
			if (i < lengths.length) {
				this.ropeLengths.push(lengths[i] || totalLength / segments);
			}
		}
		this.pinEnds(start, end, true);
	}

	private pinEnds(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2, resetMiddle = false): void
	{
		if (!this.ropeNodes.length) {
			return;
		}
		const first = this.ropeNodes[0];
		const lastIndex = this.ropeNodes.length - 1;
		const last = this.ropeNodes[lastIndex];

		if (this.pinStartAnchor) {
			first.set(start.x, start.y);
			this.ropePrevNodes[0]?.set(first.x, first.y);
		}

		if (this.pinEndAnchor) {
			last.set(end.x, end.y);
			this.ropePrevNodes[lastIndex]?.set(last.x, last.y);
		}

		if (resetMiddle) {
			for (let i = 1; i < this.ropePrevNodes.length - 1; i++) {
				this.ropePrevNodes[i]?.set(this.ropeNodes[i].x, this.ropeNodes[i].y);
			}
		}
	}

	private render(): void
	{
		if (!this.ropeNodes.length) {
			return;
		}
		this.ropeGraphics.clear();
		this.ropeGraphics.lineStyle(this.options.thickness, this.options.color, 1);
		this.ropeGraphics.beginPath();
		this.ropeGraphics.moveTo(this.ropeNodes[0].x, this.ropeNodes[0].y);
		for (let i = 1; i < this.ropeNodes.length; i++) {
			const pt = this.ropeNodes[i];
			this.ropeGraphics.lineTo(pt.x, pt.y);
		}
		this.ropeGraphics.strokePath();
		if (this.coreVisible && this.options.coreThickness > 0) {
			this.ropeGraphics.lineStyle(this.options.coreThickness, this.options.coreColor, 0.4);
			this.ropeGraphics.beginPath();
			this.ropeGraphics.moveTo(this.ropeNodes[0].x, this.ropeNodes[0].y);
			for (let i = 1; i < this.ropeNodes.length; i++) {
				const pt = this.ropeNodes[i];
				this.ropeGraphics.lineTo(pt.x, pt.y);
			}
			this.ropeGraphics.strokePath();
		}
	}

	private cloneProvider(provider: RopeAnchorProvider): Phaser.Math.Vector2 | null
	{
		const value = provider();
		if (!value) {
			return null;
		}
		return new Phaser.Math.Vector2(value.x, value.y);
	}

	destroy(): void
	{
		this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
		this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
		this.ropeGraphics?.destroy();
		this.ropeNodes = [];
		this.ropePrevNodes = [];
		this.ropeLengths = [];
	}
}

