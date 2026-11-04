# single-operator-test — execution implemented locally, not authorized for production

This is a separate proposal for one supervising owner, one verified adult UID,
fictitious progress and at most two hours. It is **not** the two-reviewer private
pilot and does not impersonate an independent reviewer. That pilot's validator,
Rules, manifest, environments and workflows remain unchanged.

The execution layer is implemented and tested against isolated emulators in this
branch. **No production operation, deploy, Auth account, IAM change or billing
change has been executed.** Production execution remains blocked until the owner
approves the exact artifacts and window.

## What this delivery can do

`scripts/single-operator-prepare.mjs` validates a private session and renders a
session-specific Rules candidate, an initially paused control and a review plan.
The execution path adds owner-bound approval receipts, live Rules/billing/services
verification, a paused control, `open`/`renew`/`recover`/`pause`, a private metadata
snapshot and a manual ON/OFF frontend workflow. Every production action requires an
exact `action:digest` confirmation and a separate environment acknowledgement.
Missing decisions fail closed. `authorization` must remain null in the preparation
manifest: preparing artifacts does not authorize production.

Copy `config/single-operator-test.proposed.json` **outside every Git checkout**.
The owner must fill the exact UID, operator, approved frontend SHA, UTC dates,
active release source hash (not the versioned `firestore.rules` hash) and privacy
decisions. Never commit that filled file.

```sh
# LOCAL ONLY; use a private, verified encrypted location, not a repository.
node scripts/single-operator-prepare.mjs --manifest /PRIVATE/session.json
node scripts/single-operator-prepare.mjs --manifest /PRIVATE/session.json --out /PRIVATE/new-bundle
```

Without `--out`, nothing is written. With it, a new 0700 directory and seven 0600
files are created inside the declared private export location: `candidate.rules`,
`firebase-rules.json`, `control-paused.json`, `approval-plan.json`,
`execution-approval.proposed.json`, `usage.proposed.json` and `session.json`.
Existing directories, Git ancestors and symlinked Git destinations are rejected.
Stdout contains hashes and status, not UID or data. Encryption and
adult/fictitious-data attestations are owner decisions, not verified by the tool.
An optional `--snapshot` validates the read-only baseline and fills the service
inventory hash in the proposed approval; the approval remains unsigned.

## Enforced by the candidate Rules

- A single literal UID, verified nonanonymous identity and a fixed absolute window
  of no more than two hours are compiled into the private candidate. They cannot
  be changed by editing the control document. Renewing it cannot extend the window.
- A separate `singleOperatorTestControl/current` must match mode, UID, digest,
  start/end and a live lease of at most ten minutes. Supervision is proposed every
  five minutes. Missing/malformed/paused/expired control denies progress access.
- Clients cannot edit the control, grant themselves admission or write validation
  results. Old `syncPilot*` grants/control do not activate this mode. An existing
  `syncPilotMembers/{uid}` erasure fence is honored, including after renewal.
- Only adventure v2 fields/head/receipts, Memorama game runs and Memorama client
  reports are writable. Client deletes, legacy writes/import, diagnostic writes,
  enrollments, arbitrary backups and other games' reported attempts are denied.
  The read-only legacy-current probe and diagnostic queries are retained because
  the existing v2 transport needs them. Restore/reset stay explicit and preserve
  epochs. Reported results are never promoted to validated results.
- Session metadata is readable only by its verified owner; this read remains
  available to diagnose a closed control. It does not grant access to progress.

## Whole-project Rules impact — approval blocker

The tool pins the reviewed **versioned files** (`reviewedSources.base/pilot`); a
changed file still blocks generation. Their hashes are distinct from
`expectedActiveRulesSha256`, the full hash of a separately reviewed active release.
Preparation records `activeRulesVerification: NOT_PERFORMED`. It never equates a
repository file with production or treats a hash prefix as an approved source.

`verifyActiveRules` requires a separately supplied owner comparison approval that
binds the frontend/session, versioned base, candidate and exact active source,
including an explicit impact review. With an injected live GET adapter it reads
`releases/cloud.firestore`, follows its project-checked ruleset, compares source
bytes without normalization, and rereads the release to reject concurrent changes.
Missing/inaccessible/invalid metadata, changed content, missing approval or stale
comparison all block. There is no default network/ADC adapter or CLI execution
option. Comparison PASS alone never authorizes production; the future execution
procedure must call this gate again immediately before a separately approved change.

Deploying the candidate replaces the database-wide ruleset. All other UIDs lose
access to `users/{uid}`, including enrollments. Existing academic `courses/...`
policy and validators are byte-preserved, not globally disabled. This does not
isolate the project from every academic operation already authorized by that
policy. Inspect current users/consumers and the actual release before approval.
If they need private routes during the session, this candidate is **NO-GO**;
do not silently preserve broader access or hardcode an exception.

## Explicit owner decisions still required

1. Exact frontend commit, active Rules source, candidate source/hash, window digest,
   sole UID, two-hour UTC interval, scope and acceptance of one-human oversight.
2. Accept the global Rules impact, public Pages distribution and remaining
   project-wide quota/availability risk. One admitted account is not a rate limit.
3. Approve the exact execution artifacts and the separate publication window.
   The single-operator publisher/control writer exists in this branch but remains
   owner-gated; the original two-reviewer workflow/activation CLI rejects this
   manifest and must not be bypassed or repurposed. No production build gate is
   enabled by merging this branch.
4. Fresh read-only verification of Rules release `cloud.firestore`, billing=false,
   unchanged services, permissions and usage. No unknown counter counts as zero.
5. Approve quotas, receipt freshness, storage headroom, encrypted export location,
   backup handling, independent consents, early erasure and fourteen-day maximum
   retention after end; separately decide minimal fence/audit and Auth retention.
6. Authorize full emergency pause, frontend OFF recovery and per-UID export/erase.
   A Rules rollback requires explicit review of the exact previous artifact.

## First Mac ↔ iPhone runbook (authorized production; not run in this delivery)

Keep the filled manifest, approval, receipts, baseline and exports outside Git.
`DIGEST` below is the `windowDigest` printed by `plan`; no production command in
this repository has been executed.

1. **Fill the private manifest** from `config/single-operator-test.proposed.json`
   with the exact adult UID, operator, approved frontend SHA, UTC start/end,
   expected active Rules source hash, export directory and consents. Never commit it.
2. **Read-only baseline** (requires separate snapshot acknowledgement):
   `npm run single:snapshot -- --target production --project optilab-cd829 --execute --confirm snapshot:optilab-cd829 --out /PRIVATE/baseline`
   with `SINGLE_OPERATOR_SNAPSHOT_APPROVAL=read-only-approved`.
3. **Prepare artifacts:** `npm run single:prepare -- --manifest /PRIVATE/session.json --snapshot /PRIVATE/baseline/snapshot.json --out /PRIVATE/bundle`.
   Review `approval-plan.json`, `candidate.rules`, `execution-approval.proposed.json`
   and `usage.proposed.json`; fill and sign the approval privately.
4. **Preflight without writes:** run `npm run single:session -- preflight --target production --manifest /PRIVATE/session.json --approval /PRIVATE/approval.json --approved-source /PRIVATE/baseline/baseline.rules --usage /PRIVATE/usage.json --execute --confirm preflight:DIGEST`
   with `SINGLE_OPERATOR_EXECUTION_APPROVAL=DIGEST`. Require PASS for active Rules,
   billing=false, unchanged services and permissions.
5. **Rules deployment (only after the second authorization):**
   `npx firebase-tools@15.0.0 deploy --only firestore:rules --project optilab-cd829 --config /PRIVATE/bundle/firebase-rules.json`.
   No indexes, APIs, IAM or billing changes are included. Read back the release and
   require the exact candidate hash; a mismatch is a stop condition.
6. **Paused control and opening:** run `inspect` to obtain a fresh receipt, then
   `prepare` (initially paused), then `inspect` again. Publish the frontend ON only
   after the control is paused and the owner approves the manual workflow. Open with
   a fresh receipt; the lease is at most ten minutes and never exceeds the fixed end.
7. **Mac ↔ iPhone:** use the same verified adult account on
   `https://optilab.club/` in Mac and physical iPhone Safari, without LAN/tunnels.
   Accept adventure and attempt consent independently; choose remote adventure, not
   guest import. Complete Memorama on Mac, verify the exact reported attempt on
   iPhone and in a server-confirmed read, reload without duplicates, test offline,
   conflict and own-backup restore. Use fictitious data only.
8. **Supervision and recovery:** record Console usage before opening and every five
   minutes; renew only with a fresh receipt inside the fixed end. On any failure,
   `pause` immediately. Publish OFF with the manual workflow. **Reload both clients**
   after `recover` or OFF; the local journal survives, while the Firestore listener
   must be recreated. Recovery never extends the fixed end or grants a new UID.
9. **Close:** pause, publish OFF, export privately, then perform UID-checked erasure
   and Auth deletion for only the disposable pilot identities. Keep the fourteen-day
   retention maximum and external-copy receipts. A Rules rollback is a separate
   reviewed operation, never automatic.

### Pages ordering guarantee

`deploy.yml` and the single-operator workflow share the same `pages` group and
neither cancels an in-progress run. A push therefore queues behind an OFF/ON
recovery instead of canceling it. The ON build job has no Pages environment; it
checks the latest completed Pages deployment before uploading the artifact, so a
completed OFF newer than the receipt blocks a stale ON. If an OFF is queued behind
ON, it runs after ON and wins. GitHub may replace a pending run when a newer run
enters the same concurrency group; do not dispatch ON while an OFF is pending. The
Firestore control pause remains the primary safety mechanism.

## Proposed operations for that later review — not commands to run now

Before publishing Rules, rerun the tests below against the exact candidate.
Record and privately back up the active source/release, frontend and both devices'
local progress. Prefer fresh dedicated profiles and no guest imports, which this
candidate forbids. If original progress cannot be backed up, leave it untouched.

After independent owner approval of the exact artifacts: Rules only → read-back
byte/hash comparison → separate control initially paused → separately authorized
frontend release → inspect both devices → owner-approved short lease. No indices,
new services, billing, IAM or accounts are implicitly authorized. JSON control
dates must become Firestore Timestamp values; it is not a deployable REST payload.

Use the same verified adult account on https://optilab.club/ in Mac and physical
iPhone Safari, without LAN/tunnels. Accept adventure and attempt synchronization
independently. Choose remote adventure, not guest import. Complete Memorama on
Mac, compare the exact reported ID/payload on iPhone and in a server-confirmed
read, reload without duplicates, test offline/reconnect and restore an own backup.
Use actual emitted metrics; don't infer completion or validation. A second
production UID is out of scope; denial tests use emulator identities.

Before opening and every five minutes, record project-wide usage and storage
headroom; renew the ten-minute lease only with fresh observed evidence and within
the fixed end. Proposed ceilings: 5,000 reads, 1,000 writes, 1,000 deletes per 24 h,
2,000 documents total, 500 per UID (lower limits need explicit review). These are
operational controls, not server-enforced rate quotas. Spark's free quotas and
metrics lag affect the whole project. Stop on unknown/exhausted usage; never
enable Blaze to continue. Do not use paid TTL/PITR/managed backups/restores.

**Pause this mode with the single-operator executor:**
`npm run single:session -- pause --target production --execute --confirm pause:pause`
with `SINGLE_OPERATOR_EXECUTION_APPROVAL=pause-approved`. It sets both flags false
on `singleOperatorTestControl/current`; the server then denies new progress requests.
This is distinct from the original two-reviewer pilot: `pilot:activation pause` and
`pilot:admin monitor/pause` target `syncPilotControl` and **do not pause this mode**.

There is no background monitor or paid scheduler. The named operator records
project-wide Console usage before opening and every five minutes; the ten-minute
lease and fixed end are the fail-closed limits, not a daemon. If administrative
pause fails, stop clients, stop renewals, keep the restrictive candidate paused,
publish frontend OFF after authorization, and let the lease expire (at most ten
minutes). Retry pause from the backup operator; never enable APIs or billing to
recover and never claim instantaneous revocation; cached/offline data is not
remotely purged. After `recover` or frontend OFF, reload both clients: the local
journal is preserved and the Firestore listener is recreated.

Recovery: preserve local queues, export privately, keep the restrictive candidate
paused and publish frontend OFF after authorization. Do not restore the broader
base Rules automatically. Restore only reviewed own backups, never bulk-replay an
Admin export. Any new session needs a newly approved Rules artifact and digest.

Existing UID export/erase code can inform the later reviewed procedure, but its
inventory reads the whole database and needs explicit privacy/quota approval.
Erasure must fence before version-checked deletion; this candidate honors that
fence. Include the new control in the ownership plan. Review shared references,
confirm zero remaining owned/unresolved data, and account for retained fences.
Auth deletion is separate. Clean dedicated profiles' localStorage, IndexedDB,
downloads and external copies on both devices; a Firestore scan cannot certify
their deletion. SHA-256 integrity is not encryption or forensic erasure.

## Tests and limits of evidence

The normal `test:sync` launcher now runs `tests/single-operator/*.test.mjs` at the
end of its emulator-only checks. No Firebase deploy workflow was added. The only
new workflow is the manual, owner-gated Pages ON/OFF release; the regular public
Pages workflow remains pinned to Sync OFF.

```sh
node --test tests/single-operator/preparation.test.mjs tests/single-operator/execution.test.mjs \
  tests/single-operator/frontend.test.mjs tests/single-operator/snapshot.test.mjs
# With both isolated loopback emulators already running, demo project only:
CLOUD_QA_ISOLATED=1 GCLOUD_PROJECT=demo-optilab-sync \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
node --import tsx --test --test-concurrency=1 tests/single-operator/execution-emulator.test.mjs
CLOUD_QA_ISOLATED=1 GCLOUD_PROJECT=demo-optilab-sync \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9199 \
npm run test:sync:core
npm run test:sync:production
npm run test:pages-base
npm run build
```

Local evidence for this branch: **18/18** pure single-operator tests, **5/5**
execution emulator tests, **54/54** sync core tests, **1/1 Chromium and 1/1 WebKit**
two-client UI rehearsals, **1/1** production gate, **5/5** Pages workflow/guard
tests and **build PASS**. The UI rehearsal completed a real Memorama result on two
clients, exercised duplicate rejection, total pause, journal preservation, recovery
with reload and canonical export. These are emulator results, not production or
physical iPhone evidence.

Tests compile and execute generated Rules against real emulator RPCs: separate
clients and existing engines, consent, deduplication, backup/restore, wrong UID,
anonymous/unverified identity, cross-owner access, outside-scope writes, forged
trust, pause, lease expiry, fixed end, failed extension and erasure replay fence.
Mock/pure validation is distinguished from integration evidence. The UI copy now
distinguishes OFF/local, emulator and production, without changing consent or game
mechanics. Chromium/WebKit ON-emulator and OFF-build checks cover rendered text;
production-ON wording is unit tested, never tested against a live project here.

The execution layer is implemented and locally verified; **production execution
remains BLOCKED pending the owner decisions, exact artifact approval and a
separately authorized operational window**.

Sources: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas),
[monitoring limitations](https://firebase.google.com/docs/firestore/monitor-usage),
[Rules emulator testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
