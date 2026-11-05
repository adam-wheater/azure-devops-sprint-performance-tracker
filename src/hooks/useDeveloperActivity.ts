import { useState, useEffect, useCallback, useRef } from "react";
import { ProjectContext, TeamInfo, DeveloperSprintActivity } from "../models/interfaces";
import { DeveloperActivityService } from "../services/DeveloperActivityService";

interface DeveloperActivityResult {
  developers: Array<{
    email: string;
    displayName: string;
    imageUrl?: string;
    totals: DeveloperSprintActivity;
  }>;
}

interface UseDeveloperActivityResult {
  data: DeveloperActivityResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDeveloperActivity(
  project: ProjectContext | null,
  _referenceTeam: TeamInfo | null,
  lookback: number
): UseDeveloperActivityResult {
  const [data, setData] = useState<DeveloperActivityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceRef = useRef(new DeveloperActivityService());
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!project) return;

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - lookback * 14);

      if (currentRequestId !== requestIdRef.current) return;

      const result = await serviceRef.current.getDeveloperActivityForRange(
        project,
        startDate,
        endDate
      );
      if (currentRequestId !== requestIdRef.current) return;

      setData(result);
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load developer activity data.";
      setError(message);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [project, lookback]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
