import { Scene, GameObjects, Geom } from 'phaser';
import { AudioManager } from './AudioManager';
import { GameData } from './GameData';

interface GameScene extends Scene {
    audioManager: AudioManager;
    gameData: GameData;
}

type ButtonContainer = GameObjects.Container & { isButton?: boolean };
type ButtonImage = GameObjects.Image & { isButton?: boolean };
type ButtonText = GameObjects.Text & { isButton?: boolean };

export class SystemSettingsPopup {
    private container: GameObjects.Container | null = null;

    preload(scene: GameScene): void {
        // Only the close icon is needed; background is drawn with graphics
        scene.load.image('settings_close', 'assets/Buttons/ekis.png');
    }

    create(scene: GameScene): void {
        if (this.container) {
            this.container.destroy(true);
            this.container = null;
        }

        const width = 573;
        const height = 260;
        const margin = 16;
        const scale = 0.66;
        const tabIndent = 16; // base tab size
        const leftIndent = tabIndent * 2; // double left indentation
        const topIndent = tabIndent * 2;  // title at two indentations
        const x = margin + leftIndent; // Bottom-left with increased left indent
        const y = scene.scale.height - height * scale - (margin * 2 + topIndent); // increased top indent from bottom anchor

        const container = scene.add.container(x, y) as ButtonContainer;
        container.setDepth(1200);
        container.setVisible(false);
        container.setScale(scale);
        this.container = container;

        // Panel background: black graphics rectangle
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 1);
        bg.fillRoundedRect(0, 0, width, height, 12);
        // 1px green stroke around the panel
        bg.lineStyle(2, 0x66D449, 1);
        bg.strokeRoundedRect(0, 0, width, height, 12);
        container.add(bg);

        // Title
        const titleLeftX = 20 + leftIndent;
        const titleTopY = 28 + topIndent;
        const title = scene.add.text(titleLeftX, titleTopY, 'SYSTEM SETTINGS', {
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            color: '#379557',
            fontSize: '32px'
        }) as ButtonText;
        title.setOrigin(0, 0.5);
        container.add(title);
        // Apply linear gradient fill
        const gradient = title.context.createLinearGradient(0,0,0,title.height);
        gradient.addColorStop(0, '#66D449');
        gradient.addColorStop(0.75, '#379557');
        title.setFill(gradient);

        // Close button (top-right)
        const close = scene.add.image(width - (tabIndent * 3), titleTopY - 2, 'settings_close') as ButtonImage;
        close.setOrigin(0.5, 0.5);
        close.setScale(0.45);
        container.add(close);
        close.setInteractive().isButton = true;
        close.on('pointerdown', () => this.hide(scene));

        // Row builder
        const buildRow = (label: string, top: number, getVolume: () => number, setVolume: (v: number) => void) => {
            const iconX = titleLeftX; // align icon left edge with title
            const volIcon = scene.add.image(iconX, top, 'volume') as ButtonImage;
            volIcon.setOrigin(0, 0.5); // left-align
            volIcon.setScale(0.5);
            container.add(volIcon);

            const labelX = iconX + volIcon.displayWidth + 12;
            const labelText = scene.add.text(labelX, top, label, {
                fontFamily: 'Poppins',
                color: '#FFFFFF',
                fontSize: '25px'
            }) as ButtonText;
            labelText.setOrigin(0, 0.5);
            container.add(labelText);

            const valueX = labelX + 100;
            const valueText = scene.add.text(valueX, top, `${Math.round(getVolume() * 100)}%`, {
                fontFamily: 'Poppins',
                color: '#FFFFFF',
                fontSize: '25px'
            }) as ButtonText;
            valueText.setOrigin(0, 0.5);
            container.add(valueText);

            // Slider visuals
            const sliderX = valueX + 70;
            const sliderY = top;
            const sliderW = 225; // ~75% of original width (from 300)

            const fill = scene.add.graphics();
            container.add(fill);
            const knob = scene.add.graphics();
            container.add(knob);

            const draw = () => {
                const v = getVolume();
                fill.clear();
                // dark track
                fill.fillStyle(0x2B2B2B, 1);
                fill.fillRoundedRect(sliderX, sliderY - 6, sliderW, 12, 6);
                // green fill
                fill.fillStyle(0x379557, 1);
                fill.fillRoundedRect(sliderX, sliderY - 6, sliderW * v, 12, 6);

                knob.clear();
                knob.fillStyle(0xFFFFFF, 1);
                knob.fillCircle(sliderX + sliderW * v, sliderY, 10);
                valueText.setText(`${Math.round(v * 100)}%`);
                // Dim icon when muted
                volIcon.setTint(v === 0 ? 0x9CA3AF : 0xFFFFFF);
            };

            draw();

            const trackZone = scene.add.zone(sliderX, sliderY - 12, sliderW, 24).setOrigin(0, 0) as any;
            trackZone.setInteractive();
            container.add(trackZone);

            let dragging = false;
            const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
            trackZone.on('pointerdown', (p: Phaser.Input.Pointer, lx: number) => {
                dragging = true;
                const v = clamp(lx / sliderW, 0, 1);
                setVolume(v);
                draw();
            });
            scene.input.on('pointerup', () => dragging = false);
            scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
                if (!dragging) return;
                const local = (trackZone as any).getLocalPoint(p.x, p.y);
                const v = clamp(local.x / sliderW, 0, 1);
                setVolume(v);
                draw();
            });

            // Click on icon to mute/unmute (toggle between 0 and 1)
            volIcon.setInteractive({ useHandCursor: true }).isButton = true;
            volIcon.on('pointerdown', () => {
                const cur = getVolume();
                const next = cur === 0 ? 1 : 0;
                setVolume(next);
                draw();
            });
        };

        buildRow('Music', 110, () => scene.audioManager.getMusicVolume(), (v) => scene.audioManager.setMusicVolume(v));
        buildRow('SFX', 170, () => scene.audioManager.getSFXVolume(), (v) => scene.audioManager.setSFXVolume(v));
    }

    show(scene: GameScene): void {
        if (!this.container) return;
        this.container.setVisible(true);
        this.container.alpha = 0;
        scene.tweens.add({ targets: this.container, alpha: 1, duration: 150, ease: 'Power2' });
    }

    hide(scene: GameScene): void {
        if (!this.container) return;
        scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 120,
            ease: 'Power2',
            onComplete: () => {
                this.container!.setVisible(false);
            }
        });
    }
}


