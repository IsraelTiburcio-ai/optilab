import {before, after, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, collection, collectionGroup, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, limit, orderBy, where, serverTimestamp, Timestamp, writeBatch, setLogLevel} from 'firebase/firestore';

// Fail BEFORE initialization: no discovery of Firebase config, .env, ADC or real database.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085') {
  throw new Error('Firestore rules tests require the isolated emulator at 127.0.0.1:8085. Use npm run test:firestore.');
}
const projectId = 'demo-optilab-firestore';
setLogLevel('silent'); // Expected permission-denied cases remain assertions, not noisy SDK retries.
const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('../../catalogo_optimizacion_gimnasios_1_a_5.json', import.meta.url)));
const past = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const base = 'courses/course-test/terms/term-test/groups';
const group = g => `${base}/${g}`;
const scope = g => ({schemaVersion:1,courseId:'course-test',termId:'term-test',groupId:g});
const grant = (uid,g) => ({...scope(g),uid,status:'active'});
const runId = '12345678-1234-4234-8234-123456789abc';
const progress = (uid='a') => ({schemaVersion:1,uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
  revision:1,practiced:{},visited:[],nickname:'Fixture',route:[],avatarId:null,companionId:null,evolutionCelebratedStage:1});
const run = (uid='a') => ({schemaVersion:1,uid,trust:'self-reported',createdAt:serverTimestamp(),date:past,
  runId,gameId:'memorama-simplex',result:{completed:true,matchedPairs:8,totalPairs:8,attempts:10,errors:2,elapsedMs:1000,accuracy:80}});
const diagnostic = () => ({schemaVersion:1,uid:'a',trust:'self-reported',createdAt:serverTimestamp(),date:past,answers:[1,0,1,1,0],score:5});
let env;
const db = (uid, claims={}) => env.authenticatedContext(uid, claims).firestore();
const ref = (client,path) => doc(client,path);
const put = (client,path,data) => setDoc(ref(client,path),data);
const read = (client,path) => getDoc(ref(client,path));

before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context=>{
    const client=context.firestore();
    const batch=writeBatch(client);
    const fixtures={
      'courses/course-test':{schemaVersion:1,courseId:'course-test',title:'Synthetic course',status:'active'},
      'courses/course-test/terms/term-test':{schemaVersion:1,courseId:'course-test',termId:'term-test',title:'Synthetic term',status:'active'},
      'users/b/progress/current':{...progress('b'),createdAt:past,updatedAt:past},
    };
    for(const [uid,kind] of [['a','members'],['b','members'],['teacher-a','staff'],['teacher-b','staff']]) {
      fixtures[`courses/course-test/${kind}/${uid}`]={schemaVersion:1,courseId:'course-test',uid,status:'active'};
    }
    for(const g of ['group-a','group-b']) {
      fixtures[group(g)]={...scope(g),title:'Synthetic group',status:'active'};
      const uid=g==='group-a'?'a':'b', teacher=g==='group-a'?'teacher-a':'teacher-b';
      fixtures[`${group(g)}/members/${uid}`]=grant(uid,g);
      fixtures[`${group(g)}/staff/${teacher}`]=grant(teacher,g);
      fixtures[`${group(g)}/leaderboard/${uid}`]={...scope(g),uid,alias:'Fixture alias',points:10,verifiedRuns:1,updatedAt:past};
      fixtures[`${group(g)}/studentSummaries/${uid}`]={...scope(g),uid,trust:'self-reported',practicedCount:2,updatedAt:past};
    }
    for(const [path,data] of Object.entries(fixtures))batch.set(ref(client,path),data);
    await batch.commit();
  });
});
const operator = action => env.withSecurityRulesDisabled(c=>action(c.firestore()));

test('anonymous and Firebase anonymous accounts cannot access private data',async()=>{
  for(const client of [env.unauthenticatedContext().firestore(), db('a',{firebase:{sign_in_provider:'anonymous'}})]) {
    await assertFails(read(client,'users/b/progress/current'));
    await assertFails(put(client,'users/a/progress/current',progress()));
    await assertFails(read(client,`${group('group-a')}/leaderboard/a`));
  }
});
test('own identity and progress create/read/update; timestamps and revision protect concurrency',async()=>{
  const client=db('a'), path='users/a/progress/current';
  await assertSucceeds(put(client,'users/a',{schemaVersion:1,uid:'a',createdAt:serverTimestamp()}));
  await assertSucceeds(put(client,path,progress()));
  await assertSucceeds(read(client,path));
  await assertSucceeds(updateDoc(ref(client,path),{nickname:'Nuevo',revision:2,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(client,path),{nickname:'Stale',revision:2,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(client,path),{uid:'b',revision:3,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(client,path),{createdAt:past,revision:3,updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref(client,path),{updatedAt:past,revision:3}));
  await assertFails(deleteDoc(ref(client,path)));
  await assertFails(deleteDoc(ref(client,'users/a')));
});
test('student A cannot get/write/delete student B progress or identity',async()=>{
  const client=db('a');
  await assertFails(read(client,'users/b/progress/current'));
  await assertFails(put(client,'users/b/progress/current',progress('b')));
  await assertFails(updateDoc(ref(client,'users/b/progress/current'),{nickname:'Intrusion'}));
  await assertFails(deleteDoc(ref(client,'users/b/progress/current')));
  await assertFails(read(client,'users/b'));
});
test('all 28 practice timestamps and complete selections accepted without nested validation overflow',async()=>{
  const data={...progress(),practiced:Object.fromEntries(catalog.juegos.map(g=>[g.repo,past])),visited:[1,2,3,4,5],
    route:catalog.juegos.map(g=>g.repo),avatarId:'avatar-06',companionId:'brio',evolutionCelebratedStage:3};
  await assertSucceeds(put(db('a'),'users/a/progress/current',data));
});
for (const game of catalog.juegos) test(`each catalog practice value is validated: ${game.repo}`,async()=>{
  await assertFails(put(db('a'),'users/a/progress/current',{...progress(),practiced:{[game.repo]:{unexpected:'map'}}}));
});
for(const [name,patch] of Object.entries({
  extraRole:{role:'teacher'}, fakeUid:{uid:'b'}, version:{schemaVersion:2}, revision:{revision:0},
  nickname:{nickname:'x'.repeat(31)}, avatar:{avatarId:'administrator'}, companion:{companionId:'unknown'},
  stage:{evolutionCelebratedStage:4}, fractionalStage:{evolutionCelebratedStage:1.5},
  unknownGame:{practiced:{unknown:past}}, nestedValue:{practiced:{'memorama-simplex':{role:'admin'}}},
  nullDate:{practiced:{'memorama-simplex':null}}, stringDate:{practiced:{'memorama-simplex':'2026-01-01'}},
  largeDate:{practiced:{'memorama-simplex':Timestamp.fromMillis(9999999999999)}},
  visited:{visited:[6]}, repeatedGym:{visited:[1,1]}, badRoute:{route:['unknown']}, repeatedRoute:{route:['OptiQuest1','OptiQuest1']},
  badges:{badges:[1,2,3,4,5]}, results:{results:[]}, injectedHistory:{gameResults:[]},
}))test(`reject malformed progress: ${name}`,async()=>assertFails(put(db('a'),'users/a/progress/current',{...progress(),...patch})));

test('required progress fields cannot be omitted and unknown singleton paths remain closed',async()=>{
  for(const key of Object.keys(progress())) {
    const data=progress(); delete data[key];
    await assertFails(put(db('a'),'users/a/progress/current',data));
  }
  await assertFails(put(db('a'),'users/a/progress/other',progress()));
});

test('client cannot grant role, membership, enrollment or verified statistics, even in an atomic batch',async()=>{
  const client=db('a',{role:'admin',teacher:true});
  for(const path of ['staff/a','users/a/staff/a','courses/course-test/staff/a',`${group('group-a')}/staff/a`,
    `${group('group-b')}/members/a`,'courses/course-test/members/forged','users/a/enrollments/fake',
    `${group('group-a')}/leaderboard/a`,`${group('group-a')}/studentSummaries/a`]) {
    await assertFails(put(client,path,{...grant('a','group-b'),role:'admin',points:999999}));
  }
  await assertFails(put(client,'users/a',{schemaVersion:1,uid:'a',createdAt:serverTimestamp(),role:'admin'}));
  const batch=writeBatch(client);
  batch.set(ref(client,`${group('group-b')}/members/a`),grant('a','group-b'));
  batch.set(ref(client,`${group('group-b')}/leaderboard/a`),{points:100});
  await assertFails(batch.commit());
});
test('self-reported game runs immutable and paginated; cannot read another student or all histories',async()=>{
  const client=db('a'),path=`users/a/gameRuns/${runId}`;
  await assertSucceeds(put(client,path,run()));
  await assertSucceeds(read(client,path));
  await assertSucceeds(getDocs(query(collection(client,'users/a/gameRuns'),orderBy('date','desc'),limit(50))));
  await assertFails(getDocs(collection(client,'users/a/gameRuns')));
  await assertFails(getDocs(query(collection(client,'users/a/gameRuns'),limit(51))));
  await assertFails(getDocs(query(collection(client,'users/b/gameRuns'),limit(50))));
  await assertFails(getDocs(query(collectionGroup(client,'gameRuns'),where('uid','==','a'),limit(50))));
  await assertFails(updateDoc(ref(client,path),{trust:'server-validated'}));
  await assertFails(deleteDoc(ref(client,path)));
});
for(const [name,patch] of Object.entries({trust:{trust:'server-validated'},uid:{uid:'b'},game:{gameId:'unknown'},
  extra:{points:1000},id:{runId:'wrong'},result:{result:{...run().result,errors:99}},
  accuracy:{result:{...run().result,accuracy:100}},fraction:{result:{...run().result,attempts:10.5}},
  time:{result:{...run().result,elapsedMs:604800001}},nested:{result:{...run().result,admin:true}}})) {
  test(`reject malformed game run: ${name}`,async()=>assertFails(put(db('a'),`users/a/gameRuns/${runId}`,{...run(),...patch})));
}
test('diagnostic answers and score validated, immutable and private',async()=>{
  const client=db('a'),path='users/a/diagnostics/attempt-test';
  await assertSucceeds(put(client,path,diagnostic()));
  await assertSucceeds(getDocs(query(collection(client,'users/a/diagnostics'),orderBy('date','desc'),limit(30))));
  await assertFails(put(client,'users/a/diagnostics/bad',{...diagnostic(),score:4}));
  await assertFails(put(client,'users/a/diagnostics/bad',{...diagnostic(),answers:[1,0,1,1,9]}));
  await assertFails(put(client,'users/a/diagnostics/bad',{...diagnostic(),answers:[1]}));
  await assertFails(read(db('b'),path));
  await assertFails(deleteDoc(ref(client,path)));
});
test('evolution milestones preserve evidence with known rules and thresholds, not competitive trust',async()=>{
  const evidence=Object.fromEntries(catalog.juegos.map(g=>[g.repo,past]));
  const data={schemaVersion:1,uid:'a',trust:'self-reported',createdAt:serverTimestamp(),stage:3,ruleVersion:1,unlockedAt:past,practice:evidence};
  await assertSucceeds(put(db('a'),'users/a/evolutionMilestones/3',data));
  await assertSucceeds(getDocs(query(collection(db('a'),'users/a/evolutionMilestones'),limit(2))));
  await assertFails(put(db('a'),'users/a/evolutionMilestones/2',{...data,stage:2,practice:{}}));
  await assertFails(put(db('a'),'users/a/evolutionMilestones/2',{...data,stage:2,ruleVersion:2}));
  const sixOneGym=Object.fromEntries(catalog.juegos.filter(g=>g.gimnasio===2).slice(0,6).map(g=>[g.repo,past]));
  await assertFails(put(db('a'),'users/a/evolutionMilestones/2',{...data,stage:2,practice:sixOneGym}));
  const sixTwoGyms=Object.fromEntries(catalog.juegos.slice(0,6).map(g=>[g.repo,past]));
  await assertSucceeds(put(db('a'),'users/a/evolutionMilestones/2',{...data,stage:2,practice:sixTwoGyms}));
  await assertFails(read(db('b'),'users/a/evolutionMilestones/3'));
  await assertFails(deleteDoc(ref(db('a'),'users/a/evolutionMilestones/3')));
});
test('student and authorized teacher can get own group projections, other group denied',async()=>{
  for(const uid of ['a','teacher-a']) {
    await assertSucceeds(read(db(uid),group('group-a')));
    await assertSucceeds(read(db(uid),`${group('group-a')}/leaderboard/a`));
    await assertSucceeds(read(db(uid),`${group('group-a')}/studentSummaries/a`));
    await assertFails(read(db(uid),`${group('group-b')}/leaderboard/b`));
    await assertFails(read(db(uid),`${group('group-b')}/studentSummaries/b`));
    await assertFails(read(db(uid),group('group-b')));
  }
  await assertSucceeds(read(db('teacher-a'),`${group('group-a')}/members/a`));
  await assertFails(read(db('teacher-b'),`${group('group-a')}/members/a`));
  await assertFails(read(db('teacher-a'),'users/b/progress/current'));
});
test('multiple memberships work; revocation removes group access without touching personal progress',async()=>{
  const client=db('a');
  await assertSucceeds(put(client,'users/a/progress/current',progress()));
  await operator(c=>put(c,`${group('group-b')}/members/a`,grant('a','group-b')));
  await assertSucceeds(read(client,`${group('group-b')}/leaderboard/b`));
  await operator(c=>updateDoc(ref(c,`${group('group-b')}/members/a`),{status:'revoked'}));
  await assertFails(read(client,`${group('group-b')}/leaderboard/b`));
  await assertSucceeds(read(client,'users/a/progress/current'));
});
for(const [label,path,patch] of [
  ['missing group grant',`${group('group-a')}/members/a`,null],
  ['revoked course','courses/course-test/members/a',{status:'revoked'}],
  ['wrong uid',`${group('group-a')}/members/a`,{uid:'b'}],
  ['wrong course',`${group('group-a')}/members/a`,{courseId:'other'}],
  ['wrong term',`${group('group-a')}/members/a`,{termId:'other'}],
  ['wrong group',`${group('group-a')}/members/a`,{groupId:'group-b'}],
  ['unknown field',`${group('group-a')}/members/a`,{role:'admin'}],
  ['malformed status',`${group('group-a')}/members/a`,{status:true}],
  ['missing course','courses/course-test',null],
  ['missing term','courses/course-test/terms/term-test',null],
  ['inconsistent group',group('group-a'),{termId:'other'}],
])test(`fail closed on ${label}`,async()=>{
  await operator(c=>patch?updateDoc(ref(c,path),patch):deleteDoc(ref(c,path)));
  await assertFails(read(db('a'),`${group('group-a')}/leaderboard/a`));
});
test('staff revocation, wrong scope and claims alone cannot authorize teacher',async()=>{
  await operator(c=>updateDoc(ref(c,`${group('group-a')}/staff/teacher-a`),{status:'revoked'}));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/studentSummaries/a`));
  await assertFails(read(db('a',{role:'teacher',admin:true}),`${group('group-b')}/studentSummaries/b`));
  await operator(c=>put(c,`${group('group-a')}/staff/teacher-a`,{...grant('teacher-a','group-a'),courseId:'other'}));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/studentSummaries/a`));
});
test('missing or revoked course staff overrides otherwise valid group assignment',async()=>{
  await operator(c=>deleteDoc(ref(c,'courses/course-test/staff/teacher-a')));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/studentSummaries/a`));
  await operator(c=>put(c,'courses/course-test/staff/teacher-a',{schemaVersion:1,uid:'teacher-a',courseId:'course-test',status:'revoked'}));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/studentSummaries/a`));
});
test('historical term does not inherit access from a group with the same name',async()=>{
  const old='courses/course-test/terms/old-test/groups/group-a';
  await operator(async c=>{
    await put(c,'courses/course-test/terms/old-test',{schemaVersion:1,courseId:'course-test',termId:'old-test',title:'Synthetic older term',status:'active'});
    await put(c,old,{...scope('group-a'),termId:'old-test',title:'Synthetic older group',status:'active'});
    await put(c,`${old}/studentSummaries/a`,{...scope('group-a'),termId:'old-test',uid:'a',trust:'self-reported',practicedCount:2,updatedAt:past});
  });
  await assertFails(read(db('teacher-a'),`${old}/studentSummaries/a`));
  await assertFails(read(db('a'),`${old}/studentSummaries/a`));
});
test('discovery pointers neither grant access nor permit unbounded queries',async()=>{
  await operator(c=>put(c,'users/a/enrollments/fixture',{...grant('a','group-b')}));
  await assertSucceeds(getDocs(query(collection(db('a'),'users/a/enrollments'),limit(20))));
  await assertFails(getDocs(collection(db('a'),'users/a/enrollments')));
  await assertFails(read(db('a'),`${group('group-b')}/leaderboard/b`));
  await assertFails(read(db('b'),'users/a/enrollments/fixture'));
});
test('metadata, grants and projections cannot be deleted or changed by teacher clients',async()=>{
  for(const path of ['courses/course-test',group('group-a'),`${group('group-a')}/members/a`,
    `${group('group-a')}/staff/teacher-a`,`${group('group-a')}/leaderboard/a`,`${group('group-a')}/studentSummaries/a`]) {
    await assertFails(deleteDoc(ref(db('teacher-a'),path)));
    await assertFails(updateDoc(ref(db('teacher-a'),path),{status:'revoked'}));
  }
});
test('malformed roster document cannot be read even by authorized group teacher',async()=>{
  await operator(c=>put(c,`${group('group-a')}/members/b`,{...grant('b','group-b')}));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/members/b`));
});
test('malformed private projections fail closed, including injected email',async()=>{
  await operator(c=>updateDoc(ref(c,`${group('group-a')}/leaderboard/a`),{email:'synthetic@example.test'}));
  await assertFails(read(db('a'),`${group('group-a')}/leaderboard/a`));
  await operator(c=>updateDoc(ref(c,`${group('group-a')}/studentSummaries/a`),{groupId:'group-b'}));
  await assertFails(read(db('teacher-a'),`${group('group-a')}/studentSummaries/a`));
});
test('broad lists, collection-group scans and future admin/editor routes denied',async()=>{
  for(const client of [db('a'),db('teacher-a'),db('teacher-b')]) {
    for(const path of ['users','courses',`${base}`,`${group('group-a')}/members`,`${group('group-a')}/leaderboard`]) {
      await assertFails(getDocs(query(collection(client,path),limit(20))));
    }
    for(const path of ['courses/course-test/activities/draft-test',`${group('group-a')}/groupActivities/activity-test`,
      `${group('group-a')}/activityPlacements/3`,`${group('group-a')}/activityAttempts/attempt-test`,
      `${group('group-a')}/invitations/invite-test`,'gyms/3','activities/private-test']) {
      await assertFails(read(client,path));
      await assertFails(put(client,path,{status:'published',createdBy:'teacher-a'}));
    }
    await assertFails(getDocs(query(collectionGroup(client,'leaderboard'),limit(20))));
  }
});
test('negative authorization assertion detects deliberately insecure rules (mutation control)',async()=>{
  const crossAccount = () => assertFails(read(db('a'),'users/b/progress/current'));
  await crossAccount();
  const insecure="rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{p=**} { allow read, write: if true; } } }";
  try {
    await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules:insecure}}).then(e=>e.cleanup());
    await assert.rejects(crossAccount,/Expected request to fail/);
  } finally {
    await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8085,rules}}).then(e=>e.cleanup());
  }
});
