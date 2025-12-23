import { Scene } from "phaser";

export class GameInfoOverlay
{
    createGameInfoOverlay(scene: Scene)
    {
		scene.add.text(scene.scale.width * 0.5, scene.scale.height * 0.01, "This is some test text", {
			fontFamily: 'Poppins-Regular',
			fontSize: '15px',
			color: '#FFFFFF',
			align: 'center'
		}).setOrigin(0.5, 0).setDepth(99999);
    }
}