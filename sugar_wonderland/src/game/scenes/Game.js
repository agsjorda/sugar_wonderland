import { Scene } from 'phaser';
import { StateMachine } from '../fsm/statemachine';
import { Background } from './components/Background';
import { SlotMachine } from './components/SlotMachine';
import { GameData } from './components/GameData';
import { StartState } from './components/StartState';
import { Character } from '../ui/Character';
import { Buttons } from '../ui/Buttons';
import { WinLines } from '../ui/Winlines';
import { Cheat } from './components/Cheat';
import { AudioManager } from './components/AudioManager';	
import { Autoplay } from './components/Autoplay';
export class Game extends Scene
{
	stateMachine = new StateMachine();
	gameData = new GameData();
	background = new Background();
	slotMachine = new SlotMachine();
	character = new Character();
	buttons = new Buttons();
	winLines = new WinLines();
	cheat = new Cheat();
	audioManager = new AudioManager();
	autoplay = new Autoplay();
	constructor ()
	{
		super('Game');
	}

	preload ()
	{
		this.background.preload(this)
		this.slotMachine.preload(this)
		this.character.preload(this);
		this.buttons.preload(this);
		this.winLines.preload(this);
		this.cheat.preload(this);
		this.audioManager.preload(this);
		this.autoplay.preload(this);
	}
	
	create ()
	{
		this.stateMachine.setState(new StartState(), this);

		this.background.create(this)
		this.slotMachine.create(this)
		this.character.create(this);
		this.buttons.create(this);
		this.winLines.create(this);
		this.cheat.create(this);
		this.audioManager.create(this);
		this.autoplay.create(this);
	}

	update(time, delta) {
		this.stateMachine.update(this, time, delta);
		this.background.update(this, time, delta);
		this.slotMachine.update(this, time, delta);
		this.buttons.update(this, time, delta);
		this.winLines.update(this, time, delta);
		this.cheat.update(this, time, delta);
		this.audioManager.update(this, time, delta);
		this.autoplay.update(this, time, delta);
	}

}
