import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildPilotPlan,validatePilotManifest,PILOT_PROJECT} from '../../server/pilot/provision.mjs';
import {applyPilotPlan,assertProvisionApproval} from '../../server/pilot/apply.mjs';
const manifest={projectId:PILOT_PROJECT,teacherUid:'synthetic_teacher_uid_001',
  course:{id:'synthetic-course',title:'Optimización I'},term:{id:'synthetic-term',title:'2026-2'},
  group:{id:'synthetic-group',title:'Grupo piloto'},students:[{uid:'synthetic_student_uid_001',label:'Alumno 1'},{uid:'synthetic_student_uid_002',label:'Alumno 2'}]};
test('pilot dry-run builds only exact authorization documents and never grants students',()=>{
  const plan=buildPilotPlan(manifest);
  assert.equal(plan.mode,'DRY-RUN');assert.equal(plan.network,false);assert.equal(plan.productionWrites,false);assert.equal(plan.studentWrites,false);
  assert.equal(plan.teacherUidVerified,false);assert.equal(plan.writes.length,10);
  const paths=plan.writes.map((write:any)=>write.path);
  for(const path of [
    'courses/synthetic-course','courses/synthetic-course/academicSettings/current','courses/synthetic-course/staff/synthetic_teacher_uid_001',
    'courses/synthetic-course/administration/synthetic_teacher_uid_001','courses/synthetic-course/terms/synthetic-term','courses/synthetic-course/terms/synthetic-term/groups/synthetic-group',
    'courses/synthetic-course/terms/synthetic-term/groups/synthetic-group/staff/synthetic_teacher_uid_001',
    'courses/synthetic-course/terms/synthetic-term/groups/synthetic-group/administration/synthetic_teacher_uid_001',
    'courses/synthetic-course/terms/synthetic-term/groups/synthetic-group/settings/current'])assert.ok(paths.includes(path),path);
  assert.ok(paths.some((path:string)=>path.startsWith('users/synthetic_teacher_uid_001/teachingScopes/')));
  assert.equal(paths.some((path:string)=>path.includes('synthetic_student')),false);
  const course=plan.writes.find((write:any)=>write.path==='courses/synthetic-course');
  assert.deepEqual(course.data,{schemaVersion:1,courseId:'synthetic-course',title:'Optimización I',status:'active'});
  assert.equal(plan.writes.find((write:any)=>write.path==='courses/synthetic-course/terms/synthetic-term').data.title,'2026-2');
  const groupAdmin=plan.writes.find((write:any)=>write.path.endsWith('/administration/synthetic_teacher_uid_001')&&write.data.termId);
  assert.deepEqual(groupAdmin.data,{schemaVersion:2,courseId:'synthetic-course',termId:'synthetic-term',groupId:'synthetic-group',
    uid:'synthetic_teacher_uid_001',status:'active',manageInvitations:true,manageMembers:true,readHistory:true});
});
test('manifest validation rejects wrong project, traversal, bad titles, duplicate or excess students',()=>{
  for(const patch of [
    {projectId:'other-project'},{teacherUid:'uid/../../x'},{course:{...manifest.course,id:'c/../../x'}},
    {course:{...manifest.course,title:'Bad\nTitle'}},{students:[{uid:'synthetic_student_uid_001'},{uid:'synthetic_student_uid_001'}]},
    {students:[{uid:'a'},{uid:'b'},{uid:'c'}]},
  ])assert.throws(()=>validatePilotManifest({...manifest,...patch}),/PILOT_MANIFEST_REJECTED/);
});
test('owner CLI is dry-run and execute is closed until separate authorization',()=>{
  const dir=mkdtempSync(join(tmpdir(),'optilab-pilot-')),file=join(dir,'manifest.json');writeFileSync(file,JSON.stringify(manifest));
  const dry=spawnSync(process.execPath,['scripts/pilot-provision.mjs','--manifest',file],{encoding:'utf8'});
  assert.equal(dry.status,0,dry.stderr);const plan=JSON.parse(dry.stdout);assert.equal(plan.mode,'DRY-RUN');assert.equal(plan.network,false);
  const execute=spawnSync(process.execPath,['scripts/pilot-provision.mjs','--manifest',file,'--execute'],{encoding:'utf8'});
  assert.notEqual(execute.status,0);assert.match(execute.stderr,/PILOT_(EXECUTION_CI_FORBIDDEN|APPROVAL_REQUIRED)/);assert.equal(execute.stdout,'');
  const noCi={...process.env};delete noCi.CI;
  const noConfirm=spawnSync(process.execPath,['scripts/pilot-provision.mjs','--manifest',file,'--execute'],{encoding:'utf8',env:{...noCi,PILOT_PROVISION_APPROVAL:'apply:optilab-cd829'}});
  assert.notEqual(noConfirm.status,0);assert.match(noConfirm.stderr,/PILOT_CONFIRMATION_REQUIRED/);assert.equal(noConfirm.stdout,'');
  assert.doesNotMatch(dry.stdout+execute.stdout+execute.stderr,/private_key|BEGIN RSA|FIREBASE_SERVICE_ACCOUNT/);
});

test('real bootstrap guards approval, CI, Auth verification and existing documents',async()=>{
  const plan=buildPilotPlan(manifest);
  assert.throws(()=>assertProvisionApproval({CI:'true'},{execute:true,confirm:'provision:optilab-cd829'}),/CI_FORBIDDEN/);
  assert.throws(()=>assertProvisionApproval({},{execute:true,confirm:'provision:optilab-cd829'}),/APPROVAL_REQUIRED/);
  assert.throws(()=>assertProvisionApproval({PILOT_PROVISION_APPROVAL:'apply:optilab-cd829'},{execute:true,confirm:'wrong'}),/CONFIRMATION_REQUIRED/);
  assert.equal(assertProvisionApproval({PILOT_PROVISION_APPROVAL:'apply:optilab-cd829'},{execute:true,confirm:'provision:optilab-cd829'}),true);
  const makeAdmin=(exists=false,emailVerified=true)=>{
    const writes:any[]=[];
    return {writes,auth:{getUser:async()=>({disabled:false,emailVerified})},
      db:{doc:(path:string)=>path,runTransaction:async(fn:any)=>fn({get:async()=>({exists}),set:(path:string,data:any)=>writes.push({path,data})})}};
  };
  const unverified=makeAdmin(false,false);await assert.rejects(applyPilotPlan(plan,unverified),/TEACHER_AUTH_REJECTED/);assert.equal(unverified.writes.length,0);
  const existing=makeAdmin(true);await assert.rejects(applyPilotPlan(plan,existing),/EXISTING_DOCUMENT_REJECTED/);assert.equal(existing.writes.length,0);
  const clean=makeAdmin(false);const result=await applyPilotPlan(plan,clean);assert.equal(result.mode,'EXECUTED');assert.equal(result.teacherUidVerified,true);assert.equal(result.documentsWritten,10);assert.equal(clean.writes.length,10);
});
