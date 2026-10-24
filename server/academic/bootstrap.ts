import {localConfig} from './config';
import type {EmulatorAdmin} from './sdk';
import {assertEmulatedDatabase} from './sdk';
import {scopeKey} from './repository';
export interface FixtureActor {uid:string;email:string}
export interface Fixtures {
  courseId:string;termId:string;groups:{a:string;b:string};
  actors:Record<'teacherA'|'teacherB'|'teacherBoth'|'studentA'|'studentB'|'studentC',FixtureActor>;
}
/** Operator fixture boundary, never imported by HTTP routes. Synthetic names only. */
export async function seedFixtures(sdk:EmulatorAdmin,password:string):Promise<Fixtures> {
  localConfig(process.env);
  assertEmulatedDatabase(sdk.db);
  if(process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1'||password.length<12||password.length>100)throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
  const suffix=crypto.randomUUID().replaceAll('-',''),courseId=`fixture-course-${suffix}`,termId='fixture-term',groups={a:'fixture-a',b:'fixture-b'};
  const actors={} as Fixtures['actors'];
  for(const key of ['teacherA','teacherB','teacherBoth','studentA','studentB','studentC'] as const) {
    const email=`${key.toLowerCase()}-${suffix}@example.test`;
    const user=await sdk.auth.createUser({email,password,displayName:`Synthetic ${key}`,emailVerified:true});actors[key]={uid:user.uid,email};
  }
  const batch=sdk.db.batch(),put=(path:string,data:Record<string,unknown>)=>batch.set(sdk.db.doc(path),data);
  put(`courses/${courseId}`,{schemaVersion:1,courseId,title:'Synthetic course',status:'active'});
  put(`courses/${courseId}/academicSettings/current`,{schemaVersion:2,courseId,allowMultipleGroupsPerTerm:true});
  put(`courses/${courseId}/terms/${termId}`,{schemaVersion:1,courseId,termId,title:'Synthetic period',status:'active'});
  for(const groupId of Object.values(groups)) {
    const s={courseId,termId,groupId},root=`courses/${courseId}/terms/${termId}/groups/${groupId}`;
    put(root,{schemaVersion:1,...s,title:'Synthetic group',status:'active'});put(`${root}/settings/current`,{schemaVersion:2,...s,revision:0});
    for(const key of ['teacherA','teacherB','teacherBoth'] as const) {
      if(key==='teacherA'&&groupId!==groups.a||key==='teacherB'&&groupId!==groups.b)continue;
      const uid=actors[key].uid;
      put(`${root}/staff/${uid}`,{schemaVersion:1,...s,uid,status:'active'});
      put(`${root}/administration/${uid}`,{schemaVersion:2,...s,uid,status:'active',manageInvitations:true,manageMembers:true,readHistory:true});
      put(`users/${uid}/teachingScopes/${scopeKey(s)}`,{schemaVersion:2,...s,uid,status:'active'});
    }
  }
  for(const key of ['teacherA','teacherB','teacherBoth'] as const) {
    const uid=actors[key].uid;
    put(`courses/${courseId}/staff/${uid}`,{schemaVersion:1,uid,courseId,status:'active'});
    put(`courses/${courseId}/administration/${uid}`,{schemaVersion:2,uid,courseId,status:'active',createTerms:key!=='teacherB',createGroups:key!=='teacherB'});
  }
  // A private marker for student-side integrity assertions, not accessible via academic repository.
  put(`users/${actors.studentA.uid}/sync/current`,{schemaVersion:2,uid:actors.studentA.uid,epoch:1,revision:1,operationId:crypto.randomUUID(),createdAt:sdk.timestamp(Date.now()),updatedAt:sdk.timestamp(Date.now())});
  put(`users/${actors.studentA.uid}/epochs/1/fields/nickname`,{schemaVersion:2,uid:actors.studentA.uid,epoch:1,revision:1,operationId:crypto.randomUUID(),value:'Private synthetic adventure'});
  await batch.commit();return {courseId,termId,groups,actors};
}
/** Operator-only fixture mutation for deterministic revocation-window tests. */
export async function revokeFixtureTeacher(sdk:EmulatorAdmin,f:Fixtures,uid:string) {
  localConfig(process.env);assertEmulatedDatabase(sdk.db);if(process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1'||!f.courseId.startsWith('fixture-course-')||!Object.values(f.actors).some(a=>a.uid===uid))throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
  await sdk.db.doc(`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}/staff/${uid}`).update({status:'revoked'});
}
export async function alterFixture(sdk:EmulatorAdmin,f:Fixtures,change:'course-suspension'|'single-group'|'malformed-staff'|'revoked-capability'|'fake-admin-claim'|'malformed-roster') {
  localConfig(process.env);assertEmulatedDatabase(sdk.db);if(process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1'||!f.courseId.startsWith('fixture-course-'))throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
  const root=`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}`;
  if(change==='course-suspension')await sdk.db.doc(`courses/${f.courseId}/members/${f.actors.studentA.uid}`).set({schemaVersion:1,courseId:f.courseId,uid:f.actors.studentA.uid,status:'revoked'});
  else if(change==='single-group')await sdk.db.doc(`courses/${f.courseId}/academicSettings/current`).update({allowMultipleGroupsPerTerm:false});
  else if(change==='malformed-staff')await sdk.db.doc(`${root}/staff/${f.actors.teacherA.uid}`).update({uid:f.actors.teacherB.uid});
  else if(change==='revoked-capability')await sdk.db.doc(`${root}/administration/${f.actors.teacherA.uid}`).update({manageMembers:false});
  else if(change==='malformed-roster')await sdk.db.doc(`${root}/roster/${f.actors.studentA.uid}`).update({email:'private-fixture@example.test'});
  else await sdk.auth.setCustomUserClaims(f.actors.studentA.uid,{role:'admin',teacher:true});
}
/** Read-only operator inspection: returns a boolean, never private fixture documents. */
export async function fixtureStoresSecret(sdk:EmulatorAdmin,f:Fixtures,commandId:string,inviteId:string,secret:string):Promise<boolean> {
  localConfig(process.env);assertEmulatedDatabase(sdk.db);if(process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1'||!f.courseId.startsWith('fixture-course-'))throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
  const root=`courses/${f.courseId}/terms/${f.termId}/groups/${f.groups.a}`;
  const rows=await Promise.all([sdk.db.doc(`${root}/invitations/${inviteId}`).get(),sdk.db.doc(`academicOperations/${commandId}`).get(),sdk.db.doc(`academicAudit/${commandId}`).get()]);
  const events=await sdk.db.collection(`${root}/membershipEvents`).where('commandId','==',commandId).limit(10).get();
  return [...rows.map(r=>r.data()),...events.docs.map(r=>r.data())].some(data=>JSON.stringify(data).includes(secret));
}
