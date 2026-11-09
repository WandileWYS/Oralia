import {z} from 'zod';
import {request} from './api';
import {foundryJobSchema,foundryExportSchema,foundryUploadSchema,type FoundryInput} from '../types/foundry';
const post=(value:unknown)=>({method:'POST',body:JSON.stringify(value)});
const ok=z.object({ok:z.literal(true)});
export const foundryApi={
 jobs:()=>request('/foundry/jobs',z.object({jobs:foundryJobSchema.array()})),job:(id:string)=>request(`/foundry/jobs/${encodeURIComponent(id)}`,foundryJobSchema),
 submit:(input:FoundryInput,key:string)=>request('/foundry/jobs',foundryJobSchema,post({input,requestKey:key})),retry:(id:string)=>request(`/foundry/jobs/${encodeURIComponent(id)}/retry`,foundryJobSchema,post({})),
 exports:()=>request('/foundry/exports',z.object({exports:foundryExportSchema.array()})),export:(id:string)=>request(`/foundry/exports/${encodeURIComponent(id)}`,foundryExportSchema),retryExport:(id:string)=>request(`/foundry/exports/${encodeURIComponent(id)}/retry`,ok,post({})),notify:(id:string)=>request(`/foundry/exports/${encodeURIComponent(id)}/notify`,ok,post({})),
 async upload(file:File){const signed=await request('/foundry/references',foundryUploadSchema,post({}));const body=new FormData();for(const [key,value]of Object.entries(signed.parameters))body.set(key,String(value));body.set('signature',signed.signature);body.set('api_key',signed.apiKey);body.set('file',file);const response=await fetch(signed.uploadUrl,{method:'POST',body});if(!response.ok)throw new Error('Reference upload failed. Retry the upload.');return request(`/foundry/references/${encodeURIComponent(signed.assetId)}/complete`,z.object({assetId:z.string()}),post({}));},
};
