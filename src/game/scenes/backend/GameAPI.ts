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
                if(this.gameData.debugged == -100){
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0]],"totalWin":123456789.01,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[9,4,4,9,2],[8,8,2,0,7],[4,9,6,6,4],[8,8,8,8,0],[13,6,8,8,9],[2,8,8,3,9]],"totalWin":0,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[7,1],[],[6,6,7,1],[13,6],[4,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":14,"area":[[5,6,7,8,0],[5,6,7,8,0],[5,6,7,8,0],[9,9,9,9,0],[9,2,9,1,0],[5,6,7,8,0]],"totalWin":225,"multipliers":[13,13],"tumbles":[]},{"spinsLeft":8,"area":[[9,8,9,6,6],[5,6,8,8,7],[9,6,6,4,7],[6,3,3,6,6],[7,9,9,3,3],[5,5,7,6,6]],"totalWin":12,"multipliers":[],"tumbles":[{"symbols":{"in":[[5,5],[8],[2,6],[7,9,9],[],[7,7]],"out":[{"symbol":6,"count":10,"win":12}]},"win":12}]},{"spinsLeft":7,"area":[[7,7,7,8,8],[7,9,9,9,3],[3,3,14,1,6],[8,8,8,5,9],[9,6,6,5,5],[6,1,9,5,5]],"totalWin":0,"multipliers":[14],"tumbles":[]},{"spinsLeft":6,"area":[[8,3,4,9,4],[3,7,5,5,8],[6,2,8,8,5],[5,7,7,9,9],[9,9,8,8,4],[6,6,4,4,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":5,"area":[[9,5,7,6,8],[7,5,5,8,8],[9,6,6,4,7],[8,8,5,9,6],[5,2,9,6,6],[7,8,8,9,15]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":4,"area":[[5,7,6,8,8],[5,5,8,8,2],[5,5,7,7,8],[3,6,6,6,9],[3,3,6,1,9],[9,8,8,6,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":3,"area":[[7,8,8,7,4],[3,9,5,5,7],[8,5,5,7,7],[3,3,6,3,3],[9,6,6,7,6],[5,7,6,2,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":2,"area":[[9,8,9,6,6],[7,9,5,5,6],[4,7,7,7,5],[1,3,3,6,3],[8,9,7,7,9],[3,9,9,5,5]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[8,7,4,7,7],[6,6,9,9,4],[8,9,7,7,9],[5,5,8,8,2],[5,2,9,6,6],[6,7,7,7,9]],"totalWin":5,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,5,5],[],[5,5],[],[],[8,8,9]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -101){
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0]],"totalWin":541,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0],[1,2,3,4,0]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":14,"area":[[9,4,4,9,2],[8,8,2,0,7],[4,9,6,6,4],[8,8,8,8,0],[13,6,8,8,9],[2,8,8,3,9]],"totalWin":225,"multipliers":[13,13],"tumbles":[{"symbols":{"in":[[],[7,0],[],[6,6,7,0],[13,6],[4,4]],"out":[{"symbol":8,"count":10,"win":9}]},"win":9}]},{"spinsLeft":8,"area":[[9,8,9,6,6],[5,6,8,8,7],[9,6,6,4,7],[6,3,3,6,6],[7,9,9,3,3],[5,5,7,6,6]],"totalWin":12,"multipliers":[],"tumbles":[{"symbols":{"in":[[5,5],[8],[2,6],[7,9,9],[],[7,7]],"out":[{"symbol":6,"count":10,"win":12}]},"win":12}]},{"spinsLeft":7,"area":[[7,7,7,8,8],[7,9,9,9,3],[3,3,14,1,6],[8,8,8,5,9],[9,6,6,5,5],[6,1,9,5,5]],"totalWin":0,"multipliers":[14],"tumbles":[]},{"spinsLeft":6,"area":[[8,3,4,9,4],[3,7,5,5,8],[6,2,8,8,5],[5,7,7,9,9],[9,9,8,8,4],[6,6,4,4,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":5,"area":[[9,5,7,6,8],[7,5,5,8,8],[9,6,6,4,7],[8,8,5,9,6],[5,2,9,6,6],[7,8,8,9,15]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":4,"area":[[5,7,6,8,8],[5,5,8,8,2],[5,5,7,7,8],[3,6,6,6,9],[3,3,6,1,9],[9,8,8,6,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":3,"area":[[7,8,8,7,4],[3,9,5,5,7],[8,5,5,7,7],[3,3,6,3,3],[9,6,6,7,6],[5,7,6,2,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":2,"area":[[9,8,9,6,6],[7,9,5,5,6],[4,7,7,7,5],[1,3,3,6,3],[8,9,7,7,9],[3,9,9,5,5]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[8,7,4,7,7],[6,6,9,9,4],[8,9,7,7,9],[5,5,8,8,2],[5,2,9,6,6],[6,7,7,7,9]],"totalWin":5,"multipliers":[],"tumbles":[{"symbols":{"in":[[7,5,5],[],[5,5],[],[],[8,8,9]],"out":[{"symbol":7,"count":8,"win":5}]},"win":5}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -102){
                    const data = {"playerId":"2","bet":"10","slot":{"area":[[4,1,0,3,2],[0,8,5,7,6],[9,1,2,9,3],[1,2,3,9,4],[5,6,7,0,8],[2,9,1,0,3]],"totalWin":159.5,"tumbles":[],"freeSpin":[{"spinsLeft":10,"area":[[11,7,7,9,9],[1,3,10,3,9],[8,8,9,7,7],[6,6,9,9,8],[2,3,7,0,9],[7,9,9,8,8]],"totalWin":97.5,"multipliers":[10,11],"tumbles":[{"symbols":{"in":[[7,7],[3],[6],[6,6],[6],[6,6]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[8,8,6,7],[],[8,3,6],[4,5,2,8],[2,5],[2,6,4]],"out":[{"symbol":7,"count":8,"win":5},{"symbol":6,"count":8,"win":8}]},"win":13},{"symbols":{"in":[[7,9],[],[9,8,8],[8,9],[],[3,4]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4}]},{"spinsLeft":9,"area":[[7,6,8,8,9],[9,1,8,8,2],[6,7,6,3,8],[7,7,9,9,7],[8,8,6,6,13],[7,6,2,9,9]],"totalWin":0,"multipliers":[13],"tumbles":[]},{"spinsLeft":8,"area":[[9,11,7,7,9],[9,4,4,1,3],[6,7,6,3,8],[3,3,6,3,3],[8,4,4,9,9],[6,2,8,8,3]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":7,"area":[[5,7,6,8,8],[7,9,9,9,3],[9,6,9,7,5],[4,9,9,8,5],[8,9,5,2,9],[6,7,7,7,9]],"totalWin":43,"multipliers":[10],"tumbles":[{"symbols":{"in":[[],[8,5,5],[8,8],[8,5],[4,8],[9]],"out":[{"symbol":9,"count":10,"win":7.5}]},"win":7.5},{"symbols":{"in":[[8,8],[9],[9,5],[9,9],[8,6],[]],"out":[{"symbol":8,"count":9,"win":4}]},"win":4},{"symbols":{"in":[[7],[3,10],[2,6],[6,6],[0],[]],"out":[{"symbol":5,"count":8,"win":10}]},"win":10}]},{"spinsLeft":6,"area":[[8,9,11,7,7],[0,7,7,9,9],[9,0,2,4,4],[8,5,5,6,6],[9,9,5,5,4],[8,8,4,4,4]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":5,"area":[[7,7,7,6,2],[8,2,6,6,6],[7,8,8,9,3],[8,2,5,4,6],[5,5,4,7,7],[7,6,2,9,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":4,"area":[[8,8,3,4,9],[8,8,9,4,7],[4,4,9,9,7],[4,7,6,6,6],[5,5,4,7,7],[8,9,15,7,9]],"totalWin":0,"multipliers":[15],"tumbles":[]},{"spinsLeft":3,"area":[[4,1,3,3,9],[9,8,8,9,4],[9,9,0,2,4],[6,6,9,9,9],[7,7,7,8,8],[7,7,8,8,9]],"totalWin":6.5,"multipliers":[],"tumbles":[{"symbols":{"in":[[2],[8,8],[9,5],[4,4,9],[],[4]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5},{"symbols":{"in":[[],[0,2,8,8],[],[],[7,9],[9,9]],"out":[{"symbol":8,"count":8,"win":4}]},"win":4}]},{"spinsLeft":2,"area":[[5,7,6,8,8],[9,1,8,8,2],[5,7,7,7,9],[8,8,7,5,5],[3,3,6,1,9],[6,6,4,4,4]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[3,4,9,4,4],[9,5,5,7,7],[6,4,4,9,9],[9,9,9,8,8],[8,6,6,13,6],[9,8,8,6,9]],"totalWin":12.5,"multipliers":[13],"tumbles":[{"symbols":{"in":[[2],[6],[8,2],[6,4,5],[],[5,5]],"out":[{"symbol":9,"count":9,"win":2.5}]},"win":2.5}]}]}};
                    return data;
                }
                else if (this.gameData.debugged == -103){
                    const data = {"playerId":"2","bet":"100","slot":{"area":[[9,8,8,4,4],[5,4,4,9,9],[4,4,9,6,6],[8,8,8,8,0],[9,6,6,7,6],[9,8,8,0,6]],"totalWin":29665,"tumbles":[{"symbols":{"in":[[2,6],[],[],[4,9,8,0],[],[6,0]],"out":[{"symbol":8,"count":8,"win":40}]},"win":40},{"symbols":{"in":[[9],[],[7,7],[],[4,8,8],[6,9]],"out":[{"symbol":6,"count":8,"win":80}]},"win":80},{"symbols":{"in":[[7,9,8,8],[8,8,5,5],[4,2,0],[8,8],[0,7],[9,9]],"out":[{"symbol":9,"count":9,"win":25},{"symbol":4,"count":8,"win":100}]},"win":125},{"symbols":{"in":[[9,6],[5,7],[],[8,9,9],[1,5],[]],"out":[{"symbol":8,"count":9,"win":40}]},"win":40}],"freeSpin":[{"spinsLeft":10,"area":[[8,9,11,7,7],[1,8,8,2,0],[8,8,9,3,3],[8,5,9,6,5],[5,1,2,3,7],[8,4,4,4,3]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":9,"area":[[2,7,8,8,8],[5,8,8,2,6],[9,7,5,5,9],[6,6,9,9,9],[9,4,4,9,9],[7,7,7,9,9]],"totalWin":75,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[],[9,7],[9,9,6],[5,5,9],[6,8]],"out":[{"symbol":9,"count":10,"win":75}]},"win":75}]},{"spinsLeft":8,"area":[[3,3,9,5,5],[3,9,5,5,7],[3,8,8,5,5],[7,6,6,6,9],[8,8,9,7,7],[5,7,7,8,8]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":7,"area":[[9,8,8,4,4],[5,6,8,8,7],[4,4,9,6,6],[5,9,6,5,5],[9,9,8,8,4],[6,5,7,6,2]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":6,"area":[[4,7,7,7,6],[4,7,9,5,5],[5,7,7,8,8],[7,9,9,7,0],[7,0,9,4,4],[5,5,7,7,8]],"totalWin":100,"multipliers":[],"tumbles":[{"symbols":{"in":[[8,7,2],[1],[9,7],[5,8],[0],[7,6]],"out":[{"symbol":7,"count":11,"win":100}]},"win":100}]},{"spinsLeft":10,"area":[[7,7,9,9,8],[5,6,8,8,7],[5,5,9,6,6],[9,7,0,8,9],[3,7,0,9,4],[6,5,7,6,2]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":9,"area":[[6,7,7,7,8],[5,5,6,8,8],[9,9,7,8,8],[8,8,2,5,4],[3,3,6,1,9],[8,8,6,5,7]],"totalWin":40,"multipliers":[],"tumbles":[{"symbols":{"in":[[4],[7,3],[8,2],[5,5],[],[8,9]],"out":[{"symbol":8,"count":9,"win":40}]},"win":40}]},{"spinsLeft":8,"area":[[6,7,7,7,8],[5,8,8,2,6],[7,7,7,9,9],[9,4,4,9,9],[8,4,4,9,9],[6,1,9,5,5]],"totalWin":100,"multipliers":[12],"tumbles":[{"symbols":{"in":[[],[],[7,9],[9,12,6],[1,5],[4]],"out":[{"symbol":9,"count":8,"win":25}]},"win":25}]},{"spinsLeft":7,"area":[[7,6,6,9,5],[7,9,9,5,4],[8,8,5,5,7],[9,4,4,9,9],[9,9,8,8,4],[7,9,9,8,8]],"totalWin":115,"multipliers":[],"tumbles":[{"symbols":{"in":[[7],[8,8],[],[8,9,9],[1,5],[4,6]],"out":[{"symbol":9,"count":10,"win":75}]},"win":75},{"symbols":{"in":[[],[5,5],[6,1],[4],[9,8],[8,8]],"out":[{"symbol":8,"count":9,"win":40}]},"win":40}]},{"spinsLeft":6,"area":[[6,7,7,7,8],[8,9,6,4,6],[8,8,9,9,6],[6,9,9,8,8],[6,6,5,5,1],[6,4,4,4,6]],"totalWin":420,"multipliers":[12],"tumbles":[{"symbols":{"in":[[7],[0,2],[5],[12],[9,1],[9,9]],"out":[{"symbol":6,"count":9,"win":80}]},"win":80},{"symbols":{"in":[[],[6],[6,9],[6,4],[4],[5,9]],"out":[{"symbol":9,"count":8,"win":25}]},"win":25}]},{"spinsLeft":5,"area":[[8,8,8,5,5],[2,0,7,7,9],[3,3,3,14,1],[2,5,4,6,12],[0,9,4,4,9],[7,6,6,4,4]],"totalWin":0,"multipliers":[14,12],"tumbles":[]},{"spinsLeft":4,"area":[[9,2,7,8,8],[7,7,9,9,9],[5,5,8,8,9],[6,9,9,1,3],[9,3,3,6,1],[9,5,5,7,6]],"totalWin":50,"multipliers":[10],"tumbles":[{"symbols":{"in":[[7],[9,3,10],[9],[5,8],[5],[4]],"out":[{"symbol":9,"count":9,"win":25}]},"win":25}]},{"spinsLeft":3,"area":[[8,9,11,7,7],[6,6,9,9,4],[5,8,8,9,7],[5,7,7,9,9],[7,7,8,8,9],[4,4,4,3,3]],"totalWin":0,"multipliers":[11],"tumbles":[]},{"spinsLeft":2,"area":[[7,8,8,7,4],[8,9,6,4,6],[7,9,6,7,6],[8,8,2,5,4],[5,8,8,9,7],[4,3,3,9,9]],"totalWin":0,"multipliers":[],"tumbles":[]},{"spinsLeft":1,"area":[[8,8,4,4,1],[5,7,7,8,8],[9,6,9,7,5],[5,5,7,7,9],[9,4,4,9,9],[2,9,9,8,8]],"totalWin":265,"multipliers":[],"tumbles":[{"symbols":{"in":[[],[],[6,6],[4],[9,7,7],[7,5]],"out":[{"symbol":9,"count":8,"win":25}]},"win":25},{"symbols":{"in":[[],[4,4],[4],[8,8],[8,8],[8]],"out":[{"symbol":7,"count":8,"win":50}]},"win":50},{"symbols":{"in":[[4,9,4,3],[6,6,6,2],[9],[8,5,5],[8,8,9,9],[6,9,9]],"out":[{"symbol":8,"count":11,"win":90},{"symbol":4,"count":8,"win":100}]},"win":190}]}]}};
                    return data;
                }
                
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