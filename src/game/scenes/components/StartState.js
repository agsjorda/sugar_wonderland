import { State } from "../../fsm/state";
import { IdleState } from "./IdleState";


export class StartState extends State {
	start(scene) {
		setTimeout(() => {
			this.stateMachine.setState(new IdleState(), scene);
		}, 100);
	}

	update(scene, time, delta) {
		// console.log("Update")
	}

	end() {
	}
}



/**
 * TODO
 * 	Make the core game work
 * 		
 * 	Animation later
 * 
 */