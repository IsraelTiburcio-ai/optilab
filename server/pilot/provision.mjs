import {createHash} from 'node:crypto';
export const PILOT_PROJECT='optilab-cd829';
const idPattern=/^[A-Za-z0-9_-]{1,80}$/,uidPattern=/^[A-Za-z0-9_-]{1,128}$/;
const titlePattern=/^[^\u0000-\u001f\u007f]{1,120}$/;
const scopeKey=s=>createHash('sha256').update(JSON.stringify([s.courseId,s.termId,s.groupId])).digest('hex');
function fail(message){throw new Error(`PILOT_MANIFEST_REJECTED: ${message}`);}
function object(value,name){if(!value||typeof value!=='object'||Array.isArray(value))fail(`${name} must be an object`);return value;}
function identifier(value,name){if(typeof value!=='string'||!idPattern.test(value))fail(`${name} must be an identifier`);return value;}
function uid(value,name){if(typeof value!=='string'||!uidPattern.test(value))fail(`${name} must be a Firebase UID`);return value;}
function title(value,name){if(typeof value!=='string'||!titlePattern.test(value))fail(`${name} must be a title`);return value;}
export function validatePilotManifest(raw){
  const m=object(raw,'manifest');
  if(m.projectId!==PILOT_PROJECT)fail(`projectId must be ${PILOT_PROJECT}`);
  const teacherUid=uid(m.teacherUid,'teacherUid');
  const course=object(m.course,'course'),term=object(m.term,'term'),group=object(m.group,'group');
  const courseId=identifier(course.id,'course.id'),termId=identifier(term.id,'term.id'),groupId=identifier(group.id,'group.id');
  const result={projectId:PILOT_PROJECT,teacherUid,course:{id:courseId,title:title(course.title,'course.title')},
    term:{id:termId,title:title(term.title,'term.title')},group:{id:groupId,title:title(group.title,'group.title')},students:[]};
  if(m.students!==undefined){
    if(!Array.isArray(m.students)||m.students.length>2)fail('students must contain at most two UIDs');
    const seen=new Set();
    result.students=m.students.map((student,index)=>{
      const row=object(student,`students[${index}]`),studentUid=uid(row.uid,`students[${index}].uid`);
      if(seen.has(studentUid))fail('student UIDs must be unique');seen.add(studentUid);
      if(row.label!==undefined&&(typeof row.label!=='string'||row.label.length<1||row.label.length>80||/[\u0000-\u001f\u007f]/.test(row.label)))fail(`students[${index}].label invalid`);
      return {uid:studentUid,...(row.label!==undefined?{label:row.label}:{})};
    });
  }
  return Object.freeze(result);
}
export function buildPilotPlan(raw){
  const m=validatePilotManifest(raw),s={courseId:m.course.id,termId:m.term.id,groupId:m.group.id},root=`courses/${s.courseId}/terms/${s.termId}/groups/${s.groupId}`;
  const writes=[
    {path:`courses/${s.courseId}`,data:{schemaVersion:1,courseId:s.courseId,title:m.course.title,status:'active'}},
    {path:`courses/${s.courseId}/academicSettings/current`,data:{schemaVersion:2,courseId:s.courseId,allowMultipleGroupsPerTerm:true}},
    {path:`courses/${s.courseId}/staff/${m.teacherUid}`,data:{schemaVersion:1,uid:m.teacherUid,courseId:s.courseId,status:'active'}},
    {path:`courses/${s.courseId}/administration/${m.teacherUid}`,data:{schemaVersion:2,uid:m.teacherUid,courseId:s.courseId,status:'active',createTerms:true,createGroups:true}},
    {path:`courses/${s.courseId}/terms/${s.termId}`,data:{schemaVersion:1,courseId:s.courseId,termId:s.termId,title:m.term.title,status:'active'}},
    {path:`${root}`,data:{schemaVersion:1,...s,title:m.group.title,status:'active'}},
    {path:`${root}/staff/${m.teacherUid}`,data:{schemaVersion:1,...s,uid:m.teacherUid,status:'active'}},
    {path:`${root}/administration/${m.teacherUid}`,data:{schemaVersion:2,...s,uid:m.teacherUid,status:'active',manageInvitations:true,manageMembers:true,readHistory:true}},
    {path:`${root}/settings/current`,data:{schemaVersion:2,...s,revision:0}},
    {path:`users/${m.teacherUid}/teachingScopes/${scopeKey(s)}`,data:{schemaVersion:2,...s,uid:m.teacherUid,status:'active'}},
  ];
  return Object.freeze({mode:'DRY-RUN',network:false,productionWrites:false,projectId:m.projectId,scope:s,teacherUid:m.teacherUid,
    teacherUidVerified:false,students:m.students,studentWrites:false,writes});
}
