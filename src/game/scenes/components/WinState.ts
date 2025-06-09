import { Scene, GameObjects } from 'phaser';
import { State } from '../../fsm/state';
import { Events } from './Events';
import { IdleState } from './IdleState';

export class WinState extends State {
    private static readonly TIMER: number = 1000;
    private timer: number;
    private winAmount: number;
    private overlay: GameObjects.Graphics;
    private startText: GameObjects.Text;

    start(scene: Scene): void {
        // Calculate wins
        const multiplier = scene.gameData.currentMatchingSymbols[0] + 1;
        let winAmount = 0;

        if (scene.gameData.currentMatchingSymbols.length > 0) {
            if (scene.gameData.doubleChanceEnabled) {
                winAmount += scene.gameData.bet * multiplier * scene.gameData.doubleChanceMultiplier;
            } else {
                winAmount += scene.gameData.bet * multiplier;
            }
        }

        this.winAmount = winAmount;

        // Return the bet then add the win
        scene.gameData.balance += winAmount + scene.gameData.bet;
        scene.gameData.totalWin += winAmount;
        
        this.timer = WinState.TIMER;
        this.createOverlay(scene);

        Events.emitter.emit(Events.WIN, {});
    }

    update(scene: Scene, _time: number, delta: number): void {
        this.startText.setText(`You win $${this.winAmount}! New game in ${Math.floor(this.timer / 1000)} seconds`);

        this.timer -= delta;
        if (this.timer <= 0) {
            if (this.stateMachine) {
                this.stateMachine.setState(new IdleState(), scene);
            }
        }
    }

    end(_scene: Scene): void {
        this.overlay.destroy();
        this.startText.destroy();
    }

    private createOverlay(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        this.overlay = scene.add.graphics({
            fillStyle: { color: 0x000000, alpha: 0.5 }
        });
        this.overlay.setDepth(100);
        this.overlay.fillRect(0, 0, width, height);

        this.startText = scene.add.text(width / 2, height / 2, 'Click anywhere to start', {
            fontSize: '70px',
            color: '#ffffff',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });

        this.startText.setOrigin(0.5, 0.5);
        this.startText.setDepth(101);
    }
} 