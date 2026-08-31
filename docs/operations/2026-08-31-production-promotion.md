# Production promotion record — 2026-08-31

## Outcome

The owner explicitly authorized staged commit `5aeaaf406d020f71577548a1d49120c830cd6ce2` for Production. Vercel promoted the already-built Production artifact without rebuilding it, and `https://consensus-web-navy.vercel.app/` now resolves to that deployment.

## Evidence

- GitHub workflow run: [Consensus Production Promotion #3](https://github.com/manmohanml1/consensus/actions/runs/33412438233)
- Protected-environment approval: 2026-08-31 at approximately 16:09 UTC
- Vercel project: `consensus-web`
- Vercel deployment ID: `dpl_7iPySihohKXf5ChZiNFzzvGncMuh`
- Immutable deployment URL: `https://consensus-g6h4via64-manmohanlonawat-8572s-projects.vercel.app/`
- Source branch and SHA: `main` / `5aeaaf406d020f71577548a1d49120c830cd6ce2`
- Production URL: `https://consensus-web-navy.vercel.app/`
- Browser smoke: the host-created decision setup rendered and remained interactive
- HTTP smoke: `200`, HTML response, expected security-header baseline present
- Runtime review: no application exception was observed; audit-client range requests produced four `416` access-log entries and are not an application failure

## Workflow false-negative

The Vercel promotion endpoint returned a successful empty response. The workflow then attempted to parse that empty file as JSON, reported failure, and skipped its built-in HTTP smoke step even though the alias had moved successfully. GitHub issue #118 and its corrective pull request make JSON optional, retain non-2xx failure behavior, and verify the Production alias against the exact deployment before the smoke check.

## Recovery

The last known Production artifact before this promotion represented commit `707efccf0f2c37b0e836d98926a04c37769610b5` at deployment `dpl_88JarSNma3U1aKTCFWxKgi2pVcPn`. It is the identified rollback candidate, not an automatically authorized rollback target. A live rollback-and-restore rehearsal remains separately owner-gated because it intentionally changes Production traffic twice.
