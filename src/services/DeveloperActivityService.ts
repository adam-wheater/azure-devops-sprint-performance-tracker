import { GitRestClient, GitQueryCommitsCriteria } from "azure-devops-extension-api/Git";
import { BuildRestClient } from "azure-devops-extension-api/Build";
import { getClient } from "azure-devops-extension-api";
import { IterationService } from "./IterationService";
import {
  ProjectContext,
  TeamInfo,
  SprintInfo,
  DeveloperActivityData,
  DeveloperActivitySummary,
  DeveloperSprintActivity,
} from "../models/interfaces";
import { promiseAllSettledWithLimit } from "../utils/concurrency";

const MAX_COMMITS_PER_REPO_SPRINT = 1000;
const MAX_CONCURRENT_REPOS = 3;
const MAX_COMMIT_DETAILS = 300;
const MAX_CONCURRENT_COMMIT_DETAILS = 10;
const MAX_CONCURRENT_SPRINTS = 3;

export class DeveloperActivityService {
  private gitClient: GitRestClient;
  private buildClient: BuildRestClient;
  private iterationService: IterationService;

  constructor() {
    this.gitClient = getClient(GitRestClient);
    this.buildClient = getClient(BuildRestClient);
    this.iterationService = new IterationService();
  }

  async getSprints(
    project: ProjectContext,
    referenceTeam: TeamInfo,
    lookback: number
  ): Promise<SprintInfo[]> {
    return this.iterationService.getRecentSprints(project, referenceTeam, lookback);
  }

  async getDeveloperActivity(
    project: ProjectContext,
    sprints: SprintInfo[]
  ): Promise<DeveloperActivityData> {
    if (sprints.length === 0) {
      return { sprints: [], developers: [], commitDetailsTruncated: false };
    }

    const repositories = await this.gitClient.getRepositories(project.id);

    let commitDetailsTruncated = false;

    // email -> developer data
    const developerMap = new Map<
      string,
      {
        displayName: string;
        email: string;
        imageUrl?: string;
        activities: Map<string, DeveloperSprintActivity>;
      }
    >();

    const ensureDeveloper = (email: string, displayName: string, imageUrl?: string) => {
      if (!developerMap.has(email)) {
        developerMap.set(email, {
          displayName,
          email,
          imageUrl,
          activities: new Map(),
        });
      } else if (imageUrl && !developerMap.get(email)!.imageUrl) {
        developerMap.get(email)!.imageUrl = imageUrl;
      }
    };

    const ensureActivity = (email: string, sprint: SprintInfo): DeveloperSprintActivity => {
      const devData = developerMap.get(email)!;
      if (!devData.activities.has(sprint.id)) {
        devData.activities.set(sprint.id, {
          sprintId: sprint.id,
          sprintName: sprint.name,
          commitCount: 0,
          filesAdded: 0,
          filesModified: 0,
          filesDeleted: 0,
          pipelinesTriggered: 0,
        });
      }
      return devData.activities.get(sprint.id)!;
    };

    const fetchSprintData = async (sprint: SprintInfo) => {
      const fromDate = sprint.startDate.toISOString();
      const toDate = sprint.finishDate.toISOString();

      // Collect all commits across all repos for this sprint
      const allCommits: Array<{
        commitId: string;
        repoId: string;
        email: string;
        displayName: string;
        imageUrl?: string;
      }> = [];

      const repoResults = await promiseAllSettledWithLimit(
        repositories,
        MAX_CONCURRENT_REPOS,
        (repo) =>
          this.gitClient
            .getCommits(
              repo.id,
              {
                fromDate,
                toDate,
                $top: MAX_COMMITS_PER_REPO_SPRINT,
                includeUserImageUrl: true,
              } as GitQueryCommitsCriteria,
              project.id
            )
            .then((commits) => ({ repoId: repo.id, commits }))
      );

      for (const result of repoResults) {
        if (result.status !== "fulfilled") continue;
        const { repoId, commits } = result.value as {
          repoId: string;
          commits: {
            commitId: string;
            author?: { email?: string; name?: string };
            authorImageUrl?: string;
          }[];
        };
        for (const commit of commits) {
          const email = (commit.author?.email || "").toLowerCase();
          if (!email) continue;
          const displayName = commit.author?.name || email;
          const imageUrl = commit.authorImageUrl;
          ensureDeveloper(email, displayName, imageUrl);
          // Count commits now; file details fetched below
          ensureActivity(email, sprint).commitCount++;
          allCommits.push({ commitId: commit.commitId, repoId, email, displayName });
        }
      }

      // Fetch file change details for up to MAX_COMMIT_DETAILS commits
      if (allCommits.length > MAX_COMMIT_DETAILS) {
        commitDetailsTruncated = true;
      }
      const commitsToDetail = allCommits.slice(0, MAX_COMMIT_DETAILS);
      const detailResults = await promiseAllSettledWithLimit(
        commitsToDetail,
        MAX_CONCURRENT_COMMIT_DETAILS,
        (entry) =>
          this.gitClient
            .getCommit(entry.commitId, entry.repoId, project.id)
            .then((detail) => ({ email: entry.email, changeCounts: detail.changeCounts }))
      );

      for (const result of detailResults) {
        if (result.status !== "fulfilled") continue;
        const { email, changeCounts } = result.value as {
          email: string;
          changeCounts: { [key: string]: number } | undefined;
        };
        if (!changeCounts) continue;
        const activity = ensureActivity(email, sprint);
        // changeCounts keys are PascalCase enum names from the REST API
        activity.filesAdded += changeCounts["Add"] ?? 0;
        activity.filesModified += changeCounts["Edit"] ?? 0;
        activity.filesDeleted += changeCounts["Delete"] ?? 0;
      }

      // Fetch pipeline builds for this sprint
      try {
        const builds = await this.buildClient.getBuilds(
          project.id,
          undefined,
          undefined,
          undefined,
          sprint.startDate,
          sprint.finishDate
        );
        for (const build of builds) {
          const uniqueName = build.requestedFor?.uniqueName;
          if (!uniqueName) continue;
          const email = uniqueName.toLowerCase();
          const displayName = build.requestedFor?.displayName || email;
          ensureDeveloper(email, displayName);
          ensureActivity(email, sprint).pipelinesTriggered++;
        }
      } catch {
        // Pipeline data is optional — don't fail the whole fetch
      }
    };

    await promiseAllSettledWithLimit(sprints, MAX_CONCURRENT_SPRINTS, fetchSprintData);

    const developers: DeveloperActivitySummary[] = Array.from(developerMap.values())
      .map((dev) => ({
        email: dev.email,
        displayName: dev.displayName,
        imageUrl: dev.imageUrl,
        sprintActivities: sprints.map(
          (sprint) =>
            dev.activities.get(sprint.id) ?? {
              sprintId: sprint.id,
              sprintName: sprint.name,
              commitCount: 0,
              filesAdded: 0,
              filesModified: 0,
              filesDeleted: 0,
              pipelinesTriggered: 0,
            }
        ),
      }))
      .filter((dev) =>
        dev.sprintActivities.some((a) => a.commitCount > 0 || a.pipelinesTriggered > 0)
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return { sprints, developers, commitDetailsTruncated };
  }

  /**
   * Returns developer activity totals for a time range (not per sprint).
   */
  async getDeveloperActivityForRange(
    project: ProjectContext,
    fromDate: Date,
    toDate: Date
  ): Promise<{
    developers: Array<{
      email: string;
      displayName: string;
      imageUrl?: string;
      totals: DeveloperSprintActivity;
    }>;
  }> {
    const repositories = await this.gitClient.getRepositories(project.id);
    const developerMap = new Map<
      string,
      {
        displayName: string;
        email: string;
        imageUrl?: string;
        totals: DeveloperSprintActivity;
      }
    >();

    const ensureDeveloper = (email: string, displayName: string, imageUrl?: string) => {
      if (!developerMap.has(email)) {
        developerMap.set(email, {
          displayName,
          email,
          imageUrl,
          totals: {
            sprintId: "range",
            sprintName: "Total",
            commitCount: 0,
            filesAdded: 0,
            filesModified: 0,
            filesDeleted: 0,
            pipelinesTriggered: 0,
          },
        });
      } else if (imageUrl && !developerMap.get(email)!.imageUrl) {
        developerMap.get(email)!.imageUrl = imageUrl;
      }
    };

    // Collect all commits across all repos for the range
    const allCommits: Array<{
      commitId: string;
      repoId: string;
      email: string;
      displayName: string;
      imageUrl?: string;
    }> = [];
    const repoResults = await promiseAllSettledWithLimit(
      repositories,
      MAX_CONCURRENT_REPOS,
      (repo) =>
        this.gitClient
          .getCommits(
            repo.id,
            {
              fromDate: fromDate.toISOString(),
              toDate: toDate.toISOString(),
              $top: MAX_COMMITS_PER_REPO_SPRINT,
              includeUserImageUrl: true,
            } as GitQueryCommitsCriteria,
            project.id
          )
          .then((commits) => ({ repoId: repo.id, commits }))
    );
    for (const result of repoResults) {
      if (result.status !== "fulfilled") continue;
      const { repoId, commits } = result.value as {
        repoId: string;
        commits: {
          commitId: string;
          author?: { email?: string; name?: string };
          authorImageUrl?: string;
        }[];
      };
      for (const commit of commits) {
        const email = (commit.author?.email || "").toLowerCase();
        if (!email) continue;
        const displayName = commit.author?.name || email;
        const imageUrl = commit.authorImageUrl;
        ensureDeveloper(email, displayName, imageUrl);
        developerMap.get(email)!.totals.commitCount++;
        allCommits.push({ commitId: commit.commitId, repoId, email, displayName });
      }
    }

    // Fetch file change details for up to MAX_COMMIT_DETAILS commits
    const commitsToDetail = allCommits.slice(0, MAX_COMMIT_DETAILS);
    const detailResults = await promiseAllSettledWithLimit(
      commitsToDetail,
      MAX_CONCURRENT_COMMIT_DETAILS,
      (entry) =>
        this.gitClient
          .getCommit(entry.commitId, entry.repoId, project.id)
          .then((detail) => ({ email: entry.email, changeCounts: detail.changeCounts }))
    );
    for (const result of detailResults) {
      if (result.status !== "fulfilled") continue;
      const { email, changeCounts } = result.value as {
        email: string;
        changeCounts: { [key: string]: number } | undefined;
      };
      if (!changeCounts) continue;
      const totals = developerMap.get(email)!.totals;
      totals.filesAdded += changeCounts["Add"] ?? 0;
      totals.filesModified += changeCounts["Edit"] ?? 0;
      totals.filesDeleted += changeCounts["Delete"] ?? 0;
    }

    // Fetch pipeline builds for the range
    try {
      const builds = await this.buildClient.getBuilds(
        project.id,
        undefined,
        undefined,
        undefined,
        fromDate,
        toDate
      );
      for (const build of builds) {
        const uniqueName = build.requestedFor?.uniqueName;
        if (!uniqueName) continue;
        const email = uniqueName.toLowerCase();
        const displayName = build.requestedFor?.displayName || email;
        ensureDeveloper(email, displayName);
        developerMap.get(email)!.totals.pipelinesTriggered++;
      }
    } catch {
      // Pipeline data is optional
    }

    const developers = Array.from(developerMap.values())
      .filter((dev) => dev.totals.commitCount > 0 || dev.totals.pipelinesTriggered > 0)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { developers };
  }
}
