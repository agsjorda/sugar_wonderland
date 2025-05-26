import { Scene, GameObjects } from 'phaser';
import { State } from '../../fsm/state';
import { IdleState } from './IdleState';
import { GameData } from './GameData';
import { Buttons } from '../../ui/Buttons';

// Extend Scene to include gameData and buttons
interface GameScene extends Scene {
    gameData: GameData;
    buttons: Buttons;
}

export class LoseState extends State {
    private static readonly TIMER: number = 1000;
    private timer: number;
    private overlay: GameObjects.Graphics;
    private startText: GameObjects.Text;

    start(scene: Scene): void {
        const gameScene = scene as GameScene;
        this.createOverlay(gameScene);
        this.timer = LoseState.TIMER;
    }

    update(scene: Scene, _time: number, delta: number): void {
        const gameScene = scene as GameScene;
        this.startText.setText(`You lose! New game in ${Math.floor(this.timer / 1000)} seconds`);
        
        this.timer -= delta;
        if (this.timer <= 0) {
            if (this.stateMachine) {
                this.stateMachine.setState(new IdleState(), gameScene);
                // The idle animation will be handled by the Buttons class
                gameScene.buttons.startIdleAnimation(gameScene);
            }
        }
    }

    end(_scene: Scene): void {
        this.overlay.destroy();
        this.startText.destroy();
    }

    private createOverlay(scene: GameScene): void {
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
            align: 'center'
        });

        this.startText.setOrigin(0.5, 0.5);
        this.startText.setDepth(101);
    }
} 