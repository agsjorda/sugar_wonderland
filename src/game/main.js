import { Game as MainGame } from './scenes/Game';
import { AUTO, Game } from 'phaser';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
	type: AUTO,
	width: 1920,
	height: 1080,
	parent: 'game-container',
	backgroundColor: '#028af8',
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH
	},
	scene: [
			MainGame,
	],
	plugins: {
		scene: [
			{
				key: 'spine.SpinePlugin',
				plugin: SpinePlugin,
				mapping: 'spine'
			}
		]
	}
};

const StartGame = (parent) => {
	return new Game({ ...config, parent });
}

export default StartGame;

