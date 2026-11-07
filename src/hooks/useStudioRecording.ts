import { useEffect, useRef, useState } from 'react';

interface AudioDraft {url:string;name:string;blob:Blob}
export function useStudioRecording(){
  const [phase,setPhase]=useState<'idle'|'requesting'|'recording'|'ready'>('idle');const [draft,setDraft]=useState<AudioDraft|null>(null);const [elapsedSeconds,setElapsed]=useState(0);const [isPlaying,setIsPlaying]=useState(false);const [error,setError]=useState('');const [level,setLevel]=useState(0);
  const playback=useRef<HTMLAudioElement>(null);const recorder=useRef<MediaRecorder|null>(null);const stream=useRef<MediaStream|null>(null);const context=useRef<AudioContext|null>(null);const mounted=useRef(true);const animation=useRef(0);
  const release=()=>{cancelAnimationFrame(animation.current);stream.current?.getTracks().forEach(track=>track.stop());void context.current?.close().catch(()=>undefined);context.current=null;setLevel(0);};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(recorder.current?.state==='recording')recorder.current.stop();cancelAnimationFrame(animation.current);stream.current?.getTracks().forEach(track=>track.stop());void context.current?.close().catch(()=>undefined);};},[]);
  useEffect(()=>()=>{if(draft)URL.revokeObjectURL(draft.url);},[draft]);
  useEffect(()=>{if(phase!=='recording')return;const began=performance.now();const timer=window.setInterval(()=>{const seconds=Math.floor((performance.now()-began)/1000);setElapsed(seconds);if(seconds>=300&&recorder.current?.state==='recording')recorder.current.stop();},250);return()=>clearInterval(timer);},[phase]);
  const start=async()=>{
    if(phase==='recording'||phase==='requesting')return;setError('');setElapsed(0);playback.current?.pause();
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('Microphone recording is unavailable. Upload audio or type your story.');return;}
    setPhase('requesting');
    try{
      const input=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current){input.getTracks().forEach(track=>track.stop());return;}stream.current=input;
      const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));const next=new MediaRecorder(input,mimeType?{mimeType}:undefined);const chunks:Blob[]=[];let size=0;
      next.ondataavailable=event=>{if(event.data.size){size+=event.data.size;chunks.push(event.data);if(size>20*1024*1024&&next.state==='recording')next.stop();}};
      next.onstop=()=>{release();if(!mounted.current)return;const blob=new Blob(chunks,{type:next.mimeType});if(!blob.size||blob.size>20*1024*1024){setPhase('idle');setError('Record audio between one byte and 20 MB.');return;}setDraft({url:URL.createObjectURL(blob),blob,name:'Your microphone recording'});setPhase('ready');};
      next.onerror=()=>{release();if(mounted.current){setPhase('idle');setError('Recording failed. Your written story is preserved.');}};
      if(typeof AudioContext!=='undefined'){
        const audioContext=new AudioContext();context.current=audioContext;const analyser=audioContext.createAnalyser();audioContext.createMediaStreamSource(input).connect(analyser);const data=new Uint8Array(analyser.fftSize);
        const update=()=>{analyser.getByteTimeDomainData(data);let power=0;for(const sample of data)power+=((sample-128)/128)**2;setLevel(Math.min(1,Math.sqrt(power/data.length)*3));animation.current=requestAnimationFrame(update);};update();
      }
      recorder.current=next;next.start(1000);setPhase('recording');
    }catch{release();if(mounted.current){setPhase('idle');setError('Microphone access was unavailable. Upload audio or type your story.');}}
  };
  const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
  const upload=(file:File)=>{if(phase==='recording'||phase==='requesting')return;if((!file.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|webm|ogg|mp4|flac)$/i.test(file.name))||file.size>20*1024*1024){setError('Choose audio up to five minutes and 20 MB.');return;}playback.current?.pause();setDraft({url:URL.createObjectURL(file),blob:file,name:file.name});setPhase('ready');setError('');};
  const remove=()=>{playback.current?.pause();setDraft(null);setPhase('idle');setError('');setElapsed(0);};
  return {phase,draft,elapsedSeconds,isPlaying,error,level,playback,start,stop,upload,remove,setIsPlaying,playbackError:()=>{setIsPlaying(false);setError('This recording cannot be played in this browser. Use another audio format.');}};
}
