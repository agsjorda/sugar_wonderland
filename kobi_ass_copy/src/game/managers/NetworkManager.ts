export class NetworkManager {
    private isHighSpeed: boolean;

    constructor() {
        this.isHighSpeed = this.detectNetworkSpeed();
    }

    private detectNetworkSpeed(): boolean {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (!connection) return true; // Default to high speed if API unavailable
        return connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g';
    }

    public getNetworkSpeed(): boolean {
        return this.isHighSpeed;
    }
}