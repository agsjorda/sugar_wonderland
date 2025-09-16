import { Events } from 'phaser';

export class EventManager {
  private static instance: EventManager;
  private eventEmitter: Events.EventEmitter;

  private constructor() {
    this.eventEmitter = new Events.EventEmitter();
  }

  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  public static getEmitter(): Events.EventEmitter {
    return EventManager.getInstance().eventEmitter;
  }

  public static on(event: GameEvents, callback: (...args: any[]) => void): void {
    EventManager.getEmitter().on(event, callback);
  }

  public static emit(event: GameEvents, ...args: any[]): void {
    EventManager.getEmitter().emit(event, ...args);
  }

  public static off(event: GameEvents, callback: (...args: any[]) => void): void {
    EventManager.getEmitter().off(event, callback);
  }

  public static once(event: GameEvents, callback: (...args: any[]) => void): void {
    EventManager.getEmitter().once(event, callback);
  }

  public static removeAllListeners(event: GameEvents): void {
    EventManager.getEmitter().removeAllListeners(event);
  }

  public static clear(): void {
    for (const event of Object.values(GameEvents)) {
      EventManager.getEmitter().removeAllListeners(event);
    }
  }
}

export enum GameEvents {
  REEL_DONE = 'REEL_DONE',
  SPIN_DONE = 'SPIN_DONE',
}
