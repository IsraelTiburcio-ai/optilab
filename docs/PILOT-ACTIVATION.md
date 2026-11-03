# Private activation candidate — second authorization required

Nothing in this PR activates on merge. The regular `deploy.yml` remains pinned OFF.
No Firebase Rules/index command runs in CI. No APIs, billing settings, Auth accounts,
participant grants, operator environments or GitHub secrets have been configured by this delivery.
The additional frontend workflow is manual, main-only, protected, and rejects missing approval.

## Concrete decisions awaiting final owner approval

| Decision | Proposed value / blocking choice |
|---|---|
| Participants | At most five adults, operator-attested, fictitious profiles/results only; no students. Exact UID list stays private and is currently empty. |
| Primary operator | IsraelTiburcio-ai, responsible for supervised sessions, receipts, incident response and deletion verification. |
| Backup / deployment reviewer | A distinct named GitHub operator is required before opening; currently unassigned. No unattended sessions. |
| Duration | Owner chooses absolute start/end UTC, maximum fourteen days. Each admission is at most seven days and capped at pilot end. No silent renewal. |
| Consent | Adventure/import and attempts remain independently accepted/declined; admission accepts neither. |
| Retention | Application data, managed exports, UID fences and test Auth identities: reviewed deletion no later than fourteen days after pilot end. Earlier withdrawal starts immediate reviewed erasure. No automatic TTL or background erasure is installed. |
| Export location | Propose an operator-only folder outside Git on the Mac's verified encrypted volume, 0700 directory / 0600 files. Exact absolute path and encryption verification must be approved. No email/shared drives or CI artifacts containing exports. |
| Export deletion | At retention deadline remove managed copies and obtain Mac/iPhone/download/external-backup receipts; approve backup exclusion or a verified removal procedure before collecting data. A SHA-256 digest proves integrity, not encryption or external deletion. |
| Accounts | Delete only disposable Firebase Auth identities created for this pilot, after UID export/erasure verification and separate per-UID confirmation. Existing adult Firebase identities are retained unless separately authorized. Deleting Firebase Auth never deletes a Google account. |
| Consumption | Whole project rolling 24h: stop at 5,000 reads, 1,000 writes or 1,000 deletes. Soft storage stop: 2,000 documents total / 500 per UID. Inventory and Rules reads count too. Metrics may lag; these are operational thresholds, not hard billing caps. Spark/unlinked billing must be verified; never enable Blaze to continue. |
| Operating cadence | Operator records usage before opening and every fifteen minutes. A twenty-minute server lease expires without supervision. Daily bounded document inventory, not a full scan every fifteen minutes. |

`config/private-pilot.proposed.json` contains these policies with **authorization=null**, no dates,
no frontend SHA, no backup, no export directory and no participants. It cannot activate.
Copy it to ignored `.pilot-private/decisions.json` only after owner approval. Set exact UTC
start/end, both operators, approved private UID attestations, approved frontend merge SHA,
export location/encryption and enabled-services inventory hash. `authorization` must contain
`scope: private-pilot-v1`, `approvedBy`, `approvedAt`, and the exact `decisionDigest` printed
by `npm run pilot:activation -- plan --manifest .pilot-private/decisions.json`.
Editing decisions invalidates that digest. This is an operator acknowledgement; IAM and Rules
remain the access controls. The operator's ADC principal and GitHub reviewers must be reviewed.
No student identity, UID list or secrets belong in the public PR.

## Rules deployment and admission — later, after second authorization

1. Pin the approved frontend commit and verify its ten PR checks. Run `npm ci`,
   `npm run test:pilot`, `npm run build`, and `node scripts/build-pilot-rules.mjs`.
   Store the candidate `shasum -a 256 firestore.pilot.rules` with the approval.
2. Before changing anything, capture active Rules release/source hash, billing and services:
   `npm run pilot:platform -- --inspect > .pilot-private/platform-before.json`.
   This performs metadata GETs only; ADC/IAM denial is BLOCKED, never permission to enable APIs.
   Keep a reviewed private copy of existing Rules/source/release identity for recovery. If another
   application uses this Firestore project, review the diff against its active Rules too.
3. After the second authorization **only**, the operator may run this narrowly scoped command:
   `npx firebase-tools@15.0.0 deploy --only firestore:rules --project optilab-cd829 --config firebase.production.json`.
   It is an instruction, not a command executed by this PR. No indexes are needed for this pilot;
   index publication, billing changes or an API-enable prompt require a separate review; stop.
4. Repeat `pilot:platform -- --inspect`. Require PASS for all metadata and exact candidate source
   hash, `candidateDeployed=true`, `billingEnabled=false`, unchanged approved enabled-service
   inventory. Test direct SDK denial for a non-admitted verified disposable account; verify own-only
   membership and read/write denial before opening. Do not create real participant data for this test.
5. Create a private usage receipt below and obtain the owner-approved decision digest. Execute
   `prepare` with exact action:digest confirmation. It verifies every listed Auth identity is enabled
   and email-verified; no account is created. It writes an immutable absolute window and initially
   paused control, then grants only the approved UIDs. Grants never exceed seven days or the
   fixed end. Repeating preparation does not extend them. Partial failure leaves control paused;
   review and remove/revoke unexpected grants before proceeding. Direct legacy production
   `pilot-admin admit` is disabled; use the approved manifest.
6. Execute `open` only with fresh platform/usage receipts, the exact prepared window and exact
   approved active membership. Before touching production set `OPTILAB_PILOT_SECOND_AUTHORIZATION`
   to the separately approved decision digest; this acknowledgement is not a token. Commands:

```
npm run pilot:activation -- plan --manifest .pilot-private/decisions.json
npm run pilot:activation -- prepare --manifest .pilot-private/decisions.json --usage .pilot-private/usage.json --target production --execute --confirm prepare:DIGEST
npm run pilot:activation -- open --manifest .pilot-private/decisions.json --usage .pilot-private/usage.json --target production --execute --confirm open:DIGEST
```

Production commands inspect metadata live, not an operator-supplied platform file. Default runs
are offline dry-run and never initialize Firebase. The above executed commands were **not run**
on production. `--target emulator` uses only Auth 9199 / Firestore 8185, demo-optilab-sync and
accepts a fixture `--platform` file for rehearsals. No endpoint overrides to real services.

## Controlled frontend publication — later, after second authorization

Create `private-pilot-approval` GitHub environment only after approval. Configure the two named
reviewers, prevent self-review, disable administrator bypass and restrict deployments to main.
The workflow queries environment metadata and rejects missing/unverifiable protection. Its
read-only token may need Actions-read permission; a 403 is BLOCKED, not a bypass.

Store **environment-scoped** `PILOT_MANIFEST_JSON`, `PILOT_PLATFORM_JSON`, `PILOT_USAGE_JSON`
from the approved private decisions and fresh operator receipts. Set the six existing public
Firebase build variables for this environment as for normal Pages; no SDK/admin keys in CI.
Dispatch `Private pilot frontend (manual, separate owner approval)` on **main** with the exact
approved decision digest. A different reviewer approves the job. The workflow rejects a changed
frontend SHA, stale receipts, unverified Rules, linked billing, changed services or threshold hits.
The decision SHA is filled **after merging this candidate PR**, so there is no circular commit hash.
It rechecks freshness immediately before Pages publication. Only `dist` is uploaded; private
manifest/receipts live in runner temp files and are removed on exit. No Firebase deploy step exists.
The regular main-push Pages workflow always publishes OFF; do not push unrelated changes during
an authorized pilot session. Its default OFF publication is also the reviewed frontend recovery path.

After publication, verify Pages SHA/artifact against the approved frontend and perform the
Mac ↔ iPhone sequence in `PRIVATE-PILOT.md`: same verified account, independent consents,
real completed Memorama result, reload, cross-device restore, concurrent conflict, offline retry,
A/B/guest isolation and export. Observe and record only fictitious data. WebKit automation does
not certify physical iPhone behavior. Stop on any failed smoke or unverified result.

## Verifiable operator monitoring (no daemon or paid scheduler)

While a session is open, the named operator is present. Before opening and every fifteen minutes:

- Read project-wide 24h usage from the Console **Usage dashboard**, not document browsing;
  record reads/writes/deletes, time, operator and a private screenshot/file with SHA-256.
  Once per day use bounded `pilot-admin monitor` and keep its document/UID-count summary.
  Its inventory reads consume the read budget; don't run full scans at fifteen-minute cadence.
- Update this private receipt with observed data, not estimates or fabricated zeros:

```json
{"version":1,"project":"optilab-cd829","source":"console","windowHours":24,
 "observedAt":"UTC_TIME","operator":"APPROVED_GITHUB_OPERATOR",
 "evidencePath":"/private/absolute/path/usage-evidence.json",
 "evidenceSha256":"SHA256_OF_PRIVATE_EVIDENCE",
 "inventoryObservedAt":"UTC_DAILY_INVENTORY_TIME",
 "counts":{"reads":0,"writes":0,"deletes":0,"documents":0,"largestAccount":0}}
```

The zero values above are schema placeholders, **not a valid measured receipt**. Keep the daily
inventory receipt with the screenshot. Live usage must be no older than ten minutes; the document
inventory no older than 24 hours. CLI verifies the evidence file hash. Production prepare/open/renew
also recheck active Rules, billing and services live. CI relies on the operator's approved private
receipts, not an independent cloud query; this trust boundary must be approved.

- Run `renew` with the same manifest, fresh receipt and `--execute --confirm renew:DIGEST`.
  Capture its expiry/result in a private operator log. Renew only extends the short operating lease,
  never a membership or the immutable end date. It cannot reopen expired/paused control.
- If usage is unknown, metadata access fails, a threshold is reached, the operator leaves, or
  a client fails QA: execute emergency pause immediately. Do not renew from stale receipts.
  Lease-function failures pause writes; errors occurring before SDK access require the explicit
  emergency command. If IAM/network is unavailable, server expiry still stops access within
  twenty minutes of the last successful open/renew, and at the fixed end at the latest.

## Emergency pause and recovery

1. Stop participant activity; preserve local journals/exports. Emergency pause does not depend on
   billing/metrics/manifest validity. With separately authorized pause authority set the acknowledgement
   `OPTILAB_PILOT_SECOND_AUTHORIZATION=pause-approved`, then run:
   `npm run pilot:activation -- pause --target production --execute --confirm pause:pause`.
   This sets reads and writes false. Verify the control and direct SDK denial on both devices.
2. If access to the project fails, record the last lease expiry and stop both browsers; a lease is not
   renewed by browser clients. Retry the approved pause from the backup operator; do not enable APIs
   or billing to recover. Reopening always requires explicit `open` and fresh evidence.
3. Frontend recovery: after owner authorization, dispatch the regular OFF Pages workflow pinned
   to a reviewed main SHA; verify its public artifact and both browser smokes. This does not restore
   old Cloud data or bypass Rules. Existing cached pilot clients remain constrained by policy/expiry.
4. Do not automatically roll back Rules or indexes. A previous Rules release can remove admission;
   a rollback needs a reviewed source diff and separate owner authorization, with policy paused first.
5. Per-UID data recovery: export current local/remote copies privately, preserve old epochs, then use
   the existing explicit backup review/restore UI. Never replay raw Admin archives blindly or overwrite
   another UID. Test on emulators first. Restore remains blocked for an erased UID. Compare result
   IDs/trust levels and both devices after restore; reported results remain unvalidated.
6. At end, pause, stop publication/renewals and complete reviewed UID erasure by end+14 days:
   export, inspect plan and shared references, fence, version-checked delete, final inventory, managed
   archive deletion. For disposable pilot Auth identities, separately confirm UID, revoke sessions,
   delete via Firebase Console, verify user absent. For existing identities, retain unless separately
   authorized. Finally remove minimal UID fences only after expiry, old-client rejection and external
   cleanup receipts; the current erasure tool retains them for this final manual review.
   Browser stores, iPhone offline copies, downloads and provider/OS backups require explicit receipts;
   never issue a complete deletion certificate on the basis of a Firestore scan alone.

## Current release evidence and honest limits

PR #31 merge: `f062b11412f46757e2798b7e701f05b80413e464`.
[Pages succeeded](https://github.com/IsraelTiburcio-ai/optilab/actions/runs/41718212077).
[Smoke](evidence/pr31/public-smoke.json): Chromium/WebKit 28 opens+handshakes each,
Memorama result, consent/local history/reload/export, 390×844 layout, no Sync modules or
Firestore requests. Public HTML byte-matched the Pages artifact (SHA-256
`af2c25daca84a039e2a437a4b0911cc170d1f0d26f6c3b52da0afb5d320c044c`).
Auth forms/client validation PASS; real login and physical pilot require owner intervention.
[Remote metadata probe](evidence/pr31/platform.json): **BLOCKED**, ADC/IAM unavailable.
Workflow audit proves this delivery ran only Pages and issued no Rules/API-enable/billing writes;
it cannot establish another operator's active Rules or project billing state without metadata access.

Sources for the metadata adapters and environment gates:
[Rules GET](https://firebase.google.com/docs/reference/rules/rest/v1/projects.releases/get),
[Ruleset GET](https://firebase.google.com/docs/reference/rules/rest/v1/projects.rulesets/get),
[Billing GET](https://docs.cloud.google.com/billing/docs/reference/rest/v1/projects/getBillingInfo),
[GitHub environments](https://docs.github.com/en/rest/deployments/environments).

Candidate validation: **27/27 emulator tests PASS**, including full CLI prepare/open/renew/pause,
build PASS and checksum-verified actionlint 1.7.12 PASS for both workflows.
[Machine-readable evidence](evidence/pr31/activation-candidate.json). Production activation,
remote IAM/metadata and physical Mac/iPhone are explicitly not certified by these emulator results.
