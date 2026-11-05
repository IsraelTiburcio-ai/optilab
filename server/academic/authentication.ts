import type {Auth} from 'firebase-admin/auth';
import {ApiError} from './errors.js';
import {identifier} from './validation.js';
import type {Actor} from './contracts.js';
export async function authenticate(auth:Auth,header:string|undefined,expectedProjectId?:string):Promise<Actor> {
  if(!header||header.length>8200||!/^Bearer [A-Za-z0-9_.-]+$/.test(header))throw new ApiError(401,'UNAUTHENTICATED','Se requiere una sesión válida.');
  try {
    const token=await auth.verifyIdToken(header.slice(7),true);
    if(!identifier(token.uid,128)||token.firebase?.sign_in_provider==='anonymous')throw new Error('Invalid actor');
    if(expectedProjectId&&(token.aud!==expectedProjectId||token.iss!==`https://securetoken.google.com/${expectedProjectId}`))throw new Error('Invalid token project');
    return {uid:token.uid,label:typeof token.name==='string'?token.name.slice(0,80):'Alumno'};
  }catch{throw new ApiError(401,'UNAUTHENTICATED','Se requiere una sesión válida.');}
}
