import {useEffect,useSyncExternalStore} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {useAcademicAccess} from './AcademicAccess';
import {invitationSnapshot,subscribeInvitation} from './invitationMemory';
export function AccountAcademicEntry(){
  const access=useAcademicAccess(),navigate=useNavigate();
  const invitation=useSyncExternalStore(subscribeInvitation,invitationSnapshot),[search]=useSearchParams();
  useEffect(()=>{if(search.get('verificar')==='1')return;
    if(access.checked&&!access.teacher&&!access.error&&(access.identity===null||(access.identity&&invitation.context?.token)))navigate('/bienvenida',{replace:true});
  },[access.checked,access.teacher,access.identity,access.error,invitation.context,navigate,search]);
  return null;
}
