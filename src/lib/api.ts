import { z } from 'zod';
import { bookmarksSchema, catalogSchema, challengeSchema, okSchema } from '../types/api';
import { creatorSessionSchema } from '../types/creator';
import { exportSchema, jobSchema, type CreationInput, type PolishedPlan } from '../types/creation';

export class ApiError extends Error {
  constructor(message:string,public readonly status:number,public readonly code?:string){super(message);}
}
export async function request<T>(path:string,schema:z.ZodType<T>,options:RequestInit={}):Promise<T>{
  const response=await fetch(`/api/v1${path}`,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
  if(!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type')??''))throw new ApiError(`The API returned a non-JSON response (HTTP ${response.status}). Check the serverless deployment and API routing.`,response.status);
  const data:unknown=await response.json();
  if(!response.ok){const error=z.object({error:z.string(),code:z.string().optional()}).safeParse(data);throw new ApiError(error.success?error.data.error:'The request could not be completed.',response.status,error.success?error.data.code:undefined);}
  return schema.parse(data);
}
const post=(value:unknown)=>({method:'POST',body:JSON.stringify(value)});
const uploadSchema=z.object({assetId:z.string(),apiKey:z.string(),signature:z.string(),uploadUrl:z.string().url(),parameters:z.object({public_id:z.string(),timestamp:z.number(),type:z.literal('authenticated'),overwrite:z.literal(false),allowed_formats:z.string()})});
export const api={
  catalog:(signal?:AbortSignal)=>request('/catalog',catalogSchema,{signal}),
  requestPin:(email:string)=>request('/auth/otp/request',challengeSchema,post({email})),
  verifyPin:(challengeId:string,pin:string)=>request('/auth/otp/verify',creatorSessionSchema,post({challengeId,pin})),
  session:()=>request('/auth/session',creatorSessionSchema),
  logout:()=>request('/auth/logout',okSchema,post({})),
  voice:(voiceType:'ORIGINAL'|'STUDIO_AI')=>request('/me/voice',creatorSessionSchema,{method:'PATCH',body:JSON.stringify({voiceType})}),
  bookmarks:()=>request('/bookmarks',bookmarksSchema),
  bookmark:(id:string,saved:boolean)=>request(`/bookmarks/${encodeURIComponent(id)}`,okSchema,{method:saved?'PUT':'DELETE'}),
  jobs:()=>request('/creations',z.object({jobs:jobSchema.array()})),
  job:(id:string)=>request(`/creations/${encodeURIComponent(id)}`,jobSchema),
  create:(input:CreationInput,requestKey:string)=>request('/creations',jobSchema,post({input,requestKey})),
  revise:(id:string,plan:PolishedPlan,requestKey:string)=>request(`/creations/${encodeURIComponent(id)}`,jobSchema,{method:'PATCH',body:JSON.stringify({plan,requestKey})}),
  notifyCreation:(id:string)=>request(`/creations/${encodeURIComponent(id)}/notify`,okSchema,post({})),
  retry:(id:string)=>request(`/creations/${encodeURIComponent(id)}/retry`,jobSchema,post({})),
  publish:(versionId:string)=>request(`/versions/${encodeURIComponent(versionId)}/publish`,okSchema,post({reviewed:true})),
  createExport:(versionId:string)=>request('/exports',exportSchema,post({versionId})),
  export:(id:string)=>request(`/exports/${encodeURIComponent(id)}`,exportSchema),
  notifyExport:(id:string)=>request(`/exports/${encodeURIComponent(id)}/notify`,okSchema,post({})),
  async upload(file:Blob){
    const signed=await request('/uploads',uploadSchema,post({}));const data=new FormData();
    for(const [key,value]of Object.entries(signed.parameters))data.set(key,String(value));
    data.set('api_key',signed.apiKey);data.set('signature',signed.signature);data.set('file',file);
    const response=await fetch(signed.uploadUrl,{method:'POST',body:data});
    if(!response.ok)throw new Error('Audio upload failed. Try again.');
    return request(`/uploads/${encodeURIComponent(signed.assetId)}/complete`,z.object({assetId:z.string()}),post({}));
  },
};
