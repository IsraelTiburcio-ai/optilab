import {useEffect} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {bindInvitationSession} from './invitationMemory';
export function InvitationFence(){const {status,user}=useAuth();useEffect(()=>{if(status!=='loading')bindInvitationSession(user?.uid??null);},[status,user?.uid]);return null;}
