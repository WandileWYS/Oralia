import { db } from './db.ts';
import { appOrigin } from './config.ts';
import { sendEmail } from './providers/email.ts';
import { ServiceError } from './errors.ts';

export async function notifyCreation(id:string) {
  const record=await db.creationJob.findUniqueOrThrow({where:{id},include:{user:true}});
  if(record.status!=='COMPLETED')throw new ServiceError('NOT_READY',409,'Complete story generation first.');
  if(record.notificationStatus==='SENT')return;
  const claim=await db.creationJob.updateMany({where:{id,notificationStatus:{in:['PENDING','FAILED']}},data:{notificationStatus:'SENDING'}});
  if(!claim.count)return;
  try{
    await sendEmail(record.user.email,'Your Oralia story is ready for review',`Your ${record.totalScenes}-scene story has finished generating. Sign in to review your private draft before publication:\n${appOrigin()}/?creation=${encodeURIComponent(id)}`);
    await db.creationJob.update({where:{id},data:{notificationStatus:'SENT'}});
  }catch{await db.creationJob.update({where:{id},data:{notificationStatus:'FAILED'}});throw new ServiceError('EMAIL_FAILED',503,'Your story is complete, but its notification failed.',true);}
}
