import { SpinData } from "../backend/SpinData";
import { normalizeArea, normalizeMoney, normalizeSpinResponse } from "../backend/GameAPI";

// FAKE API CONFIGURATION - EASILY TOGGLEABLE
const USE_FAKE_API_FOR_BONUS = true; // Set to false to disable fake API
const FAKE_RESPONSE_PATH = '/fake-response.json';

// Cache for fake response data
let fakeResponseCache: any = null;

/**
 * Fake Bonus API - Easily removable wrapper for bonus scene free spins
 * This can be disabled by setting USE_FAKE_API_FOR_BONUS = false
 */
export class FakeBonusAPI {
    private static instance: FakeBonusAPI;
    private fakeSpinData: SpinData | null = null;
    private currentFreeSpinIndex: number = 0;

    private constructor() {}

    public static getInstance(): FakeBonusAPI {
        if (!FakeBonusAPI.instance) {
            FakeBonusAPI.instance = new FakeBonusAPI();
        }
        return FakeBonusAPI.instance;
    }

    /**
     * Check if fake API is enabled
     */
    public isEnabled(): boolean {
        return USE_FAKE_API_FOR_BONUS;
    }

    /**
     * Load fake response data from JSON file
     */
    private async loadFakeResponse(): Promise<any> {
        if (fakeResponseCache) {
            return fakeResponseCache;
        }

        try {
            const response = await fetch(FAKE_RESPONSE_PATH);
            if (!response.ok) {
                throw new Error(`Failed to load fake response: ${response.status}`);
            }
            fakeResponseCache = await response.json();
            console.log('Fake response data loaded successfully');
            return fakeResponseCache;
        } catch (error) {
            console.error('Error loading fake response:', error);
            throw error;
        }
    }

    /**
     * Initialize fake API with bonus data
     */
    public async initializeBonusData(): Promise<void> {
        if (!this.isEnabled()) {
            console.log('Fake API is disabled, skipping initialization');
            return;
        }

        try {
            const fakeData = await this.loadFakeResponse();
            
            // Convert fake response to SpinData format
            const bet = Number(fakeData.bet) || 1;
            this.fakeSpinData = normalizeSpinResponse(fakeData, bet);
            
            this.currentFreeSpinIndex = 0;
            
            console.log('Fake bonus API initialized with free spins:', {
                totalSpins: this.fakeSpinData?.slot?.freespin?.count,
                totalWin: this.fakeSpinData?.slot?.freespin?.totalWin,
                itemsCount: this.fakeSpinData?.slot?.freespin?.items?.length
            });
        } catch (error) {
            console.error('Failed to initialize fake bonus API:', error);
            throw error;
        }
    }

    /**
     * Simulate a free spin using fake data
     */
    public async simulateFreeSpin(): Promise<SpinData> {
        if (!this.isEnabled()) {
            throw new Error('Fake API is disabled');
        }

        if (!this.fakeSpinData || !this.fakeSpinData.slot?.freespin?.items) {
            throw new Error('No fake spin data available. Call initializeBonusData() first.');
        }

        const freespinData = this.fakeSpinData.slot.freespin;
        const items = freespinData.items;

        if (this.currentFreeSpinIndex >= items.length) {
            console.log('All fake free spins completed');
            throw new Error('No more free spins available');
        }

        const currentItem = items[this.currentFreeSpinIndex];

        console.log(' ===== FAKE FREE SPIN SIMULATION =====');
        console.log(' Using fake data from:', FAKE_RESPONSE_PATH);
        console.log(' Current free spin index:', this.currentFreeSpinIndex);
        console.log(' Spins left:', currentItem.spinsLeft);
        console.log(' Sub total win:', currentItem.subTotalWin);
        console.log(' Area:', currentItem.area);
        console.log(' Paylines:', currentItem.payline);
        console.log(' Collector count:', currentItem.collectorCount);
        console.log(' Money:', currentItem.money);

        const normalizedArea = normalizeArea(currentItem.area);
        const normalizedMoney = normalizeMoney(currentItem.money);

        const freeSpinData: SpinData = {
            playerId: this.fakeSpinData.playerId,
            bet: this.fakeSpinData.bet,
            baseBet: this.fakeSpinData.baseBet,
            slot: {
                area: normalizedArea,
                paylines: Array.isArray(currentItem.payline) ? currentItem.payline : [],
                money: normalizedMoney,
                freespin: {
                    count: currentItem.spinsLeft,
                    totalWin: currentItem.subTotalWin,
                    items: items.slice(this.currentFreeSpinIndex)
                },
                freeSpin: {
                    count: currentItem.spinsLeft,
                    totalWin: currentItem.subTotalWin,
                    items: items.slice(this.currentFreeSpinIndex)
                }
            }
        };

        this.currentFreeSpinIndex++;

        console.log(' ===== FAKE FREE SPIN COMPLETE =====');
        console.log(' Remaining fake free spins:', currentItem.spinsLeft - 1);
        console.log(' Next fake spin will use index:', this.currentFreeSpinIndex);

        return freeSpinData;
    }

    /**
     * Get current fake spin data
     */
    public getCurrentSpinData(): SpinData | null {
        return this.fakeSpinData;
    }

    /**
     * Reset fake spin index
     */
    public resetFreeSpinIndex(): void {
        console.log('Resetting fake free spin index to 0');
        this.currentFreeSpinIndex = 0;
    }

    /**
     * Check if there are more fake free spins available
     */
    public hasMoreFreeSpins(): boolean {
        if (!this.fakeSpinData || !this.fakeSpinData.slot?.freespin?.items) {
            return false;
        }
        return this.currentFreeSpinIndex < this.fakeSpinData.slot.freespin.items.length;
    }

    /**
     * Get remaining fake free spins count
     */
    public getRemainingFreeSpins(): number {
        if (!this.fakeSpinData || !this.fakeSpinData.slot?.freespin?.items) {
            return 0;
        }
        return Math.max(0, this.fakeSpinData.slot.freespin.items.length - this.currentFreeSpinIndex);
    }

    /**
     * Clear fake data cache and reset
     */
    public clearCache(): void {
        fakeResponseCache = null;
        this.fakeSpinData = null;
        this.currentFreeSpinIndex = 0;
        console.log('Fake API cache cleared');
    }
}

// Export singleton instance for easy access
export const fakeBonusAPI = FakeBonusAPI.getInstance();
