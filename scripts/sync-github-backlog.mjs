import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apply = process.argv.includes("--apply");
const manifestPath = fileURLToPath(
  new URL("../docs/planning/backlog-v0.3-v1.0.json", import.meta.url),
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function gh(args, { json = false } = {}) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(
      `gh ${args.join(" ")} failed:\n${result.stderr || result.stdout}`,
    );
  }

  const output = result.stdout.trim();
  return json && output ? JSON.parse(output) : output;
}

function issueBody(issue) {
  const dependencies = issue.dependsOn.length
    ? issue.dependsOn.map((id) => `- ${id}`).join("\n")
    : "- None";
  const acceptance = issue.acceptance
    .map((criterion) => `- [ ] ${criterion}`)
    .join("\n");

  return `## Milestone and issue id

${issue.version} / ${issue.id}

## Outcome

${issue.outcome}

## Dependencies

${dependencies}

## Acceptance evidence

${acceptance}

## Scope guardrails

- Preserve constraint-first, server-authoritative, zero-signup product invariants.
- Keep provider payloads and secrets outside domain and client contracts.
- Update tests, changelog, roadmap/milestone records, and ADRs when their facts change.
- Provision providers, paid resources, production data, tags, and releases only with explicit owner approval.

## Risk and recovery

Document failure modes, privacy/security impact, rollback or forward recovery, and any owner action in the implementing pull request.`;
}

const codes = new Set();
for (const issue of manifest.issues) {
  if (codes.has(issue.id)) throw new Error(`Duplicate issue id: ${issue.id}`);
  codes.add(issue.id);
  if (!manifest.milestones.some(({ version }) => version === issue.version)) {
    throw new Error(`Unknown milestone ${issue.version} for ${issue.id}`);
  }
}

if (!apply) {
  console.log(
    `Dry run: ${manifest.issues.length} issues, ${manifest.milestones.length} milestones, ${manifest.labels.length} labels.`,
  );
  console.log("Run pnpm backlog:sync only after approving GitHub writes.");
  process.exit(0);
}

for (const label of manifest.labels) {
  gh([
    "label",
    "create",
    label.name,
    "--repo",
    manifest.repository,
    "--color",
    label.color,
    "--description",
    label.description,
    "--force",
  ]);
}

const remoteMilestones = gh(
  ["api", `repos/${manifest.repository}/milestones?state=all&per_page=100`],
  { json: true },
);
const milestoneByTitle = new Map(
  remoteMilestones.map((milestone) => [milestone.title, milestone]),
);

for (const milestone of manifest.milestones) {
  if (milestoneByTitle.has(milestone.title)) continue;
  const created = gh(
    [
      "api",
      `repos/${manifest.repository}/milestones`,
      "--method",
      "POST",
      "--field",
      `title=${milestone.title}`,
      "--field",
      `description=${milestone.description}`,
      "--field",
      "state=open",
    ],
    { json: true },
  );
  milestoneByTitle.set(created.title, created);
}

const existingIssues = gh(
  [
    "issue",
    "list",
    "--repo",
    manifest.repository,
    "--state",
    "all",
    "--limit",
    "1000",
    "--json",
    "number,title,url",
  ],
  { json: true },
);
const issueByCode = new Map();
for (const issue of existingIssues) {
  const code = issue.title.match(/^CQ-\d+/)?.[0];
  if (code) issueByCode.set(code, issue);
}

let createdCount = 0;
let skippedCount = 0;
for (const issue of manifest.issues) {
  const expectedTitle = `${issue.id}: ${issue.title}`;
  const existing = issueByCode.get(issue.id);
  if (existing) {
    if (existing.title !== expectedTitle) {
      throw new Error(
        `${issue.id} already exists with a different title: ${existing.title}`,
      );
    }
    skippedCount += 1;
    console.log(`SKIP ${issue.id} #${existing.number} ${existing.url}`);
    continue;
  }

  const milestone = manifest.milestones.find(
    ({ version }) => version === issue.version,
  );
  const labels = [
    `type:${issue.type}`,
    issue.dependsOn.length ? "status:blocked" : "status:planned",
    `phase:${issue.version}`,
    ...issue.labels,
  ];
  const url = gh([
    "issue",
    "create",
    "--repo",
    manifest.repository,
    "--title",
    expectedTitle,
    "--body",
    issueBody(issue),
    "--label",
    labels.join(","),
    "--milestone",
    milestone.title,
  ]);
  createdCount += 1;
  console.log(`CREATE ${issue.id} ${url}`);
}

console.log(
  `Backlog sync complete: ${createdCount} created, ${skippedCount} already present.`,
);
