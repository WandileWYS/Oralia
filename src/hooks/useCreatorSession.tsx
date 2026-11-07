import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CreatorSession } from '../types/creator';
import { api, ApiError } from '../lib/api';

export const CreatorSessionContext=createContext<CreatorSession|null>(null);
export const useCreatorSession=()=>useContext(CreatorSessionContext);
export function usePersistentSession(){
  const [session,setSession]=useState<CreatorSession|null>(null);const [notice,setNotice]=useState('');
  const revision=useRef(0);const signingOut=useRef(false);
  const save=(value:CreatorSession|null)=>{revision.current++;setSession(value);setNotice('');};
  useEffect(()=>{
    let active=true;
    try{localStorage.removeItem('oralia-creator-session');}catch{/* No credential persistence is required in JavaScript. */}
    const restore=()=>{if(signingOut.current)return;const request=++revision.current;void api.session().then(value=>{if(active&&request===revision.current){setSession(value);setNotice('');}}).catch(error=>{if(active&&request===revision.current){if(error instanceof ApiError&&error.status===401)setSession(null);else setNotice('Your session could not be checked. Please retry sign-in.');}});};
    restore();window.addEventListener('focus',restore);
    return()=>{active=false;window.removeEventListener('focus',restore);};
  },[]);
  const signOut=async()=>{if(signingOut.current)return;signingOut.current=true;revision.current++;try{await api.logout();setSession(null);setNotice('Signed out. Your account bookmarks are preserved.');}catch{setNotice('Sign-out could not complete. Retry when the connection returns.');}finally{signingOut.current=false;}};
  return {session,save,signOut,notice};
}
