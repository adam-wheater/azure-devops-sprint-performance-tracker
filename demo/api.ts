// Sample data for the demo build: the Billing Team of a fictional "Contoso" project,
// six two-week sprints, six people, and the repositories and pipelines behind the
// admin views. See demo/kit.ts for the helpers.
import {
  CommonServiceIds,
  clientFactory,
  delay,
  extensionDataService,
  projectPageService,
} from "./kit";

export { CommonServiceIds };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();

// Small deterministic generator so every screenshot run shows the same data.
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const half = (n: number) => Math.round(n * 2) / 2;
const pickWeighted = <T>(items: T[], weights: number[]): T => {
  let roll = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
};

const midnight = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
const at = (day: Date, hour: number, minute = 0) => {
  const x = new Date(day);
  x.setHours(hour, minute, 0, 0);
  return new Date(Math.min(x.getTime(), now - HOUR));
};
const guid = (n: number) => `c0de0000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ── Project, team and people ───────────────────────────────────────────────

const TEAM_ID = "b7e2a4c1-3d58-4f6a-9b0e-5c1d2e3f4a60";
const DEFAULT_TEAM_ID = "9a41d7e2-6c03-4b85-8f1a-2e7d90c4b153";

interface Person {
  key: string;
  id: string;
  name: string;
  email: string;
  role: string;
  capacityPerDay: number;
  /** Estimated hours per actual hour: below 1 means the person under-estimates. */
  ratio: number;
  /** Hours logged as a percent of available hours, one entry per sprint. */
  util: number[];
  /** Work assigned in each sprint: `5d` PBI of 5 points done, `b2n` bug of 2 not started,
   *  `3a` active, `b-n` a bug with no effort set. */
  plan: string[];
}

const people: Person[] = [
  {
    key: "priya",
    id: guid(1),
    name: "Priya Shah",
    email: "priya.shah@contoso.com",
    role: "Development",
    capacityPerDay: 6,
    ratio: 1.0,
    util: [96, 92, 98, 94, 100, 98],
    plan: [
      "5d 3d 1d b1d",
      "5d 3d b2d",
      "5d 3d 2d b1d",
      "5d 3d 2d b1d 1n",
      "8d 3d b1d",
      "5d 3d 2d b2d",
    ],
  },
  {
    key: "tom",
    id: guid(2),
    name: "Tom Ellis",
    email: "tom.ellis@contoso.com",
    role: "Development",
    capacityPerDay: 6,
    ratio: 0.93,
    util: [90, 92, 88, 86, 95, 94],
    plan: ["5d 3d 1d 1n", "5d 2d 2d", "5d 3d b1d b1n b-n", "3d 3d 2d 1n", "5d 3d", "5d 3d 2d"],
  },
  {
    key: "maria",
    id: guid(3),
    name: "Maria Lopez",
    email: "maria.lopez@contoso.com",
    role: "Development",
    capacityPerDay: 6,
    ratio: 0.93,
    util: [84, 88, 80, 86, 90, 88],
    plan: ["5d 2d 1d 1n", "3d 3d 2d b1d", "5d 3d 2n", "5d 2d 2d 1n", "5d 3d b1d", "3d 3d 3d b1a"],
  },
  {
    key: "chen",
    id: guid(4),
    name: "Chen Wei",
    email: "chen.wei@contoso.com",
    role: "Development",
    capacityPerDay: 6,
    ratio: 0.82,
    util: [70, 74, 78, 82, 84, 88],
    plan: ["3d 1d 2n", "3d 2d 2n", "3d 2d 1d b1n", "3d 3d 1d 1n", "5d 2d b1n", "5d 2d 1d b1a"],
  },
  {
    key: "sam",
    id: guid(5),
    name: "Sam Okafor",
    email: "sam.okafor@contoso.com",
    role: "Testing",
    capacityPerDay: 6,
    ratio: 0.95,
    util: [88, 90, 92, 94, 90, 96],
    plan: [
      "3d 2d 1d 1n",
      "3d 2d b1d b1n",
      "3d 3d b1d b1n",
      "5d 2d 1n",
      "5d 2d b1d",
      "3d 3d 1d b1d",
    ],
  },
  {
    key: "ruth",
    id: guid(6),
    name: "Ruth Adams",
    email: "ruth.adams@contoso.com",
    role: "Design",
    capacityPerDay: 5,
    ratio: 0.95,
    util: [80, 0, 82, 86, 88, 90],
    plan: ["3d 2d 1n", "", "3d 2d 1n", "3d 3d 1n", "5d 2d", "3d 2d 2d b1a"],
  },
];

const identity = (p: Person) => ({
  id: p.id,
  displayName: p.name,
  uniqueName: p.email,
  imageUrl: "",
});

// ── Sprints: six finished fortnights, the last one ending today ────────────

let lastDay = midnight(new Date());
while (!isWeekday(lastDay)) lastDay = addDays(lastDay, -1);

const sprints = [36, 37, 38, 39, 40, 41].map((n, k) => {
  const finish = addDays(lastDay, -14 * (5 - k));
  let start = addDays(finish, -13);
  if (start.getDay() === 6) start = addDays(start, 2);
  const days: Date[] = [];
  for (let d = start; d <= finish; d = addDays(d, 1)) if (isWeekday(d)) days.push(d);
  return {
    id: `7a1c5e30-2b4d-4f68-9e01-${String(n).padStart(12, "0")}`,
    name: `Sprint ${n}`,
    path: `Contoso\\Sprint ${n}`,
    start,
    finish,
    days,
  };
});
const LAST = sprints.length - 1;

/** Personal days off, as inclusive ranges of the sprint's weekdays. */
const daysOff = (p: Person, k: number): [number, number] | null => {
  if (p.key === "tom" && k === 4) return [4, 6];
  if (p.key === "ruth" && k === 1) return [0, 9];
  return null;
};
const workingDays = (p: Person, k: number) => {
  const off = daysOff(p, k);
  return 10 - (off ? off[1] - off[0] + 1 : 0);
};

// ── Work items ─────────────────────────────────────────────────────────────

const pbiTitles = [
  "Export invoices as CSV",
  "Retry failed payment webhooks",
  "Show payment status on invoice page",
  "Support partial refunds",
  "Email a receipt after payment",
  "Add VAT number to customer profile",
  "Paginate the invoice list",
  "Filter invoices by status",
  "Save a card for the next payment",
  "Bulk download invoices as PDF",
  "Add an audit trail to refunds",
  "Dark mode for the portal",
  "Show outstanding balance on the dashboard",
  "Let customers update their billing address",
  "Schedule recurring invoices",
  "Add credit notes to the API",
  "Remind customers of overdue invoices",
  "Support multiple currencies on invoices",
  "Add a payment method picker",
  "Sync payouts with the ledger",
  "Search invoices by reference",
  "Rate limit the public API",
  "Show refund history on the customer page",
  "Allow invoice notes",
  "Add tax rates per region",
  "Speed up the invoice PDF render",
  "Add a status page for payment providers",
  "Import customers from CSV",
  "Archive paid invoices",
  "Add 3-D Secure to card payments",
  "Show next payment date",
  "Add a download link to receipts",
  "Add a customer-facing payment history",
  "Support part payments",
  "Group invoices by project",
  "Tidy the invoice table on mobile",
  "Add keyboard shortcuts to the portal",
  "Cache the price list",
  "Add a payout summary email",
  "Show failed payments on the dashboard",
  "Add a refund reason picker",
  "Support invoice templates",
  "Add a PO number field",
  "Let admins pause a subscription",
  "Add webhook signing",
  "Add an invoice preview",
  "Show card expiry warnings",
  "Add team billing roles",
];
const bugTitles = [
  "Totals wrong when currency is EUR",
  "Date picker ignores locale",
  "Webhook retries fire twice",
  "Duplicate rows after refresh",
  "PDF export cuts off the last page",
  "Search misses archived invoices",
  "Refund email sent to the wrong address",
  "Receipt shows the wrong VAT line",
  "Session expires mid-payment",
  "Invoice list flickers on slow networks",
  "Negative balance shown as zero",
  "Payout total off by a penny",
  "Card form loses focus on mobile",
  "CSV export drops accented names",
  "Timezone shifts due dates by a day",
  "Pagination skips a page after filtering",
];
const taskVerbs: Record<string, string[]> = {
  Development: ["Implement", "Unit tests for", "Review feedback on", "Wire up"],
  Testing: ["Test plan for", "Automate", "Regression pass for", "Verify"],
  Design: ["Wireframes for", "UI spec for", "Design review of", "Assets for"],
};
/** Sprint and person where one task is deliberately larger than the 6 hour limit. */
const oversize: Record<string, number> = { "0:chen": 8, "3:maria": 7 };

interface Item {
  id: number;
  iteration: string;
  type: string;
  changed: Date;
  fields: Record<string, any>;
}
const items: Item[] = [];
let nextId = 4100;
let pbiCursor = 0;
let bugCursor = 0;
const add = (iteration: string, fields: Record<string, any>, changed: Date): Item => {
  const id = nextId++;
  const item: Item = {
    id,
    iteration,
    type: fields["System.WorkItemType"],
    changed,
    fields: {
      "System.Id": id,
      "System.IterationPath": iteration,
      "System.ChangedDate": changed.toISOString(),
      ...fields,
    },
  };
  items.push(item);
  return item;
};

interface Task {
  person: Person;
  item: Item;
  completed: number;
}
const sprintTasks: Task[] = [];

sprints.forEach((sprint, k) => {
  let risk = 0;
  let over = 0;
  for (const person of people) {
    const wd = workingDays(person, k);
    const planned = person.plan[k]
      .split(" ")
      .filter(Boolean)
      .map((token) => {
        const bug = token[0] === "b";
        const body = bug ? token.slice(1) : token;
        const num = body.slice(0, -1);
        return { bug, effort: num === "-" ? null : Number(num), status: body.slice(-1) };
      });
    if (wd === 0 || planned.length === 0) continue;

    // Hours logged this sprint, spread over the points that were finished plus a
    // share of the points still in progress.
    const target = half((person.util[k] / 100) * wd * person.capacityPerDay);
    const doneEffort = planned
      .filter((i) => i.status === "d")
      .reduce((s, i) => s + (i.effort ?? 0), 0);
    const activeEffort = planned
      .filter((i) => i.status === "a")
      .reduce((s, i) => s + (i.effort ?? 0), 0);
    const hoursPerPoint = target / (doneEffort + 0.35 * activeEffort);

    let cursor = 0;
    const mine: Task[] = [];
    let oversizeLeft = oversize[`${k}:${person.key}`] ?? 0;

    for (const p of planned) {
      const days = sprint.days;
      let activated: Date | null = null;
      let resolved: Date | null = null;
      if (p.status === "d") {
        // Most items finish inside their estimate; a few run over, fewer far over.
        const e = p.effort ?? 1;
        const roll = rand();
        let d: number;
        if (roll < 0.05 && over < 1 && e <= 3) {
          over++;
          d = 2 * e + 1;
        } else if (roll < 0.2 && risk < 3) {
          risk++;
          d = e + 1;
        } else {
          d = Math.max(1, Math.round(e * between(0.5, 1.0)));
        }
        const a = Math.max(0, Math.min(cursor, 10 - d));
        const r = a + d - 1;
        activated = at(days[a], 9, Math.floor(between(0, 50)));
        resolved = at(days[r], 14, Math.floor(between(0, 50)));
        cursor = Math.min(r + (rand() < 0.5 ? 1 : 0), 9);
      } else if (p.status === "a") {
        activated = at(days[9], 9, 30);
      }

      const stateName = p.status === "d" ? "Done" : p.status === "a" ? "Committed" : "Approved";
      const titles = p.bug ? bugTitles : pbiTitles;
      const title = titles[(p.bug ? bugCursor++ : pbiCursor++) % titles.length];
      const effortField = p.effort === null ? {} : { "Microsoft.VSTS.Scheduling.Effort": p.effort };
      const item = add(
        sprint.path,
        {
          "System.Title": title,
          "System.WorkItemType": p.bug ? "Bug" : "Product Backlog Item",
          "System.State": stateName,
          "System.AssignedTo": identity(person),
          "System.CreatedDate": addDays(sprint.start, -6).toISOString(),
          ...effortField,
          ...(activated ? { "Microsoft.VSTS.Common.ActivatedDate": activated.toISOString() } : {}),
          ...(resolved ? { "Microsoft.VSTS.Common.StateChangeDate": resolved.toISOString() } : {}),
        },
        resolved ?? activated ?? at(sprint.days[2], 10)
      );

      // Tasks under the item, each of six hours or less (bar the deliberate one).
      const ratio = person.ratio * (1 + between(-0.06, 0.06));
      const estimate = Math.max(1, half((p.effort ?? 1) * hoursPerPoint * ratio));
      const count = Math.max(1, Math.ceil(estimate / 4.5));
      const sizes: number[] = [];
      let left = estimate;
      if (oversizeLeft && p.status === "d" && estimate > oversizeLeft + 1) {
        sizes.push(oversizeLeft);
        left -= oversizeLeft;
        oversizeLeft = 0;
      }
      const rest = Math.max(1, count - sizes.length);
      for (let i = 0; i < rest; i++) {
        const size =
          i === rest - 1 ? left : Math.max(0.5, half(left / (rest - i) + (i % 2 ? -0.5 : 0.5)));
        sizes.push(size);
        left -= size;
      }
      sizes.forEach((size, i) => {
        let completed = 0;
        let state = "To Do";
        if (p.status === "d") {
          completed = Math.max(0.5, half((size / ratio) * (1 + between(-0.12, 0.12))));
          state = "Done";
        } else if (p.status === "a" && i === 0) {
          completed = Math.max(0.5, Math.min(size, half(0.35 * (p.effort ?? 1) * hoursPerPoint)));
          state = "In Progress";
        }
        const verb = taskVerbs[person.role][(i + item.id) % 4];
        const taskItem = add(
          sprint.path,
          {
            "System.Title": `${verb} ${title.charAt(0).toLowerCase()}${title.slice(1)}`,
            "System.WorkItemType": "Task",
            "System.State": state,
            "System.AssignedTo": identity(person),
            "Microsoft.VSTS.Scheduling.OriginalEstimate": size,
            "Microsoft.VSTS.Scheduling.CompletedWork": completed,
            "Microsoft.VSTS.Scheduling.RemainingWork":
              state === "Done" ? 0 : half(size - completed),
          },
          // Never inside the last 26 hours unless Task Updates asks for it below.
          new Date(
            Math.min((resolved ?? activated ?? at(sprint.days[2], 10)).getTime(), now - 26 * HOUR)
          )
        );
        mine.push({ person, item: taskItem, completed });
      });
    }

    // Trim the logged hours so the sprint lands on its target utilisation.
    const logged = mine.reduce((s, t) => s + t.completed, 0);
    const done = mine.filter((t) => t.item.fields["System.State"] === "Done");
    if (done.length && Math.abs(target - logged) >= 0.5) {
      const big = done.reduce((a, b) => (a.completed >= b.completed ? a : b));
      const next = Math.max(0.5, half(big.completed + target - logged));
      big.completed = next;
      big.item.fields["Microsoft.VSTS.Scheduling.CompletedWork"] = next;
    }
    if (k === LAST) sprintTasks.push(...mine);
  }
});

// Task Updates: who touched a task in the last 24 hours, and how many hours are
// logged on tasks changed in the last six. One person is quiet since yesterday.
const touch = (key: string, hoursAgo: number[], limit: number) => {
  const mine = sprintTasks
    .filter((t) => t.person.key === key && t.completed > 0)
    .sort((a, b) => b.completed - a.completed);
  let sum = 0;
  for (const h of hoursAgo) {
    const t = mine.find(
      (x) =>
        x.item.changed.getTime() <= now - 26 * HOUR && (limit === 0 || sum + x.completed <= limit)
    );
    if (!t) continue;
    sum += t.completed;
    t.item.changed = new Date(now - h * HOUR);
    t.item.fields["System.ChangedDate"] = t.item.changed.toISOString();
  }
};
touch("priya", [1, 2.5, 4], 0);
touch("tom", [3, 5], 0);
touch("maria", [2, 5.5], 0);
touch("chen", [1.5], 5);
touch("sam", [9], 0);
touch("ruth", [31], 0);

const byId = new Map(items.map((wi) => [wi.id, wi]));

// ── Repositories, commits, pull requests and pipeline runs ─────────────────

const repos = [
  { id: "3f0c1d52-8a64-4e7b-9c21-5b6a7d8e9f01", name: "billing-api" },
  { id: "3f0c1d52-8a64-4e7b-9c21-5b6a7d8e9f02", name: "web-portal" },
  { id: "3f0c1d52-8a64-4e7b-9c21-5b6a7d8e9f03", name: "payments-worker" },
  { id: "3f0c1d52-8a64-4e7b-9c21-5b6a7d8e9f04", name: "e2e-tests" },
];
// Share of the team's commits, and how each person's work splits across the repos.
const authorWeight = [0.25, 0.22, 0.2, 0.18, 0.08, 0.07];
const repoWeight = [
  [0.5, 0.2, 0.3, 0],
  [0.3, 0.45, 0.25, 0],
  [0.4, 0.2, 0.4, 0],
  [0.3, 0.4, 0.3, 0],
  [0.05, 0.05, 0, 0.9],
  [0, 0.95, 0, 0.05],
];

const HISTORY_DAYS = 180;
/** Busier as the team settles in, with a quiet fortnight over a holiday. */
const pace = (back: number) =>
  back >= 96 && back <= 104 ? 0.35 : 0.85 + 0.25 * (1 - back / HISTORY_DAYS);
const hex = (i: number, salt: number) =>
  (((i + 1) * 2654435761 + salt * 40503) >>> 0).toString(16).padStart(8, "0");

interface Commit {
  commitId: string;
  repo: (typeof repos)[number];
  person: Person;
  date: Date;
  changeCounts: Record<string, number>;
}
interface PullRequest {
  pullRequestId: number;
  status: number;
  isDraft: boolean;
  creationDate: string;
  closedDate?: string;
  createdBy: { displayName: string; uniqueName: string };
  repository: { id: string; name: string };
}
interface Build {
  requestedFor: { displayName: string; uniqueName: string };
  queueTime: Date;
}
const commits: Commit[] = [];
const pullRequests: PullRequest[] = [];
const builds: Build[] = [];

for (let back = HISTORY_DAYS; back >= 0; back--) {
  const day = addDays(midnight(new Date()), -back);
  const weekday = isWeekday(day);
  const busy = weekday ? pace(back) : 0.06;
  const commitCount = weekday
    ? Math.round((between(0, 4) + between(0, 4)) * busy)
    : rand() < busy
      ? 1
      : 0;
  const prCount = weekday ? Math.round((between(0, 4) + between(0, 4)) * busy) : 0;

  for (let c = 0; c < commitCount; c++) {
    const a = pickWeighted([0, 1, 2, 3, 4, 5], authorWeight);
    const person = people[a];
    const date = new Date(day.getTime() + between(9, 18) * HOUR);
    if (date.getTime() > now - HOUR) continue;
    const repo = pickWeighted(repos, repoWeight[a]);
    const index = commits.length;
    commits.push({
      commitId: hex(index, 1) + hex(index, 2) + hex(index, 3) + hex(index, 4) + hex(index, 5),
      repo,
      person,
      date,
      changeCounts: {
        Add: Math.floor(between(0, 4)),
        Edit: Math.floor(between(2, 14)),
        Delete: Math.floor(between(0, 3)),
      },
    });
    const runs = rand() < 0.6 ? 2 : 1;
    for (let r = 0; r < runs; r++) {
      builds.push({
        requestedFor: { displayName: person.name, uniqueName: person.email },
        queueTime: new Date(date.getTime() - between(8, 40) * 60_000),
      });
    }
  }

  for (let c = 0; c < prCount; c++) {
    const a = pickWeighted([0, 1, 2, 3, 4, 5], authorWeight);
    const person = people[a];
    const created = new Date(day.getTime() + between(9, 17.5) * HOUR);
    if (created.getTime() > now - HOUR) continue;
    const repo = pickWeighted(repos, repoWeight[a]);
    const closed = new Date(created.getTime() + between(2, 60) * HOUR);
    const roll = rand();
    const open = closed.getTime() > now - HOUR || roll > 0.97;
    pullRequests.push({
      pullRequestId: 1200 + pullRequests.length,
      status: open ? 1 : roll > 0.9 ? 2 : 3,
      isDraft: false,
      creationDate: created.toISOString(),
      ...(open ? {} : { closedDate: closed.toISOString() }),
      createdBy: { displayName: person.name, uniqueName: person.email },
      repository: { id: repo.id, name: repo.name },
    });
  }
}

// ── Extension data: who may open the hub, and what Alex last looked at ─────

const stamp = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
const extensionData = extensionDataService({
  SprintPerfTrackerSettings: {
    "access-control": {
      version: 1,
      users: [
        {
          email: "alex.morgan@contoso.com",
          displayName: "Alex Morgan",
          role: "admin",
          addedBy: "system",
          addedAt: stamp(150),
        },
        {
          email: "priya.shah@contoso.com",
          displayName: "Priya Shah",
          role: "admin",
          addedBy: "alex.morgan@contoso.com",
          addedAt: stamp(112),
        },
        {
          email: "tom.ellis@contoso.com",
          displayName: "Tom Ellis",
          role: "viewer",
          addedBy: "alex.morgan@contoso.com",
          addedAt: stamp(97),
        },
        {
          email: "ruth.adams@contoso.com",
          displayName: "Ruth Adams",
          role: "viewer",
          addedBy: "priya.shah@contoso.com",
          addedAt: stamp(41),
          allowedTeamIds: [TEAM_ID],
        },
        {
          email: "maria.lopez@contoso.com",
          displayName: "Maria Lopez",
          role: "viewer",
          addedBy: "alex.morgan@contoso.com",
          addedAt: stamp(18),
        },
      ],
    },
  },
  SprintPerfTrackerUserPrefs: {
    "user-preferences": { selectedTeamIds: [TEAM_ID], lookback: 6 },
  },
});

export const services: Record<string, unknown> = {
  [CommonServiceIds.ProjectPageService]: projectPageService("Contoso"),
  [CommonServiceIds.ExtensionDataService]: extensionData,
};

// ── REST clients ───────────────────────────────────────────────────────────

/** Every quoted value after a WIQL field, e.g. the paths in `IterationPath IN ('a', 'b')`. */
const wiqlValues = (query: string, field: string) => {
  const match = new RegExp(`${field}\\]\\s*(?:=|IN)\\s*\\(?((?:\\s*'[^']*'\\s*,?)+)`).exec(query);
  return match ? [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1].replace(/\\\\/g, "\\")) : [];
};

const iterationFor = (s: (typeof sprints)[number]) => ({
  id: s.id,
  name: s.name,
  path: s.path,
  attributes: {
    startDate: s.start.toISOString(),
    finishDate: s.finish.toISOString(),
    timeFrame: s.finish.getTime() < now ? 0 : 1,
  },
});

const page = <T>(all: T[], skip = 0, top = all.length) => all.slice(skip, skip + top);

export const getClient = clientFactory({
  CoreRestClient: {
    getTeams: () =>
      delay(
        [
          { id: DEFAULT_TEAM_ID, name: "Contoso Team" },
          { id: TEAM_ID, name: "Billing Team" },
        ],
        120
      ),
  },
  WorkRestClient: {
    // The project's default team has no sprints, so the hub hides it.
    getTeamIterations: (ctx: { teamId: string }) =>
      delay(ctx.teamId === TEAM_ID ? sprints.map(iterationFor) : [], 120),
    getCapacitiesWithIdentityRefAndTotals: (_ctx: unknown, iterationId: string) => {
      const k = sprints.findIndex((s) => s.id === iterationId);
      const sprint = sprints[k];
      return delay(
        {
          teamMembers: people.map((p) => {
            const off = daysOff(p, k);
            return {
              teamMember: identity(p),
              activities: [{ name: p.role, capacityPerDay: p.capacityPerDay }],
              daysOff: off
                ? [
                    {
                      start: sprint.days[off[0]].toISOString(),
                      end: sprint.days[off[1]].toISOString(),
                    },
                  ]
                : [],
            };
          }),
        },
        150
      );
    },
    getTeamDaysOff: () => delay({ daysOff: [] }, 100),
  },
  WorkItemTrackingRestClient: {
    queryByWiql: (wiql: { query: string }) => {
      const paths = wiqlValues(wiql.query, "System.IterationPath");
      const types = wiqlValues(wiql.query, "System.WorkItemType");
      const since = /ChangedDate\]\s*>=\s*'(\d{4}-\d{2}-\d{2})'/.exec(wiql.query)?.[1];
      const sinceTime = since ? new Date(`${since}T00:00:00Z`).getTime() : 0;
      const matches = items.filter(
        (wi) =>
          paths.includes(wi.iteration) &&
          types.includes(wi.type) &&
          wi.fields["System.State"] !== "Removed" &&
          wi.changed.getTime() >= sinceTime
      );
      return delay({ workItems: matches.map((wi) => ({ id: wi.id })) }, 250);
    },
    getWorkItems: (ids: number[]) => delay(ids.map((id) => byId.get(id)).filter(Boolean), 200),
  },
  GitRestClient: {
    getRepositories: () => delay(repos, 100),
    getCommits: (
      repoId: string,
      criteria: { fromDate?: string; toDate?: string; $top?: number; $skip?: number }
    ) => {
      const from = criteria.fromDate ? new Date(criteria.fromDate).getTime() : 0;
      const to = criteria.toDate ? new Date(criteria.toDate).getTime() : Infinity;
      const mine = commits
        .filter((c) => c.repo.id === repoId && c.date.getTime() >= from && c.date.getTime() <= to)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map((c) => ({
          commitId: c.commitId,
          author: { name: c.person.name, email: c.person.email, date: c.date.toISOString() },
          committer: { date: c.date.toISOString() },
        }));
      return delay(page(mine, criteria.$skip ?? 0, criteria.$top ?? 100), 60);
    },
    getCommit: (commitId: string) =>
      delay(
        { commitId, changeCounts: commits.find((c) => c.commitId === commitId)?.changeCounts },
        5
      ),
    getPullRequestsByProject: (
      _project: string,
      criteria: { minTime?: Date; maxTime?: Date },
      _maxComment?: number,
      skip?: number,
      top?: number
    ) => {
      const from = criteria.minTime ? new Date(criteria.minTime).getTime() : 0;
      const to = criteria.maxTime ? new Date(criteria.maxTime).getTime() : Infinity;
      const mine = pullRequests
        .filter((pr) => {
          const created = new Date(pr.creationDate).getTime();
          return created >= from && created <= to;
        })
        .sort((a, b) => b.creationDate.localeCompare(a.creationDate));
      return delay(page(mine, skip ?? 0, top ?? 100), 80);
    },
  },
  BuildRestClient: {
    getBuilds: (
      _project: string,
      _definitions?: unknown,
      _queues?: unknown,
      _buildNumber?: unknown,
      minTime?: Date,
      maxTime?: Date
    ) => {
      const from = minTime ? new Date(minTime).getTime() : 0;
      const to = maxTime ? new Date(maxTime).getTime() : Infinity;
      return delay(
        builds.filter((b) => b.queueTime.getTime() >= from && b.queueTime.getTime() <= to),
        80
      );
    },
  },
});
