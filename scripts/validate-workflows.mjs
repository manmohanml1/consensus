import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const workflowRoot = join(repositoryRoot, ".github", "workflows");
const workflowFiles = await collectWorkflowFiles(workflowRoot);
const failures = [];

for (const file of workflowFiles) {
  const displayPath = relative(repositoryRoot, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);

  rejectPattern(
    source,
    /\bpull_request_target\s*:/,
    displayPath,
    "pull_request_target is forbidden",
  );
  rejectPattern(
    source,
    /permissions:\s*write-all/,
    displayPath,
    "write-all permissions are forbidden",
  );
  rejectPattern(
    source,
    /continue-on-error:\s*true/,
    displayPath,
    "continue-on-error may not hide a failed security or quality gate",
  );

  if (!lines.some((line) => /^permissions:/.test(line))) {
    failures.push(`${displayPath}: declare top-level default permissions`);
  }

  for (const [index, line] of lines.entries()) {
    const usesMatch = line.match(/^\s*uses:\s*([^\s#]+)/);
    if (!usesMatch) continue;

    const action = usesMatch[1];
    if (action.startsWith("./")) continue;

    const separator = action.lastIndexOf("@");
    const reference = separator === -1 ? "" : action.slice(separator + 1);
    if (!/^[0-9a-f]{40}$/.test(reference)) {
      failures.push(
        `${displayPath}:${index + 1}: external action ${action} must use a full 40-character commit SHA`,
      );
    }

    if (action.startsWith("actions/checkout@")) {
      const checkoutBlock = lines.slice(index + 1, index + 7).join("\n");
      if (!/persist-credentials:\s*false/.test(checkoutBlock)) {
        failures.push(
          `${displayPath}:${index + 1}: checkout must set persist-credentials: false`,
        );
      }
    }
  }

  const jobsIndex = lines.findIndex((line) => line === "jobs:");
  if (jobsIndex === -1) {
    failures.push(`${displayPath}: workflow must declare jobs`);
    continue;
  }

  const workflowPreamble = lines.slice(0, jobsIndex).join("\n");
  if (/^  [a-z-]+:\s*write\s*$/m.test(workflowPreamble)) {
    failures.push(
      `${displayPath}: write permissions must be scoped to the job that needs them`,
    );
  }

  const jobs = [];
  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (match) jobs.push({ name: match[1], line: index });
  }

  for (const [index, job] of jobs.entries()) {
    const end = jobs[index + 1]?.line ?? lines.length;
    const block = lines.slice(job.line + 1, end).join("\n");
    if (!/^    timeout-minutes:\s*\d+/m.test(block)) {
      failures.push(
        `${displayPath}:${job.line + 1}: job ${job.name} needs a timeout-minutes bound`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("GitHub Actions policy violations:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `GitHub Actions policy passed for ${workflowFiles.length} workflow${workflowFiles.length === 1 ? "" : "s"}.`,
);

async function collectWorkflowFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectWorkflowFiles(path)));
    } else if (/\.ya?ml$/i.test(entry.name)) {
      files.push(path);
    }
  }

  return files.sort();
}

function rejectPattern(source, pattern, path, message) {
  if (pattern.test(source)) failures.push(`${path}: ${message}`);
}
