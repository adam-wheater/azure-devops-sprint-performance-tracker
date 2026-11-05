import { DepartmentStatsService } from "@/services/DepartmentStatsService";
import { ProjectContext } from "@/models/interfaces";
import {
  DEPT_STATS_PR_PAGE_SIZE,
  DEPT_STATS_PR_MAX_PAGES,
  DEPT_STATS_COMMIT_PAGE_SIZE,
  DEPT_STATS_COMMIT_MAX_PAGES,
} from "@/utils/constants";

import * as api from "azure-devops-extension-api";

// The mock adds test-only helpers that the real package's types don't declare.
const mockApi = api as unknown as {
  __setMockClient: (name: string, client: Record<string, unknown>) => void;
  __resetMockClients: () => void;
};

const project: ProjectContext = { id: "proj-1", name: "Contoso" };
const from = new Date(2026, 6, 1);
const to = new Date(2026, 7, 1);

function makePullRequest(id: number) {
  return {
    pullRequestId: id,
    status: 3,
    isDraft: false,
    creationDate: "2026-07-10T09:00:00Z",
    closedDate: "2026-07-12T09:00:00Z",
    createdBy: { uniqueName: "Alice@Example.com", displayName: "Alice" },
    repository: { id: "repo-1", name: "Web" },
  };
}

function makeCommit(id: string) {
  return {
    commitId: id,
    author: { email: "Bob@Example.com", name: "Bob", date: "2026-07-11T10:00:00Z" },
  };
}

function setGitClient(client: Record<string, unknown>): void {
  mockApi.__setMockClient("GitRestClient", client);
}

describe("DepartmentStatsService", () => {
  beforeEach(() => {
    mockApi.__resetMockClients();
  });

  describe("getPullRequestEvents", () => {
    it("maps pull request fields and lowercases the author email", async () => {
      setGitClient({
        getPullRequestsByProject: jest.fn().mockResolvedValue([makePullRequest(1)]),
      });

      const service = new DepartmentStatsService();
      const result = await service.getPullRequestEvents(project, from, to);

      expect(result.pullRequests).toHaveLength(1);
      expect(result.pullRequests[0]).toMatchObject({
        pullRequestId: 1,
        repositoryName: "Web",
        createdByEmail: "alice@example.com",
        status: 3,
      });
      expect(result.pullRequests[0].creationDate).toBeInstanceOf(Date);
      expect(result.truncated).toBe(false);
    });

    it("requests all statuses within the date range", async () => {
      const getPullRequestsByProject = jest.fn().mockResolvedValue([]);
      setGitClient({ getPullRequestsByProject });

      await new DepartmentStatsService().getPullRequestEvents(project, from, to);

      const criteria = getPullRequestsByProject.mock.calls[0][1];
      expect(criteria.status).toBe(4); // PullRequestStatus.All
      expect(criteria.queryTimeRangeType).toBe(1); // Created
      expect(criteria.minTime).toBe(from);
      expect(criteria.maxTime).toBe(to);
    });

    it("pages until a short page comes back", async () => {
      const fullPage = Array.from({ length: DEPT_STATS_PR_PAGE_SIZE }, (_, i) =>
        makePullRequest(i)
      );
      const getPullRequestsByProject = jest
        .fn()
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce([makePullRequest(9999)]);
      setGitClient({ getPullRequestsByProject });

      const result = await new DepartmentStatsService().getPullRequestEvents(project, from, to);

      expect(getPullRequestsByProject).toHaveBeenCalledTimes(2);
      expect(result.pullRequests).toHaveLength(DEPT_STATS_PR_PAGE_SIZE + 1);
      // Second call must skip the first page rather than re-reading it.
      expect(getPullRequestsByProject.mock.calls[1][3]).toBe(DEPT_STATS_PR_PAGE_SIZE);
      expect(result.truncated).toBe(false);
    });

    it("flags truncation when the page cap is reached", async () => {
      const fullPage = Array.from({ length: DEPT_STATS_PR_PAGE_SIZE }, (_, i) =>
        makePullRequest(i)
      );
      const getPullRequestsByProject = jest.fn().mockResolvedValue(fullPage);
      setGitClient({ getPullRequestsByProject });

      const result = await new DepartmentStatsService().getPullRequestEvents(project, from, to);

      expect(getPullRequestsByProject).toHaveBeenCalledTimes(DEPT_STATS_PR_MAX_PAGES);
      expect(result.truncated).toBe(true);
    });

    it("returns empty when there are no pull requests", async () => {
      setGitClient({ getPullRequestsByProject: jest.fn().mockResolvedValue([]) });
      const result = await new DepartmentStatsService().getPullRequestEvents(project, from, to);
      expect(result.pullRequests).toEqual([]);
      expect(result.truncated).toBe(false);
    });
  });

  describe("getCommitEvents", () => {
    const repos = [
      { id: "repo-1", name: "Web" },
      { id: "repo-2", name: "Api" },
    ];

    it("collects commits from every repository", async () => {
      const getCommits = jest
        .fn()
        .mockResolvedValueOnce([makeCommit("a")])
        .mockResolvedValueOnce([makeCommit("b"), makeCommit("c")]);
      setGitClient({ getCommits });

      const result = await new DepartmentStatsService().getCommitEvents(project, from, to, repos);

      expect(result.commits).toHaveLength(3);
      expect(result.commits[0].authorEmail).toBe("bob@example.com");
      expect(result.failedRepositories).toEqual([]);
      expect(result.truncatedRepositories).toEqual([]);
    });

    it("keeps going when one repository fails and names it", async () => {
      const getCommits = jest.fn().mockImplementation((repoId: string) => {
        if (repoId === "repo-2") return Promise.reject(new Error("403"));
        return Promise.resolve([makeCommit("a")]);
      });
      setGitClient({ getCommits });

      const result = await new DepartmentStatsService().getCommitEvents(project, from, to, repos);

      expect(result.commits).toHaveLength(1);
      expect(result.failedRepositories).toEqual(["Api"]);
    });

    it("flags a repository whose history hits the page cap", async () => {
      const fullPage = Array.from({ length: DEPT_STATS_COMMIT_PAGE_SIZE }, (_, i) =>
        makeCommit(`c${i}`)
      );
      const getCommits = jest.fn().mockResolvedValue(fullPage);
      setGitClient({ getCommits });

      const result = await new DepartmentStatsService().getCommitEvents(project, from, to, [
        repos[0],
      ]);

      expect(getCommits).toHaveBeenCalledTimes(DEPT_STATS_COMMIT_MAX_PAGES);
      expect(result.truncatedRepositories).toEqual(["Web"]);
    });

    it("falls back to the committer date when the author date is missing", async () => {
      setGitClient({
        getCommits: jest.fn().mockResolvedValue([
          {
            commitId: "x",
            author: { email: "bob@example.com", name: "Bob" },
            committer: { date: "2026-07-11T10:00:00Z" },
          },
        ]),
      });

      const result = await new DepartmentStatsService().getCommitEvents(project, from, to, [
        repos[0],
      ]);

      expect(result.commits[0].date).toBeInstanceOf(Date);
    });

    it("handles a project with no repositories", async () => {
      setGitClient({ getCommits: jest.fn() });
      const result = await new DepartmentStatsService().getCommitEvents(project, from, to, []);
      expect(result.commits).toEqual([]);
    });
  });

  describe("getDepartmentStats", () => {
    it("combines pull requests, commits and repository count", async () => {
      setGitClient({
        getRepositories: jest.fn().mockResolvedValue([{ id: "repo-1", name: "Web" }]),
        getPullRequestsByProject: jest.fn().mockResolvedValue([makePullRequest(1)]),
        getCommits: jest.fn().mockResolvedValue([makeCommit("a")]),
      });

      const result = await new DepartmentStatsService().getDepartmentStats(project, from, to);

      expect(result.pullRequests).toHaveLength(1);
      expect(result.commits).toHaveLength(1);
      expect(result.repositoryCount).toBe(1);
      expect(result.range).toEqual({ fromDate: from, toDate: to });
      expect(result.pullRequestsTruncated).toBe(false);
    });

    it("propagates a repository listing failure", async () => {
      setGitClient({
        getRepositories: jest.fn().mockRejectedValue(new Error("no access")),
      });

      await expect(
        new DepartmentStatsService().getDepartmentStats(project, from, to)
      ).rejects.toThrow("no access");
    });
  });
});
