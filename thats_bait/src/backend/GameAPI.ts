import { SpinData } from "./SpinData";
import { GameData } from "../game/components/GameData";
import { gameStateManager } from "../managers/GameStateManager";
import { SoundEffectType } from "../managers/AudioManager";
import { Scene } from "phaser";
import { SLOT_COLUMNS, SLOT_ROWS } from "../config/GameConfig";

const TOKEN_DISABLER = false;
/**
 * Function to parse URL query parameters
 * @param name - The name of the parameter to retrieve
 * @returns The value of the parameter or null if not found
 */
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

/**
 * Function to log all URL parameters for debugging
 * Only logs if there are any parameters present
 */
function logUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
        console.log('🔍 URL Parameters:', Object.fromEntries(urlParams.entries()));
    }
}

/**
 * Function to get the API base URL
 * @returns The API base URL
 */
const getApiBaseUrl = (): string => {
    const configuredUrl = (window as any)?.APP_CONFIG?.['game-url'];
    if (typeof configuredUrl === 'string' && configuredUrl.length > 0) {
        return configuredUrl.replace(/\/$/, "");
    }
    return 'https://game-launcher.torrospins.com';
};

const MOCK_SPIN_RESPONSE: any = {
    bet: "1",
    slot: {
        area: [
            [1, 10, 6],
            [1, 0, 7],
            [2, 3, 0],
            [6, 5, 4],
            [6, 5, 3]
        ],
        money: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 25, 0],
            [0, 25, 0]
        ],
        special: {
            action: "hook-scatter",
            position: {
                x: 0,
                y: 3
            }
        },
        totalWin: 2100,
        paylines: [
            {
                lineKey: 0,
                symbol: 1,
                count: 2,
                win: 0.5
            },
            {
                lineKey: 8,
                symbol: 1,
                count: 2,
                win: 0.5
            }
        ],
        freeSpin: {
            count: 10,
            win: 100,
            items: [
                {
                    spinsLeft: 10,
                    collectorCount: 2,
                    subTotalWin: 10,
                    area: [
                        [6, 7, 18],
                        [1, 7, 5],
                        [4, 5, 5],
                        [3, 5, 4],
                        [18, 5, 3]
                    ],
                    money: [
                        [0, 0, 0],
                        [0, 0, 10],
                        [0, 10, 10],
                        [0, 10, 0],
                        [0, 10, 0]
                    ],
                    payline: [
                        {
                            lineKey: 2,
                            symbol: 5,
                            count: 3,
                            win: 1
                        },
                        {
                            lineKey: 7,
                            symbol: 5,
                            count: 3,
                            win: 1
                        }
                    ]
                }
            ]
        }
    }
};

function normalizeArea(rawArea: any): number[][] {
    if (!Array.isArray(rawArea) || !Array.isArray(rawArea[0])) {
        return [];
    }

    const outer = rawArea.length;
    const inner = Array.isArray(rawArea[0]) ? rawArea[0].length : 0;

    // If the area already matches the expected dimensions (SLOT_COLUMNS x SLOT_ROWS), use it as-is
    if (outer === SLOT_COLUMNS && inner === SLOT_ROWS) {
        return rawArea;
    }

    // If the area is transposed (SLOT_ROWS x SLOT_COLUMNS), transpose it to match the game grid
    if (outer === SLOT_ROWS && inner === SLOT_COLUMNS) {
        const transposed: number[][] = [];
        for (let c = 0; c < SLOT_COLUMNS; c++) {
            transposed[c] = [];
            for (let r = 0; r < SLOT_ROWS; r++) {
                transposed[c][r] = rawArea[r][c];
            }
        }
        return transposed;
    }

    console.warn(`[GameAPI] Unexpected slot.area dimensions: ${outer} x ${inner}, expected ${SLOT_COLUMNS} x ${SLOT_ROWS} or transposed. Using raw area as-is.`);
    return rawArea;
}

function normalizeSpinResponse(raw: any, bet: number): SpinData {
    const rawSlot = raw && raw.slot ? raw.slot : {};
    const freespinSource = rawSlot.freespin || rawSlot.freeSpin || {};
    const rawFreeSpinItems = Array.isArray(freespinSource.items) ? freespinSource.items : [];

    const basePaylines = Array.isArray(rawSlot.paylines)
        ? rawSlot.paylines.map((pl: any) => ({
            lineKey: Number(pl.lineKey) || 0,
            symbol: Number(pl.symbol) || 0,
            count: Number(pl.count) || 0,
            win: Number(pl.win) || 0,
            multipliers: Array.isArray(pl.multipliers)
                ? pl.multipliers.map((m: any) => ({
                    symbol: Number(m.symbol) || 0,
                    count: Number(m.count) || 0
                }))
                : []
        }))
        : [];

    const freeSpinItems = rawFreeSpinItems.map((item: any) => ({
        spinsLeft: Number(item.spinsLeft) || 0,
        subTotalWin: Number(item.subTotalWin) || 0,
        collectorCount: typeof item.collectorCount === 'number' ? item.collectorCount : undefined,
        area: normalizeArea(item.area),
        money: Array.isArray(item.money) ? item.money : undefined,
        payline: Array.isArray(item.payline)
            ? item.payline.map((pl: any) => ({
                lineKey: Number(pl.lineKey) || 0,
                symbol: Number(pl.symbol) || 0,
                count: Number(pl.count) || 0,
                win: Number(pl.win) || 0,
                multipliers: Array.isArray(pl.multipliers)
                    ? pl.multipliers.map((m: any) => ({
                        symbol: Number(m.symbol) || 0,
                        count: Number(m.count) || 0
                    }))
                    : []
            }))
            : []
    }));

    const freeSpinData = {
        count: Number(freespinSource.count) || 0,
        totalWin: typeof freespinSource.totalWin === 'number'
            ? freespinSource.totalWin
            : (Number(freespinSource.win) || 0),
        items: freeSpinItems
    };

    const slotArea = normalizeArea(rawSlot.area);

    const slot: any = {
        area: slotArea,
        paylines: basePaylines,
        freespin: freeSpinData,
        freeSpin: freeSpinData
    };

    if (Array.isArray(rawSlot.money)) {
        slot.money = rawSlot.money;
    }
    if (typeof rawSlot.totalWin === 'number') {
        slot.totalWin = rawSlot.totalWin;
    }
    if (rawSlot.special && rawSlot.special.action) {
        slot.special = {
            action: String(rawSlot.special.action),
            position: rawSlot.special.position
        };
    }

    const playerId = typeof raw.playerId === 'string' ? raw.playerId : 'local';
    const betValue = raw.bet !== undefined ? raw.bet : bet;

    return {
        playerId,
        bet: betValue != null ? betValue.toString() : bet.toString(),
        slot
    };
}

export class GameAPI {  
    gameData: GameData;
    exitURL: string = '';
    private currentSpinData: SpinData | null = null;
    private isFirstSpin: boolean = false; // Flag to track first spin
    private currentFreeSpinIndex: number = 0; // Track current free spin item index
    
    constructor(gameData: GameData) {
        this.gameData = gameData;
    }   

    /**
     * 1. Generate game URL token upon game initialization
     * This method generates a game token that can be used for subsequent API calls
     */
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

            //console.log('Response status:', response.status);
            //console.log('Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                //console.error('Response error text:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            
            return {
                url: data.data.url,
                token: data.data.token 
            };
        } catch (error) {
            //console.error('Error generating game URL:', error);
            throw error;
        }
    }

    /**
     * Initialize the game with token generation
     * This method should be called when the game starts to get the game token
     * Only generates a new token if token URL parameter is not present
     */
    public async initializeGame(): Promise<string> {
        try {
            // Check if token is already in the URL parameters
            const existingToken = getUrlParameter('token');
            
            if (existingToken) {
                console.log('Game token found in URL parameters:', existingToken);
                
                // Store the existing token in localStorage and sessionStorage
                localStorage.setItem('token', existingToken);
                sessionStorage.setItem('token', existingToken);
                
                console.log('Game initialized with existing token from URL');
                return existingToken;
            } else {
                console.log('No game token in URL, generating new token...');
                const { token } = await this.generateGameUrlToken();
                
                // Store the token in localStorage and sessionStorage
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
            throw new Error();
        }
    }
    public async getBalance(): Promise<any> {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.showTokenExpiredPopup();
                throw new Error('No authentication token available');
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`);
                
                // Show token expired popup for 400 or 401 status
                if (response.status === 400 || response.status === 401) {
                    this.showTokenExpiredPopup();
                    localStorage.removeItem('token');
                }
                
                throw error;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in getBalance:', error);
            
            // Handle network errors or other issues
            if (this.isTokenExpiredError(error)) {
                this.showTokenExpiredPopup();
            }
            
            throw error;
        }
    }

    /**
     * 2. Post a spin request to the server
     * This method sends a spin request and returns the server response
     */
    private showTokenExpiredPopup(): void {
        if(TOKEN_DISABLER)
            return;
        // Find the game scene
        const gameScene = (window as any).game?.scene?.getScene('Game') as Phaser.Scene;
        if (gameScene) {
            // Import dynamically to avoid circular dependency
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
        const token = localStorage.getItem('token');
        if (!token) {
            this.showTokenExpiredPopup();
            throw new Error('No game token available. Please refresh the page.');
        }
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let responseData: any;
            let usedMock = false;

            try {
                const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/bet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        action: 'spin',
                        bet: bet.toString(),
                        line: 1, // Try different line count
                        isBuyFs: isBuyFs, // Force false
                        isEnhancedBet: isEnhancedBet // Use the parameter value
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                    
                    // Check for token expiration
                    if (response.status === 401 || response.status === 400) {
                        this.showTokenExpiredPopup();
                        // Clear the invalid token
                        localStorage.removeItem('token');
                    }
                    
                    throw error;
                }

                responseData = await response.json();
            } catch (error) {
                clearTimeout(timeout);
                console.warn('[GameAPI] doSpin failed, using MOCK spin response instead of live API.');
                console.warn('[GameAPI] doSpin error:', error);
                responseData = { ...MOCK_SPIN_RESPONSE, bet: bet.toString() };
                usedMock = true;
            }

            const normalizedData = normalizeSpinResponse(responseData, bet);
            
            // 3. Store the spin data to SpinData.ts
            // If this response contains free spin data, save it for bonus mode
            console.log('[GameAPI] Checking response for free spin data...');
            console.log('[GameAPI] Response has slot:', !!normalizedData.slot);
            console.log('[GameAPI] Response has freespin:', !!normalizedData.slot?.freespin);
            console.log('[GameAPI] Response has freespin.items:', !!normalizedData.slot?.freespin?.items && normalizedData.slot.freespin.items.length > 0);
            console.log('[GameAPI] Current isBonus state:', gameStateManager.isBonus);
            console.log('[GameAPI] Current currentSpinData has freespin:', !!this.currentSpinData?.slot?.freespin?.items);
            
            if (normalizedData.slot && normalizedData.slot.freespin && normalizedData.slot.freespin.items && normalizedData.slot.freespin.items.length > 0) {
                console.log('[GameAPI] Free spin data detected in response - saving for bonus mode');
                console.log('[GameAPI] Free spin items count:', normalizedData.slot.freespin.items.length);
                this.currentSpinData = normalizedData;
                console.log('[GameAPI] Free spin data saved to currentSpinData');
            } else if (gameStateManager.isBonus && this.currentSpinData && this.currentSpinData.slot?.freespin?.items && this.currentSpinData.slot.freespin.items.length > 0) {
                console.log('[GameAPI] Preserving original free spin data during bonus mode');
                // Don't overwrite the original free spin data - keep it for simulation
            } else {
                console.log('[GameAPI] No free spin data detected - storing regular response');
                this.currentSpinData = normalizedData;
            }

            console.log('🎰 ===== SERVER RESPONSE DEBUG =====');
            console.log('📊 Raw server response (or mock):', responseData);
            console.log('📊 Normalized SpinData:', normalizedData);
            console.log('🎯 Freespin data:', normalizedData.slot?.freespin);
            console.log('🎯 Freespin count:', normalizedData.slot?.freespin?.count);
            console.log('🎯 Freespin items:', normalizedData.slot?.freespin?.items);
            console.log('🎯 Freespin items length:', normalizedData.slot?.freespin?.items?.length);
            console.log('🎲 Grid symbols:', normalizedData.slot?.area);
            console.log('💰 Paylines:', normalizedData.slot?.paylines);
            if (usedMock) {
                console.warn('[GameAPI] SpinData was generated from MOCK_SPIN_RESPONSE (API is in development).');
            }
            console.log('🎰 ===== END SERVER RESPONSE =====');
            
            return this.currentSpinData as SpinData;
            
        } catch (error) {
            console.error('Error in doSpin:', error);
            throw error;
        }
    }

    /**
     * Simulate a free spin using pre-determined data from SpinData.freespin.items
     * This method uses the area and paylines from the freespin items instead of calling the API
     */
    public async simulateFreeSpin(): Promise<SpinData> {
        if (!this.currentSpinData || (!this.currentSpinData.slot?.freespin?.items && !this.currentSpinData.slot?.freeSpin?.items)) {
            console.error('[GameAPI] No free spin data available. Current spin data:', this.currentSpinData);
            console.error('[GameAPI] Available freespin data:', this.currentSpinData?.slot?.freespin);
            throw new Error('No free spin data available. Please ensure SpinData contains freespin items.');
        }

        const freespinData = this.currentSpinData.slot.freespin || this.currentSpinData.slot.freeSpin;
        const items = freespinData.items;
        
        // Check if we have more items to process
        if (this.currentFreeSpinIndex >= items.length) {
            throw new Error('No more free spins available');
        }
        
        // Get the current item based on index
        const currentItem = items[this.currentFreeSpinIndex];
        
        if (!currentItem || currentItem.spinsLeft <= 0) {
            throw new Error('No more free spins available');
        }

        // Play spin sound effect for free spin simulation
        if ((window as any).audioManager) {
            (window as any).audioManager.playSoundEffect(SoundEffectType.SPIN);
            console.log('[GameAPI] Playing spin sound effect for free spin simulation');
        }

        console.log('🎰 ===== SIMULATING FREE SPIN =====');
        console.log('📊 Using pre-determined free spin data');
        console.log('🎯 Current free spin index:', this.currentFreeSpinIndex);
        console.log('🎯 Spins left:', currentItem.spinsLeft);
        console.log('💰 Sub total win:', currentItem.subTotalWin);
        console.log('🎲 Area:', currentItem.area);
        console.log('💎 Paylines:', currentItem.payline);

        // Create a new SpinData object for this free spin
        const freeSpinData: SpinData = {
            playerId: this.currentSpinData.playerId,
            bet: this.currentSpinData.bet,
            slot: {
                area: currentItem.area,
                paylines: currentItem.payline,
                freespin: {
                    count: freespinData.count, // Preserve original count from API response
                    totalWin: freespinData.totalWin,
                    items: items // Keep all items as they are
                }
            }
        };

        // Update the current spin data
        this.currentSpinData = freeSpinData;
        
        // Increment the index for the next free spin
        this.currentFreeSpinIndex++;

        console.log('🎰 ===== FREE SPIN SIMULATION COMPLETE =====');
        console.log('📊 New SpinData:', freeSpinData);
        console.log('🎯 Remaining free spins:', freeSpinData.slot.freespin.count);
        console.log('🎯 Next free spin will use index:', this.currentFreeSpinIndex);
        console.log('🎰 ===== END FREE SPIN SIMULATION =====');

        return freeSpinData;
    }

    /**
     * Get the current spin data
     * Returns the last spin data that was received from the server
     */
    public getCurrentSpinData(): SpinData | null {
        return this.currentSpinData;
    }

    /**
     * Reset the free spin index when starting a new scatter bonus
     * This should be called when a new scatter bonus is triggered
     */
    public resetFreeSpinIndex(): void {
        console.log('🎰 Resetting free spin index to 0');
        this.currentFreeSpinIndex = 0;
    }

    /**
     * Clear the current spin data
     * Useful for resetting state between spins
     */
    public clearCurrentSpinData(): void {
        this.currentSpinData = null;
    }

    /**
     * Set the free spin data for simulation
     * This method should be called when free spins are triggered to provide the data for simulation
     */
    public setFreeSpinData(spinData: SpinData): void {
        console.log('[GameAPI] Setting free spin data for simulation:', spinData);
        this.currentSpinData = spinData;
        this.resetFreeSpinIndex(); // Reset the index when setting new data
    }

    /**
     * Initialize the player's balance on game start
     * This method calls getBalance and updates the GameData with the current balance
     */
    public async initializeBalance(): Promise<number> {
        try {
            console.log('[GameAPI] Initializing player balance...');
            
            const balanceResponse = await this.getBalance();
            console.log('[GameAPI] Balance response received:', balanceResponse);
            
            // Extract balance from response - adjust this based on actual API response structure
            let balance = 0;
            if (balanceResponse && balanceResponse.data && balanceResponse.data.balance !== undefined) {
                balance = parseFloat(balanceResponse.data.balance);
            } else if (balanceResponse && balanceResponse.balance !== undefined) {
                balance = parseFloat(balanceResponse.balance);
            } else {
                console.warn('[GameAPI] Unexpected balance response structure:', balanceResponse);
                // Fallback to a default balance if structure is unexpected
                balance = 0;
            }
            
            console.log(`[GameAPI] Initialized balance: $${balance}`);
            return balance;
            
        } catch (error) {
            console.error('[GameAPI] Error initializing balance:', error);
            // Return a default balance if API call fails
            const defaultBalance = 0;
            console.log(`[GameAPI] Using default balance: $${defaultBalance}`);
            return defaultBalance;
        }
    }

    public async getHistory(page: number, limit: number): Promise<any> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/games/me/histories`;
        const token = localStorage.getItem('token')
            || sessionStorage.getItem('token')
            || '';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
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