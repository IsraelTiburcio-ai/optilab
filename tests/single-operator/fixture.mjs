import {readFileSync} from 'node:fs';
import {reviewedSources} from '../../server/single-operator/preparation.mjs';
export const sources={base:readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8'),pilot:readFileSync(new URL('../../firestore.pilot.rules',import.meta.url),'utf8')};
export function session(now=Date.now()){
  return {...JSON.parse(readFileSync(new URL('../../config/single-operator-test.proposed.json',import.meta.url),'utf8')),
    uid:'single-fixture-a',operator:'owner-fixture',frontendSha:'b'.repeat(40),expectedActiveRulesSha256:reviewedSources.base,
    startAt:new Date(now-60000).toISOString(),endAt:new Date(now+7140000).toISOString(),adultAttested:true,fictitiousDataOnly:true,
    exports:{directory:'/private/tmp/fictitious-encrypted-volume',encryptionVerified:true,removeExternalCopies:true},risksAcknowledged:true};
}
