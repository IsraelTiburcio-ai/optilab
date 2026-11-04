const projects={production:'optilab-cd829',emulator:'demo-optilab-sync'};
const emulatorPairs=[
  {FIRESTORE_EMULATOR_HOST:'127.0.0.1:8185',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'},
  {FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},
];
const endpointKeys=['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'];
function approvedEmulatorEndpoints(env){
  const present=endpointKeys.filter(key=>env[key]!==undefined&&env[key]!=='');
  if(!present.length)return emulatorPairs[0];
  const pair=emulatorPairs.find(candidate=>endpointKeys.every(key=>env[key]===candidate[key]));
  if(!pair)throw Error('Unexpected emulator endpoint');
  return pair;
}

/** Pure validation: never loads ADC, initializes an SDK or changes the environment. */
export function administrativeTarget(target,projectId,env=process.env){
  if(!Object.hasOwn(projects,target)||projectId!==projects[target])throw Error('Explicit supported administrative target/project required');
  const quota=env.GOOGLE_CLOUD_QUOTA_PROJECT;
  if(quota!==undefined&&quota!==''&&quota!==projectId)throw Error('Quota project does not match administrative target');
  return {target,projectId};
}
export function administrativeExecution(scope,env=process.env){
  const config=administrativeTarget(scope.target,scope.projectId,env);
  if(config.target==='production'){
    if(endpointKeys.some(key=>env[key]))throw Error('Production forbids emulator overrides');
  } else approvedEmulatorEndpoints(env);
  return config;
}

/** Called only after the CLI's existing execute/approval/confirmation gates. */
export async function withAdministrativeProcess(scope,run,env=process.env){
  const config=administrativeExecution(scope,env);
  const changes=config.target==='production'?{GOOGLE_CLOUD_QUOTA_PROJECT:config.projectId}:approvedEmulatorEndpoints(env);
  const previous=Object.entries(changes).map(([key])=>[key,Object.hasOwn(env,key),env[key]]);
  try{
    for(const [key,value]of Object.entries(changes))env[key]=value;
    return await run();
  }finally{
    for(const [key,present,value]of previous){if(present)env[key]=value;else delete env[key];}
  }
}

/** Lazy SDK loading and cleanup, including partial initialization and failed operations. */
export async function withAdministrativeSdk(scope,run,{env=process.env,loadSdk=name=>import(name)}={}){
  const config=administrativeExecution(scope,env);
  if(config.target==='production'&&env.GOOGLE_CLOUD_QUOTA_PROJECT!==config.projectId)throw Error('Production process quota not configured');
  if(config.target==='emulator'&&Object.entries(approvedEmulatorEndpoints(env)).some(([key,value])=>env[key]!==value))throw Error('Both approved emulator endpoints required');
  const [apps,firestore,accounts]=await Promise.all(['firebase-admin/app','firebase-admin/firestore','firebase-admin/auth'].map(loadSdk));
  let app,db;
  try{
    app=apps.initializeApp({projectId:config.projectId,...(config.target==='production'?{credential:apps.applicationDefault()}:{})});
    db=firestore.getFirestore(app);
    const auth=accounts.getAuth(app);
    return await run({app,db,auth,Timestamp:firestore.Timestamp});
  }finally{
    try{if(db)await db.terminate();}finally{if(app)await apps.deleteApp(app);}
  }
}
