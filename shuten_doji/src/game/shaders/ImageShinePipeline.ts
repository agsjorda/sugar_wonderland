import * as Phaser from 'phaser';

export const IMAGE_SHINE_PIPELINE_KEY = 'ImageShine';

// Shine / gloss sweep effect for a single textured Game Object.
// Per-object parameters are read from `gameObject.pipelineData`.
const FRAG_SHADER = `
#define SHADER_NAME IMAGE_SHINE_FS

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;

uniform float uTime;           // seconds
uniform float uTimeOffset;     // seconds, per-object. Effective time = max(0, uTime - uTimeOffset)
uniform float uRepeatDelay;    // seconds to wait AFTER the sweep finishes; <= 0 = restart immediately
uniform vec2 uSize;            // display size (px) of the game object
uniform vec2 uMoveDir;         // movement direction in object pixel space (normalized)
uniform float uSpeed;          // px/sec along uMoveDir
uniform vec2 uStartPx;         // start point in object pixel space (px)

// Stripe orientation:
// uStripeAngle is the stripe direction angle (radians) measured from +X.
// Stripe normal is perpendicular to it, used to compute band thickness.
uniform float uStripeAngle;

uniform float uThickness;      // px thickness of the shine band
uniform float uSoftness;       // px feathering on band edge
uniform float uIntensity;      // 0..?
uniform vec3 uShineColor;      // usually white

varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;

float bandMask(float distPx, float halfThickness, float softness)
{
    // Returns ~1 at center (distPx = 0) and fades to 0 at edges.
    float a = smoothstep(-halfThickness - softness, -halfThickness, distPx);
    float b = 1.0 - smoothstep(halfThickness, halfThickness + softness, distPx);
    return clamp(min(a, b), 0.0, 1.0);
}

void main ()
{
    vec4 texture = texture2D(uMainSampler, outTexCoord);

    // Phaser tinting behavior from Single.frag
    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 color = texture * texel;

    if (outTintEffect == 1.0)
    {
        color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
    }
    else if (outTintEffect == 2.0)
    {
        color = texel;
    }

    // Compute pixel coordinate in object space
    vec2 p = outTexCoord * uSize;

    // Stripe normal from stripe direction angle
    float ca = cos(uStripeAngle);
    float sa = sin(uStripeAngle);
    vec2 stripeDir = vec2(ca, sa);
    vec2 stripeNormal = vec2(-stripeDir.y, stripeDir.x);

    float halfThickness = max(0.5, uThickness * 0.5);
    float softness = max(0.0, uSoftness);

    // Project the 4 object corners onto the stripe normal to get min/max extents.
    float w = uSize.x;
    float h = uSize.y;
    float proj0 = dot(vec2(0.0, 0.0), stripeNormal);
    float proj1 = dot(vec2(w,   0.0), stripeNormal);
    float proj2 = dot(vec2(0.0, h  ), stripeNormal);
    float proj3 = dot(vec2(w,   h  ), stripeNormal);

    float minProj = min(min(proj0, proj1), min(proj2, proj3));
    float maxProj = max(max(proj0, proj1), max(proj2, proj3));

    // The band moves along stripeNormal at this projected speed (px/sec).
    float vProj = dot(uMoveDir, stripeNormal) * uSpeed;
    float startProj = dot(uStartPx, stripeNormal);

    // Compute how long it takes for the band center to travel fully past the object.
    float travelTime = 0.0;
    if (abs(vProj) > 0.00001)
    {
        float endProj = (vProj > 0.0)
            ? (maxProj + halfThickness + softness)
            : (minProj - halfThickness - softness);

        travelTime = max(0.0, (endProj - startProj) / vProj);
    }

    // Repeat logic: sweep for travelTime, then wait uRepeatDelay, then restart from uStartPx.
    float cycleTime = travelTime + max(0.0, uRepeatDelay);
    float t = max(0.0, uTime - uTimeOffset);
    float phaseTime = (cycleTime > 0.0) ? mod(t, cycleTime) : t;
    float activeTime = min(phaseTime, travelTime);

    float travelPx = activeTime * uSpeed;
    vec2 origin = uStartPx + (uMoveDir * travelPx);

    // Signed distance from point to stripe center line, measured along stripe normal (px)
    float distPx = dot(p - origin, stripeNormal);

    float mask = bandMask(distPx, halfThickness, softness);

    // Additive-ish shine while preserving alpha
    color.rgb += (uShineColor * (mask * uIntensity)) * texture.a;

    gl_FragColor = color;
}
`;

export type ImageShinePipelineData = {
  // Movement along object space (px). For bottom->top use { moveDirX: 0, moveDirY: -1 }.
  moveDirX?: number;
  moveDirY?: number;

  // Stripe direction in degrees (0 = left->right stripe, i.e. horizontal band).
  // A horizontal shine band is stripeAngleDeg = 0.
  stripeAngleDeg?: number;

  // Band thickness and feather (px, in display space)
  thicknessPx?: number;
  softnessPx?: number;

  // Travel speed (px/sec)
  speedPxPerSec?: number;

  // Delay after the shine completes a full sweep (sec). If omitted, defaults to 0 (immediate restart).
  repeatDelaySec?: number;
  // Back-compat alias (will be treated as repeatDelaySec).
  repeatSec?: number;

  // Per-object time offset (sec). If set to the current game time, the sweep starts "now".
  timeOffsetSec?: number;

  // Start point in object pixel space (px)
  startXPx?: number;
  startYPx?: number;

  // Color / strength
  intensity?: number;
  color?: { r: number; g: number; b: number }; // 0..1
};

export class ImageShinePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: IMAGE_SHINE_PIPELINE_KEY,
      fragShader: FRAG_SHADER,
    });
  }

  override onPreRender(): void {
    // Phaser game loop time is in ms
    this.set1f('uTime', this.game.loop.time / 1000);
  }

  override onBind(gameObject?: Phaser.GameObjects.GameObject): void {
    const goAny = gameObject as any;
    const data = (goAny?.pipelineData ?? {}) as ImageShinePipelineData;

    // Object display size (px)
    const w = typeof goAny?.displayWidth === 'number' ? goAny.displayWidth : 1;
    const h = typeof goAny?.displayHeight === 'number' ? goAny.displayHeight : 1;
    this.set2f('uSize', w, h);

    // Movement direction (normalized)
    const mdx = typeof data.moveDirX === 'number' ? data.moveDirX : 1;
    const mdy = typeof data.moveDirY === 'number' ? data.moveDirY : 0;
    const len = Math.hypot(mdx, mdy) || 1;
    this.set2f('uMoveDir', mdx / len, mdy / len);

    // Speed
    const speed = typeof data.speedPxPerSec === 'number' ? data.speedPxPerSec : 300;
    this.set1f('uSpeed', speed);

    // Per-object time offset (sec)
    const timeOffsetSec = typeof data.timeOffsetSec === 'number' ? data.timeOffsetSec : 0;
    this.set1f('uTimeOffset', timeOffsetSec);

    // Delay after finishing a sweep (sec). <= 0 restarts immediately.
    const repeatDelaySec =
      typeof data.repeatDelaySec === 'number'
        ? data.repeatDelaySec
        : (typeof data.repeatSec === 'number' ? data.repeatSec : 0);
    this.set1f('uRepeatDelay', repeatDelaySec);

    // Stripe angle (degrees -> radians). 0 deg = horizontal band.
    const angleDeg = typeof data.stripeAngleDeg === 'number' ? data.stripeAngleDeg : 0;
    this.set1f('uStripeAngle', (angleDeg * Math.PI) / 180);

    // Band thickness + feathering
    const thickness = typeof data.thicknessPx === 'number' ? data.thicknessPx : 20;
    const softness = typeof data.softnessPx === 'number' ? data.softnessPx : 8;
    this.set1f('uThickness', thickness);
    this.set1f('uSoftness', softness);

    // Start point (px)
    const startX = typeof data.startXPx === 'number' ? data.startXPx : 0;
    const startY = typeof data.startYPx === 'number' ? data.startYPx : h * 0.5;
    this.set2f('uStartPx', startX, startY);

    // Color / intensity
    const intensity = typeof data.intensity === 'number' ? data.intensity : 0.6;
    const c = data.color ?? { r: 1, g: 1, b: 1 };
    this.set1f('uIntensity', intensity);
    this.set3f('uShineColor', c.r, c.g, c.b);
  }
}


