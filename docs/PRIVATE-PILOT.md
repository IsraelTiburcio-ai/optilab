# Private pilot candidate — not activated

PR #30 is live at merge `70eedd02fdcebcab8fbdcb3359ac98e841dfedc4`.
Pages: https://github.com/IsraelTiburcio-ai/optilab/actions/runs/41617652768 (success, same SHA).
Public evidence: [JSON](evidence/pr30/public-smoke.json), reproducible with `node scripts/smoke-pr30-public.mjs`.
Chromium/WebKit: 28/28 opens + handshakes each; completed Memorama result received;
consent, reload, byte-exact local export and 390×844 account layout pass; no loaded
Sync chunks or Firestore requests. Auth forms/client validation pass; actual Google/email
login is **BLOCKED / owner intervention required**, no real credentials used.
Other 27 game completions per browser were not certified by this smoke. Both browsers
reported a cross-origin iframe autofocus restriction; it did not block opening or handshakes.

## Admission and pause

`firebase.production.json` points to the generated **candidate** `firestore.pilot.rules`.
Nothing deploys Rules/indexes in CI. Generate/check with
`node scripts/build-pilot-rules.mjs --write` / `node scripts/build-pilot-rules.mjs`.
All private `/users/{uid}` reads/writes require verified Auth, same UID, an active
unexpired administrative membership and unexpired global control. Missing policy denies.
Client SDK cannot grant, list memberships, edit policy or elevate reported to validated results.
Other academic/course Rules retain their existing restrictions; this pilot does not enable them.
Membership metadata is readable only by its verified owner; global control by verified accounts.
Control/membership get calls add Rules-dependent reads; denied requests can still incur reads.
Admin SDK bypasses Rules: IAM for the operator is part of the approval, never browser credentials.

Existing independent adventure/import and attempt consent controls are preserved unchanged.
Granting membership does not import guest history or accept either consent.
Production frontend requires the additional `VITE_SYNC_PILOT=private-admission-v1` gate;
Pages explicitly pins it empty and Sync disabled. Build flags are **not** authorization.
Current frontend remains OFF even after merging this candidate PR.

## Operator tooling (Node 22)

Default is offline dry-run, including production. Example:

```
npm run pilot:admin -- plan --target production --project optilab-cd829 --uid UID
```

Emulator operations require explicit `--execute --confirm UID` (global actions confirm their
command). Supported target is fixed to Auth 9199 / Firestore 8185, demo-optilab-sync:

```
npm run pilot:admin -- admit --target emulator --project demo-optilab-sync --uid UID --execute --confirm UID
npm run pilot:admin -- plan --target emulator --project demo-optilab-sync --uid UID --execute --confirm UID
npm run pilot:admin -- export --target emulator --project demo-optilab-sync --uid UID --archives .pilot-archives --execute --confirm UID
npm run pilot:admin -- erase --target emulator --project demo-optilab-sync --uid UID --archives .pilot-archives --plan-hash REVIEWED_HASH --execute --confirm UID
npm run pilot:admin -- monitor --target emulator --project demo-optilab-sync --execute --confirm monitor
npm run pilot:admin -- pause --target emulator --project demo-optilab-sync --execute --confirm pause
```

Production execution additionally requires `OPTILAB_PILOT_OPERATOR_APPROVAL=private-pilot-approved-v1`,
explicit production project/target, operator ADC IAM and a **new owner authorization**.
This environment variable is an operator acknowledgement, not a security credential.
No command enables global reads/writes. Initial activation needs a reviewed administrative change
following approval; tooling only admits (maximum five verified accounts for seven days), monitors,
exports, erases, or pauses. No service-account key files, tokens or raw data printed to console.

`monitor` counts all stored documents, pauses writes above 2,000 total or 500/account,
and attempts to pause on inventory failure. Pause preserves current read state and expiry;
it never re-enables reads or extends an expired pilot. Failure to pause is an operational failure.
Inventory caps at 5,000 documents / 20MB; overflow is an error, never a complete export.
Monitoring is operator-invoked, not an installed background job. Storage limits are **soft**
and do not limit read/write rate, stop a compromised admitted account, or prevent billing by themselves.
Before activation approve daily Console usage review and an operator monitor schedule/alert owner;
review Spark project-wide free quotas and existing consumption. Do not enable Blaze.
Rate/quota exhaustion is a pilot stop condition, not an invitation to upgrade billing.

## Verifiable UID export/erasure

Inventory traverses missing-parent descendants and all collections, including historical epochs,
backups and derived documents explicitly owned via uid/ownerUid/subjectUid. Cross-owner records
and shared/unknown references become REVIEW blockers, never blind deletions. Schema additions
must preserve ownership metadata and extend classification tests. External stores are out of scope.
Export is JSON with paths, Firestore timestamp versions, full data, plan hash and SHA-256 integrity
check (not a signature). Files use exclusive creation, private 0700 directory and 0600 files.
Protect/archive/export handling is operator responsibility; local OS encryption is recommended.

Erasure requires a current plan hash and matching valid managed archive. It fences the UID first,
rescans, then deletes only planned versions with update-time preconditions, deepest first. Any
change/partial failure leaves admission blocked and exports intact. Final scan requires zero owned
or unresolved data. All matching tool-managed UID exports are verified then deleted. Minimal
membership tombstone and existing operator audit records are deliberately retained. Re-admission
of an erased UID is prohibited; queued/offline clients cannot resurrect data through Rules.
Auth identity itself is retained; deleting the Auth account is a separately authorized operation.

A Firestore scan cannot prove erasure from external exports, provider PITR/managed backups,
Time Machine, downloaded files or an offline phone. Require operator inventory/receipts for those
copies and local browser cleanup on **each** physical device before issuing a final erasure certificate.
This PR does not claim remote purge of local storage or deletion of project-wide backups that may
contain other accounts. Do not enable provider backups/PITR before a per-UID retention decision.

## Physical Mac ↔ iPhone acceptance (requires later activation approval)

Use a consenting adult/test operator, one verified test account, no student personal data.
Keep guest, account A and account B separate; collect timestamps and redacted screenshots only.

1. Confirm approved Rules/config SHA, membership expiry and disabled billing upgrades. Export
   both local browsers before testing; do not erase originals or silently import guest history.
2. Mac Safari/Chromium: sign in A, verify email. Explicitly choose adventure remote/import;
   separately accept or decline attempts. Record pending/synced state and a declared practice.
3. iPhone Safari: sign in the **same verified account**, independently review consent. Confirm
   adventure restoration and reported attempts only when accepted; validated count stays zero.
4. Both devices edit different fields then the same field; confirm merge/conflict preview, no
   silent overwrite. Export each copy. Complete Memorama and verify one reported attempt,
   no duplicate after reload or network retry.
5. Make an offline edit on iPhone; edit Mac online; reconnect, resolve conflict, reload both.
   Change A→B→guest while requests are pending; verify no A data appears or writes as B.
6. Decline attempts while accepting adventure; verify no new attempt writes, then reverse decisions.
7. Operator pause: online write denied and error visible; queued edit preserved locally. Expired,
   revoked and unadmitted accounts denied even via direct SDK. Never auto-reenable after a pause.
8. Export by UID, check digest and plan including backups/derived data; rehearse erasure with
   disposable emulator UID first. On authorized real erasure verify Rules denial on both devices,
   clean local copies and obtain external-backup receipts. Recheck B and guest unchanged.

## Approval decisions and remaining gates

- Admit up to five consenting adult/test accounts, seven-day grants, fourteen-day maximum policy
  lifetime. Real student/minor data requires a separate privacy decision.
- Proposed data retention: fourteen days after pilot end, then reviewed erasure; decide who holds
  encrypted exports and the minimal tombstone/audit retention period. No automatic TTL deletion
  or provider backups configured by this PR.
- Approve UID operator IAM, export recipients and storage location; Auth-account deletion remains
  separate. Erasure cannot promise removal of offline/external copies without receipts.
- Approve quota thresholds, monitoring cadence/operator, global pause authority and on-call response.
  Cloud Monitoring/alerts, indexes and Rules are prepared/reviewed, **not deployed**; existing
  collection queries need no new composite index. Administrative status query uses default index.
- Actual production admission, authorized export/erase, metrics/billing configuration and physical
  Mac/iPhone tests remain BLOCKED until approval. Emulator evidence does not certify those.

## Executed candidate validation

`npm run test:pilot`: **17/17 PASS**, including 122-write import, CAS/replay, admission,
concurrent quota, verified Auth grants, pause, UID export/erasure and queued offline rejection.
`npm run test:cloud-sprint`: **51 core + 107 Rules + 7 Chromium UI + 7 WebKit UI PASS**.
Production-OFF browser gate: **1/1 PASS in each engine**. Build and diff checks passed.
[Machine-readable evidence](evidence/private-pilot.json). These results use emulators,
not real production IAM or data operations; physical-device gates above remain pending.
