import { Scene } from 'phaser';
import { StateMachine } from '../fsm/statemachine';
import { Background } from './components/Background';
import { SlotMachine } from './components/SlotMachine';
import { GameData } from './components/GameData';
import { StartState } from './components/StartState';
import { Character } from '../ui/Character';
import { Buttons } from '../ui/Buttons';
import { WinLines } from '../ui/Winlines';
import { AudioManager } from './components/AudioManager';    
import { Autoplay } from './components/Autoplay';
import { HelpScreen } from './components/HelpScreen';

// Interface for component lifecycle management
interface GameComponent {
    preload?: (scene: Game) => void;
    create?: (scene: Game) => void;
    update?: (scene: Game, time: number, delta: number) => void;
    destroy?: () => void;
}

export class Game extends Scene {
    public stateMachine: StateMachine;
    public gameData: GameData;
    public background: Background;
    public slotMachine: SlotMachine;
    public character: Character;
    public buttons: Buttons;
    public winLines: WinLines;
    public audioManager: AudioManager;
    public autoplay: Autoplay;
    public helpScreen: HelpScreen;

    private components: GameComponent[];

    constructor() {
        super('Game');
        
        // Initialize all components
        this.stateMachine = new StateMachine();
        this.gameData = new GameData();
        this.background = new Background();
        this.slotMachine = new SlotMachine();
        this.character = new Character();
        this.buttons = new Buttons();
        this.winLines = new WinLines();
        this.audioManager = new AudioManager();


        // Store components for lifecycle management
        this.components = [
            this.background,
            this.slotMachine,
            this.character,
            this.buttons,
            this.winLines,
            this.audioManager,
        ];
    }

    preload(): void {
        try {
            // Preload all components
            for (const component of this.components) {
                if (component.preload) {
                    component.preload(this);
                }
            }
        } catch (error) {
            console.error('Error during preload:', error);
            // Handle preload error appropriately
        }
    }
    
    create(): void {
        try {
            // Set initial state
            this.stateMachine.setState(new StartState(), this);

            // Create all components
            for (const component of this.components) {
                if (component.create) {
                    component.create(this);
                }
            }
        } catch (error) {
            console.error('Error during create:', error);
            // Handle creation error appropriately
        }
    }

    update(time: number, delta: number): void {
        try {
            // Update state machine first
            this.stateMachine.update(this, time, delta);

            // Update all components
            for (const component of this.components) {
                if (component.update) {
                    component.update(this, time, delta);
                }
            }
        } catch (error) {
            console.error('Error during update:', error);
            // Handle update error appropriately
        }
        
    }

    shutdown(): void {
        try {
            // Clean up all components
            for (const component of this.components) {
                if (component.destroy) {
                    component.destroy();
                }
            }

            // Stop autoplay if active
            if (this.autoplay.isAutoPlaying) {
                this.autoplay.stop();
            }

            // Clear component references
            this.components = [];
        } catch (error) {
            console.error('Error during shutdown:', error);
            // Handle shutdown error appropriately
        }
    }

    showHelpScreen(): void {
        this.helpScreen.show();
    }

    hideHelpScreen(): void {
        this.helpScreen.hide();
    }
} 