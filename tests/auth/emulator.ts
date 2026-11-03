const port=process.env.AUTH_QA_EMULATOR_PORT??'9099';
if(!['9099','9199'].includes(port))throw Error('Unsupported isolated Auth QA port');
export const authEmulator=`http://127.0.0.1:${port}`;
