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
    helpScreen: any; // Reference to help screen
    autoplay: Autoplay; // Reference to autoplay
}

export class Autoplay {
    public isAutoPlaying: boolean = false;
    public remainingSpins: number = 0;
    private scene: GameScene;
    private spinInterval: ReturnType<typeof setTimeout>;
    private remainingSpinsText?: GameObjects.Text;
    private spinsText_Y: number = 0;
    private remainingSpinsBg?: GameObjects.Graphics;
    private isMobile: boolean = false;
    private matchesDoneListener: () => void; // Store listener reference for proper cleanup
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private spinScheduled: boolean = false;

    preload(scene: GameScene): void {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();
    }
    
    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    create(scene: GameScene): void {
        this.scene = scene;
        
        // Create the matches done listener once
        this.matchesDoneListener = () => {
            scene.gameData.debugLog("Autoplay MATCHES_DONE received");
            scene.gameData.debugLog(`Autoplay state: isAutoPlaying=${this.isAutoPlaying}, isSpinning=${this.scene.gameData.isSpinning}`);
            
            if (this.isAutoPlaying && this.scene && !this.scene.gameData.isSpinning) {
                // Clear any existing interval
                if (this.spinInterval) {
                    clearTimeout(this.spinInterval);
                }
                
                scene.gameData.debugLog("Scheduling next autoplay spin");
                // Add a small delay before next spin to ensure state is stable
                this.spinInterval = setTimeout(() => {
                    this.spin();
                }, 100); // Increased delay for stability
            } else {
                scene.gameData.debugLog("Autoplay spin skipped - conditions not met");
            }
        };
        
        Events.emitter.on(Events.AUTOPLAY_START, (numSpins: number) => {
            this.start(scene, numSpins);
        });     
        Events.emitter.on(Events.AUTOPLAY_STOP, () => {
            this.stop();
        });
    }

    destroy(): void {
        // Clean up event listeners properly
        Events.emitter.off(Events.AUTOPLAY_START, this.start);
        Events.emitter.off(Events.AUTOPLAY_STOP, this.stop);
        if (this.matchesDoneListener) {
            Events.emitter.off(Events.MATCHES_DONE, this.matchesDoneListener);
        }
    }

    addSpins(numSpins: number): void {
        this.remainingSpins += numSpins;
        this.updateRemainingSpinsDisplay();
    }

    start(scene: GameScene, numSpins: number): void {
        // Don't start autoplay if already spinning
        if (scene.gameData.isSpinning) {
            scene.gameData.debugLog("Cannot start autoplay: already spinning");
            return;
        }
        
        this.isAutoPlaying = true;
        this.remainingSpins = numSpins;
        this.scene = scene;
        
        // Create remaining spins display
        this.createRemainingSpinsDisplay(scene);
        
        // Add our specific listener for matches done
        Events.emitter.on(Events.MATCHES_DONE, this.matchesDoneListener);
        
        // Start first spin with a small delay to ensure state is ready
        scene.gameData.debugLog("Starting autoplay - scheduling first spin");
        this.spinInterval = setTimeout(() => {
            scene.gameData.debugLog("Executing first autoplay spin");
            this.spin();
        }, 50);

        // Start polling interval to ensure recovery
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.isAutoPlaying && this.scene && !this.scene.gameData.isSpinning && !this.spinScheduled) {
                this.scene.gameData.debugLog("[Autoplay Poll] Detected ready state, spinning...");
                this.spinScheduled = true;
                this.spin();
            }
        }, 500);
    }

    private createRemainingSpinsDisplay(scene: GameScene): void {
        // Remove existing text and background if they exist
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
        }

        // Position it near the autoplay button
        const x = this.isMobile ? scene.buttons.freeSpinBtn.x : scene.scale.width * 0.88;
        const y = this.isMobile ? scene.buttons.freeSpinBtn.y : scene.scale.height * 0.443;


        // Create text for remaining spins
        this.remainingSpinsText = scene.add.text(x, y, 'Spins Left', {
            fontSize: '28px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        this.remainingSpinsText.setOrigin(0.5, 0.5);
        this.remainingSpinsText.setDepth(1000);
        this.remainingSpinsText.setScale(this.isMobile ? 0.5 : 1);
        this.spinsText_Y = this.remainingSpinsText.y;

        // Update button visibility
        if (scene.gameData.freeSpins > 0) {
            scene.buttons.freeSpinBtn.visible = true;
            scene.buttons.autoplayIndicator.visible = false;
        } else {
            scene.buttons.freeSpinBtn.visible = false;
            scene.buttons.autoplayIndicator.visible = true;
        }

        // Update the display
        this.updateRemainingSpinsDisplay();
    }

    public updateRemainingSpinsDisplay(): void {
        if (!this.scene || !this.remainingSpinsText) return;

        this.scene.buttons.freeSpinBtn.visible = true;
        
        // Determine which count to display
        const displayCount = this.scene.gameData.isBonusRound ? 
            this.scene.gameData.freeSpins : this.remainingSpins;

        // Update text position based on number of digits
        if (displayCount.toString().length === 3) {
            this.remainingSpinsText.setFontSize('50px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 20);
        } else if (displayCount.toString().length === 2) {
            this.remainingSpinsText.setFontSize('80px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 15);
        } else {
            this.remainingSpinsText.setFontSize('110px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 10);
        }

        // Update the text
        this.remainingSpinsText.setText(displayCount.toString());
    }

    stop(): void {
        if (this.spinInterval) {
            clearTimeout(this.spinInterval);
            this.spinInterval = 0;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.spinScheduled = false;
        this.scene.buttons.resetAutoplayButtons();
        this.isAutoPlaying = false;
        this.remainingSpins = 0;
        
        // Remove only our specific listener
        if (this.matchesDoneListener) {
            Events.emitter.off(Events.MATCHES_DONE, this.matchesDoneListener);
        }
        
        // Remove both text and background
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
            this.remainingSpinsText = undefined;
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
            this.remainingSpinsBg = undefined;
        }
        
        // Update button states after stopping autoplay
        if (this.scene && this.scene.buttons) {
            this.scene.buttons.updateButtonStates(this.scene);
        }
    }

    private spin(): void {
        this.spinScheduled = false;
        this.scene.gameData.debugLog("=== AUTOPLAY SPIN ATTEMPT ===");
        this.scene.gameData.debugLog(`autoplay: ${this.isAutoPlaying}, bonus: ${this.scene.gameData.isBonusRound}, spins: ${this.remainingSpins}, free: ${this.scene.gameData.freeSpins}, isSpinning: ${this.scene.gameData.isSpinning}`);

        // Check if we should stop autoplay
        if (!this.isAutoPlaying || 
            (!this.scene.gameData.isBonusRound && this.remainingSpins <= 0) ||
            (this.scene.gameData.isBonusRound && this.scene.gameData.freeSpins <= 0)) {
            this.stop();
            this.scene.gameData.debugLog("Autoplay stopped - no more spins"); 
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        // Don't spin if already spinning or if there's an active win overlay
        if (this.scene.gameData.isSpinning || this.scene.slotMachine.activeWinOverlay) {
            this.scene.gameData.debugLog("Skipping autoplay spin - game busy");
            // Retry after a short delay
            this.spinInterval = setTimeout(() => {
                this.spin();
            }, 500);
            return;
        }

        // For free spins, don't check balance
        if (!this.scene.gameData.isBonusRound) {
            this.scene.gameData.debugLog("Regular autoplay spin");
            // Check if player has enough balance for the bet
            if (this.scene.gameData.balance < this.scene.gameData.bet) {
                this.stop();
                this.scene.gameData.debugLog("Autoplay stopped - insufficient balance");
                Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
                return;
            }
            // Decrement remaining spins for regular play
            this.remainingSpins--;
        } else {
            this.scene.gameData.debugLog("Free spin autoplay");
        }

        // Reset total win for new spin
        this.scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});

        // Ensure we have valid slot data
        if (!this.scene.gameData.slot?.values?.length) {
            this.scene.gameData.debugError('Invalid slot data in autoplay spin');
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        this.scene.gameData.debugLog("Triggering autoplay spin via Events.SPIN");

        // Trigger spin
        Events.emitter.emit(Events.SPIN, {
            currentRow: this.scene.gameData.currentRow,
            symbols: this.scene.gameData.slot.values
        });
        
        this.scene.gameData.debugLog("Events.SPIN emitted successfully");

        // Update remaining spins display
        this.updateRemainingSpinsDisplay();
    }

    update(_scene: GameScene, _time: number, _delta: number): void {
        // Empty implementation - can be used for future animations or updates
    }
} 