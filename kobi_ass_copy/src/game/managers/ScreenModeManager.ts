export interface ScreenConfig {
    isPortrait: boolean;
}

export class ScreenModeManager {
    private isPortrait: boolean;
    private forcedMode: 'portrait' | 'landscape' | null;

    constructor() {
        this.isPortrait = this.detectOrientation();
        this.forcedMode = null;
    }

    private detectOrientation(): boolean {
        return window.innerHeight > window.innerWidth;
    }

    public forceOrientation(mode: 'portrait' | 'landscape'): void {
        this.forcedMode = mode;
        this.isPortrait = mode === 'portrait';
    }

    public getScreenConfig(): ScreenConfig {
        return { isPortrait: this.isPortrait };
    }
}