import { Scene } from 'phaser';

/**
 * Simple camera shake helper.
 *
 * Usage:
 *   await cameraShake(this, 250, 0.01, 100);
 *
 * - `duration` in ms
 * - `magnitude` is the shake intensity (0–1 is typical)
 * - `delay` in ms before the shake starts
 *
 * Returns a Promise so it can be awaited / chained with other effects.
 */
export function cameraShake(
	scene: Scene,
	duration: number,
	magnitude: number,
	delay: number = 0
): Promise<void> {
	return new Promise<void>((resolve) => {
		const cam = scene.cameras.main;

		// If there is no main camera, resolve immediately
		if (!cam) {
			resolve();
			return;
		}

		// Clamp magnitude to a sane range
		const intensity = Math.max(0, Math.min(1, magnitude));

		const startShake = () => {
			// Phaser 3 Camera.shake signature:
			// shake(duration, intensity, force, callback?, context?)
			cam.shake(duration, intensity, true, () => {
				resolve();
			});
		};

		if (delay > 0) {
			scene.time.delayedCall(delay, startShake);
		} else {
			startShake();
		}
	});
}


