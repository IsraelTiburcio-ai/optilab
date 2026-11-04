# single-operator-test — preparation only, not authorized for production

This is a separate proposal for one supervising owner, one verified adult UID,
fictitious progress and at most two hours. It is **not** the two-reviewer private
pilot and does not impersonate an independent reviewer. That pilot's validator,
Rules, manifest, environments and workflows remain unchanged.

## What this delivery can do

`scripts/single-operator-prepare.mjs` validates a private session and renders a
session-specific Rules candidate, an initially paused control and a review plan.
It has **no execute option, SDK, ADC, network or deployment operation**. Missing
decisions fail closed. `authorization` must remain null: preparing an artifact,
acknowledging risks and merging this PR do not authorize a production operation.

Copy `config/single-operator-test.proposed.json` **outside every Git checkout**.
The owner must fill the exact UID, operator, approved frontend SHA, UTC dates,
active release source hash (not the versioned `firestore.rules` hash) and privacy
decisions. Never commit that filled file.

```sh
# LOCAL ONLY; use a private, verified encrypted location, not a repository.
node scripts/single-operator-prepare.mjs --manifest /PRIVATE/session.json
node scripts/single-operator-prepare.mjs --manifest /PRIVATE/session.json --out /PRIVATE/new-bundle
```

Without `--out`, nothing is written. With it, a new 0700 directory and four 0600
files are created inside the declared private export location: `candidate.rules`, `control-paused.json`, `approval-plan.json`,
`session.json`. Existing directories, Git ancestors and symlinked Git destinations
are rejected. Stdout contains hashes and status, not UID or data. Encryption and
adult/fictitious-data attestations are owner decisions, not verified by the tool.

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
3. Approve a separate publication/activation procedure. **No single-operator
   publisher or production control writer is included.** The original private
   workflow/activation CLI rejects this manifest and must not be bypassed or
   repurposed. No new production build gate is enabled by this preparation.
4. Fresh read-only verification of Rules release `cloud.firestore`, billing=false,
   unchanged services, permissions and usage. No unknown counter counts as zero.
5. Approve quotas, receipt freshness, storage headroom, encrypted export location,
   backup handling, independent consents, early erasure and fourteen-day maximum
   retention after end; separately decide minimal fence/audit and Auth retention.
6. Authorize full emergency pause, frontend OFF recovery and per-UID export/erase.
   A Rules rollback requires explicit review of the exact previous artifact.

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

**Pause this mode by setting both flags false on its separate control** or removing
that control; the server then denies new progress requests. Original
`pilot:activation pause` and `pilot:admin monitor/pause` target `syncPilotControl`
and **do not pause this mode**. The existing monitor's inventory may be reused only
as explicitly approved read evidence; its automatic pause is not applicable.
No background quota monitor or single-operator pause executor is installed here.
If operational control fails, close clients, stop renewal and let the lease expire;
cached/offline data is not remotely purged. Do not claim instantaneous revocation.

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
end of its emulator-only checks. No deployment workflow was added or modified.

```sh
node --test tests/single-operator/preparation.test.mjs
# With both isolated loopback emulators already running, demo project only:
GCLOUD_PROJECT=demo-optilab-sync CLOUD_QA_ISOLATED=1 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8185 \
node --import tsx --test --test-concurrency=1 tests/single-operator/*.test.mjs
npm run test:sync
npm run test:sync:production
npm run build
```

Tests compile and execute generated Rules against real emulator RPCs: separate
clients and existing engines, consent, deduplication, backup/restore, wrong UID,
anonymous/unverified identity, cross-owner access, outside-scope writes, forged
trust, pause, lease expiry, fixed end, failed extension and erasure replay fence.
Mock/pure validation is distinguished from integration evidence. The UI copy now
distinguishes OFF/local, emulator and production, without changing consent or game
mechanics. Chromium/WebKit ON-emulator and OFF-build checks cover rendered text;
production-ON wording is unit tested, never tested against a live project here.

This preparation is technically reviewable; **production execution remains
BLOCKED pending the decisions and the separately reviewed execution procedure**.

Sources: [Firestore quotas](https://firebase.google.com/docs/firestore/quotas),
[monitoring limitations](https://firebase.google.com/docs/firestore/monitor-usage),
[Rules emulator testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
