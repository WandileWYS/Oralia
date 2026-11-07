import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { request } from '../lib/api';

export function usePlaybackSource(source:string){
  const [url,setUrl]=useState<string>();const [notice,setNotice]=useState('');const [pending,setPending]=useState(true);const [retryCount,setRetryCount]=useState(0);
  const failure=useCallback(()=>{setNotice('Narration could not load. Retry playback when your connection returns.');setPending(false);},[]);
  const retry=()=>setRetryCount(count=>count+1);
  useEffect(()=>{
    const controller=new AbortController();setUrl(undefined);setPending(true);setNotice('');
    if(source.startsWith('https://res.cloudinary.com/')){setUrl(source);setPending(false);return()=>controller.abort();}
    request(`/media-status?url=${encodeURIComponent(source)}`,z.object({available:z.boolean()}),{signal:controller.signal}).then(result=>{if(controller.signal.aborted)return;if(result.available)setUrl(source);else setNotice('Narration is unavailable. Read the transcript or retry later.');setPending(false);}).catch(()=>{if(!controller.signal.aborted)failure();});
    return()=>controller.abort();
  },[source,retryCount,failure]);
  return {url,notice,pending,failure,retry};
}
