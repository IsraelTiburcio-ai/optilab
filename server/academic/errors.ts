export class ApiError extends Error {
  constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
export const denied=()=>new ApiError(403,'FORBIDDEN','No tienes autorización para esta operación.');
export const invalid=()=>new ApiError(400,'INVALID_INPUT','Solicitud no válida.');
export const conflict=()=>new ApiError(409,'CONFLICT','El estado cambió; actualiza y revisa la operación.');
export const unavailableInvite=()=>new ApiError(404,'INVITATION_UNAVAILABLE','Invitación no disponible.');
export function publicError(error:unknown):ApiError {
  if(error instanceof ApiError)return error;
  const code=error&&typeof error==='object'&&'code' in error?error.code:null;
  if(code===8||code==='resource-exhausted')return new ApiError(429,'QUOTA_EXHAUSTED','Cuota agotada. Conserva la solicitud y reintenta más tarde.');
  if(code===10||code==='aborted')return conflict();
  return new ApiError(503,'SERVICE_UNAVAILABLE','No se confirmó la operación; reintenta con la misma clave.');
}
