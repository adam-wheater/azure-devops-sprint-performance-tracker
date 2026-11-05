// Mock for azure-devops-extension-sdk
const mockServices: Record<string, any> = {};
let mockUser = {
  id: "test-user-id",
  name: "test@example.com",
  displayName: "Test User",
};

export function init() {
  return Promise.resolve();
}

export function ready() {
  return Promise.resolve();
}

export function getUser() {
  return mockUser;
}

export function getAccessToken() {
  return Promise.resolve("mock-token");
}

export function getExtensionContext() {
  return { id: "mock-extension-id" };
}

export function getService<T>(serviceId: string): Promise<T> {
  return Promise.resolve((mockServices[serviceId] ?? {}) as T);
}

export function notifyLoadSucceeded() {
  return Promise.resolve();
}

// Test helpers
export function __setMockService(serviceId: string, service: any): void {
  mockServices[serviceId] = service;
}

export function __setMockUser(user: Partial<typeof mockUser>): void {
  mockUser = { ...mockUser, ...user };
}

export function __resetMockServices(): void {
  for (const key of Object.keys(mockServices)) {
    delete mockServices[key];
  }
}
