import {useSyncExternalStore} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {syncMode} from '../progress/config';
import {wasAdmitted,subscribeAdmission} from '../progress/admissionSignal';
export const integratedBuild=['general-v1','pilot-v1'].includes((import.meta.env??{}).VITE_INTEGRATED_PROGRESS)&&syncMode!=='disabled';
export function useIntegratedFeatures(){const auth=useAuth();return useSyncExternalStore(subscribeAdmission,()=>integratedBuild&&(syncMode==='emulator'||!!auth.user&&wasAdmitted(auth.user.uid)),()=>false);}
