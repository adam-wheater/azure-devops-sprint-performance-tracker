import { getClient } from "azure-devops-extension-api";
import {
  GitRestClient,
  GitQueryCommitsCriteria,
  GitPullRequestSearchCriteria,
} from "azure-devops-extension-api/Git";
import {
  ProjectContext,
  DepartmentStatsData,
  PullRequestEvent,
  CommitEvent,
} from "../models/interfaces";
import { promiseAllSettledWithLimit } from "../utils/concurrency";
import {
  DEPT_STATS_PR_PAGE_SIZE,
  DEPT_STATS_PR_MAX_PAGES,
  DEPT_STATS_COMMIT_PAGE_SIZE,
  DEPT_STATS_COMMIT_MAX_PAGES,
  DEPT_STATS_MAX_CONCURRENT_REPOS,
} from "../utils/constants";

/** PullRequestStatus.All — every status, not just the default Active. */
const PR_STATUS_ALL = 4;
/** PullRequestTimeRangeType.Created — filter minTime/maxTime on creation date. */
const PR_TIME_RANGE_CREATED = 1;

interface RawIdentity {
  uniqueName?: string;
  displayName?: string;
  mailAddress?: string;
}

interface RawPullRequest {
  pullRequestId: number;
  status?: number;
  isDraft?: boolean;
  creationDate?: string | Date;
  closedDate?: string | Date;
  createdBy?: RawIdentity;
  repository?: { id?: string; name?: string };
}

interface RawCommit {
  commitId: string;
  author?: { email?: string; name?: string; date?: string | Date };
  committer?: { date?: string | Date };
}

function parseDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function identityEmail(identity: RawIdentity | undefined): string {
  if (!identity) return "";
  return (identity.uniqueName || identity.mailAddress || identity.displayName || "").toLowerCase();
}

/**
 * Fetches the raw pull request and commit activity behind the department
 * charts. Everything is returned as flat dated events; bucketing into days is
 * the caller's job (see utils/timeSeries) so the aggregation stays pure and
 * testable.
 */
export class DepartmentStatsService {
  private gitClient: GitRestClient;

  constructor() {
    this.gitClient = getClient(GitRestClient);
  }

  /**
   * Pull requests created within the range, across every repo in the project.
   *
   * The REST API caps a page at a few hundred results, so this pages with
   * $skip/$top until a short page comes back. Hitting the page cap sets the
   * truncation flag rather than silently under-reporting.
   */
  async getPullRequestEvents(
    project: ProjectContext,
    fromDate: Date,
    toDate: Date
  ): Promise<{ pullRequests: PullRequestEvent[]; truncated: boolean }> {
    const criteria = {
      status: PR_STATUS_ALL,
      queryTimeRangeType: PR_TIME_RANGE_CREATED,
      minTime: fromDate,
      maxTime: toDate,
      includeLinks: false,
    } as unknown as GitPullRequestSearchCriteria;

    const pullRequests: PullRequestEvent[] = [];
    let truncated = false;

    for (let page = 0; page < DEPT_STATS_PR_MAX_PAGES; page++) {
      const batch = (await this.gitClient.getPullRequestsByProject(
        project.id,
        criteria,
        undefined,
        page * DEPT_STATS_PR_PAGE_SIZE,
        DEPT_STATS_PR_PAGE_SIZE
      )) as unknown as RawPullRequest[];

      if (!batch || batch.length === 0) break;

      for (const pr of batch) {
        pullRequests.push({
          pullRequestId: pr.pullRequestId,
          repositoryId: pr.repository?.id || "",
          repositoryName: pr.repository?.name || "",
          createdByEmail: identityEmail(pr.createdBy),
          createdByDisplayName: pr.createdBy?.displayName || "",
          creationDate: parseDate(pr.creationDate),
          closedDate: parseDate(pr.closedDate),
          status: pr.status ?? 0,
          isDraft: pr.isDraft === true,
        });
      }

      // A short page means we reached the end of the result set.
      if (batch.length < DEPT_STATS_PR_PAGE_SIZE) break;

      if (page === DEPT_STATS_PR_MAX_PAGES - 1) {
        truncated = true;
      }
    }

    return { pullRequests, truncated };
  }

  /**
   * Commits authored within the range, across every repo in the project.
   * Repos are fetched concurrently; one failing repo degrades that repo only.
   */
  async getCommitEvents(
    project: ProjectContext,
    fromDate: Date,
    toDate: Date,
    repositories: Array<{ id: string; name: string }>
  ): Promise<{
    commits: CommitEvent[];
    truncatedRepositories: string[];
    failedRepositories: string[];
  }> {
    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    const results = await promiseAllSettledWithLimit(
      repositories,
      DEPT_STATS_MAX_CONCURRENT_REPOS,
      async (repo) => {
        const repoCommits: CommitEvent[] = [];
        let hitCap = false;

        for (let page = 0; page < DEPT_STATS_COMMIT_MAX_PAGES; page++) {
          const batch = (await this.gitClient.getCommits(
            repo.id,
            {
              fromDate: fromIso,
              toDate: toIso,
              $top: DEPT_STATS_COMMIT_PAGE_SIZE,
              $skip: page * DEPT_STATS_COMMIT_PAGE_SIZE,
            } as GitQueryCommitsCriteria,
            project.id
          )) as unknown as RawCommit[];

          if (!batch || batch.length === 0) break;

          for (const commit of batch) {
            repoCommits.push({
              commitId: commit.commitId,
              repositoryId: repo.id,
              repositoryName: repo.name,
              authorEmail: (commit.author?.email || "").toLowerCase(),
              authorDisplayName: commit.author?.name || commit.author?.email || "",
              date: parseDate(commit.author?.date) ?? parseDate(commit.committer?.date),
            });
          }

          if (batch.length < DEPT_STATS_COMMIT_PAGE_SIZE) break;

          if (page === DEPT_STATS_COMMIT_MAX_PAGES - 1) {
            hitCap = true;
          }
        }

        return { repo, commits: repoCommits, hitCap };
      }
    );

    const commits: CommitEvent[] = [];
    const truncatedRepositories: string[] = [];
    const failedRepositories: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status !== "fulfilled") {
        failedRepositories.push(repositories[i].name);
        continue;
      }
      const value = result.value as {
        repo: { id: string; name: string };
        commits: CommitEvent[];
        hitCap: boolean;
      };
      commits.push(...value.commits);
      if (value.hitCap) {
        truncatedRepositories.push(value.repo.name);
      }
    }

    return { commits, truncatedRepositories, failedRepositories };
  }

  /** Fetches everything the department stats page needs for one date range. */
  async getDepartmentStats(
    project: ProjectContext,
    fromDate: Date,
    toDate: Date
  ): Promise<DepartmentStatsData> {
    const repositories = (await this.gitClient.getRepositories(project.id)) as Array<{
      id: string;
      name: string;
    }>;

    // Pull requests are a single project-wide pager, commits fan out per repo —
    // run both at once so the slower of the two sets the wall time.
    const [prResult, commitResult] = await Promise.all([
      this.getPullRequestEvents(project, fromDate, toDate),
      this.getCommitEvents(project, fromDate, toDate, repositories || []),
    ]);

    return {
      range: { fromDate, toDate },
      pullRequests: prResult.pullRequests,
      commits: commitResult.commits,
      repositoryCount: repositories?.length ?? 0,
      truncatedRepositories: commitResult.truncatedRepositories,
      pullRequestsTruncated: prResult.truncated,
      failedRepositories: commitResult.failedRepositories,
    };
  }
}
