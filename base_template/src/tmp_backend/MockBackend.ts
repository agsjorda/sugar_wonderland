
export class MockBackend {
  private static instance: MockBackend;

  private constructor() {
    this.instance = new MockBackend();
  }

  public static getInstance(): MockBackend {
    return this.instance;
  }

  public init(): void {
    console.log('MockBackend.init()');
  }
  
  
}

