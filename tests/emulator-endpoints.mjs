// Two explicit loopback pairs only. Never accepts an arbitrary host or project.
const isolated=process.env.CLOUD_QA_ISOLATED==='1';
export const authPort=isolated?9199:9099;
export const firestorePort=isolated?8185:8085;
export const authHost=`127.0.0.1:${authPort}`;
export const firestoreHost=`127.0.0.1:${firestorePort}`;
export const authUrl=`http://${authHost}`;

export const syncBase=`http://127.0.0.1:${isolated?5296:5195}/optilab/`;
