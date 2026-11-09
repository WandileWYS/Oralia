import {languageOptions,narrationLanguageSchema,unverifiedVoiceLanguages,type NarrationLanguage} from '../types/language';
import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Mic, RefreshCw, Sparkles, Square, Upload } from 'lucide-react';
import type { StoryCollection } from '../types/story';
import { collectionLabels, regionTagSchema, storyCollections, type RegionTag } from '../types/story';
import type { CreatorSession } from '../types/creator';
import { type CreationJob, type PolishedPlan } from '../types/creation';
import { api } from '../lib/api';
import { useStudioRecording } from '../hooks/useStudioRecording';
import { AudioDraftPlayer } from './AudioDraftPlayer';
import { DropdownSelect } from './DropdownSelect';
import { NeuralButton } from './NeuralButton';
import { formatTime } from '../lib/utils';

export function CreatorStudio({collection,session,onPublished}:{collection:StoryCollection;session:CreatorSession;onPublished:()=>void}){
  const [productionCollection,setCollection]=useState(collection);const [region,setRegion]=useState<RegionTag>('originals');const [title,setTitle]=useState('');const [text,setText]=useState('');const [provenance,setProvenance]=useState('');const [language,setLanguage]=useState<NarrationLanguage>('en');
  const [jobs,setJobs]=useState<CreationJob[]>([]);const [job,setJob]=useState<CreationJob|null>(null);const [plan,setPlan]=useState<PolishedPlan|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [reviewed,setReviewed]=useState(false);
  const capture=useStudioRecording();const requestKey=useRef(crypto.randomUUID());const loadKey=useRef('');
  const narration=useRef<HTMLAudioElement>(null);const [narrationPlaying,setNarrationPlaying]=useState(false);
  useEffect(()=>{requestKey.current=crypto.randomUUID();},[title,text,productionCollection,region,provenance,language,capture.draft]);
  const loadJobs=()=>api.jobs().then(result=>setJobs(result.jobs));
  useEffect(()=>{void loadJobs().catch(reason=>setError(reason instanceof Error?reason.message:'Could not load your creations.'));},[]);
  useEffect(()=>{if(!job||!['QUEUED','SCRIPT_READY','PROCESSING_MEDIA'].includes(job.status)&&job.stage!=='publishing'&&!(job.status==='COMPLETED'&&['PENDING','SENDING'].includes(job.notificationStatus)))return;let active=true;const timer=window.setInterval(()=>{void api.job(job.id).then(next=>{if(!active)return;setJob(next);if(next.stage==='published'){onPublished();setNotice('Your story is published in Vellum.');}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Status could not refresh.');});},3000);return()=>{active=false;clearInterval(timer);};},[job?.id,job?.status,job?.stage,job?.notificationStatus,onPublished]);
  useEffect(()=>{if(job?.plan&&loadKey.current!==job.id){loadKey.current=job.id;setPlan(job.plan);setReviewed(false);}},[job]);
  useEffect(()=>{const creation=new URLSearchParams(location.search).get('creation');if(creation)void api.job(creation).then(setJob).catch(reason=>setError(reason instanceof Error?reason.message:'Creation could not load.'));},[]);
  const act=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await action();}catch(reason){setError(reason instanceof Error?reason.message:'The operation failed.');}finally{setBusy(false);}};
  const selectJob=(value:CreationJob)=>{loadKey.current='';setJob(value);setPlan(value.plan);setReviewed(false);};
  const submit=()=>void act(async()=>{
    const uploaded=capture.draft?await api.upload(capture.draft.blob):null;
    const input={title,collection:productionCollection,region,provenance,language,...(uploaded?{sourceAssetId:uploaded.assetId}:{text})};
    const next=await api.create(input,requestKey.current);selectJob(next);await loadJobs();setNotice('Creation saved. Processing continues on the server.');
  });
  const move=(index:number,direction:number)=>{if(!plan)return;const scenes=[...plan.scenes];const target=index+direction;if(target<0||target>=scenes.length)return;[scenes[index],scenes[target]]=[scenes[target],scenes[index]];const ordered=scenes.map((scene,i)=>({...scene,proposedStartSeconds:i*6,proposedEndSeconds:(i+1)*6}));setPlan({...plan,scenes:ordered,polishedText:ordered.map(scene=>scene.narration).join('\n\n')});setReviewed(false);};
  const edit=(index:number,field:'narration'|'imagePrompt',value:string)=>{if(!plan)return;const scenes=plan.scenes.map((scene,i)=>i===index?{...scene,[field]:value}:scene);setPlan({...plan,scenes,polishedText:scenes.map(scene=>scene.narration).join('\n\n')});setReviewed(false);};
  const dirty=!!plan&&!!job?.plan&&JSON.stringify(plan)!==JSON.stringify(job.plan);
  return <section className="creator-studio" aria-label="Creator Studio">
    <div className="page-intro"><div><span className="eyebrow text-clay">THE CREATOR’S TABLE</span><h1>Your voice.<br/><em>A world of stories.</em></h1><p>Verified creator @{session.username}. Real transcription, illustration, and AI narration.</p></div></div>
    <div className="studio-layout">
      <section className="studio-input panel"><div className="section-heading"><h2>Create a story</h2><span className="outline-badge">01 / YOUR SOURCE</span></div>
        <label className="field-label" htmlFor="story-title">Story title · optional</label><input id="story-title" placeholder="Leave blank for a title inspired by your story" className="rounded-2xl project-name-input" maxLength={100} value={title} onChange={event=>{setTitle(event.target.value);requestKey.current=crypto.randomUUID();}}/>
        <DropdownSelect label="Production collection" value={productionCollection} options={storyCollections.map(value=>({value,label:collectionLabels[value]}))} onChange={setCollection}/>
        <DropdownSelect label="Region or tradition" value={region} options={regionTagSchema.options.map(value=>({value,label:value==='originals'?'Original narrative':value.replaceAll('-',' ')}))} onChange={setRegion}/>
        <DropdownSelect label="Target narration language" value={language} options={languageOptions} onChange={value=>setLanguage(narrationLanguageSchema.parse(value))}/>{unverifiedVoiceLanguages.includes(language)&&<p className="helper-text">AI voice quality is unverified for this language. Review pronunciation before publishing.</p>}
        <div className="record-zone"><strong>Record your story</strong><p>Up to five minutes / 20 MB. Your recording is uploaded only when you start creation.</p><div className="recording-status-row"><span>{capture.phase==='recording'?'Recording live':capture.phase==='requesting'?'Opening microphone':'Microphone ready'}</span><time>{formatTime(capture.elapsedSeconds)}</time></div>
          <div className="microphone-level" role="meter" aria-label="Live microphone input" aria-valuenow={Math.round(capture.level*100)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${capture.level*100}%`}}/></div>
          <button type="button" className="primary-button rounded-full" disabled={busy||capture.phase==='requesting'} onClick={()=>capture.phase==='recording'?capture.stop():void capture.start()}>{capture.phase==='recording'?<Square size={16}/>:<Mic size={16}/>} {capture.phase==='recording'?'Stop recording':'Record your story'}</button>
          <label className="upload-label rounded-full"><Upload size={15}/>Upload audio<input className="sr-only" type="file" accept="audio/*" disabled={busy||capture.phase==='recording'} onChange={event=>{const file=event.target.files?.[0];if(file)capture.upload(file);event.target.value='';}}/></label>
        </div>
        {capture.draft&&<div className="audio-draft rounded-2xl"><strong>{capture.draft.name}</strong><AudioDraftPlayer audioRef={capture.playback} url={capture.draft.url} isPlaying={capture.isPlaying} onPlayingChange={capture.setIsPlaying} onError={capture.playbackError}/><button className="text-button" type="button" onClick={capture.remove}>Remove recording</button></div>}
        {capture.error&&<p role="alert" className="error-message">{capture.error}</p>}
        <label className="field-label" htmlFor="story-input">Or write your story</label><textarea id="story-input" className="rounded-2xl" rows={7} maxLength={12000} disabled={!!capture.draft} value={text} onChange={event=>{setText(event.target.value);requestKey.current=crypto.randomUUID();}}/>
        <label className="field-label" htmlFor="story-provenance">Source, cultural context, and permission</label><textarea id="story-provenance" className="rounded-2xl" rows={3} maxLength={1000} value={provenance} onChange={event=>setProvenance(event.target.value)}/>
        <p className="helper-text">Confirm you have permission to submit this recording or text. Narration will be synthesized from the polished version; the original recording stays private.</p>
        <NeuralButton icon={<Sparkles size={16}/>} busy={busy} disabled={capture.phase==='recording'||capture.phase==='requesting'||!provenance.trim()||(!capture.draft&&!text.trim())} onClick={submit}>Generate illustrated story</NeuralButton>
      </section>
      <section className="studio-preview panel"><div className="section-heading"><h2>Your creations</h2><button className="icon-button" aria-label="Refresh creations" onClick={()=>void act(loadJobs)}><RefreshCw size={17}/></button></div>
        {!jobs.length&&<p className="helper-text">Your persisted creations will appear here.</p>}
        <div className="creation-list">{jobs.map(item=><button type="button" className="secondary-button rounded-full" key={item.id} aria-pressed={job?.id===item.id} onClick={()=>selectJob(item)}>Version {item.version} · {item.status.toLowerCase().replaceAll('_',' ')}</button>)}</div>
        {job&&<><div className="notice" role="status"><strong>{job.status.toLowerCase().replaceAll('_',' ')}</strong><p>{job.processedScenes} / {job.totalScenes} scenes · {job.completionPercentage}% · {job.stage}{job.errorCode?` · ${job.errorCode}`:''}</p>{['QUEUED','SCRIPT_READY','PROCESSING_MEDIA'].includes(job.status)&&<LoaderCircle size={18} className="animate-spin"/>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>void act(async()=>{setJob(await api.job(job.id));})}>Refresh creation</button></div>
          {job.status==='INDETERMINATE'&&<p className="error-message">A paid provider result could not be confirmed. Check the retained assets before explicitly creating another version; regeneration can incur additional charges.</p>}
          {job.status==='INDETERMINATE'&&plan&&<NeuralButton icon={<Sparkles size={16}/>} busy={busy} onClick={()=>void act(async()=>{selectJob(await api.revise(job.id,plan,crypto.randomUUID()));await loadJobs();})}>Start a new paid version</NeuralButton>}
          {job.retryable&&job.status==='FAILED'&&<button className="secondary-button" onClick={()=>void act(async()=>{setJob(await api.retry(job.id));})}>Retry failed processing</button>}
          {job.status==='COMPLETED'&&<p role="status">Completion email: {job.notificationStatus.toLowerCase()}{job.notificationStatus==='FAILED'&&<button className="secondary-button" onClick={()=>void act(async()=>{await api.notifyCreation(job.id);setJob({...job,notificationStatus:'PENDING'});})}>Retry completion email</button>}</p>}
          {job.transcript&&<details className="rounded-2xl"><summary>Original transcript</summary><p>{job.transcript}</p></details>}
          {job.audioUrl&&<div className="production-audio"><p className="helper-text">AI-generated narration · review before publishing</p><AudioDraftPlayer audioRef={narration} url={job.audioUrl} isPlaying={narrationPlaying} onPlayingChange={setNarrationPlaying} onError={()=>setError('Narration could not load. Refresh the creation to renew access.')}/></div>}
          {plan&&<p className="notice">Refined title: {plan.polishedTitle||title}</p>}{plan&&<div className="production-scenes">{plan.scenes.map((scene,index)=><article className="panel rounded-2xl" key={index}>{job.preview.find(image=>image.sceneNumber===index+1)&&<img className="rounded-2xl" src={job.preview.find(image=>image.sceneNumber===index+1)!.imageUrl} alt={scene.title}/>}<h3>{String(index+1).padStart(2,'0')} · {scene.title}</h3><div className="scene-reorder"><button type="button" className="secondary-button" disabled={index===0} onClick={()=>move(index,-1)}>Move earlier</button><button type="button" className="secondary-button" disabled={index===plan.scenes.length-1} onClick={()=>move(index,1)}>Move later</button></div><label className="field-label">Scene narration<textarea rows={4} maxLength={2000} className="rounded-2xl" value={scene.narration} onChange={event=>edit(index,'narration',event.target.value)}/></label><label className="field-label">Image prompt<textarea rows={3} maxLength={2000} className="rounded-2xl" value={scene.imagePrompt} onChange={event=>edit(index,'imagePrompt',event.target.value)}/></label></article>)}</div>}
          {plan&&dirty&&<NeuralButton icon={<Sparkles size={16}/>} busy={busy} onClick={()=>void act(async()=>{selectJob(await api.revise(job.id,plan,crypto.randomUUID()));await loadJobs();})}>Generate new version from edits</NeuralButton>}
          {job.versionId&&job.status==='COMPLETED'&&<><label className="review-confirmation"><input type="checkbox" checked={reviewed&&!dirty} disabled={dirty} onChange={event=>setReviewed(event.target.checked)}/>I reviewed all narration, images, and cultural context, and have permission to publish.</label><NeuralButton icon={<Check size={16}/>} disabled={busy||!reviewed||dirty||job.stage==='publishing'} busy={busy} onClick={()=>void act(async()=>{await api.publish(job.versionId!);setJob({...job,stage:'publishing'});setNotice('Publication started. Your story appears after all assets are ready.');})}>Publish to Vellum</NeuralButton></>}
        </>}
      </section>
    </div>{error&&<p className="notice error-message" role="alert">{error}</p>}{notice&&<p className="notice success-message" role="status">{notice}</p>}
  </section>;
}
