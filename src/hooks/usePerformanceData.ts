import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ProjectContext,
  TeamInfo,
  TeamPerformanceData,
  ThresholdSettings,
} from "../models/interfaces";
import { DataOrchestrator } from "../services/DataOrchestrator";
import { promiseAllSettledWithLimit } from "../utils/concurrency";
import { MAX_CONCURRENT_TEAMS } from "../utils/constants";

interface UsePerformanceDataResult {
  data: Map<string, TeamPerformanceData>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePerformanceData(
  project: ProjectContext | null,
  selectedTeams: TeamInfo[],
  lookback: number,
  orchestrator: DataOrchestrator,
  thresholds?: ThresholdSettings
): UsePerformanceDataResult {
  const [data, setData] = useState<Map<string, TeamPerformanceData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Memoize serialized team IDs to avoid recomputing on every render
  const selectedTeamIdsKey = useMemo(
    () => selectedTeams.map((t) => t.id).join(","),
    [selectedTeams]
  );

  // Keep a ref to selectedTeams so the callback always has the latest value
  const selectedTeamsRef = useRef(selectedTeams);
  selectedTeamsRef.current = selectedTeams;

  const fetchData = useCallback(async () => {
    const teams = selectedTeamsRef.current;
    if (!project || teams.length === 0) {
      setData(new Map());
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const settledResults = await promiseAllSettledWithLimit(teams, MAX_CONCURRENT_TEAMS, (team) =>
        orchestrator.getTeamPerformance(project, team, lookback, thresholds)
      );

      // Only update state if this is still the latest request
      if (currentRequestId !== requestIdRef.current) return;

      const dataMap = new Map<string, TeamPerformanceData>();
      const failedTeams: string[] = [];

      for (let i = 0; i < settledResults.length; i++) {
        const result = settledResults[i];
        if (result.status === "fulfilled") {
          const teamData = result.value as TeamPerformanceData;
          dataMap.set(teamData.team.id, teamData);
        } else {
          failedTeams.push(teams[i].name);
        }
      }

      setData(dataMap);

      if (failedTeams.length > 0 && dataMap.size > 0) {
        setError(
          `Failed to load data for ${failedTeams.length} team(s): ${failedTeams.join(", ")}`
        );
      } else if (failedTeams.length > 0 && dataMap.size === 0) {
        setError("Failed to load performance data for all teams.");
      }
    } catch (err: unknown) {
      if (currentRequestId !== requestIdRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load performance data.";
      setError(message);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [project, selectedTeamIdsKey, lookback, orchestrator, thresholds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
