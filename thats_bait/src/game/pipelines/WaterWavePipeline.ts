import Phaser from 'phaser';

type WaterWaveOptions = {
    amplitude?: number;
    frequency?: number;
    speed?: number;
    darkenFactor?: number;
};

export class WaterWavePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    private time: number;
    private amplitude: number;
    private frequency: number;
    private speed: number;
    private darkenFactor: number;

    constructor(game: Phaser.Game, options: WaterWaveOptions = {}) {
        const fragShader = `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float uTime;
        uniform float uAmplitude;
        uniform float uFrequency;
        uniform float uSpeed;
        uniform float uDarkenFactor;
        varying vec2 outTexCoord;

        void main() {
            vec2 uv = outTexCoord;
            float wave = sin((uv.y * uFrequency) + (uTime * uSpeed)) * uAmplitude;
            uv.x += wave;
            vec4 color = texture2D(uMainSampler, uv);
            float f = clamp(uDarkenFactor, 0.0, 1.0);
            color.rgb *= (1.0 - f);
            gl_FragColor = color;
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
        this.darkenFactor = options.darkenFactor ?? 0.0;
    }

    onPreRender() {
        this.time += this.game.loop.delta * 0.001;
        this.set1f('uTime', this.time);
        this.set1f('uAmplitude', this.amplitude);
        this.set1f('uFrequency', this.frequency);
        this.set1f('uSpeed', this.speed);
        this.set1f('uDarkenFactor', this.darkenFactor);
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

    setDarkenFactor(value: number) {
        this.darkenFactor = Phaser.Math.Clamp(value, 0, 1);
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

type WaterRippleOptions = {
    waveAmplitude?: number;
    waveFrequency?: number;
    waveSpeed?: number;
    rippleAmplitude?: number;
    rippleFrequency?: number;
    rippleSpeed?: number;
    rippleDecay?: number;
};

export class WaterRipplePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    private time: number;
    private waveAmplitude: number;
    private waveFrequency: number;
    private waveSpeed: number;

    private rippleCenterX: number;
    private rippleCenterY: number;
    private rippleTime: number;
    private rippleAmplitude: number;
    private rippleFrequency: number;
    private rippleSpeed: number;
    private rippleDecay: number;

    constructor(game: Phaser.Game, options: WaterRippleOptions = {}) {
        const fragShader = `
        precision mediump float;
        uniform sampler2D uMainSampler;
        uniform float uTime;
        uniform float uWaveAmplitude;
        uniform float uWaveFrequency;
        uniform float uWaveSpeed;
        uniform vec2 uRippleCenter;
        uniform float uRippleTime;
        uniform float uRippleAmplitude;
        uniform float uRippleFrequency;
        uniform float uRippleSpeed;
        uniform float uRippleDecay;
        varying vec2 outTexCoord;

        void main() {
            vec2 uv = outTexCoord;

            // Base horizontal wave
            float baseWave = sin((uv.y * uWaveFrequency) + (uTime * uWaveSpeed)) * uWaveAmplitude;
            uv.x += baseWave;

            float ringLighting = 0.0;

            // Radial ripple from uRippleCenter
            if (uRippleAmplitude > 0.0 && uRippleTime >= 0.0) {
                vec2 toCenter = uv - uRippleCenter;
                float dist = length(toCenter);
                if (dist > 0.0001) {
                    float ripplePhase = dist * uRippleFrequency - uRippleTime * uRippleSpeed;
                    float ripple = sin(ripplePhase);

                    float timeAtten = exp(-uRippleDecay * uRippleTime);
                    float spaceAtten = exp(-2.0 * dist);
                    float strength = ripple * uRippleAmplitude * timeAtten * spaceAtten;
                    vec2 dir = toCenter / dist;

                    uv += dir * strength;
                    ringLighting = strength * 5.0;
                }
            }

            vec4 color = texture2D(uMainSampler, uv);
            color.rgb *= (1.0 + ringLighting);
            gl_FragColor = color;
        }
        `;

        super({
            game,
            name: 'WaterWaveSurface',
            fragShader,
            forceZero: true
        });

        this.time = 0;
        this.waveAmplitude = options.waveAmplitude ?? 0.0;
        this.waveFrequency = options.waveFrequency ?? 15.0;
        this.waveSpeed = options.waveSpeed ?? 0.9;

        this.rippleCenterX = 0.5;
        this.rippleCenterY = 0.5;
        this.rippleTime = 0;
        this.rippleAmplitude = options.rippleAmplitude ?? 0.0;
        this.rippleFrequency = options.rippleFrequency ?? 40.0;
        this.rippleSpeed = options.rippleSpeed ?? 4.0;
        this.rippleDecay = options.rippleDecay ?? 2.0;
    }

    onPreRender() {
        this.time += this.game.loop.delta * 0.001;
        this.set1f('uTime', this.time);
        this.set1f('uWaveAmplitude', this.waveAmplitude);
        this.set1f('uWaveFrequency', this.waveFrequency);
        this.set1f('uWaveSpeed', this.waveSpeed);

        if (this.rippleAmplitude > 0) {
            this.rippleTime += this.game.loop.delta * 0.001;
        } else {
            this.rippleTime = 0;
        }

        this.set2f('uRippleCenter', this.rippleCenterX, this.rippleCenterY);
        this.set1f('uRippleTime', this.rippleTime);
        this.set1f('uRippleAmplitude', this.rippleAmplitude);
        this.set1f('uRippleFrequency', this.rippleFrequency);
        this.set1f('uRippleSpeed', this.rippleSpeed);
        this.set1f('uRippleDecay', this.rippleDecay);
    }

    setAmplitude(value: number) {
        this.waveAmplitude = value;
    }

    setFrequency(value: number) {
        this.waveFrequency = value;
    }

    setSpeed(value: number) {
        this.waveSpeed = value;
    }

    triggerRippleAt(
        normX: number,
        normY: number,
        options: { amplitude?: number; frequency?: number; speed?: number; decay?: number } = {}
    ) {
        this.rippleCenterX = Phaser.Math.Clamp(normX, 0, 1);
        this.rippleCenterY = Phaser.Math.Clamp(normY, 0, 1);

        if (typeof options.amplitude === 'number') {
            this.rippleAmplitude = options.amplitude;
        } else if (this.rippleAmplitude === 0) {
            this.rippleAmplitude = 0.02;
        }

        if (typeof options.frequency === 'number') {
            this.rippleFrequency = options.frequency;
        }

        if (typeof options.speed === 'number') {
            this.rippleSpeed = options.speed;
        }

        if (typeof options.decay === 'number') {
            this.rippleDecay = options.decay;
        }

        this.rippleTime = 0;
    }

    clearRipple() {
        this.rippleAmplitude = 0;
        this.rippleTime = 0;
    }
}