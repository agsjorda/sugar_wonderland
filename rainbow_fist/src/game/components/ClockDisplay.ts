import { Scene } from 'phaser';
import { getMilitaryTime } from '../../utils/TimeUtils';

export interface ClockDisplayOptions {
    paddingPercentageX?: number;
    paddingPercentageY?: number;
    fontSize?: number;
    color?: string;
    alpha?: number;
    depth?: number;
    scale?: number; // Scale modifier for the timer text
    gameTitle?: string; // Optional text to display after the time (e.g., " | Hustle The Blazing Horse")
    additionalText?: string; // Optional additional text (e.g., "DiJoker")
}

export class ClockDisplay {
    private scene: Scene;
    private timeText?: Phaser.GameObjects.Text;
    private additionalText?: Phaser.GameObjects.Text;
    private timeUpdateTimer?: Phaser.Time.TimerEvent;
    private options: ClockDisplayOptions;
    private suffixText: string;

    private defaultClockDisplayOptions: ClockDisplayOptions = {
        paddingPercentageX: 0.01,
        paddingPercentageY: 0.01,
        fontSize: 32,
        color: '#FFFFFF',
        alpha: 0.5,
        depth: 30000,
        scale: 0.4,
        gameTitle: 'Game Title',
        additionalText: 'DiJoker'
    };

    constructor(scene: Scene, options?: ClockDisplayOptions) {
        this.scene = scene;
        this.options = {
            paddingPercentageX: options?.paddingPercentageX || this.defaultClockDisplayOptions.paddingPercentageX,
            paddingPercentageY: options?.paddingPercentageY || this.defaultClockDisplayOptions.paddingPercentageY,
            fontSize: options?.fontSize || this.defaultClockDisplayOptions.fontSize,
            color: options?.color || this.defaultClockDisplayOptions.color,
            alpha: options?.alpha || this.defaultClockDisplayOptions.alpha,
            depth: options?.depth || this.defaultClockDisplayOptions.depth,
            scale: options?.scale || this.defaultClockDisplayOptions.scale,
            gameTitle: options?.gameTitle || this.defaultClockDisplayOptions.gameTitle,
            additionalText: options?.additionalText || this.defaultClockDisplayOptions.additionalText
        };
    }

    public create(): void {
        const timeX = this.scene.scale.width * (this.options.paddingPercentageX || 0.02); // 2% from left
        const timeY = this.scene.scale.height * (this.options.paddingPercentageY || 0.02); // 2% from top
        const fontSize = this.options.fontSize || 14;
        const textColor = this.options.color || '#FFFFFF';
        const alpha = this.options.alpha !== undefined ? this.options.alpha : 0.50;
        const depth = this.options.depth || 30000;
        const scale = this.options.scale !== undefined ? this.options.scale : 1.0;
        this.suffixText = this.options.gameTitle || '';

        // Create time text with specified styles
        const initialTime = getMilitaryTime();
        const displayText = this.suffixText ? `${initialTime} | ${this.suffixText}` : initialTime;
        const timeText = this.scene.add.text(
            timeX,
            timeY,
            displayText,
            {
                fontFamily: 'Arial',
                fontSize: `${fontSize}px`,
                color: textColor,
                fontStyle: 'normal',
                align: 'center'
            }
        ).setOrigin(0, 0.5)
         .setScrollFactor(0)
         .setAlpha(alpha)
         .setDepth(depth)
         .setScale(scale);

        // Set font weight 500 by overriding the canvas context font
        try {
            const textObj = timeText as any;
            const originalUpdateText = textObj.updateText?.bind(textObj);
            if (originalUpdateText) {
                textObj.updateText = function(this: any) {
                    originalUpdateText();
                    if (this.context) {
                        this.context.font = `500 ${fontSize}px Arial`;
                    }
                }.bind(textObj);
                textObj.updateText();
            }
        } catch (e) {
            console.warn('[ClockDisplay] Could not set font weight 500, using default. Error:', e);
        }

        this.timeText = timeText;
        console.log(`[ClockDisplay] Clock created at (${timeX}, ${timeY}) with font size ${fontSize}px`);

        // Create additional text if provided
        if (this.options.additionalText) {
            const additionalX = this.scene.scale.width * (1 - (this.options.paddingPercentageX || 0.02));
            const additionalY = this.scene.scale.height * (this.options.paddingPercentageY || 0.02);

            const additionalTextObj = this.scene.add.text(
                additionalX,
                additionalY,
                this.options.additionalText,
                {
                    fontFamily: 'Arial',
                    fontSize: `${fontSize}px`,
                    color: textColor,
                    fontStyle: 'normal',
                    align: 'center'
                }
            ).setOrigin(1, 0.5)
             .setScrollFactor(0)
             .setAlpha(alpha)
             .setDepth(depth)
             .setScale(scale);

            // Set font weight 500 for additional text
            try {
                const textObj = additionalTextObj as any;
                const originalUpdateText = textObj.updateText?.bind(textObj);
                if (originalUpdateText) {
                    textObj.updateText = function(this: any) {
                        originalUpdateText();
                        if (this.context) {
                            this.context.font = `500 ${fontSize}px Arial`;
                        }
                    }.bind(textObj);
                    textObj.updateText();
                }
            } catch (e) {
                console.warn('[ClockDisplay] Could not set font weight 500 for additional text, using default. Error:', e);
            }

            this.additionalText = additionalTextObj;
        }

        this.startTimeUpdateTimer();
    }

    private startTimeUpdateTimer(): void {
        // Update time every second
        this.timeUpdateTimer = this.scene.time.addEvent({
            delay: 900, // Update every second
            callback: () => {
                if (this.timeText) {
                    const currentTime = getMilitaryTime();
                    const displayText = this.suffixText ? `${currentTime} | ${this.suffixText}` : currentTime;
                    this.timeText.setText(displayText);
                }
            },
            loop: true
        });
    }

    public destroy(): void {
        // Stop time update timer
        try {
            if (this.timeUpdateTimer) {
                this.timeUpdateTimer.destroy();
                this.timeUpdateTimer = undefined;
            }
        } catch {}

        // Destroy text
        try {
            if (this.timeText) {
                this.timeText.destroy();
                this.timeText = undefined;
            }
        } catch {}
    }
}

