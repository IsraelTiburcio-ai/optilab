/** Explicit local launch defaults; reject incompatible inherited values instead of hiding them. */
export function academicEnvironment(source=process.env) {
  const required={NODE_ENV:'development',ACADEMIC_ADMIN_MODE:'emulator',ACADEMIC_ADMIN_HOST:'127.0.0.1',
    ACADEMIC_ADMIN_PROJECT:'demo-optilab-sync',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',
    GCLOUD_PROJECT:'demo-optilab-sync',GOOGLE_CLOUD_PROJECT:'demo-optilab-sync'};
  const forbidden=['FIREBASE_CONFIG','GCE_METADATA_HOST','GCE_METADATA_IP','GOOGLE_CLOUD_QUOTA_PROJECT','K_SERVICE','FUNCTION_TARGET','FUNCTION_NAME','GAE_SERVICE','GRPC_TRACE','GRPC_VERBOSITY'];
  const port=Number(source.ACADEMIC_ADMIN_PORT??5200);
  if(Object.entries(required).some(([k,v])=>source[k]&&source[k]!==v)||
    Object.entries(source).some(([k,v])=>v&&(/CREDENTIAL|PRIVATE_KEY|SERVICE_ACCOUNT|FIREBASE_TOKEN/i.test(k)||forbidden.includes(k)))||
    ['GCP_PROJECT','FIREBASE_PROJECT_ID','VITE_FIREBASE_PROJECT_ID'].some(k=>source[k]&&source[k]!==required.ACADEMIC_ADMIN_PROJECT)||
    !Number.isInteger(port)||port<0||port>65535)
    throw new Error('ACADEMIC_ENV_REJECTED');
  return {...source,...required};
}
