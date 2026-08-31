import { readFile } from "node:fs/promises";

const productVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(preview|beta|rc)\.([1-9]\d*))?$/;
const releaseTag =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(preview|beta|rc)\.([1-9]\d*))?$/;

const requestedTag =
  readTagArgument(process.argv.slice(2)) ?? process.env.RELEASE_TAG;
const packagePaths = [
  "package.json",
  "apps/web/package.json",
  "packages/domain/package.json",
];

const manifests = await Promise.all(
  packagePaths.map(async (path) => ({
    path,
    value: JSON.parse(
      await readFile(new URL(`../${path}`, import.meta.url), "utf8"),
    ),
  })),
);

const versions = new Set(manifests.map(({ value }) => value.version));
if (versions.size !== 1) {
  fail(
    `Product package versions differ: ${manifests.map(({ path, value }) => `${path}=${value.version}`).join(", ")}`,
  );
}

const [version] = versions;
if (!productVersion.test(version)) {
  fail(
    `Package version must be MAJOR.MINOR.PATCH with an optional preview, beta, or rc suffix; received ${version}`,
  );
}

if (requestedTag) {
  const match = releaseTag.exec(requestedTag);
  if (!match) {
    fail(
      `Release tag must be vMAJOR.MINOR.PATCH with an optional -preview.N, -beta.N, or -rc.N suffix; received ${requestedTag}`,
    );
  }

  const tagVersion = requestedTag.slice(1);
  if (tagVersion !== version) {
    fail(
      `Release tag ${requestedTag} does not match package version ${version}`,
    );
  }
}

const changelog = await readFile(
  new URL("../CHANGELOG.md", import.meta.url),
  "utf8",
);
const escapedVersion = version.replaceAll(".", "\\.");
const releaseHeading = new RegExp(
  `^## \\[(?:v)?${escapedVersion}\\](?: - .+)?$|^## (?:v)?${escapedVersion}(?: - .+)?$`,
  "m",
);
if (!releaseHeading.test(changelog)) {
  fail(`CHANGELOG.md is missing a release heading for ${version}`);
}

console.log(
  requestedTag
    ? `Release preflight passed for ${requestedTag}.`
    : `Version baseline ${version} is aligned across packages and changelog.`,
);

function readTagArgument(arguments_) {
  const index = arguments_.indexOf("--tag");
  if (index === -1) return undefined;
  if (!arguments_[index + 1]) fail("--tag requires a value");
  return arguments_[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
