import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api";
import { ProjectContext, TeamInfo, TeamPerformanceData } from "../models/interfaces";
import { UserRole } from "../models/enums";
import { DataOrchestrator } from "../services/DataOrchestrator";
import { UserPreferencesService } from "../services/UserPreferencesService";
import { DEFAULT_LOOKBACK } from "../utils/constants";
import { usePerformanceData } from "../hooks/usePerformanceData";
import { useAccessControl } from "../hooks/useAccessControl";
import { BRAND, BrandGlyph } from "../brand";
import { SprintLookbackControl } from "./SprintLookbackControl";
import { TeamSelector } from "./TeamSelector";
import { TeamPerformanceSection } from "./TeamPerformanceSection";
import { AccessDenied } from "./AccessDenied";
import { AdminPanel } from "./AdminPanel";
import { CombinedTeamSummary } from "./CombinedTeamSummary";
import { aggregateSummaryStats } from "../utils/teamAggregation";
import { DeveloperActivityPage } from "./DeveloperActivityPage";
import { TeamInsightsPage } from "./TeamInsightsPage";
import { TaskUpdatePage } from "./TaskUpdatePage";
import { DepartmentStatsPage } from "./DepartmentStatsPage";
import { LoadingSkeleton } from "./LoadingSkeleton";
import {
  AppShell,
  Banner,
  Button,
  EmptyState,
  ErrorBoundary,
  Gate,
  IconAlert,
  IconRefresh,
  IconSettings,
  Progress,
  Skeleton,
  Tabs,
} from "./ui";

type ActivePage = "performance" | "activity" | "insights" | "task-updates" | "department-stats";

const PAGE_TABS: { id: ActivePage; label: string }[] = [
  { id: "performance", label: "Sprint Performance" },
  { id: "activity", label: "Developer Activity" },
  { id: "insights", label: "Team Insights" },
  { id: "task-updates", label: "Task Updates" },
  { id: "department-stats", label: "Department Stats" },
];

const AppContent: React.FC = () => {
  const {
    loading: accessLoading,
    authorized,
    currentUser,
    currentUserRole,
    allowedTeamIds,
    thresholds,
    error: accessError,
    accessControlService,
  } = useAccessControl();

  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [activePage, setActivePage] = useState<ActivePage>("performance");
  const [project, setProject] = useState<ProjectContext | null>(null);
  const [allProjectTeams, setAllProjectTeams] = useState<TeamInfo[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [lookback, setLookback] = useState<number>(DEFAULT_LOOKBACK);
  const [initLoading, setInitLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  const orchestratorRef = useRef(new DataOrchestrator());
  const prefsServiceRef = useRef(new UserPreferencesService());
  const prefsLoadedRef = useRef(false);
  const isAdmin = currentUserRole === UserRole.Admin;

  const handleTeamIdsChange = useCallback(
    (newIds: Set<string>) => {
      setSelectedTeamIds(newIds);
      prefsServiceRef.current.savePreferences({
        selectedTeamIds: Array.from(newIds),
        lookback,
      });
    },
    [lookback]
  );

  const handleLookbackChange = useCallback(
    (newLookback: number) => {
      setLookback(newLookback);
      prefsServiceRef.current.savePreferences({
        selectedTeamIds: Array.from(selectedTeamIds),
        lookback: newLookback,
      });
    },
    [selectedTeamIds]
  );

  const selectedTeams = useMemo(
    () => teams.filter((t) => selectedTeamIds.has(t.id)),
    [teams, selectedTeamIds]
  );

  const { data, loading, error, refresh } = usePerformanceData(
    project,
    selectedTeams,
    lookback,
    orchestratorRef.current,
    thresholds
  );

  const combinedSummary = useMemo(() => {
    const loadedEntries = selectedTeams
      .map((t) => data.get(t.id))
      .filter((d): d is TeamPerformanceData => d != null);
    if (loadedEntries.length < 2) return null;
    return aggregateSummaryStats(loadedEntries);
  }, [data, selectedTeams]);

  useEffect(() => {
    if (!authorized) return;

    let cancelled = false;
    const orchestrator = orchestratorRef.current;

    (async () => {
      try {
        const projectService = await SDK.getService<IProjectPageService>(
          CommonServiceIds.ProjectPageService
        );
        const proj = await projectService.getProject();
        if (!proj) {
          throw new Error("Could not determine project context.");
        }
        if (cancelled) return;

        const projectContext: ProjectContext = {
          id: proj.id,
          name: proj.name,
        };
        setProject(projectContext);

        const allTeams = await orchestrator.getAllTeams(projectContext);
        if (cancelled) return;
        setAllProjectTeams(allTeams);

        // Filter to teams with recent sprint activity
        const activeTeams = await orchestrator.getActiveTeams(projectContext, allTeams);
        if (cancelled) return;

        // For viewers with allowed teams, further filter
        let visibleTeams = activeTeams;
        if (!isAdmin && allowedTeamIds.length > 0) {
          const allowedSet = new Set(allowedTeamIds);
          visibleTeams = activeTeams.filter((t) => allowedSet.has(t.id));
        }

        setTeams(visibleTeams);

        // Load persisted preferences
        if (!prefsLoadedRef.current) {
          prefsLoadedRef.current = true;
          try {
            const prefs = await prefsServiceRef.current.loadPreferences();
            if (cancelled) return;
            if (prefs.lookback && prefs.lookback >= 1 && prefs.lookback <= 10) {
              setLookback(prefs.lookback);
            }
            if (prefs.selectedTeamIds && prefs.selectedTeamIds.length > 0) {
              const visibleIds = new Set(visibleTeams.map((t) => t.id));
              const restored = prefs.selectedTeamIds.filter((id) => visibleIds.has(id));
              if (restored.length > 0) {
                setSelectedTeamIds(new Set(restored));
              } else {
                setSelectedTeamIds(new Set(visibleTeams.map((t) => t.id)));
              }
            } else {
              setSelectedTeamIds(new Set(visibleTeams.map((t) => t.id)));
            }
          } catch {
            setSelectedTeamIds(new Set(visibleTeams.map((t) => t.id)));
          }
        } else {
          setSelectedTeamIds(new Set(visibleTeams.map((t) => t.id)));
        }

        await SDK.notifyLoadSucceeded();
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to initialize extension.";
          setInitError(message);
        }
      } finally {
        if (!cancelled) {
          setInitLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorized, isAdmin, allowedTeamIds]);

  // Access control loading state
  if (accessLoading) {
    return (
      <Gate title={<span className="ax-sr-only">Checking access</span>} busy>
        <Skeleton variant="value" style={{ margin: "0 auto 16px", width: "60%" }} />
        <Skeleton style={{ width: "85%", margin: "0 auto 8px" }} />
        <Skeleton style={{ width: "70%", margin: "0 auto" }} />
      </Gate>
    );
  }

  // Access control error
  if (accessError) {
    return (
      <Gate title="Couldn't check access" icon={<IconAlert size={26} />}>
        <p className="ax-gate__body">{accessError}</p>
      </Gate>
    );
  }

  // Unauthorized
  if (!authorized) {
    return <AccessDenied userEmail={currentUser?.email || "unknown"} />;
  }

  const displayError = initError || error;
  const isLoading = initLoading || loading;
  const subtitle = project ? `${BRAND.tagline} · ${project.name}` : BRAND.tagline;

  return (
    <AppShell
      title={BRAND.name}
      subtitle={subtitle}
      mark={<BrandGlyph />}
      actions={
        isAdmin ? (
          <Button
            icon={<IconSettings />}
            onClick={() => setAdminPanelOpen(true)}
            title="Manage access and thresholds"
          >
            Settings
          </Button>
        ) : undefined
      }
    >
      {isAdmin && !initLoading && !initError && (
        <Tabs
          tabs={PAGE_TABS}
          active={activePage}
          onChange={(id) => setActivePage(id as ActivePage)}
          aria-label="Pages"
        />
      )}

      {activePage === "performance" && (
        <>
          {!initLoading && !initError && (
            <div className="ax-toolbar">
              <SprintLookbackControl value={lookback} onChange={handleLookbackChange} />
              <TeamSelector
                teams={teams}
                selectedTeamIds={selectedTeamIds}
                onChange={handleTeamIdsChange}
              />
              <span className="ax-spacer" />
              <Button
                icon={<IconRefresh />}
                busy={loading}
                onClick={refresh}
                disabled={isLoading}
                title="Refresh data"
              >
                Refresh
              </Button>
            </div>
          )}

          {displayError && <Banner tone="error">{displayError}</Banner>}
          {isLoading && !initLoading && <LoadingSkeleton />}
          {isLoading && initLoading && (
            <Progress label="Loading performance data..." indeterminate />
          )}

          {!isLoading && !displayError && combinedSummary && (
            <CombinedTeamSummary
              teamCount={combinedSummary.teamCount}
              stats={combinedSummary.stats}
              velocityTrend={combinedSummary.velocityTrend}
              completionTrend={combinedSummary.completionTrend}
              utilizationTrend={combinedSummary.utilizationTrend}
            />
          )}

          {!isLoading &&
            !displayError &&
            selectedTeams.map((team) => {
              const teamData = data.get(team.id);
              if (!teamData) return null;
              return (
                <TeamPerformanceSection
                  key={team.id}
                  data={teamData}
                  thresholds={thresholds}
                  unmatchedAssignees={teamData.unmatchedAssignees}
                />
              );
            })}

          {!isLoading && !displayError && selectedTeams.length === 0 && (
            <EmptyState title="No teams selected. Use the team buttons above to select teams." />
          )}
        </>
      )}

      {activePage === "activity" && isAdmin && project && (
        <DeveloperActivityPage
          project={project}
          lookback={lookback}
          onLookbackChange={handleLookbackChange}
        />
      )}

      {activePage === "insights" && isAdmin && (
        <TeamInsightsPage
          selectedTeams={selectedTeams}
          performanceData={data}
          performanceLoading={loading}
        />
      )}

      {activePage === "task-updates" && isAdmin && project && (
        <TaskUpdatePage
          project={project}
          selectedTeams={selectedTeams}
          performanceData={data}
          performanceLoading={loading}
        />
      )}

      {activePage === "department-stats" && isAdmin && project && (
        <DepartmentStatsPage project={project} />
      )}

      {isAdmin && (
        <AdminPanel
          isOpen={adminPanelOpen}
          onClose={() => setAdminPanelOpen(false)}
          accessControlService={accessControlService}
          currentUserEmail={currentUser?.email ?? ""}
          allTeams={allProjectTeams}
        />
      )}

      <footer className="ax-footer">
        <span>{BRAND.name}</span>
        <span>Runs entirely in your browser · no data leaves Azure DevOps</span>
      </footer>
    </AppShell>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);
