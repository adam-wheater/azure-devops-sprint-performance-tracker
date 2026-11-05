import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from "azure-devops-extension-api";

const PREFERENCES_COLLECTION = "SprintPerfTrackerUserPrefs";
const PREFERENCES_DOC_ID = "user-preferences";

export interface UserPreferences {
  selectedTeamIds?: string[];
  lookback?: number;
}

export class UserPreferencesService {
  private dataManagerPromise: Promise<IExtensionDataManager> | null = null;

  private async getDataManager(): Promise<IExtensionDataManager> {
    if (!this.dataManagerPromise) {
      this.dataManagerPromise = (async () => {
        const service = await SDK.getService<IExtensionDataService>(
          CommonServiceIds.ExtensionDataService
        );
        const accessToken = await SDK.getAccessToken();
        return service.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
      })();
    }
    return this.dataManagerPromise;
  }

  async loadPreferences(): Promise<UserPreferences> {
    try {
      const manager = await this.getDataManager();
      const doc = await manager.getDocument(PREFERENCES_COLLECTION, PREFERENCES_DOC_ID, {
        scopeType: "User" as any,
      });
      return (doc as UserPreferences) || {};
    } catch {
      // No document yet — return defaults
      return {};
    }
  }

  async savePreferences(prefs: UserPreferences): Promise<void> {
    try {
      const manager = await this.getDataManager();
      await manager.setDocument(
        PREFERENCES_COLLECTION,
        { id: PREFERENCES_DOC_ID, ...prefs },
        { scopeType: "User" as any }
      );
    } catch {
      // Persistence is best-effort — don't block the user
      console.warn("UserPreferencesService: Failed to save preferences.");
    }
  }
}
