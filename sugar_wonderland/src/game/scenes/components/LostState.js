import { State } from "../../fsm/state";
import { IdleState } from "./IdleState";


export class LoseState extends State {
	static TIMER = 1000

	start(scene) {
		createOverlay(scene, this)
		
		this.timer = LoseState.TIMER
	}

	update(scene, time, delta) {
		console.error("LoseState update");
		this.startText.setText('You lose! New game in ' + Math.floor(this.timer / 1000) + ' seconds')
		
		this.timer -= delta
		if (this.timer <= 0) {
			this.stateMachine.setState(new IdleState(), scene);

			scene.buttons.idleTween = scene.tweens.add({
				targets: scene.buttons.spinButton,
				angle: '+=360',
				duration: 8000,
				repeat: -1,
				ease: 'Linear'
			});
		}
	}

	end() {
		this.overlay.destroy();
		this.startText.destroy();
	}
}

function createOverlay(scene, state) {
	const width = scene.scale.width;
	const height = scene.scale.height;

	state.overlay = scene.add.graphics({
			fillStyle: { color: 0x000000, alpha: 0.5 }
	});
	state.overlay.setDepth(100);
	state.overlay.fillRect(0, 0, width, height);

	state.startText = scene.add.text(width / 2, height / 2, 'Click anywhere to start', {
		fontSize: '70px',
		fill: '#ffffff',
		align: 'center'
	});

	state.startText.setOrigin(0.5, 0.5);
	state.startText.setDepth(101);
}