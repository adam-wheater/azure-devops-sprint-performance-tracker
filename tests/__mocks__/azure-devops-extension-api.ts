// Mock for azure-devops-extension-api and all its subpaths
// The moduleNameMapper redirects all "azure-devops-extension-api*" here

const mockClients: Record<string, any> = {};

// CommonServiceIds stub — tests can check which service ID was requested
export const CommonServiceIds = {
  ProjectPageService: "ms.vss-tfs-web.tfs-page-data-service",
  ExtensionDataService: "ms.vss-features.extension-data-service",
};

// Stub client classes that services import from subpaths
// Services do: import { CoreRestClient } from "azure-devops-extension-api/Core"
// Then call: getClient(CoreRestClient) — so clientClass will be one of these stubs
export class CoreRestClient {
  static _mockName = "CoreRestClient";
}

export class WorkRestClient {
  static _mockName = "WorkRestClient";
}

export class WorkItemTrackingRestClient {
  static _mockName = "WorkItemTrackingRestClient";
}

export class GitRestClient {
  static _mockName = "GitRestClient";
}

export class BuildRestClient {
  static _mockName = "BuildRestClient";
}

// Search criteria shapes used by the Git client — structural only.
export interface GitQueryCommitsCriteria {
  [key: string]: unknown;
}

export interface GitPullRequestSearchCriteria {
  [key: string]: unknown;
}

// Also export as named interface so subpath imports work
// e.g. import { TeamContext } from "azure-devops-extension-api/Core"
export interface TeamContext {
  projectId: string;
  project: string;
  teamId: string;
  team: string;
}

export function getClient(clientClass: any): any {
  if (!clientClass) return {};
  const name = clientClass._mockName || clientClass.name || "unknown";
  if (!mockClients[name]) {
    mockClients[name] = {};
  }
  return mockClients[name];
}

// Test helpers to configure mock methods
export function __setMockClient(name: string, client: any): void {
  mockClients[name] = client;
}

export function __resetMockClients(): void {
  for (const key of Object.keys(mockClients)) {
    delete mockClients[key];
  }
}
