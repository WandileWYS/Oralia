import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { db } from './db.ts';
import { ownedVersion } from './publication.ts';
import { snapshotSchema } from '../src/types/creation.ts';
import { downloadUrl, inspectAsset, readMedia, storeBytes } from './providers/storage.ts';
import { sendEmail } from './providers/email.ts';
import { ServiceError } from './errors.ts';
import { appOrigin } from './config.ts';

export async function createExport(userId:string,versionId:string) {
  await ownedVersion(versionId,userId);
  const user=await db.user.findUniqueOrThrow({where:{id:userId}});
  return db.storyExport.upsert({where:{userId_versionId:{userId,versionId}},create:{userId,versionId,recipient:user.email,notificationStatus:'QUEUED'},update:{}});
}
export async function exportData(userId:string,id:string) {
  const record=await db.storyExport.findFirst({where:{id,userId}});
  if(!record)throw new ServiceError('NOT_FOUND',404,'Export not found.');
  return {id:record.id,status:record.status,notificationStatus:record.notificationStatus,errorCode:record.errorCode,downloadUrl:record.status==='READY'&&record.assetPublicId?downloadUrl(record.assetPublicId,'zip','raw'):null};
}
export async function packageVersion(id:string) {
  const record=await db.storyExport.findUniqueOrThrow({where:{id}});
  if(record.status==='READY')return;
  const version=await ownedVersion(record.versionId,record.userId);
  const snapshot=snapshotSchema.parse(JSON.parse(version.snapshotJson));
  const publicId=`oralia/exports/${record.userId}/${id}.zip`;
  await db.storyExport.update({where:{id},data:{status:'BUILDING',errorCode:null}});
  try {
    let exists=false;try{await inspectAsset(publicId,'raw');exists=true;}catch{/* Build only when no completed archive can be recovered. */}
    if(!exists){
      const zip=new JSZip();const assets=[];
      for(let index=0;index<4;index++){
        const scene=snapshot.scenes[index];const bytes=await readMedia(downloadUrl(scene.publicId,'png','image'),20*1024*1024);const filename=`images/scene-${index+1}.png`;
        zip.file(filename,bytes);assets.push({...scene,filename,sha256:createHash('sha256').update(bytes).digest('hex')});
      }
      const audio=await readMedia(downloadUrl(snapshot.audio.publicId,'wav','video'),30*1024*1024);zip.file('narration.wav',audio);
      zip.file('manifest.json',JSON.stringify({schemaVersion:'oralia-storyboard-v4',versionId:version.id,storyId:version.storyId,collection:snapshot.input.collection,title:snapshot.input.title,provenance:snapshot.input.provenance,voiceType:'STUDIO_AI',audio:{filename:'narration.wav',duration:snapshot.audio.duration,sha256:createHash('sha256').update(audio).digest('hex')},scenes:assets},null,2));
      zip.file('transcript.txt',snapshot.transcript);zip.file('polished-story.txt',snapshot.plan.polishedText);
      await storeBytes(await zip.generateAsync({type:'nodebuffer'}),publicId,'raw','zip');
    }
    await db.storyExport.update({where:{id},data:{status:'READY',assetPublicId:publicId,errorCode:null}});
  }catch{await db.storyExport.update({where:{id},data:{status:'FAILED',errorCode:'EXPORT_FAILED'}});throw new ServiceError('EXPORT_FAILED',503,'The archive could not be prepared.',true);}
}
export async function notifyExport(id:string) {
  const record=await db.storyExport.findUniqueOrThrow({where:{id}});
  if(record.notificationStatus==='SENT'||!record.recipient)return;
  if(record.status!=='READY')throw new ServiceError('EXPORT_NOT_READY',409,'Complete the export first.');
  const claim=await db.storyExport.updateMany({where:{id,notificationStatus:{in:['QUEUED','FAILED']}},data:{notificationStatus:'SENDING'}});
  if(!claim.count)return;
  try {
    // A stable owner-authenticated app link mints a fresh expiring Cloudinary URL on demand.
    await sendEmail(record.recipient,'Your Oralia story assets are ready',`Your story export is ready. Sign in to your Oralia account and download it here:\n${appOrigin()}/?export=${encodeURIComponent(id)}\n\nOnly your verified account can access this export.`);
    await db.storyExport.update({where:{id},data:{notificationStatus:'SENT',errorCode:null}});
  }catch{await db.storyExport.update({where:{id},data:{notificationStatus:'FAILED',errorCode:'EMAIL_FAILED'}});throw new ServiceError('EMAIL_FAILED',503,'The archive is ready, but the email could not be sent.',true);}
}
