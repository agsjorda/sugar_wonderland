import { Scene, GameObjects } from 'phaser';
import { Events } from "../scenes/components/Events";
import { GameData, Slot } from "../scenes/components/GameData";

interface LineChangeData {
    line: number;
}

export class WinLines {
    private indicators: GameObjects.Graphics[];
    private container: GameObjects.Container | undefined;
    private changeLineEventListener?: (...args: any[]) => void;
    private winLineContainers: GameObjects.Container[];

    constructor() {
        this.indicators = [];
        this.winLineContainers = [];
    }

    preload(scene: Scene): void {
        // scene.load.image('plus', 'assets/Controller/Spin.png');
        this.initEventListeners(scene);
    }

    create(scene: Scene): void {
        Events.emitter.emit(Events.CHANGE_LINE, { 
            line: scene.gameData.line
        });
    }

    update(scene: Scene, time: number, delta: number): void {
        // Empty implementation
    }

    end(): void {
        if (this.changeLineEventListener) {
            Events.emitter.off(Events.CHANGE_LINE, this.changeLineEventListener);
            this.changeLineEventListener = undefined;
        }
    }

    private initEventListeners(scene: Scene): void {
        this.changeLineEventListener = (...args: any[]) => {
            //this.changeLine(scene, ...args);
        };

        //Events.emitter.on(Events.CHANGE_LINE, this.changeLineEventListener);
    }

    private createWinLine(scene: Scene, data: any): void {
        let width = scene.scale.width;
        let height = scene.scale.height;

        let container = scene.add.container(width * 0.2825, height * 0.325);
        container.setDepth(3);

        let winLines = GameData.WIN_LINES[data.line];

        for (let i = 0; i < winLines.length; i++) {
            let [x, y] = winLines[i];

            let adjX = 20;
            let adjY = 0;
            let adjWidth = 190;
            let adjHeight = 190;
            let panelWidth = 200;
            let panelHeight = 200;

            let xPos = x * (adjWidth + adjX);
            let yPos = y * (adjHeight + adjY);

            let cornerRadius = 100;
            let indicator = scene.add.graphics();
            indicator.lineStyle(4, 0xFFD700, 1);
            indicator.strokeRoundedRect(xPos, yPos, panelWidth, panelHeight, cornerRadius);
            container.add(indicator);

            scene.tweens.add({
                targets: indicator,
                alpha: { from: 1, to: 0 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        }

        this.winLineContainers.push(container);
    }
} 