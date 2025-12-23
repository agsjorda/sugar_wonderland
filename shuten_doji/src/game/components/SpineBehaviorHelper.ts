import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { Scene } from "phaser";

interface SpineConfig {
    scalePair?: {x: number, y: number };
    scale?: number;
    anchor?: {x: number, y: number };
    origin?: {x: number, y: number };
    offset?: {x: number, y: number };
    depth?: number;
    loopLastAnimation?: boolean;
    timeScale?: number; // not yet implemented
    onComplete?: () => void;
}

export function hideSpineAttachmentsByKeywords(spine: SpineGameObject, keywords: string[]) {
	try {
        const skeleton = (spine as any)?.skeleton;
        const slots = skeleton?.slots as Array<any> | undefined;
        if (!skeleton || !slots) return;

        const lowerKeywords = keywords.map(k => k.toLowerCase());
        for (const slot of slots) {
            const slotName = slot?.data?.name ? String(slot.data.name).toLowerCase() : '';
            const attachmentName = slot?.attachment?.name ? String(slot.attachment.name).toLowerCase() : '';
            const matches = lowerKeywords.some(k => slotName.includes(k) || attachmentName.includes(k));
            if (matches) {
                skeleton.setAttachment(slot.data.name, null);
            }
        }
    } catch {}
}
export function playSpineAnimationSequence(spine: SpineGameObject, animationSequence: number[], loopLastAnimation: boolean = true, onComplete?: () => void) {
    
    // Compute total duration (ms) of the animations to be played (one iteration each), factoring in timeScale
    let totalDurationMs = 0;

    try {
        const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;

        if (!animations)
            return 0;

        const animationNames: string[] = animationSequence.map(index => animations && animations.length > 0 && index < animations.length ? animations[index].name : null).filter(name => name !== null) as string[];

        // Sum durations (convert seconds to ms) and apply current timeScale if any
        try {
            const timeScale = Math.max(0, (spine as any)?.animationState?.timeScale ?? 1);
            for (const name of animationNames) {
                const durSec = (spine as any)?.skeleton?.data?.findAnimation?.(name)?.duration;
                const durMs = (typeof durSec === 'number' && durSec > 0 ? durSec : 0) * 1000 * (timeScale || 1);
                totalDurationMs += durMs;
            }
        } catch {}

        if (animationNames.length === 1) {
            spine.animationState.setAnimation(0, animationNames[0], loopLastAnimation);
        }
        else {
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.data.setMix(animationNames[i], animationNames[i + 1], 0.05);
            }

            // Play starting animation once, then queue looping animation (blended via mix)
            spine.animationState.setAnimation(0, animationNames[0], false);
            
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.addAnimation(0, animationNames[i + 1], i == animationNames.length - 1 ? false : loopLastAnimation, 0);
            }
        }
        
    } catch { }
    
    // Attach onComplete listener for the last non-looping animation in the sequence
    try {
        if (onComplete) {
            const state = (spine as any)?.animationState;
            const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;
            if (state && animations) {
                const validNames: string[] = animationSequence
                    .map(index => animations && animations.length > 0 && index < animations.length ? animations[index].name : null)
                    .filter(name => name !== null) as string[];
                if (validNames.length > 0) {
                    const lastAnimationName = validNames[validNames.length - 1];

                    const listener = {
                        complete: (entry: any) => {
                            try {
                                const isTrack0 = entry?.trackIndex === 0;
                                const animName = entry?.animation?.name ?? "";
                                const isLast = animName === lastAnimationName;
                                const isNonLooping = entry?.loop === false;
                                if (isTrack0 && isLast && isNonLooping) {
                                    state.removeListener(listener as any);
                                    onComplete();
                                }
                            } catch {}
                        }
                    };

                    state.addListener(listener as any);
                }
            }
        }
    } catch {}

    return totalDurationMs;

}

export function playSpineAnimationSequenceWithConfig(
    scene: Scene, spine: 
    SpineGameObject, 
    animationSequence: number[], 
    scale?: { x: number, y: number }, 
    anchor?: { x: number, y: number }, 
    origin?: { x: number, y: number }, 
    offset?: { x: number, y: number }, 
    depth?: number, 
    loopLastAnimation?: boolean,
    onComplete?: () => void) : number
    {
    const centerX = scene.scale.width * (anchor?.x ?? 0.5) + (offset?.x || 0);
    const centerY = scene.scale.height * (anchor?.y ?? 0.5) + (offset?.y || 0);

    spine.setPosition(centerX, centerY);
    spine.setOrigin(origin?.x ?? 0.5, origin?.y ?? 0.5);
    spine.setDepth(depth ?? 3);
    spine.setVisible(true);
    spine.setScale(scale?.x ?? 1, scale?.y ?? 1);

    // Compute total duration (ms) of the animations to be played (one iteration each), factoring in timeScale
    let totalDurationMs = 0;

    try {
        const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;

        if (!animations)
            return 0;

        const animationNames: string[] = animationSequence.map(index => animations && animations.length > 0 && index < animations.length ? animations[index].name : null).filter(name => name !== null) as string[];

        // Sum durations (convert seconds to ms) and apply current timeScale if any
        try {
            const timeScale = Math.max(0, (spine as any)?.animationState?.timeScale ?? 1);
            for (const name of animationNames) {
                const durSec = (spine as any)?.skeleton?.data?.findAnimation?.(name)?.duration;
                const durMs = (typeof durSec === 'number' && durSec > 0 ? durSec : 0) * 1000 * (timeScale || 1);
                totalDurationMs += durMs;
            }
        } catch {}

        if (animationNames.length === 1) {
            spine.animationState.setAnimation(0, animationNames[0], loopLastAnimation ?? true);
        }
        else {
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.data.setMix(animationNames[i], animationNames[i + 1], 0.05);
            }

            // Play starting animation once, then queue looping animation (blended via mix)
            spine.animationState.setAnimation(0, animationNames[0], false);
            
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.addAnimation(0, animationNames[i + 1], i == animationNames.length - 1 ? false : loopLastAnimation ?? true, 0);
            }
        }
        
    } catch { }
    
    // Attach onComplete listener for the last non-looping animation in the sequence
    try {
        if (onComplete) {
            const state = (spine as any)?.animationState;
            const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;
            if (state && animations) {
                const validNames: string[] = animationSequence
                    .map(index => animations && animations.length > 0 && index < animations.length ? animations[index].name : null)
                    .filter(name => name !== null) as string[];
                if (validNames.length > 0) {
                    const lastAnimationName = validNames[validNames.length - 1];

                    const listener = {
                        complete: (entry: any) => {
                            try {
                                const isTrack0 = entry?.trackIndex === 0;
                                const animName = entry?.animation?.name ?? "";
                                const isLast = animName === lastAnimationName;
                                const isNonLooping = entry?.loop === false;
                                if (isTrack0 && isLast && isNonLooping) {
                                    state.removeListener(listener as any);
                                    onComplete();
                                }
                            } catch {}
                        }
                    };

                    state.addListener(listener as any);
                }
            }
        }
    } catch {}

    return totalDurationMs;
}

// export function playSpineAnimationSequence(scene: Scene, spine: 
//     SpineGameObject, 
//     animationSequence: number[], config?: SpineConfig) : number
// {
//     return 0;
// }

export function getFullScreenSpineScale(scene: Scene, spine: SpineGameObject, maintainAspectRatio: boolean = false): { x: number, y: number } {
    const skeletonData = (spine as any)?.skeleton?.data;
    const skeletonWidth = (skeletonData?.width && skeletonData.width > 0) ? skeletonData.width : 1080;
    const skeletonHeight = (skeletonData?.height && skeletonData.height > 0) ? skeletonData.height : 1920;
    const scaleX = scene.scale.width / skeletonWidth;
    const scaleY = scene.scale.height / skeletonHeight;

    if (maintainAspectRatio) {
        const maxOutput = Math.max(scaleX, scaleY);
        return { x: maxOutput, y: maxOutput };
    }

    return { x: scaleX, y: scaleY };
}