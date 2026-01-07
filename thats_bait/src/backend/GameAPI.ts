import { SpinData } from "./SpinData";
import { GameData } from "../game/components/GameData";
import { gameStateManager } from "../managers/GameStateManager";
import { SoundEffectType } from "../managers/AudioManager";
import { Scene } from "phaser";
import { SLOT_COLUMNS, SLOT_ROWS } from "../config/GameConfig";
import { fakeBonusAPI } from "./FakeBonusAPI";

const TOKEN_DISABLER = false;

function getUrlParameter(name: string): string {
    const urlParams = new URLSearchParams(window.location.search);
    let str : string = '';
    if(urlParams.get('start_game')){
        str = 'start_game';
    }
    else{
        str = urlParams.get(name) || '';
    }
    return str;
}

function logUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
        console.log(' URL Parameters:', Object.fromEntries(urlParams.entries()));
    }
}

const getApiBaseUrl = (): string => {
    const configuredUrl = (window as any)?.APP_CONFIG?.['game-url'];
    if (typeof configuredUrl === 'string' && configuredUrl.length > 0) {
        return configuredUrl.replace(/\/$/, "");
    }
    return 'https://game-launcher.torrospins.com';
}

function normalizeSymbolId(raw: any): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
        return 0;
    }
    return n === 18 ? 11 : n;
}

export function normalizeArea(rawArea: any): number[][] {
    if (!Array.isArray(rawArea) || !Array.isArray(rawArea[0])) {
        return [];
    }

    const outer = rawArea.length;
    const inner = Array.isArray(rawArea[0]) ? rawArea[0].length : 0;

    // Canonical grid is [col][row] (outer = SLOT_COLUMNS, inner = SLOT_ROWS).
    if (outer === SLOT_COLUMNS && inner === SLOT_ROWS) {
        const mapped: number[][] = [];
        for (let col = 0; col < SLOT_COLUMNS; col++) {
            mapped[col] = [];
            for (let row = 0; row < SLOT_ROWS; row++) {
                mapped[col][row] = normalizeSymbolId(rawArea[col][row]);
            }
        }
        return mapped;
    }

    if (outer === SLOT_ROWS && inner === SLOT_COLUMNS) {
        const transposed: number[][] = [];
        for (let col = 0; col < SLOT_COLUMNS; col++) {
            transposed[col] = [];
            for (let row = 0; row < SLOT_ROWS; row++) {
                transposed[col][row] = normalizeSymbolId(rawArea[row][col]);
            }
        }
        return transposed;
    }

    console.warn(`Unexpected slot.area dimensions: ${outer} x ${inner}, expected ${SLOT_COLUMNS} x ${SLOT_ROWS} or transposed. Using raw area as-is.`);
    try {
        const mapped: number[][] = [];
        for (let c = 0; c < outer; c++) {
            mapped[c] = [];
            for (let r = 0; r < inner; r++) {
                mapped[c][r] = normalizeSymbolId(rawArea[c][r]);
            }
        }
        return mapped;
    } catch {
        return rawArea;
    }
}

export function normalizeMoney(rawMoney: any): number[][] | undefined {
    if (!Array.isArray(rawMoney) || !Array.isArray(rawMoney[0])) {
        return undefined;
    }

    const outer = rawMoney.length;
    const inner = Array.isArray(rawMoney[0]) ? rawMoney[0].length : 0;

    if (outer === SLOT_COLUMNS && inner === SLOT_ROWS) {
        return rawMoney;
    }

    if (outer === SLOT_ROWS && inner === SLOT_COLUMNS) {
        const transposed: number[][] = [];
        for (let col = 0; col < SLOT_COLUMNS; col++) {
            transposed[col] = [];
            for (let row = 0; row < SLOT_ROWS; row++) {
                transposed[col][row] = rawMoney[row][col];
            }
        }
        return transposed;
    }

    return rawMoney;
}

export function normalizeSpinResponse(raw: any, bet: number): SpinData {
    const rawSlot = raw && raw.slot ? raw.slot : {};
    const freespinSource = rawSlot.freespin || rawSlot.freeSpin || {};
    const rawFreeSpinItems = Array.isArray(freespinSource.items) ? freespinSource.items : [];

    let minRawLineKey = Number.POSITIVE_INFINITY;
    if (Array.isArray(rawSlot.paylines)) {
        for (const pl of rawSlot.paylines) {
            const k = Number(pl?.lineKey);
            if (Number.isFinite(k)) {
                if (k < minRawLineKey) minRawLineKey = k;
            }
        }
    }
    for (const item of rawFreeSpinItems) {
        if (!item || !Array.isArray(item.payline)) continue;
        for (const pl of item.payline) {
            const k = Number(pl?.lineKey);
            if (Number.isFinite(k)) {
                if (k < minRawLineKey) minRawLineKey = k;
            }
        }
    }

    const useOneBasedLineKeys = minRawLineKey !== Number.POSITIVE_INFINITY && minRawLineKey >= 1;

    const basePaylines = Array.isArray(rawSlot.paylines)
        ? rawSlot.paylines.map((pl: any) => {
            const rawKey = Number(pl.lineKey);
            let lineKey = Number.isFinite(rawKey) ? rawKey : 0;
            if (useOneBasedLineKeys) {
                lineKey = lineKey - 1;
            }
            if (!Number.isFinite(lineKey) || lineKey < 0) {
                lineKey = 0;
            }
            return {
                lineKey,
                symbol: normalizeSymbolId(pl.symbol),
                count: Number(pl.count) || 0,
                win: Number(pl.win) || 0,
                multipliers: Array.isArray(pl.multipliers)
                    ? pl.multipliers.map((m: any) => ({
                        symbol: normalizeSymbolId(m.symbol),
                        count: Number(m.count) || 0
                    }))
                    : []
            };
        })
        : [];

    const freeSpinItems = rawFreeSpinItems.map((item: any) => ({
        spinsLeft: Number(item.spinsLeft) || 0,
        subTotalWin: Number(item.subTotalWin) || 0,
        runningWin: (() => {
            const v = Number((item as any)?.runningWin);
            return Number.isFinite(v) ? v : undefined;
        })(),
        collectorCount: (() => {
            const v = Number((item as any)?.collectorCount);
            return Number.isFinite(v) ? v : undefined;
        })(),
        area: normalizeArea(item.area),
        money: normalizeMoney(item.money),
        special: (item?.special && item.special.action)
            ? {
                action: String(item.special.action),
                position: item.special.position,
                items: normalizeMoney(item.special.items) || item.special.items
            }
            : undefined,
        payline: Array.isArray(item.payline)
            ? item.payline.map((pl: any) => {
                const rawKey = Number(pl.lineKey);
                let lineKey = Number.isFinite(rawKey) ? rawKey : 0;
                if (useOneBasedLineKeys) {
                    lineKey = lineKey - 1;
                }
                if (!Number.isFinite(lineKey) || lineKey < 0) {
                    lineKey = 0;
                }
                return {
                    lineKey,
                    symbol: normalizeSymbolId(pl.symbol),
                    count: Number(pl.count) || 0,
                    win: Number(pl.win) || 0,
                    multipliers: Array.isArray(pl.multipliers)
                        ? pl.multipliers.map((m: any) => ({
                            symbol: normalizeSymbolId(m.symbol),
                            count: Number(m.count) || 0
                        }))
                        : []
                };
            })
            : []
    }));

    const freeSpinData = {
        count: Number(freespinSource.count) || 0,
        totalWin: (() => {
            const total = Number((freespinSource as any)?.totalWin);
            if (Number.isFinite(total) && total >= 0) {
                return total;
            }
            const win = Number((freespinSource as any)?.win);
            return Number.isFinite(win) && win >= 0 ? win : 0;
        })(),
        items: freeSpinItems
    };
    (freeSpinData as any).__backendTotalWin = (freeSpinData as any).totalWin;

    const slotArea = normalizeArea(rawSlot.area);

    const slot: any = {
        area: slotArea,
        paylines: basePaylines,
        freespin: freeSpinData,
        freeSpin: freeSpinData
    };

    const normalizedMoney = normalizeMoney(rawSlot.money);
    if (normalizedMoney) {
        slot.money = normalizedMoney;
    }

    {
        const rawSlotTotalWin = Number((rawSlot as any)?.totalWin);
        if (Number.isFinite(rawSlotTotalWin) && rawSlotTotalWin >= 0) {
            slot.totalWin = rawSlotTotalWin;
            (slot as any).__backendTotalWin = rawSlotTotalWin;
        }
    }
    if (rawSlot.special && rawSlot.special.action) {
        slot.special = {
            action: String(rawSlot.special.action),
            position: rawSlot.special.position,
            items: normalizeMoney(rawSlot.special.items) || rawSlot.special.items
        };
    }

    const playerId = typeof raw.playerId === 'string' ? raw.playerId : 'local';
    const betValue = raw.bet !== undefined ? raw.bet : bet;
    const baseBetStr = bet != null ? bet.toString() : (betValue != null ? betValue.toString() : '0');

    return {
        playerId,
        bet: betValue != null ? betValue.toString() : bet.toString(),
        baseBet: baseBetStr,
        slot
    };
}

export class GameAPI {  
    gameData: GameData;
    exitURL: string = '';
    private currentSpinData: SpinData | null = null;
    private isFirstSpin: boolean = false;
    private currentFreeSpinIndex: number = 0;
    private freeSpinItemsCache: any[] | null = null;

    private isAbortError(error: any): boolean {
        try {
            if (!error) return false;
            if (error?.name === 'AbortError') return true;
            const msg = String(error?.message || '').toLowerCase();
            return (
                msg.includes('aborted') ||
                msg.includes('timeout') ||
                msg.includes('network') ||
                msg.includes('401') ||
                msg.includes('400')
            );
        } catch {
            return false;
        }
    }

    constructor(gameData: GameData) {
        this.gameData = gameData;
    }   

    public async generateGameUrlToken(): Promise<{url: string, token: string}> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/generate_url`;
        
        const requestBody = {
            "operator_id": "18b03717-33a7-46d6-9c70-acee80c54d03",
            "bank_id": "1",
            "player_id": 2,
            "game_id": "00020525",
            "device": "mobile",
            "lang": "en",
            "currency": "USD",
            "quit_link": "www.quit.com",
            "is_demo": 0,
            "free_spin": "1",
            "session": "85eacaac-40c3-4f94-951f-2a0d3625bfd1",
            "player_name": "test",
            "modify_uid": "111"
          };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br',
            'x-access-token': 'taVHVt4xD8NLwvlo3TgExmiSaGOiuiKAeGB9Qwla6XKpmSRMUwy2pZuuYJYNqFLr',
            'x-brand': '6194bf3a-b863-4302-b691-9cc8fe9b56c8'
        };

        try {
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            
            return {
                url: data.data.url,
                token: data.data.token 
            };
        } catch (error) {
            throw error;
        }
    }

    public async initializeGame(): Promise<string> {
        try {
            const existingToken = getUrlParameter('token');
            
            if (existingToken) {
                console.log('Game token found in URL parameters:', existingToken);
                
                localStorage.setItem('token', existingToken);
                sessionStorage.setItem('token', existingToken);
                
                console.log('Game initialized with existing token from URL');
                return existingToken;
            } else {
                console.log('No game token in URL, generating new token...');
                const { token } = await this.generateGameUrlToken();
                
                localStorage.setItem('token', token);
                sessionStorage.setItem('token', token);
                
                console.log('Game initialized successfully with new token:', token);
                return token;
            }
            
        } catch (error) {
            console.error('Error initializing game:', error);
            throw error;
        }
    }

    public async gameLauncher(): Promise<void> {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('exit_url');
            localStorage.removeItem('what_device');

            sessionStorage.removeItem('token');
            sessionStorage.removeItem('exit_url');
            sessionStorage.removeItem('what_device');
            
            console.log('Starting gameLauncher...');
            let token1 = '';
            let tokenParam = getUrlParameter('token');
            
            if(tokenParam){
                token1 = tokenParam;
                localStorage.setItem('token', token1);
                sessionStorage.setItem('token', token1);
            }

            let deviceUrl = getUrlParameter('device');
            if(deviceUrl){
                localStorage.setItem('what_device',deviceUrl);
                sessionStorage.setItem('what_device',deviceUrl);
            }

            let apiUrl = getUrlParameter('api_exit');
            if(apiUrl){
                this.exitURL = apiUrl;
                localStorage.setItem('exit_url',apiUrl);
                sessionStorage.setItem('exit_url',apiUrl);
            }

            let startGame = getUrlParameter('start_game');
            if(startGame){
                console.log('startGame');
                let {token} = await this.generateGameUrlToken();
                token1 = token;
                localStorage.setItem('token', token);
                sessionStorage.setItem('token', token);
            }

            if (!token1 && !startGame) {
                throw new Error();
            }
        } catch (error) {
            console.error('Error in gameLauncher:', error);
            throw error;
        }
    }

    public async getBalance(): Promise<any> {
        let timeout: any;
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.showTokenExpiredPopup();
                throw new Error('No authentication token available');
            }

            const controller = new AbortController();
            timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
            try { clearTimeout(timeout); } catch {}

            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                if (response.status === 400 || response.status === 401) {
                    this.showTokenExpiredPopup();
                    localStorage.removeItem('token');
                }
                throw error;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (!this.isAbortError(error)) {
                console.error('Error in getBalance:', error);

                if (this.isTokenExpiredError(error)) {
                    this.showTokenExpiredPopup();
                }
            }

            throw error;
        } finally {
            try { clearTimeout(timeout); } catch {}
        }
    }

    private showTokenExpiredPopup(): void {
        if(TOKEN_DISABLER)
            return;
        const gameScene = (window as any).game?.scene?.getScene('Game') as Phaser.Scene;
        if (gameScene) {
            import('../game/components/TokenExpiredPopup').then(module => {
                const TokenExpiredPopup = module.TokenExpiredPopup;
                const popup = new TokenExpiredPopup(gameScene);
                popup.show();
            });
        } else {
            console.error('Game scene not found. Cannot show token expired popup.');
        }
    }

    private isTokenExpiredError(error: any): boolean {
        const errorMessage = error?.message?.toLowerCase() || '';
        return (
            errorMessage.includes('token') ||
            errorMessage.includes('expired') ||
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('401') ||
            errorMessage.includes('400')
        );
    }

    public async doSpin(bet: number, isBuyFs: boolean, isEnhancedBet: boolean): Promise<SpinData> {
        // Optional fake base-spin support (pre-bonus / scatter-trigger spin)
        // Only applies for normal spins (not buy-feature) and only when not already in bonus mode.
        try {
            if (!gameStateManager.isBonus && !isBuyFs && fakeBonusAPI.isEnabled()) {
                const maybeFake = await fakeBonusAPI.simulateBaseSpin(bet);
                if (maybeFake) {
                    try {
                        this.currentSpinData = maybeFake;
                    } catch {}
                    return maybeFake;
                }
            }
        } catch {}

        const token = localStorage.getItem('token');
        if (!token) {
            this.showTokenExpiredPopup();
            throw new Error('No game token available. Please refresh the page.');
        }

        let responseData: any;

        const controller = new AbortController();
        let timeout: any = setTimeout(() => controller.abort(), 10000);

        try {

            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'spin',
                    bet: bet.toString(),
                    line: 1,
                    isBuyFs,
                    isEnhancedBet
                }),
                signal: controller.signal
            });
            try { clearTimeout(timeout); } catch {}

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                if (response.status === 401 || response.status === 400) {
                    this.showTokenExpiredPopup();
                    localStorage.removeItem('token');
                }
                throw error;
            }

            responseData = await response.json();
        } catch (error) {
            try { clearTimeout(timeout); } catch {}
            if (!this.isAbortError(error)) {
                console.error('Error in doSpin:', error);
            }
            throw error;
        } finally {
            try { clearTimeout(timeout); } catch {}
        }

        const normalizedData = normalizeSpinResponse(responseData, bet);

        if (normalizedData.slot && normalizedData.slot.freespin &&
            Array.isArray(normalizedData.slot.freespin.items) && normalizedData.slot.freespin.items.length > 0) {
            this.currentSpinData = normalizedData;
            try { this.freeSpinItemsCache = (normalizedData.slot.freespin as any).items || null; } catch { this.freeSpinItemsCache = null; }
            try { this.currentFreeSpinIndex = 0; } catch {}
        } else if (
            gameStateManager.isBonus &&
            this.currentSpinData &&
            this.currentSpinData.slot &&
            this.currentSpinData.slot.freespin &&
            Array.isArray(this.currentSpinData.slot.freespin.items) &&
            this.currentSpinData.slot.freespin.items.length > 0
        ) {
            // Keep existing freespin items when in bonus mode
        } else {
            this.currentSpinData = normalizedData;
        }

        console.log(' ===== SERVER RESPONSE DEBUG =====');
        console.log(' Raw server response:', responseData);
        console.log(' Normalized SpinData:', normalizedData);
        console.log(' Grid symbols:', normalizedData.slot?.area);
        console.log(' Paylines:', normalizedData.slot?.paylines);

        return this.currentSpinData as SpinData;
    }

    public async simulateFreeSpin(): Promise<SpinData> {
        // Check if fake API is enabled and we're in bonus mode
        if (gameStateManager.isBonus && fakeBonusAPI.isEnabled()) {
            console.log('Using Fake API for bonus free spins');
            
            // Initialize fake data if not already done
            if (!fakeBonusAPI.getCurrentSpinData()) {
                await fakeBonusAPI.initializeBonusData();
            }
            
            // initializeBonusData() can disable the fake API; if so, fall through to backend handling
            if (fakeBonusAPI.isEnabled()) {
                // Use fake API if available
                if (fakeBonusAPI.hasMoreFreeSpins()) {
                    const data = await fakeBonusAPI.simulateFreeSpin();
                    try {
                        this.currentSpinData = data;
                    } catch {}
                    return data;
                }

                throw new Error('No more free spins available');
            }
        }

        // Fall back to backend simulation using the currently cached free spin payload
        if (!this.currentSpinData || (!this.currentSpinData.slot?.freespin?.items && !this.currentSpinData.slot?.freeSpin?.items)) {
            console.error('No free spin data available. Current spin data:', this.currentSpinData);
            console.error('Available freespin data:', this.currentSpinData?.slot?.freespin);
            throw new Error('No free spin data available. Please ensure SpinData contains freespin items.');
        }

        const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
        const itemsFromSpinData = Array.isArray((freespinData as any)?.items) ? (freespinData as any).items : [];
        if (!this.freeSpinItemsCache) {
            this.freeSpinItemsCache = itemsFromSpinData;
        }
        const items = this.freeSpinItemsCache || [];

        if (this.currentFreeSpinIndex >= items.length) {
            throw new Error('No more free spins available');
        }

        const currentItem: any = items[this.currentFreeSpinIndex];
        if (!currentItem) {
            throw new Error('No more free spins available');
        }

        try {
            if ((window as any).audioManager) {
                (window as any).audioManager.playSoundEffect(SoundEffectType.SPIN);
                console.log('Playing spin sound effect for free spin simulation');
            }
        } catch {}

        const remainingItems = items.slice(this.currentFreeSpinIndex);
        const remainingCount = Number((currentItem as any)?.spinsLeft) || 0;

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
                cumulativeTotal = prevBase + (Number((currentItem as any)?.subTotalWin) || 0);
            } catch {}
        }

        let preAwardTotal = cumulativeTotal;
        try {
            const st = Number((currentItem as any)?.subTotalWin);
            if (isFinite(st) && st > 0) {
                preAwardTotal = Math.max(0, cumulativeTotal - st);
            }
        } catch {}

        const resolvedTotalWin = (isFinite(Number(preAwardTotal)) && Number(preAwardTotal) >= 0) ? Number(preAwardTotal) : 0;

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

        const normalizedArea = normalizeArea((currentItem as any).area);
        const normalizedMoney = normalizeMoney((currentItem as any).money);

        const spinDataOut: SpinData = {
            playerId: this.currentSpinData.playerId,
            bet: this.currentSpinData.bet,
            baseBet: (this.currentSpinData as any).baseBet,
            slot: {
                area: normalizedArea,
                paylines: Array.isArray((currentItem as any).payline) ? (currentItem as any).payline : [],
                money: normalizedMoney,
                special: slotSpecial,
                totalWin: resolvedTotalWin,
                freespin: {
                    count: remainingCount,
                    totalWin: resolvedTotalWin,
                    items: remainingItems
                },
                freeSpin: {
                    count: remainingCount,
                    totalWin: resolvedTotalWin,
                    items: remainingItems
                }
            }
        };

        try { (spinDataOut.slot as any).__backendTotalWin = resolvedTotalWin; } catch {}

        this.currentSpinData = spinDataOut;
        this.currentFreeSpinIndex++;

        return spinDataOut;
    }

    public getCurrentSpinData(): SpinData | null {
        return this.currentSpinData;
    }

    public resetFreeSpinIndex(): void {
        console.log('Resetting free spin index to 0');
        this.currentFreeSpinIndex = 0;
    }

    public clearCurrentSpinData(): void {
        this.currentSpinData = null;
        this.freeSpinItemsCache = null;
    }

    public setFreeSpinData(spinData: SpinData): void {
        console.log('Setting free spin data for simulation:', spinData);
        this.currentSpinData = spinData;
        try {
            const fs: any = (spinData as any)?.slot?.freespin || (spinData as any)?.slot?.freeSpin;
            this.freeSpinItemsCache = Array.isArray(fs?.items) ? fs.items : null;
        } catch {
            this.freeSpinItemsCache = null;
        }
        this.currentFreeSpinIndex = 0;
    }

    /**
     * Initialize fake API for bonus mode - easily removable
     */
    public async initializeFakeBonusAPI(): Promise<void> {
        if (gameStateManager.isBonus && fakeBonusAPI.isEnabled()) {
            console.log('Initializing Fake Bonus API for bonus scene');
            try {
                await fakeBonusAPI.initializeBonusData();
                console.log('Fake Bonus API initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Fake Bonus API:', error);
                throw error;
            }
        } else {
            console.log('Fake API disabled or not in bonus mode');
        }
    }

    /**
     * Check if fake API is available for bonus mode
     */
    public isFakeAPIAvailable(): boolean {
        return gameStateManager.isBonus && fakeBonusAPI.isEnabled() && fakeBonusAPI.getCurrentSpinData() !== null;
    }

    public async initializeBalance(): Promise<number> {
        try {
            console.log('Initializing player balance...');

            const balanceResponse = await this.getBalance();
            console.log('Balance response received:', balanceResponse);

            let balance = 0;
            if (balanceResponse && balanceResponse.data && balanceResponse.data.balance !== undefined) {
                balance = parseFloat(balanceResponse.data.balance);
            } else if (balanceResponse && (balanceResponse as any).balance !== undefined) {
                balance = parseFloat((balanceResponse as any).balance);
            } else {
                console.warn('Unexpected balance response structure:', balanceResponse);
                balance = 0;
            }

            console.log(`Initialized balance: $${balance}`);
            return balance;

        } catch (error) {
            if (!this.isAbortError(error)) {
                console.error('Error initializing balance:', error);
            }
            const defaultBalance = 0;
            console.log(`Using default balance: $${defaultBalance}`);
            return defaultBalance;
        }
    }

    public async getHistory(page: number, limit: number): Promise<any> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/games/me/histories`;
        const token = localStorage.getItem('token')
            || sessionStorage.getItem('token')
            || '';

        const controller = new AbortController();
        let timeout: any = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(`${apiUrl}?limit=${limit}&page=${page}`,{
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    }
}