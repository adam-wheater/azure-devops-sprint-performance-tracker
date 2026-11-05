import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from "azure-devops-extension-api";
import {
  AccessControlDocument,
  AccessControlUser,
  ThresholdSettings,
  DEFAULT_THRESHOLDS,
} from "../models/interfaces";
import { UserRole } from "../models/enums";
import {
  ACCESS_CONTROL_COLLECTION,
  ACCESS_CONTROL_DOC_ID,
  ACCESS_CONTROL_VERSION,
} from "../utils/constants";

/** TTL for cached data manager (45 minutes). SDK tokens typically expire after 1 hour. */
const DATA_MANAGER_TTL_MS = 45 * 60 * 1000;

interface ExtensionDataErrorShape {
  status?: number;
  statusCode?: number;
  httpStatusCode?: number;
  message?: string;
  serverError?: { message?: string };
  result?: { message?: string };
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as ExtensionDataErrorShape;
  return candidate.status ?? candidate.statusCode ?? candidate.httpStatusCode ?? null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as ExtensionDataErrorShape;
    if (candidate.message) {
      return candidate.message;
    }

    if (candidate.serverError?.message) {
      return candidate.serverError.message;
    }

    if (candidate.result?.message) {
      return candidate.result.message;
    }
  }

  return String(error);
}

function isDocumentNotFoundError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 404) {
    return true;
  }

  return /not found/i.test(getErrorMessage(error));
}

function formatStorageError(error: unknown): string {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if (status === 401 || status === 403) {
    return `Extension data access was denied (${status}). Ensure the extension requests and has been granted extension data scopes.`;
  }

  if (status != null) {
    return `${message} (${status})`;
  }

  return message;
}

export class AccessControlService {
  private dataManagerPromise: Promise<IExtensionDataManager> | null = null;
  private dataManagerCreatedAt: number = 0;

  private async getDataManager(): Promise<IExtensionDataManager> {
    const now = Date.now();
    if (this.dataManagerPromise && now - this.dataManagerCreatedAt < DATA_MANAGER_TTL_MS) {
      return this.dataManagerPromise;
    }
    // Invalidate stale cache and create a new manager
    this.dataManagerCreatedAt = now;
    this.dataManagerPromise = (async () => {
      const service = await SDK.getService<IExtensionDataService>(
        CommonServiceIds.ExtensionDataService
      );
      const accessToken = await SDK.getAccessToken();
      return service.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
    })();
    return this.dataManagerPromise;
  }

  private createSeedDocument(): AccessControlDocument {
    const user = SDK.getUser();
    const email = (user.name || "").toLowerCase();
    const displayName = user.displayName || user.name || "";

    return {
      id: ACCESS_CONTROL_DOC_ID,
      users: [
        {
          email,
          displayName,
          role: UserRole.Admin,
          addedBy: "system",
          addedAt: new Date().toISOString(),
        },
      ],
      version: ACCESS_CONTROL_VERSION,
    };
  }

  async getAccessControlDocument(): Promise<AccessControlDocument> {
    const manager = await this.getDataManager();
    try {
      const doc = await manager.getDocument(ACCESS_CONTROL_COLLECTION, ACCESS_CONTROL_DOC_ID);
      return doc as AccessControlDocument;
    } catch (getErr) {
      if (!isDocumentNotFoundError(getErr)) {
        throw new Error(`Failed to load access control document: ${formatStorageError(getErr)}`);
      }

      // Document doesn't exist yet — create the seed
      const seed = this.createSeedDocument();
      try {
        await manager.setDocument(ACCESS_CONTROL_COLLECTION, seed);
      } catch (seedErr) {
        throw new Error(
          `Failed to create initial access control document: ${formatStorageError(seedErr)}`
        );
      }
      return seed;
    }
  }

  async isUserAuthorized(
    email: string
  ): Promise<{ authorized: boolean; role: UserRole | null; allowedTeamIds: string[] }> {
    const doc = await this.getAccessControlDocument();
    const normalizedEmail = email.toLowerCase();
    const user = doc.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (user) {
      return {
        authorized: true,
        role: user.role,
        allowedTeamIds: user.allowedTeamIds || [],
      };
    }
    return { authorized: false, role: null, allowedTeamIds: [] };
  }

  async addUser(
    email: string,
    displayName: string,
    role: UserRole,
    addedBy: string,
    allowedTeamIds?: string[]
  ): Promise<AccessControlDocument> {
    const doc = await this.getAccessControlDocument();
    const normalizedEmail = email.toLowerCase();

    const exists = doc.users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      throw new Error(`User ${email} already has access.`);
    }

    const newUser: AccessControlUser = {
      email: normalizedEmail,
      displayName,
      role,
      addedBy,
      addedAt: new Date().toISOString(),
    };
    if (allowedTeamIds && allowedTeamIds.length > 0) {
      newUser.allowedTeamIds = allowedTeamIds;
    }

    doc.users.push(newUser);
    const manager = await this.getDataManager();
    await manager.setDocument(ACCESS_CONTROL_COLLECTION, doc);
    return doc;
  }

  async removeUser(email: string): Promise<AccessControlDocument> {
    const doc = await this.getAccessControlDocument();
    const normalizedEmail = email.toLowerCase();

    const index = doc.users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);
    if (index === -1) {
      throw new Error(`User ${email} not found.`);
    }

    const user = doc.users[index];
    if (user.role === UserRole.Admin) {
      const adminCount = doc.users.filter((u) => u.role === UserRole.Admin).length;
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last admin. Promote another user to admin first.");
      }
    }

    doc.users.splice(index, 1);
    const manager = await this.getDataManager();
    await manager.setDocument(ACCESS_CONTROL_COLLECTION, doc);
    return doc;
  }

  async updateUserRole(email: string, newRole: UserRole): Promise<AccessControlDocument> {
    const doc = await this.getAccessControlDocument();
    const normalizedEmail = email.toLowerCase();

    const user = doc.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      throw new Error(`User ${email} not found.`);
    }

    if (user.role === UserRole.Admin && newRole !== UserRole.Admin) {
      const adminCount = doc.users.filter((u) => u.role === UserRole.Admin).length;
      if (adminCount <= 1) {
        throw new Error("Cannot demote the last admin. Promote another user to admin first.");
      }
    }

    user.role = newRole;
    const manager = await this.getDataManager();
    await manager.setDocument(ACCESS_CONTROL_COLLECTION, doc);
    return doc;
  }

  async updateUserTeams(email: string, teamIds: string[]): Promise<AccessControlDocument> {
    const doc = await this.getAccessControlDocument();
    const normalizedEmail = email.toLowerCase();

    const user = doc.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      throw new Error(`User ${email} not found.`);
    }

    user.allowedTeamIds = teamIds.length > 0 ? teamIds : undefined;
    const manager = await this.getDataManager();
    await manager.setDocument(ACCESS_CONTROL_COLLECTION, doc);
    return doc;
  }

  async getThresholds(): Promise<ThresholdSettings> {
    const doc = await this.getAccessControlDocument();
    return { ...DEFAULT_THRESHOLDS, ...doc.thresholds };
  }

  async updateThresholds(thresholds: ThresholdSettings): Promise<ThresholdSettings> {
    const doc = await this.getAccessControlDocument();
    doc.thresholds = thresholds;
    const manager = await this.getDataManager();
    await manager.setDocument(ACCESS_CONTROL_COLLECTION, doc);
    return thresholds;
  }
}
