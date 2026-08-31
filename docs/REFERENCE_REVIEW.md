# Reference review

## Blueprint retained

- zero-signup invitation;
- fast, playful voting;
- compact option deck;
- immediate successful-match feedback;
- fallback instead of endless deadlock;
- food as the initial category.

## Blueprint corrected

- Replace client/master-client authority with transactional server authority.
- Replace mutable active-presence unanimity with a locked eligible roster.
- Replace “Borda + Nash” labeling with an explicit tested maximin/utility ruleset.
- Separate hard constraints from negative preferences.
- Replace universal sub-30 ms promises with measured service objectives.
- Replace the free-tier production guarantee with cost budgets and migration thresholds.
- Replace public OSM/Nominatim production dependence with a licensed provider decision.
- Preserve missing place fields instead of inventing ratings, reviews, price, images or hours.

## Patterns adopted from owner repositories

From CommitQuest: source precedence, milestone contracts, deterministic domain rules, provider adapters, infrastructure introduced only when exercised, and explicit release authorization.

From Ghostwriter: a stable aggregate CI gate, migration verification, browser regression evidence, server-only credentials, optimistic concurrency, visible failures, forward-only migrations, and production approval boundaries.

From portfolio-website: security headers, secret checks, CodeQL, Dependabot, environment-aware validation, immutable artifacts, and checked-in graceful fallback behavior.

## DevOps and supply-chain references assessed

- [BretFisher/github-actions-templates](https://github.com/BretFisher/github-actions-templates): adopted immutable action SHAs, testable workflow policy, narrow permissions, and Dependabot-maintained action references. External reusable workflows are deferred until several owner repositories share a stable contract.
- [semantic-release/semantic-release](https://github.com/semantic-release/semantic-release): adopted Conventional Commit release classification, SHA pins, job-scoped release permissions, OpenSSF Scorecard, and a stable aggregate check. Automatic publication after every qualifying `main` commit was rejected because Consensus requires explicit owner authorization for the exact tag and GitHub Release.
- [NotHarshhaa/devops-project-templates](https://github.com/NotHarshhaa/devops-project-templates): adopted the separation of CI, security, deployment, documentation, and rollback concerns. Its Docker/Kubernetes/Terraform topology, mutable action examples, tolerated scanner failures, and long-lived AWS credential examples were not copied.
- [NotHarshhaa/DevOps-Projects](https://github.com/NotHarshhaa/DevOps-Projects) and [techiescamp/devops-tools](https://github.com/techiescamp/devops-tools): treated as learning catalogs, not drop-in production baselines. Their container/cloud patterns remain future references if Consensus owns that infrastructure.
- [myugan/awesome-cicd-security](https://github.com/myugan/awesome-cicd-security): used to identify workflow-compromise risks and zizmor/Scorecard controls. The curated list itself is not an executable security policy.

ADR 0011 records the resulting architecture-specific decision. Consensus does not add infrastructure merely to resemble a generic DevOps repository.
