import { State } from './state';

export class StateMachine {
	state = undefined;

	constructor() {		
		this.state = undefined;
	}

	setState(state, scene) {
		if (this.state != undefined) {
			this.state.end();
		}
		this.state = state;
		this.state.stateMachine = this;
		this.state.start(scene);
	}

	update(scene, time, delta) {
		if (this.state != undefined) {
			this.state.update(scene, time, delta);
		}
	}

}