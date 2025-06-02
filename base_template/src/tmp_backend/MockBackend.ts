
export class MockBackend {
  private static instance: MockBackend;

  private constructor() {
    this.instance = new MockBackend();
  }

  private static getInstance(): MockBackend {
    if (!MockBackend.instance) {
      MockBackend.instance = new MockBackend();
    }
    return MockBackend.instance;
  }

  public static init(): void {
    console.log('MockBackend.init()');
    let backend = MockBackend.getInstance();
    
    // Implement backend logic here
    
  }
  
  
}

