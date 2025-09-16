import { EventManager, GameEvents } from "../../event/EventManager";
import { Data } from "../../tmp_backend/Data";
import { Game } from "../scenes/Game";


export class Cat {
  public scene: Game;

  constructor() { }

  public preload(scene: Game) {
    const PREFIX = 'assets/background/';
    scene.load.image('kobi-cat', PREFIX + 'kobi-cat.png');
  }

  public create(scene: Game) {
    const catNormal = scene.add.image(
      scene.scale.width * 0.775, 
      scene.scale.height * 0.78, 
      'kobi-cat'
    )
    .setDepth(2);

		const catBonus = scene.add.image(
      scene.scale.width * 0.78, 
      scene.scale.height * 0.75, 
      'kobi-cat-bonus'
    )
    .setVisible(false)
    .setDepth(2);

		EventManager.on(GameEvents.SPIN_DONE, (data: Data) => {
			if (data.isScatter) {
				catNormal.setVisible(false);
				catBonus.setVisible(true);
			} else {
				catNormal.setVisible(true);
				catBonus.setVisible(false);
			}
		});	
  }
}