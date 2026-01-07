import { FreeSpinItem, SpinData } from "./SpinData";
import { GameData } from "../game/components/GameData";
import { gameStateManager } from "../managers/GameStateManager";
import { SoundEffectType } from "../managers/AudioManager";

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


const getApiBaseUrl = (): string => {
    const configuredUrl = (window as any)?.APP_CONFIG?.['game-url'];
    if (typeof configuredUrl === 'string' && configuredUrl.length > 0) {
        return configuredUrl.replace(/\/$/, "");
    }
    return 'https://game-launcher.torrospins.com/'; // 192.168.0.17:3000/

};

export class GameAPI {  
    private static readonly GAME_ID: string = '00060725';
    private static DEMO_BALANCE: number = 10000;
    
    gameData: GameData;
    exitURL: string = '';
    private currentSpinData: SpinData | null = null;
    private currentFreeSpinData: SpinData | null = null;
    private isFirstSpin: boolean = false; // Flag to track first spin
    private static CURRENT_FREE_SPIN_INDEX: number = 0; // Track current free spin item index
    private static CURRENT_TUMBLE_INDEX: number = 0; // Track current tumble index
    
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
            "game_id": GameAPI.GAME_ID,
            "device": "mobile",
            "lang": "en",
            "currency": "USD",
            "quit_link": "www.quit.com",
            "is_demo": 0,
            "free_spin": "1",
            "session": "623a9cd6-0d55-46ce-9016-36f7ea2de678",
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
        const isDemo = this.getDemoState();
        localStorage.setItem('demo', isDemo ? 'true' : 'false');
        sessionStorage.setItem('demo', isDemo ? 'true' : 'false');
        
        if(isDemo){
            return '';
        }
        
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
            localStorage.removeItem('demo');

            sessionStorage.removeItem('token');
            sessionStorage.removeItem('exit_url');
            sessionStorage.removeItem('what_device');
            sessionStorage.removeItem('demo');

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
        // Check if demo mode is active
        const isDemo = this.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
        
        // Return mock balance for demo mode
        if (isDemo) {
            return {
                data: {
                    balance: GameAPI.DEMO_BALANCE
                }
            };
        }
        
        try{
            const response = await fetch(`${getApiBaseUrl()}api/v1/slots/balance`, {
            //const response = await fetch('http://192.168.0.17:3000/api/v1/slots/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in getBalance:', error);
            throw error;
        }
    }

    /**
     * 2. Post a spin request to the server
     * This method sends a spin request and returns the server response
     */
    public async doSpin(bet: number, isBuyFs: boolean, isEnhancedBet: boolean): Promise<SpinData> {
        // Check if demo mode is active
        const isDemo = this.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
        
        // Only require token if not in demo mode
        if (!isDemo && !localStorage.getItem('token')) {
            throw new Error('No game token available. Please initialize the game first.');
        }
        
        try {
            // Build headers - include Authorization only if token exists
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            const token = localStorage.getItem('token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const url = isDemo ? `${getApiBaseUrl()}/api/v1/analytics/spin` : `${getApiBaseUrl()}/api/v1/slots/bet`;
            
            // Build request body based on demo mode
            const requestBody = isDemo ? {
                bet: bet.toString(),
                gameId: GameAPI.GAME_ID,
                isEnhancedBet: isEnhancedBet,
                isBuyFs: isBuyFs,
                isFs: false
            } : {
                action: 'spin',
                bet: bet.toString(),
                line: 1, // Try different line count
                isBuyFs: isBuyFs, // Force false
                isEnhancedBet: isEnhancedBet // Use the parameter value
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const responseData = await response.json();
            
            // Ensure bet is included in the response data (server might not return it)
            if (!responseData.bet) {
                responseData.bet = bet.toString();
            }
            
            // 3. Store the spin data to SpinData.ts
            // If this response contains free spin data, save it for bonus mode
            console.log('[GameAPI] Checking response for free spin data...');
            console.log('[GameAPI] Response has slot:', !!responseData.slot);
            console.log('[GameAPI] Response has freespin:', !!responseData.slot?.freespin);
            console.log('[GameAPI] Response has freespin.items:', !!responseData.slot?.freespin?.items);
            console.log('[GameAPI] Response has freeSpin:', !!responseData.slot?.freeSpin);
            console.log('[GameAPI] Response has freeSpin.items:', !!responseData.slot?.freeSpin?.items);
            console.log('[GameAPI] Current isBonus state:', gameStateManager.isBonus);
            console.log('[GameAPI] Current currentSpinData has freespin:', !!this.currentSpinData?.slot?.freeSpin?.items);
            
            if (responseData.slot && (responseData.slot.freespin?.items || responseData.slot.freeSpin?.items)) {
                console.log('[GameAPI] Free spin data detected in response - saving for bonus mode');
                const items = responseData.slot.freespin?.items || responseData.slot.freeSpin?.items;
                console.log('[GameAPI] Free spin items count:', items.length);
                this.currentSpinData = responseData as SpinData;
                console.log('[GameAPI] Free spin data saved to currentSpinData');
            } else if (gameStateManager.isBonus && this.currentSpinData && (this.currentSpinData.slot?.freeSpin?.items)) {
                console.log('[GameAPI] Preserving original free spin data during bonus mode');
                // Don't overwrite the original free spin data - keep it for simulation
            } else {
                console.log('[GameAPI] No free spin data detected - storing regular response');
                this.currentSpinData = responseData as SpinData;
            }

            console.log('🎰 ===== SERVER RESPONSE DEBUG =====');
            console.log('📊 Full server response:', responseData);
            console.log('🎯 Freespin data:', responseData.slot?.freespin);
            console.log('🎯 Freespin count:', responseData.slot?.freeSpin?.count);
            console.log('🎯 Freespin items:', responseData.slot?.freeSpin?.items);
            console.log('🎯 Freespin items length:', responseData.slot?.freeSpin?.items?.length);
            console.log('🎲 Grid symbols:', responseData.slot?.area);
            console.log('💰 Paylines:', responseData.slot?.paylines);
            console.log('🎰 ===== END SERVER RESPONSE =====');
            
            return this.currentSpinData;
            
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
        if (!this.currentSpinData || (!this.currentSpinData.slot?.freeSpin?.items)) {
            console.error('[GameAPI] No free spin data available. Current spin data:', this.currentSpinData);
            console.error('[GameAPI] Available freespin data:', this.currentSpinData?.slot?.freeSpin);
            throw new Error('No free spin data available. Please ensure SpinData contains freespin items.');
        }

        console.log('[GameAPI] Current spin data:', this.currentSpinData);

        const freeSpinFromSpinData = this.currentSpinData.slot.freeSpin;
        const freeSpinItems = freeSpinFromSpinData.items;
        
        // Check if we have more items to process
        if (GameAPI.CURRENT_FREE_SPIN_INDEX >= freeSpinItems.length) {
            throw new Error('No more free spins available');
        }
        
        // Get the current item based on index
        const currentItem = freeSpinItems[GameAPI.CURRENT_FREE_SPIN_INDEX] as FreeSpinItem;
        
        if (!currentItem || currentItem.spinsLeft <= 0) {
            throw new Error('No more free spins available');
        }

        // Play spin sound effect for free spin simulation
        if ((window as any).audioManager) {
            (window as any).audioManager.playSoundEffect(gameStateManager.isBonus ? SoundEffectType.BONUS_SPIN : SoundEffectType.SPIN);
            console.log('[GameAPI] Playing', gameStateManager.isBonus ? 'bonus spin' : 'spin', 'sound effect for free spin simulation');
        }

        console.log('🎰 ===== SIMULATING FREE SPIN =====');
        console.log('📊 Using pre-determined free spin data');
        console.log('🎯 Current free spin index:', GameAPI.CURRENT_FREE_SPIN_INDEX);
        console.log('🎯 Spins left:', currentItem.spinsLeft);
        console.log('🎲 Area:', currentItem.area);

        // Create a new SpinData object for this free spin
        // Ensure bet is available (should be set in doSpin, but add fallback for safety)
        const betValue = this.currentSpinData.bet || '0';
        const freeSpinData: SpinData = {
            bet: betValue,
            slot: {
                area: currentItem.area,
                totalWin: currentItem.totalWin,
                freeSpin: {
                    multiplierValue: currentItem.multiplier,
                    items: freeSpinItems
                },
                tumbles: 
                {
                    items: currentItem.tumble.items,
                    multiplier: 
                    {
                        symbols: [],
                        total: currentItem.tumble.multiplier,
                    }
                }
            }
        };

        // Update the current spin data
        this.currentFreeSpinData = freeSpinData;
        
        // Increment the index for the next free spin
        GameAPI.CURRENT_FREE_SPIN_INDEX++;

        console.log('🎰 ===== FREE SPIN SIMULATION COMPLETE =====');
        console.log('📊 New SpinData:', freeSpinData);
        console.log('🎯 Remaining free spins:', freeSpinData.slot.freeSpin.items.length);
        console.log('🎯 Next free spin will use index:', GameAPI.CURRENT_FREE_SPIN_INDEX);
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
     * Set the current spin data externally (e.g. offline testing, console injection).
     * This is the backing data used by free spin simulation logic.
     */
    public setCurrentSpinData(
        spinData: SpinData | null,
        opts?: { resetFreeSpinIndex?: boolean; resetTumbleIndex?: boolean }
    ): void {
        this.currentSpinData = spinData;

        if (opts?.resetFreeSpinIndex) {
            this.resetFreeSpinIndex();
        }
        if (opts?.resetTumbleIndex) {
            this.resetCurrentTumbleIndex();
        }
    }

    /**
     * Reset the free spin index when starting a new scatter bonus
     * This should be called when a new scatter bonus is triggered
     */
    public resetFreeSpinIndex(): void {
        console.log('🎰 Resetting free spin index to 0');
        GameAPI.CURRENT_FREE_SPIN_INDEX = 0;
    }

    /**
     * Get the current free spin index
     * Returns the current free spin index
     */
    public getCurrentFreeSpinIndex(): number {
        return GameAPI.CURRENT_FREE_SPIN_INDEX;
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
        this.currentFreeSpinData = spinData;
        // simulateFreeSpin() reads from currentSpinData, so keep them in sync.
        this.setCurrentSpinData(spinData, { resetFreeSpinIndex: true , resetTumbleIndex: true });
    }
    
    /**
     * Get the current tumble index
     * Returns the current tumble index
     */
    public getCurrentTumbleIndex(): number {
        return GameAPI.CURRENT_TUMBLE_INDEX;
    }

    /**
     * Set the current tumble index
     * This method should be called when tumbles are triggered to provide the data for simulation
     */
    public incrementCurrentTumbleIndex(): void {
        console.log('[GameAPI] Incrementing current tumble index to:', GameAPI.CURRENT_TUMBLE_INDEX + 1);
        GameAPI.CURRENT_TUMBLE_INDEX++;
    }

    /**
     * Reset the current tumble index
     * This method should be called when tumbles are finished to reset the index
     */
    public resetCurrentTumbleIndex(): void {
        GameAPI.CURRENT_TUMBLE_INDEX = 0;
    }

    /**
     * Initialize the player's balance on game start
     * This method calls getBalance and updates the GameData with the current balance
     */
    public async initializeBalance(): Promise<number> {
        const isDemo = this.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
        if(isDemo) {
            return GameAPI.DEMO_BALANCE;
        }

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
        // Check if demo mode is active - don't make API call in demo mode
        const isDemo = this.getDemoState() || localStorage.getItem('demo') === 'true' || sessionStorage.getItem('demo') === 'true';
        if (isDemo) {
            // Return empty history data for demo mode
            return {
                data: [],
                meta: {
                    page: 1,
                    pageCount: 1,
                    totalPages: 1,
                    total: 0
                }
            };
        }

        const apiUrl = `${getApiBaseUrl()}/api/v1/games/me/histories`;
        const token = localStorage.getItem('token')
            || localStorage.getItem('token')
            || sessionStorage.getItem('token')
            || '';

        const response = await fetch(`${apiUrl}?limit=${limit}&page=${page}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        return data;
    }

    /**
     * Get the demo state from URL parameters
     * @returns The value of the 'demo' URL parameter, or false if not found
     */
    public getDemoState(): boolean | false {
        const demoValue = getUrlParameter('demo') === 'true';
        return demoValue;
    }

    /**
     * Get the game ID constant
     * @returns The game ID string
     */
    public getGameId(): string {
        return GameAPI.GAME_ID;
    }

    /**
     * Get the demo balance constant
     * @returns The demo balance number
     */
    public getDemoBalance(): number {
        return GameAPI.DEMO_BALANCE;
    }

    /**
     * Update the demo balance value
     * @param newBalance - The new balance value to set
     */
    public updateDemoBalance(newBalance: number): void {
        console.log(`[GameAPI] Demo balance updated from $${GameAPI.DEMO_BALANCE} to: $${newBalance}`);
        GameAPI.DEMO_BALANCE = newBalance;
    }
}   