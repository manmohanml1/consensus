import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const failures = [];
const markdownFiles = [
  ...(await collectMarkdownFiles(repositoryRoot, { rootOnly: true })),
  ...(await collectMarkdownFiles(join(repositoryRoot, "docs"))),
  ...(await collectMarkdownFiles(join(repositoryRoot, ".github"))),
].sort();

for (const file of markdownFiles) {
  const source = await readFile(file, "utf8");
  const displayPath = repositoryPath(file);

  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = markdownTarget(match[1]);
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;

    const path = decodeURIComponent(target.split("#", 1)[0].split("?", 1)[0]);
    if (!path) continue;

    try {
      await access(resolve(dirname(file), path));
    } catch {
      failures.push(`${displayPath}: missing relative link target ${target}`);
    }
  }

  if (
    /^(?:ROADMAP\.md|docs\/(?:issues|milestones)\/)/.test(displayPath) &&
    /implemented on `(?:codex|feat|fix|docs|refactor|test|build|ci|chore|release)\//i.test(
      source,
    )
  ) {
    failures.push(
      `${displayPath}: implementation status must reference merged main/PR evidence, not a topic branch`,
    );
  }
}

const roadmapPath = join(repositoryRoot, "ROADMAP.md");
const roadmap = await readFile(roadmapPath, "utf8");
const roadmapRows = [
  ...roadmap.matchAll(
    /^\|\s*(\d+\.\d+(?:\.\d+)?)\s*\|.*\|\s*(Complete|Acceptance|Active|Planned)\s*\|$/gm,
  ),
].map(([, version, status]) => ({ version, status }));

if (roadmapRows.length === 0) {
  failures.push("ROADMAP.md: no version/status rows found");
}

const activeRows = roadmapRows.filter(({ status }) => status === "Active");
if (activeRows.length !== 1) {
  failures.push(
    `ROADMAP.md: expected exactly one Active version, found ${activeRows.length}`,
  );
}

const activeIndex = roadmapRows.findIndex(({ status }) => status === "Active");
for (const [index, row] of roadmapRows.entries()) {
  if (index < activeIndex && !["Complete", "Acceptance"].includes(row.status)) {
    failures.push(
      `ROADMAP.md: ${row.version} precedes the active milestone but is ${row.status}`,
    );
  }
  if (index > activeIndex && row.status !== "Planned") {
    failures.push(
      `ROADMAP.md: ${row.version} follows the active milestone but is ${row.status}`,
    );
  }
}

const manifestPath = join(
  repositoryRoot,
  "docs",
  "planning",
  "backlog-v0.3-v1.0.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const roadmapVersions = new Set(roadmapRows.map(({ version }) => version));
const issueIds = new Set(manifest.issues.map(({ id }) => id));
const milestoneOrder = new Map(
  manifest.milestones.map(({ version }, index) => [version, index]),
);

for (const { version } of manifest.milestones) {
  if (!roadmapVersions.has(version)) {
    failures.push(`ROADMAP.md: missing backlog milestone ${version}`);
  }
}

for (const issue of manifest.issues) {
  for (const dependency of issue.dependsOn) {
    if (!issueIds.has(dependency)) {
      failures.push(`${issue.id}: unknown dependency ${dependency}`);
      continue;
    }

    const dependencyIssue = manifest.issues.find(({ id }) => id === dependency);
    if (
      milestoneOrder.get(dependencyIssue.version) >
      milestoneOrder.get(issue.version)
    ) {
      failures.push(
        `${issue.id}: dependency ${dependency} belongs to later milestone ${dependencyIssue.version}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation contract violations:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Documentation contract passed for ${markdownFiles.length} Markdown files, ${roadmapRows.length} roadmap versions, and ${manifest.issues.length} backlog issues.`,
);

async function collectMarkdownFiles(directory, { rootOnly = false } = {}) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (
      [
        ".git",
        ".next",
        "node_modules",
        "playwright-report",
        "test-results",
      ].includes(entry.name)
    ) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!rootOnly) files.push(...(await collectMarkdownFiles(path)));
    } else if (extname(entry.name).toLowerCase() === ".md") {
      files.push(path);
    }
  }

  return files;
}

function markdownTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  if (trimmed.startsWith("<")) return trimmed.slice(1, trimmed.indexOf(">"));
  return trimmed.split(/\s+/, 1)[0];
}

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll("\\", "/");
}
