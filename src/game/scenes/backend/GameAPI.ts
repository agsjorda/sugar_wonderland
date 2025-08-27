import { Events } from "../components/Events";
import { GameData } from "../components/GameData";

const getApiBaseUrl = (): string => {
    const configuredUrl = (window as any)?.APP_CONFIG?.['game-url'];
    if (typeof configuredUrl === 'string' && configuredUrl.length > 0) {
        return configuredUrl.replace(/\/$/, "");
    }
    return 'https://game-launcher.torrospins.com'; // 192.168.0.17:3000/

};

export class GameAPI {  
    gameData: GameData;
    constructor(gameData: GameData) {
        this.gameData = gameData;
    }   

    private async generateGameUrlToken(): Promise<{url: string, token: string}> {
        const apiUrl = `${getApiBaseUrl()}/api/v1/generate_url`;
        
        const requestBody = {
            operator_id: "18b03717-33a7-46d6-9c70-acee80c54d03",
            bank_id: "1", 
            player_id: 2,
            casino_bank_id: "1",
            game_name: "SugarWonderland",
            device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? "mobile" : "desktop",
            lang: "en",
            currency: "USD", 
            quit_link: "www.quit.com",
            is_demo: 0,
            free_spin: "1",
            session: "zxc11asd1zxc",
            player_name: "test",
            modify_uid: "111"
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

    public async gameLauncher(): Promise<void> {
        try {
            console.log('Starting gameLauncher...');
            const {url, token} = await this.generateGameUrlToken();
            console.log('generateGameUrl response:', {url, token});
            localStorage.setItem('gameToken', token);
            //console.log('URL type:', typeof url, 'Token type:', typeof token);
            
            if (!url || !token) {
                console.error('URL or token is missing from API response');
                return;
            }
            
            localStorage.setItem('gameToken', token);
        } catch (error) {
            console.error('Error in gameLauncher:', error);
        }
    }
    public async getBalance(): Promise<any> {
        if(!localStorage.getItem('gameToken')){
            return {
                data: {
                    balance: 10000
                }
            }
        }

        return {
            data: {
                balance: 10000
            }
        }

        try{
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/balance`, {
            //const response = await fetch('http://192.168.0.17:3000/api/v1/slots/balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                },
                body: JSON.stringify({
                    action: 'get_balance',
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            this.gameData.debugError('Error in getBalance:', error);
            throw error;
        }
    }

    public async doSpin(bet: number, isBuyFs:boolean, isEnhancedBet:boolean): Promise<any> {
        console.log('[API] doSpin called. bet:', bet, 'isBuyFs:', isBuyFs, 'isEnhancedBet:', isEnhancedBet);
        if(!localStorage.getItem('gameToken')){
            return "error";
        }
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/v1/slots/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('gameToken')}`
                    //'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXNzaW9uIjoiZWZiNzlmNWMyZTVjZTk1MmM3OTg3YWUwYjBjZTU4ZjQ6MDUyMDA5NmIxNDVmNTExYzUwOTdlZDBhZmEzMTNmOGMiLCJjdXJyZW5jeSI6IlVTRCIsImxhbmciOiJlbiIsInBsYXllcl9pZCI6IjIiLCJvcGVyYXRvcl9pZCI6IjE4YjAzNzE3LTMzYTctNDZkNi05YzcwLWFjZWU4MGM1NGQwMyIsImdhbWVfbmFtZSI6IlN1Z2FyV29uZGVybGFuZCIsImlhdCI6MTc1NTUwMDM0NywiZXhwIjoxNzU1NTAzOTQ3fQ.PyitkzXtRFSpiasNkQO9OW-twSDPnJoE26_GMIadQm4`
                },
                body: JSON.stringify({
                    action: 'spin',
                    bet: bet.toString(),
                    line: 2,
                    isBuyFs: isBuyFs,
                    isEnhancedBet: isEnhancedBet
                })
            });

            if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (this.gameData.debugged < -99) {
            //const data = {"playerId":"2","bet":"10","slot":{"area":[[8,7,0,4,7],[8,8,9,4,7],[7,7,7,9,9],[8,8,8,8,0],[8,4,4,9,9],[5,5,7,6,6]],"totalWin":5447,"tumbles":[{"symbols":{"in":[[9],[9,8],[],[4,2,9,6],[7],[]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4},{"symbols":{"in":[[7,6,6],[6,0,6],[5,5,7,9,6],[9],[5,5,9],[4]],"out":[{"symbol":9,"count":8,"win":2.5},{"symbol":7,"count":8,"win":5}]},"win":7.5},{"symbols":{"in":[[8,8],[5,5],[7],[9],[],[9,6]],"out":[{"symbol":6,"count":8,"win":8}]},"win":8},{"symbols":{"in":[[],[9,8],[9,5],[],[7,9],[0,8]],"out":[{"symbol":5,"count":8,"win":10}]},"win":10},{"symbols":{"in":[[],[4],[8,5],[8,8],[8,5],[8]],"out":[{"symbol":9,"count":8,"win":2.5}]},"win":2.5},{"symbols":{"in":[[9,9],[0,6],[2],[8,8],[4],[9,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9},{"symbols":{"in":[[0],[4,6],[],[8],[6,6,8],[7,5]],"out":[{"symbol":4,"count":9,"win":10}]},"win":10}],"freeSpin":[{"spinsLeft":10,"area":[[6,6,7,7,7],[7,7,9,9,9],[7,7,5,5,8],[0,8,9,4,4],[7,0,9,4,4],[7,7,7,9,9]],"totalWin":105,"multipliers":[14],"tumbles":[{"symbols":{"in":[[7,6,6],[2,8],[1,14],[],[9],[6,9,9]],"out":[{"symbol":7,"count":11,"win":10}]},"win":10},{"symbols":{"in":[[],[7,8,8],[],[6],[8,9],[9,9,2,6]],"out":[{"symbol":9,"count":10,"win":7.5}]},"win":7.5}]},{"spinsLeft":9,"area":[[9,4,4,9,2],[8,8,2,0,7],[4,9,6,6,4],[8,8,8,8,5],[13,6,8,8,9],[2,8,8,3,9]],"totalWin":225,"multipliers":[13,13],"tumbles":[{"symbols":{"in":[[],[7,5],[],[6,6,7,4],[13,6],[4,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":8,"area":[[9,8,9,6,6],[5,6,8,8,7],[9,6,6,4,7],[6,3,3,6,6],[7,9,9,3,3],[5,5,7,6,6]],"totalWin":12,"multipliers":[],"tumbles":[{"symbols":{"in":[[5,5],[8],[2,6],[7,9,9],[],[7,7]],"out":[{"symbol":6,"count":10,"win":12}]},"win":12}]},{"spinsLeft":7,"area":[[7,7,7,8,8],[7,9,9,9,3],[3,3,14,1,6],[8,8,8,5,9],[9,6,6,5,5],[6,1,9,5,5]],"totalWin":0,"multipliers":[14],"tumbles":[]},{"spinsLeft":6,"area":[[8,3,4,9,4],[3,7,5,5,8],[6,2,8,8,5],[5,7,7,9,9],[9,9,8,8,4],[6,6,4,4,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":5,"area":[[9,5,7,6,8],[7,5,5,8,8],[9,6,6,4,7],[8,8,5,9,6],[5,2,9,6,6],[7,8,8,9,15]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":4,"area":[[5,7,6,8,8],[5,5,8,8,2],[5,5,7,7,8],[3,6,6,6,9],[3,3,6,1,9],[9,8,8,6,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":3,"area":[[7,8,8,7,4],[3,9,5,5,7],[8,5,5,7,7],[3,3,6,3,3],[9,6,6,7,6],[5,7,6,2,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":2,"area":[[9,8,9,6,6],[7,9,5,5,6],[4,7,7,7,5],[1,3,3,6,3],[8,9,7,7,9],[3,9,9,5,5]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[8,7,4,7,7],[6,6,9,9,4],[8,9,7,7,9],[5,5,8,8,2],[5,2,9,6,6],[6,7,7,7,9]],"totalWin":5,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,5,5],[],[5,5],[],[],[8,8,9]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5}]}]}};
               
                const data = await response.json();
                if(data.statusCode == 400){
                    Events.emitter.emit(Events.SESSION_TIMEOUT, {});
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[API] doSpin response data:', data);
            return data;

        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}   