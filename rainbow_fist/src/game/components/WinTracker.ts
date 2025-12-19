import { Scene } from 'phaser';

export interface SymbolWinRowConfig {
	scene: Scene;
	symbolIndex: number;
	symbolWinCount: number;
	totalWinAmount: number;
	/** Optional currency text shown before the total amount (e.g. '$', 'PHP', '€') */
	currencyText?: string;
	x?: number;
	y?: number;
	depth?: number;
	/** Override base text color for the row (e.g. '#ff0000') */
	textColor?: string;
	/** Override base text size for the row (e.g. '18px' or 18) */
	textFontSize?: string | number;
	textStyle?: Phaser.Types.GameObjects.Text.TextStyle;
	currencyTextStyle?: Phaser.Types.GameObjects.Text.TextStyle;
	symbolScale?: number;
}

/**
 * WinTracker is a small helper component that renders a single horizontal
 * win row:
 *
 * [symbol count] x [sprite] = [total win amount]
 *
 * The created `container` is exposed so callers can position, tween,
 * or destroy it as needed.
 */
export class WinTracker {
	private static readonly ROW_CONTAINER_NAME = 'win-tracker-row';
	private static readonly GROUP_CONTAINER_NAME = 'win-tracker-group';
	private static readonly WAVE_TWEEN_DATA_KEY = '__winTrackerWaveTween';

	public static startWave(
		container?: Phaser.GameObjects.Container | null,
		options?: {
			scale?: number;
			duration?: number;
			staggerDelay?: number;
			repeat?: number;
		},
	): Phaser.Tweens.Tween | undefined {
		if (!container) return undefined;

		// Stop any existing wave tween attached to this container
		WinTracker.stopWave(container);

		const scene = container.scene;
		if (!scene || !scene.tweens) return undefined;

		const targets: Phaser.GameObjects.GameObject[] = [];

		const gatherTargets = (node: Phaser.GameObjects.GameObject) => {
			const anyNode = node as any;

			// Skip Containers as tween targets, otherwise the whole row scales uniformly.
			if (node instanceof Phaser.GameObjects.Container) {
				if (Array.isArray(anyNode.list)) {
					anyNode.list.forEach((child: Phaser.GameObjects.GameObject) => gatherTargets(child));
				}
				return;
			}

			if (typeof anyNode.setScale === 'function') {
				targets.push(node);
			}

			// Safety: traverse potential nested lists even on non-containers.
			if (Array.isArray(anyNode.list)) {
				anyNode.list.forEach((child: Phaser.GameObjects.GameObject) => gatherTargets(child));
			}
		};

		gatherTargets(container);
		if (!targets.length) return undefined;

		const scale = options?.scale ?? 1.12;
		const duration = options?.duration ?? 150;
		const staggerDelay = options?.staggerDelay ?? 80;
		const repeat = options?.repeat ?? 0;

		const tween = scene.tweens.add({
			targets,
			// Relative to current scale of each target
			scaleX: (target: any) => (typeof target.scaleX === 'number' ? target.scaleX : 1) * scale,
			scaleY: (target: any) => (typeof target.scaleY === 'number' ? target.scaleY : 1) * scale,
			ease: 'Sine.easeInOut',
			duration,
			yoyo: true,
			repeat,
			delay: scene.tweens.stagger(staggerDelay, { from: 0 }),
		});

		// Persist tween reference on the container for cleanup
		container.setDataEnabled();
		container.setData(WinTracker.WAVE_TWEEN_DATA_KEY, tween);

		return tween;
	}

	public static stopWave(container?: Phaser.GameObjects.Container | null): void {
		if (!container) return;
		const anyContainer = container as any;
		const data = anyContainer.data;
		const tween = data?.get?.(WinTracker.WAVE_TWEEN_DATA_KEY) as Phaser.Tweens.Tween | undefined;
		if (tween) {
			try { tween.stop(); } catch { }
			try { tween.remove(); } catch { }
			try { data.remove(WinTracker.WAVE_TWEEN_DATA_KEY); } catch { }
		}
	}

	public readonly container: Phaser.GameObjects.Container;

	constructor(private readonly config: SymbolWinRowConfig) {
		this.container = this.buildContainer();
	}

	/**
	 * Convenience helper mirroring the old function API.
	 * When passed a single config, returns a single win-row container.
	 * When passed an array of configs, it builds a parent container that
	 * arranges each win-row container side by side (horizontally).
	 */
	public static createSymbolWinRow(config: SymbolWinRowConfig): Phaser.GameObjects.Container;
	public static createSymbolWinRow(configs: SymbolWinRowConfig[]): Phaser.GameObjects.Container;
	public static createSymbolWinRow(
		configOrConfigs: SymbolWinRowConfig | SymbolWinRowConfig[],
	): Phaser.GameObjects.Container {
		// Single config – keep existing behaviour
		if (!Array.isArray(configOrConfigs)) {
			return new WinTracker(configOrConfigs).container;
		}

		const configs = configOrConfigs;
		if (configs.length === 0) {
			throw new Error('createSymbolWinRow requires at least one config');
		}

		// Use the first config as the base positioning for the parent container
		const first = configs[0];
		const scene = first.scene;

		const parentX = first.x ?? scene.scale.width * 0.5;
		const parentY = first.y ?? scene.scale.height * 0.9;
		const parentDepth = first.depth ?? 50;

		const parentContainer = scene.add.container(parentX, parentY);
		parentContainer.setName(WinTracker.GROUP_CONTAINER_NAME);
		parentContainer.setDepth(parentDepth);

		// Starting X for arranging child rows; will be re-centered after layout
		let currentX = 0;
		const horizontalSpacing = 24;

		// Basic separator style based on the first row's text preferences
		const separatorStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			fontFamily: 'Poppins-Bold',
			fontSize: first.textFontSize ?? '20px',
			color: first.textColor ?? '#ffffff',
		};

		configs.forEach((cfg, index) => {
			// Create each row at (0, 0) then position it inside the parent
			const rowTracker = new WinTracker({
				...cfg,
				x: 0,
				y: 0,
				// Depth is controlled by parent container; individual row depth is less important here
			});

			const rowContainer = rowTracker.container;

			// Determine this row's width. We can't rely on container.width (it's 0),
			// so we derive it from the bounds of its children.
			const bounds = rowContainer.getBounds();
			const rowWidth = bounds.width;

			rowContainer.x = currentX;
			rowContainer.y = 0;

			parentContainer.add(rowContainer);

			// If there is another row after this one, add a "|" separator between them
			if (index < configs.length - 1) {
				const separatorX = currentX + rowWidth + horizontalSpacing * 0.5;
				const separator = scene.add.text(separatorX, 0, '|', separatorStyle)
					.setOrigin(0.5, 0.5);
				parentContainer.add(separator);
			}

			// Advance X by the width of this row plus some spacing
			currentX += rowWidth + horizontalSpacing;
		});

		// Center all row containers horizontally so the whole group is centered
		// around parentContainer.x. Use the actual bounds (which account for
		// each row's internal centering) instead of the layout cursor.
		const groupBounds = parentContainer.getBounds();
		const groupCenterX = groupBounds.centerX - parentContainer.x;

		parentContainer.iterate(child => {
			const anyChild = child as any;
			if (typeof anyChild.x === 'number') {
				anyChild.x -= groupCenterX;
			}
		});

		return parentContainer;
	}

	/**
	 * Destroy a specific WinTracker container, if provided.
	 * Safe to call with null/undefined.
	 */
	public static clearContainer(container?: Phaser.GameObjects.Container | null): void {
		if (!container) return;
		WinTracker.stopWave(container);
		// `destroyed` is available on most GameObjects; guard in case of typing differences
		const anyContainer = container as any;
		if (anyContainer.destroyed) return;
		// Be explicit: destroy children too, to avoid any lingering images/text.
		try { container.removeAll(true); } catch { }
		container.destroy();
	}

	/**
	 * Convenience helper to clear all WinTracker containers that were created
	 * in the given scene (both individual rows and grouped rows).
	 */
	public static clearFromScene(scene: Scene): void {
		scene.children.each((child: Phaser.GameObjects.GameObject) => {
			console.log('[WinTracker] Clearing from scene', child.name);
			if (child.name === WinTracker.ROW_CONTAINER_NAME || child.name === WinTracker.GROUP_CONTAINER_NAME) {
				// Only WinTracker containers should hit this branch
				WinTracker.clearContainer(child as any);
			}
		});
	}

	private buildContainer(): Phaser.GameObjects.Container {
		const { scene, symbolIndex, symbolWinCount, totalWinAmount } = this.config;

		const x = this.config.x ?? scene.scale.width * 0.5;
		const y = this.config.y ?? scene.scale.height * 0.9;
		const depth = this.config.depth ?? 50;

		const container = scene.add.container(x, y);
		container.setName(WinTracker.ROW_CONTAINER_NAME);
		container.setDepth(depth);

		const baseStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			// Match in-game balance amount style
			fontFamily: 'Poppins-Bold',
			fontSize: this.config.textFontSize ?? '16px',
			color: this.config.textColor ?? '#ffffff',
			// Dark green stroke for stronger contrast against the bright fill
			stroke: '#006400',
			strokeThickness: 2,
			...this.config.textStyle,
		};

		let currentX = 0;

		// [symbol count]
		const countText = scene.add.text(currentX, 0, `${symbolWinCount}`, baseStyle)
			.setOrigin(0, 0.5);
		container.add(countText);
		currentX += countText.width + 6;

		// [sprite] – use symbol_{index} texture if available
		const symbolKey = `symbol${symbolIndex}`;
		let symbolWidth = 0;

		if (scene.textures.exists(symbolKey)) {
			// Ensure this symbol texture uses linear filtering so it looks smooth
			// when scaled down for the WinTracker row.
			const texture = scene.textures.get(symbolKey);
			if (texture) {
				texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
			}

			const symbolSprite = scene.add.image(currentX, 0, symbolKey)
				.setOrigin(0, 0.5);

			if (this.config.symbolScale !== undefined) {
				symbolSprite.setScale(this.config.symbolScale);
			} else {
				// Default scale so the sprite height is around 32px
				const targetHeight = 32;
				if (symbolSprite.height > 0) {
					const scale = targetHeight / symbolSprite.height;
					symbolSprite.setScale(scale);
				}
			}

			container.add(symbolSprite);
			symbolWidth = symbolSprite.displayWidth;
		} else {
			// Fallback: show symbol index as text if texture is missing
			const placeholder = scene.add.text(currentX, 0, `[${symbolIndex}]`, baseStyle)
				.setOrigin(0, 0.5);
			container.add(placeholder);
			symbolWidth = placeholder.width;
		}

		currentX += symbolWidth + 6;

		// "="
		const equalsText = scene.add.text(currentX, 0, '=', baseStyle)
			.setOrigin(0, 0.5);
		container.add(equalsText);
		currentX += equalsText.width + 6;

		// [currency][space][total win amount]
		const currency = this.config.currencyText ?? '$';

		const currencyStyle: Phaser.Types.GameObjects.Text.TextStyle = {
			...baseStyle,
			// Match in-game balance currency style
			fontFamily: 'Poppins-Bold',
			...this.config.currencyTextStyle,
		};

		const currencyTextObj = scene.add.text(currentX, 0, currency, currencyStyle)
			.setOrigin(0, 0.5);
		container.add(currencyTextObj);
		currentX += currencyTextObj.width + 4;

		// [total win amount]
		const formattedTotal = totalWinAmount.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});

		const totalText = scene.add.text(currentX, 0, formattedTotal, baseStyle)
			.setOrigin(0, 0.5);
		container.add(totalText);

		// Center the entire row horizontally around the container's X position.
		// currentX tracks the total laid-out width of the row.
		const totalWidth = currentX;
		container.iterate(child => {
			const anyChild = child as any;
			if (typeof anyChild.x === 'number') {
				anyChild.x -= totalWidth / 2;
			}
		});

		return container;
	}
}

/**
 * Backwards-compatible helper so existing imports continue to work:
 *
 * import { createSymbolWinRow } from '../components/WinTracker';
 */
export function createSymbolWinRow(config: SymbolWinRowConfig): Phaser.GameObjects.Container;
export function createSymbolWinRow(configs: SymbolWinRowConfig[]): Phaser.GameObjects.Container;
export function createSymbolWinRow(
	configOrConfigs: SymbolWinRowConfig | SymbolWinRowConfig[],
): Phaser.GameObjects.Container {
	return WinTracker.createSymbolWinRow(configOrConfigs as any);
}
