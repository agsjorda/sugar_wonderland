import { State } from "../../fsm/state";
import { Events } from "./Events";
import { IdleState } from "./IdleState";


export class WinState extends State {
	static TIMER = 1000
	start(scene) {
		// Calculate wins
		const multiplier = scene.gameData.currentMatchingSymbols[0] + 1;
		let winAmount = 0;

		if (scene.gameData.currentMatchingSymbols.length > 0) {
			if(scene.gameData.doubleChanceEnabled) {
				winAmount += scene.gameData.bet * multiplier * scene.gameData.doubleChanceMultiplier;
			} else {
				winAmount += scene.gameData.bet * multiplier;
			}
		}

		this.winAmount = winAmount

		// Return the bet then add the win
		scene.gameData.balance += winAmount + scene.gameData.bet;
		scene.gameData.totalWin += winAmount;
		
		this.timer = WinState.TIMER
		this.createOverlay(scene)

		Events.emitter.emit(Events.WIN, {})
	}

	update(scene, time, delta) {
		this.startText.setText(`You win $${this.winAmount}! New game in ${Math.floor(this.timer / 1000)} seconds`)

		this.timer -= delta
		if (this.timer <= 0) {
			this.stateMachine.setState(new IdleState(), scene);
		}
	}

	end() {
		this.overlay.destroy();
		this.startText.destroy();
	}

	
	createOverlay(scene) {
		const width = scene.scale.width;
		const height = scene.scale.height;

		this.overlay = scene.add.graphics({
				fillStyle: { color: 0x000000, alpha: 0.5 }
		});
		this.overlay.setDepth(100);
		this.overlay.fillRect(0, 0, width, height);

		this.startText = scene.add.text(width / 2, height / 2, 'Click anywhere to start', {
			fontSize: '70px',
			fill: '#ffffff',
			align: 'center',
			fontStyle: 'bold'
		});

		this.startText.setOrigin(0.5, 0.5);
		this.startText.setDepth(101);
	}
	
}