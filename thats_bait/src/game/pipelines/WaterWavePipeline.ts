import Phaser from 'phaser';

type WaterWaveOptions = {
	amplitude?: number;
	frequency?: number;
	speed?: number;
};

export class WaterWavePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
	private time: number;
	private amplitude: number;
	private frequency: number;
	private speed: number;

	constructor(game: Phaser.Game, options: WaterWaveOptions = {}) {
		const fragShader = `
		precision mediump float;
		uniform sampler2D uMainSampler;
		uniform float uTime;
		uniform float uAmplitude;
		uniform float uFrequency;
		uniform float uSpeed;
		varying vec2 outTexCoord;

		void main() {
			vec2 uv = outTexCoord;
			float wave = sin((uv.y * uFrequency) + (uTime * uSpeed)) * uAmplitude;
			uv.x += wave;
			gl_FragColor = texture2D(uMainSampler, uv);
		}
		`;

		super({
			game,
			name: 'WaterWave',
			fragShader,
			forceZero: true
		});

		this.time = 0;
		this.amplitude = options.amplitude ?? 0.02;
		this.frequency = options.frequency ?? 10.0;
		this.speed = options.speed ?? 2.0;
	}

	onPreRender() {
		this.time += this.game.loop.delta * 0.001;
		this.set1f('uTime', this.time);
		this.set1f('uAmplitude', this.amplitude);
		this.set1f('uFrequency', this.frequency);
		this.set1f('uSpeed', this.speed);
	}

	setAmplitude(value: number) {
		this.amplitude = value;
	}

	setFrequency(value: number) {
		this.frequency = value;
	}

	setSpeed(value: number) {
		this.speed = value;
	}
}

export class WaterWaveVerticalPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
	private time: number;
	private amplitude: number;
	private frequency: number;
	private speed: number;

	constructor(game: Phaser.Game, options: WaterWaveOptions = {}) {
		const fragShader = `
		precision mediump float;
		uniform sampler2D uMainSampler;
		uniform float uTime;
		uniform float uAmplitude;
		uniform float uFrequency;
		uniform float uSpeed;
		varying vec2 outTexCoord;

		void main() {
			vec2 uv = outTexCoord;
			float wave = sin((uv.x * uFrequency) + (uTime * uSpeed)) * uAmplitude;
			uv.y += wave;
			gl_FragColor = texture2D(uMainSampler, uv);
		}
		`;

		super({
			game,
			name: 'WaterWaveVertical',
			fragShader,
			forceZero: true
		});

		this.time = 0;
		this.amplitude = options.amplitude ?? 0.02;
		this.frequency = options.frequency ?? 10.0;
		this.speed = options.speed ?? 2.0;
	}

	onPreRender() {
		this.time += this.game.loop.delta * 0.001;
		this.set1f('uTime', this.time);
		this.set1f('uAmplitude', this.amplitude);
		this.set1f('uFrequency', this.frequency);
		this.set1f('uSpeed', this.speed);
	}

	setAmplitude(value: number) {
		this.amplitude = value;
	}

	setFrequency(value: number) {
		this.frequency = value;
	}

	setSpeed(value: number) {
		this.speed = value;
	}
}
