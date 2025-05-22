import { Events } from "./Events";

export class Autoplay {
    constructor() {
        this.isAutoPlaying = false;
        this.remainingSpins = 0;
        this.scene = null;
        this.spinInterval = null;
        this.remainingSpinsText = null;
        this.remainingSpinsBg = null; // Add tracking for background
    }

    preload(scene) {
        this.scene = scene;
    }

    create(scene) {
        this.scene = scene;
    }

    start(scene, numSpins) {
        if (this.isAutoPlaying) return;
        
        this.isAutoPlaying = true;
        this.remainingSpins = numSpins;
        this.scene = scene;
        
        // Create remaining spins display
        this.createRemainingSpinsDisplay();
        
        // Start the first spin immediately
        this.spin();

        // Listen for matches completion
        Events.emitter.on(Events.MATCHES_DONE, () => {
            if (this.isAutoPlaying && !this.scene.gameData.isSpinning) {
                // Add a small delay before next spin
                this.spinInterval = setTimeout(() => {
                    this.spin();
                }, 1000);
            }
        });
    }

    createRemainingSpinsDisplay() {
        // Remove existing text and background if they exist
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
        }

        // Position it near the autoplay button
        const x = this.scene.scale.width * 0.85; // Same x as autoplay button
        const y = this.scene.scale.height * 0.65; // Slightly below autoplay button

        // Create background for better visibility
        this.remainingSpinsBg = this.scene.add.graphics();
        this.remainingSpinsBg.fillStyle(0x000000, 0.5);
        this.remainingSpinsBg.fillRoundedRect(x - 100, y + 100, 200, 40, 20);
        
        // Create text
        const displayText = this.scene.gameData.freeSpins ? 
            `${this.remainingSpins} spins left` : 
            `${this.remainingSpins} spins left`;
            
        this.remainingSpinsText = this.scene.add.text(x, y + 120, displayText, {
            fontSize: '24px',
            fill: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        this.remainingSpinsText.setOrigin(0.5, 0.5);
        this.remainingSpinsText.setDepth(1000);
        this.remainingSpinsBg.setDepth(999); // Set background just below text

        // Add to scene's button container if it exists
        if (this.scene.buttons && this.scene.buttons.buttonContainer) {
            this.scene.buttons.buttonContainer.add(this.remainingSpinsBg);
            this.scene.buttons.buttonContainer.add(this.remainingSpinsText);
        }
    }

    updateRemainingSpinsDisplay() {
        if (this.remainingSpinsText) {
            const displayText = this.scene.gameData.freeSpins ? 
                `${this.remainingSpins} spins left` : 
                `${this.remainingSpins} spins left`;
            this.remainingSpinsText.setText(displayText);

        }
    }

    stop() {
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

    spin() {
        if (!this.isAutoPlaying || this.remainingSpins <= 0) {
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        if (this.scene.gameData.isSpinning) {
            return;
        }

        // Check if audio manager's music is paused
        if (this.scene.audioManager && this.scene.audioManager.MainBG && this.scene.audioManager.MainBG.isPaused) {
            // Wait and check again in a short interval
            setTimeout(() => this.spin(), 500);
            return;
        }

        // If music has resumed, destroy any active win overlay
        if (this.scene.slotMachine && this.scene.slotMachine.activeWinOverlay) {
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

        // Trigger spin
        Events.emitter.emit(Events.SPIN, {
            currentRow: this.scene.gameData.currentRow,
            symbols: this.scene.gameData.slot.values
        });

        // Only deduct bet and balance for non-free spins
        if (!this.scene.gameData.freeSpins) {
            this.scene.gameData.balance -= this.scene.gameData.bet;
        }

        // reset total win to 0
        this.scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});
        
        this.remainingSpins--;
        
        // Update the display
        this.updateRemainingSpinsDisplay();
    }

    update(scene, time, delta) {
    }

} 