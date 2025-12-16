import { Scene } from 'phaser';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';

export interface NumberDisplayConfig {
	x: number;
	y: number;
	scale?: number;
	/**
	 * Optional scale to use for prefix characters only.
	 * Defaults to the main `scale` when not provided.
	 */
	prefixScale?: number;
	/**
	 * Optional vertical offset to apply to prefix characters.
	 * Defaults to 0.
	 */
	prefixYOffset?: number;
	spacing?: number;
	alignment?: 'left' | 'center' | 'right';
	decimalPlaces?: number;
	showCommas?: boolean;
	prefix?: string;
	suffix?: string;
	commaYOffset?: number;
	dotYOffset?: number;
	/**
	 * Starting position as a percentage of the target value (0.0 - 1.0).
	 * 0 starts at zero, 0.5 starts at half the target, 1 starts at the target.
	 */
	startAtPercent?: number;
	/**
	 * The threshold at which the animation will start.
	 * If the value is less than the threshold, the number will simply be displayed and not animate.
	 * Default is 0.0.
	 */
	animateThreshold?: number;
	/**
	 * The delay in milliseconds before the animation will start.
	 * Default is 0.0.
	 */
	animationDelayMs?: number;
	/**
	 * Whether to use an easing curve for the tick-up animation.
	 * Default is true (fast-to-slow).
	 */
	useCurve?: boolean;
	/**
	 * Duration of the tick-up animation in milliseconds when using curve.
	 * Default 1000ms.
	 */
	tickDurationMs?: number;
	/**
	 * Easing for the tick-up animation when using curve.
	 * Can be a preset string or a custom function (t in [0,1]).
	 * Defaults to 'easeOut' (fast-to-slow).
	 */
	tickEasing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | ((t: number) => number);
}

export class NumberDisplay {
	private scene: Scene | null = null;
	private networkManager?: NetworkManager;
	private screenModeManager?: ScreenModeManager;
	private container: Phaser.GameObjects.Container;
	private numberSprites: Phaser.GameObjects.Image[] = [];
	private shadowSprites: Phaser.GameObjects.Image[] = [];
	private config: NumberDisplayConfig;
	private currentValue: number = 0;
	private isInitialized: boolean = false;
	private numberBorder: Phaser.GameObjects.Graphics;
	private tickEvent: Phaser.Time.TimerEvent | null = null;
	private dropShadowEnabled: boolean = false;
	private dropShadowOffsetX: number = 2;
	private dropShadowOffsetY: number = 2;
	private dropShadowAlpha: number = 0.5;
	private dropShadowColor: number = 0x000000;

	private borderPadding = 8;
	private borderAlpha = 0.65;
	private borderLineColor = 0xFFFF00;
	private borderFillColor = 0x000000;

	// Number image keys mapping
	private numberKeys: { [key: string]: string } = {
		'0': 'number_0',
		'1': 'number_1',
		'2': 'number_2',
		'3': 'number_3',
		'4': 'number_4',
		'5': 'number_5',
		'6': 'number_6',
		'7': 'number_7',
		'8': 'number_8',
		'9': 'number_9',
		',': 'number_comma',
		'.': 'number_dot',
		'x': 'number_x',
		'X': 'number_x'
	};

	constructor(config: NumberDisplayConfig, networkManager?: NetworkManager, screenModeManager?: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
		this.config = {
			scale: 1,
			spacing: 2,
			alignment: 'left',
			decimalPlaces: 2,
			showCommas: true,
			prefix: '',
			prefixYOffset: 0,
			suffix: '',
			commaYOffset: 0,
			dotYOffset: 0,
			startAtPercent: 0.0,
			animateThreshold: 100.0,
			animationDelayMs: 500,
			useCurve: true,
			tickDurationMs: 2000,
			tickEasing: 'easeInOut',
			...config
		};
	}

	/**
	 * Initialize the number display
	 */
	create(scene: Scene): void {
		console.log('[NumberDisplay] Creating number display');
		
		this.scene = scene;
		
		// Create container for all number sprites
		this.container = scene.add.container(this.config.x, this.config.y);
		this.container.setDepth(50); // Adjust depth as needed
		
		this.isInitialized = true;
	}

	/**
	 * Display a number value
	 */
	displayValue(value: number): void {
		if (!this.isInitialized) {
			console.warn('[NumberDisplay] Not initialized yet');
			return;
		}
		
		const animateThreshold = this.config.animateThreshold ?? 0;
		const animationDelayMs = this.config.animationDelayMs ?? 0;
		const willAnimate = value >= animateThreshold;

		this.currentValue = willAnimate ? 0 : value;
		this.updateDisplay();

		if(willAnimate) {
			this.scene!.time.delayedCall(animationDelayMs, () => {
				this.currentValue = value;
				this.animateNumberTickUp(value);
			});
		}
	}

	toggleBorder(visible: boolean): void {
		if (!this.numberBorder) 
		{
			this.numberBorder = this.scene!.add.graphics();
			this.container.add(this.numberBorder);
		}

		this.numberBorder.setVisible(visible);
	}


	/**
	 * Update the display with current value
	 */
	private updateDisplay(): void {
		if (!this.scene) return;

		// Reset container scale to avoid compounding from previous frames
		if (this.container) {
			this.container.setScale(1);
		}

		// Clear existing sprites
		this.clearSprites();

		// Format the number
		const formattedNumber = this.formatNumber(this.currentValue);
		const prefixLength = this.config.prefix?.length ?? 0;
		const baseScale = this.config.scale ?? 1;
		const prefixScale = this.config.prefixScale ?? baseScale;
		const prefixYOffset = this.config.prefixYOffset ?? 0;
		console.log(`[NumberDisplay] Displaying: ${formattedNumber}`);

		// Create sprites for each character
		let currentX = 0;
		const totalWidth = this.calculateTotalWidth(formattedNumber, prefixLength, baseScale, prefixScale);

		// Compute container scale to ensure border width fits within screen
		const screenWidth = this.scene!.scale?.width ?? this.scene!.cameras?.main?.width ?? this.scene!.sys.game.canvas.width;
		const projectedBorderWidth = totalWidth + this.borderPadding * 2 + this.borderPadding * 2;
		let containerScale = 1;
		if (projectedBorderWidth > screenWidth && projectedBorderWidth > 0) {
			// Slightly under screen width to avoid edge rounding issues
			containerScale = Math.max(0.1, (screenWidth - 1) / projectedBorderWidth);
		}

		this.updateNumberBorder(totalWidth);
		// Apply the container scale after drawing the border and before laying out children
		if (this.container && containerScale !== 1) {
			this.container.setScale(containerScale);
		}
		
		// Adjust starting position based on alignment
		if (this.config.alignment === 'center') {
			currentX = -totalWidth / 2;
		} else if (this.config.alignment === 'right') {
			currentX = -totalWidth;
		}

		// Create sprites for each character
		for (let i = 0; i < formattedNumber.length; i++) {
			const char = formattedNumber[i];
			const key = this.numberKeys[char];
			const isPrefixChar = i < prefixLength;
			const charScale = isPrefixChar ? prefixScale : baseScale;
			const charYOffset = isPrefixChar ? prefixYOffset : 0;
			
			if (key && this.scene!.textures.exists(key)) {
				// Create shadow sprite if drop shadow is enabled
				if (this.dropShadowEnabled) {
					const shadowSprite = this.scene!.add.image(
						currentX + this.dropShadowOffsetX,
						this.dropShadowOffsetY,
						key
					);
					shadowSprite.setScale(charScale);
					shadowSprite.setOrigin(0, 0.5);
					shadowSprite.setTint(this.dropShadowColor);
					shadowSprite.setAlpha(this.dropShadowAlpha);
					
					// Apply y-offset for commas and decimal points
					let shadowY = this.dropShadowOffsetY + charYOffset;
					if (char === ',') {
						shadowY += this.config.commaYOffset!;
					} else if (char === '.') {
						shadowY += this.config.dotYOffset!;
					}
					shadowSprite.setY(shadowY);
					
					// Add shadow to container first (behind the main sprite)
					this.container.addAt(shadowSprite, 0);
					this.shadowSprites.push(shadowSprite);
				}
				
				// Create main sprite
				const sprite = this.scene!.add.image(currentX, 0, key);
				sprite.setScale(charScale);
				sprite.setOrigin(0, 0.5);
				
				// Apply y-offset for commas and decimal points
				let spriteY = charYOffset;
				if (char === ',') {
					spriteY += this.config.commaYOffset!;
				} else if (char === '.') {
					spriteY += this.config.dotYOffset!;
				}
				if (spriteY !== 0) {
					sprite.setY(spriteY);
				}
				
				this.container.add(sprite);
				this.numberSprites.push(sprite);
				
				// Move to next position
				currentX += sprite.width * charScale + this.config.spacing!;
			} else {
				console.warn(`[NumberDisplay] Missing texture for character: ${char}`);
			}
		}
	}

	private animateNumberTickUp(targetNumber: number): void
	{
		if (!this.scene) return;

		// Cancel any ongoing tick animation
		if (this.tickEvent) {
			this.tickEvent.remove(false);
			this.tickEvent = null;
		}

		// Determine starting value from percentage of target
		const rawStartPercent = this.config.startAtPercent ?? 0;
		const startPercent = Math.min(1, Math.max(0, rawStartPercent));
		const startValue = targetNumber * startPercent;

		// If already at target, just display and exit
		if (Math.abs(targetNumber - startValue) <= Number.EPSILON) {
			this.currentValue = targetNumber;
			this.updateDisplay();
			return;
		}

		this.currentValue = startValue;
		this.updateDisplay();

		// Determine step behavior
		const decimalPlaces = Math.max(0, this.config.decimalPlaces ?? 0);
		const roundToDecimals = (value: number): number => {
			const factor = Math.pow(10, decimalPlaces);
			return Math.round(value * factor) / factor;
		};

		const useCurve = this.config.useCurve ?? true;
		const remaining = targetNumber - startValue;

		if (useCurve) {
			const duration = Math.max(50, this.config.tickDurationMs ?? 1000);
			const tickMs = 50;
			const steps = Math.max(1, Math.round(duration / tickMs));
			let stepIndex = 0;
			const easingFn = this.resolveEasing(this.config.tickEasing);

			this.tickEvent = this.scene.time.addEvent({
				delay: tickMs,
				repeat: Math.max(0, steps - 1),
				callback: () => {
					stepIndex++;
					const progress = Math.min(1, stepIndex / steps);
					const eased = easingFn(progress);
					this.currentValue = roundToDecimals(startValue + remaining * eased);
					this.updateDisplay();
					if (progress >= 1) {
						this.currentValue = roundToDecimals(targetNumber);
						this.updateDisplay();
						if (this.tickEvent) {
							this.tickEvent.remove(false);
							this.tickEvent = null;
						}
					}
				}
			});
			return;
		}

		// Legacy linear/integer ticking path
		const isIntegerTarget = Number.isInteger(targetNumber) && decimalPlaces === 0;
		const maxTicks = 60; // ~1 second at 60fps

		let steps: number;
		let increment: number;

		if (isIntegerTarget && remaining > 0 && remaining <= maxTicks) {
			// Tick by 1 for small integers for a satisfying count-up
			steps = Math.ceil(remaining);
			increment = Math.sign(remaining) * 1;
		} else {
			// Smoothly animate in fixed number of steps
			steps = maxTicks;
			increment = remaining / steps;
		}

		let stepIndex = 0;

		this.tickEvent = this.scene.time.addEvent({
			delay: 16, // ~60fps
			repeat: Math.max(0, steps - 1),
			callback: () => {
				stepIndex++;
				if (stepIndex >= steps) {
					// Ensure exact target at the end
					this.currentValue = roundToDecimals(targetNumber);
					this.updateDisplay();
					if (this.tickEvent) {
						this.tickEvent.remove(false);
						this.tickEvent = null;
					}
					return;
				}

				const nextValue = roundToDecimals(Math.min(targetNumber, this.currentValue + increment));
				this.currentValue = nextValue;
				this.updateDisplay();
			}
		});
	}

	private resolveEasing(easing: NumberDisplayConfig['tickEasing']): (t: number) => number {
		// Normalize function input
		if (typeof easing === 'function') return (t: number) => this.clamp01(easing(this.clamp01(t)));

		// Presets
		const preset = easing ?? 'easeOut';
		switch (preset) {
			case 'linear':
				return (t: number) => this.clamp01(t);
			case 'easeIn':
				// cubic ease-in
				return (t: number) => {
					t = this.clamp01(t);
					return t * t * t;
				};
			case 'easeInOut':
				// cubic ease-in-out
				return (t: number) => {
					t = this.clamp01(t);
					return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
				};
			case 'easeOut':
			default:
				// cubic ease-out (fast to slow)
				return (t: number) => {
					t = this.clamp01(t);
					return 1 - Math.pow(1 - t, 3);
				};
		}
	}

	private clamp01(value: number): number {
		if (value < 0) return 0;
		if (value > 1) return 1;
		return value;
	}

	private updateNumberBorder(totalWidth: number): void {
		// Create number border
		if(!this.numberBorder) {
			this.numberBorder = this.scene!.add.graphics();
			this.container.add(this.numberBorder);
		}

		// Position number border
		// Resize number border to match the width of the number sprites
		const borderWidth = totalWidth + this.borderPadding * 2;
		const borderHeight = this.getHeight() + this.borderPadding * 2;
		const borderX = -borderWidth / 2;
		const borderY = -borderHeight / 2;

		this.numberBorder.clear();
		this.numberBorder.fillStyle(this.borderFillColor, this.borderAlpha);
		this.numberBorder.fillRoundedRect(borderX, borderY, borderWidth, borderHeight, 4);
		this.numberBorder.lineStyle(3, this.borderLineColor, this.borderAlpha);
		this.numberBorder.strokeRoundedRect(borderX, borderY, borderWidth, borderHeight, 4);
	}

	/**
	 * Format number with commas and decimal places
	 */
	private formatNumber(value: number): string {
		let formatted = '';

		// Add prefix
		if (this.config.prefix) {
			formatted += this.config.prefix;
		}

		// Format the number
		if (this.config.showCommas) {
			// Add commas for thousands
			const parts = value.toString().split('.');
			parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
			formatted += parts.join('.');
		} else {
			formatted += value.toString();
		}

		// Ensure correct decimal places
		if (this.config.decimalPlaces! > 0) {
			const parts = formatted.split('.');
			if (parts.length === 1) {
				formatted += '.' + '0'.repeat(this.config.decimalPlaces!);
			} else {
				const decimals = parts[1];
				if (decimals.length < this.config.decimalPlaces!) {
					formatted += '0'.repeat(this.config.decimalPlaces! - decimals.length);
				} else if (decimals.length > this.config.decimalPlaces!) {
					formatted = parts[0] + '.' + decimals.substring(0, this.config.decimalPlaces!);
				}
			}
		}

		// Add suffix
		if (this.config.suffix) {
			formatted += this.config.suffix;
		}

		return formatted;
	}

	/**
	 * Calculate total width of the formatted number
	 */
	private calculateTotalWidth(
		formattedNumber: string,
		prefixLength: number,
		baseScale: number,
		prefixScale: number
	): number {
		let totalWidth = 0;
		
		for (let i = 0; i < formattedNumber.length; i++) {
			const char = formattedNumber[i];
			const key = this.numberKeys[char];
			const charScale = i < prefixLength ? prefixScale : baseScale;
			
			if (key && this.scene!.textures.exists(key)) {
				const texture = this.scene!.textures.get(key);
				totalWidth += texture.source[0].width * charScale + this.config.spacing!;
			}

		}
		
		// Remove last spacing
		if (totalWidth > 0) {
			totalWidth -= this.config.spacing!;
		}
		
		return totalWidth;
	}

	private getHeight(): number {
		if (!this.scene) {
			return 0;
		}

		const baseScale = this.config.scale ?? 1;
		const prefixScale = this.config.prefixScale ?? baseScale;
		let maxHeight = 0;

		const applyHeight = (key?: string, scale: number = baseScale) => {
			if (!key || !this.scene!.textures.exists(key)) {
				return;
			}
			const texture = this.scene!.textures.get(key);
			const height = texture.source[0].height * scale;
			if (height > maxHeight) {
				maxHeight = height;
			}
		};

		applyHeight(this.numberKeys['0'], baseScale);

		const prefixChars = this.config.prefix ?? '';
		for (const char of prefixChars) {
			const key = this.numberKeys[char];
			applyHeight(key, prefixScale);
		}

		const prefixYOffset = Math.abs(this.config.prefixYOffset ?? 0);
		return maxHeight + prefixYOffset;
	}

	/**
	 * Clear all number sprites
	 */
	private clearSprites(): void {
		for (const sprite of this.numberSprites) {
			sprite.destroy();
		}
		this.numberSprites = [];
		
		for (const shadowSprite of this.shadowSprites) {
			shadowSprite.destroy();
		}
		this.shadowSprites = [];
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<NumberDisplayConfig>): void {
		this.config = { ...this.config, ...newConfig };
		if (this.isInitialized) {
			this.updateDisplay();
		}
	}

	/**
	 * Set position
	 */
	setPosition(x: number, y: number): void {
		this.config.x = x;
		this.config.y = y;
		if (this.container) {
			this.container.setPosition(x, y);
		}
	}

	/**
	 * Set scale
	 */
	setScale(scale: number): void {
		this.config.scale = scale;
		if (this.isInitialized) {
			this.updateDisplay();
		}
	}

	/**
	 * Get current value
	 */
	getValue(): number {
		return this.currentValue;
	}

	/**
	 * Get container
	 */
	getContainer(): Phaser.GameObjects.Container {
		return this.container;
	}

	/**
	 * Show/hide the display
	 */
	setVisible(visible: boolean): void {
		if (this.container) {
			this.container.setVisible(visible);
		}
	}

	/**
	 * Set alpha
	 */
	setAlpha(alpha: number): void {
		if (this.container) {
			this.container.setAlpha(alpha);
		}
	}

	/**
	 * Enable or disable drop shadow for the displayed numbers
	 * @param enabled Whether to enable the drop shadow
	 * @param offsetX Horizontal offset of the shadow (default: 2)
	 * @param offsetY Vertical offset of the shadow (default: 2)
	 * @param alpha Alpha value of the shadow (0-1, default: 0.5)
	 * @param color Tint color of the shadow (default: 0x000000 - black)
	 */
	setDropShadow(
		enabled: boolean,
		offsetX: number = 2,
		offsetY: number = 2,
		alpha: number = 0.5,
		color: number = 0x000000
	): void {
		this.dropShadowEnabled = enabled;
		this.dropShadowOffsetX = offsetX;
		this.dropShadowOffsetY = offsetY;
		this.dropShadowAlpha = Math.max(0, Math.min(1, alpha));
		this.dropShadowColor = color;
		
		// Update display if already initialized to apply changes
		if (this.isInitialized) {
			this.updateDisplay();
		}
	}

	/**
	 * Destroy the number display
	 */
	destroy(): void {
		this.clearSprites();
		if (this.container) {
			this.container.destroy();
		}
		this.isInitialized = false;
	}
} 