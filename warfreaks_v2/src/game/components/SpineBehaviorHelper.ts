import { SpineGameObject } from "@esotericsoftware/spine-phaser-v3";
import { Scene } from "phaser";

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

export function playSpineAnimationSequence(scene: Scene, spine: SpineGameObject, animationSequence: number[], scale?: { x: number, y: number }, anchor?: { x: number, y: number }, origin?: { x: number, y: number }, offset?: { x: number, y: number }, depth?: number, normalizedTime?: number) {
    const centerX = scene.scale.width * (anchor?.x ?? 0.5) + (offset?.x || 0);
    const centerY = scene.scale.height * (anchor?.y ?? 0.5) + (offset?.y || 0);

    spine.setPosition(centerX, centerY);
    spine.setOrigin(origin?.x ?? 0.5, origin?.y ?? 0.5);
    spine.setDepth(depth ?? 3);
    spine.setVisible(true);
    spine.setScale(scale?.x ?? 1, scale?.y ?? 1);

    try {
        const animations = (spine as any)?.skeleton?.data?.animations as Array<{ name: string }> | undefined;

        if (!animations)
            return;

        const animationNames: string[] = animationSequence.map(index => animations && animations.length > 0 && index < animations.length ? animations[index].name : null).filter(name => name !== null) as string[];

        if (animationNames.length === 1) {
            spine.animationState.setAnimation(0, animationNames[0], true);
            
        }
        else {
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.data.setMix(animationNames[i], animationNames[i + 1], 0.05);
            }

            // Play starting animation once, then queue looping animation (blended via mix)
            spine.animationState.setAnimation(0, animationNames[0], false);
            
            for (let i = 0; i < animationNames.length - 1; i++) {
                spine.animationState.addAnimation(0, animationNames[i + 1], i == animationNames.length - 1 ? false : true, 0);
            }
        }
    } catch { }
}

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