import { UserRole } from "@/models/enums";
import { DEFAULT_THRESHOLDS } from "@/models/interfaces";
import { ACCESS_CONTROL_COLLECTION, ACCESS_CONTROL_DOC_ID } from "@/utils/constants";

// The seed admin is now derived from SDK.getUser() — define test values here
const SEED_ADMIN_EMAIL = "testuser@example.com";
const SEED_ADMIN_DISPLAY_NAME = "Test User";

// In-memory document store for the mock data manager
let documentStore: Record<string, Record<string, any>> = {};

const mockDataManager = {
  getDocument: jest.fn(async (collection: string, id: string) => {
    const col = documentStore[collection];
    if (!col || !col[id]) {
      throw new Error("Document not found");
    }
    return JSON.parse(JSON.stringify(col[id]));
  }),
  setDocument: jest.fn(async (collection: string, doc: any) => {
    if (!documentStore[collection]) {
      documentStore[collection] = {};
    }
    documentStore[collection][doc.id] = JSON.parse(JSON.stringify(doc));
    return doc;
  }),
};

// Mock the SDK — must be declared before jest.mock since jest.mock is hoisted
// but references to jest.fn() inside the factory are fine
jest.mock("azure-devops-extension-sdk", () => ({
  getService: jest.fn().mockResolvedValue({
    getExtensionDataManager: jest.fn().mockResolvedValue(mockDataManager),
  }),
  getExtensionContext: jest.fn().mockReturnValue({ id: "test-extension-id" }),
  getAccessToken: jest.fn().mockResolvedValue("mock-access-token"),
  getUser: jest.fn().mockReturnValue({
    id: "test-user-id",
    name: SEED_ADMIN_EMAIL,
    displayName: SEED_ADMIN_DISPLAY_NAME,
  }),
}));

// Import after mocks are set up
import { AccessControlService } from "@/services/AccessControlService";

beforeEach(() => {
  documentStore = {};
  // Clear call counts but keep implementations
  mockDataManager.getDocument.mockClear();
  mockDataManager.setDocument.mockClear();
});

describe("AccessControlService", () => {
  describe("getAccessControlDocument", () => {
    it("creates seed document on first load", async () => {
      const service = new AccessControlService();
      const doc = await service.getAccessControlDocument();

      expect(doc.id).toBe(ACCESS_CONTROL_DOC_ID);
      expect(doc.users).toHaveLength(1);
      expect(doc.users[0].email).toBe(SEED_ADMIN_EMAIL);
      expect(doc.users[0].displayName).toBe(SEED_ADMIN_DISPLAY_NAME);
      expect(doc.users[0].role).toBe(UserRole.Admin);
      expect(doc.users[0].addedBy).toBe("system");
      expect(doc.version).toBe(1);

      // Verify it was persisted
      expect(mockDataManager.setDocument).toHaveBeenCalledWith(
        ACCESS_CONTROL_COLLECTION,
        expect.objectContaining({ id: ACCESS_CONTROL_DOC_ID })
      );
    });

    it("returns existing document if present", async () => {
      const existingDoc = {
        id: ACCESS_CONTROL_DOC_ID,
        users: [
          {
            email: "existing@example.com",
            displayName: "Existing User",
            role: UserRole.Admin,
            addedBy: "system",
            addedAt: "2025-01-01T00:00:00.000Z",
          },
        ],
        version: 1,
      };
      documentStore[ACCESS_CONTROL_COLLECTION] = {
        [ACCESS_CONTROL_DOC_ID]: existingDoc,
      };

      const service = new AccessControlService();
      const doc = await service.getAccessControlDocument();

      expect(doc.users).toHaveLength(1);
      expect(doc.users[0].email).toBe("existing@example.com");
      // setDocument should NOT have been called (no seed needed)
      expect(mockDataManager.setDocument).not.toHaveBeenCalled();
    });

    it("surfaces unauthorized read failures instead of trying to seed", async () => {
      mockDataManager.getDocument.mockRejectedValueOnce({
        statusCode: 401,
        message: "Unauthorized",
      });

      const service = new AccessControlService();

      await expect(service.getAccessControlDocument()).rejects.toThrow(
        "Failed to load access control document: Extension data access was denied (401)."
      );
      expect(mockDataManager.setDocument).not.toHaveBeenCalled();
    });

    it("formats non-Error seed failures instead of showing [object Object]", async () => {
      mockDataManager.setDocument.mockRejectedValueOnce({
        statusCode: 401,
        message: "Unauthorized",
      });

      const service = new AccessControlService();

      await expect(service.getAccessControlDocument()).rejects.toThrow(
        "Failed to create initial access control document: Extension data access was denied (401)."
      );
    });
  });

  describe("isUserAuthorized", () => {
    it("returns authorized=true for seed admin", async () => {
      const service = new AccessControlService();
      const result = await service.isUserAuthorized(SEED_ADMIN_EMAIL);

      expect(result.authorized).toBe(true);
      expect(result.role).toBe(UserRole.Admin);
    });

    it("returns authorized=false for unknown user", async () => {
      const service = new AccessControlService();
      const result = await service.isUserAuthorized("unknown@example.com");

      expect(result.authorized).toBe(false);
      expect(result.role).toBeNull();
    });

    it("is case-insensitive for email matching", async () => {
      const service = new AccessControlService();
      const result = await service.isUserAuthorized(SEED_ADMIN_EMAIL.toUpperCase());

      expect(result.authorized).toBe(true);
    });
  });

  describe("addUser", () => {
    it("adds a new user to the document", async () => {
      const service = new AccessControlService();
      // Trigger seed creation
      await service.getAccessControlDocument();

      const doc = await service.addUser(
        "new@example.com",
        "New User",
        UserRole.Viewer,
        SEED_ADMIN_EMAIL
      );

      expect(doc.users).toHaveLength(2);
      expect(doc.users[1].email).toBe("new@example.com");
      expect(doc.users[1].displayName).toBe("New User");
      expect(doc.users[1].role).toBe(UserRole.Viewer);
      expect(doc.users[1].addedBy).toBe(SEED_ADMIN_EMAIL);
    });

    it("throws if user already exists", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(
        service.addUser(SEED_ADMIN_EMAIL, "Duplicate", UserRole.Viewer, SEED_ADMIN_EMAIL)
      ).rejects.toThrow("already has access");
    });

    it("normalizes email to lowercase", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      const doc = await service.addUser(
        "NEW@EXAMPLE.COM",
        "New User",
        UserRole.Viewer,
        SEED_ADMIN_EMAIL
      );

      expect(doc.users[1].email).toBe("new@example.com");
    });
  });

  describe("removeUser", () => {
    it("removes a viewer user", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL);

      const doc = await service.removeUser("viewer@example.com");

      expect(doc.users).toHaveLength(1);
      expect(doc.users[0].email).toBe(SEED_ADMIN_EMAIL);
    });

    it("throws when removing the last admin", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(service.removeUser(SEED_ADMIN_EMAIL)).rejects.toThrow(
        "Cannot remove the last admin"
      );
    });

    it("allows removing an admin when another admin exists", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("admin2@example.com", "Admin 2", UserRole.Admin, SEED_ADMIN_EMAIL);

      const doc = await service.removeUser(SEED_ADMIN_EMAIL);

      expect(doc.users).toHaveLength(1);
      expect(doc.users[0].email).toBe("admin2@example.com");
    });

    it("throws if user not found", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(service.removeUser("nonexistent@example.com")).rejects.toThrow("not found");
    });
  });

  describe("updateUserRole", () => {
    it("promotes a viewer to admin", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL);

      const doc = await service.updateUserRole("viewer@example.com", UserRole.Admin);

      const user = doc.users.find((u) => u.email === "viewer@example.com");
      expect(user!.role).toBe(UserRole.Admin);
    });

    it("throws when demoting the last admin", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(service.updateUserRole(SEED_ADMIN_EMAIL, UserRole.Viewer)).rejects.toThrow(
        "Cannot demote the last admin"
      );
    });

    it("allows demoting an admin when another admin exists", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("admin2@example.com", "Admin 2", UserRole.Admin, SEED_ADMIN_EMAIL);

      const doc = await service.updateUserRole(SEED_ADMIN_EMAIL, UserRole.Viewer);

      const user = doc.users.find((u) => u.email === SEED_ADMIN_EMAIL);
      expect(user!.role).toBe(UserRole.Viewer);
    });

    it("throws if user not found", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(
        service.updateUserRole("nonexistent@example.com", UserRole.Admin)
      ).rejects.toThrow("not found");
    });
  });

  describe("isUserAuthorized - allowedTeamIds", () => {
    it("returns allowedTeamIds for user with assigned teams", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL, [
        "team-1",
        "team-2",
      ]);

      const result = await service.isUserAuthorized("viewer@example.com");
      expect(result.authorized).toBe(true);
      expect(result.allowedTeamIds).toEqual(["team-1", "team-2"]);
    });

    it("returns empty allowedTeamIds for user without assigned teams", async () => {
      const service = new AccessControlService();
      const result = await service.isUserAuthorized(SEED_ADMIN_EMAIL);

      expect(result.authorized).toBe(true);
      expect(result.allowedTeamIds).toEqual([]);
    });

    it("returns empty allowedTeamIds for unauthorized user", async () => {
      const service = new AccessControlService();
      const result = await service.isUserAuthorized("unknown@example.com");

      expect(result.authorized).toBe(false);
      expect(result.allowedTeamIds).toEqual([]);
    });
  });

  describe("addUser - allowedTeamIds", () => {
    it("stores allowedTeamIds when provided", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      const doc = await service.addUser(
        "viewer@example.com",
        "Viewer",
        UserRole.Viewer,
        SEED_ADMIN_EMAIL,
        ["team-a", "team-b"]
      );

      expect(doc.users[1].allowedTeamIds).toEqual(["team-a", "team-b"]);
    });

    it("omits allowedTeamIds when not provided", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      const doc = await service.addUser(
        "viewer@example.com",
        "Viewer",
        UserRole.Viewer,
        SEED_ADMIN_EMAIL
      );

      expect(doc.users[1].allowedTeamIds).toBeUndefined();
    });

    it("omits allowedTeamIds when empty array provided", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      const doc = await service.addUser(
        "viewer@example.com",
        "Viewer",
        UserRole.Viewer,
        SEED_ADMIN_EMAIL,
        []
      );

      expect(doc.users[1].allowedTeamIds).toBeUndefined();
    });
  });

  describe("updateUserTeams", () => {
    it("sets allowed teams for existing user", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL);

      const doc = await service.updateUserTeams("viewer@example.com", ["team-1", "team-3"]);
      const user = doc.users.find((u) => u.email === "viewer@example.com");

      expect(user!.allowedTeamIds).toEqual(["team-1", "team-3"]);
    });

    it("clears teams when empty array provided", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL, [
        "team-1",
      ]);

      const doc = await service.updateUserTeams("viewer@example.com", []);
      const user = doc.users.find((u) => u.email === "viewer@example.com");

      expect(user!.allowedTeamIds).toBeUndefined();
    });

    it("throws for unknown user", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      await expect(service.updateUserTeams("nonexistent@example.com", ["team-1"])).rejects.toThrow(
        "not found"
      );
    });

    it("is case-insensitive for email matching", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();
      await service.addUser("viewer@example.com", "Viewer", UserRole.Viewer, SEED_ADMIN_EMAIL);

      const doc = await service.updateUserTeams("VIEWER@EXAMPLE.COM", ["team-1"]);
      const user = doc.users.find((u) => u.email === "viewer@example.com");
      expect(user!.allowedTeamIds).toEqual(["team-1"]);
    });
  });

  describe("getThresholds", () => {
    it("returns defaults when no thresholds saved", async () => {
      const service = new AccessControlService();
      const thresholds = await service.getThresholds();

      expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
    });

    it("merges saved thresholds with defaults", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      // Save partial thresholds via the document
      await service.updateThresholds({
        ...DEFAULT_THRESHOLDS,
        taskMaxHours: 8,
      });

      const thresholds = await service.getThresholds();
      expect(thresholds.taskMaxHours).toBe(8);
      // Other defaults remain
      expect(thresholds.perfThresholdExcellent).toBe(DEFAULT_THRESHOLDS.perfThresholdExcellent);
    });
  });

  describe("updateThresholds", () => {
    it("persists and returns thresholds", async () => {
      const service = new AccessControlService();
      await service.getAccessControlDocument();

      const custom = {
        ...DEFAULT_THRESHOLDS,
        taskMaxHours: 10,
        perfThresholdGood: 70,
      };

      const result = await service.updateThresholds(custom);
      expect(result.taskMaxHours).toBe(10);
      expect(result.perfThresholdGood).toBe(70);

      // Verify persistence
      const loaded = await service.getThresholds();
      expect(loaded.taskMaxHours).toBe(10);
      expect(loaded.perfThresholdGood).toBe(70);
    });
  });
});
