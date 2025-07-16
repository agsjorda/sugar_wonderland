import StartGame from './game/main';

// Declare the callback function on window for font loading
declare global {
    interface Window {
        startGameWhenReady: () => void;
    }
}

let gameStarted = false;

const initializeGame = (): void => {
    if (gameStarted) return;
    gameStarted = true;
    
    console.log('Starting game...');
    StartGame('game-container');
};

// Set up the callback for when fonts are loaded
window.startGameWhenReady = initializeGame;

document.addEventListener('DOMContentLoaded', (): void => {
    // If WebFont hasn't called our callback within 5 seconds, start anyway
    setTimeout(() => {
        if (!gameStarted) {
            console.warn('Font loading timeout, starting game with fallback fonts');
            initializeGame();
        }
    }, 5000);
}); 