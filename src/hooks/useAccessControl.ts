import { useState, useEffect, useRef } from "react";
import * as SDK from "azure-devops-extension-sdk";
import { AccessControlService } from "../services/AccessControlService";
import { UserRole } from "../models/enums";
import { ThresholdSettings } from "../models/interfaces";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export interface UseAccessControlResult {
  loading: boolean;
  authorized: boolean;
  currentUser: CurrentUser | null;
  currentUserRole: UserRole | null;
  allowedTeamIds: string[];
  thresholds: ThresholdSettings | undefined;
  error: string | null;
  accessControlService: AccessControlService;
}

export function useAccessControl(): UseAccessControlResult {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [allowedTeamIds, setAllowedTeamIds] = useState<string[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdSettings | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef(new AccessControlService());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = SDK.getUser();
        // SDK.getUser().name is the UPN/email; displayName is the friendly name
        const email = (user.name || "").toLowerCase();
        const displayName = user.displayName || user.name || "";

        if (cancelled) return;
        setCurrentUser({ id: user.id, name: displayName, email });

        const result = await serviceRef.current.isUserAuthorized(email);
        if (cancelled) return;

        setAuthorized(result.authorized);
        setCurrentUserRole(result.role);
        setAllowedTeamIds(result.allowedTeamIds);

        if (result.authorized) {
          const loadedThresholds = await serviceRef.current.getThresholds();
          if (!cancelled) {
            setThresholds(loadedThresholds);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to check access permissions.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    authorized,
    currentUser,
    currentUserRole,
    allowedTeamIds,
    thresholds,
    error,
    accessControlService: serviceRef.current,
  };
}
