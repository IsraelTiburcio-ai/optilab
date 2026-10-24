import {academicEnvironment} from './academic-env.mjs';
if(process.argv.some(a=>a.startsWith('--')&&a!=='--reveal-invitation'))throw new Error('ACADEMIC_CLIENT_REJECTED');
const env=academicEnvironment(),chunks=[];
for await(const chunk of process.stdin)chunks.push(chunk);
let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Provide a private JSON envelope on stdin.');}
const {email,password,operation,payload}=input;
if(typeof email!=='string'||typeof password!=='string'||!operation||!payload)throw new Error('ACADEMIC_CLIENT_REJECTED');
const signed=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-emulator-only-key',{
  method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
if(!signed.ok)throw new Error('ACADEMIC_CLIENT_AUTH_FAILED');const {idToken}=await signed.json();
const response=await fetch(`http://127.0.0.1:${env.ACADEMIC_ADMIN_PORT??5200}/v1/${encodeURIComponent(operation)}`,{
  method:'POST',redirect:'error',headers:{Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
const result=await response.json();if(result.token&&!process.argv.includes('--reveal-invitation'))result.token='[redacted; use --reveal-invitation only in a private terminal]';
console.log(JSON.stringify({status:response.status,result},null,2));process.exit(response.ok?0:1);
