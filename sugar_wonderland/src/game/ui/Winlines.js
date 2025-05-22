import { Events } from "../scenes/components/Events";
import { GameData, Slot } from "../scenes/components/GameData";


export class WinLines {
	constructor() {
		this.indicators = []
	}

	preload(scene) {
		// scene.load.image('plus', 'assets/Controller/Spin.png');

		this.initEventListeners(scene);
	}

	create(scene) {
		Events.emitter.emit(Events.CHANGE_LINE, { 
			line: scene.gameData.line
		});
	}

	update(scene, time, delta) {	

	}

	end() {
		Events.emitter.off(Events.CHANGE_LINE, this.changeLineEventListener)
		this.changeLineEventListener = undefined
	}


	initEventListeners(scene) {
		this.changeLineEventListener = (...args) => {
			//this.changeLine(scene, ...args);
		};

		//Events.emitter.on(Events.CHANGE_LINE, this.changeLineEventListener)
	}

	changeLine(scene, data) {
		const width = scene.scale.width;
		const height = scene.scale.height;

		this.indicators.forEach((indicator) => {
			scene.tweens.killTweensOf(indicator);
			indicator.destroy();
		});
		this.indicators = [];
		if (this.container) {
			this.container.destroy();
		}
		
		this.container = scene.add.container(width * 0.2825, height * 0.325);
		this.container.setDepth(3);

		let winLines = GameData.WIN_LINES[data.line]
		
		return;
		for (let y = 0; y < Slot.COLUMNS; y++) {
			for (let x = 0; x < Slot.ROWS; x++) {
				if (winLines[y][x] == 1) {
					// const container = scene.add.container(width * 0.23, height * 0.240);
					
					
					const adjX = 20;
					const adjY = 0;
					const adjWidth = 190;
					const adjHeight = 190;
					const panelWidth = 200;
					const panelHeight = 200;

					const xPos = x * (adjWidth + adjX);
					const yPos = y * (adjHeight + adjY);

					const cornerRadius = 100;
					const indicator = scene.add.graphics();
					indicator.fillStyle(0x000000, 1.0);
					// indicator.fillRoundedRect(0, 0, panelWidth, panelHeight, cornerRadius);
					indicator.fillCircle(xPos, yPos, panelWidth * 0.5);
					this.container.add(indicator);

					scene.tweens.add({
						targets: indicator,
						alpha: { from: 0.1, to: 0.4 },
						duration: 800,
						ease: 'Sine.easeInOut',
						yoyo: true,
						repeat: -1
					});
					this.indicators.push(indicator);
				}
			}
		}

		

	}

}
