import { db } from './db.ts';
import { snapshotSchema } from '../src/types/creation.ts';
import { ServiceError } from './errors.ts';
import { downloadUrl, inspectAsset, publicMediaUrl, readMedia, storeBytes } from './providers/storage.ts';

export async function ownedVersion(id:string,userId:string) {
  const version=await db.storyVersion.findFirst({where:{id,userId}});
  if(!version)throw new ServiceError('NOT_FOUND',404,'Story version not found.');
  return version;
}
async function publicCopy(sourceId:string,destinationId:string,type:'image'|'video',format:string) {
  try {await inspectAsset(destinationId,type,'upload');}
  catch {
    const bytes=await readMedia(downloadUrl(sourceId,format,type),100*1024*1024);
    try {await storeBytes(bytes,destinationId,type,format,'upload');}
    catch(error){try{await inspectAsset(destinationId,type,'upload');}catch{throw error;}}
  }
  return publicMediaUrl(destinationId,type,format);
}
export async function publishVersion(id:string,userId:string) {
  const version=await ownedVersion(id,userId);
  const job=await db.creationJob.findUnique({where:{id:version.jobId}});
  if(job?.status!=='COMPLETED')throw new ServiceError('NOT_READY',409,'Only a complete reviewed story can be published.');
  const latest=await db.storyVersion.findFirst({where:{storyId:version.storyId,userId},orderBy:{number:'desc'}});
  if(latest?.id!==version.id)throw new ServiceError('VERSION_STALE',409,'Review the latest story version before publishing.');
  const snapshot=snapshotSchema.parse(JSON.parse(version.snapshotJson));
  const narration=await publicCopy(snapshot.audio.publicId,`oralia/published/${id}/narration`,'video','wav');
  const images:string[]=[];
  for(let index=0;index<snapshot.scenes.length;index++)images.push(await publicCopy(snapshot.scenes[index].publicId,`oralia/published/${id}/scene-${index+1}`,'image','png'));
  await db.$transaction(async tx=>{
    const latestJob=await tx.creationJob.findFirst({where:{storyId:version.storyId,userId},orderBy:{version:'desc'}});
    if(latestJob?.id!==version.jobId)throw new ServiceError('VERSION_STALE',409,'Review the latest story version before publishing.');
    const current=await tx.story.findUnique({where:{id:version.storyId}});
    if(current&&current.authorId!==userId)throw new ServiceError('FORBIDDEN',403,'This story belongs to another creator.');
    const published=current?.versionId?await tx.storyVersion.findUnique({where:{id:current.versionId}}):null;
    if(published&&published.number>version.number)throw new ServiceError('VERSION_STALE',409,'A newer version has already been published.');
    const fields={title:snapshot.plan.polishedTitle||snapshot.input.title,description:snapshot.plan.polishedText.slice(0,220),collection:snapshot.input.collection,regionTag:snapshot.input.region,audioUrl:narration,duration:snapshot.audio.duration,authorId:userId,voiceType:'STUDIO_AI' as const,sourceTitle:'Creator-submitted story',sourceUrl:'',culturalNote:snapshot.input.provenance,publishedAt:new Date(),versionId:id,provenance:'CREATOR_GENERATED',language:snapshot.plan.language||snapshot.input.language};
    await tx.story.upsert({where:{id:version.storyId},create:{id:version.storyId,...fields},update:fields});
    for(let index=0;index<snapshot.scenes.length;index++){
      const scene=snapshot.scenes[index];const fields={storyId:version.storyId,sceneNumber:index+1,title:scene.title,narrationText:scene.narration,imageUrl:images[index],timestamp:scene.startTime,imageCredit:'AI-generated with OpenAI',imageSourceUrl:''};
      await tx.keyframeScene.upsert({where:{storyId_sceneNumber:{storyId:version.storyId,sceneNumber:index+1}},create:{id:`${version.storyId}-${index+1}`,...fields},update:fields});
    }
    await tx.keyframeScene.deleteMany({where:{storyId:version.storyId,sceneNumber:{gt:snapshot.scenes.length}}});
    await tx.storyVersion.update({where:{id},data:{publishedAt:new Date()}});
    await tx.creationJob.update({where:{id:version.jobId},data:{stage:'published',errorCode:null}});
  });
}
