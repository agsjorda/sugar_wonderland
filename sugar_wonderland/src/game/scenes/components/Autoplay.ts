import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import { GameData } from './GameData';
import { SlotMachine } from './SlotMachine';
import { Buttons } from '../../ui/Buttons';
import { AudioManager } from './AudioManager';

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    buttons: Buttons;
}

export class Autoplay {
    public isAutoPlaying: boolean = false;
    private remainingSpins: number = 0;
    private scene: GameScene | null = null;
    private spinInterval: ReturnType<typeof setTimeout> | null = null;
    private remainingSpinsText: GameObjects.Text | null = null;
    private remainingSpinsBg: GameObjects.Graphics | null = null;

    preload(scene: GameScene): void {
        this.scene = scene;
    }

    create(scene: GameScene): void {
        this.scene = scene;
    }

    start(scene: GameScene, numSpins: number): void {
        if (this.isAutoPlaying) return;
        
        this.isAutoPlaying = true;
        this.remainingSpins = numSpins;
        this.scene = scene;
        
        // Create remaining spins display
        this.createRemainingSpinsDisplay();
        
        // Start the first spin immediately if not already spinning
        if (!scene.gameData.isSpinning) {
            this.spin();
        }

        // Listen for matches completion
        Events.emitter.on(Events.MATCHES_DONE, () => {
            if (this.isAutoPlaying && this.scene && !this.scene.gameData.isSpinning) {
                // Add a small delay before next spin
                this.spinInterval = setTimeout(() => {
                    this.spin();
                }, 750);
            }
        });
    }

    private createRemainingSpinsDisplay(): void {
        if (!this.scene) return;

        // Remove existing text and background if they exist
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
        }

        // Position it near the autoplay button
        const x = this.scene.scale.width * 0.85;
        const y = this.scene.scale.height * 0.65;

        // Create background for better visibility
        this.remainingSpinsBg = this.scene.add.graphics();
        this.remainingSpinsBg.fillStyle(0x000000, 0.5);
        this.remainingSpinsBg.fillRoundedRect(x - 100, y + 100, 200, 40, 20);
        
        // Create text with different styling based on free spins vs autospins
        const displayText = this.scene.gameData.freeSpins ? 
            `${this.remainingSpins} spins left` : 
            `${this.remainingSpins} spins left`;
            
        this.remainingSpinsText = this.scene.add.text(x, y + 120, displayText, {
            fontSize: '28px',
            color: this.scene.gameData.freeSpins ? '#66D449' : '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        this.remainingSpinsText.setOrigin(0.5, 0.5);
        this.remainingSpinsText.setDepth(1000);
        this.remainingSpinsBg.setDepth(999);

        // Add to scene
        this.scene.add.existing(this.remainingSpinsBg);
        this.scene.add.existing(this.remainingSpinsText);
    }

    public updateRemainingSpinsDisplay(): void {
        if (!this.scene || !this.remainingSpinsText) return;

        // During bonus round, show total free spins (remaining + newly added)
        const displayText = this.scene.gameData.freeSpins ? 
            `${this.scene.gameData.freeSpins} spins left` : 
            `${this.remainingSpins} spins left`;
        this.remainingSpinsText.setText(displayText);
        this.remainingSpinsText.setColor(this.scene.gameData.freeSpins ? '#66D449' : '#FFFFFF');
    }

    stop(): void {
        this.isAutoPlaying = false;
        this.remainingSpins = 0;
        
        if (this.spinInterval) {
            clearTimeout(this.spinInterval);
            this.spinInterval = null;
        }
        
        Events.emitter.removeListener(Events.MATCHES_DONE);
        
        // Remove both text and background
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
            this.remainingSpinsText = null;
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
            this.remainingSpinsBg = null;
        }

        Events.emitter.emit(Events.AUTOPLAY_STOP);
    }

    private spin(): void {
        if (!this.scene) return;

        if (this.scene.gameData.isSpinning) {
            return;
        }

        // For free spins, check scene.gameData.freeSpins instead of remainingSpins
        if (!this.isAutoPlaying || 
            (!this.scene.gameData.isBonusRound && this.remainingSpins <= 0) ||
            (this.scene.gameData.isBonusRound && this.scene.gameData.freeSpins <= 0)) {
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        // Check if audio manager's music is paused
        if (this.scene.audioManager.BGChecker?.isPaused) {
            // Wait and check again in a short interval
            setTimeout(() => this.spin(), 500);
            return;
        }

        // If music has resumed, destroy any active win overlay
        if (this.scene.slotMachine.activeWinOverlay) {
            this.scene.slotMachine.destroyWinOverlay(this.scene);
        }

        // For free spins, don't check balance
        if (!this.scene.gameData.freeSpins) {
            // Check if player has enough balance for the bet
            if (this.scene.gameData.balance < this.scene.gameData.bet) {
                this.stop();
                Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
                return;
            }
        }

        // Reset total win for new spin
        this.scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});

        // Ensure we have valid slot data
        if (!this.scene.gameData.slot?.values?.length) {
            console.error('Invalid slot data in autoplay spin');
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        // Trigger spin
        Events.emitter.emit(Events.SPIN, {
            currentRow: this.scene.gameData.currentRow,
            symbols: this.scene.gameData.slot.values
        });

        // Only decrease remaining spins if we're not in bonus round
        //if (!this.scene.gameData.isBonusRound) {
        if(this.remainingSpins > 0) {
            this.remainingSpins--;
            // Update the display
            this.updateRemainingSpinsDisplay();
        }
        //}
    }

    update(_scene: GameScene, _time: number, _delta: number): void {
        // Empty implementation - can be used for future animations or updates
    }
} 