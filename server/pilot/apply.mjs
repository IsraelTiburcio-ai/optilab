import {applicationDefault,deleteApp,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const PROJECT='optilab-cd829';
export function assertProvisionApproval(env,{execute=false,confirm=''}={}){
  if(env.CI)throw new Error('PILOT_EXECUTION_CI_FORBIDDEN');
  if(!execute)throw new Error('PILOT_DRY_RUN_ONLY');
  if(env.PILOT_PROVISION_APPROVAL!==`apply:${PROJECT}`)throw new Error('PILOT_APPROVAL_REQUIRED');
  if(confirm!==`provision:${PROJECT}`)throw new Error('PILOT_CONFIRMATION_REQUIRED');
  return true;
}
export async function applyPilotPlan(plan,admin){
  if(!plan||plan.mode!=='DRY-RUN'||plan.projectId!==PROJECT||plan.productionWrites!==false||!Array.isArray(plan.writes)||plan.writes.length!==10)throw new Error('PILOT_PLAN_REJECTED');
  let owned=false,app,db,auth;
  if(admin){({db,auth}=admin);}else{
    app=initializeApp({projectId:PROJECT,credential:applicationDefault()});
    db=getFirestore(app);auth=getAuth(app);owned=true;
  }
  try{
    const user=await auth.getUser(plan.teacherUid);
    if(!user||user.disabled||user.emailVerified!==true)throw new Error('PILOT_TEACHER_AUTH_REJECTED');
    await db.runTransaction(async tx=>{
      const refs=plan.writes.map(write=>db.doc(write.path));
      const existing=await Promise.all(refs.map(ref=>tx.get(ref)));
      if(existing.some(snapshot=>snapshot.exists))throw new Error('PILOT_EXISTING_DOCUMENT_REJECTED');
      refs.forEach((ref,index)=>tx.set(ref,plan.writes[index].data));
    });
    return {mode:'EXECUTED',projectId:PROJECT,teacherUidVerified:true,documentsWritten:plan.writes.length};
  }finally{if(owned&&app)await deleteApp(app);}
}
