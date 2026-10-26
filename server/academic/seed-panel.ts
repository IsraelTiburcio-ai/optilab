import {localConfig} from './config';
const config=localConfig(process.env);
if(process.argv.length!==2||process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1'||(process.env.ACADEMIC_FIXTURE_PASSWORD??'').length<12)throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
const [{emulatorAdmin},{seedFixtures},{AcademicRepository},{AcademicService}]=await Promise.all([import('./sdk'),import('./bootstrap'),import('./repository'),import('./service')]);
const sdk=await emulatorAdmin();
try {
  const f=await seedFixtures(sdk,process.env.ACADEMIC_FIXTURE_PASSWORD!),service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds);
  const scope={courseId:f.courseId,termId:f.termId,groupId:f.groups.a};
  const teacher={uid:f.actors.teacherA.uid,label:'Synthetic teacherA'};
  const invitation=await service.execute(teacher,'rotateEnrollmentLink',{...scope,idempotencyKey:crypto.randomUUID(),expectedVersion:0,expiresInSeconds:Math.min(3600,config.maxTtlSeconds)});
  const actor={uid:f.actors.studentA.uid,label:'Synthetic studentA'};
  await service.execute(actor,'savePlayerIdentity',{idempotencyKey:crypto.randomUUID(),expectedVersion:0,expectedProfileVersion:0,
    fullName:'Alumno de demostración',gamertag:'D_'+f.courseId.slice(-18),avatarId:'avatar-02',companionId:'piv',shareGameIdentity:false});
  await service.execute(actor,'redeemInvitation',{...scope,inviteId:invitation.inviteId,token:invitation.token,idempotencyKey:crypto.randomUUID()});
  // The secret and request/invitation IDs intentionally never leave this process.
  console.log(JSON.stringify({...f,panelDemo:{activeStudents:1,pendingRequests:0}},null,2));
}finally{await sdk.close();}
