import { Events } from "../scenes/components/Events";

export class Character {

  constructor() {
    this.spineCharacter = null;
  }

  preload(scene) {
    const prefix = 'assets/Assets/Character';
    scene.load.spineAtlas('character-atlas', `${prefix}/char.atlas`, [`${prefix}/char.png`]);
    scene.load.spineJson('character', `${prefix}/char.json`);
  }

  create(scene) {
		const width = scene.scale.width;
		const height = scene.scale.height;

		const spineObject = scene.add.spine(width * 0.14, height * 0.5, "character", "character-atlas");
		spineObject.setScale(0.25)
		spineObject.animationState.setAnimation(0, "Idle", true);
		spineObject.setDepth(10);

		//Events.emitter.on(Events.WIN, () => {
		//	spineObject.animationState.setAnimation(0, "Win", true);
//
		//	const id = setTimeout(() => {
		//		spineObject.animationState.setAnimation(0, "Idle", true);
		//		clearTimeout(id)
		//	}, 2000)
		//})
  }
}