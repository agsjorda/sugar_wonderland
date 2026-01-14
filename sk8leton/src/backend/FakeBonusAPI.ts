import { SpinData } from "../backend/SpinData";
import { normalizeArea, normalizeMoney, normalizeSpinResponse } from "../backend/GameAPI";

// FAKE API CONFIGURATION - EASILY TOGGLEABLE
const USE_FAKE_API_FOR_BONUS = false; // Set to false to disable fake API
const FAKE_RESPONSE_PATH = (() => {
    try {
        const baseUrl = (import.meta as any)?.env?.BASE_URL;
        if (typeof baseUrl === 'string' && baseUrl.length > 0) {
            const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            return `${normalizedBase}fake-response.json`;
        }
    } catch {}
    return '/fake-response.json';
})();

// Cache for fake response data
let fakeResponseCache: any = null;

/**
 * Fake Bonus API - Easily removable wrapper for bonus scene free spins
 * This can be disabled by setting USE_FAKE_API_FOR_BONUS = false
 */
export class FakeBonusAPI {
    private static instance: FakeBonusAPI;
    private fakeSpinData: SpinData | null = null;
    private baseSpinData: SpinData | null = null;
    private baseSpinConsumed: boolean = false;
    private currentFreeSpinIndex: number = 0;
    private forcedDisabled: boolean = false;
    private lastLoadError: any = null;

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
        return USE_FAKE_API_FOR_BONUS && !this.forcedDisabled;
    }

    private disableDueToLoadError(error: any): void {
        try {
            this.forcedDisabled = true;
            this.lastLoadError = error;
            console.warn('[FakeBonusAPI] Disabling fake bonus API due to load error. Falling back to backend responses.', error);
        } catch {}
    }

    /**
     * Load fake response data from JSON file
     */
    private async loadFakeResponse(): Promise<any | null> {
        if (fakeResponseCache) {
            return fakeResponseCache;
        }

        if (!this.isEnabled()) {
            return null;
        }

        try {
            const response = await fetch(FAKE_RESPONSE_PATH);
            if (!response.ok) {
                const err = new Error(`Failed to load fake response: ${response.status}`);
                this.disableDueToLoadError(err);
                return null;
            }
            fakeResponseCache = await response.json();
            console.log('Fake response data loaded successfully');
            return fakeResponseCache;
        } catch (error) {
            this.disableDueToLoadError(error);
            return null;
        }
    }

    /**
     * Initialize fake API with bonus data
     */
    public async initializeBonusData(betOverride?: number): Promise<void> {
        if (!this.isEnabled()) {
            console.log('Fake API is disabled, skipping initialization');
            return;
        }

        try {
            const fakeData = await this.loadFakeResponse();
            if (!fakeData) {
                return;
            }

            const bonusRaw = this.getBonusSpinRaw(fakeData);

            // Convert fake response to SpinData format
            const bet = (Number(betOverride) || Number((bonusRaw as any)?.bet) || 1);
            this.fakeSpinData = normalizeSpinResponse(bonusRaw, bet);

            this.currentFreeSpinIndex = 0;

            console.log('Fake bonus API initialized with free spins:', {
                totalSpins: this.fakeSpinData?.slot?.freespin?.count,
                totalWin: this.fakeSpinData?.slot?.freespin?.totalWin,
                itemsCount: this.fakeSpinData?.slot?.freespin?.items?.length
            });
        } catch (error) {
            this.disableDueToLoadError(error);
        }
    }

    private getBonusSpinRaw(fakeData: any): any {
        try {
            const candidate = (fakeData as any)?.bonusSpin
                || (fakeData as any)?.bonus
                || (fakeData as any)?.bonusScene
                || (fakeData as any)?.bonusResponse;
            if (candidate && typeof candidate === 'object') {
                return candidate;
            }
        } catch {}
        return fakeData;
    }

    private getBaseSpinRaw(fakeData: any): any {
        try {
            const candidate = (fakeData as any)?.baseSpin
                || (fakeData as any)?.base
                || (fakeData as any)?.baseScene
                || (fakeData as any)?.baseResponse
                || (fakeData as any)?.normalSpin;
            if (candidate && typeof candidate === 'object') {
                return candidate;
            }
        } catch {}
        try {
            const useRoot = !!((fakeData as any)?.useRootAsBaseSpin || (fakeData as any)?.useRootForBaseSpin);
            if (useRoot) {
                return fakeData;
            }
        } catch {}
        return null;
    }

    public async simulateBaseSpin(bet: number): Promise<SpinData | null> {
        if (!this.isEnabled()) {
            return null;
        }

        try {
            if (this.baseSpinConsumed) {
                return null;
            }

            const fakeData = await this.loadFakeResponse();
            if (!fakeData) {
                return null;
            }

            let baseRaw: any = this.getBaseSpinRaw(fakeData);
            if (!baseRaw) {
                const bonusRaw: any = this.getBonusSpinRaw(fakeData);
                const slot: any = (bonusRaw as any)?.slot;
                const fs: any = slot?.freespin || slot?.freeSpin;
                const hasItems = Array.isArray(fs?.items) && fs.items.length > 0;
                const hasCount = Number(fs?.count) > 0;
                if (slot && (hasItems || hasCount)) {
                    const count = Number(fs?.count) || 0;
                    baseRaw = {
                        ...(bonusRaw && typeof bonusRaw === 'object' ? bonusRaw : {}),
                        slot: {
                            ...(slot && typeof slot === 'object' ? slot : {}),
                            totalWin: 0,
                            paylines: [],
                            freespin: {
                                count,
                                totalWin: 0,
                                items: []
                            },
                            freeSpin: {
                                count,
                                win: 0,
                                items: []
                            }
                        }
                    };
                }
            }
            if (!baseRaw) {
                return null;
            }
            const betNum = Number(bet);
            const normalizedBet = (isFinite(betNum) && betNum > 0) ? betNum : (Number((baseRaw as any)?.bet) || 1);
            const rawObj: any = (baseRaw && typeof baseRaw === 'object') ? baseRaw : {};

            const normalized = normalizeSpinResponse({
                ...rawObj,
                bet: String(normalizedBet)
            }, normalizedBet);

            try {
                const fs: any = (normalized as any)?.slot?.freespin || (normalized as any)?.slot?.freeSpin;
                const hasItems = Array.isArray(fs?.items) && fs.items.length > 0;
                const hasCount = Number(fs?.count) > 0;
                if (!hasItems && !hasCount) {
                    return null;
                }
            } catch {
                return null;
            }

            this.baseSpinData = normalized;
            this.baseSpinConsumed = true;

            try {
                await this.initializeBonusData(normalizedBet);
            } catch {}

            return normalized;
        } catch (error) {
            this.disableDueToLoadError(error);
            return null;
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

        let slotSpecial: any = undefined;
        try {
            if ((currentItem as any)?.special && (currentItem as any).special.action) {
                slotSpecial = {
                    action: String((currentItem as any).special.action),
                    position: (currentItem as any).special.position,
                    items: normalizeMoney((currentItem as any).special.items) || (currentItem as any).special.items
                };
            }
        } catch {}

        let cumulativeTotal = 0;
        try {
            const rw = Number((currentItem as any)?.runningWin);
            if (isFinite(rw) && rw >= 0) {
                cumulativeTotal = rw;
            }
        } catch {}
        if (!(cumulativeTotal >= 0)) {
            cumulativeTotal = 0;
        }
        if (cumulativeTotal === 0) {
            try {
                const prevItem: any = this.currentFreeSpinIndex > 0 ? items[this.currentFreeSpinIndex - 1] : null;
                const prevRw = Number(prevItem?.runningWin);
                const prevBase = (isFinite(prevRw) && prevRw >= 0) ? prevRw : 0;
                cumulativeTotal = prevBase + (Number(currentItem?.subTotalWin) || 0);
            } catch {}
        }

        let preAwardTotal = cumulativeTotal;
        try {
            const st = Number((currentItem as any)?.subTotalWin);
            if (isFinite(st) && st > 0) {
                preAwardTotal = Math.max(0, cumulativeTotal - st);
            }
        } catch {}

        const freeSpinData: SpinData = {
            playerId: this.fakeSpinData.playerId,
            bet: this.fakeSpinData.bet,
            baseBet: this.fakeSpinData.baseBet,
            slot: {
                area: normalizedArea,
                paylines: Array.isArray(currentItem.payline) ? currentItem.payline : [],
                money: normalizedMoney,
                special: slotSpecial,
                totalWin: preAwardTotal,
                freespin: {
                    count: currentItem.spinsLeft,
                    totalWin: preAwardTotal,
                    items: items.slice(this.currentFreeSpinIndex)
                },
                freeSpin: {
                    count: currentItem.spinsLeft,
                    totalWin: preAwardTotal,
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
        this.baseSpinData = null;
        this.baseSpinConsumed = false;
        this.currentFreeSpinIndex = 0;
        this.forcedDisabled = false;
        this.lastLoadError = null;
        console.log('Fake API cache cleared');
    }
}

// Export singleton instance for easy access
export const fakeBonusAPI = FakeBonusAPI.getInstance();
